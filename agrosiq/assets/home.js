/* AgrosIQ home page: the orbit-to-pixel hero story, the exploded layer stack, the season scrubber, the live map and the small
   SVG visuals. Every 3-D scene is an AerialGL instance driven by hand (data-drive="manual"); labels are projected from the
   same field layout the shader draws, so a name always sits on its own field. */
(function(){
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const small = () => innerWidth < 900;
  const scrollToY = (y) => AGQ.lenis ? AGQ.lenis.scrollTo(y, { duration: 1.6 }) : scrollTo({ top: y, behavior: 'smooth' });
  const when = (el, fn) => { const go = () => { const A = window.AerialGL && AerialGL.get(el); if (A) fn(A); else setTimeout(go, 60); }; go(); };

  /* ── marquee, pixel grids, ridges, bars ── */
  const crops = ['Wheat', 'Maize', 'Soybean', 'Canola', 'Cotton', 'Barley', 'Sugarcane', 'Sunflower', 'Sorghum', 'Rice', 'Pulses', 'Potatoes', 'Vineyards', 'Orchards', 'Pasture'];
  const cm = crops.map(c => '<span><i class="ic" data-ic="wheat"></i>' + c + '</span>').join(''); $('crops').innerHTML = cm + cm; AGQ.fillIcons($('crops'));
  const veg = (v) => { v = Math.max(0, Math.min(1, v)); const s = [[0, [59, 43, 33]], [.35, [92, 77, 43]], [.55, [13, 92, 53]], [.78, [28, 148, 80]], [1, [179, 224, 71]]];
    for (let i = 1; i < s.length; i++) if (v <= s[i][0]){ const t = (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0]); return 'rgb(' + s[i - 1][1].map((x, k) => Math.round(x + (s[i][1][k] - x) * t)).join(',') + ')'; } };
  (function zones(el, W, H, seed, warn){
    let h = '', k = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      const v = .62 + .22 * Math.sin(x * .45 + seed) * Math.cos(y * .5 - seed * .7) + .12 * Math.sin((x + y) * .9 + seed * 2) - (warn && Math.hypot(x - warn[0], y - warn[1]) < 2.3 ? .4 : 0);
      h += '<i' + (warn && x === warn[0] && y === warn[1] ? ' class="w"' : '') + ' style="--c:' + veg(v) + ';--k:' + (k++) + '"></i>';
    }
    el.innerHTML = h; el.style.gridTemplateRows = 'repeat(' + H + ',1fr)';
  })($('zones'), 18, 11, 1.3, [12, 4]);
  (function(){ let rh = '';
    for (let y = 0; y < 10; y++){
      const pk = .55 + .4 * Math.abs(Math.sin(y * 2.7 + 1)), mid = 280 + Math.sin(y * 1.9) * 40, base = 60 + y * 19, cur = y === 9;
      let d = 'M0 ' + base; for (let x = 0; x <= 600; x += 10) d += ' L' + x + ' ' + (base - pk * Math.exp(-Math.pow((x - mid) / 110, 2)) * 60).toFixed(1);
      rh += '<path d="' + d + '" stroke="' + (cur ? '#A9D646' : 'rgba(255,255,255,' + (.12 + y * .03) + ')') + '"' + (cur ? ' stroke-width="2.4"' : '') + '/>';
    }
    $('ridges').innerHTML = rh; $('ridges').setAttribute('viewBox', '0 0 600 250'); })();
  $('bars').innerHTML = [62, 74, 55, 81, 69, 48, 77, 85, 71, 90].map((b, i) => '<i style="--h:' + b + ';--k:' + i + '"' + (i === 9 ? ' class="cur"' : '') + '></i>').join('');

  /* ── audiences: each card is its own small live farm ── */
  const AUD = [['Growers', 'growers', 'Spot problems early, walk less, and squeeze more out of every paddock you farm.', 'truth', 2],
    ['Agronomists', 'agronomists', 'See every client farm in one list and turn up with the evidence before they call.', 'health', 4],
    ['Farm managers', 'managers', 'Run thousands of hectares from one screen, with everyone looking at the same evidence.', 'map', 6],
    ['Agribusiness', 'enterprise', 'Sourcing and grower programs, backed by field-level evidence.', 'orbit', 8],
    ['Lenders and insurers', 'enterprise', 'Independent, field-by-field history, with the maps and dates behind it.', 'season', 9]];
  $('aud').innerHTML = AUD.map((a, i) => '<article class="card aud"><div class="aud__art"><div class="aerial" data-aerial="' + a[3] + '" data-seed="' + a[4] + '" data-res=".7"></div><div class="veil veil--b"></div></div>' +
    '<div class="card__body"><span class="t-mono">0' + (i + 1) + '</span><h3 class="t-h3" style="margin-top:12px">' + a[0] + '</h3><p>' + a[2] + '</p><a href="solutions.html#' + a[1] + '">Learn more ' + AGQ.ARROW + '</a></div></article>').join('');

  /* ── analyst chat loop ── */
  const CONV = [
    ['Where is Ridge Paddock behind?', 'Ridge is <b>24% below its normal</b> for early June, concentrated in a 1.1 ha patch in the NE corner. The rest of the field is on track. AgrosIQ does not say why; the patch is the place to look.', ['NE corner · 1.1 ha', 'Pass · 2 Jun', 'vs. 10-yr normal']],
    ['Which block is greenest at this point, year after year?', '<b>Top Pivot.</b> At this point in the season it was among the three greenest on this farm in 8 of the last 10 seasons, and it is ahead of its normal again this year.', ['10 seasons', 'Greenness at this date']],
    ['Was this dry spell worse than 2019?', 'Not yet. The last 45 days are <b>drier than 7 of 10 years</b>, but 2019 was drier still at this point. Creek Flat is the field to watch.', ['45-day window', '10-yr weather']],
  ];
  const log = $('chatlog'), inp = $('chatin'); let ci = 0;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  async function play(){
    while (true){
      const [q, a, ev] = CONV[ci++ % CONV.length];
      if (log.children.length > 3) log.innerHTML = '';
      for (let i = 0; i <= q.length; i++){ inp.innerHTML = q.slice(0, i) + '<span class="caret"></span>'; await wait(reduce ? 0 : 34); }
      await wait(400); inp.textContent = 'Pick a suggested question…';
      log.insertAdjacentHTML('beforeend', '<div class="bub bub--q">' + q + '</div><div class="bub bub--a" id="typing"><span class="dots"><i></i><i></i><i></i></span></div>');
      await wait(1300);
      const t = $('typing'); t.removeAttribute('id'); t.innerHTML = a + '<div class="chat__ev">' + ev.map(e => '<span class="chip chip--ok">' + e + '</span>').join('') + '</div>';
      await wait(5200);
    }
  }
  new IntersectionObserver((es, o) => { if (es[0].isIntersecting){ play(); o.disconnect(); } }, { threshold: .3 }).observe(log);

  /* ── how-it-works line ── */
  const flow = $('flow'), flowLine = $('flowLine');
  AGQ.onScroll((y, vh) => { const r = flow.getBoundingClientRect(); flowLine.style.setProperty('--k', sm(vh * .85, vh * .35, r.top).toFixed(3)); });

  /* ════════ the world: named fields shared by every scene on this page ════════ */
  function world(G){
    const AL = G.ALERT, key = (F) => F.bx + ',' + F.by + ',' + F.code;
    const nearest = (x0, y0, test, seed) => { let best = null, bd = 1e12;
      for (let x = -1800; x <= 1800; x += 60) for (let y = -1800; y <= 1800; y += 60){ const F = G.field(x0 + x, y0 + y, seed); if (test(F)){ const d = x * x + y * y; if (d < bd){ bd = d; best = F; } } }
      return best; };
    const alertF = G.field(AL[0], AL[1], 3);
    const creekF = G.field(AL[0] + 40, -700, 3);
    const pivotF = nearest(AL[0], AL[1], F => F.pivot === 1, 3);
    const OVR = {}; OVR[key(alertF)] = { name: 'Ridge Paddock', vs: -24, warn: true, crop: 'Wheat', stage: 'Peak growth' };
    if (creekF && creekF.kind < 6) OVR[key(creekF)] = { name: 'Creek Flat', vs: -15, warn: true };
    if (pivotF) OVR[key(pivotF)] = { name: 'Top Pivot', vs: 6 };
    const NAMES = {}, used = new Set(Object.values(OVR).map(o => o.name));
    const info = (F, seed, season) => { const d = G.describe(F, seed || 3, season == null ? .45 : season); if (!d) return d; const o = OVR[key(F)];
      d.vsNormal = Math.max(0, d.vsNormal);
      if (!o){ const k = key(F); if (!NAMES[k]){ let n = d.name, i = 0; const base = n; while (used.has(n)) n = base + ' ' + ['North', 'South', 'East', 'West', 'Hill', 'Flat'][i++ % 6] + (i > 6 ? ' ' + i : ''); used.add(n); NAMES[k] = n; } d.name = NAMES[k]; }
      if (o){ d.name = o.name; d.vsNormal = o.vs; if (o.crop){ d.crop = o.crop; d.stage = o.stage; d.kind = 0; } d.warn = !!o.warn; if (o.warn) d.health = Math.min(d.health || .6, .62); } return d; };
    return { AL, key, nearest, info, alertF, creekF, pivotF };
  }

  AGQ.world = world;

  /* ════════ HERO STORY ════════ */
  const story = $('hero'), host = $('heroGL'), walk = $('walk'), cue = $('cue');
  document.querySelectorAll('#hero [data-go]').forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault(); const k = +b.dataset.go; scrollToY(story.offsetTop + (story.offsetHeight - innerHeight) * (k + .5) / 6);
  }));
  // camera keys over story progress: [p, target dx, dy, azimuth, elevation, distance]
  const KEYS = [[0, 0, 0, -1.95, .30, 70000], [.07, 0, 0, -1.93, .31, 62000], [.2, 300, 300, -1.85, .62, 5200], [.31, 200, 150, -1.8, .72, 4300],
    [.38, 120, 60, -1.78, .86, 2300], [.47, 60, 30, -1.75, .95, 1800], [.56, 0, 0, -1.72, 1.12, 380], [.64, 0, 0, -1.7, 1.12, 360],
    [.72, 60, 20, -1.68, 1.0, 1500], [.8, 60, 20, -1.62, 1.02, 1400], [.9, 160, 160, -1.6, .8, 3000], [1, 160, 160, -1.58, .78, 3100]];
  function camAt(p){
    let i = 1; while (i < KEYS.length - 1 && p > KEYS[i][0]) i++;
    const a = KEYS[i - 1], b = KEYS[i], t = sm(a[0], b[0], p);
    return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t), Math.exp(lerp(Math.log(a[5]), Math.log(b[5]), t))];
  }
  const sdir = [.96, -.28].map((v, _, a) => v / Math.hypot(a[0], a[1])), perp = [-sdir[1], sdir[0]];
  const passT0 = 2 * 3600 + 14 * 60 + 9, tStart = performance.now();
  const fmtT = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s) % 60].map(v => String(v).padStart(2, '0')).join(':');

  when(host, (A) => {
    const W = world(AerialGL), AL = W.AL;
    // the fields worth naming: crops near the alert, nearest first
    const seen = new Map();
    for (let x = -1500; x <= 1500; x += 100) for (let y = -1200; y <= 1200; y += 100){ const F = AerialGL.field(AL[0] + x, AL[1] + y, 3); const k = W.key(F); if (!seen.has(k)) seen.set(k, F); }
    let fields = [...seen.values()].map(F => W.info(F, 3, .45)).filter(d => d && d.kind < 6 && d.pivot !== 2 && d.ha > 8);
    fields.sort((a, b) => Math.hypot(a.centre[0] - AL[0], a.centre[1] - AL[1]) - Math.hypot(b.centre[0] - AL[0], b.centre[1] - AL[1]));
    fields = fields.slice(0, small() ? 5 : 10);
    const tags = $('tags');
    tags.innerHTML = fields.map(d => '<div class="geo__tag' + (d.warn ? ' warn' : '') + '"><span><i></i>' + d.name + ' <em>' + (d.warn ? '<b>−' + Math.abs(d.vsNormal) + '%</b> vs normal' : d.vsNormal >= 2 ? '<b>+' + d.vsNormal + '%</b> vs normal' : 'on track') + '</em></span></div>').join('');
    const tagEls = [...tags.children];
    const beam = $('beam'), poly = beam.querySelector('polygon'), pl = beam.querySelector('polyline'), sat = $('sat');
    const route = $('route'), rpath = route.querySelector('path'), rdot = route.querySelector('circle'), you = $('youTag');
    const RS = [AL[0] - 150, AL[1] - 140];
    const side = { chart: $('sideChart'), zones: $('sideZones'), out: $('sideOutlook') };
    const hNow = $('hNow'), hLen = hNow.getTotalLength(); hNow.style.strokeDasharray = hLen; hNow.style.strokeDashoffset = hLen;
    const hud = { alt: $('hudAlt'), u: $('hudAltU'), st: $('hudState'), pass: $('hudPass'), cloud: $('hudCloud'), walk: $('hudWalk'), bar: $('hudBar') };
    let sp = 0, C = null, lastHud = 0;

    A.onframe = (t, dt) => {
      const p = story._p || 0; sp += (p - sp) * Math.min(1, dt * 5);
      const target = camAt(sp); C = C ? C.map((v, k) => v + (target[k] - v) * Math.min(1, dt * 4)) : target;
      Object.assign(A.cam, AerialGL.lookCam(AL[0] + C[0], AL[1] + C[1], 0, C[2] + (reduce ? 0 : t * .005), C[3], C[4], 36));
      // bank gently through the dive and the swing round to the zones, like a camera on a long lens
      A.cam.roll = reduce ? 0 : .055 * Math.sin(Math.PI * sm(.08, .34, sp)) - .035 * Math.sin(Math.PI * sm(.36, .56, sp)) + .03 * Math.sin(Math.PI * sm(.66, .86, sp));
      const P = A.p, mob = small();
      P.shift = mob ? [0, .14] : [.17, 0];
      P.stars = 1 - sm(.04, .14, sp); P.sat = 1.12; P.season = .45; P.expo = 1; P.pix = 1;
      P.cloud = .62 * (1 - sm(.19, .3, sp));
      const scanK = sm(.2, .31, sp); P.scanOn = scanK > 0 && scanK < 1 ? 1 : 0; P.scan = -3600 + scanK * 7600;
      P.health = sm(.2, .23, sp) * (1 - sm(.69, .72, sp)) + sm(.86, .9, sp) * .9;
      P.patch = sm(.38, .47, sp);
      P.focusK = sm(.4, .48, sp) * (1 - sm(.66, .7, sp)); P.focusR = 320 - 140 * sm(.5, .58, sp); P.focus = AL;
      P.alert = sm(.52, .58, sp) * (1 - sm(.68, .72, sp)) + sm(.88, .93, sp) * .6;
      P.zones = sm(.69, .73, sp) * (1 - sm(.82, .86, sp));
      P.outline = .5 * sm(.86, .92, sp);
      P.alertPos = AL;

      // field labels: appear as the scan line passes over them
      const showA = sm(.21, .24, sp) * (1 - sm(.5, .53, sp)), showB = sm(.88, .92, sp), dimB = sm(.37, .41, sp);
      // keep labels off each other and off the headline and cards
      const obst = [];
      const stepEl = story.querySelector('.story__step.on'); if (stepEl) obst.push(stepEl.getBoundingClientRect());
      ['hud', 'sideChart', 'sideZones', 'sideOutlook'].forEach(id => { const e = $(id); if (e && e.offsetParent && (id === 'hud' || e.classList.contains('on'))) obst.push(e.getBoundingClientRect()); });
      const hit = (r) => obst.some(o => r.l < o.right + 8 && r.r > o.left - 8 && r.t < o.bottom + 8 && r.b > o.top - 8);
      const order = fields.map((d, i) => i).sort((a, b) => (fields[b].warn ? 1 : 0) - (fields[a].warn ? 1 : 0));
      const boxes = [];
      order.forEach((i) => { const d = fields[i];
        const el = tagEls[i], q = A.project(d.centre[0], d.centre[1], 0);
        const sc = d.centre[0] * sdir[0] + d.centre[1] * sdir[1];
        const passed = P.scanOn ? (sc < P.scan ? 1 : 0) : 1;
        let k = Math.max(showA * passed * (d.warn ? 1 : 1 - .7 * dimB), showB);
        if (q && (q[0] < 20 || q[0] > A.w - 40 || q[1] < 80 || q[1] > A.h - 20)) k = 0;
        if (q && k > .01){
          const w = el._w || (el._w = el.firstElementChild.offsetWidth || 160), r = { l: q[0] + 10, r: q[0] + 14 + w, t: q[1] - 40, b: q[1] - 6 };
          if (hit(r) || boxes.some(o => r.l < o.r + 6 && r.r > o.l - 6 && r.t < o.b + 4 && r.b > o.t - 4)) k = 0; else boxes.push(r);
        }
        AGQ.place(el, q, k);
      });
      // the satellite and its swath while the pass is running
      const bk = P.scanOn ? Math.min(sm(0, .08, scanK), 1 - sm(.92, 1, scanK)) : 0;
      if (bk > 0){
        const c0 = [sdir[0] * P.scan, sdir[1] * P.scan];
        const a = A.project(c0[0] - perp[0] * 2600, c0[1] - perp[1] * 2600, 0), b = A.project(c0[0] + perp[0] * 2600, c0[1] + perp[1] * 2600, 0);
        if (a && b){
          const sx = Math.max(60, Math.min(A.w - 60, (a[0] + b[0]) / 2)), sy = 92;
          poly.setAttribute('points', sx + ',' + sy + ' ' + a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1));
          pl.setAttribute('points', a[0].toFixed(1) + ',' + a[1].toFixed(1) + ' ' + sx + ',' + sy + ' ' + b[0].toFixed(1) + ',' + b[1].toFixed(1));
          sat.style.transform = 'translate(' + (sx - 32) + 'px,' + (sy - 34) + 'px)';
        }
      }
      beam.setAttribute('opacity', bk.toFixed(3)); sat.style.opacity = bk.toFixed(3);
      // the walk: card on the amber pixel, dashed route from the gate
      const wk = sm(.56, .6, sp) * (1 - sm(.66, .69, sp));
      const qa = A.project(AL[0] + 5, AL[1] + 5, 0);
      if (mob) walk.style.transform = 'translate3d(16px,86px,0)';
      else if (qa){ walk.style.transform = 'translate3d(' + qa[0].toFixed(1) + 'px,' + qa[1].toFixed(1) + 'px,0)'; walk.classList.toggle('flip', qa[0] > A.w - 330); }
      walk.style.opacity = qa ? wk.toFixed(3) : 0;
      const qs = A.project(RS[0], RS[1], 0), qm = A.project(RS[0] + 10, AL[1] - 40, 0);
      if (qs && qa && qm && wk > 0){
        rpath.setAttribute('d', 'M' + qs[0].toFixed(1) + ' ' + qs[1].toFixed(1) + ' Q' + qm[0].toFixed(1) + ' ' + qm[1].toFixed(1) + ' ' + qa[0].toFixed(1) + ' ' + qa[1].toFixed(1));
        rpath.style.strokeDashoffset = (-t * 18).toFixed(1); rdot.setAttribute('cx', qs[0].toFixed(1)); rdot.setAttribute('cy', qs[1].toFixed(1));
      }
      route.setAttribute('opacity', wk.toFixed(3)); AGQ.place(you, qs, wk);
      // side cards
      const kc = sm(.37, .47, sp);
      side.chart.classList.toggle('on', sp > .36 && sp < .52); side.zones.classList.toggle('on', sp > .71 && sp < .84); side.out.classList.toggle('on', sp > .88);
      hNow.style.strokeDashoffset = (hLen * (1 - kc)).toFixed(1); $('hDot').setAttribute('opacity', sm(.9, 1, kc).toFixed(2));
      $('chartPct').textContent = '−' + Math.round(24 * kc) + '%';
      $('heroVeil').style.opacity = (.62 + .25 * sm(.1, .2, sp)).toFixed(3);
      cue.style.opacity = sp < .03 ? 1 : 0;
      // telemetry, ten times a second
      if (t - lastHud > .1){
        lastHud = t;
        const alt = AerialGL.altOf(A.cam);
        if (alt > 1000){ hud.alt.textContent = (alt / 1000).toFixed(alt > 10000 ? 1 : 2); hud.u.textContent = 'km'; } else { hud.alt.textContent = Math.round(alt); hud.u.textContent = 'm'; }
        hud.st.textContent = sp < .17 ? 'Orbit' : sp < .33 ? 'Reading pass' : sp < .5 ? 'Comparing' : sp < .67 ? 'Walk here' : sp < .84 ? 'Zoning' : 'All clear';
        hud.pass.textContent = fmtT(Math.max(0, passT0 - (performance.now() - tStart) / 1000));
        hud.cloud.textContent = Math.round(64 * P.cloud / .62) + '%';
        const nW = sp > .45 ? 2 : sp > .4 ? 1 : 0; hud.walk.textContent = nW; hud.walk.className = nW ? 'amber' : '';
        hud.bar.style.setProperty('--k', scanK.toFixed(3));
      }
    };
  });

  /* ════════ LAYER STACK ════════ */
  const lay = $('layers'), layHost = $('layGL'), lbls = [...lay.querySelectorAll('.lstack__lbl')];
  when(layHost, (A) => {
    const AL = AerialGL.ALERT, T = [AL[0], AL[1], 640, 440]; let sp = 0;
    A.onframe = (t, dt) => {
      const p = lay._p || 0; sp += (p - sp) * Math.min(1, dt * 5);
      const k = sm(.04, .3, sp), mob = small();
      const P = A.p;
      P.stack = Math.max(.001, k); P.sep = 240; P.tile = T; P.season = .45; P.patch = 1; P.sat = 1.08; P.dim = 0;
      P.shift = mob ? [0, -.2] : [.14, -.02];
      Object.assign(A.cam, AerialGL.lookCam(AL[0], AL[1], 330 * k, -2.2 + sp * .75 + (reduce ? 0 : Math.sin(t * .2) * .02), .52 - .1 * sp, mob ? 3900 : 3100 - 300 * sp, 36));
      const step = +(lay.dataset.step || 0);
      const corners = [[T[0] + T[2], T[1] + T[3]], [T[0] + T[2], T[1] - T[3]], [T[0] - T[2], T[1] + T[3]], [T[0] - T[2], T[1] - T[3]]];
      let best = null, bx = -1e9;
      corners.forEach(c => { const q = A.project(c[0], c[1], 0); if (q && q[0] > bx){ bx = q[0]; best = c; } });
      lbls.forEach((el, i) => {
        const q = best && A.project(best[0], best[1], i * 240 * k);
        AGQ.place(el, q && [Math.min(q[0] + 6, A.w - (el._w || (el._w = el.offsetWidth || 200)) - 24), q[1] - 8], sm(.2, .32, sp) * (1 - sm(.97, 1, sp)));
        el.classList.toggle('dim', i !== step);
      });
    };
  });

  /* ════════ SEASON SCRUBBER ════════ */
  const sea = $('season'), seaHost = $('seaGL');
  const MONTHS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
  const MONTHS_L = ['March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November'];
  $('seaMonths').innerHTML = MONTHS.map(m => '<span>' + m + '</span>').join('');
  const EV = [[.05, 'Sown'], [.16, 'Emerged'], [.33, 'Canopy closed'], [.47, 'Stress caught', 'w'], [.63, 'Ripening'], [.8, 'Harvest']];
  const seaChart = $('seaChart');
  EV.forEach(e => { const d = document.createElement('div'); d.className = 'sea__ev' + (e[2] ? ' w' : ''); d.textContent = e[1]; d.dataset.t = e[0]; seaChart.appendChild(d); });
  const evEls = [...seaChart.querySelectorAll('.sea__ev')];
  const T0 = .03, T1 = .95;
  const gOf = (t) => sm(.04, .30, t) * (1 - sm(.58, .74, t) * .8) * (1 - sm(.80, .83, t));
  const dip = (t) => 1 - .14 * Math.exp(-Math.pow((t - .5) / .045, 2));
  (function(){
    const X = (t) => ((t - T0) / (T1 - T0) * 1000).toFixed(1), Y = (v) => (104 - v * 92).toFixed(1);
    let ln = '', nr = '';
    for (let i = 0; i <= 120; i++){ const t = T0 + (T1 - T0) * i / 120; ln += (i ? 'L' : 'M') + X(t) + ' ' + Y(gOf(t) * .92 * dip(t)); nr += (i ? 'L' : 'M') + X(t) + ' ' + Y(gOf(t) * .9); }
    $('seaLn').setAttribute('d', ln); $('seaArea').setAttribute('d', ln + 'L1000 110 L0 110Z'); $('seaNrm').setAttribute('d', nr);
    evEls.forEach(el => { const t = +el.dataset.t; el.style.left = ((t - T0) / (T1 - T0) * 100) + '%'; el.style.top = (+Y(gOf(t) * .92 * dip(t)) / 110 * 100) + '%'; });
  })();
  const seaTrack = $('seaTrack');
  const seaScrollTo = (k, now) => { const y = sea.offsetTop + (sea.offsetHeight - innerHeight) * Math.max(0, Math.min(1, k)); if (now && AGQ.lenis) AGQ.lenis.scrollTo(y, { immediate: true }); else if (now) scrollTo(0, y); else scrollToY(y); };
  let drag = false;
  const kAt = (e) => { const r = seaTrack.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  seaTrack.addEventListener('pointerdown', (e) => { drag = true; seaTrack.setPointerCapture(e.pointerId); seaScrollTo(kAt(e), true); });
  seaTrack.addEventListener('pointermove', (e) => { if (drag) seaScrollTo(kAt(e), true); });
  seaTrack.addEventListener('pointerup', () => { drag = false; });
  seaTrack.addEventListener('keydown', (e) => { const k = sea._p || 0; if (e.key === 'ArrowRight') seaScrollTo(k + .05); if (e.key === 'ArrowLeft') seaScrollTo(k - .05); });
  when(seaHost, (A) => {
    const AL = AerialGL.ALERT;
    // the field the camera watches: the wheat-type crop nearest the middle of the view
    let F = null, bd = 1e12;
    for (let x = -600; x <= 600; x += 60) for (let y = -600; y <= 600; y += 60){ const f = AerialGL.field(AL[0] + 200 + x, AL[1] + 100 + y, 5); if (f.kind < 4 && f.pivot === 0){ const d = x * x + y * y; if (d < bd){ bd = d; F = f; } } }
    const d0 = AerialGL.describe(F, 5, .45), off = ((F.id * .53) % 1 + 1) % 1, ctr = d0.centre;
    sea.querySelector('.gcard__h span').textContent = d0.name + ' · ' + d0.crop.toLowerCase();
    const mEls = [...$('seaMonths').children];
    let sp = 0, last = -1;
    A.onframe = (t, dt) => {
      const p = sea._p || 0; sp += (p - sp) * Math.min(1, dt * 6);
      const ts = T0 + (T1 - T0) * sp;   // where the watched field is in its own season
      const P = A.p; P.season = ((ts - off) % 1 + 1) % 1; P.sat = 1.1; P.shift = small() ? [0, .05] : [0, -.06];
      P.health = 0; P.outline = .0; P.hi = [F.bx, F.by, F.code, .6];
      Object.assign(A.cam, AerialGL.lookCam(ctr[0], ctr[1], 0, -2.15 + sp * .35 + (reduce ? 0 : t * .004), .68 + .08 * sp, small() ? 2600 : 1900, 38));
      if (Math.abs(sp - last) > .0005){
        last = sp;
        $('seaClipR').setAttribute('width', (sp * 1000).toFixed(1));
        seaTrack.style.setProperty('--k', sp.toFixed(4)); $('seaFill').style.setProperty('--k', sp.toFixed(4));
        $('seaKnob').style.setProperty('--x', (sp * seaTrack.clientWidth).toFixed(1) + 'px');
        seaTrack.setAttribute('aria-valuenow', Math.round(sp * 100));
        const mi = Math.min(8, Math.floor(sp * 9)); $('seaMonth').textContent = MONTHS_L[mi]; mEls.forEach((m, i) => m.classList.toggle('on', i === mi));
        const st = Math.abs(ts - .49) < .05 ? 'Stress caught · walk it' : AerialGL.describe(F, 5, P.season).stage;
        $('seaStage').textContent = st; $('seaStage').style.color = /Stress/.test(st) ? 'var(--harvest)' : ''; $('seaS2').textContent = st.split(' ·')[0];
        const vs = Math.round((dip(ts) - 1) * 100 + 3 * Math.sin(ts * 9));
        $('seaVs').textContent = (vs >= 0 ? '+' : '−') + Math.abs(vs) + '%'; $('seaVs').className = vs < -5 ? 'amber' : vs >= 0 ? 'ok' : '';
        $('seaDays').textContent = ts < .8 ? Math.round((.8 - ts) * 300) : 'Harvested';
        evEls.forEach(el => el.classList.toggle('on', +el.dataset.t <= ts + .005));
      }
    };
  });

  /* ════════ LIVE MAP ════════ */
  const mapHost = $('mapGL'), mapMain = $('mapMain'), tip = $('tip');
  when(mapHost, (A) => {
    const W = world(AerialGL), AL = W.AL;
    let mode = 'health', hiK = 0, hiKey = null, sel = W.alertF;
    const segs = [...document.querySelectorAll('.seg button')];
    segs.forEach(b => b.addEventListener('click', () => { mode = b.dataset.layer; segs.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $('mapLegend').innerHTML = mode === 'zones' ? '<span style="color:#a1cf4f">■</span> High <span style="color:#127a43">■</span> Avg <span style="color:#56634a">■</span> Low' : mode === 'health' ? 'Crop health <i></i>' : 'True colour'; }));
    const LINE_ON = 'M0 90 C40 84 70 50 110 30 C140 16 160 14 178 18', LINE_OFF = 'M0 90 C40 84 70 54 110 36 C140 22 160 26 178 38';
    function show(F){
      const d = W.info(F, 3, .45); if (!d || d.kind >= 6) return; sel = F;
      $('fldName').textContent = d.name; $('fldMeta').textContent = d.crop + ' · ' + d.ha.toFixed(1) + ' ha · ' + d.stage;
      $('fldH').textContent = Math.round(d.health * 100); $('fldA').textContent = Math.round(d.ha);
      const vs = d.vsNormal; $('fldVs').textContent = (vs > 0 ? '+' : vs < 0 ? '−' : '±') + Math.abs(vs) + '%'; $('fldVs').className = vs < -5 ? 'amber' : vs >= 0 ? 'ok' : '';
      $('fldTag').textContent = d.warn ? 'Walk first' : vs >= 0 ? 'On track' : 'Watching'; $('fldTag').className = d.warn ? 'amber' : 'ok';
      $('fldLine').setAttribute('d', d.warn ? LINE_OFF : LINE_ON); $('fldDot').setAttribute('cy', d.warn ? 38 : 18); $('fldDot').setAttribute('fill', d.warn ? '#F3A93C' : '#A9D646');
    }
    show(sel);
    mapMain.addEventListener('pointermove', (e) => {
      if (e.target.closest('.maphud')) return;
      const r = mapMain.getBoundingClientRect(), x = (e.clientX - r.left) * A.w / r.width, y = (e.clientY - r.top) * A.h / r.height;
      const d = A.pick(x, y), F = d && AerialGL.field(...A.unproject(x, y), 3);
      if (d && F && d.kind < 6){
        const dd = W.info(F, 3, .45); hiKey = [F.bx, F.by, F.code];
        $('tipName').textContent = dd.name; $('tipMeta').textContent = dd.crop + ' · ' + dd.ha.toFixed(1) + ' ha';
        $('tipH').textContent = Math.round(dd.health * 100) + (dd.warn ? ' · low' : ''); $('tipH').className = dd.warn ? 'amber' : 'ok'; $('tipStage').textContent = dd.stage;
        const tx = (e.clientX - r.left) + 18, ty = (e.clientY - r.top) + 18;
        tip.style.transform = 'translate(' + Math.min(tx, r.width - 240) + 'px,' + Math.min(ty, r.height - 130) + 'px)'; tip.classList.add('on');
      } else { hiKey = null; tip.classList.remove('on'); }
    });
    mapMain.addEventListener('pointerleave', () => { hiKey = null; tip.classList.remove('on'); });
    mapMain.addEventListener('click', (e) => {
      if (e.target.closest('.maphud')) return;
      const r = mapMain.getBoundingClientRect(), g = A.unproject((e.clientX - r.left) * A.w / r.width, (e.clientY - r.top) * A.h / r.height);
      if (g) show(AerialGL.field(g[0], g[1], 3));
    });
    document.querySelectorAll('[data-goto]').forEach(row => row.addEventListener('click', () => {
      const F = row.dataset.goto === 'alert' ? W.alertF : row.dataset.goto === 'creek' ? W.creekF : W.pivotF;
      if (F) show(F); document.querySelectorAll('[data-goto]').forEach(x => x.classList.toggle('on', x === row));
    }));
    let lastKey = null;
    A.onframe = (t) => {
      const P = A.p;
      P.health = mode === 'health' ? .95 : 0; P.zones = mode === 'zones' ? 1 : 0; P.outline = mode === 'truth' ? .25 : .5;
      P.alert = 1; P.patch = 1; P.season = .45; P.pix = 1; P.sat = 1.08;
      if (hiKey) lastKey = hiKey;
      hiK += ((hiKey ? 1 : 0) - hiK) * .2;
      P.hi = lastKey ? [lastKey[0], lastKey[1], lastKey[2], hiK] : [0, 0, 0, 0];
      P.sel = [sel.bx, sel.by, sel.code, .9];
      Object.assign(A.cam, AerialGL.lookCam(AL[0] + 60, AL[1] + 20, 0, -1.5708 + (reduce ? 0 : Math.sin(t * .06) * .05), 1.38, 2350, 34));
    };
  });
})();
