import { cleanup } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { defaultPaymentMethods, type PaymentMethodDescriptor } from '@tallyui/core';
import { loadChosenReaders, saveChosenReader, selectedReaderId, smartReaderMethods,
  type ServerHardware } from '../lib/card-readers/smart-readers';
import { memoryStorage } from './memory-storage';

afterEach(() => { cleanup(); });

function serverMethod(id: string, title: string, readers: ServerHardware['readers'],
  { defaultReader = null, lockToDefault = false }: Partial<Pick<ServerHardware, 'defaultReader' | 'lockToDefault'>> = {},
): PaymentMethodDescriptor {
  return { ...defaultPaymentMethods()[1], id, title,
    capture: { mode: 'server', provider: 'stripe', hardware: { discovery: 'server', readers, defaultReader, lockToDefault } } };
}
const readers: ServerHardware['readers'] = [
  { id: 'r1', label: 'Back Office', status: 'online', default: false },
  { id: 'r2', label: 'Front Desk', status: 'online', default: false },
  { id: 'r3', label: 'Demo Proof', status: 'offline', default: false },
];

test('smartReaderMethods keeps only server-mode methods with readers, in order', () => {
  const stripe = serverMethod('stripe', 'Stripe Terminal', readers);
  const sumup = serverMethod('sumup', 'SumUp Terminal', readers);
  expect(smartReaderMethods([defaultPaymentMethods()[1], serverMethod('empty', 'Empty', []), sumup, stripe]))
    .toEqual([sumup, stripe]);
});

test('defaultPaymentMethods yield no smart readers', () => {
  expect(smartReaderMethods(defaultPaymentMethods())).toEqual([]);
});

test('selectedReaderId prefers a usable remembered reader, then the default, then the only one', () => {
  const method = serverMethod('stripe', 'Stripe Terminal', readers, { defaultReader: 'r1' });
  expect(selectedReaderId(method, { id: 'r2', label: 'Front Desk' })).toBe('r2');
  expect(selectedReaderId(method, { id: 'r3', label: 'Demo Proof' })).toBe('r1');
  expect(selectedReaderId(serverMethod('stripe', 'Stripe Terminal', [readers[0]]), undefined)).toBe('r1');
  expect(selectedReaderId(serverMethod('stripe', 'Stripe Terminal', readers.slice(0, 2)), undefined)).toBeNull();
});

test('a locked method selects only its default, and only when it is online', () => {
  const options = { defaultReader: 'r1', lockToDefault: true };
  const remembered = { id: 'r2', label: 'Front Desk' };
  expect(selectedReaderId(serverMethod('stripe', 'Stripe Terminal', readers, options), remembered)).toBe('r1');
  const offline = readers.map(reader => reader.id === 'r1' ? { ...reader, status: 'offline' } : reader);
  expect(selectedReaderId(serverMethod('stripe', 'Stripe Terminal', offline, options), remembered)).toBeNull();
});

test('saveChosenReader keeps sites apart and survives a reload', () => {
  const storage = memoryStorage();
  const backOffice = { id: 'r1', label: 'Back Office' }, frontDesk = { id: 'r2', label: 'Front Desk' };
  saveChosenReader('https://a.example/', 'stripe', backOffice, storage);
  saveChosenReader('https://b.example/', 'stripe', frontDesk, storage);
  expect(loadChosenReaders('https://a.example/', storage)).toEqual({ stripe: backOffice });
  expect(loadChosenReaders('https://b.example/', storage)).toEqual({ stripe: frontDesk });
  const unreadable = { ...storage, getItem: () => { throw new Error('Cannot read'); } };
  expect(loadChosenReaders('https://a.example/', unreadable)).toEqual({});
  const unwritable = { ...storage, setItem: () => { throw new Error('Cannot write'); } };
  expect(() => saveChosenReader('https://a.example/', 'stripe', frontDesk, unwritable)).not.toThrow();
});
