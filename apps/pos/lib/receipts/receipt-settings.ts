import { useCallback, useEffect, useState } from 'react';

// Per-device, like the cart settings (lib/sale/cart-settings.ts).
export interface ReceiptSettings { autoPrint: boolean; autoShow: boolean }
export const RECEIPT_SETTINGS_KEY = 'tallywoo.receipt_settings.v1';
// v2's pos-cart defaults (initial-settings.json): autoPrintReceipt off, autoShowReceipt on.
export const RECEIPT_SETTINGS_DEFAULTS: ReceiptSettings = { autoPrint: false, autoShow: true };

// Every mounted useReceiptSettings follows a save, so the receipt stage sees a change made in Cart Settings.
const listeners = new Set<(settings: ReceiptSettings) => void>();

export function loadReceiptSettings(storage?: Storage): ReceiptSettings {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(RECEIPT_SETTINGS_KEY);
    if (raw === null) return RECEIPT_SETTINGS_DEFAULTS;
    const parsed = JSON.parse(raw);
    const stored = typeof parsed === 'object' && parsed !== null ? parsed : {};
    // autoShow came later: JSON saved before it, or a value that is not exactly false, keeps the default (on).
    return { autoPrint: stored.autoPrint === true, autoShow: stored.autoShow !== false };
  } catch { return RECEIPT_SETTINGS_DEFAULTS; }
}

export function saveReceiptSettings(settings: ReceiptSettings, storage?: Storage): void {
  try {
    (storage ?? globalThis.localStorage).setItem(RECEIPT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  listeners.forEach(listener => listener(settings));
}

export function useReceiptSettings(): [ReceiptSettings, (next: ReceiptSettings) => void] {
  const [settings, setSettings] = useState(() => loadReceiptSettings());
  useEffect(() => {
    listeners.add(setSettings);
    return () => { listeners.delete(setSettings); };
  }, []);
  const update = useCallback((next: ReceiptSettings) => saveReceiptSettings(next), []);
  return [settings, update];
}
