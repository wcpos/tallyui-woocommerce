import { hasActor, presetFilters, summarizeOutboxHealth, type LogLevel, type OutboxState } from '@tallyui/pos';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../software';
import type { LogRecord } from './log-store';

export type LogPreset = 'all' | 'actions' | 'errors' | 'sync';
// The TallyUI outboxes that send to the store.
export const SYNC_SCOPES = ['outbox', 'register-commands'];
// v2 readRecentErrorLogs keeps 10.
export const RECENT_ERRORS_LIMIT = 10;
// v2 buildDebugInfo lists the first 10 stuck records under their full count.
export const DEBUG_STUCK_RECORDS_LIMIT = 10;

// v2 presetFilters: debug rows show under All, Actions and Sync only while verbose diagnostics is on; Errors stays
// error-only. Actions keeps only what a person did: rows whose actor names an id or a name.
export function matchesLogFilter(row: LogRecord, preset: LogPreset, level?: LogLevel, verbose = false): boolean {
  if (level !== undefined && row.level !== level) return false;
  if (preset === 'actions') return presetFilters('actions', verbose).level.includes(row.level) && hasActor(row);
  return (verbose || row.level !== 'debug')
    && (preset === 'all' || (preset === 'errors' ? row.level === 'error' : SYNC_SCOPES.includes(row.scope)));
}

export function formatDurationMs(ms: number | undefined): string | null {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)}m ${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}s`;
}

export function startOfLocalDay(now: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function formatLogTime(timestamp: number, now: number): string {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return timestamp >= startOfLocalDay(now) ? time
    : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

/** v2's events today and errors today: rows since the start of the local day. */
export function logStats(rows: LogRecord[], now: number): { eventsToday: number; errorsToday: number } {
  const today = rows.filter(row => row.timestamp >= startOfLocalDay(now));
  return { eventsToday: today.length, errorsToday: today.filter(row => row.level === 'error').length };
}

export const IDLE_OUTBOX_STATE: OutboxState = { pending: 0, sending: false };
export interface OutboxSyncStats {
  waiting: number; stuck: number; rejected: number;
  failing: { commandId: string; since: number; reason: string }[];
}

// Stuck records and changes waiting to send come from the outboxes' own state, not from log rows. Tally sends no
// register_commands yet (useRegisterSession gets no `commands`); when it does, the register outbox's state goes in
// as the second argument.
export function outboxSyncStats(sales: OutboxState, tillUpdates: OutboxState = IDLE_OUTBOX_STATE): OutboxSyncStats {
  const health = summarizeOutboxHealth(sales, tillUpdates);
  const failing = [sales, tillUpdates].flatMap(state => state.stuck?.orders ?? [])
    .map(({ commandId, since, reason }) => ({ commandId, since, reason })).sort((a, b) => a.since - b.since);
  return { waiting: health.sales.pending + health.tillUpdates.pending, stuck: health.attention,
    rejected: health.sales.rejected + health.tillUpdates.rejected, failing };
}

// v2 takes the stuck records as their own input, so the copy shows the same counts as the stats.
export function buildDebugInfo({ now, storeName, siteUrl, rows, verbose, sync }: {
  now: number; storeName: string; siteUrl: string; rows: LogRecord[]; verbose: boolean; sync: OutboxSyncStats;
}): string {
  const { eventsToday, errorsToday } = logStats(rows, now);
  const errors = rows.filter(row => row.level === 'error').slice(0, RECENT_ERRORS_LIMIT);
  const stuckLines = [
    ...sync.failing.slice(0, DEBUG_STUCK_RECORDS_LIMIT).map(order => `  - ${new Date(order.since).toISOString()} | failing`
      + ` | ${order.commandId} | ${order.reason}`),
    ...(sync.rejected > 0 ? [`  - ${sync.rejected} refused by the store: see Store health`] : []),
  ];
  return [
    `${SOFTWARE_NAME} debug info — ${new Date(now).toISOString()}`,
    `App version: ${SOFTWARE_VERSION}`, `Store: ${storeName}`, `Site: ${siteUrl}`,
    `Events today: ${eventsToday}`, `Errors today: ${errorsToday}`, `Stuck records: ${sync.stuck}`,
    `Changes waiting to send: ${sync.waiting}`, `Verbose diagnostics: ${verbose ? 'on' : 'off'}`,
    '', `Recent errors (${errors.length}):`,
    ...(errors.length ? errors.map(row => `  - ${new Date(row.timestamp).toISOString()} | ${row.code ?? '-'} | ${row.scope} | ${row.message}`) : ['  none']),
    '', `Stuck records (${sync.stuck}):`, ...(stuckLines.length ? stuckLines : ['  none']),
  ].join('\n');
}
