import { createElement } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import type { RxJsonSchema } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StoreSettings } from '@tallyui/core';
import { catalogueEntries, createOrderBuilder, saleTaxContexts, TaxProvider, useSale } from '@tallyui/pos';
import { parkCart, parkedCartSchema, parkedCartMigrationStrategies, restoreCart } from '../lib/sale/parked-carts';
import type { ParkedCart } from '../lib/sale/parked-carts';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const traits = createWooCommerceConnector().traits.product;
const lineDiscount = { type: 'fixed' as const, value: 50, label: 'Staff', couponCode: 'STAFF' };
const orderDiscount = { type: 'percentage' as const, value: 10, label: 'Ten percent' };
const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
const billing = { firstName: 'Gee', lastName: 'Four', company: 'G4', address1: '1 High St', address2: 'Flat 2', city: 'London',
  state: '', postcode: 'N1 1AA', country: 'GB', phone: '020 7946 0000', email: 'gee@example.invalid' };
const shipping = { address1: '9 Dock Rd', city: 'Portland', state: 'OR', postcode: '97201', country: 'US' };

addRxPlugin(RxDBMigrationSchemaPlugin);

afterEach(cleanup);

function orderFixture(withOrderDiscount = false) {
  const builder = createOrderBuilder({
    currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false },
  });
  const espresso = builder.addLine({
    productId: '80', variantId: '80', name: 'Espresso', quantity: 2, unitPrice: { amount: 300, currency: 'USD' },
  });
  builder.addLine({
    productId: '84', variantId: '84', name: 'Cold Brew', quantity: 1, unitPrice: { amount: 400, currency: 'USD' },
  });
  builder.applyLineDiscount(espresso, lineDiscount);
  if (withOrderDiscount) builder.applyOrderDiscount(orderDiscount);
  return builder.getSnapshot();
}

function restore(parked: ParkedCart, catalogue = products, orderCreate = 2, customer?: ParkedCart['customer'], taxContextFor?: ReturnType<typeof saleTaxContexts>) {
  const { result } = renderHook(() => useSale({ currency: 'USD' }, {
    registerId: 'web', cashierRef: '2', capabilities: { orderCreate }, taxContextFor,
  }), {
    wrapper: ({ children }: { children: ReactNode }) => createElement(TaxProvider, {
      ratesPpm: {}, pricesIncludeTax: false, children,
    }),
  });
  if (customer) act(() => result.current.setCustomer(customer));
  const steps = restoreCart(result.current, parked, catalogue, traits, 'USD');
  let done = false;
  let problems: string[] = [];
  while (!done) {
    act(() => {
      const step = steps.next(result.current);
      if (step.done) { done = true; problems = step.value; }
    });
  }
  return { order: result.current.order, problems, taxLocation: result.current.taxLocation };
}

test('parkCart keeps openedAt as parkedAt; without it parkedAt is now', () => {
  const now = new Date('2026-11-18T10:30:00.000Z');
  expect(parkCart(orderFixture(), now, '2026-11-18T09:00:00.000Z').parkedAt).toBe('2026-11-18T09:00:00.000Z');
  expect(parkCart(orderFixture(), now).parkedAt).toBe(now.toISOString());
});

test('parks a real order with quantities, totals and only Discount fields', () => {
  const order = orderFixture();
  const now = new Date('2026-10-06T10:30:00.000Z');
  const parked = parkCart(order, now);
  expect(parked.id).toMatch(/^[\da-f-]{36}$/);
  expect(parkCart(order).id).not.toBe(parked.id);
  expect(parked.parkedAt).toBe(now.toISOString());
  expect(parked.itemCount).toBe(3);
  expect(parked.totalMinor).toBe(order.totalMinor);
  expect(parked.totalMinor).toBe(950);
  expect(parked.lines).toEqual([
    { productId: '80', variantId: '80', name: 'Espresso', quantity: 2, discounts: [lineDiscount] },
    { productId: '84', variantId: '84', name: 'Cold Brew', quantity: 1, discounts: [] },
  ]);
  expect(parked.orderDiscounts).toEqual([]);
  expect(parkCart(orderFixture(true)).orderDiscounts).toEqual([orderDiscount]);
});

