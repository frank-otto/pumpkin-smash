// Pumpkin Smash — main: renderer, game loop, input, spawning, boss, UI glue.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createWorld, updateWorld, QUALITY, strike } from './world.js';
import { makeFaceMaterial, makePumpkin, makeGhost, makeBomb, makeSleepyCat, makeBoss, crackBoss } from './pumpkins.js';
import * as FX from './fx.js';
import * as A from './audio.js';
import { T, setLang, getLang, applyI18n, rankFor, shareText, fmt } from './i18n.js';
const defName = () => (getLang() === 'de' ? 'Spieler' : 'Player');

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[(Math.random() * a.length) | 0];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

// ---------------- settings ----------------
const S = {
  state: 'attract', kids: store.get('ps-kids', '0') === '1', quality: store.get('ps-quality', ''), qualityUser: !!store.get('ps-quality', ''),
  score: 0, timeLeft: 60, elapsed: 0, mult: 1, multT: 0, smashed: 0, bestCombo: 0, chain: 0, lastHitT: -9, chainPts: 0, chainPos: null,
  boss: null, bossSpawned: false, bossKilled: false, timeScale: 1, slowT: 0, best: +store.get('ps-best', '0') || 0,
  spawnT: 0.4, ghostT: 9, ghostKind: 'time', tickNext: 5, queue: [], demoT: 0.6, nameV: store.get('ps-name', defName()), shareLang: getLang(), paused: false, clock: 0
};
if (!QUALITY[S.quality]) S.quality = '';

// ---------------- renderer / scene ----------------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
const CAM = new THREE.Vector3(0, 2.3, 10), LOOK = new THREE.Vector3(0, 2.25, -2);
camera.position.copy(CAM); camera.lookAt(LOOK);
let composer = null, bloom = null, W = null;
const F = FX.createFx(scene, camera, renderer);
const O = FX.createOverlay($('fx2d'));

