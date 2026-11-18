import { useEffect, useState, type JSX } from 'react';
import { Pressable, View } from 'react-native';
import { Button, SearchInput, Text } from '@tallyui/components';
import type { SyncCadenceRunner } from '@tallyui/database';
import type { LogLevel } from '@tallyui/pos';
import { useCheckStatusLabel } from '../lib/health/use-check-status';
import { useIsWide } from '../lib/layout/wide';
import type { LogCollection, LogRecord } from '../lib/logs/log-store';
import { IDLE_OUTBOX_STATE, buildDebugInfo, buildLogEntryReport, formatDurationMs, formatLogTime, logStats, matchesLogFilter, outboxSyncStats,
  type LogPreset, type OutboxSyncStats } from '../lib/logs/log-view';
import { useVerboseDiagnostics } from '../lib/logs/verbose';
import { useSearchTerm } from '../lib/search-term';
import { toast } from '../lib/toast/toast';
import { chipInkClassName, chipToneClassName } from './catalogue-filter-chips';
import { EmptyState } from './empty-state';
import { ChevronDownIcon, ChevronRightIcon } from './icons';

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

// v2's search fold (foldLogSearchText, packages/utils/src/logger/index.ts:160): lowercase, NFD, no combining marks.
function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
// v2 searches a fold of the message, the code and the row's category (packages/utils/src/logger/index.ts:187).
function matchesSearch(row: LogRecord, search: string): boolean {
  return !search || fold([row.message, row.code, row.scope].filter(Boolean).join(' ')).includes(fold(search));
}

// v2's Chip at size sm (packages/components/src/chip/index.tsx:156): a rounded pill in the shared chip tone and ink
// (chip/index.tsx:106, :163), hovered with the accent only when off.
function Chip({ testID, label, on, pressed, onPress }: {
  testID: string; label: string; on: boolean; pressed?: boolean; onPress(): void;
}): JSX.Element {
  return <Pressable testID={testID} role="button" aria-pressed={pressed} onPress={onPress}
    className={`h-8 flex-row items-center self-start rounded-full border px-2.5 ${chipToneClassName(on)}${
      on ? '' : ' web:hover:bg-accent'}`}>
    <Text testID={`${testID}-label`} className={`text-sm font-normal ${chipInkClassName(on)}`}>{label}</Text>
  </Pressable>;
}

// v2's LEVEL_TONE dots (logs/ledger.tsx:40, components/src/lib/tone.ts): error bad, warn warning, the rest muted.
const LEVEL_DOT: Record<LogLevel, string> = {
  error: 'bg-destructive', warn: 'bg-warning', info: 'bg-muted-foreground', debug: 'bg-muted-foreground' };
// v2's table head text (TABLE_HEAD_TEXT, components/src/text/ladder.ts:18).
const HEAD = 'text-xs uppercase tracking-wide text-muted-foreground';

function LevelMark({ level }: { level: LogLevel }): JSX.Element {
  return <>
    <View aria-hidden className={`size-1.5 shrink-0 rounded-full ${LEVEL_DOT[level]}`} />
    <Text className="text-sm text-muted-foreground">{level}</Text>
  </>;
}

