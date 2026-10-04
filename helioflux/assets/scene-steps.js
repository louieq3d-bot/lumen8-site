/* Product header: the eight steps of the studio, played on one site. Boundary, crop beds, the structure rising,
   the light computed and swept across the ground, the crop growing by the light it gets, a second design to compare,
   the plan view that goes into the dossier, and a sensor kit for monitoring. Geometry as on the home page
   (fixed overhead array, 4.8 m, 9 m pitch, GCR 0.30, 33.9° S, 21 March). An illustration of the flow; the screens
   below the header are the real studio. */
(function(){
  'use strict';
  const S = window.AGVScene, U = S.util;
  S.register('steps', function(api){
    const LAT = -33.9, H = 4.8, PITCH = 9, W2 = 1.35, AX = 20, BX = 25, BY = 18;
    const ROWS = [-13.5, -4.5, 4.5, 13.5];
    const inRow = (x, y, rows = ROWS, w2 = W2, ax = AX) => { if (Math.abs(x) > ax) return false; for (const r of rows) if (Math.abs(y - r) <= w2) return true; return false; };
    const HOURS = []; for (let h = 6.25; h < 18; h += .5){ const s = U.sun(h, 0, LAT), I = U.irr(s.u); if (I.b > 0) HOURS.push([s.e / s.u * H, s.n / s.u * H, I.b, I.d]); }
    const SKY = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++){ const u1 = (i + .5) / 6, ph = 2 * Math.PI * (j + .5 + i * .3) / 6, r = Math.sqrt(u1), dz = Math.sqrt(1 - u1); SKY.push([r * Math.cos(ph) * H / dz, r * Math.sin(ph) * H / dz]); }
    const light = (x, y, rows, w2) => {
      let o = 0; for (const d of SKY) if (!inRow(x + d[0], y + d[1], rows, w2)) o++; const svf = o / SKY.length;
      let num = 0, den = 0; for (const [kx, ky, b, d] of HOURS){ num += b * (inRow(x + kx, y + ky, rows, w2) ? 0 : 1) + d * svf; den += b + d; } return num / den;
    };
    const ROWS_B = [-12, 0, 12], W2_B = 1.35;          // the design to compare: 12 m pitch
    const rnd = U.rng(3);

    // ── layers ──
    const GS = api.small ? .9 : .6, ground = [];
    for (let y = -BY - 4; y <= BY + 4; y += GS) for (let x = -BX - 6; x <= BX + 6; x += GS){ const jx = x + (rnd() - .5) * GS * .4, jy = y + (rnd() - .5) * GS * .4; ground.push([jx, jy, light(jx, jy, ROWS, W2), light(jx, jy, ROWS_B, W2_B)]); }
    const G = api.layer(ground.length);
    ground.forEach((g, i) => { G.p.set([g[0], g[1], 0], i * 3); G.s[i] = GS * .5; });

    const perim = 2 * (2 * BX + 2 * BY), NB = api.small ? 700 : 1200;
    const BND = api.layer(NB + 4, { round: true, add: true });
    for (let i = 0; i < NB; i++){
      let d = i / NB * perim, p;
      if (d < 2 * BX) p = [-BX + d, -BY]; else if ((d -= 2 * BX) < 2 * BY) p = [BX, -BY + d]; else if ((d -= 2 * BY) < 2 * BX) p = [BX - d, BY]; else { d -= 2 * BX; p = [-BX, BY - d]; }
      BND.p.set([p[0], p[1], .05], i * 3); BND.s[i] = .14;
    }
    [[-BX, -BY], [BX, -BY], [BX, BY], [-BX, BY]].forEach((c, k) => { BND.p.set([c[0], c[1], .1], (NB + k) * 3); BND.s[NB + k] = .7; });

    const beds = [];
    for (let y = -BY + 1.2; y < BY - .6; y += 1.2) for (let x = -BX + 1; x < BX - .5; x += 1) beds.push([x + (rnd() - .5) * .2, y, light(x, y, ROWS, W2), .9 + rnd() * .2]);
    const CR = api.layer(beds.length, { round: true, depth: true });
    beds.forEach((b, i) => CR.p.set([b[0], b[1], .1], i * 3));

    const struct = [];
    const addTable = (yc, ghost) => {
      for (let i = 0; i < (api.small ? 500 : 900); i++){
        let a = rnd(), b = rnd(); const edge = i % 5 === 0; if (edge){ if (rnd() < .5) b = rnd() < .5 ? 0 : 1; else a = rnd() < .5 ? 0 : 1; }
        struct.push([-AX + 2 * AX * a, yc - W2 + 2 * W2 * b, H + .3 - .6 * b, ghost ? 3 : edge ? 1 : 0]);
      }
      for (let x = -AX; x <= AX + 1e-6; x += 6.67) for (let z = 0; z < H; z += .2) struct.push([x, yc, z, ghost ? 3 : 2]);
    };
    ROWS.forEach(yc => addTable(yc, false)); ROWS_B.forEach(yc => addTable(yc, true));
    const ST = api.layer(struct.length, { round: true, depth: true });
    const COL = [[.45, .57, .78, .85], [.85, .9, 1, 1], [.86, .89, .94, .55], [.24, .73, .49, .9]];
    struct.forEach((s, i) => { ST.s[i] = s[3] === 2 ? .07 : s[3] === 3 ? .15 : .2; });

    const FRAME = [], fw = BX + 5, fh = BY + 5;
    for (let i = 0; i < 900; i++){ const t = i / 900 * 4; let p; if (t < 1) p = [-fw + 2 * fw * t, -fh]; else if (t < 2) p = [fw, -fh + 2 * fh * (t - 1)]; else if (t < 3) p = [fw - 2 * fw * (t - 2), fh]; else p = [-fw, fh - 2 * fh * (t - 3)]; FRAME.push([p[0], p[1], .2]); }
    for (let x = -fw; x <= fw; x += 2.5) for (let k = 0; k < 6; k++) FRAME.push([x, -fh - k * .15, .2]);
    const FR = api.layer(FRAME.length, { round: true, add: true });
    FRAME.forEach((p, i) => { FR.p.set(p, i * 3); FR.s[i] = .12; });

    const SENS = [[0, -4.5 - 3, 'under'], [0, 0, 'between'], [BX + 3, 0, 'open']], SN = [];
    SENS.forEach(([x, y]) => { for (let z = 0; z < 2.2; z += .08) SN.push([x, y, z, 0]); SN.push([x, y, 2.3, 1]); });
    const SE = api.layer(SN.length, { round: true, add: true });
    SN.forEach((p, i) => { SE.p.set([p[0], p[1], p[2]], i * 3); SE.s[i] = p[3] ? .5 : .07; });

    // ── state ──
    const KEYS = [   // azimuth, elevation°, distance, target z
      [.25, 56, 78, 0], [.45, 40, 70, 0], [.7, 24, 64, 2], [.85, 32, 68, 1], [1.05, 17, 52, 1.2], [1.25, 30, 70, 1], [0, 87, 84, 0], [.55, 15, 48, 1.4],
    ];
    const steps = [...api.stage.querySelectorAll('[data-step]')], bar = api.stage.querySelector('[data-step-bar]');
    let step = 0, P = 0, hold = 0, paused = false;
    const HOLD = 3.4;
    steps.forEach((li, i) => { const b = li.querySelector('button'); if (b) b.addEventListener('click', () => { step = i; hold = 0; paused = true; }); });
    const meanArray = (() => { let s = 0, n = 0; for (const g of ground) if (Math.abs(g[0]) < AX - 4 && Math.abs(g[1]) < 14){ s += g[2]; n++; } return s / n; })();
    const meanB = (() => { let s = 0, n = 0; for (const g of ground) if (Math.abs(g[0]) < AX - 4 && Math.abs(g[1]) < 14){ s += g[3]; n++; } return s / n; })();
    const cl = (v) => Math.max(0, Math.min(1, v));
    const bump = (c) => cl(1 - Math.abs(P - c) * 1.3);
    api.cam = Object.assign(api.cam, { az: .25, el: 56, dist: 78, fov: 34, shiftX: api.small ? 0 : .14, shift: api.small ? .04 : 0, sway: .1 });
    api.fog = [.8, 2.2];
    let frameN = 0;
    return function frame(t, dt, scroll){
      if (api.reduce){ step = 4; P = 4; }
      else {
        if (!paused){ hold += dt; if (hold > HOLD){ hold = 0; step = (step + 1) % 8; } }
        P += (step - P) * Math.min(1, dt * (step === 0 && P > 1 ? 1.4 : 2.2));
      }
      const i0 = Math.min(6, Math.floor(P)), f = U.ease(cl(P - i0)), A = KEYS[i0], B = KEYS[i0 + 1];
      api.cam.az = A[0] + (B[0] - A[0]) * f + Math.sin(t / 12000) * .05;
      api.cam.el = A[1] + (B[1] - A[1]) * f - scroll * 8;
      api.cam.dist = (A[2] + (B[2] - A[2]) * f) * (api.small ? 1.2 : 1) * (1 + scroll * .2);
      api.cam.tz = A[3] + (B[3] - A[3]) * f;

      const draw = cl(P * 1.3 + .25), bedA = cl(P - .6), rise = U.ease(cl(P - 1.55)), lit = cl(P - 2.5), grow = cl(P - 3.5), cmp = bump(5), plan = bump(6), sens = cl((P - 6.4) * 2);
      const sweep = lit * 1.25;
      for (let i = 0; i < ground.length; i++){
        const g = ground[i], k = cl((sweep - (g[0] + BX + 6) / (2 * BX + 12)) * 6), v = g[2] + (g[3] - g[2]) * cmp * .999;
        const c = U.ramp(v), band = Math.exp(-Math.pow(((g[0] + BX + 6) / (2 * BX + 12) - sweep) * 14, 2)) * (lit > 0 && lit < 1 ? 1 : 0);
        G.c[i * 4] = .3 + (c[0] - .3) * k + band * .3; G.c[i * 4 + 1] = .33 + (c[1] - .33) * k + band * .5; G.c[i * 4 + 2] = .38 + (c[2] - .38) * k;
        G.c[i * 4 + 3] = (.16 + (.3 + .45 * v - .16) * k + band * .3) * (1 - plan * .3);
      }
      G.dirty = true;
      for (let i = 0; i < NB; i++){ const on = i / NB < draw ? 1 : 0; BND.c.set([.24, .73, .49, on * (.65 - .35 * cl(P - 2))], i * 4); }
      for (let k = 0; k < 4; k++) BND.c.set([.24, .73, .49, draw > k / 4 ? .9 - .5 * cl(P - 2) : 0], (NB + k) * 4);
      BND.dirty = true;
      for (let i = 0; i < beds.length; i++){
        const b = beds[i], g = grow * cl((b[2] * b[3] - .35) / .65);
        CR.c.set([.71 - .45 * g, .88 - .3 * g, .29, bedA * (.45 + .45 * g)], i * 4);
        CR.s[i] = (.12 + .5 * g * g) * bedA; CR.p[i * 3 + 2] = .08 + .45 * g * g;
      }
      CR.dirty = true;
      for (let i = 0; i < struct.length; i++){
        const s = struct[i], ghost = s[3] === 3, c = COL[s[3]];
        ST.p[i * 3] = s[0]; ST.p[i * 3 + 1] = s[1]; ST.p[i * 3 + 2] = ghost ? s[2] : s[2] * rise;
        ST.c[i * 4] = c[0]; ST.c[i * 4 + 1] = c[1]; ST.c[i * 4 + 2] = c[2]; ST.c[i * 4 + 3] = ghost ? c[3] * cmp : c[3] * cl(rise * 3) * (1 - cmp * .7);
      }
      ST.dirty = true;
      for (let i = 0; i < FRAME.length; i++) FR.c.set([.9, .92, .96, plan * .5], i * 4); FR.dirty = true;
      const pulse = .6 + .4 * Math.sin(t / 300);
      for (let i = 0; i < SN.length; i++) SE.c.set(SN[i][3] ? [.24, .73, .49, sens * pulse] : [.86, .89, .94, sens * .7], i * 4); SE.dirty = true;

      steps.forEach((li, i) => { li.classList.toggle('is-on', i === step); li.classList.toggle('is-done', i < step); });
      if (bar) bar.style.transform = 'scaleX(' + ((step + (paused ? 1 : hold / HOLD)) / 8).toFixed(4) + ')';
      if (frameN++ % 8 === 0){
        api.readout('st-light', lit > .9 ? Math.round((cmp > .5 ? meanB : meanArray) * 100) + '% of open' : '—');
        api.readout('st-design', cmp > .5 ? '12 m pitch' : '9 m pitch');
      }
    };
  });
})();
