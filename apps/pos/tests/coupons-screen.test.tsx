import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { RxCollection } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { createTallyDatabase } from '@tallyui/database';
import { PortalHost } from '@tallyui/primitives';
import { CouponsScreen } from '../components/coupons-screen';
import { CARD_CLASSES } from './classes-of';

const connector = createWooCommerceConnector();
const base = { used_by: [], status: 'publish' };
const couponDocs = [
  { uuid: 'c-1', id: 1, code: '10off', discount_type: 'percent', amount: '10', description: 'Ten percent off',
    date_created_gmt: '2026-03-01T10:00:00', usage_count: 3, usage_limit: 10, ...base },
  { uuid: 'c-2', id: 2, code: '5dollars', discount_type: 'fixed_cart', amount: '5', description: 'five dollars off',
    date_created_gmt: '2026-02-01T10:00:00', usage_count: 3, usage_limit: 0, ...base },
  { uuid: 'c-3', id: 3, code: 'old', discount_type: 'fixed_product', amount: '2', description: 'Expired',
    date_created_gmt: '2026-01-01T10:00:00', date_expires_gmt: '2020-01-01T00:00:00', usage_count: 3, ...base },
];

let db: Awaited<ReturnType<typeof createTallyDatabase>>;

beforeEach(async () => {
  db = await createTallyDatabase({ connector, name: `coupons_screen_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.close();
});

function renderScreen(coupons: RxCollection = db.coupons, onBack = vi.fn()) {
  const view = render(<><CouponsScreen coupons={coupons} currency="USD" locale="en_US" onBack={onBack} /><PortalHost /></>);
  return { ...view, onBack };
}

async function withCoupons() {
  await db.coupons.bulkInsert(couponDocs);
  const rendered = renderScreen();
  await screen.findByTestId('coupons-row-10off');
  return rendered;
}

const row = (code: string) => within(screen.getByTestId(`coupons-row-${code}`));
const rowCodes = () => screen.queryAllByTestId(/^coupons-row-/).map(el => el.getAttribute('data-testid'));
const typeSearch = (text: string) => fireEvent.change(screen.getByTestId('search-coupons'), { target: { value: text } });

test('the table lists the coupons under v2 headers, newest first, with amount and type labels', async () => {
  await withCoupons();
  expect(screen.getByTestId('screen-coupons')).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Coupons' })).not.toBeNull();
  const headers = screen.getAllByTestId(/^coupons-header-/).map(el => el.textContent);
  expect(headers).toEqual(['Active', 'Code', 'Amount', 'Type', 'Description', 'Usage', 'Expiry Date']);
  expect(rowCodes()).toEqual(['coupons-row-10off', 'coupons-row-5dollars', 'coupons-row-old']);
  expect(row('10off').getByText('10%')).not.toBeNull();
  expect(row('10off').getByText('Percentage')).not.toBeNull();
  expect(row('5dollars').getByText('$5.00')).not.toBeNull();
  expect(row('5dollars').getByText('Fixed Cart')).not.toBeNull();
  expect(row('old').getByText('Fixed Product')).not.toBeNull();
  expect(row('5dollars').getByText('five dollars off')).not.toBeNull();
});

test('an unknown discount type reads as itself, and the expiry date shows in the locale without a time', async () => {
  await db.coupons.insert({ uuid: 'c-9', id: 9, code: 'later', discount_type: 'store_credit', amount: '1',
    date_expires_gmt: '2099-06-15T12:00:00', ...base });
  renderScreen();
  await screen.findByTestId('coupons-row-later');
  expect(row('later').getByText('store_credit')).not.toBeNull();
  const expected = new Date('2099-06-15T12:00:00Z').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  expect(row('later').getByTestId('coupon-expiry-later').textContent).toBe(expected);
});

test('usage reads count / limit with a positive limit, and only the count with a limit of 0 or none', async () => {
  await db.coupons.bulkInsert(couponDocs);
  await db.coupons.insert({ uuid: 'c-8', id: 8, code: 'nolimit', discount_type: 'percent', amount: '1', ...base });
  renderScreen();
  await screen.findByTestId('coupons-row-10off');
  expect(row('10off').getByTestId('coupon-usage-10off').textContent).toBe('3 / 10');
  expect(row('5dollars').getByTestId('coupon-usage-5dollars').textContent).toBe('3');
  expect(row('old').getByTestId('coupon-usage-old').textContent).toBe('3');
  expect(row('nolimit').getByTestId('coupon-usage-nolimit').textContent).toBe('0');
});

test('a published coupon with no expiry is Active; one whose expiry has passed is Inactive', async () => {
  await withCoupons();
  expect(row('10off').getByText('Active')).not.toBeNull();
  expect(row('10off').queryByText('Inactive')).toBeNull();
  expect(row('old').getByText('Inactive')).not.toBeNull();
  expect(row('old').queryByText('Active')).toBeNull();
});

// react-native-web drops className from the DOM, so read it off the component that took the testID (as logs-screen.test).
type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber; alternate?: Fiber };
function classesOf(testID: string): string[] {
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  const key = (prefix: string) => Object.keys(node).find(name => name.startsWith(prefix))!;
  const created = node[key('__reactFiber$')] as Fiber;
  let fiber: Fiber | undefined = created.memoizedProps === node[key('__reactProps$')] ? created : created.alternate;
  const found: string[] = [];
  for (; fiber; fiber = fiber.return) {
    const { className, testID: id } = fiber.memoizedProps ?? {};
    if (id === testID && typeof className === 'string') found.push(...className.split(/\s+/));
  }
  return found;
}

test('the status is v2\'s dot and word, no badge: a green dot for Active, a grey one for Inactive', async () => {
  await withCoupons();
  expect(screen.getByTestId('coupon-active-10off').textContent).toBe('Active');
  expect(classesOf('coupon-active-10off-dot')).toEqual(expect.arrayContaining(['size-2', 'rounded-full', 'bg-success']));
  expect(screen.getByTestId('coupon-active-old').textContent).toBe('Inactive');
  expect(classesOf('coupon-active-old-dot')).toContain('bg-muted-foreground');
  // A Badge is a filled, bordered pill; the status is a plain row.
  expect(classesOf('coupon-active-10off')).toEqual(['flex-row', 'items-center', 'gap-1.5']);
});

test('search matches the description as well as the code, and the footer counts what it shows', async () => {
  await withCoupons();
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 3 of 3');
  typeSearch('five');
  await waitFor(() => expect(rowCodes()).toEqual(['coupons-row-5dollars']));
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 1 of 3');
  typeSearch('10OFF');
  await waitFor(() => expect(rowCodes()).toEqual(['coupons-row-10off']));
});

test('one coupon reads Showing 1 of 1 in the footer, as v2 reads it', async () => {
  await db.coupons.insert(couponDocs[0]);
  renderScreen();
  await screen.findByTestId('coupons-row-10off');
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 1 of 1');
});

test('a search that matches nothing says so, and Clear filters brings the rows back', async () => {
  await withCoupons();
  typeSearch('zzz');
  await screen.findByText('No coupons match these filters');
  expect(rowCodes()).toEqual([]);
  expect(screen.getByTestId('no-data-message-title').textContent).toBe('No coupons match these filters');
  fireEvent.click(screen.getByTestId('no-data-message-action'));
  await waitFor(() => expect(rowCodes()).toHaveLength(3));
  expect((screen.getByTestId('search-coupons') as HTMLInputElement).value).toBe('');
});

test('an empty collection shows No coupons yet', async () => {
  renderScreen();
  await screen.findByText('No coupons yet');
  expect(screen.getByTestId('no-data-message-description').textContent).toBe('Coupons you create will appear here.');
});

test('a coupon replicated in after the first render gets its row', async () => {
  await withCoupons();
  await db.coupons.insert({ uuid: 'c-7', id: 7, code: 'fresh', discount_type: 'percent', amount: '15',
    date_created_gmt: '2026-04-01T10:00:00', ...base });
  await waitFor(() => expect(rowCodes()[0]).toBe('coupons-row-fresh'));
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 4 of 4');
});

test('the screen never writes to the replicated coupons collection', async () => {
  const writes = (['insert', 'bulkInsert', 'upsert', 'bulkUpsert', 'incrementalUpsert', 'bulkRemove', 'remove'] as const)
    .map(method => vi.spyOn(db.coupons, method));
  await withCoupons();
  writes.forEach(spy => spy.mockClear());
  typeSearch('five');
  await waitFor(() => expect(rowCodes()).toEqual(['coupons-row-5dollars']));
  fireEvent.click(screen.getByTestId('coupons-back'));
  for (const spy of writes) expect(spy).not.toHaveBeenCalled();
});

test('the narrow list shows each code with its badge, amount and type, and Back calls onBack', async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 400, height: 800, scale: 1, fontScale: 1 });
  await db.coupons.bulkInsert(couponDocs);
  const { onBack } = renderScreen();
  await screen.findByTestId('coupons-row-10off');
  expect(screen.queryAllByTestId(/^coupons-header-/)).toHaveLength(0);
  expect(row('10off').getByText('10off')).not.toBeNull();
  expect(row('10off').getByText('Active')).not.toBeNull();
  expect(row('10off').getByText('10% · Percentage')).not.toBeNull();
  expect(row('old').getByText('Inactive')).not.toBeNull();
  fireEvent.click(screen.getByTestId('coupons-back'));
  expect(onBack).toHaveBeenCalledOnce();
});

test('unmounting unsubscribes from the collection; documents carry no write methods it could call', () => {
  const unsubscribe = vi.fn();
  const docs = couponDocs.map(doc => ({ toJSON: () => doc }));
  const fake = { find: () => ({ $: { subscribe: (next: (found: unknown[]) => void) => { next(docs); return { unsubscribe }; } } }) };
  const { unmount } = renderScreen(fake as unknown as RxCollection);
  expect(rowCodes()).toHaveLength(3);
  expect(unsubscribe).not.toHaveBeenCalled();
  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

const pill = (key: string) => screen.getByTestId(`filter-pill-${key}`).textContent;
function choose(key: string, option: string) {
  fireEvent.click(screen.getByTestId(`filter-pill-${key}`));
  fireEvent.click(screen.getByTestId(option));
}
const draft = { uuid: 'c-4', id: 4, code: 'drafty', discount_type: 'fixed_cart', amount: '3', used_by: [], status: 'draft',
  date_created_gmt: '2026-01-15T10:00:00' };

test('the Status chip keeps only the chosen status, reads its label, and its clear brings every coupon back', async () => {
  await db.coupons.insert(draft);
  await withCoupons();
  expect(pill('status')).toBe('Status');
  expect(screen.queryByTestId('filter-pill-remove-status')).toBeNull();
  choose('status', 'coupon-filter-status-draft');
  await waitFor(() => expect(rowCodes()).toEqual(['coupons-row-drafty']));
  expect(pill('status')).toBe('Draft');
  fireEvent.click(screen.getByTestId('filter-pill-remove-status'));
  await waitFor(() => expect(rowCodes()).toHaveLength(4));
  expect(pill('status')).toBe('Status');
});

test('Discount Type keeps only that type, combines with Status, and Clear all turns both off', async () => {
  await db.coupons.insert(draft);
  await withCoupons();
  choose('discount_type', 'coupon-filter-type-fixed_cart');
  await waitFor(() => expect(rowCodes()).toEqual(['coupons-row-5dollars', 'coupons-row-drafty']));
  expect(pill('discount_type')).toBe('Fixed Cart Discount');
  expect(screen.queryByTestId('coupons-filter-clear-all')).toBeNull();
  choose('status', 'coupon-filter-status-publish');
  await waitFor(() => expect(rowCodes()).toEqual(['coupons-row-5dollars']));
  fireEvent.click(screen.getByTestId('coupons-filter-clear-all'));
  await waitFor(() => expect(rowCodes()).toHaveLength(4));
  expect(pill('status')).toBe('Status');
  expect(pill('discount_type')).toBe('Discount Type');
  expect(screen.queryByTestId('coupons-filter-clear-all')).toBeNull();
});

test('Expires This month keeps a coupon expiring this month, not next year or never', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12));
  try {
    const gmt = (date: Date) => date.toISOString().slice(0, 19);
    await db.coupons.bulkInsert([
      { uuid: 'c-5', id: 5, code: 'soon', discount_type: 'percent', amount: '5', date_expires_gmt: gmt(new Date(2026, 9, 10, 12)), ...base },
      { uuid: 'c-6', id: 6, code: 'nextyear', discount_type: 'percent', amount: '5', date_expires_gmt: gmt(new Date(2027, 9, 10, 12)), ...base },
    ]);
    await withCoupons();
    expect(pill('date_expires_gmt')).toBe('Expires');
    choose('date_expires_gmt', 'coupon-filter-expires-thisMonth');
    await waitFor(() => expect(rowCodes()).toEqual(['coupons-row-soon']));
    expect(pill('date_expires_gmt')).toBe('This month');
    expect(screen.getByTestId('filter-pill-remove-date_expires_gmt')).not.toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

test('a chip with a search that matches nothing shows the empty state, and Clear filters clears both', async () => {
  await withCoupons();
  choose('status', 'coupon-filter-status-publish');
  typeSearch('zzz');
  await screen.findByText('No coupons match these filters');
  fireEvent.click(screen.getByTestId('no-data-message-action'));
  await waitFor(() => expect(rowCodes()).toHaveLength(3));
  expect((screen.getByTestId('search-coupons') as HTMLInputElement).value).toBe('');
  expect(pill('status')).toBe('Status');
  expect(screen.queryByTestId('filter-pill-remove-status')).toBeNull();
});

test("at 1280 the table sits on v2's card, with the count under it", async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
  await withCoupons();
  const surface = screen.getByTestId('coupons-table-surface');
  expect(classesOf('coupons-table-surface')).toEqual(expect.arrayContaining(CARD_CLASSES));
  expect(surface.contains(screen.getByTestId('coupons-body'))).toBe(true);
  expect(surface.contains(screen.getByTestId('data-table-count'))).toBe(false);
});

test("v2's cells: centred on the row with its padding, Amount right on head and cell, Usage centred", async () => {
  await withCoupons();
  for (const id of ['code', 'description', 'date_expires_gmt']) {
    expect(classesOf(`coupons-cell-${id}-10off`)).toEqual(expect.arrayContaining(['justify-center', 'px-3', 'py-1.5']));
  }
  expect(classesOf('coupons-cell-amount-10off')).toContain('items-end');
  expect(classesOf('coupons-head-amount')).toContain('items-end');
  expect(classesOf('coupons-cell-usage_count-10off')).toContain('items-center');
  expect(classesOf('coupons-head-usage_count')).toContain('items-center');
  expect(classesOf('coupons-head-code')).toContain('px-3');
  expect(classesOf('coupons-head-code')).not.toContain('px-4');
  expect(classesOf('coupons-head-code')).not.toContain('items-end');
});

test("an on chip's icon and × take the selected ink, as the catalogue chips'; an off chip's icon keeps its own", async () => {
  await withCoupons();
  const glyph = (testID: string) => screen.getByTestId(testID).querySelector('svg')?.getAttribute('class') ?? '';
  expect(glyph('filter-pill-status')).toBe('');
  choose('status', 'coupon-filter-status-publish');
  await waitFor(() => expect(glyph('filter-pill-status')).toBe('text-selected-foreground'));
  expect(glyph('filter-pill-remove-status')).toBe('text-selected-foreground');
  // v2's clear cell and mark (chip/index.tsx:211-222, :239), as the catalogue chips'.
  expect(classesOf('filter-pill-remove-status'))
    .toEqual(expect.arrayContaining(['min-w-11', '-mr-3', 'items-center', 'justify-center', 'self-stretch']));
  const mark = screen.getByTestId('filter-pill-remove-status').querySelector('svg')!;
  expect([mark.getAttribute('width'), mark.getAttribute('height')]).toEqual(['16', '16']);
});

test("each head is v2's 44 px (ResizeHead's min-h-row), its label centred", async () => {
  await withCoupons();
  const heads = screen.getAllByTestId(/^coupons-head-/);
  expect(heads.length).toBeGreaterThan(0);
  for (const head of heads) {
    expect(classesOf(head.getAttribute('data-testid')!)).toEqual(expect.arrayContaining(['min-h-11', 'justify-center']));
  }
});
