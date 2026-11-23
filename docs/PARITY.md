# Parity with WCPOS v2

What this till has and lacks against WCPOS v2 (the till at demo.wcpos.com/pos), row by row.

Generated on 2026-11-23 from the front desk's parity read of the same day (the till's rows only). It replaces this
file's 28 Sep version and `docs/v2-parity/AUDIT.md` and `docs/v2-parity/DEMO-PARITY.md`: all three were written
against TallyUI 3.10 to 3.19 and the monorepo's old `next` lane. Those versions are in git history.

- **Read at:** monorepo `origin/main` 3a43096a3 (v2 shipped to `main` on 9 Nov), tallyui `origin/main` aa45d28c,
  this repo `origin/main` 1778057.
- **How it was read:** from code. Nothing was run and no pixels were compared. Structure, columns, breakpoints and
  controls were read; spacing, colour and motion were not. The last pixel round (12 Nov, TallyUI 3.19.0) scored 8 of
  45 screens as matching, so "looks like" is lower than the figure below.
- **The pin:** the till pins `@tallyui/*` 4.2.0. The library has moved on since (cash rounding ADR-094, cart hover
  peek, removal undo rules); none of that is in the till until a release is bumped.

**Where it stands: 51 of 176 judged rows match (29%); 77 partial, 48 missing, 5 not reached.** The frame is v2's:
rail, sale screen, cash tender, register and browse screens. Most of what a v2 cashier does beyond a plain cash sale
is not there yet.

## The ten gaps that most stop it

1. **Payment:** only Cash and a typed card reference. No store gateways, no order-pay webview, no card readers, and
   the order status is hard-coded.
2. **No refunds in the till.**
3. **No real printing:** every print is the browser dialog, saved printers are never used, no drawer kick.
4. **Every management write is absent:** order edit, re-open and delete; product price and stock edit; customer open
   and edit; coupon add and edit.
5. **Orders and customers are fetched online, page by page** (v2 is local-first). Reports cover this device only,
   count rejected and pending sales, and ignore refunds.
6. **Tax fidelity:** the cart ignores `tax_display_cart`, always itemises, labels "Tax n%". There is no tax exempt;
   the till's tax and number-format overrides are locked; address tax needs the fork plugin.
7. **Cart depth:** no line edit dialog, decimal quantities, stock guard, customer address edit, order meta or
   remove-undo; thin fee, shipping and custom-item forms.
8. **No store pick, no store or register switch, no manager approval at close.**
9. **English is hard-coded; no translations.**
10. **Safety nets and online legs:** no root reset screen, no plugin-too-old gate, no tab take-over, no online product
    lookup on search or scan, and carts are never saved to the server.

The order they close in: A, the wiring pass (mount what `@tallyui/*` already has, and bump the pin when a release
carries cash rounding); B, money correctness; C, refunds; D, payment from the store's descriptors, then readers;
E, printing and the drawer; F, local-first orders and customers, then the management writes; G, store and register
pick and approval; H, safety nets; I, translations; then the periphery (customer display, bell feed, mini-apps).

## How to read the table

- **State:**
  - **MATCH:** same capability and same shape of UI, as far as code shows.
  - **PARTIAL:** some of it is there.
  - **MISSING:** none of it is there.
  - **UNVISITED:** not reached, and left out of the percentage.
- **Kind:** look, behaviour or money. **Size:** S is one small PR, M several PRs, L a workstream.
- **Paths:**
  - `core/` is the monorepo's `packages/core/src/screens/main/`;
  - `W/` is this repo's `apps/pos/`;
  - `L/` is tallyui's `packages/`;
  - `C/` is tallyui's `connectors/woocommerce/src/`.
- A library component counts only when this app mounts it on a reachable route.
- **Capability gates:** several cart features are gated on the store's `orderCreate` version
  (`W/components/sale-screen.tsx:82`, default 3). A stock WCPOS 2.0.4+ store gets 6 (fees, shipping, custom items,
  coupons). Address-based tax (8) and cash rounding need the TallyUI fork of the plugin.
- **Updating a row:** a PR that changes a row's state edits that row here and names the row number in its body. The figures above and under Counts are the read's and are not recounted per PR.

## The table

