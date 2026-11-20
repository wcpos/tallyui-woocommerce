import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

// v2's cart note row (monorepo pos/cart/note-row.tsx): the order note under the cart, pressed to open Order details.

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderTill() {
  render(
    <SessionProvider>
      <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
        storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
      <PortalHost />
    </SessionProvider>,
  );
  fireEvent.click(screen.getByText('Espresso'));
}

/** Types the note in Order details, opened from the foot's ⋮ menu, and closes the sheet. */
function typeNote(note: string) {
  fireEvent.click(screen.getByTestId('cart-foot-more'));
  fireEvent.click(within(screen.getByTestId('cart-foot-menu')).getByRole('menuitem', { name: 'Order details' }));
  fireEvent.change(screen.getByLabelText('Customer note'), { target: { value: note } });
  fireEvent.click(screen.getByTestId('order-details-close'));
  expect(screen.queryByTestId('order-details')).toBeNull();
}

test('a sale with a note shows the note row with the note text', () => {
  renderTill();
  typeNote('Leave at the door');
  expect(screen.getByTestId('cart-note-row').textContent).toBe('Leave at the door');
});

test('no note, or a whitespace-only note, shows no row', () => {
  renderTill();
  expect(screen.queryByTestId('cart-note-row')).toBeNull();
  typeNote('   ');
  expect(screen.queryByTestId('cart-note-row')).toBeNull();
});

test('pressing the note row opens Order details', () => {
  renderTill();
  typeNote('Leave at the door');
  fireEvent.click(screen.getByTestId('cart-note-row'));
  expect(screen.getByTestId('order-details')).toBeTruthy();
  expect((screen.getByLabelText('Customer note') as HTMLTextAreaElement).value).toBe('Leave at the door');
});
