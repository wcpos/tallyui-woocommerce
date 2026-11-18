// Glyphs drawn in more than one component: one definition each.
import { Path, Rect } from 'react-native-svg';
import { createSvgIcon } from '@tallyui/components';

// v2's `check` glyph.
export const CheckIcon = createSvgIcon('CheckIcon', () => <Path d="M20 6 9 17l-5-5" />);
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
// v2's tabler `plus` glyph at its 1.5 stroke (monorepo packages/components/src/icon/components/tabler/plus.tsx:14).
export const PlusIcon = createSvgIcon('PlusIcon', () => <Path d="M12 5v14m-7-7h14" />);
// v2's `more` glyph in its default set, tabler's dots-vertical (components/src/icon/svg/tabler/more.svg, sets.ts:14).
export const MoreIcon = createSvgIcon('MoreIcon', () => <><Path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0" />
  <Path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0" /><Path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0" /></>);
// v2's tabler `discount` glyph, drawn at stroke 1.5 (monorepo packages/components/src/icon/svg/tabler/discount.svg).
export const DiscountIcon = createSvgIcon('DiscountIcon', () => <><Path d="m9 15l6-6" />
  <Path d="M9 9.5a.5.5 0 1 0 1 0a.5.5 0 1 0-1 0m5 5a.5.5 0 1 0 1 0a.5.5 0 1 0-1 0" fill="currentColor" />
  <Path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0" /></>);
// v2's `delete` glyph in its default set, tabler's trash at its 1.5 stroke (components/src/icon/svg/tabler/delete.svg).
export const TrashIcon = createSvgIcon('TrashIcon', () => <Path d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />);
