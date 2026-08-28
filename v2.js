/* ── Reveal on scroll ──────────────────────────────────
     One class, CSS does the motion. Unobserved once it has
     fired: these never need to run twice. */
  (() => {
    const els = document.querySelectorAll('.rise');
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '-40px 0px', threshold: 0.06 });
    els.forEach(el => io.observe(el));
    /* Anything already in view at load goes immediately, so the
       first screen is not waiting on a scroll that may not come. */
    requestAnimationFrame(() => {
      els.forEach(el => {
        if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
      });
    });
  })();

  /* ── Nav hairline on scroll ────────────────────────── */
  (() => {
    const nav = document.getElementById('nav');
    const onScroll = () => nav.classList.toggle('is-stuck', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

/* ── Case films ───────────────────────────────────────
     Same loader as the main build, pointed at the grey-ground
     config. Scenes build one at a time and every film that is
     meaningfully on screen keeps running — both lessons from
     the colour version, carried over rather than rediscovered. */
  (() => {
    const probe = document.createElement("canvas");
    const canRender = !!(window.WebGL2RenderingContext && probe.getContext("webgl2"));
    if (!canRender || !("IntersectionObserver" in window)) return;

    const load = (src) => new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src; el.async = false;
      el.onload = resolve; el.onerror = reject;
      document.body.appendChild(el);
    });

    let libs = null;
    const ensureLibs = () => {
      if (!libs) {
        libs = Promise.all([
          load("public/js/three.min.js"),
          load("public/js/gsap.min.js"),
        ])
          .then(() => load("public/js/stage-configs-mono.js"))
          .then(() => load("public/js/softbox-stage.js"))
          .then(() => load("public/js/phone-stage.js"));
      }
      return libs;
    };

    function visibleFraction(el) {
      const r = el.getBoundingClientRect();
      const vh = innerHeight || document.documentElement.clientHeight;
      if (r.height <= 0) return 0;
      return Math.max(0, Math.min(vh, r.bottom) - Math.max(0, r.top)) / r.height;
    }

    const handles = new Map();
    const starting = new WeakSet();
    let initChain = Promise.resolve();
    let queued = false;

    function pickWinner() {
      queued = false;
      handles.forEach((handle, el) => {
        if (visibleFraction(el) > 0.12) handle.resume();
        else handle.pause();
      });
    }
    function queuePick() {
      if (queued || !handles.size) return;
      queued = true;
      requestAnimationFrame(pickWinner);
    }
    addEventListener("scroll", queuePick, { passive: true });
    addEventListener("resize", queuePick, { passive: true });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (!entry.isIntersecting || handles.get(el) || starting.has(el)) return;
        starting.add(el);
        initChain = initChain
          .then(ensureLibs)
          .then(() => {
            const cfg = window.STAGE_CONFIGS[el.dataset.stage];
            const modelUrl = el.dataset.model;
            const init = modelUrl ? window.initPhoneStage : window.initSoftboxStage;
            handles.set(el, init(el, {
              plates: el.dataset.plates.split(","),
              shots: cfg.shots,
              ground: cfg.ground,
              model: modelUrl,
              sticky: cfg.sticky,
            }));
            return new Promise((done) => {
              let settled = false;
              const finish = () => {
                if (settled) return;
                settled = true;
                el.classList.add("is-live");
                queuePick();
                done();
              };
              requestAnimationFrame(() => requestAnimationFrame(finish));
              setTimeout(finish, 1200);
            });
          })
          .catch(() => { /* poster stays */ });
      });
      queuePick();
    }, { rootMargin: "700px 0px" });

    document.querySelectorAll("[data-stage]").forEach((el) => io.observe(el));
  })();


  /* ── Count up on entry ─────────────────────────────────
     The real number is in the HTML, so with no JS — or with
     reduced motion — the page states the fact rather than a
     zero it never leaves. Zeroing happens here, at init, well
     before the section is in view.

     Writing textContent from rAF is main-thread work, but it
     is four elements for a second and there is no compositor
     equivalent for counting. */
  (() => {
    const els = [...document.querySelectorAll('[data-count]')];
    if (!els.length || !('IntersectionObserver' in window)) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;                       // leave the real numbers alone

    const out = t => 1 - Math.pow(1 - t, 4);  // quart-out, same curve as the reveal
    const DUR = 1100;

    const render = (el, v) => {
      el.textContent = v + (el.dataset.suffix || '');
    };
    els.forEach(el => render(el, 0));

    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const t0 = performance.now();
      const frame = (now) => {
        const p = Math.min((now - t0) / DUR, 1);
        render(el, Math.round(out(p) * target));
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    els.forEach(el => io.observe(el));
  })();


  /* ── Experience: expand a row, or show them all ────────
     Rows carry data-open rather than a class so the chevron,
     the panel and the button state all read from one source. */
  (() => {
    const list = document.getElementById('xp-list');
    if (!list) return;

    list.querySelectorAll('.xp').forEach(item => {
      const btn = item.querySelector('.xp__row');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const open = item.dataset.open === 'true';
        item.dataset.open = String(!open);
        btn.setAttribute('aria-expanded', String(!open));
      });
    });

    const toggle = document.getElementById('xp-show-all');
    if (!toggle) return;
    const label = toggle.querySelector('.xp-toggle__label');
    const hidden = list.querySelectorAll('.xp--more');
    if (!hidden.length) { toggle.remove(); return; }

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      list.classList.toggle('is-all', !open);
      label.textContent = open ? 'Show all experience' : 'Show fewer';
      /* Collapsing can leave the button above the fold with the page
         scrolled past where the rows used to be. */
      if (open) {
        const top = list.getBoundingClientRect().top + scrollY - 120;
        if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
      }
    });
  })();
