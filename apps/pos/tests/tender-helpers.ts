import { fireEvent, screen } from '@testing-library/react';

/** Types `minor` on the tender keypad (digits shift in from the right) and presses the commit button. */
export async function takeCash(minor: number): Promise<void> {
  await screen.findByTestId('checkout-keypad');
  fireEvent.click(screen.getByTestId('checkout-keypad-key-clear'));
  for (const digit of String(minor)) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${digit}`));
  fireEvent.click(screen.getByTestId('checkout-commit'));
}
