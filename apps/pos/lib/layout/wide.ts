// v2's one layout boundary (WCPOS monorepo `packages/components/src/lib/device.ts`): a window at least
// 768 wide and 480 tall gets the rail; anything smaller gets the phone layout. There is no layout in between.
import { Platform, useWindowDimensions } from 'react-native';

/** v2 `device.ts`: 768 is the narrowest tablet where the register's two columns hold (every iPad but the mini in portrait). */
export const WIDE_MIN_WIDTH = 768;
/** v2 `device.ts`: a phone on its side is 844–932 wide but 390–430 tall; the shortest tablet on its side is 600. */
export const WIDE_MIN_HEIGHT = 480;

export function isWideWindow({ width, height }: { width: number; height: number }): boolean {
  return width >= WIDE_MIN_WIDTH && height >= WIDE_MIN_HEIGHT;
}

export function useIsWide(): boolean {
  const dimensions = useWindowDimensions();
  // v2 #505: RN-web's height follows the visual viewport, which an on-screen keyboard shrinks; the
  // layout viewport (window.innerHeight) does not.
  const web = Platform.OS === 'web' && typeof window !== 'undefined';
  const height = web ? window.innerHeight : dimensions.height;
  return isWideWindow({ width: dimensions.width, height });
}
