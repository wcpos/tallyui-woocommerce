import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ConnectorUnauthorizedError, CustomerServiceError, customerTraits } from '@tallyui/core';
import type { Customer } from '@tallyui/core';
import type { CustomerSummary } from '@tallyui/pos';
import { CustomerSelect, Popover, PopoverContent, PopoverTrigger, Text } from '@tallyui/components';
import type { CustomerSource } from '../lib/customers/customer-source';
import { customerInitials } from '../lib/customers/customer-table';
import { UserIcon } from './icons';
import { ChevronDownIcon } from './select-chevron';

// v2 field-box/index.tsx:24-40: h-ctl (44 px), rounded-field, field border; combobox.tsx:102-155: w-full px-3.
export const CUSTOMER_SELECT_FACE = 'h-11 w-full flex-row items-center gap-2 rounded-lg border border-border bg-card px-3';

export function CustomerSelectFace({ name, testID }: { name: string; testID: string }) {
  return <>
    <Text numberOfLines={1} className="flex-1">{name}</Text>
    <ChevronDownIcon testID={`${testID}-chevron`} size={16} className="text-muted-foreground" />
  </>;
}

function Initials({ text, testID }: { text: string; testID?: string }) {
  return (
    <View testID={testID} className="size-[22px] items-center justify-center rounded-full bg-muted">
      <Text className="text-[10px] font-medium">{text}</Text>
    </View>
  );
}

// v2 customer-avatar.tsx GuestAvatar, <Avatar icon="customer" variant="muted" />: the Guest is a glyph, never initials.
// avatar/index.tsx:54,69 bg-muted, text-muted-foreground; :86 xs icon, icon/index.tsx:28 size-3.5 (14 px).
function GuestMark({ testID }: { testID?: string }) {
  return (
    <View testID={testID} aria-hidden className="size-[22px] items-center justify-center rounded-full bg-muted">
      <UserIcon testID="customer-guest-icon" size={14} className="text-muted-foreground" />
    </View>
  );
}

export function CustomerPicker({ source, customer, onChange, face = 'chip', label = 'Customer', testID = 'customer-select-trigger' }: {
  source: CustomerSource;
  customer: CustomerSummary | null;
  onChange(customer: CustomerSummary | null): void;
  face?: 'chip' | 'select';
  label?: string;
  testID?: string;
}) {
  const name = customer ? customer.name : 'Guest';
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
    document.addEventListener('keydown', onKeyDown, true); // capture: 4.0.0's open CustomerSelect list stops Escape
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  // v2 cart/customer.tsx: a muted label, then the same chip as the products column's filter pills. v2 cart-header.tsx:
  // the chip opens a dropdown over the cart (a Combobox of CustomerSearch withGuest), with no create in it.
  return (
    <View ref={row} className={face === 'select' ? 'w-full' : 'flex-row items-center gap-2'}>
      {face === 'chip' && <Text className="text-muted-foreground">Customer</Text>}
      <Popover open={open} onOpenChange={next => { if (next) openPanel(); else close(); }}>
        <PopoverTrigger asChild>
          {face === 'select' ? (
          <Pressable accessibilityRole="button" testID={testID}
            accessibilityLabel={`${label}: ${name}`} className={CUSTOMER_SELECT_FACE}>
            <CustomerSelectFace name={name} testID={testID} />
          </Pressable>
          ) : (
          <Pressable accessibilityRole="button" testID="cart-customer-name"
            // v2 a1c1d3340 / core.json:797: while the search is open the chip reads Select customer with the customer icon.
            accessibilityLabel={open ? 'Select customer' : `Customer: ${name}`}
            // h-11: v2's default Chip, `h-ctl px-3`, 44 px (monorepo packages/components/src/chip/index.tsx:158).
            className="rounded-full border border-border bg-card px-3 h-11 flex-row items-center gap-2">
            {open || !customer ? <GuestMark testID="cart-customer-initials" />
              : <Initials testID="cart-customer-initials" text={customerInitials(customer)} />}
            <Text testID="cart-customer-select-label" numberOfLines={1}>{open ? 'Select customer' : name}</Text>
          </Pressable>
          )}
        </PopoverTrigger>
        <PopoverContent ref={panel} testID="customer-select-panel" align="start" className="w-80 gap-2">
          {/* v2 lists Guest first in the customer search, even when the order already is a guest. */}
          <Pressable accessibilityRole="button" testID="customer-option-guest" className="flex-row items-center gap-2"
            onPress={() => { onChange(null); close(); }}>
            <GuestMark />
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
