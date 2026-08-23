/**
 * Per-card camera and colour setups for the studio stage.
 *
 * The two cards share a scene and differ only here. That is deliberate: the
 * device, plinth, lighting rig and glass response are the same imaginary
 * studio, and what changes is how it was photographed. Two cards running the
 * identical camera move would read as one asset pasted twice.
 *
 * Geometry that bounds every shot: visible width is roughly
 * 2 * dist * tan(17deg) * aspect scene units, and the enclosure is 7.19
 * across. Below that width the panel runs edge to edge, the bezel leaves
 * frame, and the shot stops reading as a DEVICE — it becomes a flat
 * screenshot pasted over the render.
 *
 * The card renders at aspect 1.06 at every breakpoint, which puts the fit
 * distance at 7.19 / (2 * tan(17deg) * 1.06) = 11.1. An earlier note here
 * claimed a floor of 8.3; that was written when the card was wider, and two
 * rounds of "closer" then took the establishing shots to ~9.5-10.6 — under
 * the real threshold, which is why the monitor lost its frame and stand.
 * tx shifts the look-at target, so it comes straight off the margin: a wide
 * needs (3.595 + |tx|) / 0.324, not a flat 11.1. Each pair is then set from
 * whichever end needs more room, since a shot has to push IN, not pull out.
 * The macros are meant to lose the frame; that is what makes them macros.
 */
/* A NOTE ON key/amb, which are now 1 everywhere.
 *
 * These used to grade each setup separately — macros darker so the screen
 * was the only thing left with value in it — on the reasoning that a real
 * shoot relights between setups. It does, but it also grades the result
 * back to a continuous look, and that second half was missing.
 *
 * Measured with the camera held identical and only these two numbers
 * changed, the grade moved the whole frame's mean brightness by 14 levels
 * between shots and the backdrop gain by 29%. Because the change lands on a
 * cut it arrives instantly, four times a loop, on a four-second rhythm —
 * which reads as the lights jumping up and down rather than as a look.
 *
 * They are still wired through applyRig, so regrading is a matter of
 * putting numbers back here. If you do, use a much smaller range.
 */
