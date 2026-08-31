#!/usr/bin/env python3
"""
Composite a UI screenshot onto the screen of a photographic device mockup.

The mockups are grey-environment renders with someone else's product on the
screen. This warps one of our screenshots into the screen's quadrilateral so
the perspective matches, which is the whole trick behind the reference look:
a monochrome scene where the only colour is the product UI.

Needs Pillow and nothing else — no numpy, no OpenCV, no ImageMagick. The 8
perspective coefficients come out of a hand-rolled Gaussian elimination.

    python3 tools/mockup-composite.py

Adding a mockup:
  1. Find the screen's four corners. detect_quad() below does it automatically
     for a bright screen on a dark bezel; ALWAYS check its overlay output
     before trusting it.
  2. Add a row to JOBS.

Two things that matter and are easy to get wrong:
  - Cover-fit from the TOP, never stretch. The screenshots are 1.515:1 and
    these screens are 1.6-1.8:1, so stretching splays the UI text by up to
    18%. Losing rows off the bottom of a dashboard reads as a shorter
    viewport; stretched type reads as a mistake.
  - Grow the quad a few px outward. The screen edge is a soft pixel or two,
    and stopping short of it leaves a thread of the mockup's ORIGINAL
    screenshot showing. Overshooting lands on the black bezel, invisible.
"""
from PIL import Image, ImageDraw
import os
SP  = os.path.dirname(os.path.abspath(__file__))
REPO= '/Users/mikkelkoster/Desktop/Desktop/mikkelkoster-portfolio'

# quads measured off each mockup, verified visually against an overlay
QUADS = {
  '6a344b1f9efa73909650e794_s6.png': [(490,239),(1442,222),(1426,832),(471,816)],
  '6a344b20e9f2052ffa9e43d1_s1.png': [(370,143),(1581,146),(1587,825),(361,822)],
  '6a344b2092520a0bf5a75f0e_s2.png': [(466,223),(1477,219),(1475,793),(458,791)],
  # s3 is the angled over-shoulder scene, added for Formalize. Detected off the
  # bright screen against the dark bezel, then checked on an overlay.
  '6a344b1f959955ea089e4a8b_s3.png': [(852,172),(1640,230),(1568,794),(782,704)],
}

# mockup, source dir, screenshot, output name
JOBS = [
  ('6a344b1f9efa73909650e794_s6.png', 'maersk',           'maersk-dashboard.webp', 'maersk-shot-01'),
  ('6a344b20e9f2052ffa9e43d1_s1.png', 'maersk',           'maersk-list.webp',      'maersk-shot-02'),
  ('6a344b2092520a0bf5a75f0e_s2.png', 'maersk',           'maersk-detail.webp',    'maersk-shot-03'),
  # Formalize: the four screens the film already shows, so the sheet and the
  # film are the same product rather than two different tours of it.
  ('6a344b20e9f2052ffa9e43d1_s1.png', 'formalize/plates', 'plate-1.webp',          'formalize-scene-01'),
  ('6a344b2092520a0bf5a75f0e_s2.png', 'formalize/plates', 'plate-2.webp',          'formalize-scene-02'),
  ('6a344b1f959955ea089e4a8b_s3.png', 'formalize/plates', 'plate-3.webp',          'formalize-scene-03'),
  ('6a344b1f9efa73909650e794_s6.png', 'formalize/plates', 'plate-4.webp',          'formalize-scene-04'),
]

def solve8(A, b):
    """Gaussian elimination with partial pivoting for an 8x8 system."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(M[r][c]))
        if abs(M[p][c]) < 1e-12: raise ValueError('singular')
        M[c], M[p] = M[p], M[c]
        pv = M[c][c]
        for j in range(c, n+1): M[c][j] /= pv
        for r in range(n):
            if r == c: continue
            f = M[r][c]
            if f:
                for j in range(c, n+1): M[r][j] -= f * M[c][j]
    return [M[i][n] for i in range(n)]

def perspective_coeffs(dst, src):
    """Coefficients for PIL's PERSPECTIVE transform, which maps DEST -> SRC."""
    A, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -x*u, -y*u]); b.append(u)
        A.append([0, 0, 0, x, y, 1, -x*v, -y*v]); b.append(v)
    return solve8(A, b)

SS = 4     # supersample the mask so the screen edge is not stair-stepped
GROW = 3   # push the quad a few px outward. The screen edge is a soft one or
           # two pixels wide, and stopping short of it left a thread of the
           # mockup's original screenshot showing. Overshooting lands on the
           # black bezel, where it cannot be seen.

