import { expect, test } from 'vitest';
import { otherCashiers, rosterAfterSignIn, rosterAfterSwitch, withoutCashier } from '../lib/auth/roster';
import type { Roster } from '../lib/auth/roster';
import type { Session } from '../lib/auth/session';

const home = 'https://shop.test';
const otherHome = 'https://other.test';
const cashier = (uuid: string, home = 'https://shop.test'): Session => ({
  site: { home }, tokens: { user: { uuid } },
} as unknown as Session);
const a = cashier('a');
const b = cashier('b');
const c = cashier('c');

test('withoutCashier drops only that uuid and keeps other stores', () => {
  const otherStore = [cashier('a', otherHome)];
  const roster = { [home]: [a, b, c], [otherHome]: otherStore };
  const result = withoutCashier(roster, home, 'b');
  expect(result).toEqual({ [home]: [a, c], [otherHome]: otherStore });
  expect(result[otherHome]).toBe(otherStore);
});

test('withoutCashier copes with a store that has no list', () => {
  expect(withoutCashier({ [home]: [a] }, otherHome, 'a')).toEqual({ [home]: [a], [otherHome]: [] });
});

test('adding a new cashier appends them', () => {
  expect(rosterAfterSignIn({ [home]: [a, b] }, c, true)).toEqual({ [home]: [a, b, c] });
});

test('adding an existing cashier replaces their entry at the same index', () => {
  const next = { ...b, tokens: { ...b.tokens, accessToken: 'renewed' } };
  expect(rosterAfterSignIn({ [home]: [a, b, c] }, next, true)).toEqual({ [home]: [a, next, c] });
});

test('a plain sign-in drops the signed-in cashier from the list', () => {
  expect(rosterAfterSignIn({ [home]: [b, a, c] }, a, false)).toEqual({ [home]: [b, c] });
});

test('a re-auth drops next and kept, then appends kept last', () => {
  expect(rosterAfterSignIn({ [home]: [b, c, a] }, a, false, b)).toEqual({ [home]: [c, b] });
});

test('switching removes the target and appends the previous cashier', () => {
  expect(rosterAfterSwitch({ [home]: [a, b] }, home, 'a', c)).toEqual({ [home]: [b, c] });
});

test('switching without a previous cashier only removes the target', () => {
  expect(rosterAfterSwitch({ [home]: [a, b] }, home, 'a', null)).toEqual({ [home]: [b] });
});

test('otherCashiers returns none without a session and excludes the current cashier', () => {
  const roster = { [home]: [a, b, c], [otherHome]: [cashier('b', otherHome)] };
  expect(otherCashiers(roster, null)).toEqual([]);
  expect(otherCashiers(roster, b)).toEqual([a, c]);
  expect(otherCashiers({}, a)).toEqual([]);
});

test.each([
  ['remove', (roster: Roster) => withoutCashier(roster, home, 'a')],
  ['add', (roster: Roster) => rosterAfterSignIn(roster, c, true)],
  ['replace', (roster: Roster) => rosterAfterSignIn(roster, { ...a, tokens: { ...a.tokens, accessToken: 'renewed' } }, true)],
  ['sign in', (roster: Roster) => rosterAfterSignIn(roster, a, false)],
  ['re-auth', (roster: Roster) => rosterAfterSignIn(roster, a, false, b)],
  ['switch', (roster: Roster) => rosterAfterSwitch(roster, home, 'a', c)],
  ['switch without previous', (roster: Roster) => rosterAfterSwitch(roster, home, 'a', null)],
  ['list', (roster: Roster) => otherCashiers(roster, a)],
] as const)('%s does not mutate the input roster', (_name, update) => {
  const roster = { [home]: [a, b], [otherHome]: [cashier('a', otherHome)] };
  const original = structuredClone(roster);
  update(roster);
  expect(roster).toEqual(original);
});
