import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StorageHealth } from '@tallyui/database';
import { BehaviorSubject } from 'rxjs';
import { CatalogueView, type CatalogueViewProps } from '../components/catalogue-view';
import { CatalogueContext } from '../lib/catalogue/catalogue-context';
import type { Catalogue } from '../lib/catalogue/start-catalogue';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OnlineStatusContext } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { classesOf } from './classes-of';
import { memoryStorage } from './memory-storage';

vi.mock('@tallyui/database', async importOriginal => ({
  ...(await importOriginal<typeof import('@tallyui/database')>()),
  getStorageHealth: vi.fn(),
}));

const TITLE = 'Local database unavailable — scanning, checkout, saving and voiding are blocked until the app is reloaded.';
const fakeDb = {};
let health: BehaviorSubject<StorageHealth>;
const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {}, onScan: () => 'keep',
};

beforeEach(async () => {
  health = new BehaviorSubject<StorageHealth>({ status: 'ok', stalledWrites: 0 });
  const { getStorageHealth } = await import('@tallyui/database');
  vi.mocked(getStorageHealth).mockImplementation(db => (db === (fakeDb as never) ? health : undefined));
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderCatalogue(locked?: CatalogueViewProps['locked'], viewProps = props) {
  render(<OnlineStatusContext.Provider value={{ status: 'online-website-available' }}>
    <CatalogueContext.Provider value={{ catalogue: { db: fakeDb } as unknown as Catalogue, products: [], status: 'ready' }}>
      <CatalogueView {...viewProps} locked={locked} />
    </CatalogueContext.Provider>
  </OnlineStatusContext.Provider>);
}

test('healthy storage shows no outage notice', () => {
  renderCatalogue();
  expect(screen.queryByTestId('storage-outage-banner')).toBeNull();
});

test.each(['stalled', 'dead'] as const)("stalled or dead storage shows v2's red notice in the products column (%s)", status => {
  health.next({ status, stalledWrites: 1 });
  renderCatalogue('closed');
  const banner = screen.getByTestId('storage-outage-banner');
  expect([screen.queryByTestId('scan-outage-view-status'), screen.getByTestId('storage-outage-reload')]).toEqual([null, expect.anything()]);
  expect(screen.getByTestId('storage-outage-banner-title').textContent).toBe(TITLE);
  expect(banner.getAttribute('role')).toBe('alert');
  expect(banner.getAttribute('aria-live')).toBe('assertive');
  expect(classesOf('storage-outage-banner')).toEqual(expect.arrayContaining(['border-destructive/45', 'bg-destructive/10']));
  expect(screen.getByTestId('catalogue-search-slot').contains(banner)).toBe(true);
  expect(banner.compareDocumentPosition(screen.getByTestId('products-locked-notice')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('View status opens the database health page', () => {
  const open = vi.fn();
  health.next({ status: 'dead', stalledWrites: 1 });
  renderCatalogue(undefined, { ...props, onOpenDatabaseHealth: open });
  fireEvent.click(screen.getByTestId('scan-outage-view-status'));
  expect(open).toHaveBeenCalledTimes(1);
});

test('Reload the app reloads on the web', () => {
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  health.next({ status: 'dead', stalledWrites: 1 });
  renderCatalogue();
  fireEvent.click(screen.getByTestId('storage-outage-reload'));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('storage recovering hides the notice', () => {
  health.next({ status: 'dead', stalledWrites: 1 });
  renderCatalogue();
  expect(screen.queryByTestId('storage-outage-banner')).not.toBeNull();
  act(() => health.next({ status: 'ok', stalledWrites: 0 }));
  expect(screen.queryByTestId('storage-outage-banner')).toBeNull();
});
