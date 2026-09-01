# Project: Mikkel Køster Portfolio

## Stack
- Single file: `index.html` — no build step, plain HTML/CSS/JS
- Preview server: port 3456
- Images: `public/images/`

---

## Standing rules

### Mobile-first (ALWAYS)
Every change must be mobile-optimized. Before finishing any task, verify:
- Layout doesn't break below 768px
- Touch targets are at least 44px
- Text remains readable — no overflow, no tiny font sizes
- Carousels and modals work on touch/swipe
- Images scale correctly on small screens
- Flex rows wrap gracefully; gaps reduce on mobile

---

## Design system

### Colors
| Token | Value | Usage |
|---|---|---|
| `--blue` | `#2563EB` | Primary accent, links, highlights |
| `--text` | (dark) | Body copy |
| Blue-50 | `#EFF6FF` | Card number circle backgrounds |
| Blue-100 | `#DBEAFE` | Skeleton shimmer base |
| Blue-200 | `#BFDBFE` | Skeleton shimmer highlight |
| Section light bg | `#FAFAFA` | Light section backgrounds |
| **Matas rose (light)** | `#E11D48` | The accent on any light ground: hero label, hook, section labels, card tags, finding + challenge icons, carousel dots |
| **Matas rose (dark)** | `#FDAFBF` | The same accent on navy: labels, spend-chart fills, frequency bands, result stats |
| **Matas tint** | `#FFF1F2` | Card fills — meta tiles, finding cards, mechanic cards |
| **Matas tint (deep)** | `#FFE4E6` | Hover state, borders, carousel placeholders |
| Dark section | `#0B1D35` | `.cm-section--dark`, `.cm-spend` panel |

### Matas palette — four values, no more
The case runs on **two** accent values and **two** tints. `#E11D48` and `#FDAFBF` are the
same accent at different contrast, picked by the ground they sit on — light or navy. Do not
introduce a third mid-pink: `#FBB6C4` and `#F2718C` both existed at one point and were folded
back in, because they sat within ~5 luminance of a value already in the system.

Icons use `#E11D48` on `#FFF1F2`, which measures 4.28:1 — above the 3:1 floor for non-text
graphics. An earlier softer pink measured 2.54:1 and did not.

---

### Typography
| Element | Font | Size | Weight |
|---|---|---|---|
| Headlines (`cm-headline`) | Fraunces, serif | — | 400 |
| Section row titles (e.g. lego) | Fraunces, serif | 18px | 400 |
| Body / labels | Inter, sans-serif | 16px | 500 |
| Card numbers | Inter | 11px | 600 |
| Letter spacing on numbers | — | 0.08em | — |

### Headlines (`cm-headline`)
- Max 1–2 lines — match the length of other section headlines in the modal
- Max-width: 680px (standard), up to 720px if needed
- Never wider than 760px
- Always has a `cm-label` section tag above it (e.g. "The Work", "The Challenge")

### Spacing (follow Figma specs exactly when a node is referenced)
- Section padding: `80px` horizontal, `72px` vertical (light sections)
- Gap between major section blocks: `100px`
- Gap between flow items (lego section): `30px`; lego labels `14px`; lego "Like this" images `150×150`, "Not like this" images `200px` tall
- Gap within lego/flow rows (label → flow): `30px`
- Gap within items (image → label): `15px`
- Card number circles: `36×36px`, `border-radius: 50%`

### Border-radius
- Cards / image wraps: `10–14px`
- Blue accent boxes: `10px`
- Number circles: `50%`

---

## Carousel conventions

### Behaviour
- **1 card at a time** navigation (next/prev moves exactly one card)
- Active card is full opacity; card peeking at edge is `opacity: 0.35`
- Drag/swipe supported on touch — see below
- **Never hardcode `opacity` on inner card elements** — the JS carousel owns opacity exclusively via `.is-peek` / `.is-hidden` classes on the outer `.cm-car__col`. Inline opacity on children will override the JS state silently and break the "active" appearance.

