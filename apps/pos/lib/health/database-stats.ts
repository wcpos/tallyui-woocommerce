// The Database page's summary strip, from v2's packages/core/src/screens/main/health/database-logic.ts.

/** "Ready to sell": v2 also waits on a bootstrap gate, which Tally lacks, so any local product is ready. */
export function isReadyToSell(productsLocal: number): boolean {
  return productsLocal > 0;
}

/** Total records held locally across the counted collections; a count still loading (null) adds 0. */
export function totalLocalRecords(counts: Record<string, number | null>): number {
  return Object.values(counts).reduce<number>((sum, n) => sum + (typeof n === 'number' && Number.isFinite(n) ? n : 0), 0);
}

/** Human-readable bytes for the storage stat, ported from v2 as is. */
export function formatBytes(bytes: number | null): string | null {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
