import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER, BRICK_MAP } from './catalog.js';

// 真实积木比例（以 8mm 凸点间距为 1）
export const GAP = 0.012;      // 每侧留缝 0.1mm
const BS = 0.022;              // 倒角
const BT = 0.022;
const WALL = 0.15;             // 侧壁厚 1.2mm
const TOP_T = 0.13;            // 顶板厚
export const STUD_R = 0.3;     // 凸点直径 4.8mm
export const STUD_H = 0.2;     // 凸点高 1.7mm

// ---------- 工具 ----------
function rrPath(w, d, r, target) {
  const p = target || new THREE.Path();
  const x0 = -w / 2, x1 = w / 2, y0 = -d / 2, y1 = d / 2;
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x1, y1 - r);
  p.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  p.lineTo(x0 + r, y1);
  p.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, y0 + r);
  p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}
const rrShape = (w, d, r) => rrPath(w, d, r, new THREE.Shape());

// 将平面形状竖直挤出（形状 x→x，形状 y→-z），高度 [0, height]
function extrudeUp(shape, height, bs = BS, bt = BT) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, height - 2 * bt),
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bs,
    bevelSegments: 3,
    curveSegments: 4,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bt, 0);
  return g;
}

// 沿 z 方向挤出（形状 x→x，形状 y→y），z ∈ [-depth/2, depth/2]
function extrudeZ(shape, depth, curveSegments = 6) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.002, depth - 2 * BT),
    bevelEnabled: true,
    bevelThickness: BT,
    bevelSize: BS,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, -depth / 2 + BT);
  return g;
}

function insetPolygon(pts, off) {
  const n = pts.length;
  const lines = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    let dx = q[0] - p[0], dy = q[1] - p[1];
    const L = Math.hypot(dx, dy);
    dx /= L; dy /= L;
    lines.push({ px: p[0] - dy * off, py: p[1] + dx * off, dx, dy });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = lines[(i - 1 + n) % n], b = lines[i];
    const den = a.dx * b.dy - a.dy * b.dx;
    const s = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / den;
    out.push([a.px + a.dx * s, a.py + a.dy * s]);
  }
  return out;
}

