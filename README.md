# tallyui-woocommerce
WooCommerce point of sale built on TallyUI, aiming at WCPOS v2 feature parity

## What works today

Demo: https://tallyui-woocommerce.vercel.app. It connects to any store running WCPOS 1.10.x. The dev store runs WCPOS Pro with WCPOS 1.10.20 and the TallyUI fork overlay (see `dev/woo-store/README.md`). Some features turn on only when the store advertises them; those are marked below.

- **Sign in:** sign in with a WCPOS cashier account. The catalogue syncs into the browser (SQLite, one tab) and survives a reload.
- **Cashiers:** switch cashier at the till without reconnecting. Each cashier has their own database, and an open cart waits for its cashier to come back. Remove forgets another cashier's sign-in on this device. Controls lock by the cashier's WordPress capabilities.
- **Catalogue:**
  - Browse in a grid (tile size 2–8 a row, choose the tile fields) or a sortable table, and search by name, SKU or barcode, with live stock.
  - Quick filters: build, edit and reorder filter buttons (category, tag, price, on sale, stock, type) in the Filter bar.
  - Variable products open a variation chooser.
  - **Barcode scanning:** a keyboard-wedge scanner, or Enter in search, adds the matching product.
  - Put the products on either side of the cart and drag the divider to resize them.
- **Cart:**
  - Change quantities and remove lines.
  - Edit a line's price.
  - Discount a line or the whole order by a percentage or an amount.
  - Add a fee, a shipping line or a custom item (stores that advertise `order_create_v5`, such as the dev store).
  - Park a cart, with its customer, and reopen it later; parked carts survive a reload.
- **Coupons:** pick one of the store's WooCommerce coupons from a searchable list; a refused coupon shows the reason (`Coupon expired has expired`). Applied coupons show in the cart and on the receipt, can be removed, stay with a parked cart, and reach WooCommerce as the order's coupon lines (stores on WCPOS 1.9.0 or later that advertise `order_create_v5`, such as the dev store).
- **Customers:** search the store's customers by name, email or phone, attach one or leave the sale as a guest, and create a customer at the till.
- **Tax:** prices and totals use the store's own WooCommerce tax settings and rates, whether prices include tax or not, with discounts on both.
- **Payments:**
  - Take cash and show change, or record a card payment taken on a separate terminal.
  - Split one sale across several cash and card payments (stores that accept a payments list). Backing out after a payment was taken lists the cash to return and the card payments to void first.
  - The order is created in WooCommerce exactly once, as paid and completed, with the customer attached and stock reduced.
  - Sales made offline are queued and sent when the till reconnects.
- **Registers (optional, per till):** open a session with a counted float, pay cash in and out, take an X report, and close by counting, which shows the variance and prints the Z report.
- **Reports:** today's sales on this till against yesterday, with hourly bars, payments by method and taxes by rate; each tile opens a table you can export to CSV. Past closures can be reprinted and exported.
- **Receipts:**
  - The receipt shows the store, cashier, customer, lines, tenders and change, and prints from the browser. Once the sale syncs, the order line adds the WooCommerce order number (`Order 078e9206 · #306`).
  - **Email receipt** sends WooCommerce's order-details email, once, when the cashier asks. It waits until the sale has synced and the till is online. **Store health** lists receipt emails still waiting or failed, to send again or remove.

**Not yet:**
- **Payments:** card-terminal integration, tips and the order-pay page for other gateways.
- **Other lines:** WCPOS's order-level quick-discount coupon.
- **Order history:** browsing past orders and refunds.
- **Server sync for registers:** sessions, closures and reports stay on the device, and a register is bound per cashier rather than per till.
- **Printing:** thermal and cloud printers, and receipt templates.
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
