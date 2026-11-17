import type { ProductTraits } from '@tallyui/core';
import type { CatalogueEntry } from '@tallyui/pos';
import { scanOutcome, scanMissText } from './lookup';
import { scanFeedback } from './scan-sound';
import { toast } from '../toast/toast';
import { showAddedToCartToast } from '../toast/added-to-cart-toast';

export interface SaleScanDeps<Doc> {
  products: Doc[];
  traits: ProductTraits<Doc>;
  currency: string;
  /** Adds the entry to the sale; false when the sale refused it. */
  add(entry: CatalogueEntry<Doc>): boolean;
  /** Opens the variant choice for a parent product. */
  choose(product: Doc): void;
  /** The screen's message line. */
  say(message: string | undefined): void;
}
export interface SaleScanHandlers {
  onScan(code: string): 'clear' | 'search' | 'keep';
  onTenderScan(code: string): void;
}

/** The sale's scan protocol: look the code up, sound the result, add or choose, and report it. */
export function saleScanHandlers<Doc>(deps: SaleScanDeps<Doc>): SaleScanHandlers {
  function onScan(code: string): 'clear' | 'search' | 'keep' {
    try {
      const result = scanOutcome(deps.products, deps.traits, code, { currency: deps.currency });
      if (result.kind === 'add' || result.kind === 'out-of-stock') {
        const { label } = result;
        if (result.kind === 'out-of-stock') {
          scanFeedback('failure');
          deps.say(`${label} out of stock`);
          return 'keep';
        }
        if (deps.add(result.entry)) {
          scanFeedback('success');
          showAddedToCartToast(label);
        } else scanFeedback('failure');
        return 'clear';
      }
      if (result.kind === 'choose') {
        // v2's chooseVariation plays the failure tone: the scan did not add a line.
        scanFeedback('failure');
        deps.choose(result.product);
        return 'clear';
      }
      scanFeedback('failure');
      deps.say(scanMissText(result, code));
      return 'search';
    } catch (error) {
      scanFeedback('failure');
      deps.say(error instanceof Error ? error.message : String(error));
      return 'keep';
    }
  }

  // v2 pos-columns.tsx:147 / tender-scans.tsx (#1438): checkout owns scans while the catalogue is absent.
  function onTenderScan(code: string): void {
    try {
      const result = scanOutcome(deps.products, deps.traits, code, { currency: deps.currency });
      if (result.kind === 'add' || result.kind === 'out-of-stock') {
        const { label } = result;
        if (result.kind === 'out-of-stock') {
          scanFeedback('failure');
          toast({ type: 'warning', title: `${label} out of stock` });
        } else if (deps.add(result.entry)) {
          scanFeedback('success');
          showAddedToCartToast(label);
        } else {
          scanFeedback('failure');
          toast({ type: 'error', title: `${label} was not added` });
        }
        return;
      }
      scanFeedback('failure');
      if (result.kind === 'choose') {
        toast({ type: 'info', title: `${deps.traits.getName(result.product)}: choose a variant in the products column` });
      } else {
        toast({ type: 'info', title: scanMissText(result, code) });
      }
    } catch (error) {
      scanFeedback('failure');
      toast({ type: 'error', title: error instanceof Error ? error.message : String(error) });
    }
  }

  return { onScan, onTenderScan };
}
