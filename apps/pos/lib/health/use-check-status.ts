import { useEffect, useState } from 'react';
import type { SyncCadenceRunner } from '@tallyui/database';
import { formatCadence } from './performance';

// v2 logs/index.tsx:44: the status line's clock.
const NOW_TICK_MS = 5_000;

/** The catalogue polling runner's check line, shared by Logs and Store health › Database. */
export function useCheckStatusLabel(runner: Pick<SyncCadenceRunner, 'nextDueAtMs$'> | undefined, now: () => number = Date.now): string {
  const [nextDueAtMs, setNextDueAtMs] = useState<number | undefined>(undefined);
  const [nowMs, setNowMs] = useState(now);
  useEffect(() => {
    if (!runner) return;
    const subscription = runner.nextDueAtMs$.subscribe(next => { setNextDueAtMs(next); setNowMs(now()); });
    const interval = setInterval(() => setNowMs(now()), NOW_TICK_MS);
    return () => { subscription.unsubscribe(); clearInterval(interval); };
  }, [runner, now]);
  const next = nextDueAtMs === undefined ? null : formatCadence(nextDueAtMs - nowMs);
  // v2 logs/index.tsx:85-89 reads First check pending… before a last tick; Tally has none, so a runner with nothing due stands in.
  return nextDueAtMs === undefined ? 'First check pending…' : next ? `Watching for changes · next check ~${next.value} ${next.unit}` : 'Watching for changes';
}
