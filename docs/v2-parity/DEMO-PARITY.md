# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-11
- Tally Woo: `main` at `8c1752386f14fcfb535bb93f58b8d22bb8129fbd` (after #176, `@tallyui/*` 3.17.0); #177 (Logs: Actions chip and stuck-record stats) was not merged and is not scored
- Demo: WCPOS `v 2.0.0` (as printed under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 2
- Score: `PARITY tally-woo 6/45 (match 6, close 28, differs 3, missing 8)`
- Round 1: 0/45 (match 0, close 11, differs 23, missing 11)

The score counts rows whose status is `match` over every row in the four
tables. Rows in "Not compared this round" are left out of it.

Status values: `match` (a cashier would not notice), `close` (same
function, visible differences in look), `differs` (works differently),
`missing` (Tally Woo lacks it). "What differs" puts the most visible
difference first. Row names in quotes are rows of [AUDIT.md](AUDIT.md).
"Waits on" names what the rest of the gap needs from outside this
repository: `shared:<package>` (a TallyUI package), `connector`
(`@tallyui/connector-woocommerce`), `server` (the WooCommerce or WCPOS
plugin side) or `pro`. A blank cell means the gap can be built here.

Both sides are captured as they first appear. The demo is a populated store
(209 products, 29,754 orders, 5,146 customers). Tally Woo runs against the
local dev store (10 products, no variable products synced, no tax charged), so
differences that come only from the data are not counted. The demo images
are round 1's; only the Tally images were recaptured.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail, register bar, filter chips, category poster tiles; empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale."; "+ New" tab at the foot | close | The cart column still carries an "Add coupon" field, a "Cart Settings" text button, an "Add charge" button and the "Use register sessions" toggle where the demo has a + icon and a settings icon ("Redrawn shell") | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at top; Store health, Settings, Support at foot; "v 2.0.0" | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at top; Store health, Logs, Settings at foot; "v 0.1.0" | close | Logs has its own rail entry instead of sitting under Store health; no Support entry | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a bell and a round "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a round "CA" initials avatar, over the catalogue; with sessions on, a "Register ›" link over the cart | close | No register name beside the store; the bar sits over the catalogue rather than the cart ("Registers") | connector | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: name, "US Store · Front Counter · since 14:40", Your sales today, "In the drawer $2,996.12" with "Pay in · Pay out · Close register", Hand the till to, Store and Register with Switch, WordPress Admin, Desktop App, Sign out | Right sheet: name, store, Your sales today, "In the drawer $100.00 · opened 04:50 by cashier" with "Pay in · Pay out · Close register ›", Hand the till to, Another account, WordPress Admin, Sign out | close | The drawer block shows only once register sessions are switched on (off by default); no store or register switch, no "since" time, no Desktop App ("Register sessions", "Registers") | connector | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to full-bleed product photos with name, price and "12 options" | Coloured category poster tiles (All products, Bakery 2 products …); drills in to "Categories › All products" with full-bleed images, name, price and an in-cart count badge | close | A two-line name ("Coffee Beans 250g") rides up over the image's scrim. "N options" not seen (no variable products synced) | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" at the top of the column, with scan, list/grid and settings icons beside it | "Search products" at the top of the column, with list/grid and settings icons beside it | close | No scan button. The dev store has no "shirt", so the result grid cannot be compared | | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand | Rounded chips always shown: In Stock (on by default, with ×), On Sale, Category, Tag, then a "Filter bar" text button | close | No Featured or Brand chip; an extra "Filter bar" button ends the row ("Catalogue") | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 9 of 10") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level: coloured folder icon, name, product count, chevron | List rows at the category level: coloured folder icon, name, product count, chevron; drilling in gives a product table | match | | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock, Sort By and Direction, Variations, Tile Fields, Restore, Close | close | Sort By looks like a text box without a chevron; the Variations Popover option looks greyed out | | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 9 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen; the count and sync icon now match ("Tax") | connector | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), grid, bottom tab bar Products / Cart with a count badge | Top bar (menu, store name, bell, avatar), two-column grid, bottom tab bar Products / Cart with a count badge | close | The chips wrap to a second row with the "Filter bar" button on its own line | | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | Table with QTY / ITEM / PRICE / TOTAL headers; quantity in a box; regular price struck through above the sale price | Table with QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only two lines fit above the totals; quantity is plain text, not a box ("Cart") | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button with a ⋮ button beside it | One wide "Checkout $14.00" button with a ⋮ button beside it | match | | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33") | Subtotal and Total | close | Per-rate tax lines were not seen because the dev store charges no tax; layout is otherwise the same | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart ("Guest $16.83 · 5 h"), + at right | Tabs along the foot of the cart ("Guest · 3 items" over "1400"), + at right | close | The tab's amount shows raw minor units ("1400" for $14.00), and the tab leads with the item count ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a "GU Guest" chip with a location pin; the chip opens a dropdown with "Search Customers", Guest and a list of customers with initials and email | "Customer" label and a "GU Guest" chip; the chip opens an inline panel with "Search Customers", a list of customers with email, New customer and Cancel | close | The list opens inline and pushes the cart down instead of dropping over it; no location pin ("Customers") | | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | "Add charge" button: Fee, Shipping, Custom item with a tax class; "Order discount" button with Percent / Amount | close | Charges and the order discount are separate inline controls instead of one + menu | | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price keypad, quick discount keys −5%, −10%, −15%, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, keypad, Apply, Cancel | close | No struck regular price in the popover; a separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | "Add coupon" field above the lines opens a modal listing codes with descriptions and amounts; Coupons is also its own area in the rail | differs | Tally still puts a coupon field in the cart; the demo keeps the cart free of it | | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet: Panel position, Open orders position, Sort items, Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Centred modal: Panel position, Open orders position, Sort items, Quick Discounts (5 / 10 / 15), Receipt auto show and auto print toggles, Restore, Close | close | A centred modal, not a side sheet; no Columns section ("Cart") | | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place to one tile per variation with attribute chips ("32", "Blue") and a back arrow | Not seen: the dev store's three variable products are still not synced to the app | missing | Cannot be checked until variable products sync ("Variations: drill-in (default)") | | [demo](demo/variations-demo.jpg) |
| B12 | Phone cart (390x844) | Full-screen cart table, "Checkout $16.83", open-order tabs with "3 open" | Full-screen cart table, ⋮ and "Checkout $10.50", open-order tab, bottom tab bar Products / Cart with a count badge | close | The line button rows take most of the height; the tab amount shows raw minor units ("1050"); the register sessions toggle sits under the cart | | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number, Customer, Billing address, Date created, POS icon, Cashier, Payment method, Total; "TODAY" group heading; "Showing 20 of 29,754" | Table: Status dot, Order number, Customer chip, Date created, Payment method, Total, chevron; TODAY / YESTERDAY / dated group headings; "Showing 25" | close | No Billing address, POS icon or Cashier column; no "of N" total; a filled Back button at top right ("Order history") | connector | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | No way to narrow the list except search ("Order history": filters) | connector | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "366" leaves one row | match | | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #366": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, no Re-open or Delete ("Order history": detail, reopen, edit, delete). Tax breakdown not seen (no tax) | connector | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; add-customer icon; "Showing 10 of 5,146" | Search field and add button only, "Type at least 2 characters of a name, email or phone." | differs | No list until the cashier types ("Customers": Customers screen) | connector, shared:@tallyui/core | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; By hour / Running total chart; Orders, Payments, Where sold cards | Till strip ("No register on this device", or with sessions "This till · Closed" and the last closure); Everyone / cashier and vs yesterday / vs last Wednesday segments; big total with Orders, Average order, Items; By hour / Running total chart; Orders, Payments, Where sold cards | close | No store and register menu, no date menu, no status filter, no Print summary or X-report; segments instead of chips ("Reports") | | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | Off by default behind a "Use register sessions" toggle. When on: Open register with a float; "This till" dialog with sales this session, Paid in / Paid out / No sale tiles, Expected in the drawer, Close register; then a count with denominations and a closure with "Print the Z report" | close | Sessions are opt-in from the cart foot; the close step is a centred dialog without Print X-report ("Register sessions") | | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | "US Store · Front Counter": Discrepancy, Sessions, Cash at open, Cash activity, Cash at close; All / Open / Closed; session row with Print X-report; Export CSV | Closures section at the foot of Reports: All / Open / Closed, day group, session row (Expected, Counted, Difference, Result) with Reprint; Download CSV | close | A section of Reports, not its own screen; no headline tiles (Discrepancy, Sessions, Cash at open, Cash activity, Cash at close) ("Numbered closures, X and Z, reprint, recount") | | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Sub-nav beside the rail: General, Tax, Barcode Scanning, Theme; each page in a bordered panel | close | Printing, Card readers and Customer Display are absent (D6–D8) ("Settings area") | connector, pro | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | Editable Store Name; base country, state, city, postcode with "Set in WooCommerce · Open"; Language; Default Customer; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals | Store Name, base country, state, city, postcode, Language and Currency, each read-only with "Set in WooCommerce · Open" | differs | Store Name is not editable; no Default Customer, Default Customer is Cashier or number format settings ("Settings area") | connector | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | Shop base address, Enable Taxes, Prices Entered with Tax, Round Tax at Subtotal Level, View all tax rates | Calculate tax based on Shop base address, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open"; Tax Rates section | match | | | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Sound ("Play a sound on scan"); Barcode Scanning Test | close | No Scanner section ("Scanning") | shared:@tallyui/pos | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | Ten themes: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall | The same ten themes | match | | | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | connector | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | connector | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | connector, pro | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; table Collection / On device / On server / Coverage bar / Size with ⋮ per row | "✓ Ready to sell", records on this device, storage used, changes waiting to send; table Collection / On device; "Check for changes now" | close | No Database / Performance / Logs sub-nav; no stuck-record banner (with #177); no On server, Coverage or Size columns ("Store health") | connector | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | shared:@tallyui/database | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Events, errors and stuck-record counts; Copy debug info; All / Actions / Errors / Sync; verbose diagnostics toggle; timestamped sync, info and warn rows | Events and errors today; Copy debug info; All / Errors / Sync; "Verbose diagnostics: off"; Time / Level / Event / Took / Status rows | close | No Actions filter or stuck-record count (both in #177); Logs is its own area rather than under Store health | | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands | Table from the rail: image, name, stock, stock status badge, categories, price, regular and sale price; search; "10 products" | close | No filter chips; stock is plain text with no Manage toggle; a filled Back button. Variations not seen (no variable products synced) | | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) |
| D13 | Coupons area | Table from the rail: Active, Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; + to add | Table from the rail: Active badge, Code, Amount, Type, Description, Usage, Expiry date; search; "10 coupons" | close | No Status, Discount Type or Expires chips; no + to add a coupon | | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These are in the cashier's path, but one side could not be captured under
the round's rules. They are left out of the score.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining); right Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | Paid moment over a zoomed receipt (order 735d8291 · #366) with Email Receipt. The headline shows raw minor units: "Change 600", "Paid 1400 · tendered 2000 in cash". [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened this round; its quick discount keys are in B7 | Inline "Discount on Cold Brew" and "Order discount" forms with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Support area | The demo's Support area is a third-party chat widget; its requests were aborted | — |

