import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Circle, Line, Path } from 'react-native-svg';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import type { Customer } from '@tallyui/core';
import { Avatar, Button, IconButton, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text, createSvgIcon } from '@tallyui/components';
import { useAreaColumns } from '../lib/area-columns';
import type { AreaColumn } from '../lib/area-columns';
import type { CustomerSource } from '../lib/customers/customer-source';
import { DEFAULT_CUSTOMER_SORT, billingLines, customerInitials, nextSort, sortCustomers } from '../lib/customers/customer-table';
import type { CustomerSort, CustomerSortField } from '../lib/customers/customer-table';
import { AddCustomerDialog } from './add-customer-dialog';
import { AreaDisplayOptions } from './area-display-options';
import { AreaToolbar } from './area-header';
import { CaptionRowInset, TableCount, TableSurface } from './table-surface';

// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// The customer picker's floor (components/customer-picker.tsx:46); the store search is online. Below it the
// screen shows the store's default list, search(''), as the picker does and as v2's Customers screen opens.
const MIN_QUERY_CHARS = 2;

export type CustomersColumnId = 'avatar_url' | 'id' | 'first_name' | 'last_name' | 'email' | 'billing';
// v2's customers columns (ui-settings/initial-settings.json `customers.columns`) that a store Customer carries, in
// its order, with v2's keys, its `show` and its labels (use-ui-label.ts). Not offered: role, username, shipping,
// date_created_gmt and date_modified_gmt, which the connector's Customer does not carry, and Actions.
export const CUSTOMERS_COLUMNS: readonly AreaColumn<CustomersColumnId>[] = [
  { id: 'avatar_url', label: 'Image', visible: true },
  { id: 'id', label: 'ID', visible: false },
  { id: 'first_name', label: 'First Name', visible: true },
  { id: 'last_name', label: 'Last Name', visible: true },
  { id: 'email', label: 'Email', visible: true },
  { id: 'billing', label: 'Billing Address', visible: true },
];
// Each column's width in the row's flex layout.
const COLUMN_CLASS: Partial<Record<CustomersColumnId, string>> = {
  avatar_url: 'w-16 flex-none', email: 'flex-[2]', billing: 'flex-[2]',
};
// The columns the header sorts (customer-table.ts sorts the loaded rows on these).
function sortable(id: CustomersColumnId): id is CustomerSortField {
  return id === 'first_name' || id === 'last_name' || id === 'email';
}

function customerCell(id: CustomersColumnId, c: Customer): JSX.Element {
  const className = COLUMN_CLASS[id];
  switch (id) {
    case 'avatar_url': return <TableCell key={id} className={className}><Avatar size="md" fallback={customerInitials(c)} /></TableCell>;
    case 'id': return <TableCell key={id}><Text>{c.id}</Text></TableCell>;
    case 'first_name': return <TableCell key={id}><Text>{c.firstName ?? ''}</Text></TableCell>;
    case 'last_name': return <TableCell key={id}><Text>{c.lastName ?? ''}</Text></TableCell>;
    case 'email': return <TableCell key={id} className={className}><Text testID={c.email ? `customer-email-${c.email}` : undefined}>{c.email ?? ''}</Text></TableCell>;
    case 'billing': return <TableCell key={id} className={`${className} gap-0.5`}>{billingLines(c).map(line => <Text key={line}>{line}</Text>)}</TableCell>;
  }
}

