import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { useIsWide } from '../../lib/layout/wide';

/** v2's `key` rank (components/src/text/ladder.ts:14): a property key, muted at 13 px. */
export const SETTINGS_KEY_CLASS = 'text-muted-foreground text-sm';
/** v2's `help` rank (text/ladder.ts:15). */
export const SETTINGS_HELP_CLASS = 'text-muted-foreground text-xs';

/**
 * v2 `SettingsSection` (settings/components/settings-section.tsx:30-39): the section heading, then the rows flat on
 * the page card, no box round them. A later section sits under a rule 16 below the last row (`-mt-1 pt-4` in the
 * pages' `gap-5`); `border-t` stands in for v2's `border-t-hairline`, as settings-area.tsx does.
 */
export function SettingsSection({ title, description, first, testID, children }: {
  title: string; description?: string; first?: boolean; testID?: string; children: ReactNode;
}): JSX.Element {
  return (
    <View testID={testID} className={first ? 'gap-1' : 'gap-1 border-t border-border -mt-1 pt-4'}>
      {/* v2 SectionHeading (section-heading/index.tsx:21): the `section` rank, `text-base font-strong` (600). */}
      {description !== undefined ? <View className="gap-0.5">
        <Text role="heading" aria-level={2} className="text-base font-semibold text-foreground">{title}</Text>
        <Text testID={testID && `${testID}-description`} className={SETTINGS_HELP_CLASS}>{description}</Text>
      </View> : <Text role="heading" aria-level={2} className="text-base font-semibold text-foreground">{title}</Text>}
      <View className="gap-0">{children}</View>
    </View>
  );
}

/**
 * v2 `PropertyRow` in a `wide` list (property-row/index.tsx:146-221): key · value · trailing on one 44 line, the
 * muted key in a 256 / 288 column, the value in one 320 column. On a phone (v2 `useIsPhone`, the app's `!useIsWide`)
 * the key stacks above the value and the trailing words wrap under it.
 */
export function SettingsField({ testID, label, help, trailing, children }: {
  testID: string; label: string; help?: string; trailing?: ReactNode; children?: ReactNode;
}): JSX.Element {
  const line = useIsWide();
  return (
    <View testID={testID} className={line ? 'min-h-11 flex-row items-center gap-3 py-1' : 'min-h-11 gap-1 py-1'}>
      <View testID={`${testID}-key`} className={line ? 'min-h-9 w-64 shrink-0 justify-center lg:w-72' : 'min-h-9 justify-center'}>
        <Text testID={`${testID}-label`} className={SETTINGS_KEY_CLASS}>{label}</Text>
        {help ? <Text className={SETTINGS_HELP_CLASS}>{help}</Text> : null}
      </View>
      {/* v2 l.187-194: a control with no value (a switch) sits at the start of the value column. */}
      <View className={line ? 'min-w-0 flex-1 max-w-80 items-start' : 'min-w-0 items-start'}>{children}</View>
      {trailing ? <View className="shrink-0 flex-row flex-wrap items-center gap-2">{trailing}</View> : null}
    </View>
  );
}
