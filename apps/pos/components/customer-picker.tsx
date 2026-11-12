import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ConnectorUnauthorizedError, CustomerServiceError, customerTraits } from '@tallyui/core';
import type { Customer } from '@tallyui/core';
import type { CustomerSummary } from '@tallyui/pos';
import { CustomerSelect, Popover, PopoverContent, PopoverTrigger, Text } from '@tallyui/components';
import type { CustomerSource } from '../lib/customers/customer-source';
import { customerInitials } from '../lib/customers/customer-table';

function Initials({ text, testID }: { text: string; testID?: string }) {
  return (
    <View testID={testID} className="size-[22px] items-center justify-center rounded-full bg-muted">
      <Text className="text-[10px] font-medium">{text}</Text>
    </View>
  );
}

export function CustomerPicker({ source, customer, onChange }: {
  source: CustomerSource;
  customer: CustomerSummary | null;
  onChange(customer: CustomerSummary | null): void;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string>();
  const request = useRef(0);
  // The default list (search '') for this open, shared by the open and every short query until close.
  const defaults = useRef<Promise<Customer[]> | null>(null);
  const row = useRef<View>(null);
  const panel = useRef<View>(null);

  function openPanel() {
    setOpen(true);
    void load('');
  }

  function close() {
    request.current++;
    defaults.current = null;
    setOpen(false);
    setResults([]);
    setEmpty(false);
    setError(undefined);
  }

  function pick(selected: Customer) {
    onChange({ id: selected.id, name: selected.name, ...(selected.email ? { email: selected.email } : {}),
      ...(selected.billing ? { billing: selected.billing } : {}), ...(selected.shipping ? { shipping: selected.shipping } : {}) });
    close();
  }

  function showError(cause: unknown) {
    setError(cause instanceof ConnectorUnauthorizedError ? 'Sign in again to search customers'
      : cause instanceof CustomerServiceError && cause.code === 'invalid' ? `The store refused: ${cause.message}`
      : `Could not reach the store's customers: ${(cause as Error).message}`);
  }

  // v2 CustomerSearch: the store's customers before anything is typed (TallyUI 3.14.0 search '').
  function defaultList() {
    if (!defaults.current) {
      const loading = source.search('');
      defaults.current = loading;
      // A failed default load is not kept, so the next short query asks again.
      loading.catch(() => { if (defaults.current === loading) defaults.current = null; });
    }
    return defaults.current;
  }

  async function load(query: string) {
    const current = ++request.current;
    setResults([]);
    setEmpty(false);
    setError(undefined);
    try {
      const found = await (query ? source.search(query) : defaultList());
      if (current === request.current) {
        setResults(found);
        setEmpty(found.length === 0);
      }
    } catch (cause) {
      if (current === request.current) showError(cause);
    }
  }

  function search(text: string) {
    const trimmed = text.trim();
    // Under two characters, including a cleared field, shows the default list again.
    void load(trimmed.length < 2 ? '' : trimmed);
  }

  // Web: a press outside the chip and the panel, or Escape, dismisses it (TallyUI 3.18's PopoverContent has neither).
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const inside = (target: EventTarget | null) => [row.current, panel.current]
      .some(node => (node as unknown as Element | null)?.contains(target as Node));
    const onPointerDown = (event: Event) => { if (!inside(event.target)) close(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // v2 cart/customer.tsx: a muted label, then the same chip as the products column's filter pills. v2 cart-header.tsx:
  // the chip opens a dropdown over the cart (a Combobox of CustomerSearch withGuest), with no create in it.
  return (
    <View ref={row} className="flex-row items-center gap-2">
      <Text className="text-muted-foreground">Customer</Text>
      <Popover open={open} onOpenChange={next => { if (next) openPanel(); else close(); }}>
        <PopoverTrigger asChild>
          <Pressable accessibilityRole="button" testID="cart-customer-name"
            accessibilityLabel={`Customer: ${customer ? customer.name : 'Guest'}`}
            // h-11: v2's default Chip, `h-ctl px-3`, 44 px (monorepo packages/components/src/chip/index.tsx:158).
            className="rounded-full border border-border bg-card px-3 h-11 flex-row items-center gap-2">
            <Initials testID="cart-customer-initials" text={customer ? customerInitials(customer) : 'GU'} />
            <Text numberOfLines={1}>{customer ? customer.name : 'Guest'}</Text>
          </Pressable>
        </PopoverTrigger>
        <PopoverContent ref={panel} testID="customer-select-panel" align="start" className="w-80 gap-2">
          {/* v2 lists Guest first in the customer search, even when the order already is a guest. */}
          <Pressable accessibilityRole="button" testID="customer-option-guest" className="flex-row items-center gap-2"
            onPress={() => { onChange(null); close(); }}>
            <Initials text="GU" />
            <Text>Guest</Text>
          </Pressable>
          <CustomerSelect customers={results} selected={null} onSelect={pick} onSearch={search}
            placeholder="Search Customers" traits={customerTraits} />
          {/* v2 common.no_customers_found */}
          {empty ? <Text>No customers found</Text> : null}
          {error ? <Text>{error}</Text> : null}
        </PopoverContent>
      </Popover>
    </View>
  );
}
