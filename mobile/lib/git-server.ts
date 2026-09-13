import { Platform } from 'react-native';
import type { Project } from './types';

function serverBases(): string[] {
  const extra = process.env.EXPO_PUBLIC_STREAK_SERVER_URL?.replace(/\/$/, '');
  // Never hit http://127.0.0.1 from Android/iOS — that is the phone, and HTTP is blocked as cleartext.
  if (Platform.OS !== 'web') return extra ? [extra] : [];
  const bases = [extra, 'http://127.0.0.1:8787', 'http://localhost:8787'].filter(
    (v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i,
  );
  return bases;
}

export async function commitViaGitServer(
  project: Project,
  n: number,
  privateKey: string,
): Promise<{ made: number; messages: string[] }> {
  const payload = {
    id: project.id,
    owner: project.owner,
    repo: project.repo,
    branch: project.branch,
    authorName: project.authorName,
    authorEmail: project.authorEmail,
    privateKey,
    n,
  };

  let lastError = 'Local git server is not running on port 8787';
  for (const base of serverBases()) {
    try {
      const res = await fetch(`${base}/v1/git-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const made = Number(body.made) || 0;
        return {
          made,
          messages: made > 0 ? [`Pushed ${made} commit(s) to GitHub`] : ['Git produced no commit'],
        };
      }
      lastError = body.error || `Git server ${res.status}`;
      if (res.status !== 404) throw new Error(lastError);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/failed to fetch|network request failed|econnrefused/i.test(msg)) throw err;
      lastError = msg;
    }
  }

  throw new Error(
    `${lastError}. SSH keys cannot push from the browser — start streak-keeper with --serve, then tap +1 again.`,
  );
}
