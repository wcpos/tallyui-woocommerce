import { orderReference } from '@tallyui/components';
import type { DayRange, PosOrder } from '@tallyui/pos';
import { cashierNameFor } from '../auth/cashier-name';
import type { CategoryFigures } from './category-figures';
import type { ProductFigure } from './product-figures';
import { rangeBounds, type Period } from './sales-room';

export type SalesTable = {
  title: string;
  head: string[];
  align: ('left' | 'right')[];
  rows: { key: string; cells: string[] }[];
  total: string[];
  status: string;
  /** The empty line, from v2: orders-panel.tsx:86, cards/payments.tsx:44, cards/where-sold.tsx:80 (taxes has none, so the generic one). */
  empty: string;
};

/** A share of the total to one decimal, a dash when the total is nothing. */
const percentOf = (minor: number, totalMinor: number) =>
  totalMinor === 0 ? '—' : `${(Math.round(minor * 1000 / totalMinor) / 10).toFixed(1)}%`;
const statusOf = (count: number, total: string) => `${count} ${count === 1 ? 'order' : 'orders'} · ${total}`;

export function paymentsTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  return {
    title: 'Sales by payment method',
    empty: 'No payments in this period',
    head: ['Method', 'Orders', 'Amount', 'Share'],
    align: ['left', 'right', 'right', 'right'],
    rows: [...period.byMethod].sort((a, b) => b.totalMinor - a.totalMinor || a.label.localeCompare(b.label)).map(row => ({
      key: row.method,
      cells: [row.label, String(row.count), format(row.totalMinor), percentOf(row.totalMinor, period.totalMinor)],
    })),
    total: ['Total', String(period.count), format(period.totalMinor), ''],
    status: `${period.count} ${period.count === 1 ? 'order' : 'orders'} · ${format(period.totalMinor)}`,
  };
}

// v2 panels/specs.ts:293-334 channels view: every Tally sale is in store.
export function whereSoldTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  const share = period.totalMinor === 0 ? '—' : '100.0%';
  return {
    title: 'Channels',
    empty: 'No sales in this period',
    head: ['Channel', 'Orders', 'Amount', 'Share'],
    align: ['left', 'right', 'right', 'right'],
    rows: period.count === 0 ? [] : [{
      key: 'store', cells: ['In store', String(period.count), format(period.totalMinor), share],
    }],
    total: ['Total', String(period.count), format(period.totalMinor), period.count === 0 ? '' : share],
    status: `${period.count} ${period.count === 1 ? 'order' : 'orders'} · ${format(period.totalMinor)}`,
  };
}

export function taxesTable(period: Period, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  return {
    title: 'Taxes collected',
    empty: 'No sales in this period',
    head: ['Rate', 'Net', 'Tax', 'Gross'],
    align: ['left', 'right', 'right', 'right'],
    rows: [...period.taxRates].sort((a, b) => a.ratePpm - b.ratePpm).map(row => ({
      key: String(row.ratePpm),
      cells: [row.label, row.netMinor === null ? '—' : format(row.netMinor), format(row.taxMinor), row.grossMinor === null ? '—' : format(row.grossMinor)],
    })),
    total: ['Total', format(period.totalMinor - period.taxMinor), format(period.taxMinor), format(period.totalMinor)],
    status: `${period.count} ${period.count === 1 ? 'order' : 'orders'} · ${format(period.totalMinor)}`,
  };
}

