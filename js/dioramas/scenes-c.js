/* LUMEN8 site - product dioramas, part 3: Rooftop solar (HelioAtlas). Same camera, light
 * and plinth as parts 1 and 2 (./iso.js); helpers mirror scenes-b.js. */
import { Iso, P, pp, lit, shade } from './iso.js';

const INK = '#1b2436';
const n2 = (v) => Math.round(v * 100) / 100;
const q3 = (q) => pp(q.map((p) => P(...p)));
const d3 = (q) => q.map((p, i) => (i ? 'L' : 'M') + P(...p).map(n2).join(',')).join(' ');
const path = (q, c, w, ex = '') => `<path d="${d3(q)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${ex}/>`;
const poly = (q, fill, ex = '') => `<polygon points="${q3(q)}" fill="${fill}" ${ex}/>`;
const pad = (s, x, y, w, d, fill, ex = '') => s.patch([[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]], fill, ex);

/* Roof-mounted PV on the front slope of an s.house(). */
function roofPV(s, x, y, w, d, h, u0 = 0.12, u1 = 0.88) {
  const rh = d * 0.42, o = 1.3, m = y + d / 2;
  const at = (u, t) => [x - o + (w + 2 * o) * u, y + d + o + (m - y - d - o) * t, h + rh * t];
  let g = poly([at(u0, 0.16), at(u1, 0.16), at(u1, 0.84), at(u0, 0.84)], s.lin([[0, '#6d9ee6'], [0.5, '#2c58a8'], [1, '#17336e']], 1, 1), 'stroke="#eef3f9" stroke-width=".35"');
  for (let i = 1; i < 5; i++) { const u = u0 + (u1 - u0) * i / 5; g += path([at(u, 0.16), at(u, 0.84)], '#ffffff', 0.18, 'stroke-opacity=".4"'); }
  s.raw(x + w / 2 + y + d / 2 + 0.05, g);
}

/* A score tag floating over a roof: a ring on the roof and a numbered disc that bobs. */
function score(s, x, y, z, n, c, delay = 0) {
  s.ring({ x, y, z: z + 0.2, r: 3.4, c, w: 0.6, op: 0.85, depth: 940 });
  const [cx, cy] = P(x, y, z + 9), g = s.lin([[0, lit(c, 0.35)], [1, shade(c, 0.15)]], 1, 1);
  s.line([x, y, z + 0.4], [x, y, z + 6.6], { c, w: 0.4, op: 0.8, dash: '1 .9', depth: 941, cls: 'hx-flow' });
  s.raw(950, `<g class="hx-bob" style="animation-delay:${delay}s"><circle cx="${n2(cx)}" cy="${n2(cy)}" r="3.1" fill="${g}" stroke="#ffffff" stroke-width=".55"/>`
    + `<text x="${n2(cx)}" y="${n2(cy + 1.05)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="3" font-weight="700" fill="#ffffff">${n}</text></g>`);
}

/* Rooftop solar: a packhouse whose low roof carries row on row of panels, a forecourt with
   trucks and cars, a street of homes (the best roofs already fitted), and score tags over
   the roofs the studio ranked first. */
