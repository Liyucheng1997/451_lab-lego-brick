import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Room } from './scene/room.js';
import { BrickWorld } from './world.js';
import { Effects } from './fx.js';
import { GameAudio } from './audio.js';
import { Thumbnailer } from './thumbs.js';
import { Interaction, reasonText } from './interaction.js';
import { Hud } from './ui/hud.js';
import { Post } from './post.js';
import { FreeMode, BuildMode, LevelMode } from './modes.js';
import { BLUEPRINTS, makeSteps, modelBounds } from './data/blueprints.js';
import { LEVELS } from './data/levels.js';
import { BRICK_MAP, BRICKS, rotatedDims } from './bricks/catalog.js';
import { PALETTE, COLOR_MAP } from './bricks/materials.js';

const SETTINGS_KEY = 'nuanguang.settings.v1';
const PROGRESS_KEY = 'nuanguang.progress.v1';
const TIME_ORDER = ['day', 'dusk', 'night'];

function loadJSON(key, fallback) {
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(key) || 'null') || {}) };
  } catch (e) {
    return { ...fallback };
  }
}
function saveJSON(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    /* ignore */
  }
}

class Game {
  constructor() {
    this.settings = loadJSON(SETTINGS_KEY, { quality: 'high', time: 'day', music: true, sfx: true, base: '#7fae6a' });
    this.progress = loadJSON(PROGRESS_KEY, { levels: {}, blueprints: {} });

    const canvas = document.getElementById('scene');
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#e9d3b6', 160, 420);
    this.camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.5, 900);
    this.camera.position.set(-20, 30, 40);

    const c = (this.controls = new OrbitControls(this.camera, canvas));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 7;
    c.maxDistance = 120;
    c.maxPolarAngle = 1.42;
    c.minPolarAngle = 0.12;
    c.screenSpacePanning = true;
    c.rotateSpeed = 0.7;
    c.zoomSpeed = 0.9;
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.addEventListener('start', () => {
      this.camTween = null;
      if (this.mode) c.autoRotate = false;
    });

    this.room = new Room(this.scene, r);
    this.world = new BrickWorld(this.scene);
    this.fx = new Effects(this.scene);
    this.audio = new GameAudio();
    this.audio.sfxOn = this.settings.sfx;
    this.audio.musicOn = this.settings.music;
    this.thumbs = new Thumbnailer();
    this.interaction = new Interaction(this);
    this.post = new Post(r, this.scene, this.camera);
    this.room.setTime(this.settings.time, true);
    this.audio.timeOfDay = this.settings.time;
    this.hud = new Hud(this);
    this.applyQuality(this.settings.quality);
    this.setColor('red', true);

    this.world.onChange(() => this.refreshUndo());
    window.addEventListener('resize', () => this.onResize());
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.perf = { t: 0, frames: 0, sum: 0, checked: false };

