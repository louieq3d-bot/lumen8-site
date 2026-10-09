/* AgrosIQ home page, part two: the "what it catches" explorer (one live farm that flies between six problems, changing season
   on the way) and the morning brief (a phone that plays a morning: notification, map, walk, note, share). Both are AerialGL
   scenes driven by hand; the fields they name come from AGQ.world, the same named layout the rest of the page uses. */
(function(){
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const small = () => innerWidth < 1000;
  const when = (el, fn) => { const go = () => { const A = window.AerialGL && AerialGL.get(el) && AGQ.world; if (A) fn(AerialGL.get(el)); else setTimeout(go, 60); }; go(); };
  const seen = (el, fn) => new IntersectionObserver((es) => fn(es[0].isIntersecting), { threshold: .25 }).observe(el);
  // a camera flight: log-distance, shortest way round, a little climb in the middle
  function flyer(){
    let from = null, to = null, t0 = 0, dur = 1.8;
    const ang = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d; };
    return {
      go(target, now, d){ from = this.cur ? this.cur.slice() : target.slice(); to = target.slice(); to[2] = ang(from[2], to[2]); t0 = now; dur = d || 1.8; },
      at(now){
        if (!to) return null;
        const k = reduce ? 1 : sm(0, 1, (now - t0) / dur), hop = 1 + .55 * Math.sin(Math.PI * k) * Math.min(1, Math.hypot(to[0] - from[0], to[1] - from[1]) / 600);
        this.cur = [lerp(from[0], to[0], k), lerp(from[1], to[1], k), lerp(from[2], to[2], k), lerp(from[3], to[3], k), Math.exp(lerp(Math.log(from[4]), Math.log(to[4]), k)) * hop, lerp(from[5], to[5], k)];
        this.k = k; return this.cur;
      },
    };
  }
  const riverY = (x) => -1050 + 260 * Math.sin(x / 820) + 120 * Math.sin(x / 333 + 1);

  /* ════════ WHAT IT CATCHES ════════ */
  const SIG = [
    { ic: 'sprout', kind: 'Uneven early growth', sub: 'Thin or patchy ground early in the season', season: .12, date: '14 Apr', time: '06:12', vs: -31, area: 2.3,
      what: 'The south end is greening up thinner than the rest of the field.', act: 'Walk the south end and look at the stand. AgrosIQ shows where and how much, not why.' },
    { ic: 'drop', kind: 'Drying faster than normal', sub: 'Greenness falling faster than its own history', season: .47, date: '24 Jun', time: '05:58', vs: -22, area: 4.1,
      what: 'Falling faster than its ten-year normal for late June.', act: 'Check the block on the ground before deciding anything. The water balance is in beta.' },
    { ic: 'leaf', kind: 'Pale band', sub: 'A strip greening up less than the ground around it', season: .3, date: '21 May', time: '06:04', vs: -17, area: 1.6,
      what: 'A pale band about 40 m wide along the old fence line.', act: 'Walk the band. The pin gives its position and width; the cause is for you or your agronomist to find.' },
    { ic: 'waves', kind: 'Low ground lagging', sub: 'Low ground behind the rest after rain', season: .36, date: '3 Jun', time: '06:20', vs: -27, area: .9, river: true,
      what: 'The low corner by the creek is lagging the rest of the field four days after rain.', act: 'Check the corner on the ground when it is safe to get there.' },
    { ic: 'storm', kind: 'Sudden drop', sub: 'A sharp fall between two passes', season: .56, date: '13 Jul', time: '06:09', vs: -38, area: 3.8,
      what: 'A band through the middle fell sharply between the passes before and after Saturday\'s storm.', act: 'Before-and-after maps are in the field record. Check the band on the ground.' },
    { ic: 'wheat', kind: 'Drying down first', sub: 'Which paddock is browning off first', season: .75, date: '2 Oct', time: '06:15', ready: true,
      what: 'Drying down evenly, about four days ahead of its neighbours.', act: 'Check it on the ground. When to harvest is your call.' },
  ];
  const sigList = $('sigList'), sigStage = $('sigStage');
  sigList.innerHTML = SIG.map((s, i) => '<button class="sig__item" role="tab" type="button" aria-selected="' + (i === 0) + '" aria-controls="sigStage" id="sigT' + i + '" tabindex="' + (i ? -1 : 0) + '">' +
    '<span class="ic-tile"><i class="ic" data-ic="' + s.ic + '"></i></span><span><b>' + s.kind + '</b><small>' + s.sub + '</small></span></button>').join('');
  AGQ.fillIcons(sigList);
  const tabs = [...sigList.children];
  let cur = 0, shown = 0, inView = false, hover = false, hold = 0, tSel = performance.now() / 1000;
  const DWELL = 7.5;
  function select(i, user){
    cur = (i + SIG.length) % SIG.length; tSel = performance.now() / 1000; if (user) hold = tSel + 14;
    tabs.forEach((b, k) => { b.setAttribute('aria-selected', String(k === cur)); b.tabIndex = k === cur ? 0 : -1; });
    if (user && small()) tabs[cur].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  tabs.forEach((b, i) => b.addEventListener('click', () => select(i, true)));
  sigList.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (d){ e.preventDefault(); select(cur + d, true); tabs[cur].focus(); }
  });
  sigStage.parentElement.addEventListener('pointerenter', () => { hover = true; });
  sigStage.parentElement.addEventListener('pointerleave', () => { hover = false; });
  seen(sigStage, (v) => { inView = v; if (v) tSel = performance.now() / 1000; });

  when($('sigGL'), (A) => {
    const W = AGQ.world(AerialGL), AL = W.AL, taken = new Set([W.key(W.alertF), W.creekF && W.key(W.creekF), W.pivotF && W.key(W.pivotF)]);
    // crop fields around the farm, spread out so every flight goes somewhere new
    const pool = new Map();
    for (let x = -1700; x <= 1700; x += 90) for (let y = -1300; y <= 1500; y += 90){ const F = AerialGL.field(AL[0] + x, AL[1] + y, 3), k = W.key(F); if (!pool.has(k) && !taken.has(k)) pool.set(k, F); }
    let cand = [...pool.values()].map(F => ({ F, d: W.info(F, 3, .45) })).filter(o => o.d && o.d.kind < 4 && o.d.pivot === 0 && o.d.ha > 12);
    const picks = [];
    SIG.forEach((s, i) => {
      if (s.river){
        for (let x = 300; x < 1700; x += 40){ const y = riverY(x) + 200, F = AerialGL.field(x, y, 3), d = W.info(F, 3, .45);
          if (d && d.kind < 4 && d.pivot === 0 && !taken.has(W.key(F))){ taken.add(W.key(F)); picks.push({ F, d, spot: [x, y] }); return; } }
      }
      const ang = -2.2 + i * 1.15, want = [AL[0] + Math.cos(ang) * 780, AL[1] + Math.sin(ang) * 640];
      cand.sort((a, b) => Math.hypot(a.d.centre[0] - want[0], a.d.centre[1] - want[1]) - Math.hypot(b.d.centre[0] - want[0], b.d.centre[1] - want[1]));
      const o = cand.find(c => !taken.has(W.key(c.F))) || cand[0]; taken.add(W.key(o.F));
      picks.push({ F: o.F, d: o.d, spot: [o.d.centre[0] + 22, o.d.centre[1] - 16] });
    });
    const fly = flyer(), card = $('sigCard'), ring = $('sigRing');
    const camOf = (i) => { const s = picks[i].spot; return [s[0], s[1], -1.95 + i * .62, .98, small() ? 1500 : 1180, SIG[i].season]; };
    let season = SIG[0].season;
    function fill(i){
      const s = SIG[i], pk = picks[i], d = W.info(pk.F, 3, s.season);
      $('sigChip').textContent = 'Signal ' + String(i + 1).padStart(2, '0') + ' of 06'; $('sigChip').className = 'chip ' + (s.ready ? 'chip--ok' : 'chip--warn');
      $('sigWhen').textContent = 'Found ' + s.date + ' · ' + s.time;
      $('sigKind').textContent = s.kind; $('sigKind').className = s.ready ? '' : 'amber'; $('sigDate').textContent = s.date;
      $('sigField').textContent = d.name; $('sigWhat').textContent = s.what;
      $('sigArea').textContent = s.ready ? d.ha.toFixed(1) + ' ha' : s.area.toFixed(1) + ' ha';
      $('sigArea').previousElementSibling.textContent = s.ready ? 'Field size' : 'Area affected';
      $('sigVs').textContent = s.ready ? 'First in line' : '−' + Math.abs(s.vs) + '%'; $('sigVs').className = s.ready ? 'ok' : 'amber';
      $('sigVs').previousElementSibling.textContent = s.ready ? 'Harvest order' : 'vs. its normal';
      $('sigCrop').textContent = d.crop === 'Stubble' ? 'Wheat' : d.crop;
      $('sigDo').textContent = s.act;
      $('sigLegend').innerHTML = s.ready ? 'True colour' : 'Crop health <i></i>';
    }
    fill(0); fly.go(camOf(0), 0, .01);
    A.onframe = (t) => {
      const now = performance.now() / 1000;
      // auto-advance while on screen, unless the visitor is looking or has just chosen one
      if (inView && !hover && !reduce && now > hold && now - tSel > DWELL) select(cur + 1);
      if (shown !== cur){ shown = cur; fly.go(camOf(cur), t, 1.9); }
      const c = fly.at(t) || camOf(cur), k = fly.k == null ? 1 : fly.k, s = SIG[cur], pk = picks[cur];
      if (k > .55 && card._i !== cur){ card._i = cur; fill(cur); }
      season = c[5];
      Object.assign(A.cam, AerialGL.lookCam(c[0], c[1], 0, c[2] + (reduce ? 0 : Math.sin(t * .11) * .04), c[3], c[4], 34));
      A.cam.roll = reduce ? 0 : .04 * Math.sin(Math.PI * k) * (cur % 2 ? 1 : -1);
      const P = A.p, arrive = sm(.7, 1, k);
      P.season = season; P.sat = 1.08; P.pix = 1; P.scanOn = 0;
      P.shift = small() ? [0, .36] : [-.16, .02];
      P.alertPos = pk.spot; P.focus = pk.spot; P.focusR = 300; P.focusK = .6 * arrive;
      P.health = s.ready ? 0 : .95 * arrive; P.patch = s.ready ? 0 : arrive; P.alert = s.ready ? 0 : arrive;
      P.outline = s.ready ? .55 * arrive : .3;
      P.sel = s.ready ? [pk.F.bx, pk.F.by, pk.F.code, .9 * arrive] : [0, 0, 0, 0]; P.hi = [0, 0, 0, 0];
      const q = A.project(pk.spot[0], pk.spot[1], 0);
      AGQ.place(ring, q, s.ready ? 0 : arrive);
      if (q){
        if (small()) card.style.transform = 'translate3d(16px,' + (A.h - (card.offsetHeight || 260) - 40) + 'px,0)';
        else { const x = Math.min(A.w - 320, q[0] + 70), y = Math.max(70, Math.min(A.h - (card.offsetHeight || 280) - 50, q[1] - 140)); card.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)'; }
      }
      card.style.opacity = q ? sm(.75, 1, k).toFixed(3) : 0;
      $('sigProg').style.setProperty('--k', inView && !reduce ? Math.min(1, (now - tSel) / DWELL).toFixed(3) : 0);
    };
  });

  /* ════════ MORNING BRIEF ════════ */
  const STEPS = [
    { t: '05:58', v: 'lock', n: 1, b: 'A fresh look, overnight', p: 'A new pass over the farm is read before you are up. All 33 fields are checked against their own history.' },
    { t: '06:12', v: 'lock', n: 2, b: 'Two fields flagged', p: 'Only what matters goes on the list. Today it is Ridge Paddock first, then Creek Flat.' },
    { t: '06:15', v: 'map', b: 'Open it, see it', p: 'The map opens on the problem, with its size and how far it has slipped below normal.' },
    { t: '06:38', v: 'walk', b: 'Walk straight there', p: 'The pin gives the exact 10 m spot and its coordinates. Walking directions on the phone are coming later.' },
    { t: '06:41', v: 'note', b: 'Note it', p: 'Record what you found against the spot, so next season remembers. Photos are coming later.' },
    { t: '06:45', v: 'share', b: 'Everyone on the same page', p: 'Send your agronomist a read-only link to the same map. Team accounts are coming later.' },
  ];
  const NOTES = [
    ['New pass read · North Farm', '33 fields checked, cloud-free. 31 on track.', ''],
    ['2 fields need a look', 'Ridge Paddock first: 1.1 ha, 24% below its normal.', 'w'],
  ];
  const stepsEl = $('briefSteps');
  stepsEl.innerHTML = STEPS.map((s, i) => '<li data-i="' + i + '" tabindex="0"><time>' + s.t + '</time><div><b>' + s.b + '</b><p>' + s.p + '</p></div></li>').join('');
  const lis = [...stepsEl.children], views = {}; document.querySelectorAll('.dev__view').forEach(v => { views[v.dataset.v] = v; });
  const notes = $('devNotes'), shade = $('devShade');
  let bi = -1, bT = 0, bHold = 0, bIn = false;
  const BDW = 4.2;
  function step(i, user){
    i = (i + STEPS.length) % STEPS.length; const s = STEPS[i], prevN = bi >= 0 && STEPS[bi].v === 'lock' ? STEPS[bi].n : 0;
    bi = i; bT = performance.now() / 1000; if (user) bHold = bT + 12;
    lis.forEach((li, k) => { li.classList.toggle('on', k === i); li.classList.toggle('done', k < i); });
    Object.entries(views).forEach(([k, v]) => v.classList.toggle('on', k === s.v));
    $('devClock').textContent = s.t; $('devBig').textContent = s.t;
    shade.classList.toggle('lock', s.v === 'lock');
    if (s.v === 'lock' && s.n !== prevN){
      notes.innerHTML = NOTES.slice(0, s.n).reverse().map((n, k) => '<div class="note ' + n[2] + '"' + (k ? ' style="animation:none"' : '') + '><img src="assets/brand/agrosiq-mark-dark.svg" alt=""><div><header><span>AgrosIQ</span><span>' + (k ? '14m ago' : 'now') + '</span></header><b>' + n[0] + '</b><br><span>' + n[1] + '</span></div></div>').join('');
    }
  }
  lis.forEach((li, i) => { li.addEventListener('click', () => step(i, true)); li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); step(i, true); } }); });
  step(0);
  seen($('dev'), (v) => { bIn = v; if (v && !reduce) bT = performance.now() / 1000; });

  when($('briefGL'), (A) => {
    const W = AGQ.world(AerialGL), AL = W.AL, RS = [AL[0] - 150, AL[1] - 140], fly = flyer();
    const route = $('devRoute'), you = $('devYou'), geo = $('devGeo'), dist = $('devDist'), eta = $('devEta');
    const CAM = { lock: [AL[0] + 200, AL[1] + 120, -2.1, .9, 3200], map: [AL[0] + 30, AL[1] + 10, -1.5708, 1.42, 1250], walk: [AL[0] - 70, AL[1] - 70, -2.25, 1.0, 470],
                  note: [AL[0] + 4, AL[1] + 4, -2.0, 1.25, 120], share: [AL[0] + 60, AL[1] + 20, -1.75, 1.1, 1600] };
    let shownV = null;
    A.onframe = (t) => {
      const now = performance.now() / 1000;
      if (bIn && !reduce && now > bHold && now - bT > BDW) step(bi + 1);
      const s = STEPS[bi];
      if (shownV !== s.v){ shownV = s.v; const c = CAM[s.v]; fly.go([c[0], c[1], c[2], c[3], c[4], 0], t, 1.6); }
      const c = fly.at(t);
      Object.assign(A.cam, AerialGL.lookCam(c[0], c[1], 0, c[2] + (reduce ? 0 : Math.sin(t * .13) * .03), c[3], c[4], 40));
      const P = A.p, v = s.v, k = sm(.6, 1, fly.k);
      P.season = .45; P.sat = 1.08; P.pix = 1; P.scanOn = 0; P.shift = [0, v === 'walk' ? -.12 : v === 'map' || v === 'share' ? .1 : 0]; P.alertPos = AL; P.focus = AL;
      P.health = v === 'map' || v === 'walk' ? .95 * k : 0; P.patch = 1; P.alert = v === 'lock' ? 0 : v === 'note' ? .5 : k;
      P.zones = v === 'share' ? k : 0; P.outline = v === 'map' || v === 'share' ? .5 : 0; P.focusK = v === 'map' ? .35 * k : 0; P.focusR = 260;
      P.sel = v === 'map' || v === 'share' ? [W.alertF.bx, W.alertF.by, W.alertF.code, .9 * k] : [0, 0, 0, 0];
      // the walk: dashed route from the gate, you walking along it, the distance counting down
      if (v === 'walk'){
        const a = A.project(RS[0], RS[1], 0), m = A.project(RS[0] + 10, AL[1] - 40, 0), b = A.project(AL[0] + 5, AL[1] + 5, 0);
        const w = Math.min(1, Math.max(0, (now - bT - .8) / (BDW - 1.2)));
        if (a && m && b){
          route.setAttribute('d', 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' Q' + m[0].toFixed(1) + ' ' + m[1].toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1));
          route.style.strokeDashoffset = (-t * 18).toFixed(1);
          const u = w, x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * m[0] + u * u * b[0], y = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * m[1] + u * u * b[1];
          you.setAttribute('cx', x.toFixed(1)); you.setAttribute('cy', y.toFixed(1));
          const tx = 2 * (1 - u) * (m[0] - a[0]) + 2 * u * (b[0] - m[0]), ty = 2 * (1 - u) * (m[1] - a[1]) + 2 * u * (b[1] - m[1]);
          $('devArrow').style.transform = 'rotate(' + (Math.atan2(ty, tx) * 180 / Math.PI + 90).toFixed(1) + 'deg)';
        }
        const left = Math.max(4, Math.round(205 * (1 - w)));
        dist.textContent = left + ' m'; eta.textContent = left > 20 ? Math.max(1, Math.round(left / 70)) + ' min · north-east' : 'You\'re there';
        geo.style.opacity = k.toFixed(2);
      } else geo.style.opacity = 0;
      lis.forEach((li, i) => li.style.setProperty('--k', i === bi ? (bIn && !reduce ? Math.min(1, (now - bT) / BDW) : 1).toFixed(3) : ''));
    };
  });
})();
