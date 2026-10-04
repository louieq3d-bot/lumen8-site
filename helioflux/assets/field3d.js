/* Field model — the home-page hero. WebGL scene of one site under archetype A, driven by the page's scroll.
   Illustrative, and stated as such on the page: fixed overhead array (4.8 m, east–west rows, 9 m pitch, GCR 0.30)
   at 33.9° S, sown on 21 September. Ground light per point = (beam · lit + diffuse · SVF) / (beam + diffuse), with one
   shadow ray per point per frame (in the shader) and a cosine-weighted sky view factor (precomputed). Each plant grows
   along a logistic curve whose clock runs at the season-mean light that plant receives, so biomass follows
   intercepted light (radiation-use-efficiency logic). It is not the studio's engine. */
(function(){
  'use strict';
  // the light precompute takes a few hundred milliseconds: let the page paint first
  const run = function(){
  const host = document.querySelector('[data-field3d]');
  if (!host) return;
  const hero = host.closest('[data-hero]') || host.parentElement;
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
  host.appendChild(cv);
  const gl = cv.getContext('webgl', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' });
  if (!gl){ host.classList.add('is-nogl'); return; }

  const D2R = Math.PI / 180, LAT = -33.9 * D2R, H = 4.8, PITCH = 9, W2 = 0.3 * PITCH / 2, AX = 45, NROW = 9, Y0 = -36;
  const SEASON_DAYS = 120;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = Math.min(innerWidth, innerHeight) < 640;
  const $ = (s) => hero.querySelector(s);
  const HUD = {};

  /* ── geometry and light, CPU side ── */
  const inRow = (x, y) => {
    if (x < -AX || x > AX) return false;
    const c = Math.round((y - Y0) / PITCH);
    return c >= 0 && c < NROW && Math.abs(y - (Y0 + c * PITCH)) <= W2;
  };
  const decl = (day) => -23.44 * Math.sin(2 * Math.PI * day / 365) * D2R;      // equinox → southern summer
  function sunVec(hours, d){
    const h = 15 * (hours - 12) * D2R;
    return { e: -Math.cos(d) * Math.sin(h), n: Math.sin(d) * Math.cos(LAT) - Math.cos(d) * Math.sin(LAT) * Math.cos(h), u: Math.sin(d) * Math.sin(LAT) + Math.cos(d) * Math.cos(LAT) * Math.cos(h) };
  }
  function irr(u){                                  // clear-sky beam and diffuse on the horizontal
    if (u <= 0.01) return { b: 0, d: 0 };
    const el = Math.asin(u) / D2R, am = 1 / (u + 0.50572 * Math.pow(6.07995 + el, -1.6364)), t = Math.pow(0.7, Math.pow(am, 0.678));
    return { b: 1361 * t * u, d: 0.3 * (1 - t) * 1361 * u };
  }
  const SKY = [];                                   // cosine-weighted hemisphere, stratified, projected to the module plane
  for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++){
    const u1 = (i + .5) / 12, u2 = (j + .5) / 8 + (i % 2) * .06, r = Math.sqrt(u1), ph = 2 * Math.PI * u2, dz = Math.sqrt(1 - u1);
    SKY.push([r * Math.cos(ph) * H / dz, r * Math.sin(ph) * H / dz]);
  }
  const svfAt = (x, y) => { let o = 0; for (const d of SKY) if (!inRow(x + d[0], y + d[1])) o++; return o / SKY.length; };
  // season-mean daily light, relative to an unobstructed point, sampled on four days
  const DAYS = [5, 40, 75, 110].map(dd => {
    const d = decl(dd), steps = [];
    for (let t = 5; t <= 19; t += .5){ const s = sunVec(t, d), I = irr(s.u); if (I.b + I.d > 0) steps.push([s.e / s.u * H, s.n / s.u * H, I.b, I.d]); }
    return steps;
  });
  function seasonLight(x, y, svf){
    let num = 0, den = 0;
    for (const steps of DAYS) for (const [kx, ky, b, d] of steps){ num += b * (inRow(x + kx, y + ky) ? 0 : 1) + d * svf; den += b + d; }
    return num / den;
  }

  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  /* ── ground points ── */
  const T0 = performance.now();
  const GS = small ? 0.9 : 0.62, OS = small ? 2.2 : 1.5, ground = [];
  for (let y = -44; y <= 44; y += GS) for (let x = -64; x <= 64; x += GS){
    const jx = x + (rnd() - .5) * GS * .4, jy = y + (rnd() - .5) * GS * .4; ground.push(jx, jy, svfAt(jx, jy));
  }
  for (let y = -120; y <= 120; y += OS) for (let x = -150; x <= 150; x += OS){       // open ground out to the horizon
    if (Math.abs(x) <= 64.5 && Math.abs(y) <= 44.5) continue;
    ground.push(x + (rnd() - .5) * OS * .5, y + (rnd() - .5) * OS * .5, 2);   // 2 flags open ground
  }
  const groundArr = new Float32Array(ground), NG = ground.length / 3;

  /* ── plants: beds along x, every 0.9 m; one plant every 0.75 m; 10 points each (2 stem, 8 canopy) ── */
  const BED = small ? 1.2 : 0.9, STEP = small ? 1.0 : 0.75, PER = 10;
  const plants = [];                                 // [x, y, L, var, zone]
  for (let y = -40.5; y <= 40.5 + 1e-6; y += BED) for (let x = -55; x <= 55 + 1e-6; x += STEP){
    const jx = x + (rnd() - .5) * .18, jy = y + (rnd() - .5) * .12;
    const L = seasonLight(jx, jy, svfAt(jx, jy));
    const zone = Math.abs(jx) > 49 ? 3 : (Math.abs(jx) < AX - 6 && Math.abs(jy) < 34) ? 1 : 0;   // 3 open field, 1 array interior
    plants.push([jx, jy, L, .92 + rnd() * .16, zone]);
  }
  // inside the array, split by light: the dimmest third and the brightest third
  const inner = plants.filter(p => p[4] === 1).map(p => p[2]).sort((a, b) => a - b);
  const q1 = inner[Math.floor(inner.length / 3)], q2 = inner[Math.floor(inner.length * 2 / 3)];
  plants.forEach(p => { if (p[4] === 1) p[4] = p[2] <= q1 ? 1 : p[2] >= q2 ? 2 : 4; });   // 1 shaded band, 2 lit band, 4 middle
  const pA = new Float32Array(plants.length * PER * 4), pB = new Float32Array(plants.length * PER * 4);
  plants.forEach((p, i) => {
    for (let k = 0; k < PER; k++){
      const o = (i * PER + k) * 4;
      pA[o] = p[0]; pA[o + 1] = p[1]; pA[o + 2] = p[2]; pA[o + 3] = p[3];
      if (k < 2){ pB[o] = 0; pB[o + 1] = 0; pB[o + 2] = k ? .55 : .1; pB[o + 3] = 0; }
      else {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()), z = rnd() * 2 - .55;
        pB[o] = Math.cos(a) * r; pB[o + 1] = Math.sin(a) * r * .8; pB[o + 2] = z; pB[o + 3] = 1;
      }
    }
  });
  const NP = plants.length * PER;

  // growth: a logistic clock that runs at the plant's relative light
  const K = 7, MID = .4, C0 = 1 / (1 + Math.exp(K * MID)), C1 = 1 / (1 + Math.exp(-K * (1 - MID)));
  const grow = (s, L) => Math.max(0, Math.min(1, (1 / (1 + Math.exp(-K * (s * L - MID))) - C0) / (C1 - C0)));
  const zoneOf = (z) => plants.filter(p => p[4] === z);
  const Z = { shade: zoneOf(1), lit: zoneOf(2), open: zoneOf(3), array: plants.filter(p => p[4] !== 3 && Math.abs(p[0]) <= AX) };
  const mean = (arr, f) => arr.reduce((s, p) => s + f(p), 0) / Math.max(1, arr.length);
  const CURVES = { shade: [], lit: [], open: [] };
  for (let i = 0; i <= 60; i++){ const s = i / 60; for (const k in CURVES) CURVES[k].push(mean(Z[k], p => grow(s, p[2] * p[3]))); }
  const ratio = mean(Z.array, p => p[2]) / mean(Z.open, p => p[2]);

  /* ── lines: posts, table outlines, cell seams, graticule ── */
  const lines = [];                                  // x y z a
  const L2 = (a, b, al) => { lines.push(a[0], a[1], a[2], al, b[0], b[1], b[2], al); };
  for (let i = 0; i < NROW; i++){
    const yc = Y0 + i * PITCH, s = [yc - W2, H + .3], n = [yc + W2, H - .3];
    for (let x = -AX; x <= AX + 1e-6; x += 7.5) L2([x, yc, 0], [x, yc, H], .16);
    L2([-AX, s[0], s[1]], [AX, s[0], s[1]], .34); L2([-AX, n[0], n[1]], [AX, n[0], n[1]], .34);
    L2([-AX, s[0], s[1]], [-AX, n[0], n[1]], .34); L2([AX, s[0], s[1]], [AX, n[0], n[1]], .34);
    for (let x = -AX + 2.25; x < AX; x += 2.25) L2([x, s[0], s[1]], [x, n[0], n[1]], .07);
    L2([-AX, yc, H], [AX, yc, H], .06);
  }
  for (let g = -60; g <= 60; g += 10){ L2([g, -44, 0], [g, 44, 0], .035); }
  for (let g = -40; g <= 40; g += 10){ L2([-64, g, 0], [64, g, 0], .035); }
  L2([58, 30, 0], [58, 40, 0], .5); L2([58, 40, 0], [56.8, 37.6, 0], .5); L2([58, 40, 0], [59.2, 37.6, 0], .5);   // north arrow
  const NL = lines.length / 4;
  const panels = [];
  for (let i = 0; i < NROW; i++){
    const yc = Y0 + i * PITCH, a = [-AX, yc - W2, H + .3], b = [AX, yc - W2, H + .3], c = [AX, yc + W2, H - .3], d = [-AX, yc + W2, H - .3];
    panels.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const NPAN = panels.length / 3;

  /* ── shaders ── */
  const ROW_GLSL = `
    const float AX=${AX.toFixed(1)}, W2=${W2.toFixed(3)}, PITCH=${PITCH.toFixed(1)}, Y0=${Y0.toFixed(1)}, H=${H.toFixed(2)};
    float inRow(vec2 p){
      if (abs(p.x) > AX) return 0.;
      float c = floor((p.y - Y0) / PITCH + .5);
      if (c < 0. || c > ${NROW - 1}.) return 0.;
      return step(abs(p.y - (Y0 + PITCH * c)), W2);
    }`;
  const COMMON = `
    precision highp float;
    uniform mat4 uVP; uniform vec3 uEye, uSun; uniform vec2 uIrr; uniform float uPx, uReveal, uScan, uFogN, uFogF;
    ${ROW_GLSL}
    float fog(vec3 w){ return 1. - .82 * smoothstep(uFogN, uFogF, distance(uEye, w)); }
    float reveal(vec2 p){ return smoothstep(uReveal, uReveal - 18., length(p * vec2(1., 1.3))); }
    float scan(vec2 p){ float d = dot(p, vec2(.8, .6)) - uScan; return exp(-d * d / 5.); }`;
  const VS_GROUND = COMMON + `
    attribute vec3 aP; varying vec4 vC;
    void main(){
      vec3 w = vec3(aP.xy, 0.); gl_Position = uVP * vec4(w, 1.);
      float ref = uIrr.x + uIrr.y, v;
      float svf = min(aP.z, 1.), outer = step(1.5, aP.z);
      if (ref > 0.){ vec2 o = uSun.xy / max(uSun.z, .03) * H; v = (uIrr.x * (1. - inRow(aP.xy + o)) + uIrr.y * svf) / ref; }
      else v = svf * .16;
      vec3 a = vec3(.24, .29, .37), b = vec3(.62, .66, .72), c = vec3(1., .93, .78);
      vec3 col = v < .55 ? mix(a, b, v / .55) : mix(b, c, (v - .55) / .45);
      float sc = scan(aP.xy);
      col = mix(col, vec3(.24, .73, .49), sc * .5);
      float al = (ref > 0. ? .22 + .55 * v : .2) + sc * .25;
      vC = vec4(col, al * fog(w) * reveal(aP.xy) * (1. - outer * .62));
      gl_PointSize = max(1., uPx * (.42 - outer * .12) / gl_Position.w);
    }`;
  const FS_SQ = `precision mediump float; varying vec4 vC; void main(){ gl_FragColor = vC; }`;
  const VS_PLANT = COMMON + `
    attribute vec4 aA; attribute vec4 aB; uniform float uSeason, uTime; varying vec4 vC;
    const float K = ${K.toFixed(1)}, MID = ${MID.toFixed(2)}, C0 = ${C0.toFixed(6)}, C1 = ${C1.toFixed(6)};
    float grow(float s, float L){ return clamp((1. / (1. + exp(-K * (s * L - MID))) - C0) / (C1 - C0), 0., 1.); }
    void main(){
      float g = grow(uSeason, aA.z * aA.w);
      float emerge = smoothstep(.0, .05, uSeason - (aA.w - .92) * .25);
      float h = .82 * g, r = .44 * pow(g, .8) + .02;
      vec3 p = vec3(aA.xy, 0.);
      if (aB.w < .5) p.z = aB.z * h;
      else { p.xy += aB.xy * r; p.z = h * .5 + aB.z * r * .7; }
      float sway = .06 * g * clamp(p.z / (h + .01), 0., 1.);
      p.xy += sway * vec2(sin(uTime * 1.1 + aA.x * .35 + aA.y * .21), cos(uTime * .87 + aA.y * .3 - aA.x * .1));
      p.z = max(p.z, .02);
      gl_Position = uVP * vec4(p, 1.);
      vec3 young = vec3(.24, .73, .49), mature = vec3(.2, .52, .3), ripe = vec3(.86, .7, .32);
      vec3 col = mix(young, mature, smoothstep(.12, .75, g));
      col = mix(col, ripe, smoothstep(.8, 1., uSeason) * g * .75);
      float ref = uIrr.x + uIrr.y, lit = 1.;
      if (ref > 0.) lit = (uIrr.x * (1. - inRow(p.xy + uSun.xy / max(uSun.z, .03) * (H - p.z))) + uIrr.y * .7) / ref;
      else lit = .28;
      col *= (.42 + .7 * lit) * (aB.w < .5 ? .7 : .78 + .3 * clamp(aB.z, 0., 1.));
      col = mix(col, vec3(.24, .73, .49), scan(aA.xy) * .35);
      vC = vec4(col, (.35 + .6 * g) * emerge * fog(p) * reveal(aA.xy));
      gl_PointSize = max(1., uPx * (.07 + .17 * g) / gl_Position.w) * emerge;
    }`;
  const FS_RND = `precision mediump float; varying vec4 vC;
    void main(){ vec2 c = gl_PointCoord - .5; float d = dot(c, c); if (d > .25) discard; gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(.25, .12, d)); }`;
  const VS_LINE = COMMON + `
    attribute vec4 aL; varying vec4 vC;
    void main(){ vec3 w = aL.xyz; gl_Position = uVP * vec4(w, 1.); vC = vec4(.86, .9, .96, aL.w * fog(w) * reveal(w.xy)); }`;
  const VS_PANEL = COMMON + `
    attribute vec3 aP; varying vec4 vC;
    void main(){
      gl_Position = uVP * vec4(aP, 1.);
      vec3 n = normalize(vec3(0., .6, ${(2 * W2).toFixed(3)}));
      vec3 v = normalize(uEye - aP), r = reflect(-normalize(uSun), n);
      float glint = uSun.z > 0. ? pow(max(dot(r, v), 0.), 60.) : 0.;
      float sky = .5 + .5 * n.z;
      vec3 col = vec3(.035, .05, .08) * sky + vec3(1., .93, .8) * glint * .9;
      vC = vec4(col, (.78 + glint * .2) * fog(aP) * reveal(aP.xy));
    }`;
  const VS_SUN = `precision highp float; uniform mat4 uVP; uniform vec3 uPos; uniform float uSize; void main(){ gl_Position = uVP * vec4(uPos, 1.); gl_PointSize = uSize; }`;
  const FS_SUN = `precision mediump float; uniform float uA;
    void main(){ vec2 c = gl_PointCoord - .5; float d = length(c) * 2.; float core = smoothstep(.09, .06, d); float halo = pow(max(0., 1. - d), 3.) * .42;
      gl_FragColor = vec4(mix(vec3(.95, .64, .11), vec3(1., .86, .55), core), (core + halo) * uA); }`;
  const VS_RAY = `precision highp float; uniform mat4 uVP; attribute vec4 aL; varying float vA; void main(){ gl_Position = uVP * vec4(aL.xyz, 1.); gl_PointSize = 5.; vA = aL.w; }`;
  const FS_RAY = `precision mediump float; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA); }`;
  const VS_PATH = `precision highp float; uniform mat4 uVP; attribute vec4 aL; varying float vA; void main(){ gl_Position = uVP * vec4(aL.xyz, 1.); gl_PointSize = 2.; vA = aL.w; }`;
  const FS_PATH = `precision mediump float; varying float vA; void main(){ gl_FragColor = vec4(1., 1., 1., vA); }`;

  function prog(vs, fs){
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++){ const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  let P;
  try {
    P = { ground: prog(VS_GROUND, FS_SQ), plant: prog(VS_PLANT, FS_RND), line: prog(VS_LINE, FS_SQ), panel: prog(VS_PANEL, FS_SQ), sun: prog(VS_SUN, FS_SUN), path: prog(VS_PATH, FS_PATH), ray: prog(VS_RAY, FS_RAY) };
  } catch (e){ console.warn('field3d:', e.message); host.classList.add('is-nogl'); return; }
  const buf = (data) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
  const B = { ground: buf(groundArr), pA: buf(pA), pB: buf(pB), lines: buf(new Float32Array(lines)), panels: buf(new Float32Array(panels)), path: gl.createBuffer(), ray: gl.createBuffer() };
  // shadow-ray probes: a few ground points whose ray to the sun is drawn, lit or blocked
  const PROBES = [];
  for (const [x, k] of [[-30, 2], [-12, 5], [6, 3], [24, 6], [-21, 7], [15, 1], [33, 4], [-3, 6]]){ const yc = Y0 + k * PITCH; PROBES.push([x, yc - 3.1], [x + 5, yc + 1.4]); }
  host.dataset.ms = Math.round(performance.now() - T0);
  const attr = (pr, name, b, size) => { const l = gl.getAttribLocation(pr.p, name); if (l < 0) return -1; gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); return l; };
  let enabled = [];
  const use = (pr, binds) => { enabled.forEach(l => gl.disableVertexAttribArray(l)); enabled = []; gl.useProgram(pr.p); binds.forEach(([n, b, s]) => { const l = attr(pr, n, b, s); if (l >= 0) enabled.push(l); }); };

  /* ── camera ── */
  const KEYS = [   // p, azimuth, elevation°, distance, target x y z
    [0.00, .52, 25, 132, 0, 2, 0],
    [0.24, .80, 15, 98, 0, -4, 0],
    [0.50, 1.08, 8.5, 60, 6, -8, .6],
    [0.76, 1.42, 11, 74, 2, -4, .4],
    [1.00, 1.78, 31, 124, 0, 0, 0],
  ];
  const ease = (t) => t * t * (3 - 2 * t);
  function camAt(p){
    let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = ease(Math.max(0, Math.min(1, (p - a[0]) / (b[0] - a[0]))));
    return a.map((v, k) => v + (b[k] - v) * t);
  }
  function mats(eye, tgt, fovy, aspect){
    const f = [tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]], fl = Math.hypot(...f); f.forEach((_, i) => f[i] /= fl);
    let s = [f[1], -f[0], 0]; const sl = Math.hypot(...s); s = s.map(v => v / sl);
    const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const V = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0,
      -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
    const n = 1, fa = 600, t = 1 / Math.tan(fovy / 2);
    const Pm = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
    Pm[9] += VSHIFT;                                  // off-axis: push the field down the frame
    const M = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){ let v = 0; for (let k = 0; k < 4; k++) v += Pm[k * 4 + r] * V[c * 4 + k]; M[c * 4 + r] = v; }
    return M;
  }
  const project = (M, x, y, z) => {
    const cx = M[0] * x + M[4] * y + M[8] * z + M[12], cy = M[1] * x + M[5] * y + M[9] * z + M[13], cw = M[3] * x + M[7] * y + M[11] * z + M[15];
    if (cw <= 0.5) return null; return [(cx / cw * .5 + .5) * W / dpr, (1 - (cy / cw * .5 + .5)) * Ht / dpr];
  };

  /* ── sizing ── */
  let W = 1, Ht = 1, dpr = 1, VSHIFT = 0;
  function size(){
    const r = host.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
    W = Math.max(1, Math.round(r.width * dpr)); Ht = Math.max(1, Math.round(r.height * dpr));
    cv.width = W; cv.height = Ht; gl.viewport(0, 0, W, Ht);
    VSHIFT = r.width > 980 ? .0 : -.2;
  }

  /* ── scroll state ── */
  let pTarget = 0, pS = 0, pointer = 0, pointerS = 0;
  function readScroll(){
    const r = hero.getBoundingClientRect(), span = r.height - innerHeight;
    pTarget = span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
  }
  addEventListener('scroll', readScroll, { passive: true });
  hero.addEventListener('pointermove', e => { pointer = e.clientX / innerWidth - .5; }, { passive: true });

  const chapters = [...hero.querySelectorAll('[data-ch]')].map(el => ({ el, a: +el.dataset.from, b: +el.dataset.to }));
  const anchors = [...hero.querySelectorAll('[data-anchor]')];
  anchors.forEach(a => {                            // the least-lit label sits on a real plant of that band
    if (a.dataset.anchor !== 'shade') return;
    let best = null, bd = 1e9;
    for (const p of Z.shade){ const d = Math.hypot(p[0] - 14, p[1] + 6); if (d < bd){ bd = d; best = p; } }
    if (best) a.dataset.anchor = best[0].toFixed(2) + ',' + best[1].toFixed(2) + ',0.9'; else a.remove();
  });
  const timeCursor = $('[data-season-cursor]'), timeDay = $('[data-season-day]');
  const spark = $('[data-spark]'), sctx = spark && spark.getContext('2d');
  let sparkKey = -1;
  function drawSpark(s){
    if (!sctx) return;
    const k = Math.round(s * 200); if (k === sparkKey) return; sparkKey = k;
    const w = spark.width = spark.clientWidth * 2, h = spark.height = spark.clientHeight * 2;
    sctx.clearRect(0, 0, w, h);
    sctx.strokeStyle = 'rgba(255,255,255,.07)'; sctx.lineWidth = 1;
    for (let i = 1; i < 4; i++){ sctx.beginPath(); sctx.moveTo(0, h * i / 4); sctx.lineTo(w, h * i / 4); sctx.stroke(); }
    const line = (arr, col, dash) => {
      sctx.strokeStyle = col; sctx.lineWidth = 2.2; sctx.setLineDash(dash || []); sctx.beginPath();
      arr.forEach((v, i) => { const x = i / 60 * w, y = h - 4 - v * (h - 10); i ? sctx.lineTo(x, y) : sctx.moveTo(x, y); }); sctx.stroke(); sctx.setLineDash([]);
    };
    line(CURVES.open, 'rgba(228,230,234,.55)', [4, 5]); line(CURVES.lit, 'rgba(108,196,124,.9)'); line(CURVES.shade, 'rgba(61,187,126,.95)');
    sctx.fillStyle = 'rgba(4,5,6,.6)'; sctx.fillRect(s * w, 0, w - s * w, h);
    sctx.strokeStyle = 'rgba(255,255,255,.6)'; sctx.beginPath(); sctx.moveTo(s * w, 0); sctx.lineTo(s * w, h); sctx.stroke();
  }

  /* ── frame ── */
  let hours = 7.4, season = 0, auto = 0, autoDir = 1, hold = 0, last = 0, frame = 0, raf = 0, visible = true, revealT = reduce ? 1 : 0, scanT = -120;
  function render(now, dt){
    pS += (pTarget - pS) * Math.min(1, dt * 5.5);
    pointerS += (pointer - pointerS) * Math.min(1, dt * 2.5);
    // season: plays on its own at the top, then the scroll takes over
    if (!reduce){
      if (hold > 0) hold -= dt;
      else { auto += autoDir * dt / (autoDir > 0 ? 24 : 2.6); if (auto >= 1){ auto = 1; hold = 3; autoDir = -1; } else if (auto <= 0){ auto = 0; hold = .8; autoDir = 1; } }
    }
    const w = ease(Math.max(0, Math.min(1, (pS - .02) / .12)));
    const sScroll = Math.max(0, Math.min(1, (pS - .14) / .74));
    season = reduce ? .62 : auto * (1 - w) + sScroll * w;
    const day = season * SEASON_DAYS, d = decl(day);
    const s = sunVec(hours, d), I = irr(s.u), up = s.u > .01;

    const c = camAt(pS), az = c[1] + (reduce ? 0 : Math.sin(now / 21000) * .1) + pointerS * .22, el = c[2] * D2R;
    const tgt = [c[4], c[5], c[6]], eye = [tgt[0] + c[3] * Math.cos(el) * Math.sin(az), tgt[1] - c[3] * Math.cos(el) * Math.cos(az), tgt[2] + c[3] * Math.sin(el)];
    const aspect = W / Ht, fovy = 2 * Math.atan(Math.tan(17 * D2R) * Math.max(1, 1.25 / aspect));
    const M = mats(eye, tgt, Math.min(fovy, 80 * D2R), aspect);
    const px = Ht / (2 * Math.tan(fovy / 2));
    revealT = Math.min(1, revealT + dt / 3.2);
    const rev = 8 + 150 * ease(revealT);
    scanT += dt * 24; if (scanT > 150) scanT = -150;

    gl.clearColor(.016, .02, .024, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const setCommon = (pr) => {
      const u = pr.u;
      u.uVP && gl.uniformMatrix4fv(u.uVP, false, M); u.uEye && gl.uniform3fv(u.uEye, eye);
      u.uSun && gl.uniform3f(u.uSun, s.e, s.n, s.u); u.uIrr && gl.uniform2f(u.uIrr, I.b, I.d);
      u.uPx && gl.uniform1f(u.uPx, px); u.uReveal && gl.uniform1f(u.uReveal, rev); u.uScan && gl.uniform1f(u.uScan, scanT);
      u.uFogN && gl.uniform1f(u.uFogN, c[3] * .55); u.uFogF && gl.uniform1f(u.uFogF, c[3] * 1.9);
    };
    // sun path for today, dotted
    const path = [];
    for (let h = 5; h <= 19.01; h += .2){ const v = sunVec(h, d); if (v.u > 0) path.push(v.e * 110 + tgt[0], v.n * 110 + tgt[1], v.u * 110, .16); }
    gl.disable(gl.DEPTH_TEST);
    use(P.path, []); gl.bindBuffer(gl.ARRAY_BUFFER, B.path); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(path), gl.DYNAMIC_DRAW);
    const lp = gl.getAttribLocation(P.path.p, 'aL'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 4, gl.FLOAT, false, 0, 0); enabled.push(lp);
    gl.uniformMatrix4fv(P.path.u.uVP, false, M); gl.drawArrays(gl.POINTS, 0, path.length / 4);
    if (up){
      use(P.sun, []); gl.uniformMatrix4fv(P.sun.u.uVP, false, M);
      gl.uniform3f(P.sun.u.uPos, s.e * 110 + tgt[0], s.n * 110 + tgt[1], s.u * 110); gl.uniform1f(P.sun.u.uSize, 150 * dpr); gl.uniform1f(P.sun.u.uA, Math.min(1, s.u * 6));
      gl.drawArrays(gl.POINTS, 0, 1);
    }
    use(P.ground, [['aP', B.ground, 3]]); setCommon(P.ground); gl.drawArrays(gl.POINTS, 0, NG);
    use(P.line, [['aL', B.lines, 4]]); setCommon(P.line); gl.drawArrays(gl.LINES, 0, NL);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    use(P.plant, [['aA', B.pA, 4], ['aB', B.pB, 4]]); setCommon(P.plant);
    gl.uniform1f(P.plant.u.uSeason, season); gl.uniform1f(P.plant.u.uTime, now / 1000);
    gl.drawArrays(gl.POINTS, 0, NP);
    gl.depthMask(false);
    use(P.panel, [['aP', B.panels, 3]]); setCommon(P.panel); gl.drawArrays(gl.TRIANGLES, 0, NPAN);
    gl.depthMask(true);
    if (up){
      const lit = [], hit = [], dots = [], kx = s.e / s.u, ky = s.n / s.u, rl = (H + 3) / s.u, fa = Math.min(1, s.u * 5) * (.3 + .7 * Math.max(0, Math.min(1, (pS - .1) / .15)));
      for (const [x, y] of PROBES){
        if (inRow(x + kx * H, y + ky * H)){ hit.push(x, y, 0, .5 * fa, x + kx * H, y + ky * H, H, .5 * fa); dots.push(x + kx * H, y + ky * H, H + .05, .9 * fa); }
        else lit.push(x, y, 0, .4 * fa, x + s.e * rl, y + s.n * rl, s.u * rl, 0);
      }
      gl.disable(gl.DEPTH_TEST);
      const drawRay = (arr, mode, col) => {
        if (!arr.length) return;
        use(P.ray, []); gl.bindBuffer(gl.ARRAY_BUFFER, B.ray); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
        const l = gl.getAttribLocation(P.ray.p, 'aL'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 0, 0); enabled.push(l);
        gl.uniformMatrix4fv(P.ray.u.uVP, false, M); gl.uniform3fv(P.ray.u.uCol, col); gl.drawArrays(mode, 0, arr.length / 4);
      };
      drawRay(lit, gl.LINES, [1, .9, .66]); drawRay(hit, gl.LINES, [.55, .64, .78]); drawRay(dots, gl.POINTS, [.95, .5, .45]);
    }

    // overlays, a few times a second for text; every frame for positions
    chapters.forEach(ch => {
      const fadeIn = ch.a <= 0 ? 1 : ease(Math.max(0, Math.min(1, (pS - ch.a) / .05)));
      const fadeOut = ch.b >= 1 ? 1 : ease(Math.max(0, Math.min(1, (ch.b - pS) / .05)));
      const o = Math.min(fadeIn, fadeOut);
      ch.el.style.opacity = o.toFixed(3);
      ch.el.style.filter = o < .999 ? 'blur(' + ((1 - o) * 6).toFixed(2) + 'px)' : '';
      ch.el.style.visibility = o < .01 ? 'hidden' : 'visible';
    });
    const showLabels = Math.max(0, Math.min(1, (pS - .12) / .06)) * Math.max(0, Math.min(1, (.97 - pS) / .05));
    anchors.forEach(a => {
      const at = a.dataset.anchor.split(',').map(Number), q = project(M, at[0], at[1], at[2]);
      if (!q){ a.style.opacity = 0; return; }
      a.style.transform = 'translate3d(' + q[0].toFixed(1) + 'px,' + q[1].toFixed(1) + 'px,0)'; a.style.opacity = showLabels.toFixed(3);
    });
    if (timeCursor) timeCursor.style.transform = 'scaleX(' + season.toFixed(4) + ')';
    if (frame++ % 6 === 0){
      const set = (k, v) => { HUD[k] = HUD[k] || [...hero.querySelectorAll('[data-hud="' + k + '"]')]; HUD[k].forEach(e => { if (e.textContent !== v) e.textContent = v; }); };
      const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
      set('day', Math.round(day) + ' of ' + SEASON_DAYS);
      if (timeDay) timeDay.textContent = 'Day ' + Math.round(day);
      set('time', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + (up ? ' · ' + (Math.asin(s.u) / D2R).toFixed(1) + '°' : ' · night'));
      if (up){
        let lit = 0, n = 0; const kx = s.e / s.u * H, ky = s.n / s.u * H;
        for (let i = 0; i < Z.array.length; i += 7){ const p = Z.array[i]; lit += (I.b * (inRow(p[0] + kx, p[1] + ky) ? 0 : 1) + I.d * .72) / (I.b + I.d); n++; }
        set('light', Math.round(lit / n * 100) + '% of open');
      } else set('light', '—');
      const ch = (zone) => (mean(Z[zone], p => grow(season, p[2] * p[3])) * .82).toFixed(2) + ' m';
      set('h-shade', ch('shade')); set('h-lit', ch('lit')); set('h-open', ch('open'));
      set('ratio', ratio.toFixed(2));
      drawSpark(season);
    }
  }
  function loop(ts){
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = last ? Math.min(.08, (ts - last) / 1000) : .016; last = ts;
    if (!reduce){ hours += dt * .62; if (hours > 19.2) hours = 5.2; }
    render(ts, dt);
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf){ last = 0; raf = requestAnimationFrame(loop); } };
  new ResizeObserver(() => { size(); if (reduce || !raf) render(performance.now(), .016); }).observe(host);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !reduce) start(); }, { threshold: 0 }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduce) start(); });
  size(); readScroll();
  if (reduce){ hours = 10.6; pS = pTarget; render(performance.now(), 1); addEventListener('scroll', () => { pS = pTarget; render(performance.now(), 1); }, { passive: true }); }
  else start();
  host.classList.add('is-on');
  };
  requestAnimationFrame(() => setTimeout(run, 30));
})();
