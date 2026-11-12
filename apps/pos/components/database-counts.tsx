import { useEffect, useRef, useState, type JSX } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { startWith, switchMap } from 'rxjs';
import { Button, Text } from '@tallyui/components';
import { countFresh } from '@tallyui/pos';

export interface DatabaseCountRow {
  key: string;
  label: string;
  collection: RxCollection<any>;
  onSyncNow?(): Promise<void>;
}

// v2's column head (components/src/table/index.tsx:105-109, TABLE_HEAD_TEXT = text/ladder.ts:18 `caption`): muted,
// text-xs, tracking-wide, uppercase, at its ui weight (global.css `--type-w-ui: 500`).
const HEAD = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';
// v2's DB_ROW (health/database.tsx:264, `items-center gap-3 py-2`) on TableRow (table/index.tsx:92, `min-h-row
// border-b border-border`): py-2 round the row's 44 px ⋮ (w-ctl) under the 1 px rule is the demo's 61 px row.
const ROW = 'min-h-[61px] justify-center gap-1 border-b border-border py-2';
// v2's on-device column (health/database.tsx:267, DB_COLUMN.local `w-20 flex-none items-end`).
const LOCAL = 'w-20 text-right';

export function DatabaseCounts({ rows, onCount }: {
  rows: DatabaseCountRow[]; onCount?(key: string, count: number): void;
}): JSX.Element {
  // v2 draws a flat Table, no inner box (health/database.tsx:719); its header row is a TableRow of h-9 heads
  // (database.tsx:720-739; table/index.tsx:92 min-h-row 44 px, :112 h-9). On server, Coverage and Size wait on the connector.
  return (
    <View testID="db-table">
      <View testID="db-table-head" className="min-h-11 flex-row items-center gap-3 border-b border-border">
        <Text testID="db-head-collection" className={`flex-1 ${HEAD}`}>Collection</Text>
        <Text testID="db-head-local" className={`${LOCAL} ${HEAD}`}>On device</Text>
      </View>
      {rows.map(row => <CountRow key={row.key} row={row} onCount={onCount} />)}
    </View>
  );
}

function CountRow({ row, onCount }: { row: DatabaseCountRow; onCount?(key: string, count: number): void }): JSX.Element {
  const [count, setCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const guard = useRef(false);
  // Read through a ref so a new callback never resubscribes: one count subscription per collection
  const report = useRef({ key: row.key, onCount });
  report.current = { key: row.key, onCount };
  useEffect(() => {
    // countFresh, not count().$: RxDB refuses a slow count on SQLite storage
    const subscription = row.collection.eventBulks$.pipe(startWith(null),
      switchMap(() => countFresh(row.collection, {}))).subscribe(next => {
      setCount(next);
      report.current.onCount?.(report.current.key, next);
    });
    return () => subscription.unsubscribe();
  }, [row.collection]);

  async function sync() {
    if (guard.current) return;
    guard.current = true;
    setSyncing(true);
    setFailed(false);
    try { await row.onSyncNow!(); }
    catch { setFailed(true); }
    finally { guard.current = false; setSyncing(false); }
  }
  return (
    <View testID={`db-row-${row.key}`} className={ROW}>
      <View className="flex-row items-center gap-3">
        {/* v2's collection label in font-medium, the count right-aligned in tabular figures (database.tsx:391, :413) */}
        <Text className="flex-1 font-medium">{row.label}</Text>
        <Text testID={`db-row-count-${row.key}`} className={`${LOCAL} tabular-nums`}>{count === null ? '…' : String(count)}</Text>
      </View>
      {row.onSyncNow && <Button variant="ghost" testID={`db-row-sync-now-${row.key}`} disabled={syncing} onPress={sync}><Text>Check for changes now</Text></Button>}
      {failed && <Text testID={`db-sync-failed-${row.key}`}>Couldn’t sync with the server.</Text>}
    </View>
  );
}
