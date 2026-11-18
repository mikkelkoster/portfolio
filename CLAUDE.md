# Project: Mikkel Køster Portfolio

## Stack
- Single file: `index.html` — no build step, plain HTML/CSS/JS (styles in `v2.css`, script in `v2.js`)
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

### OPEN: GL_INVALID_OPERATION on every draw call
Both scene files log `Mismatch between texture format and sampler type
(signed/unsigned/float/shadow)` until Chrome silences the context — 256-375
entries per run, reproducible on localhost and on the deployed site, and
present identically with and without the framing guard.

Narrowed on 2026-09-01, by A/B under one CDP harness that counts the log
entries rather than by eye:

- **`shadowMap.enabled = false` silences it completely — 0 entries.** So it is
  the shadow sampler. The note inside `softbox-stage.js` records shadows as
  ruled out; that A/B was wrong, and the note should be read with that in mind.
- **The PMREM environment map is NOT the cause** — `scene.environment = null`
  still gives 340. That was the note's one remaining suspect and it is spent.
- Counter-intuitively it gets *quieter* under throttling: 256 unthrottled,
  14 on good 4G, 0 on slow 4G. Something is racing.

One mechanism was tried and **did not work**: `renderer.shadowMap.needsUpdate`
is set in `start()`, and the first `renderer.render()` of every frame is the
BACKDROP scene, which holds no shadow caster — so the flag looked like it was
being spent on the wrong scene. Moving it to just before the main-scene render
changed nothing (still 256-375), so that is not the mechanism, and the change
was reverted rather than shipped on theory alone.

All three films render correctly throughout, so this is a warning rather than a
fault. Next thing to pull: why throttling helps.

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

### Icons and the share card — 2026-09-01
The head had **no** `link rel=icon` and **no** `og:` tags at all, so nothing in
`public/meta/` was ever reached and the assets there were still v1 — a navy
square with blue MK, and a Fraunces/colour-portrait card. Both are redrawn in
the v2 language and the tags are now in `index.html`.

| Asset | Note |
|---|---|
| `public/meta/favicon.svg` | **the master.** 381 bytes, MK outlined from `GeneralSans-Medium.otf` — no font dependency, no webfont race |
| `favicon-32 / -192 / -512`, `apple-touch-icon` | all rasterised from that SVG at 1024 and downsampled, so they cannot drift from it |
| `/favicon.ico` | root path only, for crawlers that request it instead of reading the tags |
| `public/meta/og-image.png` | 1200x630, 171KB. Source is `og-card.html` |
| `public/meta/preview.html` | every icon size on light and dark, plus the card |

**The MK is optically centred off the raster, not off its box.** General Sans'
M carries a left side bearing and the tracking leaves a trailing gap after the
K, so box-centring put the pair 19px right of centre and 14px low in a 512
square. Measured and corrected to 58/58 and 156/156. The SVG bakes the same
correction into its path coordinates.

Medium, not Semibold, and sized so the ink is 83.6% of the square. 77% left it
mushy at 16px; 89% put the M and K within a pixel of the edge at tab size.
Semibold reads heavier than a system that is only 400 and 500.

`og-card.html` at the root was the v1 source and is **overwritten** with the v2
card. It has never been linked from any page.

To re-render either: Chrome `--headless --window-size=1200,630
--force-device-scale-factor=2 --screenshot`, then downsample to 1200x630. The
2x pass is what keeps the 80px display type clean.

There is nothing to cache-bust. No share card was ever advertised, so no
scraper holds a stale one.

### CLOSED: the monitor films losing the device on their macros — 2026-09-01
Mikkel's standing requirement: **the desktop device must be visible at all
times.** It is now enforced, and not by numbers.

The two previous fixes were both a table of hand-derived `dist` / `tx` values.
Both were computed against ONE card aspect and were therefore wrong at every
other breakpoint — visible width is `dist * tan(fov/2) * aspect`, and the card
measures 1.60 on desktop against 1.33 on a phone. A constraint that depends on
the viewport cannot be expressed as a constant in a shot list, which is why
this kept coming back.

`applyRig` in **both** scene files now projects the body's eight bounding-box
corners through the live projection matrix and, if the device covers the frame,
pushes the camera back by the minimum that brings a CORNER inside — ground
showing along one vertical edge of the frame and one horizontal edge. A corner
is the weakest condition that still reads as body, thickness and silhouette, so
the macros stay as close as they can while remaining macros *of* something.
`KEEP = 0.06` is the ground margin per side. Three iterations converge, since
projected size goes as 1/dist and the first multiply lands close.

