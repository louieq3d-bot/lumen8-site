/* Ported from the LUMEN8 platform (js/ui/home/iso.js). Site copy: purple and pink accents
   recoloured to the site palette; geometry unchanged. */
/* LUMEN8 Home - a small isometric renderer for the product dioramas.
 *
 * Every product is drawn as an architectural model: a white plinth, a band of
 * coloured ground on top of it, and the thing we build standing on that. All
 * scenes share one light (upper left), one shading rule (top brightest, left
 * face mid, right face darkest, a highlight on the near corner and a line of
 * contact shadow where a solid meets the ground), soft cast shadows clipped to
 * the slab, and one camera - so the fifteen read as one family at any size.
 *
 * World units: the slab is 100 x 100 with its top at z = 0. The projection is
 * 2:1 isometric; every scene shares the view box below so scale is constant.
 *
 * Motion is opt-in and pure CSS: pieces carry an `hx-*` class (pulse, flow,
 * bob, blink, rise, shimmer, draw) that js/ui/home/home-css.js animates only
 * inside an `.hx-anim` container - the big hero, a hovered card - so thirty
 * small copies on one page stay still and cheap.
 */
const CX = Math.cos(Math.PI / 6);
export const P = (x, y, z = 0) => [(x - y) * CX, (x + y) * 0.5 - z];
export const VIEWBOX = '-96 -60 192 192';

const n2 = (v) => Math.round(v * 100) / 100;
const pts = (a) => a.map(([x, y]) => `${n2(x)},${n2(y)}`).join(' ');
export const pp = pts;

function rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const lit = (c, t = 0.3) => mix(c, '#ffffff', t);
export const shade = (c, t = 0.18) => mix(c, '#1b2436', t);
const INK = '#1b2436';
const PLINTH = '#f3f5f8';

