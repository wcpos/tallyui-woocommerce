// v2 hooks/use-cashier-label.ts:57-62: a staff id reads the site's logged-in user's display_name, else
// t('common.cashier_number') "Cashier #{id}" (core.json:578). Tally's logged-in users are this device's roster.
import type { Session } from './session';

export interface CashierName { id: string; name: string }

/** The signed-in cashier first, then the roster's other cashiers on this store, as id/name pairs. */
export const deviceCashiers = (session: Session | null, roster: readonly Session[]): CashierName[] =>
  [...(session ? [session] : []), ...roster].map(({ tokens: { user } }) => ({ id: String(user.id), name: user.displayName }));

/** A cashier id's label: the first matching pair's name, else "Cashier #{id}". */
export const cashierNameFor = (cashiers: readonly CashierName[], id: string): string =>
  cashiers.find(cashier => cashier.id === id)?.name || `Cashier #${id}`;
