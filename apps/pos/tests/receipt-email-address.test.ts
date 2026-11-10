import { expect, test } from 'vitest';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '../lib/receipts/receipt-emails';

test('the refusal copy is v2\'s zod message', () => {
  expect(INVALID_EMAIL_MESSAGE).toBe('Invalid email address');
});

test.each([
  'gee@example.invalid',
  ' gee@example.invalid ',
  'first.last+tag@shop.example.co',
  "o'neil@example.com",
  'a_b-c@sub-domain.example.org',
])('accepts %j', value => expect(isValidEmail(value)).toBe(true));

test.each([
  '',
  '   ',
  'nobody',
  '@example.com',
  'gee@',
  'gee@example',
  'gee@@example.com',
  'a@b@example.com',
  'gee@exa mple.com',
  'g ee@example.com',
  'gee@example.c',
  '.gee@example.com',
  'gee..x@example.com',
  'gee.@example.com',
])('refuses %j', value => expect(isValidEmail(value)).toBe(false));
