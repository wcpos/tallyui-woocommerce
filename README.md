# tallyui-woocommerce
WooCommerce point of sale built on TallyUI, aiming at WCPOS v2 feature parity

## CI

CI and any install of the licensed `rxdb-premium` package never cache the pnpm store or its side effects. This is enforced by `sideEffectsCache: false` in `pnpm-workspace.yaml`, `package-manager-cache: false` on setup-node, and a CI step that fails if the side-effects cache is enabled.

Install and rebuild output that touches rxdb-premium echoes the access token, so filter the whole command's output, for example `{ pnpm install --frozen-lockfile; } 2>&1 | grep -vi accessToken`.
