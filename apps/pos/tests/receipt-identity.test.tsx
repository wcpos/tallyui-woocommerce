import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ReceiptIdentity } from '../components/receipt-identity';
import { buildReceiptIdentity } from '../lib/receipts/receipt-identity';

afterEach(cleanup);

const input = {
  posOrder: { createdAt: '2026-10-06T08:00:00.000Z' },
  register: { id: 'r-1', name: 'Register AB12' },
  timeZone: 'Australia/Brisbane',
};

test('builds the schema 1.4 receipt identity', () => {
  expect(buildReceiptIdentity(input)).toEqual({
    software: { name: 'TallyUI WooCommerce POS', plugin_version: '', app_version: '0.1.0', app_build: '' },
    register: { id: 'r-1', name: 'Register AB12' },
    fiscal: { document_type: 'sale', sale_time: '2026-10-06T08:00:00.000Z', sale_tz: 'Australia/Brisbane',
      is_reprint: false, reprint_count: 0, qr_payload: '' },
  });
});

test('marks copies as reprints in the fiscal data', () => {
  expect(buildReceiptIdentity(input).fiscal).toMatchObject({ is_reprint: false, reprint_count: 0 });
  expect(buildReceiptIdentity({ ...input, copies: 2 }).fiscal).toMatchObject({ is_reprint: true, reprint_count: 2 });
});

test('uses the till label without a bound register', () => {
  expect(buildReceiptIdentity({ ...input, register: null }).register).toEqual({ id: '', name: 'This till' });
});

test('renders the receipt identity lines in order', () => {
  render(<ReceiptIdentity identity={buildReceiptIdentity(input)} />);
  expect(screen.queryByTestId('receipt-copy')).toBeNull();
  const block = screen.getByTestId('receipt-identity');
  const identity = within(block);
  expect(identity.getByText('Sales receipt')).not.toBeNull();
  expect(identity.getByText('Register: Register AB12')).not.toBeNull();
  expect(identity.getByText('TallyUI WooCommerce POS 0.1.0')).not.toBeNull();
  expect(block.textContent).toBe('Sales receiptRegister: Register AB12TallyUI WooCommerce POS 0.1.0');
});

test('renders the COPY line before the identity on a reprint', () => {
  render(<ReceiptIdentity identity={buildReceiptIdentity({ ...input, copies: 1 })} />);
  expect(screen.getByTestId('receipt-copy').textContent).toBe('COPY 1');
  expect(screen.getByTestId('receipt-identity').textContent?.startsWith('COPY 1Sales receipt')).toBe(true);
});
