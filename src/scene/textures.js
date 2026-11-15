import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finish(canvas, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 温暖橡木纹理
export function woodTexture({ base = '#b9804f', dark = '#8a5432', light = '#d6a173', seed = 7, planks = 0, size = 1024 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  // 纤维条纹
  for (let i = 0; i < 900; i++) {
    const y = r() * size;
    const thick = 0.5 + r() * 2.5;
    g.strokeStyle = r() < 0.5 ? dark : light;
    g.globalAlpha = 0.04 + r() * 0.12;
    g.lineWidth = thick;
    g.beginPath();
    const amp = 2 + r() * 6;
    const f = 0.003 + r() * 0.01;
    const ph = r() * 10;
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph * 2) * amp * 0.3;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  // 木节
  for (let i = 0; i < 5; i++) {
    const x = r() * size, y = r() * size;
    for (let k = 10; k > 0; k--) {
      g.globalAlpha = 0.05;
      g.strokeStyle = dark;
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(x, y, k * 5, k * 1.6, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  if (planks) {
    const h = size / planks;
    for (let i = 0; i < planks; i++) {
      g.fillStyle = `rgba(${60 + r() * 30},${35 + r() * 20},20,${0.05 + r() * 0.08})`;
      g.fillRect(0, i * h, size, h);
      g.fillStyle = 'rgba(40,22,10,0.55)';
      g.fillRect(0, i * h, size, 3);
      const off = r() * size;
      g.fillRect(off, i * h, 3, h);
    }
  }
  return finish(c);
}

export function plasterTexture(color = '#efe3cf', seed = 3) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < 6000; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? 'rgba(120,90,60,0.035)' : 'rgba(255,255,255,0.05)';
    const s = 1 + r() * 3;
    g.fillRect(r() * size, r() * size, s, s);
  }
  return finish(c, [4, 4]);
}

export function softDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// 桌上那张手绘“图纸”
export function sketchTexture() {
  const W = 512, H = 680;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf6ea';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(120,160,200,0.35)';
  g.lineWidth = 1;
  for (let y = 40; y < H; y += 26) {
    g.beginPath();
    g.moveTo(20, y);
    g.lineTo(W - 20, y);
    g.stroke();
  }
  g.strokeStyle = '#3d5f8f';
  g.lineWidth = 3;
  g.lineJoin = 'round';
  const wob = (x, y) => [x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2];
  const line = (pts) => {
    g.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = wob(p[0], p[1]);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();
  };
  // 小房子
  line([[120, 460], [120, 300], [390, 300], [390, 460], [120, 460]]);
  line([[100, 310], [255, 180], [410, 310]]);
  line([[220, 460], [220, 370], [290, 370], [290, 460]]);
  line([[140, 330], [195, 330], [195, 380], [140, 380], [140, 330]]);
  line([[320, 330], [370, 330], [370, 380], [320, 380], [320, 330]]);
  line([[330, 230], [330, 180], [360, 180], [360, 255]]);
  // 凸点
  for (let x = 140; x < 390; x += 40) {
    g.beginPath();
    g.ellipse(x, 296, 10, 4, 0, Math.PI, 0);
    g.stroke();
  }
  g.fillStyle = '#c0583b';
  g.font = 'bold 40px "Microsoft YaHei", "PingFang SC", sans-serif';
  g.fillText('我的小屋', 170, 560);
  g.fillStyle = '#3d5f8f';
  g.font = '24px "Microsoft YaHei", sans-serif';
  g.fillText('需要：2×4 × 12   斜坡 × 6', 90, 610);
  g.strokeStyle = '#e8a94a';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(430, 110, 34, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    line([[430 + Math.cos(a) * 44, 110 + Math.sin(a) * 44], [430 + Math.cos(a) * 60, 110 + Math.sin(a) * 60]]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 墙上的小画
export function paintingTexture(kind = 0) {
  const W = 400, H = 300;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (kind === 0) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#f7c58f');
    sky.addColorStop(1, '#f3e1c2');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#f19a63';
    g.beginPath();
    g.arc(270, 150, 46, 0, Math.PI * 2);
    g.fill();
    const hills = [['#b6a36f', 190, 0.012], ['#8b8a5c', 215, 0.02], ['#5f6e4a', 245, 0.015]];
    for (const [col, base, f] of hills) {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, base + Math.sin(x * f + base) * 18);
      g.lineTo(W, H);
      g.fill();
    }
  } else {
    g.fillStyle = '#f3ead8';
    g.fillRect(0, 0, W, H);
    const cols = ['#c9302c', '#f6c83e', '#2f6eBF', '#3a9152', '#f08a2e'];
    let i = 0;
    for (let y = 200; y > 40; y -= 48) {
      for (let x = 70 + (i % 2) * 30; x < 330; x += 96) {
        g.fillStyle = cols[(i + x) % cols.length];
        g.fillRect(x, y, 90, 44);
        for (let s = 0; s < 4; s++) g.fillRect(x + 8 + s * 22, y - 8, 14, 8);
      }
      i++;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function bookSpineTexture(color, title) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(255,240,210,0.85)';
  g.fillRect(14, 8, 2, 48);
  g.fillRect(240, 8, 2, 48);
  g.font = 'bold 26px "Microsoft YaHei", sans-serif';
  g.fillText(title, 40, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
