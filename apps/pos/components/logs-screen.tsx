import { useEffect, useState, type JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Button, SearchInput, Text } from '@tallyui/components';
import type { LogLevel } from '@tallyui/pos';
import type { LogCollection, LogRecord } from '../lib/logs/log-store';
import { IDLE_OUTBOX_STATE, buildDebugInfo, formatDurationMs, formatLogTime, logStats, matchesLogFilter, outboxSyncStats,
  type LogPreset, type OutboxSyncStats } from '../lib/logs/log-view';
import { useVerboseDiagnostics } from '../lib/logs/verbose';

// v2's Stat (packages/components/src/stat): the number above a muted label, pressable as a filter when it has onPress.
// v2's tones: bad reads destructive, good reads success.
function Stat({ testID, value, label, tone, onPress }: {
  testID: string; value: number; label: string; tone?: 'destructive' | 'success'; onPress?(): void;
}): JSX.Element {
  const body = <>
    <Text testID={`${testID}-value`} className={`text-lg font-semibold tabular-nums${
      tone === 'destructive' ? ' text-destructive' : tone === 'success' ? ' text-success' : ''}`}>
      {value.toLocaleString()}</Text>
    <Text className="text-sm text-muted-foreground">{label}</Text>
  </>;
  return onPress
    ? <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      className="-m-1 rounded-md p-1 web:hover:bg-accent/50">{body}</Pressable>
    : <View testID={testID} className="-m-1 p-1">{body}</View>;
}

// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// v2's search fold (foldLogSearchText, packages/utils/src/logger/index.ts:160): lowercase, NFD, no combining marks.
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
// v2 searches a fold of the message, the code and the row's category (packages/utils/src/logger/index.ts:187).
function matchesSearch(row: LogRecord, search: string): boolean {
  return !search || fold([row.message, row.code, row.scope].filter(Boolean).join(' ')).includes(fold(search));
}

// v2's Chip at size sm (packages/components/src/chip/index.tsx:156): a rounded pill, tinted when on.
function Chip({ testID, label, on, pressed, onPress }: {
  testID: string; label: string; on: boolean; pressed?: boolean; onPress(): void;
}): JSX.Element {
  return <Pressable testID={testID} role="button" aria-pressed={pressed} onPress={onPress}
    className={`h-8 flex-row items-center self-start rounded-full border px-2.5 ${
      on ? 'border-primary bg-primary/10' : 'border-border bg-card web:hover:bg-accent'}`}>
    <Text className={`text-sm font-normal ${on ? 'text-primary' : 'text-foreground'}`}>{label}</Text>
  </Pressable>;
}

// v2's LEVEL_TONE dots (logs/ledger.tsx:40, components/src/lib/tone.ts): error bad, warn warning, the rest muted.
const LEVEL_DOT: Record<LogLevel, string> = {
  error: 'bg-destructive', warn: 'bg-warning', info: 'bg-muted-foreground', debug: 'bg-muted-foreground' };
// v2's table head text (TABLE_HEAD_TEXT, components/src/text/ladder.ts:18).
const HEAD = 'text-xs uppercase tracking-wide text-muted-foreground';

// v2's RowDetail (logs/row-detail.tsx:225): the row's facts as label and value, inline under the row.
function RowDetail({ row }: { row: LogRecord }): JSX.Element {
  const { actor, syncRecord } = row;
  const facts: [string, string | undefined][] = [
    ['Code', row.code], ['Outcome', row.outcome], ['Duration', formatDurationMs(row.durationMs) ?? undefined],
    ['Actor', actor && [actor.name, actor.role, actor.id && `id ${actor.id}`].filter(Boolean).join(', ')],
    ['Record', syncRecord && `${syncRecord.collection} ${syncRecord.recordId} · ${syncRecord.outcome}`],
    ['Reason', syncRecord?.reason], ['Details', row.detail], ['Log id', row.id],
  ];
  return <View testID={`logs-detail-${row.id}`} className="ml-42 gap-1 py-2">
    {facts.filter(([, value]) => value).map(([label, value]) => <View key={label} className="flex-row items-baseline gap-3">
      <Text className="w-24 text-sm text-muted-foreground">{label}</Text>
      <Text testID={`logs-detail-${row.id}-${label.toLowerCase().replace(' ', '-')}`} selectable
        className="flex-1 text-sm">{value}</Text>
    </View>)}
  </View>;
}

