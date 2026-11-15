// 闯关模式关卡。坐标为底板格坐标（x/z 凸点，y 薄板层，1 块标准砖 = 3 层）
const L = (type, x, y, z, rot = 0, color = 'lgray') => ({ type, x, y, z, rot, color, locked: true });
const INF = -1;

export const LEVELS = [
  {
    id: 'l1',
    name: '初次见面',
    desc: '随便放下 5 块积木，感受“咔哒”一声扣上的快乐。',
    hint: '左键点击底板放置，按 R 旋转，右键可以拆掉。',
    size: 16,
    inventory: { brick_2x4: INF, brick_2x2: INF, brick_1x4: INF, brick_1x2: INF },
    goals: [{ type: 'count', n: 5 }],
    par: 99,
  },
  {
    id: 'l2',
    name: '摘星星',
    desc: '星星飘在半空中，搭高一点就能碰到它。',
    hint: '积木要叠在星星所在的那一列上，高度要盖住星星。',
    size: 16,
    inventory: { brick_2x2: 3 },
    goals: [{ type: 'stars', cells: [[8, 4, 8]] }],
    par: 2,
  },
  {
    id: 'l3',
    name: '高高的塔',
    desc: '把塔盖到金色的高度线以上。用的积木越少，星星越多。',
    hint: '一块标准砖等于三块薄板的高度。',
    size: 16,
    inventory: { brick_1x2: 4, brick_2x2: 3, plate_2x2: 6 },
    goals: [{ type: 'height', h: 18 }],
    par: 6,
  },
  {
    id: 'l4',
    name: '星星阶梯',
    desc: '三颗星星排成一道阶梯，一次把它们全摘下来。',
    hint: '错开叠放的长积木可以做成台阶。',
    size: 16,
    inventory: { brick_2x4: 2, brick_2x2: 3, brick_1x2: 3 },
    goals: [{ type: 'stars', cells: [[4, 2, 8], [7, 5, 8], [10, 8, 8]] }],
    par: 3,
  },
  {
    id: 'l5',
    name: '复刻小树',
    desc: '照着右边小台子上的样品，搭一棵一模一样的小树（颜色也要一样）。',
    hint: '朝向不限，位置不限，只要形状和颜色一致。',
    size: 16,
    inventory: { brick_1x1: 3, brick_2x2: 2, plate_2x2: 3, brick_1x2: 2 },
    goals: [
      {
        type: 'replica',
        bricks: [
          { type: 'brick_1x1', color: 'brown', x: 0, y: 0, z: 0, rot: 0 },
          { type: 'brick_1x1', color: 'brown', x: 0, y: 3, z: 0, rot: 0 },
          { type: 'brick_2x2', color: 'green', x: 0, y: 6, z: 0, rot: 0 },
          { type: 'brick_1x1', color: 'green', x: 1, y: 9, z: 1, rot: 0 },
        ],
      },
    ],
    par: 4,
  },
  {
    id: 'l6',
    name: '跨河小桥',
    desc: '小河把两座灰色桥墩隔开了，搭一座桥把它们连起来。',
    hint: '水里放不了积木，试试从桥墩上伸出去。',
    size: 16,
    water: [{ x: 0, z: 6, w: 16, d: 4 }],
    base: '#86b46f',
    locked: [L('brick_2x2', 7, 0, 3), L('brick_2x2', 7, 3, 3), L('brick_2x2', 7, 0, 11), L('brick_2x2', 7, 3, 11)],
    inventory: { brick_2x4: 2, brick_1x6: 2, brick_1x4: 2, brick_1x2: 3 },
    goals: [{ type: 'connect', a: 1, b: 3 }],
    par: 3,
  },
  {
    id: 'l7',
    name: '修好屋顶',
    desc: '下雨啦！小屋没有屋顶，把屋子里面全部遮住。',
    hint: '悬空的积木必须扣在别的积木上——从墙头开始搭。',
    size: 16,
    lockedBuilder: 'house',
    inventory: { slope_4x2: 2, slope_2x2: 2, brick_2x4: 2, brick_2x2: 1, brick_1x4: 2 },
    goals: [{ type: 'cover', x0: 6, z0: 6, x1: 9, z1: 9, y: 9 }],
    par: 4,
  },
  {
    id: 'l8',
    name: '彩虹之塔',
    desc: '照着样品，按红、橙、黄、绿、蓝、紫的顺序叠出彩虹塔。',
    hint: '先在下方调色盘里选好颜色再放。',
    size: 16,
    inventory: { brick_2x2: 8 },
    goals: [
      {
        type: 'replica',
        bricks: ['red', 'orange', 'yellow', 'green', 'blue', 'lavender'].map((color, i) => ({ type: 'brick_2x2', color, x: 0, y: i * 3, z: 0, rot: 0 })),
      },
    ],
    par: 6,
  },
  {
    id: 'l9',
    name: '悬空的星',
    desc: '星星悬在湖面上方，从岸边伸出一条“跳台”去够它。',
    hint: '长条积木压住一半在岸上，另一半就能伸出去。',
    size: 16,
    water: [{ x: 0, z: 7, w: 16, d: 9 }],
    inventory: { brick_1x6: 2, brick_1x4: 2, brick_2x2: 3, brick_1x2: 2 },
    goals: [{ type: 'stars', cells: [[8, 7, 13]] }],
    par: 3,
  },
  {
    id: 'l10',
    name: '小岛灯塔',
    desc: '四面环水的小岛上，一次摘下东、西、顶上三颗星。',
    hint: '先铺一块横跨小岛的长砖，再向两边伸出去。',
    size: 16,
    water: [
      { x: 0, z: 0, w: 16, d: 6 },
      { x: 0, z: 10, w: 16, d: 6 },
      { x: 0, z: 6, w: 6, d: 4 },
      { x: 10, z: 6, w: 6, d: 4 },
    ],
    inventory: { brick_2x4: 3, brick_2x2: 3, brick_1x4: 2, brick_1x2: 2, plate_2x2: 3 },
    goals: [{ type: 'stars', cells: [[7, 10, 7], [12, 5, 8], [3, 5, 8]] }],
    par: 6,
  },
];

// 关卡 7 的小屋墙体（6×6，三层高，前面留门）
export function houseWalls() {
  const out = [];
  const x0 = 5, z0 = 5;
  const col = ['tan', 'white', 'tan'];
  for (let layer = 0; layer < 3; layer++) {
    const y = layer * 3;
    const c = col[layer];
    if (layer % 2 === 0) {
      out.push(L('brick_1x6', x0, y, z0, 1, c));
      if (layer === 0) {
        out.push(L('brick_1x2', x0, y, z0 + 5, 1, c), L('brick_1x2', x0 + 4, y, z0 + 5, 1, c));
      } else out.push(L('brick_1x6', x0, y, z0 + 5, 1, c));
      out.push(L('brick_1x4', x0, y, z0 + 1, 0, c), L('brick_1x4', x0 + 5, y, z0 + 1, 0, c));
    } else {
      out.push(L('brick_1x6', x0, y, z0, 0, c), L('brick_1x6', x0 + 5, y, z0, 0, c));
      out.push(L('brick_1x4', x0 + 1, y, z0, 1, c));
      out.push(L('brick_1x1', x0 + 1, y, z0 + 5, 0, c), L('brick_1x1', x0 + 4, y, z0 + 5, 0, c));
    }
  }
  return out;
}