    this.startMenu();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    setTimeout(() => document.getElementById('loading').classList.add('fade'), 350);
    setTimeout(() => document.getElementById('loading').remove(), 1400);
  }

  // ---------- 设置 ----------
  applyQuality(q) {
    this.post.setQuality(q);
    this.room.setShadowQuality(q);
  }
  applySetting(key, v) {
    this.settings[key] = v;
    saveJSON(SETTINGS_KEY, this.settings);
    if (key === 'quality') {
      this.settings.userQuality = true;
      saveJSON(SETTINGS_KEY, this.settings);
      this.applyQuality(v);
    }
    if (key === 'time') this.setTime(v);
    if (key === 'music') {
      this.audio.ensure();
      this.audio.setMusic(v);
    }
    if (key === 'sfx') this.audio.setSfx(v);
    if (key === 'base' && this.mode?.name === 'free') {
      this.world.setBase(32, v);
    }
  }
  setTime(name) {
    this.room.setTime(name);
    this.audio.timeOfDay = name;
    this.settings.time = name;
    saveJSON(SETTINGS_KEY, this.settings);
    this.hud.updateTime();
  }
  cycleTime() {
    const i = TIME_ORDER.indexOf(this.room.timeName);
    const next = TIME_ORDER[(i + 1) % TIME_ORDER.length];
    this.setTime(next);
    this.toast({ day: '☀️ 午后暖阳', dusk: '🌇 黄昏时分', night: '🌙 夜晚，台灯亮起来了' }[next]);
  }
  setProgress(kind, id, value) {
    this.progress[kind] = this.progress[kind] || {};
    this.progress[kind][id] = value;
    saveJSON(PROGRESS_KEY, this.progress);
  }

  // ---------- 场景切换 ----------
  startMenu() {
    this.mode?.exit();
    this.mode = null;
    this.fx.clear();
    this.interaction.enabled = false;
    this.interaction.update();
    this.hud.showHud(false);
    this.hud.hideSelects();
    this.hud.showMenu(true);
    this.hud.setSide(null);
    // 菜单背景：展示一座小屋
    const bp = BLUEPRINTS.find((b) => b.id === 'cottage');
    const list = bp.build();
    const bd = modelBounds(list, BRICK_MAP, rotatedDims);
    const size = 24;
    const ox = Math.floor((size - bd.w) / 2), oz = Math.floor((size - bd.d) / 2);
    this.world.setBase(size, '#7fae6a');
    this.world.clear();
    this.world.load(list.map((p) => ({ ...p, x: p.x + ox, z: p.z + oz })));
    this.flyTo(new THREE.Vector3(0, 3, 0), new THREE.Vector3(-26, 22, 34), 1.6);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    this.menuOffset = true;
    this.applyViewOffset();
  }

  applyViewOffset() {
    const w = window.innerWidth, h = window.innerHeight;
    if (this.menuOffset && w > 820) this.camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else if (!this.menuOffset && this.mode?.viewShift && w > 860) this.camera.setViewOffset(w, h, -this.mode.viewShift, 0, w, h);
    else this.camera.clearViewOffset();
  }

  enterMode(mode) {
    this.mode?.exit();
    this.fx.clear();
    this.hud.closeModal?.();
    this.hud.hideSelects();
    this.hud.showMenu(false);
    this.hud.showHud(true);
    this.controls.autoRotate = false;
    this.menuOffset = false;
    this.applyViewOffset();
    this.mode = mode;
    mode.enter();
    this.applyViewOffset();
    this.hud.markColor(this.interaction.color);
    this.interaction.enabled = true;
    this.refreshUndo();
    this.audio.ensure();
  }

  chooseMode(m) {
    if (m === 'free') return this.startFree();
    if (m === 'build') {
      if (!this.bpInfo) {
        this.bpInfo = BLUEPRINTS.map((bp) => {
          const list = bp.build();
          return { ...bp, thumb: this.thumbs.model(list, 300), count: list.length, steps: makeSteps(list).length };
        });
      }
      if (this.mode) this.startMenu();
      this.hud.showBlueprints(this.bpInfo, this.progress, (id) => this.startBuild(id));
    }
    if (m === 'level') {
      if (this.mode) this.startMenu();
      this.hud.showLevels(LEVELS, this.progress, (i) => this.startLevel(i));
    }
  }
  async startFree(preload) {
    this.enterMode(new FreeMode(this));
    if (preload && preload.length) {
      const hadOld = this.world.bricks.size > 0;
      if (hadOld && !(await this.hud.confirm('把模型搬过来？', '自由模式桌面上原来的作品会被替换（可以先导出备份）。', '替换'))) return;
      this.world.clear();
      this.world.load(preload.map((p) => ({ ...p, x: p.x + 4, z: p.z + 4 })), { animate: true });
      this.refreshUndo();
    }
  }
  startBuild(id) {
    const bp = BLUEPRINTS.find((b) => b.id === id);
    this.enterMode(new BuildMode(this, bp));
  }
  startLevel(i) {
    this.enterMode(new LevelMode(this, i));
  }

  async onEscape(fromButton) {
    if (document.getElementById('hud').classList.contains('photo')) {
      this.togglePhoto();
      return;
    }
    if (!document.getElementById('modal').classList.contains('hidden')) {
      this.hud.closeModal?.();
      return;
    }
    if (!this.mode) return;
    const busy = (this.mode.name === 'build' && this.mode.placedCount > 0 && this.mode.stepIdx < this.mode.steps.length) ||
      (this.mode.name === 'level' && !this.mode.done && this.mode.playerBricks().length > 0);
    if (busy && !(await this.hud.confirm('返回主菜单？', '当前这一局的进度不会保存。', '返回'))) return;
    this.startMenu();
  }

  // ---------- 相机 ----------
  flyTo(target, pos, dur = 1.2) {
    this.camTween = {
      t: 0,
      dur,
      fromT: this.controls.target.clone(),
      fromP: this.camera.position.clone(),
      toT: target.clone(),
      toP: pos.clone(),
    };
  }
  frameCamera(size, ty = 0) {
    const dir = new THREE.Vector3(-0.42, 0.66, 0.86).normalize();
    const dist = size * 1.18 + 8;
    const target = new THREE.Vector3(0, ty, 0);
    this.home = { target, pos: target.clone().addScaledVector(dir, dist) };
    this.flyTo(this.home.target, this.home.pos);
  }
  resetCamera() {
    if (this.home) this.flyTo(this.home.target, this.home.pos, 0.9);
  }

  // ---------- 积木操作 ----------
  placeBrick(p) {
    const mode = this.mode;
    if (!mode) return;
    let data = { type: p.type, color: p.color || this.interaction.color, x: p.x, y: p.y, z: p.z, rot: p.rot };
    if (mode.beforePlace) {
      const d = mode.beforePlace(data);
      if (!d) {
        this.audio.error();
        this.toast(reasonText('wrong'));
        return;
      }
      data = d;
    }
    const chk = this.world.check(data.type, data.x, data.y, data.z, data.rot);
    const v = chk.ok && mode.validate ? mode.validate(data) : chk;
    if (!chk.ok || !v.ok) {
      this.audio.error();
      this.toast(reasonText(chk.ok ? v.reason : chk.reason));
      return;
    }
    const brick = this.world.add(data, { animate: true, record: !!mode.undoable });
    this.audio.place();
    mode.afterPlace?.(brick, data);
    this.refreshUndo();
  }
  removeBrick(b) {
    const mode = this.mode;
    if (!mode) return;
    if (mode.canRemove && !mode.canRemove(b)) {
      this.audio.error();
      this.toast(mode.name === 'build' ? '建造模式里跟着图纸拼就好啦' : reasonText('locked'));
      return;
    }
    this.world.remove(b.id, { animate: true, record: !!mode.undoable });
    this.audio.remove();
    this.refreshUndo();
  }
  paintBrick(b, color) {
    if (b.locked) {
      this.toast(reasonText('locked'));
      return;
    }
    if (b.color === color) return;
    this.world.paint(b.id, color, { record: !!this.mode?.undoable });
    this.audio.paint();
  }
  pickBrick(b) {
    if (this.mode?.name === 'level' && !this.mode.types.includes(b.type)) {
      this.setColor(b.color);
      this.toast(`已吸取颜色：${COLOR_MAP[b.color].name}`);
      return;
    }
    this.setBrick(b.type);
    this.setColor(b.color);
    this.interaction.rot = b.rot;
    this.setTool('place');
    this.toast(`已吸取：${COLOR_MAP[b.color].name} ${BRICK_MAP[b.type].name}`);
  }
  undo() {
    if (!this.mode?.undoable) return;
    if (this.world.undo()) this.audio.remove();
    this.refreshUndo();
  }
  redo() {
    if (!this.mode?.undoable) return;
    if (this.world.redo()) this.audio.place();
    this.refreshUndo();
  }
  refreshUndo() {
    this.hud.setUndo(this.world.history.length > 0, this.world.future.length > 0, !!this.mode?.undoable);
  }

  setTool(t) {
    this.interaction.tool = t;
    this.hud.markTool(t);
  }
  setBrick(typeId, silent) {
    this.interaction.setType(typeId);
    const t = BRICK_MAP[typeId];
    if (this.mode?.name === 'free' && this.hud.cat !== t.cat) {
      this.hud.cat = t.cat;
      this.hud.buildPicker(null, null);
    } else this.hud.markBrick(typeId);
    if (!silent && this.interaction.tool !== 'place') this.setTool('place');
  }
  setColor(c, silent) {
    this.interaction.setColor(c);
    this.hud.markColor(c);
    if (!silent || this.mode) this.hud.renderGrid();
  }
  cycleBrick(dir) {
    const list = this.hud.visibleTypes();
    if (!list.length || this.mode?.name === 'build') return;
    const i = list.findIndex((b) => b.id === this.interaction.typeId);
    this.setBrick(list[(i + dir + list.length) % list.length].id);
  }
  cycleColor(dir) {
    if (this.mode?.name === 'build') return;
    const i = PALETTE.findIndex((c) => c.id === this.interaction.color);
    this.setColor(PALETTE[(i + dir + PALETTE.length) % PALETTE.length].id);
  }

  // ---------- 其他 ----------
  toast(msg) {
    this.hud.toast(msg);
  }
  togglePhoto() {
    const on = this.hud.togglePhoto();
    if (on) this.toast('按 H 或 Esc 回到界面');
  }
  screenshot() {
    const prev = this.interaction.enabled;
    this.interaction.enabled = false;
    this.interaction.update();
    this.post.render(0);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.interaction.enabled = prev;
    const a = document.createElement('a');
    a.href = url;
    a.download = `暖光积木屋-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:60;pointer-events:none;transition:opacity .5s';
    document.body.appendChild(flash);
    requestAnimationFrame(() => (flash.style.opacity = '0'));
    setTimeout(() => flash.remove(), 600);
    this.audio.ensure() && this.audio.noise(0.08, { freq: 2000, gain: 0.3 });
    this.toast('咔嚓！照片已保存');
  }
  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyViewOffset();
    this.post.setSize(w, h);
  }

  loop() {
    requestAnimationFrame(this.loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);
    this.elapsed += dt;
    const t = this.elapsed;

    if (this.camTween) {
      const k = (this.camTween.t += dt) / this.camTween.dur;
      const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 3);
      this.controls.target.lerpVectors(this.camTween.fromT, this.camTween.toT, e);
      this.camera.position.lerpVectors(this.camTween.fromP, this.camTween.toP, e);
      if (k >= 1) this.camTween = null;
    }
    const tg = this.controls.target;
    tg.x = THREE.MathUtils.clamp(tg.x, -32, 32);
    tg.z = THREE.MathUtils.clamp(tg.z, -28, 28);
    tg.y = THREE.MathUtils.clamp(tg.y, -1, 30);
    this.controls.update();

    this.room.update(dt);
    this.world.update(dt);
    this.fx.update(dt, t);
    this.mode?.update?.(dt, t);
    this.interaction.update();
    this.post.render(dt);

    // 首次运行时自动检测性能，太卡就降低画质
    const p = this.perf;
    // 被浏览器节流（窗口在后台等）的帧不计入
    if (!p.checked && t > 2 && raw < 0.25 && !document.hidden) {
      p.sum += raw;
      p.frames++;
      if (p.frames >= 150) {
        p.checked = true;
        const avg = p.sum / p.frames;
        if (avg > 1 / 30 && this.settings.quality !== 'low' && !this.settings.userQuality) {
          const next = this.settings.quality === 'high' ? 'medium' : 'low';
          this.settings.quality = next;
          saveJSON(SETTINGS_KEY, this.settings);
          this.applyQuality(next);
          this.toast(`已自动切换到「${next === 'medium' ? '均衡' : '流畅'}」画质`);
        }
      }
    }
  }
}

try {
  window.__game = new Game();
} catch (e) {
  console.error(e);
  const t = document.querySelector('.loading-text');
  if (t) t.innerHTML = '这台电脑的浏览器没有开启 WebGL（3D 加速），积木屋暂时搭不起来。<br/>请用最新版 Chrome / Edge 打开，并确认“使用图形加速”已开启。';
}
