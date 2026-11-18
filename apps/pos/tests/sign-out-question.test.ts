import { afterEach, expect, test, vi } from 'vitest';
import { signOutQuestion, startCountThen } from '../lib/cashier/sign-out-question';
import { dismissToast, getToasts } from '../lib/toast/toast';

afterEach(() => dismissToast());

test('signOutQuestion names the till and its expected cash while open or counting', () => {
  const register = { enabled: true, blind: false, registerName: 'Main', session: { status: 'open' } };
  expect(signOutQuestion(register, '$12.00')).toBe('Main is still open at $12.00. Close it first?');
  expect(signOutQuestion({ ...register, session: { status: 'counting' } }, '$12.00')).toBe('Main is still open at $12.00. Close it first?');
  expect(signOutQuestion({ ...register, registerName: null }, '$12.00')).toBe('This till is still open at $12.00. Close it first?');
});

test('signOutQuestion drops the amount for a blind count', () => {
  expect(signOutQuestion({ enabled: true, blind: true, registerName: 'Main', session: { status: 'open' } }, '$12.00'))
    .toBe('Main is still open. Close it first?');
});

test('signOutQuestion asks nothing without an open or counting session', () => {
  const register = { enabled: true, blind: false, registerName: 'Main', session: { status: 'open' } };
  expect(signOutQuestion(null, '$12.00')).toBeUndefined();
  expect(signOutQuestion({ ...register, enabled: false }, '$12.00')).toBeUndefined();
  expect(signOutQuestion({ ...register, session: null }, '$12.00')).toBeUndefined();
  expect(signOutQuestion({ ...register, session: { status: 'closed' } }, '$12.00')).toBeUndefined();
});

test('startCountThen starts the count of an open session, then opens the register', async () => {
  const order: string[] = [];
  const startCounting = vi.fn(async () => { await Promise.resolve(); order.push('count'); });
  const then = vi.fn(() => { order.push('then'); });
  expect(await startCountThen({ session: { status: 'open' }, actions: { startCounting } }, then)).toBe(true);
  expect(startCounting).toHaveBeenCalledTimes(1);
  expect(then).toHaveBeenCalledTimes(1);
  expect(order).toEqual(['count', 'then']);
});

test('startCountThen on a session already counting only opens the register', async () => {
  const startCounting = vi.fn(async () => {});
  const then = vi.fn();
  expect(await startCountThen({ session: { status: 'counting' }, actions: { startCounting } }, then)).toBe(true);
  expect(startCounting).not.toHaveBeenCalled();
  expect(then).toHaveBeenCalledTimes(1);
});

test('startCountThen keeps the cashier when the count cannot start', async () => {
  const startCounting = vi.fn(async () => { throw new Error('Count refused'); });
  const then = vi.fn();
  expect(await startCountThen({ session: { status: 'open' }, actions: { startCounting } }, then)).toBe(false);
  expect(then).not.toHaveBeenCalled();
  expect(getToasts()[0]).toMatchObject({ title: 'The count could not start', type: 'error' });
});
