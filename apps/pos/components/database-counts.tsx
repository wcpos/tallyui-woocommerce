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

export function DatabaseCounts({ rows, onCount }: {
  rows: DatabaseCountRow[]; onCount?(key: string, count: number): void;
}): JSX.Element {
  return (
    <View testID="db-table" className="gap-3 rounded-lg border border-border p-4">
      <View className="flex-row gap-4">
        <Text className="flex-1 font-semibold">Collection</Text>
        <Text className="font-semibold">On device</Text>
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
    <View testID={`db-row-${row.key}`} className="gap-1">
      <View className="flex-row items-center gap-4">
        <Text className="flex-1">{row.label}</Text>
        <Text testID={`db-row-count-${row.key}`}>{count === null ? '…' : String(count)}</Text>
      </View>
      {row.onSyncNow && <Button variant="ghost" testID={`db-row-sync-now-${row.key}`} disabled={syncing} onPress={sync}><Text>Check for changes now</Text></Button>}
      {failed && <Text testID={`db-sync-failed-${row.key}`}>Couldn’t sync with the server.</Text>}
    </View>
  );
}
