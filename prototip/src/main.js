/* F LINE — 3D prototype (massing model). Real geometry and a real camera moving through it on an authored path.
   This is a study model: plain "clay" surfaces, no photographic materials. It does not replace the photographic stage on the main page.
   Axes: x east, y up, z south. North entrance at z = -5, pool and terrace on the south side. Units: metres.
   Build: esbuild prototip/src/main.js --bundle --minify --format=iife --outfile=prototip/proto.js */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, BoxGeometry, BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial,
  LineSegments, LineBasicMaterial, DirectionalLight, HemisphereLight, CatmullRomCurve3, Vector3, Matrix4, Quaternion, Euler,
  PlaneGeometry, IcosahedronGeometry, CylinderGeometry, PCFShadowMap
} from 'three';

const $ = (s) => document.querySelector(s), clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const still = /[?&]still\b/.test(location.search), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, coarse = matchMedia('(pointer: coarse)').matches;
const cv = $('#c'), track = $('#track'), stage = $('#stage');

/* ---------- geometry: boxes are merged per material; their edges are drawn as one set of thin lines ---------- */
const parts = {}, lines = [];
const M = new Matrix4(), Q = new Quaternion(), E = new Euler(), P = new Vector3(), ONE = new Vector3(1, 1, 1), C = new Vector3();
function put(key, geo, m) {
  const g = geo.index ? geo.toNonIndexed() : geo; if (m) g.applyMatrix4(m);
  const t = parts[key] || (parts[key] = { p: [], n: [] }), p = g.attributes.position.array, n = g.attributes.normal.array;
  for (let i = 0; i < p.length; i++) { t.p.push(p[i]); t.n.push(n[i]); }
}
const EDGE = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
function rbox(key, cx, cy, cz, sx, sy, sz, rx, ry, edge) {
  M.compose(P.set(cx, cy, cz), Q.setFromEuler(E.set(rx || 0, ry || 0, 0)), ONE);
  put(key, new BoxGeometry(sx, sy, sz), M);
  if (edge === false) return;
  const c = []; for (let i = 0; i < 8; i++) { C.set((i & 1 ? .5 : -.5) * sx, (i & 2 ? .5 : -.5) * sy, (i & 4 ? .5 : -.5) * sz).applyMatrix4(M); c.push(C.x, C.y, C.z); }
  EDGE.forEach(([a, b]) => lines.push(c[a * 3], c[a * 3 + 1], c[a * 3 + 2], c[b * 3], c[b * 3 + 1], c[b * 3 + 2]));
}
const box = (key, x0, x1, y0, y1, z0, z1, edge) => rbox(key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, 0, 0, edge);
// timber slats standing in front of a wall face. axis 'x': the row runs along x on plane z; axis 'z': the row runs along z on plane x
function slats(axis, a0, a1, at, y0, y1, out) {
  const n = Math.round((a1 - a0) / .13);
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; if (axis === 'x') box('wood', a - .025, a + .025, y0, y1, Math.min(at, at + out), Math.max(at, at + out), false); else box('wood', Math.min(at, at + out), Math.max(at, at + out), y0, y1, a - .025, a + .025, false); }
}

