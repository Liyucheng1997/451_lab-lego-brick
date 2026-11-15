import * as THREE from 'three';
import { BRICK_MAP, LAYER, brickCells, brickStudCells, rotatedDims } from './bricks/catalog.js';
import { getBrickGeometry, studGeometry, extrudeUp, rrShape } from './bricks/geometry.js';
import { materialsFor, isTrans } from './bricks/materials.js';

const MAX_LAYER = 160;
const key = (x, y, z) => y * 1000000 + z * 1000 + x;

export class BrickWorld {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'bricks';
    scene.add(this.group);
    this.baseGroup = new THREE.Group();
    scene.add(this.baseGroup);
    this.bricks = new Map();
    this.occ = new Map();
    this.nextId = 1;
    this.size = 32;
    this.water = []; // [{x,z,w,d}] 不可放置在地面的区域
    this.waterSet = new Set();
    this.history = [];
    this.future = [];
    this.listeners = new Set();
    this.anims = [];
    this.baseColor = '#7fae6a';
    this.waterTime = 0;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(ev) {
    for (const fn of this.listeners) fn(ev);
  }

  // ---------- 底板 ----------
  setBase(size = 32, color = '#7fae6a', water = []) {
    this.size = size;
    this.baseColor = color;
    this.water = water;
    this.waterSet = new Set();
    for (const r of water)
      for (let x = r.x; x < r.x + r.w; x++) for (let z = r.z; z < r.z + r.d; z++) this.waterSet.add(z * 1000 + x);
    for (const c of [...this.baseGroup.children]) {
      this.baseGroup.remove(c);
      c.geometry?.dispose();
    }
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.3 });
    const body = new THREE.Mesh(extrudeUp(rrShape(size - 0.06, size - 0.06, 0.25), 0.2, 0.02, 0.02), mat);
    body.position.y = -0.2;
    body.receiveShadow = true;
    body.castShadow = true;
    body.name = 'baseplate';
    this.baseGroup.add(body);
    this.baseBody = body;

    const studs = [];
    for (let x = 0; x < size; x++)
      for (let z = 0; z < size; z++) if (!this.waterSet.has(z * 1000 + x)) studs.push([x, z]);
    const inst = new THREE.InstancedMesh(studGeometry(0.3, 0.2, 18), mat, studs.length);
    const m = new THREE.Matrix4();
    studs.forEach(([x, z], i) => {
      m.makeTranslation(x + 0.5 - size / 2, 0, z + 0.5 - size / 2);
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    this.baseGroup.add(inst);

    if (water.length) {
      const wmat = makeWaterMaterial();
      this.waterMat = wmat;
      for (const r of water) {
        const g = new THREE.BoxGeometry(r.w, 0.16, r.d);
        const wm = new THREE.Mesh(g, wmat);
        wm.position.set(r.x + r.w / 2 - size / 2, 0.06, r.z + r.d / 2 - size / 2);
        wm.receiveShadow = true;
        this.baseGroup.add(wm);
      }
    } else this.waterMat = null;
  }

  // ---------- 坐标 ----------
  brickPosition(t, x, y, z, rot, out = new THREE.Vector3()) {
    const [W, D] = rotatedDims(t, rot);
    return out.set(x + W / 2 - this.size / 2, y * LAYER, z + D / 2 - this.size / 2);
  }
  worldToCell(p) {
    return [Math.floor(p.x + this.size / 2), Math.floor(p.y / LAYER + 1e-4), Math.floor(p.z + this.size / 2)];
  }

  cell(x, y, z) {
    return this.occ.get(key(x, y, z));
  }

  // ---------- 放置检查 ----------
  check(typeId, x, y, z, rot) {
    const t = BRICK_MAP[typeId];
    const cells = brickCells(t, x, y, z, rot);
    const set = new Set(cells.map(([a, b, c]) => key(a, b, c)));
    for (const [a, b, c] of cells) {
      if (a < 0 || c < 0 || a >= this.size || c >= this.size || b < 0 || b >= MAX_LAYER) return { ok: false, reason: 'bounds' };
      if (this.occ.has(key(a, b, c))) return { ok: false, reason: 'collide' };
      if (b === 0 && this.waterSet.has(c * 1000 + a)) return { ok: false, reason: 'water' };
    }
    let supported = false;
    for (const [a, b, c] of cells) {
      if (set.has(key(a, b - 1, c))) continue;
      if (b === 0) { supported = true; break; }
      const below = this.occ.get(key(a, b - 1, c));
      if (below && below.stud) { supported = true; break; }
    }
    if (!supported) {
      for (const [a, b, c] of brickStudCells(t, x, y, z, rot)) {
        if (this.occ.has(key(a, b + 1, c))) { supported = true; break; }
      }
    }
    if (!supported) return { ok: false, reason: 'float' };
    return { ok: true };
  }

  // ---------- 增删改 ----------
  add(data, opts = {}) {
    const t = BRICK_MAP[data.type];
    if (!t) return null;
    const id = data.id ?? this.nextId++;
    if (id >= this.nextId) this.nextId = id + 1;
    const cells = brickCells(t, data.x, data.y, data.z, data.rot);
    const studKeys = new Set(brickStudCells(t, data.x, data.y, data.z, data.rot).map(([a, b, c]) => key(a, b, c)));
    const { geometry, matKeys } = getBrickGeometry(t.id);
    const mesh = new THREE.Mesh(geometry, materialsFor(matKeys, data.color));
    this.brickPosition(t, data.x, data.y, data.z, data.rot, mesh.position);
    mesh.rotation.y = (data.rot * Math.PI) / 2;
    mesh.castShadow = !isTrans(data.color);
    mesh.receiveShadow = true;
    mesh.userData.brickId = id;
    this.group.add(mesh);

    const [W, D] = rotatedDims(t, data.rot);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, t.h * LAYER, D - 0.02));
    proxy.position.copy(mesh.position);
    proxy.position.y += (t.h * LAYER) / 2;
    proxy.updateMatrixWorld(true);
    proxy.userData.brickId = id;

    const brick = { id, type: t.id, color: data.color, x: data.x, y: data.y, z: data.z, rot: data.rot, locked: !!data.locked, mesh, proxy, cells };
    for (const [a, b, c] of cells) {
      const k = key(a, b, c);
      this.occ.set(k, { id, stud: studKeys.has(k) });
    }
    this.bricks.set(id, brick);
    if (opts.animate) this.animateIn(mesh);
    if (opts.record) this.record({ op: 'add', data: this.dataOf(brick) });
    if (!opts.silent) this.emit({ type: 'add', brick });
    return brick;
  }

  remove(id, opts = {}) {
    const b = this.bricks.get(id);
    if (!b) return null;
    for (const [a, y, c] of b.cells) this.occ.delete(key(a, y, c));
    this.bricks.delete(id);
    b.proxy.geometry.dispose();
    if (opts.animate) this.animateOut(b.mesh);
    else this.group.remove(b.mesh);
    if (opts.record) this.record({ op: 'remove', data: this.dataOf(b) });
    if (!opts.silent) this.emit({ type: 'remove', brick: b });
    return b;
  }

  paint(id, color, opts = {}) {
    const b = this.bricks.get(id);
    if (!b || b.color === color) return;
    const from = b.color;
    b.color = color;
    const { matKeys } = getBrickGeometry(b.type);
    b.mesh.material = materialsFor(matKeys, color);
    b.mesh.castShadow = !isTrans(color);
    this.pulse(b.mesh);
    if (opts.record) this.record({ op: 'paint', id, from, to: color });
    if (!opts.silent) this.emit({ type: 'paint', brick: b });
  }

  dataOf(b) {
    return { id: b.id, type: b.type, color: b.color, x: b.x, y: b.y, z: b.z, rot: b.rot, locked: b.locked || undefined };
  }

  clear() {
    for (const id of [...this.bricks.keys()]) this.remove(id, { silent: true });
    for (const a of this.anims) if (a.out) this.group.remove(a.mesh);
    this.anims = [];
    this.history = [];
    this.future = [];
    this.nextId = 1;
    this.emit({ type: 'clear' });
  }

  serialize() {
    return [...this.bricks.values()].map((b) => {
      const d = this.dataOf(b);
      delete d.id;
      return d;
    });
  }
  load(list, opts = {}) {
    for (const d of list) this.add({ ...d, id: undefined }, { silent: true, ...opts });
    this.emit({ type: 'load' });
  }

  // ---------- 撤销 / 重做 ----------
  record(action) {
    this.history.push(action);
    if (this.history.length > 300) this.history.shift();
    this.future = [];
  }
  undo() {
    const a = this.history.pop();
    if (!a) return false;
    this.applyInverse(a);
    this.future.push(a);
    return true;
  }
  redo() {
    const a = this.future.pop();
    if (!a) return false;
    this.apply(a);
    this.history.push(a);
    return true;
  }
  apply(a) {
    if (a.op === 'add') this.add(a.data, { animate: true });
    else if (a.op === 'remove') this.remove(a.data.id, { animate: true });
    else if (a.op === 'paint') this.paint(a.id, a.to);
  }
  applyInverse(a) {
    if (a.op === 'add') this.remove(a.data.id, { animate: true });
    else if (a.op === 'remove') this.add(a.data, { animate: true });
    else if (a.op === 'paint') this.paint(a.id, a.from);
  }

  // ---------- 拾取 ----------
  proxies() {
    const out = [];
    for (const b of this.bricks.values()) out.push(b.proxy);
    return out;
  }

  // ---------- 动画 ----------
  animateIn(mesh) {
    this.anims.push({ mesh, t: 0, dur: 0.22, y0: mesh.position.y, in: true });
    mesh.position.y += 0.7;
    mesh.scale.setScalar(1);
  }
  animateOut(mesh) {
    this.anims.push({ mesh, t: 0, dur: 0.22, y0: mesh.position.y, out: true });
  }
  pulse(mesh) {
    this.anims.push({ mesh, t: 0, dur: 0.25, pulse: true });
  }
  update(dt) {
    this.waterTime += dt;
    if (this.waterMat) this.waterMat.userData.update?.(this.waterTime);
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      if (a.in) {
        // 下落并轻微回弹
        const e = 1 - Math.pow(1 - k, 3);
        a.mesh.position.y = a.y0 + 0.7 * (1 - e);
        const sq = k > 0.75 ? Math.sin(((k - 0.75) / 0.25) * Math.PI) * 0.06 : 0;
        a.mesh.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      } else if (a.out) {
        const e = k * k;
        a.mesh.position.y = a.y0 + e * 0.6;
        a.mesh.scale.setScalar(Math.max(0.001, 1 - e));
        if (k >= 1) this.group.remove(a.mesh);
      } else if (a.pulse) {
        const s = 1 + Math.sin(k * Math.PI) * 0.06;
        a.mesh.scale.setScalar(s);
      }
      if (k >= 1) {
        if (!a.out) {
          a.mesh.scale.setScalar(1);
          if (a.in) a.mesh.position.y = a.y0;
        }
        this.anims.splice(i, 1);
      }
    }
  }

  // ---------- 连通性（闯关用）----------
  // 两块积木若存在上下相邻格子则视为相扣
  neighbors(b) {
    const out = new Set();
    for (const [x, y, z] of b.cells) {
      for (const dy of [-1, 1]) {
        const o = this.occ.get(key(x, y + dy, z));
        if (o && o.id !== b.id) out.add(o.id);
      }
    }
    return out;
  }
  connected(idA, idB) {
    if (idA === idB) return true;
    const seen = new Set([idA]);
    const q = [idA];
    while (q.length) {
      const id = q.shift();
      const b = this.bricks.get(id);
      if (!b) continue;
      for (const n of this.neighbors(b)) {
        if (n === idB) return true;
        if (!seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
      }
    }
    return false;
  }
}

function makeWaterMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#5aa9d6',
    roughness: 0.18,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const uniforms = { uTime: { value: 0 } };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWPos;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float w1 = sin(vWPos.x*2.1 + uTime*1.6) * cos(vWPos.z*1.7 - uTime*1.2);
        float w2 = sin(vWPos.x*3.7 - vWPos.z*2.9 + uTime*2.3);
        normal = normalize(normal + vec3(w1*0.06 + w2*0.025, 0.0, w2*0.05 - w1*0.02));`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float glint = smoothstep(0.93, 1.0, sin(vWPos.x*2.7+uTime*1.3)*sin(vWPos.z*2.3-uTime*1.1));
        diffuseColor.rgb += glint*0.07;`
      );
  };
  m.userData.update = (t) => (uniforms.uTime.value = t);
  return m;
}
