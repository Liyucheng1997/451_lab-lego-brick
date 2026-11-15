import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { woodTexture, plasterTexture, softDotTexture, sketchTexture, paintingTexture, bookSpineTexture } from './textures.js';
import { extrudeUp, rrShape } from '../bricks/geometry.js';
import { getBrickGeometry } from '../bricks/geometry.js';
import { materialsFor, PALETTE } from '../bricks/materials.js';
import { BRICK_MAP, LAYER } from '../bricks/catalog.js';

const TABLE_Y = -0.2;
const WIN = { x: -50, z0: -32, z1: 10, y0: 16, y1: 50 };

export const TIMES = {
  day: {
    label: '午后暖阳',
    sun: '#ffdcae', sunI: 4.2, sunPos: [-110, 78, -26],
    sky: '#fff1dc', ground: '#8a6b50', hemiI: 0.6,
    fill: 0.32, env: 0.4, lamp: 0, fairy: 0.0, exposure: 1.0,
    bg: '#e9d3b6', shaft: 0.075, dust: 0.65,
    skyTop: '#86bde8', skyBottom: '#fde8c8', skySun: '#fff4d8', hill1: '#a5c48e', hill2: '#76a06c', stars: 0, cloud: '#ffffff',
  },
  dusk: {
    label: '黄昏',
    sun: '#ff9550', sunI: 2.6, sunPos: [-118, 46, -8],
    sky: '#ffc9a3', ground: '#5a3c2e', hemiI: 0.6,
    fill: 0.32, env: 0.38, lamp: 0.55, fairy: 0.65, exposure: 1.05,
    bg: '#c99a7e', shaft: 0.1, dust: 0.75,
    skyTop: '#6a79bd', skyBottom: '#ffae78', skySun: '#ffd49c', hill1: '#8c6b86', hill2: '#5f4b6c', stars: 0.15, cloud: '#ffc1a1',
  },
  night: {
    label: '夜晚台灯',
    sun: '#9fb4ff', sunI: 0.55, sunPos: [-100, 88, -40],
    sky: '#4a5585', ground: '#22180f', hemiI: 0.3,
    fill: 0.06, env: 0.16, lamp: 1, fairy: 1, exposure: 1.12,
    bg: '#1d1a24', shaft: 0.02, dust: 0.2,
    skyTop: '#0b1430', skyBottom: '#2a3560', skySun: '#eef2ff', hill1: '#1b2440', hill2: '#121a30', stars: 1, cloud: '#56607e',
  },
};

function cylinderBetween(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, 16);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function shadowAll(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}

