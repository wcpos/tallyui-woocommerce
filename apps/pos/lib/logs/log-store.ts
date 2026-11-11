import { callbackSink, hasActor, outboxLogger, saleLogger, taxLogger, posOrdersLogger, registerSessionsLogger,
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
  actor?: { id?: string; name?: string; role?: string };
  syncRecord?: { collection: string; recordId: string; outcome: 'ok' | 'failed' | 'pending'; code?: string; reason?: string };
}
export type LogCollection = RxCollection<LogRecord>;
export const logRecordSchema: RxJsonSchema<LogRecord> = {
  version: 1, primaryKey: 'id', type: 'object',
  properties: {
    id: { type: 'string', maxLength: 32 },
    timestamp: { type: 'integer', minimum: 0 },
    level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
    scope: { type: 'string' }, message: { type: 'string' },
    code: { type: 'string' }, outcome: { type: 'string' }, detail: { type: 'string' },
    durationMs: { type: 'number', minimum: 0 },
    actor: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' } } },
    syncRecord: {
      type: 'object',
      properties: {
        collection: { type: 'string' }, recordId: { type: 'string' },
        outcome: { type: 'string', enum: ['ok', 'failed', 'pending'] },
        code: { type: 'string' }, reason: { type: 'string' },
      },
      required: ['collection', 'recordId', 'outcome'],
    },
  },
  required: ['id', 'timestamp', 'level', 'scope', 'message'],
};
// Version 1 only adds the optional actor and syncRecord fields, so version 0 rows carry over unchanged.
export const logRecordMigrationStrategies = { 1: (doc: any) => doc };
let sequence = 0;
let attachments = 0;

export function logRecordId(timestamp: number, sequence: number): string {
  return `${String(timestamp).padStart(15, '0')}-${String(sequence).padStart(6, '0')}`;
}

export function toLogRecord(entry: LogEntry, id: string): LogRecord {
  const { timestamp, level, scope, message, data, actor, syncRecord } = entry;
  const row: LogRecord = { id, timestamp, level, scope, message: withoutWriteParameters(message) };
  if (actor && hasActor(entry)) {
    const { id: actorId, name, role } = actor;
    row.actor = { ...(typeof actorId === 'string' ? { id: actorId } : {}), ...(typeof name === 'string' ? { name } : {}),
      ...(typeof role === 'string' ? { role } : {}) };
  }
  if (syncRecord) {
    const { collection, recordId, outcome, code, reason } = syncRecord;
    row.syncRecord = { collection, recordId, outcome, ...(typeof code === 'string' ? { code } : {}),
      ...(typeof reason === 'string' ? { reason: withoutWriteParameters(reason) } : {}) };
  }
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
    // A failed write warns on the console, never through a TallyUI logger (that would loop back into this sink),
    // and the chain carries on to the next entry.
    chain = chain.then(async () => {
      await collection.insert(toLogRecord(entry, logRecordId(entry.timestamp, ++sequence)));
      const extra = await collection.find({ sort: [{ id: 'desc' }], skip: cap }).exec();
      if (extra.length) await collection.bulkRemove(extra.map(doc => doc.primary));
    }).catch(error => { console.warn('[tallywoo] could not store a log entry', error); });
  } });
  for (const logger of loggers) logger.addSink(sink);
  const flush = () => chain;
  return { flush, async detach() {
    for (const logger of loggers) logger.removeSink(id);
    await flush();
  } };
}
