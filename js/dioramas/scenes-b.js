/* Ported from the LUMEN8 platform (js/ui/home/scenes-b.js). Site copy: purple and pink accents
   recoloured to the site palette; geometry unchanged. */
/* LUMEN8 Home - product dioramas, part 2: Behavioral Twin, Utility, Wind,
 * Geothermal, Supply Chain, Aqua, Hydroponics, Hydropower. Same camera, light
 * and plinth as part 1; each scene's accent `A` is its colour in modules.js. */
import { Iso, P, pp, lit, shade, rng } from './iso.js';
import { lattice } from './scenes-a.js';

const n2 = (v) => Math.round(v * 100) / 100;
const INK = '#1b2436';
const q3 = (q) => pp(q.map((p) => P(...p)));
const d3 = (q) => q.map((p, i) => (i ? 'L' : 'M') + P(...p).map(n2).join(',')).join(' ');
const path = (q, c, w, ex = '') => `<path d="${d3(q)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${ex}/>`;
const poly = (q, fill, ex = '') => `<polygon points="${q3(q)}" fill="${fill}" ${ex}/>`;
const pad = (s, x, y, w, d, fill, ex = '') => s.patch([[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]], fill, ex);
const ell = (x, y, z, rx, ry, fill, ex = '') => { const [cx, cy] = P(x, y, z); return `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(rx)}" ry="${n2(ry)}" fill="${fill}" ${ex}/>`; };
/* Run `fn` and return what it drew as one string (to group it under a class). */
const grab = (s, fn) => { const n = s.items.length; fn(); return s.items.splice(n).sort((a, b) => a[0] - b[0]).map((i) => i[1]).join(''); };

/* Cut a polyline into ~len-unit pieces, each drawn by fn(p0, p1, level) at its own depth. */
function segs(s, pts, len, fn) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / len));
    for (let k = 0; k < n; k++) { const p = (t) => a.map((v, j) => v + (b[j] - v) * t), p0 = p(k / n), p1 = p((k + 1) / n); s.raw((p0[0] + p0[1] + p1[0] + p1[1]) / 2 + 0.2, fn(p0, p1, a[2] === b[2])); }
  }
}
/* A chain-link fence along [x, y] points; a pipe through [x, y, z] points with posts under level runs. */
const fence = (s, pts, h = 2.4, c = '#8d97a3') => segs(s, pts.map(([x, y]) => [x, y, 0]), 4, ([x0, y0], [x1, y1]) => poly([[x0, y0, 0], [x1, y1, 0], [x1, y1, h], [x0, y0, h]], c, 'fill-opacity=".13"')
  + path([[x0, y0, 0], [x0, y0, h], [x1, y1, h]], c, 0.3) + path([[x1, y1, 0], [x1, y1, h]], c, 0.3));
const pipe = (s, pts, c = '#cfd5dc', w = 1.2) => segs(s, pts, 5, (p0, p1, level) => (level && p0[2] > 0.6 ? path([[p0[0], p0[1], 0], p0], '#8f98a3', 0.45) : '')
  + path([p0, p1], shade(c, 0.32), w) + path([p0, p1], lit(c, 0.55), w * 0.35, 'transform="translate(-.12 -.3)"'));

/* A steam puff that rises and fades in the hero. */
function puff(s, x, y, z, r, delay) {
  const g = s.rad([[0, '#ffffff'], [0.65, '#f5f7fa'], [1, '#d5dde7']], 0.38, 0.32, 0.72), [cx, cy] = P(x, y, z);
  s.raw(900 + z, `<g class="hx-rise" style="animation-delay:${delay}s" opacity=".95">${[[-0.6, 0.3, 0.7], [0.62, 0.34, 0.64], [0, 0, 1]].map(([dx, dy, k]) =>
    `<circle cx="${n2(cx + dx * r)}" cy="${n2(cy + dy * r)}" r="${n2(r * k)}" fill="${g}"/>`).join('')}</g>`);
}

/* A lorry along y: cab at the +y end (-y with `back`), a ribbed box or container behind. */
function lorry(s, x, y, { l = 15, cab = '#f4f5f7', load = '#d9dde2', back = false } = {}) {
  const ty = back ? y + 4.4 : y, cy = back ? y : y + l - 4;
  const ribs = Array.from({ length: 9 }, (_, i) => ['R', (i + 1) / 10 - 0.012, (i + 1) / 10 + 0.012, 0.06, 0.94, shade(load, 0.22), 0.6]);
  s.box({ x, y: ty, z: 1.3, w: 3.6, d: l - 4.4, h: 4.6, c: load, decals: ribs });
  s.box({ x: x + 0.1, y: cy, z: 0.8, w: 3.4, d: 4, h: 4, c: cab,
    decals: back ? [['R', 0.12, 0.6, 0.5, 0.88, 'glass']] : [['L', 0.1, 0.9, 0.5, 0.88, 'glass'], ['R', 0.45, 0.9, 0.5, 0.88, 'glass']] });
  for (const wy of [cy + 2, ty + 2, ty + l - 7]) s.raw(x + y + l + 2, ell(x + 3.6, wy, 0.9, 0.95, 1.15, '#20252e'));
}

/* A 20 ft container, ribbed on its long side, doors on its end. */
function box20(s, x, y, z, c, depth, alongX = true) {
  const F = alongX ? 'L' : 'R', E = alongX ? 'R' : 'L';
  const dec = Array.from({ length: 11 }, (_, i) => [F, (i + 1) / 12 - 0.008, (i + 1) / 12 + 0.008, 0.05, 0.95, shade(c, 0.24), 0.55]);
  dec.push([E, 0.07, 0.48, 0.06, 0.94, shade(c, 0.08)], [E, 0.52, 0.93, 0.06, 0.94, shade(c, 0.08)]);
  s.box({ x, y, z, w: alongX ? 12 : 5, d: alongX ? 5 : 12, h: 5, c, decals: dec, depth, shadow: z < 1 });
}

/* A map pin standing at (x, y), tip at height z. */
function pin(s, x, y, z, c) {
  const [cx, cy] = P(x, y, z), g = s.lin([[0, lit(c, 0.3)], [1, shade(c, 0.2)]], 1, 1);
  s.shadows.push(ell(x + 1, y + 0.5, 0, 3.2, 1.6, INK, 'opacity=".2"'));
  s.ring({ x, y, z: 0.1, r: 4, c, w: 0.7, op: 0.8, depth: x + y });
  s.raw(960, `<g class="hx-bob"><path d="M${n2(cx)},${n2(cy)} c-1.3,-2.8 -4.6,-5.4 -4.6,-8.8 a4.6,4.6 0 1 1 9.2,0 c0,3.4 -3.3,6 -4.6,8.8z" fill="${g}" stroke="#ffffff" stroke-width=".6"/>`
    + `<circle cx="${n2(cx)}" cy="${n2(cy - 8.8)}" r="1.8" fill="#ffffff"/></g>`);
}

/* Roof-mounted PV on the front slope of an s.house(). */
function roofPV(s, x, y, w, d, h) {
  const rh = d * 0.42, o = 1.3, m = y + d / 2;
  const at = (u, t) => [x - o + (w + 2 * o) * u, y + d + o + (m - y - d - o) * t, h + rh * t];
  let g = poly([at(0.12, 0.16), at(0.88, 0.16), at(0.88, 0.84), at(0.12, 0.84)], s.lin([[0, '#6d9ee6'], [0.5, '#2c58a8'], [1, '#17336e']], 1, 1), 'stroke="#eef3f9" stroke-width=".35"');
  for (let i = 1; i < 5; i++) g += path([at(0.12 + 0.76 * i / 5, 0.16), at(0.12 + 0.76 * i / 5, 0.84)], '#ffffff', 0.18, 'stroke-opacity=".4"');
  s.raw(x + w / 2 + y + d / 2 + 0.05, g);
}

/* Behavioral Twin: a street of real homes with meters, people and an EV, and
   above it a wireframe model of the same street, each home tied to its twin
   and every twin wired to one pulsing hub. */
