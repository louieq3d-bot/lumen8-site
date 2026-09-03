/* hero3d.js — the Lumen8 home hero: a geospatial energy intelligence machine.
   A wire terrain read from orbit, a coordinate pinned by a beam of light, a
   tracked solar array on posts beside it, a pole line carrying current to a
   village behind, energy flowing along a curve into a rising value curve, and
   waveforms rolling through the scene. The whole composition sits in the right
   half of the viewport so the headline reads on clean dark.
   Requires THREE (UMD). Falls back silently to the 2D field canvas if WebGL is
   unavailable. */
(function () {
  'use strict';
  const cv = document.querySelector('canvas[data-hero3d]');
  if (!cv || typeof THREE === 'undefined') return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  const field = document.querySelector('canvas[data-field]'); if (field) field.style.display = 'none';
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060c, 0.0019);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 700);
  const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
  scene.add(new THREE.HemisphereLight(0x3b82f6, 0x04060c, .85)); const sun = new THREE.DirectionalLight(0xdbeafe, 1.3); sun.position.set(60, 90, 40); scene.add(sun); const rim = new THREE.DirectionalLight(0x22d3ee, .5); rim.position.set(-80, 40, -60); scene.add(rim);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------- helpers ---------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const sprite = (color, size, opacity) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: opacity == null ? 1 : opacity, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; };
  const matte = (color, emissive, ei) => new THREE.MeshStandardMaterial({ color, emissive: emissive == null ? 0x000000 : emissive, emissiveIntensity: ei == null ? 0 : ei, metalness: .05, roughness: .92, fog: true });
  const edge = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, t) => a + (b - a) * t, sm = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy); return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy); };
  const terrainH = (x, z) => { let h = 0, a = 9, f = .035; for (let o = 0; o < 4; o++) { h += (noise(x * f + 31, z * f + 17) - .5) * a; a *= .5; f *= 2.1; } const d = Math.hypot(x, z); return h * Math.min(1, d / 40) - 1.5; };
  const EM = [];
  const energyMat = (color, speed, repeat, alpha) => { const m = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) }, sp: { value: speed }, rp: { value: repeat }, al: { value: alpha } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform float t, sp, rp, al; uniform vec3 c; varying vec2 vUv; void main(){ float p = fract(vUv.x * rp - t * sp); float band = smoothstep(0., .1, p) * smoothstep(.55, .1, p); gl_FragColor = vec4(c * (.22 + 1.7 * band) + vec3(band * .45), (.18 + .82 * band) * al); }', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); EM.push(m); return m; };
  const tube = (pts, color, radius, speed, repeat, alpha) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, radius, 6, false), energyMat(color, speed, repeat, alpha == null ? 1 : alpha));

  /* ---------- terrain ---------- */
  const W = 360, D = 260, SX = 160, SZ = 110;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: .15, fog: true }));
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x04060c, transparent: true, opacity: .96, fog: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  scene.add(fill, wire);
  const vp = [], vc = [];
  const cCyan = new THREE.Color(0x67e8f9), cBlue = new THREE.Color(0x93c5fd), cDim = new THREE.Color(0x1a5c6b);
  for (let i = 0; i < pos.count; i += 2) { const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z); if (Math.random() < Math.max(.08, 1 - d / 110)) { vp.push(x, pos.getY(i) + .3, z); const c = Math.random() < .06 ? cBlue : (d < 70 ? cCyan : cDim); vc.push(c.r, c.g, c.b); } }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3));
  scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.1, map: glowTex, vertexColors: true, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })));
  const contours = new THREE.Group();
  for (let k = 0; k < 7; k++) { const lvl = -4 + k * 1.6, pts = []; for (let i = 0; i <= 160; i++) { const x = -W / 2 + i / 160 * W; let z = -D / 2 + k * 30; for (let j = 0; j < 6; j++) { const h = terrainH(x, z); z += (lvl - h) * 2.2; } if (Math.abs(z) < D / 2) pts.push(V3(x, terrainH(x, z) + .25, z)); } if (pts.length > 4) contours.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: .16, fog: true }))); }
  scene.add(contours);

  /* ---------- the coordinate ---------- */
  const pin = new THREE.Group(); pin.position.set(0, terrainH(0, 0), 0); scene.add(pin);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, 1.1, 90, 12, 1, true), beamMat); beam.position.y = 45; pin.add(beam);
  const beamHalo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.2, 90, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: .10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beamHalo.position.y = 45; pin.add(beamHalo);
  pin.add(sprite(0x93c5fd, 14, .9));
  const rings = [];
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 96), new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: .6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = .4; pin.add(r); rings.push(r); }
  const scan = new THREE.Mesh(new THREE.RingGeometry(0, 60, 96, 1, 0, .9), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: .10, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); scan.rotation.x = -Math.PI / 2; scan.position.y = .6; pin.add(scan);

  /* ---------- the array: tracker tables on posts, fenced ---------- */
  const ROWS = 8, COLS = 5, PX = 6.6, PZ = 4.8, AX = 16, AZ = -20;
  const arr = new THREE.InstancedMesh(new THREE.BoxGeometry(6.2, .28, 2.6), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, emissive: 0x60a5fa, emissiveIntensity: .8, metalness: .9, roughness: .12, transparent: true, opacity: .96, fog: true }), ROWS * COLS);
  const arrEdge = new THREE.InstancedMesh(new THREE.BoxGeometry(6.2, .34, 2.4), new THREE.MeshBasicMaterial({ color: 0xbfdbfe, wireframe: true, transparent: true, opacity: .45, fog: true }), ROWS * COLS);
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .14, 2.2, 6), matte(0x9fb3c8), ROWS * COLS * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = V3(1, 1, 1), arrBase = []; let k = 0;
  for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) { const x = AX + j * PX, z = AZ + i * PZ, y = terrainH(x, z); arrBase.push([x, y + 2.4, z]); [-2, 2].forEach((dx, n) => { m.makeTranslation(x + dx, y + 1.1, z); posts.setMatrixAt(k * 2 + n, m); }); k++; }
  scene.add(arr, arrEdge, posts);
  const fx0 = AX - 6, fx1 = AX + (COLS - 1) * PX + 6, fz0 = AZ - 5, fz1 = AZ + (ROWS - 1) * PZ + 5;
  const fence = [[fx0, fz0], [fx1, fz0], [fx1, fz1], [fx0, fz1], [fx0, fz0]].map(([x, z]) => V3(x, terrainH(x, z) + .9, z));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fence), new THREE.LineDashedMaterial({ color: 0x93c5fd, dashSize: 2, gapSize: 1.6, transparent: true, opacity: .5, fog: true })).computeLineDistances());
  const fp = []; fence.forEach((a, i) => { if (!i) return; const b = fence[i - 1], n = Math.round(a.distanceTo(b) / 4); for (let t = 0; t < n; t++) fp.push(b.clone().lerp(a, t / n)); });
  const fposts = new THREE.InstancedMesh(new THREE.CylinderGeometry(.06, .06, 1.2, 4), matte(0x8892a6), fp.length); fp.forEach((p, i) => { m.makeTranslation(p.x, p.y - .3, p.z); fposts.setMatrixAt(i, m); }); scene.add(fposts);
  // inverter station at the array edge
  const invMat = new THREE.MeshStandardMaterial({ color: 0xd6e0ec, emissive: 0x22d3ee, emissiveIntensity: .3, metalness: .5, roughness: .4, fog: true });
  const inv = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 2.4), invMat); inv.position.set(fx1 + 4, terrainH(fx1 + 4, AZ + 10) + 1.1, AZ + 10); scene.add(inv);
  const invE = new THREE.LineSegments(new THREE.EdgesGeometry(inv.geometry), edge(0x67e8f9, .7)); invE.position.copy(inv.position); scene.add(invE);

  /* ---------- energy → value ---------- */
  const chart = new THREE.Group(); chart.position.set(58, 15, -56); chart.rotation.y = -.5; scene.add(chart);
  const NB = 9, barsM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1, 2.2), new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }), NB); chart.add(barsM);
  const barH = []; for (let i = 0; i < NB; i++) barH.push(3 + i * 2.6 + Math.random() * 1.5);
  chart.add(sprite(0x34d399, 30, .25));
  const wave = []; for (let i = 0; i < NB; i++) wave.push(V3(i * 3.4, barH[i] + 2, 0));
  const valLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wave), new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: .9 })); chart.add(valLine);
  const curve = new THREE.CatmullRomCurve3([V3(inv.position.x, inv.position.y + 1.2, inv.position.z), V3(52, 10, -18), V3(58, 13, -38), V3(58, 15, -56)]);
  scene.add(tube(curve.getPoints(24), 0x22d3ee, .5, .5, 3, .9));
  // coordinate feeds the array (two ground conduits)
  [[AX, AZ], [AX, AZ + (ROWS - 1) * PZ]].forEach(([x, z]) => scene.add(tube([V3(0, terrainH(0, 0) + .6, 0), V3(x * .5, terrainH(x * .5, z * .5) + 1.2, z * .5), V3(x - 3, terrainH(x, z) + .8, z)], 0x3b82f6, .26, .45, 2, .75)));
  const NP = 22, flowS = [];
  for (let i = 0; i < NP; i++) { const s = sprite(i % 5 ? 0x67e8f9 : 0x93c5fd, 1.4 + Math.random() * .8, .95); scene.add(s); flowS.push({ s, u: i / NP, v: .06 + Math.random() * .04 }); }

  /* ---------- the village behind the pin, fed by a pole line ---------- */
  const hm = new THREE.MeshStandardMaterial({ color: 0x8e9bb3, roughness: .9, metalness: .05, emissive: 0x1e3a8a, emissiveIntensity: .15, fog: true });
  const rm = new THREE.MeshStandardMaterial({ color: 0x1b2438, roughness: .85, fog: true });
  const winM = new THREE.MeshBasicMaterial({ color: 0xbfdbfe, transparent: true, opacity: .4, fog: true });
  const vil = []; const VC = [-22, -48];
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + .3, d = 9 + (i % 3) * 6, x = VC[0] + Math.cos(a) * d * 1.4, z = VC[1] + Math.sin(a) * d; vil.push(V3(x, terrainH(x, z), z)); }
  const hg = new THREE.Group(); scene.add(hg);
  vil.forEach((p, i) => { const h = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.7, 2.9), hm); h.position.set(p.x, p.y + .85, p.z); h.rotation.y = (i % 4) * .5; hg.add(h); const rf = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1, 4), rm); rf.position.set(p.x, p.y + 2.2, p.z); rf.rotation.y = h.rotation.y + Math.PI / 4; hg.add(rf); const w = new THREE.Mesh(new THREE.PlaneGeometry(.7, .5), winM); w.position.set(p.x, p.y + .9, p.z + 1.47); w.rotation.y = h.rotation.y; hg.add(w); });
  const rd = []; for (let i = 0; i <= 20; i++) { const t = i / 20, x = -4 + (VC[0] + 4) * t + Math.sin(t * 6) * 3, z = -6 + (VC[1] + 6) * t; rd.push(V3(x, terrainH(x, z) + .15, z)); }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rd), edge(0x8fa3bd, .35)));
  // poles along the road, crossarm perpendicular to the run, two conductors, current on one
  const pm = matte(0x5b5f6b), tops = [];
  for (let i = 1; i < rd.length; i += 4) { const p = rd[i], n = rd[Math.min(rd.length - 1, i + 1)], th = Math.atan2(n.x - p.x, n.z - p.z); const pole = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(.09, .13, 6, 6), pm); stick.position.y = 3; pole.add(stick); const arm = new THREE.Mesh(new THREE.BoxGeometry(2, .1, .1), pm); arm.position.y = 5.6; pole.add(arm); pole.position.set(p.x + 1.8, p.y, p.z); pole.rotation.y = th; scene.add(pole); tops.push([-1, 1].map((kk) => V3(pole.position.x + kk * .8 * Math.cos(th), p.y + 5.7, pole.position.z - kk * .8 * Math.sin(th)))); }
  const cur = [];
  for (let i = 1; i < tops.length; i++) for (let kk = 0; kk < 2; kk++) { const a = tops[i - 1][kk], b = tops[i][kk]; const c = new THREE.CatmullRomCurve3([a, V3((a.x + b.x) / 2, (a.y + b.y) / 2 - .7, (a.z + b.z) / 2), b]); scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(12)), edge(0xd6e0ec, .45))); if (kk === 1) cur.push(...c.getPoints(8).slice(i === 1 ? 0 : 1)); }
  scene.add(tube(cur, 0x67e8f9, .09, .45, Math.max(2, cur.length / 6) | 0, .9));
  scene.add(tube([V3(0, terrainH(0, 0) + .6, 0), V3(tops[0][1].x * .5, terrainH(0, 0) + 3, tops[0][1].z * .5), tops[0][1]], 0x3b82f6, .14, .45, 2, .8));
  const lastTop = tops[tops.length - 1][0], prevTop = tops[tops.length - 2][0];
  vil.forEach((p, i) => { const from = i % 2 ? lastTop : prevTop; scene.add(tube([from, V3((from.x + p.x) / 2, Math.min(from.y, p.y + 2) + 1, (from.z + p.z) / 2), V3(p.x, p.y + 2.1, p.z)], 0x67e8f9, .035, .35 + (i % 4) * .08, 1, .8)); });

  /* ---------- energy waveforms ---------- */
  const waves = [];
  [[0x22d3ee, 14, .28, 0], [0x3b82f6, 22, .22, 2], [0xa78bfa, 30, .18, 4]].forEach(([c, y, op, ph]) => { const n = 220, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, fog: true })); scene.add(l); waves.push({ l, y, ph, n }); });

  /* ---------- animate ---------- */
  let t = 0, mx = 0, my = 0, smx = 0, smy = 0, vis = true, W0 = 0, H0 = 0, cx = -26;
  const size = () => { const w = cv.clientWidth, h = cv.clientHeight; if (w === W0 && h === H0) return; W0 = w; H0 = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 800 ? 56 : 42; camera.updateProjectionMatrix(); cx = w / h > 1.15 ? -26 : -4; };
  size(); window.addEventListener('resize', size);
  window.addEventListener('mousemove', (e) => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5; }, { passive: true });
  new IntersectionObserver((en) => { vis = en[0].isIntersecting; }).observe(cv);
  const tmp = new THREE.Vector3();
  function tick() {
    requestAnimationFrame(tick); if (!vis) return; size();
    t += reduce ? 0 : .016;
    smx += (mx - smx) * .04; smy += (my - smy) * .04;
    const sy = Math.min(1, (window.scrollY || 0) / Math.max(1, window.innerHeight));
    rig.rotation.y = -.1 + smx * .2 + Math.sin(t * .08) * .04;
    camera.position.set(cx - 8, 42 + smy * 8 + sy * 40, 118 - sy * 30); camera.lookAt(cx + 6, 4 + sy * 10, -12);
    rings.forEach((r, i) => { const ph = ((t * .32 + i * .25) % 1); const s = 3 + ph * 52; r.scale.set(s, s, 1); r.material.opacity = (1 - ph) * .7; });
    scan.rotation.z = t * .9; beamMat.opacity = .45 + Math.sin(t * 3) * .12;
    const tilt = -.55 + Math.sin(t * .12) * .5;
    for (let i = 0; i < arrBase.length; i++) { const b = arrBase[i]; q.setFromEuler(new THREE.Euler(tilt, 0, 0)); m.compose(V3(b[0], b[1] + Math.sin(t * 2 + i * .5) * .03, b[2]), q, s1); arr.setMatrixAt(i, m); arrEdge.setMatrixAt(i, m); }
    arr.instanceMatrix.needsUpdate = true; arrEdge.instanceMatrix.needsUpdate = true;
    flowS.forEach((f) => { f.u = (f.u + f.v * .016 * 3) % 1; curve.getPointAt(f.u, tmp); f.s.position.copy(tmp); f.s.material.opacity = .4 + .6 * Math.sin(f.u * Math.PI); });
    for (let i = 0; i < NB; i++) { const h = barH[i] * (.85 + .15 * Math.sin(t * 1.3 + i * .6)); m.makeScale(1, h, 1); m.setPosition(i * 3.4, h / 2, 0); barsM.setMatrixAt(i, m); wave[i].y = h + 2; }
    barsM.instanceMatrix.needsUpdate = true; valLine.geometry.setFromPoints(wave);
    winM.opacity = .3 + .3 * Math.max(0, Math.sin(t * 1.1));
    waves.forEach((w) => { const p = w.l.geometry.attributes.position; for (let i = 0; i < w.n; i++) { const x = -170 + i / (w.n - 1) * 340; const env = Math.exp(-Math.pow(x / 120, 2)); const y = w.y + (Math.sin(x * .06 + t * 1.4 + w.ph) * 6 + Math.sin(x * .17 - t * 2.2 + w.ph) * 2.2) * env; p.setXYZ(i, x, y, -40 + Math.sin(x * .02 + w.ph) * 30); } p.needsUpdate = true; });
    EM.forEach((mm) => { mm.uniforms.t.value = t; });
    renderer.render(scene, camera);
  }
  tick();
})();
