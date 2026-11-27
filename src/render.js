// Dibujo con Canvas 2D: terreno en bloques cacheados, cintas y edificios con
// recorte a lo visible y nivel de detalle según el zoom.
import { TILE, BUILDINGS, UPS, RECIPES, MINE_RANGE } from './config.js';
import { T_RUST, T_MARSH, T_WATER } from './world.js';
import { S, BELT_FRAMES } from './sprites.js';
import { fbm, hash2 } from './noise.js';
import { DX, DY } from './sim.js';

const CH = 32;   // casillas por bloque de terreno
const TP = 16;   // píxeles por casilla en la caché de terreno

export class Renderer {
  constructor(canvas, game, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.game = game;
    this.sp = sprites;
    this.cam = { x: 0, y: 0, z: 1 };
    this.chunks = new Map();
    this.ground = new Map();
    this.particles = [];
    this.floaters = [];
    this.fogCanvas = document.createElement('canvas');
    this.fogDirty = true;
    this.frame = 0;
    this.dpr = 1;
    this.resize();
  }

  setGame(game) { this.game = game; this.chunks.clear(); this.ground.clear(); this.fogDirty = true; this.miniDirty = true; this.particles = []; this.floaters = []; }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.vw = w; this.vh = h;
  }

  // pantalla (CSS px) -> casilla
  screenToTile(sx, sy) {
    const z = this.cam.z;
    const wx = (sx - this.vw / 2) / z + this.cam.x;
    const wy = (sy - this.vh / 2) / z + this.cam.y;
    return { x: Math.floor(wx / TILE), y: Math.floor(wy / TILE), fx: wx / TILE, fy: wy / TILE };
  }

  zoomAt(sx, sy, factor) {
    const before = this.screenToTile(sx, sy);
    this.cam.z = Math.max(0.2, Math.min(2.6, this.cam.z * factor));
    const after = this.screenToTile(sx, sy);
    this.cam.x += (before.fx - after.fx) * TILE;
    this.cam.y += (before.fy - after.fy) * TILE;
    this.clampCam();
  }

  clampCam() {
    const w = this.game.world.w * TILE, h = this.game.world.h * TILE;
    this.cam.x = Math.max(0, Math.min(w, this.cam.x));
    this.cam.y = Math.max(0, Math.min(h, this.cam.y));
  }

  // ---------- Terreno ----------
  groundChunk(cx, cy) {
    const key = cy * 1000 + cx;
    let c = this.ground.get(key);
    if (c) return c;
    if (this.budget <= 0) return null; // se genera en un frame posterior
    this.budget--;
    c = document.createElement('canvas');
    c.width = c.height = CH * TP;
    const x = c.getContext('2d');
    const world = this.game.world;
    const img = x.createImageData(CH * TP, CH * TP);
    const d = img.data;
    const seed = world.seed;
    const rowJ = new Float32Array((CH * TP / 2) * 4);
    const N = CH * TP;
    let jx = 0, jy = 0, n1 = 0, crack = 0;
    for (let py = 0; py < N; py++) {
      for (let px = 0; px < N; px++) {
        const gx = cx * CH + px / TP, gy = cy * CH + py / TP;
        // ruido caro en bloques de 2x2 px (cacheado por fila de bloques)
        const bi = px >> 1;
        if ((py & 1) === 0 && (px & 1) === 0) {
          const bx = cx * CH + (px + 1) / TP, by = cy * CH + (py + 1) / TP;
          rowJ[bi * 4] = bx + (fbm(bx / 2.5, by / 2.5, seed + 3, 2) - 0.5) * 1.4;
          rowJ[bi * 4 + 1] = by + (fbm(bx / 2.5, by / 2.5, seed + 9, 2) - 0.5) * 1.4;
          rowJ[bi * 4 + 2] = fbm(bx / 6, by / 6, seed + 50, 3);
          rowJ[bi * 4 + 3] = fbm(bx / 1.3, by / 1.3, seed + 77, 2);
        }
        jx = rowJ[bi * 4]; jy = rowJ[bi * 4 + 1]; n1 = rowJ[bi * 4 + 2]; crack = rowJ[bi * 4 + 3];
        const tx = Math.max(0, Math.min(world.w - 1, Math.floor(jx)));
        const ty = Math.max(0, Math.min(world.h - 1, Math.floor(jy)));
        const t = world.terrain[ty * world.w + tx];
        const n2 = hash2(cx * N + px, cy * N + py, seed);
        let r, g, b;
        if (t === T_WATER) {
          const ripple = Math.sin((gx + gy) * 2.2 + n1 * 8) * 0.5 + 0.5;
          r = 14 + ripple * 8; g = 34 + ripple * 14 + n1 * 18; b = 46 + ripple * 18 + n1 * 20;
        } else {
          if (t === T_RUST) { r = 86; g = 58; b = 46; }
          else if (t === T_MARSH) { r = 44; g = 60; b = 62; }
          else { r = 62; g = 58; b = 54; }
          const v = (n1 - 0.5) * 56 + (n2 - 0.5) * 12;
          r += v; g += v * 0.95; b += v * 0.9;
          if (crack > 0.48 && crack < 0.495) { r *= 0.8; g *= 0.8; b *= 0.8; }
        }
        const i = (py * N + px) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // decoración: piedras y flora luminosa
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const gx = cx * CH + tx, gy = cy * CH + ty;
      if (!world.inside(gx, gy)) continue;
      const i = world.idx(gx, gy);
      const t = world.terrain[i];
      if (t === T_WATER) continue;
      const h = hash2(gx, gy, seed + 5);
      const px = tx * TP + hash2(gx, gy, 1) * TP, py = ty * TP + hash2(gx, gy, 2) * TP;
      if (world.resource[i]) {
        x.fillStyle = 'rgba(0,0,0,0.18)';
        x.fillRect(tx * TP, ty * TP, TP, TP);
      } else if (h < 0.08) {
        x.fillStyle = 'rgba(20,18,16,0.55)';
        x.beginPath(); x.ellipse(px + 1, py + 1.5, 2.6, 1.8, 0, 0, 7); x.fill();
        x.fillStyle = t === T_RUST ? '#7a5141' : '#6a6560';
        x.beginPath(); x.ellipse(px, py, 2.4, 1.6, 0, 0, 7); x.fill();
      } else if (h < 0.11 && t !== T_RUST) {
        x.fillStyle = t === T_MARSH ? 'rgba(90,220,210,0.7)' : 'rgba(170,120,230,0.6)';
        for (let k = 0; k < 3; k++) {
          x.beginPath(); x.arc(px + (k - 1) * 2.2, py + (k % 2) * 1.5, 0.9, 0, 7); x.fill();
        }
      }
    }
    this.ground.set(key, c);
    return c;
  }

  // Bloque final = suelo + yacimientos (se recompone barato cuando uno se agota).
  chunk(cx, cy) {
    const key = cy * 1000 + cx;
    let c = this.chunks.get(key);
    if (c) return c;
    const g = this.groundChunk(cx, cy);
    if (!g) return null;
    c = document.createElement('canvas');
    c.width = c.height = CH * TP;
    const x = c.getContext('2d');
    x.drawImage(g, 0, 0);
    const world = this.game.world;
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const gx = cx * CH + tx, gy = cy * CH + ty;
      if (!world.inside(gx, gy)) continue;
      const i = world.idx(gx, gy);
      const res = world.resource[i];
      if (!res) continue;
      x.globalAlpha = world.amount[i] < 120 ? 0.55 : 1;
      x.drawImage(this.sp.res[res][(hash2(gx, gy, world.seed + 5) * 8) | 0], tx * TP, ty * TP, TP, TP);
    }
    x.globalAlpha = 1;
    this.chunks.set(key, c);
    return c;
  }

  invalidateTile(k) {
    const w = this.game.world;
    const x = k % w.w, y = (k / w.w) | 0;
    this.chunks.delete(((y / CH) | 0) * 1000 + ((x / CH) | 0));
    this.miniDirty = true;
  }

  // ---------- Niebla ----------
  updateFog() {
    const w = this.game.world;
    const c = this.fogCanvas;
    if (c.width !== w.w) { c.width = w.w; c.height = w.h; }
    const x = c.getContext('2d');
    const img = x.createImageData(w.w, w.h);
    const d = img.data;
    for (let i = 0; i < w.explored.length; i++) {
      const o = i * 4;
      d[o] = 9; d[o + 1] = 11; d[o + 2] = 14;
      d[o + 3] = w.explored[i] ? 0 : 244;
    }
    x.putImageData(img, 0, 0);
    this.fogDirty = false;
  }

  // ---------- Efectos ----------
  puff(x, y, kind) {
    if (this.particles.length > 400) return;
    const r = Math.random;
    if (kind === 'smoke') this.particles.push({ x, y, vx: (r() - 0.5) * 6, vy: -10 - r() * 8, life: 1.6, max: 1.6, size: 5 + r() * 4, color: '120,115,110' });
    else if (kind === 'dust') this.particles.push({ x, y, vx: (r() - 0.5) * 30, vy: (r() - 0.5) * 30, life: 0.6, max: 0.6, size: 2 + r() * 2, color: this.dustColor || '150,110,90' });
    else if (kind === 'spark') this.particles.push({ x, y, vx: (r() - 0.5) * 70, vy: (r() - 0.5) * 70, life: 0.35, max: 0.35, size: 1.5, color: '255,200,110' });
    else if (kind === 'beam') this.particles.push({ x, y, vx: (r() - 0.5) * 40, vy: -20 - r() * 30, life: 0.5, max: 0.5, size: 2.5, color: '120,240,220' });
  }

  floater(item, x, y) {
    if (this.floaters.length > 30) return;
    this.floaters.push({ item, x, y, t: 0 });
  }

  // ---------- Frame ----------
  draw(state, dt) {
    const { ctx, cam, game, sp } = this;
    const z = cam.z * this.dpr;
    this.frame++;
    this.budget = this.ground.size < 4 ? 4 : 1;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#090b0e';
    ctx.fillRect(0, 0, W, H);
    const ox = W / 2 - cam.x * z, oy = H / 2 - cam.y * z;
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = cam.z < 0.6 ? 'low' : 'medium';

    const world = game.world;
    const x0 = Math.max(0, Math.floor((-ox / z) / TILE) - 1);
    const y0 = Math.max(0, Math.floor((-oy / z) / TILE) - 1);
    const x1 = Math.min(world.w - 1, Math.ceil(((W - ox) / z) / TILE) + 1);
    const y1 = Math.min(world.h - 1, Math.ceil(((H - oy) / z) / TILE) + 1);

    // terreno
    const cs = CH * TILE;
    for (let cy = Math.floor(y0 / CH); cy <= Math.floor(y1 / CH); cy++) {
      for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) {
        const ch = this.chunk(cx, cy);
        if (ch) ctx.drawImage(ch, cx * cs, cy * cs, cs + 0.5, cs + 0.5);
        else { ctx.fillStyle = '#3a3633'; ctx.fillRect(cx * cs, cy * cs, cs, cs); }
      }
    }
    const detail = cam.z >= 0.55;
    if (cam.z >= 0.9) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const k = y * world.w + x;
        const r = world.resource[k];
        if (!r || game.grid[k] >= 0 || !world.explored[k]) continue;
        if (world.amount[k] < 120) ctx.globalAlpha = 0.55;
        ctx.drawImage(sp.res[r][(hash2(x, y, world.seed + 5) * 8) | 0], x * TILE, y * TILE, TILE, TILE);
        ctx.globalAlpha = 1;
      }
    }

    // guía del tutorial sobre el terreno
    if (state.guide) {
      const g = state.guide;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
      ctx.strokeStyle = `rgba(79,209,189,${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = 3 / cam.z;
      const r = (1.2 + pulse * 0.4) * TILE;
      ctx.beginPath(); ctx.arc((g.x + 0.5) * TILE, (g.y + 0.5) * TILE, r, 0, 7); ctx.stroke();
    }

    if (state.tool && cam.z >= 0.7) {
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1 / cam.z;
      ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(x * TILE, y0 * TILE); ctx.lineTo(x * TILE, (y1 + 1) * TILE); }
      for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(x0 * TILE, y * TILE); ctx.lineTo((x1 + 1) * TILE, y * TILE); }
      ctx.stroke();
    }

    const t = game.tick / UPS;
    const grid = game.grid, ents = game.ents, gw = world.w;
    const stamp = this.frame;
    const big = [];
    let beltCount = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * gw;
      for (let x = x0; x <= x1; x++) {
        const id = grid[row + x];
        if (id < 0) continue;
        const e = ents[id];
        if (e.kind !== 'belt') {
          if (e._s !== stamp) { e._s = stamp; big.push(e); }
          continue;
        }
        beltCount++;
        const tier = e.type === 'cinta2' ? 2 : 1;
        if (detail) {
          const f = ((t * e.def.speed * 4 * BELT_FRAMES) | 0) % BELT_FRAMES;
          ctx.drawImage(sp.belt[tier][e.dir][f], x * TILE, y * TILE, TILE, TILE);
        } else {
          ctx.fillStyle = '#2f3235';
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          ctx.fillStyle = tier === 2 ? '#6d4aa8' : '#2f8478';
          if (e.dir & 1) ctx.fillRect(x * TILE + 13, y * TILE, 6, TILE);
          else ctx.fillRect(x * TILE, y * TILE + 13, TILE, 6);
        }
      }
    }
    const isz = TILE * 0.5;
    for (let y = y0; y <= y1; y++) {
      const row = y * gw;
      for (let x = x0; x <= x1; x++) {
        const id = grid[row + x];
        if (id < 0) continue;
        const e = ents[id];
        if (e.kind !== 'belt' || e.it.length === 0) continue;
        const dx = DX[e.dir], dy = DY[e.dir];
        for (let i = 0; i < e.it.length; i++) {
          const p = e.ip[i] - 0.5;
          const cx = (x + 0.5 + dx * p) * TILE, cy = (y + 0.5 + dy * p) * TILE;
          if (detail) ctx.drawImage(sp.itemByIndex[e.it[i]], cx - isz / 2, cy - isz / 2, isz, isz);
          else { ctx.fillStyle = sp.itemColor[e.it[i]]; ctx.fillRect(cx - 6, cy - 6, 12, 12); }
        }
      }
    }
    // edificios
    const now = performance.now() / 1000;
    // tuberías primero (por debajo)
    for (const e of big) if (e.kind === 'pipe') this.drawPipe(e);
    // zonas de energía al colocar algo eléctrico
    const tdef = state.tool && BUILDINGS[state.tool];
    const sel0 = state.selected;
    if ((tdef && (tdef.power || tdef.output || tdef.kind === 'pole' || tdef.kind === 'battery')) || (sel0 && (sel0.kind === 'pole' || sel0.def.power))) {
      ctx.fillStyle = 'rgba(90,160,255,0.10)';
      ctx.strokeStyle = 'rgba(90,160,255,0.35)';
      ctx.lineWidth = 1 / cam.z;
      for (const e of game.machines) {
        if (e.kind !== 'pole' && e.kind !== 'hub') continue;
        const r = e.def.supply;
        const ax = (e.x - r) * TILE, ay = (e.y - r) * TILE, sz = (e.size + 2 * r) * TILE;
        if (ax > (x1 + 1) * TILE || ay > (y1 + 1) * TILE || ax + sz < x0 * TILE || ay + sz < y0 * TILE) continue;
        ctx.fillRect(ax, ay, sz, sz);
        ctx.strokeRect(ax, ay, sz, sz);
      }
    }
    for (const e of big) {
      if (e.kind === 'pipe') continue;
      const s = e.size * TILE;
      const px = e.x * TILE, py = e.y * TILE;
      if (e.kind === 'pole') { ctx.drawImage(this.sp.pole, px, py, s, s); continue; }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 5, py + 7, s - 4, s - 4);
      ctx.drawImage(this.buildingSprite(e, t), px, py, s, s);
      // efectos de trabajo
      if (e.status === 'work' && Math.random() < dt * 6) {
        if (e.kind === 'furnace' || e.kind === 'boiler') this.puff(px + 14, py + 14, 'smoke');
        else if (e.kind === 'miner') { this.dustColor = e.res === 2 ? '200,130,70' : e.res === 3 ? '40,40,44' : '170,95,70'; this.puff(px + s / 2, py + s / 2 - 6, 'dust'); }
        else if (e.kind === 'crafter') this.puff(px + s / 2, py + s / 2, 'spark');
      }
      if (detail) {
        // qué produce
        let icon = null;
        if (e.kind === 'miner') icon = e.item;
        else if (e.kind === 'furnace') icon = e.outType || (e.inType && null);
        else if (e.kind === 'crafter' && e.recipe) icon = RECIPES[e.recipe].out;
        if (icon) {
          ctx.fillStyle = 'rgba(15,17,19,0.75)';
          ctx.beginPath(); ctx.arc(px + s - 12, py + 12, 10, 0, 7); ctx.fill();
          ctx.drawImage(sp.items[icon], px + s - 21, py + 3, 18, 18);
        }
        // luz de estado
        if (e.kind === 'miner' || e.kind === 'furnace' || e.kind === 'crafter' || e.kind === 'boiler' || e.kind === 'generator' || e.kind === 'battery') {
          const st = e.status;
          const col = st === 'discharge' ? '#4fd1bd' : st === 'work' ? '#5fe08a' : (st === 'full' || st === 'nowater') ? '#ff5a4a' : st === 'empty' ? '#8a8f95' : st === 'nopower' ? '#5aa0ff' : '#f2c14a';
          const blink = st === 'full' || st === 'empty' || st === 'nopower' || st === 'nowater' || st === 'nofuel' ? (Math.sin(now * 6) > 0 ? 1 : 0.35) : 1;
          if (st === 'nopower') {
            ctx.globalAlpha = blink;
            ctx.fillStyle = 'rgba(15,17,19,0.8)';
            ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, 11, 0, 7); ctx.fill();
            ctx.fillStyle = '#ffd54a';
            const bx = px + s / 2, by = py + s / 2;
            ctx.beginPath(); ctx.moveTo(bx + 2, by - 8); ctx.lineTo(bx - 5, by + 1); ctx.lineTo(bx, by + 1); ctx.lineTo(bx - 2, by + 8); ctx.lineTo(bx + 5, by - 1); ctx.lineTo(bx, by - 1); ctx.closePath(); ctx.fill();
          }
          ctx.globalAlpha = blink;
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(px + 9, py + s - 9, 5.5, 0, 7); ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(px + 9, py + s - 9, 3.8, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      if (!['hub', 'chest', 'splitter', 'pump', 'boiler', 'generator', 'solar', 'battery'].includes(e.kind) && (state.tool || cam.z >= 0.9)) {
        const [tx, ty] = game.outputTile(e);
        this.arrow(tx, ty, e.dir, state.tool ? 'rgba(255,170,60,0.85)' : 'rgba(255,170,60,0.45)');
      }
    }
    this.stats = { belts: beltCount, big: big.length };

    // cables entre postes
    ctx.lineWidth = 1.6;
    for (const [a, b] of game.wires) {
      const ax = (a.x + a.size / 2) * TILE, ay = (a.y + a.size / 2) * TILE;
      const bx = (b.x + b.size / 2) * TILE, by = (b.y + b.size / 2) * TILE;
      if (Math.max(ax, bx) < x0 * TILE || Math.min(ax, bx) > (x1 + 1) * TILE || Math.max(ay, by) < y0 * TILE || Math.min(ay, by) > (y1 + 1) * TILE) continue;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.moveTo(ax + 4, ay + 6); ctx.quadraticCurveTo((ax + bx) / 2 + 4, (ay + by) / 2 + 14, bx + 4, by + 6); ctx.stroke();
      ctx.strokeStyle = '#b8743a';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 8, bx, by); ctx.stroke();
    }

    // partículas
    ctx.globalCompositeOperation = 'source-over';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const a = p.life / p.max;
      ctx.fillStyle = `rgba(${p.color},${a * 0.7})`;
      const sz = p.size * (p.color === '120,115,110' ? 2 - a : 1);
      ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, 7); ctx.fill();
    }

    // dron
    const d = game.drone;
    if (d) {
      const dxp = d.x * TILE, dyp = d.y * TILE;
      if (state.mining) {
        const m = state.mining;
        const mx = (m.x + 0.5) * TILE, my = (m.y + 0.5) * TILE;
        ctx.strokeStyle = 'rgba(79,209,189,0.25)'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(dxp, dyp); ctx.lineTo(mx, my); ctx.stroke();
        ctx.strokeStyle = 'rgba(160,255,240,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(dxp, dyp); ctx.lineTo(mx + Math.sin(now * 40) * 3, my + Math.cos(now * 33) * 3); ctx.stroke();
        if (Math.random() < dt * 25) this.puff(mx, my, 'beam');
      }
      const bob = Math.sin(now * 3) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(dxp + 8, dyp + 14, 22, 16, 0, 0, 7); ctx.fill();
      ctx.save();
      ctx.translate(dxp, dyp + bob - 6);
      ctx.rotate(d.angle);
      ctx.drawImage(sp.drone[((now * 30) | 0) % 6], -24, -24, 48, 48);
      ctx.restore();
      // anillo de alcance de extracción mientras se busca recurso
      if (state.showRange) {
        ctx.strokeStyle = 'rgba(79,209,189,0.25)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5 / cam.z;
        ctx.beginPath(); ctx.arc(dxp, dyp, MINE_RANGE * TILE, 0, 7); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // noche: oscurecer y encender luces
    const light = game.light ?? 1;
    if (light < 0.98) {
      ctx.fillStyle = `rgba(8,12,32,${(1 - light) * 0.62})`;
      ctx.fillRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
      ctx.globalCompositeOperation = 'lighter';
      const a = (1 - light) * 0.5;
      for (const e of big) {
        const warm = (e.kind === 'furnace' || e.kind === 'boiler') && e.status === 'work';
        const lamp = e.kind === 'hub' || (e.status === 'work' && e.kind !== 'solar');
        if (!warm && !lamp) continue;
        const cx = (e.x + e.size / 2) * TILE, cy = (e.y + e.size / 2) * TILE;
        const r = (warm ? 2.2 : 1.4) * e.size * TILE * 0.6;
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
        g.addColorStop(0, warm ? `rgba(255,140,50,${a})` : `rgba(120,220,200,${a * 0.6})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      if (d) {
        const cx = d.x * TILE, cy = d.y * TILE, r = 5 * TILE;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
        g.addColorStop(0, `rgba(200,230,255,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // niebla
    if (this.fogDirty) this.updateFog();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    {
      const fx0 = Math.max(0, x0 - 1), fy0 = Math.max(0, y0 - 1);
      const fw = Math.min(world.w, x1 + 2) - fx0, fh = Math.min(world.h, y1 + 2) - fy0;
      if (fw > 0 && fh > 0) ctx.drawImage(this.fogCanvas, fx0, fy0, fw, fh, fx0 * TILE, fy0 * TILE, fw * TILE, fh * TILE);
    }

    // vista previa
    if (state.preview) for (const g of state.preview) this.ghost(g);
    if (state.hover && state.erase) {
      const e = game.entityAt(state.hover.x, state.hover.y);
      ctx.fillStyle = 'rgba(230,60,50,0.35)';
      if (e && e.kind !== 'hub') ctx.fillRect(e.x * TILE, e.y * TILE, e.size * TILE, e.size * TILE);
      else ctx.fillRect(state.hover.x * TILE, state.hover.y * TILE, TILE, TILE);
    }
    const sel = state.selected;
    if (sel && game.ents[sel.id] === sel) {
      ctx.strokeStyle = 'rgba(79,209,189,0.95)';
      ctx.lineWidth = 3 / cam.z;
      this.corners(sel.x * TILE, sel.y * TILE, sel.size * TILE);
    } else if (state.hover && !state.tool && !state.erase) {
      const e = game.entityAt(state.hover.x, state.hover.y);
      const hx = e ? e.x : state.hover.x, hy = e ? e.y : state.hover.y, hs = e ? e.size : 1;
      ctx.strokeStyle = 'rgba(255,200,90,0.9)';
      ctx.lineWidth = 2 / cam.z;
      this.corners(hx * TILE, hy * TILE, hs * TILE);
    }

    // +1 al entregar en la Baliza
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      if (f.t > 1.2) { this.floaters.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - f.t / 1.2;
      ctx.drawImage(sp.items[f.item], f.x - 9, f.y - 30 * f.t - 9, 18, 18);
      ctx.fillStyle = '#e4ded3';
      ctx.font = 'bold 12px system-ui';
      ctx.fillText('+1', f.x + 10, f.y - 30 * f.t + 4);
      ctx.globalAlpha = 1;
    }

    // flecha en pantalla hacia el objetivo si está fuera de vista
    if (state.guide) {
      const gx = (state.guide.x + 0.5) * TILE * z + ox, gy = (state.guide.y + 0.5) * TILE * z + oy;
      const m = 40 * this.dpr;
      if (gx < m || gy < m || gx > W - m || gy > H - m) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const cx = W / 2, cy = H / 2;
        const a = Math.atan2(gy - cy, gx - cx);
        const rx = W / 2 - m - 30 * this.dpr, ry = H / 2 - m - 70 * this.dpr;
        const k = Math.min(Math.abs(rx / Math.cos(a)), Math.abs(ry / Math.sin(a)));
        ctx.translate(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
        ctx.rotate(a);
        ctx.scale(this.dpr, this.dpr);
        const pulse = 1 + 0.15 * Math.sin(now * 6);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(79,209,189,0.95)';
        ctx.strokeStyle = '#0d0f10'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    }
  }

  drawPipe(e) {
    const { ctx, game } = this;
    const px = e.x * TILE, py = e.y * TILE, c = TILE / 2;
    const fluid = ['pipe', 'pump', 'boiler'];
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(px + c + 3, py + c + 4, 8, 0, 7); ctx.fill();
    for (let d = 0; d < 4; d++) {
      const n = game.entityAt(e.x + DX[d], e.y + DY[d]);
      if (!n || !fluid.includes(n.kind)) continue;
      ctx.save();
      ctx.translate(px + c, py + c);
      ctx.rotate((d * Math.PI) / 2);
      ctx.fillStyle = '#4d5257'; ctx.fillRect(0, -6, c + 1, 12);
      ctx.fillStyle = '#8c9197'; ctx.fillRect(0, -4, c + 1, 3);
      ctx.restore();
    }
    ctx.fillStyle = '#5a5e63';
    ctx.beginPath(); ctx.arc(px + c, py + c, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#9aa0a7';
    ctx.beginPath(); ctx.arc(px + c - 2, py + c - 2, 3, 0, 7); ctx.fill();
  }

  buildingSprite(e, t) {
    const sp = this.sp;
    const on = e.status === 'work';
    if (on) e._anim = (e._anim || 0) + 0.25;
    const a = (e._anim || 0) | 0;
    switch (e.kind) {
      case 'miner': return sp.miner[e.type === 'taladro2' ? 2 : 1][e.dir][a % 8];
      case 'furnace': return on ? sp.furnace.on[e.dir][((t * 8) | 0) % 6] : sp.furnace.off[e.dir];
      case 'crafter': return e.type === 'prensa' ? sp.press[e.dir][a % 8] : sp.assembler[e.dir][a % 12];
      case 'chest': return sp.chest;
      case 'splitter': return sp.splitter[e.dir];
      case 'pole': return sp.pole;
      case 'pump': return sp.pump[e.status === 'idle' ? 0 : ((t * 12) | 0) % 8];
      case 'boiler': return e.status === 'work' ? sp.boiler.on[e.dir][((t * 8) | 0) % 6] : sp.boiler.off[e.dir];
      case 'generator': return sp.generator[e.status === 'work' ? ((t * 20) | 0) % 12 : 0];
      case 'solar': return sp.solar;
      case 'battery': return sp.battery[Math.round(((e.charge || 0) / e.def.capacity) * 5)];
      case 'hub': return sp.hub[((t * 6) | 0) % 12];
    }
    return sp.chest;
  }

  ghost(g) {
    const { ctx, sp } = this;
    const def = BUILDINGS[g.type];
    const s = def.size * TILE;
    ctx.globalAlpha = 0.6;
    const fake = { kind: def.kind, type: g.type, dir: g.dir, status: 'idle' };
    if (def.kind === 'pipe') { ctx.globalAlpha = 0.6; ctx.fillStyle = '#5a5e63'; ctx.beginPath(); ctx.arc((g.x + 0.5) * TILE, (g.y + 0.5) * TILE, 8, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    const img = def.kind === 'pipe' ? null : def.kind === 'belt' ? sp.belt[g.type === 'cinta2' ? 2 : 1][g.dir][0] : this.buildingSprite(fake, 0);
    if (img) ctx.drawImage(img, g.x * TILE, g.y * TILE, s, s);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g.ok ? 'rgba(80,220,150,0.25)' : 'rgba(240,70,60,0.35)';
    ctx.fillRect(g.x * TILE, g.y * TILE, s, s);
    if (!['belt', 'chest', 'pole', 'pipe', 'pump', 'boiler', 'generator', 'solar', 'battery'].includes(def.kind)) {
      const m = (def.size - 1) >> 1, sz = def.size;
      const out = [[g.x + sz, g.y + m], [g.x + sz - 1 - m, g.y + sz], [g.x - 1, g.y + sz - 1 - m], [g.x + m, g.y - 1]][g.dir];
      this.arrow(out[0], out[1], g.dir, 'rgba(255,190,80,0.95)');
    }
  }

  arrow(tx, ty, dir, color) {
    const { ctx } = this;
    ctx.save();
    ctx.translate((tx + 0.5) * TILE, (ty + 0.5) * TILE);
    ctx.rotate((dir * Math.PI) / 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-8, -9); ctx.lineTo(6, 0); ctx.lineTo(-8, 9); ctx.lineTo(-4, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  corners(x, y, s) {
    const { ctx } = this;
    const k = Math.min(10, s / 3);
    ctx.beginPath();
    ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
    ctx.moveTo(x + s - k, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + k);
    ctx.moveTo(x + s, y + s - k); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - k, y + s);
    ctx.moveTo(x + k, y + s); ctx.lineTo(x, y + s); ctx.lineTo(x, y + s - k);
    ctx.stroke();
  }

  // ---------- Minimapa ----------
  drawMinimap(mc, state) {
    const w = this.game.world, g = this.game;
    if (!this.miniBase || this.miniDirty) {
      if (!this.miniBase) { this.miniBase = document.createElement('canvas'); this.miniBase.width = w.w; this.miniBase.height = w.h; }
      const x = this.miniBase.getContext('2d');
      const img = x.createImageData(w.w, w.h);
      const d = img.data;
      const cols = { 0: [70, 64, 58], 1: [98, 66, 52], 2: [48, 66, 68], 3: [18, 44, 60] };
      const rc = { 1: [192, 106, 80], 2: [208, 129, 63], 3: [20, 20, 24] };
      for (let i = 0; i < w.terrain.length; i++) {
        const o = i * 4;
        let c = w.explored[i] ? (w.resource[i] ? rc[w.resource[i]] : cols[w.terrain[i]]) : [12, 14, 17];
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
      this.miniDirty = false;
    }
    const x = mc.getContext('2d');
    if (mc.width !== w.w) { mc.width = w.w; mc.height = w.h; }
    x.imageSmoothingEnabled = false;
    x.drawImage(this.miniBase, 0, 0);
    for (const e of g.ents) {
      if (!e) continue;
      x.fillStyle = e.kind === 'belt' ? '#9aa0a7' : e.kind === 'hub' ? '#4fd1bd' : '#e08a3c';
      x.fillRect(e.x, e.y, e.size, e.size);
    }
    // vista actual
    const z = this.cam.z;
    const vw = this.vw / z / TILE, vh = this.vh / z / TILE;
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 1;
    x.strokeRect(this.cam.x / TILE - vw / 2, this.cam.y / TILE - vh / 2, vw, vh);
    const d = g.drone;
    x.fillStyle = '#fff';
    x.beginPath(); x.arc(d.x, d.y, 2.5, 0, 7); x.fill();
    if (state.guide) { x.strokeStyle = '#4fd1bd'; x.beginPath(); x.arc(state.guide.x, state.guide.y, 4, 0, 7); x.stroke(); }
  }
}
