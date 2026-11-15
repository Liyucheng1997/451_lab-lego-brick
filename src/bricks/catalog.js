// 积木目录：尺寸单位为“凸点”(x/z) 与“薄板层”(y，1 层 = 0.4，标准砖 = 3 层)
export const LAYER = 0.4;

export const CATEGORIES = [
  { id: 'brick', name: '基础砖' },
  { id: 'plate', name: '薄板' },
  { id: 'tile', name: '光面板' },
  { id: 'slope', name: '斜坡' },
  { id: 'round', name: '圆形' },
  { id: 'deco', name: '装饰' },
];

const list = [];
function add(def) {
  list.push(def);
}

for (const [w, d] of [[1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 2], [2, 3], [2, 4], [2, 6], [2, 8]]) {
  add({ id: `brick_${w}x${d}`, name: `${w}×${d} 积木`, cat: 'brick', kind: 'brick', w, d, h: 3 });
}
for (const [w, d] of [[1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [2, 2], [2, 3], [2, 4], [2, 6], [4, 4], [4, 6], [6, 6]]) {
  add({ id: `plate_${w}x${d}`, name: `${w}×${d} 薄板`, cat: 'plate', kind: 'brick', w, d, h: 1 });
}
for (const [w, d] of [[1, 1], [1, 2], [1, 4], [2, 2], [2, 4]]) {
  add({ id: `tile_${w}x${d}`, name: `${w}×${d} 光面板`, cat: 'tile', kind: 'tile', w, d, h: 1, studs: [] });
}
add({ id: 'slope_1x2', name: '1×2 斜坡', cat: 'slope', kind: 'slope', w: 1, d: 2, h: 3 });
add({ id: 'slope_2x2', name: '2×2 斜坡', cat: 'slope', kind: 'slope', w: 2, d: 2, h: 3 });
add({ id: 'slope_4x2', name: '4×2 斜坡', cat: 'slope', kind: 'slope', w: 4, d: 2, h: 3 });
add({ id: 'slope_2x3', name: '2×3 缓坡', cat: 'slope', kind: 'slope', w: 2, d: 3, h: 3 });

add({ id: 'round_1x1', name: '1×1 圆砖', cat: 'round', kind: 'round', w: 1, d: 1, h: 3 });
add({ id: 'roundplate_1x1', name: '1×1 圆片', cat: 'round', kind: 'roundplate', w: 1, d: 1, h: 1 });
add({ id: 'cone_1x1', name: '1×1 圆锥', cat: 'round', kind: 'cone', w: 1, d: 1, h: 3 });
add({ id: 'round_2x2', name: '2×2 圆砖', cat: 'round', kind: 'round', w: 2, d: 2, h: 3 });
add({ id: 'dome_2x2', name: '2×2 圆顶', cat: 'round', kind: 'dome', w: 2, d: 2, h: 3, studs: [] });

add({ id: 'arch_1x4', name: '1×4 拱门', cat: 'deco', kind: 'arch', w: 4, d: 1, h: 3 });
add({ id: 'window_1x2', name: '小窗户', cat: 'deco', kind: 'window', w: 2, d: 1, h: 6 });
add({ id: 'door_1x2', name: '小木门', cat: 'deco', kind: 'door', w: 2, d: 1, h: 9 });
add({ id: 'wheel_4x2', name: '车轮组', cat: 'deco', kind: 'wheel', w: 4, d: 2, h: 3, studs: [[1, 0], [2, 0], [1, 1], [2, 1]] });
add({ id: 'flower_1x1', name: '小花', cat: 'deco', kind: 'flower', w: 1, d: 1, h: 3, studs: [] });
add({ id: 'tree_2x2', name: '小树', cat: 'deco', kind: 'tree', w: 2, d: 2, h: 9, studs: [] });

// 补全默认字段
for (const t of list) {
  if (!t.studs) {
    if (t.kind === 'slope') {
      t.studs = [];
      for (let x = 0; x < t.w; x++) t.studs.push([x, t.d - 1]);
    } else {
      t.studs = [];
      for (let x = 0; x < t.w; x++) for (let z = 0; z < t.d; z++) t.studs.push([x, z]);
    }
  }
  if (t.kind === 'arch') {
    t.cells = [];
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 3; y++) if (x === 0 || x === 3 || y === 2) t.cells.push([x, y, 0]);
  } else {
    t.cells = [];
    for (let x = 0; x < t.w; x++)
      for (let y = 0; y < t.h; y++) for (let z = 0; z < t.d; z++) t.cells.push([x, y, z]);
  }
  // 对称性：用于判断两种摆法是否等价（建造模式校验）
  t.symmetric180 = t.kind !== 'slope' && t.kind !== 'door';
}

export const BRICKS = list;
export const BRICK_MAP = Object.fromEntries(list.map((t) => [t.id, t]));

// 旋转后的占地尺寸
export function rotatedDims(t, rot) {
  return rot % 2 === 0 ? [t.w, t.d] : [t.d, t.w];
}

// 局部格坐标 -> 旋转后占地内坐标
export function rotateCell(t, x, z, rot) {
  switch (rot & 3) {
    case 0: return [x, z];
    case 1: return [z, t.w - 1 - x];
    case 2: return [t.w - 1 - x, t.d - 1 - z];
    default: return [t.d - 1 - z, x];
  }
}

// 计算一块积木在世界格中的全部格子
export function brickCells(t, x0, y0, z0, rot) {
  const out = [];
  for (const [x, y, z] of t.cells) {
    const [rx, rz] = rotateCell(t, x, z, rot);
    out.push([x0 + rx, y0 + y, z0 + rz]);
  }
  return out;
}

// 顶部带凸点的格子（世界坐标，y 为积木最高层）
export function brickStudCells(t, x0, y0, z0, rot) {
  const out = [];
  for (const [x, z] of t.studs) {
    const [rx, rz] = rotateCell(t, x, z, rot);
    out.push([x0 + rx, y0 + t.h - 1, z0 + rz]);
  }
  return out;
}
