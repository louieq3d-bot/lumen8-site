/* waves.js — neural energy ribbons. Any <canvas data-wave="blue,cyan,violet">
   becomes a coherent bundle of thin strands flowing along one slow base curve,
   with synapse-like pulses travelling along a few of them. Calm, ordered,
   luminous. Pure 2D canvas; pauses off-screen; reacts gently to scroll. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAL = { blue: '59,130,246', blue2: '96,165,250', cyan: '34,211,238', violet: '167,139,250', green: '52,211,153', rose: '251,113,133', white: '234,240,248', amber: '96,165,250' };
  const list = []; let lastY = window.scrollY, vel = 0;
  window.addEventListener('scroll', () => { const y = window.scrollY; vel += Math.min(30, Math.abs(y - lastY)) * .03; lastY = y; }, { passive: true });
  document.querySelectorAll('canvas[data-wave]').forEach((cv) => {
    const ctx = cv.getContext('2d');
    const cols = (cv.dataset.wave || 'blue,cyan').split(',').map((c) => PAL[c.trim()] || PAL.blue);
    const N = 22, strands = [];
    for (let k = 0; k < N; k++) strands.push({ o: (k / (N - 1) - .5), ph: k * .21, sp: .7 + (k % 5) * .06, c: cols[k % cols.length] });
    const pulses = []; for (let i = 0; i < 7; i++) pulses.push({ k: (Math.random() * N) | 0, u: Math.random(), v: .05 + Math.random() * .05 });
    const st = { cv, ctx, cols, strands, pulses, t: Math.random() * 40, vis: false, W: 0, H: 0 };
    const size = () => { const d = Math.min(1.5, devicePixelRatio || 1); st.W = cv.clientWidth; st.H = cv.clientHeight; cv.width = st.W * d; cv.height = st.H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); new ResizeObserver(size).observe(cv);
    new IntersectionObserver((e) => { st.vis = e[0].isIntersecting; }).observe(cv);
    list.push(st);
  });
  const base = (st, u) => st.H / 2 + Math.sin(u * 3.1 + st.t * .35) * st.H * .16 + Math.sin(u * 7.3 - st.t * .22) * st.H * .06;
  const spread = (st, u) => st.H * .22 * (.55 + .45 * Math.sin(u * 4.2 + st.t * .5)) * Math.sin(u * Math.PI) ** .5;
  function point(st, s, u) { const b = base(st, u), w = spread(st, u); const y = b + s.o * w * 2 + Math.sin(u * 11 + st.t * s.sp + s.ph) * st.H * .012 * (1 + vel); return [u * st.W, y]; }
  function draw(st, dt) {
    const { ctx, W, H, strands } = st; if (!W) return; st.t += reduce ? 0 : dt;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const grad = ctx.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, 'rgba(' + st.cols[0] + ',0)'); grad.addColorStop(.2, 'rgba(' + st.cols[0] + ',1)'); grad.addColorStop(.55, 'rgba(' + st.cols[1 % st.cols.length] + ',1)'); grad.addColorStop(.85, 'rgba(' + st.cols[2 % st.cols.length] + ',1)'); grad.addColorStop(1, 'rgba(' + st.cols[2 % st.cols.length] + ',0)');
    // soft body
    ctx.beginPath(); for (let i = 0; i <= 120; i++) { const [x, y] = point(st, strands[0], i / 120); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } for (let i = 120; i >= 0; i--) { const [x, y] = point(st, strands[strands.length - 1], i / 120); ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = grad; ctx.globalAlpha = .045; ctx.fill(); ctx.globalAlpha = 1;
    // strands
    strands.forEach((s, k) => { ctx.beginPath(); for (let i = 0; i <= 140; i++) { const [x, y] = point(st, s, i / 140); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = grad; ctx.globalAlpha = k % 3 === 0 ? .5 : .22; ctx.lineWidth = k % 3 === 0 ? 1.1 : .7; ctx.shadowBlur = k % 3 === 0 ? 8 : 0; ctx.shadowColor = 'rgba(' + s.c + ',.9)'; ctx.stroke(); });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // synapse pulses
    st.pulses.forEach((p) => { p.u += (reduce ? 0 : dt) * p.v * (1 + vel * 2); if (p.u > 1) { p.u = 0; p.k = (Math.random() * strands.length) | 0; } const s = strands[p.k], [x, y] = point(st, s, p.u); const a = Math.sin(p.u * Math.PI); const g = ctx.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, 'rgba(255,255,255,' + (.9 * a) + ')'); g.addColorStop(.25, 'rgba(' + s.c + ',' + (.6 * a) + ')'); g.addColorStop(1, 'rgba(' + s.c + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.283); ctx.fill(); });
    ctx.globalCompositeOperation = 'source-over';
  }
  let last = performance.now();
  function loop(now) { requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; vel *= .94; list.forEach((s) => { if (s.vis) draw(s, dt); }); }
  requestAnimationFrame(loop);
})();
