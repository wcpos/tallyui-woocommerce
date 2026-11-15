import { expect, test } from 'vitest';
import { dayRange } from '../lib/reports/today-sales';

test('dayRange spans local midnight to the next local midnight', () => {
  expect(dayRange(new Date(2026, 9, 6, 15, 0))).toEqual({
    startIso: new Date(2026, 9, 6).toISOString(),
    endIso: new Date(2026, 9, 7).toISOString(),
  });
}, 20_000);
