import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { isLocalDataResetScheduled, runLocalDataReset } from '../lib/local-data-reset';

export function LocalDataResetGate({
  children, reset = () => runLocalDataReset(), reload = () => globalThis.location?.reload(),
}: { children: ReactNode; reset?: () => Promise<void>; reload?: () => void }): JSX.Element | null {
  const [scheduled] = useState(() => isLocalDataResetScheduled());
  useEffect(() => {
    if (scheduled) void reset().finally(reload).catch(() => {});
  }, []);
  return scheduled ? null : <>{children}</>;
}
