# tallyui-woocommerce
WooCommerce point of sale built on TallyUI, aiming at WCPOS v2 feature parity

## CI

CI never saves the pnpm store to the GitHub Actions cache, and pnpm never caches side effects (local installs always use a local store). This is enforced by `sideEffectsCache: false` in `pnpm-workspace.yaml`, `package-manager-cache: false` on setup-node, and a CI step that fails if the side-effects cache is enabled.

Install and rebuild output that touches rxdb-premium echoes the access token, so filter the whole command's output, for example:

```sh
set -o pipefail
{ pnpm install --frozen-lockfile; } 2>&1 | { grep -vi accessToken || true; }
```

`pipefail` keeps pnpm's exit status and `|| true` stops grep failing when every line is filtered; CI's install step uses the same form.
