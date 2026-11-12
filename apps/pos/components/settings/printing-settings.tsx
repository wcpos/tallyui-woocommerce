import type { JSX } from 'react';
import { View } from 'react-native';
import { Path, Rect } from 'react-native-svg';
import { Badge, createSvgIcon, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Text } from '@tallyui/components';
import type { ReceiptTemplate } from '@tallyui/core';
import type { PrinterProfile } from '@tallyui/pos';
import { AUTO_PRINTER_VALUE, autoPrinterLabel, templateTypeLabel } from '../../lib/receipts/printer-routing';
import type { StoreTemplatesState, TemplateKind } from '../../lib/receipts/use-store-templates';
import { SETTINGS_HELP_CLASS, SettingsSection } from './settings-form';

const PrinterIcon = createSvgIcon('PrinterIcon', () => <>
  <Path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
  <Path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
  <Rect x="6" y="14" width="12" height="8" rx="1" />
</>);

function TemplateRow({ template, printers, first }: {
  template: ReceiptTemplate; printers: PrinterProfile[]; first: boolean;
}): JSX.Element {
  const label = autoPrinterLabel(template, printers);
  return (
    <View testID={`template-row-${template.id}`}
      className={first ? 'flex-row items-center gap-3 py-3' : 'flex-row items-center gap-3 py-3 border-t border-border'}>
      <Text className="min-w-0 flex-1 text-base text-foreground" numberOfLines={1}>{template.title}</Text>
      <Badge testID={`template-row-${template.id}-tag`} variant="secondary" label={templateTypeLabel(template)} />
      <View testID={`template-row-${template.id}-printer-select`} className="w-64">
        <Select value={{ value: AUTO_PRINTER_VALUE, label }}>
          <SelectTrigger disabled><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem value={AUTO_PRINTER_VALUE} label={label}><Text>{label}</Text></SelectItem>
            {printers.map(printer => <SelectItem key={printer.id} value={printer.id} label={printer.name}>
              <Text>{printer.name}</Text>
            </SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
      </View>
    </View>
  );
}

export function PrintingSettings(props: {
  templates: Record<TemplateKind, StoreTemplatesState>;
  /** Printers known on this device; part (a) passes [SYSTEM_PRINT_DIALOG]. */
  printers: PrinterProfile[];
}): JSX.Element {
  return (
    <View testID="screen-settings-printing" className="gap-5">
      <SettingsSection first title="Printers" description="Devices receipts can be sent to." testID="settings-printing-printers">
        {!props.printers.some(printer => printer.connectionType !== 'system') && (
          <View testID="printers-empty-state" className="items-center gap-2 p-6">
            <PrinterIcon size={32} strokeWidth={1.5} className="text-muted-foreground" />
            <Text testID="printers-empty-state-title" className="text-center font-medium text-foreground">No printers configured</Text>
            <Text testID="printers-empty-state-description" className="text-center text-muted-foreground">
              Add a printer to send receipts straight to your hardware. You can always use the Print Dialog without one.
            </Text>
          </View>
        )}
      </SettingsSection>
      {(['receipt', 'report', 'closure'] as const).map(kind => {
        const state = props.templates[kind];
        const title = { receipt: 'Receipt templates', report: 'Report templates', closure: 'Closure templates' }[kind];
        const testID = `settings-printing-${kind}-templates`;
        return (
          <SettingsSection key={kind} title={title} description="Choose which printer each template prints to." testID={testID}>
            {state.status === 'error' && <Text testID={`${testID}-error`} className={SETTINGS_HELP_CLASS}>
              Templates could not be loaded: {state.message}
            </Text>}
            {state.status === 'ready' && (state.templates.length === 0
              ? <Text testID={`${testID}-empty`} className="text-muted-foreground py-2">No active templates found.</Text>
              : state.templates.map((template, index) => <TemplateRow key={template.id} template={template} printers={props.printers} first={index === 0} />))}
          </SettingsSection>
        );
      })}
    </View>
  );
}
