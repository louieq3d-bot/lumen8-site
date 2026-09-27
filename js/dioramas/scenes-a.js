/* Ported from the LUMEN8 platform (js/ui/home/scenes-a.js). Site copy: purple and pink accents
   recoloured to the site palette; geometry unchanged. */
/* LUMEN8 Home - product dioramas, part 1: Portfolio, Jarvis, Village, Telco,
 * Marine, Agri, Agrivoltaics. Each is a small architectural model of what the
 * product builds, drawn with ./iso.js. The helpers below add what the renderer
 * does not have: flat art laid on a wall or the ground, floating glass cards,
 * fences, dishes, tractors and container stacks. */
import { Iso, P, pp, mix, lit, shade, rng } from './iso.js';

const n2 = (v) => Math.round(v * 100) / 100;
const Q = (...a) => pp(a.map((p) => P(...p)));
const pg = (a, fill, extra = '') => `<polygon points="${Q(...a)}" fill="${fill}" ${extra}/>`;
const tl = (x, y, w, c = '#c8cedc', h = 1.2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${c}"/>`;

/* Flat 2D art (u right, v down, in world units) laid on a wall facing +y ('L'),
 * a wall facing +x ('R') or the ground ('T'), with its origin at world point o. */
const M = { L: '.866 .5 0 1', R: '.866 -.5 0 1', T: '.866 .5 -.866 .5' };
const on = (o, face, svg) => { const [X, Y] = P(...o); return `<g transform="matrix(${M[face]} ${n2(X)} ${n2(Y)})">${svg}</g>`; };

/* A floating glass card: frosted pane, bright rim, a soft offset for thickness. */
function glassCard(s, o, face, w, h, c, body, depth = 900, delay = 0) {
  const fill = s.lin([[0, '#ffffff', 0.95], [1, mix(c, '#ffffff', 0.84), 0.8]], 0.3, 1);
  s.raw(depth, `<g class="hx-bob" style="animation-delay:${delay}s">${on(o, face, `<rect x="1" y="1.3" width="${w}" height="${h}" rx="2" fill="${shade(c, 0.3)}" opacity=".16"/>` +
    `<rect width="${w}" height="${h}" rx="2" fill="${fill}" stroke="#ffffff" stroke-width=".8"/>${body}`)}</g>`);
}

/* A microwave dish on a wall facing +x ('R') or +y ('L'), with its drum behind. */
function dish(s, x, y, z, face, r, depth) {
  const g = s.rad([[0, '#ffffff'], [0.7, '#e4e9ef'], [1, '#b8c1cc']], 0.4, 0.35, 0.8);
  const back = face === 'R' ? [x - 1.3, y, z] : [x, y - 1.3, z];
  s.raw(depth, on(back, face, `<circle r="${r * 0.85}" fill="#8f99a6"/>`) +
    on([x, y, z], face, `<circle r="${r}" fill="${g}" stroke="#a9b3bf" stroke-width=".3"/><circle r="${r * 0.3}" fill="#d7dde4"/>`));
}

/* A chain-link fence round a rectangle, in short bays so it depth-sorts with
 * what stands inside and out; `gate` = [x0, x1] leaves a gap in the front run. */
function fence(s, x0, y0, x1, y1, h = 4.5, gate = null) {
  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const bay = (a, b) => {
    const n = Math.max(2, Math.round(len(a, b) / 1.3)), [pa, pb] = [P(...a), P(...b)];
    let wires = '';
    for (let i = 1; i < n; i++) { const [px, py] = P(...at(a, b, i / n)); wires += `M${n2(px)},${n2(py)}v${-h}`; }
    s.raw((a[0] + b[0]) / 2 + (a[1] + b[1]) / 2, pg([[...a, 0], [...b, 0], [...b, h], [...a, h]], '#b9c3ce', 'fill-opacity=".16"') +
      `<path d="${wires}" stroke="#8d97a3" stroke-width=".13" stroke-opacity=".75"/>` +
      `<path d="M${n2(pa[0])},${n2(pa[1] - h)}L${n2(pb[0])},${n2(pb[1] - h)}M${n2(pa[0])},${n2(pa[1] - 0.4)}L${n2(pb[0])},${n2(pb[1] - 0.4)}" stroke="#8a949f" stroke-width=".32"/>` +
      `<path d="M${n2(pa[0])},${n2(pa[1])}v${-h - 0.5}M${n2(pb[0])},${n2(pb[1])}v${-h - 0.5}" stroke="#737d89" stroke-width=".55" stroke-linecap="round"/>`);
  };
  const run = (a, b) => { const n = Math.ceil(len(a, b) / 7); for (let i = 0; i < n; i++) bay(at(a, b, i / n), at(a, b, (i + 1) / n)); };
  run([x0, y0], [x1, y0]); run([x0, y0], [x0, y1]); run([x1, y0], [x1, y1]);
  if (gate) { run([x0, y1], [gate[0], y1]); run([gate[1], y1], [x1, y1]); } else run([x0, y1], [x1, y1]);
}

/* A farm tractor heading +x: bonnet, glass cab, big rear and small front wheels. */
function tractor(s, x, y, c, depth) {
  const d = depth ?? x + y + 6;
  const wheel = (wx, wy, r) => on([wx, wy, r], 'L', `<circle r="${r}" fill="#262b33"/><circle r="${n2(r * 0.45)}" fill="#f2c14e"/>`);
  s.raw(d - 0.01, wheel(x + 1.8, y - 0.1, 2.1) + wheel(x + 6.6, y + 0.3, 1.3));
  s.box({ x: x + 3.4, y: y + 0.4, z: 1.3, w: 4.4, d: 2.8, h: 2.3, c, depth: d, decals: [['L', 0.08, 0.92, 0.55, 0.7, '#1b2436', 0.22]] });
  s.box({ x, y, z: 1.3, w: 3.6, d: 3.6, h: 5.2, c: lit(c, 0.06), top: shade(c, 0.12), depth: d + 0.01,
    decals: [['L', 0.12, 0.88, 0.42, 0.92, 'glass'], ['R', 0.12, 0.88, 0.42, 0.92, 'glass']] });
  s.box({ x: x + 6.4, y: y + 1.3, z: 3.6, w: 0.5, d: 0.5, h: 2.2, c: '#4a4f58', shadow: false, depth: d + 0.02 });
  s.raw(d + 0.03, wheel(x + 1.8, y + 3.8, 2.1) + wheel(x + 6.6, y + 3.4, 1.3));
}

/* A conical farmer's hat (caping) on a person standing at (x, y). */
const hat = (s, x, y, z = 0) => {
  const [hx, hy] = P(x, y, z + 5.3);
  s.raw(x + y + 0.005, `<path d="M${n2(hx - 2.1)},${n2(hy + 0.5)}L${n2(hx)},${n2(hy - 1.5)}L${n2(hx + 2.1)},${n2(hy + 0.5)}Q${n2(hx)},${n2(hy + 1.3)} ${n2(hx - 2.1)},${n2(hy + 0.5)}Z" fill="#ecd79e" stroke="#c7aa66" stroke-width=".25"/>`);
};

/* A small workboat heading +x (tug, pilot boat): hull, bow, cabin, wheelhouse,
 * mast, all bobbing together, and a wake fanning out behind. */
function boat(s, x, y, l, w, c, depth) {
  const T = 'hx-bob', hz = w * 0.48, yc = y + w / 2, glass = [['L', 0.08, 0.92, 0.4, 0.85, 'glass'], ['R', 0.08, 0.92, 0.4, 0.85, 'glass']];
  s.raw(depth - 1, `<path class="hx-shimmer" d="M${Q([x, y + w * 0.2])}L${Q([x - l * 1.4, y - w * 0.8])}M${Q([x, y + w * 0.8])}L${Q([x - l * 1.6, y + w * 1.8])}" stroke="#ffffff" stroke-width=".8" stroke-opacity=".8" stroke-linecap="round"/>`);
  s.box({ x, y, w: l, d: w, h: hz, c, top: '#f1ece4', depth, cls: T, decals: [['L', 0, 1, 0.7, 0.84, '#ffffff'], ['L', 0, 1, 0, 0.2, '#2e333b', 0.8]] });
  s.raw(depth + 0.1, `<g class="${T}">${pg([[x + l, y + w, hz], [x + l + w * 0.72, yc, hz], [x + l + w * 0.72, yc, 0], [x + l, y + w, 0]], s.faceL(c))}${pg([[x + l, y, hz], [x + l + w * 0.72, yc, hz], [x + l, y + w, hz]], '#f1ece4')}</g>`);
  s.box({ x: x + l * 0.17, y: y + w * 0.15, z: hz, w: l * 0.5, d: w * 0.68, h: w * 0.52, c: '#ffffff', shadow: false, depth: depth + 0.2, cls: T, decals: glass });
  s.box({ x: x + l * 0.25, y: y + w * 0.26, z: hz + w * 0.52, w: l * 0.32, d: w * 0.45, h: w * 0.36, c: '#ffffff', shadow: false, depth: depth + 0.3, cls: T, decals: glass });
  s.box({ x: x + l * 0.2, y: y + w * 0.34, z: hz + w * 0.88, w: w * 0.26, d: w * 0.26, h: w * 0.36, c: '#2e333b', shadow: false, depth: depth + 0.4, cls: T, decals: [['L', 0, 1, 0.5, 0.8, c], ['R', 0, 1, 0.5, 0.8, c]] });
}

/* A stack of containers as one block, each tier its own colour. */
function stack(s, x, y, z, w, d, tiers, depth) {
  const k = tiers.length, dec = [];
  tiers.forEach((c, i) => { dec.push(['L', 0, 1, i / k, (i + 1) / k, c], ['R', 0, 1, i / k, (i + 1) / k, c]); if (i) dec.push(['L', 0, 1, i / k - 0.012, i / k + 0.012, '#1b2436', 0.35], ['R', 0, 1, i / k - 0.012, i / k + 0.012, '#1b2436', 0.35]); });
  for (const u of [0.33, 0.66]) dec.push(['L', u - 0.01, u + 0.01, 0.03, 0.97, '#1b2436', 0.14]);
  s.box({ x, y, z, w, d, h: 3.1 * k, c: tiers[0], top: lit(tiers[k - 1], 0.3), decals: dec, depth });
}

/* A tapered lattice tower on a square footprint (telecom mast, pylon). */
export function lattice(s, x0, y0, b, H, t = 3, c = '#8b95a2') {
  const cx = x0 + b / 2, cy = y0 + b / 2;
  const base = [[x0, y0], [x0 + b, y0], [x0 + b, y0 + b], [x0, y0 + b]];
  const top = base.map(([x, y]) => [cx + (x - cx) * (t / b), cy + (y - cy) * (t / b)]);
  const at = (i, f) => [base[i][0] + (top[i][0] - base[i][0]) * f, base[i][1] + (top[i][1] - base[i][1]) * f, H * f];
  let g = '';
  const seg = (a, b2, w, op = 1, col = c) => { const A = P(...a), B = P(...b2); g += `<path d="M${n2(A[0])},${n2(A[1])}L${n2(B[0])},${n2(B[1])}" stroke="${col}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round"/>`; };
  seg(at(0, 0), at(0, 1), 0.7, 0.45);
  const n = Math.max(6, Math.round(H / 9));
  for (const [i, j] of [[3, 2], [1, 2]]) for (let k = 0; k < n; k++) {
    const f0 = k / n, f1 = (k + 1) / n;
    seg(at(i, f0), at(j, f1), 0.42, 0.85); seg(at(j, f0), at(i, f1), 0.42, 0.85); seg(at(i, f1), at(j, f1), 0.5, 0.8);
  }
  for (const i of [1, 3, 2]) seg(at(i, 0), at(i, 1), i === 2 ? 1.15 : 0.95);
  seg(at(2, 0), at(2, 1), 0.35, 0.6, '#ffffff');
  s.raw(cx + cy, g);
  s.shade2d(x0, y0, b, b, H * 0.25, 0, 0.1);
}

/* Portfolio: a glass control centre with the fleet dashboard floating over it,
   and the sites it runs - a solar row, a battery yard, a village - wired in. */
export function portfolio(u) {
  const s = new Iso(u), A = '#2466c2', G = '#1fb26b';
  s.slab({ top: '#b3d899' });
  for (const q of [[[24, 22], [70, 22], [70, 62], [24, 62]], [[44, 62], [50, 62], [50, 100], [44, 100]], [[70, 37], [100, 37], [100, 42], [70, 42]], [[0, 37], [24, 37], [24, 42], [0, 42]]]) s.patch(q, '#e9eef3');
  s.patch([[25.5, 23.5], [68.5, 23.5], [68.5, 60.5], [25.5, 60.5]], 'none', 'stroke="#d3dbe5" stroke-width=".5"');
  for (const [x, y, w, d, top] of [[4, 62, 30, 34, '#ede6d6'], [72, 4, 25, 30, '#e2e7ed'], [62, 64, 34, 33, '#a3cf86']]) s.box({ x, y, w, d, h: 1, c: '#eef1f5', top, depth: -1 });
  // solar site
  for (const y of [65, 75, 85]) s.panel({ x: 7, y, z: 2.2, w: 23, d: 6, rise: 4, cols: 6 });
  // battery site: three containers with their status LEDs
  for (const y of [7, 15.5, 24]) s.box({ x: 75, y, z: 1, w: 19, d: 6, h: 6.5, c: '#f4f6f9', top: '#e4e9ef',
    decals: [['L', 0, 1, 0.74, 0.86, A], ['L', 0.06, 0.22, 0.08, 0.62, '#d4dbe4'], ['L', 0.78, 0.94, 0.08, 0.62, '#d4dbe4'], ['L', 0.46, 0.52, 0.4, 0.52, G], ['R', 0.2, 0.8, 0.3, 0.62, '#cfd6df']] });
  // village site
  [[66, 68, 11, 9, 6.5, '#d0674a'], [83, 69, 10, 8, 6, '#c65a3e'], [68, 84, 10, 8, 6, '#d98256']].forEach(([x, y, w, d, h, roof]) => s.house({ x, y, w, d, h, roof }));
  s.panel({ x: 83, y: 85, z: 1.8, w: 9, d: 4, rise: 2.4, cols: 3, rows: 1 });
  s.palm({ x: 93, y: 92, s: 0.55 });
  // the control centre: glass curtain wall, entrance canopy, roof plant, dish
  const dec = [['L', 0, 1, 0.9, 0.96, A], ['R', 0, 1, 0.9, 0.96, A], ['L', 0.38, 0.62, 0, 0.15, 'glass']];
  for (const f of ['L', 'R']) {
    dec.push([f, 0.04, 0.96, 0.2, 0.84, 'glass']);
    for (let k = 1; k < 8; k++) dec.push([f, k / 8 - 0.005, k / 8 + 0.005, 0.2, 0.84, '#ffffff', 0.7]);
    for (const v of [0.41, 0.62]) dec.push([f, 0.04, 0.96, v - 0.012, v + 0.012, '#ffffff', 0.85]);
  }
  s.box({ x: 34, y: 30, w: 28, d: 22, h: 22, c: '#eef2f7', top: '#dce4ed', decals: dec, depth: 89 });
  s.box({ x: 42, y: 52, z: 3.6, w: 12, d: 3.5, h: 0.7, c: '#f7f9fb', shadow: false });
  s.box({ x: 37, y: 33, z: 22, w: 7, d: 6, h: 2.2, c: '#dfe4ea', shadow: false, depth: 89.4, decals: [['L', 0.1, 0.9, 0.3, 0.7, '#c3ccd6']] });
  s.box({ x: 37.5, y: 42, z: 22, w: 5, d: 5, h: 1.8, c: '#dfe4ea', shadow: false, depth: 89.5 });
  s.box({ x: 47, y: 39, z: 22, w: 4, d: 4, h: 1.4, c: A, shadow: false, depth: 89.6 });
  s.box({ x: 55.2, y: 35.2, z: 22, w: 0.8, d: 0.8, h: 3.4, c: '#aab3be', shadow: false, depth: 89.7 });
  dish(s, 56.8, 35.6, 27, 'R', 3, 89.8);
  s.line([58.5, 47.5, 22], [58.5, 47.5, 30], { c: '#8e97a3', w: 0.45, depth: 89.9 });
  // the dashboard, projected up from the roof
  const [bx, by] = P(49, 41, 23.4);
  s.raw(899, `<polygon points="${n2(bx)},${n2(by)} ${Q([70, 40, 40], [26, 40, 40])}" fill="${s.lin([[0, A, 0.1], [1, A, 0.34]])}"/>`);
  const vals = [5, 7, 6, 9, 8, 11, 13], bar = s.lin([[0, lit(A, 0.4)], [1, A]]);
  let body = `<path d="M0,2a2,2 0 0 1 2,-2h40a2,2 0 0 1 2,2v2.8h-44z" fill="${A}"/>` + tl(3, 1.6, 11, '#ffffff') + [35.6, 38.2, 40.8].map((x) => `<circle cx="${x}" cy="2.2" r=".7" fill="#ffffff" opacity=".85"/>`).join('');
  vals.forEach((v, i) => { body += `<rect x="${3 + i * 4}" y="${21.5 - v}" width="2.6" height="${v}" rx=".5" fill="${bar}"/>`; });
  const tr = vals.map((v, i) => [4.3 + i * 4, 19 - v]);
  body += `<path d="M2.5,21.8H31" stroke="#c9d3e0" stroke-width=".3"/><polyline points="${tr.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${G}" stroke-width=".85" stroke-linejoin="round"/>` +
    tr.map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".75" fill="#ffffff" stroke="${G}" stroke-width=".5"/>`).join('') +
    `<circle cx="37.5" cy="12.4" r="4" fill="none" stroke="#dde5f0" stroke-width="1.6"/><circle cx="37.5" cy="12.4" r="4" fill="none" stroke="${G}" stroke-width="1.6" stroke-dasharray="19.6 25.2" transform="rotate(-90 37.5 12.4)"/>` +
    tl(36, 11.8, 3, '#9aa9bd') + tl(33.5, 19, 8) + tl(33.5, 21.2, 5.5, '#dfe5ee');
  glassCard(s, [26, 40, 64], 'L', 44, 24, A, body);
  // each site reports in: a status light and a data link arcing to the roof
  for (const [lx, ly, tx, ty] of [[31, 64, 35, 51], [73, 32, 61, 31], [63.5, 65.5, 61, 51]]) {
    const [cx, cy] = P(lx + 0.35, ly + 0.35, 7.6);
    s.box({ x: lx, y: ly, z: 1, w: 0.7, d: 0.7, h: 6, c: '#aab4c0', shadow: false });
    s.glow({ x: lx + 0.35, y: ly + 0.35, z: 7.6, r: 5, c: G, op: 0.75, depth: 700 });
    s.raw(701, `<circle class="hx-pulse" cx="${n2(cx)}" cy="${n2(cy)}" r="1.45" fill="${G}" stroke="#ffffff" stroke-width=".5"/>`);
    s.line([lx + 0.35, ly + 0.35, 7.6], [tx, ty, 22.5], { c: A, w: 0.35, op: 0.3, sag: -7, depth: 800 });
    s.line([lx + 0.35, ly + 0.35, 7.6], [tx, ty, 22.5], { c: A, w: 0.85, dash: '1.4 1.3', sag: -7, depth: 801, cls: 'hx-flow' });
  }
  s.car({ x: 64.5, y: 44, dir: 'y', c: '#ffffff' });
  s.car({ x: 64.5, y: 52.5, dir: 'y', c: A });
  s.person({ x: 47, y: 58, c: A });
  s.person({ x: 51, y: 65, c: '#e8743b' });
  [[4, 30, 0.7], [6, 16, 0.6], [14, 36, 0.62], [64, 10, 0.72], [90, 50, 0.7], [57, 93, 0.75]].forEach(([x, y, k]) => s.tree({ x, y, s: k }));
  [[41.5, 72], [41.5, 84], [52.5, 78], [26, 55]].forEach(([x, y]) => s.bush({ x, y, s: 0.75 }));
  return s.render();
}

/* Jarvis: a glowing voice orb on a podium, its words rippling across the floor,
   a waveform arcing round it and two answers floating up as glass cards. */
export function jarvis(u) {
  const s = new Iso(u), A = '#1f8fd6', V = '#5cc8f0';
  s.slab({ top: '#e4eef7', texture: 0.3 });
  s.ground.push(on([48, 46, 0], 'T', `<circle r="36" fill="${s.rad([[0, V, 0.7], [0.5, V, 0.26], [1, V, 0]], 0.5, 0.5, 0.5)}"/>`));
  s.ground.push(on([48, 46, 0], 'T', [17, 24, 31, 38, 45, 52].map((r, i) =>
    `<circle r="${r}" fill="none" stroke="${A}" stroke-width="${n2(0.8 - i * 0.09)}" stroke-opacity="${n2(0.42 - i * 0.06)}"/>`).join('') +
    ['M20 3H32L37 8H50', 'M3 20V31L8 36V52', 'M-20 -3H-31L-35 -7H-46', 'M-3 -20V-29L-7 -33V-44'].map((d) => `<path d="${d}" fill="none" stroke="${V}" stroke-width=".55" stroke-opacity=".75"/>`).join('') +
    [[50, 8], [8, 52], [-46, -7], [-7, -44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="${A}" opacity=".7"/>`).join('')));
  // the waveform: bars standing on an arc in front of the podium
  for (let k = 0; k < 23; k++) {
    const t = (-22 + k * 6) * Math.PI / 180, env = Math.sin(Math.PI * (k + 0.5) / 23);
    const h = n2(1.4 + 11 * env * (0.35 + 0.65 * Math.abs(Math.sin(k * 1.9))));
    s.box({ x: 48 + 39 * Math.cos(t) - 1, y: 46 + 39 * Math.sin(t) - 1, w: 2, d: 2, h, c: mix('#b7daf2', A, h / 12.5) });
  }
  // podium
  s.cyl({ x: 48, y: 46, r: 18, h: 3, c: '#f5f8fb', depth: 94 });
  s.cyl({ x: 48, y: 46, z: 3, r: 14, h: 3, c: '#e5edf5', shadow: false, depth: 94.1 });
  s.ring({ x: 48, y: 46, z: 6, r: 12.6, c: A, w: 0.7, op: 0.85, depth: 94.65 });
  s.cyl({ x: 48, y: 46, z: 6, r: 10, h: 1.2, c: '#b9d6ee', top: '#dcebf8', shadow: false, depth: 94.2 });
  const [bx, by] = P(48, 46, 7.2), [ox, oy] = P(48, 46, 32);
  s.raw(95, `<polygon points="${n2(bx - 7.5)},${n2(by)} ${n2(bx + 7.5)},${n2(by)} ${n2(ox + 4)},${n2(oy + 8)} ${n2(ox - 4)},${n2(oy + 8)}" fill="${s.lin([[0, V, 0.45], [1, V, 0.05]])}"/>`);
  // the orb: halo, sphere, a voice trace across it, a specular highlight
  s.glow({ x: 48, y: 46, z: 32, r: 27, c: V, op: 0.55, depth: 95.4, cls: 'hx-pulse' });
  s.sphere({ x: 48, y: 46, z: 32, r: 10.5, c: '#2587d6', depth: 96, shadowZ: 7.2 });
  const wave = (amp, ph) => Array.from({ length: 41 }, (_, i) => `${n2(ox - 9 + i * 0.45)},${n2(oy + amp * Math.sin(i / 40 * Math.PI) * Math.sin(i / 40 * Math.PI * 3 + ph))}`).join(' ');
  s.raw(96.1, `<polyline points="${wave(3.4, 0)}" fill="none" stroke="#ffffff" stroke-width=".75" stroke-opacity=".85" stroke-linecap="round"/>` +
    `<polyline points="${wave(2.2, 1.6)}" fill="none" stroke="#d6eaf8" stroke-width=".5" stroke-opacity=".6"/>` +
    `<ellipse cx="${n2(ox - 4.2)}" cy="${n2(oy - 5.6)}" rx="3.4" ry="1.8" transform="rotate(-28 ${n2(ox - 4.2)} ${n2(oy - 5.6)})" fill="#ffffff" opacity=".5"/>`);
  // tilted orbit rings, back half behind the orb, front half in front
  const orbit = (rx, ry, rot, st, moon) => {
    const a = `transform="rotate(${rot} ${n2(ox)} ${n2(oy)})" fill="none" ${st}`;
    s.raw(95.6, `<path d="M${n2(ox - rx)},${n2(oy)}A${rx},${ry} 0 0 1 ${n2(ox + rx)},${n2(oy)}" ${a}/>`);
    s.raw(96.5, `<path d="M${n2(ox - rx)},${n2(oy)}A${rx},${ry} 0 0 0 ${n2(ox + rx)},${n2(oy)}" ${a}/>` +
      `<circle cx="${n2(ox + rx * Math.cos(moon))}" cy="${n2(oy + ry * Math.sin(moon))}" r="1.2" fill="#ffffff" stroke="${A}" stroke-width=".5" transform="rotate(${rot} ${n2(ox)} ${n2(oy)})"/>`);
  };
  orbit(22, 6, -14, `stroke="${V}" stroke-width=".8" stroke-dasharray="2.2 1.6" class="hx-spin"`, 0.9);
  orbit(28, 8.5, 12, `stroke="${A}" stroke-width=".5" stroke-opacity=".55" stroke-dasharray=".7 2" class="hx-spin"`, 2.3);
  [[40, 40, 44, 0], [58, 48, 47, 0.8], [44, 54, 40, 1.6], [55, 37, 51, 2.4]].forEach(([x, y, z, dl]) => {
    const [px, py] = P(x, y, z);
    s.raw(97, `<circle class="hx-rise" style="animation-delay:${dl}s" cx="${n2(px)}" cy="${n2(py)}" r=".9" fill="${V}"/>`);
  });
  // answers: a question heard (left) and an answer with a chart (right)
  glassCard(s, [4, 66, 46], 'L', 28, 15, A, `<circle cx="4.4" cy="4.6" r="2.6" fill="${A}"/><rect x="3.7" y="3" width="1.4" height="2.5" rx=".7" fill="#ffffff"/>` +
    `<path d="M3.1,4.7a1.3,1.3 0 0 0 2.6,0M4.4,6v.8" stroke="#ffffff" stroke-width=".35" fill="none"/>` + tl(9, 3.3, 15) + tl(9, 5.9, 10, '#d4e0ec') +
    [2, 3.4, 5, 2.6, 4.2, 6, 3.6, 2.2, 4.8, 3, 1.8, 3.8, 2.4, 1.4].map((h, i) => `<rect x="${3 + i * 1.6}" y="${n2(11.4 - h / 2)}" width=".8" height="${h}" rx=".4" fill="${V}"/>`).join(''), 900, 0);
  glassCard(s, [86, 44, 48], 'R', 28, 17, A, `<circle cx="4.2" cy="4.4" r="2.4" fill="#1fb26b"/><path d="M3,4.4l.9,.9 1.6,-1.8" stroke="#ffffff" stroke-width=".55" fill="none"/>` +
    tl(8.4, 3.1, 14) + tl(8.4, 5.7, 9, '#d4e0ec') + `<path d="M3,15L3,12L7,10.5L11,11.2L15,8.5L19,9.2L25,6.8L25,15Z" fill="${s.lin([[0, V, 0.55], [1, V, 0.05]])}"/>` +
    `<polyline points="3,12 7,10.5 11,11.2 15,8.5 19,9.2 25,6.8" fill="none" stroke="${A}" stroke-width=".6" stroke-linejoin="round"/>`, 901, 1.2);
  for (const [x, y, rx] of [[18, 66, 13], [86, 30, 12]]) { const [px, py] = P(x, y); s.shadows.push(`<ellipse cx="${n2(px)}" cy="${n2(py)}" rx="${rx}" ry="3" fill="#173a5c" opacity=".07"/>`); }
  return s.render();
}

