/* LUMEN8 site runtime — smooth scroll, reveals, pinned scenes, hero field.
   Depends on GSAP + ScrollTrigger + Lenis loaded before this file. Every
   feature degrades gracefully when a dependency or motion is unavailable. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------- preloader ---------- */
  const loader = document.querySelector('.loader');
  let loaded = false;
  const finishLoad = () => {
    if (!loader || loaded) return;
    loaded = true;
    loader.classList.add('done');
    document.body.classList.remove('no-scroll');
    setTimeout(() => loader.remove(), 1000);
    heroIntro();
  };
  if (loader) {
    document.body.classList.add('no-scroll');
    window.addEventListener('load', () => setTimeout(finishLoad, 900));
    setTimeout(finishLoad, 3200); // never trap the reader
  } else heroIntro();

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (!reduce && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  // anchor links play nice with Lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      closeMobile();
      if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.4 });
      else el.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------- nav ---------- */
  const nav = document.querySelector('.nav');
  const progress = document.querySelector('.progress');
  const onScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    if (nav) nav.classList.toggle('scrolled', y > 24);
    if (progress) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (h > 0 ? y / h : 0) + ')';
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = document.querySelector('.burger');
  const mobile = document.querySelector('.mobile');
  function closeMobile() {
    if (!mobile) return;
    mobile.classList.remove('open');
    burger && burger.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }
  if (burger && mobile) {
    burger.addEventListener('click', () => {
      const open = !mobile.classList.contains('open');
      mobile.classList.toggle('open', open);
      burger.classList.toggle('open', open);
      document.body.classList.toggle('no-scroll', open);
    });
    mobile.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMobile));
  }

  /* ---------- module dropdown on touch ---------- */
  document.querySelectorAll('.links .has-menu').forEach((m) => {
    const a = m.querySelector(':scope > a');
    a.addEventListener('click', (e) => {
      if (window.matchMedia('(hover:hover)').matches || m.classList.contains('open')) return;
      e.preventDefault(); m.classList.add('open');
    });
    document.addEventListener('click', (e) => { if (!m.contains(e.target)) m.classList.remove('open'); });
  });

  /* ---------- custom cursor ---------- */
  const cur = document.querySelector('.cursor');
  if (cur && !reduce && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const dot = cur.querySelector('.dot'), ring = cur.querySelector('.ring');
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    const loop = () => {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    };
    loop();
    document.querySelectorAll('a,button,.card').forEach((el) => {
      el.addEventListener('mouseenter', () => cur.classList.add('is-link'));
      el.addEventListener('mouseleave', () => cur.classList.remove('is-link'));
    });
  }

  /* ---------- magnetic buttons ---------- */
  if (!reduce && window.matchMedia('(hover:hover)').matches) {
    document.querySelectorAll('.btn').forEach((b) => {
      b.addEventListener('mousemove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.22;
        b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      b.addEventListener('mouseleave', () => { b.style.transform = ''; });
    });
  }

  /* ---------- spotlight + tilt cards ---------- */
  document.querySelectorAll('.card').forEach((c) => {
    c.addEventListener('mousemove', (e) => {
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      c.style.setProperty('--mx', (px * 100) + '%');
      c.style.setProperty('--my', (py * 100) + '%');
      if (!reduce && c.classList.contains('tilt')) {
        c.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 6) + 'deg) rotateY(' + ((px - 0.5) * 8) + 'deg) translateY(-4px)';
      }
    });
    c.addEventListener('mouseleave', () => { c.style.transform = ''; });
  });

  /* ---------- reveals ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal],.stagger').forEach((el) => io.observe(el));

  /* ---------- statement line reveal ---------- */
  document.querySelectorAll('.statement h2').forEach((h) => {
    const lines = h.querySelectorAll('.l i');
    if (!lines.length) return;
    const obs = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      if (hasGsap && !reduce) gsap.to(lines, { y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 });
      else lines.forEach((l) => (l.style.transform = 'none'));
      obs.disconnect();
    }, { threshold: 0.4 });
    obs.observe(h);
  });

  /* ---------- hero intro ---------- */
  function heroIntro() {
    const words = document.querySelectorAll('.hero h1 .w i');
    if (!words.length) return;
    if (hasGsap && !reduce) {
      gsap.to(words, { y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
      gsap.from('.hero [data-hero]', { y: 24, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1, delay: 0.5 });
    } else words.forEach((w) => (w.style.transform = 'none'));
  }

  /* ---------- count-up ---------- */
  const fmt = (n, dec) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const dec = (el.dataset.dec | 0);
    const suffix = el.dataset.suffix || '';
    const show = (v) => { el.textContent = fmt(v, dec); if (suffix) { const sm = document.createElement('small'); sm.textContent = suffix; el.appendChild(sm); } };
    show(0);
    const obs = new IntersectionObserver((en) => {
      if (!en[0].isIntersecting) return;
      obs.disconnect();
      if (reduce) { show(target); return; }
      const t0 = performance.now(), dur = 1800;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        show(target * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    obs.observe(el);
  });

  /* ---------- marquee ---------- */
  document.querySelectorAll('.marquee .track').forEach((track) => {
    track.innerHTML += track.innerHTML;
    if (reduce) return;
    let x = 0, w = track.scrollWidth / 2;
    const speed = parseFloat(track.dataset.speed || '0.6');
    const tick = () => {
      x -= speed; if (-x >= w) x = 0;
      track.style.transform = 'translate3d(' + x + 'px,0,0)';
      requestAnimationFrame(tick);
    };
    tick();
  });

  /* ---------- parallax orbs ---------- */
  if (hasGsap && !reduce) {
    gsap.utils.toArray('.orb').forEach((o, i) => {
      gsap.to(o, { yPercent: (i + 1) * -18, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 1.2 } });
    });
    gsap.utils.toArray('[data-parallax]').forEach((el) => {
      const amt = parseFloat(el.dataset.parallax || '0.2');
      gsap.to(el, { yPercent: amt * -100, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // hero fade-out on scroll
    const hero = document.querySelector('.hero .wrap');
    if (hero) gsap.to(hero, { opacity: 0, y: -60, ease: 'none', scrollTrigger: { trigger: '.hero', start: '40% top', end: 'bottom top', scrub: true } });
  }

  /* ---------- pinned pipeline ---------- */
  document.querySelectorAll('.pipe').forEach((pipe) => {
    const steps = pipe.querySelectorAll('.pipe-step');
    const layers = pipe.querySelectorAll('.pipe-vis .layer');
    const rail = pipe.querySelectorAll('.pipe-rail i');
    const n = steps.length; if (!n) return;
    // each step gets one viewport of scroll
    const spacer = pipe.querySelector('.pipe-spacer');
    if (spacer) spacer.style.height = (n * 80) + 'svh';
    let current = -1;
    const set = (i) => {
      if (i === current) return; current = i;
      steps.forEach((s, k) => s.classList.toggle('on', k === i));
      layers.forEach((l, k) => l.classList.toggle('on', k <= i));
      rail.forEach((r, k) => r.classList.toggle('on', k <= i));
      const hc = pipe.querySelector('canvas[data-holo]');
      if (hc) { hc.dataset.step = i; if (window.Holo) window.Holo.setStep(hc, i); }
    };
    set(0);
    const update = () => {
      const r = pipe.getBoundingClientRect();
      const total = pipe.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      set(Math.min(n - 1, Math.floor(p * n)));
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  });

  /* ---------- horizontal scroller ---------- */
  document.querySelectorAll('.hs').forEach((hs) => {
    const track = hs.querySelector('.hs-track');
    if (!track) return;
    const setup = () => {
      const dist = track.scrollWidth - window.innerWidth + 40;
      hs.style.height = (window.innerHeight + dist) + 'px';
      return dist;
    };
    let dist = setup();
    window.addEventListener('resize', () => { dist = setup(); });
    const update = () => {
      const r = hs.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (hs.offsetHeight - window.innerHeight)));
      track.style.transform = 'translate3d(' + (-p * dist) + 'px,0,0)';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  });

  /* ---------- subnav active state ---------- */
  const sub = document.querySelector('.subnav');
  if (sub) {
    const links = [...sub.querySelectorAll('a')];
    const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    targets.forEach((t) => obs.observe(t));
  }

  /* ---------- hero field: particle archipelago + arcs ---------- */
  const canvas = document.querySelector('.hero canvas[data-field]');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let W, H, dpr, pts = [], arcs = [], t = 0, mx = 0.5, my = 0.5;
    const seed = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    // stylised island clusters (normalised coords) — an abstract archipelago, not a map
    const clusters = [
      [0.10, 0.55, 0.10, 0.16, 140], [0.28, 0.72, 0.16, 0.05, 90], [0.36, 0.46, 0.12, 0.14, 120],
      [0.52, 0.50, 0.08, 0.14, 110], [0.47, 0.74, 0.17, 0.04, 70], [0.63, 0.44, 0.06, 0.10, 60],
      [0.66, 0.66, 0.10, 0.05, 50], [0.80, 0.56, 0.14, 0.18, 160], [0.22, 0.30, 0.05, 0.05, 30]
    ];
    const build = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rnd = seed(42); pts = [];
      const scale = Math.min(1, W / 1400);
      const density = W < 700 ? 0.45 : 1;
      clusters.forEach(([cx, cy, rx, ry, n]) => {
        for (let i = 0; i < n * density; i++) {
          const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
          pts.push({
            x: cx + Math.cos(a) * r * rx, y: cy + Math.sin(a) * r * ry,
            s: (0.8 + rnd() * 1.8) * scale, hot: rnd() < 0.08, ph: rnd() * Math.PI * 2, sp: 0.4 + rnd() * 1.2
          });
        }
      });
      arcs = [];
      const hot = pts.filter((p) => p.hot);
      for (let i = 0; i < 14 && hot.length > 2; i++) {
        const a = hot[Math.floor(rnd() * hot.length)], b = hot[Math.floor(rnd() * hot.length)];
        if (a !== b) arcs.push({ a, b, ph: rnd() * 10, sp: 0.25 + rnd() * 0.35 });
      }
    };
    build();
    window.addEventListener('resize', build);
    window.addEventListener('mousemove', (e) => { mx = e.clientX / window.innerWidth; my = e.clientY / window.innerHeight; }, { passive: true });
    let visible = true;
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }).observe(canvas);
    const draw = () => {
      requestAnimationFrame(draw);
      if (!visible) return;
      t += reduce ? 0 : 0.008;
      ctx.clearRect(0, 0, W, H);
      const ox = (mx - 0.5) * 26, oy = (my - 0.5) * 18;
      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.028)'; ctx.lineWidth = 1;
      const g = 64;
      for (let x = (ox % g); x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = (oy % g); y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      // arcs
      arcs.forEach((arc) => {
        const ax = arc.a.x * W + ox, ay = arc.a.y * H + oy, bx = arc.b.x * W + ox, by = arc.b.y * H + oy;
        const mxp = (ax + bx) / 2, myp = (ay + by) / 2 - Math.hypot(bx - ax, by - ay) * 0.28;
        ctx.strokeStyle = 'rgba(34,211,238,0.16)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mxp, myp, bx, by); ctx.stroke();
        const u = ((t * arc.sp + arc.ph) % 1);
        const px = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mxp + u * u * bx;
        const py = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * myp + u * u * by;
        ctx.fillStyle = 'rgba(252,211,77,0.95)';
        ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
      });
      // points
      pts.forEach((p) => {
        const x = p.x * W + ox * (1 + p.s * 0.2), y = p.y * H + oy * (1 + p.s * 0.2);
        const tw = 0.55 + 0.45 * Math.sin(t * p.sp * 3 + p.ph);
        if (p.hot) {
          ctx.fillStyle = 'rgba(245,178,27,' + (0.5 + 0.5 * tw) + ')';
          ctx.shadowColor = 'rgba(245,178,27,0.9)'; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(x, y, p.s * 1.4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = 'rgba(103,232,249,' + (0.18 + 0.5 * tw) + ')';
          ctx.beginPath(); ctx.arc(x, y, p.s, 0, Math.PI * 2); ctx.fill();
        }
      });
      // scanning sweep
      const sx = ((t * 60) % (W + 400)) - 200;
      const grd = ctx.createLinearGradient(sx - 160, 0, sx + 160, 0);
      grd.addColorStop(0, 'rgba(34,211,238,0)'); grd.addColorStop(0.5, 'rgba(34,211,238,0.05)'); grd.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = grd; ctx.fillRect(sx - 160, 0, 320, H);
    };
    draw();
  }

  /* ---------- live ticker ---------- */
  const tick = document.querySelector('.ticker .line');
  if (tick) {
    const items = JSON.parse(tick.dataset.items || '[]');
    if (items.length) tick.innerHTML = (items.concat(items)).map((s) => '<span style="margin-right:44px">' + s + '</span>').join('');
    const win = document.createElement('div');
    win.style.cssText = 'flex:1;min-width:0;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 3%,#000 95%,transparent);mask:linear-gradient(90deg,transparent,#000 3%,#000 95%,transparent)';
    tick.parentNode.insertBefore(win, tick); win.appendChild(tick);
  }
})();

/* ── mailto fallback ───────────────────────────────────────────────────────
   The contact CTA is a real <a href="mailto:...">, which is correct markup —
   but a visitor with no default mail handler (anyone living in webmail, which
   is most people) clicks it and NOTHING happens. A silent no-op on the primary
   conversion path.

   We cannot detect whether the mail client opened, so we do not try. Instead
   the click always produces something visible: we copy the address and say so
   in a toast. The href is untouched and the event is never cancelled, so
   people who DO have a mail client get their compose window exactly as before.

   Feedback goes in a TOAST, not the button label. Both the CTA and the footer
   links already read "hello@lumen8.ai", so rewriting the label to show the
   address on failure is invisible — a working handler looks like a dead one.
   (Learned the hard way while testing this.) */
(() => {
  const EMAIL = 'hello@lumen8.ai';
  const links = document.querySelectorAll('a[href^="mailto:"]');
  if (!links.length) return;

  let toast, hideTimer;
  function say(msg, good) {
    if (!toast) {
      toast = document.createElement('div');
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translate(-50%,14px);z-index:9999;' +
        'padding:11px 18px;border-radius:999px;font:500 13.5px/1 Inter,system-ui,sans-serif;' +
        'letter-spacing:.01em;pointer-events:none;opacity:0;' +
        'transition:opacity .25s ease,transform .25s cubic-bezier(.16,1,.3,1);' +
        'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.background = good ? 'rgba(34,211,238,.14)' : 'rgba(255,255,255,.10)';
    toast.style.color = good ? '#a5f3fc' : '#eaf0f8';
    toast.style.boxShadow = 'inset 0 0 0 1px ' + (good ? 'rgba(34,211,238,.45)' : 'rgba(255,255,255,.18)');
    // Force a reflow and set the visible state synchronously rather than
    // deferring to requestAnimationFrame. rAF is throttled when the page is
    // unfocused and stops entirely in a background tab — if the reveal lived
    // in a rAF callback the toast could sit at opacity 0 forever, which is the
    // dead-click bug wearing a hat. Reading offsetWidth flushes the initial
    // style so the CSS transition still animates.
    void toast.offsetWidth;
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%,0)';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%,14px)';
    }, 2600);
  }

  async function copy(text) {
    // Async clipboard first, but NEVER awaited unbounded: writeText() does not
    // reject when the document lacks focus, it returns a promise that never
    // settles. An unbounded await would hang and show no feedback at all —
    // the very dead-click this block exists to remove.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        const won = await Promise.race([
          navigator.clipboard.writeText(text).then(() => true, () => false),
          new Promise((r) => setTimeout(() => r(null), 600)),
        ]);
        if (won === true) return true;
        if (won === false) return legacyCopy(text);
        // null => timed out (unfocused document); fall through to the sync path
      }
    } catch { /* fall through */ }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }

  for (const a of links) {
    a.addEventListener('click', async () => {
      const ok = await copy(EMAIL);
      say(ok ? EMAIL + ' copied to clipboard' : 'Email us at ' + EMAIL, ok);
    });
  }
})();
