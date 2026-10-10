/* world-farm.js — the HelioAtlas hero scene: a fruit valley in the Western Cape (pass 8, lead).
   Terrain, land use and building sites are baked from real elevation into
   assets/world/valley/ (dem.json, dem-wide.json, albedo-*.webp, valley.json), so the browser paints nothing:
   it decodes three images off the main thread and builds a handful of meshes.

   Frame: metres, +x east, -z north, +y up; origin = centre of the FOCUS packhouse, y = 0 its floor.
   Draw calls ~14, programs 5 (terrain, buildings, instanced props/trees, panels, overlays), ~190k triangles.
   Layers (0..1): solar, territory, territoryDraw, rank, focus, panels, night (ignored).
   Dimming for territory/focus and the solar desaturation are done in the shaders (no overlay planes). */

const BASE = new URL('./world/valley/', import.meta.url);
const AMBER = [0xE39A4A, 0xEE9A26, 0xF5A524, 0xFFC447];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const tick = () => new Promise(r => setTimeout(r, 0));
const b64ToBuf = (j) => { const s = atob(j.b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
/* v11: 513-grid far DEM packed in a lossless RGB PNG (v = R * 256 + G, h = v / 10 - 1000); null if it can't be decoded exactly */
async function loadDemPng(url){
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, out = new Uint16Array(n);
    for (let i = 0; i < n; i++){ if (px[i * 4 + 2] !== 0) return null; out[i] = px[i * 4] * 256 + px[i * 4 + 1]; }
    return { arr: out, N: c.width };
  } catch (e){ return null; }
}

async function loadBitmapTexture(THREE, url, aniso){
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' });
  const t = new THREE.Texture(bmp);
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso || 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}

/* ── shared shader patch: territory mask, focus spotlight, solar desaturation ───────────────────────── */
function makeUniforms(THREE){
  return {
    uTerr: { value: 0 }, uFocus: { value: 0 }, uSolar: { value: 0 },
    uTerrMask: { value: null }, uTerrBox: { value: new THREE.Vector4(0, 0, 1, 1) },
    uFocusC: { value: new THREE.Vector2() }, uFocusAx: { value: new THREE.Vector2(1, 0) }, uFocusHalf: { value: new THREE.Vector2(100, 50) },
  };
}
function patchMaterial(mat, U, desat, detail, foliage){
  if (desat) mat.defines = Object.assign({}, mat.defines, { HA_DESAT: '' });
  if (foliage) mat.defines = Object.assign({}, mat.defines, { HA_FOLIAGE: '' });
  if (detail) mat.defines = Object.assign({}, mat.defines, { HA_DETAIL: '' });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHaWP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 haWP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          haWP = instanceMatrix * haWP;
        #endif
        vHaWP = (modelMatrix * haWP).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vHaWP;
        uniform float uTerr, uFocus, uSolar; uniform sampler2D uTerrMask; uniform vec4 uTerrBox;
        uniform vec2 uFocusC, uFocusAx, uFocusHalf;
        float haH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float haVN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(haH(i), haH(i + vec2(1, 0)), f.x), mix(haH(i + vec2(0, 1)), haH(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef HA_DETAIL
        {   /* v11: two octaves of ground grain that fade in near the camera, so magnified texels never read as mush */
          float dist = length(vHaWP - cameraPosition);
          vec2 p = vHaWP.xz;
          float k = 1.0 - smoothstep(180.0, 1400.0, dist);
          if (k > 0.0){
            float g = haVN(p * 0.55) * 0.6 + haVN(p * 2.1) * 0.4;
            diffuseColor.rgb *= mix(1.0, 0.86 + 0.28 * g, k);
          }
          float km = 1.0 - smoothstep(1500.0, 7000.0, dist);   /* scrub and rock texture on the mountains at mid range */
          if (km > 0.0){
            float g2 = haVN(p * 0.045) * 0.55 + haVN(p * 0.13) * 0.45;
            diffuseColor.rgb *= mix(1.0, 0.92 + 0.16 * g2, km);
          }
        }
        #endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        #ifdef HA_FOLIAGE
        {   /* v12: leaf clumps in world space, faded out with distance so far crowns never shimmer */
          float kf = 1.0 - smoothstep(160.0, 900.0, length(vHaWP - cameraPosition));
          if (kf > 0.0){
            vec3 q = vHaWP;
            float f = haVN(q.xz * 1.1 + vec2(q.y * 0.83, -q.y * 0.57)) * 0.6 + haVN(q.xz * 2.7 - vec2(q.y * 1.9, q.y * 1.3)) * 0.4;
            float leaf = step(0.004, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));   /* only green surfaces: crowns yes, vehicles no */
            diffuseColor.rgb *= mix(1.0, 0.66 + 0.62 * f, kf * leaf);
          }
        }
        #endif`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        {
          vec2 tuv = (vHaWP.xz - uTerrBox.xy) / uTerrBox.zw; tuv.y = 1.0 - tuv.y;
          float inside = (tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) ? texture2D(uTerrMask, tuv).r : 0.0;
          vec2 d = vHaWP.xz - uFocusC;
          vec2 q = abs(vec2(dot(d, uFocusAx), dot(d, vec2(-uFocusAx.y, uFocusAx.x)))) - uFocusHalf;
          float fo = smoothstep(0.0, 90.0, length(max(q, 0.0)));
          float dim = max(uTerr * (1.0 - inside) * 0.55, uFocus * fo * 0.80);
          vec3 c = gl_FragColor.rgb;
          #ifdef HA_DESAT
            c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), 0.28 * uSolar);
          #endif
          c = mix(c, mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), 0.6) * vec3(0.34, 0.37, 0.45), dim);
          c += uTerr * inside * (1.0 - uFocus) * vec3(0.030, 0.018, 0.0);
          gl_FragColor.rgb = c;
        }`);
  };
  mat.customProgramCacheKey = () => 'ha-farm' + (desat ? '-d' : '') + (detail ? '-g' : '') + (foliage ? '-f' : '');
  return mat;
}

/* ── geometry helpers ───────────────────────────────────────────────────────────────────────────────── */
function gridGeometry(THREE, N, S, hAt, opts){
  const o = opts || {};
  const pos = new Float32Array(N * N * 3), nor = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
  const step = S / (N - 1), half = S / 2, H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const x = -half + i * step, z = -half + j * step, k = j * N + i;
    H[k] = hAt(x, z, i, j) + (o.lift || 0);
    pos[k * 3] = x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = z;
    uv[k * 2] = i / (N - 1); uv[k * 2 + 1] = 1 - j / (N - 1);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const k = j * N + i;
    const hx = (H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)]) / ((Math.min(N - 1, i + 1) - Math.max(0, i - 1)) * step);
    const hz = (H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i]) / ((Math.min(N - 1, j + 1) - Math.max(0, j - 1)) * step);
    const l = Math.hypot(hx, 1, hz); nor[k * 3] = -hx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -hz / l;
  }
  const idx = [];
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++){
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    if (o.skip && o.skip(-half + i * step, -half + j * step, -half + (i + 1) * step, -half + (j + 1) * step)) continue;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(N * N > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return g;
}

/* merged, flat-shaded building geometry with per-vertex colour; roofs remember their vertex ranges */
class Merger {
  constructor(){ this.p = []; this.n = []; this.c = []; }
  get count(){ return this.p.length / 3; }
  tri(a, b, c, col){
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const v of [a, b, c]){ this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
  }
  quad(a, b, c, d, col){ this.tri(a, b, c, col); this.tri(a, c, d, col); }
  geometry(THREE){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

/* frame: a transform from building-local (x along the length, z across, y up) to world */
function frame(cx, cy, cz, yaw){
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];   // = rotation.y(yaw)
}
function boxW(M, F, x0, x1, y0, y1, z0, z1, col, top){
  const P = (x, y, z) => F(x, y, z);
  M.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col);   // +z
  M.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), col);   // -z
  M.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), col);   // +x
  M.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), col);   // -x
  if (top) M.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), top);
}
function gable(M, F, L, D, eave, rise, wallCol, roofCol, ov){
  const o = ov == null ? 0.6 : ov, hl = L / 2, hd = D / 2, r = eave + rise;
  boxW(M, F, -hl, hl, -0.5, eave, -hd, hd, wallCol, null);
  M.tri(F(hl, eave, hd), F(hl, eave, -hd), F(hl, r, 0), wallCol);            // gable ends
  M.tri(F(-hl, eave, -hd), F(-hl, eave, hd), F(-hl, r, 0), wallCol);
  const s0 = M.count;
  const e = rise * o / hd;
  M.quad(F(-hl - o, eave - e, -hd - o), F(-hl - o, r, 0), F(hl + o, r, 0), F(hl + o, eave - e, -hd - o), roofCol); // north slope
  M.quad(F(hl + o, eave - e, hd + o), F(hl + o, r, 0), F(-hl - o, r, 0), F(-hl - o, eave - e, hd + o), roofCol);   // south slope
  return [s0, M.count - s0];
}
function flatRoof(M, F, L, D, h, wallCol, roofCol, paraCol){
  const hl = L / 2, hd = D / 2;
  boxW(M, F, -hl, hl, -0.5, h, -hd, hd, wallCol, null);
  const s0 = M.count;
  M.quad(F(-hl, h, hd), F(hl, h, hd), F(hl, h, -hd), F(-hl, h, -hd), roofCol);
  const rng = [s0, M.count - s0], t = 0.35, p = 0.9;
  boxW(M, F, -hl, hl, h, h + p, -hd, -hd + t, paraCol, paraCol); boxW(M, F, -hl, hl, h, h + p, hd - t, hd, paraCol, paraCol);
  boxW(M, F, -hl, -hl + t, h, h + p, -hd, hd, paraCol, paraCol); boxW(M, F, hl - t, hl, h, h + p, -hd, hd, paraCol, paraCol);
  return rng;
}
function cylinder(M, F, x, z, r, h, col, capCol, seg){
  const n = seg || 14;
  for (let i = 0; i < n; i++){
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    M.quad(F(p1[0], 0, p1[1]), F(p0[0], 0, p0[1]), F(p0[0], h, p0[1]), F(p1[0], h, p1[1]), col);
    M.tri(F(p1[0], h, p1[1]), F(p0[0], h, p0[1]), F(x, h + r * 0.6, z), capCol);
  }
}
function tunnel(M, F, x, z, L, r, col){
  const n = 8;
  for (let i = 0; i < n; i++){
    const a0 = i / n * Math.PI, a1 = (i + 1) / n * Math.PI;
    M.quad(F(x - L / 2, Math.sin(a0) * r, z + Math.cos(a0) * r), F(x + L / 2, Math.sin(a0) * r, z + Math.cos(a0) * r),
           F(x + L / 2, Math.sin(a1) * r, z + Math.cos(a1) * r), F(x - L / 2, Math.sin(a1) * r, z + Math.cos(a1) * r), col);
  }
}

function panelTexture(THREE){
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#C9CED6'; g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#16263B'; g.fillRect(3, 3, 58, 122);
  g.strokeStyle = 'rgba(120,150,190,.35)'; g.lineWidth = 1;
  for (let i = 1; i < 6; i++){ g.beginPath(); g.moveTo(3 + i * 58 / 6, 3); g.lineTo(3 + i * 58 / 6, 125); g.stroke(); }
  for (let j = 1; j < 12; j++){ g.beginPath(); g.moveTo(3, 3 + j * 122 / 12); g.lineTo(61, 3 + j * 122 / 12); g.stroke(); }
  g.fillStyle = 'rgba(160,190,230,.10)'; g.fillRect(3, 3, 58, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function polyContains(poly, x, z){
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}

/* ── v12: the FOCUS packhouse as a real building ───────────────────────────────────────────────────────
   Painted façades (ribbed cladding, precast plinth, translucent light band, roller doors in dock shelters,
   an office end with two storeys of glazing), ribbed roof sheeting, an asphalt forecourt with marked bays,
   and instanced cars, bakkies and rigs. Every texture is painted on a canvas at load; nothing is fetched.
   Packhouse frame: x along the hall (-70..70, cold store 70..110), z across (-32 north .. 32 south). */
const PXM = 16, EAVE = 9, RISE = 32 * Math.tan(6 * Math.PI / 180), RIDGE = EAVE + RISE, ROOF_TILE = 6.096;
class TexMerger {
  constructor(){ this.p = []; this.n = []; this.u = []; }
  tri(a, b, c, ua, ub, uc){
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const [v, t] of [[a, ua], [b, ub], [c, uc]]){ this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz); this.u.push(t[0], t[1]); }
  }
  quad(a, b, c, d, ua, ub, uc, ud){ this.tri(a, b, c, ua, ub, uc); this.tri(a, c, d, ua, uc, ud); }
  geometry(THREE){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return g;
  }
}
function canvasTex(THREE, cv, aniso, repeat){
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = aniso;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* façade atlas: one shelf-packed canvas, one region per wall. A region runs from 0.5 m below the floor to its top;
   m is metres from the wall's left end as seen from outside, h is metres above the floor. */
function facadeAtlas(rnd){
  const W = 2560, H = 768, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), R = {};
  let sx = 0, sy = 0, rowH = 0;
  const region = (name, L, top) => {
    const w = Math.ceil(L * PXM), h = Math.ceil((top + 0.5) * PXM);
    if (sx + w > W){ sx = 0; sy += rowH + 4; rowH = 0; }
    sx += w + 4; rowH = Math.max(rowH, h);
    return (R[name] = { x: sx - w - 4, y: sy, L, top, W, H });
  };
  let r;
  const X = (m) => r.x + m * PXM, Y = (h) => r.y + (r.top - h) * PXM;
  const box = (m0, h0, m1, h1, fill) => { g.fillStyle = fill; g.fillRect(X(m0), Y(h1), (m1 - m0) * PXM, (h1 - h0) * PXM); };
  const vl = (m0, m1, h0, h1, step, fill, w, off) => { g.fillStyle = fill; for (let m = m0 + (off || 0); m < m1; m += step) g.fillRect(Math.round(X(m)), Y(h1), w, (h1 - h0) * PXM); };
  const hl = (m0, m1, h0, h1, step, fill, w) => { g.fillStyle = fill; for (let h = h0 + step; h < h1 - 1e-3; h += step) g.fillRect(X(m0), Math.round(Y(h)), (m1 - m0) * PXM, w); };
  const grad = (h0, h1, stops) => { const gr = g.createLinearGradient(0, Y(h1), 0, Y(h0)); stops.forEach(([t, c]) => gr.addColorStop(t, c)); return gr; };
  const ribbed = (m0, m1, h0, h1, base) => { box(m0, h0, m1, h1, base); vl(m0, m1, h0, h1, 0.762, 'rgba(255,255,255,.18)', 2); vl(m0, m1, h0, h1, 0.762, 'rgba(0,0,0,.17)', 1, 0.16); vl(m0, m1, h0, h1, 0.762, 'rgba(0,0,0,.05)', 1, 0.45); };
  const panels = (m0, m1, h0, h1) => { box(m0, h0, m1, h1, '#E4E5E1'); vl(m0, m1, h0, h1, 1.15, 'rgba(0,0,0,.10)', 1); box(m0, -0.5, m1, 0.35, '#8E8B84'); };
  const composite = (m0, m1, h0, h1) => { box(m0, h0, m1, h1, grad(h0, h1, [[0, '#454A50'], [1, '#30343A']])); vl(m0, m1, h0, h1, 1.5, 'rgba(0,0,0,.5)', 1); hl(m0, m1, h0, h1, 3, 'rgba(0,0,0,.5)', 1); };
  const plinth = (m0, m1, h1) => { box(m0, -0.5, m1, h1, '#A9A59C'); vl(m0, m1, -0.5, h1, 6, 'rgba(0,0,0,.2)', 1); box(m0, h1 - 0.06, m1, h1, 'rgba(0,0,0,.28)'); };
  const band = (m0, m1, h0, h1) => { box(m0, h0, m1, h1, '#E7EAE4'); vl(m0, m1, h0, h1, 0.762, 'rgba(0,0,0,.07)', 1); box(m0, h0, m1, h0 + 0.07, 'rgba(0,0,0,.22)'); box(m0, h1 - 0.07, m1, h1, 'rgba(0,0,0,.18)'); };
  const grime = (m0, m1, top) => {
    box(m0, -0.5, m1, 2.8, grad(-0.5, 2.8, [[0, 'rgba(74,64,50,.28)'], [1, 'rgba(74,64,50,0)']]));
    for (let k = 0; k < (m1 - m0) * 1.4; k++){ g.fillStyle = `rgba(62,56,48,${(0.025 + rnd() * 0.05).toFixed(3)})`; g.fillRect(X(m0 + rnd() * (m1 - m0)), Y(top), 1 + (rnd() < 0.3), (0.4 + rnd() * 3.2) * PXM); }
  };
  const roller = (mc, w, h0, h1, open, col) => {
    box(mc - w / 2 - 0.45, Math.max(-0.5, h0 - 0.1), mc + w / 2 + 0.45, h1 + 0.45, '#1C1D1F');          // dock shelter / frame
    if (h0 > 0.2){ box(mc - w / 2 - 0.45, -0.5, mc + w / 2 + 0.45, h0 - 0.1, '#8C887F'); box(mc - w / 2 - 0.05, h0 - 0.6, mc - w / 2 + 0.3, h0 - 0.12, '#141414'); box(mc + w / 2 - 0.3, h0 - 0.6, mc + w / 2 + 0.05, h0 - 0.12, '#141414'); }
    if (open){ box(mc - w / 2, h0, mc + w / 2, h1, grad(h0, h1, [[0, '#0D0E10'], [0.75, '#1C1F22'], [1, '#2B2E31']])); box(mc - w / 2, h1 - 0.42, mc + w / 2, h1, '#9EA3A7'); hl(mc - w / 2, mc + w / 2, h1 - 0.42, h1, 0.14, 'rgba(0,0,0,.18)', 1); return; }
    box(mc - w / 2, h0, mc + w / 2, h1, grad(h0, h1, [[0, col || '#A3A8AC'], [1, col || '#BEC2C5']])); hl(mc - w / 2, mc + w / 2, h0, h1, 0.2, 'rgba(0,0,0,.11)', 1);
    box(mc - w / 2, h0, mc + w / 2, h0 + 0.12, '#55595D');
  };
  const pdoor = (mc, w, h, leaf) => { box(mc - w / 2 - 0.1, 0, mc + w / 2 + 0.1, h + 0.1, '#25282C'); box(mc - w / 2, 0, mc + w / 2, h, leaf || '#626870'); box(mc - 0.17, 1.3, mc + 0.17, 1.85, '#2C3742'); };
  const glazing = (m0, m1, h0, h1, mull, lit) => {
    box(m0 - 0.12, h0 - 0.12, m1 + 0.12, h1 + 0.12, '#202327');
    box(m0, h0, m1, h1, grad(h0, h1, [[0, '#9DB0BF'], [0.42, '#627689'], [1, '#26313C']]));
    for (let k = 0; k < (m1 - m0) / mull; k++) if (lit && rnd() < 0.3) box(m0 + k * mull, h0, m0 + (k + 1) * mull, h0 + (h1 - h0) * 0.55, 'rgba(255,214,160,.13)');
    g.save(); g.beginPath(); g.rect(X(m0), Y(h1), (m1 - m0) * PXM, (h1 - h0) * PXM); g.clip();               // two soft sky reflections
    for (let k = 0; k < 2; k++){ const a = X(m0 + (0.2 + 0.45 * k) * (m1 - m0)); g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(a, Y(h1)); g.lineTo(a + 70, Y(h1)); g.lineTo(a + 20, Y(h0)); g.lineTo(a - 50, Y(h0)); g.fill(); }
    g.restore();
    vl(m0, m1, h0, h1, mull, '#202327', 2, mull); box(m0, h0 + (h1 - h0) * 0.8, m1, h0 + (h1 - h0) * 0.8 + 0.07, '#202327');
  };
  const louvre = (m0, m1, h0, h1) => { box(m0 - 0.08, h0 - 0.08, m1 + 0.08, h1 + 0.08, '#2A2D31'); box(m0, h0, m1, h1, '#646A70'); hl(m0, m1, h0, h1, 0.14, 'rgba(0,0,0,.4)', 1); };
  const slider = (mc, w, h) => { box(mc - w, h + 0.12, mc + w, h + 0.3, '#6B7075'); box(mc - w / 2 - 0.08, 0, mc + w / 2 + 0.08, h + 0.08, '#8F9497'); box(mc - w / 2, 0, mc + w / 2, h, '#D6D9DA'); box(mc + w / 2 - 0.35, 0.9, mc + w / 2 - 0.25, 1.5, '#3A3E42'); };

  /* hall, north (m = 70 - x): an office end in dark composite with two storeys of glazing, five docks, a drive-in door */
  r = region('n', 140, EAVE);
  ribbed(0, 108, -0.5, EAVE, '#CBCDCA'); composite(108, 140, -0.5, EAVE);
  plinth(0, 108, 1.2); band(0, 108, 6.8, 7.7);
  glazing(111, 137, 0.15, 3.1, 1.5, true); glazing(111, 137, 4.3, 6.4, 1.5, true);
  box(124.8, 0, 127.2, 2.75, '#181B1F'); box(124.95, 0, 125.95, 2.62, '#3A4957'); box(126.05, 0, 127.05, 2.62, '#3A4957');
  for (const x of [-30, -18, -6, 6, 18]) roller(70 - x, 3.0, 1.2, 4.4, x === -6);
  pdoor(70 - 28, 1.0, 2.2); roller(70 - 42, 5.0, 0, 5.4, false);
  louvre(70 - 56, 70 - 52, 7.95, 8.6); louvre(70 - 64, 70 - 60, 7.95, 8.6);
  grime(0, 140, EAVE);
  /* hall, south (m = x + 70): eight drive-in doors under the dock canopy */
  r = region('s', 140, EAVE);
  ribbed(0, 140, -0.5, EAVE, '#CBCDCA'); plinth(0, 140, 1.2); band(0, 140, 6.8, 7.7);
  for (let k = 0; k < 8; k++) roller(18 + 15 * k, 4.2, 0, 4.8, k === 2 || k === 5);
  grime(0, 140, EAVE);
  /* hall, west gable (m = z + 32) and east gable (m = 32 - z, mostly behind the cold store) */
  r = region('w', 64, RIDGE);
  ribbed(0, 64, -0.5, RIDGE, '#CBCDCA'); plinth(0, 64, 1.2); band(0, 64, 6.8, 7.7);
  roller(32, 6, 0, 6.0, false); pdoor(21, 1.0, 2.2); louvre(30, 34, 9.7, 11.0);
  grime(0, 64, EAVE);
  r = region('e', 64, RIDGE);
  ribbed(0, 64, -0.5, RIDGE, '#CBCDCA'); plinth(0, 64, 1.2);
  /* cold store: insulated panels, sliding cold-room doors, two insulated dock doors on the east end */
  r = region('cn', 40, 12); panels(0, 40, -0.5, 12); slider(26, 2.6, 3.2); pdoor(10, 1.0, 2.2, '#C9CCCD'); grime(0, 40, 12);
  r = region('cs', 40, 12); panels(0, 40, -0.5, 12); slider(14, 2.6, 3.2); pdoor(31, 1.0, 2.2, '#C9CCCD'); grime(0, 40, 12);
  r = region('ce', 64, 12); panels(0, 64, -0.5, 12);
  roller(22, 2.8, 1.2, 4.2, false, '#D3D6D7'); roller(44, 2.8, 1.2, 4.2, false, '#D3D6D7'); louvre(8, 16, 9.3, 10.4); louvre(48, 56, 9.3, 10.4);
  grime(0, 64, 12);
  return { canvas: cv, R };
}

function roofCanvas(){
  const S = 512, P = S / 8, cv = document.createElement('canvas'); cv.width = cv.height = S;   // 8 rib pitches of 0.762 m = 6.096 m
  const g = cv.getContext('2d'), rnd = mulberry32(5);
  g.fillStyle = '#C3C8CB'; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 8; k++){ g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${(rnd() * 0.06).toFixed(3)})` : `rgba(0,0,0,${(rnd() * 0.05).toFixed(3)})`; g.fillRect(k * P, 0, P, S); }
  for (let i = 0; i < 90; i++){ g.fillStyle = `rgba(96,86,74,${(rnd() * 0.03).toFixed(3)})`; g.fillRect(0, rnd() * S, S, 1 + rnd() * 5); }
  for (let k = 0; k < 8; k++){
    const x = k * P;
    g.fillStyle = 'rgba(255,255,255,.34)'; g.fillRect(x, 0, 5, S);           // the rib's lit flank
    g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(x + 5, 0, 3, S);             // and its shaded flank
    g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(x + P / 3, 0, 1, S); g.fillRect(x + 2 * P / 3, 0, 1, S);   // pan stiffeners
  }
  return cv;
}

