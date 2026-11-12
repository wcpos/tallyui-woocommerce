# Demo parity: Tally Woo against demo.wcpos.com/pos

- Date: 2026-11-12
- Tally Woo: `main` at `b8f48454547b640791c223338dec8ad8f776718a` (after #272, `@tallyui/*` 3.19.0), served as a production bundle
- Demo: WCPOS `v 2.0.0` (the version shown under the demo's rail), US Store · Front Counter
- Viewport: 1280x800; the two phone rows are 390x844
- Round: 14 (partial). The rows that #265 to #272 and the `@tallyui/*`
  3.19.0 bump touched (A4, A7, A10, B1, B7, B9, B12, D2, D9, D13) were
  recaptured and re-scored with round 13's strictness; every other row
  keeps round 13's image and score. Where v2's source and the demo's pixels
  differ by a pixel or two, the source is cited and the difference is not
  counted. No row reached match: each one still has a gap that waits on
  TallyUI or the connector
- Score: `PARITY tally-woo 8/45 (match 8, close 28, differs 0, missing 7, deferred 2)`
- Round 13: 8/45 (match 8, close 30, differs 0, missing 7)
- Round 12: 5/45 (match 5, close 33, differs 0, missing 7)
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

Round 14 follows #265 to #267 and #272, which cover round 13's four "Next
for this repo" items, and the `@tallyui/*` 3.19.0 bump (#271). The cashier
sheet's header and footer sit where the demo's do (A4). The active chip's ×
has v2's spacing and size (A7). The coupons head is 45 px (D13). Store
health draws its subtitle small and muted under "Database" in the page
heading, has a ⋮ in the Products row and a rule under the figures (D9).
From 3.19.0: the switches are v2's 36x20 with a light off track (A10, B9,
D2); cart lines lose their row of −, +, Remove and Discount buttons (B1,
B12); and the line's price popover shows the struck regular price and a
Discount button in place of the inline discount form (B7). Each of these
rows keeps another gap that waits on TallyUI (#677 quantity box and flat
keypad, #695 columns, #719 popover, #779 scrim, #780 slider track, #781
Total row, `CartTotal`'s inset) or the connector, so the score holds at
8/45. A12 (phone catalogue) and D5 (Theme) are deferred to their own ADR (front desk ruling, 2026-11-12; TallyUI ADR-087): themes, icon sets and fonts come after selling, payments, refunds and reports reach parity, so they no longer count as open gaps. The one gap still buildable here is A4's 4 px (below).

Round 13 follows #257 to #263, which cover round 12's nine "Next for this
repo" items. The catalogue now matches the demo's: the search row and the
table card end 12 px from the cart pane, the tiles start at x76, the crumb
row puts the first tiles at y124 (y168 drilled), and the folder mark is
v2's 20 px. A5, A9 and B11 move to match. The active filter chip is v2's
borderless blue tint with the selected ink on its icon, label and × (A7,
D11, D13). The cashier sheet has the 17 px inset, muted 13 px labels, an
18 px figure, "by" plus the avatar and an 18 px gap to "HAND THE TILL TO".
Reports' strip, hero and cards are white and the open segment takes v2's
tint. The coupons table right-aligns Amount, centres Usage and centres its
cells on the row. The products table centres its cells and leaves the image
column unlabelled. Store health is a flat table with uppercase muted
heads, and the tax rates sheet has its sync icon and a rule under the
tabs only. What is left to build here is small: the active chip's ×
spacing, the cashier sheet's vertical padding, the coupons head height and
three details on the Store health page. The rest of the close rows wait on
TallyUI or the connector.

Register sessions: a front desk ruling of 2026-11-11 supersedes the
2026-10-06 ruling that made sessions opt-in. Paul's target is "look and
function like demo.wcpos.com/pos", so Tally Woo turns sessions on for a
till with no saved choice. A till that saved a choice keeps it. The switch
is also in Settings › General, where it can be reached while the register
is closed. The default is set in this app only; the shared TallyUI packages
keep theirs, so Medusa POS and Vendure POS do not change. Round 13, like
rounds 7 to 12, captured A4, C6, C7 and C8 with that default: the register
opened, sold and closed with no switch touched.

Register name: a Tally till has one register. v2 adds the register to the
bar's place only when the store has more than one
(`register-bar.helpers.ts`), so the demo's "· Front Counter" comes from its
data, and a bar that reads the store alone is v2's single-register look.
Since #219 the till strip, the session card, the closures header and the
prints name the register ("Register 5979" in this round's fresh profile).

Production bundle: round 13, like rounds 6 to 12, served Tally Woo from `pnpm
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
  `CartFoot` set their own inset: Subtotal sits at x831 and the ⋮ at x819
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
  Logs' are still 40 px (C1, C3, C5, D11, D13).
- `@tallyui/connector-woocommerce`'s `StoreSettings.taxClassSlugs` carries
  the tax classes' slugs only, so the tax-rates sheet names the standard
  class "Standard" where v2 reads "Standard rate" (D3).
- `@tallyui/components`' `ProductTableColumn` takes no `align`, its heads
  wrap, and it sets its own cell padding. The products table's prices
  start at the cell's left edge where v2's are right-aligned, and "Regular
  Price" wraps to two lines, so the head is 57 px against v2's 44 px
  one-line, truncated heads (D12).
- `ProductTable` gives a column with an empty `header` no accessible name:
  the image column is unlabelled, as v2's is, but a screen reader reads
  nothing for its head (D12).
- `@tallyui/pos`' `useStoreSettings` has no refresh. The tax-rates sheet's
  sync icon is drawn as v2's (a 24 px ghost button holding a 14 px glyph by
  "0 tax rates") but is disabled, since nothing can re-fetch the rates
  (D3).

Nothing left the list since round 12.

Round 13 ran the brief's eight checks on both sides. Tally was measured in
its DOM and off its new images; the demo off its existing images with a
pixel scan. Both are at 1280x800 unless marked phone.

1. **Chips** (A7, A1, D11, D13, C6):

   | Measure | Tally | Demo |
   |---|---|---|
   | Active chip fill (catalogue In Stock) | `bg-selected`, pixels rgb(217,233–234,255) | rgb(217,233,255) |
   | Active chip border | the fill's colour, so none shows | none |
   | Icon, label and × ink | `text-selected-foreground`, darkest about rgb(26,62,148) | primary ink on the icon and label; the × about rgb(38,68,122) |
   | Active chip width | 120 | 140 |
   | Label to the × centre | 13.5 px | 29.5 px |
   | × mark | 8x8 | 10x10 |
   | Off chips | white with a border | white with a border |
   | Reports cashier chip (on), Logs "All", coupons "Published" | the same tint and ink | the same tint (Logs, coupons not opened on) |

   The fill, the edge and the ink now match on every chip. The demo's ×
   reads a shade lighter, but v2's `chip/index.tsx:106` gives the × the
   label's ink, so it is not counted. Left: the × sits 16 px closer to the
   label and is 2 px smaller, which makes the chip 20 px narrower
   (`catalogue-filter-chips.tsx`, `coupons-screen.tsx`).
2. **Catalogue edges and the handle** (A5, A6, A9, B11, A12):

   | Measure | Tally | Demo |
   |---|---|---|
   | Search row's right end | x785.8 (the settings button) | x786 |
   | Table card's right edge | white to x784, border x785 | white to x784, border x785 |
   | Cart pane's white | from x799 | from x798 |
   | Resize handle | 12 px, x785.8–797.8 | between the card and the pane |
   | First tile, root and drilled | x76, y124 and y168 | x76, y124 and y168 |
   | Crumb row and crumb ink (drilled) | 44 px from y116, ink y139–152 | ink y141–153 |
   | Tiles | 171 wide, 9–10 px apart, the last to x785 | 170 wide, 8 apart, the last to x779 with its stack to x785 |
   | Back badge | 28 px (`h-7`), about 29 in the pixels | about 26 in the pixels |
   | Category folder mark | 20x20 (v2's source) | 18x16; 17x15 on a phone |

   Dragging the handle moved its `aria-valuenow` from 60 to 53 (the cart
   pane's left edge from x798.8 to x719.7); a double-tap put it back to 60
   (x798.8). The edges, the crumb row and the tiles now match. The 1–3 px
   tile, gap and badge differences and the folder mark (v2's source 20 px)
   are not counted.
3. **Cashier sheet** (A4):

   | Measure | Tally | Demo |
   |---|---|---|
   | Content inset | 17 (the card at x785) | 17 (x785) |
   | "Your sales today", "In the drawer" | 13 px/400, muted lab(36.2) | smaller, muted rgb(86,85,90) |
   | Drawer figure | 18 px/700 | 18 px ink |
   | Opener line | "opened 10:55 by" plus the 28 px primary avatar | "Front Counter · opened 03:12 by" plus the avatar |
   | Card bottom to "HAND THE TILL TO" ink | 18 px (y220 → 238) | 18 px (y216 → 234) |
   | Switch band | `mt-2`, 28 px | 8 px gap, 28 px |
   | Vertical padding | 24 (DialogContent's `py-6`) | 16 |
   | Header name ink, drawer card top | y26, y118 | y18, y114 |
   | Sign out | y731–775 | y740–783 |

   Register actions on the sheet: the drawer card is a button ("In the
   drawer, $100.00") that leads to Pay in · Pay out · Close register; the
   other buttons are Close (×), "+ Another account…", WordPress Admin,
   Sign out and Close. The inset, the labels, the figure, the opener
   ("by" plus the avatar; "Front Counter ·" is the demo's register data)
   and the gap now match. Left: the 24 px vertical padding puts the header
   8 px lower and the footer 8 px higher than the demo's. Waiting: no
   store or register switch, no "since" time, no Desktop App (connector),
   and the near-black backdrop (`DialogOverlay`, TallyUI).
4. **Reports** (C6):

   | Measure | Tally | Demo |
   |---|---|---|
   | Page | lab(96.5), about rgb(244,245,249) | rgb(244,245,249) |
   | Till strip, hero | white (lab 100; 255 in the pixels) | white |
   | Orders, Payments, Where sold cards | white | white |
   | Open "By hour" segment | `bg-selected` lab(92.27), selected ink | rgb(217,234,250) |
   | Other segment | transparent, muted ink | transparent, muted ink |

   Match on the surfaces and the segment. C6 stays close for its scope
   menu, Completed chip and calendar.
5. **Tables** (D12, D13, C1):

   | Measure | Tally | Demo |
   |---|---|---|
   | Coupons Amount | right-aligned: head text x438–492, cells x464–492 in a cell x346–504 with `px-3` | right-aligned |
   | Coupons Usage | centred: head x1010–1051 and cells x1016–1045 in x952–1110 | centred |
   | Coupons cells on the row | centred (mid 24.9 of a 50.8 px row) | centred |
   | Coupons head | 40 px | about 44 (y125–169) |
   | Coupons rows | follow their content (32 px, 51 when the description wraps) | 57, holding inline edit fields |
   | Products image head | blank | blank |
   | Products cells on the row | centred (mid 36 of 73) | centred |
   | Products prices | left-aligned, from the cell's left edge | right-aligned |
   | Products head | 57.4 px ("Regular Price" on two lines) | 44, one line, truncated |
   | Orders rows | 57 px, centred | 57, centred |

   The coupons table now matches but for its 40 px head (buildable here,
   `coupons-screen.tsx` `HEAD`); its row heights follow from the demo's
   inline fields (connector). The products table's prices and head wait on
   `ProductTableColumn`'s `align`, one-line heads and cell padding, and
   the blank image head needs an accessible name (TallyUI, not filed).
6. **Store health** (D9):

   | Measure | Tally | Demo |
   |---|---|---|
   | Table | flat: no border, no fill | flat |
   | Head | 44 px over a 1 px rule; 12 px/500 uppercase, 0.3 px tracking, muted | uppercase, muted, over a rule |
   | Rows | 61 px with 1 px rules; Products 80 px | about 61 px with rules |
   | Per-row action | "Check for changes now" inside the Products row | a ⋮ on each row |
   | Subtitle | black body text above the figures | small and muted under "Database" in the header |
   | Rule under the figures | none | y150 |

   The table now matches. Left: the subtitle, the inline Check button and
   the rule under the figures (buildable here, `health-screen.tsx`,
   `database-counts.tsx`). Waiting: On server, Coverage and Size columns
   (connector) and the Performance entry (D10).
7. **Tax Rates** (D3):

   | Measure | Tally | Demo |
   |---|---|---|
   | First tab | x505 (x25 in the dialog) | x505 |
   | Tab rule | 1 px, border colour, under the tabs only (x25–337 in the dialog) | under the tabs only |
   | Sync icon | a 24 px ghost button, a 14 px muted glyph at x570–584, by "0 tax rates" | glyph at x571–583 |

   Match on the tabs, the rule and the icon. The icon is disabled: nothing
   in `useStoreSettings` can refresh the rates (TallyUI, not filed). Left,
   all waiting: "Standard" against "Standard rate" (connector), no Display
   section (connector), the backdrop and the switches (TallyUI).
8. **Cart totals** (B1, B12), kept as waits on TallyUI's `CartTotal` and
   `CartFoot`:

   | Measure | Tally | Demo |
   |---|---|---|
   | Subtotal, ⋮ (1280) | x830.8, x818.8 (32 and 20 from the pane) | x807, x806 |
   | Checkout, ⋮ heights | 48, 48 | 56, 44 |
   | Phone: Subtotal, Checkout, ⋮ | x32, x20 (350 wide), none in view | x7, x7, x54 |

   Unchanged from round 12.

Also measured: the rail and the bar are as round 12's (match); the area
surfaces start 12 px from the rail; Settings › General's labels and the
Theme cards from y179 are as round 12's; on a phone the search is 44 px
and the tiles start at x16 (v2's source, not counted).

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
- This round's sale sold the last Croissant, so later captures show 11
  products in stock ("3 categories · 11 products" on the phone) and the
  phone carts use other items. That is data only.
- The demo was not opened this round: the demo images are round 1's,
  except D3's tax-rates dialog from round 11. All 43 Tally images were
  recaptured in a fresh browser profile after the first sync ("3
  categories · 12 products"), then measured in the DOM and off the
  images; five (customers and four Settings pages) came out byte for byte
  as round 12's. The areas' settings panels were not opened on the demo,
  so the panels themselves are held to the demo's Product settings chrome.

## First screen

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| A1 | First screen after sign-in | Icon rail at left, filter chips, category tiles, empty cart "Tap a product to start a sale", open-order tab at the foot of the cart | Icon rail in v2's tint, one row of filter chips with In Stock in v2's borderless tint, category poster tiles; the register bar heads the cart column. On a new till the white cart pane has an "Open register" card under a "Register closed" pill. Once the register is open: a "GU Guest" chip with + and a sliders icon; an empty QTY / ITEM / PRICE / TOTAL cart "Scan or tap a product to start a sale." with Subtotal, Total and a disabled "Checkout $0.00"; "+ New" tab at the foot | close | A new till first asks for the opening float (the demo's register was already open, so its open step was not seen). The empty cart shows column headers, zero totals and a disabled Checkout where the demo shows only a cart icon and its message (merged in TallyUI as #723, awaiting release). The totals and foot sit 20 px in against 8 (TallyUI, B1). No location pin beside the customer chip (A11). The rail, the bar, the chip's tint, the catalogue's edges, the page and the white cart pane match | shared:@tallyui/components (TallyUI #694, awaiting release; `CartTotal` inset, not filed) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A2 | Area navigation | Permanent left icon rail: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health, Settings, Support at the foot; "v 2.0.0" | Permanent left icon rail in rgb(228,234,245), the selected item white with a primary glyph: POS, Products, Orders, Coupons, Customers, Reports at the top; Store health and a Settings gear at the foot; "v 0.1.0" | match | No Support entry, left out on purpose | | [demo](demo/drawer-demo.jpg) · [tally](demo/drawer-tally.jpg) |
| A3 | Register bar | "US Store · Front Counter" over the cart, with a small bell and a 20 px "BR" initials avatar | "TallyUI WooCommerce dev store" with a bell and a 20 px "CA" initials avatar on the bar's white, as the cart column's first row. A "Register closed" pill joins the bar while the register is closed. On a phone, one bar sits over both tabs. The avatar's sheet is the door to the register panel | match | The bell is v2's 18 px source glyph, 2 px taller than the demo's pixels, and its button is 40 px against 44, which moves it 6 px: not visible. The store alone, with no register name, is v2's look for a store with one register | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A4 | Cashier sheet | Right sheet: avatar and × in the header, name, "US Store · Front Counter · since 14:40 · 1 m", Your sales today, a drawer card with a register disc ("In the drawer", "Front Counter · opened 03:12 by" an avatar, $2,996.12, "Pay in · Pay out · Close register"), an uppercase "HAND THE TILL TO" heading with "+ Another account…" as a plain row, Store and Register with Switch, WordPress Admin and Desktop App links with icons; Sign out (outline, red border) and Close in the footer | White right sheet inset 17 px: avatar and × in the header, "cashier" and the store, "Your sales today" as a muted 13 px label, a white drawer card with a 44 px register disc (muted "In the drawer", "opened 14:31 by" and a primary avatar, an 18 px bold $100.00) and "Pay in · Pay out · Close register", an uppercase "HAND THE TILL TO" heading 18 px under the card with "+ Another account…" as a row, WordPress Admin with an icon; Sign out (outline, red border) and Close in the footer | close | Everything from "Your sales today" down to the till heading sits 4 px high: the label's ink at y87 against 91, the drawer card at y110 against 114, the heading at y234 against 238 (buildable here, `cashier-sheet.tsx`). The backdrop takes the page, rail included, nearly to black (TallyUI #779). No store or register switch, no "since" time, no Desktop App ("Registers"). The header and the footer now sit where the demo's do (#265), and the inset, the muted labels, the figure and "by" plus the avatar match | connector, shared:@tallyui/components (TallyUI #779 scrim) | [demo](demo/cashier-sheet-demo.jpg) · [tally](demo/cashier-sheet-tally.jpg) |
| A5 | Catalogue grid | Coloured category poster tiles (Clothing 160 products, Gear 45 …); "All products" drills in to a blue "All products" tile with a back chevron, then full-bleed product photos with name, price and "12 options"; tiles 170 px wide with a 48 px band, from x76, the first row at y124 | Coloured category poster tiles (All products, Bakery 2 products …); "All products" drills in to "Categories › All products" with the "All products" tile and its back chevron in slot 0, then full-bleed images, name, price and "1 option" under a variable product's price, and an in-cart count badge; tiles 171 px wide with a 48.4 px band, from x76, the first row at y124 (y168 drilled) | match | The crumb row, the tiles' left edge and the column's right end now match. The folder mark is 20x20, v2's source size, against 18x16 in the demo's pixels; the tiles are 171 wide and 9–10 px apart against 170 and 8, and the back badge is 28 px against about 26: 1–3 px each, not counted | | [demo](demo/catalogue-demo.jpg) · [tally](demo/catalogue-tally.jpg) |
| A6 | Product search | "Search products" 44 px tall, 12 px from the rail and the top, with scan, list/grid and settings icons beside it | "Search products" 44 px tall, 12 px from the rail and the top, with 44 px list/grid and settings icons (18 px glyphs, v2's source size) beside it; the row ends at x786 | close | No scan button (TallyUI #720). The row's right end now matches. The dev store has no "shirt", so the result grids cannot be compared | shared:@tallyui/pos (TallyUI #720) | [demo](demo/search-demo.jpg) · [tally](demo/search-tally.jpg) |
| A7 | Filter chips | Rounded chips about 44 px tall at y68, always shown: In Stock (on by default: a borderless blue tint, primary icon, muted ×), Featured, On Sale, Category, Tag, Brand; drilled in, the Category chip leaves the row | Rounded 44 px chips at y68 in one row: In Stock (on by default: a borderless rgb(217,234,255) tint, the icon, label and × in the selected ink), On Sale, Category, Tag; the chips are chosen in Product settings. Drilled in, the Category chip leaves the row | close | No Featured or Brand chip: the connector syncs neither ("Catalogue"). The × now has v2's spacing and size (#266): the active chip is 138.3 px wide against 140 and the × centre 28 px from the label against 29.5; the last 1.5 px has no cause found in v2's `chip/index.tsx` and is not counted. The tint, the borderless edge and the ink match; the demo's × reads a shade lighter, but v2's `chip/index.tsx:106` gives it the label's ink, so that is not counted | connector | [demo](demo/filter-bar-demo.jpg) · [tally](demo/filter-bar-tally.jpg) |
| A8 | Out-of-stock products | Hidden by the default In Stock chip | Hidden by the default In Stock chip ("Showing 12 of 13") | match | | | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A9 | Table view | List rows at the category level inside a white bordered card ending 12 px from the cart pane: coloured folder icon, name, product count, chevron; rows about 59 px | List rows at the category level inside a white bordered card ending at x785, 12 px from the cart pane: coloured folder icon, name, product count, chevron; rows 59 px; drilling in gives a product table | match | The card's right edge now matches (white to x784, border at x785 on both). The active chip's × spacing is counted in A7 | | [demo](demo/table-view-demo.jpg) · [tally](demo/table-view-tally.jpg) |
| A10 | Product settings | Right sheet over a light backdrop: View Mode, Tile Size, Browse by (the chosen row tinted, with a primary bar at its left), Show out-of-stock products, Sort By and Direction, Variations (Open in place / Popover), Tile Fields (Product Name, Price), Restore Default Settings with dark text in a red border, Close | Right sheet under v2's header (a 16 px title and ×): View Mode, Tile Size, Browse by (the chosen row tinted, with a primary bar), Show out-of-stock products, Sort By and Direction, Variations, Tile Fields (Product Name, Price), Restore Default Settings in a red border, Close; 36x20 switches with a light grey off track; 44 px footer buttons | close | The backdrop is near black (`bg-black/80`) against the demo's light shade (TallyUI #779). The Tile Size slider's track is dark grey against light grey (TallyUI #780). The Variations Popover option is greyed out: Tally has no variations popover (TallyUI #719). The switches now match (3.19.0) | shared:@tallyui/components (TallyUI #779 scrim, #780 slider track, #719 popover) | [demo](demo/product-settings-demo.jpg) · [tally](demo/product-settings-tally.jpg) |
| A11 | Tax location and catalogue count | Foot of the catalogue: "Shop base" tax location menu at left; "6 categories · 100 products" with a sync icon at right | Foot of the catalogue: "3 categories · 12 products" with a sync icon at right; nothing at left | missing | No way to switch the tax location from the POS screen. The count and sync icon match ("Tax") | connector (TallyUI #722) | [demo](demo/first-load-demo.jpg) · [tally](demo/first-load-tally.jpg) |
| A12 | Phone catalogue (390x844) | Top bar (menu, "US Store · Front Counter", bell, avatar), a 40 px search 14 px from the edge (v2's Auto scale picks Compact here), one scrolling chip row, Compact category tiles four to a row, "Shop base" and the count at the foot, bottom tab bar Products / Cart with a badge | Top bar (menu, store name, bell, avatar on white), a 44 px search and tiles 16 px from the edge (v2's source), one scrolling chip row, Compact category tiles four to a row with "All products" on two lines and 20 px folder marks, the count with a sync icon at the foot, bottom tab bar Products / Cart with a "New" badge; the menu opens a drawer in the rail's tint | deferred: ADR | The search and glyphs are the Regular scale's 44 px and 18 px against the demo's Compact 40 and about 14: Tally has no scale setting (D5, TallyUI). No scan button (A6) and no "Shop base" at the foot (A11). The folder mark is v2's 20 px source size against 17x15 in the pixels, not counted | shared:@tallyui/theme (scale, not filed), shared:@tallyui/pos (TallyUI #720), connector (TallyUI #722) | [demo](demo/phone-catalogue-demo.jpg) · [tally](demo/phone-catalogue-tally.jpg) |

## Sale flow

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| B1 | Cart lines | White full-bleed pane: QTY / ITEM / PRICE / TOTAL headers; quantity in a bordered box; regular price struck through above the sale price | White pane inset 8 px: QTY / ITEM / PRICE / TOTAL headers; compact lines; regular price struck through above the sale price ($5.00 over $4.00) | close | The quantity is plain text, not a box ("Cart") (TallyUI #677). The totals and the foot sit about 20 px in from the pane's edge against the demo's 8 (Subtotal at x831 against 807, ⋮ at x819 against 806): `CartTotal` and `CartFoot` set that inset (not filed). The row of −, +, Remove and Discount buttons under each line is gone (3.19.0), so the lines are as compact as the demo's | shared:@tallyui/components (TallyUI #677; `CartTotal` inset, not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B2 | Pay button | One wide "Checkout $16.83" button, 56 px tall, with a 44 px ⋮ button beside it | One wide "Checkout $14.00" button, 48 px tall, with a 48 px ⋮ button beside it | close | Checkout is 48 px tall against 56 and the ⋮ 48 against 44: TallyUI's `CartFoot` fixes both at `min-h-12` (not filed) | shared:@tallyui/components (`CartFoot` heights, not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B3 | Totals | Subtotal, then one line per tax rate ("US excl $1.50", "US AL excl $0.33"), then Checkout | Subtotal, then a bold Total row, then Checkout | close | A bold Total row sits between the lines and Checkout, where the demo has none: TallyUI's `CartTotal` always draws it. The per-rate tax lines could not be seen because the dev store charges no tax | shared:@tallyui/components (not filed) | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B4 | Open orders | Tabs along the foot of the cart: the name over the amount, an age in the warning tone on carts hours old, the open tab underlined, + at right | Tabs along the foot of the cart: "Guest" over "$14.00", the open tab underlined in the deep blue, + at right; tabs 51 px tall as the demo's | match | The age comes from the data: the demo's tabs are hours old, and Tally shows the same warning-tone age on a cart parked for an hour ("Cart": open-order tabs) | | [demo](demo/cart-demo.jpg) · [tally](demo/cart-tally.jpg) |
| B5 | Customer | "Customer" label and a 44 px "GU Guest" chip with a primary initials avatar and a location pin; the chip opens a dropdown over the cart with "Search Customers", Guest, and customers with initials and email | "Customer" label and a 44 px "GU Guest" chip with a grey initials avatar; the chip opens a dropdown over the cart with Guest, "Search Customers" and customers with email | close | The dropdown's rows have no initials avatar: `CustomerSelect` has no row renderer (TallyUI #714). The chip's avatar is pale grey against the demo's primary (TallyUI #718). No location pin on the chip: that is A11's tax location ("Customers"). The chip height matches | shared:@tallyui/components (TallyUI #714, #718), connector (TallyUI #722) | [demo](demo/customer-demo.jpg) · [tally](demo/customer-tally.jpg) |
| B6 | Add to the order | + icon menu: Add new customer, Add Miscellaneous Product, Add Fee, Add Discount, Add Shipping | + icon menu: Add new customer, Add charge, Add discount. Add charge opens a dialog with Fee / Shipping / Custom item and a tax class | close | Fee, shipping and the miscellaneous product are one "Add charge" entry with a kind switch, not three menu entries. The + button and its glyph match (12x12 against 12x11) | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/add-item-tally.jpg) |
| B7 | Line price and discount | Popover on the line: regular price struck through, price, quick discount keys −5%, −10%, −15% in primary text on one band, borderless keypad, check button | Popover on the line ("Price for Cold Brew"): $5.00 struck through over the $4.00 price, quick discount keys −5%, −10%, −15%, a keypad of bordered keys with ⌫, a Discount button, Apply, Cancel | close | The keys are bordered boxes where the demo's keypad is flat, and Apply / Cancel stand where the demo has one check. The struck regular price is now in the popover, and the separate inline "Discount on …" form has given way to the popover's Discount button (3.19.0; the button was not opened this round) | shared:@tallyui/components (TallyUI #677) | [demo](demo/line-edit-demo.jpg) · [tally](demo/line-edit-tally.jpg) |
| B8 | Coupons | No coupon field in the cart; Add Discount sits in the + menu; Coupons is its own area in the rail | No coupon field in the cart. + › Add discount has Quick discount / Coupon sides, and the Coupon side lists codes with descriptions and amounts. Coupons is also its own area in the rail | close | Coupons are picked from a centred Add discount dialog with two sides. The demo's Add Discount form was not opened, so the forms themselves are not compared | shared:@tallyui/components (TallyUI #678), shared:@tallyui/pos (TallyUI #679) | [demo](demo/add-item-demo.jpg) · [tally](demo/coupon-tally.jpg) |
| B9 | Cart settings | Left side sheet beside the rail over a light backdrop: Panel position, Open orders position, Sort items (select), Quick Discounts (−5% / −10% / −15% at 13 px semibold), auto show and auto print receipt toggles, Columns with drag handles, Restore Default Settings, Close | Left side sheet beside the rail over a light backdrop, under v2's header: Panel position, Open orders position, Sort items (select) with "Fees and shipping always stay last", Quick Discounts (−5% / −10% / −15% at 13 px semibold) with a hint, auto show and auto print receipt switches, Register sessions as a switch row with a two-line help, Restore Default Settings in a red border, Close; 44 px footer | close | No Columns section ("Cart") (TallyUI #695). The switches now match: 36x20 with a light grey off track (3.19.0) | shared:@tallyui/components (TallyUI #695) | [demo](demo/cart-settings-demo.jpg) · [tally](demo/cart-settings-tally.jpg) |
| B10 | Order details (⋮) | Left sheet with Form / JSON tabs: Customer Note, Hand over (Status, Cashier, Store, Register, Send), Tax exempt, Hidden fields, + Currency, + Custom field; Void, Close, Print, Sync order | The ⋮ opens a one-item menu: Void | missing | No customer note, tax exempt or hand over ("Order note and meta") | connector (TallyUI #689, awaiting release) | [demo](demo/order-details-demo.jpg) · [tally](demo/order-details-tally.jpg) |
| B11 | Variations | "Aether Gym Pant" drills in place: the parent tile (photo, name, price, "12 options", back chevron), then one tile per variation with its name, attribute chips ("32", "Blue") and price; the filter chips grey out; "12 options" at the foot | "T-Shirt" (6 options) drills in place: "Categories › All products › T-Shirt", the parent tile (image, name, price, "6 options", back chevron), then one tile per variation with its name, attribute chips ("S", "Black") and price, the first row at y168 from x76; the Category chip leaves the row and On Sale and Tag dim, with v2's tooltip on hover; "6 options" with a sync icon at the foot | match | The crumb row and the tiles now match (A5). A dev build still rejects the variable products when they sync (TallyUI #713, merged as #724, awaiting release); the production bundle, which is what a till runs, syncs them | | [demo](demo/variations-demo.jpg) · [tally](demo/variations-tally.jpg) |
| B12 | Phone cart (390x844) | Top bar; full-screen cart table, "Checkout $16.83"; one-line open-order tabs ("Guest $16.83") with a "3 ^" count, the open tab in view at the right; bottom tab bar | Top bar (menu, store, bell, avatar); full-screen cart table with compact lines, Subtotal and a bold Total, ⋮ and "Checkout"; with three open orders, one-line tabs behind a "3 ^" count cell, the open tab whole at the right with + after it; bottom tab bar Products / Cart with a badge | close | The bold Total row (B3; TallyUI #781 lets an app leave it out). Subtotal starts at x32, and the foot puts the ⋮ at x20 and a 290 px Checkout at x80 where the demo's Checkout starts at x7 and its ⋮ is at x54: `CartTotal` and `CartFoot`'s inset (B1). The per-line control rows are gone (3.19.0) | shared:@tallyui/components (TallyUI #781; `CartTotal` inset, not filed) | [demo](demo/phone-cart-demo.jpg) · [tally](demo/phone-cart-tally.jpg) |

## After the sale

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| C1 | Orders list | Table: Status dot, Order number (centred, 32 px customer chip), Customer, Billing address, Date created with a sort chevron, POS icon, Cashier, Payment method, Total; "TODAY" group heading; 57 px rows; narrow 44 px search with a settings, bell and avatar cluster; "Showing 20 of 29,754" with a sync icon | Table on a bordered card 12 px from the rail: Status dot, Order number (centred, 32 px customer chip), Customer, Date created with a sort chevron, Payment method, Total, chevron; TODAY / YESTERDAY group headings; 57 px rows centred on the chip; 40 px search with a sliders icon, bell and avatar; the sliders open "Order Settings", a right sheet with a Columns heading, six column switches, Restore Default Settings (red border) and Close on a 44 px footer; "Showing 25" with a sync icon | close | No Billing address, POS icon or Cashier column, and no "of N" total ("Order history") (connector). The search is 40 px against 44 (TallyUI). The Order Settings sheet's backdrop is near black and its switches larger (TallyUI). Nothing buildable is left here | connector (columns; X-WP-Total, TallyUI #680), shared:@tallyui/components (Switch `size="sm"`, DialogOverlay, SearchInput height) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) · [tally settings](demo/orders-settings-tally.jpg) |
| C2 | Order filters | Rounded chips: Status, Payment Method, Select Customer, cashier, store, Select register, Date range | None | missing | The list can be narrowed only by search ("Order history": filters) | connector (TallyUI #721) | [demo](demo/orders-demo.jpg) · [tally](demo/orders-tally.jpg) |
| C3 | Order search | "Search Orders" box over the table | "Search Orders" box over the table; "377" leaves one row, "Showing 1" | match | The box's 40 px height is counted in C1 | | [demo](demo/orders-search-demo.jpg) · [tally](demo/orders-search-tally.jpg) |
| C4 | Order detail | Right sheet with View / Edit / JSON tabs: items with a barcode chip, tax breakdown, Payment section; Delete, Close, Re-open | Right sheet "Order #377": status, date, items with a SKU chip, Totals, Payment, Customer; Close, Receipt | close | No View / Edit / JSON tabs, and no Re-open or Delete ("Order history": detail, reopen, edit, delete). The backdrop is near black (TallyUI). The tax breakdown was not seen (no tax) | connector, shared:@tallyui/components (DialogOverlay, not filed) | [demo](demo/order-detail-demo.jpg) · [tally](demo/order-detail-tally.jpg) |
| C5 | Customers | Table: primary initials avatar, First name, Last name, Email, Billing address, Date created; narrow search with add-customer, settings, bell and avatar; "Showing 10 of 5,146" | Table on a bordered card 12 px from the rail: initials avatar, First name, Last name (sorted), Email, Billing address, chevron; narrow search with add-customer, sliders, bell and avatar; the sliders open "Customer Settings" with column switches; "Showing 5" with a sync icon under the card | close | The avatars are pale grey where the demo's are solid primary (TallyUI #718). No Date created column: the connector's `Customer` has no created or modified dates. No "of N" total ("Customers": Customers screen). The search is 40 px (TallyUI). Nothing buildable is left here | connector (Customer dates, not filed; X-WP-Total, TallyUI #680), shared:@tallyui/components (TallyUI #718, SearchInput height) | [demo](demo/customers-demo.jpg) · [tally](demo/customers-tally.jpg) |
| C6 | Reports | "US Store · All registers" menu with bell and avatar; a white register strip (Front Counter Open since 03:12, Opening float + Cash sales = Expected in drawer, Print X-report with a printer icon); Today date menu, Everyone, Completed & processing, Print summary; a white hero with the big total, Orders, Average order, Items; vs yesterday; By hour / Running total (open segment rgb(217,234,250)) chart with a dashed comparison and a muted future bar; white Orders, Payments, Where sold cards | One bar over the page: "TallyUI WooCommerce dev store · Register 5979" with a bell and avatar. The page 12 px from the rail. A white one-row till strip ("Register 5979 ● Open since 10:55 · cashier", Opening float + Cash sales = Expected in drawer, Print X-report, a chevron to Closures); "Today · Thu 12 Nov" with a chevron, "Everyone" chip, Print summary; a white hero with the big total, Orders, Average order, Items; "vs yesterday" beside By hour / Running total, the open segment in v2's selected tint; white Orders, Payments, Where sold cards | close | The scope title has no menu chevron: there is no store and register menu (connector). No "Completed & processing" chip (left out: every local sale is complete). The date menu has no calendar (TallyUI #715). The dashed comparison and the muted future bar draw only when the day before has sales on this device. The white surfaces and the open segment's tint now match | connector (status chip, store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/reports-demo.jpg) · [tally](demo/reports-tally.jpg) |
| C7 | Register open and close | Close sheet: "$2,996.12 in the drawer", Session sales, Paid in / Paid out / No sale tiles, Expected in the drawer, Other tenders; Cancel, Print X-report, Close register | On by default: Open register with a float; from the avatar's sheet, a centred "Register" dialog with "1 sale this session", Paid in / Paid out / No sale tiles, Expected in the drawer (Cash $114.00), Close register; then "Count the drawer" in the cart pane with denominations, Back to selling, Close register; then a closure ("Closure #1", Counted, Expected, Exact) with "Print the Z report" | close | The close step is a centred dialog with no big drawer amount, no Session sales total, no Other tenders row and no Cancel or Print X-report | shared:@tallyui/components (TallyUI #716) | [demo](demo/register-close-demo.jpg) · [tally](demo/register-close-tally.jpg) · [tally open](demo/register-open-tally.jpg) |
| C8 | Closures | Its own screen, "US Store · Front Counter ▾" header with bell and avatar, Today date menu and All cashiers chip: Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; day band; session row with Print X-report; tinted Export CSV with an icon | Its own room from the chevron at the end of the till strip: back arrow, "TallyUI WooCommerce dev store · Register 5979", bell and avatar; "Today · Thu 12 Nov", "All cashiers" chip, an outlined Export CSV with a document icon; Discrepancy, Sessions, Cash at open, Cash activity, Cash at close tiles; All / Open / Closed on a bordered card; Today band "$114.00 counted · Exact"; "Closure 1 · Register 5979", 10:49 → 10:54, cashier, with Reprint | close | The scope title has no menu chevron. The date menu has no calendar. Export CSV is not counted: v2's `ClosuresExportButton` is outline with a document icon, as Tally's is | connector (store and register menu), shared:@tallyui/components (TallyUI #715 calendar) | [demo](demo/closures-demo.jpg) · [tally](demo/closures-tally.jpg) |

## Back office

| # | Screen or flow step | Demo | Tally Woo | Status | What differs | Waits on | Pair |
|---|---|---|---|---|---|---|---|
| D1 | Settings navigation | Sub-nav beside the rail: General, Tax, Printing, Card readers, Customer Display, Barcode Scanning, Theme; each page in a bordered panel | Sub-nav beside the rail: General, Tax, Barcode Scanning, Theme; each page in a bordered panel | close | Printing, Card readers and Customer Display are absent (D6–D8) ("Settings area") | connector, pro | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D2 | Settings: General | A two-column form with muted labels: editable Store Name; base country, state, city and postcode with "Set in WooCommerce · Open ↗"; Language select; Default Customer select; Default Customer is Cashier; Currency, Currency Position, Decimal Separator, Number of Decimals as fields | A flat two-column form with muted labels: Store Name, base country, state, city, postcode and Language ("English (US)") read-only with "Set in WooCommerce · Open ↗"; Default Customer as a customer chip; Default Customer is Cashier switch; currency rows read-only; Register sessions switch | close | Store Name, Language and the currency rows are read-only text with an Open link where the demo has fields and selects (connector). Default Customer is a chip, not a select ("Settings area"). The switches now match (3.19.0) | connector | [demo](demo/settings-general-demo.jpg) · [tally](demo/settings-general-tally.jpg) |
| D3 | Settings: Tax | A two-column form with muted labels: Calculation (Calculate tax based on as a select, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open ↗"); Display (Display Tax Totals, Display Prices in the Shop, Display Prices During Cart and Checkout as two-way segments, Price Display Suffix); Tax Rates with "View all tax rates", which opens "Tax Rates" (× in the header, underline class tabs with the count inline over a rule under the tabs, a seven-column rates table, "7 tax rates" with a sync icon, Close) | A flat two-column form with muted labels: Calculation (Calculate tax based on, Enable Taxes, Prices Entered with Tax, Shipping Tax Class, Round Tax at Subtotal Level, each "Set in WooCommerce · Open ↗"); Tax Rates ("No tax rates apply at the store's address.") with "View all tax rates", which opens an 800 px right sheet "Tax Rates" with a 44 px ×: underline tabs "Standard 0 / Reduced rate 0 / Zero rate 0" from x505 over a rule under the tabs only, the open one underlined in primary, "No rates in this class", "0 tax rates" with a disabled sync icon, and Close | close | No Display section (the tax display settings are not synced). "Standard" against "Standard rate": the connector has the class slugs only (not filed). The sync icon is drawn but disabled: `useStoreSettings` has no refresh (TallyUI, not filed). The sheet's backdrop is near black, and the switches are larger with a dark grey off track (TallyUI). Enable Taxes is off and there are no rates, from the data. The tabs' rule and inset and the sync icon now match | connector (tax display settings; tax class names, not filed), shared:@tallyui/components (DialogOverlay, Switch `size="sm"`), shared:@tallyui/pos (`useStoreSettings` refresh, not filed) | [demo](demo/settings-tax-demo.jpg) · [tally](demo/settings-tax-tally.jpg) · [demo rates](demo/tax-rates-demo.jpg) · [tally rates](demo/tax-rates-tally.jpg) |
| D4 | Settings: Barcode Scanning | Scanning (threshold 24, minimum length 8, prefix, suffix); Sound ("Play a sound on scan"); Scanner (setup guide, "Connect a scanner directly (advanced)"); Barcode Scanning Test | Scanning (the same four fields and values); Sound ("Play a sound on scan"); Barcode Scanning Test | close | No Scanner section ("Scanning") | shared:@tallyui/pos (TallyUI #682) | [demo](demo/settings-barcode-demo.jpg) · [tally](demo/settings-barcode-tally.jpg) |
| D5 | Settings: Theme | "Current Theme: Light"; ten theme cards each with an icon, from y179: System, Light, Dark, Ocean, Sunset, Monochrome, Paper till, Warm shop, Bold money, Market stall; a Scale section (Auto / Compact / Regular / Spacious); an Icons section (Match theme, Tabler 1.5, Hugeicons, Phosphor …) | "Following system theme" under System, "Current Theme: Ocean" under Ocean; the same ten theme cards, each with an icon, in a flat grid from y179. Choosing Ocean recolours the whole app, and System puts it back | deferred: ADR | No Scale or Icons section (TallyUI, not filed). The card spacing matches | shared:@tallyui/theme (scale and icon sets, not filed) | [demo](demo/settings-theme-demo.jpg) · [tally](demo/settings-theme-tally.jpg) · [tally Ocean](demo/theme-ocean-tally.jpg) |
| D6 | Settings: Printing | Printers (empty, Add printer); Receipt templates (Standard, Detailed Thermal 80mm, Detailed, Gift, Packing Slip, Kitchen Ticket), each with "Auto — Print Dialog" | Not present | missing | ("Printing") | connector (TallyUI #681) | [demo](demo/settings-printing-demo.jpg) |
| D7 | Settings: Card readers | Reader list with "Use this reader" | Not present | missing | ("Card readers and terminals") | shared:@tallyui/pos (TallyUI #679) | [demo](demo/settings-card-readers-demo.jpg) |
| D8 | Settings: Customer Display | Generate pairing code, Copy URL, Open in browser | Not present | missing | ("Customer display") | connector, pro (TallyUI #684). ADR-085: U7, the fork routes, is TallyUI/woocommerce-pos#1, waiting for the desk; U8, the app wiring, comes after the TallyUI batch release; the Woo connector's `displaySignalling` belongs to the tallyui worker | [demo](demo/settings-customer-display-demo.jpg) |
| D9 | Store health: Database | Sub-nav Database / Performance / Logs; "Ready to sell", records on this device, storage used, changes waiting to send; "8 records need attention" banner with Fix record, Retry, View log; a flat table with uppercase muted headers, row rules and rows about 61 px: Collection / On device / On server / Coverage bar / Size with ⋮ per row, its subtitle in the header | Sub-nav Database / Logs; "Database" with its subtitle as small muted text under it in the header (title y29, page rule y84, as the demo's); "✓ Ready to sell", records on this device, storage used, changes waiting to send over a rule at y153; a flat table with 12 px uppercase muted "Collection / On device" heads over a rule, 61 px rows with rules, a ⋮ on the Products row | close | No Performance entry in the sub-nav (D10). No On server, Coverage or Size columns (connector). The ⋮ stands only on Products, where v2 has one on each row: Tally has no per-collection action for the others yet. The dev store had no stuck records, so the attention banner was not seen ("Store health"). The header and its subtitle (#272), the rule under the figures (y153 against 150; the stat labels' line sits about 1 px lower, not counted), the row ⋮ (#267) and the flat table now match | connector | [demo](demo/health-database-demo.jpg) · [tally](demo/health-database-tally.jpg) |
| D10 | Store health: Performance | Hourly request strip with "Reset to Balanced" | Not present | missing | ("Store health": Performance) | shared:@tallyui/database (TallyUI #683) | [demo](demo/health-performance-demo.jpg) |
| D11 | Logs | Under Store health: events today, errors today, stuck records, changes waiting to send; Copy debug info; 44 px Search Logs; rounded All / Actions / Errors / Sync chips, the open one a borderless blue tint; verbose diagnostics toggle; Time / Level / Event / Duration / Status rows with a chevron; "Showing 46 of 46" and a "next check" line at the foot | Under Store health: the same four figures; Copy debug info; 40 px Search Logs; rounded All / Actions / Errors / Sync chips, the open one in v2's borderless selected tint; "Verbose diagnostics: off"; Time / Level / Event / Duration / Status rows with a chevron ("Order accepted by the store", "Register session opened") | close | The search is 40 px (TallyUI). No "next check" line at the foot. Sync runs write no row; the demo logs them ("Loaded the records this screen needs"). The open chip now matches | shared:@tallyui/database (TallyUI #683), shared:@tallyui/components (SearchInput height) | [demo](demo/logs-demo.jpg) · [tally](demo/logs-tally.jpg) |
| D12 | Products area | Table from the rail in a bordered panel: photo, product name with attribute links and "15 variations ›", stock field with Manage toggle, stock status dot, categories, prices right-aligned, regular and sale price; cells centred on the row; chips In Stock, Featured, On Sale, Category, Tags, Brands; narrow search with a settings, bell and avatar cluster; "Showing 10 of 209" | Table from the rail on a bordered card: an unlabelled image column, name, stock, stock status dot, categories, price, regular and sale price, cells centred on the row; a variable product shows its attribute links and "1 variation" / "6 variations ›" under its name, drilling to "Products › T-Shirt" with one row per variation; chips Stock Status, On Sale, Category, Tag; narrow search with a sliders icon, bell and avatar; the sliders open "Product Settings" with column switches; "Showing 13 of 13" with a sync icon under the card | close | The prices are left-aligned where v2's are right-aligned, and "Regular Price" wraps, so the head is 57 px against 44: `ProductTableColumn` has no `align`, one-line heads or cell padding (TallyUI, not filed). The product name is plain text, not v2's inline field, and stock is plain text with no Manage toggle (no product writes in the connector). No Featured or Brands chip. The centred cells and the blank image head now match | connector, shared:@tallyui/components (`ProductTableColumn` align, one-line heads, cell padding; a name for an unlabelled head; not filed) | [demo](demo/products-area-demo.jpg) · [tally](demo/products-area-tally.jpg) · [tally drilled](demo/products-drill-tally.jpg) |
| D13 | Coupons area | Table from the rail in a bordered panel: Active dot, Code, Amount (right-aligned), Type, Description, Usage (centred), Expiry date, inline edit; cells centred on the row; chips Status, Discount Type, Expires; + to add; narrow search with an icon cluster | Table from the rail on a bordered card: Active dot, Code, Amount (right-aligned), Type, Description, Usage (centred), Expiry date, cells centred on the row; chips Status, Discount Type, Expires, the chosen one in v2's tint; narrow search with a sliders icon, bell and avatar; the sliders open the coupons' column settings; "Showing 10 of 10" with a sync icon under the card | close | No + to add a coupon and no inline edit, so the rows follow their text (32 px) where the demo's 57 px rows hold fields (the connector has no coupon writes). The search is 40 px (TallyUI). No calendar behind Expires. The 45 px head, Amount's alignment, Usage's centring and the centred cells now match | connector, shared:@tallyui/components (TallyUI #715 calendar, SearchInput height) | [demo](demo/coupons-area-demo.jpg) · [tally](demo/coupons-area-tally.jpg) |

## Not compared this round

These steps are in the cashier's path, but one side could not be captured
under the round's rules. They are not scored.

| Step | Why | Tally Woo as captured |
|---|---|---|
| Tender | The demo's Checkout is never pressed (look-only rule) | Left ledger (Total, No payments yet, Paid, Remaining). Right side: Cash / Card choice, "To pay", keypad with C and ⌫, "Take $14.00 in Cash", Back. Keying 2000 shows "Change $6.00 · Tendered $20.00". [tender](demo/tender-tally.jpg) · [change](demo/tender-change-tally.jpg) |
| Split payment | Same | Not exercised this round |
| Receipt | Same | A paid moment, "Change $6.00 · Paid $14.00 · tendered $20.00 in cash", over a zoomed receipt (order b85a6164 · #377, cashier, "Register: Register 5979") with Email Receipt. [receipt](demo/receipt-tally.jpg) |
| Line and order discount | The demo's Add Discount form was not opened; its quick discount keys are covered in B7 | Inline "Discount on Cold Brew" form on the line, and + › Add discount › Quick discount with Percent / Amount, Apply, Cancel. [line](demo/line-discount-tally.jpg) · [order](demo/order-discount-tally.jpg) |
| Phone drawer | The demo's phone drawer was never captured | The menu opens a 200 px drawer in the rail's tint (the selected item white with a primary label) listing POS, Orders, Customers, Reports, Store health and Settings; Products and Coupons, which the window's rail has, are not in it. [drawer](demo/drawer-tally.jpg) shows the window's rail |
| Support area | The demo's Support area is a third-party chat widget, and its requests were aborted | — |

Tally Woo test order made this round: #377 (local id b85a6164) on the
local dev store, at 10:51. It was a cash sale of $14.00 for two Croissant,
one Espresso and one Cold Brew; $20.00 was tendered and $6.00 given as
change. Orders #376 and earlier in the list were not made by this round.

Register sessions were also exercised, with sessions on by default and no
switch touched:

- A fresh till showed the Open register card. A session was opened at
  10:49 with a $100.00 float, took order #377, and was closed at 10:54
  with an exact count of $114.00 (Closure 1 · Register 5979).
- A second session was then opened at 10:55 with a $100.00 float for the
  sheet and phone captures and left open.
- The sessions exist only in the capture browser's profile.

Three open orders were left on the phone till for B12, as unpaid carts in
the capture browser's profile; none was sent to the store: Guest carts of
$4.50, $3.00 and $4.00 (local ids 60c9a04c…, cbc1555c… and 59ca3712… at
the end of the run), with a blank cart open. A cart takes a new local id
when another tab is chosen, which is also when it moves to the end of the
strip.

## Found on the live demo

- **"Your sales today $0.00" right after a sale** (A4's sheet, 2026-11-12, on
  the public demo against `tally-woo-demo.wcpos.com`). The data was right; the
  figure was read too early. The row counted the sales itself and mounted
  only when the sheet opened, so every open began at the hook's zero until
  the first RxDB read came back. On the dev store that took 125 ms after a
  reload, and longer on the busier demo, where the screenshot caught it. v2
  counts in `UserSheet` itself (`user-sheet.tsx:496`), so the figure is ready
  before the sheet opens. `CashierSheet` now does the same. Fixed by the PR
  that adds this note; it scores no row.

## Next for this repo

The gaps that can still be built here, in the order a cashier would notice
them. Round 13's list is done by #265 to #267 and #272. Gaps that wait on
TallyUI or the connector are left out.

1. **Cashier sheet body** (A4). Everything from "Your sales today" down to
   "HAND THE TILL TO" sits 4 px higher than the demo's (the label's ink at
   y87 against 91, the drawer card at y110 against 114) while the header
   and footer match: the gap between the header and "Your sales today" in
   `cashier-sheet.tsx`, measured against v2's `user-sheet.tsx`.

A7's last 1.5 px (the active chip 138.3 px against 140) has no cause found
in v2's `chip/index.tsx` and is not counted, so it is not listed.
