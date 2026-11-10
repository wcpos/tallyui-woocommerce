import { useReducer, useState } from 'react';
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

/** WCPOS v2's tender pane for a store that takes one payment per order: tiles, keypad, change or refusal hint, one commit. */
export function TenderPane({ sale }: { sale: ReturnType<typeof useSale> }): JSX.Element | null {
  const [state, dispatch] = useReducer(tenderReducer,
    { methodId: sale.stage.kind === 'tender' && sale.stage.method === 'cash' ? 'pos_cash' : 'pos_card', balanceMinor: sale.order.totalMinor },
    initTenderState);
  const [reference, setReference] = useState('');
  const { stage } = sale;
  if (stage.kind !== 'tender') return null;

  // One payment per order, so nothing is paid before this tender: the total is the balance (balanceDueMinor is 0 once card presets its payment).
  const balance = sale.order.totalMinor;
  const method = METHODS.find(m => m.id === state.methodId)!;
  const applied = appliedMinor(state.entryMinor, balance);
  const change = changeMinor(state.entryMinor, applied, method.givesChange);
  const noChange = !method.givesChange && state.entryMinor > balance;
  const fmt = (amount: number) => formatMoney({ amount, currency: sale.order.currency }) ?? '';
  const hint = noChange ? `Only ${fmt(balance)} is due — ${method.title} can't give change`
    : state.entryMinor > 0 && applied < balance ? `${fmt(balance - applied)} left` : '';

  function take() {
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
            if (m.method !== stage.method) sale.startTender(m.method);
            if (m.method === 'cash') setReference('');
          }}>
          <Text className="text-base font-semibold text-foreground">{m.title}</Text>
        </Pressable>;
      })}
    </View>
    <Text testID="checkout-label" className="text-center text-sm text-muted-foreground">
      To pay{state.entryMinor !== balance ? <>{' '}<Text testID="checkout-balance" className="tabular-nums">{fmt(balance)}</Text></> : null}
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
    <Button size="lg" testID="checkout-commit" disabled={sale.saving || applied <= 0 || applied < balance || noChange} onPress={take}>
      <Text>{sale.saving ? 'Saving order…' : `Take ${fmt(applied)} in ${method.title}`}</Text>
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
