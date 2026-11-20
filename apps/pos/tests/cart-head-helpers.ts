import { fireEvent, screen, within } from '@testing-library/react';
import { REGISTER_SESSIONS_KEY } from '../lib/register/register-setting';

/** Open the cart head's + menu and press Add new customer, Add custom item (v2 a1c1d3340 / core.json:1074), Add Fee, Add Discount or Add Shipping. */
export function openAddMenuItem(item: 'customer' | 'misc-product' | 'fee' | 'discount' | 'shipping') {
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  fireEvent.click(screen.getByTestId(`cart-add-menu-${item}`));
}

/** v2's one door to the register panel: the bar's avatar opens the cashier sheet, whose drawer figure opens the panel.
 *  Scoped to the till's bar: the reports header draws its own avatar.
 *  The drawer door is awaited with a longer timeout because the sheet draws it only once the session stream reports the register open, which can lag the cart on a loaded worker. */
export async function openRegisterPanel(): Promise<void> {
  fireEvent.click(within(screen.getByTestId('register-bar-shell')).getByTestId('register-bar-avatar'));
  fireEvent.click(await screen.findByTestId('user-sheet-drawer', {}, { timeout: 5000 }));
}

/**
 * Register sessions are on by default (2026-11-11). A test of a plain sale, or one that turns sessions on with the
 * switch, starts from a till that saved "off". Call it after the test's localStorage stub.
 */
export function sessionsOff() {
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'false');
}

/**
 * The register sessions switch lives in Cart Settings: open the dialog, flip the switch, close the dialog. Turning
 * sessions on with no open session replaces the cart with the open-register card, which unmounts the dialog itself.
 * The dialog is awaited because a register-session update still in flight can re-render the cart in the same flush
 * as the click.
 */
export async function toggleRegisterSessions(): Promise<void> {
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const dialog = await screen.findByTestId('cart-settings');
  fireEvent.click(within(dialog).getByRole('switch', { name: 'Use register sessions' }));
  const close = screen.queryByTestId('ui-settings-close');
  if (close) fireEvent.click(close);
}
