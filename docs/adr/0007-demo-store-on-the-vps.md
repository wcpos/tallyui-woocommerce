# 0007. The demo store is the VPS store at tally-woo-demo.wcpos.com

Status: Accepted
Date: 2026-11-12
Supersedes: [0003](0003-demo-store-through-funnel.md)

## Context

ADR 0003 made the Mac mini's dev store the public demo, served through
Tailscale Funnel at a `ts.net` address. That address was the store's
WordPress `home`, so a demo visitor saw it on the connect screen, in
every request, in product image URLs and in the cashier sheet's
WordPress Admin link, which answered 403 because the public filter
closes `wp-admin`. Paul asked (2026-11-12) for a proper public store
instead of hiding those links.

## Decision

- The public demo connects to `https://tally-woo-demo.wcpos.com`. It is a
  Coolify service on the VPS with its own database, owned and run by the
  wcpos-infra worker (runbook: `services/tally-woo-demo/README.md` in
  wcpos/wcpos-infra). This repository never changes it; problems go to
  wcpos-infra through the front desk.
- The store runs WooCommerce with WCPOS Pro, seeded with the demo's
  products. Visitors sign in as a dedicated `cashier` user, through the
  WCPOS login (`/wcpos-auth/`). The user cannot create or edit customers,
  reset its password or change its account, and the store keeps only its
  200 newest sessions. Its password is kept outside every repository.
- The app still hard-codes no store: a visitor types the store's address
  on the connect screen. The one demo-specific constant is
  `DEMO_STORE_HOME` in `apps/pos/lib/auth/capabilities.ts`, which gives the
  demo its own "can't create customers" line, because on the demo no one
  can grant the permission.
- `wp-admin` on the demo store opens its WordPress login, as on any
  store, so the cashier sheet's WordPress Admin link works there.
- The Mac mini dev store stays the local development, e2e and parity
  capture store. Its Funnel route is no longer the demo and is not
  advertised. The Funnel itself stays, because other services on the
  machine use it.

## Consequences

- The demo no longer depends on the Mac mini being up.
- A browser that signed in to the old demo keeps the Funnel store in its
  saved session until it signs out and connects to the new address.
- Parity captures still run against the dev store, so dev-store docs keep
  its Funnel URL, marked as local development only.
