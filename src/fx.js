import * as THREE from 'three';
import { getBrickGeometry } from './bricks/geometry.js';
import { PALETTE } from './bricks/materials.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.starGeo = makeStarGeometry();
    this.starMat = new THREE.MeshPhysicalMaterial({
      color: '#ffcf4a',
      emissive: '#ffae2a',
      emissiveIntensity: 0.55,
      metalness: 0.6,
      roughness: 0.25,
      clearcoat: 1,
    });
  }

  // ---------- 星星 ----------
  makeStar(pos) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(this.starGeo, this.starMat);
    m.castShadow = true;
    g.add(m);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd27a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    halo.scale.setScalar(2.6);
    g.add(halo);
    g.scale.setScalar(1.45);
    g.position.copy(pos);
    g.userData.base = pos.clone();
    g.userData.phase = Math.random() * 6;
    this.scene.add(g);
    return g;
  }
  collectStar(star) {
    this.items.push({ kind: 'collect', obj: star, t: 0 });
    this.sparkle(star.position, '#ffd66b');
  }
  updateStar(star, t) {
    if (star.userData.collected) return;
    star.children[0].rotation.y = t * 1.6 + star.userData.phase;
    star.position.y = star.userData.base.y + Math.sin(t * 2 + star.userData.phase) * 0.12;
  }

  // ---------- 闪光粒子 ----------
  sparkle(pos, color = '#fff2c4', n = 26) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const v = [];
    for (let i = 0; i < n; i++) {
      p.set([pos.x, pos.y, pos.z], i * 3);
      const d = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 4);
      v.push(d);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size: 0.45, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.items.push({ kind: 'sparkle', obj: pts, v, t: 0 });
  }

  // ---------- 小砖块彩带 ----------
  confetti(center, radius = 10) {
    const n = 140;
    const { geometry } = getBrickGeometry('plate_1x1');
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 0.4 });
    const inst = new THREE.InstancedMesh(geometry, mat, n);
    inst.castShadow = true;
    const parts = [];
    const opaque = PALETTE.filter((c) => !c.trans);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.4;
      parts.push({
        p: new THREE.Vector3(center.x + Math.cos(a) * r, center.y + Math.random() * 2, center.z + Math.sin(a) * r),
        v: new THREE.Vector3(Math.cos(a) * (3 + Math.random() * 6), 10 + Math.random() * 10, Math.sin(a) * (3 + Math.random() * 6)),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
        s: 0.45 + Math.random() * 0.25,
      });
      inst.setColorAt(i, new THREE.Color(opaque[Math.floor(Math.random() * opaque.length)].hex));
    }
    inst.frustumCulled = false;
    this.scene.add(inst);
    this.items.push({ kind: 'confetti', obj: inst, parts, t: 0 });
  }

  // ---------- 雨 ----------
  setRain(region) {
    if (this.rain) {
      this.scene.remove(this.rain.obj);
      this.rain = null;
    }
    if (!region) return;
    const n = 220;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#bcd8f0', transparent: true, opacity: 0.55 }));
    obj.frustumCulled = false;
    this.scene.add(obj);
    const drops = [];
    for (let i = 0; i < n; i++) drops.push({ x: 0, z: 0, y: Math.random() * 14, speed: 14 + Math.random() * 6, floor: 0 });
    this.rain = { obj, drops, region };
    drops.forEach((d) => this.resetDrop(d, true));
  }
  resetDrop(d, init) {
    const r = this.rain.region;
    d.x = r.x0 + Math.random() * (r.x1 - r.x0);
    d.z = r.z0 + Math.random() * (r.z1 - r.z0);
    d.floor = r.floorAt(d.x, d.z);
    d.y = init ? d.floor + Math.random() * (r.top - d.floor) : r.top + Math.random() * 3;
  }

  update(dt, t) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.kind === 'collect') {
        const k = it.t / 0.6;
        it.obj.scale.setScalar(1.45 * (1 + k * 1.2));
        it.obj.position.y += dt * 3;
        it.obj.children[0].rotation.y += dt * 12;
        it.obj.visible = k < 1 ? (k < 0.6 || Math.floor(k * 20) % 2 === 0) : false;
        if (k >= 1) {
          this.scene.remove(it.obj);
          this.items.splice(i, 1);
        }
      } else if (it.kind === 'sparkle') {
        const pos = it.obj.geometry.attributes.position;
        for (let j = 0; j < it.v.length; j++) {
          it.v[j].y -= 6 * dt;
          pos.setXYZ(j, pos.getX(j) + it.v[j].x * dt, pos.getY(j) + it.v[j].y * dt, pos.getZ(j) + it.v[j].z * dt);
        }
        pos.needsUpdate = true;
        it.obj.material.opacity = Math.max(0, 1 - it.t / 0.9);
        if (it.t > 0.9) {
          this.scene.remove(it.obj);
          it.obj.geometry.dispose();
          this.items.splice(i, 1);
        }
      } else if (it.kind === 'confetti') {
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const s = new THREE.Vector3();
        it.parts.forEach((p, j) => {
          if (p.p.y > 0.1) {
            p.v.y -= 22 * dt;
            p.v.multiplyScalar(1 - dt * 0.6);
            p.p.addScaledVector(p.v, dt);
            p.r.x += p.w.x * dt;
            p.r.y += p.w.y * dt;
            p.r.z += p.w.z * dt;
          } else {
            p.p.y = 0.05;
          }
          q.setFromEuler(p.r);
          const fade = it.t > 3.2 ? Math.max(0.001, 1 - (it.t - 3.2) / 0.8) : 1;
          s.setScalar(p.s * fade);
          m.compose(p.p, q, s);
          it.obj.setMatrixAt(j, m);
        });
        it.obj.instanceMatrix.needsUpdate = true;
        if (it.t > 4) {
          this.scene.remove(it.obj);
          this.items.splice(i, 1);
        }
      }
    }
    if (this.rain) {
      const pos = this.rain.obj.geometry.attributes.position;
      this.rain.drops.forEach((d, j) => {
        d.y -= d.speed * dt;
        if (d.y < d.floor) this.resetDrop(d, false);
        pos.setXYZ(j * 2, d.x, d.y, d.z);
        pos.setXYZ(j * 2 + 1, d.x - 0.05, Math.max(d.floor, d.y - 0.6), d.z);
      });
      pos.needsUpdate = true;
    }
  }

  clear() {
    for (const it of this.items) this.scene.remove(it.obj);
    this.items = [];
    this.setRain(null);
  }
}

function makeStarGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 === 0 ? 0.62 : 0.27;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 });
  g.center();
  return g;
}

let _glow = null;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}