Measured over a full 26s loop, mid-tone share (120 <= L < 210) inside the card:

| film | before | after |
|---|---|---|
| Maersk desktop | 7 of 47 frames under 5%, floor 2.7% | 0 frames, floor 14.0% |
| Formalize desktop | 13 of 47 under 5%, floor 2.1% | 0 frames, floor 16.2% |
| Maersk @390px | — | 0 frames, floor 7.8% |
| Formalize @390px | — | 0 frames, floor 8.1% |

The maxima are unchanged (66.1% / 57.1%), which is the check that the guard
only touches shots that need it and leaves the wides exactly as authored.

The shot list goes back to being pure authorship. Nothing in a config can
reintroduce this, and it holds at breakpoints nobody thought to check. The
header comment in `stage-configs-mono.js` still describes the old hand-derived
geometry and its "the macros are meant to lose the frame" note — that intent is
now overridden by the guard, deliberately.

Reproduce the measurement by driving Chrome over CDP, parking a film so it
fills the viewport, capturing `Page.captureScreenshot` every 550ms for a full
loop, and histogramming the card's rect. Do not judge it by eye, and do not
compare two separate page loads frame to frame — the loop is not deterministic
across loads, so any such diff is dominated by animation phase.


---

## CLOSED: the guard was a second camera move — 2026-09-07

Reported as "the panning is nice but then there is a very distinct zoom out
which does not seem smooth or natural." It was not the panning and it was not
new.

`applyRig` ran the framing guard **every frame**. The push-back it computes
depends on azimuth — a device seen obliquely is foreshortened and fits, the
same device seen head-on presents its full width and does not — and every shot
in the list rotates. So the guard's output moved through each shot, and because
it multiplies the authored distance it became a second camera move that nobody
wrote, running opposite to the authored one and larger than it.

Measured over a full loop as authored change in distance against rendered:

| lens | shot | authored | rendered |
|---|---|---|---|
| fov 34 | wide | −0.86 | −0.86 |
| fov 34 | macro 1 | −0.37 | **+0.96** |
| fov 34 | macro 2 | −0.37 | **+1.22** |
| fov 22 | wide | −0.87 | −0.05 |
| fov 22 | macro 1 | −0.37 | **+1.56** |
| fov 22 | macro 2 | −0.37 | **+1.79** |

Both macros were authored as slow push-ins and both rendered as pull-backs **on
the original lens**, before any of the quality work. A longer lens made it worse
rather than causing it.

It is now solved **once per shot**: sample the shot end to end, take the largest
push-back any point along it needs, hold that constant for the whole shot. The
authored move then renders exactly, offset to a distance where the device is in
frame at every point. That guarantee is strictly stronger than the per-frame
version — satisfied for the whole shot rather than for the current instant — so
the CLOSED note above still holds. After:

| shot | mult | authored | rendered | max step/frame |
|---|---|---|---|---|
| wide | 1.13 | −0.86 | −0.97 | 0.054 |
| macro 1 | 2.41 | −0.37 | −0.89 | 0.005 |
| macro 2 | 2.79 | −0.37 | −1.03 | 0.006 |

`rendered / authored` equals the multiplier exactly for every shot, which is the
check that the move is the authored one scaled by a constant and nothing else.

The per-frame loop stays underneath as a safety net for the one case the solve
cannot see coming — the reader dragging the view. It is a no-op otherwise. The
solve is redone in `resize()`, because it is computed against a projection.

**Fixed in both scene files.** The phone film barely engaged the guard
(multiplier 1.00–1.05, a phone is narrow) so it never showed the artifact, but
it had the same code.

## `public/js/stage-quality.js` — the optional render path

Additive and gated: a stage takes it only by carrying a `quality` block in its
config, and if the file 404s the stages fall through to the base path. Only
**Maersk** carries one, deliberately — Formalize runs the base path directly
below it on the same page, which is the A/B.

| flag | what it does |
|---|---|
| `?film=base` | forces every card down the base path, lens included |
| `?capture=1` | `preserveDrawingBuffer` for `toDataURL`, and exposes `canvas.__rig` |
| `?qo=k:v,k:v` | overrides any quality dial for one load |

What it adds that the base path cannot do:

