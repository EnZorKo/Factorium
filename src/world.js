// Generación del mapa: terreno, agua, vetas de recursos finitas y niebla.
import { MAP_W, MAP_H } from './config.js';
import { fbm, mulberry32 } from './noise.js';

export const T_SOIL = 0, T_RUST = 1, T_MARSH = 2, T_WATER = 3;

export class World {
  constructor(seed) {
    this.seed = seed;
    this.w = MAP_W;
    this.h = MAP_H;
    const n = MAP_W * MAP_H;
    this.terrain = new Uint8Array(n);
    this.resource = new Uint8Array(n); // 0 = nada, 1..3 = RESOURCES
    this.amount = new Uint32Array(n);  // unidades que quedan en la casilla
    this.explored = new Uint8Array(n); // 1 = descubierta
    this.spawn = { x: (MAP_W >> 1) - 1, y: (MAP_H >> 1) - 1 };
    this.generate();
  }

  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  buildable(x, y) {
    if (!this.inside(x, y)) return false;
    const i = this.idx(x, y);
    return this.terrain[i] !== T_WATER && this.explored[i] === 1;
  }

  generate() {
    const { w, h, seed } = this;
    const cx = this.spawn.x + 1, cy = this.spawn.y + 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const biome = fbm(x / 48, y / 48, seed + 7, 3);
        const wet = fbm(x / 22, y / 22, seed + 31, 4);
        const d = Math.hypot(x - cx, y - cy);
        let t = T_SOIL;
        if (biome > 0.6) t = T_RUST;
        else if (biome < 0.38) t = T_MARSH;
        if (wet > 0.66 && d > 18) t = T_WATER;
        this.terrain[this.idx(x, y)] = t;
      }
    }
    const rnd = mulberry32(seed ^ 0x9e3779b9);
    // Vetas de inicio: cerca de la Baliza pero pequeñas, para que haya que explorar pronto.
    this.patch(cx - 13, cy - 6, 1, 4.5, rnd, 0.7);
    this.patch(cx + 13, cy - 8, 2, 4, rnd, 0.7);
    this.patch(cx + 2, cy + 14, 3, 3.5, rnd, 0.7);
    // Vetas por el mapa: más grandes y más ricas cuanto más lejos.
    const prefer = { 1: T_RUST, 2: T_MARSH, 3: T_SOIL };
    let placed = 0, tries = 0;
    while (placed < 50 && tries < 5000) {
      tries++;
      const x = 6 + Math.floor(rnd() * (w - 12));
      const y = 6 + Math.floor(rnd() * (h - 12));
      const d = Math.hypot(x - cx, y - cy);
      if (d < 26) continue;
      const type = 1 + Math.floor(rnd() * 3);
      const t = this.terrain[this.idx(x, y)];
      if (t === T_WATER) continue;
      if (t !== prefer[type] && rnd() < 0.6) continue;
      this.patch(x, y, type, 3.5 + rnd() * 3 + d / 35, rnd, 1 + d / 30);
      placed++;
    }
  }

  // richness multiplica la cantidad; el centro de la veta es más rico que el borde.
  patch(px, py, type, radius, rnd, richness) {
    const r = Math.ceil(radius + 2);
    const s = Math.floor(rnd() * 1e6);
    for (let y = py - r; y <= py + r; y++) {
      for (let x = px - r; x <= px + r; x++) {
        if (!this.inside(x, y)) continue;
        const i = this.idx(x, y);
        if (this.terrain[i] === T_WATER) continue;
        const d = Math.hypot(x - px, y - py);
        const wobble = fbm(x / 3, y / 3, s, 2) * 2.6 - 1.3;
        if (d + wobble < radius) {
          this.resource[i] = type;
          const core = 1 - Math.min(1, d / radius);
          this.amount[i] = Math.round((250 + 900 * core) * richness);
        }
      }
    }
  }

  // Descubre un círculo. Devuelve true si algo cambió.
  reveal(cx, cy, r) {
    let changed = false;
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * this.w + x;
        if (!this.explored[i]) { this.explored[i] = 1; changed = true; }
      }
    }
    return changed;
  }
}
