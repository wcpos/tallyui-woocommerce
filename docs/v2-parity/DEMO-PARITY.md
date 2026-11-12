# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-12
- Tally Woo: `main` at `3b38fae64d0610b3514f921288c7f3e383f96282` (after #248, `@tallyui/*` 3.18.0), served as a production bundle
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 11 (full). Every row's Tally image was recaptured and every row
  re-scored with round 10's strictness: control heights, insets, colours
  and type sizes that a cashier would see all count
- Score: `PARITY tally-woo 4/45 (match 4, close 34, differs 0, missing 7)`
- Round 10: 3/45 (match 3, close 35, differs 0, missing 7)
- Round 9: 10/45 (match 10, close 28, differs 0, missing 7)
- Round 8: 10/45 (match 10, close 28, differs 0, missing 7)
- Round 7: 10/45 (match 10, close 28, differs 0, missing 7)
- Round 6: 7/45 (match 7, close 31, differs 0, missing 7)
- Round 5: 7/45 (match 7, close 30, differs 1, missing 7)
- Round 4: 7/45 (match 7, close 30, differs 0, missing 8)
- Round 3: 6/45 (match 6, close 31, differs 0, missing 8)
- Round 2: 6/45 (match 6, close 28, differs 3, missing 8)
- Round 1: 0/45 (match 0, close 11, differs 23, missing 11)

Round 11 follows #239 to #248, which together cover round 10's whole
"Next for this repo" list: the palette and sale colour, the insets and
44 px controls, the tile band, the cashier sheet, Cart Settings' backdrop
and text, the Browse by mark, the flat Settings form, the orders list's
chip and numbers, the table view's card, the Theme page and the tax-rates
dialog. One row moves to match (A9). Most rows lost one or more
differences but stay close, because each still has a smaller difference
left that can be built here, or one that waits on TallyUI or the
connector.

Register sessions: a front desk ruling of 2026-11-11 supersedes the
2026-10-06 ruling that made sessions opt-in. Paul's target is "look and
function like demo.wcpos.com/pos", so Tally Woo now turns sessions on for a
till with no saved choice. A till that saved a choice keeps it. The switch
is also in Settings › General, where it can be reached while the register
is closed. The default is set in this app only; the shared TallyUI packages
keep theirs, so Medusa POS and Vendure POS do not change. Round 11, like
rounds 7 to 10, captured A4, C6, C7 and C8 with that default: the register
opened, sold and closed with no switch touched.

Register name: a Tally till has one register. v2 adds the register to the
bar's place only when the store has more than one
(`register-bar.helpers.ts`), so the demo's "· Front Counter" comes from its
data, and a bar that reads the store alone is v2's single-register look.
Since #219 the till strip, the session card, the closures header and the
prints name the register ("Register 1281" in this round's fresh profile).

Production bundle: round 11, like rounds 6 to 10, served Tally Woo from `pnpm
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

These TallyUI gaps are not filed yet:

- `CartTotal` always draws a bold Total row (B3, B12).
- `CartFoot` draws the ⋮ and Checkout buttons at a fixed `min-h-12`
  (48 px) and takes no size for them; its `className` reaches only the
  outer row. v2's ⋮ is 44 px and its Checkout 56 (B2, B12). New this
  round.
- `TooltipTrigger` opens on press and has no hover-open option. Since #233
  the app works round it on the settings icons only (A10, C1, C5, D12,
  D13), so their tooltips open on hover and are gone once the sheet opens.
- `Switch` has no `size="sm"`: it is 44x24 px against v2's 36x20 (A10,
  B9, C1, D2, D3).
- The light theme's `--color-input` is a dark grey (#848a94). Besides any
  `border-input` control, it is the off `Switch` track, which draws about
  rgb(132,136,145) where the demo's off track is a light grey
  rgb(216,217,221), and Product settings' Tile Size slider track (A10, B9,
  D2, D3).
- `DialogOverlay` and `AlertDialogOverlay` are `bg-black/80`. The demo's
  sheet backdrop darkens the page by about a quarter (page 244 → 182);
  Tally's takes it to about 50, nearly black (A10, C1, C4, C7).
  `DialogContent` renders its overlay with no className, so the app can
  lighten only the overlays it composes itself; Cart Settings has v2's
  light shade since #243.
- `SearchInput` is 40 px tall (`py-2.5`) against v2's 44 px `h-ctl`. Since
  #240 the catalogue's search box passes 44 px, as do its view and
  settings buttons, the filter chips and the cart's + and sliders; the
  areas' list search boxes are still 40 px (measured on Orders: C1, C3,
  C5).
- `DialogTitle` drops `leading-none` when a size is passed. #237 sets
  `text-lg leading-none` on the sheets' titles, which measure as v2's do,
  so nothing shows this round.
- `@tallyui/connector-woocommerce`'s `StoreSettings.taxClassSlugs` carries
  the tax classes' slugs only, so the tax-rates dialog names the standard
  class "Standard" where v2 reads "Standard rate" (D3). New this round.

Gone since round 10: the `Button` 40 px default no longer shows on the
sale screen (#240 passes 44 px), and `--color-sale` is v2's destructive
in light and dark since #239 (`global.css`).

Round 11 ran five checks for the brief, on both sides:

1. **Palette** (A1, A2, A5, B2, C6), Tally's computed colours against
   pixels read off the demo's images:

   | Surface | Tally | Demo |
   |---|---|---|
   | Primary (All products tile, Checkout, open tab, avatar, report bars) | rgb(0,49,204) | rgb(0,49,204) |
   | Page | rgb(243,245,249) | rgb(244,245,249) |
   | Cart pane | white | white |
   | Rail | rgb(236,239,243) | rgb(227,233,245) |

   The primary, page and cart pane match. The rail is a lighter, greyer
   tint than the demo's blue-grey (`app-rail.tsx` draws `bg-muted`).
2. **Insets and controls** at 1280x800 (Tally's DOM; the demo read off its
   images):

   | Measure | Tally | Demo |
   |---|---|---|
   | Catalogue gutter from the rail | 12 | 12 |
   | Search box top | 8 | 12 |
   | Filter chip row | y60–103 | y68–111 |
   | Breadcrumb | y125 | y146 |
   | Cart pane inset | 8 | 8 |
   | Cart totals and foot, from the pane's left edge | about 20 (Subtotal x829, ⋮ x817) | about 8 (Subtotal x807, ⋮ x806) |
   | Area pages (Orders, Reports) from the rail | 16 | 12 |
   | Catalogue search box | 44 | 44 |
   | View and settings icon buttons | 44, glyphs about 20 px, dark | 44, glyphs about 16 px, muted grey |
   | Filter chips | 44 | about 44 |
   | Cart + and sliders buttons | 44 | 44 |
   | Customer chip | 94x44, no pin | 44, with a location pin segment |
   | Checkout | 48 | 56 |
   | ⋮ beside Checkout | 48 | 44 |
   | Open-order tabs | 51 | 51 |
   | Orders list search | 40 | 44 |
   | Phone (390): search and tiles from the edge | 12 and 8 | 14 and 14 |
   | Phone (390): ⋮ and Checkout from the edge | x20 and x80 | x7 and x54 |

   The TallyUI waits stand: Checkout and ⋮ are TallyUI's `CartFoot`, and
   the list search is TallyUI's `SearchInput` (see the list above).
3. **Tile band** (A5, B11). Tally's product tile measures 171x219.4 with a
   169 px picture, leaving a 48.4 px band; the demo's tile is 170 wide and
   218–219 tall with a band of about 48–49. **Match.**
4. **Settings** (D2, D3, D5). General and Tax are v2's flat two-column
   form with muted labels. Tax has "View all tax rates"; it opens an
   800 px right sheet, "Tax rates", with a tab per class drawn as a muted
   segmented box (the name over the count: "Standard / 0", "Reduced rate /
   0", "Zero rate / 0"), "No rates in this class", and "0 tax rates" with
   Close at the foot. The demo's dialog (captured this round) is "Tax
   Rates" with a × in its header, underline tabs with the count inline
   ("Standard rate 4", "Reduced rate 2", "Zero rate 1", the open tab
   underlined in primary), a seven-column table (Country code, State code,
   Postcode, City, Rate %, Tax name with Compound, Priority) and "7 tax
   rates" with a sync icon beside Close. Theme has an icon on every card,
   no inner box, and "Current Theme: Ocean" when Ocean is chosen
   ("Following system theme" under System).
5. **Ocean.** Choosing Ocean on the Theme page recolours the whole app:
   the root class goes from `light` to `ocean`, primary from a deep blue
   to teal (lab(28.7 38.7 -84.5) → lab(69.1 -49.1 -14.6)), and the
   background, muted and card tokens to dark (lab 6.3, 17.8 and 10.8). On
   the sale screen the All products tile, the chips and Checkout turn teal
   on dark ([tally Ocean](demo/theme-ocean-tally.jpg)). Choosing System
   again put the class back to `light`, the primary back to deep blue and
   the status line back to "Following system theme", with System
   selected.

Both sides are captured as they first appear.

- The demo is a populated store (209 products, 29,754 orders, 5,146
  customers).
- Tally Woo runs against the local dev store: 13 products (10 simple, one
  of them out of stock, and 3 variable: T-Shirt with 6 variations, Hoodie
  with 3, Cap with 1), no tax charged and no tax rates. The production
  bundle syncs the variable products ("6 options", "3 options", "1
  option"); a dev build rejects them until the connector's meta_data fix
  (TallyUI #713, merged as #724) is released. Differences that come only
  from the data are not counted.
- The demo images are round 1's, except D3's tax-rates dialog, captured
  this round look-only: every request that was not GET, HEAD or OPTIONS
  was aborted (four POSTs: the CDN beacon, the notifications inbox and two
  updates-server syncs), the POS showed without them, and nothing was
  typed or saved. All 41 Tally images were recaptured in a fresh browser
  profile after the first sync ("3 categories · 12 products"), plus two
  new ones (the tax-rates dialog and Ocean), then measured in the DOM. The
  demo side was measured off its images with a pixel scan. The areas'
  settings panels were not opened on the demo, so the panels themselves
  are held to the demo's Product settings chrome.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail, one row of filter chips, category poster tiles; the register bar heads the cart column. On a new till the white cart pane has an "Open register" card under a "Register closed" pill. Once the register is open: a "GU Guest" chip with + and a sliders icon; an empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot | close | A new till first asks for the opening float (the demo's register was already open, so its open step was not seen). The empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only a cart icon and its message (merged in TallyUI as #723, awaiting release). The rail is greyer than the demo's (A2), and the totals and foot sit 20 px in against 8 (B1) (both buildable here). No location pin beside the customer chip (A11). The primary, the page and the white cart pane now match | shared:@tallyui/components (TallyUI #694, awaiting release) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health and a Settings gear at the foot; "v 0.1.0" | close | The rail is rgb(236,239,243) against the demo's rgb(227,233,245): lighter and less blue (buildable here). No Support entry (left out on purpose) | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a small bell and a 20 px "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a 20 px "CA" initials avatar, as the cart column's first row. A "Register closed" pill joins the bar while the register is closed. On a phone, one bar sits over both tabs. The avatar's sheet is the door to the register panel | close | The avatar sits on a 40x40 pale blue button (rgb(234,244,255)) where the demo's sits on the bar's white, and the bell draws a shade darker (buildable here). The avatar is now 20 px, as the demo's. The store alone, with no register name, is v2's look for a store with one register, so it is not counted | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: avatar and × in the header, name, "US Store · Front Counter · since 14:40 · 1 m", Your sales today, a drawer card with an icon ("In the drawer $2,996.12", "Pay in · Pay out · Close register"), an uppercase "HAND THE TILL TO" heading with "+ Another account…" as a plain row, Store and Register with Switch, WordPress Admin and Desktop App links with icons; Sign out (outline, red border) and Close in the footer | Right sheet: avatar and × in the header, "cashier" and the store, "Your sales today", a drawer card ("In the drawer", the opening time and cashier) with "Pay in · Pay out · Close register", an uppercase "HAND THE TILL TO" heading with "+ Another account…" as a row, WordPress Admin with an icon; Sign out (outline, red border) and Close in the footer | close | The sheet and the drawer card are the page grey (rgb(243,245,249)) where the demo's are white; the drawer card has no icon and no avatar by the cashier; "Pay in · Pay out · Close register" is primary blue where the demo's is the foreground colour (buildable here, `cashier-sheet.tsx`). No store or register switch, no "since" time, no Desktop App ("Registers"). The header, the heading, the row and the footer now match | connector | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to a blue "All products" tile with a back chevron, then full-bleed product photos with name, price and "12 options"; tiles 170 px wide with a 48 px band | Coloured category poster tiles (All products, Bakery 2 products …); "All products" drills in to "Categories › All products" with the "All products" tile and its back chevron in slot 0, then full-bleed images, name, price and "1 option" under a variable product's price, and an in-cart count badge; tiles 171 px wide with a 48.4 px band | close | The search box starts 8 px from the top against 12, the chip row 8 px higher (y60 against 68) and the breadcrumb 21 px higher (y125 against 146), so the grid starts higher than the demo's (buildable here). The "All products" tile's grid icon is about 22 px against 16 (buildable here). The band, the tile width, the 12 px gutter and the blue now match | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" 44 px tall, 12 px from the rail and the top, with scan, list/grid and settings icons beside it | "Search products" 44 px tall, 12 px from the rail and 8 from the top, with 44 px list/grid and settings icons beside it | close | No scan button (TallyUI #720). The list/grid and settings glyphs are about 20 px and dark against the demo's 16 px muted grey, and the box sits 8 px from the top against 12 (buildable here). The box and button heights and the rail inset now match. The dev store has no "shirt", so the result grids cannot be compared | shared:@tallyui/pos (TallyUI #720) | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips about 44 px tall, always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand; drilled in, the Category chip leaves the row | Rounded 44 px chips in one row: In Stock (on by default, with ×), On Sale, Category, Tag; the chips are chosen in Product settings. Drilled in, the Category chip leaves the row | close | No Featured or Brand chip: the connector syncs neither ("Catalogue"). The row sits 8 px higher than the demo's (A5). The chip height now matches | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 12 of 13") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level inside a white bordered card: coloured folder icon, name, product count, chevron; rows about 59 px | List rows at the category level inside a white bordered card: coloured folder icon, name, product count, chevron; rows 59 px; drilling in gives a product table | match | | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet over a light backdrop: View Mode, Tile Size, Browse by (the chosen row tinted, with a primary bar at its left), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields (Product Name, Price), Restore Default Settings with dark text in a red border, Close | Right sheet under v2's header (a 16 px title and ×): View Mode, Tile Size, Browse by (the chosen row tinted, with a primary bar), Show out-of-stock products, Sort By and Direction, Variations, Tile Fields (Product Name, Price), Restore Default Settings in a red border, Close; 44 px footer buttons | close | The backdrop is near black (`bg-black/80`) against the demo's light shade (TallyUI). The switches are 44x24 against 36x20, and an off switch's track and the Tile Size slider's track are dark grey against light grey (TallyUI). The Variations Popover option is greyed out: Tally has no variations popover (TallyUI #719). The Browse by mark and the blue now match | shared:@tallyui/components (DialogOverlay, Switch `size="sm"`, `--color-input`, not filed; TallyUI #719 popover) | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 12 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector (TallyUI #722) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), search 14 px from the edge, one scrolling chip row, Compact category tiles four to a row, "Shop base" and the count at the foot, bottom tab bar Products / Cart with a badge | Top bar (menu, store name, bell, avatar), one scrolling chip row, Compact category tiles four to a row with "All products" on two lines, the count with a sync icon at the foot, bottom tab bar Products / Cart with a "New" badge | close | The tiles sit 8 px from the edge and the search 12, against 14 for both; the bar's icons are larger and darker and the avatar sits on A3's pale blue button (buildable here). No scan button (A6) and no "Shop base" at the foot (A11) | shared:@tallyui/pos (TallyUI #720), connector (TallyUI #722) | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | White full-bleed pane: QTY / ITEM / PRICE / TOTAL headers; quantity in a bordered box; regular price struck through above the sale price | White pane inset 8 px: QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only three lines fit above the totals. The quantity is plain text, not a box ("Cart") (TallyUI #677). The totals and the foot sit about 20 px in from the pane's edge against the demo's 8 (Subtotal at x829 against 807) (buildable here). The white pane and its inset now match | shared:@tallyui/components (TallyUI #677) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button, 56 px tall, with a 44 px ⋮ button beside it | One wide "Checkout $14.00" button, 48 px tall, with a 48 px ⋮ button beside it | close | Checkout is 48 px tall against 56 and the ⋮ 48 against 44: TallyUI's `CartFoot` fixes both at `min-h-12` (not filed). The blue now matches | shared:@tallyui/components (`CartFoot` heights, not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33"), then Checkout | Subtotal, then a bold Total row, then Checkout | close | A bold Total row sits between the lines and Checkout, where the demo has none: TallyUI's `CartTotal` always draws it. The per-rate tax lines could not be seen because the dev store charges no tax | shared:@tallyui/components (not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart: the name over the amount, an age in the warning tone on carts hours old, the open tab underlined, + at right | Tabs along the foot of the cart: "Guest" over "$14.00", the open tab underlined in the deep blue, + at right; tabs 51 px tall as the demo's | match | The age comes from the data: the demo's tabs are hours old, and Tally shows the same warning-tone age on a cart parked for an hour ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a 44 px "GU Guest" chip with a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a 44 px "GU Guest" chip; the chip opens a dropdown over the cart with Guest, "Search Customers" and customers with email | close | The dropdown's rows have no initials avatar: `CustomerSelect` has no row renderer (TallyUI #714). No location pin on the chip: that is A11's tax location ("Customers"). The chip height now matches | shared:@tallyui/components (TallyUI #714), connector (TallyUI #722) | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries. The + glyph is larger and darker than the demo's 16 px grey; the button is now 44 px | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price, quick discount keys −5%, −10%, −15% in primary text on one band, borderless keypad, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, a keypad of bordered keys, Apply, Cancel | close | No struck regular price in the popover. The keys are bordered boxes where the demo's keypad is flat, and Apply / Cancel stand where the demo has one check. A separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet beside the rail over a light backdrop: Panel position, Open orders position, Sort items (select), Quick Discounts (−5% / −10% / −15% at 13 px semibold), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Left side sheet beside the rail over a light backdrop, under v2's header: Panel position, Open orders position, Sort items (select) with "Fees and shipping always stay last", Quick Discounts (−5% / −10% / −15% at 13 px semibold) with a hint, auto show and auto print receipt switches, Register sessions as a switch row with a two-line help, Restore Default Settings in a red border, Close; 44 px footer | close | No Columns section ("Cart") (TallyUI #695). The switches are 44x24 against 36x20, and an off track is dark grey (TallyUI). The backdrop, the quick discount keys and the hints now match | shared:@tallyui/components (TallyUI #695, Switch `size="sm"`, `--color-input`) | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #689, awaiting release) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place: the parent tile (photo, name, price, "12 options", back chevron), then one tile per variation with its name, attribute chips ("32", "Blue") and price; the filter chips grey out; "12 options" at the foot | "T-Shirt" (6 options) drills in place: "Categories › All products › T-Shirt", the parent tile (image, name, price, "6 options", back chevron), then one tile per variation with its name, attribute chips ("S", "Black") and price; the Category chip leaves the row and On Sale and Tag dim, with v2's tooltip on hover; "6 options" with a sync icon at the foot | close | The chip row and breadcrumb sit 8 and 21 px higher than the demo's, so the tiles start higher (A5's top inset, buildable here). A dev build still rejects the variable products when they sync (TallyUI #713, merged as #724, awaiting release). The band (48.4) and the tile width (171 against 170) now match | | [demo](demo/variations-demo.jpg) · [tally](demo/variations-tally.jpg) |
| B12 | Phone cart (390x844) | Top bar; full-screen cart table, "Checkout $16.83"; one-line open-order tabs ("Guest $16.83") with a "3 ^" count, the open tab in view at the right; bottom tab bar | Top bar (menu, store, bell, avatar); full-screen cart table, Subtotal and a bold Total, ⋮ and "Checkout $4.00"; with three open orders, one-line tabs behind a "3 ^" count cell, the open tab whole at the right with + after it; bottom tab bar Products / Cart with a badge | close | Each line carries a row of −, +, Remove, Discount and Price controls, which take most of the height (TallyUI #677). The bold Total row (B3). The ⋮ starts 20 px from the edge against 7 and Checkout at x80 against 54 (B1's foot inset, buildable here) | shared:@tallyui/components (TallyUI #677; `CartTotal`, not filed) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number (centred, 32 px customer chip), Customer, Billing address, Date created with a sort chevron, POS icon, Cashier, Payment method, Total; "TODAY" group heading; narrow 44 px search with a settings, bell and avatar cluster; "Showing 20 of 29,754" with a sync icon | Table on a bordered card: Status dot, Order number (centred, 32 px customer chip), Customer, Date created with a sort chevron, Payment method, Total, chevron; TODAY / YESTERDAY group headings; 40 px search with a sliders icon, bell and avatar; the sliders open "Order Settings", a right sheet with a Columns heading, six column switches, Restore Default Settings (red border) and Close on a 44 px footer; "Showing 25" with a sync icon | close | No Billing address, POS icon or Cashier column, and no "of N" total ("Order history") (connector). The rows are 64 px against 57, with the status and number text at the top of the row while the chip is centred, and the page is inset 16 px from the rail against 12 (buildable here). The search is 40 px against 44 (TallyUI). The Order Settings sheet's backdrop is near black and its switches larger (TallyUI). The chip, the centred number and the chevron now match | connector (columns; X-WP-Total, TallyUI #680), shared:@tallyui/components (Switch `size="sm"`, DialogOverlay, SearchInput height) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) · [tally settings](demo/orders-settings-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector (TallyUI #721) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "375" leaves one row, "Showing 1" | match | The box's 40 px height is counted in C1 | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #375": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The backdrop is near black (TallyUI). The tax breakdown was not seen (no tax) | connector, shared:@tallyui/components (DialogOverlay, not filed) | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; narrow search with add-customer, settings, bell and avatar; "Showing 10 of 5,146" | Table on a bordered card: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; narrow search with add-customer, sliders, bell and avatar; the sliders open "Customer Settings" with column switches; "Showing 5" with a sync icon under the card | close | The avatars are pale grey where the demo's are solid primary (TallyUI #718). No Date created column: the connector's `Customer` has no created or modified dates. No "of N" total ("Customers": Customers screen). The page is inset 16 px from the rail against 12, as on Orders (buildable here) | connector (Customer dates, not filed; X-WP-Total, TallyUI #680), shared:@tallyui/components (TallyUI #718) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu with bell and avatar; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report with a printer icon); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; By hour / Running total chart with a dashed comparison and a muted future bar; Orders, Payments, Where sold cards | One bar over the page: "TallyUI WooCommerce dev store · Register 1281" with a bell and avatar. One-row till strip ("Register 1281 ● Open since 06:42 · cashier", Opening float $100.00 + Cash sales $14.00 = Expected in drawer $114.00, Print X-report, a chevron to Closures); "Today · Thu 12 Nov" with a chevron, "Everyone" chip, Print summary; big total $14.00 with Orders, Average order, Items; "vs yesterday" beside By hour / Running total; Orders, Payments, Where sold cards | close | The scope title has no menu chevron: there is no store and register menu. No "Completed & processing" chip (left out: every local sale is complete). The date menu has no calendar. The page is inset 16 px from the rail against 12 (buildable here). The dashed comparison and the muted future bar draw only when the day before has sales on this device. The bars, the Expected tile and the donuts are now the demo's blue | connector (status chip, store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | On by default: Open register with a float; from the avatar's sheet, a centred "Register" dialog with "1 sale this session", Paid in / Paid out / No sale tiles, Expected in the drawer (Cash $114.00), Close register; then "Count the drawer" in the cart pane with denominations, Back to selling, Close register; then a closure ("Closure #1", Counted, Expected, Exact) with "Print the Z report" | close | The close step is a centred dialog with no big drawer amount, no Session sales total, no Other tenders row and no Cancel or Print X-report | shared:@tallyui/components (TallyUI #716) | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | Its own screen, "US Store · Front Counter ▾" header with bell and avatar, Today date menu and All cashiers chip: Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; day band; session row with Print X-report; tinted Export CSV with an icon | Its own room from the chevron at the end of the till strip: back arrow, "TallyUI WooCommerce dev store · Register 1281", bell and avatar; "Today · Thu 12 Nov", "All cashiers" chip, an outlined Export CSV with a document icon; Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; Today band "$114.00 counted · Exact"; "Closure 1 · Register 1281", 06:42 → 06:47, cashier, with Reprint | close | The scope title has no menu chevron. The date menu has no calendar. Export CSV is not counted: v2's `ClosuresExportButton` is outline with a document icon, as Tally's is | connector (store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Sub-nav beside the rail: General, Tax, Barcode Scanning, Theme; each page in a bordered panel | close | Printing, Card readers and Customer Display are absent (D6–D8) ("Settings area") | connector, pro | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | A two-column form with muted labels: editable Store Name; base country, state, city and postcode with "Set in WooCommerce · Open ↗"; Language select; Default Customer select; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals as fields | A flat two-column form with muted labels: Store Name, base country, state, city, postcode and Language read-only with "Set in WooCommerce · Open"; Default Customer as a customer chip; Default Customer is cashier switch; currency rows read-only; Register sessions switch | close | Store Name, Language and the currency rows are read-only text with an Open link where the demo has fields and selects (connector). Default Customer is a chip, not a select ("Settings area"). Language reads "en-US" against "English (US)", the Open links have no ↗ icon, and "cashier" is lower case against "Cashier" (buildable here). The switches are larger, with a dark grey off track (TallyUI). The flat form and muted labels now match | connector | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | A two-column form with muted labels: Calculation (Calculate tax based on as a select, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open ↗"); Display (Display Tax Totals, Display Prices in the Shop, Display Prices During Cart and Checkout as two-way segments, Price Display Suffix); Tax Rates with "View all tax rates", which opens "Tax Rates" (× in the header, underline class tabs with the count inline, a seven-column rates table, "7 tax rates" with a sync icon, Close) | A flat two-column form with muted labels: Calculation (Calculate tax based on, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open"); Tax Rates ("No tax rates apply at the store's address.") with "View all tax rates", which opens an 800 px right sheet "Tax rates": class tabs as a muted segmented box with the count under the name, "No rates in this class", "0 tax rates" and Close | close | No Display section (the tax display settings are not synced). In the rates sheet the class tabs are a segmented box with the count under the name where the demo's are underline tabs with the count inline, the title is "Tax rates" against "Tax Rates", and there is no × in the header and no sync icon by the count (buildable here). The standard class reads "Standard" against "Standard rate": the connector has the class slugs only (not filed). The switches are larger, with a dark grey off track (TallyUI). Enable Taxes is off and there are no rates, from the data. The flat form and the button now match | connector (tax display settings; tax class names, not filed) | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) · [demo rates](demo/tax-rates-demo.jpg) · [tally rates](demo/tax-rates-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Sound ("Play a sound on scan"); Barcode Scanning Test | close | No Scanner section ("Scanning") | shared:@tallyui/pos (TallyUI #682) | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | "Current Theme: Light"; ten theme cards each with an icon: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall; a Scale section (Auto / Compact / Regular / Spacious); an Icons section (Match theme, Tabler 1.5, Hugeicons, Phosphor …) | "Following system theme" under System, "Current Theme: Ocean" under Ocean; the same ten theme cards, each with an icon, in a flat grid. Choosing Ocean recolours the whole app, and System puts it back | close | No Scale or Icons section (TallyUI, not filed). The cards start about 30 px under the status line against 44 (buildable here). The icons, the "Current Theme:" line and the flat grid now match | shared:@tallyui/theme (scale and icon sets, not filed) | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) · [tally Ocean](demo/theme-ocean-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | connector (TallyUI #681) | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | shared:@tallyui/pos (TallyUI #679) | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | connector, pro (TallyUI #684). ADR-085: U7, the fork routes, is TallyUI/woocommerce-pos#1, waiting for the desk; U8, the app wiring, comes after the TallyUI batch release; the Woo connector's `displaySignalling` belongs to the tallyui worker | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; table Collection / On device / On server / Coverage bar / Size with ⋮ per row | Sub-nav Database / Logs; "✓ Ready to sell", records on this device, storage used, changes waiting to send; table Collection / On device; "Check for changes now" | close | No Performance entry in the sub-nav (D10). No On server, Coverage or Size columns. The dev store had no stuck records, so the attention banner was not seen ("Store health") | connector | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | shared:@tallyui/database (TallyUI #683) | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; verbose diagnostics toggle; Time / Level / Event / Duration / Status rows with a chevron; "Showing 46 of 46" and a "next check" line at the foot | Under Store health: the same four figures; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; "Verbose diagnostics: off"; Time / Level / Event / Duration / Status rows with a chevron ("Order accepted by the store", "Register session opened") | close | No "next check" line at the foot. Sync runs write no row; the demo logs them ("Loaded the records this screen needs") | shared:@tallyui/database (TallyUI #683) | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail in a bordered panel: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status dot, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands; narrow search with a settings, bell and avatar cluster; "Showing 10 of 209" | Table from the rail on a bordered card: image, name, stock, stock status dot, categories, price, regular and sale price; a variable product shows its attribute links and "1 variation" / "6 variations ›" under its name, drilling to "Products › T-Shirt" with one row per variation; chips Stock Status, On Sale, Category, Tag; narrow search with a sliders icon, bell and avatar; the sliders open "Product Settings" with column switches; "Showing 13 of 13" with a sync icon under the card | close | The product name is plain text, not v2's inline field, and stock is plain text with no Manage toggle (no product writes in the connector). No Featured or Brands chip | connector | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) · [tally drilled](demo/products-drill-tally.jpg) |
| D13 | Coupons area | Table from the rail in a bordered panel: Active dot, Code, Amount, Type, Description, Usage, Expiry date, inline edit; chips Status, Discount Type, Expires; + to add; narrow search with an icon cluster | Table from the rail on a bordered card: Active dot, Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; narrow search with a sliders icon, bell and avatar; the sliders open the coupons' column settings; "Showing 10 of 10" with a sync icon under the card | close | No + to add a coupon and no inline edit (the connector has no coupon writes). No calendar behind Expires | connector, shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order d8bdc38c · #375, cashier, "Register: Register 1281") with Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #375 (local id d8bdc38c) on the
local dev store. It was a cash sale of $14.00 for two Croissant, one
Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as change.
Orders #367 to #374 in the list were not made by this round.

Register sessions were also exercised, with sessions on by default and no
switch touched:

- A fresh till showed the Open register card. A session was opened at
  06:42 with a $100.00 float, took order #375, and was closed at 06:47
  with an exact count of $114.00 (Closure 1 · Register 1281).
- A second session was then opened with a $100.00 float for the phone
  capture and left open.
- The sessions exist only in the capture browser's profile.

Three open orders were left on the phone till for B12, as unpaid carts in
the capture browser's profile; none was sent to the store: Guest $3.50
(41d41465-f5c6-4f46-a701-6d5cc6a65e5c), Guest $4.00
(c70761aa-4467-4a88-8b52-081f20ae6afd) and Guest $3.00
(74c23fc0-1994-4648-b8a7-d806f5bfa38c), with a blank cart open. A cart
takes a new local id when another tab is chosen, which is also when it
moves to the end of the strip.

## Next for this repo

The gaps that can still be built here, in the order a cashier would notice
them. Round 10's fifteen items are done by #239 to #248; what follows is
what those left, plus what the new tax-rates dialog shows. Gaps that wait
on TallyUI or the connector are left out.

1. **Rail tint** (A2, every screen). Give the rail v2's rgb(227,233,245)
   as its own token in `global.css` and draw `app-rail.tsx` with it
   instead of `bg-muted`.
2. **Register bar avatar and bell** (A3, A12). Drop the avatar button's
   `bg-accent` wash so the 20 px avatar sits on the bar's white, and draw
   the bell in the muted foreground.
3. **Cart totals and foot inset** (B1, B12, A1). Bring Subtotal, Total
   and the ⋮ / Checkout row to v2's ~8 px from the pane's edge (Subtotal
   at x807, ⋮ at x806 on 1280; ⋮ at x7 on a phone).
4. **Catalogue top inset** (A5, A6, A7, B11). Search box 12 px from the
   top, the chip row at y68 and the breadcrumb at y146, as the demo's.
5. **Catalogue icon sizes** (A5, A6, B6). The list/grid and settings
   glyphs and the cart's + at 16 px in the muted foreground; the "All
   products" tile's grid icon at 16 px.
6. **Phone gutter** (A12). Search box and tiles 14 px from the screen's
   edge.
7. **Cashier sheet** (A4). A white sheet and a white drawer card; a
   drawer icon on the card and the cashier's avatar by "by"; "Pay in · Pay
   out · Close register" in the foreground colour.
8. **Area lists** (C1, C5, C6). A 12 px inset from the rail on the area
   pages; orders rows 57 px with the status and number vertically centred
   on the chip.
9. **Settings › General** (D2). "Default Customer is Cashier", a ↗ icon
   on the "Open" links, and the language's display name ("English (US)",
   via `Intl.DisplayNames`).
10. **Tax rates sheet** (D3). Underline class tabs with the count inline,
    the active one underlined in primary; title "Tax Rates" with a × in
    the header; a sync icon by the rate count.
11. **Theme page spacing** (D5). About 44 px between the "Current Theme"
    line and the cards.