### Connect, login, store, cashier

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 1 | Connect a store: URL, staged checks, demo button | core/../auth (url input) | W/components/connect-form.tsx | MATCH | – | – | |
| 2 | Saved sites and WordPress users, re-authenticate, remove | auth sites list | W/components/saved-sites.tsx | MATCH | – | – | |
| 3 | Cloudflare bot-challenge handling | auth/hooks/bot-challenge.ts | none | MISSING | behaviour | S | A store behind a challenge just fails to connect |
| 4 | Store pick (multi-store) | auth store select | W/lib/catalogue/store-info.ts:97 | MISSING | behaviour | M | `const [store] = await response.json()`: always the first store, no picker |
| 5 | User sheet: sales today, in the drawer, hand the till to, sign out | core/pos/cart/user-sheet.tsx | W/components/cashier-sheet.tsx | MATCH | – | – | |
| 6 | User sheet: switch store, switch register, desktop app, open-carts count | user-sheet.tsx | cashier-sheet.tsx:199 | MISSING | behaviour | M | "One store, no Switch"; the library sheet has the rows, the app does not mount it |
| 7 | Capability gating by WordPress caps | core hooks | W (createBlockedReason) | PARTIAL | behaviour | M | Only "New customer" is gated; v2 has eleven gates. From the Woo PARITY.md, not re-traced |
| 8 | About dialog | core/components/drawer-content/version.tsx | W/components/about-dialog.tsx | PARTIAL | look | S | No server versions, licence status or release-notes link |

### Shell and layouts

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 9 | Rail: nine areas, order, labels, health badge | apps/main drawer layout | W/lib/layout/rail-routes.ts | MATCH | – | – | |
| 10 | Rail width follows Scale | drawer rail 56/64/80 | W/components/app-rail.tsx | PARTIAL | look | S | Fixed `w-16` |
| 11 | Phone drawer | drawer | W/components/drawer-content.tsx | MATCH | – | – | |
| 12 | Screen bar: menu, store, offline badge, bell, avatar | core/components/bar-controls | W/components/register-bar-shell.tsx | MATCH | – | – | |
| 13 | Notification bell feed | core/components/notification-bell | W/components/notification-bell.tsx | MISSING | behaviour | L | Empty sheet only: no feed, kinds or mark-read |
| 14 | Wide breakpoint (768 wide, 480 high) | device.ts | W/lib/layout/wide.ts | MATCH | – | – | |
| 15 | Sale screen splits into two panes | split at 640 | wide.ts `SALE_SPLIT_MIN_WIDTH` 900 | PARTIAL | look | S | 640 to 899 px gets the phone layout (small tablets in portrait) |
| 16 | Resizable panes | packages/resizable-panels | W/components/panel-resize-handle.tsx | UNVISITED | – | – | A handle exists; not compared |
| 17 | Phone tab bar (Products / Cart) | pos tabs | W/components/pos-phone-tab-bar.tsx | PARTIAL | look | S | No count animation or haptic |
| 18 | Splash and loading | screens/splash | W/components/catalogue-unavailable.tsx | PARTIAL | look | S | Plain "Connecting to…" text, no logo or progress bar |
| 19 | Light, dark, system | theme settings | W/components/settings/theme-settings.tsx | MATCH | – | – | |
| 20 | Themes, fonts, Scale, icon set | theme settings | theme-settings.tsx, W/themes.css | PARTIAL | look | S | Ten themes, fonts and Scale are there; no icon-set choice |
| 21 | Translations | i18n throughout | none in W; L/components/src/i18n is en only | MISSING | behaviour | L | The app hard-codes English and does not use the library's `useT` |
| 22 | App hotkeys and the shortcuts sheet | pos hooks | W/lib/sale/till-chords.ts, keyboard-shortcuts-sheet.tsx | MATCH | – | – | Same eight bindings |

### Offline, sync, errors, health

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 23 | Online, offline and unreachable toasts and pill | core/components/online-status | W/lib/online/online-status-logger.tsx | MATCH | – | – | |
| 24 | Session hold banner | core/components/session-hold-banner | W/components/session-hold-banner.tsx | MATCH | – | – | |
| 25 | App-too-old gate | core/update-required.tsx | W/components/update-required.tsx | MATCH | – | – | |
| 26 | Plugin-too-old gate | core/compat-gate.tsx, upgrade-required.tsx | none | MISSING | behaviour | M | No "update the plugin to continue" |
| 27 | Root error screen with reset and unsent count | root error | W/app/_layout.tsx | MISSING | behaviour | M | No root boundary: a render crash has no recovery |
| 28 | Per-route error boundaries | per-route | W/app/catalogue.tsx:18 | PARTIAL | behaviour | S | Catalogue route only |
| 29 | Till open in another tab: take over | live tab gate | W/lib/storage-start-failure.ts:9 | PARTIAL | behaviour | S | "Close it, then reload"; no take-over |
| 30 | Not found | +not-found | W/app/+not-found.tsx | MATCH | – | – | |
| 31 | Sync button: long press clears and re-syncs | core/components sync-button.tsx | W/components/table-surface.tsx | PARTIAL | behaviour | S | Tap only; no clear-and-sync or collection reset |
| 32 | Store health: database | core/health | W/components/health-screen.tsx, database-counts.tsx:39,89 | PARTIAL | behaviour | L | No On-server or Coverage columns, no Clear and re-download, no Conflicted, Attention or Registers panels |
| 33 | Store health: performance | core/health | W/app/health/performance.tsx | MATCH | – | – | Content not compared line by line |
| 34 | Logs | core/logs | W/components/logs-screen.tsx | PARTIAL | behaviour | S | No share-debug or today counts |
| 35 | Support (embedded Discord) | core/support | W/components/support-screen.tsx | MISSING | behaviour | M | Two GitHub links |
| 36 | Mini-apps, printer wizard | core/mini-apps | none | MISSING | behaviour | L | No host |
| 37 | Pro upgrade strip | core/components/upgrade-notice | none | MISSING | behaviour | S | No Pro or licence surface (may be a deliberate omission) |

