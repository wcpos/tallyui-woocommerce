import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { PortalHost } from '@tallyui/primitives';
import { ClearLocalData } from '../components/settings/clear-local-data';
import { GeneralSettings } from '../components/settings/general-settings';
import { useOutbox } from '../lib/sale/outbox-context';
import { dismissToast, getToasts } from '../lib/toast/toast';

vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: vi.fn() }));
beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.mocked(useOutbox).mockReturnValue({ enabled: false });
});
afterEach(() => { cleanup(); dismissToast(); vi.restoreAllMocks(); });

const row = 'Everything stored on this device is deleted and downloaded again from your server.';
const unknown = 'The app could not check for changes waiting to be sent, so this may include completed sales that never reached your server. They cannot be recovered.';
function setOutbox(pending: number, rejected?: number, orders: object | null = {}) {
  vi.mocked(useOutbox).mockReturnValue({
    enabled: true, orders, state: { pending, rejected, sending: false },
  } as ReturnType<typeof useOutbox>);
}
function openConfirm(props: { schedule?: () => boolean; reload?: () => void } = {}) {
  render(<><ClearLocalData {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('settings-general-clear-local-data'));
}
const description = () => screen.getByTestId('clear-all-local-data-description').textContent;

test('General ends with the Clear All Local Data row in v2 copy', () => {
  render(<><GeneralSettings store={{ id: 1, name: 'Corner Café', currency: 'USD', locale: 'en_US' }}
    siteHome="https://shop.example/" /><PortalHost /></>);
  expect(screen.getByTestId('screen-settings-general').lastElementChild).toBe(screen.getByTestId('settings-general-clear-local-data-zone'));
  expect(screen.getByTestId('settings-general-clear-local-data-body').textContent).toBe(row);
  expect(screen.getByTestId('settings-general-clear-local-data').textContent).toBe('Clear All Local Data');
});

test('the confirm counts pending and rejected sales as unsent', () => {
  setOutbox(2, 1);
  openConfirm();
  expect(description()).toBe(`3 changes on this device have never reached your server and will be permanently lost. They may include completed sales that exist only on this device. ${row}`);
  expect(screen.getByText('Clear all local data?')).not.toBeNull();
});

test('one unsent sale reads in the singular', () => {
  setOutbox(1);
  openConfirm();
  expect(description()).toBe(`1 change on this device has never reached your server and will be permanently lost. It may be a completed sale that exists only on this device. ${row}`);
});

test('an empty outbox says the server already has the sales', () => {
  setOutbox(0);
  openConfirm();
  expect(description()).toBe(`Nothing is waiting to be sent, so your server already has your sales. ${row}`);
});

test('an outbox that is not open warns that the count is unknown', () => {
  openConfirm();
  expect(description()).toBe(`${unknown} ${row}`);
  cleanup();
  setOutbox(0, undefined, null);
  openConfirm();
  expect(description()).toBe(`${unknown} ${row}`);
});

test('Clear all local data schedules the reset, then reloads', () => {
  const schedule = vi.fn(() => true);
  const reload = vi.fn();
  openConfirm({ schedule, reload });
  fireEvent.click(screen.getByTestId('clear-all-local-data-confirm'));
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(schedule.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
  expect(screen.queryByTestId('clear-all-local-data-description')).toBeNull();
});

test('Cancel closes the confirm and clears nothing', () => {
  const schedule = vi.fn(() => true);
  const reload = vi.fn();
  openConfirm({ schedule, reload });
  fireEvent.click(screen.getByTestId('clear-all-local-data-cancel'));
  expect(schedule).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  expect(screen.queryByTestId('clear-all-local-data-description')).toBeNull();
});

test('a reset that cannot be scheduled shows the failure and does not reload', () => {
  const schedule = vi.fn(() => false);
  const reload = vi.fn();
  openConfirm({ schedule, reload });
  fireEvent.click(screen.getByTestId('clear-all-local-data-confirm'));
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  expect(getToasts()).toEqual([expect.objectContaining({
    title: 'Could not clear local data. Close the app completely, open it again, and retry.', type: 'error',
  })]);
});
