import { useState, type JSX } from 'react';
import { View } from 'react-native';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectGroup,
  SelectItem, SelectTrigger, SelectValue, Switch, Text } from '@tallyui/components';
import type { PrinterProfile } from '@tallyui/pos';
import { newPrinterId } from '../../lib/printing/printer-profiles';
import { SETTINGS_HELP_CLASS, SettingsField } from './settings-form';

type Vendor = 'epson' | 'star';
type Paper = '58mm' | '80mm';
const VENDORS: { value: Vendor; label: string }[] = [{ value: 'epson', label: 'Epson' }, { value: 'star', label: 'Star' }];
const PAPERS: { value: Paper; label: string }[] = [{ value: '58mm', label: '58mm' }, { value: '80mm', label: '80mm' }];

/** v2 web-network-defaults.ts:13-20: the browser's ePOS / WebPRNT port for this origin. */
function defaultPort(vendor: Vendor): number {
  const secure = typeof location !== 'undefined' && location.protocol === 'https:';
  return vendor === 'star' ? (secure ? 443 : 80) : (secure ? 8043 : 8008);
}

/** v2 schema.ts webPrinterSchema, checked by hand. */
function validate(values: { name: string; address: string; port: string }): Record<'name' | 'address' | 'port', string | undefined> {
  const port = Number(values.port);
  return {
    name: values.name.trim() ? undefined : 'A printer name is required',
    address: values.address.trim() ? undefined : 'A printer address or device is required',
    port: /^\d+$/.test(values.port.trim()) && port >= 1 && port <= 65535 ? undefined : 'Port must be a whole number from 1 to 65535',
  };
}

function FieldError({ testID, message }: { testID: string; message?: string }): JSX.Element | null {
  return message ? <Text testID={testID} className={`${SETTINGS_HELP_CLASS} text-destructive`}>{message}</Text> : null;
}

/** v2's web edit form (add-printer.web.tsx, dialog/printer-dialog-layout.tsx): one form for add and edit. */
export function PrinterDialog({ open, printer, printerCount, onSave, onOpenChange }: {
  open: boolean; printer?: PrinterProfile; printerCount: number;
  onSave(profile: PrinterProfile): void; onOpenChange(open: boolean): void;
}): JSX.Element {
  const [vendor, setVendor] = useState<Vendor>(printer?.vendor === 'star' ? 'star' : 'epson');
  const [values, setValues] = useState({
    name: printer?.name ?? '', address: printer?.address ?? '', port: String(printer?.port ?? defaultPort(vendor)),
  });
  const [portTyped, setPortTyped] = useState(printer !== undefined);
  const [paper, setPaper] = useState<Paper>(printer?.columns === 32 ? '58mm' : '80mm');
  const [isDefault, setIsDefault] = useState(printer?.isDefault ?? printerCount === 0);
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(values) : { name: undefined, address: undefined, port: undefined };

  function chooseVendor(next: Vendor) {
    setVendor(next);
    if (!portTyped) setValues(v => ({ ...v, port: String(defaultPort(next)) }));
  }

  function save() {
    setSubmitted(true);
    if (Object.values(validate(values)).some(Boolean)) return;
    onSave({
      ...printer, id: printer?.id ?? newPrinterId(), name: values.name.trim(), connectionType: 'network', vendor,
      language: vendor === 'star' ? 'star-line' : 'esc-pos', address: values.address.trim(), port: Number(values.port),
      // resolve-printer.ts: 58 mm is 32 columns, 80 mm is 42 (a stored 48 stays 48).
      columns: paper === '58mm' ? 32 : printer?.columns === 48 ? 48 : 42,
      isDefault, autoCut: printer?.autoCut ?? true, autoOpenDrawer: printer?.autoOpenDrawer ?? false,
    });
    onOpenChange(false);
  }

  const vendorLabel = VENDORS.find(option => option.value === vendor)!.label;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="max-w-2xl" testID="printer-dialog">
        <DialogHeader><DialogTitle>Edit Printer</DialogTitle></DialogHeader>
        <View testID="printer-dialog-banner" className="rounded-md border border-border bg-muted p-3"><Text className="text-sm text-foreground">
          Web browsers can print directly to Epson and Star Micronics printers over network, USB, or Bluetooth when the browser supports it.
        </Text></View>
        <View>
          <SettingsField testID="printer-field-name" label="Printer Name">
            <Input className="w-full"><Input.Field testID="add-printer-name-input" accessibilityLabel="Printer Name"
              placeholder="e.g. Receipt Printer" value={values.name} onChangeText={name => setValues(v => ({ ...v, name }))} /></Input>
            <FieldError testID="add-printer-name-error" message={errors.name} />
          </SettingsField>
          <SettingsField testID="printer-field-vendor" label="Vendor">
            <Select value={{ value: vendor, label: vendorLabel }} onValueChange={option => { if (option) chooseVendor(option.value as Vendor); }}>
              <SelectTrigger testID="add-printer-vendor-select" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                {VENDORS.map(({ value, label }) => <SelectItem key={value} value={value} label={label}
                  testID={`add-printer-vendor-option-${value}`}><Text>{label}</Text></SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
          </SettingsField>
          <SettingsField testID="printer-field-address" label="IP Address">
            <Input className="w-full"><Input.Field testID="add-printer-address-input" accessibilityLabel="IP Address"
              autoCapitalize="none" autoCorrect={false} value={values.address}
              onChangeText={address => setValues(v => ({ ...v, address }))} /></Input>
            <FieldError testID="add-printer-address-error" message={errors.address} />
          </SettingsField>
          <SettingsField testID="printer-field-port" label="Port">
            <Input className="w-full"><Input.Field testID="add-printer-port-input" accessibilityLabel="Port" keyboardType="number-pad"
              inputMode="numeric" value={values.port}
              onChangeText={port => { setPortTyped(true); setValues(v => ({ ...v, port })); }} /></Input>
            <FieldError testID="add-printer-port-error" message={errors.port} />
          </SettingsField>
          <SettingsField testID="printer-field-paper" label="Paper width">
            <Select value={{ value: paper, label: paper }} onValueChange={option => { if (option) setPaper(option.value as Paper); }}>
              <SelectTrigger testID="add-printer-paper-select" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                {PAPERS.map(({ value, label }) => <SelectItem key={value} value={value} label={label}
                  testID={`add-printer-paper-option-${value}`}><Text>{label}</Text></SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
          </SettingsField>
          <SettingsField testID="printer-field-default" label="Set as default">
            <Switch testID="add-printer-default-toggle" accessibilityLabel="Set as default" checked={isDefault}
              onCheckedChange={setIsDefault} />
          </SettingsField>
        </View>
        <DialogFooter>
          <Button variant="outline" testID="add-printer-cancel-button" onPress={() => onOpenChange(false)}><Text>Cancel</Text></Button>
          <Button testID="add-printer-save-button" onPress={save}><Text>Save</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