test('parks the customer summary and omits the customer key for guests', () => {
  const order = orderFixture();
  expect(parkCart({ ...order, customer: gee }).customer).toEqual(gee);
  expect(parkCart({ ...order, customer: { id: '7', name: 'Gee Four', email: '' } }).customer)
    .toEqual({ id: '7', name: 'Gee Four' });
  expect(parkCart(order)).not.toHaveProperty('customer');
});

test("parkCart keeps the customer's billing and shipping whole, and neither key without them", () => {
  expect(parkCart({ ...orderFixture(), customer: { ...gee, billing, shipping } }).customer).toEqual({ ...gee, billing, shipping });
  expect(parkCart({ ...orderFixture(), customer: { ...gee, billing: { country: 'GB', city: undefined } } }).customer!.billing).toStrictEqual({ country: 'GB' });
  expect(Object.keys(parkCart({ ...orderFixture(), customer: gee }).customer!)).toEqual(['id', 'name', 'email']);
});

test.each([undefined, gee, { ...gee, billing, shipping }])('the v4 schema stores a real parked cart with optional customer %j, variants and discount fields', async customer => {
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    expect(parkedCartSchema.version).toBe(4);
    const { parked_carts } = await db.addCollections({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const builder = createOrderBuilder({
      currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false },
    });
    const espresso = builder.addLine({
      productId: '80', variantId: '80', name: 'Espresso', quantity: 2, unitPrice: { amount: 300, currency: 'USD' },
    });
    const coldBrew = builder.addLine({
      productId: '84', name: 'Cold Brew', quantity: 1, unitPrice: { amount: 400, currency: 'USD' },
    });
    builder.applyLineDiscount(espresso, { type: 'fixed', value: 50 });
    builder.applyLineDiscount(coldBrew, lineDiscount);
    builder.applyOrderDiscount({ type: 'percentage', value: 10 });
    const parked = { ...parkCart(builder.getSnapshot()), ...(customer ? { customer } : {}) };
    expect(parked.lines[0].variantId).toBe('80');
    expect(parked.lines[1].variantId).toBeUndefined();
    expect(parked.lines[0].discounts).toEqual([{ type: 'fixed', value: 50 }]);
    expect(parked.orderDiscounts).toEqual([{ type: 'percentage', value: 10 }]);
    await parked_carts.insert(parked);
    expect((await parked_carts.findOne(parked.id).exec())!.toJSON()).toEqual(parked);
  } finally {
    await db.remove();
  }
});

test("parkCart keeps the order's coupon codes in order", () => {
  const order = orderFixture();
  const coupons = [
    { code: 'a', couponId: '1', discountMinor: 50, discountTaxMinor: 0 },
    { code: 'b', couponId: '2', discountMinor: 20, discountTaxMinor: 0 },
  ];
  expect(parkCart({ ...order, coupons }).coupons).toEqual(['a', 'b']);
  expect(parkCart({ ...order, coupons: [] })).not.toHaveProperty('coupons');
  expect(parkCart(order)).not.toHaveProperty('coupons');
});

