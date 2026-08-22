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
 * across. Past about dist 8 the panel runs edge to edge, the bezel leaves
 * frame, and the shot stops reading as a DEVICE — it becomes a flat
 * screenshot pasted over the render. 8.3 is the practical floor.
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
        from: { az: -26, el: 11, dist: 16.8, tx: 0, ty: -0.2, roll: -1.6, key: 1, amb: 1 },
        to:   { az: -17, el: 9,  dist: 15.0, tx: -0.35, ty: -0.3, roll: -0.5, key: 1, amb: 1 },
      },
      {
        plate: 0, hold: 3.4,
        from: { az: 26, el: 1.5, dist: 5.4, tx: -2.15, ty: 1.35, roll: 8.5, key: 0.62, amb: 0.36 },
        to:   { az: 17, el: 4,   dist: 4.9, tx: -1.55, ty: 1.05, roll: 5.2, key: 0.66, amb: 0.36 },
      },
      {
        plate: 1, hold: 3.4,
        from: { az: -24, el: 2, dist: 5.6, tx: 1.6, ty: 1.2, roll: -7.5, key: 0.66, amb: 0.4 },
        to:   { az: -15, el: 5, dist: 5.1, tx: 1.0, ty: 0.7, roll: -4.2, key: 0.7, amb: 0.4 },
      },
      {
        plate: 2, hold: 4.4,
        from: { az: 12, el: 7,  dist: 14.6, tx: 0.2, ty: -0.1, roll: 1.4, key: 1.05, amb: 0.92 },
        to:   { az: 3,  el: 10, dist: 13.2, tx: -0.1, ty: -0.3, roll: 0.4, key: 1.05, amb: 0.92 },
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
        from: { az: 24, el: 5,   dist: 16.4, tx: 0.2, ty: -0.15, roll: 1.8, key: 1, amb: 1 },
        to:   { az: 15, el: 7.5, dist: 14.8, tx: 0.4, ty: -0.3, roll: 0.6, key: 1, amb: 1 },
      },
      {
        // macro from the left with the opposite roll to Maersk's, targeted at
        // the dense left columns of the supplier table
        plate: 1, hold: 3.5,
        from: { az: -27, el: 3,   dist: 5.5, tx: 1.9, ty: 1.1, roll: -9, key: 0.6, amb: 0.34 },
        to:   { az: -18, el: 5.5, dist: 5.0, tx: 1.25, ty: 0.75, roll: -5.4, key: 0.64, amb: 0.34 },
      },
      {
        // the angle Maersk has nothing like: high and looking down, close
        // enough to read the task panel but well short of losing the bezel
        plate: 2, hold: 3.5,
        from: { az: 9,  el: 26, dist: 9.4, tx: -0.3, ty: 0.5, roll: -2.4, key: 0.86, amb: 0.6 },
        to:   { az: -4, el: 19, dist: 8.6, tx: 0.1, ty: 0.2, roll: 1.2, key: 0.9, amb: 0.6 },
      },
      {
        // resolves left-of-centre, where Maersk resolves right-of-centre
        plate: 3, hold: 4.3,
        from: { az: -16, el: 12, dist: 14.2, tx: -0.4, ty: -0.2, roll: -1.2, key: 1.05, amb: 0.94 },
        to:   { az: -6,  el: 14, dist: 13.0, tx: 0, ty: -0.35, roll: -0.3, key: 1.05, amb: 0.94 },
      },
    ],
  },
};
