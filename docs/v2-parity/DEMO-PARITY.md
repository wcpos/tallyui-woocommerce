# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-11
- Tally Woo: `main` at `ce5a542503b8ba245fc9cfcb66e2d377e401fc16` (after #233, `@tallyui/*` 3.18.0), served as a production bundle
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 8
- Score: `PARITY tally-woo 10/45 (match 10, close 28, differs 0, missing 7)`
- Round 7: 10/45 (match 10, close 28, differs 0, missing 7)
- Round 6: 7/45 (match 7, close 31, differs 0, missing 7)
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
keep theirs, so Medusa POS and Vendure POS do not change. Round 8, like
round 7, captured A4, C6, C7 and C8 with that default: the register opened,
sold and closed with no switch touched.

Register name: a Tally till has one register. v2 adds the register to the
bar's place only when the store has more than one
(`register-bar.helpers.ts`), so the demo's "· Front Counter" comes from its
data, and a bar that reads the store alone is v2's single-register look.
Since #219 the till strip, the session card, the closures header and the
prints name the register ("Register 3E32" in this round's fresh profile).

Production bundle: round 8, like rounds 6 and 7, served Tally Woo from `pnpm
build` (`expo export --platform web` into `apps/pos/dist`) behind a static
server that applies `vercel.json`'s rewrite to `index.html`. `expo start
--web --no-dev --minify` served a production script but linked no
stylesheet, so the page was unstyled, and a bare `expo start` skips the
`web` script's SQLite worker build, so the database never opened.

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

Two TallyUI gaps are not filed yet:

- `CartTotal` always draws a bold Total row (B3, B12).
- `TooltipTrigger` opens on press and has no hover-open option. Since #233
  the app works round it on the settings icons only (A10, C1, C5, D12,
  D13), so their tooltips open on hover and are gone once the sheet opens.

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
  in a fresh browser profile after the first sync ("3 categories · 12
  products" in 17 s). The areas' settings panels were not opened on the
  demo, so the panels themselves are described, not compared.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail, one row of filter chips, category poster tiles; the register bar heads the cart column. On a new till the cart pane has an "Open register" card ("Cash in the drawer to start ($)", Open register) under a "Register closed" pill. Once the register is open: a "GU Guest" chip with + and a sliders icon; an empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot with nothing under it | close | A new till first asks for the opening float (the demo's register was already open, so its open step was not seen). With the register open, the empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only its empty message (merged in TallyUI as #723, awaiting release). No location pin beside the customer chip (A11) | shared:@tallyui/components (TallyUI #694, awaiting release) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health and a Settings gear at the foot; "v 0.1.0" | close | No Support entry (left out on purpose) | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a bell and a round "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a round "CA" initials avatar, as the cart column's first row; the catalogue column starts with its search row. A "Register closed" pill joins the bar while the register is closed. No second register row in the cart. On a phone, one bar sits over both tabs. The avatar's sheet is the door to the register panel | match | The store alone, with no register name, is v2's look for a store with one register, so it is not counted | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: name, "US Store · Front Counter · since 14:40", Your sales today, "In the drawer $2,996.12" with "Pay in · Pay out · Close register", Hand the till to, Store and Register with Switch, WordPress Admin, Desktop App, Sign out | Right sheet: name, store, "Your sales today $14.00", "In the drawer $114.00 · opened 19:54 by cashier" with "Pay in · Pay out · Close register ›", Hand the till to (Another account), WordPress Admin, Sign out | close | No store or register switch, no "since" time under the cashier's name, no Desktop App ("Registers") | connector | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to a blue "All products" tile with a back chevron, then full-bleed product photos with name, price and "12 options" | Coloured category poster tiles (All products, Bakery 2 products …); "All products" drills in to "Categories › All products" with the blue "All products" tile and its back chevron in slot 0, then full-bleed images, name, price and "1 option" under a variable product's price, and an in-cart count badge. A category drilled in (Merch) starts with its own tile in the same way, and the Category chip leaves the chip row while a level is open | match | | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" at the top of the column, with scan, list/grid and settings icons beside it | "Search products" at the top of the column, with list/grid and settings icons beside it | close | No scan button. The dev store has no "shirt", so the result grids cannot be compared | shared:@tallyui/pos (TallyUI #720) | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand; drilled into a category or a product, the Category chip leaves the row | Rounded chips in one row: In Stock (on by default, with ×), On Sale, Category, Tag; the chips are chosen in Product settings. Drilled into All products, a category or a product inside a level, the Category chip leaves the row (In Stock, On Sale, Tag stay); a product drilled from search results keeps a dimmed Category chip, as v2's `place.field` does | close | No Featured or Brand chip: the connector syncs neither ("Catalogue") | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 12 of 13") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level: coloured folder icon, name, product count, chevron | List rows at the category level: coloured folder icon, name, product count, chevron; drilling in gives a product table | match | | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet: View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields (Product Name, Price), Restore Default Settings with dark text in a red border, Close | The settings icon shows a "Product settings" tooltip on hover, gone once the sheet opens. Right sheet under a v2 header (title and ×): View Mode, Tile Size, Browse by (All products, Categories, Tags, Brands, Shortcuts), Show out-of-stock products, Sort By (a select with a chevron) and Direction, Variations, Tile Fields ("Product Name", Price), Restore Default Settings with dark text in a red border, Close | close | Tile Fields' second switch (Price) is cut at the fold where the demo shows both. The sheet's rows start lower (title at 28 px against 24, View Mode at 71 against 62, Tile Fields at 651 against 634; buildable here), and TallyUI's Switch is larger than v2's. The Sort By select has a dark border where the demo's is light grey, and Close is grey-filled with a dark border where the demo's is white (buildable here). The Variations Popover option is greyed out: Tally has no variations popover | shared:@tallyui/components (Switch `size="sm"`; TallyUI #719 popover) | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 12 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector (TallyUI #722) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), one scrolling chip row, Compact category tiles four to a row, "Shop base" and the count at the foot, bottom tab bar Products / Cart with a badge | Top bar (menu, store name, bell, avatar), one scrolling chip row, Compact category tiles four to a row with "All products" on two lines, the count with a sync icon at the foot, bottom tab bar Products / Cart with a "New" badge | close | No scan button (A6) and no "Shop base" at the foot (A11); the rest of the phone catalogue matches | shared:@tallyui/pos (TallyUI #720), connector (TallyUI #722) | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | Table with QTY / ITEM / PRICE / TOTAL headers; quantity in a box; regular price struck through above the sale price | Table with QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only three lines fit above the totals. The quantity is plain text, not a box ("Cart") | shared:@tallyui/components (TallyUI #677) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button with a ⋮ button beside it | One wide "Checkout $14.00" button with a ⋮ button beside it | match | | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33"), then Checkout | Subtotal, then a bold Total row, then Checkout | close | A bold Total row sits between the lines and Checkout, where the demo has none: TallyUI's `CartTotal` always draws it. The per-rate tax lines could not be seen because the dev store charges no tax | shared:@tallyui/components (not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart: the name over the amount, an age in the warning tone on carts hours old, the open tab underlined, + at right | Tabs along the foot of the cart: "Guest" over "$14.00", the open tab underlined, + at right | match | The age comes from the data: the demo's tabs are hours old, and Tally shows the same warning-tone age on a cart parked for an hour ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a "GU Guest" chip with a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a "GU Guest" chip; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with email | close | The dropdown's rows have no initials avatar: `CustomerSelect` has no row renderer. No location pin on the chip: that is A11's tax location ("Customers") | shared:@tallyui/components (TallyUI #714), connector (TallyUI #722) | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price keypad, quick discount keys −5%, −10%, −15%, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, keypad, Apply, Cancel | close | No struck regular price in the popover. A separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet beside the rail: Panel position, Open orders position, Sort items (select), Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Left side sheet beside the rail under a v2 header (title and ×), in plain labelled rows: Panel position, Open orders position, Sort items (a select with a chevron), Quick Discounts (−5% / −10% / −15%), auto show and auto print receipt toggles, Register sessions, Restore Default Settings, Close | close | No Columns section. The switches are larger than the demo's. An extra Register sessions row sits where the demo's Columns start ("Cart"). As in A10, the rows start lower (Panel position at 71 px against 62), the Sort items select has a dark border and Close is grey-filled (buildable here) | shared:@tallyui/components (TallyUI #695, Switch `size="sm"`) | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #689, awaiting release) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place: the parent tile (photo, name, price, "12 options", back chevron), then one tile per variation with its name, attribute chips ("32", "Blue") and price; the filter chips grey out; "12 options" at the foot | "T-Shirt" (6 options) drills in place: "Categories › All products › T-Shirt", the parent tile (image, name, price, "6 options", back chevron), then one tile per variation with its name, attribute chips ("S", "Black") and price; the Category chip leaves the row and On Sale and Tag dim, as in the demo, and hovering a dimmed one shows v2's tooltip ("A product filter; not used inside a product's variations."); "6 options" with a sync icon at the foot | match | A dev build still rejects the variable products when they sync (TallyUI #713, merged as #724, awaiting release) | | [demo](demo/variations-demo.jpg) · [tally](demo/variations-tally.jpg) |
| B12 | Phone cart (390x844) | Top bar; full-screen cart table, "Checkout $16.83"; one-line open-order tabs ("Guest $16.83") with a "3 ^" count, the open tab in view at the right; bottom tab bar | Top bar (menu, store, bell, avatar); full-screen cart table, Subtotal and a bold Total, ⋮ and "Checkout $4.00"; with three open orders, one-line tabs ("…50", "Guest $3.00", "Guest $4.00") behind a "3 ^" count cell, the strip scrolled so the open tab sits whole at the right with + after it, as in the demo; a blank cart scrolls the strip to its end; nothing under the tabs; bottom tab bar Products / Cart with a badge | close | Each line carries a row of −, +, Remove, Discount and Price controls, which take most of the height. The bold Total row (B3). Choosing another tab moves it to the end of the strip; the demo's tabs were not switched, so this is not compared | shared:@tallyui/components (TallyUI #677; `CartTotal`, not filed) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number, Customer, Billing address, Date created, POS icon, Cashier, Payment method, Total; "TODAY" group heading; narrow search with a settings, bell and avatar cluster; "Showing 20 of 29,754" with a sync icon | Table on a bordered card: Status dot, Order number, Customer chip, Date created, Payment method, Total, chevron; TODAY / YESTERDAY / dated group headings; narrow search with a sliders icon, bell and avatar at right; the sliders show an "Order Settings" tooltip on hover and open "Order Settings", a right sheet of column switches with Restore Default Settings (dark text, red border) and Close; "Showing 25" with a sync icon under the card | close | No Billing address, POS icon or Cashier column, and no "of N" total ("Order history") | connector (columns; X-WP-Total, TallyUI #680) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) · [tally settings](demo/orders-settings-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector (TallyUI #721) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "372" leaves one row, "Showing 1" | match | | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #372": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The tax breakdown was not seen (no tax) | connector | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; narrow search with add-customer, settings, bell and avatar; "Showing 10 of 5,146" | Table on a bordered card: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; narrow search with add-customer, sliders, bell and avatar; the sliders show a "Customer Settings" tooltip on hover and open "Customer Settings" with column switches (Image, ID, First Name, Last Name, Email, Billing Address); "Showing 5" with a sync icon under the card | close | The avatars are pale grey where the demo's are solid primary. No Date created column, and none offered in the settings: the connector's `Customer` has no created or modified dates. No "of N" total ("Customers": Customers screen) | connector (Customer dates, not filed; X-WP-Total, TallyUI #680), shared:@tallyui/components (TallyUI #718) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu with bell and avatar; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report with a printer icon); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; By hour / Running total chart with a dashed comparison and a muted future bar; Orders, Payments, Where sold cards | One bar over the page: "TallyUI WooCommerce dev store · Register 3E32" with a bell and avatar, the room one gutter below. One-row till strip ("Register 3E32 ● Open since 19:54 · cashier", Opening float + Cash sales = Expected in drawer, Print X-report with a printer icon, a chevron to Closures); "Today · Wed 11 Nov" with a chevron, a rounded "Everyone" chip with an icon, Print summary; big total with Orders, Average order, Items; a rounded "vs yesterday" chip beside By hour / Running total; By hour in v2's steps ("$14.00 · 1 order" over the 19:30 bar); Orders, Payments, Where sold cards | close | The scope title has no menu chevron: there is no store and register menu. No "Completed & processing" chip (left out: every local sale is complete). The date menu has no calendar. The dashed comparison and the muted future bar draw only when the day before has sales on this device, so this capture shows neither | connector (status chip, store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | On by default: Open register with a float; from the avatar's sheet ("Pay in · Pay out · Close register ›"), a centred "Register" dialog with "1 sale this session", Paid in / Paid out / No sale tiles, Expected in the drawer (Cash $114.00), Close register; then "Count the drawer" in the cart pane with denominations, Back to selling, Close register; then a closure ("Closure #1", Counted, Expected, Exact) with "Print the Z report" | close | The close step is a centred dialog with no big drawer amount, no Session sales total, no Other tenders row and no Cancel or Print X-report | shared:@tallyui/components (TallyUI #716) | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | Its own screen, "US Store · Front Counter ▾" header with bell and avatar, Today date menu and All cashiers chip: Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; day band; session row with Print X-report; tinted Export CSV with an icon | Its own room from the chevron at the end of the till strip, under the same bar as Reports: back arrow, "TallyUI WooCommerce dev store · Register 3E32", bell and avatar; "Today · Wed 11 Nov" with a chevron, a rounded "All cashiers" chip with an icon, an outlined Export CSV with a document icon; Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card with "1 session"; Today band with "$114.00 counted · Exact"; a closure row ("Closure 1 · Register 3E32", 19:54 → 20:00, Expected, Counted, Difference, Result) with Reprint | close | The scope title has no menu chevron. The date menu has no calendar. Export CSV is not counted: v2's `ClosuresExportButton` is outline with a document icon, as Tally's is, and the demo capture shows it in another state | connector (store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

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
| D12 | Products area | Table from the rail in a bordered panel: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status dot, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands; narrow search with a settings, bell and avatar cluster; "Showing 10 of 209" | Table from the rail on a bordered card: image, name, stock, stock status dot ("● In Stock"), categories, price, regular and sale price; a variable product shows its attribute links ("Size: S, M, L", "Colour: Black, White") and "6 variations ›" under its name, both drilling to "Products › T-Shirt" with one row per variation (an attribute link also adds a "Size: S ×" filter); chips Stock Status, On Sale, Category, Tag; narrow search with a sliders icon, bell and avatar; the sliders show a "Product Settings" tooltip on hover and open "Product Settings" with column switches; "Showing 13 of 13" with a sync icon under the card | close | The product name is plain text, not v2's inline field, and stock is plain text with no Manage toggle (no product writes in the connector). No Featured or Brands chip | connector | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) · [tally drilled](demo/products-drill-tally.jpg) |
| D13 | Coupons area | Table from the rail in a bordered panel: Active dot, Code, Amount, Type, Description, Usage, Expiry date, inline edit; chips Status, Discount Type, Expires; + to add; narrow search with an icon cluster | Table from the rail on a bordered card: Active dot ("● Active"), Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; narrow search with a sliders icon, bell and avatar; the sliders show a "Coupon Settings" tooltip on hover and open the coupons' column settings; "Showing 10 of 10" with a sync icon under the card | close | No + to add a coupon and no inline edit (the connector has no coupon writes). No calendar behind Expires | connector, shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order c8dcb556 · #372, cashier, "Register: Register 3E32") with Print receipt, New sale and Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #372 (local id c8dcb556) on the
local dev store. It was a cash sale of $14.00 for two Croissant, one
Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as change.

Register sessions were also exercised, with sessions on by default and no
switch touched:

- A fresh till showed the Open register card. A session was opened at
  19:54 with a $100.00 float, took order #372, and was closed at 20:00
  with an exact count of $114.00 (Closure 1 · Register 3E32).
- A second session was then opened with a $100.00 float for the phone
  capture and left open.
- The sessions exist only in the capture browser's profile.

Three open orders were left on the phone till for B12, as unpaid carts in
the capture browser's profile; none was sent to the store: Croissant
$3.50 (0e70dfc2-ef51-4330-8855-ac4541bb8a5a), Cold Brew $4.00
(e4df5ce7-b27a-4277-a6ec-96ee88f70c74) and Espresso $3.00
(ca0d1393-c6c2-457e-9d4e-5aabec4c0a07), with a blank cart open. A cart
takes a new local id when another tab is chosen, which is also when it
moves to the end of the strip.

## Next for this repo

The gaps that can be built here, in the order a cashier would notice them.

1. **Settings sheet spacing** (A10, B9). Set the side sheets' header and
   row spacing to v2's (title at 24 px, first label at 62 px), so Product
   settings shows both Tile Fields switches above the fold as the demo
   does.
2. **Select border in the settings sheets** (A10, B9). Give the Sort By
   and Sort items selects v2's light grey border (`SELECT_FACE` takes the
   border tone) instead of the dark one.
3. **Close in the settings sheets** (A10, B9). Draw Close as v2's white
   outline button with a light border instead of the grey-filled face.
