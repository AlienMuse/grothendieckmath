// grothendieckmath.com — the hero: black glass, the portrait engraved in light, the rising sea.
// One full-screen shader (Three.js). The portrait is the cover's (master/covers/noir): horizontal lines whose width
// follows the tone of the photograph (the field is baked by site/tools/assets.py from the same engraving code), lit
// against black, dissolving below the chest. On arrival the engraving is cut in light from the top down, line by line,
// while the sea comes in from the foot of the screen; the scroll then raises it to the neck.
// The sea is black glass in perspective: ten swells summed with their exact slopes, each fading out when it falls
// below a pixel, its lost slope given to the roughness (so the far water is a mirror and the near water sparkles,
// with no aliasing). Fresnel mixes the dark body of the glass with the reflection of the scene — the engraving itself,
// its lines broken by the waves — and the key light behind the head lays a path of glints towards the viewer. Along
// the horizon the bevel of the glass catches the light. Text is HTML, never GL.
import * as THREE from './three.module.js';

const VERT = /* glsl */`
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uField;      // R tone, G relief, B figure
uniform vec2 uRes;             // device pixels
uniform vec4 uRect;            // portrait: x0, y0, w, h (device px, top-left origin)
uniform float uPitch;          // line pitch (device px)
uniform float uSea;            // the sea's horizon (device px from the top)
uniform vec2 uDissolve;        // the figure dissolves between these heights (device px)
uniform float uTime;
uniform float uReveal;         // 0 → 1: the engraving is cut from the top down
uniform float uFade;           // 0 → 1: the glass lights up
uniform float uDpr;
uniform float uScroll;         // 0 → 1 through the hero: the sea grows livelier as it rises
uniform vec2 uPointer;         // -1 … 1, eased: the key light follows the pointer a little

const float PI = 3.14159265;
const int NW = 10;
// swells: direction (radians from the line of sight), wavelength (camera heights), steepness, phase
const vec4 W[NW] = vec4[NW](
  vec4( 0.00, 9.00, 0.100, 0.0), vec4( 0.62, 5.30, 0.090, 1.7), vec4(-0.48, 3.10, 0.085, 4.1),
  vec4( 1.08, 1.90, 0.080, 2.3), vec4(-1.02, 1.15, 0.070, 5.6), vec4( 0.31, 0.71, 0.060, 0.9),
  vec4(-0.27, 0.43, 0.052, 3.3), vec4( 1.37, 0.27, 0.046, 6.0), vec4(-1.31, 0.17, 0.040, 1.2),
  vec4( 0.83, 0.11, 0.034, 4.7));

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

float band(float y, float c, float t) {                  // anti-aliased coverage of a line of width t at c
  return clamp(0.5 * t - abs(y - c) + 0.5, 0.0, 1.0);
}

vec2 head() { return vec2(uRect.x + 0.52 * uRect.z, uRect.y + 0.24 * uRect.w); }

vec3 glass(vec2 p) {
  vec2 uv = p / uRes;
  vec3 c = vec3(0.020, 0.021, 0.026);
  float d = length((p - head()) / vec2(max(uRes.x * 0.48, uRect.z * 0.9), uRes.y * 0.62));
  float key = exp(-d * d * 2.4) * 0.070;                                 // the key light behind the head
  float top = exp(-pow((uv.y - 0.05) / 0.16, 2.0)) * 0.020;              // a broad soft light in the upper surface
  float dd = uv.x * 0.53 + uv.y * 0.85;
  float sheen = exp(-pow((dd - 0.42 - 0.04 * sin(uTime * 0.05)) / 0.20, 2.0)) * 0.014;
  c += vec3(0.94, 0.98, 1.06) * (key + top + sheen);
  float vig = 1.0 - smoothstep(0.35, 1.25, length((uv - vec2(0.5, 0.45)) * vec2(1.0, 1.15)));
  return c * (0.55 + 0.45 * vig);
}

// the engraving at p: the exact line (blur 0) or its mean tone (blur 1, for broken reflections). x: coverage,
// y: the heat of a line just cut (it cools from bright to silver)
vec2 engraving(vec2 p, float blur) {
  float k = floor((p.y - uRect.y) / uPitch);
  float yc = uRect.y + (k + 0.5) * uPitch;
  float ys = mix(yc, p.y, blur);
  vec2 uv = vec2((p.x - uRect.x) / uRect.z, (ys - uRect.y) / uRect.w);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec2(0.0);
  vec3 s = texture2D(uField, uv).rgb;
  float yl = yc - 0.66 * uPitch * (s.g - 0.5);           // the line bends with the relief of the face
  float f = 1.0 - smoothstep(uDissolve.x, uDissolve.y, ys);
  float t = 0.70 * uPitch * pow(s.r, 0.92) * (0.45 + 0.55 * f);
  float tone = smoothstep(0.04 * uPitch, 0.20 * uPitch, t);            // no hairline where there is no tone
  float a = mix(band(p.y, yl, t), min(t / uPitch, 1.0), blur) * tone * pow(f, 1.3);
  // the cut: a front descends the portrait; each line grows from the axis outwards as the front passes it
  float front = uRect.y + (uReveal * 1.18 - 0.08) * uRect.w * 0.86;
  float local = clamp((front - ys) / (0.13 * uRect.w), 0.0, 1.0);
  float reach = 0.78 * (1.0 - pow(1.0 - local, 3.0));
  float grow = 1.0 - smoothstep(reach - 0.05, reach, abs(uv.x - 0.52));
  return vec2(a * grow, local * (1.0 - local) * 4.0 * grow);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 ink = vec3(0.961, 0.961, 0.969);
  float sea = uSea;
  vec2 hd = head();

  // ---- above: the glass and the engraving, a slow light passing over it as over cut metal
  vec2 uvr = (p - uRect.xy) / uRect.zw;
  float sp = fract(uTime / 14.0) * 2.4 - 0.6;
  float sweep = 0.82 + 0.38 * exp(-pow((uvr.x * 0.8 + uvr.y * 0.45 - sp) / 0.16, 2.0));
  vec2 e = engraving(p, 0.0);
  vec3 above = glass(p) * uFade;
  above = mix(above, ink, clamp(e.x * sweep * (1.0 + 0.55 * e.y), 0.0, 1.0));
  above += vec3(0.80, 0.88, 1.0) * e.x * e.y * 0.35;                    // the heat of the cut
  above += vec3(exp(-(sea - p.y) / (uPitch * 4.0)) * 0.05) * uFade;      // the haze lying on the water

  // ---- below: the sea, a plane one camera height down, seen in perspective (computed everywhere: derivatives)
  float f = uRes.y * 1.05;                                               // focal length (device px)
  float cx = uRes.x * 0.5;
  float dy = max(p.y - sea, 0.35);
  vec3 v = normalize(vec3((p.x - cx) / f, -dy / f, 1.0));                // the ray from the eye
  float Z = f / dy;                                                      // distance along the sea
  vec2 P = vec2((p.x - cx) / f * Z, Z);
  vec2 foot = vec2(Z / f, Z * Z / f);                                    // a pixel's footprint on the sea
  float chop = 0.62 + 0.45 * uScroll;
  vec2 g = vec2(0.0);
  float lost = 0.0;
  for (int i = 0; i < NW; i++) {
    vec4 w = W[i];
    vec2 dir = vec2(sin(w.x), -cos(w.x));
    float k = 2.0 * PI / w.y;
    float om = sqrt(9.8 * k) * 0.42;
    float st = w.z * chop;
    float px = length(dir * foot);                                       // the footprint along the swell
    float keep = smoothstep(2.0 * px, 6.0 * px, w.y);
    g += st * keep * cos(k * dot(dir, P) - om * uTime + w.w) * dir;
    lost += (1.0 - keep * keep) * st * st * 0.5;
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  float sigma2 = 0.0016 + lost;                                          // roughness: the glass and the lost swells

  // Fresnel (glass, F0 = 0.04) between the body and the reflection of the scene
  float cv = clamp(dot(n, -v), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - cv, 5.0);
  vec3 r = reflect(v, n);
  r.y = max(r.y, 0.002); r.z = max(r.z, 0.05);
  vec2 pr = vec2(cx + f * r.x / r.z, sea - f * r.y / r.z);               // where the reflected ray meets the scene
  float blur = smoothstep(0.55, 1.6, length(fwidth(pr)) / uPitch);       // broken lines read as their tone
  vec2 er = engraving(pr, blur);
  vec3 sky = mix(glass(pr) * uFade, ink, clamp(er.x * 0.92, 0.0, 1.0));
  sky += vec3(exp(-(sea - pr.y) / (uPitch * 4.0)) * 0.05
             + exp(-(sea - pr.y) / (uRes.y * 0.09)) * 0.028) * uFade;       // the haze over the horizon: the swells show in it
  vec3 body = vec3(0.006, 0.007, 0.009) + vec3(0.010, 0.012, 0.016) * exp(-dy / (uRes.y * 0.10));
  vec3 below = mix(body, sky, F);

  // the key light behind the head: its path of glints (Beckmann), smooth far off, sparkling near
  vec3 L = normalize(vec3((hd.x - cx) / f + 0.05 * uPointer.x, 0.15 - 0.03 * uPointer.y, 1.0));
  vec3 h = normalize(L - v);
  float ch = max(dot(n, h), 1e-3);
  float t2 = (1.0 - ch * ch) / (ch * ch);
  float D = exp(-t2 / sigma2) / (PI * sigma2 * ch * ch * ch * ch);
  float Fh = 0.04 + 0.96 * pow(1.0 - clamp(dot(h, -v), 0.0, 1.0), 5.0);
  float spec = D * Fh * 0.0021 / max(cv, 0.08);
  float lane = exp(-pow((p.x - hd.x) / (uRes.x * 0.24), 2.0));          // the light is a lamp, not the sun
  below += vec3(0.93, 0.96, 1.0) * (1.0 - exp(-spec * (0.25 + 0.75 * lane))) * 0.85 * uFade;

  // the horizon: the bevel of the glass, brightest under the light, a glint travelling along it
  float bev = exp(-abs(p.y - sea) / (0.65 * uDpr));
  float run = exp(-pow((p.x / uRes.x - fract(uTime / 11.0) * 1.6 + 0.3) / 0.06, 2.0));
  float edge = bev * (0.30 + 0.42 * exp(-pow((p.x - hd.x) / (uRes.x * 0.38), 2.0)) + 0.28 * run) * uFade;

  vec3 col = p.y < sea ? above : below;
  col = mix(col, ink, clamp(edge, 0.0, 1.0));
  col += (hash(p + fract(uTime)) - 0.5) / 255.0;                         // dither: no banding in the dark
  gl_FragColor = vec4(col, 1.0);
}`;

