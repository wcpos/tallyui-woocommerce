import { useEffect, useState } from 'react';

/** The clock, read again once a minute, so a live day's comparison cutoff moves with it (v2 reports/context.tsx `ReportsComparison`). */
export function useMinuteClock(): Date {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return new Date(tick);
}
