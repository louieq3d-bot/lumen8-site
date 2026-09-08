/* LUMEN8 investor data room runtime. The page ships nothing readable: investors/bundle.json is AES-256-GCM
   ciphertext under a key derived from the password with PBKDF2-SHA256 (310k rounds). This file derives the key,
   decrypts the bundle in the browser, mounts the content and draws every chart from the decrypted data. The
   password is never sent anywhere; the derived key is kept in sessionStorage so a reload does not re-prompt. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), b64e = (u) => btoa(String.fromCharCode(...u));
  const usd = (v) => v >= 1e6 ? 'USD ' + (v / 1e6).toFixed(2) + ' m' : v >= 1e3 ? 'USD ' + Math.round(v / 1e3) + ' k' : 'USD ' + Math.round(v);
  const nf = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const svgEl = (n, a, parent) => { const e = document.createElementNS('http://www.w3.org/2000/svg', n); for (const k in a || {}) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; };
  const COL = { cyan: '#22d3ee', cyan2: '#67e8f9', blue: '#3b82f6', blue2: '#60a5fa', green: '#34d399', mint: '#6ee7b7', silver: '#cbd5e1', teal: '#2dd4bf', muted: '#6f7b91', ink: '#eaf0f8' };
  const PAL = [COL.cyan, COL.blue, COL.green, COL.silver, COL.teal, COL.blue2, COL.mint, '#93c5fd', '#a5f3fc', '#7dd3fc', '#99f6e4', '#bfdbfe', '#86efac', '#e2e8f0'];
  const DEPT = { FND: COL.silver, AI: COL.cyan, SW: COL.blue2, GEO: COL.teal, PWR: COL.green, FIELD: COL.mint, SUP: '#93c5fd', GTM: COL.blue, MKT: '#a5f3fc', GA: COL.muted };

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  const showTip = (html, x, y) => { tip.innerHTML = html; tip.hidden = false; const r = tip.getBoundingClientRect(); const px = Math.min(innerWidth - r.width - 12, x + 14), py = y + 16 + r.height > innerHeight ? y - r.height - 12 : y + 16; tip.style.left = px + 'px'; tip.style.top = py + 'px'; };
  const hideTip = () => { tip.hidden = true; };
  const tipOn = (el, html) => { el.addEventListener('mousemove', (e) => showTip(typeof html === 'function' ? html() : html, e.clientX, e.clientY)); el.addEventListener('mouseleave', hideTip); el.addEventListener('touchstart', (e) => { const t = e.touches[0]; showTip(typeof html === 'function' ? html() : html, t.clientX, t.clientY); }, { passive: true }); };

  /* ---------- crypto ---------- */
  let META = null;
  const meta = async () => META || (META = await (await fetch('/investors/bundle.json', { cache: 'no-store' })).json());
  async function derive(pw, m) { const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(m.salt), iterations: m.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']); }
  async function openBundle(key, m) { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(m.iv) }, key, b64d(m.ct)); return JSON.parse(new TextDecoder().decode(pt)); }
  let KEY = null, BUNDLE = null;

  /* ---------- gate ---------- */
  const gate = $('#gate'), form = $('#gateform'), err = $('#err'), pwEl = $('#pw');
  /* the eye: see what you typed before you send it */
  const eye = $('#eye'); if (eye) eye.addEventListener('click', () => { const show = pwEl.type === 'password'; pwEl.type = show ? 'text' : 'password'; eye.classList.toggle('on', show); eye.setAttribute('aria-pressed', show); eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); pwEl.focus(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = ''; form.classList.add('busy');
    try { const m = await meta(); const key = await derive(pwEl.value, m); const b = await openBundle(key, m); KEY = key; BUNDLE = b; try { sessionStorage.setItem('l8ik', b64e(new Uint8Array(await crypto.subtle.exportKey('raw', key)))); } catch (x) {} mount(); }
    catch (x) { form.classList.remove('busy'); form.classList.add('shake'); setTimeout(() => form.classList.remove('shake'), 500); err.textContent = x && x.name === 'OperationError' ? 'That password did not open the room.' : 'Could not open the room: ' + (x && x.message || x); pwEl.select(); }
  });
  (async () => { try { const raw = sessionStorage.getItem('l8ik'); if (!raw) return; const m = await meta(); const key = await crypto.subtle.importKey('raw', b64d(raw), { name: 'AES-GCM' }, true, ['decrypt']); BUNDLE = await openBundle(key, m); KEY = key; mount(); } catch (x) { try { sessionStorage.removeItem('l8ik'); } catch (y) {} } })();
  $('#lock').addEventListener('click', () => { try { sessionStorage.removeItem('l8ik'); } catch (x) {} location.reload(); });

  /* ---------- mount ---------- */
  function mount() {
    const app = $('#app'), main = $('#main'); gate.hidden = true; app.hidden = false; $('#lock').hidden = false; document.body.classList.add('inv-open');
    main.innerHTML = BUNDLE.html; $('#built').textContent = 'Built ' + (META.built || '');
    const D = BUNDLE.data;
    const secs = $$('.inv-sec', main); const nav = $('#nav');
    secs.forEach((s, i) => { const a = document.createElement('a'); a.href = '#' + s.id; a.innerHTML = '<i>' + String(i + 1).padStart(2, '0') + '</i>' + esc(s.dataset.nav || s.id); a.addEventListener('click', (e) => { e.preventDefault(); s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); history.replaceState(null, '', '#' + s.id); $('.inv-side').classList.remove('open'); }); nav.appendChild(a); });
    const links = $$('a', nav);
    new IntersectionObserver((en) => { en.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }); }, { threshold: .08 }).observe && secs.forEach((s) => { const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { s.classList.add('in'); io.disconnect(); } }, { threshold: .06 }); io.observe(s); });
    const spot = new IntersectionObserver((en) => { en.forEach((e) => { if (e.isIntersecting) links.forEach((l) => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id)); }); }, { rootMargin: '-30% 0px -60% 0px' }); secs.forEach((s) => spot.observe(s));
    $('#sidetoggle').addEventListener('click', () => $('.inv-side').classList.toggle('open'));
    setTimeout(() => { secs.forEach((s) => { const r = s.getBoundingClientRect(); if (r.top < innerHeight) s.classList.add('in'); }); }, 100);
    /* counters */
    $$('[data-count]', main).forEach((el) => { const t = parseFloat(el.dataset.count), d = el.dataset.dec | 0, pre = el.dataset.prefix || '', suf = el.dataset.suffix || ''; const show = (v) => { el.textContent = pre + nf(v, d) + suf; }; show(0); const io = new IntersectionObserver((en) => { if (!en[0].isIntersecting) return; io.disconnect(); if (reduce) { show(t); return; } const t0 = performance.now(); const step = (now) => { const p = Math.min(1, (now - t0) / 1600), e = 1 - Math.pow(1 - p, 4); show(t * e); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, { threshold: .5 }); io.observe(el); });
    /* widgets */
    $$('[data-widget]', main).forEach((el) => { const w = el.dataset.widget, key = el.dataset.key; try { if (W[w]) W[w](el, key ? D[key] : D, D); } catch (x) { console.warn('widget', w, x); el.innerHTML = '<p class="srcline">This chart could not be drawn.</p>'; } });
    /* docs */
    W.docs($('[data-widget=docs]', main));
    if (location.hash) { const s = $(location.hash); if (s) setTimeout(() => s.scrollIntoView(), 50); }
    /* charts draw themselves when they arrive */
    const seen = new IntersectionObserver((en) => { en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('seen'); seen.unobserve(e.target); } }); }, { threshold: .25 }); $$('.chart, .sim, .motion, .team', main).forEach((c) => seen.observe(c));
    /* reading progress */
    const prog = $('#progress'); const onS = () => { const h = document.documentElement.scrollHeight - innerHeight; prog.style.transform = 'scaleX(' + (h > 0 ? scrollY / h : 0).toFixed(4) + ')'; }; addEventListener('scroll', onS, { passive: true }); onS();
  }

  /* ---------- widgets ---------- */
  const W = {};
  const tabs = (el, name, cb) => { const t = $('[data-tabs=' + name + ']'); if (!t) return; $$('button', t).forEach((b) => b.addEventListener('click', () => { $$('button', t).forEach((x) => x.classList.toggle('on', x === b)); cb(b.dataset.set); })); };

  /* funnel: stages as trapezoids, width by log of value so a 3,300 -> 1.6 chain still reads */
  W.funnel = (el, F) => {
    const draw = (set) => {
      const f = F[set], n = f.stages.length, Wd = 1000, sh = 74, gap = 10, H = n * (sh + gap) + 30; el.innerHTML = '';
      const svg = svgEl('svg', { viewBox: '0 0 ' + Wd + ' ' + H }, el);
      const vmax = Math.log10(Math.max(...f.stages.map((s) => s.value)) + 1), vmin = Math.log10(Math.min(...f.stages.map((s) => s.value)) + 1);
      const wOf = (v) => 180 + 560 * ((Math.log10(v + 1) - vmin) / Math.max(1e-6, vmax - vmin));
      f.stages.forEach((s, i) => {
        const y = 14 + i * (sh + gap), w0 = wOf(s.value), w1 = i + 1 < n ? wOf(f.stages[i + 1].value) : w0 * .8, cx = 300;
        const g = svgEl('g', { class: 'funnel-stage' }, svg);
        const grad = 'url(#fg' + i + ')'; const defs = svgEl('defs', {}, g); const lg = svgEl('linearGradient', { id: 'fg' + i, x1: 0, x2: 1 }, defs); svgEl('stop', { offset: 0, 'stop-color': i === n - 1 ? COL.green : COL.cyan, 'stop-opacity': .85 - i * .08 }, lg); svgEl('stop', { offset: 1, 'stop-color': i === n - 1 ? COL.mint : COL.blue, 'stop-opacity': .55 - i * .05 }, lg);
        svgEl('path', { d: `M${cx - w0 / 2},${y} L${cx + w0 / 2},${y} L${cx + w1 / 2},${y + sh} L${cx - w1 / 2},${y + sh} Z`, fill: grad, stroke: 'rgba(103,232,249,.35)' }, g);
        const tx = svgEl('text', { x: cx, y: y + sh / 2 + 6, 'text-anchor': 'middle', class: 'lbl', 'font-size': 20, 'font-weight': 600, fill: '#fff' }, g); tx.textContent = s.text;
        const l1 = svgEl('text', { x: 640, y: y + 30, class: 'lbl', 'font-size': 14 }, g); l1.textContent = s.label;
        const l2 = svgEl('text', { x: 640, y: y + 52, class: 'sm' }, g); l2.textContent = s.source;
        svgEl('line', { x1: cx + w0 / 2 + 8, y1: y + sh / 2, x2: 626, y2: y + sh / 2, class: 'axis' }, g);
        if (i < n - 1) { const ar = svgEl('text', { x: cx, y: y + sh + 9, 'text-anchor': 'middle', class: 'sm' }, g); ar.textContent = '▼'; }
        tipOn(g, '<b>' + esc(s.label) + ' · ' + esc(s.text) + '</b>' + esc(s.note) + '<small>' + esc(s.source) + '</small>');
      });
      const t = svgEl('text', { x: 20, y: H - 4, class: 'sm' }, svg); t.textContent = f.title + ' · widths on a log scale · hover for derivation';
    };
    draw('sea'); tabs(el, 'funnel', draw);
  };

  /* ladder: nested rings, click for the panel */
  W.ladder = (el, L) => {
    el.innerHTML = ''; const svg = svgEl('svg', { viewBox: '0 0 420 420' }, el); const info = document.createElement('div'); info.className = 'ladder-info'; el.appendChild(info);
    const rings = []; const n = L.length;
    L.slice().reverse().forEach((r, k) => { const i = n - 1 - k, R = 60 + i * 38; const g = svgEl('g', { class: 'ring' }, svg); svgEl('circle', { cx: 210, cy: 210, r: R, fill: 'rgba(34,211,238,' + (.05 + k * .05) + ')', stroke: PAL[i], 'stroke-opacity': .7, 'stroke-width': 1.5 }, g); const t = svgEl('text', { x: 210, y: 210 - R + 16, 'text-anchor': 'middle', class: 'lbl', 'font-size': 11 }, g); t.textContent = r.title.toUpperCase(); rings[i] = g; g.addEventListener('click', () => sel(i)); tipOn(g, '<b>' + esc(r.title) + '</b>' + esc(r.sub)); });
    const sel = (i) => { rings.forEach((g, k) => g.classList.toggle('dim', k !== i)); const r = L[i]; info.innerHTML = '<span class="sub">' + esc(r.sub) + '</span><h3>' + esc(r.title) + '</h3><p>' + esc(r.text) + '</p><div class="figs">' + r.figures.map((f) => '<div><b>' + esc(f[0]) + '</b><span>' + esc(f[1]) + '</span></div>').join('') + '</div>'; };
    sel(0);
  };

  /* speed table with log bars */
  W.speed = (el, S) => {
    const secs = (t) => { const m = /([\d.]+)\s*(ms|s|weeks|×)/.exec(t); if (!m) return null; const v = parseFloat(m[1]); return m[2] === 'ms' ? v / 1000 : m[2] === 's' ? v : m[2] === 'weeks' ? v * 7 * 86400 : null; };
    const vals = S.map((s) => secs(s.t)).filter((v) => v != null); const lo = Math.log10(Math.min(...vals) + 1e-3), hi = Math.log10(Math.max(...vals) + 1e-3);
    el.innerHTML = S.map((s) => { const v = secs(s.t); const w = v == null ? 40 : 3 + 97 * (Math.log10(v + 1e-3) - lo) / (hi - lo); const bench = /Consultancy/.test(s.op); return '<div class="speed-row' + (bench ? ' bench' : '') + '"><div>' + esc(s.op) + '<small>' + esc(s.src) + '</small></div><div><div class="bar" style="width:' + w.toFixed(1) + '%"></div></div><b>' + esc(s.t) + '</b></div>'; }).join('') + '<div class="srcline">Bars are on a log scale. At true scale the 20.2-second run would not render against six weeks; the ratio is about 180,000 to one.</div>';
  };

  W.matrix = (el, M) => {
    const glyph = (v) => v === 2 ? '<i style="color:#67e8f9">●</i>' : v === 1 ? '<i style="color:#93c5fd">◑</i>' : v === 0 ? '<i style="color:#6f7b91">○</i>' : v === -1 ? '<i style="color:#3b4657">—</i>' : esc(v);
    el.innerHTML = '<table class="matrix"><thead><tr><th>Capability</th>' + M.cols.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + M.rows.map((r) => '<tr><td>' + esc(r[0]) + '</td>' + r.slice(1).map((v, i) => '<td' + (i === 0 ? ' class="l8"' : '') + '>' + glyph(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table><div class="legend">● full · ◑ partial · ○ absent · — out of scope. Rows re-audited against the source tree before use in diligence; a stale cell in either direction is a bug.</div>';
  };

  W.modules = (el, MS) => {
    el.innerHTML = '<div class="mtabs"></div><div class="mpanel"></div>'; const t = $('.mtabs', el), p = $('.mpanel', el);
    MS.forEach((m, i) => { const b = document.createElement('button'); b.innerHTML = '<b>' + esc(m.id) + '</b><span>' + esc(m.name) + '</span>'; b.addEventListener('click', () => sel(i)); t.appendChild(b); });
    const sel = (i) => { $$('button', t).forEach((b, k) => b.classList.toggle('on', k === i)); const m = MS[i]; p.innerHTML = '<div class="mhead"><div><h3>' + esc(m.name) + '</h3><div class="band">' + esc(m.band) + '</div></div><span class="status">' + esc(m.live) + '</span></div><p>' + esc(m.text) + '</p><div class="facts"><div><i>Price per site</i><b>' + esc(m.price) + '</b></div><div><i>What it replaces</i><b>' + esc(m.replaces) + '</b></div><div><i>Who buys</i><b>' + esc(m.buyer) + '</b></div><div><i>What recurs</i><b>' + esc(m.recur) + '</b></div></div><div class="sample"><i>Sample output</i><table>' + m.sample.map((r) => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</table></div>' + (m.calc ? '<div class="mcalc"><i>What the engine saves on your ' + esc(m.calc[2]) + 's</i><label><span>Number of ' + esc(m.calc[2]) + 's<b data-n></b></span><input type="range" min="1" max="' + (m.k === 'utility' ? 40 : 300) + '" value="' + (m.k === 'utility' ? 5 : 50) + '"></label><div class="mbars"><div><span>Conventional</span><i class="c"></i><b data-c></b></div><div><span>With Lumen8</span><i class="e"></i><b data-e></b></div><div><span>Saved</span><i class="s"></i><b data-s></b></div></div></div>' : ''); if (m.calc) { const inp = $('.mcalc input', p); const upd = () => { const n = +inp.value, c = m.calc[0], e = m.calc[1]; const f = (v) => v >= 1000 ? 'USD ' + (v / 1000).toFixed(1) + ' m' : 'USD ' + Math.round(v) + ' k'; const mx = n * c[1]; $('[data-n]', p).textContent = n; $('[data-c]', p).textContent = f(n * c[0]) + ' – ' + f(n * c[1]); $('[data-e]', p).textContent = f(n * e[0]) + ' – ' + f(n * e[1]); $('[data-s]', p).textContent = f(n * (c[0] - e[1])) + ' – ' + f(n * (c[1] - e[0])); $('.mbars .c', p).style.width = '100%'; $('.mbars .e', p).style.width = (100 * n * e[1] / mx).toFixed(1) + '%'; $('.mbars .s', p).style.width = (100 * n * (c[1] - e[0]) / mx).toFixed(1) + '%'; }; inp.addEventListener('input', upd); upd(); } };
    sel(0);
  };

  W.cod = (el, C) => {
    const M = 36; const pos = (m) => (m / M * 100).toFixed(2) + '%';
    el.innerHTML = '<div class="cod-scale"><div>Project stage</div><div>' + [0, 6, 12, 18, 24, 30, 36].map((m) => '<span>M' + m + '</span>').join('') + '</div></div>' + C.map((r) => { const fixed = /unchanged/.test(r.eng[2]); return '<div class="cod-row"><div class="st">' + esc(r.stage) + '<small>' + esc(r.conv[2]) + ' → ' + esc(r.eng[2].split(' · ')[0]) + '</small></div><div class="cod-track"><div class="cod-bar conv" style="left:' + pos(r.conv[0]) + ';width:' + pos(Math.max(.4, r.conv[1] - r.conv[0])) + '" data-t="' + esc('Conventional · ' + r.stage + ' · months ' + r.conv[0] + '–' + r.conv[1] + ' · ' + r.conv[2]) + '"></div><div class="cod-bar eng' + (fixed ? ' fixed' : '') + '" style="left:' + pos(r.eng[0]) + ';width:' + pos(Math.max(.4, r.eng[1] - r.eng[0])) + '" data-t="' + esc('Engine · ' + r.stage + ' · ' + (r.eng[1] - r.eng[0] < .3 ? 'day 1' : 'months ' + r.eng[0] + '–' + r.eng[1]) + ' · ' + r.eng[2]) + '"></div></div></div>'; }).join('') + '<div class="cod-legend"><span><i style="background:rgba(255,255,255,.22)"></i>conventional</span><span><i style="background:linear-gradient(90deg,#22d3ee,#34d399)"></i>engine-compressed</span><span><i style="background:repeating-linear-gradient(90deg,#60a5fa 0 6px,transparent 6px 10px)"></i>calendar-bound, unchanged</span><span>COD · M36 → M31</span></div>';
    $$('.cod-bar', el).forEach((b) => tipOn(b, '<b>' + esc(b.dataset.t.split(' · ')[0]) + '</b>' + esc(b.dataset.t.split(' · ').slice(1).join(' · '))));
    tabs(el, 'cod', (set) => { $$('.cod-bar', el).forEach((b) => b.classList.toggle('off', set !== 'both' && !b.classList.contains(set))); });
  };

  W.pricing = (el, P) => { el.innerHTML = P.map((t) => '<div class="tier"><h3>' + esc(t.tier) + '</h3><dl>' + t.items.map((i) => '<div><span>' + esc(i[0]) + '</span><b>' + esc(i[1]) + '</b></div>').join('') + '</dl><div class="gm">' + esc(t.gm) + '</div><div class="note">' + esc(t.note) + '</div></div>').join(''); };

  W.sim = (el, S0) => {
    const S = Object.assign({}, S0); const def = Object.assign({}, S0);
    const ctl = [['sitesY2', 'Sites prepared in year 2', 20, 600, 10, (v) => v + ' sites'], ['fee', 'Average preparation fee', 5, 120, 5, (v) => 'USD ' + v + 'k'], ['team', 'Team licences', 0, 30, 1, (v) => v], ['teamFee', 'Team licence', 12, 30, 1, (v) => 'USD ' + v + 'k / yr'], ['ent', 'Enterprise licences', 0, 20, 1, (v) => v], ['entFee', 'Enterprise licence', 150, 500, 10, (v) => 'USD ' + v + 'k / yr'], ['inst', 'Institutional licences', 0, 5, 1, (v) => v], ['instFee', 'Institutional licence', 500, 1500, 50, (v) => 'USD ' + v + 'k / yr'], ['assets', 'Assets under monitoring', 0, 600, 10, (v) => v + ' assets'], ['monFee', 'Monitoring fee per asset', 2, 10, 1, (v) => 'USD ' + v + 'k / yr']];
    el.innerHTML = '<div class="ctl">' + ctl.map((c) => '<label><span>' + esc(c[1]) + '<b data-v="' + c[0] + '"></b></span><input type="range" data-k="' + c[0] + '" min="' + c[2] + '" max="' + c[3] + '" step="' + c[4] + '" value="' + S[c[0]] + '"></label>').join('') + '<div class="simbtns"><button class="btn sm ghost reset"><span>Reset to the plan</span></button><button class="btn sm ghost pin"><span>Pin as scenario A</span></button></div></div><div class="out"><div class="outk"><div><b data-o="arr"></b><span>annual recurring revenue, month-24 run-rate</span></div><div><b data-o="prep"></b><span>one-off preparation revenue in year 2</span></div><div><b data-o="rec"></b><span>recurring share of year-2 revenue</span></div><div><b data-o="cmr"></b><span>capital mobilised at USD 1.7 m capex per site, gross</span></div></div><div class="stack"></div><div class="pinned" hidden></div><p class="srcline">Plan landing: USD 4.2 m ARR, 10 customers including one institutional, 300 sites cumulative, 180 assets under monitoring, USD 85 m mobilised at first close. Every input is a slider so the landing can be argued with. This is a model, not a forecast.</p></div>';
    const fm = {}; ctl.forEach((c) => { fm[c[0]] = c[5]; });
    const calc = () => {
      const lic = S.team * S.teamFee + S.ent * S.entFee + S.inst * S.instFee, mon = S.assets * S.monFee, arr = lic + mon, prep = S.sitesY2 * S.fee, y2 = arr + prep;
      $('[data-o=arr]', el).textContent = 'USD ' + (arr / 1000).toFixed(2) + ' m'; $('[data-o=prep]', el).textContent = 'USD ' + (prep / 1000).toFixed(2) + ' m'; $('[data-o=rec]', el).textContent = Math.round(100 * arr / Math.max(1, y2)) + '%'; $('[data-o=cmr]', el).textContent = 'USD ' + Math.round(S.sitesY2 * 1.7) + ' m · ' + (S.sitesY2 * 1.7 / 5).toFixed(1) + '×';
      const rows = [['Platform licences', lic, COL.blue], ['Monitoring & MRV', mon, COL.green], ['Preparation, one-off', prep, COL.cyan]], mx = Math.max(1, ...rows.map((r) => r[1]));
      $('.stack', el).innerHTML = rows.map((r) => '<div><span>' + r[0] + '</span><i style="width:' + (100 * r[1] / mx).toFixed(1) + '%;background:' + r[2] + '"></i><b>USD ' + (r[1] / 1000).toFixed(2) + ' m</b></div>').join('');
      ctl.forEach((c) => { $('[data-v=' + c[0] + ']', el).textContent = fm[c[0]](S[c[0]]); });
      if (PIN) { const d = arr - PIN.arr, dp = prep - PIN.prep; $('.pinned', el).hidden = false; $('.pinned', el).innerHTML = '<span>Scenario A · ARR USD ' + (PIN.arr / 1000).toFixed(2) + ' m · preparation USD ' + (PIN.prep / 1000).toFixed(2) + ' m</span><b class="' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '+' : '−') + 'USD ' + (Math.abs(d) / 1000).toFixed(2) + ' m ARR</b><b class="' + (dp >= 0 ? 'up' : 'dn') + '">' + (dp >= 0 ? '+' : '−') + 'USD ' + (Math.abs(dp) / 1000).toFixed(2) + ' m one-off</b>'; }
      LAST = { arr, prep };
    };
    let PIN = null, LAST = null;
    $('.pin', el).addEventListener('click', () => { PIN = LAST; calc(); });
    $$('input', el).forEach((i) => i.addEventListener('input', () => { S[i.dataset.k] = +i.value; calc(); }));
    $('.reset', el).addEventListener('click', () => { Object.assign(S, def); $$('input', el).forEach((i) => { i.value = S[i.dataset.k]; }); calc(); });
    calc();
  };

  W.gates = (el, G) => { el.innerHTML = '<table class="gates"><thead><tr><th></th>' + G.cols.map((c) => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' + G.rows.map((r) => '<tr>' + r.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'; };

  W.chain = (el) => {
    const rows = [['Developers & consultants', 'bespoke, per project', [1, 1, 1, 0]], ['Geospatial & satellite data', 'imagery vendors', [1, 0, 0, 0]], ['Asset monitoring platforms', 'from COD onwards', [0, 0, 0, 2]], ['Carbon MRV', 'registries and raters', [0, 0, 0, 1]], ['DRE platforms', 'once the project is defined', [0, 1, 1, 0]], ['Design tools', 'a site you have already chosen', [0, 2, 1, 0]], ['Lumen8', 'one engine, one standard', [2, 2, 2, 2]]];
    el.innerHTML = '<table><thead><tr><th>Who</th><th>Screen</th><th>Prepare</th><th>Finance</th><th>Monitor</th></tr></thead><tbody>' + rows.map((r) => '<tr' + (r[0] === 'Lumen8' ? ' class="l8"' : '') + '><td>' + esc(r[0]) + '<small>' + esc(r[1]) + '</small></td>' + r[2].map((v) => '<td><span class="cell' + (v === 2 ? ' f' : v === 1 ? ' p' : '') + '"></span></td>').join('') + '</tr>').join('') + '</tbody></table>';
  };

  /* use of funds: donut */
  W.donut = (el, U) => {
    el.innerHTML = ''; const svg = svgEl('svg', { viewBox: '0 0 420 420' }, el); const tot = U.total; let a0 = -Math.PI / 2; const R = 170, r0 = 108;
    const centre = svgEl('g', {}, svg); const c1 = svgEl('text', { x: 210, y: 202, 'text-anchor': 'middle', class: 'lbl', 'font-size': 26, 'font-weight': 600, fill: '#fff' }, centre); c1.textContent = 'USD 5.31 m'; const c2 = svgEl('text', { x: 210, y: 228, 'text-anchor': 'middle', class: 'sm' }, centre); c2.textContent = '30 MONTHS · NO REVENUE ASSUMED';
    U.lines.forEach((l, i) => { const v = l[4], a1 = a0 + v / tot * Math.PI * 2; const big = a1 - a0 > Math.PI ? 1 : 0; const p = (a, rr) => [210 + Math.cos(a) * rr, 210 + Math.sin(a) * rr]; const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r0), [x3, y3] = p(a0, r0);
      const path = svgEl('path', { d: `M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${big} 0 ${x3},${y3} Z`, fill: PAL[i % PAL.length], 'fill-opacity': .85, stroke: '#04060c', 'stroke-width': 2, style: 'cursor:pointer;transition:fill-opacity .3s' }, svg);
      path.addEventListener('mouseenter', () => { path.setAttribute('fill-opacity', 1); c1.textContent = usd(v); c2.textContent = l[0].toUpperCase().slice(0, 34) + ' · ' + (100 * v / tot).toFixed(1) + '%'; $$('tr', el.parentElement).forEach((tr) => tr.classList.toggle('hl', tr.dataset.i == i)); });
      path.addEventListener('mouseleave', () => { path.setAttribute('fill-opacity', .85); c1.textContent = 'USD 5.31 m'; c2.textContent = '30 MONTHS · NO REVENUE ASSUMED'; $$('tr', el.parentElement).forEach((tr) => tr.classList.remove('hl')); });
      tipOn(path, '<b>' + esc(l[0]) + '</b>' + usd(v) + ' · ' + (100 * v / tot).toFixed(1) + '% of the programme<small>Year 1 ' + usd(l[1]) + ' · Year 2 ' + usd(l[2]) + ' · M25–30 ' + usd(l[3]) + '</small>'); a0 = a1; });
  };
  W.uoftable = (el, U) => { el.innerHTML = '<table class="uof-table"><thead><tr><th>Line</th><th>Year 1</th><th>Year 2</th><th>M25–30</th><th>Total</th><th>Share</th></tr></thead><tbody>' + U.lines.map((l, i) => '<tr data-i="' + i + '"><td><i style="background:' + PAL[i % PAL.length] + '"></i>' + esc(l[0]) + '</td><td>' + nf(l[1] / 1000) + 'k</td><td>' + nf(l[2] / 1000) + 'k</td><td>' + nf(l[3] / 1000) + 'k</td><td>' + nf(l[4] / 1000) + 'k</td><td>' + (100 * l[4] / U.total).toFixed(1) + '%</td></tr>').join('') + '<tr class="tot"><td>Total</td><td>' + nf(U.annual[0] / 1000) + 'k</td><td>' + nf(U.annual[1] / 1000) + 'k</td><td>' + nf(U.annual[2] / 1000) + 'k</td><td>' + nf(U.total / 1000) + 'k</td><td>100%</td></tr></tbody></table>'; };

  /* cash profile: monthly outflow columns + cumulative line + headcount */
  W.cash = (el, U) => {
    el.innerHTML = ''; const Wd = 1000, H = 340, L = 60, Rr = 60, T = 24, B = 44, n = U.monthly.length; const svg = svgEl('svg', { viewBox: '0 0 ' + Wd + ' ' + H }, el);
    const x = (i) => L + (i + .5) * (Wd - L - Rr) / n, mMax = 280, cMax = 5.5, hMax = 45; const yM = (v) => T + (H - T - B) * (1 - v / mMax), yC = (v) => T + (H - T - B) * (1 - v / cMax);
    [0, 100, 200].forEach((v) => { svgEl('line', { x1: L, x2: Wd - Rr, y1: yM(v), y2: yM(v), class: 'axis' }, svg); const t = svgEl('text', { x: L - 8, y: yM(v) + 4, 'text-anchor': 'end', class: 'sm' }, svg); t.textContent = v + 'k'; });
    [1, 2, 3, 4, 5].forEach((v) => { const t = svgEl('text', { x: Wd - Rr + 8, y: yC(v) + 4, class: 'sm' }, svg); t.textContent = v + 'm'; });
    const bw = (Wd - L - Rr) / n * .62;
    U.monthly.forEach((v, i) => { const r = svgEl('rect', { x: x(i) - bw / 2, y: yM(v), width: bw, height: yM(0) - yM(v), rx: 3, fill: i < 12 ? COL.cyan : i < 24 ? COL.blue : COL.green, 'fill-opacity': .55 }, svg); tipOn(r, '<b>Month ' + (i + 1) + '</b>Outflow USD ' + v + 'k · cumulative USD ' + U.cum[i].toFixed(2) + ' m · headcount ' + U.head[i]); if ((i + 1) % 6 === 0) { const t = svgEl('text', { x: x(i), y: H - B + 18, 'text-anchor': 'middle', class: 'sm' }, svg); t.textContent = 'M' + (i + 1); } });
    svgEl('path', { d: U.cum.map((v, i) => (i ? 'L' : 'M') + x(i) + ',' + yC(v)).join(' '), fill: 'none', stroke: COL.cyan2, 'stroke-width': 2.5 }, svg);
    svgEl('path', { d: U.head.map((v, i) => (i ? 'L' : 'M') + x(i) + ',' + (T + (H - T - B) * (1 - v / hMax))).join(' '), fill: 'none', stroke: COL.silver, 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }, svg);
    svgEl('line', { x1: x(23) + bw / 2 + 4, x2: x(23) + bw / 2 + 4, y1: T, y2: yM(0), stroke: COL.blue2, 'stroke-dasharray': '3 5' }, svg); const rt = svgEl('text', { x: x(23) + bw / 2 + 10, y: T + 12, class: 'sm' }, svg); rt.textContent = 'MONTH 24 · USD 3.81 m SPENT';
    const lg = svgEl('text', { x: L, y: H - 6, class: 'sm' }, svg); lg.textContent = 'COLUMNS: MONTHLY OUTFLOW (LEFT AXIS) · LINE: CUMULATIVE (RIGHT AXIS) · DASHED: HEADCOUNT, 3 → 42';
  };
  W.headfn = (el, U) => { const mx = Math.max(...U.fn.rows.map((r) => r[3])); el.innerHTML = '<table class="fn-table"><thead><tr><th>Function</th>' + U.fn.cols.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + U.fn.rows.map((r) => '<tr><td>' + esc(r[0]) + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td><span class="bar" style="width:' + (60 * r[3] / mx).toFixed(0) + 'px"></span>' + r[3] + '</td></tr>').join('') + '<tr class="tot"><td>Total headcount</td><td>22</td><td>35</td><td>42</td></tr></tbody></table><div class="srcline">Build side against sell side: 69% technical at month 12, 56% at month 30. One office in Jakarta; the supply-chain roles are field-based in China with no premises.</div>'; };
  W.datalines = (el, U) => { const tot = U.data.reduce((a, d) => a + d[1], 0), mx = Math.max(...U.data.map((d) => d[1])); el.innerHTML = '<div class="srcline" style="margin:0 0 10px">DATA, TOOLING & INFRASTRUCTURE · USD ' + tot + 'k ACROSS 30 MONTHS, BOUGHT IN PHASES</div>' + U.data.map((d, i) => '<div class="speed-row"><div>' + esc(d[2]) + '<small>' + esc(d[0]) + '</small></div><div><div class="bar" style="width:' + (100 * d[1] / mx).toFixed(1) + '%;background:' + PAL[i] + '"></div></div><b>USD ' + d[1] + 'k</b></div>').join('') + '<div class="srcline">58% of this leaves an asset behind if the invoices stop: perpetual time series, archive scenes, cadastral extracts and well data. 31% rents access. 11% is licensing counsel that keeps the estate legal to resell. Free sources carry every wide-area task throughout.</div>'; };
  W.gantt = (el, U) => {
    el.innerHTML = '<div class="gantt"><table><thead><tr><th>Role</th><th><div class="cells">' + Array.from({ length: 30 }, (_, i) => '<i class="' + ((i % 6) === 0 ? 'q' : '') + '" style="font-style:normal">' + ((i % 6) === 0 ? 'M' + (i + 1) : '') + '</i>').join('') + '</div></th></tr></thead><tbody>' + U.roles.map((r) => { const c = DEPT[r[1]] || COL.cyan, first = Math.min(...r[2]); return '<tr style="--dc:' + c + '"><td class="r"><span class="dept">' + r[1] + '</span>' + esc(r[0]) + '</td><td class="m"><div class="cells">' + Array.from({ length: 30 }, (_, i) => '<i class="' + ((i % 6) === 0 ? 'q ' : '') + (r[2].includes(i + 1) ? 'on ' : '') + (i + 1 >= first ? 'run' : '') + '"></i>').join('') + '</div></td></tr>'; }).join('') + '</tbody></table></div><div class="head-legend">' + Object.keys(DEPT).map((k) => '<span><i style="background:' + DEPT[k] + '"></i>' + k + '</span>').join('') + '<span>· EACH DOT IS ONE FUNDED SEAT WITH A START MONTH IN THE MODEL</span></div>';
  };
  W.team = (el, T) => { el.innerHTML = T.map((m, i) => '<div class="member f' + i + '"><div class="mhead"><div class="ini">' + esc(m.name[0]) + '</div><div><h3>' + esc(m.name) + '</h3><span class="role">' + esc(m.role) + '</span></div><span class="line">' + esc(m.line) + '</span></div><p>' + esc(m.bio) + '</p><div class="cols2 mlists"><div><i>Owns at Lumen8</i><ul>' + m.owns.map((o) => '<li>' + esc(o) + '</li>').join('') + '</ul></div><div><i>Built before it</i><ul>' + m.built.map((o) => '<li>' + esc(o) + '</li>').join('') + '</ul></div></div><div class="marks">' + m.marks.map((k) => '<span>' + esc(k) + '</span>').join('') + '</div></div>').join(''); };
  /* the index lighting up: 8,493 village points in the shape of the archipelago; the slider prepares them in priority order */
  W.motion = (el, I) => {
    el.innerHTML = '<div class="mmap"><canvas></canvas><div class="mlegend"><span><i class="dim"></i>indexed village</span><span><i class="lit"></i>prepared, monitored</span></div></div><div class="mside"><label><span>Sites prepared<b data-v></b></span><input type="range" min="0" max="2000" step="10" value="0"></label><div class="mk"><div><b data-o="hh"></b><span>households connected</span></div><div><b data-o="mwp"></b><span>MWp installed</span></div><div><b data-o="capex"></b><span>capex prepared to one standard</span></div><div><b data-o="tco2"></b><span>tCO₂e avoided per year</span></div><div><b data-o="mon"></b><span>monitoring revenue per year at USD 6k</span></div><div><b data-o="share"></b><span>of unelectrified households reached</span></div></div><div class="mnote">Per-site figures: the reference village (412 households, 0.62 MWp, USD 1.71 m capex, 1,202 tCO₂e a year avoided). 300 sites is the committed first portfolio; the slider runs to 2,000 to show where the index leads.</div></div>';
    const cv = $('canvas', el), ctx = cv.getContext('2d'), rng = $('input', el); const clusters = [[.10, .55, .10, .16, 140], [.28, .72, .16, .05, 90], [.36, .46, .12, .14, 120], [.52, .50, .08, .14, 110], [.47, .74, .17, .04, 70], [.63, .44, .06, .10, 60], [.66, .66, .10, .05, 50], [.80, .56, .14, .18, 160], [.22, .30, .05, .05, 30]];
    const seed = (s) => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; const r = seed(7); const pts = []; const total = clusters.reduce((a, c) => a + c[4], 0);
    clusters.forEach(([cx, cy, rx, ry, n]) => { const k = Math.round(n / total * I.villages); for (let i = 0; i < k; i++) { const a = r() * 6.283, d = Math.sqrt(r()); pts.push({ x: cx + Math.cos(a) * d * rx, y: cy + Math.sin(a) * d * ry, p: r() }); } });
    pts.sort((a, b) => a.p - b.p); let W = 0, Hh = 0, n = 0, shown = 0, raf = 0;
    const size = () => { const rr = cv.getBoundingClientRect(); if (!rr.width) return; const d = Math.min(2, devicePixelRatio || 1); if (Math.abs(rr.width - W) < 1) return; W = rr.width; Hh = rr.height; cv.width = W * d; cv.height = Hh * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const draw = () => { size(); ctx.clearRect(0, 0, W, Hh); ctx.fillStyle = 'rgba(103,232,249,.22)'; pts.forEach((p, i) => { if (i < shown) return; ctx.fillRect(p.x * W, p.y * Hh, 1.6, 1.6); }); for (let i = 0; i < shown; i++) { const p = pts[i]; ctx.fillStyle = i >= shown - 12 ? '#ffffff' : '#34d399'; ctx.beginPath(); ctx.arc(p.x * W, p.y * Hh, i >= shown - 12 ? 3 : 2, 0, 6.283); ctx.fill(); } if (shown > 0 && shown < 60) { ctx.strokeStyle = 'rgba(52,211,153,.35)'; ctx.lineWidth = 1; for (let i = 1; i < shown; i++) { ctx.beginPath(); ctx.moveTo(pts[i - 1].x * W, pts[i - 1].y * Hh); ctx.lineTo(pts[i].x * W, pts[i].y * Hh); ctx.stroke(); } } };
    const out = () => { const P = I.perSite; $('[data-v]', el).textContent = n.toLocaleString('en-US') + (n === 300 ? ' · the first portfolio' : ''); $('[data-o=hh]', el).textContent = (n * P.hh).toLocaleString('en-US'); $('[data-o=mwp]', el).textContent = (n * P.mwp).toFixed(0); $('[data-o=capex]', el).textContent = 'USD ' + (n * P.capex >= 1000 ? (n * P.capex / 1000).toFixed(2) + ' bn' : (n * P.capex).toFixed(0) + ' m'); $('[data-o=tco2]', el).textContent = (n * P.tco2).toLocaleString('en-US'); $('[data-o=mon]', el).textContent = 'USD ' + (n * 6 / 1000).toFixed(2) + ' m'; $('[data-o=share]', el).textContent = Math.min(100, 100 * n * P.hh / I.hhTotal).toFixed(1) + '%'; };
    const step = () => { if (shown === n) { draw(); return; } shown += shown < n ? Math.max(1, Math.ceil((n - shown) / 12)) : -Math.max(1, Math.ceil((shown - n) / 12)); if ((shown > n && step.dir > 0) || (shown < n && step.dir < 0)) shown = n; draw(); raf = requestAnimationFrame(step); };
    const set = (v) => { n = v; step.dir = n >= shown ? 1 : -1; out(); cancelAnimationFrame(raf); raf = requestAnimationFrame(step); };
    rng.addEventListener('input', () => set(+rng.value)); out(); draw(); addEventListener('resize', () => { W = 0; draw(); });
    const io = new IntersectionObserver((en) => { if (!en[0].isIntersecting) return; io.disconnect(); if (reduce) { rng.value = 300; set(300); return; } let v = 0; const t0 = performance.now(); const run = (now) => { const p = Math.min(1, (now - t0) / 2600); v = Math.round(300 * (1 - Math.pow(1 - p, 3))); rng.value = v; set(v); if (p < 1) requestAnimationFrame(run); }; requestAnimationFrame(run); }, { threshold: .4 }); io.observe(el);
  };
  W.bridge = (el, I) => { const mx = Math.max(...I.bridge.map((b) => b[1])); el.innerHTML = '<div class="bridge">' + I.bridge.map((b, i) => '<div class="brow"><span>' + esc(b[0]) + '</span><div><i style="width:' + (100 * Math.sqrt(b[1] / mx)).toFixed(1) + '%;background:' + [COL.silver, COL.cyan, COL.blue2, COL.green][i] + '"></i></div><b>USD ' + b[1] + ' m<small>' + (i ? (b[1] / I.bridge[0][1]).toFixed(1) + '× the round' : 'platform equity') + '</small></b></div>').join('') + '</div><div class="srcline">Widths on a square-root scale. Capital mobilisation ratio = capex reaching financial close ÷ Lumen8 capital invested, reported gross and attributed every quarter. Attribution needs a close, a Lumen8 analysis in the decision pack and written confirmation, then a 50% discount.</div>'; };
  W.traj = (el, I) => {
    el.innerHTML = ''; const Wd = 640, H = 300, L = 54, R = 20, T = 20, B = 40; const svg = svgEl('svg', { viewBox: '0 0 ' + Wd + ' ' + H }, el); const x = (y) => L + (y - 2015) / 20 * (Wd - L - R), yv = (v) => T + (H - T - B) * (1 - v / 200);
    [0, 50, 100, 150, 200].forEach((v) => { svgEl('line', { x1: L, x2: Wd - R, y1: yv(v), y2: yv(v), class: 'axis' }, svg); const t = svgEl('text', { x: L - 8, y: yv(v) + 4, 'text-anchor': 'end', class: 'sm' }, svg); t.textContent = v; });
    [2015, 2020, 2025, 2030, 2035].forEach((y) => { const t = svgEl('text', { x: x(y), y: H - 14, 'text-anchor': 'middle', class: 'sm' }, svg); t.textContent = y; });
    const band = I.sea.map((p) => x(p[0]) + ',' + yv(p[1] * .10)).join(' ') + ' ' + I.sea.slice().reverse().map((p) => x(p[0]) + ',' + yv(p[1] * .05)).join(' '); svgEl('polygon', { points: band, fill: COL.green, 'fill-opacity': .22 }, svg);
    const d = I.sea.map((p, i) => (i ? 'L' : 'M') + x(p[0]) + ',' + yv(p[1])).join(' '); const path = svgEl('path', { d, fill: 'none', stroke: COL.cyan2, 'stroke-width': 3, class: 'drawn' }, svg); const len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
    I.sea.forEach((p) => { const c = svgEl('circle', { cx: x(p[0]), cy: yv(p[1]), r: 4.5, fill: COL.cyan2 }, svg); tipOn(c, '<b>' + p[0] + ' · USD ' + p[1] + ' bn</b>Clean energy investment, Southeast Asia' + (p[0] > 2025 ? ' (needed, IEA pathway to announced goals)' : ' (IEA)') + '<small>Preparation layer at 5–10%: USD ' + (p[1] * .05).toFixed(1) + '–' + (p[1] * .1).toFixed(1) + ' bn</small>'); });
    const t1 = svgEl('text', { x: x(2026), y: yv(190) + 6, class: 'lbl', 'font-size': 11 }, svg); t1.textContent = 'USD 190 bn needed by 2035'; const t2 = svgEl('text', { x: x(2016), y: yv(0) - 8, class: 'sm' }, svg); t2.textContent = 'SHADED: THE 5–10% PREPARATION LAYER · USD bn / yr';
  };

  /* documents: fetched as ciphertext, decrypted with the session key, opened as a blob */
  W.docs = (el) => {
    if (!el) return; const docs = BUNDLE.docs || [];
    el.innerHTML = docs.length ? docs.map((d) => '<div class="doc"><i>PDF</i><div><b>' + esc(d.title) + '</b><span>' + esc(d.sub) + ' · ' + (d.size / 1048576).toFixed(1) + ' MB</span></div><div class="acts"><button data-open="' + esc(d.slug) + '">Open</button><button data-save="' + esc(d.slug) + '">Save</button></div></div>').join('') : '<p class="srcline">No documents in this build.</p>';
    const fetchDoc = async (slug) => { const d = docs.find((x) => x.slug === slug); const buf = new Uint8Array(await (await fetch('/investors/docs/' + slug + '.enc', { cache: 'force-cache' })).arrayBuffer()); const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, KEY, buf.slice(12)); return { d, url: URL.createObjectURL(new Blob([pt], { type: d.type })) }; };
    $$('button', el).forEach((b) => b.addEventListener('click', async () => { b.classList.add('busy'); try { const { d, url } = await fetchDoc(b.dataset.open || b.dataset.save); if (b.dataset.open) { const w = window.open(url, '_blank'); if (!w) location.href = url; } else { const a = document.createElement('a'); a.href = url; a.download = d.name; document.body.appendChild(a); a.click(); a.remove(); } } catch (x) { alert('Could not open the document: ' + (x.message || x)); } b.classList.remove('busy'); }));
  };
})();
