// WCPOS v2 keyboard-wedge defaults (settings/barcode-scanning/settings.tsx:39-50, wedge-detector.ts:137 at monorepo next).
export const WEDGE_AVG_GAP_MS = 24;
export const WEDGE_END_OF_SCAN_MS = 150;
export const WEDGE_MIN_CHARS = 8;

// v2's barcode_scanning_avg_time_input_threshold, _min_chars, _prefix and _suffix
// (packages/database/src/collections/schemas/stores.ts), saved per device here.
export interface ScanSettings { threshold: number; minChars: number; prefix: string; suffix: string }
export const DEFAULT_SCAN_SETTINGS: ScanSettings = { threshold: WEDGE_AVG_GAP_MS, minChars: WEDGE_MIN_CHARS, prefix: '', suffix: '' };

// v2's test panel words: settings.barcode_test_result_scan, _too_short and _typing.
export type WedgeResult = 'scan' | 'too_short' | 'typing';
export interface WedgeAttempt {
  /** The burst's keys as typed. */
  raw: string;
  /** The keys with the prefix and suffix taken off. */
  code: string;
  /** The folded average key gap in ms; undefined for a single key. */
  avgGapMs: number | undefined;
  result: WedgeResult;
}

export interface WedgeDetectorOptions {
  /** Read once per finished burst, so a change on the settings page applies to the next scan. */
  getSettings?: () => ScanSettings;
  /** Every finished, non-empty burst, accepted or not (the settings test panel). */
  onAttempt?: (attempt: WedgeAttempt) => void;
}

// The prefix and suffix come off only at the edges, never from the middle (v2 wedge-detector.ts stripBoundary).
export function stripBoundary(raw: string, settings: Pick<ScanSettings, 'prefix' | 'suffix'>): string {
  let code = raw;
  if (settings.prefix && code.startsWith(settings.prefix)) code = code.slice(settings.prefix.length);
  if (settings.suffix && code.endsWith(settings.suffix)) code = code.slice(0, code.length - settings.suffix.length);
  return code;
}

export interface WedgeDetector {
  /** Feeds one KeyboardEvent.key. Returns true only for an Enter/Tab that ended an accepted scan. */
  key(key: string): boolean;
  reset(): void;
}

export function createWedgeDetector(onScan: (code: string) => void, options: WedgeDetectorOptions = {}): WedgeDetector {
  const getSettings = options.getSettings ?? (() => DEFAULT_SCAN_SETTINGS);
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
    const raw = buffer;
    const gap = avg;
    reset();
    if (!raw) return false;
    const settings = getSettings();
    const code = stripBoundary(raw, settings);
    // v2 checks the minimum length after the prefix and suffix come off; an empty code is never a scan.
    const result: WedgeResult = gap === undefined || gap >= settings.threshold ? 'typing'
      : code.length < Math.max(1, settings.minChars) ? 'too_short' : 'scan';
    options.onAttempt?.({ raw, code, avgGapMs: gap, result });
    if (result === 'scan') onScan(code);
    return result === 'scan';
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
