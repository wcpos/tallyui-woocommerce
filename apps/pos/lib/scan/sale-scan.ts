import type { ProductTraits } from '@tallyui/core';
import type { CatalogueEntry } from '@tallyui/pos';
import { scanOutcome } from './lookup';
import { scanFeedback } from './scan-sound';
import { scanLogger } from './scan-log';
import { toast } from '../toast/toast';
import { showAddedToCartToast } from '../toast/added-to-cart-toast';

// v2 use-scan-feedback.ts:14 sets the scan alert duration.
export const SCAN_ALERT_TOAST_ID = 'pos-scan-alert';
export const SCAN_ALERT_DURATION = 6000;

function scanAlert(type: 'warning' | 'error', title: string, description: string): void {
  toast({ id: SCAN_ALERT_TOAST_ID, type, title, description, duration: SCAN_ALERT_DURATION });
}

export interface SaleScanDeps<Doc> {
  products: Doc[];
  traits: ProductTraits<Doc>;
  currency: string;
  /** Adds the entry to the sale; false when the sale refused it. */
  add(entry: CatalogueEntry<Doc>): boolean;
}
export interface SaleScanHandlers {
  onScan(code: string): 'clear' | 'search' | 'keep';
  onTenderScan(code: string): void;
}

/** The sale's scan protocol: look the code up, sound the result, add or search, and report it. */
export function saleScanHandlers<Doc>(deps: SaleScanDeps<Doc>): SaleScanHandlers {
  function scan(code: string): 'clear' | 'search' | 'keep' {
    try {
      const result = scanOutcome(deps.products, deps.traits, code, { currency: deps.currency });
      if (result.kind === 'add' || result.kind === 'out-of-stock') {
        const { label } = result;
        if (result.kind === 'out-of-stock') {
          scanFeedback('failure');
          scanAlert('warning', `${label} out of stock`, code);
          scanLogger.info('Barcode scan matched an out-of-stock product', { barcode: code, productName: label });
          return 'keep';
        }
        if (deps.add(result.entry)) {
          scanFeedback('success');
          scanLogger.info(`Barcode scanned: ${code}`, { barcode: code, productName: label });
          showAddedToCartToast(label);
        } else {
          scanFeedback('failure');
          scanAlert('error', 'Couldn’t add to cart', label);
        }
        return 'clear';
      }
      if (result.kind === 'choose') {
        // v2's chooseVariation plays the failure tone: the scan did not add a line.
        scanFeedback('failure');
        scanAlert('warning', 'Choose a variation', `${deps.traits.getName(result.product)} — ${code}`);
        scanLogger.warn('Barcode scan matched a variable product', { barcode: code, productName: deps.traits.getName(result.product) });
        // v2 use-barcode.ts:486 (#2413): a variable parent is never a cart line; the cashier picks the variation from search.
        return 'search';
      }
      scanFeedback('failure');
      if (result.kind === 'several') {
        scanAlert('warning', 'Several matches', `${result.count} products found locally — ${code}`);
        scanLogger.warn('Barcode scan matched multiple products', { barcode: code, resultsCount: result.count });
      } else {
        scanAlert('warning', 'Barcode not found', `${code} — not in this store`);
        scanLogger.info('Barcode scan did not match a product', { barcode: code });
      }
      return 'search';
    } catch (error) {
      scanFeedback('failure');
      scanAlert('error', 'Couldn’t add to cart', error instanceof Error ? error.message : String(error));
      return 'keep';
    }
  }

  const onScan = (code: string) => scan(code);
  // v2 pos-columns.tsx:147 / tender-scans.tsx (#1438): checkout owns scans while the catalogue is absent.
  const onTenderScan = (code: string) => { scan(code); };

  return { onScan, onTenderScan };
}
