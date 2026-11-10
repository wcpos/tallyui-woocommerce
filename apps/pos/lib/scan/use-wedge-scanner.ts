import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { readScanSettings } from './scan-settings';
import { createWedgeDetector, type WedgeAttempt } from './wedge';

// v2 hooks/barcodes/scan-owner.ts: the scanner claimed last owns the wedge, so a screen pushed over the
// till (Settings, Orders) takes the scan instead of the till underneath ringing it up as well.
const owners: symbol[] = [];

export function useWedgeScanner(onScan: (code: string) => void, active: boolean, onAttempt?: (attempt: WedgeAttempt) => void): void {
  const latestOnScan = useRef(onScan);
  latestOnScan.current = onScan;
  const latestOnAttempt = useRef(onAttempt);
  latestOnAttempt.current = onAttempt;
  useEffect(() => {
    if (!active) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const token = Symbol('wedge');
    owners.push(token);
    const detector = createWedgeDetector(code => latestOnScan.current(code), {
      getSettings: readScanSettings,
      onAttempt: attempt => latestOnAttempt.current?.(attempt),
    });
    function onKeyDown(event: KeyboardEvent) {
      if (owners[owners.length - 1] !== token) { detector.reset(); return; }
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
      owners.splice(owners.indexOf(token), 1);
      detector.reset();
    };
  }, [active]);
}
