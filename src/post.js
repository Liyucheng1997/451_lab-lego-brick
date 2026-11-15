import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';

// AO 只考虑实体：先隐藏半透明预览、精灵等，算完再恢复
class VisibilityPass extends Pass {
  constructor(scene, shared, hide) {
    super();
    this.scene = scene;
    this.shared = shared;
    this.hide = hide;
    this.needsSwap = false;
  }
  render() {
    if (this.hide) {
      const list = (this.shared.list = []);
      this.scene.traverse((o) => {
        if (o.visible && (o.userData.noAO || o.isSprite || (o.isMesh && o.material && !Array.isArray(o.material) && o.material.transparent && o.material.opacity < 0.9))) {
          o.visible = false;
          list.push(o);
        }
      });
    } else {
      for (const o of this.shared.list || []) o.visible = true;
      this.shared.list = [];
    }
  }
}

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = null;
  }

  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q;
    const r = this.renderer;
    const dpr = window.devicePixelRatio || 1;
    r.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.5) : 1);
    this.build();
  }

  build() {
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const pr = r.getPixelRatio();
    this.composer?.dispose?.();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
      type: THREE.HalfFloatType,
      samples: this.quality === 'low' ? 0 : 4,
    });
    const c = new EffectComposer(r, rt);
    c.setPixelRatio(pr);
    c.setSize(size.x, size.y);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = null;
    if (this.quality === 'high') {
      const shared = {};
      c.addPass(new VisibilityPass(this.scene, shared, true));
      const g = new GTAOPass(this.scene, this.camera, size.x * pr, size.y * pr, undefined, {
        radius: 0.55,
        distanceExponent: 1.4,
        thickness: 1.2,
        scale: 1.15,
        samples: 12,
        distanceFallOff: 1,
        screenSpaceRadius: false,
      });
      g.blendIntensity = 0.9;
      c.addPass(g);
      c.addPass(new VisibilityPass(this.scene, shared, false));
      this.gtao = g;
    }
    if (this.quality !== 'low') {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.28, 0.5, 1.15);
      c.addPass(this.bloom);
    }
    c.addPass(new OutputPass());
    this.composer = c;
  }

  setSize(w, h) {
    this.composer?.setSize(w, h);
  }

  render(dt) {
    this.composer.render(dt);
  }
}
