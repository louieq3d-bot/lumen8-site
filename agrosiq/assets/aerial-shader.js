/* AgrosIQ — the farm-from-orbit fragment shader (GLSL ES 3.0). aerial.js compiles it once and shares it with every canvas.
   The ground is a sphere (radius uPlanet) so the camera can start in orbit and dive to a single 10 m pixel. Level of detail
   runs from crop rows and tree crowns up to field colours and then regional land cover, coast and mountains. */
window.AERIAL_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime, uSeed, uPlanet, uAlt;
uniform vec3 uRo, uR, uU, uF, uSun; uniform float uTan; uniform vec2 uShift;
uniform float uHealth, uScan, uScanOn, uPix, uAlert, uPatch, uCloud, uOutline, uFocusK, uFocusR, uSeason, uExpo, uSat, uZones, uStack, uSep, uStars, uDim;
uniform vec2 uAlertPos, uFocus;
uniform vec4 uTile, uHi, uSel;
uniform int uN;   // always 1: loop bounds read it so the D3D compiler cannot unroll (and bloat) them
out vec4 o;

float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21) + uSeed * .137); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
vec3 vnd(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f), du = 6. * f * (1. - f);
  float a = h21(i), b = h21(i + vec2(1, 0)), c = h21(i + vec2(0, 1)), d = h21(i + vec2(1, 1)), k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
}
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5 * uN; i++){ s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= .5; } return s / .97; }
float fbm3(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3 * uN; i++){ s += a * vn(p); p = p * 2.07 + vec2(17.1, 9.3); a *= .5; } return s / .875; }
float fbm2(vec2 p){ return (vn(p) + .5 * vn(p * 2.07 + vec2(17.1, 9.3))) / 1.5; }
// octaves fade out once they are smaller than a pixel (scale = size of the first octave in metres)
float fbmL(vec2 p, float scale, float px, int oct){
  float a = .5, s = 0., w = 0., sc = scale; vec2 q = p / scale;
  for (int i = 0; i < oct * uN; i++){ float k = smoothstep(px * 1.2, px * 3.5, sc); if (k <= 0.) break; s += a * k * vn(q); w += a * k; q = q * 2.03 + vec2(17.1, 9.3); a *= .5; sc *= .49; }
  return w > 0. ? s / w : .5;
}

struct F { float id; float kind; float dE; float dR; vec2 q; vec2 bi; float ang; float pivot; vec2 pc; float pr; float code; };
F field(vec2 p){
  F f;
  vec2 q = mat2(.978, .208, -.208, .978) * p;
  q += (vec2(vn(p * .0011), vn(p * .0011 + 7.3)) - .5) * 110.;
  vec2 B = vec2(780., 610.);
  q.x += h21(vec2(floor(q.y / B.y), 3.1)) * B.x;
  vec2 bi = floor(q / B), bf = q - bi * B;
  float hb = h21(bi), id = 0.;
  vec2 lo = vec2(0.), hi = B;
  if (h21(bi + 1.7) < .8){ float sx = B.x * (.28 + .44 * h21(bi + 2.3)); if (bf.x < sx){ hi.x = sx; id = 1.; } else { lo.x = sx; id = 2.; } }
  if (h21(bi + id + 3.1) < .72){ float sy = lo.y + (hi.y - lo.y) * (.3 + .4 * h21(bi + id + 5.7)); if (bf.y < sy){ hi.y = sy; id += 10.; } else { lo.y = sy; id += 20.; } }
  if (h21(bi + id + 8.9) < .34){ float sx = lo.x + (hi.x - lo.x) * (.35 + .3 * h21(bi + id + 9.4)); if (bf.x < sx){ hi.x = sx; id += 100.; } else { lo.x = sx; id += 200.; } }
  f.dR = min(min(bf.x, B.x - bf.x), min(bf.y, B.y - bf.y));
  f.dE = min(min(bf.x - lo.x, hi.x - bf.x), min(bf.y - lo.y, hi.y - bf.y));
  f.id = h21(bi * 1.37 + id * .71 + .5);
  f.q = bf; f.bi = bi; f.pivot = 0.; f.pc = B * .5; f.pr = 0.; f.code = id;
  if (hb > .79){
    f.pr = min(B.x, B.y) * .5 - 16.;
    float d = length(bf - f.pc);
    f.pivot = d > f.pr ? 2. : 1.;
    f.dE = min(abs(d - f.pr), f.dR);
    f.id = h21(bi * 2.1 + (d > f.pr ? 9. : 0.));
    f.code = d > f.pr ? 600. : 500.;
  }
  f.kind = hb < .055 ? 6. : floor(f.id * 6.);
  f.ang = h21(vec2(f.id, 4.4)) < .5 ? 0. : 1.;
  if (f.pivot > 1.5) f.kind = 4.;
  return f;
}