- **An environment above 1.0.** `buildEnvironment()` paints into a 2D canvas,
  which is 8-bit sRGB and therefore clamped — which is why the key slit had to
  sit at alpha 0.5. The float version paints the identical studio into a
  `Float32Array` so the slit can sit at 46.
- **Ambient occlusion**, 16-sample view-space hemisphere off the depth buffer.
  The painted `contactPool()` reads as contact under the foot but cannot reach
  the chin, the arm/base joint or the bezel seam.
- **Bloom**, thresholded in linear light at 1.5.
- Supersampling, **off** — see below.

### Tone mapping cannot simply move to the composite
Bloom needs linear light before the curve: after ACES a chamfer highlight and a
white UI card are both 1.0 and nothing separates them. But three tone-maps *per
material* and the screen plate opts out, because a UI screenshot's whites are
meant to be white. Running it through a composite that cannot tell it from the
aluminium turned every white card on the dashboard grey — the base path clips
45.2% of the frame at 250+, the naive composite clipped 0.0%, which sounds like
headroom and is the screen going dull. The screen **and the backdrop** are drawn
into a mask on camera layer 1, and the composite applies ACES everywhere the
mask is not set.

### The environment's mean is the exposure dial
Raising the peaks raises the ambient, because irradiance is the map's average.
Swept against the plinth, the darkest large surface in frame:

| ambientGain | plinth |
|---|---|
| 1.25 | 73,81,92 |
| 0.45 | 34,39,45 |
| **0.30** | **24,28,34** |
| base path | 21,27,35 |

At 0.30 the backdrop matches the base path exactly (161,162,166 against
160,162,166), so what changed is the shape of the light and not its level.

### The render target itself does not fit — AO and bloom are OFF
Superseded twice, so the first two conclusions here were wrong and are recorded
as such.

**First wrong conclusion:** that supersampling was the only thing that cost
anything. It did cost the most at the time (ss 1.4 took the median from 16.7ms
to 30.3ms), but turning it off left a worse problem underneath.

**The problem underneath:** moving the scene into a render target gives up the
canvas's antialiasing. `antialias: true` applies to the DEFAULT framebuffer
only. Mikkel spotted it immediately — "on the edges of the device, it looks
pixelated." Measured on the top bezel as RMS deviation of the sub-pixel edge
from a straight line, where 0.289 is what a fully staircased edge gives:

| | RMS |
|---|---|
| base path, canvas MSAA | 0.129px |
| post chain, no MSAA | **0.365px** |
| post chain, MSAA 4 | 0.076px |

**Second wrong conclusion:** that `samples: 4` fixes it cheaply. three accepts
`samples` on a target carrying a `depthTexture` — the target reports 4 — and
then never resolves it. AO needs that depth, so the two cannot share a target;
splitting the depth into its own prepass works but costs ~15ms.

**What actually fits.** On the real card at 3.2 megapixels, where the base path
already sits at 16.7ms against a 16.7ms budget with no headroom:

| | median | frames on time |
|---|---|---|
| base | 16.7ms | 78% |
| post chain, no MSAA, AO + bloom | 31.3ms | 1% |
| post chain, MSAA 4, no AO/bloom | 42.4ms | 0% |
| post chain, MSAA 4, AO + bloom | 57.5ms | 1% |
| **no post chain at all** | **16.7ms** | **78%** |

MSAA on a 3.2MP half-float target is ~26ms by itself. There is no arrangement
of a full-resolution buffer that fits in this frame.

So `ao` and `bloom` are **off**, and `usePost` in softbox-stage is false unless
one of them is on — in which case the film renders straight to the canvas and
keeps its MSAA. Everything else in the quality block needs no buffer: the HDR
environment, the lens, the ground, the shadow map and the roughness map are
scene setup and cost nothing per frame. Final state measures 16.7ms / 78%,
identical to base, with the edge at 0.078px against base's 0.129px.

The post chain code is kept and still works — flip `ao` or `bloom` on and it
builds. It is simply not affordable at this card size on this hardware.

### Already done, do not redo
`brushed()` already generates a 2048x1024 directional abrasion map used as
`roughnessMap` with anisotropy 0.6. The quality path adds only a low-frequency
blotch layer on top, because the existing map is uniform at panel scale.

## CLOSED: the screen overlays were blending in gamma space — 2026-09-07

Reported as "in the Remotion render you can see the grey background in the UI,
on the live path the entire background is white."

