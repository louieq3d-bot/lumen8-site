/* Company header: the Earth as points (Natural Earth 1:110m land, public domain), with the two launch markets lit,
   the equator, and the 33.9° S parallel where the South African demo sits. Noon sun elevations on 21 March are
   90° minus the latitude. */
(function(){
  'use strict';
  const S = window.AGVScene, U = S.util;
  S.register('globe', function(api){
    if (!window.AGV_LAND) throw new Error('land.js not loaded');
    const raw = atob(window.AGV_LAND), bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const D = new Int16Array(bytes.buffer), R = 10;
    const xyz = (lat, lon, r = R) => { const a = lat * U.D2R, b = lon * U.D2R; return [Math.cos(a) * Math.cos(b) * r, Math.cos(a) * Math.sin(b) * r, Math.sin(a) * r]; };
    const n = D.length / 3, L = api.layer(n, { round: true, depth: true });
    for (let i = 0; i < n; i++){
      const lat = D[i * 3] / 10, lon = D[i * 3 + 1] / 10, f = D[i * 3 + 2];
      L.p.set(xyz(lat, lon, R + (f >= 3 ? .04 : 0)), i * 3);
      if (f === 0) L.c.set([.62, .66, .72, .55], i * 4); else if (f >= 3) L.c.set([.78, .93, .4, .95], i * 4); else L.c.set([.24, .73, .49, .6], i * 4);
      L.s[i] = f >= 3 ? .09 : .13;
    }
    // ocean shell, parallels
    const shell = [];
    for (let i = 0; i < (api.small ? 1600 : 3000); i++){ const z = 1 - 2 * (i + .5) / (api.small ? 1600 : 3000), r = Math.sqrt(1 - z * z), ph = i * 2.39996; shell.push([Math.cos(ph) * r * R * .995, Math.sin(ph) * r * R * .995, z * R * .995, .05]); }
    const ring = (lat, a, step = 1.2) => { for (let lon = -180; lon < 180; lon += step) shell.push([...xyz(lat, lon, R * 1.002), a]); };
    [-60, -30, 30, 60].forEach(l => ring(l, .06, 2.4)); ring(0, .2, .9); ring(-33.9, .32, .7);
    const SH = api.layer(shell.length, { round: true, depth: true });
    shell.forEach((s, i) => { SH.p.set([s[0], s[1], s[2]], i * 3); const hi = s[3] > .3; SH.c.set(hi ? [.24, .73, .49, s[3]] : [.8, .85, .95, s[3]], i * 4); SH.s[i] = hi ? .06 : .05; });
    // markets: a beam out of the surface, and a dotted great-circle arc between them
    const SITES = [[-6.9, 107.6], [-33.9, 18.9]];
    const beams = [];
    SITES.forEach(([la, lo]) => { for (let k = 0; k < 40; k++) beams.push([...xyz(la, lo, R + k * .06), 1 - k / 40]); });
    const a = xyz(...SITES[0], 1), b = xyz(...SITES[1], 1), om = Math.acos(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]), so = Math.sin(om);
    for (let k = 1; k < 90; k++){ const t = k / 90, wa = Math.sin((1 - t) * om) / so, wb = Math.sin(t * om) / so, lift = R + Math.sin(Math.PI * t) * 2.6; beams.push([(a[0] * wa + b[0] * wb) * lift, (a[1] * wa + b[1] * wb) * lift, (a[2] * wa + b[2] * wb) * lift, .55 * (k % 3 === 0 ? 1 : 0)]); }
    const BM = api.layer(beams.length, { round: true, add: true });
    beams.forEach((p, i) => { BM.p.set([p[0], p[1], p[2]], i * 3); BM.c.set([.24, .73, .49, p[3] * .9], i * 4); BM.s[i] = .09; });

    const anchors = [...api.stage.querySelectorAll('[data-globe-label]')];
    const AT = [xyz(-6.9, 107.6, R + 2.5), xyz(-33.9, 18.9, R + 2.5)];
    let eyeDir = [1, 0, 0];
    api.after = (project) => {
      anchors.forEach((el, i) => {
        const p = AT[i], q = project(p[0], p[1], p[2]), f = (p[0] * eyeDir[0] + p[1] * eyeDir[1] + p[2] * eyeDir[2]) / (R + 2.5);
        if (!q){ el.style.opacity = 0; return; }
        el.style.transform = 'translate3d(' + q[0].toFixed(1) + 'px,' + q[1].toFixed(1) + 'px,0)';
        el.style.opacity = Math.max(0, Math.min(1, (f - .1) * 3)).toFixed(2);
      });
    };
    api.readout('g-id-sun', (90 - 6.9).toFixed(1) + '°'); api.readout('g-za-sun', (90 - 33.9).toFixed(1) + '°');
    api.cam = Object.assign(api.cam, { el: -14, dist: api.small ? 50 : 44, tx: 0, ty: 0, tz: -1.5, fov: 34, shiftX: api.small ? 0 : .3, shift: api.small ? .04 : -.06, sway: .12 });
    api.fog = [.75, 1.25];
    const azFor = (lon) => Math.atan2(Math.cos(lon * U.D2R), -Math.sin(lon * U.D2R));
    return function frame(t, dt, scroll){
      const lon = api.reduce ? 62 : 62 + Math.sin(t / 14000) * 34;
      api.cam.az = azFor(lon); api.cam.el = -14 + scroll * 20;
      const el = api.cam.el * U.D2R; eyeDir = [Math.cos(el) * Math.sin(api.cam.az), -Math.cos(el) * Math.cos(api.cam.az), Math.sin(el)];
      const pulse = .55 + .45 * Math.sin(t / 380);
      for (let i = 0; i < 80; i++) BM.c[i * 4 + 3] = (1 - (i % 40) / 40) * .9 * (.6 + .4 * pulse);
      BM.dirty = true;
    };
  });
})();
