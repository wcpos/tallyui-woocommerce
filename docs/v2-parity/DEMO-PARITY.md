# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-11
- Tally Woo: `main` at `3defc595509dfd6c95f0f94663c0cb3d47e0cc5f` (after #185, `@tallyui/*` 3.18.0)
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 3
- Score: `PARITY tally-woo 6/45 (match 6, close 31, differs 0, missing 8)`
- Round 2: 6/45 (match 6, close 28, differs 3, missing 8)
- Round 1: 0/45 (match 0, close 11, differs 23, missing 11)

The score is the number of `match` rows out of all rows in the four tables.
Rows under "Not compared this round" are not scored.

Status values:

- `match`: a cashier would not notice a difference.
- `close`: the same function, with visible differences in look.
- `differs`: it works differently.
- `missing`: Tally Woo does not have it.

"What differs" lists the most visible difference first. Names in quotes
are rows of [AUDIT.md](AUDIT.md).

"Waits on" names what the rest of a gap needs from outside this
repository:

- `shared:<package>`: a TallyUI package, with the TallyUI issue number
  where one is filed.
- `connector`: `@tallyui/connector-woocommerce`.
- `server`: the WooCommerce or WCPOS plugin side.
- `pro`: WCPOS Pro on the store.

A blank cell means the gap can be built here.

Both sides are captured as they first appear.

- The demo is a populated store (209 products, 29,754 orders, 5,146
  customers).
- Tally Woo runs against the local dev store: 10 products, no variable
  products synced, no tax charged. Differences that come only from the
  data are not counted.
- The demo images are round 1's. Only the Tally images were recaptured.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail, register bar, filter chips, category poster tiles; cart head with a "GU Guest" chip, + and a settings icon; empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot | close | The empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only its empty message. The settings icon is a gear, not the demo's sliders. No location pin beside the customer chip ("Redrawn shell") | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings at the foot; "v 0.1.0" | close | No Support entry. Logs now sits under Store health, as in the demo | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a bell and a round "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a round "CA" initials avatar, over the catalogue. With sessions on, a "Register ›" link over the cart | close | No register name beside the store. The bar sits over the catalogue, not the cart ("Registers") | connector | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: name, "US Store · Front Counter · since 14:40", Your sales today, "In the drawer $2,996.12" with "Pay in · Pay out · Close register", Hand the till to, Store and Register with Switch, WordPress Admin, Desktop App, Sign out | Right sheet: name, store, Your sales today, "In the drawer $100.00 · opened 07:11 by cashier" with "Pay in · Pay out · Close register ›", Hand the till to, Another account, WordPress Admin, Sign out | close | The drawer block shows only when register sessions are on, and they are off by default. No store or register switch, no "since" time, no Desktop App ("Register sessions", "Registers") | connector | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to full-bleed product photos with name, price and "12 options" | Coloured category poster tiles (All products, Bakery 2 products …); drills in to "Categories › All products" with full-bleed images, name, price and an in-cart count badge | close | A two-line name ("Coffee Beans 250g") rides up over the image's scrim. "N options" was not seen (no variable products synced) | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" at the top of the column, with scan, list/grid and settings icons beside it | "Search products" at the top of the column, with list/grid and settings icons beside it | close | No scan button. The dev store has no "shirt", so the result grids cannot be compared | | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand | Rounded chips always shown: In Stock (on by default, with ×), On Sale, Category, Tag, then a "Filter bar" text button | close | No Featured or Brand chip. An extra "Filter bar" button ends the row ("Catalogue") | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 9 of 10") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level: coloured folder icon, name, product count, chevron | List rows at the category level: coloured folder icon, name, product count, chevron; drilling in gives a product table | match | | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By and Direction, Variations, Tile Fields, Restore, Close | close | Sort By looks like a text box with no chevron. The Variations Popover option looks greyed out | | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 9 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), grid, bottom tab bar Products / Cart with a count badge | Top bar (menu, store name, bell, avatar), two-column grid, bottom tab bar Products / Cart with a count badge | close | The chips run off the right edge, and the "Filter bar" button sits on its own second row | | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | Table with QTY / ITEM / PRICE / TOTAL headers; quantity in a box; regular price struck through above the sale price | Table with QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only two and a half lines fit above the totals. The quantity is plain text, not a box ("Cart") | shared:@tallyui/components (TallyUI #677) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button with a ⋮ button beside it | One wide "Checkout $14.00" button with a ⋮ button beside it | match | | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33") | Subtotal and Total | close | The per-rate tax lines could not be seen because the dev store charges no tax. The layout is otherwise the same | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart ("Guest $16.83 · 5 h"), + at right | Tabs along the foot of the cart ("Guest · 3 items" over "$14.00"), + at right | close | The tab gives the item count where the demo gives the order's age, and puts the amount on its own line under the name ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a "GU Guest" chip with a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a "GU Guest" chip; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with email | close | No location pin on the chip. The dropdown's rows have no initials avatar ("Customers") | | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price keypad, quick discount keys −5%, −10%, −15%, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, keypad, Apply, Cancel | close | No struck regular price in the popover. A separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet: Panel position, Open orders position, Sort items, Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Centred modal: Panel position, Open orders position, Sort items, Quick Discounts (5 / 10 / 15), Receipt auto show and auto print toggles, Register sessions switch, Restore, Close | close | It is a centred modal, not a side sheet. No Columns section. The quick discount keys read "5", not "−5%" ("Cart") | | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #520) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place to one tile per variation, with attribute chips ("32", "Blue") and a back arrow | Not seen: the dev store's three variable products are still not synced to the app | missing | Cannot be checked until variable products sync ("Variations: drill-in (default)") | | [demo](demo/variations-demo.jpg) |
| B12 | Phone cart (390x844) | Full-screen cart table, "Checkout $16.83", open-order tabs with "3 open" | Full-screen cart table, ⋮ and "Checkout $10.50", open-order tab "Guest · 3 items $10.50", bottom tab bar Products / Cart with a count badge | close | Each line carries a row of −, +, Remove, Discount and Price controls, which take most of the height. No "N open" count on the tabs | shared:@tallyui/components (TallyUI #677) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number, Customer, Billing address, Date created, POS icon, Cashier, Payment method, Total; "TODAY" group heading; "Showing 20 of 29,754" | Table: Status dot, Order number, Customer chip, Date created, Payment method, Total, chevron; TODAY / YESTERDAY / dated group headings; "Showing 25" | close | No Billing address, POS icon or Cashier column. No "of N" total. A filled Back button at top right ("Order history") | connector | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "367" leaves one row, "Showing 1" | match | | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #367": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The tax breakdown was not seen (no tax) | connector | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; add-customer icon; "Showing 10 of 5,146" | Table on arrival: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; search; add-customer icon; "Showing 5" | close | No Date created column and no "of N" total. A filled Back button at top right ("Customers": Customers screen) | connector (TallyUI #680) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; By hour / Running total chart; Orders, Payments, Where sold cards | Till strip ("No register on this device", or with sessions on "This till · Closed", the last closure and Print closure; with a session open, Print X-report, not captured this round); "Everyone ▾" and "vs yesterday ▾" menu chips; big total with Orders, Average order, Items; By hour / Running total chart; Orders, Payments, Where sold cards | close | No store and register menu, date menu, status filter or Print summary. With register sessions off (the default) the strip says "No register on this device" where the demo shows the open register. Both menus sit above the total, where the demo puts vs yesterday under it | | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | Off by default; switched on in Cart settings › Register sessions. When on: Open register with a float; a "This till" dialog with sales this session, Paid in / Paid out / No sale tiles, Expected in the drawer, Close register; then a count with denominations and a closure with "Print the Z report" | close | Sessions are opt-in. The close step is a centred dialog without Print X-report. While the register is closed the cart, and with it the sessions switch, is hidden ("Register sessions") | | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | "US Store · Front Counter": Discrepancy, Sessions, Cash at open, Cash activity, Cash at close; All / Open / Closed; session row with Print X-report; Export CSV | Closures section at the foot of Reports: All / Open / Closed, day group, session row (Expected, Counted, Difference, Result) with Reprint; Download CSV | close | A section of Reports, not its own screen. No headline tiles (Discrepancy, Sessions, Cash at open, Cash activity, Cash at close) ("Numbered closures, X and Z, reprint, recount") | | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Sub-nav beside the rail: General, Tax, Barcode Scanning, Theme; each page in a bordered panel | close | Printing, Card readers and Customer Display are absent (D6–D8) ("Settings area") | connector, pro | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | Editable Store Name; base country, state, city and postcode with "Set in WooCommerce · Open"; Language select; Default Customer select; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals as fields | Store Name, base country, state, city, postcode and Language read-only with "Set in WooCommerce · Open"; Default Customer as a customer chip; Default Customer is cashier switch; Currency, Currency Position, Decimal Separator, Number of Decimals, Thousand Separator read-only with "Set in WooCommerce · Open" | close | Store Name, Language and the currency rows are read-only text with an Open link where the demo has fields and selects. Default Customer is a chip, not a select ("Settings area") | connector | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | Shop base address, Enable Taxes, Prices Entered with Tax, Round Tax at Subtotal Level, View all tax rates | Calculate tax based on Shop base address, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open"; Tax Rates section | match | | | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Sound ("Play a sound on scan"); Barcode Scanning Test | close | No Scanner section ("Scanning") | shared:@tallyui/pos (TallyUI #682) | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | Ten themes: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall | The same ten themes | match | | | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | connector (TallyUI #681) | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | shared:@tallyui/pos (TallyUI #679) | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | connector, pro (TallyUI #684) | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; table Collection / On device / On server / Coverage bar / Size with ⋮ per row | Sub-nav Database / Logs; "✓ Ready to sell", records on this device, storage used, changes waiting to send; table Collection / On device; "Check for changes now" | close | No Performance entry in the sub-nav (D10). No On server, Coverage or Size columns. The dev store had no stuck records, so the attention banner was not seen ("Store health") | connector | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | shared:@tallyui/database (TallyUI #683) | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; Search Logs; All / Actions / Errors / Sync; verbose diagnostics toggle; timestamped rows with a chevron; "next check" line at the foot | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; All / Actions / Errors / Sync; "Verbose diagnostics: off"; Time / Level / Event / Took / Status rows; "Showing 1 of 1" | close | No Search Logs field. Rows have no chevron and the foot has no next-check line. The filters are square buttons, not rounded chips | | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands | Table from the rail: image, name, stock, stock status badge, categories, price, regular and sale price; search; "10 products" | close | No filter chips. Stock is plain text with no Manage toggle. A filled Back button at top right. Variations were not seen (no variable products synced) | | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) |
| D13 | Coupons area | Table from the rail: Active, Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; + to add | Table from the rail: Active badge, Code, Amount, Type, Description, Usage, Expiry date; search; "10 coupons" | close | No Status, Discount Type or Expires chips. No + to add a coupon | | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order 4c316b5e · #367) with Email Receipt. Since #180 the money reads correctly. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #367 (local id 4c316b5e) on the
local dev store. It was a cash sale of $14.00 for two Croissant, one
Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as change.

Register sessions were also exercised:

- Sessions were switched on, a session was opened with a $100.00 float and
  closed with an exact count (Closure #1 · This till, on this device).
- While the register is closed the sessions switch cannot be reached, so a
  second session was opened with a $100.00 float to get to it. Sessions
  were then switched off.
- Both sessions exist only in the capture browser's profile.

A phone cart was voided, and no order was left from it.

## Next for this repo

The gaps that can be built here, in the order a cashier would notice them.

1. **Empty cart** (A1). With no lines, show only the centred "Tap a
   product to start a sale" message. Hide the column headers, the zero
   totals and the disabled Checkout until the first line is added. Use
   the demo's sliders icon for cart settings.
2. **Open-order tabs** (B4, B12). Put the amount on the tab's first line
   and the order's age after it ("Guest $14.00 · 5 h"). Drop the item
   count. On the phone, show "N open".
3. **Customer dropdown rows** (B5). Give each customer row in the dropdown
   an initials avatar, as the cart chip already has.
4. **Order details sheet** (B10). Make the ⋮ open a side sheet with Void,
   Print and Sync order now. Customer Note can be added once TallyUI #520
   lands.
5. **Cart settings as a side sheet** (B9). Open it as a left sheet. Label
   the quick discount keys "−5%", and add a Columns section (Qty, Image,
   Name, SKU switches).
6. **Register sessions** (A4, C7). Turn sessions on by default, so the
   cashier sheet shows "In the drawer" from the start. Keep the sessions
   switch reachable while the register is closed. Show the close step as a
   side sheet with Print X-report.
7. **Catalogue polish** (A5, A7, A10, A12). Keep two-line tile names clear
   of the image scrim. Drop the "Filter bar" text button. Make Sort By a
   select. On the phone, keep the chips to one scrolling row.
8. **Variable products in the dev store** (B11, D12). Sync the dev store's
   three variable products (`dev/woo-store/`), so the variation drill-in
   and "N options" can be scored.
9. **Reports controls** (C6). Add a date menu, a Completed & processing
   filter and Print summary (the till strip's Print X-report shipped in
   #186 and shows once sessions are on, see item 6). Move
   "vs yesterday" under the total.
10. **Closures headline** (C8). Add the Discrepancy, Sessions, Cash at
    open, Cash activity and Cash at close tiles above the closure list.
11. **Logs search** (D11). Add a Search Logs field above the filters, use
    rounded chips, and give each row a chevron.
12. **Products and Coupons areas** (D12, D13):
    - Products: filter chips for stock status, on sale, category and tag.
    - Coupons: status, discount type and expires chips, and a + to add a
      coupon.
13. **Area headers** (C1, C5, C6, D12, D13). Remove the filled Back button
    at the top right and use the demo's plain header; the rail already
    handles navigation.
