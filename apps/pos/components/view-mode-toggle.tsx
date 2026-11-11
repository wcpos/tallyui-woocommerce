// v2's ViewModeToggle (WCPOS monorepo `packages/core/src/screens/main/pos/products/view-mode-toggle.tsx`):
// one icon button that shows the view it switches to.
import type { JSX } from 'react';
import { Path, Rect } from 'react-native-svg';
import { createSvgIcon, IconButton, Text, Tooltip, TooltipContent, TooltipTrigger } from '@tallyui/components';

// lucide `list`, v2's `viewList`.
const ListIcon = createSvgIcon('ListIcon', () => <>
  <Path d="M8 6h13" /><Path d="M8 12h13" /><Path d="M8 18h13" />
  <Path d="M3 6h.01" /><Path d="M3 12h.01" /><Path d="M3 18h.01" />
</>);
// v2's `viewGrid`, as browse-terms-view.tsx draws it.
const GridIcon = createSvgIcon('GridIcon', () => <>
  <Rect x={3} y={3} width={7} height={7} rx={1} /><Rect x={14} y={3} width={7} height={7} rx={1} />
  <Rect x={14} y={14} width={7} height={7} rx={1} /><Rect x={3} y={14} width={7} height={7} rx={1} />
</>);

export type CatalogueViewMode = 'grid' | 'table';

export function ViewModeToggle({ view, onChange }: { view: CatalogueViewMode; onChange(view: CatalogueViewMode): void }): JSX.Element {
  const label = view === 'table' ? 'Switch to grid view' : 'Switch to table view';
  return <Tooltip>
    <TooltipTrigger asChild>
      {/* h-11 w-11: v2's IconButton `size-ctl`, 44 px (monorepo packages/components/src/icon-button/index.tsx:26). */}
      <IconButton testID="view-mode-toggle" variant="ghost" className="h-11 w-11" accessibilityLabel={label}
        onPress={() => onChange(view === 'table' ? 'grid' : 'table')}>
        {view === 'table' ? <GridIcon size={20} className="text-foreground" /> : <ListIcon size={20} className="text-foreground" />}
      </IconButton>
    </TooltipTrigger>
    <TooltipContent><Text>{label}</Text></TooltipContent>
  </Tooltip>;
}
