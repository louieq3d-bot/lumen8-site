/* One isometric diorama per module, drawn in code (./iso.js + ./scenes-*.js).
 *
 * art()    inline SVG - used where the model moves (the wheel's hero, the
 *          module stages): its hx-* pieces animate only inside .hx-anim.
 * artUrl() the same picture as a cached data: URI, for every small copy, so
 *          fifteen models on a ring cost one raster each.
 */
import { MODULES } from '../catalog.js';
import { portfolio, jarvis, village, telco, maritime, agri, agrivoltaics } from './scenes-a.js';
import { twin, utility, wind, geothermal, supply, aqua, hydroponics, hydropower } from './scenes-b.js';

const SCENES = {
  portfolio, jarvis, energy: village, telco, maritime, agri, agrivoltaics,
  twin, utility, wind, geothermal, supply, aqua, hydroponics, hydropower,
};

export const sceneOf = (id) => {
  const m = MODULES.find((x) => x.id === id);
  return SCENES[(m && m.scene) || id];
};

let seq = 0;
export function art(id, cls = 'iso') {
  const fn = sceneOf(id);
  if (!fn) return '';
  return fn(`s${id.slice(0, 3)}${(seq++).toString(36)}`).replace('class="iso"', `class="${cls}"`);
}

const urls = new Map();
export function artUrl(id) {
  if (!urls.has(id)) {
    const fn = sceneOf(id);
    urls.set(id, fn ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fn(`u${id.slice(0, 3)}`))}` : '');
  }
  return urls.get(id);
}
