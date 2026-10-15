import { expect, test } from 'vitest';
import { createRxDatabase, type RxJsonSchema } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { PosOrder } from '@tallyui/pos';
import type { Session } from '../lib/auth/session';
import { databaseName } from '../lib/catalogue/start-catalogue';
import { openOrderStore, ordersDatabaseName } from '../lib/sale/order-store';
import schemaV9 from './fixtures/pos-orders-schema-v9.json';

const session: Session = {
  site: { name: 'Store', home: 'hello', wpApiUrl: '', wcposApiUrl: '', authUrl: '' },
  tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
    user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
};

test('order database names reuse the stable FNV-1a hash with a separate prefix', () => {
  const name = ordersDatabaseName(session);
  expect(name).toBe('tallywoo_orders_4f9f2cab_2');
  expect(name).toBe(ordersDatabaseName(session));
  expect(name).toMatch(/^[a-z][_$a-z0-9-]*$/);
  expect(name).not.toBe(databaseName(session));
  expect(ordersDatabaseName({ ...session, site: { ...session.site, home: 'https://shop.example' } })).not.toBe(name);
  expect(ordersDatabaseName({ ...session, tokens: { ...session.tokens, user: { ...session.tokens.user, id: 3 } } })).not.toBe(name);
});

test('opens pos_orders and register collections in its own memory database and closes it', async () => {
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const store = await openOrderStore(name, getRxStorageMemory());
  const db = store.orders.database;
  try {
    expect(db.name).toBe(name);
    expect(Object.keys(db.collections)).toEqual(['pos_orders', 'register_sessions', 'cash_movements', 'closures', 'tender_voids']);
    expect(store.orders.name).toBe('pos_orders');
    expect(await store.orders.find().exec()).toEqual([]);
    expect(db.closed).toBe(false);
  } finally {
    await store.close();
  }
  expect(db.closed).toBe(true);
});

test('opens pos_orders at schema version 10 (one-way from TallyUI 3.12.0)', async () => {
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const store = await openOrderStore(name, getRxStorageMemory());
  try {
    expect(store.orders.schema.version).toBe(10);
  } finally {
    await store.close();
  }
});

test("keeps a till's version-9 orders byte for byte when the store opens at version 10", async () => {
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const storage = getRxStorageMemory();
  const syncedLineId = crypto.randomUUID();
  const pending: PosOrder = {
    id: crypto.randomUUID(), saleId: crypto.randomUUID(), commandId: crypto.randomUUID(),
    createdAt: '2026-10-14T09:30:00.000Z', updatedAt: '2026-10-14T09:30:00.000Z',
    currency: 'EUR', pricesIncludeTax: false, syncStatus: 'pending',
    registerId: 'web', sessionId: crypto.randomUUID(), cashierRef: '2',
    taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false },
    lines: [
      {
        id: crypto.randomUUID(), productId: '101', variantId: '102',
        name: 'Cotton shirt', sku: 'SHIRT-BLUE-M', quantity: 2,
        attributes: { Colour: 'Blue', Size: 'M' }, taxStatus: 'taxable',
        unitPriceMinor: 2000, discountMinor: 0, netMinor: 4000, netMicros: '40000000',
        taxLines: [{ code: 'VAT', ratePpm: 200000, taxMicros: '8000000' }],
      },
      {
        id: crypto.randomUUID(), productId: '103', name: 'Canvas tote', sku: 'TOTE', quantity: 1,
        taxStatus: 'taxable', unitPriceMinor: 1000, discountMinor: 0, netMinor: 1000,
        taxLines: [{ code: 'VAT', ratePpm: 200000, taxMicros: '2000000' }],
      },
    ],
    subtotalMinor: 5000, discountMinor: 0, taxMinor: 1000, totalMinor: 6000,
    payments: [{ id: crypto.randomUUID(), method: 'cash', amountMinor: 6000,
      tenderedMinor: 7000, changeMinor: 1000 }],
    customer: null, note: 'Paid while offline',
  };
  const synced: PosOrder = {
    id: crypto.randomUUID(), saleId: crypto.randomUUID(), commandId: crypto.randomUUID(),
    createdAt: '2026-10-14T09:00:00.000Z', updatedAt: '2026-10-14T09:00:02.000Z',
    currency: 'EUR', pricesIncludeTax: false, syncStatus: 'applied',
    registerId: 'web', sessionId: crypto.randomUUID(), cashierRef: '2', sentVersion: 6,
    serverRefs: { orderId: '5042', displayId: 'WC-5042', totalMinor: 2400 },
    taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false },
    lines: [{
      id: syncedLineId, productId: '104', name: 'Wool scarf', sku: 'SCARF', quantity: 1,
      taxStatus: 'taxable', unitPriceMinor: 2500, regularUnitPriceMinor: 3000,
      discountMinor: 500, netMinor: 2000, netMicros: '20000000',
      taxLines: [{ code: 'VAT', ratePpm: 200000, taxMicros: '4000000' }],
    }],
    coupons: [{ code: 'SAVE5', couponId: '301', discountMinor: 500, discountTaxMinor: 100 }],
    subtotalMinor: 2500, discountMinor: 500, taxMinor: 400, totalMinor: 2400,
    payments: [{ id: crypto.randomUUID(), method: 'external', amountMinor: 2400,
      reference: 'CARD-5042' }],
    customer: { id: '42', name: 'Alex Morgan', email: 'alex@example.com' },
    display: {
      currency: 'EUR', exponent: 2, taxInclusive: false,
      subtotalMinor: 2500, discountMinor: 500, taxMinor: 400, totalMinor: 2400,
      orderDiscountMinor: 0, coupons: [{ code: 'SAVE5', amountMinor: 500 }],
      lines: [{ lineId: syncedLineId, amountMinor: 2500, discounts: [] }],
    },
  };

  const db = await createRxDatabase({ name, storage, multiInstance: false });
  let before;
  try {
    const { pos_orders: orders } = await db.addCollections({
      pos_orders: { schema: schemaV9 as RxJsonSchema<PosOrder> },
    });
    await orders.insert(pending);
    await orders.insert(synced);
    before = (await orders.find({ sort: [{ id: 'asc' }] }).exec()).map(order => order.toJSON());
  } finally {
    await db.close();
  }

  const store = await openOrderStore(name, storage);
  try {
    expect(store.orders.schema.version).toBe(10);
    const after = (await store.orders.find({ sort: [{ id: 'asc' }] }).exec()).map(order => order.toJSON());
    expect(after).toEqual(before);
    expect(after.find(order => order.id === pending.id)?.syncStatus).toBe(pending.syncStatus);
  } finally {
    await store.close();
  }
});
