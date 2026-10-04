/* Features header: every feature on this page as a point on a sphere, read from the page itself, so the figure and
   the list below can never disagree. Live features are white, features in build are amber; each group is a chain of
   neighbours on the sphere. The labels follow whichever features face the reader. */
(function(){
  'use strict';
  const S = window.AGVScene, U = S.util;
  S.register('features', function(api){
    const groups = [...document.querySelectorAll('section.grp')].map(g => ({
      id: g.id, name: (g.querySelector('h2') || {}).textContent || g.id,
      rows: [...g.querySelectorAll('.frow')].map(r => ({ name: (r.querySelector('.frow__n') || {}).textContent || '', live: !!r.querySelector('.pill--live') })),
    })).filter(g => g.rows.length);
    const nodes = []; groups.forEach((g, gi) => g.rows.forEach(r => nodes.push(Object.assign({ g: gi }, r))));
    const N = nodes.length, R = 13;
    // Fibonacci sphere, in group order, so each group occupies a band of neighbours
    nodes.forEach((n, i) => {
      const z = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - z * z), ph = i * 2.39996;
      n.d = [Math.cos(ph) * r, Math.sin(ph) * r, z]; n.p = n.d.map(v => v * R);
    });
    const TONES = [[.96, .72, .24], [.42, .77, .49], [.29, .62, .85], [.65, .55, .98], [.94, .48, .48], [.82, .75, .38], [.24, .73, .49], [.48, .65, .85]];
    // lattice: a faint shell for volume
    const LAT = api.layer(api.small ? 1400 : 2600, { round: true, add: true });
    for (let i = 0; i < LAT.n; i++){
      const z = 1 - 2 * (i + .5) / LAT.n, r = Math.sqrt(1 - z * z), ph = i * 2.39996;
      LAT.p.set([Math.cos(ph) * r * R, Math.sin(ph) * r * R, z * R], i * 3); LAT.c.set([.8, .85, .95, .09], i * 4); LAT.s[i] = .06;
    }
    // links between neighbours in a group, as dotted great-circle arcs
    const links = [];
    for (let i = 1; i < N; i++) if (nodes[i].g === nodes[i - 1].g){
      const a = nodes[i - 1].d, b = nodes[i].d, dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(dot), so = Math.sin(om) || 1;
      for (let k = 1; k < 14; k++){ const t = k / 14, wa = Math.sin((1 - t) * om) / so, wb = Math.sin(t * om) / so; links.push([(a[0] * wa + b[0] * wb) * R, (a[1] * wa + b[1] * wb) * R, (a[2] * wa + b[2] * wb) * R, nodes[i].g]); }
    }
    const LK = api.layer(links.length, { round: true, add: true });
    links.forEach((l, i) => { const c = TONES[l[3] % TONES.length]; LK.p.set([l[0], l[1], l[2]], i * 3); LK.c.set([c[0], c[1], c[2], .5], i * 4); LK.s[i] = .09; });
    // each feature: a core point, and a halo in its group's colour
    const NODE = api.layer(N * 2, { round: true, add: false, depth: false });
    nodes.forEach((n, i) => {
      const c = TONES[n.g % TONES.length];
      NODE.p.set(n.p, i * 3); NODE.c.set(n.live ? [.95, .96, .98, 1] : [.88, .66, .29, 1], i * 4); NODE.s[i] = .62;
      NODE.p.set(n.p, (N + i) * 3); NODE.c.set([c[0], c[1], c[2], .2], (N + i) * 4); NODE.s[N + i] = .95;
    });
    const CORE = api.layer(1, { round: true, add: true }); CORE.p.set([0, 0, 0]); CORE.c.set([.24, .73, .49, .5]); CORE.s[0] = 1.4;

    // labels: a small pool, given to the features that face the reader
    const pool = [...api.stage.querySelectorAll('[data-flabel]')];
    api.readout('f-live', String(nodes.filter(n => n.live).length));
    api.readout('f-build', String(nodes.filter(n => !n.live).length));
    api.readout('f-groups', String(groups.length));
    let frameN = 0, eyeDir = [0, -1, 0];
    api.after = (project) => {
      const scored = nodes.map((n, i) => [n.d[0] * eyeDir[0] + n.d[1] * eyeDir[1] + n.d[2] * eyeDir[2], i]).sort((a, b) => b[0] - a[0]);
      const show = scored.slice(0, pool.length);
      show.forEach(([f, i], k) => {
        const el = pool[k], n = nodes[i], q = project(n.p[0], n.p[1], n.p[2]);
        if (!q){ el.style.opacity = 0; return; }
        if (el.dataset.i !== String(i)){ el.dataset.i = i; el.firstChild.textContent = n.name + (n.live ? '' : ' · in build'); }
        el.style.transform = 'translate3d(' + q[0].toFixed(1) + 'px,' + q[1].toFixed(1) + 'px,0)';
        el.style.opacity = Math.max(0, Math.min(1, (f - .55) * 4)).toFixed(2);
      });
      if (frameN % 10 === 0){
        const g = groups[nodes[scored[0][1]].g];
        api.readout('f-front', g.name); api.readout('f-front-n', g.rows.length + ' features · ' + g.rows.filter(r => r.live).length + ' live');
      }
    };
    api.cam = Object.assign(api.cam, { az: 0, el: 16, dist: api.small ? 66 : 58, tx: 0, ty: 0, tz: 0, fov: 34, shiftX: api.small ? 0 : .2, shift: api.small ? .04 : 0, sway: .15 });
    api.fog = [.75, 1.35];
    let az = .3;
    return function frame(t, dt, scroll){
      if (!api.reduce) az += dt * .07;
      api.cam.az = az; api.cam.el = 16 + Math.sin(t / 15000) * 10 - scroll * 10;
      const el = api.cam.el * U.D2R; eyeDir = [Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), Math.sin(el)];
      frameN++;
      const pulse = .9 + .1 * Math.sin(t / 500);
      for (let i = 0; i < N; i++) NODE.s[i] = nodes[i].live ? .62 : .62 * pulse;
      NODE.dirty = true;
    };
  });
})();
