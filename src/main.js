// Arranque, bucle principal y la interfaz (HUD, barra de herramientas y paneles).
import { BUILDINGS, ITEMS, ITEM_IDS, MILESTONES, FURNACE_RECIPES, RESOURCES, TILE, UPS } from './config.js';
import { Game } from './sim.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { buildSprites, toolIcon } from './sprites.js';
import { saveLocal, loadLocal, clearLocal, exportFile, readFile } from './save.js';

const $ = (id) => document.getElementById(id);
const AUTOSAVE_S = 60;
const DIR_NAMES = ['→', '↓', '←', '↑'];

class App {
  constructor() {
    this.sprites = buildSprites();
    this.itemImg = Object.fromEntries(ITEM_IDS.map((id) => [id, this.sprites.items[id].toDataURL()]));
    this.toolImg = {};
    for (const id of Object.keys(BUILDINGS)) if (!BUILDINGS[id].hidden) this.toolImg[id] = toolIcon(this.sprites, id);
    this.state = { tool: null, dir: 0, erase: false, hover: null, preview: null };
    const params = new URLSearchParams(location.search);
    this.bench = parseInt(params.get('bench') || '0', 10);
    const saved = this.bench ? null : loadLocal();
    let game = null;
    if (saved) { try { game = Game.load(saved); } catch (e) { console.warn('Partida dañada, empiezo nueva', e); } }
    this.setGame(game || new Game());
    this.renderer = new Renderer($('game'), this.game, this.sprites);
    this.centerOnHub();
    this.input = new Input($('game'), this);
    if (this.bench) this.buildBench(this.bench);
    this.bindUI();
    this.buildToolbar();
    this.refreshInv();
    this.lastSave = performance.now();
    this.acc = 0;
    this.last = performance.now();
    this.fps = { frames: 0, t: 0, value: 0, ups: 0, steps: 0, simMs: 0, drawMs: 0 };
    window.addEventListener('resize', () => this.renderer.resize());
    const flush = () => { if (!this.bench) saveLocal(this.game); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    if (!saved && !this.bench) this.toast('Has aterrizado en Veyra. Mantén pulsado un recurso para extraer a mano, o elige un edificio abajo.');
    requestAnimationFrame((t) => this.loop(t));
    window.factorium = this; // útil para depurar
  }

  setGame(g) {
    this.game = g;
    g.on((type, data) => {
      if (type === 'changed') this.invDirty = true;
      if (type === 'milestone') {
        this.toast(`Hito completado: ${data.name}`);
        this.buildToolbar(data.unlocks);
      }
    });
    if (this.renderer) { this.renderer.setGame(g); this.centerOnHub(); }
  }

  centerOnHub() {
    const h = this.game.hub;
    this.renderer.cam.x = (h.x + 1.5) * TILE;
    this.renderer.cam.y = (h.y + 1.5) * TILE;
    this.renderer.cam.z = window.innerWidth < 700 ? 0.8 : 1.1;
  }

  // ---------- Bucle ----------
  loop(now) {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    this.input.update(dt);
    this.acc += dt;
    const t0 = performance.now();
    let steps = 0;
    while (this.acc >= 1 / UPS && steps < 6) { this.game.step(); this.acc -= 1 / UPS; steps++; }
    if (steps === 6) this.acc = 0; // si el equipo va justo, se ralentiza en vez de bloquearse
    const t1 = performance.now();
    this.renderer.draw(this.state);
    const t2 = performance.now();
    const f = this.fps;
    f.frames++; f.steps += steps; f.simMs += t1 - t0; f.drawMs += t2 - t1; f.t += dt;
    if (f.t >= 0.5) {
      f.value = f.frames / f.t; f.ups = f.steps / f.t;
      f.sim = f.simMs / f.frames; f.draw = f.drawMs / f.frames;
      f.frames = f.steps = f.simMs = f.drawMs = f.t = 0;
      if (!$('debug').classList.contains('hidden')) this.updateDebug();
    }
    if (this.invDirty || (this.game.tick % 15 === 0 && steps)) { this.refreshInv(); this.invDirty = false; }
    if (!this.bench && now - this.lastSave > AUTOSAVE_S * 1000) { saveLocal(this.game); this.lastSave = now; }
    requestAnimationFrame((t) => this.loop(t));
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
    if (id && BUILDINGS[id].kind !== 'belt' && this.state.dir == null) this.state.dir = 0;
    this.syncButtons();
    this.updatePreview();
    this.hoverInfo();
  }

  toggleErase() {
    this.state.erase = !this.state.erase;
    if (this.state.erase) this.state.tool = null;
    this.syncButtons();
    this.updatePreview();
    this.hoverInfo();
  }

  rotate(d = 1) {
    this.state.dir = (this.state.dir + d + 4) % 4;
    // sin herramienta: girar lo que hay bajo el cursor
    if (!this.state.tool && this.state.hover) {
      const e = this.game.entityAt(this.state.hover.x, this.state.hover.y);
      if (e && e.kind !== 'hub') {
        e.dir = (e.dir + d + 4) % 4;
        this.game.orderDirty = true;
      }
    }
    this.updatePreview();
  }

  originFor(type, x, y) {
    const s = BUILDINGS[type].size;
    const o = (s - 1) >> 1;
    return { x: x - o, y: y - o };
  }

  placeTool(x, y, silent = false) {
    const type = this.state.tool;
    if (!type) return;
    const o = this.originFor(type, x, y);
    const c = this.game.check(type, o.x, o.y, this.state.dir);
    if (!c.ok) {
      if (!silent || c.reason === 'Faltan materiales') this.hintMsg(c.reason, true);
      return;
    }
    this.game.place(type, o.x, o.y, this.state.dir);
    this.invDirty = true;
  }

  erase(x, y) {
    const e = this.game.entityAt(x, y);
    if (e && this.game.remove(e)) this.invDirty = true;
  }

  handMine(x, y) {
    const w = this.game.world;
    if (!w.inside(x, y) || this.game.entityAt(x, y)) return;
    const r = w.resource[w.idx(x, y)];
    if (!r) return;
    const item = RESOURCES[r].item;
    this.game.inv[item]++;
    this.invDirty = true;
    this.flashChip(item);
  }

  tap(x, y, mined) {
    const e = this.game.entityAt(x, y);
    if (!e) {
      if (!mined) this.handMine(x, y);
      return;
    }
    if (e.kind === 'hub') { this.openMilestones(); return; }
    if (e.kind === 'chest') {
      const n = e.total;
      for (const k in e.store) this.game.inv[k] += e.store[k];
      e.store = {}; e.total = 0;
      this.invDirty = true;
      this.toast(n ? `Recogidos ${n} objetos de la caja` : 'La caja está vacía');
      return;
    }
    if (e.kind === 'furnace' && e.outCount > 0) {
      this.game.inv[e.outType] += e.outCount;
      this.toast(`Recogidos ${e.outCount} × ${ITEMS[e.outType].name}`);
      e.outCount = 0;
      this.invDirty = true;
      return;
    }
    this.hintHtml(this.entityInfo(e));
  }

  updatePreview() {
    const s = this.state;
    if (!s.tool || !s.hover) { s.preview = null; return; }
    const o = this.originFor(s.tool, s.hover.x, s.hover.y);
    const c = this.game.check(s.tool, o.x, o.y, s.dir);
    s.preview = [{ type: s.tool, x: o.x, y: o.y, dir: s.dir, ok: c.ok }];
  }

  // ---------- Textos de ayuda ----------
  costHtml(cost) {
    const parts = Object.entries(cost).map(([k, v]) => {
      const have = this.game.inv[k] || 0;
      return `<span class="${have < v ? 'bad' : ''}">${v} ${ITEMS[k].name}</span>`;
    });
    return parts.join(' · ') || 'gratis';
  }

  entityInfo(e) {
    const d = BUILDINGS[e.type];
    switch (e.kind) {
      case 'miner': return `<b>${d.name}</b> · extrae ${ITEMS[e.item].name} · ${(e.rate * 60).toFixed(0)}/min ${DIR_NAMES[e.dir]}`;
      case 'furnace': {
        const inn = e.inType ? `${e.inCount} ${ITEMS[e.inType].name}` : 'vacío';
        const out = e.outCount ? ` → ${e.outCount} ${ITEMS[e.outType].name} (toca para recoger)` : '';
        return `<b>Horno</b> · ${inn}${out}`;
      }
      case 'chest': return `<b>Caja</b> · ${e.total}/${d.capacity} · toca para recoger`;
      case 'belt': return `<b>${d.name}</b> · ${(d.speed * 60).toFixed(0)} objetos/min`;
      case 'splitter': return `<b>Divisor</b> · reparte en 3 salidas`;
      case 'hub': return `<b>Baliza de aterrizaje</b> · lo que entra va a tu inventario · toca para ver hitos`;
    }
    return d.name;
  }

  hoverInfo() {
    const s = this.state;
    if (s.erase) { this.hintHtml('Modo borrar: toca o arrastra sobre edificios. Se devuelve todo el material.'); return; }
    if (s.tool) {
      const d = BUILDINGS[s.tool];
      this.hintHtml(`<b>${d.name}</b> ${DIR_NAMES[s.dir]} · ${d.desc} <span class="cost">· ${this.costHtml(d.cost)}</span>`);
      return;
    }
    if (!s.hover) { this.hintHtml(''); return; }
    const e = this.game.entityAt(s.hover.x, s.hover.y);
    if (e) { this.hintHtml(this.entityInfo(e)); return; }
    const w = this.game.world;
    if (w.inside(s.hover.x, s.hover.y)) {
      const r = w.resource[w.idx(s.hover.x, s.hover.y)];
      if (r) { this.hintHtml(`<b>${RESOURCES[r].name}</b> · mantén pulsado para extraer a mano, o pon un taladro encima`); return; }
    }
    this.hintHtml('');
  }

  hintHtml(h) { if (this._hint !== h) { $('hint').innerHTML = h; this._hint = h; } }
  hintMsg(text, bad) { this.hintHtml(bad ? `<span class="bad">${text}</span>` : text); clearTimeout(this._ht); this._ht = setTimeout(() => this.hoverInfo(), 1400); }

  toast(text) {
    const d = document.createElement('div');
    d.textContent = text;
    $('toast').appendChild(d);
    setTimeout(() => d.remove(), 3000);
  }

  // ---------- HUD ----------
  bindUI() {
    $('btnRotate').onclick = () => this.rotate(1);
    $('btnErase').onclick = () => this.toggleErase();
    $('btnCancel').onclick = () => this.selectTool(null);
    $('btnMilestones').onclick = () => this.openMilestones();
    $('btnMenu').onclick = () => this.openMenu();
    $('panelClose').onclick = () => this.closePanel();
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
      b.onclick = () => { b.classList.remove('new'); this.selectTool(this.state.tool === id ? null : id); };
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
      c.classList.toggle('hidden', n === 0 && !['ferrita', 'cobalina', 'lingFerrico', 'lingCobalina'].includes(id));
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
      body = `<h2>Siguiente hito: ${next.name}</h2><p>${next.text}</p>${rows}
        <p>Desbloquea: <b>${unl}</b></p>
        <button class="btn primary" id="btnDeliver" ${g.canAfford(next.cost) ? '' : 'disabled'}>Entregar y desbloquear</button>`;
    } else if (next) {
      body = `<h2>${next.name}</h2><p>${next.text}</p><p>Has terminado todo lo que ofrece la fase 1. ¡Gracias por probarla!</p>`;
    }
    body += `<p class="help">Lleva objetos con cintas a la Baliza: todo lo que entra pasa a tu inventario.</p><b>Completados</b><ul class="done-list">${done}</ul>`;
    const scroll = $('panel').classList.contains('hidden') ? 0 : document.querySelector('.panel-box').scrollTop;
    this.showPanel('milestones', body);
    document.querySelector('.panel-box').scrollTop = scroll;
    const btn = $('btnDeliver');
    if (btn) btn.onclick = () => { if (g.completeMilestone()) { saveLocal(g); this.openMilestones(); } };
  }