export function twin(u) {
  const s = new Iso(u), A = '#3f86c8', K = 0.5, Z = 46;
  const T = (x, y, z) => [50 + (x - 50) * K, 50 + (y - 50) * K, Z + z * 0.62];
  s.slab({ top: '#b5d995', side: '#8cba6c' });
  pad(s, 0, 56, 100, 6, '#e1e5ea'); pad(s, 54, 0, 6, 100, '#e1e5ea');
  for (let k = 1; k < 100; k += 6) if (k < 50 || k > 64) { pad(s, k, 58.7, 3, 0.6, '#ffffff'); pad(s, 56.7, k, 0.6, 3, '#ffffff'); }
  s.ground.push(ell(26, 28, 0, 20.8, 12, 'none', 'stroke="#efe6d1" stroke-width="2.2"') + path([[38, 40, 0], [46, 46, 0]], '#efe6d1', 2.2)
    + ell(22, 26, 0, 8.5, 4.6, s.lin([[0, '#9bd3ef'], [1, '#4f9fcb']], 1, 1), 'stroke="#e9f6fb" stroke-width=".6"'));
  const homes = [[64, 8, '#cc6b4c'], [82, 26, '#5f7fa6'], [8, 66, '#d9964a'], [30, 77, '#5f7fa6'], [64, 68, '#cc6b4c'], [82, 84, '#d9964a']];
  homes.forEach(([x, y, roof], i) => {
    pad(s, x + 3, y + 11, 5, 3.5, '#ece4d2');
    s.house({ x, y, w: 14, d: 11, h: 8, roof, wall: '#fbf8f3' });
    if (i % 2 === 0) roofPV(s, x, y, 14, 11, 8);
    s.box({ x: x + 14.3, y: y + 7, w: 0.9, d: 1.8, h: 2.8, c: '#9aa4b0', shadow: false, decals: [['R', 0.25, 0.75, 0.6, 0.82, A]] });
  });
  s.car({ x: 66, y: 80.6, dir: 'x', l: 7, c: '#2f7fd0' });
  s.box({ x: 74, y: 81, w: 0.8, d: 0.8, h: 3, c: '#eef1f4', shadow: false, decals: [['L', 0, 1, 0.6, 0.85, A]] });
  s.box({ x: 45, y: 45, w: 6, d: 6, h: 5.5, c: '#f4f5f7', top: '#ffffff', decals: [['L', 0, 1, 0.72, 0.86, A], ['R', 0, 1, 0.72, 0.86, A], ['L', 0.3, 0.7, 0.08, 0.55, '#c9d0d8'], ['R', 0.25, 0.75, 0.2, 0.5, '#c9d0d8']] });
  for (let x = 3; x < 52; x += 6) s.bush({ x, y: 52.5, s: 0.55, c: '#5da860' });
  [[6, 8], [44, 8], [6, 42], [40, 24], [96, 50], [94, 70], [4, 94], [50, 96]].forEach(([x, y]) => s.bush({ x, y, s: 0.8 }));
  [[36, 12, 0.7], [12, 36, 0.7], [96, 4, 0.7]].forEach(([x, y, k]) => s.tree({ x, y, s: k }));
  const folk = [[40, 58, '#2f7fd0'], [57, 42, '#e8743b'], [18, 44, A], [72, 60, '#1faa6b'], [30, 26, '#f2b84b'], [24, 94, '#2f7fd0'], [57, 88, '#e05a4f']];
  folk.forEach(([x, y, c]) => s.person({ x, y, c }));
  // the twin: a translucent plate with the same street drawn in wire
  let g = poly([[0, 0, 0], [100, 0, 0], [100, 100, 0], [0, 100, 0]].map((p) => T(...p)), s.lin([[0, lit(A, 0.6), 0.36], [1, A, 0.12]], 1, 1), `stroke="${A}" stroke-opacity=".75" stroke-width=".55"`);
  for (let k = 10; k < 100; k += 10) g += path([T(k, 0, 0), T(k, 100, 0)], A, 0.22, 'stroke-opacity=".3"') + path([T(0, k, 0), T(100, k, 0)], A, 0.22, 'stroke-opacity=".3"');
  g += poly([[0, 56, 0], [100, 56, 0], [100, 62, 0], [0, 62, 0]].map((p) => T(...p)), A, 'fill-opacity=".16"') + poly([[54, 0, 0], [60, 0, 0], [60, 100, 0], [54, 100, 0]].map((p) => T(...p)), A, 'fill-opacity=".16"');
  homes.forEach(([x, y]) => { g += path([T(50, 50, 0), T(x + 7, y + 5.5, 0)], A, 0.35, 'stroke-opacity=".65"'); });
  const W = (q, o) => poly(q.map((p) => T(...p)), A, `fill-opacity="${o}" stroke="${shade(A, 0.12)}" stroke-width=".5" stroke-linejoin="round"`);
  [...homes].sort((a, b) => a[0] + a[1] - b[0] - b[1]).forEach(([x, y]) => {
    const w = 14, d = 11, h = 8, r = h + d * 0.42, m = y + d / 2;
    g += W([[x, y, h], [x + w, y, h], [x + w, m, r], [x, m, r]], 0.4) + W([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]], 0.18)
      + W([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]], 0.3) + W([[x + w, y, h], [x + w, y + d, h], [x + w, m, r]], 0.3)
      + W([[x, y + d, h], [x + w, y + d, h], [x + w, m, r], [x, m, r]], 0.46);
  });
  folk.forEach(([x, y]) => { const [px, py] = P(...T(x, y, 1)); g += `<circle cx="${n2(px)}" cy="${n2(py)}" r=".95" fill="${A}"/>`; });
  // each twin carries its modelled load as a small bar
  g += grab(s, () => homes.forEach(([x, y], i) => { const [bx, by, bz] = T(x + 16.5, y + 1, 0); s.box({ x: bx, y: by, z: bz, w: 1.5, d: 1.5, h: [5, 9, 4, 11, 7, 6][i], c: A, top: lit(A, 0.45), shadow: false, ao: false }); }));
  s.raw(900, `<g class="hx-bob">${g}</g>`);
  homes.forEach(([x, y]) => s.line([x + 7, y + 5.5, 12.6], T(x + 7, y + 5.5, 12.6), { c: A, w: 0.5, op: 0.85, dash: '1.2 1.3', depth: 880, cls: 'hx-flow' }));
  s.line([48, 48, 5.5], [50, 50, Z + 2], { c: A, w: 0.9, dash: '1.6 1.2', depth: 885, cls: 'hx-flow' });
  s.glow({ x: 50, y: 50, z: Z + 5, r: 11, c: A, op: 0.5, depth: 905 });
  s.ring({ x: 50, y: 50, z: Z + 5, r: 6.5, c: A, w: 0.5, op: 0.8, dash: '1.5 1', depth: 910 });
  s.sphere({ x: 50, y: 50, z: Z + 5, r: 3, c: A, depth: 910, shadow: false, cls: 'hx-pulse' });
  return s.render();
}

/* Utility: long rows of PV tables split by an aisle of inverter skids, two
   lines of battery containers, a fenced substation and a lattice tower
   carrying the lines off the site. */
export function utility(u) {
  const s = new Iso(u), A = '#d98a1f', G = '#e9e1cd';
  s.slab({ top: '#c4daa3', side: '#9dbd7a' });
  pad(s, 62, 0, 6, 100, G); pad(s, 29.3, 0, 3.4, 96, '#dcd3bc'); pad(s, 68, 42, 32, 4, G);
  for (let i = 0; i < 15; i++) for (const x of [3, 33]) s.panel({ x, y: 3 + i * 6.2, w: 26, d: 3.8, z: 1.4, rise: 2.2, cols: 10, rows: 2 });
  for (const y of [11, 42, 73]) s.box({ x: 29.6, y, w: 2.8, d: 4.6, h: 3.4, c: '#f3f5f7', top: '#ffffff', decals: [['L', 0, 1, 0.72, 0.9, A], ['R', 0, 1, 0.72, 0.9, A], ['R', 0.12, 0.88, 0.16, 0.6, '#aeb8c4']] });
  for (const x of [71, 84]) for (const y of [3, 15.5, 28]) s.box({ x, y, w: 6, d: 10.5, h: 5.6, c: '#f2f4f6', top: '#fbfcfd',
    decals: [...[0.05, 0.21, 0.37, 0.53, 0.69, 0.85].map((v) => ['R', v, v + 0.11, 0.08, 0.84, A]), ['L', 0.14, 0.86, 0.3, 0.8, '#b9c2cc'], ['T', 0.15, 0.85, 0.12, 0.3, '#dfe4ea']] });
  pad(s, 71, 49, 27, 24, '#dde1e6');
  fence(s, [[71, 49], [98, 49], [98, 73], [71, 73], [71, 49]]);
  for (const y of [52, 61]) {
    s.box({ x: 74, y, w: 6, d: 7, h: 5.5, c: '#8d99a7', decals: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((v) => ['L', v, v + 0.07, 0.08, 0.9, '#6f7b89']) });
    for (let i = 0; i < 3; i++) s.cyl({ x: 75.6 + i * 1.5, y: y + 3.5, z: 5.5, r: 0.45, h: 2.6, c: '#eef1f4', shadow: false, depth: 81.2 + y + i * 0.01 });
  }
  for (const x of [84, 92]) { for (const y of [51, 64]) s.box({ x, y, w: 0.8, d: 0.8, h: 11, c: '#9aa4b0', shadow: false }); s.box({ x, y: 51, z: 10.2, w: 0.8, d: 13.8, h: 0.8, c: '#9aa4b0', shadow: false, depth: x + 58 }); }
  for (const y of [54, 58, 62]) s.line([80, y, 8.2], [92.4, y, 10.6], { c: '#5b6470', w: 0.35, depth: 160 });
  s.box({ x: 86, y: 66, w: 10, d: 5, h: 4.6, c: '#f3f5f7', decals: [['L', 0, 1, 0.74, 0.9, A], ['L', 0.1, 0.24, 0, 0.6, '#8f99a6'], ['L', 0.34, 0.9, 0.3, 0.6, 'glass'], ['R', 0, 1, 0.74, 0.9, A]] });
  lattice(s, 77, 82, 8, 34, 2.2, '#8b95a2');
  const fade = s.lin([[0, '#4b5563', 0], [1, '#4b5563', 0.9]], 1, 0);
  const arms = [[74.5, 30], [87.5, 30], [76, 25.5], [86, 25.5]];
  for (const [ax, az] of arms) s.raw(167.3, `<path d="M${P(ax, 86, az).map(n2).join(',')} Q${P(ax - 2, 100, az - 5).map(n2).join(',')} ${P(ax - 4, 116, az - 3).map(n2).join(',')}" fill="none" stroke="${fade}" stroke-width=".4"/>`);
  for (const [ax, az] of arms.slice(0, 3)) s.line([92.4, 58, 10.6], [ax, 86, az], { c: '#5b6470', w: 0.35, sag: 1.5, depth: 160 });
  for (const [a0, a1, az] of [[74.5, 87.5, 30], [76, 86, 25.5]]) s.line([a0, 86, az], [a1, 86, az], { c: '#8b95a2', w: 0.8, depth: 167.2 });
  s.car({ x: 63.3, y: 56, dir: 'y', l: 8, c: A });
  s.box({ x: 63.9, y: 59.5, z: 4, w: 2.2, d: 0.8, h: 0.5, c: '#ffd07a', shadow: false, depth: 134 });
  s.person({ x: 80.6, y: 10, c: A }); s.person({ x: 81, y: 24, c: '#f2b84b' }); s.person({ x: 69.5, y: 80, c: A });
  fence(s, [[1, 98.6], [60, 98.6]], 2);
  [[66, 97, 0.7], [99, 44, 0.7], [96, 80, 0.8], [92, 94, 0.7], [70, 92, 0.6]].forEach(([x, y, k]) => s.bush({ x, y, s: k })); s.tree({ x: 94, y: 88, s: 0.75 });
  return s.render();
}

