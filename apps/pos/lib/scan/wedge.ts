// WCPOS v2 keyboard-wedge defaults (settings/barcode-scanning/settings.tsx:39-50, wedge-detector.ts:137 at monorepo next).
export const WEDGE_AVG_GAP_MS = 24;
export const WEDGE_END_OF_SCAN_MS = 150;
export const WEDGE_MIN_CHARS = 8;

export interface WedgeDetector {
  /** Feeds one KeyboardEvent.key. Returns true only for an Enter/Tab that ended an accepted scan. */
  key(key: string): boolean;
  reset(): void;
}

export function createWedgeDetector(onScan: (code: string) => void): WedgeDetector {
  let buffer = '';
  let last = 0;
  let avg: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    clearTimeout(timer);
    timer = undefined;
    buffer = '';
    last = 0;
    avg = undefined;
  }

  function finish(): boolean {
    const code = buffer;
    const accepted = buffer.length >= WEDGE_MIN_CHARS && avg !== undefined && avg < WEDGE_AVG_GAP_MS;
    reset();
    if (accepted) onScan(code);
    return accepted;
  }

  return {
    key(key) {
      if (key === 'Enter' || key === 'Tab') return finish();
      if (key.length !== 1) return false;
      const t = Date.now();
      if (buffer) {
        const gap = t - last;
        avg = avg === undefined ? gap : (avg + gap) / 2;
      }
      buffer += key;
      last = t;
      clearTimeout(timer);
      timer = setTimeout(finish, WEDGE_END_OF_SCAN_MS);
      return false;
    },
    reset,
  };
}