### Swipe
All three carousels — the page carousel, the testimonials, and every
`initCmCarousel` instance — go through one `attachSwipe(track, opts)` helper at
the top of the first `<script>` block. They are all inline in `index.html`, so
unlike the two scene files there is no payload argument for duplicating it.

Things it has to get right, each of which was once wrong:
- **Track `touchmove`, not just start and end.** Without it the track never
  moves under the finger, so a swipe gives no sign it registered.
- **Lock the axis in the first 10px.** A vertical page scroll that drifts
  sideways used to count as a deliberate swipe. Vertical gestures are handed
  straight back to the page and never `preventDefault`ed.
- **Commit on distance OR velocity.** A flat distance threshold ignores a fast
  short flick, which is how people actually swipe.
- **`onStart` fires at the axis lock, not at touchstart.** It stops any
  animation in flight; firing it on touchstart means a tap freezes a slide
  mid-way, because a tap never reaches commit or cancel.
- Tracks need `touch-action: pan-y` so the browser hands horizontal gestures
  over before it starts scrolling.
- Each carousel keeps a `gen` counter its animation frame checks, so an
  interrupted slide stops writing `transform` under the finger.

### Skeleton loading
- Every carousel image has a `<div class="cm-skeleton">` sibling (z-index 2) before the `<img>` (z-index 1)
- Image starts at `opacity: 0` and fades in on `onload`
- Pattern: `onload="this.style.opacity='1';this.previousElementSibling.classList.add('is-done');"`
- Cached-image check in `initCmCarousel`: `if (img.complete && img.naturalHeight !== 0)` → apply immediately
- `.cm-car__track` must NOT have `opacity: 0` — skeletons must show immediately on modal open

### Carousel IDs
| ID | Case | Content |
|---|---|---|
| `cm-c1` | Maersk | Hero / process images |
| `cm-c2` | Maersk | Result cards (9 cards) |
| `cm-c3` | Matas | App feature cards (6) — images pending, see placeholders |
| `cm-c4` | Maersk | Component design system images |

### Result cards — narrative order (cm-c2)
01 First-ever Design Lead → 02 Shift left → 03 Scaled team 6→12 → 04 3 sub-teams → 05 North Star Vision → 06 "Flea Market" DS → 07 "Grand Central Station" → 08 "Dressed for Success" → 09 Closed the design-to-delivery gap

---

## Modal conventions
- Opens by sliding up from bottom
- **Close animation**: `scroller.scrollTop = 0` first (hidden by overlay), then `translateY(vpH + 40px)` with `cubic-bezier(0.4, 0, 0.8, 0.55)` over `520ms`
- Never use `translateY(100%)` for close — panel height ≠ viewport height and causes a sweep-through effect

---

## Matas case components

Added when the Matas case was rebuilt from the original 1508 deck. All three are Matas-only today.

### `.cm-findings` / `.cm-finding`
3×3 grid of the nine research findings — Phosphor icon above a short label, pink card.
Ordered as an argument, not the deck's original order: row 1 what's broken, row 2 why it's
confusing, row 3 what members actually want. Row 2 ends on the inequality finding so it hands
straight off to the spend chart in the next section.
Below 768px it stacks to one column and flips to icon-left / text-right.

### `.cm-spend`
Dark inset panel inside a light section, showing that the bottom 50% of members and the top 1%
spend the same. Pure CSS — no image. The bottom bar fills 50%; the top bar uses a fixed 10px
sliver, since a true 1% would render sub-pixel. Both numbers are stated in the labels so the
sliver isn't read as a real proportion.
The `Equal spend` badge swaps to `=` below 768px via `.cm-spend__equal-full` / `--short`.

### `.cm-car__card-img--ph`
Dashed placeholder standing in for a carousel image, labelled with the filename it expects.
Replace the div with an `<img>` (plus the skeleton sibling — see Carousel conventions) once the
export lands.

---

## Case-card 3D stages

The Maersk and Formalize hero cards run a live WebGL product shot instead of a
screenshot: a studio display on a dark plinth against a gaussian-splat backdrop,
cutting between four camera setups.

