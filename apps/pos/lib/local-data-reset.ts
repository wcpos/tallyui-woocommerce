import { removeRxDatabase, type RxStorage } from 'rxdb';
import { appStorage } from './app-storage';
import { loadCashiers, loadSession } from './auth/session';
import { databaseName } from './catalogue/start-catalogue';
import { ordersDatabaseName } from './sale/order-store';

/** The pre-hydration flag (v2 scheduleLocalDataReset), read by LocalDataResetGate on the next load. */
export const LOCAL_DATA_RESET_KEY = 'tallywoo.clear_local_data';
/** Every key this app keeps in web storage starts with this. */
export const APP_KEY_PREFIX = 'tallywoo.';
export type UnsentChanges = { status: 'none' } | { status: 'unknown' } | { status: 'unsent'; count: number };

export function describeResetConfirm(unsent: UnsentChanges): string {
  const warning = unsent.status === 'none'
    ? 'Nothing is waiting to be sent, so your server already has your sales.'
    : unsent.status === 'unknown'
      ? 'The app could not check for changes waiting to be sent, so this may include completed sales that never reached your server. They cannot be recovered.'
      : unsent.count === 1
        ? '1 change on this device has never reached your server and will be permanently lost. It may be a completed sale that exists only on this device.'
        : `${unsent.count} changes on this device have never reached your server and will be permanently lost. They may include completed sales that exist only on this device.`;
  return `${warning} Everything stored on this device is deleted and downloaded again from your server.`;
}

export function scheduleLocalDataReset(storage?: Storage): boolean {
  try {
    (storage ?? globalThis.localStorage).setItem(LOCAL_DATA_RESET_KEY, '1');
    return true;
  } catch { return false; }
}

export function isLocalDataResetScheduled(storage?: Storage): boolean {
  try {
    return (storage ?? globalThis.localStorage).getItem(LOCAL_DATA_RESET_KEY) === '1';
  } catch { return false; }
}

export function localDatabaseNames(storage?: Storage): string[] {
  const active = loadSession(storage);
  const sessions = [...(active ? [active] : []), ...Object.values(loadCashiers(storage)).flat()];
  return [...new Set(sessions.flatMap(session => {
    try {
      return [databaseName(session), ordersDatabaseName(session)];
    } catch {
      return [];
    }
  }))];
}

export async function runLocalDataReset({
  local = globalThis.localStorage, session = globalThis.sessionStorage, storage = appStorage, remove = removeRxDatabase,
}: {
  local?: Storage; session?: Storage; storage?: () => RxStorage<any, any>; remove?: typeof removeRxDatabase;
} = {}): Promise<void> {
  const names = localDatabaseNames(local);
  for (const name of names) {
    try {
      await remove(name, storage(), false);
    } catch (error) {
      console.warn('Clear local data: could not remove', name, error);
    }
  }
  for (const webStorage of [local, session]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < webStorage.length; i++) {
        const key = webStorage.key(i);
        if (key?.startsWith(APP_KEY_PREFIX)) keys.push(key);
      }
      for (const key of keys) webStorage.removeItem(key);
    } catch {}
  }
}
