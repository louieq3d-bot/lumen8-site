/* Contour field behind page headers. Isolines of a light field under rows of modules: a periodic shade term
   across the pitch, drifting slowly, plus a soft probe that follows the pointer. Marching squares on a coarse grid,
   drawn at most 30 times a second and only while the header is on screen. Decorative; it carries no data. */
(function(){
  'use strict';
  const host = document.querySelector('.phero:not(.shero)');
  if (!host) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas'); cv.className = 'contours'; cv.setAttribute('aria-hidden', 'true');
  host.prepend(cv);
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const CELL = 16, LEVELS = [.18, .28, .38, .48, .58, .68, .78, .88];
  let W = 0, H = 0, dpr = 1, nx = 0, ny = 0, F = null, px = .72, py = .4, tpx = .72, tpy = .4;
  function size(){
    const r = host.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    nx = Math.ceil(W / CELL) + 1; ny = Math.ceil(H / CELL) + 1; F = new Float32Array(nx * ny);
  }
  host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); tpx = (e.clientX - r.left) / r.width; tpy = (e.clientY - r.top) / r.height; }, { passive: true });
  function field(t){
    const pitch = 150, sk = .42 + Math.sin(t * .00005) * .22;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
      const x = i * CELL, y = j * CELL, u = x + y * sk;
      const rows = .5 + .5 * Math.cos(2 * Math.PI * (u / pitch) + t * .00012);
      const swell = .5 + .5 * Math.sin(x * .0042 - t * .00009) * Math.cos(y * .0061 + t * .00007);
      const dx = x / W - px, dy = (y / H - py) * H / W, probe = Math.exp(-(dx * dx + dy * dy) / .02);
      F[j * nx + i] = .16 + .5 * rows * (.55 + .45 * swell) + .3 * probe;
    }
  }
  function draw(t){
    px += (tpx - px) * .04; py += (tpy - py) * .04;
    field(t);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    LEVELS.forEach((lv, li) => {
      ctx.beginPath();
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++){
        const a = F[j * nx + i], b = F[j * nx + i + 1], c = F[(j + 1) * nx + i + 1], d = F[(j + 1) * nx + i];
        const k = (a > lv) | ((b > lv) << 1) | ((c > lv) << 2) | ((d > lv) << 3);
        if (k === 0 || k === 15) continue;
        const x = i * CELL, y = j * CELL, L = (p, q) => (lv - p) / (q - p);
        const T = [x + CELL * L(a, b), y], R = [x + CELL, y + CELL * L(b, c)], B = [x + CELL * L(d, c), y + CELL], Lf = [x, y + CELL * L(a, d)];
        const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
        switch (k){
          case 1: case 14: seg(Lf, T); break;
          case 2: case 13: seg(T, R); break;
          case 3: case 12: seg(Lf, R); break;
          case 4: case 11: seg(R, B); break;
          case 5: seg(Lf, T); seg(R, B); break;
          case 6: case 9: seg(T, B); break;
          case 7: case 8: seg(Lf, B); break;
          case 10: seg(T, R); seg(Lf, B); break;
        }
      }
      ctx.strokeStyle = li === 5 ? 'rgba(61,187,126,.32)' : 'rgba(228,230,234,' + (.035 + li * .009).toFixed(3) + ')';
      ctx.lineWidth = li === 5 ? 1 : .8; ctx.stroke();
    });
  }
  let raf = 0, visible = true, last = 0;
  function loop(t){
    raf = 0; if (!visible || document.hidden) return;
    if (t - last > 33){ last = t; draw(t); }
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !reduce) raf = requestAnimationFrame(loop); };
  new ResizeObserver(() => { size(); draw(performance.now()); }).observe(host);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) start(); }).observe(host);
  document.addEventListener('visibilitychange', start);
  size(); draw(performance.now()); start();
})();
