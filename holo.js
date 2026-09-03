/* holo.js — holographic isometric renderer for Lumen8 illustrations.
   Every illustration on the site is a live 3D wire scene drawn on a 2D canvas:
   glowing lines, boxes and particles projected with a slow orbit and mouse tilt.
   Usage: <canvas data-holo="village"></canvas>; Holo.setStep(canvas, i) gates layers. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = { cyan: '#22d3ee', cyan2: '#67e8f9', amber: '#f5b21b', amber2: '#fcd34d', violet: '#a78bfa', green: '#34d399', rose: '#fb7185', ink: '#eaf0f8', dim: 'rgba(255,255,255,.18)' };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
  const rnd = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

  /* ---------- primitives ---------- */
  const box = (x, y, z, w, h, d, color, o) => Object.assign({ type: 'box', x, y, z, w, h, d, color }, o || {});
  const line = (pts, color, o) => Object.assign({ type: 'line', pts, color }, o || {});
  const poly = (pts, color, o) => Object.assign({ type: 'poly', pts, color }, o || {});
  const pts = (list, color, o) => Object.assign({ type: 'points', pts: list, color }, o || {});
  const ring = (x, z, r, color, o) => Object.assign({ type: 'ring', x, z, r, color }, o || {});
  const beam = (x, z, h, color, o) => Object.assign({ type: 'beam', x, z, h, color }, o || {});
  const flow = (path, color, o) => Object.assign({ type: 'flow', pts: path, color }, o || {});
  const grid = (size, step, color, o) => Object.assign({ type: 'grid', size, step, color }, o || {});
  const label = (x, y, z, text, color) => ({ type: 'label', x, y, z, text, color });
  const house = (x, z, r, s) => {
    const w = 8 + r() * 5, d = 7 + r() * 5, h = 4 + r() * 2, a = r() * Math.PI;
    return [box(x, 0, z, w, h, d, C.ink, { fill: 'rgba(234,240,248,.10)', alpha: .8, rot: a }),
            poly([[x - w / 2, h, z - d / 2], [x + w / 2, h, z - d / 2], [x, h + 3, z]], C.ink, { fill: 'rgba(234,240,248,.16)', rot: a, cx: x, cz: z }),
            poly([[x - w / 2, h, z + d / 2], [x + w / 2, h, z + d / 2], [x, h + 3, z]], C.ink, { fill: 'rgba(234,240,248,.08)', rot: a, cx: x, cz: z })];
  };
  const pvBlock = (x0, z0, rows, cols, color, o) => {
    const out = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++)
      out.push(box(x0 + j * 9, 1.2, z0 + i * 6, 8, .6, 3.2, color, Object.assign({ fill: rgba(color, .35), alpha: .95 }, o || {})));
    return out;
  };
  const bars = (x, z, vals, color) => vals.map((v, i) => box(x + i * 7, 0, z, 4.5, v, 4.5, color, { fill: rgba(color, .35), grow: i }));
  const docs = (x, z) => [box(x, 0, z, 16, .8, 22, C.ink, { fill: 'rgba(11,16,32,.9)' }), box(x + 2, 1, z - 2, 16, .8, 22, C.ink, { fill: 'rgba(11,16,32,.9)' }),
    box(x + 4, 2, z - 4, 16, .8, 22, C.cyan2, { fill: 'rgba(14,20,40,.95)' }), line([[x - 1, 3, z - 12], [x + 9, 3, z - 12]], C.cyan2, { width: 1.5 }),
    line([[x - 1, 3, z - 8], [x + 9, 3, z - 8]], C.cyan2, { width: 1.5 }), line([[x - 1, 3, z - 4], [x + 5, 3, z - 4]], C.cyan2, { width: 1.5 }), ring(x + 7, z + 4, 2, C.green, { fill: true })];

  /* ---------- scenes: arrays of layers ---------- */
  const S = {};
  S.village = () => { const r = rnd(7); const L = [grid(120, 12, C.dim, { alpha: .5 })]; const hs = [];
    for (let i = 0; i < 18; i++) { const a = r() * 6.28, d = 16 + r() * 50; hs.push([Math.cos(a) * d, Math.sin(a) * d * .7]); }
    hs.forEach(([x, z]) => L.push(...house(x, z, r)));
    L.push(...pvBlock(38, 22, 3, 3, C.amber));
    const lv = hs.map(([x, z]) => [[46, 6, 28], [x, 5, z]]);
    lv.forEach((p) => L.push(line(p, C.cyan2, { alpha: .55 }), flow(p, C.amber2, { n: 1, speed: .35 })));
    L.push(beam(0, 0, 60, C.amber), ring(0, 0, 8, C.amber, { pulse: 1 }), ring(0, 0, 20, C.amber, { pulse: 2 }));
    return [{ items: L }]; };
  S.plant = () => { const L = [grid(140, 10, C.dim, { alpha: .45 })];
    for (let bx = 0; bx < 3; bx++) for (let bz = 0; bz < 2; bz++) L.push(...pvBlock(-60 + bx * 42, -34 + bz * 38, 5, 4, C.amber));
    L.push(line([[-70, .3, -44], [66, .3, -44], [66, .3, 40], [-70, .3, 40], [-70, .3, -44]], C.amber2, { dash: 1, alpha: .6 }));
    L.push(line([[-70, .4, 0], [66, .4, 0]], C.dim, { width: 3 }), line([[0, .4, -44], [0, .4, 40]], C.dim, { width: 3 }));
    L.push(box(52, 0, 46, 14, 8, 10, C.cyan2, { fill: 'rgba(34,211,238,.18)' }), box(30, 0, 47, 10, 5, 7, C.cyan2, { fill: 'rgba(34,211,238,.12)' }));
    const mv = [[59, 8, 46], [80, 30, 20], [100, 44, -10]];
    L.push(line(mv, C.cyan, { width: 1.5 }), flow(mv, C.cyan2, { n: 4, speed: .5 }), line([[100, 0, -10], [100, 48, -10]], C.ink, { alpha: .7 }), line([[92, 40, -10], [108, 40, -10]], C.ink, { alpha: .7 }), line([[94, 46, -10], [106, 46, -10]], C.ink, { alpha: .7 }));
    L.push(label(52, 14, 46, 'SUBSTATION', C.cyan2), label(-60, 10, -40, '6,492 ROWS', C.amber2));
    return [{ items: L }]; };
  S.port = () => { const L = [];
    L.push(poly([[-90, 0, -60], [90, 0, -60], [90, 0, 60], [-90, 0, 60]], C.cyan, { fill: 'rgba(34,211,238,.06)', alpha: .5 }));
    for (let i = 0; i < 6; i++) L.push(line([[-90, .2, -50 + i * 20], [90, .2, -50 + i * 20]], C.cyan, { alpha: .18, wave: i }));
    L.push(box(0, 0, -40, 180, 6, 40, C.ink, { fill: 'rgba(234,240,248,.07)' }));
    [-50, -10, 30].forEach((x) => L.push(line([[x - 8, 6, -30], [x - 8, 44, -30], [x + 8, 44, -30], [x + 8, 6, -30]], C.cyan2, { width: 1.5 }), line([[x - 8, 44, -30], [x - 8, 44, 10], [x + 8, 44, 10], [x + 8, 44, -30]], C.cyan2, { width: 1.5 }), line([[x - 8, 44, 10], [x - 8, 20, 10]], C.cyan2, { alpha: .6 })));
    L.push(poly([[-70, 3, -12], [60, 3, -12], [75, 3, 4], [60, 3, 20], [-70, 3, 20], [-80, 3, 4]], C.ink, { fill: 'rgba(11,16,32,.9)' }));
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) L.push(box(-58 + i * 14, 3, -6 + j * 12, 11, 4, 8, [C.amber, C.rose, C.green, C.violet][(i + j) % 4], { fill: rgba([C.amber, C.rose, C.green, C.violet][(i + j) % 4], .45) }));
    L.push(box(62, 3, 4, 12, 12, 14, C.ink, { fill: 'rgba(234,240,248,.12)' }));
    L.push(box(-80, 6, -56, 12, 10, 10, C.cyan2, { fill: 'rgba(34,211,238,.18)' }), beam(-74, -51, 40, C.cyan));
    const cable = [[-74, 10, -46], [-40, 8, -20], [-30, 6, -8]];
    L.push(line(cable, C.amber2, { width: 1.5 }), flow(cable, C.amber2, { n: 3, speed: .5 }), label(-74, 20, -56, '6.6 kV SHORE POWER', C.cyan2));
    return [{ items: L }]; };
  S.tower = () => { const L = [grid(110, 11, C.dim, { alpha: .4 })];
    const legs = [[-10, 0, -10], [10, 0, -10], [10, 0, 10], [-10, 0, 10]];
    legs.forEach((p, i) => { L.push(line([p, [p[0] * .25, 70, p[2] * .25]], C.rose, { width: 1.5 })); const q = legs[(i + 1) % 4]; for (let k = 1; k < 6; k++) { const t = k / 6, s = 1 - t * .75; L.push(line([[p[0] * s, 70 * t, p[2] * s], [q[0] * s, 70 * t, q[2] * s]], C.rose, { alpha: .7 })); } });
    L.push(line([[0, 70, 0], [0, 84, 0]], C.rose, { width: 2 }), ring(0, 0, 14, C.rose, { pulse: 1, y: 82 }), ring(0, 0, 26, C.rose, { pulse: 2, y: 82 }), ring(0, 0, 38, C.rose, { pulse: 3, y: 82 }));
    L.push(...pvBlock(-62, 10, 3, 3, C.amber), box(40, 0, 20, 14, 10, 14, C.rose, { fill: 'rgba(251,113,133,.15)' }), label(40, 14, 20, 'DIESEL -82%', C.rose));
    const c = [[-38, 2, 18], [-12, 2, 12]]; L.push(line(c, C.amber2), flow(c, C.amber2, { n: 2, speed: .5 }), box(-6, 0, 16, 10, 6, 8, C.cyan2, { fill: 'rgba(34,211,238,.15)' }));
    return [{ items: L }]; };
  S.fields = () => { const r = rnd(3); const L = []; const cols = [C.green, C.amber, C.cyan, C.green, C.violet];
    for (let i = -3; i < 3; i++) for (let j = -2; j < 2; j++) { const x = i * 30 + r() * 6, z = j * 34 + r() * 6, c = cols[(i * 5 + j + 20) % 5];
      L.push(poly([[x, 0, z], [x + 26 + r() * 6, 0, z + r() * 6], [x + 24, 0, z + 28 + r() * 6], [x - r() * 4, 0, z + 30]], c, { fill: rgba(c, .16 + r() * .12), alpha: .85 }));
      if (r() > .55) for (let k = 0; k < 5; k++) L.push(line([[x + 2, .3, z + 4 + k * 5], [x + 22, .3, z + 4 + k * 5]], c, { alpha: .35 })); }
    L.push(...pvBlock(-20, -14, 2, 3, C.amber), box(28, 0, -6, 8, 6, 8, C.cyan2, { fill: 'rgba(34,211,238,.18)' }), beam(32, -2, 30, C.cyan));
    const p = [[4, 2, -8], [28, 2, -4]]; L.push(line(p, C.amber2), flow(p, C.amber2, { n: 2, speed: .5 }), label(28, 12, -6, 'PUMP 18 kW', C.cyan2));
    L.push(ring(-60, 40, 6, C.amber2, { fill: true, y: 60 }), ring(-60, 40, 10, C.amber2, { pulse: 1, y: 60 }));
    return [{ items: L }]; };
  S.graph = () => { const r = rnd(11); const L = []; const strata = [[C.rose, 14, 5, 60], [C.green, 28, 22, 44], [C.amber, 40, 30, 30], [C.cyan2, 56, 46, 16], [C.violet, 74, 64, 2]];
    const nodes = [];
    strata.forEach(([c, rad, n, y]) => { for (let i = 0; i < n; i++) { const a = r() * 6.28, d = rad * (.4 + r() * .6); nodes.push({ p: [Math.cos(a) * d, y, Math.sin(a) * d], c }); } L.push(ring(0, 0, rad + 8, c, { alpha: .25, y })); });
    for (let i = 0; i < 90; i++) { const a = nodes[(r() * nodes.length) | 0], b = nodes[(r() * nodes.length) | 0]; if (a !== b && Math.abs(a.p[1] - b.p[1]) < 30) L.push(line([a.p, b.p], a.c, { alpha: .22 })); }
    strata.forEach(([c]) => L.push(pts(nodes.filter((n) => n.c === c).map((n) => n.p), c, { r: 2.2, twinkle: 1 })));
    L.push(label(-70, 66, 0, 'INSTITUTION', C.rose), label(40, 6, 40, 'HOUSEHOLD', C.violet));
    return [{ items: L, spin: .35 }]; };
  S.geo = () => { const L = []; const lay = [[0, C.ink, .05], [-18, C.amber, .08], [-40, C.rose, .12], [-64, C.rose, .18]];
    lay.forEach(([y, c, a], i) => { const h = i < 3 ? (lay[i + 1][0] - y) : -22; L.push(box(0, y + h, 0, 170, -h, 90, c, { fill: rgba(c, a), alpha: .6 })); });
    L.push(line([[-85, 0, 45], [-40, 4, 45], [10, -2, 45], [50, 6, 45], [85, 0, 45]], C.ink, { alpha: .6, width: 1.5 }));
    [-30, 32].forEach((x) => L.push(line([[x, 2, 44], [x, -60, 44]], C.ink, { width: 2 }), box(x, 2, 44, 8, 4, 6, C.amber2, { fill: 'rgba(11,16,32,.9)' }), ring(x, 44, 3, C.amber, { pulse: 1, y: -60 })));
    for (let i = 0; i < 14; i++) L.push(flow([[(i - 7) * 8, -86, 44], [(i - 7) * 6, -20, 44]], i % 2 ? C.rose : C.amber, { n: 1, speed: .25 + (i % 3) * .1, r: 1.6 }));
    L.push(...bars(-70, -30, [10, 22, 34], C.amber), label(-70, 40, -30, 'P90  P50  P10', C.amber2), label(-80, 12, 45, 'PLAY FAIRWAY 0.74', C.amber2));
    return [{ items: L, pitch: .35 }]; };
  S.nodes = () => { const L = []; const hex = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; hex.push([Math.cos(a) * 50, 8 + (i % 2) * 10, Math.sin(a) * 50]); }
    hex.forEach((p, i) => { L.push(line([p, hex[(i + 1) % 6]], C.violet, { alpha: .5 }), line([p, [0, 20, 0]], C.violet, { alpha: .3 }), beam(p[0], p[2], p[1], C.violet, { alpha: .35 })); });
    L.push(pts(hex, C.violet, { r: 3.5, twinkle: 1 }), ring(0, 0, 60, C.violet, { alpha: .35 }), ring(0, 0, 14, C.violet, { pulse: 1, y: 20 }), pts([[0, 20, 0]], '#c4b5fd', { r: 5 }), grid(120, 15, C.dim, { alpha: .3 }));
    return [{ items: L }]; };
  S['pipe-home'] = () => { const r = rnd(5); const L0 = [grid(130, 13, C.dim, { alpha: .45 }), beam(0, 0, 70, C.amber), ring(0, 0, 10, C.amber, { pulse: 1 }), ring(0, 0, 26, C.amber, { pulse: 2 }), ring(0, 0, 44, C.amber, { pulse: 3 }), label(6, 30, 0, '-8.6427, 120.0132', C.amber2)];
    const L1 = []; for (let k = 0; k < 5; k++) { const p = []; for (let i = 0; i <= 12; i++) p.push([-70 + i * 12, .2, -50 + k * 22 + Math.sin(i * .7 + k) * 7]); L1.push(line(p, C.cyan2, { alpha: .35 })); }
    const b = []; for (let i = 0; i < 26; i++) b.push([-40 + r() * 80, 1, -40 + r() * 80]); L1.push(pts(b, C.cyan2, { r: 2.2 }), ring(0, 0, 62, C.cyan, { sweep: 1 }));
    const L2 = [...pvBlock(-56, -46, 4, 3, C.amber)]; b.slice(0, 9).forEach((p) => L2.push(line([[-42, 4, -36], p], C.cyan2, { alpha: .45 }), flow([[-42, 4, -36], p], C.amber2, { n: 1, speed: .4 })));
    const L3 = [...bars(30, 40, [8, 14, 22, 30, 40], C.green), line([[26, 12, 34], [40, 18, 34], [52, 30, 34], [64, 44, 34]], C.green, { width: 1.5 }), label(26, 50, 34, 'IRR · NPV · LCOE', '#6ee7b7')];
    const L4 = [...docs(-40, 40)];
    return [{ items: L0 }, { items: L1 }, { items: L2 }, { items: L3 }, { items: L4 }]; };
  S['pipe-rural'] = () => { const r = rnd(9); const c = []; for (let i = 0; i < 80; i++) c.push([-70 + r() * 140, .5, -50 + r() * 100]);
    const L0 = [grid(150, 15, C.dim, { alpha: .4 }), pts(c, C.cyan2, { r: 1.8, twinkle: 1 }), pts([[0, 1, 0], [-40, 1, 20], [50, 1, -20]], C.amber, { r: 4, twinkle: 1 }), beam(0, 0, 50, C.amber), label(6, 22, 0, 'TIER A · 481 HH', C.amber2)];
    const L1 = []; const hs = []; for (let i = 0; i < 14; i++) { const a = r() * 6.28, d = 16 + r() * 52; hs.push([Math.cos(a) * d, Math.sin(a) * d * .7]); } hs.forEach(([x, z]) => L1.push(...house(x, z, r)));
    hs.forEach(([x, z]) => L1.push(line([[46, 5, 30], [x, 4, z]], C.cyan2, { alpha: .5 })));
    const L2 = [...pvBlock(40, 24, 3, 3, C.amber)]; hs.forEach(([x, z]) => L2.push(flow([[46, 5, 30], [x, 4, z]], C.amber2, { n: 1, speed: .4 }))); const w = []; for (let i = 0; i <= 30; i++) w.push([-70 + i * 3, 30 + Math.max(0, Math.sin(i / 30 * Math.PI)) * 18, 60]); L2.push(line(w, C.amber, { width: 2 }), label(-70, 52, 60, '24 h DISPATCH', C.amber2));
    const L3 = [...bars(-64, -40, [12, 22, 34], C.green), label(-64, 40, -40, 'GRANT · DEBT · EQUITY', '#6ee7b7')];
    const L4 = [...docs(56, -46)];
    const L5 = [ring(0, 0, 78, C.green, { sweep: 1 }), ring(0, 0, 78, C.green, { alpha: .3 }), label(-30, 8, -78, 'SATELLITE PASS · VERIFIED', '#6ee7b7')];
    return [{ items: L0 }, { items: L1 }, { items: L2 }, { items: L3 }, { items: L4 }, { items: L5 }]; };

  /* ---------- renderer ---------- */
  const inst = new Map();
  function mount(cv) {
    const name = cv.dataset.holo; if (!S[name]) return;
    const layers = S[name](); const ctx = cv.getContext('2d');
    const st = { cv, ctx, layers, step: cv.dataset.step != null ? +cv.dataset.step : layers.length - 1, t: Math.random() * 100, mx: 0, my: 0, vis: false, spin: layers[0].spin || .12, pitch: layers[0].pitch || .58, W: 0, H: 0 };
    inst.set(cv, st);
    const size = () => { const d = Math.min(1.5, devicePixelRatio || 1); st.W = cv.clientWidth; st.H = cv.clientHeight; cv.width = st.W * d; cv.height = st.H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); new ResizeObserver(size).observe(cv);
    new IntersectionObserver((e) => { st.vis = e[0].isIntersecting; }).observe(cv);
    cv.parentElement.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(); st.mx = (e.clientX - r.left) / r.width - .5; st.my = (e.clientY - r.top) / r.height - .5; }, { passive: true });
    cv.parentElement.addEventListener('mouseleave', () => { st.mx = st.my = 0; });
  }
  function frame(st) {
    const { ctx, W, H } = st; if (!W) return;
    st.t += reduce ? 0 : .016;
    const ang = st.t * st.spin + st.mx * .6, pitch = st.pitch + st.my * .25, ca = Math.cos(ang), sa = Math.sin(ang), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const sc = Math.min(W, H) / 200, ox = W / 2, oy = H * .58;
    const P = (x, y, z) => { const rx = x * ca - z * sa, rz = x * sa + z * ca; return [ox + rx * sc, oy + (rz * sp - y * cp) * sc, rz * cp + y * sp]; };
    const rot = (p, it) => { if (!it.rot) return p; const c = Math.cos(it.rot), s = Math.sin(it.rot), cx = it.cx != null ? it.cx : it.x, cz = it.cz != null ? it.cz : it.z, dx = p[0] - cx, dz = p[2] - cz; return [cx + dx * c - dz * s, p[1], cz + dx * s + dz * c]; };
    ctx.clearRect(0, 0, W, H);
    const draw = [];
    st.layers.forEach((L, li) => { if (li > st.step) return; const age = Math.min(1, (st.t - (L.on || 0)) / .8); L.items.forEach((it) => draw.push([it, age])); });
    // depth sort boxes/polys behind lines
    const items = draw.map(([it, age]) => { let z = 0; if (it.type === 'box') z = P(it.x, it.y + it.h / 2, it.z)[2]; else if (it.type === 'poly') { z = it.pts.reduce((s, p) => s + P(...rot(p, it))[2], 0) / it.pts.length; } else z = 1e3; return { it, age, z }; }).sort((a, b) => a.z - b.z);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const { it, age } of items) {
      const al = (it.alpha == null ? 1 : it.alpha) * age; ctx.globalAlpha = al; ctx.shadowBlur = 0;
      switch (it.type) {
        case 'grid': { ctx.strokeStyle = it.color; ctx.lineWidth = 1; for (let i = -it.size / 2; i <= it.size / 2; i += it.step) { let a = P(i, 0, -it.size / 2), b = P(i, 0, it.size / 2); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); a = P(-it.size / 2, 0, i); b = P(it.size / 2, 0, i); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } break; }
        case 'poly': { ctx.beginPath(); it.pts.forEach((p, i) => { const q = P(...rot(p, it)); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); } ctx.strokeStyle = it.color; ctx.lineWidth = it.width || 1; ctx.stroke(); break; }
        case 'box': { const { x, y, z, w, h, d } = it, g = (age < 1 || it.grow != null) ? Math.min(1, Math.max(0, (age * 1.4 - (it.grow || 0) * .1))) : 1, hh = h * g;
          const c = [[x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2]].map((p) => rot(p, it));
          const top = c.map((p) => P(p[0], y + hh, p[2])), bot = c.map((p) => P(p[0], y, p[2]));
          const faces = [[0, 1], [1, 2], [2, 3], [3, 0]].map(([a, b]) => ({ pts: [bot[a], bot[b], top[b], top[a]], z: (bot[a][2] + bot[b][2]) / 2 })).sort((a, b) => a.z - b.z);
          ctx.strokeStyle = it.color; ctx.lineWidth = it.width || 1;
          faces.forEach((f, i) => { ctx.beginPath(); f.pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (it.fill) { ctx.fillStyle = it.fill; ctx.globalAlpha = al * (i < 2 ? .5 : 1); ctx.fill(); ctx.globalAlpha = al; } ctx.stroke(); });
          ctx.beginPath(); top.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); if (it.fill) { ctx.fillStyle = it.fill; ctx.fill(); } ctx.shadowColor = it.color; ctx.shadowBlur = 8; ctx.stroke(); break; }
        case 'line': { ctx.strokeStyle = it.color; ctx.lineWidth = it.width || 1; ctx.shadowColor = it.color; ctx.shadowBlur = it.width > 1 ? 10 : 6; if (it.dash) { ctx.setLineDash([4, 5]); ctx.lineDashOffset = -st.t * 20; }
          ctx.beginPath(); it.pts.forEach((p, i) => { const q = P(p[0], p[1] + (it.wave != null ? Math.sin(st.t * 2 + it.wave) * 1.2 : 0), p[2]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.setLineDash([]); break; }
        case 'points': { ctx.fillStyle = it.color; ctx.shadowColor = it.color; ctx.shadowBlur = 10; it.pts.forEach((p, i) => { const q = P(...p), tw = it.twinkle ? .55 + .45 * Math.sin(st.t * 3 + i * 1.7) : 1; ctx.globalAlpha = al * tw; ctx.beginPath(); ctx.arc(q[0], q[1], it.r || 2, 0, 6.283); ctx.fill(); }); break; }
        case 'ring': { const y = it.y || 0; let r = it.r, a = al; if (it.pulse) { const ph = ((st.t * .5 + it.pulse * .33) % 1); r = it.r * (.4 + ph * .9); a = al * (1 - ph); }
          ctx.strokeStyle = it.color; ctx.lineWidth = 1.2; ctx.shadowColor = it.color; ctx.shadowBlur = 8; ctx.globalAlpha = a; ctx.beginPath();
          for (let i = 0; i <= 48; i++) { const t = i / 48 * 6.283, q = P(it.x + Math.cos(t) * r, y, it.z + Math.sin(t) * r); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.closePath(); if (it.fill) { ctx.fillStyle = it.color; ctx.fill(); } ctx.stroke();
          if (it.sweep) { const a0 = st.t * 1.2; ctx.fillStyle = rgba(it.color, .16); ctx.beginPath(); const c0 = P(it.x, y, it.z); ctx.moveTo(c0[0], c0[1]); for (let i = 0; i <= 12; i++) { const t = a0 + i / 12 * 1.1, q = P(it.x + Math.cos(t) * r, y, it.z + Math.sin(t) * r); ctx.lineTo(q[0], q[1]); } ctx.closePath(); ctx.fill(); } break; }
        case 'beam': { const a = P(it.x, 0, it.z), b = P(it.x, it.h, it.z); const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, rgba(it.color, .9)); g.addColorStop(1, rgba(it.color, 0)); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.shadowColor = it.color; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(a[0], a[1], 3, 0, 6.283); ctx.fill(); break; }
        case 'flow': { const n = it.n || 2, segs = []; let total = 0; for (let i = 1; i < it.pts.length; i++) { const l = Math.hypot(it.pts[i][0] - it.pts[i - 1][0], it.pts[i][1] - it.pts[i - 1][1], it.pts[i][2] - it.pts[i - 1][2]); segs.push(l); total += l; }
          ctx.fillStyle = it.color; ctx.shadowColor = it.color; ctx.shadowBlur = 12; for (let k = 0; k < n; k++) { let u = ((st.t * (it.speed || .4) + k / n) % 1) * total, i = 0; while (i < segs.length - 1 && u > segs[i]) { u -= segs[i]; i++; } const f = segs[i] ? u / segs[i] : 0, p = it.pts[i], q = it.pts[i + 1], s = P(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f); ctx.beginPath(); ctx.arc(s[0], s[1], it.r || 2.2, 0, 6.283); ctx.fill(); } break; }
        case 'label': { const q = P(it.x, it.y, it.z); ctx.fillStyle = it.color; ctx.font = '500 9px "JetBrains Mono",monospace'; ctx.letterSpacing = '1px'; ctx.fillText(it.text, q[0] + 6, q[1]); break; }
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  function loop() { requestAnimationFrame(loop); inst.forEach((st) => { if (st.vis) frame(st); }); }
  document.querySelectorAll('canvas[data-holo]').forEach(mount); loop();
  window.Holo = { setStep(cv, i) { const st = inst.get(cv); if (!st) return; if (i !== st.step) { st.layers.forEach((L, k) => { if (k > st.step && k <= i) L.on = st.t; }); st.step = i; } }, scenes: S };
})();
