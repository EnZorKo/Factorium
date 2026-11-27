// Sprites generados por código (sin imágenes externas): estética industrial
// sucia y detallada, con toques bioluminiscentes de Veyra.
import { ITEMS, ITEM_IDS } from './config.js';
import { hash2 } from './noise.js';

export const S = 64; // resolución de sprite por casilla
export const BELT_FRAMES = 16;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rotated(src, dir) {
  if (dir === 0) return src;
  const c = canvas(src.height, src.width);
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2);
  x.rotate((dir * Math.PI) / 2);
  x.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

function grime(ctx, w, h, seed, alpha = 0.18) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] === 0) continue;
    const n = (hash2(x, y, seed) - 0.5) * 255 * alpha;
    d[i] = clamp(d[i] + n); d[i + 1] = clamp(d[i + 1] + n); d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function metalPlate(ctx, x, y, w, h, base = '#5a5e63', edge = '#2b2e31') {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, lighten(base, 18));
  g.addColorStop(1, lighten(base, -14));
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = g;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
}

function rivets(ctx, x, y, w, h, inset = 6) {
  ctx.fillStyle = '#2a2c2f';
  for (const [rx, ry] of [[x + inset, y + inset], [x + w - inset, y + inset], [x + inset, y + h - inset], [x + w - inset, y + h - inset]]) {
    ctx.beginPath(); ctx.arc(rx, ry, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#8b9096';
    ctx.beginPath(); ctx.arc(rx - 0.6, ry - 0.6, 1, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2c2f';
  }
}

function hazard(ctx, x, y, w, h, c1 = '#c2632a', c2 = '#2a2523') {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = c2; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c1;
  for (let i = -h; i < w + h; i += 10) {
    ctx.beginPath();
    ctx.moveTo(x + i, y); ctx.lineTo(x + i + 5, y); ctx.lineTo(x + i + 5 - h, y + h); ctx.lineTo(x + i - h, y + h);
    ctx.fill();
  }
  ctx.restore();
}

export function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt), g = clamp(((n >> 8) & 255) + amt), b = clamp((n & 255) + amt);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ---------- Objetos ----------
function itemIcon(id, size = 32) {
  const it = ITEMS[id];
  const c = canvas(size, size);
  const x = c.getContext('2d');
  const k = size / 32;
  x.scale(k, k);
  x.lineJoin = 'round';
  x.shadowColor = 'rgba(0,0,0,0.55)';
  x.shadowOffsetY = 1.5; x.shadowBlur = 2;
  if (it.shape === 'ore') {
    x.fillStyle = it.dark;
    x.beginPath();
    x.moveTo(6, 18); x.lineTo(11, 8); x.lineTo(20, 6); x.lineTo(27, 13); x.lineTo(25, 24); x.lineTo(14, 27); x.closePath();
    x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = it.color;
    x.beginPath(); x.moveTo(11, 9); x.lineTo(20, 7); x.lineTo(25, 13); x.lineTo(17, 16); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.beginPath(); x.moveTo(12, 10); x.lineTo(18, 8.5); x.lineTo(15, 12); x.closePath(); x.fill();
  } else if (it.shape === 'ingot') {
    x.fillStyle = it.dark;
    x.beginPath(); x.moveTo(4, 20); x.lineTo(10, 11); x.lineTo(28, 11); x.lineTo(28, 15); x.lineTo(22, 24); x.lineTo(4, 24); x.closePath(); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = it.color;
    x.beginPath(); x.moveTo(4, 20); x.lineTo(10, 11); x.lineTo(28, 11); x.lineTo(22, 20); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.4)';
    x.fillRect(11, 13, 12, 2);
  } else if (it.shape === 'moss') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      x.fillStyle = i % 2 ? it.color : it.dark;
      x.beginPath(); x.ellipse(16 + Math.cos(a) * 6, 17 + Math.sin(a) * 5, 6, 4, a, 0, 7); x.fill();
    }
    x.shadowColor = 'transparent';
    x.fillStyle = '#fff1b8';
    x.beginPath(); x.arc(16, 16, 3, 0, 7); x.fill();
  } else if (it.shape === 'pellet') {
    x.fillStyle = it.dark;
    x.beginPath(); x.roundRect(6, 9, 20, 15, 5); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = it.color;
    x.beginPath(); x.roundRect(7, 9, 18, 11, 4); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillRect(10, 11, 9, 2);
  } else if (it.shape === 'plate') {
    x.fillStyle = it.dark;
    x.beginPath(); x.moveTo(5, 13); x.lineTo(19, 6); x.lineTo(28, 14); x.lineTo(14, 22); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(5, 13); x.lineTo(14, 22); x.lineTo(14, 26); x.lineTo(5, 17); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(14, 22); x.lineTo(28, 14); x.lineTo(28, 18); x.lineTo(14, 26); x.closePath(); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = it.color;
    x.beginPath(); x.moveTo(6, 13); x.lineTo(19, 7); x.lineTo(27, 14); x.lineTo(14, 21); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(10, 13); x.lineTo(19, 9); x.stroke();
  } else if (it.shape === 'rod') {
    for (const [ox, oy] of [[0, 0], [4, 4]]) {
      x.strokeStyle = it.dark; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(6 + ox, 22 + oy - 4); x.lineTo(24 + ox, 6 + oy); x.stroke();
      x.shadowColor = 'transparent';
      x.strokeStyle = it.color; x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(6 + ox, 21 + oy - 4); x.lineTo(24 + ox, 5 + oy); x.stroke();
    }
  } else if (it.shape === 'wire') {
    x.strokeStyle = '#7a5a2a'; x.lineWidth = 4;
    x.beginPath(); x.arc(16, 16, 9, 0, 7); x.stroke();
    x.shadowColor = 'transparent';
    x.strokeStyle = it.color; x.lineWidth = 2;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(16, 16, 6 + i * 3, 0.3 + i, 5.6 + i); x.stroke(); }
  } else if (it.shape === 'gear') {
    x.fillStyle = it.dark;
    x.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? 9 : 12.5;
      i ? x.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r) : x.moveTo(16 + r, 16);
    }
    x.closePath(); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = it.color;
    x.beginPath(); x.arc(16, 16, 8.5, 0, 7); x.fill();
    x.fillStyle = it.dark;
    x.beginPath(); x.arc(16, 16, 3.5, 0, 7); x.fill();
  } else if (it.shape === 'barrel') {
    x.fillStyle = it.dark; x.beginPath(); x.ellipse(16, 17, 10, 11, 0, 0, 7); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = '#3a3a42'; x.beginPath(); x.ellipse(16, 16, 8.5, 9.5, 0, 0, 7); x.fill();
    x.strokeStyle = '#6a6a74'; x.lineWidth = 1.5;
    x.beginPath(); x.ellipse(16, 16, 6, 7, 0, 0, 7); x.stroke();
    x.fillStyle = '#c87a3a'; x.beginPath(); x.arc(19, 12, 1.8, 0, 7); x.fill();
  } else if (it.shape === 'canister') {
    x.fillStyle = it.dark; x.beginPath(); x.roundRect(7, 7, 18, 21, 3); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = it.color; x.beginPath(); x.roundRect(8, 8, 16, 19, 3); x.fill();
    x.fillStyle = '#2b2e31'; x.fillRect(17, 4, 6, 5);
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(10, 11); x.lineTo(22, 24); x.moveTo(22, 11); x.lineTo(10, 24); x.stroke();
  } else if (it.shape === 'sheet') {
    x.fillStyle = it.dark; x.beginPath(); x.roundRect(6, 9, 21, 16, 3); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = it.color; x.beginPath(); x.roundRect(5, 7, 21, 15, 3); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(8, 9, 10, 2);
  } else if (it.shape === 'board') {
    x.fillStyle = it.dark; x.fillRect(5, 6, 22, 20);
    x.shadowColor = 'transparent';
    x.fillStyle = it.color; x.fillRect(6, 7, 20, 18);
    x.strokeStyle = '#d8b04a'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(8, 12); x.lineTo(14, 12); x.lineTo(16, 16); x.lineTo(24, 16); x.moveTo(8, 20); x.lineTo(20, 20); x.stroke();
    x.fillStyle = '#1a1c1e'; x.fillRect(15, 9, 6, 5);
  } else if (it.shape === 'cell') {
    x.fillStyle = it.dark; x.beginPath(); x.roundRect(9, 4, 14, 25, 4); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = '#8c9197'; x.fillRect(10, 5, 12, 4); x.fillRect(10, 24, 12, 4);
    x.fillStyle = it.color; x.fillRect(12, 9, 8, 15);
    x.fillStyle = '#e0ffc0'; x.fillRect(13, 10, 2, 12);
  } else if (it.shape === 'frame') {
    x.strokeStyle = it.dark; x.lineWidth = 5;
    x.strokeRect(6, 6, 20, 20);
    x.shadowColor = 'transparent';
    x.strokeStyle = it.color; x.lineWidth = 3;
    x.strokeRect(6, 6, 20, 20);
    x.beginPath(); x.moveTo(6, 6); x.lineTo(26, 26); x.moveTo(26, 6); x.lineTo(6, 26); x.stroke();
    x.fillStyle = '#2b2e31';
    for (const [a, b] of [[6, 6], [26, 6], [6, 26], [26, 26]]) { x.beginPath(); x.arc(a, b, 2.2, 0, 7); x.fill(); }
  } else if (it.shape === 'actuator') {
    x.fillStyle = it.dark;
    x.beginPath(); x.roundRect(4, 10, 18, 13, 3); x.fill();
    x.shadowColor = 'transparent';
    x.fillStyle = '#8c9197'; x.fillRect(20, 14, 9, 5);
    x.fillStyle = it.color; x.fillRect(6, 12, 14, 3);
    x.fillStyle = '#c3c7cc';
    x.beginPath(); x.arc(13, 19, 3, 0, 7); x.fill();
  } else if (it.shape === 'drive') {
    x.fillStyle = it.dark;
    x.beginPath(); x.roundRect(4, 7, 24, 18, 4); x.fill();
    x.shadowColor = 'transparent';
    for (const cx of [10, 22]) {
      x.fillStyle = '#5a5e63'; x.beginPath(); x.arc(cx, 16, 6, 0, 7); x.fill();
      x.fillStyle = '#9aa0a7'; x.beginPath(); x.arc(cx, 16, 2.5, 0, 7); x.fill();
    }
    x.fillStyle = it.color; x.fillRect(6, 8, 20, 2.5);
  } else if (it.shape === 'coil') {
    x.fillStyle = it.dark;
    x.fillRect(7, 8, 18, 16);
    x.shadowColor = 'transparent';
    x.fillStyle = '#c87a3a';
    for (let i = 0; i < 6; i++) x.fillRect(8, 9 + i * 2.5, 16, 1.6);
    x.fillStyle = '#6b7076';
    x.fillRect(5, 6, 22, 3); x.fillRect(5, 23, 22, 3);
  } else if (it.shape === 'composite') {
    for (let i = 0; i < 3; i++) {
      x.fillStyle = i === 2 ? it.color : it.dark;
      x.beginPath(); x.moveTo(16, 6 + i * 3); x.lineTo(27, 11 + i * 3); x.lineTo(16, 16 + i * 3); x.lineTo(5, 11 + i * 3); x.closePath(); x.fill();
      x.shadowColor = 'transparent';
    }
    x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(9, 17); x.lineTo(16, 20.5); x.lineTo(23, 17); x.stroke();
  } else if (it.shape === 'core') {
    x.fillStyle = it.dark;
    x.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; x.lineTo(16 + Math.cos(a) * 12, 16 + Math.sin(a) * 12); }
    x.closePath(); x.fill();
    x.shadowColor = 'transparent';
    x.strokeStyle = '#8c9197'; x.lineWidth = 1.5; x.stroke();
    const g = x.createRadialGradient(16, 16, 1, 16, 16, 7);
    g.addColorStop(0, '#fff6d8'); g.addColorStop(1, it.color);
    x.fillStyle = g; x.beginPath(); x.arc(16, 16, 6, 0, 7); x.fill();
    x.fillStyle = '#3fae5a';
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; x.fillRect(16 + Math.cos(a) * 9.5 - 1.5, 16 + Math.sin(a) * 9.5 - 1.5, 3, 3); }
  } else if (it.shape === 'module') {
    x.fillStyle = it.dark;
    x.beginPath(); x.roundRect(9, 4, 14, 24, 6); x.fill();
    x.shadowColor = 'transparent';
    const g = x.createLinearGradient(9, 0, 23, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9aa0a7');
    x.fillStyle = g; x.beginPath(); x.roundRect(10, 5, 12, 21, 5); x.fill();
    x.fillStyle = '#e08a3c'; x.fillRect(10, 18, 12, 3);
    x.fillStyle = '#4fd1bd'; x.beginPath(); x.arc(16, 11, 2.5, 0, 7); x.fill();
    x.fillStyle = '#5a5e63'; x.beginPath(); x.moveTo(10, 22); x.lineTo(6, 28); x.lineTo(10, 27); x.fill(); x.beginPath(); x.moveTo(22, 22); x.lineTo(26, 28); x.lineTo(22, 27); x.fill();
  }
  return c;
}