### Files
| File | Role |
|---|---|
| `public/js/softbox-stage.js` | the MONITOR scene — device, plinth, lighting, splats, glass |
| `public/js/phone-stage.js` | the PHONE scene — GLB model, scrolling screen |
| `public/js/stage-configs.js` | per-card shot lists and ground colours |
| `public/js/three.min.js`, `gsap.min.js` | vendored, loaded on demand |
| `public/models/iphone-17-pro.min.glb` | the phone, 813KB (CC BY — see ATTRIBUTION.txt) |
| `public/images/{case}/plates/plate-N.webp` | the screens shown on the display |

A card asks for the phone scene by carrying `data-model`; without it the
loader uses the monitor scene. `three.min.js` is an esbuild bundle that
includes `GLTFLoader` and `MeshoptDecoder` — 19KB more gzipped than plain
three, and it serves all three cards.

**The two scene files duplicate their shared parts** — renderer, environment,
light rig, splat backdrop, linear-light mip chain. That is deliberate: a
shared module would be loaded by every card on a page where only one may ever
come into view. Fix a bug in one of those blocks and fix it in the other too.

### Only one film runs at a time
Two stages on screen cost 24fps between them — each is a full WebGL context,
and the second buys nothing because a reader can only watch one. The
IntersectionObserver tracks `intersectionRatio` and resumes only the most
visible card (>0.25), pausing the rest. It is the better design call as well:
two product shots cutting and panning at once compete rather than compose.

### The backdrop renders small
The splat cloud was the single most expensive thing in either scene —
measured, 11.8ms of a 30.7ms frame at 1.38 megapixels, against a phone model
costing nothing measurable. It is pure overdraw: 3000 large alpha-blended
quads with no depth rejection. Both scenes now render it into a 34%-scale
target and composite it up; the device draws at full resolution over the top.
`autoClear` goes off for the main pass or the composite is wiped.
**Both the start() and resume() loops must call `renderFrame()`** — they have
different indentation and are easy to miss, and a card that scrolls away and
returns then renders with no backdrop at all.

### Phone plates scroll, they are not screenshots
The Matas captures are whole pages — 720x6953 for the first, 4.6 screens tall.
The texture shows a screen-shaped window (`repeat.y`) and the shot slides it
(`offset.y`), so `scroll` in the shot config is the fraction of the remaining
page a shot travels. `offset.y` starts at `1 - window` and counts DOWN,
because three's V axis runs bottom-up while image rows run top-down.
These are **lossy WebP q92**, not lossless: the plate is minified ~1.6x on a
phone screen, so chroma subsampling sits well below the visible threshold.
The lossless rule above is for the monitor plates, which render 1074-2790px
wide — a different regime.

### Plates
**16:10, 1536px wide, lossless WebP.** All three constraints are load-bearing:

- **16:10** is the panel's own ratio (6.99 / 4.37). Anything else gets cropped
  from the bottom at runtime — a 4:3 export throws away 17%, a 6:5 export 25%.
  Ask for source at 3072x1920 and downsample.
- **1536** is the compromise between the two ends of the loop. The widest shot
  needs ~1074px at 2x and the closest macro ~2790px; one texture cannot be 1:1
  at both. Larger biases toward the macro but makes the wides minify, which is
  what fades 1px separators during a pan.
- **Lossless** because lossy WebP subsamples chroma even at quality 100 — max
  error 14 levels, and the gap between a `#F7F8F9` card fill and white is 8.
  Lossy erases exactly the fine UI detail the shot exists to show.

### Adding a stage to a card
1. Plates into `public/images/{case}/plates/`
2. A config under `window.STAGE_CONFIGS` in `stage-configs.js`
3. Markup: `.case__stage` wrapper, poster `<img>`, and a canvas with
   `data-stage` (the config key) and `data-plates` (comma-separated URLs)
4. Zero the panel's padding — **including inside both mobile breakpoints**,
   where the base rule loses on specificity

### Things that will bite
- `.case__stage` needs `aspect-ratio`. It replaced a `<video>`, which carried
  intrinsic dimensions; a div has none, so where the panel height is
  indefinite `height: 100%` computes to auto and the stage collapses to zero.
