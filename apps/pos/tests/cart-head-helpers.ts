import { fireEvent, screen, within } from '@testing-library/react';
import { REGISTER_SESSIONS_KEY } from '../lib/register/register-setting';

/** Open the cart head's + menu and press one of its items (Add new customer, Add charge or Add discount). */
export function openAddMenuItem(item: 'customer' | 'charge' | 'discount') {
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  fireEvent.click(screen.getByTestId(`cart-add-menu-${item}`));
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
 */
export function toggleRegisterSessions() {
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  fireEvent.click(within(screen.getByTestId('cart-settings')).getByRole('switch', { name: 'Use register sessions' }));
  const close = screen.queryByTestId('ui-settings-close');
  if (close) fireEvent.click(close);
}
