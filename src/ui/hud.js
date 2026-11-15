import { ICONS } from './icons.js';
import { BRICKS, CATEGORIES } from '../bricks/catalog.js';
import { PALETTE } from '../bricks/materials.js';

const $ = (id) => document.getElementById(id);

export const TOOL_DEFS = [
  { id: 'place', name: '放置', icon: 'brick', key: '1' },
  { id: 'remove', name: '拆除', icon: 'hammer', key: '2' },
  { id: 'paint', name: '上色', icon: 'brush', key: '3' },
  { id: 'pick', name: '吸管', icon: 'dropper', key: '4' },
];

export class Hud {
  constructor(game) {
    this.game = game;
    this.cat = 'brick';
    this.counts = null;
    this.allowedTypes = null;
    for (const [id, icon] of [
      ['btn-back', 'back'], ['btn-undo', 'undo'], ['btn-redo', 'redo'], ['btn-clear', 'trash'], ['btn-export', 'download'],
      ['btn-import', 'upload'], ['btn-cam', 'target'], ['btn-photo', 'camera'], ['btn-help', 'help'], ['btn-settings', 'settings'],
    ])
      $(id).innerHTML = ICONS[icon];
    const on = (id, fn) => $(id).addEventListener('click', () => {
      game.audio.ui();
      fn();
    });
    on('btn-back', () => game.onEscape(true));
    on('btn-undo', () => game.undo());
    on('btn-redo', () => game.redo());
    on('btn-clear', () => game.mode?.clearAll?.());
    on('btn-export', () => game.mode?.exportFile?.());
    on('btn-import', () => $('file-input').click());
    on('btn-cam', () => game.resetCamera());
    on('btn-photo', () => game.screenshot());
    on('btn-help', () => this.showHelp());
    on('btn-settings', () => this.showSettings());
    on('btn-time', () => game.cycleTime());
    on('menu-time', () => game.cycleTime());
    on('menu-settings', () => this.showSettings());
    on('menu-help', () => this.showHelp());
    $('file-input').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) game.mode?.importFile?.(f);
      e.target.value = '';
    });
    document.querySelectorAll('.mode-card').forEach((b) =>
      b.addEventListener('click', () => {
        game.audio.ui();
        game.chooseMode(b.dataset.mode);
      })
    );
    document.querySelectorAll('[data-close]').forEach((b) =>
      b.addEventListener('click', () => {
        game.audio.ui();
        b.closest('.screen').classList.add('hidden');
      })
    );
    $('side').addEventListener('click', (e) => {
      const a = e.target.closest('[data-action]');
      if (a) {
        game.audio.ui();
        game.mode?.onAction?.(a.dataset.action, a.dataset);
      }
    });
    this.buildTools();
    this.buildPalette();
    this.updateTime();
  }

  // ---------- 屏幕切换 ----------
  showMenu(v) {
    $('menu').classList.toggle('hidden', !v);
  }
  showHud(v) {
    $('hud').classList.toggle('hidden', !v);
  }
  hideSelects() {
    $('select-build').classList.add('hidden');
    $('select-level').classList.add('hidden');
  }
  setModeChip(title, sub = '') {
    $('mode-chip').innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
  }
  setFreeButtons(v) {
    document.querySelectorAll('.free-only').forEach((e) => e.classList.toggle('hidden', !v));
  }
  setUndo(canUndo, canRedo, visible = true) {
    $('btn-undo').classList.toggle('hidden', !visible);
    $('btn-redo').classList.toggle('hidden', !visible);
    $('btn-undo').disabled = !canUndo;
    $('btn-redo').disabled = !canRedo;
  }
  updateTime() {
    const t = this.game.room?.timeName || 'day';
    const icon = t === 'day' ? 'sun' : t === 'dusk' ? 'dusk' : 'moon';
    $('btn-time').innerHTML = ICONS[icon];
    const label = { day: '午后暖阳', dusk: '黄昏', night: '夜晚台灯' }[t];
    $('btn-time').title = `时间：${label}（点击切换）`;
    $('menu-time').textContent = `时间：${label}`;
  }
  setHint(text) {
    $('hint-line').textContent = text;
  }

  // ---------- 积木选择 ----------
  showPicker(v) {
    $('picker').classList.toggle('hidden', !v);
  }
  buildPicker(allowedTypes = null, counts = null) {
    this.allowedTypes = allowedTypes;
    this.counts = counts;
    const cats = CATEGORIES.filter((c) => BRICKS.some((b) => b.cat === c.id && (!allowedTypes || allowedTypes.includes(b.id))));
    if (!cats.find((c) => c.id === this.cat)) this.cat = cats[0]?.id;
    const tabs = $('cat-tabs');
    tabs.classList.toggle('hidden', !!allowedTypes);
    tabs.innerHTML = cats.map((c) => `<button data-cat="${c.id}" class="${c.id === this.cat ? 'on' : ''}">${c.name}</button>`).join('');
    tabs.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        this.game.audio.ui();
        this.cat = b.dataset.cat;
        this.buildPicker(this.allowedTypes, this.counts);
      })
    );
    this.renderGrid();
  }
  visibleTypes() {
    return BRICKS.filter((b) => (this.allowedTypes ? this.allowedTypes.includes(b.id) : b.cat === this.cat));
  }
  renderGrid() {
    const grid = $('brick-grid');
    const sel = this.game.interaction.typeId;
    const color = this.game.interaction.color;
    grid.innerHTML = this.visibleTypes()
      .map((b) => {
        const c = this.counts ? this.counts[b.id] : undefined;
        const badge = c === undefined || c < 0 ? '' : `<em class="count">${c}</em>`;
        return `<button class="brick-tile ${b.id === sel ? 'on' : ''} ${c === 0 ? 'empty' : ''}" data-type="${b.id}" title="${b.name}">
          ${badge}<img src="${this.game.thumbs.brick(b.id, color === 'tclear' || color === 'tblue' || color === 'torange' ? 'white' : color)}" alt="" /><span>${b.name}</span></button>`;
      })
      .join('');
    grid.querySelectorAll('.brick-tile').forEach((el) =>
      el.addEventListener('click', () => {
        this.game.audio.ui();
        this.game.setBrick(el.dataset.type);
      })
    );
  }
  updateCounts(counts) {
    this.counts = counts;
    this.renderGrid();
  }
  markBrick(typeId) {
    document.querySelectorAll('.brick-tile').forEach((el) => el.classList.toggle('on', el.dataset.type === typeId));
  }

  // ---------- 工具与颜色 ----------
  buildTools(allowed = ['place', 'remove', 'paint', 'pick']) {
    const el = $('tools');
    const tools = TOOL_DEFS.filter((t) => allowed.includes(t.id));
    el.innerHTML =
      tools.map((t) => `<button class="tool" data-tool="${t.id}" title="${t.name} (${t.key})">${ICONS[t.icon]}${t.name}</button>`).join('') +
      `<button class="tool" data-rotate="1" title="旋转 (R)">${ICONS.rotate}旋转</button>`;
    el.querySelectorAll('[data-tool]').forEach((b) =>
      b.addEventListener('click', () => {
        this.game.audio.ui();
        this.game.setTool(b.dataset.tool);
      })
    );
    el.querySelector('[data-rotate]').addEventListener('click', () => this.game.interaction.rotate(1));
    this.markTool(this.game.interaction?.tool || 'place');
  }
  showRotate(v) {
    const r = $('tools').querySelector('[data-rotate]');
    if (r) r.classList.toggle('hidden', !v);
  }
  markTool(id) {
    document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === id));
  }
  buildPalette() {
    const el = $('palette');
    el.innerHTML = PALETTE.map((c) => `<button class="swatch ${c.trans ? 'trans' : ''}" data-color="${c.id}" title="${c.name}" style="background:${c.hex}"></button>`).join('');
    el.querySelectorAll('.swatch').forEach((b) =>
      b.addEventListener('click', () => {
        this.game.audio.ui();
        this.game.setColor(b.dataset.color);
      })
    );
  }
  markColor(id) {
    document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b.dataset.color === id));
  }
  lockPalette(v) {
    $('palette').classList.toggle('locked', v);
  }
  showBottom(v) {
    document.querySelector('.bottombar').classList.toggle('hidden', !v);
  }

  // ---------- 右侧信息卡 ----------
  setSide(html) {
    const s = $('side');
    if (!html) {
      s.classList.add('hidden');
      return;
    }
    s.classList.remove('hidden');
    s.innerHTML = html;
  }

  // ---------- 弹窗 ----------
  toast(msg, ms = 1800) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('show'), ms);
  }
  modal(html, actions = [], { dismiss = true } = {}) {
    return new Promise((resolve) => {
      const m = $('modal');
      const body = $('modal-body');
      body.innerHTML =
        html +
        (actions.length
          ? `<div class="modal-actions">${actions.map((a) => `<button class="btn ${a.primary ? 'primary' : ''}" data-act="${a.id}">${a.label}</button>`).join('')}</div>`
          : '');
      m.classList.remove('hidden');
      const close = (v) => {
        m.classList.add('hidden');
        m.onclick = null;
        resolve(v);
      };
      body.querySelectorAll('[data-act]').forEach((b) =>
        b.addEventListener('click', () => {
          this.game.audio.ui();
          close(b.dataset.act);
        })
      );
      m.onclick = (e) => {
        if (dismiss && e.target === m) close(null);
      };
      this.modalBody = body;
      this.closeModal = () => close(null);
    });
  }
  confirm(title, text, okLabel = '确定') {
    return this.modal(`<h2>${title}</h2><p>${text}</p>`, [
      { id: 'cancel', label: '取消' },
      { id: 'ok', label: okLabel, primary: true },
    ]).then((r) => r === 'ok');
  }

  showHelp() {
    this.modal(
      `<h2>操作说明</h2>
      <div class="keys">
        <kbd>左键单击</kbd><span>放置积木（或使用当前工具）</span>
        <kbd>右键单击</kbd><span>拆掉鼠标下的积木</span>
        <kbd>左键拖动</kbd><span>旋转视角</span>
        <kbd>右键拖动</kbd><span>平移视角</span>
        <kbd>滚轮</kbd><span>拉近 / 拉远</span>
        <kbd>R / Shift+R</kbd><span>旋转积木朝向</span>
        <kbd>1 2 3 4</kbd><span>放置 / 拆除 / 上色 / 吸管</span>
        <kbd>Q / E</kbd><span>切换上一个 / 下一个积木</span>
        <kbd>Z / C</kbd><span>切换上一个 / 下一个颜色</span>
        <kbd>Ctrl+Z / Ctrl+Y</kbd><span>撤销 / 重做</span>
        <kbd>F</kbd><span>重置视角</span>
        <kbd>H</kbd><span>隐藏界面，安静地欣赏</span>
      </div>
      <p>积木必须扣在凸点上：放在底板上、叠在带凸点的积木上，或者挂在积木下面都可以。光面板和圆顶上面没有凸点哦。</p>`,
      [{ id: 'ok', label: '知道啦', primary: true }]
    );
  }

  showSettings() {
    const g = this.game;
    const s = g.settings;
    const seg = (key, opts) =>
      `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    this.modal(
      `<h2>设置</h2>
      <div class="set-row"><span>画质</span>${seg('quality', [['high', '精致'], ['medium', '均衡'], ['low', '流畅']])}</div>
      <div class="set-row"><span>时间</span>${seg('time', [['day', '午后'], ['dusk', '黄昏'], ['night', '夜晚']])}</div>
      <div class="set-row"><span>背景音乐</span>${seg('music', [[true, '开'], [false, '关']])}</div>
      <div class="set-row"><span>音效</span>${seg('sfx', [[true, '开'], [false, '关']])}</div>
      <div class="set-row"><span>自由模式底板</span>${seg('base', [['#7fae6a', '草绿'], ['#e2cda2', '奶茶'], ['#9fbec9', '雾蓝'], ['#f4f1ea', '奶白']])}</div>`,
      [{ id: 'ok', label: '完成', primary: true }]
    );
    this.modalBody.querySelectorAll('.seg').forEach((segEl) =>
      segEl.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          g.audio.ui();
          let v = b.dataset.v;
          if (v === 'true') v = true;
          if (v === 'false') v = false;
          g.applySetting(segEl.dataset.key, v);
          segEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        })
      )
    );
  }

  // ---------- 图纸 / 关卡选择 ----------
  showBlueprints(list, progress, onPick) {
    const grid = $('bp-grid');
    grid.innerHTML = list
      .map(
        (bp) => `<button class="bp-card" data-id="${bp.id}">
          ${progress.blueprints?.[bp.id] ? '<span class="done">已完成</span>' : ''}
          <div class="thumb"><img src="${bp.thumb}" alt="" /></div>
          <div class="info"><b>${bp.name}</b><p>${bp.desc}</p>
          <div class="meta"><span class="diff">${'★'.repeat(bp.difficulty)}${'☆'.repeat(3 - bp.difficulty)}</span><span>${bp.count} 块积木 · ${bp.steps} 步</span></div></div>
        </button>`
      )
      .join('');
    grid.querySelectorAll('.bp-card').forEach((c) =>
      c.addEventListener('click', () => {
        this.game.audio.ui();
        onPick(c.dataset.id);
      })
    );
    $('select-build').classList.remove('hidden');
  }
  showLevels(levels, progress, onPick) {
    const grid = $('lv-grid');
    let total = 0;
    grid.innerHTML = levels
      .map((lv, i) => {
        const st = progress.levels?.[lv.id] || 0;
        total += st;
        const unlocked = i === 0 || (progress.levels?.[levels[i - 1].id] || 0) > 0;
        return `<button class="lv-card ${unlocked ? '' : 'locked'}" data-i="${i}">
          <div class="num">${unlocked ? i + 1 : '🔒'}</div><b>${lv.name}</b>
          <div class="stars">${[0, 1, 2].map((k) => `<span class="${k < st ? 'on' : ''}">★</span>`).join('')}</div>
        </button>`;
      })
      .join('');
    $('star-total').textContent = `★ ${total} / ${levels.length * 3}`;
    grid.querySelectorAll('.lv-card').forEach((c) =>
      c.addEventListener('click', () => {
        this.game.audio.ui();
        onPick(+c.dataset.i);
      })
    );
    $('select-level').classList.remove('hidden');
  }

  togglePhoto() {
    $('hud').classList.toggle('photo');
    return $('hud').classList.contains('photo');
  }
}
