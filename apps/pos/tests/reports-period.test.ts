import { expect, test } from 'vitest';
import { presetRange } from '@tallyui/pos';
import { periodLabel } from '../components/reports-period';

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