// ---------- Cintas ----------
function beltFrame(tier, f) {
  const c = canvas(S, S);
  const x = c.getContext('2d');
  const accent = tier === 2 ? '#8a5cd6' : '#3fa89a';
  // carriles laterales
  x.fillStyle = '#26282b';
  x.fillRect(0, 6, S, S - 12);
  // banda
  x.fillStyle = '#34373a';
  x.fillRect(0, 12, S, S - 24);
  // nervios móviles (la banda avanza hacia la derecha)
  const off = (f / BELT_FRAMES) * 16;
  for (let i = -16; i < S + 16; i += 16) {
    const px = i + off;
    x.fillStyle = '#2a2c2f';
    x.fillRect(px, 12, 3, S - 24);
    x.fillStyle = '#44484c';
    x.fillRect(px + 3, 12, 1, S - 24);
  }
  // marcas de dirección
  x.strokeStyle = accent;
  x.globalAlpha = 0.55;
  x.lineWidth = 3;
  for (let i = -32; i < S + 32; i += 32) {
    const px = i;
    x.beginPath(); x.moveTo(px + 6, 22); x.lineTo(px + 14, 32); x.lineTo(px + 6, 42); x.stroke();
  }
  x.globalAlpha = 1;
  // bordes metálicos
  for (const y0 of [2, S - 12]) {
    x.fillStyle = '#5d6166';
    x.fillRect(0, y0, S, 10);
    x.fillStyle = '#7b8086';
    x.fillRect(0, y0 + 1, S, 2);
    x.fillStyle = '#3a3d41';
    x.fillRect(0, y0 + 8, S, 2);
    x.fillStyle = accent;
    x.fillRect(0, y0 + 4, S, 2);
    x.fillStyle = '#2b2d30';
    for (let i = 4; i < S; i += 16) { x.beginPath(); x.arc(i, y0 + 5, 1.6, 0, 7); x.fill(); }
  }
  return c;
}

