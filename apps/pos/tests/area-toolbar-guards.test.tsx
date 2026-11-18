import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PortalHost } from '@tallyui/primitives';
import { AppRailShown } from '../components/app-rail';
import { AreaToolbar } from '../components/area-header';
import { TableCount, useCatalogueSync } from '../components/table-surface';
import { clearBeforeLeave, setBeforeLeave } from '../lib/sale/before-leave';
import { dismissToast, getToasts } from '../lib/toast/toast';

// The session and the catalogue are mocked here so the avatar's switch and the sync state can be driven directly.
const state = vi.hoisted(() => ({ switchCashier: vi.fn(), status: 'idle' as string }));
vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({
    session: { site: { name: 'Shop', home: 'https://shop.example' }, tokens: { user: { uuid: 'paul', displayName: 'Paul' } } },
    cashiers: [{ tokens: { user: { uuid: 'ana', displayName: 'Ana' } } }],
    switchCashier: state.switchCashier, startAddCashier: vi.fn(), removeCashier: vi.fn(), signOut: vi.fn(),
  }),
}));
vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({ catalogue: null, products: [], status: state.status }),
}));

const REFUSAL = 'Finish or cancel the payment first.';

beforeEach(() => { state.switchCashier.mockReset().mockResolvedValue(undefined); });
afterEach(() => { cleanup(); dismissToast(); });

async function switchToAna() {
  render(<AppRailShown.Provider value={true}><AreaToolbar area="orders" title="Orders" onBack={vi.fn()} /><PortalHost /></AppRailShown.Provider>);
  fireEvent.click(screen.getByTestId('register-bar-avatar'));
  fireEvent.click(await screen.findByTestId('user-sheet-user-ana'));
  await act(async () => { fireEvent.click(screen.getByTestId('switch-confirm-confirm')); });
}

test("the area avatar's switch is refused while the till refuses to leave: no switch, and the refusal is toasted", async () => {
  const refuse = async () => REFUSAL;
  setBeforeLeave(refuse);
  try {
    await switchToAna();
    await waitFor(() => expect(getToasts().map(t => t.title)).toContain(REFUSAL));
    expect(state.switchCashier).not.toHaveBeenCalled();
  } finally { clearBeforeLeave(refuse); }
});

test('the area avatar switches cashier once the till lets it leave', async () => {
  const allow = async () => null;
  setBeforeLeave(allow);
  try {
    await switchToAna();
    await waitFor(() => expect(state.switchCashier).toHaveBeenCalledWith('ana'));
    expect(getToasts()).toEqual([]);
  } finally { clearBeforeLeave(allow); }
});

function SyncedCount() {
  const sync = useCatalogueSync();
  return <TableCount shown={1} total={1} active={sync.active} onSync={sync.sync} />;
}

test.each(['starting', 'syncing'])("the catalogue's %s status turns the footer's sync button", status => {
  state.status = status;
  render(<SyncedCount />);
  expect(screen.queryByTestId('data-table-sync-active')).not.toBeNull();
});

// v2 sync-button.tsx:39-53: the button is never disabled while it turns; a press then does nothing.
const syncDisabled = () => screen.getByTestId('data-table-sync').getAttribute('aria-disabled');

test('the turning sync button stays at full strength: not disabled while active', () => {
  render(<TableCount shown={1} total={1} active onSync={vi.fn()} />);
  expect(screen.queryByTestId('data-table-sync-active')).not.toBeNull();
  expect(syncDisabled()).not.toBe('true');
});

test('a press while the sync button turns does not sync again', () => {
  const onSync = vi.fn();
  render(<TableCount shown={1} total={1} active onSync={onSync} />);
  fireEvent.click(screen.getByTestId('data-table-sync'));
  expect(onSync).not.toHaveBeenCalled();
});

test('a press at rest syncs once', () => {
  const onSync = vi.fn();
  render(<TableCount shown={1} total={1} active={false} onSync={onSync} />);
  fireEvent.click(screen.getByTestId('data-table-sync'));
  expect(onSync).toHaveBeenCalledTimes(1);
});

test('with nothing to sync the button stays disabled', () => {
  render(<TableCount shown={1} total={1} active={false} />);
  expect(syncDisabled()).toBe('true');
});

test.each(['idle', 'ready', 'error'])('a settled catalogue (%s) leaves the sync button still', status => {
  state.status = status;
  render(<SyncedCount />);
  expect(screen.getByTestId('data-table-sync')).not.toBeNull();
  expect(screen.queryByTestId('data-table-sync-active')).toBeNull();
});
