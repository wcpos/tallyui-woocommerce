import { createLogger } from '@tallyui/pos';
// v2 logs connectivity under ['wcpos', 'app', 'connectivity'] (online-status-logger.tsx:10).
export const connectivityLogger = createLogger('connectivity');
