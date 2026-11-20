import { useEffect, useState } from 'react';
import { getStorageHealth } from '@tallyui/database';
import type { TallyDatabase } from '@tallyui/database';

/**
 * v2 `packages/core/src/screens/main/hooks/use-storage-health.ts:59` (`useStorageDegraded`).
 * `stalled` matches v2's "write past its deadline" and `dead` matches v2's "lost worker".
 * Recovery from `dead` is TallyUI's watchdog's business, not this hook's.
 * Storage without a watchdog (native) never reports degraded.
 */
export function useStorageDegraded(db: TallyDatabase | undefined): boolean {
  const [degraded, setDegraded] = useState(false);
  useEffect(() => {
    const health = db ? getStorageHealth(db) : undefined;
    if (!health) {
      setDegraded(false);
      return;
    }
    const subscription = health.subscribe(h => setDegraded(h.status === 'stalled' || h.status === 'dead'));
    return () => subscription.unsubscribe();
  }, [db]);
  return degraded;
}
