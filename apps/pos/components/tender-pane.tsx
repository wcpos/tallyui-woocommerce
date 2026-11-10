import { useEffect, useReducer, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { appliedMinor, changeMinor, initTenderState, tenderReducer } from '@tallyui/pos';
import type { TenderKey, useSale } from '@tallyui/pos';

/** The single-payment path's two tiles: the connector maps cash to pos_cash and external to pos_card. */
const METHODS = [
  { id: 'pos_cash', method: 'cash', title: 'Cash', givesChange: true },
  { id: 'pos_card', method: 'external', title: 'Card', givesChange: false },
] as const;
/** WCPOS v2's keypad: no decimal key, digits shift in from the right in minor units. */
const KEY_ROWS: TenderKey[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['clear', '0', 'backspace']];
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
  const due = multi ? sale.order.balanceDueMinor : sale.order.totalMinor;
  // Multi: a removed leg raises the balance, and an entry the cashier hasn't touched follows it.
  useEffect(() => {
    if (multi && !state.entryDirty) dispatch({ type: 'tender-recorded', rowsSinceFrom: [], balanceMinor: due });
  }, [multi, due]);
  // Multi: one leg per tap; two taps before the new leg renders would otherwise take the same entry twice.
  const taking = useRef(false);
  useEffect(() => { taking.current = false; }, [sale.order.payments.length]);
  const { stage } = sale;
  if (stage.kind !== 'tender') return null;

  // One payment per order: the total is the balance (balanceDueMinor is 0 once card presets its payment). Multi: what is still due.
  const balance = due;
  const method = METHODS.find(m => m.id === state.methodId)!;
  const applied = appliedMinor(state.entryMinor, balance);
  const change = changeMinor(state.entryMinor, applied, method.givesChange);
  const noChange = !method.givesChange && state.entryMinor > balance;
  const fmt = (amount: number) => formatMoney({ amount, currency: sale.order.currency }) ?? '';
  const hint = noChange ? `Only ${fmt(balance)} is due — ${method.title} can't give change`
    : state.entryMinor > 0 && applied < balance ? `${fmt(balance - applied)} left` : '';
  const legs = sale.order.payments.length;
  const suffix = !multi ? '' : applied < balance ? ` · ${fmt(balance - applied)} left` : legs > 0 ? ' · pays it off' : '';
  // A failed save (saving with an error) offers Retry; paid in full with nothing saving offers the completion again.
  const finish = multi && (sale.saving ? sale.error !== null : balance === 0 && legs > 0);

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
      dispatch({ type: 'tender-recorded', rowsSinceFrom: [], balanceMinor: balance - applied });
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
          className={`flex-1 items-center rounded-lg border px-4 py-3 ${selected ? 'border-primary bg-muted' : 'border-border bg-card'}`}
          onPress={() => {
            dispatch({ type: 'pick-method', methodId: m.id, prefillMinor: balance, readerId: null });
            if (!multi && m.method !== stage.method) sale.startTender(m.method);
            if (m.method === 'cash') setReference('');
          }}>
          <Text className="text-base font-semibold text-foreground">{m.title}</Text>
        </Pressable>;
      })}
    </View>
    <Text testID="checkout-label" className="text-center text-sm text-muted-foreground">
      {multi && legs > 0 ? `Payment ${legs + 1} · ${fmt(balance)} left`
        : <>To pay{state.entryMinor !== balance ? <>{' '}<Text testID="checkout-balance" className="tabular-nums">{fmt(balance)}</Text></> : null}</>}
    </Text>
    {change > 0 ? <>
      <Text testID="checkout-entry-hint" className="text-center text-3xl font-semibold text-foreground">{`Change ${fmt(change)}`}</Text>
      <Text testID="checkout-tendered-line" className="text-center text-base text-muted-foreground">Tendered <Text testID="checkout-entry" className="tabular-nums">{fmt(state.entryMinor)}</Text></Text>
    </> : <>
      <Text testID="checkout-entry" className={`text-center text-4xl font-semibold tabular-nums text-foreground ${state.entryDirty ? '' : 'opacity-70'}`}>{fmt(state.entryMinor)}</Text>
      <Text testID="checkout-entry-hint" className={`min-h-6 text-center ${noChange ? 'text-warning' : 'text-muted-foreground'}`}>{hint}</Text>
    </>}
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
      onPress={finish ? () => { void sale.complete(); } : take}>
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
  </View>;
}