const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export class Hero {
  constructor(stage, opts = {}) {
    this.stage = stage;
    this.opts = opts;
    this.canvas = stage.querySelector('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false,
                                              powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tex = new THREE.TextureLoader().load(stage.dataset.field, () => this.ready());
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;                               // the field is sampled top-down, as the photograph
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    this.u = {
      uField: { value: tex }, uRes: { value: new THREE.Vector2() }, uRect: { value: new THREE.Vector4() },
      uPitch: { value: 3 }, uSea: { value: 0 }, uDissolve: { value: new THREE.Vector2() }, uTime: { value: 0 },
      uReveal: { value: 0 }, uFade: { value: 0 }, uDpr: { value: 1 }, uScroll: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u,
                                           depthTest: false, depthWrite: false });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    if (!opts.reduced && matchMedia('(pointer: fine)').matches) {
      addEventListener('pointermove', (e) => {
        this.pointer.tx = (e.clientX / innerWidth) * 2 - 1;
        this.pointer.ty = (e.clientY / innerHeight) * 2 - 1;
      }, { passive: true });
    }
    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    this.resize();
    if (document.fonts) document.fonts.ready.then(this.resize);   // the title's height sets the portrait
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  ready() {
    this.loaded = true;
    this.t0 = performance.now();                     // the film starts when the engraving is there to be cut
    this.stage.classList.add('gl-ready');
  }

  layout() {
    // the portrait below the title (Apple's order: the words, then the object), its chest — the cover's glass
    // edge — at 95 % of the screen; never wider than 1.3 screens (narrow screens crop the shoulders, not the head)
    const r = this.stage.getBoundingClientRect();
    const vw = r.width, vh = this.stage.clientHeight || innerHeight;
    const aspect = 268 / 326;
    // a fixed composition (the repository's banner and social image, site/tools/banner.py): the portrait's centre
    // and height as fractions of the stage; the site itself never sets it
    const P = this.opts.portrait;
    if (P) {
      const ph = vh * P.h, pw = ph * aspect;
      return { vw, vh, x0: vw * P.x - pw / 2, y0: vh * P.y, pw, ph };
    }
    const copy = this.stage.querySelector('.hero-copy');
    const top = copy ? copy.offsetTop + copy.offsetHeight + vh * 0.02 : vh * 0.4;
    // the head (6 % → 45 % of the photograph) fills the screen below the title; the chest (62 %) at the foot
    let ph = Math.min((vh * 0.885 - top) / 0.56, (vw * 1.3) / aspect);
    ph = Math.max(ph, vh * 0.45);
    const pw = ph * aspect;
    const y0 = top - 0.06 * ph;
    const x0 = (vw - pw) / 2 - 0.02 * pw;          // the face, not the box, on the axis of the title
    return { vw, vh, x0, y0, pw, ph };
  }

  resize() {
    const dpr = this.renderer.getPixelRatio();
    const L = this.layout();
    this.L = L;
    this.renderer.setSize(L.vw, L.vh, false);
    this.u.uRes.value.set(L.vw * dpr, L.vh * dpr);
    this.u.uRect.value.set(L.x0 * dpr, L.y0 * dpr, L.pw * dpr, L.ph * dpr);
    const lines = this.opts.portrait && this.opts.portrait.lines;      // the banner's fewer, wider lines read when GitHub shrinks it
    this.u.uPitch.value = lines ? (L.ph * dpr) / lines : Math.max(2.6 * dpr, (L.ph * dpr) / 250);
    this.u.uDissolve.value.set((L.y0 + 0.44 * L.ph) * dpr, (L.y0 + 0.80 * L.ph) * dpr);
    this.u.uDpr.value = dpr;
  }

  seaLevel(el) {
    // arrival: the sea comes in from below the screen to the chest, as on the cover (0.5 → 3.9 s);
    // then the scroll raises it to the neck
    const L = this.L;
    const fixed = this.opts.fixed || {};
    const a = fixed.sea != null || this.opts.reduced ? 1 : easeOut(clamp01((el - 500) / 3400));
    const host = this.stage.closest('.hero');
    let s = 0;
    if (fixed.sea != null) s = fixed.sea;
    else if (host) {
      const r = host.getBoundingClientRect();
      s = clamp01(-r.top / Math.max(1, r.height - innerHeight));
    }
    const P = this.opts.portrait;
    const start = L.vh * 1.04, high = L.y0 + 0.48 * L.ph;
    const rest = P && P.sea != null ? L.vh * P.sea : Math.min(L.y0 + 0.62 * L.ph, L.vh * 0.90);
    const arrived = start + (rest - start) * a;
    this.scroll = s;
    return arrived + (high - arrived) * easeInOut(s);
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    if (!this.loaded) return;
    const fixed = this.opts.fixed || {};
    const still = this.opts.reduced || fixed.sea != null;
    const el = now - this.t0;                        // the film's clock (ms)
    const t = fixed.t != null ? fixed.t : (this.opts.reduced ? 6 : 6 + el / 1000);
    const dpr = this.renderer.getPixelRatio();
    const P = this.pointer;
    P.x += (P.tx - P.x) * 0.04; P.y += (P.ty - P.y) * 0.04;
    this.u.uTime.value = t;
    this.u.uSea.value = this.seaLevel(el) * dpr;
    this.u.uScroll.value = this.scroll;
    this.u.uFade.value = still ? 1 : easeOut(clamp01(el / 1600));
    this.u.uReveal.value = still ? 1 : easeInOut(clamp01((el - 350) / 2900));
    this.u.uPointer.value.set(P.x, P.y);
    this.renderer.render(this.scene, this.camera);
  }
}
