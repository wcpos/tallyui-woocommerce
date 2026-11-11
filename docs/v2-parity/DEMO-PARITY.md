# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-11
- Tally Woo: `main` at `8a2032729587c7d04ceac0e6200f2d533257358d` (after #207, `@tallyui/*` 3.18.0), served as a production bundle
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 5
- Score: `PARITY tally-woo 7/45 (match 7, close 30, differs 1, missing 7)`
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
keep theirs, so Medusa POS and Vendure POS do not change. Round 5
captured A4 and C7 with that default: the register opened, sold and
closed with no switch touched.

Production bundle: round 5 served Tally Woo from `pnpm build` (`expo
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
  variable products; a dev build rejects them (B11). Differences that
  come only from the data are not counted.
- The demo images are round 1's. Only the Tally images were recaptured.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail, register bar, one row of filter chips, category poster tiles. On a new till the cart pane has an "Open register" card ("Cash in the drawer to start ($)", Open register) under a "Register closed" pill. Once the register is open: cart head with a "GU Guest" chip, + and a sliders icon; an empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot | close | A new till first asks for the opening float (the demo's register was already open, so its open step was not seen). With the register open, the empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only its empty message. No location pin beside the customer chip (A11) | shared:@tallyui/components (TallyUI #694) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health and a Settings gear at the foot; "v 0.1.0" | close | No Support entry (left out on purpose). The Settings icon is now the demo's gear | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a bell and a round "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a round "CA" initials avatar, over the catalogue; over the cart a "Register closed" pill, or "Register ›" once the register is open | close | No register name beside the store. The bar sits over the catalogue, not the cart ("Registers") | connector | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: name, "US Store · Front Counter · since 14:40", Your sales today, "In the drawer $2,996.12" with "Pay in · Pay out · Close register", Hand the till to, Store and Register with Switch, WordPress Admin, Desktop App, Sign out | Right sheet: name, store, "Your sales today $14.00", "In the drawer $114.00 · opened 13:12 by cashier" with "Pay in · Pay out · Close register ›", Hand the till to (Another account), WordPress Admin, Sign out. The drawer block shows with no switch, as sessions are on by default | close | No store or register switch, no register name and "since" time under the cashier's name, no Desktop App ("Registers") | connector | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to full-bleed product photos with name, price and "12 options" | Coloured category poster tiles (All products, Bakery 2 products …); drills in to "Categories › All products" with full-bleed images, name, price, "6 options" under a variable product's price, and an in-cart count badge | close | A variable product's price is green where the demo's is black (the dev store's variable products are not on sale). Two-line names now sit clear of the image, as in the demo | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" at the top of the column, with scan, list/grid and settings icons beside it | "Search products" at the top of the column, with list/grid and settings icons beside it | close | No scan button. The dev store has no "shirt", so the result grids cannot be compared | shared:@tallyui/pos | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand | Rounded chips in one row: In Stock (on by default, with ×), On Sale, Category, Tag. The "Filter bar" button is gone; the chips are chosen in Product settings | close | No Featured or Brand chip: the connector syncs neither ("Catalogue") | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 12 of 13") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level: coloured folder icon, name, product count, chevron | List rows at the category level: coloured folder icon, name, product count, chevron; drilling in gives a product table | match | | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By (a select with a chevron) and Direction, Variations, Tile Fields, Restore Default Settings, Close | close | The Variations Popover option is greyed out: Tally has no variations popover. Tile Fields' switches start at the fold where the demo shows two | shared:@tallyui/components | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 12 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), one scrolling chip row, four narrow category tiles to a row, "Shop base" and the count at the foot, bottom tab bar Products / Cart with a badge | Top bar (menu, store name, bell, avatar), one scrolling chip row, four narrow category tiles to a row at the default Tile Size, the count at the foot, bottom tab bar Products / Cart with a badge | close | No scan button (A6) and no "Shop base" at the foot (A11). The "All products" tile cuts its name to "All prod…" | | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | Table with QTY / ITEM / PRICE / TOTAL headers; quantity in a box; regular price struck through above the sale price | Table with QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only three lines fit above the totals. The quantity is plain text, not a box ("Cart") | shared:@tallyui/components (TallyUI #677) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button with a ⋮ button beside it | One wide "Checkout $14.00" button with a ⋮ button beside it | match | | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33") | Subtotal and Total | close | The per-rate tax lines could not be seen because the dev store charges no tax. The layout is otherwise the same | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart: the name over the amount, an age in the warning tone on carts hours old, the open tab underlined, + at right | Tabs along the foot of the cart: "Guest · 3 items" over "$14.00", the open tab underlined, + at right | match | The name and the age come from the data. Tally's tab name is v2's `tabWho` rule (the demo's orders carry the billing name "Guest"), and Tally shows the same warning-tone age on a cart parked for an hour; the demo's tabs are hours old ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a "GU Guest" chip with a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a "GU Guest" chip; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with email | close | The dropdown's rows have no initials avatar: `CustomerSelect` has no row renderer. No location pin on the chip: that is A11's tax location ("Customers") | shared:@tallyui/components, connector | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price keypad, quick discount keys −5%, −10%, −15%, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, keypad, Apply, Cancel | close | No struck regular price in the popover. A separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet beside the rail: Panel position, Open orders position, Sort items (select), Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Left side sheet: Panel position, Open orders position, Sort items, Quick Discounts (−5% / −10% / −15%), Receipt auto show and auto print toggles, Register sessions, Restore Default Settings, Close | close | No Columns section (TallyUI #695). The sheet starts at the screen's edge and covers the rail. Sort items looks like a text box with no chevron. Sections sit in bordered groups under bold headings, where the demo's are plain rows ("Cart") | shared:@tallyui/components (TallyUI #695) | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #689, awaiting release) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place to one tile per variation, with attribute chips ("32", "Blue") and a back arrow | Tapping "T-Shirt" (6 options) replaces the grid with an attribute picker: the name, Size S / M / L and Colour Black / White buttons, and Cancel | differs | The cashier picks one button per attribute where the demo shows one tile per variation with its chips, a back arrow and the parent tile. The drill-in layout can be built here. It works only in a production build: a dev build rejects the variable products when they sync, so a dev store shows none | connector | [demo](demo/variations-demo.jpg) · [tally](demo/variations-tally.jpg) |
| B12 | Phone cart (390x844) | Top bar; full-screen cart table, "Checkout $16.83"; one-line open-order tabs ("Guest $16.83") with a "3 ^" count; bottom tab bar | Top bar (menu, store, bell, avatar) and "Register ›"; full-screen cart table, ⋮ and "Checkout $10.50"; a one-line open-order tab "Guest · 3 items $10.50"; bottom tab bar Products / Cart with a badge | close | Each line carries a row of −, +, Remove, Discount and Price controls, which take most of the height. The tab adds "· 3 items" and there is no "N ^" count at left | shared:@tallyui/components (TallyUI #677) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number, Customer, Billing address, Date created, POS icon, Cashier, Payment method, Total; "TODAY" group heading; "Showing 20 of 29,754" | Table on a bordered card: Status dot, Order number, Customer chip, Date created, Payment method, Total, chevron; TODAY / YESTERDAY / dated group headings; "Showing 25" under the card | close | No Billing address, POS icon or Cashier column, and no "of N" total ("Order history"). The search runs the full width with no settings, bell and avatar cluster, and the count has no sync icon | connector | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "368" leaves one row, "Showing 1" | match | | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #368": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The tax breakdown was not seen (no tax) | connector | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; add-customer icon; "Showing 10 of 5,146" | Table on a bordered card: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; search; add-customer icon; "Showing 5" under the card | close | The avatars are pale grey where the demo's are solid primary. No Date created column and no "of N" total ("Customers": Customers screen) | connector (TallyUI #680), shared:@tallyui/components (avatars) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; a full-day By hour / Running total chart; Orders, Payments, Where sold cards | Till strip ("This till ● Open since 13:12 · cashier", Opening float + Cash sales = Expected in drawer, Print X-report, a chevron to Closures); "Today · Wed 11 Nov ▾" date menu (Today, Yesterday, This week, Last week, This month, Last month), "Everyone ▾", Print summary; big total with Orders, Average order, Items; "vs yesterday ▾" beside By hour / Running total; Orders, Payments, Where sold cards | close | No store and register menu over the page. No "Completed & processing" chip (left out: every local sale is complete). Everyone and vs yesterday are small square menus where the demo's are rounded chips with icons. By hour trims to the hours with sales as v2 does, but always in hourly columns where v2 sizes its bars (30 to 120 minutes, at most 12); with no sales Tally hides the chart where v2 draws an empty day, and Tally has no muted future bar. The date menu has no calendar | connector (status chip, store and register menu), shared:@tallyui/components (date calendar) | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | On by default: Open register with a float; a centred "This till" dialog with "1 sale this session", Paid in / Paid out / No sale tiles, Expected in the drawer (Cash $114.00), Close register; then "Count the drawer" in the cart pane with denominations, Back to selling, Close register; then a closure ("Closure #1", Counted, Expected, Exact) with "Print the Z report" | close | The close step is a centred dialog with no big drawer amount, no Session sales total, no Other tenders row and no Cancel or Print X-report | shared:@tallyui/components (close sheet) | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | Its own screen, "US Store · Front Counter" header, Today date menu and All cashiers chip: Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed; day band; session row with Print X-report; Export CSV | Its own room from the chevron at the end of the till strip: back arrow, "TallyUI WooCommerce dev store · Register A29A", "Today · Wed 11 Nov ▾" date menu, "All cashiers ▾" chip, Export CSV; Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed with "1 session"; Today band with "$114.00 counted · Exact"; a closure row (Expected, Counted, Difference, Result) with Reprint | close | The list is not on a bordered card. The header has no store and register menu, bell or avatar. All cashiers is a small square menu where the demo's is a rounded chip with an icon, and Export CSV is plain where the demo's is tinted with an icon. The date menu has no calendar | shared:@tallyui/components (calendar) | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

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
| D11 | Logs | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; verbose diagnostics toggle; Time / Level / Event / Duration / Status rows with a chevron; "Showing 46 of 46" and a "next check" line at the foot | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; "Verbose diagnostics: off"; Time / Level / Event / Duration / Status rows with a chevron; "Showing 1 of 1" | close | No "next check" line at the foot. Only the order outbox writes a row here; the demo also logs its sync runs ("Loaded the records this screen needs") | shared:@tallyui/database (TallyUI #683) | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail in a bordered panel: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status dot, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands; narrow search with a settings, bell and avatar cluster; "Showing 10 of 209" | Table from the rail on a bordered card: image, name, stock, stock status dot ("● In Stock"), categories, price, regular and sale price; a variable product shows "1 variation" under its name; chips Stock Status, On Sale, Category, Tag; full-width search; "13 products" under the card | close | No Featured or Brands chip, and stock is plain text with no Manage toggle (connector). The variations cell is plain text, not a "N variations ›" link with attribute links. The search runs the full width with no icon cluster; the count reads "13 products" where the demo reads "Showing N of M" | connector | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) |
| D13 | Coupons area | Table from the rail in a bordered panel: Active dot, Code, Amount, Type, Description, Usage, Expiry date, inline edit; chips Status, Discount Type, Expires; + to add; narrow search with an icon cluster | Table from the rail on a bordered card: Active dot ("● Active"), Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; full-width search; "10 coupons" under the card | close | No + to add a coupon and no inline edit (the connector has no coupon writes). No calendar behind Expires. The search runs the full width with no icon cluster | connector, shared:@tallyui/components (calendar) | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order 6a42826a · #369, cashier) with Print receipt, New sale and Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #369 (local id 6a42826a) on the
local dev store. It was a cash sale of $14.00 for two Croissant, one
Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as change.

Register sessions were also exercised, with sessions on by default and no
switch touched:

- A fresh till showed the Open register card. A session was opened at
  13:12 with a $100.00 float, took order #369, and was closed at 13:18
  with an exact count of $114.00 (Closure #1 · This till). The register
  was left closed.
- The session exists only in the capture browser's profile.

A phone cart was voided, and no order was left from it.

## Next for this repo

The gaps that can be built here, in the order a cashier would notice them.

1. **Variable product tiles** (A5). Print a variable product's price in
   the normal price colour, not green, unless it is on sale.
2. **Variations drill-in** (B11). Make "Open in place" drill in like the
   demo: the parent tile with a back chevron and "N options", then one
   tile per variation with its attribute chips and price, in place of the
   attribute button picker.
3. **Phone catalogue** (A12). Let the "All products" tile fit its name on
   two lines at four tiles to a row instead of cutting it to "All prod…".
4. **Phone cart tabs** (B12). Show the tab as the name and amount
   ("Guest $10.50") without "· 3 items", with the "N ^" count at left.
5. **Cart settings sheet** (B9). Start the sheet right of the rail, make
   Sort items a select with a chevron, and drop the bordered groups for
   the demo's plain labelled rows.
6. **Product settings** (A10). Tighten the sheet's spacing so the first
   two Tile Fields switches show above the fold, as in the demo.
7. **Reports controls** (C6). Restyle Everyone and vs yesterday as
   rounded chips with icons, keep the till strip on one row, and draw By
   hour across the whole day with a dashed baseline.
8. **Closures room** (C8). Put the closures list on the bordered card the
   areas use, make All cashiers a rounded chip with an icon, and tint
   Export CSV with its icon.
9. **Area chrome** (C1, C5, D12, D13). Narrow each area's search and add
   the settings, bell and avatar cluster at its right, and show "Showing
   N of M" with a sync icon under the card.
10. **Products variations cell** (D12). Make "N variations" a link with a
    chevron that opens the variations, with the attribute names under the
    product name.