/* Village: a solar mini-grid feeding a kampung along a dirt road - panels, the
   battery and inverter container, poles and wires, palms and a rice paddy. */
export function village(u) {
  const s = new Iso(u), A = '#d0674a', W = '#ffc53d';
  s.slab({ top: '#b2d792' });
  const ry = (x) => 48 + 2.4 * Math.sin(x * 0.07), xs = Array.from({ length: 11 }, (_, i) => i * 10);
  s.patch([...xs.map((x) => [x, ry(x) - 4]), ...xs.slice().reverse().map((x) => [x, ry(x) + 4])], '#e6d09f');
  s.ground.push(`<path d="${[-1.5, 1.5].map((o) => 'M' + xs.map((x) => P(x, ry(x) + o).map(n2).join(',')).join('L')).join('')}" fill="none" stroke="#c9ab72" stroke-width=".5" stroke-opacity=".55"/>`);
  // rice paddy: four plots behind low bunds, one freshly planted and flooded
  let pad = `<rect x="53" y="57" width="45" height="41" fill="#d6e5a2"/>`;
  [[54, 58, '#8fd16c'], [76, 58, '#a6dcc4'], [54, 78, '#7cc55e'], [76, 78, '#95d572']].forEach(([x, y, c], i) => {
    pad += `<rect x="${x + 0.6}" y="${y + 0.6}" width="19.8" height="18.8" fill="${c}"/>`;
    let d = '';
    for (let k = y + 2; k < y + 19; k += 2) d += `M${x + 1.5} ${k}H${x + 19.5}`;
    pad += `<path d="${d}" stroke="${i === 1 ? '#58a653' : shade(c, 0.22)}" stroke-width="${i === 1 ? 0.8 : 0.5}" ${i === 1 ? 'stroke-dasharray=".7 1"' : ''} stroke-opacity=".7"/>`;
  });
  pad += `<path d="M78 60L90 60L80 70Z" fill="#ffffff" opacity=".28"/>`;
  s.ground.push(on([0, 0, 0], 'T', pad));
  // the mini-grid behind its fence
  for (const y of [6, 16]) s.panel({ x: 56, y, w: 38, d: 7, rise: 4.5, cols: 10 });
  s.box({ x: 58, y: 27, w: 24, d: 9, h: 9, c: '#f4f5f7', top: '#e6e9ee', decals: [['L', 0, 1, 0.74, 0.86, A], ['L', 0.05, 0.17, 0.06, 0.64, '#d5dbe2'],
    ['L', 0.19, 0.31, 0.06, 0.64, '#d5dbe2'], ['L', 0.5, 0.9, 0.34, 0.54, '#c9d1da'], ['L', 0.93, 0.97, 0.4, 0.5, '#1fb26b'], ['R', 0.15, 0.85, 0.3, 0.62, '#cdd4dc']] });
  s.box({ x: 84, y: 29, w: 7, d: 6, h: 5.5, c: '#9aa5b2', decals: [['L', 0.2, 0.8, 0.3, 0.7, '#7f8a97']] });
  s.glow({ x: 81, y: 36, z: 4, r: 2.4, c: '#35e08a', op: 0.8, depth: 95, cls: 'hx-pulse' });
  fence(s, 53, 3, 97, 40, 4, [62, 70]);
  // houses
  const houses = [[14, 5, 12, 10, 7, '#d98256'], [4, 25, 15, 11, 8, '#d0674a'], [27, 28, 13, 10, 7.5, '#c65a3e'],
    [6, 58, 15, 12, 8, '#d98256'], [28, 62, 13, 11, 7.5, '#d0674a'], [12, 80, 12, 10, 7, '#c65a3e']];
  houses.forEach(([x, y, w, d, h, roof], i) => {
    s.house({ x, y, w, d, h, roof, wall: ['#f8efdf', '#e4f1e9', '#fbeee0', '#e9f0f8', '#f6f1dc', '#eef5e6'][i] });
    s.glow({ x: x + 0.63 * w, y: y + d, z: 0.54 * h, r: 2.6, c: '#ffcf6b', op: 0.75, depth: x + w / 2 + y + d / 2 + 0.1 });
  });
  // poles along the road, the feeder from the container, drops to the houses
  const [pa, pb, pc] = [50, 30, 10].map((x) => s.pole({ x, y: ry(x) - 6, h: 15 }));
  const feed = [[58.5, 36, 8.6], pa, pb, pc];
  for (let i = 0; i < 3; i++) {
    s.line(feed[i], feed[i + 1], { c: '#3f4754', w: 0.4, sag: 2.4, depth: 600 });
    s.line(feed[i], feed[i + 1], { c: W, w: 0.7, sag: 2.4, dash: '1 2.2', depth: 601, cls: 'hx-flow' });
  }
  for (const [p, q] of [[pb, [40, 33, 8]], [pc, [19, 30.5, 8.5]], [pb, [41, 67.5, 8]], [pc, [21, 64, 8.5]]]) s.line(p, q, { c: '#3f4754', w: 0.3, sag: 1.4, depth: 590 });
  // life: a motorbike and a car on the road, neighbours, farmers in the paddy
  const mx = 40, my = ry(40) + 1.2;
  s.raw(mx + my + 3, on([mx, my + 0.9, 1.1], 'L', '<circle r="1.1" fill="#262b33"/>') + on([mx + 3.6, my + 0.9, 1.1], 'L', '<circle r="1.1" fill="#262b33"/>'));
  s.box({ x: mx + 0.4, y: my, z: 1.2, w: 3, d: 1, h: 1.1, c: '#d9455e', shadow: false, depth: mx + my + 3.1 });
  s.person({ x: mx + 1.6, y: my + 0.5, z: 1.4, c: '#2f7fd0', depth: mx + my + 3.2 });
  s.car({ x: 66, y: ry(70) - 1.7, c: '#ffffff' });
  s.person({ x: 47, y: 57, c: '#f2b84b' });
  s.person({ x: 49.5, y: 58.5, c: '#2f7fd0' });
  for (const [x, y, c] of [[84, 68, '#f4efe4'], [62, 88, A]]) { s.person({ x, y, c }); hat(s, x, y); }
  [[4, 8, 0.7], [44, 14, 0.75], [47, 34, 0.66], [4, 96, 0.7], [46, 94, 0.75], [27, 90, 0.6], [98, 52, 0.62]].forEach(([x, y, k], i) => s.palm({ x, y, s: k, lean: i % 2 ? -1 : 1 }));
  [[23, 72], [3, 76], [23, 22], [34, 22]].forEach(([x, y]) => s.bush({ x, y, s: 0.8, c: '#4f9f57' }));
  return s.render();
}