function StatusCell({ row, expanded, onToggle, className }: {
  row: LogRecord; expanded: boolean; onToggle(): void; className: string;
}): JSX.Element {
  // v2 logs/ledger.tsx:163-167: box-none with passive text, so only the chip and chevron take presses and the rest
  // falls through to the row. react-native-web gives each View z-index 0, so the wide caller lifts the cell (z-20).
  return <View testID={`logs-status-${row.id}`} pointerEvents="box-none" className={className}>
    {/* v2's CodeChip (components/src/code-chip/index.tsx), pressable to toggle the row (logs/ledger.tsx:152-155);
        v2's bad is the destructive red (apps/main/global.css:441, --bad: var(--destructive)). */}
    {(row.level === 'warn' || row.level === 'error') && row.code
      ? <Pressable testID={`logs-code-${row.id}`} role="button" aria-label={row.code} onPress={onToggle}
        className="z-20 self-end rounded-md bg-destructive/15 px-2 py-0.5 web:hover:bg-destructive/20">
        <Text testID={`logs-code-${row.id}-label`} className="font-mono text-xs font-semibold text-destructive">{row.code}</Text>
      </Pressable>
      : <View pointerEvents="none">{row.level === 'info' && row.outcome === 'ok'
        ? <Text testID={`logs-ok-${row.id}`} className="text-xs font-semibold text-success">✓ ok</Text>
        : <Text className="text-xs text-muted-foreground/50">—</Text>}</View>}
    {/* v2 logs/ledger.tsx:170-176: chevronDown or chevronRight at size sm (size-4, icon/index.tsx:29). */}
    <Pressable testID={`logs-chevron-${row.id}`} role="button" aria-label="Details" onPress={onToggle}
      className="z-20 px-1">
      {expanded ? <ChevronDownIcon testID={`logs-chevron-${row.id}-down`} size={16} className="text-muted-foreground/60" />
        : <ChevronRightIcon testID={`logs-chevron-${row.id}-right`} size={16} className="text-muted-foreground/60" />}
    </Pressable>
  </View>;
}

// v2's RowDetail (logs/row-detail.tsx:225): the row's facts as label and value, inline under the row.
function RowDetail({ row, phone, copyText }: { row: LogRecord; phone: boolean; copyText: ((text: string) => Promise<void>) | null }): JSX.Element {
  const { actor, syncRecord } = row;
  const facts: [string, string | undefined][] = [
    ['Code', row.code], ['Outcome', row.outcome], ['Duration', formatDurationMs(row.durationMs) ?? undefined],
    ['Actor', actor && [actor.name, actor.role, actor.id && `id ${actor.id}`].filter(Boolean).join(', ')],
    ['Record', syncRecord && `${syncRecord.collection} ${syncRecord.recordId} · ${syncRecord.outcome}`],
    ['Reason', syncRecord?.reason], ['Details', row.detail], ['Log id', row.id],
  ];
  // v2 logs/row-detail.tsx:100-136: copy the whole entry from the first fact line.
  return <View testID={`logs-detail-${row.id}`} className={`${phone ? 'pl-4' : 'ml-42'} gap-1 py-2`}>
    {facts.filter(([, value]) => value).map(([label, value], index) => <View key={label} className="flex-row items-baseline gap-3">
      <Text className="w-24 text-sm text-muted-foreground">{label}</Text>
      <Text testID={`logs-detail-${row.id}-${label.toLowerCase().replace(' ', '-')}`} selectable
        className="flex-1 text-sm">{value}</Text>
      {index === 0 && copyText && <Button testID={`logs-copy-event-${row.id}`} variant="ghost" size="sm" onPress={async () => {
        try { await copyText(buildLogEntryReport(row)); toast({ type: 'success', title: 'Log entry copied' }); }
        catch { toast({ type: 'error', title: "Couldn't copy the log entry" }); }
      }}><Text>Copy</Text></Button>}
    </View>)}
  </View>;
}

