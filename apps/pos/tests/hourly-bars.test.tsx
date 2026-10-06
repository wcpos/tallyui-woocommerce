import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { HourlyBars } from '../components/hourly-bars';
import type { HourBucket } from '../lib/reports/sales-room';

afterEach(cleanup);

const hours: HourBucket[] = [
  { hour: 9, today: { count: 2, totalMinor: 1158 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 10, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 11, today: { count: 0, totalMinor: 0 }, yesterday: { count: 1, totalMinor: 400 } },
  { hour: 12, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 13, today: { count: 2, totalMinor: 1838 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 14, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 15, today: { count: 0, totalMinor: 0 }, yesterday: { count: 0, totalMinor: 0 } },
  { hour: 16, today: { count: 0, totalMinor: 0 }, yesterday: { count: 1, totalMinor: 600 } },
];

test('one column per hour, in order', () => {
  render(<HourlyBars hours={hours} currency="USD" locale="en-US" />);
  expect(screen.getByText('Filled: today · Dashed: yesterday')).not.toBeNull();
  expect(screen.getAllByTestId(/^sales-hour-\d\d$/).map(column => column.getAttribute('data-testid'))).toEqual([
    'sales-hour-09', 'sales-hour-10', 'sales-hour-11', 'sales-hour-12',
    'sales-hour-13', 'sales-hour-14', 'sales-hour-15', 'sales-hour-16',
  ]);
  for (const hour of ['09', '10', '11', '12', '13', '14', '15', '16']) {
    expect(screen.getByText(hour)).not.toBeNull();
  }
});

test('both days share one scale', () => {
  render(<HourlyBars hours={hours} currency="USD" locale="en-US" />);
  expect(getComputedStyle(screen.getByTestId('sales-hour-13-today')).height).toBe('100%');
  expect(getComputedStyle(screen.getByTestId('sales-hour-09-today')).height).toBe('63%');
  expect(getComputedStyle(screen.getByTestId('sales-hour-10-today')).height).toBe('0%');
  expect(getComputedStyle(screen.getByTestId('sales-hour-16-yesterday')).height).toBe('33%');
  expect(getComputedStyle(screen.getByTestId('sales-hour-11-yesterday')).height).toBe('22%');
  expect(screen.queryByTestId('sales-hour-10-yesterday')).toBeNull();
  expect(screen.getByTestId('sales-hour-16-today').compareDocumentPosition(
    screen.getByTestId('sales-hour-16-yesterday'),
  ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("yesterday's peak sets the scale when it is higher", () => {
  const higherYesterday = hours.map(bucket => bucket.hour === 16
    ? { ...bucket, yesterday: { count: 1, totalMinor: 2400 } } : bucket);
  render(<HourlyBars hours={higherYesterday} currency="USD" locale="en-US" />);
  expect(getComputedStyle(screen.getByTestId('sales-hour-13-today')).height).toBe('77%');
  expect(getComputedStyle(screen.getByTestId('sales-hour-09-today')).height).toBe('48%');
  expect(getComputedStyle(screen.getByTestId('sales-hour-16-yesterday')).height).toBe('100%');
});

test('the busiest hour is named', () => {
  const { rerender } = render(<HourlyBars hours={hours} currency="USD" locale="en-US" />);
  expect(screen.getByText('Busiest hour: 13:00 · $18.38 · 2 orders')).not.toBeNull();
  const tiedHours = hours.map(bucket => bucket.hour === 9
    ? { ...bucket, today: { count: 1, totalMinor: 1838 } } : bucket);
  rerender(<HourlyBars hours={tiedHours} currency="USD" locale="en-US" />);
  expect(screen.getByText('Busiest hour: 09:00 · $18.38 · 1 order')).not.toBeNull();
});

test('each column describes itself', () => {
  render(<HourlyBars hours={hours} currency="USD" locale="en-US" />);
  expect(screen.getByTestId('sales-hour-13').getAttribute('aria-label')).toBe('13:00 — today $18.38, 2 orders; yesterday $0.00');
  expect(screen.getByTestId('sales-hour-11').getAttribute('aria-label')).toBe('11:00 — today $0.00, 0 orders; yesterday $4.00');
});

test('no busiest line when today has no sales', () => {
  const yesterdayOnly: HourBucket[] = [
    { hour: 11, today: { count: 0, totalMinor: 0 }, yesterday: { count: 1, totalMinor: 400 } },
  ];
  render(<HourlyBars hours={yesterdayOnly} currency="USD" locale="en-US" />);
  expect(screen.queryByText(/^Busiest hour/)).toBeNull();
  expect(getComputedStyle(screen.getByTestId('sales-hour-11-yesterday')).height).toBe('100%');
});

test('renders nothing without sales', () => {
  render(<HourlyBars hours={[]} currency="USD" locale="en-US" />);
  expect(screen.queryByTestId('sales-room-hours')).toBeNull();
});
