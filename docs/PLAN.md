# Plan

MVP first: the shortest path to a WooCommerce POS a tester can sell with,
then widening toward the [parity target](PARITY.md). The boundaries are in
[ADR 0001](adr/0001-repo-place-and-boundaries.md); the brief is
[BRIEF.md](BRIEF.md). No dates here: the front desk sets them.

**D1 is decided: (b).** The store runs the WCPOS Free plugin and the app
speaks to it through `wcpos/v2`. The milestones below are built on that.

## Principles for the order

1. **TallyUI gates the app.** `@tallyui/*@2.0.0` has the POS domain
   (`@tallyui/pos`) but a products-only WooCommerce connector. Each
   milestone lists the TallyUI gaps (G*n*) it needs; they go to the front
   desk when the milestone before it starts, so a TallyUI release can carry
   them in time (D7).
2. **Stable before in flux, in flux before v2-only.** PARITY.md marks what
   is still moving on WCPOS `next`. Build stable features first; build the
   moving ones late, against `next`'s shape.
3. **Released wire first.** M1–M7 run against the released plugins
   (1.10.x), which is what a tester's store has, and G1–G8 target the 1.10.x
   wire shape. From M8 the milestones need the routes v2 adds and are built
   against the plugins' `next` builds on the dev store until v2 is
   released (D6). The v2 app requires the v2 plugin (monorepo#1949), so when
   v2 ships this app moves to the v2 wire in one step, raising its own
   plugin floor with it; in-flux features are rebuilt to `next`'s shape at
   that point, not before.
4. **Web first.** Like `medusapos/app`, the web build is the tester surface
   until the MVP holds. iOS, Android and desktop come with the hardware
   milestone.
5. **The WooCommerce side is used as it ships.** Nothing on the store
   changes (ADR 0001). A milestone that would need a server change stops
   and goes to the front desk.

## Milestones

Each says what a tester can do when it is done.

### M0: Scaffold

- **Tester:** nothing yet. A developer runs `pnpm install`, starts the web
  build of `apps/pos`, and sees a placeholder screen rendered with
  `@tallyui` components. CI runs install, typecheck and test on every PR.
- **Jobs:** the scaffold PR (pnpm + turbo, `apps/pos` Expo app on
  `@tallyui/*@2.0.0` from npm, `CLAUDE.md`, CI) and the dev store.
- **TallyUI:** none.

### M1: Sign in and browse the catalogue

- **Tester:** opens the web app, signs in to a store running the WCPOS
  Free plugin the way WCPOS does (site, then cashier, then store, through
  the plugin's browser login), and sees the store's published products in a
  grid with image, name and price. Searches by name, SKU or barcode.
  Reloads with the network off and still browses.
- **TallyUI:** G1, shipped in `@tallyui/connector-woocommerce@3.0.0`
  ([ADR 0004](adr/0004-m1-sync-through-tallyui-database.md)). The connector
  signs in with the WCPOS token and pulls products through `wcpos/v2`: the product `uuid` its schema is keyed on
  only comes on POS requests (wiki `architecture/plugin-free/pos-request-detection.md`),
  and WooCommerce API keys do not authenticate `wcpos/*` routes (D2). The
  current pull also has two defects to fix on the way: `modified_after`
  without `dates_are_gmt=true` misses edits on stores west of UTC, and the
  default `status=any` syncs drafts.
- **Sync:** `@wcpos/sync-engine` (TallyUI ADR-067) is not on npm, so M1
  runs the connector's `replication.products` and `reconcile.catalogue`
  under `@tallyui/database`, kept in one module so the engine can replace
  them ([ADR 0004](adr/0004-m1-sync-through-tallyui-database.md)).
- **Sign-in:** WCPOS 1.10.20's `/wcpos-auth/` accepts an `https`
  `redirect_uri` and returns the tokens in its query string, so the web
  app signs in through the plugin's own login page.

### M2: Build a cart

- **Tester:** adds products (variable ones through a variation picker),
  changes quantities, edits a line price, removes lines, parks a cart and
  opens another, and sees the subtotal. Carts survive a reload and work
  offline.
- **TallyUI:** G2, variations in the connector. The cart, parked orders
  and order builder are already in `@tallyui/pos`.

### M3: First sale (the MVP)

- **Tester:** takes cash for a cart and sees the change due. The order
  appears in WooCommerce **once**, at the POS prices, paid by cash, with
  stock reduced. A sale made offline queues and lands exactly once on
  reconnect. A basic receipt prints through the browser's print dialog.
- **Scope limit:** guest orders only; the store runs with taxes off until
  M5.
- **TallyUI:** G3, a WooCommerce `CommandTransport` for `@tallyui/pos`'s
  order outbox that maps `order.create` onto the `wcpos/v2` push, keeping
  TallyUI's command id as the push's mutation id and the client order id
  as its record id, so a replay resolves to the same order (wiki
  `architecture/plugin-free/v2-push-envelope-and-idempotency.md`).
- **Spike first:** confirm that the released plugin's push accepts an
  order created already paid by cash. On 1.10.x, WCPOS itself completes
  cash through the order-pay page; if the push will not take a paid order,
  M3 moves to the `next` plugin. On `next` a sale cannot complete until a
  register is picked (monorepo#2045), so the MVP would then wait for M8's
  register work, and D6 would be due before M3.

### M4: Customers and receipts

- **Tester:** searches customers by name, email, phone or company,
  attaches one to the sale or leaves it a guest order, creates a customer,
  and emails the receipt (WooCommerce core can send order details; the
  offline queue is the app's). Offline, the email queues and sends on
  reconnect.
- **TallyUI:** G4, customers (pull, search, create) in the connector.

### M5: Tax, discounts and coupons

- **Tester:** on a store with taxes on, sees the tax WooCommerce charges,
  to the cent, for the store's base location. Discounts a line by
  percentage, adds fee and shipping lines and a miscellaneous product,
  applies a WooCommerce coupon and has it refused when its rules say so.
- **TallyUI:** G5, tax rates and tax settings in the connector, and proof
  that `@tallyui/pos`'s tax maths rounds the way WooCommerce does (WCPOS
  needed a port of Woo's matcher and rounding to get there: wiki
  `architecture/client/tax-rate-matching.md`, `architecture/client/order-math-tax-parity.md`);
  G6, coupons.

### M6: Orders and refunds

- **Tester:** browses past orders, reopens one, adds a note, reprints its
  receipt, and refunds it in full or in part, with stock returned when
  chosen.
- **TallyUI:** G7, order history and refunds (connector and commands).

**M0–M6 cover the selling features that exist on the released 1.10.x
line.** Several are *in flux* in PARITY.md and are rebuilt to `next`'s
shape when v2 ships (principle 3). On 1.10.x, customer create (M4),
coupons (M5; Free only on `next`, #1934), order history and refunds (M6)
are Pro, so under D3 those parts need Pro on the store, and the dev store
needs a Pro licence before M4 (D6). M1–M3 need only the Free plugin.

### M7: Stores and cashiers

- **Tester:** on a Pro store, picks a store at sign-in; switches cashier at
  the till; sees controls lock by the cashier's capabilities.
- **TallyUI:** G8, the store list, cashier switching and capabilities.

### M8: Registers and closures

Registers come before the v2 checkout because on v2 a sale cannot
complete until a register is picked (monorepo#2045), and with sessions on
it needs an open session (wiki `architecture/client/register-sessions.md`).

- **Tester:** picks the till's register, opens it with a counted float,
  moves cash in and out, closes by counting the drawer, and prints the
  closure. Every sale carries its register and sale-time provenance.
- **TallyUI:** G9, syncing registers, sessions, cash movements, provenance
  and closures. The session logic and closure document are already in
  `@tallyui/pos`.

### M9: The v2 checkout

- **Tester:** pays by cash with no server round trip, splits a sale across
  cash and a second method (including by item), takes a payment while
  offline and sees it recorded on reconnect, uses any other WooCommerce
  gateway through the order-pay fallback, and gives an order-level quick
  discount.
- **TallyUI:** G10, the payments contract (descriptor, ledger, routes)
  and the quick-discount coupon line.
- **Risk:** the order-pay fallback runs the store's page inside the app.
  Loaded from a hosted web origin, it will meet iframe and third-party
  cookie limits. The spike for M9 decides whether it opens as a window
  instead.

### M10: Reports, fiscal records and receipts

- **Tester:** sees the day's sales in Reports and the closures room;
  voids and refunds produce their own records; every receipt carries the
  register, the software and a copy marking on reprints (no QR on a plain
  sale, as in WCPOS v2 Free, where `fiscal.qr_payload` is filled only by a
  fiscal module; ruled by the front desk 2026-10-06); the WCPOS receipt
  templates render on the device.
- **TallyUI:** G11, reports, fiscal records, receipt templates and receipt
  schema 1.4.

### M11: Printing, scanning and native apps

- **Tester:** prints to an Epson or Star thermal printer from the web and
  to network, USB or Bluetooth printers from iOS, Android and desktop,
  routes templates to printers, kicks the cash drawer, and scans barcodes
  into the cart.
- **TallyUI:** G12, printer and scanner packages, which TallyUI does not
  have yet.

### M12: Remaining v2 surface

- **Tester:** pairs a customer display; moves the cart to either side and
  uses quick filters; uses card terminals where the store has them; sees
  Store health, Logs and Settings with WCPOS's coverage.
- **TallyUI:** G13, terminal drivers and customer-display signaling.

**Parity** is M12 done with every PARITY.md row either built or listed as
deliberately outside it, re-checked against the v2 release tag.

## Decisions needed

- **D1: how the app writes to the store. Decided 2026-09-28 by the front
  desk: (b).** The front desk made the call alongside its recommendation to
  Paul that TallyUI connectors become drivers in the shape of the WCPOS
  `next` engine. The `wcpos/v2` API is the driver surface, so (a) and (c)
  are out. The options as they were weighed follow. WooCommerce core's
  `POST /wc/v3/orders` has no idempotency key. TallyUI's order outbox sends
  commands through a pluggable transport; its default endpoint is
  `/tally/v1/commands`, which medusapos serves with its own server plugin.
  The options:
  - **(a) A companion plugin of our own** serving `/tally/v1/commands`,
    idempotent by command id. It fits TallyUI's design and mirrors
    medusapos, but it is new PHP to write, secure and maintain, and Paul's
    brief says "no PHP plugin changes".
  - **(b) Require the WCPOS Free plugin** and map commands onto its
    `wcpos/v2` push, which already reserves each mutation atomically,
    replays the original verdict and resolves a replayed create to the
    same order (wiki `architecture/plugin-free/v2-push-envelope-and-idempotency.md`).
    No PHP is written, and every v2 feature past M6 needs the plugin
    anyway. The costs: sign-in moves to the WCPOS token from M1, the app
    presents itself to the store as a WCPOS client, and it follows a
    contract WCPOS is still changing on `next`.
  - **(c) WooCommerce core only:** a client uuid in the order's meta, and
    a search for it among recent orders before any retry. That is
    reconciliation, not duplicate prevention: it cannot exclude an original
    request still in flight. It also leaves products without the `uuid` the
    connector's schema needs.

  **Recommendation: (b).** A read-only second opinion from Codex (GPT-6
  Astra) reached the same answer and named the risk: the transport must
  keep money, discounts, payments and the difference between permanent and
  retryable failures exact, not only translate the HTTP call. D1 decides
  how the connector is built, so the TallyUI work goes through the front
  desk.
- **D2: authentication (answered, recorded here).** The connector sends a
  consumer key as HTTP Basic auth, which WooCommerce accepts only over
  HTTPS, and API keys authenticate only `wc/` and `wc-` routes
  (`class-wc-rest-authentication.php`); the Free plugin does not widen that.
  So (b) means the WCPOS token and (c) means consumer keys. WordPress
  application passwords would be a third route under (a) or (c), not yet
  verified.
- **D3: the Free / Pro line.** WCPOS keeps some features for Pro even
  where WooCommerce core could serve them: customer create, order history,
  refunds, store pricing, multi-store. **Recommendation:** this app uses
  whatever the store's API serves and does not reproduce WCPOS's licence
  gates; features whose server half only Pro has need Pro on the store. Put
  plainly, that gives away part of what WCPOS Pro sells, for anyone who
  runs this app instead. It is a commercial call, so it is Paul's.
- **D4: hosting for testers. Decided 2026-10-05 by the front desk:**
  Vercel, team `wcpos`, as `medusapos/app` does
  ([ADR 0002](adr/0002-hosting-on-vercel.md)).
- **D5: testers' stores. Decided 2026-10-05 by the front desk:** the demo
  runs against this Mac mini's dev store, exposed read-only through
  Tailscale Funnel ([ADR 0003](adr/0003-demo-store-through-funnel.md)).
  Testers may still bring their own store: HTTPS, the WCPOS Free plugin
  (under D1 (b)), and a host that does not strip the plugin's headers.
- **D6: WCPOS builds on the dev store (Pro before M4, `next` before
  M8).** The Free plugin's latest release is 1.10.20; the routes v2 adds
  exist only on the plugins' `next` branches, and Pro is not on
  wordpress.org. Proposal: the dev store runs the released Free plugin for
  M1–M3, adds released Pro for M4–M7, and from M8 installs builds made
  from `~/Projects/woocommerce-pos` and `woocommerce-pos-pro` at `next`,
  without changing them. Pro on the dev store needs a licence, which is
  Paul's to give.
- **D7: TallyUI release cadence.** With npm only, each gap waits for a
  published release. Who publishes and how often is for the front desk to
  settle with the TallyUI worker, so that a gap asked for one milestone
  ahead is on npm when the milestone starts.

## Dev store

A WooCommerce store on this Mac mini for development and e2e runs. It is
never created on the Coolify VPS.

- **Stack: native Homebrew, no Docker.** The Mac mini has no Docker
  runtime, and the Medusa dev store already runs natively (Homebrew
  PostgreSQL and Redis). A native stack avoids a Linux VM's memory on a
  24 GB machine shared by parallel workers. Components: PHP 8.3 with
  php-fpm (Homebrew's `php@8.3` is keg-only, so the scripts call it by
  path), MariaDB, WP-CLI, and Caddy as the web server, installed with
  Homebrew on 2026-10-05.
- **HTTPS through Tailscale Funnel.** The store's URL is
  `https://claudes-mac-mini.tail6a20e3.ts.net:10000`; Funnel terminates
  TLS and forwards to Caddy's public filter listener, so no local CA is
  needed ([ADR 0003](adr/0003-demo-store-through-funnel.md)).
- **Ports and sockets:** Caddy on `127.0.0.1:8480` (full access, local
  only) and `127.0.0.1:8481` (the public filter Funnel points at);
  MariaDB on `127.0.0.1:3306`; php-fpm on a Unix socket, because port
  9000 is already taken on this machine.
- **Where it lives:** setup scripts in this repo under `dev/woo-store/`
  (as `medusapos/app` keeps `dev/medusa-store/`), outside the pnpm
  workspace. Runtime state (WordPress files, the database data directory,
  generated credentials) lives outside the repo in
  `~/.local/share/tallyui-woocommerce/dev-store/`, so every worktree's
  scripts address the same single store. Credentials are written there and
  never committed or printed.
- **Contents:** WordPress and WooCommerce at pinned versions; pretty
  permalinks (WooCommerce reads the route from the request URI when
  deciding on key auth); the WCPOS Free plugin at its latest release
  (1.10.20 today), released Pro from M4 and `next` builds from M8 (D6); a store timezone west
  of UTC, so date-cursor bugs show; a seed of simple and variable products
  with stock, barcodes and images; two tax rates (off until M5); one
  coupon; one customer; a `shop_manager` cashier.
- **Lifecycle:** `up`, `down`, `seed` and `reset` scripts. Services start
  on demand rather than as login items, and are sized small (MariaDB
  buffer pool 128 MB, php-fpm `ondemand` with at most four children).
  `reset` restores the seeded database so e2e runs start from the same
  state.
- **Fallback:** if the native stack proves fiddly, `@wordpress/env` on
  Colima gives the same store in Docker, at the cost of the VM's memory.
- **Jobs, each one Codex spec:** D-1 the service scripts and Caddy config;
  D-2 WordPress, WooCommerce and WCPOS install; D-3 the seed; D-4 `reset`
  and a smoke check that signs in as the cashier and fetches products
  through `wcpos/v2`.

The dev store is needed from M1 and is built alongside M0.
