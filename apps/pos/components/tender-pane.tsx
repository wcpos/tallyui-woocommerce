import { useEffect, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Text } from '@tallyui/components';
import { formatMoney, minorUnitDigits } from '@tallyui/core';
import { activePlan, appliedMinor, changeMinor, initTenderState, planLegs, quickTenderedAmounts, tenderReducer } from '@tallyui/pos';
import type { TenderKey, useSale } from '@tallyui/pos';
import { useIsOnline } from '../lib/online/online-status';
import { filterChipClassName, filterChipTextClassName } from './catalogue-filter-chips';
import { EvenSplitTiles, PlanStrip } from './split-plan';
import { CardIcon, RegisterIcon } from './icons';

/** The single-payment path's two tiles: the connector maps cash to pos_cash and external to pos_card. */
const METHODS = [
  { id: 'pos_cash', method: 'cash', title: 'Cash', givesChange: true },
  { id: 'pos_card', method: 'external', title: 'Card', givesChange: false },
] as const;
/** WCPOS v2's keypad: no decimal key, digits shift in from the right in minor units. */
const KEY_ROWS: TenderKey[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['clear', '0', 'backspace']];
// WCPOS v2: tender-figures.ts:25.
const QUICK_TENDER_STEPS = [5, 10, 50] as const;
/** order.create's bound on `payments[].reference`, in UTF-16 units: a typed reference never goes past what finalize keeps. */
const REFERENCE_MAX = 255;

/**
 * WCPOS v2's tender pane for a store that takes one payment per order: tiles, keypad, change or refusal hint, one commit.
 * `multi` takes the order leg by leg (several payments per order); the leg that covers the balance completes the sale.
 */