/* the forecourt north of the hall: asphalt, a walkway along the office, 24 marked bays, dock lane lines, a crossing */
const PAD = { x0: -74, x1: 66, z0: -56, z1: -32.1 };
function padCanvas(rnd){
  const W = 2048, H = Math.round(W * (PAD.z1 - PAD.z0) / (PAD.x1 - PAD.x0)), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), S = W / (PAD.x1 - PAD.x0), X = (x) => (x - PAD.x0) * S, Y = (z) => (z - PAD.z0) * S;
  const rect = (x0, z0, x1, z1, f) => { g.fillStyle = f; g.fillRect(X(x0), Y(z0), (x1 - x0) * S, (z1 - z0) * S); };
  rect(PAD.x0, PAD.z0, PAD.x1, PAD.z1, '#62655F');
  for (let i = 0; i < 26; i++){ g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,250' : '0,0,0'},${(0.02 + rnd() * 0.03).toFixed(3)})`; g.fillRect(X(PAD.x0 + rnd() * 140), 0, (6 + rnd() * 22) * S, H); }   // resurfacing patches
  for (let i = 0; i < 9000; i++){ g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(rnd() * W, rnd() * H, 1 + (rnd() < 0.2), 1); }
  for (let i = 0; i < 40; i++){ const x = -36 + rnd() * 62, z = -50 + rnd() * 16; g.fillStyle = `rgba(20,20,20,${(0.05 + rnd() * 0.08).toFixed(3)})`; g.beginPath(); g.ellipse(X(x), Y(z), (0.6 + rnd() * 2.4) * S, (0.4 + rnd() * 1.4) * S, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  for (const x of [-30, -6]) for (const d of [-0.9, 0.9]) rect(x + d - 0.25, -50, x + d + 0.25, -32.1, 'rgba(0,0,0,.10)');   // tyre wear in the dock lanes
  rect(PAD.x0, -34, -36, PAD.z1, '#B7B3AA'); rect(PAD.x0, -34.12, -36, -34, '#8F8B83');                                   // walkway and kerb
  const line = (x0, z0, x1, z1, f) => rect(Math.min(x0, x1) - (x0 === x1 ? 0.06 : 0), Math.min(z0, z1) - (z0 === z1 ? 0.06 : 0), Math.max(x0, x1) + (x0 === x1 ? 0.06 : 0), Math.max(z0, z1) + (z0 === z1 ? 0.06 : 0), f);
  for (let k = 0; k <= 12; k++){ const x = -72 + 2.5 * k; line(x, -39, x, -34, '#E6E4DD'); line(x, -50.5, x, -45.5, '#E6E4DD'); }
  line(-72, -39, -42, -39, '#E6E4DD'); line(-72, -45.5, -42, -45.5, '#E6E4DD');
  for (let k = 0; k < 7; k++) rect(-40.6, -45.2 + k * 0.9, -37.4, -44.8 + k * 0.9, 'rgba(236,234,226,.9)');                 // pedestrian crossing to the door
  for (const x of [-30, -18, -6, 6, 18]) for (const d of [-1.75, 1.75]) line(x + d, -48, x + d, -32.6, '#D2AE3C');
  line(38.5, -46, 45.5, -46, '#E6E4DD');
  rect(PAD.x0, PAD.z0, PAD.x1, PAD.z0 + 0.3, '#A8A398'); rect(PAD.x0, PAD.z0, PAD.x0 + 0.3, PAD.z1, '#A8A398'); rect(PAD.x1 - 0.3, PAD.z0, PAD.x1, PAD.z1, '#A8A398');   // kerbs
  return cv;
}
function padGeometry(THREE, Ff, heightAt, nx, nz, lift){
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++){
    const p = Ff(PAD.x0 + (PAD.x1 - PAD.x0) * i / nx, 0, PAD.z0 + (PAD.z1 - PAD.z0) * j / nz);
    pos.push(p[0], heightAt(p[0], p[2]) + lift, p[2]); uv.push(i / nx, j / nz);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++){ const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* vehicles in vehicle-local metres (front +z). Body faces are white so the instance colour paints them; glass and tyres stay dark. */
function vehicleGeometries(THREE){
  const I = (x, y, z) => [x, y, z], B = new THREE.Color(1, 1, 1), GL = new THREE.Color(0.018, 0.024, 0.032), TY = new THREE.Color(0.01, 0.01, 0.012), LT = new THREE.Color(0.5, 0.5, 0.5);
  const wheels = (m, xs, zs, r, w) => { for (const sx of [-1, 1]) for (const z of zs) boxW(m, I, sx * xs - w / 2, sx * xs + w / 2, 0, r * 2, z - r, z + r, TY, TY); };
  const make = (fn) => { const m = new Merger(); fn(m); return m.geometry(THREE); };
  return {
    car: make(m => { boxW(m, I, -0.88, 0.88, 0.3, 0.9, -2.2, 2.2, B, B); boxW(m, I, -0.76, 0.76, 0.9, 1.4, -1.15, 0.85, GL, B); wheels(m, 0.84, [-1.38, 1.38], 0.31, 0.24); }),
    suv: make(m => { boxW(m, I, -0.92, 0.92, 0.36, 1.02, -2.3, 2.3, B, B); boxW(m, I, -0.84, 0.84, 1.02, 1.66, -1.9, 0.9, GL, B); wheels(m, 0.86, [-1.45, 1.45], 0.36, 0.26); }),
    bakkie: make(m => {
      boxW(m, I, -0.9, 0.9, 0.36, 0.98, -2.65, 2.65, B, B);
      boxW(m, I, -0.86, 0.86, 0.98, 1.22, 0.0, 1.95, B, null); boxW(m, I, -0.84, 0.84, 1.22, 1.76, 0.05, 1.85, GL, B);
      boxW(m, I, -0.9, -0.8, 0.98, 1.16, -2.65, 0.0, B, B); boxW(m, I, 0.8, 0.9, 0.98, 1.16, -2.65, 0.0, B, B); boxW(m, I, -0.9, 0.9, 0.98, 1.16, -2.65, -2.55, B, B);
      wheels(m, 0.86, [-1.65, 1.6], 0.36, 0.26);
    }),
    truck: make(m => {
      boxW(m, I, -1.28, 1.28, 1.25, 4.0, -7.0, 6.6, B, B);                       // reefer trailer
      boxW(m, I, -1.0, 1.0, 2.5, 3.85, 6.6, 7.0, LT, LT);                        // fridge unit
      boxW(m, I, -1.0, 1.0, 0.55, 1.25, -7.0, 9.1, TY, TY);                      // chassis
      boxW(m, I, -1.22, 1.22, 1.0, 3.55, 7.25, 9.3, B, B);                       // cab
      boxW(m, I, -1.12, 1.12, 2.3, 3.2, 9.3, 9.36, GL, GL); boxW(m, I, -1.25, 1.25, 2.35, 3.15, 8.3, 9.2, GL, null);
      wheels(m, 0.95, [-5.4, -4.1, -2.8], 0.5, 0.6); wheels(m, 0.95, [5.0, 8.4], 0.5, 0.55);
    }),
  };
}

/* builds the hero packhouse: textured walls and roof as their own meshes, small parts into the merged building
   geometry M, the forecourt and the vehicles. Returns the meshes to add and the roof material (its colour carries
   the amber score tint). */
function buildHero(THREE, M, Ff, U, aniso, rnd, heightAt, yaw, vcMat, COL){
  const A = facadeAtlas(rnd), R = A.R;
  const T = new TexMerger();
  const uv = (r, m, h) => [(r.x + m * PXM) / r.W, (r.y + (r.top - h) * PXM) / r.H];
  const wall = (r, xa, za, xb, zb, y1) => {
    const L = Math.hypot(xb - xa, zb - za);
    T.quad(Ff(xa, -0.5, za), Ff(xb, -0.5, zb), Ff(xb, y1, zb), Ff(xa, y1, za), uv(r, 0, -0.5), uv(r, L, -0.5), uv(r, L, y1), uv(r, 0, y1));
  };
  const gableTop = (r, xa, za, xb, zb) => T.tri(Ff(xa, EAVE, za), Ff(xb, EAVE, zb), Ff((xa + xb) / 2, RIDGE, (za + zb) / 2), uv(r, 0, EAVE), uv(r, r.L, EAVE), uv(r, r.L / 2, RIDGE));
  wall(R.n, 70, -32, -70, -32, EAVE); wall(R.s, -70, 32, 70, 32, EAVE);
  wall(R.w, -70, -32, -70, 32, EAVE); gableTop(R.w, -70, -32, -70, 32);
  wall(R.e, 70, 32, 70, -32, EAVE); gableTop(R.e, 70, 32, 70, -32);
  wall(R.cn, 110, -32, 70, -32, 12); wall(R.cs, 70, 32, 110, 32, 12); wall(R.ce, 110, 32, 110, -32, 12);
  const wallMat = patchMaterial(new THREE.MeshLambertMaterial({ map: canvasTex(THREE, A.canvas, aniso) }), U, false);
  const walls = new THREE.Mesh(T.geometry(THREE), wallMat);

  const Rf = new TexMerger(), o = 0.4, e = RISE * o / 32, sl = Math.hypot(32 + o, RISE + e) / ROOF_TILE, u0 = (-70 - o) / ROOF_TILE, u1 = (70 + o) / ROOF_TILE;
  Rf.quad(Ff(-70 - o, EAVE - e, -32 - o), Ff(-70 - o, RIDGE, 0), Ff(70 + o, RIDGE, 0), Ff(70 + o, EAVE - e, -32 - o), [u0, 0], [u0, sl], [u1, sl], [u1, 0]);
  Rf.quad(Ff(70 + o, EAVE - e, 32 + o), Ff(70 + o, RIDGE, 0), Ff(-70 - o, RIDGE, 0), Ff(-70 - o, EAVE - e, 32 + o), [u1, 0], [u1, sl], [u0, sl], [u0, 0]);
  Rf.quad(Ff(70, 12, 32), Ff(110, 12, 32), Ff(110, 12, -32), Ff(70, 12, -32), [70 / ROOF_TILE, 32 / ROOF_TILE], [110 / ROOF_TILE, 32 / ROOF_TILE], [110 / ROOF_TILE, -32 / ROOF_TILE], [70 / ROOF_TILE, -32 / ROOF_TILE]);
  const roofMat = patchMaterial(new THREE.MeshLambertMaterial({ map: canvasTex(THREE, roofCanvas(), aniso, true) }), U, false);
  const roof = new THREE.Mesh(Rf.geometry(THREE), roofMat);

  const padMat = patchMaterial(new THREE.MeshLambertMaterial({ map: canvasTex(THREE, padCanvas(rnd), aniso) }), U, false);
  padMat.polygonOffset = true; padMat.polygonOffsetFactor = -2; padMat.polygonOffsetUnits = -8;
  const pad = new THREE.Mesh(padGeometry(THREE, Ff, heightAt, 28, 6, 0.32), padMat);

  /* small parts, flat-shaded in the merged building geometry */
  const C = (h) => new THREE.Color(h), CH = COL.char, PANEL = C(0xE0E1DD), SKY = C(0xE3E8E7);
  boxW(M, Ff, -70.7, 70.7, EAVE - 0.44, EAVE - 0.06, -32.86, -32.4, CH, CH); boxW(M, Ff, -70.7, 70.7, EAVE - 0.44, EAVE - 0.06, 32.4, 32.86, CH, CH);   // gutters
  boxW(M, Ff, -70.5, 70.5, RIDGE - 0.1, RIDGE + 0.14, -0.45, 0.45, COL.zinc, COL.zinc);                                                                  // ridge capping
  for (const x of [-37, -24, -12, 0, 12, 23.5, 34.5, 50, 63]) boxW(M, Ff, x - 0.1, x + 0.1, 0, EAVE - 0.4, -32.3, -32.06, CH, null);                      // downpipes
  for (let k = 0; k < 9; k++){ const x = -59.5 + 15 * k; boxW(M, Ff, x - 0.1, x + 0.1, 0, EAVE - 0.4, 32.06, 32.3, CH, null); }
  boxW(M, Ff, -60.5, -51.5, 3.05, 3.3, -35.2, -32, CH, CH); boxW(M, Ff, 26.8, 29.2, 2.6, 2.75, -33.4, -32, CH, CH);                                    // entrance canopies
  boxW(M, Ff, -60, 60, 5.6, 6.0, 32, 37, COL.canopy, COL.canopy);                                                                                         // south dock canopy
  const ys = (z) => EAVE + (32 - z) * RISE / 32 + 0.05;
  for (let k = 0; k < 11; k++){ const x0 = -60.5 + 12 * k, x1 = x0 + 0.95; M.quad(Ff(x0, ys(20), 20), Ff(x1, ys(20), 20), Ff(x1, ys(3), 3), Ff(x0, ys(3), 3), SKY); }   // skylight sheets, south slope
  const t = 0.35; [[70, 110, -32, -32 + t], [70, 110, 32 - t, 32], [110 - t, 110, -32, 32], [70, 70 + t, -32, 32]].forEach(([a, b, c, d]) => boxW(M, Ff, a, b, 12, 12.9, c, d, PANEL, COL.para));   // cold-store parapet
  M.tri(Ff(70, EAVE, -32), Ff(70, 12, -3.46), Ff(70, 12, -32), PANEL); M.tri(Ff(70, 12, 3.46), Ff(70, EAVE, 32), Ff(70, 12, 32), PANEL);                 // cold-store wall above the hall roof
  for (const z of [-22, -9, 4]){ boxW(M, Ff, 80, 86.5, 12, 13.5, z, z + 2.3, COL.silo, CH); boxW(M, Ff, 86.5, 92, 12.2, 12.5, z + 0.9, z + 1.3, CH, CH); }   // condensers and pipe runs

  /* vehicles */
  const V = vehicleGeometries(THREE), lists = { car: [], suv: [], bakkie: [], truck: [] };
  const put = (kind, lx, lz, rot, hex) => { const p = Ff(lx, 0, lz); lists[kind].push([p[0], heightAt(p[0], p[2]) + 0.3, p[2], yaw + rot, hex]); };
  const PAINT = [0xF1F1EF, 0xF1F1EF, 0xF1F1EF, 0xBFC3C7, 0xBFC3C7, 0x7E848A, 0x1F2226, 0x1F2226, 0x2D3E57, 0x8A2B27, 0xBDB4A0];
  for (const [zc, row] of [[-36.6, 0], [-48.1, 1]]) for (let k = 0; k < 12; k++){
    if (rnd() > (row ? 0.55 : 0.8)) continue;
    const q = rnd(), kind = q < 0.32 ? 'bakkie' : q < 0.55 ? 'suv' : 'car';
    put(kind, -70.75 + 2.5 * k + (rnd() - 0.5) * 0.25, zc + (rnd() - 0.5) * 0.3, (row && rnd() < 0.35 ? Math.PI : 0) + (rnd() - 0.5) * 0.05, PAINT[(rnd() * PAINT.length) | 0]);
  }
  put('bakkie', 40, -44, Math.PI / 2 + 0.06, 0xF1F1EF); put('car', -97, -30, Math.PI / 2, 0xBFC3C7);
  put('truck', -30, -40, Math.PI, 0xF3F3F1); put('truck', -6, -40, Math.PI, 0xECEDED);
  put('truck', -22, 40, 0, 0xF3F3F1); put('truck', 23, 40, 0, 0xECEDED); put('truck', -52, 40, 0, 0xF3F3F1);
  const meshes = [walls, roof, pad];
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    for (const k in lists){ const L = lists[k]; if (!L.length) continue;
      const im = new THREE.InstancedMesh(V[k], vcMat, L.length);
      L.forEach((a, i) => { m.compose(v.set(a[0], a[1], a[2]), q.setFromEuler(e3.set(0, a[3], 0)), s); im.setMatrixAt(i, m); im.setColorAt(i, c.setHex(a[4])); });
      meshes.push(im); } }
  meshes.forEach(x => { x.castShadow = x !== pad; x.receiveShadow = true; });
  return { meshes, roofMat, amber: new THREE.Color(0xFFB238).multiplyScalar(1 / 0.56) };
}

/* ── the builder ────────────────────────────────────────────────────────────────────────────────────── */
async function buildFarm(THREE, opts){
  const o = opts || {}, rng = mulberry32(((o.seed == null ? 7 : o.seed) >>> 0) * 31 + 3);
  const aniso = o.maxAnisotropy || 8;
  const [meta, demBuf, wideBuf, texFar, texNear, texWide, demHi] = await Promise.all([
    fetch(new URL('valley.json', BASE)).then(r => r.json()),
    fetch(new URL('dem.json', BASE)).then(r => r.json()).then(b64ToBuf),
    fetch(new URL('dem-wide.json', BASE)).then(r => r.json()).then(b64ToBuf),
    loadBitmapTexture(THREE, new URL('albedo-far.webp', BASE), aniso),
    loadBitmapTexture(THREE, new URL('albedo-near.webp', BASE), aniso),
    loadBitmapTexture(THREE, new URL('albedo-wide.webp', BASE), 4),
    loadDemPng(new URL('dem-hi.png', BASE)),
  ]);
  const dem = demHi ? demHi.arr : new Uint16Array(demBuf), wide = new Uint16Array(wideBuf);
  const NF = demHi ? demHi.N : meta.far.grid, SF = meta.far.size, NW = meta.wide.grid, SW = meta.wide.size;
  const sample = (arr, N, S, x, z) => {
    const fx = clamp((x + S / 2) / S * (N - 1), 0, N - 1.0001), fz = clamp((z + S / 2) / S * (N - 1), 0, N - 1.0001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, h = k => arr[k] / 10 - 1000;
    return (h(j * N + i) * (1 - tx) + h(j * N + i + 1) * tx) * (1 - tz) + (h((j + 1) * N + i) * (1 - tx) + h((j + 1) * N + i + 1) * tx) * tz;
  };
  const heightAt = (x, z) => (Math.abs(x) < SF / 2 && Math.abs(z) < SF / 2) ? sample(dem, NF, SF, x, z) : sample(wide, NW, SW, x, z);
  await tick();

  const U = makeUniforms(THREE);
  const root = new THREE.Group(); root.name = 'HAWorldFarm';
  const terrMat = (map) => patchMaterial(new THREE.MeshLambertMaterial({ map }), U, true, true);

  /* terrain: wide skirt (40 km) under the far mesh (12 km) under the near patch (2.4 km) */
  const far = new THREE.Mesh(gridGeometry(THREE, NF, SF, (x, z, i, j) => dem[j * NF + i] / 10 - 1000), terrMat(texFar));
  far.receiveShadow = true; root.add(far);
  await tick();
  const inner = SF / 2 - 60;
  const wideMesh = new THREE.Mesh(gridGeometry(THREE, NW, SW, (x, z, i, j) => wide[j * NW + i] / 10 - 1000, { lift: -4,
    skip: (x0, z0, x1, z1) => Math.max(Math.abs(x0), Math.abs(x1)) < inner && Math.max(Math.abs(z0), Math.abs(z1)) < inner }), terrMat(texWide));
  root.add(wideMesh);
  const SN = meta.near.size;
  const nearMat = terrMat(texNear); nearMat.polygonOffset = true; nearMat.polygonOffsetFactor = -1; nearMat.polygonOffsetUnits = -4;
  const near = new THREE.Mesh(gridGeometry(THREE, 121, SN, (x, z) => heightAt(x, z), { lift: 0.25 }), nearMat);
  near.receiveShadow = true; root.add(near);
  await tick();

  /* buildings */
  const C = (h) => new THREE.Color(h);
  const COL = { wall: C(0xD8D6D0), wallDark: C(0xB9B6AE), plaster: C(0xEEEAE1), zinc: C(0xC6CACD), red: C(0x8E4A3A), char: C(0x55595E),
    thatch: C(0x6F6253), slate: C(0x5C5F63), tunnel: C(0xEDEFEF), silo: C(0xCFD2D4), para: C(0xBFBCB5), dock: C(0x3E4247), canopy: C(0xA9ADB1) };
  const M = new Merger(), roofs = [], buildings = [];
  const A = meta.axisRad, yaw = -A;                       // buildings align with the valley's field grid
  const addRoof = (rec, range, base) => roofs.push({ rec, start: range[0], count: range[1], base: base.clone() });

  const ranked = meta.ranked.map((s, i) => ({ id: i + 1, name: s.name, kind: s.kind, x: s.x, z: s.z, w: s.w, d: s.d, h: s.h }));
  for (const r of ranked){
    r.y = heightAt(r.x, r.z);
    const F = frame(r.x, r.y, r.z, yaw);
    let range;
    if (r.kind === 'packhouse'){ r.top = r.y + 12.4; buildings.push(r); continue; }   // v12: built below as the hero building
    if (r.kind === 'coldstore'){
      range = flatRoof(M, F, r.w, r.d, r.h, COL.wall, COL.char, COL.para); r.top = r.y + r.h;
      for (let k = 0; k < 3; k++) cylinder(M, frame(r.x, r.y, r.z, yaw), r.w / 2 + 14, -r.d / 2 + 8 + k * 10, 4, 17, COL.silo, COL.zinc);
    } else {
      const pitch = { cellar: 24, barn: 18, stall: 32, hall: 14, shed: 10 }[r.kind] || 12;
      const rise = r.d / 2 * Math.tan(pitch * Math.PI / 180), eave = Math.max(3.2, r.h - rise);
      const roofC = r.kind === 'barn' || r.id === 3 ? COL.red : r.kind === 'stall' ? COL.thatch : r.kind === 'cellar' ? COL.slate : COL.zinc;
      const wallC = r.kind === 'cellar' || r.kind === 'stall' ? COL.plaster : COL.wall;
      range = gable(M, F, r.w, r.d, eave, rise, wallC, roofC); r.top = r.y + eave + rise;
    }
    addRoof(r, range, M.c.length ? new THREE.Color(M.c[range[0] * 3], M.c[range[0] * 3 + 1], M.c[range[0] * 3 + 2]) : COL.zinc);
    buildings.push(r);
  }
  /* farmsteads: Cape Dutch homestead + wing + sheds + cottages + oaks */
  const steadTrees = [];
  meta.farmsteads.forEach((s, n) => {
    const y = heightAt(s.x, s.z), F = frame(s.x, y, s.z, yaw);
    const hs = { id: 100 + n, kind: 'homestead', x: s.x, y, z: s.z, w: 24, d: 9, h: 7.6 };
    addRoof(hs, gable(M, F, 24, 9, 4.2, 3.4, COL.plaster, n % 3 ? COL.thatch : COL.slate, 0.5), n % 3 ? COL.thatch : COL.slate);
    boxW(M, F, -2.2, 2.2, 0, 8.2, 4.4, 5.4, COL.plaster, COL.plaster);                            // centre gable
    const Fw = frame(...F(-9, 0, 9).map((v, k) => k === 1 ? y : v), yaw + Math.PI / 2);
    addRoof(hs, gable(M, Fw, 12, 7, 3.8, 2.8, COL.plaster, n % 3 ? COL.thatch : COL.slate, 0.4), n % 3 ? COL.thatch : COL.slate);
    buildings.push(hs);
    const sheds = 1 + (n % 3);
    for (let k = 0; k < sheds; k++){
      const L = 26 + rng() * 22, D = 12 + rng() * 8, Fs = frame(...F(30 + k * 6, 0, -22 - k * 20).map((v, kk) => kk === 1 ? y : v), yaw);
      const rc = rng() < 0.4 ? COL.red : rng() < 0.5 ? COL.char : COL.zinc;
      const sh = { id: 200 + n * 4 + k, kind: 'shed', x: Fs(0, 0, 0)[0], y, z: Fs(0, 0, 0)[2], w: L, d: D, h: 7 };
      addRoof(sh, gable(M, Fs, L, D, 5.2, D / 2 * Math.tan(0.18), COL.wall, rc), rc); buildings.push(sh);
    }
    for (let k = 0; k < 4; k++){
      const Fk = frame(...F(-30 - k * 13, 0, 26).map((v, kk) => kk === 1 ? y : v), yaw);
      gable(M, Fk, 10, 6, 2.8, 1.6, COL.plaster, COL.char, 0.3);
    }
    for (let k = 0; k < 14; k++){ const a = rng() * Math.PI * 2, rr = 18 + rng() * 26; steadTrees.push([s.x + Math.cos(a) * rr, s.z + Math.sin(a) * rr, 'oak']); }
    if (n % 3 === 1) for (let k = 0; k < 5; k++){ const Ft = frame(...F(60, 0, 30 + k * 10).map((v, kk) => kk === 1 ? y : v), yaw); tunnel(M, Ft, 0, 0, 56, 3.6, COL.tunnel); }
  });
  await tick();

  /* solar scores → percentile → amber grade per roof */
  ranked.forEach((r, i) => { r.score = +(0.97 - i * 0.045).toFixed(3); });
  buildings.forEach(b => { if (b.score == null) b.score = 0.25 + rng() * 0.5; });
  const sorted = buildings.map(b => b.score).sort((a, b) => a - b);
  buildings.forEach(b => { b.rank = sorted.indexOf(b.score) / Math.max(1, sorted.length - 1); });
  const ramp = (t) => { const f = clamp(t, 0, 1) * 3, i = Math.min(2, f | 0); return new THREE.Color(AMBER[i]).lerp(new THREE.Color(AMBER[i + 1]), f - i); };
  roofs.forEach(rf => { const u = rf.rec.rank, cand = u >= 0.45; rf.amber = ramp((u - 0.45) / 0.55); rf.k = cand ? 0.25 + 0.75 * clamp((u - 0.45) / 0.55, 0, 1) : 0.12; });

  /* v12: the focus packhouse — textured walls and roof, forecourt, vehicles; small parts go into M */
  const focus = ranked[0], Ff = frame(focus.x, focus.y, focus.z, yaw);
  const vcMat = patchMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }), U, true, false, true);   // vehicles and trees: vertex colour x instance colour; leaf texture on green only
  const hero = buildHero(THREE, M, Ff, U, aniso, rng, heightAt, yaw, vcMat, COL);
  hero.meshes.forEach(m => root.add(m));
  await tick();

  const bGeo = M.geometry(THREE);
  const bMat = patchMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }), U, false);
  const bMesh = new THREE.Mesh(bGeo, bMat); bMesh.castShadow = true; bMesh.receiveShadow = true; root.add(bMesh);
  const colAttr = bGeo.getAttribute('color');

  /* instanced props + vines + trees share one program (Lambert + instanceColor) */
  const propMat = patchMaterial(new THREE.MeshLambertMaterial({ color: 0xffffff }), U, true);
  const props = [];  // [cx, cy, cz, sx, sy, sz, yaw, hex]
  const P = (lx, ly, lz, sx, sy, sz, hex, yw) => { const p = Ff(lx, ly, lz); props.push([p[0], p[1], p[2], sx, sy, sz, yaw + (yw || 0), hex]); };
  for (let a = 0; a < 8; a++) for (let b = 0; b < 12; b++){                                                           // fruit bins in two blocks
    const n = 2 + ((a * 7 + b * 3) % 3), wood = (a + (b >> 2)) % 3 !== 0;
    for (let c = 0; c < n; c++) P(-78 - a * 1.3 - (a > 3 ? 3 : 0), 0.38 + c * 0.75, -24 + b * 1.3 + (b > 5 ? 3 : 0), 1.2, 0.72, 1.2, wood ? 0x8A7A62 : 0x4E545A);
  }
  for (let k = 0; k < 6; k++) P(-50 + k * 20, EAVE + 8 * RISE / 32 + 0.85, 24, 3.2, 1.6, 2.4, 0xB9BBBD);              // HVAC on the south slope, clear of the skylights
  /* vineyard rows in 3-D near the focus (texture rows carry them further out), in <= 40 m segments that follow the ground */
  const ca = Math.cos(A), sa = Math.sin(A);
  const fromUW = (u, w) => [u * ca - w * sa, u * sa + w * ca];
  const toUW = (x, z) => [x * ca + z * sa, -x * sa + z * ca];
  const yards = buildings.filter(b => b.kind !== 'shed' || b.id < 100).map(b => { const [u, w] = toUW(b.x, b.z); const big = b.kind === 'homestead'; return [u, w, big ? 75 : b.w / 2 + 22, big ? 62 : b.d / 2 + 26]; });
  const inYard = (x, z) => { const [u, w] = toUW(x, z); return yards.some(y => Math.abs(u - y[0]) < y[2] && Math.abs(w - y[1]) < y[3]); };
  for (const p of meta.parcels){
    if (!/^vine|young|orchard/.test(p.crop)) continue;
    const cu = p.u + p.L / 2, cw = p.w + p.W / 2, [cx, cz] = fromUW(cu, cw);
    if (Math.hypot(cx, cz) > 470) continue;
    if (yards.some(y => Math.abs(cu - y[0]) < p.L / 2 + y[2] && Math.abs(cw - y[1]) < p.W / 2 + y[3])) continue;
    const orch = p.crop === 'orchard', sp = orch ? 5 : 3, hgt = orch ? 3.6 : p.crop === 'young' ? 0.9 : 1.7, wid = orch ? 2.6 : 1.3;
    const hex = orch ? 0x56693F : p.crop === 'young' ? 0x7F8650 : (p.crop === 'vine2' ? 0x6B7A3C : 0x617239);
    const seg = (u0, u1, w0, w1, along) => {
      const len = along ? u1 - u0 : w1 - w0, n = Math.max(1, Math.ceil(len / 40)), l = len / n;
      for (let k = 0; k < n; k++){
        const [x, z] = along ? fromUW(u0 + (k + 0.5) * l, w0) : fromUW(u0, w0 + (k + 0.5) * l);
        props.push([x, heightAt(x, z) + hgt / 2, z, along ? l - 0.6 : wid, hgt, along ? wid : l - 0.6, yaw, hex]);
      }
    };
    if (p.rowsAlongAxis) for (let w = p.w + sp / 2; w < p.w + p.W; w += sp) seg(p.u + 1, p.u + p.L - 1, w, w, true);
    else for (let u = p.u + sp / 2; u < p.u + p.L; u += sp) seg(u, u, p.w + 1, p.w + p.W - 1, false);
  }
  const propMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), propMat, props.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    props.forEach((pp, i) => { m.compose(v.set(pp[0], pp[1], pp[2]), q.setFromEuler(e.set(0, pp[6], 0)), s.set(pp[3], pp[4], pp[5])); propMesh.setMatrixAt(i, m); propMesh.setColorAt(i, c.setHex(pp[7])); }); }
  propMesh.castShadow = true; propMesh.receiveShadow = true; root.add(propMesh);
  await tick();

  /* trees: windbreak poplars along the main road and some parcel edges, riparian along the river, oaks, gum clumps */
  const trees = [];
  const tree = (x, z, kind) => {
    if (kind !== 'oak' && inYard(x, z)) return;
    const g = heightAt(x, z), j = 0.8 + rng() * 0.45;
    if (kind === 'poplar') trees.push([x, g + 9 * j, z, 2.2 * j, 9.5 * j, 2.2 * j, 0x6E7F4A]);
    else if (kind === 'gum') trees.push([x, g + 11 * j, z, 7 * j, 7.5 * j, 7 * j, 0x66705A]);
    else if (kind === 'rip') trees.push([x, g + 5 * j, z, 5 * j, 4.6 * j, 5 * j, rng() < 0.5 ? 0x4F6440 : 0x5E6E45]);
    else trees.push([x, g + 6 * j, z, 7.5 * j, 5.2 * j, 7.5 * j, 0x59683F]);
  };
  const along = (pts, step, kind, off, chance) => {
    for (let i = 1; i < pts.length; i++){
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], L = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / L, nz = (x1 - x0) / L;
      for (let t = 0; t < L; t += step) if (rng() < chance) tree(x0 + (x1 - x0) * t / L + nx * off, z0 + (z1 - z0) * t / L + nz * off, kind);
    }
  };
  along(meta.mainRoad, 7, 'poplar', 12, 0.55);
  along(meta.river, 9, 'rip', 0, 0.95); along(meta.river, 11, 'rip', 9, 0.5); along(meta.river, 11, 'rip', -9, 0.5);
  steadTrees.forEach(t => tree(t[0], t[1], t[2]));
  meta.parcels.forEach(p => { if (rng() < 0.18){ const a = fromUW(p.u, p.w - 3), b = fromUW(p.u + p.L, p.w - 3); along([a, b], 6.5, 'poplar', 0, 0.9); } });
  for (let k = 0; k < 16; k++){ const a = rng() * Math.PI * 2, r = 700 + rng() * 2600, x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(heightAt(x, z)) < 60) for (let n = 0; n < 9; n++) tree(x + (rng() - 0.5) * 40, z + (rng() - 0.5) * 40, 'gum'); }
  /* v12: rounder crowns (subdivided, smooth normals) that darken towards the base, so close trees stop reading as crystals */
  const treeGeo = new THREE.IcosahedronGeometry(1, 1);
  { const p = treeGeo.attributes.position, n = new Float32Array(p.count * 3), c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++){
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
      const h = Math.abs(Math.sin(Math.round(x * 97) * 12.9898 + Math.round(y * 97) * 78.233 + Math.round(z * 97) * 37.719) * 43758.5453) % 1;   // same hash for shared corners: no cracks
      const j = (y > 0.98 || y < -0.98) ? 1 : 0.86 + 0.24 * h, k = (0.5 + 0.62 * (y + 1) / 2) * (0.88 + 0.22 * h);
      const tp = y > 0 ? 1 - 0.3 * y : 1 - 0.12 * -y;                                     // widest a third of the way up, like a poplar
      p.setXYZ(i, x * j * tp, y, z * j * tp);
      n[i * 3] = x / l; n[i * 3 + 1] = y / l; n[i * 3 + 2] = z / l; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
    }
    treeGeo.setAttribute('normal', new THREE.BufferAttribute(n, 3)); treeGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const treeMesh = new THREE.InstancedMesh(treeGeo, vcMat, trees.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    trees.forEach((t, i) => { m.compose(v.set(t[0], t[1], t[2]), q, s.set(t[3], t[4], t[5])); treeMesh.setMatrixAt(i, m); treeMesh.setColorAt(i, c.setHex(t[6]).offsetHSL(0, 0, (rng() - 0.5) * 0.05)); }); }
  treeMesh.castShadow = true; treeMesh.receiveShadow = true; root.add(treeMesh);
  await tick();

  /* PV: two faces, filled best face first (the studio's auto-fill order).
       slope  the hall's NNW roof slope, flush at 6 deg: 12 rows x 114 portrait modules inside 1.5 m setbacks
       racks  the cold store's flat roof, racks at 10 deg facing the same way: 11 rows x 30, 5.2 m row pitch
     o.pv = { wp, mw, ml, first: 'racks' | 'slope' } comes from the engine run of this example (index.html). */
  const PV = Object.assign({ wp: 560, mw: 1.134, ml: 2.278, first: 'racks' }, o.pv || {});
  const PIT = 6 * Math.PI / 180, SLOPE = 32 / Math.cos(PIT);   // RISE is the module constant
  const MW = PV.mw, ML = PV.ml, G = 0.02, SB = 1.5, TILT = 10 * Math.PI / 180;
  const nx = 114, ny = 12, rx = 30, ry = 11;
  const panelMat = new THREE.MeshPhongMaterial({ map: panelTexture(THREE), specular: 0x8a9bb0, shininess: 70 });
  const modGeo = new THREE.BoxGeometry(MW, 0.04, ML);
  const slopeMesh = new THREE.InstancedMesh(modGeo, panelMat, nx * ny), rackMesh = new THREE.InstancedMesh(modGeo, panelMat, rx * ry);
  const RM = new Merger();   // rack rails (the building geometry is already built by now)
  { const m = new THREE.Matrix4(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PIT, yaw, 0, 'YXZ')), q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-TILT, yaw, 0, 'YXZ'));
    const x0 = -((nx * (MW + G) - G) / 2) + MW / 2;
    let k = 0;
    for (let j = 0; j < ny; j++){                                           // j = 0 at the eave
      const sd = SB + ML / 2 + j * (ML + G), lz = -32 + sd * Math.cos(PIT), ly = EAVE + sd * Math.sin(PIT) + 0.2;
      for (let i = 0; i < nx; i++){ const p = Ff(x0 + i * (MW + G), ly, lz); m.compose(v.set(p[0], p[1], p[2]), q1, s); slopeMesh.setMatrixAt(k++, m); }
    }
    const rx0 = 90 - ((rx * (MW + G) - G) / 2) + MW / 2, ryc = 12 + 0.35 + ML / 2 * Math.sin(TILT);
    k = 0;
    for (let j = 0; j < ry; j++){                                           // j = 0 at the north row
      const lz = -26 + j * 5.2;
      for (let i = 0; i < rx; i++){ const p = Ff(rx0 + i * (MW + G), ryc, lz); m.compose(v.set(p[0], p[1], p[2]), q2, s); rackMesh.setMatrixAt(k++, m); }
      boxW(RM, Ff, rx0 - MW / 2, rx0 + (rx - 1) * (MW + G) + MW / 2, 12, 12.3, lz - 0.9, lz - 0.75, COL.char, COL.char);   // rack rails
      boxW(RM, Ff, rx0 - MW / 2, rx0 + (rx - 1) * (MW + G) + MW / 2, 12, 12.3 + ML * Math.sin(TILT), lz + 0.75, lz + 0.9, COL.char, COL.char);
    }
  }
  const rails = new THREE.Mesh(RM.geometry(THREE), bMat); rails.castShadow = rails.receiveShadow = true; rails.visible = false;
  slopeMesh.count = rackMesh.count = 0; root.add(slopeMesh, rackMesh); root.add(rails);
  const faces = PV.first === 'slope' ? [slopeMesh, rackMesh] : [rackMesh, slopeMesh], NMOD = nx * ny + rx * ry;
  focus.modules = NMOD; focus.kwp = Math.round(NMOD * PV.wp / 1000);
  focus.faces = { slope: { modules: nx * ny, tilt: 6 }, racks: { modules: rx * ry, tilt: 10 } };

  /* overlays (one MeshBasic instanced program): rank beams + rings, territory ribbon, setback outline */
  const ovMat = (op) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false, fog: false });
  const beamMat = ovMat(0); beamMat.blending = THREE.AdditiveBlending;
  const ringMat = ovMat(0), ribbonMat = ovMat(0), setbackMat = ovMat(0);
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true); beamGeo.translate(0, 0.5, 0);
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, ranked.length);
  const ringGeo = new THREE.RingGeometry(0.86, 1, 64); ringGeo.rotateX(-Math.PI / 2);
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, ranked.length);
  { const m = new THREE.Matrix4(), c = new THREE.Color(0xF5A524);
    ranked.forEach((r, i) => {
      const sc = Math.max(r.w, r.d) * 0.62 + 10;
      m.makeScale(i === 0 ? 4 : 2.4, 260 - i * 14, i === 0 ? 4 : 2.4).setPosition(r.x, r.top + 1, r.z); beams.setMatrixAt(i, m); beams.setColorAt(i, c);
      m.makeScale(sc, 1, sc).setPosition(r.x, r.top + 1.2, r.z); rings.setMatrixAt(i, m); rings.setColorAt(i, c);
    }); }
  beams.visible = rings.visible = false; root.add(beams, rings);

  const terrPoly = meta.territory.polygon;
  const rib = [];
  for (let i = 0; i <= terrPoly.length; i++){
    const [xa, za] = terrPoly[i % terrPoly.length], [xb, zb] = terrPoly[(i + 1) % terrPoly.length];
    const L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.ceil(L / 25));
    if (i === terrPoly.length) break;
    for (let k = 0; k < n; k++) rib.push([xa + (xb - xa) * k / n, za + (zb - za) * k / n]);
  }
  rib.push(rib[0]);
  const rp = [], ri = [];
  rib.forEach(([x, z], k) => {
    const [xp, zp] = rib[Math.max(0, k - 1)], [xn, zn] = rib[Math.min(rib.length - 1, k + 1)];
    let tx = xn - xp, tz = zn - zp; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const y = heightAt(x, z) + 3;
    rp.push(x - tz * 7, y, z + tx * 7, x + tz * 7, y, z - tx * 7);
    if (k) ri.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, (k - 1) * 2 + 1, k * 2, k * 2 + 1);
  });
  const ribGeo = new THREE.BufferGeometry(); ribGeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); ribGeo.setIndex(ri);
  const ribbon = new THREE.InstancedMesh(ribGeo, ribbonMat, 1);
  ribbon.setMatrixAt(0, new THREE.Matrix4()); ribbon.setColorAt(0, new THREE.Color(0xF5A524)); ribbon.frustumCulled = false; ribbon.visible = false; root.add(ribbon);
  const ribTotal = ri.length;

  const sbGeo = new THREE.BoxGeometry(1, 1, 1);
  const setback = new THREE.InstancedMesh(sbGeo, setbackMat, 4);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-PIT, yaw, 0, 'YXZ')), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(0x7CC4FF);
    const yAt = (sd) => 9 + sd * Math.sin(PIT) + 0.32, zAt = (sd) => -32 + sd * Math.cos(PIT);
    const edges = [[0, SB, 140 - 2 * SB, 0.35], [0, SLOPE - SB, 140 - 2 * SB, 0.35], [-70 + SB, SLOPE / 2, 0.35, SLOPE - 2 * SB], [70 - SB, SLOPE / 2, 0.35, SLOPE - 2 * SB]];
    edges.forEach(([lx, sd, sx, sz], k) => { const p = Ff(lx, yAt(sd), zAt(sd)); m.compose(v.set(p[0], p[1], p[2]), q, s.set(sx, 0.06, sz)); setback.setMatrixAt(k, m); setback.setColorAt(k, c); }); }
  setback.visible = false; root.add(setback);

  /* territory mask texture (soft-edged polygon) for the shader dimming */
  let mnx = 1e9, mnz = 1e9, mxx = -1e9, mxz = -1e9;
  terrPoly.forEach(([x, z]) => { mnx = Math.min(mnx, x); mnz = Math.min(mnz, z); mxx = Math.max(mxx, x); mxz = Math.max(mxz, z); });
  mnx -= 300; mnz -= 300; mxx += 300; mxz += 300;
  { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.filter = 'blur(3px)'; g.fillStyle = '#fff'; g.beginPath();
    terrPoly.forEach(([x, z], i) => { const px = (x - mnx) / (mxx - mnx) * 256, pz = (z - mnz) / (mxz - mnz) * 256; i ? g.lineTo(px, pz) : g.moveTo(px, pz); });
    g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(cv); t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    U.uTerrMask.value = t; U.uTerrBox.value.set(mnx, mnz, mxx - mnx, mxz - mnz); }
  U.uFocusC.value.set(focus.x, focus.z); U.uFocusAx.value.set(Math.cos(A), Math.sin(A)); U.uFocusHalf.value.set(110 + 25, 32 + 45);

  /* records */
  ranked.forEach((r, i) => {
    r.area = Math.round(r.w * r.d);
    if (i) r.kwp = Math.round(r.area * (r.kind === 'coldstore' ? 0.6 : 0.42) * 0.2);
    r.paybackYears = +(3.6 + i * 0.32).toFixed(1);
  });
  const territory = terrPoly.map(p => p.slice());
  territory.polygon = terrPoly; territory.areaKm2 = meta.territory.areaKm2;
  territory.count = buildings.filter(b => polyContains(terrPoly, b.x, b.z)).length;

  /* layers */
  const L = { solar: 0, territory: 0, territoryDraw: 0, rank: 0, focus: 0, panels: 0 };
  let lastSolar = -1, lastPanels = -1;
  function setLayers(ls){ for (const k in L) if (ls && ls[k] != null) L[k] = +ls[k] || 0; }
  function recolour(){
    const a = colAttr.array, c = new THREE.Color();
    for (const rf of roofs){
      c.copy(rf.base).lerp(rf.amber, L.solar * rf.k);
      for (let v = rf.start; v < rf.start + rf.count; v++){ a[v * 3] = c.r; a[v * 3 + 1] = c.g; a[v * 3 + 2] = c.b; }
    }
    colAttr.needsUpdate = true;
  }
  const WHITE = new THREE.Color(1, 1, 1);
  function update(t){
    U.uTerr.value = L.territory; U.uFocus.value = L.focus; U.uSolar.value = L.solar;
    hero.roofMat.color.copy(WHITE).lerp(hero.amber, L.solar * (1 - 0.8 * L.focus));   // scored amber from above; real sheeting once the design opens
    if (Math.abs(L.solar - lastSolar) > 0.004){ lastSolar = L.solar; recolour(); }
    beamMat.opacity = 0.42 * L.rank; ringMat.opacity = 0.95 * L.rank;
    beams.visible = rings.visible = L.rank > 0.004;
    if (rings.visible){ const m = new THREE.Matrix4(); ranked.forEach((r, i) => { const sc = (Math.max(r.w, r.d) * 0.62 + 10) * (1 + 0.06 * Math.sin(t * 2.2 + i)); m.makeScale(sc, 1, sc).setPosition(r.x, r.top + 1.2, r.z); rings.setMatrixAt(i, m); }); rings.instanceMatrix.needsUpdate = true; }
    ribbonMat.opacity = 0.92 * Math.max(L.territory, L.territoryDraw);
    ribbon.visible = ribbonMat.opacity > 0.004;
    ribGeo.setDrawRange(0, Math.floor(ribTotal * clamp(Math.max(L.territoryDraw, L.territory), 0, 1) / 6) * 6);
    if (L.panels !== lastPanels){ lastPanels = L.panels; let n = Math.round(NMOD * clamp(L.panels, 0, 1));   // best face first, then the next
      for (const f of faces){ const c = Math.min(n, f.instanceMatrix.count); f.count = c; f.visible = c > 0; n -= c; } rails.visible = rackMesh.count > 0; }
    setbackMat.opacity = clamp(L.focus * 1.4 - 0.2, 0, 1) * 0.95; setback.visible = setbackMat.opacity > 0.004;
  }
  function stats(){
    let tris = 0, draws = 0; const mats = new Set();
    root.traverse(o => { if (!o.isMesh || !o.visible) return; draws++; mats.add(o.material); const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o.isInstancedMesh ? o.count : 1); });
    return { drawables: draws, materials: mats.size, programsEstimate: 5, triangles: Math.round(tris) };
  }
  function dispose(){
    root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material){ if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    U.uTerrMask.value && U.uTerrMask.value.dispose();
  }
  update(0);
  return { group: root, buildings, ranked, focus, territory, sunTarget: new THREE.Vector3(focus.x, focus.y, focus.z), site: meta.site,
    axisRad: A, heightAt, setLayers, update, dispose, stats, _U: U };
}

export async function buildCityAsync(THREE, opts){ return buildFarm(THREE, opts); }
export function buildCity(){ throw new Error('world-farm: use buildCityAsync (assets are fetched)'); }
