import type { LogLevel } from '@tallyui/pos';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../software';
import type { LogRecord } from './log-store';

export type LogPreset = 'all' | 'errors' | 'sync';
// The TallyUI outboxes that send to the store.
export const SYNC_SCOPES = ['outbox', 'register-commands'];
// v2 readRecentErrorLogs keeps 10.
export const RECENT_ERRORS_LIMIT = 10;

export function matchesLogFilter(row: LogRecord, preset: LogPreset, level?: LogLevel): boolean {
  return (level === undefined || row.level === level)
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

export function buildDebugInfo({ now, storeName, siteUrl, rows }: {
  now: number; storeName: string; siteUrl: string; rows: LogRecord[];
}): string {
  const today = rows.filter(row => row.timestamp >= startOfLocalDay(now));
  const errors = rows.filter(row => row.level === 'error').slice(0, RECENT_ERRORS_LIMIT);
  return [
    `${SOFTWARE_NAME} debug info — ${new Date(now).toISOString()}`,
    `App version: ${SOFTWARE_VERSION}`, `Store: ${storeName}`, `Site: ${siteUrl}`,
    `Events today: ${today.length}`, `Errors today: ${today.filter(row => row.level === 'error').length}`,
    '', `Recent errors (${errors.length}):`,
    ...(errors.length ? errors.map(row => `  - ${new Date(row.timestamp).toISOString()} | ${row.code ?? '-'} | ${row.scope} | ${row.message}`) : ['  none']),
  ].join('\n');
}
