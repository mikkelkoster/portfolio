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
    /* Anything at or above the fold goes immediately, and again on every
       scroll frame. The observer alone is not enough: text is wiped in with
       clip-path, so an element that never receives is-in stays CLIPPED
       rather than merely un-animated — jumping straight to an anchor left
       nine of them with their descenders cut off. This sweep costs one rect
       read per element per scroll frame and removes that failure entirely. */
    const sweep = () => {
      let pending = false;
      els.forEach(el => {
        if (el.classList.contains('is-in')) return;
        if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
        else pending = true;
      });
      if (!pending) removeEventListener('scroll', onScroll);
    };
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; sweep(); });
    };
    addEventListener('scroll', onScroll, { passive: true });
    requestAnimationFrame(sweep);
  })();

  /* ── Nav hairline on scroll ────────────────────────── */
  (() => {
    const nav = document.getElementById('nav');
    /* Guarded. Without it a page with no nav throws here, and because every
       block in this file shares one scope that took the carousels, the films
       and the modal down with it — a missing header silently disabling the
       whole script. */
    if (!nav) return;
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
          /* Versioned like the stylesheet. These two carry the scene and its
             per-case colours, and the dev server sends only an ETag — an
             edited scene file otherwise sits behind a cached copy and the
             change looks like it did not take. */
          .then(() => load("public/js/stage-configs-mono.js?v=139"))
          .then(() => load("public/js/softbox-stage.js?v=139"))
          .then(() => load("public/js/phone-stage.js?v=139"));
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
     ONE engine, two sets of markup. The page rows and the case
     modal's rows used to have separate implementations: the
     modal's was copied from the page's before the page's bugs
     had been beaten out, so it still carried every one of them
     — the highlight snapping back on an arrow press, no pill,
     and dots that were unstyled <button>s down to the 2px
     outset border. There is one function now, so the next fix
     lands in both places.

     Position is measured off each column's own offsetLeft, not
     off the first column's width — the clients row and the
     testimonials row can hold columns of different widths, and
     dividing by one width drifts further out with every item.

     The track is never moved by hand. Arrows scroll it and the
     browser snaps; this only reports where it landed. */
  const carousels = [];
  function initCarousel({ track, dots, prev, next }) {
    if (!track || !dots) return null;
    const cols = [...track.children];
    if (!cols.length) return null;

    cols.forEach((_, i) => {
      const b = document.createElement('button');
      b.className = 'car-dot';
      b.type = 'button';
      b.setAttribute('aria-label', 'Go to item ' + (i + 1));
      b.addEventListener('click', () => {
        current = Math.min(i, lastIndex());
        pending = i;
        clearTimeout(release);
        release = setTimeout(settle, 800);
        paint(i);
        track.scrollTo({ left: targetOf(i) });
      });
      dots.appendChild(b);
    });
    const dotEls = [...dots.children];
    const pill = document.createElement('span');
    pill.className = 'car-pill';
    dots.appendChild(pill);

    const originOf = i => cols[i].offsetLeft - cols[0].offsetLeft;
    const maxScroll = () => track.scrollWidth - track.clientWidth;
    /* The last column's origin sits short of the scroll maximum, because the
       track's trailing padding is part of scrollWidth. Aiming at the raw
       origin left a sliver unscrolled and the Next arrow permanently enabled,
       so the target is clamped to where the track can actually stop. */
    /* The final column can also be WIDER than the scrollport — the
       design-system row holds several. Resting on its origin then leaves its
       right-hand side unreachable by the arrows while Next has already gone
       disabled, so the last stop is always the scroll maximum. On every row
       whose columns fit, that is what the clamp above already produced. */
    const targetOf = i => {
      const max = maxScroll();
      return i === cols.length - 1 ? max : Math.min(originOf(i), max);
    };
    /* Which cards are fully on screen once the track has come to rest at
       index i — measured off geometry, not derived from a card count.
       Dividing clientWidth by the pitch ignored the track's own padding,
       which counts toward clientWidth but is not space a card can occupy:
       on the page rows that rounded three visible cards up to four, so the
       pill lit a dot for a card sitting past the edge. It read as the
       indicator being one ahead of the row.

       Working from the resting position also gets the end right. There the
       track is clamped short of the index's own origin, so the cards on
       screen are the trailing ones — first comes back lower than i, which
       is correct and is what a count could never express. */
    const visibleRange = i => {
      const pad = cols[0].offsetLeft;
      const left = targetOf(i);
      const right = left + track.clientWidth - pad + 1;
      let first = -1, last = -1;
      cols.forEach((c, k) => {
        const o = originOf(k);
        if (o >= left - 1 && o + c.offsetWidth <= right) {
          if (first < 0) first = k;
          last = k;
        }
      });
      /* A column wider than the scrollport never fits — the design-system
         row holds a few. Fall back to the one the track is resting on. */
      return first < 0 ? [i, i] : [first, last];
    };
    /* The last index that still moves the track. Past it every column shares
       the same clamped resting position, so advancing further would light a
       new dot while nothing slid — which is exactly what the dots were doing
       when clicks outran the scroll.

       No cols.length - perPage cap. That heuristic stopped the last press
       short whenever the final column's origin sat inside the scroll range:
       the track had further to travel but the index had already run out.
       The index runs to the last column and the TARGET is what gets clamped,
       so the last press always lands on the scroll maximum. */
    const lastIndex = () => {
      const max = maxScroll();
      for (let i = 0; i < cols.length; i++) if (originOf(i) >= max - 1) return i;
      return cols.length - 1;
    };
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
    /* Disabled state comes from the index, not from scrollLeft: the scroll
       has not started yet when a press is painted, so reading position let a
       second click through after the last one. */
    const paint = i => {
      /* One dot per card, all of them shown. Hiding the unreachable ones made
         sense while a single dot meant a single position, but the highlight
         is a range now — the last cards are visible at the end even though
         the track cannot start on them, so their dots do light up. */
      const [first, last] = visibleRange(i);
      dotEls.forEach((d, k) => {
        d.hidden = false;
        d.classList.toggle('is-active', k >= first && k <= last);
      });
      /* Span the run from the centre of the first active dot to the centre of
         the last, plus one dot's width so both ends are capped. */
      const slot = dotEls[0].offsetWidth;
      const x0 = dotEls[first].offsetLeft + (slot - 7) / 2;
      const x1 = dotEls[last].offsetLeft + (slot - 7) / 2 + 7;
      pill.style.left = x0 + 'px';
      pill.style.width = (x1 - x0) + 'px';
      if (prev) prev.disabled = i <= 0;
      if (next) next.disabled = i >= lastIndex();
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
    addEventListener('resize', () => { if (typeof showControls === 'function') showControls(); }, { passive: true });
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
      const i = Math.max(0, Math.min(lastIndex(), current + dir));
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

    /* Remeasure on demand. A row inside the closed modal measures fine —
       the sheet is display:block and merely transformed off-screen — but
       its images are lazy and several columns size to the image, so the
       widths this measured at load are not the widths after opening. */
    /* A row that fits needs no controls. The quote row shows all three of its
       cards at once on a wide screen, so its dots and arrows were offering to
       scroll something that could not move. Hidden rather than disabled: a
       disabled control still says "there is more here". */
    const footer = dots.closest('.cm-car__footer, .car-nav');
    const showControls = () => {
      if (!footer) return;
      footer.hidden = track.scrollWidth <= track.clientWidth + 1;
    };
    const remeasure = () => {
      settle(); current = indexNow(); paint(current); showControls();
    };
    showControls();
    const handle = { remeasure, track };
    carousels.push(handle);
    return handle;
  }

  document.querySelectorAll('[data-car]').forEach(root => {
    const pre = root.dataset.car;
    initCarousel({
      track: document.getElementById(pre + '-track'),
      dots:  document.getElementById(pre + '-dots'),
      prev:  document.getElementById(pre + '-prev'),
      next:  document.getElementById(pre + '-next'),
    });
  });

  /* The modal's rows differ only in their class names and in living inside
     the sheet. Same engine, same dots, same pill. */
  const modalCarousels = [];
  document.querySelectorAll('.cm-car__track').forEach(track => {
    const id = track.id.replace('-track', '');
    const h = initCarousel({
      track,
      dots: document.getElementById(id + '-dots'),
      prev: document.getElementById(id + '-prev'),
      next: document.getElementById(id + '-next'),
    });
    if (h) modalCarousels.push(h);
  });
  /* An image that finishes after the sheet has opened changes its column's
     width, and with it the scroll extent the arrows are derived from. */
  modalCarousels.forEach(({ track, remeasure }) => {
    track.querySelectorAll('img').forEach(img => {
      if (img.complete) return;
      img.addEventListener('load', remeasure, { once: true });
    });
  });
  /* ── Case modal ────────────────────────────────────────
     The sheet slides up, the page behind it locks, and the
     panel drops its transform once it has arrived — an
     identity transform still promotes a twelve-thousand-pixel
     panel to its own layer, and rasterising a mask that size
     is slow enough that a fast scroll can outrun it and show
     straight through to the page beneath. It only needs to be
     a layer while it is moving. */
  (() => {
    const overlay  = document.getElementById('cm-overlay');
    const modal    = document.getElementById('cm-modal');
    const scroller = document.getElementById('cm-scroller');
    const panel    = document.getElementById('cm-panel');
    const closeBtn = document.getElementById('cm-close');
    if (!modal || !panel) return;

    const IN  = 'transform .6s cubic-bezier(0.32, 0.72, 0, 1)';
    const OUT = 'transform .52s cubic-bezier(0.4, 0, 0.8, 0.55)';
    let lastTrigger = null;

    /* One sheet, three cases. The trigger names which content block to show;
       the rest are hidden, so their carousels measure zero until the sheet
       opens and remeasure() runs against a laid-out track. */
    const contents = panel.querySelectorAll('[id^="modal-content-"]');
    const showCase = (name) => {
      let found = false;
      contents.forEach(c => {
        const mine = c.id === 'modal-content-' + name;
        c.hidden = !mine;
        if (mine) found = true;
      });
      /* An unknown name would hide everything and open an empty sheet. */
      if (!found && contents.length) contents[0].hidden = false;
    };

    const open = (trigger) => {
      lastTrigger = trigger || null;
      showCase(trigger && trigger.dataset.case || 'maersk');
      const label = trigger && trigger.dataset.case;
      if (label) modal.setAttribute('aria-label', label + ' case study');
      document.body.style.overflow = 'hidden';
      scroller.scrollTop = 0;
      modal.classList.remove('is-at-end');
      panel.style.transition = 'none';
      panel.style.transform = 'translateY(100%)';
      panel.getBoundingClientRect();          // flush the reset
      overlay.classList.add('is-open');
      modal.classList.add('is-open');
      panel.style.transition = IN;
      panel.style.transform = 'translateY(0)';
      closeBtn.hidden = false;
      setTimeout(() => closeBtn.classList.add('is-visible'), 420);
      const settle = (e) => {
        if (e.propertyName !== 'transform') return;
        panel.removeEventListener('transitionend', settle);
        if (!modal.classList.contains('is-open')) return;
        panel.style.transition = 'none';
        panel.style.transform = 'none';
        modal.classList.add('is-settled');   // arms the opaque backstop
      };
      panel.addEventListener('transitionend', settle);
      closeBtn.focus({ preventScroll: true });
      /* Remeasure the rows now they are on screen. Several of their columns
         size to a lazily-loaded image, so the widths measured at load are
         not the widths the reader is looking at — and the arrows and pill
         are both derived from those widths. */
      modalCarousels.forEach(c => c.remeasure());
    };

    const close = () => {
      modal.classList.remove('is-settled');  // the backstop cannot travel with the panel
      closeBtn.classList.remove('is-visible');
      /* Reset the scroll first, while the panel still covers it. Animating a
         panel that is taller than the viewport out by 100% sweeps its whole
         length past the screen; moving it one viewport plus a margin is the
         distance that actually matters. */
      scroller.scrollTop = 0;
      panel.style.transition = OUT;
      panel.style.transform = `translateY(${innerHeight + 40}px)`;
      overlay.classList.remove('is-open');
      setTimeout(() => {
        modal.classList.remove('is-open');
        document.body.style.overflow = '';
        closeBtn.hidden = true;
        if (lastTrigger) lastTrigger.focus({ preventScroll: true });
      }, 520);
    };

    /* The backstop covers the floor while there is scrolling left to do, and
       lifts once the reader reaches the end so the sheet's rounded bottom sits
       over the dimmed page. Throttled to a frame — this runs on every scroll
       event of a twelve-thousand-pixel scroller. */
    let endQueued = 0;
    scroller.addEventListener('scroll', () => {
      if (endQueued) return;
      endQueued = requestAnimationFrame(() => {
        endQueued = 0;
        const atEnd = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
        modal.classList.toggle('is-at-end', atEnd);
      });
    }, { passive: true });

    document.querySelectorAll('[data-case]').forEach(btn => {
      btn.addEventListener('click', () => open(btn));
    });
    closeBtn.addEventListener('click', close);
    scroller.addEventListener('click', e => { if (e.target === scroller) close(); });
    addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
  })();

