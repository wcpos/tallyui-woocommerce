import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// v2's printed datetime (build-receipt-data.ts:842-862): en-US, short month, 12-hour clock.
export const PRINTED_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };

export function formatPrintedAt(at: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { ...PRINTED_FORMAT, timeZone }).format(at);
  } catch (error) {
    // A bad zone falls back to the device's, as v2 does; anything else is a real fault.
    if (!(error instanceof RangeError)) throw error;
    return new Intl.DateTimeFormat('en-US', PRINTED_FORMAT).format(at);
  }
}

export function useReceiptPrintedAt(): Date {
  const [at, setAt] = useState(() => new Date());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // The browser lays out the print as soon as beforeprint returns, so the stamp must commit synchronously.
    const onBeforePrint = () => flushSync(() => setAt(new Date()));
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, []);

  return at;
}
