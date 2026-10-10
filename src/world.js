// Night pumpkin-field graveyard: purple starry sky, big moon, layered ground fog, dead trees, gravestones,
// lanterns, candles, glowing jack-o'-lanterns, bats, periodic lightning.
import * as THREE from 'three';

export const QUALITY = {
  low:   { pr: 0.85, bloom: 0,    stars: 500,  fogCards: 4, trees: 5, stones: 8,  candles: 4, bats: 6,  field: 10, particles: 0.45, halfBloom: true },
  mid:   { pr: 1.0,  bloom: 0.9,  stars: 900,  fogCards: 6, trees: 7, stones: 12, candles: 6, bats: 10, field: 16, particles: 0.7,  halfBloom: true },
  high:  { pr: 1.5,  bloom: 1.0,  stars: 1400, fogCards: 8, trees: 9, stones: 16, candles: 9, bats: 14, field: 22, particles: 1.0,  halfBloom: false },
  ultra: { pr: 2.0,  bloom: 1.15, stars: 2200, fogCards: 11, trees: 11, stones: 22, candles: 12, bats: 20, field: 30, particles: 1.35, halfBloom: false }
};

const rand = (a, b) => a + Math.random() * (b - a);
let seed = 1337;
const srand = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (seed / 2147483647) * (b - a); };

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function glowTexture(inner = 'rgba(255,200,120,1)', mid = 'rgba(255,120,30,0.35)') {
  return canvasTex(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, inner); r.addColorStop(0.25, mid); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}

