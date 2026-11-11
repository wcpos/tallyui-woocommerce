import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { OfflineBadge } from '../components/offline-badge';
import { OnlineStatusContext } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

test('renders nothing while the store answers', () => {
  render(<OfflineBadge testID="badge" />);
  expect(screen.queryByTestId('badge')).toBeNull();
});

test.each(['offline', 'online-website-unavailable'] as const)('reads Offline for %s', status => {
  render(<OnlineStatusContext.Provider value={{ status }}><OfflineBadge testID="badge" /></OnlineStatusContext.Provider>);
  expect(screen.getByTestId('badge').textContent).toBe('Offline');
});

test('the POS bar\'s pill reads Offline; with hideBar the catalogue draws no bar and no pill', () => {
  const { rerender } = render(
    <OnlineStatusContext.Provider value={{ status: 'offline' }}><CatalogueView {...props} /></OnlineStatusContext.Provider>,
  );
  expect(screen.getByTestId('register-bar-pill').textContent).toBe('Offline');
  rerender(
    <OnlineStatusContext.Provider value={{ status: 'offline' }}><CatalogueView {...props} hideBar /></OnlineStatusContext.Provider>,
  );
  expect(screen.queryByTestId('register-bar-shell')).toBeNull();
  expect(screen.queryByTestId('register-bar-pill')).toBeNull();
});
