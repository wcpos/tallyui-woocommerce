import { expect, test } from 'vitest';
import { newRxError } from 'rxdb';
import { StorageUnavailableError, StorageWorkerStartError } from '@tallyui/storage-sqlite/web';
import { storageStartMessage } from '../lib/storage-start-failure';

test.each([
  [
    'unavailable storage',
    new StorageUnavailableError('OPFS is unavailable'),
    "This browser window can't keep the till's data, as in a private window. Open the app in a normal window.",
  ],
  [
    'storage held by another tab',
    new StorageWorkerStartError('StorageWorkerStartError: another tab holds the database'),
    'The till is open in another tab. Close it, then reload this page.',
  ],
  [
    'a remote version mismatch',
    newRxError('RM1', {}),
    'The app was updated while this page was open. Reload this page.',
  ],
  [
    'a worker start failure',
    new StorageWorkerStartError('Worker startup failed'),
    "Local storage didn't start. Reload this page.",
  ],
])('maps %s to its storage startup message', (_name, error, message) => {
  expect(storageStartMessage(error)).toBe(message);
});

test('leaves an ordinary error to the existing error handling', () => {
  expect(storageStartMessage(new Error('Request failed'))).toBeUndefined();
});