const FL = 3.2, UN = 2.92, RF = 6.2, RT = 6.5;                  // upper floor level, underside of its slab, underside and top of the roof
function build() {
  // site
  box('slab', -8, 8, -.15, 0, -5, 5);                           // ground floor slab
  box('deck', -8.6, 9, -.15, 0, 5, 9.2);                        // south terrace
  box('deck', -4.2, 7.7, -.15, -.02, 9.2, 10.4); box('deck', -4.2, 7.7, -.15, -.02, 14.6, 15.8); box('deck', -4.2, -3, -.15, -.02, 10.4, 14.6); box('deck', 6.5, 7.7, -.15, -.02, 10.4, 14.6);
  box('water', -3, 6.5, -.3, -.07, 10.4, 14.6, false);          // pool
  box('deck', -2.3, 2.3, -.15, -.03, -15, -5);                  // entrance path, north
  // outer walls (stone)
  box('stone', -8, -1.6, 0, RT, -5, -4.7); box('stone', 1.6, 8, 0, RT, -5, -4.7); box('stone', -1.6, 1.6, UN, RT, -5, -4.7);   // north
  box('stone', -8, -7.7, 0, RT, -4.7, 5);                       // west
  box('stone', 7.7, 8, 0, RT, -4.7, .8); box('stone', 7.7, 8, 0, RT, 3.6, 5); box('stone', 7.7, 8, 5.6, RT, .8, 3.6); box('glass', 7.82, 7.88, 0, 5.6, .8, 3.6, false);   // east, with a tall slot window
  box('stone', -7.7, -2.15, 0, UN, 4.7, 5); box('pane', -6.8, -3.4, 0, 2.6, 5, 5.03);                                              // south, west wing ground floor
  box('stone', -7.7, 7.7, RF, RT, 4.7, 5);                      // south lintel under the roof
  // entrance: stone portal, recessed niche, glazed sidelights, open door
  box('stone', -2.3, 2.3, 2.95, 3.3, -6.6, -5); box('stone', -2.3, -2, 0, 2.95, -6.6, -5); box('stone', 2, 2.3, 0, 2.95, -6.6, -5);
  box('stone', -1.6, -1.3, 0, UN, -4.7, -3.85); box('stone', 1.3, 1.6, 0, UN, -4.7, -3.85); box('wall', -1.3, 1.3, 2.6, UN, -4.15, -3.85);
  box('glass', -1.3, -.7, 0, 2.6, -4.03, -3.97, false); box('glass', .7, 1.3, 0, 2.6, -4.03, -3.97, false);
  box('dark', -.76, -.7, 0, 2.6, -4.1, -3.9); box('dark', .7, .76, 0, 2.6, -4.1, -3.9); box('dark', -.76, -.7, 0, 2.6, -3.85, -2.5);   // frame and the door leaf, standing open
  // north façade: slat panels and windows
  slats('x', -6.6, -3.2, -5, .1, 2.85, -.06); slats('x', 2.6, 4.8, -5, 3.35, 6.1, -.06);
  box('pane', -6.4, -3.6, 3.9, 6, -5.03, -5); box('pane', 5.4, 7.2, 3.9, 6, -5.03, -5); box('pane', 3, 7, .9, 2.5, -5.03, -5);
  // floors and roof
  box('slab', -8, -2, UN, FL, -5, 5); box('slab', -2, 8, UN, FL, -5, -.5);                        // upper floor: west wing and the gallery strip. The rest is the living room void
  box('slab', -8, -2, UN, FL, 5, 6.5);                                                            // balcony
  box('slab', -8.7, 8.7, RF, RT, -5.6, 6.7);                                                      // roof
  // inner walls
  box('wall', -2.15, -1.85, 0, UN, -4.7, 4.7);                                                    // foyer / living room west wall
  box('wall', 1.85, 2.15, 0, UN, -4.7, -.5);                                                      // foyer east wall
  box('wall', 2.15, 7.7, 0, UN, -.65, -.35);                                                      // living room north wall, under the gallery edge
  box('wall', -2.15, -1.85, FL, RF, -.45, 4.7); box('wall', -2.15, -1.85, FL, RF, -4.7, -2.05);   // upper: bedroom east wall; rooms north of the gallery
  box('wall', -4.5, 7.7, FL, RF, -2.35, -2.05);                                                   // gallery north wall
  box('wall', -4.8, -4.5, FL, RF, -2.35, -.15);                                                   // corridor end
  box('wall', -7.7, -3.6, FL, RF, -.45, -.15); box('wall', -2.6, -1.85, FL, RF, -.45, -.15); box('wall', -3.6, -2.6, 5.4, RF, -.45, -.15);   // bedroom north wall with the door opening
  // glazing: living room south wall (two storeys), bedroom south wall, balustrades
  box('glass', -1.85, 7.7, 0, RF, 4.82, 4.88, false); box('glass', -7.7, -2.15, FL, RF, 4.82, 4.88, false);
  for (let k = 0; k <= 4; k++) { const x = -1.85 + k * 2.3875; box('dark', x - .04, x + .04, 0, RF, 4.78, 4.92); }
  box('dark', -1.85, 7.7, 3.0, 3.1, 4.78, 4.92); box('dark', -4.96, -4.88, FL, RF, 4.78, 4.92);
  box('glass', -.8, 7.7, FL, FL + 1.05, -.52, -.5); box('glass', -8, -2, FL, FL + 1.05, 6.44, 6.47); box('glass', -7.98, -7.95, FL, FL + 1.05, 5, 6.47); box('glass', -2.05, -2.02, FL, FL + 1.05, 5, 6.47);
  // stair: open treads along the west wall, rising north from the living room to the gallery
  const run = .27, rise = FL / 17, z0 = -.5 + 16 * run, ang = Math.atan2(FL, 16 * run), len = Math.hypot(FL, 16 * run);
  for (let i = 1; i <= 16; i++) box('wood', -1.8, -.8, i * rise - .06, i * rise, z0 - i * run, z0 - (i - 1) * run);
  rbox('dark', -1.3, FL / 2 - .22, (z0 - .5) / 2, .14, .24, len, ang, 0);
  rbox('glass', -.8, FL / 2 + .5, (z0 - .5) / 2, .02, 1, len, ang, 0, false);
  // timber slat walls: behind the stair (two storeys), living room north wall, bedroom headboard wall
  slats('z', -.3, 4.6, -1.85, 0, RF, .05); slats('x', 2.3, 7.6, -.35, 0, UN, .05); slats('x', -7.5, -3.8, -.15, FL, RF, .05);
  // furniture, as plain volumes for scale
  box('deck', 3.6, 7.3, 0, .015, 2.2, 4.6, false);
  box('soft', 4, 7, 0, .42, 2.5, 3.5); box('soft', 4, 7, .42, .82, 2.5, 2.76); box('soft', 6, 7, 0, .42, 3.5, 4.3); box('wood', 4.4, 5.6, 0, .34, 3.85, 4.45);
  box('wood', 3.6, 6.2, .72, .77, .3, 1.3); box('wood', 3.75, 3.85, 0, .72, .4, 1.2); box('wood', 5.95, 6.05, 0, .72, .4, 1.2); box('soft', 3.8, 6, 0, .45, -.05, .25); box('soft', 3.8, 6, 0, .45, 1.4, 1.7);
  box('wood', -6.8, -4.8, FL, FL + .34, -.1, 2); box('soft', -6.75, -4.85, FL + .34, FL + .58, -.05, 1.95); box('soft', -6.6, -5.9, FL + .58, FL + .7, 0, .45); box('soft', -5.7, -5, FL + .58, FL + .7, 0, .45);
  box('wood', -7.4, -6.95, FL, FL + .45, -.1, .35); box('wood', -4.65, -4.2, FL, FL + .45, -.1, .35); box('soft', -6.5, -5.1, FL, FL + .42, 2.25, 2.7);
  // trees, as on a study model
  [[-13, -9, 2.2], [-15, 2, 2.6], [-12, 11, 2], [-6, -17, 2.3], [-6, 20, 1.8], [21, -15, 2.4], [-16, -19, 2.8], [-18, 16, 2.6]].forEach(([x, z, r]) => {
    put('tree', new IcosahedronGeometry(r, 1), M.makeTranslation(x, 1.6 + r, z)); put('dark', new CylinderGeometry(.09, .12, 1.8 + r * .5, 6), M.makeTranslation(x, .75 + r * .25, z));
  });
}

