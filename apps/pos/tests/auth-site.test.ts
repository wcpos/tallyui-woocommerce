import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { discoverSite, normalizeSiteUrl, SiteError } from '../lib/auth/site';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
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
    { headers: { 'X-WCPOS': '1' } },
  );
});

test('uses the index home with its trailing slash removed', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockResolvedValue(Response.json({ ...index, home: `${home}/` }));
  expect((await discoverSite('shop.example', fetchImpl as unknown as typeof fetch)).home).toBe(home);
});

test('maps a network error to unreachable', async () => {
  const fetchImpl = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>().mockRejectedValue(new TypeError('offline'));
  await expect(discoverSite(home, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ code: 'unreachable' });
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
