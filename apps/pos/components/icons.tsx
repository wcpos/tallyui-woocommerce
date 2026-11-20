// Glyphs drawn in more than one component: one definition each.
import { Circle, Path, Rect } from 'react-native-svg';
import { createSvgIcon } from '@tallyui/components';

// v2's `customer` glyph, tabler `user` (monorepo packages/components/scripts/icons/maps/tabler.json:38, src/icon/svg/tabler/customer.svg).
export const UserIcon = createSvgIcon('UserIcon', () => <Path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0-8 0M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />);

// v2's `check` glyph.
export const CheckIcon = createSvgIcon('CheckIcon', () => <Path d="M20 6 9 17l-5-5" />);
// v2's chevronLeft glyph.
export const ChevronLeftIcon = createSvgIcon('ChevronLeftIcon', () => <Path d="m15 18-6-6 6-6" />);
// v2's `chevronRight` glyph.
export const ChevronRightIcon = createSvgIcon('ChevronRightIcon', () => <Path d="m9 18 6-6-6-6" />);
// v2's `chevronDown` glyph (components/src/icon/svg/tabler/chevron-down.svg).
export const ChevronDownIcon = createSvgIcon('ChevronDownIcon', () => <Path d="m6 9 6 6 6-6" />);
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
// v2's tabler `register` glyph at its 1.5 stroke (monorepo packages/components/src/icon/svg/tabler/register.svg).
export const RegisterIcon = createSvgIcon('RegisterIcon', () => <>
  <Path d="M21 15h-2.5a1.503 1.503 0 0 0-1.5 1.5a1.503 1.503 0 0 0 1.5 1.5h1a1.503 1.503 0 0 1 1.5 1.5a1.503 1.503 0 0 1-1.5 1.5H17m2 0v1m0-8v1m-6 6H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2m12 3.12V9a2 2 0 0 0-2-2h-2" />
  <Path d="M16 10V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6m8 0H8m8 0h1m-9 0H7m1 4v.01M8 17v.01m4-3.02V14m0 3v.01" />
</>);
// v2's tabler `card` glyph at its 1.5 stroke (monorepo packages/components/src/icon/svg/tabler/card.svg).
export const CardIcon = createSvgIcon('CardIcon', () => <Path d="M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 2h18M7 15h.01M11 15h2" />);
// v2's tabler `product` glyph (components/src/icon/svg/tabler/product.svg).
export const BoxIcon = createSvgIcon('BoxIcon', () => <Path d="m12 3l8 4.5v9L12 21l-8-4.5v-9zm0 9l8-4.5M12 12v9m0-9L4 7.5" />);
export const PrintIcon = createSvgIcon('PrintIcon', () => <>
  <Path d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m10-8V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4" />
  <Path d="M7 15a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
</>);
// v2's tabler `pending` glyph (components/src/icon/svg/tabler/pending.svg).
export const ClockIcon = createSvgIcon('ClockIcon', () => <><Path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0" /><Path d="M12 7v5l3 3" /></>);
// v2's lucide `info` glyph (coupon status chip, EmptyState `empty`); @tallyui/components exports none.
export const InfoIcon = createSvgIcon('InfoIcon', () => <><Circle cx={12} cy={12} r={10} /><Path d="M12 16v-4" /><Path d="M12 8h.01" /></>);
// v2's tabler `lock` glyph (monorepo packages/components/src/icon/svg/tabler/lock.svg).
export const LockIcon = createSvgIcon('LockIcon', () => <><Path d="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
  <Path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0-2 0m-3-5V7a4 4 0 1 1 8 0v4" /></>);
// v2's `support` glyph, tabler's message-question (monorepo packages/components/scripts/icons/maps/tabler.json:108,
// path from packages/components/src/icon/components/tabler/support.tsx:14).
export const SupportIcon = createSvgIcon('SupportIcon', () => <Path d="M8 9h8m-8 4h6m0 5h-1l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v4.5M19 22v.01M19 19a2.003 2.003 0 0 0 .914-3.782 1.98 1.98 0 0 0-2.414.483" />);
// v2's tabler `category` glyph (monorepo packages/components/src/icon/svg/tabler/category.svg).
export const CategoryIcon = createSvgIcon('CategoryIcon', () => <Path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2" />);
// v2's tabler `currency` glyph (monorepo packages/components/src/icon/svg/tabler/currency.svg).
export const CurrencyIcon = createSvgIcon('CurrencyIcon', () => <><Path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0" />
  <Path d="M14.8 9A2 2 0 0 0 13 8h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-1.8-1M12 7v10" /></>);
// v2's tabler `warehouse` glyph (monorepo packages/components/src/icon/svg/tabler/warehouse.svg).
export const WarehouseIcon = createSvgIcon('WarehouseIcon', () => <><Path d="M3 21V8l9-4l9 4v13" />
  <Path d="M13 13h4v8H7v-6h6" /><Path d="M13 21v-9a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3" /></>);
// v2's tabler `tag` glyph (monorepo packages/components/src/icon/svg/tabler/tag.svg).
export const TagIcon = createSvgIcon('TagIcon', () => <><Path d="M6.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0-2 0" />
  <Path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592-5.592a2.41 2.41 0 0 0 0-3.408l-7.71-7.71A2 2 0 0 0 11.172 3H6a3 3 0 0 0-3 3" /></>);
// v2's `bookmark` and `arrowDown` glyphs, tabler (monorepo packages/components/src/icon/svg/tabler/{bookmark,arrow-down}.svg).
export const BookmarkIcon = createSvgIcon('BookmarkIcon', () => <Path d="M18 7v14l-6-4l-6 4V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4" />);
export const ArrowDownIcon = createSvgIcon('ArrowDownIcon', () => <Path d="M12 5v14m6-6l-6 6m-6-6l6 6" />);
// v2's `edit` and `filters` glyphs, tabler (monorepo packages/components/src/icon/components/tabler/{edit,filters}.tsx).
export const EditIcon = createSvgIcon('EditIcon', () => <><Path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1" />
  <Path d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97L9 12v3h3zM16 5l3 3" /></>);
export const FiltersIcon = createSvgIcon('FiltersIcon', () => <Path d="M12 6a2 2 0 1 0 4 0 2 2 0 1 0-4 0M4 6h8m4 0h4M6 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0m-2 0h2m4 0h10m-5 6a2 2 0 1 0 4 0 2 2 0 1 0-4 0M4 18h11m4 0h1" />);
