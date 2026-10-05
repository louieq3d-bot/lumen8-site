/* AgrosIQ — aerial farm renderer runtime. One WebGL2 context compiles aerial-shader.js once and paints every
   <div class="aerial" data-aerial="preset"> on the page through its own 2-D canvas, so a page can carry many live scenes.
   Resolution adapts to the GPU: it climbs to the device pixel ratio when frames are fast and backs off when they are not.

   Usage:  <div class="aerial" data-aerial="orbit|earth|health|pixels|season|map|truth|zones|stack" data-seed="3" data-res="1"></div>
           const a = AerialGL.get(el); a.p.health = 1; a.cam = AerialGL.lookCam(...);
           a.project(x, y, z) -> [cssX, cssY] | null      a.unproject(cssX, cssY) -> [x, y] | null      a.pick(cssX, cssY) -> field info
   A page takes control with data-drive="manual" and sets a.p / a.cam itself in a.onframe(t, dt). */
(function(){
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PLANET = 160000;
  const ALERT = [188, -106];
  const SUN = (() => { const v = [-.55, .38, .74], l = Math.hypot(...v); return v.map(x => x / l); })();
  const D = { health: 0, scan: 0, scanOn: 0, pix: 1, alert: 0, patch: 0, cloud: 0, outline: 0, focusK: 0, focusR: 300, season: .42, expo: 1, sat: 1.1,
              zones: 0, stack: 0, sep: 240, stars: 0, dim: 0, alertPos: ALERT, focus: ALERT, shift: [0, 0], tile: [ALERT[0], ALERT[1], 640, 440],
              hi: [0, 0, 0, 0], sel: [0, 0, 0, 0], sun: SUN };
  const UNI = ['uRes', 'uTime', 'uSeed', 'uPlanet', 'uAlt', 'uRo', 'uR', 'uU', 'uF', 'uSun', 'uTan', 'uShift', 'uHealth', 'uScan', 'uScanOn', 'uPix', 'uAlert',
               'uPatch', 'uCloud', 'uOutline', 'uFocusK', 'uFocusR', 'uSeason', 'uExpo', 'uSat', 'uZones', 'uStack', 'uSep', 'uStars', 'uDim', 'uAlertPos',
               'uFocus', 'uTile', 'uHi', 'uSel', 'uN', 'uJit'];

  function lookCam(tx, ty, tz, az, el, dist, fov){
    const ce = Math.cos(el);
    return { x: tx + Math.cos(az) * ce * dist, y: ty + Math.sin(az) * ce * dist, z: tz + Math.sin(el) * dist, tx, ty, tz, fov: fov || 40 };
  }
  const altOf = (c) => Math.hypot(c.x, c.y, c.z + PLANET) - PLANET;

  const PRESETS = {
    earth(t){ return { cam: lookCam(ALERT[0], ALERT[1], 0, -1.95 + t * .004, .3, 70000, 34), p: { cloud: .62, stars: 1, season: .42, sat: 1.15 } }; },
    orbit(t){ return { cam: lookCam(ALERT[0], ALERT[1], 0, -1.9 + t * .012, .64, 4900, 38), p: { cloud: .55, season: .42 } }; },
    season(t){ return { cam: lookCam(ALERT[0], ALERT[1], 0, -2.2 + t * .01, .7, 2300, 38), p: { season: (t * .035) % 1 } }; },
    health(t){ const k = (t % 12) / 12;
      return { cam: lookCam(ALERT[0], ALERT[1], 0, -1.6 + Math.sin(t * .05) * .25, 1.0, 1900, 38), p: { health: 1, scanOn: 1, scan: -1700 + k * 3800, outline: .55, season: .45 } }; },
    pixels(t){ return { cam: lookCam(ALERT[0], ALERT[1], 0, -1.75 + Math.sin(t * .07) * .18, 1.08, 420, 36), p: { health: 1, patch: 1, alert: 1, season: .45 } }; },
    map(t){ return { cam: lookCam(ALERT[0] + 60, ALERT[1] + 20, 0, -1.5708, 1.5, 2400, 34), p: { health: .92, outline: .7, alert: 1, patch: 1, season: .45, scanOn: 1, scan: -2400 + ((t % 10) / 10) * 5200 } }; },
    truth(t){ return { cam: lookCam(ALERT[0], ALERT[1], 0, -1.75 + Math.sin(t * .05) * .2, .95, 900, 36), p: { season: .45, patch: 1 } }; },
    zones(t){ return { cam: lookCam(ALERT[0], ALERT[1], 0, -1.7 + Math.sin(t * .05) * .3, 1.05, 1500, 36), p: { zones: 1, outline: .35, season: .45 } }; },
    stack(t){ return { cam: lookCam(ALERT[0], ALERT[1], 380, -1.95 + Math.sin(t * .09) * .32, .5, 3300, 36), p: { stack: 1, season: .45, patch: 1, dim: .05 } }; },
  };

  /* ── the field layout, ported from the shader in float32 so a pointer can name the field it is over ── */
  const f32 = Math.fround, fr = (x) => f32(x - Math.floor(x));
  const C = { k1: f32(123.34), k2: f32(456.21), k3: f32(45.32), r1: f32(.978), r2: f32(.208), w: f32(.0011), o: f32(7.3) };
  function hasher(seed){
    const S = f32(f32(seed) * f32(.137));
    const h21 = (x, y) => {
      let a = fr(f32(f32(x * C.k1) + S)), b = fr(f32(f32(y * C.k2) + S));
      const d = f32(f32(a * f32(a + C.k3)) + f32(b * f32(b + C.k3)));
      a = f32(a + d); b = f32(b + d); return fr(f32(a * b));
    };
    const vn = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = f32(x - ix), fy = f32(y - iy);
      const ux = f32(f32(fx * fx) * f32(3 - f32(2 * fx))), uy = f32(f32(fy * fy) * f32(3 - f32(2 * fy)));
      const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
      const m1 = a + (b - a) * ux, m2 = c + (d - c) * ux; return m1 + (m2 - m1) * uy;
    };
    const warp = (x, y) => { const sx = f32(x * C.w), sy = f32(y * C.w); return [f32((vn(sx, sy) - .5) * 110), f32((vn(f32(sx + C.o), f32(sy + C.o)) - .5) * 110)]; };
    const BX = 780, BY = 610, add = (a, b) => f32(a + f32(b));
    function field(x, y){
      x = f32(x); y = f32(y);
      const wp = warp(x, y);
      let qx = f32(f32(f32(C.r1 * x) + f32(f32(-.208) * y)) + wp[0]), qy = f32(f32(f32(C.r2 * x) + f32(C.r1 * y)) + wp[1]);
      const off = f32(h21(Math.floor(f32(qy / BY)), f32(3.1)) * BX);
      qx = f32(qx + off);
      const bx = Math.floor(f32(qx / BX)), by = Math.floor(f32(qy / BY));
      const fx = f32(qx - bx * BX), fy = f32(qy - by * BY);
      const hb = h21(bx, by); let id = 0, lx = 0, ly = 0, hx = BX, hy = BY;
      if (h21(add(bx, 1.7), add(by, 1.7)) < .8){ const s = f32(BX * f32(f32(.28) + f32(f32(.44) * h21(add(bx, 2.3), add(by, 2.3))))); if (fx < s){ hx = s; id = 1; } else { lx = s; id = 2; } }
      if (h21(add(bx + id, 3.1), add(by + id, 3.1)) < .72){ const s = f32(ly + f32((hy - ly) * f32(f32(.3) + f32(f32(.4) * h21(add(bx + id, 5.7), add(by + id, 5.7)))))); if (fy < s){ hy = s; id += 10; } else { ly = s; id += 20; } }
      if (h21(add(bx + id, 8.9), add(by + id, 8.9)) < .34){ const s = f32(lx + f32((hx - lx) * f32(f32(.35) + f32(f32(.3) * h21(add(bx + id, 9.4), add(by + id, 9.4)))))); if (fx < s){ hx = s; id += 100; } else { lx = s; id += 200; } }
      const k137 = f32(1.37), k71 = f32(f32(id) * f32(.71));
      let fid = h21(add(f32(f32(bx * k137) + k71), .5), add(f32(f32(by * k137) + k71), .5)), code = id, pivot = 0, pr = 0;
      const dE = Math.min(fx - lx, hx - fx, fy - ly, hy - fy), dR = Math.min(fx, BX - fx, fy, BY - fy);
      if (hb > .79){
        pr = Math.min(BX, BY) * .5 - 16; const d = Math.hypot(fx - BX / 2, fy - BY / 2), out = d > pr;
        pivot = out ? 2 : 1; fid = h21(f32(f32(bx * f32(2.1)) + (out ? 9 : 0)), f32(f32(by * f32(2.1)) + (out ? 9 : 0))); code = out ? 600 : 500;
      }
      let kind = hb < .055 ? 6 : Math.floor(fid * 6); if (pivot === 2) kind = 4;
      return { bx, by, code, id: fid, kind, pivot, lx, ly, hx, hy, dE, dR, off, pr };
    }
    // the world point at the centre of a field (inverts the rotation and the warp by fixed-point iteration)
    function centre(F){
      const cx = F.pivot === 1 ? BX / 2 : (F.lx + F.hx) / 2, cy = F.pivot === 1 ? BY / 2 : (F.ly + F.hy) / 2;
      const q0x = F.bx * BX + cx - F.off, q0y = F.by * BY + cy; let x = 0, y = 0;
      for (let i = 0; i < 6; i++){ const w = warp(x, y), ax = q0x - w[0], ay = q0y - w[1]; x = .978 * ax + .208 * ay; y = -.208 * ax + .978 * ay; }
      return [x, y];
    }
    return { field, centre, h21 };
  }
  const HASH = {}; const H = (seed) => HASH[seed] || (HASH[seed] = hasher(seed));

  const NAMES = ['Long Acre', 'Creek Flat', 'Top Pivot', 'Home Block', 'Windmill', 'Back Forty', 'Old Orchard', 'Stony Rise', 'Big Square', 'Bluegum', 'Shed Paddock',
    'River Run', 'Hilltop', 'Kidman', 'North Strip', 'Dam Paddock', 'Station', 'Railway', 'Wattle', 'Sandy Rise', 'Boundary', 'Corner Block', 'Lucerne',
    'Middle Flat', 'Swamp', 'School Block', 'Pine Row', 'Far East', 'Mill', 'Gully', 'Bottom Flat', 'Red Hill'];
  const CROPS = ['Wheat', 'Canola', 'Barley', 'Maize', 'Stubble', 'Pasture', 'Woodland'];
  const STAGES = [[.04, 'Bare soil'], [.16, 'Emerging'], [.32, 'Vegetative'], [.58, 'Peak growth'], [.74, 'Ripening'], [.83, 'Harvest'], [1.01, 'Stubble']];
  const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  function describe(F, seed, season){
    if (!F) return null;
    const h = H(seed), alertF = h.field(ALERT[0], ALERT[1]);
    const isAlert = F.bx === alertF.bx && F.by === alertF.by && F.code === alertF.code;
    const ni = Math.floor(h.h21(F.bx * 3 + F.code * .013, F.by * 3 + 1.9) * NAMES.length);
    const t = (((season + F.id * .53) % 1) + 1) % 1;
    const g = sstep(.04, .30, t) * (1 - sstep(.58, .74, t) * .8) * (1 - sstep(.80, .83, t));
    const area = F.pivot === 1 ? Math.PI * F.pr * F.pr : F.pivot === 2 ? 780 * 610 - Math.PI * F.pr * F.pr : (F.hx - F.lx) * (F.hy - F.ly);
    const vs = .9 + .2 * h.h21(F.bx + F.code * .1, F.by + 7.7);
    return {
      key: [F.bx, F.by, F.code], name: isAlert ? 'Ridge Paddock' : NAMES[ni] + (F.pivot === 1 ? ' Pivot' : ''), alert: isAlert,
      crop: F.pivot === 1 ? ['Maize', 'Cotton', 'Soybean', 'Lucerne'][Math.floor(F.id * 4)] : CROPS[F.kind], kind: F.kind, pivot: F.pivot,
      ha: area / 1e4, stage: STAGES.find(s => t < s[0])[1], season: t,
      health: F.kind >= 6 ? null : Math.max(.08, Math.min(.98, (F.kind === 5 ? .7 : g) * vs * (isAlert ? .78 : 1))),
      vsNormal: isAlert ? -24 : Math.round((vs - 1) * 60), centre: H(seed).centre(F),
    };
  }

  /* ── one shared GL context; a quick "core" program (ground + data layers) and a "full" one (adds clouds, stars and the
        exploded layer stack) compile in parallel, and the full one takes over the moment it is ready ── */
  /* the frame pipeline: the farm renders off-screen (HDR where the GPU allows), is anti-aliased over time while the camera holds
     still, then one pass upscales it (Catmull-Rom), sharpens it, adds bloom from a thresholded mip chain, tone-maps and grains it */
  const NL = String.fromCharCode(10);
  const POST = {
    vs: 'in vec2 a; out vec2 v; void main(){ v = a * .5 + .5; gl_Position = vec4(a, 0., 1.); }',
    // temporal anti-aliasing with reprojection: the ground is an exact sphere, so every pixel knows where it was last frame
    taa: [
      'precision highp float; uniform sampler2D uCur, uHist; uniform float uA, uAmax, uPlanet; uniform vec2 uRes;',
      'uniform vec3 uRo, uR, uU, uF, uRo0, uR0, uU0, uF0; uniform float uTan, uTan0; uniform vec2 uShift, uShift0; out vec4 o;',
      'float lum(vec3 c){ return dot(c, vec3(.3, .55, .15)); }',
      'vec3 H(vec2 p){ return textureLod(uHist, p, 0.).rgb; }',
      'vec3 crH(vec2 uv){',
      '  vec2 sz = vec2(textureSize(uHist, 0)), sp = uv * sz, tp = floor(sp - .5) + .5, f = sp - tp;',
      '  vec2 w0 = f * (-.5 + f * (1. - .5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (.5 + f * (2. - 1.5 * f)), w3 = f * f * (-.5 + .5 * f);',
      '  vec2 w12 = w1 + w2, a = (tp - 1.) / sz, b = (tp + w2 / w12) / sz, d = (tp + 2.) / sz;',
      '  vec3 r = H(vec2(b.x, a.y)) * w12.x * w0.y + H(vec2(a.x, b.y)) * w0.x * w12.y + H(b) * w12.x * w12.y + H(vec2(d.x, b.y)) * w3.x * w12.y + H(vec2(b.x, d.y)) * w12.x * w3.y;',
      '  return r / (w12.x * w0.y + w0.x * w12.y + w12.x * w12.y + w3.x * w12.y + w12.x * w3.y);',
      '}',
      'void main(){',
      '  ivec2 p = ivec2(gl_FragCoord.xy), m = textureSize(uCur, 0) - 1;',
      '  vec3 c = texelFetch(uCur, p, 0).rgb, mn = c, mx = c, s1 = vec3(0.), s2 = vec3(0.);',
      '  for (int k = 0; k < 9; k++){ vec3 s = texelFetch(uCur, clamp(p + ivec2(k % 3 - 1, k / 3 - 1), ivec2(0), m), 0).rgb; mn = min(mn, s); mx = max(mx, s); s1 += s; s2 += s * s; }',
      '  vec3 mu = s1 / 9., sg = sqrt(max(s2 / 9. - mu * mu, 0.));',
      '  mn = max(mn, mu - sg * 1.25); mx = min(mx, mu + sg * 1.25);',
      // where this pixel was in the previous frame: through the ground point if the ray hits the planet, else by direction alone
      '  float asp = uRes.x / uRes.y; vec2 uv = (gl_FragCoord.xy - .5 * uRes) / (.5 * uRes.y) - uShift * vec2(asp, 1.);',
      '  vec3 rd = normalize(uF + uv.x * uTan * uR + uv.y * uTan * uU), v = rd;',
      '  float R = uPlanet, b = dot(uRo, rd) + R * rd.z, disc = b * b - (dot(uRo, uRo) + 2. * R * uRo.z);',
      '  if (disc > 0.){ float t = -b - sqrt(disc); if (t > 0.) v = uRo + rd * t - uRo0; }',
      '  float d = dot(v, uF0); vec2 q = vec2(dot(v, uR0), dot(v, uU0)) / max(d * uTan0, 1e-6) + uShift0 * vec2(asp, 1.);',
      '  vec2 pf = q * .5 * uRes.y + .5 * uRes, hv = pf / uRes;',
      '  float a = uA;',
      '  if (d <= 0. || hv.x < 0. || hv.y < 0. || hv.x > 1. || hv.y > 1.) a = 1.;',
      '  a = max(a, mix(0., uAmax, smoothstep(.5, 8., length(pf - gl_FragCoord.xy))));',
      '  vec3 h = a < 1. ? clamp(max(crH(hv), 0.), mn, mx) : c;',
      '  float wc = a / (1. + lum(c)), wh = (1. - a) / (1. + lum(h));',
      '  o = vec4((c * wc + h * wh) / max(wc + wh, 1e-5), 1.);',
      '}'].join(NL),
    bright: [
      'precision highp float; uniform sampler2D uSrc; uniform vec2 uTx; uniform float uThr; in vec2 v; out vec4 o;',
      'void main(){',
      '  vec3 c = (textureLod(uSrc, v + uTx * vec2(-1., -1.), 0.).rgb + textureLod(uSrc, v + uTx * vec2(1., -1.), 0.).rgb',
      '         + textureLod(uSrc, v + uTx * vec2(-1., 1.), 0.).rgb + textureLod(uSrc, v + uTx, 0.).rgb) * .25;',
      '  float l = max(c.r, max(c.g, c.b));',
      '  o = vec4(min(c * max(l - uThr, 0.) / max(l, 1e-4), vec3(8.)), 1.);',
      '}'].join(NL),
    fin: [
      'precision highp float; uniform sampler2D uSrc, uBlm; uniform vec2 uSz, uOut; uniform float uSharp, uBloom, uVig, uHdr, uT; in vec2 v; out vec4 o;',
      'vec3 T(vec2 p){ return textureLod(uSrc, p, 0.).rgb; }',
      'vec3 cr(vec2 uv){',
      '  vec2 sp = uv * uSz, tp = floor(sp - .5) + .5, f = sp - tp;',
      '  vec2 w0 = f * (-.5 + f * (1. - .5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (.5 + f * (2. - 1.5 * f)), w3 = f * f * (-.5 + .5 * f);',
      '  vec2 w12 = w1 + w2, a = (tp - 1.) / uSz, b = (tp + w2 / w12) / uSz, d = (tp + 2.) / uSz;',
      '  return (T(vec2(a.x, a.y)) * w0.x + T(vec2(b.x, a.y)) * w12.x + T(vec2(d.x, a.y)) * w3.x) * w0.y',
      '       + (T(vec2(a.x, b.y)) * w0.x + T(vec2(b.x, b.y)) * w12.x + T(vec2(d.x, b.y)) * w3.x) * w12.y',
      '       + (T(vec2(a.x, d.y)) * w0.x + T(vec2(b.x, d.y)) * w12.x + T(vec2(d.x, d.y)) * w3.x) * w3.y;',
      '}',
      'void main(){',
      '  bool same = abs(uSz.x - uOut.x) < .5 && abs(uSz.y - uOut.y) < .5;',
      '  vec3 c = same ? texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0).rgb : max(cr(v), 0.);',
      '  vec2 d = 1. / uOut;',
      '  vec3 n1 = T(v + vec2(d.x, 0.)), n2 = T(v - vec2(d.x, 0.)), n3 = T(v + vec2(0., d.y)), n4 = T(v - vec2(0., d.y));',
      '  vec3 mn = min(min(min(n1, n2), min(n3, n4)), c), mx = max(max(max(n1, n2), max(n3, n4)), c);',
      '  c = clamp(c + uSharp * (c - (n1 + n2 + n3 + n4) * .25), mn, mx);',
      '  vec3 bl = textureLod(uBlm, v, 1.).rgb * .30 + textureLod(uBlm, v, 2.).rgb * .26 + textureLod(uBlm, v, 3.).rgb * .2',
      '          + textureLod(uBlm, v, 4.).rgb * .14 + textureLod(uBlm, v, 5.).rgb * .1;',
      '  c += bl * uBloom;',
      '  if (uHdr > .5) c = c / (1. + c * .18) * 1.12;',
      '  vec2 q = v - .5; c *= 1. - uVig * smoothstep(.2, .95, dot(q, q) * 2.2);',
      '  vec2 g = gl_FragCoord.xy + fract(uT * 7.31) * 113.;',
      '  c += (fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453) - .5) * (1.6 / 255.);',
      '  o = vec4(c, 1.);',
      '}'].join(NL),
  };
  const HALTON = Array.from({ length: 16 }, (_, i) => { const h = (n, b) => { let f = 1, r = 0; while (n > 0){ f /= b; r += f * (n % b); n = Math.floor(n / b); } return r; }; return [h(i + 1, 2) - .5, h(i + 1, 3) - .5]; });

  const G = { cv: document.createElement('canvas'), gl: null, core: null, full: null, cur: null, ready: false, failed: false, hdr: false,
              q: matchMedia('(max-width: 760px)').matches ? .7 : .8, cap: 4.4e6, icap: 3.4e6, opt: { taa: true, sharp: .32, bloom: .55, vig: .16 } };
  const readyFns = [];
  function fail(msg){ if (msg) console.error('[aerial]', msg); G.failed = true; document.querySelectorAll('[data-aerial]').forEach(el => el.classList.add('is-nogl')); }
  function initGL(){
    const gl = G.cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl || !window.AERIAL_FS){ fail(); return; }
    G.gl = gl;
    G.hdr = !!gl.getExtension('EXT_color_buffer_float');
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = sh(gl.VERTEX_SHADER, '#version 300 es' + NL + 'in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }');
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const build = (name, defs) => {
      const fs = sh(gl.FRAGMENT_SHADER, window.AERIAL_FS.replace('#version 300 es' + NL, '#version 300 es' + NL + defs + (G.hdr ? '#define HDR' + NL : '')));
      const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr);
      return { name, pr, fs, u: {}, ok: false, done: false };
    };
    // the post passes are tiny: compiled now, checked the first time they are used
    const pvs = sh(gl.VERTEX_SHADER, '#version 300 es' + NL + POST.vs);
    G.post = {};
    ['taa', 'bright', 'fin'].forEach(k => {
      const fs = sh(gl.FRAGMENT_SHADER, '#version 300 es' + NL + POST[k]);
      const pr = gl.createProgram(); gl.attachShader(pr, pvs); gl.attachShader(pr, fs); gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr);
      G.post[k] = { pr, fs, u: null };
    });
    const P = [G.core = build('core', ''), G.full = build('full', '#define FULL' + NL)];
    const finish = (x) => {
      x.done = true;
      if (!gl.getProgramParameter(x.pr, gl.LINK_STATUS)){ console.error('[aerial]', x.name, gl.getShaderInfoLog(x.fs) || gl.getProgramInfoLog(x.pr)); if (P.every(y => y.done && !y.ok)) fail(); return; }
      UNI.forEach(n => x.u[n] = gl.getUniformLocation(x.pr, n)); x.ok = true;
      if (!G.ready){ G.ready = true; readyFns.splice(0).forEach(fn => fn()); }
    };
    const poll = () => { P.forEach(x => { if (!x.done && (!ext || gl.getProgramParameter(x.pr, ext.COMPLETION_STATUS_KHR))) finish(x); }); if (P.some(x => !x.done)) setTimeout(poll, 16); };
    poll();
    G.cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(); });
  }

  class Aerial {
    constructor(el){
      this.el = el; this.p = Object.assign({}, D); this.cam = lookCam(0, 0, 0, -1.8, .7, 3000, 38);
      this.preset = el.dataset.aerial || 'orbit'; this.seed = +(el.dataset.seed || 3); this.res = +(el.dataset.res || 1);
      this.t0 = performance.now(); this.visible = false; this.W = 0; this.H = 0;
      this.gate = el.closest('.has-mega');
      if (el.dataset.shift){ const v = el.dataset.shift.split(',').map(Number); this.over = { shift: () => innerWidth < 900 ? [0, v[1] || 0] : v }; }   // menu previews only draw while their menu is open
      const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); el.prepend(cv); this.cv = cv;
      this.ctx = cv.getContext('2d', { alpha: false });
      new IntersectionObserver(es => { this.visible = es[0].isIntersecting; }, { rootMargin: '160px' }).observe(el);
      new ResizeObserver(() => this.measure()).observe(el); this.measure();
    }
    measure(){ const r = this.el.getBoundingClientRect(); this.w = Math.max(2, r.width); this.h = Math.max(2, r.height); }
    // render scale: G.q (frame-rate driven) while the camera moves; native, and accumulated over time, once it has held still
    quality(){ if (G.q >= 1 || G.lock) return G.q; return (this.still || 0) < .3 ? G.q : 1; }
    size(){
      // output = the canvas at device pixels (capped); the farm itself renders at output x quality and is upscaled
      const dpr = Math.min(window.devicePixelRatio || 1, 2), css = this.w * this.h;
      let k = dpr * this.res; if (css * k * k > G.cap) k = Math.sqrt(G.cap / css);
      const W = Math.max(2, Math.round(this.w * k)), Hh = Math.max(2, Math.round(this.h * k));
      if (W !== this.W || Hh !== this.H){ this.W = this.cv.width = W; this.H = this.cv.height = Hh; }
      let q = this.quality(); if (W * Hh * q * q > G.icap) q = Math.sqrt(G.icap / (W * Hh));
      const iw = Math.max(2, Math.round(W * q)), ih = Math.max(2, Math.round(Hh * q));
      this.iw = iw; this.ih = ih;
    }
    // off-screen targets: the farm (S), two history buffers for the temporal pass (A, B) and a half-size bloom chain (L)
    targets(){
      const gl = G.gl, w = this.iw, h = this.ih, T = this.T || (this.T = {});
      const mk = (o, tw, th, mips) => {
        if (o && o.w === tw && o.h === th) return o;
        if (o){ gl.deleteTexture(o.tex); gl.deleteFramebuffer(o.fb); }
        const tex = gl.createTexture(), lv = mips ? Math.max(1, Math.min(6, Math.floor(Math.log2(Math.max(tw, th))) + 1)) : 1;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texStorage2D(gl.TEXTURE_2D, lv, G.hdr ? gl.RGBA16F : gl.RGBA8, tw, th);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return { tex, fb, w: tw, h: th, n: 0 };
      };
      T.S = mk(T.S, w, h, false);
      T.L = mk(T.L, Math.max(2, w >> 1), Math.max(2, h >> 1), true);
      if (this.taa){ const k = (this.hist & 1) ? 'A' : 'B'; T[k] = mk(T[k], w, h, false); }
      return T;
    }
    release(){
      const gl = G.gl, T = this.T; if (!T) return;
      Object.values(T).forEach(o => { gl.deleteTexture(o.tex); gl.deleteFramebuffer(o.fb); }); this.T = null; this.hist = 0;
    }
    basis(){
      const c = this.cam, fx = c.tx - c.x, fy = c.ty - c.y, fz = c.tz - c.z, fl = Math.hypot(fx, fy, fz);
      const F = [fx / fl, fy / fl, fz / fl];
      let R = [F[1], -F[0], 0]; const rl = Math.hypot(R[0], R[1]) || 1; R = [R[0] / rl, R[1] / rl, 0];
      let U = [R[1] * F[2] - R[2] * F[1], R[2] * F[0] - R[0] * F[2], R[0] * F[1] - R[1] * F[0]];
      if (c.roll){ const cr = Math.cos(c.roll), sr = Math.sin(c.roll), R0 = R; R = R0.map((v, i) => v * cr + U[i] * sr); U = U.map((v, i) => v * cr - R0[i] * sr); }   // bank the camera
      return { F, R, U, tan: Math.tan((c.fov || 40) * Math.PI / 360) };
    }
    project(x, y, z){
      const b = this.basis(), c = this.cam, v = [x - c.x, y - c.y, (z || 0) - c.z];
      const d = v[0] * b.F[0] + v[1] * b.F[1] + v[2] * b.F[2];
      if (d <= 1) return null;
      const sx = (v[0] * b.R[0] + v[1] * b.R[1] + v[2] * b.R[2]) / (d * b.tan), sy = (v[0] * b.U[0] + v[1] * b.U[1] + v[2] * b.U[2]) / (d * b.tan);
      const asp = this.w / this.h, ux = sx + this.p.shift[0] * asp, uy = sy + this.p.shift[1];
      return [this.w / 2 + ux * this.h / 2, this.h / 2 - uy * this.h / 2];
    }
    unproject(cx, cy){
      const b = this.basis(), c = this.cam, asp = this.w / this.h;
      const sx = (cx - this.w / 2) / (this.h / 2) - this.p.shift[0] * asp, sy = (this.h / 2 - cy) / (this.h / 2) - this.p.shift[1];
      let rd = [0, 1, 2].map(i => b.F[i] + sx * b.tan * b.R[i] + sy * b.tan * b.U[i]); const l = Math.hypot(...rd); rd = rd.map(v => v / l);
      const bb = c.x * rd[0] + c.y * rd[1] + c.z * rd[2] + PLANET * rd[2], cc = c.x * c.x + c.y * c.y + c.z * c.z + 2 * PLANET * c.z, disc = bb * bb - cc;
      if (disc < 0) return null; const t = -bb - Math.sqrt(disc); if (t < 0) return null;
      return [c.x + rd[0] * t, c.y + rd[1] * t];
    }
    post(T, t, iw, ih, W, Hh){
      const gl = G.gl, use = (k) => {
        const x = G.post[k];
        if (!x.u){
          if (!gl.getProgramParameter(x.pr, gl.LINK_STATUS)){ console.error('[aerial] post', k, gl.getShaderInfoLog(x.fs)); G.opt.broken = true; }
          x.u = {}; ['uAmax', 'uPlanet', 'uRes', 'uRo', 'uR', 'uU', 'uF', 'uRo0', 'uR0', 'uU0', 'uF0', 'uTan', 'uTan0', 'uShift', 'uShift0', 'uCur', 'uHist', 'uA', 'uSrc', 'uTx', 'uThr', 'uBlm', 'uSz', 'uOut', 'uSharp', 'uBloom', 'uVig', 'uHdr', 'uT'].forEach(n => x.u[n] = gl.getUniformLocation(x.pr, n));
        }
        gl.useProgram(x.pr); G.cur = x; return x.u;
      };
      const tex = (unit, tx) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx); };
      let src = T.S;
      if (this.taa){
        const dst = (this.hist & 1) ? T.A : T.B, prev = (this.hist & 1) ? T.B : T.A;
        const u = use('taa'); gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, iw, ih);
        tex(0, T.S.tex); tex(1, prev ? prev.tex : T.S.tex); gl.uniform1i(u.uCur, 0); gl.uniform1i(u.uHist, 1);
        const C = this.frame, P0 = this.prevFrame || C, layered = this.p.stack > .01;
        gl.uniform1f(u.uA, this.hist && prev ? Math.max(1 / (this.hist + 1), layered ? .35 : .1) : 1); gl.uniform1f(u.uAmax, layered ? .7 : .4);
        gl.uniform1f(u.uPlanet, PLANET); gl.uniform2f(u.uRes, iw, ih);
        gl.uniform3fv(u.uRo, C.ro); gl.uniform3fv(u.uR, C.R); gl.uniform3fv(u.uU, C.U); gl.uniform3fv(u.uF, C.F); gl.uniform1f(u.uTan, C.tan); gl.uniform2fv(u.uShift, C.shift);
        gl.uniform3fv(u.uRo0, P0.ro); gl.uniform3fv(u.uR0, P0.R); gl.uniform3fv(u.uU0, P0.U); gl.uniform3fv(u.uF0, P0.F); gl.uniform1f(u.uTan0, P0.tan); gl.uniform2fv(u.uShift0, P0.shift);
        gl.drawArrays(gl.TRIANGLES, 0, 3); this.hist++; src = dst;
      }
      const o = this.p, bloom = (o.bloom == null ? 1 : o.bloom) * G.opt.bloom;
      if (bloom > 0){
        let u = use('bright'); gl.bindFramebuffer(gl.FRAMEBUFFER, T.L.fb); gl.viewport(0, 0, T.L.w, T.L.h);
        tex(0, src.tex); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uTx, 1 / iw, 1 / ih); gl.uniform1f(u.uThr, G.hdr ? 1.0 : .82);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindTexture(gl.TEXTURE_2D, T.L.tex); gl.generateMipmap(gl.TEXTURE_2D);
      }
      if (G.cv.width < W || G.cv.height < Hh){ G.cv.width = Math.max(G.cv.width, W); G.cv.height = Math.max(G.cv.height, Hh); }
      const u = use('fin'); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, Hh);
      tex(0, src.tex); tex(1, T.L.tex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u.uSrc, 0); gl.uniform1i(u.uBlm, 1); gl.uniform2f(u.uSz, iw, ih); gl.uniform2f(u.uOut, W, Hh);
      const up = W / iw;   // more sharpening the further the image is stretched
      gl.uniform1f(u.uSharp, G.opt.sharp * (o.sharp == null ? 1 : o.sharp) * (up > 1.02 ? 1 + (up - 1) * 2.2 : 1));
      gl.uniform1f(u.uBloom, bloom); gl.uniform1f(u.uVig, G.opt.vig * (o.vig == null ? 1 : o.vig)); gl.uniform1f(u.uHdr, G.hdr ? 1 : 0); gl.uniform1f(u.uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    pick(cx, cy){ const g = this.unproject(cx, cy); if (!g) return null; return describe(H(this.seed).field(g[0], g[1]), this.seed, this.p.season); }
    draw(now, dt){
      const t = reduce ? 6 : (now - this.t0) / 1000;
      if (this.el.dataset.drive !== 'manual' && PRESETS[this.preset]){ const pr = PRESETS[this.preset](t); this.cam = pr.cam; Object.assign(this.p, D, pr.p); if (this.over) this.p.shift = this.over.shift(); }
      if (this.onframe) this.onframe(t, dt);
      const c0 = this.cam, sig = [c0.x, c0.y, c0.z, c0.tx, c0.ty], prev = this.sig;
      const moved = prev ? Math.hypot(sig[0] - prev[0], sig[1] - prev[1], sig[2] - prev[2]) / Math.max(50, altOf(c0)) + Math.hypot(sig[3] - prev[3], sig[4] - prev[4]) / Math.max(50, altOf(c0)) : 1;
      this.sig = sig; this.still = moved > .0009 ? 0 : (this.still || 0) + dt;
      this.size();
      const gl = G.gl, PR = G.full.ok ? G.full : G.core, u = PR.u, p = this.p, b = this.basis(), c = this.cam, W = this.W, Hh = this.H, iw = this.iw, ih = this.ih;
      // temporal accumulation only while the camera holds still at native scale (nothing to reproject)
      this.taa = G.opt.taa && !G.opt.broken;
      if (!this.taa || PR !== this.lastPR) this.hist = 0;
      this.prevFrame = this.hist ? this.frame : null;
      this.frame = { ro: [c.x, c.y, c.z], R: b.R, U: b.U, F: b.F, tan: b.tan, shift: p.shift.slice() };
      this.lastPR = PR; this.lastDraw = now;
      const T = this.targets();
      const jit = this.taa ? HALTON[(this.hist || 0) % 16] : [0, 0];
      if (G.cur !== PR){ gl.useProgram(PR.pr); G.cur = PR; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.S.fb); gl.viewport(0, 0, iw, ih);
      gl.uniform2f(u.uRes, iw, ih); gl.uniform2f(u.uJit, jit[0], jit[1]); gl.uniform1f(u.uTime, t); gl.uniform1f(u.uSeed, this.seed); gl.uniform1f(u.uPlanet, PLANET); gl.uniform1f(u.uAlt, altOf(c));
      gl.uniform3f(u.uRo, c.x, c.y, c.z); gl.uniform3fv(u.uR, b.R); gl.uniform3fv(u.uU, b.U); gl.uniform3fv(u.uF, b.F); gl.uniform1f(u.uTan, b.tan);
      gl.uniform3fv(u.uSun, p.sun); gl.uniform2fv(u.uShift, p.shift);
      gl.uniform1f(u.uHealth, p.health); gl.uniform1f(u.uScan, p.scan); gl.uniform1f(u.uScanOn, p.scanOn); gl.uniform1f(u.uPix, p.pix);
      gl.uniform1f(u.uAlert, p.alert); gl.uniform1f(u.uPatch, p.patch); gl.uniform1f(u.uCloud, p.cloud); gl.uniform1f(u.uOutline, p.outline);
      gl.uniform1f(u.uFocusK, p.focusK); gl.uniform1f(u.uFocusR, p.focusR); gl.uniform1f(u.uSeason, p.season); gl.uniform1f(u.uExpo, p.expo);
      gl.uniform1f(u.uSat, p.sat); gl.uniform1f(u.uZones, p.zones); gl.uniform1f(u.uStack, p.stack); gl.uniform1f(u.uSep, p.sep);
      gl.uniform1f(u.uStars, p.stars); gl.uniform1f(u.uDim, p.dim); gl.uniform1i(u.uN, 1);
      gl.uniform2fv(u.uAlertPos, p.alertPos); gl.uniform2fv(u.uFocus, p.focus); gl.uniform4fv(u.uTile, p.tile); gl.uniform4fv(u.uHi, p.hi); gl.uniform4fv(u.uSel, p.sel);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.post(T, t, iw, ih, W, Hh);
      this.ctx.drawImage(G.cv, 0, G.cv.height - Hh, W, Hh, 0, 0, W, Hh);
      if (!this.on){ this.on = true; this.el.classList.add('is-on'); this.el.dispatchEvent(new CustomEvent('aerial:on', { bubbles: true })); }
    }
  }

  const instances = [];
  let last = performance.now(), ema = 16, slow = 0, fast = 0;
  function loop(now){
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    if (G.ready && !G.failed && !document.hidden){
      let drew = false;
      for (const a of instances){
        if (a.visible && (!a.gate || a.gate.matches(':hover, :focus-within'))){ a.draw(now, dt); if (a.quality() === G.q) drew = true; }
        else if (a.T && now - (a.lastDraw || 0) > 6000) a.release();   // give the GPU memory back once a scene has been off-screen a while
      }
      if (drew && !reduce && !G.lock){
        ema += (dt * 1000 - ema) * .08;
        if (ema > 24){ if (++slow > 24){ slow = 0; ema = 16; G.q = Math.max(.42, G.q * .86); } } else slow = 0;
        if (ema < 17.5){ if (++fast > 150){ fast = 0; G.q = Math.min(1, G.q * 1.08); } } else fast = 0;
      }
    }
    requestAnimationFrame(loop);
  }
  function mountAll(){
    document.querySelectorAll('[data-aerial]').forEach(el => { if (!el.__aerial){ el.__aerial = new Aerial(el); instances.push(el.__aerial); } });
  }
  window.AerialGL = {
    get: (el) => el && el.__aerial || null, mountAll, lookCam, ALERT, SUN, PLANET, instances, altOf,
    field: (x, y, seed) => H(seed || 3).field(x, y), describe: (F, seed, season) => describe(F, seed || 3, season == null ? .45 : season),
    fieldAt: (x, y, seed, season) => describe(H(seed || 3).field(x, y), seed || 3, season == null ? .45 : season),
    onReady: (fn) => G.ready ? fn() : readyFns.push(fn), get quality(){ return G.q; }, set quality(v){ G.q = v; }, get full(){ return !!(G.full && G.full.ok); }, opt: G.opt, get hdr(){ return G.hdr; }, lock(v){ G.lock = v != null; if (v != null) G.q = v; },
  };
  initGL();
  mountAll();
  requestAnimationFrame(loop);
})();
