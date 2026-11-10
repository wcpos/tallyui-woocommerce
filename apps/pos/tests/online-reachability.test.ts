import { expect, test, vi } from 'vitest';
import { checkWebsiteReachability, pingProbeUrl } from '../lib/online/reachability';

test.each([
  ['https://shop.example/wp-json', 'https://shop.example/wp-json/wcpos/v2/ping?wcpos=1'],
  ['https://shop.example/wp-json/', 'https://shop.example/wp-json/wcpos/v2/ping?wcpos=1'],
  ['https://shop.example/?rest_route=/', 'https://shop.example/?rest_route=/wcpos/v2/ping&wcpos=1'],
])('builds the marked ping URL from %s', (root, expected) => {
  expect(pingProbeUrl(root)).toBe(expected);
});

test.each([[200, true], [404, true], [500, false], [502, false]] as const)(
  'reads HTTP %i as reachable: %s', async (status, expected) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({ status } as Response);
    await expect(checkWebsiteReachability('https://shop.example/wp-json', fetchImpl as unknown as typeof fetch)).resolves.toBe(expected);
  },
);

test('falls back to GET when HEAD throws', async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ status: 200 } as Response);
  await expect(checkWebsiteReachability('https://shop.example/wp-json', fetchImpl as unknown as typeof fetch)).resolves.toBe(true);
  expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
    ['https://shop.example/wp-json/wcpos/v2/ping?wcpos=1', 'HEAD'],
    ['https://shop.example/wp-json/wcpos/v2/ping?wcpos=1', 'GET'],
  ]);
  expect(fetchImpl.mock.calls[0][1]).toEqual(expect.objectContaining({
    mode: 'cors', cache: 'no-store', signal: expect.any(AbortSignal),
  }));
});

test('gives up on a probe that has not answered in 10 seconds', async () => {
  vi.useFakeTimers();
  try {
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    }));
    const result = checkWebsiteReachability('https://shop.example/wp-json', fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