test('a v2 parked cart migrates to v3 unchanged', async () => {
  const v2Properties: Record<string, unknown> = { ...parkedCartSchema.properties };
  delete v2Properties.coupons;
  const v2Schema = { ...parkedCartSchema, version: 2, properties: v2Properties } as RxJsonSchema<ParkedCart>;
  const storage = wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
  const options = { name: 'parked_coupons_migration', multiInstance: false, storage };
  const parked = parkCart(orderFixture(true));
  const oldDb = await createRxDatabase(options);
  try {
    const { parked_carts } = await oldDb.addCollections({
      parked_carts: { schema: v2Schema, migrationStrategies: { 1: (doc: any) => doc, 2: (doc: any) => doc } },
    });
    await parked_carts.insert(parked);
  } finally {
    await oldDb.close();
  }
  const db = await createRxDatabase(options);
  try {
    const { parked_carts } = await db.addCollections({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const carts = await parked_carts.find().exec();
    expect(carts).toHaveLength(1);
    expect(carts[0].toJSON()).toEqual(parked);
    expect(carts[0].toJSON()).not.toHaveProperty('coupons');
  } finally {
    await db.remove();
  }
});

test('a v3 parked cart with a customer and no addresses migrates to v4 unchanged and resumes taxed on the base', async () => {
  const v3Customer = { ...parkedCartSchema.properties.customer, properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } } };
  const v3Schema = { ...parkedCartSchema, version: 3, properties: { ...parkedCartSchema.properties, customer: v3Customer } } as RxJsonSchema<ParkedCart>;
  const storage = wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
  const options = { name: 'parked_addresses_migration', multiInstance: false, storage };
  const parked = { ...parkCart(orderFixture()), customer: gee };
  const oldDb = await createRxDatabase(options);
  const old = await oldDb.addCollections({
    parked_carts: { schema: v3Schema, migrationStrategies: { 1: (doc: any) => doc, 2: (doc: any) => doc, 3: (doc: any) => doc } },
  });
  await old.parked_carts.insert(parked);
  await oldDb.close();
  const db = await createRxDatabase(options);
  try {
    const { parked_carts } = await db.addCollections({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const carts = await parked_carts.find().exec();
    expect(carts).toHaveLength(1);
    expect(carts[0].toJSON()).toEqual(parked);
    // The shop is in California (10%). finalize stores a taxAddress only for a billing or shipping tax location.
    const settings = { ...noTaxSettings, taxBasedOn: 'billing', baseTaxAddress: { country: 'US', state: 'CA', city: '', postcode: '' },
      taxRateTable: [{ id: 1, country: 'US', state: 'CA', postcode: '', city: '', postcodes: [], cities: [], rate: '10.0000',
        name: 'CA Tax', class: 'standard', priority: 1, compound: false, shipping: true, order: 0 }] } as StoreSettings;
    const { order, problems, taxLocation } = restore(carts[0].toJSON(), products, 8, undefined, saleTaxContexts(settings, { orderCreateVersion: 8 }));
    expect(problems).toEqual([]);
    expect(order.customer).toEqual(gee);
    expect(taxLocation).toMatchObject({ addressUsed: 'base', location: { country: 'US', state: 'CA' } });
    expect(order.totalMinor).toBe(1045); // 6.00 - 0.50 + 4.00 = 9.50, plus CA Tax 10% (0.95)
  } finally {
    await db.remove();
  }
});

test('migrates a v0 cart unchanged, without a customer, after reopening the database', async () => {
  const v0Schema: RxJsonSchema<Omit<ParkedCart, 'customer' | 'fees' | 'shipping' | 'coupons'>> = {
    version: 0, primaryKey: 'id', type: 'object',
    properties: {
      id: { type: 'string', maxLength: 64 },
      parkedAt: { type: 'string', maxLength: 32 },
      lines: { type: 'array', items: {
        type: 'object', properties: {
          productId: { type: 'string' }, variantId: { type: 'string' },
          quantity: { type: 'number' }, name: { type: 'string' },
          discounts: { type: 'array', items: {
            type: 'object', properties: {
              type: { type: 'string', enum: ['percentage', 'fixed'] }, value: { type: 'number' },
              label: { type: 'string' }, couponCode: { type: 'string' },
            }, required: ['type', 'value'],
          } },
        }, required: ['productId', 'quantity', 'name', 'discounts'],
      } },
      orderDiscounts: { type: 'array', items: {
        type: 'object', properties: {
          type: { type: 'string', enum: ['percentage', 'fixed'] }, value: { type: 'number' },
          label: { type: 'string' }, couponCode: { type: 'string' },
        }, required: ['type', 'value'],
      } },
      itemCount: { type: 'integer' }, totalMinor: { type: 'integer' },
    },
    required: ['id', 'parkedAt', 'lines', 'orderDiscounts', 'itemCount', 'totalMinor'],
    indexes: ['parkedAt'],
  };
  const storage = wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
  const options = { name: 'parked_customer_migration', multiInstance: false, storage };
  const parked = parkCart(orderFixture(true));
  const oldDb = await createRxDatabase(options);
  try {
    const { parked_carts } = await oldDb.addCollections({ parked_carts: { schema: v0Schema } });
    await parked_carts.insert(parked);
  } finally {
    await oldDb.close();
  }
  const db = await createRxDatabase(options);
  try {
    const { parked_carts } = await db.addCollections({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const carts = await parked_carts.find().exec();
    expect(carts).toHaveLength(1);
    expect(carts[0].toJSON()).toEqual(parked);
    expect(carts[0].toJSON()).not.toHaveProperty('customer');
  } finally {
    await db.remove();
  }
});

test('restores the parked customer through real useSale', () => {
  const { order, problems } = restore({ ...parkCart(orderFixture()), customer: gee });
  expect(problems).toEqual([]);
  expect(order.customer).toEqual(gee);
});

test('parks and restores a fee, shipping and a custom line with an equal total', () => {
  const { result } = renderHook(() => useSale({ currency: 'USD' }, {
    registerId: 'web', cashierRef: '2', capabilities: { orderCreate: 5 },
  }), {
    wrapper: ({ children }: { children: ReactNode }) => createElement(TaxProvider, {
      ratesPpm: {}, pricesIncludeTax: false, children,
    }),
  });
  act(() => result.current.add(catalogueEntries([products[0]], traits, { currency: 'USD' })[0], traits));
  act(() => {
    result.current.setQuantity(result.current.order.lineItems[0].id, 2);
    result.current.addCustomLine({ name: 'Gift wrap', priceMinor: 300, taxStatus: 'none' });
    result.current.addFee({ name: 'Bag', amountMinor: 20 });
    result.current.addShipping({ name: 'Delivery', amountMinor: 500 });
  });
  const parked = parkCart(result.current.order);
  expect(parked.fees).toEqual([{ name: 'Bag', amountMinor: 20, taxStatus: 'taxable' }]);
  expect(parked.shipping).toEqual([{ name: 'Delivery', amountMinor: 500, taxStatus: 'taxable' }]);
  expect(parked.lines.find(line => line.name === 'Gift wrap')!.custom).toEqual({ priceMinor: 300, taxStatus: 'none' });
  expect(parked.totalMinor).toBe(1420);
  const { order, problems } = restore(parked, products, 5);
  expect(problems).toEqual([]);
  expect(order.totalMinor).toBe(1420);
  expect(order.fees).toHaveLength(1);
  expect(order.fees![0]).toMatchObject({ name: 'Bag', amountMinor: 20 });
  expect(order.shipping).toHaveLength(1);
  expect(order.shipping![0]).toMatchObject({ name: 'Delivery', amountMinor: 500 });
  expect(order.lineItems).toContainEqual(expect.objectContaining({
    custom: true, name: 'Gift wrap', unitPriceMinor: 300, taxStatus: 'none',
  }));
  expect(order.lineItems.find(line => line.productId === '80')!.quantity).toBe(2);
});

test('migrates a v1 cart unchanged and restores it', async () => {
  const v1Schema: RxJsonSchema<Omit<ParkedCart, 'fees' | 'shipping' | 'coupons'>> = {
    version: 1, primaryKey: 'id', type: 'object',
    properties: {
      id: { type: 'string', maxLength: 64 },
      parkedAt: { type: 'string', maxLength: 32 },
      customer: {
        type: 'object', properties: {
          id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' },
        }, required: ['id', 'name'], additionalProperties: false,
      },
      lines: { type: 'array', items: {
        type: 'object', properties: {
          productId: { type: 'string' }, variantId: { type: 'string' },
          quantity: { type: 'number' }, name: { type: 'string' },
          discounts: { type: 'array', items: {
            type: 'object', properties: {
              type: { type: 'string', enum: ['percentage', 'fixed'] }, value: { type: 'number' },
              label: { type: 'string' }, couponCode: { type: 'string' },
            }, required: ['type', 'value'],
          } },
        }, required: ['productId', 'quantity', 'name', 'discounts'],
      } },
      orderDiscounts: { type: 'array', items: {
        type: 'object', properties: {
          type: { type: 'string', enum: ['percentage', 'fixed'] }, value: { type: 'number' },
          label: { type: 'string' }, couponCode: { type: 'string' },
        }, required: ['type', 'value'],
      } },
      itemCount: { type: 'integer' }, totalMinor: { type: 'integer' },
    },
    required: ['id', 'parkedAt', 'lines', 'orderDiscounts', 'itemCount', 'totalMinor'],
    indexes: ['parkedAt'],
  };
  const storage = wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
  const options = { name: 'parked_charges_migration', multiInstance: false, storage };
  const parked = parkCart(orderFixture(true));
  const oldDb = await createRxDatabase(options);
  try {
    const { parked_carts } = await oldDb.addCollections({
      parked_carts: { schema: v1Schema, migrationStrategies: { 1: (doc: any) => doc } },
    });
    await parked_carts.insert(parked);
  } finally {
    await oldDb.close();
  }
  const db = await createRxDatabase(options);
  try {
    const { parked_carts } = await db.addCollections({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const carts = await parked_carts.find().exec();
    expect(carts).toHaveLength(1);
    const migrated = carts[0].toJSON();
    expect(migrated).toEqual(parked);
    expect(migrated).not.toHaveProperty('fees');
    expect(migrated).not.toHaveProperty('shipping');
    for (const line of migrated.lines) expect(line).not.toHaveProperty('custom');
    const { order, problems } = restore(migrated);
    expect(problems).toEqual([]);
    expect(order.totalMinor).toBe(parked.totalMinor);
  } finally {
    await db.remove();
  }
});

test.each([undefined, gee])('restores a guest cart through real useSale with previous customer %j', customer => {
  const { order, problems } = restore(parkCart(orderFixture()), products, 2, customer);
  expect(problems).toEqual([]);
  expect(order.customer).toBeNull();
});

test.each([false, true])('restores quantities and discounts through real useSale (order discount: %s)', withOrderDiscount => {
  const original = orderFixture(withOrderDiscount);
  const { order, problems } = restore(parkCart(original));
  expect(problems).toEqual([]);
  expect(order.subtotalMinor).toBe(original.subtotalMinor);
  expect(order.totalMinor).toBe(original.totalMinor);
  expect(order.lineItems.map(line => [line.productId, line.variantId, line.quantity])).toEqual([
    ['80', '80', 2], ['84', '84', 1],
  ]);
  expect(parkCart(order).lines).toEqual(parkCart(original).lines);
  expect(parkCart(order).orderDiscounts).toEqual(parkCart(original).orderDiscounts);
});

test('reports and skips a product missing from the catalogue', () => {
  const { order, problems } = restore(parkCart(orderFixture()), [products[1]]);
  expect(problems).toEqual(['Espresso is no longer in the catalogue.']);
  expect(order.lineItems.map(line => line.productId)).toEqual(['84']);
  expect(order.totalMinor).toBe(400);
});

test('reports and skips a product whose parked variant is no longer available', () => {
  const { order, problems } = restore(parkCart(orderFixture()), [{ ...products[0], type: 'variable' }, products[1]]);
  expect(problems).toEqual(['Espresso is no longer available.']);
  expect(order.lineItems.map(line => line.productId)).toEqual(['84']);
});

test('restores the matching synced variation with its quantity, price and discount', () => {
  const shirt = { ...products[2], variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id).map(doc => doc.payload) };
  const builder = createOrderBuilder({ currency: 'USD', taxContext: { getTaxRatePpm: () => 0, pricesIncludeTax: false } });
  const lineId = builder.addLine({
    productId: '102', variantId: '106', name: 'T-Shirt · M / Black', quantity: 2, unitPrice: { amount: 2500, currency: 'USD' },
  });
  builder.applyLineDiscount(lineId, lineDiscount);
  const parked = parkCart(builder.getSnapshot());
  const { order, problems } = restore(parked, [shirt]);
  expect(problems).toEqual([]);
  expect(order.lineItems).toHaveLength(1);
  expect(order.lineItems[0]).toMatchObject({
    productId: '102', variantId: '106', name: 'T-Shirt · M / Black', quantity: 2, unitPriceMinor: 2500,
  });
  expect(order.subtotalMinor).toBe(builder.getSnapshot().subtotalMinor);
  expect(order.totalMinor).toBe(4950);
  expect(parkCart(order).lines).toEqual(parked.lines);
  const missingShirt = { ...shirt, variation_docs: shirt.variation_docs.slice(0, 2) };
  const missing = restore(parked, [missingShirt]);
  expect(missing.problems).toEqual(['T-Shirt · M / Black is no longer available.']);
  expect(missing.order.lineItems).toEqual([]);
});

test('reports refused line and order discounts without applying them', () => {
  const parked = parkCart(orderFixture(true));
  parked.lines[0].discounts[0].value = 601;
  parked.orderDiscounts = [{ type: 'fixed', value: 1001 }];
  const { order, problems } = restore(parked);
  expect(problems).toEqual([
    'Discount for Espresso was refused: The discount is more than the line.',
    'Order discount was refused: The discount is more than the order.',
  ]);
  expect(order.totalMinor).toBe(1000);
  expect(order.lineItems[0].discounts).toEqual([]);
  expect(order.discounts).toEqual([]);
});
