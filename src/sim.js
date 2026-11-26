// Simulación: edificios, cintas, flujo de objetos, yacimientos y progreso.
import { BUILDINGS, FURNACE_RECIPES, RECIPES, RESOURCES, MILESTONES, START_INVENTORY, UPS, ITEM_IDS, REVEAL_R } from './config.js';
import { World } from './world.js';

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
const GAP = 0.25;          // separación mínima entre objetos en una cinta (4 por casilla)
const MAX_ON_BELT = 4;
const OUT_BUF = 20;
const ITEM_NUM = Object.fromEntries(ITEM_IDS.map((id, i) => [id, i]));

export class Game {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.world = new World(seed);
    const n = this.world.w * this.world.h;
    this.grid = new Int32Array(n).fill(-1);
    this.ents = [];
    this.free = [];
    this.belts = [];
    this.machines = [];
    this.orderDirty = true;
    this.tick = 0;
    this.inv = Object.fromEntries(ITEM_IDS.map((id) => [id, 0]));
    Object.assign(this.inv, START_INVENTORY);
    this.milestone = 0;
    this.unlocked = new Set(MILESTONES[0].unlocks);
    this.stats = { mined: {}, built: {}, delivered: {} };
    this.task = 0;
    this.depleted = new Set(); // casillas cuya cantidad cambió (para guardar)
    this.listeners = new Set();
    const s = this.world.spawn;
    this.drone = { x: s.x + 1.5, y: s.y + 4.5, vx: 0, vy: 0, angle: 0 };
    this.world.reveal(this.drone.x, this.drone.y, REVEAL_R + 4);
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

  check(type, x, y, dir, free = false) {
    const def = BUILDINGS[type];
    if (!def) return { ok: false, reason: 'Desconocido' };
    if (!free && !this.unlocked.has(type)) return { ok: false, reason: 'Bloqueado' };
    const s = def.size;
    let replace = null;
    for (let j = 0; j < s; j++) {
      for (let i = 0; i < s; i++) {
        const tx = x + i, ty = y + j;
        if (!this.world.inside(tx, ty)) return { ok: false, reason: 'Fuera del mapa' };
        if (!free && !this.world.explored[this.world.idx(tx, ty)]) return { ok: false, reason: 'Zona sin explorar: acércate con el dron' };
        if (!this.world.buildable(tx, ty) && !free) return { ok: false, reason: 'No se puede construir en el agua' };
        const e = this.entityAt(tx, ty);
        if (e) {
          const sameSpot = e.x === x && e.y === y && BUILDINGS[e.type].size === s;
          if (sameSpot && def.upgradeOf === e.type) { replace = e; continue; }
          if (sameSpot && e.type === type && def.kind === 'belt' && e.dir !== dir) { replace = e; continue; }
          return { ok: false, reason: 'Ocupado' };
        }
      }
    }
    if (def.kind === 'miner' && !this.minerTiles(x, y, s).length) return { ok: false, reason: 'El taladro va encima de un recurso' };
    if (!free && !(replace && replace.type === type)) {
      const cost = replace ? diffCost(def.cost, BUILDINGS[replace.type].cost) : def.cost;
      if (!this.canAfford(cost)) return { ok: false, reason: 'Faltan materiales: ' + missing(this, cost) };
    }
    return { ok: true, replace };
  }

