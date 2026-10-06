# tallyui-woocommerce
WooCommerce point of sale built on TallyUI, aiming at WCPOS v2 feature parity

## What works today

Demo: https://tallyui-woocommerce.vercel.app. It connects to any store running WCPOS 1.10.x; the dev store is WCPOS 1.10.20.

- **Sign in:** sign in with a WCPOS cashier account. The catalogue syncs into the browser (SQLite, one tab) and survives a reload.
- **Catalogue:** browse and search by name, SKU or barcode, with live stock. Variable products open a variation chooser.
- **Cart:**
  - Change quantities and remove lines.
  - Edit a line's price.
  - Discount a line or the whole order by a percentage or an amount.
  - Park a cart, with its customer, and reopen it later; parked carts survive a reload.
- **Customers:** search the store's customers by name, email or phone, attach one or leave the sale as a guest, and create a customer at the till.
- Register sessions (optional, per till): open with a float, pay in and out, close with a count.
- **Cash and card sales:**
  - Take cash and show change, or record a card payment taken on a separate terminal.
  - The order is created in WooCommerce exactly once, as paid and completed, with the customer attached and stock reduced.
  - Sales made offline are queued and sent when the till reconnects.
- **Receipts:**
  - The receipt shows the WooCommerce order number.
  - **Email receipt** sends WooCommerce's order-details email, once, when the cashier asks. It waits until the sale has synced and the till is online.

**Not yet:**
- **Taxes:** on a store that charges tax, the till takes no payment, and says so, until tax support lands.
- **Payments:** card-terminal integration and split tender. WooCommerce takes one payment per order.
- **Other lines:** coupons, and fee, shipping and miscellaneous lines.
- **Order history:** browsing past orders and refunds.
- Register sessions are per signed-in cashier on each till; switching cashiers or sharing a drawer comes with cashier switching and register sync.
- **Platforms:** native and desktop apps.

WooCommerce sends its own order emails unless WCPOS → Settings → Checkout → Customer emails is off.

## CI

CI never saves the pnpm store to the GitHub Actions cache, and pnpm never caches side effects (local installs always use a local store). This is enforced by `sideEffectsCache: false` in `pnpm-workspace.yaml`, `package-manager-cache: false` on setup-node, and a CI step that fails if the side-effects cache is enabled.

Install and rebuild output that touches rxdb-premium echoes the access token, so filter the whole command's output, for example:

```sh
set -o pipefail
{ pnpm install --frozen-lockfile; } 2>&1 | { grep -vi accessToken || true; }
```

`pipefail` keeps pnpm's exit status and `|| true` stops grep failing when every line is filtered; CI's install step uses the same form.

## License

MIT. See [LICENSE](LICENSE).
