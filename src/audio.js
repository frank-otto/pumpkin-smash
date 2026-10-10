// Pumpkin Smash audio — recorded CC0 samples (LICENSES/SOUNDS.md), embedded as base64 (js/sounds-src.js) so file:// works.
// Layered SFX with random pitch/volume per play; deep & warm (no synth beeps); two seamless music loops (main / boss).
let ctx = null, limiter = null, master = null, comp = null, sfxBus = null, musicBus = null, musicTone = null;
let sfxOn = true, musicOn = true, muted = false;
let sfxVol = 0.9, musicVol = 0.6;
let kids = false;
let unlocked = false;
const MUSIC_GAIN = 0.55;
const buffers = {};
let decodePromise = null;

function now() { return ctx ? ctx.currentTime : 0; }
function ac() {
  if (!ctx && !unlocked) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    buildGraph(ctx);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function buildGraph(c) {
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
  lim.connect(c.destination); limiter = lim;
  master = c.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(lim);
  comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
  comp.connect(master);
  sfxBus = c.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(comp);
  musicTone = c.createBiquadFilter(); musicTone.type = 'lowpass'; musicTone.frequency.value = 9000; musicTone.Q.value = 0.5;
  musicBus = c.createGain(); musicBus.gain.value = 0; musicTone.connect(musicBus); musicBus.connect(comp);
  decodeAll(c);
}
function b64ToArrayBuffer(b64) {
  const bin = atob(b64), n = bin.length, u = new Uint8Array(n);
  for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function decodeOne(c, name, b64) {
  return new Promise(res => {
    let done = false;
    const ok = b => { if (done) return; done = true; buffers[name] = b; res(true); if (name.startsWith('music_')) refreshMusic(); };
    const bad = () => { if (done) return; done = true; res(false); };
    try { const p = c.decodeAudioData(b64ToArrayBuffer(b64), ok, bad); if (p && p.then) p.then(ok, bad); } catch (e) { bad(); }
  });
}
function decodeAll(c) {
  if (decodePromise) return decodePromise;
  const S = window.PS_SOUNDS || {};
  const names = Object.keys(S).sort((a, b) => (a.startsWith('music_') ? 1 : 0) - (b.startsWith('music_') ? 1 : 0));
  decodePromise = names.reduce((p, n) => p.then(() => decodeOne(c, n, S[n])), Promise.resolve()).then(() => Object.keys(buffers).length);
  return decodePromise;
}

const rnd = a => 1 + (Math.random() * 2 - 1) * a;
function play(name, { vol = 1, rate = 1, delay = 0, pan = 0, vary = 1 } = {}) {
  if (!sfxOn) return null;
  const c = ac(); if (!c) return null;
  const buf = buffers[name]; if (!buf) return null;
  const src = c.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = rate * rnd(0.035 * vary);
  const g = c.createGain(); g.gain.value = Math.max(0, vol * rnd(0.1 * vary));
  let node = src.connect(g);
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node = node.connect(p); }
  node.connect(sfxBus);
  src.start(now() + delay);
  return src;
}
const pick = (...n) => n[(Math.random() * n.length) | 0];
let lastSwish = -1, lastHit = -1;

export const sfx = {
  swipe(speed = 1) {
    const c = ac(); if (!c) return;
    if (now() - lastSwish < 0.14) return; lastSwish = now();
    const s = Math.max(0.3, Math.min(1.4, speed));
    play(pick('swish_a', 'swish_b', 'swish_c'), { vol: (kids ? 0.25 : 0.35) * s, rate: 0.9 + 0.2 * s, pan: (Math.random() - 0.5) * 0.4 });
  },
  smash(size = 1, pan = 0, golden = false) {
    const c = ac(); if (!c) return;
    const k = kids ? 0.7 : 1, dense = now() - lastHit < 0.06; lastHit = now();
    play(pick('smash_a', 'smash_b'), { vol: 0.85 * k, rate: 1.12 - 0.12 * size, pan });
    play(pick('squish_a', 'squish_b', 'squish_c'), { vol: 0.7 * k, rate: 1.05 - 0.08 * size, pan, delay: 0.012 });
    if (!dense) play('sub', { vol: 0.25 * size * k, vary: 0.4 });
    if (size >= 1.3) play(pick('crunch', 'crunch_b'), { vol: 0.45 * k, pan, delay: 0.02 });
    if (size >= 1.3 || Math.random() < 0.35) play('goo', { vol: 0.28 * k, pan, delay: 0.05 });
    if (golden) { play('harp', { vol: 0.4, rate: 1.12 }); play('magic', { vol: 0.35, rate: 1.1 }); }
  },
  crack(pan = 0) { play(pick('crunch', 'crunch_b'), { vol: 0.75, pan, rate: 0.9 }); play('impact', { vol: 0.4, pan, rate: 0.9 }); },
  combo(n) {
    const k = kids;
    const rate = Math.min(1.9, Math.pow(2, (Math.min(n, 9) - 2) * 2 / 12));
    if (k) { play('harp', { vol: 0.3 + 0.03 * n, rate: 0.95 + 0.05 * Math.min(n, 8), vary: 0.2 }); return; }
    play('bell', { vol: 0.3 + 0.04 * Math.min(n, 8), rate: 1.25 * rate, vary: 0.15 });
    if (n >= 3) play('stinger', { vol: 0.25 + 0.05 * Math.min(n, 8), rate: 1.0 + 0.03 * Math.min(n, 8), vary: 0.2 });
    if (n >= 5) play('choir', { vol: 0.3, rate: 1.05 });
  },
  ghostAppear() { play(kids ? 'giggle_kids' : 'boo', { vol: kids ? 0.3 : 0.4, pan: (Math.random() - 0.5) * 0.6, rate: kids ? 1.08 : 1 }); },
  ghostHit(kind) {
    play(kids ? 'giggle_kids' : 'giggle', { vol: kids ? 0.5 : 0.45, rate: kids ? 1.12 : 1.02 });
    play('harp', { vol: 0.45, rate: kind === 'time' ? 1.0 : 1.12 }); play('magic', { vol: 0.4, delay: 0.05 });
  },
  bad() {
    if (kids) { play('meow', { vol: 0.55 }); play('purr', { vol: 0.35, delay: 0.25 }); play('soft', { vol: 0.35 }); return; }
    play('bomb', { vol: 0.85 }); play('impact', { vol: 0.5 }); play('sub', { vol: 0.5 }); play('crunch', { vol: 0.3, rate: 0.75 });
  },
  bossRise() {
    play('riser', { vol: kids ? 0.4 : 0.7, vary: 0.2 });
    if (kids) { play('boo', { vol: 0.4, delay: 1.0 }); play('choir', { vol: 0.35, delay: 1.5 }); return; }
    play('roar', { vol: 0.9, delay: 1.6, vary: 0.2 }); play('roar_b', { vol: 0.35, delay: 1.7, rate: 0.85, vary: 0.2 }); play('hit', { vol: 0.5, delay: 1.55 });
  },
  bossHit(frac = 1) {
    const k = kids ? 0.65 : 1;
    play(pick('smash_a', 'smash_b'), { vol: 0.9 * k, rate: 0.72 });
    play(pick('crunch', 'crunch_b'), { vol: 0.6 * k, rate: 0.78 });
    play('impact', { vol: 0.45 * k, rate: 0.85 });
    if (Math.random() < 0.4) play(pick('squish_a', 'squish_b'), { vol: 0.5 * k, rate: 0.75, delay: 0.03 });
  },
  bossRoar() { if (kids) { play('boo', { vol: 0.35, rate: 0.9 }); return; } play('roar', { vol: 0.75, rate: 1.05 }); play('roar_b', { vol: 0.3, rate: 0.8 }); },
  bossDie() {
    if (kids) { play('explode', { vol: 0.5 }); play('harp', { vol: 0.55, delay: 0.3 }); play('choir', { vol: 0.5, delay: 0.4 }); play('bats', { vol: 0.25, delay: 0.6 }); return; }
    play('epic', { vol: 0.75 }); play('explode', { vol: 0.6, delay: 0.05 }); play('boom', { vol: 0.35, delay: 0.12 });
    play('roar_b', { vol: 0.3, rate: 0.65 }); play('choir', { vol: 0.5, delay: 0.6 }); play('bats', { vol: 0.45, delay: 0.9, pan: 0.4 }); play('bats', { vol: 0.35, delay: 1.2, pan: -0.4, rate: 0.9 });
  },
  thunder(soft = false) { if (soft || kids) play('thunder_soft', { vol: 0.4, pan: (Math.random() - 0.5) * 0.6 }); else play('thunder_a', { vol: 0.5, pan: (Math.random() - 0.5) * 0.6, vary: 0.6 }); },
  bats() { play('bats', { vol: 0.25, pan: (Math.random() - 0.5) * 0.8 }); },
  start() { play('fwoosh', { vol: 0.7 }); play(kids ? 'harp' : 'stinger', { vol: 0.5 }); play('sub', { vol: 0.4 }); },
  tick(final = false) { if (final) { play('hit', { vol: kids ? 0.3 : 0.6 }); play('bell', { vol: 0.45 }); } else play('soft', { vol: 0.35, rate: 1.15, vary: 0.1 }); },
  timeUp() { play('bell', { vol: 0.6 }); play('boom', { vol: kids ? 0.25 : 0.5 }); play('choir', { vol: 0.4, delay: 0.3 }); },
  bonusTime() { play('harp', { vol: 0.5 }); },
  ui() { play('soft', { vol: 0.35, rate: 1.2, vary: 0.2 }); },
  newBest() { play('choir', { vol: 0.5 }); play('harp', { vol: 0.5, delay: 0.2 }); play('magic', { vol: 0.35, delay: 0.1 }); }
};

// ---------- music ----------
const LOOP = { start: 0.5, end: 32.5 };
let cur = null, mood = 'main';
function refreshMusic() {
  if (!ctx) return;
  const want = musicOn && !muted;
  musicBus.gain.cancelScheduledValues(now());
  musicBus.gain.setTargetAtTime(want ? musicVol * MUSIC_GAIN * (kids ? 0.7 : 1) : 0, now(), 0.3);
  musicTone.frequency.setTargetAtTime(kids ? 3500 : 9000, now(), 0.3);
  if (want) startLoop(mood);
}
function startLoop(m) {
  const c = ac(); if (!c) return;
  const buf = buffers['music_' + m]; if (!buf) return;
  if (cur && cur.mood === m) return;
  const t = now();
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
  src.loopStart = LOOP.start; src.loopEnd = Math.min(LOOP.end, buf.duration);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + (cur ? 1.2 : 0.4));
  src.connect(g).connect(musicTone);
  // keep the beat grid when switching (both loops are 120 bpm, 32 s)
  const off = cur ? ((t - cur.t0) % (LOOP.end - LOOP.start)) : 0;
  src.start(t, LOOP.start + off);
  if (cur) { const o = cur; o.gain.gain.cancelScheduledValues(t); o.gain.gain.setValueAtTime(o.gain.gain.value, t); o.gain.gain.linearRampToValueAtTime(0.0001, t + 1.2); try { o.src.stop(t + 1.3); } catch (e) {} }
  cur = { src, gain: g, mood: m, t0: cur ? cur.t0 : t };
}
export function setMood(m) { mood = m === 'boss' ? 'boss' : 'main'; if (ctx && musicOn && !muted) startLoop(mood); }
export function setMusicOn(on) { musicOn = !!on; refreshMusic(); }
export function setSfxOn(on) { sfxOn = !!on; }
export function setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, now(), 0.05); refreshMusic(); }
export function isMuted() { return muted; }
export function setSfxVolume(v) { sfxVol = Math.max(0, Math.min(1, v)); if (sfxBus) sfxBus.gain.setTargetAtTime(sfxVol, now(), 0.05); }
export function setMusicVolume(v) { musicVol = Math.max(0, Math.min(1, v)); refreshMusic(); }
export function setKids(on) { kids = !!on; refreshMusic(); }
export function duck(amount = 0.35, dur = 1.5) {
  if (!ctx || !musicOn || muted) return;
  const t = now(), full = musicVol * MUSIC_GAIN * (kids ? 0.7 : 1);
  musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(full * amount, t + 0.08); musicBus.gain.setValueAtTime(full * amount, t + dur);
  musicBus.gain.linearRampToValueAtTime(full, t + dur + 1.2);
}
export function unlockAudio() { unlocked = true; const c = ac(); if (c) refreshMusic(); }
export function soundsReady() { const c = ac(); return c ? decodeAll(c) : Promise.resolve(0); }
export function soundNames() { return Object.keys(buffers); }
export function suspendAudio(h) { if (!ctx) return; if (h) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); }
let tap = null;
export function getAnalyser() {
  const c = ac(); if (!c) return null;
  if (!tap) { tap = c.createAnalyser(); tap.fftSize = 2048; limiter.connect(tap); }
  return tap;
}
if (typeof window !== 'undefined') {
  const u = () => { unlockAudio(); window.removeEventListener('pointerdown', u, true); window.removeEventListener('keydown', u, true); window.removeEventListener('touchend', u, true); };
  window.addEventListener('pointerdown', u, true); window.addEventListener('keydown', u, true); window.addEventListener('touchend', u, true);
  document.addEventListener('visibilitychange', () => suspendAudio(document.hidden));
}
