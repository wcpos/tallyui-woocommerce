import type { JSX, ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Path, Polyline } from 'react-native-svg';
import { createSvgIcon, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@tallyui/components';
import type { StoreOrder } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import type { AreaColumn } from '../lib/area-columns';
import { orderRowCells, orderTableItems, type OrderTableRow, type OrderTone } from '../lib/orders/order-days';
import { CaptionRowInset, TableCount, TableSurface } from './table-surface';

const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Polyline points="9 18 15 12 9 6" />);
// v2's SortIcon for a descending sort (components sort-icon/index.tsx:19, `chevronDown`): the tabler glyph,
// icon/components/tabler/chevronDown.tsx.
const SortDownIcon = createSvgIcon('SortDownIcon', () => <Path d="m6 9 6 6 6-6" />);
// v2's orders column aligns (ui-settings/initial-settings.json:388): the number is centred, header and cell
// (data-table/header.tsx:37, column-style.ts:22); the total stays right.
const ALIGN: Partial<Record<OrdersColumnId, string>> = { number: 'items-center', total: 'items-end' };
// v2's body cell (components/src/table/index.tsx:129, `flex-col justify-center px-3 py-1.5`): every cell centres its
// content on the row, as the 32 px chip already sat. The row is v2's order row: its list sizes one at 56
// (orders/index.tsx:203 `estimatedItemSize`) under the row's 1 px rule (data-table/rows.tsx:116 `border-b`), the
// demo's 57; TallyUI's cell `py-4` made 64.
const CELL = 'justify-center py-1.5';
const ROW = 'min-h-[57px]';
// v2's status dots (packages/components/src/lib/tone.ts) in this theme's tokens.
const TONE_DOT: Record<OrderTone, string> = {
  ok: 'bg-success', info: 'bg-info', warning: 'bg-warning', bad: 'bg-destructive', muted: 'bg-muted-foreground', default: 'bg-primary',
};
export type OrdersColumnId = 'status' | 'number' | 'customer_id' | 'date_created_gmt' | 'payment_method' | 'total';
// v2's default orders columns that the connector can fill (ui-settings/initial-settings.json `orders.columns`), in its
// order, with v2's keys, its `show` and its labels (use-ui-label.ts). Billing, customer note, created via, cashier and
// the rest need fields the connector does not carry, so they are not offered.
export const ORDERS_COLUMNS: readonly AreaColumn<OrdersColumnId>[] = [
  { id: 'status', label: 'Status', visible: true },
  { id: 'number', label: 'Order Number', visible: true },
  { id: 'customer_id', label: 'Customer', visible: true },
  { id: 'date_created_gmt', label: 'Date Created', visible: true },
  { id: 'payment_method', label: 'Payment Method', visible: true },
  { id: 'total', label: 'Total', visible: true },
];
const ALL_COLUMNS = ORDERS_COLUMNS.map(column => column.id);

function orderCell(id: OrdersColumnId, cells: ReturnType<typeof orderRowCells>, rowId: string): JSX.Element {
  switch (id) {
    case 'status': return <TableCell key={id} testID={`${rowId}-status`} className={CELL}>
      <View className="flex-row items-center gap-1.5">
        <View className={`size-2 rounded-full ${TONE_DOT[cells.tone]}`} />
        <Text className="text-sm text-foreground">{cells.statusLabel}</Text>
      </View>
    </TableCell>;
    case 'number': return <TableCell key={id} testID={`${rowId}-number`} className={`${CELL} ${ALIGN.number}`}><Text>{cells.number}</Text></TableCell>;
    // v2's Customer cell (components/order/customer.tsx:32) is a `size="sm"` Chip with no avatar: h-8 (32 px), px-2.5,
    // and a one-line text-sm (13 px) label (components chip/index.tsx:125, 158).
    case 'customer_id': return <TableCell key={id} className={CELL}>
      <View testID={`${rowId}-customer-chip`} className="h-8 max-w-full flex-row items-center self-start rounded-full border border-border px-2.5">
        <Text testID={`${rowId}-customer`} numberOfLines={1} className="shrink text-sm font-normal text-foreground">{cells.customer}</Text>
      </View>
    </TableCell>;
    case 'date_created_gmt': return <TableCell key={id} testID={`${rowId}-date`} className={CELL}><Text>{cells.date}</Text></TableCell>;
    case 'payment_method': return <TableCell key={id} testID={`${rowId}-payment`} className={CELL}><Text>{cells.payment}</Text></TableCell>;
    case 'total': return <TableCell key={id} testID={`${rowId}-total`} className={`${CELL} ${ALIGN.total}`}><Text className="tabular-nums">{cells.total}</Text></TableCell>;
  }
}