export function LogsScreen({ collection, storeName, siteUrl,
  copyText = typeof navigator !== 'undefined' && navigator.clipboard?.writeText
    ? text => navigator.clipboard.writeText(text) : null, now = Date.now, sync,
}: {
  collection: LogCollection; storeName: string; siteUrl: string;
  copyText?: ((text: string) => Promise<void>) | null; now?: () => number;
  /** The outboxes' stuck records and changes waiting to send (outboxSyncStats); both stats are drawn only when given. */
  sync?: OutboxSyncStats;
}): JSX.Element {
  const [rows, setRows] = useState<LogRecord[]>([]);
  const [preset, setPreset] = useState<LogPreset>('all');
  const [level, setLevel] = useState<LogLevel>();
  const [copyStatus, setCopyStatus] = useState<string>();
  const { verbose, setVerbose } = useVerboseDiagnostics(now);
  useEffect(() => {
    const subscription = collection.find({ sort: [{ id: 'desc' }] }).$.subscribe(
      docs => setRows(docs.map(doc => doc.toJSON())));
    return () => subscription.unsubscribe();
  }, [collection]);
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded(previous => ({ ...previous, [id]: !previous[id] }));
  // v2 ANDs the search with the preset, the level and verbose (logs/index.tsx:188, one query of filters and search).
  const filtered = rows.filter(row => matchesSearch(row, search) && matchesLogFilter(row, preset, level, verbose));
  // The strip counts what All shows: debug rows only while verbose is on.
  const counted = verbose ? rows : rows.filter(row => row.level !== 'debug');
  // The footer's total is what All shows for the search, as v2's count follows its search.
  const searched = counted.filter(row => matchesSearch(row, search));
  const stats = logStats(counted, now());
  async function copyDebugInfo() {
    if (!copyText) return;
    try {
      await copyText(buildDebugInfo({ now: now(), storeName, siteUrl, rows: counted, verbose,
        sync: sync ?? outboxSyncStats(IDLE_OUTBOX_STATE) }));
      setCopyStatus('Debug info copied');
    } catch {
      setCopyStatus("Couldn't copy debug info");
    }
  }
  // The Store health area (app/health/_layout.tsx) draws the scroll, the page title and the way back.
  return (
    <View testID="screen-logs">
      <View testID="logs-stats" className="mb-4 flex-row flex-wrap items-start gap-x-6 gap-y-3 border-b border-border pb-3">
        <Stat testID="logs-stat-events" value={stats.eventsToday} label="events today" onPress={() => setPreset('all')} />
        <Stat testID="logs-stat-errors" value={stats.errorsToday} label="errors today"
          tone={stats.errorsToday > 0 ? 'destructive' : undefined} onPress={() => setPreset('errors')} />
        {/* v2: Sync, not Errors, since a stuck record's row can be a warn the Errors chip hides. */}
        {sync && <Stat testID="logs-stat-stuck" value={sync.stuck} label="stuck records"
          tone={sync.stuck > 0 ? 'destructive' : 'success'} onPress={() => setPreset('sync')} />}
        {sync && <Stat testID="logs-stat-waiting" value={sync.waiting} label="changes waiting to send"
          tone={sync.waiting > 0 ? 'destructive' : 'success'} />}
        <View className="flex-1" />
        {copyText !== null && <Button testID="logs-copy-debug" variant="outline" size="sm"
          onPress={() => { void copyDebugInfo(); }}><Text>Copy debug info</Text></Button>}
      </View>
      {/* v2 (logs/index.tsx:389): the search sits between the stats and the chips. */}
      <SearchInput testID="search-logs" value={term} onChangeText={setTerm} placeholder="Search Logs" className="mb-3" />
      <View className="mb-4 flex-row flex-wrap items-center gap-2">
        {(['all', 'actions', 'errors', 'sync'] as const).map(value => <Chip key={value} testID={`logs-chip-${value}`}
          label={{ all: 'All', actions: 'Actions', errors: 'Errors', sync: 'Sync' }[value]} on={preset === value}
          pressed={preset === value} onPress={() => setPreset(value)} />)}
        {level !== undefined && <Chip testID="logs-chip-kind" label={`${level} ×`} on onPress={() => setLevel(undefined)} />}
        <View className="flex-1" />
        <Chip testID="logs-chip-verbose" label={`Verbose diagnostics: ${verbose ? 'on' : 'off'}`} on={verbose}
          pressed={verbose} onPress={() => setVerbose(!verbose)} />
      </View>
      {copyStatus && <Text testID="logs-copy-status">{copyStatus}</Text>}
      {/* v2's ledger head (logs/ledger.tsx:391); the duration column keeps v2's testID, "took". */}
      <View className="h-9 flex-row items-center gap-3 border-b border-border">
        <Text testID="logs-heading-time" className={`w-20 ${HEAD}`}>Time</Text>
        <Text testID="logs-heading-level" className={`w-16 ${HEAD}`}>Level</Text>
        <Text testID="logs-heading-event" className={`flex-1 ${HEAD}`}>Event</Text>
        <Text testID="logs-heading-took" className={`w-16 text-right ${HEAD}`}>Duration</Text>
        <Text testID="logs-heading-status" className={`w-32 text-right ${HEAD}`}>Status</Text>
      </View>
      {/* v2's LedgerRow (logs/ledger.tsx:244): the whole row toggles its detail through an overlay under the
          level and chevron buttons, since a button inside a button is invalid on the web. */}
      {filtered.map(row => <View key={row.id} testID={`logs-row-${row.id}`} className="border-b border-border">
        <View className="relative flex-row items-baseline gap-3 py-2 web:hover:bg-accent/20">
          <Pressable testID={`logs-toggle-${row.id}`} role="button" aria-expanded={!!expanded[row.id]}
            aria-label={`${row.level} · ${row.message}`} onPress={() => toggle(row.id)} className="absolute inset-0 z-10" />
          <Text className="w-20 font-mono text-sm tabular-nums text-muted-foreground">{formatLogTime(row.timestamp, now())}</Text>
          <View className="z-20 w-16">
            <Pressable testID={`logs-pill-${row.id}`} role="button" aria-selected={level === row.level}
              onPress={() => setLevel(level === row.level ? undefined : row.level)}
              className={`-mx-1.5 flex-row items-center gap-1.5 self-start rounded-full px-1.5 py-0.5 web:hover:bg-accent/60${
                level === row.level ? ' bg-muted' : ''}`}>
              <View aria-hidden className={`size-1.5 shrink-0 rounded-full ${LEVEL_DOT[row.level]}`} />
              <Text className="text-sm text-muted-foreground">{row.level}</Text>
            </Pressable>
          </View>
          <View className="min-w-0 flex-1">
            <Text>{row.message}</Text>
            <Text testID={`logs-scope-${row.id}`} className="pt-0.5 font-mono text-xs text-muted-foreground/80">{row.scope}</Text>
          </View>
          <Text testID={`logs-took-${row.id}`} className="w-16 text-right font-mono text-sm tabular-nums text-muted-foreground">
            {formatDurationMs(row.durationMs) ?? '—'}</Text>
          <View className="w-32 flex-row items-center justify-end gap-1.5">
            {(row.level === 'warn' || row.level === 'error') && row.code
              ? <Text testID={`logs-code-${row.id}`} className="text-xs">{row.code}</Text>
              : row.level === 'info' && row.outcome === 'ok'
                ? <Text testID={`logs-ok-${row.id}`} className="text-xs font-semibold text-success">✓ ok</Text>
                : <Text className="text-xs text-muted-foreground/50">—</Text>}
            <Pressable testID={`logs-chevron-${row.id}`} role="button" aria-label="Details" onPress={() => toggle(row.id)}
              className="z-20 px-1">
              <Text className="text-muted-foreground/60">{expanded[row.id] ? '⌄' : '›'}</Text>
            </Pressable>
          </View>
        </View>
        {expanded[row.id] && <RowDetail row={row} />}
      </View>)}
      {filtered.length === 0 && <Text testID="logs-empty">No logs found</Text>}
      <Text testID="logs-footer" className="mt-4 text-muted-foreground">{`Showing ${filtered.length} of ${searched.length}`}</Text>
    </View>
  );
}
