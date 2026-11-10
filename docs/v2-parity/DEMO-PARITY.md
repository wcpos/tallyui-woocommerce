# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-10
- Tally Woo: `main` at `d0534a8b2da8c9f8631671d33897db14478f8588` (after #131, the register bar and drawer)
- Demo: WCPOS `v 2.0.0` (as printed under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 1
- Score: `PARITY tally-woo 0/45` (match 0, close 11, differs 23, missing 11)

The score counts rows whose status is `match` over every row in the four
tables. Rows in "Not compared this round" are left out of it.

Status values: `match` (a cashier would not notice), `close` (same
function, visible differences in look), `differs` (works differently),
`missing` (Tally Woo lacks it). "What differs" puts the most visible
difference first. Row names in quotes are rows of [AUDIT.md](AUDIT.md).

Both sides are captured as they first appear. The demo is a populated store
(209 products, 29,754 orders, 5,146 customers). Tally Woo runs against the
local dev store (10 products, no variable products synced, no tax charged), so
differences that come only from the data are not counted.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Pair |
|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Top bar with menu button, product grid, cart column of stacked buttons, "Use register sessions" toggle at the foot | differs | The demo shows categories first beside a nearly empty cart. Tally shows products beside eight cart buttons and a settings toggle ("Redrawn shell") | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at top; Store health, Settings, Support at foot; "v 2.0.0" | Hamburger opens an overlay menu: POS, Orders, Customers, Reports; Store health, Logs, Settings; "Version 0.1.0" | differs | No rail is on screen; every area is two taps away, and Products and Coupons have no entry ("Redrawn shell") | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a bell and a round "BR" initials avatar | "TallyUI WooCommerce dev store" over the catalogue, with a filled "Cashier: cashier" button | close | The register name and notifications bell are absent; the cashier is a wide filled button, not an initials avatar ("Redrawn shell", "Registers") | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: name, "US Store · Front Counter · since 14:40", Your sales today, "In the drawer $2,996.12" with "Pay in · Pay out · Close register", Hand the till to, Store and Register with Switch, WordPress Admin, Desktop App, Sign out | Sheet: name, store, Your sales today, Hand the till to with Another account, WordPress Admin, Sign out | differs | No drawer block (cash in drawer, pay in, pay out, close register) and no store or register switch ("Register sessions", "Registers") | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to full-bleed product photos with name, price and "12 options" | Flat grid of every product: an 80px placeholder square on a white card, name, price | differs | No browse-by-category landing and no drill-in; images are small squares instead of filling the tile ("Catalogue", "Grid tile visual") | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" at the top of the column, with scan, list/grid and settings icons beside it | "Search name, SKU or barcode" under a "10 products" heading, with Grid/Table and Product settings buttons above it | close | The search box sits one row lower and has no scan button; view and settings are text buttons, not icons. The dev store has no "shirt", so the result grid cannot be compared | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand | Hidden behind a "Filter bar" button | differs | The cashier cannot see or clear filters at a glance; In Stock is not on by default ("Catalogue") | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Shown, with "Sold out" in place of the price (Banana Bread) | differs | A sold-out tile takes a grid slot on the first screen | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level: coloured folder icon, name, product count, chevron | Flat product table: Name, Price (green, sale price in red with "was"), Stock badge, Category | close | The demo keeps the category browse in table view; Tally lists products with stock badges | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields | Centred modal: Tile size slider, eight Tile fields toggles, Restore default settings, Close | differs | No Browse by, sort, out-of-stock, view mode or variations choice; a modal instead of a side sheet ("Catalogue") | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | "10 products" heading over the grid; "Sales are up to date." under the cart | missing | No way to switch the tax location from the POS screen ("Tax") | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), grid, bottom tab bar Products / Cart with a count badge | Same top bar squeezed into one row, two-column grid, "Cart is empty" bar at the foot | differs | No bottom tab bar ("Redrawn shell": phone tabs) | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Pair |
|---|---|---|---|---|---|---|
| B1 | Cart lines | Table with QTY / ITEM / PRICE / TOTAL headers; quantity in a box; regular price struck through above the sale price | Stacked line: name, "$3.50 × 2", Discount and Price links, −, + and Remove buttons | differs | No column layout; quantity is changed with buttons rather than the quantity box; no struck regular price ("Cart") | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button with a ⋮ button beside it | Two buttons, "Cash" and "Card terminal", without the amount | differs | The cashier picks a method before seeing a tender screen, and the total is not on the button ("Tender pane") | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33") | Subtotal and Total | close | Per-rate tax lines were not seen because the dev store charges no tax; layout is otherwise the same | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart ("Guest $16.83 · 5 h"), + at right | "Guest · 2 items" strip with "+ New" at the foot, plus Park cart and Parked (0) buttons at the top | close | Tally adds park buttons at the top; the tabs show item count instead of total and age ("Cart": open-order tabs) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a "GU Guest" chip with a location pin; the chip opens a dropdown with "Search Customers", Guest and a list of customers with initials and email | "Guest" text and a filled "Change customer" button; an inline "Search name, email or phone" field with New customer and Cancel; no list until you type | close | No customer list on open; a button instead of a chip ("Customers") | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | "Add charge" button: Fee, Shipping, Custom item with a tax class; "Order discount" link with Percent / Amount | close | Tally splits charges and the order discount into separate inline controls instead of one menu | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price keypad, quick discount keys −5%, −10%, −15%, check button | Separate inline "Price for Croissant" field, and a Discount field with Percent / Amount, Apply, Cancel | differs | No keypad and no quick discount keys ("Cart": line edit) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | "Add coupon" field above the lines opens a modal listing codes with descriptions and amounts | differs | Tally puts a coupon field in the cart; the demo keeps the cart free of it | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet: Panel position, Open orders position, Sort items, Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Centred modal: Cart left / right, Sort items, Restore Default Settings, Close | differs | No open-orders position, quick discount, receipt or column settings ("Cart") | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | Not found | missing | No customer note, tax exempt or hand over ("Order note and meta") | [demo](demo/order-details-demo.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place to one tile per variation with attribute chips ("32", "Blue") and a back arrow | Not seen: the dev store's three variable products are not synced to the app | missing | Cannot be checked until variable products sync ("Variations: drill-in (default)") | [demo](demo/variations-demo.jpg) |
| B12 | Phone cart (390x844) | Full-screen cart table, "Checkout $16.83", open-order tabs with "3 open" | Full-screen cart with a "Back to products" button | differs | No tab bar and no open-order tabs on the phone ("Redrawn shell": phone tabs) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Pair |
|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number, Customer, Billing address, Date created, POS icon, Cashier, Payment method, Total; "TODAY" group heading; "Showing 20 of 29,754" | "Recent" heading over cards ("Order 363 · 2 items", date, total, status), each with a full-width Open button | differs | Cards instead of a table; no cashier or payment column and no day grouping ("Order history") | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | No way to narrow the list except search ("Order history": filters) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the cards | close | Same search; results show as cards | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | The card expands in place: item lines and "Cash $10.00" | differs | No sheet, no tax or payment breakdown, no edit, re-open or delete ("Order history": detail, reopen, edit, delete) | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; add-customer icon; "Showing 10 of 5,146" | Search field only, "Type at least 2 characters" | differs | No list until the cashier types ("Customers": Customers screen) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; By hour / Running total chart; Orders, Payments, Where sold cards | "No register on this device"; Everyone / cashier and vs yesterday / vs last Tuesday segments; Today as text; By hour bars; "Payments ›" | differs | No register strip, no headline figures row, no summary cards, no print ("Reports") | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | Off by default behind a "Use register sessions" toggle; when on, "Register closed" and an Open register form with a float field. Close was not seen (no session opened) | differs | Sessions are opt-in from the cart foot instead of always on from the cashier sheet ("Register sessions") | [demo](demo/register-close-demo.jpg) · [tally](demo/register-open-tally.jpg) |
| C8 | Closures | "US Store · Front Counter": Discrepancy, Sessions, Cash at open, Cash activity, Cash at close; All / Open / Closed; session row with Print X-report; Export CSV | Not found | missing | No list of past sessions ("Numbered closures, X and Z, reprint, recount") | [demo](demo/closures-demo.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Pair |
|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Full screen with a filled "Back" button and "Settings" title; sub-nav General, Tax, Barcode Scanning, Theme | differs | Three pages absent; the screen replaces the POS instead of sitting beside the rail ("Settings area") | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | Editable Store Name; base country, state, city, postcode with "Set in WooCommerce · Open"; Language; Default Customer; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals | Store Name, Currency and Language, each read-only with "Set in WooCommerce · Open" | differs | Nothing is editable; no default customer or number format ("Settings area") | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | Shop base address, Enable Taxes, Prices Entered with Tax, Round Tax at Subtotal Level, View all tax rates | Calculation card: Prices entered with tax, Shipping tax class, Round tax at subtotal level, each "Set in WooCommerce · Open" | close | No base address, no enable switch and no tax rates viewer ("Tax": settings page, rates viewer) | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Barcode Scanning Test | close | No Sound or Scanner sections ("Scanning") | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | Ten themes: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall | System, Light, Dark | differs | Seven themes absent ("Scale and Fonts display settings, the ten themes") | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; table Collection / On device / On server / Coverage bar / Size with ⋮ per row | One table: Products 10, Coupons 10, Parked sales 0, Orders 1; "Check for changes now" | differs | No ready-to-sell headline, no stuck-record banner, no server count or coverage ("Store health") | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Events, errors and stuck-record counts; Copy debug info; All / Actions / Errors / Sync; verbose diagnostics toggle; timestamped sync, info and warn rows | Empty table; All / Errors / Sync; Copy debug info | close | No Actions filter, counts or verbose toggle; Logs is its own area rather than under Store health | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands | Not present | missing | No product list outside the sale screen | [demo](demo/products-area-demo.jpg) |
| D13 | Coupons area | Table from the rail: Active, Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; + to add | Not present (codes only in the cart's coupon modal) | missing | No coupon list outside the cart | [demo](demo/coupons-area-demo.jpg) |

## Not compared this round

These are in the cashier's path, but one side could not be captured under
the round's rules. They are left out of the score.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Text "Total / Paid / Remaining / Change", Cash and Card toggle, amount field, Add, Complete sale, Back; no keypad, no quick cash amounts. [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Each Add makes a leg with Remove ("Split payments") |
| Receipt | Same | Inline receipt card (order bcb8d15a · #365, lines, Cash tendered $20.00, Change $10.00), Print receipt, New sale, Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened this round; its quick discount keys are in B7 | [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Register close on Tally | No session was opened on the dev store | — |
| Support area | The demo's Support area is a third-party chat widget; its requests were aborted | — |

Tally Woo test order made this round: #365 (local id bcb8d15a), cash, $10.00,
two Croissant and one Espresso on the local dev store.

## Top 10 a cashier notices first

1. **First screen, navigation.** Put a permanent icon rail at the left and a
   "Store · Register" bar with a bell and an initials avatar over the cart, in
   place of the menu button and the filled "Cashier: cashier" button. App-local.
2. **Catalogue.** Open on coloured category tiles that drill in
   ("Categories › All products"), with product photos filling the tile and
   "N options" under variable products. App-local.
3. **Filter chips.** Show In Stock, Featured, On Sale, Category, Tag and Brand
   as chips under the search at all times, with In Stock on by default so
   sold-out tiles leave the grid. App-local.
4. **Cart lines.** Lay the cart out as a QTY / ITEM / PRICE / TOTAL table with
   the regular price struck through above a sale price. App-local.
5. **Pay button.** One wide "Checkout $total" button with a ⋮ for order
   details, in place of separate Cash and Card terminal buttons. App-local.
6. **Line edit.** One popover on the line with a price keypad and −5%, −10%,
   −15% quick discount keys, in place of separate Price and Discount fields.
   App-local.
7. **Cart header.** A "Customer" chip that opens a searchable list, a + menu
   (customer, miscellaneous product, fee, discount, shipping) and a settings
   icon, in place of the stacked Change customer, Park cart, Parked, Add coupon
   and Cart Settings buttons. App-local.
8. **Drawer and register.** Move the drawer into the cashier sheet ("In the
   drawer", Pay in · Pay out · Close register) and show the register strip on
   Reports, in place of the opt-in toggle at the foot of the cart. App-local;
   the register list and binding need the connector and server ("Registers").
9. **Orders.** A table with status, number, customer, cashier, payment method
   and total, grouped by day, with filter chips. App-local for the table;
   connector for the filters ("Order history").
10. **Customers.** List customers in a table on open instead of waiting for
    two typed characters. connector, shared:@tallyui/core ("Customers").
