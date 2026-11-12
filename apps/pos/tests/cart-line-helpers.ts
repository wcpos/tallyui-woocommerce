import { fireEvent, screen } from '@testing-library/react';

/** Opens the line's quantity popover (v2 cells/quantity-keypad.tsx). */
export function openLineQuantity(name: string): void {
  fireEvent.click(screen.getByLabelText(`Edit quantity of ${name}`));
}

/** Opens the quantity popover, types `quantity` on its keypad and applies. */
export function setLineQuantity(name: string, quantity: number): void {
  openLineQuantity(name);
  for (const digit of String(quantity)) fireEvent.click(screen.getByTestId(`quantity-popover-keypad-key-${digit}`));
  fireEvent.click(screen.getByTestId('quantity-popover-apply'));
}

/** Opens the quantity popover and presses its Remove action. */
export function removeLine(name: string): void {
  openLineQuantity(name);
  fireEvent.click(screen.getByTestId('quantity-popover-action-remove'));
}

/** v2's empty-cart line (core.json pos_cart.empty_cart_hint). */
export const EMPTY_CART_TEXT = 'Tap a product to start a sale';
