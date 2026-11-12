import { useState, type JSX } from 'react';
import { View } from 'react-native';
import { Path, Rect } from 'react-native-svg';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, Badge, Button, createSvgIcon, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, IconButton, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger,
  SelectValue, Text } from '@tallyui/components';
import type { ReceiptTemplate } from '@tallyui/core';
import type { PrinterProfile } from '@tallyui/pos';
import { AUTO_PRINTER_VALUE, autoPrinterLabel, SYSTEM_PRINT_DIALOG, templateTypeLabel } from '../../lib/receipts/printer-routing';
import type { StoreTemplatesState, TemplateKind } from '../../lib/receipts/use-store-templates';
import { PrinterDialog } from './printer-dialog';
import { SETTINGS_HELP_CLASS, SETTINGS_KEY_CLASS, SettingsSection } from './settings-form';

const PrinterIcon = createSvgIcon('PrinterIcon', () => <>
  <Path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
  <Path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
  <Rect x="6" y="14" width="12" height="8" rx="1" />
</>);
const PlusIcon = createSvgIcon('PlusIcon', () => <Path d="M12 5v14m-7-7h14" />);
// tabler's dots-vertical, as database-counts.tsx draws v2's `more` glyph.
const MoreIcon = createSvgIcon('MoreIcon', () => <><Path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0" />
  <Path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0" /><Path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0" /></>);

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

/** v2 printing/printer-row.tsx: name and Default tag, `host:port · Vendor`, Edit, and a ⋮ with Set Default and Delete. */
function PrinterRow({ profile, first, onEdit, onSetDefault, onDelete }: {
  profile: PrinterProfile; first: boolean; onEdit(): void; onSetDefault(): void; onDelete(): void;
}): JSX.Element {
  const id = `printer-row-${profile.id}`;
  const vendor = profile.vendor === 'star' ? ' · Star' : profile.vendor === 'epson' ? ' · Epson' : '';
  return (
    <View testID={id} className={first ? 'flex-row items-center gap-3 py-3' : 'flex-row items-center gap-3 py-3 border-t border-border'}>
      <View className="min-w-0 flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-base text-foreground" numberOfLines={1}>{profile.name}</Text>
          {profile.isDefault && <Badge testID={`${id}-default`} variant="secondary" label="Default" />}
        </View>
        <Text testID={`${id}-identifier`} className={SETTINGS_KEY_CLASS} numberOfLines={1}>{`${profile.address ?? ''}:${profile.port ?? 9100}${vendor}`}</Text>
      </View>
      <Button testID={`${id}-edit`} variant="outline" size="sm" onPress={onEdit}><Text>Edit</Text></Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton testID={`${id}-menu`} accessibilityLabel="More actions" className="h-11 w-11">
            <MoreIcon size={18} strokeWidth={1.5} className="text-muted-foreground" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!profile.isDefault && <><DropdownMenuItem testID={`${id}-set-default`} onPress={onSetDefault}><Text>Set Default</Text>
          </DropdownMenuItem><DropdownMenuSeparator /></>}
          <DropdownMenuItem testID={`${id}-delete`} onPress={onDelete}>
            <Text className="text-destructive">Delete</Text>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}

export function PrintingSettings(props: {
  templates: Record<TemplateKind, StoreTemplatesState>;
  /** The printers stored on this device; the in-memory Print Dialog is added in front of them. */
  profiles: PrinterProfile[];
  onSavePrinter(profile: PrinterProfile): void;
  onSetDefault(id: string): void;
  onDeletePrinter(id: string): void;
  /** A refused printer command, shown under the Printers section. */
  printersError?: string;
}): JSX.Element {
  const printers = [SYSTEM_PRINT_DIALOG, ...props.profiles];
  // `null`: Add; a profile: Edit; undefined: closed.
  const [editing, setEditing] = useState<PrinterProfile | null>();
  const [deleting, setDeleting] = useState<PrinterProfile>();
  return (
    <View testID="screen-settings-printing" className="gap-5">
      <SettingsSection first title="Printers" description="Devices receipts can be sent to." testID="settings-printing-printers">
        {props.profiles.map((profile, index) => <PrinterRow key={profile.id} profile={profile} first={index === 0}
          onEdit={() => setEditing(profile)} onSetDefault={() => props.onSetDefault(profile.id)} onDelete={() => setDeleting(profile)} />)}
        {props.profiles.length === 0 && (
          <View testID="printers-empty-state" className="items-center gap-2 p-6">
            <PrinterIcon size={32} strokeWidth={1.5} className="text-muted-foreground" />
            <Text testID="printers-empty-state-title" className="text-center font-medium text-foreground">No printers configured</Text>
            <Text testID="printers-empty-state-description" className="text-center text-muted-foreground">
              Add a printer to send receipts straight to your hardware. You can always use the Print Dialog without one.
            </Text>
          </View>
        )}
        {/* v2 printing/index.tsx:278-290: primary until a printer exists, then outline. */}
        <Button testID="printing-add-printer-button" size="sm" className="self-start mt-2"
          variant={props.profiles.length === 0 ? 'default' : 'outline'} onPress={() => setEditing(null)}>
          <PlusIcon size={16} className={props.profiles.length === 0 ? 'text-primary-foreground' : 'text-foreground'} />
          <Text>Add printer</Text>
        </Button>
        {props.printersError && <Text testID="settings-printing-printers-error"
          className={`${SETTINGS_HELP_CLASS} text-destructive`}>{props.printersError}</Text>}
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
              : state.templates.map((template, index) => <TemplateRow key={template.id} template={template} printers={printers} first={index === 0} />))}
          </SettingsSection>
        );
      })}
      {editing !== undefined && <PrinterDialog open printer={editing ?? undefined} printerCount={props.profiles.length}
        onSave={props.onSavePrinter} onOpenChange={open => { if (!open) setEditing(undefined); }} />}
      {deleting && <AlertDialog open onOpenChange={open => { if (!open) setDeleting(undefined); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Delete ${deleting.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>Receipts routed to it print with Auto instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild onPress={() => setDeleting(undefined)}>
              <Button variant="outline" testID={`printer-row-${deleting.id}-delete-cancel`}><Text>Cancel</Text></Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild onPress={() => { props.onDeletePrinter(deleting.id); setDeleting(undefined); }}>
              <Button variant="destructive" testID={`printer-row-${deleting.id}-delete-confirm`}><Text>Delete</Text></Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}
    </View>
  );
}
