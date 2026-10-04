/* Archetype plates — to-scale cross-sections drawn from the spec numbers. Mounts on [data-arch-plate="A|C|D|E|F"].
   True scale: 1 m is the same number of px horizontally and vertically on every plate.
   Site for every sun angle: Western Cape, 33.9° S (panels face north, the equator).
   A, E, F: north–south section at solar noon on both solstices. C, D: east–west section at 09:00 solar time, 21 March.
   Values not fixed by the archetype spec (table width, bay and tunnel span, fence lower edge, arch rise) are drawn
   at illustrative sizes and labelled as such on the plate. */
(function(){
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', D2R = Math.PI / 180, LAT = -33.9;
  const W = 900, Hh = 400, G = 318;
  const el = (t, a, p) => { const n = document.createElementNS(NS, t); for (const k in a) n.setAttribute(k, a[k]); if (p) p.appendChild(n); return n; };
  const txt = (p, x, y, s, a = {}) => { const n = el('text', Object.assign({ x, y, fill: '#9aa6b8', 'font-size': 14, 'font-family': 'JetBrains Mono, monospace' }, a), p); n.textContent = s; return n; };

  // in-plane sun direction (unit vector toward the sun, +x right, +y up)
  function sunNS(decl){ const e = 90 - Math.abs(LAT - decl); return { e, dx: Math.cos(e * D2R), dy: Math.sin(e * D2R) }; } // sun to the north (right)
  function sunEW(hour){ const h = 15 * (hour - 12) * D2R, p = LAT * D2R; const east = -Math.sin(h), up = Math.cos(p) * Math.cos(h); const L = Math.hypot(east, up); return { e: Math.atan2(up, Math.abs(east)) / D2R, dx: east / L, dy: up / L }; }

  function frame(svg, k, x0, label){
    const g = el('g', {}, svg);
    for (let m = 0; m * k < W; m++){ el('line', { x1: x0 + m * k, y1: 20, x2: x0 + m * k, y2: G + 50, stroke: 'rgba(255,255,255,.035)' }, g); }
    for (let m = 0; G - m * k > 20; m++){ el('line', { x1: 0, y1: G - m * k, x2: W, y2: G - m * k, stroke: 'rgba(255,255,255,.035)' }, g); }
    el('rect', { x: 0, y: G, width: W, height: 14, fill: '#4a4231' }, g);
    el('line', { x1: 0, y1: G, x2: W, y2: G, stroke: '#e8eef6', 'stroke-width': 1.2 }, g);
    for (let x = 14; x < W; x += 13){ el('path', { d: `M${x} ${G} l-2.5 -7 M${x} ${G} l2.5 -7 M${x} ${G} v-9`, stroke: '#6cc47c', 'stroke-width': 1.2, 'stroke-linecap': 'round', fill: 'none' }, g); }
    txt(svg, 16, 32, label, { fill: '#6b778a', 'font-size': 13 });
    // scale bar: 5 m
    el('rect', { x: W - 16 - 5 * k, y: G + 30, width: 5 * k, height: 3, fill: '#e8eef6' }, svg);
    txt(svg, W - 16, G + 52, '5 m', { 'text-anchor': 'end', fill: '#e8eef6' });
    txt(svg, 16, G + 52, 'True scale · 1 m = ' + k + ' px', { fill: '#6b778a', 'font-size': 12 });
  }
  function dimV(svg, x, y1, y2, label, side = 1){
    el('line', { x1: x, y1, x2: x, y2, stroke: '#9aa6b8', 'stroke-width': 1 }, svg);
    [y1, y2].forEach(y => el('line', { x1: x - 5, y1: y, x2: x + 5, y2: y, stroke: '#9aa6b8' }, svg));
    txt(svg, x + 10 * side, (y1 + y2) / 2 + 5, label, { 'text-anchor': side > 0 ? 'start' : 'end', fill: '#e8eef6' });
  }
  function dimH(svg, x1, x2, y, label){
    el('line', { x1, y1: y, x2, y2: y, stroke: '#9aa6b8' }, svg);
    [x1, x2].forEach(x => el('line', { x1: x, y1: y - 5, x2: x, y2: y + 5, stroke: '#9aa6b8' }, svg));
    txt(svg, (x1 + x2) / 2, y - 9, label, { 'text-anchor': 'middle', fill: '#e8eef6' });
  }
  function sunGlyph(svg, cx, cy, s, label, dashed){
    const R = Math.min(230, (cy - 42) / Math.max(s.dy, 0.01)), sx = cx + s.dx * R, sy = cy - s.dy * R;
    el('circle', { cx: sx, cy: sy, r: dashed ? 9 : 13, fill: dashed ? 'rgba(245,184,61,.35)' : '#f5b83d', stroke: '#f5b83d' }, svg);
    txt(svg, sx + (s.dx >= 0 ? -16 : 16), sy - 18, label, { 'text-anchor': s.dx >= 0 ? 'end' : 'start', fill: '#f5b83d', 'font-size': 13 });
  }
  // shadow of segment (x1,h1)-(x2,h2) in metres, along sun s; returns [xa,xb] on the ground in metres
  const shadow = (p, q, s) => { const a = p.x - p.y * s.dx / s.dy, b = q.x - q.y * s.dx / s.dy; return [Math.min(a, b), Math.max(a, b)]; };
  function drawShadow(svg, k, x0, span, op, dashed){
    el('rect', { x: x0 + span[0] * k, y: G + 1, width: (span[1] - span[0]) * k, height: 12, fill: `rgba(5,7,11,${Math.min(.92, op * 1.6)})`, stroke: dashed ? 'rgba(245,184,61,.5)' : 'none', 'stroke-dasharray': dashed ? '3 3' : null }, svg);
  }
  function ray(svg, k, x0, p, s, faint){
    const gx = p.x - p.y * s.dx / s.dy, L = 9;
    el('line', { x1: x0 + (p.x + s.dx * L) * k, y1: G - (p.y + s.dy * L) * k, x2: x0 + gx * k, y2: G, stroke: '#f5b83d', 'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: faint ? .45 : .85 }, svg);
  }

  const PLATES = {
    A(svg){ // overhead stilted, fixed: clearance 4.5 m (lower edge), tilt 12° to the equator, GCR 0.30
      const k = 26, x0 = 60, tilt = 12, w = 3.0, pitch = w / 0.30, low = 4.5;
      frame(svg, k, x0, 'Section N–S · looking east · north →');
      const sum = sunNS(-23.44), win = sunNS(23.44);
      const tables = [2, 2 + pitch, 2 + 2 * pitch].map(xs => {
        const hx = w * Math.cos(tilt * D2R), hy = w * Math.sin(tilt * D2R);
        return { hi: { x: xs, y: low + hy }, lo: { x: xs + hx, y: low } };          // north edge low: faces north
      });
      tables.forEach(t => { drawShadow(svg, k, x0, shadow(t.hi, t.lo, win), .22, true); drawShadow(svg, k, x0, shadow(t.hi, t.lo, sum), .5); });
      ray(svg, k, x0, tables[1].lo, sum); ray(svg, k, x0, tables[1].hi, win, true);
      tables.forEach(t => {
        [t.hi, t.lo].forEach(p => el('line', { x1: x0 + p.x * k, y1: G, x2: x0 + p.x * k, y2: G - p.y * k, stroke: '#9aa6b8', 'stroke-width': 2.5 }, svg));
        el('line', { x1: x0 + t.hi.x * k, y1: G - t.hi.y * k, x2: x0 + t.lo.x * k, y2: G - t.lo.y * k, stroke: '#4a9eda', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
      });
      dimV(svg, x0 + tables[2].lo.x * k + 22, G, G - low * k, 'clearance 4.5 m');
      dimH(svg, x0 + tables[0].hi.x * k, x0 + tables[1].hi.x * k, G - 6.4 * k, 'GCR 0.30 · table width illustrative');
      txt(svg, x0 + (tables[1].hi.x + tables[1].lo.x) / 2 * k, G - (low - .8) * k, 'tilt 12° → north', { fill: '#e8eef6', 'text-anchor': 'middle' });
      sunGlyph(svg, 640, 200, sum, 'solstice noon, 21 Dec · ' + sum.e.toFixed(0) + '°');
      sunGlyph(svg, 640, 200, win, '21 Jun · ' + win.e.toFixed(0) + '°', true);
    },
    C(svg){ // vertical bifacial E–W fence: top 2.5 m, rows 10 m apart
      const k = 26, x0 = 70, top = 2.5, bottom = 0.6;
      frame(svg, k, x0, 'Section W–E · looking north · east →');
      const s = sunEW(9);
      const rows = [4, 14, 24];
      rows.forEach(x => drawShadow(svg, k, x0, shadow({ x, y: top }, { x, y: bottom }, s), .5));
      ray(svg, k, x0, { x: rows[1], y: top }, s);
      rows.forEach(x => {
        el('line', { x1: x0 + x * k, y1: G, x2: x0 + x * k, y2: G - top * k, stroke: '#9aa6b8', 'stroke-width': 2.5 }, svg);
        el('line', { x1: x0 + x * k, y1: G - bottom * k, x2: x0 + x * k, y2: G - top * k, stroke: '#4a9eda', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
      });
      dimV(svg, x0 + rows[2] * k + 18, G, G - top * k, 'height 2.5 m');
      dimH(svg, x0 + rows[0] * k, x0 + rows[1] * k, G - 4.2 * k, 'rows 10 m apart');
      txt(svg, x0 + rows[0] * k + 10, G - .3 * k - 14, 'lower edge illustrative', { 'font-size': 12, fill: '#6b778a' });
      sunGlyph(svg, 450, 230, s, '09:00 · 21 Mar · ' + s.e.toFixed(0) + '° profile');
      txt(svg, 16, 54, 'Advisory only within 20° of the equator', { fill: '#e0a84a', 'font-size': 13 });
    },
    D(svg){ // single-axis tracker: hub 2.5 m, pitch 9.5 m, GCR 0.30 (module width 2.85 m), ±55°
      const k = 28, x0 = 50, hub = 2.5, pitch = 9.5, hw = 0.30 * pitch / 2;
      frame(svg, k, x0, 'Section W–E · looking north · east →');
      const s = sunEW(9), ideal = Math.min(55, Math.atan2(s.dx, s.dy) / D2R);
      const rows = [4, 4 + pitch, 4 + 2 * pitch];
      const mod = (x, th) => { const c = Math.cos(th * D2R), sn = Math.sin(th * D2R); return { a: { x: x + hw * c, y: hub - hw * sn }, b: { x: x - hw * c, y: hub + hw * sn } }; };
      rows.forEach(x => { const m = mod(x, ideal); drawShadow(svg, k, x0, shadow(m.a, m.b, s), .5); });
      ray(svg, k, x0, mod(rows[1], ideal).b, s);
      rows.forEach((x, i) => {
        const m = mod(x, ideal);
        el('line', { x1: x0 + x * k, y1: G, x2: x0 + x * k, y2: G - hub * k, stroke: '#9aa6b8', 'stroke-width': 2.5 }, svg);
        el('line', { x1: x0 + m.a.x * k, y1: G - m.a.y * k, x2: x0 + m.b.x * k, y2: G - m.b.y * k, stroke: '#4a9eda', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg);
        el('circle', { cx: x0 + x * k, cy: G - hub * k, r: 4, fill: '#0e1522', stroke: '#e8eef6' }, svg);
        if (i === 2){ // ±55° range arc
          const r = hw * k + 14, cx = x0 + x * k, cy = G - hub * k;
          const p = (deg) => [cx + r * Math.sin(deg * D2R), cy - r * Math.cos(deg * D2R)];
          const [ax, ay] = p(-55), [bx, by] = p(55);
          el('path', { d: `M${ax} ${ay} A${r} ${r} 0 0 1 ${bx} ${by}`, stroke: '#a9d841', fill: 'none', 'stroke-dasharray': '3 4' }, svg);
          txt(svg, bx + 6, by + 4, '±55°', { fill: '#a9d841' });
        }
      });
      dimV(svg, x0 + rows[0] * k - 24, G, G - hub * k, 'hub 2.5 m', -1);
      dimH(svg, x0 + rows[0] * k, x0 + rows[1] * k, G - 4.9 * k, 'pitch 9.5 m · GCR 0.30');
      txt(svg, x0 + rows[1] * k, G - (hub + 1.6) * k, 'tracking ' + ideal.toFixed(0) + '° east', { 'text-anchor': 'middle', fill: '#e8eef6' });
      sunGlyph(svg, 470, 230, s, '09:00 · 21 Mar · ' + s.e.toFixed(0) + '° profile');
    },
    E(svg){ // PV rain-shelter / fruit canopy: clearance 2.5–3.5 m, ~35–40 % module transparency
      const k = 28, x0 = 200, eave = 2.8, ridge = 3.4, bay = 6;
      frame(svg, k, x0, 'Section N–S · looking east · north →');
      const sum = sunNS(-23.44);
      const bays = [1, 1 + bay, 1 + 2 * bay, 1 + 3 * bay];
      bays.forEach(x => {
        const l = { x, y: eave }, m = { x: x + bay / 2, y: ridge }, r = { x: x + bay, y: eave };
        // semi-transparent modules: the ground under them is lightly shaded, not dark
        drawShadow(svg, k, x0, shadow(l, r, sum), .22);
        [l, r].forEach(p => el('line', { x1: x0 + p.x * k, y1: G, x2: x0 + p.x * k, y2: G - p.y * k, stroke: '#9aa6b8', 'stroke-width': 2.5 }, svg));
        el('path', { d: `M${x0 + l.x * k} ${G - l.y * k} L${x0 + m.x * k} ${G - m.y * k} L${x0 + r.x * k} ${G - r.y * k}`, stroke: '#4a9eda', 'stroke-width': 6, fill: 'none', 'stroke-dasharray': '10 4', opacity: .9 }, svg);
      });
      ray(svg, k, x0, { x: bays[1] + bay / 2, y: ridge }, sum);
      dimV(svg, x0 + bays[0] * k - 16, G, G - eave * k, 'clearance 2.5–3.5 m', -1);
      dimH(svg, x0 + bays[0] * k, x0 + bays[1] * k, G - 4.6 * k, 'bay illustrative');
      txt(svg, x0 + bays[2] * k, G - (ridge + .5) * k, '~35–40 % transparent modules', { fill: '#e8eef6' });
      sunGlyph(svg, 640, 220, sum, 'solstice noon, 21 Dec · ' + sum.e.toFixed(0) + '°');
    },
    F(svg){ // PV polytunnel / greenhouse roof: gutter 4–5 m, roof PV coverage 25–40 %
      const k = 26, x0 = 150, gutter = 4.5, rise = 1.6, span = 9;
      frame(svg, k, x0, 'Section N–S · looking east · north →');
      const sum = sunNS(-23.44);
      [1, 1 + span, 1 + 2 * span].forEach((x, ti) => {
        const pts = []; for (let i = 0; i <= 24; i++){ const t = i / 24; pts.push({ x: x + t * span, y: gutter + rise * Math.sin(Math.PI * t) }); }
        drawShadow(svg, k, x0, [x + .3 * span, x + .62 * span].map(v => v - (gutter + rise) * sum.dx / sum.dy), .28);
        [x, x + span].forEach(px => el('line', { x1: x0 + px * k, y1: G, x2: x0 + px * k, y2: G - gutter * k, stroke: '#9aa6b8', 'stroke-width': 2.5 }, svg));
        el('path', { d: 'M' + pts.map(p => (x0 + p.x * k).toFixed(1) + ' ' + (G - p.y * k).toFixed(1)).join(' L'), stroke: 'rgba(232,238,246,.45)', 'stroke-width': 2, fill: 'none' }, svg);
        // PV strips on ~32 % of the arch length (alternate strips)
        for (let s = 0; s < 24; s += 3){ const a = pts[s], b = pts[s + 1]; el('line', { x1: x0 + a.x * k, y1: G - a.y * k, x2: x0 + b.x * k, y2: G - b.y * k, stroke: '#4a9eda', 'stroke-width': 7, 'stroke-linecap': 'round' }, svg); }
        if (ti === 1) ray(svg, k, x0, pts[12], sum);
      });
      dimV(svg, x0 + 1 * k - 22, G, G - gutter * k, 'gutter 4–5 m', -1);
      dimH(svg, x0 + (1 + span) * k, x0 + (1 + 2 * span) * k, G - (gutter + rise + .9) * k, 'span and arch illustrative');
      txt(svg, 16, 56, 'Roof under PV: 25 % default, 10–40 % range (about a third drawn)', { fill: '#e8eef6', 'font-size': 13 });
      sunGlyph(svg, 640, 200, sum, 'solstice noon, 21 Dec · ' + sum.e.toFixed(0) + '°');
    },
  };
  document.querySelectorAll('[data-arch-plate]').forEach(host => {
    const id = host.dataset.archPlate, f = PLATES[id]; if (!f) return;
    const svg = el('svg', { viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': host.dataset.label || ('Cross-section of archetype ' + id) });
    el('rect', { x: 0, y: 0, width: W, height: Hh, fill: '#0a1019' }, svg);
    f(svg); host.appendChild(svg);
  });
})();
