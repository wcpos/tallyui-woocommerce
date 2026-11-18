import { useEffect, useRef, useState, type JSX } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { catchError, debounceTime, from, of, startWith, switchMap } from 'rxjs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, IconButton,
  Text } from '@tallyui/components';
import { countFresh } from '@tallyui/pos';
import { estimateCollectionSize, formatBytes } from '../lib/health/database-stats';
import { useManualSync } from '../lib/health/use-manual-sync';
import { MoreIcon } from './icons';

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
// v2's size column (database.tsx:270).
const SIZE = 'w-20 text-right';
// v2 use-collection-sizes.ts:11.
const SIZE_DEBOUNCE_MS = 2_000;
// v2's actions column (health/database.tsx:271, DB_COLUMN.actions `w-ctl flex-none`): the ⋮'s own 44 px, kept on
// every row and the head so the counts line up whether or not a row has a menu.
const ACTIONS = 'w-11';

export function DatabaseCounts({ rows, onCount }: {
  rows: DatabaseCountRow[]; onCount?(key: string, count: number): void;
}): JSX.Element {
  // v2 draws a flat Table, no inner box (health/database.tsx:719); its header row is a TableRow of h-9 heads
  // (database.tsx:720-739; table/index.tsx:92 min-h-row 44 px, :112 h-9). On server and Coverage wait on the connector.
  return (
    <View testID="db-table">
      <View testID="db-table-head" className="min-h-11 flex-row items-center gap-3 border-b border-border">
        <Text testID="db-head-collection" className={`flex-1 ${HEAD}`}>Collection</Text>
        <Text testID="db-head-local" className={`${LOCAL} ${HEAD}`}>On device</Text>
        <Text testID="db-head-size" className={`${SIZE} ${HEAD}`}>Size</Text>
        <View className={ACTIONS} />
      </View>
      {rows.map(row => <CountRow key={row.key} row={row} onCount={onCount} />)}
    </View>
  );
}

function CountRow({ row, onCount }: { row: DatabaseCountRow; onCount?(key: string, count: number): void }): JSX.Element {
  const [count, setCount] = useState<number | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const { syncing, sync } = useManualSync(() => row.onSyncNow!());
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
  useEffect(() => {
    const subscription = row.collection.eventBulks$.pipe(startWith(null), debounceTime(SIZE_DEBOUNCE_MS),
      switchMap(() => from(estimateCollectionSize(row.collection)).pipe(catchError(() => of(null)))))
      .subscribe(next => setSize(next));
    return () => subscription.unsubscribe();
  }, [row.collection]);

  const sizeText = formatBytes(size);
  return (
    <View testID={`db-row-${row.key}`} className={ROW}>
      <View className="flex-row items-center gap-3">
        {/* v2's collection label in font-medium, the count right-aligned in tabular figures (database.tsx:391, :413) */}
        <Text className="flex-1 font-medium">{row.label}</Text>
        <Text testID={`db-row-count-${row.key}`} className={`${LOCAL} tabular-nums`}>{count === null ? '…' : String(count)}</Text>
        {/* v2 database.tsx:415-419, the key rank (text/ladder.ts:14). */}
        <Text testID={`db-row-size-${row.key}`} className={`${SIZE} tabular-nums text-sm text-muted-foreground`}>
          {sizeText !== null ? `≈ ${sizeText}` : '—'}
        </Text>
        <View className={ACTIONS}>
          {/* v2's row menu (health/database.tsx:347-374): a ⋮ IconButton (`more`, size-ctl 44 px, 18 px muted glyph,
              "More actions"), disabled while busy, its content aligned to the end. Tally has no Clear & re-download. */}
          {row.onSyncNow && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton testID={`db-row-menu-${row.key}`} accessibilityLabel="More actions" className="h-11 w-11"
                disabled={syncing}><MoreIcon size={18} strokeWidth={1.5} className="text-muted-foreground" /></IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem testID={`db-row-sync-now-${row.key}`} onPress={() => void sync()}>
                <Text>Check for changes now</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </View>
      </View>
    </View>
  );
}
