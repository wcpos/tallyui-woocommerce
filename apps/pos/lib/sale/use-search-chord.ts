import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const EDITABLE = 'input, textarea, select, [contenteditable]';
const typesALetter = (event: KeyboardEvent) =>
  event.key === 'Dead' || (event.key.length === 1 && /\p{M}/u.test(event.key.normalize('NFD')));

/**
 * WCPOS v2's `alt+f` → `pos.search.focus` (hotkeys/bindings.ts:9, hotkeys.web.tsx:12-29): web only, by physical key,
 * live inside fields too, and `preventDefault` stops the browser's own Alt+F. Left alone: a key already handled, one
 * pressed under a dialog, and a letter being typed in a field (a Mac dead key, an accented letter). Never stops
 * propagation, so the wedge scanner sees every key.
 */
export function useSearchChord(onChord: () => void, enabled: boolean): void {
  const latest = useRef(onChord);
  latest.current = onChord;
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const keydown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyF' || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (typesALetter(event) && event.target instanceof Element && event.target.closest(EDITABLE)) return;
      event.preventDefault();
      latest.current();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [enabled]);
}
