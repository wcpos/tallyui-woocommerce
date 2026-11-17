import { removeRxDatabase, type RxStorage } from 'rxdb';
import { appStorage } from './app-storage';
import { loadCashiers, loadSession, type Session } from './auth/session';
import { databaseName } from './catalogue/start-catalogue';
import type { LocalDataCheck } from './local-data-check';
import { ordersDatabaseName } from './sale/order-store';

/** The pre-hydration flag (v2 scheduleLocalDataReset), read by LocalDataResetGate on the next load. */
export const LOCAL_DATA_RESET_KEY = 'tallywoo.clear_local_data';
/** Every key this app keeps in web storage starts with this. */
export const APP_KEY_PREFIX = 'tallywoo.';

export function describeResetConfirm({ unsent, localOnly, unchecked }: LocalDataCheck): string {
  const parts: string[] = [];
  if (unsent === 1) parts.push('1 change on this device has never reached your server and will be permanently lost. It may be a completed sale that exists only on this device.');
  else if (unsent > 1) parts.push(`${unsent} changes on this device have never reached your server and will be permanently lost. They may include completed sales that exist only on this device.`);
  else if (unchecked.length === 0) parts.push('Nothing is waiting to be sent, so your server already has your sales.');
  if (unchecked.length > 0) parts.push(`The app could not check ${unchecked.join(', ')} for changes waiting to be sent, so this may include completed sales that never reached your server. They cannot be recovered.`);
  if (localOnly > 0) parts.push(`Till sessions, cash counts and closures on this device are not stored on your server and will be deleted (${localOnly === 1 ? '1 record' : `${localOnly} records`}).`);
  parts.push('Products, customers and orders are downloaded again from your server.');
  return parts.join(' ');
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

/** The active session, then every stored cashier; a roster that is not a plain object counts as empty. */
export function localSessions(storage?: Storage): Session[] {
  const active = loadSession(storage);
  const roster = loadCashiers(storage);
  const lists = roster && typeof roster === 'object' && !Array.isArray(roster) ? Object.values(roster) : [];
  return [...(active ? [active] : []), ...lists.filter(list => Array.isArray(list)).flat()];
}

export function localDatabaseNames(storage?: Storage): string[] {
  return [...new Set(localSessions(storage).flatMap(session => {
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
  // First, so nothing below can leave the gate reloading with the flag still set.
  try { local.removeItem(LOCAL_DATA_RESET_KEY); } catch {}
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
