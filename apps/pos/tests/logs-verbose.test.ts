import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { memoryStorage } from './memory-storage';
import { isVerboseDiagnostics, setVerboseDiagnostics, VERBOSE_DIAGNOSTICS_KEY, VERBOSE_TTL_MS } from '../lib/logs/verbose';

const now = new Date(2026, 10, 10, 12, 0, 0).getTime();

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });

test('verbose diagnostics is off by default', () => {
  expect(isVerboseDiagnostics(now)).toBe(false);
});

test('verbose diagnostics is on after set and off again once 24 h have passed', () => {
  setVerboseDiagnostics(true, now);
  expect(localStorage.getItem(VERBOSE_DIAGNOSTICS_KEY)).toBe(String(now + VERBOSE_TTL_MS));
  expect(isVerboseDiagnostics(now)).toBe(true);
  expect(isVerboseDiagnostics(now + VERBOSE_TTL_MS - 1)).toBe(true);
  expect(isVerboseDiagnostics(now + VERBOSE_TTL_MS + 1)).toBe(false);
});

test('verbose diagnostics is off after unset, and the key is removed', () => {
  setVerboseDiagnostics(true, now);
  setVerboseDiagnostics(false, now);
  expect(localStorage.getItem(VERBOSE_DIAGNOSTICS_KEY)).toBeNull();
  expect(isVerboseDiagnostics(now)).toBe(false);
});

test('a throwing localStorage counts as off and does not throw', () => {
  const fail = () => { throw new Error('denied'); };
  vi.stubGlobal('localStorage', { ...memoryStorage(), getItem: fail, setItem: fail, removeItem: fail });
  expect(() => setVerboseDiagnostics(true, now)).not.toThrow();
  expect(() => setVerboseDiagnostics(false, now)).not.toThrow();
  expect(isVerboseDiagnostics(now)).toBe(false);
});
