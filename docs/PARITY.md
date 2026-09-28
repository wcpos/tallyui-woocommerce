# Parity target: WCPOS v2

What "feature parity with WCPOS v2" means for this app, feature by feature.
Built on 2026-09-28 from the roadmap repo (`wcpos/roadmap`, release issues
#195, #225, #226 and `ROADMAP.md`), the wiki (`product/features/*`,
`architecture/client.md` and its 1.11.0 / 2.0 contract pages) and the
monorepo's `origin/next` against `origin/main` (commit and PR titles, route
lists, `LEDGER.md` files, per-area diff size). WCPOS source code was not
read beyond that.

## What v2 is

- WCPOS **2.0 is the monorepo's `next` lane**: the unreleased 1.11.0 line,
  which ships as 2.0 (monorepo#1815). Its release issue is roadmap#195,
  *v1.11.0: Checkout & payments*: a POS-owned checkout (cash, split
  payments, terminals, Tap to Pay), refunds and receipts on the same money
  model, a customer display, the quick-discount coupon that retires
  negative fees, a configurable register layout, and the regime-agnostic
  fiscal groundwork. The 2.0 reports and closures contract and the move to
  SQLite storage ride the same lane.
- `main` is the released **1.10.x** line (offline queues, the sync engine,
  Store health, stock validation).
- **Not in the target:** v1.12.0 *Fiscal compliance* (roadmap#225: NF525,
  VeriFactu country modules) and v1.13.0 *Works with your other plugins*
  (roadmap#226). They come after v2 and are added here only if Paul moves
  them into 2.0. `ROADMAP.md`'s "v2.0.0: tablet-first UI refresh" line is
  older than the decision to ship `next` as 2.0 and is read as the same
  release.

## How to read the table

**Status**, from comparing `origin/main` with `origin/next`:

- **stable**: the same on main and next (diff on next is a few dozen
  lines or none). Safe to build against today.
- **in flux**: exists on main, materially reworked on next. Build to the
  `next` shape, not main's, and as late as the milestone order allows.
- **v2-only**: exists only on next.

**Server** is what the WooCommerce store needs for the feature:
`Woo` (WooCommerce core REST API), `Free` (the `woocommerce-pos` plugin,
`wcpos/v1` / `wcpos/v2` routes), `Pro` (`woocommerce-pos-pro`). The v2
client requires plugin 1.11.0 (monorepo#1949); this app follows the same
floor for any feature that uses the plugin. See [ADR 0001](adr/0001-repo-place-and-boundaries.md):
we use these contracts as they ship and never change them.

**Connector** is whether `@tallyui/connector-woocommerce@2.0.0` covers the
data today. It has products only (schema, traits, pull sync, replication)
over the REST API with a consumer key and secret. Every "no" is a TallyUI
gap to send to the front desk before the milestone that needs it
([PLAN.md](PLAN.md)).

## Connect and session

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Connect a store | Site → cashier → store flow; each site lists its authorised cashiers | in flux (plugin floor raised to 1.11.0, #1949, #2220) | Free | no: consumer-key auth only |
| Browser-based login | Browser authorisation endpoint issuing access/refresh tokens | stable | Free | no |
| Session management | List and revoke a user's sessions across devices | stable | Free | no |
| Capability gating | Controls lock by the cashier's WordPress capabilities; unknown fails open | stable | Free | no |
| Multi-store | Pick a store at connect; store switching; a register bound to a store skips the picker | in flux (#1967, #1996) | Pro | no |
| Online status | Green/yellow/red indicator; passive-first connectivity probe | stable | Woo | n/a (app) |

## Catalogue

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Product sync, offline | Catalogue stored on device, browsable offline, background sync on reconnect | stable (engine reworked on next under the hood: sync-engine +2.9k lines) | Woo / Free | yes (products; pull only) |
| Grid and table views | Grid default, 2–8 columns, configurable tile fields; table view toggle | in flux (products column becomes a pluggable panel whose side is a setting, #1785) | Woo | yes |
| Variations | Variations popover with attribute pickers and stock badge | stable | Woo / Free | no: variations not in the connector |
| Product search | Any-order substring search over name, SKU, barcode | stable | Woo | partial (depends on TallyUI search) |
| Quick filters | Merchant-built quick-filter buttons with an editor; price and type filters | v2-only (#1839) | Woo | no |
| Barcode scanning | Scanner input adds products; `@wcpos/scanner` | stable | Woo | partial (barcode field in schema) |
| Stock display and overselling guard | Stock shown; optional block on over-quantity adds and at checkout | stable | Free (setting) | partial (stock fields) |
| Products admin screen | Edit stock, price, COGS inline | stable | Pro | no: pull only, no writes |
| Cost of goods display | COGS column when WooCommerce COGS is enabled | stable | Woo | no |
| Store-specific pricing | Per-store regular/sale prices | stable | Pro | no |

## Cart and pricing

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Cart, open orders | Several open carts; lines, quantity, remove | in flux (open-order tabs move into a configurable bar, #1996, #1985) | Woo | no: orders not in the connector |
| Line price edit, split line | Edit a line's price; split a line for mixed discounts | stable | Woo | no |
| Per-line quick discount | Percentage buttons in the line's number pad | stable | Woo | no |
| Order-level quick discount | "Add Discount" writes an on-the-fly quick-discount coupon line; negative fees removed | v2-only (#1934, roadmap#91) | Free | no |
| Coupons | Apply WooCommerce coupons with client-side validation mirroring Woo | stable | Pro (sync); Woo (apply) | no |
| Fees and shipping lines | Misc fee and shipping lines on the cart | stable | Woo | no |
| Miscellaneous product | Ad-hoc line with a name and price | stable | Woo | no |
| Tax calculation | On-device port of WooCommerce's rate matcher; store-address or base location | stable (settings: four tax inputs locked to store values on next, #1970) | Woo | no: tax rates not in the connector |
| Customers at the till | Search by name, email, company, phone, tax ID; attach; guest orders | stable | Woo / Free | no |
| Customer create and edit | Create and edit customer records at the register | stable | Pro | no |

## Checkout and payments

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Checkout surface | Tender pane: keypad replaces the products column, receipt is the last stage, checkout opens while the order saves | in flux (heavy rework, #1794, #1898, #1993) | Free | no |
| Cash | Cash tender with change due. On main it completes through the order-pay page; on next it is a `manual` capture mode with no server round trip | in flux | Free | no |
| Payment ledger | N payment rows on one Woo order; descriptor, route family, capture modes | v2-only (payments contract v1, #1792) | Free | no |
| Split payments | Visible split plan, including split by item | v2-only (#1997, #1929) | Free | no |
| Offline payment recording | Payments recorded offline and replayed; completing sale journaled before money moves | v2-only (#2161, #1965) | Free | no |
| Legacy order-pay webview | Any Woo gateway through the order-pay page | stable (kept as one capture mode on next) | Woo | no |
| Per-gateway order status | Order status per gateway (BACS/cheque on-hold, others completed) | stable | Free | no |
| Card terminals | Server-side terminal capture; on-device Stripe Terminal and SumUp drivers; Tap to Pay | v2-only (#1913, #1956–#1968) | Pro + extension | no |
| Tips | Tip on the reader or at the till, recorded as a Tip fee line | v2-only (roadmap#106) | Free / Pro | no |
| Email controls | Per-type toggles for which Woo emails fire for POS orders | stable | Free | n/a (server) |

## Registers, fiscal, reports

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Registers | One till = one server-record register; device points at one | v2-only (#1996, roadmap#197) | Free (binding to store: Pro) | no |
| Register sessions and cash movements | Open with a counted float, cash in/out, close by counting, variance, manager override | v2-only (#1996, #2006, #2022) | Free | no |
| Sale-time provenance | Till stamps sale time, zone, register, counter, session, write-once | v2-only (#1962, #2045, roadmap#198) | Free | no |
| Fiscal records | Write-once typed, numbered, checksummed records per sale, refund, void, closure | v2-only (roadmap#200) | Free | no |
| Closures, X and Z reports | Closure numbers, stored closures, reprint and recount | v2-only (#2005, roadmap#199) | Free (cross-register view: Pro) | no |
| Reports: Sales room | Period total with comparison, hourly bars, tiles opening tables; today on this register (Free), 92 days, any register/store (Pro) | in flux (reports +6.4k lines on next) | Free / Pro | no |
| End-of-day report | Daily sales summary | in flux (absorbed into Reports and closures) | Pro | no |
| Receipt identity and QR | Receipt schema 1.4: software, register, document type, copy marking, real QR | v2-only (roadmap#201, #1971) | Free | no |

## Orders and refunds

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Order history | Browse, filter (including by register), reopen past orders | in flux (additive: +610 lines, #1966, #2162) | Pro | no |
| Refunds | Full and partial refunds with cashier and store audit; refund document printable | in flux (refund document v2-only, #1973) | Pro | no |
| POS vs online filter | Order-source filter in WooCommerce analytics | stable | Pro | n/a (server) |

## Receipts and printing

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Receipt screen | Optimistic local render then server upgrade; zoom; template switcher; PDF | in flux (+3k lines: identity blocks, print intent, offline copies) | Free | no |
| Receipt templates | Logicless (Mustache) and thermal XML templates synced to the device; legacy PHP via server | stable | Free | no |
| Browser print | System print dialog fallback | stable | none | n/a (app) |
| Thermal printing | ESC/POS, StarPRNT, ePOS; Epson and Star on web; raw TCP, USB, Bluetooth on native and desktop | in flux (`@wcpos/printer` +1.1k lines, test print proves logo, QR, barcodes) | none | n/a (app) |
| Multi-printer routing | Manual, per-template override, auto-match by type and width | stable | none | n/a (app) |
| Cloud printing | PrintNode, Star Online, Star CloudPRNT, Epson Server Direct Print | stable | Free | no |
| Email receipt, offline queue | Send when online; retry with back-off; health panel | stable | Free | no |
| Cash drawer kick | Open drawer on print | stable | none | n/a (app) |

## Customer-facing and extensions

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Customer display | Second screen showing cart and total over WebRTC, paired from settings | v2-only (#1824, #1851–#1879) | Pro (signaling and pairing) | n/a (app) |
| Configurable register layout | Cart side as a setting; slot primitive for WCPOS's own panels | v2-only (#1785, slots README) | none | n/a (app) |
| Mini-apps | postMessage bridge for web-class extensions | stable | Free | n/a (app) |
| Extension directory and management | Browse extensions; install and update from the POS | stable | Free (browse), Pro (install) | n/a (server) |

## Operations and settings

| Feature | WCPOS behaviour | Status | Server | Connector |
|---|---|---|---|---|
| Store health | Performance, database coverage, storage footprint, logs; Registers panel on next | in flux (additive, #1969) | Free | n/a (app) |
| Logs | Level-filtered log ledger; register and checkout events on next | in flux (#2009, #2034) | Free | n/a (app) |
| Settings | General, tax, theme, barcode scanning, printing, printers; customer display on next | in flux (+1.5k lines) | Free | n/a (app) |
| Notifications | In-app notifications (Novu) | stable | none (WCPOS service) | out of scope: WCPOS's own service |
| Translations and RTL | i18next, RTL | stable | none | n/a (app, TallyUI) |
| Pro upsell previews | Blurred Pro pages for Free users | stable | Pro | out of scope: WCPOS licensing |

## Deliberately outside parity

- WCPOS's own services: Novu notifications, PostHog analytics and flags,
  licence activation and the Pro upsell. They belong to the WCPOS product,
  not to a TallyUI app selling from WooCommerce.
- Everything on the server side of the table (email controls, analytics
  filter, extension installs, the WP-admin template editor and gallery):
  the store keeps doing these for any client, and nothing here changes them.
- v1.12.0 country fiscal modules and v1.13.0 plugin compatibility work, as
  above.

## Keeping this current

Re-derive the status column from `origin/next` before each milestone that
builds an *in flux* feature, because `next` is still moving (656 commits
ahead of `main` on 2026-09-28). When 2.0 ships, *in flux* and *v2-only*
collapse into *stable* and this file's target is frozen at that tag.
