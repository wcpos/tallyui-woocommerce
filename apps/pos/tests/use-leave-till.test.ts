import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { runBeforeLeave } from '../lib/sale/before-leave';
import { useLeaveTill } from '../lib/sale/use-leave-till';

afterEach(cleanup);

test('a sale being saved refuses the redirect and holds nothing', async () => {
  const sale = { stage: { kind: 'cart' }, saving: true };
  const context = { hold: vi.fn(), unhold: vi.fn(), onSwitchCashier: vi.fn(), onAddCashier: vi.fn(), say: vi.fn() };
  context.hold.mockResolvedValue(undefined);
  renderHook(() => useLeaveTill(sale as never, context as never));

  await expect(runBeforeLeave()).resolves.toBe('Finish or cancel the payment first.');
  expect(context.hold).not.toHaveBeenCalled();
});

test('a failed hold refuses the redirect with its message', async () => {
  const sale = { stage: { kind: 'cart' }, saving: false };
  const context = { hold: vi.fn(), unhold: vi.fn(), onSwitchCashier: vi.fn(), onAddCashier: vi.fn(), say: vi.fn() };
  context.hold.mockResolvedValue('disk full');
  renderHook(() => useLeaveTill(sale as never, context as never));

  await expect(runBeforeLeave()).resolves.toBe('disk full');
});

test('a failed hold stops a cashier switch and is said', async () => {
  const sale = { stage: { kind: 'cart' }, saving: false };
  const context = { hold: vi.fn(), unhold: vi.fn(), onSwitchCashier: vi.fn(), onAddCashier: vi.fn(), say: vi.fn() };
  context.hold.mockResolvedValue('disk full');
  const { result } = renderHook(() => useLeaveTill(sale as never, context as never));

  await act(async () => { await result.current('u2'); });

  expect(context.say).toHaveBeenCalledWith('disk full');
  expect(context.onSwitchCashier).not.toHaveBeenCalled();
});

test('a failed switch with an empty cart is said and nothing is unheld', async () => {
  const sale = { stage: { kind: 'cart' }, saving: false };
  const context = { hold: vi.fn(), unhold: vi.fn(), onSwitchCashier: vi.fn(), onAddCashier: vi.fn(), say: vi.fn() };
  context.hold.mockResolvedValue(undefined);
  context.onSwitchCashier.mockResolvedValue('Sign-in failed');
  const { result } = renderHook(() => useLeaveTill(sale as never, context as never));

  await act(async () => { await result.current('u2'); });

  expect(context.onSwitchCashier).toHaveBeenCalledWith('u2');
  expect(context.say).toHaveBeenCalledWith('Sign-in failed');
  expect(context.unhold).not.toHaveBeenCalled();
});
