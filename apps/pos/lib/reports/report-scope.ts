// The reports screen's two scopes (reports-screen.tsx): the sales period and the closures list.
import { clampClosureScope, comparisonRange, daysOf, presetRange, selectClosureRows, type Closure, type DatePreset, type DayRange, type RegisterSession } from '@tallyui/pos';
import { isMultiDay, rangeBounds, storeDay, type Compare } from './sales-room';

/** The Sales room's period: the preset's range from the day the screen opened, the comparison range (yesterday or the
 *  same weekday last week for one day; the period before for several days), and the comparison's name. */
export function salesPeriod(period: DatePreset | DayRange, compare: Compare, opened: Date, locale: string): {
  range: DayRange; multiDay: boolean; comparison: DayRange; bounds: ReturnType<typeof rangeBounds>;
  since: string; weekday: string; comparisonName: string; chartName: string;
} {
  const preset = typeof period === 'string' ? period : undefined;
  const range = typeof period === 'string' ? presetRange(period, opened, 'device') : period;
  const multiDay = isMultiDay(range, preset);
  const comparison = comparisonRange(range, !multiDay && compare === 'lastweek' ? 'week' : 'previous', preset);
  const bounds = rangeBounds(range);
  const since = rangeBounds(comparison).startIso;
  const weekday = new Date(bounds.startIso).toLocaleDateString(locale, { weekday: 'long' });
  const month = preset ? preset.endsWith('Month') : daysOf(range).length > 7;
  const day = compare === 'yesterday' ? 'yesterday' : `last ${weekday}`;
  // v2 hero/index.tsx:476-481 names the period before "the week/month before"; v2 chart.tsx:150-158 calls it last week/month.
  const comparisonName = multiDay ? (month ? 'the month before' : 'the week before') : day;
  const chartName = multiDay ? (month ? 'last month' : 'last week') : day;
  return { range, multiDay, comparison, bounds, since, weekday, comparisonName, chartName };
}

/** A live period's buckets after now are the future. Returns live = the period ends today, and nowKey = now's minute
 *  of the day, or today's index in the period's days; with no live period, nowKey = +Infinity. */
export function periodNow(range: DayRange, multiDay: boolean, now: Date): { live: boolean; nowKey: number } {
  const live = range.to === storeDay(now);
  const nowKey = !live ? Number.POSITIVE_INFINITY
    : multiDay ? daysOf(range).indexOf(storeDay(now)) : now.getHours() * 60 + now.getMinutes();
  return { live, nowKey };
}

/** The Closures room's rows, and the open register session that counts beside them. */
export function closuresScope(rows: Closure[], scope: {
  range: DayRange; registerId: string; storeKey: string; cashier: string | null; today: string; active: RegisterSession | null;
}): { closures: Closure[]; openSession: RegisterSession | null } {
  const { range: closuresRange, registerId, storeKey, cashier: closuresCashier, today, active } = scope;
  // `selectClosureRows` matches `cashier` against a closure's `closed_by`, the user id as a string; All passes none.
  const closures = selectClosureRows(rows, clampClosureScope({
    from: closuresRange.from, to: closuresRange.to, registerId, storeKey,
    cashier: closuresCashier ?? undefined,
  }, today), 'device');
  // v2 closures/index.tsx: an open session has no closer yet, so its opener stands in for the cashier;
  // v2 closure-list.tsx `inPeriod`: it counts only when the period spans today.
  const openSession = active && (closuresCashier === null || active.opened_by === closuresCashier)
    && closuresRange.from <= today && today <= closuresRange.to ? active : null;
  return { closures, openSession };
}
