/* hero3d.js — the Lumen8 home hero: sunshine turning into money.
   A textured, contoured terrain read from orbit; a coordinate pinned by a
   beam of light; a sun streaming photons onto a tracked array; the array's
   output flowing through an inverter, past the numbers (irradiance × capacity
   × performance ratio → energy × tariff → revenue → IRR) into a rising value
   chart; a pole line carrying current down a road to a village of real houses
   in the foreground; waveforms rolling through the scene. Built on the kit,
   environment, shadows and bloom pass exposed by holo3d.js (window.Holo). The
   whole composition sits in the right half so the headline reads on dark. */
(function () {
  'use strict';
  const cv = document.querySelector('canvas[data-hero3d]');
  if (!cv || typeof THREE === 'undefined' || !window.Holo) return;
  const H = window.Holo, K = H.kit, M = H.mats, TX = H.tex, P = H.P;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  const field = document.querySelector('canvas[data-field]'); if (field) field.style.display = 'none';
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = !H.LOW; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let post = null; try { post = H.makePost(renderer); renderer.toneMapping = THREE.NoToneMapping; } catch (e) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; }
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x04060c, 0.0017); scene.environment = H.envFor(renderer);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
  const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
  H.lightRig(scene, 70, true);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, t) => a + (b - a) * t, smo = (t) => t * t * (3 - 2 * t);
  const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = smo(x - ix), fy = smo(y - iy); return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy); };
  const terrainH = (x, z) => { let h = 0, a = 9, f = .035; for (let o = 0; o < 4; o++) { h += (noise(x * f + 31, z * f + 17) - .5) * a; a *= .5; f *= 2.1; } const d = Math.hypot(x - 30, z - 5); return h * Math.min(1, Math.max(0, (d - 30) / 50)) - 1.5; };

  /* ---------- terrain: textured earth, wire overlay, survey points, contours ---------- */
  const W = 380, D = 280;
  const geo = new THREE.PlaneGeometry(W, D, 150, 110); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i))); geo.computeVertexNormals();
  const gmap = TX.ground.clone(); gmap.needsUpdate = true; gmap.repeat.set(W / 16, D / 16); const gb = TX.bump.clone(); gb.needsUpdate = true; gb.repeat.set(W / 10, D / 10);
  const fill = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: gmap, bumpMap: gb, bumpScale: .4, roughness: .95, metalness: .05, envMapIntensity: .25, polygonOffset: true, polygonOffsetFactor: 1 })); fill.receiveShadow = true; scene.add(fill);
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: .09, fog: true })));
  const vp = [], vc = []; const cCyan = new THREE.Color(0x67e8f9), cBlue = new THREE.Color(0x93c5fd), cDim = new THREE.Color(0x1a5c6b);
  for (let i = 0; i < pos.count; i += 2) { const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x - 20, z); if (Math.random() < Math.max(.06, 1 - d / 120)) { vp.push(x, pos.getY(i) + .3, z); const c = Math.random() < .06 ? cBlue : (d < 80 ? cCyan : cDim); vc.push(c.r, c.g, c.b); } }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3));
  scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 1, map: M.sprite(0xffffff, 1).material.map, vertexColors: true, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false })));
  for (let k = 0; k < 7; k++) { const lvl = -4 + k * 1.6, pts = []; for (let i = 0; i <= 160; i++) { const x = -W / 2 + i / 160 * W; let z = -D / 2 + k * 30; for (let j = 0; j < 6; j++) { const h = terrainH(x, z); z += (lvl - h) * 2.2; } if (Math.abs(z) < D / 2) pts.push(V3(x, terrainH(x, z) + .25, z)); } if (pts.length > 4) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: .14, fog: true }))); }
  const dust = K.dust(110, 180); dust.position.set(30, 2, -10); scene.add(dust);

  /* ---------- the coordinate ---------- */
  const pin = new THREE.Group(); pin.position.set(0, terrainH(0, 0), 0); scene.add(pin);
  const beam = K.beam(70, 0x60a5fa, .7); pin.add(beam);
  const rings = []; for (let i = 0; i < 4; i++) { const r = K.ring(1, 0x3b82f6, .04); r.position.y = .4; pin.add(r); rings.push(r); }
  const scan = new THREE.Mesh(new THREE.RingGeometry(0, 60, 96, 1, 0, .8), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: .08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); scan.rotation.x = -Math.PI / 2; scan.position.y = .6; pin.add(scan);
  const pinLabel = K.label('-8.6427, 120.0132', '#93c5fd', 13); pinLabel.position.set(2, 9, 0); pin.add(pinLabel);

  /* ---------- the sun ---------- */
  const SUN = V3(96, 60, -104), AC = V3(46, 2.4, -30);
  const sun = K.sun(SUN, AC, reduce ? 0 : 70, 0xdbeafe); scene.add(sun);
  const sunLabel = K.label('GHI 5.4 kWh/m² · day', '#e0f2fe', 16); sunLabel.position.set(SUN.x - 26, SUN.y - 16, SUN.z + 6); scene.add(sunLabel);

  /* ---------- the array: tracker rows on posts, fenced, with an inverter ---------- */
  const arr = K.tracker(9, 30, 5, P.blue, 3); arr.position.set(AC.x, terrainH(AC.x, AC.z) + .2, AC.z); scene.add(arr);
  const ay = terrainH(AC.x, AC.z);
  const fx0 = AC.x - 26, fx1 = AC.x + 26, fz0 = AC.z - 19, fz1 = AC.z + 19;
  scene.add(K.fence([[fx0, ay, fz0], [fx1, ay, fz0], [fx1, ay, fz1], [fx0, ay, fz1], [fx0, ay, fz0]], 0x93c5fd));
  scene.add(K.road([[fx0 - 2, ay + .15, fz1 + 3], [fx1 + 4, ay + .15, fz1 + 3]], 3));
  const pad = K.pad(8, 6, TX.gravel); pad.position.set(fx1 + 5, ay, AC.z + 8); scene.add(pad);
  const inv = K.box(4.2, 2.3, 2.6, M.solid(0xd6e0ec, 0x22d3ee, .3), 0x67e8f9, .7); inv.position.set(fx1 + 5, ay + .16, AC.z + 8); scene.add(inv);
  const invTop = V3(fx1 + 5, ay + 2.6, AC.z + 8);
  arr.userData.xs.forEach((x) => scene.add(K.line([[AC.x + x, ay + .2, AC.z + 15], [AC.x + x, ay + .2, AC.z + 17.5]], 0x67e8f9, .35)));
  scene.add(K.line([[fx0 + 4, ay + .22, AC.z + 17.5], [fx1 + 5, ay + .22, AC.z + 17.5], [fx1 + 5, ay + .22, AC.z + 9.5]], 0x67e8f9, .5));
  const arrLabel = K.label('128 MWp × PR 0.82 · SINGLE-AXIS TRACKING', '#93c5fd', 22); arrLabel.position.set(fx0, ay + 9, fz0 - 2); scene.add(arrLabel);
  // pin → array: two ground conduits
  [[fx0 + 2, fz0 + 6], [fx0 + 2, fz1 - 6]].forEach(([x, z]) => scene.add(K.tube([V3(0, terrainH(0, 0) + .6, 0), V3(x * .5, terrainH(x * .5, z * .5) + 1.4, z * .5), V3(x, terrainH(x, z) + .8, z)], 0x3b82f6, .22, .45, 3, .75)));

  /* ---------- energy → money: the flow and the numbers along it ---------- */
  const chart = new THREE.Group(); chart.position.set(70, 12, -66); chart.rotation.y = -.5; scene.add(chart);
  const NB = 9, barsM = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1, 2.2), M.solid(0x34d399, 0x34d399, .5, .85), NB); chart.add(barsM);
  const barH = []; for (let i = 0; i < NB; i++) barH.push(3 + i * 2.6 + Math.random() * 1.5);
  chart.add(M.sprite(0x34d399, 34, .22));
  const wave = []; for (let i = 0; i < NB; i++) wave.push(V3(i * 3.4, barH[i] + 2, 0));
  const valLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wave), new THREE.LineBasicMaterial({ color: 0x6ee7b7, transparent: true, opacity: .9 })); chart.add(valLine);
  const chartLabel = K.label('$13.1 M / yr REVENUE · IRR 14.2% · NPV $48 M', '#6ee7b7', 24); chartLabel.position.set(-3, 28.5, 0); chart.add(chartLabel);
  const chartAxis = K.label('YEAR 1 → 25', '#6f7b91', 8); chartAxis.position.set(0, -1.2, 3); chart.add(chartAxis);
  const flowPts = [invTop, V3(fx1 + 12, 8, AC.z - 4), V3(74, 12, -34), V3(72, 15, -52), V3(70, 16, -66)];
  const curve = new THREE.CatmullRomCurve3(flowPts); scene.add(K.tube(curve.getPoints(30), 0x22d3ee, .45, .5, 4, .9));
  [['= 214 GWh / yr', fx1 + 14, 12, AC.z - 6], ['× $0.061 / kWh', 76, 17, -36], ['× 25 yr → NPV', 74, 20, -52]].forEach(([tx, x, y, z]) => { const l = K.label(tx, '#a5f3fc', 15); l.position.set(x, y, z); scene.add(l); });
  const NP = 24, flowS = []; for (let i = 0; i < NP; i++) { const s = M.sprite(i % 5 ? 0x67e8f9 : 0xffffff, 1.4 + Math.random() * .8, .95); scene.add(s); flowS.push({ s, u: i / NP, v: .05 + Math.random() * .04 }); }

  /* ---------- the village in the foreground, fed by a pole line down the road ---------- */
  const rd = []; for (let i = 0; i <= 24; i++) { const t = i / 24, x = 2 + 46 * t + Math.sin(t * 5) * 3, z = 3 + 44 * t; rd.push(V3(x, terrainH(x, z) + .15, z)); }
  scene.add(K.road(rd, 2.8));
  const polePts = []; for (let i = 2; i < rd.length; i += 4) { const p = rd[i], n = rd[Math.min(rd.length - 1, i + 1)], dx = n.x - p.x, dz = n.z - p.z, l = Math.hypot(dx, dz) || 1; const x = p.x + (-dz / l) * 2.6, z = p.z + (dx / l) * 2.6; polePts.push(V3(x, terrainH(x, z), z)); }
  const line = K.poleLine(polePts, 0x67e8f9, { h: 6.4, sag: .6, speed: .6, radius: .07, wire: .7 }); scene.add(line);
  const tops = line.userData.tops;
  scene.add(K.tube([V3(0, terrainH(0, 0) + .6, 0), V3(tops[0][1].x * .5, terrainH(0, 0) + 4, tops[0][1].z * .5), tops[0][1]], 0x3b82f6, .14, .45, 2, .8));
  const houses = [], seed = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }, r = seed(31);
  for (let i = 3; i < rd.length - 1; i += 3) { const p = rd[i], n = rd[i + 1], dx = n.x - p.x, dz = n.z - p.z, l = Math.hypot(dx, dz) || 1; [-1, 1].forEach((sd) => { if (sd < 0 && i < 9) return; if (r() < .18) return; const off = sd * (6.5 + r() * 2.5), x = p.x + (-dz / l) * off, z = p.z + (dx / l) * off; const h = K.house(3.4 + r() * 1.4, 2.8 + r(), 1.6 + r() * .4, 0); h.position.set(x, terrainH(x, z), z); h.rotation.y = Math.atan2(dx, dz) + (sd > 0 ? Math.PI / 2 : -Math.PI / 2); scene.add(h); houses.push(h); }); }
  houses.forEach((h) => { const t = K.nearestTop(tops, h.position.x, h.position.z); scene.add(K.drop(t, V3(h.position.x, h.position.y + 2.2, h.position.z))); });
  for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 14 + r() * 40, x = 26 + Math.cos(a) * d, z = 26 + Math.sin(a) * d * .8; if (houses.some((h) => Math.hypot(h.position.x - x, h.position.z - z) < 5) || rd.some((p) => Math.hypot(p.x - x, p.z - z) < 4) || Math.hypot(x, z) < 8) continue; const tr = K.tree(1 + r(), r()); tr.position.set(x, terrainH(x, z), z); scene.add(tr); }
  const vilLabel = K.label('481 HH · 100% CONNECTED', '#67e8f9', 14); vilLabel.position.set(30, 10, 34); scene.add(vilLabel);
  H.shadowify(scene);

  /* ---------- energy waveforms ---------- */
  const waves = [];
  [[0x22d3ee, 16, .26, 0], [0x3b82f6, 24, .2, 2], [0xa78bfa, 32, .16, 4], [0x34d399, 40, .12, 1]].forEach(([c, y, op, ph]) => { const n = 220, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, fog: true })); scene.add(l); waves.push({ l, y, ph, n }); });

  /* ---------- animate ---------- */
  let t = 0, mx = 0, my = 0, smx = 0, smy = 0, vis = true, W0 = 0, H0 = 0, cx = -26;
  const size = () => { const w = cv.clientWidth, h = cv.clientHeight; if (w === W0 && h === H0) return; W0 = w; H0 = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 800 ? 56 : 42; camera.updateProjectionMatrix(); cx = w / h > 1.15 ? -24 : -2; };
  size(); window.addEventListener('resize', size);
  window.addEventListener('mousemove', (e) => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5; }, { passive: true });
  new IntersectionObserver((en) => { vis = en[0].isIntersecting; }).observe(cv);
  const tmp = new THREE.Vector3(), m = new THREE.Matrix4();
  function tick() {
    requestAnimationFrame(tick); if (!vis) return; size();
    t += reduce ? 0 : .016;
    smx += (mx - smx) * .04; smy += (my - smy) * .04;
    const sy = Math.min(1, (window.scrollY || 0) / Math.max(1, window.innerHeight));
    rig.rotation.y = -.12 + smx * .2 + Math.sin(t * .08) * .04 + sy * .3;
    camera.position.set(cx - 8, 44 + smy * 8 + sy * 70, 120 - sy * 58); camera.lookAt(cx + 8 + sy * 30, 4 + sy * 6, -12 + sy * 20);
    rings.forEach((r, i) => { const ph = ((t * .32 + i * .25) % 1); const s = 3 + ph * 52; r.scale.set(s, s, 1); r.material.opacity = (1 - ph) * .6; });
    scan.rotation.z = t * .9; beam.userData.mat.opacity = .26 + Math.sin(t * 3) * .06;
    arr.userData.setTilt(.5 - Math.sin(t * .12) * .45);
    sun.userData.tick(reduce ? 0 : .016, 22);
    flowS.forEach((f) => { f.u = (f.u + f.v * .016 * 3) % 1; curve.getPointAt(f.u, tmp); f.s.position.copy(tmp); f.s.material.opacity = .4 + .6 * Math.sin(f.u * Math.PI); });
    for (let i = 0; i < NB; i++) { const h = barH[i] * (.86 + .14 * Math.sin(t * 1.3 + i * .6)); m.makeScale(1, h, 1); m.setPosition(i * 3.4, h / 2, 0); barsM.setMatrixAt(i, m); wave[i].y = h + 2; }
    barsM.instanceMatrix.needsUpdate = true; valLine.geometry.setFromPoints(wave);
    houses.forEach((h, i) => { h.userData.win.material.opacity = .3 + .3 * Math.max(0, Math.sin(t * 1.1 + i)); });
    waves.forEach((w) => { const p = w.l.geometry.attributes.position; for (let i = 0; i < w.n; i++) { const x = -170 + i / (w.n - 1) * 340; const env = Math.exp(-Math.pow((x - 30) / 120, 2)); const y = w.y + (Math.sin(x * .06 + t * 1.4 + w.ph) * 6 + Math.sin(x * .17 - t * 2.2 + w.ph) * 2.2) * env; p.setXYZ(i, x, y, -50 + Math.sin(x * .02 + w.ph) * 30); } p.needsUpdate = true; });
    dust.userData.tick(t);
    if (post) post.render(scene, camera); else renderer.render(scene, camera);
  }
  tick();
})();