/* Telco: a lattice tower with its antennas and dish, taken off diesel by the
   solar array and battery cabinets inside its fenced compound. */
export function telco(u) {
  const s = new Iso(u), A = '#1fa2b8';
  s.slab({ top: '#b7d89b' });
  s.patch([[20, 12], [80, 12], [80, 72], [20, 72]], '#e6e1d4');
  s.patch([[60, 72], [70, 72], [70, 100], [60, 100]], '#ddd5c2');
  s.ground.push(`<path d="M${Q([62.5, 72], [62.5, 100]).replace(' ', 'L')}M${Q([67.5, 72], [67.5, 100]).replace(' ', 'L')}" stroke="#c6bca6" stroke-width=".5"/>`);
  lattice(s, 36, 18, 14, 70, 3.2);
  s.box({ x: 39.6, y: 21.6, z: 55.4, w: 6.8, d: 6.8, h: 0.5, c: '#9aa4b0', shadow: false, depth: 68.2 });
  for (const x of [40.8, 43.6]) s.box({ x, y: 28.4, z: 55, w: 1.7, d: 0.8, h: 8.5, c: '#f4f6f8', shadow: false, depth: 68.5 });
  for (const y of [22.6, 25.4]) s.box({ x: 46.4, y, z: 55, w: 0.8, d: 1.7, h: 8.5, c: '#f4f6f8', shadow: false, depth: 68.5 });
  dish(s, 48, 25.5, 44, 'R', 2.8, 69);
  dish(s, 42, 30.6, 35, 'L', 2.3, 69);
  s.line([43, 25, 70], [43, 25, 73], { c: '#737d89', w: 0.4, depth: 69.5 });
  s.glow({ x: 43, y: 25, z: 71.2, r: 4.5, c: '#ff4d5e', op: 0.65, depth: 69.8, cls: 'hx-blink' });
  s.sphere({ x: 43, y: 25, z: 71.2, r: 0.85, c: '#ff4d5e', shadow: false, depth: 70, cls: 'hx-blink' });
  const [hx, hy] = P(43, 25, 60);
  const arc = (r, a0, a1) => `M${n2(hx + r * Math.cos(a0))},${n2(hy + r * Math.sin(a0))}A${r},${r} 0 0 1 ${n2(hx + r * Math.cos(a1))},${n2(hy + r * Math.sin(a1))}`;
  [9, 14, 19].forEach((r, i) => s.raw(950, `<g><path d="${arc(r, -0.63, 0.63)}${arc(r, 2.51, 3.77)}" fill="none" stroke="${A}" stroke-width="${1.2 - i * 0.2}" stroke-opacity="${0.9 - i * 0.22}" stroke-linecap="round"/></g>`));
  // equipment shelter, cable tray to the tower, battery cabinets, solar rows
  s.box({ x: 56, y: 36, w: 16, d: 11, h: 8.5, c: '#f3f4f6', top: '#e2e6ea', decals: [['L', 0, 1, 0.78, 0.9, A], ['L', 0.08, 0.24, 0, 0.66, '#cfd6de'], ['L', 0.6, 0.9, 0.35, 0.6, '#c3ccd6'], ['R', 0.15, 0.45, 0.3, 0.64, '#cfd6de']] });
  s.box({ x: 72, y: 41, z: 2.5, w: 1.6, d: 3.6, h: 3.2, c: '#dfe3e8', shadow: false, decals: [['R', 0.15, 0.85, 0.2, 0.8, '#aab3be']] });
  s.box({ x: 49, y: 30, z: 6.6, w: 11, d: 1.4, h: 0.5, c: '#8f99a5', shadow: false });
  s.box({ x: 58.6, y: 31.4, z: 6.6, w: 1.4, d: 4.6, h: 0.5, c: '#8f99a5', shadow: false });
  for (const x of [64, 71]) s.box({ x, y: 52, w: 6, d: 5, h: 7, c: '#f4f6f8', top: '#e3e8ed', decals: [['L', 0, 1, 0.8, 0.92, A], ['L', 0.12, 0.88, 0.1, 0.66, '#dfe4ea'], ['L', 0.7, 0.82, 0.5, 0.6, '#1fb26b']] });
  for (const y of [42, 52.5, 63]) s.panel({ x: 22, y, w: 30, d: 6.5, rise: 4.2, cols: 8 });
  fence(s, 20, 12, 80, 72, 4.5, [60, 70]);
  // service van at the gate, a technician walking in
  const vx = 61.5, vy = 79, vd = vx + vy + 7;
  s.box({ x: vx, y: vy, z: 0.9, w: 4, d: 9, h: 4.2, c: '#ffffff', top: '#eef1f4', depth: vd, decals: [['R', 0, 1, 0.3, 0.42, A], ['R', 0.7, 0.94, 0.52, 0.88, 'glass'], ['L', 0.1, 0.9, 0.5, 0.88, 'glass']] });
  s.raw(vd + 0.01, [2, 7].map((d) => on([vx + 4, vy + d, 1.1], 'R', '<circle r="1.1" fill="#262b33"/><circle r=".45" fill="#c9cfd6"/>')).join(''));
  s.person({ x: 67, y: 75, c: '#f2b84b' });
  [[8, 8, 0.9], [7, 30, 0.75], [92, 10, 0.85], [93, 34, 0.7], [8, 84, 0.9], [27, 92, 0.75], [90, 70, 0.8], [86, 92, 0.7]].forEach(([x, y, k]) => s.tree({ x, y, s: k }));
  s.palm({ x: 6, y: 56, s: 0.75 });
  s.palm({ x: 44, y: 91, s: 0.7, lean: -1 });
  [[16, 76], [52, 80], [74, 80], [88, 50]].forEach(([x, y]) => s.bush({ x, y, s: 0.8 }));
  return s.render();
}