- The canvas needs explicit `width/height: 100%`. A canvas is a replaced
  element, so `inset: 0` resolves to its intrinsic size — the drawing buffer.
- Keep `initCaseStage` in its own `<script>` block. It once shared one with an
  unrelated preloader; deleting that preloader took the loader with it, and the
  card silently fell back to its poster, which is what success looks like.
- Posters are captured from the scene itself. That needs
  `preserveDrawingBuffer: true` patched in temporarily — it is off in normal
  operation.

### Four things that were wrong, and are load-bearing now
Each of these was found by measurement after the flicker was blamed on
something else first. Do not undo them without re-measuring.

- **Mip levels are built in LINEAR light, and level 0 is left verbatim.**
  Canvas `drawImage` averages in sRGB, but the GPU decodes the texture to
  linear before filtering, so it expects the sRGB encoding of the *linear*
  average. The error differs per channel and grows with how far apart the
  averaged values are — large for navy beside white text, negligible for grey
  on white. That put a colour cast on mip 1 that mip 0 did not have, so any
  change of scale shifted the chrome's hue. Level 0 stays untouched because
  the macro shots magnify the panel and read straight from it.
- **The chain low-passes, it does not sharpen.** It used to unsharp-mask each
  level to save thin lines from minification. Unsharp amplifies exactly the
  frequencies that alias, so the rescued lines then shimmered. Measured on
  dark chrome under sub-pixel motion: sharpened 1.63, plain box 1.51, gentle
  low-pass 1.34 — against a white-area floor of 1.37.
- **The glare streak clamps and its ends are painted black.** The end fade was
  `destination-out`, which clears alpha; the canvas is opaque by then and the
  material reads colour, so the fade did nothing — 0 at column 0, 51 at column
  1. With `RepeatWrapping` that cliff landed on the panel as a hard vertical
  seam that slid across the glass whenever the offset was non-zero.
- **`key`/`amb` are 1 in every shot.** Grading each setup separately moved the
  whole frame's mean brightness 14 levels between shots and the backdrop gain
  29%, arriving instantly on each cut — four times a loop. It reads as the
  lights jumping, not as a look.

Also removed: the sheen quad over the panel. Measured against the panel
underneath it contributed a flat −3 levels across 96% of pixels — no highlight,
no gradient, just a darker screen for a third of a frame's budget.

---

## Update this file
Keep `CLAUDE.md` up to date as the project evolves:
- New carousel IDs → add to the table
- New color tokens → add to the colors table
- New spacing rules from Figma → update spacing section
- New components or sections → add their conventions

---

## v2 — the minimal build

A second design language living alongside the current site, not replacing it.
Inspired by dstudio.agency: white ground, near edge-to-edge layout, one
typeface at two weights, and colour reserved for two things only.

| File | Role |
|---|---|
| `v2.html` | front page **and all three case sheets**, as modal content blocks |
| `v2-maersk.html`, `v2-formalize.html`, `v2-matas.html` | standalone previews — nothing links to them since the cards became modal triggers |
| `v2.css` | the whole system |
| `v2.js` | reveal, nav hairline, film loader, carousels, the modal, the before/after slider |
| `public/js/stage-configs-mono.js` | grey grounds for the films |
| `tools/mockup-composite.py` | puts screenshots inside photographic device mockups |

### The system
| Token | Value |
|---|---|
| ink | `#121212` |
| muted | `rgba(0,0,0,0.40)` |
| surface | `#F7F7F7` |
| line | `rgba(0,0,0,0.10)` |
| blue | `#2563EB` |

General Sans (Fontshare), weights 400 and 500 only. Display type runs to
104px at *regular* weight with `-0.04em` tracking — the negative tracking is
what stops it reading as shouty. Gutters 48px, 24px below 900. Section rhythm
156px, 88px below 900.

**Colour appears in exactly two places**: blue on things you can press, and
the product UI inside the films and screenshots. Everything else is ink, grey
or white — the portrait and every avatar are greyscaled for that reason. The
three Formalize event photographs are a deliberate exception, made on request.