window.STAGE_CONFIGS = {
  /* Maersk — opens wide from the LEFT, two macros at eye level, resolves
     near-frontal. Cool cyan ground. */
  maersk: {
    ground: {
      deep: 0x3f86af,
      low: [0.2, 0.47, 0.64],
      high: [0.92, 0.96, 0.98],
    },
    shots: [
      {
        plate: 0, hold: 4.0,
        from: { az: -26, el: 11, dist: 13.7, tx: 0, ty: -0.2, roll: -1.6, key: 1, amb: 1 },
        to:   { az: -17, el: 9,  dist: 12.8, tx: -0.35, ty: -0.3, roll: -0.5, key: 1, amb: 1 },
      },
      {
        plate: 0, hold: 3.4,
        from: { az: 26, el: 1.5, dist: 3.99, tx: -2.15, ty: 1.35, roll: 8.5, key: 1, amb: 1 },
        to:   { az: 17, el: 4,   dist: 3.62, tx: -1.55, ty: 1.05, roll: 5.2, key: 1, amb: 1 },
      },
      {
        plate: 1, hold: 3.4,
        from: { az: -24, el: 2, dist: 4.15, tx: 1.6, ty: 1.2, roll: -7.5, key: 1, amb: 1 },
        to:   { az: -15, el: 5, dist: 3.78, tx: 1.0, ty: 0.7, roll: -4.2, key: 1, amb: 1 },
      },
      {
        plate: 2, hold: 4.4,
        from: { az: 12, el: 7,  dist: 12.9, tx: 0.2, ty: -0.1, roll: 1.4, key: 1, amb: 1 },
        to:   { az: 3,  el: 10, dist: 12.0, tx: -0.1, ty: -0.3, roll: 0.4, key: 1, amb: 1 },
      },
    ],
  },

  /* Formalize — deliberately the mirror image of the above, so the two never
     read as the same clip. It opens wide from the RIGHT rather than the left,
     rolls the opposite way, and swaps one of Maersk's two eye-level macros for
     a high looking-down angle that Maersk never uses. Four screens, so every
     cut also changes what is on the display; Maersk holds its first plate
     across two shots. Warmer, more indigo ground to match the card. */
  formalize: {
    ground: {
      deep: 0x4a6cae,
      low: [0.26, 0.4, 0.66],
      high: [0.93, 0.95, 0.99],
    },
    shots: [
      {
        // wide from the right, low — Maersk opens high and left
        plate: 0, hold: 3.9,
        from: { az: 24, el: 5,   dist: 13.9, tx: 0.2, ty: -0.15, roll: 1.8, key: 1, amb: 1 },
        to:   { az: 15, el: 7.5, dist: 13.0, tx: 0.4, ty: -0.3, roll: 0.6, key: 1, amb: 1 },
      },
      {
        // macro from the left with the opposite roll to Maersk's, targeted at
        // the dense left columns of the supplier table
        plate: 1, hold: 3.5,
        from: { az: -27, el: 3,   dist: 4.07, tx: 1.9, ty: 1.1, roll: -9, key: 1, amb: 1 },
        to:   { az: -18, el: 5.5, dist: 3.7, tx: 1.25, ty: 0.75, roll: -5.4, key: 1, amb: 1 },
      },
      {
        // the angle Maersk has nothing like: high and looking down. This one
        // IS inside the bezel — it is a detail shot, not an establishing one
        plate: 2, hold: 3.5,
        from: { az: 9,  el: 26, dist: 6.47, tx: -0.3, ty: 0.5, roll: -2.4, key: 1, amb: 1 },
        to:   { az: -4, el: 19, dist: 5.92, tx: 0.1, ty: 0.2, roll: 1.2, key: 1, amb: 1 },
      },
      {
        // resolves left-of-centre, where Maersk resolves right-of-centre
        plate: 3, hold: 4.3,
        from: { az: -16, el: 12, dist: 13.0, tx: -0.4, ty: -0.2, roll: -1.2, key: 1, amb: 1 },
        to:   { az: -6,  el: 14, dist: 11.7, tx: 0, ty: -0.35, roll: -0.3, key: 1, amb: 1 },
      },
    ],
  },

  /* Matas — a phone, not a monitor, so this one is driven by phone-stage.js.
     Three shots, one per screen, and what moves within each is the PAGE: the
     captures are whole pages (the first is 4.6 screens tall), so the camera
     creeps while the content scrolls underneath it.

     `scroll` is the fraction of the remaining page a shot travels. 1.0 would
     run 4.6 screens past the eye in three seconds, which reads as a flick
     rather than as reading, so the tall first plate travels least. */
  matas: {
    ground: {
      /* The rose the case already runs on. deep is the base the splats sit
         against; low → high is the range they carry it through. Same
         structure as the other two cards — bright low, deepening upward —
         transposed onto Matas's own palette rather than a new one. */
      deep: 0xE8899F,
      low:  [0.78, 0.42, 0.52],
      high: [1.00, 0.94, 0.95],
    },
    /* The chrome that does not scroll with the page. Heights are in the
       plate's own pixels, measured off the captures: the home screen's tab
       bar is 125 tall at the foot, and both inner screens carry the same
       94px nav header. Without these the bar travels off with the content
       and the screen reads as a long picture being dragged, not an app. */
    sticky: [
      { edge: "bottom", px: 125 },
      { edge: "top",    px: 94 },
      { edge: "top",    px: 94 },
    ],
    shots: [
      {
        // opens three-quarter from the left, creeping in and levelling out
        plate: 0, hold: 5.0, scroll: 0.42,
        from: { az: -24, el: 8,   dist: 19.9, tx: 0,    ty: 0.2,  roll: -2.2, key: 1, amb: 1 },
        to:   { az: -14, el: 5.5, dist: 18, tx: 0.15, ty: -0.1, roll: -0.8, key: 1, amb: 1 },
      },
      {
        // closer, from the right, tilted — the reading shot
        plate: 1, hold: 4.4, scroll: 0.72,
        from: { az: 22,  el: 3,   dist: 17.2,  tx: -0.2, ty: 0.35, roll: 3.4, key: 1, amb: 1 },
        to:   { az: 12,  el: 6,   dist: 15.8,  tx: 0,    ty: 0,    roll: 1.2, key: 1, amb: 1 },
      },
      {
        /* High to close, the shortest page so it can travel. It used to end
           near-frontal at az -5, and a phone shot square-on has no body in
           it — no rail, no thickness, no edge for the key to catch — so it
           read as a screenshot laid on a pink card rather than as a device.
           It stays off-axis the whole way now. */
        plate: 2, hold: 4.2, scroll: 0.85,
        from: { az: 21,  el: 18,  dist: 18.9, tx: 0.1,  ty: -0.15, roll: -1.4, key: 1, amb: 1 },
        to:   { az: 13,  el: 12,  dist: 17.2, tx: -0.1, ty: 0.1,   roll: 0.4,  key: 1, amb: 1 },
      },
    ],
  },
};
