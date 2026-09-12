import type { Project } from './types';

function hdrs() {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
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

export async function getFileContent(
  project: Project,
  path: string,
): Promise<{ content: string; sha?: string } | null> {
  const res = await fetch(
    `${baseUrl(project)}/contents/${path}?ref=${encodeURIComponent(project.branch)}`,
    { headers: hdrs() },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await githubError(res, `Failed to read ${path}`));
  const data = await res.json();
  const content = atob(String(data.content || '').replace(/\n/g, ''));
  return { content, sha: data.sha };
}

export async function createMultiFileCommit(
  project: Project,
  message: string,
  files: Record<string, string>,
): Promise<string> {
  const headers = hdrs();
  const url = baseUrl(project);

  const refRes = await fetch(`${url}/git/ref/heads/${encodeURIComponent(project.branch)}`, { headers });
  if (!refRes.ok) {
    throw new Error(
      await githubError(
        refRes,
        `Can't read ${project.owner}/${project.repo} (${project.branch}). Private repos need the local git server (SSH), not the GitHub website API.`,
      ),
    );
  }
  const ref = await refRes.json();
  const parentSha = ref.object.sha;

  const commitRes = await fetch(`${url}/git/commits/${parentSha}`, { headers });
  if (!commitRes.ok) throw new Error('Failed to read parent commit');
  const parentCommit = await commitRes.json();

  const treeItems = [];
  for (const [path, content] of Object.entries(files)) {
    const blobRes = await fetch(`${url}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, encoding: 'utf-8' }),
    });
    if (!blobRes.ok) throw new Error(await githubError(blobRes, `Failed to create blob for ${path}`));
    const blob = await blobRes.json();
    treeItems.push({ path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha });
  }

  const treeRes = await fetch(`${url}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeItems }),
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
      parents: [parentSha],
      author: { name: project.authorName, email: project.authorEmail, date: now },
      committer: { name: project.authorName, email: project.authorEmail, date: now },
    }),
  });
  if (!newCommitRes.ok) {
    throw new Error(await githubError(newCommitRes, 'Failed to create commit'));
  }
  const newCommit = await newCommitRes.json();

  const updateRes = await fetch(`${url}/git/refs/heads/${encodeURIComponent(project.branch)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });
  if (!updateRes.ok) throw new Error(await githubError(updateRes, 'Failed to update branch'));

  return newCommit.sha;
}
