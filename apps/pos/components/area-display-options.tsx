// v2's DisplayOptions (WCPOS monorepo `packages/core/src/screens/main/components/display-options.tsx`) in the
// UISettingsDialog chrome (`components/ui-settings/index.tsx`): the bar's `filters` icon opens a right side panel
// with one switch per column (`ui-settings/columns-form.tsx`), and a footer with Restore Default Settings and Close.
import { useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Dialog, DialogContent, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { areaColumnRows, type AreaColumn, type AreaColumnSetting, type AreaId } from '../lib/area-columns';
import { SettingsTrigger } from './catalogue-display-options';
import { RestoreDefaultsButton, RIGHT_SHEET, SHEET_TITLE, SheetCloseButton } from './sheet';
import { SwitchRow } from './select-chevron';

// v2's strings (core en.json): the trigger's label (`<area>.display_options`) and the panel's title.
const TITLES: Record<AreaId, { trigger: string; title: string }> = {
  orders: { trigger: 'Display options', title: 'Order Settings' },
  products: { trigger: 'Display options', title: 'Product Settings' },
  customers: { trigger: 'Display options', title: 'Customer Settings' },
  coupons: { trigger: 'Display options', title: 'Coupon Settings' },
};

/** The area bar's settings icon and its panel. `columns` is the area's list in its order with v2's labels and
 *  defaults; `settings` the current rows; Restore sets the defaults back; `onOpenChange` hears the panel open and close. */
export function AreaDisplayOptions<Id extends string>({ area, columns, settings, onChange, onOpenChange }: {
  area: AreaId;
  columns: readonly AreaColumn<Id>[];
  settings: readonly AreaColumnSetting<Id>[];
  onChange(next: AreaColumnSetting<Id>[]): void;
  onOpenChange?(open: boolean): void;
}): JSX.Element {
  const [open, setOpenState] = useState(false);
  function setOpen(next: boolean) { setOpenState(next); onOpenChange?.(next); }
  const { trigger, title } = TITLES[area];
  const row = (id: Id): AreaColumnSetting<Id> => settings.find(setting => setting.id === id) ?? { id, visible: false };
  // One column's row changed, the others (their display lines too) kept as they are.
  const change = (id: Id, next: Partial<AreaColumnSetting<Id>>) =>
    onChange(columns.map(column => column.id === id ? { ...row(column.id), ...next } : row(column.id)));
  // A column's display lines with their labels and their current state (a line the row lacks takes its default).
  const lines = (column: AreaColumn<Id>) => (column.display ?? []).map(line =>
    ({ ...line, visible: row(column.id).display?.find(set => set.id === line.id)?.visible ?? line.visible }));
  return <>
    <SettingsTrigger testID={`${area}-bar-display`} label={trigger} tooltip={title} onPress={() => setOpen(true)} />
    {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
      {/* v2's `side="right" size="lg"`; the title row and the X are the catalogue sheet's, which follows v2's dialog. */}
      <DialogContent testID={`${area}-display-options`} className={RIGHT_SHEET}>
        <View className="pl-4 pr-11">
          <DialogTitle testID={`${area}-display-title`} className={SHEET_TITLE}>{title}</DialogTitle>
        </View>
        <View className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID={`${area}-display-x`} accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 py-1">
          {/* v2's UISettingsColumnsForm: its "Columns" SectionHeading, then one FormSwitch per column. No drag handle:
              reordering is not offered here. */}
          <View testID={`${area}-display-columns`} className="gap-2 px-1 pt-2">
            <Text role="heading" aria-level={2} className="text-sm font-semibold">Columns</Text>
            {columns.map(column => <View key={column.id} className="gap-2">
              <SwitchRow label={column.label} testID={`${area}-display-column-${column.id}`} accessibilityLabel={`Show ${column.label}`}
                checked={row(column.id).visible} onCheckedChange={visible => change(column.id, { visible })} />
              {/* v2's ColumnDisplayOptions (columns-form.tsx:111-143): a shown column's display switches, one gutter in,
                  here under the column's label (past the 36 px switch and its 12 px gap); hidden with the column. */}
              {column.display && row(column.id).visible ? <View testID={`${area}-display-column-${column.id}-display`} className="gap-2 pl-12">
                {lines(column).map(({ id, label, visible }) => <SwitchRow key={id} label={label} testID={`${area}-display-column-${column.id}-${id}`}
                  accessibilityLabel={`Show ${label}`} checked={visible}
                  onCheckedChange={next => change(column.id, { display: lines(column).map(line => ({ id: line.id, visible: line.id === id ? next : line.visible })) })} />)}
              </View> : null}
            </View>)}
          </View>
        </ScrollView>
        <View className="flex-row justify-between border-t border-border px-4 pt-4">
          <RestoreDefaultsButton testID={`${area}-display-restore`} onPress={() => onChange(areaColumnRows(columns))} />
          <SheetCloseButton testID={`${area}-display-close`} onPress={() => setOpen(false)} />
        </View>
      </DialogContent>
    </Dialog>}
  </>;
}
