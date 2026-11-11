import { useCallback, useState } from 'react';

// Per-till switch. A session gives an opening float, cash movements, and a close with a count and a variance.
export const REGISTER_SESSIONS_KEY = 'tallywoo.register_sessions';

/**
 * On by default (front desk ruling, 2026-11-11, superseding the 2026-10-06 opt-in ruling): Paul's target is "look
 * and function like demo.wcpos.com/pos", and the demo runs with sessions on. A till with no saved choice, or whose
 * storage cannot be read, uses this; a saved 'true' or 'false' always wins, so a till that turned sessions off stays off.
 */
export const REGISTER_SESSIONS_DEFAULT = true;

function readSetting(): boolean {
  try {
    const stored = localStorage.getItem(REGISTER_SESSIONS_KEY);
    return stored === null ? REGISTER_SESSIONS_DEFAULT : stored === 'true';
  } catch { return REGISTER_SESSIONS_DEFAULT; }
}

export function useRegisterSessionsSetting(): [boolean, (on: boolean) => void] {
  const [setting, setSetting] = useState(readSetting);
  const update = useCallback((on: boolean) => {
    // When the write throws, the switch still follows the cashier for the life of the hook, unsaved: a switch that
    // snapped back to the default (on) could never be turned off, which is the worse failure.
    try { localStorage.setItem(REGISTER_SESSIONS_KEY, String(on)); } catch { /* not saved */ }
    setSetting(on);
  }, []);
  return [setting, update];
}
