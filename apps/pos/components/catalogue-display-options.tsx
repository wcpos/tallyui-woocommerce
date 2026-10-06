import { useState } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, SettingsGroup, SettingsRow, Slider, Switch, Text } from '@tallyui/components';
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
          <View className="flex-row items-center gap-4">
            <Slider testID="tile-size" aria-label="Tile size" className="flex-1" min={2} max={8} step={1}
              value={typeof state.gridColumns === 'number' ? state.gridColumns : 4}
              onValueChange={n => onChange({ ...state, gridColumns: n as AppCatalogueViewState['gridColumns'] })} />
            <Text testID="tile-size-value">{String(typeof state.gridColumns === 'number' ? state.gridColumns : 4)}</Text>
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
        <SettingsGroup title="Panel position">
          <View className="flex-row gap-4">
            <Button testID="panel-position-left" variant={state.position === 'left' ? 'default' : 'outline'}
              accessibilityState={{ selected: state.position === 'left' }}
              onPress={() => onChange({ ...state, position: 'left' })}><Text>Products left</Text></Button>
            <Button testID="panel-position-right" variant={state.position === 'right' ? 'default' : 'outline'}
              accessibilityState={{ selected: state.position === 'right' }}
              onPress={() => onChange({ ...state, position: 'right' })}><Text>Products right</Text></Button>
          </View>
        </SettingsGroup>
        <DialogFooter>
          <Button testID="catalogue-settings-restore" variant="destructive" onPress={() => onChange(CATALOGUE_VIEW_DEFAULTS)}><Text>Restore default settings</Text></Button>
          <Button testID="catalogue-settings-close" onPress={() => setOpen(false)}><Text>Close</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </>;
}
