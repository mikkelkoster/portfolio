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

  const ALU = "#cdd2d9";

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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  scene.background = new THREE.Color(GROUND.deep);
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
      alp[i] = 0.08 + rnd() * 0.16;
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

  const splats = buildSplats(4200);
  scene.add(splats.mesh);

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
      roughness: 0.74,
      metalness: 0.05,
      envMapIntensity: 0.22,
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
  const aluminium = (rough) => new THREE.MeshPhysicalMaterial({
    color: ALU,
    roughnessMap: brush,
    roughness: rough,
    metalness: 0.9,
    anisotropy: 0.6,
    envMapIntensity: 1.35,
  });

  /* ── the device ─────────────────────────────────────────────────── */
  const device = new THREE.Group();
  scene.add(device);

  const body = new THREE.Mesh(slab(BODY_W, BODY_H, BODY_R, BODY_D, BODY_BEVEL), aluminium(1));
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

  /* A faint sheet of reflected environment over the panel. Real glass is
     never purely emissive — you always see a little of the room in it. */
  const sheenMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, metalness: 1, roughness: 0.08,
    transparent: true, opacity: 0.055, envMapIntensity: 1.6,
  });
  const sheen = new THREE.Mesh(screenGeo, sheenMat);
  sheen.position.z = FACE_Z + 0.006;
  device.add(sheen);

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
    // fade both ends so the repeat seam never crosses the glass
    const ends = g.createLinearGradient(0, 0, 512, 0);
    ends.addColorStop(0.00, "rgba(0,0,0,1)");
    ends.addColorStop(0.16, "rgba(0,0,0,0)");
    ends.addColorStop(0.84, "rgba(0,0,0,0)");
    ends.addColorStop(1.00, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = ends;
    g.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
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

  /* The camera, centred in the top bezel. A one-line detail, but its
     absence is the kind of thing that reads as "not a real product" long
     before anyone works out why. */
  const eye = new THREE.Mesh(
    new THREE.CircleGeometry(0.022, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.5, roughness: 0.25 })
  );
  eye.position.set(0, SCREEN_H / 2 + BEZEL / 2, FACE_Z + 0.002);
  device.add(eye);

  const arm = new THREE.Mesh(slab(ARM_W, ARM_H, 0.06, ARM_D, 0.02), aluminium(1.1));
  arm.position.set(0, -BODY_H / 2 - ARM_H / 2 + DROP, ARM_Z);
  arm.castShadow = arm.receiveShadow = true;
  device.add(arm);

  const foot = new THREE.Mesh(slab(ARM_W, BASE_D, 0.14, BASE_T, 0.018), aluminium(1.1));
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

  /* ── a sharpened mip chain ────────────────────────────────────────
     The plate is 2048 wide and the panel covers roughly a thousand device
     pixels on the wide shots, so the GPU is minifying about 2:1 and picking
     mip level 1. A box-filtered mip level averages a one-pixel separator
     line straight into the white beside it, and the light grey row fills go
     with it — which is exactly the "lines disappear when it pans" symptom,
     and it is worst on the wides where the whole UI is meant to be read.

     Turning mipmaps OFF is the obvious fix and the wrong one: without a mip
     chain there is nothing for anisotropic filtering to sample, and the
     panel crawls with aliasing the moment the camera moves. Instead the
     chain is built by hand and each level is sharpened as it is made, so
     thin features survive the halving instead of dissolving into it.

     Only the first few levels get the treatment — they are the ones this
     camera ever samples, and unsharp masking a 2048x1536 image several
     times over is not free. */
  function unsharp(ctx, w, h, amount) {
    const src = ctx.getImageData(0, 0, w, h);
    const a = src.data;
    const out = ctx.createImageData(w, h);
    const b = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          // 3x3 neighbourhood mean, clamped at the edges
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            for (let dx = -1; dx <= 1; dx++) {
              const xx = Math.min(w - 1, Math.max(0, x + dx));
              sum += a[(yy * w + xx) * 4 + c];
            }
          }
          const blur = sum / 9;
          const v = a[i + c] + (a[i + c] - blur) * amount;
          b[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
        b[i + 3] = a[i + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  function buildMips(img) {
    const levels = [];
    let w = img.width;
    let h = img.height;
    let prev = document.createElement("canvas");
    prev.width = w;
    prev.height = h;
    prev.getContext("2d").drawImage(img, 0, 0);
    levels.push(prev);

    let level = 0;
    while (w > 1 || h > 1) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(prev, 0, 0, w, h);
      if (level < 3 && w > 8 && h > 8) {
        unsharp(g, w, h, 0.62);
      }
      levels.push(c);
      prev = c;
      level++;
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

  function applyRig() {
    const az = THREE.MathUtils.degToRad(rig.az + drag.az);
    const el = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(rig.el + drag.el, -6, 46)
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
    sheenMat.opacity = THREE.MathUtils.clamp(0.008 + fres * 0.14, 0.008, 0.028);
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
    renderer.setSize(w, h, false);
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
    if (still) {
      /* Reduced motion: hold the establishing shot. The page still shows
         the product, it simply does not move. Dragging still works. */
      Object.assign(rig, SHOTS[0].from);
    } else {
      buildTimeline(0);
    }
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
      renderer.render(scene, camera);
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
    resume() {
      if (running) return;
      running = true;
      canvas.dataset.running = "1";
      if (tl) tl.resume();
      renderer.setAnimationLoop(() => {
        applyRig();
        camera.updateMatrixWorld();
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        sortSplats(rig.az + drag.az);
        renderer.render(scene, camera);
      });
    },
  };
};