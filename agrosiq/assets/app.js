/* AgrosIQ v2 — shell + motion. Renders nav, drawer and footer from <body data-page="…">, swaps <i class="ic" data-ic="name">
   for inline icons, runs smooth scroll (Lenis) and one scroll loop for every scroll-linked effect, and loads aerial.js when the
   page has a [data-aerial] canvas. Pages include <header id="nav"></header> … <footer id="foot"></footer>. */
(function(){
  'use strict';
  const root = document.documentElement; root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, fine = matchMedia('(pointer: fine)').matches;
  const page = document.body.dataset.page || '';
  const PAGES = [['platform', 'platform.html', 'Platform'], ['solutions', 'solutions.html', 'Solutions'], ['technology', 'technology.html', 'Technology'],
                 ['pricing', 'pricing.html', 'Pricing'], ['company', 'company.html', 'Company']];
  const cur = (k) => k === page ? ' aria-current="page"' : '';
  const ARROW = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const LOGO = '<a class="nav__logo" href="index.html" aria-label="AgrosIQ home"><img src="assets/brand/agrosiq-logo-dark.svg" alt="AgrosIQ" width="116" height="24"></a>';

  /* ── icons (24 × 24, 1.6 stroke) ── */
  const P = {
    satellite: 'M13 7l4-4 4 4-4 4M7 13l-4 4 4 4 4-4M9.5 9.5l5 5M8 11l5-5 5 5-5 5zM16 20a4 4 0 0 0 4-4',
    leaf: 'M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19l7-7',
    alert: 'M12 3l9.5 17h-19zM12 10v4M12 17.5v.01',
    cloud: 'M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z',
    radar: 'M12 12l6-6M19.1 6.9A9 9 0 1 0 21 12M16.2 9.4A5 5 0 1 0 17 12M12 12v.01',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
    pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    chat: 'M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
    calendar: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    drop: 'M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    file: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7.5M18 15c2.5.5 4 2.5 4 6',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    phone: 'M7 2h10v20H7zM11 18h2',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12v.01',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    scan: 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M3 12h18',
    wheat: 'M12 21V8M12 8c-2-1-3-3-3-5 2 1 3 3 3 5zM12 8c2-1 3-3 3-5-2 1-3 3-3 5zM12 13c-2.5-1-4-3-4-5.5 2.5 1 4 3 4 5.5zM12 13c2.5-1 4-3 4-5.5-2.5 1-4 3-4 5.5zM12 18c-2.5-1-4-3-4-5.5 2.5 1 4 3 4 5.5zM12 18c2.5-1 4-3 4-5.5-2.5 1-4 3-4 5.5z',
    coins: 'M9 10c3.9 0 7-1.3 7-3s-3.1-3-7-3-7 1.3-7 3 3.1 3 7 3zM2 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M8 18.5c.3 0 .7.1 1 .1 3.9 0 7-1.3 7-3M16 11c3.4.2 6 1.4 6 3v5c0 1.7-3.1 3-7 3-2 0-3.8-.3-5-.9',
    arrow: 'M4 12h16M14 6l6 6-6 6', plus: 'M12 5v14M5 12h14', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    home: 'M3 11l9-7 9 7v10H3zM9 21v-6h6v6', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.2-1.5.4-2-3-1-1 1.8h-2L10 3.7l-3 1 .4 2L6.2 8.3 4 8l-1 3 2 1v.1L3 13l1 3 2.2-.2 1.2 1.5-.4 2 3 1 1-1.8h2l1 1.8 3-1-.4-2 1.2-1.5 2.2.2 1-3z',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    sprout: 'M12 21v-8M12 13c0-4-3-6-7-6 0 4 3 6 7 6zM12 11c0-4 3-7 7-7 0 4-3 7-7 7z', leaf: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15zM5 19l8-8',
    waves: 'M2 8c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 20c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2',
    storm: 'M7 16a5 5 0 1 1 1.5-9.8A6 6 0 0 1 19.5 9 4 4 0 0 1 18 16M13 13l-2 4h3l-2 4', zap: 'M13 2L4 14h7l-1 8 9-12h-7z',
  };
  const icon = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (P[n] || P.sparkle) + '"/></svg>';
  const fillIcons = (scope) => (scope || document).querySelectorAll('.ic[data-ic]:not(.done)').forEach(i => { i.innerHTML = icon(i.dataset.ic); i.classList.add('done'); });
  window.AGQ = { icon, fillIcons, ARROW };

  /* ── nav + drawer ── */
  const nav = document.getElementById('nav');
  if (nav){
    nav.className = 'nav';
    const MEGA = {
      platform: { items: [['satellite', 'Field Watch', 'Every field checked on every pass', 'platform.html#watch'], ['layers', 'Field Record', 'Ten years of every field, ranked', 'platform.html#record'],
                          ['sparkle', 'Field Analyst', 'Ask your farm anything', 'platform.html#analyst'], ['phone', 'Scout', 'Walk straight to the spot', 'platform.html#scout'],
                          ['grid', 'Zones', 'Strong and weak ground, mapped', 'platform.html'], ['file', 'Reports', 'Share a field in one click', 'platform.html']],
                  feat: ['map', 'Live map', 'Your whole farm on one screen', 'platform.html'] },
      solutions: { items: [['wheat', 'Growers', 'Protect yield, walk less', 'solutions.html#growers'], ['users', 'Agronomists', 'Every client field at once', 'solutions.html#agronomists'],
                           ['chart', 'Farm managers', 'Thousands of hectares, one screen', 'solutions.html#managers'], ['globe', 'Agribusiness', 'Supply and sourcing, field by field', 'solutions.html#enterprise'],
                           ['coins', 'Lenders and insurers', 'Independent field history', 'solutions.html#enterprise'], ['shield', 'Security', 'Your data stays yours', 'technology.html#security']],
                   feat: ['season', 'A season with AgrosIQ', 'From sowing to harvest', 'solutions.html#season'] },
    };
    const megaHTML = (k) => { const m = MEGA[k]; if (!m) return '';
      return '<div class="mega" role="group"><div class="mega__list">' + m.items.map(([ic, t, d, h]) => '<a href="' + h + '"><span class="ic-tile"><i class="ic" data-ic="' + ic + '"></i></span><span><b>' + t + '</b><small>' + d + '</small></span></a>').join('') + '</div>' +
        '<a class="mega__feat" href="' + m.feat[3] + '"><div class="aerial" data-aerial="' + m.feat[0] + '" data-seed="' + (k === 'platform' ? 3 : 5) + '" data-res=".7"></div><span><div class="t-mono">Featured</div><b>' + m.feat[1] + '</b><small>' + m.feat[2] + '</small></span></a></div>'; };
    nav.innerHTML = '<div class="nav__in">' + LOGO +
      '<nav class="nav__links" aria-label="Primary">' + PAGES.map(([k, h, t]) => MEGA[k] ? '<span class="has-mega"><a href="' + h + '"' + cur(k) + '>' + t + '</a>' + megaHTML(k) + '</span>' : '<a href="' + h + '"' + cur(k) + '>' + t + '</a>').join('') + '</nav>' +
      '<div class="nav__cta"><a class="btn btn--ghost btn--sm nav__signin" href="start.html#signin">Sign in</a>' +
      '<a class="btn btn--primary btn--sm" href="start.html">Start free ' + ARROW + '</a>' +
      '<button class="nav__burger" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button></div></div>';
    const drawer = document.createElement('nav'); drawer.className = 'drawer'; drawer.setAttribute('aria-label', 'Menu');
    drawer.innerHTML = '<a href="index.html"' + cur('home') + '>Home<span>→</span></a>' + PAGES.map(([k, h, t]) => '<a href="' + h + '"' + cur(k) + '>' + t + '<span>→</span></a>').join('') +
      '<a class="btn btn--primary" href="start.html">Start free</a>';
    nav.after(drawer);
    const burger = nav.querySelector('.nav__burger');
    burger.addEventListener('click', () => { const o = drawer.classList.toggle('is-open'); nav.classList.toggle('is-open', o); burger.setAttribute('aria-expanded', String(o)); document.body.style.overflow = o ? 'hidden' : ''; });
    const bar = document.createElement('i'); bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  }

  /* ── footer ── */
  const foot = document.getElementById('foot');
  if (foot){
    foot.className = 'foot';
    foot.innerHTML = '<div class="wrap"><div class="foot__grid"><div>' + LOGO +
      '<p class="muted" style="margin:20px 0 0;max-width:34ch;font-size:15px">Crop intelligence from orbit. See every field, catch every problem early, and grow more with less guesswork.</p>' +
      '<form class="foot__news" onsubmit="event.preventDefault();this.querySelector(\'button\').textContent=\'Subscribed\'"><input type="email" required placeholder="Your email" aria-label="Email for product news"><button class="btn btn--glass btn--sm" style="height:44px">Get updates</button></form></div>' +
      '<div><h4>Product</h4><ul><li><a href="platform.html">Platform</a></li><li><a href="platform.html#watch">Field Watch</a></li><li><a href="platform.html#record">Field Record</a></li><li><a href="platform.html#analyst">Field Analyst</a></li><li><a href="pricing.html">Pricing</a></li></ul></div>' +
      '<div><h4>Solutions</h4><ul><li><a href="solutions.html#growers">Growers</a></li><li><a href="solutions.html#agronomists">Agronomists</a></li><li><a href="solutions.html#managers">Farm managers</a></li><li><a href="solutions.html#enterprise">Agribusiness</a></li></ul></div>' +
      '<div><h4>Company</h4><ul><li><a href="company.html">About</a></li><li><a href="company.html#careers">Careers</a></li><li><a href="company.html#contact">Contact</a></li><li><a href="technology.html">Technology</a></li></ul></div>' +
      '<div><h4>Resources</h4><ul><li><a href="technology.html#security">Security</a></li><li><a href="pricing.html#faq">FAQ</a></li><li><a href="start.html">Book a demo</a></li><li><a href="start.html#signin">Sign in</a></li></ul></div>' +
      '</div><div class="foot__show" aria-hidden="true"><div class="aerial" data-aerial="season" data-seed="5" data-res=".75"></div><div class="foot__mask">Grow with certainty</div></div>' +
      '<div class="foot__base"><span>© 2026 AgrosIQ. All rights reserved.</span><nav><a href="#">Privacy</a><a href="#">Terms</a><a href="technology.html#security">Security</a></nav></div></div>';
  }
  fillIcons();

  /* ── first-visit intro (pages with data-intro): holds until the 3-D farm is drawing, never longer than 4.5 s ── */
  let seen = false; try { seen = sessionStorage.getItem('agq-intro') === '1'; } catch (e) {}
  if (document.body.hasAttribute('data-intro') && !seen && !reduce){
    const it = document.createElement('div'); it.className = 'intro'; it.setAttribute('aria-hidden', 'true');
    it.innerHTML = '<div class="intro__in"><div class="intro__mark"><span class="intro__ring"></span><img src="assets/brand/agrosiq-mark-dark.svg" alt=""></div>' +
      '<div class="intro__txt"><span id="introMsg">Acquiring orbit</span><b id="introPct">0</b></div><div class="intro__bar"><i id="introBar"></i></div></div>';
    document.body.appendChild(it);
    const msgs = ['Acquiring orbit', 'Reading the last pass', 'Loading ten seasons', 'Ready'];
    const t0 = performance.now(); let done = false;
    const end = () => { if (done) return; done = true; try { sessionStorage.setItem('agq-intro', '1'); } catch (e) {} it.querySelector('#introPct').textContent = '100'; it.querySelector('#introBar').style.setProperty('--k', 1);
      it.querySelector('#introMsg').textContent = 'Ready'; setTimeout(() => { it.classList.add('is-done'); setTimeout(() => it.remove(), 1100); }, 260); };
    const step = () => { if (done) return; const k = Math.min(.92, (performance.now() - t0) / 3200);
      it.querySelector('#introPct').textContent = Math.round(k * 100); it.querySelector('#introBar').style.setProperty('--k', k.toFixed(3));
      it.querySelector('#introMsg').textContent = msgs[Math.min(2, Math.floor(k * 3.3))]; requestAnimationFrame(step); };
    requestAnimationFrame(step);
    document.addEventListener('aerial:on', () => setTimeout(end, 350), { once: true });
    setTimeout(end, 4500);
  }

  /* ── magnetic buttons ── */
  if (fine && !reduce) document.querySelectorAll('.btn--lg, .nav__cta .btn--primary').forEach(b => {
    b.setAttribute('data-mag', '');
    b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .28).toFixed(1) + 'px)'; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  /* ── place an element at a screen point (from AerialGL.project), hide it when off screen ── */
  window.AGQ.place = (el, xy, k) => {
    if (!xy){ el.style.opacity = 0; return; }
    el.style.transform = 'translate3d(' + xy[0].toFixed(1) + 'px,' + xy[1].toFixed(1) + 'px,0)'; el.style.opacity = k == null ? 1 : (+k).toFixed(3);
  };

  /* ── smooth scroll ── */
  let lenis = null;
  if (!reduce && window.Lenis && fine) lenis = new window.Lenis({ lerp: .09, smoothWheel: true, anchors: { offset: -90 } });
  window.AGQ.lenis = lenis;

  /* ── headline split ── */
  document.querySelectorAll('[data-split]').forEach(el => {
    let i = 0;
    const walk = (n) => {
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 3){
          const frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(t => {
            if (!t) return;
            if (/^\s+$/.test(t)){ frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--i', i++); wi.textContent = t;
            w.appendChild(wi); frag.appendChild(w);
          });
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && c.tagName !== 'BR') walk(c);
      });
    };
    walk(el);
  });
  document.querySelectorAll('[data-scrub]').forEach(el => {
    el.innerHTML = el.textContent.trim().split(/\s+/).map(w => '<span class="sw">' + w + '</span>').join(' ');
  });

  /* ── reveals ── */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  document.querySelectorAll('[data-r],[data-split]').forEach(el => io.observe(el));

  /* ── counters ── */
  const fmt = (v, dec) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), t0 = performance.now(), D = 1600;
    const step = (now) => { const k = Math.min(1, (now - t0) / D), v = to * (1 - Math.pow(1 - k, 4)); el.textContent = fmt(v, dec); if (k < 1) requestAnimationFrame(step); };
    if (reduce) el.textContent = fmt(to, dec); else requestAnimationFrame(step);
  }), { threshold: .4 });
  document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

  /* ── pointer spotlight on cards ── */
  if (fine) document.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('.card,[data-spot],.plan');
    if (!c) return; const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ── one scroll loop ── */
  const tilts = [...document.querySelectorAll('[data-tilt]')], pars = [...document.querySelectorAll('[data-par]')];
  const stories = [...document.querySelectorAll('.story')], hs = [...document.querySelectorAll('.hscroll')], scrubs = [...document.querySelectorAll('[data-scrub]')];
  const bar = document.querySelector('.progress');
  const listeners = []; window.AGQ.onScroll = (fn) => listeners.push(fn);
  const clamp = (v) => Math.max(0, Math.min(1, v));
  function tick(){
    const vh = innerHeight, y = scrollY;
    if (nav) nav.classList.toggle('is-stuck', y > 24);
    if (bar) bar.style.setProperty('--sp', clamp(y / (document.documentElement.scrollHeight - vh)).toFixed(4));
    for (const el of tilts){ const r = el.getBoundingClientRect(); el.style.setProperty('--k', reduce ? 1 : clamp((vh - r.top) / (vh * .75)).toFixed(4)); }
    for (const el of pars){ const r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) continue; el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * -parseFloat(el.dataset.par)).toFixed(1) + 'px,0)'; }
    for (const el of stories){
      const r = el.getBoundingClientRect(), p = clamp(-r.top / (r.height - vh)); el.style.setProperty('--p', p.toFixed(4)); el._p = p;
      const steps = el.querySelectorAll('.story__step'), n = steps.length;
      if (n){ const k = Math.min(n - 1, Math.floor(p * n * .9999)); steps.forEach((s, i) => s.classList.toggle('on', i === k)); el.dataset.step = k;
        el.querySelectorAll('[data-dot]').forEach((d, i) => d.classList.toggle('on', i === k)); }
    }
    for (const el of hs){
      const tr = el.querySelector('.hscroll__track'); if (!tr || innerWidth <= 760) continue;
      const over = tr.scrollWidth - innerWidth; el.style.height = (vh + over) + 'px';
      const r = el.getBoundingClientRect(), p = clamp(-r.top / over); tr.style.transform = 'translate3d(' + (-p * over).toFixed(1) + 'px,0,0)';
    }
    for (const el of scrubs){
      const r = el.getBoundingClientRect(), p = clamp((vh * .85 - r.top) / (r.height + vh * .35)), ws = el.children, n = ws.length;
      for (let i = 0; i < n; i++) ws[i].classList.toggle('lit', i < p * n * 1.05);
    }
    for (const fn of listeners) fn(y, vh);
  }
  function raf(t){ if (lenis) lenis.raf(t); tick(); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  /* ── aerial canvases ── */
  if (document.querySelector('[data-aerial]')){
    const add = (src, then) => { const s = document.createElement('script'); s.src = src; if (then) s.onload = then; document.body.appendChild(s); };
    add('assets/aerial-shader.js', () => add('assets/aerial.js'));
  }
})();