// ---------- Edificios ----------
function minerSprite(tier, f) {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, tier === 2 ? '#5b5470' : '#5a5650');
  hazard(x, 8, W - 20, W - 16, 10);
  rivets(x, 3, 3, W - 6, W - 6, 9);
  // pozo central
  x.fillStyle = '#1b1c1e';
  x.beginPath(); x.arc(W / 2, W / 2 - 6, 34, 0, 7); x.fill();
  // cabezal giratorio
  x.save();
  x.translate(W / 2, W / 2 - 6);
  x.rotate((f / 8) * Math.PI * 2 / 3);
  for (let i = 0; i < 3; i++) {
    x.rotate((Math.PI * 2) / 3);
    x.fillStyle = '#8c9197';
    x.beginPath(); x.moveTo(-7, 0); x.lineTo(7, 0); x.lineTo(3, 30); x.lineTo(-3, 30); x.closePath(); x.fill();
    x.fillStyle = '#5f6368';
    x.fillRect(-2, 4, 4, 24);
  }
  x.fillStyle = '#3b3e42';
  x.beginPath(); x.arc(0, 0, 11, 0, 7); x.fill();
  x.fillStyle = tier === 2 ? '#a684ff' : '#4fd1bd';
  x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill();
  x.restore();
  // tubos laterales
  x.fillStyle = '#3a3c40';
  x.fillRect(10, 24, 10, 60);
  x.fillRect(W - 20, 24, 10, 60);
  x.fillStyle = '#6b7076';
  x.fillRect(12, 24, 2, 60);
  x.fillRect(W - 18, 24, 2, 60);
  // salida (lado derecho = delante)
  x.fillStyle = '#26282b';
  x.fillRect(W - 16, 18, 13, 28);
  x.fillStyle = '#c2632a';
  x.beginPath(); x.moveTo(W - 12, 24); x.lineTo(W - 5, 32); x.lineTo(W - 12, 40); x.fill();
  grime(x, W, W, 11 + tier, 0.12);
  return c;
}

function furnaceSprite(lit, f) {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  // base de piedra
  x.fillStyle = '#2d2724';
  x.fillRect(3, 3, W - 6, W - 6);
  for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
    const ox = (j % 2) * 10;
    const h = hash2(i, j, 5);
    x.fillStyle = `rgb(${88 + h * 30},${74 + h * 22},${66 + h * 18})`;
    x.fillRect(6 + i * 20 + ox - 10, 6 + j * 20, 18, 18);
  }
  x.clearRect(0, 0, 3, W); x.clearRect(W - 3, 0, 3, W);
  // cúpula metálica
  x.fillStyle = '#3c3f43';
  x.beginPath(); x.arc(W / 2 - 6, W / 2, 40, 0, 7); x.fill();
  const g = x.createRadialGradient(W / 2 - 16, W / 2 - 12, 4, W / 2 - 6, W / 2, 40);
  g.addColorStop(0, '#8a8f95'); g.addColorStop(1, '#3f4247');
  x.fillStyle = g;
  x.beginPath(); x.arc(W / 2 - 6, W / 2, 36, 0, 7); x.fill();
  // boca (delante)
  const glow = lit ? 0.75 + 0.25 * Math.sin(f * 1.3) : 0;
  x.fillStyle = '#141212';
  x.fillRect(W - 34, W / 2 - 18, 28, 36);
  if (lit) {
    const gg = x.createLinearGradient(W - 34, 0, W - 6, 0);
    gg.addColorStop(0, `rgba(255,120,30,${glow})`);
    gg.addColorStop(1, `rgba(255,210,90,${glow})`);
    x.fillStyle = gg;
    x.fillRect(W - 32, W / 2 - 15, 24, 30);
  }
  x.fillStyle = '#5a5e63';
  for (let i = 0; i < 4; i++) x.fillRect(W - 32, W / 2 - 15 + i * 9, 24, 2);
  // chimenea
  x.fillStyle = '#25272a';
  x.beginPath(); x.arc(28, 28, 13, 0, 7); x.fill();
  x.fillStyle = lit ? '#ff9d42' : '#111';
  x.beginPath(); x.arc(28, 28, 7, 0, 7); x.fill();
  grime(x, W, W, 23, 0.14);
  return c;
}

function chestSprite() {
  const c = canvas(S, S);
  const x = c.getContext('2d');
  metalPlate(x, 6, 6, S - 12, S - 12, '#6b5a45', '#2c241b');
  x.strokeStyle = '#3a3025'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(10, 10); x.lineTo(S - 10, S - 10); x.moveTo(S - 10, 10); x.lineTo(10, S - 10); x.stroke();
  x.fillStyle = '#8c9197';
  x.fillRect(6, S / 2 - 3, S - 12, 6);
  rivets(x, 6, 6, S - 12, S - 12, 6);
  grime(x, S, S, 41, 0.15);
  return c;
}

function splitterSprite() {
  const c = canvas(S, S);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, S - 6, S - 6, '#4d5257');
  x.fillStyle = '#1e2022';
  x.fillRect(14, 14, S - 28, S - 28);
  x.fillStyle = '#4fd1bd';
  const arrow = (ax, ay, rot) => {
    x.save(); x.translate(ax, ay); x.rotate(rot);
    x.beginPath(); x.moveTo(-5, -6); x.lineTo(6, 0); x.lineTo(-5, 6); x.closePath(); x.fill();
    x.restore();
  };
  arrow(S - 9, S / 2, 0);
  arrow(S / 2, 9, -Math.PI / 2);
  arrow(S / 2, S - 9, Math.PI / 2);
  x.fillStyle = '#c2632a';
  x.beginPath(); x.arc(S / 2, S / 2, 7, 0, 7); x.fill();
  rivets(x, 3, 3, S - 6, S - 6, 6);
  grime(x, S, S, 51, 0.12);
  return c;
}

