// Arranque, bucle principal y la interfaz (HUD, dron, objetivos y paneles).
import { BUILDINGS, ITEMS, ITEM_IDS, MILESTONES, RECIPES, RESOURCES, TASKS, TILE, UPS, REVEAL_R, MINE_RANGE, ROADMAP, FUEL } from './config.js';
import { Game, setItemNamer } from './sim.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { buildSprites, toolIcon } from './sprites.js';
import { saveLocal, loadLocal, clearLocal, exportFile, readFile } from './save.js';

const $ = (id) => document.getElementById(id);
const AUTOSAVE_S = 30;
const DIR_NAMES = ['→', '↓', '←', '↑'];
const STATUS_TEXT = {
  work: ['st-work', 'Trabajando'],
  idle: ['st-idle', 'Esperando material'],
  full: ['st-full', 'Salida atascada: conecta una cinta o máquina donde apunta la flecha'],
  empty: ['st-empty', 'Yacimiento agotado: muévelo a otra veta'],
  nopower: ['st-power', 'Sin energía: ponle un poste cerca conectado a la red'],
  nowater: ['st-full', 'Sin agua: conéctala con tuberías a una bomba'],
  nofuel: ['st-idle', 'Sin combustible: llévale carbón o coque'],
};
setItemNamer((k) => ITEMS[k].name);

