import { expect, test } from 'vitest';
import { scanSuggestions } from '../lib/scan/scan-suggestions';
import { DEFAULT_SCAN_SETTINGS, type ScanSettings, type WedgeAttempt } from '../lib/scan/wedge';

const settings = (patch: Partial<ScanSettings> = {}): ScanSettings => ({ ...DEFAULT_SCAN_SETTINGS, ...patch });
const attempt = (a: Partial<WedgeAttempt>): WedgeAttempt => ({ raw: '12345678', code: '12345678', avgGapMs: 5, gapsMs: [], result: 'scan', trailingEnter: true, shiftKeys: 0, ...a });

test('raise-threshold when typing under 60ms is still at or over the threshold', () => {
  expect(scanSuggestions(attempt({ result: 'typing', avgGapMs: 30 }), settings({ threshold: 20 }))).toEqual([
    { kind: 'raise-threshold', title: 'Raise threshold to 38ms — your scanner averages 30ms', patch: { threshold: 38 } },
  ]);
  // v2 rounds the headroom up and the shown average to the nearest.
  expect(scanSuggestions(attempt({ result: 'typing', avgGapMs: 59.5 }), settings())[0]).toEqual(
    { kind: 'raise-threshold', title: 'Raise threshold to 68ms — your scanner averages 60ms', patch: { threshold: 68 } });
  expect(scanSuggestions(attempt({ result: 'typing', avgGapMs: 24 }), settings({ threshold: 24 }))[0]?.patch).toEqual({ threshold: 32 });
});

test('no raise-threshold at 60ms or slower, or once the threshold is above the gap', () => {
  expect(scanSuggestions(attempt({ result: 'typing', avgGapMs: 60 }), settings())).toEqual([]);
  expect(scanSuggestions(attempt({ result: 'typing', avgGapMs: 70 }), settings())).toEqual([]);
  expect(scanSuggestions(attempt({ result: 'typing', avgGapMs: 30 }), settings({ threshold: 38 }))).toEqual([]);
  expect(scanSuggestions(attempt({ result: 'typing', avgGapMs: undefined }), settings())).toEqual([]);
});

test('lower-min-chars to the code length while the minimum still rejects it, never for an empty code', () => {
  expect(scanSuggestions(attempt({ raw: '12', code: '12', result: 'too_short' }), settings())).toEqual([
    { kind: 'lower-min-chars', title: 'Lower minimum length to 2 — this code is 2 characters', patch: { minChars: 2 } },
  ]);
  expect(scanSuggestions(attempt({ raw: '12', code: '12', result: 'too_short' }), settings({ minChars: 2 }))).toEqual([]);
  expect(scanSuggestions(attempt({ raw: ']C1', code: '', result: 'too_short' }), settings({ prefix: ']C1' }))).toEqual([]);
});

test('set-prefix for a scan with a leading symbol only while no prefix is saved', () => {
  expect(scanSuggestions(attempt({ raw: ']12345678', code: ']12345678' }), settings())).toEqual([
    { kind: 'set-prefix', title: 'Strip leading "]" — set it as your prefix', patch: { prefix: ']' } },
  ]);
  expect(scanSuggestions(attempt({ raw: ']12345678', code: '12345678' }), settings({ prefix: ']' }))).toEqual([]);
  expect(scanSuggestions(attempt({ raw: ']12345678', code: ']12345678' }), settings({ prefix: '~' }))).toEqual([]);
  // Only a scan: a too-short or typed burst with a symbol first offers no prefix.
  expect(scanSuggestions(attempt({ raw: ']1', code: ']1', result: 'too_short' }), settings()).map(s => s.kind)).toEqual(['lower-min-chars']);
});

test('a clean scan of digits offers nothing', () => {
  expect(scanSuggestions(attempt({}), settings())).toEqual([]);
  expect(scanSuggestions(attempt({ raw: 'A1234567', code: 'A1234567' }), settings())).toEqual([]);
});