function hubSprite(f) {
  const W = S * 3;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  // plataforma
  x.fillStyle = '#25272a';
  x.beginPath(); x.roundRect(3, 3, W - 6, W - 6, 14); x.fill();
  x.fillStyle = '#4a4e53';
  x.beginPath(); x.roundRect(9, 9, W - 18, W - 18, 10); x.fill();
  hazard(x, 9, 9, W - 18, 10);
  hazard(x, 9, W - 19, W - 18, 10);
  // anillo
  x.strokeStyle = '#2b2e31'; x.lineWidth = 10;
  x.beginPath(); x.arc(W / 2, W / 2, 56, 0, 7); x.stroke();
  x.strokeStyle = '#4fd1bd'; x.lineWidth = 3;
  x.globalAlpha = 0.6 + 0.4 * Math.sin(f * 0.5);
  x.beginPath(); x.arc(W / 2, W / 2, 56, 0, 7); x.stroke();
  x.globalAlpha = 1;
  // núcleo
  const g = x.createRadialGradient(W / 2 - 10, W / 2 - 10, 4, W / 2, W / 2, 40);
  g.addColorStop(0, '#9aa0a7'); g.addColorStop(1, '#3a3d42');
  x.fillStyle = g;
  x.beginPath(); x.arc(W / 2, W / 2, 38, 0, 7); x.fill();
  // antena
  x.strokeStyle = '#1e2022'; x.lineWidth = 6;
  x.beginPath(); x.moveTo(W / 2, W / 2); x.lineTo(W / 2 + 26, W / 2 - 26); x.stroke();
  x.fillStyle = '#c2632a';
  x.beginPath(); x.arc(W / 2 + 26, W / 2 - 26, 7, 0, 7); x.fill();
  x.fillStyle = `rgba(79,209,189,${0.5 + 0.5 * Math.sin(f * 0.5)})`;
  x.beginPath(); x.arc(W / 2, W / 2, 9, 0, 7); x.fill();
  rivets(x, 9, 9, W - 18, W - 18, 16);
  grime(x, W, W, 61, 0.12);
  return c;
}

function pressSprite(f) {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#4f5a5e');
  hazard(x, 8, 8, 10, W - 16);
  rivets(x, 3, 3, W - 6, W - 6, 9);
  // mesa
  x.fillStyle = '#1d1f21';
  x.fillRect(30, 28, 68, 72);
  // pistón (sube y baja)
  const k = (Math.sin(f / 8 * Math.PI * 2) + 1) / 2;
  x.fillStyle = 'rgba(0,0,0,0.4)';
  x.fillRect(36 + 4, 34 + 8 * k + 4, 56, 56);
  const g = x.createLinearGradient(36, 0, 92, 0);
  g.addColorStop(0, '#9aa0a7'); g.addColorStop(1, '#5c6066');
  x.fillStyle = g;
  x.fillRect(36, 34 + 8 * k - 6, 56, 56);
  x.fillStyle = '#c2632a';
  x.fillRect(36, 34 + 8 * k - 6, 56, 6);
  x.fillStyle = '#3a3d41';
  x.fillRect(58, 50 + 8 * k, 12, 20);
  // salida
  x.fillStyle = '#26282b';
  x.fillRect(W - 16, 18, 13, 28);
  x.fillStyle = '#c2632a';
  x.beginPath(); x.moveTo(W - 12, 24); x.lineTo(W - 5, 32); x.lineTo(W - 12, 40); x.fill();
  grime(x, W, W, 71, 0.12);
  return c;
}

function assemblerSprite(f) {
  const W = S * 3;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#55524e');
  hazard(x, 10, W - 22, W - 20, 10);
  rivets(x, 3, 3, W - 6, W - 6, 10);
  x.fillStyle = '#1d1f21';
  x.fillRect(34, 34, W - 68, W - 68);
  // brazos robóticos
  const a = (f / 12) * Math.PI * 2;
  for (const [bx, by, ph] of [[46, 46, 0], [W - 46, W - 46, Math.PI]]) {
    const ang = a + ph;
    const ex = bx + Math.cos(ang) * 30, ey = by + Math.sin(ang * 0.7) * 30 + 10;
    x.strokeStyle = '#2a2c2f'; x.lineWidth = 10; x.lineCap = 'round';
    x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
    x.strokeStyle = '#c2632a'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
    x.fillStyle = '#8c9197';
    x.beginPath(); x.arc(bx, by, 9, 0, 7); x.fill();
    x.fillStyle = '#4fd1bd';
    x.beginPath(); x.arc(ex, ey, 4, 0, 7); x.fill();
  }
  // pieza central
  x.fillStyle = '#7b8086';
  x.beginPath(); x.arc(W / 2, W / 2, 14, 0, 7); x.fill();
  x.fillStyle = '#3a3d41';
  x.beginPath(); x.arc(W / 2, W / 2, 5, 0, 7); x.fill();
  // salida
  x.fillStyle = '#26282b';
  x.fillRect(W - 18, W / 2 - 16, 15, 32);
  x.fillStyle = '#c2632a';
  x.beginPath(); x.moveTo(W - 14, W / 2 - 8); x.lineTo(W - 6, W / 2); x.lineTo(W - 14, W / 2 + 8); x.fill();
  grime(x, W, W, 81, 0.12);
  return c;
}

function droneSprite(f) {
  const W = 96;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  x.translate(W / 2, W / 2);
  // brazos y rotores
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const rx = Math.cos(a) * 30, ry = Math.sin(a) * 30;
    x.strokeStyle = '#2b2e31'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(rx, ry); x.stroke();
    x.fillStyle = 'rgba(200,220,230,0.18)';
    x.beginPath(); x.arc(rx, ry, 15, 0, 7); x.fill();
    x.strokeStyle = 'rgba(230,240,245,0.6)'; x.lineWidth = 2.5;
    const sp = f * 1.7 + i;
    x.beginPath(); x.moveTo(rx - Math.cos(sp) * 14, ry - Math.sin(sp) * 14); x.lineTo(rx + Math.cos(sp) * 14, ry + Math.sin(sp) * 14); x.stroke();
    x.fillStyle = '#5a5e63';
    x.beginPath(); x.arc(rx, ry, 4, 0, 7); x.fill();
  }
  // cuerpo
  const g = x.createLinearGradient(-16, -16, 16, 16);
  g.addColorStop(0, '#e08a3c'); g.addColorStop(1, '#8a4a1c');
  x.fillStyle = '#1c1e20';
  x.beginPath(); x.roundRect(-17, -14, 34, 28, 8); x.fill();
  x.fillStyle = g;
  x.beginPath(); x.roundRect(-15, -12, 30, 24, 7); x.fill();
  // ojo (mira a la derecha)
  x.fillStyle = '#16191a';
  x.beginPath(); x.roundRect(4, -6, 10, 12, 3); x.fill();
  x.fillStyle = '#4fd1bd';
  x.beginPath(); x.arc(10, 0, 3.2, 0, 7); x.fill();
  return c;
}

function poleSprite() {
  const c = canvas(S, S);
  const x = c.getContext('2d');
  const m = S / 2;
  // sombra alargada (el poste es alto)
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 8; x.lineCap = 'round';
  x.beginPath(); x.moveTo(m, m); x.lineTo(m + 18, m + 22); x.stroke();
  // base
  x.fillStyle = '#2b2e31';
  x.beginPath(); x.arc(m, m, 13, 0, 7); x.fill();
  x.fillStyle = '#6b5440';
  x.beginPath(); x.arc(m, m, 10, 0, 7); x.fill();
  x.fillStyle = '#8a6c50';
  x.beginPath(); x.arc(m - 2, m - 2, 5, 0, 7); x.fill();
  // travesaño con aisladores
  x.fillStyle = '#1e2022';
  x.fillRect(m - 27, m - 5, 54, 10);
  x.fillStyle = '#5a5e63';
  x.fillRect(m - 26, m - 4, 52, 4);
  for (const dx of [-21, 0, 21]) {
    x.fillStyle = '#1e2022'; x.beginPath(); x.arc(m + dx, m, 6, 0, 7); x.fill();
    x.fillStyle = '#d88a48'; x.beginPath(); x.arc(m + dx, m, 4, 0, 7); x.fill();
    x.fillStyle = '#ffd08a'; x.beginPath(); x.arc(m + dx - 1, m - 1, 1.5, 0, 7); x.fill();
  }
  return c;
}