  // casillas de recurso bajo un taladro, del tipo más abundante
  minerTiles(x, y, s) {
    const w = this.world;
    const counts = [0, 0, 0, 0];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      if (!w.inside(x + i, y + j)) continue;
      const k = w.idx(x + i, y + j);
      if (w.amount[k] > 0) counts[w.resource[k]]++;
    }
    let best = 0;
    for (let r = 1; r < 4; r++) if (counts[r] > (best ? counts[best] : 0)) best = r;
    if (!best) return [];
    const out = [];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const k = w.idx(x + i, y + j);
      if (w.resource[k] === best && w.amount[k] > 0) out.push(k);
    }
    return out;
  }

  place(type, x, y, dir, free = false) {
    const c = this.check(type, x, y, dir, free);
    if (!c.ok) return null;
    const def = BUILDINGS[type];
    if (c.replace) {
      const old = c.replace;
      if (old.type === type) {
        old.dir = dir;
        this.orderDirty = true;
        this.emit('changed');
        return old;
      }
      if (!free) { this.pay(def.cost); this.refund(BUILDINGS[old.type].cost); }
      old.type = type;
      old.def = def;
      this.emit('changed');
      return old;
    }
    if (!free) this.pay(def.cost);
    const id = this.free.length ? this.free.pop() : this.ents.length;
    const e = { id, type, def, kind: def.kind, x, y, dir, size: def.size, status: 'idle' };
    initEntity(e, this);
    this.ents[id] = e;
    for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) this.grid[(y + j) * this.world.w + x + i] = id;
    if (e.kind === 'belt') { this.belts.push(e); this.orderDirty = true; }
    else this.machines.push(e);
    if (!free) this.stats.built[type] = (this.stats.built[type] || 0) + 1;
    this.emit('changed');
    return e;
  }

  // Devuelve al inventario lo que tiene dentro (sin coste del edificio).
  emptyInto(e) {
    const inv = this.inv;
    if (e.kind === 'belt') { for (const t of e.it) inv[ITEM_IDS[t]]++; e.it.length = 0; e.ip.length = 0; }
    if (e.kind === 'chest') { for (const k in e.store) inv[k] += e.store[k]; e.store = {}; e.total = 0; }
    if (e.kind === 'furnace') {
      if (e.inType) inv[e.inType] += e.inCount;
      if (e.outType) inv[e.outType] += e.outCount;
      e.inType = null; e.inCount = 0; e.outCount = 0;
    }
    if (e.kind === 'crafter') {
      for (const k in e.inb) inv[k] += e.inb[k];
      for (const k in e.inb) e.inb[k] = 0;
      if (e.recipe) inv[RECIPES[e.recipe].out] += e.outCount;
      e.outCount = 0; e.progress = 0;
    }
    if ((e.kind === 'miner' || e.kind === 'splitter') && e.buf) { inv[e.buf]++; e.buf = null; }
  }

  remove(e) {
    if (!e || e.kind === 'hub') return false;
    this.refund(e.def.cost);
    this.emptyInto(e);
    for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) this.grid[(e.y + j) * this.world.w + e.x + i] = -1;
    this.ents[e.id] = null;
    this.free.push(e.id);
    if (e.kind === 'belt') { this.belts.splice(this.belts.indexOf(e), 1); this.orderDirty = true; }
    else this.machines.splice(this.machines.indexOf(e), 1);
    this.emit('changed');
    return true;
  }

  setRecipe(e, rid) {
    if (e.kind !== 'crafter' || !RECIPES[rid] || RECIPES[rid].machine !== e.type) return;
    this.emptyInto(e);
    e.recipe = rid;
    e.inb = Object.fromEntries(Object.keys(RECIPES[rid].in).map((k) => [k, 0]));
    this.emit('changed');
  }

  // Extraer una unidad de una casilla (a mano o con taladro). Devuelve el objeto o null.
  extract(k) {
    const w = this.world;
    if (w.amount[k] === 0) return null;
    const item = RESOURCES[w.resource[k]].item;
    w.amount[k]--;
    this.depleted.add(k);
    if (w.amount[k] === 0) {
      w.resource[k] = 0;
      this.emit('depleted', k);
    }
    return item;
  }

  handMine(x, y) {
    const w = this.world;
    if (!w.inside(x, y) || this.entityAt(x, y)) return null;
    const k = w.idx(x, y);
    const item = this.extract(k);
    if (item) {
      this.inv[item]++;
      this.stats.mined[item] = (this.stats.mined[item] || 0) + 1;
    }
    return item;
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

  pushTo(tx, ty, item, travel) {
    const e = this.entityAt(tx, ty);
    if (!e) return false;
    return accept(this, e, item, travel);
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
          if (id >= 0 && accept(this, this.ents[id], ITEM_IDS[b.it[0]], b.dir)) {
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
      else if (e.kind === 'crafter') rec.push([e.recipe, e.inb, e.outCount, e.progress]);
      else if (e.kind === 'miner' || e.kind === 'splitter') rec.push(e.buf);
      ents.push(rec);
    }
    const w = this.world;
    const dep = [];
    for (const k of this.depleted) dep.push(k, w.amount[k]);
    return {
      v: 2, seed: w.seed, tick: this.tick, inv: this.inv, milestone: this.milestone, task: this.task,
      stats: this.stats, drone: { x: this.drone.x, y: this.drone.y }, ents, dep, fog: packBits(w.explored),
    };
  }

  static load(data) {
    if (!data || data.v !== 2) throw new Error('versión de partida antigua');
    const g = new Game(data.seed);
    g.tick = data.tick || 0;
    const w = g.world;
    if (data.fog) unpackBits(data.fog, w.explored);
    for (let i = 0; i < data.dep.length; i += 2) {
      const k = data.dep[i];
      w.amount[k] = data.dep[i + 1];
      if (!w.amount[k]) w.resource[k] = 0;
      g.depleted.add(k);
    }
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
      else if (e.kind === 'crafter') { g.setRecipe(e, extra[0]); Object.assign(e.inb, extra[1]); e.outCount = extra[2]; e.progress = extra[3]; }
      else e.buf = extra;
    }
    g.inv = Object.fromEntries(ITEM_IDS.map((id) => [id, data.inv[id] || 0]));
    g.stats = data.stats || g.stats;
    g.task = data.task || 0;
    if (data.drone) Object.assign(g.drone, data.drone);
    return g;
  }
}

function packBits(arr) {
  let s = '';
  for (let i = 0; i < arr.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) if (arr[i + j]) b |= 1 << j;
    s += String.fromCharCode(b);
  }
  return btoa(s);
}

function unpackBits(str, arr) {
  const s = atob(str);
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i);
    for (let j = 0; j < 8; j++) if (i * 8 + j < arr.length) arr[i * 8 + j] = (b >> j) & 1;
  }
}