/* A tiny deterministic PRNG so ground texture is identical in every copy. */
export function rng(seed = 7) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export class Iso {
  constructor(uid) {
    this.uid = uid;
    this.defs = [];
    this.base = [];
    this.ground = [];
    this.shadows = [];
    this.items = [];
    this.cache = new Map();
    this.g = 0;
  }

  /* ---- paint ------------------------------------------------------------ */
  lin(stops, x2 = 0, y2 = 1) {
    const key = `l${x2}${y2}${JSON.stringify(stops)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const id = `${this.uid}g${this.g++}`;
    this.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) =>
      `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`);
    const url = `url(#${id})`;
    this.cache.set(key, url);
    return url;
  }
  rad(stops, cx = 0.36, cy = 0.3, r = 0.78) {
    const key = `r${cx}${cy}${r}${JSON.stringify(stops)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const id = `${this.uid}g${this.g++}`;
    this.defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) =>
      `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`);
    const url = `url(#${id})`;
    this.cache.set(key, url);
    return url;
  }
  faceL(c) { return this.lin([[0, lit(c, 0.12)], [1, mix(c, INK, 0.02)]]); }
  faceR(c) { return this.lin([[0, shade(c, 0.15)], [1, shade(c, 0.28)]]); }
  glass() { return this.lin([[0, '#eaf6ff'], [0.45, '#9cc8ec'], [1, '#4d7fb5']], 1, 1); }
  poly(p, fill, extra = '') { return `<polygon points="${pts(p)}" fill="${fill}" ${extra}/>`; }
  put(depth, svg) { this.items.push([depth, svg]); }

  /* ---- ground ----------------------------------------------------------- */
  /* The model base: `top` is the ground colour, `side` the band of earth or
   * water under it (defaults to a darker top), on a white plinth. `layers`
   * replaces band + plinth with explicit strata (geothermal's cut-away). */
  slab({ top, side, h = 10, band = 3, layers = null, w = 100, d = 100, texture = 0.6 }) {
    const T = [P(0, 0), P(w, 0), P(w, d), P(0, d)];
    const bands = layers || [[band, side || shade(top, 0.2)], [h - band, PLINTH]];
    let z = 0;
    for (const [bh, c] of bands) {
      const L = [P(0, d, z), P(w, d, z), P(w, d, z - bh), P(0, d, z - bh)];
      const R = [P(w, 0, z), P(w, d, z), P(w, d, z - bh), P(w, 0, z - bh)];
      this.base.push(this.poly(L, this.faceL(c), `stroke="${c}" stroke-width=".2"`));
      this.base.push(this.poly(R, this.faceR(c), `stroke="${shade(c, 0.2)}" stroke-width=".2"`));
      z -= bh;
    }
    // plinth: crisp bottom edge and a hairline where band meets plinth
    this.base.push(`<polyline points="${pts([P(0, d, z), P(w, d, z), P(w, 0, z)])}" fill="none" stroke="${INK}" stroke-opacity=".1" stroke-width=".5"/>`);
    if (!layers) this.base.push(`<polyline points="${pts([P(0, d, -band), P(w, d, -band), P(w, 0, -band)])}" fill="none" stroke="#ffffff" stroke-opacity=".8" stroke-width=".45"/>`);
    this.base.push(this.poly(T, this.lin([[0, lit(top, 0.22)], [0.55, top], [1, shade(top, 0.05)]], 1, 1)));
    this.base.push(`<polyline points="${pts([P(0, d), P(w, d), P(w, 0)])}" fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width=".7"/>`);
    this.clip = T;
    this.top = top;
    if (texture > 0) this.speckle(top, texture, w, d);
  }

  /* Fine texture on the ground: a few hundred tiny light and dark flecks. */
  speckle(c, amount = 0.6, w = 100, d = 100, seed = 11) {
    const r = rng(seed), n = Math.round(260 * amount);
    const dark = shade(c, 0.14), light = lit(c, 0.3);
    let s = '';
    for (let i = 0; i < n; i++) {
      const [px, py] = P(r() * w, r() * d);
      const k = 0.35 + r() * 0.55;
      s += `<ellipse cx="${n2(px)}" cy="${n2(py)}" rx="${n2(k)}" ry="${n2(k * 0.5)}" fill="${r() > 0.45 ? dark : light}" opacity="${n2(0.25 + r() * 0.35)}"/>`;
    }
    this.ground.push(s);
  }

  /* Paint a flat patch on the ground (a path, a field, a pad) - under shadows. */
  patch(q, fill, extra = '') { this.ground.push(this.poly(q.map((p) => P(...p)), fill, extra)); }

  /* A contact shadow on the ground under something h tall (light from upper left). */
  shade2d(x, y, w, d, h, z = 0, op = 0.16) {
    const k = Math.max(1.5, h * 0.55), j = k * 0.3;
    this.shadows.push(this.poly([P(x, y, z), P(x + w, y, z), P(x + w + k, y + j, z), P(x + w + k, y + d + j, z),
      P(x + k, y + d + j, z), P(x, y + d, z)], INK, `opacity="${op}"`));
  }

  /* ---- solids ------------------------------------------------------------ */
  box({ x, y, z = 0, w, d, h, c, top, depth, shadow = true, edge = true, decals = [], cls = '', ao = true }) {
    const T = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
    const L = [P(x, y + d, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x, y + d, z)];
    const R = [P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d, z), P(x + w, y, z)];
    const tc = top || lit(c, 0.34);
    let s = '';
    if (h > 0.05) {
      s += this.poly(L, this.faceL(c), `stroke="${c}" stroke-width=".25" stroke-linejoin="round"`);
      s += this.poly(R, this.faceR(c), `stroke="${shade(c, 0.2)}" stroke-width=".25" stroke-linejoin="round"`);
    }
    s += this.poly(T, tc, edge ? `stroke="${lit(tc, 0.55)}" stroke-width=".35" stroke-linejoin="round"` : `stroke="${tc}" stroke-width=".2"`);
    for (const [face, u0, u1, v0, v1, fill, op = 1] of decals) {
      const q = face === 'L'
        ? [P(x + u0 * w, y + d, z + v1 * h), P(x + u1 * w, y + d, z + v1 * h), P(x + u1 * w, y + d, z + v0 * h), P(x + u0 * w, y + d, z + v0 * h)]
        : face === 'T'
          ? [P(x + u0 * w, y + v0 * d, z + h), P(x + u1 * w, y + v0 * d, z + h), P(x + u1 * w, y + v1 * d, z + h), P(x + u0 * w, y + v1 * d, z + h)]
          : [P(x + w, y + u0 * d, z + v1 * h), P(x + w, y + u1 * d, z + v1 * h), P(x + w, y + u1 * d, z + v0 * h), P(x + w, y + u0 * d, z + v0 * h)];
      const f = fill === 'glass' ? this.glass() : face === 'R' ? shade(fill, 0.12) : fill;
      s += this.poly(q, f, `opacity="${op}"`);
    }
    if (h > 1.2 && edge) {
      const a = P(x + w, y + d, z + h), b = P(x + w, y + d, z);
      s += `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="#ffffff" stroke-opacity=".55" stroke-width=".35"/>`;
    }
    if (ao && h > 0.6 && z < 0.6) {
      s += `<polyline points="${pts([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y, z)])}" fill="none" stroke="${INK}" stroke-opacity=".22" stroke-width=".45" stroke-linejoin="round"/>`;
    }
    if (shadow && h > 0.6 && z < 4) this.shade2d(x, y, w, d, h, 0);
    this.put(depth ?? (x + w / 2 + y + d / 2 + z * 0.02), cls ? `<g class="${cls}">${s}</g>` : s);
  }

  cyl({ x, y, z = 0, r, h, c, top, depth, waist = 0, shadow = true, cls = '' }) {
    const [cx, yt] = P(x, y, z + h);
    const [, yb] = P(x, y, z);
    const rx = r * 1.2247, ry = r * 0.7071, ym = (yt + yb) / 2, wx = rx * waist;
    const side = `M${n2(cx - rx)},${n2(yt)} Q${n2(cx - rx + wx * 2)},${n2(ym)} ${n2(cx - rx)},${n2(yb)} ` +
      `A${n2(rx)},${n2(ry)} 0 0 0 ${n2(cx + rx)},${n2(yb)} Q${n2(cx + rx - wx * 2)},${n2(ym)} ${n2(cx + rx)},${n2(yt)} Z`;
    const g = this.lin([[0, shade(c, 0.08)], [0.28, lit(c, 0.26)], [0.6, c], [1, shade(c, 0.32)]], 1, 0);
    const tc = top || lit(c, 0.3);
    let s = `<path d="${side}" fill="${g}"/>`;
    s += `<ellipse cx="${n2(cx)}" cy="${n2(yt)}" rx="${n2(rx)}" ry="${n2(ry)}" fill="${tc}" stroke="${lit(tc, 0.5)}" stroke-width=".35"/>`;
    if (shadow && z < 4) {
      const k = h * 0.3;
      const [sx, sy] = P(x + k, y + k * 0.3, 0);
      this.shadows.push(`<ellipse cx="${n2(sx)}" cy="${n2(sy)}" rx="${n2(rx + k * 0.6)}" ry="${n2(ry + k * 0.2)}" fill="${INK}" opacity=".15"/>`);
    }
    this.put(depth ?? (x + y + z * 0.02), cls ? `<g class="${cls}">${s}</g>` : s);
  }

  sphere({ x, y, z, r, c, depth, shadowZ = 0, shadow = true, op = 1, cls = '' }) {
    const [cx, cy] = P(x, y, z);
    const g = this.rad([[0, lit(c, 0.62)], [0.45, c], [1, shade(c, 0.36)]]);
    if (shadow) {
      const [sx, sy] = P(x + r * 0.5, y + r * 0.2, shadowZ);
      this.shadows.push(`<ellipse cx="${n2(sx)}" cy="${n2(sy)}" rx="${n2(r * 1.25)}" ry="${n2(r * 0.62)}" fill="${INK}" opacity=".16"/>`);
    }
    this.put(depth ?? (x + y + z * 0.02), `<circle ${cls ? `class="${cls}" ` : ''}cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r * 1.12)}" fill="${g}" opacity="${op}"/>`);
  }

  /* A soft light: a radial glow standing at (x, y, z). */
  glow({ x, y, z = 0, r = 10, c = '#ffd27a', op = 0.8, depth = 950, cls = '' }) {
    const [cx, cy] = P(x, y, z);
    const g = this.rad([[0, c, op], [0.45, c, op * 0.35], [1, c, 0]], 0.5, 0.5, 0.5);
    this.put(depth, `<ellipse ${cls ? `class="${cls}" ` : ''}cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(r)}" ry="${n2(r * 0.72)}" fill="${g}"/>`);
  }

  /* A PV panel: front edge low at y + d, back edge raised by `rise`. */
  panel({ x, y, z = 2, w, d, rise = 5, cols = 8, rows = 2, legs = true, depth, lift = 0 }) {
    const A = P(x, y + d, z), B = P(x + w, y + d, z), C = P(x + w, y, z + rise), D = P(x, y, z + rise);
    let s = '';
    if (legs) {
      for (const lx of [x + 2, x + w / 2, x + w - 2]) {
        for (const [ly, lz] of [[y + 1, z + rise * 0.9], [y + d - 1, z + rise * 0.1]]) {
          const a = P(lx, ly, lz), b = P(lx, ly, 0);
          s += `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="#8d97a4" stroke-width=".75"/>`;
        }
      }
    }
    // frame thickness: a thin light edge along the front
    s += this.poly([A, B, P(x + w, y + d, z - 0.7), P(x, y + d, z - 0.7)], '#c9d2dd');
    const fill = this.lin([[0, '#7fb0ee'], [0.28, '#3565b8'], [0.7, '#1a3a78'], [1, '#10244d']]);
    s += this.poly([A, B, C, D], fill, 'stroke="#eef3f9" stroke-width=".6" stroke-linejoin="round"');
    for (let i = 1; i < cols; i++) {
      const t = i / cols, a = P(x + w * t, y + d, z), b = P(x + w * t, y, z + rise);
      s += `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="#ffffff" stroke-opacity=".3" stroke-width=".22"/>`;
    }
    for (let j = 1; j < rows; j++) {
      const t = j / rows, a = P(x, y + d - d * t, z + rise * t), b = P(x + w, y + d - d * t, z + rise * t);
      s += `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="#ffffff" stroke-opacity=".3" stroke-width=".22"/>`;
    }
    // sky reflection: a soft diagonal sheen across the glass
    s += this.poly([D, P(x + w * 0.42, y, z + rise), P(x + w * 0.2, y + d, z), A], '#ffffff', 'opacity=".12"');
    s += this.poly([P(x + w * 0.5, y, z + rise), P(x + w * 0.56, y, z + rise), P(x + w * 0.34, y + d, z), P(x + w * 0.28, y + d, z)], '#ffffff', 'opacity=".14"');
    const k = (z + rise) * 0.5 + 1.5;
    this.shadows.push(this.poly([P(x + k, y + k * 0.3), P(x + w + k, y + k * 0.3), P(x + w + k, y + d + k * 0.3), P(x + k, y + d + k * 0.3)], INK, 'opacity=".15"'));
    this.put(depth ?? (x + w / 2 + y + d / 2 + lift), s);
  }

  house({ x, y, w, d, h, wall = '#f7f4ef', roof = '#cc6b4c', hr, depth }) {
    const z = 0, o = 1.3, rh = hr ?? d * 0.42;
    this.box({ x, y, w, d, h, c: wall, depth: -999, shadow: true,
      decals: [['L', 0.14, 0.3, 0, 0.64, '#8a5a3c'], ['L', 0.46, 0.8, 0.34, 0.74, 'glass'], ['R', 0.22, 0.78, 0.34, 0.74, 'glass'],
        ['L', 0.46, 0.8, 0.3, 0.34, '#ffffff', 0.9], ['R', 0.22, 0.78, 0.3, 0.34, '#ffffff', 0.9]] });
    const walls = this.items.pop()[1];
    const back = [P(x - o, y - o, z + h), P(x + w + o, y - o, z + h), P(x + w + o, y + d / 2, z + h + rh), P(x - o, y + d / 2, z + h + rh)];
    const gab = [P(x + w, y, z + h), P(x + w, y + d, z + h), P(x + w, y + d / 2, z + h + rh)];
    const front = [P(x - o, y + d + o, z + h), P(x + w + o, y + d + o, z + h), P(x + w + o, y + d / 2, z + h + rh), P(x - o, y + d / 2, z + h + rh)];
    let ridges = '';
    for (let i = 1; i < 6; i++) {
      const t = i / 6, a = P(x - o + (w + 2 * o) * t, y + d + o, z + h), b = P(x - o + (w + 2 * o) * t, y + d / 2, z + h + rh);
      ridges += `<line x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="${shade(roof, 0.12)}" stroke-opacity=".35" stroke-width=".3"/>`;
    }
    const ridge = [P(x - o, y + d / 2, z + h + rh), P(x + w + o, y + d / 2, z + h + rh)];
    const s = walls + this.poly(back, shade(roof, 0.14)) + this.poly(gab, this.faceR(wall))
      + this.poly(front, this.lin([[0, lit(roof, 0.16)], [1, roof]]), `stroke="${lit(roof, 0.3)}" stroke-width=".3"`)
      + ridges + `<polyline points="${pts(ridge)}" fill="none" stroke="${lit(roof, 0.45)}" stroke-width=".7" stroke-linecap="round"/>`;
    this.shade2d(x, y, w, d, h + rh * 0.6, 0, 0.1);
    this.put(depth ?? (x + w / 2 + y + d / 2), s);
  }

  /* A round broadleaf tree: two or three overlapping crowns. */
  tree({ x, y, z = 0, s = 1, c = '#4f9f57', depth }) {
    const d = depth ?? x + y;
    this.cyl({ x, y, z, r: 0.85 * s, h: 4.4 * s, c: '#8a6a4c', shadow: false, depth: d });
    this.sphere({ x: x + 1.6 * s, y: y + 1.2 * s, z: z + 7.6 * s, r: 3.6 * s, c: shade(c, 0.08), depth: d + 0.005, shadow: false });
    this.sphere({ x, y, z: z + 9 * s, r: 4.7 * s, c, depth: d + 0.01, shadow: z < 1 });
    this.sphere({ x: x - 1.2 * s, y: y + 0.8 * s, z: z + 11.6 * s, r: 2.9 * s, c: lit(c, 0.12), depth: d + 0.02, shadow: false });
  }

  /* A conifer: three stacked cones. */
  pine({ x, y, z = 0, s = 1, c = '#3f8a5a', depth }) {
    const d = depth ?? x + y;
    this.cyl({ x, y, z, r: 0.7 * s, h: 3 * s, c: '#7d5f45', shadow: false, depth: d });
    let g = '';
    for (const [z0, r, hh] of [[2.6, 5, 7], [6.4, 4, 6.4], [10, 2.9, 6]]) {
      const [bx, by] = P(x, y, z + z0 * s), [tx, ty] = P(x, y, z + (z0 + hh) * s);
      const rx = r * s * 1.2247, ry = r * s * 0.7071;
      const fill = this.lin([[0, shade(c, 0.1)], [0.35, lit(c, 0.18)], [0.7, c], [1, shade(c, 0.3)]], 1, 0);
      g += `<path d="M${n2(bx - rx)},${n2(by)} A${n2(rx)},${n2(ry)} 0 0 0 ${n2(bx + rx)},${n2(by)} L${n2(tx)},${n2(ty)} Z" fill="${fill}"/>`;
    }
    const [sx, sy] = P(x + 4 * s, y + 1.2 * s);
    this.shadows.push(`<ellipse cx="${n2(sx)}" cy="${n2(sy)}" rx="${n2(6 * s)}" ry="${n2(3 * s)}" fill="${INK}" opacity=".15"/>`);
    this.put(d + 0.01, g);
  }

  /* A coconut palm: a leaning trunk and a crown of fronds. */
  palm({ x, y, z = 0, s = 1, lean = 1, depth }) {
    const d = depth ?? x + y;
    const [bx, by] = P(x, y, z), [tx, ty] = P(x + 2.5 * s * lean, y - 1 * s, z + 17 * s);
    const cx = (bx + tx) / 2 - 2.5 * s * lean, cy = (by + ty) / 2;
    let g = `<path d="M${n2(bx - 0.7 * s)},${n2(by)} Q${n2(cx - 0.7 * s)},${n2(cy)} ${n2(tx - 0.4 * s)},${n2(ty)} L${n2(tx + 0.4 * s)},${n2(ty)} Q${n2(cx + 0.7 * s)},${n2(cy)} ${n2(bx + 0.7 * s)},${n2(by)} Z" fill="${this.lin([[0, '#b08a63'], [1, '#7d5c3f']], 1, 0)}"/>`;
    const leaf = this.lin([[0, '#6cc070'], [1, '#2f7d45']], 0, 1);
    for (const a of [-160, -120, -75, -30, 15, 60, 110, 150]) {
      const r = (a + 90) * Math.PI / 180, L = 9 * s;
      const ex = tx + Math.cos(r) * L, ey = ty + Math.sin(r) * L * 0.55 + 3.2 * s;
      const mx = tx + Math.cos(r) * L * 0.5, my = ty + Math.sin(r) * L * 0.28 - 1.6 * s;
      const nx = -Math.sin(r) * 1.4 * s, ny = Math.cos(r) * 0.8 * s;
      g += `<path d="M${n2(tx)},${n2(ty)} Q${n2(mx + nx)},${n2(my + ny)} ${n2(ex)},${n2(ey)} Q${n2(mx - nx)},${n2(my - ny)} ${n2(tx)},${n2(ty)} Z" fill="${leaf}"/>`;
    }
    g += `<circle cx="${n2(tx)}" cy="${n2(ty + 0.6 * s)}" r="${n2(1.1 * s)}" fill="#7a5a3a"/>`;
    const [sx, sy] = P(x + 7 * s, y + 2 * s);
    this.shadows.push(`<ellipse cx="${n2(sx)}" cy="${n2(sy)}" rx="${n2(7 * s)}" ry="${n2(3 * s)}" fill="${INK}" opacity=".12"/>`);
    this.put(d + 0.01, g);
  }

  /* A low shrub. */
  bush({ x, y, z = 0, s = 1, c = '#5aa860', depth }) {
    const d = depth ?? x + y;
    this.sphere({ x: x + 1.2 * s, y, z: z + 1.4 * s, r: 1.8 * s, c: shade(c, 0.06), depth: d, shadow: false });
    this.sphere({ x, y: y + 1 * s, z: z + 1.8 * s, r: 2.2 * s, c, depth: d + 0.01, shadow: z < 1 });
  }

  /* A person at human scale (about 5 units tall). */
  person({ x, y, z = 0, c = '#2f7fd0', skin = '#efc7a8', depth }) {
    const d = depth ?? x + y;
    this.cyl({ x, y, z, r: 0.75, h: 1.9, c: '#3b4250', shadow: false, depth: d });
    this.cyl({ x, y, z: z + 1.9, r: 0.95, h: 2, c, shadow: false, depth: d + 0.001 });
    this.sphere({ x, y, z: z + 4.7, r: 0.78, c: skin, depth: d + 0.002, shadow: false });
    const [sx, sy] = P(x + 1.4, y + 0.4, z);
    this.shadows.push(`<ellipse cx="${n2(sx)}" cy="${n2(sy)}" rx="1.6" ry=".8" fill="${INK}" opacity=".18"/>`);
  }

  /* A small vehicle, long axis along x (dir 'x') or y. */
  car({ x, y, z = 0, c = '#e8743b', dir = 'x', l = 7, depth, cls = '' }) {
    const w = dir === 'x' ? l : 3.4, d = dir === 'x' ? 3.4 : l;
    const d0 = depth ?? x + w / 2 + y + d / 2;
    this.box({ x, y, z: z + 0.7, w, d, h: 1.8, c, depth: d0, cls });
    const cw = dir === 'x' ? l * 0.5 : 2.8, cd = dir === 'x' ? 2.8 : l * 0.5;
    this.box({ x: x + (w - cw) * (dir === 'x' ? 0.35 : 0.5), y: y + (d - cd) * (dir === 'x' ? 0.5 : 0.35), z: z + 2.5, w: cw, d: cd, h: 1.4, c: lit(c, 0.2),
      decals: [['L', 0.08, 0.92, 0.1, 0.9, 'glass'], ['R', 0.08, 0.92, 0.1, 0.9, 'glass']], shadow: false, depth: d0 + 0.01, cls });
    for (const [wx, wy] of dir === 'x' ? [[x + 1.6, y + d], [x + w - 1.6, y + d]] : [[x + 3.4, y + 1.6], [x + 3.4, y + d - 1.6]]) {
      const [px, py] = P(wx, wy, z + 0.7);
      this.put(d0 + 0.02, `<ellipse cx="${n2(px)}" cy="${n2(py)}" rx=".9" ry="1.05" fill="#20252e"/>`);
    }
  }

  /* A flat body of water: gradient, a sheen and a few ripple lines. */
  water({ x, y, w, d, z = 0.25, c = '#5fb4e0', depth = -1, ripples = 4, seed = 3 }) {
    const q = [P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)];
    let s = this.poly(q, this.lin([[0, lit(c, 0.35)], [0.5, c], [1, shade(c, 0.12)]], 1, 1));
    s += this.poly([P(x + w * 0.1, y, z), P(x + w * 0.35, y, z), P(x + w * 0.1, y + d * 0.55, z), P(x, y + d * 0.55, z), P(x, y + d * 0.3, z)], '#ffffff', 'opacity=".14"');
    const r = rng(seed);
    for (let i = 0; i < ripples; i++) {
      const rx = x + w * (0.12 + r() * 0.7), ry = y + d * (0.15 + r() * 0.75), l = Math.min(w, d) * (0.08 + r() * 0.1);
      const a = P(rx, ry, z), b = P(rx + l, ry, z);
      s += `<line class="hx-shimmer" style="animation-delay:${n2(r() * 2)}s" x1="${n2(a[0])}" y1="${n2(a[1])}" x2="${n2(b[0])}" y2="${n2(b[1])}" stroke="#ffffff" stroke-width=".55" stroke-linecap="round" stroke-opacity=".85"/>`;
    }
    this.put(depth, s);
  }

  /* Horizontal ring: back half behind `depth`, front half in front. */
  ring({ x, y, z, r, c, w = 0.8, op = 0.7, depth, dash = '', cls = '' }) {
    const [cx, cy] = P(x, y, z), rx = r * 1.2247, ry = r * 0.7071;
    const at = `fill="none" stroke="${c}" stroke-width="${w}" stroke-opacity="${op}" ${dash ? `stroke-dasharray="${dash}"` : ''} ${cls ? `class="${cls}"` : ''}`;
    this.put(depth - 0.5, `<path d="M${n2(cx - rx)},${n2(cy)} A${n2(rx)},${n2(ry)} 0 0 1 ${n2(cx + rx)},${n2(cy)}" ${at}/>`);
    this.put(depth + 0.5, `<path d="M${n2(cx - rx)},${n2(cy)} A${n2(rx)},${n2(ry)} 0 0 0 ${n2(cx + rx)},${n2(cy)}" ${at}/>`);
  }

  line(a, b, { c = '#8e97a3', w = 0.6, op = 1, dash = '', depth = 500, sag = 0, cls = '' } = {}) {
    const A = P(...a), B = P(...b);
    const d = sag
      ? `M${n2(A[0])},${n2(A[1])} Q${n2((A[0] + B[0]) / 2)},${n2((A[1] + B[1]) / 2 + sag)} ${n2(B[0])},${n2(B[1])}`
      : `M${n2(A[0])},${n2(A[1])} L${n2(B[0])},${n2(B[1])}`;
    this.put(depth, `<path ${cls ? `class="${cls}" ` : ''}d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`);
  }

  /* A utility pole with a cross-arm; returns the wire attachment point. */
  pole({ x, y, h = 20, c = '#7d8692', depth }) {
    this.box({ x, y, w: 1.1, d: 1.1, h, c, shadow: false, depth: depth ?? x + y });
    this.box({ x: x - 2, y: y + 0.2, z: h - 1.6, w: 5.1, d: 0.7, h: 0.7, c: shade(c, 0.1), shadow: false, ao: false, depth: (depth ?? x + y) + 0.01 });
    this.shade2d(x, y, 1.1, 1.1, h * 0.5, 0, 0.1);
    return [x + 0.55, y + 0.55, h - 0.9];
  }

  raw(depth, svg) { this.put(depth, svg); }

  render(cls = 'iso') {
    const clip = `${this.uid}c`;
    this.items.sort((a, b) => a[0] - b[0]);
    return `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" aria-hidden="true" focusable="false"><defs>${this.defs.join('')}` +
      `<clipPath id="${clip}"><polygon points="${pts(this.clip || [])}"/></clipPath></defs>` +
      `${this.base.join('')}<g clip-path="url(#${clip})">${this.ground.join('')}${this.shadows.join('')}</g>${this.items.map((i) => i[1]).join('')}</svg>`;
  }
}
