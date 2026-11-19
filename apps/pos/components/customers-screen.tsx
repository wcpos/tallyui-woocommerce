import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Circle, Line, Path } from 'react-native-svg';
import { ConnectorUnauthorizedError, CustomerServiceError } from '@tallyui/core';
import type { Customer, CustomerPage } from '@tallyui/core';
import { Avatar, Button, IconButton, SearchInput, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text, Tooltip, TooltipContent, TooltipTrigger, createSvgIcon } from '@tallyui/components';
import { useAreaColumns, visibleAreaColumns } from '../lib/area-columns';
import type { AreaColumn } from '../lib/area-columns';
import type { CustomerSource } from '../lib/customers/customer-source';
import { DEFAULT_CUSTOMER_SORT, billingLines, customerInitials, sortCustomers } from '../lib/customers/customer-table';
import type { CustomerSort, CustomerSortField } from '../lib/customers/customer-table';
import { NARROW_WIDTH } from '../lib/layout/wide';
import { usePointer } from '../lib/layout/pointer';
import { dayLabel } from '../lib/orders/order-days';
import { useSearchTerm } from '../lib/search-term';
import { nextSort } from '../lib/table-sort';
import { AddCustomerDialog } from './add-customer-dialog';
import { AreaDisplayOptions } from './area-display-options';
import { AreaToolbar, useAreaGutter } from './area-header';
import { EmptyState } from './empty-state';
import { SortHead } from './sort-head';
import { CaptionRowInset, TableCount, TableSurface } from './table-surface';

// The customer picker's floor (components/customer-picker.tsx:46); the store search is online. Below it the
// screen shows the store's default list, search(''), as the picker does and as v2's Customers screen opens.
const MIN_QUERY_CHARS = 2;

export type CustomersColumnId = 'avatar_url' | 'id' | 'first_name' | 'last_name' | 'email' | 'billing' | 'date_created_gmt';
// v2's customers columns (ui-settings/initial-settings.json `customers.columns`) that a store Customer carries, in
// v2's order with its keys, `show` and labels (use-ui-label.ts); date_created_gmt reads Customer.createdAt
// (connector-woocommerce sets it from the store's date_created_gmt). Not offered: role, username, shipping and
// date_modified_gmt, which the connector's Customer does not carry, and Actions.
export const CUSTOMERS_COLUMNS: readonly AreaColumn<CustomersColumnId>[] = [
  { id: 'avatar_url', label: 'Image', visible: true },
  { id: 'id', label: 'ID', visible: false },
  { id: 'first_name', label: 'First Name', visible: true },
  { id: 'last_name', label: 'Last Name', visible: true },
  { id: 'email', label: 'Email', visible: true },
  { id: 'billing', label: 'Billing Address', visible: true },
  { id: 'date_created_gmt', label: 'Date Created', visible: true },
];
// Each column's width in the row's flex layout.
const COLUMN_CLASS: Partial<Record<CustomersColumnId, string>> = {
  avatar_url: 'w-16 flex-none', email: 'flex-[2]', billing: 'flex-[2]',
};
// v2's cell (components/src/table/index.tsx:129 `justify-center px-3 py-1.5`) and head at ResizeHead's 44 px `min-h-row`
// (core data-table/resize.tsx:40), as coupons-screen.tsx's CELL and HEAD.
const CELL = 'justify-center px-3 py-1.5';
const HEAD = 'min-h-11 justify-center px-3';
const cell = (id: CustomersColumnId, extra = '') => [CELL, COLUMN_CLASS[id], extra].filter(Boolean).join(' ');
// v2 draws skeletonCount(height, 48) rows, at most SKELETON_MAX_ROWS = 12 (components/src/skeleton/index.tsx:22-27).
// Nothing here measures the card, so the app draws the cap and clips it; a 1280×800 card is taller than 12 × 48.
const SKELETON_ROWS = Array.from({ length: 12 }, (_, i) => i);
// v2's Skeleton shape="line" (`h-5`, `bg-muted rounded-lg`, skeleton/index.tsx:8,18) at w-3/4 (data-table/skeleton.tsx:59-62).
export const BAR = 'h-5 w-3/4 rounded-lg bg-muted';
// The columns the header sorts (customer-table.ts sorts the loaded rows on these): all but v2's `disableSort` ones
// (initial-settings.json customers.columns: avatar_url, billing).
function sortable(id: CustomersColumnId): id is CustomerSortField {
  return id !== 'avatar_url' && id !== 'billing';
}

