/* Finite-parcel ground light map — mounts on every [data-parcel-light] element.
   Illustrative model, stated on screen:
   - 1 ha array of archetype A (fixed, 12° to the equator, 4.5 m clearance → mean module height ≈ 4.8 m),
     10 east–west rows at 10 m pitch, 3 m module tables (GCR 0.30), inside a 120 × 120 m plot of open field.
   - Each 1 m ground cell: sky view factor from 400 cosine-weighted rays against the module plane (posts ignored);
     direct beam lit unless the ray to the sun hits a module; clear-sky DNI / DHI (Kasten–Young air mass).
   - Ground light = (DNI·sinh·lit + DHI·SVF) ÷ (DNI·sinh + DHI), i.e. % of the open field at that moment or day. */
(function(){
  'use strict';
  const D2R = Math.PI / 180, N = 120, H = 4.5 + 1.5 * Math.sin(12 * D2R), ARR = [10, 110], W2 = 1.5;
  const ROWC = Array.from({ length: 10 }, (_, j) => 15 + 10 * j);
  const PAR = [[0, [0, 34, 78]], [.17, [42, 63, 110]], [.33, [85, 91, 110]], [.5, [124, 123, 120]], [.67, [165, 156, 116]], [.83, [210, 192, 96]], [1, [254, 232, 56]]];
  const SITES = [['-7.6', 'Central Java, 7.6° S'], ['-33.9', 'Western Cape, 33.9° S'], ['48.1', 'Bavaria, 48.1° N']];
  const DATES = [['-23.44', '21 December'], ['0', '21 March'], ['23.44', '21 June']];

  const inRow = (hx, hy) => {
    if (hx < ARR[0] || hx > ARR[1]) return false;
    const c = Math.round((hy - 15) / 10);
    return c >= 0 && c <= 9 && Math.abs(hy - ROWC[c]) <= W2;
  };
  function sunVec(lat, dec, hours){
    const h = 15 * (hours - 12) * D2R, p = lat * D2R, d = dec * D2R;
    return { e: -Math.cos(d) * Math.sin(h), n: Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(h), u: Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(h) };
  }
  function irr(u){
    if (u <= 0.01) return { dni: 0, dhi: 0 };
    const el = Math.asin(u) / D2R, am = 1 / (u + 0.50572 * Math.pow(6.07995 + el, -1.6364)), t = Math.pow(0.7, Math.pow(am, 0.678));
    return { dni: 1361 * t, dhi: 0.3 * (1 - t) * 1361 * u };
  }
  function color(v){
    v = Math.max(0, Math.min(1, v));
    for (let i = 1; i < PAR.length; i++) if (v <= PAR[i][0]){
      const [a, ca] = PAR[i - 1], [b, cb] = PAR[i], k = (v - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
    return PAR[PAR.length - 1][1];
  }
  // sky view factor, computed once (geometry is fixed)
  let SVF = null;
  function computeSVF(){
    const S = 20, dirs = [];
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++){
      const u1 = (i + .5) / S, u2 = (j + .5) / S + (i % 2) * .5 / S, r = Math.sqrt(u1), ph = 2 * Math.PI * u2, dz = Math.sqrt(1 - u1);
      dirs.push([r * Math.cos(ph) * H / dz, r * Math.sin(ph) * H / dz]);
    }
    const out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
      const cx = x + .5, cy = y + .5; let open = 0;
      for (const d of dirs) if (!inRow(cx + d[0], cy + d[1])) open++;
      out[y * N + x] = open / dirs.length;
    }
    return out;
  }
  const zoneOf = (x, y) => {
    const cx = x + .5, cy = y + .5;
    if (cx < ARR[0] || cx > ARR[1] || cy < ARR[0] || cy > ARR[1]) return 'open';
    const d = Math.min(cx - ARR[0], ARR[1] - cx, cy - ARR[0], ARR[1] - cy);
    return d < 10 ? 'edge' : d > 25 ? 'int' : 'mid';
  };

  function mount(root){
    root.classList.add('pl');
    root.innerHTML =
      '<div class="pl__stage"><canvas aria-hidden="true"></canvas><div class="pl__tip" hidden></div>' +
      
      '<div class="pl__badge">Illustrative model · one site · archetype A</div></div>' +
      '<div class="pl__side">' +
        '<div class="pl__seg" role="radiogroup" aria-label="What the map shows">' +
          '<button type="button" role="radio" aria-checked="true" data-m="svf">Sky view</button>' +
          '<button type="button" role="radio" aria-checked="false" data-m="day">Whole day</button>' +
          '<button type="button" role="radio" aria-checked="false" data-m="now">At a time</button></div>' +
        '<div class="pl__row"><label>Site<select data-k="lat">' + SITES.map(([v, t]) => '<option value="' + v + '"' + (v === '48.1' ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
        '<label>Date<select data-k="dec">' + DATES.map(([v, t]) => '<option value="' + v + '"' + (v === '23.44' ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label></div>' +
        '<label class="pl__time" hidden>Solar time <b>12:00</b><input type="range" min="300" max="1140" step="10" value="720" aria-label="Solar time"></label>' +
        '<dl class="pl__out">' +
          '<div><dt>Interior</dt><dd data-o="int">—</dd></div>' +
          '<div><dt>Edge rows</dt><dd data-o="edge">—</dd></div>' +
          '<div><dt>Array mean</dt><dd data-o="mean">—</dd></div></dl>' +
        '<div class="pl__legend"><span data-lo>0%</span><i></i><span data-hi>100%</span></div>' +
        '<p class="pl__legend-cap">Colours span the array&#39;s own range; the open field around it is dimmed. Values are % of the open field.</p>' +
        '<p class="pl__note" aria-live="polite"></p>' +
        '<p class="pl__fine">Modules drawn as outlines. Posts, module transmission and reflections are left out. A screening picture, not a design result.</p>' +
      '</div>';
    const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), off = document.createElement('canvas');
    off.width = off.height = N; const octx = off.getContext('2d'), img = octx.createImageData(N, N);
    const state = { m: 'svf', lat: 48.1, dec: 23.44, min: 720 }, val = new Float32Array(N * N);
    const tip = root.querySelector('.pl__tip'), note = root.querySelector('.pl__note'), timeL = root.querySelector('.pl__time');

    function field(){
      if (!SVF) return;
      if (state.m === 'svf'){ val.set(SVF); return; }
      const hrs = state.m === 'now' ? [state.min / 60] : Array.from({ length: 65 }, (_, i) => 4 + i * .25);
      const num = new Float32Array(N * N); let ref = 0;
      for (const h of hrs){
        const s = sunVec(state.lat, state.dec, h), I = irr(s.u);
        if (I.dni + I.dhi <= 0) continue;
        const b = I.dni * s.u, kx = s.e * H / s.u, ky = s.n * H / s.u;
        ref += b + I.dhi;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
          const i = y * N + x, lit = inRow(x + .5 + kx, y + .5 + ky) ? 0 : 1;
          num[i] += b * lit + I.dhi * SVF[i];
        }
      }
      for (let i = 0; i < N * N; i++) val[i] = ref > 0 ? num[i] / ref : 0;
    }
    function stats(){
      const acc = { int: [0, 0], edge: [0, 0], arr: [0, 0] };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
        const z = zoneOf(x, y), v = val[y * N + x];
        if (z === 'open') continue;
        acc.arr[0] += v; acc.arr[1]++;
        if (z === 'int'){ acc.int[0] += v; acc.int[1]++; }
        if (z === 'edge'){ acc.edge[0] += v; acc.edge[1]++; }
      }
      const m = (a) => a[1] ? a[0] / a[1] : 0;
      return { int: m(acc.int), edge: m(acc.edge), arr: m(acc.arr) };
    }
    let lo = 0, hi = 1;
    function range(){
      lo = 1; hi = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ if (zoneOf(x, y) === 'open') continue; const v = val[y * N + x]; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo < 0.05){ lo = Math.max(0, hi - 0.05); }
      root.querySelector('[data-lo]').textContent = Math.round(lo * 100) + '%';
      root.querySelector('[data-hi]').textContent = Math.round(hi * 100) + '%';
    }
    function draw(){
      const r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2), S = Math.round(r.width * dpr);
      if (!S) return;
      if (cv.width !== S){ cv.width = cv.height = S; }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
        const c = color(Math.min(1, Math.max(0, (val[y * N + x] - lo) / (hi - lo || 1)))), o = ((N - 1 - y) * N + x) * 4;   // north up
        const f = zoneOf(x, y) === 'open' ? .1 : 1;                                       // open field = dimmed context
        img.data[o] = c[0] * f + 7 * (1 - f); img.data[o + 1] = c[1] * f + 9 * (1 - f); img.data[o + 2] = c[2] * f + 12 * (1 - f); img.data[o + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, 0, 0, S, S);
      const k = S / N, Y = (m) => S - m * k;
      ctx.lineWidth = Math.max(1, dpr * .8); ctx.strokeStyle = 'rgba(232,238,246,.55)';
      ROWC.forEach(c => ctx.strokeRect(ARR[0] * k, Y(c + W2), (ARR[1] - ARR[0]) * k, 2 * W2 * k));
      ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.strokeStyle = 'rgba(169,216,65,.8)';
      ctx.strokeRect(ARR[0] * k, Y(ARR[1]), (ARR[1] - ARR[0]) * k, (ARR[1] - ARR[0]) * k); ctx.setLineDash([]);
      // north arrow + scale bar
      ctx.fillStyle = 'rgba(232,238,246,.9)'; ctx.font = `600 ${11 * dpr}px "JetBrains Mono", monospace`;
      ctx.beginPath(); ctx.moveTo(S - 22 * dpr, 12 * dpr); ctx.lineTo(S - 27 * dpr, 24 * dpr); ctx.lineTo(S - 17 * dpr, 24 * dpr); ctx.fill();
      ctx.fillText('N', S - 26 * dpr, 37 * dpr);
      ctx.fillRect(12 * dpr, S - 16 * dpr, 20 * k, 2 * dpr); ctx.fillText('20 m', 12 * dpr, S - 22 * dpr);
      if (state.m === 'now'){
        const s = sunVec(state.lat, state.dec, state.min / 60);
        if (s.u > 0.01){
          const L = Math.hypot(s.e, s.n) || 1, cx = S / 2, cy = S / 2, R = S * .46;
          const sx = cx + (s.e / L) * R, sy = cy - (s.n / L) * R;
          ctx.fillStyle = '#f5b83d'; ctx.beginPath(); ctx.arc(sx, sy, 7 * dpr, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(245,184,61,.7)'; ctx.setLineDash([3 * dpr, 4 * dpr]); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }
    function update(){
      field(); range(); draw();
      const s = stats(), p = (v) => Math.round(v * 100) + '%';
      root.querySelector('[data-o="int"]').textContent = p(s.int);
      root.querySelector('[data-o="edge"]').textContent = p(s.edge);
      root.querySelector('[data-o="mean"]').textContent = p(s.arr);
      const g = s.int > 0 ? Math.round((s.edge / s.int - 1) * 100) : 0, gm = s.int > 0 ? Math.round((s.arr / s.int - 1) * 100) : 0;
      const what = state.m === 'svf' ? 'sky' : 'light';
      note.textContent = state.m === 'now' && s.int === 0 && s.edge === 0 ? 'The sun is below the horizon at this time.'
        : `In this model the edge zone gets ${g >= 0 ? '+' + g : g} % ${what} against the interior, and the array mean sits ${gm >= 0 ? '+' + gm : gm} % above it. Infinite-row tools report the interior value for the whole field.`;
    }
    root.querySelectorAll('.pl__seg button').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('.pl__seg button').forEach(o => o.setAttribute('aria-checked', String(o === b)));
      state.m = b.dataset.m; timeL.hidden = state.m !== 'now'; update();
    }));
    root.querySelectorAll('select').forEach(s => s.addEventListener('change', () => { state[s.dataset.k] = +s.value; update(); }));
    const rng = timeL.querySelector('input');
    rng.addEventListener('input', () => {
      state.min = +rng.value; const t = String(Math.floor(state.min / 60)).padStart(2, '0') + ':' + String(state.min % 60).padStart(2, '0');
      timeL.querySelector('b').textContent = t; rng.setAttribute('aria-valuetext', t + ' solar time'); update();
    });
    cv.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * N), y = N - 1 - Math.floor((e.clientY - r.top) / r.height * N);
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      const z = zoneOf(x, y);
      tip.hidden = false; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
      tip.textContent = Math.round(val[y * N + x] * 100) + '% · ' + (z === 'open' ? 'open field' : z === 'int' ? 'interior' : z === 'edge' ? 'edge zone' : 'array');
    });
    cv.addEventListener('pointerleave', () => { tip.hidden = true; });
    new ResizeObserver(() => draw()).observe(cv);
    note.textContent = 'Computing sky view for 14,400 ground cells…';
    setTimeout(() => { if (!SVF) SVF = computeSVF(); update(); }, 30);
  }

  const css = `
  .pl{display:grid; grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr); gap:20px; align-items:start}
  @media (max-width:860px){.pl{grid-template-columns:minmax(0,1fr)}} .pl > *{min-width:0}
  .pl__stage{position:relative; border-radius:6px; overflow:hidden; border:1px solid var(--line-2); background:var(--inset); aspect-ratio:1}
  .pl__stage canvas{width:100%; height:100%; display:block; touch-action:none}
  .pl__tip{position:absolute; transform:translate(10px,-130%); padding:5px 9px; border-radius:4px; background:rgba(7,11,18,.92); border:1px solid var(--line-2); font:600 12px var(--f-mono); color:var(--text); pointer-events:none; white-space:nowrap}
  .pl__legend{display:flex; align-items:center; gap:10px; font:600 11px var(--f-mono); color:var(--text-2)}
  .pl__legend-cap{margin:-8px 0 0; font-size:12px; color:var(--text-3)}
  .pl__legend i{flex:1; height:8px; border-radius:4px; background:linear-gradient(90deg,var(--par-0),var(--par-1),var(--par-2),var(--par-3),var(--par-4),var(--par-5),var(--par-6))}
  .pl__badge{position:absolute; left:12px; top:12px; padding:5px 9px; border-radius:3px; background:rgba(4,5,6,.8); border:1px solid var(--line-2); font:500 10.5px var(--f-mono); letter-spacing:.02em; text-transform:none; color:var(--text-3)}
  .pl__side{display:flex; flex-direction:column; gap:16px; padding:20px; border-radius:6px; border:1px solid var(--line); background:var(--card)}
  .pl__seg{display:grid; grid-template-columns:repeat(3,1fr); padding:4px; gap:4px; border-radius:6px; background:var(--inset); border:1px solid var(--line-2)}
  .pl__seg button{min-height:40px; border:0; border-radius:4px; background:transparent; color:var(--text-2); font:500 12px var(--f-mono); letter-spacing:.04em; cursor:pointer}
  .pl__seg button[aria-checked="true"]{background:var(--card-hover); color:var(--text); box-shadow:inset 0 0 0 1px var(--line-2), inset 0 -2px 0 var(--sunleaf)}
  .pl__row{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px} .pl select{width:100%; min-width:0}
  .pl label{display:flex; flex-direction:column; gap:6px; font:600 11px var(--f-body); letter-spacing:.06em; text-transform:none; color:var(--text-2)}
  .pl label b{color:var(--text); font-family:var(--f-mono); letter-spacing:0}
  .pl select{min-height:42px; padding:0 10px; border-radius:4px; border:1px solid var(--line-2); background:var(--inset); color:var(--text); font:500 13px var(--f-body); text-transform:none; letter-spacing:0}
  .pl input[type=range]{accent-color:var(--sunleaf); width:100%; min-height:28px}
  .pl__out{display:grid; grid-template-columns:repeat(3,1fr); gap:0; margin:0; border:1px solid var(--line); border-radius:6px; overflow:hidden}
  .pl__out div{padding:12px 12px 10px; border-left:1px solid var(--line); background:var(--inset)}
  .pl__out div:first-child{border-left:0}
  .pl__out dt{font:600 10.5px var(--f-body); letter-spacing:.06em; text-transform:none; color:var(--text-2)}
  .pl__out dd{margin:4px 0 0; font:400 28px/1.05 var(--f-display); letter-spacing:-.04em; font-variant-numeric:tabular-nums; color:var(--text)}
  .pl__out div:nth-child(2) dd{color:var(--par-6)}
  .pl__note{margin:0; font-size:14px; color:var(--text-2); line-height:1.55}
  .pl__fine{margin:0; font-size:12px; color:var(--text-3); border-top:1px solid var(--line); padding-top:12px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  document.querySelectorAll('[data-parcel-light]').forEach(mount);
})();
