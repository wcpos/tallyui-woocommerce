import type { Payment } from '@tallyui/pos';

/**
 * An open sale's legs as finalize will save them: TallyUI 3.20.1 finalize (dist/index.js:6581-6587) walks the cash
 * legs last to first, moving the change out of each tendered amount. v2 shows the applied amount, with a tendered
 * line only when a cash leg carries change (ledger-pane.tsx:231). A saved leg (tenderedMinor set) keeps its own.
 */
export function cashLegFigures(payments: readonly Payment[], changeDueMinor: number) {
  const figures = new Map<string, Pick<Payment, 'amountMinor' | 'tenderedMinor' | 'changeMinor'>>();
  let change = changeDueMinor;
  for (const { id, method, amountMinor, tenderedMinor, changeMinor } of [...payments].reverse()) {
    const legChange = method === 'cash' && tenderedMinor === undefined ? Math.min(change, amountMinor) : 0;
    change -= legChange;
    figures.set(id, legChange > 0 ? { amountMinor: amountMinor - legChange, tenderedMinor: amountMinor, changeMinor: legChange }
      : { amountMinor, tenderedMinor, changeMinor });
  }
  return figures;
}
