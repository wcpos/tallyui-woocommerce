import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ConnectorUnauthorizedError, CustomerServiceError, customerTraits } from '@tallyui/core';
import type { Customer } from '@tallyui/core';
import type { CustomerSummary } from '@tallyui/pos';
import { Button, CustomerForm, CustomerSelect, Text } from '@tallyui/components';
import type { CustomerSource } from '../lib/customers/customer-source';
import { customerInitials } from '../lib/customers/customer-table';
import { toast } from '../lib/toast/toast';

function Initials({ text, testID }: { text: string; testID?: string }) {
  return (
    <View testID={testID} className="size-[22px] items-center justify-center rounded-full bg-muted">
      <Text className="text-[10px] font-medium">{text}</Text>
    </View>
  );
}

export function CustomerPicker({ source, customer, onChange, createBlockedReason }: {
  source: CustomerSource;
  customer: CustomerSummary | null;
  onChange(customer: CustomerSummary | null): void;
  createBlockedReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const [error, setError] = useState<string>();
  const [values, setValues] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' });
  const request = useRef(0);

  function close() {
    request.current++;
    setOpen(false);
    setCreating(false);
    setResults([]);
    setError(undefined);
  }

  function pick(selected: Customer) {
    onChange({ id: selected.id, name: selected.name, ...(selected.email ? { email: selected.email } : {}) });
    close();
  }

  function showError(cause: unknown) {
    setError(cause instanceof ConnectorUnauthorizedError ? 'Sign in again to search customers'
      : cause instanceof CustomerServiceError && cause.code === 'invalid' ? `The store refused: ${cause.message}`
      : `Could not reach the store's customers: ${(cause as Error).message}`);
  }

  async function search(text: string) {
    const current = ++request.current;
    setResults([]);
    setError(undefined);
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    try {
      const found = await source.search(trimmed);
      if (current === request.current) setResults(found);
    } catch (cause) {
      if (current === request.current) showError(cause);
    }
  }

  async function create() {
    const email = values.email.trim();
    if (!email) { setError('An email is required'); return; }
    const current = ++request.current;
    const firstName = values.firstName.trim(), lastName = values.lastName.trim(), phone = values.phone.trim();
    setError(undefined);
    try {
      const created = await source.create({ email, ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}), ...(phone ? { phone } : {}) });
      toast({ type: 'success', title: `${created.name || email} saved` });
      if (current === request.current) pick(created);
    } catch (cause) {
      if (current === request.current) showError(cause);
    }
  }

  // v2 cart/customer.tsx: a muted label, then the same chip as the products column's filter pills.
  if (!open) return (
    <View className="flex-row items-center gap-2">
      <Text className="text-muted-foreground">Customer</Text>
      <Pressable accessibilityRole="button" testID="cart-customer-name"
        accessibilityLabel={`Customer: ${customer ? customer.name : 'Guest'}`} onPress={() => setOpen(true)}
        className="rounded-full border border-border bg-card px-3 min-h-9 flex-row items-center gap-2">
        <Initials testID="cart-customer-initials" text={customer ? customerInitials(customer) : 'GU'} />
        <Text numberOfLines={1}>{customer ? customer.name : 'Guest'}</Text>
      </Pressable>
    </View>
  );
  return (
    <View className="gap-2">
      {creating ? <CustomerForm values={values} onChangeField={(field, value) => setValues(v => ({ ...v, [field]: value }))}
        onSubmit={create} showAddress={false} submitLabel="Create customer" /> : (
        <>
          {/* v2 lists Guest first in the customer search, even when the order already is a guest. */}
          <Pressable accessibilityRole="button" testID="customer-option-guest" className="flex-row items-center gap-2"
            onPress={() => { onChange(null); close(); }}>
            <Initials text="GU" />
            <Text>Guest</Text>
          </Pressable>
          <CustomerSelect customers={results} selected={null} onSelect={pick} onSearch={search}
            placeholder="Search Customers" traits={customerTraits} />
          <Button disabled={createBlockedReason !== undefined} onPress={() => {
            request.current++;
            setError(undefined);
            setValues({ firstName: '', lastName: '', email: '', phone: '', address: '' });
            setCreating(true);
          }}><Text>New customer</Text></Button>
          {createBlockedReason !== undefined ? <Text>{createBlockedReason}</Text> : null}
        </>
      )}
      {error ? <Text>{error}</Text> : null}
      <Button onPress={close}><Text>Cancel</Text></Button>
    </View>
  );
}
