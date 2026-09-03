/* waves.js — energy waveforms. Any <canvas data-wave="cyan,amber,violet"> becomes
   a strip of layered, glowing oscillations that breathe with time and respond
   to scroll velocity. Pure 2D canvas, pauses when off-screen. */
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAL = { cyan: '34,211,238', amber: '245,178,27', violet: '167,139,250', green: '52,211,153', rose: '251,113,133', white: '234,240,248' };
  const list = [];
  let lastY = window.scrollY, vel = 0;
  window.addEventListener('scroll', () => { const y = window.scrollY; vel += Math.min(40, Math.abs(y - lastY)) * .06; lastY = y; }, { passive: true });
  document.querySelectorAll('canvas[data-wave]').forEach((cv) => {
    const ctx = cv.getContext('2d');
    const cols = (cv.dataset.wave || 'cyan,amber').split(',').map((c) => PAL[c.trim()] || PAL.cyan);
    const st = { cv, ctx, cols, t: Math.random() * 50, vis: false, W: 0, H: 0, seed: Math.random() * 10 };
    const size = () => { const d = Math.min(1.5, devicePixelRatio || 1); st.W = cv.clientWidth; st.H = cv.clientHeight; cv.width = st.W * d; cv.height = st.H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); new ResizeObserver(size).observe(cv);
    new IntersectionObserver((e) => { st.vis = e[0].isIntersecting; }).observe(cv);
    list.push(st);
  });
  function draw(st) {
    const { ctx, W, H, cols } = st; if (!W) return;
    st.t += reduce ? 0 : .012;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const amp = (H * .28) * (1 + Math.min(1.2, vel));
    cols.forEach((c, k) => {
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        for (let i = 0; i <= 220; i++) {
          const u = i / 220, x = u * W;
          const env = Math.sin(u * Math.PI) ** .6;
          const y = H / 2 + env * (Math.sin(u * 9 + st.t * 1.6 + k * 2.1 + st.seed) * amp * .6 + Math.sin(u * 23 - st.t * 2.7 + k) * amp * .22 + Math.sin(u * 47 + st.t * 4.1 + k * 3) * amp * .08 * (1 + vel));
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = 'rgba(' + c + ',' + (pass ? .85 : .18) + ')';
        ctx.lineWidth = pass ? 1.2 : 7; ctx.shadowColor = 'rgba(' + c + ',.9)'; ctx.shadowBlur = pass ? 14 : 0;
        ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  }
  function loop() { requestAnimationFrame(loop); vel *= .92; list.forEach((s) => { if (s.vis) draw(s); }); }
  loop();
})();
