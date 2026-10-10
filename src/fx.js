// Juice: pumpkin chunks, seeds, goo/spark points, sliced halves, shockwave rings, hit lights, 2D swipe trail + popups.
import * as THREE from 'three';
import { pumpkinGeometry } from './pumpkins.js';

const G = 14;
const rand = (a, b) => a + Math.random() * (b - a);
const TMP = new THREE.Object3D(), C = new THREE.Color();

class InstPool {
  constructor(scene, geo, mat, n, gravity = G) {
    this.n = n; this.g = gravity;
    this.mesh = new THREE.InstancedMesh(geo, mat, n); this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.r = new Float32Array(n * 3); this.w = new Float32Array(n * 3);
    this.s = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n); this.i = 0; this.hi = 0;
    for (let k = 0; k < n; k++) { TMP.scale.setScalar(0); TMP.updateMatrix(); this.mesh.setMatrixAt(k, TMP.matrix); }
    scene.add(this.mesh);
  }
  spawn(x, y, z, vx, vy, vz, s, life, color) {
    const k = this.i; this.i = (this.i + 1) % this.n; this.hi = Math.max(this.hi, k + 1);
    this.p.set([x, y, z], k * 3); this.v.set([vx, vy, vz], k * 3); this.r.set([rand(0, 6), rand(0, 6), rand(0, 6)], k * 3); this.w.set([rand(-12, 12), rand(-12, 12), rand(-12, 12)], k * 3);
    this.s[k] = s; this.life[k] = life; this.max[k] = life;
    if (color) this.mesh.setColorAt(k, color);
  }
  update(dt, floorY = -1.0) {
    const { p, v, r, w } = this;
    let any = false;
    for (let k = 0; k < this.hi; k++) {
      if (this.life[k] <= 0) continue;
      any = true; this.life[k] -= dt; const j = k * 3;
      v[j + 1] -= this.g * dt; v[j] *= 0.995; v[j + 2] *= 0.995;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      if (p[j + 1] < floorY) { p[j + 1] = floorY; v[j + 1] *= -0.3; v[j] *= 0.6; v[j + 2] *= 0.6; w[j] *= 0.5; w[j + 2] *= 0.5; }
      r[j] += w[j] * dt; r[j + 1] += w[j + 1] * dt; r[j + 2] += w[j + 2] * dt;
      const fade = Math.min(1, this.life[k] / 0.35);
      TMP.position.set(p[j], p[j + 1], p[j + 2]); TMP.rotation.set(r[j], r[j + 1], r[j + 2]); TMP.scale.setScalar(this.life[k] > 0 ? this.s[k] * fade : 0);
      TMP.updateMatrix(); this.mesh.setMatrixAt(k, TMP.matrix);
    }
    if (any || this._was) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
    this._was = any;
  }
  clear() { this.life.fill(0); for (let k = 0; k < this.n; k++) { TMP.scale.setScalar(0); TMP.updateMatrix(); this.mesh.setMatrixAt(k, TMP.matrix); } this.mesh.instanceMatrix.needsUpdate = true; }
}