/* ---------- scene ---------- */
const BG = 0xefe9df, std = (c, r) => new MeshStandardMaterial({ color: c, roughness: r === undefined ? .92 : r, metalness: 0 });
const MAT = {
  stone: std(0xe9e1d2), wall: std(0xf3eee5), slab: std(0xe0d7c7), wood: std(0xc39a72), dark: std(0x51463d), deck: std(0xd2c4ad), soft: std(0xf8f4ec), tree: std(0xe4dfd0),
  pane: std(0x8d9a9b, .25), water: std(0x9fbcc4, .15),
  glass: new MeshStandardMaterial({ color: 0xb7cdd0, roughness: .08, metalness: 0, transparent: true, opacity: .2, depthWrite: false })
};
let renderer = null;
const scene = new Scene(), cam = new PerspectiveCamera(52, 1, .1, 220);
function init() {
  try { renderer = new WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  if (!renderer) { document.documentElement.classList.add('nogl'); return false; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap; renderer.shadowMap.autoUpdate = false;   // the sun never moves: shadows are rendered once
  scene.background = new Color(BG); scene.fog = new Fog(BG, 45, 150);
  build();
  for (const k in parts) {
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(parts[k].p, 3)); g.setAttribute('normal', new Float32BufferAttribute(parts[k].n, 3));
    const m = new Mesh(g, MAT[k]), clear = k === 'glass'; m.castShadow = !clear && k !== 'water'; m.receiveShadow = !clear; if (clear) m.renderOrder = 2; scene.add(m);
  }
  const lg = new BufferGeometry(); lg.setAttribute('position', new Float32BufferAttribute(lines, 3));
  scene.add(new LineSegments(lg, new LineBasicMaterial({ color: 0x3b322b, transparent: true, opacity: .34 })));
  const ground = new Mesh(new PlaneGeometry(420, 420), std(0xdbd2c2)); ground.rotation.x = -Math.PI / 2; ground.position.y = -.15; ground.receiveShadow = true; scene.add(ground);
  scene.add(new HemisphereLight(0xffffff, 0xcfc6b6, 2.1));
  const sun = new DirectionalLight(0xfff3e2, 2.3); sun.position.set(-20, 30, 24); sun.castShadow = true;   // from the south-west: sunlight enters the living room through the south glazing
  const s = sun.shadow; s.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096); s.camera.left = -30; s.camera.right = 30; s.camera.top = 30; s.camera.bottom = -30; s.camera.near = 1; s.camera.far = 110; s.bias = -.0005; s.normalBias = .04;
  scene.add(sun);
  renderer.shadowMap.needsUpdate = true;
  return true;
}

