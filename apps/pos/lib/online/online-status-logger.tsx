import { useEffect, useRef } from 'react';
import { toast } from '../toast/toast';
import { connectivityLogger } from './connectivity-logger';
import { useOnlineStatus } from './online-status';

// v2 online-status-logger.tsx:13.
export const CONNECTIVITY_SETTLE_MS = 5_000;
// v2 ERROR_CODES.SYNC_UNREACHABLE.
export const CONNECTIVITY_UNREACHABLE_CODE = 'SYNC121';

export function OnlineStatusLogger(): null {
  const { status } = useOnlineStatus();
  const prevStatusRef = useRef(status);
  const lastLoggedStatusRef = useRef(status);

  useEffect(() => {
    if (prevStatusRef.current === status) return;
    prevStatusRef.current = status;

    const timer = setTimeout(() => {
      if (lastLoggedStatusRef.current === status) return;
      switch (status) {
        case 'offline':
          connectivityLogger.warn('Device went offline', { code: CONNECTIVITY_UNREACHABLE_CODE });
          toast({ title: 'Device went offline', type: 'warning' });
          break;
        case 'online-website-unavailable':
          connectivityLogger.warn('Website is unreachable', { code: CONNECTIVITY_UNREACHABLE_CODE });
          toast({ title: 'Website is unreachable', type: 'warning' });
          break;
        case 'online-website-available':
          connectivityLogger.info('Connection restored', { outcome: 'ok' });
          toast({ title: 'Connection restored', type: 'success' });
          break;
      }
      lastLoggedStatusRef.current = status;
    }, CONNECTIVITY_SETTLE_MS);
    return () => { clearTimeout(timer); };
  }, [status]);

  return null;
}
