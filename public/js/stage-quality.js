/* Optional render-quality path for the softbox and phone stages.
 *
 * Everything here is additive and gated: a stage only takes this path when
 * its config carries a `quality` block, and if this file fails to load the
 * stages render exactly as they did before. That is deliberate — it is the
 * A/B. One case can run the expensive path while the others do not, on the
 * same page, in the same scroll.
 *
 * The four things it adds that the base path cannot do:
 *
 *   1. An environment with values ABOVE 1.0. The base path paints its
 *      studio into a 2D canvas, which is 8-bit sRGB and therefore clamped.
 *      That clamp is the reason the key slit in softbox-stage had to be
 *      dropped to alpha 0.5 — at 1.0 it blew out and took the enclosure
 *      with it. A specular source is supposed to be many times brighter
 *      than white; here it can be.
 *
 *   2. Ambient occlusion. The base path paints one radial pool under the
 *      foot, which reads as contact but cannot reach the crevices — the
 *      chin under the glass, the arm/base joint, the seam where the bezel
 *      meets the body. Those are what read as an offline render.
 *
 *   3. Bloom. Only meaningful once (1) exists, because nothing in the base
 *      scene ever exceeds 1.0 and a threshold pass would find nothing.
 *
 *   4. Its own antialiasing, which it has to bring because moving the scene
 *      into a render target takes away the canvas's. `antialias: true` on
 *      the context applies to the DEFAULT framebuffer only; a render target
 *      is single-sampled unless asked otherwise, so the first version of
 *      this file silently dropped the AA the base path had and every
 *      geometry edge came back stair-stepped. `samples` puts it back.
 *
 * Tone mapping moves in here. The base path lets three tone-map in each
 * material's own shader; that is wrong the moment bloom exists, because
 * bloom has to see linear light before the curve compresses it. So on this
 * path the renderer is set to NoToneMapping, everything accumulates linear
 * into a half-float buffer, and ACES is applied once at the end.
 */
