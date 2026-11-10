// One failed ping is not evidence that the store is down (v2 #1669): the website reads unavailable
// only after no ping has answered for this long. Recovery is never gated.
export const WEBSITE_UNAVAILABLE_CONFIRMATION_MS = 30_000;
// The verdict is taken when a probe resolves, so the probe one interval after the first failure can
// land a hair inside the window; far below the interval, so back-to-back wake checks never confirm each other.
export const WEBSITE_UNAVAILABLE_CONFIRMATION_TOLERANCE_MS = 1_000;
// v2's web re-probe interval while the page is visible.
export const PROBE_INTERVAL_MS = 30_000;
// A probe that has not answered in this long counts as a failure.
export const PROBE_TIMEOUT_MS = 10_000;

/** The marked WCPOS ping URL from the store's WordPress REST root. */
export function pingProbeUrl(wpApiUrl: string): string {
  const base = wpApiUrl.endsWith('/') ? wpApiUrl : `${wpApiUrl}/`;
  const separator = wpApiUrl.includes('rest_route=') ? '&' : '?';
  return `${base}wcpos/v2/ping${separator}wcpos=1`;
}

async function attempt(url: string, method: 'HEAD' | 'GET', fetchImpl: typeof fetch): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method, mode: 'cors', cache: 'no-store', signal: controller.signal });
    // A 404 (an older plugin without the ping route) still proves WordPress answered; a 5xx can be a
    // live proxy in front of a dead backend, so it does not.
    return !(typeof response.status === 'number' && response.status >= 500);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/** Ping the store; some servers drop HEAD while serving GET, so GET is the fallback. */
export async function checkWebsiteReachability(wpApiUrl: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const url = pingProbeUrl(wpApiUrl);
  return (await attempt(url, 'HEAD', fetchImpl)) || attempt(url, 'GET', fetchImpl);
}
