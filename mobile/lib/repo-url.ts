export interface ParsedRepo {
  owner: string;
  repo: string;
}

/** Parse git@github.com:owner/repo.git or https://github.com/owner/repo */
export function parseRepoInput(input: string): ParsedRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2].replace(/\.git$/, '') };

  const https = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (https) return { owner: https[1], repo: https[2].replace(/\.git$/, '') };

  const short = trimmed.match(/^([^/]+)\/([^/]+)$/);
  if (short) return { owner: short[1], repo: short[2].replace(/\.git$/, '') };

  return null;
}

export function sshCloneUrl(owner: string, repo: string): string {
  return `git@github.com:${owner}/${repo}.git`;
}

export function httpsCloneUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}
