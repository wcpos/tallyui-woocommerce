import type { Logger } from '@tallyui/pos';
import { Subscription, type Observable } from 'rxjs';
import { syncLogger } from './log-store';

// v2 core.json:2159 health.logs.event.apply_pull.
export const APPLY_PULL_MESSAGE = 'Saved updates from your store';
export function logPulledBatches(
  replication: { received$: Observable<unknown>; active$: Observable<boolean> },
  collection: string,
  options?: { logger?: Logger; now?: () => number },
): Subscription {
  const logger = options?.logger ?? syncLogger;
  const now = options?.now ?? Date.now;
  const subscription = new Subscription();
  let start: number | undefined;
  let count = 0;
  subscription.add(replication.received$.subscribe(() => {
    if (start !== undefined) count++;
  }));
  subscription.add(replication.active$.subscribe(active => {
    if (active && start === undefined) {
      start = now();
      count = 0;
    } else if (!active && start !== undefined) {
      if (count > 0) {
        logger.info(`${APPLY_PULL_MESSAGE} · ${count} ${count === 1 ? 'record' : 'records'}`,
          { collection, count, durationMs: now() - start });
      }
      start = undefined;
    }
  }));
  return subscription;
}
