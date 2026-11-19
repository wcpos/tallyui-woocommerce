import { useEffect, useState, type JSX, type ReactNode } from 'react';
import {
  ScanHubProvider, scannerProfileStore, type DeviceScannerErrorHandler, type DeviceScannerSettings, type HidLike,
  type ScannerProfileCollection, type ScannerProfileStore, type SerialLike,
} from '@tallyui/pos';
import { useCatalogue } from '../catalogue/catalogue-context';
import { toast } from '../toast/toast';
import { readScanSettings } from './scan-settings';

// Read at scan time, so a change on Settings › Barcode scanning applies to the next device scan.
const LIVE_SETTINGS: DeviceScannerSettings = {
  get prefix() { return readScanSettings().prefix; },
  get suffix() { return readScanSettings().suffix; },
  get minChars() { return readScanSettings().minChars; },
};

// v2 use-hid-scan.web.ts:204-209: a chooser the cashier closed is a cancel, not a fault; a failed reopen stays quiet.
const onError: DeviceScannerErrorHandler = (error, { phase, cancelled }) => {
  if (phase === 'connect' && !cancelled) {
    toast({ type: 'error', title: 'Couldn’t connect the scanner', description: error instanceof Error || error instanceof DOMException ? error.message : String(error) });
  }
};

/** The profiles in the catalogue database, once it is open: the hub mounts above it and reopens saved scanners at once. */
function catalogueProfiles(): { set(collection: ScannerProfileCollection | null): void; store: ScannerProfileStore } {
  let current: ScannerProfileCollection | null = null;
  let waiting: ((collection: ScannerProfileCollection) => void)[] = [];
  const ready = () => current ? Promise.resolve(current) : new Promise<ScannerProfileCollection>(resolve => waiting.push(resolve));
  return {
    set(collection) {
      current = collection;
      if (collection) { waiting.forEach(resolve => resolve(collection)); waiting = []; }
    },
    store: {
      read: async types => scannerProfileStore(await ready()).read(types),
      save: async profile => scannerProfileStore(await ready()).save(profile),
    },
  };
}

/** v2 hooks/barcodes/scan-hub-context.tsx: one hub above navigation keeps direct (WebHID, Web Serial) scanners open
 *  between screens. `hid` and `serial` default to the browser's; tests pass fakes. */
export function AppScanHub({ children, hid, serial }: { children: ReactNode; hid?: HidLike; serial?: SerialLike }): JSX.Element {
  const collection = useCatalogue().catalogue?.scannerProfiles ?? null;
  const [profiles] = useState(catalogueProfiles);
  useEffect(() => profiles.set(collection), [profiles, collection]);
  return <ScanHubProvider profiles={profiles.store} settings={LIVE_SETTINGS} hid={hid} serial={serial} onError={onError}>{children}</ScanHubProvider>;
}
