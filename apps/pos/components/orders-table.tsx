import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Polyline } from 'react-native-svg';
import { createSvgIcon, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Text } from '@tallyui/components';
import type { StoreOrder } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import { orderRowCells, orderTableItems, type OrderTableRow, type OrderTone } from '../lib/orders/order-days';
import { CaptionRowInset, TableCount, TableSurface } from './table-surface';

const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Polyline points="9 18 15 12 9 6" />);
// v2's status dots (packages/components/src/lib/tone.ts) in this theme's tokens.
const TONE_DOT: Record<OrderTone, string> = {
  ok: 'bg-success', info: 'bg-info', warning: 'bg-warning', bad: 'bg-destructive', muted: 'bg-muted-foreground', default: 'bg-primary',
};
// v2's default orders columns that the connector can fill (ui-settings/initial-settings.json), in its order.
const COLUMNS = ['Status', 'Order Number', 'Customer', 'Date Created', 'Payment Method', 'Total'];

/** v2's orders table (screens/main/orders/index.tsx): grouped by day, newest first; the chevron opens the order. */
export function OrdersTable({ local, store, onOpen, footer, active = false, onSync, now = () => new Date() }: {
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
  return (
    <>
      <TableSurface testID="orders-table-surface">
        <ScrollView className="flex-1">
          <Table testID="orders-table">
            <TableHeader>
              <TableRow>
                {COLUMNS.map(h => <TableHead key={h} className={h === 'Total' ? 'items-end' : undefined}><Text>{h}</Text></TableHead>)}
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
                  <TableRow key={item.id} testID={`${prefix}-row-${item.order.id}`}>
                    <TableCell>
                      <View className="flex-row items-center gap-1.5">
                        <View className={`size-2 rounded-full ${TONE_DOT[cells.tone]}`} />
                        <Text className="text-sm text-foreground">{cells.statusLabel}</Text>
                      </View>
                    </TableCell>
                    <TableCell><Text>{cells.number}</Text></TableCell>
                    <TableCell>
                      <View className="self-start rounded-full border border-border px-2 py-0.5">
                        <Text className="text-xs text-foreground">{cells.customer}</Text>
                      </View>
                    </TableCell>
                    <TableCell><Text>{cells.date}</Text></TableCell>
                    <TableCell><Text>{cells.payment}</Text></TableCell>
                    <TableCell className="items-end"><Text className="tabular-nums">{cells.total}</Text></TableCell>
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
