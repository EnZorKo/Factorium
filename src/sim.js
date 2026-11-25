// Simulación: edificios, cintas y flujo de objetos.
import { BUILDINGS, FURNACE_RECIPES, RESOURCES, MILESTONES, START_INVENTORY, UPS, ITEM_IDS } from './config.js';
import { World } from './world.js';

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
const GAP = 0.25;          // separación mínima entre objetos en una cinta (4 por casilla)
const MAX_ON_BELT = 4;
const FURNACE_BUF = 20;

export class Game {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.world = new World(seed);
    const n = this.world.w * this.world.h;
    this.grid = new Int32Array(n).fill(-1);
    this.ents = [];           // índice = id; huecos = null
    this.free = [];
    this.belts = [];          // cintas en orden de proceso (de delante hacia atrás)
    this.machines = [];       // resto de edificios activos
    this.orderDirty = true;
    this.tick = 0;
    this.inv = Object.fromEntries(ITEM_IDS.map((id) => [id, 0]));
    Object.assign(this.inv, START_INVENTORY);
    this.milestone = 0;       // índice del último hito completado
    this.unlocked = new Set(MILESTONES[0].unlocks);
    this.listeners = new Set();
    const s = this.world.spawn;
    this.hub = this.place('baliza', s.x, s.y, 0, true);
  }

  on(fn) { this.listeners.add(fn); }
  emit(type, data) { for (const fn of this.listeners) fn(type, data); }

  entityAt(x, y) {
    if (!this.world.inside(x, y)) return null;
    const id = this.grid[y * this.world.w + x];
    return id < 0 ? null : this.ents[id];
  }

  // ---------- Construcción ----------

  canAfford(cost) {
    for (const k in cost) if ((this.inv[k] || 0) < cost[k]) return false;
    return true;
  }

  pay(cost) { for (const k in cost) this.inv[k] -= cost[k]; }
  refund(cost) { for (const k in cost) this.inv[k] = (this.inv[k] || 0) + cost[k]; }

  // Devuelve { ok, reason, replace } sin colocar nada.
  check(type, x, y, dir, free = false) {
    const def = BUILDINGS[type];
    if (!def) return { ok: false, reason: 'Desconocido' };
    if (!free && !this.unlocked.has(type)) return { ok: false, reason: 'Bloqueado' };
    const s = def.size;
    let replace = null;
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        const tx = x + i, ty = y + j;
        if (!this.world.buildable(tx, ty)) return { ok: false, reason: 'Terreno no válido' };
        const e = this.entityAt(tx, ty);
        if (e) {
          const sameSpot = e.x === x && e.y === y && BUILDINGS[e.type].size === s;
          if (sameSpot && def.upgradeOf === e.type) { replace = e; continue; }
          if (sameSpot && e.type === type && def.kind === 'belt' && e.dir !== dir) { replace = e; continue; }
          return { ok: false, reason: 'Ocupado' };
        }
      }
    }
    if (def.kind === 'miner' && !this.minerResource(x, y, s)) return { ok: false, reason: 'Ponlo sobre un recurso' };
    if (!free && !(replace && replace.type === type)) {
      const cost = replace ? diffCost(def.cost, BUILDINGS[replace.type].cost) : def.cost;
      if (!this.canAfford(cost)) return { ok: false, reason: 'Faltan materiales' };
    }
    return { ok: true, replace };
  }

  minerResource(x, y, s) {
    const counts = [0, 0, 0, 0];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      if (!this.world.inside(x + i, y + j)) continue;
      counts[this.world.resource[this.world.idx(x + i, y + j)]]++;
    }
    let best = 0;
    for (let r = 1; r < 4; r++) if (counts[r] > counts[best] || best === 0) if (counts[r] > 0) best = r;
    if (!best) return null;
    return { res: best, coverage: counts[best] / (s * s) };
  }

  place(type, x, y, dir, free = false) {
    const c = this.check(type, x, y, dir, free);
    if (!c.ok) return null;
    const def = BUILDINGS[type];
    if (c.replace) {
      const old = c.replace;
      if (old.type === type) { // solo girar una cinta
        old.dir = dir;
        this.orderDirty = true;
        this.emit('changed');
        return old;
      }
      // mejora: se conserva el contenido y la orientación
      if (!free) { this.pay(def.cost); this.refund(BUILDINGS[old.type].cost); }
      old.type = type;
      old.def = def;
      if (def.kind === 'miner') old.rate = def.rate * old.coverage;
      this.emit('changed');
      return old;
    }
    if (!free) this.pay(def.cost);
    const id = this.free.length ? this.free.pop() : this.ents.length;
    const e = { id, type, def, kind: def.kind, x, y, dir, size: def.size };
    initEntity(e, this);
    this.ents[id] = e;
    for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) this.grid[(y + j) * this.world.w + x + i] = id;
    if (e.kind === 'belt') { this.belts.push(e); this.orderDirty = true; }
    else this.machines.push(e);
    this.emit('changed');
    return e;
  }

  remove(e) {
    if (!e || e.kind === 'hub') return false;
    this.refund(e.def.cost);
    // Devolver contenido al inventario
    if (e.kind === 'belt') for (const t of e.it) this.inv[ITEM_IDS[t]]++;
    if (e.kind === 'chest') for (const k in e.store) this.inv[k] += e.store[k];
    if (e.kind === 'furnace') {
      if (e.inType) this.inv[e.inType] += e.inCount;
      if (e.outType) this.inv[e.outType] += e.outCount;
    }
    if ((e.kind === 'miner' || e.kind === 'splitter') && e.buf) this.inv[e.buf]++;
    for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) this.grid[(e.y + j) * this.world.w + e.x + i] = -1;
    this.ents[e.id] = null;
    this.free.push(e.id);
    if (e.kind === 'belt') { this.belts.splice(this.belts.indexOf(e), 1); this.orderDirty = true; }
    else this.machines.splice(this.machines.indexOf(e), 1);
    this.emit('changed');
    return true;
  }

  // ---------- Hitos ----------

  nextMilestone() { return MILESTONES[this.milestone + 1]; }

  completeMilestone() {
    const m = this.nextMilestone();
    if (!m || !m.cost || !this.canAfford(m.cost)) return false;
    this.pay(m.cost);
    this.milestone++;
    for (const u of m.unlocks) this.unlocked.add(u);
    this.emit('milestone', m);
    return true;
  }

  // ---------- Transferencia de objetos ----------

  // Intenta meter el objeto (id de texto) en la casilla tx,ty viajando en dirección travel.
  pushTo(tx, ty, item, travel) {
    const e = this.entityAt(tx, ty);
    if (!e) return false;
    return accept(this, e, item, travel, tx, ty);
  }

  outputTile(e) {
    const s = e.size, m = (s - 1) >> 1;
    switch (e.dir) {
      case 0: return [e.x + s, e.y + m];
      case 1: return [e.x + s - 1 - m, e.y + s];
      case 2: return [e.x - 1, e.y + s - 1 - m];
      default: return [e.x + m, e.y - 1];
    }
  }

  // Ordena las cintas para procesar primero las de delante: así las líneas se compactan sin huecos.
  rebuildOrder() {
    const w = this.world.w;
    const depth = new Map();
    const next = (b) => {
      const nx = b.x + DX[b.dir], ny = b.y + DY[b.dir];
      if (!this.world.inside(nx, ny)) return null;
      const id = this.grid[ny * w + nx];
      const n = id < 0 ? null : this.ents[id];
      return n && n.kind === 'belt' ? n : null;
    };
    for (const b of this.belts) {
      if (depth.has(b)) continue;
      const chain = [];
      const seen = new Set();
      let cur = b, base = 0;
      while (cur && !depth.has(cur) && !seen.has(cur)) { seen.add(cur); chain.push(cur); cur = next(cur); }
      if (cur && depth.has(cur)) base = depth.get(cur) + 1;
      for (let i = chain.length - 1; i >= 0; i--) depth.set(chain[i], base + (chain.length - 1 - i));
    }
    this.belts.sort((a, b) => depth.get(a) - depth.get(b));
    this.orderDirty = false;
  }

  // ---------- Paso de simulación ----------

  step() {
    if (this.orderDirty) this.rebuildOrder();
    const w = this.world.w;
    const belts = this.belts;
    for (let k = 0; k < belts.length; k++) {
      const b = belts[k];
      const n = b.it.length;
      if (n === 0) continue;
      const ip = b.ip;
      const step = b.def.speed / UPS;
      let limit = 1;
      for (let i = 0; i < n; i++) {
        const p = ip[i] + step;
        ip[i] = p < limit ? p : (limit > ip[i] ? limit : ip[i]);
        limit = ip[i] - GAP;
      }
      if (ip[0] >= 1) {
        const nx = b.x + DX[b.dir], ny = b.y + DY[b.dir];
        if (nx >= 0 && ny >= 0 && nx < w && ny < this.world.h) {
          const id = this.grid[ny * w + nx];
          if (id >= 0 && accept(this, this.ents[id], ITEM_IDS[b.it[0]], b.dir, nx, ny)) {
            b.it.shift();
            ip.shift();
          }
        }
      }
    }
    const ms = this.machines;
    for (let k = 0; k < ms.length; k++) updateMachine(this, ms[k]);
    this.tick++;
  }

  // ---------- Guardado ----------

  serialize() {
    const ents = [];
    for (const e of this.ents) {
      if (!e || e.kind === 'hub') continue;
      const rec = [e.type, e.x, e.y, e.dir];
      if (e.kind === 'belt') rec.push(e.it.map((t, i) => [t, +e.ip[i].toFixed(3)]));
      else if (e.kind === 'chest') rec.push(e.store);
      else if (e.kind === 'furnace') rec.push([e.inType, e.inCount, e.outType, e.outCount, e.progress]);
      else if (e.kind === 'miner' || e.kind === 'splitter') rec.push(e.buf);
      ents.push(rec);
    }
    return { v: 1, seed: this.world.seed, tick: this.tick, inv: this.inv, milestone: this.milestone, ents };
  }

  static load(data) {
    const g = new Game(data.seed);
    g.tick = data.tick || 0;
    for (let i = 1; i <= data.milestone; i++) {
      g.milestone = i;
      for (const u of MILESTONES[i].unlocks) g.unlocked.add(u);
    }
    for (const [type, x, y, dir, extra] of data.ents) {
      const e = g.place(type, x, y, dir, true);
      if (!e || extra == null) continue;
      if (e.kind === 'belt') for (const [t, p] of extra) { e.it.push(t); e.ip.push(p); }
      else if (e.kind === 'chest') { e.store = extra; e.total = Object.values(extra).reduce((a, b) => a + b, 0); }
      else if (e.kind === 'furnace') [e.inType, e.inCount, e.outType, e.outCount, e.progress] = extra;
      else e.buf = extra;
    }
    g.inv = Object.fromEntries(ITEM_IDS.map((id) => [id, data.inv[id] || 0]));
    return g;
  }
}

