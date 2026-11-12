import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import type { ReceiptTemplate, SyncContext, TallyConnector } from '@tallyui/core';
import type { PrinterProfile } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { PrintingSettings } from '../components/settings/printing-settings';
import { SettingsArea } from '../components/settings/settings-area';
import { SETTINGS_NAV_ITEMS } from '../components/settings/settings-navigation';
import { autoPrinter, autoPrinterLabel, SYSTEM_PRINT_DIALOG } from '../lib/receipts/printer-routing';
import { useStoreTemplates, type StoreTemplatesState, type TemplateKind } from '../lib/receipts/use-store-templates';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const fixtures: ReceiptTemplate[] = [
  { id: 'plugin-core', kind: 'receipt', title: 'Standard Receipt', engine: 'html', dataModel: 'wcpos', body: '<p>Receipt</p>' },
  { id: 't80', kind: 'receipt', title: 'Detailed Thermal Receipt (80mm)', engine: 'thermal', paper: '80mm', dataModel: 'wcpos', body: '<receipt>Receipt</receipt>' },
  { id: 't58', kind: 'receipt', title: 'Kitchen Ticket', engine: 'thermal', paper: '58mm', dataModel: 'wcpos', body: '<receipt>Ticket</receipt>' },
];
const templates: Record<TemplateKind, StoreTemplatesState> = {
  receipt: { status: 'ready', templates: fixtures },
  report: { status: 'ready', templates: [] },
  closure: { status: 'ready', templates: [] },
};
const printers = [SYSTEM_PRINT_DIALOG];
const printing = { profiles: [] as PrinterProfile[], onSavePrinter: vi.fn(), onSetDefault: vi.fn(), onDeletePrinter: vi.fn() };

test("the Printers section shows v2's empty state with only the Print Dialog", () => {
  render(<PrintingSettings templates={templates} {...printing} />);
  expect(screen.getByTestId('printers-empty-state-title').textContent).toBe('No printers configured');
  expect(screen.getByTestId('printers-empty-state-description').textContent).toBe(
    'Add a printer to send receipts straight to your hardware. You can always use the Print Dialog without one.');
  expect(screen.getByTestId('settings-printing-printers-description').textContent).toBe('Devices receipts can be sent to.');
  expect(screen.getByTestId('printing-add-printer-button').textContent).toBe('Add printer');
});

test('each receipt template row shows its title, type tag and the auto printer', () => {
  render(<PrintingSettings templates={templates} {...printing} />);
  const rows = screen.getAllByTestId(/^template-row-(plugin-core|t80|t58)$/);
  expect(rows.map(row => row.getAttribute('data-testid'))).toEqual(['template-row-plugin-core', 'template-row-t80', 'template-row-t58']);
  fixtures.forEach((template, index) => {
    expect(within(rows[index]).getByText(template.title)).not.toBeNull();
    expect(screen.getByTestId(`template-row-${template.id}-tag`).textContent).toBe(['HTML', 'Thermal 80mm', 'Thermal 58mm'][index]);
    const select = within(screen.getByTestId(`template-row-${template.id}-printer-select`));
    expect(select.getByText(index === 0 ? 'Auto — Print Dialog' : 'Auto — Print dialog')).not.toBeNull();
    expect(select.getByRole('combobox').getAttribute('aria-disabled')).toBe('true');
  });
});

test("the section headings read v2's words", () => {
  render(<SettingsArea wide items={SETTINGS_NAV_ITEMS} currentHref="/settings/printing" onNavigate={vi.fn()} onBack={vi.fn()}>
    <PrintingSettings templates={templates} {...printing} />
  </SettingsArea>);
  expect(screen.getByTestId('settings-page-title').textContent).toBe('Printing');
  for (const title of ['Receipt templates', 'Report templates', 'Closure templates']) {
    expect(screen.getByRole('heading', { name: title })).not.toBeNull();
  }
  expect(screen.getAllByText('Choose which printer each template prints to.')).toHaveLength(3);
});

test('an empty kind reads No active templates found.', () => {
  render(<PrintingSettings templates={templates} {...printing} />);
  expect(screen.getByTestId('settings-printing-report-templates-empty').textContent).toBe('No active templates found.');
});