Every film lays an additive reflection over its picture — the monitor's glare
streak, the phone's sheen bar and its lit glass layer. All of them were
separate meshes with `AdditiveBlending`, and that is the bug: the canvas is
sRGB-encoded, so the blend happens in **gamma space**, where the transfer curve
is almost flat near white. A constant added up there is worth roughly two and a
half times as much linear light as the same constant added low down — the exact
inverse of how a reflection behaves.

It was doubled by a second effect. `glareTex` and `sheenTex` carry no
`colorSpace`, so three treats them as linear and sRGB-encodes on output: 0.05
of linear light leaves the shader as 0.24, and *that* is what got added.

The plates cannot survive it. Maersk's page background is `rgb(247,247,247)`
against cards at 255 — eight levels apart. Matas is worse: **44.3% of its
plate is at 255 and 47.2% sits in the 240-252 band.**

Measured on the Maersk film, share of neutral-bright pixels:

| | at 255 | 240-252 | navy header mean |
|---|---|---|---|
| additive quad (was shipping) | 88.2% | 7.9% | 40.2 |
| **added in linear** | 82.8% | **12.8%** | **47.2** |
| glare off entirely | 80.1% | 15.3% | 36.8 |
| the plate itself | 81.5% | 15.1% | — |

Better on **both** axes at once: 62% more of the page grey survives and the
reflection reads *harder* on the navy header. That asymmetry is the whole
point — the same added light is a four-fold lift at linear 0.02 and nothing at
0.93.

The fix, in both scene files: the reflection is sampled inside the SCREEN's own
material via `onBeforeCompile` and added to `diffuseColor` — which is linear,
because three encodes once at the end. The old quad is kept but masked to the
bezel with a soft edge, or the streak would be applied twice.

On the phone the same change costs 0.3pp of clipping (4.2% -> 4.5%) against
19.2% of greys retained, i.e. the sheen is now essentially free.

**Two things that will bite anyone repeating this:**
- The screen materials had **no `map` at first compile**, so `vMapUv` was never
  declared and the injected shader failed silently — the film renders blank. A
  1x1 white placeholder texture at construction fixes it.
- The screen and the overlay are **both `MeshBasicMaterial` with a map and
  `toneMapped: false`**, so three hands them the same compiled program and one
  injection lands on both. Each needs its own `customProgramCacheKey`.

Dials: `glareLinear` / `sheenLinear` (default 1.2, capped so the added light
never exceeds 0.06), `glareGain`, `glassGain`. The phone reads them from
`?qo=` as well as from its config, because it carries no `quality` block and
otherwise could not be A/B'd. `?capture=1` now sets `preserveDrawingBuffer` on
**both** scene files; without it every measurement of the phone read zero.

**Still open:** the phone's lit glass layer (`MeshStandardMaterial`, additive,
sampling the environment) is still blended in gamma. It is a reflection of the
room rather than a bar, so it is spread out and much fainter than the sheen,
but it is the same error. Fixing it properly means either replicating the IBL
sample inside the screen shader or moving the screen to a Standard material
with the plate as `emissiveMap` — the second is probably right and is a
bigger change than this one.

## CLOSED: the monitor's glass cannot carry a shaped highlight — 2026-09-08

