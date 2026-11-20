import { useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Popover, PopoverContent, PopoverTrigger } from '@tallyui/components';
import type { CatalogueEntry } from '@tallyui/pos';
import type { ProductTraits, VariantOptionGroup } from '@tallyui/core';
import { VariationPicker } from './variation-picker';

/**
 * v2's inline variationsStyle in grid view (tiles/variable-product-tile.tsx:23-25, tiles/inline-variable-tile.tsx:154-262):
 * the variable product's tile opens a popover holding the variation picker, and Add closes it (:143-151).
 */
export function InlineVariableTile({ doc, entries, groups, currency, traits, tile, onAdd }: {
  doc: any; entries: CatalogueEntry<any>[]; groups: VariantOptionGroup[]; currency: string; traits: ProductTraits<any>;
  tile: ReactNode; onAdd(entry: CatalogueEntry<any>): void;
}): JSX.Element {
  const id = traits.getId(doc);
  const [open, setOpen] = useState(false);
  const trigger = useRef<View>(null);
  const panel = useRef<View>(null);
  const close = () => setOpen(false);

  // Web: a press outside the tile and the panel, or Escape, dismisses it (TallyUI 3.18's PopoverContent has neither)
  // (remove with TallyUI #829).
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const inside = (target: EventTarget | null) => [trigger.current, panel.current]
      .some(node => (node as unknown as Element | null)?.contains(target as Node));
    const onPointerDown = (event: Event) => { if (!inside(event.target)) close(); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // v2 opens it side="right"; TallyUI 3.20.1's PopoverContent places only top or bottom (gap noted).
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pressable ref={trigger} accessibilityRole="button" testID={`variable-product-tile-${id}`}>{tile}</Pressable>
      </PopoverTrigger>
      <PopoverContent ref={panel} align="center" className="w-auto max-w-80 p-2" testID={`variations-popover-${id}`}>
        <VariationPicker variant="popover" entries={entries} groups={groups} currency={currency} traits={traits}
          onSelect={entry => { onAdd(entry); close(); }} onClose={close} />
      </PopoverContent>
    </Popover>
  );
}
