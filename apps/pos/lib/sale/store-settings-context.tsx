import { createContext, memo, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MoneyFormatProvider, minorUnitDigits } from '@tallyui/core';
import type { StoreSettingsState } from '@tallyui/pos';
import { useSession } from '../auth/session-context';
import { StoreMoneyContext, type StoreMoney } from '../money/store-money';
import type { Session } from '../auth/session';
import { useTillStoreSettings } from './use-till-store-settings';

// No session: nothing is fetched. `loading` is the only StoreSettingsState member that claims nothing about a store.
const NO_STORE: StoreSettingsState = { state: 'loading' };

const StoreSettingsContext = createContext<StoreSettingsState | null>(null);

// The state the fetcher last handed up, tagged with the site it belongs to.
interface Held { url: string; store: StoreSettingsState }

// Hosts the one useTillStoreSettings call. It is keyed by the site, so a store switch starts it afresh, and it renders
// nothing: the app's tree is the provider's sibling, so signing in or out never remounts the catalogue or the stack.
// Memoised on what useTillStoreSettings reads (the site and the access token), so handing its state up doesn't render it
// again: only a new token or its own state does.
const StoreSettingsFetch = memo(function StoreSettingsFetch({ session, onState }: {
  session: Session; onState: (held: Held | undefined) => void;
}) {
  const store = useTillStoreSettings(session);
  const url = session.site.wcposApiUrl;
  useEffect(() => { onState({ url, store }); }, [url, store, onState]);
  useEffect(() => () => { onState(undefined); }, [onState]);
  return null;
}, (before, after) => before.onState === after.onState
  && before.session.site.wcposApiUrl === after.session.site.wcposApiUrl
  && before.session.tokens.accessToken === after.session.tokens.accessToken);

/**
 * The store's settings, fetched once per signed-in site for every screen, and its money format for every
 * `@tallyui/components` money display below it, as v2's use-currency-format.tsx does for its components.
 */
export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const url = session?.site.wcposApiUrl;
  const [held, setHeld] = useState<Held | undefined>(undefined);
  // A state handed up for another site (or before sign-out) is never shown, even for the commit before it clears.
  const store = url !== undefined && held?.url === url ? held.store : NO_STORE;
  const money = store.state === 'ready' ? store.settings.moneyFormat : undefined;
  const currency = store.state === 'ready' ? store.settings.currency : undefined;
  // One object while the store's format reads the same, so a settings refresh doesn't re-render every money display:
  // compared field by field, not by the settings object.
  // Never fewer places than the currency's ISO digits. This departs from v2, which rounds its arithmetic to the store's
  // decimals: this till keys and rounds amounts at ISO digits (the connector warns "the till rounds CUR to ISO
  // digits"), so showing fewer places would hide recorded amounts. More places than ISO stay as the store asks.
  const storeMoney = useMemo<StoreMoney | undefined>(() => {
    if (!money || !currency) return undefined;
    const digits = minorUnitDigits(currency);
    return { currency, format: { ...money, decimals: Math.max(money.decimals ?? digits, digits) } };
  }, [currency, money === undefined, money?.position, money?.thousandSeparator, money?.decimalSeparator, money?.decimals, money?.symbol]);
  return (
    <>
      {session ? <StoreSettingsFetch key={url} session={session} onState={setHeld} /> : null}
      <StoreSettingsContext.Provider value={store}>
        {/* The same clamped format for the @tallyui/components displays, so they agree with the app's own. */}
        <MoneyFormatProvider format={storeMoney?.format}>
          <StoreMoneyContext.Provider value={storeMoney}>{children}</StoreMoneyContext.Provider>
        </MoneyFormatProvider>
      </StoreSettingsContext.Provider>
    </>
  );
}

/** The signed-in store's settings from `StoreSettingsProvider`; `loading` while signed out. */
export function useTillStoreSettingsState(): StoreSettingsState {
  const store = useContext(StoreSettingsContext);
  if (!store) throw new Error('useTillStoreSettingsState needs a StoreSettingsProvider above it');
  return store;
}
