import * as Network from 'expo-network';

const OFFLINE_RE =
  /unknownhost|unable to resolve host|no address associated|enotfound|eai_again|network request failed|failed to fetch|fetch failed|network error|offline|timeout|timed out|econnreset|econnrefused|internet|502|503|504|abort|aborted|canceled|cancelled|interrupted|broken pipe|socket closed|connection closed|software caused connection|ioexception/i;

export function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return OFFLINE_RE.test(msg);
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** True only if the device can actually reach GitHub. DNS failure counts as offline. */
export async function isOnline(): Promise<boolean> {
  if (!isBrowserOnline()) return false;
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false || state.isInternetReachable === false) return false;
  } catch {
    // ignore — still probe GitHub
  }
  try {
    const res = await fetch('https://api.github.com', {
      method: 'GET',
      headers: { Accept: 'application/vnd.github+json' },
    });
    return res.status < 500;
  } catch {
    return false;
  }
}
