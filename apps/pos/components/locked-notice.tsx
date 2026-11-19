import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { LOCKED_COPY, type TillLock } from '../lib/sale/till-lock';
import { InfoIcon, LockIcon } from './icons';

/** v2's products-locked-notice (pos/products/index.tsx:539-550): Notice tone info, a card band (notice/index.tsx, lib/tone.ts:46),
 *  `lock` while closed and `info` while counting. @tallyui/components has no Notice. */
export function LockedNotice({ lock }: { lock: TillLock }) {
  if (!lock) return null;
  const [glyph, Glyph] = lock === 'counting' ? ['info', InfoIcon] as const : ['lock', LockIcon] as const;
  return <View testID="products-locked-notice" role="status" aria-live="polite"
    className="flex-row flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
    <Glyph testID={`products-locked-notice-${glyph}`} size={18} className="text-foreground" />
    <Text testID="products-locked-notice-title" className="min-w-0 flex-1 font-medium text-foreground">{LOCKED_COPY[lock]}</Text>
  </View>;
}