Tally Woo test order made this round: #366 (local id 735d8291), cash, $14.00
tendered $20.00, change $6.00; two Croissant, one Espresso and one Cold Brew
on the local dev store. Register sessions were switched on, a session opened
with a $100.00 float and closed with an exact count (Closure 1 · This till, on
this device), and the switch was turned back off.

## Next for this repo

Gaps that can be built here, in the order a cashier notices them.

1. **Money shown as minor units** (B4, B12, receipt). The open-order tab
   shows "1400" and the paid moment "Change 600". Both pass the store locale
   to `formatMoney`, and the dev store's locale is WooCommerce's `en_US`
   (Settings › General). `Intl` rejects underscores, so `formatMoney`
   returns undefined and the raw number is shown. The likely fix is to
   normalise the locale to BCP 47 (`en-US`) once, in
   `lib/catalogue/store-info.ts`.
2. **Cart column clutter** (A1, B6, B8). Replace the "Add coupon" field,
   the "Cart Settings" text button and the "Add charge" / "Order discount"
   buttons with a + menu (customer, miscellaneous product, fee, discount,
   shipping) and a settings icon in the cart head. Move the "Use register
   sessions" toggle out of the cart foot.
3. **Line button rows** (B1, B7, B12). Drop the −, +, Remove and Discount
   row under each line. Put the quantity in a box and let the line popover
   carry the price, discount and remove, with the regular price struck
   through.