`.cm-section--dark` no longer inverts. The class is kept so the markup can
still be targeted, but every section sits on white; the 150px of section
padding is the division. Anything that reads darkness off that class name will
be wrong — see the close button below.

### One sheet, three cases
`#cm-panel` holds `#modal-content-maersk`, `-formalize` and `-matas`. The
trigger's `data-case` picks one and hides the rest; an unknown name falls back
to the first block rather than opening an empty sheet.

Hidden blocks have no layout, so their rows measure zero. `open()` runs while
the panel is still transformed, which is too early — the carousel pill came out
6px left of the first dot and one card wide instead of three. **Rows remeasure
again on the settle transition**, when the sheet has actually come to rest.

| Track | Case | Content |
|---|---|---|
| `cm-c1` / `cm-c2` / `cm-c4` | Maersk | hero scenes · result cards · design-system sheets |
| `cm-f1` / `cm-f2` | Formalize | hero scenes · the journey |
| `cm-m1` / `cm-m2` | Matas | hero scenes · what members asked for |

### Components
Built for one sheet, reused across the others where they fit.

| Class | What it is |
|---|---|
| `.cm-reveal` | before/after with a draggable divider. `clip-path`, not width — narrowing would squash the top image and the halves would drift out of register |
| `.cm-ledger` | matched pairs as table rows. `--three` for a scale, which does *not* grey its `dt` |
| `.cm-challenge-card` | white card, grey on hover, drawn 24px icon. No icon font is loaded — icons are inline SVG at 1.4 stroke |
| `.cm-many` / `.cm-chip` | many things resolving into one. A dashed chip is an open slot |
| `.cm-inout` | a bordered box holding what is inside, a dashed card outside it |
| `.cm-spend` | two bars drawn to the *spend*, not the group size, with a note saying so |
| `.cm-shots` | product screens, each pinned by percentage and clipped by its card |
| `.cm-duo`, `.cm-photos`, `.cm-pull` | two labelled columns · a photo row · a pull quote |

### The close button reads the pixel, not the class
The live site walks up from the button looking for `.cm-section--dark`. That
cannot work here: every section is white, and what goes dark behind the button
is a photograph or a monitor scene. `updateCloseTheme` in `v2.js` takes
`elementsFromPoint` under the button and, for an image, maps that screen point
back into the file's own pixels — which depends on `object-fit`, since this
build uses both `cover` and `contain` and they centre the leftover differently.
A transparent pixel is skipped rather than read as black. One 1×1 canvas is
reused; throttled to a frame.

### Images: fork, never recolour in place
`index.html` uses the colour originals. Every image v2 recolours is forked to
`-mono` — 9 Maersk result plates and 6 Formalize journey plates. Recolouring
in place silently changes the live site; it happened once, caught during an
audit.

Three things that bit, in order:
- **Ground repaint must blend toward the target, never add a delta.** A pixel
  already at `#f7f7f7` sits 3.7 from the plate colour, so it falls inside the
  match band and a delta shifts it a second time. Blending is idempotent.
- **The source exports carry a 2px border at columns 0–1.** A crop-to-content
  pass reads it as artwork, so the bbox starts at x=0 and the border ends up
  scaled into the middle of the card as a vertical rule. Inset 3px before
  measuring.
- **Canvas size sets the padding, fill sets the picture.** Shrink both together
  to make artwork smaller without the gap growing back.

### `tools/phone-composite.py` — what sits in front of the glass
The mockups ship a placeholder fintech app, so plenty of the screen is
legitimately dark and **brightness cannot tell the device UI from the hand**. A
luminance ramp punches the placeholder straight through; that trap has now been
walked into twice.

Connectivity can tell: the hand is one mass of ~1.8M px reaching far outside the
screen quad, while every dark element of the placeholder lies wholly inside it.
Only components with real area on both sides are held back.

Two refinements that are load-bearing:
- **Hold solidly, never by a luminance ramp.** A lit fingertip reads 200-235, so
  a ramp made the bright half of each tip transparent and the UI sliced it off
  along the screen edge.
