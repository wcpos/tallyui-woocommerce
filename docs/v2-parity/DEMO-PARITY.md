# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-12
- Tally Woo: `main` at `7cf7a00d889cd1e59af19fce00ac99e9040bb8e3` (after #255, `@tallyui/*` 3.18.0), served as a production bundle
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 12 (full). Every row's Tally image was recaptured and every row
  re-scored with round 11's strictness: control heights, insets, colours
  and type sizes that a cashier would see all count. Where v2's source and
  the demo's pixels differ by a pixel or two (the 18 px glyphs, the 16 px
  phone gutter), the source is cited and the difference is not counted
- Score: `PARITY tally-woo 5/45 (match 5, close 33, differs 0, missing 7)`
- Round 11: 4/45 (match 4, close 34, differs 0, missing 7)
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

Round 12 follows #250 to #255, which cover round 11's "Next for this
repo" except the cart totals inset, which waits on TallyUI's `CartTotal`.
The rail and the register bar now match the demo (A2 and A3 move to
match). The catalogue's search box and chip row, the area pages' 12 px
inset, the 57 px orders rows, the Settings pages' labels and the tax
rates sheet's tabs and title all measure as the demo's now. A9 moves back
from match to close: the catalogue column stops 21 px short of the cart
pane where the demo's stops 12 short (round 11 did not measure the right
edge), and the active filter chip is drawn with a primary border where
v2's is a borderless blue tint. Most close rows are left with one
buildable difference or with only TallyUI and connector waits.

Register sessions: a front desk ruling of 2026-11-11 supersedes the
2026-10-06 ruling that made sessions opt-in. Paul's target is "look and
function like demo.wcpos.com/pos", so Tally Woo turns sessions on for a
till with no saved choice. A till that saved a choice keeps it. The switch
is also in Settings › General, where it can be reached while the register
is closed. The default is set in this app only; the shared TallyUI packages
keep theirs, so Medusa POS and Vendure POS do not change. Round 12, like
rounds 7 to 11, captured A4, C6, C7 and C8 with that default: the register
opened, sold and closed with no switch touched.