def grow(quad, px):
    cx = sum(p[0] for p in quad)/4.0
    cy = sum(p[1] for p in quad)/4.0
    out = []
    for x, y in quad:
        dx, dy = x-cx, y-cy
        d = (dx*dx + dy*dy) ** .5
        out.append((x + dx/d*px, y + dy/d*px))
    return out

import sys
ONLY = sys.argv[1:]                      # regenerate a subset by output name
for mock, srcdir, shot, out in JOBS:
    if ONLY and out not in ONLY: continue
    quad = QUADS[mock]
    base = Image.open(os.path.join(SP, mock)).convert('RGBA')
    W, H = base.size
    src  = Image.open(os.path.join(REPO, 'public/images', srcdir, shot)).convert('RGBA')

    # target aspect of the screen, averaged over both pairs of edges
    tw = (((quad[1][0]-quad[0][0])**2 + (quad[1][1]-quad[0][1])**2) ** .5 +
          ((quad[2][0]-quad[3][0])**2 + (quad[2][1]-quad[3][1])**2) ** .5) / 2
    th = (((quad[3][0]-quad[0][0])**2 + (quad[3][1]-quad[0][1])**2) ** .5 +
          ((quad[2][0]-quad[1][0])**2 + (quad[2][1]-quad[1][1])**2) ** .5) / 2
    target = tw / th

    # Cover-fit anchored to the TOP. The screenshots are 1.515:1 and the screens
    # are wider, so stretching would splay the UI text by ~18%. Losing rows off
    # the bottom of a dashboard reads as a shorter viewport; stretched type reads
    # as a mistake.
    sw, sh = src.size
    if sw / sh > target:
        # Too wide for this screen. Trimming the sides was taking 81px off each
        # of plate-3 — the whole left nav and part of the right of the UI — and
        # the side margins of a dashboard are its layout. Grow the canvas
        # downward instead, which costs nothing when the plate's last row is one
        # flat colour across its full width (it is, for every plate here).
        nh = int(round(sw / target))
        last = src.crop((0, sh-1, sw, sh)).convert('RGB')
        if len(set(last.getdata())) == 1:
            pad = Image.new('RGBA', (sw, nh))
            pad.paste(src, (0, 0)); pad.paste(src.crop((0, sh-1, sw, sh)).resize((sw, nh-sh)), (0, sh))
            src = pad
        else:
            nw = int(round(sh * target)); x0 = (sw - nw)//2
            print(f'  ! {out}: last row is not flat, falling back to trimming '
                  f'{x0}px off each side')
            src = src.crop((x0, 0, x0+nw, sh))
    else:                                # too tall: trim from the bottom only
        nh = int(round(sw / target))
        src = src.crop((0, 0, sw, nh))
    print(f'{out}: screen {tw:.0f}x{th:.0f} (aspect {target:.3f})  '
          f'source {sw}x{sh} -> {src.size[0]}x{src.size[1]}  '
          f'kept {100*src.size[1]/sh:.0f}% of height')

    quad = grow(quad, GROW)
    cs = perspective_coeffs(quad, [(0,0), (src.size[0],0), src.size, (0,src.size[1])])
    warped = src.transform((W, H), Image.PERSPECTIVE, cs, Image.BICUBIC)

    mask = Image.new('L', (W*SS, H*SS), 0)
    ImageDraw.Draw(mask).polygon([(x*SS, y*SS) for x, y in quad], fill=255)
    mask = mask.resize((W, H), Image.LANCZOS)

    base.paste(warped, (0, 0), mask)
    dest = {'maersk': 'maersk', 'formalize/plates': 'formalize'}[srcdir]
    w2 = 1800
    base.convert('RGB').resize((w2, round(w2*H/W)), Image.LANCZOS).save(
        os.path.join(REPO, 'public/images', dest, out + '.webp'), 'WEBP', quality=90, method=6)

# ── Phone mockups: how the screen quad is found ───────────────────────────
# The bezel is black against a mid-grey room, so the largest bright connected
# region is the screen. Two things about turning that into a quad:
#
#   The paste mask is the RECTANGLE, drawn rounded and warped into place — not
#   the bright region, and not its hull. The region is full of holes because a
#   screen's dark UI is not bright, and the placeholder shows through them. The
#   hull closes the holes but still tracks the bright pixels, so a dark edge in
#   the original screen pulls it inward and clips the new screenshot there.
#
#   The quad is the MINIMUM-AREA ENCLOSING RECTANGLE of that hull, not its
#   extreme corners. On a rounded rectangle the extreme points sit on the
#   corner arcs and fall about 10% short of the real corners, which leaves the
#   warped screenshot inset and a band of the original screen showing above and
#   below it. Rotating calipers over the hull edges returns the rectangle the
#   rounding was cut from. Overshooting is safe: the hull mask clips it back.
