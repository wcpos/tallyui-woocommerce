# tallyui-woocommerce

A WooCommerce point of sale built on TallyUI, aiming at feature parity with
WCPOS v2. It mirrors `medusapos/app` and runs alongside Medusa POS and
Vendure POS. Read `docs/BRIEF.md`, `docs/PLAN.md`, `docs/PARITY.md` and
`docs/adr/` before planning work.

The house rules in `~/Projects/CLAUDE.md` apply in full. This file adds only
what is specific to this repository.

## Lanes

- **One lane: `main`.** Every change is a feature branch and a PR into
  `main`. Never push to `main` directly.

## Layout

- `apps/pos`: the Expo (expo-router) app, package
  `@tallyui-woocommerce/pos`. Web first; native and desktop come later.
- `dev/woo-store/` (planned, see `docs/PLAN.md`): scripts for the local
  WooCommerce dev store on this Mac mini. It is outside the pnpm workspace.

## Commands

Run from the repository root:

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`: turbo runs `tsc --noEmit` in each package
- `pnpm test`: Vitest from the root config, capped at two workers
- `pnpm --filter @tallyui-woocommerce/pos web`: start the web app
- `pnpm build`: turbo runs the app's `expo export --platform web` into
  `apps/pos/dist`, the check that Metro and uniwind bundle the app

Keep `react`, `react-dom`, `react-native` and the other Expo-managed
packages at the versions `expo install --check` expects, and declare the
same exact `react` / `react-dom` at the root: a second React copy renders
a blank page.

Never put a test file under `apps/pos/app/`: expo-router treats every file
there as a route.

## TallyUI

- `@tallyui/*` packages come from npm at one exact version, all the same
  (`2.0.0` now). Upgrade them together in one PR.
- Never a `file:`, `link:` or `workspace:` specifier, a git dependency,
  `pnpm.overrides`, a patch, or a Metro, tsconfig or Vitest alias that
  points at a package's `src`. Resolve through the published `exports`.
- `@tallyui/connector-woocommerce` is the only WooCommerce integration
  point (ADR 0001). When the app needs something the connector lacks,
  write the gap up and send it to the front desk; TallyUI changes are made
  in the TallyUI repository, never here.

## Boundaries

- No WCPOS backlog work, and no changes to the WCPOS PHP plugins or any
  other WooCommerce plugin. A WCPOS defect found here goes to the front
  desk.
- The dev store runs on this Mac mini only, never on the production VPS.
- Storage is single-instance: one tab, one database. No cross-tab leader
  election or `multiInstance: true`.
