import { useRef, useState, type KeyboardEvent } from 'react';
import { Platform } from 'react-native';

/** The order rows' own testIDs: a phone row is a `role="button"` Pressable, and is the row, not a control in it. */
export const ORDER_ROW_SELECTOR = '[data-testid^="history-row-"],[data-testid^="order-row-"]';
export function useRowKeyboard(ids: string[], open: (id: string) => void, scroll: (index: number) => void) {
  const [focusIndex, setFocusIndex] = useState(-1);
  // Whether the focused row shows its ring: only after a keyboard move. Uniwind has no
  // `focus-visible:`, and a click focuses the row too, so the hook keeps the distinction.
  const [ring, setRing] = useState(false);
  const viaKeyboard = useRef(false);
  const requestedFocus = useRef<number | null>(null);
  /** The row's own focus event (a click, a Tab, or the move this hook asked for). */
  const focusFrom = (index: number) => {
    setRing(viaKeyboard.current);
    viaKeyboard.current = false;
    setFocusIndex(index);
  };
  const focusRow = (index: number, node: { focus(): void } | null) => {
    if (Platform.OS === 'web' && node && requestedFocus.current === index) {
      requestedFocus.current = null;
      node.focus();
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const control = event.target instanceof Element ? event.target.closest('button,[role="button"],input,textarea,select,a') : null;
    if (control && !control.matches(ORDER_ROW_SELECTOR)) return;
    if (event.key === 'Enter' && ids[focusIndex]) {
      event.preventDefault();
      open(ids[focusIndex]);
      return;
    }
    if (!ids.length || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    const index = Math.max(0, Math.min(ids.length - 1, focusIndex + (event.key === 'ArrowDown' ? 1 : -1)));
    requestedFocus.current = index;
    viaKeyboard.current = true;
    setRing(true);
    setFocusIndex(index);
    scroll(index);
  };
  return { focusRow, focusIndex, focusFrom, ring, onKeyDown: Platform.OS === 'web' ? onKeyDown : undefined };
}
