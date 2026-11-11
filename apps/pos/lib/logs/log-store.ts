import { callbackSink, outboxLogger, saleLogger, taxLogger, posOrdersLogger, registerSessionsLogger,
  registerFactsLogger, registerCommandsLogger, type LogEntry, type LogLevel, type Logger } from '@tallyui/pos';
import type { RxCollection, RxJsonSchema } from 'rxdb';
import { isVerboseDiagnostics } from './verbose';

// v2 caps its log store at 25 MB; we cap rows because the Logs page loads them all.
export const LOG_STORE_CAP = 500;
// The levels always stored. v2 persists debug only while verbose diagnostics is on (see ./verbose).
export const LOG_STORE_LEVELS: LogLevel[] = ['info', 'warn', 'error'];
// What the sink listens to: debug as well, kept only when isVerboseDiagnostics() holds at write time.
export const LOG_SINK_LEVELS: LogLevel[] = ['debug', ...LOG_STORE_LEVELS];
// Keeps one row's data small enough to read and to copy.
export const LOG_DETAIL_MAX_CHARS = 4_000;
export const TALLYUI_LOGGERS: Logger[] = [outboxLogger, saleLogger, taxLogger, posOrdersLogger,
  registerSessionsLogger, registerFactsLogger, registerCommandsLogger];

// RxDB appends "--------------------\nParameters:\n" and the full JSON of the write (whole documents, customer
// details included) to its error messages (rxdb/src/rx-error.ts parametersToString), so logs keep only the text before it.
export const RXDB_PARAMETERS_SEPARATOR = '-'.repeat(20) + '\n';
export function withoutWriteParameters(text: string): string {
  const at = text.indexOf(RXDB_PARAMETERS_SEPARATOR);
  return (at >= 0 ? text.slice(0, at) : text).trim();
}

export interface LogRecord {
  id: string; timestamp: number; level: LogLevel; scope: string; message: string;
  code?: string; outcome?: string; durationMs?: number; detail?: string;
}
export type LogCollection = RxCollection<LogRecord>;
export const logRecordSchema: RxJsonSchema<LogRecord> = {
  version: 0, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 32 },
    timestamp: { type: 'integer', minimum: 0 },
    level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
    scope: { type: 'string' }, message: { type: 'string' },
    code: { type: 'string' }, outcome: { type: 'string' }, detail: { type: 'string' },
    durationMs: { type: 'number', minimum: 0 },
  },
  required: ['id', 'timestamp', 'level', 'scope', 'message'],
};
let sequence = 0;
let attachments = 0;

export function logRecordId(timestamp: number, sequence: number): string {
  return `${String(timestamp).padStart(15, '0')}-${String(sequence).padStart(6, '0')}`;
}

export function toLogRecord(entry: LogEntry, id: string): LogRecord {
  const { timestamp, level, scope, message, data } = entry;
  const row: LogRecord = { id, timestamp, level, scope, message: withoutWriteParameters(message) };
  if (typeof data?.code === 'string') row.code = data.code;
  if (typeof data?.outcome === 'string') row.outcome = data.outcome;
  if (typeof data?.durationMs === 'number' && Number.isFinite(data.durationMs) && data.durationMs >= 0) {
    row.durationMs = data.durationMs;
  }
  if (data) {
    try {
      const detail = JSON.stringify(data, (_key, value) => value instanceof Error
        ? { name: value.name, message: withoutWriteParameters(value.message),
          ...('code' in value && typeof value.code === 'string' ? { code: value.code } : {}) }
        : typeof value === 'string' ? withoutWriteParameters(value) : value);
      if (detail !== undefined) row.detail = detail.slice(0, LOG_DETAIL_MAX_CHARS);
    } catch {
      row.detail = '[unserializable]';
    }
  }
  return row;
}

export function attachLogStore(
  collection: LogCollection, options: { cap?: number; loggers?: Logger[] } = {},
): { flush(): Promise<void>; detach(): Promise<void> } {
  const { cap = LOG_STORE_CAP, loggers = TALLYUI_LOGGERS } = options;
  const id = `tallywoo-log-store-${++attachments}`;
  let chain = Promise.resolve();
  const sink = callbackSink({ id, levels: LOG_SINK_LEVELS, callback: entry => {
    if (!LOG_STORE_LEVELS.includes(entry.level) && !isVerboseDiagnostics()) return;
    chain = chain.then(async () => {
      await collection.insert(toLogRecord(entry, logRecordId(entry.timestamp, ++sequence)));
      const extra = await collection.find({ sort: [{ id: 'desc' }], skip: cap }).exec();
      if (extra.length) await collection.bulkRemove(extra.map(doc => doc.primary));
    }).catch(() => {});
  } });
  for (const logger of loggers) logger.addSink(sink);
  const flush = () => chain;
  return { flush, async detach() {
    for (const logger of loggers) logger.removeSink(id);
    await flush();
  } };
}