/* Marine: a container ship at berth under a ship-to-shore crane, plugged into
   the quay's shore-power cabinet; a stacked yard behind, a tug in the harbour. */
export function maritime(u) {
  const s = new Iso(u), A = '#2f7fd0', G = '#1faa6b', HULL = '#22385c', RED = '#c7423d';
  s.slab({ top: '#67b8e0', side: '#3a8cc0', texture: 0 });
  s.patch([[0, 34], [100, 34], [100, 37.5], [0, 37.5]], '#4f9fcf');
  s.patch([[8, 55], [74, 55], [88, 48], [92, 50], [78, 59], [11, 59]], '#3f8cbd', 'opacity=".6"');
  const r = rng(5);
  let rip = '';
  for (let i = 0; i < 40 && rip.length < 3600; i++) {
    const x = 3 + r() * 90, y = 39 + r() * 58, l = 2 + r() * 4, dl = n2(r() * 2.5);
    if (y < 61 && x < 92) continue;
    const [a, b] = [P(x, y), P(x + l, y)];
    rip += `<line class="hx-shimmer" style="animation-delay:${dl}s" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="#ffffff" stroke-width=".5" stroke-linecap="round" stroke-opacity=".8"/>`;
  }
  s.raw(-1.5, rip);
  // the quay: fenders on its face, a yellow edge line, crane rails, the yard
  const fend = [];
  for (let k = 0.04; k < 0.96; k += 0.07) fend.push(['L', k, k + 0.016, 0.1, 0.9, '#2c3038']);
  s.box({ x: 0, y: 0, w: 100, d: 34, h: 3, c: '#d8d4ca', top: '#ebe8e1', shadow: false, depth: -2, decals: fend });
  s.raw(-1.9, pg([[3, 3, 3], [51, 3, 3], [51, 27, 3], [3, 27, 3]], '#dfdbd2') + pg([[0, 31.8, 3], [100, 31.8, 3], [100, 32.4, 3], [0, 32.4, 3]], '#f2c14e') +
    [5.9, 29.4].map((y) => `<path d="M${Q([0, y, 3], [100, y, 3]).replace(' ', 'L')}" stroke="#9aa1ab" stroke-width=".4"/>`).join(''));
  const cols = ['#d9455e', '#2f7fd0', '#f2b84b', '#1faa6b', '#e8743b', '#7a5ce0', '#3aa0c8'];
  let k = 0;
  const pick = (n) => Array.from({ length: n }, () => cols[(k = (k * 5 + 3) % 7)]);
  [2, 3, 1, 2, 3, 1, 3, 2, 2, 1, 2, 3, 1, 2, 2, 3, 2, 1].forEach((n, i) => stack(s, 5 + (i % 6) * 7.6, 4.5 + Math.floor(i / 6) * 7.6, 3, 7, 3.2, pick(n)));
  [1, 2, 2, 3, 1, 2].forEach((n, i) => stack(s, 76 + (i % 3) * 7.6, 4.5 + Math.floor(i / 3) * 7.6, 3, 7, 3.2, pick(n)));
  // the ship: hull with red boot-top and white sheer line, bow, bridge, cargo
  const dd = (x, y, z = 0) => 100 + (x + y) * 0.01 + z * 0.001;
  s.box({ x: 8, y: 41, w: 66, d: 14, h: 7, c: HULL, top: '#c9d1db', depth: 100, shadow: false, decals: [['L', 0, 1, 0, 0.24, RED], ['L', 0, 1, 0.84, 0.91, '#ffffff', 0.85]] });
  s.raw(100.5, pg([[74, 55, 7], [88, 48, 7], [88, 48, 0], [74, 55, 0]], s.faceL(HULL)) + pg([[74, 55, 1.7], [88, 48, 1.7], [88, 48, 0], [74, 55, 0]], RED) +
    pg([[74, 55, 6.4], [88, 48, 6.4], [88, 48, 5.9], [74, 55, 5.9]], '#ffffff', 'opacity=".85"') + pg([[74, 41, 7], [88, 48, 7], [74, 55, 7]], '#c9d1db', `stroke="${lit('#c9d1db', 0.5)}" stroke-width=".35"`));
  s.box({ x: 10, y: 43, z: 7, w: 9, d: 10, h: 11, c: '#f4f5f7', depth: dd(14.5, 48, 7), decals: [['L', 0.08, 0.92, 0.78, 0.9, '#2c3e5a'], ['R', 0.08, 0.92, 0.78, 0.9, '#2c3e5a'], ['L', 0.1, 0.9, 0.5, 0.58, 'glass'], ['L', 0.1, 0.9, 0.24, 0.32, 'glass']] });
  s.box({ x: 9, y: 41.5, z: 18, w: 11, d: 13, h: 1.2, c: '#ffffff', shadow: false, depth: dd(14.5, 48, 18) });
  s.box({ x: 12.5, y: 45.5, z: 19.2, w: 4, d: 5, h: 5, c: '#f4f5f7', shadow: false, depth: dd(14.5, 48, 19.2), decals: [['L', 0, 1, 0.45, 0.72, A], ['R', 0, 1, 0.45, 0.72, A], ['L', 0, 1, 0.86, 1, '#2a2f38'], ['R', 0, 1, 0.86, 1, '#2a2f38']] });
  [2, 1, 2, 2, 1, 2, 1, 2, 2, 1, 2, 2, 0, 1, 0, 2, 1, 2, 2, 2, 1].forEach((n, i) => {
    const x = 22 + Math.floor(i / 3) * 7.2, y = 41.8 + (i % 3) * 4.4;
    if (n) stack(s, x, y, 7, 6.8, 4.2, pick(n), dd(x + 3.4, y + 2.1, 7));
  });
  for (const [x, bx] of [[24, 28], [10, 14], [80, 84]]) s.line([bx, 32.8, 4.2], [x, x > 74 ? 44 : 41.3, 7], { c: '#efe6cf', w: 0.32, depth: 100.2 });
  for (const x of [14, 28, 42, 84, 96]) s.cyl({ x, y: 32.8, z: 3, r: 0.8, h: 1.4, c: '#2e333b', shadow: false });
  // ship-to-shore crane: portal legs on the rails, boom out over the ship
  for (const [x, y] of [[56, 5], [56, 28.5], [70, 5], [70, 28.5]]) s.box({ x, y, z: 3, w: 1.8, d: 1.8, h: 28, c: A, shadow: false });
  for (const y of [4.6, 28.1]) s.box({ x: 55.6, y, z: 30, w: 16.6, d: 2.6, h: 2.2, c: lit(A, 0.08), shadow: false });
  s.box({ x: 60.5, y: 0.5, z: 34, w: 6, d: 76, h: 2.4, c: lit(A, 0.12), shadow: false, depth: 900 });
  let truss = '';
  for (let j = 0; j < 19; j++) truss += `M${Q([66.5, 0.5 + j * 4, 34])}L${Q([66.5, 2.5 + j * 4, 36.4])}L${Q([66.5, 4.5 + j * 4, 34])}`;
  s.raw(900.1, `<path d="${truss}" fill="none" stroke="#ffffff" stroke-width=".3" stroke-opacity=".6"/>`);
  s.box({ x: 59.5, y: 3, z: 36.4, w: 8, d: 12, h: 4, c: '#f4f5f7', shadow: false, depth: 900.2, decals: [['L', 0, 1, 0.68, 0.82, A], ['R', 0, 1, 0.68, 0.82, A]] });
  for (const [a, b] of [[[63.5, 9, 40.4], [63.5, 9, 46]], [[63.5, 9, 46], [63.5, 76, 36.4]], [[63.5, 9, 46], [63.5, 0.8, 36.4]]]) s.line(a, b, { c: shade(A, 0.1), w: 0.55, depth: 900.3 });
  s.box({ x: 61, y: 38, z: 30.8, w: 4, d: 3.4, h: 3, c: '#f4f5f7', shadow: false, depth: 900.4, decals: [['L', 0.1, 0.9, 0.3, 0.9, 'glass'], ['R', 0.1, 0.9, 0.3, 0.9, 'glass']] });
  s.box({ x: 60.8, y: 47, z: 31.8, w: 5.4, d: 3.4, h: 2, c: '#2b3a52', shadow: false, depth: 900.5 });
  for (const x of [62, 65]) s.line([x, 48.7, 31.8], [x, 48.7, 20.8], { c: '#2b3140', w: 0.25, depth: 900.6 });
  s.box({ x: 59.8, y: 47.1, z: 20.2, w: 7.4, d: 3.3, h: 0.6, c: '#f2b84b', shadow: false, depth: 900.7 });
  stack(s, 60, 47.2, 17, 7, 3.2, ['#e8743b'], 900.8);
  // shore power: the cabinet on the quay and the live cable to the ship
  s.box({ x: 78.5, y: 24, z: 3, w: 8, d: 6, h: 8.5, c: '#f4f6f8', top: '#e3e8ee', decals: [['L', 0, 1, 0.84, 0.95, A], ['L', 0.1, 0.9, 0.12, 0.72, '#e6f6ee'], ['L', 0.36, 0.64, 0.3, 0.6, G], ['R', 0.2, 0.8, 0.2, 0.7, '#dfe5ec']] });
  s.glow({ x: 85.5, y: 30, z: 10.2, r: 2.6, c: '#35e08a', op: 0.9, depth: 903, cls: 'hx-pulse' });
  s.line([82.5, 30.2, 5.5], [76, 41.4, 7.2], { c: '#127a48', w: 1.3, sag: 4, depth: 902 });
  s.line([82.5, 30.2, 5.5], [76, 41.4, 7.2], { c: '#8ff0bf', w: 0.6, sag: 4, dash: '1.2 1.5', depth: 902.1, cls: 'hx-flow' });
  s.person({ x: 87.5, y: 32, z: 3, c: '#f2b84b' });
  s.person({ x: 48, y: 30.5, z: 3, c: '#e8743b' });
  s.box({ x: 34, y: 28.8, z: 3.6, w: 9.6, d: 2.6, h: 0.6, c: '#3a4150', shadow: false });
  stack(s, 34.2, 28.6, 4.2, 9, 3, ['#3aa0c8'], 76);
  s.box({ x: 44, y: 28.6, z: 3.4, w: 3, d: 3, h: 3.4, c: '#f4f5f7', decals: [['L', 0.1, 0.9, 0.45, 0.9, 'glass'], ['R', 0.1, 0.9, 0.45, 0.9, 'glass']] });
  // a tug and a pilot boat in the harbour; channel buoys
  boat(s, 30, 71.5, 12, 6.2, '#d9455e', 110);
  boat(s, 64, 85, 8, 4.2, '#f29a2e', 160);
  for (const [x, y, c] of [[92, 64, '#d9455e'], [44, 94, G]]) { s.cyl({ x, y, r: 1.1, h: 2.6, c }); s.sphere({ x, y, z: 3.4, r: 0.55, c: '#fff4c2', shadow: false, cls: 'hx-blink' }); }
  return s.render();
}

