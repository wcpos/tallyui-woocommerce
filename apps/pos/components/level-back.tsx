import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { Platform, View } from 'react-native';
import type { ViewProps } from 'react-native';

interface WebKeyProps extends ViewProps { onKeyDown: (event: KeyboardEvent<HTMLElement>) => void }

/**
 * WCPOS v2's LevelBack (pos/products/level-back.tsx), its web key handler only: Escape while focus is inside the
 * level goes back one step. It stops at the deepest wrapper, so a drill inside a level goes back one step per press.
 * Escape typed in a field (the table's search sits inside the level) is left to the field. No edge swipe here.
 */
export function LevelBack({ onBack, testID, children }: { onBack: () => void; testID: string; children: ReactNode }): JSX.Element {
  const keys: WebKeyProps = {
    onKeyDown: event => {
      if (event.key !== 'Escape') return;
      if (event.target instanceof Element && event.target.closest('input, textarea')) return;
      event.stopPropagation();
      onBack();
    },
  };
  return <View className="flex-1" testID={testID} {...(Platform.OS === 'web' ? keys as ViewProps : {})}>{children}</View>;
}
