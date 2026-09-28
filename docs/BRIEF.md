# Brief: WooCommerce POS on TallyUI

*Paul's brief, 2026-09-28, as relayed by the front desk. This file records
his words; the plan and parity target that follow from it are in
[PLAN.md](PLAN.md) and [PARITY.md](PARITY.md).*

## The track

> A WooCommerce point of sale built on TallyUI, running in parallel with
> Medusa POS and Vendure POS, consuming the TallyUI packages
> (`@tallyui/*@2.0.0` from npm, including `connector-woocommerce`; never
> `file:` links), aiming at feature parity with WCPOS v2 when v2 ships.

This repository (`wcpos/tallyui-woocommerce`, private) is its home.

## First two deliverables, in order

1. **A plan PR** (docs only):
   - `docs/BRIEF.md`: this file.
   - `docs/PARITY.md`: the WCPOS v2 feature set as the target, built from
     the roadmap repo, the wiki and the monorepo `next` branch, each feature
     marked *stable across main and next*, *in flux*, or *v2-only*.
   - `docs/PLAN.md`: an MVP-first milestone list, saying what a tester can
     do at each milestone, and the dev-store plan (a WooCommerce dev store
     on the Mac mini, never on the production VPS).
   - `docs/adr/0001`: the repository's place (mirrors `medusapos/app`,
     consumes TallyUI, `connector-woocommerce` is the integration point) and
     what it deliberately does not do (no WCPOS backlog work, no PHP plugin
     changes).
2. **A scaffold PR**, modelled on `medusapos/app`'s first commits: a
   pnpm + turbo monorepo, an `apps/pos` Expo app that boots to a
   placeholder screen on `@tallyui` packages, `CLAUDE.md` (lanes: `main`
   only; house rules per `~/Projects/CLAUDE.md`), and a CI workflow with
   install, typecheck and test.

## Process

- The worker writes Codex specs from `~/.claude/codex/SPEC-TEMPLATE.md`,
  one small job each; Codex implements through `codex-job.sh --network` on
  clean feature branches; the worker reviews the full diff and reruns the
  acceptance commands before committing.
- The plan PR is docs only: the worker may write it, with an Opus review.
- Each PR number goes to the front desk. Never push to `main`.
