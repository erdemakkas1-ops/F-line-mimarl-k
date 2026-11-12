/* F LINE — scroll-driven photographic stage (depth-based parallax on still photographs), design studio and page interactions.
   No dependencies. The stage is NOT a 3D walkthrough: each chapter is one photograph; a depth map estimated from that
   photograph lets a virtual camera move a little inside it, and chapters change with hard-edged "line" transitions. */
(() => {
'use strict';
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const root = document.documentElement; root.classList.add('js');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, coarse = matchMedia('(pointer: coarse)').matches;
const still = /[?&]still\b/.test(location.search);            // test hook: no smoothing, no quality adaptation
const track = $('#track'), stage = $('#stage'), pic = $('#pic'), cv = $('#gl'), chap = $('#chap'), bar = $('#bar');

/* ---------- chapters (all coordinates are image uv, origin top-left) ---------- */
const AI = 2752 / 1536, N = 8, TW = 0.024, B = 0.12;
const NAMES = ['Dış cephe', 'Yaklaşım', 'Giriş', 'Salon', 'Galeri', 'Yatak odası', 'Mühendislik', 'Bütün'];
// fx: framing centre across the chapter (matters when the screen is narrower than the photo), dz: dolly, sx: truck, tg: dolly target
const S = [
  { fx: [.33, .52], dz: [0, .11], sx: [-.005, .005], tg: [.40, .47] },
  { fx: [.44, .50], dz: [0, .13], sx: [.004, -.002], tg: [.50, .57] },
  { fx: [.50, .50], dz: [0, .12], sx: [0, 0], tg: [.505, .55] },
  { fx: [.62, .26], dz: [0, .09], sx: [.006, -.008], tg: [.30, .50] },
  { fx: [.34, .64], dz: [0, .12], sx: [-.004, .008], tg: [.64, .48] },
  { fx: [.44, .60], dz: [0, .10], sx: [-.006, .006], tg: [.50, .62] },
  { fx: [.36, .50], dz: [.02, .10], sx: [-.006, .006], tg: [.42, .42] },
  { fx: [.44, .44], dz: [.10, 0], sx: [.005, -.005], tg: [.42, .45] }
];
// transition into chapter i. 0/1: line sweeps right/left (change of place), 2/3: line sweeps down/up (change of level),
// 4: two lines open from an axis, 5: an opening grows from a doorway (entering)
const TR = [null, { t: 0 }, { t: 4, at: [.5, .57] }, { t: 5, at: [.505, .54], h: [.075, .28] }, { t: 2 }, { t: 5, at: [.64, .48], h: [.07, .12] }, { t: 0 }, { t: 3 }];
/* ---------- film segments ----------
   Camera moves generated with Higgsfield from the chapter photographs (AI video, not geometry), shipped as pre-extracted
   WebP frame sequences. The scroll position selects the frame: nothing plays on a clock, scrolling back runs the move
   backwards, stopping holds it. Each move starts and ends on the photograph it was generated from (registered to <1 px,
   colour-matched at export), so a photo <-> film handoff is a cut between identical images while the photo camera is at
   rest. Where a source video broke (02: camera passes through the stair treads; 03: the bedroom duplicates) the broken
   middle is left out and the two halves are joined by a line / doorway mask, never presented as one continuous shot. */
const FILMS = [
  { dir: 'a/v/1/', n: 150, fx: [.50, .50], cap: [1, 2] },          // approach -> entrance
  { dir: 'a/v/2a/', n: 63, fx: [.26, .30], cap: [3, 4] },          // living room -> foot of the stair
  { dir: 'a/v/2b/', n: 21, fx: [.42, .34], cap: [4, 4] },          // arrival on the upper gallery
  { dir: 'a/v/3a/', n: 44, fx: [.64, .655], cap: [4, 5] },         // gallery walk towards the bedroom
  { dir: 'a/v/3b/', n: 34, fx: [.45, .44], cap: [5, 5] }           // bedroom doorway -> bedroom
];
// photo cameras that hand over to / take over from a film: at rest (no dolly, no truck, no pointer) on the film side
const SF = { 1: { fx: [.44, .50], dz: [0, 0], sx: [.008, 0], tg: [.50, .57] }, 3: { fx: [.62, .26], dz: [0, 0], sx: [.008, 0], tg: [.30, .50] },
  4: { fx: [.34, .64], dz: [0, 0], sx: [0, 0], sw: .006, tg: [.64, .48] }, 5: { fx: [.44, .60], dz: [0, .10], sx: [0, .008], tg: [.50, .62] } };
const NOTES = [[.308, .271, 'Taş kaplama · taşıyıcı profil · ısı yalıtımı', 'Cephe kuruluşu', 1], [.354, .315, 'Betonarme kolon', 'Kolon', 0],
  [.400, .454, 'Betonarme döşeme ve donatı', 'Döşeme · donatı', 0], [.419, .150, 'Çatı döşemesi', 'Çatı döşemesi', 0], [.666, .241, 'Çatı yalıtımı', 'Çatı yalıtımı', 0]];

/* ---------- WebGL: one full-screen pass; per pixel a short ray-march through the depth map ---------- */
const STEPS = coarse ? 18 : 28;
const VS = 'attribute vec2 a;varying vec2 p;void main(){p=vec2(a.x,-a.y);gl_Position=vec4(a,0.,1.);}';
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 p;
uniform sampler2D c0,d0,c1,d1;
uniform vec4 F0,F1,M0,M1,W,Q;
uniform vec2 Z0,Z1,R;
uniform vec3 L;
uniform float P;
const float B=${B.toFixed(2)};
vec2 warp(sampler2D d,vec4 F,vec4 M,vec2 Zt){
  vec2 b=F.xy+p*F.zw,D=M.xy+M.z*(Zt-b);
  float t=1.,pt=1.,ph=B+(1.-B)*texture2D(d,b+D).r;
  for(int i=0;i<${STEPS};i++){
    t-=${(1 / STEPS).toFixed(5)};
    float h=B+(1.-B)*texture2D(d,b+t*D).r;
    if(h>=t){float f0=ph-pt,f1=h-t;t=pt+(t-pt)*(-f0)/max(f1-f0,1e-5);break;}
    pt=t;ph=h;
  }
  return b+max(t,0.)*D;
}
float edge(){
  float k=W.x,T=W.y;vec2 r=R*.5;
  if(k<.5)return(mix(-1.03,1.03,T)-p.x)*r.x;
  if(k<1.5)return(p.x-mix(1.03,-1.03,T))*r.x;
  if(k<2.5)return(mix(-1.03,1.03,T)-p.y)*r.y;
  if(k<3.5)return(p.y-mix(1.03,-1.03,T))*r.y;
  vec2 q=(Q.zw-abs(p-Q.xy))*r;
  return k<4.5?q.x:min(q.x,q.y);
}
void main(){
  vec3 col=texture2D(c0,warp(d0,F0,M0,Z0)).rgb;
  if(W.w>.5){
    vec3 cb=texture2D(c1,warp(d1,F1,M1,Z1)).rgb;float e=edge();
    col=mix(col,cb,step(0.,e));
    col=mix(col,L,W.z*(1.-smoothstep(.5*P,1.5*P,abs(e))));
  }
  gl_FragColor=vec4(col,1.);
}`;
let gl = null, flat = null, U = {}, dpr = Math.min(window.devicePixelRatio || 1, 2), port = false, dirty = true, shown = false, useBig = false;
const tex = [], dep = [], cpu = [], ok = new Array(N).fill(false), req = new Array(N).fill(null);
function initGL() {
  try { gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
  if (!gl) return false;
  try {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ['c0', 'd0', 'c1', 'd1', 'F0', 'F1', 'M0', 'M1', 'Z0', 'Z1', 'W', 'Q', 'R', 'L', 'P'].forEach(n => { U[n] = gl.getUniformLocation(pr, n); });
    gl.uniform1i(U.c0, 0); gl.uniform1i(U.d0, 1); gl.uniform1i(U.c1, 2); gl.uniform1i(U.d1, 3); gl.uniform3f(U.L, .96, .94, .89);
    gl.activeTexture(gl.TEXTURE4); flat = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, flat);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    useBig = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 2752 && Math.max(pic.clientWidth, pic.clientHeight * AI) * dpr > 2000;
  } catch (e) { console.error(e); gl = null; return false; }
  return true;
}
const image = (url) => window.createImageBitmap
  ? fetch(url).then(r => { if (!r.ok) throw new Error(url); return r.blob(); }).then(b => createImageBitmap(b))
  : new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
function mkTex(src, fmt) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, src); return t;
}
function loadScene(i) {
  if (req[i]) return req[i];
  return req[i] = Promise.all([image('a/s' + (i + 1) + (useBig ? '' : '-1920') + '.webp'), image('a/d' + (i + 1) + '.png')]).then(([c, d]) => {
    if (!gl) return;
    tex[i] = mkTex(c, gl.RGB); dep[i] = mkTex(d, gl.LUMINANCE);
    const k = document.createElement('canvas'); k.width = 160; k.height = 90; const g = k.getContext('2d'); g.drawImage(d, 0, 0, 160, 90); cpu[i] = g.getImageData(0, 0, 160, 90).data;
    if (c.close) { c.close(); d.close(); }
    ok[i] = true; dirty = true;
  }).catch(() => { req[i] = null; });
}
function queue() {                                              // load outward from the chapter on screen, one at a time per chain
  const c = curPhoto(); let best = -1;
  for (let i = 0; i < N; i++) if (!req[i] && (best < 0 || Math.abs(i - c) < Math.abs(best - c))) best = i;
  if (best >= 0) loadScene(best).then(queue);
}

/* ---------- timeline: photo chapters and film segments laid along the scroll track ---------- */
// g.p: photo chapter, g.f: film; g.tr: masked transition into this segment (none = cut on identical images); w: scroll length
let FILM = false, SEG = [], WT = N, tw = TW;
function buildTL() {
  const L = FILM ? [{ p: 0, w: 1 }, { p: 1, w: .8, tr: TR[1] }, { f: 0, w: 1.6 }, { p: 2, w: 1 }, { p: 3, w: 1, tr: TR[3] }, { f: 1, w: .9 },
    { f: 2, w: .4, tr: { t: 3 } }, { p: 4, w: .8 }, { f: 3, w: .7 }, { f: 4, w: .55, tr: { t: 5, at: [.655, .45], h: [.075, .17] } },
    { p: 5, w: 1 }, { p: 6, w: 1, tr: TR[6] }, { p: 7, w: 1, tr: TR[7] }]
    : NAMES.map((n, i) => ({ p: i, w: 1, tr: TR[i] }));
  WT = L.reduce((a, g) => a + g.w, 0); tw = TW * N / WT;          // a transition takes the same scroll distance as before
  let s = 0;
  SEG = L.map((g, j) => { const o = Object.assign({}, g); o.s = s / WT; s += g.w; o.e = s / WT;
    o.cam = g.f != null ? FILMS[g.f] : (FILM && SF[g.p]) || S[g.p];
    o.pinS = j > 0 && !g.tr; o.pinE = j < L.length - 1 && !L[j + 1].tr;
    o.pL = o.pinS ? 0 : tw; o.pR = o.pinE ? 0 : tw; if (g.f != null) FILMS[g.f].seg = j; return o; });
  if (FILM) track.style.height = 'calc(100' + U1 + ' + ' + (95 * WT).toFixed(2) + U1 + ')';
}
const U1 = window.CSS && CSS.supports && CSS.supports('height', '1svh') ? 'svh' : 'vh';
const segAt = (t) => { let j = 0; while (j < SEG.length - 1 && t >= SEG[j + 1].s) j++; return j; };
const kAt = (j, t) => { const g = SEG[j]; return clamp((t - (g.s - g.pL)) / (g.e - g.s + g.pL + g.pR), 0, 1); };
const capOf = (j, t) => SEG[j].p != null ? SEG[j].p : FILMS[SEG[j].f].cap[kAt(j, t) < .5 ? 0 : 1];
const curPhoto = () => capOf(segAt(cur), cur);

/* ---------- film frames: fetched as compressed blobs around the playhead, decoded only next to it ---------- */
// Coarse-to-fine fetch order (both ends, then every 16th, 8th ... frame) so a fast scroll always finds a near frame.
// Decoded bitmaps are capped per film and released when the film leaves the screen; blobs are dropped far away.
// 854 px frames on touch devices, on small windows and on slow links; 1284 px (the clips' native size) otherwise
const net = navigator.connection || {}, slowNet = /(^|-)2g$/.test(net.effectiveType || ''), FW = coarse || net.effectiveType === '3g' || Math.max(pic.clientWidth, pic.clientHeight * AI) * dpr < 1100 ? 854 : 1284, BCAP = coarse ? 6 : 10, LOOK = 1.6, FAR = 4.5;
const FL = FILMS.map(f => { const o = [0, f.n - 1], h = new Set(o); [16, 8, 4, 2, 1].forEach(st => { for (let i = 0; i < f.n; i += st) if (!h.has(i)) { h.add(i); o.push(i); } });
  return { blob: [], req: [], bmp: new Map(), dec: new Set(), ord: o, oi: 0, tex: null, shown: -1, want: 0, on: -1, gen: 0, fail: 0 }; });
let inflight = 0, decoding = 0, drawN = 0, dir = 1, gap = 0;
const stat = { ff: 0, lag: 0, lagMax: 0, hold: 0, blank: 0 };    // film frames drawn, frames away from the wanted one, photo holds, draws with nothing
const fdist = (fi) => { const g = SEG[FILMS[fi].seg], s = g.s - g.pL, e = g.e + g.pR; return (cur < s ? s - cur : cur > e ? cur - e : 0) * WT; };   // in chapter units, 0 while the film can be on screen
const fidx = (fi) => Math.round(kAt(FILMS[fi].seg, cur) * (FILMS[fi].n - 1));
function fetchFrame(fi, i) {
  const F = FL[fi], g = F.gen; F.req[i] = 1; inflight++;
  fetch(FILMS[fi].dir + FW + '/' + ('00' + i).slice(-3) + '.webp', { priority: 'low' }).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(b => { if (F.gen === g) F.blob[i] = b; }, () => { if (F.gen === g) { F.req[i] = 0; F.fail++; } })
    .then(() => { inflight--; pump(); });
}
function decodeFrame(fi, i) {
  const F = FL[fi], g = F.gen, b = F.blob[i]; F.dec.add(i); decoding++;
  (window.createImageBitmap ? createImageBitmap(b) : new Promise((res, rej) => { const m = new Image(), u = URL.createObjectURL(b); m.onload = () => { URL.revokeObjectURL(u); res(m); }; m.onerror = rej; m.src = u; }))
    .then(bm => { if (F.gen === g && !F.bmp.has(i)) { F.bmp.set(i, bm); dirty = true; } else if (bm.close) bm.close(); }, () => {})
    .then(() => { F.dec.delete(i); decoding--; trim(F); pump(); });
}
function trim(F) {                                              // keep the bitmaps nearest the wanted frame
  while (F.bmp.size > BCAP) { let far = -1; F.bmp.forEach((m, i) => { if (i !== F.shown && (far < 0 || Math.abs(i - F.want) > Math.abs(far - F.want))) far = i; });
    if (far < 0) break; const m = F.bmp.get(far); if (m.close) m.close(); F.bmp.delete(far); }
}
function release(F, blobs) {
  F.bmp.forEach(m => { if (m.close) m.close(); }); F.bmp.clear(); F.shown = -1;        // the texture keeps its pixels
  if (blobs) { F.gen++; F.blob = []; F.req = []; F.oi = 0; F.fail = 0; }
}
function nextFetch() {
  if (!ok[curPhoto()] || Math.abs(gap) * WT > 1.2) return null;   // the photograph on screen comes first; nothing while a jump (menu, chapter button) flies past
  let best = null, bd = LOOK;
  FL.forEach((F, fi) => { const d = fdist(fi); if (d < bd && F.fail < 12) {
    const n = FILMS[fi].n; let pick = -1;
    if (d === 0) {                                                 // on screen: coarse pass first, then outward from the playhead, ahead first
      while (F.oi < n && (F.req[F.ord[F.oi]] || F.blob[F.ord[F.oi]])) F.oi++;
      if (F.oi < n && F.ord[F.oi] % 8 === 0) pick = F.ord[F.oi];
      else { const c = fidx(fi); for (let s = 0; s < n && pick < 0; s++) for (const i of [c + dir * s, c - dir * s]) if (i >= 0 && i < n && !F.req[i] && !F.blob[i]) { pick = i; break; } }
    } else { while (F.oi < n && (F.req[F.ord[F.oi]] || F.blob[F.ord[F.oi]])) F.oi++; if (F.oi < n) pick = F.ord[F.oi]; }
    if (pick >= 0) { best = [fi, pick]; bd = d; } } });
  return best;
}
function nextDecode() {
  for (let fi = 0; fi < FL.length; fi++) {
    const F = FL[fi], n = FILMS[fi].n, d = fdist(fi); if (d > .6) continue;
    const g = SEG[FILMS[fi].seg], c = d === 0 ? fidx(fi) : (cur < g.s ? 0 : n - 1); F.want = c;
    const dd = d === 0 ? dir : (c === 0 ? 1 : -1);
    for (let s = 0; s < BCAP - 2; s++) for (const i of s ? [c + dd * s, c - dd * Math.ceil(s / 3)] : [c]) {
      if (i < 0 || i >= n || F.bmp.has(i) || F.dec.has(i)) continue;
      if (F.blob[i]) return [fi, i];
      if (s === 0) { let nb = -1; F.blob.forEach((b, k) => { if (b && (nb < 0 || Math.abs(k - c) < Math.abs(nb - c))) nb = k; });   // nearest fetched frame meanwhile
        if (nb >= 0 && !F.bmp.has(nb) && !F.dec.has(nb)) return [fi, nb]; }
    }
  }
  return null;
}
function pump() {
  if (!FILM) return;
  FL.forEach((F, fi) => { const d = fdist(fi); if (d > FAR && F.blob.length) release(F, true); else if (d > .6 && F.bmp.size && F.on !== drawN) release(F, false); });
  for (let x; inflight < 4 && (x = nextFetch());) fetchFrame(x[0], x[1]);
  for (let x; decoding < 2 && (x = nextDecode());) decodeFrame(x[0], x[1]);
}
function filmTex(fi, k) {                                          // texture of the frame for scroll progress k (or the nearest decoded one)
  const F = FL[fi], idx = Math.round(clamp(k, 0, 1) * (FILMS[fi].n - 1)); F.want = idx; F.on = drawN;
  let best = -1; F.bmp.forEach((m, i) => { if (best < 0 || Math.abs(i - idx) < Math.abs(best - idx)) best = i; });
  if (best < 0) { stat.hold++; return null; }
  const lag = Math.abs(best - idx); stat.ff++; stat.lag += lag; if (lag > stat.lagMax) stat.lagMax = lag;
  const m = F.bmp.get(best);
  if (!F.tex) { F.tex = mkTex(m, gl.RGB); F.shown = best; }
  else if (F.shown !== best) { gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, F.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, m); F.shown = best; }
  return F.tex;
}
const depthAt = (i, u, v) => { const d = cpu[i]; return d ? B + (1 - B) * d[(clamp(Math.round(v * 89), 0, 89) * 160 + clamp(Math.round(u * 159), 0, 159)) * 4] / 255 : .4; };

/* ---------- camera ---------- */
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
if (!coarse && !reduce) addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
function frame(j, k, av) {
  const g = SEG[j], s = g.cam, mU = .02, mV = .012, amp = reduce ? 0 : 1;
  let hv = .5, hu = .5 * av / AI; if (hu > .5) { hu = .5; hv = .5 * AI / av; }
  const sc = Math.max(hu / (.5 - mU), hv / (.5 - mV), 1); hu /= sc; hv /= sc;      // keep a thin margin so the parallax never samples outside the photo
  const cx = clamp(lerp(s.fx[0], s.fx[1], k), hu + mU, 1 - hu - mU);
  if (g.f != null) return { cx, cy: .5, hu, hv, mx: 0, my: 0, dz: 0, zx: .5, zy: .5 };       // film frame: framing only, no parallax
  const pin = (g.pinS ? ss(0, .15, k) : 1) * (g.pinE ? 1 - ss(.85, 1, k) : 1);              // camera comes to rest where a film takes over
  return { cx, cy: .5, hu, hv, mx: (lerp(s.sx[0], s.sx[1], k) + (s.sw || 0) * Math.sin(Math.PI * k) + ptr.x * .005 * pin) * amp, my: ptr.y * .003 * pin * amp,
    dz: lerp(s.dz[0], s.dz[1], k) * amp, zx: s.tg[0], zy: s.tg[1] };
}
// where a point of the photo (uv, disparity w) lands on screen, in [-1,1]
const project = (f, u, v, w) => { const q = 1 - w * f.dz; return [((u - w * (f.mx + f.dz * f.zx)) / q - f.cx) / f.hu, ((v - w * (f.my + f.dz * f.zy)) / q - f.cy) / f.hv]; };

/* ---------- HUD ---------- */
const caps = $$('.cap'), chapEls = NAMES.map((n, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mono'; b.textContent = n; b.setAttribute('aria-label', (i + 1) + '. bölüm: ' + n); b.onclick = () => go(i); chap.appendChild(b); return b; });
const noteW = [0, 0, 0, 0, 0], noteEls = NOTES.map(n => { const el = document.createElement('div'); el.className = 'note'; el.innerHTML = '<i></i><span></span>'; $('#notes').appendChild(el); return el; });
let capI = -1, bgI = 0;
function hud(t, show) {
  if (show !== capI) { capI = show; caps.forEach((c, i) => c.classList.toggle('on', i === show)); chapEls.forEach((b, i) => { b.setAttribute('aria-current', i === show ? 'true' : 'false'); b.classList.toggle('done', i < show); }); }
  bar.style.transform = 'scaleY(' + t.toFixed(4) + ')';
  if (!gl && show !== bgI) { bgI = show; pic.style.backgroundImage = 'url(a/s' + (show + 1) + '-1920.webp)'; }
}
function notes(on, k, f) {
  const w = pic.clientWidth, h = pic.clientHeight;
  noteEls.forEach((el, i) => {
    let vis = false;
    if (on) { const n = NOTES[i], q = project(f, n[0], n[1], depthAt(6, n[0], n[1])); vis = k > .3 + i * .07 && Math.abs(q[0]) < .9 && Math.abs(q[1]) < .88;
      if (vis) { const x = (q[0] * .5 + .5) * w; el.classList.toggle('l', !!n[4] && x - 48 - noteW[i] > 0); el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + ((q[1] * .5 + .5) * h).toFixed(1) + 'px)'; } }
    el.classList.toggle('on', vis);
  });
}
function go(i) { const g = SEG.find(x => x.p === i), t = i ? g.s + (g.tr ? tw : 0) + .006 * N / WT : 0; scrollTo({ top: track.getBoundingClientRect().top + scrollY + t * (track.offsetHeight - stage.offsetHeight), behavior: reduce ? 'auto' : 'smooth' }); }
$('#explore').addEventListener('click', () => go(1));

/* ---------- draw ---------- */
const bind = (u, t) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); };
function layer(j, t, av) {                                       // what segment j shows at t: textures and camera
  const g = SEG[j], k = kAt(j, t);
  if (g.p != null) return ok[g.p] ? { c: tex[g.p], d: dep[g.p], f: frame(j, k, av), di: g.p } : null;
  const c = filmTex(g.f, k);
  if (c) return { c, d: flat, f: frame(j, k, av), di: -1 };
  const h = FILMS[g.f].cap[k < .5 ? 0 : 1], hj = SEG.findIndex(x => x.p === h);   // frames not here yet: the photograph the move starts/ends on
  return ok[h] ? { c: tex[h], d: dep[h], f: frame(hj, hj < j ? 1 : 0, av), di: h } : null;
}
function draw(t) {
  let a, b, T = 0; const j = segAt(t); a = b = j; drawN++;
  if (!reduce) for (const q of [j, j + 1]) if (q > 0 && q < SEG.length && SEG[q].tr && Math.abs(t - SEG[q].s) < tw) { a = q - 1; b = q; T = ss(0, 1, (t - (SEG[q].s - tw)) / (2 * tw)); break; }
  const av = cv.width / cv.height; let A = gl && layer(a, t, av), Bl = gl && b !== a ? layer(b, t, av) : A;
  if (gl && b !== a && !Bl) { b = a; T = 0; Bl = A; }               // incoming picture not loaded yet: hold the current one
  if (gl && b !== a && !A) { a = b; T = 0; A = Bl; }
  const show = capOf(T < .5 ? a : b, t);
  if (gl && !A) stat.blank++;
  if (gl && A) {
    const fa = A.f, fb = Bl.f;
    bind(0, A.c); bind(1, A.d); bind(2, Bl.c); bind(3, Bl.d);
    gl.uniform4f(U.F0, fa.cx, fa.cy, fa.hu, fa.hv); gl.uniform4f(U.M0, fa.mx, fa.my, fa.dz, 0); gl.uniform2f(U.Z0, fa.zx, fa.zy);
    gl.uniform4f(U.F1, fb.cx, fb.cy, fb.hu, fb.hv); gl.uniform4f(U.M1, fb.mx, fb.my, fb.dz, 0); gl.uniform2f(U.Z1, fb.zx, fb.zy);
    let q = [0, 0, 9, 9], type = 0;
    if (b !== a) {
      const tr = SEG[b].tr; type = tr.t;
      if (type >= 4) {
        const c = project(fa, tr.at[0], tr.at[1], depthAt(A.di, tr.at[0], tr.at[1]));
        if (type === 4) q = [c[0], 0, T * (1.03 + Math.abs(c[0])), 9];
        else { const s1 = Math.min(1, T / .3), s2 = ss(.3, 1, T); q = [c[0], c[1], lerp(tr.h[0] / fa.hu * s1, 1.04 + Math.abs(c[0]), s2), lerp(tr.h[1] / fa.hv * s1, 1.04 + Math.abs(c[1]), s2)]; }
      }
    }
    gl.uniform4f(U.W, type, T, b !== a ? ss(0, .08, T) * (1 - ss(.92, 1, T)) : 0, b !== a ? 1 : 0);
    gl.uniform4f(U.Q, q[0], q[1], q[2], q[3]); gl.uniform2f(U.R, cv.width, cv.height); gl.uniform1f(U.P, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; cv.classList.add('on'); }
    notes(a === b && SEG[a].p === 6, kAt(a, t), fa);
  }
  hud(t, show);
}

/* ---------- loop: the scroll position is the only clock ---------- */
function size() {
  const w = pic.clientWidth, h = pic.clientHeight; if (!w || !h) return;
  const p = w / h < AI * .8; if (p !== port || !noteEls[0].lastChild.textContent) { port = p; noteEls.forEach((el, i) => { el.lastChild.textContent = NOTES[i][port ? 3 : 2]; noteW[i] = el.lastChild.offsetWidth; }); }
  const W = Math.round(w * dpr), H = Math.round(h * dpr); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; if (gl) gl.viewport(0, 0, W, H); }
  dirty = true;
}
const pos = () => { const r = track.getBoundingClientRect(); return [clamp(-r.top / Math.max(1, r.height - stage.offsetHeight), 0, 1), r.bottom]; };
const hasGL = initGL();
// films only where they can run well: WebGL, motion allowed, no data saver, not a very low-memory device. Otherwise the
// approved eight-photograph sequence runs unchanged (also on 2g links). ?nofilm forces that for comparison.
FILM = hasGL && !reduce && !/[?&]nofilm\b/.test(location.search) && !net.saveData && !slowNet && (navigator.deviceMemory || 4) >= 2;
buildTL(); root.classList.toggle('film', FILM);
let cur = pos()[0], last = performance.now(), slow = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const [tgt, bottom] = pos(); root.classList.toggle('past', bottom < 80);
  const d = tgt - cur; gap = d;
  if (d) { dir = d > 0 ? 1 : -1; cur = Math.abs(d) < 2e-5 || reduce || still ? tgt : cur + d * (1 - Math.exp(-dt * (coarse ? 16 : 9))); dirty = true; }
  const px = ptr.tx - ptr.x, py = ptr.ty - ptr.y;
  if (Math.abs(px) + Math.abs(py) > 1e-3) { ptr.x += px * Math.min(1, dt * 4); ptr.y += py * Math.min(1, dt * 4); dirty = true; }
  if (!dirty || bottom < -20) return;
  dirty = false; draw(cur); pump();
  if (d && !still) { if (dt > .034) { if (++slow > 24 && dpr > 1) { slow = 0; dpr = Math.max(1, dpr - .5); size(); } } else if (slow) slow--; }   // adaptive resolution
}
if (hasGL) {
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); ok.fill(false); req.fill(null); FL.forEach(F => { F.tex = null; F.shown = -1; }); });
  cv.addEventListener('webglcontextrestored', () => { if (initGL()) { size(); queue(); } });
  queue(); queue();
}
size();
if (window.ResizeObserver) new ResizeObserver(size).observe(pic); else addEventListener('resize', size);
requestAnimationFrame(tick);
if (still || /[?&]probe\b/.test(location.search)) window.__fline = { stat, get t() { return cur; }, get seg() { return SEG; }, get tw() { return tw; }, FILM, FL, FILMS, seek(t) { scrollTo(0, track.getBoundingClientRect().top + scrollY + t * (track.offsetHeight - stage.offsetHeight)); } };

/* ---------- navigation ---------- */
const mb = $('#menu-btn');
mb.addEventListener('click', () => { mb.setAttribute('aria-expanded', root.classList.toggle('menu') ? 'true' : 'false'); });
$$('#menu a').forEach(a => a.addEventListener('click', () => { root.classList.remove('menu'); mb.setAttribute('aria-expanded', 'false'); }));

/* ---------- services: the list drives the photograph beside it ---------- */
const items = $$('.svc-item'), vim = $$('.svc-view img'); let sv = 0;
const act = (i) => {
  if (i === sv) return;
  vim.forEach(m => m.classList.remove('was')); vim[sv].classList.remove('on'); vim[sv].classList.add('was'); items[sv].classList.remove('on');
  const m = vim[i]; m.classList.remove('on', 'was'); void m.offsetWidth; m.classList.add('on'); items[i].classList.add('on'); sv = i;
};
items.forEach((el, i) => { el.addEventListener('pointerenter', () => act(i)); el.addEventListener('focusin', () => act(i)); el.addEventListener('click', () => act(i)); });
const konu = $('#f-konu'), setKonu = (s) => { konu.value = s; $('#f-konu-row').hidden = !s; requestAnimationFrame(() => { konu.style.height = 'auto'; konu.style.height = (konu.scrollHeight + 2) + 'px'; }); };
$$('[data-ask]').forEach(a => a.addEventListener('click', () => setKonu('Hizmet: ' + a.dataset.ask)));

/* ---------- design studio: four ready-made material presets of the same view (pixel-aligned photographs, not live 3D) ---------- */
const PRE = [
  ['Orijinal', 'Jura bej kireçtaşı', 'Sıcak doğal meşe', '#cdaf92', '#b07a5b'],
  ['Modern Natural', 'Açık fildişi-krem kireçtaşı', 'Açık doğal meşe', '#d7c3ab', '#c8a081'],
  ['Industrial Luxury', 'Orta gri mimari beton', 'Koyu füme meşe', '#a29a91', '#6d615d'],
  ['Contemporary Premium', 'Gümüş-bej traverten', 'Doğal Amerikan cevizi', '#c2a88f', '#a1735b']];
const view = $('#cfg-view'), base = $('#cfg-base'), top = $('#cfg-top'), edge = $('#cfg-edge'), knob = $('#cfg-knob'), cmpBtn = $('#cfg-cmp'), ta = $('#cfg-ta'), tb = $('#cfg-tb'), optBox = $('#cfg-opts');
const EASE = ' .8s cubic-bezier(.7,0,.2,1)';
const url = (i) => 'a/c' + (i + 1) + (view.clientWidth * (window.devicePixelRatio || 1) > 1400 ? '' : '-1280') + '.webp';
let sel = 0, cmp = false, busy = false, want = -1, split = .5;
try { sel = clamp(parseInt(localStorage.getItem('fline-preset'), 10) || 0, 0, 3); } catch (e) {}
const ready = (im, src) => new Promise(res => { if (im.getAttribute('src') === src && im.complete) return res(); im.onload = im.onerror = () => res(); im.src = src; }).then(() => im.decode ? im.decode().catch(() => {}) : 0);
const optEls = PRE.map((p, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cfg-opt'; b.setAttribute('role', 'radio');
  b.innerHTML = '<span class="n">0' + (i + 1) + '</span><span class="nm">' + p[0] + '</span><span class="sw" aria-hidden="true"><i style="background:' + p[3] + '"></i><i style="background:' + p[4] + '"></i></span><span class="mt">' + p[1] + ' · ' + p[2] + '</span>';
  b.addEventListener('click', () => pick(i)); optBox.appendChild(b); return b;
});
optBox.addEventListener('keydown', e => { const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); const i = (sel + d + 4) % 4; pick(i); optEls[i].focus(); } });
function state() {
  optEls.forEach((b, i) => { b.setAttribute('aria-checked', i === sel ? 'true' : 'false'); b.tabIndex = i === sel ? 0 : -1; });
  $('#cfg-tas').textContent = PRE[sel][1]; $('#cfg-ahsap').textContent = PRE[sel][2]; cmpBtn.disabled = sel === 0;
  base.alt = PRE[sel][0] + ' ön ayarıyla villanın giriş cephesi: ' + PRE[sel][1] + ', ' + PRE[sel][2];
  try { localStorage.setItem('fline-preset', sel); } catch (e) {}
}
function place() { const p = (split * 100).toFixed(2) + '%'; top.style.transition = 'none'; top.style.clipPath = 'inset(0 0 0 ' + p + ')'; edge.style.transition = 'none'; edge.style.left = p; edge.style.opacity = 1; knob.style.left = p; knob.setAttribute('aria-valuenow', Math.round(split * 100)); }
function setCmp(on) {
  cmp = on && sel !== 0; cmpBtn.setAttribute('aria-pressed', cmp ? 'true' : 'false'); knob.hidden = ta.hidden = tb.hidden = !cmp;
  if (cmp) { tb.textContent = PRE[sel][0]; Promise.all([ready(base, url(0)), ready(top, url(sel))]).then(place); }
  else { edge.style.opacity = 0; ready(base, url(sel)).then(() => { top.style.transition = 'none'; top.style.clipPath = 'inset(0 100% 0 0)'; }); }
}
function pick(i) {
  if (busy) { want = i; return; } if (i === sel) return;
  sel = i; state();
  if (cmp) { if (sel === 0) setCmp(false); else { tb.textContent = PRE[sel][0]; ready(top, url(sel)); } return; }
  busy = true; top.style.transition = 'none'; top.style.clipPath = 'inset(0 100% 0 0)'; edge.style.transition = 'none'; edge.style.left = '0%';
  ready(top, url(sel)).then(() => {                               // hard-edged wipe: every pixel shows exactly one photograph
    void top.offsetWidth;
    if (!reduce) { top.style.transition = 'clip-path' + EASE; edge.style.transition = 'left' + EASE; edge.style.opacity = 1; }
    top.style.clipPath = 'inset(0 0 0 0)'; edge.style.left = '100%';
    setTimeout(() => ready(base, url(sel)).then(() => {
      top.style.transition = 'none'; top.style.clipPath = 'inset(0 100% 0 0)'; edge.style.opacity = 0; busy = false;
      const w = want; want = -1; if (w >= 0 && w !== sel) pick(w);
    }), reduce ? 0 : 840);
  });
}
cmpBtn.addEventListener('click', () => { if (!busy) setCmp(!cmp); });
let drag = false; const mv = (e) => { const r = view.getBoundingClientRect(); split = clamp((e.clientX - r.left) / r.width, .04, .96); place(); };
view.addEventListener('pointerdown', e => { if (!cmp) return; drag = true; try { view.setPointerCapture(e.pointerId); } catch (x) {} mv(e); });
view.addEventListener('pointermove', e => { if (drag) mv(e); });
['pointerup', 'pointercancel'].forEach(n => view.addEventListener(n, () => { drag = false; }));
knob.addEventListener('keydown', e => { const d = e.key === 'ArrowLeft' ? -.04 : e.key === 'ArrowRight' ? .04 : 0; if (d) { e.preventDefault(); split = clamp(split + d, .04, .96); place(); } });
state();
const warm = () => { ready(base, url(sel)); PRE.forEach((p, i) => { new Image().src = url(i); }); };
if (window.IntersectionObserver) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); warm(); } }, { rootMargin: '900px' }); io.observe(view); } else warm();
$('#cfg-go').addEventListener('click', () => { const p = PRE[sel]; setKonu('Tasarım ön ayarı: ' + p[0] + ' (' + p[1] + ' · ' + p[2] + ' · koyu bronz doğrama)'); });

/* ---------- contact: no backend yet, so no fake success. The request text can be copied and sent by hand ---------- */
const msg = $('#form-msg'); let text = '';
$('#form').addEventListener('submit', e => {
  e.preventDefault(); const v = (id) => $('#' + id).value.trim();
  text = ['F LINE görüşme talebi', 'Ad Soyad: ' + v('f-ad'), 'Telefon: ' + v('f-tel'), 'E-posta: ' + v('f-mail'), 'Proje türü: ' + v('f-tur'), 'Konum: ' + v('f-konum'), v('f-konu'), 'Not: ' + v('f-not')].filter(s => s && !/: $/.test(s)).join('\n');
  msg.hidden = false; msg.scrollIntoView({ block: 'nearest' });
});
$('#form-copy').addEventListener('click', e => {
  const btn = e.currentTarget;
  const fallback = () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); btn.textContent = 'Kopyalandı'; } catch (x) {} t.remove(); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { btn.textContent = 'Kopyalandı'; }, fallback); else fallback();
});
})();