// 统一清理：去掉 uv、焊接顶点、按面积加权重新计算法线（让小倒角显得圆润）
function finalize(g) {
  g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  g.clearGroups();
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

// 保留原法线（用于盒子、圆柱等有硬边的零件）
function clean(g) {
  g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  g.clearGroups();
  return g.index ? g : mergeVertices(g, 1e-6);
}

function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

let studProto = null;
export function studGeometry(r = STUD_R, h = STUD_H, segments = 24) {
  const b = 0.035;
  return finalize(
    lathe(
      [
        [r, -0.02],
        [r, h - b],
        [r - b * 0.3, h - b * 0.3],
        [r - b, h],
        [0, h],
      ],
      segments
    )
  );
}
function stud(x, y, z, r, h) {
  if (!r && !studProto) studProto = studGeometry();
  const g = r ? studGeometry(r, h || STUD_H) : studProto.clone();
  g.translate(x, y, z);
  return g;
}

function tube(x, z, height) {
  const ro = 0.4, ri = 0.3, b = 0.015;
  const g = finalize(
    lathe(
      [
        [ri, height],
        [ri, b],
        [ri + b, 0],
        [ro - b, 0],
        [ro, b],
        [ro, height],
      ],
      20
    )
  );
  g.translate(x, 0, z);
  return g;
}
function pin(x, z, height) {
  const r = 0.16, b = 0.015;
  const g = finalize(lathe([[0, 0], [r - b, 0], [r, b], [r, height]], 14));
  g.translate(x, 0, z);
  return g;
}

// ---------- 各类零件 ----------
function hollowBody(w, d, h, parts, withStuds) {
  const W = w - 2 * GAP, D = d - 2 * GAP, H = h * LAYER;
  const rc = 0.02;
  const shell = rrShape(W - 2 * BS, D - 2 * BS, rc);
  shell.holes.push(rrPath(W - 2 * WALL + 2 * BS, D - 2 * WALL + 2 * BS, 0.01));
  parts.push(finalize(extrudeUp(shell, H)));
  const cap = finalize(extrudeUp(rrShape(W - 2 * BS, D - 2 * BS, rc), TOP_T));
  cap.translate(0, H - TOP_T, 0);
  parts.push(cap);
  const inner = H - TOP_T + 0.01;
  if (w >= 2 && d >= 2) {
    for (let i = 1; i < w; i++) for (let j = 1; j < d; j++) parts.push(tube(i - w / 2, j - d / 2, inner));
  } else if (w === 1 && d >= 2) {
    for (let j = 1; j < d; j++) parts.push(pin(0, j - d / 2, inner));
  } else if (d === 1 && w >= 2) {
    for (let i = 1; i < w; i++) parts.push(pin(i - w / 2, 0, inner));
  }
  if (withStuds) {
    for (let i = 0; i < w; i++)
      for (let j = 0; j < d; j++) parts.push(stud(i + 0.5 - w / 2, H, j + 0.5 - d / 2));
  }
}

function slopeParts(t, parts) {
  const W = t.w - 2 * GAP, D = t.d - 2 * GAP, H = t.h * LAYER, LIP = 0.16;
  const zf = -D / 2, zb = D / 2, zt = t.d / 2 - 1;
  const poly = insetPolygon([[zf, 0], [zb, 0], [zb, H], [zt, H], [zf, LIP]], BS);
  const shape = new THREE.Shape(poly.map(([z, y]) => new THREE.Vector2(-z, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: W - 2 * BT,
    bevelEnabled: true,
    bevelThickness: BT,
    bevelSize: BS,
    bevelSegments: 3,
  });
  g.rotateY(Math.PI / 2);
  g.translate(-W / 2 + BT, 0, 0);
  parts.push(finalize(g));
  for (let i = 0; i < t.w; i++) parts.push(stud(i + 0.5 - t.w / 2, H, t.d / 2 - 0.5));
}

function roundParts(t, parts) {
  const H = t.h * LAYER;
  const b = 0.025;
  let pts;
  if (t.kind === 'cone') {
    pts = [[0, 0], [0.46, 0], [0.48, 0.02], [0.48, 0.12], [0.29, H - 0.015], [0.27, H], [0, H]];
    parts.push(finalize(lathe(pts, 32)));
    parts.push(stud(0, H, 0, 0.21, 0.16));
    return;
  }
  if (t.kind === 'dome') {
    const R = 0.98 - GAP;
    pts = [[0, 0], [R - b, 0], [R, b], [R, 0.3]];
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI / 2;
      pts.push([R * Math.cos(a), 0.3 + (H - 0.3) * Math.sin(a)]);
    }
    pts[pts.length - 1][0] = 0;
    parts.push(finalize(lathe(pts, 40)));
    return;
  }
  if (t.w === 1) {
    const R = 0.48 - GAP;
    if (t.kind === 'roundplate') {
      pts = [[0, 0], [R - b, 0], [R, b], [R, H - b], [R - b, H], [0, H]];
    } else {
      pts = [[0, 0], [0.39, 0], [0.4, 0.01], [0.4, 0.3], [R - 0.02, 0.3], [R, 0.32], [R, H - b], [R - b, H], [0, H]];
    }
    parts.push(finalize(lathe(pts, 32)));
    parts.push(stud(0, H, 0));
  } else {
    const R = 0.98 - GAP;
    pts = [[0, 0], [0.85, 0], [0.86, 0.01], [0.86, 0.25], [R - 0.02, 0.25], [R, 0.27], [R, H - b], [R - b, H], [0, H]];
    parts.push(finalize(lathe(pts, 44)));
    for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) parts.push(stud(x, H, z));
  }
}

function archParts(t, parts) {
  const H = t.h * LAYER;
  const A = 2 - GAP - BS;
  const a = 0.9 + BS;
  const ys = 0.22;
  const ry = 0.72 - ys + BS;
  const s = new THREE.Shape();
  s.moveTo(-A, BS);
  s.lineTo(-a, BS);
  s.lineTo(-a, ys);
  const N = 18;
  for (let i = 1; i < N; i++) {
    const ang = Math.PI - (Math.PI * i) / N;
    s.lineTo(a * Math.cos(ang), ys + ry * Math.sin(ang));
  }
  s.lineTo(a, ys);
  s.lineTo(a, BS);
  s.lineTo(A, BS);
  s.lineTo(A, H - BS);
  s.lineTo(-A, H - BS);
  s.lineTo(-A, BS);
  parts.push(finalize(extrudeZ(s, 1 - 2 * GAP)));
  for (let i = 0; i < 4; i++) parts.push(stud(i + 0.5 - 2, H, 0));
}

