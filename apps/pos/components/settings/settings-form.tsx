import { createContext, useCallback, useContext, useEffect, useState, type JSX, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { useIsWide } from '../../lib/layout/wide';
import { CheckIcon } from '../icons';

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
export function SettingsField({ testID, label, help, trailing, indent, name, children }: {
  testID: string; label: string; help?: string; trailing?: ReactNode; indent?: boolean; name?: string; children?: ReactNode;
}): JSX.Element {
  const line = useIsWide();
  const savedName = useContext(SavedFieldContext).name;
  const marked = name !== undefined && savedName === name;
  // v2 property-row/index.tsx:150-178: stacked, or with help, the mark follows the key on its line (the help wraps under).
  const keyLine = marked && (!line || !!help);
  const mark = marked && <Mark name={name} />;
  return (
    <View testID={testID} className={line ? 'min-h-11 flex-row items-center gap-3 py-1' : 'min-h-11 gap-1 py-1'}>
      {/* v2 property-row/index.tsx:166: indent adds pl-4 to the key column. */}
      <View testID={`${testID}-key`} className={(line ? 'min-h-9 w-64 shrink-0 lg:w-72' : 'min-h-9') + (keyLine ? ' flex-row flex-wrap items-center justify-start gap-x-2' : ' justify-center') + (indent ? ' pl-4' : '')}>
        <Text testID={`${testID}-label`} className={SETTINGS_KEY_CLASS}>{label}</Text>
        {/* One line, no help: a zero-height anchor after the key, so the mark hangs under it and the row never moves. */}
        {marked && !keyLine ? <View className="h-0 self-start overflow-visible"><View className="absolute top-0 left-0">{mark}</View></View> : mark}
        {help ? <Text className={SETTINGS_HELP_CLASS + (keyLine ? ' basis-full' : '')}>{help}</Text> : null}
      </View>
      {/* v2 l.187-194: a control with no value (a switch) sits at the start of the value column. */}
      <View className={line ? 'min-w-0 flex-1 max-w-80 items-start' : 'min-w-0 items-start'}>{children}</View>
      {trailing ? <View className="shrink-0 flex-row flex-wrap items-center gap-2">{trailing}</View> : null}
    </View>
  );
}

const SavedFieldContext = createContext({ name: '', markSaved: (_names: string[]) => {} });
/** v2 form/saved-mark.tsx:21: the mark holds this long, then clears; a newer write replaces it and restarts the hold. */
const SAVED_HOLD_MS = 1200;

export function SavedFieldProvider({ children }: { children: ReactNode }): JSX.Element {
  const [saved, setSaved] = useState({ name: '' });
  const markSaved = useCallback((names: string[]) => { if (names.length) setSaved({ name: names[names.length - 1] }); }, []);
  useEffect(() => {
    if (!saved.name) return;
    const timer = setTimeout(() => setSaved({ name: '' }), SAVED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [saved]);
  return <SavedFieldContext.Provider value={{ name: saved.name, markSaved }}>{children}</SavedFieldContext.Provider>;
}

export const useMarkSaved = (): ((names: string[]) => void) => useContext(SavedFieldContext).markSaved;

/** v2 saved-mark.tsx:53-58: only the keys whose value really changed, compared as strings, so an echo is not acknowledged. */
export const savedKeys = (before: object, patch: object): string[] => Object.keys(patch).filter(key =>
  String((before as Record<string, unknown>)[key] ?? '') !== String((patch as Record<string, unknown>)[key] ?? ''));

// v2 SavedMark (saved-mark.tsx:95-108): a check and "Saved" in the help rank, both in the success ink.
const Mark = ({ name, label = 'Saved' }: { name?: string; label?: string }): JSX.Element => (
  <View testID={`saved-${name}`} className="h-5 flex-row items-center gap-1">
    <CheckIcon testID={`saved-${name}-icon`} size={12} className="text-success" />
    <Text testID={`saved-${name}-label`} className={SETTINGS_HELP_CLASS.replace('text-muted-foreground', 'text-success')}>{label}</Text>
  </View>
);

// v2 SavedMark's `label`: "Restored" after a restore (general.tsx:414).
export const SavedMark = ({ name, label }: { name: string; label?: string }): JSX.Element | null =>
  useContext(SavedFieldContext).name === name ? <Mark name={name} label={label} /> : null;
