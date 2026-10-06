import { useCallback, useState } from 'react';

// Per-till switch (front desk ruling, 2026-10-06), off by default. A session gives
// an opening float, cash movements, and a close with a count and a variance.
const SETTING_KEY = 'tallywoo.register_sessions';

export function useRegisterSessionsSetting(): [boolean, (on: boolean) => void] {
  const [setting, setSetting] = useState(() => {
    try { return localStorage.getItem(SETTING_KEY) === 'true'; } catch { return false; }
  });
  const update = useCallback((on: boolean) => {
    try {
      localStorage.setItem(SETTING_KEY, String(on));
      setSetting(on);
    } catch { setSetting(false); }
  }, []);
  return [setting, update];
}
