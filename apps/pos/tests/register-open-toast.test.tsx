import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Pressable, Text } from 'react-native';
import { RegisterControls } from '../components/register-controls';
import { dismissToast, getToasts } from '../lib/toast/toast';

// v2 open-register-card.tsx:62-70: after `actions.openSession(...)` resolves, a success toast titled
// register.register_open_toast (core.json "✓ Register open · float {amount}"). A reload shows nothing.

let current: Record<string, unknown> = {};
vi.mock('../lib/register/register-context', () => ({ useRegister: () => current }));

vi.mock('@tallyui/components', async importOriginal => ({
  ...await importOriginal<typeof import('@tallyui/components')>(),
  // Stands in for TallyUI's OpenRegisterCard, which calls the `register` prop's openSession.
  RegisterColumn: ({ register, children }: { register: { actions: { openSession(input: object): Promise<unknown> } }; children: import('react').ReactNode }) => <>
    <Pressable testID="stub-open" onPress={() => {
      register.actions.openSession({ expectedFloatMinor: 10000, countedFloatMinor: 15000 }).catch(() => {});
    }}><Text>Open</Text></Pressable>
    {children}
  </>,
  RegisterPanel: () => null,
  RegisterCount: () => null,
}));

afterEach(() => { cleanup(); dismissToast(); vi.restoreAllMocks(); });

const openSession = vi.fn<(input: object) => Promise<unknown>>();
const snapshot = (enabled: boolean, session: { status: string; counted_float_minor: number } | null) =>
  ({ enabled, session, lastClosure: undefined, actions: { openSession } });
const OPEN = { status: 'open', counted_float_minor: 15000 };

function mount(first: Record<string, unknown>) {
  current = first;
  const ui = () => <RegisterControls currency="USD" locale="en-US" storeName="Store" cartEmpty><Text>cart</Text></RegisterControls>;
  const view = render(ui());
  return { next(snap: Record<string, unknown>) { current = snap; view.rerender(ui()); } };
}

test('closed, then the cashier opens with a counted float of 150.00: one success toast with the float', async () => {
  openSession.mockReset().mockResolvedValue({ id: 's1' });
  const app = mount(snapshot(true, null));
  await act(async () => { fireEvent.click(screen.getByTestId('stub-open')); });
  app.next(snapshot(true, OPEN));
  expect(openSession).toHaveBeenCalledTimes(1);
  expect(openSession).toHaveBeenCalledWith({ expectedFloatMinor: 10000, countedFloatMinor: 15000 });
  expect(getToasts()).toEqual([expect.objectContaining({ title: '✓ Register open · float $150.00', type: 'success' })]);
});

test('a mount with a session already open shows no toast, nor after a re-render', () => {
  const app = mount(snapshot(true, OPEN));
  expect(getToasts()).toEqual([]);
  app.next(snapshot(true, { ...OPEN }));
  expect(getToasts()).toEqual([]);
});

test('the reload hydration sequence ending open shows no toast', () => {
  // RegisterProvider renders sessions off until the register binds, then no session until the query loads.
  const app = mount(snapshot(false, null));
  app.next(snapshot(true, null));
  app.next(snapshot(true, OPEN));
  expect(getToasts()).toEqual([]);
});

test('open, then counting, then closed shows no open toast', () => {
  const app = mount(snapshot(true, OPEN));
  app.next(snapshot(true, { ...OPEN, status: 'counting' }));
  app.next(snapshot(true, null));
  expect(getToasts()).toEqual([]);
});

test('a refused open shows no toast', async () => {
  openSession.mockReset().mockRejectedValue(new Error('refused'));
  mount(snapshot(true, null));
  await act(async () => { fireEvent.click(screen.getByTestId('stub-open')); });
  expect(openSession).toHaveBeenCalledTimes(1);
  expect(getToasts()).toEqual([]);
});