/** v2's DataTableHeader (data-table/header.tsx:62-79): the sorted column shows its SortIcon after the label. The list
 *  is always newest first (v2's default, initial-settings.json:376-377) and offers no other sort, so the chevron on
 *  Date Created is a static down. */
function headCell({ id, label }: AreaColumn<OrdersColumnId>): JSX.Element {
  if (id !== 'date_created_gmt') return <TableHead key={id} className={ALIGN[id]}><Text>{label}</Text></TableHead>;
  return <TableHead key={id}>
    <View testID={`data-table-sort-${id}-desc`} className="max-w-full flex-row items-center gap-1">
      <Text numberOfLines={1} className="shrink">{label}</Text>
      <SortDownIcon testID="orders-sort-chevron" size={14} strokeWidth={1.5} className="text-foreground" />
    </View>
  </TableHead>;
}

/** v2's orders table (screens/main/orders/index.tsx): grouped by day, newest first; the chevron opens the order. */
export function OrdersTable({ local, store, onOpen, footer, active = false, onSync, now = () => new Date(), visible = ALL_COLUMNS }: {
  /** The columns the Orders display options leave on; the table keeps its own order. The chevron always shows. */
  visible?: readonly OrdersColumnId[];
  /** The store's list is loading: the sync button turns. */
  active?: boolean;
  /** Reloads the store's first page (the footer's sync button). */
  onSync?(): void;
  local: readonly PosOrder[];
  store: readonly StoreOrder[];
  onOpen(row: OrderTableRow): void;
  footer?: ReactNode;
  now?: () => Date;
}) {
  const today = now();
  const items = orderTableItems(local, store, today);
  const columns = ORDERS_COLUMNS.filter(column => visible.includes(column.id));
  return (
    <>
      <TableSurface testID="orders-table-surface">
        <ScrollView className="flex-1">
          <Table testID="orders-table">
            <TableHeader>
              <TableRow>
                {columns.map(headCell)}
                <TableHead className="w-14 flex-none" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                if (item.type === 'day') {
                  return (
                    <View key={item.id} testID={`orders-day-heading-${item.day}`} className="h-7 justify-center border-b border-border bg-background px-3">
                      <Text className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</Text>
                    </View>
                  );
                }
                const cells = orderRowCells(item, today);
                const prefix = item.kind === 'store' ? 'history' : 'order';
                return (
                  <TableRow key={item.id} testID={`${prefix}-row-${item.order.id}`} className={ROW}>
                    {columns.map(({ id }) => orderCell(id, cells, `${prefix}-${item.order.id}`))}
                    <TableCell className="w-14 flex-none items-center justify-center px-0 py-0">
                      <Pressable accessibilityRole="button" accessibilityLabel="Open order" testID={`${prefix}-open-${item.order.id}`}
                        onPress={() => onOpen(item)} className="size-9 items-center justify-center rounded-md web:hover:bg-muted">
                        <ChevronRightIcon size={16} />
                      </Pressable>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {footer ? <View className="gap-3 p-3">{footer}</View> : null}
        </ScrollView>
      </TableSurface>
      <CaptionRowInset>
        {/* The store's order list is paged and the connector reports no total, so the count is "Showing N". */}
        <TableCount shown={items.filter(item => item.type === 'order').length} total={null} active={active} onSync={onSync} />
      </CaptionRowInset>
    </>
  );
}
