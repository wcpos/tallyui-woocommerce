# 0001. The repository's place and what it does not do

Status: Accepted
Date: 2026-09-28

## Context

TallyUI is a set of commerce-agnostic POS packages published to npm as
`@tallyui/*`. Two apps already consume them: `medusapos/app` (Medusa) and
`vendurepos` (Vendure). Paul's brief of 2026-09-28 ([BRIEF.md](../BRIEF.md))
adds a third, for WooCommerce, aiming at feature parity with WCPOS v2.

WCPOS already is a WooCommerce POS: the `wcpos/monorepo` client and the
`woocommerce-pos` / `woocommerce-pos-pro` plugins. This app is not a
replacement for it and must not become a second place where WCPOS work is
done. It is a TallyUI app that happens to sell from WooCommerce, and the
test of TallyUI's claim that one set of packages serves every platform.

`@tallyui/connector-woocommerce@2.0.0` is the published WooCommerce
connector. As of 2026-09-28 it covers products only: one RxDB schema,
product traits, a pull sync and a replication, over the WooCommerce REST API
authenticated with a consumer key and secret.

## Decision

1. **This repository mirrors `medusapos/app`.** Same shape (pnpm + turbo
   monorepo, an Expo app under `apps/pos`), same house rules, same Codex
   spec process, same one-lane (`main`) branching. Where the two differ, it
   is because WooCommerce differs from Medusa, and the difference is
   recorded in an ADR here.
2. **It consumes TallyUI from npm only.** `@tallyui/*` packages are
   dependencies at published versions (`2.0.0` at the start). Never a
   `file:` link, a `workspace:` link into a TallyUI checkout, a git
   dependency, a vendored copy or a patch-package patch.
3. **`@tallyui/connector-woocommerce` is the integration point.** Every
   WooCommerce schema, trait, sync and replication the app uses comes from
   the connector. When the app needs a WooCommerce capability the connector
   lacks (customers, orders, taxes, coupons, a different auth), the gap is
   written up and sent to the front desk, which dispatches the TallyUI
   work; this app then upgrades to the release that has it. The app does
   not grow its own parallel WooCommerce layer. If a milestone cannot wait,
   a stopgap may compose the connector's exported pieces inside
   `apps/pos`, marked as such, with the TallyUI issue linked in the code
   comment, and it is removed on the upgrade.
4. **The WooCommerce side is used as it ships.** The app talks to
   WooCommerce core's REST API and, where a feature needs it, to the WCPOS
   plugins' released REST contract (`wcpos/v1`, and `wcpos/v2` once 1.11.0 /
   2.0 ships). It reads those contracts; it does not change them.

## What this repository deliberately does not do

- **No WCPOS backlog work.** Bugs, features and roadmap items of WCPOS
  (the monorepo client, the plugins, wcpos.com) are not picked up here,
  even when this app hits them. A WCPOS defect found here is written up and
  sent to the front desk.
- **No PHP plugin changes.** Not to `woocommerce-pos`, not to
  `woocommerce-pos-pro`, not to any add-on, and no companion plugin of our
  own on the WooCommerce side. If parity needs a server route that does not
  exist, that is a WCPOS decision for Paul, not a task here.
- **No TallyUI package code.** TallyUI changes are made in the TallyUI
  repository by a worker dispatched there.
- **No production infrastructure.** The dev store runs on the Mac mini
  (see [PLAN.md](../PLAN.md)); nothing is created on the Coolify VPS.
- **No multi-instance storage.** One tab, one database, following the
  machine-wide single-instance rule and WCPOS v1.11.0's move to SQLite
  (monorepo#2146). Storage choice is TallyUI's; this app does not build
  cross-tab leader election or shared sessions.

## Consequences

- The app's progress is gated by the connector. Customers, orders and
  checkout cannot land until TallyUI publishes them, so PLAN.md orders the
  milestones by what the connector can do and names each connector gap.
- Parity is measured against WCPOS's shipped behaviour, not reimplemented
  from WCPOS source. Features whose server half lives in the WCPOS plugins
  (registers, payment ledger, fiscal records) require those plugins on the
  store; a store without them gets the WooCommerce-core subset.
- Because nothing on the WooCommerce side changes, a merchant can run this
  app against the same store as WCPOS without either noticing the other,
  apart from ordinary shared stock and orders.
