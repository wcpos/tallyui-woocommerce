export type ToastType = 'success' | 'error' | 'info' | 'warning';
export interface ToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
  /** Reusing an id updates that toast in place and restarts its timer (v2 / sonner). */
  id?: string;
  /** Milliseconds before it closes itself; TOAST_DURATION_MS when omitted. */
  duration?: number;
}
export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType | 'default';
  duration: number;
}
// sonner's TOAST_LIFETIME, which v2 uses everywhere (added-to-cart-toast.ts states it as 4000).
export const TOAST_DURATION_MS = 4000;
// sonner's visibleToasts default.
export const MAX_VISIBLE_TOASTS = 3;

let toasts: ToastItem[] = [];
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let counter = 0;

export function toast(options: ToastOptions): string {
  const id = options.id ?? `toast-${++counter}`;
  const item: ToastItem = {
    id, title: options.title, description: options.description,
    type: options.type ?? 'default', duration: options.duration ?? TOAST_DURATION_MS,
  };
  const index = toasts.findIndex(existing => existing.id === id);
  toasts = index === -1 ? [item, ...toasts] : toasts.map((existing, i) => i === index ? item : existing);
  while (toasts.length > MAX_VISIBLE_TOASTS) {
    const oldest = toasts[toasts.length - 1];
    clearTimeout(timers.get(oldest.id));
    timers.delete(oldest.id);
    toasts = toasts.slice(0, -1);
  }
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => dismissToast(id), item.duration));
  listeners.forEach(listener => listener());
  return id;
}

export function dismissToast(id?: string): void {
  if (id !== undefined) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    if (!toasts.some(item => item.id === id)) return;
    toasts = toasts.filter(item => item.id !== id);
  } else {
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    if (!toasts.length) return;
    toasts = [];
  }
  listeners.forEach(listener => listener());
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getToasts(): readonly ToastItem[] {
  return toasts;
}
