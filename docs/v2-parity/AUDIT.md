# v2 parity audit: TallyUI WooCommerce POS against WCPOS 2.0.0

Written 2026-11-10. **Target:** WCPOS 2.0.0, which shipped on 2026-11-09:
`~/Projects/monorepo` `main` at `5ac185b0e` (`apps/main` and `packages/*`).
**This app:** `main` at `f34ffcf` on TallyUI `3.12.0`. Both apps were
read, not run, apart from the screenshots below.

This audit replaces the status column of [PARITY.md](../PARITY.md), which
was written on 2026-09-28 against monorepo `next`. Where the two disagree,
this file wins. The rows that PARITY.md got wrong are listed under
"Corrections" in each section.

**Status:**
- `present`: a cashier would not notice a difference.
- `partial`: the feature exists but differs in behaviour or UI.
- `missing`: the feature does not exist.

**Gap class:**
- `app-local`: buildable in `apps/pos` on TallyUI 3.12.0 as it is.
- `shared:<pkg>`: needs a TallyUI package change; the function is named.
- `connector`: needs `@tallyui/connector-woocommerce` work on a WooCommerce
  or WCPOS route.
- `server`: needs a WCPOS v2 plugin route that the dev store's plugin
  (Free 1.10.20) may lack.

When a row lists several classes, the blocking one comes first.

## Areas at a glance

