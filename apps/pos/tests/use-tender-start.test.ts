import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useTenderStart } from '../lib/sale/use-tender-start';

afterEach(cleanup);

test('the register hears whether the sale is at tender', () => {
  const register = { enabled: false, setTenderInProgress: vi.fn(), requireSaleSession: vi.fn() };
  const sale = { stage: { kind: 'tender' }, startTender: vi.fn(), setTender: vi.fn() };
  const say = vi.fn();
  const { rerender } = renderHook(({ kind }) => useTenderStart(
    { ...sale, stage: { kind } } as never, { register: register as never, multiPayment: false, say },
  ), { initialProps: { kind: 'tender' } });

  expect(register.setTenderInProgress).toHaveBeenLastCalledWith(true);
  rerender({ kind: 'cart' });
  expect(register.setTenderInProgress).toHaveBeenLastCalledWith(false);
});

test('a multi-payment tender opens with no leg preset, whatever the method', async () => {
  const register = { enabled: false, setTenderInProgress: vi.fn(), requireSaleSession: vi.fn() };
  const sale = { stage: { kind: 'cart' }, startTender: vi.fn(), setTender: vi.fn() };
  const say = vi.fn();
  const { result } = renderHook(() => useTenderStart(
    sale as never, { register: register as never, multiPayment: true, say },
  ));

  await act(async () => { await result.current('external'); });

  expect(sale.startTender.mock.calls[0][0]).toBe('external');
  expect(sale.setTender).toHaveBeenCalledWith(null);
});

test('a single-payment tender keeps the preset leg', async () => {
  const register = { enabled: false, setTenderInProgress: vi.fn(), requireSaleSession: vi.fn() };
  const sale = { stage: { kind: 'cart' }, startTender: vi.fn(), setTender: vi.fn() };
  const say = vi.fn();
  const { result } = renderHook(() => useTenderStart(
    sale as never, { register: register as never, multiPayment: false, say },
  ));

  await act(async () => { await result.current('external'); });

  expect(sale.startTender).toHaveBeenCalled();
  expect(sale.setTender).not.toHaveBeenCalled();
});
