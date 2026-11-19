// v2's pointer (WCPOS monorepo `packages/components/src/lib/device.ts:51`): every list picks its touch row or its
// table row by it (list-frame/index.tsx:158), so a touch tablet at 1024 gets the rows a phone does.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export type Pointer = 'fine' | 'coarse';

/** v2's rule: on the web, 'fine' only when both `(pointer: fine)` and `(hover: hover)` match; it follows a change of
 *  either. Off the web it is always 'coarse', as v2's. Unlike v2, which reads 'coarse' with no window (its server
 *  snapshot), a web window without `matchMedia` reads 'fine': this app renders on the client, and only jsdom lacks it,
 *  where every test expects the table. */
export function usePointer(): Pointer {
  const queries = useMemo(() => {
    if (Platform.OS !== 'web') return null;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return [];
    return [window.matchMedia('(pointer: fine)'), window.matchMedia('(hover: hover)')];
  }, []);
  const subscribe = useCallback((notify: () => void) => {
    queries?.forEach(query => query.addEventListener('change', notify));
    return () => queries?.forEach(query => query.removeEventListener('change', notify));
  }, [queries]);
  const read = (): Pointer => !queries ? 'coarse' : queries.every(query => query.matches) ? 'fine' : 'coarse';
  return useSyncExternalStore(subscribe, read, read);
}