/* ---------- camera path: [position, look-at target, share of the scroll spent reaching the next point] ---------- */
const EYE = 1.6, onStair = (z) => EYE + FL * clamp((3.82 - z) / 4.32, 0, 1);
const WP = [
  [[12, 2.6, 22], [1, 2.5, 3], 1],                              // 0  south façade, pool in front
  [[17.5, 2.2, 10], [2, 2.8, 1], 1],
  [[17, 1.9, -5], [3, 2.8, -2], 1],                             // 2  round the east side
  [[8, 1.75, -14], [.5, 2.4, -5], 1],                           // 3  north façade
  [[0, EYE, -10.5], [0, 1.9, -4], .9],
  [[.12, EYE, -5.6], [.3, EYE, -1.5], .6],                         // 5  at the entrance
  [[.2, EYE, -3.1], [.8, EYE, 1.5], .7],                         // 6  foyer
  [[.9, EYE, .4], [5.5, 1.2, 3.6], .8],
  [[2.5, EYE, 2.3], [6.2, 2.7, .2], .9],                         // 8  living room, towards the terrace and pool
  [[1.3, EYE, 4.05], [-1.3, 1.4, 2.4], .6],
  [[-1.3, onStair(4.15), 4.15], [-1.3, 3, .2], .7],             // 10 foot of the stair
  [[-1.3, onStair(1.7), 1.7], [-1.3, 4.6, -1.6], .8],
  [[-1.3, FL + EYE, -.75], [1.5, 3.6, -1.2], .8],               // 12 top of the stair, on the gallery
  [[-.95, FL + EYE, -1.3], [4.6, .5, 3.6], 1],                  // 13 gallery: looking down into the living room
  [[-1.7, FL + EYE, -1.27], [-4.2, 4.5, -1.2], .6],
  [[-3, FL + EYE, -1.2], [-3.3, 4.4, 1.6], .6],                 // 15 corridor, at the bedroom door
  [[-3.1, FL + EYE, .5], [-4.6, 4.3, 5.2], .8],
  [[-3.2, FL + EYE, 2.2], [-5.6, 4.2, 5.6], .8],                 // 17 master bedroom: balcony and the view south
  [[-3.35, FL + EYE, 3.5], [-6.3, 3.75, .4], 0]                  // 18 turning to the bed and the slatted headboard wall
];
const CH = [
  [0, 'Güney cephe', 'Havuz ve teras güneyde. Salonun iki kat yüksekliğindeki camı bu cepheye açılır.'],
  [2.5, 'Kuzey giriş', 'Kamera yapının doğusundan dolaşır ve kuzeydeki girişe yaklaşır.'],
  [5.6, 'Salon', 'Giriş holünden çift yükseklikli salona. Karşıda güney camı, teras ve havuz.'],
  [9.4, 'Merdiven', 'Batı duvarı boyunca üst kata çıkan açık basamaklı merdiven.'],
  [12, 'Üst galeri', 'Galeri salon boşluğuna bakar; koridor batıya, yatak odasına bağlanır.'],
  [14.6, 'Ebeveyn yatak odası', 'Koridordan yatak odasına. Güneyde balkon, aşağıda havuz.']
];
const n1 = WP.length - 1, posC = new CatmullRomCurve3(WP.map(w => new Vector3(...w[0])), false, 'centripetal'), tgtC = new CatmullRomCurve3(WP.map(w => new Vector3(...w[1])), false, 'centripetal');
const cum = [0]; WP.forEach((w, i) => { if (i < n1) cum.push(cum[i] + w[2]); });
const total = cum[n1];
// scroll share -> position on the path, counted in waypoints
function uOf(s) { const d = clamp(s, 0, 1) * total; let i = 0; while (i < n1 - 1 && cum[i + 1] < d) i++; return i + clamp((d - cum[i]) / WP[i][2], 0, 1); }
const sOf = (u) => { const i = Math.min(n1 - 1, Math.floor(u)); return (cum[i] + (u - i) * WP[i][2]) / total; };