function pumpSprite(f) {
  const c = canvas(S, S);
  const x = c.getContext('2d');
  metalPlate(x, 4, 4, S - 8, S - 8, '#3f5a66', '#1c2a30');
  x.fillStyle = '#1b2226';
  x.beginPath(); x.arc(S / 2, S / 2, 16, 0, 7); x.fill();
  x.save(); x.translate(S / 2, S / 2); x.rotate(f * 0.8);
  x.fillStyle = '#5fb6f0';
  for (let i = 0; i < 4; i++) { x.rotate(Math.PI / 2); x.fillRect(-2, 2, 4, 12); }
  x.restore();
  x.fillStyle = '#8c9197'; x.beginPath(); x.arc(S / 2, S / 2, 4, 0, 7); x.fill();
  rivets(x, 4, 4, S - 8, S - 8, 6);
  return c;
}

function boilerSprite(lit, f) {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#4a3f3a', '#1e1915');
  // depósito
  const g = x.createLinearGradient(20, 0, W - 20, 0);
  g.addColorStop(0, '#5f6368'); g.addColorStop(0.5, '#9aa0a7'); g.addColorStop(1, '#4d5156');
  x.fillStyle = g;
  x.beginPath(); x.roundRect(18, 14, W - 36, 56, 22); x.fill();
  x.fillStyle = '#2b2e31';
  for (const yy of [30, 50]) x.fillRect(18, yy, W - 36, 3);
  // hogar
  x.fillStyle = '#141212';
  x.fillRect(34, 80, W - 68, 32);
  if (lit) {
    const k = 0.75 + 0.25 * Math.sin(f * 1.7);
    const gg = x.createLinearGradient(0, 80, 0, 112);
    gg.addColorStop(0, `rgba(255,200,90,${k})`); gg.addColorStop(1, `rgba(255,90,20,${k})`);
    x.fillStyle = gg; x.fillRect(36, 82, W - 72, 28);
  }
  x.fillStyle = '#5a5e63';
  for (let i = 0; i < 5; i++) x.fillRect(36 + i * 12, 80, 3, 32);
  rivets(x, 3, 3, W - 6, W - 6, 9);
  grime(x, W, W, 91, 0.12);
  return c;
}

function generatorSprite(f) {
  const W = S * 3;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#4b5258');
  hazard(x, 10, 10, W - 20, 10);
  rivets(x, 3, 3, W - 6, W - 6, 10);
  // carcasa de la turbina
  x.fillStyle = '#25282b';
  x.beginPath(); x.arc(W / 2, W / 2 + 6, 58, 0, 7); x.fill();
  x.save(); x.translate(W / 2, W / 2 + 6); x.rotate(f * 0.35);
  for (let i = 0; i < 10; i++) {
    x.rotate((Math.PI * 2) / 10);
    x.fillStyle = i % 2 ? '#9aa0a7' : '#7b8086';
    x.beginPath(); x.moveTo(8, -4); x.lineTo(52, -12); x.lineTo(52, 4); x.lineTo(8, 4); x.closePath(); x.fill();
  }
  x.restore();
  x.fillStyle = '#3a3d41';
  x.beginPath(); x.arc(W / 2, W / 2 + 6, 14, 0, 7); x.fill();
  x.fillStyle = '#f2c14a';
  x.beginPath(); x.moveTo(W / 2 + 2, W / 2 - 4); x.lineTo(W / 2 - 6, W / 2 + 8); x.lineTo(W / 2, W / 2 + 8); x.lineTo(W / 2 - 3, W / 2 + 17); x.lineTo(W / 2 + 6, W / 2 + 4); x.lineTo(W / 2, W / 2 + 4); x.closePath(); x.fill();
  grime(x, W, W, 101, 0.12);
  return c;
}

function solarSprite() {
  const W = S * 3;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  x.fillStyle = '#2b2e31';
  x.fillRect(4, 4, W - 8, W - 8);
  x.fillStyle = '#8c9197';
  x.fillRect(7, 7, W - 14, W - 14);
  const n = 6, cell = (W - 20) / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const g = x.createLinearGradient(10 + i * cell, 10 + j * cell, 10 + (i + 1) * cell, 10 + (j + 1) * cell);
    g.addColorStop(0, '#2e4f86'); g.addColorStop(1, '#16284a');
    x.fillStyle = g;
    x.fillRect(11 + i * cell, 11 + j * cell, cell - 2, cell - 2);
    x.strokeStyle = 'rgba(160,200,255,0.18)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(11 + i * cell + cell / 2, 11 + j * cell); x.lineTo(11 + i * cell + cell / 2, 9 + (j + 1) * cell); x.stroke();
  }
  x.fillStyle = 'rgba(255,255,255,0.08)';
  x.beginPath(); x.moveTo(10, 10); x.lineTo(W * 0.6, 10); x.lineTo(10, W * 0.6); x.closePath(); x.fill();
  return c;
}

function batterySprite(level) {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#454a50');
  for (let i = 0; i < 3; i++) {
    const bx = 18 + i * 32;
    x.fillStyle = '#1e2022'; x.beginPath(); x.roundRect(bx, 18, 26, 90, 6); x.fill();
    x.fillStyle = '#5a5e63'; x.fillRect(bx + 8, 12, 10, 8);
    const h = 82 * level;
    x.fillStyle = level > 0.25 ? '#5fe08a' : '#f2c14a';
    x.fillRect(bx + 4, 104 - h, 18, h);
  }
  rivets(x, 3, 3, W - 6, W - 6, 8);
  return c;
}

function pumpjackSprite(f) {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#4a4540');
  hazard(x, 8, W - 18, W - 16, 10);
  x.fillStyle = '#0b0b0f'; x.beginPath(); x.arc(40, 64, 16, 0, 7); x.fill();
  // balancín: se desplaza adelante y atrás
  const k = Math.sin((f / 8) * Math.PI * 2) * 10;
  x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(30 + k + 4, 56 + 4, 70, 16);
  x.fillStyle = '#c2632a'; x.fillRect(30 + k, 56, 70, 16);
  x.fillStyle = '#2b2e31'; x.fillRect(30 + k, 62, 70, 4);
  x.fillStyle = '#8c9197'; x.beginPath(); x.arc(80, 64, 9, 0, 7); x.fill();
  x.fillStyle = '#5a5e63'; x.beginPath(); x.roundRect(22 + k, 50, 16, 28, 6); x.fill();
  x.fillStyle = '#26282b'; x.fillRect(W - 16, 18, 13, 28);
  x.fillStyle = '#c2632a'; x.beginPath(); x.moveTo(W - 12, 24); x.lineTo(W - 5, 32); x.lineTo(W - 12, 40); x.fill();
  grime(x, W, W, 111, 0.12);
  return c;
}

