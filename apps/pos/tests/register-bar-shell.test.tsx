import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Text } from '@tallyui/components';
import { RegisterBarShell, registerBarPill } from '../components/register-bar-shell';
import { OnlineStatusContext } from '../lib/online/online-status';

afterEach(() => { cleanup(); });

const shell = (props: { hidePill?: boolean; onOpenMenu?: () => void } = {}) =>
  <RegisterBarShell storeName="Corner Café" avatar={<Text>Cashier: Paul</Text>} onOpenMenu={props.onOpenMenu ?? (() => {})} hidePill={props.hidePill} />;

test('shows the menu, the store as the place and the cashier entry, with no pill while the store answers', () => {
  render(shell());
  expect(screen.getByTestId('register-bar-place').textContent).toBe('Corner Café');
  expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('data-testid')).toBe('pos-drawer-open-button');
  expect(screen.getByText('Cashier: Paul')).not.toBeNull();
  expect(screen.queryByTestId('register-bar-pill')).toBeNull();
});

test.each(['offline', 'online-website-unavailable'] as const)('reads Offline in the pill for %s', status => {
  render(<OnlineStatusContext.Provider value={{ status }}>{shell()}</OnlineStatusContext.Provider>);
  expect(screen.getByTestId('register-bar-pill').textContent).toBe('Offline');
});

test('hidePill leaves the pill to the register bar beside it', () => {
  render(<OnlineStatusContext.Provider value={{ status: 'offline' }}>{shell({ hidePill: true })}</OnlineStatusContext.Provider>);
  expect(screen.queryByTestId('register-bar-pill')).toBeNull();
});

test('the menu button opens the drawer', () => {
  const onOpenMenu = vi.fn();
  render(shell({ onOpenMenu }));
  fireEvent.click(screen.getByTestId('pos-drawer-open-button'));
  expect(onOpenMenu).toHaveBeenCalledOnce();
});

test('registerBarPill: sessions off reads Offline only when offline; sessions on follows the register pill', () => {
  const on = { enabled: true, boundRegisterId: 'web', session: null, overdue: false, closing: false };
  expect(registerBarPill(null, true)).toBeNull();
  expect(registerBarPill(null, false)).toBe('Offline');
  expect(registerBarPill({ ...on, enabled: false }, false)).toBe('Offline');
  expect(registerBarPill(on, true)).toBe('Register closed');
  expect(registerBarPill({ ...on, session: { status: 'counting' } }, true)).toBe('Counting');
  expect(registerBarPill({ ...on, session: { status: 'counting' } }, false)).toBe('Offline');
  expect(registerBarPill({ ...on, boundRegisterId: null }, false)).toBe('Choose a register');
});