export function rooftop(u) {
  const s = new Iso(u), A = '#3f86c8';
  s.slab({ top: '#bcd99c', side: '#93ba74' });
  // road along the front and a side street; forecourt in front of the packhouse
  pad(s, 0, 62, 100, 7, '#dfe3e8'); pad(s, 62, 0, 6, 62, '#dfe3e8');
  for (let k = 2; k < 100; k += 7) pad(s, k, 65.2, 3.4, 0.6, '#ffffff');
  for (let k = 3; k < 60; k += 7) pad(s, 64.7, k, 0.6, 3.4, '#ffffff');
  pad(s, 4, 46, 56, 14, '#d4d8de');
  for (let k = 8; k < 58; k += 6) pad(s, k, 52, 0.4, 7, '#ffffff');
  // the packhouse: long low hall, dock doors on the front, a glazed office at the end
  const X = 6, Y = 8, W = 52, D = 34, H = 9;
  s.box({ x: X, y: Y, w: W, d: D, h: H, c: '#eef1f4', top: '#dfe4ea',
    decals: [...[0.06, 0.2, 0.34, 0.48, 0.62].map((v) => ['L', v, v + 0.1, 0, 0.62, '#9aa4b0']), ['L', 0, 1, 0.84, 0.92, '#c9d0d8'],
      ['L', 0.78, 0.97, 0.12, 0.7, 'glass'], ['R', 0.1, 0.9, 0.74, 0.84, 'glass'], ['R', 0.1, 0.9, 0.3, 0.36, '#c9d0d8']] });
  // panel rows across the roof, a walkway between the two blocks; drawn just after the hall so the roof never covers them
  for (let i = 0; i < 7; i++) for (const [x0, w] of [[X + 2, 22], [X + 27, 22]]) s.panel({ x: x0, y: Y + 2.2 + i * 4.4, z: H + 0.4, w, d: 3.2, rise: 1.3, cols: 8, rows: 2, legs: false, depth: X + W / 2 + Y + D / 2 + 0.5 + i * 0.01 + x0 * 0.0001 });
  // roof plant and an inverter skid at the gable
  s.box({ x: X + W - 6, y: Y + D - 5, z: H, w: 4, d: 3, h: 2.2, c: '#c3cad3', shadow: false, depth: X + W + Y + D + 4 });
  s.box({ x: X + W + 0.6, y: Y + 4, w: 2.4, d: 6, h: 3.4, c: '#f3f5f7', decals: [['R', 0, 1, 0.72, 0.9, A], ['R', 0.15, 0.85, 0.2, 0.55, '#aeb8c4']] });
  // trucks at the docks, cars in the bays
  s.box({ x: X + 4, y: Y + D + 1, w: 5.4, d: 14, h: 5.2, c: '#f4f5f7', top: '#ffffff', decals: [['R', 0, 1, 0.78, 0.9, A]] });
  s.box({ x: X + 4.4, y: Y + D + 15, w: 4.6, d: 3.6, h: 4.2, c: '#3f86c8', top: lit('#3f86c8', 0.3), decals: [['L', 0.1, 0.9, 0.2, 0.6, 'glass']] });
  s.car({ x: 24, y: 55, dir: 'y', l: 6.5, c: '#e05a4f' }); s.car({ x: 36, y: 55, dir: 'y', l: 6.5, c: '#f4f5f7' }); s.car({ x: 42, y: 55, dir: 'y', l: 6.5, c: '#2f7fd0' });
  s.car({ x: 70, y: 64.4, dir: 'x', l: 7, c: '#1faa6b' });
  // a street of homes; the two best-scored roofs are already fitted
  const homes = [[72, 4, '#cc6b4c', true], [86, 16, '#5f7fa6', false], [72, 30, '#d9964a', false], [86, 42, '#cc6b4c', true], [8, 76, '#5f7fa6', true], [30, 80, '#d9964a', false], [56, 76, '#cc6b4c', false], [80, 80, '#5f7fa6', true]];
  homes.forEach(([x, y, roof, pv]) => {
    s.house({ x, y, w: 12, d: 10, h: 7, roof, wall: '#fbf8f3' });
    if (pv) roofPV(s, x, y, 12, 10, 7);
  });
  [[64, 92, 0.8], [96, 6, 0.7], [97, 58, 0.7], [48, 96, 0.7], [2, 96, 0.7], [62, 2, 0.6]].forEach(([x, y, k]) => s.bush({ x, y, s: k }));
  [[22, 97, 0.7], [97, 30, 0.75], [4, 4, 0.7], [44, 72, 0.6]].forEach(([x, y, k]) => s.tree({ x, y, s: k }));
  s.person({ x: 14, y: 50, c: A }); s.person({ x: 50, y: 48, c: '#e8743b' }); s.person({ x: 70, y: 74, c: '#2f7fd0' });
  // the studio's ranking: number one is the packhouse, then two homes
  score(s, X + W / 2, Y + D / 2, H + 2, 1, A, 0);
  score(s, 78, 9, 11, 2, A, 0.6);
  score(s, 36, 85, 11, 3, A, 1.2);
  return s.render();
}
