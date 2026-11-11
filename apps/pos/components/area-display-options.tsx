// v2's DisplayOptions (WCPOS monorepo `packages/core/src/screens/main/components/display-options.tsx`) in the
// UISettingsDialog chrome (`components/ui-settings/index.tsx`): the bar's `filters` icon opens a right side panel
// with one switch per column (`ui-settings/columns-form.tsx`), and a footer with Restore Default Settings and Close.
import { useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Dialog, DialogContent, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { areaColumnRows, type AreaColumn, type AreaColumnSetting, type AreaId } from '../lib/area-columns';
import { RestoreDefaultsButton, RIGHT_SHEET, SettingsTrigger } from './catalogue-display-options';
import { SwitchRow } from './select-chevron';

// v2's strings (core en.json): the trigger's label (`<area>.display_options`) and the panel's title.
const TITLES: Record<AreaId, { trigger: string; title: string }> = {
  orders: { trigger: 'Display options', title: 'Order Settings' },
  products: { trigger: 'Display options', title: 'Product Settings' },
  customers: { trigger: 'Display options', title: 'Customer Settings' },
  coupons: { trigger: 'Display options', title: 'Coupon Settings' },
};

/** The area bar's settings icon and its panel. `columns` is the area's list in its order with v2's labels and
 *  defaults; `settings` the current rows; Restore sets the defaults back. */
export function AreaDisplayOptions<Id extends string>({ area, columns, settings, onChange }: {
  area: AreaId;
  columns: readonly AreaColumn<Id>[];
  settings: readonly AreaColumnSetting<Id>[];
  onChange(next: AreaColumnSetting<Id>[]): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const { trigger, title } = TITLES[area];
  const shown = (id: Id) => settings.find(setting => setting.id === id)?.visible ?? false;
  return <>
    <SettingsTrigger testID={`${area}-bar-display`} label={trigger} tooltip={title} onPress={() => setOpen(true)} />
    {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
      {/* v2's `side="right" size="lg"`; the title row and the X are the catalogue sheet's, which follows v2's dialog. */}
      <DialogContent testID={`${area}-display-options`} className={RIGHT_SHEET}>
        <View className="pl-4 pr-11">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </View>
        <View className="absolute right-1 top-1">
          <IconButton variant="ghost" className="h-11 w-11" testID={`${area}-display-x`} accessibilityLabel="Close" onPress={() => setOpen(false)}><XIcon size={18} /></IconButton>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-2 px-4 py-1">
          {/* v2's UISettingsColumnsForm: its "Columns" SectionHeading, then one FormSwitch per column. No drag handle:
              reordering is not offered here. */}
          <View testID={`${area}-display-columns`} className="gap-2 px-1 pt-2">
            <Text role="heading" aria-level={2} className="text-sm font-semibold">Columns</Text>
            {columns.map(({ id, label }) => <SwitchRow key={id} label={label}
              testID={`${area}-display-column-${id}`} accessibilityLabel={`Show ${label}`} checked={shown(id)}
              onCheckedChange={next => onChange(columns.map(column => ({ id: column.id, visible: column.id === id ? next : shown(column.id) })))} />)}
          </View>
        </ScrollView>
        <View className="flex-row justify-between border-t border-border px-4 pt-4">
          <RestoreDefaultsButton testID={`${area}-display-restore`} onPress={() => onChange(areaColumnRows(columns))} />
          <Button testID={`${area}-display-close`} variant="outline" onPress={() => setOpen(false)}><Text>Close</Text></Button>
        </View>
      </DialogContent>
    </Dialog>}
  </>;
}