class PointPool {
  constructor(scene, n) {
    this.n = n; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.s0 = new Float32Array(n); this.grav = new Float32Array(n); this.drag = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 500 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a = a * a; gl_FragColor = vec4(vC * a * vA, a * vA); }`
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, size, life, r, g, b, grav = 6, drag = 0.98) {
    const k = this.i; this.i = (this.i + 1) % this.n; const j = k * 3;
    this.pos[j] = x; this.pos[j + 1] = y; this.pos[j + 2] = z; this.v[j] = vx; this.v[j + 1] = vy; this.v[j + 2] = vz;
    this.col[j] = r; this.col[j + 1] = g; this.col[j + 2] = b; this.size[k] = size; this.s0[k] = size; this.life[k] = life; this.max[k] = life; this.grav[k] = grav; this.drag[k] = drag; this.alpha[k] = 1;
  }
  update(dt) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) { if (this.alpha[k] !== 0) { this.alpha[k] = 0; } continue; }
      this.life[k] -= dt; const j = k * 3, d = Math.pow(this.drag[k], dt * 60);
      this.v[j] *= d; this.v[j + 1] = this.v[j + 1] * d - this.grav[k] * dt; this.v[j + 2] *= d;
      this.pos[j] += this.v[j] * dt; this.pos[j + 1] += this.v[j + 1] * dt; this.pos[j + 2] += this.v[j + 2] * dt;
      const t = Math.max(0, this.life[k] / this.max[k]);
      this.alpha[k] = Math.min(1, t * 2.2);
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = true; a.alpha.needsUpdate = true; a.color.needsUpdate = true; a.size.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); }
}

export function createFx(scene, camera, renderer) {
  const F = { scene, camera, scale: 1, shakeAmp: 0, shakeT: 0 };
  const shardGeo = new THREE.IcosahedronGeometry(1, 0); shardGeo.scale(1, 0.38, 0.8);
  F.chunks = new InstPool(scene, shardGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, emissive: 0x401400, emissiveIntensity: 0.8 }), 520);
  const seedGeo = new THREE.SphereGeometry(1, 6, 4); seedGeo.scale(0.6, 0.25, 1);
  F.seeds = new InstPool(scene, seedGeo, new THREE.MeshStandardMaterial({ color: 0xfff1c8, roughness: 0.4, emissive: 0x3a2a10 }), 520, 16);
  F.points = new PointPool(scene, 1600);
  // pooled hit lights
  F.lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xff8a2a, 0, 10, 1.6); scene.add(l); return l; });
  F.li = 0;
  // shockwave rings
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const r = g.createRadialGradient(128, 128, 70, 128, 128, 126); r.addColorStop(0, 'rgba(255,200,120,0)'); r.addColorStop(0.8, 'rgba(255,170,80,0.0)'); r.addColorStop(0.9, 'rgba(255,240,210,0.9)'); r.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  F.rings = [];
  for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); s.visible = false; scene.add(s); F.rings.push({ s, t: 1, dur: 0.5, size: 3 }); }
  // sliced halves (local clipping planes)
  renderer.localClippingEnabled = true;
  F.halves = [];
  F.halfMats = new Map();
  return F;
}

function halfMat(F, base, idx) {
  // one clone per (pool slot); shares textures/program with base
  const m = base.clone(); m.onBeforeCompile = base.onBeforeCompile; m.customProgramCacheKey = () => 'half';
  m.clippingPlanes = [new THREE.Plane()]; m.clipShadows = false;
  return m;
}

export function sliceHalves(F, ent, dir) {
  const r = ent.radius, mat = ent.mat;
  const n = new THREE.Vector3(-dir.y, dir.x, 0).normalize(); // plane normal ⟂ swipe in screen plane
  for (const sgn of [1, -1]) {
    let h = F.halves.find(h => h.life <= 0);
    if (!h) { if (F.halves.length >= 14) h = F.halves[0]; else { h = { mesh: new THREE.Mesh(pumpkinGeometry(ent.geoKind || 'n'), halfMat(F, mat)), life: 0 }; h.mesh.frustumCulled = false; F.scene.add(h.mesh); F.halves.push(h); } }
    if (h.mesh.material.map !== mat.map) { h.mesh.material.map = mat.map; h.mesh.material.emissiveMap = mat.emissiveMap; h.mesh.material.emissiveIntensity = mat.emissiveIntensity * 0.7; }
    h.mesh.geometry = pumpkinGeometry(ent.geoKind || 'n');
    h.mesh.visible = true; h.mesh.position.copy(ent.obj.position); h.mesh.quaternion.copy(ent.body.getWorldQuaternion(new THREE.Quaternion())); h.mesh.scale.setScalar(r);
    h.localN = n.clone().multiplyScalar(sgn).applyQuaternion(h.mesh.quaternion.clone().invert());
    h.v = new THREE.Vector3(ent.vel.x * 0.4, Math.max(0, ent.vel.y * 0.3), 0).addScaledVector(n, sgn * rand(2.5, 4)).add(new THREE.Vector3(0, rand(1, 3), rand(-0.3, 0.3)));
    h.w = new THREE.Vector3(rand(-3, 3), rand(-3, 3), sgn * rand(3, 6)); h.life = 1.3; h.max = 1.3; h.r0 = r;
  }
}

export function burst(F, pos, opts = {}) {
  const k = F.scale, size = opts.size || 1, col = opts.color || [1.0, 0.45, 0.08];
  const nChunk = Math.round((opts.chunks ?? 22) * k * size), nSeed = Math.round((opts.seeds ?? 16) * k * size), nGoo = Math.round((opts.goo ?? 30) * k * size);
  const shell = opts.shell || [new THREE.Color(0xff7a14), new THREE.Color(0xffa030), new THREE.Color(0xe0560a), new THREE.Color(0xffd070)];
  const sp = opts.speed || 1;
  for (let i = 0; i < nChunk; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-0.4, 1), rand(-0.35, 0.25)).normalize().multiplyScalar(rand(3, 8) * sp);
    F.chunks.spawn(pos.x + v.x * 0.05, pos.y + v.y * 0.05, pos.z, v.x, v.y + 2, v.z, rand(0.06, 0.16) * Math.sqrt(size), rand(1.1, 1.8), shell[i % shell.length]);
  }
  for (let i = 0; i < nSeed; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-0.3, 0.25)).normalize().multiplyScalar(rand(2, 6) * sp);
    F.seeds.spawn(pos.x, pos.y, pos.z, v.x, v.y + 2, v.z, rand(0.035, 0.06) * Math.sqrt(size), rand(0.9, 1.6));
  }
  for (let i = 0; i < nGoo; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-0.4, 0.4)).normalize().multiplyScalar(rand(1, 7) * sp);
    const hot = Math.random() < 0.35;
    F.points.spawn(pos.x, pos.y, pos.z, v.x, v.y + 1.5, v.z, rand(0.08, 0.26) * Math.sqrt(size), rand(0.4, 0.9), hot ? 1.0 : col[0] * 0.75, hot ? 0.7 : col[1] * 0.7, hot ? 0.3 : col[2] * 0.6, 7, 0.965);
  }
  // hot core flash
  F.points.spawn(pos.x, pos.y, pos.z, 0, 0, 0, 1.5 * Math.sqrt(size), 0.14, 0.9, 0.55, 0.2, 0, 1);
  if ((opts.light ?? 40) > 0) { const l = F.lights[F.li = (F.li + 1) % F.lights.length]; l.position.copy(pos); l.position.z += 0.8; l.intensity = (opts.light ?? 40) * 0.35 * Math.sqrt(size); l.color.setRGB(col[0], col[1] * 1.2, col[2] * 2 + 0.1); }
  if (opts.ring !== false) ring(F, pos, 1.7 * size, 0.35, 0xffa050);
}

export function sparkle(F, pos, rgb, n = 40, speed = 4, size = 0.25) {
  for (let i = 0; i < n * F.scale; i++) {
    const v = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.5, speed));
    F.points.spawn(pos.x, pos.y, pos.z, v.x, v.y, v.z, rand(size * 0.4, size * 1.1), rand(0.5, 1.2), rgb[0] * 0.6, rgb[1] * 0.6, rgb[2] * 0.6, 1.5, 0.95);
  }
}

export function ring(F, pos, size = 3, dur = 0.5, tint) {
  const r = F.rings.find(r => r.t >= 1) || F.rings[0];
  r.s.position.copy(pos); r.t = 0; r.dur = dur; r.size = size; r.s.visible = true; r.s.material.color.set(tint || 0xffffff);
}

export function shake(F, amp) { F.shakeAmp = Math.max(F.shakeAmp, amp); }

export function updateFx(F, dt) {
  F.chunks.update(dt); F.seeds.update(dt); F.points.update(dt);
  for (const l of F.lights) l.intensity *= Math.pow(0.0015, dt);
  for (const r of F.rings) {
    if (r.t >= 1) continue; r.t = Math.min(1, r.t + dt / r.dur);
    const e = 1 - Math.pow(1 - r.t, 3); r.s.scale.setScalar(r.size * (0.25 + e)); r.s.material.opacity = Math.pow(1 - r.t, 1.5) * 0.55; if (r.t >= 1) r.s.visible = false;
  }
  for (const h of F.halves) {
    if (h.life <= 0) continue;
    h.life -= dt; h.v.y -= G * dt; h.mesh.position.addScaledVector(h.v, dt);
    h.mesh.rotation.x += h.w.x * dt; h.mesh.rotation.y += h.w.y * dt; h.mesh.rotation.z += h.w.z * dt;
    const k = Math.min(1, h.life / 0.3); h.mesh.scale.setScalar(h.r0 * Math.max(0.001, k));
    h.mesh.updateMatrixWorld();
    const n = h.localN.clone().applyQuaternion(h.mesh.quaternion).negate();
    h.mesh.material.clippingPlanes[0].setFromNormalAndCoplanarPoint(n, h.mesh.position);
    if (h.life <= 0) h.mesh.visible = false;
  }
  F.shakeAmp *= Math.pow(0.004, dt);
}
export function clearFx(F) { F.chunks.clear(); F.seeds.clear(); F.points.clear(); for (const h of F.halves) { h.life = 0; h.mesh.visible = false; } }

// ---------- 2D overlay: glowing swipe trail, score popups, juice splats ----------
export function createOverlay(canvas) {
  const O = { canvas, g: canvas.getContext('2d'), trail: [], pops: [], splats: [], dpr: 1, auto: [] };
  return O;
}
export function resizeOverlay(O, w, h, dpr) { O.dpr = dpr; O.canvas.width = Math.round(w * dpr); O.canvas.height = Math.round(h * dpr); O.w = w; O.h = h; }
export function addTrail(O, x, y, t, demo = false) { (demo ? O.auto : O.trail).push({ x, y, t }); }
export function popup(O, x, y, text, color = '#ffd36a', size = 34, life = 0.9) { O.pops.push({ x, y, text, color, size, t: 0, life }); }
export function splat(O, x, y, size = 1, color = [255, 140, 30]) {
  for (let i = 0; i < 7; i++) O.splats.push({ x: x + rand(-50, 50) * size, y: y + rand(-40, 40) * size, r: rand(4, 15) * size, t: 0, life: rand(0.6, 1.1), c: color, vy: rand(10, 40) });
}
function drawTrail(g, pts, now, kids) {
  const L = 0.17;
  const P = pts.filter(p => now - p.t < L);
  if (P.length < 2) return P;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.globalCompositeOperation = 'lighter';
  for (const pass of [{ w: 26, c: kids ? 'rgba(190,120,255,0.20)' : 'rgba(255,110,20,0.22)', blur: 24 }, { w: 13, c: kids ? 'rgba(220,170,255,0.55)' : 'rgba(255,160,50,0.6)', blur: 12 }, { w: 4.5, c: 'rgba(255,250,235,0.95)', blur: 0 }]) {
    g.shadowColor = pass.c; g.shadowBlur = pass.blur; g.strokeStyle = pass.c;
    for (let i = 1; i < P.length; i++) {
      const k = 1 - (now - P[i].t) / L; if (k <= 0) continue;
      g.lineWidth = pass.w * (0.25 + 0.75 * k);
      g.beginPath(); g.moveTo(P[i - 1].x, P[i - 1].y); g.lineTo(P[i].x, P[i].y); g.stroke();
    }
  }
  g.restore();
  return P;
}
export function drawOverlay(O, dt, now, kids) {
  const g = O.g; g.setTransform(O.dpr, 0, 0, O.dpr, 0, 0); g.clearRect(0, 0, O.w, O.h);
  for (const s of O.splats) { s.t += dt; s.y += s.vy * dt; }
  O.splats = O.splats.filter(s => s.t < s.life);
  for (const s of O.splats) { const a = (1 - s.t / s.life) * 0.6, r = s.r * (0.6 + 0.4 * Math.min(1, s.t * 8)); const gr = g.createRadialGradient(s.x - r * 0.3, s.y - r * 0.3, 0, s.x, s.y, r); gr.addColorStop(0, `rgba(255,235,170,${a})`); gr.addColorStop(0.35, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${a * 0.8})`); gr.addColorStop(1, `rgba(${s.c[0]},${s.c[1]},${s.c[2]},0)`); g.fillStyle = gr; g.beginPath(); g.arc(s.x, s.y, r, 0, 7); g.fill(); }
  O.trail = drawTrail(g, O.trail, now, kids);
  O.auto = drawTrail(g, O.auto, now, kids);
  for (const p of O.pops) p.t += dt;
  O.pops = O.pops.filter(p => p.t < p.life);
  for (const p of O.pops) {
    const k = p.t / p.life, pop = k < 0.15 ? 0.6 + k / 0.15 * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
    g.save(); g.translate(p.x, p.y - k * 60); g.scale(pop, pop); g.globalAlpha = Math.min(1, (1 - k) * 2.5);
    g.font = `900 ${p.size}px "Arial Black", "Arial Rounded MT Bold", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = p.size * 0.22; g.strokeStyle = 'rgba(30,6,40,0.85)'; g.strokeText(p.text, 0, 0);
    g.shadowColor = p.color; g.shadowBlur = 16; g.fillStyle = p.color; g.fillText(p.text, 0, 0); g.restore();
  }
}