const vec3 SOIL = vec3(.29, .21, .145), SOIL2 = vec3(.39, .30, .21), YOUNG = vec3(.30, .37, .15), LUSH = vec3(.17, .31, .10),
           DEEP = vec3(.085, .19, .065), GOLD = vec3(.67, .56, .33), STUB = vec3(.60, .55, .43), SPROUT = vec3(.66, .84, .27), AMB = vec3(.953, .663, .235);
vec3 crop(float t, float var, out float g){
  float up = smoothstep(.04, .30, t), dn = smoothstep(.58, .74, t), cut = smoothstep(.80, .83, t);
  vec3 c = mix(SOIL2, YOUNG, smoothstep(.03, .16, t));
  c = mix(c, mix(LUSH, DEEP, var), smoothstep(.14, .32, t));
  c = mix(c, GOLD, dn); c = mix(c, STUB, cut); c = mix(c, SOIL, smoothstep(.92, .985, t));
  g = up * (1. - dn * .8) * (1. - cut);
  return c;
}
vec3 veg(float v){
  v = clamp(v, 0., 1.);
  vec3 a = vec3(.23, .17, .13), b = vec3(.36, .30, .17), c = vec3(.05, .36, .21), d = vec3(.10, .50, .28), e = vec3(.56, .76, .26);
  if (v < .35) return mix(a, b, v / .35);
  if (v < .55) return mix(b, c, (v - .35) / .2);
  if (v < .78) return mix(c, d, (v - .55) / .23);
  return mix(d, e, (v - .78) / .22);
}
float stripe(float r, float P, float w, float px){
  float d = abs(fract(r / P) - .5) * P;
  return smoothstep(w + px, w - px, d) * (1. - smoothstep(P * .2, P * .5, px));
}
float riverD(vec2 p){
  return abs(p.y - (-1050. + 260. * sin(p.x / 820.) + 120. * sin(p.x / 333. + 1.) + 2600. * sin(p.x / 9100. + .6) * smoothstep(3000., 12000., abs(p.x))));
}
// regional land cover: farmland share, sea and mountains. The farm itself always sits in open farmland.
void region(vec2 p, out float farm, out float sea, out float mtn){
  float r2 = dot(p, p);
  farm = 1.; sea = 0.; mtn = 0.;
  if (r2 < 4.9e7) return;
  farm = smoothstep(.40, .50, fbm3(p / 17000. + 2.7) + .55 * exp(-r2 / 2.2e8));
  float land = fbm3(p / 80000. + 5.3) + .5 * exp(-r2 / 3.6e9);
  sea = smoothstep(.465, .445, land);
  mtn = smoothstep(.56, .72, fbm3(p / 46000. + 8.1)) * smoothstep(26000., 42000., sqrt(r2)) * (1. - sea);
}
// terrain slope (dh/dx, dh/dy) from analytic noise gradients
vec2 slope(vec2 p, float mtn, float px){
  vec2 g = 110. / 5200. * vnd(p / 5200.).yz + 40. / 2100. * vnd(p / 2100. + 3.1).yz;
  if (px < 400.) g += 14. / 800. * vnd(p / 800. + 7.7).yz;
  if (mtn > .001){
    for (int i = 0; i < 2 * uN; i++){
      float sc = i == 0 ? 6500. : 2700., am = i == 0 ? 2600. : 900.;
      vec3 n = vnd(p / sc + 1.3 + float(i) * 4.1); float r = 1. - abs(2. * n.x - 1.);
      g += mtn * am / sc * 2. * r * (-2. * sign(n.x - .5)) * n.yz;
    }
  }
  return g;
}
// tree crowns on a jittered 7 m grid: x = height 0..1, yz = offset from the crown centre (for lighting)
vec3 crowns(vec2 p){
  vec2 i = floor(p / 7.), f = fract(p / 7.); vec3 best = vec3(0., 0., 0.);
  for (int k = 0; k < 9 * uN; k++){
    vec2 g = vec2(float(k - (k / 3) * 3 - 1), float(k / 3 - 1)), c = g + .1 + .8 * vec2(h21(i + g), h21(i + g + 19.7));
    float r = .58 + .3 * h21(i + g + 3.3); vec2 dv = (f - c) / r; float v = 1. - dot(dv, dv);
    if (v > best.x) best = vec3(v, dv);
  }
  return best;
}
float treeMask(vec2 p, F f, float rv){
  float m = f.kind > 5.5 ? 1. : 0.;
  if (f.dR < 13. && f.dR > 5.) m = max(m, smoothstep(.52, .7, vn(p / 5.5 + f.id)) * smoothstep(13., 9., f.dR));
  if (rv < 130.){ float rip = 90. + 40. * vn(p / 60.); m = max(m, step(19., rv) * smoothstep(rip, rip - 30., rv) * smoothstep(.28, .5, vn(p / 18.))); }
  return m;
}
float house(F f, vec2 q, out vec3 roof){
  roof = vec3(0.);
  if (h21(f.bi + 44.) < .86 || q.x > 95. || q.y > 80. || q.x < 10. || q.y < 10.) return 0.;
  vec2 cell = floor(q / 21.), cf = fract(q / 21.);
  float hb = h21(cell + f.bi);
  if (hb > .42 && cf.x > .12 && cf.x < .88 && cf.y > .2 && cf.y < .8){
    roof = (hb > .8 ? vec3(.55, .31, .23) : vec3(.72, .72, .70)) * (cf.x < .5 ? 1. : .74); return 1.; }
  return -1.;   // yard
}
// the greenness of one ground point (f = field(p)), sampled per 10 m pixel by the health layer
float greenOf(vec2 p, F f){
  float river = riverD(p);
  if (river < 90. + 40. * vn(p / 60.)) return river < 18. ? .05 : .74;
  if (f.kind > 5.5) return .8 + .1 * vn(p / 30.);
  if (f.dR < 6.) return .12;
  float g; crop(fract(uSeason + f.id * .53), fract(f.id * 7.1), g);
  if (f.kind > 4.5) g = .66 + .12 * fract(f.id * 13.);
  g *= .78 + .44 * fbm3(p / 150. + f.id * 11.);
  g *= 1. - uPatch * .62 * exp(-pow(length(p - uAlertPos) / 85., 2.));
  return g;
}

