import type { JSX } from 'react';
import type { Customer, CustomerPatch } from '@tallyui/core';
import { CustomerEditor, Dialog, DialogContent, DialogHeader, DialogTitle } from '@tallyui/components';
import { useIsOnline } from '../lib/online/online-status';
import { WOO_COUNTRY_OPTIONS, wooStatesFor } from '../lib/settings/woo-region-options';
import { toast } from '../lib/toast/toast';

export interface EditCustomerDialogProps {
  customer: Customer;
  update: (id: string, patch: CustomerPatch) => Promise<Customer>;
  defaultCountry?: string;
  onClose(): void;
  onSaved(customer: Customer): void;
}

// v2 customers/edit/edit-customer.tsx:28 titles the sheet "Edit {name}"; v2 autosaves and has Delete and Sync
// in its footer, while @tallyui 4.2.0's editor has an explicit Save.
export function EditCustomerDialog({ customer, update, defaultCountry, onClose, onSaved }: EditCustomerDialogProps): JSX.Element {
  // 4.2.0's billing Remove sends billing: {}; the connector then blanks billing phone and company unless the
  // top-level fields are sent (connector toWooPatch). v2 clears only the address lines (address-rows.tsx:109-112).
  const save = (id: string, patch: CustomerPatch) => update(id, patch.billing === undefined ? patch : {
    ...patch,
    ...(patch.phone === undefined ? { phone: customer.phone ?? '' } : {}),
    ...(patch.company === undefined ? { company: customer.company ?? '' } : {}),
  });
  return (
    <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
      {/* v2 record-dialog/index.tsx:63 uses size xl (560px), as the add customer sheet does. */}
      <DialogContent side="right" testID="edit-customer-dialog" className="max-w-[560px]">
        <DialogHeader><DialogTitle>{`Edit ${customer.name || customer.email}`}</DialogTitle></DialogHeader>
        <CustomerEditor key={customer.id} customer={customer} update={save} online={useIsOnline()}
          countries={WOO_COUNTRY_OPTIONS} statesFor={wooStatesFor} defaultCountry={defaultCountry} onCancel={onClose}
          onSaved={saved => {
            if (saved !== customer) toast({ type: 'success', title: `${saved.name || saved.email} saved` });
            onSaved(saved);
            onClose();
          }} />
      </DialogContent>
    </Dialog>
  );
}