- **Open by RECONSTRUCTION, not a plain opening.** The erosion is only a test of
  thickness — a letter stroke fails it, a finger passes — and every blob that
  passes is kept whole. A plain opening also rounds off what it keeps, and a
  finger is narrowest exactly where it crosses the edge, so it shaved the tips
  flat. This was a real reported bug, not a theoretical one.

Raising the threshold is not the lever: 235 to 251 moves coverage by 0.2pp and
253 leaks the placeholder in. The finger only overlaps ~1.8% of the glass.

The quad is pulled in 2.5px — the fit lands within ~2px of the glass, accurate
but leaving the UI on the bezel.

### Plates: never crop a screenshot horizontally
The side margins are the layout. Where a plate is proportionally wider than the
screen, keep the full width and grow the canvas downward — these captures end in
flat rows, so the extension is invisible. Cover-cropping the sides took 6.4% off
`matas-app-new` and cut the nav off a Formalize screen.

Plates also carry dead margins: `plate-4` has 45px of one flat colour down its
right side plus a 6px window sliver, which warped to ~27px of blank against the
bezel. `trim_dead` removes flat side bands before the fit. **Sides only** — the
Maersk plates open on 17 flat rows at the top that are part of the UI.

The Maersk monitor plates are `Maersk 01/02/03.png` (01 dashboard, 02 list, 03
detail), redrawn without the corner radius. Worth knowing the rounding was never
visible: the paste mask is the screen quad, so the old plates' black corners
fell outside it. What did change is the crop — the new plates are 4:3 against
the old 1.515:1, so cover-from-the-top keeps 74-83% of each plate's height where
it kept 84-94%. `index.html` no longer uses the old plates but they are kept.

### `tools/mockup-composite.py`
Warps a screenshot into a photographic mockup's screen and outputs a
monochrome scene where the only colour is the UI. `JOBS` names the mockup, a
source directory and an output; `QUADS` holds each screen's four corners,
measured once and checked on an overlay.

Phone mockups detect their own screen: the bezel is black against a mid-grey
room, so the largest bright connected region is the screen. Two corrections
that both had to be made:

- **The quad is the minimum-area enclosing rectangle of the hull, not its
  extreme corners.** On a rounded rectangle the extreme points sit on the
  corner arcs and fall ~10% short of the real corners, which leaves the warped
  screenshot inset with a band of the original screen showing above and below.
  Rotating calipers returns the rectangle the rounding was cut from.
- **The paste mask is that rectangle, drawn rounded and warped into place — not
  the bright region and not its hull.** The region itself is full of holes,
  because a screen's dark UI is not bright, and the mockup's placeholder app
  shows through every one. The hull closes the holes but still follows the
  bright pixels, so wherever the original screen was dark near an edge the hull
  cuts inward and clips the new screenshot there: 5.7% off one of these three,
  which read as a crop on the left and right. A rounded rectangle clips 0.8% —
  the corners, and nothing else. Its radius is 14% of the screen width, which
  is what these phones actually are (55pt on a 393pt screen); measuring it from
  the image kept failing, because a march from the corner crosses bezel first
  and an area estimate is contaminated by the same dark edges.
- **Orient the quad before using it.** The min-area frame comes from whichever
  hull edge minimised the area, so it can sit at any multiple of 90° to the
  phone — one of these three came out upside down. The screen is portrait, so
  the short pair of edges is the width; and none of these phones is inverted,
  so of the two short edges the higher one is the top.
- **A tilted phone is a trapezoid, not a rectangle.** The min-area rectangle is
  only a seed. Forcing it as the quad left the screenshot drifting off the left
  edge and past the bottom-left corner on the two angled shots, because a
  rectangle cannot follow a perspective projection. `tools/phone-composite.py`
  assigns each hull point to its nearest seed edge, drops the points near the
  corners where the rounding curves away, fits a line to each side by total
  least squares, and intersects them. The fitted quads taper 54px and 12px
  across — which is the perspective the rectangle was throwing away.

### Carried over from the main build
Both lessons were learned the expensive way in `index.html` and are
implemented here from the start, not rediscovered:
- Scenes build **one at a time** through a promise chain, with a timeout
  backing the rAF that releases it.