Register name: a Tally till has one register. v2 adds the register to the
bar's place only when the store has more than one
(`register-bar.helpers.ts`), so the demo's "· Front Counter" comes from its
data, and a bar that reads the store alone is v2's single-register look.
Since #219 the till strip, the session card, the closures header and the
prints name the register ("Register 2BBF" in this round's fresh profile).

Production bundle: round 12, like rounds 6 to 11, served Tally Woo from `pnpm
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

- `CartTotal` always draws a bold Total row (B3, B12), and it and
  `CartFoot` set their own inset: Subtotal sits at x829 and the ⋮ at x817
  against v2's x807 and x806 (about 20 px from the pane's edge against 8),
  and on a phone Subtotal at x32 and the ⋮ at x20 against x7 (A1, B1,
  B12).
- `CartFoot` draws the ⋮ and Checkout buttons at a fixed `min-h-12`
  (48 px) and takes no size for them; its `className` reaches only the
  outer row. v2's ⋮ is 44 px and its Checkout 56 (B2, B12).
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
  Tally's takes it to about 46–50, nearly black, rail included (A4, A10,
  C1, C4, C7, D3). `DialogContent` renders its overlay with no className,
  so the app can lighten only the overlays it composes itself; Cart
  Settings has v2's light shade since #243.
- `SearchInput` is 40 px tall (`py-2.5`) against v2's 44 px `h-ctl`. The
  catalogue's search box passes 44 px; the areas' list search boxes and
  Logs' are still 40 px (C1, C3, C5, D11).
- `@tallyui/connector-woocommerce`'s `StoreSettings.taxClassSlugs` carries
  the tax classes' slugs only, so the tax-rates sheet names the standard
  class "Standard" where v2 reads "Standard rate" (D3).

Gone since round 11: `DialogTitle`'s dropped `leading-none` no longer
needs listing (#237 sets it on every sheet title, and nothing shows).

Round 12 ran the brief's seven checks on both sides. Tally was measured in
its DOM and off its new images; the demo off its existing images with a
pixel scan. Both are at 1280x800 unless marked phone.

1. **Rail and bar** (A2, A3, A12):

   | Measure | Tally | Demo |
   |---|---|---|
   | Rail fill | rgb(228,234,245) | rgb(227,233,245) |
   | Rail border | rgb(210,216,225) | rgb(211,215,226) |
   | Selected rail item | white, primary glyph | white, primary glyph |
   | Bar avatar | 20 px, primary initials, on the bar's white | 20 px, on white |
   | Bell | darkest pixel about rgb(90,93,98), glyph 14x16 (18 px per v2's source) | rgb(85–94), glyph 14x14 |
   | Bell button | 40 px, so the bell's centre is 6 px further right | 44 px |

   **Match** for the rail and the bar. The 2 px of bell glyph is v2's
   18 px source size; the 6 px shift of the bell is not visible.
2. **Catalogue head** (A5, A6, A7, A9, B11):

   | Measure | Tally | Demo |
   |---|---|---|
   | Search box | y12, 44 tall, from x76 | y12, 44 tall, from x76 |
   | Filter chip row | y68–111 | y68–111 |
   | Breadcrumb ink (drilled) | y131–144 | y140–153 |
   | First tile row, drilled | y176 | y168 |
   | First tile row, root | y132 | y124 |
   | Tiles' left edge | x72 | x76 |
   | Search row's and table card's right end | x776 and x775 (21 px to the cart pane) | x786 and x785 (12 px) |
   | View and settings glyphs | 18 px per source | about 16 in the pixels |
   | All products mark | 18x18 | 17x17 |
   | Category folder mark | 22x19 | 18x16 |
   | Active chip ("In Stock") | primary border, fill rgb(218,225,244), dark icon, black ×, 120 wide | no border, fill rgb(217,233,255), primary icon, muted ×, 140 wide |

   The search box and the chip row now match. The crumb row is too tall:
   the crumb sits 9 px above the demo's and the tiles 8 px below. The
   column's right end is the resize handle's `w-2` plus TallyUI's `px-3`
   (`panel-resize-handle.tsx`); round 11 had the same 21 px and did not
   measure it. The folder mark is still large; v2's source puts it at
   about 20.
3. **Cashier sheet** (A4): the sheet and the drawer card are white, the
   card has v2's 44 px register disc, the opener's 28 px primary avatar
   sits by "by", and "Pay in · Pay out · Close register" is the foreground
   colour: all as the demo's. Left: the content is inset 25 px against 17
   (the card at x793 against x785); "Your sales today" and "In the drawer"
   are black and full size where the demo's are muted rgb(86,85,90) and
   smaller; the drawer figure's ink is 14 px tall against 18; Tally reads
   "by cashier" plus the avatar where v2 reads "by" plus the avatar; the
   gap from the card to "HAND THE TILL TO" is 43 px against 23. The
   backdrop darkens the whole page, rail included, to about 46
   (`DialogOverlay`, TallyUI).
4. **Area pages** (C1, C5, C6): the Orders, Customers, Products, Coupons
   and Reports surfaces all start at x76, 12 px from the rail, as the
   demo's. Orders rows are 57 px with the status, number and chip centred
   at 28: match. The areas' search is 40 against 44 (TallyUI). Reports' till
   strip, hero and cards are the page grey where the demo's are white
   (`till-strip.tsx`, `reports-hero.tsx`, `report-cards.tsx` draw no
   `bg-card`), and the open By hour segment is tinted rgb(228,234,248)
   against rgb(217,234,250) (`segmented.tsx`, `bg-primary/10`).
5. **Settings** (D2, D3, D5): General reads "Default Customer is
   Cashier", "English (US)", and "Open ↗" with the icon. The tax rates
   sheet is "Tax Rates" with a 44 px × holding an 18 px glyph, and
   underline tabs "Standard 0 / Reduced rate 0 / Zero rate 0" with a 2 px
   primary underline on the open tab. Left on the sheet: no sync icon by
   "0 tax rates", and the tabs' rule runs the sheet's full width with the
   tabs inset 8 px where the demo's rule runs under the tabs only. The
   Theme page's cards start at y179 on both sides: match.
6. **Phone** (390x844): the search box and tiles start at x16 against the
   demo's 14; v2's source gives 16, so it is not counted. The demo runs
   v2's Auto scale, which picks Compact on a phone (a 40 px search and
   glyphs about 14 px); Tally has no scale setting (D5). The folder mark
   is 22x20 against 17x15. The drawer is in the rail's tokens (panel lab
   92.4, the selected item white with a primary label, the others the
   foreground), and lists POS, Orders, Customers, Reports, Store health
   and Settings. The demo's drawer was never captured, so it is not
   compared.
7. **Cart totals** (B1, B12), kept as waits on TallyUI's `CartTotal` and
   `CartFoot`:

   | Measure | Tally | Demo |
   |---|---|---|
   | Subtotal, ⋮ (1280) | x829, x817 | x807, x806 |
   | Checkout, ⋮ heights | 48, 48 | 56, 44 |
   | Phone: Subtotal, ⋮, Checkout | x32, x20, x80 | x7, x7, x54 |
   | Cart + glyph | 12x12 | 12x11 |

   The cart's + now matches; the rest is unchanged from round 11.

Ocean was checked again: choosing it on the Theme page recolours the whole
app to teal on dark ([tally Ocean](demo/theme-ocean-tally.jpg)), and
System puts it back.

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
- The demo was not opened this round: the demo images are round 1's,
  except D3's tax-rates dialog from round 11. All 43 Tally images were
  recaptured in a fresh browser profile after the first sync ("3
  categories · 12 products"), then measured in the DOM and off the
  images. The areas' settings panels were not opened on the demo, so the
  panels themselves are held to the demo's Product settings chrome.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail in v2's tint, one row of filter chips, category poster tiles; the register bar heads the cart column. On a new till the white cart pane has an "Open register" card under a "Register closed" pill. Once the register is open: a "GU Guest" chip with + and a sliders icon; an empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot | close | A new till first asks for the opening float (the demo's register was already open, so its open step was not seen). The empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only a cart icon and its message (merged in TallyUI as #723, awaiting release). The totals and foot sit 20 px in against 8 (TallyUI, B1). The active In Stock chip has a primary border (A7) and the catalogue stops 21 px short of the cart pane against 12 (A9) (both buildable here). No location pin beside the customer chip (A11). The rail, the bar, the primary, the page and the white cart pane match | shared:@tallyui/components (TallyUI #694, awaiting release; `CartTotal` inset, not filed) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail in rgb(228,234,245), the selected item white with a primary glyph: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health and a Settings gear at the foot; "v 0.1.0" | match | No Support entry, left out on purpose. The tint, the border and the selected item now match | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a small bell and a 20 px "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a 20 px "CA" initials avatar on the bar's white, as the cart column's first row. A "Register closed" pill joins the bar while the register is closed. On a phone, one bar sits over both tabs. The avatar's sheet is the door to the register panel | match | The bell is v2's 18 px source glyph, 2 px taller than the demo's pixels, and its button is 40 px against 44, which moves it 6 px: not visible. The store alone, with no register name, is v2's look for a store with one register | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: avatar and × in the header, name, "US Store · Front Counter · since 14:40 · 1 m", Your sales today, a drawer card with a register disc ("In the drawer", "Front Counter · opened 03:12 by" an avatar, $2,996.12, "Pay in · Pay out · Close register"), an uppercase "HAND THE TILL TO" heading with "+ Another account…" as a plain row, Store and Register with Switch, WordPress Admin and Desktop App links with icons; Sign out (outline, red border) and Close in the footer | White right sheet: avatar and × in the header, "cashier" and the store, "Your sales today", a white drawer card with a 44 px register disc ("In the drawer", "opened 09:19 by cashier" and a primary avatar, $114.00) and "Pay in · Pay out · Close register" in the foreground colour, an uppercase "HAND THE TILL TO" heading with "+ Another account…" as a row, WordPress Admin with an icon; Sign out (outline, red border) and Close in the footer | close | The content is inset 25 px against 17. "Your sales today" and "In the drawer" are black and full size against v2's smaller muted labels, and the drawer figure is smaller (14 px ink against 18). "by cashier" plus the avatar against v2's "by" plus the avatar. The gaps are looser (43 px from the card to the heading against 23) (all buildable here, `cashier-sheet.tsx`). The backdrop takes the page, rail included, nearly to black (TallyUI). No store or register switch, no "since" time, no Desktop App ("Registers"). The white sheet and card, the disc, the avatar and the verbs now match | connector, shared:@tallyui/components (DialogOverlay, not filed) | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to a blue "All products" tile with a back chevron, then full-bleed product photos with name, price and "12 options"; tiles 170 px wide with a 48 px band, from x76, the first row at y124 | Coloured category poster tiles (All products, Bakery 2 products …); "All products" drills in to "Categories › All products" with the "All products" tile and its back chevron in slot 0, then full-bleed images, name, price and "1 option" under a variable product's price, and an in-cart count badge; tiles 171 px wide with a 48.4 px band, from x72, the first row at y132 | close | The crumb row is too tall: the tiles start 8 px lower than the demo's (y132 against 124 at the root, y176 against 168 drilled) and the crumb 9 px higher (ink y131 against 140). The tiles start at x72 against 76, and the column stops 21 px short of the cart pane against 12 (A9). The category folder mark is 22x19 against 18x16 (all buildable here). The band, the tile width, the blue and the All products mark (18 px, v2's source) now match | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" 44 px tall, 12 px from the rail and the top, with scan, list/grid and settings icons beside it | "Search products" 44 px tall, 12 px from the rail and the top, with 44 px list/grid and settings icons (18 px glyphs, v2's source size) beside it | close | No scan button (TallyUI #720). The row ends at x776 against 786, 21 px short of the cart pane against 12 (buildable here, A9). The box's top, its height and the glyphs now match. The dev store has no "shirt", so the result grids cannot be compared | shared:@tallyui/pos (TallyUI #720) | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips about 44 px tall at y68, always shown: In Stock (on by default: a borderless blue tint, primary icon, muted ×), Featured, On Sale, Category, Tag, Brand; drilled in, the Category chip leaves the row | Rounded 44 px chips at y68 in one row: In Stock (on by default, with ×), On Sale, Category, Tag; the chips are chosen in Product settings. Drilled in, the Category chip leaves the row | close | The active chip has a primary border, a greyer fill (rgb(218,225,244) against 217,233,255), a dark icon and a black × (buildable here, `catalogue-filter-chips.tsx`). No Featured or Brand chip: the connector syncs neither ("Catalogue"). The row's y and the chip height now match | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 12 of 13") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level inside a white bordered card ending 12 px from the cart pane: coloured folder icon, name, product count, chevron; rows about 59 px | List rows at the category level inside a white bordered card: coloured folder icon, name, product count, chevron; rows 59 px; drilling in gives a product table | close | The card ends at x775 against 785, 21 px from the cart pane against 12: the resize handle's 8 px sits inside the catalogue column (`panel-resize-handle.tsx`). The active In Stock chip over it is A7's bordered style (both buildable here). The rows and the card now match. Round 11 scored this row match without measuring the right edge | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet over a light backdrop: View Mode, Tile Size, Browse by (the chosen row tinted, with a primary bar at its left), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields (Product Name, Price), Restore Default Settings with dark text in a red border, Close | Right sheet under v2's header (a 16 px title and ×): View Mode, Tile Size, Browse by (the chosen row tinted, with a primary bar), Show out-of-stock products, Sort By and Direction, Variations, Tile Fields (Product Name, Price), Restore Default Settings in a red border, Close; 44 px footer buttons | close | The backdrop is near black (`bg-black/80`) against the demo's light shade (TallyUI). The switches are 44x24 against 36x20, and an off switch's track and the Tile Size slider's track are dark grey against light grey (TallyUI). The Variations Popover option is greyed out: Tally has no variations popover (TallyUI #719) | shared:@tallyui/components (DialogOverlay, Switch `size="sm"`, `--color-input`, not filed; TallyUI #719 popover) | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 12 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector (TallyUI #722) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), a 40 px search 14 px from the edge (v2's Auto scale picks Compact here), one scrolling chip row, Compact category tiles four to a row, "Shop base" and the count at the foot, bottom tab bar Products / Cart with a badge | Top bar (menu, store name, bell, avatar on white), a 44 px search and tiles 16 px from the edge (v2's source), one scrolling chip row, Compact category tiles four to a row with "All products" on two lines, the count with a sync icon at the foot, bottom tab bar Products / Cart with a "New" badge; the menu opens a drawer in the rail's tint | close | The search and glyphs are the Regular scale's 44 px and 18 px against the demo's Compact 40 and about 14: Tally has no scale setting (D5, TallyUI). The folder mark is 22x20 against 17x15 (buildable here). No scan button (A6) and no "Shop base" at the foot (A11). The edges and the bar now match | shared:@tallyui/theme (scale, not filed), shared:@tallyui/pos (TallyUI #720), connector (TallyUI #722) | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | White full-bleed pane: QTY / ITEM / PRICE / TOTAL headers; quantity in a bordered box; regular price struck through above the sale price | White pane inset 8 px: QTY / ITEM / PRICE / TOTAL headers; regular price struck through above the sale price ($5.00 over $4.00) | close | Each line keeps a row of −, +, Remove and Discount buttons under it, so only three lines fit above the totals. The quantity is plain text, not a box ("Cart") (TallyUI #677). The totals and the foot sit about 20 px in from the pane's edge against the demo's 8 (Subtotal at x829 against 807, ⋮ at x817 against 806): `CartTotal` and `CartFoot` set that inset (not filed) | shared:@tallyui/components (TallyUI #677; `CartTotal` inset, not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button, 56 px tall, with a 44 px ⋮ button beside it | One wide "Checkout $14.00" button, 48 px tall, with a 48 px ⋮ button beside it | close | Checkout is 48 px tall against 56 and the ⋮ 48 against 44: TallyUI's `CartFoot` fixes both at `min-h-12` (not filed) | shared:@tallyui/components (`CartFoot` heights, not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33"), then Checkout | Subtotal, then a bold Total row, then Checkout | close | A bold Total row sits between the lines and Checkout, where the demo has none: TallyUI's `CartTotal` always draws it. The per-rate tax lines could not be seen because the dev store charges no tax | shared:@tallyui/components (not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart: the name over the amount, an age in the warning tone on carts hours old, the open tab underlined, + at right | Tabs along the foot of the cart: "Guest" over "$14.00", the open tab underlined in the deep blue, + at right; tabs 51 px tall as the demo's | match | The age comes from the data: the demo's tabs are hours old, and Tally shows the same warning-tone age on a cart parked for an hour ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a 44 px "GU Guest" chip with a primary initials avatar and a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a 44 px "GU Guest" chip with a grey initials avatar; the chip opens a dropdown over the cart with Guest, "Search Customers" and customers with email | close | The dropdown's rows have no initials avatar: `CustomerSelect` has no row renderer (TallyUI #714). The chip's avatar is pale grey against the demo's primary (TallyUI #718). No location pin on the chip: that is A11's tax location ("Customers"). The chip height matches | shared:@tallyui/components (TallyUI #714, #718), connector (TallyUI #722) | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries. The + button and its glyph now match (12x12 against 12x11) | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price, quick discount keys −5%, −10%, −15% in primary text on one band, borderless keypad, check button | Popover on the line ("Price for Cold Brew"): amount, quick discount keys −5%, −10%, −15%, a keypad of bordered keys, Apply, Cancel | close | No struck regular price in the popover. The keys are bordered boxes where the demo's keypad is flat, and Apply / Cancel stand where the demo has one check. A separate inline "Discount on …" form with Percent / Amount is still on the line ("Cart": line edit) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet beside the rail over a light backdrop: Panel position, Open orders position, Sort items (select), Quick Discounts (−5% / −10% / −15% at 13 px semibold), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Left side sheet beside the rail over a light backdrop, under v2's header: Panel position, Open orders position, Sort items (select) with "Fees and shipping always stay last", Quick Discounts (−5% / −10% / −15% at 13 px semibold) with a hint, auto show and auto print receipt switches, Register sessions as a switch row with a two-line help, Restore Default Settings in a red border, Close; 44 px footer | close | No Columns section ("Cart") (TallyUI #695). The switches are 44x24 against 36x20, and an off track is dark grey (TallyUI) | shared:@tallyui/components (TallyUI #695, Switch `size="sm"`, `--color-input`) | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #689, awaiting release) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place: the parent tile (photo, name, price, "12 options", back chevron), then one tile per variation with its name, attribute chips ("32", "Blue") and price; the filter chips grey out; "12 options" at the foot | "T-Shirt" (6 options) drills in place: "Categories › All products › T-Shirt", the parent tile (image, name, price, "6 options", back chevron), then one tile per variation with its name, attribute chips ("S", "Black") and price; the Category chip leaves the row and On Sale and Tag dim, with v2's tooltip on hover; "6 options" with a sync icon at the foot | close | A5's crumb row: the crumb sits 9 px higher and the tiles 8 px lower than the demo's, and the tiles start at x72 against 76 (buildable here). A dev build still rejects the variable products when they sync (TallyUI #713, merged as #724, awaiting release). The chip row, the band (48.4) and the tile width (171 against 170) now match | | [demo](demo/variations-demo.jpg) · [tally](demo/variations-tally.jpg) |
| B12 | Phone cart (390x844) | Top bar; full-screen cart table, "Checkout $16.83"; one-line open-order tabs ("Guest $16.83") with a "3 ^" count, the open tab in view at the right; bottom tab bar | Top bar (menu, store, bell, avatar); full-screen cart table, Subtotal and a bold Total, ⋮ and "Checkout $4.00"; with three open orders, one-line tabs behind a "3 ^" count cell, the open tab whole at the right with + after it; bottom tab bar Products / Cart with a badge | close | Each line carries a row of −, +, Remove, Discount and Price controls, which take most of the height (TallyUI #677). The bold Total row (B3). Subtotal starts at x32 and the ⋮ at x20 against 7, and Checkout at x80 against 54: `CartTotal` and `CartFoot`'s inset (B1) | shared:@tallyui/components (TallyUI #677; `CartTotal` row and inset, not filed) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number (centred, 32 px customer chip), Customer, Billing address, Date created with a sort chevron, POS icon, Cashier, Payment method, Total; "TODAY" group heading; 57 px rows; narrow 44 px search with a settings, bell and avatar cluster; "Showing 20 of 29,754" with a sync icon | Table on a bordered card 12 px from the rail: Status dot, Order number (centred, 32 px customer chip), Customer, Date created with a sort chevron, Payment method, Total, chevron; TODAY / YESTERDAY group headings; 57 px rows centred on the chip; 40 px search with a sliders icon, bell and avatar; the sliders open "Order Settings", a right sheet with a Columns heading, six column switches, Restore Default Settings (red border) and Close on a 44 px footer; "Showing 25" with a sync icon | close | No Billing address, POS icon or Cashier column, and no "of N" total ("Order history") (connector). The search is 40 px against 44 (TallyUI). The Order Settings sheet's backdrop is near black and its switches larger (TallyUI). The 12 px inset and the 57 px centred rows now match; nothing buildable is left here | connector (columns; X-WP-Total, TallyUI #680), shared:@tallyui/components (Switch `size="sm"`, DialogOverlay, SearchInput height) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) · [tally settings](demo/orders-settings-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector (TallyUI #721) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "376" leaves one row, "Showing 1" | match | The box's 40 px height is counted in C1 | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #376": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The backdrop is near black (TallyUI). The tax breakdown was not seen (no tax) | connector, shared:@tallyui/components (DialogOverlay, not filed) | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: primary initials avatar, First name, Last name, Email, Billing address, Date created; narrow search with add-customer, settings, bell and avatar; "Showing 10 of 5,146" | Table on a bordered card 12 px from the rail: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; narrow search with add-customer, sliders, bell and avatar; the sliders open "Customer Settings" with column switches; "Showing 5" with a sync icon under the card | close | The avatars are pale grey where the demo's are solid primary (TallyUI #718). No Date created column: the connector's `Customer` has no created or modified dates. No "of N" total ("Customers": Customers screen). The search is 40 px (TallyUI). The 12 px inset now matches; nothing buildable is left here | connector (Customer dates, not filed; X-WP-Total, TallyUI #680), shared:@tallyui/components (TallyUI #718, SearchInput height) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu with bell and avatar; a white register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report with a printer icon); Today date menu, Everyone, Completed & processing, Print summary; a white hero with the big total, Orders, Average order, Items; vs yesterday; By hour / Running total (open segment rgb(217,234,250)) chart with a dashed comparison and a muted future bar; white Orders, Payments, Where sold cards | One bar over the page: "TallyUI WooCommerce dev store · Register 2BBF" with a bell and avatar. The page 12 px from the rail. One-row till strip ("Register 2BBF ● Open since 09:19 · cashier", Opening float + Cash sales = Expected in drawer, Print X-report, a chevron to Closures); "Today · Thu 12 Nov" with a chevron, "Everyone" chip, Print summary; big total with Orders, Average order, Items; "vs yesterday" beside By hour / Running total; Orders, Payments, Where sold cards | close | The till strip, the hero and the cards are bordered on the page grey where the demo's are white, and the open By hour segment is tinted rgb(228,234,248) against 217,234,250 (both buildable here). The scope title has no menu chevron: there is no store and register menu. No "Completed & processing" chip (left out: every local sale is complete). The date menu has no calendar. The dashed comparison and the muted future bar draw only when the day before has sales on this device. The 12 px inset now matches | connector (status chip, store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | On by default: Open register with a float; from the avatar's sheet, a centred "Register" dialog with "1 sale this session", Paid in / Paid out / No sale tiles, Expected in the drawer (Cash $114.00), Close register; then "Count the drawer" in the cart pane with denominations, Back to selling, Close register; then a closure ("Closure #1", Counted, Expected, Exact) with "Print the Z report" | close | The close step is a centred dialog with no big drawer amount, no Session sales total, no Other tenders row and no Cancel or Print X-report | shared:@tallyui/components (TallyUI #716) | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | Its own screen, "US Store · Front Counter ▾" header with bell and avatar, Today date menu and All cashiers chip: Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; day band; session row with Print X-report; tinted Export CSV with an icon | Its own room from the chevron at the end of the till strip: back arrow, "TallyUI WooCommerce dev store · Register 2BBF", bell and avatar; "Today · Thu 12 Nov", "All cashiers" chip, an outlined Export CSV with a document icon; Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; Today band "$114.00 counted · Exact"; "Closure 1 · Register 2BBF", 09:19 → 09:24, cashier, with Reprint | close | The scope title has no menu chevron. The date menu has no calendar. Export CSV is not counted: v2's `ClosuresExportButton` is outline with a document icon, as Tally's is | connector (store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Sub-nav beside the rail: General, Tax, Barcode Scanning, Theme; each page in a bordered panel | close | Printing, Card readers and Customer Display are absent (D6–D8) ("Settings area") | connector, pro | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | A two-column form with muted labels: editable Store Name; base country, state, city and postcode with "Set in WooCommerce · Open ↗"; Language select; Default Customer select; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals as fields | A flat two-column form with muted labels: Store Name, base country, state, city, postcode and Language ("English (US)") read-only with "Set in WooCommerce · Open ↗"; Default Customer as a customer chip; Default Customer is Cashier switch; currency rows read-only; Register sessions switch | close | Store Name, Language and the currency rows are read-only text with an Open link where the demo has fields and selects (connector). Default Customer is a chip, not a select ("Settings area"). The switches are larger, with a dark grey off track (TallyUI). The label, the ↗ icon and the language name now match | connector, shared:@tallyui/components (Switch `size="sm"`, `--color-input`) | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | A two-column form with muted labels: Calculation (Calculate tax based on as a select, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open ↗"); Display (Display Tax Totals, Display Prices in the Shop, Display Prices During Cart and Checkout as two-way segments, Price Display Suffix); Tax Rates with "View all tax rates", which opens "Tax Rates" (× in the header, underline class tabs with the count inline over a rule under the tabs, a seven-column rates table, "7 tax rates" with a sync icon, Close) | A flat two-column form with muted labels: Calculation (Calculate tax based on, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open ↗"); Tax Rates ("No tax rates apply at the store's address.") with "View all tax rates", which opens an 800 px right sheet "Tax Rates" with a 44 px ×: underline tabs "Standard 0 / Reduced rate 0 / Zero rate 0", the open one underlined in primary, "No rates in this class", "0 tax rates" and Close | close | No sync icon by the rate count, and the tabs' rule runs the sheet's full width with the tabs inset 8 px, against a rule under the tabs only (buildable here). No Display section (the tax display settings are not synced). "Standard" against "Standard rate": the connector has the class slugs only (not filed). The sheet's backdrop is near black, and the switches are larger with a dark grey off track (TallyUI). Enable Taxes is off and there are no rates, from the data. The title, the ×, the underline tabs and the inline counts now match | connector (tax display settings; tax class names, not filed), shared:@tallyui/components (DialogOverlay, Switch `size="sm"`) | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) · [demo rates](demo/tax-rates-demo.jpg) · [tally rates](demo/tax-rates-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Sound ("Play a sound on scan"); Barcode Scanning Test | close | No Scanner section ("Scanning") | shared:@tallyui/pos (TallyUI #682) | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | "Current Theme: Light"; ten theme cards each with an icon, from y179: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall; a Scale section (Auto / Compact / Regular / Spacious); an Icons section (Match theme, Tabler 1.5, Hugeicons, Phosphor …) | "Following system theme" under System, "Current Theme: Ocean" under Ocean; the same ten theme cards, each with an icon, in a flat grid from y179. Choosing Ocean recolours the whole app, and System puts it back | close | No Scale or Icons section (TallyUI, not filed). The card spacing now matches | shared:@tallyui/theme (scale and icon sets, not filed) | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) · [tally Ocean](demo/theme-ocean-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | connector (TallyUI #681) | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | shared:@tallyui/pos (TallyUI #679) | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | connector, pro (TallyUI #684). ADR-085: U7, the fork routes, is TallyUI/woocommerce-pos#1, waiting for the desk; U8, the app wiring, comes after the TallyUI batch release; the Woo connector's `displaySignalling` belongs to the tallyui worker | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; a flat table with uppercase muted headers, row rules and rows about 61 px: Collection / On device / On server / Coverage bar / Size with ⋮ per row, its subtitle in the header | Sub-nav Database / Logs; "✓ Ready to sell", records on this device, storage used, changes waiting to send; a bordered inner box with "Collection / On device" headers in semibold; "Check for changes now" | close | The table is a boxed list with semibold headers where v2's is a flat table with uppercase muted headers, row rules and about 61 px rows, the subtitle in its header (buildable here, `database-counts.tsx`). No Performance entry in the sub-nav (D10). No On server, Coverage or Size columns (connector). The dev store had no stuck records, so the attention banner was not seen ("Store health") | connector | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | shared:@tallyui/database (TallyUI #683) | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; 44 px Search Logs; rounded All / Actions / Errors / Sync chips, the open one a borderless blue tint; verbose diagnostics toggle; Time / Level / Event / Duration / Status rows with a chevron; "Showing 46 of 46" and a "next check" line at the foot | Under Store health: the same four figures; Copy debug info; 40 px Search Logs; rounded All / Actions / Errors / Sync chips; "Verbose diagnostics: off"; Time / Level / Event / Duration / Status rows with a chevron ("Order accepted by the store", "Register session opened") | close | The open chip has a primary border (A7's style, buildable here, `logs-screen.tsx`). The search is 40 px (TallyUI). No "next check" line at the foot. Sync runs write no row; the demo logs them ("Loaded the records this screen needs") | shared:@tallyui/database (TallyUI #683), shared:@tallyui/components (SearchInput height) | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail in a bordered panel: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status dot, categories, prices right-aligned, regular and sale price; cells centred on the row; chips In Stock, Featured, On Sale, Category, Tags, Brands; narrow search with a settings, bell and avatar cluster; "Showing 10 of 209" | Table from the rail on a bordered card: image, name, stock, stock status dot, categories, price, regular and sale price; a variable product shows its attribute links and "1 variation" / "6 variations ›" under its name, drilling to "Products › T-Shirt" with one row per variation; chips Stock Status, On Sale, Category, Tag; narrow search with a sliders icon, bell and avatar; the sliders open "Product Settings" with column switches; "Showing 13 of 13" with a sync icon under the card | close | The prices are left-aligned, the cells sit at the top of the row, a header wraps to two lines and the image column is headed "IMAGE" where v2's is unlabelled (buildable here). The product name is plain text, not v2's inline field, and stock is plain text with no Manage toggle (no product writes in the connector). No Featured or Brands chip | connector | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) · [tally drilled](demo/products-drill-tally.jpg) |
| D13 | Coupons area | Table from the rail in a bordered panel: Active dot, Code, Amount (right-aligned), Type, Description, Usage (centred), Expiry date, inline edit; cells centred on the row; chips Status, Discount Type, Expires; + to add; narrow search with an icon cluster | Table from the rail on a bordered card: Active dot, Code, Amount, Type, Description, Usage, Expiry date; chips Status, Discount Type, Expires; narrow search with a sliders icon, bell and avatar; the sliders open the coupons' column settings; "Showing 10 of 10" with a sync icon under the card | close | Amount is left-aligned, Usage is not centred and the cells sit at the top of the row (buildable here). No + to add a coupon and no inline edit (the connector has no coupon writes). No calendar behind Expires | connector, shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order 20176e4d · #376, cashier, "Register: Register 2BBF") with Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Phone drawer | The demo's phone drawer was never captured | The menu opens a 200 px drawer in the rail's tint (the selected item white with a primary label) listing POS, Orders, Customers, Reports, Store health and Settings; Products and Coupons, which the window's rail has, are not in it. [drawer](demo/drawer-tally.jpg) shows the window's rail |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #376 (local id 20176e4d) on the
local dev store, at 09:21. It was a cash sale of $14.00 for two Croissant,
one Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as
change. Orders #367 to #375 in the list were not made by this round.

Register sessions were also exercised, with sessions on by default and no
switch touched:

- A fresh till showed the Open register card. A session was opened at
  09:19 with a $100.00 float, took order #376, and was closed at 09:24
  with an exact count of $114.00 (Closure 1 · Register 2BBF).
- A second session was then opened with a $100.00 float for the phone
  capture and left open.
- The sessions exist only in the capture browser's profile.

Three open orders were left on the phone till for B12, as unpaid carts in
the capture browser's profile; none was sent to the store: Guest $3.50
(2ae56ee9-2f47-441f-8f25-e79bca1174a8), Guest $3.00 (b9f59426…) and
Guest $4.00 (3dffab59…), with a blank cart open. A cart takes a new local
id when another tab is chosen, which is also when it moves to the end of
the strip.

## Next for this repo

The gaps that can still be built here, in the order a cashier would notice
them. Round 11's list is done by #250 to #255, except the cart totals
inset, which now waits on TallyUI's `CartTotal` and `CartFoot`. Gaps that
wait on TallyUI or the connector are left out.

1. **Active filter chip** (A7, A1, A9, D11). Draw the active chip as v2's
   borderless tint (about rgb(217,233,255)) with a primary icon and a
   muted ×, in `catalogue-filter-chips.tsx`, `menu-chip.tsx` and
   `logs-screen.tsx` (all three use `border-primary bg-primary/10`
   today).
2. **Catalogue right edge and tile gutter** (A6, A9, A5, A1). Keep the
   resize handle's 8 px out of the catalogue column so the search row and
   the table card end 12 px from the cart pane (x786), and start the
   tiles at x76 (12 px from the rail, as the search box).
3. **Crumb row** (A5, B11). Tighten the row between the chips and the
   tiles: the crumb 9 px lower (ink at y140) and the first tile row 8 px
   higher (y124 at the root, y168 drilled).
4. **Category folder mark** (A5, A12). About 20 px per v2's source (the
   demo's pixels read 18x16 in a window, 17x15 on a phone), against 22.
5. **Cashier sheet** (A4). A 17 px content inset; "Your sales today" and
   "In the drawer" in the muted foreground at v2's smaller size; the
   drawer figure larger; "by" plus the avatar without the name; v2's
   tighter gaps (23 px from the card to "HAND THE TILL TO").
6. **Reports surfaces** (C6). `bg-card` on the till strip, the hero and
   the report cards, and v2's open-segment tint in `segmented.tsx`.
7. **Products and coupons tables** (D12, D13). Prices and Amount
   right-aligned, Usage centred, cells centred on the row, headers on one
   line, and no "IMAGE" label.
8. **Store health table** (D9). v2's flat table: uppercase muted headers,
   row rules, about 61 px rows, the subtitle in the header and no inner
   box (`database-counts.tsx`).
9. **Tax rates sheet** (D3). A sync icon by the rate count, and the tab
   rule under the tabs only, without the 8 px tab inset.
