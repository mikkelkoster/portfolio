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
- Drag/swipe supported on touch
- **Never hardcode `opacity` on inner card elements** — the JS carousel owns opacity exclusively via `.is-peek` / `.is-hidden` classes on the outer `.cm-car__col`. Inline opacity on children will override the JS state silently and break the "active" appearance.

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
| `public/js/softbox-stage.js` | the scene — device, plinth, lighting, splats, glass |
| `public/js/stage-configs.js` | per-card shot lists and ground colours |
| `public/js/three.min.js`, `gsap.min.js` | vendored, loaded on demand |
| `public/images/{case}/plates/plate-N.webp` | the screens shown on the display |

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

---

## Update this file
Keep `CLAUDE.md` up to date as the project evolves:
- New carousel IDs → add to the table
- New color tokens → add to the colors table
- New spacing rules from Figma → update spacing section
- New components or sections → add their conventions
