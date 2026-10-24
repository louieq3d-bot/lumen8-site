/* Archetypes header: one site, five structures. The structure's points flow from one archetype to the next, and the
   ground under it is coloured by the share of open-field light it receives over 21 March at 33.9° S, from shadow rays
   and a coarse sky view cast against the structure (beam through any semi-transparent roof at its transmittance).
   Dimensions are the archetype defaults drawn on the plates below; table width, bay and tunnel span are illustrative. */
(function(){
  'use strict';
  const S = window.AGVScene, U = S.util;
  S.register('arch', function(api){
    const LAT = -33.9, X0 = -26, X1 = 26, Y0 = -19, Y1 = 19;
    const rnd = U.rng(11);
    // ── geometry: quads (q0, e1, e2, transmittance) and posts ([x,y,z0,z1]) per archetype ──
    function arch(id, theta){
      const Q = [], P = [];
      const quad = (q0, e1, e2, tau, film) => Q.push({ q0, e1, e2, tau, film: !!film });
      if (id === 'A'){                            // overhead stilted, 4.5 m clearance, tilt 12° to the north, GCR 0.30
        const w = 3, c = Math.cos(12 * U.D2R) * w, h = Math.sin(12 * U.D2R) * w;
        for (const yc of [-15, -5, 5, 15]){
          quad([X0 + 2, yc - c / 2, 4.5 + h], [X1 - X0 - 4, 0, 0], [0, c, -h], 0);
          for (let x = X0 + 2; x <= X1 - 2 + 1e-6; x += 6) P.push([x, yc, 0, 4.5 + h / 2]);
        }
      } else if (id === 'C'){                     // vertical bifacial fences, rows 10 m apart, 0.6–2.5 m
        for (const xc of [-20, -10, 0, 10, 20]){
          quad([xc, Y0 + 1, .6], [0, Y1 - Y0 - 2, 0], [0, 0, 1.9], 0);
          for (let y = Y0 + 1; y <= Y1 - 1 + 1e-6; y += 4.5) P.push([xc, y, 0, 2.5]);
        }
      } else if (id === 'D'){                     // single-axis tracker, hub 2.5 m, pitch 9.5 m, module 2.85 m, ±55°
        const hw = 1.425, c = Math.cos(theta), s = Math.sin(theta);
        for (const xc of [-19, -9.5, 0, 9.5, 19]){
          quad([xc - hw * c, Y0 + 1, 2.5 + hw * s], [0, Y1 - Y0 - 2, 0], [2 * hw * c, 0, -2 * hw * s], 0);
          for (let y = Y0 + 1; y <= Y1 - 1 + 1e-6; y += 6) P.push([xc, y, 0, 2.5]);
        }
      } else if (id === 'E'){                     // rain-shelter canopy, eave 2.8 m, ridge 3.4 m, modules about 35–40 % transparent
        for (let y = Y0 + 1; y < Y1 - 1; y += 6){
          quad([X0 + 2, y, 2.8], [X1 - X0 - 4, 0, 0], [0, 3, .6], .375);
          quad([X0 + 2, y + 3, 3.4], [X1 - X0 - 4, 0, 0], [0, 3, -.6], .375);
          for (let x = X0 + 2; x <= X1 - 2 + 1e-6; x += 6) P.push([x, y, 0, 2.8]);
        }
        for (let x = X0 + 2; x <= X1 - 2 + 1e-6; x += 6) P.push([x, Y1 - 1, 0, 2.8]);
      } else {                                    // F: polytunnel, gutter 4.5 m, roof under PV 25 %, span 9 m (illustrative)
        const arc = (y0, t) => [y0 + 9 * t, 4.5 + 1.6 * Math.sin(Math.PI * t)];
        for (const y0 of [-18, -9, 0, 9]){
          for (const [t0, t1] of [[.31, .43], [.57, .69]]){
            const a = arc(y0, t0), b = arc(y0, t1);
            quad([X0 + 2, a[0], a[1]], [X1 - X0 - 4, 0, 0], [0, b[0] - a[0], b[1] - a[1]], 0);
          }
          for (const [t0, t1] of [[0, .155], [.155, .31], [.43, .57], [.69, .845], [.845, 1]]){   // the film between the strips
            const a = arc(y0, t0), b = arc(y0, t1);
            quad([X0 + 2, a[0], a[1]], [X1 - X0 - 4, 0, 0], [0, b[0] - a[0], b[1] - a[1]], .85, true);
          }
          for (let x = X0 + 2; x <= X1 - 2 + 1e-6; x += 6) P.push([x, y0, 0, 4.5]);
        }
        for (let x = X0 + 2; x <= X1 - 2 + 1e-6; x += 6) P.push([x, 18, 0, 4.5]);
      }
      return { Q, P };
    }
    const IDS = ['A', 'C', 'D', 'E', 'F'];
    const INFO = {
      A: ['Overhead stilted', [['Clearance', '4.5 m'], ['Tilt', '12° to the equator'], ['Ground cover', 'GCR 0.30']]],
      C: ['Vertical fence', [['Height', '2.5 m'], ['Row spacing', '10 m'], ['Modules', 'bifacial, upright']]],
      D: ['Single-axis tracker', [['Hub height', '2.5 m'], ['Pitch', '9.5 m · GCR 0.30'], ['Rotation', '±55°']]],
      E: ['Rain-shelter canopy', [['Eave · ridge', '2.8 m · 3.4 m'], ['Modules', 'about 35–40 % transparent'], ['Bay', '6 m, illustrative']]],
      F: ['PV polytunnel', [['Gutter', '4.5 m'], ['Roof under PV', '25 %'], ['Span', '9 m, illustrative']]],
    };
    const TRACK = Math.atan2(U.sun(10, 0, LAT).e, U.sun(10, 0, LAT).u);   // tracker drawn at its 10:00 angle
    const clampT = (t) => Math.max(-55 * U.D2R, Math.min(55 * U.D2R, t));

    // ── ground light per archetype: beam over the day plus a 16-direction sky, relative to open field ──
    const GS = api.small ? 1.1 : .72, ground = [];
    for (let y = Y0; y <= Y1 + 1e-6; y += GS) for (let x = X0; x <= X1 + 1e-6; x += GS) ground.push([x + (rnd() - .5) * GS * .4, y + (rnd() - .5) * GS * .4]);
    const HOURS = []; for (let h = 6.25; h < 18; h += .75){ const s = U.sun(h, 0, LAT), I = U.irr(s.u); if (I.b + I.d > 0) HOURS.push([h, s, I]); }
    const SKY = []; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++){ const u1 = (i + .5) / 4, ph = 2 * Math.PI * (j + .5 + i * .25) / 4, r = Math.sqrt(u1); SKY.push([r * Math.cos(ph), r * Math.sin(ph), Math.sqrt(1 - u1)]); }
    const through = (Q, o, d) => { let t = 1; for (const q of Q) if (U.hitQuad(o, d, q.q0, q.e1, q.e2) > 0) t *= q.tau; return t; };
    const LIGHT = {}, MEAN = {};
    for (const id of IDS){
      const base = arch(id, TRACK), skyQ = base.Q;
      const perHour = HOURS.map(([h, s]) => id === 'D' ? arch('D', clampT(Math.atan2(s.e, s.u))).Q : base.Q);
      const v = new Float32Array(ground.length); let sum = 0, n = 0;
      ground.forEach(([x, y], i) => {
        const o = [x, y, .05];
        let dif = 0; for (const d of SKY) dif += through(skyQ, o, d); dif /= SKY.length;
        let num = 0, den = 0;
        HOURS.forEach(([h, s, I], k) => { num += I.b * through(perHour[k], o, [s.e, s.n, s.u]) + I.d * dif; den += I.b + I.d; });
        v[i] = num / den;
        if (Math.abs(x) < 16 && Math.abs(y) < 12){ sum += v[i]; n++; }
      });
      LIGHT[id] = v; MEAN[id] = sum / n;
    }

    // ── structure points: the same count for every archetype so they can flow into each other ──
    const N = api.small ? 7000 : 14000;
    function sample(id){
      const { Q, P } = arch(id, TRACK), out = new Float32Array(N * 3), col = new Float32Array(N * 4), size = new Float32Array(N);
      const areas = Q.map(q => { const c = [q.e1[1] * q.e2[2] - q.e1[2] * q.e2[1], q.e1[2] * q.e2[0] - q.e1[0] * q.e2[2], q.e1[0] * q.e2[1] - q.e1[1] * q.e2[0]]; return Math.hypot(...c) * (q.film ? .3 : 1); });
      const total = areas.reduce((a, b) => a + b, 0), nPost = Math.round(N * .14), nEdge = Math.round(N * .16);
      const r = U.rng(id.charCodeAt(0) * 97);
      for (let i = 0; i < N; i++){
        let p, c, s;
        if (i < nPost){                             // posts
          const q = P[i % P.length], t = r();
          p = [q[0], q[1], q[2] + (q[3] - q[2]) * t]; c = [.86, .89, .94, .62]; s = .1;
        } else {
          let pick = r() * total, k = 0; while (k < Q.length - 1 && pick > areas[k]){ pick -= areas[k]; k++; }
          const q = Q[k]; let a = r(), b = r();
          const edge = i < nPost + nEdge;           // panel outlines read brighter
          if (edge){ if (r() < .5) a = r() < .5 ? 0 : 1; else b = r() < .5 ? 0 : 1; }
          p = [q.q0[0] + q.e1[0] * a + q.e2[0] * b, q.q0[1] + q.e1[1] * a + q.e2[1] * b, q.q0[2] + q.e1[2] * a + q.e2[2] * b];
          const glass = q.tau > 0;
          if (q.film){ out.set(p, i * 3); col.set([.7, .76, .84, .16], i * 4); size[i] = .12; continue; }
          c = edge ? [.82, .88, 1, glass ? .6 : .9] : [.42, .54, .74, glass ? .34 : .74];
          s = edge ? .12 : .19;
        }
        out.set(p, i * 3); col.set(c, i * 4); size[i] = s;
      }
      return { p: out, c: col, s: size };
    }
    const SAMPLES = Object.fromEntries(IDS.map(id => [id, sample(id)]));

    // ── layers ──
    const G = api.layer(ground.length, { round: false });
    ground.forEach(([x, y], i) => { G.p.set([x, y, 0], i * 3); G.s[i] = GS * .5; });
    // crop beds: every other ground row carries a plant whose size follows the light it gets
    const beds = []; ground.forEach((g, i) => { const r = Math.round((g[1] - Y0) / GS), c = Math.round((g[0] - X0) / GS); if (r % 3 === 0 && c % 2 === 0) beds.push(i); });
    const CR = api.layer(beds.length, { round: true, depth: true });
    beds.forEach((gi, j) => CR.p.set([ground[gi][0], ground[gi][1], .3], j * 3));
    const ST = api.layer(N, { round: true, depth: true });
    const PATH = api.layer(80, { round: true, add: true });
    for (let i = 0; i < 80; i++){ const h = 5.6 + i * (12.8 / 79), s = U.sun(h, 0, LAT); PATH.p.set([s.e * 60, s.n * 60, Math.max(-2, s.u * 60)], i * 3); PATH.c.set([1, .93, .78, s.u > 0 ? .28 : 0], i * 4); PATH.s[i] = .45; }
    const SUN = api.layer(1, { round: true, add: true });

    function paintGround(a, b, k){
      const va = LIGHT[a], vb = LIGHT[b];
      for (let i = 0; i < ground.length; i++){
        const v = va[i] + (vb[i] - va[i]) * k, c = U.ramp(Math.min(1, v));
        G.c[i * 4] = c[0]; G.c[i * 4 + 1] = c[1]; G.c[i * 4 + 2] = c[2]; G.c[i * 4 + 3] = .26 + .6 * v;
      }
      G.dirty = true;
      beds.forEach((gi, j) => {
        const v = Math.min(1, va[gi] + (vb[gi] - va[gi]) * k), g = Math.max(0, (v - .25) / .75);
        CR.c.set([.71 - .45 * g, .88 - .3 * g, .29 + .02 * g, .3 + .5 * g], j * 4);
        CR.s[j] = .1 + .42 * g * g; CR.p[j * 3 + 2] = .06 + .4 * g * g;
      });
      CR.dirty = true;
    }
    function morph(a, b, k){
      const A = SAMPLES[a], B = SAMPLES[b];
      for (let i = 0; i < N; i++){
        const x = A.p[i * 3], delay = (x - X0) / (X1 - X0) * .45, t = U.ease(Math.max(0, Math.min(1, (k - delay) / .55)));
        const lift = Math.sin(Math.PI * t) * 1.6;
        for (let j = 0; j < 3; j++) ST.p[i * 3 + j] = A.p[i * 3 + j] + (B.p[i * 3 + j] - A.p[i * 3 + j]) * t;
        ST.p[i * 3 + 2] += lift;
        for (let j = 0; j < 4; j++) ST.c[i * 4 + j] = A.c[i * 4 + j] + (B.c[i * 4 + j] - A.c[i * 4 + j]) * t;
        ST.s[i] = A.s[i] + (B.s[i] - A.s[i]) * t;
      }
      ST.dirty = true;
    }

    // ── HUD wiring ──
    const pills = [...api.stage.querySelectorAll('[data-arch-pick]')];
    let cur = 0, next = 0, k = 1, hold = 0, paused = false;
    const HOLD = 4.6, MORPH = 2.2;
    const pick = (i) => { if (i === next && k < 1) return; cur = next; next = i; k = 0; hold = 0; };
    pills.forEach((b, i) => b.addEventListener('click', () => { pick(i); paused = true; }));
    api.stage.querySelector('.hud') && api.stage.querySelector('.hud').addEventListener('pointerenter', () => { paused = true; });
    function hud(){
      const id = IDS[next], [name, rows] = INFO[id];
      api.readout('arch-id', id); api.readout('arch-name', name);
      rows.forEach(([kk, v], i) => { api.readout('arch-k' + i, kk); api.readout('arch-v' + i, v); });
      api.readout('arch-light', Math.round(MEAN[id] * 100) + '% of open');
      pills.forEach((b, i) => b.setAttribute('aria-pressed', String(i === next)));
    }
    paintGround('A', 'A', 1); morph('A', 'A', 1); hud();

    api.cam = Object.assign(api.cam, { az: .55, el: 29, dist: api.small ? 84 : 70, tx: 0, ty: -1, tz: 1.5, fov: 34, shift: api.small ? .04 : 0, shiftX: api.small ? 0 : .07, sway: .12 });
    api.fog = [.75, 2.1];
    let az = .55;
    return function frame(t, dt, scroll){
      if (api.reduce){ return; }
      az += dt * .035; api.cam.az = az; api.cam.el = 29 - scroll * 10; api.cam.dist = (api.small ? 84 : 70) * (1 + scroll * .25);
      if (k < 1){
        k = Math.min(1, k + dt / MORPH);
        morph(IDS[cur], IDS[next], k); paintGround(IDS[cur], IDS[next], U.ease(k));
        if (k > .5 && api.readout && hud._last !== next){ hud(); hud._last = next; }
      } else if (!paused){
        hold += dt; if (hold > HOLD) pick((next + 1) % IDS.length);
      }
      const h = 6 + ((t / 1000 * .5) % 12), s = U.sun(h, 0, LAT);
      SUN.p.set([s.e * 60, s.n * 60, s.u * 60]); SUN.c.set([.95, .64, .11, s.u > 0 ? 1 : 0]); SUN.s[0] = 3.2; SUN.dirty = true;
    };
  });
})();