function diffCost(a, b) {
  const out = { ...a };
  for (const k in b) out[k] = Math.max(0, (out[k] || 0) - b[k]);
  return out;
}

function missing(g, cost) {
  return Object.entries(cost).filter(([k, v]) => (g.inv[k] || 0) < v)
    .map(([k, v]) => `${v - (g.inv[k] || 0)} ${itemName(k)}`).join(', ');
}
let itemName = (k) => k;
export function setItemNamer(fn) { itemName = fn; }

function initEntity(e, g) {
  switch (e.kind) {
    case 'belt': e.it = []; e.ip = []; break;
    case 'miner': {
      const tiles = g.minerTiles(e.x, e.y, e.size);
      e.res = g.world.resource[tiles[0]];
      e.tiles = tiles;
      e.item = RESOURCES[e.res].item;
      e.progress = 0; e.buf = null; e.rr = 0;
      break;
    }
    case 'furnace': e.inType = null; e.inCount = 0; e.outType = null; e.outCount = 0; e.progress = 0; break;
    case 'crafter':
      e.recipe = null; e.inb = {}; e.outCount = 0; e.progress = 0;
      g.setRecipe(e, e.def.defaultRecipe);
      break;
    case 'chest': e.store = {}; e.total = 0; break;
    case 'splitter': e.buf = null; e.rr = 0; break;
    case 'hub': break;
  }
}

function insertOnBelt(b, item, p) {
  const n = b.it.length;
  if (n >= MAX_ON_BELT) return false;
  const t = ITEM_NUM[item];
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
      if ((travel + 2) % 4 === e.dir) return false;
      return insertOnBelt(e, item, travel === e.dir ? 0 : 0.5);
    }
    case 'furnace': {
      const r = FURNACE_RECIPES[item];
      if (!r) return false;
      if (e.inType && e.inType !== item && e.inCount > 0) return false;
      if (e.inCount >= OUT_BUF) return false;
      if (e.outType && e.outType !== r.out && e.outCount > 0) return false;
      e.inType = item; e.inCount++;
      return true;
    }
    case 'crafter': {
      if (!e.recipe) return false;
      const need = RECIPES[e.recipe].in[item];
      if (!need || e.inb[item] >= need * 4) return false;
      e.inb[item]++;
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
      g.stats.delivered[item] = (g.stats.delivered[item] || 0) + 1;
      g.emit('delivered', item);
      return true;
    }
    default: return false;
  }
}

function updateMachine(g, e) {
  switch (e.kind) {
    case 'miner': {
      if (!e.buf) {
        let tiles = e.tiles;
        if (tiles.length && g.world.amount[tiles[e.rr % tiles.length]] === 0) tiles = e.tiles = tiles.filter((k) => g.world.amount[k] > 0);
        if (!tiles.length) { e.status = 'empty'; break; }
        e.status = 'work';
        e.progress += e.def.rate / UPS;
        if (e.progress >= 1) {
          e.progress -= 1;
          e.rr = (e.rr + 1) % tiles.length;
          e.buf = g.extract(tiles[e.rr]);
        }
      }
      if (e.buf) {
        const [tx, ty] = g.outputTile(e);
        if (g.pushTo(tx, ty, e.buf, e.dir)) e.buf = null;
        else e.status = 'full';
      }
      break;
    }
    case 'furnace': {
      const r = e.inType && FURNACE_RECIPES[e.inType];
      e.status = 'idle';
      if (r && e.inCount >= r.inCount) {
        if (e.outCount >= OUT_BUF || (e.outType && e.outType !== r.out && e.outCount > 0)) e.status = 'full';
        else {
          e.status = 'work';
          e.progress += 1 / (r.time * UPS);
          if (e.progress >= 1) {
            e.progress = 0;
            e.inCount -= r.inCount;
            e.outType = r.out; e.outCount++;
            if (e.inCount === 0) e.inType = null;
          }
        }
      }
      if (e.outCount > 0) {
        const [tx, ty] = g.outputTile(e);
        if (g.pushTo(tx, ty, e.outType, e.dir)) e.outCount--;
        else if (e.status !== 'work') e.status = 'full';
      }
      break;
    }
    case 'crafter': {
      const r = RECIPES[e.recipe];
      e.status = 'idle';
      if (!r) break;
      let ready = true;
      for (const k in r.in) if (e.inb[k] < r.in[k]) { ready = false; break; }
      if (ready || e.progress > 0) {
        if (e.outCount >= OUT_BUF) e.status = 'full';
        else {
          if (e.progress === 0) for (const k in r.in) e.inb[k] -= r.in[k];
          e.status = 'work';
          e.progress += 1 / (r.time * UPS);
          if (e.progress >= 1) { e.progress = 0; e.outCount += r.n; }
        }
      }
      if (e.outCount > 0) {
        const [tx, ty] = g.outputTile(e);
        if (g.pushTo(tx, ty, r.out, e.dir)) e.outCount--;
        else if (e.status !== 'work') e.status = 'full';
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
