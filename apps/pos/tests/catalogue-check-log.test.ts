import { expect, test, vi } from 'vitest';
import type { Logger } from '@tallyui/pos';
import { logCatalogueChecks } from '../lib/logs/catalogue-check-log';
import { syncLogger, TALLYUI_LOGGERS } from '../lib/logs/log-store';
import { matchesLogFilter } from '../lib/logs/log-view';

test("writes a row for records fetched again, with v2's copy and the count", () => {
  const logger = { info: vi.fn() } as unknown as Logger;
  logCatalogueChecks('products', logger)({ type: 'refetched', count: 3, keys: ['a', 'b', 'c'] });
  expect(logger.info).toHaveBeenCalledTimes(1);
  expect(logger.info).toHaveBeenCalledWith(
    'Fetched records again for missing details · 3', { collection: 'products', count: 3 },
  );
});

test("writes a row for items deleted in the store, with v2's copy and the count", () => {
  const logger = { info: vi.fn() } as unknown as Logger;
  logCatalogueChecks('coupons', logger)({ type: 'tombstoned', count: 2, keys: ['x', 'y'] });
  expect(logger.info).toHaveBeenCalledTimes(1);
  expect(logger.info).toHaveBeenCalledWith(
    'Removed items deleted in your store · 2', { collection: 'coupons', count: 2 },
  );
});

test('writes nothing for a zero count or for other events', () => {
  const logger = { info: vi.fn() } as unknown as Logger;
  const log = logCatalogueChecks('products', logger);
  log({ type: 'refetched', count: 0, keys: [] });
  log({ type: 'tombstoned', count: 0, keys: [] });
  log({ type: 'pass-started', resumed: false });
  log({ type: 'duplicate', count: 4, keys: [], code: 'duplicate_match_key' });
  expect(logger.info).not.toHaveBeenCalled();
});

test('the Sync filter finds the catalogue-check rows', () => {
  expect(matchesLogFilter({
    id: 'x', timestamp: 0, level: 'info', scope: 'sync', message: 'Removed items deleted in your store · 2',
  }, 'sync')).toBe(true);
});

test('the log store listens to the sync logger', () => {
  expect(TALLYUI_LOGGERS).toContain(syncLogger);
});
