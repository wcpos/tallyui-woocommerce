import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { PortalHost } from '@tallyui/primitives';
import { ClearLocalData } from '../components/settings/clear-local-data';
import { GeneralSettings } from '../components/settings/general-settings';
import { checkLocalData, type LocalDataCheck } from '../lib/local-data-check';
import { useOutbox } from '../lib/sale/outbox-context';
import { dismissToast, getToasts } from '../lib/toast/toast';

vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: vi.fn() }));
vi.mock('../lib/local-data-check', () => ({ checkLocalData: vi.fn() }));
beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.mocked(useOutbox).mockReturnValue({ enabled: false });
});
afterEach(() => { cleanup(); dismissToast(); vi.restoreAllMocks(); });

const row = 'Products, customers and orders are downloaded again from your server.';
const clean: LocalDataCheck = { unsent: 0, localOnly: 0, unchecked: [] };
async function openConfirm(props: { schedule?: () => boolean; reload?: () => void; check?: LocalDataCheck } = {}) {
  const result = props.check ?? clean;
  render(<><ClearLocalData schedule={props.schedule} reload={props.reload} check={async () => result} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('settings-general-clear-local-data'));
  await screen.findByTestId('clear-all-local-data-description');
}
const description = () => screen.getByTestId('clear-all-local-data-description').textContent;

test('General ends with the Clear All Local Data row in v2 copy', () => {
  render(<><GeneralSettings store={{ id: 1, name: 'Corner Café', currency: 'USD', locale: 'en_US' }}
    siteHome="https://shop.example/" /><PortalHost /></>);
  expect(screen.getByTestId('screen-settings-general').lastElementChild).toBe(screen.getByTestId('settings-general-clear-local-data-zone'));
  expect(screen.getByTestId('settings-general-clear-local-data-body').textContent).toBe(row);
  expect(screen.getByTestId('settings-general-clear-local-data').textContent).toBe('Clear All Local Data');
});

test('the confirm counts unsent changes across every cashier', async () => {
  await openConfirm({ check: { unsent: 3, localOnly: 0, unchecked: [] } });
  expect(description()).toBe(`3 changes on this device have never reached your server and will be permanently lost. They may include completed sales that exist only on this device. ${row}`);
  expect(screen.getByText('Clear all local data?')).not.toBeNull();
});

test('one unsent sale reads in the singular', async () => {
  await openConfirm({ check: { unsent: 1, localOnly: 0, unchecked: [] } });
  expect(description()).toBe(`1 change on this device has never reached your server and will be permanently lost. It may be a completed sale that exists only on this device. ${row}`);
});

test('nothing unsent says the server already has the sales', async () => {
  await openConfirm();
  expect(description()).toBe(`Nothing is waiting to be sent, so your server already has your sales. ${row}`);
});

test('a database that could not be checked is named in place of "Nothing is waiting"', async () => {
  await openConfirm({ check: { unsent: 0, localOnly: 0, unchecked: ['Corner Café · Ann'] } });
  expect(description()).toBe(`The app could not check Corner Café · Ann for changes waiting to be sent, so this may include completed sales that never reached your server. They cannot be recovered. ${row}`);
});

test('till sessions, cash counts and closures are counted as deleted for good', async () => {
  await openConfirm({ check: { unsent: 0, localOnly: 5, unchecked: [] } });
  expect(description()).toBe(`Nothing is waiting to be sent, so your server already has your sales. Till sessions, cash counts and closures on this device are not stored on your server and will be deleted (5 records). ${row}`);
});

test('the button is disabled while the check runs, and the confirm opens when it ends', async () => {
  let finish!: (check: LocalDataCheck) => void;
  const check = vi.fn(() => new Promise<LocalDataCheck>(resolve => { finish = resolve; }));
  render(<><ClearLocalData check={check} /><PortalHost /></>);
  const button = screen.getByTestId('settings-general-clear-local-data');
  expect(button.getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(button);
  expect(check).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('settings-general-clear-local-data').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('settings-general-clear-local-data'));
  expect(check).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('clear-all-local-data-description')).toBeNull();
  await act(async () => { finish({ unsent: 0, localOnly: 1, unchecked: [] }); });
  expect(description()).toContain('(1 record)');
  expect(screen.getByTestId('settings-general-clear-local-data').getAttribute('aria-disabled')).not.toBe('true');
});

test('Clear all local data schedules the reset, then reloads', async () => {
  const schedule = vi.fn(() => true);
  const reload = vi.fn();
  await openConfirm({ schedule, reload });
  fireEvent.click(screen.getByTestId('clear-all-local-data-confirm'));
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(schedule.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
  expect(screen.queryByTestId('clear-all-local-data-description')).toBeNull();
});

test('Cancel closes the confirm and clears nothing', async () => {
  const schedule = vi.fn(() => true);
  const reload = vi.fn();
  await openConfirm({ schedule, reload });
  fireEvent.click(screen.getByTestId('clear-all-local-data-cancel'));
  expect(schedule).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  expect(screen.queryByTestId('clear-all-local-data-description')).toBeNull();
});

test('a reset that cannot be scheduled shows the failure and does not reload', async () => {
  const schedule = vi.fn(() => false);
  const reload = vi.fn();
  await openConfirm({ schedule, reload });
  fireEvent.click(screen.getByTestId('clear-all-local-data-confirm'));
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  expect(getToasts()).toEqual([expect.objectContaining({
    title: 'Could not clear local data. Close the app completely, open it again, and retry.', type: 'error',
  })]);
});

test.each([
  ['with the outbox enabled, the default check is given the open orders database', true],
  ['with the outbox disabled, the default check is given no active database', false],
])('%s', async (_name, enabled) => {
  const database = { name: 'orders-db' };
  vi.mocked(useOutbox).mockReturnValue({ enabled, orders: { database } } as unknown as ReturnType<typeof useOutbox>);
  vi.mocked(checkLocalData).mockClear().mockResolvedValue(clean);
  render(<><ClearLocalData /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('settings-general-clear-local-data'));
  await screen.findByTestId('clear-all-local-data-description');
  expect(vi.mocked(checkLocalData).mock.calls).toEqual([[{ active: enabled ? database : null }]]);
  expect(vi.mocked(checkLocalData).mock.calls[0]?.[0].active).toBe(enabled ? database : null);
});
