import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * WCPOS v2's use-checkout-back.ts: Escape on the document (and Android's hardware back) is the checkout's own Back.
 * Escape typed into a field, already handled, or pressed while a dialog is open is left alone.
 * `enabled: false` switches both listeners off (hooks are called unconditionally).
 */
export function useCheckoutBack(back: () => void, { enabled = true }: { enabled?: boolean } = {}): void {
  useEffect(() => {
    if (!enabled) return;
    const hardware = Platform.OS === 'android'
      ? BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; })
      : undefined;
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])')) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      back();
    };
    if (typeof document !== 'undefined') document.addEventListener('keydown', keydown);
    return () => {
      hardware?.remove();
      if (typeof document !== 'undefined') document.removeEventListener('keydown', keydown);
    };
  }, [back, enabled]);
}
