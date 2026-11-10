import { useState } from 'react';
import type { JSX } from 'react';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import { Button, CustomerForm, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Text } from '@tallyui/components';
import type { CustomerSource } from '../lib/customers/customer-source';
import { toast } from '../lib/toast/toast';

export interface AddCustomerDialogProps { source: CustomerSource; onClose(): void }

function saveErrorMessage(cause: unknown): string {
  return cause instanceof ConnectorUnauthorizedError ? 'Sign in again to save customers'
    : cause instanceof CustomerServiceError && cause.code === 'invalid' ? `The store refused: ${cause.message}`
    : `Could not reach the store's customers: ${(cause as Error).message}`;
}

// v2 packages/core/src/screens/main/customers/add.tsx, through the picker's create path (components/customer-picker.tsx).
export function AddCustomerDialog({ source, onClose }: AddCustomerDialogProps): JSX.Element {
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' });
  const [error, setError] = useState<string>();

  async function save() {
    const email = values.email.trim();
    if (!email) { setError('An email is required'); return; }
    const firstName = values.firstName.trim(), lastName = values.lastName.trim(), phone = values.phone.trim();
    setError(undefined);
    try {
      const created = await source.create({ email, ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}), ...(phone ? { phone } : {}) });
      toast({ type: 'success', title: `${created.name || email} saved` });
      onClose();
    } catch (cause) {
      toast({ type: 'error', title: 'Failed to save customer', description: saveErrorMessage(cause) });
    }
  }

  return (
    <Dialog open onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
        <CustomerForm testID="customer-form" values={values} onChangeField={(field, value) => setValues(v => ({ ...v, [field]: value }))}
          onSubmit={save} showAddress={false} submitLabel="Add Customer" />
        {error ? <Text testID="customer-form-error" accessibilityRole="alert" className="text-destructive">{error}</Text> : null}
        <DialogFooter>
          <Button testID="customer-form-close" variant="outline" onPress={onClose}><Text>Cancel</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
