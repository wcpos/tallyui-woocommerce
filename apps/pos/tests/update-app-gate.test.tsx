// v2's "Update the POS app" gate on the store's 426 wcpos_update_required refusal (update-app-gate).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { isTillUpdateRequired, UpdateRequiredGate } from '../components/update-required';

const mocks = vi.hoisted(() => ({
  notice: undefined as { code: string; fixedBy?: 'till' | 'store' } | undefined,
  signOut: vi.fn(),
}));

vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({ catalogue: null, products: [], status: 'ready', notice: mocks.notice }),
}));

vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({ signOut: mocks.signOut }),
}));

const TILL_UPDATE = { code: 'till_update_required', fixedBy: 'till' } as const;
const SIGN_IN = { code: 'unauthorized', fixedBy: 'till' } as const;
const STORE_FIXED = { code: 'missing_plugin', fixedBy: 'store' } as const;
const WEB_LINE = 'The WCPOS plugin on your WordPress site is newer than the app in this tab. Reload the page to load the latest version.';

function renderGate() {
  return render(<UpdateRequiredGate><span data-testid="product-grid" /></UpdateRequiredGate>);
}

beforeEach(() => {
  mocks.notice = undefined;
  mocks.signOut.mockReset();
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('isTillUpdateRequired: true for the 426 till-update notice', () => {
  expect(isTillUpdateRequired(TILL_UPDATE)).toBe(true);
});

test('isTillUpdateRequired: false for a sign-in, a store-fixed or no notice', () => {
  expect(isTillUpdateRequired(SIGN_IN)).toBe(false);
  expect(isTillUpdateRequired(STORE_FIXED)).toBe(false);
  expect(isTillUpdateRequired(undefined)).toBe(false);
});

test('the till-update notice swaps the screens for the gate', () => {
  mocks.notice = TILL_UPDATE;
  renderGate();
  expect(screen.getByTestId('update-required-screen')).not.toBeNull();
  expect(screen.getByTestId('update-required-title').textContent).toBe('Update the POS app on this device.');
  expect(screen.getByTestId('update-required-description').textContent).toBe(WEB_LINE);
  expect(screen.queryByTestId('product-grid')).toBeNull();
});

test('Reload reloads the page', async () => {
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  mocks.notice = TILL_UPDATE;
  renderGate();
  await act(async () => { fireEvent.click(screen.getByTestId('update-required-reload')); });
  expect(reload).toHaveBeenCalledTimes(1);
});

test('Log out calls the sign-out handler', async () => {
  mocks.notice = TILL_UPDATE;
  renderGate();
  await act(async () => { fireEvent.click(screen.getByTestId('update-required-logout')); });
  expect(mocks.signOut).toHaveBeenCalledTimes(1);
});

test('with no notice or another notice the screens render as now', () => {
  for (const notice of [undefined, SIGN_IN, STORE_FIXED]) {
    mocks.notice = notice;
    renderGate();
    expect(screen.getByTestId('product-grid')).not.toBeNull();
    expect(screen.queryByTestId('update-required-screen')).toBeNull();
    cleanup();
  }
});
