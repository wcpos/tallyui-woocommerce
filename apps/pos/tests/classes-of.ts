import { screen } from '@testing-library/react';

// react-native-web drops className from the DOM, so read it off the component that took the testID (as products-screen.test).
type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber; alternate?: Fiber };
export function classesOf(testID: string): string[] {
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  const key = (prefix: string) => Object.keys(node).find(name => name.startsWith(prefix))!;
  const created = node[key('__reactFiber$')] as Fiber;
  let fiber: Fiber | undefined = created.memoizedProps === node[key('__reactProps$')] ? created : created.alternate;
  const found: string[] = [];
  for (; fiber; fiber = fiber.return) {
    const { className, testID: id } = fiber.memoizedProps ?? {};
    if (id === testID && typeof className === 'string') found.push(...className.split(/\s+/));
  }
  return found;
}

/** v2's table card in a window (data-table/surface.tsx `TableSurface`). */
export const CARD_CLASSES = ['rounded-lg', 'border', 'bg-card'];

/** The classes and numberOfLines on the components that draw `element` (a Text with no testID of its own): every
 * component fiber between its DOM node and the next DOM node up. */
export function textPropsOf(element: HTMLElement): { classes: string[]; numberOfLines: unknown } {
  const node = element as unknown as Record<string, unknown>;
  type TextFiber = { type?: unknown; memoizedProps?: { className?: unknown; numberOfLines?: unknown }; return?: TextFiber };
  let fiber = (node[Object.keys(node).find(name => name.startsWith('__reactFiber$'))!] as TextFiber).return;
  const classes: string[] = [];
  let numberOfLines: unknown;
  for (; fiber && typeof fiber.type !== 'string'; fiber = fiber.return) {
    const { className, numberOfLines: lines } = fiber.memoizedProps ?? {};
    if (typeof className === 'string') classes.push(...className.split(/\s+/));
    if (lines !== undefined) numberOfLines = lines;
  }
  return { classes, numberOfLines };
}