Asked for after a reference film (dstudio's Tryeden page): "the highend glare
of the device and how smooth the panning and zooming is."

The first thing to know about that reference is that it is **a pre-rendered
MP4** — 1194x720, 11.9s, looping, and `document.querySelectorAll('canvas')`
returns nothing. It is not real-time, so none of its smoothness is evidence
that a browser can do the same thing.

### The reasoning that looked right and was not

Every source in `buildEnvHDR` sits behind or beside the device: the key at
u 0.24 is diametrically opposite the camera, and the slit runs u 0.117 to
0.742 and stops just short of the camera side. That is a deliberate rim-light
setup. A panel facing the lens mirrors what is BEHIND the lens, and behind the
lens this studio is bare gradient.

So the obvious diagnosis was that the earlier reflective-overlay attempt —
recorded above as "a flat -3 levels across 96% of the pixels, not a highlight"
— had failed for want of anything to reflect, and that adding a front source
would bring it to life. A `frontKey` dial was added to `stage-quality.js` to
test exactly that (`frontKey`, `frontKeyU/V/W/H`, default 0, off).

It does not. Measured on Maersk's macro at t=5.5, against a baseline of
88.77% of neutral-bright pixels clipped at 255 and 10.08% held in the
240–252 band:

| frontKey (narrow strip, v 0.46) | % at 255 | % in 240–252 | coarse SD |
|---|---|---|---|
| off | 88.77 | 10.08 | 39.09 |
| 6   | 91.72 | 7.12  | 39.18 |
| 12  | 92.47 | 6.39  | 39.23 |
| 20  | 92.98 | 5.90  | 39.28 |
| 12, broad box at v 0.50 | 98.70 | 0.69 | 39.45 |

`coarse SD` is the spread of the panel's luminance over a 12x8 grid — how
much the picture VARIES across the glass. It is the number that would move if
a highlight had appeared. It moves by 0.09 while the grey band loses three
points. The reflection arrives as a uniform wash and the wash eats the
interface's separation between its white cards and its grey page.

The cause is geometric, not a matter of dose or placement. The panel is flat
and a PMREM environment is infinitely far away, so across the glass the
mirrored direction varies only slowly and smoothly; a source broad enough to
cover the sweep is uniform over it, and one narrow enough to be structured
leaves the panel entirely (v 0.52 measured 89.35/9.59, essentially baseline).
The reference device gets its travelling glare from **curved** glass. Ours is
a flat slab and no lighting change fixes that.

**So the earlier verdict was right, and the reason given here for overturning
it was wrong.** The dials are left in, defaulted off, so this is not
rediscovered a third time.

### Do not redo either of these

- **Converting the monitor's screen to a `MeshStandardMaterial` emitting the
  plate as `emissiveMap`.** It was written, it compiles, and it is redundant:
  `roomMat` already puts an additive Fresnel-weighted dielectric quad over the
  whole glass at `FACE_Z + 0.010` sampling `scene.environment`. The reflection
  mechanism was never missing. (This is also the answer to the "still open"
  note at the end of the gamma-blending section above, for the monitor.)
- **`ACESFilmicToneMapping(x, 1.0)` inside an injected chunk.** three's is
  one-argument and is not declared at all on a `toneMapped: false` material.
  The phone stage defines its own `mkAces` for this reason. Note that the
  ACES fit has a slope near 0.21 at the origin, so it scales an ordinary
  reflection down by five before it ever approaches clipping — if a curve is
  ever wanted there again, a soft knee (linear below ~0.55, exponential
  approach to 1) is the right shape, not a grading curve.

### `public/dev/env-probe.html`
One film, one instant, one fixed canvas size, `?case=`, `?at=` and `?qo=`.
Two loads of the same URL are bit-identical (verified: mean delta 0, max 0),
which is what makes a one-dial A/B trustworthy. `window.__stat()` from
`screenstat.js` returns the panel histogram and the coarse SD above.

Beware measuring the "panel" on a WIDE shot: the detector takes the widest
bright run per row and at those framings the backdrop qualifies, so the
region grows between configurations and the numbers stop being comparable.
The macro shots are the honest place to measure.

## The monitor films are pre-rendered — 2026-09-08

`public/videos/maersk-loop.mp4` and `formalize-loop.mp4` (1792x1120, 15.2s,
30fps, h264 yuv420p, no audio track, faststart) are the **same scene, the
same shot list and the same materials** as the live path, rendered offline
through Remotion and played as `<video loop muted playsinline preload=none>`.

**Matas is not on this path and cannot be.** Its plates scroll, and a
scrolling plate is exactly what a fixed render cannot carry. All of the live
scene code stays for it — and as the fallback below.

### What this actually buys, and what it does not

Offline there is no frame budget, so everything switched off for the live
card is switched back on: **8x MSAA, 2x supersampling, AO, bloom**, and five
accumulated sub-frames of **motion blur**. Supersampling alone measured
30.3ms against a 16.7ms budget in the browser and is the reason specular
crawl along the chamfers was left unsolved there.

**The smoothness argument does NOT hold, and was the original reason for
doing this.** Measured on this machine with all three cards forced back to
WebGL (strip `data-film`, remove the `<video>` elements, then sample rAF
gaps) against the shipped configuration:

| | median | p95 | % of frames on time |
|---|---|---|---|
| three live scenes | 16.7ms | 18.5ms | 99.7 |
| two videos + one live scene | 16.6ms | 18.4ms | 99.7 |

Identical. An earlier figure of "78% of frames on time" was quoted while
arguing for this change; it does not reproduce and should not be repeated.
The video path decodes 238 frames in 8s with **0 dropped**, which is good,
but so is the scene. Keep this change for the render quality, which is real
and visible, not for smoothness on a fast Mac. Whether it helps a weak
machine or a phone is UNMEASURED — plausible, but do not assert it.

### The fallback is real and is tested

`startFilm()` in `v2.js` returns false when there is no usable video element,
and on a video `error` it removes the element, clears `data-film`, drops the
card from `starting`/`handles`, and hands it to `startWebGL()`. Verified by
moving `maersk-loop.mp4` aside and reloading: the card built the scene, went
`is-live`, and ran at 1854x1158. Under `prefers-reduced-motion` it returns
true and does nothing at all — the poster IS the film's opening frame, so
that is the same still the scene would have held, and 6MB is not fetched.

Video handles register in the same `handles` map the scenes use, so the
existing visibility pass pauses them off-screen. Do not add a second
observer; the two would disagree.

### Re-rendering

The project is at `scratchpad/maersk-film` (outside the repo). It loads the
site's own scene scripts through `staticFile`, so **`public/js/*.js` and the
plates must be copied into its `public/` before a render** or it will
faithfully reproduce a stale scene. `render-loops.sh` does both films;
`--props='{"samples":5,"aperture":0,"shutter":0.5}'` is shutter-only
accumulation. Aperture is deliberately 0: the macros run to dist 3.6 and an
aperture wide enough to read would soften the interface the film exists to
show. Remotion writes a silent AAC track — strip it (`-an -c:v copy`), it is
about 600KB.

Compositions are `<Case>Loop`, `<Case>Draft` (quarter pixels, 4s) and
`<Case>Still`. Adding a case means adding one entry to `CASES` in
`src/Composition.tsx`.

### Verified on Safari and on iOS — 2026-09-08

Neither is reachable from the Chromium preview pane, and both were the
surfaces carrying the untested fixes. Two routes that need no extra
permission, worth reusing:

**iOS** — boot a simulator and drive it with `xcrun simctl` directly:
`xcrun simctl boot "iPhone 17 Pro"`, `open -a Simulator` (openurl fails with
"couldn't communicate with a helper application" until the app is running),
then `xcrun simctl openurl booted <url>` and `xcrun simctl io booted
screenshot <file>`. The simulator reaches the host's localhost. The native
integration wants `sudo xcode-select -s`, which needs the user's password.

Result: the narrow-screen gate holds. The session requested three.min.js,
both stage scripts and all seven plates, and **no .mp4 at all** — so an
iPhone gets the scene, correctly re-framed for 4/3 with the device intact,
and never downloads the 14MB.

**Safari** — screen recording was not granted, so the window could not be
screenshotted. Instead `public/dev/safari-check.html` reports its own
findings by `fetch`ing a URL whose query string the dev server logs. No
permission needed, and it reads back with `parse_qs`.

Result on AppleWebKit/605.1.15: `canPlayMp4 maybe`, `canplay true`,
`1792x1120`, `duration 15.2`, **`playResolved true`**, `advanced true`,
`currentTime 2.73` after a 2.5s wait. Autoplay is not refused.

Still untested: autoplay refusal itself (iOS Low Power Mode). It is now
mostly moot — phones do not take the video path at all — but a tablet
between 720 and 1024px does, and that is what `handBack` on a rejected
play() covers.

### Matas scanned — clean — 2026-09-08

Ten samples across the 13.6s loop, at the card's own retina buffer
(2200x1376), `blankReads 0` on every one. Three samples flagged a cluster
around (1142, 215) and **all three are false positives**:

```
  9  21  54 208 254 235 160 101 101
 32  56  86  97 196 252 254 237  94
 72  76  61  66  78 126 226 158  56
```

That is a continuous diagonal ridge — the polished chamfer highlight down
the phone's edge, one to two pixels wide — not a dot. The detector's cheap
pre-check only tests the four CARDINAL neighbours at ±5px, and a diagonal
line clears all four, so it reads as isolated. The monitor's real defect
looked nothing like it: 243 with 10–52 on every side, diagonals included.
If this test is reused, add the diagonals to the pre-check.

The speck defect could not have appeared here anyway: it lives in
`stage-quality.js`'s composite, and Matas carries no `quality` block, so `Q`
is null, `usePost` is false and none of that code runs.

### Scanning the LIVE phone film needs the iOS simulator

Not a preference — the other two routes do not work:

- **The preview pane** goes `hidden` whenever another app is in front
  (`document.hidden true`, `innerHeight 0`). No rAF, no IntersectionObserver
  — a freshly-constructed observer fires zero callbacks. The monitor films
  are immune because `renderAt` draws synchronously on demand; the phone
  stage has no such hook and runs only on `setAnimationLoop`.
- **Desktop Safari** suspends the rAF loop as soon as the tab loses focus,
  and a shell script cannot keep it frontmost. Every sample came back
  `blankReads 1` — the canvas is never drawn, which looks exactly like a
  missing `preserveDrawingBuffer` and is not.

The simulator has nothing else running, so its tab is always frontmost.
`xcrun simctl openurl booted <url>` plus a page that scans ONE frame and
reports through the dev server's log works every time. One sample per page
load, never a long loop — a long loop in a throttled tab stalls silently
between beacons and is indistinguishable from a crash.

`public/dev/matas-scan.html` does this; `?capture=1` is required
(`preserveDrawingBuffer`), and `?at=` picks the offset.

### `public/dev/` is now gitignored
Everything committed is deployed — `outputDirectory` is `"."` and there is no
`.vercelignore`. The comparison harnesses and the multi-megabyte captures
they load must never be tracked. `public/dev/film-vs-render.html` puts the
live scene and the video side by side at the same instant and the same buffer
size; verified matching at t = 1.2, 9.0 and 13.5.

## Personal projects — 2026-11-17

Torque was renamed **Chapeau** (chapeau-app.com), and two more products of
Mikkel's own were added: **Hausy** (hausy.dk) and **Klar** ("Klar: Car Remote" on the
App Store, id6824203026; the car remote that started as Varme. Its card links
to the App Store, not to the support pages on klar-car.vercel.app). All three live in ONE row,
`#personal`, between Selected work and Additional work. Selected work is back
to the three client cases, numbered `/ 03`.