function customerCell(id: CustomersColumnId, c: Customer, now: Date): JSX.Element {
  const className = cell(id);
  switch (id) {
    // v2 cells/avatar.tsx:19-23 draws size="lg", which is v2's size-10 (components/src/avatar/index.tsx:45): TallyUI's md, h-10.
    case 'avatar_url': return <TableCell key={id} className={className}><Avatar size="md" fallback={customerInitials(c)} /></TableCell>;
    case 'id': return <TableCell key={id} className={className}><Text>{c.id}</Text></TableCell>;
    case 'first_name': return <TableCell key={id} className={className}><Text>{c.firstName ?? ''}</Text></TableCell>;
    case 'last_name': return <TableCell key={id} className={className}><Text>{c.lastName ?? ''}</Text></TableCell>;
    case 'email': return <TableCell key={id} className={className}><Text testID={c.email ? `customer-email-${c.email}` : undefined}>{c.email ?? ''}</Text></TableCell>;
    case 'billing': return <TableCell key={id} className={cell(id, 'gap-0.5')}>{billingLines(c).map(line => <Text key={line}>{line}</Text>)}</TableCell>;
    case 'date_created_gmt': return <TableCell key={id} className={className}><Text>{(c.createdAt && dayLabel(c.createdAt, now)) || '—'}</Text></TableCell>;
  }
}

