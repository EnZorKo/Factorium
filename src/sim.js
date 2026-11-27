// Simulación: edificios, cintas, flujo de objetos, yacimientos y progreso.
import { BUILDINGS, FURNACE_RECIPES, RECIPES, RESOURCES, MILESTONES, START_INVENTORY, UPS, ITEM_IDS, REVEAL_R, FUEL, PUMP_BOILERS, BOILER_GENS, DAY_LEN } from './config.js';
import { World, T_WATER } from './world.js';

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
    this.nets = [];
    this.wires = [];
    this.powerDirty = true;
    const s = this.world.spawn;
    this.drone = { x: s.x + 1.5, y: s.y + 4.5, vx: 0, vy: 0, angle: 0 };
    this.world.reveal(this.drone.x, this.drone.y, REVEAL_R + 4);
    this.hub = this.place('baliza', s.x, s.y, 0, true);
  }

  on(fn) { this.listeners.add(fn); }
  emit(type, data) {
    if (type === 'changed') this.powerDirty = true;
    for (const fn of this.listeners) fn(type, data);
  }

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
    if (def.kind === 'miner' && !this.minerTiles(x, y, s, def.res).length) return { ok: false, reason: def.res ? 'El pozo va encima de petróleo' : 'El taladro va encima de un recurso sólido' };
    if (def.kind === 'pump') {
      const w = this.world;
      let wet = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (w.inside(nx, ny) && w.terrain[w.idx(nx, ny)] === T_WATER) wet = true;
      }
      if (!wet) return { ok: false, reason: 'La bomba tiene que tocar el agua' };
    }
    if (!free && !(replace && replace.type === type)) {
      const cost = replace ? diffCost(def.cost, BUILDINGS[replace.type].cost) : def.cost;
      if (!this.canAfford(cost)) return { ok: false, reason: 'Faltan materiales: ' + missing(this, cost) };
    }
    return { ok: true, replace };
  }

  // casillas de recurso bajo un taladro, del tipo más abundante
  minerTiles(x, y, s, allowed = [1, 2, 3, 5]) {
    const w = this.world;
    const counts = [0, 0, 0, 0, 0, 0];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      if (!w.inside(x + i, y + j)) continue;
      const k = w.idx(x + i, y + j);
      if (w.amount[k] > 0) counts[w.resource[k]]++;
    }
    let best = 0;
    for (const r of allowed) if (counts[r] > (best ? counts[best] : 0)) best = r;
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
    if ((e.kind === 'boiler' || e.kind === 'fuelgen' || e.kind === 'reactor') && e.fuelType) { inv[e.fuelType] += e.fuel; e.fuel = 0; }
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
    if (w.resource[k] === 4) return null; // el petróleo necesita un pozo
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

  // ---------- Energía ----------

  // Recalcula redes eléctricas (postes + Baliza) y de agua (bombas, tuberías, calderas).
  rebuildPower() {
    const w = this.world;
    const poles = this.machines.filter((e) => e.kind === 'pole' || e.kind === 'hub');
    const parent = poles.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const cx = (e) => e.x + e.size / 2, cy = (e) => e.y + e.size / 2;
    this.wires = [];
    // rejilla de cubos para buscar postes cercanos
    const B = 10, buckets = new Map();
    poles.forEach((p, i) => {
      const k = ((cx(p) / B) | 0) * 1000 + ((cy(p) / B) | 0);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    });
    poles.forEach((p, i) => {
      const bx = (cx(p) / B) | 0, by = (cy(p) / B) | 0;
      const near = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const j of buckets.get((bx + dx) * 1000 + by + dy) || []) {
          if (j <= i) continue;
          const q = poles[j];
          const d = Math.hypot(cx(p) - cx(q), cy(p) - cy(q));
          if (d <= Math.min(p.def.wire, q.def.wire)) near.push([d, j]);
        }
      }
      near.sort((a, b) => a[0] - b[0]);
      near.forEach(([, j], n) => {
        parent[find(i)] = find(j);
        if (n < 3) this.wires.push([p, poles[j]]);
      });
    });
    const nets = new Map();
    const cover = new Int32Array(w.w * w.h).fill(-1);
    poles.forEach((p, i) => {
      const root = find(i);
      if (!nets.has(root)) nets.set(root, { id: nets.size, cap: 0, demand: 0, ratio: 0, load: 0, gens: [], solars: [], batts: [], hub: false, users: 0 });
      const net = nets.get(root);
      p.net = net;
      if (p.kind === 'hub') net.hub = true;
      const r = p.def.supply;
      for (let y = p.y - r; y < p.y + p.size + r; y++) for (let x = p.x - r; x < p.x + p.size + r; x++) {
        if (w.inside(x, y)) cover[y * w.w + x] = root;
      }
    });
    const list = [...nets.values()];
    for (const e of this.machines) {
      if (e.kind === 'pole' || e.kind === 'hub') continue;
      e.net = null;
      if (!e.def.power && !e.def.output && e.kind !== 'battery') continue;
      outer: for (let j = 0; j < e.size; j++) for (let i = 0; i < e.size; i++) {
        const root = cover[(e.y + j) * w.w + e.x + i];
        if (root >= 0) { e.net = nets.get(root); break outer; }
      }
      if (e.net) {
        if (e.kind === 'generator' || e.kind === 'fuelgen' || e.kind === 'reactor') e.net.gens.push(e);
        else if (e.kind === 'solar') e.net.solars.push(e);
        else if (e.kind === 'battery') e.net.batts.push(e);
      }
      if (e.def.power && e.net) e.net.users++;
    }
    this.nets = list;
    this.rebuildWater();
    this.powerDirty = false;
  }

  rebuildWater() {
    const fluid = new Set(['pipe', 'pump', 'boiler']);
    const seen = new Set();
    for (const e of this.machines) {
      if (e.kind === 'boiler') { e.water = 0; e.gens = []; }
    }
    for (const start of this.machines) {
      if (!fluid.has(start.kind) || seen.has(start)) continue;
      const comp = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const e = stack.pop();
        comp.push(e);
        for (const [nx, ny] of this.neighbors(e)) {
          const n = this.entityAt(nx, ny);
          if (n && fluid.has(n.kind) && !seen.has(n)) { seen.add(n); stack.push(n); }
        }
      }
      const pumps = comp.filter((e) => e.kind === 'pump').length;
      const boilers = comp.filter((e) => e.kind === 'boiler');
      const ratio = boilers.length ? Math.min(1, (pumps * PUMP_BOILERS) / boilers.length) : 0;
      for (const b of boilers) b.water = ratio;
    }
    // generadores: cada uno toma vapor de una caldera que lo toque
    for (const e of this.machines) {
      if (e.kind !== 'generator') continue;
      e.boiler = null;
      for (const [nx, ny] of this.neighbors(e)) {
        const n = this.entityAt(nx, ny);
        if (n && n.kind === 'boiler' && n.gens.length < BOILER_GENS) { n.gens.push(e); e.boiler = n; break; }
      }
    }
  }

  // casillas que rodean a una entidad (sin esquinas)
  neighbors(e) {
    const out = [];
    for (let i = 0; i < e.size; i++) {
      out.push([e.x + i, e.y - 1], [e.x + i, e.y + e.size], [e.x - 1, e.y + i], [e.x + e.size, e.y + i]);
    }
    return out;
  }

  // Luz del día (0 noche, 1 mediodía). Un día dura DAY_LEN segundos.
  daylight() {
    const t = ((this.tick / UPS) / DAY_LEN + 0.3) % 1; // empieza por la mañana
    const v = Math.sin(t * Math.PI * 2) * 1.6 + 0.9;
    return Math.max(0, Math.min(1, v));
  }

  computePower() {
    const light = this.daylight();
    this.light = light;
    for (const net of this.nets) {
      const D = net.demand;
      // gratis: Baliza y solar
      let free = net.hub ? BUILDINGS.baliza.output : 0;
      let solar = 0;
      for (const p of net.solars) solar += p.def.output * light;
      free += solar;
      // generadores con combustible
      let G = 0;
      for (const gen of net.gens) { gen.avail = genAvail(gen); G += gen.avail; }
      // baterías
      let room = 0, stored = 0;
      for (const bt of net.batts) {
        bt.room = Math.min(bt.def.rate, (bt.def.capacity - bt.charge) * UPS);
        bt.out = Math.min(bt.def.rate, bt.charge * UPS);
        room += bt.room; stored += bt.out;
      }
      let genUsed = 0, charge = 0, discharge = 0, ratio = 1;
      if (free + G >= D) {
        charge = Math.min(room, free + G - D);
        genUsed = Math.min(G, Math.max(0, D + charge - free));
      } else {
        genUsed = G;
        discharge = Math.min(stored, D - free - G);
        ratio = D > 0 ? (free + G + discharge) / D : 1;
      }
      // repartir carga/descarga entre baterías
      for (const bt of net.batts) {
        if (charge > 0 && room > 0) bt.charge += (bt.room / room) * charge / UPS;
        if (discharge > 0 && stored > 0) bt.charge -= (bt.out / stored) * discharge / UPS;
        bt.charge = Math.max(0, Math.min(bt.def.capacity, bt.charge));
        bt.status = charge > 0 ? 'work' : discharge > 0 ? 'discharge' : 'idle';
      }
      for (const p of net.solars) p.status = light > 0.02 ? 'work' : 'idle';
      net.cap = free + G;
      net.solar = solar;
      net.batt = net.batts.reduce((a, b) => a + b.charge, 0);
      net.battMax = net.batts.reduce((a, b) => a + b.def.capacity, 0);
      net.discharge = discharge;
      net.ratio = Math.min(1, ratio);
      net.lastDemand = D;
      net.demand = 0;
      const load = G > 0 ? genUsed / G : 0;
      for (const gen of net.gens) {
        const kw = gen.avail * load;
        gen.status = kw > 0 ? 'work' : 'idle';
        if (kw > 0) genDraw(gen, kw);
      }
    }
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
    if (this.powerDirty) this.rebuildPower();
    this.computePower();
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
      else if (e.kind === 'boiler' || e.kind === 'fuelgen' || e.kind === 'reactor') rec.push([e.fuelType, e.fuel, e.energy]);
      else if (e.kind === 'battery') rec.push(e.charge);
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
      else if (e.kind === 'boiler' || e.kind === 'fuelgen' || e.kind === 'reactor') [e.fuelType, e.fuel, e.energy] = extra;
      else if (e.kind === 'battery') e.charge = extra;
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
      const tiles = g.minerTiles(e.x, e.y, e.size, e.def.res);
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
    case 'boiler': e.fuelType = null; e.fuel = 0; e.energy = 0; e.water = 0; e.gens = []; e.burning = 0; break;
    case 'generator': e.boiler = null; e.avail = 0; break;
    case 'solar': e.status = 'idle'; break;
    case 'battery': e.charge = 0; e.status = 'idle'; break;
    case 'fuelgen': case 'reactor': e.fuelType = null; e.fuel = 0; e.energy = 0; e.burning = 0; e.water = 0; e.status = 'idle'; break;
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
    case 'fuelgen':
    case 'boiler': {
      if (!FUEL[item] || (e.def.fuels && !e.def.fuels.includes(item))) return false;
      if (e.fuelType && e.fuelType !== item && e.fuel > 0) return false;
      if (e.fuel >= 20) return false;
      e.fuelType = item; e.fuel++;
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

// Potencia disponible de un generador ahora mismo (kW).
function genAvail(gen) {
  if (gen.kind === 'generator') {
    const b = gen.boiler;
    return b && b.water > 0 && (b.energy > 0 || b.fuel > 0) ? gen.def.output * b.water : 0;
  }
  if (gen.kind === 'reactor' && !(gen.water > 0)) return 0;
  return gen.energy > 0 || gen.fuel > 0 ? gen.def.output * (gen.kind === 'reactor' ? gen.water : 1) : 0;
}

// Gasta combustible por entregar kw durante un tick.
function genDraw(gen, kw) {
  const b = gen.kind === 'generator' ? gen.boiler : gen;
  if (!b) return;
  b.energy -= kw / UPS;
  b.burning = 30;
  while (b.energy <= 0 && b.fuel > 0) { b.fuel--; b.energy += FUEL[b.fuelType]; }
  if (b.energy < 0) b.energy = 0;
}

// Factor de energía de la máquina: 1 = a tope, 0 = sin energía. Anota la demanda.
function powerFactor(e) {
  if (!e.def.power) return 1;
  const net = e.net;
  if (!net) return 0;
  net.demand += e.def.power;
  return net.ratio;
}

function updateMachine(g, e) {
  switch (e.kind) {
    case 'boiler': {
      if (e.burning > 0) e.burning--;
      e.status = e.water <= 0 ? 'nowater' : (e.fuel > 0 || e.energy > 0) ? (e.burning > 0 ? 'work' : 'idle') : 'nofuel';
      break;
    }
    case 'miner': {
      if (!e.buf) {
        let tiles = e.tiles;
        if (tiles.length && g.world.amount[tiles[e.rr % tiles.length]] === 0) tiles = e.tiles = tiles.filter((k) => g.world.amount[k] > 0);
        if (!tiles.length) { e.status = 'empty'; break; }
        const f = powerFactor(e);
        e.status = f > 0 ? 'work' : 'nopower';
        e.progress += (e.def.rate * f) / UPS;
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
          const f = powerFactor(e);
          e.status = f > 0 ? 'work' : 'nopower';
          e.progress += f / (r.time * UPS);
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
        else if (e.status !== 'work' && e.status !== 'nopower') e.status = 'full';
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
          const f = powerFactor(e);
          if (f > 0 && e.progress === 0) { for (const k in r.in) e.inb[k] -= r.in[k]; e.progress = 1e-9; }
          e.status = f > 0 ? 'work' : 'nopower';
          if (e.progress > 0) e.progress += f / (r.time * UPS);
          if (e.progress >= 1) { e.progress = 0; e.outCount += r.n; }
        }
      }
      if (e.outCount > 0) {
        const [tx, ty] = g.outputTile(e);
        if (g.pushTo(tx, ty, r.out, e.dir)) e.outCount--;
        else if (e.status !== 'work' && e.status !== 'nopower') e.status = 'full';
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
