import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Text } from '@tallyui/components';
import { PortalHost } from '@tallyui/primitives';
import { CartSettingsDialog } from '../components/cart-settings';
import { ReceiptPrintSheet } from '../components/receipt-print-sheet';
import { claimReceiptAutoPrint } from '../lib/receipts/print-receipt';
import { loadReceiptSettings, RECEIPT_SETTINGS_KEY, saveReceiptSettings, useReceiptSettings } from '../lib/receipts/receipt-settings';
import { CART_SETTINGS_DEFAULTS } from '../lib/sale/cart-settings';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const AUTO_PRINT = 'Automatically print receipt after checkout';

function sheet(props: { orderId: string | null; autoPrint?: boolean }) {
  return <ReceiptPrintSheet {...props}><Text>Receipt body</Text></ReceiptPrintSheet>;
}

function openCartSettings() {
  render(<><CartSettingsDialog position="left" onPositionChange={() => {}} settings={CART_SETTINGS_DEFAULTS} onSettingsChange={() => {}} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  return () => screen.getByRole('switch', { name: AUTO_PRINT });
}

test('loadReceiptSettings falls back to off for missing, broken or unreadable storage', () => {
  const storage = memoryStorage();
  expect(loadReceiptSettings(storage)).toEqual({ autoPrint: false });
  storage.setItem(RECEIPT_SETTINGS_KEY, 'not json');
  expect(loadReceiptSettings(storage).autoPrint).toBe(false);
  storage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":"yes"}');
  expect(loadReceiptSettings(storage).autoPrint).toBe(false);
  const unreadable = { ...memoryStorage(), getItem: () => { throw new Error('denied'); } } as Storage;
  expect(loadReceiptSettings(unreadable).autoPrint).toBe(false);
  storage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":true}');
  expect(loadReceiptSettings(storage).autoPrint).toBe(true);
});

test('saveReceiptSettings writes JSON and ignores a refusing storage', () => {
  saveReceiptSettings({ autoPrint: true });
  expect(localStorage.getItem(RECEIPT_SETTINGS_KEY)).toBe('{"autoPrint":true}');
  const refusing = { ...memoryStorage(), setItem: () => { throw new Error('quota'); } } as Storage;
  expect(() => saveReceiptSettings({ autoPrint: false }, refusing)).not.toThrow();
});

test('useReceiptSettings follows a save made elsewhere', () => {
  function Probe() {
    const [settings] = useReceiptSettings();
    return <span data-testid="probe">{settings.autoPrint ? 'on' : 'off'}</span>;
  }
  render(<Probe />);
  expect(screen.getByTestId('probe').textContent).toBe('off');
  act(() => saveReceiptSettings({ autoPrint: true }));
  expect(screen.getByTestId('probe').textContent).toBe('on');
});

test('claimReceiptAutoPrint grants one attempt per sale', () => {
  const id = crypto.randomUUID();
  expect(claimReceiptAutoPrint(id)).toBe(true);
  expect(claimReceiptAutoPrint(id)).toBe(false);
  expect(claimReceiptAutoPrint(crypto.randomUUID())).toBe(true);
});

test('ReceiptPrintSheet with autoPrint prints once with the page rule and not again on remount', () => {
  const orderId = crypto.randomUUID();
  let pageAtPrint = false;
  const print = vi.spyOn(window, 'print').mockImplementation(() => {
    window.dispatchEvent(new Event('beforeprint'));
    pageAtPrint = document.head.querySelector('style[data-receipt-page]') !== null;
    window.dispatchEvent(new Event('afterprint'));
  });
  const { unmount } = render(sheet({ orderId, autoPrint: true }));
  expect(print).toHaveBeenCalledTimes(1);
  expect(pageAtPrint).toBe(true);
  expect(screen.getByTestId('receipt-print-again')).not.toBeNull();
  unmount();
  render(sheet({ orderId, autoPrint: true }));
  expect(print).toHaveBeenCalledTimes(1);
});

test('ReceiptPrintSheet does not print without autoPrint or without an order', () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const { unmount } = render(sheet({ orderId: crypto.randomUUID() }));
  unmount();
  render(sheet({ orderId: null, autoPrint: true }));
  expect(print).not.toHaveBeenCalled();
});

test('a failed auto print shows the error and Print again', () => {
  vi.spyOn(window, 'print').mockImplementation(() => { throw new Error('blocked'); });
  render(sheet({ orderId: crypto.randomUUID(), autoPrint: true }));
  expect(screen.getByTestId('print-sheet-error').textContent).toBe('The receipt did not print: blocked');
  expect(screen.getByTestId('receipt-print-again')).not.toBeNull();
});

test('the Cart Settings switch saves auto print and shows the hint', () => {
  const autoPrint = openCartSettings();
  expect(autoPrint().getAttribute('aria-checked')).toBe('false');
  expect(screen.queryByTestId('cart-setting-auto-print-hint')).toBeNull();
  fireEvent.click(autoPrint());
  expect(localStorage.getItem(RECEIPT_SETTINGS_KEY)).toBe('{"autoPrint":true}');
  expect(autoPrint().getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('cart-setting-auto-print-hint').textContent)
    .toBe('Without a receipt printer, the print dialog opens after each sale.');
});

test('Restore Default Settings turns auto print off', () => {
  localStorage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":true}');
  const autoPrint = openCartSettings();
  expect(autoPrint().getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByTestId('ui-settings-restore-defaults'));
  expect(localStorage.getItem(RECEIPT_SETTINGS_KEY)).toBe('{"autoPrint":false}');
  expect(autoPrint().getAttribute('aria-checked')).toBe('false');
});
