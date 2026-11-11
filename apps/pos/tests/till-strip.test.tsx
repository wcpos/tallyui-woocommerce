import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { Closure } from '@tallyui/pos';
import { TillStrip } from '../components/till-strip';
import { useRegister } from '../lib/register/register-context';

vi.mock('../lib/register/register-context', () => ({ useRegister: vi.fn() }));

afterEach(() => { cleanup(); vi.mocked(useRegister).mockReset(); });

const closure = {
  id: 'closure-1', number: 1, closed_at: new Date().toISOString(), closed_by: '2',
  expected: { cash: 10300 }, counted: { cash: 10200 }, variance: { cash: -100 },
} as unknown as Closure;

function register(state: { enabled?: boolean; status?: 'open' | 'closed'; lastClosure?: Closure | null; blind?: boolean }) {
  const { enabled = true, status, lastClosure = null, blind = false } = state;
  vi.mocked(useRegister).mockReturnValue({
    enabled, blind, lastClosure, movements: [], expected: { cash: 10000 },
    session: status ? { id: 'session-1', status, opened_at_gmt: new Date().toISOString(), opened_by: '2', counted_float_minor: 10000 } : null,
  } as unknown as ReturnType<typeof useRegister>);
}

function strip() {
  const handlers = { onPrintXReport: vi.fn(), onReprint: vi.fn(), onOpenClosure: vi.fn() };
  render(<TillStrip orders={null} currency="USD" locale="en-US" resolveCashierName={id => id === '2' ? 'Paul' : id} {...handlers} />);
  return handlers;
}

test('an open session offers Print X-report, which asks for the X print', () => {
  register({ status: 'open', lastClosure: closure });
  const handlers = strip();
  expect(screen.queryByTestId('till-reprint')).toBeNull();
  const button = screen.getByTestId('till-xreport');
  expect(button.textContent).toBe('Print X-report');
  fireEvent.click(button);
  expect(handlers.onPrintXReport).toHaveBeenCalledTimes(1);
  expect(handlers.onReprint).not.toHaveBeenCalled();
});

test('a closed till with a last closure offers Print closure for that closure', () => {
  register({ status: 'closed', lastClosure: closure });
  const handlers = strip();
  expect(screen.queryByTestId('till-xreport')).toBeNull();
  const button = screen.getByTestId('till-reprint');
  expect(button.textContent).toBe('Print closure');
  fireEvent.click(button);
  expect(handlers.onReprint).toHaveBeenCalledWith(closure);
  expect(handlers.onPrintXReport).not.toHaveBeenCalled();
});

test('a till with no session and no closure, or no register binding, shows no actions', () => {
  register({});
  strip();
  expect(screen.queryByTestId('till-actions')).toBeNull();
  cleanup();
  register({ enabled: false, status: 'open', lastClosure: closure });
  strip();
  expect(screen.getByTestId('till-title').textContent).toContain('No register on this device');
  expect(screen.queryByTestId('till-actions')).toBeNull();
});

test('a blind cashier gets no X-report, as on the session card', () => {
  register({ status: 'open', blind: true });
  strip();
  expect(screen.queryByTestId('till-xreport')).toBeNull();
});

test('the last closure line is a button that opens that closure, with its text unchanged', () => {
  register({ status: 'closed', lastClosure: closure });
  const handlers = strip();
  const line = screen.getByTestId('till-last-closure');
  expect(line.getAttribute('role')).toBe('button');
  expect(line.textContent).toMatch(/^Last closure #1 · Today \d{2}:\d{2} · \$1\.00 short$/);
  fireEvent.click(line);
  expect(handlers.onOpenClosure).toHaveBeenCalledWith(closure);
});

test('without onOpenClosure the last closure line is plain text', () => {
  register({ status: 'closed', lastClosure: closure });
  render(<TillStrip orders={null} currency="USD" locale="en-US" resolveCashierName={id => id} />);
  expect(screen.getByTestId('till-last-closure').getAttribute('role')).toBeNull();
});
