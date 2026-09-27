/* LUMEN8 site - the module wheel: what the platform does, on one dial.
 *
 * The same wheel as the platform's Home: fifteen module dioramas on one ring
 * inside a watch-style bezel. The module at 12 o'clock is the selected one;
 * its model stands large in the middle and the copy column beside the wheel
 * describes it. On the site the bezel also carries the five pillars of
 * sustainable development as printed arcs, so the dial reads as a map of the
 * platform, not a carousel.
 *
 * It turns one module at a time on its own while it is on screen (the line
 * under the copy fills while it waits); hovering the wheel or the copy holds
 * it, and picking anything by hand stops it for good. Nodes are HTML buttons
 * placed in % of the wheel box each frame of a turn, so the dial scales with
 * its column and nothing counter-rotates. Ring copies are the baked images in
 * /assets/dioramas/; only the hero in the middle is live SVG, and it animates
 * only under the pointer (an animated inline SVG repaints whole every frame).
 */
import { MODULES, PILLARS, SDG, STATUS, pillarOf } from './catalog.js';
import { art } from './dioramas/index.js';

const RING = 38.6;      // node ring radius, % of the wheel box
const BEZEL = 49.3;     // bezel radius
const TURN_MS = 1100;   // one module-to-module turn
const TILT = 7;         // max hero tilt, degrees
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (i) => String(i).padStart(2, '0');
const f2 = (v) => v.toFixed(2);
const pt = (r, deg) => { const a = deg * Math.PI / 180; return [50 + r * Math.sin(a), 50 - r * Math.cos(a)]; };
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CHEV = (d) => `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d < 0 ? 'M12 5 7 10l5 5' : 'M8 5l5 5-5 5'}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* an arc from deg0 to deg1 (clockwise from 12 o'clock), or back again */
function arcD(r, deg0, deg1, back = false) {
  const [x0, y0] = pt(r, back ? deg1 : deg0), [x1, y1] = pt(r, back ? deg0 : deg1);
  const large = Math.abs(deg1 - deg0) > 180 ? 1 : 0;
  return `M${f2(x0)} ${f2(y0)}A${r} ${r} 0 ${large} ${back ? 0 : 1} ${f2(x1)} ${f2(y1)}`;
}

function ticks(n) {
  let s = '';
  for (let k = 0; k < 120; k++) {
    const [x0, y0] = pt(46.9, k * 3), [x1, y1] = pt(48.1, k * 3);
    s += `<line class="sw-tick" x1="${f2(x0)}" y1="${f2(y0)}" x2="${f2(x1)}" y2="${f2(y1)}"/>`;
  }
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pt(45.8, i * 360 / n), [x1, y1] = pt(48.1, i * 360 / n);
    s += `<line class="sw-tick maj" x1="${f2(x0)}" y1="${f2(y0)}" x2="${f2(x1)}" y2="${f2(y1)}"/>`;
  }
  return s;
}

export function mountWheel(section) {
  const wheelHost = section.querySelector('[data-wheel]');
  const copyHost = section.querySelector('[data-wheel-copy]');
  const pillarHost = section.querySelector('[data-wheel-pillars]');
  if (!wheelHost || !copyHost) return null;

  const mods = MODULES, n = mods.length, step = 360 / n, GAP = 1.1;
  const span = PILLARS.map((p) => {
    const idx = mods.map((m, i) => (m.pillar === p.id ? i : -1)).filter((i) => i >= 0);
    return { p, a: idx[0], b: idx[idx.length - 1], count: idx.length };
  });
  let rot = 0, sel = -1, raf = 0, tween = null;
  let auto = !reduce, inView = false;

  wheelHost.innerHTML = `
    <div class="sw" tabindex="0" role="listbox" aria-label="Platform modules. Arrow keys turn the wheel.">
      <svg class="sw-rings" viewBox="0 0 100 100" aria-hidden="true">
        <defs>${span.map((s, k) => `<path id="sw-lp${k}" d=""/>`).join('')}</defs>
        <circle cx="50" cy="50" r="${BEZEL}" class="sw-bezel"/>
        <g class="sw-turn">
          <g class="sw-ticks">${ticks(n)}</g>
          ${span.map((s) => `<path class="sw-parc" data-p="${s.p.id}" style="--pc:${s.p.color}" d="${arcD(BEZEL, (s.a - 0.5) * step + GAP, (s.b + 0.5) * step - GAP)}"/>`).join('')}
        </g>
        <path class="sw-sel-glow" d="${arcD(BEZEL, -step / 2 + GAP, step / 2 - GAP)}"/>
        <path class="sw-sel-arc" d="${arcD(BEZEL, -step / 2 + GAP, step / 2 - GAP)}"/>
        <circle cx="50" cy="50" r="${RING}" class="sw-track"/>
        <circle cx="50" cy="50" r="31" class="sw-inner"/>
        <path class="sw-mark" d="M48.9 -1.6 L51.1 -1.6 L50 0.3 Z"/>
        <g class="sw-plabels">${span.map((s, k) => `<text data-p="${s.p.id}" style="--pc:${s.p.color}"><textPath href="#sw-lp${k}" startOffset="50%" text-anchor="middle">${esc(s.p.name.toUpperCase())}</textPath></text>`).join('')}</g>
      </svg>
      <div class="sw-center"></div>
      ${mods.map((m, i) => `
        <button type="button" class="sw-node${m.status === 'soon' ? ' is-soon' : ''}" data-i="${i}" data-p="${m.pillar}" style="--c:${pillarOf(m).color}" role="option" aria-label="${esc(m.title)}: ${esc(m.tag)}">
          <span class="sw-art"><img src="/assets/dioramas/md/${m.id}.webp" alt="" width="360" height="360" loading="lazy" decoding="async" draggable="false"></span>
          <span class="sw-lbl">${esc(m.title)}</span>
          <span class="sw-tag">${esc(m.tag)}</span>
          ${m.status === 'soon' ? '<span class="sw-soon">Soon</span>' : ''}
        </button>`).join('')}
    </div>`;

  const wheel = wheelHost.querySelector('.sw');
  const nodes = [...wheel.querySelectorAll('.sw-node')];
  const center = wheel.querySelector('.sw-center');
  const turn = wheel.querySelector('.sw-turn');
  const lpaths = span.map((s, k) => wheel.querySelector(`#sw-lp${k}`));

  if (pillarHost) {
    pillarHost.innerHTML = span.map((s) => `
      <button type="button" class="sw-pbtn" data-p="${s.p.id}" style="--pc:${s.p.color}" aria-pressed="false">
        <i></i><span><b>${esc(s.p.name)}</b><em>SDG ${s.p.sdgs.join(' · ')}</em></span><small>${pad(s.count)}</small>
      </button>`).join('');
    pillarHost.querySelectorAll('.sw-pbtn').forEach((b) => {
      const k = span.findIndex((s) => s.p.id === b.dataset.p);
      b.addEventListener('click', () => goTo(span[k].a, true));
      b.addEventListener('pointerenter', () => wheel.dataset.focus = b.dataset.p);
      b.addEventListener('pointerleave', () => delete wheel.dataset.focus);
      b.addEventListener('focus', () => wheel.dataset.focus = b.dataset.p);
      b.addEventListener('blur', () => delete wheel.dataset.focus);
    });
  }

  function place() {
    nodes.forEach((el, i) => {
      const [x, y] = pt(RING, i * step + rot);
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
    });
    turn.setAttribute('transform', `rotate(${rot.toFixed(3)} 50 50)`);
    // the pillar names are printed on the bezel and always read upright:
    // an arc in the lower half is written right to left so its text is not upside down
    span.forEach((s, k) => {
      const d0 = (s.a - 0.5) * step + rot, d1 = (s.b + 0.5) * step + rot;
      const mid = (((d0 + d1) / 2) % 360 + 360) % 360;
      const low = mid > 90 && mid < 270;
      lpaths[k].setAttribute('d', arcD(low ? 53.9 : 51.6, d0 - 20, d1 + 20, low));
    });
  }

  function hero(m) {
    center.querySelectorAll('.sw-hero').forEach((el) => { el.classList.add('is-out'); setTimeout(() => el.remove(), 500); });
    const h = document.createElement('a');
    h.className = 'sw-hero';
    h.href = m.href;
    h.setAttribute('aria-label', `Explore ${m.title}`);
    h.innerHTML = `<div class="sw-tilt">${art(m.id, 'iso sw-big')}</div>
      <span class="sw-open">Explore ${esc(m.title)} ${ARROW}</span>`;
    const tilt = h.querySelector('.sw-tilt');
    h.addEventListener('pointermove', (e) => {
      if (reduce) return;
      const r = h.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty('--ry', `${(px * TILT).toFixed(2)}deg`);
      tilt.style.setProperty('--rx', `${(-py * TILT).toFixed(2)}deg`);
    });
    h.addEventListener('pointerenter', () => h.classList.add('hx-anim'));
    h.addEventListener('pointerleave', () => {
      h.classList.remove('hx-anim');
      tilt.style.removeProperty('--rx'); tilt.style.removeProperty('--ry');
    });
    center.appendChild(h);
  }

  function select(i) {
    sel = i;
    const m = mods[i], p = pillarOf(m);
    nodes.forEach((el, k) => { el.classList.toggle('is-sel', k === i); el.setAttribute('aria-selected', String(k === i)); });
    section.style.setProperty('--c', p.color);
    wheel.dataset.pillar = p.id;
    pillarHost?.querySelectorAll('.sw-pbtn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === p.id)));
    hero(m);

    copyHost.innerHTML = `
      <div class="sw-c" data-id="${m.id}">
        <div class="sw-meta">
          <span class="sw-idx">${pad(i + 1)}</span><span class="sw-of">/ ${pad(n)}</span>
          <span class="sw-pill">${esc(p.name)}</span>
          <span class="chip ${m.status === 'live' ? 'on' : m.status === 'early' ? 'soon' : 'dev'}">${STATUS[m.status]}</span>
        </div>
        <h3 class="sw-name">${esc(m.title)}</h3>
        <p class="sw-tagline">${esc(m.tag)}</p>
        <p class="sw-pitch">${esc(m.pitch)}</p>
        <ul class="sw-does">${m.does.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
        <div class="sw-sdgs" aria-label="Sustainable Development Goals served">
          ${m.sdgs.map((g) => `<span class="sdg"><b>SDG ${g}</b>${esc(SDG[g])}</span>`).join('')}
        </div>
        <div class="sw-actions">
          <a class="btn primary" href="${m.href}"><span>Explore ${esc(m.title)}</span>${ARROW}</a>
          <div class="sw-step">
            <button type="button" data-d="-1" aria-label="Previous module">${CHEV(-1)}</button>
            <button type="button" data-d="1" aria-label="Next module">${CHEV(1)}</button>
          </div>
        </div>
        ${auto ? '<div class="sw-progress" aria-hidden="true"><i></i></div>' : ''}
      </div>`;
    copyHost.querySelectorAll('.sw-step button').forEach((b) =>
      b.addEventListener('click', () => goTo(sel + Number(b.dataset.d), true)));
    copyHost.querySelector('.sw-progress i')?.addEventListener('animationend', () => { if (auto) goTo(sel + 1); });
  }

  function goTo(i, byUser = false) {
    if (byUser && auto) { auto = false; section.classList.add('is-manual'); }
    const k = ((i % n) + n) % n;
    let want = -k * step;
    while (want - rot > 180) want -= 360;
    while (rot - want > 180) want += 360;
    if (k !== sel) select(k);
    if (reduce) { rot = want; place(); return; }
    tween = { from: rot, to: want, t0: performance.now() };
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame(t) {
    raf = 0;
    if (!tween) return;
    const q = Math.min(1, (t - tween.t0) / TURN_MS);
    rot = tween.from + (tween.to - tween.from) * ease(q);
    place();
    if (q < 1) raf = requestAnimationFrame(frame);
    else tween = null;
  }

  nodes.forEach((el) => el.addEventListener('click', () => {
    const i = Number(el.dataset.i);
    if (i === sel && !tween) location.href = mods[i].href;
    else goTo(i, true);
  }));
  wheel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(sel + 1, true); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(sel - 1, true); }
    if (e.key === 'Enter') location.href = mods[sel].href;
  });

  // the dial only turns itself while someone can see it
  new IntersectionObserver((en) => {
    inView = en[0].isIntersecting;
    section.classList.toggle('is-idle', !inView);
  }, { threshold: 0.25 }).observe(wheel);
  section.classList.add('is-idle');

  place();
  select(0);
  return { goTo };
}

document.querySelectorAll('[data-wheel-section]').forEach((s) => mountWheel(s));