F noField(){ F f; f.id = 0.; f.kind = 7.; f.dE = 1e4; f.dR = 1e4; f.q = vec2(0.); f.bi = vec2(1e6); f.ang = 0.; f.pivot = 0.; f.pc = vec2(0.); f.pr = 0.; f.code = -9.; return f; }
// a tree's shadow falling on p: sp = the point 10 m towards the sun, fs = field(sp)
float treeShadow(vec2 sp, F fs){ return treeMask(sp, fs, riverD(sp)) * smoothstep(.12, .4, crowns(sp).x); }

// true-colour albedo of the ground, with a bump normal, shadow and water flags
vec3 ground(vec2 p, float px, F f, vec2 sp, F fs, out vec3 nrm, out float water, out float occ, out float zone){
  float farmR, sea, mtn; region(p, farmR, sea, mtn);
  water = 0.; occ = 0.; zone = .5;
  vec3 c = vec3(0.); vec2 bump = vec2(0.);
  float wF = 1. - smoothstep(220., 700., px);
  if (wF > 0.){
    float season = fract(uSeason + f.id * .53), var = fract(f.id * 7.1), g;
    c = crop(season, var, g);
    if (f.kind > 4.5 && f.kind < 5.5) c = mix(LUSH, vec3(.24, .33, .14), fract(f.id * 13.));
    zone = fbm3(p / 230. + f.id * 11.);
    float zk = 1. - smoothstep(110., 380., px);
    c *= mix(1., .80 + .40 * zone, zk) * (.9 + .2 * fract(f.id * 31.));
    float near = 1. - smoothstep(2.5, 6., px);
    if (near > 0.) c *= 1. + .07 * (vn(p / 6.5) - .5) * near;
    float dA = length(p - uAlertPos);
    c = mix(c, mix(SOIL2, GOLD, .35), uPatch * .55 * exp(-pow(dA / 85., 2.)));
    float rowK = 1. - smoothstep(.35, 1.6, px);
    if (f.pivot > .5 && f.pivot < 1.5){
      float rr = length(f.q - f.pc);
      c *= 1. - .16 * stripe(rr, 56., 1.6, px) - .07 * stripe(rr, 1.1, .3, px);
      bump += (f.q - f.pc) / max(rr, 1.) * sin(rr * 5.712) * .35 * rowK;
      float arm = mod(uTime * .015 + f.id * 6.28, 6.2832) - 3.1416;
      for (int k = 0; k < 2 * uN; k++){   // the arm, then its shadow
        vec2 sq = f.q - f.pc + (k == 0 ? vec2(0.) : uSun.xy / uSun.z * 4.);
        float an = atan(sq.y, sq.x), sr = length(sq);
        float on = smoothstep(px + 1.4, 0., abs(sin(an - arm)) * sr) * step(cos(an - arm), 0.) * step(sr, f.pr);
        if (k == 0) c *= 1. - .3 * on; else occ = max(occ, .7 * on);
      }
    } else if (f.kind < 4.5){
      float r = f.ang < .5 ? f.q.x : f.q.y;
      vec2 rdir = f.ang < .5 ? vec2(.978, -.208) : vec2(.208, .978);
      float grow = step(.06, season) * step(season, .8);
      c = mix(c, SOIL2 * 1.1, .55 * stripe(r + f.id * 40., 24., .9, px) * grow);
      c *= 1. - .12 * stripe(r, .76, .18, px);
      bump += rdir * sin(r * 8.267) * .5 * rowK;
      c *= 1. + .05 * smoothstep(14., 10., f.dE);
      c *= 1. - .09 * stripe(r * .7 + (f.ang < .5 ? f.q.y : f.q.x) * .7, 9., 2.2, px) * smoothstep(.8, .83, season) * (1. - smoothstep(.92, .95, season));
      float bare = max(1. - smoothstep(.03, .12, season), smoothstep(.9, .97, season));
      if (bare > 0. && px < 40.) c *= 1. - bare * .28 * (fbm3(p / 70. + 3.) - .45);
    }
    if (f.pivot > 1.5) c = mix(STUB * .85, vec3(.42, .40, .28), mix(.5, vn(p / 40.), 1. - smoothstep(10., 40., px)));
    c = mix(c, vec3(.36, .38, .25), smoothstep(px + 2.6, 2.6 - px, f.dE) * .85);
    c = mix(c, vec3(.60, .56, .47), smoothstep(px + 4.5, 4.5 - px, f.dR));
    // farmsteads and their shadows
    if (f.q.x < 120. && f.q.y < 100.){
      vec3 roof; float hs = house(f, f.q, roof);
      if (hs > .5) c = roof; else if (hs < -.5) c = mix(c, vec3(.46, .44, .38), .6);
      if (px < 6. && hs < .5){ vec3 r2; if (house(f, f.q - uSun.xy / uSun.z * 7., r2) > .5) occ = max(occ, .75); }
    }
    // river, hedges, woods
    float rv = riverD(p);
    float woods = max(treeMask(p, f, rv), 1. - farmR);
    if (woods > .001){
      vec3 cr = near > 0. ? crowns(p) : vec3(.55, 0., 0.);
      float cov = woods * mix(1., smoothstep(.0, .3, cr.x), near * farmR);
      vec3 cn = normalize(vec3(cr.yz * 1.3, .9));
      float lam = mix(1., clamp(.35 + .9 * dot(cn, uSun), .25, 1.4) * (.75 + .35 * cr.x), near);
      vec3 tc = DEEP * (.6 + .6 * mix(fbm3(p / 30.), cr.x, near)) * (.85 + .3 * vn(p / 45.)) * lam;
      c = mix(c, tc, cov);
      occ *= 1. - cov;
      woods = cov;
    }
    if (px < 3.) occ = max(occ, treeShadow(sp, fs) * .8 * (1. - smoothstep(1.5, 3., px)) * (1. - woods));
    float rw = max(18., px * .6);
    if (rv < rw){ c = mix(vec3(.035, .065, .075), vec3(.09, .14, .16), vn(p / 30.)); water = smoothstep(rw, rw - max(px, 2.), rv); }
  }
  // regional colour, used once fields are a few pixels wide
  if (wF < 1.){
    float n1 = vn(p / 2600.), n2 = vn(p / 900.);
    vec3 farmC = mix(vec3(.24, .29, .14), vec3(.34, .29, .19), n1) * (.82 + .32 * n2);
    vec3 cm = mix(DEEP * (.7 + .4 * vn(p / 3000.)), farmC, farmR);
    cm = mix(cm, vec3(.05, .09, .11), smoothstep(px * .7, px * .3, riverD(p)));
    c = mix(cm, c, wF);
  }
  if (mtn > .001){
    vec3 n = vnd(p / 6500. + 1.3); float rg = 1. - abs(2. * n.x - 1.);
    vec3 rock = mix(vec3(.30, .28, .24), vec3(.42, .39, .35), vn(p / 1800.));
    rock = mix(rock, vec3(.92, .94, .97), smoothstep(.55, .8, rg * mtn));
    c = mix(c, rock, smoothstep(.0, .5, mtn) * .95);
  }
  if (sea > .001){
    c = mix(c, vec3(.52, .48, .38), smoothstep(.0, .25, sea) * (1. - smoothstep(.25, .6, sea)) * .7);
    c = mix(c, mix(vec3(.02, .07, .11), vec3(.01, .03, .06), smoothstep(.5, 1., sea)), smoothstep(.3, .6, sea));
    water = max(water, smoothstep(.3, .6, sea));
  }
  vec2 sl = slope(p, mtn, px);
  nrm = normalize(vec3(-sl + bump * (1. - water), 1.));
  return c;
}