const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <><Line x1={9} y1={6} x2={15} y2={12} /><Line x1={15} y1={12} x2={9} y2={18} /></>);
const SortAscIcon = createSvgIcon('SortAscIcon', () => <><Line x1={6} y1={15} x2={12} y2={9} /><Line x1={12} y1={9} x2={18} y2={15} /></>);
const SortDescIcon = createSvgIcon('SortDescIcon', () => <><Line x1={6} y1={9} x2={12} y2={15} /><Line x1={12} y1={15} x2={18} y2={9} /></>);
const AddCustomerIcon = createSvgIcon('AddCustomerIcon', () => <><Circle cx={9} cy={8} r={4} />
  <Path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" /><Line x1={19} y1={8} x2={19} y2={14} /><Line x1={16} y1={11} x2={22} y2={11} /></>);

export interface CustomersScreenProps {
  /** null when the store is not connected or the connector cannot search customers. */
  source: CustomerSource | null;
  onBack(): void;
  /** Why this cashier cannot add customers; undefined when they can (lib/auth/capabilities.ts). */
  createBlockedReason: string | undefined;
}

function searchErrorMessage(cause: unknown): string {
  return cause instanceof ConnectorUnauthorizedError ? 'Sign in again to search customers'
    : cause instanceof CustomerServiceError && cause.code === 'invalid' ? `The store refused: ${cause.message}`
    : `Could not reach the store's customers: ${(cause as Error).message}`;
}

export function CustomersScreen({ source, onBack, createBlockedReason }: CustomersScreenProps): JSX.Element {
  const [term, setTerm] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<CustomerSort>(DEFAULT_CUSTOMER_SORT);
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useAreaColumns('customers', CUSTOMERS_COLUMNS);
  const request = useRef(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  // '' is the default list; one typed character keeps it rather than loading it again.
  const asked = query.length < MIN_QUERY_CHARS ? '' : query;

  useEffect(() => {
    const mine = ++request.current;
    setResults([]);
    setError(undefined);
    if (!source) {
      setSearching(false);
      return;
    }
    setSearching(true);
    source.search(asked).then(found => {
      if (mine === request.current) setResults(found);
    }, cause => {
      if (mine === request.current) setError(searchErrorMessage(cause));
    }).finally(() => {
      if (mine === request.current) setSearching(false);
    });
  }, [source, asked, attempt]);

  function clear() { setTerm(''); setQuery(''); }
  function retry() { setAttempt(n => n + 1); }
  const shown = sortCustomers(results, sort);
  // The columns the display options leave on, in the area's order.
  const columns = CUSTOMERS_COLUMNS.filter(column => settings.some(setting => setting.id === column.id && setting.visible));

  const body = error ? (
    <View className="gap-2 p-4">
      <Text testID="customers-error" accessibilityRole="alert" className="text-destructive">{error}</Text>
      <Button testID="customers-retry" variant="outline" onPress={retry}><Text>Try again</Text></Button>
    </View>
  ) : searching ? (
    <Text testID="customers-searching" className="p-4 text-muted-foreground">Searching…</Text>
  ) : results.length === 0 ? (
    <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
      <Text testID="no-data-message-title" className="text-center font-medium text-foreground">
        {asked ? 'No customers match your search' : 'No customers found'}</Text>
      {asked ? <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={clear}><Text>Clear search</Text></Button> : null}
    </View>
  ) : (
      <ScrollView testID="customers-body">
        {width < 600 ? shown.map(c => (
          <View key={c.id} testID={`customers-row-${c.id}`} className="flex-row items-center gap-3 border-b border-border px-4 py-3">
            <Avatar size="lg" fallback={customerInitials(c)} />
            <View className="flex-1 gap-1">
              <Text className="font-medium text-foreground">{c.name}</Text>
              {c.email ? <Text testID={`customer-email-${c.email}`} numberOfLines={1} className="text-muted-foreground">{c.email}</Text> : null}
            </View>
          </View>
        )) : <Table>
          <TableHeader><TableRow>
            {columns.map(({ id, label }) => <TableHead key={id} className={COLUMN_CLASS[id]}>
              {/* v2 hides the avatar column's label (`hideLabel`). */}
              {id === 'avatar_url' ? null : sortable(id)
                ? <Pressable testID={`data-table-header-${id}`} accessibilityRole="button" onPress={() => setSort(s => nextSort(s, id))}>
                  <View testID={sort.field === id ? `data-table-sort-${id}-${sort.direction}` : undefined} className="flex-row items-center gap-1">
                    <Text>{label}</Text>
                    {sort.field === id ? (sort.direction === 'asc' ? <SortAscIcon size={12} /> : <SortDescIcon size={12} />) : null}
                  </View>
                </Pressable>
                : <Text>{label}</Text>}
            </TableHead>)}
            <TableHead className="w-16 flex-none" />
          </TableRow></TableHeader>
          <TableBody>
            {shown.map(c => <TableRow key={c.id} testID={`customers-row-${c.id}`}>
              {columns.map(({ id }) => customerCell(id, c))}
              <TableCell className="w-16 flex-none">
                <IconButton testID="customer-open-button" accessibilityLabel="Open customer" variant="ghost" size="sm" disabled><ChevronRightIcon size={16} /></IconButton>
              </TableCell>
            </TableRow>)}
          </TableBody>
        </Table>}
      </ScrollView>
  );
  const listing = !error && !searching && results.length > 0;

  return (
    <View testID="screen-customers" className="flex-1 bg-background">
      <AreaToolbar area="customers" title="Customers" onBack={onBack}
        search={source ? <SearchInput testID="search-customers" value={term} onChangeText={setTerm} placeholder="Search Customers" /> : null}>
        {source ? <IconButton testID="customers-add-button" accessibilityLabel="Add new customer" variant="ghost"
          disabled={createBlockedReason !== undefined} onPress={() => setAdding(true)}><AddCustomerIcon size={20} /></IconButton> : null}
        {/* v2's order: add, then the settings icon, then the bell and the avatar. */}
        <AreaDisplayOptions area="customers" columns={CUSTOMERS_COLUMNS} settings={settings} onChange={setSettings} />
      </AreaToolbar>
      {source ? <>
        {createBlockedReason !== undefined
          ? <Text testID="customers-add-blocked" className="px-4 pb-2 text-sm text-muted-foreground">{createBlockedReason}</Text> : null}
        <TableSurface testID="customers-table-surface">{body}</TableSurface>
        {/* The store searches its customers (limit 20) and reports no total, so the count is "Showing N". */}
        {listing ? <CaptionRowInset><TableCount shown={shown.length} total={null} active={searching} onSync={retry} /></CaptionRowInset> : null}
        {adding ? <AddCustomerDialog source={source} onClose={() => { setAdding(false); retry(); }} /> : null}
      </> : <Text testID="customers-unavailable" className="p-4 text-muted-foreground">Customers show once the store is connected.</Text>}
    </View>
  );
}
