import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { presetRange } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { periodLabel, ReportsPeriod } from '../components/reports-period';
import { classesOf } from './classes-of';

afterEach(cleanup);

// Wednesday 11 November 2026, mid-morning.
const now = new Date(2026, 10, 11, 10, 0);
const label = (preset: Parameters<typeof periodLabel>[1], at = now) => periodLabel(presetRange(preset, at, 'device'), preset, 'en-US');

test('Today and Yesterday read one day', () => {
  expect(label('today')).toEqual({ label: 'Today', dates: 'Wed 11 Nov' });
  expect(label('yesterday')).toEqual({ label: 'Yesterday', dates: 'Tue 10 Nov' });
});

test('This week reads a range in one month; a week across two months names both', () => {
  expect(label('thisWeek')).toEqual({ label: 'This week', dates: '9–11 Nov' });
  expect(label('lastWeek', new Date(2026, 10, 4, 10, 0))).toEqual({ label: 'Last week', dates: '26 Oct–1 Nov' });
});

test('This month and Last month read the month name', () => {
  expect(label('thisMonth')).toEqual({ label: 'This month', dates: 'November' });
  expect(label('lastMonth')).toEqual({ label: 'Last month', dates: 'October' });
});

test('the period button is v2\'s ghost date button: a 44 face, the text-base title, then v2\'s chevronDown with no ▾ glyph', () => {
  render(<><ReportsPeriod preset="today" range={presetRange('today', now, 'device')} locale="en-US" onPreset={vi.fn()} /><PortalHost /></>);
  const button = screen.getByTestId('reports-period');
  expect(button.textContent).toBe('Today · Wed 11 Nov');
  expect(button.textContent).not.toContain('▾');
  expect(button.lastElementChild).toBe(screen.getByTestId('reports-period-chevron'));
  expect(classesOf('reports-period')).toEqual(expect.arrayContaining(['h-11', 'rounded-lg', 'px-1', 'gap-1']));
});

test('the period label takes v2\'s Button label rank, text-base, not text-sm', () => {
  render(<><ReportsPeriod preset="today" range={presetRange('today', now, 'device')} locale="en-US" onPreset={vi.fn()} /><PortalHost /></>);
  expect(screen.getByTestId('reports-period-label').textContent).toBe('Today · Wed 11 Nov');
  expect(classesOf('reports-period-label')).toContain('text-base');
  expect(classesOf('reports-period-label')).not.toContain('text-sm');
});
