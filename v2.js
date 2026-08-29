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
              /* These films run the full width of the page here, not a third
                 of it. The default budget pins a frame this size to 1x and
                 the browser upscales it, which is what softened the wide
                 opening shot. Enough for 1.5x at this size. */
              pixelBudget: 3.2e6,
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


  /* ── Carousels ─────────────────────────────────────────
     Position is measured off each column's own offsetLeft, not
     off the first column's width — the clients row and the
     testimonials row can hold columns of different widths, and
     dividing by one width drifts further out with every item.

     The track is never moved by hand. Arrows scroll it and the
     browser snaps; this only reports where it landed. */
  document.querySelectorAll('[data-car]').forEach(root => {
    const pre   = root.dataset.car;
    const track = document.getElementById(pre + '-track');
    const dots  = document.getElementById(pre + '-dots');
    const prev  = document.getElementById(pre + '-prev');
    const next  = document.getElementById(pre + '-next');
    if (!track) return;
    const cols = [...track.children];
    if (!cols.length) return;

    cols.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'car-dot';
      b.type = 'button';
      b.setAttribute('aria-label', 'Go to item ' + (i + 1));
      b.addEventListener('click', () => {
        current = i;
        pending = i;
        clearTimeout(release);
        release = setTimeout(settle, 800);
        paint(i);
        track.scrollTo({ left: targetOf(i) });
      });
      dots.appendChild(b);
    });
    const dotEls = [...dots.children];

    const originOf = i => cols[i].offsetLeft - cols[0].offsetLeft;
    const maxScroll = () => track.scrollWidth - track.clientWidth;
    /* The last column's origin sits short of the scroll maximum, because the
       track's trailing padding is part of scrollWidth. Aiming at the raw
       origin left a sliver unscrolled and the Next arrow permanently enabled,
       so the target is clamped to where the track can actually stop. */
    const targetOf = i => Math.min(originOf(i), maxScroll());
    /* No cols.length - perPage cap. That heuristic stopped the last press
       short whenever the final column's origin sat inside the scroll range:
       the track had further to travel but the index had already run out.
       The index runs to the last column and the TARGET is what gets clamped,
       so the last press always lands on the scroll maximum. */
    const indexNow = () => {
      const x = track.scrollLeft;
      let best = 0, bestD = Infinity;
      cols.forEach((_, i) => {
        const d = Math.abs(targetOf(i) - x);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };

    /* The index the arrows have committed to. Derived from scroll position
       only when the reader moves the track themselves — at the clamped end
       several columns share one resting position, so recomputing after every
       arrow press made prev skip a card on the way back. */
    let current = 0;
    let pending = -1, release = 0, queued = 0;
    const settle = () => { pending = -1; clearTimeout(release); };
    const paint = i => {
      dotEls.forEach((d, k) => d.classList.toggle('is-active', k === i));
      if (prev) prev.disabled = track.scrollLeft <= 1;
      if (next) next.disabled = track.scrollLeft >= maxScroll() - 1;
    };
    const sync = () => {
      queued = 0;
      if (pending >= 0) {
        if (Math.abs(track.scrollLeft - targetOf(pending)) > 2) { paint(pending); return; }
        settle();
        paint(current);
        return;
      }
      current = indexNow();
      paint(current);
    };
    const schedule = () => { if (!queued) queued = requestAnimationFrame(sync); };
    track.addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule, { passive: true });
    track.addEventListener('touchstart', settle, { passive: true });
    track.addEventListener('wheel', settle, { passive: true });

    /* One card per press, not one page. Stepping by the visible count put the
       target past the scroll maximum on a short row — with three visible and
       seven cards, originOf(3) is 1125 against a maxScroll of 1097, so the
       clamp sent the very first press to the end.

       An arrow also commits its destination straight away, so the dot moves
       with the slide rather than at the half-way point. */
    const go = dir => {
      const i = Math.max(0, Math.min(cols.length - 1, current + dir));
      current = i;
      pending = i;
      clearTimeout(release);
      release = setTimeout(settle, 800);
      paint(i);
      track.scrollTo({ left: targetOf(i) });
    };
    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));
    sync();
  });
