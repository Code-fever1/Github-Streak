import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { Store, newProjectId, normalizeProject } from './store.js';
import { generateSshKeyPair, importSshPrivateKey, verifyProjectAccess, runScheduledTick, runQuickCommit, runEphemeralCommits, getTodayPlan, runDueTicks } from './engine.js';
import { msUntilNextTick } from './timer.js';
import { log } from './logger.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-token',
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function authorized(req, apiToken) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const alt = req.headers['x-api-token'];
  return bearer === apiToken || alt === apiToken;
}

function isLoopback(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

export function startServer({ host = '0.0.0.0', port = 8787, store, paths, apiToken }) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const { pathname } = url;

      if (pathname === '/health') {
        json(res, 200, { ok: true, projects: store.listProjects().length });
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/git-push') {
        if (!authorized(req, apiToken) && !isLoopback(req)) {
          json(res, 401, { error: 'Unauthorized. Set Authorization: Bearer <apiToken>.' });
          return;
        }
        const body = await readBody(req);
        if (!SAFE_NAME.test(body.owner || '') || !SAFE_NAME.test(body.repo || '')) {
          json(res, 400, { error: 'owner and repo are required' });
          return;
        }
        if (!body.privateKey || !String(body.privateKey).includes('PRIVATE KEY')) {
          json(res, 400, { error: 'SSH private key is required' });
          return;
        }
        const result = await runEphemeralCommits(paths, body);
        json(res, 200, result);
        return;
      }

      if (!authorized(req, apiToken)) {
        json(res, 401, { error: 'Unauthorized. Set Authorization: Bearer <apiToken>.' });
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/state') {
        const projects = store.listProjects();
        const ticks = store.readTicks();
        const now = new Date();
        json(res, 200, {
          projects,
          logs: store.listLogs(),
          lastTicks: ticks.lastTicks,
          lastFixedSlots: ticks.lastFixedSlots,
          plans: Object.fromEntries(projects.map((p) => [p.id, getTodayPlan(p, paths)])),
          nextTicks: Object.fromEntries(
            projects.map((p) => [p.id, msUntilNextTick(p, ticks.lastTicks[p.id] || null, now)]),
          ),
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/v1/logs') {
        json(res, 200, { logs: store.listLogs() });
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/ssh-keys') {
        const body = await readBody(req);
        let pair;
        if (body.privateKey) {
          pair = importSshPrivateKey(body.privateKey);
        } else {
          pair = generateSshKeyPair();
        }
        const id = `key-${randomBytes(6).toString('hex')}`;
        store.savePendingKey(id, pair.privateKey, pair.publicKey);
        json(res, 201, { id, publicKey: pair.publicKey });
        return;
      }

      if (req.method === 'POST' && pathname === '/v1/projects') {
        const body = await readBody(req);
        if (!body.owner || !body.repo) {
          json(res, 400, { error: 'owner and repo are required' });
          return;
        }
        const project = normalizeProject({
          ...body,
          id: newProjectId(),
          createdAt: new Date().toISOString(),
        });

        let secrets = {};
        if (project.authType === 'ssh') {
          let pair;
          if (body.sshKeyId) {
            pair = store.takePendingKey(body.sshKeyId);
            if (!pair) {
              json(res, 400, { error: 'SSH key expired. Generate a new key.' });
              return;
            }
          } else if (body.sshPrivateKey) {
            pair = importSshPrivateKey(body.sshPrivateKey);
          } else {
            pair = generateSshKeyPair();
          }
          project.sshPublicKey = pair.publicKey;
          secrets.sshPrivateKey = pair.privateKey;
          if (body.token) secrets.token = body.token;
        } else {
          if (!body.token) {
            json(res, 400, { error: 'GitHub token is required for token auth' });
            return;
          }
          secrets.token = body.token;
        }

        try {
          await verifyProjectAccess(project, secrets, paths);
        } catch (err) {
          if (project.authType === 'ssh') {
            // Save anyway — user may still need to add the deploy key on GitHub.
            store.setSecrets(project.id, secrets);
            store.upsertProject(project);
            json(res, 201, {
              project,
              warning: `Saved, but GitHub is not reachable yet: ${err.message}. Add the public key as a write deploy key, then try Commit +1.`,
            });
            return;
          }
          json(res, 400, { error: err.message });
          return;
        }

        store.setSecrets(project.id, secrets);
        store.upsertProject(project);
        json(res, 201, { project });
        return;
      }

      const projectMatch = pathname.match(/^\/v1\/projects\/([^/]+)(?:\/(.*))?$/);
      if (projectMatch) {
        const id = decodeURIComponent(projectMatch[1]);
        const rest = projectMatch[2] || '';
        const project = store.getProject(id);
        if (!project) {
          json(res, 404, { error: 'Project not found' });
          return;
        }

        if (req.method === 'GET' && rest === '') {
          json(res, 200, { project });
          return;
        }

        if (req.method === 'GET' && rest === 'plan') {
          json(res, 200, { plan: getTodayPlan(project, paths) });
          return;
        }

        if (req.method === 'PATCH' && rest === '') {
          const body = await readBody(req);
          const next = normalizeProject({ ...project, ...body, id: project.id, createdAt: project.createdAt });
          store.upsertProject(next);
          json(res, 200, { project: next });
          return;
        }

        if (req.method === 'DELETE' && rest === '') {
          store.deleteProject(id);
          json(res, 200, { ok: true });
          return;
        }

        if (req.method === 'POST' && rest === 'commit') {
          const entry = await runQuickCommit(store, project, paths);
          store.appendLog(entry);
          json(res, 200, { log: entry });
          return;
        }

        if (req.method === 'POST' && rest === 'tick') {
          const entry = await runScheduledTick(store, project, paths, { force: true });
          store.appendLog(entry);
          json(res, 200, { log: entry });
          return;
        }
      }

      json(res, 404, { error: 'Not found' });
    } catch (err) {
      log(`API error: ${err.message}`);
      json(res, 500, { error: err.message });
    }
  });

  server.listen(port, host, () => {
    log(`API listening on http://${host}:${port}`);
    log(`Use this URL from the phone (LAN IP, not localhost unless emulator).`);
    log(`API token: ${apiToken}`);
  });

  const loop = setInterval(() => {
    runDueTicks(store, paths).catch((err) => log(`scheduler error: ${err.message}`));
  }, 20_000);
  runDueTicks(store, paths).catch((err) => log(`scheduler error: ${err.message}`));

  server.on('close', () => clearInterval(loop));
  return server;
}

export function createApi({ stateDir, workDir, host, port, apiToken }) {
  const store = new Store(stateDir);
  const token = apiToken || store.getApiToken();
  const paths = { stateDir, workDir, keysDir: store.keysDir };
  return startServer({ host, port, store, paths, apiToken: token });
}
