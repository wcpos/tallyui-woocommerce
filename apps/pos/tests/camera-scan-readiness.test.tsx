import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StorageHealth } from '@tallyui/database';
import { BehaviorSubject } from 'rxjs';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CatalogueContext } from '../lib/catalogue/catalogue-context';
import type { Catalogue } from '../lib/catalogue/start-catalogue';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OnlineStatusContext } from '../lib/online/online-status';
import type { OnlineStatus } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { memoryStorage } from './memory-storage';

vi.mock('@tallyui/database', async importOriginal => ({
  ...(await importOriginal<typeof import('@tallyui/database')>()),
  getStorageHealth: vi.fn(),
}));

// v2 core.json pos_products.camera_scan_offline / camera_scan_engine_not_ready.
const OFFLINE = 'Offline — only products already on this device will scan.';
const STORAGE = 'Local database unavailable — reload the app to restore scanning.';
const SYNCING = 'Sync is still starting — some products may not be found yet.';

const fakeDb = {};
let health: BehaviorSubject<StorageHealth>;

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

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {}, onScan: () => 'keep',
};

// TallyUI's real CameraScannerPanel: the note is its own `camera-scanner-readiness` line under the viewfinder.
function openPanel(online: OnlineStatus, status: CatalogueViewProps['status'], db?: object) {
  const view = <OnlineStatusContext.Provider value={{ status: online }}><CatalogueView {...props} status={status} /></OnlineStatusContext.Provider>;
  render(db ? <CatalogueContext.Provider value={{ catalogue: { db } as unknown as Catalogue, products: [], status }}>{view}</CatalogueContext.Provider> : view);
  fireEvent.click(screen.getByTestId('camera-scan-button'));
  expect(screen.getByTestId('camera-scanner-panel')).not.toBeNull();
  return screen.queryByTestId('camera-scanner-readiness')?.textContent ?? null;
}

test('offline: the open camera panel shows "Offline — only products already on this device will scan."', () => {
  expect(openPanel('offline', 'ready')).toBe(OFFLINE);
});

test.each(['starting', 'syncing'] as const)('%s: the panel shows "Sync is still starting — some products may not be found yet."', status => {
  expect(openPanel('online-website-available', status)).toBe(SYNCING);
});

test('offline while syncing: the offline note wins', () => {
  expect(openPanel('offline', 'syncing')).toBe(OFFLINE);
});

test.each(['online-website-available', 'online-website-unavailable'] as const)('%s with the catalogue ready: no readiness note', online => {
  expect(openPanel(online, 'ready')).toBeNull();
});

test('storage stalled: the panel shows "Local database unavailable — reload the app to restore scanning."', () => {
  health.next({ status: 'stalled', stalledWrites: 1 });
  expect(openPanel('online-website-available', 'ready', fakeDb)).toBe(STORAGE);
});

test('storage dead while offline and syncing: the storage note wins', () => {
  health.next({ status: 'dead', stalledWrites: 3 });
  expect(openPanel('offline', 'syncing', fakeDb)).toBe(STORAGE);
});

test('storage recovers: the note clears when health returns to ok', () => {
  health.next({ status: 'dead', stalledWrites: 3 });
  expect(openPanel('online-website-available', 'ready', fakeDb)).toBe(STORAGE);
  act(() => health.next({ status: 'ok', stalledWrites: 0 }));
  expect(screen.queryByTestId('camera-scanner-readiness')).toBeNull();
});

test('no storage watchdog: offline keeps the offline note', () => {
  expect(openPanel('offline', 'ready', {})).toBe(OFFLINE);
});