function frameShape(H, innerHalf, innerBottom, innerTop) {
  const A = 1 - GAP - BS;
  const s = new THREE.Shape();
  if (innerBottom <= 0) {
    const i = innerHalf + BS;
    s.moveTo(-A, BS);
    s.lineTo(-i, BS);
    s.lineTo(-i, innerTop + BS);
    s.lineTo(i, innerTop + BS);
    s.lineTo(i, BS);
    s.lineTo(A, BS);
    s.lineTo(A, H - BS);
    s.lineTo(-A, H - BS);
    s.lineTo(-A, BS);
  } else {
    s.moveTo(-A, BS);
    s.lineTo(A, BS);
    s.lineTo(A, H - BS);
    s.lineTo(-A, H - BS);
    s.lineTo(-A, BS);
    const h = new THREE.Path();
    const i = innerHalf + BS;
    h.moveTo(-i, innerBottom - BS);
    h.lineTo(-i, innerTop + BS);
    h.lineTo(i, innerTop + BS);
    h.lineTo(i, innerBottom - BS);
    h.lineTo(-i, innerBottom - BS);
    s.holes.push(h);
  }
  return s;
}

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return clean(g);
}

function windowParts(t, parts, extra) {
  const H = t.h * LAYER;
  parts.push(finalize(extrudeZ(frameShape(H, 0.8, 0.24, H - 0.24), 1 - 2 * GAP)));
  // 窗格横竖条
  parts.push(box(0.07, H - 0.46, 0.14, 0, H / 2, 0));
  parts.push(box(1.6, 0.07, 0.14, 0, H / 2, 0));
  // 窗台
  parts.push(finalize(extrudeUp(rrShape(1.9, 0.16, 0.02), 0.08)).translate(0, 0.16, 0.41));
  for (let i = 0; i < 2; i++) parts.push(stud(i + 0.5 - 1, H, 0));
  extra.glass = [box(1.62, H - 0.46, 0.04, 0, H / 2, 0)];
}

function doorParts(t, parts, extra) {
  const H = t.h * LAYER;
  parts.push(finalize(extrudeZ(frameShape(H, 0.8, 0, H - 0.2), 1 - 2 * GAP)));
  for (let i = 0; i < 2; i++) parts.push(stud(i + 0.5 - 1, H, 0));
  const wood = [box(1.58, H - 0.21, 0.16, 0, (H - 0.2) / 2, 0)];
  // 门板浮雕
  for (const [x, y, h] of [[-0.38, 0.95, 1.3], [0.38, 0.95, 1.3], [-0.38, 2.45, 1.3], [0.38, 2.45, 1.3]]) {
    wood.push(box(0.6, h, 0.05, x, y, 0.09));
    wood.push(box(0.6, h, 0.05, x, y, -0.09));
  }
  extra.wood = wood;
  const knob = new THREE.SphereGeometry(0.075, 16, 12);
  knob.translate(0.58, 1.65, 0.16);
  const knob2 = new THREE.SphereGeometry(0.075, 16, 12);
  knob2.translate(0.58, 1.65, -0.16);
  extra.gold = [clean(knob), clean(knob2)];
}

function wheelParts(t, parts, extra) {
  const H = t.h * LAYER;
  const holder = finalize(extrudeUp(rrShape(2.0 - 2 * BS, 1.7 - 2 * BS, 0.04), H - 0.36));
  holder.translate(0, 0.36, 0);
  parts.push(holder);
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) parts.push(stud(x, H, z));
  const rubber = [], hub = [];
  // 轮胎：带花纹的回转体
  const tp = [[0.34, -0.44], [0.5, -0.44], [0.56, -0.4]];
  for (let i = 0; i <= 6; i++) {
    const y = -0.36 + (i * 0.72) / 6;
    tp.push([i % 2 === 0 ? 0.585 : 0.565, y]);
  }
  tp.push([0.56, 0.4], [0.5, 0.44], [0.34, 0.44]);
  const hp = [[0, -0.43], [0.2, -0.43], [0.22, -0.4], [0.3, -0.4], [0.35, -0.36], [0.35, 0.36], [0.3, 0.4], [0.22, 0.4], [0.2, 0.43], [0, 0.43]];
  for (const sx of [-1.5, 1.5]) {
    const tire = finalize(lathe(tp, 36));
    tire.rotateZ(Math.PI / 2);
    tire.translate(sx, 0.6, 0);
    rubber.push(tire);
    const h = finalize(lathe(hp, 28));
    h.rotateZ(Math.PI / 2);
    h.translate(sx, 0.6, 0);
    hub.push(h);
  }
  const axle = new THREE.CylinderGeometry(0.1, 0.1, 2.4, 12);
  axle.rotateZ(Math.PI / 2);
  axle.translate(0, 0.6, 0);
  hub.push(clean(axle));
  extra.rubber = rubber;
  extra.hub = hub;
}

