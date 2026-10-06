import { isRxdbRemoteVersionMismatch } from '@tallyui/core';
import { isStorageHeldError, isStorageUnavailableError, isStorageWorkerStartError } from '@tallyui/storage-sqlite/web';

export function storageStartMessage(error: unknown): string | undefined {
  if (isStorageUnavailableError(error)) {
    return "This browser window can't keep the till's data, as in a private window. Open the app in a normal window.";
  }
  if (isStorageHeldError(error)) {
    return 'The till is open in another tab. Close it, then reload this page.';
  }
  if (isRxdbRemoteVersionMismatch(error)) {
    return 'The app was updated while this page was open. Reload this page.';
  }
  if (isStorageWorkerStartError(error)) {
    return "Local storage didn't start. Reload this page.";
  }
  return undefined;
}
