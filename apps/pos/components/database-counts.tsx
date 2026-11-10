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

export function DatabaseCounts({ rows }: { rows: DatabaseCountRow[] }): JSX.Element {
  return (
    <View testID="db-table" className="gap-3 rounded-lg border border-border p-4">
      <View className="flex-row gap-4">
        <Text className="flex-1 font-semibold">Collection</Text>
        <Text className="font-semibold">On device</Text>
      </View>
      {rows.map(row => <CountRow key={row.key} row={row} />)}
    </View>
  );
}

function CountRow({ row }: { row: DatabaseCountRow }): JSX.Element {
  const [count, setCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    // countFresh, not count().$: RxDB refuses a slow count on SQLite storage
    const subscription = row.collection.eventBulks$.pipe(startWith(null),
      switchMap(() => countFresh(row.collection, {}))).subscribe(setCount);
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