window.StageQuality = function (THREE, renderer, opts) {
  const O = Object.assign({
    hdrEnv: true,
    ao: true,
    bloom: true,
    ss: 1.0,          /* supersample factor; 1.0 disables. See msaa first. */
    /* Multisample count for the scene buffer. 0 disables, which is what a
       render target does by default and is why this option exists at all. */
    msaa: 4,
    /* Multiplier on the screen glare. 1 is the authored strength. */
    glareGain: 1,
    /* Quad opacity -> linear light added to the picture. See softbox-stage. */
    glareLinear: 1.2,
    aoRadius: 0.28,   /* world units. The bezel seam is 0.055, the arm/base
                         joint about 0.12 — a radius well above both, or the
                         occlusion never reaches across the gap. */
    aoIntensity: 0.9,
    /* In LINEAR light, pre-curve, where diffuse white sits near 1 and a
       specular hit off a chamfer runs to several. Above 1 so it catches the
       second and not the first. */
    bloomThreshold: 1.5,
    bloomIntensity: 0.55,
    exposure: 1.05,
    /* How much brighter the finished environment is than its bare sky —
       i.e. how much ambient the lamps are allowed to add. This is the
       exposure dial for the whole scene; the per-source intensities below
       are the LOOK dial. Keeping them separate is what stops a change to
       one highlight from re-grading the entire film. */
    ambientGain: 1.25,

    /* ── the front key ───────────────────────────────────────────────
       Every source in this studio sits BEHIND or BESIDE the device. The
       key is at u 0.24, diametrically opposite the camera; the slit runs
       u 0.117 to 0.742 and stops just short of the camera side. That is a
       deliberate rim-light setup and it is why the enclosure reads well.

       But it leaves the glass with nothing to return. A screen facing the
       lens mirrors whatever is BEHIND the lens, and behind the lens this
       map is bare gradient — so the panel comes back as a flat tint no
       matter how the camera moves. That is also, in hindsight, why the
       earlier reflective-overlay attempt on the monitor measured as a flat
       -3 levels rather than a highlight: the overlay was working, there
       was simply nothing in front of the device to reflect.

       This is the missing lamp: a broad, soft source on the camera side,
       the equivalent of the overhead front softbox a product shot is lit
       with. Because the mirror direction turns at TWICE the rate the
       camera orbits, the 9 degrees of azimuth in each shot sweep it about
       18 degrees across the source, which is what makes the highlight
       travel rather than sit.

       u = atan2(z, x) / 2pi + 0.5, so the device's front (+z) is u 0.75.
       Off by default; every value below was found by sweeping it. */
    frontKey: 0,        /* peak. 0 disables, and is the default. */
    frontKeyU: 0.75,    /* azimuth: 0.75 is dead in front of the device */
    frontKeyV: 0.5,     /* polar: 0.5 is the horizon */
    frontKeyW: 0.16,    /* half-width, as a fraction of the map */
    frontKeyH: 0.20,    /* half-height, ditto */

    /* Firefly rejection in the supersample resolve. A sample brighter than
       `flyK` times the median of the four, plus `flyFloor`, is pulled back
       to that ceiling. Raise flyFloor to let more genuine small glints
       through; set flyK very high to disable. */
    flyK: 4.0,
    flyFloor: 0.5,
    /* Despeckle: an output pixel brighter than `speckK` times its brightest
       neighbour, plus `speckFloor`, is pulled back. 0 disables. Never
       applied over the screen plate. */
    speckK: 1.5,
    speckFloor: 0.06,
  }, opts || {});

  /* ?qo=ambientGain:0.6,bloomIntensity:0.3 overrides any of the dials above
     for one load. Every value here has to be found by measuring a render
     rather than by reasoning about it, and an edit-bump-reload cycle per
     attempt makes that so slow that the temptation is to settle early.
     Numbers parse as numbers, "true"/"false" as booleans, so the feature
     switches take it too. */
  const qo = /[?&]qo=([^&]+)/.exec(location.search);
  if (qo) {
    for (const part of decodeURIComponent(qo[1]).split(",")) {
      const [k, v] = part.split(":");
      if (!(k in O)) continue;
      O[k] = v === "true" ? true : v === "false" ? false : parseFloat(v);
    }
  }

  /* ── colour helpers ──────────────────────────────────────────────── */

  /* The sibling of linearToSrgb in softbox-stage. The environment stops are
     written as hex because that is how they were art-directed, but light
     has to be mixed in linear or the gradient darkens through its middle. */
  function srgbToLinear(v) {
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function hexToLinear(hex) {
    return [
      srgbToLinear(((hex >> 16) & 255) / 255),
      srgbToLinear(((hex >> 8) & 255) / 255),
      srgbToLinear((hex & 255) / 255),
    ];
  }

  /* ── 1. the environment, unclamped ───────────────────────────────── */

  /* Same painting as buildEnvironment() in softbox-stage — the same sky
     gradient, the same three softboxes, the same slit — but written into a
     float buffer by hand instead of a canvas, so the sources can carry the
     intensities they actually have in a studio.

     The sky stays under 1. The softboxes are the light: a key at 14 and a
     slit at 46 are not arbitrary, they are roughly the ratio between a
     bounced fill and a bare strip at a metre in a real set. What they buy
     is a specular highlight that is BRIGHTER THAN WHITE, which is the thing
     the 8-bit path could not express at any alpha. */
  function buildEnvHDR() {
    const W = 512, H = 256;
    const data = new Float32Array(W * H * 4);

    const stops = [
      [0.00, 0xffffff, 1.00],
      [0.30, 0xe6ebf2, 1.00],
      [0.46, 0xaeb7c4, 1.00],
      [0.54, 0x4e5661, 1.00],
      [0.78, 0x171b21, 1.00],
      [1.00, 0x0a0c10, 1.00],
    ].map(([t, hex, mul]) => {
      const c = hexToLinear(hex);
      return [t, c[0] * mul, c[1] * mul, c[2] * mul];
    });

    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);
      let a = stops[0], b = stops[stops.length - 1];
      for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
      }
      const f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      const r = a[1] + (b[1] - a[1]) * f;
      const g = a[2] + (b[2] - a[2]) * f;
      const bl = a[3] + (b[3] - a[3]) * f;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = bl; data[i + 3] = 1;
      }
    }

    /* The bare sky's mean, taken BEFORE any source is added — the reference
       the finished map is scaled back to. */
    let skyMean = 0;
    for (let i = 0; i < W * H; i++) {
      const j = i * 4;
      skyMean += 0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2];
    }
    skyMean /= W * H;

    /* Additive, and in linear light, so two overlapping sources sum the way
       two real lamps do rather than compositing over one another. */
    function box(cx, cy, w, h, peak) {
      const x0 = Math.max(0, Math.floor(cx - w)), x1 = Math.min(W - 1, Math.ceil(cx + w));
      const y0 = Math.max(0, Math.floor(cy - h)), y1 = Math.min(H - 1, Math.ceil(cy + h));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = (x - cx) / w, dy = (y - cy) / h;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= 1) continue;
          /* Same falloff shape the canvas radial gradient had: hot core,
             long shoulder, zero at the rim. */
          const f = d < 0.55
            ? 1 - (d / 0.55) * 0.62
            : 0.38 * (1 - (d - 0.55) / 0.45);
          const v = peak * f;
          const i = (y * W + x) * 4;
          data[i] += v; data[i + 1] += v; data[i + 2] += v;
        }
      }
    }

    /* Halved from the canvas version's pixel coords, this map being 512x256
       where that one was 1024x512. */
    box(125, 59, 118, 75, 14);   // key, upper left
    box(350, 83, 83, 54, 5.5);   // secondary, upper right
    box(445, 125, 59, 33, 3);    // glint near the horizon

    /* The front key. Placed in normalised coords rather than pixels because
       unlike the three above it was positioned by sweeping a dial, and a
       fraction of the map survives a change of resolution. */
    if (O.frontKey > 0) {
      box(O.frontKeyU * W, O.frontKeyV * H, O.frontKeyW * W, O.frontKeyH * H, O.frontKey);
    }

    /* The slit. In the 8-bit path this was the single most important
       element and also the most compromised one — it had to sit at half
       opacity to avoid clipping, which made the brightest thing in the
       studio dimmer than a sheet of white paper. At 46 it behaves like a
       bare strip: narrow, hot, and the thing a 2mm chamfer catches and
       turns into a hard line down the edge of the enclosure. */
    const sy0 = 33, sy1 = 52, sx0 = 60, sx1 = 380;
    for (let y = sy0; y < sy1; y++) {
      const t = (y - sy0) / (sy1 - sy0);
      const f = Math.sin(Math.PI * t);
      for (let x = sx0; x < sx1; x++) {
        const ex = Math.min(1, Math.min(x - sx0, sx1 - x) / 40);
        const v = 46 * f * f * ex;
        const i = (y * W + x) * 4;
        data[i] += v; data[i + 1] += v; data[i + 2] += v;
      }
    }

    /* Normalise the total, keep the ratios.
       An environment map lights the scene twice over: the peaks decide the
       specular highlights, and the AVERAGE decides the ambient. Writing a
       key at 14 and a slit at 46 raised both, and the first render came back
       flooded — the enclosure white, the screen washed out, the backdrop
       gone pale. The sources are large in area, so raising them raised the
       irradiance far more than it raised any highlight.

       So the map is scaled so its mean luminance lands a fixed fraction
       above the bare sky's. The ambient is then pinned to roughly what the
       8-bit path delivered, while the peaks keep the ratio to the sky that
       makes them read as sources rather than as pale patches. Tuning any
       individual number above now changes the SHAPE of the light and not
       the exposure, which is the only way these are tunable by hand. */
    const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    let fullMean = 0;
    for (let i = 0; i < W * H; i++) fullMean += lum(i * 4);
    fullMean /= W * H;
    const target = skyMean * O.ambientGain;
    const scale = fullMean > 0 ? target / fullMean : 1;
    for (let i = 0; i < W * H * 4; i += 4) {
      data[i] *= scale; data[i + 1] *= scale; data[i + 2] *= scale;
    }

    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }

  /* ── the post chain ──────────────────────────────────────────────── */

  const QUAD = new THREE.BufferGeometry();
  QUAD.setAttribute("position", new THREE.BufferAttribute(
    new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  QUAD.setAttribute("uv", new THREE.BufferAttribute(
    new Float32Array([0, 0, 2, 0, 0, 2]), 2));

  /* No #version line here. three prepends it for a RawShaderMaterial with
     glslVersion set, and a second one is a compile error rather than a
     duplicate — "#version must occur before anything else". It does not
     prepend a precision qualifier for a raw material though, so the
     fragment shaders declare their own. */
  const VERT = `
    in vec3 position;
    in vec2 uv;
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  function pass(fragmentShader, uniforms) {
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: uniforms,
      vertexShader: VERT,
      fragmentShader: "precision highp float;\nprecision highp sampler2D;\n" + fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(QUAD, mat);
    mesh.frustumCulled = false;
    const sc = new THREE.Scene();
    sc.add(mesh);
    return { scene: sc, mat: mat, uniforms: uniforms };
  }

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function rt(w, h, extra) {
    const t = new THREE.WebGLRenderTarget(w, h, Object.assign({
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      colorSpace: THREE.NoColorSpace,
    }, extra || {}));
    return t;
  }

  function createPost(camera) {
    const depthTex = new THREE.DepthTexture(1, 1);
    depthTex.format = THREE.DepthFormat;
    depthTex.type = THREE.UnsignedIntType;
    depthTex.minFilter = THREE.NearestFilter;
    depthTex.magFilter = THREE.NearestFilter;

    /* MSAA on the scene buffer, and this is not an optimisation — it is
       restoring something the base path already had.

       The canvas is created with `antialias: true`, which gives MSAA on the
       DEFAULT framebuffer. The moment the scene is rendered into a render
       target instead, that does nothing: a plain WebGLRenderTarget is
       single-sampled, so every geometry edge in the film comes back
       stair-stepped. It showed up exactly where you would expect — along
       the top bezel, which is a near-horizontal edge of dark metal against
       a pale ground, the worst case there is.

       Supersampling was the wrong answer to this. It costs 1.96x the
       pixels of a fill-rate-bound scene and buys a worse result than four
       MSAA samples, which are resolved by the hardware at a fraction of the
       cost. WebGL2 only; on WebGL1 `samples` is ignored and the film falls
       back to the aliased edges rather than failing. */
    /* MSAA and the depth texture cannot share a target.
       three sets `samples` willingly — the target reports 4 — but a target
       carrying a depthTexture is never resolved through the multisampled
       path, so the flag is accepted and does nothing. Measured on the top
       bezel, which is a near-horizontal edge of dark metal against a pale
       ground and therefore the worst case on screen: the transition ramp
       was 0.96px with samples 0 and 0.94px with samples 4. Identical. That
       is a hard edge, and it is what read as pixelated.

       So they are separated. The scene buffer gets the multisampling and an
       ordinary depth renderbuffer; AO gets its depth from a second, single-
       sampled pass that draws the same geometry under a flat material. The
       prepass is cheap — no environment sampling, no PBR, no splats, just
       the device writing depth. */
    const sceneRT = rt(1, 1, { depthBuffer: true, samples: O.msaa });
    const depthRT = rt(1, 1, { depthBuffer: true, depthTexture: depthTex });
    /* Which pixels must NOT be tone-mapped. See EXEMPT_LAYER below. One
       channel would do; the format is shared with everything else here to
       keep one rt() helper. */
    const maskRT = rt(1, 1, { samples: O.msaa });
    const aoRT = rt(1, 1);
    const aoBlurRT = rt(1, 1);
    const bright = rt(1, 1);
    const mips = [rt(1, 1), rt(1, 1), rt(1, 1)];
    const tmp = [rt(1, 1), rt(1, 1), rt(1, 1)];

    /* ── 2. ambient occlusion ───────────────────────────────────────
       View-space hemisphere sampling off the depth buffer, with the normal
       reconstructed from screen-space derivatives rather than a second
       geometry pass. The derivative normal is faceted along a silhouette,
       which would matter if this were lighting the scene; it is not, it is
       darkening crevices, and a crevice is exactly where the derivative is
       well behaved. */
    const ao = pass(`
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tDepth;
      uniform mat4 uProjInv;
      uniform mat4 uProj;
      uniform vec2 uRes;
      uniform float uRadius;
      uniform float uIntensity;

      vec3 viewPos(vec2 uv, float d) {
        vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        vec4 v = uProjInv * ndc;
        return v.xyz / v.w;
      }

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        float d = texture(tDepth, vUv).r;
        /* Cleared depth. Nothing was drawn here, so there is nothing to
           occlude — and sampling around it produces a dark halo around the
           whole silhouette, which is the classic SSAO tell. */
        if (d >= 0.99999) { outColor = vec4(1.0); return; }

        vec3 p = viewPos(vUv, d);
        vec3 n = normalize(cross(dFdx(p), dFdy(p)));
        if (n.z < 0.0) n = -n;

        float a = hash(vUv * uRes) * 6.2831853;
        float ca = cos(a), sa = sin(a);
        mat2 rot = mat2(ca, -sa, sa, ca);

        const int N = 16;
        float occ = 0.0;
        for (int i = 0; i < N; i++) {
          float fi = float(i);
          /* A spiral, rotated per pixel. Cheaper than a kernel texture and
             it distributes evenly for any N. */
          float ang = fi * 2.399963;
          float rad = sqrt((fi + 0.5) / float(N));
          vec2 disk = rot * vec2(cos(ang), sin(ang)) * rad;

          /* Lift into the hemisphere around n rather than sampling a full
             sphere, or half of every sample lands inside the surface and
             flat ground comes back at 0.5 occlusion. */
          vec3 t1 = normalize(abs(n.z) < 0.9 ? cross(n, vec3(0.0, 0.0, 1.0)) : cross(n, vec3(1.0, 0.0, 0.0)));
          vec3 t2 = cross(n, t1);
          float hz = sqrt(max(0.0, 1.0 - dot(disk, disk)));
          vec3 dir = normalize(t1 * disk.x + t2 * disk.y + n * hz);

          vec3 sp = p + dir * uRadius * (0.35 + 0.65 * rad);
          vec4 cp = uProj * vec4(sp, 1.0);
          vec2 suv = (cp.xy / cp.w) * 0.5 + 0.5;
          if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;

          float sd = texture(tDepth, suv).r;
          if (sd >= 0.99999) continue;
          vec3 op = viewPos(suv, sd);

          /* op.z and sp.z are both negative in view space; a sample is
             occluded when the geometry at that pixel is NEARER the camera
             than the sample point. */
          float diff = op.z - sp.z;
          if (diff > 0.015) {
            /* Range check, or a foreground silhouette occludes background
               it is nowhere near and the device grows a dark outline. */
            occ += smoothstep(1.0, 0.0, abs(diff) / (uRadius * 2.0));
          }
        }
        float v = 1.0 - (occ / float(N)) * uIntensity;
        outColor = vec4(clamp(v, 0.0, 1.0), 0.0, 0.0, 1.0);
      }
    `, {
      tDepth: { value: depthTex },
      uProjInv: { value: new THREE.Matrix4() },
      uProj: { value: new THREE.Matrix4() },
      uRes: { value: new THREE.Vector2() },
      uRadius: { value: O.aoRadius },
      uIntensity: { value: O.aoIntensity },
    });

    /* Depth-aware, so the blur softens the noise without bleeding occlusion
       across the edge of the enclosure onto the backdrop behind it. */
    const aoBlur = pass(`
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tAO;
      uniform sampler2D tDepth;
      uniform vec2 uTexel;

      void main() {
        float dc = texture(tDepth, vUv).r;
        float sum = 0.0, wsum = 0.0;
        for (int y = -2; y <= 2; y++) {
          for (int x = -2; x <= 2; x++) {
            vec2 uv = vUv + vec2(float(x), float(y)) * uTexel;
            float ds = texture(tDepth, uv).r;
            float w = exp(-abs(ds - dc) * 900.0);
            sum += texture(tAO, uv).r * w;
            wsum += w;
          }
        }
        outColor = vec4(wsum > 0.0 ? sum / wsum : 1.0, 0.0, 0.0, 1.0);
      }
    `, {
      tAO: { value: aoRT.texture },
      tDepth: { value: depthTex },
      uTexel: { value: new THREE.Vector2() },
    });

    /* ── 3. bloom ───────────────────────────────────────────────────
       Threshold with a soft knee so a highlight eases into the bloom
       instead of switching on, then three successive halvings each with a
       separable blur. Summing the three gives a wide falloff for the cost
       of three narrow ones. */
    const brightPass = pass(`
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tScene;
      uniform sampler2D tMask;
      uniform float uThreshold;
      void main() {
        /* The screen is excluded from bloom as well as from the curve. It is
           half the frame and almost all of it is white UI, so letting it
           bloom lays a veil over the entire film and the dashboard — the
           thing the shot exists to show — goes soft. Only the enclosure and
           the glass get to glow. */
        if (texture(tMask, vUv).r > 0.5) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        vec3 c = texture(tScene, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float knee = uThreshold * 0.6;
        float soft = clamp((l - uThreshold + knee) / (2.0 * knee), 0.0, 1.0);
        float w = max(soft * soft * (l > uThreshold ? 1.0 : soft), l > uThreshold ? 1.0 : 0.0);
        outColor = vec4(c * w, 1.0);
      }
    `, {
      tScene: { value: null },
      tMask: { value: maskRT.texture },
      uThreshold: { value: O.bloomThreshold },
    });

    const blur = pass(`
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tSrc;
      uniform vec2 uDir;
      void main() {
        vec3 c = texture(tSrc, vUv).rgb * 0.227027;
        c += texture(tSrc, vUv + uDir * 1.3846).rgb * 0.316216;
        c += texture(tSrc, vUv - uDir * 1.3846).rgb * 0.316216;
        c += texture(tSrc, vUv + uDir * 3.2308).rgb * 0.070270;
        c += texture(tSrc, vUv - uDir * 3.2308).rgb * 0.070270;
        outColor = vec4(c, 1.0);
      }
    `, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });

    /* ── composite ──────────────────────────────────────────────────
       AO multiplied in, bloom added, ACES applied once, sRGB written once.
       The 4-tap is the supersample resolve: sceneRT is larger than the
       canvas, and a single bilinear fetch would throw away most of what the
       extra pixels were rendered for. */
    const composite = pass(`
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tScene;
      uniform sampler2D tMask;
      uniform sampler2D tAO;
      uniform sampler2D tB0;
      uniform sampler2D tB1;
      uniform sampler2D tB2;
      uniform vec2 uTexel;
      uniform float uExposure;
      uniform float uBloom;
      uniform float uUseAO;
      uniform float uUseBloom;
      uniform float uFlyK;
      uniform float uFlyFloor;
      uniform float uSpeckK;
      uniform float uSpeckFloor;

      vec3 aces(vec3 x) {
        const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      vec3 toSrgb(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(max(c, 1e-5), vec3(1.0 / 2.4)) - 0.055,
                   step(0.0031308, c));
      }

      float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

      /* Pull a single wild sample back towards the other three.

         The 4-tap below is a box average, and a box average has no defence
         against one enormous sample: at 2x supersampling a subpixel-wide
         specular on the chamfer measured hundreds, and a quarter of
         hundreds is still white. That is the isolated white pixel that
         appeared on the dark bezel at the display's inner corner around
         t=3.0 and t=3.8 of the Maersk film — bisected to ss, not to
         bloom and not to AO, both of which were off in the still that
         still showed it.

         The cap is built from the MIDDLE two samples rather than the mean,
         so the outlier cannot raise its own ceiling. On a normal
         antialiased edge the four samples are within a few times each
         other, the cap lands far above all of them and nothing is touched
         — which is why this can sit in the resolve unconditionally instead
         of being switched on for one shot. */
      vec3 deflicker(vec3 c, float cap) {
        float l = luma(c);
        return l > cap && l > 1e-6 ? c * (cap / l) : c;
      }

      void main() {
        vec3 s0 = texture(tScene, vUv + vec2(-0.5, -0.5) * uTexel).rgb;
        vec3 s1 = texture(tScene, vUv + vec2( 0.5, -0.5) * uTexel).rgb;
        vec3 s2 = texture(tScene, vUv + vec2(-0.5,  0.5) * uTexel).rgb;
        vec3 s3 = texture(tScene, vUv + vec2( 0.5,  0.5) * uTexel).rgb;

        float l0 = luma(s0), l1 = luma(s1), l2 = luma(s2), l3 = luma(s3);
        float lmax = max(max(l0, l1), max(l2, l3));
        float lmin = min(min(l0, l1), min(l2, l3));
        /* The two middle values, without sorting: the total less the
           extremes. Halved, that is the median of an even set. */
        float lmed = (l0 + l1 + l2 + l3 - lmax - lmin) * 0.5;
        float cap = lmed * uFlyK + uFlyFloor;

        vec3 c = deflicker(s0, cap) + deflicker(s1, cap)
               + deflicker(s2, cap) + deflicker(s3, cap);
        c *= 0.25;

        /* ── despeckle, at OUTPUT resolution ────────────────────────────
           The cap above only sees inside one output pixel, and the artefact
           this was chased for is not that: at the display's inner corner
           there is a real, genuinely sub-pixel specular glint on the glass
           bevel. All four subsamples agree it is bright, so nothing above
           fires. What supersampling does is CONCENTRATE it — at ss 1 the
           same glint lands as a soft four-pixel blob peaking at 205, and at
           ss 2 it becomes a two-pixel spike at 243 on a bezel sitting in the
           twenties. Softer is a highlight; harder is a stuck pixel.

           So the second test asks whether this output pixel is far brighter
           than everything AROUND it. A continuous highlight — the line down
           a chamfer — has bright neighbours along its length and is left
           alone. An isolated dot has none and is pulled back.

           Gated off the mask, which is the screen plate: white text on the
           navy header is isolated bright pixels on dark by construction,
           and despeckling display-referred content would eat it. */
        float lc = luma(c);
        if (uSpeckK > 0.0 && lc > uSpeckFloor && texture(tMask, vUv).r < 0.5) {
          /* THREE output pixels out, not one. The glint is not a single
             pixel — it is a tight cluster of about three, and at radius one
             each member is its own bright neighbour and vouches for the
             rest, which is why the first attempt at this barely moved it
             (243 -> 234). The ring has to clear the cluster to see the
             bezel it is sitting on. A genuine thin highlight still survives:
             a line down a chamfer has bright neighbours ALONG its length at
             any radius. */
          vec2 o = uTexel * 6.0;   /* sceneRT is ss times the canvas, so 6 texels = 3 px */
          float nmax = 0.0;
          nmax = max(nmax, luma(texture(tScene, vUv + vec2(-o.x, -o.y)).rgb));
          nmax = max(nmax, luma(texture(tScene, vUv + vec2( 0.0, -o.y)).rgb));
          nmax = max(nmax, luma(texture(tScene, vUv + vec2( o.x, -o.y)).rgb));
          nmax = max(nmax, luma(texture(tScene, vUv + vec2(-o.x,  0.0)).rgb));
          nmax = max(nmax, luma(texture(tScene, vUv + vec2( o.x,  0.0)).rgb));
          nmax = max(nmax, luma(texture(tScene, vUv + vec2(-o.x,  o.y)).rgb));
          nmax = max(nmax, luma(texture(tScene, vUv + vec2( 0.0,  o.y)).rgb));
          nmax = max(nmax, luma(texture(tScene, vUv + vec2( o.x,  o.y)).rgb));
          float capOut = nmax * uSpeckK + uSpeckFloor;
          if (lc > capOut) c *= capOut / lc;
        }

        if (uUseAO > 0.5) c *= texture(tAO, vUv).r;

        if (uUseBloom > 0.5) {
          vec3 b = texture(tB0, vUv).rgb * 0.5
                 + texture(tB1, vUv).rgb * 0.32
                 + texture(tB2, vUv).rgb * 0.18;
          c += b * uBloom;
        }

        /* ACES everywhere except where the mask says otherwise. The mask is
           the screen plate: a UI screenshot is already display-referred, its
           whites are meant to BE white, and running it through a curve
           turned every white card on the dashboard a flat grey. */
        float exempt = texture(tMask, vUv).r;
        vec3 mapped = aces(c * uExposure);
        outColor = vec4(toSrgb(mix(mapped, clamp(c, 0.0, 1.0), exempt)), 1.0);
      }
    `, {
      uFlyK: { value: O.flyK },
      uFlyFloor: { value: O.flyFloor },
      uSpeckK: { value: O.speckK },
      uSpeckFloor: { value: O.speckFloor },
      tScene: { value: sceneRT.texture },
      tMask: { value: maskRT.texture },
      tAO: { value: aoBlurRT.texture },
      tB0: { value: mips[0].texture },
      tB1: { value: mips[1].texture },
      tB2: { value: mips[2].texture },
      uTexel: { value: new THREE.Vector2() },
      uExposure: { value: O.exposure },
      uBloom: { value: O.bloomIntensity },
      uUseAO: { value: O.ao ? 1 : 0 },
      uUseBloom: { value: O.bloom ? 1 : 0 },
    });

    let W = 1, H = 1;

    function draw(p, target) {
      renderer.setRenderTarget(target || null);
      renderer.render(p.scene, cam);
    }

    return {
      sceneRT: sceneRT,

      setSize: function (w, h) {
        W = Math.max(2, Math.round(w * O.ss));
        H = Math.max(2, Math.round(h * O.ss));
        sceneRT.setSize(W, H);
        depthRT.setSize(W, H);
        maskRT.setSize(W, H);
        depthTex.image.width = W;
        depthTex.image.height = H;
        depthTex.needsUpdate = true;
        aoRT.setSize(W, H);
        aoBlurRT.setSize(W, H);
        bright.setSize(Math.max(2, W >> 1), Math.max(2, H >> 1));
        for (let i = 0; i < 3; i++) {
          const s = 2 << i;
          const mw = Math.max(2, Math.round(W / s / 2));
          const mh = Math.max(2, Math.round(H / s / 2));
          mips[i].setSize(mw, mh);
          tmp[i].setSize(mw, mh);
        }
        ao.uniforms.uRes.value.set(W, H);
        aoBlur.uniforms.uTexel.value.set(1 / W, 1 / H);
        composite.uniforms.uTexel.value.set(1 / W, 1 / H);
      },

      /* drawScene draws the whole stage — backdrop quad then device — into
         whatever target is currently bound. */
      render: function (drawScene, drawMask, drawDepth) {
        renderer.setRenderTarget(sceneRT);
        renderer.clear();
        drawScene();

        /* drawMask clears the target itself — it starts white rather than
           black, so the backdrop is exempt by default. */
        renderer.setRenderTarget(maskRT);
        if (drawMask) drawMask();

        if (O.ao && drawDepth) {
          /* Depth only, single-sampled, same camera and size as the scene
             buffer so the AO lines up with what it is darkening. */
          renderer.setRenderTarget(depthRT);
          renderer.clear();
          drawDepth();
        }

        if (O.ao) {
          ao.uniforms.uProj.value.copy(camera.projectionMatrix);
          ao.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
          draw(ao, aoRT);
          draw(aoBlur, aoBlurRT);
        }

        if (O.bloom) {
          brightPass.uniforms.tScene.value = sceneRT.texture;
          draw(brightPass, bright);
          let src = bright;
          for (let i = 0; i < 3; i++) {
            const w = mips[i].width, h = mips[i].height;
            blur.uniforms.tSrc.value = src.texture;
            blur.uniforms.uDir.value.set(1 / w, 0);
            draw(blur, tmp[i]);
            blur.uniforms.tSrc.value = tmp[i].texture;
            blur.uniforms.uDir.value.set(0, 1 / h);
            draw(blur, mips[i]);
            src = mips[i];
          }
        }

        renderer.setRenderTarget(null);
        renderer.clear();
        draw(composite, null);
      },
    };
  }

  return {
    opts: O,
    buildEnvHDR: buildEnvHDR,
    createPost: createPost,
  };
};
