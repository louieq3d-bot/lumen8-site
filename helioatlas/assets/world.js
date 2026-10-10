/* HelioAtlas — world.js (pass 8: REAL GLOBE + FARM + LIGHTNESS).
   Performance + resolution + premium look — keeps every pass-6 + pass-5 fix:
     • two scenes (globe + city), cross-fade on altitude (60 → 15 km)
     • Catmull-Rom spline camera tracks, station-eased layers
     • critical-damped progress + camera spring (no overshoot, no snap)
     • Euler tangent + project() that accepts [x,y,z] arrays
     • sun direction set after buildEarth
     • renderer.setSize(W,H,false) with setPixelRatio(1) (manual DPI)
     • progressive load (globe first, city in requestIdleCallback)
     • no lazy compiles (compileAsync + warm render in _precompileScene)
     • shadows: autoUpdate = false, quantised to whole texels
     • render on demand (rAF unscheduled when idle)
     • DPR policy: step down only, never up
     • RTs kept allocated (MSAA = 0 — cloud veil hides cross-fade aliasing)
     • checkShaderErrors off unless ?glcheck
     • earth-day-4k + earth-clouds-2k textures, cloud-dive veil (uVeil/uZoom)
     • CROSSFADE_HIGH_KM 900
     • distance-based fog (tightens below 4 km, lifts during cross-fade)

   Pass 7 NEW:
     • PMREM/RoomEnvironment DELETED from _buildCityEnv — 4 programs and
       ~320 ms gone; scene.environment is never set; standard materials
       reflect no envmap (panels take their sheen from the sun).
     • RTs: samples = 0 (cloud veil hides the cross-fade). _ensureRTs
       allocates at full cssW*dpr × cssH*dpr from the start (no 2×2
       placeholder, no resize before the first cross-fade frame).
     • GLOBE FIRST — uDay is bound to a 1×1 placeholder DataTexture from
       t=0 so the shader compiles and renders immediately; the real 4k
       webp loads in the background and is swapped into the same uniform
       (no recompile). Globe sphere is shared with the cloud mesh
       (scaled 1.012) — one geometry, one upload.
     • STARS — canvas 2048×1024 (½ of previous 4096×2048) painted with
       sub-pixel radii (radius < 1 px = anti-aliased, no second pass).
     • CITY BUILD — scheduled in requestIdleCallback (fallback setTimeout
       50) so the first globe frame paints before the city touch starts.
       Within _buildCityBody the outer-ground texture builder yields
       every ~16 ms so no main-thread task > 40 ms.
     • WARM TOUR — 12 stations (not 24), exactly ONE warm render per
       rAF, capped at 5 s. Spread over 12 frames ≈ 200 ms total.
     • STATIONS POLISHED — focus (.70) SE 3/4 view at 261 m, 28.9° down,
       fov 48 (warehouse 42 % of frame, horizon above top edge);
       panels (.84) 122 m, 45° down; pullback (1.0) 422 m with
       warehouse in lower-left third.
     • TIMINGS — world.timings = { globeFirstFrame, cityBuilt,
       programsCompiled, warmDone, cityReady } (performance.now()
       relative to navigationStart).

   Cross-worker contract (pass 7): world-city.js MAY also export
   buildCityAsync; if missing, world.js runs buildCity then yields once
   so the user never blocks the main thread for > 50 ms. This file
   owns world.js only.
*/
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

/* ── constants ── */
const EARTH_RADIUS_KM = 6371;
const KM = EARTH_RADIUS_KM;
/* PASS 8: site moved to the Western Cape. The Earth + cloud meshes carry
   NO Euler tilt; the surface direction of (lat, lon) is
   dir = (cos(lat)cos(lon), sin(lat), -cos(lat)sin(lon)) so the spin axis is
   world +Y and north stays up at every altitude. */
const SITE_LAT = -33.47;
const SITE_LON = 19.63;
const CITY_LAT = SITE_LAT;
const CITY_LON = SITE_LON;
const GLOBE_FAR_KM = 22000;
/* pass 8: cloud-dive band matches the new altTrack (200 km → 4 km).
   The veil hides the switch from globe → city so MSAA stays off. */
const CROSSFADE_HIGH_KM = 200;
const CROSSFADE_LOW_KM  = 4;
const OUTER_GROUND_RADIUS_M = 25000;
/* DPR policy (per brief): start at min(DPR, 2); step down to 1.5 / 1.25 if the
   first 90 frames AFTER cityReady are slow while idle. */
const DPR_INITIAL = Math.min(window.devicePixelRatio || 1, 1.5);   /* lead: fixed at load; runtime DPR switching froze 3 s on resize */
const DPR_STEP = [1.5, 1.25];
const DPR_THRESHOLD_MS = 22;
/* progress smoothing — critically damped spring, half-life 0.12 s */
const PROGRESS_HALFLIFE_S = 0.12;
/* camera position spring (slightly slower so a direction change never snaps) */
const CAMERA_HALFLIFE_S   = 0.18;
/* max-dt clamp protects against long frame stalls */
const MAX_DT_S = 1 / 30;

/* ── helpers ── */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const smootherstep = (x) => { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };

/* critical-damped scalar spring, no overshoot */
function smoothToward(current, target, dt, halfLife){
  const k = 1 - Math.exp(-dt * Math.LN2 / Math.max(1e-3, halfLife));
  return current + (target - current) * k;
}

function mulberry32(seed){
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* yield once so the browser gets to flush the next paint before we keep going */
const yieldOnce = () => new Promise(r => setTimeout(r, 0));
/* same as above but flagged as "may yield if needed" — used inside big loops */
const yieldIfNeeded = (startMs, MAX_MS = 40) => new Promise(r => setTimeout(r, Math.max(0, MAX_MS - (performance.now() - startMs))));

/* Catmull-Rom on four control points (uniform parameterisation) */
function catmullRom(p0, p1, p2, p3, t){
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function sampleTrack(track, p){
  const first = track[0];
  const last = track[track.length - 1];
  if (p <= first.p){
    const o = {}; for (const k in first) if (k !== 'p') o[k] = first[k];
    return o;
  }
  if (p >= last.p){
    const o = {}; for (const k in last) if (k !== 'p') o[k] = last[k];
    return o;
  }
  for (let i = 0; i < track.length - 1; i++){
    const a = track[i], b = track[i + 1];
    if (p >= a.p && p <= b.p){
      const seg = (p - a.p) / (b.p - a.p);
      const e = smootherstep(seg);
      const o = {};
      const keys = new Set();
      for (const k in a) keys.add(k);
      for (const k in b) keys.add(k);
      for (const k of keys){
        if (k === 'p') continue;
        if (typeof a[k] === 'number' && typeof b[k] === 'number') o[k] = lerp(a[k], b[k], e);
        else if (k in a) o[k] = a[k];
        else o[k] = b[k];
      }
      return o;
    }
  }
  return last;
}

function sampleVec3(track, p, out){
  if (p <= track[0].p){ out.copy(track[0].v); return; }
  if (p >= track[track.length - 1].p){ out.copy(track[track.length - 1].v); return; }
  let i = 0;
  for (; i < track.length - 1; i++) if (p >= track[i].p && p <= track[i + 1].p) break;
  const a = track[Math.max(0, i - 1)], b = track[i], c = track[i + 1], d = track[Math.min(track.length - 1, i + 2)];
  const seg = (p - b.p) / (c.p - b.p);
  const t = smootherstep(seg);
  out.x = catmullRom(a.v.x, b.v.x, c.v.x, d.v.x, t);
  out.y = catmullRom(a.v.y, b.v.y, c.v.y, d.v.y, t);
  out.z = catmullRom(a.v.z, b.v.z, c.v.z, d.v.z, t);
  return out;
}

/* ── default stations ──
   PASS 8: globe north-up, no Euler tilt. Surface direction (lat, lon):
     dir = (cos(lat)cos(lon), sin(lat), -cos(lat)sin(lon))
   p=0 camera looks at (lat -6, lon 20) — Africa centred, north up; the
   descent slerps toward SITE (33.4 S, 19.3 E) while altitude drops from
   18000 → 400 km. Below 200 km the cloud-dive veil hides the switch
   into the valley scene (Western Cape late-afternoon golden hour).
   City track is in metres; +x east, -z NORTH, +y up; origin = centre of
   FOCUS packhouse footprint. */
function buildDefaultStations(){
  const d2r = Math.PI / 180;
  const latS = SITE_LAT * d2r;
  const lonS = SITE_LON * d2r;
  const tanAt = (lat, lon) => new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon)
  ).normalize();
  const tanSite = tanAt(latS, lonS);
  /* p=0 first-frame centre: Africa, north up. (lat -6°, lon 20°)
     dir = (cos(-6)cos(20), sin(-6), -cos(-6)sin(20)) ≈ (0.935, -0.105, -0.340) */
  const tanFirst = tanAt(-6 * d2r, 20 * d2r);
  const tanMid = tanFirst.clone().add(tanSite).normalize();
  const globePosAt = (tan, altKm) => tan.clone().multiplyScalar(1 + altKm / KM);

  /* Globe track — slerp camera direction from (lat -6, lon 20) to SITE while
     altitude drops 18000 → 400 km. Catmull-Rom curves through the mid point.
     fov tuned so the Earth disc fills ~70 % of viewport height at p=0
     (30° angular size at 18000 km / fov 44 = 70 %). */
  const globeTrack = [
    { p: 0.000, pos: globePosAt(tanFirst, 18000).toArray(), target: tanFirst.clone().multiplyScalar(0.88).toArray(), fov: 44 },
    { p: 0.030, pos: globePosAt(tanMid,    9000).toArray(), target: tanMid.clone().multiplyScalar(0.91).toArray(),    fov: 46 },
    { p: 0.060, pos: globePosAt(tanSite,   4500).toArray(), target: tanSite.clone().multiplyScalar(0.94).toArray(),   fov: 50 },
    { p: 0.100, pos: globePosAt(tanSite,   1500).toArray(), target: tanSite.clone().multiplyScalar(0.97).toArray(),   fov: 54 },
    { p: 0.140, pos: globePosAt(tanSite,    400).toArray(), target: tanSite.clone().toArray(),                       fov: 58 },
    { p: 0.158, pos: globePosAt(tanSite,    200).toArray(), target: tanSite.clone().toArray(),                       fov: 62 },
    { p: 0.180, pos: globePosAt(tanSite,     80).toArray(), target: tanSite.clone().toArray(),                       fov: 68 },
    { p: 0.205, pos: globePosAt(tanSite,     30).toArray(), target: tanSite.clone().toArray(),                       fov: 72 },
  ];

  /* City/valley track in metres. FOCUS packhouse at the origin (180 m × 64 m,
     12.4 m ridge). Valley ~3 km wide, mountains 2.6-3.4 km out.
       • .158 top-down high above the valley — valley floor fills the frame
       • .205 descending oblique — coming in from the south
       • .280 VALLEY wide golden-hour oblique from the south
       • .420 TERRITORY higher oblique for the ribbon
       • .560 RANK oblique where all 10 pins are visible
       • .700 FOCUS 3/4 NE view, ~300 m, hall 45 % of frame width
       • .840 PANELS 140 m low oblique from the north (PV plane fills lower 2/3)
       • 1.000 gentle pull-back to ~460 m, hall lower-left third, mountains behind */
  const cityTrack = [   /* lead, pass 8: framed on the real Hex River valley terrain (axis runs WSW -> ENE) */
    { p: 0.158, pos: [    0, 8000,    1],  target: [   0,  0,    0],  fov: 40 },
    { p: 0.180, pos: [ -600, 5600, 1200],  target: [   0,  0,    0],  fov: 44 },
    { p: 0.205, pos: [-1900, 3200, 1700],  target: [ 200,  0, -100],  fov: 48 },
    { p: 0.225, pos: [-3000, 1800, 1900],  target: [ 400,  0, -200],  fov: 50 },
    { p: 0.280, pos: [-3800,  900, 1900],  target: [ 600,  0, -300],  fov: 50 },
    { p: 0.420, pos: [-3300, 3000, 3300],  target: [ 300,  0, -300],  fov: 50 },
    { p: 0.560, pos: [-2300, 1500, 2300],  target: [ 200,  0, -150],  fov: 48 },
    { p: 0.700, pos: [ -317,  140,  -65],  target: [   7,  4,   -9],  fov: 40 },   /* v12 DESIGN: high 3/4 from the NW, office end and forecourt nearest */
    { p: 0.770, pos: [ -292,  120,  -60],  target: [   6,  5,  -10],  fov: 41 },   /* v12: keeps the Design->Close push-in above the trees */
    { p: 0.840, pos: [ -265,   95,  -53],  target: [   5,  6,  -12],  fov: 42 },   /* v12 CLOSE: the same view, pushed in */
    { p: 1.000, pos: [ -420,  230, -470],  target: [  80, 10,   50],  fov: 48 },
  ];

  /* Altitude track — canonical "how high" in km, used by the cross-fade
     logic. Above CROSSFADE_HIGH_KM (200) → globe only; below
     CROSSFADE_LOW_KM (4) → city only; between → composite cross-fade. */
  const altTrack = [
    { p: 0.000, altKm: 18000 },
    { p: 0.060, altKm: 4500 },
    { p: 0.140, altKm: 400 },
    { p: 0.158, altKm: 200 },
    { p: 0.165, altKm: 100 },
    { p: 0.180, altKm: 50 },
    { p: 0.205, altKm: 15 },
    { p: 0.225, altKm: 4 },
    { p: 0.280, altKm: 1.50 },   /* VALLEY 1500 m up */
    { p: 0.420, altKm: 2.40 },   /* TERRITORY 2400 m up (higher, ribbon fits) */
    { p: 0.560, altKm: 1.20 },   /* RANK 1200 m up */
    { p: 0.700, altKm: 0.32 },   /* FOCUS ~317 m */
    { p: 0.840, altKm: 0.16 },   /* PANELS 160 m */
    { p: 1.000, altKm: 0.48 },   /* pull-back ~480 m */
  ];

  /* Stations layer table — eight beats that match the home hero copy:
       earth / descent / valley / solar / territory / rank / focus / panels.
     Solar ramps up at .28 (valley — every roof grades amber) holds at .42
     (territory — ribbon draws over amber belt) and at .56 (rank — pins
     pulse on amber roofs), then dims to 0.35 at .70 (focus — rest of scene
     desaturates; amber holds on the focus roof) and 0.20 at .84 (panels —
     focus + panels take the stage), then back to 1.0 at 1.0 (full scene). */
  const stations = [
    { p: 0.000, altKm: 18000, layers: { globe: 1 } },
    { p: 0.100, altKm: 1500,  layers: { globe: 1, city: 1 } },
    { p: 0.140, altKm: 400,   layers: { globe: 1, city: 1 } },
    { p: 0.158, altKm: 200,   layers: { globe: 1, city: 1 } },
    { p: 0.205, altKm: 15,    layers: { globe: 1, city: 1 } },
    { p: 0.225, altKm: 4,     layers: { city: 1 } },
    { p: 0.280, altKm: 1.50,  layers: { city: 1 } },                                        /* v12: land on real roofs */
    { p: 0.420, altKm: 2.40,  layers: { city: 1, territory: 1, territoryDraw: 1 } },         /* SURVEY: the scan outline draws */
    { p: 0.490, altKm: 1.80,  layers: { city: 1, solar: 1, territory: 1 } },                 /* SCORE: roofs grade amber */
    { p: 0.560, altKm: 1.20,  layers: { city: 1, solar: 1, territory: 1, rank: 1 } },
    { p: 0.700, altKm: 0.32,  layers: { city: 1, solar: 0.35, territory: 1, focus: 1, panels: 0.2 } },   /* v12: the fill starts in DESIGN */
    { p: 0.840, altKm: 0.16,  layers: { city: 1, solar: 0.20, focus: 1, panels: 1 } },
    { p: 1.000, altKm: 0.48,  layers: { city: 1, solar: 0.25, focus: 0.5, panels: 1 } },
  ];

  return { globeTrack, cityTrack, altTrack, stations };
}