/* A three-blade turbine: tapered tower, accent band, nacelle, hx-rotor blades. */
function turbine(s, x, y, H, L, A) {
  const [bx, by] = P(x, y, 0), [tx, ty] = P(x, y, H);
  s.ground.push(ell(x, y, 0, 4.4, 2.5, '#ebe6da') + ell(x, y, 0, 2.7, 1.55, '#d6d0c2'));
  const g = s.lin([[0, '#d2d8df'], [0.35, '#ffffff'], [1, '#bcc4ce']], 1, 0);
  s.raw(x + y, `<polygon points="${pp([[bx - 1.9, by], [bx + 1.9, by], [tx + 0.8, ty], [tx - 0.8, ty]])}" fill="${g}"/>`
    + `<polygon points="${pp([[bx - 1.87, by - 3], [bx + 1.87, by - 3], [bx + 1.84, by - 4.6], [bx - 1.84, by - 4.6]])}" fill="${A}"/>`);
  s.shadows.push(poly([[x, y, 0], [x + H * 0.55, y + H * 0.16, 0], [x + H * 0.55, y + H * 0.16 + 1.4, 0], [x, y + 1.4, 0]], INK, 'opacity=".12"'));
  s.box({ x: x - 1.7, y: y - 3.4, z: H - 1.3, w: 3.4, d: 6, h: 3, c: '#f4f5f7', shadow: false, depth: x + y + 0.1, decals: [['R', 0.08, 0.92, 0.34, 0.5, A], ['L', 0.1, 0.9, 0.34, 0.5, A]] });
  const [hx, hy] = P(x, y + 2.9, H + 0.3);
  const blade = `M0,0 L1.4,-3 L0.6,-${L - 0.6} L-0.2,-${L} L-1.05,-3 Z`, tip = `M0.7,-${L - 3.5} L0.6,-${L - 0.6} L-0.2,-${L} L-0.37,-${L - 3.5} Z`;
  s.raw(x + y + 0.2, `<g transform="translate(${n2(hx)} ${n2(hy)})"><g class="hx-rotor" style="animation-duration:${(5 + (x % 3)).toFixed(1)}s">` +
    [0, 120, 240].map((a) => `<g transform="rotate(${a})"><path d="${blade}" fill="#ffffff" stroke="#c3cad3" stroke-width=".3"/><path d="${tip}" fill="${A}"/></g>`).join('') +
    '</g>' +
    `<circle r="1.5" fill="${s.rad([[0, '#ffffff'], [1, '#c9d0d8']])}" stroke="#b9c1cb" stroke-width=".3"/></g>`);
}

/* A low grassy mound: the front half of its footprint under a raised crown. */
function mound(s, x, y, r, h, c) {
  const [cx, cy] = P(x, y, 0), rx = r * 1.2247, ry = r * 0.7071, k = (ry + h) * 1.33;
  s.shadows.push(ell(x + 1.5, y + 0.6, 0, rx * 1.05, ry * 1.1, INK, 'opacity=".1"'));
  s.raw(x + y - r * 0.6, `<path d="M${n2(cx - rx)},${n2(cy)} A${n2(rx)},${n2(ry)} 0 0 0 ${n2(cx + rx)},${n2(cy)} C${n2(cx + rx * 0.75)},${n2(cy - k)} ${n2(cx - rx * 0.75)},${n2(cy - k)} ${n2(cx - rx)},${n2(cy)} Z" fill="${s.rad([[0, lit(c, 0.32)], [0.6, c], [1, shade(c, 0.14)]], 0.36, 0.3, 0.8)}"/>`);
}

/* Wind: three turbines over rolling farmland, a gravel road with crane pads,
   buried cables to a small substation, a met mast, pines and hedgerows. */
export function wind(u) {
  const s = new Iso(u), A = '#3aa0c8';
  s.slab({ top: '#b0d68a', side: '#86b566' });
  [[0, 0, 40, 42, '#a3cf7c'], [44, 0, 56, 34, '#c2e0a0'], [0, 64, 30, 36, '#bddc97'], [66, 72, 34, 28, '#a0cb7a'], [44, 38, 20, 24, '#b9da93']].forEach(([x, y, w, d, c], i) => {
    pad(s, x + 1, y + 1, w - 2, d - 2, c);
    if (i % 2 === 0) for (let k = y + 3; k < y + d - 2; k += 2.6) s.ground.push(path([[x + 2, k, 0], [x + w - 2, k, 0]], lit(c, 0.28), 0.35, 'stroke-opacity=".7"'));
  });
  mound(s, 88, 42, 11, 4.5, '#a9d484'); mound(s, 42, 6, 9, 3.5, '#b8dc93'); mound(s, 58, 30, 8, 3, '#b3d98e');
  const road = [[[30, 100, 0], [40, 88, 0], [60, 81, 0], [83, 76, 0]], [[40, 88, 0], [36, 72, 0], [30, 58, 0], [21, 47, 0]], [[33, 64, 0], [50, 52, 0], [68, 40, 0], [80, 22, 0]], [[36, 72, 0], [40, 66, 0]]];
  s.ground.push(road.map((q) => path(q, '#c9bb98', 4.4)).join('') + road.map((q) => path(q, '#ece2c7', 3.3)).join(''));
  for (const [x, y] of [[14, 40], [78, 16], [80, 70]]) pad(s, x + 2.5, y + 2.5, 7, 6, '#e6dcc2');
  for (const [x, y] of [[14, 40], [78, 16], [80, 70]]) s.line([x, y, 0.1], [46, 64, 0.1], { c: A, w: 0.75, dash: '1.6 1.1', depth: -0.5, cls: 'hx-flow' });
  pad(s, 40, 58, 16, 12, '#dcdfe3');
  fence(s, [[40, 58], [56, 58], [56, 70], [40, 70], [40, 58]], 2);
  s.box({ x: 43, y: 61, w: 5, d: 5, h: 4.4, c: '#8d99a7', decals: [0.15, 0.4, 0.65].map((v) => ['L', v, v + 0.12, 0.1, 0.9, '#6f7b89']) });
  s.box({ x: 50, y: 60, w: 5, d: 8.5, h: 4.6, c: '#f3f5f7', decals: [['L', 0, 1, 0.72, 0.9, A], ['R', 0, 1, 0.72, 0.9, A], ['R', 0.2, 0.8, 0.25, 0.55, 'glass']] });
  lattice(s, 29, 10, 1.6, 36, 0.7, '#a2abb6');
  for (const z of [34, 26, 18]) s.line([29.8, 10.8, z], [33.8, 10.8, z], { c: '#8b95a2', w: 0.4, depth: 41 });
  for (const [gx, gy] of [[22, 4], [38, 6], [26, 20]]) s.line([29.8, 10.8, 30], [gx, gy, 0], { c: '#8b95a2', w: 0.2, op: 0.5, depth: 40 });
  s.raw(42, ell(29.8, 10.8, 36.6, 0.9, 0.9, '#ff5a4a', 'class="hx-blink"'));
  s.house({ x: 6, y: 78, w: 12, d: 9, h: 6, roof: '#c9573f' });
  s.car({ x: 22, y: 84, dir: 'y', l: 6.5, c: '#e8743b' });
  [[8, 70], [12, 74], [18, 68], [24, 76]].forEach(([x, y]) => s.cyl({ x, y, r: 1.2, h: 1.5, c: '#e2c46e', top: '#f0d98f' }));
  [[14, 40, 50, 20], [78, 16, 44, 19], [80, 70, 50, 20]].forEach(([x, y, H, L]) => turbine(s, x, y, H, L, A));
  [[4, 6], [10, 3], [3, 14], [90, 94], [96, 88], [84, 97]].forEach(([x, y], i) => s.pine({ x, y, s: 0.75 + (i % 3) * 0.1 }));
  [[86, 40, 4], [91, 45, 3.6], [84, 47, 3]].forEach(([x, y, z], i) => s.pine({ x, y, z, s: 0.8 + (i % 2) * 0.12 }));
  for (let k = 3; k < 40; k += 5) { s.bush({ x: 42, y: k, s: 0.6, c: '#4f9a52' }); if (k < 30) s.bush({ x: k, y: 62, s: 0.6, c: '#4f9a52' }); }
  [[2, 96], [20, 56], [62, 64], [50, 30]].forEach(([x, y]) => s.tree({ x, y, s: 0.7 }));
  return s.render();
}

