/* Pricing header: one seat, many sites. A single seat sits above a plain of sites of different sizes and runs them one
   after another. For each run a stream of points leaves the seat and lands on the site, the module rows rise, the light
   under them is cast (shadow rays over 21 March at 33.9° S, as on the home page) and swept across the ground, and the
   crop grows by the light each plant gets. Sites already run stay built. Illustrative: the price follows the people, not
   the land. */
(function(){
  'use strict';
  const S = window.AGVScene, U = S.util;
  S.register('sites', function(api){
    const LAT = -33.9, H = 4.2, rnd = U.rng(21), small = api.small;
    // ── sites on a loose ring around the seat ──
    const NS = small ? 16 : 26, sites = [];
    for (let i = 0; i < NS; i++){
      const ang = i * 2.39996 + .4, rad = 26 + Math.sqrt(i / NS) * (small ? 58 : 82) + (rnd() - .5) * 10;
      const w = 14 + rnd() * 18, h = 10 + rnd() * 12, pitch = 7 + rnd() * 4, gcr = .26 + rnd() * .12;
      sites.push({ cx: Math.cos(ang) * rad, cy: Math.sin(ang) * rad * .82, w, h, pitch, w2: pitch * gcr / 2, rad });
    }
    sites.sort((a, b) => a.rad - b.rad);
    sites.forEach((s, k) => {
      s.k = k; s.rows = [];
      for (let y = -s.h / 2 + s.pitch * .5; y < s.h / 2 - 1; y += s.pitch) s.rows.push(y);
    });
    const inRows = (s, x, y) => { if (Math.abs(x) > s.w / 2 - 1) return false; for (const r of s.rows) if (Math.abs(y - r) <= s.w2) return true; return false; };
    const HOURS = []; for (let h = 6.5; h < 18; h += .75){ const sv = U.sun(h, 0, LAT), I = U.irr(sv.u); if (I.b > 0) HOURS.push([sv.e / sv.u * H, sv.n / sv.u * H, I.b, I.d]); }
    const light = (s, x, y) => { let num = 0, den = 0; for (const [kx, ky, b, d] of HOURS){ num += b * (inRows(s, x + kx, y + ky) ? 0 : 1) + d * .72; den += b + d; } return num / den; };

    // ── ground, crops, structure for every site ──
    const G = [], C = [], T = [];
    const gs = small ? 1 : .75;
    sites.forEach((s, si) => {
      for (let y = -s.h / 2; y <= s.h / 2 + 1e-6; y += gs) for (let x = -s.w / 2; x <= s.w / 2 + 1e-6; x += gs){
        const edge = Math.abs(x) > s.w / 2 - gs * .9 || Math.abs(y) > s.h / 2 - gs * .9;
        G.push([s.cx + x, s.cy + y, si, light(s, x, y), edge ? 1 : 0, (x + s.w / 2) / s.w]);
        if (!edge && Math.round((y + s.h / 2) / gs) % 2 === 0 && Math.round((x + s.w / 2) / gs) % 2 === 0) C.push([s.cx + x, s.cy + y, si, light(s, x, y), .9 + rnd() * .2]);
      }
      for (const r of s.rows){
        for (let x = -s.w / 2 + 1; x <= s.w / 2 - 1; x += small ? .45 : .32) for (const b of [0, .25, .5, .75, 1]) T.push([s.cx + x, s.cy + r - s.w2 + 2 * s.w2 * b, H + .25 - .5 * b, si, b === 0 || b === 1 ? 1 : 0]);
        for (let x = -s.w / 2 + 1; x <= s.w / 2 - 1 + 1e-6; x += 5) for (let z = 0; z < H; z += .3) T.push([s.cx + x, s.cy + r, z, si, 2]);
      }
    });
    const LG = api.layer(G.length), LC = api.layer(C.length, { round: true, depth: true }), LT = api.layer(T.length, { round: true, depth: true });
    G.forEach((g, i) => { LG.p.set([g[0], g[1], 0], i * 3); LG.s[i] = g[4] ? .32 : gs * .55; });
    C.forEach((c, i) => LC.p.set([c[0], c[1], .1], i * 3));

    // ── the plain: a faint survey grid out to the horizon ──
    const grid = [];
    for (let x = -170; x <= 170; x += 10) for (let y = -150; y <= 150; y += 1.6) grid.push([x, y]);
    for (let y = -150; y <= 150; y += 10) for (let x = -170; x <= 170; x += 1.6) grid.push([x, y]);
    const LGR = api.layer(grid.length, { add: true });
    grid.forEach((g, i) => { LGR.p.set([g[0], g[1], -.05], i * 3); LGR.c.set([.75, .78, .82, .05], i * 4); LGR.s[i] = .14; });

    // ── the seat: a ring and a core above the centre ──
    const SEAT_Z = 22, ring = [];
    for (let i = 0; i < 160; i++){ const a = i / 160 * Math.PI * 2; ring.push([Math.cos(a) * 3.2, Math.sin(a) * 3.2, SEAT_Z]); }
    for (let i = 0; i < 90; i++){ const a = i / 90 * Math.PI * 2; ring.push([Math.cos(a) * 5.6, Math.sin(a) * 5.6, SEAT_Z - .4]); }
    for (let z = 0; z < SEAT_Z; z += .5) ring.push([0, 0, z]);
    const LR = api.layer(ring.length + 1, { round: true, add: true });
    ring.forEach((r, i) => { LR.p.set(r, i * 3); LR.s[i] = i < 250 ? .16 : .08; });
    LR.p.set([0, 0, SEAT_Z], ring.length * 3); LR.s[ring.length] = 1.6;

    // ── streams from the seat to the sites being run ──
    const NSTREAM = 3, PER = 70, LS = api.layer(NSTREAM * PER, { round: true, add: true });
    const arc = (s, t) => [s.cx * t, s.cy * t, SEAT_Z * (1 - t) + Math.sin(Math.PI * t) * 9];

    // ── a light curtain that sweeps each site as its light is cast ──
    const CUR_Y = small ? 24 : 34, CUR_Z = 9, LCU = api.layer(NSTREAM * CUR_Y * CUR_Z, { round: true, add: true });
    // ── timing: a new site every STEP seconds; each run takes RUN seconds ──
    const STEP = small ? 1.1 : .9, RUN = 2.6, HOLD = 4, FADE = 1.6;
    const total = NS * STEP + RUN + HOLD + FADE;
    let clock = 0, frameN = 0;
    const cl = (v) => Math.max(0, Math.min(1, v));
    api.readout('s-total', String(NS));
    api.cam = Object.assign(api.cam, { az: .3, el: 21, dist: small ? 170 : 112, tx: 0, ty: -6, tz: 3, fov: 32, shiftX: small ? 0 : .16, shift: small ? .04 : -.02, sway: .1 });
    api.fog = [.62, 1.55];
    return function frame(t, dt, scroll){
      clock = api.reduce ? NS * STEP + RUN : (clock + dt) % total;
      const fade = clock > total - FADE ? cl((total - clock) / FADE) : 1;
      api.cam.az = .3 + t / 1000 * .018; api.cam.el = 21 - scroll * 8 + Math.sin(t / 13000) * 3;
      let done = 0, plants = 0;
      for (const s of sites){ s.p = cl((clock - s.k * STEP) / RUN) * fade; if (s.p >= .999) done++; }
      for (let i = 0; i < G.length; i++){
        const g = G[i], s = sites[g[2]], sweep = cl((s.p - .35) / .5), k = cl((sweep * 1.15 - g[5]) * 5);
        const c = U.ramp(g[3]), band = sweep > 0 && sweep < 1 ? Math.exp(-Math.pow((g[5] - sweep * 1.15) * 9, 2)) : 0;
        if (g[4]){ const fl = Math.exp(-Math.pow((s.p - .5) * 7, 2)); LG.c[i * 4] = .24 + .6 * fl; LG.c[i * 4 + 1] = .73 + .25 * fl; LG.c[i * 4 + 2] = .49 + .4 * fl; LG.c[i * 4 + 3] = .22 + .6 * cl(s.p * 4) + fl * .3; }
        else {
          LG.c[i * 4] = .25 + (c[0] - .25) * k + band * .05; LG.c[i * 4 + 1] = .3 + (c[1] - .3) * k + band * .5; LG.c[i * 4 + 2] = .28 + (c[2] - .28) * k + band * .2;
          LG.c[i * 4 + 3] = .14 + (.32 + .55 * g[3]) * k + band * .4;
        }
      }
      LG.dirty = true;
      for (let i = 0; i < C.length; i++){
        const c = C[i], s = sites[c[2]], g = cl((s.p - .7) / .3) * cl((c[3] * c[4] - .3) / .7);
        LC.c.set([.6 - .45 * g, .86 - .38 * g, .5 - .22 * g, cl((s.p - .55) * 5) * (.4 + .5 * g)], i * 4);
        LC.s[i] = .12 + .7 * g * g; LC.p[i * 3 + 2] = .08 + .5 * g * g;
        if (s.p >= .999) plants++;
      }
      LC.dirty = true;
      for (let i = 0; i < T.length; i++){
        const q = T[i], s = sites[q[3]], rise = U.ease(cl((s.p - .12) / .3));
        LT.p[i * 3] = q[0]; LT.p[i * 3 + 1] = q[1]; LT.p[i * 3 + 2] = q[2] * rise;
        const a = cl(rise * 3) * (q[4] === 2 ? .5 : q[4] ? .9 : .6);
        if (q[4] === 2) LT.c.set([.86, .9, .88, a], i * 4); else LT.c.set(q[4] ? [.78, .86, 1, a] : [.46, .58, .82, a], i * 4);
        LT.s[i] = q[4] === 2 ? .08 : .24;
      }
      LT.dirty = true;
      const live = sites.filter(s => s.p > 0 && s.p < .5).slice(-NSTREAM);
      for (let j = 0; j < NSTREAM; j++){
        const s = live[j];
        for (let k = 0; k < PER; k++){
          const idx = j * PER + k;
          if (!s){ LS.c[idx * 4 + 3] = 0; continue; }
          const tk = k / PER, t1 = s.p / .5 - tk * .35;
          if (t1 < 0 || t1 > 1){ LS.c[idx * 4 + 3] = 0; continue; }
          LS.p.set(arc(s, t1), idx * 3); LS.c.set([.24 + .62 * (1 - tk), .73 + .22 * (1 - tk), .49 + .38 * (1 - tk), (1 - tk) * .9], idx * 4); LS.s[idx] = .5 * (1 - tk * .6);
        }
      }
      LS.dirty = true;
      const sweeping = sites.filter(s => s.p > .35 && s.p < .85).slice(-NSTREAM);
      for (let j = 0; j < NSTREAM; j++){
        const s = sweeping[j];
        for (let a = 0; a < CUR_Y; a++) for (let b = 0; b < CUR_Z; b++){
          const idx = (j * CUR_Y + a) * CUR_Z + b;
          if (!s){ LCU.c[idx * 4 + 3] = 0; continue; }
          const sw = cl((s.p - .35) / .5) * 1.15, x = s.cx - s.w / 2 + Math.min(1, sw) * s.w, y = s.cy - s.h / 2 + (a + .5) / CUR_Y * s.h, z = b / (CUR_Z - 1) * (H + 2.2);
          LCU.p.set([x, y, z], idx * 3); LCU.c.set([.4, .85, .6, (1 - b / CUR_Z) * .55 * Math.sin(Math.PI * Math.min(1, sw))], idx * 4); LCU.s[idx] = .22;
        }
      }
      LCU.dirty = true;
      const pulse = .75 + .25 * Math.sin(t / 420);
      for (let i = 0; i < ring.length; i++) LR.c.set(i < 250 ? [.24, .73, .49, .55 * pulse] : [.75, .78, .82, .18], i * 4);
      LR.c.set([.93, .95, .92, .95], ring.length * 4); LR.dirty = true;
      if (frameN++ % 6 === 0){ api.readout('s-run', String(done)); api.readout('s-plants', plants.toLocaleString('en-US')); }
    };
  });
})();