function defaultLayers(){
  return { solar: 0, territory: 0, territoryDraw: 0, rank: 0, focus: 0, panels: 0, night: 0, globe: 0, city: 0 };
}

function parseDebugCam(){
  try {
    const q = new URLSearchParams(location.search), c = q.get('cam');
    if (!c) return { pos: null };
    const v = s => new THREE.Vector3(...String(s).split(',').map(Number));
    return { pos: v(c), tgt: v(q.get('tgt') || '0,0,0'), fov: q.get('fov') ? +q.get('fov') : undefined };
  } catch (e) { return { pos: null }; }
}

function sampleLayerTrack(stations, p){
  const allKeys = new Set();
  for (const s of stations){
    if (s.layers) for (const k in s.layers) allKeys.add(k);
  }
  const stationVals = stations.map(s => {
    const o = {};
    for (const k of allKeys) o[k] = (s.layers && typeof s.layers[k] === 'number') ? s.layers[k] : 0;
    return o;
  });
  if (p <= stations[0].p) return { ...stationVals[0] };
  if (p >= stations[stations.length - 1].p) return { ...stationVals[stationVals.length - 1] };
  for (let i = 0; i < stations.length - 1; i++){
    const a = stations[i], b = stations[i + 1];
    if (p >= a.p && p <= b.p){
      const seg = (p - a.p) / (b.p - a.p);
      const e = smootherstep(seg);
      const result = {};
      for (const k of allKeys) result[k] = lerp(stationVals[i][k], stationVals[i + 1][k], e);
      return result;
    }
  }
  return { ...stationVals[stationVals.length - 1] };
}

/* ── Earth shaders (PASS 6 — added multi-octave fbm land detail that strengthens
   with zoom, brighter river/valley lines, lower contrast terminator). The cloud
   shell now also casts a darker ground-shadow tint on the Earth when the sun is
   high. ── */
const EARTH_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main(){
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const EARTH_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uLand;
  uniform sampler2D uDay;      /* real day imagery (equirect, sRGB) */
  uniform sampler2D uRegion;   /* 0.7 km/px southern-Africa crop */
  uniform vec4 uRegionBox;     /* u0, v0, du, dv of the crop in globe uv */
  uniform float uRegionOn;
  uniform vec3 uSunDir;
  uniform float uTime;
  uniform vec3 uForest, uSavanna, uDesert, uTemperate, uPale;
  uniform vec3 uOceanHi, uOceanLo, uNightOcean, uNightLand;
  uniform float uDetail;      /* pass 6: 0..1, controlled by altitude — strengthens land detail at zoom */
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
  vec3 linToSrgb(vec3 c){ return mix(c*12.92,pow(c,vec3(1.0/2.4))*1.055-0.055,step(0.0031308,c)); }

  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y); }
  float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.05; a*=0.5; } return v; }

  void main(){
    vec3 N = normalize(vWorldNormal);
    float lat = asin(clamp(N.y, -1.0, 1.0));
    float aL = abs(lat);

    float land = texture2D(uLand, vUv).r;
    land = smoothstep(0.30, 0.60, land);

    float t1 = smoothstep(0.15, 0.40, aL);
    float t2 = smoothstep(0.40, 0.62, aL);
    float t3 = smoothstep(0.62, 0.82, aL);
    float t4 = smoothstep(1.05, 1.40, aL) * 0.65;
    vec3 landCol = mix(uForest, uSavanna, t1);
    landCol = mix(landCol, uDesert, t2);
    landCol = mix(landCol, uTemperate, t3);
    landCol = mix(landCol, uPale, t4);

    /* PASS 6: multi-octave fbm detail — strengthens with zoom (uDetail 0..1).
       4 octaves give forest -> savanna biome variation, then a finer octave
       adds relief tint (darker river/valley lines) that reads as terrain. */
    /* lead: 20 noise lookups per pixel cost 60-100 ms/frame on the iGPU; the imagery carries the far view, so the
       relief detail only runs when zoomed in (uDetail is a uniform: the branch is coherent) */
    float relief = 1.0, valley = 0.0;
    if (uDetail > 0.01){
      vec2 np = vUv * 18.0;
      float n1 = fbm(np);
      float n3 = fbm(np * 5.1 + vec2(2.1, 4.9));
      float n4 = fbm(np * 12.7 + vec2(15.2, 7.8));
      relief = 0.92 + (n3 - 0.5) * 0.20 * uDetail + n1 * 0.16;
      valley = smoothstep(0.62, 0.78, n4) * uDetail;
    }

    float ndl = dot(N, normalize(uSunDir));
    float day = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
    vec3 oceanDay = mix(uOceanLo, uOceanHi, smoothstep(0.0, 1.0, day));

    /* tighter specular — small dot on water only, no glare */
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(normalize(uSunDir) + V);
    float specRaw = pow(max(dot(N, H), 0.0), 240.0);
    float specMask = smoothstep(0.65, 0.95, day) * (1.0 - land);
    vec3 ocean = oceanDay;   /* lead: no glint - it balloons into a white smudge as the camera zooms */

    /* imagery-led day side: the procedural biome colours only add relief at close zoom */
    vec3 img = texture2D(uDay, vUv).rgb;
    /* v12: the imagery paints inland lakes pure black and parts of the deep ocean near-black: read both as water */
    vec3 waterCol = vec3(0.0045, 0.030, 0.090);   /* linear: the open-ocean blue of the imagery around Africa */
    float mxc = max(img.r, max(img.g, img.b));
    float lake = max(1.0 - smoothstep(0.0025, 0.007, mxc), (1.0 - smoothstep(0.006, 0.014, mxc)) * step(img.g - 0.0005, img.b));
    img = mix(img, waterCol, lake * land);
    img = mix(img, max(img, uOceanLo * 1.15), 1.0 - land);
    if (uRegionOn > 0.5){
      vec2 ruv = (vUv - uRegionBox.xy) / uRegionBox.zw;
      if (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0){
        float e = smoothstep(0.0, 0.06, min(min(ruv.x, 1.0 - ruv.x), min(ruv.y, 1.0 - ruv.y)));
        vec3 rc = texture2D(uRegion, ruv).rgb;
        float water = max(smoothstep(0.012, 0.06, rc.b - max(rc.r, rc.g)), 1.0 - smoothstep(0.004, 0.012, max(rc.r, max(rc.g, rc.b))));   /* land only: keep the global ocean (v12: black pixels are water too) */
        img = mix(img, rc, e * (1.0 - water));
      }
    }
    float lit = 0.50 + 0.62 * smoothstep(-0.15, 0.65, ndl);
    vec3 baseDay = img * lit * mix(1.0, relief * 1.08, 0.45 * uDetail);
    baseDay *= 1.0 - valley * 0.25 * land;
    vec3 baseNight = mix(uNightOcean, uNightLand, land);
    float dayMix = smoothstep(-0.30, 0.15, ndl);
    vec3 base = mix(baseNight, baseDay, dayMix);

    /* sparse city lights on night land */
    if (ndl < 0.05){   /* lead: night-side only */
      vec2 lp = vUv * vec2(360.0, 180.0);
        float cn = fbm(lp * 1.6) * 0.55 + fbm(lp * 4.2 + vec2(3.1, 5.7)) * 0.45;
        float city = step(0.72, cn) * step(0.4, land) * step(-0.10, -ndl) * (1.0 - smoothstep(-0.40, 0.00, ndl));
        base += vec3(1.0, 0.78, 0.42) * city * 0.55;
      }

    /* narrow warm terminator (4% wide, day-side) */
    float termDist = abs(ndl);
    float termBand = (1.0 - smoothstep(0.035, 0.085, termDist)) * smoothstep(-0.06, 0.04, ndl);
    base = mix(base, base * vec3(1.0, 0.55, 0.30), termBand * 0.42);

    /* thin blue atmosphere rim */
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 atmoDay  = vec3(0.18, 0.40, 0.95);
    vec3 atmoTerm = vec3(1.00, 0.40, 0.18);
    vec3 rimCol   = mix(atmoDay, atmoTerm, smoothstep(0.85, 1.00, 1.0 - day));
    float rimStr  = mix(0.55, 0.18, day);
    base += rimCol * fres * rimStr;

    base = min(base, vec3(0.96));
    base = aces(base * 0.92);
    base = linToSrgb(base);
    gl_FragColor = vec4(base, 1.0);
  }
