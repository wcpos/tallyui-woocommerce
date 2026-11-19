import { useMemo, useRef, useState } from 'react';
import { createScanSession } from '@tallyui/pos';
import { toast } from '../toast/toast';
import { SCAN_ALERT_DURATION, SCAN_ALERT_TOAST_ID } from './sale-scan';
import { readScanSettings } from './scan-settings';

export interface CameraScanWiring {
  onDetected(code: string, symbology?: string): void;
  onOpen(): void;
  scanCount: number;
}

/** v2 use-camera-scan.ts: camera decodes pass a continuous scan session (one sighting adds the item once, however
 *  long it rests in view) and reach the app's scan path like a wedge scan. TallyUI's useCameraScan emits into a
 *  ScanHub, which this app does not mount, so the app keeps its own. */
export function useCameraScan(onScan: (code: string) => void, owns: () => boolean): CameraScanWiring {
  const latest = useRef({ onScan, owns });
  latest.current = { onScan, owns };
  const [scanCount, setScanCount] = useState(0);
  const [session] = useState(() => createScanSession({
    continuous: true,
    onAccept: code => {
      // v2 too-short-feedback.ts:14-20: a short camera code is a real scan with a real problem, so it always warns.
      const { minChars } = readScanSettings();
      if (code.length < minChars) {
        toast({ id: SCAN_ALERT_TOAST_ID, type: 'warning', title: `Barcode scanned: ${code}`,
          description: `Barcode must be at least ${minChars} characters long`, duration: SCAN_ALERT_DURATION });
        return;
      }
      setScanCount(count => count + 1);
      latest.current.onScan(code);
    },
  }));
  return useMemo(() => ({
    // v2 drops a decode while another screen owns the scan before the session sees it, so its cooldown is not held.
    onDetected: (code: string, symbology?: string) => { if (latest.current.owns()) session.offer(code, symbology); },
    onOpen: () => session.reset(),
    scanCount,
  }), [session, scanCount]);
}