export function LogsScreen({ collection, storeName, siteUrl,
  copyText = typeof navigator !== 'undefined' && navigator.clipboard?.writeText
    ? text => navigator.clipboard.writeText(text) : null, now = Date.now, sync, runner,
}: {
  collection: LogCollection; storeName: string; siteUrl: string;
  copyText?: ((text: string) => Promise<void>) | null; now?: () => number;
  /** The outboxes' stuck records and changes waiting to send (outboxSyncStats); both stats are drawn only when given. */
  sync?: OutboxSyncStats;
  /** The catalogue polling runner's next check time, when available. */
  runner?: Pick<SyncCadenceRunner, 'nextDueAtMs$'>;
}): JSX.Element {
  const phone = !useIsWide();
  const [rows, setRows] = useState<LogRecord[]>([]);
  const [preset, setPreset] = useState<LogPreset>('all');
  const [level, setLevel] = useState<LogLevel>();
  const { verbose, setVerbose } = useVerboseDiagnostics(now);
  useEffect(() => {
    const subscription = collection.find({ sort: [{ id: 'desc' }] }).$.subscribe(
      docs => setRows(docs.map(doc => doc.toJSON())));
    return () => subscription.unsubscribe();
  }, [collection]);
  const { term, query: search, type } = useSearchTerm();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded(previous => ({ ...previous, [id]: !previous[id] }));
  // v2 ANDs the search with the preset, the level and verbose (logs/index.tsx:188, one query of filters and search).
  const filtered = rows.filter(row => matchesSearch(row, search) && matchesLogFilter(row, preset, level, verbose));
  // The strip counts what All shows: debug rows only while verbose is on.
  const counted = verbose ? rows : rows.filter(row => row.level !== 'debug');
  // The footer's total is what All shows for the search, as v2's count follows its search.
  const searched = counted.filter(row => matchesSearch(row, search));
  const stats = logStats(counted, now());
  const label = useCheckStatusLabel(runner, now);
  async function copyDebugInfo() {
    if (!copyText) return;
    try {
      await copyText(buildDebugInfo({ now: now(), storeName, siteUrl, rows: counted, verbose,
        sync: sync ?? outboxSyncStats(IDLE_OUTBOX_STATE) }));
      // v2 logs/index.tsx:308-316.
      toast({ type: 'success', title: 'Debug info copied' });
    } catch {
      toast({ type: 'error', title: "Couldn't copy debug info" });
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
      <SearchInput testID="search-logs" value={term} onChangeText={type} placeholder="Search Logs" className="mb-3" />
      <View className="mb-4 flex-row flex-wrap items-center gap-2">
        {(['all', 'actions', 'errors', 'sync'] as const).map(value => <Chip key={value} testID={`logs-chip-${value}`}
          label={{ all: 'All', actions: 'Actions', errors: 'Errors', sync: 'Sync' }[value]} on={preset === value}
          pressed={preset === value} onPress={() => setPreset(value)} />)}
        {level !== undefined && <Chip testID="logs-chip-kind" label={`${level} ×`} on onPress={() => setLevel(undefined)} />}
        <View className="flex-1" />
        <Chip testID="logs-chip-verbose" label={`Verbose diagnostics: ${verbose ? 'on' : 'off'}`} on={verbose}
          pressed={verbose} onPress={() => setVerbose(!verbose)} />
      </View>
      {/* v2's ledger head (logs/ledger.tsx:391); the duration column reads v2's "Took" (ledger.tsx:402-404). */}
      {!phone && /* v2 logs/ledger.tsx:391: hide the head on a phone. */ <View className="h-9 flex-row items-center gap-3 border-b border-border">
        <Text testID="logs-heading-time" className={`w-20 ${HEAD}`}>Time</Text>
        <Text testID="logs-heading-level" className={`w-16 ${HEAD}`}>Level</Text>
        <Text testID="logs-heading-event" className={`flex-1 ${HEAD}`}>Event</Text>
        <Text testID="logs-heading-took" className={`w-16 text-right ${HEAD}`}>Took</Text>
        <Text testID="logs-heading-status" className={`w-32 text-right ${HEAD}`}>Status</Text>
      </View>}
      {/* v2's LedgerRow (logs/ledger.tsx:244): the whole row toggles its detail through an overlay under the
          level and chevron buttons, since a button inside a button is invalid on the web. */}
      {filtered.map(row => {
        const took = formatDurationMs(row.durationMs);
        const time = formatLogTime(row.timestamp, now());
        // v2 logs/ledger.tsx:246 (hairline rule) and :288 (the press target's label).
        return <View key={row.id} testID={`logs-row-${row.id}`} className="border-b border-border/50">
        {/* v2 logs/ledger.tsx:296-320: the phone row, with status beside its first line. */}
        {phone ? <View className="relative">
          <Pressable testID={`logs-row-sm-${row.id}`} role="button" aria-expanded={!!expanded[row.id]}
            aria-label={`${time} · ${row.level} · ${row.message}`} onPress={() => toggle(row.id)} className="gap-0.5 py-2">
            <View testID={`logs-line-sm-${row.id}`} className="flex-row items-center gap-2 pr-32">
              <Text testID={`logs-time-sm-${row.id}`} className="font-mono text-sm tabular-nums text-muted-foreground">
                {time}</Text>
              <View testID={`logs-level-sm-${row.id}`} className="flex-row items-center gap-1.5"><LevelMark level={row.level} /></View>
            </View>
            <Text testID={`logs-event-sm-${row.id}`} className="text-sm">{row.message}</Text>
            <View testID={`logs-subline-sm-${row.id}`} className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5">
              <Text className="font-mono text-xs text-muted-foreground/80">{row.scope}</Text>
              {took && <Text className="text-xs text-muted-foreground/50">·</Text>}
              {took && <Text testID={`logs-took-sm-${row.id}`} className="font-mono text-xs text-muted-foreground/80">{took}</Text>}
            </View>
          </Pressable>
          <StatusCell row={row} expanded={!!expanded[row.id]} onToggle={() => toggle(row.id)}
            className="absolute right-0 top-2 z-10 flex-row items-center justify-end gap-1.5" />
        </View> : <View className="relative flex-row items-baseline gap-3 py-2 web:hover:bg-accent/20">
          <Pressable testID={`logs-toggle-${row.id}`} role="button" aria-expanded={!!expanded[row.id]}
            aria-label={`${time} · ${row.level} · ${row.message}`} onPress={() => toggle(row.id)} className="absolute inset-0 z-10" />
          <Text className="w-20 font-mono text-sm tabular-nums text-muted-foreground">{time}</Text>
          <View className="z-20 w-16">
            <Pressable testID={`logs-pill-${row.id}`} role="button" aria-selected={level === row.level}
              onPress={() => setLevel(level === row.level ? undefined : row.level)}
              className={`-mx-1.5 flex-row items-center gap-1.5 self-start rounded-full px-1.5 py-0.5 web:hover:bg-accent/60${
                level === row.level ? ' bg-muted' : ''}`}>
              <LevelMark level={row.level} />
            </Pressable>
          </View>
          <View className="min-w-0 flex-1">
            <Text>{row.message}</Text>
            <Text testID={`logs-scope-${row.id}`} className="pt-0.5 font-mono text-xs text-muted-foreground/80">{row.scope}</Text>
          </View>
          <Text testID={`logs-took-${row.id}`} className="w-16 text-right font-mono text-sm tabular-nums text-muted-foreground">
            {took ?? '—'}</Text>
          <StatusCell row={row} expanded={!!expanded[row.id]} onToggle={() => toggle(row.id)}
            className="z-20 w-32 flex-row items-center justify-end gap-1.5" />
        </View>}
        {expanded[row.id] && <RowDetail row={row} phone={phone} copyText={copyText} />}
      </View>;
      })}
      {/* v2 ledger.tsx:418-424. */}
      {filtered.length === 0 && <View testID="logs-empty"><EmptyState kind="empty" size="inline" title="No logs found" /></View>}
      {/* v2 logs/index.tsx:70-110 and ledger.tsx:475; "last check X ago" waits on a last-tick value from @tallyui/database. */}
      <View className="mt-4 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border/50 py-2">
        <Text testID="logs-footer" className="text-muted-foreground">{`Showing ${filtered.length} of ${searched.length}`}</Text>
        {runner && <View testID="logs-status-line" className="flex-row items-center gap-1.5">
          <View testID="logs-status-line-dot" aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
          <Text testID="logs-status-line-label" className="shrink text-xs text-muted-foreground">{label}</Text>
        </View>}
      </View>
    </View>
  );
}
