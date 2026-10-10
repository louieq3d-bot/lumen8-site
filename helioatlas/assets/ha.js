/* HelioAtlas · site kit v12. One file, no dependencies. Load with <script src="assets/ha.js" defer></script>.
   Renders the shared nav + footer into <header data-ha-nav> / <footer data-ha-foot>, and wires:
   reveals [data-rv], line drawings .draw, count-ups [data-count], tabs [data-tabs], hotspots [data-hs],
   scroll-spy .toc, chapters (.chapter) and the live sun readout. Public API on window.HA:
     HA.onScroll(fn(y, vh))          run inside the shared rAF after each scroll/resize
     HA.onChapter(el, fn(p, step))   progress 0..1 of a .chapter section and its integer step
     HA.sun(lat, lon, date)          → { el, az } in degrees (NOAA solar position)
     HA.MARK                         the small sun mark as an SVG string (brand gradient)
   v12 adds: HA.chart(plot, draw) + HA.svg / HA.scale / HA.ticks (one chart grammar, drawn at real pixel size),
   HA.morph(el, value, {dec, pre, suf}) (numbers change in place), HA.send(kind, data) (the one form hook),
   .film playback, [data-zoom] lightbox, [data-hs-zoom] zooming hotspots, .reader paging. */
(function(){
  'use strict';
  const d = document, W = window;
  const reduced = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ARROW = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 7h11M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  /* the mark: D3 "Sunset", the setting sun with two cuts (the small mark, for 16-48 px; brand pack assets/brand/) */
  const MARK = '<svg viewBox="12 12 96 96" aria-hidden="true" focusable="false"><defs><linearGradient id="ha-mark-g" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="106">' +
    '<stop offset="0" stop-color="#FFD25A"/><stop offset=".5" stop-color="#FF7A1A"/><stop offset="1" stop-color="#E2291F"/></linearGradient></defs>' +
    '<path d="M15.46 71.5A46 46 0 1 1 104.54 71.5ZM17.06 76.5L102.94 76.5A46 46 0 0 1 96.5 88L23.5 88A46 46 0 0 1 17.06 76.5ZM88.64 96A46 46 0 0 1 31.36 96Z" fill="url(#ha-mark-g)"/></svg>';
  /* the wordmark is outlined paths in one cached file: "heli" + sun + "atlas" */
  const LOGO = '<a class="logo" href="index.html" aria-label="HelioAtlas home"><img src="assets/brand/helioatlas-logo-dark.svg" alt="" width="144" height="19"></a>';
  const PAGES = [['product.html', 'Product'], ['solutions.html', 'Solutions'], ['science.html', 'Science'], ['pricing.html', 'Pricing'], ['company.html', 'Company']];
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  /* ── nav + footer ─────────────────────────────────────────────────────────────────────── */
  function renderShell(){
    const nav = d.querySelector('[data-ha-nav]');
    if (nav && !nav.dataset.done){
      nav.dataset.done = '1'; nav.classList.add('nav');
      const links = PAGES.map(([h, t]) => '<a href="' + h + '"' + (h === here ? ' aria-current="page"' : '') + '>' + t + '</a>').join('');
      nav.innerHTML = '<div class="wrap nav__in">' + LOGO + '<nav class="nav__links" aria-label="Main">' + links + '</nav>' +
        '<div class="nav__end"><a class="lnk" href="start.html#demo">Book a demo</a><a class="btn btn--p btn--sm" href="start.html">Request access ' + ARROW + '</a>' +
        '<button class="nav__burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="ha-sheet"><span></span><span></span></button></div></div>';
      const sheet = d.createElement('div'); sheet.className = 'sheet'; sheet.id = 'ha-sheet';
      sheet.innerHTML = PAGES.map(([h, t]) => '<a href="' + h + '"' + (h === here ? ' aria-current="page"' : '') + '>' + t + '</a>').join('') +
        '<div class="row"><a class="btn btn--p" href="start.html">Request access ' + ARROW + '</a><a class="btn btn--g" href="start.html#demo">Book a demo</a></div>';
      nav.after(sheet);
      const burger = nav.querySelector('.nav__burger');
      burger.addEventListener('click', () => {
        const open = !nav.classList.contains('is-open');
        nav.classList.toggle('is-open', open); burger.setAttribute('aria-expanded', String(open));
        d.documentElement.style.overflow = open ? 'hidden' : '';
      });
      sheet.addEventListener('click', e => { if (e.target.closest('a')){ nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); d.documentElement.style.overflow = ''; } });
    }
    const foot = d.querySelector('[data-ha-foot]');
    if (foot && !foot.dataset.done){
      foot.dataset.done = '1'; foot.classList.add('foot');
      const col = (t, items) => '<div><h6>' + t + '</h6><ul>' + items.map(([h, x]) => '<li><a href="' + h + '">' + x + '</a></li>').join('') + '</ul></div>';
      foot.innerHTML = '<div class="wrap"><div class="foot__top"><div class="foot__brand">' + LOGO +
        '<p>Solar prospecting and design. Find the roof, design it, prove the yield, price it, close it.</p></div>' +
        col('Product', [['product.html#prospect', 'Prospect'], ['product.html#design', 'Design'], ['product.html#workbench', 'Engineering workbench'], ['product.html#energy', 'Energy and P90'], ['product.html#savings', 'Savings'], ['product.html#proposal', 'Proposal']]) +
        col('Solutions', [['solutions.html#residential', 'Residential installers'], ['solutions.html#commercial', 'Commercial and industrial'], ['solutions.html#farms', 'Farms and rural'], ['solutions.html#storage', 'Solar and battery'], ['solutions.html#markets', 'Country presets']]) +
        col('Science', [['science.html#method', 'Method'], ['science.html#p90', 'P50 and P90'], ['science.html#sunpath', 'Sun path'], ['science.html#losses', 'Losses'], ['science.html#electrical', 'Electrical checks']]) +
        col('Company', [['company.html', 'About'], ['pricing.html', 'Pricing'], ['start.html#demo', 'Book a demo'], ['company.html#contact', 'Contact'], ['privacy.html', 'Privacy']]) +
        '</div><div class="foot__bot"><span>© ' + new Date().getFullYear() + ' HelioAtlas. Example projects and figures are labelled as examples.</span>' +
        '<span class="foot__sun" id="ha-sun" aria-live="off"></span></div></div>';
    }
  }

  /* ── NOAA solar position (good to ~0.1° for these dates) ─────────────────────────────── */
  function sun(lat, lon, date){
    const rad = Math.PI / 180, t = date || new Date();
    const jd = t.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
    const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 0.0000004 * n) * rad;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
    const ha = ((gmst * 15 + lon) * rad - ra);
    const la = lat * rad;
    const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
    let az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha)) / rad;
    az = (az + 360) % 360;
    return { el: el / rad, az, dec: dec / rad };
  }
  function tickSun(){
    const el = d.getElementById('ha-sun'); if (!el) return;
    const s = sun(-26.138, 28.019);
    el.innerHTML = 'Sun now over the Johannesburg example house · elevation <b>' + s.el.toFixed(1) + '°</b> · azimuth <b>' + s.az.toFixed(1) + '°</b>' + (s.el < 0 ? ' · below the horizon' : '');
  }

  /* ── reveals, drawings, count-ups ────────────────────────────────────────────────────── */
  const fmt = (v, dec) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  function countUp(el){
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    if (!Number.isFinite(to)) return;
    if (reduced){ el.textContent = pre + fmt(to, dec) + suf; return; }
    const t0 = performance.now(), dur = +(el.dataset.dur || 1400);
    const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4); el.textContent = pre + fmt(to * e, dec) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function wireReveal(root){
    (root || d).querySelectorAll('.draw').forEach(svg => svg.querySelectorAll('path,line,polyline,circle.ln').forEach(p => {
      try { const L = Math.ceil(p.getTotalLength ? p.getTotalLength() : 1200); p.style.setProperty('--len', L); } catch (e){} }));
    const targets = (root || d).querySelectorAll('[data-rv]:not(.is-in), .draw:not(.is-in), [data-count]:not(.is-counted)');
    if (!('IntersectionObserver' in W)){ targets.forEach(t => { t.classList.add('is-in'); if (t.dataset.count) countUp(t); }); return; }
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (!e.isIntersecting) return;
      const t = e.target; io.unobserve(t);
      t.classList.add('is-in');
      if (t.dataset.count != null && !t.classList.contains('is-counted')){ t.classList.add('is-counted'); countUp(t); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach(t => io.observe(t));
  }

  /* ── tabs: [data-tabs] holds a [role=tablist] whose buttons have aria-controls ─────────── */
  function wireTabs(){
    d.querySelectorAll('[data-tabs]').forEach(box => {
      const list = box.querySelector('[role="tablist"]'); if (!list || list.dataset.done) return; list.dataset.done = '1';
      const btns = [...list.querySelectorAll('[role="tab"]')];
      const ink = list.classList.contains('seg') ? (list.querySelector('.seg__ink') || list.appendChild(Object.assign(d.createElement('i'), { className: 'seg__ink' }))) : null;
      const auto = +(box.dataset.auto || 0); let timer = 0, paused = false, visible = false;
      const place = (b) => { if (!ink || !b) return; ink.style.width = b.offsetWidth + 'px'; ink.style.transform = 'translateX(' + (b.offsetLeft) + 'px)'; };
      const select = (b, user) => {
        btns.forEach(x => { const on = x === b; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1;
          const p = d.getElementById(x.getAttribute('aria-controls')); if (p){ p.hidden = !on; if (on){ p.classList.remove('is-in'); void p.offsetWidth; p.classList.add('is-in'); wireReveal(p); } } });
        place(b); box.dispatchEvent(new CustomEvent('ha:tab', { detail: { index: btns.indexOf(b), id: b.getAttribute('aria-controls') } }));
        if (auto){ clearTimeout(timer); if (user){ box.classList.remove('is-auto'); paused = true; } else arm(); }
      };
      const arm = () => { if (!auto || paused || !visible) return; box.classList.add('is-auto'); box.style.setProperty('--dur', auto + 'ms');
        clearTimeout(timer); timer = setTimeout(() => { const i = btns.findIndex(x => x.getAttribute('aria-selected') === 'true'); select(btns[(i + 1) % btns.length], false); }, auto); };
      btns.forEach(b => b.addEventListener('click', () => select(b, true)));
      list.addEventListener('keydown', e => {
        const i = btns.indexOf(d.activeElement); if (i < 0) return;
        const k = e.key, horiz = list.getAttribute('aria-orientation') !== 'vertical';
        const nx = (k === (horiz ? 'ArrowRight' : 'ArrowDown')) ? 1 : (k === (horiz ? 'ArrowLeft' : 'ArrowUp')) ? -1 : 0;
        if (nx){ e.preventDefault(); const b = btns[(i + nx + btns.length) % btns.length]; b.focus(); select(b, true); }
      });
      if (auto && 'IntersectionObserver' in W && !reduced){
        new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible) arm(); else clearTimeout(timer); }), { threshold: 0.35 }).observe(box);
      }
      const first = btns.find(b => b.getAttribute('aria-selected') === 'true') || btns[0];
      select(first, false); W.addEventListener('resize', () => place(btns.find(b => b.getAttribute('aria-selected') === 'true')));
      if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => place(btns.find(b => b.getAttribute('aria-selected') === 'true')));
    });
  }

  /* ── hotspots: .hs[data-n] inside [data-hs] light the matching .note[data-n] ─────────────── */
  function wireHotspots(){
    d.querySelectorAll('[data-hs]').forEach(g => {
      if (g.dataset.hsDone) return; g.dataset.hsDone = '1';
      const notes = g.querySelector('.notes');
      const zs = g.hasAttribute('data-hs-zoom') && !reduced ? (+g.dataset.hsZoom || 1.8) : 0;
      const spots = [...g.querySelectorAll('.hs')].map(h => ({ h, x: parseFloat(h.style.getPropertyValue('--x')), y: parseFloat(h.style.getPropertyValue('--y')) }));
      const zoom = (n) => {   /* v12: magnify towards the active hotspot; that hotspot stays put, the others move with the image */
        if (!zs) return;
        const a = n != null && spots.find(o => o.h.dataset.n === n);
        if (!a || !Number.isFinite(a.x)){ g.classList.remove('is-zoom'); spots.forEach(o => { o.h.style.left = ''; o.h.style.top = ''; o.h.style.opacity = ''; }); return; }
        g.style.setProperty('--zx', a.x + '%'); g.style.setProperty('--zy', a.y + '%'); g.style.setProperty('--zs', zs); g.classList.add('is-zoom');
        spots.forEach(o => { const x = a.x + (o.x - a.x) * zs, y = a.y + (o.y - a.y) * zs; o.h.style.left = x + '%'; o.h.style.top = y + '%'; o.h.style.opacity = (x < 2 || x > 98 || y < 2 || y > 98) ? '0' : ''; });
      };
      const on = (n) => { g.querySelectorAll('.hs, .note').forEach(x => x.classList.toggle('is-on', n != null && x.dataset.n === n)); if (notes) notes.classList.toggle('has-on', n != null); zoom(n); };
      g.querySelectorAll('.hs, .note').forEach(x => {
        x.addEventListener('mouseenter', () => on(x.dataset.n)); x.addEventListener('mouseleave', () => on(null));
        x.addEventListener('focus', () => on(x.dataset.n)); x.addEventListener('blur', () => on(null));
      });
    });
  }

  /* ── v12: one chart grammar ─────────────────────────────────────────────────────────────
     HA.chart(plot, draw) calls draw({ svg, w, h }) now and on every resize with the plot's real CSS-pixel size, so ticks
     and labels render at the size ha.css gives .ch-t / .ch-l (never scaled down by a viewBox). Style marks with the .ch-*
     classes only. Hover: add/remove .is-hover on the .chart and position .ch-cur / .ch-dot yourself. */
  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent){
    const e = d.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function scale(d0, d1, r0, r1){ const f = (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0); f.invert = (p) => d0 + (p - r0) / (r1 - r0) * (d1 - d0); return f; }
  function ticks(min, max, n){
    const raw = (max - min) / Math.max(1, n || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function chart(plot, draw){
    const svg = plot.querySelector('svg') || svgEl('svg', { 'aria-hidden': 'true', focusable: 'false' }, plot);
    let lw = 0, lh = 0;
    const run = (force) => {
      const w = Math.round(plot.clientWidth), h = Math.round(plot.clientHeight);
      if (!w || !h || (!force && w === lw && h === lh)) return;
      lw = w; lh = h; svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      draw({ svg, w, h });
    };
    if ('ResizeObserver' in W) new ResizeObserver(() => run()).observe(plot); else W.addEventListener('resize', () => run());
    run();
    return { svg, redraw: () => run(true) };
  }

  /* numbers that change in place: HA.morph(el, 14004, { dec: 0, pre: '', suf: ' kWh' }) */
  function morph(el, to, o){
    o = o || {}; const dec = o.dec || 0, pre = o.pre || '', suf = o.suf || '';
    const from = el.dataset.v != null ? +el.dataset.v : (parseFloat((el.textContent || '').replace(/[^0-9.\-]/g, '')) || 0);
    el.dataset.v = String(to);
    if (reduced || from === to){ el.textContent = pre + fmt(to, dec) + suf; return; }
    const t0 = performance.now(), dur = o.dur || 700;
    const step = (now) => { if (el.dataset.v !== String(to)) return;
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + fmt(from + (to - from) * e, dec) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ── v12: film — muted loops that play in view and pause out of view; the viewer's pause is final ─────────── */
  const PLAY = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg>';
  const PAUSE = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 1h2v8H2zM6 1h2v8H6z" fill="currentColor"/></svg>';
  function wireFilms(){
    d.querySelectorAll('.film').forEach(f => {
      if (f.dataset.done) return; f.dataset.done = '1';
      const v = f.querySelector('video'); if (!v) return;
      v.muted = true; v.playsInline = true; v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      if (f.dataset.loop !== 'no') v.loop = true;
      const ctl = f.querySelector('.film__ctl') || f.appendChild(Object.assign(d.createElement('button'), { className: 'film__ctl', type: 'button' }));
      const prog = f.querySelector('.film__prog') || f.appendChild(Object.assign(d.createElement('div'), { className: 'film__prog', innerHTML: '<i></i>' }));
      const chaps = f.id ? [...d.querySelectorAll('.chaps[data-film="' + f.id + '"] [data-t]')] : [];
      let held = false;
      const paint = () => { ctl.innerHTML = v.paused ? PLAY + 'Play' : PAUSE + 'Pause'; ctl.setAttribute('aria-label', v.paused ? 'Play the film' : 'Pause the film'); };
      ctl.addEventListener('click', () => { if (v.paused){ held = false; v.play().catch(() => {}); } else { held = true; v.pause(); } });
      v.addEventListener('play', paint); v.addEventListener('pause', paint); paint();
      v.addEventListener('timeupdate', () => {
        if (v.duration) prog.style.setProperty('--t', (v.currentTime / v.duration).toFixed(4));
        if (chaps.length){ let cur = chaps[0]; for (const c of chaps) if (v.currentTime >= +c.dataset.t - 0.05) cur = c; chaps.forEach(c => c.classList.toggle('is-on', c === cur)); }
      });
      chaps.forEach(c => c.addEventListener('click', () => { v.currentTime = +c.dataset.t; held = false; v.play().catch(() => {}); }));
      if (!reduced && 'IntersectionObserver' in W){
        new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio >= 0.4){ if (!held) v.play().catch(() => {}); } else if (!v.paused) v.pause(); }), { threshold: [0, 0.4] }).observe(f);
      }
    });
  }

  /* ── v12: lightbox for [data-zoom] (a capture or its <img>; data-zoom="url" overrides the source) ─────────── */
  function bestSrc(img){
    const ss = img.getAttribute('srcset');
    if (ss){ let best = null, bw = 0; ss.split(',').forEach(c => { const [u, w] = c.trim().split(/\s+/); const n = parseFloat(w) || 0; if (n >= bw){ bw = n; best = u; } }); if (best) return best; }
    return img.currentSrc || img.src;
  }
  function wireZoom(){
    d.querySelectorAll('[data-zoom]').forEach(z => { if (!z.matches('a,button,[tabindex]')){ z.tabIndex = 0; z.setAttribute('role', 'button'); z.setAttribute('aria-label', 'Open full size'); } });
    if (wireZoom.done) return; wireZoom.done = true;
    let dlg = null, back = null;
    const open = (z) => {
      const img = z.tagName === 'IMG' ? z : z.querySelector('img'); if (!img) return;
      if (!dlg){
        dlg = d.createElement('dialog'); dlg.className = 'lb';
        dlg.innerHTML = '<img alt=""><button class="lb__x" type="button">Close</button><p class="lb__cap"></p>';
        d.body.appendChild(dlg);
        dlg.addEventListener('click', ev => { if (ev.target === dlg || ev.target.closest('.lb__x') || ev.target.tagName === 'IMG') dlg.close(); });
        dlg.addEventListener('close', () => { if (back) back.focus(); });
      }
      back = z;
      const im = dlg.querySelector('img'); im.src = z.dataset.zoom || bestSrc(img); im.alt = img.alt || '';
      dlg.querySelector('.lb__cap').textContent = img.alt || '';
      dlg.showModal();
    };
    d.addEventListener('click', e => { const z = e.target.closest('[data-zoom]'); if (z && !e.target.closest('.hs, a, button:not([data-zoom])')) open(z); });
    d.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-zoom][role="button"]')){ e.preventDefault(); open(e.target); } });
  }

  /* ── v12: reader paging (.reader > .reader__track + .reader__nav [data-dir]) ─────────── */
  function wireReaders(){
    d.querySelectorAll('.reader').forEach(r => {
      if (r.dataset.done) return; r.dataset.done = '1';
      const t = r.querySelector('.reader__track'); if (!t) return;
      r.querySelectorAll('.reader__nav [data-dir]').forEach(b => b.addEventListener('click', () => {
        const pg = t.querySelector('.reader__page'); const step = pg ? pg.getBoundingClientRect().width + 24 : t.clientWidth * 0.8;
        t.scrollBy({ left: +b.dataset.dir * step, behavior: reduced ? 'auto' : 'smooth' });
      }));
    });
  }

  /* ── v12: the one form hook. HA.send(kind, data) → Promise<{ sent }>.
     With <html data-form-endpoint="https://…"> it POSTs JSON there and resolves { sent: true } on a 2xx.
     Without one (the case today) it keeps the entry in this browser only and resolves { sent: false }:
     pages must then say plainly that nothing was sent. */
  async function send(kind, data){
    const ep = d.documentElement.dataset.formEndpoint || '';
    const rec = Object.assign({ kind, at: new Date().toISOString(), page: here }, data || {});
    if (ep){
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return { sent: true };
    }
    try { const k = 'ha.forms', a = JSON.parse(localStorage.getItem(k) || '[]'); a.push(rec); localStorage.setItem(k, JSON.stringify(a.slice(-20))); } catch (e){}
    return { sent: false };
  }

  /* ── one rAF scroll loop: nav state, chapters, scroll-spy, listeners ────────────────────── */
  const scrollFns = [], chapters = [];
  let lastY = 0, ticking = false, vh = W.innerHeight;
  function frame(){
    ticking = false;
    const y = W.scrollY;
    const nav = d.querySelector('.nav');
    if (nav){
      nav.classList.toggle('is-solid', y > 8);
      const inHero = d.body.dataset.heroNav === 'show' ? false : (y < vh * 0.6);
      nav.classList.toggle('is-hidden', !nav.classList.contains('is-open') && y > lastY + 4 && y > vh && !inHero);
      if (y < lastY - 4) nav.classList.remove('is-hidden');
    }
    for (const c of chapters){
      const r = c.el.getBoundingClientRect(), span = Math.max(1, c.el.offsetHeight - vh);
      const p = Math.min(1, Math.max(0, -r.top / span));
      const step = Math.min(c.steps - 1, Math.floor(p * c.steps * 0.99999));
      if (p !== c.p){ c.p = p; c.el.style.setProperty('--p', p.toFixed(4)); }
      if (step !== c.step){ c.step = step; c.el.dataset.step = String(step); }
      for (const fn of c.fns) fn(p, step);
    }
    for (const fn of scrollFns) fn(y, vh);
    lastY = y;
  }
  const req = () => { if (!ticking){ ticking = true; requestAnimationFrame(frame); } };
  function wireChapters(){
    d.querySelectorAll('.chapter').forEach(el => {
      if (chapters.some(c => c.el === el)) return;
      const steps = +(el.dataset.steps || getComputedStyle(el).getPropertyValue('--steps') || 6);
      chapters.push({ el, steps, fns: [], p: -1, step: -1 });
    });
  }
  function wireToc(){
    const links = [...d.querySelectorAll('.toc a[href^="#"]')]; if (!links.length) return;
    const secs = links.map(a => d.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    scrollFns.push(() => {
      let cur = null; for (const s of secs){ if (s.getBoundingClientRect().top < vh * 0.35) cur = s; }
      links.forEach(a => a.classList.toggle('is-on', !!cur && a.getAttribute('href') === '#' + cur.id));
    });
  }

  const HA = W.HA = W.HA || {};
  Object.assign(HA, {
    MARK, ARROW, sun, fmt, reduced, svg: svgEl, scale, ticks, chart, morph, send,
    onScroll: (fn) => { scrollFns.push(fn); req(); },
    onChapter: (el, fn) => { wireChapters(); const c = chapters.find(c => c.el === el); if (c){ c.fns.push(fn); req(); } },
    reveal: wireReveal,
    wire: () => { wireReveal(); wireTabs(); wireHotspots(); wireFilms(); wireZoom(); wireReaders(); },
  });

  function init(){
    renderShell(); wireChapters(); wireReveal(); wireTabs(); wireHotspots(); wireToc(); wireFilms(); wireZoom(); wireReaders();
    tickSun(); setInterval(tickSun, 60000);
    W.addEventListener('scroll', req, { passive: true });
    W.addEventListener('resize', () => { vh = W.innerHeight; req(); }, { passive: true });
    req();
    d.documentElement.classList.add('ha-ready');
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
