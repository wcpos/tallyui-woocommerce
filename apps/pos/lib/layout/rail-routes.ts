// The app rail's areas, in v2's rail order (WCPOS monorepo `apps/main/app/(app)/(drawer)/_layout.tsx`),
// with Logs after Store health as in drawer-content.tsx.
export type RailKey = 'pos' | 'orders' | 'customers' | 'reports' | 'health' | 'logs' | 'settings';

/** Top group, then foot group, in rail order. */
export const RAIL_TOP: readonly RailKey[] = ['pos', 'orders', 'customers', 'reports'];
export const RAIL_FOOT: readonly RailKey[] = ['health', 'logs', 'settings'];

export const RAIL_HREF: Record<RailKey, string> = {
  pos: '/catalogue', orders: '/orders', customers: '/customers', reports: '/reports',
  health: '/health', logs: '/logs', settings: '/settings',
};

export const RAIL_LABEL: Record<RailKey, string> = {
  pos: 'POS', orders: 'Orders', customers: 'Customers', reports: 'Reports',
  health: 'Store health', logs: 'Logs', settings: 'Settings',
};

const RAIL_KEYS: readonly RailKey[] = [...RAIL_TOP, ...RAIL_FOOT];

/** The area a pathname belongs to: an exact match or a match followed by '/'; null outside the areas. */
export function railKeyForPath(pathname: string): RailKey | null {
  return RAIL_KEYS.find(key => pathname === RAIL_HREF[key] || pathname.startsWith(`${RAIL_HREF[key]}/`)) ?? null;
}

export interface RailStep { method: 'push' | 'replace' | 'dismissTo'; href: string }

// catalogue.tsx pushes areas over the POS so the POS stays mounted and the cart survives; the rail keeps
// that: back to the POS dismisses to it, the POS pushes an area, and an area replaces an area, so the
// stack stays at most POS plus one area.
/** null when from === to; to 'pos' → dismissTo '/catalogue'; from 'pos' → push; otherwise replace. */
export function railNavigation(from: RailKey, to: RailKey): RailStep | null {
  if (from === to) return null;
  if (to === 'pos') return { method: 'dismissTo', href: RAIL_HREF.pos };
  if (from === 'pos') return { method: 'push', href: RAIL_HREF[to] };
  return { method: 'replace', href: RAIL_HREF[to] };
}
