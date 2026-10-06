import type { PosOrder } from '@tallyui/pos';
import { SOFTWARE_NAME, SOFTWARE_VERSION } from '../software';

// Keys follow WCPOS receipt schema 1.4.
export interface ReceiptIdentity {
  software: { name: string; plugin_version: string; app_version: string; app_build: string };
  register: { id: string; name: string };
  fiscal: { document_type: 'sale'; sale_time: string; sale_tz: string; is_reprint: boolean; reprint_count: number; qr_payload: string };
}

export function buildReceiptIdentity(input: {
  posOrder: Pick<PosOrder, 'createdAt'>;
  register: { id: string; name: string } | null;
  timeZone: string;
  copies?: number;
}): ReceiptIdentity {
  return {
    software: { name: SOFTWARE_NAME, plugin_version: '', app_version: SOFTWARE_VERSION, app_build: '' },
    register: input.register ?? { id: '', name: 'This till' },
    fiscal: { document_type: 'sale', sale_time: input.posOrder.createdAt, sale_tz: input.timeZone,
      is_reprint: (input.copies ?? 0) > 0, reprint_count: input.copies ?? 0, qr_payload: '' },
  };
}
