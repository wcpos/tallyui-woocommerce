import { deriveStuckRecords, hasActor, presetFilters, type LogEntry, type LogLevel, type StuckRecord } from '@tallyui/pos';
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

/** v2's events today and errors today (rows since the start of the local day), and its stuck records. */
export function logStats(rows: LogRecord[], now: number): { eventsToday: number; errorsToday: number; stuck: StuckRecord[] } {
  const today = rows.filter(row => row.timestamp >= startOfLocalDay(now));
  // deriveStuckRecords breaks timestamp ties by position, so it gets the rows oldest first, in id (write) order.
  const entries: LogEntry[] = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ level, scope, message, timestamp, actor, syncRecord }) => ({ level, scope, message, timestamp, actor, syncRecord }));
  return { eventsToday: today.length, errorsToday: today.filter(row => row.level === 'error').length,
    stuck: deriveStuckRecords(entries) };
}

// v2 takes the stuck records as their own input, so the copy shows the same records as the stat.
export function buildDebugInfo({ now, storeName, siteUrl, rows, verbose, stuck }: {
  now: number; storeName: string; siteUrl: string; rows: LogRecord[]; verbose: boolean; stuck: StuckRecord[];
}): string {
  const { eventsToday, errorsToday } = logStats(rows, now);
  const errors = rows.filter(row => row.level === 'error').slice(0, RECENT_ERRORS_LIMIT);
  return [
    `${SOFTWARE_NAME} debug info — ${new Date(now).toISOString()}`,
    `App version: ${SOFTWARE_VERSION}`, `Store: ${storeName}`, `Site: ${siteUrl}`,
    `Events today: ${eventsToday}`, `Errors today: ${errorsToday}`, `Stuck records: ${stuck.length}`,
    `Verbose diagnostics: ${verbose ? 'on' : 'off'}`,
    '', `Recent errors (${errors.length}):`,
    ...(errors.length ? errors.map(row => `  - ${new Date(row.timestamp).toISOString()} | ${row.code ?? '-'} | ${row.scope} | ${row.message}`) : ['  none']),
    '', `Stuck records (${stuck.length}):`,
    ...(stuck.length ? stuck.slice(0, DEBUG_STUCK_RECORDS_LIMIT).map(record => `  - ${new Date(record.lastSeen).toISOString()} | ${record.outcome} | ${record.code ?? '-'}`
      + ` | ${record.collection}:${record.recordId} | ${record.reason}`) : ['  none']),
  ].join('\n');
}
