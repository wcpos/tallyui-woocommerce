import { createLogger } from '@tallyui/pos';
// v2 use-barcode.ts:35 logs till scans under ['wcpos', 'barcode', 'pos'].
export const scanLogger = createLogger('barcode');