export function TenderPane({ sale, multi = false }: { sale: ReturnType<typeof useSale>; multi?: boolean }): JSX.Element | null {
  const [state, dispatch] = useReducer(tenderReducer,
    { methodId: sale.stage.kind === 'tender' && sale.stage.method === 'cash' ? 'pos_cash' : 'pos_card', balanceMinor: multi ? sale.order.balanceDueMinor : sale.order.totalMinor },
    initTenderState);
  const [reference, setReference] = useState('');
  const [asking, setAsking] = useState(false);
  const online = useIsOnline();
  const due = multi ? sale.order.balanceDueMinor : sale.order.totalMinor;
  // WCPOS v2: tender-pane.tsx:337-352, 485-584.
  const since = sale.order.payments.slice(state.plan?.from ?? 0)
    .map(payment => ({ amountMinor: payment.amountMinor, title: payment.method === 'cash' ? 'Cash' : 'Card' }));
  // Multi: a removed leg raises the balance, and an entry the cashier hasn't touched follows it.
  useEffect(() => {
    if (multi && !state.entryDirty) dispatch({ type: 'tender-recorded', rowsSinceFrom: since, balanceMinor: due });
  }, [multi, due]);
  // Multi: one leg per tap; two taps before the new leg renders would otherwise take the same entry twice.
  const taking = useRef(false);
  useEffect(() => { taking.current = false; }, [sale.order.payments.length]);
  const { stage } = sale;
  if (stage.kind !== 'tender') return null;

  // One payment per order: the total is the balance (balanceDueMinor is 0 once card presets its payment). Multi: what is still due.
  const balance = due;
  // WCPOS v2: tender-pane.tsx:337-352, 485-584.
  const sinceRows = since.map(row => ({ minor: row.amountMinor, title: row.title }));
  const plan = multi ? activePlan(state.plan, since.length, balance) : null;
  const planned = plan ? planLegs(plan, sinceRows, balance) : null;
  const taken = sale.order.payments.map(payment => ({ minor: payment.amountMinor, title: payment.method === 'cash' ? 'Cash' : 'Card' }));
  const on = state.splitView || plan !== null;
  const method = METHODS.find(m => m.id === state.methodId)!;
  const applied = appliedMinor(state.entryMinor, balance);
  const dp = minorUnitDigits(sale.order.currency);
  const quick = method.givesChange ? quickTenderedAmounts(applied, QUICK_TENDER_STEPS.map(step => step * 10 ** dp)) : [];
  const change = changeMinor(state.entryMinor, applied, method.givesChange);
  const noChange = !method.givesChange && state.entryMinor > balance;
  const fmt = (amount: number) => formatMoney({ amount, currency: sale.order.currency }) ?? '';
  // WCPOS v2: tender-figures.ts:134,147 and tender-pane.tsx:285-334. A plan is measured against this payment's planned
  // share, not the balance: keeping the share reads empty, and less than it says where the shortfall goes.
  const shareDue = planned ? planned.thisPaymentMinor : balance;
  const toCome = planned ? planned.legs.filter(leg => leg.state === 'todo').length : 0;
  const short = `Less than planned · ${fmt(shareDue - applied)} moves to`;
  const hint = noChange ? `Only ${fmt(balance)} is due — ${method.title} can't give change`
    : state.entryMinor > 0 && applied < shareDue ? !planned ? `Part payment · ${fmt(balance - applied)} left after this`
      : toCome === 2 ? `${short} payments ${planned.label.n + 1} and ${planned.label.n + 2}`
        : toCome > 2 ? `${short} the next ${toCome} payments` : `${short} the next payment` : '';
  const legs = sale.order.payments.length;
  const suffix = planned ? ` · ${planned.label.n} of ${planned.label.ways}` : !multi ? '' : applied < balance ? ` · ${fmt(balance - applied)} left` : legs > 0 ? ' · pays it off' : '';
  // A failed save (saving with an error) offers Retry; paid in full with nothing saving offers the completion again.
  const finish = multi && (sale.saving ? sale.error !== null : balance === 0 && legs > 0);

  // WCPOS v2: use-tender-flow.ts:853-872. Offline every tile settles later, so a press with money due asks first;
  // the gate is held across the question, so a second press cannot open a second prompt.
  function press() {
    if (taking.current) return;
    if (!online && balance > 0) { taking.current = true; setAsking(true); return; }
    take();
  }
  const cancelOffline = () => { taking.current = false; setAsking(false); };
  const confirmOffline = () => { taking.current = false; setAsking(false); take(); };

  function take() {
    if (taking.current) return;
    if (multi) {
      taking.current = true;
      // One leg of several: cash carries what was tendered, card what applies; the leg that covers the balance completes the sale.
      // A refusal (null) or a throw frees the next tap; the throw still propagates.
      let id: ReturnType<typeof sale.addTender> = null;
      try {
        id = method.method === 'cash'
          ? sale.addTender({ method: 'cash', amountMinor: state.entryMinor })
          : sale.addTender({ method: 'external', amountMinor: applied, ...(reference ? { reference } : {}) });
      } finally {
        if (id === null) taking.current = false;
      }
      if (id === null) return;
      setReference('');
      if (applied >= balance) { void sale.complete(); return; }
      dispatch({ type: 'tender-recorded', rowsSinceFrom: [...since, { amountMinor: applied, title: method.title }], balanceMinor: balance - applied });
      return;
    }
    // Cash carries the amount tendered; finalize caps it at the total and works out the change.
    if (method.method === 'cash') sale.setTender({ method: 'cash', amountMinor: state.entryMinor });
    else sale.setTender({ method: 'external', amountMinor: applied, ...(reference ? { reference } : {}) });
    void sale.complete();
  }

  return <View dataSet={{ print: 'hide' }} testID="checkout-tender" className="gap-4 p-4">
    <View className="flex-row gap-2">
      {METHODS.map(m => {
        const selected = m.id === state.methodId;
        return <Pressable key={m.id} accessibilityRole="button" testID={`checkout-method-${m.id}`}
          aria-selected={selected} accessibilityState={{ selected }}
          className={`flex-1 items-center gap-1 rounded-lg border px-4 py-3 ${selected ? 'border-primary bg-muted' : 'border-border bg-card'}`}
          onPress={() => {
            dispatch({ type: 'pick-method', methodId: m.id, prefillMinor: planned?.thisPaymentMinor ?? balance, readerId: null });
            if (!multi && m.method !== stage.method) sale.startTender(m.method);
            if (m.method === 'cash') setReference('');
          }}>
          {/* WCPOS v2: tender-pane.tsx:280 draws methodIcon (:1030) above the title: register for cash, card for the rest; 18 px (icon/index.tsx:27). */}
          {m.method === 'cash'
            ? <RegisterIcon testID={`checkout-method-icon-${m.id}-register`} size={18} strokeWidth={1.5} className="text-foreground" />
            : <CardIcon testID={`checkout-method-icon-${m.id}-card`} size={18} strokeWidth={1.5} className="text-foreground" />}
          <Text className="text-base font-semibold text-foreground">{m.title}</Text>
          {/* WCPOS v2: tender-pane.tsx MethodStatus (ADR 0040 rule 1): a tile taken offline says it is sent later, and the risk. */}
          {!online && <View testID={`checkout-method-sent-later-${m.id}`}>
            <Text className="text-center text-xs text-warning">Sent later</Text>
            <Text className="text-center text-xs text-warning">Store may refuse</Text>
          </View>}
        </Pressable>;
      })}
    </View>
    {/* WCPOS v2: tender-pane.tsx:415-429. */}
    <View className="flex-row items-center justify-center gap-2">
      <Text testID="checkout-label" className="text-center text-sm text-muted-foreground">
        {planned ? `Payment ${planned.label.n} of ${planned.label.ways} · ${fmt(balance)} left` : multi && legs > 0 ? `Payment ${legs + 1} · ${fmt(balance)} left`
          : <>To pay{state.entryMinor !== balance ? <>{' '}<Text testID="checkout-balance" className="tabular-nums">{fmt(balance)}</Text></> : null}</>}
      </Text>
      {multi && balance > 0 && <Pressable accessibilityRole="button" testID="checkout-split-chip" aria-pressed={on}
        className={filterChipClassName(on)} disabled={sale.saving}
        onPress={() => dispatch(on ? { type: 'clear-plan', balanceMinor: balance } : { type: 'open-split' })}>
        <Text className={filterChipTextClassName(on)}>Split</Text>
      </Pressable>}
      {/* WCPOS v2: tender-pane.tsx:430-434. */}
      {!online && <Text testID="checkout-offline" className="text-xs text-warning">Offline</Text>}
    </View>
    {change > 0 ? <>
      {/* WCPOS v2: tender-pane.tsx:437-449; change is the ok tone, and a later leg names the order total. */}
      <Text testID="checkout-entry-hint" className="text-center text-3xl font-semibold text-success">{`Change ${fmt(change)}`}</Text>
      <Text testID="checkout-tendered-line" className="text-center text-base text-muted-foreground">Tendered <Text testID="checkout-entry" className="tabular-nums">{fmt(state.entryMinor)}</Text>
        {sale.order.totalMinor !== balance ? ` · Total ${fmt(sale.order.totalMinor)}` : ''}</Text>
    </> : <>
      <Text testID="checkout-entry" className={`text-center text-4xl font-semibold tabular-nums text-foreground ${state.entryDirty ? '' : 'opacity-70'}`}>{fmt(state.entryMinor)}</Text>
      <Text testID="checkout-entry-hint" className={`min-h-6 text-center ${noChange ? 'text-warning' : 'text-muted-foreground'}`}>{hint}</Text>
    </>}
    {/* WCPOS v2: tender-pane.tsx:721 and 893-918. */}
    <View testID="checkout-helpers" className="w-full flex-row flex-wrap justify-center gap-2">
      {/* WCPOS v2: tender-pane.tsx:732-777. */}
      {multi && state.splitView && !plan && <EvenSplitTiles restMinor={balance} fmt={fmt} disabled={sale.saving}
        onPick={ways => dispatch({ type: 'set-plan', plan: { kind: 'even', ways, from: sale.order.payments.length }, balanceMinor: balance })} />}
      {quick.map(minor => <Pressable key={minor} accessibilityRole="button" testID={`checkout-quick-${minor / 10 ** dp}`}
        className={filterChipClassName(false)} disabled={sale.saving} onPress={() => dispatch({ type: 'set-entry', minor })}>
        <Text className={filterChipTextClassName(false)}>{fmt(minor)}</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" testID={method.givesChange ? 'checkout-quick-exact' : 'checkout-quick-balance'}
        className={filterChipClassName(false)} disabled={sale.saving} onPress={() => dispatch({ type: 'set-entry', minor: balance })}>
        <Text className={filterChipTextClassName(false)}>
          {method.givesChange ? `Exact ${fmt(balance)}` : state.entryMinor === balance ? 'Full balance' : `Full balance ${fmt(balance)}`}
        </Text>
      </Pressable>
    </View>
    {/* WCPOS v2: tender-pane.tsx:337-352, 485-584. */}
    {planned && <PlanStrip legs={planned.legs} taken={taken} paidMinor={taken.reduce((sum, row) => sum + row.minor, 0)} fmt={fmt} disabled={sale.saving}
      onChange={() => { dispatch({ type: 'clear-plan', balanceMinor: balance }); dispatch({ type: 'open-split' }); }} />}
    <View testID="checkout-keypad" className="gap-2">
      {KEY_ROWS.map(row => <View key={row.join()} className="flex-row gap-2">
        {row.map(key => <Pressable key={key} accessibilityRole="button" testID={`checkout-keypad-key-${key}`}
          accessibilityLabel={key === 'clear' ? 'C' : key === 'backspace' ? 'Delete last digit' : key}
          className="min-h-12 flex-1 items-center justify-center rounded-lg bg-muted" onPress={() => dispatch({ type: 'key', key })}>
          <Text className="text-xl font-semibold text-foreground">{key === 'clear' ? 'C' : key === 'backspace' ? '⌫' : key}</Text>
        </Pressable>)}
      </View>)}
    </View>
    {method.method === 'external' ? <TextInput accessibilityLabel="Terminal reference" placeholder="Terminal reference" maxLength={REFERENCE_MAX}
      value={reference} onChangeText={setReference} className="rounded-md border border-border px-3 py-2 text-foreground" /> : null}
    <Button size="lg" testID="checkout-commit" disabled={finish ? false : sale.saving || applied <= 0 || (!multi && applied < balance) || noChange}
      onPress={finish ? () => { void sale.complete(); } : press}>
      <Text>{finish ? sale.error ? 'Retry' : 'Complete sale' : sale.saving ? 'Saving order…' : `Take ${fmt(applied)} in ${method.title}${suffix}`}</Text>
    </Button>
    {sale.error ? <Text accessibilityRole="alert" className="text-destructive">{sale.error}</Text> : null}
    {sale.canContinue ? <>
      <Text className="text-foreground">This sale is stored and will be sent. Continue to the next sale.</Text>
      <Pressable accessibilityRole="button" onPress={() => sale.continueSale()} className="rounded-md bg-primary px-4 py-3">
        <Text className="text-center font-semibold text-primary-foreground">Continue</Text>
      </Pressable>
    </> : null}
    <Button variant="outline" onPress={() => sale.cancelTender()}><Text>Back</Text></Button>
    {/* WCPOS v2: use-confirm.tsx:46-63; the amount is the one that will be recorded, not the keyed entry. */}
    {asking && <AlertDialog open onOpenChange={next => { if (!next) cancelOffline(); }}>
      <AlertDialogContent testID="checkout-offline-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{`Take ${fmt(applied)} in ${method.title} while offline?`}</AlertDialogTitle>
          <AlertDialogDescription>The sale is held on this device and sent when the store is back. If the store refuses it, the sale appears under Needs attention in Orders.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={cancelOffline}><Button variant="outline" testID="checkout-offline-cancel"><Text>Cancel</Text></Button></AlertDialogCancel>
          <AlertDialogAction asChild onPress={confirmOffline}><Button testID="checkout-offline-confirm"><Text>{`Take ${fmt(applied)} in ${method.title}`}</Text></Button></AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </View>;
}
