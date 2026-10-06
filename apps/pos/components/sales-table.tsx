import { ScrollView } from 'react-native';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow, Text } from '@tallyui/components';
import type { SalesTable as SalesTableData } from '../lib/reports/sales-tables';

export function SalesTable({ table, scope, onClose, onExport }: { table: SalesTableData; scope: string; onClose: () => void; onExport?: () => void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent testID="sales-table" className="max-h-[80%] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{table.title}</DialogTitle>
          <Text testID="sales-table-scope">{scope}</Text>
        </DialogHeader>
        <ScrollView>
          <Table>
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
                    <Text className={table.align[index] === 'right' ? 'text-right' : undefined}>{cell}</Text>
                  </TableCell>)}
                </TableRow>)}
            </TableBody>
            <TableFooter>
              <TableRow testID="sales-table-total">
                {table.total.map((cell, index) => <TableCell key={index}>
                  <Text className={table.align[index] === 'right' ? 'text-right' : undefined}>{cell}</Text>
                </TableCell>)}
              </TableRow>
            </TableFooter>
          </Table>
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
