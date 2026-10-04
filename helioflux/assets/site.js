/* Helioflux Agrivoltaic Studio — shared site behaviour. One source for the brand, the nav and the footer,
   so every page stays identical. Pages declare <body data-page="…"> and include
   <header id="site-nav"></header> … <footer id="site-foot"></footer>.
   v7: smooth scroll (Lenis), one scroll loop for every scroll-linked effect, headline reveals, word scrub,
   figure plates with a measuring crosshair, a section ticker and contour fields behind page headers. */
(function(){
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const BRAND = { name: 'Helioflux', product: 'Agrivoltaic Studio', full: 'Helioflux Agrivoltaic Studio' };
  const PAGES = [
    ['product',    'product.html',    'Product'],
    ['features',   'features.html',   'Features'],
    ['archetypes', 'archetypes.html', 'Archetypes'],
    ['science',    'science.html',    'Science'],
    ['pricing',    'pricing.html',    'Pricing'],
    ['company',    'company.html',    'Company'],
  ];
  const page = document.body.dataset.page || '';
  const cur = (k) => k === page ? ' aria-current="page"' : '';
  const LOGO = (cls, label) => '<a class="' + cls + '" href="index.html" aria-label="' + label + '"><img class="brand__logo" src="assets/helioflux/helioflux-logo-dark.svg" alt="" width="136" height="16"><span class="brand__prod">' + BRAND.product + '</span></a>';

  /* ── nav ── */
  const nav = document.getElementById('site-nav');
  let prog = null;
  if (nav){
    nav.className = 'nav';
    nav.innerHTML =
      '<div class="nav__in">' +
        LOGO('brand', BRAND.full + ', home') +
        '<nav class="nav__links" aria-label="Primary">' + PAGES.map(([k, h, t]) => '<a href="' + h + '"' + cur(k) + '>' + t + '</a>').join('') + '</nav>' +
        '<div class="nav__cta"><span class="nav__state" aria-hidden="true">Private preview</span><a class="btn btn--primary" href="demo.html"' + cur('demo') + '>Request access</a>' +
        '<button class="nav__burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="drawer"><svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" stroke-width="1.6"/></svg></button></div>' +
      '</div><i class="nav__prog" aria-hidden="true"></i>';
    prog = nav.querySelector('.nav__prog');
    const drawer = document.createElement('nav');
    drawer.className = 'drawer'; drawer.id = 'drawer'; drawer.setAttribute('aria-label', 'Menu');
    drawer.innerHTML = '<a href="index.html"' + cur('home') + '>Home<span aria-hidden="true">→</span></a>' +
      PAGES.map(([k, h, t]) => '<a href="' + h + '"' + cur(k) + '>' + t + '<span aria-hidden="true">→</span></a>').join('') +
      '<a href="demo.html"' + cur('demo') + '>Request access<span aria-hidden="true">→</span></a>';
    nav.after(drawer);
    const burger = nav.querySelector('.nav__burger');
    burger.addEventListener('click', () => {
      const open = drawer.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }

  /* ── footer ── */
  const foot = document.getElementById('site-foot');
  if (foot){
    foot.className = 'foot';
    foot.innerHTML =
      '<div class="wrap"><div class="foot__grid">' +
        '<div>' + LOGO('brand', BRAND.full + ', home') +
        '<p style="margin-top:16px;max-width:36ch">Design software for food and power on one site. Light, crop, water and money, modelled before a single post goes in.</p>' +
        '<dl class="foot__spec"><div><dt>Engine</dt><dd>13 stages · 8,760 h</dd></div><div><dt>Light tier</dt><dd>T0 · live</dd></div><div><dt>Revision</dt><dd>2026.10</dd></div></dl></div>' +
        '<div><h4>Product</h4><ul><li><a href="product.html">Product tour</a></li><li><a href="features.html">All features</a></li><li><a href="archetypes.html">Structure archetypes</a></li><li><a href="pricing.html">Pricing</a></li></ul></div>' +
        '<div><h4>Proof</h4><ul><li><a href="science.html">Methods</a></li><li><a href="science.html#validation">Validation</a></li><li><a href="features.html#compliance">Compliance regimes</a></li><li><a href="company.html#roadmap">Roadmap</a></li></ul></div>' +
        '<div><h4>Company</h4><ul><li><a href="company.html">Why now</a></li><li><a href="company.html#markets">Launch markets</a></li><li><a href="demo.html">Request access</a></li></ul></div>' +
      '</div>' +
      '<div class="foot__base"><span>© 2026 ' + BRAND.name + ' · Indonesia · South Africa · Draft site: figures labelled illustrative are not project results</span>' +
      '<details class="sources"><summary>Sources</summary><ul>' +
        '<li>REN21 Global Status Report 2024 · TaiyangNews (Japan 2 GW) · Haygrove SA · Farmer\'s Weekly · RAP (Indonesia 100 GW solar, Jan 2026)</li>' +
        '<li>Mordor Intelligence · Grand View Research (paywalled estimates)</li>' +
        '<li>PVsyst release notes · HelioScope pricing page · PVcase product page · KU Leuven AgriPV · NLR ADAM</li>' +
        '<li>Internal light measurement, 2026-09-23: 2-D view factor vs 3-D ray-traced parcel</li>' +
      '</ul></details></div>' +
      '<div class="foot__mark" aria-hidden="true" data-par=".12">HELIOFLUX</div></div>';
  }

  /* ── smooth scroll ── */
  let lenis = null;
  if (!reduce && window.Lenis && fine){
    lenis = new window.Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .95, anchors: { offset: -76 } });
  }

  /* ── headlines: split into words that rise out of a mask ── */
  // headlines are no longer split into words: one calm fade for the whole line reads as more considered
  const SPLIT = '';
  (SPLIT ? document.querySelectorAll(SPLIT) : []).forEach(el => {
    if (el.closest('[data-nosplit]') || [...el.children].some(c => c.tagName !== 'BR')) return;
    let i = 0;
    el.innerHTML = el.innerHTML.split(/(<br\s*\/?>)/i).map(part => /^<br/i.test(part) ? part :
      part.split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w : '<span class="w"><span class="w__i" style="--i:' + (i++) + '">' + w + '</span></span>').join('')).join('');
    el.classList.add('sp');
    if (!el.classList.contains('rv')) el.classList.add('rv');
  });

  /* ── reveal on scroll ── */
  const reveal = (sel, cls, opts) => {
    const els = document.querySelectorAll(sel);
    if (!('IntersectionObserver' in window) || reduce){ els.forEach(el => el.classList.add(cls)); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ e.target.classList.add(cls); io.unobserve(e.target); } }), opts);
    els.forEach(el => io.observe(el));
  };
  reveal('.rv', 'is-in', { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  reveal('.crop', 'is-shown', { threshold: .08, rootMargin: '0px 0px -30px 0px' });
  reveal('[data-draw]', 'is-drawn', { threshold: .3 });

  /* ── count-up: <b data-count="36" data-dec="0">36</b> ── */
  const counters = document.querySelectorAll('[data-count]');
  if (!reduce && 'IntersectionObserver' in window){
    const io2 = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io2.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now(), D = 1400;
      const fmt = (v) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      (function f(t){ const k = Math.min(1, (t - t0) / D), v = to * (1 - Math.pow(1 - k, 4)); el.textContent = fmt(v); if (k < 1) requestAnimationFrame(f); else el.textContent = fmt(to); })(t0);
    }), { threshold: .6 });
    counters.forEach(c => io2.observe(c));
  }

  /* ── word scrub: <p data-scrub> lights up word by word as it crosses the viewport ── */
  const scrubs = [...document.querySelectorAll('[data-scrub]')].map(el => {
    el.innerHTML = el.innerHTML.split(/(\s+)/).map(w => /^\s+$/.test(w) || !w ? w : '<span class="sw">' + w + '</span>').join('');
    return { el, words: [...el.querySelectorAll('.sw')], last: -1 };
  });

  /* ── section ticker (wide screens): built from the § rails ── */
  const ticks = [...document.querySelectorAll('main .rail__idx')].filter(r => r.querySelector('b'));
  let ticker = null, tickItems = [];
  if (ticks.length >= 3){
    ticker = document.createElement('nav'); ticker.className = 'ticker'; ticker.setAttribute('aria-label', 'On this page');
    ticks.forEach((r, i) => {
      const sec = r.closest('section') || r; if (!sec.id) sec.id = 's-' + (i + 1);
      const num = r.textContent.replace(r.querySelector('b').textContent, '').trim();
      const a = document.createElement('a'); a.href = '#' + sec.id;
      a.innerHTML = '<span>' + num + '</span><b>' + r.querySelector('b').textContent + '</b>';
      ticker.appendChild(a); tickItems.push({ a, sec });
    });
    document.body.appendChild(ticker);
  }

  /* ── measuring crosshair on real screens ── */
  if (fine){
    document.querySelectorAll('.crop').forEach(c => {
      let xh = null;
      const cs = getComputedStyle(c), X = +cs.getPropertyValue('--x') || 0, Y = +cs.getPropertyValue('--y') || 0, Wd = +cs.getPropertyValue('--w') || 1, Hd = +cs.getPropertyValue('--h') || 1;
      c.addEventListener('pointerenter', () => {
        if (!xh){ xh = document.createElement('span'); xh.className = 'xh'; xh.setAttribute('aria-hidden', 'true'); xh.innerHTML = '<i class="xh__v"></i><i class="xh__h"></i><b class="xh__t"></b>'; c.appendChild(xh); }
        c.classList.add('is-measuring');
      });
      c.addEventListener('pointerleave', () => c.classList.remove('is-measuring'));
      c.addEventListener('pointermove', e => {
        if (!xh) return;
        const r = c.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
        xh.style.setProperty('--cx', (fx * 100).toFixed(2) + '%'); xh.style.setProperty('--cy', (fy * 100).toFixed(2) + '%');
        xh.classList.toggle('is-left', fx > .7); xh.classList.toggle('is-up', fy > .82);
        xh.lastChild.textContent = 'x ' + (X + fx * Wd).toFixed(3) + '  y ' + (Y + fy * Hd).toFixed(3);
      }, { passive: true });
    });
  }

  /* ── one loop for everything scroll-linked ── */
  const tilts = [...document.querySelectorAll('[data-tilt]')];
  const pars = [...document.querySelectorAll('[data-par]')];
  const draws = [...document.querySelectorAll('[data-draw-scroll]')];
  let dirty = true, lastY = -1;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  function onFrame(t){
    if (lenis) lenis.raf(t);
    const y = scrollY;
    if (y !== lastY || dirty){
      lastY = y; dirty = false;
      const vh = innerHeight, docH = root.scrollHeight - vh;
      if (nav) nav.classList.toggle('is-stuck', y > 8);
      if (prog) prog.style.transform = 'scaleX(' + (docH > 0 ? clamp01(y / docH) : 0).toFixed(4) + ')';
      for (const s of scrubs){
        const r = s.el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) continue;
        const k = clamp01((vh * .86 - r.top) / (r.height + vh * .32)), n = Math.round(k * s.words.length);
        if (n !== s.last){ s.words.forEach((w, i) => w.classList.toggle('is-lit', i < n)); s.last = n; }
      }
      if (!reduce){
        for (const el of tilts){
          const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) continue;
          const k = clamp01((vh - r.top) / (vh * .85));
          el.style.setProperty('--tilt', (1 - k).toFixed(4));
        }
        for (const el of pars){
          const r = el.getBoundingClientRect(); if (r.bottom < -300 || r.top > vh + 300) continue;
          const off = (r.top + r.height / 2 - vh / 2) * (+el.dataset.par || .1);
          el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
        }
      }
      for (const el of draws){
        const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) continue;
        el.style.setProperty('--draw', clamp01((vh * .85 - r.top) / (r.height * .9 + vh * .2)).toFixed(4));
      }
      if (ticker){
        let act = -1;
        tickItems.forEach((it, i) => { if (it.sec.getBoundingClientRect().top < vh * .45) act = i; });
        tickItems.forEach((it, i) => it.a.classList.toggle('is-on', i === act));
        const r0 = tickItems[0].sec.getBoundingClientRect().top, rN = tickItems[tickItems.length - 1].sec.getBoundingClientRect().bottom;
        ticker.classList.toggle('is-shown', r0 < vh * .6 && rN > vh * .3);
      }
    }
    requestAnimationFrame(onFrame);
  }
  addEventListener('resize', () => { dirty = true; }, { passive: true });
  requestAnimationFrame(onFrame);

  /* ── contour field behind page headers ── */
  const addScript = (src, done) => { const s = document.createElement('script'); s.src = src; if (done) s.onload = done; document.body.appendChild(s); };
  if (document.querySelector('.phero:not(.shero)')) addScript('assets/contours.js');
  /* ── live figure behind a stage header: the shared renderer, then the page's scene ── */
  const scenes = [...document.querySelectorAll('[data-scene]')].map(el => el.dataset.scene);
  if (scenes.length) addScript('assets/scene-core.js', () => scenes.forEach(n => addScript('assets/scene-' + n + '.js')));

  /* ── tabs ── */
  document.querySelectorAll('[data-tabs]').forEach(root => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const show = (t) => {
      tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; const p = document.getElementById(b.getAttribute('aria-controls')); if (p) p.hidden = !on; });
      dirty = true;
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(t));
      t.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d){ e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; show(n); n.focus(); n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
      });
    });
    show(tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]);
  });

  /* ── lightbox for real screenshots ── */
  const lb = document.createElement('div');
  lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Screenshot');
  lb.innerHTML = '<img alt=""><button type="button" aria-label="Close">×</button>';
  document.body.appendChild(lb);
  let lastFocus = null;
  const close = () => { lb.classList.remove('is-open'); lenis && lenis.start(); lastFocus && lastFocus.focus(); };
  lb.addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && lb.classList.contains('is-open')) close(); });
  document.addEventListener('click', e => {
    const img = e.target.closest('img.zoomable'); if (!img) return;
    lastFocus = img; lb.querySelector('img').src = img.currentSrc || img.src; lb.querySelector('img').alt = img.alt;
    lb.classList.add('is-open'); lenis && lenis.stop(); lb.querySelector('button').focus();
  });
  document.querySelectorAll('img.zoomable').forEach(img => {
    img.tabIndex = 0; img.setAttribute('role', 'button');
    img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); img.click(); } });
  });

  /* ── page transitions: a short fade between pages of this site ── */
  if (!reduce){
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href]'); if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
      const href = a.getAttribute('href'); if (!/^[a-z-]+\.html(#.*)?$/i.test(href) || href.split('#')[0] === location.pathname.split('/').pop()) return;
      e.preventDefault(); document.body.classList.add('is-leaving'); setTimeout(() => { location.href = href; }, 220);
    });
    addEventListener('pageshow', () => document.body.classList.remove('is-leaving'));
  }

  /* ── forms: this is a draft site — nothing is sent anywhere ── */
  document.querySelectorAll('form[data-draft]').forEach(f => f.addEventListener('submit', e => {
    e.preventDefault();
    const m = f.querySelector('.form-msg'); if (m){ m.classList.add('is-on'); m.focus(); }
  }));
})();