| v2 area | Status here | Blocking class | Section |
|---|---|---|---|
| Redrawn shell (drawer and rail, one register bar, area navigation, phone tabs) | missing | app-local | [Shell](#ui-shell-settings-i18n-layout-auth-status-health-and-logs) |
| Scale and Fonts display settings, the ten themes | missing | shared:@tallyui/theme and @tallyui/components (scale and font tokens that components size from) | Shell |
| Settings area (General, Tax, Theme, Printing, Card readers, Customer display, Barcode scanning) | missing | app-local (pages), connector (more StoreSettings fields) | Shell |
| Translations | missing (v2 has no RTL either) | shared: a new @tallyui/i18n, and keyed component strings | Shell |
| Connect, login, cashier switch, multi-store, capability gates | partial | app-local; server (Pro) for multi-store | Shell |
| Online status, toasts, session hold banner, update gates | missing or partial | app-local | Shell |
| Store health (Database, Performance, Logs, Registers panel) | partial (emails panel only) | app-local; shared:@tallyui/pos (log sink) | Shell |
| Tender pane (keypad, quick cash, change, method tiles) | partial | app-local; connector (payment-methods descriptors) | [Checkout](#checkout-and-payments) |
| Split payments (manual legs, even/amount/percent plan, split by item) | partial (manual legs only) | app-local | Checkout |
| Payment ledger, server payment rows, voids | missing | server, then connector | Checkout |
| Offline cash sales and outbox | partial (outbox present; offline copy and card refusal missing) | app-local | Checkout |
| Card readers and terminals, tips, order-pay webview | missing | server, then connector | Checkout |
| Order note and meta, per-gateway status, quick-discount coupon | missing | shared:@tallyui/pos, connector, server | Checkout |
| Registers (server list, picker, binding) | missing or partial (one local register) | connector (`GET registers`), server | [Registers](#registers-closures-and-reports) |
| Register sessions: opening float, pay in/out, count at close, variance | partial (local only; no reason chips, override, blind or overdue) | connector (session transport), shared:@tallyui/components | Registers |
| Numbered closures, X and Z, reprint, recount | partial (local numbers and print) | connector, server | Registers |
| Reports (period, comparison, chips, till strip, cards, panels, print) | partial (today on this till) | app-local for most; connector or server for templates and history | Registers |
| Order history (list, search, filters, detail, reopen, edit, delete) | partial (list only) | app-local (search, detail); connector (filters, writes) | [Orders](#orders-refunds-receipts-printing-and-customer-display) |
| Refunds and the refund document | missing | connector (refund transport) | Orders |
| Receipt screen (server upgrade, zoom, templates, PDF, copy marks) | partial | app-local (zoom, print, copy rule); server (templates, PDF) | Orders |
| Printing (thermal, routing, cloud, drawer kick) | missing | shared: a new printer package | Orders |
| Email receipts and their queue | partial | app-local | Orders |
| Customer display | missing | server (Pro), shared:@tallyui/pos | Orders |
| Catalogue (poster tiles, drill-in variations, attribute pickers, browse by, in-cart count) | partial | app-local (TallyUI 3.12.0 already ships the pickers) | [Catalogue](#catalogue-cart-tax-customers-and-sync-v2-parity-audit) |
| Scanning (settings, sounds, test, devices, camera) | partial (keyboard wedge only) | app-local; shared scanner package for devices | Catalogue |
| Cart (open-order tabs, keypad quantity, split line, decimal quantity, stock guard, line edit) | partial | shared:@tallyui/pos for split, decimals and the guard; app-local for tabs and keys | Catalogue |
| Tax (address-based, settings page, rates viewer) | partial (store address only) | app-local pages; connector (full rate table) | Catalogue |
| Customers (offline search, address, edit, tax IDs, Customers screen) | partial | connector, shared:@tallyui/core | Catalogue |
| Sync engine (collections, change signal, write path, status UI) | partial | connector | Catalogue |

## Screenshots

See [Screenshots](#screenshots-1) at the end, which shows this app's
screens beside v2's where each could be captured.

## Build order for this app (top down, app-local first)

Wave 1 (in progress, one PR each, in parallel):
- tender pane with keypad and quick cash
- Reports till strip and session card
- Orders search
- online status and the Offline badge
- email queue retry and back-off
- Settings area with the General page

Wave 2:
- drawer shell and one register bar
- ledger pane and split plan
- variation pickers and drill-in
- order detail
- receipt zoom and paper-width print
- Tax and Theme (System/Light/Dark) settings pages
- toaster
- session hold banner
- closures list and panel
- comparison and chips on Reports

Wave 3:
- split by item
- receipt paid moment and auto print
- scanner settings and sounds
- open-order tabs
- quick % keys
- Customers screen (read-only)
- Logs ledger
- health Database page
- connect discovery states

## Shared needs, by package

Each need is listed once, with the area that needs it. The detail is in each
section's "Shared needs" list.

- **@tallyui/theme**
  - scale tokens with `resolveStep` and `scaleVariables` (Scale)
  - font-family tokens and bundled faces (Fonts)
  - eight more palettes and `THEME_RULES` (Theme)
- **@tallyui/components**
  - components sized from the scale tokens, with `POINTER_FLOORS`
  - keyed or `t`-able strings
  - `Toaster` with `toast()`
  - `NavRail` and `NavItem`
  - `StatusBadge` and `SegmentedControl`
  - `MovementSheet` reason chips
  - `ApproveSheet`, `RecountSheet`, `ClosureList`, `ClosurePanel`, `SessionCard`, `TillStrip`, `ReportPanel`
  - `RegisterPicker` status lines
  - `OrdersList` (day headings, more cells, sort)
  - `RefundSheet`
  - `PosterTile`
  - `TenderKeypad` and `SplitPlan` (optional)
- **@tallyui/i18n** (new): `TranslationsProvider`, `useT`, a remote loader for the `wcpos/translations` set
- **@tallyui/pos**
  - `useSale().setNote`, `setMeta` and `setStatus`
  - method ids and capture modes in place of `'cash' | 'external'`
  - `Payment.status` and `tipMinor`
  - `useSale.splitLine`
  - decimal quantities
  - stock guard with `preventOverselling`
  - `useSale.updateLine` and a richer `addCustomLine`
  - address-based tax matching
  - order addresses and a tax-ID snapshot
  - `stampSaleProvenance`
  - `recordCorrection`
  - report figure helpers
  - `buildRefundReceiptData`
  - load a `StoreOrder` into `useSale` (Reopen)
  - `CurrencyProvider` format options
  - persisted `LogSink`
  - `mintQuickDiscountCode`
  - payment driver interface
  - customer-display client, snapshot and peer
  - money-divergence report
- **@tallyui/printer** (new, a port of `@wcpos/printer`)
  - encoder and web transports (ePOS, WebPRNT, WebUSB, WebBluetooth)
  - `resolvePrinter`
  - drawer kick
  - cloud adapter
  - virtual printer
- **@tallyui/receipt-renderer** (new, a port of `@wcpos/receipt-renderer`): Mustache HTML and thermal XML to ESC/POS and ePOS
- **@tallyui/scanner** (new, a port of `@wcpos/scanner`): HID, serial and BLE decoders
- **@tallyui/core**
  - `StoreSettings` gains the tax display, number format, register settings, timezone and address fields
  - `ListOrdersQuery` filters
  - `StoreOrder.cashierId`, `registerId` and `createdVia`
  - `StoreOrderRefund` gains lines, `refundedBy` and the register
  - `Customer` gains addresses and `taxIds`
  - `listRegisters` and `getRegister`
- **@tallyui/database**: per-collection coverage and storage footprint
- **@tallyui/connector-woocommerce**
  - **payments:** `paymentMethods()` (descriptors); the payments transport (record, void, intent, status, bootstrap); gateway submit and cancel, and the order-pay link; per-gateway order status
  - **orders:** `customer_note` and `meta_data` in order.create; `_wcpos_*` provenance meta; quick-discount coupon line; `updateOrder` and `deleteOrder`; refund transport (`order.refund` to `wcpos/v2/orders/{id}/refunds`) and `capabilities.orderRefund`; open orders held as `pos-open`
  - **registers:** register, session, movement and closure transport; `ServerCapabilities.register`; `approveSession`; closures read and `recountClosure`; `registersHealth`
  - **receipts:** `getReceipt` and `receiptPdf`; templates sync
  - **catalogue:** stock reconcile adapter; term feeds (categories, tags, brands); product writes; `cost_of_goods_sold` and `meta_data`; online barcode resolve; change signal
  - **customers:** customers replication; `updateCustomer`
  - **store settings:** full tax rates, `tax_based_on`, tax display settings, number format and `prevent_overselling`; multi-store `/stores` and the store id on every route

**Server, to check on the dev store:** v2's routes (`payment-methods`,
`orders/{id}/payments`, `registers`, `sessions`, `closures`, `receipts`,
`templates`, `orders/{id}/refunds`) need the WCPOS 2.0 plugin. The dev store
runs Free 1.10.20, and the plugin floor moves with the TallyUI connector.
It is also not yet confirmed whether the 2.0 `/status` advertises
`order_create_v5`, which gates fees, shipping and custom items here.


## UI shell, settings, i18n, layout, auth, status, health and logs

The v2 target is monorepo `main` at 5ac185b0e. This app means `apps/pos` in the tallyui-woocommerce worktree. Corrections to `docs/PARITY.md` come after the table.

| Area | v2 behaviour (key monorepo paths) | This app (paths) | Status | Gap class | What is needed |
|---|---|---|---|---|---|
| Shell: drawer and rail | `apps/main/app/(app)/(drawer)/_layout.tsx`: expo-router Drawer. On phones it is a `front` drawer 200 wide; wider screens get a `permanent` icon rail, width from `useRailWidth()` (64 at Regular). Order: register, products, orders, coupons, customers, reports, health (pushed to the bottom), settings, support. One `DrawerContent` in `packages/core/src/screens/main/components/drawer-content/`, icon-only rail with web tooltips. Each screen draws its own bar (`headerShown: false`). | `app/_layout.tsx` is a Stack. Navigation is a flex-wrap row of buttons in `components/catalogue-view.tsx` (Orders, Reports, Store health). | missing | app-local; shared:@tallyui/components (`NavRail`/`NavItem`) | Add an expo-router `(drawer)` group with rail and front presentations, and move the routes under it. `@react-navigation/drawer` is not in `apps/pos/package.json`. |
| Shell: rail extras | Health item carries an unread-error badge (`apps/main/components/unread-logs.tsx`, watermark persisted). Cashier entry on the rail. `drawer-content/version.tsx` shows About/version. | none | missing | app-local (needs Logs first) | Version footer now; the badge once logs are persisted. |
| Shell: register bar | `pos/cart/register-bar.tsx`: menu button (`pos-drawer-open-button`), store name (`register-bar-store`), place (`register-bar-place`), status pill (`register-bar-pill`), then `BarControls` (`components/bar-controls/`): Offline badge, bell, cashier avatar. | `catalogue-view.tsx` header: store name, cashier button, ViewToggle, Product settings, Orders, Reports, Store health. `components/register-controls.tsx` renders TallyUI `RegisterBar` only when register sessions are on. | partial | app-local | One bar on every screen: menu, store, place, pill, Offline, avatar. Drop the button row once the drawer exists. |
| Shell: area navigation (Settings, Health) | `components/navigation-area/` (LEDGER): wide screens get a persistent page rail and the area root redirects to its default page. Narrow screens get a tappable index, and leaf pages a back bar. Each leaf is one card (`AreaPage`). On lg the area has no page bar, bell or Offline badge. | `health.tsx` is a single page with a Back button. No settings. | missing | app-local (`SettingsLayout` navSlot/contentSlot/breakpoint exists in 3.12.0) | An `AreaLayout` built on `SettingsLayout` plus nav data like `apps/main/components/area-navigation/{settings,health}.ts`. |
| Shell: phone tabs | `apps/main/components/pos-phone-tab-bar.tsx`: a Products/Cart tab bar in the `(tabs)` group beside `(columns)`. | `components/sale-screen.tsx` under 900 px: cart opens with "Back to products", plus `CartBar` and a Parked (n) button. | partial | app-local | A bottom tab bar under the split threshold (see layout row). |
| Shell: session hold banner | `components/session-hold-banner/` (LEDGER 1): sits under every bar. Copy: `auth.session_expired_*`, `auth.sales_waiting_to_sync_*`, `auth.session_renewed_automatically`. Sales keep queueing while the session is held. | `lib/auth/session-context.tsx:46`: `SessionExpiredError` calls `clearSession()` and the cashier is thrown back to connect. | missing | app-local | Hold the session instead of clearing it, show the banner and a re-auth action, and keep the outbox. |
| Shell: update gates | `apps/main/components/update-required.tsx` (`gate.update_app.*`), `upgrade-required.tsx` (`gate.update_plugin.*`). | `WooTillUpdateRequiredError` is exported by the connector. No screen found in the app. | missing | app-local | A gate screen when the plugin is too old or the app is too old, with v2 copy. |
| Shell: support page | `packages/core/src/screens/main/support/index.tsx`: Discord and docs links. | none | missing | app-local | A static page. |
| Theme: appearance | `packages/core/src/screens/main/settings/theme.tsx` tiles: System, Light, Dark, Ocean, Sunset, Monochrome, Paper, Warm, Bold, Market, each with a description. `packages/components/src/lib/themes.ts` `THEME_RULES` (typeSet, icons, traits, dark rail). `contexts/theme-setting` calls `Uniwind.setTheme`. | `global.css` imports `@tallyui/theme/tokens.css` (light/dark variants only). No theme setting. | missing | shared:@tallyui/theme (eight more `@variant` palettes and `THEME_RULES`); app-local for System/Light/Dark | Now: a System/Light/Dark switch via `Uniwind.setTheme`. The other eight need palettes in `@tallyui/theme`. |
| Theme: Scale | `packages/components/src/lib/scale.ts` `SCALE_STEPS`: nine tokens (`--spacing`, `--text-base`, `--spacing-ctl`, `--spacing-row`, `--spacing-tile`, `--radius`, `--text-amt`, `--text-xs`, `--text-2xs`) for compact/regular/spacious. `POINTER_FLOORS` 44/24. Auto is compact under 640 and spacious from 1600. `MAX_FONT_SCALE` 1.3. `packages/core/src/contexts/scale/index.tsx` uses `ScopedVariables`, mirrors the tokens to `document.documentElement` on web, and auth screens get Auto. Segmented control `settings-scale-<x>`, persisted per store. | none: `tokens.css` has no density tokens and the components use fixed sizes. | missing | shared:@tallyui/theme (scale tokens, `resolveStep`, `scaleVariables`); shared:@tallyui/components (components must read the tokens) | Blocking: TallyUI components must size from tokens. App-local alone gains nothing. |
| Theme: fonts | `packages/components/src/lib/fonts.ts`: DM Sans, Instrument Serif, JetBrains Mono, Space Grotesk, Fraunces, Manrope as bundled ttf. Setting auto/system/instrument/grotesk/fraunces/manrope with a "Total" sample. | none | missing | shared:@tallyui/theme (font tokens and assets); app-local `expo-font` | Font-family tokens consumed by `Text`, then the setting. |
| Theme: icons | `theme.tsx` Icons: auto/tabler/hugeicons/phosphor, with sample glyphs. | TallyUI `Icon`/`createSvgIcon`, one set. | missing | shared:@tallyui/components (icon-set switch) | Low priority. |
| Settings: area | `apps/main/app/(app)/(drawer)/settings/(pages)/`: general, tax, printing, card-readers, customer-display, barcode-scanning, theme, plus `(modals)/mini-app/[id]`. Nav `area-navigation/settings.ts` (`settings-nav-*`), default `/settings/general`. LEDGER: no Save button, every change writes immediately. | No settings route. The only settings-like controls are `RegisterSwitch` under the cart and `catalogue-display-options.tsx`. | missing | app-local | A `settings/` route group with the area layout. |
| Settings: General, Store | `screens/main/settings/general.tsx`: store name, base country, state, city, postcode, all read-only with "Set in WooCommerce" links. | `lib/catalogue/store-info.ts` reads `{id, name, currency, locale}` from `/stores`. | missing | connector (more `/stores` fields: address); app-local display | Read the address fields from `wcpos/v1/stores` and show them read-only. |
| Settings: General, Localization | Language (`components/language-select.tsx`, name plus native name, `hooks/use-locale/locales.json`), Default customer, "Default customer is cashier". | Customer default is guest only (`customer-picker.tsx`). | missing | shared:@tallyui/i18n (Language); app-local (default customer) | The default-customer pair is app-local now. Language waits on i18n. |
| Settings: General, Currency and numbers | Currency, currency position, decimal separator, number of decimals, thousand separator, thousands group (thousand/lakh/wan). | `CurrencyProvider{currencyCode, locale}` (`@tallyui/pos`) formats with Intl. No position, separator or decimals override. | missing | shared:@tallyui/pos (`CurrencyProvider` format options); connector (`wooStoreSettings` → currency_pos, separators, num_decimals) | The store's Woo number format must reach the formatter, or every price can read differently from v2. |
| Settings: Restore and Clear | "Restore server settings" with a confirm dialog. Danger zone "Clear all local data" (also `apps/main/components/clear-local-data-on-startup.tsx`). | Only Restore inside Product settings. | missing | app-local | A Danger zone card that drops the DB and session, with v2 copy. |
| Settings: Tax | `settings/tax.tsx`: Calculate tax based on (shipping/billing/base). Read-only rows: enable taxes, prices entered with tax, shipping tax class, round at subtotal (roadmap#256, #1970). Display: tax totals single/itemized, shop and cart incl/excl, price suffix. "View all tax rates" opens `(modals)/tax-rates`. | `components/store-settings-gate.tsx` loads `StoreSettings` (pricesIncludeTax, taxRates, taxRoundAtSubtotal, shippingTaxClass). Nothing shown. | missing | app-local (read-only rows and rates list from `StoreSettings`); shared:@tallyui/core `StoreSettings` + connector `wooStoreSettings` (tax_based_on, tax_display_shop/cart, tax_total_display, price_display_suffix) | Read-only page now. The display options need the new fields, and they change cart and receipt display. |
| Settings: Printing | `settings/(pages)/printing/`, `printer/`: printer list, Add, Set default, Test print, Delete, setup copy report. Templates: receipt, closure, report, thermal. Cloud printers, print dialog, "Managed by WCPOS". | `injectPrintStyle` / browser print only. | missing | see Printing area audit | Cross-reference only. |
| Settings: Card readers | `settings/(pages)/card-readers`: Bluetooth, smart and Tap to Pay readers; connect, forget, update. Tap to Pay setup gated on `manage_woocommerce` (fails closed). | none | missing | see Payments area audit | Cross-reference only. |
| Settings: Customer display | `settings/(pages)/customer-display`: pairing code, display URL, paired list, forget. Pro. | none | missing | server (WCPOS Pro pairing routes) | Out of scope until Pro. |
| Settings: Barcode scanning | `settings/(pages)/barcode-scanning`. Scanning: average-time threshold, minimum length, prefix, suffix. Sound: success, failure, haptic, theme checkout/classic/soft, volume. Scanner: keyboard, HID-POS, USB serial, BLE, Bluetooth SPP, register device. Test panel with chart and suggestions. | see Scanner area audit | missing | see Scanner area audit | Cross-reference only. |
| Translations | `packages/core/src/contexts/translations/index.tsx`: i18next. English `locales/en/core.json` (~3.2k keys) bundled. Other languages from jsDelivr `wcpos/translations@<ver>/translations/js/<lang>/monorepo/<ns>.json` (`rxdb-backend.ts`), cached in the user DB. Locale comes from General → Language. | Hard-coded English in every component. TallyUI components ship English strings. | missing | shared:@tallyui/i18n (`TranslationsProvider`, `useT`, keyed strings in components); app-local wiring | Blocking: TallyUI component strings must take keys or a `t`. Reuse v2 `core.json` keys so the WCPOS translation set applies. |
| RTL | None in v2: no `I18nManager`, `rtl:` or `writingDirection` under `apps/main` or `packages`. | none | present (parity) | — | Nothing for parity. |
| Layout: cart side | `pos/cart/ui-settings-form.tsx`: Cart left / Cart right (`pos_cart.cart_left/right`) in Cart settings. Also openOrdersPosition top/bottom, sortLines (newest_bottom/newest_top/name/price, fees and shipping last), quickDiscounts, autoShowReceipt, autoPrintReceipt. | `catalogue-display-options.tsx` has Panel position (`panel-position-left/right`) inside Product settings. No cart settings dialog. | partial | app-local | A Cart settings dialog holding cart side and sortLines. The other options belong to the Cart and Receipt audits. |
| Layout: products width | `pos/columns/pos-columns.tsx` (LEDGER): slot-driven columns. Products position reverses panel order. Width persists only after the user resizes. Complementary defaults, minimum size. Checkout fades over 180 ms. Split from 640 (phone tabs below that). | `sale-screen.tsx`: `PanelResizeHandle`, split at ≥ 900. | partial | app-local | Split at 640 like v2, persist width only after a resize, minimum size. |
| Layout: slots | `packages/core/src/extensions/slots/README.md`: internal registry v1 with `pos.columns.panel`, `pos.cart.bar`, `pos.products.filter-bar.item`. | none | missing | app-local (internal) | Cashier-invisible. Lowest priority. |
| Connect: discovery | `packages/core/src/screens/auth/connect.tsx` with `url-input`. Discovery states: finding your store, checking WordPress, checking WCPOS, saving (`use-url-discovery`, `use-api-discovery`). Errors carry a coded docs link. | `app/connect.tsx`: one card "Connect to your store", a Store URL field and Continue, which goes to the plugin sign-in. Errors: state_mismatch, missing_token, no_pending. | partial | app-local | Staged discovery states and coded error links. |
| Connect: sites and users | `auth/components/sites`, `site`, `wp-users`/`wp-user` (users listed per site), `add-user-button`, "Connect another store", `demo-button` (demo.wcpos.com). | One site only. Saved cashiers per site in `lib/auth/session.ts` (`loadCashiers`). | partial | app-local | A site list with users per site and add/remove. Demo is optional. |
| Login (OAuth/JWT) | `use-login-handler`, `use-site-connect`. | `app/auth/callback.tsx`, `lib/auth/session.ts` refresh every 5 minutes. | present | — | — |
| Store select / multi-store | `auth/components/store-select`: natural sort; a store-bound register skips the picker. `pos/cart/use-switch-store.ts` needs online. | `fetchStoreInfo` takes the first store from `/stores`. | missing | server (WCPOS Pro multi-store `/stores`); connector (store id in `SyncContext` for every route) | Picker when `/stores` returns more than one. Blocked on Pro on the dev store. |
| Cashier switch (user sheet) | `pos/cart/user-sheet.tsx` (843 lines), a right sheet `DialogContent side size="lg"`: your sales today, drawer figure (in the drawer / counting), open carts per user, awaiting store. "Hand the till to" band; store band with Switch store; register band with Switch register. Foot: WordPress admin link, Desktop app link, Sign out. | `components/cashier-sheet.tsx`: "Cashier: name" (`register-bar-avatar`), Dialog `user-sheet` with Switch to X (`user-sheet-user-<uuid>`), Remove (v2 confirm copy), Another account, Sign out. | partial | app-local (sales today from `pos_orders`, WP admin link, side sheet); shared:@tallyui/pos (open carts per user) | Add the sales-today figure, drawer figure when sessions are on, WP admin link, side-sheet presentation. |
| Register switch | User-sheet register band, `RegisterPicker`. | `registerName` "This till", `multiRegister={false}`. | missing | see Registers area audit | Cross-reference only. |
| Capability gating | `screens/main/hooks/user-capabilities` → `deriveUserCapabilities`. Extra gates: `manage_woocommerce_pos` (`register-gate-card.tsx`), `manage_woocommerce_pos_closures` (recount), `manage_woocommerce` (Tap to Pay). | `lib/auth/capabilities.ts` has v2's eleven gates, unknown fails closed. Only `createCustomersBlockedReason` is used (`customer-picker.tsx`). | partial | app-local | Apply each gate where v2 applies it: refunds, discounts, price edit, register open/close, orders. |
| Online status | `packages/hooks/src/use-online-status.web.tsx`: `offline` / `online-website-unavailable` / `online-website-available`. Starts from `navigator.onLine`, listens to online/offline and visibilitychange, runs `check-website-reachability.ts` (passive-first pulse), and confirms Unavailable only after `website-unavailable-confirmation.ts`. `online-status-logger.tsx` logs transitions. Offline `StatusBadge` (warning tone, the one word "Offline" for both states) on every bar. | `register-controls.tsx`: `online={!outbox.enabled \|\| outbox.state.lastRetryReason !== 'network'}`, shown only when sessions are on. | partial | app-local | `useOnlineStatus` provider plus an Offline badge in every bar. |
| Toasts | `packages/components/src/toast/` (sonner web, sonner-native): `toast()` API, update by id, test IDs. `contexts/merchant-toast.ts` maps error codes to a translated summary and action. | No toasts. Messages are inline lines (`catalogue-view.tsx` status and message lines). | missing | shared:@tallyui/components (`Toaster` + `toast()` queue; 3.12.0 has only static `Toast` parts); app-local stopgap | App-local toaster on `Toast`/`ToastTitle` with a context queue. Then the merchant error map. |
| Notifications bell | `notification-bell/` (Novu, right panel). | none | missing | out of scope (PARITY) | — |
| Single-tab gate | `apps/main/components/live-tab-gate.web.tsx`, `parked-tab.tsx`. | `LiveTabScreen` is in 3.12.0. App use not confirmed in this pass. | partial (unverified) | app-local | Check `_layout.tsx` mounts the live-tab gate on web. |
| Health: Database | `app/(app)/(drawer)/health/`: index redirects to `/health/database`. `screens/main/health/database.tsx`: coverage and window per collection, Sync now, Clear & redownload, stuck records. Panels: `AttentionPanel`, `ConflictedMutationsPanel`, `RejectedMutationsPanel`, `QueuedEmailsPanel`, `RegistersPanel`. Also `use-storage-footprint`. | `components/health-screen.tsx` (21 lines): Back, "Store health", `QueuedEmailsPanel` only. | partial | app-local (rejected outbox entries, Sync now via catalogue context); shared:@tallyui/database (per-collection coverage and footprint) | Collection rows plus rejected and conflicted mutations from the outbox. |
| Health: Performance | `apps/main/components/health/performance-screen.tsx`: check frequency eco/balanced/custom, pace, trend line, uptime strip. | none | missing | app-local (after online status) | Feed it from reachability checks. |
| Health: Logs | `screens/main/logs/` (`ledger.tsx`, `row-detail`, `use-log-stats`, `use-verbose-diagnostics`). Levels action/debug/error/info/sync/warn. Presets all/errors/sync/actions. Columns time, level, event, status, took. Errors and events today, copy/share debug, verbose on/off. | No logs screen. `@tallyui/pos` `createLogger`/`callbackSink`/scoped loggers exist but no sink is attached. | missing | shared:@tallyui/pos (persisted `LogSink` and a log collection schema); app-local stopgap | App-local: a `callbackSink` writing a capped local collection plus a ledger screen. |

### Corrections to `docs/PARITY.md`
- **Online status:** "app" should read partial. The pill only shows when register sessions are on.
- **Settings:** "pos: store settings" should read missing. There is no settings screen at all.
- **Translations:** a gap, but v2 has no RTL either.
- **Logs:** "pos: logging" covers the logger only. There is no sink and no UI.
- **Cart side:** v2 puts it in Cart settings, and v2 splits at 640, not 900.
- **Cashier switch:** the row is right as far as it goes. It misses sales today, the drawer figure, the store and register bands, and the WP admin link.

### Buildable now (top-down, one PR each)

1. **Drawer shell.**
   - Add `@react-navigation/drawer` (Expo-pinned) and move the routes into `apps/pos/app/(drawer)/_layout.tsx` (`catalogue`, `orders`, `reports`, `health`, `settings`, `support`).
   - Add `components/drawer-content.tsx`: rail vs front, icon tooltips, version footer.
   - Remove the nav buttons from `components/catalogue-view.tsx`.
   - Copy from: `apps/main/app/(app)/(drawer)/_layout.tsx` and `packages/core/src/screens/main/components/drawer-content/` (including `version.tsx`). Tests in `apps/pos/tests/`, never under `app/`.
2. **Online status and Offline badge.**
   - Add `lib/online/use-online-status.ts` with three states, passive-first, and confirmation before Unavailable.
   - Add `components/offline-badge.tsx`; use it in the `register-controls.tsx` `online` prop and in every bar.
   - Copy from: `packages/hooks/src/use-online-status.web.tsx`, `check-website-reachability.ts`, `website-unavailable-confirmation.ts`, `components/bar-controls/`.
3. **One register bar.**
   - Add `components/register-bar-shell.tsx`: menu, store, place, pill, Offline, avatar, using v2 testIDs (`pos-drawer-open-button`, `register-bar-store`, `register-bar-place`, `register-bar-pill`). Shown whether or not register sessions are on.
   - Copy from: `packages/core/src/screens/main/pos/cart/register-bar.tsx`.
4. **Session hold banner.**
   - Change `lib/auth/session-context.tsx` to hold the session on `SessionExpiredError` instead of clearing it; add `components/session-hold-banner.tsx`.
   - Copy from: `components/session-hold-banner/` and the `auth.session_*` strings in `locales/en/core.json`.
5. **Settings area skeleton.**
   - Add `app/(drawer)/settings/_layout.tsx` and `components/area-layout.tsx` on `SettingsLayout`, with nav data like `area-navigation/settings.ts` (testIDs `settings-nav-*`).
   - Add a General page: store name, currency, locale read-only with "Set in WooCommerce" links, plus a Danger zone "Clear all local data".
   - Copy from: `components/navigation-area/`, `settings/general.tsx`.
6. **Theme page (System/Light/Dark only).**
   - Add `app/(drawer)/settings/theme.tsx` and `lib/theme/theme-setting.tsx` (`Uniwind.setTheme`, persisted).
   - Copy from: `settings/theme.tsx`, `contexts/theme-setting`.
7. **Tax page, read-only.**
   - Add `app/(drawer)/settings/tax.tsx` with rows from `StoreSettings` (pricesIncludeTax, taxRoundAtSubtotal, shippingTaxClass) and a tax-rates modal from `taxRates`.
   - Copy from: `settings/tax.tsx`, `(modals)/tax-rates`.
8. **Cart settings and layout.**
   - Add `components/cart-display-options.tsx`: Cart left/right moved out of `catalogue-display-options.tsx`, plus sortLines.
   - In `sale-screen.tsx`: split at 640, persist width only after a resize, minimum size.
   - Copy from: `pos/cart/ui-settings-form.tsx`, `pos/columns/pos-columns.tsx` and its LEDGER.
9. **Phone tab bar.**
   - Add `components/phone-tab-bar.tsx` (Products/Cart) in `sale-screen.tsx` under 640.
   - Copy from: `apps/main/components/pos-phone-tab-bar.tsx`.
10. **Toaster.**
    - Add `components/toaster.tsx` (context queue, update by id, auto-dismiss) on TallyUI `Toast`/`ToastTitle`/`ToastDescription`/`ToastClose`. Move the transient lines in `catalogue-view.tsx` and the sync errors to it.
    - Copy from: `packages/components/src/toast/`, `contexts/merchant-toast.ts`.
11. **User sheet enrichment.**
    - In `components/cashier-sheet.tsx`: side sheet, "Your sales today" from local `pos_orders`, drawer figure when sessions are on, "Hand the till to" band label, WordPress admin link.
    - Copy from: `pos/cart/user-sheet.tsx`.
12. **Capability gates applied.**
    - Use `lib/auth/capabilities.ts` reasons at the refund, discount, price-edit, register and orders entry points.
    - Copy from: `screens/main/hooks/user-capabilities`, `register-gate-card.tsx`.
13. **Health area and Database page.**
    - Add `app/(drawer)/health/{_layout,database,logs}.tsx`.
    - Database page: catalogue and customer collection counts, Sync now, rejected outbox entries next to `QueuedEmailsPanel`.
    - Copy from: `area-navigation/health.tsx`, `screens/main/health/database.tsx` (`RejectedMutationsPanel`, `AttentionPanel`).
14. **Logs ledger.**
    - Add `lib/logs/log-store.ts`: a `callbackSink` on the `@tallyui/pos` scoped loggers writing a capped local collection.
    - Add `app/(drawer)/health/logs.tsx`: level filter, presets, columns time/level/event/status/took, copy debug. Then the unread-error badge on the Health item.
    - Copy from: `screens/main/logs/ledger.tsx`, `use-log-stats`, `apps/main/components/unread-logs.tsx`.
15. **Connect discovery states.**
    - In `app/connect.tsx`: staged states (finding your store, checking WordPress, checking WCPOS, saving), coded docs links, saved-site list with users per site.
    - Copy from: `screens/auth/connect.tsx`, `components/url-input`, `sites`, `wp-users`, `use-url-discovery`.
16. **Update-required gates and Support page.**
    - Add `components/update-required.tsx`, mapped from `WooTillUpdateRequiredError`, and `app/(drawer)/support.tsx`.
    - Copy from: `apps/main/components/update-required.tsx`, `upgrade-required.tsx`, `screens/main/support/index.tsx`.

### Shared needs

- `@tallyui/theme`: scale tokens (`--spacing`, `--text-base`, `--spacing-ctl`, `--spacing-row`, `--spacing-tile`, `--radius`, `--text-amt`, `--text-xs`, `--text-2xs`) plus `resolveStep`/`scaleVariables`. Why: the v2 Scale setting (compact/regular/spacious/auto) cannot exist without them.
- `@tallyui/components`: size every control, row and tile from the scale tokens, with `POINTER_FLOORS`. Why: tokens alone change nothing while components hard-code sizes.
- `@tallyui/theme`: the eight extra theme palettes (Ocean, Sunset, Monochrome, Paper, Warm, Bold, Market) and `THEME_RULES`. Why: the v2 Appearance tiles.
- `@tallyui/theme`: font-family tokens and the bundled faces (DM Sans, Instrument Serif, JetBrains Mono, Space Grotesk, Fraunces, Manrope). Why: the v2 Fonts setting and the per-theme type sets.
- `@tallyui/i18n` (new): `TranslationsProvider`, `useT`, a remote language loader with cache. Why: v2 is fully translated through the `wcpos/translations` set.
- `@tallyui/components`: every built-in string takes a key or `t`. Why: the app cannot translate component copy it does not own.
- `@tallyui/components`: `Toaster` and an imperative `toast()` with update-by-id. Why: 3.12.0 has only static `Toast` parts, and v2's merchant errors are toasts.
- `@tallyui/components`: `NavRail`/`NavItem` (icon rail with tooltip and badge), `StatusBadge`, `SegmentedControl`, `TileGrid`. Why: the v2 shell, Offline badge and theme page.
- `@tallyui/pos`: `CurrencyProvider` format options (position, decimal and thousand separators, decimals, lakh/wan grouping). Why: prices must match the store's Woo number format, as on v2 General.
- `@tallyui/core` + `@tallyui/connector-woocommerce`: `StoreSettings` and `wooStoreSettings` gain tax_based_on, tax_display_shop/cart, tax_total_display, price_display_suffix, currency_pos, separators, num_decimals and store address. Why: the v2 General and Tax pages, and incl/excl display.
- `@tallyui/pos`: a persisted `LogSink` and a log collection schema with stats. Why: the v2 Logs ledger and the unread-error badge, shared across platform apps.
- `@tallyui/database`: per-collection coverage and storage footprint. Why: the v2 Health Database page.
- `@tallyui/connector-woocommerce`: a multi-store `/stores` listing and store id threaded through `SyncContext`. Why: the v2 store picker and Switch store. Server side it needs WCPOS Pro.


## Checkout and payments

v2 (monorepo `main` 5ac185b0e) against this app (TallyUI 3.12.0).

`~/Projects/tallyui/docs/v2-parity/PLAN.md` does not exist yet, so no shared unit names are reused here.

Short forms in the tables:
- `M` is `monorepo/packages/core/src/screens/main/pos`
- `CO` is `M/checkout`
- `TU` is `apps/pos/node_modules/@tallyui`
- `SS` is `apps/pos/components/sale-screen.tsx`

| Area | v2 behaviour (key monorepo paths) | This app (paths) | Status | Gap class | What is needed |
|---|---|---|---|---|---|
| Checkout surface: layout | Two panes: the ledger (balance, legs, remaining) and the tender (method tiles, entry, keypad, commit). On a phone it collapses to a single pane. Paths: `CO/tender/tender-pane.tsx` (1148 lines), `CO/tender/ledger-pane.tsx` (296), `CO/tender/use-tender-flow.ts` (1849). Route: `apps/main/app/(app)/(drawer)/(pos)/(modals)/cart/[orderId]/checkout.tsx`. e2e: `apps/main/e2e/checkout-tender.spec.ts` "renders the tender checkout with the order balance", "on a phone". | `SS` (tender stage) renders `TU/components/src/sale/tender.tsx` (38 lines) or `split-tender.tsx` (81 lines): one column with cash/card buttons and a text input. | partial | app-local | Build a two-pane `TenderPane` + `LedgerPane` in `apps/pos/components/checkout/` on `tenderReducer`/`initTenderState` (`TU/pos/src/tender/tender-state.ts`, exported but unused). |
| Method tiles | Tiles come from `PaymentMethodDescriptor`s (`CO/tender/tiles.ts`): known capture modes only, `checkout-tile-skeleton` while loading, `checkout-unavailable-{id}` with a reason, `checkout-method-{id}`. Copy: "Choose how the customer is paying". Source: `/payment-methods` via `M/../contexts/extra-data/provider.tsx:85`. | Two fixed methods, `'cash' \| 'external'` (`TU/pos/src/sale/use-sale.ts` `SaleStage`). The connector maps them to `pos_cash`/`pos_card` (`TU/connector-woocommerce/src/commands/transport.ts`). | missing | connector, then server | Connector: read `GET wcpos/v2/payment-methods` into the descriptor type (`order-math/src/payments/types.ts`). Server: that route (plugin v2; the dev store runs 1.10.20). Until then, show two static tiles. |
| Keypad and entry | Integer minor units shift in from the right, capped at `MAX_TENDER_MINOR` 999999999. Test ids: `checkout-keypad`, `checkout-entry`, `checkout-commit`, with Back and clear. Copy: "Take {amount} in {method}", "Full balance {amount}". | None: a free text `CashTendered` / `split-tender-amount`. | missing | app-local | Build the keypad on the reducer's `key`/`set-entry`/`back` actions (`TU/pos/src/tender/tender-state.ts`). Shared component optional (see Shared needs). |
| Quick cash amounts | Exact balance plus the next 5/10/50 above it: `checkout-quick-{amount}`, "Exact {amount}". | None. | missing | app-local | Use `quickTenderedAmounts` from `@tallyui/pos`. |
| Change due | Excess cash is change, never an overpayment. Shown as "Change {amount}" on the tender pane and the ledger. A method that cannot give change refuses an over-tender (`checkout-refused`; e2e "refuses an over-tender on a method that cannot give change"). Cash rounding: `CO/cash-rounding-hook.ts`, `checkout-rounded-from`. | `ChangeDisplay` in `tender.tsx`. The receipt has a "Change" row (`TU/components/src/sale/receipt.tsx:88`). No refusal for card, no rounding. | partial | app-local, then connector | Use `changeMinor` from the reducer and the refusal for `external`. Rounding needs descriptor `defaults.rounding` (connector). |
| Receipt as the last stage | `CO/receipt-stage/receipt-stage.tsx` (319 lines): `receipt-paid-banner`/`receipt-paid-disc`, "Paid with" (`receipt-paid-with`), "Printed to" (`receipt-printed-to`), auto-print when the setting is on, `receipt-awaiting-store` while offline, then "Print receipt · New sale" (`receipt-close`). Replays never print or kick (`CO/sale-completion.ts:582`). | `SS` receipt stage: `Receipt` (window.print, "New sale") + `ReceiptIdentity` + `ReceiptEmail`. Legs print as "Cash tendered"/"Card terminal". | partial | app-local | Add the paid banner, Paid with, an awaiting-store mark from the outbox state, and an auto-print setting. "Printed to" waits on M11 printing. |
| Split: manual legs | Two or more legs taken one after another. The ledger shows `checkout-leg-{id}` and `checkout-ledger-remaining`; the server records each leg. e2e: "splits a payment across two tenders and the server records both legs". | `SplitTender` with `addTender`/`removeTender`, gated by `multiplePayments` (`order_payments_list`). Legs go as meta `_woocommerce_pos_payments` in one `push/orders` (`transport.ts`). | partial | app-local | Rebuild the leg list as `LedgerPane` rows. The transport already carries up to 20 legs. |
| Split plan: even / amount / percent | `checkout-split-chip` → `checkout-split-ways` ("{ways} ways"), `checkout-plan`, `checkout-plan-leg-{i}`, `checkout-percent-{v}`, `checkout-share`, `checkout-the-rest`. Paths: `CO/tender/split-module.ts`, `split-view.ts`, `tender-figures.ts`. e2e: "splits evenly from the Split chip", "an amount typed is one payment and the rest pays it off", "a percent share is one payment", "an amount plus an even split of the rest". | None. | missing | app-local | Use `planLegs`, `activePlan`, `evenSplitShareMinor` and the `open-split`/`set-split-tab`/`set-plan`/`clear-plan`/`arm-custom` actions. |
| Split by item | "Pick items" (`checkout-pick-items`), `checkout-line-{key}-pick`, unit steppers (`CO/tender/unit-stepper.tsx`). Cancelling a leg frees its units. e2e: "picked units plus an amount is one payment", "shares picked units between two payments", "cancelling one payment from the done pill frees what it paid for". | None. | missing | app-local, then shared:@tallyui/pos | The reducer has `toggle-split-line`/`pickedLineIds`. It needs a stable line key and a per-line gross from the sale (`useSale` cart lines); confirm they are exposed. Units already picked by earlier legs need a shared helper if they are not in `tender-state.ts`. |
| Payment ledger: rows | Each leg is a server `PaymentRow` (pending/authorized/captured/failed/voided) with `tip`, method and reference. Recorded through `CO/payments/record-manual-payment.ts` to `orders/{id}/payments`. Totals: `checkout-ledger-totals`. Cancelled rows: `checkout-payment-{i}-cancelled`. | Local `Payment {id, method, amountMinor, tenderedMinor?, changeMinor?, reference?}` (`TU/pos/src/order/types.ts:135`), sent once at completion. No row status. | missing | server, then connector | Server: `POST wcpos/v2/orders/{id}/payments` (plugin v2). Connector: a payments transport (record, then `orders/{id}/payments/{row}/void`). Shared: `Payment.status`. |
| Descriptors and capture modes | `CaptureMode` is manual/webview/server/device/stored_value/gateway, plus capabilities (`amount.partial`, `change`, `tips`, `offline`, `void`) and defaults (`order_status`, `rounding`, `open_drawer`). Paths: `order-math/src/payments/types.ts`, `CO/tender/tiles.ts:123-198`. | None. Two hardcoded behaviours. | missing | connector, then server | As for method tiles. The app must also branch the commit by `capture.mode`. |
| Stored value / gateway (Send invoice) | `capture.mode` gateway: `CO/payments/submit-gateway-payment.ts` uses `orders/{id}/payment-methods/{m}/submit` and `/cancel`, with declared fields (`CO/tender/declared-fields*`). e2e: "sends an invoice, sends it again from Orders, then cancels it from Orders". | None. | missing | server, then connector | Server: the submit/cancel routes. Connector: those transports. App: a declared-fields form. |
| Offline cash sale | Cash with `offline: 'record'` is taken offline. The ledger shows "Recorded offline · settles later" (`checkout-offline`). The receipt shows `receipt-awaiting-store`; the store adopts the sale on reconnect. e2e: `apps/main/e2e/checkout-offline-tender.spec.ts` (3 tests). | The outbox (`apps/pos/lib/sale/outbox-context.tsx`, `order-transport.ts`) queues `push/orders` and replays on reconnect. `SyncStatus` shows "N waiting to sync" under the cart. The receipt has no awaiting mark. | partial | app-local | Add an awaiting-store mark on the receipt from the outbox entry state, and the "Recorded offline" ledger copy. |
| Offline card / "No connection" | Any method that is not `record` is refused offline: "No connection" / "Payments need one; the sale is saved in your open orders." The till keeps the sale and returns to the register (e2e "keeps a sale rung up offline and goes back to the register"). | Card (`external`) can be "approved" offline: the cashier types a reference and it queues. | missing | app-local | Gate `external` on connectivity and show v2's copy. Divergence to rule on: a typed terminal reference is a manual record, which v2 lets a `record` method do. |
| Completion journal and replay | The journal is written before money moves and replayed at session start, with no drawer, print or haptic on replay (`CO/sale-completion.ts`, `CO/completion-journal-bridge.tsx`). e2e: "a cashier who moves on before the link returns still has the sale adopted, with no phantom receipt", "reloading mid-capture completes once". | The outbox replays finalized orders. Write-once `tender_voids` (`apps/pos/lib/sale/tender-voids.ts`). There is no journal for an in-flight tender. | partial | app-local | The journal matters only once legs move money before completion (server legs). Today a sale is atomic, so this is deferred until the ledger rows land. |
| Cancel / void mid-split | `CO/tender/cancel-payment-view.tsx`: "Cancel this payment?", lists the cash to return, voids the leg via `orders/{id}/payments/{row}/void` (e2e "cancels mid-split, listing the cash to return, and voids the leg"). | `apps/pos/components/cancel-payment-view.tsx` (port) + `tender_voids` journal (`SS`). | partial | server | UI matches. The server void route is missing (the local journal only, see `docs/PLAN.md` M10). |
| Server terminal capture | Server mode: `CO/payments/server/server-leg.ts` (574 lines) with `orders/{id}/payments/{row}/<route>`, plus `services/terminal-payments/service.ts:155` `payment-methods/{id}/bootstrap`. `CO/tender/terminal-leg-view.tsx`: Sent → On terminal → Approved → Captured. Reader picker: `checkout-reader-change`, `reader-connection.tsx`. e2e `checkout-terminal.spec.ts`: approve, decline then retry as a new row, cancel as a request where a late capture wins, deadline void, resume with no second intent, a reader held by another order. | "Card terminal: {total}" + "Terminal reference" + "Payment approved on terminal" (`tender.tsx`), all manual. | missing | server, then connector | Server: the bootstrap and payment row intent/status/void routes (Pro). Connector: a terminal transport. App: the terminal leg view. This is the first card path that works on web. |
| Device readers (Stripe Terminal, SumUp, Tap to Pay) | `apps/main/lib/payment-drivers/{stripe-terminal,sumup}/driver.ts` (580/347 lines), `apps/main/modules/sumup-reader`, `CO/payments/device/device-leg.ts` (`orders/{id}/payments/{row}/intent\|status\|void`). The `driver.web.ts` files return `available: false, reason: 'web'`. | None. | missing (n/a on web) | server, then shared:@tallyui/pos, then connector | Native only (M11). It needs a shared driver interface, plus the server routes as for server terminals. |
| Tips | On the reader only: `tipEligibleMinor` (`use-tender-flow.ts:1073`). The ledger shows "Tip: {amount}" (`checkout-leg-tip-{id}`). `tips: 'at_till'` is declared but has no UI. | None. | missing | server, then connector | Follows the terminal and device legs. Nothing for the till to build in v2's shape. |
| Legacy order-pay webview | The fallback for gateways without the contract: `CO/tender/legacy-tab.tsx` (`checkout-legacy-process-payment`; "legacy_not_with_split"), `CO/pay-page/use-pay-frame.ts`, `CO/components/payment-webview.tsx`. It loads `wcpos-checkout/order-pay/{id}?token=`. e2e `pos-checkout.spec.ts`: "uses the legacy webview for built-in POS gateways...", "falls back to the legacy webview when supports_checkout=false", "should disable payment when the server omits the payment link". | None. | missing | connector, then server | The order must exist on the server first (a `push/orders` pending status plus the order's pay link). Iframe and third-party cookie limits come from a hosted origin (`docs/PLAN.md` M9 risk; spike). Copy `pay-page-message.ts` for the `wcpos-process-payment` / `wcpos-session-expired` messages. |
| Cash drawer at tender | The printer profile's `autoOpenDrawer` kicks the drawer with the receipt (`packages/printer/src/printer-service.ts:275,511,575`). An "Open drawer" button (`openDrawer`, l.425) and a No Sale movement (`M/cart/movement-sheet.tsx:77`). No kick on replay. Descriptor `defaults.open_drawer` is unused on the client. | None (`closure-print.tsx` only labels `no_sale`). | missing | shared:@tallyui/pos (printer) | Wait for the M11 printer service (an ESC/POS drawer kick on the web printer). A No Sale movement may already be in `MovementSheet`; check it. |
| Per-gateway order status | `order-math/src/payments/derive.ts:143` uses `descriptor.defaults.order_status ?? 'completed'`; `record-manual-payment.ts:142`. Legacy checkout uses `settled_order_status`. `PosOrderStatus` adds 'pos-open' and 'pos-partial'. | `status: 'completed', set_paid: true` is hardcoded (`transport.ts` `toWooOrderPayload`). PARITY.md says "n/a (server)". That is wrong: the client picks the status in v2. | missing | connector, then server | Connector: take the status from the primary leg's descriptor in `toWooOrderPayload`. Server: the descriptors route. |
| Order note at checkout | `M/cart/note-row.tsx` (`cart-note-row`). `order-note-input` sends it as the order's `customer_note`. e2e `pos-checkout.spec.ts` "open order details and add a note". | None. `OrderBuilder.setNote` exists and `finalize.ts:259` puts `note` on the envelope, but `useSale` has no `setNote` and the connector drops it. `CartNoteInput` exists in `@tallyui/components`. | missing | shared:@tallyui/pos, then connector | `useSale.setNote` + connector `customer_note` in `toWooOrderPayload`. The app then renders `CartNoteInput`. |
| Order meta sheet | `M/cart/order-sheet.tsx` (`order-meta-dialog`: Order details, Sync order, Void, Print). `M/cart/buttons/edit-order-meta/form.tsx` (686 lines): customer note, status, cashier, register, store, hand over / send, tax exempt, custom meta fields, autosave. | None. | missing | shared:@tallyui/pos, then connector | `useSale.setMeta`/`setStatus` and connector `meta_data` passthrough. The status field depends on the per-gateway status row. |
| Quick discount (`pos-discount`) | `M/hooks/quick-discount.ts`: `QUICK_DISCOUNT_META_KEY='_wcpos_quick_discount'`; `mintQuickDiscountCode` gives `pos-discount`, `pos-discount-2`, and so on; intent is `{discount_type:'percent'\|'fixed_cart', amount}`; label "Discount (12,5%)". UI: `M/cart/add-discount.tsx` (`discount-amount-input`, `discount-percent-switch`; `pos_cart.add_discount`, `pos_cart.discount_amount_invalid`, `pos_cart.discount_percent_invalid`). Hook: `M/hooks/use-add-quick-discount.ts`. Preset buttons: `quickDiscounts` (max 3, `M/cart/ui-settings-form.tsx`). | `apps/pos/lib/sale/discount-codes.ts` (`createDiscountCodes`). `DiscountForm`/`DiscountChips` exist in `@tallyui/components`. No `pos-discount` coupon line. PARITY.md G-C3 is waiting on M9 and wcpos/woocommerce-pos#1927. | missing | server, then connector | Server: the v2 virtual coupon that honours `_wcpos_quick_discount`. Connector: a `coupon_lines` entry with that meta. Shared: a minted-code helper (or a port of `mintQuickDiscountCode`). |
| Coupons | Typed code and validation via `wcpos/v2/coupons`, rows under Subtotal, removal. e2e: `pos-coupon-apply.spec.ts`, `pos-coupon-checkout.spec.ts`, `coupons.spec.ts`. | `apps/pos/components/coupon-entry.tsx` (`CouponEntry`, `CouponRows`), gated by `capabilities.coupons && orderCreate >= 6` (`SS`). Rows go on the receipt (#90/#91/#97). | partial | server | Needs WCPOS ≥1.9.0 `order_create_v5`/v6 on the store. Re-check the error copy against `pos-coupon-apply.spec.ts` once the store runs a plugin that offers coupons. |

### Corrections to `docs/PARITY.md` (rows 98–119, 155)

- **Per-gateway status** is not "n/a (server)". In v2 the client picks the status from `defaults.order_status` (`derive.ts:143`), so it is a connector gap.
- **Card terminals**: on-device readers are web stubs in v2 too (`driver.web.ts`). The web-reachable target is server capture mode.
- **Cash** ("pos: tender") is partial, not present: there is no keypad, no quick amounts and no refusal.

### Buildable now

Ordered top-down by what a cashier hits first. Every unit runs on TallyUI 3.12.0 with the existing transport (cash and external legs only). New files go in `apps/pos/components/checkout/`.

1. **Tender pane with keypad and quick cash** (~350 lines)
   - Touches: new `checkout/tender-pane.tsx` and `checkout/keypad.tsx`; edits the tender stage in `SS`.
   - Wires `tenderReducer`, `initTenderState`, `quickTenderedAmounts`, `changeMinor` and `MAX_TENDER_MINOR` to `useSale.setTender`/`complete`.
   - Two static tiles (Cash, Card) with v2 test ids: `checkout-method-*`, `checkout-keypad`, `checkout-entry`, `checkout-commit`, `checkout-quick-*`.
   - Copy from: `CO/tender/tender-pane.tsx`, `CO/tender/labels.ts`, `CO/tender/LEDGER.md`, and `packages/core/src/contexts/translations/locales/en/core.json` ("Take {amount} in {method}", "Full balance {amount}", "Exact {amount}", "Change {amount}", "Tendered", "To pay").
2. **Card over-tender refusal** (~80 lines)
   - Touches: `checkout/tender-pane.tsx`.
   - The external leg cannot exceed the balance (`checkout-refused`).
   - Copy from: `CO/tender/use-tender-flow.ts` (the refusal branch) and the e2e "refuses an over-tender...".
3. **Ledger pane** (~250 lines)
   - Touches: new `checkout/ledger-pane.tsx`; `SS` (it replaces `SplitTender` when `multiplePayments`).
   - Shows balance, legs, remaining and change, plus the existing `CancelPaymentView` and `tender_voids` on removal.
   - Test ids: `checkout-ledger`, `checkout-balance`, `checkout-leg-{id}`, `checkout-ledger-remaining`.
   - Copy from: `CO/tender/ledger-pane.tsx`.
4. **Split plan: even, amount, percent** (~350 lines)
   - Touches: new `checkout/split-plan.tsx`; `checkout/tender-pane.tsx`.
   - Uses `planLegs`, `activePlan`, `evenSplitShareMinor` and the open-split/set-plan/arm-custom actions. Only when `multiplePayments`.
   - Copy from: `CO/tender/split-module.ts`, `CO/tender/split-view.ts`, `CO/tender/tender-figures.ts`, and the e2e tests in `checkout-tender.spec.ts` lines 461–700.
5. **Split by item** (~300 lines)
   - Touches: new `checkout/pick-items.tsx` and `checkout/unit-stepper.tsx`; `checkout/split-plan.tsx`.
   - Uses `toggle-split-line`/`pickedLineIds`, keyed on the sale's line ids.
   - Copy from: `CO/tender/unit-stepper.tsx`, `CO/tender/split-module.ts` (the pick tab), and the e2e tests at lines 704–960.
   - Blocked only if `useSale` hides line keys (see Shared needs).
6. **No connection gate for card** (~80 lines)
   - Touches: `checkout/tender-pane.tsx`, using outbox/online state from `apps/pos/lib/sale/outbox-context.tsx`.
   - Card is refused offline. Cash shows "Recorded offline · settles later" (`checkout-offline`).
   - Copy from: the `core.json` "No connection" / "Payments need one; the sale is saved in your open orders." strings, `CO/tender/tender-pane.tsx` (the `checkout-offline` branch), and `apps/main/e2e/checkout-offline-tender.spec.ts`.
   - Needs a front-desk ruling: whether a typed terminal reference may still record offline.
7. **Receipt stage: paid moment** (~250 lines)
   - Touches: new `checkout/receipt-stage.tsx` around `Receipt`; `SS` (receipt stage).
   - Adds `receipt-paid-banner`, "Paid with" from `receipt.payments`, `receipt-awaiting-store` from the outbox entry, and "Print receipt · New sale" (`receipt-close`).
   - Adds an auto-print toggle in till settings (`apps/pos/lib/sale/use-till-store-settings.ts`) that calls `window.print` once, never on replay.
   - Copy from: `CO/receipt-stage/receipt-stage.tsx`, `CO/receipt-stage/LEDGER.md`, and the e2e "shows the Paid moment for a cash sale with change" and "auto-prints the receipt...".
8. **Quick discount entry UI, local only** (~200 lines)
   - Touches: a new component; `SS`.
   - Built on the existing `DiscountForm`/`applyDiscount`, with `discount-amount-input` and `discount-percent-switch`, the percent/amount validation copy, and up to 3 preset buttons.
   - Copy from: `M/cart/add-discount.tsx`, `M/hooks/use-add-quick-discount.ts`, `M/cart/ui-settings-form.tsx`.
   - The `pos-discount` coupon line itself waits on the server.

### Shared needs

- **@tallyui/pos**: `useSale().setNote(note)`. `OrderBuilder.setNote` and the `finalize.ts:259` envelope field exist, but the hook does not expose them, so there is no order-note row.
- **@tallyui/pos**: `useSale().setMeta(key, value)` / `setStatus(status)`. Needed for the v2 order meta sheet (`edit-order-meta/form.tsx`).
- **@tallyui/pos**: open `SaleStage`/`addTender` up from `'cash' | 'external'` to a descriptor method id plus a `captureMode`. Every v2 method past two tiles is blocked on this.
- **@tallyui/pos**: `Payment.status` (pending/authorized/captured/failed/voided) and `Payment.tipMinor`, to carry v2 `PaymentRow`s on the ledger.
- **@tallyui/pos**: stable line keys and per-unit gross on cart lines, available to `tenderReducer`'s `pickedLineIds`, for split by item (confirm before unit 5).
- **@tallyui/pos**: a `mintQuickDiscountCode` port (`pos-discount`, `pos-discount-2`, …) and the `_wcpos_quick_discount` intent type, so the minted code matches v2.
- **@tallyui/pos**: a payment driver interface (availability, intent, collect, cancel), matching `apps/main/lib/payment-drivers/*/driver.ts`, for native Stripe Terminal, SumUp and Tap to Pay (M11).
- **@tallyui/pos (printer)**: drawer kick with the receipt print (`autoOpenDrawer`, skipped on replay), plus an "Open drawer" action (`printer-service.ts:275,425,511`).
- **@tallyui/components**: an optional `TenderKeypad` and `SplitPlan` presentational pair, so Medusa and Vendure POS share the units above instead of copying them.
- **@tallyui/connector-woocommerce**: `customer_note` (and `meta_data` passthrough) in `toWooOrderPayload`. The finalized note is dropped today.
- **@tallyui/connector-woocommerce**: a `paymentMethods()` read of `GET wcpos/v2/payment-methods` into `PaymentMethodDescriptor` (`order-math/src/payments/types.ts`). It drives tiles, change, offline, rounding and status.
- **@tallyui/connector-woocommerce**: the order status from the primary leg's `defaults.order_status` instead of the hardcoded `status: 'completed'`, for per-gateway status.
- **@tallyui/connector-woocommerce**: a payments transport for `POST orders/{id}/payments` and `orders/{id}/payments/{row}/void|intent|status`, plus `payment-methods/{id}/bootstrap`. Needed for the ledger rows, server voids and terminal capture.
- **@tallyui/connector-woocommerce**: gateway `orders/{id}/payment-methods/{m}/submit|cancel`, and the order's order-pay link for the legacy webview.
- **@tallyui/connector-woocommerce**: a quick-discount `coupon_lines` entry carrying the `_wcpos_quick_discount` meta. The plugin needs the v2 virtual coupon (wcpos/woocommerce-pos#1927).


## Registers, closures and reports

| Area | v2 behaviour (key monorepo paths) | This app (paths) | Status | Gap class | What is needed |
|---|---|---|---|---|---|
| Registers: server-record list | The store's registers come from the server: `GET wcpos/v2/registers` and `registers/{id}`. The Register type has `{id,name,store_id,default_float,counters,session,last_closure}` (`packages/core/src/services/register/use-register-binding.ts`). | There is only one local register doc, `'web'` (`apps/pos/lib/register/register-context.tsx` `ensureRegister(host,'web')`, `apps/pos/lib/sale/order-store.ts:26`, `apps/pos/components/sale-screen.tsx` `REGISTER_ID='web'`). | missing | connector (`GET registers`), server (plugin v2 `registers` routes; dev store runs Free 1.10.20, PLAN D6) | A connector `listRegisters`/`getRegister`, and a core `TallyConnector` method for them. |
| Registers: pick and bind | A bound/choose/none/unknown binding. The picker shows each register as open since/by, counting by, or closed with its last closure (`packages/core/src/screens/main/pos/cart/register-picker.tsx`, `use-register-binding.ts`, `pos/cart/LEDGER.md` 48–60). | `bindRegister` runs on the local `'web'` doc only. `RegisterColumn registers=[] onPick` is a no-op and `RegisterBar multiRegister=false` (`apps/pos/components/register-controls.tsx`). | partial | connector (registers list), then app-local | Feed `@tallyui/components` `RegisterPicker`/`RegisterColumn` from the server list and bind the server id. `RegisterPicker` exists (60 lines) but has no last-closure or counting-by lines. |
| Registers: management | Done in WP admin. The app only shows registers. | n/a | n/a | server | None in the app. |
| Health: Registers panel | Clock skew, closure gaps, conflicts, mismatches and duplicate orders, from `GET registers/health` (`packages/core/src/screens/main/health/registers-panel.tsx`). | none | missing | connector (`registers/health`), server | A read route and a panel. |
| Sessions: on/off | The store setting `register_sessions` drives sessions for every till (`packages/core/src/services/register-session/use-register-session.ts:97`, `use-register-status.ts:17`). | A per-till localStorage switch, `tallywoo.register_sessions`, off by default (`apps/pos/lib/register/register-setting.ts`, `RegisterSwitch` in `register-controls.tsx`). This follows the front desk ruling of 2026-10-06. | partial | connector (store register settings in `readWooCapabilities`/`storeSettings`), server | The connector should read `register_sessions`, `variance_threshold`, `expected_close_time` and blind mode from the store. Core `StoreSettings` has none of these fields (`@tallyui/core/src/types/store-settings.ts`). |
| Sessions: one status pill and register bar | One pill covering closed, open, counting, overdue and approval-required (`pos/cart/register-bar.tsx`, `register-bar.helpers.ts`). | `RegisterBar` from `@tallyui/components` (`register-controls.tsx`). | partial | server (overdue and approval fields) | Overdue needs `expectedCloseTime`. The approval-required state needs the server session. |
| Sessions: open with float | The float defaults to the register's `default_float`, then the last count. Keypad, chips, opening variance (`pos/cart/open-register-card.tsx`, LEDGER 52). | `OpenRegisterCard` with no `configuredFloatMinor`, so it falls back to `lastClosure.counted.cash` (`register-controls.tsx`, `@tallyui/components/src/register/open-register-card.tsx`). | partial | connector (`default_float` from `GET registers`) | Pass `configuredFloatMinor` once the register is read from the server. |
| Sessions: pay in / pay out | Paid in / Paid out / No sale, with nine reason chips (float, change, bank, petty cash, supplier, tips, mistake, drawer check, other). A reason is required and the claim is synchronous (`pos/cart/movement-sheet.tsx`, LEDGER 62–75). | `MovementSheet` and `RegisterPanel` have a free-text Reason field and no chips (`@tallyui/components/src/register/movement-sheet.tsx:93-109`). | partial | shared:@tallyui/components (`MovementSheet` reason chips) | Add the v2 reason chip set and its copy. |
| Sessions: No sale | A zero movement that opens the drawer (LEDGER 66). | The No sale type is recorded. Nothing opens a drawer (no printer/drawer kick). | partial | shared:@tallyui/pos (drawer kick via printer) | A cash drawer open on No sale and on cash tender. |
| Sessions: undo / void | Undo writes a reversal. A refused movement shows Retry (LEDGER 58, 76). | Undo goes through `voidMovement` (`register-panel.tsx:135-139`). Movements are never refused because they never sync. | partial | connector (register command transport) | Show refused movements with Retry once commands sync. |
| Sessions: count by denomination | Counted in minor units on denomination tiles: tap adds 1, a 400 ms hold adds 10 every 150 ms, and a typed amount clears the tiles (`pos/cart/register-count.tsx`, LEDGER 80–88). | `RegisterCount` / `CashCountInput` (`register-controls.tsx`). | present | — | — (check the hold-repeat timing in a browser). |
| Sessions: variance | Expected vs counted per tender, with the Short/Over/Exact word (`deriveExpected`, `countVariance`). | `RegisterCount` and `RegisterSummary` from @tallyui (`register-controls.tsx`). | present | — | — |
| Sessions: manager override | Over the threshold, or when the server demands it, the approve sheet POSTs `sessions/{id}/approve` with manager credentials (`pos/cart/approve-sheet.tsx`, LEDGER 89–94). | `RegisterCount` gets no `approve` prop, and `varianceThreshold` is not passed, so the close is never gated (`register-context.tsx`, `register-controls.tsx`). | missing | connector (`POST sessions/{id}/approve`), server; shared:@tallyui/components (ApproveSheet) | An approve route and sheet, plus `varianceThreshold` from store settings. |
| Sessions: blind count | A blind cashier sees no expected figures and no X report (LEDGER 95). | `blind` is not passed, so it defaults to false (`register-context.tsx`). | missing | connector (capability / role flag) | Pass `blind` from the store or role capability. |
| Sessions: overdue close | An overdue pill after `expected_close_time` (`use-register-session.ts:83`). | `expectedCloseTime` is not passed. | missing | connector (store setting) | As in the "Sessions: on/off" row. |
| Sessions: sync and take-over | Session open/transition, movements and closures go to the server: `POST sessions`, `sessions/{id}/status`, `movements`, `closures`. Count on another till, carry drawer on store switch, take-over or abandon of a session another till holds, and sign-out asks "Close it first?" (LEDGER 96–108). | `useRegisterSession` without `commands` or `capabilities`, so everything stays local. There is no take-over, carry or sign-out guard (`register-context.tsx`). | missing | connector (transport for `register.session.open/transition`, `register.movement.record/void`, `register.closure.submit`; `ServerCapabilities.register` from `/status`), server | Connector transport and capability first. The app then passes `commands`/`capabilities` and wires `takeOverSession`/`abandonSession`. |
| Sessions: register panel derivation | A Derivation rail, with figures pending until the server baseline arrives (`pos/cart/register-panel.tsx`). | `RegisterPanel` (@tallyui) shows the local figures. | partial | connector (baseline) | Pending state once synced. |
| Closures: numbering | The server adopts the closure number. The perpetual counter stays per register (`closures` POST result). | `mintClosureNumber` / `advancePerpetual` work locally only (the @tallyui/pos register doc). | partial | connector (`adoptRegisterResults` needs a transport) | Server numbers. |
| Closures: Z document and print | The closure-written moment, a print acknowledgement and Print again. Printed through the plugin template `/receipts/0?mode=fiscal&document=closure:{id}` (LEDGER 100–104). | `ClosureSheet` + `ClosurePrint` print `buildClosureDocument` as plain Text lines through `window.print` (`apps/pos/components/closure-print.tsx`, `register-controls.tsx`). | partial | server (fiscal closure template), connector (receipt route) | Template printing. The local layout is a fallback. |
| Closures: X report | An X report for an open or counting session, hidden for blind cashiers (`reports/closures/session-card.tsx`). | A "Print X report" button on Reports (`apps/pos/components/reports-screen.tsx`) and `buildXReportDocument` (`closure-print.tsx`). There is no session card. | partial | app-local | A session card on Reports with figures, sales count and an X report button. |
| Closures: room list | Grouped by opening business day, with a closer filter, Unsynced/Corrected badges, Short/Over/Exact words in colour, settled figures and stats (`reports/closures/{index,closure-list,closure-stats}.tsx`, `closures/LEDGER.md` 1–35). | A flat list showing number, business_day, closed time, cash counted, variance and period sales, with Reprint (copy) and Download CSV (`reports-screen.tsx`, `apps/pos/lib/reports/closures-csv.ts`). | partial | app-local | Grouping, words and colour, a closer filter, badges and stats. |
| Closures: detail panel and reprint | The panel renders the closure template and lists recorded→settled corrections with type, actor, approver and reason (`reports/closures/closure-panel.tsx`). | Reprint only. There is no panel (`reports-screen.tsx`). | partial | app-local (local), server (template) | Add a closure panel built with `deriveSettled` / `buildClosureDocument`. |
| Closures: recount / late corrections | Recount sheet: blank inputs, denomination tiles, reason up to 500 characters, manager credentials without the capability, correction UUID reuse. Sent as `POST closures/{id}/recount` (`reports/closures/recount-sheet.tsx`). | none | missing | connector (`POST closures/{id}/recount`), server; shared:@tallyui/pos (a `recordCorrection` writer; only the `Correction` type and `deriveSettled` exist) | Route, writer and sheet. |
| Closures: history | Free tier: today and the bound register, read locally. Pro: server history in 50-row pages (`GET closures`, `closures/last`, `closures/{id}`), Load more, and a lock on historical dates (`e2e/reports-closures.spec.ts`). | Local only, with `clampClosureScope` (`reports-screen.tsx`). | partial | connector (`GET closures*`), server | Server pages. |
| Closures: CSV | CRLF line endings, formula escaping, the union of tender columns. | `exportCsv` through `closures-csv.ts`. | present | — | — |
| Provenance stamping | `_wcpos_register`, `_wcpos_sale_time`, `_wcpos_sale_tz`, `_wcpos_sale_counter`, `_wcpos_app_version`, `_wcpos_app_build` and `_wcpos_session`, written once at completion (`packages/order-math/src/payments/provenance.ts` `saleProvenanceMeta`, `pos/checkout/provenance/stamp-completion.ts`). Health reports any completed sale with no register (`provenance-gap.ts`). | `useSale({registerId:'web', session})` (`sale-screen.tsx`). `nextSaleCounter` is never called. The connector sends only `_woocommerce_pos_uuid`, `_woocommerce_pos_payments` and line `_woocommerce_pos_data` (`@tallyui/connector-woocommerce/src/commands/transport.ts`). | missing | connector (order.create meta, `POST push/orders`); shared:@tallyui/pos (stamp helper) | A stamp helper in pos, meta in the connector, and a real register id. |
| Fiscal records | The tender-void journal, closure fiscal documents and register health checks. | A local `recordTenderVoids` journal in the device timezone (`sale-screen.tsx`). PARITY G-F1..G-F5. | partial | server (fiscal templates / records routes), connector | Sync and templates. |
| Reports: scope and period | Today on the bound register by default, with dates in store time. The date button and the register/store menu are Pro-locked with a See Pro hint. All stores is a Pro scope (`reports/LEDGER.md` 1–12, `reports/hero/date-button.tsx`). | Fixed to "Today · This till", with days in the device timezone (`reports-screen.tsx`, `apps/pos/lib/reports/sales-room.ts`, `today-sales.ts` `dayRange`). | partial | app-local (store timezone from store settings is a gap: connector) | Store-time days, plus a date button that is locked or Free-limited. |
| Reports: comparison | On by default: day vs yesterday or the same weekday last week, week vs the week before, month vs the month before, and a live day compared at the same time of day (LEDGER 13–18). | Yesterday at the same time only (`sales-room.ts`). | partial | app-local | A comparison selector. |
| Reports: chart | By hour or by day, or a running total (`reports/hero`). | `HourlyBars` only (`reports-screen.tsx`). | partial | app-local | A day view and a running total. |
| Reports: filters | A cashier chip (Everyone). Status chips (completed + processing by default, or every status). An "N orders left out" chip with per-order untick (LEDGER 19–25, `e2e/reports.spec.ts` `hero-chips`). | Pending/rejected counts only (`reports-screen.tsx`). | missing | app-local | Chips over local orders. |
| Reports: till strip | Session, float, cash sales and refunds, expected in drawer, last closure and voids count. It is the only way into Closures (LEDGER 26–30). | none | missing | app-local | A strip built from `useRegisterSession`. |
| Reports: sync progress | A sync progress line (LEDGER 31). | none | missing | app-local | Order sync progress. |
| Reports: cards | Orders, Payments (donut, tender ledger), Where sold (In store/Online; Stores and Registers views), Top products, Categories, Brands (conditional), Cashiers, Taxes, and Refunds by the day they were made. Margin/COGS columns (`reports/cards/index.tsx`). | Today card, Payments tile and Taxes tile (`reports-screen.tsx`, `apps/pos/lib/reports/sales-tables.ts`). | partial | app-local (Orders, Cashiers, Top products, Categories); connector (online orders for Where sold, refunds, COGS meta) | More cards. |
| Reports: panels | Each card opens a right-side `ReportPanel` with Export CSV and Print through the plugin `report` templates. The Products panel has Category and Brand chips (`reports/panels/specs.ts`, `panels/document.ts` `buildReportDocument`). | A `SalesTable` dialog with Export CSV and Close, and no Print (`apps/pos/components/sales-table.tsx`, `apps/pos/lib/reports/sales-table-csv.ts`). | partial | server (report templates), app-local (side panel, local print) | Side panel and Print. |
| Reports: Sales summary print | The hero prints a Sales summary (`reports/report/summary.ts`, `hero-print`). | none | missing | server (template), app-local (fallback) | A summary document. |

### Buildable now

Ordered by what a cashier meets first. Each is one PR of about 400 lines or fewer.

1. **Session card and X report on Reports.**
   - Touch: `apps/pos/components/reports-screen.tsx`, and a new `apps/pos/components/session-card.tsx`.
   - Copy from: `packages/core/src/screens/main/reports/closures/session-card.tsx` (copy keys `register.x_report`, `reports.since_by`, `register.sales_count`).
2. **Till strip on Reports.**
   - Touch: a new `apps/pos/components/till-strip.tsx`, and `reports-screen.tsx`.
   - Copy from: `reports/LEDGER.md` 26–30 and the reports till-strip component (`reports/hero/*`).
   - Figures come from `useRegisterSession` (`expected`, `movements`, `lastClosure`).
3. **Closures list with grouping and result words.**
   - Touch: `reports-screen.tsx`, and a new `apps/pos/components/closure-list.tsx`.
   - Copy from: `reports/closures/closure-list.tsx` and `closure-stats.tsx` (keys `reports.result`, `reports.difference`, `reports.n_sessions`).
   - Use `selectClosureRows` and `deriveSettled`.
4. **Closure detail panel built locally.**
   - Touch: a new `apps/pos/components/closure-panel.tsx`, `closure-print.tsx` and `reports-screen.tsx`.
   - Copy from: `reports/closures/closure-panel.tsx`.
   - Render `buildClosureDocument` and corrections from `deriveSettled`. Recount stays hidden.
5. **Store-time days in Reports.**
   - Touch: `apps/pos/lib/reports/{sales-room,today-sales}.ts`.
   - Copy from: `reports/LEDGER.md` 1–6.
   - Use the store timezone if `StoreSettings` carries one; otherwise this is blocked on the connector.
6. **Comparison selector and running-total chart.**
   - Touch: `sales-room.ts`, `reports-screen.tsx`, and a new `apps/pos/components/sales-chart.tsx` (replaces `HourlyBars`).
   - Copy from: `reports/LEDGER.md` 13–18 and `reports/hero/*`.
7. **Status, cashier and left-out chips.**
   - Touch: `sales-room.ts`, `sales-tables.ts`, `reports-screen.tsx`.
   - Copy from: `reports/LEDGER.md` 19–25 and `e2e/reports.spec.ts` (`hero-chips`).
8. **Orders and Cashiers cards with panels.**
   - Touch: `apps/pos/lib/reports/sales-tables.ts`, `reports-screen.tsx`.
   - Copy from: `reports/cards/index.tsx` and `reports/panels/specs.ts` (cashiers and orders specs).
9. **Top products and Categories cards from local orders and products.**
   - Touch: `sales-tables.ts`, and a new `apps/pos/lib/reports/product-figures.ts`.
   - Copy from: `reports/panels/specs.ts` (products and categories specs, Category chip).
10. **Side report panel with local Print.**
    - Touch: `apps/pos/components/sales-table.tsx` (side sheet on wide screens, Print with `window.print` reusing the `closure-print.tsx` print CSS).
    - Copy from: `reports/panels/document.ts` for the column layout.
    - Plugin `report` templates come later.
11. **Movement reason chips, if done app-side.**
    - Wrap `MovementSheet`, or wait for the shared change (see Shared needs). The shared change is preferred, so it is not listed as app-local.

Not buildable now (connector or server first): the registers list and picker, float default from the server, session/movement/closure sync, approval, blind and overdue, recount, closure history, provenance, the Health registers panel, and template prints.

### Shared needs

- `@tallyui/connector-woocommerce`: register command transport for `register.session.open/transition`, `register.movement.record/void` and `register.closure.submit` → `POST wcpos/v2/sessions`, `sessions/{id}/status`, `movements`, `closures`. Without it, nothing about a session leaves the till.
- `@tallyui/connector-woocommerce`: `readWooCapabilities` sets `ServerCapabilities.register` (and `orderRefund`) from `/status`. Without it, `useRegisterSession` cannot turn sync on.
- `@tallyui/connector-woocommerce` + `@tallyui/core`: `listRegisters` / `getRegister` (`GET registers`, `registers/{id}`), giving `default_float`, `counters`, `session` and `last_closure`. The picker, binding and float default depend on it.
- `@tallyui/connector-woocommerce` + `@tallyui/core`: store register settings in `StoreSettings` (`register_sessions`, `variance_threshold`, `expected_close_time`, blind mode, store timezone). These replace the per-till switch and feed threshold, overdue and blind.
- `@tallyui/connector-woocommerce`: `approveSession` (`POST sessions/{id}/approve`). Needed for the manager override on an over-threshold close.
- `@tallyui/connector-woocommerce`: `listClosures` / `lastClosure` / `getClosure` (`GET closures`, 50-row pages). Needed for closure history beyond this till.
- `@tallyui/connector-woocommerce`: `recountClosure` (`POST closures/{id}/recount`). Needed for late corrections.
- `@tallyui/connector-woocommerce`: `_wcpos_*` provenance meta in the order.create payload (`POST push/orders`). Needed for the sale-time register, session and counter on server orders.
- `@tallyui/connector-woocommerce`: `registersHealth` (`GET registers/health`). Needed for the Health registers panel.
- `@tallyui/connector-woocommerce`: fiscal and report template print (`/receipts/0?mode=fiscal&document=closure:{id}` and the report templates). Needed so Z, X and report prints match v2.
- `@tallyui/pos`: `stampSaleProvenance` (write-once register, time, tz, counter via `nextSaleCounter`, session, app version and build). Ports `order-math/src/payments/provenance.ts` and `stamp-completion.ts`.
- `@tallyui/pos`: `recordCorrection` writer (with correction UUID reuse). Only the `Correction` type and `deriveSettled` exist.
- `@tallyui/pos`: report figure helpers (store-day ranges, comparison periods, per-card aggregations from `reports/panels/specs.ts`). These keep reports logic shared across the Woo, Medusa and Vendure apps.
- `@tallyui/components`: `MovementSheet` reason chips (the v2 nine). It currently has free text only.
- `@tallyui/components`: `ApproveSheet` (`RegisterCount` takes `approve?` but nothing ships the sheet).
- `@tallyui/components`: `RecountSheet`, `ClosureList`, `ClosurePanel`, `SessionCard`, `TillStrip`, `ReportPanel`. None exist, and every TallyUI app needs them.
- `@tallyui/components`: `RegisterPicker` status lines (open since/by, counting by, closed with last closure), to match `pos/cart/register-picker.tsx`.
- `@tallyui/pos` (printer): cash drawer kick on No sale and cash tender.


## Orders, refunds, receipts, printing and customer display

| Area | v2 behaviour (key monorepo paths) | This app (paths) | Status | Gap class | What is needed |
|---|---|---|---|---|---|
| Order history: access | Orders is Pro (`pro="orders"`). Free gets a preview overlay and a read-only modal. `packages/core/src/screens/main/orders/index.tsx`, `orders/edit/view.tsx` (`readOnly`) | `apps/pos/app/orders.tsx`, `components/orders-screen.tsx`, open to every cashier | partial | app-local | Gate the screen by licence once a Pro flag exists (M4/D6). Until then this is noted, not built |
| Order history: list | Virtualised DataTable of synced `orders`, page size 10, grouped by store day (`orders/day-heading.tsx`, `use-store-day`). Columns: number, customer, status, total, date created/modified/completed/paid, payment method, created_via, cashier, register, receipt, actions (`orders/index.tsx` `cells`). Sortable, column display options (`components/display-options`), keyboard rows (`use-row-keyboard.ts`) | `OrdersList` from `@tallyui/components` 3.12.0: Needs attention plus Recent, with `OrderHistoryRow` {reference, placedAt, total, itemCount, stateLabel}. Online `listOrders` 25 a page with Load more (`lib/orders/order-history.ts`) | partial | shared:@tallyui/components, connector | `OrdersList`: day headings, customer, payment method, cashier and register cells, sort. Connector: `StoreOrder` needs `cashierId` (`_pos_user`), `registerId` (`_wcpos_register`) and `createdVia`. There is no local orders collection, so it is online only |
| Order history: search | `QuerySearchInput` "Search Orders", plus a barcode scan into the search (`orders/use-barcode.ts`) | none. `ListOrdersQuery.search` already exists in core and `createWooOrders` passes it to wc `search` | missing | app-local | Search box plus scan to search (buildable #1) |
| Order history: filters | Pills for status, customer, cashier, register, store, date range and payment method (`orders/filter-bar.tsx`, `components/order/filter-bar/*-pill.tsx`). Default scope is cashier = me, store = current. Cashier and store go to the server as `pos_cashier` and `pos_store` params. Register is matched locally on `meta_data._wcpos_register` (`packages/query/src/query-state/query-state-translator.ts:304`) | none | missing | connector, server | `ListOrdersQuery` needs `status`, `customerId`, `after`/`before` (wc/v3 supports these), `cashierId`/`storeId` (WCPOS proxy `pos_cashier`/`pos_store`) and `paymentMethod`. A register filter needs a server-side param (the wc/v3 REST API has no meta filter) or a local filter over the page |
| Order history: attention notice | `PaymentAttentionNotice` lists payments in motion, with Handled and Open (`orders/attention-notice.tsx`) | the outbox's "Needs attention" with Retry (`OrdersList` `stuck`) | partial | shared:@tallyui/pos | Ledger-backed payment-attention entries (goes with tender voids / fiscal G-F*) |
| Order detail | Order modal, View tab: status badge, identity, sections for line items, totals, payment, refunds and customer (`orders/edit/view.tsx`, `orders/view/sections/*.tsx`). Footer: Receipt, Sync, Re-open, Delete, Refund | Open goes straight to the receipt (`orders-screen.tsx` `open`) | missing | app-local | Read-only detail from `StoreOrder` (lines, fees, shipping, coupons, taxLines, payments, refunds, customer). `@tallyui/components` exports `OrderDetail`, which may fit (buildable #2) |
| Order detail: sync and refresh | "Sync" re-reads the order (`orders/order-actions.tsx` `refreshRecordByWooId`) | none | missing | app-local | `connector.getOrders([id])` exists. Add a Sync button on the detail |
| Order edit | Edit tab (Pro): status, customer, customer note, billing and shipping, tax id, custom fields (`orders/edit/form.tsx`) | none | missing | connector | `order.update` (Woo `PUT orders/{id}`). PLAN M6 defers this past M6 |
| Reopen | "Re-open": status goes back to `pos-open`, cashier and store are stamped, the order lands in the cart. Refused while a payment leg is in motion (`orders/use-reopen-order.ts`) | none | missing | connector, shared:@tallyui/pos | Connector `order.update` to `pos-open`. pos needs to load a `StoreOrder` into `useSale` as an open order |
| Delete order | Delete with a confirm, "Delete order" (`orders/order-actions.tsx` `DeleteOrderDialog`) | none | missing | connector | `deleteOrder` (Woo `DELETE orders/{id}`), handling a not-permitted answer |
| Refunds: form | `orders/refund/form.tsx` and `calculate-refund.ts`: per-line "Refund Qty" capped by what was already refunded, "Custom Amount", "Previously Refunded", "Refund Total". Destination is "Refund via cash" or "Refund to {gateway}". Optional "Reason". "Process Refund" opens "Confirm Refund" ("Refund {amount} for Order #{number}?"). Online only ("Refunds need a connection") | none, no Refund action anywhere | missing | connector, shared:@tallyui/components | Connector: a Woo refund transport (`CommandTransport<OrderRefundEnvelope>`) that maps ADR-080 `order.refund` onto `POST wcpos/v2/orders/{id}/refunds`, plus `capabilities.orderRefund` from `readWooCapabilities`. Components: a `RefundSheet`. `submitOrderRefund`, `sendOrderRefund` and `posRefundCollection` already exist in `@tallyui/pos` |
| Refunds: full and partial | Lines plus a custom amount give any total up to `computeMaxRefundable` | none | missing | connector | As above. `StoreOrderLine.id` is already the refund line key |
| Refunds: restock | No restock control in v2. The payload has no `restock_items`, so wc/v3 `api_restock` keeps its default of true and every refund restocks (`refund/use-refund-mutation.ts` `buildRefundPayload`) | none | missing | connector | Send `api_restock` from `OrderRefundLine.restock`. Note that PLAN M6 ("stock returned when chosen") goes beyond v2: v2 always restocks |
| Refunds: audit | The payload carries `meta_data` `_wcpos_register` and `_wcpos_session`, plus `refund_destination` and `api_refund`. The Refunds section shows each refund with "By" (refunded_by), reason, lines, tax and total (`view/sections/refunds.tsx`, `GET orders/{id}/refunds`) | `StoreOrderRefund` is {id, amount, reason} only | missing | connector | Connector: refund lines, `refundedBy` and the register on `StoreOrderRefund` (`GET orders/{id}/refunds`). Register and session come from the `OrderRefundPayload` fields |
| Refunds: failure copy | `refund/refund-failure.ts`: offline, signed out, backgrounded, "outcome unknown" ("check before retrying, a retry could refund twice") | none | missing | app-local (after the connector) | Map `OrderRefundOutcome` kinds onto v2's copy |
| Refunds: in closures | Applied refunds counted per session | `writeClosure`/`deriveExpected` take `refunds` (pos 3.12.0). The app passes none | partial | connector | Wire `pos_refunds` into register-controls once refunds exist |
| Refund document | "Receipt" button per refund opens `/orders/receipt/[id]?document=refund:{id}`, titled "Refund receipt". Rendered by the server `GET wcpos/v2/receipts/{order}?document=refund:{id}`, PDF `refund-{id}.pdf` (`receipt/index.tsx`, `receipt.tsx`) | none | missing | server, shared:@tallyui/pos | Either the server receipts route through the connector, or a local `buildRefundReceiptData` (`ReceiptFiscal.document_type: 'refund'` already exists) |
| Receipt screen: local render then upgrade | Renders locally while offline or unsynced (ADR 0040 D1, `receipt/use-receipt-document.ts:96`, `utils/build-receipt-data.ts`). Once online, renders the server template (`GET wcpos/v2/receipts/{id}`, `hooks/use-receipt-data.ts`) with a "Syncing with server" badge (`syncing-badge.tsx`) | Always the local `Receipt` component (sale: `sale-screen.tsx:384`, reprint: `buildReceiptDataFromStoreOrder`) | partial | server, connector | Connector `getReceipt(orderId, {mode, intent, document})` over `wcpos/v2/receipts/{id}`. Needs the v2 plugin route |
| Receipt screen: zoom | "Zoom in" / "Zoom out" on a paper-size preview (`receipt/receipt-body.tsx:158`, `components/receipt-preview-viewport(.web).tsx`) | none | missing | app-local | Scale wrapper around `Receipt` (buildable #4) |
| Receipt screen: template switcher | "Select template" (`template-switcher.tsx`) and "Select printer" with Auto (`printer-switcher.tsx`). Mismatch badges (`mismatch-badge.tsx`) | none | missing | server, shared:@tallyui/pos | Templates from `GET wcpos/v2/templates` (`packages/query/src/store-local/templates-sync.ts`), a local templates collection, and a renderer (next row) |
| Receipt screen: PDF | "Download PDF" via server `GET wcpos/v2/receipts/{id}/pdf`, then save or share (`hooks/use-download-receipt-pdf.ts`, `utils/save-or-share-pdf.web.ts`) | none | missing | server, connector | Connector `receiptPdf(orderId, document?)` |
| Receipt screen: actions | Print receipt, Email Receipt, Download PDF, Sync order, Close (`receipt-actions.tsx`). Print sheet with "Print again" and print errors (`print-sheet.tsx`) | Print receipt (`window.print`) and New sale / Back. Email is inline | partial | app-local | Match v2's action set and copy. Print again |
| Receipt identity and QR | Schema 1.4. `COPY {n} · {printed datetime}` in bold, centred, near the foot. Reprint once printCount > 1, `reprint_count = n-1`, counted on the server via `intent=print` (`printer/src/encoder/default-thermal-template.ts:133`, `build-receipt-data.ts:1004`). QR only from a fiscal module | Sale: "Sales receipt", register and software, `COPY n` from the second print, memory only (`components/receipt-identity.tsx`, `lib/receipts/use-receipt-print-count.ts`). Orders: the `Receipt` shows "Reprint n" on every open, the first view included, with no identity block (`orders-screen.tsx` `fiscal.reprint_count: n`) | partial | server (G-R5), app-local | Orders reprint uses the same rule and text as the sale (buildable #3). Persist the count locally until the server counter exists |
| Auto show / auto print after checkout | "Automatically show receipt after checkout", "Automatically print receipt after checkout". Without a printer the dialog opens after each sale (`pos_cart.auto_print_without_receipt_hint`) | The receipt stage always shows. No auto print | partial | app-local | Two device settings (buildable #6) |
| Receipt templates | Logicless Mustache to HTML (`packages/receipt-renderer/src/render-template.ts`, `render-html.ts`, `sanitize-html.ts`) and thermal XML to ESC/POS or ePOS XML (`parse-xml.ts`, `render-escpos.ts`, `render-epos-xml.ts`), plus a barcode library. Built-in `DEFAULT_THERMAL_TEMPLATE`. Templates synced from the server | none (fixed React layout) | missing | shared:@tallyui/pos (new receipt-renderer), server | A port of `@wcpos/receipt-renderer` with `buildTemplateData`/`mapReceiptData` over `ReceiptData` 1.4. Templates route `GET wcpos/v2/templates` |
| Browser print | System adapter prints the receipt HTML in a frame at 58/80 mm (`printer/src/print-html.ts` `buildPrintableReceiptHtml`, `transport/system-print-adapter.web.ts`). "Browser print dialog" choice on the print sheet | `window.print()` of the page with `injectPrintStyle` (sale, closure, reports) | partial | app-local | Print only the receipt at paper width (buildable #5) |
| Thermal printing | `@wcpos/printer`: `PrinterService`, ESC/POS, StarPRNT and Star Line (`types.ts:125`), raster option ("Print receipts as an image"), code pages, auto-cut. Web: Epson ePOS (`epson-epos-adapter.ts`), Star WebPRNT (`star-webprnt-adapter.ts`), WebUSB, WebBluetooth. Native and desktop: TCP, USB, BLE, SPP, serial. Discovery and identify (`discovery/*`), status (`escpos-status.ts`). Printer settings and setup wizard (`settings/printer/**`, `settings/printing/index.tsx`) | none | missing | shared:@tallyui (new printer package) | Port `@wcpos/printer` (encoder, transports, `usePrint`, discovery). Web lane first: ePOS, WebPRNT, WebUSB |
| Label printer formats (ZPL, CPCL, TSPL) | **Not in v2 main**: no ZPL, CPCL or TSPL anywhere in `packages/printer`, `receipt-renderer`, `virtual-printer` or `settings`. Languages are esc-pos, star-prnt and star-line only | none | n/a | none | Drop the row from PARITY |
| Multi-printer routing | `resolvePrinter`: layer 1 print-time override, layer 2 per-template setting (`settings/printing/template-row.tsx` "Select printer"), layer 3 auto-match by type and width (`printer/src/resolve-printer.ts`). Default printer ("Set default"), `detectMismatch` | none | missing | shared:@tallyui (printer) | `resolvePrinter` plus printer profiles store |
| Cloud printing | `connectionType: 'cloud'` with `cloudProvider` star-cloudprnt, epson-sdp or printnode. Order-based jobs rendered by the server (`printer/src/transport/cloud-adapter.ts`, `settings/printing/printer-row.tsx` "Managed by WCPOS") | none | missing | server, shared:@tallyui (printer) | WCPOS plugin cloud-print routes plus the `CloudEnqueueFn` adapter |
| Cash drawer kick | `autoOpenDrawer` on print, `drawerConnector` pin2/pin5, standalone "Open drawer" when `canOpenDrawer(profile)` (no system dialog) (`printer/src/capabilities.ts`, `settings/printer/dialog/drawer-emulation-warning.tsx`) | none. `MovementSheet` has an `onOpenDrawer` prop that is unused (`components/register-controls.tsx`) | missing | shared:@tallyui (printer) | Drawer-kick bytes plus a transport, then wire `onOpenDrawer` |
| Virtual printer (dev) | `packages/virtual-printer`: an mDNS ePOS/WebPRNT/9100 simulator with scenarios (README) | none | missing | shared:@tallyui (printer), dev tooling | Comes with the printer port. Useful for the dev store |
| Email receipt: UI | "Email Receipt" dialog: "Email Address", "Save email to billing address", "Send" or "Send when online". Copy: "Receipt email queued" / "It will send as soon as this device can reach your store", "Email sent", "Your server did not send the email." (`receipt/email.tsx`, `POST orders/{id}/email`) | Inline field on the receipt with its own copy. No save-to-billing (`components/receipt-email.tsx`, `lib/receipts/receipt-mailer.ts` leaves `saveToBilling` out on purpose) | partial | app-local | v2's dialog and copy. A save-to-billing checkbox, unchecked, is the "ask" (`emailReceipt` already takes `saveToBilling`) (buildable #7) |
| Email queue | Local queue with a retry budget. Classifies failures as connectivity (5xx, 408/423/425/429, transport, preflight) or permanent, retries connectivity only, and recovers an interrupted send without double-POSTing (`packages/query/src/receipt-email-queue/classify.ts`, `queue.ts`, `commands.ts`, `receipt/email-queue/bridge.tsx`). Health panel | Queued until synced and online (on change, `online`, every 30 s). Any failure stops the email. A send cut off mid-flight is marked failed. Health panel present (`lib/receipts/receipt-emails.ts`, `components/queued-emails-panel.tsx`) | partial | app-local | Port `classify.ts` plus attempt count, back-off and interrupted-send recovery (buildable #8) |
| Customer display: pairing | Settings › Customer display (Pro): "Pair a display", a pairing code with expiry, display URL with Copy and Open in browser, a paired-displays list showing connected or last seen with Forget (`settings/customer-display/{index,pairing-code,paired-displays}.tsx`). Signalling `POST wcpos/v2/.../pairings`, `GET/DELETE displays`, `POST displays/{id}/signal`, advertised as `display: {contract: 1, signaling}` (`services/customer-display/signaling-client.ts`, `index.ts`) | none | missing | server, shared:@tallyui/pos | Pro signalling routes on the plugin. Shared: a signalling client plus a display advertisement in `ServerCapabilities` |
| Customer display: what it shows | WebRTC peer (`peer.ts`, `peer.native.ts`) sends snapshot envelopes (≤200 KiB): order lines (truncated), totals, payment, customer note, presentation hints (`snapshot.ts`, `envelope.ts`, `display-session.ts`, `ledger.ts`) | none | missing | shared:@tallyui/pos, server | A snapshot builder from `useSale` plus the peer service. The display page itself is served by the server/Pro |

### Buildable now (app-local on TallyUI 3.12.0, one PR each, in the order a cashier meets them)

1. **Orders search plus scan to search.** Touches `apps/pos/components/orders-screen.tsx` and `apps/pos/lib/orders/order-history.ts` (pass `search` to `listOrders`, reset paging), and reuses `apps/pos/lib/scan`. Copy from `packages/core/src/screens/main/orders/index.tsx` (`QuerySearchInput`, "Search Orders") and `orders/use-barcode.ts`. Empty and no-results copy: `orders.no_orders_yet`, `orders.nothing_matches_filters`, `orders.clear_filters` in `packages/core/src/contexts/translations/locales/en/core.json`.
2. **Read-only order detail before the receipt.** New `apps/pos/components/order-detail.tsx`; `orders-screen.tsx` opens the detail, which has Receipt and Sync (`connector.getOrders`). Sections: line items, totals, payment, refunds already recorded (amount and reason), customer. Copy from `orders/edit/view.tsx` and `orders/view/sections/{line-items,totals,payment,refunds,customer}.tsx`. Try `@tallyui/components` `OrderDetail` first.
3. **One copy-marking rule for Orders reprints.** In `orders-screen.tsx`, count prints on `afterprint` (`lib/receipts/use-receipt-print-count.ts`) instead of on opening, mark only from the second print, and add `ReceiptIdentity` (`components/receipt-identity.tsx`, `lib/receipts/receipt-identity.ts`). Persist the count per order in `lib/app-storage.ts` so a reload keeps it; a server counter (G-R5) replaces this later. Copy from `packages/printer/src/encoder/default-thermal-template.ts:133` (`COPY {n} · {printed datetime}`) and `receipt/utils/build-receipt-data.ts:1004`.
4. **Receipt zoom.** A scale wrapper with "Zoom in" / "Zoom out" around `Receipt`, in `components/sale-screen.tsx` and `orders-screen.tsx` (a small shared app component). Copy from `receipt/receipt-body.tsx` and `receipt/components/receipt-preview-viewport.web.tsx`.
5. **Print the receipt only, at paper width.** New `apps/pos/lib/receipts/print-receipt.ts` (a hidden frame or a scoped print sheet, 58 or 80 mm), used by `sale-screen.tsx` and `orders-screen.tsx`. Copy from `packages/printer/src/print-html.ts` and `transport/system-print-adapter.web.ts`. Add "Print again" (`receipt/print-sheet.tsx`).
6. **Auto show and auto print after checkout.** Two device settings ("Automatically show receipt after checkout", "Automatically print receipt after checkout") in `lib/sale/use-till-store-settings.ts` or `lib/app-storage.ts`, applied in `sale-screen.tsx`. Copy keys `common.automatically_*_after_checkout` and `pos_cart.auto_print_without_receipt_hint`.
7. **Email receipt dialog in v2's shape.** `components/receipt-email.tsx` becomes an "Email Receipt" button that opens a dialog with "Email Address", a "Save email to billing address" checkbox (unchecked, which passes `saveToBilling`), and "Send" / "Send when online". `lib/receipts/receipt-mailer.ts` passes the option. Copy from `receipt/email.tsx` and the `receipt.email_*` keys.
8. **Email queue retry and back-off.** `lib/receipts/receipt-emails.ts` and `components/queued-emails-panel.tsx` get a connectivity/permanent classification, attempts, next try, and resend of an interrupted send. Copy from `packages/query/src/receipt-email-queue/{classify,queue,commands}.ts`.

### Shared needs

- `@tallyui/connector-woocommerce: createWooRefundTransport (CommandTransport<OrderRefundEnvelope>)`: maps `order.refund` v1 onto `POST wcpos/v2/orders/{id}/refunds` (amount, line_items, reason, `refund_destination`, `api_refund`, `api_restock`, `_wcpos_register` and `_wcpos_session` meta). Also `readWooCapabilities` setting `orderRefund`. Blocks every refund row.
- `@tallyui/core: StoreOrderRefund` gains lines, tax, `refundedBy` and `registerId`, read by the connector from `GET orders/{id}/refunds`. Needed for the refunds section and audit.
- `@tallyui/core: ListOrdersQuery` gains `status`, `customerId`, `after`/`before`, `cashierId` (`pos_cashier`), `storeId` (`pos_store`), `paymentMethod` and `registerId`, with the matching connector mapping. Needed for the v2 filter pills and the default cashier/store scope.
- `@tallyui/core: StoreOrder` gains `cashierId`, `registerId` and `createdVia` (from `_pos_user`, `_wcpos_register`, `created_via`). Needed for the cashier and register columns and filters.
- `@tallyui/components: OrdersList` gains store-day headings, customer, payment method, cashier and register cells, and sort. Needed for v2's list.
- `@tallyui/components: RefundSheet`: per-line quantities capped by `computeRemainingRefundQuantity`, custom amount, previously refunded, destination (cash or original method), reason, and confirm. Port of `orders/refund/form.tsx` and `calculate-refund.ts`.
- `@tallyui/pos: buildRefundReceiptData` (`document_type: 'refund'`): a local refund document while the server receipt route is missing.
- `@tallyui/connector-woocommerce: updateOrder` (status `pos-open`, note, customer) and `deleteOrder`, plus `@tallyui/pos` loading a `StoreOrder` into `useSale`. Needed for Re-open, Edit and Delete.
- `@tallyui/connector-woocommerce: getReceipt` and `receiptPdf` over `wcpos/v2/receipts/{id}[/pdf]` (with `mode`, `intent=print`, `document`). Needed for the server receipt after the local one, PDF, the refund document and the server print counter (G-R5). Server: the v2 plugin route.
- `@tallyui/pos` (or a new `@tallyui/receipt-renderer`): Mustache HTML and thermal-XML rendering to ESC/POS and ePOS, plus a templates collection synced from `GET wcpos/v2/templates`. Port of `packages/receipt-renderer`. Needed for the template switcher and thermal output.
- `@tallyui` new printer package: `PrinterService`, encoder, web transports (Epson ePOS, Star WebPRNT, WebUSB, WebBluetooth), `resolvePrinter` routing, `canOpenDrawer` and drawer kick, cloud adapter. Port of `packages/printer`, with `virtual-printer` for testing.
- `@tallyui/pos: customer-display` signalling client, snapshot builder and WebRTC peer, plus a `display` advertisement in `ServerCapabilities`. Port of `packages/core/src/services/customer-display`. Server: the Pro pairing and signal routes.

Corrections to `docs/PARITY.md`:
- **Label printer formats:** not in v2 main. No ZPL, CPCL or TSPL anywhere in the code; the printer languages are esc-pos, star-prnt and star-line (`packages/printer/src/types.ts:125`).
- **Restock:** v2 has no restock control on refunds, so the default `api_restock` (true) means every refund restocks. PLAN M6's "stock returned when chosen" goes beyond v2.
- **Orders reprints:** these show "Reprint n" on the first view and don't match the sale screen's `COPY n` from the second print.

`~/Projects/tallyui/docs/v2-parity/PLAN.md` didn't exist yet, so these unit names are mine, not the sibling plan's.


## Catalogue, cart, tax, customers and sync: v2 parity audit

I checked v2 at monorepo `main` 5ac185b0e against this app on TallyUI 3.12.0. `~/Projects/tallyui/docs/v2-parity/PLAN.md` does not exist yet, so the package names below are mine. I did not run any tests or builds.

**Path shorthand**
- `M/` = `~/Projects/monorepo/packages/core/src/screens/main/`
- `SE/` = `~/Projects/monorepo/packages/sync-engine/src/`
- `A/` = `apps/pos/`
- `TU` = the installed `apps/pos/node_modules/@tallyui/*` 3.12.0

**Corrections to PARITY.md**
- **G-V1 and G-V2 are now gaps in this app, not in TallyUI.** TallyUI ships what the pickers need: `ProductTraits.getVariantOptions` (connector `dist/index.js:577`), `ProductVariantPicker`, `CatalogueEntry.picks`, and `addEntryToCart` writes `attributes`/`anyAttributes` (pos_orders v10). The app doesn't use any of them.
- **The v2 default for variable products is drill-in, not the popover.** See `M/pos/products/index.tsx:265` (`variationsStyle ?? 'drill'`).
- **v2 added things PARITY doesn't mention:**
  - Browse by categories, tags, brands or shortcuts
  - The Poster tile
  - The in-cart count badge
  - Product and customer tax screens
  - A Customers screen
  - Split line
- **"Decimal quantities: check pos cart" can now be answered: missing.** The order builder throws "Quantity must be an integer >= 1" (`TU pos/dist/index.js:308`, `:958`).
- **"Stock guard: pos `stock`" is wrong.** The app refuses out-of-stock items only on a scan (the `onScan` path in `A/components/sale-screen.tsx`). Tapping a product never checks stock.

#### 1. Table

| Area | v2 behaviour (key monorepo paths) | This app (paths) | Status | Gap class | What is needed |
|---|---|---|---|---|---|
| Product sync, offline | Products and variations in separate collections; published-only; variation prefetch; change-signal cadence (`SE/collections/collection-descriptors.ts:610-802`, `SE/change-signal/*`, `SE/cadence-controller.ts`) | Pull replication and fingerprint reconcile for products and coupons (`A/lib/catalogue/start-catalogue.ts:63-72`) | partial | connector, app-local | A Woo stock adapter for `@tallyui/database` `startStockReconcile` (the `stock_levels` collection exists but no Woo adapter is exported); a published-only baseline in the app (`traits.isSellable`) |
| Browse by | Settings radio: All, Categories, Tags, Brands, Shortcuts; term gallery, crumb, pills narrowing a level (`M/pos/products/browse/*`, `ui-settings-form.tsx:295-335`, `products.LEDGER.md` "Browse by") | none | missing | connector | Category, tag and brand term feeds with parent, image and count (v2 syncs `categories`, `brands`, `tags`: `SE/scheduler/rx-scheduler-reference-fetcher.ts:83-107`); the gallery is app-local afterwards |
| Grid tile visual | Poster tile: picture fills the square; words on a scrim; tint when there's no picture; stock as a number; "Sold out" replaces the price; stacked cards on a variable product (`M/pos/products/tiles/{product-tile,tile-words,tile-image,variable-product-tile}.tsx`, ledger "Poster tile" 1-10) | 80px image over a text stack with a stock badge (`A/components/product-tile.tsx`) | partial | app-local (`shared:@tallyui/components` `PosterTile` preferred) | Poster layout, stock-number rules, Sold out |
| Tile fields | 9 fields: name, price, tax, on_sale, category, sku, barcode, stock_quantity, cost_of_goods_sold (`M/pos/products/ui-settings-form.tsx:44-54`) | 6 fields (`A/lib/catalogue/catalogue-view-state.ts:29-35`) | partial | app-local; connector for COGS | Add Tax and On sale; COGS needs the schema field |
| Grid size and view toggle | Grid/table toggle; 2–8 slider (`ui-settings-form.tsx:117-140`) | Slider and toggle (`A/components/catalogue-display-options.tsx:17`) | present | — | — |
| Product settings | Show out of stock; Sort by (11 fields) and direction; Variations style (drill/inline); meta-data keys; Customize filter bar (`ui-settings-form.tsx:150-290`) | Tile size, fields, columns, panel position, Restore (`A/components/catalogue-display-options.tsx`) | partial | app-local; connector for meta keys | Show out of stock, sort by/direction, variations style; meta keys need `meta_data` on the product schema |
| In-cart count | Badge on a tile or row with the in-cart quantity, animated on add (`products.LEDGER.md` "In-cart count" 1-2) | none | missing | app-local | Count from `sale.order.lineItems` by productId |
| Table view | Rows on the column grid; image, name with a sub-line ("N options", option chips); expanded variation rows (`M/pos/products/rows/*`, ledger "Table rows") | Sortable `ProductTable` with column switches (`A/components/catalogue-view.tsx`) | partial | app-local | Sub-line, option chips, variation rows |
| Variations: drill-in (default) | Tap a variable product: its variations open in place, tiles in the grid, rows in the table, with a back tile (`M/pos/products/{drill-in,variations-grid,variations-pane,deal-stack,level-back}.tsx`) | Full-screen "Choose an option", a flat list (`A/components/variant-chooser.tsx`) | partial | app-local | Variations as tiles/rows in the products pane |
| Variations: attribute pickers (inline) | Popover pickers; "Any" options; a sole option auto-selects; out-of-stock options disabled; Add blocked only when "Avoid overselling" is on (`M/pos/products/cells/variations-popover/{utils,select,buttons,stock-status}.tsx`, ledger 5-13) | none | missing | app-local | `ProductVariantPicker` + `traits.getVariantOptions` + `CatalogueEntry.picks` (all in TU) |
| Option chips | Variation option values as chips (`M/pos/products/option-chips.tsx`) | none | missing | app-local | Chips from `VariantSummary.options` |
| Product search | Products plus parents of matching variations; online exact-SKU leg; meta-key search (`products.LEDGER.md` "Relational search"; `SE/scheduler/exact-sku-leg.ts`; `M/components/search-meta-keys-bridge.tsx`) | TU `searchProducts`: product-level name, SKU, barcode only | partial | app-local; connector for the online leg | Match `getVariants()` SKU, barcode and title and return the parent |
| Quick filters | Bar, editor, preview, starters, "save current search" (`M/pos/products/filter-bar/{quick-filter-starters,capture-quick-filter}.tsx`) | Bar, editor, reorder (`A/components/quick-filter-*.tsx`, `A/lib/catalogue/quick-filters.ts`) | partial | app-local; connector | Starters and capture; brand and featured conditions need term data |
| Scan lookup and add | Scan resolves locally, then online (`sync-core/src/barcodeResolve.ts`, `M/pos/products/use-barcode.ts`); a variable parent warns "Choose a variation" and the code goes to search | Barcode, then SKU, then the variable parent opens the chooser (`A/lib/scan/lookup.ts`) | partial | app-local; connector for online resolve | v2's variable-parent behaviour; online resolve via `wcpos/v2/products` |
| Scanner settings | Prefix, suffix, minimum length, average key-time threshold (`M/settings/barcode-scanning/settings.tsx`) | Fixed constants (`A/lib/scan/wedge.ts`) | missing | app-local | Settings page saved per device |
| Scan sounds and haptics | Success and failure sounds; themes classic, soft, checkout; volume; haptic (`M/pos/products/{play-scan-sound.web,scan-sound-themes,use-scan-feedback}.ts`) | Message line only | missing | app-local | Web Audio feedback and settings |
| Scanning test | Capture trace, chart, suggestions (`M/settings/barcode-scanning/{index.tsx,use-scan-trace-capture.ts}`) | none | missing | app-local | Test panel |
| Direct scanner connect | USB HID, serial, Bluetooth LE devices, register and remove (`M/pos/products/use-{hid,serial}-scan.web.ts`, `use-ble-scan.ios.ts`, `M/settings/barcode-scanning/input-sources.tsx`, `packages/scanner/src/*`) | Keyboard wedge only | missing | shared (new scanner package) | Decoders and device identity |
| Camera scanning | Camera panel with decoder (`M/pos/products/{camera-scanner-panel.tsx,camera-decoder.web.ts,decode-loop.ts}`) | none | missing | app-local | Camera panel |
| Products admin | Products screen: inline editable price, stock quantity, COGS and barcode; edit modals for product (name, regular price, SKU, categories) and variation; autosave; Pro read-only plus edit capabilities (`M/products/{products,index}.tsx:296-461`, `M/products/cells/*`, `M/products/edit/*`, `use-catalogue-autosave.ts`) | none | missing | connector; server (Pro) | Product and variation writes (v2 writes through `wcpos/v2/push/…`, per `sync-core/src/fakeWriteServer.ts`) |
| Cost of goods | `payload.cost_of_goods_sold.values[0].defined_value`, editable column and tile field (`M/products/cells/cogs.tsx`) | none | missing | connector | `cost_of_goods_sold` on the Woo product schema (no occurrence in the connector's dist) |
| Open orders, tabs bar | Open orders as tabs in a bar above or below the cart (default bottom); status chips (saving, queued, refused, partly paid); ages; open orders held on the server as `pos-open` (`M/pos/cart/{open-orders-list,cart-tab-count,cart-header}.tsx`, cart.LEDGER 2-8, `SE/write-path/open-cart-hold.ts`) | Park and resume through `ParkedSales`, carts kept on this device (`A/lib/sale/parked-carts.ts`) | partial | connector, app-local | Server-held `pos-open` orders; a tab bar over the local parked carts is app-local now |
| Line quantity | `AmountField` keypad, select-on-focus (`M/pos/cart/cells/quantity-keypad.tsx`, `M/components/amount-field`) | TU `Cart` quantity | partial | app-local | Keypad entry |
| Line price and line edit | Price and regular price edited inline ("was" price); line dialog with name, price, regular price, SKU, quantity, categories, virtual, downloadable (`M/pos/cart/cells/edit-line-item/form.tsx`) | TU `Cart` `canEditPrice` → `PriceForm` | partial | `shared:@tallyui/pos` | `useSale.updateLine` for name, SKU and regular price |
| Split line | "Split" when quantity > 1 and the column setting allows it (`M/pos/cart/cells/quantity-keypad.tsx:100-107`, `M/pos/hooks/use-split-line-item.ts`) | none | missing | `shared:@tallyui/pos` | `useSale.splitLine(lineId)`; `addEntryToCart` merges the same variant into one line (`TU pos/dist/index.js:4687`) |
| Per-line quick discount | Configurable % keys in the price keypad (`M/pos/cart/quick-discount-keys.tsx`) | TU line Discount form, % or fixed | partial | app-local | % key buttons calling `sale.applyDiscount(lineId, …)` |
| Order-level discount | "Add Discount" writes a `pos-discount` coupon line, not a negative fee (`M/pos/cart/{add-discount,add-discount-sheet}.tsx`, `M/pos/hooks/{quick-discount,use-add-quick-discount}.ts`, cart.LEDGER 32-33, 38) | TU "Order discount" (an allocated TallyUI discount) | partial | connector; server | Quick-discount coupon line in order.create; the plugin's `pos-discount` virtual coupon (woocommerce-pos#1927) |
| Fees | Name, amount, "amount includes tax", tax status and class; negatives refused (`M/pos/cart/add-fee.tsx`, cart.LEDGER 34) | TU `ChargeForm`, gated on `order_create_v5` | partial | server | Check whether the WCPOS 2.0 `/status` advertises `order_create_v5` (PARITY: only the TallyUI fork does) |
| Shipping | Method select, title, amount, tax status, no tax class (`M/pos/cart/add-shipping.tsx`, `M/components/shipping-method-select.tsx`, cart.LEDGER 35) | TU `ChargeForm`, shipping kind | partial | server; connector | Same gate; a shipping-methods list for the select |
| Misc product | Name, price, SKU, tax, virtual, downloadable, categories (`M/pos/cart/add-misc-product.tsx`, cart.LEDGER 36) | Add charge → Custom item (name, price, tax) | partial | server; `shared:@tallyui/pos` | `addCustomLine` with SKU, virtual, downloadable, categories (they feed coupon eligibility) |
| Decimal quantities | Fractional quantity with the store's separators (`M/pos/cart/cells/quantity-keypad.tsx:32`) | none | missing | `shared:@tallyui/pos`; connector | Non-integer quantity in the builder and order.create |
| Stock guard | With prevent_overselling on: blocks adds and quantity raises over stock; server stock refusal shown beside the line (`M/pos/hooks/{stock-guard,stock-guard-hook,stock-rejection}.ts`, cells LEDGER 8) | Scan refuses `out_of_stock` only; taps never check | missing | connector; `shared:@tallyui/pos` | Expose prevent_overselling in `StoreSettings`; a guard in `useSale.add`/`setQuantity` |
| Tax at the store address | order-math settle, retax (`packages/order-math/src/{settle,retax-line}.ts`) | TU `TaxProvider`/`computeOrderTax`, `taxRates` at the store address, `taxRoundAtSubtotal` | present (base-address stores) | — | — |
| Tax based on customer address | Billing, shipping or base; cart retaxed when the customer changes (`M/contexts/tax-rates/{provider,use-tax-rates}.tsx`, `packages/order-math/src/retax-cart-lines.ts`, the `taxRates` collection) | none: `StoreSettings.taxRates` is "already filtered to the store's tax address" | missing | connector; `shared:@tallyui/pos` | Full rate table with locations, plus `tax_based_on`; an address rate matcher |
| Tax settings page | Read-only "Set in WooCommerce": enable taxes, prices entered with tax, display in shop and cart, suffix, tax totals, round at subtotal, shipping tax class (`M/settings/tax.tsx`) | none | missing | app-local; connector | Show the `StoreSettings` fields TU has; display settings need the connector |
| Tax rates viewer | Modal, a tab per class: country, state, postcode, city, rate, name, priority (`apps/main/app/(app)/(modals)/tax-rates.tsx`, `M/tax-rates/{tax-rates,rate-table,rate-rows}.tsx`) | none | missing | app-local | Built from `storeSettings.taxRates` (store-address rates only) |
| Product tax display | "Tax based on" popover (`M/components/product/tax-based-on/*`) | none | missing | app-local | Popover |
| Customer search and attach | Synced local customers, searchable offline (`M/components/customer-select.tsx`, the `customers` collection) | Online search, limit 20 (`A/components/customer-picker.tsx`, `A/lib/customers/customer-source.ts`) | partial | connector | Customers replication into a local collection |
| Guest | Guest by default | Guest | present | — | — |
| Customer create | Billing and shipping address, country/state select; Pro plus create capability (`M/pos/cart/add-customer.tsx`, `M/components/customer/customer-form.tsx`, cart.LEDGER 20-22) | Email, name, phone (TU `CustomerInput`) | partial | `shared:@tallyui/core`; connector | Address on `Customer`/`CustomerInput`; `createCustomer` sends it |
| Customer edit (cart) | Address dialog as property rows; save to the order only, or to the customer too; hidden for guests or without edit rights (`M/pos/cart/edit-cart-customer.tsx`, cart.LEDGER 24-26, 68) | none | missing | `shared:@tallyui/pos`; connector | Order billing/shipping in the builder and order.create; `updateCustomer` |
| Tax IDs | Structured tax IDs with billing and shipping, on the order and optionally the customer (`M/components/customer/tax-ids-form.tsx`, cart.LEDGER 25) | none | missing | `shared:@tallyui/core` + `pos`; connector | `Customer.taxIds`, an order tax-identity snapshot |
| Customers screen | Table (avatar, name, email, address, date), search, sync, add, edit, delete; read-only without Pro (`apps/main/app/(app)/(drawer)/customers/*`, `M/customers/{index,row,cells/*,edit/*}.tsx:144`) | none | missing | app-local (read-only); connector for writes | A list over `searchCustomers`; edit and delete need `updateCustomer`/`deleteCustomer` |
| Collections synced | products, variations, customers, coupons, orders, refunds, taxRates, categories, brands, tags (`SE/collections/collection-descriptors.ts:610-802`) | TU: products (variations embedded), coupons, `pos_orders` push, registers/closures/`tender_voids` on the device; order history online only (`createWooOrders`) | partial | connector | Customers, terms and tax rates feeds; Woo stock adapter |
| Change detection | Server change signal plus cadence (`sync-core/src/hybridChangeSignal.ts`, `SE/change-signal/*`) | Interval fingerprint reconcile (coupons every 15 min) | partial | connector; server | A change-signal source for Woo |
| Write path and conflicts | Record mutation queue; retry with the server's base; requeue rebuilt; dead letter; order revisions; money-divergence banner (`sync-core/src/recordMutationQueue.ts`, `SE/write-path/{conflict-resolution,order-revision,order-money-divergence}.ts`, cart.LEDGER 42-46) | TU outbox: order push, `needsAttention` and Retry, `reopenRefusedOrder`, `OrderContentMismatchError`; no product or customer writes | partial | `shared:@tallyui/pos`; connector | Server-versus-local totals divergence report; record writes |
| Sync status UI | Sync button; online status; database coverage page; storage-outage banner (`M/components/sync-button.tsx`, `M/health/*`, `M/pos/components/storage-outage-banner.tsx`) | Catalogue status line (`A/components/catalogue-view.tsx:103`); TU `SyncStatus` for the outbox (`A/components/sale-screen.tsx:407`) | partial | app-local | Sync button (`replication.reSync()`); a banner from `getStorageHealth` |

#### 2. Buildable now (app-local on TU 3.12.0, in the order a cashier meets them)

1. **Variation attribute pickers.** Touches `A/components/variant-chooser.tsx` and `A/components/sale-screen.tsx` (the `onSelect` flow). Uses `ProductVariantPicker`, `traits.getVariantOptions`, `CatalogueEntry.picks`. Copy from `M/pos/products/cells/variations-popover/{utils.ts,select.tsx,buttons.tsx,stock-status.tsx}` and `LEDGER.md` 5-13.
2. **Variations drill-in in the products pane** (the v2 default). Touches `A/components/catalogue-view.tsx`, `A/components/variant-chooser.tsx`, `A/lib/catalogue/catalogue-view-state.ts` (adds `variationsStyle`). Copy from `M/pos/products/{drill-in,variations-grid,variations-pane,level-back}.tsx`.
3. **Tile fields Tax and On sale, plus Sold out and stock-number rules.** Touches `A/components/product-tile.tsx`, `A/lib/catalogue/catalogue-view-state.ts`, `A/components/catalogue-display-options.tsx`. Copy from `M/pos/products/tiles/tile-words.tsx` and `products.LEDGER.md` Poster 2.
4. **In-cart count badge** on tiles and rows. Touches `A/components/product-tile.tsx`, `A/components/catalogue-view.tsx`. Copy from `products.LEDGER.md` "In-cart count".
5. **Product settings: Show out of stock, published-only baseline, Sort by and direction.** Touches `A/lib/catalogue/catalogue-view-state.ts`, `A/components/catalogue-display-options.tsx`, `A/components/catalogue-view.tsx`. Copy from `M/pos/products/ui-settings-form.tsx:150-200` and `products/LEDGER.md` 2-5.
6. **Variation-aware search** (a parent matches through a variation's SKU, barcode or title). Touches `A/components/catalogue-view.tsx` plus a new `A/lib/catalogue/search.ts`. Copy from `products.LEDGER.md` "Relational search".
7. **Scanned variable parent: v2 behaviour** (warn "Choose a variation", code goes to search; monorepo #2413). Touches `A/lib/scan/lookup.ts`, `A/components/sale-screen.tsx` (`onScan`). Copy from `M/pos/products/use-barcode.ts`.
8. **Scanner settings page** (prefix, suffix, minimum length, threshold). Touches `A/lib/scan/wedge.ts`, `A/lib/scan/use-wedge-scanner.ts`, a new `A/components/barcode-settings.tsx`. Copy from `M/settings/barcode-scanning/settings.tsx`.
9. **Scan sounds and haptic setting** (classic, soft, checkout; volume). Adds a new `A/lib/scan/scan-sound.ts`, touches `A/components/barcode-settings.tsx`. Copy from `M/pos/products/{play-scan-sound.web.ts,scan-sound-themes.ts,use-scan-feedback.ts}`.
10. **Open-orders tab bar over the local parked carts** (bar above or below, count, ages). Touches `A/components/sale-screen.tsx`, `A/lib/sale/parked-carts.ts`, a new `A/components/open-orders-bar.tsx`. Copy from `M/pos/cart/{open-orders-list,cart-tab-count}.tsx` and `cart.LEDGER.md` 2, 6.
11. **Per-line quick % discount keys.** Touches `A/components/sale-screen.tsx` and a new `A/components/quick-discount-keys.tsx`. Copy from `M/pos/cart/quick-discount-keys.tsx`.
12. **Tax rates viewer** (store-address rates, a tab per class). Adds a new `A/components/tax-rates.tsx` plus a route. Copy from `M/tax-rates/{tax-rates,rate-table,rate-rows}.tsx`.
13. **Read-only tax settings page.** Adds a new `A/components/tax-settings.tsx` built on `StoreSettings`. Copy from `M/settings/tax.tsx`.
14. **Customers screen, read-only** (online search list). Adds a new `A/app/customers.tsx` and `A/components/customers-screen.tsx`, reusing `A/lib/customers/customer-source.ts`. Copy from `M/customers/{index,row}.tsx` and `cells/*`.
15. **Catalogue Sync button and storage-outage banner.** Touches `A/components/catalogue-view.tsx`, `A/lib/catalogue/start-catalogue.ts`. Copy from `M/components/sync-button.tsx`, `M/pos/components/storage-outage-banner.tsx`.

#### 3. Shared needs

- `@tallyui/pos`: `useSale.splitLine(lineId)`. Same-variant adds merge into one line, so the app can't split.
- `@tallyui/pos`: decimal quantities in `OrderBuilder.addLine`/`updateQuantity` and the order.create envelope. The builder rejects non-integers.
- `@tallyui/pos`: a stock guard in `useSale.add`/`setQuantity`, driven by a `preventOverselling` setting. Needed for v2's prevent_overselling.
- `@tallyui/pos`: `useSale.updateLine` (name, SKU, regular price), plus `addCustomLine` with SKU, virtual, downloadable and categories. Needed for v2's line edit and misc-product dialogs.
- `@tallyui/pos`: tax rate matching by customer billing or shipping address, with retax on customer change. `StoreSettings.taxRates` is pre-filtered to the store address.
- `@tallyui/pos`: order billing and shipping address plus a tax-ID snapshot on `Order` and in order.create. Needed for v2's cart customer edit.
- `@tallyui/pos`: a money-divergence report (server totals against local). Needed for v2's totals-changed banner.
- `@tallyui/core`: `Customer`/`CustomerInput` gain billing and shipping address and `taxIds`. Needed for create, edit and tax IDs.
- `@tallyui/connector-woocommerce`: a stock reconcile adapter for `@tallyui/database` `startStockReconcile`. The `stock_levels` collection is unused.
- `@tallyui/connector-woocommerce`: category, tag and brand term feeds (parent, image, count). Needed for Browse by, quick-filter trees, brand and featured conditions.
- `@tallyui/connector-woocommerce`: customers replication into a local collection. Needed for offline customer search.
- `@tallyui/connector-woocommerce`: `updateCustomer` (and delete), sending address and tax IDs. Needed for customer edit and the Customers screen.
- `@tallyui/connector-woocommerce`: product and variation writes (price, stock, COGS, name, SKU, categories). Needed for the Products admin screen (Pro).
- `@tallyui/connector-woocommerce`: `cost_of_goods_sold` and `meta_data` on `wooProductSchema`. Needed for the COGS column and tile field, and meta-key search.
- `@tallyui/connector-woocommerce`: the full tax-rate table with locations, `tax_based_on`, and the tax display settings in `wooStoreSettings`. Needed for address-based tax and the tax settings page.
- `@tallyui/connector-woocommerce`: the prevent_overselling setting in `StoreSettings`. Needed for the stock guard.
- `@tallyui/connector-woocommerce`: a quick-discount (`pos-discount`) coupon line in order.create. Needed for v2's Add Discount (plugin woocommerce-pos#1927).
- `@tallyui/connector-woocommerce`: open orders held on the server as `pos-open` (push and pull). Needed for v2 open-order tabs that survive across devices.
- `@tallyui/connector-woocommerce`: online barcode and exact-SKU resolve via `wcpos/v2/products`. Needed for v2's scan miss → online lookup.
- `@tallyui/connector-woocommerce`: a change-signal source. v2 detects server changes instead of reconciling on an interval.
- `@tallyui/components`: `PosterTile`. Needed for v2's Poster grid tile.
- New shared scanner package (`@tallyui/scanner` or inside `@tallyui/pos`): HID, serial and BLE decoders and device identity, porting `packages/scanner/src/*`.
- Server to check on the dev store: does the WCPOS 2.0 `/status` advertise `order_create_v5`? If not, fees, shipping and misc lines stay hidden on a stock v2 plugin.


## Screenshots

This app (left) at `f34ffcf` against the local dev store, beside WCPOS v2 (right) at `5ac185b0e`. Captures at the desktop width. A blank cell means the screen does not exist in that app.

| Screen | This app | v2 |
|---|---|---|
| cart | ![cart, this app](screens/cart-tally.png) | ![cart, v2](screens/cart-v2.png) |
| cashier-sheet | ![cashier-sheet, this app](screens/cashier-sheet-tally.png) | ![cashier-sheet, v2](screens/cashier-sheet-v2.png) |
| catalogue | ![catalogue, this app](screens/catalogue-tally.png) | ![catalogue, v2](screens/catalogue-v2.png) |
| connect | ![connect, this app](screens/connect-tally.png) | ![connect, v2](screens/connect-v2.png) |
| display-options | ![display-options, this app](screens/display-options-tally.png) | ![display-options, v2](screens/display-options-v2.png) |
| health | ![health, this app](screens/health-tally.png) | ![health, v2](screens/health-v2.png) |
| order-detail | ![order-detail, this app](screens/order-detail-tally.png) | ![order-detail, v2](screens/order-detail-v2.png) |
| orders | ![orders, this app](screens/orders-tally.png) | ![orders, v2](screens/orders-v2.png) |
| receipt | ![receipt, this app](screens/receipt-tally.png) | ![receipt, v2](screens/receipt-v2.png) |
| register-close | ![register-close, this app](screens/register-close-tally.png) | ![register-close, v2](screens/register-close-v2.png) |
| register-closed | ![register-closed, this app](screens/register-closed-tally.png) | ![register-closed, v2](screens/register-closed-v2.png) |
| register-open | ![register-open, this app](screens/register-open-tally.png) | ![register-open, v2](screens/register-open-v2.png) |
| register-start | ![register-start, this app](screens/register-start-tally.png) | ![register-start, v2](screens/register-start-v2.png) |
| reports | ![reports, this app](screens/reports-tally.png) | ![reports, v2](screens/reports-v2.png) |
| settings |  | ![settings, v2](screens/settings-v2.png) |
| tender | ![tender, this app](screens/tender-tally.png) | ![tender, v2](screens/tender-v2.png) |
| tender-change | ![tender-change, this app](screens/tender-change-tally.png) | ![tender-change, v2](screens/tender-change-v2.png) |
