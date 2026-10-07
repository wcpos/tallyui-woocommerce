import { useState } from 'react';
import type { JSX } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { formatMoney, moneyFromMajor } from '@tallyui/core';
import type { TallyConnector } from '@tallyui/core';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Text } from '@tallyui/components';
import type { ProductSort } from '@tallyui/pos';
import { describeQuickFilter } from '../lib/catalogue/quick-filters';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import { QuickFilterEditor } from './quick-filter-editor';

type Editing = { mode: 'new' } | { mode: 'edit'; quickFilter: QuickFilter } | null;

export function FilterBarDialog({ quickFilters, onChange, products, connector, currency, baselineSort }: {
  quickFilters: QuickFilter[];
  onChange(next: QuickFilter[]): void;
  products: any[];
  connector: TallyConnector;
  currency: string;
  baselineSort: ProductSort | null;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<QuickFilter | null>(null);
  const { height } = useWindowDimensions();
  const formatPrice = (value: number) => {
    const money = moneyFromMajor(value, currency);
    return (money && formatMoney(money)) ?? String(value);
  };
  function close() {
    setOpen(false);
    setEditing(null);
    setDeleting(null);
  }
  function handleSave(quickFilter: QuickFilter) {
    const next = quickFilters.some(qf => qf.id === quickFilter.id)
      ? quickFilters.map(qf => qf.id === quickFilter.id ? quickFilter : qf)
      : [...quickFilters, quickFilter];
    onChange(next);
    setEditing(null);
  }
  function move(index: number, neighbour: number) {
    const next = [...quickFilters];
    [next[index], next[neighbour]] = [next[neighbour], next[index]];
    onChange(next);
  }

  return <>
    <Button variant="outline" testID="filter-bar-customize" accessibilityLabel="Customise filter bar"
      onPress={() => setOpen(true)}><Text>Filter bar</Text></Button>
    {open && <Dialog open onOpenChange={next => { if (!next) close(); }}>
      <DialogContent testID="filter-bar-modal" className="w-full max-w-3xl">
        <DialogHeader><DialogTitle>Filter bar</DialogTitle></DialogHeader>
        <ScrollView style={{ maxHeight: Math.round(height * 0.7) }}>
          <View className="flex-col gap-4 md:flex-row">
            <View className="gap-2 md:w-2/5">
              {quickFilters.map((qf, index) => <View key={qf.id} testID={`filter-bar-item-${qf.id}`} className="gap-1">
                <View>
                  <Text>{qf.label}</Text>
                  <Text className="text-sm text-muted-foreground">{describeQuickFilter(qf, formatPrice)}</Text>
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                {/* v2 reorders by drag; buttons work the same on touch and keyboard. */}
                <Button variant="ghost" testID={`filter-bar-move-up-${qf.id}`} accessibilityLabel={`Move ${qf.label} up`}
                  disabled={index === 0} onPress={() => move(index, index - 1)}><Text>↑</Text></Button>
                <Button variant="ghost" testID={`filter-bar-move-down-${qf.id}`} accessibilityLabel={`Move ${qf.label} down`}
                  disabled={index === quickFilters.length - 1} onPress={() => move(index, index + 1)}><Text>↓</Text></Button>
                <Button variant="ghost" testID={`filter-bar-edit-${qf.id}`}
                  onPress={() => setEditing({ mode: 'edit', quickFilter: qf })}><Text>Edit</Text></Button>
                <Button variant="ghost" testID={`filter-bar-delete-${qf.id}`} onPress={() => setDeleting(qf)}><Text>Delete</Text></Button>
                </View>
              </View>)}
              <Button variant="outline" testID="filter-bar-add-quick-filter" onPress={() => setEditing({ mode: 'new' })}>
                <Text>Add quick filter</Text>
              </Button>
            </View>
            <View className="md:flex-1">
              {editing ? <QuickFilterEditor key={editing.mode === 'new' ? 'new' : editing.quickFilter.id}
                initial={editing.mode === 'edit' ? editing.quickFilter : null} products={products} connector={connector}
                currency={currency} baselineSort={baselineSort} onSave={handleSave} onCancel={() => setEditing(null)} />
                : <Text testID="filter-bar-hint">Select a quick filter to edit it, or add a new one.</Text>}
            </View>
          </View>
        </ScrollView>
        <DialogFooter>
          <Button testID="filter-bar-modal-close" onPress={close}><Text>Close</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
    {deleting && <AlertDialog open onOpenChange={next => { if (!next) setDeleting(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete quick filter?</AlertDialogTitle>
          <AlertDialogDescription>This removes the quick filter from the filter bar.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild onPress={() => setDeleting(null)}>
            <Button variant="outline" testID="filter-bar-delete-cancel"><Text>Cancel</Text></Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild onPress={() => {
            onChange(quickFilters.filter(qf => qf.id !== deleting.id));
            if (editing?.mode === 'edit' && editing.quickFilter.id === deleting.id) setEditing(null);
            setDeleting(null);
          }}>
            <Button variant="destructive" testID="filter-bar-delete-confirm"><Text>Delete</Text></Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>}
  </>;
}
