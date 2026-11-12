import { SYSTEM_PRINTER_ID, type PrinterProfile } from '@tallyui/pos';
import type { ReceiptTemplate } from '@tallyui/core';

export const AUTO_PRINTER_VALUE = '__auto__';
/** v2 available-printer-profiles.ts:25-40: the Print Dialog lives in memory, never stored. */
export const SYSTEM_PRINT_DIALOG: PrinterProfile = {
  id: SYSTEM_PRINTER_ID, name: 'Print Dialog', connectionType: 'system', isBuiltIn: true,
};

/** v2 utils.ts:30-41. */
export function templateTypeLabel(template: Pick<ReceiptTemplate, 'engine' | 'paper'>): string {
  return template.engine === 'thermal' ? `Thermal ${template.paper ?? ''}`.trim() : 'HTML';
}

/** v2 resolve-printer.ts layer 3: match the paper, preferring the default among fitting printers. */
export function autoPrinter(template: Pick<ReceiptTemplate, 'engine' | 'paper'>, printers: PrinterProfile[]): PrinterProfile | null {
  const columns = template.paper === '58mm' ? [32] : [42, 48];
  const fitting = printers.filter(printer => template.engine === 'thermal'
    ? printer.connectionType !== 'system' && columns.includes(printer.columns ?? 42)
    : printer.connectionType === 'system');
  return fitting.find(printer => printer.isDefault) ?? fitting[0] ?? null;
}

/** v2 index.tsx:93-111; the unmatched label uses the demo's lower-case "dialog". */
export function autoPrinterLabel(template: Pick<ReceiptTemplate, 'engine' | 'paper'>, printers: PrinterProfile[]): string {
  return `Auto — ${autoPrinter(template, printers)?.name ?? 'Print dialog'}`;
}
