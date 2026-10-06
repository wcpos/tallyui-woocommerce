import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { createWedgeDetector } from './wedge';

export function useWedgeScanner(onScan: (code: string) => void, active: boolean): void {
  const latestOnScan = useRef(onScan);
  latestOnScan.current = onScan;
  useEffect(() => {
    if (!active) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const detector = createWedgeDetector(code => latestOnScan.current(code));
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
      )) return;
      if (detector.key(event.key)) event.preventDefault();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      detector.reset();
    };
  }, [active]);
}
