/* Science header: equation (2), drawn. A probe walks across one row pitch of archetype A (4.5 m clearance, 12° tilt,
   3 m tables, GCR 0.30). From the probe, 420 cosine-weighted rays go to the sky: rays that reach it are warm, rays that
   stop on a module are cold and end on the module. The readout compares the share of open rays with the crossed-strings
   view factor of eq. (2) for infinitely long rows; the rows here are 48 m long, so low rays along the rows escape. */
(function(){
  'use strict';
  const S = window.AGVScene, U = S.util;
  S.register('sky', function(api){
    const PITCH = 10, W = 3, C = Math.cos(12 * U.D2R) * W, HZ = Math.sin(12 * U.D2R) * W, LOW = 4.5, XL = 24;
    const ROWS = []; for (let k = -6; k <= 6; k++) ROWS.push(k * PITCH + 5);
    const QUADS = ROWS.map(yc => ({ q0: [-XL, yc - C / 2, LOW + HZ], e1: [2 * XL, 0, 0], e2: [0, C, -HZ] }));
    // eq. (2): 1 − ½ Σ (sin θ_far − sin θ_near), as the union of blocked intervals in sin θ, rows infinitely long
    function Fcs(y){
      const iv = [];
      for (let k = -40; k <= 40; k++){
        const yc = k * PITCH + 5, a = [yc - C / 2 - y, LOW + HZ], b = [yc + C / 2 - y, LOW];
        const sa = a[0] / Math.hypot(a[0], a[1]), sb = b[0] / Math.hypot(b[0], b[1]);
        iv.push([Math.min(sa, sb), Math.max(sa, sb)]);
      }
      iv.sort((p, q) => p[0] - q[0]);
      let blocked = 0, lo = -2, hi = -2;
      for (const [p, q] of iv){ if (p > hi){ blocked += hi - lo; lo = p; hi = q; } else hi = Math.max(hi, q); }
      blocked += hi - lo;
      return 1 - blocked / 2;
    }
    const NR = api.small ? 260 : 420, DIRS = [];
    const r0 = U.rng(5);
    for (let i = 0; i < NR; i++){ const u1 = (i + r0()) / NR, ph = 2 * Math.PI * ((i * .618034) % 1), r = Math.sqrt(u1); DIRS.push([r * Math.cos(ph), r * Math.sin(ph), Math.sqrt(1 - u1)]); }
    const hit = (o, d) => { let best = -1; for (const q of QUADS){ const t = U.hitQuad(o, d, q.q0, q.e1, q.e2); if (t > 0 && (best < 0 || t < best)) best = t; } return best; };
    const Fmc = (y) => { let open = 0; for (const d of DIRS) if (hit([0, y, .02], d) < 0) open++; return open / NR; };
    // the curve across one pitch, for the readout plot
    const Y0 = -5, CURVE = [], DOTS = [];
    for (let i = 0; i <= 100; i++) CURVE.push(Fcs(Y0 + PITCH * i / 100));
    for (let i = 0; i <= 20; i++) DOTS.push(Fmc(Y0 + PITCH * i / 20));

    // ── static layers: ground coloured by eq. (2), the modules, posts, a faint dome ──
    const ground = [];
    for (let y = -22; y <= 22; y += .45) for (let x = -22; x <= 22; x += .45) ground.push([x, y]);
    const G = api.layer(ground.length);
    const fcache = new Map();
    ground.forEach(([x, y], i) => {
      const key = Math.round(y / .45); if (!fcache.has(key)) fcache.set(key, Fcs(y));
      const v = fcache.get(key), c = U.ramp(Math.max(0, (v - .55) / .45));
      G.p.set([x, y, 0], i * 3); G.c.set([c[0], c[1], c[2], .18 + .5 * (v - .5)], i * 4); G.s[i] = .2;
    });
    const MOD = [], rm = U.rng(9);
    for (const q of QUADS) for (let i = 0; i < (api.small ? 900 : 1600); i++){
      let a = rm(), b = rm(); const edge = i % 5 === 0; if (edge){ if (rm() < .5) b = rm() < .5 ? 0 : 1; else a = rm() < .5 ? 0 : 1; }
      MOD.push([q.q0[0] + q.e1[0] * a + q.e2[0] * b, q.q0[1] + q.e1[1] * a + q.e2[1] * b, q.q0[2] + q.e1[2] * a + q.e2[2] * b, edge]);
    }
    for (const yc of ROWS) for (let x = -XL; x <= XL; x += 6) for (let z = 0; z < LOW + HZ / 2; z += .18) MOD.push([x, yc, z, 2]);
    const M = api.layer(MOD.length, { round: true, depth: true });
    MOD.forEach((m, i) => { M.p.set([m[0], m[1], m[2]], i * 3); M.c.set(m[3] === 2 ? [.86, .89, .94, .4] : m[3] ? [.8, .87, 1, .85] : [.42, .54, .74, .62], i * 4); M.s[i] = m[3] === 2 ? .06 : .1; });
    const R = 9, DOME = api.layer(api.small ? 900 : 1600, { round: true, add: true });
    for (let i = 0; i < DOME.n; i++){
      const u = (i + .5) / DOME.n, z = u, ph = i * 2.39996, r = Math.sqrt(1 - z * z);
      DOME.p.set([Math.cos(ph) * r * R, Math.sin(ph) * r * R, z * R], i * 3); DOME.c.set([.8, .85, .95, .07], i * 4); DOME.s[i] = .05;
    }
    // ── dynamic: rays from the probe ──
    const SEG = 12, RAYS = api.layer(NR * SEG + NR, { round: true, add: true });
    const PROBE = api.layer(1, { round: true, add: true });

    const spark = api.stage.querySelector('[data-spark]'), sx = spark && spark.getContext('2d');
    let lastK = -1;
    function plot(k){
      if (!sx || Math.abs(k - lastK) < .004) return; lastK = k;
      const w = spark.width = spark.clientWidth * 2, h = spark.height = spark.clientHeight * 2;
      const lo = Math.min(...CURVE, ...DOTS) - .02, hi = Math.max(...CURVE, ...DOTS) + .02, yv = (v) => h - 6 - (v - lo) / (hi - lo) * (h - 14);
      sx.clearRect(0, 0, w, h);
      sx.strokeStyle = 'rgba(255,255,255,.07)'; sx.lineWidth = 1;
      for (let i = 1; i < 4; i++){ sx.beginPath(); sx.moveTo(0, h * i / 4); sx.lineTo(w, h * i / 4); sx.stroke(); }
      sx.strokeStyle = 'rgba(61,187,126,.95)'; sx.lineWidth = 2.2; sx.beginPath();
      CURVE.forEach((v, i) => { const x = i / 100 * w; i ? sx.lineTo(x, yv(v)) : sx.moveTo(x, yv(v)); }); sx.stroke();
      sx.fillStyle = 'rgba(228,230,234,.85)';
      DOTS.forEach((v, i) => { sx.beginPath(); sx.arc(i / 20 * w, yv(v), 3, 0, 7); sx.fill(); });
      sx.strokeStyle = 'rgba(255,255,255,.55)'; sx.beginPath(); sx.moveTo(k * w, 0); sx.lineTo(k * w, h); sx.stroke();
    }

    api.cam = Object.assign(api.cam, { az: 1.18, el: 13, dist: api.small ? 34 : 27, tx: 0, ty: 0, tz: 3.4, fov: 38, shiftX: api.small ? 0 : .16, shift: api.small ? .04 : 0, sway: .08 });
    api.fog = [.9, 2.6];
    let phase = 0, frameN = 0;
    return function frame(t, dt, scroll){
      phase += api.reduce ? 0 : dt * .16;
      const k = api.reduce ? .35 : .5 - .5 * Math.cos(phase), y = Y0 + PITCH * k, o = [0, y, .02];
      api.cam.el = 13 + scroll * 14; api.cam.az = 1.18 + Math.sin(t / 9000) * .08;
      let open = 0, n = 0;
      for (let i = 0; i < NR; i++){
        const d = DIRS[i], th = hit(o, d), L = th > 0 ? th : R;
        if (th < 0) open++;
        for (let s = 0; s < SEG; s++){
          const f = (s + 1) / SEG * L, j = n++;
          RAYS.p[j * 3] = d[0] * f; RAYS.p[j * 3 + 1] = y + d[1] * f; RAYS.p[j * 3 + 2] = .02 + d[2] * f;
          if (th < 0){ RAYS.c[j * 4] = 1; RAYS.c[j * 4 + 1] = .93; RAYS.c[j * 4 + 2] = .78; RAYS.c[j * 4 + 3] = .5 * (1 - .8 * s / SEG); }
          else { RAYS.c[j * 4] = .45; RAYS.c[j * 4 + 1] = .58; RAYS.c[j * 4 + 2] = .82; RAYS.c[j * 4 + 3] = .34; }
          RAYS.s[j] = .05;
        }
        const j = n++;
        RAYS.p[j * 3] = d[0] * L; RAYS.p[j * 3 + 1] = y + d[1] * L; RAYS.p[j * 3 + 2] = .02 + d[2] * L;
        if (th < 0) RAYS.c.set([1, .95, .84, .7], j * 4); else RAYS.c.set([.95, .55, .48, .9], j * 4);
        RAYS.s[j] = th < 0 ? .09 : .11;
      }
      RAYS.dirty = true;
      PROBE.p.set([0, y, .05]); PROBE.c.set([.24, .73, .49, 1]); PROBE.s[0] = .55; PROBE.dirty = true;
      if (frameN++ % 5 === 0){
        api.readout('sky-x', (k * PITCH).toFixed(2) + ' m of ' + PITCH + ' m');
        api.readout('sky-cs', Fcs(y).toFixed(3));
        api.readout('sky-mc', (open / NR).toFixed(3));
        api.readout('sky-blk', (NR - open) + ' of ' + NR);
        plot(k);
      }
    };
  });
})();