function refinerySprite(f) {
  const W = S * 3;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#4d4a46');
  rivets(x, 3, 3, W - 6, W - 6, 10);
  // tuberías
  x.strokeStyle = '#2b2e31'; x.lineWidth = 10;
  x.beginPath(); x.moveTo(50, 50); x.lineTo(130, 50); x.lineTo(130, 130); x.lineTo(50, 130); x.stroke();
  x.strokeStyle = '#8c9197'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(50, 50); x.lineTo(130, 50); x.lineTo(130, 130); x.lineTo(50, 130); x.stroke();
  // torres
  for (const [tx, ty, r] of [[50, 50, 26], [130, 130, 22], [50, 130, 18]]) {
    const g = x.createRadialGradient(tx - r / 3, ty - r / 3, 2, tx, ty, r);
    g.addColorStop(0, '#c3c7cc'); g.addColorStop(1, '#4d5257');
    x.fillStyle = '#1e2022'; x.beginPath(); x.arc(tx, ty, r + 3, 0, 7); x.fill();
    x.fillStyle = g; x.beginPath(); x.arc(tx, ty, r, 0, 7); x.fill();
    x.strokeStyle = '#c2632a'; x.lineWidth = 3; x.beginPath(); x.arc(tx, ty, r * 0.6, 0, 7); x.stroke();
  }
  // antorcha
  const fl = 0.6 + 0.4 * Math.sin(f * 2.1);
  x.fillStyle = '#2b2e31'; x.beginPath(); x.arc(135, 48, 9, 0, 7); x.fill();
  x.fillStyle = `rgba(255,${150 + 60 * fl},60,${fl})`; x.beginPath(); x.arc(135, 48, 6, 0, 7); x.fill();
  x.fillStyle = '#26282b'; x.fillRect(W - 18, W / 2 - 16, 15, 32);
  x.fillStyle = '#c2632a'; x.beginPath(); x.moveTo(W - 14, W / 2 - 8); x.lineTo(W - 6, W / 2); x.lineTo(W - 14, W / 2 + 8); x.fill();
  grime(x, W, W, 121, 0.12);
  return c;
}

function fuelGenSprite(f) {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#5a3a32');
  rivets(x, 3, 3, W - 6, W - 6, 8);
  x.fillStyle = '#2b2e31'; x.beginPath(); x.roundRect(18, 26, 92, 60, 8); x.fill();
  for (let i = 0; i < 4; i++) {
    const up = (f + i) % 2 ? 3 : 0;
    x.fillStyle = '#8c9197'; x.beginPath(); x.roundRect(26 + i * 21, 36 - up, 15, 40, 4); x.fill();
    x.fillStyle = '#5a5e63'; x.fillRect(28 + i * 21, 40 - up, 11, 4);
  }
  x.fillStyle = '#1e2022'; x.beginPath(); x.arc(100, 104, 9, 0, 7); x.fill();
  x.fillStyle = '#f2c14a';
  x.beginPath(); x.moveTo(30, 96); x.lineTo(24, 108); x.lineTo(29, 108); x.lineTo(26, 118); x.lineTo(36, 102); x.lineTo(31, 102); x.closePath(); x.fill();
  grime(x, W, W, 131, 0.12);
  return c;
}

function centrifugeSprite(f) {
  const W = S * 3;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#3f4a44');
  hazard(x, 10, W - 22, W - 20, 10);
  rivets(x, 3, 3, W - 6, W - 6, 10);
  for (const [cx, cy] of [[60, 60], [W - 60, 60], [W / 2, 120]]) {
    x.fillStyle = '#1e2022'; x.beginPath(); x.arc(cx, cy, 30, 0, 7); x.fill();
    x.fillStyle = '#6b7076'; x.beginPath(); x.arc(cx, cy, 25, 0, 7); x.fill();
    x.save(); x.translate(cx, cy); x.rotate(f * 0.9);
    x.fillStyle = '#9cff5a';
    for (let i = 0; i < 3; i++) { x.rotate((Math.PI * 2) / 3); x.beginPath(); x.arc(13, 0, 5, 0, 7); x.fill(); }
    x.restore();
    x.fillStyle = '#2b2e31'; x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill();
  }
  x.fillStyle = '#26282b'; x.fillRect(W - 18, W / 2 - 16, 15, 32);
  x.fillStyle = '#c2632a'; x.beginPath(); x.moveTo(W - 14, W / 2 - 8); x.lineTo(W - 6, W / 2); x.lineTo(W - 14, W / 2 + 8); x.fill();
  grime(x, W, W, 141, 0.12);
  return c;
}

function reactorSprite(lit, f) {
  const W = S * 4;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  // hormigón
  x.fillStyle = '#2a2a2c'; x.fillRect(3, 3, W - 6, W - 6);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const h = hash2(i, j, 9);
    x.fillStyle = `rgb(${120 + h * 25},${120 + h * 25},${116 + h * 22})`;
    x.fillRect(6 + i * 31, 6 + j * 31, 29, 29);
  }
  hazard(x, 6, 6, W - 12, 12);
  hazard(x, 6, W - 18, W - 12, 12);
  // núcleo
  x.fillStyle = '#1b1d1f'; x.beginPath(); x.arc(W / 2, W / 2, 70, 0, 7); x.fill();
  const k = lit ? 0.7 + 0.3 * Math.sin(f * 1.3) : 0.15;
  const g = x.createRadialGradient(W / 2, W / 2, 6, W / 2, W / 2, 62);
  g.addColorStop(0, `rgba(200,255,150,${k})`); g.addColorStop(0.6, `rgba(90,220,120,${k * 0.6})`); g.addColorStop(1, 'rgba(20,60,40,0.2)');
  x.fillStyle = g; x.beginPath(); x.arc(W / 2, W / 2, 62, 0, 7); x.fill();
  x.strokeStyle = '#5a5e63'; x.lineWidth = 4;
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; x.beginPath(); x.moveTo(W / 2 + Math.cos(a) * 20, W / 2 + Math.sin(a) * 20); x.lineTo(W / 2 + Math.cos(a) * 62, W / 2 + Math.sin(a) * 62); x.stroke(); }
  x.fillStyle = '#3a3d41'; x.beginPath(); x.arc(W / 2, W / 2, 16, 0, 7); x.fill();
  return c;
}

// Puerto de drones: plataforma de aterrizaje con tolva.
function portSprite() {
  const W = S * 2;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  metalPlate(x, 3, 3, W - 6, W - 6, '#4a4f55');
  hazard(x, 8, 8, W - 16, 8);
  hazard(x, 8, W - 16, W - 16, 8);
  rivets(x, 3, 3, W - 6, W - 6, 8);
  x.fillStyle = '#26292c'; x.beginPath(); x.arc(W / 2, W / 2, 40, 0, 7); x.fill();
  x.strokeStyle = '#d9dde0'; x.lineWidth = 3;
  x.beginPath(); x.arc(W / 2, W / 2, 34, 0, 7); x.stroke();
  x.fillStyle = '#d9dde0';
  x.fillRect(W / 2 - 14, W / 2 - 16, 6, 32); x.fillRect(W / 2 + 8, W / 2 - 16, 6, 32); x.fillRect(W / 2 - 8, W / 2 - 3, 16, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    x.fillStyle = '#4fd1bd'; x.beginPath(); x.arc(W / 2 + Math.cos(a) * 46, W / 2 + Math.sin(a) * 46, 2.6, 0, 7); x.fill();
  }
  grime(x, W, W, 151, 0.12);
  return c;
}

