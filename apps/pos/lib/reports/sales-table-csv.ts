import type { SalesTable } from './sales-tables';

// Ported from `next` `reports/panels/export-csv.ts`.
export function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${(/^(?:[\t\r\n]|[\s\x00-\x1f\x7f-\x9f]*[=+\-@])/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
}

export function salesTableCsv(table: SalesTable): string {
  return [table.head, ...table.rows.map(row => row.cells), table.total]
    .map(row => row.map(csvCell).join(','))
    .join('\r\n');
}