### Why a row and not three case cards
A case card is a 16:10 product film with a case study behind it. These have no
case study, and three more films would have put seven moving devices on one
page. The row reuses the Additional work column (`.cl-col`, `--col3`, the
`data-car` engine), so the tiles in the two rows start on the same x and the
phone layout is the existing carousel. Three cards fit a desktop exactly, and
`showControls()` hides the dots and arrows when nothing can scroll.

| Class | What it is |
|---|---|
| `.pp-col` | marks a column as a personal project; caps its width below 900 |
| `.pp-card` | the 4/5 tile, an `<a>` to the product's site. Hover tint comes from `--brand`, same as `.cl-card` |
| `.pp-screen` | a flat phone screen, 58% of the tile, running off the bottom. Bezel is a 5px `box-shadow` spread so it follows the elliptical radius |
| `.pp-video` | the Chapeau loop over its poster. Fades in on `playing` |
| `.pp-link` | the site address in blue — it is pressable, so it is allowed to be |

### Assets
| File | Source |
|---|---|
| `public/videos/chapeau-loop.mp4` | `assets/hero/app-loop-2.mp4` from chapeau-app.com (720x1566, 40.8s), re-encoded to 540x1174, crf 27, no audio, faststart. 1.6MB |
| `public/images/personal/chapeau-poster.webp` | frame 0 of that re-encode, NOT the site's own poster. The poster and the first frame have to be the same picture |
| `public/images/personal/hausy-home.webp` | hausy.dk at 402x874 @3x in headless Chrome, downsampled to 600 wide |
| `public/images/personal/klar-home.webp` | `AppStore/screenshots/6.3/1-home.png` from the Klar repo (`mikkelkoster/Fiat-500`), 600 wide |

