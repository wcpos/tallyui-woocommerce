import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const EDITABLE = 'input, textarea, select, [contenteditable]';
const typesALetter = (event: KeyboardEvent) =>
  event.key === 'Dead' || (event.key.length === 1 && /\p{M}/u.test(event.key.normalize('NFD')));

/**
 * One of WCPOS v2's web chords (hotkeys/bindings.ts:9-16, hotkeys.web.tsx:12-29): web only, Alt by physical key, and
 * `preventDefault` stops the browser's own Alt+key. Live inside fields, as v2's R4 (front desk, 19 Nov 2026), except
 * a letter being typed there (a Mac dead key, an accented letter). Left alone: a key already handled and one pressed
 * under a dialog. Never stops propagation, so the wedge scanner sees every key. Like v2's react-hotkeys-hook it listens
 * on the document in the bubble phase, so a field that stops its keys (react-native-web's TextInput) keeps them, as in
 * v2. Every chord carries Alt: a bare-key chord, if one is ever added, must never fire in a field.
 */
export function useChord(code: string, onChord: () => void, enabled: boolean): void {
  const latest = useRef(onChord);
  latest.current = onChord;
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const keydown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== code || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (typesALetter(event) && event.target instanceof Element && event.target.closest(EDITABLE) !== null) return;
      event.preventDefault();
      latest.current();
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [code, enabled]);
}

/** v2's `alt+f` → `pos.search.focus`. */
export function useSearchChord(onChord: () => void, enabled: boolean): void {
  useChord('KeyF', onChord, enabled);
}