/* Geothermal: a cut-away ground showing strata down to a glowing reservoir,
   a production well (flowing up) and an injection well, a power plant with
   two steaming cooling towers, pipelines on supports and a drilling derrick. */
export function geothermal(u) {
  const s = new Iso(u), A = '#e0662f';
  const L = [[2, '#6b4f37'], [5, '#c9a47a'], [5, '#8e7766'], [5, '#b0896a'], [5, '#b5573a'], [6, A]];
  s.slab({ top: '#b3d68f', layers: L });
  const Lf = (x, z) => [x, 100, z], Rf = (y, z) => [100, y, z], r = rng(5);
  let f = '', z0 = 0;
  for (const [h, c] of L) {
    for (let i = 0; i < 14; i++) { const z = z0 - 0.6 - r() * (h - 1.2), t = r() * 100, k = 0.4 + r() * 0.9; f += ell(...(i % 2 ? Lf(t, z) : Rf(t, z)), k, k * 0.55, r() > 0.5 ? lit(c, 0.3) : shade(c, 0.22), 'opacity=".7"'); }
    z0 -= h;
  }
  const hotL = s.rad([[0, '#ffe39a', 0.95], [0.45, '#ff9a3c', 0.55], [1, '#ff7a2f', 0]], 0.3, 0.7, 0.55), hotR = s.rad([[0, '#ffe39a', 0.95], [0.45, '#ff9a3c', 0.55], [1, '#ff7a2f', 0]], 0.36, 0.7, 0.55);
  f += poly([Lf(0, -17), Lf(100, -17), Lf(100, -28), Lf(0, -28)], hotL) + poly([Rf(0, -17), Rf(100, -17), Rf(100, -28), Rf(0, -28)], hotR);
  for (const q of [[Lf(4, -25), Lf(18, -23.5), Lf(30, -26), Lf(44, -24), Lf(60, -26.5), Lf(76, -24.5), Lf(94, -26)], [Rf(96, -25), Rf(80, -26.5), Rf(64, -24), Rf(46, -26), Rf(28, -24.5), Rf(8, -26)]]) f += path(q, '#ffd36b', 0.55, 'stroke-opacity=".85"');
  f += path([Lf(62, -2), Lf(60, -8), Lf(64, -13), Lf(61, -19)], '#3a2a1f', 0.35, 'stroke-opacity=".45"') + path([Rf(30, -3), Rf(34, -9), Rf(29, -15), Rf(33, -20)], '#3a2a1f', 0.35, 'stroke-opacity=".45"');
  for (const [q, c, cls] of [[[Rf(62, -25), Rf(62, 0)], '#ffcf7a', 'class="hx-flow" '], [[Lf(24, 0), Lf(24, -25)], '#8fd3f5', ''], [[Rf(24, -25), Rf(24, 0)], '#ffcf7a', '']]) {
    f += path(q, '#e9ecef', 1.8) + path(q, '#6b7480', 0.5) + path(q, c, 0.8, `${cls}stroke-dasharray="1.6 1.1"`) + ell(...(q[0][2] < -1 ? q[0] : q[1]), 1.8, 1.8, c, 'opacity=".9"');
  }
  s.raw(-20, f);
  pad(s, 4, 28, 58, 30, '#e3e6ea'); pad(s, 56, 68, 34, 28, '#e2ddd2');
  s.ground.push(path([[62, 60, 0], [72, 68, 0]], '#e2ddd2', 3) + path([[30, 58, 0], [30, 100, 0]], '#e2ddd2', 3));
  s.box({ x: 8, y: 36, w: 26, d: 14, h: 10, c: '#f1f3f5', top: '#e2e7ec', decals: [['L', 0, 1, 0.78, 0.92, A], ['R', 0, 1, 0.78, 0.92, A], ['L', 0.06, 0.94, 0.4, 0.62, 'glass'], ['R', 0.1, 0.9, 0.4, 0.62, 'glass'], ['L', 0.7, 0.86, 0, 0.3, '#9aa4b0']] });
  s.box({ x: 34, y: 42, w: 8, d: 8, h: 6, c: '#e8ebef', decals: [['L', 0.15, 0.85, 0.45, 0.75, 'glass'], ['R', 0, 1, 0.82, 0.95, A]] });
  for (const [x, y, r0, h] of [[24, 16, 8, 20], [46, 14, 7, 17]]) { s.cyl({ x, y, r: r0, h, c: '#e7eaee', waist: 0.18 }); s.ring({ x, y, z: h, r: r0 * 0.9, c: '#bfc7cf', w: 0.5, op: 0.8, depth: x + y + 0.5 }); }
  [[24, 16, 24, 5, 0], [22, 14, 30, 6, 0.9], [25, 12, 37, 4.6, 1.8], [46, 14, 21, 4.4, 0.5], [44, 12, 27, 5.2, 1.4], [47, 10, 33, 4, 2.3]].forEach(([x, y, z, rr, dl]) => puff(s, x, y, z, rr, dl));
  for (const [x, y] of [[48, 42], [53, 42]]) { s.cyl({ x, y, r: 2.1, h: 8, c: '#eef1f4', depth: x + y }); s.ring({ x, y, z: 6, r: 2.15, c: A, w: 0.9, op: 1, depth: x + y }); }
  pipe(s, [[97, 62, 2.4], [70, 62, 2.4], [70, 62, 6], [64, 62, 6], [64, 62, 2.4], [52, 62, 2.4], [52, 50, 2.4], [42, 50, 2.4]]);
  pipe(s, [[97, 60, 2.4], [58, 60, 2.4]], '#dfc9b5', 0.9);
  pipe(s, [[24, 52, 2], [24, 97, 2]], '#bfe0f0', 1.1);
  for (const [x, y] of [[97.5, 60.5], [24, 97.5], [96.6, 24]]) {
    s.box({ x: x - 1.6, y: y - 1.6, w: 3.2, d: 3.2, h: 0.5, c: '#c9ced4', shadow: false }); s.cyl({ x, y, z: 0.5, r: 0.7, h: 3.2, c: '#dfe3e8', shadow: false });
    s.box({ x: x - 1.3, y: y - 0.3, z: 2.4, w: 2.6, d: 0.6, h: 0.6, c: A, shadow: false, depth: x + y + 0.1 });
  }
  pipe(s, [[96.6, 24, 2.4], [70, 24, 2.4], [70, 40, 2.4], [56, 40, 2.4]], '#dfc9b5', 0.9);
  for (const [x, y] of [[60, 72], [72, 72], [60, 84], [72, 84]]) s.box({ x, y, w: 1, d: 1, h: 5, c: '#7d8692', shadow: false });
  s.box({ x: 59, y: 71, z: 5, w: 15, d: 15, h: 1.3, c: '#9aa4b0', top: '#c3cad3' });
  s.raw(146, `<g transform="translate(0 -6.3)">${grab(s, () => lattice(s, 62.5, 74.5, 8, 34, 1.8, A))}</g>`);
  s.box({ x: 65.4, y: 77.4, z: 39.6, w: 2.2, d: 2.2, h: 1.6, c: A, shadow: false, depth: 160 });
  s.line([66.5, 78.5, 39.6], [66.5, 78.5, 14], { c: '#39424f', w: 0.3, depth: 146.5 });
  s.box({ x: 65.6, y: 77.6, z: 12, w: 1.8, d: 1.8, h: 2, c: '#f2b84b', shadow: false, depth: 146.6 });
  s.box({ x: 59.5, y: 80, z: 6.3, w: 4, d: 5.5, h: 3.6, c: '#f3f5f7', shadow: false, depth: 150, decals: [['L', 0.2, 0.8, 0.4, 0.8, 'glass'], ['R', 0, 1, 0.8, 0.95, A]] });
  for (let i = 0; i < 4; i++) s.box({ x: 70, y: 89 + i * 1.4, z: 0.2, w: 16, d: 0.9, h: 0.9, c: '#b8c0c8', shadow: i === 3 });
  s.person({ x: 76, y: 80, c: A }); s.person({ x: 40, y: 56, c: '#2f7fd0' }); s.person({ x: 86, y: 70, c: '#f2b84b' });
  [[88, 8, 0.85], [94, 16, 0.75], [10, 70, 0.9], [8, 88, 0.8], [44, 88, 0.75]].forEach(([x, y, k]) => s.tree({ x, y, s: k, c: '#4b9a52' }));
  [[88, 96], [2, 50]].forEach(([x, y]) => s.palm({ x, y, s: 0.8 }));
  [[18, 92], [50, 94], [92, 50], [4, 60]].forEach(([x, y]) => s.bush({ x, y, s: 0.7 }));
  return s.render();
}

