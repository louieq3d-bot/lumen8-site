/* waves.js — a nervous system for energy, not a bundle of wires.
   Any <canvas data-wave="blue,cyan,silver"> becomes: a few wide, slow energy
   ribbons; three pure sinusoids in silver, white and ice running clean across
   the strip; a neural layer of somas with short dendrites, curved axons between
   neighbours and signals that fire along them and light the soma they reach; a
   faint interference lattice; and equations drifting through, every one of them
   from the engine itself (yield, storage, LV design, cash flow, carbon).
   Pure 2D canvas; pauses off-screen; reacts gently to scroll. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAL = { blue: '59,130,246', blue2: '96,165,250', cyan: '34,211,238', cyan2: '103,232,249', green: '52,211,153', mint: '110,231,183', silver: '203,213,225', white: '236,242,250', ice: '224,242,254', teal: '45,212,191' };
  PAL.violet = PAL.silver; PAL.rose = PAL.teal; PAL.amber = PAL.blue2;
  const EQ = [
    'P_ac = G · A · η · PR', 'E = Σ Pₜ · Δt', 'PR = E_ac / (G_poa · P_stc)', 'CF = E / (P · 8760)', 'GHI = DNI · cos θz + DHI',
    'SOCₜ₊₁ = SOCₜ + η · Pₜ · Δt', 'ΔV = (R·P + X·Q) / V', 'I = P / (√3 · V · cos φ)',
    'NPV = Σ CFₜ / (1+r)ᵗ', 'IRR: Σ CFₜ (1+IRR)⁻ᵗ = 0', 'LCOE = Σ Cₜ(1+r)⁻ᵗ / Σ Eₜ(1+r)⁻ᵗ', 'DSCR = CFADS / (P + I)', 'P50 · P90 · P99',
    'tCO₂e = E_diesel × EF', 'payback: Σ CFₜ ≥ CAPEX'
  ];
  const list = []; let lastY = window.scrollY, vel = 0;
  window.addEventListener('scroll', () => { const y = window.scrollY; vel += Math.min(30, Math.abs(y - lastY)) * .03; lastY = y; }, { passive: true });
  const R = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  document.querySelectorAll('canvas[data-wave]').forEach((cv, idx) => {
    const ctx = cv.getContext('2d'); const r = R(17 + idx * 31);
    const cols = (cv.dataset.wave || 'blue,cyan').split(',').map((c) => PAL[c.trim()] || PAL.blue);
    while (cols.length < 3) cols.push(PAL.cyan2); if (!cols.includes(PAL.silver)) cols.push(PAL.silver);
    const N = 7, strands = []; for (let k = 0; k < N; k++) strands.push({ o: (k / (N - 1) - .5), ph: k * .8, sp: .5 + (k % 3) * .12, c: cols[k % (cols.length - 1)], w: k === 3 ? 1.8 : 1 });
    const sines = [{ c: PAL.silver, A: .17, n: 3.2, w: .55, al: .9, lw: 1.2 }, { c: PAL.white, A: .09, n: 5.4, w: -.8, al: .55, lw: 1 }, { c: PAL.ice, A: .26, n: 1.6, w: .35, al: .35, lw: 1 }];
    const nodes = []; for (let i = 0; i < 13; i++) { const dend = []; const nd = 3 + (r() * 3 | 0); for (let d = 0; d < nd; d++) dend.push({ a: r() * 6.283, l: 10 + r() * 16, k: (r() - .5) * 1.6 }); nodes.push({ u: .05 + r() * .9, o: (r() - .5) * 1.7, ph: r() * 6.283, s: 2.2 + r() * 1.6, dend, hot: 0, c: cols[i % cols.length] }); }
    const fires = []; for (let i = 0; i < 7; i++) fires.push({ u: r(), v: .25 + r() * .3, e: -1 });
    const pulses = []; for (let i = 0; i < 6; i++) pulses.push({ k: (r() * N) | 0, u: r(), v: .05 + r() * .05 });
    const eqs = []; for (let i = 0; i < 6; i++) eqs.push({ s: EQ[(i * 3 + ((r() * EQ.length) | 0)) % EQ.length], x: r(), y: r(), a: r() * 10, v: 5 + r() * 6, c: cols[i % cols.length] });
    const st = { cv, ctx, cols, strands, sines, nodes, fires, pulses, eqs, t: r() * 40, vis: false, W: 0, H: 0 };
    const size = () => { const d = Math.min(1.5, devicePixelRatio || 1); st.W = cv.clientWidth; st.H = cv.clientHeight; cv.width = st.W * d; cv.height = st.H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); new ResizeObserver(size).observe(cv);
    new IntersectionObserver((e) => { st.vis = e[0].isIntersecting; }).observe(cv);
    list.push(st);
  });
  const base = (st, u) => st.H / 2 + Math.sin(u * 3.1 + st.t * .3) * st.H * .15 + Math.sin(u * 7.3 - st.t * .2) * st.H * .05;
  const spread = (st, u) => st.H * .2 * (.5 + .5 * Math.sin(u * 4.2 + st.t * .45)) * Math.pow(Math.sin(u * Math.PI), .5);
  function point(st, s, u) { const b = base(st, u), w = spread(st, u); const y = b + s.o * w * 2 + Math.sin(u * 9 + st.t * s.sp + s.ph) * st.H * .014 * (1 + vel); return [u * st.W, y]; }
  const bez = (a, m, b, u) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * m + u * u * b;
  function draw(st, dt) {
    const { ctx, W, H, strands } = st; if (!W) return; st.t += reduce ? 0 : dt; const t = st.t;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const grad = ctx.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, 'rgba(' + st.cols[0] + ',0)'); grad.addColorStop(.16, 'rgba(' + st.cols[0] + ',1)'); grad.addColorStop(.5, 'rgba(' + st.cols[1] + ',1)'); grad.addColorStop(.82, 'rgba(' + st.cols[2] + ',1)'); grad.addColorStop(1, 'rgba(' + st.cols[2] + ',0)');
    // interference lattice, very faint
    if (!reduce) { const g = 34; ctx.fillStyle = 'rgba(' + st.cols[1] + ',1)'; for (let y = g / 2; y < H; y += g) for (let x = g / 2 + ((y / g) % 2) * g / 2; x < W; x += g) { const b = base(st, x / W); const env = Math.exp(-Math.pow((y - b) / (H * .3), 2)); const a = Math.max(0, Math.sin(x * .03 - t * 1.4) * Math.sin(y * .045 + t * .8)) * env * .1 * Math.sin(x / W * Math.PI); if (a < .01) continue; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 1, 0, 6.283); ctx.fill(); } ctx.globalAlpha = 1; }
    // soft body between the outer ribbons
    ctx.beginPath(); for (let i = 0; i <= 100; i++) { const [x, y] = point(st, strands[0], i / 100); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } for (let i = 100; i >= 0; i--) { const [x, y] = point(st, strands[strands.length - 1], i / 100); ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = grad; ctx.globalAlpha = .05; ctx.fill(); ctx.globalAlpha = 1;
    // ribbons: few, wide, glowing
    strands.forEach((s) => { ctx.beginPath(); for (let i = 0; i <= 120; i++) { const [x, y] = point(st, s, i / 120); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = grad; ctx.globalAlpha = .55 * s.w; ctx.lineWidth = 1.1 * s.w; ctx.shadowBlur = 12 * s.w; ctx.shadowColor = 'rgba(' + s.c + ',.9)'; ctx.stroke(); });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // pure sinusoids, clean across the whole strip
    st.sines.forEach((s, j) => { ctx.beginPath(); for (let i = 0; i <= 220; i++) { const u = i / 220, x = u * W; const env = .35 + .65 * Math.sin(u * Math.PI); const y = H / 2 + Math.sin(u * s.n * 6.283 + t * s.w * 2 + j) * H * s.A * env; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = 'rgba(' + s.c + ',' + s.al + ')'; ctx.lineWidth = s.lw; ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(' + s.c + ',.8)'; ctx.stroke(); });
    ctx.shadowBlur = 0;
    // neurons: somas with dendrites, curved axons to the two nearest, signals along them
    const np = st.nodes.map((n) => { const b = base(st, n.u), w = spread(st, n.u); return { x: n.u * W, y: b + n.o * w * 2 + Math.sin(t * .8 + n.ph) * 4, n }; });
    const edges = []; np.forEach((a, i) => { const near = np.map((b, j) => ({ b, j, d: Math.hypot(a.x - b.x, a.y - b.y) })).filter((o) => o.j !== i && o.d < W * .2).sort((p, q) => p.d - q.d).slice(0, 2); near.forEach(({ b }) => { if (!edges.some((e) => (e[0] === b && e[1] === a) || (e[0] === a && e[1] === b))) edges.push([a, b]); }); });
    edges.forEach(([a, b]) => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - (b.x - a.x) * .18; ctx.strokeStyle = 'rgba(' + st.cols[2] + ',.2)'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke(); });
    np.forEach(({ x, y, n }) => { n.hot = Math.max(0, n.hot - dt * 1.2); const tw = .5 + .5 * Math.sin(t * 1.1 + n.ph) + n.hot; n.dend.forEach((d) => { const a = d.a + Math.sin(t * .5 + d.k) * .15; const ex = x + Math.cos(a) * d.l, ey = y + Math.sin(a) * d.l; const cx = x + Math.cos(a + d.k) * d.l * .6, cy = y + Math.sin(a + d.k) * d.l * .6; ctx.strokeStyle = 'rgba(' + n.c + ',' + (.28 * tw) + ')'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke(); ctx.fillStyle = 'rgba(' + n.c + ',' + (.5 * tw) + ')'; ctx.beginPath(); ctx.arc(ex, ey, 1, 0, 6.283); ctx.fill(); }); const g = ctx.createRadialGradient(x, y, 0, x, y, n.s * 3.2); g.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, .85 * tw) + ')'); g.addColorStop(.25, 'rgba(' + n.c + ',' + Math.min(1, .55 * tw) + ')'); g.addColorStop(1, 'rgba(' + n.c + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, n.s * 3.2, 0, 6.283); ctx.fill(); });
    if (edges.length) st.fires.forEach((f) => { f.u += (reduce ? 0 : dt) * f.v; if (f.e < 0 || f.u > 1) { if (f.e >= 0 && edges[f.e % edges.length]) edges[f.e % edges.length][1].n.hot = 1; f.u = 0; f.e = (Math.random() * edges.length) | 0; } const e = edges[f.e % edges.length]; if (!e) return; const [a, b] = e; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - (b.x - a.x) * .18; for (let k = 0; k < 5; k++) { const uu = Math.max(0, f.u - k * .025); ctx.fillStyle = 'rgba(255,255,255,' + (.7 - k * .13) + ')'; ctx.beginPath(); ctx.arc(bez(a.x, mx, b.x, uu), bez(a.y, my, b.y, uu), 2.2 - k * .3, 0, 6.283); ctx.fill(); } const x = bez(a.x, mx, b.x, f.u), y = bez(a.y, my, b.y, f.u); const g2 = ctx.createRadialGradient(x, y, 0, x, y, 8); g2.addColorStop(0, 'rgba(255,255,255,.9)'); g2.addColorStop(.4, 'rgba(' + st.cols[2] + ',.5)'); g2.addColorStop(1, 'rgba(' + st.cols[2] + ',0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.283); ctx.fill(); });
    // energy pulses along the ribbons
    st.pulses.forEach((p) => { p.u += (reduce ? 0 : dt) * p.v * (1 + vel * 2); if (p.u > 1) { p.u = 0; p.k = (Math.random() * strands.length) | 0; } const s = strands[p.k], [x, y] = point(st, s, p.u); const a = Math.sin(p.u * Math.PI); const g = ctx.createRadialGradient(x, y, 0, x, y, 13); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(.14, 'rgba(255,255,255,' + (.8 * a) + ')'); g.addColorStop(.32, 'rgba(' + s.c + ',' + (.55 * a) + ')'); g.addColorStop(1, 'rgba(' + s.c + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 13, 0, 6.283); ctx.fill(); });
    // the engine's own equations, drifting
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
    st.eqs.forEach((e) => { e.a += (reduce ? 0 : dt); const cyc = 15, ph = (e.a % cyc) / cyc; if (ph < .02 && !reduce && e.a > cyc) { e.x = Math.random(); e.y = Math.random(); e.s = EQ[(Math.random() * EQ.length) | 0]; e.a = cyc * 1.02; } const al = Math.sin(ph * Math.PI) * .4 * Math.sin(e.x * Math.PI); const x = e.x * W + ph * e.v * 4, y = 14 + e.y * (H - 28) - ph * 8; ctx.fillStyle = 'rgba(' + e.c + ',' + al + ')'; ctx.fillText(e.s, x, y); ctx.strokeStyle = 'rgba(' + e.c + ',' + (al * .45) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y + 9); ctx.lineTo(x + ctx.measureText(e.s).width * .35, y + 9); ctx.stroke(); });
    ctx.globalCompositeOperation = 'source-over';
  }
  let last = performance.now();
  function loop(now) { requestAnimationFrame(loop); const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; vel *= .94; list.forEach((s) => { if (s.vis) draw(s, dt); }); }
  requestAnimationFrame(loop);
})();
