import { act, renderHook } from '@testing-library/react';
import { AFTER_CLOSE_PAYMENTS_CHANGED, cashVoidRefusal, SALE_FINISHED, type Order, type Payment, type TenderVoid, type useSale } from '@tallyui/pos';
import { expect, test, vi } from 'vitest';
import type { TenderVoidCollection } from '../lib/sale/tender-voids';
import { useTenderCancel, VOID_RECORDED_KEPT } from '../lib/sale/use-tender-cancel';

function takenCash(id: string, amountMinor: number): Payment {
  return { id, method: 'cash', amountMinor, status: 'captured', takenAt: '2026-11-28T10:00:00.000Z' };
}

function setup(payments: Payment[], fields: Pick<Order, 'cashRoundings' | 'afterClose'> = {}, kind: 'receipt' | 'tender' = 'tender') {
  const order = { id: 'sale-1', currency: 'USD', payments, ...fields };
  const voidTender = vi.fn((id: string) => {
    if (cashVoidRefusal(order, id)) return false;
    order.payments = order.payments.map(leg => leg.id === id ? { ...leg, status: 'voided' } : leg);
    return true;
  });
  const removeTender = vi.fn(), cancelTender = vi.fn();
  const sale = { saving: false, stage: { kind }, order, voidTender, removeTender, cancelTender } as unknown as ReturnType<typeof useSale>;
  const bulkInsert = vi.fn(async (rows: TenderVoid[]) => ({ success: rows, error: [] }));
  const fake = { bulkInsert } as unknown as TenderVoidCollection;
  const context = { collection: () => fake, sessionId: 's-1', cashierRef: '2' };
  const { result } = renderHook(() => useTenderCancel(sale, context));
  return { result, voidTender, removeTender, cancelTender, bulkInsert };
}

test('#649 Cancel payments voids rounded cash legs latest first and journals each once', async () => {
  const { result, voidTender, bulkInsert, cancelTender } = setup([takenCash('a', 1000), takenCash('b', 500)], {
    cashRoundings: [{ paymentId: 'a', minor: 2 }, { paymentId: 'b', minor: -1 }],
  });
  await act(async () => { result.current.requestCancel(); });
  await act(async () => { await result.current.confirmCancel(); });
  expect(voidTender.mock.calls).toEqual([['b'], ['a']]);
  expect(voidTender.mock.results.map(call => call.value)).toEqual([true, true]);
  expect(bulkInsert).toHaveBeenCalledTimes(1);
  const [rows] = bulkInsert.mock.calls[0];
  expect(rows.map(row => row.paymentId).sort()).toEqual(['a', 'b']);
  expect(rows.map(row => row.reason)).toEqual(['cancelled', 'cancelled']);
  expect(cancelTender).toHaveBeenCalledTimes(1);
  expect(result.current.voidError).toBeUndefined();
});

const lockedReason = 'The store already holds this payment.';
test.each([
  { payment: { ...takenCash('a', 1000), locked: true as const }, reason: lockedReason },
  { payment: takenCash('a', 1000), reason: AFTER_CLOSE_PAYMENTS_CHANGED, afterClose: {
    sessionId: 'closed', createdAt: '2026-11-28T11:00:00.000Z', payments: [{ id: 'a', method: 'cash', amountMinor: 1000 }],
    taxMinor: 0, fees: [], shipping: [],
  } },
  { payment: takenCash('a', 1000), kind: 'receipt' as const, reason: SALE_FINISHED },
  { payment: { id: 'a', method: 'cash', amountMinor: 1000, locked: true as const }, reason: lockedReason },
])('removeLeg refuses before journalling', async ({ payment, reason, afterClose, kind }) => {
  const { result, bulkInsert, voidTender, removeTender } = setup([payment], { afterClose }, kind);
  await act(async () => { await result.current.removeLeg(payment.id); });
  expect(bulkInsert).not.toHaveBeenCalled();
  expect(voidTender).not.toHaveBeenCalled();
  expect(removeTender).not.toHaveBeenCalled();
  expect(result.current.voidError).toBe(`The payment was kept: ${reason}`);
});

test('confirmCancel refuses before journalling when any live leg is refused', async () => {
  const { result, bulkInsert, voidTender, cancelTender } = setup([takenCash('a', 1000), { ...takenCash('b', 500), locked: true }]);
  await act(async () => { result.current.requestCancel(); });
  await act(async () => { await result.current.confirmCancel(); });
  expect(bulkInsert).not.toHaveBeenCalled();
  expect(voidTender).not.toHaveBeenCalled();
  expect(cancelTender).not.toHaveBeenCalled();
  expect(result.current.voidError).toBe(`The payment was kept: ${lockedReason}`);
  expect(result.current.cancelling).toBe(true);
});

test('removeLeg reports a void the sale refused after the journal write', async () => {
  const { result, voidTender, bulkInsert } = setup([takenCash('a', 1000)]);
  voidTender.mockReturnValueOnce(false);
  await act(async () => { await result.current.removeLeg('a'); });
  expect(bulkInsert).toHaveBeenCalledTimes(1);
  expect(bulkInsert.mock.calls[0][0]).toMatchObject([{ paymentId: 'a' }]);
  expect(voidTender.mock.calls).toEqual([['a']]);
  expect(result.current.voidError).toBe(VOID_RECORDED_KEPT);
});

test('confirmCancel reports a void the sale refused after the journal write', async () => {
  const { result, voidTender, bulkInsert, cancelTender } = setup([takenCash('a', 1000), takenCash('b', 500)]);
  voidTender.mockImplementation(id => id === 'b');
  await act(async () => { result.current.requestCancel(); });
  await act(async () => { await result.current.confirmCancel(); });
  expect(bulkInsert).toHaveBeenCalledTimes(1);
  expect(bulkInsert.mock.calls[0][0].map(row => row.paymentId).sort()).toEqual(['a', 'b']);
  expect(voidTender.mock.calls).toEqual([['b'], ['a']]);
  expect(cancelTender).not.toHaveBeenCalled();
  expect(result.current.voidError).toBe(VOID_RECORDED_KEPT);
});

test('removeLeg journals and voids a leg nothing refuses', async () => {
  const { result, voidTender, bulkInsert } = setup([takenCash('a', 1000)]);
  await act(async () => { await result.current.removeLeg('a'); });
  expect(bulkInsert).toHaveBeenCalledTimes(1);
  expect(bulkInsert.mock.calls[0][0]).toMatchObject([{ paymentId: 'a', reason: 'removed' }]);
  expect(voidTender.mock.calls).toEqual([['a']]);
  expect(result.current.voidError).toBeUndefined();
});