/* A forklift driving toward +x with a loaded pallet on its forks. */
function forklift(s, x, y, c) {
  s.box({ x, y, z: 0.7, w: 4.2, d: 2.8, h: 2, c, decals: [['L', 0.05, 0.4, 0.3, 0.9, shade(c, 0.2)]] });
  s.raw(x + y + 3.5, path([[x + 0.5, y + 2.6, 2.7], [x + 0.5, y + 2.6, 5.4], [x + 3, y + 2.6, 5.4], [x + 3, y + 2.6, 2.7]], '#39424f', 0.45) + poly([[x + 0.4, y + 0.2, 5.4], [x + 3.1, y + 0.2, 5.4], [x + 3.1, y + 2.6, 5.4], [x + 0.4, y + 2.6, 5.4]], '#39424f'));
  s.box({ x: x + 4.2, y: y + 0.3, w: 0.5, d: 2.2, h: 6.2, c: '#4b5563', shadow: false });
  s.box({ x: x + 4.8, y: y - 0.2, z: 0.9, w: 3.8, d: 3.2, h: 0.6, c: '#c9a56b', shadow: false });
  s.box({ x: x + 5, y, z: 1.5, w: 3.4, d: 2.8, h: 2.8, c: '#d9ba8c', decals: [['L', 0, 1, 0.45, 0.55, '#b89668'], ['T', 0.45, 0.55, 0, 1, '#b89668']] });
  for (const wx of [x + 1, x + 3.3]) s.raw(x + y + 4, ell(wx, y + 2.8, 0.7, 0.75, 0.9, '#20252e'));
}

/* Supply chain: a factory with loading docks and accent signage, a container
   yard under a straddle gantry, lorries on the road (one hauling a
   container), a forklift, and a flowing route to a pinned site. */
export function supply(u) {
  const s = new Iso(u), A = '#1f7f97';
  s.slab({ top: '#e1e4e9', side: '#c3c9d1' });
  pad(s, 0, 52, 42, 48, '#bcdca0'); pad(s, 58, 60, 42, 40, '#c9e1ae'); pad(s, 58, 0, 42, 56, '#d6dade');
  pad(s, 44, 0, 10, 100, '#9aa3ae'); pad(s, 43.4, 0, 0.6, 100, '#f4f5f7'); pad(s, 54, 0, 0.6, 100, '#f4f5f7');
  for (let k = 2; k < 100; k += 7) pad(s, 48.7, k, 0.6, 3.6, '#ffffff');
  pad(s, 2, 32, 40, 18, '#eceef1');
  for (const x of [8, 14.5, 21, 27.5, 34]) pad(s, x, 33, 0.35, 9, '#ffffff');
  for (const y of [9.5, 17, 24.5, 32]) pad(s, 59, y + 3.6, 34, 0.35, '#ffffff', 'opacity=".7"');
  s.box({ x: 4, y: 4, w: 34, d: 28, h: 15, c: '#eef1f5', top: '#dde2e8', decals: [
    ...[0.12, 0.33, 0.54].map((v) => ['L', v, v + 0.15, 0, 0.44, '#5c6675']), ...[0.12, 0.33, 0.54].map((v) => ['L', v - 0.015, v + 0.165, 0.44, 0.5, '#39424f']),
    ['L', 0.76, 0.96, 0.55, 0.9, A], ['L', 0.79, 0.93, 0.62, 0.83, '#ffffff'], ['L', 0.04, 0.72, 0.8, 0.88, A],
    ['R', 0, 1, 0.8, 0.88, A], ['R', 0.08, 0.92, 0.22, 0.66, 'glass'], ['T', 0.06, 0.94, 0.08, 0.14, 'glass'], ['T', 0.06, 0.94, 0.88, 0.94, 'glass']] });
  for (let i = 0; i < 3; i++) s.panel({ x: 7, y: 9 + i * 6.4, z: 15.2, w: 26, d: 3.6, rise: 1.4, legs: false, cols: 8, rows: 1, lift: 60 });
  s.box({ x: 31, y: 7, z: 15, w: 4, d: 4, h: 2.4, c: '#c9d0d8', shadow: false, depth: 90 });
  lorry(s, 10.4, 33.2, { l: 16, cab: A, load: '#f4f5f7', back: false });
  forklift(s, 20, 40.5, '#f2b84b');
  for (const [x, y, h] of [[32, 36, 3], [32, 40.4, 2], [36.4, 36, 2]]) s.box({ x, y, z: 0.5, w: 3.6, d: 3.6, h: h * 1.4, c: '#d9ba8c', decals: [['L', 0, 1, 0, 0.12, '#c9a56b']] });
  const cols = ['#c8553d', '#2f6fb3', '#e0b34a', '#3f8f7a', A, '#8a94a3', '#d9dde2'];
  let k = 0;
  [[60, [3, 2, 2, 1]], [79, [2, 1, 2, 1]]].forEach(([x, hs]) => hs.forEach((n, row) => { for (let z = 0; z < n; z++) box20(s, x, 6 + row * 7.5, z * 5, cols[k++ % cols.length], x + 14.5 + row * 7.5 + z * 0.1); }));
  for (const [x, y] of [[77, 3], [93, 3], [77, 36.5], [93, 36.5]]) s.box({ x, y, w: 1.2, d: 1.2, h: 21, c: A, shadow: false, depth: x + y + 1 });
  for (const y of [3, 36.5]) { s.box({ x: 77, y, w: 17.2, d: 1.2, h: 1, c: shade(A, 0.1), shadow: false, depth: 85 + y + 1.1 }); s.box({ x: 77, y, z: 20, w: 17.2, d: 1.2, h: 1.6, c: A, depth: 85 + y + 1.2 }); }
  for (const x of [77, 93]) s.box({ x, y: 3, z: 20, w: 1.2, d: 34.7, h: 1.6, c: A, depth: x + 21 });
  s.box({ x: 76.4, y: 12.4, z: 21.6, w: 18.4, d: 5, h: 2.2, c: '#f3f5f7', depth: 118, decals: [['L', 0, 1, 0.6, 0.85, A]] });
  for (const x of [80, 90]) s.line([x, 15, 21.6], [x, 15, 18], { c: '#39424f', w: 0.35, depth: 117 });
  box20(s, 79, 12.5, 13, '#2f6fb3', 117.5);
  s.box({ x: 77, y: 30, z: 14, w: 1.2, d: 3, h: 3, c: '#f3f5f7', shadow: false, depth: 118.5, decals: [['L', 0, 1, 0.3, 0.9, 'glass']] });
  lorry(s, 45.2, 58, { l: 16, cab: '#f4f5f7', load: A });
  lorry(s, 50.2, 20, { l: 14, cab: '#e8743b', load: '#eef1f4', back: true });
  for (let i = 0; i < 4; i++) s.car({ x: 5 + i * 6, y: 55, dir: 'y', l: 6.4, c: ['#2f7fd0', '#f4f5f7', '#c8553d', '#39424f'][i] });
  for (const y of [64, 71.5]) s.panel({ x: 62, y, w: 18, d: 4.4, z: 1.2, rise: 2.6, cols: 6, rows: 2 });
  s.box({ x: 86, y: 64, w: 6, d: 11, h: 5.2, c: '#f3f5f7', decals: [0.1, 0.4, 0.7].map((v) => ['R', v, v + 0.2, 0.1, 0.8, A]) });
  s.person({ x: 70, y: 86, c: A }); s.person({ x: 84, y: 82, c: '#f2b84b' }); s.person({ x: 28, y: 46, c: '#2f7fd0' });
  [[6, 70], [18, 90], [34, 72], [4, 96], [96, 92]].forEach(([x, y], i) => (i % 2 ? s.tree({ x, y, s: 0.8 }) : s.palm({ x, y, s: 0.75 })));
  [[40, 62], [40, 80], [40, 96], [58, 96], [98, 60]].forEach(([x, y]) => s.bush({ x, y, s: 0.7 }));
  const rt = [[12.2, 50, 0], [12.2, 52.5, 0], [47, 52.5, 0], [47, 80, 0], [74, 80, 0], [78, 84, 0]];
  s.ground.push(path(rt, A, 3, 'stroke-opacity=".16"') + path(rt, A, 1, 'class="hx-flow" stroke-dasharray="2 1.4"') + ell(12.2, 50, 0, 1.6, 0.95, '#ffffff', `stroke="${A}" stroke-width=".7"`));
  pin(s, 78, 84, 0.5, A);
  return s.render();
}

/* A fish pen: net under the water, a circling school, collar, walkway, handrail, bubbles. */
function pen(s, x, y, r, seed) {
  const R = rng(seed);
  let g = ell(x, y, 0.2, r * 1.2247, r * 0.7071, s.rad([[0, '#175f86', 0.7], [1, '#2a86b5', 0.4]], 0.5, 0.5, 0.6));
  for (const k of [0.36, 0.7]) g += ell(x, y, 0.2, r * k * 1.2247, r * k * 0.7071, 'none', 'stroke="#d7f0fb" stroke-opacity=".28" stroke-width=".3" stroke-dasharray=".8 .6"');
  for (let i = 0; i < 12; i++) g += path([[x, y, 0.2], [x + Math.cos(i * Math.PI / 6) * r, y + Math.sin(i * Math.PI / 6) * r, 0.2]], '#d7f0fb', 0.2, 'stroke-opacity=".22"');
  for (let i = 0; i < 9; i++) {
    const a = R() * 6.28, rr = r * (0.2 + R() * 0.6), [fx, fy] = P(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.3), dr = R() > 0.5 ? 1 : -1;
    g += `<path d="M${n2(fx - 1.6 * dr)},${n2(fy)} q${n2(1.6 * dr)},-1 ${n2(3.2 * dr)},0 q${n2(-1.6 * dr)},1 ${n2(-3.2 * dr)},0z m0,0 l${n2(-1.1 * dr)},-.8 v1.6z" fill="${R() > 0.4 ? '#f4a261' : '#e8eef3'}"/>`;
  }
  s.raw(-1, g);
  s.ring({ x, y, z: 0.5, r, c: '#39424f', w: 1.9, op: 1, depth: x + y });
  s.ring({ x, y, z: 0.9, r: r + 0.15, c: '#eef2f5', w: 0.8, op: 1, depth: x + y + 0.1 });
  s.ring({ x, y, z: 2.4, r, c: '#c3ccd5', w: 0.35, op: 0.9, depth: x + y + 0.2 });
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; s.raw(x + y + (px + py - x - y > 0 ? 0.6 : -0.6), path([[px, py, 0.9], [px, py, 2.4]], '#9aa6b2', 0.3)); }
  for (let i = 0; i < 4; i++) s.raw(x + y + 1, ell(x + (i - 1.5) * 2, y + (i % 2) * 2 - 1, 1, 0.55, 0.55, '#ffffff', `class="hx-rise" style="animation-delay:${n2(i * 0.6)}s" opacity=".9"`));
}

