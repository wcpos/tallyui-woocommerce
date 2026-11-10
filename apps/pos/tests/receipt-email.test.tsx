import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import type { RxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { PortalHost } from '@tallyui/primitives';
import { ReceiptEmail } from '../components/receipt-email';
import { receiptEmailSchema, receiptEmailMigrationStrategies } from '../lib/receipts/receipt-emails';
import type { ReceiptEmail as ReceiptEmailRow, ReceiptEmailCollection } from '../lib/receipts/receipt-emails';

addRxPlugin(RxDBMigrationSchemaPlugin);

const email = 'gee@example.invalid';
const notice = 'This device can’t reach your store right now. The receipt will be emailed automatically when the connection returns.';
const replaces = 'Replaces gee@example.invalid on this order’s billing address.';
let db: RxDatabase;
let collection: ReceiptEmailCollection;

beforeEach(async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  db = await createRxDatabase({ name: `receipt_email_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ receipt_emails: collection } = await db.addCollections<{ receipt_emails: ReceiptEmailCollection }>({
    receipt_emails: { schema: receiptEmailSchema, migrationStrategies: receiptEmailMigrationStrategies },
  }));
});

afterEach(async () => {
  cleanup();
  await db.close();
  vi.restoreAllMocks();
});

const request = () => collection.findOne('sale').exec();
const show = (props: Partial<ComponentProps<typeof ReceiptEmail>> = {}) =>
  render(<><ReceiptEmail collection={collection} orderId="sale" defaultEmail={email} {...props} /><PortalHost /></>);
async function openDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Email Receipt' }));
  return vi.waitFor(() => screen.getByLabelText('Email Address') as HTMLInputElement);
}
const saveSwitch = () => screen.getByRole('switch', { name: 'Save email to Billing Address' });
const insert = (row: Partial<ReceiptEmailRow>) =>
  collection.insert({ id: 'sale', queuedAt: '2026-11-10T10:00:00.000Z', attempts: 1, ...row } as ReceiptEmailRow);
const sendLabel = () => screen.getByTestId('receipt-email-send').textContent;

test('opens the Email Receipt dialog with the sale\'s address, save to billing off, and Send', async () => {
  show();
  expect(screen.queryByLabelText('Email Address')).toBeNull();
  const field = await openDialog();
  expect(field.value).toBe(email);
  expect(saveSwitch().getAttribute('aria-checked')).toBe('false');
  expect(sendLabel()).toBe('Send');
  expect(screen.queryByTestId('receipt-email-offline-notice')).toBeNull();
});

test('Send queues the trimmed address, closes the dialog and shows the queued copy', async () => {
  show();
  fireEvent.change(await openDialog(), { target: { value: ' other@example.invalid ' } });
  fireEvent.click(screen.getByTestId('receipt-email-send'));
  await vi.waitFor(() => screen.getByText('Receipt email queued'));
  expect(screen.getByText('It will send as soon as this device can reach your store.')).not.toBeNull();
  expect(screen.queryByLabelText('Email Address')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Email Receipt' })).toBeNull();
  expect((await request())?.toJSON()).toMatchObject({ email: 'other@example.invalid', status: 'queued' });
});

test.each(['nobody', 'gee@example', 'gee@exa mple.com'])('an invalid address %j keeps the dialog open with the refusal and queues nothing', async value => {
  show({ defaultEmail: value });
  await openDialog();
  fireEvent.click(screen.getByTestId('receipt-email-send'));
  await vi.waitFor(() => expect(screen.getByTestId('receipt-email-error').textContent).toBe('Invalid email address'));
  expect((screen.getByLabelText('Email Address') as HTMLInputElement).value).toBe(value);
  expect(await request()).toBeNull();
});

test('correcting an invalid address sends, closes the dialog and queues the corrected address', async () => {
  show();
  const field = await openDialog();
  fireEvent.change(field, { target: { value: 'gee@example' } });
  fireEvent.click(screen.getByTestId('receipt-email-send'));
  await vi.waitFor(() => expect(screen.getByTestId('receipt-email-error').textContent).toBe('Invalid email address'));
  fireEvent.change(field, { target: { value: 'gee@example.com' } });
  fireEvent.click(screen.getByTestId('receipt-email-send'));
  await vi.waitFor(() => screen.getByText('Receipt email queued'));
  expect(screen.queryByLabelText('Email Address')).toBeNull();
  expect((await request())?.toJSON()).toMatchObject({ email: 'gee@example.com', status: 'queued' });
});

test('with Save to Billing on, a different address shows the billing email it replaces', async () => {
  show();
  fireEvent.change(await openDialog(), { target: { value: 'other@example.invalid' } });
  expect(screen.queryByTestId('receipt-email-billing-replaces')).toBeNull();
  fireEvent.click(saveSwitch());
  expect(screen.getByTestId('receipt-email-billing-replaces').textContent).toBe(replaces);
  fireEvent.click(saveSwitch());
  expect(screen.queryByTestId('receipt-email-billing-replaces')).toBeNull();
});

test('no replace notice while the address matches the billing email, spaces aside', async () => {
  show();
  const field = await openDialog();
  fireEvent.click(saveSwitch());
  expect(screen.queryByTestId('receipt-email-billing-replaces')).toBeNull();
  fireEvent.change(field, { target: { value: ' gee@example.invalid ' } });
  expect(screen.queryByTestId('receipt-email-billing-replaces')).toBeNull();
});

test('no replace notice when the order has no billing email', async () => {
  show({ defaultEmail: '' });
  fireEvent.change(await openDialog(), { target: { value: 'other@example.invalid' } });
  fireEvent.click(saveSwitch());
  expect(screen.queryByTestId('receipt-email-billing-replaces')).toBeNull();
});

test.each([
  ['the store has not confirmed the sale', true, true],
  ['the device is offline', false, false],
] as const)('%s: Send when online and the offline notice', async (_, localOnly, online) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  show({ localOnly });
  await openDialog();
  expect(sendLabel()).toBe('Send when online');
  expect(screen.getByTestId('receipt-email-offline-notice').textContent).toBe(notice);
  fireEvent.click(screen.getByTestId('receipt-email-send'));
  await vi.waitFor(() => screen.getByText('Receipt email queued'));
  expect((await request())?.status).toBe('queued');
});

test('the button label follows the online and offline events', async () => {
  const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  show();
  await openDialog();
  expect(sendLabel()).toBe('Send when online');
  onLine.mockReturnValue(true);
  act(() => { window.dispatchEvent(new Event('online')); });
  expect(sendLabel()).toBe('Send');
  onLine.mockReturnValue(false);
  act(() => { window.dispatchEvent(new Event('offline')); });
  expect(sendLabel()).toBe('Send when online');
});

test('the save to billing switch toggles; Cancel closes without queuing and the next open starts off', async () => {
  show();
  await openDialog();
  fireEvent.click(saveSwitch());
  expect(saveSwitch().getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByLabelText('Email Address')).toBeNull();
  expect(await request()).toBeNull();
  await openDialog();
  expect(saveSwitch().getAttribute('aria-checked')).toBe('false');
});

const failedRow = { status: 'failed', email: 'old@example.invalid', error: 'The store refused the email: Invalid order ID' } as const;

test.each([
  ['failed', failedRow, 'The store refused the email: Invalid order ID', true],
  ['sent', { status: 'sent', email, sentAt: '2026-11-10T10:01:00.000Z', error: '' }, 'Email sent', true],
  ['queued with a deferred reason', { status: 'queued', email, error: 'Could not reach the store' }, 'Could not reach the store', false],
  ['sending', { status: 'sending', email }, 'Sending the receipt…', false],
] as const)('a %s row shows its state', async (_, row, text, button) => {
  await insert(row);
  show();
  await vi.waitFor(() => screen.getByText(text));
  expect(screen.queryByRole('button', { name: 'Email Receipt' }) !== null).toBe(button);
});

test('a failed email reopens the dialog with the address it was queued with', async () => {
  await insert(failedRow);
  show();
  await vi.waitFor(() => screen.getByText(failedRow.error));
  expect((await openDialog()).value).toBe('old@example.invalid');
});

test('switching Save to Billing on stores it on the queued row', async () => {
  show();
  await openDialog();
  fireEvent.click(saveSwitch());
  fireEvent.click(screen.getByTestId('receipt-email-send'));
  await vi.waitFor(() => screen.getByText('Receipt email queued'));
  expect((await collection.findOne('sale').exec())?.saveToBilling).toBe(true);
});
