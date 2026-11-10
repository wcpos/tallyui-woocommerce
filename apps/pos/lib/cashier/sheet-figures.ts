import { useEffect, useState } from 'react';
import type { RxCollection } from 'rxdb';
import { formatMoney } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import { dayRange } from '../reports/today-sales';

export interface SalesTotal { count: number; totalMinor: number }

/** This cashier's orders in [startIso, endIso) and in `currency`; orders the store refused are not sales. */
export function cashierSalesTotal(
  orders: readonly PosOrder[],
  { cashierRef, currency, startIso, endIso }: { cashierRef: string; currency: string; startIso: string; endIso: string },
): SalesTotal {
  const sales = orders.filter(order => order.cashierRef === cashierRef && order.currency === currency
    && order.syncStatus !== 'rejected' && startIso <= order.createdAt && order.createdAt < endIso);
  return { count: sales.length, totalMinor: sales.reduce((sum, order) => sum + order.totalMinor, 0) };
}

/** Live total of this cashier's sales today (device-local day, fixed when the hook mounts). */
export function useCashierSalesToday(orders: RxCollection<PosOrder>, cashierRef: string, currency: string): SalesTotal {
  const [range] = useState(() => dayRange(new Date()));
  const [total, setTotal] = useState<SalesTotal>({ count: 0, totalMinor: 0 });
  useEffect(() => {
    const subscription = orders.find({ selector: { createdAt: { $gte: range.startIso, $lt: range.endIso } } }).$
      .subscribe(docs => setTotal(cashierSalesTotal(docs.map(doc => doc.toMutableJSON()), { cashierRef, currency, ...range })));
    return () => subscription.unsubscribe();
  }, [orders, cashierRef, currency, range]);
  return total;
}

/** Minor units as store money; falls back to the bare number when formatMoney cannot format. */
export function sheetMoney(minor: number, currency: string, locale?: string): string {
  return formatMoney({ amount: minor, currency }, (locale ?? 'en-US').replaceAll('_', '-')) ?? String(minor);
}

/** The "In the drawer" value, or undefined when the sheet shows no drawer. */
export function drawerFigureText(
  register: {
    enabled: boolean;
    session: { status: string } | null;
    expected: Record<string, number>;
    lastClosure?: { number: number } | null;
  } | null,
  money: (minor: number) => string,
): string | undefined {
  if (!register?.enabled) return undefined;
  if (register.session?.status === 'open' || register.session?.status === 'counting') {
    return money(register.expected.cash ?? 0);
  }
  if (register.lastClosure) return `Register closed · last closure ${register.lastClosure.number}`;
  return undefined;
}
