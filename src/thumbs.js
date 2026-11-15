import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BRICK_MAP, LAYER, rotatedDims } from './bricks/catalog.js';
import { getBrickGeometry } from './bricks/geometry.js';
import { materialsFor } from './bricks/materials.js';

// 用一个离屏渲染器给积木和图纸生成缩略图
export class Thumbnailer {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    const key = new THREE.DirectionalLight('#fff1dc', 2.4);
    key.position.set(-3, 6, 4);
    const rim = new THREE.DirectionalLight('#ffd6a8', 0.8);
    rim.position.set(4, 3, -4);
    this.scene.add(key, rim, new THREE.HemisphereLight('#fff6e8', '#7a5a40', 0.6));
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
    this.cache = new Map();
  }

  frame(obj, size, dirVec = new THREE.Vector3(1, 0.85, 1.25)) {
    this.renderer.setSize(size, size, false);
    const box = new THREE.Box3().setFromObject(obj);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.02;
    this.camera.position.copy(sphere.center).add(dirVec.clone().normalize().multiplyScalar(dist));
    this.camera.near = dist / 50;
    this.camera.far = dist * 4;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(sphere.center);
    this.scene.add(obj);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(obj);
    return this.renderer.domElement.toDataURL('image/png');
  }

  brick(typeId, colorId, size = 128) {
    const k = `${typeId}|${colorId}|${size}`;
    if (this.cache.has(k)) return this.cache.get(k);
    const { geometry, matKeys } = getBrickGeometry(typeId);
    const m = new THREE.Mesh(geometry, materialsFor(matKeys, colorId));
    const url = this.frame(m, size);
    this.cache.set(k, url);
    return url;
  }

  model(list, size = 256) {
    const g = new THREE.Group();
    for (const p of list) {
      const t = BRICK_MAP[p.type];
      const { geometry, matKeys } = getBrickGeometry(p.type);
      const m = new THREE.Mesh(geometry, materialsFor(matKeys, p.color));
      const [W, D] = rotatedDims(t, p.rot);
      m.position.set(p.x + W / 2, p.y * LAYER, p.z + D / 2);
      m.rotation.y = (p.rot * Math.PI) / 2;
      g.add(m);
    }
    return this.frame(g, size, new THREE.Vector3(1, 0.8, 1.4));
  }
}
