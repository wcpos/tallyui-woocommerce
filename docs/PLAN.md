# Plan

MVP first: the shortest path to a WooCommerce POS a tester can sell with,
then widening toward the [parity target](PARITY.md). The boundaries are in
[ADR 0001](adr/0001-repo-place-and-boundaries.md); the brief is
[BRIEF.md](BRIEF.md). No dates here: the front desk sets them.

## Principles for the order

1. **The connector gates the app.** `@tallyui/connector-woocommerce@2.0.0`
   has products only. Each milestone lists the connector gaps (G*n*) it
   needs; they go to the front desk as soon as the milestone before it
   starts, so TallyUI can publish them in time.
2. **Stable before in flux, in flux before v2-only.** PARITY.md marks what
   is still moving on WCPOS `next`. Build the stable features first; build
   the moving ones late, against `next`'s shape.
3. **Web first.** Like `medusapos/app`, the web build is the tester surface
   until the MVP holds. iOS, Android and desktop come with the hardware
   milestone.
4. **The WooCommerce side is used as it ships.** Nothing on the store
   changes (ADR 0001). A milestone that would need a server change stops
   and goes to the front desk.

## Milestones

Each says what a tester can do when it is done.

### M0: Scaffold

- **Tester:** nothing yet. A developer runs `pnpm install`, starts the
  web build of `apps/pos`, and sees a placeholder screen rendered with
  `@tallyui` components; CI runs install, typecheck and test on every PR.
- **Jobs:** the scaffold PR (pnpm + turbo, `apps/pos` Expo app on
  `@tallyui/*@2.0.0` from npm, `CLAUDE.md`, CI).
- **Connector:** none.

### M1: Browse the catalogue

- **Tester:** opens the web app, enters a store URL with a WooCommerce
  consumer key and secret, and sees the store's products in a grid with
  image, name and price. Searches by name or SKU. Reloads with the network
  off and still browses the catalogue.
- **Connector:** ready today (products schema, traits, sync, replication).

### M2: Build a cart

- **Tester:** adds simple products to a cart, changes quantities, edits a
  line price, removes lines and sees the subtotal. The cart survives a
  reload and works offline.
- **Connector:** G1, variations, before variable products can be added.
  Simple products need nothing new.

### M3: First sale (the MVP)

- **Tester:** takes cash for a cart and sees the change due. The order
  appears in WooCommerce **once**, at the POS prices, completed, paid by
  cash, with stock reduced. A sale made offline queues and lands exactly
  once on reconnect. A basic receipt prints through the browser's print
  dialog.
- **Scope limit:** the dev store runs with taxes off for M3; M5 turns them
  on. Guest orders only.
- **Connector:** G2, orders (create and read back); G3, an idempotent
  create (see decision D1).

### M4: Customers and receipts

- **Tester:** searches customers by name, email, phone or company,
  attaches one to the sale or leaves it a guest order, creates a new
  customer, and emails the receipt. Offline, the email queues and sends on
  reconnect.
- **Connector:** G4, customers (read, search, create).

### M5: Tax, discounts and coupons

- **Tester:** on a store with taxes on, sees the same tax WooCommerce
  charges, to the cent, for the store's base location. Discounts a line by
  percentage, adds fee and shipping lines and a miscellaneous product,
  applies a WooCommerce coupon and has it refused when its rules say so.
- **Connector:** G5, tax rates and tax settings; G6, coupons.

### M6: Orders and refunds

- **Tester:** browses past orders, reopens one, reprints its receipt, and
  refunds it in full or in part, with stock returned when chosen.
- **Connector:** G2 extended to order history and refunds.

**M0–M6 cover every *stable* selling feature in PARITY.md on WooCommerce
core alone.** From M7 the store needs the WCPOS Free plugin, 1.11.0 or
later, as WCPOS v2 does.

### M7: WCPOS connect

- **Tester:** connects the way WCPOS does: site, then cashier, then store,
  through the plugin's browser login instead of pasted keys. Controls lock
  by the cashier's capabilities. A Pro store offers its stores to pick
  from.
- **Connector:** G7, WCPOS authentication and the store list.

### M8: The v2 checkout

- **Tester:** pays by cash without a server round trip, splits a sale
  across cash and a second method (including by item), takes a payment
  while offline and sees it recorded on reconnect, uses any other
  WooCommerce gateway through the order-pay fallback, and gives an
  order-level quick discount.
- **Connector:** G8, the payments contract (descriptor, ledger, routes)
  and the quick-discount coupon line.

### M9: Registers, closures and reports

- **Tester:** opens the register with a counted float, moves cash in and
  out, closes by counting the drawer and prints the closure; sees the
  day's sales in Reports; every receipt carries the register, the software
  and a QR.
- **Connector:** G9, registers, sessions, cash movements, fiscal records,
  closures and reports.

### M10: Printing, scanning and native apps

