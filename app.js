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
let gl = null, U = {}, dpr = Math.min(window.devicePixelRatio || 1, 2), port = false, dirty = true, shown = false, useBig = false;
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
  const c = clamp(Math.floor(cur * N), 0, N - 1); let best = -1;
  for (let i = 0; i < N; i++) if (!req[i] && (best < 0 || Math.abs(i - c) < Math.abs(best - c))) best = i;
  if (best >= 0) loadScene(best).then(queue);
}
const depthAt = (i, u, v) => { const d = cpu[i]; return d ? B + (1 - B) * d[(clamp(Math.round(v * 89), 0, 89) * 160 + clamp(Math.round(u * 159), 0, 159)) * 4] / 255 : .4; };

/* ---------- camera ---------- */
const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
if (!coarse && !reduce) addEventListener('pointermove', e => { ptr.tx = e.clientX / innerWidth * 2 - 1; ptr.ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
const kOf = (i, t) => clamp((t - (i / N - TW)) / (1 / N + 2 * TW), 0, 1);
function frame(i, k, av) {
  const s = S[i], mU = .02, mV = .012, amp = reduce ? 0 : 1;
  let hv = .5, hu = .5 * av / AI; if (hu > .5) { hu = .5; hv = .5 * AI / av; }
  const sc = Math.max(hu / (.5 - mU), hv / (.5 - mV), 1); hu /= sc; hv /= sc;      // keep a thin margin so the parallax never samples outside the photo
  return { cx: clamp(lerp(s.fx[0], s.fx[1], k), hu + mU, 1 - hu - mU), cy: .5, hu, hv,
    mx: (lerp(s.sx[0], s.sx[1], k) + ptr.x * .005) * amp, my: ptr.y * .003 * amp, dz: lerp(s.dz[0], s.dz[1], k) * amp, zx: s.tg[0], zy: s.tg[1] };
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
function go(i) { const t = i ? i / N + TW + .006 : 0; scrollTo({ top: track.getBoundingClientRect().top + scrollY + t * (track.offsetHeight - stage.offsetHeight), behavior: reduce ? 'auto' : 'smooth' }); }
$('#explore').addEventListener('click', () => go(1));

/* ---------- draw ---------- */
const bind = (u, t) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); };
function draw(t) {
  let a, b, T = 0; const j = Math.round(t * N);
  if (!reduce && j >= 1 && j <= N - 1 && Math.abs(t - j / N) < TW) { a = j - 1; b = j; T = ss(0, 1, (t - (j / N - TW)) / (2 * TW)); } else a = b = clamp(Math.floor(t * N), 0, N - 1);
  if (gl && b !== a && !ok[b]) { b = a; T = 0; }                 // incoming photograph not loaded yet: hold the current one
  if (gl && b !== a && !ok[a]) { a = b; T = 0; }
  const show = T < .5 ? a : b;
  if (gl && ok[a]) {
    const av = cv.width / cv.height, fa = frame(a, kOf(a, t), av), fb = b !== a ? frame(b, kOf(b, t), av) : fa;
    bind(0, tex[a]); bind(1, dep[a]); bind(2, tex[b]); bind(3, dep[b]);
    gl.uniform4f(U.F0, fa.cx, fa.cy, fa.hu, fa.hv); gl.uniform4f(U.M0, fa.mx, fa.my, fa.dz, 0); gl.uniform2f(U.Z0, fa.zx, fa.zy);
    gl.uniform4f(U.F1, fb.cx, fb.cy, fb.hu, fb.hv); gl.uniform4f(U.M1, fb.mx, fb.my, fb.dz, 0); gl.uniform2f(U.Z1, fb.zx, fb.zy);
    let q = [0, 0, 9, 9], type = 0;
    if (b !== a) {
      const tr = TR[b]; type = tr.t;
      if (type >= 4) {
        const c = project(fa, tr.at[0], tr.at[1], depthAt(a, tr.at[0], tr.at[1]));
        if (type === 4) q = [c[0], 0, T * (1.03 + Math.abs(c[0])), 9];
        else { const s1 = Math.min(1, T / .3), s2 = ss(.3, 1, T); q = [c[0], c[1], lerp(tr.h[0] / fa.hu * s1, 1.04 + Math.abs(c[0]), s2), lerp(tr.h[1] / fa.hv * s1, 1.04 + Math.abs(c[1]), s2)]; }
      }
    }
    gl.uniform4f(U.W, type, T, b !== a ? ss(0, .08, T) * (1 - ss(.92, 1, T)) : 0, b !== a ? 1 : 0);
    gl.uniform4f(U.Q, q[0], q[1], q[2], q[3]); gl.uniform2f(U.R, cv.width, cv.height); gl.uniform1f(U.P, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; cv.classList.add('on'); }
    notes(a === 6 && b === 6, kOf(6, t), fa);
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
let cur = pos()[0], last = performance.now(), slow = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const [tgt, bottom] = pos(); root.classList.toggle('past', bottom < 80);
  const d = tgt - cur;
  if (d) { cur = Math.abs(d) < 2e-5 || reduce || still ? tgt : cur + d * (1 - Math.exp(-dt * (coarse ? 16 : 9))); dirty = true; }
  const px = ptr.tx - ptr.x, py = ptr.ty - ptr.y;
  if (Math.abs(px) + Math.abs(py) > 1e-3) { ptr.x += px * Math.min(1, dt * 4); ptr.y += py * Math.min(1, dt * 4); dirty = true; }
  if (!dirty || bottom < -20) return;
  dirty = false; draw(cur);
  if (d && !still) { if (dt > .034) { if (++slow > 24 && dpr > 1) { slow = 0; dpr = Math.max(1, dpr - .5); size(); } } else if (slow) slow--; }   // adaptive resolution
}
if (initGL()) {
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); ok.fill(false); req.fill(null); });
  cv.addEventListener('webglcontextrestored', () => { if (initGL()) { size(); queue(); } });
  queue(); queue();
}
size();
if (window.ResizeObserver) new ResizeObserver(size).observe(pic); else addEventListener('resize', size);
requestAnimationFrame(tick);

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
