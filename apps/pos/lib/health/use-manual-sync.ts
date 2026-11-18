import { useRef, useState } from 'react';
import { useOnlineStatus } from '../online/online-status';
import { toast } from '../toast/toast';

/** v2 use-manual-sync.ts: one manual check at a time. A row's Check for changes now and Check everything now share it. */
export function useManualSync(run: () => Promise<unknown>): { syncing: boolean; sync(): Promise<void> } {
  const [syncing, setSyncing] = useState(false);
  const guard = useRef(false);
  const offline = useOnlineStatus().status === 'offline';
  async function sync() {
    // v2 use-manual-sync.ts:40-53: an offline device skips the tick and says so.
    if (offline) return void toast({ type: 'warning', title: 'Sync didn’t run.', description: 'This device is offline.' });
    if (guard.current) return;
    guard.current = true;
    setSyncing(true);
    // v2 use-manual-sync.ts:33-39, :117-125: a failed check toasts, a good one is quiet.
    try { await run(); }
    catch { toast({ type: 'error', title: 'Couldn’t sync with the server.', description: 'Check your connection and try again. Logs has the details.' }); }
    finally { guard.current = false; setSyncing(false); }
  }
  return { syncing, sync };
}
