import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function generateEd25519Key(comment = 'streak-keeper') {
  const dir = mkdtempSync(join(tmpdir(), 'streak-key-'));
  const file = join(dir, 'id_ed25519');
  try {
    execFileSync('ssh-keygen', ['-t', 'ed25519', '-f', file, '-N', '', '-C', comment, '-q'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return {
      privateKey: readFileSync(file, 'utf8'),
      publicKey: readFileSync(`${file}.pub`, 'utf8').trim(),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function publicKeyFromPrivate(privateKey) {
  const dir = mkdtempSync(join(tmpdir(), 'streak-key-'));
  const file = join(dir, 'id_ed25519');
  try {
    writeFileSync(file, privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`, { mode: 0o600 });
    chmodSync(file, 0o600);
    return execFileSync('ssh-keygen', ['-y', '-f', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    throw new Error(`Invalid SSH private key: ${stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function sshCommand(keyPath) {
  return `ssh -i ${JSON.stringify(keyPath)} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
}
