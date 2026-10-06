import { useState } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, SettingsGroup, SettingsRow, Switch, Text } from '@tallyui/components';
import { CATALOGUE_COLUMNS, CATALOGUE_TILE_FIELDS, CATALOGUE_VIEW_DEFAULTS } from '../lib/catalogue/catalogue-view-state';
import type { AppCatalogueViewState } from '../lib/catalogue/catalogue-view-state';

export function CatalogueDisplayOptions({ state, onChange }: { state: AppCatalogueViewState; onChange(next: AppCatalogueViewState): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return <>
    <Button testID="catalogue-settings-button" variant="outline" onPress={() => setOpen(true)}><Text>Product settings</Text></Button>
    {open && <Dialog open onOpenChange={next => { if (!next) setOpen(false); }}>
      <DialogContent testID="catalogue-settings">
        <DialogHeader><DialogTitle>Product settings</DialogTitle></DialogHeader>
        {state.view === 'grid' ? <><SettingsGroup title="Tile size" description="Tiles in each row. Phones show 2.">
          <View role="radiogroup" aria-label="Tile size" className="flex-row flex-wrap gap-2">
            {([2, 3, 4, 5, 6, 7, 8] as const).map(n => <Button
              key={n} testID={`tile-size-${n}`} role="radio" aria-checked={state.gridColumns === n}
              variant={state.gridColumns === n ? 'default' : 'outline'}
              onPress={() => onChange({ ...state, gridColumns: n })}
            ><Text>{String(n)}</Text></Button>)}
          </View>
        </SettingsGroup>
        <SettingsGroup title="Tile fields">
          {CATALOGUE_TILE_FIELDS.map(({ id, label }) => <SettingsRow key={id} label={label} action={<Switch
            testID={`tile-field-toggle-${id}`} accessibilityLabel={`Show ${label} on tiles`}
            checked={state.tileFields[id]}
            onCheckedChange={next => onChange({ ...state, tileFields: { ...state.tileFields, [id]: next } })}
          />} />)}
        </SettingsGroup></> : <SettingsGroup title="Columns">
          {state.columns.map(({ id, visible }) => {
            const label = CATALOGUE_COLUMNS.find(column => column.id === id)!.label;
            return <SettingsRow key={id} label={label} action={<Switch
              testID={`column-toggle-${id}`} accessibilityLabel={`Show ${label}`}
              checked={visible} disabled={id === 'name'}
              onCheckedChange={next => onChange({ ...state, columns: state.columns.map(c => c.id === id ? { ...c, visible: next } : c) })}
            />} />;
          })}
        </SettingsGroup>}
        <DialogFooter>
          <Button testID="catalogue-settings-restore" variant="destructive" onPress={() => onChange(CATALOGUE_VIEW_DEFAULTS)}><Text>Restore default settings</Text></Button>
          <Button testID="catalogue-settings-close" onPress={() => setOpen(false)}><Text>Close</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </>;
}