/* Aqua: fish pens on open water joined by a floating walkway, a feeding
   barge with silos and hoses, floating solar on pontoons, a work boat and
   a shore strip with the hatchery and its tanks. */
export function aqua(u) {
  const s = new Iso(u), A = '#2c98c4';
  s.slab({ top: '#78c2e3', side: '#4a9fcb' });
  const wr = rng(21); let rip = poly([[18, 0, 0], [60, 0, 0], [18, 60, 0]], '#ffffff', 'opacity=".12"');
  for (let i = 0; i < 22; i++) { const x = 20 + wr() * 78, y = 2 + wr() * 96, l = 2 + wr() * 3; rip += path([[x, y, 0], [x + l, y, 0]], '#ffffff', 0.45, `class="hx-shimmer" style="animation-delay:${n2(wr() * 2)}s" stroke-opacity=".75"`); }
  s.raw(-5, rip);
  s.box({ x: 0, y: 0, w: 14, d: 100, h: 2.4, c: '#d9c9a2', top: '#a6d086', shadow: false, depth: -4 });
  s.box({ x: 14, y: 0, w: 4, d: 100, h: 1.2, c: '#d9c9a2', top: '#eadcb8', shadow: false, depth: -3.9 });
  s.box({ x: 2, y: 8, w: 10, d: 30, z: 2.4, h: 7, c: '#f3f5f7', top: A, decals: [['R', 0.06, 0.94, 0.4, 0.72, 'glass'], ['R', 0, 1, 0.84, 0.96, shade(A, 0.1)], ['L', 0.2, 0.8, 0, 0.6, '#aab4bf']] });
  for (const y of [46, 56, 66]) { s.cyl({ x: 7, y, z: 2.4, r: 3.4, h: 2.4, c: '#dfe6ec', depth: 7 + y }); s.raw(7 + y + 0.1, ell(7, y, 4.85, 3.4, 2, s.lin([[0, '#9fd9f2'], [1, '#3f93c4']], 1, 1))); }
  [[6, 78], [9, 90], [4, 2], [10, 43]].forEach(([x, y]) => s.palm({ x, y, z: 2.4, s: 0.8 }));
  s.bush({ x: 4, y: 72, z: 2.4, s: 0.8 }); s.person({ x: 12, y: 50, z: 2.4, c: A });
  s.box({ x: 18, y: 51.2, z: 0.1, w: 24, d: 2.6, h: 0.7, c: '#b8946a', top: '#d8b98a', depth: 60 });
  pen(s, 38, 28, 11, 3); pen(s, 66, 22, 10, 8); pen(s, 36, 72, 11, 13);
  s.box({ x: 36.8, y: 39, z: 0.1, w: 2.4, d: 21.6, h: 0.7, c: '#b8946a', top: '#d8b98a', depth: 75 });
  s.box({ x: 49, y: 23, z: 0.1, w: 7.2, d: 2.4, h: 0.7, c: '#b8946a', top: '#d8b98a', depth: 75 });
  s.person({ x: 38, y: 50, z: 0.8, c: '#f2b84b' });
  s.box({ x: 70, y: 40, w: 17, d: 11, h: 3, c: A, top: '#e9eef2', decals: [['L', 0, 1, 0.62, 0.8, '#ffffff'], ['R', 0, 1, 0.62, 0.8, '#ffffff']] });
  s.box({ x: 72, y: 42, z: 3, w: 7, d: 7, h: 5, c: '#f5f7f9', decals: [['L', 0.1, 0.9, 0.45, 0.8, 'glass'], ['R', 0.15, 0.85, 0.45, 0.8, 'glass']], shadow: false });
  for (const y of [42.5, 47]) { s.cyl({ x: 83, y, z: 3, r: 1.9, h: 7, c: '#eef1f4', shadow: false, depth: 83 + y + 1 }); s.ring({ x: 83, y, z: 8, r: 1.95, c: A, w: 0.7, op: 1, depth: 83 + y + 1 }); }
  for (const [tx, ty] of [[66, 22], [36, 72]]) s.line([72, 46, 0.4], [tx + 8, ty + 6, 0.4], { c: '#39424f', w: 0.45, op: 0.7, sag: 3, depth: 60 });
  for (let i = 0; i < 20; i++) {
    const x = 60 + (i % 4) * 9.5, y = 58 + Math.floor(i / 4) * 8;
    s.box({ x: x - 0.4, y: y + 1, w: 8.2, d: 4.4, h: 0.6, c: '#eef1f4', shadow: false, depth: x + y - 1 }); s.panel({ x, y, z: 0.9, w: 7.4, d: 4.2, rise: 1.6, legs: false, cols: 4, rows: 2 });
  }
  for (let r = 0; r < 5; r++) s.line([59, 64.6 + r * 8, 0.4], [97, 64.6 + r * 8, 0.4], { c: '#d7dde3', w: 0.6, depth: -0.5 });
  const bt = grab(s, () => {
    const x = 26, y = 84, c = '#f4f6f8', k = 1.45, H = 2.1;
    s.raw(0, poly([[x, y + 3.4 * k, H], [x + 8 * k, y + 3.4 * k, H], [x + 8 * k, y + 3 * k, 0], [x + 0.5, y + 3 * k, 0]], c) + poly([[x + 8 * k, y + 3.4 * k, H], [x + 10.5 * k, y + 1.7 * k, H], [x + 10 * k, y + 1.7 * k, 0.5], [x + 8 * k, y + 3 * k, 0]], shade(c, 0.2))
      + poly([[x, y, H], [x + 8 * k, y, H], [x + 10.5 * k, y + 1.7 * k, H], [x + 8 * k, y + 3.4 * k, H], [x, y + 3.4 * k, H]], '#dfe5ea') + path([[x, y + 3.4 * k, H - 0.4], [x + 8 * k, y + 3.4 * k, H - 0.4], [x + 10.3 * k, y + 1.8 * k, H - 0.4]], A, 0.8));
    s.box({ x: x + 1.5, y: y + 0.8, z: H, w: 5, d: 3.2, h: 3, c: '#ffffff', top: A, shadow: false, depth: 1, decals: [['L', 0.12, 0.88, 0.45, 0.85, 'glass'], ['R', 0.15, 0.85, 0.45, 0.85, 'glass']] });
    s.person({ x: x + 9.5, y: y + 2.4, z: H, c: '#e8743b', depth: 2 });
  });
  s.raw(95, path([[25, 86.2, 0.2], [12, 82, 0.2]], '#ffffff', 0.55, 'stroke-opacity=".75"') + path([[25, 88.2, 0.2], [12, 93, 0.2]], '#ffffff', 0.55, 'stroke-opacity=".75"'));
  s.raw(116, `<g class="hx-bob">${bt}</g>`);
  for (const [x, y] of [[22, 4], [98, 4], [52, 48], [24, 58], [56, 96]]) { s.sphere({ x, y, z: 0.9, r: 0.9, c: '#f28c38', depth: x + y, shadow: false }); s.raw(x + y - 0.1, ell(x, y, 0.1, 1.6, 0.9, '#ffffff', 'opacity=".5"')); }
  const [jx, jy] = P(62, 18, 4);
  s.raw(900, `<path d="M${n2(jx - 5)},${n2(jy + 4)} q5,-8 10,0" fill="none" stroke="#ffffff" stroke-width=".5" stroke-dasharray=".8 1"/>` + ell(62, 18, 0.2, 3, 1.4, 'none', 'stroke="#ffffff" stroke-width=".5" stroke-opacity=".8"').replace(/cx="[^"]+"/, `cx="${n2(jx - 5)}"`)
    + `<path d="M${n2(jx - 2.7)},${n2(jy)} q2.7,-1.8 5.4,0 q-2.7,1.8 -5.4,0z m5.4,0 l2,-1.4 v2.8z" fill="#f4a261" stroke="#ffffff" stroke-width=".3" transform="rotate(-24 ${n2(jx)} ${n2(jy)})"/>`);
  return s.render();
}

/* Hydroponics: a glass greenhouse with tiered racks of greens under warm
   LED bars, PV along the roof, nutrient tanks piped in, and a grower. */