4. **Order details** (B10). Make the ⋮ open a sheet: Customer Note, Tax
   exempt, Hand over, Void, Print, Sync order.
5. **Drawer always on** (A4, C7). Turn register sessions on by default so
   "In the drawer" is in the cashier sheet from the start. Show the close
   step as a side sheet with Print X-report.
6. **Customer picker** (B5). Drop the list over the cart instead of pushing
   it down inline.
7. **Catalogue polish** (A5, A10, A12). Keep two-line tile names clear of
   the image scrim. Make Sort By a select. On the phone, keep the chips to
   one scrolling row.
8. **Variable products in the dev store** (B11, D12). Sync the dev store's
   three variable products (`dev/woo-store/`) so the variation drill-in and
   "N options" can be scored.
9. **Reports controls** (C6). Add a date menu, a Completed & processing
   filter, Print summary and the till strip's Print X-report.
10. **Store health sub-nav** (A2, D9, D11). Put Database, Performance and
    Logs under Store health, and drop the Logs rail entry. Land the
    stuck-record banner and the Actions chip (#177).
11. **Closures headline** (C8). Add the Discrepancy, Sessions, Cash at
    open, Cash activity and Cash at close tiles over the closure list.
12. **Products and Coupons areas** (D12, D13). Add filter chips (stock
    status, on sale, category, tag; status, discount type, expires).
13. **Area headers** (C1, C6, D12, D13). Replace the filled Back button at
    the top right with the demo's plain header, since the rail already
    navigates.