### Settings

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 38 | General: store name, language | core/settings/general.tsx:242 | W/components/settings/general-settings.tsx | PARTIAL | behaviour | S | Locked "Set in WooCommerce"; v2 edits them |
| 39 | General: currency position, separators, decimals, grouping | general.tsx | general-settings.tsx, W/lib/money/store-money.ts | PARTIAL | money | M | Locked to the store; no lakh or wan grouping |
| 40 | General: default customer, customer is cashier, restore server settings | general.tsx | general-settings.tsx:151 | MATCH | – | – | |
| 41 | Tax: based on, totals display, shop and cart display, suffix | core/settings/tax.tsx:142-218 | W/components/settings/tax-settings.tsx:60-100 | PARTIAL | money | M | Every row is locked; a v2 till can override them |
| 42 | Barcode scanning settings | core/settings/barcode-scanning | W/components/settings/barcode-scanning-settings.tsx:287 | PARTIAL | behaviour | M | Thresholds, prefix, suffix, sound, test panel match; no BLE, keyboard register flow, device chooser or reset notice |
| 43 | Customer display (settings page, pairing, second screen) | core/settings/customer-display, core/pos/customer-display | none mounted (L has screen and pairing) | MISSING | behaviour | L | Library has it; the app mounts none of it |
| 44 | Products display options | core/pos/products/ui-settings-form.tsx | W/components/catalogue-display-options.tsx | PARTIAL | look | S | No meta-data keys field |
| 45 | Cart display options | core/pos/cart ui-settings-form | W/components/cart-settings.tsx | PARTIAL | behaviour | S | Auto-show and auto-print receipt not found here |
| 46 | Column switches with "Restore default settings" | core/components/ui-settings | W/components/area-display-options.tsx | MATCH | – | – | |
| 47 | Column drag reorder and resize | columns-form.tsx, data-table/resize.tsx | W/lib/area-columns.ts | MISSING | look | S | "Reordering is not offered"; no resize in any table |

### Catalogue, search, barcode, variations

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 48 | Grid and table views, tile size 2 to 8 | core/pos/products | W/components/catalogue-display-options.tsx | MATCH | – | – | |
| 49 | Tile fields | products/tiles | L catalogue tile fields | PARTIAL | look | S | No cost-of-goods field; tile visuals not checkable from code |
| 50 | Product sort | ui-settings-form (11 fields) | catalogue-display-options.tsx:28 | PARTIAL | behaviour | S | Five fields; no date, popularity, stock status, menu order, type |
| 51 | Large catalogues | products/index.tsx (paged DB query) | W catalogue-context.tsx | PARTIAL | behaviour | M | Whole collection loaded into memory and sorted; fine small, a risk at tens of thousands |
| 52 | Search: fields, debounce | QuerySearchInput | L/pos/src/product/search-products.ts | PARTIAL | behaviour | S | No merchant meta keys, no debounce |
| 53 | Online lookup when a search or scan misses locally | core/hooks/barcodes/use-barcode.ts ("Searching store…") | none | MISSING | behaviour | M | Local only. Confirmed for scan; for typed search v2's server leg was not settled |
| 54 | Browse by categories, tags | browse | W catalogue-view-state.ts:18 | MATCH | – | – | |
| 55 | Browse by brands, shortcuts | browse | catalogue-display-options.tsx | MISSING | behaviour | M | Listed but disabled |
| 56 | Filter pills | filter-bar-layout.ts | L filter-bar-pills.ts | PARTIAL | behaviour | S | No Featured or Brands |
| 57 | Quick filters editor | filter-bar | W/components/quick-filter-editor.tsx | PARTIAL | behaviour | S | No brand or featured conditions |
| 58 | Variations: in place, popover, expanded rows; attribute picker | variations-popover, drill-in | W/components/variation-picker.tsx | MATCH | – | – | |
| 59 | Wedge scan detection and settings | use-barcode.ts | L scan-settings, wedge | MATCH | – | – | |
| 60 | Scanner transports | hid, serial, BLE, camera | L app-scan-hub, camera scan | PARTIAL | behaviour | S | No BLE (iOS) |
| 61 | Scan: local lookup, not found, several matches | use-barcode.ts | L scan/lookup.ts, sale-scan.ts | MATCH | – | – | |
| 62 | Scan of a variable parent goes to search | use-barcode.ts | L sale-scan.ts | MATCH | – | – | |
| 63 | Scan of an out-of-stock item | use-barcode.ts | L scanOutcome | PARTIAL | behaviour | S | Always refused; v2 refuses only when out-of-stock is hidden and treats backorder as sellable |
| 64 | Scan while a dialog is open | `posSectionActive` | – | UNVISITED | – | – | |

