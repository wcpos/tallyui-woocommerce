export interface StoreSite {
  name: string;
  home: string;
  wpApiUrl: string;
  wcposApiUrl: string;
  authUrl: string;
}

export type DiscoveryStage = 'finding-store' | 'checking-wordpress' | 'checking-wcpos';
export type ConnectStage = DiscoveryStage | 'saving';

export class SiteError extends Error {
  constructor(readonly code: 'invalid_url' | 'unreachable' | 'timeout' | 'rest_restricted' | 'not_wordpress' | 'no_wcpos' | 'wcpos_outdated' | 'bot_challenge', message: string) {
    super(message);
  }
}

// v2: packages/core/src/screens/auth/hooks/use-url-discovery.ts:26 DISCOVERY_PROBE_TIMEOUT_MS.
export const DISCOVERY_TIMEOUT_MS = 10_000;

export function normalizeSiteUrl(input: string): string {
  const trimmed = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new SiteError('invalid_url', 'Enter a valid store URL.');
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new SiteError('invalid_url', 'Use an HTTPS store URL.');
  }
  return url.toString().replace(/\/+$/, '');
}

export async function discoverSite(input: string, fetchImpl: typeof fetch = fetch, onStage?: (stage: DiscoveryStage) => void): Promise<StoreSite> {
  const normalized = normalizeSiteUrl(input);
  onStage?.('finding-store');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(`${normalized}/wp-json/?wcpos=1&_fields=name,url,home,namespaces,authentication`, {
      headers: { 'X-WCPOS': '1' }, signal: controller.signal,
    });
  } catch {
    // v2 copy: auth.site_took_too_long_to_respond, auth.could_not_reach_the_site (use-api-discovery.ts:145).
    throw controller.signal.aborted
      ? new SiteError('timeout', 'The site took too long to respond — check the server and try again')
      : new SiteError('unreachable', "Couldn't reach the site — check the connection and try again");
  } finally {
    clearTimeout(timer);
  }
  // v2: screens/auth/hooks/bot-challenge.ts.
  if (response.headers.get('cf-mitigated')?.trim().toLowerCase() === 'challenge') {
    throw new SiteError('bot_challenge', "This store's hosting setup is blocking the app — the details page names the exact cause and fix.");
  }
  onStage?.('checking-wordpress');
  let index;
  try {
    index = await response.json();
  } catch {
    throw new SiteError('not_wordpress', 'Site does not seem to be a WordPress site');
  }
  // v2: use-api-discovery.ts:164-182 isRestrictedApi, a security plugin blocking the REST API.
  if (response.status === 401 || response.status === 403) {
    throw new SiteError('rest_restricted', typeof index?.message === 'string' && index.message ? index.message
      : 'The WordPress REST API on this site requires authentication. A security plugin may be blocking public access to the REST API.');
  }
  if (!Array.isArray(index?.namespaces)) {
    throw new SiteError('not_wordpress', 'Site does not seem to be a WordPress site');
  }
  onStage?.('checking-wcpos');
  const authUrl = index.authentication?.wcpos?.endpoints?.authorization;
  if (!index.namespaces.includes('wcpos/v2') &&
    index.namespaces.some((namespace: unknown) => typeof namespace === 'string' && namespace.startsWith('wcpos/'))) {
    throw new SiteError('wcpos_outdated', 'Please update your WCPOS plugin');
  }
  if (!index.namespaces.includes('wcpos/v2') || !authUrl) {
    throw new SiteError('no_wcpos', 'The store needs the WCPOS Free plugin 1.10 or later.');
  }
  const home = index.home.replace(/\/+$/, '');
  const wpApiUrl = `${home}/wp-json`;
  return { name: index.name, home, wpApiUrl, wcposApiUrl: `${wpApiUrl}/wcpos/v2`, authUrl };
}
