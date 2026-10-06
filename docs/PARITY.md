# Parity target: WCPOS v2

What "feature parity with WCPOS v2" means for this app, feature by feature.
Built on 2026-09-28 from the roadmap repo (`wcpos/roadmap`, release issues
#195, #225, #226 and `ROADMAP.md`), the wiki (`product/features/*`,
`architecture/client.md` and its 1.11.0 / 2.0 contract pages,
`architecture/plugin-free.md`) and the monorepo's `origin/next` against
`origin/main` (commit and PR titles, route lists, `LEDGER.md` files,
per-area diff size). WCPOS source code was not read beyond that.

## What v2 is

- WCPOS **v2 is the monorepo's `next` lane**: the unreleased line that
  carries the app version 1.11.0 today (monorepo#1815) and is to ship as
  2.0 (wiki `architecture/client.md`, Release lanes). What the release is
  finally called is still open with Paul (roadmap#363, monorepo#2197,
  woocommerce-pos#2080); this file says "v2" throughout.
- Its release issue is roadmap#195, *v1.11.0: Checkout & payments*: a
  POS-owned checkout (cash, split payments, terminals, Tap to Pay), refunds
  and receipts on the same money model, a customer display, the
  quick-discount coupon that retires negative fees, a configurable register
  layout, and the regime-agnostic fiscal groundwork. The reports and
  closures contract and the move to SQLite storage ride the same lane.
- `main` is the released **1.10.x** line: offline queues, the sync engine,
  Store health and stock validation. The `wcpos/v2` REST namespace (the
  sync surface) **already shipped** with the Free plugin 1.10.0 on
  2026-08-25 (wiki `architecture/plugin-free.md`); v2 adds routes and
  response shapes to it, and the v2 app requires the v2 plugin
  (monorepo#1949).
- **Not in the target:** v1.12.0 *Fiscal compliance* (roadmap#225: NF525,
  VeriFactu country modules) and v1.13.0 *Works with your other plugins*
  (roadmap#226). They come after v2 and are added here only if Paul moves
  them into it. `ROADMAP.md`'s "v2.0.0: tablet-first UI refresh" line is
  older than the decision to ship `next` as 2.0 and is read as the same
  release.

## How to read the table

**Status**, from comparing `origin/main` with `origin/next`:

- **stable**: the same on main and next (a few dozen changed lines or
  none). Safe to build against today.
- **in flux**: exists on main, materially reworked on next. Build to the
  `next` shape, not main's, and as late as the milestone order allows.
- **v2-only**: exists only on next.

**Server** is what the store needs for the feature: `Woo` (WooCommerce
core REST API), `Free` (the `woocommerce-pos` plugin), `Pro`
(`woocommerce-pos-pro`). This app uses those contracts as they ship and
never changes them ([ADR 0001](adr/0001-repo-place-and-boundaries.md)).

**TallyUI** is what `@tallyui/*@2.0.0` already provides. `conn` is
`@tallyui/connector-woocommerce`, which has products only: one schema
keyed on the WCPOS plugin's `uuid`, a pull sync and a replication, with
consumer-key auth. `pos` is `@tallyui/pos`, which already has the
commerce-agnostic domain: cart and sale, order builder and parked orders,
tax maths, tender, register sessions and closure documents, receipt data,
and an order outbox with a pluggable transport. So most gaps are
WooCommerce data and transport, not domain logic. Every gap goes to the
front desk before the milestone that needs it ([PLAN.md](PLAN.md)).

## Connect and session

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Connect a store | Site → cashier → store; each site lists its authorised cashiers | in flux (plugin floor raised, #1949, #2220) | Free | conn: consumer keys only |
| Browser-based login | Browser authorisation endpoint issuing access/refresh tokens (JWT) | stable | Free | gap |
| Session management | List and revoke a user's sessions across devices | stable | Free | gap |
| Switch cashier at the till | Change cashier without reconnecting; on next, from the register's user sheet | in flux (#1996, roadmap#268) | Free | gap |
| Capability gating | Controls lock by the cashier's WordPress capabilities; unknown fails open | stable | Free | gap |
| Multi-store | Pick a store at connect; a register bound to a store skips the picker | in flux (#1967, #1996) | Pro | gap |
| Online status | Green/yellow/red indicator; passive-first probe | stable | Woo | app |

## Catalogue

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Product sync, offline | Catalogue stored on device, browsable offline, background sync | stable (engine reworked under the hood: sync-engine +2.9k lines) | Free (uuid) | conn: products, pull only |
| Grid and table views | Grid default, 2–8 columns, configurable tile fields; table toggle | in flux (products column becomes a pluggable panel, side is a setting, #1785) | Woo | components |
| Variations | Variations popover with attribute pickers and stock badge | stable | Woo / Free | gap |
| Product search | Any-order substring over name, SKU, barcode | stable | Woo | pos: `searchProducts` |
| Quick filters | Merchant-built quick-filter buttons with an editor; price and type filters | v2-only (#1839) | Woo | gap |
| Barcode scanning | Scanner input adds products (`@wcpos/scanner`); the barcode field is the plugin's, Woo core's is `global_unique_id` | stable | Free | gap (scanner) |
| Decimal quantities | Fractional quantities on POS requests | stable | Free | check pos cart |
| Stock and overselling guard | Stock shown; optional block on over-quantity adds and at checkout | stable | Free (setting) | pos: `stock` |
| Products admin screen | Edit stock, price, COGS inline | stable | Pro | gap (writes) |
| Cost of goods display | COGS column when WooCommerce COGS is on | stable | Woo | gap |
| Store-specific pricing | Per-store regular/sale prices | stable | Pro | gap |

## Cart and pricing

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Cart, open orders | Several open carts; lines, quantity, remove | in flux (open-order tabs move into a configurable bar, #1996, #1985) | Woo | pos: sale, parked orders |
| Line price edit, split line | Edit a line's price; split a line for mixed discounts | stable | Woo | pos: order builder |
| Per-line quick discount | Percentage buttons in the line's number pad | stable | Woo | pos: discounts |
| Order-level quick discount | "Add Discount" writes an on-the-fly quick-discount coupon line; negative fees removed | v2-only (#1934, roadmap#91) | Free | gap (coupon line) |
| Coupons | Apply WooCommerce coupons with client-side validation mirroring Woo; Free on next | in flux (#1934 moves coupons to Free) | Free | gap |
| Fees and shipping lines | Fee and shipping lines on the cart | stable | Woo | pos: order builder |
| Miscellaneous product | Ad-hoc line with a name and price | stable | Woo | pos: order builder |
| Tax calculation | On-device port of WooCommerce's rate matcher and rounding | stable (tax settings locked to store values on next, #1970) | Woo | pos: tax maths; gap: rate data, Woo rounding parity |
| Customers at the till | Search by name, email, company, phone, tax ID; attach; guest orders | stable | Woo / Free | gap |
| Customer create and edit | Create and edit customers at the register, including tax IDs | stable | Pro | gap |
| Order notes and meta | Add a note; edit order meta | in flux (`add-note` removed, `edit-order-meta` reworked on next) | Woo | gap |

## Checkout and payments

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Checkout surface | Tender pane: keypad replaces the products column, receipt is the last stage, checkout opens while the order saves | in flux (heavy rework, #1794, #1898, #1993) | Free | pos: tender |
| Cash | Cash tender with change due. On main it completes through the order-pay page; on next it is a `manual` capture mode with no server round trip | in flux | Free | pos: tender; gap: transport |
| Payment ledger | N payment rows on one Woo order; descriptor, route family, capture modes | v2-only (payments contract v1, #1792) | Free | gap |
| Split payments | Visible split plan, including split by item | v2-only (#1997, #1929) | Free | gap |
| Offline payment recording | Payments recorded offline and replayed; completing sale journaled before money moves | v2-only (#1792, #2161) | Free | pos: outbox; gap: ledger |
| Legacy order-pay webview | Any Woo gateway through the order-pay page | stable (kept as one capture mode on next) | Woo | gap |
| Per-gateway order status | Order status per gateway (BACS/cheque on-hold, others completed) | stable | Free | n/a (server) |
| Card terminals | Server-side terminal capture; on-device Stripe Terminal and SumUp drivers; Tap to Pay | v2-only (#1913, #1956–#1968) | Pro + extension | gap |
| Tips | On the reader or at the till, recorded as a Tip fee line | v2-only (roadmap#106) | Free / Pro | gap |
| Email controls | Per-type toggles for which Woo emails fire for POS orders | stable | Free | n/a (server) |

## Registers, fiscal, reports

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Registers | One till = one server-record register; a sale cannot complete until one is picked | v2-only (#1996, #2045, roadmap#197) | Free (store binding: Pro) | pos: register; gap: sync |
| Register sessions and cash movements | Open with a counted float, cash in/out, close by counting, variance, manager override | v2-only (#1996, #2006, #2022) | Free | pos: register session; gap: sync |
| Sale-time provenance | Till stamps sale time, zone, register, counter, session, write-once | v2-only (#1962, #2045, roadmap#198) | Free | gap |
| Fiscal records and voids | Write-once typed, numbered, checksummed records for sale, refund, void, cancellation, closure; the receipt QR (`fiscal.qr_payload`, filled only by a fiscal module or a filter) | v2-only (roadmap#200) | Free | gap |
| Closures, X and Z reports | Closure numbers, stored closures, reprint and recount | v2-only (#2005, roadmap#199) | Free (cross-register view: Pro) | pos: closure document; gap: sync |
| Reports: Sales room | Period total with comparison, hourly bars, tiles opening tables; today on this register (Free), 92 days, any register and store (Pro) | in flux (reports +6.4k lines on next) | Free / Pro | app, partial: today on this till against yesterday by now, in the device's time zone rather than the store's; hourly bars; Payments by method with split tenders; Taxes by rate. Payments, Taxes and the hero's Orders open tables (today, this till) with Export CSV. Gap: Print and the template select in tables; other periods, registers and stores (Pro) |
| End-of-day report | Daily sales summary | in flux (absorbed into Reports and closures) | Pro | gap |
| Receipt identity and QR | Receipt schema 1.4: software, register, document type, copy marking, real QR | v2-only (roadmap#201, #1971) | Free | app, partial: under the receipt, "Sales receipt", the bound register's name and the software name and version, built with the schema 1.4 keys. Gap: copy marking (next). No QR on a plain sale, as in v2 Free: `fiscal.qr_payload` is filled only by a fiscal module, so the QR goes with Fiscal records. TallyUI gaps G-R1 to G-R5 (Receipt slot, ReceiptData 1.4, sale counter and zone, plugin version, server print counter) |

## Orders and refunds

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Order history | Browse, filter (including by register), reopen past orders | in flux (additive, +610 lines, #1966) | Pro | gap |
| Refunds | Full and partial refunds with cashier and store audit; refund document printable | in flux (refund document v2-only, #1973) | Pro | gap |
| POS vs online filter | Order-source filter in WooCommerce analytics | stable | Pro | n/a (server) |

## Receipts and printing

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Receipt screen | Optimistic local render then server upgrade; zoom; template switcher; PDF | in flux (+3k lines: identity blocks, print intent, offline copies) | Free | pos: receipt data |
| Receipt templates | Logicless (Mustache) and thermal XML templates synced to the device; legacy PHP via server | stable | Free | gap |
| Browser print | System print dialog fallback | stable | none | app |
| Email receipt, offline queue | Send when online; retry with back-off; health panel | stable | Free (Woo core can also send order details) | gap |
| Thermal printing | ESC/POS, StarPRNT, ePOS; Epson and Star on web; raw TCP, USB, Bluetooth on native and desktop | in flux (`@wcpos/printer` +1.1k lines) | none | gap (printer) |
| Label printer formats | ZPL, CPCL, TSPL outputs | stable | Free | gap (printer) |
| Multi-printer routing | Manual, per-template override, auto-match by type and width | stable | none | gap (printer) |
| Cloud printing | PrintNode, Star Online, Star CloudPRNT, Epson Server Direct Print | stable | Free | gap |
| Cash drawer kick | Open drawer on print | stable | none | gap (printer) |

## Customer-facing and extensions

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Customer display | Second screen showing cart and total over WebRTC, paired from settings | v2-only (#1824, #1851–#1879) | Pro (signaling, pairing) | gap |
| Configurable register layout | Cart side as a setting; slot primitive for WCPOS's own panels | v2-only (#1785, slots README) | none | gap |
| Mini-apps | postMessage bridge for web-class extensions | stable | Free | gap |
| Extension directory and management | Browse extensions; install and update from the POS | stable | Free (browse), Pro (install) | n/a (server) |

## Operations, settings and platforms

| Feature | WCPOS behaviour | Status | Server | TallyUI |
|---|---|---|---|---|
| Platforms | Web, iOS, Android, desktop (Electron) | stable | none | app (Expo) |
| Store health | Performance, database coverage, storage footprint, logs; Registers panel on next | in flux (additive, #1969) | Free | gap |
| Logs | Level-filtered log ledger; register and checkout events on next | in flux (#2009, #2034) | Free | pos: logging |
| Settings | General, tax, theme, barcode, printing, printers; customer display on next | in flux (+1.5k lines) | Free | pos: store settings |
| Translations and RTL | i18next, RTL | stable | none | gap |
| Notifications | In-app notifications (Novu) | stable | WCPOS service | out of scope |
| Pro upsell previews | Blurred Pro pages for Free users | stable | Pro | out of scope |

## Deliberately outside parity

- WCPOS's own services: Novu notifications, PostHog analytics and flags,
  licence activation and the Pro upsell. They belong to the WCPOS product,
  not to a TallyUI app selling from WooCommerce.
- The in-WordPress web bundle: that is how WCPOS is delivered by its
  plugin, which this app does not change.
- Everything done only on the server (email controls, the analytics filter,
  extension installs, the WP-admin template editor and gallery): the store
  keeps doing these for any client.
- v1.12.0 country fiscal modules and v1.13.0 plugin compatibility work, as
  above.

## Keeping this current

Re-derive the status column from `origin/next` before each milestone that
builds an *in flux* feature, because `next` is still moving (656 commits
ahead of `main` on 2026-09-28). When v2 ships, *in flux* and *v2-only*
collapse into *stable* and this file's target is frozen at that tag.
