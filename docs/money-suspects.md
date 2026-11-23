# Money suspects: where the till's total and the store's can part

The till prices a sale itself and posts it to WooCommerce. Any rule the two sides apply differently gives a sale whose
store total is not what the till charged. This note keeps the cases this app has checked, what each check found, and
what the app does about it. The WooCommerce lines cited are from the plugin source the dev store runs.

## S1: the store's "Number of decimals" differs from the currency's (RED, blocked)

WooCommerce rounds an order's tax and total to the store's **Number of decimals** (`price_num_decimals`;
`abstract-wc-order.php:2282` in `update_taxes`, `:2436` in `calculate_totals`). The till rounds money at the
currency's ISO minor digits. On a USD store set to 0 decimals, 9.99 plus 10% tax is 10.99 at the till and 11 at the
store:

- On a WCPOS 1.10.x store the order is accepted with a `total_mismatch` warning.
- On a WCPOS 2.x (ledger) store the order is refused after the cash is taken.

**What the app does (#631):** `apps/pos/lib/sale/store-decimals.ts` compares the two, and `StoreSettingsGate` refuses
to sell on a mismatch, with a screen naming the setting to change. It checks at connect and on every settings
refresh, not per sale. A store that reports no decimals is not blocked.

**What removes the block:** TallyUI rounding tax and total to the store's decimals the way WooCommerce does. That is
TallyUI's work (gap note sent 23 Nov 2026). Whole-unit stores are a real configuration, so the block comes out in the
same PR as the `@tallyui/*` bump that ships it.

## S2: tax-inclusive prices, customer taxed at a rate other than the base (GREEN)

A 12.00 inclusive product with a 20% base rate, sold to a customer whose billing address is taxed at 10% (order.create
8). The till splits 12.00 at the customer's rate into net 10.909091 plus tax 1.090909 and posts only the net. The REST
forward keeps the posted net (`class-wc-rest-orders-v2-controller.php:1010` overrides the base-adjusted value from
`:999`) and recomputes tax at the billing rate (`woocommerce-pos/includes/Orders.php:755-759`), so the store keeps
12.00 as well. Pinned by the order.create 8 inclusive test in `apps/pos/tests/tax-based-on-footer.test.tsx`.

WooCommerce's own web cart would charge that customer 11.00 (`woocommerce_adjust_non_base_location_prices` rebases
the price). The till's 1.00 above the web price is product behaviour, not a fault (front desk ruling, 23 Nov 2026).

## Any case left: the order shows in Orders

A sale the store accepted at a different total carries a `total_mismatch` warning. Orders lists it in the attention
band at the top, with both totals, until the cashier marks it handled. A sale the store refused for its total is
listed there with the store's own sentence.