vec2 W(){ return vec2(uTime * 9., uTime * 3.5); }
float cloudK(vec2 q){ return mix(.80, .34, clamp(uCloud * (.45 + .8 * smoothstep(.28, .72, fbm2(q / 30000. + 4.1))), 0., 1.)); }
float cov(vec2 q, float px, int oct, float k){ float sw = .22 + clamp(px / 1800., 0., .32); return smoothstep(k - sw * .25, k + sw, fbmL(q + W(), 1500., px, oct)); }

vec3 sky(vec3 ro, vec3 rd, float b, float disc){
  float R = uPlanet;
  float hmin = b > 0. ? uAlt : (disc < 0. ? -disc / (sqrt(R * R - disc) + R) : 0.);
  vec3 c = vec3(0.);
  vec3 s3 = rd * 900.; vec3 si = floor(s3);
  float g = exp(-hmin / 2600.);
#ifdef FULL
  c += vec3(.72, .8, 1.) * step(.9982, h21(si.xy + si.z * 3.17 + 11.)) * smoothstep(.42, .08, length(fract(s3) - .5)) * uStars * (1. - g) * (.4 + .6 * h21(si.yz));
#endif
  vec3 cp = ro + rd * max(-b, 0.) + vec3(0., 0., R);
  float lit = clamp(dot(normalize(cp), uSun) * 1.5 + .3, 0., 1.);
  c += mix(vec3(.05, .2, .62), vec3(.62, .82, 1.), exp(-hmin / 480.)) * g * lit;
  float inA = exp(-uAlt / 9000.);
  c = mix(c, mix(vec3(.30, .45, .62), vec3(.05, .11, .24), smoothstep(0., .45, rd.z)), inA);
  float sd = max(dot(rd, uSun), 0.);
  c += vec3(1., .95, .86) * (smoothstep(.99986, .99995, sd) * 5. + pow(sd, 900.) * .5 + pow(sd, 50.) * .05);
  return c;
}