All three screens are 1206x2622 in proportion. A new one has to match, or the
`aspect-ratio` on `.pp-screen` crops it.

To refresh the Chapeau loop when the site's hero video changes:
`ffmpeg -i app-loop-N.mp4 -an -vf scale=540:-2:flags=lanczos -c:v libx264
-preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart chapeau-loop.mp4`,
then cut the poster from the OUTPUT and bump both `?v=`.

### The video has its own observer, deliberately
The note above says not to add a second observer for the case films. This is
not that: `.pp-video` is not a `[data-stage]` card and is never in `handles`.
Its block in `v2.js` attaches the source on first sight (verified: 0 requests
for the mp4 at load, at 1440x1000), plays above 25% visible and pauses below,
on both axes — which matters under 900px, where a card can be swiped off to
the side. Under `prefers-reduced-motion` no source is attached at all.

### Left in place
`public/images/torque/` and the `torque` entries in `stage-configs.js` /
`stage-configs-mono.js` are no longer referenced by any page. They were not
deleted in this change. Everything committed is deployed, so they are still
reachable by URL; remove them with `git rm` when the Torque name should be
gone entirely.

### Same day, second pass
- `#personal` now comes BEFORE `#work`, on request. The nav's "Work" anchor points at `#personal`.
- Nav anchors: Work, About, References, Experience (`.nav__anchors`). Below 900 they move into `.nav__sheet` behind `#nav-menu`; the LinkedIn button moves with them so the bar holds the name, Get in touch and the menu at 390px. `section[id]` carries `scroll-margin-top: var(--nav-h)`.
- Testimonials are **verbatim excerpts**, whole sentences cut from each recommendation, never reworded. The script that cut them asserted every sentence against the original. Order: Anders, Viki, Patrick, Emil, Leo, Simon, Adam. Each card keeps its full text in a hidden `.t-full`; "Read the full recommendation" opens it in `#t-dialog` (native `<dialog>`, a bottom sheet under 600px). The recommendations are NOT on LinkedIn yet, so nothing may link there until they are.
- `--sec` 156 → 128.
- Facts aligned across the page: Matas 2M+ everywhere, Finansforbundet 8+ products, Firstborn 6 months, Maersk role "Lead UX Designer" on the card as in Experience.
- `.vercelignore` added. `_sb.html`, `maersk.html`, `og-card.html`, `figma-challenge-icons.js`, `tools/`, `public/dev/` and this file are no longer deployed. Nothing linked to any of them.