/* ---------- HUD ---------- */
const nav = $('#chap'), els = CH.map((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c[1]; b.onclick = () => go(i); nav.appendChild(b); return b; });
let chI = -1;
function hud(u, s) {
  let i = 0; while (i < CH.length - 1 && u >= CH[i + 1][0]) i++;
  if (i !== chI) { chI = i; $('#no').textContent = '0' + (i + 1) + ' / 0' + CH.length; $('#nm').textContent = CH[i][1]; $('#tx').textContent = CH[i][2]; els.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false')); }
  $('#bar').style.transform = 'scaleX(' + s.toFixed(4) + ')';
}
function go(i) { const s = i ? sOf(CH[i][0]) + .004 : 0; scrollTo({ top: track.getBoundingClientRect().top + scrollY + s * (track.offsetHeight - stage.offsetHeight), behavior: 'auto' }); snap = true; }

/* ---------- loop: the scroll position is the only clock ---------- */
const pv = new Vector3(), tv = new Vector3(), want = new Quaternion(), look = new Matrix4(), UP = new Vector3(0, 1, 0);
let cur = 0, last = performance.now(), dirty = true, snap = true, dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2), slow = 0;
const pos = () => { const r = track.getBoundingClientRect(); return [clamp(-r.top / Math.max(1, r.height - stage.offsetHeight), 0, 1), r.bottom]; };
function size() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || !renderer) return;
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  cam.aspect = w / h; cam.fov = cam.aspect >= 1.2 ? 52 : Math.min(88, 2 * Math.atan(Math.tan(.62) / cam.aspect) * 180 / Math.PI); cam.updateProjectionMatrix(); dirty = true;
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const [tgt, bottom] = pos(), hard = snap || still || reduce, d = tgt - cur;
  if (d) { cur = hard || Math.abs(d) < 2e-5 ? tgt : cur + d * (1 - Math.exp(-dt * (coarse ? 12 : 7))); dirty = true; }
  if (!dirty || bottom < -20) return;
  const u = uOf(cur), t = u / n1;
  posC.getPoint(t, pv); tgtC.getPoint(t, tv);
  cam.position.copy(pv); look.lookAt(pv, tv, UP); want.setFromRotationMatrix(look);
  if (hard) cam.quaternion.copy(want); else cam.quaternion.slerp(want, 1 - Math.exp(-dt * 8));   // orientation eases towards the authored direction, it never snaps
  dirty = !hard && (Math.abs(d) > 2e-5 || cam.quaternion.angleTo(want) > 2e-4); snap = false;
  hud(u, cur); renderer.render(scene, cam);
  if (!shown) { shown = true; document.documentElement.classList.add('ready'); }
  if (d && !still) { if (dt > .04) { if (++slow > 30 && dpr > 1) { slow = 0; dpr = Math.max(1, dpr - .5); size(); } } else if (slow) slow--; }
}
let shown = false;
if (init()) {
  size(); if (window.ResizeObserver) new ResizeObserver(size).observe(stage); else addEventListener('resize', size);
  cv.addEventListener('webglcontextlost', e => e.preventDefault()); cv.addEventListener('webglcontextrestored', () => { renderer.shadowMap.needsUpdate = true; dirty = true; });
  requestAnimationFrame(tick);
}
window.__proto = { uOf, sOf, WP, CH };                            // read by the test script only