`;

const CLOUD_VERT = /* glsl */`
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const CLOUD_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform float uShadow;
  uniform float uFade;
  uniform sampler2D uCloudTex;   /* pass 6: uShadow = 0..1 controls cloud thickness
                              (more coverage = darker ground shadow on Earth). */
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  vec3 linToSrgb(vec3 c){ return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(0.0031308, c)); }

  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i),hash(i + vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y); }
  float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i=0;i<5;i++){ v += a * noise(p); p *= 2.05; a *= 0.5; } return v; }

  void main(){
    vec2 uv = vUv * 5.0;
    uv.x += uTime * 0.004;
    float n2 = 0.5;   /* lead: the cloud texture carries the shape; no per-pixel fbm */
    /* pass 6: cap alpha at 0.62 + add a self-shadow term (ndl term of the same
       fbm slightly darker) so cloud thickness reads volumetrically, not flat. */
    float ct = texture2D(uCloudTex, vUv + vec2(uTime * 0.0004, 0.0)).r;
    float c = smoothstep(0.10, 0.85, ct) * 0.80 * (0.85 + 0.3 * n2);
    float selfShadow = smoothstep(0.45, 0.95, ct) * 0.25;
    c = c * (1.0 - selfShadow * uShadow);

    vec3 N = normalize(vWorldNormal);
    float ndl = dot(N, normalize(uSunDir));
    float day = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(0.022, 0.034, 0.065), vec3(0.86, 0.84, 0.78), day);
    float term = 1.0 - abs(ndl);
    col = mix(col, vec3(0.95, 0.62, 0.42), term * 0.18);

    col = aces(col * 0.92);
    col = linToSrgb(col);
    gl_FragColor = vec4(col, c * uFade);
  }
`;

const COMP_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
`;
const COMP_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uGlobe;
  uniform sampler2D uCity;
  uniform float uMix;
  uniform float uVeil;   /* 0..1 cloud-dive veil, peaks mid cross-fade */
  uniform float uZoom;   /* grows through the band: the veil rushes past the camera */
  uniform float uAspect;
  varying vec2 vUv;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main(){
    /* lead: overlay-only veil (no render targets): the scene underneath is drawn straight to the canvas */
    vec3 col = vec3(0.0); float aOut = 0.0;
    if (uVeil > 0.001){
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float r = length(q);
      vec2 z1 = q / (0.35 + uZoom) * 3.0, z2 = q / (0.20 + uZoom * 1.7) * 5.0;
      float n = fbm(z1 + 3.1) * 0.6 + fbm(z2 + 7.7) * 0.4;
      vec3 cloud = mix(vec3(0.70, 0.76, 0.84), vec3(0.97, 0.97, 0.96), smoothstep(0.30, 0.75, n));
      float a = clamp(uVeil * (0.90 + 0.50 * smoothstep(0.25, 0.70, n)) * (0.95 + 0.20 * r), 0.0, 1.0);   /* ~opaque at the scene switch */
      col = cloud; aOut = a;
    }
    gl_FragColor = vec4(col, aOut);
  }
