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

// ---------- Recursos (superpuestos al terreno) ----------
function resourceTile(type, variant) {
  const c = canvas(S, S);
  const x = c.getContext('2d');
  const r = (i) => hash2(variant, i, type * 17);
  x.shadowColor = 'rgba(0,0,0,0.5)';
  x.shadowOffsetY = 3; x.shadowBlur = 3;
  if (type === 2) {
    // cobalina: esquirlas de cristal azul que brillan
    const n = 3 + Math.floor(r(0) * 3);
    for (let i = 0; i < n; i++) {
      const cx = 12 + r(i + 1) * 40, cy = 18 + r(i + 11) * 38, hgt = 12 + r(i + 21) * 14, wd = 5 + r(i + 41) * 4;
      const lean = (r(i + 51) - 0.5) * 8;
      x.fillStyle = '#163a63';
      x.beginPath(); x.moveTo(cx - wd, cy); x.lineTo(cx + lean, cy - hgt); x.lineTo(cx + wd, cy); x.lineTo(cx, cy + 4); x.closePath(); x.fill();
      x.shadowColor = 'transparent';
      x.fillStyle = '#3d86cf';
      x.beginPath(); x.moveTo(cx - wd + 1, cy - 1); x.lineTo(cx + lean, cy - hgt + 2); x.lineTo(cx, cy + 2); x.closePath(); x.fill();
      x.fillStyle = '#9fd8ff';
      x.beginPath(); x.moveTo(cx - 1, cy - 3); x.lineTo(cx + lean * 0.9, cy - hgt + 4); x.lineTo(cx + 1.5, cy - 4); x.closePath(); x.fill();
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
  } else if (type === 3) {
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
  for (const t of [1, 2, 3]) sp.res[t] = Array.from({ length: 8 }, (_, v) => resourceTile(t, v));
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
    default: img = sp.chest;
  }
  x.drawImage(img, 2, 2, 44, 44);
  return c.toDataURL();
}
