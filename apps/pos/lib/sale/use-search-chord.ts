import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const EDITABLE = 'input, textarea, select, [contenteditable]';
const typesALetter = (event: KeyboardEvent) =>
  event.key === 'Dead' || (event.key.length === 1 && /\p{M}/u.test(event.key.normalize('NFD')));

/**
 * One of WCPOS v2's web chords (hotkeys/bindings.ts:9-16, hotkeys.web.tsx:12-29): web only, Alt by physical key, and
 * `preventDefault` stops the browser's own Alt+key. Left alone: a key already handled, one pressed under a dialog, and
 * a letter being typed in a field (a Mac dead key, an accented letter). Never stops propagation, so the wedge scanner
 * sees every key. `inFields` false leaves every key pressed in a field alone, unprevented (front desk, 19 Nov 2026:
 * only Alt+F stays live in fields, where v2's R4 keeps them all).
 */
export function useChord(code: string, onChord: () => void, { enabled, inFields }: { enabled: boolean; inFields: boolean }): void {
  const latest = useRef(onChord);
  latest.current = onChord;
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const keydown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== code || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      const inField = event.target instanceof Element && event.target.closest(EDITABLE) !== null;
      if (inField && (!inFields || typesALetter(event))) return;
      event.preventDefault();
      latest.current();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [code, enabled, inFields]);
}

/** v2's `alt+f` → `pos.search.focus`, live inside fields too. */
export function useSearchChord(onChord: () => void, enabled: boolean): void {
  useChord('KeyF', onChord, { enabled, inFields: true });
}
