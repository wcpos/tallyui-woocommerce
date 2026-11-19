// Scanning devices (WCPOS v2 settings/barcode-scanning/input-sources.tsx, hooks/barcodes/scan-hub-context.tsx): a WebHID
// scanner connected from Settings › Barcode scanning is saved on this device, reopens on the next start, and its scans
// reach whichever screen owns the scan, without the keyboard-wedge copy of the same physical scan.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { PortalHost } from '@tallyui/primitives';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { addScannerProfileCollection, type HidDeviceLike, type HidInputReportEventLike, type HidLike, type ScannerProfileCollection } from '@tallyui/pos';
import { BarcodeScanningSettings } from '../components/settings/barcode-scanning-settings';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { CatalogueContext } from '../lib/catalogue/catalogue-context';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { AppScanHub } from '../lib/scan/app-scan-hub';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { cartTabCount } from './phone-tabs-helpers';

const ESPRESSO = '2000000000015';
const DEVICE_KEY = 'hid-pos:1234:5678';

const tillProps: SaleScreenProps = {
  storeSettings: noTaxSettings, connector: createWooCommerceConnector(), currency: stores[0].currency,
  products: [products[0], products[1]], storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

/** A HID-POS scanner: `report(code)` sends one input report, `[length, ...ascii]`, as the device does. */
function fakeDevice() {
  let listener: ((event: HidInputReportEventLike) => void) | undefined;
  const device: HidDeviceLike & { listening(): boolean; report(code: string): void } = {
    productName: 'Counter scanner', vendorId: 1234, productId: 5678, collections: [{ usagePage: 140 }],
    open: async () => {}, close: async () => {},
    addEventListener: (_type, next) => { listener = next; },
    removeEventListener: (_type, next) => { if (listener === next) listener = undefined; },
    listening: () => !!listener,
    report: code => listener?.({ data: new DataView(Uint8Array.from([code.length, ...[...code].map(c => c.charCodeAt(0))]).buffer), reportId: 0 }),
  };
  return device;
}

/** navigator.hid as Chromium has it: the chooser answers only inside a click, and getDevices lists what was granted. */
function fakeHid(device: HidDeviceLike, { granted = false, answer }: { granted?: boolean; answer?: () => Promise<HidDeviceLike[]> } = {}) {
  let inClick = false;
  const listener = () => { inClick = true; queueMicrotask(() => { inClick = false; }); };
  window.addEventListener('click', listener, true);
  const hid: HidLike & { requests: number; release(): void } = {
    requests: 0,
    requestDevice: () => {
      hid.requests += 1;
      if (!inClick) return Promise.reject(new DOMException('Must be handling a user gesture to show a permission request.', 'NotAllowedError'));
      if (answer) return answer();
      granted = true;
      return Promise.resolve([device]);
    },
    getDevices: () => Promise.resolve(granted ? [device] : []),
    release: () => window.removeEventListener('click', listener, true),
  };
  return hid;
}

let db: RxDatabase | undefined;
let releaseHid: (() => void) | undefined;

async function scannerProfiles(): Promise<ScannerProfileCollection> {
  db = await createRxDatabase({ name: `scanner_profiles_${crypto.randomUUID()}`, multiInstance: false, storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  return addScannerProfileCollection(db);
}

function withHub(collection: ScannerProfileCollection, hid: (HidLike & { release(): void }) | undefined, children: ReactNode) {
  releaseHid = hid?.release;
  return <CatalogueContext.Provider value={{ catalogue: { scannerProfiles: collection } as never, products: [], status: 'ready' }}>
    <AppScanHub hid={hid}>{children}<PortalHost /></AppScanHub>
  </CatalogueContext.Provider>;
}

async function savedProfile(collection: ScannerProfileCollection) {
  await collection.insert({ deviceKey: DEVICE_KEY, name: '', connectionType: 'hid-pos', deviceName: 'Counter scanner', vendorId: 1234, productId: 5678 });
}

function wedge(code: string) {
  for (const key of [...code, 'Enter']) document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function Claimer({ onScan }: { onScan(code: string): void }) {
  useWedgeScanner(onScan, true);
  return null;
}

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(async () => {
  act(() => dismissToast());
  cleanup();
  releaseHid?.();
  releaseHid = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db?.remove();
  db = undefined;
});

test('connecting over USB saves one profile, shown Connected, and the button turns to Disconnect', async () => {
  const collection = await scannerProfiles();
  render(withHub(collection, fakeHid(fakeDevice()), <BarcodeScanningSettings />));
  expect(screen.getByTestId('scanner-row-direct').textContent).toContain('None');
  fireEvent.click(screen.getByTestId('scanner-advanced-trigger'));
  fireEvent.click(await screen.findByTestId('hid-connect-button'));
  await waitFor(() => expect(screen.getByTestId('scanner-profile-status').textContent).toBe('Connected'));
  expect(screen.getByTestId('hid-connect-button').textContent).toBe('Disconnect USB scanner');
  expect(screen.getByTestId('scanner-profile-row').textContent).toContain('Counter scanner');
  expect(screen.getByTestId('scanner-profile-row').textContent).toContain('HID POS · 1234:5678');
  expect(screen.getByTestId('scanner-registered-hint')).not.toBeNull();
  expect(screen.queryByTestId('scanner-no-setup-needed')).toBeNull();
  expect((await collection.find().exec()).map(doc => doc.deviceKey)).toEqual([DEVICE_KEY]);
});

test('a saved HID scanner reopens on mount and its scan adds the product to the till\'s cart', async () => {
  const collection = await scannerProfiles();
  await savedProfile(collection);
  const device = fakeDevice();
  render(withHub(collection, fakeHid(device, { granted: true }), <SaleScreen {...tillProps} />));
  await waitFor(() => expect(device.listening()).toBe(true));
  expect(cartTabCount()).toBe('New');
  act(() => device.report(ESPRESSO));
  expect(cartTabCount()).toBe('1');
});

test('while a later screen claims the scan, a device scan does not ring up on the till', async () => {
  const collection = await scannerProfiles();
  await savedProfile(collection);
  const device = fakeDevice();
  const hid = fakeHid(device, { granted: true });
  const onScan = vi.fn();
  const { rerender } = render(withHub(collection, hid, <SaleScreen {...tillProps} />));
  await waitFor(() => expect(device.listening()).toBe(true));
  rerender(withHub(collection, hid, <><SaleScreen {...tillProps} /><Claimer onScan={onScan} /></>));
  act(() => device.report(ESPRESSO));
  expect(onScan).toHaveBeenCalledWith(ESPRESSO);
  expect(cartTabCount()).toBe('New');
});

test('a wedge copy of a device scan within 500 ms adds no second item; the same device scanning twice adds two', async () => {
  // Only the clock is fake: the device's own 1200 ms same-code cooldown reads it too.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
  const collection = await scannerProfiles();
  await savedProfile(collection);
  const device = fakeDevice();
  render(withHub(collection, fakeHid(device, { granted: true }), <SaleScreen {...tillProps} />));
  await waitFor(() => expect(device.listening()).toBe(true));
  act(() => device.report(ESPRESSO));
  expect(cartTabCount()).toBe('1');
  vi.setSystemTime(new Date('2026-11-19T10:00:00.100Z'));
  act(() => wedge(ESPRESSO));
  expect(cartTabCount()).toBe('1');
  vi.setSystemTime(new Date('2026-11-19T10:00:01.400Z'));
  act(() => device.report(ESPRESSO));
  expect(cartTabCount()).toBe('2');
});

test('Remove in the row\'s menu deletes the profile and the row goes', async () => {
  const collection = await scannerProfiles();
  await savedProfile(collection);
  render(withHub(collection, fakeHid(fakeDevice()), <BarcodeScanningSettings />));
  expect((await screen.findByTestId('scanner-profile-status')).textContent).toBe('Not connected');
  fireEvent.click(screen.getByTestId('scanner-profile-menu'));
  fireEvent.click(await screen.findByTestId('scanner-profile-delete'));
  await waitFor(() => expect(screen.queryByTestId('scanner-profile-row')).toBeNull());
  expect(await collection.find().exec()).toEqual([]);
  expect(screen.getByTestId('scanner-no-setup-needed')).not.toBeNull();
});

test('without WebHID or Web Serial there is no Direct connection row and no connect buttons', async () => {
  const collection = await scannerProfiles();
  render(withHub(collection, undefined, <BarcodeScanningSettings />));
  expect(screen.getByTestId('scanner-setup-guide-link')).not.toBeNull();
  expect(screen.queryByTestId('scanner-row-direct')).toBeNull();
  expect(screen.queryByTestId('hid-connect-button')).toBeNull();
  expect(screen.queryByTestId('serial-connect-button')).toBeNull();
});

test('a chooser closed by the cashier shows no error toast; a refused connect shows one', async () => {
  const collection = await scannerProfiles();
  let answer = () => Promise.reject(new DOMException('No device selected.', 'NotFoundError'));
  const hid = fakeHid(fakeDevice(), { answer: () => answer() });
  render(withHub(collection, hid, <BarcodeScanningSettings />));
  fireEvent.click(screen.getByTestId('scanner-advanced-trigger'));
  fireEvent.click(await screen.findByTestId('hid-connect-button'));
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  expect(hid.requests).toBe(1);
  expect(getToasts()).toEqual([]);
  answer = () => Promise.reject(new DOMException('Failed to open the device.', 'NetworkError'));
  fireEvent.click(screen.getByTestId('hid-connect-button'));
  await waitFor(() => expect(getToasts()).toEqual([
    expect.objectContaining({ type: 'error', title: 'Couldn’t connect the scanner', description: 'Failed to open the device.' }),
  ]));
  expect(hid.requests).toBe(2);
});