export function hydroponics(u) {
  const s = new Iso(u), A = '#3fa37a';
  s.slab({ top: '#bfdca4', side: '#95bd79' });
  const X0 = 6, X1 = 74, Y0 = 8, Y1 = 78, H = 24, RH = 10, M = (Y0 + Y1) / 2;
  pad(s, 74, 4, 24, 48, '#e3e6ea'); pad(s, 30, 78, 16, 22, '#e3e6ea');
  const glass = (q, op, depth, st = '#b9cfdc') => s.raw(depth, poly(q, '#e2f4ff', `fill-opacity="${op}" stroke="${st}" stroke-width=".6" stroke-linejoin="round"`));
  const mull = (depth, fn) => s.raw(depth, Array.from({ length: 7 }, (_, i) => path(fn((i + 1) / 8), '#ffffff', 0.4, 'stroke-opacity=".9"')).join(''));
  glass([[X0, Y0, 0], [X1, Y0, 0], [X1, Y0, H], [X0, Y0, H]], 0.5, -0.9);
  glass([[X0, Y0, 0], [X0, Y1, 0], [X0, Y1, H], [X0, Y0, H]], 0.45, -0.85);
  mull(-0.8, (t) => [[X0 + (X1 - X0) * t, Y0, 0], [X0 + (X1 - X0) * t, Y0, H]]);
  mull(-0.8, (t) => [[X0, Y0 + (Y1 - Y0) * t, 0], [X0, Y0 + (Y1 - Y0) * t, H]]);
  s.box({ x: X0, y: Y0, w: X1 - X0, d: Y1 - Y0, h: 0.5, c: '#dfe5e0', top: '#f2f5f3', shadow: false, depth: -0.7 });
  s.raw(-0.65, poly([[X0 + 2, Y0 + 2, 0.5], [X1 - 2, Y0 + 2, 0.5], [X1 - 2, Y1 - 2, 0.5], [X0 + 2, Y1 - 2, 0.5]], '#e7ece8'));
  const greens = ['#4fb043', '#72c653', '#3a9640', '#86d05e'], wash = s.lin([[0, '#fff3cf', 0.5], [1, '#fff3cf', 0]]);
  for (let r = 0; r < 3; r++) {
    const ry = 16 + r * 20, b = 100 + r * 100;
    for (const px of [12, 67]) s.box({ x: px, y: ry, w: 0.9, d: 0.9, h: 22, c: A, shadow: false, depth: b - 1 });
    for (let lv = 0; lv < 5; lv++) {
      const z = 1.5 + lv * 5.2, d0 = b + lv * 10, top = lv === 4;
      if (lv) s.raw(d0 - 0.5, poly([[12.5, ry + 7, z], [67.5, ry + 7, z], [67.5, ry + 7, z - 3.8], [12.5, ry + 7, z - 3.8]], wash) + path([[12.5, ry + 7.05, z - 0.05], [67.5, ry + 7.05, z - 0.05]], '#ffe9a8', 0.9, 'stroke-opacity=".9"'));
      if (top) s.box({ x: 12, y: ry, w: 56, d: 1, z, h: 0.6, c: A, shadow: false, depth: d0 - 1 });
      s.box(top ? { x: 12, y: ry + 5.8, w: 56, d: 1.2, z, h: 0.6, c: '#eef1f3', shadow: false, depth: d0, decals: [['L', 0, 1, 0.05, 0.95, '#fff6dc']] }
        : { x: 12, y: ry, w: 56, d: 7, z, h: 0.9, c: '#f5f7f9', shadow: false, depth: d0, decals: lv ? [['L', 0, 1, 0.05, 0.95, '#fff6dc']] : [['L', 0, 1, 0.1, 0.9, A]] });
      if (!top) for (let x = 14.5; x <= 66; x += 3.7) for (const dy of [2, 5]) s.sphere({ x: x + dy * 0.3, y: ry + dy, z: z + 2, r: 1.45, c: greens[(Math.round(x) + dy + lv) % 4], depth: d0 + 1 + dy * 0.01 + x * 0.0001, shadow: false });
    }
    for (const px of [12, 67]) s.box({ x: px, y: ry + 6.1, w: 0.9, d: 0.9, h: 22, c: A, shadow: false, depth: b + 45 });
  }
  s.glow({ x: 40, y: 44, z: 12, r: 34, c: '#fff0c4', op: 0.12, depth: 380 });
  s.person({ x: 24, y: 70, c: '#2f7fd0', depth: 390 });
  glass([[X0, Y1, 0], [X1, Y1, 0], [X1, Y1, H], [X0, Y1, H]], 0.16, 900);
  glass([[X1, Y0, 0], [X1, Y1, 0], [X1, Y1, H], [X1, Y0, H]], 0.24, 901);
  s.raw(901.5, poly([[34, Y1, 0], [42, Y1, 0], [42, Y1, 11], [34, Y1, 11]], '#cfe6f2', 'fill-opacity=".5" stroke="#ffffff" stroke-width=".7"'));
  glass([[X0, Y0, H], [X1, Y0, H], [X1, M, H + RH], [X0, M, H + RH]], 0.3, 902);
  const pvq = (t0, t1) => [[X0 + 3, Y0 + (M - Y0) * t0, H + RH * t0], [X1 - 3, Y0 + (M - Y0) * t0, H + RH * t0], [X1 - 3, Y0 + (M - Y0) * t1, H + RH * t1], [X0 + 3, Y0 + (M - Y0) * t1, H + RH * t1]];
  s.raw(902.5, poly(pvq(0.42, 0.96), s.lin([[0, '#6d9ee6'], [0.5, '#2c58a8'], [1, '#17336e']], 1, 1), 'stroke="#eef3f9" stroke-width=".5"')
    + Array.from({ length: 11 }, (_, i) => { const x = X0 + 3 + (X1 - X0 - 6) * (i + 1) / 12; return path([[x, Y0 + (M - Y0) * 0.42, H + RH * 0.42], [x, Y0 + (M - Y0) * 0.96, H + RH * 0.96]], '#ffffff', 0.2, 'stroke-opacity=".45"'); }).join(''));
  glass([[X1, Y0, H], [X1, Y1, H], [X1, M, H + RH]], 0.3, 903);
  glass([[X0, Y1, H], [X1, Y1, H], [X1, M, H + RH], [X0, M, H + RH]], 0.2, 904);
  mull(905, (t) => [[X0 + (X1 - X0) * t, Y1, 0], [X0 + (X1 - X0) * t, Y1, H], [X0 + (X1 - X0) * t, M, H + RH]]);
  mull(905, (t) => [[X1, Y0 + (Y1 - Y0) * t, 0], [X1, Y0 + (Y1 - Y0) * t, H]]);
  s.raw(906, path([[X0, M, H + RH], [X1, M, H + RH]], '#ffffff', 0.9) + path([[X0, Y1, H], [X1, Y1, H], [X1, Y0, H]], '#ffffff', 0.7) + path([[X1, Y1, 0], [X1, Y1, H]], '#ffffff', 0.8));
  s.shade2d(X0, Y0, X1 - X0, Y1 - Y0, 10, 0, 0.08);
  for (const [y, c] of [[12, '#eef2f3'], [22, '#eef2f3'], [32, A]]) { s.cyl({ x: 86, y, r: 3.6, h: 9, c, depth: 86 + y + 5 }); s.ring({ x: 86, y, z: 6.5, r: 3.65, c: c === A ? '#ffffff' : A, w: 1, op: 1, depth: 86 + y + 5 }); }
  pipe(s, [[82, 12, 3], [76, 12, 3], [76, 40, 3], [74, 40, 3]], '#e6ebef', 0.9);
  pipe(s, [[82, 32, 1.6], [78, 32, 1.6], [78, 44, 1.6], [74, 44, 1.6]], A, 0.9);
  s.box({ x: 80, y: 40, w: 7, d: 7, h: 4, c: '#f3f5f7', decals: [['L', 0.2, 0.8, 0.2, 0.7, '#aab4bf'], ['R', 0, 1, 0.75, 0.9, A]] });
  s.person({ x: 38, y: 86, c: '#f2b84b' });
  for (const [x, y] of [[44, 84], [46.6, 84]]) s.box({ x, y, w: 2.4, d: 2.4, h: 1.6, c: '#d9ba8c', decals: [['T', 0.1, 0.9, 0.1, 0.9, '#6cc35a']] });
  [[90, 60], [96, 70], [60, 92], [90, 94]].forEach(([x, y], i) => (i % 2 ? s.palm({ x, y, s: 0.75 }) : s.tree({ x, y, s: 0.8 })));
  [[4, 90], [16, 94], [80, 84], [96, 50]].forEach(([x, y]) => s.bush({ x, y, s: 0.8 }));
  return s.render();
}

/* Run-of-river hydropower: a terrace holding a weir pool, the spillway
   foaming down its face, a penstock falling to the powerhouse, the tailrace
   home to the river, poles carrying the power off, palms on both levels. */
