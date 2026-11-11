# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-11
- Tally Woo: `main` at `d032d4276f70747838aa3d2e7666bd9c8f82f5ca` (after #219, `@tallyui/*` 3.18.0), served as a production bundle
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 6
- Score: `PARITY tally-woo 7/45 (match 7, close 31, differs 0, missing 7)`
- Round 5: 7/45 (match 7, close 30, differs 1, missing 7)
- Round 4: 7/45 (match 7, close 30, differs 0, missing 8)
- Round 3: 6/45 (match 6, close 31, differs 0, missing 8)
- Round 2: 6/45 (match 6, close 28, differs 3, missing 8)
- Round 1: 0/45 (match 0, close 11, differs 23, missing 11)

Register sessions: a front desk ruling of 2026-11-11 supersedes the
2026-10-06 ruling that made sessions opt-in. Paul's target is "look and
function like demo.wcpos.com/pos", so Tally Woo now turns sessions on for a
till with no saved choice. A till that saved a choice keeps it. The switch
is also in Settings › General, where it can be reached while the register
is closed. The default is set in this app only; the shared TallyUI packages
keep theirs, so Medusa POS and Vendure POS do not change. Round 6
captured A4, C6, C7 and C8 with that default: the register opened, sold and
closed with no switch touched.

Register name: a Tally till has one register. v2 adds the register to the
bar's place only when the store has more than one
(`register-bar.helpers.ts`), so the demo's "· Front Counter" comes from its
data, and a bar that reads the store alone is v2's single-register look.
Since #219 the till strip, the session card, the closures header and the
prints name the register ("Register 365E").

Production bundle: round 6 served Tally Woo from `pnpm build` (`expo
export --platform web` into `apps/pos/dist`) behind a static server that
applies `vercel.json`'s rewrite to `index.html`. `expo start --web
--no-dev --minify` served a production script but linked no stylesheet,
so the page was unstyled, and a bare `expo start` skips the `web`
script's SQLite worker build, so the database never opened.

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

A blank cell means the gap can be built here. Where a row has parts of
both kinds, "What differs" says which part waits.

Both sides are captured as they first appear.

- The demo is a populated store (209 products, 29,754 orders, 5,146
  customers).
- Tally Woo runs against the local dev store: 13 products (10 simple, one
  of them out of stock, and 3 variable: T-Shirt with 6 variations, Hoodie
  with 3, Cap with 1), no tax charged. The production bundle syncs the
  variable products ("6 options", "3 options", "1 option"); a dev build
  rejects them until the connector's meta_data fix (TallyUI #713, merged
  as #724) is released. Differences that come only from the data are not
  counted.
- The demo images are round 1's. Only the Tally images were recaptured,
  in a fresh browser profile after the first sync.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail, register bar, one row of filter chips, category poster tiles. On a new till the cart pane has an "Open register" card ("Cash in the drawer to start ($)", Open register) under a "Register closed" pill. Once the register is open: "Register ›" over the cart head with a "GU Guest" chip, + and a sliders icon; an empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot | close | A new till first asks for the opening float (the demo's register was already open, so its open step was not seen). With the register open, the empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only its empty message (merged in TallyUI as #723, awaiting release). No location pin beside the customer chip (A11) | shared:@tallyui/components (TallyUI #694, awaiting release) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health and a Settings gear at the foot; "v 0.1.0" | close | No Support entry (left out on purpose) | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a bell and a round "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a round "CA" initials avatar, over the catalogue; over the cart a "Register closed" pill, or "Register ›" once the register is open | close | The bar sits over the catalogue, not the cart, and the cart pane carries an extra "Register ›" row. The store alone, with no register name, is v2's look for a store with one register, so it is not counted | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: name, "US Store · Front Counter · since 14:40", Your sales today, "In the drawer $2,996.12" with "Pay in · Pay out · Close register", Hand the till to, Store and Register with Switch, WordPress Admin, Desktop App, Sign out | Right sheet: name, store, "Your sales today $14.00", "In the drawer $114.00 · opened 16:16 by cashier" with "Pay in · Pay out · Close register ›", Hand the till to (Another account), WordPress Admin, Sign out | close | No store or register switch, no "since" time under the cashier's name, no Desktop App ("Registers") | connector | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to a blue "All products" tile with a back chevron, then full-bleed product photos with name, price and "12 options" | Coloured category poster tiles (All products, Bakery 2 products …); drills in to "Categories › All products" with full-bleed images, name, price in black, "6 options" under a variable product's price, and an in-cart count badge | close | No "All products" parent tile with a back chevron at the start of the drilled-in grid; the breadcrumb is the only way back | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" at the top of the column, with scan, list/grid and settings icons beside it | "Search products" at the top of the column, with list/grid and settings icons beside it | close | No scan button. The dev store has no "shirt", so the result grids cannot be compared | shared:@tallyui/pos (TallyUI #720) | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand | Rounded chips in one row: In Stock (on by default, with ×), On Sale, Category, Tag; the chips are chosen in Product settings | close | No Featured or Brand chip: the connector syncs neither ("Catalogue") | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 12 of 13") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level: coloured folder icon, name, product count, chevron | List rows at the category level: coloured folder icon, name, product count, chevron; drilling in gives a product table | match | | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields | Right sheet under a v2 header (title and ×): View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By (a select with a chevron) and Direction, Variations, Tile Fields, Restore Default Settings, Close | close | Tile Fields' first switch is labelled "Name" where the demo's reads "Product Name". Tile Fields' switches start at the fold where the demo shows two: TallyUI's Switch is larger than v2's. The Variations Popover option is greyed out: Tally has no variations popover | shared:@tallyui/components (Switch `size="sm"`; TallyUI #719 popover) | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 12 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector (TallyUI #722) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), one scrolling chip row, Compact category tiles four to a row, "Shop base" and the count at the foot, bottom tab bar Products / Cart with a badge | Top bar (menu, store name, bell, avatar), one scrolling chip row, Compact category tiles four to a row with "All products" on two lines, the count with a sync icon at the foot, bottom tab bar Products / Cart with a "New" badge | close | No scan button (A6) and no "Shop base" at the foot (A11); the rest of the phone catalogue matches | shared:@tallyui/pos (TallyUI #720), connector (TallyUI #722) | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | Table with QTY / ITEM / PRICE / TOTAL headers; quantity in a box; regular price struck through above the sale price | Table with QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only three lines fit above the totals. The quantity is plain text, not a box ("Cart") | shared:@tallyui/components (TallyUI #677) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button with a ⋮ button beside it | One wide "Checkout $14.00" button with a ⋮ button beside it | match | | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33") | Subtotal and Total | close | The per-rate tax lines could not be seen because the dev store charges no tax. The layout is otherwise the same | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart: the name over the amount, an age in the warning tone on carts hours old, the open tab underlined, + at right | Tabs along the foot of the cart: "Guest" over "$14.00", the open tab underlined, + at right | match | The age comes from the data: the demo's tabs are hours old, and Tally shows the same warning-tone age on a cart parked for an hour ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a "GU Guest" chip with a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a "GU Guest" chip; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with email | close | The dropdown's rows have no initials avatar: `CustomerSelect` has no row renderer. No location pin on the chip: that is A11's tax location ("Customers") | shared:@tallyui/components (TallyUI #714), connector (TallyUI #722) | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price keypad, quick discount keys −5%, −10%, −15%, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, keypad, Apply, Cancel | close | No struck regular price in the popover. A separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet beside the rail: Panel position, Open orders position, Sort items (select), Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Left side sheet beside the rail under a v2 header (title and ×), in plain labelled rows: Panel position, Open orders position, Sort items (a select with a chevron), Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Register sessions, Restore Default Settings, Close | close | No Columns section. The switches are larger than the demo's. An extra Register sessions row sits where the demo's Columns start ("Cart") | shared:@tallyui/components (TallyUI #695, Switch `size="sm"`) | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #689, awaiting release) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place: the parent tile (photo, name, price, "12 options", back chevron), then one tile per variation with its name, attribute chips ("32", "Blue") and price; the filter chips grey out; "12 options" at the foot | "T-Shirt" (6 options) drills in place: "Categories › All products › T-Shirt", the parent tile (image, name, price, "6 options", back chevron), then one tile per variation with its name, attribute chips ("S", "Black") and price; "6 options" with a sync icon at the foot. Hoodie (3 options) drills in the same way | close | The filter chips stay live while drilled in, where the demo greys them out. The layout itself matches. A dev build still rejects the variable products when they sync (TallyUI #713, merged as #724, awaiting release) | | [demo](demo/variations-demo.jpg) · [tally](demo/variations-tally.jpg) |
| B12 | Phone cart (390x844) | Top bar; full-screen cart table, "Checkout $16.83"; one-line open-order tabs ("Guest $16.83") with a "3 ^" count; bottom tab bar | Top bar (menu, store, bell, avatar) and "Register ›"; full-screen cart table, ⋮ and "Checkout $10.50"; a one-line open-order tab "Guest $10.50"; bottom tab bar Products / Cart with a badge | close | Each line carries a row of −, +, Remove, Discount and Price controls, which take most of the height. No "N ^" count at the left of the tabs | shared:@tallyui/components (TallyUI #677) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number, Customer, Billing address, Date created, POS icon, Cashier, Payment method, Total; "TODAY" group heading; narrow search with a settings, bell and avatar cluster; "Showing 20 of 29,754" with a sync icon | Table on a bordered card: Status dot, Order number, Customer chip, Date created, Payment method, Total, chevron; TODAY / YESTERDAY / dated group headings; narrow search with a bell and avatar at right; "Showing 25" with a sync icon under the card | close | No Billing address, POS icon or Cashier column, and no "of N" total ("Order history"). No settings icon beside the bell | connector (columns; X-WP-Total, TallyUI #680) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector (TallyUI #721) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "370" leaves one row, "Showing 1" | match | | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #370": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The tax breakdown was not seen (no tax) | connector | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; narrow search with add-customer, settings, bell and avatar; "Showing 10 of 5,146" | Table on a bordered card: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; narrow search with add-customer, bell and avatar; "Showing 5" with a sync icon under the card | close | The avatars are pale grey where the demo's are solid primary. No Date created column and no "of N" total ("Customers": Customers screen) | connector (X-WP-Total, TallyUI #680), shared:@tallyui/components (TallyUI #718) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu with bell and avatar; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; By hour / Running total chart with a dashed comparison and a muted future bar; Orders, Payments, Where sold cards | One-row till strip ("Register 365E ● Open since 16:16 · cashier", Opening float + Cash sales = Expected in drawer, Print X-report, a chevron to Closures); "Today · Wed 11 Nov" with a chevron, a rounded "Everyone" chip with an icon, Print summary; big total with Orders, Average order, Items; a rounded "vs yesterday" chip beside By hour / Running total; By hour in v2's steps ("$14.00 · 1 order" over the 16:00 bar); Orders, Payments, Where sold cards | close | No store and register menu, bell or avatar over the page. No "Completed & processing" chip (left out: every local sale is complete). The date menu has no calendar. The dashed comparison and the muted future bar draw only when the day before has sales on this device, so this capture shows neither | connector (status chip, store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | On by default: Open register with a float; a centred "Register" dialog with "1 sale this session", Paid in / Paid out / No sale tiles, Expected in the drawer (Cash $114.00), Close register; then "Count the drawer" in the cart pane with denominations, Back to selling, Close register; then a closure ("Closure #1", Counted, Expected, Exact) with "Print the Z report" | close | The close step is a centred dialog with no big drawer amount, no Session sales total, no Other tenders row and no Cancel or Print X-report | shared:@tallyui/components (TallyUI #716) | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | Its own screen, "US Store · Front Counter ▾" header with bell and avatar, Today date menu and All cashiers chip: Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; day band; session row with Print X-report; tinted Export CSV with an icon | Its own room from the chevron at the end of the till strip: back arrow, "TallyUI WooCommerce dev store · Register 365E", "Today · Wed 11 Nov" with a chevron, a rounded "All cashiers" chip with an icon, Export CSV with an icon; Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card with "1 session"; Today band with "$114.00 counted · Exact"; a closure row (Expected, Counted, Difference, Result) with Reprint | close | The header has no bell or avatar and no menu chevron. Export CSV is outlined where the demo's is tinted. The date menu has no calendar | shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Sub-nav beside the rail: General, Tax, Barcode Scanning, Theme; each page in a bordered panel | close | Printing, Card readers and Customer Display are absent (D6–D8) ("Settings area") | connector, pro | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | Editable Store Name; base country, state, city and postcode with "Set in WooCommerce · Open"; Language select; Default Customer select; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals as fields | Store Name, base country, state, city, postcode and Language read-only with "Set in WooCommerce · Open"; Default Customer as a customer chip; Default Customer is cashier switch; Currency, Currency Position, Decimal Separator, Number of Decimals, Thousand Separator read-only with "Set in WooCommerce · Open"; Register sessions switch | close | Store Name, Language and the currency rows are read-only text with an Open link where the demo has fields and selects. Default Customer is a chip, not a select ("Settings area") | connector | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | Shop base address, Enable Taxes, Prices Entered with Tax, Round Tax at Subtotal Level, View all tax rates | Calculate tax based on Shop base address, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open"; Tax Rates section | match | | | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Sound ("Play a sound on scan"); Barcode Scanning Test | close | No Scanner section ("Scanning") | shared:@tallyui/pos (TallyUI #682) | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | Ten themes: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall | The same ten themes | match | | | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | connector (TallyUI #681) | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | shared:@tallyui/pos (TallyUI #679) | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | connector, pro (TallyUI #684) | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; table Collection / On device / On server / Coverage bar / Size with ⋮ per row | Sub-nav Database / Logs; "✓ Ready to sell", records on this device, storage used, changes waiting to send; table Collection / On device; "Check for changes now" | close | No Performance entry in the sub-nav (D10). No On server, Coverage or Size columns. The dev store had no stuck records, so the attention banner was not seen ("Store health") | connector | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | shared:@tallyui/database (TallyUI #683) | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; verbose diagnostics toggle; Time / Level / Event / Duration / Status rows with a chevron; "Showing 46 of 46" and a "next check" line at the foot | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; "Verbose diagnostics: off"; Time / Level / Event / Duration / Status rows with a chevron ("Order accepted by the store", "Register session opened"); "Showing 2 of 2" | close | No "next check" line at the foot. Sync runs write no row; the demo logs them ("Loaded the records this screen needs") | shared:@tallyui/database (TallyUI #683) | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail in a bordered panel: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status dot, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands; narrow search with a settings, bell and avatar cluster; "Showing 10 of 209" | Table from the rail on a bordered card: image, name, stock, stock status dot ("● In Stock"), categories, price, regular and sale price; a variable product shows "1 variation" under its name; chips Stock Status, On Sale, Category, Tag; narrow search with a bell and avatar at right; "Showing 13 of 13" with a sync icon under the card | close | The variations cell is plain text, not a "N variations ›" link with attribute links. No Featured or Brands chip, and stock is plain text with no Manage toggle (connector). No settings icon beside the bell | connector | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) |
| D13 | Coupons area | Table from the rail in a bordered panel: Active dot, Code, Amount, Type, Description, Usage, Expiry date, inline edit; chips Status, Discount Type, Expires; + to add; narrow search with an icon cluster | Table from the rail on a bordered card: Active dot ("● Active"), Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; narrow search with a bell and avatar at right; "Showing 10 of 10" with a sync icon under the card | close | No + to add a coupon and no inline edit (the connector has no coupon writes). No calendar behind Expires. No settings icon beside the bell | connector, shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order a9887af0 · #370, cashier, "Register: Register 365E") with Print receipt, New sale and Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #370 (local id a9887af0) on the
local dev store. It was a cash sale of $14.00 for two Croissant, one
Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as change.

Register sessions were also exercised, with sessions on by default and no
switch touched:

- A fresh till showed the Open register card. A session was opened at
  16:16 with a $100.00 float, took order #370, and was closed at 16:23
  with an exact count of $114.00 (Closure 1 · Register 365E). The register
  was left closed.
- The session exists only in the capture browser's profile.

A phone cart was voided, and no order was left from it.

## Next for this repo

The gaps that can be built here, in the order a cashier would notice them.

1. **Register bar over the cart** (A3). Move the register bar's store,
   bell and avatar over the cart column, as v2 does, and fold "Register ›"
   into it instead of a separate row.
2. **All products parent tile** (A5). When "All products" is drilled into,
   start the grid with v2's blue "All products" tile and its back chevron,
   as the variation drill-in already does with its parent tile.
3. **Filter chips while drilled in** (B11). Grey out and disable the
   filter chips while a variable product is drilled in, as v2 does.
4. **Product settings label** (A10). Rename the first Tile Fields switch
   from "Name" to v2's "Product Name" (`lib/catalogue/catalogue-view-state.ts`).
5. **Phone cart tabs** (B12). Add v2's "N ^" count at the left of the
   phone's open-order tabs, opening the full list.
6. **Area header cluster** (C1, C5, D12, D13). Add v2's settings icon
   beside the bell in each area's search row, opening that area's column
   settings.
7. **Reports and closures header** (C6, C8). Put the bell and avatar at
   the right of the Reports page and the Closures header, as v2 does over
   every room.
8. **Export CSV** (C8). Tint Export CSV with the primary tone, as v2 does.
9. **Products variations cell** (D12). Make "N variations" a link with a
   chevron that opens the variations, with the attribute names under the
   product name.
