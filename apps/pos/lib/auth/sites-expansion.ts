// Port of monorepo packages/core/src/screens/auth/components/sites-expansion.ts.
export interface SitesExpansion { homes: string[]; expanded: string | undefined }

/** v2 getNextExpandedSiteUuid: a newly added site opens; '' (all folded) stays folded;
 *  an open site that is still listed stays open; otherwise the first site opens. */
export function getNextExpandedSiteHome(previous: string[], current: string[], expanded: string | undefined): string {
  const added = current.find(home => !previous.includes(home));
  if (added !== undefined) return added;
  if (expanded === '') return '';
  if (expanded !== undefined && current.includes(expanded)) return expanded;
  return current[0] ?? '';
}

/** v2 getNextAccordionState: the same object when `homes` equals `state.homes` element by element,
 *  else `{ homes, expanded: getNextExpandedSiteHome(state.homes, homes, state.expanded) }`. */
export function getNextExpansion(state: SitesExpansion, homes: string[]): SitesExpansion {
  if (homes.length === state.homes.length && homes.every((home, index) => home === state.homes[index])) return state;
  return { homes, expanded: getNextExpandedSiteHome(state.homes, homes, state.expanded) };
}