`;

/* ── outer ground texture (pass 7: async + yield every ~16 ms so no main-
   thread task > 40 ms; total work ≈ 110 ms spread across 3 yields). */
async function buildOuterGroundTexture(rng){
  const SIZE = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  g.fillStyle = '#9f988b';
  g.fillRect(0, 0, SIZE, SIZE);
  const t0 = performance.now();
  const yieldIfBusy = (budgetMs) => {
    if (performance.now() - t0 > budgetMs){
      return new Promise(r => setTimeout(r, 0));
    }
    return null;
  };
  const img = g.getImageData(0, 0, SIZE, SIZE);
  for (let i = 0; i < img.data.length; i += 4){
    const n = (rng() - 0.5) * 14;
    img.data[i]   = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + n));
    img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + n));
  }
  g.putImageData(img, 0, 0);
  /* yield once after the heavy ImageData walk (this is the longest sub-task). */
  let y = yieldIfBusy(16); if (y) await y;
  /* PASS 6: less regular road pattern — diagonal-jittered suburban grid */
  for (let off = 0; off < SIZE; off += 200){
    const jitter = (rng() - 0.5) * 24;
    g.fillStyle = '#8c867a';
    g.fillRect(0, off + jitter, SIZE, 6);
    g.fillRect(off + jitter, 0, 6, SIZE);
  }
  y = yieldIfBusy(32); if (y) await y;
  for (let i = 0; i < 540; i++){
    const x = rng() * SIZE, y2 = rng() * SIZE;
    const r = 40 + rng() * 90;
    const grd = g.createRadialGradient(x, y2, 0, x, y2, r);
    const gr = 90 + Math.floor(rng() * 30);
    const gg = 100 + Math.floor(rng() * 30);
    const gb = 60 + Math.floor(rng() * 20);
    grd.addColorStop(0, `rgba(${gr},${gg},${gb},${0.40 + rng() * 0.30})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y2, r, 0, Math.PI * 2); g.fill();
  }
  y = yieldIfBusy(48); if (y) await y;
  for (let i = 0; i < 240; i++){
    const x = rng() * SIZE, y2 = rng() * SIZE;
    const sz = 12 + rng() * 18;
    g.fillStyle = `rgba(${120 + Math.floor(rng() * 40)},${115 + Math.floor(rng() * 30)},${95 + Math.floor(rng() * 20)},0.55)`;
    g.fillRect(x, y2, sz, sz);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* ── Earth builder ── */
function buildEarth(THREE, opts, renderer){
  const sunDir = new THREE.Vector3(-0.45, -0.30, 0.84).normalize();
  const scene = new THREE.Scene();

  /* v12: pure black sky with crisp point stars (the old equirect canvas magnified into soft squares) */
  scene.background = new THREE.Color(0x000000);
  function buildStarPoints(){
    const N = 2400, pos = new Float32Array(N * 3), sz = new Float32Array(N), br = new Float32Array(N);
    const rng = mulberry32(opts.seed * 9173 + 1);
    for (let i = 0; i < N; i++){
      const u = rng() * 2 - 1, t = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u), b = Math.pow(rng(), 3.4);
      pos[i * 3] = r * Math.cos(t); pos[i * 3 + 1] = u; pos[i * 3 + 2] = r * Math.sin(t);
      sz[i] = 1.1 + b * 1.9; br[i] = 0.16 + b * 0.84;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aB', new THREE.BufferAttribute(br, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uPx: { value: DPR_INITIAL } },
      vertexShader: `attribute float aSize; attribute float aB; uniform float uPx; varying float vB;
        void main(){ vec3 d = (viewMatrix * vec4(position, 0.0)).xyz; vec4 p = projectionMatrix * vec4(d, 1.0); p.z = p.w * 0.99999; gl_Position = p; gl_PointSize = aSize * uPx; vB = aB; }`,
      fragmentShader: `varying float vB; void main(){ float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5)) * vB; if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.90, 0.93, 1.0) * a, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -1;
    return pts;
  }
  const stars = buildStarPoints(); scene.add(stars);

  const landTex = new THREE.TextureLoader().load('assets/land-2048.png');
  landTex.colorSpace = THREE.NoColorSpace;
  landTex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  landTex.wrapS = THREE.RepeatWrapping;
  landTex.wrapT = THREE.ClampToEdgeWrapping;
  landTex.center.set(0, 0.5);
  landTex.repeat.set(1, -1);

  const aniso = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  /* pass 7: 1×1 sRGB placeholder bound to uDay at t=0 so the earth shader
     compiles and renders immediately. The real 4k webp is loaded in the
     background; when it arrives we swap the same uniform (no recompile). */
  function placeholderPixel(r, g, b){
    const data = new Uint8Array([r, g, b, 255]);
    const t = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }
  const dayPlaceholder = placeholderPixel(0x4a, 0x78, 0xa0);   /* ocean blue */
  let dayTex = dayPlaceholder;
  const cloudTex = new THREE.TextureLoader().load('assets/world/earth-clouds-2k.webp');
  cloudTex.colorSpace = THREE.NoColorSpace; cloudTex.anisotropy = aniso; cloudTex.wrapS = THREE.RepeatWrapping;

  /* pass 7: SHARED sphere between earth and clouds — one geometry, one
     vertex buffer upload. The cloud mesh is scaled 1.012 to put it 12 km
     above the surface (matches the previous 1.012× SphereGeometry). */
  const geo = new THREE.SphereGeometry(1, 128, 128);
  const mat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uLand:       { value: landTex },
      uDay:        { value: dayTex },
      uSunDir:     { value: sunDir },
      uForest:     { value: new THREE.Color('#5a6840').convertSRGBToLinear() },
      uSavanna:    { value: new THREE.Color('#7d7a4a').convertSRGBToLinear() },
      uDesert:     { value: new THREE.Color('#a89070').convertSRGBToLinear() },
      uTemperate:  { value: new THREE.Color('#9a8470').convertSRGBToLinear() },
      uPale:       { value: new THREE.Color('#9aa0a8').convertSRGBToLinear() },
      uOceanHi:    { value: new THREE.Color('#133a66').convertSRGBToLinear() },
      uOceanLo:    { value: new THREE.Color('#0a1f3a').convertSRGBToLinear() },
      uNightOcean: { value: new THREE.Color('#040b1c').convertSRGBToLinear() },
      uNightLand:  { value: new THREE.Color('#0d0a05').convertSRGBToLinear() },
      uTime:       { value: 0 },
      uDetail:     { value: 0 },   /* PASS 6 — controlled by altitude; ~1 below 600 km. */
      uRegion:     { value: placeholderPixel(0x4a, 0x78, 0xa0) },
      uRegionBox:  { value: new THREE.Vector4((14 + 180) / 360, (90 - 35.5) / 180, 19 / 360, 13 / 180) },
      uRegionOn:   { value: 0 },
    },
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
  /* pass 8: async day-texture decode OFF the main thread. createImageBitmap
     runs in the image-decoder worker; we get back a bitmap, wrap it in a
     Three.js Texture, and swap the same uniform (no recompile). On
     browsers without createImageBitmap (very old Safari) we fall back to
     the synchronous TextureLoader path. */
  if (typeof createImageBitmap === 'function'){
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      createImageBitmap(img, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
        .then((bmp) => {
          const tex = new THREE.Texture(bmp);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = aniso;
          tex.wrapS = THREE.RepeatWrapping;
          tex.needsUpdate = true;
          mat.uniforms.uDay.value = tex;
          dayTex = tex;
        })
        .catch(() => {
          /* bitmap path failed — leave the placeholder bound; the next
             reload will try again */
        });
    };
    img.onerror = () => {};
    img.src = 'assets/world/earth-day-4k.webp';
  } else {
    new THREE.TextureLoader().load('assets/world/earth-day-4k.webp', (loaded) => {
      if (!loaded) return;
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.anisotropy = aniso;
      loaded.wrapS = THREE.RepeatWrapping;
      mat.uniforms.uDay.value = loaded;
      dayTex = loaded;
    });
  }
  /* lead pass 9: the sharp regional layer only matters on the dive, so fetch it after the first globe frames */
  setTimeout(() => {
    if (typeof createImageBitmap !== 'function') return;
    fetch('assets/world/earth-za-hr.webp').then(r => r.blob()).then(b => createImageBitmap(b, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
      .then(bmp => { const t = new THREE.Texture(bmp); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.flipY = false; t.needsUpdate = true;
        mat.uniforms.uRegion.value = t; mat.uniforms.uRegionOn.value = 1; }).catch(() => {});
  }, 1500);
  const earth = new THREE.Mesh(geo, mat);
  /* PASS 8: no Euler tilt — spin axis is world +Y, north stays up at every
     altitude. The eastward spin over p 0..0.06 is applied in _frame()
     via earth.rotation.y (rotation.order = 'YXZ' so a Y-only rotation
     remains a pure spin around the world axis, no X drift). */
  earth.rotation.order = 'YXZ';
  earth.rotation.x = 0;
  earth.rotation.y = 0;
  earth.renderOrder = 0;
  scene.add(earth);

  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: {
      uTime:   { value: 0 },
      uSunDir: { value: sunDir },
      uShadow: { value: 0.6 },   /* PASS 6 — light self-shadow */
      uCloudTex: { value: cloudTex },
      uFade:     { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  /* pass 7: SHARE the earth geometry with the cloud mesh — one vertex
     buffer upload, one dispose(). Cloud is scaled out 1.012× so it sits
     12 km above the surface (was a separate SphereGeometry(1.012, 96, 96)).
     PASS 8: no Euler tilt — clouds share the Earth's no-rotation state
     so they spin together in _frame() (the same earth.rotation.y
     assignment moves both because both meshes use the same rotation). */
  const clouds = new THREE.Mesh(geo, cloudMat);
  clouds.scale.setScalar(1.012);
  clouds.rotation.order = 'YXZ';
  clouds.rotation.x = 0;
  clouds.rotation.y = 0;
  clouds.renderOrder = 1;
  scene.add(clouds);

  /* v12: atmosphere — a thin additive halo just outside the limb (also softens the silhouette); fades out on the descent */
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: sunDir }, uFade: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSunDir; uniform float uFade; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float k = clamp(-dot(N, V) / 0.26, 0.0, 1.0);                 /* 0 at the halo's outer edge, 1 at the Earth's limb */
        float lit = smoothstep(-0.35, 0.45, dot(N, normalize(uSunDir)));
        float i = pow(k, 1.7) * (0.25 + 0.75 * lit) * uFade;
        gl_FragColor = vec4(vec3(0.30, 0.55, 1.0) * i * 0.85, 1.0);
      }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const atmo = new THREE.Mesh(geo, atmoMat); atmo.scale.setScalar(1.035); atmo.renderOrder = 2; scene.add(atmo);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, GLOBE_FAR_KM / KM * 1.5);

  function setSunDir(v){ sunDir.copy(v).normalize(); }
  function setDetail(v){ mat.uniforms.uDetail.value = clamp(v, 0, 1); }
  function setCloudFade(v){ cloudMat.uniforms.uFade.value = clamp(v, 0, 1); }
  function setAtmo(v){ atmoMat.uniforms.uFade.value = clamp(v, 0, 1); atmo.visible = v > 0.003; }
  function update(t){ mat.uniforms.uTime.value = t; cloudMat.uniforms.uTime.value = t; }
  function dispose(){
    geo.dispose(); mat.dispose();
    cloudMat.dispose(); atmoMat.dispose(); stars.geometry.dispose(); stars.material.dispose();
    landTex.dispose(); dayTex.dispose(); cloudTex.dispose();
    if (dayPlaceholder && dayPlaceholder !== dayTex) dayPlaceholder.dispose();
    if (scene.background && scene.background.dispose) scene.background.dispose();
  }

  return { scene, camera, sunDir, setSunDir, setDetail, setCloudFade, setAtmo, update, dispose };
}

/* ── placeholder city ──
   PASS 8: FOCUS dimensions match the new farm spec — 180 m (x) × 64 m (z)
   hall, eaves 9 m, ridge 12.4 m — so the camera stations already work. */
function placeholderCity(THREE, opts){
  const group = new THREE.Group();
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xA8977A, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const focusMat = new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.55, metalness: 0.05 });
  const focusHall = new THREE.Mesh(new THREE.BoxGeometry(180, 9, 64), focusMat);
  focusHall.position.set(0, 4.5, 0);
  focusHall.castShadow = true;
  focusHall.receiveShadow = true;
  group.add(focusHall);
  /* ridge: simple wedge. Box rotated 0, but with a peaked profile */
  const ridgeMat = new THREE.MeshStandardMaterial({ color: 0xEEE9E3, roughness: 0.55 });
  const ridgeGeo = new THREE.CylinderGeometry(0.01, 0.01, 180, 12);
  ridgeGeo.rotateZ(Math.PI/2);
  const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
  ridge.position.set(0, 9, 0);
  ridge.castShadow = true;
  group.add(ridge);
  const focus = { id: 'F', name: 'FOCUS Packhouse & cold store', x: 0, z: 0, w: 180, d: 64, h: 12.4, kind: 'ci', roof: 'gable', score: 0.96, kwp: 600, paybackYears: 3.8 };
  const buildings = [focus];
  const ranked = [focus,
    { id: 2, name: 'Wine cellar & barrel hall', x: -820, z: -420, w: 70, d: 36, h: 8, kind: 'ci', score: 0.82, kwp: 380, paybackYears: 4.4 },
    { id: 3, name: 'Fruit packshed', x: 640, z: 380, w: 90, d: 40, h: 9, kind: 'ci', score: 0.78, kwp: 510, paybackYears: 4.6 },
    { id: 4, name: 'Co-op cold store', x: 1150, z: -260, w: 80, d: 50, h: 8, kind: 'ci', score: 0.74, kwp: 460, paybackYears: 4.8 },
  { id: 5, name: 'Implement shed', x: -380, z: 520, w: 60, d: 24, h: 7, kind: 'ci', score: 0.69, kwp: 220, paybackYears: 5.1 },
    { id: 6, name: 'Dairy barn', x: -1180, z: 280, w: 72, d: 22, h: 7, kind: 'ci', score: 0.64, kwp: 240, paybackYears: 5.3 },
    { id: 7, name: 'Bottling hall', x: -740, z: -480, w: 44, d: 26, h: 8, kind: 'ci', score: 0.59, kwp: 175, paybackYears: 5.6 },
    { id: 8, name: 'Workshop & stores', x: 260, z: -620, w: 40, d: 20, h: 6, kind: 'ci', score: 0.55, kwp: 130, paybackYears: 5.8 },
    { id: 9, name: 'Barn & stables', x: 900, z: 760, w: 48, d: 18, h: 6, kind: 'ci', score: 0.51, kwp: 145, paybackYears: 6.1 },
    { id: 10, name: 'Farm stall & tasting room', x: -200, z: 900, w: 30, d: 16, h: 5, kind: 'ci', score: 0.46, kwp: 80, paybackYears: 6.4 },
  ];
  const territory = [[-1500, -1100], [-200, -1300], [800, -900], [1500, 200], [1100, 1100], [-100, 1300], [-1200, 900]];
  const sunTarget = new THREE.Vector3(0, 6, 0);
  function setLayers(){}
  function update(){}
  function dispose(){ group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  return { group, buildings, ranked, focus, territory, sunTarget, setLayers, update, dispose };
}

/* ── main world ── */
class HAWorld {
  constructor(el, opts){
    this.el = el;
    this.opts = opts || {};
    this.cssW = 0; this.cssH = 0;
    this.W = 0; this.H = 0;
    this.dpr = this.opts.lowQuality ? 1.0 : DPR_INITIAL;
    this._dprStep = 0;
    this._dprWindow = [];   /* median frame times during the post-cityReady sample window */
    this._frameTimes = [];
    this._dprSampled = true;   /* lead: no runtime DPR stepping (resize froze ~3 s) */
    /* pass 7: load-pipeline timings (performance.now() relative to navigationStart).
       Exposed as world.timings so pages / tests can read them. */
    this.timings = {
      globeFirstFrame: 0,
      cityBuilt:       0,
      programsCompiled: 0,
      warmDone:        0,
      cityReady:       0,
    };

    /* progress + layer easing */
    this._pTarget = 0;
    this._pSmoothed = 0;
    this.layers = defaultLayers();
    this._layerSmoothed = { ...defaultLayers() };
    this._layerOverrides = {};
    /* camera eased position + target (PASS 6: spring on these too — a direction
       change never snaps). Pre-built scratch vectors. */
    this._camPos = new THREE.Vector3();
    this._camTgt = new THREE.Vector3();
    this._camFov = 50;

    const t = buildDefaultStations();
    this.stations = t.stations;
    this._globeTrack = t.globeTrack;
    this._cityTrack = t.cityTrack;
    this._altTrack = t.altTrack;
    this._globePosTrack = t.globeTrack.map(s => ({ p: s.p, v: new THREE.Vector3(...s.pos) }));
    this._globeTgtTrack = t.globeTrack.map(s => ({ p: s.p, v: new THREE.Vector3(...s.target) }));
    this._cityPosTrack  = t.cityTrack.map(s => ({ p: s.p, v: new THREE.Vector3(...s.pos) }));
    this._cityTgtTrack  = t.cityTrack.map(s => ({ p: s.p, v: new THREE.Vector3(...s.target) }));
    this._scratchGPos = new THREE.Vector3();
    this._scratchGTgt = new THREE.Vector3();
    this._scratchCPos = new THREE.Vector3();
    this._scratchCTgt = new THREE.Vector3();
    /* smoothed camera (target station track). */
    this._camPosSmoothed = new THREE.Vector3();
    this._camTgtSmoothed = new THREE.Vector3();
    this._camFovSmoothed  = 50;

    this._recomputeStationLayers(0);
    for (const k of Object.keys(this._layerSmoothed)){
      this._layerSmoothed[k] = (this.layers[k] != null) ? this.layers[k] : 0;
    }

    /* canvas + size observation */
    this.cv = document.createElement('canvas');
    this.cv.setAttribute('aria-hidden', 'true');
    el.appendChild(this.cv);

    /* PASS 6 REPAIR — poster is an <img> element (object-fit:cover, same
       framing as the globe at p=0) so the page-supplied world-earth.webp
       actually paints. The radial gradient is the FALLBACK used only when
       no poster URL is given — today the page passes one and the previous
       div+background-image implementation was rendering the gradient on
       top of the broken background. */
    const posterURL = (typeof opts.poster === 'string' && opts.poster) ? opts.poster : '';
    if (posterURL){
      this._poster = document.createElement('img');
      this._poster.src = posterURL;
      this._poster.alt = '';
      this._poster.setAttribute('aria-hidden', 'true');
      this._poster.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;pointer-events:none;z-index:0;';
    } else {
      this._poster = document.createElement('div');
      this._poster.style.cssText = 'position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 38%, #0d1117 0%, #050608 60%, #030405 100%);pointer-events:none;z-index:0;';
    }
    el.appendChild(this._poster);
    this.cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;opacity:0;transition:opacity .5s ease;';

    this._frame = this._frame.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onVis = () => { this._visible = !document.hidden && this._visible; this._markDirty(); };

    this._visible = true;
    this._io = new IntersectionObserver(es => {
      this._visible = es[0].isIntersecting;
      this._markDirty();
    }, { rootMargin: '200px' });
    this._io.observe(el);

    this._ro = new ResizeObserver(() => this._onResize());
    this._ro.observe(el);

    this._frameFns = [];
    this._t = 0;
    this._last = 0;
    this._raf = 0;
    this._ready = false;
    this._cityReady = false;
    this._firstFrame = false;
    /* PASS 6 — render-on-demand dirty flag. The loop is paused unless dirty. */
    this._dirty = true;
    this._rafScheduled = false;

    /* PASS 6 — shadow re-fit is event-driven: re-fit only when the focus moved
       > 20 % of the frustum width (snap to whole shadow texels). */
    this._lastShadowSpan = 0;
    this._lastShadowTargetKey = '';
    /* Reset the shadow camera position to whole texels (stable edges). */
    this._shadowTexel = 1;

    this._init();
  }

  async _init(){
    /* 1. renderer — antialias on the canvas; render targets use MSAA only when
       we're inside the cross-fade band and DPR ≤ 1.25 (lazy allocation). */
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.cv,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: false,   /* gl_FragDepth writes killed early-z: per-frame clip planes instead */
    });
    this.renderer.debug.checkShaderErrors = /[?&]glcheck/.test(location.search);   /* lead: sync getProgramInfoLog on first use blocked ~3 s on ANGLE */
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;   /* PASS 6 REPAIR: per brief — exposure 1.0 (was 0.95) */
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;   /* lead: PCFSoft unrolls into far larger D3D shaders (compile + per-pixel cost on the iGPU) */
    this.renderer.setClearColor(0x050403, 1);

    /* 2. Earth + city scenes — globe first */
    this.earth = buildEarth(THREE, { seed: this.opts.seed || 7 }, this.renderer);
    { const tg = this._globeTgtTrack[this._globeTgtTrack.length - 1].v.clone().normalize();
      const west = new THREE.Vector3(0, 1, 0).cross(tg).normalize();
      this.earth.setSunDir(tg.clone().multiplyScalar(0.8).addScaledVector(west, -0.55).add(new THREE.Vector3(0, 0.15, 0)));
    }
    this.globeScene = this.earth.scene;
    this.globeCamera = this.earth.camera;

    this.cityScene = new THREE.Scene();
    this.cityScene.background = null;
    this.cityCamera = new THREE.PerspectiveCamera(50, 1, 0.5, 600000);
    this.cityCamera.position.set(1100, 1900, -1100);
    this.cityCamera.lookAt(0, 0, 0);

    /* 3. lazy RTs — only allocated when the cross-fade band is active (city + globe
       both visible). Disposed 3 s after leaving the band. */
    this.globeRT = null;
    this.cityRT = null;
    this._rtNeedsDispose = false;
    this._rtSinceLeftBand = 0;

    /* 4. composite scene — fullscreen quad */
    this.compositeScene = new THREE.Scene();
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: COMP_VERT,
      fragmentShader: COMP_FRAG,
      uniforms: {
        uGlobe: { value: null },
        uCity:  { value: null },
        uMix:   { value: 0 },
        uVeil:  { value: 0 },
        uZoom:  { value: 0 },
        uAspect:{ value: 1.6 },
      },
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMaterial);
    quad.frustumCulled = false;
    this.compositeScene.add(quad);

    /* 5. globe is the priority — pre-compile all its materials, precompile the
       composite, then start the rAF loop. City builds asynchronously.
       PASS 7: _onResize is called FIRST so cssW/cssH are valid before
       _precompileScene's _ensureRTs allocates the offscreen RTs (the warm
       render goes into the RT). This keeps the allocation count to 1 at the
       correct size — no 2×2 placeholder + later resize. */
    this._onResize();
    try {
      await this._precompileScene(this.globeScene, this.globeCamera);
      await this._precompileMaterial(this.compositeMaterial);
    } catch (e){
      console.warn('[HAWorld] globe precompile failed', e);
    }

    /* 6. seed the public layers from p=0 (so the first frame is already at target) */
    this._recomputeStationLayers(0);

    /* 7. start loop */
    /* own scroll listener only when autoScroll is true; otherwise the page
       drives setProgress(). Per brief: "Remove world.js's own window scroll
       listener unless opts.autoScroll is true." */
    if (this.opts.autoScroll){
      window.addEventListener('scroll', this._onScroll = () => this._markDirty(), { passive: true });
    }
    document.addEventListener('visibilitychange', this._onVis);
    window.addEventListener('resize', this._onResize);

    /* shadow autoUpdate off — city + sun are static. Refresh on demand only. */
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;

    this._ready = true;
    this._scheduleFrame();
    if (typeof this.opts.onReady === 'function') this.opts.onReady(this);
    if (this._resolveReady) this._resolveReady(this);

    /* 8. PASS 7: build the city in the background — requestIdleCallback with
       a 100 ms timeout (fallback setTimeout 50). The first globe frame paints
       before any city CPU is spent; the city build itself runs only while the
       main thread is idle, so no task > 150 ms can land during the descent. */
    this._scheduleCityBuild();
  }

  _scheduleCityBuild(){
    if (this._cityScheduled) return;
    this._cityScheduled = true;
    if (typeof requestIdleCallback === 'function'){
      requestIdleCallback(() => { this._buildCityBackground(); }, { timeout: 100 });
    } else {
      setTimeout(() => { this._buildCityBackground(); }, 50);
    }
  }

  async _buildCityBackground(){
    let buildCity = null, buildCityAsync = null;
    try {
      const mod = await import('./world-farm.js');
      buildCity = mod.buildCity;
      buildCityAsync = mod.buildCityAsync || null;
    } catch (e){
      console.error('[HAWorld] world-city.js import failed', e);
    }
    if (!buildCity){
      this.city = placeholderCity(THREE, { seed: 7, renderer: this.renderer, quality: 'high' });
      this.cityScene.add(this.city.group);
      this._cityReady = true;
      this.timings.cityReady = performance.now();
      this._resolveCityReady && this._resolveCityReady(this);
      this._markDirty();
      return;
    }

    /* city env (sky + fog + hemisphere + sun + outer ground — NO PMREM in pass 7) */
    await this._buildCityEnv();

    try {
      let city;
      if (typeof buildCityAsync === 'function'){
        city = await buildCityAsync(THREE, {
          seed: this.opts.seed || 7,
          pv: this.opts.pv || null,   /* v12: module + fill order for the example design (from the engine run) */
          renderer: this.renderer,
          quality: this.opts.lowQuality ? 'low' : 'high',
        });
      } else {
        city = buildCity(THREE, {
          seed: this.opts.seed || 7,
          renderer: this.renderer,
          quality: this.opts.lowQuality ? 'low' : 'high',
        });
        /* yield once after the sync build so we don't block the main thread past
           one frame, and so texture upload can flush to the GPU. */
        await yieldOnce();
      }
      this.city = city;
      if (city && city.group) this.cityScene.add(city.group);
    } catch (e){
      console.error('[HAWorld] buildCity failed', e);
      this.city = placeholderCity(THREE, { seed: 7, renderer: this.renderer, quality: 'high' });
      this.cityScene.add(this.city.group);
    }

    /* pass 7: record when the city geometry / materials are in place. */
    this.timings.cityBuilt = performance.now();

    /* PASS 6: pre-compile every city program + every texture before declaring
       the city ready. This kills the lazy shader-compile freezes that were
       hitting mid-scroll in the original probe. */
    try {
      await this._precompileScene(this.cityScene, this.cityCamera);
    } catch (e){
      console.warn('[HAWorld] city precompile failed', e);
    }
    /* pass 7: record when every city program is compiled + every texture
       uploaded to the GPU. */
    this.timings.programsCompiled = performance.now();

    /* warm-up tour: the AMD/D3D11 driver finishes its own shader work on the first REAL full-size draw at each
       camera/state (a 1 px scissor is not enough: 1.2 s GPU stalls at p~0.6-0.85). Render the city from 12 points
       along the camera track into the offscreen RT, one per rAF (≤ 200 ms total), with every layer on, while the
       visitor still looks at the globe. Restores the live camera afterwards. */
    try { await this._warmTour(); } catch (e){ console.warn('[HAWorld] warm tour failed', e); }
    /* pass 7: record when the warm tour finished. */
    this.timings.warmDone = performance.now();

    this._cityReady = true;
    /* pass 7: cityReady is the moment the user can interact with the city
       scene (build complete + programs compiled + warm tour done). */
    this.timings.cityReady = performance.now();
    this._dprWindowStartT = performance.now();
    this._resolveCityReady && this._resolveCityReady(this);
    this._markDirty();
  }

  async _buildCityEnv(){
    /* PASS 7: PMREM / RoomEnvironment path DELETED. Previously this block
       created a new PMREMGenerator + RoomEnvironment (a 60-mesh scene with
       6 coloured emissive boxes) and uploaded the resulting 256² RGBA16F
       cube as scene.environment. That cost ~320 ms of main-thread time
       and produced 4 extra shader programs (the env cubemap has its own
       roughness / irradiance variants per material) that nothing in the
       city scene uses — the panels are MeshPhong / MeshLambert (no env
       sampling) and the city is already lit by the warm directional sun
       + 2.3-intensity hemisphere. scene.environment is left unset. */
    try {
      /* sky-dome — PASS 8: Western Cape late-afternoon gradient per the brief.
         Zenith #8FB3D9 (cool light blue) → horizon #E9DCC6 (warm haze).
         Canvas is 2×256 — only the vertical gradient matters; the equirect
         wrap takes care of the horizontal direction. */
      const skyCanvas = document.createElement('canvas');
      skyCanvas.width = 2; skyCanvas.height = 256;
      const sctx = skyCanvas.getContext('2d');
      const grd = sctx.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0.00, '#5F93D0');   /* zenith — clear Cape blue (v11) */
      grd.addColorStop(0.40, '#9DC0E4');   /* upper sky */
      grd.addColorStop(0.56, '#CFDDE8');   /* horizon — cool haze, not brown */
      grd.addColorStop(0.62, '#CBD8E2');
      grd.addColorStop(1.00, '#CBD8E2');   /* ground wash — matches the fog */
      sctx.fillStyle = grd;
      sctx.fillRect(0, 0, 2, 256);
      const skyTex = new THREE.CanvasTexture(skyCanvas);
      skyTex.mapping = THREE.EquirectangularReflectionMapping;
      skyTex.colorSpace = THREE.SRGBColorSpace;
      skyTex.minFilter = THREE.LinearFilter;
      skyTex.magFilter = THREE.LinearFilter;
      skyTex.needsUpdate = true;
      this.cityScene.background = skyTex;
      this._skyTex = skyTex;

      /* PASS 8 — fog colour #C9D3DC (cool light haze, NOT brown/black) so
         the far ring of mountains dissolves into atmosphere and the near
         valley stays crisp. _frame() scales fog with the camera height. */
      this.cityScene.fog = new THREE.Fog(0xC9D6E1, 1500, 9000);   /* v11: cool blue haze */

      /* PASS 8 — hemisphere: sky #CFE0F2, ground #A8977A, intensity 2.3.
         The HemisphereLight carries the shade-side fill that PMREM used
         to give us; without it, Lambert surfaces in the shade go too dark. */
      const hemi = new THREE.HemisphereLight(0xD3E4F5, 0x6A7650, 1.6);   /* v11: green ground bounce */
      this.cityScene.add(hemi);
      this._hemi = hemi;

      /* PASS 8 — sun: warm #FFD7A3 from the north-west at ~28° elevation
         (it lights the north roof plane of the FOCUS packhouse, which
         carries the PV). Shadow camera is ±260 m around the focus (pass
         8 tightened from ±600 to ±260 to keep texel size ≈ 0.25 m so the
         static shadow map stays sharp on the focus group). */
      const el = 28 * Math.PI / 180;
      const az = Math.PI / 4;          /* 45° west of north */
      const nx = -Math.sin(az) * Math.cos(el);
      const ny =  Math.sin(el);
      const nz = -Math.cos(az) * Math.cos(el);
      const sun = new THREE.DirectionalLight(0xFFE7C8, 3.3);   /* v11: clean afternoon light, less orange */
      sun.position.set(nx * 1500, ny * 1500, nz * 1500);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 4000;
      sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
      sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
      this._sun = sun;
      this._sunOffset = [nx * 1500, ny * 1500, nz * 1500];
      this.cityScene.add(sun);
      this._shadow = sun.shadow;
      /* pass 8: texel size for snapping (stable shadow edges) at the tight
         ±260 m frustum: 520 / 2048 = 0.254 m/texel. */
      this._shadowTexel = 520 / 2048;
    } catch (e){
      console.warn('[HAWorld] env build failed', e);
    }
    await yieldOnce();
    /* pass 8 (lead): no engine ground plane; the farm scene brings its own 40 km terrain. */
    await yieldOnce();
  }

  /* ── precompile helpers ──
     We force every layer on, then call renderer.compileAsync(scene, camera) so
     every program links up-front (the original probe measured 2955 ms in
     onFirstUse mid-scroll). After that we renderer.initTexture(t) for every
     texture so the GPU has them resident. Then we restore the original layers
     so the scene goes back to its target appearance. */
  async _precompileScene(scene, camera){
    if (!this.renderer || typeof this.renderer.compileAsync !== 'function') return;
    /* force layers on — store the originals so we can restore. */
    const saved = this._layerOverrides ? { ...this._layerOverrides } : {};
    /* set every override to 1 so city-side materials compile even when the page
       hasn't set them. The world.js "station layers at p=0" snapshot will
       override these on the first frame. */
    const allLayers = ['solar', 'territory', 'territoryDraw', 'rank', 'focus', 'panels', 'night', 'globe', 'city'];
    if (this.city && typeof this.city.setLayers === 'function'){
      const ls = {}; for (const k of allLayers) ls[k] = 1;
      this.city.setLayers(ls);
      if (typeof this.city.update === 'function') this.city.update(0, 0.016);   /* setLayers only stores; update applies */
    }
    try {
      await this.renderer.compileAsync(scene, camera);
    } catch (e){
      console.warn('[HAWorld] compileAsync failed', e);
    }
    /* warm render: three keys programs on the output target (screen = tone-mapped sRGB, RT = linear) and builds
       shadow-depth programs only when the shadow pass runs, so compileAsync alone left ~21 programs to link mid-scroll.
       Render once to a 4x4 RT and once to the screen clipped to a 1 px scissor, culling off, shadows on. */
    try {
      const r = this.renderer, culled = [];
      scene.traverse(o => { if (o.frustumCulled){ culled.push(o); o.frustumCulled = false; } });
      const prevAuto = r.shadowMap.autoUpdate; r.shadowMap.needsUpdate = true;
      r.setRenderTarget(null); r.setScissorTest(true); r.setScissor(0, 0, 1, 1); r.render(scene, camera); r.setScissorTest(false);
      r.shadowMap.autoUpdate = prevAuto; r.shadowMap.needsUpdate = true;
      for (const o of culled) o.frustumCulled = true;
    } catch (e){ console.warn('[HAWorld] warm render failed', e); }
    /* restore — only happens if the city builder was ready */
    if (this.city && typeof this.city.setLayers === 'function'){
      const ls = {}; for (const k of allLayers) ls[k] = 0;
      this.city.setLayers(ls);
      if (typeof this.city.update === 'function') this.city.update(0, 0.016);
    }
    /* init every texture in the scene (upload to GPU once). */
    const seen = new Set();
    scene.traverse(o => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats){
        if (!m) continue;
        for (const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap']){
          const t = m[k];
          if (t && t.isTexture && !seen.has(t)){
            seen.add(t);
            try { this.renderer.initTexture(t); } catch (e){}
          }
        }
      }
    });
    /* env map */
    if (scene.environment && scene.environment.isTexture && !seen.has(scene.environment)){
      try { this.renderer.initTexture(scene.environment); } catch (e){}
      seen.add(scene.environment);
    }
    /* background (sky) */
    if (scene.background && scene.background.isTexture && !seen.has(scene.background)){
      try { this.renderer.initTexture(scene.background); } catch (e){}
      seen.add(scene.background);
    }
    await yieldOnce();
  }

  async _precompileMaterial(material){
    if (!this.renderer || typeof this.renderer.compileAsync !== 'function') return;
    /* build a throwaway scene with just this material so it has its own program. */
    const tmpScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    tmpScene.add(quad);
    const tmpCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    try { await this.renderer.compileAsync(tmpScene, tmpCam); } catch (e){}
    quad.geometry.dispose();
    await yieldOnce();
  }

  _onResize(){
    const r = this.el.getBoundingClientRect();
    this.cssW = Math.max(2, r.width);
    this.cssH = Math.max(2, r.height);
    /* PASS 6 — DPR adaptation: resize → mark dirty (frame loop applies). */
    this._markDirty();
  }

  setViewShift(f){ this._viewShift = +f || 0; if (this._markDirty) this._markDirty(); else this._dirty = true; }
  /* v12: shift the valley scene right between progress p0 and p1 (page copy on the left, the building on the right) */
  setSubjectShift(f, p0, p1){ this._subShift = +f || 0; this._subP0 = p0 == null ? 0.62 : p0; this._subP1 = p1 == null ? 0.70 : p1; if (this._markDirty) this._markDirty(); else this._dirty = true; }

  setProgress(p){
    if (typeof p !== 'number' || !Number.isFinite(p)) return;
    if (Math.abs(p - (this._pTarget || 0)) > 1e-5) this._lastProgressT = performance.now();
    const clamped = clamp(p, 0, 1);
    this._pTarget = clamped;
    if (!this._ready) this._pSmoothed = clamped;
    this._markDirty();
  }

  setLayer(name, value){
    if (value == null) delete this._layerOverrides[name];
    else this._layerOverrides[name] = value;
    if (!this._ready && value != null && this._layerSmoothed){
      this._layerSmoothed[name] = value;
    }
    this._markDirty();
  }

  onFrame(fn){
    this._frameFns.push(fn);
    return () => {
      const i = this._frameFns.indexOf(fn);
      if (i >= 0) this._frameFns.splice(i, 1);
    };
  }

  /* PASS 6: project accepts [x,y,z] arrays (kept) OR THREE.Vector3 (kept); now
     we expose world.onFrame(fn(t,dt,state)) so HUD pins can call project()
     AFTER the camera update so the pin never swims against the scene. */
  project(vec3){
    if (!this.cityCamera) return null;
    let v;
    if (vec3 && vec3.isVector3){ v = vec3.clone(); }
    else if (Array.isArray(vec3)){ v = new THREE.Vector3(vec3[0], vec3[1], vec3[2]); }
    else { v = new THREE.Vector3(vec3.x, vec3.y, vec3.z); }
    v.project(this.cityCamera);
    if (v.z < -1 || v.z > 1) return null;
    const x = (v.x * 0.5 + 0.5) * this.cssW;
    const y = (-v.y * 0.5 + 0.5) * this.cssH;
    const onScreen = v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1;
    return [x, y, onScreen];
  }

  _recomputeStationLayers(p){
    const station = sampleLayerTrack(this.stations, p);
    for (const k in station){
      this.layers[k] = (this._layerOverrides[k] != null) ? this._layerOverrides[k] : station[k];
    }
    for (const k in this._layerOverrides){
      if (this.layers[k] === undefined || !(k in station)) this.layers[k] = this._layerOverrides[k];
    }
  }

  async _warmTour(){
    const r = this.renderer;
    const ls = {}; for (const k of ['solar', 'territory', 'territoryDraw', 'rank', 'focus', 'panels', 'night']) ls[k] = 1;
    const keep = this._pSmoothed, cam = this.cityCamera, saved = cam.position.clone(), savedQ = cam.quaternion.clone();
    /* PASS 7: 12 stations (not 24), one warm render per rAF, capped at 5 s.
       Each iteration does exactly ONE r.render(cityScene, cam) into the
       offscreen RT (the AMD/D3D11 driver finishes its own shader work on
       the first real full-size draw at each camera/state; a 1 px scissor
       is not enough). The previous version did 3 renders per frame
       (RT + canvas city + canvas globe) which doubled the per-rAF time
       and broke the 150 ms main-thread budget. */
    const N = 8, t0 = performance.now();
    for (let i = 0; i < N; i++){
      /* lead: never compete with the visitor - wait while they are scrolling (cap 8 s total) */
      while (performance.now() - (this._lastProgressT || 0) < 250 && performance.now() - t0 < 8000) await new Promise(res => requestAnimationFrame(() => res()));
      if (performance.now() - t0 > 9000) break;               /* never hold cityReady longer than ~5 s */
      this._pSmoothed = 0.15 + 0.85 * i / (N - 1);
      const c = this._sampleCamera();
      cam.position.copy(c.cPos); cam.lookAt(c.cTgt); cam.fov = c.cFov;
      { const y = Math.max(1, c.cPos.y); cam.near = Math.min(500, Math.max(0.5, y * 0.03)); cam.far = Math.max(24000, y * 3); }
      cam.updateProjectionMatrix();
      if (this.city){ this.city.setLayers(ls); if (this.city.update) this.city.update(0, 0.016); }
      if (i === 0) r.shadowMap.needsUpdate = true;
      /* lead: the live city draws to the CANVAS, so warm there (full size: the driver finishes per real draw), then put
         the globe back in the same task so the presented frame never shows the warm-up */
      r.setRenderTarget(null); r.clear(true, true, false); r.render(this.cityScene, cam);
      r.clear(true, true, false); r.render(this.globeScene, this.globeCamera);
      await new Promise(res => requestAnimationFrame(() => res()));
    }
    this._pSmoothed = keep; cam.position.copy(saved); cam.quaternion.copy(savedQ); cam.updateProjectionMatrix();
    /* lead: restore the CURRENT eased layers (zeroing them left the scene layer-less until the next scroll) and wake the loop */
    if (this.city){ const l = this._layerSmoothed, z = {}; for (const k in ls) z[k] = l[k] || 0; this.city.setLayers(z); if (this.city.update) this.city.update(this._t, 0.016); }
    r.shadowMap.needsUpdate = true;
    if (this._markDirty) this._markDirty();
  }

  _sampleCamera(){
    const p = this._pSmoothed;
    const g = sampleTrack(this._globeTrack, p);
    const c = sampleTrack(this._cityTrack, p);
    sampleVec3(this._globePosTrack, p, this._scratchGPos);
    sampleVec3(this._globeTgtTrack, p, this._scratchGTgt);
    sampleVec3(this._cityPosTrack,  p, this._scratchCPos);
    sampleVec3(this._cityTgtTrack,  p, this._scratchCTgt);
    const alt = sampleTrack(this._altTrack, p);
    return {
      gPos: this._scratchGPos, gTgt: this._scratchGTgt, gFov: g.fov,
      cPos: this._scratchCPos, cTgt: this._scratchCTgt, cFov: c.fov,
      altKm: alt.altKm,
    };
  }

  debugCam(pos, tgt, fov){
    this._debugCam = pos ? { pos: new THREE.Vector3(...pos), tgt: new THREE.Vector3(...(tgt || [0, 0, 0])), fov } : { pos: null };
    if (this._markDirty) this._markDirty(); else this._dirty = true;
  }

  _applyCameraToCameras(s){
    this.globeCamera.position.copy(s.gPos);
    this.globeCamera.lookAt(s.gTgt);
    this.globeCamera.fov = s.gFov;
    { const d = s.gPos.length(), alt = Math.max(1e-6, d - 1);   /* Earth radius = 1 unit */
      this.globeCamera.near = Math.max(1e-6, alt * 0.4); this.globeCamera.far = d + 1.6; }
    /* v11: optional horizontal view shift for the opening frames (page copy on the left, Earth on the right);
       it eases out over the first 5 % of the descent so the dive stays centred. */
    { const k = (this._viewShift || 0) * (1 - clamp(this._pSmoothed / 0.05, 0, 1));
      if (Math.abs(k) > 1e-4 && this.W > 2) this.globeCamera.setViewOffset(this.W, this.H, -k * this.W, 0, this.W, this.H);
      else if (this.globeCamera.view && this.globeCamera.view.enabled) this.globeCamera.clearViewOffset(); }
    this.globeCamera.updateProjectionMatrix();
    /* debug camera (lead, pass 8): world.debugCam([x,y,z],[tx,ty,tz],fov) or ?cam=x,y,z&tgt=x,y,z&fov=n
       overrides the scene camera so a reviewer can frame any view; world.debugCam(null) releases it. */
    const dc = this._debugCam || (this._debugCam = parseDebugCam());
    if (dc && dc.pos){ s = { ...s, cPos: dc.pos, cTgt: dc.tgt, cFov: dc.fov || s.cFov }; }
    this.cityCamera.position.copy(s.cPos);
    this.cityCamera.lookAt(s.cTgt);
    this.cityCamera.fov = s.cFov;
    { const a = this._subP0 || 0.62, b = this._subP1 || 0.70, t = clamp((this._pSmoothed - a) / (b - a), 0, 1), k = (this._subShift || 0) * t * t * (3 - 2 * t);
      if (Math.abs(k) > 1e-4 && this.W > 2) this.cityCamera.setViewOffset(this.W, this.H, -k * this.W, 0, this.W, this.H);
      else if (this.cityCamera.view && this.cityCamera.view.enabled) this.cityCamera.clearViewOffset(); }
    { const y = Math.max(1, s.cPos.y);
      this.cityCamera.near = Math.min(500, Math.max(0.5, y * 0.03)); this.cityCamera.far = Math.max(24000, y * 3); }
    this.cityCamera.updateProjectionMatrix();
  }

  /* PASS 6: render-on-demand. We mark dirty whenever something that could
     change the frame changes, and the rAF loop schedules itself as long as
     we're dirty OR an animation is active. */
  _markDirty(){ this._dirty = true; this._scheduleFrame(); }

  _scheduleFrame(){
    if (this._rafScheduled) return;
    if (!this._ready) return;
    if (!this._visible) return;
    if (document.hidden) return;
    this._rafScheduled = true;
    this._raf = requestAnimationFrame(this._frame);
  }

  _frame(now){
    this._rafScheduled = false;
    if (!this._ready || !this._visible || document.hidden){
      this._dirty = false;
      return;
    }
    let dt = (now - this._last) / 1000 || 0.016;
    if (this._last === 0) dt = 0.016;
    dt = clamp(dt, 0, MAX_DT_S);
    this._last = now;
    this._t += dt;

    /* progress spring (PASS 6: 0.12 s half-life, slightly tighter than 5d's 0.15) */
    const pPrev = this._pSmoothed;
    this._pSmoothed = smoothToward(this._pSmoothed, this._pTarget, dt, PROGRESS_HALFLIFE_S);
    const pDelta = Math.abs(this._pSmoothed - pPrev);

    /* station layers at the smoothed p, merged with overrides, eased. */
    this._recomputeStationLayers(this._pSmoothed);
    for (const k of Object.keys(this._layerSmoothed)){
      const target = (this.layers[k] != null) ? this.layers[k] : 0;
      const prev = this._layerSmoothed[k];
      this._layerSmoothed[k] = smoothToward(prev, target, dt, 0.15);
    }

    /* sample the camera rig */
    const cam = this._sampleCamera();
    /* PASS 6 — spring on camera pos + target + fov (critically damped). A
       direction change never snaps; the eased target is what world.onFrame
       subscribers should read for HUD pin coordinates. */
    const camPosPrev = this._camPosSmoothed.clone();
    const camTgtPrev = this._camTgtSmoothed.clone();
    this._camPosSmoothed.x = smoothToward(this._camPosSmoothed.x, cam.cPos.x, dt, CAMERA_HALFLIFE_S);
    this._camPosSmoothed.y = smoothToward(this._camPosSmoothed.y, cam.cPos.y, dt, CAMERA_HALFLIFE_S);
    this._camPosSmoothed.z = smoothToward(this._camPosSmoothed.z, cam.cPos.z, dt, CAMERA_HALFLIFE_S);
    this._camTgtSmoothed.x = smoothToward(this._camTgtSmoothed.x, cam.cTgt.x, dt, CAMERA_HALFLIFE_S);
    this._camTgtSmoothed.y = smoothToward(this._camTgtSmoothed.y, cam.cTgt.y, dt, CAMERA_HALFLIFE_S);
    this._camTgtSmoothed.z = smoothToward(this._camTgtSmoothed.z, cam.cTgt.z, dt, CAMERA_HALFLIFE_S);
    this._camFovSmoothed = smoothToward(this._camFovSmoothed, cam.cFov, dt, CAMERA_HALFLIFE_S);
    /* hand the eased camera to the live camera objects */
    const easedCam = {
      ...cam,
      cPos: this._camPosSmoothed,
      cTgt: this._camTgtSmoothed,
      cFov: this._camFovSmoothed,
    };
    this._applyCameraToCameras(easedCam);

    /* resize if needed. setPixelRatio(1) + setSize(W,H, false) — we own the DPR. */
    const W = Math.max(2, Math.round(this.cssW * this.dpr));
    const H = Math.max(2, Math.round(this.cssH * this.dpr));
    if (W !== this.W || H !== this.H){
      this.W = W; this.H = H;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(W, H, false);
      this.globeCamera.aspect = W / H; this.globeCamera.updateProjectionMatrix();
      this.cityCamera.aspect  = W / H; this.cityCamera.updateProjectionMatrix();
      /* pass 7: only resize RTs if they exist AND their size doesn't already
         match. _ensureRTs now allocates at the right size from the start, so
         the first _frame never calls setSize on a 2×2 placeholder. */
      if (this.globeRT && (this.globeRT.width !== W || this.globeRT.height !== H)){
        this.globeRT.setSize(W, H); this.cityRT.setSize(W, H);
      }
    }

    /* PASS 6 — adaptive DPR. After cityReady, sample median frame time over 90
       frames while the scroll is idle (> 300 ms without a progress change).
       Step down to 1.5 then 1.25 if median > 22 ms. */
    if (this._cityReady && !this._dprSampled){
      if (pDelta < 1e-4){
        /* idle frame — accumulate */
        this._dprWindow.push(dt * 1000);
        if (this._dprWindow.length > 90){
          const sorted = [...this._dprWindow].sort((a,b)=>a-b);
          const median = sorted[Math.floor(sorted.length / 2)];
          /* one step per 90-frame window, and only ever DOWN (a 1x screen must never step up to 1.5). */
          let next = this.dpr;
          while (this._dprStep < DPR_STEP.length && next <= DPR_STEP[this._dprStep]) this._dprStep++;
          if (median > DPR_THRESHOLD_MS && this._dprStep < DPR_STEP.length){
            next = DPR_STEP[this._dprStep++];
            this.dpr = next; this.W = this.H = 0;   /* resize on DPR change */
          }
          this._dprWindow.length = 0;
          if (median <= DPR_THRESHOLD_MS || this._dprStep >= DPR_STEP.length) this._dprSampled = true;
        }
      } else {
        /* moving — reset the window so we only sample while idle. */
        this._dprWindow.length = 0;
      }
    }

    /* altitude cross-fade (globe ↔ city). */
    let globeAlpha, cityAlpha;
    if (cam.altKm > CROSSFADE_HIGH_KM){ globeAlpha = 1; cityAlpha = 0; }
    else if (cam.altKm < CROSSFADE_LOW_KM){ globeAlpha = 0; cityAlpha = 1; }
    else {
      const t = (cam.altKm - CROSSFADE_HIGH_KM) / (CROSSFADE_LOW_KM - CROSSFADE_HIGH_KM);
      const e = smootherstep(t);
      globeAlpha = 1 - e; cityAlpha = e;
    }
    const finalGlobe = globeAlpha * (this._layerSmoothed.globe != null ? this._layerSmoothed.globe : 0);
    const finalCity  = cityAlpha  * (this._layerSmoothed.city  != null ? this._layerSmoothed.city  : 0);

    /* PASS 6 REPAIR — dynamic city fog. Two density profiles that lerp with
       altitude so the city never reads as a full-frame grey:
         • Below 4 km altitude (territory / rank / focus / panels stations):
           fog tightens (near=100..1000 m, far=3000..5000 m) so the 4 km tile
           edge dissolves at the 2.5 km station as the brief requires.
         • During the cross-fade band (altKm 4 → 50+): fog lifts to near
           1000..3000 m, far 5000..100000 m so the block pattern is legible
           from above (camera 15-50 km up, looking at a city 15-50 km away). */
    if (this.cityScene && this.cityScene.fog){
      const fog = this.cityScene.fog;
      const alt = clamp(cam.altKm, 0, 50);
      if (alt <= 4){
        /* lead: fog scales with the camera's distance to what it looks at, so the subject is always crisp and only
           the far tile edge hazes out (fixed 1-5 km fog washed the 2.5 km views to white) */
        const d = this.cityCamera.position.length();
        fog.near = Math.max(1400, d * 1.5);
        fog.far  = Math.max(11000, d * 5.0);
      } else {
        const t = clamp((alt - 4) / 46, 0, 1);
        fog.near = lerp(1000, 3000, t);
        fog.far  = lerp(5000, 100000, t);
      }
    }

    this.compositeMaterial.uniforms.uMix.value = finalCity;
    { const u = this.compositeMaterial.uniforms, m = clamp(cityAlpha, 0, 1);
      u.uVeil.value = m < 0.5 ? Math.pow(m / 0.5, 0.6) * 1.15 : Math.pow(1 - clamp((m - 0.5) / 0.22, 0, 1), 1.6) * 1.15;   /* v11: opaque at the switch, then clears fast so the valley is crisp right after the clouds */ u.uZoom.value = m * 2.4; u.uAspect.value = this.W / Math.max(1, this.H); }
    /* PASS 6 — Earth detail strength ramps with zoom so the low part of the
       descent isn't a flat brown blob. */
    if (this.earth && typeof this.earth.setDetail === 'function'){
      this.earth.setDetail(0);   /* lead: imagery only - the fbm relief cost a full-screen noise pass during the dive */
      if (this.earth.setCloudFade) this.earth.setCloudFade(clamp((cam.altKm - 2400) / 5000, 0, 1));   /* 2k clouds are mush up close */
      if (this.earth.setAtmo) this.earth.setAtmo(clamp((cam.altKm - 700) / 2600, 0, 1));   /* v12: the halo goes before the camera reaches it */
    }
    /* PASS 8 — slow eastward Earth spin over p 0..0.06 (max 4° = 0.0698 rad).
       The Earth has no Euler tilt (rotation.x = 0) so rotation.y is a pure
       spin around the world +Y axis. Clouds share the same rotation
       because the YXZ order with x = 0 leaves them aligned. */
    {
      const spinP = clamp(this._pSmoothed / 0.06, 0, 1);
      const spinY = (1 - spinP) * 4 * Math.PI / 180;   /* 4° at p=0, 0° at p=0.06 */
      if (this.globeScene){
        const es = this.globeScene.children;
        for (let i = 0; i < es.length; i++){
          const m = es[i];
          if (m && m.rotation && m.rotation.order === 'YXZ' && m.material && m.material.uniforms && m.material.uniforms.uSunDir){
            m.rotation.y = spinY;
          }
        }
      }
    }
    this.earth.update(this._t);

    /* PASS 6 — shadow camera is event-driven. Re-fit only when the focus target
       moved > 20% of the frustum width, snap to whole texels for stable
       edges. Re-fit the shadow only when we re-render (autoUpdate = false). */
    if (this._sun && this.city && this.city.sunTarget){
      const t = this.city.sunTarget;
      const off = this._sunOffset || [0, 1500, 0];
      this._sun.position.set(t.x + off[0], t.y + off[1], t.z + off[2]);
      this._sun.target.position.set(t.x, t.y, t.z);
      this._sun.target.updateMatrixWorld();
      const targetKey = `${(t.x / 50 | 0)}_${(t.z / 50 | 0)}`;
      if (targetKey !== this._lastShadowTargetKey){
        const sc = this._sun.shadow.camera;
        const span = 260;
        sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span;
        sc.near = 1; sc.far = 2400;
        /* snap to whole shadow texels — texel = 2*span / mapSize */
        const texel = (2 * span) / 2048;
        const cx = Math.round(t.x / texel) * texel;
        const cz = Math.round(t.z / texel) * texel;
        this._sun.position.set(cx + off[0], t.y + off[1], cz + off[2]);
        sc.updateProjectionMatrix();
        this.renderer.shadowMap.needsUpdate = true;
        this._lastShadowTargetKey = targetKey;
      }
    }

    /* update city layer + animation */
    if (this.city && typeof this.city.setLayers === 'function'){
      const ls = this._layerSmoothed;
      this.city.setLayers({
        solar: ls.solar || 0,
        territory: ls.territory || 0,
        territoryDraw: ls.territoryDraw || 0,
        rank: ls.rank || 0,
        focus: ls.focus || 0,
        panels: ls.panels || 0,
        night: ls.night || 0,
      });
    }
    if (this.city && typeof this.city.update === 'function'){
      this.city.update(this._t, dt);
    }

    /* PASS 6 — onFrame subscribers run AFTER the camera is updated. HUD pins
       should position themselves from inside this callback using
       world.project([x,y,z]). */
    const state = {
      p: this._pSmoothed, pTarget: this._pTarget,
      altKm: cam.altKm,
      globeAlpha: finalGlobe, cityAlpha: finalCity,
      camera: this.cityCamera,
      station: stationName(this._pSmoothed),
    };
    for (const fn of this._frameFns) fn(this._t, dt, state);

    /* render */
    const r = this.renderer;
    const crossfade = (finalGlobe >= 0.001 && finalCity >= 0.001);
    if (crossfade){
      /* lead: no render targets. Draw ONE scene straight to the canvas (switch at the veil's peak) and lay the cloud
         veil over it. Halves the shader programs (RT output = a second, linear program per material) and frame cost. */
      /* pass 7: samples = 0 always (cloud veil hides cross-fade aliasing;
         toggling MSAA between samples=0 and samples=4 cost ~330 ms in the
         original probe). */
      r.setRenderTarget(null); r.clear(true, true, false);
      if (cityAlpha >= 0.5) r.render(this.cityScene, this.cityCamera); else r.render(this.globeScene, this.globeCamera);
      r.autoClear = false; r.render(this.compositeScene, this.compositeCamera); r.autoClear = true;
    } else {
      /* if RTs existed and we just left the band, start the 3 s dispose clock */
      r.setRenderTarget(null); r.clear(true, true, false);
      if (finalCity >= 0.001) r.render(this.cityScene, this.cityCamera);
      else r.render(this.globeScene, this.globeCamera);
    }
    if (this._rtNeedsDispose){
      this._rtSinceLeftBand += dt;
      if (false && this._rtSinceLeftBand > 3 && this.globeRT){ /* keep RTs: re-allocating MSAA targets mid-scroll stalled 200+ ms */
        this.globeRT.dispose(); this.cityRT.dispose();
        this.globeRT = this.cityRT = null;
        this.compositeMaterial.uniforms.uGlobe.value = null;
        this.compositeMaterial.uniforms.uCity.value = null;
        this._rtNeedsDispose = false;
      }
    }

    /* first-frame visibility — fade canvas in, hide poster */
    if (!this._firstFrame){
      this._firstFrame = true;
      /* pass 7: record the time the first real frame paints (this is what the
         task brief means by "globe visible" — after the globe shader has
         actually drawn to the canvas, not after _init returned). */
      this.timings.globeFirstFrame = performance.now();
      /* next paint so the browser actually drew the first frame, THEN fade in. */
      requestAnimationFrame(() => {
        this.cv.style.opacity = '1';
        this._poster.style.transition = 'opacity .5s ease';
        this._poster.style.opacity = '0';
        setTimeout(() => { if (this._poster && this._poster.parentNode) this._poster.parentNode.removeChild(this._poster); }, 700);
      });
    }

    /* PASS 6 — render-on-demand. Decide whether to schedule the next frame.
       Keep rendering while progress is moving, a layer is still easing, or an
       animation is active. */
    const pStillMoving = (Math.abs(this._pTarget - this._pSmoothed) > 1e-4);
    let layerStillMoving = false;
    for (const k of Object.keys(this._layerSmoothed)){
      const tgt = (this.layers[k] != null) ? this.layers[k] : 0;
      if (Math.abs(tgt - this._layerSmoothed[k]) > 1e-3){ layerStillMoving = true; break; }
    }
    const cameraStillMoving =
      (this._camPosSmoothed.distanceToSquared(camPosPrev) > 1e-2) ||
      (this._camTgtSmoothed.distanceToSquared(camTgtPrev) > 1e-2);
    const rankAnimating = (this._layerSmoothed.rank || 0) > 0.01;

    this._dirty = pStillMoving || layerStillMoving || cameraStillMoving || rankAnimating;
    if (this._dirty) this._scheduleFrame();
  }

  _ensureRTs(){
    if (this.globeRT && this.cityRT) return;
    /* PASS 7: allocate at full cssW*dpr × cssH*dpr from the start (no 2×2
       placeholder, no resize before the first cross-fade frame). samples=0
       — the cloud-dive veil hides the cross-fade aliasing, and MSAA
       allocation/resize was costing ~330 ms in the previous probe. */
    const dpr = this.dpr;
    const W = Math.max(2, Math.round(this.cssW * dpr));
    const H = Math.max(2, Math.round(this.cssH * dpr));
    /* lead: do NOT set this.W/H here - the frame loop compares against them to size the canvas and cameras; setting
       them here left the canvas at 300x150 with aspect 1 (squashed Earth, blurry city). */
    const rtOpts = {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      samples: 0,
      stencilBuffer: false,
      colorSpace: THREE.SRGBColorSpace,
    };
    this.globeRT = new THREE.WebGLRenderTarget(W, H, rtOpts);
    this.cityRT  = new THREE.WebGLRenderTarget(W, H, rtOpts);
    this.compositeMaterial.uniforms.uGlobe.value = this.globeRT.texture;
    this.compositeMaterial.uniforms.uCity.value  = this.cityRT.texture;
  }

  dispose(){
    cancelAnimationFrame(this._raf);
    this._rafScheduled = false;
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVis);
    if (this._onScroll){ window.removeEventListener('scroll', this._onScroll); this._onScroll = null; }
    if (this._ro) this._ro.disconnect();
    if (this._io) this._io.disconnect();
    if (this.city && typeof this.city.dispose === 'function') this.city.dispose();
    if (this.earth && typeof this.earth.dispose === 'function') this.earth.dispose();
    if (this._outerGround){
      if (this._outerGround.mesh && this._outerGround.mesh.geometry) this._outerGround.mesh.geometry.dispose();
      if (this._outerGround.mat) this._outerGround.mat.dispose();
      if (this._outerGround.tex) this._outerGround.tex.dispose();
    }
    if (this.globeRT) this.globeRT.dispose();
    if (this.cityRT) this.cityRT.dispose();
    if (this.compositeMaterial) this.compositeMaterial.dispose();
    if (this.renderer) this.renderer.dispose();
    if (this.cv && this.cv.parentNode) this.cv.parentNode.removeChild(this.cv);
    if (this._poster && this._poster.parentNode) this._poster.parentNode.removeChild(this._poster);
    this._frameFns.length = 0;
  }

  get cityReady(){
    if (this._resolveCityReady) return this._cityReadyPromise;
    this._cityReadyPromise = new Promise(r => { this._resolveCityReady = r; });
    if (this._cityReady) this._resolveCityReady(this);
    return this._cityReadyPromise;
  }

  get ready(){
    if (this._resolveReady) return this._readyPromise;
    this._readyPromise = new Promise(r => { this._resolveReady = r; });
    if (this._ready) this._resolveReady(this);
    return this._readyPromise;
  }
}

function stationName(p){
  /* PASS 8 — eight beats that match the new home hero copy:
       earth / descent / valley / solar / territory / rank / focus / panels.
     The cloud-dive veil covers the cross-fade band (.14-.16); we keep
     the band labelled "descent" because the visitor reads it as the
     final stretch of the descent into the valley. */
  if (p < 0.05) return 'earth';
  if (p < 0.16) return 'descent';
  if (p < 0.24) return 'valley';
  if (p < 0.34) return 'valley';
  if (p < 0.455) return 'territory';
  if (p < 0.525) return 'score';
  if (p < 0.63) return 'rank';
  if (p < 0.77) return 'focus';
  if (p < 0.93) return 'panels';
  return 'pullback';
}

/* ── public mount + window export ── */
function mount(el, opts){
  if (!el) throw new Error('[HAWorld] mount requires a DOM element');
  injectCSS();
  el.setAttribute('data-haworld', '');
  const world = new HAWorld(el, opts);
  return world;
}

function injectCSS(){
  if (document.getElementById('haworld-css')) return;
  const s = document.createElement('style');
  s.id = 'haworld-css';
  s.textContent = `
    [data-haworld]{ isolation:isolate; contain:paint; overflow:hidden }
    [data-haworld] > canvas{ image-rendering:auto; display:block }
  `;
  document.head.appendChild(s);
}

window.HAWorld = { mount, THREE };
export { mount, THREE };