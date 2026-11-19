// jsdom has no window.matchMedia. This stub answers each media query from `state`, lets a test flip one with
// `set` (firing its 'change' listeners, as a browser does when a mouse is plugged in), and removes itself when the
// test ends, so the next test is back on jsdom's missing matchMedia (a fine pointer, so the table).
import { act } from '@testing-library/react';
import { onTestFinished } from 'vitest';

type Listener = () => void;

export function stubMatchMedia(state: Record<string, boolean>) {
  const listeners = new Map<string, Set<Listener>>();
  const of = (media: string) => listeners.get(media) ?? listeners.set(media, new Set()).get(media)!;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string) => ({
      media,
      get matches() { return state[media] ?? false; },
      addEventListener: (_: 'change', listener: Listener) => of(media).add(listener),
      removeEventListener: (_: 'change', listener: Listener) => of(media).delete(listener),
    }),
  });
  onTestFinished(() => { delete (window as { matchMedia?: unknown }).matchMedia; });
  return {
    set(media: string, matches: boolean) {
      state[media] = matches;
      act(() => of(media).forEach(listener => listener()));
    },
  };
}

/** A touch screen: no fine pointer and no hover. */
export const COARSE = { '(pointer: fine)': false, '(hover: hover)': false };
/** A mouse: a fine pointer that hovers. */
export const FINE = { '(pointer: fine)': true, '(hover: hover)': true };
