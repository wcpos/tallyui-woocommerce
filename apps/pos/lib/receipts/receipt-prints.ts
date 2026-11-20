// v2 keeps a receipt's print count till-local on the order's local.receiptPrintCount, never synced
// (packages/query/src/mutations/record-receipt-print.ts). Orders here are replicated from the server, and a local
// write into a replicated RxDB collection loses the next pulled change, so the count lives in web storage instead.
export const RECEIPT_PRINTS_KEY = 'tallywoo.receipt_prints.v1';
// Only the most recently printed orders are kept, so the key cannot grow without bound.
export const RECEIPT_PRINTS_KEPT = 200;
// Counts for this page's life, used only when storage throws, so a print still counts.
const fallback = new Map<string, number>();
// The stored { orderId: count } map, oldest print first (a print re-adds its id last); data that is not a JSON object reads as empty.
function load(storage?: Storage): Record<string, number> {
  const raw = (storage ?? globalThis.localStorage).getItem(RECEIPT_PRINTS_KEY);
  try { const parsed = JSON.parse(raw ?? '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}

export function readReceiptPrints(orderId: string, storage?: Storage): number {
  try {
    const value: unknown = fallback.get(orderId) ?? load(storage)[orderId];
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
  } catch { return fallback.get(orderId) ?? 0; }
}

export function recordReceiptPrint(orderId: string, storage?: Storage): number {
  const next = readReceiptPrints(orderId, storage) + 1;
  try {
    const kept = Object.entries(load(storage)).filter(([id]) => id !== orderId).slice(1 - RECEIPT_PRINTS_KEPT);
    (storage ?? globalThis.localStorage).setItem(RECEIPT_PRINTS_KEY, JSON.stringify(Object.fromEntries([...kept, [orderId, next]])));
    fallback.delete(orderId);
  } catch { fallback.set(orderId, next); }
  return next;
}