/* Agri: a patchwork of fields - wheat, row crops, a centre pivot - with the
   farmstead, and an Earth-observation satellite reading one field's NDVI. */
export function agri(u) {
  const s = new Iso(u), A = '#4f9e3a';
  s.slab({ top: '#e0d0a4', texture: 0.4 });
  let g = '';
  const field = (x0, y0, x1, y1, c, dir, step = 2.2) => {
    g += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="${c}"/>`;
    let d = '';
    if (dir === 'x') for (let y = y0 + step / 2; y < y1; y += step) d += `M${x0 + 0.8} ${n2(y)}H${x1 - 0.8}`;
    if (dir === 'y') for (let x = x0 + step / 2; x < x1; x += step) d += `M${n2(x)} ${y0 + 0.8}V${y1 - 0.8}`;
    if (d) g += `<path d="${d}" stroke="${shade(c, 0.22)}" stroke-width=".55" stroke-opacity=".55"/>`;
  };
  field(2, 2, 35, 27, '#a9d38b');
  field(2, 30, 35, 54, '#e8c75e', 'x');
  field(2, 58, 35, 98, '#86c45c', 'y');
  field(39, 2, 98, 54, '#6dbb50', 'x');
  field(39, 58, 98, 98, '#d8d690', 'x', 3);
  g += `<rect x="2.6" y="38.6" width="14" height="4.4" fill="#f5e3a4"/>`;
  // NDVI heat patch on the field under the satellite, its edge being scanned
  const ramp = ['#e0452f', '#f6932f', '#fbd341', '#b5dc4f', '#5cb946', '#2e9142'];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) {
    const v = Math.min(0.999, Math.max(0, 0.6 + 0.3 * Math.sin(i * 0.8 + 1) * Math.cos(j * 0.9) + 0.16 * Math.sin(i * j * 0.7) - 0.03 * j));
    g += `<rect x="${n2(39.4 + i * 7.275)}" y="${n2(2.4 + j * 8.533)}" width="7.3" height="8.55" fill="${ramp[Math.floor(v * 6)]}" opacity=".93"/>`;
  }
  g += `<rect class="hx-flow" x="39.4" y="2.4" width="58.2" height="51.2" fill="none" stroke="#ffffff" stroke-width=".8" stroke-dasharray="2 1.4"/>`;
  // centre pivot: a green disc of rings, the freshly watered sector brighter
  const pc = [68.5, 78], pr = 18.5, pt = (a, r = pr) => [n2(pc[0] + r * Math.cos(a)), n2(pc[1] + r * Math.sin(a))], e = pt(3.4);
  g += `<circle cx="${pc[0]}" cy="${pc[1]}" r="${pr}" fill="#56a943"/>` + [15.5, 12.5, 9.5, 6.5, 3.5].map((r) => `<circle cx="${pc[0]}" cy="${pc[1]}" r="${r}" fill="none" stroke="#46963a" stroke-width=".5" stroke-opacity=".7"/>`).join('') +
    `<path d="M${pc.join(' ')}L${e.join(' ')}A${pr} ${pr} 0 0 1 ${pt(4.7).join(' ')}Z" fill="#8fd068" opacity=".55"/>`;
  s.ground.push(on([0, 0, 0], 'T', g));
  // centre-pivot arm on its wheeled towers
  s.cyl({ x: pc[0], y: pc[1], r: 1, h: 4, c: '#c9d0d8' });
  for (const t of [0.34, 0.67, 1]) {
    const [tx, ty] = pt(3.4, pr * t);
    for (const o of [-0.8, 0.8]) s.line([tx + o, ty + o, 0], [tx, ty, 3.3], { c: '#9aa4b0', w: 0.4, depth: tx + ty });
  }
  s.line([pc[0], pc[1], 3.6], [e[0], e[1], 3.3], { c: '#e6ebf0', w: 0.8, depth: (pc[0] + e[0]) / 2 + (pc[1] + e[1]) / 2 + 2 });
  // farmstead: red barn, farmhouse, silos
  s.house({ x: 5, y: 5, w: 12, d: 10, h: 8, wall: '#c8453b', roof: '#5d6672' });
  s.house({ x: 17, y: 15, w: 10, d: 9, h: 6.5, roof: '#d0674a' });
  for (const [x, y, r, h] of [[8.5, 21, 2.6, 12], [13.2, 23, 2.1, 10]]) { s.cyl({ x, y, r, h, c: '#e3e7ec', depth: x + y }); s.sphere({ x, y, z: h, r: r * 0.9, c: '#c9d0d8', shadow: false, depth: x + y + 0.01 }); }
  tractor(s, 16, 39, A);
  // tree lines down the farm track and along the pivot field
  for (let y = 61; y <= 95; y += 6.8) s.tree({ x: 37, y, s: 0.48 });
  for (let x = 42; x <= 97; x += 6) s.tree({ x, y: 56, s: 0.44, c: x % 12 ? '#4f9f57' : '#5aa860' });
  [[30, 4, 0.7], [3, 28, 0.6], [30, 26, 0.55]].forEach(([x, y, k]) => s.tree({ x, y, s: k }));
  // the satellite and its nadir line to the NDVI field (the site draws no scan cones)
  const [ax, ay] = P(64, 18, 62), [nx, ny] = P(64, 18, 0);
  s.raw(95, `<path d="M${n2(ax)},${n2(ay)}L${n2(nx)},${n2(ny)}" stroke="${A}" stroke-width=".45" stroke-opacity=".7" stroke-dasharray="1.5 1.5"/>` +
    `<circle cx="${n2(nx)}" cy="${n2(ny)}" r="1.1" fill="#ffffff" stroke="${A}" stroke-width=".45"/>`);
  const wing = s.lin([[0, '#6fa6ea'], [0.5, '#2c5eb4'], [1, '#183a78']]);
  let sat = '';
  for (const [a, b] of [[[67.8, 14.2], [80, 2]], [[60.2, 21.8], [48, 34]]]) {
    sat += `<path d="M${Q([...a, 65.8], [...b.map((v, i) => (v + a[i]) / 2), 65.8]).replace(' ', 'L')}" stroke="#aab3bf" stroke-width=".5"/>`;
    sat += pg([[...a.map((v, i) => v + (b[i] - v) * 0.12), 67.6], [...b, 67.6], [...b, 64], [...a.map((v, i) => v + (b[i] - v) * 0.12), 64]], wing, 'stroke="#e9eef5" stroke-width=".4"');
    for (let t = 0.34; t < 1; t += 0.22) { const q = a.map((v, i) => v + (b[i] - v) * t), [p1, p2] = [P(...q, 67.6), P(...q, 64)]; sat += `<path d="M${n2(p1[0])},${n2(p1[1])}V${n2(p2[1])}" stroke="#ffffff" stroke-opacity=".4" stroke-width=".3"/>`; }
  }
  s.raw(900, `<g class="hx-bob">${sat}</g>`);
  s.box({ x: 61.2, y: 15.2, z: 62.6, w: 5.6, d: 5.6, h: 6, c: '#d9a93a', top: '#f3d27a', shadow: false, depth: 901, cls: 'hx-bob', decals: [['L', 0.12, 0.88, 0.14, 0.86, '#c28e26', 0.55], ['R', 0.12, 0.88, 0.14, 0.86, '#b88422', 0.4]] });
  s.raw(902, `<g class="hx-bob"><ellipse cx="${n2(ax)}" cy="${n2(ay + 0.3)}" rx="2.6" ry="1.2" fill="#f4f6f8" stroke="#aab3bf" stroke-width=".3"/><circle class="hx-pulse" cx="${n2(ax)}" cy="${n2(ay - 7.6)}" r=".9" fill="#35e08a"/></g>`);
  return s.render();
}

/* Agrivoltaics: tall solar tables over rows of lettuce, a farmer and a small
   tractor working in the dappled shade beneath, drip lines, palms at the edge. */
export function agrivoltaics(u) {
  const s = new Iso(u), A = '#6f9f2e';
  s.slab({ top: '#c9a26d', texture: 0.5 });
  s.patch([[0, 0], [100, 0], [100, 6], [6, 6], [6, 100], [0, 100]], '#9fcf7c');
  const rows = [12, 18, 26, 31, 41, 47, 53, 62, 67, 78, 84, 90];
  let g = '';
  for (const y of rows) g += `<path d="M9 ${y + 0.4}H97" stroke="#94703f" stroke-width="3" stroke-opacity=".28"/><path d="M9 ${y + 1.9}H97" stroke="#2f86d6" stroke-width=".4"/><path d="M11 ${y + 1.9}H97" stroke="#e4f3ff" stroke-width=".55" stroke-dasharray="0 3.2" stroke-linecap="round"/>`;
  g += `<path d="M8.6 10V96H4" fill="none" stroke="#2f86d6" stroke-width=".9"/>`;
  s.ground.push(on([0, 0, 0], 'T', g));
  s.cyl({ x: 4, y: 94, r: 2.6, h: 6, c: '#3a8fd6' });
  const skip = (x, y) => (y === 31 && x > 36 && x < 48) || ((y === 62 || y === 67) && x > 54 && x < 70);
  const lr = rng(9);
  for (const y of rows) for (let x = 10.5; x <= 96; x += 4.5) if (!skip(x, y)) s.sphere({ x, y, z: 1.2, r: n2(1.25 + lr() * 0.4), c: y % 3 ? '#74b83f' : '#8fca55', depth: x + y, shadow: false });
  for (const y of rows) s.shadows.push(pg([[9, y + 1], [97, y + 1], [98.5, y + 3], [10.5, y + 3]], '#1b2436', 'opacity=".12"'));
  // elevated tables: posts, the panel, and dappled shade with light through the gaps
  for (const y of [22, 57]) for (const x of [6, 36, 66]) {
    for (const [px, py, h] of [[x + 2, y + 1, 20.1], [x + 25, y + 1, 20.1], [x + 2, y + 10, 16.4], [x + 25, y + 10, 16.4]]) s.box({ x: px, y: py, w: 0.9, d: 0.9, h, c: '#9aa5b2', shadow: false, ao: false });
    s.panel({ x, y, z: 16, w: 28, d: 11, rise: 4.5, cols: 7, rows: 2, legs: false, lift: 20 });
    const k = 11.75, j = 3.5;
    s.shadows.push(pg([[x + k, y + j], [x + 28 + k, y + j], [x + 28 + k, y + 11 + j], [x + k, y + 11 + j]], '#2b3a1c', 'opacity=".12"'));
    for (let c = 1; c < 7; c++) { const sx = x + k + c * 4; s.shadows.push(pg([[sx - 0.35, y + j], [sx + 0.35, y + j], [sx + 0.35, y + 11 + j], [sx - 0.35, y + 11 + j]], '#fff3d2', 'opacity=".32"')); }
    s.shadows.push(pg([[x + k, y + j + 5.2], [x + 28 + k, y + j + 5.2], [x + 28 + k, y + j + 5.8], [x + k, y + j + 5.8]], '#fff3d2', 'opacity=".28"'));
  }
  // people and a tractor at work under the panels
  s.person({ x: 42, y: 30, c: '#f2b84b' });
  hat(s, 42, 30);
  s.box({ x: 44.6, y: 29, w: 2.6, d: 2, h: 1.5, c: '#c98f4e', decals: [['L', 0, 1, 0.45, 0.55, '#a8743d']] });
  s.sphere({ x: 45.9, y: 30, z: 1.8, r: 0.9, c: '#8fca55', shadow: false });
  tractor(s, 56, 62.8, '#e8743b');
  s.person({ x: 30, y: 80, c: A });
  hat(s, 30, 80);
  [[3, 16, 0.72], [3, 44, 0.8], [3, 72, 0.7], [28, 3, 0.75], [58, 3, 0.8], [88, 3, 0.7]].forEach(([x, y, k], i) => s.palm({ x, y, s: k, lean: i % 2 ? 1 : -1 }));
  return s.render();
}
