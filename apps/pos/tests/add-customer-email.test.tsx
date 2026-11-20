import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Customer } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { AddCustomerDialog } from '../components/add-customer-dialog';
import type { CustomerSource } from '../lib/customers/customer-source';

// v2 customer/customer-form.tsx:39 validates `email: z.string().email()`; form-errors.tsx:32-35 shows the
// errors as a bad-tone Notice titled "Please fix the following errors:" with "• <path>: <message>" rows.
const ann: Customer = { id: '9', name: 'Ann Example', email: 'ann@example.com' };
const search = vi.fn<CustomerSource['search']>();
const create = vi.fn<CustomerSource['create']>();
const onClose = vi.fn();

beforeEach(() => {
  search.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue(ann);
  onClose.mockReset();
  render(<><AddCustomerDialog source={{ search, create }} onClose={onClose} /><PortalHost /></>);
});
afterEach(() => cleanup());

function saveWith(email: string) {
  fireEvent.change(screen.getByPlaceholderText('email@example.com'), { target: { value: email } });
  fireEvent.click(within(screen.getByTestId('customer-form')).getByText('Add Customer'));
}

function expectErrorsBlock() {
  const block = screen.getByTestId('customer-form-error');
  expect(within(block).getByText('Please fix the following errors:')).not.toBeNull();
  expect(screen.getByTestId('customer-form-error-email').textContent).toBe('• email: Invalid email address');
}

test('a malformed email shows v2\'s errors block and does not save', async () => {
  for (const email of ['ann@', 'ann.example.com']) {
    saveWith(email);
    expectErrorsBlock();
  }
  await Promise.resolve();
  expect(create).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

test('a valid email saves once and shows no errors block', async () => {
  saveWith('ann@example.com');
  await waitFor(() => expect(create).toHaveBeenCalledExactlyOnceWith({ email: 'ann@example.com' }));
  expect(screen.queryByTestId('customer-form-error')).toBeNull();
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
});

test('fixing the email and saving again clears the block and saves', async () => {
  saveWith('ann@');
  expectErrorsBlock();
  saveWith(' ann@example.com ');
  await waitFor(() => expect(create).toHaveBeenCalledExactlyOnceWith({ email: 'ann@example.com' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(screen.queryByTestId('customer-form-error')).toBeNull();
  expect(screen.queryByTestId('customer-form-error-email')).toBeNull();
});

test('an empty email shows the same row as v2 (zod rejects "")', async () => {
  for (const email of ['', '   ']) {
    saveWith(email);
    expectErrorsBlock();
  }
  await Promise.resolve();
  expect(create).not.toHaveBeenCalled();
});
