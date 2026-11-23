import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { ClosureSheet, RegisterColumn, RegisterCount, RegisterPanel, Switch, Text } from '@tallyui/components';
import { Portal } from '@tallyui/primitives';
import { useSession } from '../lib/auth/session-context';
import { cashierNameFor, deviceCashiers } from '../lib/auth/cashier-name';
import { useFormatStoreMoney } from '../lib/money/store-money';
import { useRegister } from '../lib/register/register-context';
import { toast } from '../lib/toast/toast';
import { SavedMark, savedKeys, useMarkSaved } from './settings/settings-form';
import { ClosurePrint } from './closure-print';

/** `inset` false drops the p-4 a settings group wants (the cart settings sheet's plain rows have none). */
export function RegisterSwitch({ inset = true }: { inset?: boolean }) {
  const register = useRegister();
  // Settings › General's Saved mark; outside a SavedFieldProvider both are the context default's no-ops.
  const markSaved = useMarkSaved();
  if (!register) return null;
  return (
    <View testID="register-switch-row" className={inset ? 'flex-row items-center gap-3 p-4' : 'flex-row items-center gap-3'}>
      <Switch size="sm" checked={register.setting} accessibilityLabel="Use register sessions" onCheckedChange={on => {
        register.setSetting(on);
        markSaved(savedKeys({ register: register.setting }, { register: on }));
      }} />
      <View className="flex-1 gap-1">
        {/* The mark follows the key on its line, as barcode's Sound theme row (v2 property-row/index.tsx:150-178). */}
        <View className="flex-row items-center gap-x-2">
          <Text>Use register sessions</Text>
          <SavedMark name="register" />
        </View>
        <Text className="text-muted-foreground text-sm">A session starts with a counted float, records cash paid in and out, and closes with a count that shows any difference.</Text>
      </View>
    </View>
  );
}

export function RegisterControls({ currency, storeName, locale, cartEmpty, children, panelOpen: controlledOpen, onPanelOpenChange }: {
  currency: string; storeName: string; locale?: string; cartEmpty: boolean; children: ReactNode;
  /** Given together, the parent controls the panel (the cashier sheet's drawer door opens it); otherwise the panel keeps its own state. */
  panelOpen?: boolean; onPanelOpenChange?: (open: boolean) => void;
}) {
  const formatMoney = useFormatStoreMoney();
  const register = useRegister();
  const auth = useSession() as ReturnType<typeof useSession> | null;
  const opener = auth && register?.session?.opened_by
    ? cashierNameFor(deviceCashiers(auth.session, auth.cashiers), register.session.opened_by) : undefined;
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined && onPanelOpenChange !== undefined;
  const panelOpen = controlled ? controlledOpen : ownOpen;
  const setPanelOpen = controlled ? onPanelOpenChange : setOwnOpen;
  const [showClosure, setShowClosure] = useState(false);
  const [xPrint, setXPrint] = useState(0);
  const printXReport = () => setXPrint(n => n + 1);
  const hadCounting = useRef(false);
  useEffect(() => {
    if (!xPrint) return;
    // Portal publishes to its host in an effect; print after that DOM update.
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
      setXPrint(0);
    }, 0);
    return () => clearTimeout(timer);
  }, [xPrint]);
  useEffect(() => {
    if (register?.session?.status === 'counting') {
      hadCounting.current = true;
    } else if (register?.session?.status === 'open' || !register?.enabled) {
      hadCounting.current = false;
    } else if (hadCounting.current && !register.session && register.lastClosure) {
      // Remember counting across the closed snapshot before the closure is written.
      setShowClosure(true);
      hadCounting.current = false;
    }
  }, [register?.enabled, register?.session?.status, register?.lastClosure]);
  if (!register?.enabled) return <>{children}</>;
  // v2 open-register-card.tsx:62-70: the toast follows the cashier's own open, once openSession resolves
  // (core.json register.register_open_toast); a reload's hydration never calls it, so it never toasts.
  const withOpenToast = { ...register, actions: { ...register.actions, openSession: async (input: Parameters<typeof register.actions.openSession>[0]) => {
    const doc = await register.actions.openSession(input);
    toast({ title: `✓ Register open · float ${formatMoney({ amount: input.countedFloatMinor, currency }, locale) ?? ''}`, type: 'success' });
    return doc;
  } } };
  return (
    <View className="flex-1" dataSet={showClosure || (xPrint > 0 && register.session) ? { print: 'hide' } : undefined}>
      {/* No row of its own over the column: v2 draws one bar over the cart (cart/index.tsx RegisterBar), so the
          register's pill is RegisterBarShell's and the way into the panel is the cashier sheet's drawer door.
          No registerName: a Tally till has one register, so RegisterPanel titles itself "Register", as v2
          register-panel.tsx does for a single register. Its side sheet and print footer follow v2
          register-panel.tsx:280-317, 615-660. */}
      <RegisterColumn register={withOpenToast} registerId={register.boundRegisterId} registers={[]} onPick={() => {}}
        currency={currency} cartEmpty={cartEmpty} countSlot={<RegisterCount register={register} currency={currency} />}>
        {children}
      </RegisterColumn>
      <RegisterPanel register={register} currency={currency} open={panelOpen} onOpenChange={setPanelOpen}
        presentation="side" storeName={storeName} onPrintXReport={printXReport} openedBy={opener ? { name: opener } : undefined} />
      {!showClosure && xPrint > 0 && register.session && <Portal name="x-report-print">
        <ClosurePrint kind="x" closure={register.session} expected={register.expected} storeName={storeName} currency={currency} locale={locale} />
      </Portal>}
      {showClosure && register.lastClosure && <>
        <ClosureSheet register={register} currency={currency} onDone={() => setShowClosure(false)} onPrint={() => {
          if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
        }} />
        <Portal name="closure-print">
          <ClosurePrint closure={register.lastClosure} storeName={storeName} currency={currency} locale={locale} />
        </Portal>
      </>}
    </View>
  );
}
