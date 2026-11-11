import { fireEvent, screen, within } from '@testing-library/react';

/** Open the cart head's + menu and press one of its items (Add charge or Add discount). */
export function openAddMenuItem(item: 'charge' | 'discount') {
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  fireEvent.click(screen.getByTestId(`cart-add-menu-${item}`));
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
