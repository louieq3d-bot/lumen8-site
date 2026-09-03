/* waves.js — neural energy ribbons with a little physics in them.
   Any <canvas data-wave="blue,cyan,violet"> becomes a coherent bundle of thin
   strands flowing along one slow base curve (a fourth colour is added if only
   three are given), with synapse-like pulses travelling along them, a sparse
   neural lattice of nodes riding the strands and firing along their edges, an
   interference field of probability dots, and equations drifting through the
   space: the wave function, energy as an integral, present value, yield.
   Pure 2D canvas; pauses off-screen; reacts gently to scroll. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAL = { blue: '59,130,246', blue2: '96,165,250', cyan: '34,211,238', violet: '167,139,250', green: '52,211,153', mint: '110,231,183', rose: '251,113,133', white: '234,240,248', amber: '96,165,250' };
  const EQ = ['ψ(x,t) = A·e^(i(kx − ωt))', 'E = ∫ P(t) dt', 'NPV = Σ CFₜ / (1+r)ᵗ', 'P = G · A · η · PR', 'Ĥψ = Eψ', '∇²φ = 0', 'LCOE = Σ Cₜ(1+r)⁻ᵗ / Σ Eₜ(1+r)⁻ᵗ', 'σ² = Σ(x−μ)² / N', 'I = I₀ · e^(−αx)', 'ΔS ≥ 0', 'kWh × tariff = $', 'P50 · P90 · P99', 'f(t) = Σ aₙ sin(nωt + φₙ)', 'IRR: Σ CFₜ(1+i)⁻ᵗ = 0'];
  const list = []; let lastY = window.scrollY, vel = 0;
  window.addEventListener('scroll', () => { const y = window.scrollY; vel += Math.min(30, Math.abs(y - lastY)) * .03; lastY = y; }, { passive: true });
  document.querySelectorAll('canvas[data-wave]').forEach((cv) => {
    const ctx = cv.getContext('2d');
    const cols = (cv.dataset.wave || 'blue,cyan').split(',').map((c) => PAL[c.trim()] || PAL.blue);
    if (cols.length < 4) cols.push(cols.includes(PAL.green) || cols.includes(PAL.mint) ? PAL.white : PAL.mint);
    const N = 24, strands = [];
    for (let k = 0; k < N; k++) strands.push({ o: (k / (N - 1) - .5), ph: k * .21, sp: .7 + (k % 5) * .06, c: cols[k % cols.length] });
    const pulses = []; for (let i = 0; i < 12; i++) pulses.push({ k: (Math.random() * N) | 0, u: Math.random(), v: .05 + Math.random() * .05 });
    const nodes = []; for (let i = 0; i < 22; i++) nodes.push({ k: (Math.random() * N) | 0, u: .06 + Math.random() * .88, r: 2 + Math.random() * 2.2, ph: Math.random() * 6.28 });
    const fires = []; for (let i = 0; i < 6; i++) fires.push({ a: 0, b: 1, u: Math.random(), v: .3 + Math.random() * .3 });
    const eqs = []; for (let i = 0; i < 7; i++) eqs.push({ s: EQ[(i * 5 + ((Math.random() * EQ.length) | 0)) % EQ.length], x: Math.random(), y: Math.random(), a: Math.random() * 10, v: 5 + Math.random() * 6, c: cols[i % cols.length] });
    const st = { cv, ctx, cols, strands, pulses, nodes, fires, eqs, t: Math.random() * 40, vis: false, W: 0, H: 0 };
    const size = () => { const d = Math.min(1.5, devicePixelRatio || 1); st.W = cv.clientWidth; st.H = cv.clientHeight; cv.width = st.W * d; cv.height = st.H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); new ResizeObserver(size).observe(cv);
    new IntersectionObserver((e) => { st.vis = e[0].isIntersecting; }).observe(cv);
    list.push(st);
  });
  const base = (st, u) => st.H / 2 + Math.sin(u * 3.1 + st.t * .35) * st.H * .16 + Math.sin(u * 7.3 - st.t * .22) * st.H * .06;
  const spread = (st, u) => st.H * .22 * (.55 + .45 * Math.sin(u * 4.2 + st.t * .5)) * Math.sin(u * Math.PI) ** .5;
  function point(st, s, u) { const b = base(st, u), w = spread(st, u); const y = b + s.o * w * 2 + Math.sin(u * 11 + st.t * s.sp + s.ph) * st.H * .012 * (1 + vel); return [u * st.W, y]; }
  function draw(st, dt) {
    const { ctx, W, H, strands } = st; if (!W) return; st.t += reduce ? 0 : dt; const t = st.t;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const grad = ctx.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, 'rgba(' + st.cols[0] + ',0)'); grad.addColorStop(.18, 'rgba(' + st.cols[0] + ',1)'); grad.addColorStop(.45, 'rgba(' + st.cols[1] + ',1)'); grad.addColorStop(.7, 'rgba(' + st.cols[2] + ',1)'); grad.addColorStop(.9, 'rgba(' + st.cols[3] + ',1)'); grad.addColorStop(1, 'rgba(' + st.cols[3] + ',0)');
    // interference field: a sparse lattice of probability dots, brightness from two crossing waves
    if (!reduce) { const g = 26; ctx.fillStyle = 'rgba(' + st.cols[1] + ',1)'; for (let y = g / 2; y < H; y += g) for (let x = g / 2 + ((y / g) % 2) * g / 2; x < W; x += g) { const b = base(st, x / W); const env = Math.exp(-Math.pow((y - b) / (H * .28), 2)); const a = Math.max(0, Math.sin(x * .035 - t * 1.6) * Math.sin(y * .05 + t * .9)) * env * .16 * Math.sin(x / W * Math.PI); if (a < .01) continue; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 6.283); ctx.fill(); } ctx.globalAlpha = 1; }
    // soft body
    ctx.beginPath(); for (let i = 0; i <= 120; i++) { const [x, y] = point(st, strands[0], i / 120); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } for (let i = 120; i >= 0; i--) { const [x, y] = point(st, strands[strands.length - 1], i / 120); ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = grad; ctx.globalAlpha = .045; ctx.fill(); ctx.globalAlpha = 1;
    // strands
    strands.forEach((s, k) => { ctx.beginPath(); for (let i = 0; i <= 140; i++) { const [x, y] = point(st, s, i / 140); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = grad; ctx.globalAlpha = k % 3 === 0 ? .7 : .32; ctx.lineWidth = k % 3 === 0 ? 1.3 : .8; ctx.shadowBlur = k % 3 === 0 ? 8 : 0; ctx.shadowColor = 'rgba(' + s.c + ',.9)'; ctx.stroke(); });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // neural lattice: nodes ride the strands, edges join near neighbours, signals fire along edges
    const np = st.nodes.map((n) => { const [x, y] = point(st, strands[n.k], n.u); return { x, y, n }; });
    ctx.lineWidth = .7; const edges = [];
    for (let i = 0; i < np.length; i++) for (let j = i + 1; j < np.length; j++) { const a = np[i], b = np[j], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < W * .11 && d > 8) { edges.push([a, b]); ctx.strokeStyle = 'rgba(' + st.cols[2] + ',' + (.26 * (1 - d / (W * .11))) + ')'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    np.forEach(({ x, y, n }) => { const tw = .55 + .45 * Math.sin(t * 1.3 + n.ph); ctx.strokeStyle = 'rgba(' + strands[n.k].c + ',' + (.55 * tw) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, n.r + 2.5, 0, 6.283); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,' + (.8 * tw) + ')'; ctx.beginPath(); ctx.arc(x, y, n.r * .55, 0, 6.283); ctx.fill(); });
    if (edges.length) st.fires.forEach((f) => { f.u += (reduce ? 0 : dt) * f.v; if (f.u > 1) { f.u = 0; f.e = (Math.random() * edges.length) | 0; } const e = edges[f.e % edges.length]; if (!e) return; const x = e[0].x + (e[1].x - e[0].x) * f.u, y = e[0].y + (e[1].y - e[0].y) * f.u; const g2 = ctx.createRadialGradient(x, y, 0, x, y, 9); g2.addColorStop(0, 'rgba(255,255,255,.95)'); g2.addColorStop(.3, 'rgba(' + st.cols[3] + ',.6)'); g2.addColorStop(1, 'rgba(' + st.cols[3] + ',0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.283); ctx.fill(); });
    // synapse pulses along the strands
    st.pulses.forEach((p) => { p.u += (reduce ? 0 : dt) * p.v * (1 + vel * 2); if (p.u > 1) { p.u = 0; p.k = (Math.random() * strands.length) | 0; } const s = strands[p.k], [x, y] = point(st, s, p.u); const a = Math.sin(p.u * Math.PI); const g = ctx.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(.12, 'rgba(255,255,255,' + (.8 * a) + ')'); g.addColorStop(.3, 'rgba(' + s.c + ',' + (.6 * a) + ')'); g.addColorStop(1, 'rgba(' + s.c + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.283); ctx.fill(); });
    // equations drifting through the space, fading in and out
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
    st.eqs.forEach((e) => { e.a += (reduce ? 0 : dt); const cyc = 14, ph = (e.a % cyc) / cyc; if (ph < .02 && !reduce && e.a > cyc) { e.x = Math.random(); e.y = Math.random(); e.s = EQ[(Math.random() * EQ.length) | 0]; e.a = cyc * 1.02; } const al = Math.sin(ph * Math.PI) * .42 * Math.sin(e.x * Math.PI); const x = e.x * W + ph * e.v * 4, y = 14 + e.y * (H - 28) - ph * 8; ctx.fillStyle = 'rgba(' + e.c + ',' + al + ')'; ctx.fillText(e.s, x, y); ctx.strokeStyle = 'rgba(' + e.c + ',' + (al * .5) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y + 9); ctx.lineTo(x + ctx.measureText(e.s).width * .35, y + 9); ctx.stroke(); });
    ctx.globalCompositeOperation = 'source-over';
  }
  let last = performance.now();
  function loop(now) { requestAnimationFrame(loop); const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; vel *= .94; list.forEach((s) => { if (s.vis) draw(s, dt); }); }
  requestAnimationFrame(loop);
})();