export class Room {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.time = 0;
    this.state = this.snapshot(TIMES.day);
    this.target = this.snapshot(TIMES.day);
    this.blend = 1;
    this.timeName = 'day';

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.buildLights();
    this.buildRoom();
    this.buildWindow();
    this.buildTable();
    this.buildProps();
    this.buildFairyLights();
    this.buildShaft();
    this.applyState(this.state);
  }

  snapshot(p) {
    const c = (h) => new THREE.Color(h);
    return {
      sun: c(p.sun), sunI: p.sunI, sunPos: new THREE.Vector3(...p.sunPos),
      sky: c(p.sky), ground: c(p.ground), hemiI: p.hemiI,
      fill: p.fill, env: p.env, lamp: p.lamp, fairy: p.fairy, exposure: p.exposure,
      bg: c(p.bg), shaft: p.shaft, dust: p.dust,
      skyTop: c(p.skyTop), skyBottom: c(p.skyBottom), skySun: c(p.skySun), hill1: c(p.hill1), hill2: c(p.hill2), stars: p.stars, cloud: c(p.cloud),
    };
  }

  setTime(name, instant = false) {
    if (!TIMES[name]) return;
    this.timeName = name;
    this.from = this.snapshot(TIMES.day);
    // 以当前状态作为起点
    for (const k in this.state) {
      const v = this.state[k];
      this.from[k] = v.clone ? v.clone() : v;
    }
    this.target = this.snapshot(TIMES[name]);
    this.blend = instant ? 1 : 0;
    if (instant) {
      this.state = this.target;
      this.applyState(this.state);
    }
  }

  // ---------- 灯光 ----------
  buildLights() {
    const sun = new THREE.DirectionalLight('#ffe1b8', 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 20; sc.far = 330;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.hemi = new THREE.HemisphereLight('#fff1dc', '#8a6b50', 0.8);
    this.scene.add(this.hemi);

    const fill = new THREE.DirectionalLight('#ffd9b0', 0.4);
    fill.position.set(50, 40, 70);
    this.scene.add(fill);
    this.fillLight = fill;
  }

  setShadowQuality(q) {
    const size = q === 'high' ? 4096 : q === 'medium' ? 2048 : 1024;
    for (const l of [this.sun, this.lampLight]) {
      if (!l) continue;
      const s = l === this.sun ? size : Math.min(size, 1024);
      if (l.shadow.mapSize.x !== s) {
        l.shadow.mapSize.set(s, s);
        l.shadow.map?.dispose();
        l.shadow.map = null;
      }
    }
  }

  // ---------- 房间 ----------
  buildRoom() {
    const floorTex = woodTexture({ base: '#9b6a45', dark: '#6b4128', light: '#b88660', seed: 21, planks: 8 });
    floorTex.repeat.set(5, 5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -32;
    floor.receiveShadow = true;
    this.root.add(floor);

    // 地毯
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(48, 64),
      new THREE.MeshStandardMaterial({ color: '#c98f6a', roughness: 1 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(5, -31.9, 10);
    rug.receiveShadow = true;
    this.root.add(rug);
    const rug2 = new THREE.Mesh(new THREE.RingGeometry(40, 43, 64), new THREE.MeshStandardMaterial({ color: '#e8c79a', roughness: 1 }));
    rug2.rotation.x = -Math.PI / 2;
    rug2.position.set(5, -31.85, 10);
    this.root.add(rug2);

    const plaster = plasterTexture('#f1e4cf');
    plaster.repeat.set(6, 4);
    const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.95, color: '#fff7ec' });
    wallMat.shadowSide = THREE.DoubleSide;

    // 后墙
    const back = new THREE.Mesh(new THREE.PlaneGeometry(240, 130), wallMat);
    back.position.set(68, 33, -38);
    back.receiveShadow = true;
    back.castShadow = true;
    this.root.add(back);

    // 护墙板
    const wainTex = woodTexture({ base: '#d9b48a', dark: '#b08a62', light: '#ecd2ac', seed: 9, planks: 0 });
    wainTex.repeat.set(4, 1);
    const wainMat = new THREE.MeshStandardMaterial({ map: wainTex, roughness: 0.6 });
    const wain = new THREE.Mesh(new THREE.BoxGeometry(240, 22, 0.8), wainMat);
    wain.position.set(68, -21, -37.6);
    wain.receiveShadow = true;
    this.root.add(wain);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(240, 1, 1.6), wainMat);
    rail.position.set(68, -9.6, -37.2);
    this.root.add(rail);

    // 左墙（带窗洞）
    const s = new THREE.Shape();
    s.moveTo(-170, -32);
    s.lineTo(38, -32);
    s.lineTo(38, 100);
    s.lineTo(-170, 100);
    s.lineTo(-170, -32);
    const hole = new THREE.Path();
    hole.moveTo(-WIN.z1, WIN.y0);
    hole.lineTo(-WIN.z0, WIN.y0);
    hole.lineTo(-WIN.z0, WIN.y1);
    hole.lineTo(-WIN.z1, WIN.y1);
    hole.lineTo(-WIN.z1, WIN.y0);
    s.holes.push(hole);
    const lg = new THREE.ShapeGeometry(s);
    lg.rotateY(Math.PI / 2);
    const uv = lg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 40, uv.getY(i) / 32);
    const left = new THREE.Mesh(lg, wallMat);
    left.position.x = WIN.x;
    left.castShadow = true;
    left.receiveShadow = true;
    this.root.add(left);
    // 左墙护墙板
    const wainL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 22, 210), wainMat);
    wainL.position.set(WIN.x + 0.4, -21, 67);
    this.root.add(wainL);

    // 墙后的“外墙厚度”，避免从窗外漏光
    const outer = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: '#d7c3a8' }));
    outer.geometry.rotateY(-Math.PI / 2);
    outer.position.x = WIN.x - 3;
    outer.scale.z = -1;
    outer.castShadow = true;
    outer.material.side = THREE.DoubleSide;
    this.root.add(outer);
  }

  buildWindow() {
    const woodTex = woodTexture({ base: '#f3ead9', dark: '#d8c7a8', light: '#fffaf0', seed: 4 });
    const frameMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 });
    const zc = (WIN.z0 + WIN.z1) / 2;
    const zw = WIN.z1 - WIN.z0;
    const yc = (WIN.y0 + WIN.y1) / 2;
    const yh = WIN.y1 - WIN.y0;
    const add = (w, h, d, x, y, z, cast = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    // 窗洞内衬
    add(3.2, 0.8, zw + 1.6, WIN.x - 1.6, WIN.y1 + 0.4, zc);
    add(3.2, 0.8, zw + 1.6, WIN.x - 1.6, WIN.y0 - 0.4, zc);
    add(3.2, yh, 0.8, WIN.x - 1.6, yc, WIN.z0 - 0.4);
    add(3.2, yh, 0.8, WIN.x - 1.6, yc, WIN.z1 + 0.4);
    // 室内贴脸
    add(0.6, 2, zw + 5, WIN.x + 0.3, WIN.y1 + 1.0, zc);
    add(0.6, yh + 4, 2, WIN.x + 0.3, yc, WIN.z0 - 1.0);
    add(0.6, yh + 4, 2, WIN.x + 0.3, yc, WIN.z1 + 1.0);
    // 窗台
    add(5, 1, zw + 7, WIN.x + 1.6, WIN.y0 - 0.5, zc);
    // 窗格（不投影，让光斑干净地落在桌面）
    add(0.7, yh, 0.7, WIN.x - 1.4, yc, zc, false);
    add(0.7, 0.7, zw, WIN.x - 1.4, WIN.y0 + yh * 0.68, zc, false);
    add(0.5, yh, 0.5, WIN.x - 1.4, yc, WIN.z0 + zw * 0.25, false);
    add(0.5, yh, 0.5, WIN.x - 1.4, yc, WIN.z0 + zw * 0.75, false);

    // 窗外风景
    this.skyUniforms = {
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() },
      uHill1: { value: new THREE.Color() },
      uHill2: { value: new THREE.Color() },
      uCloud: { value: new THREE.Color() },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uSunUV: { value: new THREE.Vector2(0.55, 0.55) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `
        uniform vec3 uTop,uBottom,uSun,uHill1,uHill2,uCloud; uniform float uStars,uTime; uniform vec2 uSunUV; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5;} return v; }
        void main(){
          vec2 uv = vUv;
          vec3 col = mix(uBottom, uTop, smoothstep(0.3, 1.0, uv.y));
          vec2 d = (uv - uSunUV) * vec2(1.6, 1.0);
          float r = length(d);
          col += uSun * (smoothstep(0.045, 0.035, r) * 1.2 + exp(-r*7.0)*0.55);
          // 星星
          vec2 g = floor(uv*vec2(260.0,160.0));
          float s = step(0.996, hash(g)) * (0.6+0.4*sin(uTime*2.0+hash(g+3.0)*30.0));
          col += vec3(s) * uStars * smoothstep(0.4,0.6,uv.y);
          // 云
          float c = fbm(vec2(uv.x*4.0 + uTime*0.01, uv.y*9.0));
          c = smoothstep(0.55, 0.85, c) * smoothstep(0.45, 0.7, uv.y) * (1.0 - smoothstep(0.85, 1.0, uv.y));
          col = mix(col, uCloud, c*0.75);
          // 远山 / 近山
          float h2 = 0.36 + 0.035*sin(uv.x*11.0+1.2) + 0.02*sin(uv.x*27.0+0.4) + 0.012*fbm(uv*vec2(30.0,1.0));
          float h1 = 0.30 + 0.03*sin(uv.x*7.0+2.6) + 0.015*sin(uv.x*19.0) ;
          col = mix(col, mix(uHill2, col, 0.45), smoothstep(h2+0.003, h2-0.003, uv.y));
          col = mix(col, uHill1, smoothstep(h1+0.003, h1-0.003, uv.y));
          // 树
          float tx = fract(uv.x*38.0); float tid = floor(uv.x*38.0);
          float th = h1 + 0.03 + 0.03*hash(vec2(tid,1.0));
          float tree = step(abs(tx-0.5)*(0.6+ (th-uv.y)*10.0), 0.35) * step(uv.y, th) * step(0.45, hash(vec2(tid,7.0)));
          col = mix(col, uHill1*0.82, tree*step(h1-0.02, uv.y));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      depthWrite: true,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(520, 300), skyMat);
    sky.rotation.y = Math.PI / 2;
    sky.position.set(-170, 40, zc);
    this.root.add(sky);

    // 窗帘
    const curtainMat = new THREE.MeshStandardMaterial({ color: '#efcfb2', roughness: 0.95, side: THREE.DoubleSide });
    const cu = { uTime: { value: 0 } };
    this.curtainUniforms = cu;
    curtainMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = cu.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float hang = clamp((26.0 - position.y) / 52.0, 0.0, 1.0);
          transformed.z += sin(uTime*0.7 + position.x*0.5) * 0.35 * hang;`
        );
    };
    for (const [z, w] of [[WIN.z0 - 3.5, 9], [WIN.z1 + 3.5, 9]]) {
      const g = new THREE.PlaneGeometry(w, 52, 40, 12);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        const gather = 0.7 + 0.3 * ((y + 26) / 52);
        p.setZ(i, Math.sin(x * 2.3) * 0.55 * gather + Math.sin(x * 5.1) * 0.12);
        p.setX(i, x * (0.8 + 0.2 * gather));
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, curtainMat);
      m.rotation.y = Math.PI / 2;
      m.position.set(WIN.x + 1.5, 29.5, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
    }
    const brass = new THREE.MeshStandardMaterial({ color: '#c79a52', metalness: 1, roughness: 0.3 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, zw + 22, 12), brass);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(WIN.x + 1.8, 56, zc);
    this.root.add(rod);
    for (const z of [WIN.z0 - 11.5, WIN.z1 + 11.5]) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), brass);
      k.position.set(WIN.x + 1.8, 56, z);
      this.root.add(k);
    }

    // 窗台上的小多肉
    const pot = this.makePot(1.4, 2.2, '#e9d8c4');
    pot.position.set(WIN.x + 1.8, WIN.y0, WIN.z0 + 8);
    this.root.add(pot);
    const succ = new THREE.Group();
    const sm = new THREE.MeshStandardMaterial({ color: '#7fae7a', roughness: 0.5 });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), sm);
      leaf.scale.set(0.5, 1, 0.5);
      leaf.position.set(Math.cos(a) * 0.55, 2.4 + (i % 3) * 0.2, Math.sin(a) * 0.55);
      leaf.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      succ.add(leaf);
    }
    succ.position.copy(pot.position);
    this.root.add(shadowAll(succ));
  }

  makePot(r, h, color) {
    const pts = [[0, 0], [r * 0.75, 0], [r * 0.8, 0.1], [r, h * 0.92], [r * 1.08, h * 0.94], [r * 1.08, h], [r * 0.92, h], [r * 0.9, h * 0.9], [0, h * 0.9]];
    const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 32);
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, clearcoat: 0.2 }));
    const soil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 24), new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 1 }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = h * 0.88;
    const grp = new THREE.Group();
    grp.add(m, soil);
    return shadowAll(grp);
  }

  // ---------- 桌子 ----------
  buildTable() {
    const tex = woodTexture({ base: '#c08852', dark: '#8f5a33', light: '#dcab78', seed: 11 });
    tex.repeat.set(1 / 60, 1 / 60);
    const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const top = new THREE.Mesh(extrudeUp(rrShape(91, 59, 1.6), 2.6, 0.35, 0.35), mat);
    top.position.set(0, TABLE_Y - 2.6, -2);
    top.receiveShadow = true;
    top.castShadow = true;
    this.root.add(top);
    const legMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, color: '#d8b89a' });
    for (const [x, z] of [[-41, -27], [41, -27], [-41, 23], [41, 23]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.1, 29.5, 16), legMat);
      leg.position.set(x, -17.6, z);
      leg.castShadow = true;
      this.root.add(leg);
    }
    const apron = new THREE.Mesh(new THREE.BoxGeometry(84, 3, 52), legMat);
    apron.position.set(0, -4.5, -2);
    this.root.add(apron);
  }

  // ---------- 桌上的小物件 ----------
  buildProps() {
    this.buildLamp();
    this.buildMug();
    this.buildPlant();
    this.buildBooks();
    this.buildPaper();
    this.buildLooseBricks();
    this.buildShelf();
  }

  buildLamp() {
    const enamel = new THREE.MeshPhysicalMaterial({ color: '#d9a441', roughness: 0.32, metalness: 0.2, clearcoat: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#3d3a36', roughness: 0.4, metalness: 0.6 });
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.LatheGeometry([[0, 0], [3.2, 0], [3.4, 0.25], [3.3, 0.7], [2.6, 1.1], [0.7, 1.3], [0, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)), 40),
      enamel
    );
    base.position.set(34, TABLE_Y, -21);
    g.add(base);
    const p0 = new THREE.Vector3(34, 1.1, -21);
    const p1 = new THREE.Vector3(31, 15.5, -23);
    const p2 = new THREE.Vector3(21, 20.5, -13);
    g.add(cylinderBetween(p0, p1, 0.32, dark));
    g.add(cylinderBetween(p1, p2, 0.32, dark));
    for (const p of [p0, p1, p2]) {
      const j = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), enamel);
      j.position.copy(p);
      g.add(j);
    }
    const target = new THREE.Vector3(3, 0, 0);
    const head = new THREE.Group();
    head.position.copy(p2);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(p2).normalize());
    const shade = new THREE.Mesh(
      new THREE.LatheGeometry([[0.9, 2.6], [1.4, 2.4], [1.6, 1.6], [3.4, -0.6], [3.8, -1.0], [3.9, -1.1]].map(([a, b]) => new THREE.Vector2(a, b)), 40),
      enamel.clone()
    );
    shade.material.side = THREE.DoubleSide;
    head.add(shade);
    const capTop = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), enamel);
    capTop.rotation.x = -Math.PI / 2;
    capTop.position.y = 2.6;
    head.add(capTop);
    this.bulbMat = new THREE.MeshBasicMaterial({ color: '#fff3d6' });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 16), this.bulbMat);
    bulb.position.y = 0.2;
    head.add(bulb);
    g.add(head);
    shadowAll(g);
    bulb.castShadow = false;
    this.root.add(g);

    const spot = new THREE.SpotLight('#ffbf7a', 0, 160, 0.78, 0.85, 2);
    spot.position.copy(p2).add(target.clone().sub(p2).normalize().multiplyScalar(0.5));
    spot.target.position.copy(target);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0006;
    spot.shadow.normalBias = 0.04;
    spot.shadow.camera.near = 1;
    this.scene.add(spot, spot.target);
    this.lampLight = spot;
    const glow = new THREE.PointLight('#ffb366', 0, 30, 2);
    glow.position.copy(p2);
    this.scene.add(glow);
    this.lampGlow = glow;
  }

  buildMug() {
    const g = new THREE.Group();
    const ceramic = new THREE.MeshPhysicalMaterial({ color: '#9fb79c', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    const pts = [[0, 0], [2.4, 0], [2.65, 0.2], [2.8, 5.4], [2.7, 5.65], [2.5, 5.55], [2.38, 0.7], [0, 0.7]];
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 48), ceramic);
    g.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.38, 14, 28, Math.PI), ceramic);
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(2.75, 3.0, 0);
    g.add(handle);
    const coffee = new THREE.Mesh(
      new THREE.CircleGeometry(2.45, 40),
      new THREE.MeshPhysicalMaterial({ color: '#4a2a18', roughness: 0.12, clearcoat: 1 })
    );
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 4.7;
    g.add(coffee);
    // 杯垫
    const coaster = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 0.3, 40),
      new THREE.MeshStandardMaterial({ color: '#c9a77c', roughness: 0.9 })
    );
    coaster.position.y = 0.15;
    g.add(coaster);
    body.position.y = 0.3;
    handle.position.y += 0.3;
    coffee.position.y += 0.3;
    g.position.set(-32, TABLE_Y, 14);
    g.rotation.y = 0.6;
    this.root.add(shadowAll(g));

    // 热气
    const tex = softDotTexture();
    this.steam = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      m.userData.phase = i / 16;
      this.root.add(m);
      this.steam.push(m);
    }
    this.mugTop = new THREE.Vector3(-32, TABLE_Y + 5.2, 14);
  }

  buildPlant() {
    const pot = this.makePot(3.4, 6, '#c8714b');
    pot.position.set(-37, TABLE_Y, -22);
    this.root.add(pot);
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(1.2, 1.5, 1.3, 4.5, 0, 7);
    leafShape.bezierCurveTo(-1.3, 4.5, -1.2, 1.5, 0, 0);
    const mats = ['#4f8a4b', '#5e9a55', '#3f7a43'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide }));
    const grp = new THREE.Group();
    for (let i = 0; i < 15; i++) {
      const scale = 0.7 + ((i * 37) % 10) / 22;
      const g = new THREE.ShapeGeometry(leafShape, 10);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const y = p.getY(k), x = p.getX(k);
        p.setZ(k, (y / 7) * (y / 7) * 2.2 - Math.abs(x) * 0.25);
      }
      g.computeVertexNormals();
      const leaf = new THREE.Mesh(g, mats[i % 3]);
      leaf.scale.setScalar(scale);
      const yaw = i * 2.39996;
      const pitch = 0.25 + (i % 4) * 0.18;
      leaf.rotation.set(0, yaw, 0, 'YXZ');
      leaf.rotateX(-pitch);
      leaf.position.set(0, 5.4, 0);
      grp.add(leaf);
    }
    grp.position.set(-37, TABLE_Y, -22);
    this.root.add(shadowAll(grp));
  }

  buildBooks() {
    const g = new THREE.Group();
    const pageMat = new THREE.MeshStandardMaterial({ color: '#f4ead2', roughness: 0.9 });
    const books = [
      [10, 1.6, 13, '#7c9e86', 0.0],
      [9.2, 1.3, 12.2, '#c7745a', 0.15],
      [8.6, 1.8, 11.4, '#e0c07f', -0.1],
    ];
    let y = 0;
    for (const [w, h, d, col, rot] of books) {
      const b = new THREE.Group();
      const cover = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), cover);
      top.position.y = h - 0.09;
      const bot = top.clone();
      bot.position.y = 0.09;
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.25, h, d), cover);
      spine.position.set(-w / 2 + 0.12, h / 2, 0);
      const pages = new THREE.Mesh(new THREE.BoxGeometry(w - 0.5, h - 0.34, d - 0.4), pageMat);
      pages.position.set(0.1, h / 2, 0);
      b.add(top, bot, spine, pages);
      b.position.y = y;
      b.rotation.y = rot;
      y += h;
      g.add(b);
    }
    // 书上放一块积木
    const { geometry, matKeys } = getBrickGeometry('brick_2x2');
    const br = new THREE.Mesh(geometry, materialsFor(matKeys, 'red'));
    br.position.set(1.5, y, 1);
    br.rotation.y = 0.5;
    g.add(br);
    g.position.set(35, TABLE_Y, 14);
    g.rotation.y = -0.35;
    this.root.add(shadowAll(g));
  }

  buildPaper() {
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 13.3),
      new THREE.MeshStandardMaterial({ map: sketchTexture(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = 0.28;
    paper.position.set(-29, TABLE_Y + 0.03, -3);
    paper.receiveShadow = true;
    this.root.add(paper);
    // 铅笔
    const pencil = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9, 6), new THREE.MeshStandardMaterial({ color: '#f2b631', roughness: 0.5 }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 6), new THREE.MeshStandardMaterial({ color: '#e8c9a0', roughness: 0.8 }));
    tip.position.y = 5.1;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#333' }));
    lead.position.y = 5.55;
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.9, 12), new THREE.MeshStandardMaterial({ color: '#f29a9a', roughness: 0.8 }));
    eraser.position.y = -4.9;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 12), new THREE.MeshStandardMaterial({ color: '#cfcfcf', metalness: 0.8, roughness: 0.3 }));
    band.position.y = -4.3;
    pencil.add(body, tip, lead, eraser, band);
    pencil.rotation.z = Math.PI / 2;
    pencil.rotation.y = -0.5;
    pencil.position.set(-25, TABLE_Y + 0.36, 5);
    this.root.add(shadowAll(pencil));
  }

  placeLoose(group, typeId, color, x, z, ry, onSide = false, y = 0) {
    const { geometry, matKeys } = getBrickGeometry(typeId);
    const m = new THREE.Mesh(geometry, materialsFor(matKeys, color));
    const t = BRICK_MAP[typeId];
    if (onSide) {
      const holder = new THREE.Group();
      m.rotation.z = Math.PI / 2;
      m.position.set((t.h * LAYER) / 2, t.w / 2, 0);
      holder.add(m);
      holder.position.set(x, TABLE_Y + y, z);
      holder.rotation.y = ry;
      group.add(holder);
    } else {
      m.position.set(x, TABLE_Y + y, z);
      m.rotation.y = ry;
      group.add(m);
    }
    m.castShadow = true;
    m.receiveShadow = true;
  }

  buildLooseBricks() {
    const g = new THREE.Group();
    const list = [
      ['brick_2x4', 'red', -21, -6, 0.4],
      ['brick_2x2', 'yellow', -20.5, 3, 1.1],
      ['slope_2x2', 'blue', -22, 9, 2.2],
      ['plate_2x4', 'green', -6, 20, 0.2],
      ['brick_1x4', 'white', 3, 21, -0.3, true],
      ['round_1x1', 'orange', 9, 20, 0],
      ['brick_2x3', 'sky', 20, 9, 0.8],
      ['tile_2x2', 'pink', 21, 13.5, 0.3],
      ['brick_1x2', 'lime', 19.5, -9, 1.9, true],
      ['plate_1x4', 'tan', -8, -20, 1.3],
      ['brick_2x2', 'coral', 10, -20.5, 0.6],
      ['cone_1x1', 'yellow', 13, -21, 0],
      ['flower_1x1', 'pink', -14, 21, 0],
    ];
    for (const [t, c, x, z, r, side] of list) this.placeLoose(g, t, c, x, z, r, side);
    // 叠放的小堆
    this.placeLoose(g, 'brick_2x4', 'navy', 22.5, -2, 0.1);
    this.placeLoose(g, 'brick_2x2', 'yellow', 22.6, -2.6, 0.1, false, 1.2);

    // 木头收纳盒
    const box = new THREE.Group();
    const tex = woodTexture({ base: '#d6b083', dark: '#a7814f', light: '#ead0a8', seed: 33 });
    const wm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const W = 11, D = 9, H = 3;
    const parts = [
      [W, 0.5, D, 0, 0.25, 0],
      [W, H, 0.5, 0, H / 2, -D / 2 + 0.25],
      [W, H, 0.5, 0, H / 2, D / 2 - 0.25],
      [0.5, H, D, -W / 2 + 0.25, H / 2, 0],
      [0.5, H, D, W / 2 - 0.25, H / 2, 0],
    ];
    for (const [w, h, d, x, y, z] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wm);
      m.position.set(x, y, z);
      box.add(m);
    }
    const inside = [
      ['brick_2x4', 'red', -2.5, -1.5, 0.2, 0.5],
      ['brick_2x2', 'blue', 1.8, -2, 1.2, 0.5],
      ['plate_2x4', 'yellow', 0, 2, 0.6, 0.5],
      ['brick_1x4', 'green', -3, 2, 1.6, 0.5],
      ['slope_2x2', 'orange', 3, 1.5, 0.9, 0.5],
      ['brick_2x3', 'white', -0.5, -0.5, 2.6, 1.6],
      ['round_2x2', 'lavender', 2.5, -1.2, 0.3, 1.5],
      ['brick_1x2', 'tan', -2.5, 1.5, 0.9, 1.7],
      ['tile_1x4', 'sky', 0.8, 2.6, 1.4, 1.9],
    ];
    for (const [t, c, x, z, r, y] of inside) this.placeLoose(box, t, c, x, z, r, false, y - TABLE_Y);
    box.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    box.position.set(29, TABLE_Y, -4);
    box.rotation.y = -0.25;
    g.add(box);
    this.root.add(g);
  }

  buildShelf() {
    const g = new THREE.Group();
    const tex = woodTexture({ base: '#b98557', dark: '#8c5b35', light: '#d4a376', seed: 51 });
    const wm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 5), wm);
    board.position.set(26, 31, -35.3);
    g.add(board);
    for (const x of [16, 36]) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 3.5), wm);
      br.position.set(x, 29.1, -35.8);
      g.add(br);
    }
    const cols = [['#7c9e86', '积木书'], ['#c7745a', '小屋'], ['#e0c07f', '暖阳'], ['#6f86b5', '星空'], ['#b98aa8', '花园'], ['#d9a066', '故事']];
    let x = 15;
    cols.forEach(([c, title], i) => {
      const h = 5 + (i % 3) * 0.8, w = 1 + (i % 2) * 0.35;
      const spineTex = bookSpineTexture(c, title);
      spineTex.rotation = Math.PI / 2;
      spineTex.center.set(0.5, 0.5);
      const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
      const front = new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.75 });
      const mats = [mat, mat, mat, mat, front, mat];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), mats);
      x += w / 2 + 0.1;
      b.position.set(x, 31.45 + h / 2, -35.3);
      if (i === 5) {
        b.rotation.z = -0.25;
        b.position.x += 0.6;
      }
      x += w / 2;
      g.add(b);
    });
    // 架子上的积木小塔
    const tower = [['brick_2x2', 'red'], ['brick_2x2', 'yellow'], ['brick_2x2', 'blue'], ['round_2x2', 'green'], ['cone_1x1', 'orange']];
    let y = 31.45;
    for (const [t, c] of tower) {
      const { geometry, matKeys } = getBrickGeometry(t);
      const m = new THREE.Mesh(geometry, materialsFor(matKeys, c));
      m.position.set(31, y, -35);
      m.rotation.y = 0.4;
      y += BRICK_MAP[t].h * LAYER;
      g.add(m);
    }
    const vase = this.makePot(1.3, 3.6, '#f0e2d0');
    vase.position.set(35.5, 31.45, -35.3);
    g.add(vase);

    // 画框
    const frameMat = new THREE.MeshStandardMaterial({ color: '#7a5233', roughness: 0.5 });
    const addFrame = (w, h, x, y, kind) => {
      const fr = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, h + 1.6, 0.6), frameMat);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: paintingTexture(kind), roughness: 0.85 }));
      pic.position.z = 0.31;
      fr.add(back, pic);
      fr.position.set(x, y, -37.6);
      g.add(fr);
    };
    addFrame(16, 12, -20, 33, 0);
    addFrame(10, 7.5, 53, 30, 1);
    this.root.add(shadowAll(g));
  }

  buildFairyLights() {
    const pts = [];
    const x0 = -46, x1 = 78;
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const x = x0 + (x1 - x0) * s;
      const seg = (s * 4) % 1;
      const y = 50 - Math.sin(seg * Math.PI) * 4.5;
      pts.push(new THREE.Vector3(x, y, -37.3));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 0.08, 6), new THREE.MeshStandardMaterial({ color: '#3b3a2e', roughness: 0.6 }));
    this.root.add(wire);
    const count = 42;
    const bulbGeo = new THREE.SphereGeometry(0.42, 12, 10);
    bulbGeo.scale(1, 1.25, 1);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const inst = new THREE.InstancedMesh(bulbGeo, mat, count);
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const p = curve.getPoint((i + 0.5) / count);
      m.makeTranslation(p.x, p.y - 0.6, p.z + 0.2);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.root.add(inst);
    this.fairy = inst;
    this.fairyPhase = Array.from({ length: count }, (_, i) => Math.sin(i * 12.9898) * 43758.5453 % 6.28);
    this.fairyCols = ['#ffcf7d', '#ffb36b', '#fff0c4', '#ffd9a0'].map((c) => new THREE.Color(c));
    const pl = new THREE.PointLight('#ffb36b', 0, 120, 2);
    pl.position.set(16, 44, -30);
    this.scene.add(pl);
    this.fairyLight = pl;
  }

  // 窗口投下的光束
  buildShaft() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(4 * 4 * 3);
    const uv = new Float32Array(4 * 4 * 2);
    const idx = [];
    for (let s = 0; s < 4; s++) {
      const b = s * 4;
      uv.set([0, 0, 1, 0, 0, 1, 1, 1], s * 8);
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.shaftUniforms = { uColor: { value: new THREE.Color('#ffe2b0') }, uOpacity: { value: 0.1 }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.shaftUniforms,
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv; varying vec3 vW;
        void main(){
          float edge = sin(vUv.x*3.14159);
          float along = smoothstep(0.0,0.15,vUv.y) * (1.0 - smoothstep(0.7,1.0,vUv.y));
          float streak = 0.75 + 0.25*sin(vW.z*0.9 + vW.y*0.3 + uTime*0.2);
          gl_FragColor = vec4(uColor * uOpacity * edge * along * streak, 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.userData.noAO = true;
    this.root.add(mesh);
    this.shaft = mesh;

    // 漂浮的灰尘
    const N = 320;
    const dg = new THREE.BufferGeometry();
    this.dustBase = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) this.dustBase.set([Math.random(), Math.random(), 0.12 + Math.random() * 0.8, Math.random() * 6.28], i * 4);
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.dust = new THREE.Points(
      dg,
      new THREE.PointsMaterial({
        size: 0.28,
        map: softDotTexture(),
        color: '#fff2d2',
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    this.dust.frustumCulled = false;
    this.root.add(this.dust);
  }

  updateShaft() {
    const dir = this.state.sunPos.clone().negate().normalize();
    const corners = [
      [WIN.z0, WIN.y0], [WIN.z1, WIN.y0], [WIN.z1, WIN.y1], [WIN.z0, WIN.y1],
    ];
    const wallPts = corners.map(([z, y]) => new THREE.Vector3(WIN.x, y, z));
    const floorPts = wallPts.map((p) => {
      const t = (TABLE_Y - p.y) / dir.y;
      return p.clone().addScaledVector(dir, t);
    });
    this.shaftWall = wallPts;
    this.shaftFloor = floorPts;
    const pos = this.shaft.geometry.attributes.position;
    for (let s = 0; s < 4; s++) {
      const a = s, b = (s + 1) % 4;
      const verts = [wallPts[a], wallPts[b], floorPts[a], floorPts[b]];
      verts.forEach((v, k) => pos.setXYZ(s * 4 + k, v.x, v.y, v.z));
    }
    pos.needsUpdate = true;
  }

  applyState(s) {
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunI;
    this.sun.position.copy(s.sunPos);
    this.hemi.color.copy(s.sky);
    this.hemi.groundColor.copy(s.ground);
    this.hemi.intensity = s.hemiI;
    this.fillLight.intensity = s.fill;
    this.scene.environmentIntensity = s.env;
    this.renderer.toneMappingExposure = s.exposure;
    if (!this.scene.background) this.scene.background = new THREE.Color();
    this.scene.background.copy(s.bg);
    if (this.scene.fog) this.scene.fog.color.copy(s.bg);
    const su = this.skyUniforms;
    su.uTop.value.copy(s.skyTop);
    su.uBottom.value.copy(s.skyBottom);
    su.uSun.value.copy(s.skySun);
    su.uHill1.value.copy(s.hill1);
    su.uHill2.value.copy(s.hill2);
    su.uCloud.value.copy(s.cloud);
    su.uStars.value = s.stars;
    this.shaftUniforms.uColor.value.copy(s.sun);
    this.shaftUniforms.uOpacity.value = s.shaft;
    this.dust.material.opacity = s.dust;
    this.dust.material.color.copy(s.sun).lerp(new THREE.Color('#ffffff'), 0.5);
    this.lampLight.intensity = s.lamp * 2600;
    this.lampGlow.intensity = s.lamp * 60;
    this.bulbMat.color.setRGB(1, 0.95, 0.85).multiplyScalar(0.55 + s.lamp * 3.2);
    this.fairyLight.intensity = s.fairy * 1500;
    this.updateShaft();
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / 1.6);
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      const st = {};
      for (const key in this.target) {
        const a = this.from[key], b = this.target[key];
        if (typeof a === 'number') st[key] = a + (b - a) * k;
        else st[key] = a.clone().lerp(b, k);
      }
      this.state = st;
      this.applyState(st);
    }
    this.skyUniforms.uTime.value = t;
    this.curtainUniforms.uTime.value = t;
    this.shaftUniforms.uTime.value = t;

    // 热气
    for (const s of this.steam) {
      const p = (s.userData.phase + t * 0.12) % 1;
      s.position.set(
        this.mugTop.x + Math.sin(p * 6 + s.userData.phase * 10) * 0.8 * p,
        this.mugTop.y + p * 8,
        this.mugTop.z + Math.cos(p * 5 + s.userData.phase * 7) * 0.6 * p
      );
      s.scale.setScalar(1 + p * 3.5);
      s.material.opacity = Math.sin(p * Math.PI) * 0.16;
    }

    // 灰尘
    const pos = this.dust.geometry.attributes.position;
    const W = this.shaftWall, F = this.shaftFloor;
    if (W) {
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const u = this.dustBase[i * 4], v = this.dustBase[i * 4 + 1], l = this.dustBase[i * 4 + 2], ph = this.dustBase[i * 4 + 3];
        a.copy(W[0]).lerp(W[1], u);
        b.copy(W[3]).lerp(W[2], u);
        a.lerp(b, v);
        c.copy(F[0]).lerp(F[1], u);
        b.copy(F[3]).lerp(F[2], u);
        c.lerp(b, v);
        a.lerp(c, l);
        pos.setXYZ(i, a.x + Math.sin(t * 0.3 + ph) * 1.2, a.y + Math.sin(t * 0.21 + ph * 2) * 1.5, a.z + Math.cos(t * 0.25 + ph) * 1.2);
      }
      pos.needsUpdate = true;
    }

    // 串灯闪烁
    const f = this.state.fairy;
    const col = new THREE.Color();
    for (let i = 0; i < this.fairy.count; i++) {
      const tw = 0.75 + 0.25 * Math.sin(t * 1.7 + this.fairyPhase[i]) * Math.sin(t * 0.6 + i);
      col.copy(this.fairyCols[i % 4]);
      const lit = 0.35 + f * 3.5 * tw;
      col.multiplyScalar(lit);
      this.fairy.setColorAt(i, col);
    }
    this.fairy.instanceColor.needsUpdate = true;
  }
}
