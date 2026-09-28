import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { PlaceholderScreen } from '../components/placeholder-screen';

test('shows the POS title and WooCommerce connector', () => {
  render(<PlaceholderScreen />);

  expect(screen.getByText('TallyUI WooCommerce POS')).not.toBeNull();
  expect(screen.getByText('Connector: WooCommerce')).not.toBeNull();
});
