import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { discoverSite, DISCOVERY_TIMEOUT_MS, normalizeSiteUrl, SiteError } from '../lib/auth/site';
import { memoryStorage } from './memory-storage';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const home = 'https://claudes-mac-mini.tail6a20e3.ts.net:10000';
const index = {
  name: 'TallyUI WooCommerce dev store', url: home, home,
  namespaces: ['oembed/1.0', 'wcpos/v1', 'wcpos/v2', 'wc/v3', 'wp/v2'],
  authentication: { wcpos: { endpoints: { authorization: `${home}/wcpos-auth/` } } },
};

test.each([
  [' shop.example ', 'https://shop.example'],
  ['https://shop.example/', 'https://shop.example'],
  ['http://localhost:8480', 'http://localhost:8480'],
  ['http://127.0.0.1:8480/', 'http://127.0.0.1:8480'],
])('normalizes %s', (input, expected) => {
  expect(normalizeSiteUrl(input)).toBe(expected);
});

test.each(['http://shop.example', '', 'https://bad host'])('rejects invalid URL %s', input => {
  expect(() => normalizeSiteUrl(input)).toThrow(SiteError);
  expect(() => normalizeSiteUrl(input)).toThrow(expect.objectContaining({ code: 'invalid_url' }));
});

test('discovers the real WCPOS index and sends the discovery header', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json(index));
  expect(await discoverSite(home, fetchImpl as unknown as typeof fetch)).toEqual({
    name: index.name, home, wpApiUrl: `${home}/wp-json`,
    wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/`,
  });
  expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
    `${home}/wp-json/?wcpos=1&_fields=name,url,home,namespaces,authentication`,
    { headers: { 'X-WCPOS': '1' }, signal: expect.any(AbortSignal) },
  );
});

test('uses the index home with its trailing slash removed', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json({ ...index, home: `${home}/` }));
  expect((await discoverSite('shop.example', fetchImpl as unknown as typeof fetch)).home).toBe(home);
});

test("maps a network error to unreachable with v2's copy", async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockRejectedValue(new TypeError('offline'));
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
    code: 'unreachable', message: "Couldn't reach the site — check the connection and try again",
  });
});

test("gives up after v2's 10 s with the timeout copy", async () => {
  vi.useFakeTimers();
  // A store that never answers: the fake settles only when its signal aborts, as fetch does.
  const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  let failure: unknown;
  void discoverSite(home, fetchImpl as unknown as typeof fetch).catch((error: unknown) => { failure = error; });
  expect(DISCOVERY_TIMEOUT_MS).toBe(10_000);
  await vi.advanceTimersByTimeAsync(9_999);
  expect(failure).toBeUndefined();
  await vi.advanceTimersByTimeAsync(1);
  expect(failure).toMatchObject({
    code: 'timeout', message: 'The site took too long to respond — check the server and try again',
  });
});

// v2 use-api-discovery.ts:164-182 isRestrictedApi.
test("shows the store's own message for a 403 JSON block", async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(Response.json({ code: 'rest_forbidden', message: 'Blocked by Shield' }, { status: 403 }));
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
    code: 'rest_restricted', message: 'Blocked by Shield',
  });
});

test("shows v2's restricted copy for a 401 JSON without a message", async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(Response.json({ code: 'rest_not_logged_in' }, { status: 401 }));
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
    code: 'rest_restricted',
    message: 'The WordPress REST API on this site requires authentication. A security plugin may be blocking public access to the REST API.',
  });
});

test.each(['challenge', ' Challenge '])('names a Cloudflare challenge (cf-mitigated: %j)', async value => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(new Response('<html>Just a moment...</html>', { status: 403, headers: { 'cf-mitigated': value } }));
  const onStage = vi.fn();
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch, onStage)).rejects.toMatchObject({
    code: 'bot_challenge', message: "This store's hosting setup is blocking the app — the details page names the exact cause and fix.",
  });
  expect(onStage.mock.calls).toEqual([['finding-store']]);
});

test('a 403 without cf-mitigated: challenge stays not_wordpress', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(new Response('<html>Forbidden</html>', { status: 403, headers: { 'cf-mitigated': 'block' } }));
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
    code: 'not_wordpress', message: 'Site does not seem to be a WordPress site',
  });
});

test.each([new Response('<html>Store</html>'), Response.json({ name: 'Store' })])(
  'rejects a response without a WordPress index', async response => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(response);
    await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ code: 'not_wordpress' });
  },
);

test.each([{ ...index, namespaces: ['wp/v2'] }, { ...index, authentication: {} }])(
  'requires WCPOS v2 and its login URL', async body => {
    const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json(body));
    await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
      code: 'no_wcpos', message: expect.stringContaining('WCPOS Free plugin 1.10 or later'),
    });
  },
);

test('reports the discovery stages in order', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json(index));
  const onStage = vi.fn();
  await discoverSite(home, fetchImpl as unknown as typeof fetch, onStage);
  expect(onStage.mock.calls.map(call => call[0])).toEqual(['finding-store', 'checking-wordpress', 'checking-wcpos']);
});

test('stops reporting at the check that fails', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(new Response('<html>Store</html>'));
  const onStage = vi.fn();
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch, onStage)).rejects.toMatchObject({
    code: 'not_wordpress', message: 'Site does not seem to be a WordPress site',
  });
  expect(onStage.mock.calls.map(call => call[0])).toEqual(['finding-store', 'checking-wordpress']);
});

test('reports an older WCPOS API as outdated', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValue(Response.json({ ...index, namespaces: ['wcpos/v1', 'wp/v2'] }));
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({
    code: 'wcpos_outdated', message: 'Please update your WCPOS plugin',
  });
});
