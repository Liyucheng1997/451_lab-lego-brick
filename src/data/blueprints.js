// 建造模式的图纸。坐标为模型内的局部格坐标（x/z 凸点，y 薄板层）
const b = (type, color, x, y, z, rot = 0) => ({ type, color, x, y, z, rot });

function chunk(len) {
  if (len <= 4) return [len];
  if (len === 5) return [3, 2];
  return [4, ...chunk(len - 4)];
}

// 交错砌一圈墙
function wallRing(out, x0, z0, W, D, y, layer, color, skip = () => false) {
  const runs = [];
  const even = layer % 2 === 0;
  const xr = even ? [x0, x0 + W - 1] : [x0 + 1, x0 + W - 2];
  const zr = even ? [z0 + 1, z0 + D - 2] : [z0, z0 + D - 1];
  for (const z of [z0, z0 + D - 1]) runs.push({ axis: 'x', fixed: z, from: xr[0], to: xr[1] });
  for (const x of [x0, x0 + W - 1]) runs.push({ axis: 'z', fixed: x, from: zr[0], to: zr[1] });
  for (const r of runs) {
    let seg = [];
    const flush = () => {
      let p = seg[0];
      for (const n of chunk(seg.length)) {
        const type = `brick_1x${n}`;
        if (r.axis === 'x') out.push(b(type, typeof color === 'function' ? color(p, layer) : color, p, y, r.fixed, n > 1 ? 1 : 0));
        else out.push(b(type, typeof color === 'function' ? color(p, layer) : color, r.fixed, y, p, 0));
        p += n;
      }
      seg = [];
    };
    for (let p = r.from; p <= r.to; p++) {
      const [x, z] = r.axis === 'x' ? [p, r.fixed] : [r.fixed, p];
      if (skip(x, z, layer)) {
        if (seg.length) flush();
      } else seg.push(p);
    }
    if (seg.length) flush();
  }
}

function duck() {
  const o = [];
  o.push(b('plate_4x6', 'sky', 0, 0, 0));
  o.push(b('brick_2x6', 'yellow', 0, 1, 0), b('brick_2x6', 'yellow', 2, 1, 0));
  o.push(b('brick_2x4', 'yellow', 0, 4, 0, 1), b('brick_2x4', 'yellow', 0, 4, 2, 1));
  o.push(b('brick_2x2', 'yellow', 0, 4, 4), b('brick_2x2', 'yellow', 2, 4, 4));
  o.push(b('slope_2x2', 'yellow', 1, 7, 0));
  o.push(b('slope_1x2', 'yellow', 0, 7, 1), b('slope_1x2', 'yellow', 3, 7, 1));
  o.push(b('brick_2x3', 'yellow', 1, 7, 3));
  o.push(b('brick_2x2', 'yellow', 1, 10, 3));
  o.push(b('plate_1x2', 'orange', 1, 10, 5, 1));
  o.push(b('plate_1x2', 'orange', 1, 11, 5, 1));
  o.push(b('roundplate_1x1', 'white', 1, 13, 4), b('roundplate_1x1', 'white', 2, 13, 4));
  o.push(b('roundplate_1x1', 'black', 1, 14, 4), b('roundplate_1x1', 'black', 2, 14, 4));
  return o;
}

function tree() {
  const o = [];
  o.push(b('plate_4x4', 'green', 0, 0, 0));
  o.push(b('round_2x2', 'brown', 1, 1, 1));
  o.push(b('round_2x2', 'brown', 1, 4, 1));
  o.push(b('flower_1x1', 'pink', 0, 1, 3), b('flower_1x1', 'yellow', 3, 1, 0));
  o.push(b('brick_2x4', 'dgreen', 0, 7, 0), b('brick_2x4', 'dgreen', 2, 7, 0));
  o.push(b('brick_2x4', 'green', 0, 10, 0, 1), b('brick_2x4', 'green', 0, 10, 2, 1));
  o.push(b('roundplate_1x1', 'red', 0, 13, 0), b('roundplate_1x1', 'red', 3, 13, 3), b('roundplate_1x1', 'red', 3, 13, 0), b('roundplate_1x1', 'red', 0, 13, 3));
  o.push(b('brick_2x2', 'dgreen', 1, 13, 1));
  o.push(b('round_2x2', 'green', 1, 16, 1));
  o.push(b('cone_1x1', 'yellow', 1, 19, 1));
  return o;
}

function car() {
  const o = [];
  o.push(b('wheel_4x2', 'lgray', 0, 0, 0), b('wheel_4x2', 'lgray', 0, 0, 4));
  o.push(b('plate_2x6', 'dgray', 0, 3, 0), b('plate_2x6', 'dgray', 2, 3, 0));
  o.push(b('brick_2x4', 'red', 0, 4, 0, 1), b('brick_2x4', 'red', 0, 4, 2, 1), b('brick_2x4', 'red', 0, 4, 4, 1));
  o.push(b('tile_1x4', 'red', 0, 7, 0, 1));
  o.push(b('brick_1x2', 'red', 0, 7, 1), b('brick_1x2', 'red', 3, 7, 1));
  o.push(b('plate_2x2', 'tan', 1, 7, 1));
  o.push(b('brick_1x4', 'tclear', 0, 7, 3, 1));
  o.push(b('slope_4x2', 'red', 0, 7, 4, 2));
  o.push(b('plate_2x4', 'red', 0, 10, 1, 1));
  o.push(b('plate_1x4', 'red', 0, 10, 3, 1));
  o.push(b('tile_2x4', 'white', 0, 11, 1, 1));
  return o;
}

