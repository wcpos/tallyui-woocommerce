import type { CatalogueReconcileEvent } from '@tallyui/database';
import type { Logger } from '@tallyui/pos';
import { syncLogger } from './log-store';

// v2 core.json:2161 health.logs.event.apply_refetch and core.json:2156 apply_delete.
export const APPLY_REFETCH_MESSAGE = 'Fetched records again for missing details';
export const APPLY_DELETE_MESSAGE = 'Removed items deleted in your store';
export function logCatalogueChecks(
  collection: string, logger: Logger = syncLogger,
): (event: CatalogueReconcileEvent) => void {
  return event => {
    if (event.type === 'refetched' && event.count > 0) {
      logger.info(`${APPLY_REFETCH_MESSAGE} · ${event.count}`, { collection, count: event.count });
    } else if (event.type === 'tombstoned' && event.count > 0) {
      logger.info(`${APPLY_DELETE_MESSAGE} · ${event.count}`, { collection, count: event.count });
    }
  };
}
