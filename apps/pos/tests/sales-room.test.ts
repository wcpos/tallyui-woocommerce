const savedTimezone = process.env.TZ;
process.env.TZ = 'America/Los_Angeles';

import { afterAll, expect, test } from 'vitest';
import { comparisonRange, presetRange, type DatePreset, type PosOrder } from '@tallyui/pos';
import { salesRoom } from '../lib/reports/sales-room';

afterAll(() => {
  if (savedTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = savedTimezone;
});

const now = new Date(2026, 9, 6, 14, 30);
/** Today, 6 Oct, against yesterday. */
const day = { range: { from: '2026-10-06', to: '2026-10-06' }, preset: 'today' as const, comparison: { from: '2026-10-05', to: '2026-10-05' } };
const base: Omit<PosOrder, 'id' | 'totalMinor' | 'payments' | 'syncStatus'> = {
  createdAt: new Date(2026, 9, 6, 9, 15).toISOString(), updatedAt: now.toISOString(),
  currency: 'USD', pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0,
  taxMinor: 0, customer: null, commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' },
};
const orders: PosOrder[] = [
  { ...base, id: 'T1', createdAt: new Date(2026, 9, 6, 9, 15).toISOString(),
    subtotalMinor: 300, totalMinor: 300, syncStatus: 'applied',
    payments: [{ id: 'p1', method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 }] },
  { ...base, id: 'T2', createdAt: new Date(2026, 9, 6, 9, 40).toISOString(),
    subtotalMinor: 800, totalMinor: 858, taxMinor: 58, syncStatus: 'pending',
    lines: [{ id: 'l2', productId: 'product2', name: 'Item 2', sku: 'sku2', quantity: 1,
      unitPriceMinor: 800, discountMinor: 0, netMinor: 800,
      taxLines: [{ ratePpm: 72500, taxMicros: '58000000' }] }],
    payments: [{ id: 'p2', method: 'cash', amountMinor: 358 }, { id: 'p3', method: 'external', amountMinor: 500 }] },
  { ...base, id: 'T3', createdAt: new Date(2026, 9, 6, 13, 5).toISOString(),
    subtotalMinor: 1600, totalMinor: 1738, taxMinor: 138, syncStatus: 'applied',
    lines: [{ id: 'l3', productId: 'product3', name: 'Item 3', sku: 'sku3', quantity: 1,
      unitPriceMinor: 1600, discountMinor: 0, netMinor: 1600,
      taxLines: [{ ratePpm: 72500, taxMicros: '116000000' }, { ratePpm: 13750, taxMicros: '22000000' }] }],
    payments: [{ id: 'p4', method: 'external', amountMinor: 1738 }] },
  { ...base, id: 'T4', createdAt: new Date(2026, 9, 6, 13, 50).toISOString(),
    subtotalMinor: 100, totalMinor: 100, syncStatus: 'rejected',
    payments: [{ id: 'p5', method: 'cash', amountMinor: 100 }] },
  { ...base, id: 'Y1', createdAt: new Date(2026, 9, 5, 11, 20).toISOString(),
    subtotalMinor: 400, totalMinor: 400, syncStatus: 'applied',
    payments: [{ id: 'p6', method: 'cash', amountMinor: 400 }] },
  { ...base, id: 'Y2', createdAt: new Date(2026, 9, 5, 16, 45).toISOString(),
    subtotalMinor: 600, totalMinor: 600, syncStatus: 'applied',
    payments: [{ id: 'p7', method: 'external', amountMinor: 600 }] },
  { ...base, id: 'X1', createdAt: new Date(2026, 9, 6, 10, 0).toISOString(), currency: 'EUR',
    subtotalMinor: 999, totalMinor: 999, syncStatus: 'applied',
    payments: [{ id: 'p8', method: 'cash', amountMinor: 999 }] },
  { ...base, id: 'X2', createdAt: new Date(2026, 9, 4, 23, 59).toISOString(),
    subtotalMinor: 5000, totalMinor: 5000, syncStatus: 'applied',
    payments: [{ id: 'p9', method: 'cash', amountMinor: 5000 }] },
  { ...base, id: 'X3', createdAt: new Date(2026, 9, 7, 0, 0).toISOString(),
    subtotalMinor: 7000, totalMinor: 7000, syncStatus: 'applied',
    payments: [{ id: 'p10', method: 'cash', amountMinor: 7000 }] },
];
const lastWeek: PosOrder[] = [
  { ...base, id: 'W1', createdAt: new Date(2026, 8, 29, 11, 20).toISOString(),
    subtotalMinor: 250, totalMinor: 250, syncStatus: 'applied',
    payments: [{ id: 'w1', method: 'cash', amountMinor: 250 }] },
  { ...base, id: 'W2', createdAt: new Date(2026, 8, 29, 16, 45).toISOString(),
    subtotalMinor: 950, totalMinor: 950, syncStatus: 'applied',
    payments: [{ id: 'w2', method: 'external', amountMinor: 950 }] },
];

test('today totals every sync state in the store currency only', () => {
  expect(salesRoom(orders, { now, currency: 'USD', ...day }).today).toMatchObject({
    count: 4, totalMinor: 2996, taxMinor: 196, averageMinor: 749, pending: 1, rejected: 1, splitCount: 1,
  });
}, 20_000);

test('a split counts once per method with its applied amounts', () => {
  expect(salesRoom(orders, { now, currency: 'USD', ...day }).today.byMethod).toEqual([
    { method: 'cash', label: 'Cash', count: 3, totalMinor: 758 },
    { method: 'external', label: 'Card terminal', count: 2, totalMinor: 2238 },
  ]);
}, 20_000);

test('two cash legs on one order count one cash order', () => {
  const order: PosOrder = { ...base, id: 'two-cash', createdAt: new Date(2026, 9, 6, 10, 0).toISOString(),
    subtotalMinor: 500, totalMinor: 500, syncStatus: 'applied',
    payments: [{ id: 'cash1', method: 'cash', amountMinor: 300 }, { id: 'cash2', method: 'cash', amountMinor: 200 }] };
  const { today } = salesRoom([order], { now, currency: 'USD', ...day });
  expect(today.byMethod).toEqual([{ method: 'cash', label: 'Cash', count: 1, totalMinor: 500 }]);
  expect(today.splitCount).toBe(1);
}, 20_000);

test('tax rows mirror the Z report', () => {
  const { today } = salesRoom(orders, { now, currency: 'USD', ...day });
  expect(today.taxRates).toEqual([
    { ratePpm: 13750, label: 'Tax 1.375%', netMinor: 1600, taxMinor: 22, grossMinor: 1622 },
    { ratePpm: 72500, label: 'Tax 7.25%', netMinor: 2400, taxMinor: 174, grossMinor: 2574 },
  ]);
  expect(today.taxRates.reduce((sum, row) => sum + row.taxMinor, 0)).toBe(today.taxMinor);
}, 20_000);

test('tax rates include fee and shipping tax', () => {
  const list: PosOrder[] = [{ ...base, id: 'C1', createdAt: new Date(2026, 9, 6, 9, 15).toISOString(), syncStatus: 'applied',
    lines: [{ id: 'l1', productId: 'product1', name: 'Item 1', sku: 'sku1', quantity: 1,
      unitPriceMinor: 800, discountMinor: 0, netMinor: 800,
      taxLines: [{ ratePpm: 72500, taxMicros: '58000000' }] }],
    fees: [{ id: 'f1', name: 'Bag', amountMinor: 400, taxStatus: 'taxable', netMinor: 400, taxMicros: '29000000',
      taxLines: [{ ratePpm: 72500, taxMicros: '29000000' }] }],
    shipping: [{ id: 's1', name: 'Delivery', amountMinor: 200, taxStatus: 'taxable', netMinor: 200, taxMicros: '14500000',
      taxLines: [{ ratePpm: 72500, taxMicros: '14500000' }] }],
    subtotalMinor: 800, taxMinor: 102, totalMinor: 1502,
    payments: [{ id: 'p1', method: 'cash', amountMinor: 1502 }],
  }];
  expect(salesRoom(list, { now, currency: 'USD', ...day }).today.taxRates).toMatchObject([
    { ratePpm: 72500, netMinor: 1400, taxMinor: 102, grossMinor: 1502 },
  ]);
});

test('yesterday excludes the day before and tomorrow', () => {
  const result = salesRoom(orders, { now, currency: 'USD', ...day });
  expect(result.yesterday).toMatchObject({ count: 2, totalMinor: 1000 });
  expect(result.yesterday.byMethod).toEqual([
    { method: 'cash', label: 'Cash', count: 1, totalMinor: 400 },
    { method: 'external', label: 'Card terminal', count: 1, totalMinor: 600 },
  ]);
  expect(result).toEqual(salesRoom(orders.filter(order => order.id !== 'X2' && order.id !== 'X3'), { now, currency: 'USD', ...day }));
}, 20_000);

test('the comparison uses yesterday up to the same time', () => {
  const { yesterdaySoFar, delta } = salesRoom(orders, { now, currency: 'USD', ...day });
  expect(yesterdaySoFar).toEqual({ count: 1, totalMinor: 400, averageMinor: 400, items: 0 });
  expect(delta).toEqual({ totalMinor: 2596, percentTenths: 6490, count: 3, averageMinor: 349, items: 2 });
  expect(salesRoom(orders.filter(order => order.id.startsWith('T')), { now, currency: 'USD', ...day }).delta.percentTenths).toBeNull();
}, 20_000);

test('hours span both days\' sales', () => {
  const { hours } = salesRoom(orders, { now, currency: 'USD', ...day });
  expect(hours.map(bucket => bucket.hour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  for (const bucket of hours) {
    expect(bucket.today).toEqual(bucket.hour === 9 ? { count: 2, totalMinor: 1158 }
      : bucket.hour === 13 ? { count: 2, totalMinor: 1838 } : { count: 0, totalMinor: 0 });
    expect(bucket.yesterday).toEqual(bucket.hour === 11 ? { count: 1, totalMinor: 400 }
      : bucket.hour === 16 ? { count: 1, totalMinor: 600 } : { count: 0, totalMinor: 0 });
  }
}, 20_000);

test('runs in a non-UTC zone', () => {
  expect(new Date(2026, 9, 6, 9).getUTCHours()).toBe(16);
}, 20_000);

test('last week compares the same weekday up to the same time', () => {
  const result = salesRoom([...orders, ...lastWeek], { now, currency: 'USD', ...day, comparison: { from: '2026-09-29', to: '2026-09-29' } });
  expect(result.yesterday).toMatchObject({ count: 2, totalMinor: 1200 });
  expect(result.yesterdaySoFar).toEqual({ count: 1, totalMinor: 250, averageMinor: 250, items: 0 });
  expect(result.delta).toEqual({ totalMinor: 2746, percentTenths: 10984, count: 3, averageMinor: 499, items: 2 });
  expect(result.today).toMatchObject({ count: 4, totalMinor: 2996 });
  expect(result.hours.find(bucket => bucket.hour === 11)!.yesterday).toEqual({ count: 1, totalMinor: 250 });
  expect(result.hours.find(bucket => bucket.hour === 16)!.yesterday).toEqual({ count: 1, totalMinor: 950 });
}, 20_000);

test('compare defaults to yesterday', () => {
  expect(salesRoom([...orders, ...lastWeek], { now, currency: 'USD', ...day, comparison: comparisonRange(day.range, 'previous', 'today') }))
    .toEqual(salesRoom([...orders, ...lastWeek], { now, currency: 'USD', ...day }));
  expect(salesRoom([...orders, ...lastWeek], { now, currency: 'USD', ...day }).yesterday).toMatchObject({ count: 2, totalMinor: 1000 });
}, 20_000);

const line = (id: string, quantity: number) => ({ id, productId: `product-${id}`, name: `Item ${id}`, sku: id, quantity,
  unitPriceMinor: 100, discountMinor: 0, netMinor: 100 * quantity, taxLines: [] });
const itemOrders: PosOrder[] = [
  { ...base, id: 'I1', createdAt: new Date(2026, 9, 6, 9, 0).toISOString(), subtotalMinor: 300, totalMinor: 300,
    syncStatus: 'applied', lines: [line('a', 2), line('b', 1)], payments: [{ id: 'i1', method: 'cash', amountMinor: 300 }] },
  { ...base, id: 'I2', createdAt: new Date(2026, 9, 6, 11, 0).toISOString(), subtotalMinor: 300, totalMinor: 300,
    syncStatus: 'applied', lines: [line('c', 3)], payments: [{ id: 'i2', method: 'cash', amountMinor: 300 }] },
  { ...base, id: 'J1', createdAt: new Date(2026, 9, 5, 10, 0).toISOString(), subtotalMinor: 400, totalMinor: 400,
    syncStatus: 'applied', lines: [line('d', 4)], payments: [{ id: 'j1', method: 'cash', amountMinor: 400 }] },
  { ...base, id: 'J2', createdAt: new Date(2026, 9, 5, 15, 0).toISOString(), subtotalMinor: 500, totalMinor: 500,
    syncStatus: 'applied', lines: [line('e', 5)], payments: [{ id: 'j2', method: 'cash', amountMinor: 500 }] },
  { ...base, id: 'K1', createdAt: new Date(2026, 9, 6, 10, 0).toISOString(), currency: 'EUR', subtotalMinor: 700, totalMinor: 700,
    syncStatus: 'applied', lines: [line('f', 7)], payments: [{ id: 'k1', method: 'cash', amountMinor: 700 }] },
];

test('items sums the line quantities of the orders counted today', () => {
  expect(salesRoom(itemOrders, { now, currency: 'USD', ...day }).today).toMatchObject({ count: 2, items: 6 });
}, 20_000);

test("the comparison's items count only the comparison day's orders before the same time", () => {
  const result = salesRoom(itemOrders, { now, currency: 'USD', ...day });
  expect(result.yesterday).toMatchObject({ count: 2, items: 9 });
  expect(result.yesterdaySoFar).toEqual({ count: 1, totalMinor: 400, averageMinor: 400, items: 4 });
  expect(result.delta.items).toBe(2);
}, 20_000);

test('the median takes the middle total of an odd count', () => {
  const today = salesRoom(orders.filter(order => order.id !== 'T4'), { now, currency: 'USD', ...day }).today;
  expect(today.count).toBe(3);
  expect(today.medianMinor).toBe(858);
}, 20_000);

test('the median of an even count averages the middle two, rounded', () => {
  expect(salesRoom(orders, { now, currency: 'USD', ...day }).today.medianMinor).toBe(579);
  const pair = [orders[0], orders[3]].map((order, index) => ({ ...order, totalMinor: [100, 201][index] }));
  expect(salesRoom(pair, { now, currency: 'USD', ...day }).today.medianMinor).toBe(151);
}, 20_000);

test('largest is the biggest order total, null with no orders', () => {
  const result = salesRoom(orders, { now, currency: 'USD', ...day });
  expect(result.today.largestMinor).toBe(1738);
  expect(result.yesterday.largestMinor).toBe(600);
  expect(salesRoom([], { now, currency: 'USD', ...day }).today).toMatchObject({ medianMinor: 0, largestMinor: null, discountMinor: 0 });
}, 20_000);

test("discountMinor sums the orders' discounts", () => {
  const discounted = orders.map(order => ({ ...order, discountMinor: order.id === 'T1' ? 50 : order.id === 'T3' ? 125 : 0 }));
  expect(salesRoom(discounted, { now, currency: 'USD', ...day }).today.discountMinor).toBe(175);
}, 20_000);

/** A preset's range at `now` and the comparison the screen gives a week or month: the period before. */
const period = (preset: DatePreset) => {
  const range = presetRange(preset, now, 'device');
  return { range, preset, comparison: comparisonRange(range, 'previous', preset) };
};
const sale = (id: string, at: Date, totalMinor: number): PosOrder => ({ ...base, id, createdAt: at.toISOString(),
  subtotalMinor: totalMinor, totalMinor, syncStatus: 'applied', payments: [{ id, method: 'cash', amountMinor: totalMinor }] });

test('Yesterday counts only its own day, by hour, and compares the whole day before', () => {
  const result = salesRoom(orders, { now, currency: 'USD', ...period('yesterday') });
  expect(result.today).toMatchObject({ count: 2, totalMinor: 1000 });
  // X2 at 23:59 is after now's time of day, yet a closed day is compared whole.
  expect(result.yesterdaySoFar).toMatchObject({ count: 1, totalMinor: 5000 });
  // 11:00 to 24:00 is 780 minutes: 90-minute steps from 10:30.
  expect(result.hours.map(bucket => bucket.minute)).toEqual([630, 720, 810, 900, 990, 1080, 1170, 1260, 1350]);
  expect(result.hours.some(bucket => bucket.day)).toBe(false);
}, 20_000);

test("This week buckets by day and cuts the comparison's last day at now's time of day", () => {
  const weekBefore = [...lastWeek, sale('S1', new Date(2026, 8, 28, 18, 0), 300)];
  const result = salesRoom([...orders, ...weekBefore], { now, currency: 'USD', ...period('thisWeek') });
  expect(result.today).toMatchObject({ count: 6, totalMinor: 3996 });
  expect(result.yesterday).toMatchObject({ count: 3, totalMinor: 1500 });
  // Monday's 18:00 counts whole; Tuesday's 16:45 is after 14:30 and is left out.
  expect(result.yesterdaySoFar).toMatchObject({ count: 2, totalMinor: 550 });
  expect(result.hours).toEqual([
    { hour: 0, minute: 0, day: '2026-10-05', today: { count: 2, totalMinor: 1000 }, yesterday: { count: 1, totalMinor: 300 } },
    { hour: 1, minute: 0, day: '2026-10-06', today: { count: 4, totalMinor: 2996 }, yesterday: { count: 2, totalMinor: 1200 } },
  ]);
  // v2 aggregateData draws every day of a multi-day period, sales or none.
  expect(salesRoom([], { now, currency: 'USD', ...period('thisWeek') }).hours.map(bucket => bucket.day)).toEqual(['2026-10-05', '2026-10-06']);
}, 20_000);

test('Last month compares the whole month before', () => {
  const list = [sale('M1', new Date(2026, 8, 30, 20, 0), 700), sale('A1', new Date(2026, 7, 31, 23, 0), 400),
    sale('A2', new Date(2026, 7, 1, 9, 0), 100), sale('J1', new Date(2026, 6, 31, 12, 0), 9000)];
  const result = salesRoom([...orders, ...list], { now, currency: 'USD', ...period('lastMonth') });
  expect(result.today).toMatchObject({ count: 1, totalMinor: 700 });
  expect(result.yesterdaySoFar).toMatchObject({ count: 2, totalMinor: 500 });
  expect(result.hours).toHaveLength(30);
  expect(result.hours[29]).toMatchObject({ day: '2026-09-30', today: { totalMinor: 700 }, yesterday: { totalMinor: 0 } });
}, 20_000);

/** A single day's buckets for sales at these times today (6 Oct) and on the comparison day (5 Oct). */
const steps = (todayAt: [number, number][], comparisonAt: [number, number][] = []) => salesRoom([
  ...todayAt.map(([h, m], i) => sale(`T${i}`, new Date(2026, 9, 6, h, m), 100)),
  ...comparisonAt.map(([h, m], i) => sale(`C${i}`, new Date(2026, 9, 5, h, m), 100)),
], { now, currency: 'USD', ...day }).hours;

test('By hour picks the smallest nice step that keeps the span to 12 bars (v2 getNiceMinuteInterval)', () => {
  // 09:00 to 21:00 is 720 minutes: 60-minute steps.
  expect(steps([[9, 10], [20, 50]]).map(bucket => bucket.minute)).toEqual(Array.from({ length: 12 }, (_, i) => 540 + i * 60));
  // 08:00 to 24:00 is 960 minutes, 80 a bar: 90-minute steps from midnight, the first at 07:30.
  const ninety = steps([[8, 5], [23, 40]]);
  expect(ninety.map(bucket => bucket.minute)).toEqual([450, 540, 630, 720, 810, 900, 990, 1080, 1170, 1260, 1350]);
  expect(ninety.map(bucket => bucket.hour)).toEqual([7, 9, 10, 12, 13, 15, 16, 18, 19, 21, 22]);
  expect(ninety[0].today).toEqual({ count: 1, totalMinor: 100 });
  expect(ninety[10].today).toEqual({ count: 1, totalMinor: 100 });
  // 10:00 to 12:00 is 120 minutes: 30-minute steps.
  const thirty = steps([[10, 5], [11, 20]]);
  expect(thirty.map(bucket => bucket.minute)).toEqual([600, 630, 660, 690]);
  expect(thirty.map(bucket => bucket.today.count)).toEqual([1, 0, 1, 0]);
}, 20_000);

test("the comparison's sales widen a single day's span", () => {
  const hours = steps([[10, 5], [11, 20]], [[15, 10]]);
  // 10:00 to 16:00 is 360 minutes: twelve 30-minute steps.
  expect(hours.map(bucket => bucket.minute)).toEqual(Array.from({ length: 12 }, (_, i) => 600 + i * 30));
  expect(hours.find(bucket => bucket.minute === 900)!.yesterday).toEqual({ count: 1, totalMinor: 100 });
}, 20_000);

test('a day with no sales is the whole day in twelve 120-minute buckets', () => {
  const hours = steps([]);
  expect(hours.map(bucket => bucket.minute)).toEqual(Array.from({ length: 12 }, (_, i) => i * 120));
  expect(hours.every(bucket => bucket.today.totalMinor === 0 && bucket.yesterday.totalMinor === 0)).toBe(true);
}, 20_000);
