import { expect, test } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import { createOrderBuilder } from '@tallyui/pos';
import type { SaleDiscountState } from '@tallyui/pos';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { saleDiscountCodes } from '../lib/sale/discount-codes';
import { openOrderStore } from '../lib/sale/order-store';

test.each([
  { name: 'finds a synced coupon by code', code: 'save10', expected: {
    found: expect.objectContaining({ code: 'save10', discount_type: 'percent', amount: '10' }),
  } },
  { name: 'refuses an unknown code', code: 'nope', expected: { refusal: 'Coupon nope does not exist' } },
])('$name', async ({ code, expected }) => {
  const db = await createTallyDatabase({
    connector: createWooCommerceConnector(), name: `discount_codes_${crypto.randomUUID()}`, storage: getRxStorageMemory(),
  });
  try {
    await db.coupons.insert({
      uuid: 'c-7', id: 7, code: 'save10', status: 'publish', discount_type: 'percent', amount: '10', usage_count: 0, used_by: [],
    });
    const store = await openOrderStore(`discount_orders_${crypto.randomUUID()}`,
      wrappedValidateAjvStorage({ storage: getRxStorageMemory() }));
    try {
      const state: SaleDiscountState<any> = {
        order: createOrderBuilder({
          currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false },
        }).getSnapshot(),
        accepted: new Map(), categories: new Map(), settings: {},
      };
      const codes = saleDiscountCodes({ coupons: db.coupons, products: db.products, orders: store.orders });
      await expect(codes.find(code, state)).resolves.toEqual(expected);
    } finally {
      await store.close();
    }
  } finally {
    await db.close();
  }
});
