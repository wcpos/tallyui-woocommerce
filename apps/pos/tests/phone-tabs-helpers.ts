import { fireEvent, screen, within } from '@testing-library/react';

// The narrow till's Products / Cart tab bar (components/pos-phone-tab-bar.tsx). Both panes stay mounted and the
// hidden one is display none, so a text query that the products grid and the cart both answer is scoped to a pane.

/** The Cart tab's badge: the cart's summed quantities, or New while it is empty. */
export function cartTabCount(): string | null {
  return screen.getByTestId('pos-tab-cart-count').textContent;
}

export function openCartTab() {
  fireEvent.click(screen.getByTestId('pos-tab-cart'));
}

export function openProductsTab() {
  fireEvent.click(screen.getByTestId('pos-tab-products'));
}

export function cartPane() {
  return within(screen.getByTestId('pos-pane-cart'));
}

export function productsPane() {
  return within(screen.getByTestId('pos-pane-products'));
}

/** Whether a pane is the one on screen (the other is display none). */
export function paneShown(pane: 'products' | 'cart'): boolean {
  return (screen.getByTestId(`pos-pane-${pane}`) as HTMLElement).style.display !== 'none';
}