- A film runs for as long as it is **more than 12% on screen**, rather than
  only the most-visible one. Pausing is for cards that have gone.

### It was promoted — 2026-09-01
`v2.html` **is** `index.html` now, live on mikkelkoster.com. The rename was done
with `git mv` so the file kept its history. The `no-store` meta is gone; it was
there so a phone reloading the preview could not sit on stale CSS, and on a real
deploy it would defeat caching on every visit. The three standalone
`v2-*.html` pages were deleted: nothing linked to them, they held one image and
~2.7k characters each against 19-32 images in the sheets that replaced them, and
their nav pointed at `v2.html`. They are in history if wanted.

Two checklist lines turned out to be stale and were closed without action: all
three stage posters resolve and share the same white ground, and `_sb.html`,
`maersk.html` and `og-card.html` were never linked from the old front page
either, so promoting changed nothing about them. `_sb.html` is a 2.9MB dev tool
still publicly reachable at `/_sb`.

The stylesheet and script are still named `v2.css` / `v2.js`. Renaming them buys
nothing and would touch every reference.

### OPEN: the monitor films lose the device on their macros
Mikkel's standing requirement: **the desktop device must be visible at all
times.** It currently is not, on both Maersk and Formalize.

This is NOT the vanishing-enclosure bug from `eb03990` — that fix is intact and
live (graphite `#6e747b` against ground `0x6b6f73`, verified in the deployed
config). This is framing. Measured off the live WebGL buffer: for ~7s of the
~19s loop the frame washes to near-white, mid-tones collapsing from ~70% to 3%,
because the two macro shots are framed inside the bezel and the screen runs edge
to edge. The plate is still rendering — the supplier table is legible in the
pixel data — it just has no device around it.

It is authored that way. `stage-configs-mono.js` says so: *"The macros are meant
to lose the frame; that is what makes them macros"*, and shot 3 is commented
*"This one IS inside the bezel"*. So it needs an intentional change, not a fix.

The header comment's geometry is stale in one respect: it assumes the card
renders at **aspect 1.06 at every breakpoint**. Measured, it is 1.600 at desktop
(1351x844) and 1.333 at mobile (342x257), with `fov` 34deg at both. Visible
half-width is therefore `0.489 * dist` on desktop and `0.408 * dist` on mobile —
mobile is the binding constraint, and any framing sum must use it.

The prepared fix keeps every `dist` exactly as authored and pans `tx` toward the
screen edge, so the bezel stays in frame at the same closeness. Flattening the
distances instead would push the macros to ~9-13 and make all four shots the
same size. Required `|tx|` is `3.595 + 0.25 - 0.408 * dist` (enclosure
half-width, plus a margin so the edge reads as an edge rather than a clip):

| shot | dist | tx now | tx needed |
|---|---|---|---|
| formalize sh2 from | 4.07 | +1.90 | **+2.19** |
| formalize sh2 to   | 3.70 | +1.25 | **+2.34** |
| formalize sh3 from | 6.47 | -0.30 | **-1.21** |
| formalize sh3 to   | 5.92 | +0.10 | **-1.43** |
| maersk sh2 from    | 3.99 | -2.15 | **-2.22** |
| maersk sh2 to      | 3.62 | -1.55 | **-2.37** |
| maersk sh3 from    | 4.15 | +1.60 | **+2.15** |
| maersk sh3 to      | 3.78 | +1.00 | **+2.30** |

Formalize sh3 has to commit to one side — both keyframes go left, or the camera
swings across the screen mid-shot. Panning `tx` moves the look-at target, so it
also changes which part of the UI each macro centres on; sh2's comment says it
is aimed at the dense left columns of the supplier table, and that will shift.

Bump the `?v=139` on the three stage scripts in `v2.js` when changing this. The
dev server sends only an ETag, so an edited config sits behind a cached copy and
the fix looks like it did not take — this has wasted time before.

Verify by reading the buffer, not by eye: `gl.readPixels` on the live context
inside a double-rAF, then check that no frame's mid-tone share (120 <= L < 210)
drops near zero. Check at 390px as well as desktop.