#ifdef FULL
vec4 layer(int i, vec2 q, float px){
  vec2 pq = (floor(q / 10.) + .5) * 10.;
  F ff = field(i == 1 ? pq : q);
  if (i == 1){
    vec3 hc = veg(greenOf(pq, ff));
    vec2 cf = fract(q / 10.);
    hc *= .84 + .24 * smoothstep(.0, .12, cf.x) * smoothstep(1., .88, cf.y) - .1 * smoothstep(.85, 1., cf.x);
    hc *= 1. - .5 * smoothstep(.47 - px * .05, .5, max(abs(cf.x - .5), abs(cf.y - .5))) * (1. - smoothstep(1.5, 4., px));
    return vec4(hc * 1.05, .93);
  }
  if (i == 2){
    float z = fbm3(q / 230. + ff.id * 11.);
    vec3 zc = z < .44 ? vec3(.16, .2, .14) : z < .6 ? vec3(.06, .40, .23) : vec3(.62, .80, .30);
    float w = px / 110. + .004;
    zc = mix(zc, vec3(.9, 1., .8), max(smoothstep(w, 0., abs(z - .44)), smoothstep(w, 0., abs(z - .6))) * .55);
    zc = mix(zc, vec3(.06, .08, .07), smoothstep(px + 3., 2., ff.dE) * .8);
    return vec4(zc, ff.kind > 5.5 || ff.dR < 6. || ff.pivot > 1.5 ? .12 : .86);
  }
  vec4 a = vec4(vec3(.05, .08, .06), .14);
  a = mix(a, vec4(SPROUT, .9), smoothstep(px * 1.4 + 2.6, 1.8, ff.dE) * (ff.kind > 5.5 ? .25 : 1.));
  if (floor(uAlertPos / 10.) == floor(q / 10.)) a = vec4(AMB * 1.1, 1.);
  float dA = length(q - uAlertPos), ph = fract(uTime * .45);
  float ring = exp(-pow((dA - ph * 160.) / (px * 1.6 + 2.), 2.)) * (1. - ph);
  return mix(a, vec4(AMB, 1.), clamp(ring * .9 + exp(-pow((dA - 30.) / (px * 1.2 + 1.), 2.)) * .7, 0., 1.));
}
#endif