- Hausy is built with Mark Petersen. `.pp-credit` on its link line names him and links his LinkedIn (tracking parameters stripped from the URL).
- Experience rows: `-webkit-tap-highlight-color: transparent` (the iOS highlight covered the whole 90px-tall, full-width button) and an `:active` dimming instead, enabled on iOS by an empty passive touchstart listener on `#xp-list`. The content fades and settles in as the row opens. Row images switch from lazy to eager once the list is within 150% of the viewport, because a lazy image in a closed (zero-height) row was only fetched on open and popped in mid-animation.

### Positioning pass, 2026-11-18
The site leads with craft, then people, then organisation, everywhere: hero "Maker. Player-coach. Design at scale.", the How I work rows in the same order, and a "Hands-on" field on every case card (what Mikkel made himself) where "Scope" used to be. The About stats pair "25+ designers led" with "3 products I've designed and built myself". Testimonials open with Emil, the engineering lead who says the design system was built by Mikkel. Keep this order when adding copy: a reader who skims must meet the hands-on proof before the leadership.
- Testimonial dialog focus: opens with focus on `.t-d-inner` (tabindex -1, autofocus, no outline), so Safari draws no ring on the X. On close, focus returns to the button only when it was opened from the keyboard (`click` with `detail === 0`); after a tap or mouse click the restored focus is blurred so the link text gets no ring.

### Case sheet close button, performance (2026-11-18)
Measured with Chrome at 4x CPU slowdown on a 390px phone, the close button's light/dark check was the only real jank on the site: the sheet froze 180-200ms as it opened and frames reached 550ms while it scrolled. Three causes, three fixes:
1. Reading a pixel straight from an `<img>` decoded the whole 1800px file on the main thread. The pixel is now cut out with `createImageBitmap(img, x, y, 1, 1)`, which runs off the main thread.
2. A canvas costs a one-off setup on first draw (280ms at 4x). The 1x1 read now happens in an inline Worker on an `OffscreenCanvas`; browsers without it fall back to a main-thread canvas made on first use.
3. `elementsFromPoint` ran on every scroll frame. `queueCloseTheme` now runs at most every 120ms with a trailing call; `updateCloseTheme` is async and a newer call supersedes an older one (`themeToken`).
The pixel is still read at full resolution: a 64px downscaled copy was tried and gave different answers at image edges. Verified identical light/dark decisions at every 400px of all three cases, in Chrome and WebKit, before and after.
After: sheet open max frame 33ms at 4x, no long tasks; scroll inside the sheet 17ms. Everything else on the page already held 60fps at 4x (page scroll, carousels, accordion, dialog, menu); CLS 0.02.
- Reveal (`.rise`) easing is ease-out (`--rise-ease: cubic-bezier(0.22, 1, 0.36, 1)`, transform and clip-path .7s, opacity .45s ease-out), replacing the in-out curve that hesitated before moving. `.car-pill` is positioned with `transform: translate(var(--pill-x))` set from JS instead of `left`; positions verified identical before and after on all three rows at 1440 and 390.
