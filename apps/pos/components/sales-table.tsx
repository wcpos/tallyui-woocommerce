import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, Text } from '@tallyui/components';
import type { SalesTable as SalesTableData } from '../lib/reports/sales-tables';

export function SalesTable({ table, scope, onClose, onExport }: { table: SalesTableData; scope: string; onClose: () => void; onExport?: () => void }) {
  const { width } = useWindowDimensions();
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent testID="sales-table" className="max-h-[80%] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{table.title}</DialogTitle>
          <Text testID="sales-table-scope">{scope}</Text>
        </DialogHeader>
        <ScrollView>
          {width < 600 ? <>
            {table.rows.length === 0 ? <Text>No sales yet today.</Text> : table.rows.map(row =>
              <View key={row.key} testID={`sales-table-row-${row.key}`} className="gap-2 border-b border-border py-3">
                <Text className="font-semibold">{row.cells[0]}</Text>
                {row.cells.slice(1).map((cell, index) =>
                  <View key={index} className="flex-row justify-between gap-3">
                    <Text className="text-muted-foreground">{table.head[index + 1]}</Text>
                    <Text className="min-w-0 shrink text-right tabular-nums">{cell}</Text>
                  </View>)}
              </View>)}
            <View testID="sales-table-total" className="gap-2 pt-3">
              <Text className="font-semibold">{table.total[0]}</Text>
              {table.total.slice(1).map((cell, index) => cell ?
                <View key={index} className="flex-row justify-between gap-3">
                  <Text className="text-muted-foreground">{table.head[index + 1]}</Text>
                  <Text className="min-w-0 shrink text-right font-semibold tabular-nums">{cell}</Text>
                </View> : null)}
            </View>
          </> : <Table>
            <TableHeader>
              <TableRow>
                {table.head.map((heading, index) => <TableHead key={index}>
                  <Text className={table.align[index] === 'right' ? 'text-right' : undefined}>{heading}</Text>
                </TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.length === 0 ? <Text>No sales yet today.</Text> : table.rows.map(row =>
                <TableRow key={row.key} testID={`sales-table-row-${row.key}`}>
                  {row.cells.map((cell, index) => <TableCell key={index}>
                    <Text className={table.align[index] === 'right' ? 'text-right tabular-nums' : undefined}>{cell}</Text>
                  </TableCell>)}
                </TableRow>)}
            </TableBody>
            <TableFooter>
              <TableRow testID="sales-table-total">
                {table.total.map((cell, index) => <TableCell key={index}>
                  <Text className={table.align[index] === 'right' ? 'text-right tabular-nums' : undefined}>{cell}</Text>
                </TableCell>)}
              </TableRow>
            </TableFooter>
          </Table>}
        </ScrollView>
        <Text testID="sales-table-status">{table.status}</Text>
        <DialogFooter>
          {onExport && <Button testID="sales-table-export" variant="outline" onPress={onExport}><Text>Export CSV</Text></Button>}
          <Button testID="sales-table-close" onPress={onClose}><Text>Close</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
