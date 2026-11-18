import type { ScanSettings, WedgeAttempt } from './wedge';

// v2 analyze-trace.ts:32-33: slower than this is a person typing, not a mis-tuned scanner.
const SCANNER_FAST_CEILING_MS = 60;
const THRESHOLD_HEADROOM_MS = 8;

export type ScanSuggestionKind = 'raise-threshold' | 'lower-min-chars' | 'set-prefix';
export interface ScanSuggestion { kind: ScanSuggestionKind; title: string; patch: Partial<ScanSettings> }

// v2 analyze-trace.ts:61-86 and settings.barcode_test_suggest_* copy, in v2's order. Each rule also checks the
// current settings still reject the attempt, so a suggestion goes away once it is applied (v2 re-analyses).
export function scanSuggestions(attempt: WedgeAttempt, settings: ScanSettings): ScanSuggestion[] {
  const { raw, code, avgGapMs, result } = attempt;
  const out: ScanSuggestion[] = [];
  if (result === 'typing' && avgGapMs !== undefined && avgGapMs < SCANNER_FAST_CEILING_MS && avgGapMs >= settings.threshold) {
    const value = Math.ceil(avgGapMs + THRESHOLD_HEADROOM_MS);
    out.push({ kind: 'raise-threshold', title: `Raise threshold to ${value}ms — your scanner averages ${Math.round(avgGapMs)}ms`, patch: { threshold: value } });
  }
  if (result === 'too_short' && code.length >= 1 && code.length < settings.minChars) {
    out.push({ kind: 'lower-min-chars', title: `Lower minimum length to ${code.length} — this code is ${code.length} characters`, patch: { minChars: code.length } });
  }
  if (result === 'scan' && /^[^0-9A-Za-z]/.test(raw) && settings.prefix === '') {
    out.push({ kind: 'set-prefix', title: `Strip leading "${raw[0]}" — set it as your prefix`, patch: { prefix: raw[0] } });
  }
  return out;
}
