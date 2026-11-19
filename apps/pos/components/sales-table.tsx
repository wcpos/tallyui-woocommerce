import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, Text } from '@tallyui/components';
import type { SalesTable as SalesTableData } from '../lib/reports/sales-tables';

/** The Orders table's tick boxes (v2 reports/panels/orders-panel.tsx): unticked rows are left out of every figure. */
export type TableTicks = { leftOut: ReadonlySet<string>; onInclude(keys: string[], included: boolean): void };
/** TallyUI's table cells are flex-1; the tick column keeps only the box's width so the order reference does not wrap. */
const TICK_COLUMN = 'w-12 flex-none pr-0';

export function SalesTable({ table, scope, ticks, onClose, onExport, onPrint }: {
  table: SalesTableData; scope: string; ticks?: TableTicks; onClose: () => void; onExport?: () => void; onPrint?: () => void;
}) {
  const { width } = useWindowDimensions();
  // v2's checklist paints no Counted column: the tick box says it. Print and CSV keep the column.
  const paint = (cells: string[]) => ticks ? cells.slice(0, -1) : cells;
  const leftOut = ticks ? table.rows.filter(row => ticks.leftOut.has(row.key)).length : 0;
  const dim = (key: string) => ticks?.leftOut.has(key) ? 'opacity-50' : undefined;
  const tick = (row: SalesTableData['rows'][number]) => ticks &&
    <Checkbox testID={`orders-panel-tick-${row.key}`} accessibilityLabel={`Include order ${row.cells[0].replace(/^#/, '')}`}
      checked={!ticks.leftOut.has(row.key)} onCheckedChange={checked => ticks.onInclude([row.key], checked)} />;
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent testID="sales-table" className="max-h-[80%] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{table.title}</DialogTitle>
          <Text testID="sales-table-scope">{scope}</Text>
        </DialogHeader>
        <ScrollView>
          {/* v2 orders-panel.tsx:37-58: the tick-all row, "All orders", and how many are left out. */}
          {ticks && <View testID="orders-panel-tick-all-row" className="min-h-12 flex-row items-center gap-3 border-b border-border py-2">
            <Checkbox testID="orders-panel-tick-all" accessibilityLabel="Toggle selection" disabled={table.rows.length === 0}
              checked={table.rows.length > 0 && leftOut === 0} onCheckedChange={() => ticks.onInclude(table.rows.map(row => row.key), leftOut > 0)} />
            <Text className="flex-1 font-semibold">All orders</Text>
            {leftOut > 0 && <Text testID="orders-panel-left-out" className="text-muted-foreground">{`${leftOut} left out`}</Text>}
          </View>}
          {width < 600 ? <>
            {table.rows.length === 0 ? <Text>{table.empty}</Text> : table.rows.map(row =>
              <View key={row.key} testID={`sales-table-row-${row.key}`} className={`gap-2 border-b border-border py-3 ${dim(row.key) ?? ''}`}>
                <View className="flex-row items-center gap-3">
                  {tick(row)}
                  <Text className="font-semibold">{row.cells[0]}</Text>
                </View>
                {paint(row.cells).slice(1).map((cell, index) =>
                  <View key={index} className="flex-row justify-between gap-3">
                    <Text className="text-muted-foreground">{table.head[index + 1]}</Text>
                    <Text className="min-w-0 shrink text-right tabular-nums">{cell}</Text>
                  </View>)}
              </View>)}
            <View testID="sales-table-total" className="gap-2 pt-3">
              <Text className="font-semibold">{table.total[0]}</Text>
              {paint(table.total).slice(1).map((cell, index) => cell ?
                <View key={index} className="flex-row justify-between gap-3">
                  <Text className="text-muted-foreground">{table.head[index + 1]}</Text>
                  <Text className="min-w-0 shrink text-right font-semibold tabular-nums">{cell}</Text>
                </View> : null)}
            </View>
          </> : <Table>
            <TableHeader>
              <TableRow>
                {ticks && <TableHead className={TICK_COLUMN} />}
                {paint(table.head).map((heading, index) => <TableHead key={index}>
                  <Text className={table.align[index] === 'right' ? 'text-right' : undefined}>{heading}</Text>
                </TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.length === 0 ? <Text>{table.empty}</Text> : table.rows.map(row =>
                <TableRow key={row.key} testID={`sales-table-row-${row.key}`} className={dim(row.key)}>
                  {ticks && <TableCell className={TICK_COLUMN}>{tick(row)}</TableCell>}
                  {paint(row.cells).map((cell, index) => <TableCell key={index}>
                    <Text className={table.align[index] === 'right' ? 'text-right tabular-nums' : undefined}>{cell}</Text>
                  </TableCell>)}
                </TableRow>)}
            </TableBody>
            <TableFooter>
              <TableRow testID="sales-table-total">
                {ticks && <TableCell className={TICK_COLUMN} />}
                {paint(table.total).map((cell, index) => <TableCell key={index}>
                  <Text className={table.align[index] === 'right' ? 'text-right tabular-nums' : undefined}>{cell}</Text>
                </TableCell>)}
              </TableRow>
            </TableFooter>
          </Table>}
        </ScrollView>
        <Text testID="sales-table-status">{table.status}</Text>
        <DialogFooter>
          {onExport && <Button testID="sales-table-export" variant="outline" onPress={onExport}><Text>Export CSV</Text></Button>}
          {/* v2 reports/panels/panel.tsx:321: Print report beside Export CSV. v2 holds Print only while the store,
              data or templates load, never for an empty table, so it is never disabled here. */}
          {onPrint && <Button testID="detail-panel-print" variant="outline" onPress={onPrint}><Text>Print report</Text></Button>}
          <Button testID="sales-table-close" onPress={onClose}><Text>Close</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
