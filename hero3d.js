/* hero3d.js — the Lumen8 hero: a geospatial energy intelligence machine.
   A wire terrain read from orbit, a coordinate pinned by a beam of light, a
   solar array that grows beside it, energy flowing along a curve into a rising
   value curve, and waveforms of energy rolling through the scene.
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
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x04060c, 0.0042);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
  camera.position.set(0, 46, 118); camera.lookAt(0, 4, 0);
  scene.add(new THREE.HemisphereLight(0x3b82f6, 0x04060c, .8)); const sun = new THREE.DirectionalLight(0xdbeafe, 1.3); sun.position.set(60, 90, 40); scene.add(sun); const rim = new THREE.DirectionalLight(0x22d3ee, .5); rim.position.set(-80, 40, -60); scene.add(rim);

  /* ---------- helpers ---------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const sprite = (color, size, opacity) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: opacity == null ? 1 : opacity, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; };
  // cheap value noise
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, t) => a + (b - a) * t, sm = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy); return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy); };
  const terrainH = (x, z) => { let h = 0, a = 9, f = .035; for (let o = 0; o < 4; o++) { h += (noise(x * f + 31, z * f + 17) - .5) * a; a *= .5; f *= 2.1; } const d = Math.hypot(x, z); return h * Math.min(1, d / 40) - 1.5; };

  /* ---------- terrain ---------- */
  const W = 320, D = 220, SX = 150, SZ = 100;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: .10, fog: true }));
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x04060c, transparent: true, opacity: .96, fog: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  scene.add(fill, wire);
  // vertex points, denser near the pin
  const vp = [], vc = [];
  const cCyan = new THREE.Color(0x67e8f9), cAmber = new THREE.Color(0x93c5fd), cDim = new THREE.Color(0x1a5c6b);
  for (let i = 0; i < pos.count; i += 2) { const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z); if (Math.random() < Math.max(.08, 1 - d / 110)) { vp.push(x, pos.getY(i) + .3, z); const c = Math.random() < .06 ? cAmber : (d < 70 ? cCyan : cDim); vc.push(c.r, c.g, c.b); } }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3));
  const points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.6, map: glowTex, vertexColors: true, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  scene.add(points);
  // contour lines
  const contours = new THREE.Group();
  for (let k = 0; k < 7; k++) { const lvl = -4 + k * 1.6, pts = []; for (let i = 0; i <= 160; i++) { const x = -W / 2 + i / 160 * W; let z = -D / 2 + k * 30; for (let j = 0; j < 6; j++) { const h = terrainH(x, z); z += (lvl - h) * 2.2; } if (Math.abs(z) < D / 2) pts.push(new THREE.Vector3(x, terrainH(x, z) + .25, z)); } if (pts.length > 4) contours.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: .16, fog: true }))); }
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

  /* ---------- the array ---------- */
  const ROWS = 9, COLS = 7, arr = new THREE.InstancedMesh(new THREE.BoxGeometry(6.4, .3, 2.6), new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x60a5fa, emissiveIntensity: .9, metalness: .85, roughness: .12, transparent: true, opacity: .96, fog: true }), ROWS * COLS);
  const arrEdge = new THREE.InstancedMesh(new THREE.BoxGeometry(6.4, .35, 2.4), new THREE.MeshBasicMaterial({ color: 0xbfdbfe, wireframe: true, transparent: true, opacity: .5, fog: true }), ROWS * COLS);
  const m = new THREE.Matrix4(), arrBase = []; let k = 0;
  for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) { const x = 18 + j * 7.4, z = -26 + i * 4.6; arrBase.push([x, terrainH(x, z) + 1.6, z]); m.makeTranslation(x, terrainH(x, z) + 1.6, z); arr.setMatrixAt(k, m); arrEdge.setMatrixAt(k, m); k++; }
  scene.add(arr, arrEdge);
  const fence = []; for (let i = 0; i <= 40; i++) { const t = i / 40, x = 13 + (t < .25 ? t * 4 * 54 : t < .5 ? 54 : t < .75 ? (1 - (t - .5) * 4) * 54 : 0), z = -30 + (t < .25 ? 0 : t < .5 ? (t - .25) * 4 * 46 : t < .75 ? 46 : (1 - (t - .75) * 4) * 46); fence.push(new THREE.Vector3(x, terrainH(x, z) + .8, z)); }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fence), new THREE.LineDashedMaterial({ color: 0x93c5fd, dashSize: 2, gapSize: 2, transparent: true, opacity: .5 })).computeLineDistances());

  /* ---------- energy → value ---------- */
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(44, terrainH(44, -4) + 2, -4), new THREE.Vector3(56, 14, -18), new THREE.Vector3(66, 30, -34), new THREE.Vector3(72, 42, -52)]);
  const cpts = curve.getPoints(80);
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cpts), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: .35 })));
  const NP = 26, flow = new THREE.Group(); const flowS = [];
  for (let i = 0; i < NP; i++) { const s = sprite(i % 5 ? 0x67e8f9 : 0x93c5fd, 2.6 + Math.random() * 1.4, .9); flow.add(s); flowS.push({ s, u: i / NP, v: .06 + Math.random() * .04 }); }
  scene.add(flow);
  // rising value: bars + a glowing curve
  const chart = new THREE.Group(); chart.position.set(72, 42, -52); scene.add(chart);
  const NB = 9, barsM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1, 2.2), new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }), NB); chart.add(barsM);
  const barH = []; for (let i = 0; i < NB; i++) barH.push(3 + i * 2.6 + Math.random() * 1.5);
  chart.add(sprite(0x34d399, 30, .25));
  const wave = []; for (let i = 0; i < NB; i++) wave.push(new THREE.Vector3(i * 3.4, barH[i] + 2, 0));
  const valLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wave), new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: .9 })); chart.add(valLine);
  chart.rotation.y = -.5;

  /* ---------- energy waveforms ---------- */
  const waves = [];
  [[0x22d3ee, 14, .28, 0], [0x3b82f6, 22, .22, 2], [0xa78bfa, 30, .18, 4]].forEach(([c, y, op, ph]) => { const n = 220, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, fog: true })); scene.add(l); waves.push({ l, y, ph, n }); });

  /* ---------- lights are baked; animate ---------- */
  let t = 0, mx = 0, my = 0, smx = 0, smy = 0, vis = true, W0 = 0, H0 = 0;
  const size = () => { const w = cv.clientWidth, h = cv.clientHeight; if (w === W0 && h === H0) return; W0 = w; H0 = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); camera.fov = w < 800 ? 56 : 42; camera.updateProjectionMatrix(); };
  size(); window.addEventListener('resize', size);
  window.addEventListener('mousemove', (e) => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5; }, { passive: true });
  new IntersectionObserver((en) => { vis = en[0].isIntersecting; }).observe(cv);
  const tmp = new THREE.Vector3();
  function tick() {
    requestAnimationFrame(tick); if (!vis) return; size();
    t += reduce ? 0 : .016;
    smx += (mx - smx) * .04; smy += (my - smy) * .04;
    const sy = Math.min(1, (window.scrollY || 0) / Math.max(1, window.innerHeight));
    rig.rotation.y = -.12 + smx * .22 + Math.sin(t * .08) * .05;
    camera.position.set(0, 46 + smy * 8 + sy * 40, 118 - sy * 30); camera.lookAt(10, 4 + sy * 10, -10);
    rings.forEach((r, i) => { const ph = ((t * .32 + i * .25) % 1); const s = 3 + ph * 52; r.scale.set(s, s, 1); r.material.opacity = (1 - ph) * .7; });
    scan.rotation.z = t * .9; beamMat.opacity = .45 + Math.sin(t * 3) * .12;
    // array shimmer
    for (let i = 0; i < arrBase.length; i++) { const b = arrBase[i]; m.makeRotationX(-.32 + Math.sin(t * .6 + i * .3) * .03); m.setPosition(b[0], b[1] + Math.sin(t * 2 + i * .5) * .05, b[2]); arr.setMatrixAt(i, m); arrEdge.setMatrixAt(i, m); }
    arr.instanceMatrix.needsUpdate = true; arrEdge.instanceMatrix.needsUpdate = true;
    // flow particles
    flowS.forEach((f) => { f.u = (f.u + f.v * .016 * 3) % 1; curve.getPointAt(f.u, tmp); f.s.position.copy(tmp); f.s.material.opacity = .4 + .6 * Math.sin(f.u * Math.PI); });
    // bars breathe upward
    for (let i = 0; i < NB; i++) { const h = barH[i] * (.85 + .15 * Math.sin(t * 1.3 + i * .6)); m.makeScale(1, h, 1); m.setPosition(i * 3.4, h / 2, 0); barsM.setMatrixAt(i, m); wave[i].y = h + 2; }
    barsM.instanceMatrix.needsUpdate = true; valLine.geometry.setFromPoints(wave);
    // waveforms
    waves.forEach((w) => { const p = w.l.geometry.attributes.position; for (let i = 0; i < w.n; i++) { const x = -170 + i / (w.n - 1) * 340; const env = Math.exp(-Math.pow(x / 120, 2)); const y = w.y + (Math.sin(x * .06 + t * 1.4 + w.ph) * 6 + Math.sin(x * .17 - t * 2.2 + w.ph) * 2.2) * env; p.setXYZ(i, x, y, -40 + Math.sin(x * .02 + w.ph) * 30); } p.needsUpdate = true; });
    renderer.render(scene, camera);
  }
  tick();
})();
