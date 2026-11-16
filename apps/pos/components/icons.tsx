// Glyphs drawn in more than one component: one definition each.
import { Path, Rect } from 'react-native-svg';
import { createSvgIcon } from '@tallyui/components';

// v2's chevronLeft glyph.
export const ChevronLeftIcon = createSvgIcon('ChevronLeftIcon', () => <Path d="m15 18-6-6 6-6" />);
// v2's `chevronRight` glyph.
export const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Path d="m9 18 6-6-6-6" />);
// v2's `folder` glyph.
export const FolderIcon = createSvgIcon('FolderIcon', () => <>
  <Path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
</>);
// v2's `viewGrid` glyph.
export const GridIcon = createSvgIcon('GridIcon', () => <>
  <Rect x={3} y={3} width={7} height={7} rx={1} /><Rect x={14} y={3} width={7} height={7} rx={1} />
  <Rect x={14} y={14} width={7} height={7} rx={1} /><Rect x={3} y={14} width={7} height={7} rx={1} />
</>);
