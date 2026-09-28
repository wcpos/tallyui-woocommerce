# 0001. The repository's place and what it does not do

Status: Accepted
Date: 2026-09-28

## Context

TallyUI is a set of commerce-agnostic POS packages published to npm as
`@tallyui/*` (2.0.0 published 2026-09-28). `medusapos/app` is the first app
built on them: a Medusa POS. It resolves TallyUI from a sibling checkout
pinned to a commit through `file:` overrides, because the packages were not
published in usable form when it started. `vendurepos` is planned but has
only a README. Paul's brief of 2026-09-28 ([BRIEF.md](../BRIEF.md)) adds a
WooCommerce app, aiming at feature parity with WCPOS v2.

WCPOS already is a WooCommerce POS: the `wcpos/monorepo` client and the
`woocommerce-pos` / `woocommerce-pos-pro` plugins. This app is not a
replacement for it and must not become a second place where WCPOS work is
done. It is a TallyUI app that sells from WooCommerce, and a test of
TallyUI's claim that one set of packages serves every platform.

`@tallyui/connector-woocommerce@2.0.0` covers products only. Its schema is
keyed on the `uuid` the WCPOS Free plugin adds to POS requests, and it
authenticates with a WooCommerce consumer key. The rest of TallyUI's domain
(cart, tax maths, tender, register sessions, receipt data, an order outbox
with a pluggable transport) is in `@tallyui/pos` and is not
WooCommerce-specific.

## Decision

1. **This repository mirrors `medusapos/app`.** It has the same shape (a
   pnpm + turbo monorepo with the Expo app in `apps/pos`, where medusapos
   uses `apps/expo`), the same house rules, the same Codex spec process
   and one lane (`main`). Where the two differ, it is because WooCommerce
   differs from Medusa or because of point 2, and the difference is
   recorded in an ADR here.
2. **It consumes TallyUI from npm only.** Every `@tallyui/*` package is a
   dependency at one exact published version, all the same (`2.0.0` at the
   start), upgraded together. There is never a `file:` link, a `workspace:`
   link into a TallyUI checkout, a git dependency, a vendored copy, a
   patch, or a resolver alias to a package's `src`. This is the deliberate
   difference from medusapos: it does not copy medusapos's `file:`
   overrides.
3. **`@tallyui/connector-woocommerce` is the integration point.** Every
   WooCommerce schema, trait, sync, replication and transport the app uses
   comes from TallyUI. When the app needs something TallyUI lacks, the gap
   is written up and sent to the front desk, which dispatches the TallyUI
   work; this app then upgrades to the release that has it. The app does
   not grow its own parallel WooCommerce layer. If a milestone cannot wait,
   a stopgap may compose the connector's exported pieces inside
   `apps/pos`, marked as a stopgap with the TallyUI issue linked in a code
   comment, and it is removed on the upgrade.
4. **The WooCommerce side is used as it ships.** The app talks to
   WooCommerce core's REST API and to the WCPOS plugins' released REST
   contract (`wcpos/v1`, and `wcpos/v2`, which shipped in the Free plugin
   1.10.0). v2-only features are built against the plugins' `next` builds
   on the dev store until v2 is released. The app reads those contracts; it
   does not change them.

## What this repository deliberately does not do

- **No WCPOS backlog work.** Bugs, features and roadmap items of WCPOS
  (the monorepo client, the plugins, wcpos.com) are not picked up here,
  even when this app hits them. A WCPOS defect found here is written up and
  sent to the front desk.
- **No PHP plugin changes.** No change to `woocommerce-pos`,
  `woocommerce-pos-pro`, any WCPOS add-on or any other existing plugin.
  No companion plugin of its own either, as medusapos has for Medusa:
  decision D1 in [PLAN.md](../PLAN.md) (2026-09-28) makes the WCPOS Free
  plugin's `wcpos/v2` API the surface this app writes through.
- **No TallyUI package code.** TallyUI changes are made in the TallyUI
  repository by a worker dispatched there.
- **No production infrastructure.** The dev store runs on the Mac mini
  (see [PLAN.md](../PLAN.md)); nothing is created on the Coolify VPS.
- **No multi-instance storage.** One tab, one database, following the
  machine-wide single-instance rule and WCPOS v2's move to SQLite
  (monorepo#2146). Storage choice is TallyUI's; this app does not build
  cross-tab leader election or shared sessions.

## Consequences

- **TallyUI releases gate the app.** Because only published versions are
  used, every gap waits for a TallyUI release: 2.0.0 came out the day this
  repository started. PLAN.md orders the milestones by what TallyUI can do,
  names each gap, and asks for them one milestone ahead.
- **Parity is measured against WCPOS's shipped behaviour, not
  reimplemented from WCPOS source.** Features whose server half lives in the
  WCPOS plugins (the product uuid, registers, the payment ledger, fiscal
  records) need those plugins on the store.
- **This app will look like a WCPOS client to the store.** Because it syncs
  and writes through `wcpos/*` routes (D1), its orders carry WCPOS's POS metadata,
  and WCPOS's own surfaces (Store health's register checks, reports) will
  see them, for example as sales from a till with no register. That is
  accepted as the cost of using the plugin rather than changing it; the
  exact effects are listed in the M3 spike's findings.
