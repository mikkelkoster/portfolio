/* Grey-ground variant of stage-configs.js, for the minimal build (index.html).
 *
 * The monitor sweep is DARKER than the colour version it replaces, not
 * lighter. Measured in linear terms the old blue top came to about 0.68
 * luminance; a neutral 0.72/0.73/0.75 comes to 0.73, so the silver enclosure
 * had less to stand against here than it did in colour and dropped out of
 * some shots entirely. 0.58/0.59/0.61 is about 0.59 and gives it an edge in
 * every camera setup.
 *
 * NOT one grey for all three. The ground exists to give the device a
 * silhouette, so it has to run opposite to the body: the two monitors are
 * silver and need a mid grey to have an edge against (the colour version
 * learned the same thing the hard way — a silver device on a near-white
 * ground simply vanishes). The phone is a black body and needs the bright
 * ground the rose original had, or it flattens into the backdrop.
 *
 * The only change is the ground. dstudio's trick is a neutral, near-monochrome
 * environment with the product itself the one thing carrying colour — so the
 * UI plates are untouched and the sweep behind them goes grey. Shots, sticky
 * chrome and models all come straight from the colour version; if a camera
 * move changes there, change it there and re-derive this file.
 */
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
    /* Graphite, not the silver of the colour build. See softbox-stage.js:
       a metal body reflects its surroundings, and this build surrounds it with
       a grey of the silver's own value. */
    enclosure: "#6e747b",
    /* ── the quality path, Maersk only ──────────────────────────────
       Deliberately on ONE case. Formalize sits directly below it running
       the base path on the same page, in the same scroll, on the same
       hardware — which is the only honest way to judge whether any of this
       is worth what it costs. Delete this block and the film renders
       exactly as the other two do.

       fov 22 is roughly a 105mm equivalent, up from 34 (~65mm). The framing
       guard in applyRig derives the distance from the fov, so this reframes
       itself rather than needing every shot retyped. */
    quality: {
      hdrEnv: true,
      /* Both OFF, and this is the finding rather than a compromise reached
         early. They are the only two effects here that need the scene in a
         render target, and a full-resolution buffer does not fit in this
         frame — see the measurements in softbox-stage. Worse, moving the
         scene off the canvas gives up the canvas's own MSAA, and a render
         target cannot get it back: three accepts `samples` on a target
         carrying a depthTexture and then never resolves it, and separating
         the depth into its own prepass costs another 15ms.

         The edge that regression produced was the first thing anyone
         noticed. Measured on the top bezel as RMS deviation of the
         sub-pixel edge from a straight line, where 0.289 is what a fully
         staircased edge gives:

           base path, canvas MSAA      0.129px
           post chain, no MSAA         0.365px   <- what shipped, and looked it
           post chain, MSAA 4          0.076px   <- but 3.4x the frame time

         So the buffer goes, and with it AO and bloom. What is left needs no
         buffer at all: the environment, the lens, the ground, the shadow
         map and the roughness map are scene setup, they cost nothing per
         frame, and the film renders straight to the canvas exactly as the
         base path does — same antialiasing, same budget. */
      ao: false,
      bloom: false,
      macroRoughness: true,
      fov: 22,
      fovNarrow: 32,
      /* 1.0 — supersampling is OFF, and this is the one item of the eight
         that did not survive being measured.

         At 1.4 it renders 1.96x the pixels, and this scene is fill-rate
         bound on the splat backdrop, so that is very nearly double the
         frame. Measured on the real card at its real size (3.2 megapixels
         on a 1440 desktop):

           base path            16.7ms median, 75% of frames on time
           quality, ss 1.4      30.3ms median,  1% of frames on time
           quality, ss 1.0      16.7ms median, 87% of frames on time
           quality, ss 1.0, AO off  16.7ms median, 83%

         So AO, bloom, the HDR environment and the 4096 shadow map together
         cost nothing measurable, and the entire regression was the
         supersample. 33fps to buy cleaner specular edges is not a trade
         worth making on a card that is mostly a UI screenshot.

         Specular aliasing along the chamfers is therefore still unsolved.
         FXAA would be affordable but softens text, which is the one thing
         this film cannot afford. */
      ss: 1.0,
      shadowMap: 4096,
      aoRadius: 0.28,
      aoIntensity: 0.9,
      bloomThreshold: 1.5,
      bloomIntensity: 0.55,
      exposure: 1.05,
      /* Measured, not chosen. The environment's peaks are what this whole
         path is for, but its MEAN sets the ambient, and raising the peaks
         raised both. Swept against the plinth, which is the darkest large
         surface in frame and so the most sensitive to ambient:
           gain 1.25 -> plinth 73,81,92
           gain 0.70 -> plinth 47,54,62
           gain 0.45 -> plinth 34,39,45
           gain 0.30 -> plinth 24,28,34   (base path: 21,27,35)
         0.30 puts the overall exposure back where the base path had it, so
         what changes is the SHAPE of the light and not its level. */
      ambientGain: 0.3,
    },
    ground: {
      /* Darker than the 0x6b6f73 the base path uses. A mid grey is the one
         value a graphite enclosure cannot separate from, and it is also the
         least studio-like choice available — product films go near-black or
         clean white, because both give the silhouette an edge to hold.
         Not black: at 0x2a2d31 the body still has something to sit against,
         and the vignette in the backdrop composite carries it the rest of
         the way down toward the corners. */
      deep: 0x2a2d31,
      low: [0.34, 0.35, 0.37],
      /* The bright end of the sweep, and it is what the enclosure has to
         stand against. At 0.92-0.98 it was effectively white, and a silver
         device on white has no edge: measured, the body renders perfectly
         well — force it to unlit green and 6.5% of the frame goes green —
         it simply has the same value as the ground behind it and vanishes.
         Dropping the top of the gradient is what gives it a silhouette. */
      high: [0.58, 0.59, 0.61],
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
    /* ── the lens only ─────────────────────────────────────────────
       Maersk's wides read much closer than these did, and the reason was
       never the shot list — both sit near distance 13. It is the lens.
       Visible width is 2 * dist * tan(fov/2) * aspect, so at fov 34 this
       film showed 13.6 units across where Maersk at fov 22 showed 8.8, and
       the device is 7.2 wide: 53% of the frame against 82%.

       So this block carries the focal length and NOTHING else. ao and bloom
       are off explicitly because StageQuality defaults them ON, and turning
       them on here would build a full-resolution post chain that does not
       fit in the frame budget. hdrEnv is off because this film's enclosure
       and ground were tuned against the 8-bit environment — swapping it is
       a separate decision, and the last time this scene's environment moved
       the device disappeared into it.

       The framing guard derives the distances from the fov, so the shot
       list needs no edits and the macros stay macros. */
    quality: {
      fov: 22,
      fovNarrow: 32,
      hdrEnv: false,
      ao: false,
      bloom: false,
    },
    /* Graphite, not the silver of the colour build. See softbox-stage.js:
       a metal body reflects its surroundings, and this build surrounds it with
       a grey of the silver's own value. */
    enclosure: "#6e747b",
    ground: {
      deep: 0x6b6f73,
      low: [0.34, 0.35, 0.37],
      /* Same reasoning as Maersk above: a silver device needs a ground
         darker than it is. */
      high: [0.58, 0.59, 0.61],
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
      deep: 0xc9ccd0,
      low: [0.56, 0.57, 0.59],
      high: [0.95, 0.95, 0.96],
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

  /* Torque — the Matas phone and its camera, carrying four of the app's own
     screens in light: Progress, History, a ride, and the Plan (2026-09-28).
     The captures are whole pages stitched from the app's demo build, cut
     below the status bar as Matas's are. The three tab screens pin their
     title bar at the top (cut from the plate, 149px, in its scrolled,
     tinted state with the hairline) and their floating tab bar at the foot,
     which brings its own cut-out picture so the page shows around it. The
     ride has no bar: its map scrolls away as it does in the app. */
  torque: {
    ground: {
      deep: 0xc9ccd0,
      low: [0.56, 0.57, 0.59],
      high: [0.95, 0.95, 0.96],
    },
    sticky: [
      [{ edge: "top", px: 149, lead: true }, { edge: "bottom", src: "public/images/torque/plates/tabbar-progress.png" }],
      [{ edge: "top", px: 149, lead: true }, { edge: "bottom", src: "public/images/torque/plates/tabbar-calendar.png" }],
      null,
      // Ride now mid-session: one screen, nothing pinned (2026-10-21).
      null,
    ],
    shots: [
      {
        // Progress: opens three-quarter from the left, as Matas does
        plate: 0, hold: 4.8, scroll: 0.5,
        from: { az: -24, el: 8,   dist: 19.9, tx: 0,    ty: 0.2,  roll: -2.2, key: 1, amb: 1 },
        to:   { az: -14, el: 5.5, dist: 18,   tx: 0.15, ty: -0.1, roll: -0.8, key: 1, amb: 1 },
      },
      {
        // the Calendar: closer, from the right, tilted — the reading shot
        plate: 1, hold: 4.4, scroll: 0.55,
        from: { az: 22,  el: 3,   dist: 17.2, tx: -0.2, ty: 0.35, roll: 3.4, key: 1, amb: 1 },
        to:   { az: 12,  el: 6,   dist: 15.8, tx: 0,    ty: 0,    roll: 1.2, key: 1, amb: 1 },
      },
      {
        // the ride: high to close, off-axis the whole way
        plate: 2, hold: 4.4, scroll: 0.45,
        from: { az: 21,  el: 18,  dist: 18.9, tx: 0.1,  ty: -0.15, roll: -1.4, key: 1, amb: 1 },
        to:   { az: 13,  el: 12,  dist: 17.2, tx: -0.1, ty: 0.1,   roll: 0.4,  key: 1, amb: 1 },
      },
      {
        // Ride now mid-session: low from the left, the mirror of the Calendar shot
        plate: 3, hold: 4.4, scroll: 0.4,
        from: { az: -21, el: 4,   dist: 17.6, tx: 0.2,  ty: 0.3,  roll: -3.0, key: 1, amb: 1 },
        to:   { az: -12, el: 7,   dist: 16.2, tx: 0,    ty: 0,    roll: -1.0, key: 1, amb: 1 },
      },
    ],
  },
};
