import { getGithubToken } from './storage';
import type { Project } from './types';

const repoLocks = new Map<string, Promise<void>>();

export function repoKey(project: Project): string {
  return `${project.owner}/${project.repo}#${project.branch}`;
}

/** One in-flight PATCH per repo+branch. Blob/tree/commit creation is not locked. */
export async function withRepoLock<T>(project: Project, fn: () => Promise<T>): Promise<T> {
  const key = repoKey(project);
  const prev = repoLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  repoLocks.set(key, prev.then(() => held).catch(() => held));
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
  }
}

export class FastForwardError extends Error {
  constructor(message = 'Update is not a fast forward') {
    super(message);
    this.name = 'FastForwardError';
  }
}

export function isFastForwardError(err: unknown): boolean {
  if (err instanceof FastForwardError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /422|fast forward/i.test(msg);
}

async function hdrs(project: Project) {
  const token = await getGithubToken(project.id);
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function baseUrl(project: Project): string {
  return `https://api.github.com/repos/${project.owner}/${project.repo}`;
}

async function githubError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body?.message) return `${fallback} (${res.status}: ${body.message})`;
  } catch {
    // ignore
  }
  return `${fallback} (${res.status})`;
}

export async function verifyGithubToken(owner: string, repo: string, token: string): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.ok) return;
  throw new Error(
    await githubError(
      res,
      'GitHub token was rejected. Create a classic PAT with the repo scope, or a fine-grained token with Contents: Read and write.',
    ),
  );
}

export async function getFileContent(
  project: Project,
  path: string,
): Promise<{ content: string; sha?: string } | null> {
  const res = await fetch(
    `${baseUrl(project)}/contents/${path}?ref=${encodeURIComponent(project.branch)}`,
    { headers: await hdrs(project) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await githubError(res, `Failed to read ${path}`));
  const data = await res.json();
  const content = atob(String(data.content || '').replace(/\n/g, ''));
  return { content, sha: data.sha };
}

export interface CommitSession {
  project: Project;
  headers: Record<string, string>;
  url: string;
  headSha: string;
  treeSha: string;
}

export async function getBranchHeadSha(project: Project): Promise<string> {
  const headers = await hdrs(project);
  const url = `${baseUrl(project)}/git/ref/heads/${encodeURIComponent(project.branch)}`;
  const refRes = await fetch(url, { headers });
  if (!refRes.ok) {
    throw new Error(
      await githubError(
        refRes,
        `Can't read ${project.owner}/${project.repo} (${project.branch}). Need a GitHub token with repo access.`,
      ),
    );
  }
  const ref = await refRes.json();
  return ref.object.sha as string;
}

export async function startCommitSession(project: Project): Promise<CommitSession> {
  const headers = await hdrs(project);
  const url = baseUrl(project);
  const headSha = await getBranchHeadSha(project);
  const commitRes = await fetch(`${url}/git/commits/${headSha}`, { headers });
  if (!commitRes.ok) throw new Error(await githubError(commitRes, 'Failed to read parent commit'));
  const parentCommit = await commitRes.json();
  return { project, headers, url, headSha, treeSha: parentCommit.tree.sha };
}

/** Read files from the git tree (avoids Contents API cache after a rebuild). */
export async function readFilesFromTree(
  session: CommitSession,
  paths: string[],
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = Object.fromEntries(paths.map((p) => [p, null]));
  const treeRes = await fetch(`${session.url}/git/trees/${session.treeSha}`, { headers: session.headers });
  if (!treeRes.ok) throw new Error(await githubError(treeRes, 'Failed to read tree'));
  const tree = await treeRes.json();
  const wanted = new Set(paths);
  const items = (tree.tree as Array<{ path: string; sha: string; type: string }>).filter(
    (item) => wanted.has(item.path) && item.type === 'blob',
  );
  await Promise.all(
    items.map(async (item) => {
      const blobRes = await fetch(`${session.url}/git/blobs/${item.sha}`, { headers: session.headers });
      if (!blobRes.ok) throw new Error(await githubError(blobRes, `Failed to read ${item.path}`));
      const blob = await blobRes.json();
      out[item.path] = atob(String(blob.content || '').replace(/\n/g, ''));
    }),
  );
  return out;
}

/** Create a commit object only. Does not move the branch (no push). */
export async function appendCommit(
  session: CommitSession,
  message: string,
  files: Record<string, string>,
): Promise<string> {
  const { headers, url } = session;
  const treeItems = await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const blobRes = await fetch(`${url}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content, encoding: 'utf-8' }),
      });
      if (!blobRes.ok) throw new Error(await githubError(blobRes, `Failed to create blob for ${path}`));
      const blob = await blobRes.json();
      return { path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha as string };
    }),
  );

  const treeRes = await fetch(`${url}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base_tree: session.treeSha, tree: treeItems }),
  });
  if (!treeRes.ok) throw new Error(await githubError(treeRes, 'Failed to create tree'));
  const newTree = await treeRes.json();

  const now = new Date().toISOString();
  const newCommitRes = await fetch(`${url}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      tree: newTree.sha,
      parents: [session.headSha],
      author: { name: session.project.authorName, email: session.project.authorEmail, date: now },
      committer: { name: session.project.authorName, email: session.project.authorEmail, date: now },
    }),
  });
  if (!newCommitRes.ok) throw new Error(await githubError(newCommitRes, 'Failed to create commit'));
  const newCommit = await newCommitRes.json();
  session.headSha = newCommit.sha;
  session.treeSha = newTree.sha;
  return newCommit.sha as string;
}

/**
 * PATCH one commit. GET HEAD first; if it is not parentSha, throw FastForwardError
 * so the caller can rebuild. Never force-push. Already-at-head is success.
 * Serialized per repo so two PATCHes cannot race.
 */
export async function pushCommit(
  session: CommitSession,
  commitSha: string,
  parentSha: string,
  opts: { checkHead?: boolean } = {},
): Promise<void> {
  await withRepoLock(session.project, async () => {
    if (opts.checkHead !== false) {
      const current = await getBranchHeadSha(session.project);
      if (current === commitSha) return;
      if (current !== parentSha) {
        throw new FastForwardError(
          `Branch moved before push (${current.slice(0, 7)} != ${parentSha.slice(0, 7)})`,
        );
      }
    }
    const updateRes = await fetch(
      `${session.url}/git/refs/heads/${encodeURIComponent(session.project.branch)}`,
      {
        method: 'PATCH',
        headers: session.headers,
        body: JSON.stringify({ sha: commitSha, force: false }),
      },
    );
    if (updateRes.ok) return;
    const again = await getBranchHeadSha(session.project).catch(() => null);
    if (again === commitSha) return;
    const detail = await githubError(updateRes, 'Failed to push commit');
    if (updateRes.status === 422 || /fast forward/i.test(detail)) {
      throw new FastForwardError(detail);
    }
    throw new Error(detail);
  });
}
