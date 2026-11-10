import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen as SaleScreenWithoutHost, type SaleScreenProps } from '../components/sale-screen';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { clearBeforeLeave, runBeforeLeave, setBeforeLeave } from '../lib/sale/before-leave';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

addRxPlugin(RxDBMigrationSchemaPlugin);

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
  cashiers: [{ uuid: 'b', name: 'Sam' }], heldCartKey: 'held-test',
  onSwitchCashier: async () => null,
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  setBeforeLeave(null);
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function withParkedCarts(run: (parkedCarts: ParkedCartCollection) => Promise<void>) {
  const db = await createRxDatabase({
    name: `before_leave_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    await run(parkedCarts);
  } finally {
    cleanup();
    await db.remove();
  }
}

test('with no handler the page may leave', async () => {
  expect(await runBeforeLeave()).toBeNull();
});

test("the handler's answer is returned and clearing it removes it", async () => {
  setBeforeLeave(async () => 'no');
  expect(await runBeforeLeave()).toBe('no');
  setBeforeLeave(null);
  expect(await runBeforeLeave()).toBeNull();
});

test('the sale screen parks a non-empty cart under the held-cart key before leaving', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    await act(async () => { expect(await runBeforeLeave()).toBeNull(); });
    const docs = await parkedCarts.find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].toJSON()).toMatchObject({ lines: [{ name: 'Espresso', quantity: 1 }] });
    expect(localStorage.getItem('held-test')).toBe(docs[0].id);
  });
});

test('the sale screen refuses to leave during a payment and keeps the cart', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
    await act(async () => { expect(await runBeforeLeave()).toBe('Finish or cancel the payment first.'); });
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
});

test('an empty cart leaves without parking', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    await act(async () => { expect(await runBeforeLeave()).toBeNull(); });
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
});

test('unmounting the sale screen removes its handler', async () => {
  const { unmount } = render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  unmount();
  expect(await runBeforeLeave()).toBeNull();
  expect(localStorage.getItem('held-test')).toBeNull();
});

test('a finished sale on the receipt screen is never parked', async () => {
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  function OrderStoreReady() {
    const outbox = useOutbox();
    return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
  }
  await withParkedCarts(async parkedCarts => {
    render(
      <SessionProvider>
        <OutboxProvider transportFor={() => ({ send: async () => ({ kind: 'retry', reason: 'network' }) })} storage={getRxStorageMemory()}>
          <OrderStoreReady />
          <SaleScreen {...props} parkedCarts={parkedCarts} />
        </OutboxProvider>
      </SessionProvider>,
    );
    await screen.findByText('Order store ready');
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
    const complete = screen.getByRole('button', { name: 'Complete sale' });
    fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '3.00' } });
    fireEvent.click(complete);
    await screen.findByTestId('receipt-order');
    await act(async () => { expect(await runBeforeLeave()).toBeNull(); });
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
}, 20_000);

test("an older screen unmounting does not clear a newer screen's handler", async () => {
  const { unmount } = render(<SaleScreen {...props} />);
  setBeforeLeave(async () => 'newer');
  unmount();
  expect(await runBeforeLeave()).toBe('newer');
});

test('clearBeforeLeave clears only its own handler', async () => {
  const a = async () => 'a'; const b = async () => 'b';
  setBeforeLeave(a);
  clearBeforeLeave(b);
  expect(await runBeforeLeave()).toBe('a');
  clearBeforeLeave(a);
  expect(await runBeforeLeave()).toBeNull();
});
