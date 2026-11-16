// The cashiers signed in on this device, per store (`site.home`), as SessionProvider keeps them (session-context.tsx).
import type { Session } from './session';

export type Roster = Record<string, Session[]>;

/** The store's roster without that cashier. */
export function withoutCashier(roster: Roster, home: string, uuid: string): Roster {
  return { ...roster, [home]: (roster[home] ?? []).filter(entry => entry.tokens.user.uuid !== uuid) };
}

/** After a sign-in completes. Adding a cashier puts `next` at the end, or replaces their entry in place. Any other
 *  sign-in drops `next` and `kept` from the list, then appends `kept`: a re-auth that came back as someone else keeps
 *  the held cashier. */
export function rosterAfterSignIn(roster: Roster, next: Session, add: boolean, kept?: Session): Roster {
  const others = roster[next.site.home] ?? [];
  const index = others.findIndex(entry => entry.tokens.user.uuid === next.tokens.user.uuid);
  return { ...roster, [next.site.home]: add
    ? index === -1 ? [...others, next] : others.map((entry, i) => i === index ? next : entry)
    : [...others.filter(entry => entry.tokens.user.uuid !== next.tokens.user.uuid
      && entry.tokens.user.uuid !== kept?.tokens.user.uuid), ...(kept ? [kept] : [])] };
}

/** After switching to `uuid`: they leave the list, and the cashier switched away from (if any) joins its end. */
export function rosterAfterSwitch(roster: Roster, home: string, uuid: string, previous: Session | null): Roster {
  const others = (roster[home] ?? []).filter(entry => entry.tokens.user.uuid !== uuid);
  return { ...roster, [home]: previous ? [...others, previous] : others };
}

/** The other cashiers on the current session's store; none without a session. */
export function otherCashiers(roster: Roster, session: Session | null): Session[] {
  return session ? (roster[session.site.home] ?? []).filter(entry => entry.tokens.user.uuid !== session.tokens.user.uuid) : [];
}