class App {
  constructor() {
    this.sprites = buildSprites();
    this.itemImg = Object.fromEntries(ITEM_IDS.map((id) => [id, this.sprites.items[id].toDataURL()]));
    this.toolImg = {};
    for (const id of Object.keys(BUILDINGS)) if (!BUILDINGS[id].hidden) this.toolImg[id] = toolIcon(this.sprites, id);
    this.state = { tool: null, dir: 0, erase: false, hover: null, preview: null, guide: null, selected: null, mining: null };
    this.joy = { x: 0, y: 0 };
    this.freeCam = false;
    const params = new URLSearchParams(location.search);
    this.bench = parseInt(params.get('bench') || '0', 10);
    const saved = this.bench ? null : loadLocal();
    let game = null;
    if (saved) { try { game = Game.load(saved); } catch (e) { console.warn('Partida antigua o dañada, empiezo nueva', e); } }
    this.renderer = new Renderer($('game'), game || new Game(), this.sprites);
    this.setGame(this.renderer.game);
    this.input = new Input($('game'), this);
    if (this.bench) this.buildBench(this.bench);
    this.bindUI();
    this.bindJoystick();
    this.bindMinimap();
    this.buildToolbar();
    this.refreshInv();
    this.refreshTask();
    this.lastSave = performance.now();
    this.acc = 0;
    this.last = performance.now();
    this.fps = { frames: 0, t: 0, value: 0, ups: 0, steps: 0, simMs: 0, drawMs: 0 };
    window.addEventListener('resize', () => this.renderer.resize());
    const flush = () => { if (!this.bench) saveLocal(this.game); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    if (!game && !this.bench) this.openWelcome();
    requestAnimationFrame((t) => this.loop(t));
    window.factorium = this;
  }

  setGame(g) {
    this.game = g;
    g.on((type, data) => {
      if (type === 'changed') this.invDirty = true;
      else if (type === 'milestone') {
        this.toast(`Hito completado: ${data.name}. ¡Nuevos edificios abajo!`);
        this.buildToolbar(data.unlocks);
      } else if (type === 'delivered') {
        const now = performance.now();
        if (!this._lastFloat || now - this._lastFloat > 140) {
          this._lastFloat = now;
          const h = g.hub;
          this.renderer.floater(data, (h.x + 1.5 + (Math.random() - 0.5)) * TILE, (h.y + 1) * TILE);
        }
      } else if (type === 'depleted') this.renderer.invalidateTile(data);
    });
    if (this.renderer.game !== g) this.renderer.setGame(g);
    this.freeCam = false;
    const d = g.drone;
    this.renderer.cam.x = d.x * TILE;
    this.renderer.cam.y = d.y * TILE;
    this.renderer.cam.z = window.innerWidth < 700 ? 0.85 : 1.1;
    this.closeSheet();
  }

  // ---------- Bucle ----------
  loop(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.input.update(dt);
    this.updateDrone(dt);
    this.acc += dt;
    const t0 = performance.now();
    let steps = 0;
    while (this.acc >= 1 / UPS && steps < 6) { this.game.step(); this.acc -= 1 / UPS; steps++; }
    if (steps === 6) this.acc = 0;
    const t1 = performance.now();
    this.state.showRange = !!this.input.mineTile;
    this.renderer.draw(this.state, dt);
    const t2 = performance.now();
    const f = this.fps;
    f.frames++; f.steps += steps; f.simMs += t1 - t0; f.drawMs += t2 - t1; f.t += dt;
    if (f.t >= 0.5) {
      f.value = f.frames / f.t; f.ups = f.steps / f.t;
      f.sim = f.simMs / f.frames; f.draw = f.drawMs / f.frames;
      f.frames = f.steps = f.simMs = f.drawMs = f.t = 0;
      if (!$('debug').classList.contains('hidden')) this.updateDebug();
      this.refreshTask();
      this.updateClock();
      if (this.state.selected) this.renderSheet();
    }
    if (this.renderer.frame % 8 === 0) this.renderer.drawMinimap($('minimap'), this.state);
    if (this.invDirty || this.renderer.frame % 15 === 0) { this.refreshInv(); this.invDirty = false; }
    if (!this.bench && now - this.lastSave > AUTOSAVE_S * 1000) { saveLocal(this.game); this.lastSave = now; }
    requestAnimationFrame((t) => this.loop(t));
  }

  updateDrone(dt) {
    const d = this.game.drone;
    const m = this.input.move || { x: 0, y: 0 };
    let mx = m.x + this.joy.x, my = m.y + this.joy.y;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const speed = m.fast ? 13 : 8;
    // inercia suave
    d.vx += (mx * speed - d.vx) * Math.min(1, dt * 8);
    d.vy += (my * speed - d.vy) * Math.min(1, dt * 8);
    const w = this.game.world;
    d.x = Math.max(0.5, Math.min(w.w - 0.5, d.x + d.vx * dt));
    d.y = Math.max(0.5, Math.min(w.h - 0.5, d.y + d.vy * dt));
    if (Math.hypot(d.vx, d.vy) > 0.5) {
      const target = Math.atan2(d.vy, d.vx);
      let diff = target - d.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      d.angle += diff * Math.min(1, dt * 10);
    }
    if (len > 0.1) this.freeCam = false;
    const tx = d.x | 0, ty = d.y | 0;
    if (tx !== this._rx || ty !== this._ry) {
      this._rx = tx; this._ry = ty;
      if (w.reveal(d.x, d.y, REVEAL_R)) { this.renderer.fogDirty = true; this.renderer.miniDirty = true; }
    }
    const cam = this.renderer.cam;
    if (!this.freeCam) {
      const k = Math.min(1, dt * 6);
      cam.x += (d.x * TILE - cam.x) * k;
      cam.y += (d.y * TILE - cam.y) * k;
    }
    $('btnCenter').classList.toggle('hidden', !this.freeCam);
  }

  inMineRange(x, y) {
    const d = this.game.drone;
    return Math.hypot(x + 0.5 - d.x, y + 0.5 - d.y) <= MINE_RANGE;
  }

  updateClock() {
    const l = this.game.light ?? 1;
    const t = (((this.game.tick / UPS) / 300 + 0.3) % 1);
    const txt = `${l > 0.02 ? '☀' : '☾'} ${String(Math.floor((t * 24 + 6) % 24)).padStart(2, '0')}:00`;
    if ($('clock').textContent !== txt) $('clock').textContent = txt;
  }

  updateDebug() {
    const f = this.fps, g = this.game;
    let items = 0;
    for (const b of g.belts) items += b.it.length;
    $('debug').textContent = `${f.value.toFixed(0)} fps · ${f.ups.toFixed(0)} ups · sim ${f.sim.toFixed(2)} ms · dibujo ${f.draw.toFixed(2)} ms · ${g.belts.length} cintas · ${items} objetos`;
  }

  toggleDebug() { $('debug').classList.toggle('hidden'); this.updateDebug(); }

  // ---------- Acciones ----------
  selectTool(id) {
    this.state.tool = id;
    this.state.erase = false;
    if (id) this.closeSheet();
    this.syncButtons();
    this.updatePreview();
    this.hoverInfo();
  }

  toggleErase() {
    this.state.erase = !this.state.erase;
    if (this.state.erase) { this.state.tool = null; this.closeSheet(); }
    this.syncButtons();
    this.updatePreview();
    this.hoverInfo();
  }

  rotate(d = 1) {
    const sel = this.state.selected;
    if (!this.state.tool && sel) { this.rotateEntity(sel, d); return; }
    this.state.dir = (this.state.dir + d + 4) % 4;
    if (!this.state.tool && this.state.hover) {
      const e = this.game.entityAt(this.state.hover.x, this.state.hover.y);
      if (e) this.rotateEntity(e, d);
    }
    this.updatePreview();
    this.hoverInfo();
  }

  rotateEntity(e, d) {
    if (e.kind === 'hub') return;
    e.dir = (e.dir + d + 4) % 4;
    this.game.orderDirty = true;
  }

  originFor(type, x, y) {
    const o = (BUILDINGS[type].size - 1) >> 1;
    return { x: x - o, y: y - o };
  }

  placeTool(x, y, silent = false) {
    const type = this.state.tool;
    if (!type) return;
    const o = this.originFor(type, x, y);
    const c = this.game.check(type, o.x, o.y, this.state.dir);
    if (!c.ok) {
      if (!silent || c.reason.startsWith('Faltan')) this.hintMsg(c.reason, true);
      return;
    }
    const e = this.game.place(type, o.x, o.y, this.state.dir);
    if (e) {
      for (let i = 0; i < 6; i++) this.renderer.puff((o.x + e.size / 2) * TILE, (o.y + e.size / 2) * TILE, 'dust');
      if (this.moving && this.moving === type) { this.moving = null; this.selectTool(null); }
    }
    this.invDirty = true;
  }

  erase(x, y) {
    const e = this.game.entityAt(x, y);
    if (e && this.game.remove(e)) {
      if (this.state.selected === e) this.closeSheet();
      this.invDirty = true;
    }
  }

  handMine(x, y) {
    const item = this.game.handMine(x, y);
    if (!item) return null;
    this.invDirty = true;
    this.flashChip(item);
    const d = this.game.drone;
    this.renderer.floater(item, d.x * TILE, d.y * TILE - 20);
    return item;
  }

  tap(x, y, mined) {
    const e = this.game.entityAt(x, y);
    if (!e) {
      this.closeSheet();
      const w = this.game.world;
      if (!mined && w.inside(x, y) && w.resource[w.idx(x, y)] && !this.inMineRange(x, y)) {
        this.hintMsg('Demasiado lejos: acerca el dron (WASD o joystick)', true);
      }
      return;
    }
    if (e.kind === 'hub') { this.openMilestones(); return; }
    this.state.selected = e;
    this.renderSheet();
  }

  updatePreview() {
    const s = this.state;
    if (!s.tool || !s.hover) { s.preview = null; return; }
    const o = this.originFor(s.tool, s.hover.x, s.hover.y);
    const c = this.game.check(s.tool, o.x, o.y, s.dir);
    s.preview = [{ type: s.tool, x: o.x, y: o.y, dir: s.dir, ok: c.ok }];
  }

  // ---------- Panel de máquina ----------
  slot(item, n) { return `<span class="slot"><img src="${this.itemImg[item]}" alt="">${n}</span>`; }

  renderSheet() {
    const e = this.state.selected;
    if (!e || this.game.ents[e.id] !== e) { this.closeSheet(); return; }
    const d = BUILDINGS[e.type];
    const st = STATUS_TEXT[e.status];
    let h = `<h3>${d.name} ${DIR_NAMES[e.dir]}</h3>`;
    if (st && e.kind !== 'chest' && e.kind !== 'belt' && e.kind !== 'splitter') h += `<div class="status ${st[0]}">● ${st[1]}</div>`;
    const net = e.net;
    if (e.def.power || e.def.output || e.kind === 'pole' || e.kind === 'battery') {
      if (net) {
        const pct = (net.ratio * 100).toFixed(0);
        h += `<div class="help">⚡ Red: puede dar <b>${net.cap.toFixed(0)} kW</b>${net.solar > 0 ? ` (solar ${net.solar.toFixed(0)})` : ''} · consume <b>${(net.lastDemand || 0).toFixed(0)} kW</b>${net.ratio < 1 ? ` · <span class="bad">las máquinas van al ${pct}%</span>` : ''}</div>`;
        if (net.battMax) h += `<div class="help">🔋 Acumuladores: ${(net.batt / 1000).toFixed(1)} / ${(net.battMax / 1000).toFixed(0)} MJ${net.discharge > 0 ? ` · aportando ${net.discharge.toFixed(0)} kW` : ''}</div>`;
      } else if (e.kind !== 'pole') h += `<div class="help bad">⚡ No está conectado a ninguna red</div>`;
      if (e.def.power) h += `<div class="help">Consume ${e.def.power} kW</div>`;
    }
    switch (e.kind) {
      case 'boiler': {
        h += `<div class="slots">${e.fuelType ? this.slot(e.fuelType, e.fuel) : '<span class="slot">sin combustible</span>'}</div>`;
        h += `<div class="help">Agua: ${(e.water * 100).toFixed(0)}% · alimenta ${e.gens.length} de 2 generadores · quema carbón o coque (que le llegue por cinta).</div>`;
        break;
      }
      case 'generator': h += `<div class="help">${e.boiler ? `Recibe vapor de una caldera · da ${(e.avail || 0).toFixed(0)} kW disponibles` : '<span class="bad">Necesita una caldera tocándolo</span>'}</div>`; break;
      case 'solar': h += `<div class="help">Ahora da ${(e.def.output * (this.game.light || 0)).toFixed(0)} de 60 kW (${this.game.light > 0.02 ? 'de día' : 'de noche'}).</div>`; break;
      case 'battery': h += `<div class="help">Carga: ${((e.charge / e.def.capacity) * 100).toFixed(0)}% · ${e.status === 'work' ? 'cargando' : e.status === 'discharge' ? 'descargando' : 'en reposo'}</div>`; break;
      case 'pump': h += '<div class="help">Saca agua para hasta 4 calderas conectadas con tuberías.</div>'; break;
      case 'pipe': h += '<div class="help">Une bombas y calderas.</div>'; break;
      case 'pole': h += '<div class="help">Da energía a lo que esté en su zona azul y se conecta solo a postes cercanos (hasta 9 casillas).</div>'; break;
      case 'miner': {
        const w = this.game.world;
        let left = 0;
        for (const k of e.tiles) left += w.amount[k];
        h += `<div class="slots">Extrae ${this.slot(e.item, (d.rate * 60).toFixed(0) + '/min')}</div>`;
        h += `<div class="help">Quedan <b>${left}</b> unidades en el yacimiento bajo el taladro.</div>`;
        break;
      }
      case 'furnace': {
        h += '<div class="slots">';
        h += e.inType ? this.slot(e.inType, e.inCount) : '<span class="slot">vacío</span>';
        h += '<span class="arrow">→</span>';
        h += e.outCount ? this.slot(e.outType, e.outCount) : '<span class="slot">—</span>';
        h += '</div><div class="help">Mineral de hierro → Lingote de hierro · Mineral de cobre → Lingote de cobre · 2 Carbón → Coque · 3 Lingote de hierro → Acero</div>';
        break;
      }
      case 'crafter': {
        const r = RECIPES[e.recipe];
        h += '<div class="slots">';
        h += Object.entries(r.in).map(([k, v]) => this.slot(k, `${e.inb[k]}/${v}`)).join('');
        h += `<span class="arrow">→</span>${this.slot(r.out, e.outCount)}</div>`;
        h += `<div class="bar"><i style="width:${(e.progress * 100) | 0}%"></i></div>`;
        h += '<div class="recipes">';
        for (const [rid, rr] of Object.entries(RECIPES)) {
          if (rr.machine !== e.type) continue;
          const ins = Object.entries(rr.in).map(([k, v]) => `${v} ${ITEMS[k].name}`).join(' + ');
          h += `<button class="btn ${rid === e.recipe ? 'active' : ''}" data-recipe="${rid}"><img src="${this.itemImg[rr.out]}" alt="">${rr.n > 1 ? rr.n + ' ' : ''}${ITEMS[rr.out].name} <small>(${ins}, ${rr.time}s)</small></button>`;
        }
        h += '</div>';
        break;
      }
      case 'chest': {
        const list = Object.entries(e.store).filter(([, v]) => v > 0);
        h += `<div class="status">${e.total}/${d.capacity}</div><div class="slots">${list.map(([k, v]) => this.slot(k, v)).join('') || 'vacía'}</div>`;
        break;
      }
      case 'belt': h += `<div class="help">${(d.speed * 60).toFixed(0)} objetos por minuto. Las cintas pueden recibir por los lados.</div>`; break;
      case 'splitter': h += `<div class="help">Lo que entra por detrás sale por delante, izquierda y derecha, por turnos.</div>`; break;
    }
    const canCollect = (e.kind === 'chest' && e.total) || (e.kind === 'furnace' && e.outCount) || (e.kind === 'crafter' && e.outCount);
    h += `<div class="row">${canCollect ? '<button class="btn primary" data-act="collect">Recoger</button>' : ''}
      <button class="btn" data-act="rotate">⟳ Girar</button><button class="btn" data-act="move">✥ Mover</button><button class="btn" data-act="delete">✖ Quitar</button></div>`;
    const body = $('sheetBody');
    if (body.innerHTML !== h) body.innerHTML = h;
    $('sheet').classList.remove('hidden');
    document.body.classList.add('sheet-open');
    body.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.recipe) { this.game.setRecipe(e, b.dataset.recipe); this.invDirty = true; }
      const act = b.dataset.act;
      if (act === 'collect') {
        const before = { ...this.game.inv };
        if (e.kind === 'chest') { for (const k in e.store) this.game.inv[k] += e.store[k]; e.store = {}; e.total = 0; }
        else if (e.kind === 'furnace') { this.game.inv[e.outType] += e.outCount; e.outCount = 0; }
        else if (e.kind === 'crafter') { this.game.inv[RECIPES[e.recipe].out] += e.outCount; e.outCount = 0; }
        const got = ITEM_IDS.reduce((a, k) => a + this.game.inv[k] - before[k], 0);
        this.toast(`Recogidos ${got} objetos`);
        this.invDirty = true;
      }
      if (act === 'rotate') this.rotateEntity(e, 1);
      if (act === 'delete') { this.game.remove(e); this.closeSheet(); return; }
      if (act === 'move') {
        const type = e.type, dir = e.dir;
        this.game.remove(e);
        this.closeSheet();
        this.selectTool(type);
        this.state.dir = dir;
        this.moving = type;
        this.toast('Toca donde quieras ponerlo');
        return;
      }
      this.renderSheet();
    };
  }

  closeSheet() {
    this.state.selected = null;
    const s = $('sheet');
    if (s) s.classList.add('hidden');
    document.body.classList.remove('sheet-open');
  }

  // ---------- Objetivos ----------
  refreshTask() {
    const g = this.game;
    const task = TASKS[g.task];
    if (!task) {
      $('taskNum').textContent = 'Objetivos completados';
      $('taskText').textContent = 'Has cumplido todos los objetivos de la fase 1.';
      $('taskBar').style.width = '100%';
      $('taskCount').textContent = '';
      return;
    }
    const cur = g.stats.delivered[task.item] || 0;
    if (cur >= task.n) {
      g.refund(task.reward);
      const rw = Object.entries(task.reward).map(([k, v]) => `${v} ${ITEMS[k].name}`).join(', ');
      this.toast(`✔ Objetivo cumplido${rw ? ' · Recompensa: ' + rw : ''}`);
      g.task++;
      // el siguiente objetivo cuenta desde cero
      g.stats.delivered = {};
      $('task').classList.remove('done'); void $('task').offsetWidth; $('task').classList.add('done');
      this.invDirty = true;
      if (!this.bench) saveLocal(g);
      this.refreshTask();
      return;
    }
    $('taskNum').textContent = `Objetivo ${g.task + 1} de ${TASKS.length}`;
    const text = `Entrega ${task.n} ${ITEMS[task.item].name} en la Baliza`;
    if (this._taskText !== text) this._taskText = text, $('taskText').innerHTML = `<img src="${this.itemImg[task.item]}" alt="" style="width:20px;height:20px;vertical-align:-4px"> ${text}`;
    $('taskBar').style.width = `${Math.min(100, (cur / task.n) * 100)}%`;
    $('taskCount').textContent = `${cur} / ${task.n}`;
  }

  // ---------- Textos de ayuda ----------
  costHtml(cost) {
    const parts = Object.entries(cost).map(([k, v]) => {
      const have = this.game.inv[k] || 0;
      return `<span class="${have < v ? 'bad' : ''}">${v} ${ITEMS[k].name}</span>`;
    });
    return parts.join(' · ') || 'gratis';
  }

  hoverInfo() {
    const s = this.state;
    if (s.erase) { this.hintHtml('Modo quitar: toca o arrastra sobre edificios. Recuperas todo el material.'); return; }
    if (s.tool) {
      const d = BUILDINGS[s.tool];
      this.hintHtml(`<b>${d.name}</b> ${DIR_NAMES[s.dir]} · ${d.desc}${d.power ? ` (${d.power} kW)` : ''} <span class="cost">· ${this.costHtml(d.cost)}</span>`);
      return;
    }
    if (!s.hover) { this.hintHtml(''); return; }
    const w = this.game.world;
    if (w.inside(s.hover.x, s.hover.y)) {
      const k = w.idx(s.hover.x, s.hover.y);
      if (!w.explored[k]) { this.hintHtml('Zona sin explorar'); return; }
      const e = this.game.entityAt(s.hover.x, s.hover.y);
      if (e) { this.hintHtml(`<b>${BUILDINGS[e.type].name}</b> · toca para ver detalles`); return; }
      const r = w.resource[k];
      if (r) { this.hintHtml(`<b>${RESOURCES[r].name}</b> · quedan ${w.amount[k]} · mantén pulsado para extraer o pon un taladro`); return; }
    }
    this.hintHtml('');
  }

  hintHtml(h) { if (this._hint !== h) { $('hint').innerHTML = h; this._hint = h; } }
  hintMsg(text, bad) { this.hintHtml(bad ? `<span class="bad">${text}</span>` : text); clearTimeout(this._ht); this._ht = setTimeout(() => this.hoverInfo(), 1800); }

  toast(text) {
    const d = document.createElement('div');
    d.textContent = text;
    $('toast').appendChild(d);
    while ($('toast').children.length > 3) $('toast').firstChild.remove();
    setTimeout(() => d.remove(), 3000);
  }

  // ---------- HUD ----------
  bindUI() {
    $('btnRotate').onclick = () => this.rotate(1);
    $('btnErase').onclick = () => this.toggleErase();
    $('btnCancel').onclick = () => { this.moving = null; this.selectTool(null); };
    $('btnMilestones').onclick = () => this.openMilestones();
    $('btnMenu').onclick = () => this.openMenu();
    $('btnCenter').onclick = () => { this.freeCam = false; };
    $('panelClose').onclick = () => this.closePanel();
    $('sheetClose').onclick = () => this.closeSheet();
    $('taskToggle').onclick = () => {
      $('task').classList.toggle('collapsed');
      $('taskToggle').textContent = $('task').classList.contains('collapsed') ? '+' : '–';
    };
    $('panel').addEventListener('pointerdown', (e) => { if (e.target.id === 'panel') this.closePanel(); });
    $('importFile').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const data = await readFile(f);
        this.setGame(Game.load(data));
        saveLocal(this.game);
        this.buildToolbar();
        this.closePanel();
        this.toast('Partida importada');
      } catch {
        this.toast('Ese archivo no es una partida válida');
      }
      e.target.value = '';
    });
  }

  bindJoystick() {
    const pad = $('joy'), knob = $('joyKnob');
    let id = null;
    const set = (e) => {
      const r = pad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width / 2 - 10;
      const l = Math.hypot(dx, dy);
      if (l > max) { dx = (dx / l) * max; dy = (dy / l) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / max, ny = dy / max;
      const dead = Math.hypot(nx, ny) < 0.15;
      this.joy.x = dead ? 0 : nx; this.joy.y = dead ? 0 : ny;
    };
    pad.addEventListener('pointerdown', (e) => { id = e.pointerId; pad.setPointerCapture(id); set(e); e.preventDefault(); });
    pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  bindMinimap() {
    const mm = $('minimap');
    const go = (e) => {
      const r = mm.getBoundingClientRect();
      const w = this.game.world;
      this.renderer.cam.x = ((e.clientX - r.left) / r.width) * w.w * TILE;
      this.renderer.cam.y = ((e.clientY - r.top) / r.height) * w.h * TILE;
      this.freeCam = true;
    };
    let down = false;
    mm.addEventListener('pointerdown', (e) => { down = true; mm.setPointerCapture(e.pointerId); go(e); });
    mm.addEventListener('pointermove', (e) => { if (down) go(e); });
    mm.addEventListener('pointerup', () => { down = false; });
  }

  buildToolbar(fresh = []) {
    const tb = $('toolbar');
    tb.innerHTML = '';
    for (const [id, d] of Object.entries(BUILDINGS)) {
      if (d.hidden || !this.game.unlocked.has(id)) continue;
      const b = document.createElement('button');
      b.className = 'btn tool' + (fresh.includes(id) ? ' new' : '');
      b.dataset.id = id;
      b.title = `${d.name} (${d.key})`;
      b.innerHTML = `<span class="key">${d.key}</span><img src="${this.toolImg[id]}" alt="">`;
      b.onclick = () => { b.classList.remove('new'); this.moving = null; this.selectTool(this.state.tool === id ? null : id); };
      tb.appendChild(b);
    }
    this.syncButtons();
  }

  syncButtons() {
    for (const b of $('toolbar').children) {
      b.classList.toggle('active', b.dataset.id === this.state.tool);
      b.classList.toggle('poor', !this.game.canAfford(BUILDINGS[b.dataset.id].cost));
    }
    $('btnErase').classList.toggle('active', this.state.erase);
  }

  refreshInv() {
    const inv = $('inv');
    if (!this.chips) {
      this.chips = {};
      for (const id of ITEM_IDS) {
        const c = document.createElement('div');
        c.className = 'chip';
        c.title = ITEMS[id].name;
        c.innerHTML = `<img src="${this.itemImg[id]}" alt=""><span>0</span>`;
        inv.appendChild(c);
        this.chips[id] = c;
      }
    }
    for (const id of ITEM_IDS) {
      const n = this.game.inv[id] || 0;
      const c = this.chips[id];
      c.classList.toggle('hidden', n === 0 && !['ferrita', 'cobalina', 'musgo', 'lingFerrico', 'lingCobalina'].includes(id));
      const span = c.lastChild;
      const txt = String(n);
      if (span.textContent !== txt) span.textContent = txt;
    }
    this.syncButtons();
    if (!$('panel').classList.contains('hidden') && this.panelKind === 'milestones') this.openMilestones();
  }

  flashChip(id) {
    const c = this.chips && this.chips[id];
    if (!c) return;
    c.classList.add('flash');
    clearTimeout(c._t);
    c._t = setTimeout(() => c.classList.remove('flash'), 200);
  }

  // ---------- Paneles ----------
  showPanel(kind, html) {
    this.panelKind = kind;
    $('panelBody').innerHTML = html;
    $('panel').classList.remove('hidden');
  }

  closePanel() { $('panel').classList.add('hidden'); this.panelKind = null; }

  openWelcome() {
    const touch = matchMedia('(pointer: coarse)').matches;
    this.showPanel('welcome', `<h2>Has aterrizado en Veyra</h2>
      <p>Eres un dron constructor. Tu misión: extraer los recursos del planeta y montar una fábrica cada vez más grande.</p>
      <div class="help">
        <p><b>Moverte:</b> ${touch ? 'joystick abajo a la izquierda · arrastra el mapa para mirar · dos dedos para zoom' : 'WASD o flechas · arrastra el mapa para mirar · rueda para zoom'}.</p>
        <p><b>Extraer a mano:</b> acércate a un recurso y mantén pulsado encima.</p>
        <p><b>Construir:</b> elige un edificio abajo y toca el mapa. Las máquinas sacan lo que producen por la flecha naranja: pon delante una cinta u otra máquina.</p>
        <p><b>Energía:</b> taladros, hornos y fábricas necesitan electricidad. Al principio la Baliza da un poco a su alrededor; con postes la llevas más lejos. Después tendrás que montar tu central de vapor con carbón y agua.</p>
        <p><b>La niebla</b> esconde lo que aún no has explorado. Los yacimientos se agotan: tendrás que buscar más.</p>
        <p><b>Objetivo:</b> arriba a la izquierda verás qué entregar en la Baliza. Cómo lo consigas es cosa tuya.</p>
      </div>
      <button class="btn primary" id="wGo" style="margin-top:10px;width:100%">¡A trabajar!</button>`);
    $('wGo').onclick = () => this.closePanel();
  }

  openMilestones() {
    const g = this.game;
    const next = g.nextMilestone();
    const done = MILESTONES.slice(0, g.milestone + 1).map((m) => `<li>${m.name}</li>`).join('');
    let body = '';
    if (next && next.cost) {
      const rows = Object.entries(next.cost).map(([k, v]) => {
        const have = Math.min(v, g.inv[k] || 0);
        return `<div class="req"><img src="${this.itemImg[k]}" alt=""><div>${ITEMS[k].name}<div class="bar"><i style="width:${(have / v) * 100}%"></i></div></div><b>${have}/${v}</b></div>`;
      }).join('');
      const unl = next.unlocks.map((u) => BUILDINGS[u].name).join(', ');
      body = `<h2>Hito ${g.milestone + 1}: ${next.name}</h2><p>${next.text}</p>${rows}
        <p>Desbloquea: <b>${unl}</b></p>
        <button class="btn primary" id="btnDeliver" ${g.canAfford(next.cost) ? '' : 'disabled'}>Entregar y desbloquear</button>`;
    } else if (next) {
      body = `<h2>${next.name}</h2><p>${next.text}</p>`;
    }
    body += `<b>Próximas etapas de energía</b><ul class="help">${ROADMAP.map((r) => `<li>${r}</li>`).join('')}</ul>`;
    body += `<p class="help">Los materiales salen de tu inventario. Llévalos a la Baliza con cintas: todo lo que entra se suma.</p><b>Completados</b><ul class="done-list">${done}</ul>`;
    const box = document.querySelector('.panel-box');
    const scroll = $('panel').classList.contains('hidden') ? 0 : box.scrollTop;
    this.showPanel('milestones', body);
    box.scrollTop = scroll;
    const btn = $('btnDeliver');
    if (btn) btn.onclick = () => { if (g.completeMilestone()) { saveLocal(g); this.openMilestones(); } };
  }

  openMenu() {
    this.showPanel('menu', `<h2>Factorium</h2>
      <p>Fase 1 · la partida se guarda sola cada 30 segundos y al cerrar.</p>
      <div class="menu-grid">
        <button class="btn" id="mHelp">Cómo se juega</button>
        <button class="btn" id="mSave">Guardar ahora</button>
        <button class="btn" id="mExport">Exportar partida (archivo)</button>
        <button class="btn" id="mImport">Importar partida</button>
        <button class="btn" id="mNew">Nueva partida</button>
      </div>
      <h2 style="margin-top:16px">Controles</h2>
      <div class="help">
        <p><b>PC:</b> WASD mueve el dron (Mayús = rápido) · arrastrar mira el mapa · C vuelve al dron · rueda zoom · 1–9 edificios · clic coloca · arrastra para trazar cintas · <b>R</b> girar · clic derecho o <b>X</b> quitar · <b>Q</b>/Esc soltar · <b>H</b> hitos · F3 rendimiento.</p>
        <p><b>Móvil y tablet:</b> joystick mueve el dron · un dedo mira el mapa · dos dedos zoom · elige edificio y toca para colocar · arrastra para trazar cintas · ⟳ girar, ✖ quitar, ✋ soltar.</p>
      </div>`);
    $('mHelp').onclick = () => this.openWelcome();
    $('mSave').onclick = () => { this.toast(saveLocal(this.game) ? 'Partida guardada' : 'No se pudo guardar'); };
    $('mExport').onclick = () => exportFile(this.game);
    $('mImport').onclick = () => $('importFile').click();
    $('mNew').onclick = (ev) => {
      const b = ev.currentTarget;
      if (b.dataset.confirm) {
        clearLocal();
        this.setGame(new Game());
        this.buildToolbar();
        this.refreshInv();
        this.refreshTask();
        saveLocal(this.game);
        this.closePanel();
        this.openWelcome();
      } else {
        b.dataset.confirm = '1';
        b.textContent = '¿Seguro? Se perderá la partida actual. Toca otra vez.';
        b.classList.add('active');
      }
    };
  }

  // ---------- Prueba de rendimiento (?bench=N cintas) ----------
  buildBench(n) {
    const g = this.game;
    for (const k of Object.keys(BUILDINGS)) g.unlocked.add(k);
    const w = g.world;
    w.terrain.fill(0);
    w.explored.fill(1);
    this.renderer.fogDirty = true;
    let placed = 0;
    const LW = 24, LH = 6;
    outer:
    for (let y = 2; y + LH < w.h - 2; y += LH + 1) {
      for (let x = 2; x + LW < w.w - 2; x += LW + 1) {
        if (Math.abs(x - g.hub.x) < LW + 4 && Math.abs(y - g.hub.y) < LH + 4) continue;
        const cells = [];
        for (let i = 0; i < LW; i++) cells.push([x + i, y, 0]);
        for (let j = 0; j < LH; j++) cells.push([x + LW, y + j, 1]);
        for (let i = LW; i > 0; i--) cells.push([x + i, y + LH, 2]);
        for (let j = LH; j > 0; j--) cells.push([x, y + j, 3]);
        for (const [cx, cy, d] of cells) {
          const e = g.place((placed & 1) ? 'cinta2' : 'cinta', cx, cy, d, true);
          if (e) {
            e.it.push(placed % ITEM_IDS.length, (placed + 1) % ITEM_IDS.length);
            e.ip.push(0.6, 0.1);
            placed++;
          }
          if (placed >= n) break outer;
        }
      }
    }
    this.renderer.chunks.clear();
    this.renderer.ground.clear();
    $('debug').classList.remove('hidden');
  }
}

new App();
