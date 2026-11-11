import { useCallback, useEffect, useRef, useState } from 'react';

// Per-device, like v2's wcpos_verbose_diagnostics: the value is the expiry timestamp.
export const VERBOSE_DIAGNOSTICS_KEY = 'tallywoo.verbose_diagnostics';
// v2's DEFAULT_VERBOSE_TTL_MS (packages/utils/src/logger): verbose diagnostics turns itself off after 24 h.
export const VERBOSE_TTL_MS = 24 * 60 * 60 * 1000;
// v2's useVerboseDiagnostics TTL_POLL_MS: the chip re-reads the flag every minute so an expiry turns it off.
export const VERBOSE_POLL_MS = 60_000;

/** True while the stored expiry is in the future. Storage that is missing or throws counts as off. */
export function isVerboseDiagnostics(now = Date.now()): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(VERBOSE_DIAGNOSTICS_KEY);
    const expiresAt = raw ? Number(raw) : 0;
    return Number.isFinite(expiresAt) && now < expiresAt;
  } catch {
    return false;
  }
}

export function setVerboseDiagnostics(on: boolean, now = Date.now()): void {
  try {
    if (on) globalThis.localStorage?.setItem(VERBOSE_DIAGNOSTICS_KEY, String(now + VERBOSE_TTL_MS));
    else globalThis.localStorage?.removeItem(VERBOSE_DIAGNOSTICS_KEY);
  } catch {
    // Storage is unavailable: verbose stays off, which isVerboseDiagnostics reports.
  }
}

export function useVerboseDiagnostics(now: () => number = Date.now): { verbose: boolean; setVerbose(on: boolean): void } {
  const [verbose, setVerboseState] = useState(() => isVerboseDiagnostics(now()));
  // A ref, so a new `now` each render does not restart the poll.
  const clock = useRef(now);
  clock.current = now;
  useEffect(() => {
    const interval = setInterval(() => setVerboseState(isVerboseDiagnostics(clock.current())), VERBOSE_POLL_MS);
    return () => clearInterval(interval);
  }, []);
  const setVerbose = useCallback((on: boolean) => {
    setVerboseDiagnostics(on, clock.current());
    setVerboseState(isVerboseDiagnostics(clock.current()));
  }, []);
  return { verbose, setVerbose };
}
