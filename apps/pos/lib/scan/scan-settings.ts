import { useCallback, useState } from 'react';
import { DEFAULT_SCAN_SETTINGS, type ScanSettings } from './wedge';

// Settings > Barcode Scanning, per device. v2 keeps these on the store document; this app has no local
// store document, and a replicated collection must never take local writes.
export const SCAN_SETTINGS_KEY = 'tallywoo.barcode_scanning.v1';

// v2's formSchema: a whole number, 0 or more.
function count(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : fallback;
}

export function normalizeScanSettings(raw: unknown): ScanSettings {
  const stored = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  return {
    threshold: count(stored.threshold, DEFAULT_SCAN_SETTINGS.threshold),
    minChars: count(stored.minChars, DEFAULT_SCAN_SETTINGS.minChars),
    prefix: typeof stored.prefix === 'string' ? stored.prefix : DEFAULT_SCAN_SETTINGS.prefix,
    suffix: typeof stored.suffix === 'string' ? stored.suffix : DEFAULT_SCAN_SETTINGS.suffix,
  };
}

export function readScanSettings(): ScanSettings {
  try {
    const stored = localStorage.getItem(SCAN_SETTINGS_KEY);
    return normalizeScanSettings(stored === null ? null : JSON.parse(stored));
  } catch { return { ...DEFAULT_SCAN_SETTINGS }; }
}

export function writeScanSettings(patch: Partial<ScanSettings>): ScanSettings {
  const next = normalizeScanSettings({ ...readScanSettings(), ...patch });
  try { localStorage.setItem(SCAN_SETTINGS_KEY, JSON.stringify(next)); } catch { /* the page keeps the value for this visit */ }
  return next;
}

export function useScanSettings(): [ScanSettings, (patch: Partial<ScanSettings>) => void] {
  const [settings, setSettings] = useState(readScanSettings);
  const update = useCallback((patch: Partial<ScanSettings>) => setSettings(writeScanSettings(patch)), []);
  return [settings, update];
}
