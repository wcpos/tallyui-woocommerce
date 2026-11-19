/**
 * Round a percentage half-up to minor units, never outside the remaining balance.
 * WCPOS v2: tender-state.ts:298-300; "the rest" is the balance still due (tender-figures.ts:111-113).
 */
export function percentOfMinor(balanceMinor: number, percent: number): number {
  return Math.max(0, Math.min(balanceMinor, Math.round((balanceMinor * percent) / 100)));
}
