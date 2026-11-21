import { formatMoney, type MoneyFormat, type StoreOrder } from '@tallyui/core';
import { orderReference } from '@tallyui/components';
import type { PosOrder } from '@tallyui/pos';
import { orderCustomerName } from './customer-name';
import { wooStatusLabel } from './order-history';

/** v2's status tones (packages/core/src/screens/main/orders/cells/status.tsx); any other status is 'default'. */
export type OrderTone = 'ok' | 'info' | 'warning' | 'bad' | 'muted' | 'default';
const STORE_TONES: Record<string, OrderTone> = {
  completed: 'ok', processing: 'info', 'pos-open': 'info', 'on-hold': 'warning', pending: 'warning',
  'pos-partial': 'warning', failed: 'bad', cancelled: 'muted', refunded: 'muted', trash: 'muted',
};
export function storeTone(status: string): OrderTone {
  return STORE_TONES[status] ?? 'default';
}

// This till's sales the store does not list yet, in the outbox's words (as OrdersList had them).
const LOCAL_STATUS: Record<PosOrder['syncStatus'], { label: string; tone: OrderTone }> = {
  pending: { label: 'Waiting to sync', tone: 'warning' },
  applied: { label: 'Synced', tone: 'ok' },
  rejected: { label: 'Not accepted', tone: 'bad' },
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The device's local calendar day as `yyyy-MM-dd` (v2 uses the store's timezone; the app has none yet). */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function relative(key: string, now: Date): string | null {
  if (key === dayKey(now)) return 'Today';
  return key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) ? 'Yesterday' : null;
}

/** v2's day heading (hooks/use-store-day-label.ts `heading`): Today, Yesterday, else 'EEEE, d MMM yyyy'. */
export function dayHeading(key: string, now: Date): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return relative(key, now) ?? `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** v2's `day` (hooks/use-store-day-label.ts): 'Today', 'Yesterday', else 'EEE d MMM'; '' when the date is unreadable. */
export function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return relative(dayKey(date), now) ?? `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** v2's Date Created cell (`dateTime`): 'Today · 14:41', 'Yesterday · 09:05', else 'EEE d MMM · HH:mm'. */
export function dateTimeLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = dayLabel(iso, now);
  return `${day} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type OrderTableRow = { kind: 'store'; order: StoreOrder } | { kind: 'local'; order: PosOrder };
export type OrderTableItem =
  | { type: 'day'; id: string; day: string; label: string }
  | ({ type: 'order'; id: string } & OrderTableRow);

const time = (row: OrderTableRow) => Date.parse(row.kind === 'store' ? row.order.placedAt : row.order.createdAt);

/**
 * v2's groupOrders (orders/day-heading.tsx): the store's orders and this till's sales the store does not
 * list yet (no store order's clientOrderId is theirs), newest first, with a day item before each new day.
 */
export function orderTableItems(local: readonly PosOrder[], store: readonly StoreOrder[], now: Date): OrderTableItem[] {
  const rows: OrderTableRow[] = [
    ...store.map(order => ({ kind: 'store' as const, order })),
    ...local.filter(order => !store.some(listed => listed.clientOrderId === order.id))
      .map(order => ({ kind: 'local' as const, order })),
  ].sort((a, b) => {
    const at = time(a);
    const bt = time(b);
    if (Number.isNaN(at)) return Number.isNaN(bt) ? 0 : 1;
    if (Number.isNaN(bt)) return -1;
    return bt - at;
  });
  const items: OrderTableItem[] = [];
  let previous: string | undefined;
  for (const row of rows) {
    const at = time(row);
    const day = Number.isNaN(at) ? undefined : dayKey(new Date(at));
    if (day && day !== previous) items.push({ type: 'day', id: `day-${day}`, day, label: dayHeading(day, now) });
    items.push({ type: 'order', id: `${row.kind}-${row.order.id}`, ...row });
    previous = day;
  }
  return items;
}

export interface OrderRowCells {
  statusLabel: string; tone: OrderTone; number: string; customer: string; date: string; day: string; payment: string; total: string;
  /** v2's refundTotal (orders/cells/total.tsx:41-44) as a negative amount, e.g. "-$4.50"; '' when there is none. */
  refunds: string;
}

/** The v2 columns this connector can fill: Status, Order Number, Customer, Date Created, Payment Method, Total; money in the store's format when given. */
export function orderRowCells(row: OrderTableRow, now: Date, format?: MoneyFormat): OrderRowCells {
  // v2 orders/row.tsx:47 names the customer with the same fallback as the order detail.
  const customer = orderCustomerName(row.order.customer);
  const total = formatMoney({ amount: row.order.totalMinor, currency: row.order.currency }, undefined, format) ?? '';
  if (row.kind === 'store') {
    const refunded = (row.order.refunds ?? []).reduce((sum, refund) => sum + Math.abs(refund.amountMinor), 0);
    const refunds = refunded > 0 ? `-${formatMoney({ amount: refunded, currency: row.order.currency }, undefined, format) ?? ''}` : '';
    return { statusLabel: wooStatusLabel(row.order.status), tone: storeTone(row.order.status), number: row.order.reference,
      day: dayLabel(row.order.placedAt, now),
      customer, date: dateTimeLabel(row.order.placedAt, now), payment: row.order.payments[0]?.title ?? '', total, refunds };
  }
  const status = LOCAL_STATUS[row.order.syncStatus];
  // The connector's rule for the order it sends: the largest payment names the method, Cash or Card.
  const primary = row.order.payments.reduce<PosOrder['payments'][number] | undefined>(
    (largest, payment) => (!largest || payment.amountMinor > largest.amountMinor ? payment : largest), undefined);
  return { statusLabel: status.label, tone: status.tone, number: orderReference(row.order), customer,
    day: dayLabel(row.order.createdAt, now),
    date: dateTimeLabel(row.order.createdAt, now), payment: primary ? (primary.method === 'cash' ? 'Cash' : 'Card') : '', total, refunds: '' };
}
