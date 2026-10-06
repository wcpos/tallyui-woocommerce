import { createRxDatabase } from 'rxdb';
import type { RxCollection, RxStorage } from 'rxdb';
import { addPosOrderCollection } from '@tallyui/pos';
import type { PosOrder } from '@tallyui/pos';
import { appStorage } from '../app-storage';
import type { Session } from '../auth/session';
import { databaseName } from '../catalogue/start-catalogue';

export function ordersDatabaseName(session: Session): string {
  return databaseName(session).replace('tallywoo_', 'tallywoo_orders_');
}

export async function openOrderStore(
  name: string, storage?: RxStorage<any, any>,
): Promise<{ orders: RxCollection<PosOrder>; close(): Promise<void> }> {
  const db = await createRxDatabase({ name, storage: storage ?? appStorage(), multiInstance: false });
  const orders = await addPosOrderCollection(db);
  return { orders, async close() { await db.close(); } };
}
