/* LUMEN8 site - module stages: the diorama of a module, drawn live.
 *
 * Every [data-model="<id>"] holds the baked image of its module until it comes
 * near the screen; then the live SVG replaces it, so the model can come alive
 * under the pointer (its lights, flows, rotors and steam run only while
 * hovered - an animated inline SVG repaints whole every frame, so an idle
 * model stays still and only floats).
 */
import { art } from './dioramas/index.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function wake(host) {
  const id = host.dataset.model;
  const svg = art(id, 'iso stage-svg');
  if (!svg) return;
  host.querySelector('.stage-model')?.insertAdjacentHTML('beforeend', svg);
  host.querySelector('.stage-model img')?.remove();
  host.classList.add('is-live');
  if (reduce) return;
  const tilt = host.querySelector('.stage-model');
  host.addEventListener('pointerenter', () => host.classList.add('hx-anim'));
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    tilt.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2)}deg`);
    tilt.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2)}deg`);
  });
  host.addEventListener('pointerleave', () => {
    host.classList.remove('hx-anim');
    tilt.style.removeProperty('--rx'); tilt.style.removeProperty('--ry');
  });
}

const io = new IntersectionObserver((en) => en.forEach((e) => {
  if (!e.isIntersecting) return;
  io.unobserve(e.target);
  wake(e.target);
}), { rootMargin: '300px 0px' });
document.querySelectorAll('[data-model]').forEach((el) => io.observe(el));
