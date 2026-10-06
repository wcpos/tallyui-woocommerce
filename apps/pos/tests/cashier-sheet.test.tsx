import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function withParkedCarts(run: (parkedCarts: ParkedCartCollection) => Promise<void>) {
  const db = await createRxDatabase({
    name: `cashier_${crypto.randomUUID()}`, multiInstance: false,
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

test('the sheet lists the other cashiers and switches to the chosen one', async () => {
  await withParkedCarts(async parkedCarts => {
    const onSwitchCashier = vi.fn(async () => null);
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    expect(within(screen.getByTestId('user-sheet')).getByText('Switch to Sam')).not.toBeNull();
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(() => expect(onSwitchCashier).toHaveBeenCalledWith('b'));
    expect(screen.queryByTestId('user-sheet')).toBeNull();
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
});

test('switching with a cart parks it under the held-cart key before switching', async () => {
  await withParkedCarts(async parkedCarts => {
    const onSwitchCashier = vi.fn(async () => {
      const docs = await parkedCarts.find().exec();
      expect(docs).toHaveLength(1);
      expect(docs[0].toJSON()).toMatchObject({ lines: [{ name: 'Espresso', quantity: 1 }] });
      expect(localStorage.getItem('held-test')).toBe(docs[0].id);
      return null;
    });
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(() => expect(onSwitchCashier).toHaveBeenCalledWith('b'));
    await onSwitchCashier.mock.results[0].value;
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull());
    expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  });
});

test('a failed switch shows the message and puts the cart back', async () => {
  await withParkedCarts(async parkedCarts => {
    const error = 'Could not switch cashier. Check the connection and try again.';
    const onSwitchCashier = vi.fn(async () => error);
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(() => expect(onSwitchCashier).toHaveBeenCalledWith('b'));
    await screen.findByText(error);
    await screen.findByRole('button', { name: 'Remove Espresso' });
    await waitFor(async () => expect(await parkedCarts.find().exec()).toEqual([]));
    expect(localStorage.getItem('held-test')).toBeNull();
    expect(screen.getByText(error)).not.toBeNull();
  });
});

test('a held cart comes back when its cashier\'s screen mounts once the catalogue is ready', async () => {
  await withParkedCarts(async parkedCarts => {
    const cart = await parkedCarts.insert({
      id: crypto.randomUUID(), parkedAt: new Date().toISOString(), itemCount: 2, totalMinor: 600,
      lines: [{ productId: '80', variantId: '80', name: 'Espresso', quantity: 2, discounts: [] }], orderDiscounts: [],
    });
    localStorage.setItem('held-test', cart.id);
    const view = render(<SaleScreen {...props} parkedCarts={parkedCarts} status="syncing" />);
    await screen.findByRole('button', { name: 'Parked (1)' });
    expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
    expect(localStorage.getItem('held-test')).toBe(cart.id);
    expect(await parkedCarts.find().exec()).toHaveLength(1);
    view.rerender(<SaleScreen {...props} parkedCarts={parkedCarts} status="ready" />);
    await screen.findByText('$3.00 × 2');
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(localStorage.getItem('held-test')).toBeNull();
  });
}, 20_000);

test('Another account holds the cart and starts the sign-in', async () => {
  await withParkedCarts(async parkedCarts => {
    const onAddCashier = vi.fn();
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onAddCashier={onAddCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-another-account'));
    await waitFor(() => expect(onAddCashier).toHaveBeenCalledTimes(1));
    const docs = await parkedCarts.find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].toJSON()).toMatchObject({ lines: [{ name: 'Espresso', quantity: 1 }] });
    expect(localStorage.getItem('held-test')).toBe(docs[0].id);
    expect(screen.queryByTestId('user-sheet')).toBeNull();
  });
});

test('the cashier button is disabled while taking payment', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    // At 900px the cart is already open alongside the catalogue.
    fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
    const button = screen.getByTestId('register-bar-avatar');
    expect(button.getAttribute('aria-disabled') === 'true' || button.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Finish or cancel the payment first.')).not.toBeNull();
    fireEvent.click(button);
    expect(screen.queryByTestId('user-sheet')).toBeNull();
  });
});

test('Sign out in the sheet calls onSignOut', async () => {
  await withParkedCarts(async parkedCarts => {
    const onSignOut = vi.fn();
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSignOut={onSignOut} />);
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('user-sheet')).toBeNull();
  });
});

test('without onSwitchCashier the header keeps the cashier name and Sign out button', async () => {
  await withParkedCarts(async parkedCarts => {
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={undefined} />);
    expect(screen.getByText('Cashier: Paul')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).not.toBeNull();
    expect(screen.queryByTestId('register-bar-avatar')).toBeNull();
  });
});

test('a cart held for a switch that is still pending stays parked on the same screen', async () => {
  await withParkedCarts(async parkedCarts => {
    let resolveSwitch!: (result: string | null) => void;
    const pending = new Promise<string | null>(resolve => { resolveSwitch = resolve; });
    const onSwitchCashier = vi.fn(() => pending);
    render(<SaleScreen {...props} parkedCarts={parkedCarts} onSwitchCashier={onSwitchCashier} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByTestId('register-bar-avatar'));
    fireEvent.click(screen.getByTestId('user-sheet-user-b'));
    await waitFor(async () => expect(await parkedCarts.find().exec()).toHaveLength(1));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    const docs = await parkedCarts.find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].toJSON()).toMatchObject({ lines: [{ name: 'Espresso', quantity: 1 }] });
    expect(localStorage.getItem('held-test')).toBe(docs[0].id);
    expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
    expect(onSwitchCashier).toHaveBeenCalledWith('b');
    await act(async () => { resolveSwitch(null); await pending; });
  });
});
