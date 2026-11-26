// Entrada unificada: ratón, teclado y táctil (pinza para zoom, dos dedos para mover).
import { BUILDINGS, TILE, RESOURCES } from './config.js';

const TAP_PX = 9;
const MINE_INTERVAL = 0.3; // s por mineral a mano

export class Input {
  constructor(canvas, app) {
    this.c = canvas;
    this.app = app;
    this.pointers = new Map();
    this.keys = new Set();
    this.mode = null; // 'pan' | 'belt' | 'erase' | 'place' | 'tap' | 'pinch'
    this.mineTimer = 0;
    this.mineTile = null;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('pointerleave', () => { if (!this.pointers.size) this.app.state.hover = null; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.app.renderer.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get state() { return this.app.state; }
  get game() { return this.app.game; }
  get r() { return this.app.renderer; }

  tileAt(e) { return this.r.screenToTile(e.clientX, e.clientY); }

  down(e) {
    this.c.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, type: e.pointerType });
    if (this.pointers.size === 2) { this.startPinch(); return; }
    if (this.pointers.size > 2) return;
    const t = this.tileAt(e);
    this.state.hover = { x: t.x, y: t.y };
    const touch = e.pointerType !== 'mouse';
    if (e.button === 1) { this.mode = 'pan'; return; }
    if (e.button === 2) { this.mode = 'erase'; this.app.erase(t.x, t.y); return; }
    if (this.state.erase) { this.mode = 'erase'; this.app.erase(t.x, t.y); return; }
    const tool = this.state.tool;
    if (tool && BUILDINGS[tool].kind === 'belt') {
      this.mode = 'belt';
      this.beltLast = null;
      this.beltStep(t.x, t.y);
      return;
    }
    if (tool) {
      if (touch) { this.mode = 'place'; this.app.updatePreview(); }
      else { this.mode = 'place'; this.app.placeTool(t.x, t.y); }
      return;
    }
    this.mode = 'tap';
    this.mineTile = this.resourceAt(t.x, t.y) ? { x: t.x, y: t.y } : null;
    this.mineTimer = 0.29;
    this.mined = false;
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    const t = this.tileAt(e);
    if (!p) { this.state.hover = { x: t.x, y: t.y }; this.app.updatePreview(); this.app.hoverInfo(); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.mode === 'pinch') { this.pinchMove(); return; }
    this.state.hover = { x: t.x, y: t.y };
    const moved = Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_PX;
    switch (this.mode) {
      case 'pan': this.pan(dx, dy); break;
      case 'tap':
        if (this.mineTile && moved) {
          // con el dedo sobre un recurso: seguir minando en la casilla bajo el dedo
          if (this.resourceAt(t.x, t.y)) { this.mineTile = { x: t.x, y: t.y }; break; }
        }
        if (moved) { this.mode = 'pan'; this.mineTile = null; this.pan(p.x - p.sx, p.y - p.sy); }
        break;
      case 'belt': this.beltStep(t.x, t.y); break;
      case 'erase': this.app.erase(t.x, t.y); break;
      case 'place':
        if (p.type === 'mouse' && BUILDINGS[this.state.tool]?.size === 1) this.app.placeTool(t.x, t.y);
        break;
    }
    this.app.updatePreview();
    this.app.hoverInfo();
  }

  up(e, cancel = false) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p) return;
    if (this.mode === 'pinch') {
      if (this.pointers.size < 2) this.mode = this.pointers.size ? 'none' : null;
      return;
    }
    if (!cancel) {
      const t = this.tileAt(e);
      if (this.mode === 'tap') this.app.tap(t.x, t.y, this.mined);
      if (this.mode === 'place' && p.type !== 'mouse') this.app.placeTool(t.x, t.y);
    }
    if (p.type !== 'mouse') { this.state.hover = null; this.app.updatePreview(); }
    if (this.mode === 'belt') this.app.game.emit('changed');
    this.mode = null;
    this.mineTile = null;
  }

  pan(dx, dy) {
    this.app.freeCam = true;
    const z = this.r.cam.z;
    this.r.cam.x -= dx / z;
    this.r.cam.y -= dy / z;
    this.r.clampCam();
  }

  startPinch() {
    this.mode = 'pinch';
    this.mineTile = null;
    const [a, b] = [...this.pointers.values()];
    this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  pinchMove() {
    const [a, b] = [...this.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    this.pan(mx - this.pinch.mx, my - this.pinch.my);
    if (this.pinch.d > 10) this.r.zoomAt(mx, my, d / this.pinch.d);
    this.pinch = { d, mx, my };
  }

  // Coloca cintas siguiendo el trazo, casilla a casilla.
  beltStep(x, y) {
    const last = this.beltLast;
    if (last && last.x === x && last.y === y) return;
    if (!last) {
      this.app.placeTool(x, y, true);
      this.beltLast = { x, y };
      return;
    }
    // avanzar paso a paso hasta la casilla destino (primero el eje más largo)
    let cx = last.x, cy = last.y;
    let guard = 0;
    while ((cx !== x || cy !== y) && guard++ < 200) {
      const ddx = x - cx, ddy = y - cy;
      let dir;
      if (Math.abs(ddx) >= Math.abs(ddy)) dir = ddx > 0 ? 0 : 2;
      else dir = ddy > 0 ? 1 : 3;
      // girar la cinta anterior hacia la nueva
      const prev = this.game.entityAt(cx, cy);
      if (prev && prev.kind === 'belt' && prev.dir !== dir) this.game.place(prev.type, prev.x, prev.y, dir);
      cx += dir === 0 ? 1 : dir === 2 ? -1 : 0;
      cy += dir === 1 ? 1 : dir === 3 ? -1 : 0;
      this.state.dir = dir;
      this.app.placeTool(cx, cy, true);
    }
    this.beltLast = { x, y };
  }

  resourceAt(x, y) {
    const w = this.game.world;
    if (!w.inside(x, y) || this.game.entityAt(x, y)) return 0;
    return w.resource[w.idx(x, y)];
  }

  update(dt) {
    // minado a mano manteniendo pulsado (el dron tiene que estar cerca)
    this.state.mining = null;
    if (this.mode === 'tap' && this.mineTile) {
      if (this.app.inMineRange(this.mineTile.x, this.mineTile.y)) {
        this.state.mining = this.mineTile;
        this.mineTimer += dt;
        while (this.mineTimer >= MINE_INTERVAL) {
          this.mineTimer -= MINE_INTERVAL;
          if (!this.app.handMine(this.mineTile.x, this.mineTile.y)) { this.mineTile = null; break; }
          this.mined = true;
        }
      } else {
        this.app.hintMsg('Demasiado lejos: acerca el dron (WASD o joystick)', true);
        this.mineTile = null;
      }
    }
    // mover el dron con teclado
    let mx = 0, my = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    this.move = { x: mx, y: my, fast: this.keys.has('shift') };
  }

  key(e, down) {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (down) this.keys.add(k); else { this.keys.delete(k); return; }
    if (e.repeat) return;
    if (k === 'r') this.app.rotate(e.shiftKey ? -1 : 1);
    else if (k === 'q' || k === 'escape') this.app.selectTool(null);
    else if (k === 'x') this.app.toggleErase();
    else if (k === 'f3') { e.preventDefault(); this.app.toggleDebug(); }
    else if (k === 'h') this.app.openMilestones();
    else if (k === 'c') this.app.freeCam = false;
    else if (k === '+' || k === '=') this.r.zoomAt(this.r.vw / 2, this.r.vh / 2, 1.2);
    else if (k === '-') this.r.zoomAt(this.r.vw / 2, this.r.vh / 2, 1 / 1.2);
    else {
      for (const [id, b] of Object.entries(BUILDINGS)) {
        if (b.key === k && this.game.unlocked.has(id)) { this.app.selectTool(id); break; }
      }
    }
  }
}

export { TILE, RESOURCES };
