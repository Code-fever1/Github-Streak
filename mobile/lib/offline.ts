export function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /network request failed|failed to fetch|network error|offline|timeout|timed out|econnreset|enotfound|internet|502|503|504/i.test(
    msg,
  );
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Never use HEAD — GitHub CORS blocks it, which made localhost look offline. */
export async function isOnline(): Promise<boolean> {
  if (!isBrowserOnline()) return false;
  try {
    const res = await fetch('https://api.github.com', {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
    });
    return res.status < 500;
  } catch {
    return isBrowserOnline();
  }
}
