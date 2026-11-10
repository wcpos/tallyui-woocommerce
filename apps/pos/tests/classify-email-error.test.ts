import { expect, test } from 'vitest';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import { classifyEmailSendError } from '../lib/receipts/classify-email-error';
import { backoffMs, MAX_SEND_ATTEMPTS, SEND_SPACING_MS } from '../lib/receipts/receipt-emails';

test.each([
  [new CustomerServiceError('network', 'Failed to fetch'), { kind: 'connectivity', reason: 'Could not reach the store' }],
  ...[500, 503, 408, 423, 425, 429].map(status => [new CustomerServiceError('server', `HTTP ${status}`),
    { kind: 'connectivity', reason: `The store could not send the email (HTTP ${status})`, status }] as const),
  [Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }), { kind: 'connectivity', reason: 'Could not reach the store' }],
  [new TypeError('Failed to fetch'), { kind: 'connectivity', reason: 'Could not reach the store' }],
  [new Error('Network Error'), { kind: 'connectivity', reason: 'Could not reach the store' }],
] as const)('classifies %s as connectivity', (error, expected) => {
  expect(classifyEmailSendError(error)).toStrictEqual(expected);
});

test.each([
  [new ConnectorUnauthorizedError('Expired token', 401), { kind: 'permanent', reason: 'Sign in again to send the receipt', status: 401 }],
  [new ConnectorUnauthorizedError('Expired token', 403), { kind: 'permanent', reason: 'Sign in again to send the receipt', status: 403 }],
  [new CustomerServiceError('invalid', 'Invalid order ID'), { kind: 'permanent', reason: 'The store refused the email: Invalid order ID' }],
  [new CustomerServiceError('server', 'HTTP 409'),
    { kind: 'permanent', reason: 'The store could not send the email (HTTP 409). Send again to retry.', status: 409 }],
  [new CustomerServiceError('server', 'unexpected response'), { kind: 'permanent', reason: 'The server did not send the email.' }],
  [new CustomerServiceError('server', 'Mail service failed'),
    { kind: 'permanent', reason: 'The store could not send the email (Mail service failed). Send again to retry.' }],
  [new Error('WooCommerce API error: 426'), { kind: 'permanent', reason: 'WooCommerce API error: 426' }],
  ['boom', { kind: 'permanent', reason: 'boom' }],
])('classifies %s as permanent', (error, expected) => {
  expect(classifyEmailSendError(error)).toStrictEqual(expected);
});

test('backoffMs doubles from 30 s and stops at 15 minutes', () => {
  expect([1, 2, 3, 4, 5, 6, 50].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000, 900_000, 900_000]);
  expect(MAX_SEND_ATTEMPTS).toBe(6);
  expect(SEND_SPACING_MS).toBe(1_000);
});
