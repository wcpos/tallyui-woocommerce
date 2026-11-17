import { createRxDatabase, type RxDatabase, type RxStorage } from 'rxdb';
import { addPosOrderCollection, addRegisterSessionCollection, cashMovementSchema, closureSchema, replacedOrderIds, tenderVoidCollection } from '@tallyui/pos';
import { appStorage } from './app-storage';
import { localSessions } from './local-data-reset';
import { ordersDatabaseName } from './sale/order-store';

/** What Clear All Local Data would lose, across every orders database the reset deletes. */
export type LocalDataCheck = { unsent: number; localOnly: number; unchecked: string[] };
export type OpenedOrders = { db: RxDatabase; close(): Promise<void> };

/** The collections openOrderStore adds, without ensureRegister or the tender-void guard: the check never writes. */
export async function openOrdersForCheck(name: string, storage: RxStorage<any, any> = appStorage()): Promise<OpenedOrders> {
  const db = await createRxDatabase({ name, storage, multiInstance: false });
  try {
    await addPosOrderCollection(db);
    await addRegisterSessionCollection(db);
    await db.addCollections({ cash_movements: { schema: cashMovementSchema }, closures: { schema: closureSchema }, tender_voids: tenderVoidCollection() });
  } catch (error) {
    await db.close();
    throw error;
  }
  return { db, async close() { await db.close(); } };
}

async function countDatabase(db: RxDatabase): Promise<{ unsent: number; localOnly: number }> {
  const { pos_orders: orders, register_sessions: sessions, cash_movements: movements, closures } = db.collections;
  // The outbox's own rule: pending, plus rejected orders no later sale replaced.
  const pending = await orders.find({ selector: { syncStatus: 'pending' } }).exec();
  const refused = await orders.find({ selector: { syncStatus: 'rejected' } }).exec();
  const successors = refused.length ? await orders.find({ selector: { saleId: { $in: refused.map(order => order.id) } } }).exec() : [];
  const replaced = replacedOrderIds([...refused, ...successors]);
  // ensureRegister keeps the register in a local document, so a register_sessions row exists only once opened (opened_at_gmt).
  const opened = (await sessions.find().exec()).filter(session => Boolean(session.opened_at_gmt)).length;
  const localOnly = opened + (await movements.find().exec()).length + (await closures.find().exec()).length;
  return { unsent: pending.length + refused.filter(order => !replaced.has(order.id)).length, localOnly };
}

export async function checkLocalData({ active, storage = globalThis.localStorage, open = name => openOrdersForCheck(name) }: {
  active: RxDatabase | null; storage?: Storage; open?: (name: string) => Promise<OpenedOrders>;
}): Promise<LocalDataCheck> {
  const targets = new Map<string, string>();
  for (const session of localSessions(storage)) {
    try {
      const name = ordersDatabaseName(session);
      const store = session.site?.name || session.site?.home || 'a store';
      const cashier = session.tokens?.user?.displayName;
      if (!targets.has(name)) targets.set(name, cashier ? `${store} · ${cashier}` : store);
    } catch {}
  }
  const result: LocalDataCheck = { unsent: 0, localOnly: 0, unchecked: [] };
  for (const [name, label] of targets) {
    let opened: OpenedOrders | null = null;
    try {
      if (active?.name !== name) opened = await open(name);
      const counts = await countDatabase(opened?.db ?? active!);
      result.unsent += counts.unsent;
      result.localOnly += counts.localOnly;
    } catch {
      result.unchecked.push(label);
    } finally {
      await opened?.close().catch(() => {});
    }
  }
  return result;
}