  openMenu() {
    this.showPanel('menu', `<h2>Factorium</h2>
      <p>Fase 1 · la partida se guarda sola cada minuto y al cerrar.</p>
      <div class="menu-grid">
        <button class="btn" id="mSave">Guardar ahora</button>
        <button class="btn" id="mExport">Exportar partida (archivo)</button>
        <button class="btn" id="mImport">Importar partida</button>
        <button class="btn" id="mNew">Nueva partida</button>
      </div>
      <h2 style="margin-top:16px">Controles</h2>
      <div class="help">
        <p><b>PC:</b> WASD o arrastrar para moverte · rueda para zoom · 1–7 elige edificio · clic para colocar · arrastra para trazar cintas · <b>R</b> girar · clic derecho o <b>X</b> borrar · <b>Q</b>/Esc soltar · <b>H</b> hitos · F3 rendimiento.</p>
        <p><b>Tablet:</b> un dedo para moverte · dos dedos para zoom · elige edificio y toca para colocar · arrastra para trazar cintas · botones ⟳ girar, ✖ borrar, ✋ soltar.</p>
        <p>Mantén pulsado un recurso para extraer a mano. Toca una caja o un horno para recoger lo que tiene.</p>
      </div>`);
    $('mSave').onclick = () => { this.toast(saveLocal(this.game) ? 'Partida guardada' : 'No se pudo guardar'); };
    $('mExport').onclick = () => exportFile(this.game);
    $('mImport').onclick = () => $('importFile').click();
    $('mNew').onclick = (ev) => {
      const b = ev.currentTarget;
      if (b.dataset.confirm) {
        clearLocal();
        this.setGame(new Game());
        this.chips && Object.values(this.chips).forEach((c) => c.remove());
        this.chips = null;
        this.buildToolbar();
        this.refreshInv();
        saveLocal(this.game);
        this.closePanel();
        this.toast('Nueva partida en un planeta nuevo');
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
    let placed = 0;
    // bucles rectangulares de 24x6 con objetos circulando
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
    $('debug').classList.remove('hidden');
  }
}

new App();