export function ordersTable(
  orders: readonly PosOrder[],
  options: { range: DayRange; currency: string; money: (minor: number) => string | undefined; leftOut?: ReadonlySet<string>;
    cashiers?: readonly { id: string; name: string }[] },
): SalesTable {
  const { range, currency, money, leftOut = new Set<string>(), cashiers = [] } = options;
  const format = (minor: number) => money(minor) ?? '';
  const { startIso, endIso } = rangeBounds(range);
  // A refused order is no sale (sales-room.ts, sheet-figures.ts): not a row; the hero's "Not accepted" line counts it.
  const today = orders.filter(order => order.currency === currency && order.createdAt >= startIso && order.createdAt < endIso
    && order.syncStatus !== 'rejected')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  // v2 panels/specs.ts:188-222: every order in range is a row with a Counted Yes/No; the footer sums the counted ones.
  // Head :190 and total :221; the Cashier cell is the Cashiers card's label, not v2's bare "Unknown" for an unnamed id.
  const counted = today.filter(order => !leftOut.has(order.id));
  const sum = counted.reduce((total, order) => total + order.totalMinor, 0);
  return {
    title: 'Orders',
    empty: 'No orders in this period',
    head: ['Order', 'Time', 'Cashier', 'Paid by', 'Total', 'Counted'],
    align: ['left', 'left', 'left', 'left', 'right', 'left'],
    rows: today.map(order => {
      const date = new Date(order.createdAt);
      const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const paidBy = [...new Set(order.payments.map(payment => payment.method))]
        .map(method => method === 'cash' ? 'Cash' : 'Card terminal').join(' + ');
      return { key: order.id, cells: [orderReference(order), time, cashierLabel(cashiers, order.cashierRef ?? ''), paidBy,
        format(order.totalMinor), leftOut.has(order.id) ? 'No' : 'Yes'] };
    }),
    total: ['Counted', '', '', '', format(sum), ''],
    // v2 panel.tsx:254-259 `reports.orders_counted`, and `reports.orders_counted_left_out` when any is left out.
    status: `${counted.length} of ${today.length} counted${counted.length < today.length ? ' · the numbers follow' : ''}`,
  };
}

/** v2 panels/specs.ts:235-256: every product in the card's figures; the total sums the lines, not the orders. */
export function productsTable(period: Period, products: readonly ProductFigure[], money: (minor: number) => string | undefined,
  filtered = false): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  const amount = format(products.reduce((sum, row) => sum + row.amountMinor, 0));
  return {
    title: 'Top products',
    empty: 'No sales in this period',
    head: ['Product', 'Qty', 'Amount'],
    align: ['left', 'right', 'right'],
    rows: products.map(row => ({ key: row.key, cells: [row.name || 'Unknown', String(row.quantity), format(row.amountMinor)] })),
    total: ['All products', String(products.reduce((sum, row) => sum + row.quantity, 0)), amount],
    // v2 reports.products_status while a category narrows the rows: the rows shown and their amount.
    status: filtered ? `${products.length} products · ${amount}` : statusOf(period.count, format(period.totalMinor)),
  };
}

/** v2 panels/specs.ts:257-291: the card's category parts, each sharing the period total as the card's donut does. */
export function categoriesTable(period: Period, categories: CategoryFigures, money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  const { parts } = categories;
  return {
    title: 'Sales by category',
    empty: 'No sales in this period',
    head: ['Category', 'Qty', 'Amount', 'Share'],
    align: ['left', 'right', 'right', 'right'],
    rows: parts.map(row => ({
      key: row.key, cells: [row.label, String(row.quantity), format(row.amountMinor), percentOf(row.amountMinor, period.totalMinor)],
    })),
    total: ['Total', String(parts.reduce((sum, row) => sum + row.quantity, 0)),
      format(parts.reduce((sum, row) => sum + row.amountMinor, 0)), ''],
    status: statusOf(period.count, format(period.totalMinor)),
  };
}

/** A cashier's name on this device, else "Cashier #id" (`cashierNameFor`), else Unknown for an order with none: the
 *  Cashiers card's and table's. */
export const cashierLabel = (cashiers: readonly { id: string; name: string }[], ref: string) =>
  ref ? cashierNameFor(cashiers, ref) : 'Unknown';

/** v2 panels/specs.ts:335-355: each cashier's orders, average order and takings; the total row is the period's. */
export function cashiersTable(period: Period, cashiers: readonly { id: string; name: string }[],
  money: (minor: number) => string | undefined): SalesTable {
  const format = (minor: number) => money(minor) ?? '';
  return {
    title: 'Sales by cashier',
    empty: 'No sales in this period',
    head: ['Cashier', 'Orders', 'Avg order', 'Amount'],
    align: ['left', 'right', 'right', 'right'],
    rows: period.byCashier.map(row => ({
      key: row.cashierRef || 'unknown',
      cells: [cashierLabel(cashiers, row.cashierRef), String(row.count),
        format(row.count ? Math.round(row.totalMinor / row.count) : 0), format(row.totalMinor)],
    })),
    total: ['Total', String(period.count), format(period.averageMinor), format(period.totalMinor)],
    status: statusOf(period.count, format(period.totalMinor)),
  };
}