function diffCost(a, b) {
  const out = { ...a };
  for (const k in b) out[k] = Math.max(0, (out[k] || 0) - b[k]);
  return out;
}

function initEntity(e, g) {
  switch (e.kind) {
    case 'belt': e.it = []; e.ip = []; break;
    case 'miner': {
      const r = g.minerResource(e.x, e.y, e.size);
      e.item = RESOURCES[r.res].item;
      e.coverage = r.coverage;
      e.rate = e.def.rate * r.coverage;
      e.progress = 0; e.buf = null; e.active = false;
      break;
    }
    case 'furnace': e.inType = null; e.inCount = 0; e.outType = null; e.outCount = 0; e.progress = 0; e.active = false; break;
    case 'chest': e.store = {}; e.total = 0; break;
    case 'splitter': e.buf = null; e.rr = 0; break;
    case 'hub': break;
  }
}

function insertOnBelt(b, item, p) {
  const n = b.it.length;
  if (n >= MAX_ON_BELT) return false;
  const t = ITEM_IDS.indexOf(item);
  // posición ordenada de mayor a menor
  let i = 0;
  while (i < n && b.ip[i] > p) i++;
  if (i > 0 && b.ip[i - 1] - p < GAP) return false;
  if (i < n && p - b.ip[i] < GAP) return false;
  b.it.splice(i, 0, t);
  b.ip.splice(i, 0, p);
  return true;
}

