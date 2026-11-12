import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { defaultPaymentMethods, type PaymentMethodDescriptor } from '@tallyui/core';
import { CardReadersSettings } from '../components/settings/card-readers-settings';
import { useChosenReaders, type ServerHardware } from '../lib/card-readers/smart-readers';
import { memoryStorage } from './memory-storage';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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
const methods = [serverMethod('stripe', 'Stripe Terminal', readers),
  serverMethod('sumup', 'SumUp Terminal', [{ id: 's1', label: 'WCPOS Virtual Solo', status: 'online', default: false }])];

test('lists every reader with its status and its method as the tag', () => {
  render(<CardReadersSettings load={{ status: 'ready', methods }} chosen={{}} onChoose={vi.fn()} />);
  expect(screen.getAllByTestId(/^smart-reader-(stripe-r[123]|sumup-s1)$/).map(row => row.getAttribute('data-testid')))
    .toEqual(['smart-reader-stripe-r1', 'smart-reader-stripe-r2', 'smart-reader-stripe-r3', 'smart-reader-sumup-s1']);
  expect(screen.getByTestId('smart-reader-stripe-r1-status').textContent).toBe('Online');
  expect(screen.getByTestId('smart-reader-stripe-r3-status').textContent).toBe('Offline');
  expect(screen.getByTestId('smart-reader-sumup-s1-tag').textContent).toBe('SumUp Terminal');
  expect(screen.getByRole('heading', { name: 'Smart readers', level: 2 })).not.toBeNull();
  expect(screen.getByText('The store drives these over the network. This till pays with the selected one.')).not.toBeNull();
});

test('an online reader offers "Use this reader"; an offline one offers nothing', () => {
  render(<CardReadersSettings load={{ status: 'ready', methods }} chosen={{}} onChoose={vi.fn()} />);
  expect(screen.getByTestId('smart-reader-stripe-r1-use').textContent).toBe('Use this reader');
  expect(screen.queryByTestId('smart-reader-stripe-r3-use')).toBeNull();
  expect(screen.queryByTestId('smart-reader-stripe-r3-selected')).toBeNull();
});

test('pressing "Use this reader" reports that method and reader', () => {
  const onChoose = vi.fn();
  render(<CardReadersSettings load={{ status: 'ready', methods }} chosen={{}} onChoose={onChoose} />);
  fireEvent.click(screen.getByTestId('smart-reader-stripe-r2-use'));
  expect(onChoose).toHaveBeenCalledExactlyOnceWith('stripe', { id: 'r2', label: 'Front Desk' });
});

test('the chosen reader reads Selected and loses its button', () => {
  render(<CardReadersSettings load={{ status: 'ready', methods }} chosen={{ stripe: { id: 'r2', label: 'Front Desk' } }} onChoose={vi.fn()} />);
  expect(screen.getByTestId('smart-reader-stripe-r2-selected').textContent).toBe('Selected');
  expect(screen.queryByTestId('smart-reader-stripe-r2-use')).toBeNull();
  expect(screen.getByTestId('smart-reader-stripe-r1-use')).not.toBeNull();
});

test('a reader the store locks shows "Set by the store" and no button', () => {
  const locked = serverMethod('stripe', 'Stripe Terminal', readers, { lockToDefault: true, defaultReader: 'r1' });
  render(<CardReadersSettings load={{ status: 'ready', methods: [locked] }} chosen={{}} onChoose={vi.fn()} />);
  expect(screen.getByTestId('smart-reader-stripe-r1-identifiers').textContent).toBe('Set by the store');
  expect(screen.getByTestId('smart-reader-stripe-r1-selected')).not.toBeNull();
  expect(screen.queryByTestId('smart-reader-stripe-r1-use')).toBeNull();
  expect(screen.queryByTestId('smart-reader-stripe-r2-use')).toBeNull();
});

test("no smart readers shows v2's empty line", () => {
  render(<CardReadersSettings load={{ status: 'ready', methods: defaultPaymentMethods() }} chosen={{}} onChoose={vi.fn()} />);
  expect(screen.getByTestId('card-readers-none').textContent)
    .toBe("No card readers are set up for this store. Add them on the gateway's WooCommerce page.");
  expect(screen.queryByTestId('card-readers-smart')).toBeNull();
});

test('loading and error states', () => {
  const { rerender } = render(<CardReadersSettings load={{ status: 'loading' }} chosen={{}} onChoose={vi.fn()} />);
  expect(screen.getByTestId('card-readers-loading').textContent).toBe('Loading…');
  rerender(<CardReadersSettings load={{ status: 'error', message: 'Network down' }} chosen={{}} onChoose={vi.fn()} />);
  expect(screen.getByTestId('card-readers-error').textContent).toContain('Network down');
});

test('a choice made in one page shows in the next', () => {
  vi.stubGlobal('localStorage', memoryStorage());
  function Harness() {
    const [chosen, onChoose] = useChosenReaders('https://shop.example/');
    return <CardReadersSettings load={{ status: 'ready', methods }} chosen={chosen} onChoose={onChoose} />;
  }
  render(<Harness />);
  fireEvent.click(screen.getByTestId('smart-reader-stripe-r2-use'));
  expect(screen.getByTestId('smart-reader-stripe-r2-selected').textContent).toBe('Selected');
  cleanup();
  render(<Harness />);
  expect(screen.getByTestId('smart-reader-stripe-r2-selected').textContent).toBe('Selected');
});
