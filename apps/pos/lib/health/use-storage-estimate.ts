import { useEffect, useState } from 'react';

/** The bytes this origin uses (`navigator.storage.estimate().usage`), read once on mount; null when unknown. */
export function useStorageEstimate(): number | null {
  const [usage, setUsage] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (typeof storage?.estimate !== 'function') return;
    storage.estimate().then(
      estimate => { if (live) setUsage(typeof estimate?.usage === 'number' && Number.isFinite(estimate.usage) ? estimate.usage : null); },
      () => { if (live) setUsage(null); });
    return () => { live = false; };
  }, []);
  return usage;
}