- **Tester:** prints to an Epson or Star thermal printer from the web and
  to network, USB or Bluetooth printers from iOS, Android and desktop,
  routes templates to printers, kicks the cash drawer, and scans barcodes
  into the cart. The WCPOS receipt templates render on the device.
- **Connector:** G10, receipt templates and receipt data. Printer and
  scanner packages are a TallyUI question, sent to the front desk.

### M11: Remaining v2 surface

- **Tester:** pairs a customer display; moves the cart to either side and
  uses quick filters; uses card terminals where the store has them; sees
  Store health, Logs and Settings with WCPOS's coverage.
- **Connector:** G11, terminal drivers and customer-display signaling.

**Parity** is M11 done with every PARITY.md row either built or listed as
deliberately outside it, re-checked against the 2.0 tag.

## Decisions needed

- **D1: how an order is created exactly once (before M3).** WooCommerce
  core has no idempotency key on `POST /wc/v3/orders`, and its REST API
  cannot look an order up by meta to check for a replay. The WCPOS Free
  plugin already has one: `wcpos/v2` pushes carry a client uuid, and a
  replayed create resolves to the existing order (wiki:
  `architecture/plugin-free/change-log-retention.md`,
  `typed-meta-and-uuids.md`). **Recommendation:** require the Free plugin
  from M3 rather than M7, and have the connector create orders through
  `wcpos/v2`. The alternative, WooCommerce core only, is at-least-once and
  would put a duplicate-order risk in front of the first testers. This is
  a connector design choice, so it goes to TallyUI through the front desk.
- **D2: authentication until M7.** The connector sends a consumer key and
  secret as HTTP Basic auth. WooCommerce accepts that only over HTTPS; over
  plain HTTP it expects OAuth 1.0a signatures
  (`class-wc-rest-authentication.php`). Whether the same key is accepted
  on `wcpos/v2` routes is unverified; if D1 goes the recommended way, M3
  starts with a spike that answers it.
- **D3: the Free / Pro line.** WCPOS gates some features by the Pro
  licence even when WooCommerce core could serve them (customer create,
  order history, coupons). **Recommendation:** this app uses whatever the
  store's API serves and does not reproduce WCPOS's licence gates; features
  whose server half only Pro has need Pro on the store. This is a
  commercial call, so it is Paul's.
- **D4: hosting for testers (before M3).** `medusapos/app` hosts its web
  build on Vercel (its ADR 0005). The same is likely here, but it is an
  outward-facing choice for the front desk.

## Dev store

A WooCommerce store on this Mac mini for development and e2e runs. It is
never created on the Coolify VPS.

- **Stack: native Homebrew, no Docker.** The Mac mini has no Docker
  runtime, and the Medusa dev store already runs natively (Homebrew
  PostgreSQL and Redis). A native stack avoids a Linux VM's memory on a
  24 GB machine shared by parallel workers. Components: PHP 8.3 with
  php-fpm, MariaDB, WP-CLI, and Caddy as the web server.
- **Why Caddy:** the connector's consumer-key auth works only over HTTPS
  (D2). Caddy serves `https://localhost:8443` with its internal CA
  (`tls internal`, trusted once with `caddy trust`) in front of php-fpm.
- **Ports and sockets:** 8443 for HTTPS; MariaDB on `127.0.0.1:3306`;
  php-fpm on a Unix socket, because port 9000 is already taken on this
  machine.
- **Where it lives:** setup scripts in this repo under `dev/woo-store/`
  (as `medusapos/app` keeps `dev/medusa-store/`), outside the pnpm
  workspace. Runtime state (WordPress files, the database data directory,
  generated keys) lives in one place outside the repo,
  `~/.local/share/tallyui-woocommerce/dev-store/`, so every worktree's
  scripts address the same single store. Generated consumer keys are
  written there and never committed or printed.
- **Contents:** WordPress and WooCommerce at pinned versions; the WCPOS
  Free plugin from wordpress.org at its latest release (1.11.0 once
  released, per D1); a seed of simple and variable products with stock,
  barcodes and images; two tax rates (off until M5); one coupon; one
  customer; a `shop_manager` cashier with a consumer key.
- **Lifecycle:** `up`, `down`, `seed` and `reset` scripts. Services start
  on demand rather than as login items, and are sized small (MariaDB
  buffer pool 128 MB, php-fpm `ondemand` with at most four children).
  `reset` restores the seeded database so e2e runs start from the same
  state.
- **Fallback:** if the native stack proves fiddly, `@wordpress/env` on
  Colima gives the same store in Docker, at the cost of the VM's memory.
- **Jobs, each one Codex spec:** D-1 the service scripts and Caddy config;
  D-2 WordPress, WooCommerce and WCPOS install; D-3 the seed; D-4 `reset`
  and a smoke check that fetches `/wp-json/wc/v3/products` with the
  generated key. Installing Homebrew packages is ordinary admin work on
  this machine.

The dev store is needed from M1 and is built alongside M0.
