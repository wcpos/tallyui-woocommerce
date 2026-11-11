# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-11
- Tally Woo: `main` at `c1f6675eb8a76f81242bd470c06d3947c9d34a1b` (after #237, `@tallyui/*` 3.18.0), served as a production bundle
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 10 (full). Every row's Tally image was recaptured and every row
  re-scored, with the statuses judged strictly: control heights, insets,
  colours and type sizes that a cashier would see now count, where earlier
  rounds passed them
- Score: `PARITY tally-woo 3/45 (match 3, close 35, differs 0, missing 7)`
- Round 9: 10/45 (match 10, close 28, differs 0, missing 7)
- Round 8: 10/45 (match 10, close 28, differs 0, missing 7)
- Round 7: 10/45 (match 10, close 28, differs 0, missing 7)
- Round 6: 7/45 (match 7, close 31, differs 0, missing 7)
- Round 5: 7/45 (match 7, close 30, differs 1, missing 7)
- Round 4: 7/45 (match 7, close 30, differs 0, missing 8)
- Round 3: 6/45 (match 6, close 31, differs 0, missing 8)
- Round 2: 6/45 (match 6, close 28, differs 3, missing 8)
- Round 1: 0/45 (match 0, close 11, differs 23, missing 11)

The drop from 10 to 3 is the stricter reading, not a regression: #237's
type ramp, red and 44 px sheet footers all landed and show in A10, B9 and
C1. Seven rows that round 9 passed as match now show measured differences
(A3, A5, A9, B2, B11, D3, D5).

Register sessions: a front desk ruling of 2026-11-11 supersedes the
2026-10-06 ruling that made sessions opt-in. Paul's target is "look and
function like demo.wcpos.com/pos", so Tally Woo now turns sessions on for a
till with no saved choice. A till that saved a choice keeps it. The switch
is also in Settings › General, where it can be reached while the register
is closed. The default is set in this app only; the shared TallyUI packages
keep theirs, so Medusa POS and Vendure POS do not change. Round 10, like
rounds 7 to 9, captured A4, C6, C7 and C8 with that default: the register
opened, sold and closed with no switch touched.

Register name: a Tally till has one register. v2 adds the register to the
bar's place only when the store has more than one
(`register-bar.helpers.ts`), so the demo's "· Front Counter" comes from its
data, and a bar that reads the store alone is v2's single-register look.
Since #219 the till strip, the session card, the closures header and the
prints name the register ("Register 3A7E" in this round's fresh profile).

Production bundle: round 10, like rounds 6 to 9, served Tally Woo from `pnpm
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
- `TooltipTrigger` opens on press and has no hover-open option. Since #233
  the app works round it on the settings icons only (A10, C1, C5, D12,
  D13), so their tooltips open on hover and are gone once the sheet opens.
- `Switch` has no `size="sm"`: it is 44x24 px against v2's 36x20 (A10,
  B9, C1, D2, D3).
- The light theme's `--color-input` is a dark grey (#848a94). Besides any
  `border-input` control, it is the off `Switch` track, which draws about
  rgb(132,136,145) where the demo's off track is a light grey
  rgb(216,217,221) (A10, B9, D2, D3).
- `DialogOverlay` and `AlertDialogOverlay` are `bg-black/80`. The demo's
  sheet backdrop darkens the page by about a quarter (page 244 → 182);
  Tally's takes it to about 50, nearly black (A10, B9, C1, C4, C7).
  `DialogContent` renders its overlay with no className, so the app can
  lighten only the overlays it composes itself (Cart Settings).
- `Button`'s default size is `h-10` and `SearchInput` is 40 px tall
  (`py-2.5`), against v2's 44 px `h-ctl`. The settings sheets' footers
  pass `h-11` since #237; the catalogue and list search boxes, the
  catalogue's view and settings icon buttons and the cart's + and sliders
  buttons are still 40 px (A6, A7, B5, C1, C3, C5).
- `--color-sale` is `#dc2626` in `@tallyui/theme`'s light theme
  (`#f85149` dark). The app's seven extra themes map sale to v2's
  destructive in `themes.css`; light and dark do not, and the app can
  override them in `global.css` (see check 2 below).
- `DialogTitle` drops `leading-none` when a size is passed. #237 sets
  `text-lg leading-none` on the sheets' titles, which measure as v2's do,
  so nothing shows this round.

`text-sm` at 14 px, listed since round 8, is gone: #237 set v2's ramp
(base 14, xs 12, 2xs 11, sm 13, lg 16, xl 18, 2xl 21, 3xl 26, each at a
1.35 line height) in `global.css`.

Round 10 ran four checks for the brief, on both sides:

1. **Tile band.** On the demo's catalogue image a product tile is 170 px
   wide and 218–219 px tall outside, with a 168 px picture inside it, which
   leaves a band of about 48–49 px under the picture. That is v2's
   `POSTER_BAND`: name line 14 × 1.25 = 17.5, price line 14 × 1.35 =
   18.9, and 12 px of padding, 48.4 in all. Tally's DOM measures the tile
   at 163x217 with a 161x161 picture and a band of 54 px (name 14/17.5
   bold, price 14/18.9 bold). `BAND = { height: 54 }` in
   `components/product-tile.tsx` was sized on the old 16 px base. **v2's
   48.4 is right; Tally's band is 5.6 px too tall.** The tiles are also 7
   px narrower than the demo's, because the catalogue column is inset 24
   px from the rail against the demo's 12 (`catalogue-view.tsx`'s `p-4`
   around TallyUI's `px-3`).
2. **Sale colour.** The demo draws no sale price in red. On its cart line
   the struck $23.00 is rgb(84,84,86) and the $15.00 below it
   rgb(80,81,85), both the foreground grey; its tiles show the sale price
   in the tile's price colour. Tally matches that wherever the app draws
   a price: the cart's struck $5.00 and $4.00 are both the muted
   rgb(101,108,121), and the tile prices are rgb(17,24,39). Tally's
   `--color-sale` is still `#dc2626`, but it shows only through TallyUI's
   `ProductPrice` (the table view's price column inside a level, "$x
   (was $y)" in red) and `DiscountBadge`. Setting light and dark
   `--color-sale` to v2's destructive in `global.css` brings those two in
   line.
3. **Control heights**, against v2's 44 px `h-ctl` (Tally's DOM; the demo
   read off its image):

   | Control | Tally | Demo |
   |---|---|---|
   | Catalogue search box | 40, starting 28 px from the rail, 24 from the top | 44, 12 px from the rail, 12 from the top |
   | View and settings icon buttons | 40x40 | 44 |
   | Filter chips | 36 | about 44 |
   | Customer chip in the cart | 94x36 | about 44, with a location pin segment |
   | Cart + and sliders buttons | 40x40, icons about 18 px, dark | 44, icons about 14–16 px, muted grey |
   | Quantity | 16x44, plain "1" | a bordered box about 36 wide |
   | Line −, + and Remove | 44, 44, 77.5x44 | none: the demo has no stepper row |
   | Price trigger | 44 | 44 |
   | ⋮ beside Checkout | 48x48 | 44 |
   | Checkout | 48 tall | 56 tall |
   | Open-order tabs | 51 | 51 |
   | Sheet footer buttons | 44 (since #237) | 44 |

4. **Tile Fields above the fold.** In A10 both Tile Fields switches show
   whole: the Price switch's track runs 679–703, 4 px clear of the list's
   edge at 707, where round 9 cut it by 2 px. B9 has no Tile Fields; its
   last row (Register sessions with its two-line help) ends about 190 px
   above the footer. The areas' sheets carry Columns, not Tile Fields; the
   Order Settings sheet's six column switches all show whole with the
   footer far below. The other areas' sheets were not reopened.

New this round, across the whole app:

- **Palette.** The demo's Light theme primary is a deep blue (about
  rgb(0,49,203)); Tally's is indigo `#5b5ef0` (A5's "All products" tile,
  Checkout, the open tab's line, the avatar). The demo's rail is tinted
  rgb(227,233,245) over a page of about rgb(242,245,252), with a white
  cart pane; Tally's rail is rgb(243,244,246), its page rgb(248,249,251)
  and its cart pane rgb(247,248,252), not white.
- **Insets.** The demo's catalogue and cart panes sit 12 and 8 px in from
  their edges; Tally's sit 24 and 16 px in (`catalogue-view.tsx`'s and
  `sale-screen.tsx`'s `p-4`).

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
  all 41, in a fresh browser profile after the first sync ("3 categories
  · 12 products" in 17 s), then measured in the DOM. The demo side was
  measured off its images with a pixel scan. The areas' settings panels
  were not opened on the demo, so the panels themselves are held to the
  demo's Product settings chrome.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail, one row of filter chips, category poster tiles; the register bar heads the cart column. On a new till the cart pane has an "Open register" card under a "Register closed" pill. Once the register is open: a "GU Guest" chip with + and a sliders icon; an empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot | close | A new till first asks for the opening float (the demo's register was already open, so its open step was not seen). The empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only its empty message (merged in TallyUI as #723, awaiting release). Indigo primary, grey rail and grey cart pane against the demo's deep blue, tinted rail and white pane (buildable here). No location pin beside the customer chip (A11) | shared:@tallyui/components (TallyUI #694, awaiting release) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health and a Settings gear at the foot; "v 0.1.0" | close | No Support entry (left out on purpose). The rail is a flat grey where the demo's is tinted blue (buildable here) | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a small bell and a 20 px "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a round "CA" initials avatar, as the cart column's first row. A "Register closed" pill joins the bar while the register is closed. On a phone, one bar sits over both tabs. The avatar's sheet is the door to the register panel | close | The avatar is 28 px against the demo's 20, and the bell is larger and darker (buildable here). The store alone, with no register name, is v2's look for a store with one register, so it is not counted | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: avatar and × in the header, name, "US Store · Front Counter · since 14:40 · 1 m", Your sales today, a drawer card with an icon ("In the drawer $2,996.12", "Pay in · Pay out · Close register"), an uppercase "HAND THE TILL TO" heading with "+ Another account…" as a plain row, Store and Register with Switch, WordPress Admin and Desktop App links with icons; Sign out (outline, red border) and Close in the footer | Right sheet: "cashier" and the store, "Your sales today $14.00", "In the drawer $114.00 · opened 22:52 by cashier" with "Pay in · Pay out · Close register ›", Hand the till to with "Another account" as a filled primary button, a WordPress Admin text link, and Sign out as a filled red button in the middle of the sheet | close | No × or avatar in the header, no Close; Sign out is a filled red button mid-sheet, not an outline button in the footer; Another account is a big primary button, not a "+" row under an uppercase heading; the links have no icons (all buildable here, `cashier-sheet.tsx`). No store or register switch, no "since" time, no Desktop App ("Registers") | connector | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to a blue "All products" tile with a back chevron, then full-bleed product photos with name, price and "12 options"; tiles 170 px wide with a 48 px band | Coloured category poster tiles (All products, Bakery 2 products …); "All products" drills in to "Categories › All products" with the "All products" tile and its back chevron in slot 0, then full-bleed images, name, price and "1 option" under a variable product's price, and an in-cart count badge | close | Each product tile's band under the picture is 54 px against the demo's 48.4, and the tiles are 163 px wide against 170 because the column is inset 24 px from the rail against 12 (buildable here). The "All products" tile and the count badges are indigo, not the demo's deep blue | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" 44 px tall, 12 px from the rail and the top, with scan, list/grid and settings icons beside it | "Search products" at the top of the column, with list/grid and settings icons beside it | close | No scan button (TallyUI #720). The box is 40 px tall, starts 28 px from the rail and 24 from the top, and the icon buttons are 40 px against 44 (inset buildable here; heights TallyUI, not filed). The dev store has no "shirt", so the result grids cannot be compared | shared:@tallyui/pos (TallyUI #720), shared:@tallyui/components (SearchInput and Button heights, not filed) | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips about 44 px tall, always shown: In Stock (on by default, with ×), Featured, On Sale, Category, Tag, Brand; drilled in, the Category chip leaves the row | Rounded chips in one row: In Stock (on by default, with ×), On Sale, Category, Tag; the chips are chosen in Product settings. Drilled in, the Category chip leaves the row | close | The chips are 36 px tall against about 44 (buildable here). No Featured or Brand chip: the connector syncs neither ("Catalogue") | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 12 of 13") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level inside a white bordered card: coloured folder icon, name, product count, chevron; rows about 59 px | List rows at the category level: coloured folder icon, name, product count, chevron; drilling in gives a product table | close | The rows sit straight on the page background with no white bordered card round them, and are about 57 px against 59 (buildable here, `BrowseRootTable` in `browse-terms-view.tsx`) | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet over a light backdrop: View Mode, Tile Size, Browse by (the chosen row tinted, with a primary bar at its left), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields (Product Name, Price), Restore Default Settings with dark text in a red border, Close | Right sheet under v2's header (a 16 px title and ×): View Mode, Tile Size, Browse by, Show out-of-stock products, Sort By and Direction, Variations, Tile Fields (Product Name, Price), Restore Default Settings in a wine-red border, Close; 44 px footer buttons | close | The backdrop is near black (`bg-black/80`) against the demo's light shade (TallyUI). The switches are 44x24 against 36x20, and an off switch's track is dark grey against light grey (TallyUI). The chosen Browse by row has no tint and no primary bar (buildable here). The Variations Popover option is greyed out: Tally has no variations popover (TallyUI #719). Indigo against deep blue. The Price switch now shows whole, and the title, footer and Restore's red match | shared:@tallyui/components (DialogOverlay, Switch `size="sm"`, `--color-input`, not filed; TallyUI #719 popover) | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 12 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector (TallyUI #722) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), search 14 px from the edge, one scrolling chip row, Compact category tiles four to a row, "Shop base" and the count at the foot, bottom tab bar Products / Cart with a badge | Top bar (menu, store name, bell, avatar), one scrolling chip row, Compact category tiles four to a row with "All products" on two lines, the count with a sync icon at the foot, bottom tab bar Products / Cart with a "New" badge | close | The search and tiles sit 28 and 24 px in from the edge against 14, and the tiles are a little smaller (buildable here). No scan button (A6) and no "Shop base" at the foot (A11) | shared:@tallyui/pos (TallyUI #720), connector (TallyUI #722) | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | White full-bleed pane: QTY / ITEM / PRICE / TOTAL headers; quantity in a bordered box; regular price struck through above the sale price | Grey pane inset 16 px: QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only three lines fit above the totals. The quantity is plain text, not a box ("Cart") (TallyUI #677). The pane is grey and inset where the demo's is white and edge to edge (buildable here) | shared:@tallyui/components (TallyUI #677) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button, 56 px tall, with a 44 px ⋮ button beside it | One wide "Checkout $14.00" button with a ⋮ button beside it | close | Checkout is 48 px tall against 56, the ⋮ 48 against 44, and Checkout is indigo against deep blue (buildable here) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33"), then Checkout | Subtotal, then a bold Total row, then Checkout | close | A bold Total row sits between the lines and Checkout, where the demo has none: TallyUI's `CartTotal` always draws it. The per-rate tax lines could not be seen because the dev store charges no tax | shared:@tallyui/components (not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart: the name over the amount, an age in the warning tone on carts hours old, the open tab underlined, + at right | Tabs along the foot of the cart: "Guest" over "$14.00", the open tab underlined, + at right; tabs 51 px tall as the demo's | match | The age comes from the data: the demo's tabs are hours old, and Tally shows the same warning-tone age on a cart parked for an hour ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a 44 px "GU Guest" chip with a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a 36 px "GU Guest" chip; the chip opens a dropdown over the cart with Guest, "Search Customers" and customers with email | close | The dropdown's rows have no initials avatar: `CustomerSelect` has no row renderer (TallyUI #714). The chip is 36 px against 44 (buildable here). No location pin on the chip: that is A11's tax location ("Customers") | shared:@tallyui/components (TallyUI #714), connector (TallyUI #722) | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries. The + icon is 18 px and dark against the demo's lighter 16 px grey | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price, quick discount keys −5%, −10%, −15% in primary text on one band, borderless keypad, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, a keypad of bordered keys, Apply, Cancel | close | No struck regular price in the popover. The keys are bordered boxes where the demo's keypad is flat, and Apply / Cancel stand where the demo has one check. A separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet beside the rail over a light backdrop: Panel position, Open orders position, Sort items (select), Quick Discounts (−5% / −10% / −15% at 13 px semibold), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Left side sheet beside the rail under v2's header: Panel position, Open orders position, Sort items (select) with "Fees and shipping always stay last", Quick Discounts (−5% / −10% / −15%) with a hint, auto show and auto print receipt switches, Register sessions as a switch row with a two-line help, Restore Default Settings in a wine-red border, Close; 44 px footer | close | No Columns section ("Cart") (TallyUI #695). The backdrop is near black against light (the app composes this overlay, so it is buildable here). The quick discount keys are 16 px medium against 13 px semibold, and the two hints are 13 px against 12 (buildable here). The switches are 44x24 against 36x20, and an off track is dark grey (TallyUI). Register sessions, Restore's red, the footer height and the segmented labels now match | shared:@tallyui/components (TallyUI #695, Switch `size="sm"`, `--color-input`) | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #689, awaiting release) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place: the parent tile (photo, name, price, "12 options", back chevron), then one tile per variation with its name, attribute chips ("32", "Blue") and price; the filter chips grey out; "12 options" at the foot | "T-Shirt" (6 options) drills in place: "Categories › All products › T-Shirt", the parent tile (image, name, price, "6 options", back chevron), then one tile per variation with its name, attribute chips ("S", "Black") and price; the Category chip leaves the row and On Sale and Tag dim, with v2's tooltip on hover; "6 options" with a sync icon at the foot | close | The tiles carry A5's taller band (54 against 48.4) and narrower width (163 against 170) (buildable here). A dev build still rejects the variable products when they sync (TallyUI #713, merged as #724, awaiting release) | | [demo](demo/variations-demo.jpg) · [tally](demo/variations-tally.jpg) |
| B12 | Phone cart (390x844) | Top bar; full-screen cart table, "Checkout $16.83"; one-line open-order tabs ("Guest $16.83") with a "3 ^" count, the open tab in view at the right; bottom tab bar | Top bar (menu, store, bell, avatar); full-screen cart table, Subtotal and a bold Total, ⋮ and "Checkout $4.00"; with three open orders, one-line tabs behind a "3 ^" count cell, the open tab whole at the right with + after it; bottom tab bar Products / Cart with a badge | close | Each line carries a row of −, +, Remove, Discount and Price controls, which take most of the height (TallyUI #677). The bold Total row (B3). The pane is inset 16 px on grey where the demo's is white to the edge (buildable here) | shared:@tallyui/components (TallyUI #677; `CartTotal`, not filed) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number (centred, 32 px customer chip), Customer, Billing address, Date created with a sort chevron, POS icon, Cashier, Payment method, Total; "TODAY" group heading; narrow 44 px search with a settings, bell and avatar cluster; "Showing 20 of 29,754" with a sync icon | Table on a bordered card: Status dot, Order number, Customer chip, Date created, Payment method, Total, chevron; TODAY / YESTERDAY group headings; 40 px search with a sliders icon, bell and avatar; the sliders open "Order Settings", a right sheet with a Columns heading, six column switches, Restore Default Settings (wine-red border) and Close on a 44 px footer; "Showing 25" with a sync icon | close | No Billing address, POS icon or Cashier column, and no "of N" total ("Order history") (connector). The customer chip is about 22 px with 12 px text against 32, and the order numbers sit left where the demo centres them (buildable here). The search is 40 px against 44 (TallyUI). The Order Settings sheet's backdrop is near black and its switches larger (TallyUI); its title, Restore and footer now match the demo's Product settings | connector (columns; X-WP-Total, TallyUI #680), shared:@tallyui/components (Switch `size="sm"`, DialogOverlay, SearchInput height) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) · [tally settings](demo/orders-settings-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector (TallyUI #721) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "374" leaves one row, "Showing 1" | match | The box's 40 px height is counted in C1 | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #374": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The backdrop is near black (TallyUI). The tax breakdown was not seen (no tax) | connector, shared:@tallyui/components (DialogOverlay, not filed) | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: initials avatar, First name, Last name, Email, Billing address, Date created; narrow search with add-customer, settings, bell and avatar; "Showing 10 of 5,146" | Table on a bordered card: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; narrow search with add-customer, sliders, bell and avatar; the sliders open "Customer Settings" with column switches; "Showing 5" with a sync icon under the card | close | The avatars are pale grey where the demo's are solid primary (TallyUI #718). No Date created column: the connector's `Customer` has no created or modified dates. No "of N" total ("Customers": Customers screen) | connector (Customer dates, not filed; X-WP-Total, TallyUI #680), shared:@tallyui/components (TallyUI #718) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu with bell and avatar; register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report with a printer icon); Today date menu, Everyone, Completed & processing, Print summary; big total with Orders, Average order, Items; vs yesterday; By hour / Running total chart with a dashed comparison and a muted future bar; Orders, Payments, Where sold cards | One bar over the page: "TallyUI WooCommerce dev store · Register 3A7E" with a bell and avatar. One-row till strip ("Register 3A7E ● Open since 22:52 · cashier", Opening float + Cash sales = Expected in drawer, Print X-report, a chevron to Closures); "Today · Wed 11 Nov" with a chevron, "Everyone" chip, Print summary; big total with Orders, Average order, Items; "vs yesterday" beside By hour / Running total; "$14.00 · 1 order" over the 22:30 bar; Orders, Payments, Where sold cards | close | The scope title has no menu chevron: there is no store and register menu. No "Completed & processing" chip (left out: every local sale is complete). The date menu has no calendar. The bars, the Expected tile and the donuts are indigo against deep blue. The dashed comparison and the muted future bar draw only when the day before has sales on this device | connector (status chip, store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | On by default: Open register with a float; from the avatar's sheet, a centred "Register" dialog with "1 sale this session", Paid in / Paid out / No sale tiles, Expected in the drawer (Cash $114.00), Close register; then "Count the drawer" in the cart pane with denominations, Back to selling, Close register; then a closure ("Closure #1", Counted, Expected, Exact) with "Print the Z report" | close | The close step is a centred dialog with no big drawer amount, no Session sales total, no Other tenders row and no Cancel or Print X-report | shared:@tallyui/components (TallyUI #716) | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | Its own screen, "US Store · Front Counter ▾" header with bell and avatar, Today date menu and All cashiers chip: Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; day band; session row with Print X-report; tinted Export CSV with an icon | Its own room from the chevron at the end of the till strip: back arrow, "TallyUI WooCommerce dev store · Register 3A7E", bell and avatar; "Today · Wed 11 Nov", "All cashiers" chip, an outlined Export CSV with a document icon; Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card with "1 session"; Today band "$114.00 counted · Exact"; "Closure 1 · Register 3A7E", 22:52 → 22:58, with Reprint | close | The scope title has no menu chevron. The date menu has no calendar. Export CSV is not counted: v2's `ClosuresExportButton` is outline with a document icon, as Tally's is | connector (store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Sub-nav beside the rail: General, Tax, Barcode Scanning, Theme; each page in a bordered panel | close | Printing, Card readers and Customer Display are absent (D6–D8) ("Settings area") | connector, pro | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | A two-column form with muted labels: editable Store Name; base country, state, city and postcode with "Set in WooCommerce · Open ↗"; Language select; Default Customer select; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals as fields | Bold labels at left, values at right inside an inner bordered box per section: Store Name, base country, state, city, postcode and Language read-only with "Set in WooCommerce · Open"; Default Customer as a customer chip; Default Customer is cashier switch; currency rows read-only; Register sessions switch | close | Store Name, Language and the currency rows are read-only text with an Open link where the demo has fields and selects (connector). The labels are bold and the values right-aligned in inner boxes where the demo has a flat two-column form with muted labels; the off switch is dark grey and larger (buildable here, Switch TallyUI). Default Customer is a chip, not a select ("Settings area") | connector | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | A two-column form with muted labels: Calculation (Calculate tax based on as a select, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open ↗"); Display (Display Tax Totals, Display Prices in the Shop, Display Prices During Cart and Checkout as two-way segments, Price Display Suffix); Tax Rates with "View all tax rates" | Calculation in an inner bordered box with bold labels and right-aligned values: Calculate tax based on, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open"; Tax Rates ("No tax rates apply at the store's address.") | close | No Display section (the tax display settings are not synced). The same layout difference as D2, with grey off switches, and no "View all tax rates" button (buildable here). Enable Taxes is off from the data | connector (tax display settings) | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Sound ("Play a sound on scan"); Barcode Scanning Test | close | No Scanner section ("Scanning") | shared:@tallyui/pos (TallyUI #682) | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | "Current Theme: Light"; ten theme cards each with an icon: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall; a Scale section (Auto / Compact / Regular / Spacious); an Icons section (Match theme, Tabler 1.5, Hugeicons, Phosphor …) | "Following system theme"; the same ten theme cards, without icons, inside an inner bordered box | close | No Scale or Icons section (TallyUI, not filed). The cards have no icons and sit in an extra inner box (buildable here) | shared:@tallyui/theme (scale and icon sets, not filed) | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | connector (TallyUI #681) | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | shared:@tallyui/pos (TallyUI #679) | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | connector, pro (TallyUI #684). ADR-085: U7, the fork routes, is TallyUI/woocommerce-pos#1, waiting for the desk; U8, the app wiring, comes after the TallyUI batch release; the Woo connector's `displaySignalling` belongs to the tallyui worker | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; table Collection / On device / On server / Coverage bar / Size with ⋮ per row | Sub-nav Database / Logs; "✓ Ready to sell", records on this device, storage used, changes waiting to send; table Collection / On device; "Check for changes now" | close | No Performance entry in the sub-nav (D10). No On server, Coverage or Size columns. The dev store had no stuck records, so the attention banner was not seen ("Store health") | connector | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | shared:@tallyui/database (TallyUI #683) | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; verbose diagnostics toggle; Time / Level / Event / Duration / Status rows with a chevron; "Showing 46 of 46" and a "next check" line at the foot | Under Store health: the same four figures; Copy debug info; Search Logs; rounded All / Actions / Errors / Sync chips; "Verbose diagnostics: off"; Time / Level / Event / Duration / Status rows with a chevron ("Order accepted by the store", "Register session opened") | close | No "next check" line at the foot. Sync runs write no row; the demo logs them ("Loaded the records this screen needs") | shared:@tallyui/database (TallyUI #683) | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail in a bordered panel: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status dot, categories, price, regular and sale price; chips In Stock, Featured, On Sale, Category, Tags, Brands; narrow search with a settings, bell and avatar cluster; "Showing 10 of 209" | Table from the rail on a bordered card: image, name, stock, stock status dot, categories, price, regular and sale price; a variable product shows its attribute links and "6 variations ›" under its name, both drilling to "Products › T-Shirt" with one row per variation; chips Stock Status, On Sale, Category, Tag; narrow search with a sliders icon, bell and avatar; the sliders open "Product Settings" with column switches; "Showing 13 of 13" with a sync icon under the card | close | The product name is plain text, not v2's inline field, and stock is plain text with no Manage toggle (no product writes in the connector). No Featured or Brands chip | connector | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) · [tally drilled](demo/products-drill-tally.jpg) |
| D13 | Coupons area | Table from the rail in a bordered panel: Active dot, Code, Amount, Type, Description, Usage, Expiry date, inline edit; chips Status, Discount Type, Expires; + to add; narrow search with an icon cluster | Table from the rail on a bordered card: Active dot, Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; narrow search with a sliders icon, bell and avatar; the sliders open the coupons' column settings; "Showing 10 of 10" with a sync icon under the card | close | No + to add a coupon and no inline edit (the connector has no coupon writes). No calendar behind Expires | connector, shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order 9f4397e6 · #374, cashier, "Register: Register 3A7E") with Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #374 (local id 9f4397e6) on the
local dev store. It was a cash sale of $14.00 for two Croissant, one
Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as change.
Order #373 in the list was not made by this round.

Register sessions were also exercised, with sessions on by default and no
switch touched:

- A fresh till showed the Open register card. A session was opened at
  22:52 with a $100.00 float, took order #374, and was closed at 22:58
  with an exact count of $114.00 (Closure 1 · Register 3A7E).
- A second session was then opened with a $100.00 float for the phone
  capture and left open.
- The sessions exist only in the capture browser's profile.

Three open orders were left on the phone till for B12, as unpaid carts in
the capture browser's profile; none was sent to the store: Guest $3.50
(98d670c6-db8b-4d4f-9c41-8e66e3922462), Guest $4.00
(4b348fe7-1c8c-4295-9854-db37ab6220cf) and Guest $3.00
(bf866dae-e5d5-4204-958a-027236047657), with a blank cart open. A cart
takes a new local id when another tab is chosen, which is also when it
moves to the end of the strip.

## Next for this repo

The gaps that can be built here, in the order a cashier would notice them.
Round 9's four items (Price switch at the fold, 16 px sheet text, the
Register sessions row, Restore's red and footer height) are done by #237.

1. **v2's Light palette** (A1, A2, A5, B2, C6, every screen). In
   `global.css`, set light primary to v2's deep blue, tint the rail, and
   make the page and the cart pane v2's colours (cart pane white).
2. **Column insets** (A5, A6, A12, B1, B12). Drop `catalogue-view.tsx`'s
   `p-4` round the products panel so TallyUI's `px-3` gives v2's 12 px
   gutter, and give the cart column (`sale-screen.tsx`) a white pane with
   v2's 8 px inset instead of `p-4` on the background.
3. **Checkout and the cart controls** (B2, B5, B6). Checkout 56 px tall,
   ⋮ 44, the customer chip 44, the cart's + and sliders buttons 44 with
   16 px muted icons.
4. **Tile band** (A5, B11). `BAND = { height: 48.4 }` (name 14 × 1.25 +
   price 14 × 1.35 + 12) in `product-tile.tsx`, with its comment moved to
   the 14 px base.
5. **Catalogue search row and chips** (A6, A7). Give the search box and
   the view and settings icon buttons 44 px (`h-11`) and the filter chips
   44 px, until TallyUI's `SearchInput` and `Button` move to `h-ctl`.
6. **Register bar** (A3). The avatar at 20 px and a smaller, muted bell.
7. **Sheet backdrop** (B9). Give Cart Settings' own `DialogOverlay` v2's
   light shade (about `bg-black/25`); the other sheets wait on TallyUI's
   `DialogContent`.
8. **Cart Settings text** (B9). Quick discount keys `text-sm
   font-semibold`; the Sort items and quick discount hints `text-xs`, as
   Register sessions' already is.
9. **Product settings' Browse by** (A10). Tint the chosen row and give it
   v2's primary bar at the left.
10. **Cashier sheet** (A4). × and avatar in the header; "Hand the till to"
    as an uppercase heading with "+ Another account…" as a plain row;
    icons on the WordPress Admin link; Sign out as a red-bordered outline
    button in a footer beside Close.
11. **Table view's root list** (A9). Put `BrowseRootTable`'s rows in a
    white bordered card, rows 59 px.
12. **Orders list** (C1). The customer chip at 32 px with 13 px text, the
    order numbers centred, a sort chevron on Date created.
13. **Settings pages' layout** (D2, D3). v2's flat two-column form with
    muted labels instead of bold labels in inner boxes, and "View all tax
    rates" as a button.
14. **Theme page** (D5). An icon on each theme card, "Current Theme:
    <name>", and no inner box round the cards.
15. **Sale colour** (table view inside a level). Set light and dark
    `--color-sale` to v2's destructive in `global.css`, as `themes.css`
    already does for the other seven themes.
