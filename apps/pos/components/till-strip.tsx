import { useEffect, useState, type JSX } from 'react';
import { Pressable, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Path } from 'react-native-svg';
import { Button, createSvgIcon, IconButton, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { formatClosureDate, replacedOrderIds, type Closure, type PosOrder } from '@tallyui/pos';
import { useRegister } from '../lib/register/register-context';
import { openedAtLabel } from './session-card';

// lucide `chevron-right`, v2's `chevronRight` on `till-closures`.
const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Path d="m9 18 6-6-6-6" />);

/** Tone of a closure's drawer result: short is destructive, over is success, exact is muted. */
export function drawerResultClass(varianceMinor: number): string {
  return varianceMinor < 0 ? 'text-destructive' : varianceMinor > 0 ? 'text-success' : 'text-muted-foreground';
}

export function TillStrip({ orders, currency, locale, resolveCashierName, onPrintXReport, onReprint, onOpenClosure, onOpenClosures }: {
  orders: RxCollection<PosOrder> | null;
  currency: string; locale: string;
  resolveCashierName(id: string): string;
  /** v2's `till-actions`: Print X-report while the session is open, Print closure for the last one when closed. */
  onPrintXReport?(): void;
  onReprint?(closure: Closure): void;
  /** v2's `till-last-closure` press opens that closure. */
  onOpenClosure?(closure: Closure): void;
  /** v2's `till-closures` chevron: opens the Closures room. */
  onOpenClosures?(): void;
}): JSX.Element {
  const register = useRegister();
  const bound = register.enabled;
  const session = register.session;
  const active = bound && (session?.status === 'open' || session?.status === 'counting');
  const closure = bound ? register.lastClosure ?? null : null;
  const id = active ? session.id : null;
  const [sessionOrders, setSessionOrders] = useState<PosOrder[]>([]);

  useEffect(() => {
    if (!orders || !id) { setSessionOrders([]); return; }
    const subscription = orders.find({ selector: { sessionId: id } }).$
      .subscribe(docs => setSessionOrders(docs.map(doc => doc.toMutableJSON())));
    return () => subscription.unsubscribe();
  }, [orders, id]);

  const money = (amount: number) => formatMoney({ amount, currency }, locale) ?? '';
  const v = closure?.variance.cash ?? 0;
  const resultText = v === 0 ? 'Exact' : `${money(Math.abs(v))} ${v < 0 ? 'short' : 'over'}`;
  const resultColor = drawerResultClass(v);
  const rows: [string, string, string, string][] = [];
  let note = '';
  if (active && !register.blind) {
    const own = register.movements.filter(row => row.session_id === session.id);
    const live = own.filter(row => row.type !== 'void' && !row.voided_by && !own.some(entry => entry.voids === row.id));
    const voids = own.filter(row => row.type === 'void').length;
    const noSales = live.filter(row => row.type === 'no_sale').length;
    const paidIn = live.filter(row => row.type === 'paid_in').sort((a, b) => a.created_at_gmt.localeCompare(b.created_at_gmt));
    const paidOut = live.filter(row => row.type === 'paid_out');
    const replaced = replacedOrderIds(sessionOrders);
    let amount = 0;
    let count = 0;
    for (const order of sessionOrders) {
      if (replaced.has(order.id)) continue;
      const cash = order.payments.filter(payment => payment.method === 'cash');
      amount += cash.reduce((sum, payment) => sum + payment.amountMinor, 0);
      if (cash.length > 0) count++;
    }
    rows.push(['till-term-float', '', 'Opening float', money(session.counted_float_minor)]);
    if (count > 0) rows.push(['till-term-cash-sales', '+', `Cash sales · ${count}`, money(amount)]);
    if (paidIn.length > 2) {
      rows.push(['till-term-paid-in', '+', `Paid in · ${paidIn.length}`, money(paidIn.reduce((sum, row) => sum + row.amountMinor, 0))]);
    } else {
      paidIn.forEach((row, index) => rows.push([`till-term-paid-in-${index}`, '+', ['Paid in', row.reason].filter(Boolean).join(' · '), money(row.amountMinor)]));
    }
    if (paidOut.length > 0) {
      rows.push(['till-term-paid-out', '−', `Paid out · ${paidOut.length === 1 ? paidOut[0].reason : paidOut.length}`, money(paidOut.reduce((sum, row) => sum + row.amountMinor, 0))]);
    }
    rows.push(['till-expected', '=', 'Expected in drawer', money(register.expected.cash ?? 0)]);
    note = [noSales ? (noSales === 1 ? '1 no-sale' : `${noSales} no-sales`) : '', voids ? (voids === 1 ? '1 void' : `${voids} voids`) : ''].filter(Boolean).join(' · ');
  } else if (!active && closure && !register.blind) {
    rows.push(
      ['till-expected', '', 'Expected', money(closure.expected.cash ?? 0)],
      ['till-counted', '·', 'Counted', money(closure.counted.cash ?? 0)],
      ['till-result', '=', 'Drawer result', resultText],
    );
  }

  const f = closure ? formatClosureDate(closure.closed_at, { timezone: 'device', locale }) : null;
  let heading = '';
  if (f) {
    const now = new Date();
    const today = formatClosureDate(now.toISOString(), { timezone: 'device', locale }).date_ymd;
    const yesterday = formatClosureDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString(), { timezone: 'device', locale }).date_ymd;
    heading = f.date_ymd === today ? 'Today' : f.date_ymd === yesterday ? 'Yesterday' : `${f.weekday_short} ${Number(f.day)} ${f.month_short}`;
  }
  const since = active
    ? `since ${openedAtLabel(session.opened_at_gmt, locale)} · ${session.opened_by ? resolveCashierName(session.opened_by) : 'Cashier'}`
    : closure && f ? `Closed ${f.time} · ${closure.closed_by ? resolveCashierName(closure.closed_by) : 'Cashier'}` : '';
  const printable = bound && (active ? !register.blind : !!closure);
  const lastLine = closure && f && <Text testID={onOpenClosure ? undefined : 'till-last-closure'} className="text-muted-foreground">
    {`Last closure #${closure.number} · ${heading} ${f.time}`}
    {!register.blind && <>{' · '}<Text testID="till-last-result" className={resultColor}>{resultText}</Text></>}
  </Text>;

  return (
    <View testID="reports-till" className="gap-3 rounded-lg border border-border p-4">
      <View testID="till-title" className="gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-semibold">{bound ? 'This till' : 'No register on this device'}</Text>
          {bound && <Text testID="till-status" className={active ? 'text-success' : 'text-muted-foreground'}>{active ? '● Open' : '● Closed'}</Text>}
          {bound && since && <Text testID="till-since" className="text-muted-foreground">{since}</Text>}
        </View>
        {closure && lastLine && (onOpenClosure
          ? <Pressable testID="till-last-closure" accessibilityRole="button" className="self-start" onPress={() => onOpenClosure(closure)}>{lastLine}</Pressable>
          : lastLine)}
      </View>
      {rows.length > 0 && <View testID="till-equation" className="flex-row flex-wrap items-center gap-2">
        {rows.map(([id, sign, label, amount]) => {
          const primary = active && sign === '=';
          return <View key={id} className="flex-row items-center gap-2">
            {!!sign && <Text className="font-semibold text-muted-foreground">{sign}</Text>}
            <View testID={id} className={`flex-row items-center gap-2 rounded-md px-2.5 py-1 ${primary ? 'bg-primary' : 'bg-muted'}`}>
              <Text className={`text-sm ${primary ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{label}</Text>
              <Text testID={`${id}-amount`} className={`font-semibold tabular-nums ${primary ? 'text-primary-foreground' : id === 'till-result' ? resultColor : 'text-foreground'}`}>{amount}</Text>
            </View>
          </View>;
        })}
        {!!note && <Text testID="till-note" className="text-muted-foreground">{note}</Text>}
      </View>}
      {(printable || onOpenClosures) && <View testID="till-actions" className="flex-row flex-wrap items-center gap-2">
        {/* A blind cashier gets no X-report, as on the session card: the X print carries the expected cash. */}
        {printable && (active
          ? <Button testID="till-xreport" variant="outline" onPress={onPrintXReport}><Text>Print X-report</Text></Button>
          : closure && <Button testID="till-reprint" variant="outline" onPress={() => onReprint?.(closure)}><Text>Print closure</Text></Button>)}
        {/* v2 till-strip.tsx `till-closures`: the chevron at the end of the actions is the way into Closures. */}
        {onOpenClosures && <IconButton testID="till-closures" variant="ghost" accessibilityLabel="Closures" onPress={onOpenClosures}>
          <ChevronRightIcon size={20} />
        </IconButton>}
      </View>}
    </View>
  );
}
