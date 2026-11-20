import { useState } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import type { CustomerSummary } from '@tallyui/pos';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import { Button, CustomerForm, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Text } from '@tallyui/components';
import type { CustomerSource } from '../lib/customers/customer-source';
import { toast } from '../lib/toast/toast';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '../lib/receipts/receipt-emails';

export interface AddCustomerDialogProps {
  source: CustomerSource;
  onClose(): void;
  /** v2 pos/cart/add-customer.tsx: the cart's Add new customer attaches the saved customer to the order. */
  onCreated?(customer: CustomerSummary): void;
}

function saveErrorMessage(cause: unknown): string {
  return cause instanceof ConnectorUnauthorizedError ? 'Sign in again to save customers'
    : cause instanceof CustomerServiceError && cause.code === 'invalid' ? `The store refused: ${cause.message}`
    : `Could not reach the store's customers: ${(cause as Error).message}`;
}

// v2 packages/core/src/screens/main/customers/add.tsx, and the cart + menu's add-customer.tsx (with onCreated).
export function AddCustomerDialog({ source, onClose, onCreated }: AddCustomerDialogProps): JSX.Element {
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' });
  const [error, setError] = useState<string>();

  async function save() {
    const email = values.email.trim();
    // v2 customer-form.tsx:39 `email: z.string().email()`: zod 4 rejects "" and non-addresses with one copy.
    if (!isValidEmail(email)) { setError(INVALID_EMAIL_MESSAGE); return; }
    const firstName = values.firstName.trim(), lastName = values.lastName.trim(), phone = values.phone.trim();
    setError(undefined);
    try {
      const created = await source.create({ email, ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}), ...(phone ? { phone } : {}) });
      toast({ type: 'success', title: `${created.name || email} saved` });
      onCreated?.({ id: created.id, name: created.name, ...(created.email ? { email: created.email } : {}) });
      onClose();
    } catch (cause) {
      toast({ type: 'error', title: 'Failed to save customer', description: saveErrorMessage(cause) });
    }
  }

  return (
    <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
      {/* v2 customers/add.tsx:88 is a right sheet, size xl (560px, apps/main/global.css:53), titled "Add Customer";
          the cart's pos/cart/add-customer.tsx:190-197 is size lg (TallyUI's max-w-lg), titled "Add new customer". */}
      <DialogContent side="right" testID="add-customer-dialog" className={onCreated ? undefined : 'max-w-[560px]'}>
        <DialogHeader><DialogTitle>{onCreated ? 'Add new customer' : 'Add Customer'}</DialogTitle></DialogHeader>
        {/* v2 form-errors.tsx:32-35, above the fields (customer-form.tsx:153): a bad-tone Notice (none in TallyUI
            3.20.1) titled common.please_fix_the_following_errors, one row per error with the raw path. */}
        {error ? (
          <View testID="customer-form-error" accessibilityRole="alert">
            <Text className="text-destructive">Please fix the following errors:</Text>
            <Text testID="customer-form-error-email" className="text-muted-foreground">{'\u2022'} email: {error}</Text>
          </View>
        ) : null}
        <CustomerForm testID="customer-form" values={values} onChangeField={(field, value) => setValues(v => ({ ...v, [field]: value }))}
          onSubmit={save} showAddress={false} submitLabel="Add Customer" />
        <DialogFooter>
          <Button testID="customer-form-close" variant="outline" onPress={onClose}><Text>Cancel</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
