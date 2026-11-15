import * as THREE from 'three';

export const PALETTE = [
  { id: 'white', name: '奶白', hex: '#F4F1EA' },
  { id: 'lgray', name: '浅灰', hex: '#A7ABAE' },
  { id: 'dgray', name: '深灰', hex: '#62676B' },
  { id: 'black', name: '墨黑', hex: '#25282C' },
  { id: 'red', name: '番茄红', hex: '#C9302C' },
  { id: 'dred', name: '酒红', hex: '#7E2223' },
  { id: 'coral', name: '珊瑚', hex: '#EE7B63' },
  { id: 'orange', name: '橘子', hex: '#F08A2E' },
  { id: 'yellow', name: '暖黄', hex: '#F6C83E' },
  { id: 'tan', name: '奶茶', hex: '#E2CDA2' },
  { id: 'dtan', name: '焦糖', hex: '#A88A5E' },
  { id: 'brown', name: '可可', hex: '#6C3D24' },
  { id: 'lime', name: '青柠', hex: '#AACB45' },
  { id: 'green', name: '草绿', hex: '#3A9152' },
  { id: 'dgreen', name: '松绿', hex: '#21573B' },
  { id: 'sage', name: '薄荷灰', hex: '#9FBEA8' },
  { id: 'sky', name: '天蓝', hex: '#7FB7E3' },
  { id: 'blue', name: '海蓝', hex: '#2F6EBF' },
  { id: 'navy', name: '藏青', hex: '#203B68' },
  { id: 'pink', name: '樱花粉', hex: '#F3A7B9' },
  { id: 'lavender', name: '薰衣草', hex: '#B9A4D8' },
  { id: 'tclear', name: '透明', hex: '#EAF4FF', trans: true },
  { id: 'tblue', name: '透明蓝', hex: '#79B8EA', trans: true },
  { id: 'torange', name: '透明橙', hex: '#F7A43C', trans: true },
];
export const COLOR_MAP = Object.fromEntries(PALETTE.map((c) => [c.id, c]));

const cache = new Map();

export function brickMaterial(colorId) {
  if (cache.has(colorId)) return cache.get(colorId);
  const c = COLOR_MAP[colorId] || PALETTE[0];
  let m;
  if (c.trans) {
    m = new THREE.MeshPhysicalMaterial({
      color: c.hex,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      depthWrite: false,
      side: THREE.FrontSide,
    });
  } else {
    m = new THREE.MeshPhysicalMaterial({
      color: c.hex,
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.22,
      specularIntensity: 0.55,
    });
  }
  m.userData.trans = !!c.trans;
  cache.set(colorId, m);
  return m;
}

const fixedDefs = {
  rubber: () => new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.82 }),
  hub: () => new THREE.MeshStandardMaterial({ color: '#d2d5d9', roughness: 0.32, metalness: 0.55 }),
  glass: () =>
    new THREE.MeshPhysicalMaterial({
      color: '#d9ecff',
      roughness: 0.04,
      transparent: true,
      opacity: 0.32,
      clearcoat: 1,
      depthWrite: false,
    }),
  wood: () => new THREE.MeshStandardMaterial({ color: '#8b5a36', roughness: 0.62 }),
  gold: () => new THREE.MeshStandardMaterial({ color: '#e2b24a', roughness: 0.28, metalness: 1 }),
  leaf: () => new THREE.MeshPhysicalMaterial({ color: '#3f8d47', roughness: 0.4, clearcoat: 0.25 }),
  pollen: () => new THREE.MeshPhysicalMaterial({ color: '#f6c63e', roughness: 0.4, clearcoat: 0.3 }),
};
const fixedCache = new Map();
export function fixedMaterial(key) {
  if (!fixedCache.has(key)) fixedCache.set(key, fixedDefs[key]());
  return fixedCache.get(key);
}

export function materialsFor(matKeys, colorId) {
  return matKeys.map((k) => (k === 'color' ? brickMaterial(colorId) : fixedMaterial(k)));
}

export function isTrans(colorId) {
  return !!COLOR_MAP[colorId]?.trans;
}