const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <><Line x1={9} y1={6} x2={15} y2={12} /><Line x1={15} y1={12} x2={9} y2={18} /></>);
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
  const { term, query, type, set } = useSearchTerm();
  const [results, setResults] = useState<Customer[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState<CustomerSort>(DEFAULT_CUSTOMER_SORT);
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useAreaColumns('customers', CUSTOMERS_COLUMNS);
  const request = useRef(0);
  const { width } = useWindowDimensions();
  // v2 picks the row by pointer (list-frame/index.tsx:158); the search placeholders follow the row they stand in for.
  const pointer = usePointer();
  const touchRows = width < NARROW_WIDTH || pointer === 'coarse';
  // v2's page gutter (ground.ts:46-72): the bar, the table card and this page's notes share 12 in a window, 16 on a phone.
  const gutter = useAreaGutter();

  // '' is the default list; one typed character keeps it rather than loading it again.
  const asked = query.length < MIN_QUERY_CHARS ? '' : query;

  useEffect(() => {
    const mine = ++request.current;
    setResults([]);
    setTotal(null);
    setError(undefined);
    if (!source) {
      setSearching(false);
      return;
    }
    setSearching(true);
    (source.searchPage ? source.searchPage(asked) : source.search(asked).then((customers): CustomerPage => ({ customers }))).then(page => {
      if (mine === request.current) { setResults(page.customers); setTotal(page.total ?? null); }
    }, cause => {
      if (mine === request.current) setError(searchErrorMessage(cause));
    }).finally(() => {
      if (mine === request.current) setSearching(false);
    });
  }, [source, asked, attempt]);

  function clear() { set(''); }
  function retry() { setAttempt(n => n + 1); }
  const shown = sortCustomers(results, sort);
  // The columns the display options leave on, in the area's order.
  const columns = visibleAreaColumns(CUSTOMERS_COLUMNS, settings);
  const now = new Date();

  const header = (
    <TableHeader><TableRow>
      {columns.map(({ id, label }) => <TableHead key={id} className={`${HEAD} ${COLUMN_CLASS[id] ?? ''}`}>
        {/* v2 hides the avatar column's label (`hideLabel`); the sortable heads are v2's (sort-head.tsx). */}
        {id === 'avatar_url' ? null : sortable(id)
          ? <SortHead id={id} label={label} sort={sort} chevronTestID="customers-sort-chevron" onSort={() => setSort(s => nextSort(s, id))} />
          : <Text numberOfLines={1}>{label}</Text>}
      </TableHead>)}
      <TableHead className={`${HEAD} w-16 flex-none`} />
    </TableRow></TableHeader>
  );

  const body = error ? (
    <View className="gap-2 p-4">
      <Text testID="customers-error" accessibilityRole="alert" className="text-destructive">{error}</Text>
      <Button testID="customers-retry" variant="outline" onPress={retry}><Text>Try again</Text></Button>
    </View>
  ) : searching ? (
    // v2 customers/index.tsx:96 and data-table/skeleton.tsx:31-70,79-120: the header stays over placeholder rows, one
    // line per visible column, in a body that clips; a phone (v2's coarse pointer) has no header.
    <View testID="customers-skeleton" accessibilityLabel="Searching…" aria-busy className="flex-1 overflow-hidden">
      {touchRows ? SKELETON_ROWS.map(i => (
        <View key={i} testID={`customers-skeleton-row-${i}`} className="min-h-14 flex-row items-center gap-3 border-b border-border px-3 py-2">
          <View className="h-12 w-12 rounded-full bg-muted" />
          <View className="flex-1 gap-1"><View className={BAR} /><View className="h-5 w-1/2 rounded-lg bg-muted" /></View>
        </View>
      )) : <Table>{header}<TableBody>
        {SKELETON_ROWS.map(i => <TableRow key={i} testID={`customers-skeleton-row-${i}`}>
          {columns.map(({ id }) => <TableCell key={id} className={cell(id)}><View testID="customers-skeleton-bar" className={BAR} /></TableCell>)}
          <TableCell className={`${CELL} w-16 flex-none`}><View testID="customers-skeleton-bar" className={BAR} /></TableCell>
        </TableRow>)}
      </TableBody></Table>}
    </View>
  ) : results.length === 0 ? (
    <EmptyState kind={asked ? 'no-results' : 'empty'} title={asked ? 'No customers match your search' : 'No customers yet'} description={asked ? undefined : 'Customers you add, and anyone who buys from you, will appear here.'} action={asked ? { label: 'Clear search', onPress: clear } : undefined} />
  ) : (
      // A phone row is v2's ListRow (list-row/index.tsx:31,54-65): min-h-14 px-3 py-2, a min-w-0 body, a one-line regular-weight name over a text-sm email.
      <ScrollView testID="customers-body">
        {touchRows ? shown.map(c => (
          <View key={c.id} testID={`customers-row-${c.id}`} className="min-h-14 flex-row items-center gap-3 border-b border-border px-3 py-2">
            <Avatar size="lg" fallback={customerInitials(c)} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-foreground">{c.name}</Text>
              {c.email ? <Text testID={`customer-email-${c.email}`} numberOfLines={1} className="text-sm text-muted-foreground">{c.email}</Text> : null}
            </View>
            {/* v2 customers/row.tsx:50 ends the row in chevronRight; city and country wait on the connector. */}
            <ChevronRightIcon testID={`customers-row-chevron-${c.id}`} size={16} className="text-muted-foreground" />
          </View>
        )) : <Table>
          {header}
          <TableBody>
            {shown.map(c => <TableRow key={c.id} testID={`customers-row-${c.id}`}>
              {columns.map(({ id }) => customerCell(id, c, now))}
              <TableCell className={`${CELL} w-16 flex-none`}>
                <IconButton testID="customer-open-button" accessibilityLabel="Open customer" variant="ghost" size="sm" disabled><ChevronRightIcon size={16} /></IconButton>
              </TableCell>
            </TableRow>)}
          </TableBody>
        </Table>}
      </ScrollView>
  );
  const listing = !error && !searching && results.length > 0;
  const addButton = <IconButton testID="customers-add-button" accessibilityLabel="Add new customer" variant="ghost" accessibilityHint={createBlockedReason}
    disabled={createBlockedReason !== undefined} onPress={() => setAdding(true)}><AddCustomerIcon size={20} /></IconButton>;

  return (
    <View testID="screen-customers" className="flex-1 bg-background">
      <AreaToolbar area="customers" title="Customers" onBack={onBack}
        search={source ? <SearchInput testID="search-customers" value={term} onChangeText={type} placeholder="Search Customers" /> : null}>
        {source ? createBlockedReason === undefined ? Platform.OS === 'web' ? <Tooltip>
          <TooltipTrigger asChild>{addButton}</TooltipTrigger>
          <TooltipContent side="bottom"><Text>Add new customer</Text></TooltipContent>
        </Tooltip> : addButton : <Tooltip>
          {/* v2 customers/index.tsx:162-181: an allowed add button's tooltip reads common.add_new_customer, "Add new
              customer", on the web only (showOnNative is false). A greyed add button says why in its tooltip. The disabled button takes
              no pointer (web:pointer-events-none), so a wrapper takes the hover, as v2's capability-tooltip.tsx:17-23. Below the
              bar, where v2's Radix flips it: TallyUI clamps a top tooltip onto the button, which closes it under the pointer. */}
          <TooltipTrigger asChild><Pressable testID="customers-add-trigger" role="none" focusable={false}>{addButton}</Pressable></TooltipTrigger>
          <TooltipContent side="bottom"><Text>{createBlockedReason}</Text></TooltipContent>
        </Tooltip> : null}
        {/* v2's order: add, then the settings icon, then the bell and the avatar. */}
        <AreaDisplayOptions area="customers" columns={CUSTOMERS_COLUMNS} settings={settings} onChange={setSettings} />
      </AreaToolbar>
      {source ? <>
        <TableSurface testID="customers-table-surface">{body}</TableSurface>
        {/* The store's count of every match, when it gives one (v2 data-table/footer.tsx:58-63). */}
        {listing ? <CaptionRowInset><TableCount shown={shown.length} total={total} active={searching} onSync={retry} /></CaptionRowInset> : null}
        {adding ? <AddCustomerDialog source={source} onClose={() => { setAdding(false); retry(); }} /> : null}
      </> : <Text testID="customers-unavailable" className={`py-4 text-muted-foreground ${gutter}`}>Customers show once the store is connected.</Text>}
    </View>
  );
}