vec3 haze(float alt, float day){
  return mix(vec3(.14, .19, .26), vec3(.20, .32, .52), smoothstep(5000., 50000., alt)) * (.3 + .7 * day);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / (.5 * uRes.y);
  vec2 sv = uv - uShift * vec2(uRes.x / uRes.y, 1.);
  vec3 rd = normalize(uF + sv.x * uTan * uR + sv.y * uTan * uU);
  vec3 ro = uRo; float R = uPlanet;
  float pa = 2. * uTan / uRes.y;
  float b = dot(ro, rd) + R * rd.z, cc = dot(ro, ro) + 2. * R * ro.z, disc = b * b - cc;
  float tG = disc > 0. ? -b - sqrt(disc) : -1.;
  vec3 col; float tEnd = 1e12;
  if (tG > 0.){
    tEnd = tG;
    vec3 P = ro + rd * tG;
    vec3 N = normalize(vec3(P.xy, P.z + R));
    float cosv = max(dot(-rd, N), .02);
    float px = tG * pa / sqrt(cosv);
    vec2 p = P.xy;
    // the field under this pixel, under its 10 m health pixel and under the tree that may shade it, in one loop
    vec2 sdir = normalize(vec2(.96, -.28));
    float s = dot(p, sdir);
    float reveal = uScanOn > .5 ? smoothstep(uScan + 30., uScan - 30., s) : 1.;
    float w = uHealth * reveal * (1. - smoothstep(300., 900., px));
    vec2 pq = mix(p, (floor(p / 10.) + .5) * 10., uPix), sp = p - uSun.xy / uSun.z * 10.;
    F f = noField(), fq = noField(), fs = noField();
    for (int k = 0; k < 3 * uN; k++){
      if ((k == 0 && px > 700.) || (k == 1 && (w <= .001 || px > 6.)) || (k == 2 && px >= 3.)) continue;
      F r = field(k == 0 ? p : k == 1 ? pq : sp);
      if (k == 0) f = r; else if (k == 1) fq = r; else fs = r;
    }
    vec3 nrm; float water, occ, zone;
    if (px > 6.){ fq = f; pq = p; }   // the 10 m pixel is smaller than a screen pixel: its field is this one
    vec3 c = ground(p, px, f, sp, fs, nrm, water, occ, zone);
    w *= 1. - water * .8;
#ifdef FULL
    vec2 cq = p + uSun.xy / uSun.z * 1900.;
    float csh = uCloud > .001 ? cov(cq, max(px, 150.), 2, cloudK(cq)) : 0.;
#else
    float csh = 0.;
#endif
    float sunN = dot(N, uSun);
    float day = smoothstep(-.1, .22, sunN);
    float dif = clamp(dot(nrm, uSun) / max(uSun.z, .2), 0., 1.7) * clamp(sunN / max(uSun.z, .2), 0., 1.2);
    vec3 lit = c * (vec3(.27, .31, .37) * (.35 + .65 * day) + vec3(1., .96, .88) * .80 * dif * (1. - .62 * csh) * (1. - .72 * occ));
    if (water > 0.){
      vec3 rf = reflect(rd, normalize(N + vec3(nrm.xy, 0.))); float sp = max(dot(rf, uSun), 0.);
      float fr = .03 + .97 * pow(1. - cosv, 5.);
      lit = mix(lit, vec3(.10, .17, .26) * day, fr * water * .85);
      lit += vec3(1., .94, .82) * (pow(sp, 260.) * 5. + pow(sp, 16.) * .18) * water * (1. - csh) * day;
    }
    c = lit;
    float L = dot(c, vec3(.3, .55, .15));
    c = mix(vec3(L), c, uSat);
    // ── intelligence layers ──
    if (w > .001){
      float gq = greenOf(pq, fq);
      vec3 hc = veg(gq) * (.82 + .5 * clamp(L / .3, .4, 1.4));
      vec2 cf = fract(p / 10.);
      float fine = (1. - smoothstep(.8, 3., px)) * uPix;
      hc *= 1. + .16 * (smoothstep(.0, .14, cf.x) * smoothstep(1., .86, cf.y) - .5 * smoothstep(.8, 1., cf.x) - .5 * smoothstep(.2, .0, cf.y)) * fine;
      vec2 ce = abs(cf - .5) * 10.;
      hc *= 1. - .55 * smoothstep(4.0 - px * .8, 5., max(ce.x, ce.y)) * (1. - smoothstep(1.2, 3.5, px)) * uPix;
      hc *= .9 + .1 * smoothstep(-.4, .9, dot(nrm, uSun));
      c = mix(c, hc, w * .94);
    }
    if (uZones > .001 && f.kind < 5.5 && f.dR > 6.){
      vec3 zc = zone < .44 ? vec3(.17, .21, .14) : zone < .6 ? vec3(.07, .42, .24) : vec3(.63, .81, .31);
      float zw = px / 110. + .004;
      zc = mix(zc, vec3(.92, 1., .82), max(smoothstep(zw, 0., abs(zone - .44)), smoothstep(zw, 0., abs(zone - .6))) * .5);
      c = mix(c, zc * (.8 + .4 * clamp(L / .3, .4, 1.3)), uZones * .9 * (f.pivot > 1.5 ? .2 : 1.));
    }
    if (uOutline > .001){
      float ol = max(smoothstep(px * 1.6 + 3.5, 3.0, f.dE) * (1. - smoothstep(4., 9., f.dR)), smoothstep(px * 1.6 + 3.5, 3., f.dE));
      c = mix(c, vec3(.70, .88, .32), ol * uOutline * .85 * (f.kind > 5.5 ? .25 : 1.) * (1. - smoothstep(30., 90., px)));
    }
    float isHi = uHi.w * step(abs(f.bi.x - uHi.x) + abs(f.bi.y - uHi.y) + abs(f.code - uHi.z), .5);
    float isSel = uSel.w * step(abs(f.bi.x - uSel.x) + abs(f.bi.y - uSel.y) + abs(f.code - uSel.z), .5);
    float anyK = max(uHi.w, uSel.w), me = max(isHi, isSel);
    if (anyK > .001){
      c *= 1. - .32 * anyK * (1. - me);
      c = mix(c, c * 1.22 + vec3(.02, .04, 0.), me);
      c = mix(c, vec3(.78, .94, .38), smoothstep(px * 1.5 + 3.2, 2., f.dE) * me);
    }
    if (uScanOn > .5){
      float lw = px * 2.5 + 3.;
      c += vec3(.78, .95, .55) * exp(-pow((s - uScan) / lw, 2.)) * .9 + vec3(.40, .55, .20) * exp(-pow((s - uScan) / (px * 60. + 120.), 2.)) * step(s, uScan + 1.) * .12;
    }
    float dA = length(p - uAlertPos);
    if (uAlert > .001){
      c = mix(c, AMB * 1.08, (floor(uAlertPos / 10.) == floor(p / 10.) ? 1. : 0.) * uAlert);
      float ph = fract(uTime * .45);
      c += AMB * (exp(-pow((dA - ph * 140.) / (px * 1.6 + 1.5), 2.)) * (1. - ph) * .9 + exp(-pow((dA - 26.) / (px * 1.2 + .8), 2.)) * .55) * uAlert;
    }
    if (uFocusK > .001) c *= mix(1., .32, uFocusK * smoothstep(uFocusR, uFocusR * 1.25 + 40., length(p - uFocus)));
#ifdef FULL
    if (uStack > .001){
      vec2 dd = abs(p - uTile.xy) - uTile.zw;
      float sd = length(max(dd, 0.)) + min(max(dd.x, dd.y), 0.);
      c *= 1. - .78 * uStack * smoothstep(-px, px, sd);
      c = mix(c, SPROUT, exp(-pow(sd / (px * 1.5 + 1.), 2.)) * .8 * uStack);
    }
#endif
    // aerial perspective
    float T = exp(-8000. * (1. - exp(-uAlt / 8000.)) / (34000. * cosv));
    col = c * T + haze(uAlt, day) * (1. - T);
  } else col = sky(ro, rd, b, disc);

#ifdef FULL
  // exploded layers above the ground tile
  if (uStack > .001 && rd.z < 0.){
    vec4 acc = vec4(0.);
    for (int j = 0; j < 3 * uN; j++){
      int i = 3 - j;
      float z = float(i) * uSep * uStack;
      if (ro.z <= z) continue;
      float tt = (z - ro.z) / rd.z; vec2 q = ro.xy + rd.xy * tt;
      vec2 dd = abs(q - uTile.xy) - uTile.zw;
      float sd = length(max(dd, 0.)) + min(max(dd.x, dd.y), 0.);
      float pxl = tt * pa / sqrt(max(-rd.z, .05));
      float inside = smoothstep(pxl, -pxl, sd) * smoothstep(0., .25, uStack);
      vec4 Lc = inside > 0. ? layer(i, q, pxl) : vec4(0.);
      Lc.a *= inside;
      float edge = exp(-pow(sd / (pxl * 1.4 + .9), 2.)) * smoothstep(0., .3, uStack);
      Lc.rgb = mix(Lc.rgb, SPROUT * 1.15, edge); Lc.a = max(Lc.a, edge * .95);
      acc.rgb += (1. - acc.a) * Lc.rgb * Lc.a; acc.a += (1. - acc.a) * Lc.a;
    }
    col = acc.rgb + (1. - acc.a) * col;
  }

  // clouds: five lit slices through a slab between 1.5 and 2.3 km
  if (uCloud > .001 && uAlt > 1500.){
    float Hb = 1500., Ht = 2300., T = 1.; vec3 acc = vec3(0.); float tFirst = -1., ck = -1., above = 0.;
    for (int i = 0; i < 5 * uN; i++){
      float hh = 1. - (float(i) + .5) / 5., Hs = Hb + hh * (Ht - Hb);
      if (uAlt < Hs) continue;
      float dS = b * b - (cc - 2. * R * Hs - Hs * Hs);
      if (dS < 0.) continue;
      float t = -b - sqrt(dS);
      if (t < 0. || t > tEnd) continue;
      if (tFirst < 0.) tFirst = t;
      vec3 X = ro + rd * t;
      float pxc = t * pa;
      if (ck < 0.) ck = cloudK(X.xy);
      float cv = cov(X.xy, pxc, 4, ck);
      float d = cv * smoothstep(cv * .95 + .08, cv * .45, hh) * smoothstep(0., .2, hh + .1);
      float light = exp(-above * 2.4) * (.55 + .45 * hh);
      above += d;
      if (d > .01){
        vec3 cl = mix(vec3(.30, .35, .44), vec3(1.06, 1.03, .98), light) * (.82 + .3 * hh);
        float a = clamp(d * 1.25, 0., .92);
        acc += T * a * cl; T *= 1. - a;
        if (T < .03) break;
      }
    }
    if (tFirst > 0.){
      vec3 X0 = ro + rd * tFirst; vec3 N0 = normalize(vec3(X0.xy, X0.z + R));
      float Tc = exp(-8000. * (1. - exp(-max(uAlt - Hb, 0.) / 8000.)) / (34000. * max(dot(-rd, N0), .03)));
      acc = acc * Tc + haze(uAlt, 1.) * (1. - Tc) * (1. - T);
      col = col * T + acc;
    }
  }
#endif
  col *= uExpo * (1. - uDim);
  col = col / (1. + col * .18) * 1.12;
  col += (h21(gl_FragCoord.xy + fract(uTime)) - .5) / 255.;
  o = vec4(col, 1.);
}`;
