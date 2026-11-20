import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { SentOrder } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { OpenSaleReceipt } from '../components/open-sale-receipt';
import { memoryStorage } from './memory-storage';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const order: SentOrder = {
  id: 'open-sale-12345678', status: 'draft', createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z',
  currency: 'USD', pricesIncludeTax: false, customer: null, note: '', discounts: [], payments: [],
  lineItems: [{ id: 'l1', productId: '80', name: 'Espresso', sku: 'ESP', quantity: 1, unitPriceMinor: 300,
    discountMinor: 0, orderDiscountMinor: 0, netMinor: 300, taxMicros: '0', taxInclusive: false, taxLines: [], discounts: [] }],
  subtotalMinor: 300, discountMinor: 0, taxMinor: 0, totalMinor: 300, paidMinor: 0, balanceDueMinor: 300, changeDueMinor: 0,
  display: { taxInclusive: false, subtotalMinor: 300, discountMinor: 0, taxMinor: 0, totalMinor: 300, orderDiscountMinor: 0,
    lines: [{ lineId: 'l1', amountMinor: 300, discounts: [] }] },
};
const config = { storeName: 'Test Store', cashier: 'Paul', registerName: 'This till' };

test('closed renders nothing', () => {
  const view = render(<><OpenSaleReceipt open={false} onClose={vi.fn()} side="left" order={order} config={config} /><PortalHost /></>);
  expect(view.container.innerHTML).toBe('');
});

test('an unpaid open sale shows Not paid with the total due, the draft reference and no Change row', () => {
  render(<><OpenSaleReceipt open onClose={vi.fn()} side="left" order={order} config={config} /><PortalHost /></>);
  expect(screen.getByTestId('open-sale-receipt-title').textContent).toBe('Receipt');
  expect(screen.getByTestId('receipt-not-paid').textContent).toMatch(/^Not paid · .+ due$/);
  expect(screen.getByTestId('receipt-not-paid').textContent).toBe('Not paid · $3.00 due');
  expect(screen.getByTestId('receipt-order').textContent).toBe(`Order ${order.id.slice(-8)} (draft)`);
  expect(screen.queryByLabelText(/^Change:/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Print receipt' })).not.toBeNull();
});

test('a fully paid order shows no Not paid line', () => {
  const paid: SentOrder = { ...order, paidMinor: 300, balanceDueMinor: 0,
    payments: [{ id: 'p1', method: 'cash', amountMinor: 100 }, { id: 'p2', method: 'external', amountMinor: 200 }] };
  render(<><OpenSaleReceipt open onClose={vi.fn()} side="left" order={paid} config={config} /><PortalHost /></>);
  expect(screen.queryByTestId('receipt-not-paid')).toBeNull();
});

test('Close and the X call onClose', () => {
  const onClose = vi.fn();
  render(<><OpenSaleReceipt open onClose={onClose} side="left" order={order} config={config} /><PortalHost /></>);
  fireEvent.click(within(screen.getByTestId('receipt-print-area')).getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledExactlyOnceWith();
  expect(screen.getByTestId('open-sale-receipt-x').getAttribute('aria-label')).toBe('Close');
  fireEvent.click(screen.getByTestId('open-sale-receipt-x'));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('printing the bill records no print count', () => {
  render(<><OpenSaleReceipt open onClose={vi.fn()} side="left" order={order} config={config} /><PortalHost /></>);
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    expect(key).not.toContain(order.id);
    expect(localStorage.getItem(key)).not.toContain(order.id);
  }
  expect(screen.queryByTestId('receipt-print-again')).toBeNull();
});
