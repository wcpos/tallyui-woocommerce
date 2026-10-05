export interface StoreSite {
  name: string;
  home: string;
  wpApiUrl: string;
  wcposApiUrl: string;
  authUrl: string;
}

export class SiteError extends Error {
  constructor(readonly code: 'invalid_url' | 'unreachable' | 'not_wordpress' | 'no_wcpos', message: string) {
    super(message);
  }
}

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

export async function discoverSite(input: string, fetchImpl: typeof fetch = fetch): Promise<StoreSite> {
  const normalized = normalizeSiteUrl(input);
  let response: Response;
  try {
    response = await fetchImpl(`${normalized}/wp-json/?wcpos=1&_fields=name,url,home,namespaces,authentication`, {
      headers: { 'X-WCPOS': '1' },
    });
  } catch {
    throw new SiteError('unreachable', 'Could not reach the store.');
  }
  let index;
  try {
    index = await response.json();
  } catch {
    throw new SiteError('not_wordpress', 'The store did not return a WordPress REST index.');
  }
  if (!Array.isArray(index?.namespaces)) {
    throw new SiteError('not_wordpress', 'The store did not return a WordPress REST index.');
  }
  const authUrl = index.authentication?.wcpos?.endpoints?.authorization;
  if (!index.namespaces.includes('wcpos/v2') || !authUrl) {
    throw new SiteError('no_wcpos', 'The store needs the WCPOS Free plugin 1.10 or later.');
  }
  const home = index.home.replace(/\/+$/, '');
  const wpApiUrl = `${home}/wp-json`;
  return { name: index.name, home, wpApiUrl, wcposApiUrl: `${wpApiUrl}/wcpos/v2`, authUrl };
}
