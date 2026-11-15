import * as THREE from 'three';
import { BRICK_MAP, BRICKS, LAYER, brickCells, rotatedDims } from './bricks/catalog.js';
import { getBrickGeometry } from './bricks/geometry.js';
import { COLOR_MAP, materialsFor } from './bricks/materials.js';
import { BLUEPRINTS, makeSteps, modelBounds } from './data/blueprints.js';
import { LEVELS, houseWalls } from './data/levels.js';

const FREE_KEY = 'nuanguang.free.v1';

// =============== 自由模式 ===============
export class FreeMode {
  constructor(game) {
    this.game = game;
    this.name = 'free';
    this.undoable = true;
  }
  enter() {
    const g = this.game;
    g.world.setBase(32, g.settings.base);
    g.world.clear();
    try {
      const saved = JSON.parse(localStorage.getItem(FREE_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) {
        g.world.load(saved);
        g.toast(`欢迎回来，上次的 ${saved.length} 块积木都还在`);
      }
    } catch (e) {
      /* 忽略损坏的存档 */
    }
    g.hud.setModeChip('自由模式', '想搭什么就搭什么');
    g.hud.setFreeButtons(true);
    g.hud.showPicker(true);
    g.hud.buildPicker(null, null);
    g.hud.showBottom(true);
    this.viewShift = 120;
    g.hud.buildTools();
    g.hud.lockPalette(false);
    g.hud.setSide(null);
    g.hud.setHint('左键放置 · 右键拆除 · 拖动旋转视角 · 滚轮缩放 · R 旋转积木');
    g.frameCamera(32);
    this.off = g.world.onChange(() => this.save());
  }
  exit() {
    this.off?.();
    this.flush();
  }
  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 400);
  }
  flush() {
    try {
      localStorage.setItem(FREE_KEY, JSON.stringify(this.game.world.serialize()));
    } catch (e) {
      /* 存储已满时静默失败 */
    }
  }
  async clearAll() {
    const g = this.game;
    if (!g.world.bricks.size) return;
    if (await g.hud.confirm('清空桌面？', '所有积木都会被收回盒子里，这个操作不能撤销。', '清空')) {
      for (const b of [...g.world.bricks.values()]) g.world.remove(b.id, { animate: true, silent: true });
      g.world.history = [];
      g.world.future = [];
      g.world.emit({ type: 'clear' });
      g.audio.remove();
      g.refreshUndo();
    }
  }
  exportFile() {
    const data = { app: '暖光积木屋', version: 1, bricks: this.game.world.serialize() };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `积木作品-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    this.game.toast('作品已导出为 JSON 文件');
  }
  async importFile(file) {
    const g = this.game;
    try {
      const data = JSON.parse(await file.text());
      const list = (data.bricks || data).filter((b) => BRICK_MAP[b.type] && COLOR_MAP[b.color]);
      if (!list.length) throw new Error('empty');
      if (g.world.bricks.size && !(await g.hud.confirm('导入作品？', '当前桌面上的积木会被替换。', '导入'))) return;
      g.world.clear();
      g.world.load(list, { animate: true });
      g.refreshUndo();
      g.toast(`导入了 ${list.length} 块积木`);
    } catch (e) {
      g.toast('这个文件读不出来呢');
    }
  }
}

// =============== 建造模式（按图纸）===============
export class BuildMode {
  constructor(game, blueprint) {
    this.game = game;
    this.name = 'build';
    this.bp = blueprint;
    this.undoable = false;
    this.lockRotate = true;
    this.targets = [];
    this.time = 0;
  }
  enter() {
    const g = this.game;
    const list = this.bp.build();
    const bounds = modelBounds(list, BRICK_MAP, rotatedDims);
    const size = 24;
    const ox = Math.floor((size - bounds.w) / 2), oz = Math.floor((size - bounds.d) / 2);
    this.list = list.map((p) => ({ ...p, x: p.x + ox, z: p.z + oz }));
    this.steps = makeSteps(this.list);
    this.stepIdx = 0;
    this.placedCount = 0;
    g.world.setBase(size, '#7fae6a');
    g.world.clear();
    g.hud.setModeChip('建造模式', this.bp.name);
    g.hud.setFreeButtons(false);
    g.hud.showPicker(false);
    g.hud.showBottom(false);
    this.viewShift = -130;
    g.hud.setHint('点击闪烁的半透明积木把它放上去 · 拖动旋转视角 · 滚轮缩放');
    g.setTool('place');
    this.ghostMats = new Map();
    g.frameCamera(Math.max(bounds.w, bounds.d) + 10, (bounds.h * LAYER) / 3);
    this.startStep();
  }
  exit() {
    this.clearTargets();
  }
  clearTargets() {
    for (const t of this.targets) this.game.scene.remove(t.mesh, t.edges);
    this.targets = [];
  }
  ghostMat(color) {
    if (!this.ghostMats.has(color)) {
      const hex = COLOR_MAP[color].hex;
      this.ghostMats.set(
        color,
        new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.25, transparent: true, opacity: 0.4, depthWrite: false })
      );
    }
    return this.ghostMats.get(color);
  }
  startStep() {
    const g = this.game;
    this.clearTargets();
    const step = this.steps[this.stepIdx];
    if (!step) return;
    for (const p of step) {
      const t = BRICK_MAP[p.type];
      const { geometry } = getBrickGeometry(p.type);
      const mesh = new THREE.Mesh(geometry, this.ghostMat(p.color));
      g.world.brickPosition(t, p.x, p.y, p.z, p.rot, mesh.position);
      mesh.rotation.y = (p.rot * Math.PI) / 2;
      mesh.renderOrder = 5;
      mesh.userData.noAO = true;
      const [W, D] = rotatedDims(t, p.rot);
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(W, t.h * LAYER, D));
      proxy.position.copy(mesh.position);
      proxy.position.y += (t.h * LAYER) / 2;
      proxy.updateMatrixWorld(true);
      proxy.userData.target = { ...p };
      const box = new THREE.BoxGeometry(W - 0.01, t.h * LAYER + 0.01, D - 0.01);
      box.translate(0, (t.h * LAYER) / 2, 0);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: '#fff7e0', transparent: true, opacity: 0.8 }));
      edges.position.copy(mesh.position);
      edges.rotation.y = mesh.rotation.y;
      g.scene.add(mesh, edges);
      this.targets.push({ p, mesh, edges, proxy });
    }
    const first = step[0];
    g.interaction.rot = first.rot;
    g.setBrick(first.type, true);
    g.setColor(first.color, true);
    this.renderSide();
  }
  extraTargets() {
    return this.targets.map((t) => t.proxy);
  }
  adjustPlacement(p) {
    // 靠近目标时自动吸附
    let best = null, bd = 1e9;
    for (const t of this.targets) {
      const q = t.p;
      if (q.type !== p.type) continue;
      const d = Math.abs(q.x - p.x) + Math.abs(q.z - p.z) + Math.abs(q.y - p.y) * 0.3;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    if (best && bd <= 2.5) return { ...best };
    return p;
  }
  matchTarget(p) {
    const cellsKey = (q) => brickCells(BRICK_MAP[q.type], q.x, q.y, q.z, q.rot).map((c) => c.join(',')).sort().join('|');
    const pk = cellsKey(p);
    return this.targets.find((t) => {
      const q = t.p;
      if (q.type !== p.type) return false;
      const t0 = BRICK_MAP[q.type];
      if (!t0.symmetric180 && q.rot !== p.rot) return false;
      if (t0.symmetric180 && q.rot % 2 !== p.rot % 2) return false;
      return cellsKey(q) === pk;
    });
  }
  validate(p) {
    return this.matchTarget(p) ? { ok: true } : { ok: false, reason: 'wrong' };
  }
  beforePlace(p) {
    const t = this.matchTarget(p);
    if (!t) return null;
    return { ...t.p };
  }
  afterPlace(brick, p) {
    const g = this.game;
    const t = this.matchTarget(p);
    if (t) {
      g.scene.remove(t.mesh, t.edges);
      this.targets = this.targets.filter((x) => x !== t);
    }
    this.placedCount++;
    if (!this.targets.length) {
      this.stepIdx++;
      if (this.stepIdx >= this.steps.length) {
        this.complete();
        return;
      }
      g.audio.step();
      this.startStep();
    } else {
      const next = this.targets[0].p;
      g.interaction.rot = next.rot;
      g.setBrick(next.type, true);
      this.renderSide();
    }
  }
  canRemove() {
    return false;
  }
  autoPlace() {
    const t = this.targets[0];
    if (t) this.game.placeBrick({ ...t.p, ok: true });
  }
  renderSide() {
    const g = this.game;
    const step = this.steps[this.stepIdx];
    if (!step) return;
    const p = step[0];
    const total = this.list.length;
    const pct = Math.round((this.placedCount / total) * 100);
    const remain = this.targets.length;
    g.hud.setSide(`
      <h3>${this.bp.name}</h3>
      <p>第 <b>${this.stepIdx + 1}</b> / ${this.steps.length} 步</p>
      <div class="step-card">
        <img src="${g.thumbs.brick(p.type, p.color)}" alt="" />
        <div><span class="times">×${remain}</span><small>${BRICK_MAP[p.type].name}</small><small>${COLOR_MAP[p.color].name}</small></div>
      </div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <p style="font-size:12px">已拼好 ${this.placedCount} / ${total} 块</p>
      <div class="row wrap">
        <button class="btn" data-action="auto">帮我放一块</button>
        <button class="btn ghost" data-action="restart">从头再来</button>
      </div>
      <div class="tip">点击桌上闪烁的半透明积木，就能把它扣上去。</div>`);
  }
  async onAction(a) {
    const g = this.game;
    if (a === 'menu') return g.chooseMode('build');
    if (a === 'auto') this.autoPlace();
    if (a === 'restart' && (await g.hud.confirm('从头再来？', '已经拼好的部分会被拆掉。', '重新开始'))) g.startBuild(this.bp.id);
  }
  update(dt) {
    this.time += dt;
    const k = 0.28 + 0.18 * (0.5 + 0.5 * Math.sin(this.time * 4));
    for (const m of this.ghostMats.values()) m.opacity = k;
    for (const t of this.targets) t.edges.material.opacity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(this.time * 4));
  }
  async complete() {
    const g = this.game;
    this.clearTargets();
    g.setProgress('blueprints', this.bp.id, true);
    g.audio.success();
    g.fx.confetti(new THREE.Vector3(0, 4, 0), 12);
    g.hud.setSide(`<h3>${this.bp.name}</h3><p>完成啦！转动视角好好欣赏一下吧。</p>
      <div class="progress"><i style="width:100%"></i></div>
      <div class="row wrap"><button class="btn primary" data-action="menu">选别的图纸</button><button class="btn" data-action="restart">再拼一次</button></div>`);
    g.controls.autoRotate = true;
    await new Promise((r) => setTimeout(r, 1800));
    if (g.mode !== this) return;
    const r = await g.hud.modal(
      `<div class="center"><h2>🎉 ${this.bp.name} 完成！</h2><p>一共 ${this.list.length} 块积木，每一块都扣得严严实实。</p></div>`,
      [
        { id: 'stay', label: '再欣赏一会儿' },
        { id: 'free', label: '去自由模式继续装饰' },
        { id: 'menu', label: '选别的图纸', primary: true },
      ]
    );
    if (g.mode !== this) return;
    if (r === 'menu') g.chooseMode('build');
    else if (r === 'free') g.startFree(g.world.serialize());
  }
}

// =============== 闯关模式 ===============
export class LevelMode {
  constructor(game, index) {
    this.game = game;
    this.name = 'level';
    this.index = index;
    this.level = LEVELS[index];
    this.undoable = true;
    this.done = false;
    this.stars = [];
    this.decor = [];
    this.time = 0;
  }
  enter() {
    const g = this.game;
    const lv = this.level;
    g.world.setBase(lv.size, lv.base || '#7fae6a', lv.water || []);
    g.world.clear();
    const locked = lv.lockedBuilder === 'house' ? houseWalls() : lv.locked || [];
    this.lockedIds = locked.map((d) => g.world.add(d, { silent: true }).id);
    this.inventory = { ...lv.inventory };
    this.types = Object.keys(this.inventory);
    g.hud.setModeChip(`第 ${this.index + 1} 关`, lv.name);
    g.hud.setFreeButtons(false);
    g.hud.showPicker(true);
    g.hud.showBottom(true);
    g.hud.buildTools();
    g.hud.lockPalette(false);
    g.hud.setHint('左键放置 · 右键拆除 · 拖动旋转视角 · R 旋转积木');
    g.setTool('place');
    if (!this.types.includes(g.interaction.typeId)) g.setBrick(this.types[0], true);
    g.hud.buildPicker(this.types, this.counts());

    // 关卡装饰
    for (const goal of lv.goals) {
      if (goal.type === 'stars') {
        for (const c of goal.cells) {
          this.stars.push({ cell: c, mesh: g.fx.makeStar(this.cellCenter(c)), covered: false });
        }
      }
      if (goal.type === 'height') this.addHeightLine(goal.h);
      if (goal.type === 'replica') this.addReplica(goal.bricks);
      if (goal.type === 'cover') this.addRain(goal);
    }
    g.frameCamera(lv.size + 8, 2);
    this.off = g.world.onChange(() => this.evaluate());
    this.evaluate(true);
  }
  exit() {
    this.off?.();
    const g = this.game;
    for (const s of this.stars) if (s.mesh) g.scene.remove(s.mesh);
    for (const d of this.decor) g.scene.remove(d);
    g.fx.setRain(null);
  }
  cellCenter([x, y, z]) {
    const s = this.level.size;
    return new THREE.Vector3(x + 0.5 - s / 2, (y + 0.5) * LAYER, z + 0.5 - s / 2);
  }
  counts() {
    const used = {};
    for (const b of this.game.world.bricks.values()) if (!b.locked) used[b.type] = (used[b.type] || 0) + 1;
    const out = {};
    for (const t of this.types) out[t] = this.inventory[t] < 0 ? -1 : this.inventory[t] - (used[t] || 0);
    return out;
  }
  playerBricks() {
    return [...this.game.world.bricks.values()].filter((b) => !b.locked);
  }
  validate(p) {
    const c = this.counts()[p.type];
    if (c === undefined) return { ok: false, reason: 'inventory' };
    if (c === 0) return { ok: false, reason: 'inventory' };
    return { ok: true };
  }
  canRemove(b) {
    return !b.locked;
  }
  afterChange() {
    this.game.hud.updateCounts(this.counts());
  }

  addHeightLine(h) {
    const s = this.level.size;
    const y = h * LAYER;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([a, b]) => new THREE.Vector3((a * s) / 2, y, (b * s) / 2));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: '#f2b23a', dashSize: 0.6, gapSize: 0.4 }));
    line.computeLineDistances();
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y;
    plane.userData.noAO = true;
    // 小旗子
    const flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, y + 1.2, 8), new THREE.MeshStandardMaterial({ color: '#c79a52', metalness: 0.8, roughness: 0.3 }));
    pole.position.y = (y + 1.2) / 2;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshStandardMaterial({ color: '#e5793a', side: THREE.DoubleSide }));
    cloth.position.set(0.6, y + 0.8, 0);
    flag.add(pole, cloth);
    flag.position.set(s / 2 + 0.8, 0, -s / 2 - 0.8);
    flag.traverse((o) => (o.castShadow = true));
    this.game.scene.add(line, plane, flag);
    this.decor.push(line, plane, flag);
    this.heightPlane = plane;
  }

  addReplica(bricks) {
    const g = this.game;
    const grp = new THREE.Group();
    let mw = 0, md = 0;
    for (const p of bricks) {
      const t = BRICK_MAP[p.type];
      const [W, D] = rotatedDims(t, p.rot);
      mw = Math.max(mw, p.x + W);
      md = Math.max(md, p.z + D);
    }
    for (const p of bricks) {
      const t = BRICK_MAP[p.type];
      const { geometry, matKeys } = getBrickGeometry(p.type);
      const m = new THREE.Mesh(geometry, materialsFor(matKeys, p.color));
      const [W, D] = rotatedDims(t, p.rot);
      m.position.set(p.x + W / 2 - mw / 2, p.y * LAYER, p.z + D / 2 - md / 2);
      m.rotation.y = (p.rot * Math.PI) / 2;
      m.castShadow = m.receiveShadow = true;
      grp.add(m);
    }
    const holder = new THREE.Group();
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.9, 1.2, 40),
      new THREE.MeshPhysicalMaterial({ color: '#f4ead8', roughness: 0.4, clearcoat: 0.5 })
    );
    ped.position.y = 0.4;
    ped.castShadow = ped.receiveShadow = true;
    grp.scale.setScalar(0.7);
    grp.position.y = 1.0;
    holder.add(ped, grp);
    const s = this.level.size;
    holder.position.set(s / 2 + 5, -0.2, -s / 2 + 3);
    g.scene.add(holder);
    this.decor.push(holder);
    this.replicaSpin = grp;
    this.replicaThumb = g.thumbs.model(bricks, 220);
  }

  addRain(goal) {
    const s = this.level.size;
    const w = this.game.world;
    const top = (goal.y + 12) * LAYER;
    this.game.fx.setRain({
      x0: goal.x0 - s / 2,
      x1: goal.x1 + 1 - s / 2,
      z0: goal.z0 - s / 2,
      z1: goal.z1 + 1 - s / 2,
      top,
      floorAt: (x, z) => {
        const cx = Math.floor(x + s / 2), cz = Math.floor(z + s / 2);
        for (let y = goal.y + 12; y >= 0; y--) if (w.cell(cx, y, cz)) return (y + 1) * LAYER;
        return 0;
      },
    });
  }

  // ---------- 目标判定 ----------
  goalStatus(goal) {
    const w = this.game.world;
    const mine = this.playerBricks();
    switch (goal.type) {
      case 'count':
        return { done: mine.length >= goal.n, text: `放下 ${goal.n} 块积木（${Math.min(mine.length, goal.n)}/${goal.n}）` };
      case 'stars': {
        const got = goal.cells.filter((c) => w.cell(c[0], c[1], c[2])).length;
        return { done: got === goal.cells.length, text: `摘下所有星星（${got}/${goal.cells.length}）` };
      }
      case 'height': {
        let top = 0;
        for (const b of mine) top = Math.max(top, b.y + BRICK_MAP[b.type].h);
        return { done: top >= goal.h, text: `塔高达到金线（${(top / 3).toFixed(1)} / ${goal.h / 3} 块砖高）` };
      }
      case 'connect': {
        const ok = w.connected(this.lockedIds[goal.a], this.lockedIds[goal.b]);
        return { done: ok, text: '把两座桥墩连在一起' };
      }
      case 'replica': {
        const ok = replicaMatch(mine, goal.bricks);
        return { done: ok, text: '搭出和样品一模一样的模型' };
      }
      case 'cover': {
        let miss = 0;
        for (let x = goal.x0; x <= goal.x1; x++)
          for (let z = goal.z0; z <= goal.z1; z++) {
            let c = false;
            for (let y = goal.y; y < goal.y + 30 && !c; y++) if (w.cell(x, y, z)) c = true;
            if (!c) miss++;
          }
        const all = (goal.x1 - goal.x0 + 1) * (goal.z1 - goal.z0 + 1);
        return { done: miss === 0, text: `遮住屋里每一格（${all - miss}/${all}）` };
      }
    }
    return { done: false, text: '' };
  }

  evaluate(initial = false) {
    const g = this.game;
    if (!initial) this.afterChange();
    // 星星收集 / 复原
    for (const s of this.stars) {
      const covered = !!g.world.cell(...s.cell);
      if (covered && !s.covered) {
        if (s.mesh) {
          g.fx.collectStar(s.mesh);
          s.mesh = null;
        }
        if (!initial) g.audio.star();
      } else if (!covered && s.covered) {
        s.mesh = g.fx.makeStar(this.cellCenter(s.cell));
      }
      s.covered = covered;
    }
    const statuses = this.level.goals.map((goal) => this.goalStatus(goal));
    const used = this.playerBricks().length;
    this.renderSide(statuses, used);
    const allDone = statuses.every((s) => s.done);
    if (allDone && !this.done && !initial) {
      this.done = true;
      setTimeout(() => this.complete(used), 500);
    } else if (!allDone) this.done = false;
  }

  starsFor(used) {
    const par = this.level.par;
    if (used <= par) return 3;
    if (used <= par + 2) return 2;
    return 1;
  }

  renderSide(statuses, used) {
    const lv = this.level;
    const g = this.game;
    const st = this.starsFor(used);
    g.hud.setSide(`
      <h3>${lv.name}</h3>
      <p>${lv.desc}</p>
      ${this.replicaThumb ? `<img class="target-img" src="${this.replicaThumb}" alt="样品" />` : ''}
      ${statuses.map((s) => `<div class="goal ${s.done ? 'done' : ''}"><span class="check">${s.done ? '✓' : ''}</span><span>${s.text}</span></div>`).join('')}
      <div class="stat"><span>已用积木</span><b>${used} 块</b></div>
      ${lv.par < 99 ? `<div class="stat"><span>三星目标</span><b>≤ ${lv.par} 块</b></div><div class="stat"><span>当前评价</span><b style="color:#f2a52c">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</b></div>` : ''}
      <div class="tip">💡 ${lv.hint}</div>
      <div class="row wrap"><button class="btn" data-action="reset">重新开始</button><button class="btn ghost" data-action="map">关卡地图</button></div>`);
  }

  async onAction(a) {
    const g = this.game;
    if (a === 'reset') g.startLevel(this.index);
    if (a === 'map') g.chooseMode('level');
  }

  update(dt, t) {
    this.time += dt;
    for (const s of this.stars) if (s.mesh) this.game.fx.updateStar(s.mesh, t);
    if (this.replicaSpin) this.replicaSpin.rotation.y += dt * 0.5;
    if (this.heightPlane) this.heightPlane.material.opacity = 0.06 + 0.04 * Math.sin(t * 2);
  }

  async complete(used) {
    const g = this.game;
    if (g.mode !== this) return;
    const stars = this.starsFor(used);
    const prev = g.progress.levels?.[this.level.id] || 0;
    g.setProgress('levels', this.level.id, Math.max(prev, stars));
    g.audio.success();
    g.fx.confetti(new THREE.Vector3(0, 3, 0), this.level.size * 0.6);
    const hasNext = this.index + 1 < LEVELS.length;
    const r = await g.hud.modal(
      `<div class="center"><h2>过关啦！</h2>
       <div class="result-stars">${[0, 1, 2].map((k) => `<i class="${k < stars ? 'on' : ''}"></i>`).join('')}</div>
       <p>用了 ${used} 块积木${this.level.par < 99 ? `（三星目标 ≤ ${this.level.par} 块）` : ''}</p></div>`,
      [
        { id: 'retry', label: '再玩一次' },
        { id: 'map', label: '关卡地图' },
        ...(hasNext ? [{ id: 'next', label: '下一关 ›', primary: true }] : [{ id: 'map', label: '全部通关！', primary: true }]),
      ],
      { dismiss: false }
    );
    if (g.mode !== this || !r) return;
    if (r === 'retry') g.startLevel(this.index);
    else if (r === 'next') g.startLevel(this.index + 1);
    else g.chooseMode('level');
  }
}

// 形状 + 颜色比对（允许平移和四个方向旋转）
function cellsOf(list) {
  const out = [];
  for (const p of list) for (const c of brickCells(BRICK_MAP[p.type], p.x, p.y, p.z, p.rot)) out.push([c[0], c[1], c[2], p.color]);
  return out;
}
function norm(cells) {
  let mx = Infinity, my = Infinity, mz = Infinity;
  for (const [x, y, z] of cells) {
    mx = Math.min(mx, x);
    my = Math.min(my, y);
    mz = Math.min(mz, z);
  }
  return cells.map(([x, y, z, c]) => `${x - mx},${y - my},${z - mz},${c}`).sort().join('|');
}
export function replicaMatch(playerBricks, target) {
  if (!playerBricks.length) return false;
  const want = norm(cellsOf(target));
  let cells = cellsOf(playerBricks);
  if (cells.length !== want.split('|').length) return false;
  for (let r = 0; r < 4; r++) {
    if (norm(cells) === want) return true;
    cells = cells.map(([x, y, z, c]) => [z, y, -x, c]);
  }
  return false;
}

export { BLUEPRINTS, LEVELS, BRICKS };