function qName() { return S.quality || 'high'; }
function buildComposer() {
  const q = QUALITY[qName()];
  if (composer) { composer.dispose && composer.dispose(); composer = null; }
  if (!q.bloom) return;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: qName() === 'mid' ? 2 : 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.8 * q.bloom, 0.5, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight, q = QUALITY[qName()];
  const dpr = Math.min(window.devicePixelRatio || 1, q.pr);
  renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const halfW = 5.3, dist = CAM.distanceTo(new THREE.Vector3(0, 2.3, 0));
  const vfov = 2 * Math.atan(Math.tan(Math.atan(halfW / dist)) / camera.aspect) * 180 / Math.PI;
  camera.fov = clamp(vfov, 50, 78);
  // portrait phones: lower camera, look up a bit → less empty ground, action centred
  const port = clamp((1.0 - camera.aspect) / 0.5, 0, 1);
  CAM.y = 2.3 - 1.0 * port; LOOK.y = 2.25 + 1.3 * port;
  if (W && W.fg) for (const p of W.fg) p.position.x = p.userData.bx * (1 - 0.4 * port);
  if (W && W.fgLights) W.fgLights.forEach((l, i) => { l.position.x = (i ? 4.2 : -4.0) * (1 - 0.4 * port); });
  camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); }
  FX.resizeOverlay(O, w, h, Math.min(window.devicePixelRatio || 1, 2));
  F.points.mat.uniforms.scale.value = h * dpr / (2 * Math.tan(camera.fov * Math.PI / 360));
  if (W) W.stars.material.uniforms.pr.value = dpr;
}
function applyQuality(qn, user = false) {
  S.quality = qn; if (user) { S.qualityUser = true; store.set('ps-quality', qn); }
  const q = QUALITY[qn];
  if (W) { scene.remove(W.root); W.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  W = createWorld(scene, qn); W.soft = S.kids; W.onThunder = soft => A.sfx.thunder(soft || S.kids);
  addForeground();
  F.scale = q.particles;
  buildComposer(); resize();
  document.querySelectorAll('#qualSeg button').forEach(b => b.classList.toggle('on', b.dataset.q === qn));
  window.__psQuality = qn;
}

// foreground framing: big glowing jack-o'-lanterns + candles in the bottom corners
function addForeground() {
  if (!MATS) return;
  const set = S.kids ? MATS.kids : MATS.normal;
  const spots = [[-4.5, -0.42, -1.6, 0.82, 0.45, 0], [-3.1, -0.68, -0.4, 0.45, 0.25, 1], [4.7, -0.38, -2.2, 0.9, -0.5, 2], [3.3, -0.7, -0.6, 0.42, -0.3, 0], [-6.5, -0.5, -4.5, 0.7, 0.6, 2], [6.8, -0.55, -5.0, 0.6, -0.6, 1]];
  W.fg = [];
  for (const [x, y, z, r, yaw, f] of spots) {
    const p = makePumpkin(set[f % set.length], r, 'n'); p.position.set(x, y, z); p.rotation.y = yaw; p.userData.halo.material = p.userData.halo.material.clone(); p.userData.halo.material.opacity = 0.5; p.userData.bx = x;
    W.root.add(p); W.fg.push(p);
  }
  const l = new THREE.PointLight(0xff8a30, 6, 7, 1.6); l.position.set(-4.0, 0.5, -0.2); W.root.add(l);
  const l2 = new THREE.PointLight(0xff8a30, 6, 7, 1.6); l2.position.set(4.2, 0.5, -0.8); W.root.add(l2);
  W.fgLights = [l, l2];
  resize();
}

// ---------------- materials ----------------
let MATS = null;
function buildMats() {
  const opt = { scale: 1.2 };
  MATS = {
    normal: ['evil', 'grin', 'wild'].map(f => makeFaceMaterial(f, opt)),
    kids: ['cute', 'happy', 'sleepy'].map(f => makeFaceMaterial(f, Object.assign({ blush: f !== 'sleepy' }, opt))),
    goldN: makeFaceMaterial('grin', { scale: 1.2, base: ['#ffe27a', '#e8b030', '#a06a10'], emissive: 0xfff0c0, ei: 3 }),
    goldK: makeFaceMaterial('happy', { scale: 1.2, base: ['#ffe27a', '#e8b030', '#a06a10'], emissive: 0xfff0c0, ei: 3, blush: true })
  };
}

// ---------------- entities ----------------
let ents = [], idSeq = 1;
const SIZES = { S: 0.42, M: 0.56, L: 0.8 };
function addEnt(e) { e.id = idSeq++; e.alive = true; e.t = 0; e.hitAt = -1; scene.add(e.obj); ents.push(e); return e; }
function launchArc(e, apexT, from, apex) {
  const x0 = from ? from.x : rand(-6.5, 6.5), y0 = from ? from.y : -1.8, z0 = from ? from.z : rand(-15, -9);
  const xa = apex ? apex.x : clamp(x0 * 0.3 + rand(-3, 3), -3.9, 3.9), ya = apex ? apex.y : rand(2.4, 5.0), za = apex ? apex.z : rand(-2.2, -0.2);
  e.obj.position.set(x0, y0, z0);
  e.g = 2 * (ya - y0) / (apexT * apexT);
  e.vel = new THREE.Vector3((xa - x0) / apexT, e.g * apexT, (za - z0) / apexT);
  e.spin = new THREE.Vector3(rand(-1.2, 1.2), rand(-1.5, 1.5), rand(-1.2, 1.2));
}
function apexTime() { return S.kids ? 1.75 : lerp(1.45, 1.08, clamp(S.elapsed / 40, 0, 1)); }
function spawnPumpkin(o = {}) {
  const r = Math.random(), cls = o.size || (r < 0.18 ? 'L' : r < 0.55 ? 'M' : 'S');
  const golden = o.golden ?? Math.random() < 0.045;
  const set = S.kids ? MATS.kids : MATS.normal;
  const mat = golden ? (S.kids ? MATS.goldK : MATS.goldN) : pick(set);
  const geoKind = !golden && Math.random() < 0.25 ? 'tall' : 'n';
  const radius = SIZES[cls] * (o.scale || 1);
  const obj = makePumpkin(mat, radius, geoKind, golden);
  const e = addEnt({ type: 'pumpkin', obj, body: obj.userData.body, radius, mat, geoKind, golden, cls, hp: cls === 'L' && !S.kids ? 2 : 1, pts: golden ? 100 : { S: 15, M: 10, L: 25 }[cls] });
  launchArc(e, o.apexT || apexTime(), o.from, o.apex);
  return e;
}
function spawnBad() {
  const obj = S.kids ? makeSleepyCat() : makeBomb();
  const e = addEnt({ type: S.kids ? 'cat' : 'bomb', obj, body: obj.userData.body, radius: S.kids ? 0.75 : 0.62, hp: 1 });
  launchArc(e, S.kids ? 2.0 : apexTime() * 1.05);
  e.spin.multiplyScalar(S.kids ? 0.15 : 0.5);
  return e;
}
function spawnGhost(kind) {
  const obj = makeGhost(kind, S.kids);
  const dir = Math.random() < 0.5 ? 1 : -1;
  const e = addEnt({ type: 'ghost', kind, obj, body: obj.userData.body, radius: 0.85, hp: 1, dir, y0: rand(3.0, 4.8), z0: rand(-3, -1), speed: S.kids ? 2.2 : 3.0 });
  obj.position.set(-dir * 9, e.y0, e.z0);
  A.sfx.ghostAppear();
  return e;
}
function spawnBoss() {
  const obj = makeBoss(S.kids);
  const e = addEnt({ type: 'boss', obj, body: obj.userData.body, radius: 2.6, hp: S.kids ? 22 : 36, maxHp: S.kids ? 22 : 36, rise: 0, wob: 0, roared: false });
  obj.position.set(0, -8, -6);
  S.boss = e; S.bossSpawned = true;
  banner(T('boss'), T('bossSub'), true);
  A.sfx.bossRise(); A.setMood('boss'); A.duck(0.5, 2);
  strike(W, S.kids); FX.shake(F, S.kids ? 0.15 : 0.35);
  $('bossBar').classList.remove('hidden'); $('bossFill').style.width = '100%';
  return e;
}
function removeEnt(e) {
  e.alive = false; scene.remove(e.obj);
  if (e.type !== 'pumpkin') { // ghosts / bombs / cats / boss own their geometry, materials and canvas textures → free GPU memory
    e.obj.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const m = o.material; if (m && !m.userData.shared) { if (m.map && !m.map.userData.shared) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); }
    });
  }
}

