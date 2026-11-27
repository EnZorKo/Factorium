// Sonido sintetizado con Web Audio (sin archivos). Se activa con el primer toque.
let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem('factorium.mute') === '1'; } catch (e) { /* sin almacenamiento */ }
const last = {};

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.35;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = init();
  if (c && c.state === 'suspended') c.resume();
}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('factorium.mute', m ? '1' : '0'); } catch (e) { /* nada */ }
  if (master) master.gain.value = m ? 0 : 0.35;
}

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, { vol = 0.3, freq = 800, q = 1, delay = 0, type = 'bandpass', slide = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const n = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

const SOUNDS = {
  place: () => { noise(0.12, { freq: 220, q: 2, vol: 0.5 }); tone(110, 0.12, { type: 'triangle', vol: 0.25, slide: 0.6 }); },
  belt: () => tone(520, 0.04, { type: 'square', vol: 0.04 }),
  remove: () => { tone(300, 0.15, { type: 'triangle', vol: 0.2, slide: 0.4 }); noise(0.1, { freq: 1200, vol: 0.15 }); },
  mine: () => { noise(0.06, { freq: 1800 + Math.random() * 800, q: 4, vol: 0.25 }); tone(900 + Math.random() * 300, 0.05, { type: 'square', vol: 0.03 }); },
  error: () => { tone(180, 0.1, { type: 'square', vol: 0.08 }); tone(140, 0.12, { type: 'square', vol: 0.08, delay: 0.09 }); },
  click: () => tone(880, 0.03, { type: 'triangle', vol: 0.08 }),
  task: () => [523, 659, 784].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.18, delay: i * 0.09 })),
  milestone: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.16, delay: i * 0.11 })),
  drone: () => { noise(0.4, { freq: 300, q: 1, vol: 0.12, slide: 2.5 }); },
  launch: () => {
    noise(4.5, { freq: 120, q: 0.7, vol: 0.9, type: 'lowpass', slide: 6 });
    tone(55, 4, { type: 'sawtooth', vol: 0.25, slide: 3 });
    tone(110, 3.5, { type: 'sine', vol: 0.2, slide: 4, delay: 0.3 });
  },
};

// gap: segundos mínimos entre dos sonidos iguales (para no saturar)
export function sfx(name, gap = 0.05) {
  if (muted || !SOUNDS[name]) return;
  if (!init() || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < gap) return;
  last[name] = now;
  SOUNDS[name]();
}
