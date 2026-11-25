// Dibujo con Canvas 2D: terreno en bloques cacheados, cintas y edificios con
// recorte a lo visible y nivel de detalle según el zoom.
import { TILE, BUILDINGS, UPS } from './config.js';
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
    this.frame = 0;
    this.dpr = 1;
    this.resize();
  }

  setGame(game) { this.game = game; this.chunks.clear(); }

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
  chunk(cx, cy) {
    const key = cy * 1000 + cx;
    let c = this.chunks.get(key);
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
        const res = world.resource[i];
        x.drawImage(this.sp.res[res][(h * 8) | 0], tx * TP, ty * TP, TP, TP);
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
    this.chunks.set(key, c);
    return c;
  }

  // ---------- Frame ----------
  draw(state, alpha = 0) {
    const { ctx, cam, game, sp } = this;
    const z = cam.z * this.dpr;
    this.frame++;
    this.budget = this.chunks.size < 4 ? 4 : 1;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0f10';
    ctx.fillRect(0, 0, W, H);
    // transformación mundo -> pantalla
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
    // recursos nítidos de cerca
    if (cam.z >= 0.9) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const r = world.resource[y * world.w + x];
        if (!r || game.grid[y * world.w + x] >= 0) continue;
        ctx.drawImage(sp.res[r][(hash2(x, y, world.seed + 5) * 8) | 0], x * TILE, y * TILE, TILE, TILE);
      }
    }

    // rejilla en modo construcción
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
    // pasada 1: cintas
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
    // pasada 2: objetos sobre cintas
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
          let p = e.ip[i] - 0.5;
          const cx = (x + 0.5 + dx * p) * TILE, cy = (y + 0.5 + dy * p) * TILE;
          if (detail) ctx.drawImage(sp.itemByIndex[e.it[i]], cx - isz / 2, cy - isz / 2, isz, isz);
          else { ctx.fillStyle = sp.itemColor[e.it[i]]; ctx.fillRect(cx - 6, cy - 6, 12, 12); }
        }
      }
    }
    // pasada 3: edificios (sombra + sprite)
    for (const e of big) {
      const s = e.size * TILE;
      const px = e.x * TILE, py = e.y * TILE;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px + 5, py + 7, s - 4, s - 4);
      ctx.drawImage(this.buildingSprite(e, t), px, py, s, s);
      if (e.kind === 'furnace' && e.outCount > 0 && detail) {
        ctx.drawImage(sp.items[e.outType], px + 2, py + 2, 18, 18);
      }
      if (e.kind === 'miner' && detail) {
        ctx.drawImage(sp.items[e.item], px + s - 20, py + 2, 18, 18);
      }
      if (state.tool && e.kind !== 'hub' && e.kind !== 'chest' && e.kind !== 'splitter') {
        const [tx, ty] = game.outputTile(e);
        this.arrow(tx, ty, e.dir, 'rgba(255,170,60,0.8)');
      }
    }
    this.stats = { belts: beltCount, big: big.length };

    // vista previa del edificio
    if (state.preview) for (const g of state.preview) this.ghost(g);
    if (state.hover && state.erase) {
      const e = game.entityAt(state.hover.x, state.hover.y);
      ctx.fillStyle = 'rgba(230,60,50,0.35)';
      if (e && e.kind !== 'hub') ctx.fillRect(e.x * TILE, e.y * TILE, e.size * TILE, e.size * TILE);
      else ctx.fillRect(state.hover.x * TILE, state.hover.y * TILE, TILE, TILE);
    }
    // marco de selección al pasar el ratón
    if (state.hover && !state.tool && !state.erase) {
      const e = game.entityAt(state.hover.x, state.hover.y);
      const hx = e ? e.x : state.hover.x, hy = e ? e.y : state.hover.y, hs = e ? e.size : 1;
      ctx.strokeStyle = 'rgba(255,200,90,0.9)';
      ctx.lineWidth = 2 / cam.z;
      this.corners(hx * TILE, hy * TILE, hs * TILE);
    }
  }

  buildingSprite(e, t) {
    const sp = this.sp;
    switch (e.kind) {
      case 'miner': {
        const tier = e.type === 'taladro2' ? 2 : 1;
        if (e.active) e._anim = (e._anim || 0) + e.rate * 0.35;
        return sp.miner[tier][e.dir][((e._anim || 0) | 0) % 8];
      }
      case 'furnace':
        return e.active ? sp.furnace.on[e.dir][((t * 8) | 0) % 6] : sp.furnace.off[e.dir];
      case 'chest': return sp.chest;
      case 'splitter': return sp.splitter[e.dir];
      case 'hub': return sp.hub[((t * 6) | 0) % 12];
    }
    return sp.chest;
  }

  ghost(g) {
    const { ctx, sp } = this;
    const def = BUILDINGS[g.type];
    const s = def.size * TILE;
    ctx.globalAlpha = 0.6;
    const fake = { kind: def.kind, type: g.type, dir: g.dir, active: false, rate: 0 };
    const img = def.kind === 'belt' ? sp.belt[g.type === 'cinta2' ? 2 : 1][g.dir][0] : this.buildingSprite(fake, 0);
    ctx.drawImage(img, g.x * TILE, g.y * TILE, s, s);
    ctx.globalAlpha = 1;
    ctx.fillStyle = g.ok ? 'rgba(80,220,150,0.25)' : 'rgba(240,70,60,0.35)';
    ctx.fillRect(g.x * TILE, g.y * TILE, s, s);
    if (def.kind !== 'belt' && def.kind !== 'chest') {
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
}
