/* proof.js — the coverage fields behind the national proof numbers.
   Each proof cell carries a canvas that draws what that number actually
   counts: village clusters across an archipelago, berths along a coast,
   a lattice of tower sites, a mosaic of classified parcels. The field
   fills in as the number counts up, then holds with a slow survey sweep.
   One shared rAF, only while the band is on screen. Static under
   prefers-reduced-motion. No dependencies. */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const ease = (p) => 1 - Math.pow(1 - p, 3);

  /* ---------- geometry, built once per size ---------- */
  const BUILD = {
    /* island clusters — the shape of a screened archipelago */
    villages(w, h) {
      const seeds = [[.14, .58], [.31, .33], [.44, .70], [.60, .40], [.75, .63], [.88, .36], [.24, .86]];
      const p = [];
      for (let i = 0; i < 300; i++) {
        const s = seeds[i % seeds.length], a = hash(i, 3) * 6.283;
        const r = Math.pow(hash(i, 7), .72) * (.055 + hash(i, 11) * .05);
        p.push({ x: (s[0] + Math.cos(a) * r) * w, y: (s[1] + Math.sin(a) * r * 1.5) * h, r: .8 + hash(i, 13) * 1.4, d: hash(i, 17) });
      }
      return p;
    },
    /* a meandering coast with berths hung off the landward side */
    ports(w, h) {
      const p = [];
      for (let i = 0; i < 150; i++) {
        const u = i / 149, x = u * w;
        const y = (.40 + Math.sin(u * 5.3 + .8) * .055 + Math.sin(u * 13.7) * .035 + Math.sin(u * 31.1) * .014) * h;
        p.push({ x, y, r: .9 + hash(i, 5) * 1.1, d: u * .78 + hash(i, 9) * .22, tick: hash(i, 21) > .70 ? 1 : 0 });
      }
      return p;
    },
    /* a scored lattice of masts */
    towers(w, h) {
      const p = [], cols = 15, rows = 6;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const jx = (hash(i, j) - .5) * .55, jy = (hash(i + 40, j) - .5) * .55;
        p.push({ x: (i + .5 + jx) / cols * w, y: (j + .5 + jy) / rows * h, d: hash(i, j + 3), hot: hash(i, j + 9) > .84 });
      }
      return p;
    },
    /* classified parcels — a mosaic that fills crop by crop */
    fields(w, h) {
      const p = [], cols = 14, rows = 6, gx = w / cols, gy = h / rows;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = hash(i, j * 3);
        if (k < .12) continue; /* fallow — a mosaic with gaps reads as land, not wallpaper */
        p.push({ x: i * gx + 1, y: j * gy + 1, w: gx * (.6 + k * .32), h: gy * (.52 + hash(i, j + 5) * .34), d: hash(i * 2, j), tone: k });
      }
      return p;
    }
  };

  /* ---------- painters ---------- */
  const DRAW = {
    villages(c, w, h, g, k, t, col) {
      g.forEach((m, i) => {
        if (m.d > k) return;
        const a = Math.min(1, (k - m.d) * 5) * (.42 + .5 * (.5 + .5 * Math.sin(t * 1.1 + i)));
        c.globalAlpha = a; c.fillStyle = col;
        c.beginPath(); c.arc(m.x, m.y, m.r, 0, 6.283); c.fill();
      });
    },
    ports(c, w, h, g, k, t, col) {
      const shown = g.filter((m) => m.d <= k);
      if (shown.length < 2) return;
      /* water below the coast, so the line reads as a shoreline and not a chart */
      c.globalAlpha = .07; c.fillStyle = col;
      c.beginPath(); c.moveTo(shown[0].x, h);
      shown.forEach((m) => c.lineTo(m.x, m.y));
      c.lineTo(shown[shown.length - 1].x, h); c.closePath(); c.fill();
      c.strokeStyle = col; c.lineWidth = 1;
      c.globalAlpha = .42; c.beginPath();
      shown.forEach((m, i) => { i ? c.lineTo(m.x, m.y) : c.moveTo(m.x, m.y); });
      c.stroke();
      shown.forEach((m, i) => {
        if (!m.tick) return;
        /* a berth: a short jetty out into the water with a lit head */
        const len = h * .085;
        c.globalAlpha = .3; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x, m.y + len); c.stroke();
        c.globalAlpha = .45 + .5 * (.5 + .5 * Math.sin(t * 1.5 + i * .7)); c.fillStyle = col;
        c.beginPath(); c.arc(m.x, m.y + len, 1.5, 0, 6.283); c.fill();
      });
    },
    towers(c, w, h, g, k, t, col) {
      c.strokeStyle = col; c.lineWidth = 1;
      g.forEach((m, i) => {
        if (m.d > k) return;
        const pulse = .5 + .5 * Math.sin(t * 1.5 + i * .5), H = 7;
        c.globalAlpha = m.hot ? .5 + .4 * pulse : .26 + .14 * pulse;
        /* a lattice mast: one stem, two cross-arms, a head */
        c.beginPath(); c.moveTo(m.x, m.y + H * .5); c.lineTo(m.x, m.y - H * .5);
        c.moveTo(m.x - 2.4, m.y + H * .5); c.lineTo(m.x, m.y + H * .2);
        c.moveTo(m.x + 2.4, m.y + H * .5); c.lineTo(m.x, m.y + H * .2);
        c.moveTo(m.x - 2.6, m.y - H * .34); c.lineTo(m.x + 2.6, m.y - H * .34);
        c.stroke();
        if (m.hot) { /* a scored site broadcasts */
          c.globalAlpha = .34 * (1 - pulse * .7);
          c.beginPath(); c.arc(m.x, m.y - H * .5, 3.5 + pulse * 5.5, 0, 6.283); c.stroke();
        }
      });
    },
    fields(c, w, h, g, k, t, col) {
      g.forEach((m, i) => {
        if (m.d > k) return;
        const a = Math.min(1, (k - m.d) * 6);
        c.globalAlpha = a * (.035 + m.tone * .075); c.fillStyle = col;
        c.fillRect(m.x, m.y, m.w, m.h);
        c.globalAlpha = a * (.13 + .09 * (.5 + .5 * Math.sin(t * .9 + i * .4)));
        c.strokeStyle = col; c.lineWidth = 1; c.strokeRect(m.x + .5, m.y + .5, m.w - 1, m.h - 1);
      });
    }
  };

  const cells = [];
  document.querySelectorAll('[data-field]').forEach((cv) => {
    const kind = cv.dataset.field;
    if (!BUILD[kind]) return;
    cells.push({ cv, kind, col: getComputedStyle(cv).getPropertyValue('--fc').trim() || '#22d3ee', ctx: cv.getContext('2d'), g: null, w: 0, h: 0, k: 0, on: false });
  });
  if (!cells.length) return;

  const size = (s) => {
    const r = s.cv.getBoundingClientRect(); if (!r.width || !r.height) return false;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (Math.abs(r.width - s.w) < 1 && Math.abs(r.height - s.h) < 1) return true;
    s.w = r.width; s.h = r.height;
    s.cv.width = Math.round(r.width * dpr); s.cv.height = Math.round(r.height * dpr);
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    s.g = BUILD[s.kind](s.w, s.h);
    return true;
  };

  const paint = (s, t) => {
    if (!size(s)) return;
    const c = s.ctx; c.clearRect(0, 0, s.w, s.h);
    DRAW[s.kind](c, s.w, s.h, s.g, s.k, t, s.col);
    /* survey sweep — a soft band that walks the field once the count has landed */
    if (!reduce && s.k >= 1) {
      const u = ((t * .16) % 1.5) - .25, x = u * s.w;
      const grd = c.createLinearGradient(x - s.w * .16, 0, x + s.w * .16, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(.5, 'rgba(255,255,255,.055)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      c.globalAlpha = 1; c.fillStyle = grd; c.fillRect(x - s.w * .16, 0, s.w * .32, s.h);
    }
    c.globalAlpha = 1;
  };

  let running = false, t0 = 0;
  const tick = (now) => {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000; let live = false;
    cells.forEach((s) => {
      if (!s.on) return; live = true;
      if (s.k < 1) s.k = Math.min(1, s.k + 1 / 110);
      paint(s, t);
    });
    if (live) requestAnimationFrame(tick); else running = false;
  };
  const start = () => { if (!running) { running = true; requestAnimationFrame(tick); } };

  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      const s = cells.find((x) => x.cv === e.target); if (!s) return;
      s.on = e.isIntersecting;
      if (e.isIntersecting) { if (reduce) { s.k = 1; paint(s, 0); } else start(); }
    });
  }, { threshold: .12 });
  cells.forEach((s) => io.observe(s.cv));

  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { cells.forEach((s) => { s.w = 0; if (reduce) paint(s, 0); }); start(); }, 160); }, { passive: true });
})();
