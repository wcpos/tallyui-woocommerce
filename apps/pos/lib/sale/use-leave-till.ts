import { useEffect, useRef } from 'react';
import type { useSale } from '@tallyui/pos';
import { clearBeforeLeave, setBeforeLeave, type BeforeLeave } from './before-leave';
import type { ParkAndResume } from './use-park-and-resume';

export interface LeaveTillContext {
  hold: ParkAndResume['hold'];
  unhold: ParkAndResume['unhold'];
  onSwitchCashier?(uuid: string): Promise<string | null>;
  onAddCashier?(): void;
  say(message: string | undefined): void;
}

/** The till is left by a sign-in redirect or a cashier change: either way the open cart is held first, and a payment in progress refuses the redirect. Returns changeCashier (no uuid: add a cashier). */
export function useLeaveTill(sale: ReturnType<typeof useSale>, context: LeaveTillContext): (uuid?: string) => Promise<void> {
  const leave = useRef({ hold: context.hold, tendering: false });
  leave.current = { hold: context.hold, tendering: sale.stage.kind === 'tender' || sale.saving };
  useEffect(() => {
    const handler: BeforeLeave = async () => {
      if (leave.current.tendering) return 'Finish or cancel the payment first.';
      const result = await leave.current.hold();
      return typeof result === 'string' ? result : null;
    };
    setBeforeLeave(handler);
    return () => clearBeforeLeave(handler);
  }, []);

  async function changeCashier(uuid?: string) {
    const result = await context.hold();
    if (typeof result === 'string') { context.say(result); return; }
    const held = result;
    if (uuid === undefined) { context.onAddCashier?.(); return; }
    const error = await context.onSwitchCashier!(uuid);
    if (typeof error === 'string') {
      context.say(error);
      if (held) {
        context.say(await context.unhold(held) ?? error);
      }
    }
  }

  return changeCashier;
}
