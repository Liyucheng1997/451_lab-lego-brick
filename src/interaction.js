import * as THREE from 'three';
import { BRICK_MAP, LAYER, rotatedDims } from './bricks/catalog.js';
import { getBrickGeometry } from './bricks/geometry.js';
import { COLOR_MAP } from './bricks/materials.js';

// 鼠标 / 触摸 / 键盘交互：射线拾取、幽灵预览、放置与拆除
export class Interaction {
  constructor(game) {
    this.game = game;
    this.canvas = game.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.hasPointer = false;
    this.enabled = false;
    this.tool = 'place';
    this.typeId = 'brick_2x4';
    this.color = 'red';
    this.rot = 0;
    this.placement = null;
    this.hoverBrick = null;
    this.down = null;

    // 幽灵积木
    this.ghostMat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.4 });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
    this.ghost.visible = false;
    this.ghost.renderOrder = 10;
    this.ghost.userData.noAO = true;
    game.scene.add(this.ghost);
    this.ghostEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
    this.ghostEdges.visible = false;
    game.scene.add(this.ghostEdges);
    // 落点投影
    this.footMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false });
    this.foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.footMat);
    this.foot.rotation.x = -Math.PI / 2;
    this.foot.visible = false;
    this.foot.userData.noAO = true;
    game.scene.add(this.foot);
    // 选中高亮框
    this.hl = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ff6b5a', transparent: true, opacity: 1 }));
    this.hl.visible = false;
    game.scene.add(this.hl);
    this.hlFill = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ff6b5a', transparent: true, opacity: 0.18, depthWrite: false }));
    this.hlFill.visible = false;
    this.hlFill.userData.noAO = true;
    game.scene.add(this.hlFill);

    this.setType(this.typeId);
    this.bind();
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      this.setPointer(e);
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) this.down.moved = true;
    });
    c.addEventListener('pointerdown', (e) => {
      this.setPointer(e);
      this.down = { x: e.clientX, y: e.clientY, button: e.button, t: performance.now(), moved: false, pointerType: e.pointerType };
      this.game.audio.ensure();
    });
    c.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || d.moved || performance.now() - d.t > 600) return;
      this.setPointer(e);
      this.update();
      if (!this.enabled) return;
      if (d.button === 2) this.removeAction();
      else if (d.button === 0) this.primary();
    });
    c.addEventListener('pointerleave', () => {
      this.hasPointer = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  setPointer(e) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.hasPointer = true;
  }

  onKey(e) {
    if (!this.enabled) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      e.shiftKey ? this.game.redo() : this.game.undo();
    } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      this.game.redo();
    } else if (k === 'r') this.rotate(e.shiftKey ? -1 : 1);
    else if (k === '1') this.game.setTool('place');
    else if (k === '2') this.game.setTool('remove');
    else if (k === '3') this.game.setTool('paint');
    else if (k === '4') this.game.setTool('pick');
    else if (k === 'f') this.game.resetCamera();
    else if (k === 'q') this.game.cycleBrick(-1);
    else if (k === 'e') this.game.cycleBrick(1);
    else if (k === 'z') this.game.cycleColor(-1);
    else if (k === 'c') this.game.cycleColor(1);
    else if (k === 'h') this.game.togglePhoto();
    else if (k === 'escape') this.game.onEscape();
  }

  rotate(dir = 1) {
    if (this.game.mode?.lockRotate) return;
    this.rot = (this.rot + dir + 4) % 4;
    this.game.audio.rotate();
    this.update();
  }

  setType(typeId) {
    this.typeId = typeId;
    const { geometry } = getBrickGeometry(typeId);
    this.ghost.geometry = geometry;
    const t = BRICK_MAP[typeId];
    const box = new THREE.BoxGeometry(t.w - 0.01, t.h * LAYER + 0.01, t.d - 0.01);
    box.translate(0, (t.h * LAYER) / 2, 0);
    this.ghostEdges.geometry.dispose();
    this.ghostEdges.geometry = new THREE.EdgesGeometry(box);
    this.foot.scale.set(t.w, t.d, 1);
    this.refreshGhostColor(true);
  }
  setColor(c) {
    this.color = c;
    this.refreshGhostColor(true);
  }
  refreshGhostColor(ok) {
    const hex = COLOR_MAP[this.color]?.hex || '#ffffff';
    if (ok) {
      this.ghostMat.color.set(hex);
      this.ghostMat.emissive.set(hex).multiplyScalar(0.25);
      this.ghostMat.opacity = 0.62;
      this.ghostEdges.material.color.set('#ffffff');
      this.footMat.color.set('#fff3dc');
    } else {
      this.ghostMat.color.set('#ff7a6a');
      this.ghostMat.emissive.set('#ff3b2a').multiplyScalar(0.3);
      this.ghostMat.opacity = 0.42;
      this.ghostEdges.material.color.set('#ff5a4a');
      this.footMat.color.set('#ff7a6a');
    }
  }

  // ---------- 每帧：更新悬停 ----------
  update() {
    const g = this.game;
    this.ghost.visible = this.ghostEdges.visible = this.foot.visible = false;
    this.hl.visible = this.hlFill.visible = false;
    this.placement = null;
    this.hoverBrick = null;
    if (!this.enabled || !this.hasPointer || (this.down && this.down.moved)) return;

    this.raycaster.setFromCamera(this.pointer, g.camera);
    const targets = [...g.world.proxies(), g.world.baseBody, ...(g.mode?.extraTargets?.() || [])];
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits[0];
    if (!hit) return;
    const brick = hit.object.userData.brickId ? g.world.bricks.get(hit.object.userData.brickId) : null;

    if (this.tool === 'place') {
      let p = hit.object.userData.target ? { ...hit.object.userData.target } : this.computePlacement(hit, brick);
      if (!p) return;
      if (g.mode?.adjustPlacement) p = g.mode.adjustPlacement(p, hit) || p;
      const res = g.world.check(p.type, p.x, p.y, p.z, p.rot);
      const modeRes = res.ok && g.mode?.validate ? g.mode.validate(p) : res;
      p.ok = res.ok && modeRes.ok;
      p.reason = res.ok ? modeRes.reason : res.reason;
      this.placement = p;
      if (p.type !== this.typeId) this.setType(p.type);
      const t = BRICK_MAP[p.type];
      g.world.brickPosition(t, p.x, p.y, p.z, p.rot, this.ghost.position);
      this.ghost.rotation.y = (p.rot * Math.PI) / 2;
      this.ghostEdges.position.copy(this.ghost.position);
      this.ghostEdges.rotation.y = this.ghost.rotation.y;
      this.refreshGhostColor(p.ok);
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      this.ghostMat.opacity = (p.ok ? 0.5 : 0.35) + pulse * 0.15;
      this.ghost.visible = this.ghostEdges.visible = true;
      // 底部投影：找到正下方的支撑面
      const [W, D] = rotatedDims(t, p.rot);
      this.foot.scale.set(W, D, 1);
      this.foot.position.set(this.ghost.position.x, this.groundBelow(p, W, D) + 0.03, this.ghost.position.z);
      this.foot.visible = p.y > 0;
    } else if (brick) {
      this.hoverBrick = brick;
      const t = BRICK_MAP[brick.type];
      const [W, D] = rotatedDims(t, brick.rot);
      const H = t.h * LAYER;
      const box = new THREE.BoxGeometry(W + 0.06, H + 0.06, D + 0.06);
      this.hl.geometry.dispose();
      this.hl.geometry = new THREE.EdgesGeometry(box);
      box.dispose();
      this.hl.position.copy(brick.mesh.position);
      this.hl.position.y += H / 2;
      this.hlFill.scale.set(W + 0.05, H + 0.05, D + 0.05);
      this.hlFill.position.copy(this.hl.position);
      const col = this.tool === 'remove' ? (brick.locked ? '#999999' : '#ff5a4a') : this.tool === 'paint' ? COLOR_MAP[this.color].hex : '#6fb6ff';
      this.hl.material.color.set(col);
      this.hlFill.material.color.set(col);
      this.hl.visible = this.hlFill.visible = true;
    }
  }

  groundBelow(p, W, D) {
    const w = this.game.world;
    let best = 0;
    for (let x = p.x; x < p.x + W; x++)
      for (let z = p.z; z < p.z + D; z++)
        for (let y = p.y - 1; y >= 0; y--) {
          if (w.cell(x, y, z)) {
            best = Math.max(best, (y + 1) * LAYER);
            break;
          }
        }
    return best;
  }

  computePlacement(hit, brick) {
    const w = this.game.world;
    const t = BRICK_MAP[this.typeId];
    const rot = this.rot;
    const [W, D] = rotatedDims(t, rot);
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const p = hit.point.clone().addScaledVector(n, 0.03);
    const [cx, cy, cz] = w.worldToCell(p);
    let x0, y0, z0;
    const cxW = cx - Math.floor((W - 1) / 2);
    const czD = cz - Math.floor((D - 1) / 2);
    if (n.y > 0.5) {
      y0 = cy;
      x0 = cxW;
      z0 = czD;
    } else if (n.y < -0.5) {
      y0 = cy - t.h + 1;
      x0 = cxW;
      z0 = czD;
    } else {
      y0 = brick ? brick.y : 0;
      if (Math.abs(n.x) > Math.abs(n.z)) {
        x0 = n.x > 0 ? cx : cx - W + 1;
        z0 = czD;
      } else {
        z0 = n.z > 0 ? cz : cz - D + 1;
        x0 = cxW;
      }
    }
    x0 = Math.max(0, Math.min(w.size - W, x0));
    z0 = Math.max(0, Math.min(w.size - D, z0));
    y0 = Math.max(0, y0);
    // 顶面落点被占用时自动往上找空位
    if (n.y > 0.5) {
      for (let i = 0; i < 60; i++) {
        const r = w.check(this.typeId, x0, y0, z0, rot);
        if (r.reason === 'collide') y0++;
        else break;
      }
    }
    return { type: this.typeId, color: this.color, x: x0, y: y0, z: z0, rot };
  }

  primary() {
    const g = this.game;
    if (this.tool === 'place') {
      const p = this.placement;
      if (!p) return;
      if (!p.ok) {
        g.audio.error();
        g.toast(reasonText(p.reason));
        return;
      }
      g.placeBrick(p);
    } else if (this.tool === 'remove') this.removeAction();
    else if (this.tool === 'paint' && this.hoverBrick) g.paintBrick(this.hoverBrick, this.color);
    else if (this.tool === 'pick' && this.hoverBrick) g.pickBrick(this.hoverBrick);
  }

  removeAction() {
    const g = this.game;
    let b = this.hoverBrick;
    if (!b) {
      // 放置工具下右键：拾取鼠标下的积木
      this.raycaster.setFromCamera(this.pointer, g.camera);
      const hit = this.raycaster.intersectObjects(g.world.proxies(), false)[0];
      if (hit) b = g.world.bricks.get(hit.object.userData.brickId);
    }
    if (b) g.removeBrick(b);
  }
}

export function reasonText(r) {
  return (
    {
      collide: '这里已经有积木啦',
      float: '积木需要扣在凸点上，不能悬空哦',
      bounds: '超出底板范围了',
      water: '水里放不了积木',
      inventory: '这种积木用完啦',
      wrong: '请照着图纸，放到闪烁的位置',
      locked: '这块是关卡自带的，不能动',
    }[r] || '这里放不下'
  );
}
