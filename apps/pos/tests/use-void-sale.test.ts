import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useVoidSale } from '../lib/sale/use-void-sale';

afterEach(cleanup);

test('Void is offered only for a cart with lines and no live payment', () => {
  for (const { lineItems, payments, offered } of [
    { lineItems: [{} as never], payments: [], offered: true },
    { lineItems: [{} as never], payments: [{} as never], offered: false },
    { lineItems: [{} as never], payments: [{ status: 'voided' } as never], offered: true },
    { lineItems: [{} as never], payments: [{ status: 'voided' } as never, {} as never], offered: false },
    { lineItems: [], payments: [], offered: false },
  ]) {
    const sale = {
      stage: { kind: 'cart' }, order: { lineItems, payments }, newSale: vi.fn(),
    };
    const { result } = renderHook(() => useVoidSale(sale as never, { resumeCart: vi.fn(), say: vi.fn() }));
    expect(result.current.offered).toBe(offered);
  }
});
