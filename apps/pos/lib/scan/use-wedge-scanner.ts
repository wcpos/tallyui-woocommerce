import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { merge, Subject } from 'rxjs';
import { dedupeScans, SCAN_DEDUP_WINDOW_MS, scanTimeOf, useScanHub, type ScanEvent } from '@tallyui/pos';
import { readScanSettings } from './scan-settings';
import { createWedgeDetector, type WedgeAttempt } from './wedge';

// v2 hooks/barcodes/scan-owner.ts: the scanner claimed last owns the wedge, so a screen pushed over the
// till (Settings, Orders) takes the scan instead of the till underneath ringing it up as well.
const owners: symbol[] = [];

/** Returns whether this scanner may take a scan now: it holds no claim (inactive, or not web) or it claimed last.
 *  Scans from a directly connected scanner (AppScanHub) go to the same owner; v2 use-barcode-detection.ts drops a
 *  wedge copy of one physical scan that a direct source already sent. */
export function useWedgeScanner(onScan: (code: string) => void, active: boolean, onAttempt?: (attempt: WedgeAttempt) => void): () => boolean {
  const claim = useRef<symbol | null>(null);
  const latestOnScan = useRef(onScan);
  latestOnScan.current = onScan;
  const latestOnAttempt = useRef(onAttempt);
  latestOnAttempt.current = onAttempt;
  const hub = useScanHub();
  useEffect(() => {
    if (!active) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const token = Symbol('wedge');
    owners.push(token);
    claim.current = token;
    const wedge$ = new Subject<ScanEvent>();
    const scans = merge(wedge$, hub.events$).pipe(dedupeScans(SCAN_DEDUP_WINDOW_MS, scanTimeOf)).subscribe(event => {
      if (owners[owners.length - 1] === token) latestOnScan.current(event.code);
    });
    const detector = createWedgeDetector(code => wedge$.next({ code, source: { kind: 'wedge' }, timestamp: detector.startedAtMs }), {
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
      claim.current = null;
      detector.reset();
      scans.unsubscribe();
    };
  }, [active, hub]);
  return useCallback(() => claim.current === null || owners[owners.length - 1] === claim.current, []);
}
