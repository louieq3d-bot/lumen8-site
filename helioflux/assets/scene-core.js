/* Scene core — the point-cloud renderer behind every page header that has [data-scene].
   Everything is drawn as points (ground, structure, plants, rays), in the same language as the home-page field.
   A scene file registers itself with AGVScene.register(name, setup); setup(api) adds layers and returns a frame(t, dt, k)
   callback. Layers hold xyz, rgba and size (metres) per point; dynamic layers are re-uploaded when marked dirty.
   The core owns the canvas, resizing, the camera, fog, reveal, pointer sway, visibility and reduced motion. */
(function(){
  'use strict';
  const SCENES = {};
  const D2R = Math.PI / 180;
  const util = {
    D2R,
    // unit vector to the sun: e east, n north, u up
    sun(hours, declDeg, latDeg){
      const h = 15 * (hours - 12) * D2R, d = declDeg * D2R, p = latDeg * D2R;
      return { e: -Math.cos(d) * Math.sin(h), n: Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(h), u: Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(h) };
    },
    // clear-sky beam and diffuse on the horizontal, W/m²
    irr(u){
      if (u <= .01) return { b: 0, d: 0 };
      const el = Math.asin(u) / D2R, am = 1 / (u + .50572 * Math.pow(6.07995 + el, -1.6364)), t = Math.pow(.7, Math.pow(am, .678));
      return { b: 1361 * t * u, d: .3 * (1 - t) * 1361 * u };
    },
    // shade is cold slate, light is warm white (the home-page ramp)
    ramp(v){
      const a = [.24, .29, .37], b = [.62, .66, .72], c = [1, .93, .78];
      const m = (p, q, t) => p.map((x, i) => x + (q[i] - x) * t);
      return v < .55 ? m(a, b, v / .55) : m(b, c, (v - .55) / .45);
    },
    // does the ray from o along d hit the quad with corner q0 and edges e1, e2 (parallelogram)?  returns t or -1
    hitQuad(o, d, q0, e1, e2){
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]; if (Math.abs(dn) < 1e-9) return -1;
      const w = [q0[0] - o[0], q0[1] - o[1], q0[2] - o[2]], t = (w[0] * n[0] + w[1] * n[1] + w[2] * n[2]) / dn; if (t <= 1e-4) return -1;
      const p = [o[0] + d[0] * t - q0[0], o[1] + d[1] * t - q0[1], o[2] + d[2] * t - q0[2]];
      const e11 = e1[0] * e1[0] + e1[1] * e1[1] + e1[2] * e1[2], e22 = e2[0] * e2[0] + e2[1] * e2[1] + e2[2] * e2[2], e12 = e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2];
      const p1 = p[0] * e1[0] + p[1] * e1[1] + p[2] * e1[2], p2 = p[0] * e2[0] + p[1] * e2[1] + p[2] * e2[2], det = e11 * e22 - e12 * e12;
      const a = (p1 * e22 - p2 * e12) / det, b = (p2 * e11 - p1 * e12) / det;
      return a >= 0 && a <= 1 && b >= 0 && b <= 1 ? t : -1;
    },
    ease: (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    rng(seed){ let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; },
  };
  window.AGVScene = { util, register(name, setup){ SCENES[name] = setup; boot(name); } };

  const VS = `precision highp float;
    attribute vec3 aP; attribute vec4 aC; attribute float aS;
    uniform mat4 uVP; uniform vec3 uEye; uniform float uPx, uFogN, uFogF, uReveal, uAlpha;
    varying vec4 vC;
    void main(){
      gl_Position = uVP * vec4(aP, 1.);
      float fog = 1. - .85 * smoothstep(uFogN, uFogF, distance(uEye, aP));
      float rv = smoothstep(uReveal, uReveal - 14., length(aP.xy));
      vC = vec4(aC.rgb, aC.a * fog * rv * uAlpha);
      gl_PointSize = max(1., uPx * aS / gl_Position.w);
    }`;
  const FS = `precision mediump float; varying vec4 vC; uniform float uRound;
    void main(){
      vec2 c = gl_PointCoord - .5; float d = dot(c, c);
      if (uRound > .5 && d > .25) discard;
      gl_FragColor = vec4(vC.rgb, vC.a * (uRound > .5 ? smoothstep(.25, .1, d) : 1.));
    }`;

  function boot(name){
    const host = document.querySelector('[data-scene="' + name + '"]');
    if (!host || host.dataset.booted) return;
    host.dataset.booted = '1';
    const start = () => setTimeout(() => init(host, SCENES[name]), 30);
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => requestAnimationFrame(start)); else requestAnimationFrame(start);
  }

  function init(host, setup){
    const stage = host.closest('[data-stage]') || host.parentElement;
    const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    const gl = cv.getContext('webgl', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' });
    if (!gl){ host.classList.add('is-nogl'); return; }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = Math.min(innerWidth, innerHeight) < 640;
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    const U = {}; ['uVP', 'uEye', 'uPx', 'uFogN', 'uFogF', 'uReveal', 'uAlpha', 'uRound'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
    const A = { p: gl.getAttribLocation(pr, 'aP'), c: gl.getAttribLocation(pr, 'aC'), s: gl.getAttribLocation(pr, 'aS') };

    const layers = [];
    const api = {
      small, reduce, host, stage,
      cam: { az: .6, el: 24, dist: 120, tx: 0, ty: 0, tz: 0, fov: 34, shift: 0, sway: .1 },
      fog: [.6, 1.9],
      // a layer: { n, p: Float32Array(3n), c: Float32Array(4n), s: Float32Array(n), round, depth, alpha, dirty }
      layer(n, opts = {}){
        const L = Object.assign({ n, count: n, p: new Float32Array(n * 3), c: new Float32Array(n * 4), s: new Float32Array(n).fill(.3), round: false, depth: false, alpha: 1, dirty: true, visible: true, add: false }, opts);
        L.bp = gl.createBuffer(); L.bc = gl.createBuffer(); L.bs = gl.createBuffer();
        layers.push(L); return L;
      },
      project: null,
      readout(k, v){ (api._ro[k] = api._ro[k] || [...stage.querySelectorAll('[data-ro="' + k + '"]')]).forEach(e => { if (e.textContent !== v) e.textContent = v; }); },
      _ro: {},
    };
    let frame;
    try { frame = setup(api); } catch (e){ console.warn('scene:', e); host.classList.add('is-nogl'); return; }

    let W = 1, H = 1, dpr = 1;
    function size(){
      const r = host.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
      W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
      cv.width = W; cv.height = H; gl.viewport(0, 0, W, H);
    }
    let pointer = 0, pointerS = 0, scrollK = 0;
    stage.addEventListener('pointermove', e => { pointer = e.clientX / innerWidth - .5; }, { passive: true });
    const readScroll = () => { const r = stage.getBoundingClientRect(); scrollK = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height))); };
    addEventListener('scroll', readScroll, { passive: true });

    function matrices(){
      const c = api.cam, D2R = Math.PI / 180, az = c.az + pointerS * c.sway * 2, el = c.el * D2R;
      const tgt = [c.tx, c.ty, c.tz], eye = [c.tx + c.dist * Math.cos(el) * Math.sin(az), c.ty - c.dist * Math.cos(el) * Math.cos(az), c.tz + c.dist * Math.sin(el)];
      const f = [tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]], fl = Math.hypot(...f); f.forEach((_, i) => f[i] /= fl);
      let s = [f[1], -f[0], 0]; const sl = Math.hypot(...s) || 1; s = s.map(v => v / sl);
      const u = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
      const V = [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0,
        -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]), -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]), f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2], 1];
      const aspect = W / H, fovy = Math.min(2 * Math.atan(Math.tan(c.fov / 2 * D2R) * Math.max(1, 1.3 / aspect)), 80 * D2R), n = .5, fa = 900, t = 1 / Math.tan(fovy / 2);
      const P = [t / aspect, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
      P[8] -= c.shiftX || 0; P[9] += c.shift || 0;
      const M = new Float32Array(16);
      for (let ci = 0; ci < 4; ci++) for (let r = 0; r < 4; r++){ let v = 0; for (let k = 0; k < 4; k++) v += P[k * 4 + r] * V[ci * 4 + k]; M[ci * 4 + r] = v; }
      return { M, eye, px: H / (2 * Math.tan(fovy / 2)) };
    }
    const projector = (M) => (x, y, z) => {
      const cx = M[0] * x + M[4] * y + M[8] * z + M[12], cy = M[1] * x + M[5] * y + M[9] * z + M[13], cw = M[3] * x + M[7] * y + M[11] * z + M[15];
      if (cw <= .5) return null; return [(cx / cw * .5 + .5) * W / dpr, (1 - (cy / cw * .5 + .5)) * H / dpr];
    };

    let revealT = reduce ? 1 : 0, last = 0, raf = 0, visible = true;
    function render(t, dt){
      pointerS += (pointer - pointerS) * Math.min(1, dt * 2.5);
      revealT = Math.min(1, revealT + dt / 2.8);
      frame(t, dt, scrollK);
      const { M, eye, px } = matrices();
      api.project = projector(M);
      gl.clearColor(.016, .02, .024, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.useProgram(pr);
      gl.uniformMatrix4fv(U.uVP, false, M); gl.uniform3fv(U.uEye, eye); gl.uniform1f(U.uPx, px);
      gl.uniform1f(U.uFogN, api.cam.dist * api.fog[0]); gl.uniform1f(U.uFogF, api.cam.dist * api.fog[1]);
      const rv = 6 + 220 * (1 - Math.pow(1 - revealT, 3)); gl.uniform1f(U.uReveal, rv);
      for (const L of layers){
        if (!L.visible || !L.count) continue;
        if (L.dirty){
          gl.bindBuffer(gl.ARRAY_BUFFER, L.bp); gl.bufferData(gl.ARRAY_BUFFER, L.p, gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, L.bc); gl.bufferData(gl.ARRAY_BUFFER, L.c, gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.ARRAY_BUFFER, L.bs); gl.bufferData(gl.ARRAY_BUFFER, L.s, gl.DYNAMIC_DRAW);
          L.dirty = false;
        }
        if (L.depth){ gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); } else { gl.disable(gl.DEPTH_TEST); }
        gl.blendFunc(gl.SRC_ALPHA, L.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(U.uAlpha, L.alpha); gl.uniform1f(U.uRound, L.round ? 1 : 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, L.bp); gl.enableVertexAttribArray(A.p); gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, L.bc); gl.enableVertexAttribArray(A.c); gl.vertexAttribPointer(A.c, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, L.bs); gl.enableVertexAttribArray(A.s); gl.vertexAttribPointer(A.s, 1, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, L.count);
      }
      if (api.after) api.after(api.project);
    }
    function loop(ts){
      raf = 0; if (!visible || document.hidden) return;
      const dt = last ? Math.min(.08, (ts - last) / 1000) : .016; last = ts;
      render(ts, dt); raf = requestAnimationFrame(loop);
    }
    const go = () => { if (!raf && !reduce){ last = 0; raf = requestAnimationFrame(loop); } };
    new ResizeObserver(() => { size(); if (reduce || !raf) render(performance.now(), .016); }).observe(host);
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) go(); }, { threshold: 0 }).observe(stage);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); });
    size(); readScroll();
    if (reduce) render(performance.now(), 3); else go();
    host.classList.add('is-on');
  }
})();