// Catapulta orbital (5×5): anillo de bobinas que se ilumina al cargar.
function launcherSprite(charge) {
  const W = S * 5;
  const c = canvas(W, W);
  const x = c.getContext('2d');
  x.fillStyle = '#26272a'; x.fillRect(3, 3, W - 6, W - 6);
  for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) {
    const h = hash2(i, j, 17);
    x.fillStyle = `rgb(${104 + h * 22},${106 + h * 22},${104 + h * 20})`;
    x.fillRect(6 + i * 31, 6 + j * 31, 29, 29);
  }
  hazard(x, 6, 6, W - 12, 14);
  hazard(x, 6, W - 20, W - 12, 14);
  const C = W / 2;
  // anillo exterior de bobinas
  x.fillStyle = '#1b1d1f'; x.beginPath(); x.arc(C, C, 128, 0, 7); x.fill();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    x.save(); x.translate(C + Math.cos(a) * 110, C + Math.sin(a) * 110); x.rotate(a);
    x.fillStyle = '#4a4e53'; x.fillRect(-12, -9, 24, 18);
    x.fillStyle = '#c87a3a'; for (let k = 0; k < 5; k++) x.fillRect(-10 + k * 4.4, -8, 2.6, 16);
    const lit = charge > i / 16;
    x.fillStyle = lit ? '#7ff5e2' : '#203a37'; x.fillRect(-12, -2, 4, 4);
    x.restore();
  }
  // cuna central
  x.fillStyle = '#3a3d41'; x.beginPath(); x.arc(C, C, 86, 0, 7); x.fill();
  const g = x.createRadialGradient(C, C, 10, C, C, 84);
  const k = 0.12 + charge * 0.75;
  g.addColorStop(0, `rgba(160,255,240,${k})`); g.addColorStop(0.7, `rgba(79,209,189,${k * 0.5})`); g.addColorStop(1, 'rgba(20,40,40,0.1)');
  x.fillStyle = g; x.beginPath(); x.arc(C, C, 84, 0, 7); x.fill();
  x.strokeStyle = '#8c9197'; x.lineWidth = 6;
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 - Math.PI / 2; x.beginPath(); x.moveTo(C + Math.cos(a) * 40, C + Math.sin(a) * 40); x.lineTo(C + Math.cos(a) * 84, C + Math.sin(a) * 84); x.stroke(); }
  x.strokeStyle = '#5a5e63'; x.lineWidth = 4; x.beginPath(); x.arc(C, C, 40, 0, 7); x.stroke();
  grime(x, W, W, 171, 0.1);
  return c;
}

// ---------- Recursos (superpuestos al terreno) ----------
function resourceTile(type, variant) {
  const c = canvas(S, S);
  const x = c.getContext('2d');
  const r = (i) => hash2(variant, i, type * 17);
  x.shadowColor = 'rgba(0,0,0,0.5)';
  x.shadowOffsetY = 3; x.shadowBlur = 3;
  if (type === 4) {
    // charco de petróleo con brillo irisado
    x.shadowColor = 'transparent';
    x.fillStyle = '#0b0b0f';
    x.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2, rr = 22 + r(k) * 8;
      k ? x.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr) : x.moveTo(32 + rr, 32);
    }
    x.closePath(); x.fill();
    const g = x.createLinearGradient(14, 14, 50, 50);
    g.addColorStop(0, 'rgba(120,60,200,0.35)'); g.addColorStop(0.5, 'rgba(40,200,180,0.25)'); g.addColorStop(1, 'rgba(220,180,60,0.3)');
    x.fillStyle = g;
    x.beginPath(); x.ellipse(28 + r(20) * 8, 28 + r(21) * 8, 10, 6, r(22) * 3, 0, 7); x.fill();
    return c;
  }
  if (type === 5) {
    const n = 3 + Math.floor(r(0) * 3);
    for (let i = 0; i < n; i++) {
      const cx = 12 + r(i + 1) * 40, cy = 12 + r(i + 11) * 40, sz = 6 + r(i + 21) * 6;
      x.fillStyle = '#1e2a18';
      x.beginPath(); x.arc(cx, cy, sz + 2, 0, 7); x.fill();
      x.shadowColor = 'transparent';
      x.fillStyle = '#5ac83a'; x.beginPath(); x.arc(cx - 1, cy - 1, sz * 0.7, 0, 7); x.fill();
      x.fillStyle = '#c8ff8a'; x.beginPath(); x.arc(cx - sz * 0.3, cy - sz * 0.3, sz * 0.25, 0, 7); x.fill();
      x.shadowColor = 'rgba(0,0,0,0.5)';
    }
    return c;
  }
  if (type === 2 || type === 3) {
    // cobre: rocas anaranjadas con pátina verde · carbón: trozos negros brillantes
    const base = type === 2 ? ['#5a3420', '#b8693a', '#e0a070'] : ['#0e0e10', '#26262a', '#5a5a62'];
    const n = 3 + Math.floor(r(0) * 3);
    for (let i = 0; i < n; i++) {
      const cx = 10 + r(i + 1) * 44, cy = 10 + r(i + 11) * 44, sz = 7 + r(i + 21) * 8;
      x.fillStyle = base[0];
      x.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + r(i + 31);
        const rr = sz * (0.7 + r(i * 7 + k) * 0.45);
        k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      x.closePath(); x.fill();
      x.shadowColor = 'transparent';
      x.fillStyle = base[1];
      x.beginPath(); x.arc(cx - sz * 0.15, cy - sz * 0.2, sz * 0.55, 0, 7); x.fill();
      if (type === 2) { x.fillStyle = '#4fa58a'; x.beginPath(); x.arc(cx + sz * 0.3, cy + sz * 0.2, sz * 0.28, 0, 7); x.fill(); }
      x.fillStyle = base[2];
      x.beginPath(); x.arc(cx - sz * 0.3, cy - sz * 0.35, sz * 0.18, 0, 7); x.fill();
      x.shadowColor = 'rgba(0,0,0,0.5)';
    }
  } else if (type === 1) {
    const base = ['#5e2c20', '#9a4630', '#c96a4c'];
    const n = 3 + Math.floor(r(0) * 3);
    for (let i = 0; i < n; i++) {
      const cx = 10 + r(i + 1) * 44, cy = 10 + r(i + 11) * 44, s = 7 + r(i + 21) * 9;
      x.fillStyle = base[0];
      x.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + r(i + 31);
        const rr = s * (0.7 + r(i * 7 + k) * 0.5);
        k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      x.closePath(); x.fill();
      x.shadowColor = 'transparent';
      x.fillStyle = base[1];
      x.beginPath(); x.moveTo(cx - s * 0.6, cy - s * 0.1); x.lineTo(cx - s * 0.1, cy - s * 0.7); x.lineTo(cx + s * 0.6, cy - s * 0.3); x.lineTo(cx + s * 0.1, cy + s * 0.2); x.closePath(); x.fill();
      x.fillStyle = base[2];
      x.beginPath(); x.moveTo(cx - s * 0.3, cy - s * 0.25); x.lineTo(cx - s * 0.05, cy - s * 0.55); x.lineTo(cx + s * 0.15, cy - s * 0.3); x.closePath(); x.fill();
      x.shadowColor = 'rgba(0,0,0,0.5)';
    }
  } else if (type === 99) {
    const n = 4 + Math.floor(r(0) * 4);
    for (let i = 0; i < n; i++) {
      const cx = 8 + r(i + 1) * 48, cy = 8 + r(i + 11) * 48, s = 5 + r(i + 21) * 6;
      x.fillStyle = '#6b4a12';
      x.beginPath(); x.arc(cx, cy, s + 2, 0, 7); x.fill();
      x.shadowColor = 'transparent';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + r(i);
        x.fillStyle = k % 2 ? '#e0a83a' : '#b9801f';
        x.beginPath(); x.ellipse(cx + Math.cos(a) * s * 0.6, cy + Math.sin(a) * s * 0.6, s * 0.6, s * 0.35, a, 0, 7); x.fill();
      }
      x.fillStyle = 'rgba(255,230,140,0.9)';
      x.beginPath(); x.arc(cx, cy, 1.8, 0, 7); x.fill();
      x.shadowColor = 'rgba(0,0,0,0.5)';
    }
  }
  return c;
}