test('a failed kind shows the error and loading shows nothing', () => {
  render(<PrintingSettings {...printing} templates={{ ...templates,
    receipt: { status: 'error', message: 'HTTP 500' }, closure: { status: 'loading' },
  }} />);
  expect(screen.getByTestId('settings-printing-receipt-templates-error').textContent).toBe('Templates could not be loaded: HTTP 500');
  const closure = within(screen.getByTestId('settings-printing-closure-templates'));
  expect(closure.queryAllByTestId(/^template-row-/)).toHaveLength(0);
  expect(closure.queryByTestId('settings-printing-closure-templates-empty')).toBeNull();
  expect(closure.queryByTestId('settings-printing-closure-templates-error')).toBeNull();
});

test('autoPrinter matches a thermal template to a fitting hardware printer', () => {
  const hardware: PrinterProfile = { id: 'p1', name: 'Front counter', connectionType: 'network', columns: 48 };
  const known = [...printers, hardware];
  expect(autoPrinterLabel(fixtures[1], known)).toBe('Auto — Front counter');
  expect(autoPrinterLabel(fixtures[2], known)).toBe('Auto — Print dialog');
  expect(autoPrinterLabel(fixtures[0], known)).toBe('Auto — Print Dialog');
  const preferred: PrinterProfile = { ...hardware, id: 'p2', name: 'Default counter', isDefault: true };
  expect(autoPrinter(fixtures[1], [...known, preferred])).toBe(preferred);
  expect(autoPrinter({ engine: 'thermal' }, [{ ...hardware, columns: undefined }])?.id).toBe('p1');
  expect(autoPrinter(fixtures[2], [{ ...hardware, columns: 32 }])?.id).toBe('p1');
  expect(autoPrinter(fixtures[0], [])).toBeNull();
  const systemDefault = { ...SYSTEM_PRINT_DIALOG, id: 'system-default', isDefault: true };
  expect(autoPrinter(fixtures[0], [...known, systemDefault])).toBe(systemDefault);
});

test('useStoreTemplates reads each kind from the connector', async () => {
  const context: SyncContext = { connectorId: 'test', baseUrl: 'https://shop.example/', headers: {} };
  const receiptTemplates = vi.fn(async (_ctx: SyncContext, kind?: TemplateKind) => kind === 'receipt' ? fixtures : []);
  const connector = { receiptTemplates } as unknown as TallyConnector;
  const { result, rerender } = renderHook(({ kind }: { kind: TemplateKind }) => useStoreTemplates(connector, () => context, kind), {
    initialProps: { kind: 'receipt' },
  });
  expect(result.current).toEqual({ status: 'loading' });
  await waitFor(() => expect(result.current).toEqual({ status: 'ready', templates: fixtures }));
  expect(receiptTemplates).toHaveBeenCalledExactlyOnceWith(context, 'receipt');
  for (const kind of ['report', 'closure'] as const) {
    rerender({ kind });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', templates: [] }));
    expect(receiptTemplates).toHaveBeenLastCalledWith(context, kind);
  }
  expect(receiptTemplates).toHaveBeenCalledTimes(3);
  const bare = {} as TallyConnector;
  expect(renderHook(() => useStoreTemplates(bare, () => context, 'receipt')).result.current)
    .toEqual({ status: 'ready', templates: [] });
  expect(renderHook(() => useStoreTemplates(undefined, () => context, 'receipt')).result.current)
    .toEqual({ status: 'ready', templates: [] });
  receiptTemplates.mockRejectedValueOnce(new Error('HTTP 500'));
  const failed = renderHook(() => useStoreTemplates(connector, () => context, 'receipt'));
  await waitFor(() => expect(failed.result.current).toEqual({ status: 'error', message: 'HTTP 500' }));
});

const frontCounter: PrinterProfile = {
  id: 'p1', name: 'Front counter', connectionType: 'network', address: '192.168.1.50', port: 8008, columns: 42, vendor: 'epson', isDefault: true,
};

function renderPrinting(profiles: PrinterProfile[] = []) {
  const handlers = { onSavePrinter: vi.fn(), onSetDefault: vi.fn(), onDeletePrinter: vi.fn() };
  render(<><PrintingSettings templates={templates} profiles={profiles} {...handlers} /><PortalHost /></>);
  return handlers;
}