// ---------------- projection / hits ----------------
const V = new THREE.Vector3();
function screenOf(e) {
  V.copy(e.obj.position); if (e.type === 'boss') V.y += 0.1;
  const camSpace = V.clone().applyMatrix4(camera.matrixWorldInverse);
  V.project(camera);
  const w = O.w, h = O.h, depth = -camSpace.z;
  const rpx = e.radius * (h / 2) / (Math.tan(camera.fov * Math.PI / 360) * Math.max(0.1, depth));
  return { x: (V.x + 1) / 2 * w, y: (1 - V.y) / 2 * h, r: rpx, depth, on: V.z < 1 && depth > 0 };
}
function segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0; t = clamp(t, 0, 1);
  const x = ax + dx * t - px, y = ay + dy * t - py; return Math.sqrt(x * x + y * y);
}
function worldAt(sx, sy, depthZ) { // screen point → world point at plane z=depthZ
  const ndc = new THREE.Vector3(sx / O.w * 2 - 1, -(sy / O.h) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize(); const t = (depthZ - camera.position.z) / dir.z;
  return camera.position.clone().addScaledVector(dir, t);
}

function addScore(pts, x, y, color, size) {
  const v = Math.round(pts * (pts > 0 ? S.mult : 1));
  if (S.state === 'play') { S.score = Math.max(0, S.score + v); const el = $('score'); el.textContent = fmt(S.score); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  if (x != null) FX.popup(O, x, y, (v > 0 ? '+' : '') + v, color || (S.mult > 1 ? '#ff9af0' : '#ffd36a'), size || 34);
  return v;
}

function hitEntity(e, sx, sy, dir, demo = false) {
  const sc = screenOf(e), pan = clamp((sc.x / O.w) * 2 - 1, -1, 1) * 0.6;
  const now = S.clock;
  if (e.type === 'boss') {
    if (e.rise < 1 || now - e.hitAt < 0.085) return false;
    e.hitAt = now; e.hp--; e.wob = 1; e.pop = 1;
    const p = worldAt(sx, sy, e.obj.position.z + e.radius * 0.8);
    FX.burst(F, p, { size: 0.6, chunks: 12, seeds: 6, goo: 8, light: e.hp % 3 ? 0 : 8 });
    if (e.hp % 3 === 0) FX.splat(O, sx, sy, 0.45);
    crackBoss(e.obj, 1 - e.hp / e.maxHp);
    addScore(20, sx, sy - 20, '#ffb547', 30);
    A.sfx.bossHit(e.hp / e.maxHp); FX.shake(F, S.kids ? 0.06 : 0.12);
    $('bossFill').style.width = (100 * e.hp / e.maxHp) + '%';
    if (!e.roared && e.hp <= e.maxHp / 2) { e.roared = true; A.sfx.bossRoar(); for (let i = 0; i < 3; i++) setTimeout(() => { if (S.boss && S.boss.alive) spawnPumpkin({ from: S.boss.obj.position.clone().add(new THREE.Vector3(0, -0.4, 1.5)), apexT: 0.9, size: 'M' }); }, i * 180); }
    if (e.hp <= 0) bossDie(e);
    return true;
  }
  if (now - e.hitAt < 0.12) return false;
  e.hitAt = now;
  const pos = e.obj.position.clone();
  if (e.type === 'pumpkin' && e.hp > 1) { // big pumpkin: crack first
    e.hp--; e.vel.y = Math.max(e.vel.y, 0) + 2.5; e.vel.x += dir.x * 2; e.spin.multiplyScalar(2.5);
    e.mat = e.mat; e.obj.userData.body.scale.multiplyScalar(0.96);
    FX.burst(F, pos, { size: 0.55, chunks: 10, seeds: 4, goo: 14, light: 12 });
    if (!demo) FX.popup(O, sc.x, sc.y - sc.r - 10, 'CRACK!', '#ffcf8a', 26, 0.6);
    if (!demo) { A.sfx.crack(pan); chainHit(sc, 0); }
    return true;
  }
  removeEnt(e);
  if (e.type === 'pumpkin') {
    const sz = e.radius / 0.56;
    FX.sliceHalves(F, e, dir);
    FX.burst(F, pos, { size: sz * (e.golden ? 1.3 : 1), color: e.golden ? [1.0, 0.8, 0.25] : undefined, light: e.golden ? 70 : 42 });
    if (e.golden) FX.sparkle(F, pos, [1.6, 1.3, 0.5], 60, 5, 0.3);
    FX.splat(O, sc.x, sc.y, sz);
    FX.shake(F, (S.kids ? 0.03 : 0.07) * sz);
    if (!demo) {
      S.smashed++; A.sfx.smash(sz, pan, e.golden);
      addScore(e.pts, sc.x, sc.y - sc.r, e.golden ? '#fff0a0' : null, e.golden ? 44 : 34);
      chainHit(sc, e.pts);
    }
  } else if (e.type === 'ghost') {
    FX.sparkle(F, pos, e.kind === 'time' ? [0.6, 1.6, 1.5] : [1.6, 0.6, 1.6], 90, 5, 0.35);
    FX.ring(F, pos, 4, 0.5, e.kind === 'time' ? 0x80fff0 : 0xff90ff);
    if (!demo) {
      A.sfx.ghostHit(e.kind);
      if (e.kind === 'time') { S.timeLeft += 5; FX.popup(O, sc.x, sc.y - 40, T('bonusTime'), '#9ffff0', 40, 1.2); }
      else { S.mult = 2; S.multT = 8; $('mult').classList.remove('hidden'); FX.popup(O, sc.x, sc.y - 40, T('bonusMult'), '#ffb0ff', 36, 1.2); }
      addScore(25, sc.x, sc.y + 10, '#e8d0ff', 28);
      chainHit(sc, 25);
    }
  } else if (e.type === 'bomb' || e.type === 'cat') {
    if (e.type === 'bomb') {
      FX.burst(F, pos, { size: 1.3, color: [0.8, 0.2, 1.0], shell: [new THREE.Color(0x1a1420), new THREE.Color(0x2a2030), new THREE.Color(0x0e0a12)], seeds: 0, goo: 70, light: 80, speed: 1.4 });
      FX.ring(F, pos, 7, 0.6, 0xff4060); FX.shake(F, 0.55); flash('rgba(255,60,90,0.85)', 0.5);
    } else { FX.sparkle(F, pos, [1.2, 0.9, 1.6], 50, 3, 0.3); }
    if (!demo) {
      A.sfx.bad();
      const v = addScore(S.kids ? -20 : -50, sc.x, sc.y - 30, '#ff5a7a', 40);
      FX.popup(O, sc.x, sc.y - 80, S.kids ? T('shh') : T('ouch'), '#ff9ab0', 30, 1);
      S.chain = 0;
    }
  }
  return true;
}
function chainHit(sc, pts) {
  const now = S.clock;
  if (now - S.lastHitT > 0.45) { S.chain = 0; S.chainPts = 0; }
  S.chain++; S.lastHitT = now; S.chainPos = sc;
  if (S.chain >= 2) {
    S.bestCombo = Math.max(S.bestCombo, S.chain);
    const bonus = 10 * S.chain * (S.chain - 1) - 10 * (S.chain - 1) * (S.chain - 2); // incremental → total 10·n·(n-1)
    addScore(bonus, null, null);
    showCombo(S.chain);
    A.sfx.combo(S.chain);
    FX.shake(F, S.kids ? 0.03 : 0.04 + 0.025 * Math.min(S.chain, 8));
    if (S.chain >= 4) flash(S.chain >= 6 ? 'rgba(255,120,240,0.5)' : 'rgba(255,170,60,0.4)', 0.25);
  }
}
let comboTimer = null;
function showCombo(n) {
  const el = $('combo');
  el.innerHTML = `<span class="c">${T('combo')} x${n}</span><span class="p">+${fmt(10 * n * (n - 1) * S.mult)}</span>`;
  el.classList.toggle('hot', n >= 5);
  el.style.fontSize = `clamp(36px, ${6 + Math.min(n, 9) * 0.6}vw, ${80 + Math.min(n, 9) * 8}px)`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
let bannerTimer = null;
function banner(text, sub, purple = false) {
  const el = $('banner');
  el.innerHTML = `<span>${text}</span>${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.toggle('purple', purple);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function flash(color = 'rgba(255,230,190,0.9)', dur = 0.3) {
  const el = $('flash'); el.style.background = `radial-gradient(circle, ${color}, rgba(255,140,40,0.25))`;
  el.style.transition = 'none'; el.style.opacity = '1'; void el.offsetWidth;
  el.style.transition = `opacity ${dur}s ease-out`; el.style.opacity = '0';
}
function bossDie(e) {
  const pos = e.obj.position.clone();
  removeEnt(e); S.boss = null; S.bossKilled = true;
  S.timeScale = 0.25; S.slowT = 0.9;
  FX.burst(F, pos, { size: 3.2, chunks: 120, seeds: 70, goo: 260, light: 160, speed: 1.6 });
  for (let i = 0; i < 6; i++) setTimeout(() => FX.burst(F, pos.clone().add(new THREE.Vector3(rand(-2, 2), rand(-1.5, 1.5), rand(0, 1))), { size: 1.4, light: 60 }), 80 + i * 90);
  FX.ring(F, pos, 16, 0.8); setTimeout(() => FX.ring(F, pos, 24, 1.0, 0xffc080), 150); setTimeout(() => FX.ring(F, pos, 30, 1.2, 0xc080ff), 320);
  FX.sparkle(F, pos, [1.8, 1.0, 0.4], 160, 9, 0.5);
  FX.shake(F, S.kids ? 0.4 : 1.1); flash('rgba(255,245,220,1)', 0.9); strike(W, S.kids);
  A.sfx.bossDie(); A.setMood('main'); A.duck(0.3, 2.5);
  const sc = { x: O.w / 2, y: O.h * 0.45 };
  addScore(1000, sc.x, sc.y + 90, '#fff0a0', 56);
  banner(T('bossDead'), '+1000', false);
  $('bossBar').classList.add('hidden');
}

// ---------------- input ----------------
let stroke = null;
function ptr(ev) { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
function processSegment(a, b, demo = false) {
  const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy);
  const dir = len > 0.5 ? new THREE.Vector2(dx / len, -dy / len) : new THREE.Vector2(1, 0);
  const pad = demo ? 4 : (stroke && stroke.touch ? 16 : 8);
  let hits = 0;
  for (const e of ents) {
    if (!e.alive) continue;
    if (demo && (e.type !== 'pumpkin')) continue;
    const sc = screenOf(e); if (!sc.on) continue;
    if (segDist(a.x, a.y, b.x, b.y, sc.x, sc.y) < sc.r * 0.95 + pad) { if (hitEntity(e, len > 0.5 ? (a.x + b.x) / 2 : sc.x, len > 0.5 ? (a.y + b.y) / 2 : sc.y, dir, demo)) hits++; }
  }
  return hits;
}
canvas.addEventListener('pointerdown', ev => {
  if (S.state !== 'play' || S.paused) return;
  ev.preventDefault();
  try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
  const p = ptr(ev);
  stroke = { id: ev.pointerId, last: p, t: performance.now(), touch: ev.pointerType !== 'mouse', moved: 0 };
  FX.addTrail(O, p.x, p.y, S.clock);
  processSegment(p, p);
});
canvas.addEventListener('pointermove', ev => {
  if (!stroke || ev.pointerId !== stroke.id) return;
  const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
  for (const ce of (evs.length ? evs : [ev])) {
    const p = ptr(ce), a = stroke.last;
    const d = Math.hypot(p.x - a.x, p.y - a.y); if (d < 2) continue;
    const tnow = performance.now(), sp = d / Math.max(1, tnow - stroke.t);
    stroke.moved += d; stroke.t = tnow;
    FX.addTrail(O, p.x, p.y, S.clock);
    if (sp > 0.6) A.sfx.swipe(sp / 2.2);
    processSegment(a, p); stroke.last = p;
  }
});
const endStroke = ev => { if (stroke && (!ev || ev.pointerId === stroke.id)) stroke = null; };
canvas.addEventListener('pointerup', endStroke); canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (S.state === 'play') e.preventDefault(); }, { passive: false });

// demo blade for attract / end screens
function demoSwipe() {
  const cands = ents.filter(e => e.alive && e.type === 'pumpkin' && e.vel.y < 2.5 && e.obj.position.y > 1).map(e => ({ e, sc: screenOf(e) })).filter(o => o.sc.on && o.sc.x > 30 && o.sc.x < O.w - 30);
  if (!cands.length) return false;
  cands.sort((a, b) => a.sc.x - b.sc.x);
  const first = cands[(Math.random() * cands.length) | 0];
  const group = cands.filter(o => Math.abs(o.sc.y - first.sc.y) < O.h * 0.22).slice(0, 3);
  const pts = group.map(o => o.sc);
  const a = { x: pts[0].x - 90, y: pts[0].y + 40 }, b = { x: pts[pts.length - 1].x + 90, y: pts[pts.length - 1].y - 50 };
  const path = [a, ...pts.map(p => ({ x: p.x, y: p.y })), b];
  const t0 = S.clock, dur = 0.16;
  S.demo = { path, t0, dur, i: 0 };
  return true;
}
function updateDemo() {
  const d = S.demo; if (!d) return;
  const k = clamp((S.clock - d.t0) / d.dur, 0, 1), n = d.path.length - 1, f = k * n;
  const steps = 6;
  for (let s = 0; s <= steps; s++) {
    const ff = Math.min(f, d.i + s / steps * (f - d.i)), seg = Math.min(n - 1, Math.floor(ff)), u = ff - seg;
    const p = { x: lerp(d.path[seg].x, d.path[seg + 1].x, u), y: lerp(d.path[seg].y, d.path[seg + 1].y, u) };
    FX.addTrail(O, p.x, p.y, S.clock, true);
    if (d.prev) processSegment(d.prev, p, true);
    d.prev = p;
  }
  d.i = f;
  if (k >= 1) S.demo = null;
}

// ---------------- round flow ----------------
function clearEnts() { for (const e of ents) if (e.alive) removeEnt(e); ents = []; S.boss = null; }
function startRound() {
  A.unlockAudio();
  clearEnts(); FX.clearFx(F);
  Object.assign(S, { state: 'play', score: 0, timeLeft: 60, elapsed: 0, mult: 1, multT: 0, smashed: 0, bestCombo: 0, chain: 0, lastHitT: -9, boss: null, bossSpawned: false, bossKilled: false, timeScale: 1, slowT: 0, spawnT: 0.25, ghostT: S.kids ? 7 : 9, ghostKind: 'time', tickNext: 5, queue: [], demo: null, paused: false });
  $('score').textContent = '0'; $('mult').classList.add('hidden'); $('bossBar').classList.add('hidden');
  $('start').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  // instant action: a volley already in the air
  for (let i = 0; i < 3; i++) S.queue.push({ at: 0.15 + i * 0.22, fn: () => spawnPumpkin({ apexT: 1.25 }) });
  banner(T('go'), T('goSub'));
  A.sfx.start(); A.setMood('main');
  W.nextBolt = W.t + 4;
}
function endRound() {
  S.state = 'timeup'; S.timeScale = 0.3; S.slowT = 1.1;
  banner(T('timeUp'), null, true); A.sfx.timeUp(); stroke = null;
  if (S.boss) { const b = S.boss; b.leaving = true; }
  setTimeout(showEnd, 1500);
}
function showEnd() {
  S.state = 'end';
  const newBest = S.score > S.best;
  if (newBest) { S.best = S.score; store.set('ps-best', String(S.best)); A.sfx.newBest(); }
  $('hud').classList.add('hidden'); document.body.classList.remove('playing');
  $('end').classList.remove('hidden');
  $('endScore').textContent = fmt(S.score);
  $('newBest').classList.toggle('hidden', !newBest || S.score === 0);
  $('rank').textContent = '🎃 ' + rankFor(S.score);
  $('stSmash').textContent = S.smashed; $('stCombo').textContent = 'x' + S.bestCombo;
  $('stBoss').textContent = S.bossKilled ? '💥' : S.bossSpawned ? '👻' : '—';
  $('stBest').textContent = fmt(S.best); $('bestStart').textContent = fmt(S.best);
  $('name').value = S.nameV;
  updateShare();
}
function result() { return { name: ($('name').value || defName()).trim(), score: S.score, smashed: S.smashed, bestCombo: S.bestCombo, bossKilled: S.bossKilled }; }
function updateShare() {
  $('shareText').textContent = shareText(result(), S.shareLang);
  document.querySelectorAll('#shareLang button').forEach(b => b.classList.toggle('on', b.dataset.sl === S.shareLang));
}
function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
async function copyShare() {
  const txt = shareText(result(), S.shareLang); let ok = false;
  try { if (navigator.clipboard && window.isSecureContext !== false) { await navigator.clipboard.writeText(txt); ok = true; } } catch (e) {}
  if (!ok) { try { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e) {} }
  window.__psLastShare = txt;
  toast(ok ? T('copied') : T('copyFail')); A.sfx.ui();
  return ok;
}
// end-card screenshot: live 3D frame + painted card → 1080×1350 PNG
function renderNow() { if (composer) composer.render(); else renderer.render(scene, camera); }
function makeShot() {
  renderNow();
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
  const src = renderer.domElement, sw = src.width, sh = src.height, k = Math.max(1080 / sw, 1350 / sh);
  g.drawImage(src, (1080 - sw * k) / 2, (1350 - sh * k) / 2, sw * k, sh * k);
  const vg = g.createLinearGradient(0, 0, 0, 1350); vg.addColorStop(0, 'rgba(10,2,20,0.25)'); vg.addColorStop(0.5, 'rgba(10,2,20,0.55)'); vg.addColorStop(1, 'rgba(10,2,20,0.85)');
  g.fillStyle = vg; g.fillRect(0, 0, 1080, 1350);
  const r = result(), L = getLang();
  const txt = (s, x, y, size, fill, glow, font = '900', align = 'center') => { g.font = `${font} ${size}px "Arial Black", Impact, sans-serif`; g.textAlign = align; g.textBaseline = 'middle'; g.shadowColor = glow; g.shadowBlur = size * 0.5; g.fillStyle = fill; g.fillText(s, x, y); g.shadowBlur = 0; };
  const grad = (y0, y1, a, b, c3) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(0.5, b); gr.addColorStop(1, c3); return gr; };
  txt('PUMPKIN', 540, 170, 150, grad(100, 240, '#fff3c4', '#ffb547', '#ff6a0a'), 'rgba(255,120,20,0.9)');
  txt('SMASH', 540, 310, 150, grad(240, 380, '#f6e0ff', '#c47bff', '#7a2cff'), 'rgba(176,77,255,0.9)');
  // glass card
  g.save(); g.fillStyle = 'rgba(34,12,52,0.62)'; g.strokeStyle = 'rgba(255,190,120,0.5)'; g.lineWidth = 3;
  const rr = (x, y, w, h, R) => { g.beginPath(); g.moveTo(x + R, y); g.arcTo(x + w, y, x + w, y + h, R); g.arcTo(x + w, y + h, x, y + h, R); g.arcTo(x, y + h, x, y, R); g.arcTo(x, y, x + w, y, R); g.closePath(); };
  rr(110, 440, 860, 720, 48); g.shadowColor = 'rgba(255,120,30,0.45)'; g.shadowBlur = 50; g.fill(); g.shadowBlur = 0; g.stroke(); g.restore();
  txt(r.name.toUpperCase(), 540, 520, 44, '#f2d0ff', 'rgba(176,77,255,0.9)');
  txt(fmt(r.score, L), 540, 650, 170, grad(570, 730, '#fff3c4', '#ffb547', '#ff6a0a'), 'rgba(255,120,20,0.95)');
  txt('🎃 ' + rankFor(r.score, L), 540, 780, 54, '#ffd9a8', 'rgba(255,140,30,0.9)');
  const st = [[String(r.smashed), T('stSmash', L)], ['x' + r.bestCombo, T('stCombo', L)], [r.bossKilled ? '💥' : '—', T('stBoss', L)]];
  st.forEach(([v, l], i) => { const x = 250 + i * 290; g.fillStyle = 'rgba(255,255,255,0.08)'; rr(x - 120, 860, 240, 170, 26); g.fill(); txt(v, x, 925, 64, '#fff0d0', 'rgba(255,160,60,0.6)'); txt(l.toUpperCase(), x, 995, 24, 'rgba(255,240,230,0.8)', 'rgba(0,0,0,0)', '800'); });
  txt(L === 'de' ? 'Schaffst du mehr?' : 'Can you beat that?', 540, 1100, 40, '#ffffff', 'rgba(255,120,240,0.8)', '800');
  txt('#PumpkinSmash', 540, 1260, 40, '#ffb547', 'rgba(255,120,20,0.8)', '900');
  return c;
}
function saveShot() {
  const c = makeShot(); const url = c.toDataURL('image/png');
  const a = document.createElement('a'); a.href = url; a.download = `pumpkin-smash-${S.score}.png`; document.body.appendChild(a); a.click(); a.remove();
  window.__psLastShot = url.length; toast(T('saved')); A.sfx.ui();
  return url;
}

// ---------------- UI wiring ----------------
function refreshTexts() { applyI18n(S.kids); document.querySelectorAll('#langSeg button').forEach(b => b.classList.toggle('on', b.dataset.lang === getLang())); if (S.state === 'end') updateShare(); qualHint(); }
function setKids(on) {
  S.kids = !!on; store.set('ps-kids', on ? '1' : '0'); $('chkKids').checked = S.kids; $('chkKids2').checked = S.kids;
  A.setKids(S.kids); if (W) { applyQuality(qName()); W.soft = S.kids; } refreshTexts();
  if (S.state !== 'play') clearEnts();
}
$('btnPlay').onclick = () => startRound();
$('btnReplay').onclick = () => startRound();
$('chkKids').onchange = e => setKids(e.target.checked);
$('chkKids2').onchange = e => setKids(e.target.checked);
document.querySelectorAll('#langSeg button').forEach(b => b.onclick = () => { setLang(b.dataset.lang); S.shareLang = getLang(); refreshTexts(); A.sfx.ui(); });
document.querySelectorAll('#shareLang button').forEach(b => b.onclick = () => { S.shareLang = b.dataset.sl; updateShare(); A.sfx.ui(); });
document.querySelectorAll('#qualSeg button').forEach(b => b.onclick = () => { applyQuality(b.dataset.q, true); qualHint(); A.sfx.ui(); });
$('btnSettings').onclick = () => $('settings').classList.remove('hidden');
$('btnCloseSettings').onclick = () => $('settings').classList.add('hidden');
$('settings').onclick = e => { if (e.target.id === 'settings') $('settings').classList.add('hidden'); };
$('volMusic').oninput = e => { A.setMusicVolume(e.target.value / 100); store.set('ps-vm', e.target.value); };
$('volSfx').oninput = e => { A.setSfxVolume(e.target.value / 100); store.set('ps-vs', e.target.value); };
function setMute(m) { A.setMuted(m); $('chkMute').checked = m; $('btnMute').textContent = m ? '🔇' : '🔊'; store.set('ps-mute', m ? '1' : '0'); }
$('chkMute').onchange = e => setMute(e.target.checked);
$('btnMute').onclick = () => setMute(!A.isMuted());
function pause(on) { if (S.state !== 'play') return; S.paused = on; $('pauseScr').classList.toggle('hidden', !on); stroke = null; }
$('btnPause').onclick = () => pause(true);
$('btnResume').onclick = () => pause(false);
$('btnQuit').onclick = () => { pause(false); S.timeLeft = 0; };
$('btnShare').onclick = () => copyShare();
$('btnShot').onclick = () => saveShot();
$('name').oninput = e => { S.nameV = e.target.value; store.set('ps-name', S.nameV); updateShare(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && S.state === 'play') pause(!S.paused); if ((e.key === 'Enter' || e.key === ' ') && (S.state === 'attract' || S.state === 'end') && document.activeElement.tagName !== 'INPUT') startRound(); });
window.addEventListener('resize', resize);

// ---------------- FPS → quality suggestion ----------------
const fps = { n: 0, t0: 0, ema: 60, slow: 0, decided: false };
function qualHint() {
  const sug = suggest();
  $('qualHint').textContent = `${T('suggested')}: ${sug === 'low' ? T('q_low') : sug === 'mid' ? T('q_mid') : sug === 'high' ? T('q_high') : 'Ultra'} (${Math.round(fps.ema)} fps)`;
}
function suggest() { const e = fps.ema; return e >= 56 ? (Math.max(window.screen.width, window.screen.height) >= 1400 && (window.devicePixelRatio || 1) <= 2 ? 'ultra' : 'high') : e >= 42 ? 'high' : e >= 28 ? 'mid' : 'low'; }
function trackFps(realDt, now) {
  fps.n++;
  if (!fps.t0) fps.t0 = now;
  if (now - fps.t0 >= 1000) { const f = fps.n * 1000 / (now - fps.t0); fps.ema = fps.decided ? fps.ema * 0.6 + f * 0.4 : f; fps.n = 0; fps.t0 = now; fps.samples = (fps.samples || 0) + 1; qualHint();
    if (!fps.decided && fps.samples >= 3) { fps.decided = true; if (!S.qualityUser) { const s = suggest(); if (s !== qName()) { applyQuality(s); toast(`${T('autoQ')} ${s === 'low' ? T('q_low') : s === 'mid' ? T('q_mid') : s === 'high' ? T('q_high') : 'Ultra'} (${Math.round(fps.ema)} fps)`); } } }
    if (fps.decided && S.state === 'play' && fps.ema < 26 && qName() !== 'low' && !window.__psNoAutoQ) { fps.slow++; if (fps.slow >= 4) { fps.slow = 0; const order = ['low', 'mid', 'high', 'ultra']; const nq = order[Math.max(0, order.indexOf(qName()) - 1)]; if (!S.qualityUser) { applyQuality(nq); toast(`${T('fpsLow')} ${nq === 'low' ? T('q_low') : T('q_mid')}`); } else toast(`${T('suggested')}: ${nq === 'low' ? T('q_low') : T('q_mid')}`); } } else fps.slow = 0;
  }
}

// ---------------- main loop ----------------
let lastT = performance.now();
function updateEnts(dt) {
  for (const e of ents) {
    if (!e.alive) continue;
    e.t += dt; const o = e.obj;
    if (e.type === 'pumpkin' || e.type === 'bomb' || e.type === 'cat') {
      e.vel.y -= e.g * dt;
      if (e.vel.y < 0) e.vel.z *= Math.pow(0.02, dt);
      o.position.addScaledVector(e.vel, dt);
      o.rotation.x += e.spin.x * dt * 0.6; o.rotation.z += e.spin.z * dt * 0.6;
      // keep faces mostly toward camera: yaw wobble around facing
      o.rotation.y = Math.sin(e.t * 1.3 + e.id) * 0.55 + e.spin.y * 0.15;
      if (e.type === 'bomb') { const s = o.userData.spark; s.scale.setScalar(0.5 + Math.random() * 0.5); if (Math.random() < 0.5) F.points.spawn(o.position.x + 0.25, o.position.y + 1.0, o.position.z, rand(-1, 1), rand(0, 2), rand(-1, 1), 0.12, 0.3, 1.6, 0.9, 0.4, 3, 0.95); o.userData.halo.material.opacity = 0.5 + 0.3 * Math.sin(e.t * 20); }
      if (e.type === 'cat') { o.rotation.x = 0; o.rotation.z = Math.sin(e.t * 2) * 0.1; o.userData.zzz.position.y = 0.95 + Math.sin(e.t * 2.5) * 0.08; }
      if (o.position.y < -3) removeEnt(e);
    } else if (e.type === 'ghost') {
      o.position.x += e.dir * e.speed * dt;
      o.position.y = e.y0 + Math.sin(e.t * 2.4) * 0.45;
      o.rotation.y = -e.dir * 0.4 + Math.sin(e.t * 1.7) * 0.2; o.rotation.z = Math.sin(e.t * 3) * 0.12 * e.dir;
      e.body.scale.set(1 + Math.sin(e.t * 6) * 0.03, 1 - Math.sin(e.t * 6) * 0.03, 1);
      if (Math.abs(o.position.x) > 10) removeEnt(e);
    } else if (e.type === 'boss') {
      if (e.leaving) { o.position.y -= dt * 4; if (o.position.y < -9) { removeEnt(e); S.boss = null; } continue; }
      if (e.rise < 1) { e.rise = Math.min(1, e.rise + dt / 2.6); const k = 1 - Math.pow(1 - e.rise, 3); o.position.y = lerp(-8, 2.4, k); FX.shake(F, S.kids ? 0.05 : 0.12); if (Math.random() < 0.6) F.points.spawn(rand(-3, 3), -0.8, -5 + rand(-1, 1), rand(-1, 1), rand(1, 3), rand(0, 1), rand(0.4, 0.9), 1.0, 0.6, 0.45, 0.8, -0.5, 0.97); }
      else { o.position.x = Math.sin(e.t * 0.55) * 2.0; o.position.y = 2.4 + Math.sin(e.t * 1.4) * 0.25; }
      e.wob = Math.max(0, e.wob - dt * 3);
      o.rotation.z = Math.sin(e.t * 0.9) * 0.08 + Math.sin(e.t * 40) * 0.06 * e.wob; o.rotation.y = Math.sin(e.t * 0.5) * 0.25;
      const s = 1 + 0.05 * e.wob; o.scale.set(s, 1 / s, s);
      e.pop = Math.max(0, (e.pop || 0) - dt * 6);
      o.userData.mat.emissiveIntensity = 1.2 + Math.sin(e.t * 4) * 0.15 + (1 - e.hp / e.maxHp) * 0.3 + e.pop * 0.7;
    }
  }
  ents = ents.filter(e => e.alive);
}
function spawnLogic(dt) {
  if (S.state === 'play') {
    const ramp = clamp(S.elapsed / 40, 0, 1);
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      let interval = lerp(1.0, 0.5, ramp) * (S.kids ? 1.55 : 1) * (S.boss ? 1.7 : 1) * (S.bossKilled ? 0.75 : 1);
      S.spawnT = interval * rand(0.8, 1.2);
      const badP = S.elapsed > 5 && !S.boss ? (S.kids ? 0.07 : lerp(0.07, 0.15, ramp)) : 0;
      if (Math.random() < badP) spawnBad();
      else if (Math.random() < lerp(0.08, 0.28, ramp) && !S.boss) {
        const n = (S.kids ? 3 : 3 + ((Math.random() * 3) | 0)); const t = apexTime(); const y = rand(3, 4.6); const xs = rand(-1.5, 1.5);
        for (let i = 0; i < n; i++) S.queue.push({ at: S.elapsed + i * 0.09, fn: () => spawnPumpkin({ apexT: t, apex: new THREE.Vector3(xs + (i - (n - 1) / 2) * 1.45, y + rand(-0.3, 0.3), rand(-1, 0)), size: Math.random() < 0.5 ? 'S' : 'M' }) });
        S.spawnT += 0.6;
      } else { spawnPumpkin(); if (Math.random() < lerp(0.15, 0.45, ramp)) spawnPumpkin(); }
    }
    S.ghostT -= dt;
    if (S.ghostT <= 0 && !S.boss) { spawnGhost(S.ghostKind); S.ghostKind = S.ghostKind === 'time' ? 'mult' : 'time'; S.ghostT = rand(9, 12); }
    if (!S.bossSpawned && S.elapsed >= (S.kids ? 38 : 40)) spawnBoss();
    S.queue = S.queue.filter(q => { if (S.elapsed >= q.at) { q.fn(); return false; } return true; });
  } else if (S.state === 'attract' || S.state === 'end') {
    S.spawnT -= dt;
    if (S.spawnT <= 0) { S.spawnT = rand(0.45, 0.8); spawnPumpkin({ apexT: rand(1.3, 1.6) }); if (Math.random() < 0.3) spawnPumpkin({ apexT: rand(1.3, 1.6) }); }
    S.demoT -= dt;
    if (S.demoT <= 0 && !S.demo) { if (demoSwipe()) S.demoT = rand(0.9, 1.6); else S.demoT = 0.2; }
    if (S.state === 'attract' && Math.random() < dt / 7 && !ents.some(e => e.type === 'ghost')) spawnGhost(Math.random() < 0.5 ? 'time' : 'mult');
  }
}
function updateHud() {
  const t = Math.max(0, S.timeLeft);
  $('timer').textContent = Math.ceil(t);
  const frac = clamp(t / 60, 0, 1); $('timerRing').style.strokeDashoffset = String(276.5 * (1 - frac));
  $('timerWrap').classList.toggle('low', t <= 10);
  if (S.mult > 1) $('multT').textContent = Math.ceil(S.multT) + 's';
}
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  trackFps(realDt, now);
  if (S.paused) { renderNow(); return; }
  if (S.slowT > 0) { S.slowT -= realDt; if (S.slowT <= 0) S.timeScale = 1; }
  const dt = realDt * S.timeScale;
  S.clock += dt;
  if (S.state === 'play') {
    S.elapsed += dt; S.timeLeft -= dt;
    if (S.multT > 0) { S.multT -= dt; if (S.multT <= 0) { S.mult = 1; $('mult').classList.add('hidden'); } }
    if (S.timeLeft <= S.tickNext && S.tickNext > 0) { A.sfx.tick(false); S.tickNext -= 1; }
    if (S.timeLeft <= 0) { S.timeLeft = 0; endRound(); }
    updateHud();
  }
  spawnLogic(dt);
  updateDemo();
  updateEnts(dt);
  FX.updateFx(F, dt);
  updateWorld(W, realDt, camera);
  // camera: gentle drift + shake
  const sh = F.shakeAmp, tt = S.clock;
  camera.position.set(CAM.x + Math.sin(tt * 0.23) * 0.25 + (Math.random() - 0.5) * sh * 0.6, CAM.y + Math.sin(tt * 0.31) * 0.12 + (Math.random() - 0.5) * sh * 0.6, CAM.z);
  camera.lookAt(LOOK.x + Math.sin(tt * 0.23) * 0.12, LOOK.y, LOOK.z);
  camera.rotation.z += (Math.random() - 0.5) * sh * 0.02;
  renderNow();
  FX.drawOverlay(O, realDt, S.clock, S.kids);
}

// ---------------- boot ----------------
function boot() {
  buildMats();
  applyQuality(S.quality || 'high');
  setLang(getLang()); S.shareLang = getLang();
  $('chkKids').checked = S.kids; $('chkKids2').checked = S.kids; A.setKids(S.kids);
  const vm = +store.get('ps-vm', '60'), vs = +store.get('ps-vs', '90');
  $('volMusic').value = vm; $('volSfx').value = vs; A.setMusicVolume(vm / 100); A.setSfxVolume(vs / 100);
  setMute(store.get('ps-mute', '0') === '1');
  $('bestStart').textContent = fmt(S.best); $('name').value = S.nameV;
  refreshTexts();
  // first frame = action: pumpkins already mid-flight, one bursting, a blade trail across the sky
  resize();
  for (let i = 0; i < 6; i++) { const e = spawnPumpkin({ apexT: rand(1.3, 1.6) }); const pre = rand(0.5, 1.5); for (let k = 0; k < 10; k++) { e.vel.y -= e.g * pre / 10; e.obj.position.addScaledVector(e.vel, pre / 10); } }
  spawnGhost('mult').obj.position.x = -3.5;
  camera.updateMatrixWorld();
  const victim = ents.filter(e => e.type === 'pumpkin' && e.obj.position.y > 0.5).sort((a, b) => Math.abs(a.obj.position.x) - Math.abs(b.obj.position.x))[0];
  if (victim) { const sc = screenOf(victim); hitEntity(victim, sc.x, sc.y, new THREE.Vector2(1, 0.3), true); for (let k = 0; k < 4; k++) FX.updateFx(F, 0.03); for (let i = 0; i < 8; i++) FX.addTrail(O, sc.x - 160 + i * 40, sc.y + 50 - i * 14, S.clock - 0.06 + i * 0.008, true); }
  updateWorld(W, 0.016, camera);
  renderNow(); FX.drawOverlay(O, 0, S.clock, S.kids);
  document.body.classList.add('ready');
  requestAnimationFrame(t => { lastT = t; frame(t); });
}

// test / automation hooks
window.__ps = {
  S, ents: () => ents.filter(e => e.alive).map(e => ({ id: e.id, type: e.type, kind: e.kind, hp: e.hp, ...screenOf(e), pos: e.obj.position.toArray() })),
  start: startRound, applyQuality, setKids, setLang: l => { setLang(l); refreshTexts(); }, spawnPumpkin: o => spawnPumpkin(o || {}).id, spawnGhost: k => spawnGhost(k || 'time').id, spawnBad: () => spawnBad().id, spawnBoss: () => spawnBoss().id,
  freeze(id, x, y, z) { const e = ents.find(e => e.id === id); if (!e) return false; e.obj.position.set(x, y, z); e.vel && e.vel.set(0, 0, 0); e.g = 0; if (e.type === 'ghost') { e.speed = 0; e.y0 = y; } return true; },
  setTime: t => { S.timeLeft = t; }, setElapsed: t => { S.elapsed = t; }, hitBoss: n => { const b = S.boss; if (!b) return 0; b.rise = 1; let k = 0; for (let i = 0; i < n && b.alive; i++) { b.hitAt = -1; const sc = screenOf(b); hitEntity(b, sc.x, sc.y, new THREE.Vector2(1, 0)); k++; } return k; },
  shareText: l => shareText(result(), l || S.shareLang), copyShare, makeShot: () => makeShot().toDataURL('image/png').length,
  ui: { showCombo, banner, flash }, slowmo(k, t = 999) { S.timeScale = k; S.slowT = t; },
  sounds: () => A.soundsReady().then(n => ({ n, names: A.soundNames() })), sfx: A.sfx, analyser: A.getAnalyser, audio: A, fps: () => fps.ema, quality: () => qName(), renderer, F, endRound
};
boot();