function makeSky() {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { flash: { value: 0 }, time: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform float flash; uniform float time;
      void main(){
        float h = vP.y;
        vec3 top = vec3(0.012,0.004,0.04), mid = vec3(0.075,0.018,0.16), hor = vec3(0.26,0.06,0.24);
        vec3 c = mix(hor, mid, smoothstep(-0.02, 0.12, h));
        c = mix(c, top, smoothstep(0.12, 0.5, h));
        // moon-side warm glow
        vec3 md = normalize(vec3(0.42, 0.36, -1.0));
        float m = max(dot(vP, md), 0.0);
        c += vec3(0.55,0.32,0.20) * pow(m, 60.0) * 0.5 + vec3(0.22,0.08,0.28) * pow(m, 6.0) * 0.3;
        c += vec3(0.75,0.72,1.0) * flash * (0.35 + 0.65 * smoothstep(0.0, 0.5, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`
  });
  return new THREE.Mesh(geo, mat);
}

function makeStars(n) {
  const pos = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const th = rand(0, Math.PI * 2), y = Math.pow(Math.random(), 0.7) * 0.92 + 0.06;
    const r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(th) * r * 350; pos[i * 3 + 1] = y * 350; pos[i * 3 + 2] = Math.sin(th) * r * 350;
    sz[i] = Math.random() < 0.06 ? rand(2.6, 4.2) : rand(0.8, 2.0); ph[i] = rand(0, 6.28);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(sz, 1)); g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { time: { value: 0 }, pr: { value: 1 } },
    vertexShader: `attribute float size; attribute float phase; uniform float time; uniform float pr; varying float vA;
      void main(){ vA = 0.55 + 0.45 * sin(time * (1.3 + phase * 0.4) + phase * 7.0); gl_PointSize = size * pr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vec3(1.0,0.93,0.98) * a * vA, a * vA); }`
  });
  return new THREE.Points(g, m);
}

function makeMoon() {
  const g = new THREE.Group();
  const tex = canvasTex(512, 512, (c) => {
    const cx = 256, cy = 256, r = 150;
    const mg = c.createRadialGradient(cx - 40, cy - 40, 10, cx, cy, r);
    mg.addColorStop(0, '#fffaf0'); mg.addColorStop(0.6, '#ffe9c0'); mg.addColorStop(1, '#f0c890');
    c.fillStyle = mg; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip();
    for (const [x, y, rr, a] of [[200, 200, 34, 0.16], [300, 270, 26, 0.14], [230, 320, 20, 0.12], [320, 180, 14, 0.12], [170, 280, 12, 0.1], [280, 350, 30, 0.1], [350, 300, 10, 0.12]]) {
      const cg = c.createRadialGradient(x + 4, y + 4, 1, x, y, rr); cg.addColorStop(0, `rgba(150,110,80,${a})`); cg.addColorStop(1, 'rgba(150,110,80,0)');
      c.fillStyle = cg; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill();
    }
    const sh = c.createRadialGradient(cx + 70, cy + 70, r * 0.6, cx, cy, r * 1.15); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(120,60,40,0.35)');
    c.fillStyle = sh; c.fillRect(0, 0, 512, 512); c.restore();
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, color: new THREE.Color(1.6, 1.45, 1.25) }));
  moon.scale.set(44, 44, 1); g.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,220,170,0.9)', 'rgba(255,140,90,0.22)'), fog: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.45 }));
  halo.scale.set(120, 120, 1); g.add(halo);
  // drifting cloud wisps in front of the moon
  const cloudTex = canvasTex(256, 64, (c) => {
    c.filter = 'blur(6px)';
    for (let i = 0; i < 40; i++) { const x = 40 + i * 4.4 + rand(-6, 6), y = 32 + rand(-5, 5), r = rand(14, 24); const cg = c.createRadialGradient(x, y, 0, x, y, r); cg.addColorStop(0, 'rgba(30,12,48,0.22)'); cg.addColorStop(1, 'rgba(30,12,48,0)'); c.fillStyle = cg; c.fillRect(0, 0, 256, 64); }
  });
  const clouds = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: 0.9 }));
    s.scale.set(rand(90, 130), rand(14, 20), 1); s.position.set(rand(-40, 40), rand(-14, 10), 3 + i); s.userData.v = rand(1.2, 2.6) * (i % 2 ? 1 : -1);
    g.add(s); clouds.push(s);
  }
  g.userData.clouds = clouds; g.userData.halo = halo;
  return g;
}

function barkMat() { return new THREE.MeshStandardMaterial({ color: 0x120a10, roughness: 1, metalness: 0 }); }
function makeTree(scale = 1) {
  const g = new THREE.Group(); const mat = barkMat();
  const branch = (from, dir, len, rad, depth) => {
    const to = from.clone().add(dir.clone().multiplyScalar(len));
    const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(srand(-0.15, 0.15), srand(-0.05, 0.1), srand(-0.15, 0.15)).multiplyScalar(len));
    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const tube = new THREE.TubeGeometry(curve, 5, rad, 5, false);
    // taper: scale radius along tube
    const p = tube.attributes.position, uv = tube.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const t = uv.getX(i); const c = curve.getPoint(t); const k = 1 - 0.55 * t;
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, c.y + (p.getY(i) - c.y) * k, c.z + (p.getZ(i) - c.z) * k);
    }
    tube.computeVertexNormals();
    g.add(new THREE.Mesh(tube, mat));
    if (depth <= 0) return;
    const n = depth > 2 ? 2 : srand() < 0.5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const d = dir.clone().add(new THREE.Vector3(srand(-0.9, 0.9), srand(-0.1, 0.5), srand(-0.5, 0.5))).normalize();
      if (d.y < -0.2) d.y = -0.2;
      branch(to, d.normalize(), len * srand(0.55, 0.78), rad * 0.55, depth - 1);
    }
  };
  branch(new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(srand(-0.15, 0.15), 1, 0).normalize(), 2.6, 0.22, 4);
  g.scale.setScalar(scale);
  return g;
}

function makeStone(stoneMat, mossMat) {
  const g = new THREE.Group();
  const w = srand(0.7, 1.1), h = srand(1.0, 1.7);
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 10 });
  geo.translate(0, 0, -0.09);
  const m = new THREE.Mesh(geo, stoneMat); g.add(m);
  if (srand() < 0.5) { const cross = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.03), mossMat); cross.position.set(0, h * 0.62, 0.13); g.add(cross); const bar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.03), mossMat); bar.position.set(0, h * 0.68, 0.13); g.add(bar); }
  g.rotation.z = srand(-0.12, 0.12); g.rotation.y = srand(-0.3, 0.3);
  return g;
}

let faceTexCache = null;
function smallJackTex() {
  if (faceTexCache) return faceTexCache;
  faceTexCache = canvasTex(256, 128, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = '#ffb040'; c.shadowColor = '#ff8a20'; c.shadowBlur = 6;
    c.beginPath(); c.moveTo(46, 50); c.lineTo(58, 32); c.lineTo(70, 50); c.fill();
    c.beginPath(); c.moveTo(86, 50); c.lineTo(98, 32); c.lineTo(110, 50); c.fill();
    c.beginPath(); c.moveTo(40, 66); for (let i = 0; i <= 8; i++) c.lineTo(40 + i * 10, 66 + (i % 2 ? 6 : 0) + Math.sin(i / 8 * Math.PI) * 14); for (let i = 8; i >= 0; i--) c.lineTo(40 + i * 10, 74 + Math.sin(i / 8 * Math.PI) * 22); c.fill();
  });
  return faceTexCache;
}

function makeLantern(lightOn) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x14121a, metalness: 0.7, roughness: 0.45 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8), iron); post.position.y = 0.8; g.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), iron); arm.position.set(0.25, 2.05, 0); g.add(arm);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.36, 6), new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a2a, emissiveIntensity: 3.2 }));
  glass.position.set(0.5, 1.8, 0); g.add(glass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 6), iron); cap.position.set(0.5, 2.06, 0); g.add(cap);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,140,0.95)', 'rgba(255,120,40,0.3)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(2.2, 2.2, 1); halo.position.copy(glass.position); g.add(halo);
  g.userData.glass = glass; g.userData.halo = halo;
  if (lightOn) { const l = new THREE.PointLight(0xff9a40, 6, 9, 1.6); l.position.copy(glass.position); g.add(l); g.userData.light = l; }
  return g;
}

function makeCandle(flameTex) {
  const g = new THREE.Group();
  const h = srand(0.18, 0.4);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 8), new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.6, emissive: 0x3a1a08, emissiveIntensity: 0.6 }));
  wax.position.y = h / 2; g.add(wax);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  f.scale.set(0.16, 0.3, 1); f.position.y = h + 0.1; g.add(f);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,190,110,0.6)', 'rgba(255,110,30,0.15)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  halo.scale.set(0.9, 0.9, 1); halo.position.y = h + 0.1; g.add(halo);
  g.userData.flame = f; g.userData.halo = halo; g.userData.ph = srand(0, 9);
  return g;
}

function makeBat(mat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat); body.scale.set(1, 0.8, 1.4); g.add(body);
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(0.34, 0.12); wingShape.lineTo(0.42, -0.02); wingShape.lineTo(0.33, -0.04); wingShape.lineTo(0.26, -0.1); wingShape.lineTo(0.18, -0.05); wingShape.lineTo(0.1, -0.1); wingShape.lineTo(0, -0.04);
  const wg = new THREE.ShapeGeometry(wingShape);
  const wL = new THREE.Group(), wR = new THREE.Group();
  const mL = new THREE.Mesh(wg, mat); mL.rotation.x = -Math.PI / 2; wL.add(mL);
  const mR = new THREE.Mesh(wg, mat); mR.rotation.x = -Math.PI / 2; mR.scale.x = -1; wR.add(mR);
  g.add(wL, wR); g.userData.wings = [wL, wR];
  return g;
}

function makeFogTex() {
  return canvasTex(512, 256, (c) => {
    for (let i = 0; i < 70; i++) {
      const x = rand(0, 512), y = rand(90, 220), r = rand(30, 90);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(200,170,230,0.20)'); g.addColorStop(1, 'rgba(200,170,230,0)');
      c.fillStyle = g; c.fillRect(0, 0, 512, 256);
    }
    // fade top, keep dense bottom; fade horizontal edges for seamless overlap
    c.globalCompositeOperation = 'destination-in';
    const v = c.createLinearGradient(0, 0, 0, 256); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.45, 'rgba(0,0,0,0.6)'); v.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = v; c.fillRect(0, 0, 512, 256);
    const h = c.createLinearGradient(0, 0, 512, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.15, 'rgba(0,0,0,1)'); h.addColorStop(0.85, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = h; c.fillRect(0, 0, 512, 256);
  });
}

function makeBolt() {
  const pts = []; let x = 0, y = 0;
  for (let i = 0; i < 14; i++) { pts.push(new THREE.Vector3(x, y, 0)); x += rand(-2.2, 2.2); y -= rand(2.4, 4.2); }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.12, 4, false);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 4), transparent: true, opacity: 0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  return m;
}

export function createWorld(scene, qualityName) {
  const q = QUALITY[qualityName] || QUALITY.high;
  seed = 1337;
  const W = { root: new THREE.Group(), t: 0, nextBolt: 2.5, boltT: -10, flash: 0, onThunder: null };
  scene.add(W.root);
  scene.fog = new THREE.FogExp2(0x1c0c2a, 0.028);
  scene.background = new THREE.Color(0x0a0414);

  W.sky = makeSky(); W.root.add(W.sky);
  W.stars = makeStars(q.stars); W.root.add(W.stars);
  W.moon = makeMoon(); W.moon.position.set(120, 105, -290); W.root.add(W.moon);

  W.hemi = new THREE.HemisphereLight(0x7a5cf0, 0x1a0a10, 0.42); W.root.add(W.hemi);
  W.moonLight = new THREE.DirectionalLight(0xc8c0ff, 1.1); W.moonLight.position.set(6, 10, -8); W.root.add(W.moonLight);
  W.rim = new THREE.DirectionalLight(0xff7a30, 0.55); W.rim.position.set(-6, 3, 6); W.root.add(W.rim);
  W.key = new THREE.DirectionalLight(0xffe2c4, 1.15); W.key.position.set(2, 5, 12); W.root.add(W.key);
  W.flashLight = new THREE.DirectionalLight(0xd8dcff, 0); W.flashLight.position.set(-4, 12, 2); W.root.add(W.flashLight);

  // ground: dark earth with subtle purple-orange vertex tint + rows of soil
  const gg = new THREE.PlaneGeometry(140, 120, 70, 60); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position, col = new Float32Array(gp.count * 3);
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const y = Math.sin(x * 0.25) * 0.18 + Math.cos(z * 0.31) * 0.2 + (z < -30 ? (Math.sin(x * 0.07) * 3 + 3) * Math.min(1, (-30 - z) / 20) : 0) + Math.sin(x * 2.2) * 0.04;
    gp.setY(i, y - 1.0);
    const k = 0.5 + 0.5 * Math.sin(x * 2.2);
    col[i * 3] = 0.06 + 0.025 * k; col[i * 3 + 1] = 0.035 + 0.012 * k; col[i * 3 + 2] = 0.065 + 0.015 * k;
  }
  gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.computeVertexNormals();
  W.ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  W.ground.position.z = -30; W.root.add(W.ground);

  // dead trees (silhouettes framing the field)
  const treeSpots = [[-11, -14, 1.5], [12, -18, 1.8], [-17, -26, 2.1], [17, -9, 1.3], [-8, -34, 2.4], [6, -38, 2.6], [-22, -12, 1.6], [23, -26, 2.2], [0, -46, 3.0], [-14, -48, 2.8], [15, -46, 2.7]];
  for (let i = 0; i < q.trees; i++) { const [x, z, s] = treeSpots[i]; const t = makeTree(s); t.position.set(x, -1, z); t.rotation.y = srand(0, 6); W.root.add(t); }

  // gravestones
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4458, roughness: 0.9 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x3a3448, roughness: 0.9 });
  W.stonesList = [];
  for (let i = 0; i < q.stones; i++) {
    const side = i % 2 ? 1 : -1;
    const s = makeStone(stoneMat, mossMat);
    s.position.set(side * srand(5.5, 13), -1.05, srand(-24, -3)); s.scale.setScalar(srand(0.9, 1.3));
    W.root.add(s); W.stonesList.push(s);
  }

  // jack-o'-lantern field (instanced orange spheres + face glow)
  const fieldN = q.field;
  const pg = new THREE.SphereGeometry(0.5, 16, 10); pg.scale(1.15, 0.85, 1.1);
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0xd86a14, roughness: 0.55, emissive: 0x2a0c00, emissiveIntensity: 1 });
  const field = new THREE.InstancedMesh(pg, fieldMat, fieldN);
  const faceMat = new THREE.MeshBasicMaterial({ map: smallJackTex(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(2.2, 1.6, 1.0) });
  const faces = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.75, 0.38), faceMat, fieldN);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  W.fieldGlow = [];
  for (let i = 0; i < fieldN; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * srand(3.2, 12), z = srand(-26, -2), s = srand(0.6, 1.4);
    P.set(x, -0.95 + 0.42 * s, z); S.set(s, s, s); Q.setFromEuler(new THREE.Euler(0, srand(-0.6, 0.6) - side * 0.3, 0));
    M.compose(P, Q, S); field.setMatrixAt(i, M);
    const fp = P.clone().add(new THREE.Vector3(0, 0, 0.55 * s).applyQuaternion(Q));
    M.compose(fp, Q, S); faces.setMatrixAt(i, M);
    if (i < 6) W.fieldGlow.push(fp.clone());
  }
  W.root.add(field, faces);

  // pumpkin-patch leaves & vines breaking up the foreground ground band
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.35, 0.1, 0.45, 0.5, 0, 0.75); leafShape.bezierCurveTo(-0.45, 0.5, -0.35, 0.1, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 4); leafGeo.rotateX(-Math.PI / 2 + 0.5);
  const leafN = Math.round(q.field * 4.5);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x1e2a14, roughness: 0.85, side: THREE.DoubleSide }), leafN);
  for (let i = 0; i < leafN; i++) {
    const x = srand(-9, 9), z = srand(-12, 1.5), s2 = srand(0.6, 1.5);
    P.set(x, -0.98 + Math.sin(x * 0.25) * 0.18 + Math.cos((z + 30) * 0.31) * 0.2 - 0.0, z); S.set(s2, s2, s2); Q.setFromEuler(new THREE.Euler(srand(-0.3, 0.3), srand(0, 6.28), 0));
    M.compose(P, Q, S); leaves.setMatrixAt(i, M);
  }
  W.root.add(leaves);
  const vineMat = new THREE.MeshStandardMaterial({ color: 0x24301a, roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const x0 = srand(-8, 8), z0 = srand(-10, 0.5), pts = [];
    for (let k = 0; k < 6; k++) pts.push(new THREE.Vector3(x0 + k * srand(0.5, 1.0) * (i % 2 ? 1 : -1), -0.95 + srand(0, 0.08), z0 + Math.sin(k * 1.3 + i) * 0.7));
    W.root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.035, 4), vineMat));
  }

  // lanterns (2 real point lights, rest emissive + halo)
  W.lanterns = [];
  for (const [x, z, on] of [[-6.5, -6, true], [7.2, -9, true], [-9, -17, false], [10, -20, false]]) {
    const L = makeLantern(on); L.position.set(x, -1, z); if (x > 0) L.rotation.y = Math.PI; W.root.add(L); W.lanterns.push(L);
  }
  // candles on/near gravestones
  const flameTex = canvasTex(64, 128, (c) => {
    const g = c.createRadialGradient(32, 84, 2, 32, 74, 44); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.35, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(32, 6); c.quadraticCurveTo(58, 80, 32, 122); c.quadraticCurveTo(6, 80, 32, 6); c.fill();
  });
  W.candles = [];
  for (let i = 0; i < q.candles; i++) {
    const c = makeCandle(flameTex);
    const st = W.stonesList[i % W.stonesList.length];
    c.position.set(st.position.x + srand(-0.5, 0.5), -1.02, st.position.z + 0.45);
    W.root.add(c); W.candles.push(c);
  }

  // layered fog cards (vertical, camera-facing) + low ground haze
  const fogTex = makeFogTex();
  W.fogCards = [];
  for (let i = 0; i < q.fogCards; i++) {
    const z = -2 - i * (26 / q.fogCards) - srand(0, 1.5);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(46, 6.5), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, opacity: 0.4, color: new THREE.Color(0.62, 0.5, 0.85), fog: false }));
    m.position.set(srand(-4, 4), -0.4 + srand(0, 0.6), z); m.userData.ph = srand(0, 6); m.userData.x0 = m.position.x;
    m.renderOrder = 2; W.root.add(m); W.fogCards.push(m);
  }
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, opacity: 0.22, color: 0x8a6aa8, fog: false }));
  haze.rotation.x = -Math.PI / 2; haze.position.set(0, -0.75, -14); W.root.add(haze);

  // bats
  const batMat = new THREE.MeshBasicMaterial({ color: 0x07030a, side: THREE.DoubleSide });
  W.bats = [];
  for (let i = 0; i < q.bats; i++) {
    const b = makeBat(batMat); b.userData = Object.assign(b.userData, { r: rand(5, 16), y: rand(5, 11), z: rand(-24, -10), sp: rand(0.25, 0.6) * (i % 2 ? 1 : -1), ph: rand(0, 6), fl: rand(14, 20) });
    b.scale.setScalar(rand(1.2, 2.2)); W.root.add(b); W.bats.push(b);
  }
  // lightning bolt (re-generated each strike)
  W.bolt = makeBolt(); W.bolt.visible = false; W.root.add(W.bolt);
  return W;
}

export function strike(W, soft = false) {
  W.root.remove(W.bolt); W.bolt.geometry.dispose();
  W.bolt = makeBolt(); W.root.add(W.bolt);
  W.bolt.position.set(rand(-40, 40), 48, rand(-110, -80));
  W.boltT = W.t; W.flash = soft ? 0.5 : 1;
  if (W.onThunder) setTimeout(() => W.onThunder(soft), rand(250, 900));
}

export function updateWorld(W, dt, camera) {
  W.t += dt; const t = W.t;
  // lightning
  if (t > W.nextBolt) { strike(W, W.soft); W.nextBolt = t + rand(8, 14); }
  const bt = t - W.boltT;
  const f = bt < 0.6 ? W.flash * (bt < 0.08 ? 1 : bt < 0.14 ? 0.25 : bt < 0.24 ? 0.9 : Math.max(0, 1 - (bt - 0.24) / 0.36) * 0.6) : 0;
  W.sky.material.uniforms.flash.value = f * 0.6;
  W.flashLight.intensity = f * 1.3;
  W.bolt.visible = bt < 0.32 && W.flash > 0.6; W.bolt.material.opacity = bt < 0.32 ? (bt < 0.1 || (bt > 0.16 && bt < 0.26) ? 1 : 0.2) : 0;
  W.stars.material.uniforms.time.value = t;
  // moon clouds drift
  for (const c of W.moon.userData.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 60) c.position.x = -60; if (c.position.x < -60) c.position.x = 60; }
  // lanterns & candles flicker
  W.lanterns.forEach((L, i) => {
    const k = 0.82 + 0.18 * Math.sin(t * 7 + i * 3) * Math.sin(t * 13.3 + i);
    L.userData.glass.material.emissiveIntensity = 3.2 * k; L.userData.halo.material.opacity = 0.75 * k;
    if (L.userData.light) L.userData.light.intensity = 6 * k;
  });
  W.candles.forEach(c => {
    const k = 0.75 + 0.25 * Math.sin(t * 11 + c.userData.ph) * Math.sin(t * 17 + c.userData.ph * 2);
    c.userData.flame.scale.set(0.16 * (0.9 + 0.1 * k), 0.3 * k, 1); c.userData.halo.material.opacity = 0.6 * k;
  });
  W.fogCards.forEach((m, i) => {
    m.position.x = m.userData.x0 + Math.sin(t * 0.07 + m.userData.ph) * 3;
    m.material.opacity = 0.32 + 0.1 * Math.sin(t * 0.3 + m.userData.ph);
  });
  W.bats.forEach(b => {
    const u = b.userData, a = t * u.sp + u.ph;
    b.position.set(Math.cos(a) * u.r, u.y + Math.sin(a * 2.3) * 0.8, u.z + Math.sin(a) * 4);
    b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI);
    const w = Math.sin(t * u.fl + u.ph) * 0.9;
    u.wings[0].rotation.z = w; u.wings[1].rotation.z = -w;
  });
}