test('a saved printer replaces the empty state', () => {
  renderPrinting([frontCounter]);
  expect(screen.queryByTestId('printers-empty-state')).toBeNull();
  expect(screen.getByTestId('printer-row-p1-identifier').textContent).toBe('192.168.1.50:8008 · Epson');
  expect(screen.getByTestId('printer-row-p1-default').textContent).toBe('Default');
  expect(within(screen.getByTestId('template-row-t80-printer-select')).getByText('Auto — Front counter')).not.toBeNull();
  expect(within(screen.getByTestId('template-row-plugin-core-printer-select')).getByText('Auto — Print Dialog')).not.toBeNull();
});

test('Add printer saves a network printer', () => {
  const { onSavePrinter } = renderPrinting();
  fireEvent.click(screen.getByTestId('printing-add-printer-button'));
  fireEvent.change(screen.getByTestId('add-printer-name-input'), { target: { value: 'Front counter' } });
  fireEvent.change(screen.getByTestId('add-printer-address-input'), { target: { value: '192.168.1.50' } });
  fireEvent.click(screen.getByTestId('add-printer-save-button'));
  expect(onSavePrinter).toHaveBeenCalledOnce();
  expect(onSavePrinter.mock.calls[0][0]).toMatchObject({
    name: 'Front counter', address: '192.168.1.50', connectionType: 'network', vendor: 'epson', language: 'esc-pos',
    port: 8008, columns: 42, isDefault: true, autoCut: true, autoOpenDrawer: false,
  });
  expect(screen.queryByTestId('add-printer-save-button')).toBeNull();
});

test('the dialog refuses a missing address', () => {
  const { onSavePrinter } = renderPrinting([frontCounter]);
  fireEvent.click(screen.getByTestId('printing-add-printer-button'));
  expect(screen.getByTestId('add-printer-default-toggle').getAttribute('aria-checked')).toBe('false');
  fireEvent.change(screen.getByTestId('add-printer-name-input'), { target: { value: 'Kitchen' } });
  fireEvent.click(screen.getByTestId('add-printer-save-button'));
  expect(screen.getByTestId('add-printer-address-error').textContent).toBe('A printer address or device is required');
  expect(screen.queryByTestId('add-printer-name-error')).toBeNull();
  expect(onSavePrinter).not.toHaveBeenCalled();
});

test('Delete asks first', () => {
  const { onDeletePrinter } = renderPrinting([frontCounter]);
  fireEvent.click(screen.getByTestId('printer-row-p1-menu'));
  fireEvent.click(screen.getByTestId('printer-row-p1-delete'));
  expect(onDeletePrinter).not.toHaveBeenCalled();
  expect(screen.getByText('Delete Front counter?')).not.toBeNull();
  expect(screen.getByText('Receipts routed to it print with Auto instead.')).not.toBeNull();
  fireEvent.click(screen.getByTestId('printer-row-p1-delete-confirm'));
  expect(onDeletePrinter).toHaveBeenCalledExactlyOnceWith('p1');
});

const PRINTER_DOCS = 'https://docs.wcpos.com/hardware/printers';

test("the empty state's printer guide link opens the printer docs", () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  renderPrinting();
  const link = screen.getByTestId('printing-printer-guide-link');
  expect(link.textContent).toBe('Open the printer guide');
  fireEvent.click(link);
  expect(open).toHaveBeenCalledExactlyOnceWith(PRINTER_DOCS);
});

test('Having trouble? opens the printer docs', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  renderPrinting();
  const link = screen.getByTestId('printing-having-trouble');
  expect(link.textContent).toBe('Having trouble?');
  fireEvent.click(link);
  expect(open).toHaveBeenCalledExactlyOnceWith(PRINTER_DOCS);
});

test('a saved printer hides the printer guide link but keeps Having trouble?', () => {
  renderPrinting([frontCounter]);
  expect(screen.queryByTestId('printing-printer-guide-link')).toBeNull();
  expect(screen.getByTestId('printing-having-trouble')).not.toBeNull();
});
