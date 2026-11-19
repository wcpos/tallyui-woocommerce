import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { PortalHost } from '@tallyui/primitives';
import type { CustomerSummary } from '@tallyui/pos';
import { GeneralSettings } from '../components/settings/general-settings';
import { DEFAULT_CUSTOMER_KEY, useDefaultCustomerSetting } from '../lib/customers/default-customer';
import { memoryStorage } from './memory-storage';

vi.mock('../lib/register/register-context', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/register/register-context')>(),
  useRegister: () => null,
}));

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const site = 'https://shop.example/';
const otherSite = 'https://other.example/';
// The store's own default is Guest; this device overrides it with Anna Bell.
const store = { id: 1, name: 'Corner Café', currency: 'USD', locale: 'en_US', defaultCustomerId: 0, defaultCustomerIsCashier: false };
const anna = { id: '3', name: 'Anna Bell' };
const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
const people: Record<number, CustomerSummary> = { 3: anna, 7: gee };

function Harness() {
  const [setting, save] = useDefaultCustomerSetting(site, store);
  const source = { search: vi.fn().mockResolvedValue([gee]), create: vi.fn().mockResolvedValue(gee) };
  return <GeneralSettings store={store} siteHome={site} defaultCustomer={{
    setting: setting!, customer: people[setting!.customerId] ?? null, source, onChange: save,
  }} />;
}

function renderWithDeviceDefault() {
  localStorage.setItem(DEFAULT_CUSTOMER_KEY, JSON.stringify({
    [site]: { customerId: 3, isCashier: false }, [otherSite]: { customerId: 9, isCashier: true },
  }));
  render(<><Harness /><PortalHost /></>);
}
const stored = () => JSON.parse(localStorage.getItem(DEFAULT_CUSTOMER_KEY) ?? '{}');
const select = () => within(screen.getByTestId('settings-general-default_customer')).getByTestId('settings-general-default_customer-select');
const openConfirm = () => {
  fireEvent.click(screen.getByTestId('settings-general-restore-server'));
  expect(screen.getByText('Restore server settings?')).not.toBeNull();
};

test('restore plus confirm drops the device default customer and shows the store\'s, with Restored', async () => {
  renderWithDeviceDefault();
  expect(select().textContent).toContain('Anna Bell');
  // A customer picked on this visit gives way to the store's too.
  fireEvent.click(select());
  fireEvent.change(screen.getByPlaceholderText('Search Customers'), { target: { value: 'gee' } });
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  expect(stored()[site]).toEqual({ customerId: 7, isCashier: false });
  expect(select().textContent).toContain('Gee Four');
  openConfirm();
  fireEvent.click(screen.getByTestId('settings-general-restore-confirm'));
  expect(stored()).toEqual({ [otherSite]: { customerId: 9, isCashier: true } });
  expect(select().textContent).toContain('Guest');
  expect(select().textContent).not.toContain('Gee Four');
  expect(screen.getByTestId('saved-restore').textContent).toBe('Restored');
  expect(screen.queryByText('Restore server settings?')).toBeNull();
  expect(screen.queryByTestId('settings-general-restore-failed')).toBeNull();
});

test('cancel keeps the device default customer', () => {
  renderWithDeviceDefault();
  const before = localStorage.getItem(DEFAULT_CUSTOMER_KEY);
  openConfirm();
  fireEvent.click(screen.getByTestId('settings-general-restore-cancel'));
  expect(screen.queryByText('Restore server settings?')).toBeNull();
  expect(localStorage.getItem(DEFAULT_CUSTOMER_KEY)).toBe(before);
  expect(select().textContent).toContain('Anna Bell');
  expect(screen.queryByTestId('saved-restore')).toBeNull();
});

test('restore leaves the session, the roster and a held cart', () => {
  const kept = {
    'tallywoo.session': '{"site":"s"}', 'tallywoo.cashiers': '{"a":1}',
    'tallywoo.held-cart.x': 'cart-1', 'tallywoo.register_sessions': 'false',
  };
  for (const [key, value] of Object.entries(kept)) localStorage.setItem(key, value);
  renderWithDeviceDefault();
  openConfirm();
  fireEvent.click(screen.getByTestId('settings-general-restore-confirm'));
  expect(stored()[site]).toBeUndefined();
  for (const [key, value] of Object.entries(kept)) expect(localStorage.getItem(key)).toBe(value);
});

test('a clear that throws shows the failure line, and Try again reopens the confirm', () => {
  renderWithDeviceDefault();
  const setItem = localStorage.setItem;
  vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
    if (key === DEFAULT_CUSTOMER_KEY) throw new Error('QuotaExceededError');
    setItem(key, value);
  });
  openConfirm();
  fireEvent.click(screen.getByTestId('settings-general-restore-confirm'));
  expect(screen.getByTestId('settings-general-restore-failed').textContent).toBe("Couldn't reach the store");
  expect(screen.queryByTestId('saved-restore')).toBeNull();
  expect(select().textContent).toContain('Anna Bell');
  expect(screen.queryByText('Restore server settings?')).toBeNull();
  fireEvent.click(screen.getByTestId('settings-general-restore-retry'));
  expect(screen.getByText('Restore server settings?')).not.toBeNull();
});

test('the row sits above Clear All Local Data in v2 copy', () => {
  renderWithDeviceDefault();
  const zone = screen.getByTestId('settings-general-restore-server-zone');
  expect(zone.nextElementSibling).toBe(screen.getByTestId('settings-general-clear-local-data-zone'));
  expect(screen.getByTestId('settings-general-restore-server-body').textContent)
    .toBe('Copied from your WooCommerce store; restoring overwrites local changes.');
  expect(screen.getByTestId('settings-general-restore-server').textContent).toBe('Restore server settings');
  openConfirm();
  expect(screen.getByTestId('settings-general-restore-description').textContent)
    .toBe('These settings were copied from your WooCommerce store. Restoring will overwrite local changes with the server’s values.');
  expect(screen.getByTestId('settings-general-restore-confirm').textContent).toBe('Restore server settings');
});
