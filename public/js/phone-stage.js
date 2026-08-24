/**
 * Case-card 3D stage: a phone, for the Matas card.
 *
 * The sibling of softbox-stage.js, and deliberately a separate file. That one
 * builds its device out of primitives — a monitor is a few rounded slabs and
 * looks right. A phone does not: the chamfered rails and the camera plateau
 * are most of what makes it read as an iPhone rather than a rounded box, so
 * this one loads a real model instead.
 *
 * What is shared with softbox-stage.js is copied rather than imported: the
 * renderer, the built environment, the light rig, the gaussian-splat backdrop
 * and the linear-light mip chain are identical in both. They are stable and
 * asset-driven, and a shared module would have to be loaded by both cards on
 * a page where only one of them may ever come into view. If you fix a bug in
 * one of those blocks, fix it in the other file too.
 *
 * The one genuinely new thing here is that the screen SCROLLS. The Matas
 * captures are whole pages — 604x5833 for the first — so the plate is not a
 * screenshot to be shown, it is a document to be moved through. The texture
 * shows a screen-shaped window onto it and the shot slides that window down.
 */
window.initPhoneStage = function (canvas, config) {
  "use strict";

  const plateUrls = config.plates;
  const SHOTS = config.shots;
  const GROUND = config.ground;
  const MODEL_URL = config.model;
  const STICKY = config.sticky || [];   // per-plate pinned bar, see buildSticky

  const THREE = window.THREE;
  const gsap = window.gsap;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The phone, in scene units. Everything else is measured off the model
     once it loads, so this is the only number that sets the scale. */
  const PHONE_H = 7.0;
  /* Its own screen aspect, read off the mesh at load time rather than
     assumed — it decides how tall a window each plate shows. */
  let screenAspect = 0.479;

  /* ── renderer ───────────────────────────────────────────────────── */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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
     The splat cloud is the single most expensive thing in this scene:
     measured, 11.8ms of a 30.7ms frame at 1.38 megapixels, against a phone
     model that costs nothing measurable. The cost is pure overdraw — three
     thousand large alpha-blended quads with no depth rejection, each one
     covering a good fraction of the frame.

     It is also the one element that can least afford it: a soft volumetric
     gradient with no hard feature anywhere in it, so rendering it at a third
     of the resolution and scaling it up is invisible. Everything sharp — the
     phone, its screen, its edges — still draws at full resolution on top. */
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

  /* Backdrop into its target, blitted up, then the phone over the top with
     the colour buffer left alone — autoClear off, or the composite is wiped
     the instant the main scene starts drawing. */
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


  /* ── the phone ────────────────────────────────────────────────────
     fetch + parse, NOT loader.load(). GLTFLoader.load() routes through
     FileLoader, which on some hosts hangs on a response it cannot content-
     sniff — no error, no progress, a promise that never settles. Fetching
     the bytes and handing them to parse() is explicit and reports failure. */
  let screenMat = null;
  /* How much room the glass gives back. The single dial for the shaped
     reflection: 0 removes it, past about 0.9 the softboxes start to
     compete with the UI.

     Deliberately low, for the reason set out in softbox-stage.js: the
     reference keeps its screens clean and puts the whole premium read into
     the body. This stays as a hint that there is glass in front of the
     pixels; the strip light does the rest. */
  const GLASS_ENV = 0.24;
  let sheenTex = null, sheenMat = null;

  const BEZEL = 0.028;        // of the screen's WIDTH
  const RADIUS = 0.098;       // ditto — the display's corner, not the body's
  let screenMesh = null;
  let overlayGeo = null;      // panel-UV clone, for the bezel and the strips
  let bezelCanvas = null;     // gives the strips the panel's pixel dimensions
  const stickyMeshes = [];    // one per plate, or null where a plate has none
  const phone = new THREE.Group();
  scene.add(phone);

  async function loadPhone(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const loader = new THREE.GLTFLoader();
    loader.setMeshoptDecoder(THREE.MeshoptDecoder);
    const gltf = await new Promise((ok, err) => loader.parse(buf, "", ok, err));
    const model = gltf.scene;

    /* updateMatrixWorld BEFORE measuring. Sketchfab nests the mesh under
       transform nodes, so a freshly parsed scene has stale world matrices
       and Box3.setFromObject returns local-space numbers — which fits the
       model to the wrong scale and puts the camera inside it. */
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const k = PHONE_H / size.y;
    model.scale.setScalar(k);
    model.position.sub(centre.multiplyScalar(k));
    phone.add(model);
    phone.updateMatrixWorld(true);

    /* The screen is found by GEOMETRY, not by name. It is the thinnest
       textured mesh in the model — which is what being a screen means, and
       survives a re-export that renumbers the objects. */
    let best = null;
    model.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.map) return;
      o.geometry.computeBoundingBox();
      const s = o.geometry.boundingBox.getSize(new THREE.Vector3());
      const dims = [s.x, s.y, s.z].sort((a, b) => a - b);
      if (!best || dims[0] < best.thickness) {
        best = { mesh: o, thickness: dims[0], w: dims[1], h: dims[2] };
      }
    });
    if (!best) throw new Error("no screen mesh in model");

    screenMesh = best.mesh;
    screenAspect = Math.min(best.w, best.h) / Math.max(best.w, best.h);

    /* Rebuild the panel's UVs from its own bounding box. The model's screen
       UVs address a region of its baked atlas, so dropping a plate onto them
       samples some arbitrary corner of it — for this model, a patch of the
       stock wallpaper. Deriving u,v from the local box maps one plate across
       the whole panel, which is what the coordinates would have been if the
       mesh had been authored for exactly one image. */
    const geo = screenMesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const pos = geo.attributes.position;
    /* The screen lies in the model's XZ plane, so its two in-plane axes are
       x and z, not x and y. Picking them by extent rather than by name keeps
       this correct if the model is ever re-exported upright. */
    const ext = { x: bb.max.x - bb.min.x, y: bb.max.y - bb.min.y, z: bb.max.z - bb.min.z };
    const axes = ["x", "y", "z"].sort((a, b) => ext[b] - ext[a]);
    const AV = axes[0], AU = axes[1];         // longest = down the screen

    /* Two sets of UVs off the same box.

       PANEL is the plain 0..1 mapping, and it is what the bezel wants: the
       bezel is drawn for the whole panel and punches its own window.

       DISPLAY is inset by the bezel, and it is what the plate wants. Mapping
       a plate across the whole panel puts its outer edge UNDER the bezel, so
       the interface lost a slice off each side — a capture is of the display,
       not of the panel the display sits in. The inset is BEZEL of the WIDTH
       on all four sides, which in v is that same distance measured against
       the height. */
    const uvPanel = new Float32Array(pos.count * 2);
    const uvDisplay = new Float32Array(pos.count * 2);
    const bu = BEZEL, bv = BEZEL * (ext[AU] || 1) / (ext[AV] || 1);
    for (let i = 0; i < pos.count; i++) {
      const u = (pos["get" + AU.toUpperCase()](i) - bb.min[AU]) / (ext[AU] || 1);
      const v = (pos["get" + AV.toUpperCase()](i) - bb.min[AV]) / (ext[AV] || 1);
      uvPanel[i * 2] = u;
      uvPanel[i * 2 + 1] = v;
      uvDisplay[i * 2] = (u - bu) / (1 - 2 * bu);
      uvDisplay[i * 2 + 1] = (v - bv) / (1 - 2 * bv);
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uvDisplay, 2));
    /* The bezel needs its own geometry, not the screen's: they share a mesh
       shape but no longer share UVs. */
    overlayGeo = geo.clone();
    overlayGeo.setAttribute("uv", new THREE.BufferAttribute(uvPanel, 2));

    screenMat = new THREE.MeshBasicMaterial({ color: 0x0b0d11, toneMapped: false });
    screenMesh.material = screenMat;
    screenMesh.castShadow = false;

    /* ── the bezel ────────────────────────────────────────────────────
       An OVERLAY, not something baked into the plate — and that is the whole
       point. On the monitor stage the bezel is composited into the picture,
       which works because that picture is a still. These plates scroll: bake
       a border into the top of a page and it slides away with the first
       shot, leaving the UI running off the edge again a second later. The
       bezel belongs to the device, so it has to live on the device.

       It also fixes a second thing visible in the same frame. The screen
       mesh is a rectangle and the phone's display is not — without this the
       interface sits square into corners that should be rounded.

       Sharing the screen's geometry means it inherits the transform exactly,
       and polygonOffset biases it toward the viewer so it wins the depth
       test without needing to know which way the mesh's normals face. */
    const bez = document.createElement("canvas");
    bez.width = 512;
    bez.height = Math.round(512 / screenAspect);
    const bg = bez.getContext("2d");
    bg.fillStyle = "#05060a";
    bg.fillRect(0, 0, bez.width, bez.height);
    /* destination-out IS right here, unlike in the monitor's glare texture
       where it silently did nothing: this material reads ALPHA, so clearing
       alpha is exactly what punches the window through. */
    const inset = bez.width * BEZEL;
    const r = bez.width * RADIUS;
    bg.globalCompositeOperation = "destination-out";
    bg.beginPath();
    bg.roundRect(inset, inset, bez.width - inset * 2, bez.height - inset * 2, r);
    bg.fill();

    /* The Dynamic Island, painted back in over the window.
       The model carries a front camera and a Face ID sensor as real geometry,
       sitting 0.006 proud of the display — and on the real device those live
       inside a black cutout. The export had that cutout baked into its
       wallpaper, so swapping in a plate took the island away and left two
       fully-rough metal discs floating on the interface, returning the
       average of the room. In a pink room that average is a pink circle.

       Position is derived from the camera mesh rather than eyeballed: its
       centre lands at u 0.595, v 0.954 of the screen, which is the right-hand
       end of the island exactly as it is on the device. */
    bg.globalCompositeOperation = "source-over";
    const islandW = bez.width * 0.26;
    const islandH = bez.height * 0.043;
    const islandCx = bez.width * 0.51;
    const islandCy = bez.height * 0.046;
    bg.beginPath();
    bg.roundRect(islandCx - islandW / 2, islandCy - islandH / 2,
                 islandW, islandH, islandH / 2);
    bg.fill();

    const bezelTex = new THREE.CanvasTexture(bez);
    bezelTex.colorSpace = THREE.SRGBColorSpace;
    bezelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    bezelTex.needsUpdate = true;
    const bezel = new THREE.Mesh(overlayGeo, new THREE.MeshBasicMaterial({
      map: bezelTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }));
    bezel.castShadow = false;
    bezel.renderOrder = 2;
    screenMesh.add(bezel);
    bezelCanvas = bez;

    /* ── the glass ────────────────────────────────────────────────────
       What the phone was missing that the monitor already had: the panel
       returned nothing at all, so it read as artwork applied to a shape
       rather than as a screen behind glass.

       Two layers. This one is the room — the softboxes and the horizon in
       the environment, reflected as SHAPES, which is what says there is
       glass in front of the pixels. Reflection only: a black base colour
       adds nothing under additive blending, but a dielectric's specular is
       not tinted by base colour, so the environment still comes through.
       metalness 0 keeps Fresnel in play, so it stays quiet on the frontal
       shots and arrives as the phone turns — a metal would sit at the same
       brightness from every angle and read as a sticker.

       Standard rather than Physical, for the frame budget — see the same
       layer in softbox-stage.js for the measurement. */
    const glass = new THREE.Mesh(overlayGeo, new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0,
      roughness: 0.05,
      envMapIntensity: GLASS_ENV,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }));
    glass.castShadow = false;
    glass.renderOrder = 3;
    screenMesh.add(glass);

    /* The second layer: one soft bar raked across the panel, the moving
       highlight the monitor drives from its own Fresnel term. Sized to the
       whole panel rather than the display, because a softbox reflected in
       a phone does not stop where the pixels stop — and over a bright UI
       an additive highlight is nearly invisible, so it needs the black
       surround to actually read on. */
    const sheenC = document.createElement("canvas");
    sheenC.width = 32; sheenC.height = 256;
    const sg = sheenC.getContext("2d");
    const grad = sg.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.00, "rgba(255,255,255,0)");
    grad.addColorStop(0.34, "rgba(255,255,255,0.16)");
    grad.addColorStop(0.46, "rgba(255,255,255,0.62)");
    grad.addColorStop(0.58, "rgba(255,255,255,0.16)");
    grad.addColorStop(1.00, "rgba(255,255,255,0)");
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 32, 256);
    sheenTex = new THREE.CanvasTexture(sheenC);
    sheenTex.colorSpace = THREE.SRGBColorSpace;
    /* Clamped, or the far end of the sweep wraps a second bar back in. */
    sheenTex.wrapS = sheenTex.wrapT = THREE.ClampToEdgeWrapping;
    sheenMat = new THREE.MeshBasicMaterial({
      map: sheenTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const sheen = new THREE.Mesh(overlayGeo, sheenMat);
    sheen.castShadow = false;
    sheen.renderOrder = 4;
    screenMesh.add(sheen);

    /* ── the finish ───────────────────────────────────────────────────
       Every material in this export arrives at metalness 1, roughness 1, and
       that pair has no specular in it at all: fully rough metal returns the
       flat average of its surroundings and nothing else. With no highlight
       anywhere and no gradient down the rail, the body reads as a black
       shape drawn around the screen rather than as an object — which is
       exactly what "still flat" meant.

       An earlier pass here set one polished number across all 31 meshes and
       made it worse: the camera glass, the plastic and the lens interiors
       all became mirrors of a soft, near-uniform pink room. The lesson was
       not "leave it alone", it was "do it per material". This table is keyed
       on the export's own material names.

       Rim_Buttons and Material.002 are the two full-length bands that make
       up the side rail — [0.98, 0.1, 2] and [0.97, 0.1, 2] in the model's
       own units. They are what has to catch the key, and they are what
       carries the read. */
    const FINISH = {
      Rim_Buttons:              { metalness: 1,    roughness: 0.22 },
      "Material.002":           { metalness: 1,    roughness: 0.28 },
      "Material.004":           { metalness: 1,    roughness: 0.34 },
      Grill_USB:                { metalness: 1,    roughness: 0.38 },
      Screw:                    { metalness: 1,    roughness: 0.38 },
      "Material.001":           { metalness: 0.85, roughness: 0.38 },
      "Material.003":           { metalness: 0.9,  roughness: 0.3 },
      Screen_Rim:               { metalness: 0.25, roughness: 0.42 },
      Screen_Glass:             { metalness: 0,    roughness: 0.06 },
      Glass_Camera_Logo:        { metalness: 0,    roughness: 0.09 },
      Flash_Glass_002:          { metalness: 0,    roughness: 0.12 },
      Flash_002:                { metalness: 0,    roughness: 0.5 },
      Plastic:                  { metalness: 0,    roughness: 0.55 },
      // front camera and Face ID — the bezel's island covers these, so this
      // is only insurance against the pink disc coming back at a new angle
      Camera_Pixel_Glass_002:   { metalness: 0,    roughness: 0.1,  color: 0x0a0a12 },
      Camera_Pixel__002:        { metalness: 0.5,  roughness: 0.28, color: 0x14141c },
    };

    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      if (o === screenMesh || !o.material) return;
      const f = FINISH[o.material.name];
      if (!f) return;                       // unlisted stays as authored
      // The export shares material instances across meshes, so clone before
      // writing or one entry in the table rewrites several others.
      o.material = o.material.clone();
      o.material.metalness = f.metalness;
      o.material.roughness = f.roughness;
      if (f.color !== undefined) o.material.color.setHex(f.color);
      // raised with the glass — a screen returning the room while the rail
      // beside it stays flat is worse than neither doing it
      o.material.envMapIntensity = 1.5;
      o.material.needsUpdate = true;
    });
  }

  /* ── the shadow it sits in ────────────────────────────────────────
     Painted, not cast. There is no plinth here for a shadow map to land on
     and no horizon in the composition, so a real one would have nothing to
     fall across. A soft pool underneath does the whole job of anchoring the
     phone, and costs one transparent quad instead of a depth pass. */
  function contactPool() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 4, 128, 128, 124);
    grad.addColorStop(0.00, "rgba(0,0,0,0.78)");
    grad.addColorStop(0.28, "rgba(0,0,0,0.40)");
    grad.addColorStop(0.62, "rgba(0,0,0,0.11)");
    grad.addColorStop(1.00, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(PHONE_H * 0.62, PHONE_H * 0.42),
    new THREE.MeshBasicMaterial({
      map: contactPool(), transparent: true, opacity: 0.5,
      depthWrite: false, toneMapped: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, -PHONE_H / 2 - 0.02, 0.1);
  scene.add(contact);

  /* ── the plates ─────────────────────────────────────────────────── */
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

  /* ── the pinned bar ───────────────────────────────────────────────
     A page scrolls under its own chrome: the tab bar at the foot of the home
     screen and the nav header on the two inner screens do not travel with
     the content. The plate is one flat capture, so scrolling it moves the
     bar off with everything else and the screen reads as a long picture
     being dragged rather than as an app.

     The fix is a second quad over the same panel carrying only that strip,
     cut from the plate at full resolution and parked at its edge. Static
     geometry and a static texture — no per-frame canvas work, which is what
     compositing the strip into the scrolling texture every frame would have
     cost. It sits above the plate and below the bezel, so the bezel's
     rounded corners still trim it. */
  function buildSticky(tex, spec) {
    if (!spec || !bezelCanvas || !overlayGeo) return null;
    const img = tex.userData.img;
    if (!img) return null;

    const W = bezelCanvas.width, H = bezelCanvas.height;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");

    // the display window inside the bezel — the same rect the plate maps to
    const inset = W * BEZEL;
    const innerW = W - inset * 2, innerH = H - inset * 2;
    // the plate is fitted to the display's WIDTH, so that is the scale
    const scale = innerW / img.width;
    const stripH = spec.px * scale;

    if (spec.edge === "bottom") {
      g.drawImage(img, 0, img.height - spec.px, img.width, spec.px,
                  inset, inset + innerH - stripH, innerW, stripH);
    } else {
      /* The captures start at the app's own header — there is no status bar
         in them — so pinning the strip flush to the top of the display puts
         it straight under the Dynamic Island, which ate the title. Reserve
         the island's band first and fill it by stretching the plate's top
         row, which is the header's own background: the result reads as the
         status-bar area the capture never had. The island itself is painted
         by the bezel at renderOrder 2, so it still lands on top. */
      const band = Math.max(0, H * 0.082 - inset);
      g.drawImage(img, 0, 0, img.width, 1, inset, inset, innerW, band + 1);
      g.drawImage(img, 0, 0, img.width, spec.px, inset, inset + band, innerW, stripH);
    }

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    const m = new THREE.Mesh(overlayGeo, new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }));
    m.castShadow = false;
    m.renderOrder = 1;
    m.visible = false;
    screenMesh.add(m);
    return m;
  }

  /* Each plate is a whole page, not a screen. `window` is the fraction of it
     visible at once — screen width over screen height, against the image's
     own aspect — and it is what the scroll tween moves.

     offset.y starts at 1 - window because three's V axis runs bottom-up
     while the image rows run top-down: the TOP of a capture lives at v = 1.
     Scrolling down the page therefore means offset.y counting DOWN to 0. */
  function loadPlate(url) {
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
        /* Clamped on both axes. The window slides right to the edges of the
           page, and on Repeat the last row of the footer would wrap round
           and show the status bar again directly beneath it. */
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        const win = Math.min(1, (img.width / screenAspect) / img.height);
        tex.repeat.set(1, win);
        tex.offset.set(0, 1 - win);
        tex.userData.window = win;
        tex.userData.img = img;      // buildSticky cuts its strip from this
        tex.needsUpdate = true;
        resolve(tex);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /* ════════════════════════════════════════════════════════════════
     CAMERA
     The rig is spherical and the phone never moves. Orbiting the CAMERA
     rather than the object is what keeps the contact shadow anchored —
     spin the phone and its shadow swings with it, which reads as fake
     instantly.
     ════════════════════════════════════════════════════════════════ */
  const rig = { az: 0, el: 0, dist: 14, tx: 0, ty: 0, roll: 0, key: 1, amb: 1 };
  const drag = { az: 0, el: 0 };

  function applyRig() {
    const az = THREE.MathUtils.degToRad(rig.az + drag.az);
    const el = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(rig.el + drag.el, -22, 46)
    );
    const target = new THREE.Vector3(rig.tx, rig.ty, 0);
    camera.position.set(
      target.x + rig.dist * Math.sin(az) * Math.cos(el),
      target.y + rig.dist * Math.sin(el),
      target.z + rig.dist * Math.cos(az) * Math.cos(el)
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.rotateZ(THREE.MathUtils.degToRad(rig.roll));

    key.intensity = 2.5 * rig.key;
    ambient.intensity = 0.16 + 0.2 * rig.amb;
    hemi.intensity = 0.14 + 0.26 * rig.amb;
    splats.mat.uniforms.uGain.value = 0.55 + 0.45 * rig.amb;

    /* ── glass response ───────────────────────────────────────────────
       Same two behaviours the monitor stage drives, for the same reason: a
       screen is a picture behind a mirror, and which of the two you are
       looking at depends on the angle. WHERE the bar sits moves with the
       tangent of the view angle rather than linearly, because a reflected
       light accelerates across a panel as the panel turns away — the
       linear version reads as painted on. HOW STRONG it is follows
       Fresnel, so the room takes over as the phone goes edge-on.

       The exponent is 2.6 rather than Schlick's 5, as on the monitor: true
       Fresnel is nearly flat until about 60 degrees off-axis and this
       choreography never leaves ±25, so the exact curve would hold one
       constant value through all three shots.

       The ceiling is 0.09 and that is arithmetic, not taste. These plates
       are mostly white cards on near-white ground, a few percent apart;
       any uniform additive lift much above that clips both to the same
       white and every card edge in the UI disappears at once. The bar
       survives it by being narrow and by having the black surround to
       read on. */
    if (sheenMat && screenMesh) {
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(screenMesh.getWorldQuaternion(new THREE.Quaternion()));
      const eye = camera.position.clone().sub(screenMesh.getWorldPosition(new THREE.Vector3())).normalize();
      const cosT = Math.abs(n.dot(eye));
      const fres = 0.04 + 0.96 * Math.pow(1 - cosT, 2.6);
      sheenTex.offset.y = THREE.MathUtils.clamp(
        -Math.atan2(eye.x, Math.max(cosT, 0.08)) * 0.40, -0.46, 0.46
      );
      sheenMat.opacity = THREE.MathUtils.clamp(0.015 + fres * 0.55, 0.015, 0.09);
    }
  }

  /* ── the plate, and the scroll through it ───────────────────────── */
  let scrollTween = null;

  function showPlate(index) {
    const plate = plates[index];
    if (!plate || !screenMat) return;
    if (screenMat.map !== plate) {
      screenMat.map = plate;
      screenMat.color.set(0xffffff);
      screenMat.needsUpdate = true;
    }
    // rewind to the top of the page for this shot
    plate.offset.y = 1 - plate.userData.window;
    stickyMeshes.forEach((m, i) => { if (m) m.visible = i === index; });
  }

  /* The scroll itself. `travel` is how much of the remaining page the shot
     moves through, 0..1 — a value of 1 would run a 4.6-screen capture past
     the eye in three seconds, which reads as a flick rather than as reading.
     Eased at both ends, because a scroll that starts and stops at full speed
     is the one thing that always looks scripted. */
  function scrollPlate(index, travel, seconds) {
    const plate = plates[index];
    if (!plate) return;
    if (scrollTween) scrollTween.kill();
    const win = plate.userData.window;
    const room = Math.max(0, 1 - win);
    scrollTween = gsap.to(plate.offset, {
      y: (1 - win) - room * travel,
      duration: seconds,
      ease: "power1.inOut",
    });
  }

  /* ════════════════════════════════════════════════════════════════
     CHOREOGRAPHY — cuts, not moves. The camera jumps between setups and
     creeps within them; what changes continuously is the page under the
     glass. See softbox-stage.js for why the cuts are hard.
     ════════════════════════════════════════════════════════════════ */
  let tl = null;
  let idle = null;
  let running = false;

  function buildTimeline(from) {
    if (tl) tl.kill();
    tl = gsap.timeline({ repeat: -1 });

    SHOTS.forEach((_, i) => {
      const order = (from + i) % SHOTS.length;
      const shot = SHOTS[order];
      tl.call(() => {
        showPlate(shot.plate);
        scrollPlate(shot.plate, shot.scroll !== undefined ? shot.scroll : 0.7, shot.hold);
      });
      tl.set(rig, shot.from);
      tl.to(rig, { ...shot.to, duration: shot.hold, ease: "none" });
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
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
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
    const PIXEL_BUDGET = 1.15e6;
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
    /* A phone is tall, so the framing runs out of HEIGHT before width — the
       opposite of the monitor stage. Narrow the field of view as the frame
       widens so a landscape card does not push the phone away to fit. */
    camera.fov = w / h < 0.85 ? 30 : 26;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* ── run ────────────────────────────────────────────────────────── */
  function start() {
    resize();
    showPlate(0);
    renderer.shadowMap.needsUpdate = true;
    if (still) {
      Object.assign(rig, SHOTS[0].from);
      showPlate(SHOTS[0].plate);
    } else {
      buildTimeline(0);
    }
    running = true;
    canvas.dataset.running = "1";
    renderer.setAnimationLoop(() => {
      applyRig();
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      sortSplats(rig.az + drag.az);
      renderFrame();
    });
  }

  /* Model first, then the plates. Order matters: each plate's scroll window
     is computed against the SCREEN's aspect, and that number is measured off
     the model's own mesh as it loads. Racing them would size every window
     against a guess. */
  loadPhone(MODEL_URL)
    .then(() => Promise.all(plateUrls.map(loadPlate)))
    .then((loaded) => {
      plates.push(...loaded);
      // after the plates, because each strip is cut from its own plate
      loaded.forEach((tex, i) => stickyMeshes.push(buildSticky(tex, STICKY[i])));
      start();
    })
    .catch((err) => {
      // a failure here leaves the poster showing, which is the right
      // fallback — but say why, or it looks like success
      console.error("Phone stage failed to start", err);
    });

  return {
    pause() {
      if (!running) return;
      running = false;
      canvas.dataset.running = "0";
      if (tl) tl.pause();
      if (scrollTween) scrollTween.pause();
      renderer.setAnimationLoop(null);
    },
    resume() {
      if (running) return;
      running = true;
      canvas.dataset.running = "1";
      if (tl && !still) tl.resume();
      if (scrollTween) scrollTween.resume();
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