### Cart: lines, fees, shipping, discounts, customer, tax, park

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 65 | Add: increment or new line, split line | pos hooks | L use-sale.ts | MATCH | – | – | |
| 66 | Decimal quantities | quantity keypad | L/pos/src/order/order-builder.ts:600 | MISSING | money | M | Throws "Quantity must be an integer >= 1" |
| 67 | Stock guard (overselling) | hooks/stock-guard | W sale-screen.tsx addEntry | MISSING | behaviour | M | No check on tap or at checkout |
| 68 | Cart columns | cart/cells | W/components/cart-settings.tsx:130 | PARTIAL | look | S | No Subtotal or Actions column and no tax displays on Price, Subtotal or Total (not in the library). Regular price, On sale and column order (Move up / Move down for v2's drag) are mounted since #635 |
| 69 | Quantity and price keypads, quick-discount keys | quantity-keypad, quick-discount-keys.tsx | L cart.tsx LinePopover | MATCH | – | – | |
| 70 | Line edit dialog (name, SKU, regular price, tax status and class, meta) | cells/edit-line-item/form.tsx | L `updateLine` unwired | MISSING | money | M | No form in the app; library covers name, SKU, regular price only |
| 71 | Line attributes, meta, notes | product-name | L CartLine | PARTIAL | look | S | Attributes and SKU show; meta and line notes not verified |
| 72 | Remove line with Undo | use-remove-line-item | W/lib/removed-from-cart-toast.ts:8 | MISSING | behaviour | S | Toast without Undo at 4.2.0; library main has since gained removal undo |
| 73 | Miscellaneous product | cart/add-misc-product.tsx | W/components/cart-add-menu.tsx | PARTIAL | money | S | No virtual, downloadable, categories; needs orderCreate 5. "+ SKU" is mounted since wiring pass 2 |
| 74 | Fee: fixed or percent, includes tax, tax class | cart/add-fee.tsx | cart-add-menu.tsx ChargeForm | MATCH | – | – | |
| 75 | Shipping: method, amount, tax | cart/add-shipping.tsx | cart-add-menu.tsx | PARTIAL | money | S | No method select. Amount Includes Tax and "No tax" (orderCreate 6) are mounted since wiring pass 2 |
| 76 | Order-level discount | cart/add-discount-sheet.tsx (pos-discount coupon line) | cart-add-menu.tsx | PARTIAL | money | M | A library discount, not v2's server coupon line; reconciliation with Woo totals not traced |
| 77 | Coupons: apply, validate, remove | cart/add-coupon.tsx | W/components/coupon-entry.tsx | PARTIAL | money | S | Validation is faithful; pick from synced coupons only, no typed code found; needs orderCreate 6 |
| 78 | Per-line coupon discount display | cells/subtotal | – | UNVISITED | – | – | |
| 79 | Customer search and pick, guest | cart/cart-header.tsx | W/components/customer-picker.tsx | PARTIAL | behaviour | M | Online search only, no local customers: cannot pick offline |
| 80 | Add customer from the cart | cart/add-customer.tsx | W/components/add-customer-dialog.tsx | PARTIAL | behaviour | S | Name, email, phone; no addresses |
| 81 | Edit the cart customer's billing and shipping | cart/edit-cart-customer.tsx | L `setAddresses` unwired | MISSING | money | M | |
| 82 | Tax recalculated by customer address | totals hooks | W sale-screen.tsx:150-152 | PARTIAL | money | S | Only at orderCreate 8 (fork plugin); otherwise shop base |
| 83 | Tax totals: itemised or single, rate names | cart/totals/taxes.tsx:24-52 | L CartTotal | PARTIAL | money | S | Always itemised, label "Tax n%"; `tax_total_display` is read only in settings |
| 84 | Cart prices incl or excl tax per `tax_display_cart` | product-total.tsx:25, subtotal.tsx:27 | L order-builder.ts:71,233 | PARTIAL | money | M | Shows prices in the mode they are entered in; a store entering excl and displaying incl shows different figures |
| 85 | Tax exempt | edit-order-meta/tax-exempt-row | none | MISSING | money | M | |
| 86 | Order note | cart/note-row.tsx | W/components/cart-note-row.tsx | MATCH | – | – | |
| 87 | Order details sheet (hand-over, cashier, currency, custom fields) | cart/order-sheet.tsx | W/components/order-details-sheet.tsx | PARTIAL | behaviour | M | Note, Void, Print, Close only; library `setMeta` unwired |
| 88 | Save the open order to the server | order-sheet save-to-server | none | MISSING | behaviour | M | Carts are local until checkout |
| 89 | Park and resume: open-order tabs | cart/tabs.tsx, open-orders-list.tsx | W/components/open-order-tabs.tsx, parked-carts | PARTIAL | behaviour | M | Tabs, ages, new order are there; local to this device, no server pos-open orders |
| 90 | Void with Undo | use-void-order | W use-void-sale.ts | MATCH | – | – | |
| 91 | Totals-changed banner | cart/totals-changed-banner.tsx | – | UNVISITED | – | – | |
| 92 | Cart header, customer pill, add menu | cart-header.tsx | W cart-add-menu.tsx:77 | MATCH | – | – | Look not checkable from code |
| 93 | Pay button and its states | cart/buttons/pay.tsx | L CartFoot | PARTIAL | behaviour | S | With no outbox the tender reads "Taking payment arrives in the next update" (sale-screen.tsx:393) |
| 94 | Currency and decimal formatting on the sale | – | W/lib/money/store-money.ts | UNVISITED | – | – | |

### Tender, split tender, rounding, change

How v2 pays (`core/pos/checkout/checkout.tsx:68-89`): if the store serves `wcpos/v2/payment-methods`, v2 draws its own tender from the store's per-gateway descriptors (manual, webview, smart reader, on-device reader, stored value, invoice; each with its order status, rounding and drawer rule); otherwise, and always as a "Legacy" tab, it loads WooCommerce's order-pay page in a webview. The Woo till asks the store nothing: two hard-coded tiles (`W/components/tender-pane.tsx:16-20`), then the connector marks the order completed. Tender can be like-for-like only once the till reads those descriptors.

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 95 | Payment methods from the store (gateway tiles, per-method fields) | checkout/tender/tiles.ts | tender-pane.tsx:16-20 | MISSING | behaviour | L | `pos_cash` and `pos_card` only |
| 96 | Order-pay webview (Legacy tab) | PaymentWebview | none | MISSING | behaviour | L | |
| 97 | Checkout title bar and tabs | checkout-body-view.tsx | W/components/checkout-title-bar.tsx | PARTIAL | look | S | No Payments / Legacy tabs |
| 98 | Cash keypad | tender/tender-pane.tsx | tender-pane.tsx | MATCH | – | – | |
| 99 | Quick-cash chips | tender-figures.ts:25 | L `quickTenderedAmounts` | MATCH | – | – | |
| 100 | Change due | tender-pane | tender-pane (`changeMinor`) | MATCH | – | – | |
| 101 | Cash rounding | cash-rounding-hook.ts, payments/rounding-sweep.ts | C/commands/transport.ts:205, store-settings.ts:232 | PARTIAL | money | M | Till at 4.2.0 shows no rounded due; library ADR-094 is merged after 4.2.0 and unreleased; fork plugin only; v2 ties rounding to the payment |
| 102 | Card capture | payments/server/server-leg.ts, drivers | tender-pane "Terminal reference" | PARTIAL | money | M | Free text; nothing is captured or confirmed |
| 103 | Store-run smart readers at checkout | server-leg.ts, terminal-leg-view.tsx | W/lib/card-readers/smart-readers.ts | MISSING | behaviour | L | Settings remembers a reader; the tender never uses it |
| 104 | On-device readers (Stripe Terminal, SumUp, Tap to Pay) | apps/main/lib/payment-drivers.ts | none | MISSING | behaviour | L | |
| 105 | Card readers settings | core/settings/card-readers | W/components/settings/card-readers-settings.tsx | PARTIAL | behaviour | M | Smart-reader pick only |
| 106 | Tips | ledger pane | none | MISSING | money | M | |
| 107 | Several payments, payment ledger | ledger pane | W ledger-pane.tsx; C transport.ts:347 | PARTIAL | behaviour | M | Only on stores reporting `order_payments_list` |
| 108 | Split by ways and by percent | split plan | W/components/split-plan.tsx | MATCH | – | – | |
| 109 | Split by items | unit-stepper.tsx | L/pos/src/tender/split-units.ts unmounted | MISSING | behaviour | M | |
| 110 | Send invoice / pay later | submit-gateway-payment.ts | none | MISSING | behaviour | M | |
| 111 | Cancel a taken payment | cancel-payment-view.tsx | W/components/cancel-payment-view.tsx | PARTIAL | money | M | Written to a local journal; nothing voided or refunded at a processor |
| 112 | Offline payment | per descriptor | tender-pane offline dialog | PARTIAL | money | S | Card references are recorded offline too |
| 113 | Slow-save notice | store not answering | tender-pane | MATCH | – | – | |
| 114 | Order status after payment | descriptor `order_status` | C/commands/transport.ts:243 | PARTIAL | money | M | Hard-coded completed (pending on the ledger path) whatever the gateway |
| 115 | Totals and tax arithmetic | packages/order-math | L/core/src/tax/woocommerce, coupons/woocommerce/order-totals.ts | PARTIAL | money | S | A direct port; possible drift in coupon remainder split, percent-fee rounding and the non-Woo path. Not tested here |

### Receipts and printing

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 116 | Paid moment | core/receipt/receipt-stage.tsx | W/components/receipt-paid-moment.tsx | PARTIAL | look | S | No "printed to", "awaiting store", "invoice sent" states |
| 117 | Receipt template switcher | receipt | W/components/receipt-template-row.tsx | PARTIAL | behaviour | S | Store templates on web; thermal shown as an HTML preview |
| 118 | Printer switcher on the receipt | receipt | receipt-template-row.tsx | MISSING | behaviour | M | Always "Browser print dialog" |
| 119 | Receipt zoom | receipt | W/components/receipt-zoom.tsx | MATCH | – | – | |
| 120 | Download PDF | receipt | none | MISSING | behaviour | S | |
| 121 | Email receipt and the offline queue | receipt/email-queue | W/components/receipt-email.tsx | MATCH | – | – | |
| 122 | Sync order from the receipt | receipt | W/components/receipt-sync-order.tsx | MATCH | – | – | |
| 123 | Copy marking on reprint | receipt | W/components/receipt-identity.tsx | PARTIAL | look | S | Wording not compared |
| 124 | Auto print | receipt/headless-auto-print.tsx | W/components/auto-print-setting.tsx | PARTIAL | behaviour | S | Opens the browser dialog; v2 prints silently to a printer |
| 125 | Built-in receipt layout | packages/receipt-renderer | L/components/src/sale/receipt.tsx | PARTIAL | look | S | No logo or QR outside store templates |
| 126 | Real printer output (network, USB, Bluetooth, ePOS, Star, cloud) | packages/printer | W/lib/receipts/print-receipt.ts:64; L/pos/src/print/escpos unused | MISSING | behaviour | L | Everything is `window.print`; the library's ESC/POS code is not used |
| 127 | Printer profiles and printer per template | core/settings/printer, printing | W/components/settings/printing-settings.tsx, printer-dialog.tsx | PARTIAL | behaviour | M | Network profiles are saved and routed in settings, then never used; no code page, columns, cut |
| 128 | Printer discovery, test print, setup report | packages/printer | none | MISSING | behaviour | M | |
| 129 | Cash drawer kick | `autoOpenDrawer`, descriptor `open_drawer` | L/pos/src/print/escpos/drawer.ts unused | MISSING | behaviour | M | |
| 130 | Reprint and email from Orders | orders view → receipt | W/components/order-detail.tsx | PARTIAL | behaviour | S | Print yes; email only on the sale screen |

### Refunds

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 131 | Refund entry, form (lines, amount, reason) and arithmetic | core/orders/refund/form.tsx, calculate-refund.ts | L/components/src/order/refund-form.tsx, L/pos/src/refund unmounted | MISSING | money | L | No refund import anywhere in the app |
| 132 | Refund to the original method or cash, sent to the store | refund form | C/orders.ts:170 reads refunds only | MISSING | money | M | The connector has no refund write |
| 133 | Refunded order display | order view | W/components/order-detail.tsx RefundCard | MATCH | – | – | |

### Cash sessions

v2 has all of these on `origin/main`; they are not TallyUI-only.

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 134 | Register picker | core/pos/cart/register-picker.tsx | W/components/register-controls.tsx (`registers={[]}`) | MISSING | behaviour | M | One local register |
| 135 | Open register with float | open-register-card.tsx | L RegisterColumn | MATCH | – | – | |
| 136 | Paid in, paid out, no sale | movement-sheet.tsx | L/components/src/register/movement-sheet.tsx | MATCH | – | – | "Open the drawer" has nothing behind it (row 129) |
| 137 | Register panel, X-report | register-panel.tsx | register-controls.tsx:73-83 | PARTIAL | look | S | Centred dialog, not a side panel; no Print X-report here |
| 138 | Count at close with denominations, over and short | core/components/register-count | L RegisterCount | MATCH | – | – | |
| 139 | Manager approval over the variance threshold | register-count approval fields | register-controls (no `approve`) | MISSING | money | M | The close is refused with nowhere to approve |
| 140 | Sessions synced to the store | register sync | C/commands/register-transport.ts | MATCH | – | – | |
| 141 | Closures list, panel, print, CSV, recount | core/reports/closures | W closure-list.tsx, closure-panel.tsx, closure-print.tsx | PARTIAL | behaviour | S | No recount; browser print |

### Orders list and order view

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 142 | Orders are on the device | core/orders/index.tsx (local collection) | W/components/orders-screen.tsx | PARTIAL | behaviour | L | Fetched online a page at a time; offline shows only this device's unsent sales |
| 143 | Order columns | 17 cells, initial-settings.json | W/components/orders-table.tsx | PARTIAL | look | M | Six columns; no billing, note, created via, cashier, shipping, register, other dates |
| 144 | Sort by column | 9 sortable fields | orders-table.tsx | MISSING | behaviour | M | Fixed date-descending |
| 145 | Day headings, row keyboard | orders/index.tsx | orders-table.tsx | MATCH | – | – | |
| 146 | Paging and "Showing N of M" | data-table/footer.tsx | W table-surface.tsx | MATCH | – | – | |
| 147 | Search and scan | orders/index.tsx | orders-screen.tsx | MATCH | – | – | |
| 148 | Filter pills | orders/filter-bar.tsx (7) | L order-filter-bar.tsx; C/orders.ts:180 | PARTIAL | behaviour | S | No payment-method or register pill; cashier pill offers only the signed-in cashier |
| 149 | Tap status or customer to filter | cells | orders-table.tsx | MATCH | – | – | |
| 150 | Open an order | cells/actions.tsx | orders-table.tsx | MATCH | – | – | |
| 151 | Order dialog: View, Edit, JSON tabs | orders/edit/modal.tsx, record-dialog | order-detail.tsx:295 | PARTIAL | look | M | View only |
| 152 | Identity line and status badge | orders/edit/view.tsx | order-detail.tsx | PARTIAL | look | S | Date only; no store, cashier, created via |
| 153 | View: items, totals, payments, refunds, customer | view.tsx | order-detail.tsx | MATCH | – | – | |
| 154 | Re-open an order into the cart | orders/use-reopen-order.ts | none (refused-order reopen only) | MISSING | behaviour | M | |
| 155 | Delete an order | view.tsx | none | MISSING | behaviour | S | |
| 156 | Invoice actions (cancel, send again) | view.tsx | none | MISSING | behaviour | S | |
| 157 | Edit an order (status, customer, addresses, note, meta) | orders/edit/form.tsx | none | MISSING | behaviour | L | |
| 158 | Per-order sync | view.tsx | order-detail.tsx | MATCH | – | – | |

### Products, customers, coupons screens

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 159 | Products columns | core/products/products.tsx | W/components/products-screen.tsx | PARTIAL | look | S | No brands, cost, date created |
| 160 | Inline price and sale price edit | products/cells EditablePrice | products-screen.tsx:1-11 "read-only" | MISSING | money | L | |
| 161 | Inline stock and Manage switch | cells/stock-quantity.tsx | products-screen.tsx | MISSING | behaviour | M | |
| 162 | Product and variation edit dialog, delete, per-row sync | products/edit | none | MISSING | behaviour | L | |
| 163 | Products sort | products.tsx | products-screen.tsx | PARTIAL | behaviour | S | Price columns not sortable |
| 164 | Products variations | display-options.tsx | products-screen.tsx | PARTIAL | behaviour | S | No per-attribute selects or variation search in the drilled view |
| 165 | Products filter chips | filter bar | products-screen.tsx | PARTIAL | behaviour | S | No Featured or Brands |
| 166 | Products search, scan, count | products.tsx | products-screen.tsx | MATCH | – | – | |
| 167 | Customers columns | initial-settings.json | W/components/customers-screen.tsx | PARTIAL | look | S | No role, username, shipping, modified |
| 168 | Customers paging | data-table | customers-screen.tsx; C/customers.ts:120-136 | PARTIAL | behaviour | M | One server page only, though the connector can page |
| 169 | Customers search | local query | customers-screen.tsx | PARTIAL | behaviour | S | Server search; sort applies to loaded rows only |
| 170 | Open and edit a customer | core/customers/edit/form.tsx | customers-screen.tsx:197 (button disabled) | MISSING | behaviour | L | Rows cannot be opened |
| 171 | Add customer (full form) | core/customers/add.tsx | W/components/add-customer-dialog.tsx | PARTIAL | behaviour | M | Four fields; no addresses, company, role, tax IDs |
| 172 | Coupons list, columns, sort | core/coupons | W/components/coupons-screen.tsx | MATCH | – | – | |
| 173 | Coupons filters | coupons/filter-bar.tsx | coupons-screen.tsx | MATCH | – | – | |
| 174 | Coupons inline edit | coupons/cells | coupons-screen.tsx ("no inline editing") | MISSING | money | M | |
| 175 | Coupon add, edit, delete | coupons/add.tsx, edit | none | MISSING | money | L | |

### Reports and tax rates

| # | Row | v2 file | TallyUI file | State | Kind | Size | What differs |
|---|---|---|---|---|---|---|---|
| 176 | Report scope: store, register, cashier | core/reports/scope.tsx | W/components/reports-screen.tsx | PARTIAL | behaviour | L | This device's local sales only |
| 177 | Report totals | reports/report/summary.ts (net = gross − refunded; status mode) | W/lib/reports/sales-room.ts:66-100, sales-summary.ts:7 | PARTIAL | money | M | Sums every in-range sale including rejected and pending; no refund subtraction |
| 178 | Periods, presets, compare, hourly chart | reports/date-button.tsx | reports-screen.tsx | MATCH | – | – | |
| 179 | Report cards | reports/cards (9) | W/components/report-cards.tsx | PARTIAL | look | S | No Brands or Refunds cards |
| 180 | Report detail tables, CSV, print | reports/panels (11) | W/lib/reports/sales-tables.ts | PARTIAL | behaviour | M | No refunds, brands, registers, stores panels; six order columns |
| 181 | Tax rates viewer | core/tax-rates/rate-table.tsx | W/components/settings/tax-rates-dialog.tsx | PARTIAL | look | S | A Select for classes, not tabs; sync icon disabled |

## Recorded rulings

These differences from v2, and choices about scope, were made on purpose. A row above that touches one of them keeps
it until the ruling changes.

- **The sale screen splits into two panes from 900 px wide, not v2's 640** (row 15; front desk, 19 Nov 2026). At
  768x1024 with the 60% default the cart is 277 px and drops its Price column
  (`docs/v2-parity/till-split-768-cart.png`). Revisit once the app has translations and the cart has a narrow layout.
- **Till chords** (row 22): Alt+N, Alt+←/→, Alt+D and Alt+P stay live in text fields, as in v2, except while a letter
  is being typed there (front desk, 19 Nov 2026).
- **Register sessions are on for a till with no saved choice** (front desk, 11 Nov 2026, superseding the opt-in
  ruling of 6 Oct). A till that saved a choice keeps it; the switch is also in Settings › General.
- **Translations wait for `@tallyui/i18n`** (row 21; front desk, 19 Nov 2026). No catalogue load from jsDelivr now.
- **Layout slots are out of scope** (front desk, 19 Nov 2026): nothing a cashier can see.
- **Handing an open order to another cashier, register or store is out of scope** (front desk, 19 Nov 2026): Tally's
  open sales are local drafts, so there is nothing to hand over.
- **Themes, icon sets and fonts come after selling, payments, refunds and reports** (front desk, 12 Nov 2026;
  TallyUI ADR-087). They are not counted as open gaps until then.
- **Stores whose price decimals differ from the currency's minor digits are refused at connect** (front desk, 23 Nov
  2026; #631). This is a stopgap; it comes out when TallyUI rounds tax and total to the store's decimals the way
  WooCommerce does (`docs/money-suspects.md`, S1).
- **Storage is single-instance:** one tab, one database (house rule, WCPOS 1.11.0). v2's tab take-over (row 29) is a TallyUI
  storage gap, not something this app builds alone.

## What the read could not settle

- Look. Structure, columns, breakpoints and controls were read; spacing, colour and motion were not. The only pixel evidence is DEMO-PARITY round 15, eleven days and two major library versions old. A fresh capture round is the only way to put a number on "looks like".
- Rows 16, 64, 78, 91, 94 were not reached.
- Whether v2's typed product search has a server leg (row 53), and whether v2's till-level tax and currency overrides are per device or synced (rows 39, 41).
- Whether the library discount reconciles with WooCommerce's server totals (row 76), and whether counting rejected and pending sales in reports is intended (row 177).
- The arithmetic in row 115 was read, not run: no suite was run for this document.
- Rows 7 and 33 rest on the older documents and a shallow look.

## Counts

- 181 rows: 51 MATCH, 77 PARTIAL, 48 MISSING, 5 UNVISITED. MATCH is 51 of 176 judged, 29%.
- The 125 open rows by kind: 74 behaviour, 28 money, 23 look (look is under-counted: code shows structure, not pixels).
- By size: 58 S, 49 M, 18 L.
- The 18 L rows: bell feed (13), translations (21), health database (32), mini-apps (36), customer display (43), store gateway tiles (95), order-pay webview (96), smart readers (103), on-device readers (104), real printer output (126), refunds (131), orders on the device (142), order edit (157), product price edit (160), product edit dialog (162), customer open and edit (170), coupon add and edit (175), report scope (176).
