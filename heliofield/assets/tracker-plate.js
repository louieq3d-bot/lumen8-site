/* Plate I — light under a single-axis tracker array. Mounts on every [data-tracker-plate].
   Physics notes are in the comment block inside mount(). */
(function(){
  'use strict';
  const CSS = `
.tp{display:grid; grid-template-columns:minmax(0,1.35fr) minmax(280px,.9fr); gap:20px; align-items:start}
@media (max-width:960px){.tp{grid-template-columns:minmax(0,1fr)}}
.tp__stage{position:relative; border-radius:6px; overflow:hidden; border:1px solid var(--line-2); background:var(--inset)}
.tp__stage svg{width:100%; height:auto; display:block}
.tp__side{display:flex; flex-direction:column; gap:14px}
.tp .controls{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; padding:18px; border:1px solid var(--line); border-radius:6px; background:var(--card)}
.tp .ctrl-row{display:flex; flex-direction:column; gap:8px; min-width:0}
.tp .ctrl-row--wide{grid-column:1 / -1}
.tp .ctrl-row label,.tp .ctrl-legend{display:flex; justify-content:space-between; font:600 11px var(--f-body); letter-spacing:.06em; text-transform:none; color:var(--text-2)}
.tp .ctrl-row label b{font-family:var(--f-mono); color:var(--text); letter-spacing:0}
.tp .ctrl-inline{display:flex; align-items:center; gap:12px}
.tp input[type=range]{flex:1; accent-color:var(--sunleaf); min-height:28px}
.tp select{width:100%; min-width:0; min-height:42px; padding:0 10px; border-radius:4px; border:1px solid var(--line-2); background:var(--inset); color:var(--text); font:500 13px var(--f-body)}
.tp .play{flex:none; width:44px; height:44px; border-radius:50%; border:1px solid var(--line-2); background:var(--fill); color:var(--text); display:grid; place-items:center; cursor:pointer}
.tp .play:hover{background:var(--sunleaf); color:var(--on-sunleaf)}
.tp .play svg{width:14px; height:14px}
.tp .seg{display:grid; grid-template-columns:repeat(3,1fr); gap:4px; padding:4px; border-radius:6px; background:var(--inset); border:1px solid var(--line-2)}
.tp .seg button{min-height:44px; border:0; border-radius:4px; background:transparent; color:var(--text-2); font:600 12.5px/1.25 var(--f-body); cursor:pointer; padding:6px}
.tp .seg button[aria-checked="true"]{background:var(--card-hover); color:var(--text); box-shadow:inset 0 0 0 1px var(--line-2), inset 0 -2px 0 var(--sunleaf)}
@media (max-width:520px){.tp .controls{grid-template-columns:minmax(0,1fr)} .tp .seg{grid-template-columns:minmax(0,1fr)}}
.tp .lux{padding:18px; border:1px solid var(--line); border-radius:6px; background:var(--card)}
.tp .lux__head{display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; font:600 11px var(--f-body); letter-spacing:.06em; text-transform:none; color:var(--text-2); margin-bottom:12px}
.tp .lux__head em{font-style:normal; color:var(--text)}
.tp .lux__grid{display:grid; grid-template-columns:repeat(3,1fr); margin:0; border:1px solid var(--line); border-radius:6px; overflow:hidden}
.tp .lux__grid > div{padding:12px; background:var(--inset); border-left:1px solid var(--line)}
.tp .lux__grid > div:first-child{border-left:0}
.tp .lux__grid dt{font:600 10.5px var(--f-body); letter-spacing:.05em; text-transform:none; color:var(--text-2)}
.tp .lux__grid dd{margin:4px 0 0; font:400 28px/1.05 var(--f-display); letter-spacing:-.04em; font-variant-numeric:tabular-nums}
.tp .lux__grid > div:first-child dd{color:var(--energy)}
.tp .lux__grid dd .d{display:block; margin-top:2px; font:600 11.5px var(--f-mono)}
.tp .d.up{color:var(--crop)} .tp .d.dn{color:var(--cost)}
.tp .lux__grid small{display:block; font-size:11.5px; color:var(--text-3); margin-top:2px}
.tp .lux__note{margin:12px 0 0; font-size:14px; line-height:1.55; color:var(--text-2)}
@media (max-width:420px){.tp .lux__grid{grid-template-columns:minmax(0,1fr)} .tp .lux__grid > div{border-left:0; border-top:1px solid var(--line)}}
`;
  const MARKUP = `<svg viewBox="0 0 520 400" id="heroSvg" role="img" aria-labelledby="plateTitle plateDesc">
            <title id="plateTitle">Section through a single-axis tracker array over crop beds</title>
            <desc id="plateDesc">Four tracker rows, hub 2.5 metres, pitch 9.5 metres. The sun moves east to west for the chosen site and date; each module rotates according to the chosen policy and casts a shadow away from the sun. Two strips under the ground show relative ground light now and over the whole day.</desc>
            <defs>
              <pattern id="pgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="0.5"/>
              </pattern>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop id="skyTop" offset="0" stop-color="#dfe8e4"/>
                <stop id="skyBot" offset="1" stop-color="#f4efe2"/>
              </linearGradient>
              <pattern id="soilHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#6b5a3c" stroke-width="0.6" opacity="0.5"/>
              </pattern>
            </defs>

            <rect x="0" y="0" width="520" height="250" fill="url(#skyGrad)"/>
            <rect x="0" y="0" width="520" height="400" fill="url(#pgrid)"/>

            <!-- sun path for the chosen site + date (orthographic, looking north) -->
            <path id="sunPath" d="" fill="none" stroke="var(--text-3)" stroke-width="0.7" stroke-dasharray="2 4"/>
            <g id="sunG">
              <circle id="sunHalo" r="22" fill="var(--energy)" opacity="0.16"/>
              <circle id="sunDisc" r="10" fill="var(--energy)" stroke="var(--text)" stroke-width="0.8"/>
            </g>

            <!-- rays + ground shadows (dynamic) -->
            <g id="rays" stroke="var(--energy)" stroke-width="0.7" stroke-dasharray="3 3" opacity="0.75"></g>

            <!-- ground -->
            <rect x="0" y="250" width="520" height="12" fill="url(#soilHatch)"/>
            <g id="shadows"></g>
            <line x1="0" y1="250" x2="520" y2="250" stroke="var(--text)" stroke-width="0.8"/>
            <g id="crops" stroke="var(--crop)" stroke-width="1" stroke-linecap="round"></g>

            <!-- structure (posts + rotating modules) -->
            <g id="rig"></g>

            <!-- annotations -->
            <g font-family="var(--mono)" font-size="8.5" fill="var(--text-2)" letter-spacing="0.06em">
              <text x="12" y="243">W</text>
              <text x="508" y="243" text-anchor="end">E</text>
              <text id="sunTag" x="0" y="0" text-anchor="middle">SUN</text>
              <g id="dimHub"></g>
              <g id="dimPitch"></g>
            </g>

            <!-- light ribbons -->
            <g font-family="var(--mono)" font-size="8" fill="var(--text-2)" letter-spacing="0.1em">
              <text x="12" y="291">NOW</text>
              <text x="12" y="317">DAY</text>
            </g>
            <g id="ribNow"></g>
            <g id="ribDay"></g>
            <g id="zones" font-family="var(--mono)" font-size="8" fill="var(--text-2)" letter-spacing="0.08em" text-anchor="middle"></g>
            <g font-family="var(--mono)" font-size="7.5" fill="var(--text-3)" letter-spacing="0.06em">
              <text x="40" y="384">GROUND LIGHT, % OF OPEN FIELD · 0</text>
              <rect id="legendBar" x="205" y="378" width="120" height="7"/>
              <text x="331" y="384">100 · ILLUSTRATIVE 2-D MODEL</text>
            </g>
          </svg>
<div class="controls controls--plate" aria-label="Light under the array controls">
          <div class="ctrl-row ctrl-row--wide">
            <label for="timeRange"><span>Solar time</span><b id="timeLabel">10:00</b></label>
            <div class="ctrl-inline">
              <button type="button" class="play" id="playBtn" aria-pressed="true" aria-label="Pause the sun animation">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path id="playIcon" d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>
              </button>
              <input type="range" id="timeRange" min="240" max="1200" step="5" value="600" aria-label="Solar time of day" aria-valuetext="10:00">
            </div>
          </div>
          <div class="ctrl-row">
            <label for="siteSel"><span>Site</span></label>
            <select id="siteSel">
              <option value="-7.6">Central Java, 7.6° S</option>
              <option value="-33.9" selected>Western Cape, 33.9° S</option>
              <option value="48.1">Bavaria, 48.1° N</option>
            </select>
          </div>
          <div class="ctrl-row">
            <label for="dateSel"><span>Date</span></label>
            <select id="dateSel">
              <option value="-23.44">21 December</option>
              <option value="0" selected>21 March</option>
              <option value="23.44">21 June</option>
            </select>
          </div>
          <div class="ctrl-row ctrl-row--wide">
            <span class="ctrl-legend" id="polLegend">Tracker policy</span>
            <div class="seg" role="radiogroup" aria-labelledby="polLegend">
              <button type="button" role="radio" aria-checked="true" data-pol="track">Follow the sun</button>
              <button type="button" role="radio" aria-checked="false" data-pol="crop">Give light back 10–14 h</button>
              <button type="button" role="radio" aria-checked="false" data-pol="flat">Hold flat</button>
            </div>
          </div>
        </div>
<div class="lux" aria-live="polite">
          <div class="lux__head"><span>Illustrative model · day totals</span><em id="luxWhen">21 March · Western Cape</em></div>
          <div class="lux__grid">
            <div><dt>Energy captured</dt><dd id="kEnergy">—</dd><small>vs following the sun</small></div>
            <div><dt>Ground light · interior</dt><dd id="kInt">—</dd><small>% of open field</small></div>
            <div><dt>Ground light · edge rows</dt><dd id="kEdge">—</dd><small>% of open field</small></div>
          </div>
          <p class="lux__note" id="luxNote">Edge rows see more sky than the interior. That is the effect infinite-row models miss.</p>
        </div>`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  function mount(root){
    root.classList.add('tp');
    root.innerHTML = '<div class="tp__stage"></div><div class="tp__side"></div>';
    const tmp = document.createElement('div'); tmp.innerHTML = MARKUP;
    root.querySelector('.tp__stage').appendChild(tmp.querySelector('svg'));
    const side = root.querySelector('.tp__side');
    [...tmp.children].forEach(c => side.appendChild(c));
  /* ============================================================
     SIGNATURE INTERACTION — Plate I, light under a tracker array
     An honest, illustrative 2-D section (looking north, east on the right):
     - sun vector from latitude, declination and solar time
     - clear-sky DNI / DHI (Kasten–Young air mass, Meinel-type transmittance)
     - four N–S tracker rows, hub 2.5 m, pitch 9.5 m, module width = GCR 0.30 × pitch
     - ground point lit directly unless a module shadow covers it (projection along the sun ray)
     - diffuse = DHI × 2-D sky view factor (crossed-strings: ½|sinβ₁ − sinβ₂| per module)
     - module energy = DNI·cos(incidence) + DHI·(1+cosθ)/2 (no row-to-row shading, no backtracking)
     ============================================================ */
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => root.querySelector('#' + id);
  const svgEl = root.querySelector('#heroSvg');
  if (svgEl){
    const D2R = Math.PI / 180;
    const G = 250, FIELD = 44, X0 = 36, K = 470 / FIELD;     // px per metre, true scale both axes
    const X = (m) => X0 + m * K;
    const Y = (h) => G - h * K;
    const HUB = 2.5, PITCH = 9.5, GCR = 0.30, HW = (GCR * PITCH) / 2, LIMIT = 55;
    const ROWS = [7.75, 17.25, 26.75, 36.25];
    const EDGE = [[3, 12.5], [31.5, 41]], INTERIOR = [12.5, 31.5];
    const STEP = 0.25, XS = [];
    for (let m = STEP / 2; m < FIELD; m += STEP) XS.push(m);
    const DOME = { cx: 260, cy: G, r: 205 };

    const state = { min: 600, lat: -33.9, dec: 0, pol: 'track', playing: true };
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = () => true;

    function sunVec(lat, dec, hours){
      const H = 15 * (hours - 12) * D2R, p = lat * D2R, d = dec * D2R;
      return {
        e: -Math.cos(d) * Math.sin(H),
        n: Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H),
        u: Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H)
      };
    }
    function irr(u){
      if (u <= 0.005) return { dni: 0, dhi: 0 };
      const el = Math.asin(u) / D2R;
      const am = 1 / (u + 0.50572 * Math.pow(6.07995 + el, -1.6364));
      const t = Math.pow(0.7, Math.pow(am, 0.678));
      return { dni: 1361 * t, dhi: 0.3 * (1 - t) * 1361 * u };
    }
    const clamp = (v) => Math.max(-LIMIT, Math.min(LIMIT, v));
    function tilt(pol, s, hours){
      if (pol === 'flat' || s.u <= 0) return 0;
      const ideal = Math.atan2(s.e, s.u) / D2R;              // + faces east
      if (pol === 'crop' && hours >= 10 && hours <= 14) return clamp(ideal >= 0 ? ideal - 90 : ideal + 90);
      return clamp(ideal);
    }
    function modules(theta){
      const c = Math.cos(theta * D2R), s = Math.sin(theta * D2R);
      return ROWS.map(xc => ({ a: { x: xc + HW * c, y: HUB - HW * s }, b: { x: xc - HW * c, y: HUB + HW * s } }));
    }
    function shadowSpans(mods, s){
      if (s.u <= 0.005) return [];
      const k = s.e / s.u;
      return mods.map(m => { const p = m.a.x - m.a.y * k, q = m.b.x - m.b.y * k; return [Math.min(p, q), Math.max(p, q)]; });
    }
    function svf(x, mods){
      let blocked = 0;
      for (const m of mods){
        const ax = m.a.x - x, bx = m.b.x - x;
        blocked += 0.5 * Math.abs(ax / Math.hypot(ax, m.a.y) - bx / Math.hypot(bx, m.b.y));
      }
      return Math.max(0, 1 - blocked);
    }
    // Ground light at every sample for one instant: returns {num[], ref, poa, theta, s, spans, mods}
    function instant(pol, lat, dec, hours){
      const s = sunVec(lat, dec, hours), I = irr(s.u), theta = tilt(pol, s, hours), mods = modules(theta);
      const spans = shadowSpans(mods, s), ref = I.dni * Math.max(0, s.u) + I.dhi;
      const num = XS.map(x => {
        let lit = 1;
        for (const sp of spans) if (x >= sp[0] && x <= sp[1]) { lit = 0; break; }
        return I.dni * Math.max(0, s.u) * lit + I.dhi * svf(x, mods);
      });
      const ci = Math.sin(theta * D2R) * s.e + Math.cos(theta * D2R) * s.u;
      const poa = I.dni * Math.max(0, ci) + I.dhi * (1 + Math.cos(theta * D2R)) / 2;
      return { num, ref, poa, theta, s, spans, mods };
    }
    function day(pol, lat, dec){
      const num = XS.map(() => 0); let ref = 0, poa = 0;
      for (let h = 4; h <= 20; h += 1 / 6){
        const r = instant(pol, lat, dec, h);
        if (r.ref <= 0) continue;
        r.num.forEach((v, i) => { num[i] += v; });
        ref += r.ref; poa += r.poa;
      }
      return { num, ref, poa };
    }
    const zoneMean = (vals, spans) => {
      let s = 0, n = 0;
      XS.forEach((x, i) => { if (spans.some(z => x >= z[0] && x < z[1])) { s += vals[i]; n++; } });
      return n ? s / n : 0;
    };

    // ---------- colour ramp (ground light 0..1) ----------
    const RAMP = [[0, [0, 34, 78]], [.17, [42, 63, 110]], [.33, [85, 91, 110]], [.5, [124, 123, 120]], [.67, [165, 156, 116]], [.83, [210, 192, 96]], [1, [254, 232, 56]]];
    function ramp(v){
      v = Math.max(0, Math.min(1, v));
      for (let i = 1; i < RAMP.length; i++){
        if (v <= RAMP[i][0]){
          const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], t = (v - a) / (b - a);
          return 'rgb(' + ca.map((c, j) => Math.round(c + (cb[j] - c) * t)).join(',') + ')';
        }
      }
      return 'rgb(254,232,56)';
    }

    // ---------- build static SVG parts ----------
    const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent && parent.appendChild(n); return n; };
    const defs = svgEl.querySelector('defs');
    const lg = el('linearGradient', { id: 'legGrad', x1: '0', x2: '1', y1: '0', y2: '0' }, defs);
    RAMP.forEach(([o, c]) => el('stop', { offset: o, 'stop-color': 'rgb(' + c.join(',') + ')' }, lg));
    $('legendBar').setAttribute('fill', 'url(#legGrad)');

    const crops = $('crops');
    for (let m = 0.45; m < FIELD; m += 0.6){
      const x = X(m);
      el('path', { d: `M${x.toFixed(1)} ${G} l-1.6 -4.2 M${x.toFixed(1)} ${G} l1.6 -4.2 M${x.toFixed(1)} ${G} v-5.4` }, crops);
    }
    const rig = $('rig'), modEls = [];
    ROWS.forEach(xc => {
      el('line', { x1: X(xc), y1: G, x2: X(xc), y2: Y(HUB), stroke: 'var(--text)', 'stroke-width': 1.4 }, rig);
      el('line', { x1: X(xc) - 5, y1: G, x2: X(xc) + 5, y2: G, stroke: 'var(--text)', 'stroke-width': 2 }, rig);
      modEls.push(el('line', { stroke: 'var(--text)', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, rig));
      el('circle', { cx: X(xc), cy: Y(HUB), r: 2.4, fill: 'var(--card)', stroke: 'var(--text)', 'stroke-width': 1 }, rig);
    });
    // dimensions
    const dh = $('dimHub'), hx = X(ROWS[0]) - 24;
    el('line', { x1: hx, y1: G, x2: hx, y2: Y(HUB), stroke: 'var(--text-2)', 'stroke-width': 0.6 }, dh);
    el('line', { x1: hx - 3, y1: Y(HUB), x2: hx + 3, y2: Y(HUB), stroke: 'var(--text-2)', 'stroke-width': 0.6 }, dh);
    el('text', { x: hx - 4, y: Y(HUB) - 6, 'text-anchor': 'middle' }, dh).textContent = 'HUB 2.5 m';
    const dp = $('dimPitch'), py = 272;
    el('line', { x1: X(ROWS[1]), y1: py, x2: X(ROWS[2]), y2: py, stroke: 'var(--text-2)', 'stroke-width': 0.6 }, dp);
    [ROWS[1], ROWS[2]].forEach(r => el('line', { x1: X(r), y1: py - 3, x2: X(r), y2: py + 3, stroke: 'var(--text-2)', 'stroke-width': 0.6 }, dp));
    el('text', { x: (X(ROWS[1]) + X(ROWS[2])) / 2, y: py - 3, 'text-anchor': 'middle' }, dp).textContent = 'Pitch 9.5 m · GCR 0.30';
    // ribbons
    const ribNow = [], ribDay = [], rw = STEP * K + 0.4;
    XS.forEach(x => {
      ribNow.push(el('rect', { x: (X(x - STEP / 2)).toFixed(2), y: 282, width: rw.toFixed(2), height: 13 }, $('ribNow')));
      ribDay.push(el('rect', { x: (X(x - STEP / 2)).toFixed(2), y: 308, width: rw.toFixed(2), height: 13 }, $('ribDay')));
    });
    // zone brackets
    const zones = $('zones');
    [[0, 3, 'OPEN'], [3, 12.5, 'EDGE'], [12.5, 31.5, 'Interior'], [31.5, 41, 'EDGE'], [41, 44, 'OPEN']].forEach(([a, b, t]) => {
      el('line', { x1: X(a) + 1, y1: 330, x2: X(b) - 1, y2: 330, stroke: t === 'OPEN' ? 'var(--line-3)' : 'var(--text-2)', 'stroke-width': 0.8 }, zones);
      el('line', { x1: X(a) + 1, y1: 327, x2: X(a) + 1, y2: 333, stroke: 'var(--text-2)', 'stroke-width': 0.6 }, zones);
      el('line', { x1: X(b) - 1, y1: 327, x2: X(b) - 1, y2: 333, stroke: 'var(--text-2)', 'stroke-width': 0.6 }, zones);
      el('text', { x: (X(a) + X(b)) / 2, y: 345 }, zones).textContent = t === 'OPEN' ? 'OPEN' : t;
    });
    const zoneVals = {};
    [['eW', 7.75], ['int', 22], ['eE', 36.25]].forEach(([k, m]) => { zoneVals[k] = el('text', { x: X(m), y: 358, fill: 'var(--text)', 'font-size': 9 }, zones); });

    // ---------- render ----------
    let dayCache = null, dayKey = '';
    function fmt(min){ const h = Math.floor(min / 60), m = Math.round(min % 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
    function sky(u){
      const elv = Math.asin(Math.max(-1, Math.min(1, u))) / D2R, dk = dark();
      const pal = dk ? { night: ['#040507', '#07080b'], low: ['#17120f', '#08090c'], high: ['#0c1119', '#07090c'] }
                     : { night: ['#cfd3d6', '#e8e2d6'], low: ['#f2d3b2', '#f7e8d0'], high: ['#d7e6e8', '#f4efe2'] };
      const p = elv < 0 ? pal.night : elv < 12 ? pal.low : pal.high;
      $('skyTop').setAttribute('stop-color', p[0]); $('skyBot').setAttribute('stop-color', p[1]);
    }
    function render(){
      const hours = state.min / 60;
      const key = state.pol + '|' + state.lat + '|' + state.dec;
      if (key !== dayKey){
        dayKey = key;
        const d = day(state.pol, state.lat, state.dec), t = state.pol === 'track' ? d : day('track', state.lat, state.dec);
        dayCache = { d, t };
        // sun path
        let path = '';
        for (let h = 4; h <= 20.001; h += 0.1){
          const s = sunVec(state.lat, state.dec, h);
          if (s.u < 0) continue;
          path += (path ? 'L' : 'M') + (DOME.cx + DOME.r * s.e).toFixed(1) + ' ' + (DOME.cy - DOME.r * s.u).toFixed(1);
        }
        $('sunPath').setAttribute('d', path);
        // day ribbons + day totals
        const rel = d.num.map(v => d.ref ? v / d.ref : 0), relT = t.num.map(v => t.ref ? v / t.ref : 0);
        rel.forEach((v, i) => ribDay[i].setAttribute('fill', ramp(v)));
        const kI = zoneMean(rel, [INTERIOR]), kE = zoneMean(rel, EDGE);
        const kIt = zoneMean(relT, [INTERIOR]), kEt = zoneMean(relT, EDGE);
        const en = t.poa ? d.poa / t.poa : 0;
        const pct = (v) => Math.round(v * 100);
        const delta = (v, base) => { const p = pct(v) - pct(base); return p === 0 ? '' : `<span class="d ${p > 0 ? 'up' : 'dn'}">${p > 0 ? '+' : ''}${p} pts</span>`; };
        $('kEnergy').innerHTML = pct(en) + '%' + (state.pol === 'track' ? '' : `<span class="d ${en < 1 ? 'dn' : 'up'}">${pct(en) - 100} %</span>`);
        $('kInt').innerHTML = pct(kI) + '%' + (state.pol === 'track' ? '' : delta(kI, kIt));
        $('kEdge').innerHTML = pct(kE) + '%' + (state.pol === 'track' ? '' : delta(kE, kEt));
        zoneVals.eW.textContent = pct(zoneMean(rel, [EDGE[0]])) + '%';
        zoneVals.int.textContent = pct(kI) + '%';
        zoneVals.eE.textContent = pct(zoneMean(rel, [EDGE[1]])) + '%';
        const edgeGain = kI > 0 ? Math.round((kE / kI - 1) * 100) : 0;
        let note = `In this section the edge rows get ${edgeGain >= 0 ? edgeGain + ' % more' : Math.abs(edgeGain) + ' % less'} daily light than the interior — the effect infinite-row models leave out.`;
        if (state.pol === 'crop') note = `Turning the trackers away from the sun between 10:00 and 14:00 costs ${100 - pct(en)} % of the day's module energy and lifts interior ground light by ${pct(kI) - pct(kIt)} points. That trade-off is the product.`;
        if (state.pol === 'flat') note = `Holding the modules flat changes the day's energy by ${pct(en) - 100} % against following the sun. Ground light moves by ${pct(kI) - pct(kIt)} points in the interior.`;
        $('luxNote').textContent = note;
        $('luxWhen').textContent = $('dateSel').selectedOptions[0].text + ' · ' + $('siteSel').selectedOptions[0].text.split(',')[0];
      }
      const r = instant(state.pol, state.lat, state.dec, hours), s = r.s;
      sky(s.u);
      const up = s.u > 0.005;
      const sx = DOME.cx + DOME.r * s.e, sy = DOME.cy - DOME.r * s.u;
      $('sunG').setAttribute('transform', `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);
      $('sunG').style.opacity = up ? 1 : 0;
      const tag = $('sunTag');
      tag.setAttribute('x', Math.max(30, Math.min(490, sx)).toFixed(1));
      tag.setAttribute('y', (sy - 18).toFixed(1));
      tag.textContent = up ? 'SUN ' + Math.round(Math.asin(s.u) / D2R) + '°' : 'Sun below the horizon';
      if (!up){ tag.setAttribute('x', 260); tag.setAttribute('y', 60); }
      r.mods.forEach((m, i) => {
        modEls[i].setAttribute('x1', X(m.a.x).toFixed(1)); modEls[i].setAttribute('y1', Y(m.a.y).toFixed(1));
        modEls[i].setAttribute('x2', X(m.b.x).toFixed(1)); modEls[i].setAttribute('y2', Y(m.b.y).toFixed(1));
      });
      // shadows + rays
      const sh = $('shadows'), rays = $('rays');
      sh.textContent = ''; rays.textContent = '';
      if (up){
        const k = s.e / s.u;
        r.mods.forEach(m => {
          const pa = m.a.x - m.a.y * k, pb = m.b.x - m.b.y * k;
          const lo = Math.max(0, Math.min(pa, pb)), hi = Math.min(FIELD, Math.max(pa, pb));
          if (hi > lo) el('rect', { x: X(lo).toFixed(1), y: G, width: ((hi - lo) * K).toFixed(1), height: 12, fill: 'var(--text)', opacity: 0.42 }, sh);
          [[m.a, pa], [m.b, pb]].forEach(([p, gx]) => {
            if (gx > -2 && gx < FIELD + 2) el('line', { x1: X(p.x).toFixed(1), y1: Y(p.y).toFixed(1), x2: X(gx).toFixed(1), y2: G }, rays);
          });
        });
      }
      r.num.forEach((v, i) => ribNow[i].setAttribute('fill', up && r.ref > 0 ? ramp(v / r.ref) : 'var(--inset)'));
      const t = fmt(state.min);
      $('timeLabel').textContent = t;
      $('timeRange').setAttribute('aria-valuetext', t + ' solar time');
    }

    // ---------- controls ----------
    const range = $('timeRange'), play = $('playBtn'), icon = $('playIcon');
    function setPlaying(p){
      state.playing = p;
      play.setAttribute('aria-pressed', String(p));
      play.setAttribute('aria-label', p ? 'Pause the sun animation' : 'Play the sun animation');
      icon.setAttribute('d', p ? 'M4 3h3v10H4zM9 3h3v10H9z' : 'M5 3l8 5-8 5z');
      if (p) loop();
    }
    range.addEventListener('input', () => { state.min = +range.value; setPlaying(false); render(); });
    play.addEventListener('click', () => setPlaying(!state.playing));
    $('siteSel').addEventListener('change', e => { state.lat = +e.target.value; render(); });
    $('dateSel').addEventListener('change', e => { state.dec = +e.target.value; render(); });
    const segBtns = Array.from(root.querySelectorAll('.seg [data-pol]'));
    segBtns.forEach(b => b.addEventListener('click', () => {
      segBtns.forEach(o => o.setAttribute('aria-checked', String(o === b)));
      state.pol = b.dataset.pol; render();
    }));
    // arrow-key support for the radiogroup
    root.querySelector('.seg').addEventListener('keydown', e => {
      const i = segBtns.findIndex(b => b.getAttribute('aria-checked') === 'true');
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown'){ e.preventDefault(); segBtns[(i + 1) % 3].click(); segBtns[(i + 1) % 3].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp'){ e.preventDefault(); segBtns[(i + 2) % 3].click(); segBtns[(i + 2) % 3].focus(); }
    });

    // ---------- animation: sweep sunrise → sunset, pause offscreen / hidden ----------
    let onScreen = true, raf = 0, last = 0;
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) loop(); }, { threshold: 0.05 }).observe(svgEl);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
    function daylight(){
      const x = -Math.tan(state.lat * D2R) * Math.tan(state.dec * D2R);
      const h = Math.acos(Math.max(-1, Math.min(1, x))) / D2R / 15;
      return [Math.max(240, (12 - h) * 60 + 10), Math.min(1200, (12 + h) * 60 - 10)];
    }
    function loop(){
      if (raf || !state.playing || !onScreen || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(function tick(ts){
        raf = 0;
        if (!state.playing || !onScreen || document.hidden) return;
        const dt = last ? Math.min(64, ts - last) : 16; last = ts;
        const [a, b] = daylight();
        state.min += dt * 0.055;                             // ~1 solar hour per 1.1 s
        if (state.min > b || state.min < a) state.min = a;
        range.value = Math.round(state.min);
        render();
        raf = requestAnimationFrame(tick);
      });
    }
    render();
    if (reduce) setPlaying(false); else loop();
  }

  }
  document.querySelectorAll('[data-tracker-plate]').forEach(mount);
})();
