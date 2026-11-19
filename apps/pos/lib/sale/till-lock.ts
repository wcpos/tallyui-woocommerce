import { toast } from '../toast/toast';

/** Why the till refuses an add: the register is closed (a price check) or its drawer is being counted. */
export type TillLock = 'closed' | 'counting' | null;
// v2 core.json:1231-1232 (pos_products.price_check_only_until_open / counting_items_after_count).
export const LOCKED_COPY = { closed: 'Price check only until the register is open.',
  counting: 'Counting the drawer. Items can be added after the count.' } as const;

/** v2 use-action-context.ts:86-98, from the rendered session: sessions off or no bound register (`enabled`) never lock, nor any status but counting. */
export function tillLock(register: { enabled: boolean; session: { status: string } | null } | null | undefined): TillLock {
  if (!register?.enabled) return null;
  return register.session === null ? 'closed' : register.session.status === 'counting' ? 'counting' : null;
}

/** v2 use-add-product.ts:28-45: one info toast per refusal, its id shared so repeated taps update it in place. */
export function refuseLockedAdd(lock: TillLock): boolean {
  if (lock) toast({ id: lock === 'counting' ? 'pos-counting-refused' : 'pos-price-check-refused', type: 'info', title: LOCKED_COPY[lock] });
  return lock !== null;
}
