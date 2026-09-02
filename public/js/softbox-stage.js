/**
 * A studio product shot on a canvas.
 *
 * The shot list and the ground colour are arguments rather than constants,
 * because two cards on the same page running the identical camera move would
 * read as one asset used twice. Everything else — the device, the plinth, the
 * lighting rig, the glass response — is shared on purpose: they are the same
 * imaginary studio, photographed differently.
 */
window.initSoftboxStage = function (canvas, config) {
  "use strict";

  const plateUrls = config.plates;
  const SHOTS = config.shots;
  const GROUND = config.ground;

  const THREE = window.THREE;
  const gsap = window.gsap;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── device proportions ─────────────────────────────────────────── */
  const SCREEN_W = 6.99, SCREEN_H = 4.37;
  const BEZEL = 0.055;
  const GLASS_W = SCREEN_W + BEZEL * 2, GLASS_H = SCREEN_H + BEZEL * 2;
  const BODY_W = GLASS_W + 0.1, BODY_H = GLASS_H + 0.1;
  const BODY_D = 0.3, BODY_BEVEL = 0.03, BODY_R = 0.125;
  const GLASS_D = 0.022, GLASS_BEVEL = 0.005, GLASS_R = 0.075;
  const GLASS_Z = BODY_D / 2 + BODY_BEVEL - 0.004;
  /* Derived, never hand-typed. The bevel on an extrusion pushes the front
     face past depth/2, so a screen plane placed at depth/2 sits INSIDE the
     glass and renders black. Deriving it from the glass makes that
     impossible. */
  const FACE_Z = GLASS_Z + GLASS_D + GLASS_BEVEL + 0.008;

  const ARM_W = 1.28, ARM_H = 1.3, ARM_D = 0.12, ARM_Z = -0.26;
  const BASE_D = 1.62, BASE_T = 0.045, BASE_FWD = 0.62, DROP = 0.2;
  const BASE_Y = -BODY_H / 2 - ARM_H + DROP;
  const GROUND_Y = BASE_Y - BASE_T - 0.014;

  /* The enclosure colour, and it is per-case for a reason.
     This device is metal — metalness 0.9 — so almost all of what you see on
     it is the environment reflected back, tinted by this colour. That makes
     the body's read entirely relative to its surroundings, and it is why the
     Formalize film kept losing its device: in the mono build the environment
     IS a neutral grey of roughly this value, so a silver body reflecting it
     comes back the same tone as the backdrop behind it and the enclosure
     disappears, leaving the picture floating over its own contact shadow.
     Every previous attempt at this went at the environment — the strip
     light's opacity, then the ground sweep. Both help and neither is stable,
     because they are trying to hold a gap open from the far side. Setting the
     body darker than the ground fixes it from the near side: the silhouette
     then reads on base colour, not on reflection contrast, whatever the
     backdrop does. The colour build keeps the silver it has always had. */
  const ALU = config.enclosure || "#cdd2d9";

  /* How much room the glass gives back. The single dial for the shaped
     reflection: 0 removes it, and much past 0.8 the softboxes start to
     compete with the UI on the wide shots.

     Deliberately low. The reference this is matched against keeps its
     screens completely clean — even the frames shot from well off-axis,
     where a real glossy panel would be showing the room. What makes those
     read as expensive is the BODY: a hard highlight down the chamfer, not
     anything happening on the glass. So this stays as a hint that the panel
     is behind something, and the budget goes into the strip light and the
     aluminium. */
  const GLASS_ENV = 0.2;

  /* The plinth. Deliberately shallow in Z — a deep slab eats the lower
     third of every frame and the display looks stranded on a runway. The
     fillet is small on purpose too: at any real radius the edge stops being
     an edge and becomes a soft band eating a slice of both faces, which is
     what makes a block read as toy plastic rather than as machined. */
  const PL_W = 10.4, PL_D = 6.6, PL_H = 3.4, PL_R = 0.09;
  const PL_FRONT_Z = 2.75;
  const PL_TOP = GROUND_Y;

  /* ── renderer ───────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  /* ── An open one, so nobody re-walks the same path ────────────────
     Both scene files log, continuously and on every frame:

       GL_INVALID_OPERATION: glDrawArrays / glDrawElements:
       Mismatch between texture format and sampler type
       (signed/unsigned/float/shadow)

     until Chrome silences the context. It predates the mono build, it is a
     warning rather than an error, and all three films render correctly — so
     it is being tolerated somewhere in the pipeline. It is NOT the cause of
     the "device renders 2D" symptom; that was the phone's bezel mask size,
     see phone-stage.js.

     Ruled out by A/B, each one reloaded and re-observed:
       - shadows            shadowMap.enabled = false, error persists
       - material anisotropy  MeshPhysicalMaterial anisotropy 0.6 -> 0, persists
       - the splat backdrop   splats.mesh.visible = false, persists
       - transmission       not used by either scene
       - the hand-built mip chains  verified complete: buildMips halves to 1x1
                            and every level matches max(1, base >> k)
       - the two custom shaders  the splat material declares no sampler at all;
                            the vignette composite declares exactly one, bound
                            to bgRT.texture

     Not yet tested: the PMREM environment map. It is the remaining thing that
     writes a half-float target and is sampled by every lit material, and the
     drawArrays calls that survive with the splats hidden point that way.
     Note that getError() from JS returns clean — these come from Chrome's own
     command-buffer validation, so a patched context cannot catch them; it
     needs about:gpu or a native trace. */
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* Rendered ONCE, not every frame. A shadow map is built in the light's
     space, and here the light is fixed and so is everything casting into
     it — only the camera orbits. Left on auto, three re-rasterised the
     whole device into the depth target sixty times a second to arrive at
     an identical result. Refreshed by hand in start(). */
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  /* The DEEP end of the backdrop, not the average of it.
     Setting this to the pale Maersk blue directly was a mistake: the splats
     then had a base they barely deviated from, and the cloud flattened into
     a wash with no depth in it at all. What made the dark version work was
     RANGE — near-black at the top of frame building to a bright pool along
     the floor. Blue has to keep that range, so the base sits deep and the
     splats carry it up to near-white, passing through #B5E0F5 across the
     middle where most of the frame lives. */
  // the backdrop is composited in from its own low-res pass — see below
  scene.background = null;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

  /* ════════════════════════════════════════════════════════════════
     ENVIRONMENT — built, not loaded.

     At high metalness a material has no colour of its own; every pixel is
     the environment reflected off it. So the aluminium's realism is decided
     almost entirely by what surrounds it. A product studio is a simple,
     controlled room: bright zenith, clear horizon, dark floor, and two big
     softboxes. That vertical structure is the whole trick — as a curved
     surface turns, it sweeps zenith → horizon → floor, and the metal grades
     from near-white to mid-grey across the part. That gradient IS the read
     of brushed aluminium. A uniform environment gives you painted plastic.
     ════════════════════════════════════════════════════════════════ */
  function buildEnvironment() {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const g = c.getContext("2d");

    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0.00, "#ffffff");
    sky.addColorStop(0.30, "#e6ebf2");
    sky.addColorStop(0.46, "#aeb7c4");   // horizon
    sky.addColorStop(0.54, "#4e5661");
    sky.addColorStop(0.78, "#171b21");
    sky.addColorStop(1.00, "#0a0c10");
    g.fillStyle = sky;
    g.fillRect(0, 0, 1024, 512);

    // the softboxes — the things that actually show up as a highlight
    // running along an edge
    const box = (cx, cy, w, h, a) => {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, w);
      grad.addColorStop(0, "rgba(255,255,255," + a + ")");
      grad.addColorStop(0.55, "rgba(255,255,255," + a * 0.38 + ")");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.save();
      g.translate(cx, cy); g.scale(1, h / w); g.translate(-cx, -cy);
      g.fillStyle = grad;
      g.fillRect(cx - w, cy - w, w * 2, w * 2);
      g.restore();
    };
    box(250, 118, 235, 150, 0.95);  // key, upper left
    box(700, 165, 165, 108, 0.52);  // secondary, upper right
    box(890, 250, 118, 66, 0.3);    // glint near the horizon

    /* A narrow, very bright strip, and it is the single most important
       thing in this map for how the enclosure reads. The three boxes above
       are broad and soft, which lights the body evenly but gives the
       chamfers nothing to catch — a wide source reflected in a 2mm bevel is
       a wide, dim smear. The hard highlight running the length of a rail in
       a product film comes from a SMALL bright source, so that is what this
       is: a slit, not a box.

       Half opacity, not full. At 1.0 this clipped, and reflected in
       polished aluminium a clipping environment IS a white body — the
       Maersk enclosure washed out completely against its own backdrop and
       read as a missing device. A slit only has to be brighter than the
       softboxes around it, not brighter than the format allows. */
    const strip = g.createLinearGradient(0, 66, 0, 104);
    strip.addColorStop(0.00, "rgba(255,255,255,0)");
    strip.addColorStop(0.42, "rgba(255,255,255,0.5)");
    strip.addColorStop(0.58, "rgba(255,255,255,0.5)");
    strip.addColorStop(1.00, "rgba(255,255,255,0)");
    g.fillStyle = strip;
    g.fillRect(120, 66, 640, 38);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }
  scene.environment = buildEnvironment();

  /* ── lighting ───────────────────────────────────────────────────── */

  /* Soft ambient, kept deliberately low. Ambient is flat, directionless
     light added equally to every surface, and it is the biggest enemy of a
     metal read — it fills the dark side of the part and destroys exactly
     the gradient that makes aluminium look like aluminium. */
  const ambient = new THREE.AmbientLight(0xdfe7f2, 0.12);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xdce6f5, 0x0a0c10, 0.22);
  scene.add(hemi);

  /* KEY — the shadow caster. Upper left, matching the softbox in the
     environment above, so the reflections and the shadow agree about where
     the light is. Two sources implied in one frame reads as wrong even when
     you cannot say why. */
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(-8, 11.5, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 7;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  /* The frustum must cover the CASTER PLUS ITS SHADOW. Sized to the panel
     alone, the shadow stops dead at the frustum wall and reads as a hard
     bar lying across the floor. */
  const S = 9;
  Object.assign(key.shadow.camera, {
    left: -S, right: S, top: S, bottom: -S, near: 1, far: 44,
  });
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd8e6f5, 0.34);
  fill.position.set(8, 2.5, 8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xe4f2fb, 0.85);
  rim.position.set(-6, 4, -8);
  scene.add(rim);

  /* ════════════════════════════════════════════════════════════════
     GAUSSIAN SPLAT BACKDROP

     Anisotropic 3D gaussians, alpha-blended back-to-front — the same
     primitive a 3DGS renderer draws, with one honest difference: the
     splats here are AUTHORED, not trained. A captured scene comes out of
     photogrammetry as a .ply of tens of megabytes, which cannot be
     embedded in a self-contained page, and there is no external host to
     fetch one from. So the cloud is generated: a volume of soft ellipsoids
     shaped into a studio backdrop, with a bright pool where the key falls.

     What splats buy over a textured plane is that they have no silhouette.
     A backdrop plane always ends somewhere, and the eye finds that edge;
     a cloud of overlapping gaussians simply thins out. It is also
     genuinely volumetric — orbit and the cloud parallaxes against itself,
     which a flat cyc cannot do.

     Each splat is drawn as a billboarded quad whose two axes are the
     gaussian's principal axes projected into view space. That is the
     standard simplification of the full 3D covariance projection, and for
     a diffuse backdrop it is visually identical.
     ════════════════════════════════════════════════════════════════ */
  function buildSplats(count) {
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute("position", new THREE.Float32BufferAttribute(
      [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    quad.instanceCount = count;

    const pos = new Float32Array(count * 3);
    const ax1 = new Float32Array(count * 3);
    const ax2 = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const alp = new Float32Array(count);

    /* Seeded, so the backdrop is the same every load. A cloud that
       reshuffles on refresh is not a set, it is a screensaver. */
    let seed = 0x6d2b79f5;
    const rnd = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 1000000) / 1000000;
    };
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.4;

    for (let i = 0; i < count; i++) {
      // a broad shell behind and around the stage
      const x = gauss() * 26;
      const y = -3 + gauss() * 13;
      const z = -20 - Math.abs(gauss()) * 22;
      pos.set([x, y, z], i * 3);

      // anisotropic, and biased wide — long soft smears read as atmosphere,
      // round blobs read as bokeh
      const a = rnd() * Math.PI;
      const major = 3.2 + rnd() * 7.5;
      const minor = 0.9 + rnd() * 2.6;
      ax1.set([Math.cos(a) * major, Math.sin(a) * major, 0], i * 3);
      ax2.set([-Math.sin(a) * minor, Math.cos(a) * minor, 0], i * 3);

      /* The reference's structure, transposed into a pale key.
         Measured off the Eden clip, that backdrop is bright at the BOTTOM
         and falls to black going up — lit from below, a bright floor
         sweeping into darkness, so the device sits IN the light rather than
         against it. Inverting the palette does not mean inverting the
         structure: it stays bright-low, but "bright" is now near-white and
         "dark" is a deeper saturated cyan rather than black. Same read, and
         the top of frame still resolves instead of going flat. */
      const h = THREE.MathUtils.clamp(1 - (y + 9) / 26, 0, 1);
      const side = THREE.MathUtils.clamp(1 - Math.abs(x) / 34, 0, 1);
      const t = Math.pow(h, 1.55) * (0.4 + side * 0.6);
      const lo = GROUND.low;
      const hi = GROUND.high;
      /* Spanning most of the way from the deep base to near-white. The
         previous pass ran from light cyan to slightly-lighter cyan, which is
         why the volume disappeared — a cloud you cannot see the pools in is
         just a coloured rectangle with a cost. */
      const r = lo[0] + t * (hi[0] - lo[0]);
      const g = lo[1] + t * (hi[1] - lo[1]);
      const b = lo[2] + t * (hi[2] - lo[2]);
      col.set([r, g, b], i * 3);
      alp[i] = 0.11 + rnd() * 0.22;   // scaled for the lower count
    }

    quad.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
    quad.setAttribute("iAx1", new THREE.InstancedBufferAttribute(ax1, 3));
    quad.setAttribute("iAx2", new THREE.InstancedBufferAttribute(ax2, 3));
    quad.setAttribute("iCol", new THREE.InstancedBufferAttribute(col, 3));
    quad.setAttribute("iAlp", new THREE.InstancedBufferAttribute(alp, 1));

    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uGain: { value: 1 } },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      vertexShader: `
        precision highp float;
        in vec3 position;
        in vec3 iPos, iAx1, iAx2, iCol;
        in float iAlp;
        uniform mat4 modelViewMatrix, projectionMatrix;
        uniform float uGain;
        out vec2 vQuad;
        out vec3 vCol;
        out float vAlp;
        void main() {
          vQuad = position.xy;
          vCol = iCol * uGain;
          vAlp = iAlp;
          vec4 centre = modelViewMatrix * vec4(iPos, 1.0);
          // principal axes rotated into view space; only their screen-plane
          // components matter, which is what makes the splat billboard
          vec3 a1 = (modelViewMatrix * vec4(iAx1, 0.0)).xyz;
          vec3 a2 = (modelViewMatrix * vec4(iAx2, 0.0)).xyz;
          centre.xy += a1.xy * position.x + a2.xy * position.y;
          gl_Position = projectionMatrix * centre;
        }`,
      fragmentShader: `
        precision highp float;
        in vec2 vQuad;
        in vec3 vCol;
        in float vAlp;
        out vec4 fragColor;
        void main() {
          // the gaussian itself: falls off smoothly to nothing at the quad
          // edge, so no splat ever shows a boundary
          float g = exp(-2.6 * dot(vQuad, vQuad));
          float a = vAlp * g;
          if (a < 0.003) discard;
          fragColor = vec4(vCol, a);
        }`,
    });

    const mesh = new THREE.Mesh(quad, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return { mesh, mat, pos, ax1, ax2, col, alp, count, geo: quad };
  }

  /* 3000, down from 4200. Not because there are many of them but because
     each is a large alpha-blended quad with no depth rejection, so the
     backdrop is drawn over itself dozens of times per pixel — measured, the
     single largest cost in the scene. Fewer splats with proportionally more
     opacity each keeps the density the cloud reads by, and what it buys — a
     backdrop with no silhouette, that parallaxes — is unaffected. */
  const splats = buildSplats(3000);

  /* ── the backdrop, rendered small ────────────────────────────────
     Measured in the phone stage, which shares this code: the splat cloud was
     11.8ms of a 30.7ms frame at 1.38 megapixels — the single most expensive
     thing in the scene, and more than the device itself by a wide margin.
     The cost is overdraw, three thousand large alpha-blended quads with no
     depth rejection.

     It is also the element that can least afford it, being a soft volumetric
     gradient with no hard feature in it. Rendered at a third of the
     resolution and scaled up, the difference is invisible; the device, its
     screen and its edges still draw at full resolution over the top. */
  const BG_SCALE = 0.34;
  /* How far the backdrop falls off toward the frame edge. 0 is flat, which
     is what this was; much past 0.6 the corners go black and the card reads
     as a hole rather than a lit room. */
  const VIGNETTE = 0.2;
  const bgScene = new THREE.Scene();
  bgScene.background = new THREE.Color(GROUND.deep);
  bgScene.add(splats.mesh);
  const bgRT = new THREE.WebGLRenderTarget(2, 2, {
    depthBuffer: false, stencilBuffer: false,
  });
  bgRT.texture.minFilter = THREE.LinearFilter;
  bgRT.texture.magFilter = THREE.LinearFilter;
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  /* The composite is also where the backdrop gets its vignette, because the
     backdrop is already passing through a fullscreen quad here and a shader
     costs nothing extra at this point in the frame.

     This is what a studio sweep does and what the reference has: the ground
     stays lit where the device is and falls away toward the frame edge, so
     the corners stop competing and the eye is pushed to the middle. It
     multiplies, so it darkens the case colour rather than replacing it —
     the per-case hue is what stops the three films reading as one asset
     used three times, and it survives this untouched. */
  const bgQuadScene = new THREE.Scene();
  bgQuadScene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: {
        map: { value: bgRT.texture },
        amount: { value: VIGNETTE },
        start: { value: 0.32 },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        uniform float amount;
        uniform float start;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(map, vUv).rgb;
          /* Squashed slightly on y so the falloff follows the frame rather
             than describing a circle inside a landscape card. */
          float r = length((vUv - 0.5) * vec2(1.0, 0.9)) * 1.45;
          float v = 1.0 - amount * smoothstep(start, 1.0, r);
          gl_FragColor = vec4(c * v, 1.0);
          /* REQUIRED. three appends the colour-space conversion to its own
             materials but not to a ShaderMaterial, so without this the
             backdrop is written in linear and shown as sRGB — every ground
             came out dark and desaturated the moment the MeshBasicMaterial
             this replaced went away. */
          #include <colorspace_fragment>
        }
      `,
    })
  ));

  /* autoClear off for the main pass, or it wipes the composite the instant
     the device starts drawing. */
  function renderFrame() {
    renderer.setRenderTarget(bgRT);
    renderer.clear();
    renderer.render(bgScene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(bgQuadScene, bgCam);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
  }

  /* Back-to-front ordering, refreshed only when the view has actually
     turned. Alpha blending is order-dependent, so unsorted splats show as
     hard-edged overlaps — but re-sorting 4200 instances every frame to
     chase a camera moving a fraction of a degree is pure waste. Two
     degrees is below the angle at which any ordering error is visible. */
  let sortedAt = 1e9;
  const order = new Uint32Array(splats.count);
  const depth = new Float32Array(splats.count);
  const tmp = {
    pos: new Float32Array(splats.count * 3),
    ax1: new Float32Array(splats.count * 3),
    ax2: new Float32Array(splats.count * 3),
    col: new Float32Array(splats.count * 3),
    alp: new Float32Array(splats.count),
  };

  function sortSplats(az) {
    if (Math.abs(az - sortedAt) < 2) return;
    sortedAt = az;
    const m = camera.matrixWorldInverse.elements;
    for (let i = 0; i < splats.count; i++) {
      const x = splats.pos[i * 3], y = splats.pos[i * 3 + 1], z = splats.pos[i * 3 + 2];
      depth[i] = m[2] * x + m[6] * y + m[10] * z + m[14];
      order[i] = i;
    }
    const idx = Array.from(order).sort((a, b) => depth[a] - depth[b]);
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      for (let c = 0; c < 3; c++) {
        tmp.pos[k * 3 + c] = splats.pos[i * 3 + c];
        tmp.ax1[k * 3 + c] = splats.ax1[i * 3 + c];
        tmp.ax2[k * 3 + c] = splats.ax2[i * 3 + c];
        tmp.col[k * 3 + c] = splats.col[i * 3 + c];
      }
      tmp.alp[k] = splats.alp[i];
    }
    const g = splats.geo;
    g.getAttribute("iPos").array.set(tmp.pos); g.getAttribute("iPos").needsUpdate = true;
    g.getAttribute("iAx1").array.set(tmp.ax1); g.getAttribute("iAx1").needsUpdate = true;
    g.getAttribute("iAx2").array.set(tmp.ax2); g.getAttribute("iAx2").needsUpdate = true;
    g.getAttribute("iCol").array.set(tmp.col); g.getAttribute("iCol").needsUpdate = true;
    g.getAttribute("iAlp").array.set(tmp.alp); g.getAttribute("iAlp").needsUpdate = true;
  }


  /* ── the plinth ───────────────────────────────────────────────────
     One box, one material, so the top face has no seam. An earlier version
     of this scene laid a separate flat plane over the top to carry a
     reflection; two surfaces with different roughness meeting a fraction of
     a unit apart draw a hard line all the way round the top.

     Matte, near-black, almost no environment. In the reference the plinth
     returns nearly nothing — its whole shape is described by the key
     falling across the top face and dying on the front. Gloss here would
     compete with the device for attention and read as plastic. */
  const plinth = new THREE.Mesh(
    slab(PL_W, PL_D, PL_R, PL_H, 0.02),
    new THREE.MeshStandardMaterial({
      color: 0x15191f,
      /* Eased off 0.74/0.22, but only just. The note above still holds —
         gloss here competes with the device and reads as plastic — so this
         is not a polish, it is enough sheen for the new strip light to
         describe the front bevel and lay a soft gradient across the top
         face. That edge catching light is what says "surface" in the
         reference; a mirror would say "showroom floor". */
      roughness: 0.58,
      metalness: 0.05,
      envMapIntensity: 0.38,
    })
  );
  plinth.rotation.x = -Math.PI / 2;
  plinth.position.set(0, PL_TOP - PL_H / 2, PL_FRONT_Z - PL_D / 2);
  plinth.receiveShadow = true;
  /* castShadow off deliberately: it throws onto a floor you can barely see,
     and including it would force the key's shadow frustum wide enough to
     cover a 10-unit box — spending the whole texel budget on empty space
     and softening the one shadow that matters. */
  scene.add(plinth);

  /* ── geometry helpers ───────────────────────────────────────────── */
  function roundedRect(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function slab(w, h, r, depth, bevel) {
    const geo = new THREE.ExtrudeGeometry(roundedRect(w, h, r), {
      depth: depth - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 26,
    });
    geo.center();
    return geo;
  }

  /* ShapeGeometry derives its UVs from world coordinates, so a plane built
     this way arrives with UVs in scene units rather than 0..1 and the
     texture lands somewhere off in space. Remap them. */
  function facePlane(w, h, r) {
    const geo = new THREE.ShapeGeometry(roundedRect(w, h, r), 26);
    const p = geo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (p.getX(i) + w / 2) / w;
      uv[i * 2 + 1] = (p.getY(i) + h / 2) / h;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return geo;
  }

  /* ── brushed finish ─────────────────────────────────────────────── */

  /* Anodised aluminium is covered in fine directional abrasion, and that
     abrasion is the reason it reads as metal rather than grey plastic.
     Drawn as long horizontal strokes rather than random noise — noise gives
     a sandblasted finish, not a brushed one. Strokes that overflow the
     right edge are redrawn at x - w so the texture tiles without leaving a
     column of truncated ends, which would show up as vertical banding: the
     one direction this texture must have nothing in. */
  function brushed() {
    const w = 2048, h = 1024;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");

    let seed = 0x2545f491;
    const rand = () => {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return ((seed >>> 0) % 100000) / 100000;
    };

    g.fillStyle = "#565656";
    g.fillRect(0, 0, w, h);
    g.lineWidth = 2;
    g.lineCap = "round";
    for (let i = 0; i < 20000; i++) {
      const x = rand() * w, y = rand() * h;
      const len = 60 + rand() * 700;
      const a = 0.012 + rand() * 0.03;
      g.strokeStyle = (rand() > 0.5 ? "rgba(255,255,255," : "rgba(0,0,0,") + a + ")";
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
      if (x + len > w) {
        g.beginPath(); g.moveTo(x - w, y); g.lineTo(x + len - w, y); g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tex.repeat.set(4.5, 4.5);
    return tex;
  }

  const brush = brushed();
  /* The argument scales the brushed map rather than replacing it, so the
     grain survives. Pulled down across the board with the strip light: at
     the old values the map's mid greys put the whole enclosure near
     roughness 1, where even a hot, narrow source reflects as a wide dim
     smear and the chamfers read as moulded plastic. */
  const aluminium = (rough) => new THREE.MeshPhysicalMaterial({
    color: ALU,
    roughnessMap: brush,
    roughness: rough,
    metalness: 0.9,
    anisotropy: 0.6,
    /* The aluminium's whole read is the environment, so this is the dial
       that decides whether the enclosure looks machined or moulded. Raised
       with the glass: a screen returning the room while the body beside it
       stays flat is worse than neither doing it. */
    envMapIntensity: 1.35,
  });

  /* ── the device ─────────────────────────────────────────────────── */
  const device = new THREE.Group();
  scene.add(device);

  const body = new THREE.Mesh(slab(BODY_W, BODY_H, BODY_R, BODY_D, BODY_BEVEL), aluminium(0.88));
  /* NOT offset back by half its depth.
     `slab()` calls geo.center(), so the body already straddles z = 0 and its
     front face lands at BODY_D/2 + bevel — which is exactly what GLASS_Z is
     derived from. Pushing it back another BODY_D/2 left the glass and the
     picture floating a fifth of a unit clear of the enclosure: invisible
     head-on, and glaringly obvious the moment you drag round to the side. */
  body.castShadow = body.receiveShadow = true;
  device.add(body);

  const glass = new THREE.Mesh(
    slab(GLASS_W, GLASS_H, GLASS_R, GLASS_D, GLASS_BEVEL),
    new THREE.MeshPhysicalMaterial({
      color: 0x08080a, metalness: 0.4, roughness: 0.14, envMapIntensity: 1.4,
    })
  );
  glass.position.z = GLASS_Z;
  glass.castShadow = glass.receiveShadow = true;
  device.add(glass);

  const screenGeo = facePlane(SCREEN_W, SCREEN_H, 0.05);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x0b0d11, toneMapped: false });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = FACE_Z;
  device.add(screen);

  /* The sheen is GONE. It was a full MeshStandardMaterial — metalness 1,
     roughness 0.08, sampling the prefiltered environment — stretched over
     the whole panel and drawn transparently every frame. Measured against
     the panel underneath, what that bought was a flat -3 levels across 96%
     of the pixels: not a highlight, not a gradient, just a slightly darker
     screen, for a third of a frame's budget at full resolution. Whatever
     gloss reads here comes from the glare bar below. */

  /* ── screen glare ─────────────────────────────────────────────────
     A soft-edged bar of light raked across the glass — the reflection of
     the key softbox in a sheet of glossy glass.

     It is swept by moving the TEXTURE OFFSET, never the mesh. Translating
     the quad instead was the obvious first approach and it is wrong: the
     plane slides off the panel and reads as a grey slab floating in front
     of the device. Pinning the mesh to the screen and scrolling the map
     through it keeps the highlight inside the glass where it belongs.

     The canvas is vignetted at both ends so the wrap point never shows as
     a hard vertical seam crossing the panel. */
  function glareTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, 512, 512);
    g.save();
    g.translate(256, 256);
    g.rotate((-27 * Math.PI) / 180);
    const bar = g.createLinearGradient(-200, 0, 200, 0);
    bar.addColorStop(0.00, "rgba(255,255,255,0)");
    bar.addColorStop(0.42, "rgba(255,255,255,0.42)");
    bar.addColorStop(0.50, "rgba(255,255,255,0.92)");
    bar.addColorStop(0.58, "rgba(255,255,255,0.42)");
    bar.addColorStop(1.00, "rgba(255,255,255,0)");
    g.fillStyle = bar;
    g.fillRect(-380, -380, 760, 760);
    g.restore();
    /* Fade the ends by painting BLACK over them, not by removing alpha.
       This was destination-out, which only clears the alpha channel — and
       by this point the canvas is opaque black with the bar composited into
       it, so every pixel already has alpha 1 and full RGB. The material
       reads colour. Clearing alpha never touched what it reads, so the fade
       did nothing: measured, the texture went from 0 at column 0 to 51 at
       column 1, a hard cliff at both edges.

       That cliff is what slid across the glass. The streak is offset
       horizontally to track the camera, and with the wrap mode on Repeat,
       any non-zero offset puts the sample coordinate across an integer
       somewhere on the panel — a hard vertical seam, with a second wrapped
       copy of the streak beyond it. */
    const ends = g.createLinearGradient(0, 0, 512, 0);
    ends.addColorStop(0.00, "rgba(0,0,0,1)");
    ends.addColorStop(0.22, "rgba(0,0,0,0)");
    ends.addColorStop(0.78, "rgba(0,0,0,0)");
    ends.addColorStop(1.00, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "source-over";
    g.fillStyle = ends;
    g.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(c);
    /* Clamp, not Repeat. With the ends genuinely dark now, sampling past
       either edge returns zero instead of wrapping a second streak in. */
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  const glareTex = glareTexture();
  const glareMat = new THREE.MeshBasicMaterial({
    map: glareTex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  /* Sized to the GLASS, not to the picture area. A softbox reflected in a
     glossy panel does not stop where the pixels stop — it carries on across
     the black surround. That matters more than it sounds: over a bright UI
     an additive highlight is nearly invisible, which is physically correct
     and visually useless. Letting the bar run out onto the dark glass gives
     it somewhere to actually read, and the eye then accepts the faint part
     crossing the picture as the same reflection. */
  const glare = new THREE.Mesh(facePlane(GLASS_W, GLASS_H, GLASS_R), glareMat);
  glare.position.z = FACE_Z + 0.012;
  device.add(glare);

  /* ── the glass itself ─────────────────────────────────────────────
     The glare bar is one moving highlight. This is the rest of what glass
     does: it returns the SHAPE of the room — the three softboxes and the
     horizon in the environment — and those shapes are what separate a
     panel that has glass in front of it from a panel that is a picture.

     Reflection only, no diffuse. Black base colour contributes nothing
     under additive blending, but a dielectric's specular is not tinted by
     base colour, so the environment still comes through. Keeping
     metalness at 0 is the whole point: a metal reflects roughly evenly at
     every angle, where a dielectric follows Fresnel — about 4% head-on,
     climbing as the surface turns away. That is the same curve the glare
     bar's opacity is driven by, so the two agree rather than fight, and it
     is why this stays out of the way on the shots that look straight at
     the screen and arrives on the raking ones.

     Standard, not Physical. Nothing here needs clearcoat, transmission or
     iridescence, and Physical carries the cost of all of them: measured
     across a full-length pass, the Physical version put p95 at 34.2ms and
     the average at 49fps against 17.6ms and 59fps without the layer. */
  const roomMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    metalness: 0,
    roughness: 0.06,
    envMapIntensity: GLASS_ENV,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const room = new THREE.Mesh(facePlane(GLASS_W, GLASS_H, GLASS_R), roomMat);
  room.position.z = FACE_Z + 0.010;
  device.add(room);

  /* The camera, centred in the top bezel. A one-line detail, but its
     absence is the kind of thing that reads as "not a real product" long
     before anyone works out why. */
  const eye = new THREE.Mesh(
    new THREE.CircleGeometry(0.022, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.5, roughness: 0.25 })
  );
  eye.position.set(0, SCREEN_H / 2 + BEZEL / 2, FACE_Z + 0.002);
  device.add(eye);

  const arm = new THREE.Mesh(slab(ARM_W, ARM_H, 0.06, ARM_D, 0.02), aluminium(0.95));
  arm.position.set(0, -BODY_H / 2 - ARM_H / 2 + DROP, ARM_Z);
  arm.castShadow = arm.receiveShadow = true;
  device.add(arm);

  const foot = new THREE.Mesh(slab(ARM_W, BASE_D, 0.14, BASE_T, 0.018), aluminium(0.95));
  foot.rotation.x = -Math.PI / 2;
  foot.position.set(0, BASE_Y, ARM_Z + BASE_FWD);
  foot.castShadow = foot.receiveShadow = true;
  device.add(foot);

  /* Ambient occlusion, painted — the one thing a shadow map cannot give
     you. A shadow map answers "is the key blocked from here", but the
     darkening in the crevice where two surfaces meet comes from ambient
     light being blocked from EVERY direction at once. It is tight to the
     foot, and it is what actually reads as contact rather than hover. */
  function contactPool() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 6, 128, 128, 124);
    grad.addColorStop(0.00, "rgba(0,0,0,0.9)");
    grad.addColorStop(0.30, "rgba(0,0,0,0.5)");
    grad.addColorStop(0.64, "rgba(0,0,0,0.14)");
    grad.addColorStop(1.00, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(ARM_W * 1.7, BASE_D * 1.5),
    new THREE.MeshBasicMaterial({
      map: contactPool(),
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      toneMapped: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, PL_TOP + 0.006, ARM_Z + BASE_FWD);
  scene.add(contact);

  /* ── the plates ─────────────────────────────────────────────────── */

  /* Three screens, so the piece walks through the product rather than
     staring at one page for twenty seconds. The plate changes on the CUT,
     at the moment the camera starts moving to the next shot — the same
     place an editor would change what is on the monitor. Swapping it
     mid-hold, with the camera settled, looks like the screen glitched. */
  const plates = [];

  /* ── the mip chain: linear-light, and soft below level 0 ──────────
     This used to SHARPEN each level as it was built, to stop thin UI lines
     dissolving under minification. That fixed one problem and caused a
     worse one: unsharp masking amplifies exactly the high frequencies that
     alias, so every line it rescued then shimmered as the camera moved. It
     showed up on the dark chrome — the navy bar, the left nav — because
     that is where the interface's contrast is highest; light grey rules on
     white are nowhere near as steep, which is why the white areas always
     looked calm and the top bar did not.

     The second fault was subtler and is why the flicker had colour in it.
     The levels were built with canvas drawImage, which averages in sRGB —
     gamma-encoded — space. The GPU decodes this texture to linear before
     filtering, so it expects each level to be the sRGB encoding of the
     LINEAR average. Those are different numbers, and different by different
     amounts in each channel, because the error grows with how far apart the
     values being averaged are in linear light. Navy beside white text is
     far apart; light grey on white sits high on the curve where sRGB is
     nearly straight. So mip 1 carried a colour cast mip 0 did not, and any
     change of scale shifted the chrome's hue.

     Both fixed here: every average happens in linear light, and each level
     gets a gentle low-pass instead of a sharpen. Level 0 is left verbatim,
     because the macro shots magnify the panel and read straight from it. */
  const SRGB_TO_LINEAR = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  /* The encode is a table too, so the inner loop is a multiply and an index
     rather than a Math.pow per pixel per channel. Worth having, though not
     the win it was reached for: profiled by phase, this whole chain costs
     75ms on a 1536x960 plate — the same as the sharpening chain it replaced
     — split blur 24, downsample 16, sRGB->linear 13, encode 12, decode 10.
     The ~200ms stall when a card first comes alive is scene setup, chiefly
     environment prefiltering and shader compilation, and predates all of
     this. 8192 entries puts the worst quantisation error at the very bottom
     of the curve, below half a level. */
  const LINEAR_TO_SRGB = new Uint8Array(8193);
  for (let i = 0; i <= 8192; i++) {
    const v = i / 8192;
    const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    LINEAR_TO_SRGB[i] = (c * 255 + 0.5) | 0;
  }
  function linearToSrgb(v) {
    if (v <= 0) return 0;
    if (v >= 1) return 255;
    return LINEAR_TO_SRGB[(v * 8192) | 0];
  }

  function buildMips(img) {
    const levels = [];
    let w = img.width, h = img.height;
    const c0 = document.createElement("canvas");
    c0.width = w; c0.height = h;
    const g0 = c0.getContext("2d");
    g0.drawImage(img, 0, 0);
    levels.push(c0);

    // carry the chain in linear floats rather than re-reading each canvas
    let lin = new Float32Array(w * h * 3);
    {
      const px = g0.getImageData(0, 0, w, h).data;
      for (let i = 0, j = 0; i < w * h; i++, j += 3) {
        lin[j] = SRGB_TO_LINEAR[px[i * 4]];
        lin[j + 1] = SRGB_TO_LINEAR[px[i * 4 + 1]];
        lin[j + 2] = SRGB_TO_LINEAR[px[i * 4 + 2]];
      }
    }

    while (w > 1 || h > 1) {
      const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1);
      const next = new Float32Array(nw * nh * 3);
      for (let y = 0; y < nh; y++) {
        const y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1);
        for (let x = 0; x < nw; x++) {
          const x0 = Math.min(w - 1, x * 2), x1 = Math.min(w - 1, x * 2 + 1);
          const a0 = (y0 * w + x0) * 3, a1 = (y0 * w + x1) * 3;
          const a2 = (y1 * w + x0) * 3, a3 = (y1 * w + x1) * 3;
          const o = (y * nw + x) * 3;
          for (let k = 0; k < 3; k++) {
            next[o + k] = (lin[a0 + k] + lin[a1 + k] + lin[a2 + k] + lin[a3 + k]) * 0.25;
          }
        }
      }

      // one separable 1-2-1 pass, also in linear: the extra softening that
      // measured best against the shimmer, skipped once nothing can alias
      let cur = next;
      if (nw > 8 && nh > 8) {
        const tmp = new Float32Array(nw * nh * 3);
        for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
          const l = (y * nw + Math.max(0, x - 1)) * 3;
          const c = (y * nw + x) * 3;
          const r2 = (y * nw + Math.min(nw - 1, x + 1)) * 3;
          for (let k = 0; k < 3; k++) tmp[c + k] = (cur[l + k] + 2 * cur[c + k] + cur[r2 + k]) * 0.25;
        }
        for (let x = 0; x < nw; x++) for (let y = 0; y < nh; y++) {
          const u = (Math.max(0, y - 1) * nw + x) * 3;
          const c = (y * nw + x) * 3;
          const dn = (Math.min(nh - 1, y + 1) * nw + x) * 3;
          for (let k = 0; k < 3; k++) cur[c + k] = (tmp[u + k] + 2 * tmp[c + k] + tmp[dn + k]) * 0.25;
        }
      }

      const c = document.createElement("canvas");
      c.width = nw; c.height = nh;
      const g = c.getContext("2d");
      const out = g.createImageData(nw, nh);
      for (let i = 0, j = 0; i < nw * nh; i++, j += 3) {
        out.data[i * 4] = linearToSrgb(cur[j]);
        out.data[i * 4 + 1] = linearToSrgb(cur[j + 1]);
        out.data[i * 4 + 2] = linearToSrgb(cur[j + 2]);
        out.data[i * 4 + 3] = 255;
      }
      g.putImageData(out, 0, 0);
      levels.push(c);

      lin = cur; w = nw; h = nh;
    }
    return levels;
  }

  function loadPlate(id) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const mips = buildMips(img);
        const tex = new THREE.Texture(mips[0]);
        tex.mipmaps = mips;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        /* The plates are 4:3 and the panel is 16:10, so each is cropped
           rather than squashed — anchored to the top, which is where a
           UI's chrome lives and the part you cannot afford to lose. */
        const crop = (SCREEN_H / SCREEN_W) / (img.height / img.width);
        tex.repeat.set(1, crop);
        tex.offset.set(0, 1 - crop);
        tex.needsUpdate = true;
        resolve(tex);
      };
      img.onerror = reject;
      img.src = id;
    });
  }

  Promise.all(plateUrls.map(loadPlate))
    .then((loaded) => {
      plates.push(...loaded);
      screenMat.map = plates[0];
      screenMat.color.set(0xffffff);
      screenMat.needsUpdate = true;
      start();
    })
    .catch(() => {});

  /* ════════════════════════════════════════════════════════════════
     CAMERA

     The rig is spherical and the device never moves. Orbiting the CAMERA
     rather than spinning the object is what keeps the ground shadow
     anchored — rotate the device and its shadow swings around with it,
     which instantly reads as fake.
     ════════════════════════════════════════════════════════════════ */
  /* The device never moves, so the picture plane's centre is a constant —
     no need to recompute it from the matrix every frame. */
  const screenCentre = new THREE.Vector3(0, 0, FACE_Z);

  const rig = Object.assign({}, SHOTS[0].from);
  const drag = { az: 0, el: 0 };

  /* ── The device may never fill the frame ──────────────────────────
     A shot framed inside the bezel stops reading as a DEVICE and becomes a
     flat screenshot laid over the render — no body, no stand, no edge for
     the eye to catch. That is the single failure this scene keeps coming
     back to, and it has now been fixed twice by hand: once by moving the
     shot distances, once by panning the look-at targets. Both fixes were
     computed against ONE card aspect and were silently wrong at every
     other breakpoint, because the visible width is `dist * tan(fov/2) *
     aspect` and the aspect is 1.60 on desktop against 1.33 on a phone.
     Numbers in the shot list cannot express a constraint that depends on
     the viewport.

     So it is enforced here instead, every frame, against the projection
     actually in use. The shot list goes back to being pure authorship: say
     where the camera should be, and this guarantees the frame still
     contains the object. Nothing in a config can reintroduce the bug, and
     it holds at breakpoints nobody thought to check.

     The rule is a visible CORNER — ground showing along one vertical edge
     of the frame and one horizontal edge — rather than the whole device.
     A corner is enough to read body, thickness and silhouette, and it is
     the weakest condition that does, so the macros stay as close as they
     can while still being macros OF something. The guard only ever pulls
     back, and only by the minimum the condition needs; a shot already
     clear of it is left exactly as authored. */
  const KEEP = 0.06;          // of the half-frame, per side — the ground margin
  const LIM = 1 - KEEP;       // in NDC, where the frame edge is 1
  const BODY_CORNERS = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    BODY_CORNERS.push(
      new THREE.Vector3(sx * BODY_W / 2, sy * BODY_H / 2, sz * BODY_D / 2)
    );
  }
  const _vp = new THREE.Matrix4();
  const _v4 = new THREE.Vector4();

  /* How much the frame would have to shrink for a corner of the body to come
     inside it. >1 means the device is overflowing and the camera must back
     off; <=1 means the shot is already legal. */
  function overflowFactor() {
    _vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of BODY_CORNERS) {
      _v4.set(c.x, c.y, c.z, 1).applyMatrix4(_vp);
      /* Behind the eye, where the perspective divide flips the sign and the
         NDC is meaningless. The camera is inside the device — as far past
         the condition as it is possible to be. */
      if (_v4.w <= 1e-4) return 2.5;
      const x = _v4.x / _v4.w, y = _v4.y / _v4.w;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    /* The cheaper of the two vertical edges, and of the two horizontal ones.
       Both must clear, which is what makes it a corner rather than an edge. */
    return Math.max(Math.min(x1, -x0), Math.min(y1, -y0)) / LIM;
  }

  function placeCamera(target, az, el, dist) {
    camera.position.set(
      target.x + dist * Math.sin(az) * Math.cos(el),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(az) * Math.cos(el)
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.rotateZ(THREE.MathUtils.degToRad(rig.roll));
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }

  function applyRig() {
    const az = THREE.MathUtils.degToRad(rig.az + drag.az);
    const el = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(rig.el + drag.el, -6, 46)
    );
    const target = new THREE.Vector3(rig.tx, rig.ty, 0);

    /* Projected size goes as 1/dist, so one multiply lands very close and
       the extra passes only clean up the perspective the approximation
       ignores. Three is convergence, not a search. */
    let dist = rig.dist;
    placeCamera(target, az, el, dist);
    for (let i = 0; i < 3; i++) {
      const over = overflowFactor();
      if (over <= 1) break;
      dist *= over;
      placeCamera(target, az, el, dist);
    }
    rig.framedDist = dist;

    /* The whole SET is relit per shot, not just the key.
       In the reference the backdrop swings from a bright lower sweep on the
       wides to near-black on the macro — the room is genuinely relit
       between setups, the way it would be on a real shoot, rather than one
       exposure held across every angle. The macros go dark so the screen is
       the only thing left with any value in it. */
    key.intensity = 2.5 * rig.key;
    /* Floors raised across the board. On a dark ground a low ambient was
       what created the range; on a pale one the same values crush every
       surface the key misses and the device reads as a cut-out pasted on
       top. The macros still deepen the set — they just deepen towards
       saturated cyan now instead of towards black. */
    ambient.intensity = 0.16 + 0.2 * rig.amb;
    hemi.intensity = 0.14 + 0.26 * rig.amb;
    splats.mat.uniforms.uGain.value = 0.55 + 0.45 * rig.amb;

    /* ── glass response ───────────────────────────────────────────────
       A screen is not a picture, it is a picture behind a mirror, and how
       much of each you see depends entirely on the angle you stand at.
       Two things follow from that, and both are driven from the real view
       vector rather than from the azimuth number.

       ONE — where the highlight sits. The reflected image of a fixed light
       sweeps across a flat panel in proportion to the TANGENT of the view
       angle, not linearly. The linear version this replaces drifted at a
       constant rate and felt painted on; tangent accelerates as the panel
       turns away, which is what a real reflection does.

       TWO — how strong it is. Fresnel: glass reflects about 4% head-on and
       approaches 100% at grazing incidence. So the UI washes out and the
       room takes over as the screen turns edge-on, which is the single most
       recognisable behaviour of a real display. */
    const eyeDir = camera.position.clone().sub(screenCentre).normalize();
    const cosT = Math.abs(eyeDir.z);

    /* Schlick's exponent is 5. This uses 2.6, deliberately.
       True Fresnel is nearly flat until about 60 degrees off-axis, and the
       choreography never leaves ±27 — so the physically exact curve would
       hold the glare at a constant 4% through every shot and only wake up
       if someone dragged right round. Product films push this for the same
       reason. It is a stylised curve, not a wrong one. */
    const fres = 0.04 + 0.96 * Math.pow(1 - cosT, 2.6);

    glareTex.offset.x = THREE.MathUtils.clamp(
      -Math.atan2(eyeDir.x, Math.max(eyeDir.z, 0.08)) * 0.42, -0.48, 0.48
    );
    /* Both dialled right down, and the reason is arithmetic rather than
       taste. A card background in the plate sits at about 0.97 of full
       white and the page behind it at 1.00 — three percent apart. Any
       UNIFORM additive lift above roughly 0.02 pushes the card past 1.0,
       it clips, and the two become the same white: every panel edge and
       row separator in the UI disappears at once. The sheen was adding
       0.068 across the whole picture at these angles, so the greys never
       stood a chance.

       A real glossy screen genuinely does wash out like that, and if this
       were a photograph of a monitor it would be right. It is a device
       mockup whose job is to show the interface, so legibility wins.

       The glare survives because it is not uniform — it is a narrow band,
       and the UI it crosses has large DARK regions (the navy header, the
       sidebar) where adding 0.06 is a big relative lift and clearly reads.
       It shows where it can be seen and stays out of the whites. */
    glareMat.opacity = THREE.MathUtils.clamp(0.02 + fres * 0.5, 0.02, 0.085);
  }

  /* ════════════════════════════════════════════════════════════════
     CHOREOGRAPHY

     One GSAP timeline per shot, chained and looped. Every move eases in and
     out of rest, so the camera is never travelling at a constant rate — a
     linear dolly is the thing that most reliably reads as machine-driven.
     `power2` on the way in, `power3` out: slightly quicker to leave a
     position than to settle into the next one, which is how an operator
     actually moves a head.
     ════════════════════════════════════════════════════════════════ */
  /* The plate swap, which is all that survived of the slate. It used to be
     bundled into the function that also drove the shot labels and the
     readout; with the chrome gone it is worth being one small named thing
     rather than a leftover with vestigial arguments. */
  function showPlate(index) {
    const plate = plates[index];
    if (plate && screenMat.map !== plate) {
      screenMat.map = plate;
      screenMat.needsUpdate = true;
    }
  }

  let tl = null;
  let idle = null;
  let started = false;   // start() has run and the scene has something to draw
  let running = false;

  function buildTimeline(from) {
    if (tl) tl.kill();
    tl = gsap.timeline({ repeat: -1 });

    SHOTS.forEach((_, i) => {
      const order = (from + i) % SHOTS.length;
      const shot = SHOTS[order];

      /* A CUT, not a move.
         The reference does this twice in twelve seconds and both are single
         frames — measured, the luminance jumps forty points between one
         frame and the next, with nothing in between. Every earlier version
         of this scene tweened the camera from one setup to the next, which
         is a very different thing: it reads as one long continuous orbit
         with labels attached, and it never lets the framing change enough
         to be interesting. Jumping lets a wide sit next to a macro. */
      tl.call(() => showPlate(shot.plate));
      tl.set(rig, shot.from);

      /* Linear, and this is the one place it belongs.
         Elsewhere a constant-rate move reads as machine-driven, because you
         watch it start and stop. Here you never see either end — the shot
         begins and ends on a cut — so what is left is the steady creep of a
         motorised head, which is exactly the texture the reference has. */
      tl.to(rig, {
        ...shot.to,
        duration: shot.hold,
        ease: "none",
      });
    });
    return tl;
  }

  /* ── drag to look around ────────────────────────────────────────── */
  let dragging = false, px = 0, py = 0;

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    px = e.clientX; py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    if (tl) tl.pause();
    if (idle) idle.kill();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    drag.az += (e.clientX - px) * -0.22;
    drag.el += (e.clientY - py) * 0.16;
    drag.el = THREE.MathUtils.clamp(drag.el, -28, 28);
    px = e.clientX; py = e.clientY;
  });

  function release(e) {
    if (!dragging) return;
    dragging = false;
    if (e && e.pointerId != null && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    /* Ease the manual offset back to zero and hand control to the timeline
       again, rather than snapping — the return is part of the shot. */
    idle = gsap.to(drag, {
      az: 0, el: 0, duration: 1.5, ease: "power2.out", delay: 0.7,
      onStart: () => { if (tl && !still) tl.resume(); },
    });
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  /* ── resize ─────────────────────────────────────────────────────── */
  function resize() {
    /* Measured from the CANVAS, not the window. On the standalone page those
       were the same thing; in a card they are not, and sizing a card-sized
       canvas to the viewport is how you get a render four times too big. */
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    /* A pixel BUDGET rather than a fixed ratio. This scene is fill-rate
       bound and nothing else, and what matters is not raw speed but where
       the frame lands against the 16.7ms vsync budget: miss it and the
       frame waits for the next refresh, so the rate halves rather than
       degrading. Two of these cards can be on screen at once, so the cap is
       per canvas and set low enough that both together stay clear of it.
       At normal card sizes it never binds and the full device ratio is
       used; it only engages on a very large viewport. */
    /* 1.15 megapixels, and the number is measured, not guessed.

       At 1.38MP these cards sat at 18.8ms against a 16.7ms vsync budget —
       nominally "53fps", but only 61% of frames arrived on time, because
       missing the budget does not cost a little time: the frame waits for
       the next refresh and the rate halves. Trimming 17% of the pixels put
       the median at 16.6ms and frames on time at 100%.

       Being just over budget is the worst place to sit, and it is invisible
       in an average frame rate — which is why this is expressed as a pixel
       budget rather than a device ratio. A small card still renders at the
       full device ratio; only a large one scales down. */
    /* Caller can raise this. The default suits a card roughly a third of
       the page; a full-bleed one is over budget at 1x, and because the
       floor is 1 it cannot scale down either — so it renders at 1x and
       the browser upscales to the device ratio, which is what reads as a
       blurred first shot. */
    const PIXEL_BUDGET = config.pixelBudget || 1.15e6;
    renderer.setPixelRatio(Math.max(1, Math.min(
      Math.min(devicePixelRatio, 2), Math.sqrt(PIXEL_BUDGET / (w * h))
    )));
    renderer.setSize(w, h, false);
    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    bgRT.setSize(
      Math.max(2, Math.round(buf.x * BG_SCALE)),
      Math.max(2, Math.round(buf.y * BG_SCALE))
    );
    camera.aspect = w / h;
    /* Widen the field of view as the frame narrows, so the device does not
       run out of the sides on a phone. */
    camera.fov = w / h < 0.85 ? 46 : 34;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ── run ────────────────────────────────────────────────────────── */
  function start() {
    resize();
    showPlate(0);
    renderer.shadowMap.needsUpdate = true;   // the one shadow render

    /* ── and then recompile the device, ONCE, on the next frame ─────────
       This is what was making the enclosure vanish, and it is not a colour
       problem — every previous attempt went at the colour and could not have
       worked.

       The shadow map is built lazily: autoUpdate is off and the flag above is
       consumed by the first render. So on the very first frame the device's
       materials compile while key.shadow.map is still null. They bind an
       incomplete shadow sampler, and nothing ever marks them dirty again, so
       that first bad program is the one every subsequent frame draws with. The
       body, arm and foot come out flat and land within a few levels of the
       backdrop; the screen, which is unlit, is unaffected — which is exactly
       the "picture floating over its own contact shadow" this scene has been
       chased around for weeks.

       Proved by isolation: setting needsUpdate on those three materials and
       changing NOTHING else brings the whole enclosure back. Forcing them
       unlit also brought them back, which is why the colour theories kept
       looking half-right.

       One recompile, on the frame after the shadow map exists. */
    let recompiled = false;
    const recompileOnce = () => {
      if (recompiled) return;
      recompiled = true;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    };
    /* The opening frame is set BEFORE the loop starts, in both branches.
       buildTimeline only positions the rig on GSAP's first tick, so without
       this the first frames rendered used the constructor's default rig — a
       dead-on frontal at dist 14, which is no shot in the film — and on the
       phone that also meant the model's own stock wallpaper instead of a
       plate. Caught on a throttled load as an empty dark device, frontal,
       nothing like the film's opening. It also makes the poster handoff exact,
       since the poster IS SHOTS[0].from. */
    Object.assign(rig, SHOTS[0].from);
    /* Reduced motion holds that establishing shot rather than animating on
       from it. The page still shows the product, it simply does not move. */
    if (!still) buildTimeline(0);
    started = true;
    running = true;
    /* Mirrored onto the element so the running state is observable from
       outside — useful for testing that a card which has scrolled away has
       genuinely stopped drawing, which is otherwise invisible. */
    canvas.dataset.running = "1";
    renderer.setAnimationLoop(() => {
      applyRig();
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      sortSplats(rig.az + drag.az);
      renderFrame();
      recompileOnce();
    });
  }

  return {
    /* A card that has scrolled away should cost nothing. Stopping the render
       loop AND the timeline matters — leaving the loop running to draw a
       frozen scene still burns a full GPU pass per frame for something
       nobody can see. */
    pause() {
      if (!running) return;
      running = false;
      canvas.dataset.running = "0";
      renderer.setAnimationLoop(null);
      if (tl) tl.pause();
    },
  /* Nothing may drive the loop until start() has run.

     v2.js hands back this object the moment init() is called, and its
     visibility pass calls resume() on any film that is on screen — which is
     long before the plates have arrived. resume() only guarded on `running`,
     which start() sets, so on any connection slower than a local server it
     began rendering a scene with no screen texture yet. Measured on the phone
     scene at 700kbps: resume() at 11.4s with plates: 0, start() at 14.1s — 2.6
     seconds of a device with nothing on its display.

     start() begins the loop itself, so refusing early resumes loses nothing.
     A film that is off screen by the time it is ready gets paused by the next
     visibility pass, exactly as before. */
    resume() {
      if (running || !started) return;
      running = true;
      canvas.dataset.running = "1";
      if (tl) tl.resume();
      renderer.setAnimationLoop(() => {
        applyRig();
        camera.updateMatrixWorld();
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        sortSplats(rig.az + drag.az);
        renderFrame();
      });
    },
  };
};