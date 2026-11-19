import type { JSX, ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { ScaleProvider } from '@tallyui/components';
import { UI_SCALES } from '@tallyui/pos';
import type { UiScale } from '@tallyui/pos';

// Per-device density (v2 Settings > Theme > Scale, theme.tsx:157), Auto by default.
export const SCALE_SETTING_KEY = 'tallywoo.scale';
const listeners = new Set<() => void>();
let unsaved: UiScale | null = null; // A choice the storage refused holds for this session, as the theme's does.

/** The saved step; Auto for nothing saved, a value that is not a step (v2 theme.tsx:171) or a storage that throws. */
export function readScaleChoice(): UiScale {
  if (unsaved) return unsaved;
  try {
    const choice = localStorage.getItem(SCALE_SETTING_KEY);
    return (UI_SCALES as readonly (string | null)[]).includes(choice) ? choice as UiScale : 'auto';
  } catch {
    return 'auto';
  }
}

function setScaleChoice(next: UiScale): void {
  try {
    localStorage.setItem(SCALE_SETTING_KEY, next);
    unsaved = null;
  } catch {
    unsaved = next;
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useScaleChoice(): [UiScale, (next: UiScale) => void] {
  return [useSyncExternalStore(subscribe, readScaleChoice, readScaleChoice), setScaleChoice];
}

/** v2's ScaleProvider mount (contexts/scale/index.tsx): the step reaches every screen, the toaster and portals. */
export function ScaleSettingProvider({ children }: { children: ReactNode }): JSX.Element {
  const [scale] = useScaleChoice();
  return <ScaleProvider scale={scale}>{children}</ScaleProvider>;
}
