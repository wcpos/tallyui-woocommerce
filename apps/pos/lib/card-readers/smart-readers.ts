import { useCallback, useEffect, useState } from 'react';
import type { PaymentHardware, PaymentMethodDescriptor } from '@tallyui/core';

export type ServerHardware = Extract<PaymentHardware, { readers: unknown }>;
export interface RememberedReader { id: string; label: string }
export type RememberedReaders = Record<string, RememberedReader>;
export const CHOSEN_READERS_KEY = 'tallywoo.card_readers.v1';

export function primaryServerHardware(method: PaymentMethodDescriptor): ServerHardware | null {
  const { mode, hardware } = method.capture;
  return mode === 'server' && hardware && 'readers' in hardware && Array.isArray(hardware.readers) ? hardware : null;
}

export function smartReaderMethods(methods: PaymentMethodDescriptor[]): PaymentMethodDescriptor[] {
  return methods.filter(method => (primaryServerHardware(method)?.readers.length ?? 0) > 0);
}

export function selectedReaderId(method: PaymentMethodDescriptor, remembered: RememberedReader | undefined): string | null {
  const hardware = primaryServerHardware(method);
  if (!hardware) return null;
  const usable = hardware.readers.filter(reader => reader.status === 'online'
    && (!hardware.lockToDefault || reader.id === hardware.defaultReader));
  if (hardware.lockToDefault) return usable.find(reader => reader.id === hardware.defaultReader)?.id ?? null;
  return usable.find(reader => reader.id === remembered?.id)?.id
    ?? usable.find(reader => reader.id === hardware.defaultReader || reader.default)?.id
    ?? (hardware.readers.length === 1 ? usable[0]?.id ?? null : null);
}

const listeners = new Set<() => void>();

function readAll(storage?: Storage): Record<string, unknown> {
  const parsed = JSON.parse((storage ?? globalThis.localStorage).getItem(CHOSEN_READERS_KEY) ?? '{}');
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
}

export function loadChosenReaders(site: string, storage?: Storage): RememberedReaders {
  try {
    const stored = readAll(storage)[site];
    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};
    return Object.fromEntries(Object.entries(stored).filter(([, reader]) =>
      reader !== null && typeof reader === 'object' && !Array.isArray(reader)
      && typeof reader.id === 'string' && typeof reader.label === 'string'));
  } catch { return {}; }
}

export function saveChosenReader(site: string, methodId: string, reader: RememberedReader, storage?: Storage): void {
  try {
    let all: Record<string, unknown> = {};
    try { all = readAll(storage); } catch {}
    const chosen = { ...loadChosenReaders(site, storage), [methodId]: reader };
    (storage ?? globalThis.localStorage).setItem(CHOSEN_READERS_KEY, JSON.stringify({ ...all, [site]: chosen }));
  } catch {}
  listeners.forEach(listener => listener());
}

export function useChosenReaders(site: string | undefined)
  : [RememberedReaders, (methodId: string, reader: RememberedReader) => void] {
  const [chosen, setChosen] = useState(() => site ? loadChosenReaders(site) : {});
  useEffect(() => {
    const reload = () => setChosen(site ? loadChosenReaders(site) : {});
    reload();
    listeners.add(reload);
    return () => { listeners.delete(reload); };
  }, [site]);
  const choose = useCallback((methodId: string, reader: RememberedReader) => {
    if (!site) return;
    saveChosenReader(site, methodId, reader);
    // Keep this page's choice even when localStorage cannot write it.
    setChosen({ ...chosen, [methodId]: reader });
  }, [site, chosen]);
  return [chosen, choose];
}
