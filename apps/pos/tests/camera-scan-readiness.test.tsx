import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OnlineStatusContext } from '../lib/online/online-status';
import type { OnlineStatus } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { memoryStorage } from './memory-storage';

// v2 core.json pos_products.camera_scan_offline / camera_scan_engine_not_ready.
const OFFLINE = 'Offline — only products already on this device will scan.';
const SYNCING = 'Sync is still starting — some products may not be found yet.';

beforeEach(() => {
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
function openPanel(online: OnlineStatus, status: CatalogueViewProps['status']) {
  render(<OnlineStatusContext.Provider value={{ status: online }}><CatalogueView {...props} status={status} /></OnlineStatusContext.Provider>);
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