export function buildSprites() {
  const sp = { items: {}, itemsSmall: {}, belt: {}, miner: {}, furnace: {}, res: {} };
  for (const id of ITEM_IDS) { sp.items[id] = itemIcon(id, 32); sp.itemsSmall[id] = itemIcon(id, 16); }
  sp.itemByIndex = ITEM_IDS.map((id) => sp.items[id]);
  sp.itemColor = ITEM_IDS.map((id) => ITEMS[id].color);
  for (const tier of [1, 2]) {
    const frames = [];
    for (let f = 0; f < BELT_FRAMES; f++) frames.push(beltFrame(tier, f));
    sp.belt[tier] = [0, 1, 2, 3].map((d) => frames.map((fr) => rotated(fr, d)));
  }
  for (const tier of [1, 2]) {
    sp.miner[tier] = [0, 1, 2, 3].map((d) => Array.from({ length: 8 }, (_, f) => rotated(minerSprite(tier, f), d)));
  }
  sp.furnace.off = [0, 1, 2, 3].map((d) => rotated(furnaceSprite(false, 0), d));
  sp.furnace.on = [0, 1, 2, 3].map((d) => Array.from({ length: 6 }, (_, f) => rotated(furnaceSprite(true, f), d)));
  sp.chest = chestSprite();
  sp.splitter = [0, 1, 2, 3].map((d) => rotated(splitterSprite(), d));
  sp.hub = Array.from({ length: 12 }, (_, f) => hubSprite(f));
  sp.press = [0, 1, 2, 3].map((d) => Array.from({ length: 8 }, (_, f) => rotated(pressSprite(f), d)));
  sp.assembler = [0, 1, 2, 3].map((d) => Array.from({ length: 12 }, (_, f) => rotated(assemblerSprite(f), d)));
  sp.port = portSprite();
  sp.launcher = Array.from({ length: 6 }, (_, k) => launcherSprite(k / 5));
  sp.drone = Array.from({ length: 6 }, (_, f) => droneSprite(f));
  sp.pole = poleSprite();
  sp.solar = solarSprite();
  sp.centrifuge = [0, 1, 2, 3].map((d) => Array.from({ length: 8 }, (_, f) => rotated(centrifugeSprite(f), d)));
  sp.reactor = { off: reactorSprite(false, 0), on: Array.from({ length: 6 }, (_, f) => reactorSprite(true, f)) };
  sp.pumpjack = [0, 1, 2, 3].map((d) => Array.from({ length: 8 }, (_, f) => rotated(pumpjackSprite(f), d)));
  sp.refinery = [0, 1, 2, 3].map((d) => Array.from({ length: 6 }, (_, f) => rotated(refinerySprite(f), d)));
  sp.fuelgen = Array.from({ length: 2 }, (_, f) => fuelGenSprite(f));
  sp.battery = Array.from({ length: 6 }, (_, k) => batterySprite(k / 5));
  sp.pump = Array.from({ length: 8 }, (_, f) => pumpSprite(f));
  sp.boiler = { off: [0, 1, 2, 3].map((d) => rotated(boilerSprite(false, 0), d)), on: [0, 1, 2, 3].map((d) => Array.from({ length: 6 }, (_, f) => rotated(boilerSprite(true, f), d))) };
  sp.generator = Array.from({ length: 12 }, (_, f) => generatorSprite(f * (Math.PI * 2 / 0.35) / 12 / 10 * 2));
  for (const t of [1, 2, 3, 4, 5]) sp.res[t] = Array.from({ length: 8 }, (_, v) => resourceTile(t, v));
  return sp;
}

// Icono para la barra de herramientas
export function toolIcon(sp, type) {
  const c = canvas(48, 48);
  const x = c.getContext('2d');
  let img;
  switch (type) {
    case 'cinta': img = sp.belt[1][0][0]; break;
    case 'cinta2': img = sp.belt[2][0][0]; break;
    case 'taladro': img = sp.miner[1][0][0]; break;
    case 'taladro2': img = sp.miner[2][0][0]; break;
    case 'horno': img = sp.furnace.on[0][0]; break;
    case 'caja': img = sp.chest; break;
    case 'divisor': img = sp.splitter[0]; break;
    case 'prensa': img = sp.press[0][0]; break;
    case 'ensambladora': img = sp.assembler[0][0]; break;
    case 'poste': img = sp.pole; break;
    case 'bomba': img = sp.pump[0]; break;
    case 'tuberia': { x.fillStyle = '#6b7076'; x.fillRect(4, 18, 40, 12); x.fillStyle = '#9aa0a7'; x.fillRect(4, 20, 40, 3); x.fillStyle = '#3a3d41'; x.fillRect(10, 16, 4, 16); x.fillRect(34, 16, 4, 16); return c.toDataURL(); }
    case 'caldera': img = sp.boiler.on[0][0]; break;
    case 'generador': img = sp.generator[0]; break;
    case 'solar': img = sp.solar; break;
    case 'centrifugadora': img = sp.centrifuge[0][0]; break;
    case 'reactor': img = sp.reactor.on[0]; break;
    case 'pozo': img = sp.pumpjack[0][0]; break;
    case 'refineria': img = sp.refinery[0][0]; break;
    case 'genComb': img = sp.fuelgen[0]; break;
    case 'acumulador': img = sp.battery[4]; break;
    case 'puerto': img = sp.port; break;
    case 'catapulta': img = sp.launcher[3]; break;
    default: img = sp.chest;
  }
  x.drawImage(img, 2, 2, 44, 44);
  return c.toDataURL();
}
