import { useEffect, useState, type JSX } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Badge, Button, Text } from '@tallyui/components';
import type { LogLevel } from '@tallyui/pos';
import type { LogCollection, LogRecord } from '../lib/logs/log-store';
import { buildDebugInfo, formatDurationMs, formatLogTime, logStats, matchesLogFilter, type LogPreset } from '../lib/logs/log-view';
import { useVerboseDiagnostics } from '../lib/logs/verbose';

// v2's Stat (packages/components/src/stat): the number above a muted label, pressable as a filter.
function Stat({ testID, value, label, destructive = false, onPress }: {
  testID: string; value: number; label: string; destructive?: boolean; onPress(): void;
}): JSX.Element {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      className="-m-1 rounded-md p-1 web:hover:bg-accent/50">
      <Text testID={`${testID}-value`} className={`text-lg font-semibold tabular-nums${destructive ? ' text-destructive' : ''}`}>
        {value.toLocaleString()}</Text>
      <Text className="text-sm text-muted-foreground">{label}</Text>
    </Pressable>
  );
}

export function LogsScreen({ collection, storeName, siteUrl, onBack,
  copyText = typeof navigator !== 'undefined' && navigator.clipboard?.writeText
    ? text => navigator.clipboard.writeText(text) : null, now = Date.now,
}: {
  collection: LogCollection; storeName: string; siteUrl: string; onBack(): void;
  copyText?: ((text: string) => Promise<void>) | null; now?: () => number;
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
  const filtered = rows.filter(row => matchesLogFilter(row, preset, level, verbose));
  // The strip counts what All shows: debug rows only while verbose is on.
  const counted = verbose ? rows : rows.filter(row => row.level !== 'debug');
  const stats = logStats(counted, now());
  async function copyDebugInfo() {
    if (!copyText) return;
    try {
      await copyText(buildDebugInfo({ now: now(), storeName, siteUrl, rows: counted, verbose }));
      setCopyStatus('Debug info copied');
    } catch {
      setCopyStatus("Couldn't copy debug info");
    }
  }
  return (
    <ScrollView testID="screen-logs" className="flex-1 bg-background p-4">
      <View className="mb-4 flex-row items-center gap-4">
        <Button testID="logs-back" variant="ghost" onPress={onBack}><Text>Back</Text></Button>
        <Text className="flex-1 text-xl font-semibold">Logs</Text>
      </View>
      <View testID="logs-stats" className="mb-4 flex-row flex-wrap items-start gap-x-6 gap-y-3 border-b border-border pb-3">
        <Stat testID="logs-stat-events" value={stats.eventsToday} label="events today" onPress={() => setPreset('all')} />
        <Stat testID="logs-stat-errors" value={stats.errorsToday} label="errors today" destructive={stats.errorsToday > 0}
          onPress={() => setPreset('errors')} />
        <View className="flex-1" />
        {copyText !== null && <Button testID="logs-copy-debug" variant="outline" size="sm"
          onPress={() => { void copyDebugInfo(); }}><Text>Copy debug info</Text></Button>}
      </View>
      <View className="mb-4 flex-row flex-wrap items-center gap-2">
        {(['all', 'errors', 'sync'] as const).map(value => <Button key={value} testID={`logs-chip-${value}`}
          size="sm" variant={preset === value ? 'default' : 'outline'} aria-pressed={preset === value}
          onPress={() => setPreset(value)}><Text>{{ all: 'All', errors: 'Errors', sync: 'Sync' }[value]}</Text></Button>)}
        {level !== undefined && <Button testID="logs-chip-kind" variant="outline" size="sm"
          onPress={() => setLevel(undefined)}><Text>{`${level} ×`}</Text></Button>}
        <View className="flex-1" />
        <Button testID="logs-chip-verbose" size="sm" variant={verbose ? 'default' : 'outline'} aria-pressed={verbose}
          onPress={() => setVerbose(!verbose)}><Text>{`Verbose diagnostics: ${verbose ? 'on' : 'off'}`}</Text></Button>
      </View>
      {copyStatus && <Text testID="logs-copy-status">{copyStatus}</Text>}
      <View className="flex-row items-center gap-2 border-b border-border py-2">
        <Text testID="logs-heading-time" className="w-28 text-muted-foreground">Time</Text>
        <Text testID="logs-heading-level" className="w-24 text-muted-foreground">Level</Text>
        <Text testID="logs-heading-event" className="flex-1 text-muted-foreground">Event</Text>
        <Text testID="logs-heading-took" className="w-20 text-muted-foreground">Took</Text>
        <Text testID="logs-heading-status" className="w-40 text-muted-foreground">Status</Text>
      </View>
      {filtered.map(row => <View key={row.id} testID={`logs-row-${row.id}`}
        className="flex-row items-center gap-2 border-b border-border py-2">
        <Text className="w-28">{formatLogTime(row.timestamp, now())}</Text>
        <View className="w-24">
          <Button testID={`logs-pill-${row.id}`} variant="ghost" size="sm" onPress={() => setLevel(row.level)}>
            <Badge variant={row.level === 'error' ? 'destructive' : row.level === 'warn' ? 'warning' : 'secondary'} label={row.level} />
          </Button>
        </View>
        <View className="flex-1">
          <Text>{row.message}</Text>
          <Text testID={`logs-scope-${row.id}`} className="text-muted-foreground">{row.scope}</Text>
        </View>
        <Text testID={`logs-took-${row.id}`} className="w-20">{formatDurationMs(row.durationMs) ?? '—'}</Text>
        <View className="w-40">
          {(row.level === 'warn' || row.level === 'error') && row.code
            ? <Text testID={`logs-code-${row.id}`}>{row.code}</Text>
            : row.level === 'info' && row.outcome === 'ok'
              ? <Text testID={`logs-ok-${row.id}`}>✓ ok</Text> : <Text>—</Text>}
        </View>
      </View>)}
      {filtered.length === 0 && <Text testID="logs-empty">No logs found</Text>}
      <Text testID="logs-footer" className="mt-4 text-muted-foreground">{`Showing ${filtered.length} of ${counted.length}`}</Text>
    </ScrollView>
  );
}
