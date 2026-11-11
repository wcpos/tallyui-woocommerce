import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { ClosureSheet, RegisterBar, RegisterColumn, RegisterCount, RegisterPanel, Switch, Text } from '@tallyui/components';
import { Portal } from '@tallyui/primitives';
import { useRegister } from '../lib/register/register-context';
import { useIsOnline } from '../lib/online/online-status';
import { ClosurePrint } from './closure-print';

/** `inset` false drops the p-4 a settings group wants (the cart settings sheet's plain rows have none). */
export function RegisterSwitch({ inset = true }: { inset?: boolean }) {
  const register = useRegister();
  if (!register) return null;
  return (
    <View testID="register-switch-row" className={inset ? 'flex-row items-center gap-3 p-4' : 'flex-row items-center gap-3'}>
      <Switch checked={register.setting} onCheckedChange={register.setSetting} accessibilityLabel="Use register sessions" />
      <View className="flex-1 gap-1">
        <Text>Use register sessions</Text>
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
  const register = useRegister();
  const online = useIsOnline();
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined && onPanelOpenChange !== undefined;
  const panelOpen = controlled ? controlledOpen : ownOpen;
  const setPanelOpen = controlled ? onPanelOpenChange : setOwnOpen;
  const [showClosure, setShowClosure] = useState(false);
  const hadCounting = useRef(false);
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
  return (
    <View className="flex-1" dataSet={showClosure ? { print: 'hide' } : undefined}>
      <RegisterBar register={register} registerId={register.boundRegisterId} registerName="This till"
        online={online} multiRegister={false}
        onOpenPanel={() => setPanelOpen(true)} onPressPill={() => setPanelOpen(true)} />
      <RegisterColumn register={register} registerId={register.boundRegisterId} registers={[]} onPick={() => {}}
        currency={currency} cartEmpty={cartEmpty} countSlot={<RegisterCount register={register} currency={currency} />}>
        {children}
      </RegisterColumn>
      <RegisterPanel register={register} currency={currency} registerName="This till" open={panelOpen} onOpenChange={setPanelOpen} />
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
