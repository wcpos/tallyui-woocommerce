// From three entries the line leads with the count, so a long cart still says how much is in it (v2 cart/cart-contents.ts COUNT_FROM).
const COUNT_FROM = 3;

/** The open-orders row's items line: product lines, then fees, then shipping (v2 cart/cart-contents.ts, read at open-orders-list.tsx:125-136). */
export function cartContentsLine({ lines, fees = [], shipping = [] }: {
  lines: readonly { name: string; quantity?: number | null }[]; fees?: readonly { name: string }[]; shipping?: readonly { name: string }[];
}): string {
  const parts = [
    // A missing or non-finite quantity counts as 1; quantity 0 and a blank name are skipped; a negative quantity stays (v2).
    ...lines.map(({ name, quantity }) => {
      const count = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 1;
      return count === 0 ? '' : count === 1 ? name.trim() : name.trim() && `${name.trim()} ×${count}`;
    }),
    ...fees.map(fee => fee.name.trim()),
    ...shipping.map(line => line.name.trim() && `${line.name.trim()} shipping`),
  ].filter(Boolean);
  return parts.length < COUNT_FROM ? parts.join(', ') : `${parts.length} ${parts.length === 1 ? 'item' : 'items'} · ${parts.join(', ')}`;
}

/** A cart's age (v2 relative-time.ts relativeTimeParts, copy health.database.*); seconds, minutes and hours round, a negative span is 0. */
export function relativeAge(fromMs: number, toMs: number): string {
  const span = Math.max(0, toMs - fromMs);
  if (span < 60_000) return span < 5_000 ? 'just now' : `${Math.round(span / 1000)} seconds`;
  return span < 3_600_000 ? `${Math.round(span / 60_000)} min` : `${Math.round(span / 3_600_000)} h`;
}