function accept(g, e, item, travel) {
  switch (e.kind) {
    case 'belt': {
      if ((travel + 2) % 4 === e.dir) return false; // de frente
      return insertOnBelt(e, item, travel === e.dir ? 0 : 0.5);
    }
    case 'furnace': {
      const r = FURNACE_RECIPES[item];
      if (!r) return false;
      if (e.inType && e.inType !== item && e.inCount > 0) return false;
      if (e.inCount >= FURNACE_BUF) return false;
      if (e.outType && e.outType !== r.out && e.outCount > 0) return false;
      e.inType = item; e.inCount++;
      return true;
    }
    case 'chest': {
      if (e.total >= e.def.capacity) return false;
      e.store[item] = (e.store[item] || 0) + 1; e.total++;
      return true;
    }
    case 'splitter': {
      if (travel !== e.dir || e.buf) return false;
      e.buf = item;
      return true;
    }
    case 'hub': {
      g.inv[item]++;
      g.delivered = (g.delivered || 0) + 1;
      return true;
    }
    default: return false;
  }
}

function updateMachine(g, e) {
  switch (e.kind) {
    case 'miner': {
      if (!e.buf) {
        e.progress += e.rate / UPS;
        if (e.progress >= 1) { e.progress -= 1; e.buf = e.item; }
        e.active = true;
      } else e.active = false;
      if (e.buf) {
        const [tx, ty] = g.outputTile(e);
        if (g.pushTo(tx, ty, e.buf, e.dir)) e.buf = null;
      }
      break;
    }
    case 'furnace': {
      const r = e.inType && FURNACE_RECIPES[e.inType];
      e.active = false;
      if (r && e.inCount >= r.inCount && (e.outCount < FURNACE_BUF) && (!e.outType || e.outType === r.out || e.outCount === 0)) {
        e.active = true;
        e.progress += 1 / (r.time * UPS);
        if (e.progress >= 1) {
          e.progress = 0;
          e.inCount -= r.inCount;
          e.outType = r.out; e.outCount++;
          if (e.inCount === 0) e.inType = null;
        }
      }
      if (e.outCount > 0) {
        const [tx, ty] = g.outputTile(e);
        if (g.pushTo(tx, ty, e.outType, e.dir)) { e.outCount--; }
      }
      break;
    }
    case 'splitter': {
      if (!e.buf) break;
      const dirs = [e.dir, (e.dir + 3) % 4, (e.dir + 1) % 4];
      for (let k = 0; k < 3; k++) {
        const d = dirs[(e.rr + k) % 3];
        if (g.pushTo(e.x + DX[d], e.y + DY[d], e.buf, d)) { e.buf = null; e.rr = (e.rr + k + 1) % 3; break; }
      }
      break;
    }
  }
}
