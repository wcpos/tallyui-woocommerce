# 0004. M1 syncs through `@tallyui/database`, not `@wcpos/sync-engine`

Status: Accepted
Date: 2026-10-05

## Context

PLAN.md's M1 says the app syncs through `@wcpos/sync-engine`, per TallyUI
ADR-067, and does not use the connector's replication adapters. On
2026-10-05:

- `@wcpos/sync-engine` is not on npm (`npm view` gives 404). This
  repository takes dependencies only from npm at exact versions (CLAUDE.md),
  so the app cannot use it.
- `@tallyui/connector-woocommerce@3.0.0` already does G1. It signs in with
  the WCPOS token (`Authorization: Bearer`, `X-WCPOS: 1`), reads products
  through `wcpos/v2` with the `uuid`, sends `modified_after` with
  `dates_are_gmt=true`, and treats any product whose status is not `publish`
  as a deletion. It also ships `replication.products` and
  `reconcile.catalogue`, which run under `@tallyui/database`'s
  `startReplication` and `startCatalogueReconcile`.

## Decision

- M1 pulls products with `startReplication` on the connector's
  `replication.products`, and runs `startCatalogueReconcile` on
  `reconcile.catalogue` beside it, as the connector's README describes.
- The app keeps all sync wiring in one module, so moving to
  `@wcpos/sync-engine` once it is published touches that module only.
- Persistence follows the single-instance storage rule: RxDB Premium
  SQLite-wasm on the web through `@tallyui/storage-sqlite`, one tab per
  store. It comes as its own M1 job, after sign-in and browsing work. Until
  then the database is in memory and re-syncs after a reload.
- The app writes nothing locally into the replicated `products`
  collection.

## Consequences

- G1 needs no TallyUI release. M1 is app work and dev-store work.
- If TallyUI ADR-067 makes the replication adapters obsolete before
  `@wcpos/sync-engine` reaches npm, this ADR is revisited. That is the
  front desk's call with the TallyUI worker.