export function hydropower(u) {
  const s = new Iso(u), A = '#3a7fe0', WATER = '#6fbfe3', WSIDE = '#4f9fcb';
  s.slab({ top: '#b4d794', side: '#8cba6c' });
  s.box({ x: 0, y: 0, w: 100, d: 42, h: 14, c: '#d9cdb6', top: '#a6cf86', shadow: false, depth: -3,
    decals: [['L', 0, 1, 0.3, 0.36, '#c7b89c'], ['L', 0, 1, 0.62, 0.67, '#c7b89c'], ['R', 0, 1, 0.3, 0.36, '#c7b89c'], ['R', 0, 1, 0.62, 0.67, '#c7b89c'], ['L', 0, 1, 0.9, 1, '#8fae6c']] });
  const wtr = (x, y, w, d, z, dep) => s.box({ x, y, w, d, z, h: 0.3, c: WSIDE, top: WATER, shadow: false, edge: false, depth: dep });
  wtr(22, 8, 32, 30, 14, -2.95); wtr(32, 0, 12, 8, 14, -2.95);
  const fl = (q, dep, dl) => s.raw(dep, path(q, '#ffffff', 0.45, `class="hx-flow" stroke-dasharray="2.4 3" stroke-opacity=".8" style="animation-delay:${dl}s"`));
  [[25, 16], [30, 24], [40, 12], [46, 28], [36, 32]].forEach(([x, y], i) => fl([[x, y, 14.35], [x + 1, y + 5, 14.35]], -2.85, i * 0.3));
  s.raw(-2.8, poly([[32, 42, 14], [44, 42, 14], [44, 42, 0], [32, 42, 0]], s.lin([[0, '#c9ecfa'], [0.5, WATER], [1, '#4f9fcb']])));
  for (const x of [33, 35, 37, 39, 41, 43]) fl([[x, 42.05, 13.6], [x, 42.05, 0.8]], -2.7, x * 0.07);
  s.box({ x: 22, y: 38, w: 32, d: 4, z: 14, h: 3, c: '#e2e5e9', top: '#f1f3f5', shadow: false, depth: -2.6, decals: [['L', 0.3, 0.68, 0, 0.8, WSIDE]] });
  for (const x of [30.8, 35, 39, 43, 45.2]) s.box({ x, y: 37.6, z: 14, w: 1.4, d: 4.6, h: 5.2, c: '#e2e5e9', shadow: false, depth: -2.5 + x * 0.001 });
  for (const x of [32.4, 36.6, 40.6]) s.box({ x, y: 39.6, z: 17.4, w: 2.4, d: 0.5, h: 1.4, c: A, shadow: false, depth: -2.45 + x * 0.001 });
  s.box({ x: 56, y: 30, w: 9, d: 9, z: 14, h: 5, c: '#e2e5e9', top: '#f1f3f5', shadow: false, depth: -2.3, decals: [['L', 0.15, 0.85, 0.3, 0.8, '#aab4bf'], ['R', 0, 1, 0.8, 0.94, A]] });
  wtr(54, 30, 2, 9, 14, -2.35);
  s.person({ x: 50, y: 40, z: 17, c: '#f2b84b', depth: -2.2 });
  [[8, 10, 1], [14, 30, 0.9], [72, 8, 1], [88, 24, 0.9], [92, 6, 0.8]].forEach(([x, y, k], i) => (i % 2 ? s.tree({ x, y, z: 14, s: k, depth: -2.2 + (x + y) * 0.001 }) : s.palm({ x, y, z: 14, s: k * 0.85, depth: -2.2 + (x + y) * 0.001 })));
  [[4, 20], [60, 16], [80, 34], [10, 38]].forEach(([x, y]) => s.bush({ x, y, z: 14, s: 0.8, depth: -2.2 + (x + y) * 0.001 }));
  s.patch([[30, 42, 0], [46, 42, 0], [47, 100, 0], [29, 100, 0]], '#d9cfb8');
  s.patch([[32, 42, 0], [44, 42, 0], [45, 100, 0], [31, 100, 0]], s.lin([[0, lit(WATER, 0.2)], [1, WSIDE]], 1, 1));
  s.patch([[44, 72, 0], [60, 72, 0], [60, 78, 0], [44.6, 78, 0]], WATER);
  [[35, 55], [39, 64], [34, 76], [41, 86], [36, 94], [48, 74]].forEach(([x, y], i) => fl([[x, y, 0.1], [x + (y > 70 && x > 44 ? -4 : 0.3), y + (x > 44 ? 0 : 6), 0.1]], -0.9, i * 0.4));
  let foam = ''; const fr = rng(9);
  for (let i = 0; i < 16; i++) foam += ell(32.5 + fr() * 11, 42.5 + fr() * 4, 0.2, 0.8 + fr() * 1.3, 0.5 + fr() * 0.6, '#ffffff', `opacity="${n2(0.6 + fr() * 0.4)}"`);
  s.raw(-0.8, foam);
  [[30, 50], [29, 66], [47, 58], [46.5, 88], [29.5, 84]].forEach(([x, y]) => s.sphere({ x, y, z: 0.6, r: 1.1, c: '#a8aeb5', shadow: false, depth: x + y }));
  const rd = [[[0, 90, 0], [27, 90, 0]], [[49, 90, 0], [64, 87, 0], [72, 80, 0], [71, 73, 0]], [[64, 87, 0], [100, 90, 0]]];
  s.ground.push(rd.map((q) => path(q, '#cdbf9e', 4.2)).join('') + rd.map((q) => path(q, '#ece2c8', 3.2)).join(''));
  for (const x of [34, 41]) s.box({ x, y: 88.6, w: 1.4, d: 2.8, h: 1.6, c: '#c9ced4', shadow: false, depth: x + 88 });
  s.box({ x: 27, y: 88, z: 1.6, w: 22, d: 4, h: 0.7, c: '#cfd4da', top: '#e9e3d4', depth: 128 });
  for (const y of [88.2, 91.8]) s.raw(y > 90 ? 131 : 127, path([[27, y, 2.3], [27, y, 3.6], [49, y, 3.6], [49, y, 2.3]], '#8d97a3', 0.35) + path([[27, y, 3], [49, y, 3]], '#8d97a3', 0.25));
  s.car({ x: 31, y: 88.3, z: 1.6, dir: 'x', l: 6.5, c: A, depth: 129.5 });
  s.raw(-0.7, ell(38, 45, 1.5, 11, 5, s.rad([[0, '#ffffff', 0.7], [1, '#ffffff', 0]], 0.5, 0.5, 0.5)));
  const rr = rng(4); let cliff = '';
  for (let i = 0; i < 26; i++) { // rock faces on the terrace cliff
    const t = rr() * 96, z = 1 + rr() * 11, k = 1 + rr() * 2.2, c = rr() > 0.5 ? '#e8dfcc' : '#bfae8f', onL = i % 3 !== 0, F = onL ? (v, w) => [v, 42, w] : (v, w) => [100, v * 0.42, w];
    if (!onL || t < 29 || t > 47) cliff += poly([F(t, z), F(t + k * 1.6, z + 0.3), F(t + k * 1.4, z - k * 0.6), F(t + 0.2, z - k * 0.5)], c, 'opacity=".75"');
  }
  s.raw(-2.9, cliff);
  for (let x = 3; x < 100; x += 3.4 + rr() * 4) if (x < 28 || x > 48) s.bush({ x, y: 40 + rr(), z: 14, s: 0.45 + rr() * 0.35, c: rr() > 0.5 ? '#4f9f55' : '#5fae5a', depth: -2.1 + x * 0.001 });
  const pa = [61, 39, 15.5], pb = [63, 57, 5];
  s.raw(95, path([pa, pb], shade(A, 0.35), 3.6) + path([pa, pb], A, 2.8) + path([pa, pb], lit(A, 0.5), 0.8, 'transform="translate(-.6 -.2)"'));
  for (const t of [0.35, 0.7]) s.box({ x: 60 + t * 2, y: 39 + t * 18 - 1, z: 0, w: 3, d: 2, h: 15.5 - t * 10.5 - 1.5, c: '#d7dade', shadow: false, depth: 96 + t });
  s.box({ x: 56, y: 57, w: 20, d: 15, h: 11, c: '#f3f5f8', top: A, decals: [['L', 0, 1, 0.84, 1, shade(A, 0.1)], ['L', 0.06, 0.34, 0, 0.62, '#c9d2dc'], ['L', 0.44, 0.94, 0.38, 0.7, 'glass'], ['R', 0, 1, 0.84, 1, shade(A, 0.1)], ['R', 0.15, 0.85, 0.38, 0.7, 'glass']] });
  s.box({ x: 58, y: 59, z: 11, w: 5, d: 4, h: 1.6, c: '#dfe4ea', shadow: false, depth: 140 });
  pad(s, 78, 60, 12, 12, '#dcdfe3');
  fence(s, [[78, 60], [90, 60], [90, 72], [78, 72], [78, 60]], 2);
  s.box({ x: 80, y: 62, w: 5, d: 6, h: 5, c: '#8d99a7', decals: [0.15, 0.4, 0.65].map((v) => ['L', v, v + 0.12, 0.1, 0.9, '#6f7b89']) });
  for (let i = 0; i < 3; i++) s.cyl({ x: 81.2 + i * 1.3, y: 65, z: 5, r: 0.4, h: 2.2, c: '#eef1f4', shadow: false, depth: 148 + i * 0.01 });
  const w1 = s.pole({ x: 86, y: 66, h: 14 }), w2 = s.pole({ x: 94, y: 80, h: 18 });
  [[[83, 65, 7], w1, 1], [w1, w2, 2], [w2, [104, 96, 16], 2]].forEach(([a, b, sag], i) => s.line(a, b, { c: '#4b5563', w: 0.45, sag, op: i === 2 ? 0.6 : 1 }));
  s.person({ x: 66, y: 76, c: A }); s.person({ x: 52, y: 88, c: '#e8743b' });
  [[8, 56, 1], [16, 80, 0.9], [4, 94, 0.8], [88, 94, 0.85], [96, 60, 0.8]].forEach(([x, y, k]) => s.palm({ x, y, s: k }));
  [[20, 62, 0.9], [60, 92, 0.8], [96, 98, 0.7]].forEach(([x, y, k]) => s.tree({ x, y, s: k, c: '#3f9a4f' }));
  [[24, 50], [12, 70], [26, 96], [52, 50], [84, 50], [70, 96]].forEach(([x, y]) => s.bush({ x, y, s: 0.8 }));
  return s.render();
}
