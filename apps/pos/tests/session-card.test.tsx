import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SessionCard } from '../components/session-card';
import { useRegister } from '../lib/register/register-context';

vi.mock('../lib/register/register-context', () => ({ useRegister: vi.fn() }));

afterEach(() => { cleanup(); vi.mocked(useRegister).mockReset(); });

function card(registerName: string | null) {
  vi.mocked(useRegister).mockReturnValue({
    enabled: true, blind: false, registerName, salesCount: 1, expected: { cash: 10000 },
    session: { id: 'session-1', status: 'open', opened_at_gmt: new Date().toISOString(), opened_by: '2' },
  } as unknown as ReturnType<typeof useRegister>);
  render(<SessionCard currency="USD" locale="en-US" resolveCashierName={() => 'Paul'} onPrintXReport={vi.fn()} />);
  return screen.getByTestId('reports-session-card').textContent;
}

test('the open session names its register, as v2 session-card.tsx does', () => {
  expect(card('Front Counter')).toContain('● Open · Front Counter');
});

test('with no register name the open session reads This till', () => {
  expect(card(null)).toContain('● Open · This till');
});

test("Print X-report leads with v2's printer icon (session-card.tsx `leftIcon=\"print\"`)", () => {
  card('Front Counter');
  const button = screen.getByTestId('x-report-print');
  expect(button.textContent).toBe('Print X-report');
  expect(button.firstElementChild).toBe(screen.getByTestId('x-report-print-icon'));
});