function lighthouse() {
  const o = [];
  o.push(b('plate_6x6', 'tan', 0, 0, 0));
  o.push(b('brick_1x2', 'dgray', 0, 1, 0), b('brick_1x2', 'lgray', 5, 1, 3), b('flower_1x1', 'yellow', 0, 1, 5), b('flower_1x1', 'coral', 5, 1, 0));
  for (let k = 0; k < 6; k++) o.push(b('round_2x2', k % 2 === 0 ? 'red' : 'white', 2, 1 + k * 3, 2));
  o.push(b('plate_4x4', 'dgray', 1, 19, 1));
  o.push(b('round_2x2', 'torange', 2, 20, 2));
  o.push(b('dome_2x2', 'red', 2, 23, 2));
  return o;
}

function cottage() {
  const o = [];
  const W = 8, D = 6;
  o.push(b('plate_4x6', 'tan', 0, 0, 0), b('plate_4x6', 'tan', 4, 0, 0));
  const door = (x, z, layer) => z === D - 1 && (x === 3 || x === 4) && layer <= 2;
  const sideWin = (x, z, layer) => (x === 0 || x === W - 1) && (z === 2 || z === 3) && (layer === 1 || layer === 2);
  const backWin = (x, z, layer) => z === 0 && (x === 3 || x === 4) && (layer === 1 || layer === 2);
  const skip = (x, z, l) => door(x, z, l) || sideWin(x, z, l) || backWin(x, z, l);
  const color = (p, layer) => (layer === 3 ? 'white' : 'tan');
  for (let layer = 0; layer < 4; layer++) {
    wallRing(o, 0, 0, W, D, 1 + layer * 3, layer, color, skip);
    if (layer === 0) o.push(b('door_1x2', 'white', 3, 1, D - 1));
    if (layer === 1) {
      o.push(b('window_1x2', 'white', 0, 4, 2, 1), b('window_1x2', 'white', W - 1, 4, 2, 1));
      o.push(b('window_1x2', 'white', 3, 4, 0));
    }
  }
  // 屋顶
  o.push(b('slope_4x2', 'red', 0, 13, 0), b('slope_4x2', 'red', 4, 13, 0));
  o.push(b('brick_2x4', 'red', 0, 13, 2, 1), b('brick_2x4', 'red', 4, 13, 2, 1));
  o.push(b('slope_4x2', 'red', 0, 13, 4, 2), b('slope_4x2', 'red', 4, 13, 4, 2));
  o.push(b('slope_4x2', 'red', 0, 16, 1), b('slope_4x2', 'red', 4, 16, 1));
  o.push(b('slope_4x2', 'red', 0, 16, 3, 2), b('slope_4x2', 'red', 4, 16, 3, 2));
  o.push(b('plate_2x4', 'dred', 0, 19, 2, 1), b('plate_2x4', 'dred', 4, 19, 2, 1));
  o.push(b('tile_2x4', 'dred', 0, 20, 2, 1), b('tile_2x2', 'dred', 4, 20, 2));
  o.push(b('brick_2x2', 'dgray', 6, 20, 2), b('brick_2x2', 'dgray', 6, 23, 2), b('tile_2x2', 'black', 6, 26, 2));
  // 门前小路与花园
  o.push(b('tile_2x2', 'lgray', 3, 0, 6), b('tile_2x2', 'lgray', 3, 0, 8));
  o.push(b('flower_1x1', 'pink', 1, 0, 6), b('flower_1x1', 'yellow', 2, 0, 7), b('flower_1x1', 'coral', 6, 0, 6), b('flower_1x1', 'lavender', 5, 0, 7));
  o.push(b('tree_2x2', 'green', 9, 0, 1));
  return o;
}

export const BLUEPRINTS = [
  { id: 'duck', name: '小黄鸭', desc: '浮在小池塘上的胖胖鸭子', difficulty: 1, build: duck },
  { id: 'tree', name: '苹果树', desc: '结满红苹果的小树', difficulty: 1, build: tree },
  { id: 'car', name: '红色小汽车', desc: '带透明挡风玻璃的兜风小车', difficulty: 2, build: car },
  { id: 'lighthouse', name: '海边灯塔', desc: '红白相间、顶上发光的灯塔', difficulty: 2, build: lighthouse },
  { id: 'cottage', name: '温馨小屋', desc: '有窗、有门、有烟囱的小房子', difficulty: 3, build: cottage },
];

export function modelBounds(list, typeMap, rotatedDims) {
  let mx = 0, mz = 0, my = 0;
  for (const p of list) {
    const t = typeMap[p.type];
    const [W, D] = rotatedDims(t, p.rot);
    mx = Math.max(mx, p.x + W);
    mz = Math.max(mz, p.z + D);
    my = Math.max(my, p.y + t.h);
  }
  return { w: mx, d: mz, h: my };
}

// 把图纸拆成步骤：同层、同类型、同颜色的相邻积木合并为一步（最多 4 块）
export function makeSteps(list) {
  const steps = [];
  for (const p of list) {
    const last = steps[steps.length - 1];
    if (last && last.length < 4 && last[0].type === p.type && last[0].color === p.color && last[0].y === p.y) last.push(p);
    else steps.push([p]);
  }
  return steps;
}