function ellipsoid(rx, ry, rz, x, y, z, rotY = 0, rotZ = 0) {
  const g = new THREE.SphereGeometry(1, 16, 10);
  g.scale(rx, ry, rz);
  g.rotateZ(rotZ);
  g.rotateY(rotY);
  g.translate(x, y, z);
  return clean(g);
}

function flowerParts(t, parts, extra) {
  const leaf = [];
  const R = 0.46;
  leaf.push(finalize(lathe([[0, 0], [R - 0.02, 0], [R, 0.02], [R, 0.3], [R - 0.02, 0.32], [0, 0.32]], 28)));
  const stem = new THREE.CylinderGeometry(0.045, 0.055, 0.66, 10);
  stem.translate(0, 0.62, 0);
  leaf.push(clean(stem));
  leaf.push(ellipsoid(0.2, 0.035, 0.09, 0.17, 0.62, 0, 0, 0.5));
  leaf.push(ellipsoid(0.2, 0.035, 0.09, -0.17, 0.72, 0, 0.3, -0.5));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(ellipsoid(0.17, 0.05, 0.1, Math.cos(a) * 0.17, 1.0, Math.sin(a) * 0.17, -a, 0.18));
  }
  const c = new THREE.SphereGeometry(0.095, 16, 12);
  c.scale(1, 0.75, 1);
  c.translate(0, 1.04, 0);
  extra.leaf = leaf;
  extra.pollen = [clean(c)];
}

function noiseBlob(r, x, y, z, seed) {
  const g = new THREE.IcosahedronGeometry(r, 3);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const k =
      1 +
      0.07 * Math.sin(n.x * 5.1 + seed) * Math.cos(n.y * 4.3 + seed * 2) +
      0.05 * Math.sin(n.z * 7.7 + n.x * 3.1 + seed * 3);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(x, y, z);
  return finalize(g);
}

function treeParts(t, parts, extra) {
  const leaf = [];
  const base = [];
  hollowBody(2, 2, 1, base, false);
  const trunk = new THREE.CylinderGeometry(0.2, 0.27, 1.5, 14);
  trunk.translate(0, 1.1, 0);
  extra.wood = [clean(trunk)];
  extra.leaf = base;
  parts.push(noiseBlob(0.88, 0, 2.15, 0, 1.3));
  parts.push(noiseBlob(0.62, 0.22, 2.9, -0.12, 2.1));
  parts.push(noiseBlob(0.55, -0.3, 2.65, 0.3, 3.7));
  void leaf;
}

// ---------- 对外接口 ----------
const cache = new Map();

/** 返回 { geometry, matKeys }，geometry 的 groups 与 matKeys 一一对应 */
export function getBrickGeometry(typeId) {
  if (cache.has(typeId)) return cache.get(typeId);
  const t = BRICK_MAP[typeId];
  const parts = [];
  const extra = {};
  switch (t.kind) {
    case 'brick':
      hollowBody(t.w, t.d, t.h, parts, true);
      break;
    case 'tile':
      hollowBody(t.w, t.d, t.h, parts, false);
      break;
    case 'slope':
      slopeParts(t, parts);
      break;
    case 'round':
    case 'roundplate':
    case 'cone':
    case 'dome':
      roundParts(t, parts);
      break;
    case 'arch':
      archParts(t, parts);
      break;
    case 'window':
      windowParts(t, parts, extra);
      break;
    case 'door':
      doorParts(t, parts, extra);
      break;
    case 'wheel':
      wheelParts(t, parts, extra);
      break;
    case 'flower':
      flowerParts(t, parts, extra);
      break;
    case 'tree':
      treeParts(t, parts, extra);
      break;
  }
  const buckets = [['color', parts], ...Object.entries(extra)].filter(([, arr]) => arr.length);
  const merged = buckets.map(([, arr]) => mergeGeometries(arr, false));
  const geometry = mergeGeometries(merged, true);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  const res = { geometry, matKeys: buckets.map(([k]) => k) };
  cache.set(typeId, res);
  return res;
}

export { extrudeUp, rrShape, finalize, lathe };
