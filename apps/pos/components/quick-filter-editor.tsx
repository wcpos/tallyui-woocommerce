import { Fragment, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { View } from 'react-native';
import type { TallyConnector } from '@tallyui/core';
import { Button, Input, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Text } from '@tallyui/components';
import { productSortValue, searchProducts, sortProducts } from '@tallyui/pos';
import type { ProductSort } from '@tallyui/pos';
import { createQuickFilterId, isQuickFilterValid, matchesCatalogueFilters, QUICK_FILTER_CONDITION_FIELDS, QUICK_FILTER_SORT_FIELDS, quickFilterToQueryPatch } from '../lib/catalogue/quick-filters';
import type { QuickFilter, QuickFilterCondition, QuickFilterConditionField, QuickFilterSort } from '../lib/catalogue/quick-filters';

const PREVIEW_LIMIT = 200;
const fieldLabels = { categories: 'Category', tags: 'Tag', price: 'Price', on_sale: 'On Sale', stock_status: 'Stock Status', type: 'Type', search: 'Search' };
const sortLabels = { name: 'Name', sku: 'SKU', barcode: 'Barcode', price: 'Price', stock: 'Stock Quantity' };
const stockLabels = { instock: 'In Stock', outofstock: 'Out of Stock', onbackorder: 'On Backorder' };
const typeLabels = { simple: 'Simple', variable: 'Variable', grouped: 'Grouped', external: 'External' };

function createCondition(field: QuickFilterConditionField): QuickFilterCondition {
  switch (field) {
    case 'categories': case 'tags': return { field, value: [] };
    case 'price': return { field, value: {} };
    case 'on_sale': return { field, value: true };
    case 'stock_status': return { field, value: 'instock' };
    case 'type': return { field, value: 'simple' };
    case 'search': return { field, value: '' };
  }
}

// Zero, empty or unparsable means no bound.
function priceBound(n: number): number | undefined { return Number.isFinite(n) && n !== 0 ? n : undefined; }

export function QuickFilterEditor({ initial, products, connector, currency, baselineSort, onSave, onCancel }: {
  initial: QuickFilter | null;
  products: any[];
  connector: TallyConnector;
  currency: string;
  baselineSort: ProductSort | null;
  onSave(quickFilter: QuickFilter): void;
  onCancel(): void;
}): JSX.Element {
  const [draft, setDraft] = useState<QuickFilter>(() => initial ?? { id: createQuickFilterId(), type: 'quick', label: '', conditions: [] });
  const initialPrice = initial?.conditions.find(condition => condition.field === 'price')?.value;
  const [minText, setMinText] = useState(() => initialPrice?.min === undefined ? '' : String(initialPrice.min));
  const [maxText, setMaxText] = useState(() => initialPrice?.max === undefined ? '' : String(initialPrice.max));
  const [preview, setPreview] = useState<any[] | null>(null);
  const firstUnusedField = QUICK_FILTER_CONDITION_FIELDS.find(field => !draft.conditions.some(condition => condition.field === field));

  useEffect(() => {
    // Typing should not recount on every keystroke, as in v2.
    const timer = setTimeout(() => {
      const patch = quickFilterToQueryPatch(draft);
      // The baseline is every synced product, because the app's catalogue has no status or stock baseline.
      const matches = products.filter(doc => matchesCatalogueFilters(doc, patch.filters));
      const searched = patch.search.trim() ? searchProducts(matches, patch.search, connector.traits.product) : matches;
      setPreview(sortProducts([...searched], draft.sort ?? baselineSort,
        (doc, field) => productSortValue(doc, field, connector.traits.product, { currency })));
    }, 250);
    return () => clearTimeout(timer);
  }, [draft.conditions, draft.sort, products, connector.traits.product, currency, baselineSort]);

  return <View className="gap-4">
    <Text>Button name</Text>
    <Input><Input.Field testID="quick-filter-name" placeholder="e.g. Sale wines" accessibilityLabel="Button name"
      value={draft.label} onChangeText={label => setDraft({ ...draft, label })} /></Input>
    <Text>Show products where</Text>
    {draft.conditions.map((condition, index) => {
      const update = (next: QuickFilterCondition) => setDraft({ ...draft, conditions: draft.conditions.map((row, i) => i === index ? next : row) });
      let editor: JSX.Element;
      switch (condition.field) {
        case 'categories': case 'tags': {
          const terms = new Map<number, string>();
          for (const doc of products) {
            for (const term of doc[condition.field] ?? []) terms.set(term.id, term.name);
          }
          for (const id of condition.value) if (!terms.has(id)) terms.set(id, `#${id}`);
          editor = <View className="flex-row flex-wrap items-center gap-2">
            {terms.size === 0 && <Text>{`No ${condition.field} on synced products`}</Text>}
            {[...terms].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => {
              const selected = condition.value.includes(id);
              return <Button key={id} testID={`quick-filter-term-${condition.field}-${id}`}
                variant={selected ? 'default' : 'outline'} aria-pressed={selected}
                onPress={() => update({ ...condition, value: selected ? condition.value.filter(value => value !== id) : [...condition.value, id] })}>
                <Text>{name}</Text>
              </Button>;
            })}
          </View>;
          break;
        }
        case 'price':
          editor = <View className="flex-row flex-wrap items-center gap-2">
            {(['min', 'max'] as const).map(bound => <Fragment key={bound}>
              <Text>{bound === 'min' ? 'Min' : 'Max'}</Text>
              <Input><Input.Field testID={`quick-filter-price-${bound}`} keyboardType="decimal-pad"
                accessibilityLabel={bound === 'min' ? 'Min price' : 'Max price'} value={bound === 'min' ? minText : maxText}
                onChangeText={text => {
                  (bound === 'min' ? setMinText : setMaxText)(text);
                  const value = { ...condition.value };
                  const n = priceBound(Number.parseFloat(text));
                  if (n === undefined) delete value[bound];
                  else value[bound] = n;
                  update({ field: 'price', value });
                }} /></Input>
            </Fragment>)}
          </View>;
          break;
        case 'on_sale':
          editor = <View testID="quick-filter-toggle-on_sale" className="flex-row flex-wrap items-center gap-2">
            {[true, false].map(value => <Button key={String(value)} testID={`quick-filter-toggle-on_sale-${value ? 'yes' : 'no'}`}
              variant={condition.value === value ? 'default' : 'outline'} aria-pressed={condition.value === value}
              onPress={() => update({ field: 'on_sale', value })}><Text>{value ? 'Yes' : 'No'}</Text></Button>)}
          </View>;
          break;
        case 'stock_status':
          editor = <Select value={{ value: condition.value, label: stockLabels[condition.value] }}
            onValueChange={option => { if (option) update({ field: 'stock_status', value: option.value as keyof typeof stockLabels }); }}>
            <SelectTrigger testID="quick-filter-stock-status"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              {Object.entries(stockLabels).map(([value, label]) => <SelectItem key={value} value={value} label={label}
                testID={`quick-filter-stock-status-option-${value}`}><Text>{label}</Text></SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>;
          break;
        case 'type':
          editor = <Select value={{ value: condition.value, label: typeLabels[condition.value] }}
            onValueChange={option => { if (option) update({ field: 'type', value: option.value as keyof typeof typeLabels }); }}>
            <SelectTrigger testID="quick-filter-product-type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              {Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value} label={label}
                testID={`quick-filter-product-type-option-${value}`}><Text>{label}</Text></SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>;
          break;
        case 'search':
          editor = <Input><Input.Field testID="quick-filter-search-term" placeholder="Enter a search term…" accessibilityLabel="Search term"
            value={condition.value} onChangeText={value => update({ field: 'search', value })} /></Input>;
          break;
      }
      return <Fragment key={condition.field}>
        {index > 0 && <Text>and</Text>}
        <View className="flex-row flex-wrap items-center gap-2">
          <Select value={{ value: condition.field, label: fieldLabels[condition.field] }} onValueChange={option => {
            if (!option) return;
            if (option.value === 'price') { setMinText(''); setMaxText(''); }
            update(createCondition(option.value as QuickFilterConditionField));
          }}>
            <SelectTrigger testID={`quick-filter-condition-field-${index}`}><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              {QUICK_FILTER_CONDITION_FIELDS.filter(field => field === condition.field || !draft.conditions.some(row => row.field === field))
                .map(field => <SelectItem key={field} value={field} label={fieldLabels[field]}
                  testID={`quick-filter-condition-option-${index}-${field}`}><Text>{fieldLabels[field]}</Text></SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
          {editor}
          <Button variant="ghost" testID={`quick-filter-condition-remove-${index}`} accessibilityLabel="Remove condition"
            onPress={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, i) => i !== index) })}><Text>×</Text></Button>
        </View>
      </Fragment>;
    })}
    <Button variant="outline" testID="quick-filter-add-condition" disabled={!firstUnusedField} onPress={() => {
      if (!firstUnusedField) return;
      if (firstUnusedField === 'price') { setMinText(''); setMaxText(''); }
      setDraft({ ...draft, conditions: [...draft.conditions, createCondition(firstUnusedField)] });
    }}><Text>Add condition</Text></Button>
    <Text>Order by</Text>
    <Select value={draft.sort ? { value: draft.sort.field, label: sortLabels[draft.sort.field] } : { value: 'default', label: 'Default order' }}
      onValueChange={option => {
        if (!option) return;
        if (option.value === 'default') {
          const { sort, ...withoutSort } = draft;
          setDraft(withoutSort);
        } else setDraft({ ...draft, sort: { field: option.value as QuickFilterSort['field'], dir: draft.sort?.dir ?? 'asc' } });
      }}>
      <SelectTrigger testID="quick-filter-sort-field"><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>
        <SelectItem value="default" label="Default order" testID="quick-filter-sort-option-default"><Text>Default order</Text></SelectItem>
        {QUICK_FILTER_SORT_FIELDS.map(field => <SelectItem key={field} value={field} label={sortLabels[field]}
          testID={`quick-filter-sort-option-${field}`}><Text>{sortLabels[field]}</Text></SelectItem>)}
      </SelectGroup></SelectContent>
    </Select>
    {draft.sort && <View testID="quick-filter-sort-direction" className="flex-row flex-wrap items-center gap-2">
      {(['asc', 'desc'] as const).map(dir => <Button key={dir} testID={`quick-filter-sort-direction-${dir}`}
        variant={draft.sort?.dir === dir ? 'default' : 'outline'} aria-pressed={draft.sort?.dir === dir}
        onPress={() => setDraft({ ...draft, sort: { ...draft.sort!, dir } })}><Text>{dir === 'asc' ? 'Ascending' : 'Descending'}</Text></Button>)}
    </View>}
    {preview !== null && <View className="gap-4">
      <Text testID="quick-filter-preview-count">{`${preview.length >= PREVIEW_LIMIT ? `${PREVIEW_LIMIT}+` : preview.length} products match on this device`}</Text>
      {preview.length === 0 && <Text testID="quick-filter-preview-empty">No products match right now. You can still save this button.</Text>}
      {preview.slice(0, 5).map((doc, i) => <Text key={i} testID={`quick-filter-preview-item-${i}`}>{doc.name}</Text>)}
    </View>}
    <View className="flex-row flex-wrap items-center gap-2">
      <Button variant="outline" testID="quick-filter-cancel" onPress={onCancel}><Text>Cancel</Text></Button>
      <Button testID="quick-filter-save" disabled={!isQuickFilterValid(draft)}
        onPress={() => onSave({ ...draft, label: draft.label.trim() })}><Text>Save</Text></Button>
    </View>
  </View>;
}
