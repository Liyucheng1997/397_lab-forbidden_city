// 自然要素：树木、峰石、假山（太湖石/青石）、水面、驳岸、草地/花坛。
// 树木原型 'tree:<kind>:<variant>'：kind ∈ pine（油松，园林古松）| cypress（侧柏/桧柏，御花园古柏）|
//   locust（国槐，宽冠落叶）| willow（垂柳，护城河岸）| ginkgo（银杏）| elm（榆）| bamboo（竹丛）| shrub（灌木；v2 粉花 v3 黄花）
//   variant ∈ 0..3（形态变体）。单位尺寸：树高 = 1（底 y=0），调用方按真实树高缩放（古柏 8~15m，槐 12~18m，柳 10~14m）。
//   部件：nt_bark 枝干 + nt_crown 叶团（实心体积）+ nt_leaf_* 叶片卡片（alphaTest + alphaToCoverage）；每个原型 ≤2000 三角形。
// 峰石原型 'rock:<taihu|qing>:<variant>'：单块立峰石，高 = 1，底 y=0。
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { registerProtoFamily } from './protos.js';
import { polyTopGeo, prismGeo, sweep, offsetPoly, fromArrays } from './geom.js';
import { defineMaterial } from './materials.js';
import { registerTexture, makeTexture, canvas, rng, normalFromHeight } from './textures.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const UP = new V3(0, 1, 0);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- 噪声 ----------
function hash(x, y, z, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(s + 101, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
function noise3(x, y, z, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const c = (a, b, d) => hash(xi + a, yi + b, zi + d, s);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm3(x, y, z, oct = 3, s = 0) {
  let a = 1, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += a * noise3(x * f, y * f, z * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; }
  return sum / n;
}
// 可平铺 2D 噪声：u,v∈[0,1)，横纵周期 px,py 格
function tnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), u = fade(x - xi), v = fade(y - yi);
  const c = (a, b) => hash((((xi + a) % px) + px) % px, (((yi + b) % py) + py) % py, 0, s);
  return lerp(lerp(c(0, 0), c(1, 0), u), lerp(c(0, 1), c(1, 1), u), v);
}
function tfbm(u, v, px, py, oct = 4, s = 0) {
  let a = 1, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += a * tnoise(u * px * f, v * py * f, px * f, py * f, s + i * 31); n += a; a *= 0.5; f *= 2; }
  return sum / n;
}
// 可平铺 Worley（最近特征点距离，单位：格）
function tworley(u, v, P, s) {
  const x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const cx = xi + a, cy = yi + b, wx = ((cx % P) + P) % P, wy = ((cy % P) + P) % P;
    const dx = cx + hash(wx, wy, 1, s) - x, dy = cy + hash(wx, wy, 2, s) - y;
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

// ---------- 纹理 ----------
/** Canvas 绘制带 alpha 的叶片纹理 → DataTexture：透明处补色、手工 mipmap 保持 alpha 覆盖率（远看不变稀、不闪烁） */
function alphaTex(S, draw) {
  const c = canvas(S);
  const g = c.getContext('2d');
  draw(g, S);
  const src = g.getImageData(0, 0, S, S).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < src.length; i += 4) if (src[i + 3] > 128) { r += src[i]; gg += src[i + 1]; b += src[i + 2]; n++; }
  n = Math.max(1, n); r /= n; gg /= n; b /= n;
  const base = new Uint8Array(src.length);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, a = src[i + 3] / 255;
    base[i] = src[i] * a + r * (1 - a); base[i + 1] = src[i + 1] * a + gg * (1 - a); base[i + 2] = src[i + 2] * a + b * (1 - a);
    base[i + 3] = x < 2 || y < 2 || x >= S - 2 || y >= S - 2 ? 0 : src[i + 3];
  }
  const TH = 128;
  const cov = (d) => { let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > TH) k++; return k / (d.length / 4); };
  const cov0 = cov(base);
  const mips = [{ data: base, width: S, height: S }];
  let cur = base, s = S;
  while (s > 1) {
    const h = s >> 1, nd = new Uint8Array(h * h * 4), al = new Float32Array(h * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) for (let k = 0; k < 4; k++) {
      const a = ((2 * y) * s + 2 * x) * 4 + k;
      const v = (cur[a] + cur[a + 4] + cur[a + s * 4] + cur[a + s * 4 + 4]) / 4;
      if (k === 3) al[y * h + x] = v; else nd[(y * h + x) * 4 + k] = v;
    }
    // 二分求 alpha 缩放，使超过阈值的比例与第 0 级一致
    let lo = 0.5, hi = 6;
    for (let it = 0; it < 14; it++) {
      const m = (lo + hi) / 2;
      let k = 0; for (let i = 0; i < al.length; i++) if (al[i] * m > TH) k++;
      if (k / al.length < cov0) lo = m; else hi = m;
    }
    const sc = (lo + hi) / 2;
    for (let i = 0; i < al.length; i++) nd[i * 4 + 3] = Math.min(255, al[i] * sc);
    mips.push({ data: nd, width: h, height: h });
    cur = nd; s = h;
  }
  const t = new THREE.DataTexture(base, S, S, THREE.RGBAFormat);
  t.mipmaps = mips;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
/** 由像素函数 f(u,v)->[r,g,b](0..1) 生成可平铺 canvas */
function pixTex(S, f) {
  const c = canvas(S), g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const p = f(x / S, y / S), i = (y * S + x) * 4;
    img.data[i] = clamp01(p[0]) * 255; img.data[i + 1] = clamp01(p[1]) * 255; img.data[i + 2] = clamp01(p[2]) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// 叶色（近白的浅绿灰，真实色相由顶点色给出）
function leafRGB(r, lo = 0.6, hi = 1) {
  const l = lo + (hi - lo) * r(), w = (r() - 0.5) * 0.18;
  return `rgb(${Math.round(255 * l * (0.92 + w))},${Math.round(255 * l)},${Math.round(255 * l * (0.8 - w))})`;
}
const TS = 256;
registerTexture('nt_leaf_needle', () => alphaTex(TS, (g, S) => {
  const r = rng(101);
  g.lineCap = 'round';
  for (let k = 0; k < 24; k++) {
    const cx = S * (0.22 + 0.56 * r()), cy = S * (0.22 + 0.56 * r()), a0 = r() * TAU, len = S * (0.12 + 0.07 * r());
    g.strokeStyle = 'rgb(125,105,85)'; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(cx - Math.cos(a0) * len * 0.8, cy - Math.sin(a0) * len * 0.8); g.lineTo(cx, cy); g.stroke();
    for (let i = 0; i < 46; i++) {
      const a = a0 + (r() - 0.5) * 3.6, L = len * (0.55 + 0.45 * r());
      g.strokeStyle = leafRGB(r, 0.5, 1); g.lineWidth = 1.8 + r() * 1.6;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); g.stroke();
    }
  }
}));
registerTexture('nt_leaf_scale', () => alphaTex(TS, (g, S) => {
  const r = rng(202);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const spray = (x, y, a, L, w, depth) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const nx = x + Math.cos(a) * L / n, ny = y + Math.sin(a) * L / n;
      g.strokeStyle = leafRGB(r, 0.5, 0.95); g.lineWidth = w * (1 - (i / n) * 0.45);
      g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      if (depth > 0 && i > 0) spray(nx, ny, a + (i % 2 ? 0.95 : -0.95) + (r() - 0.5) * 0.3, L * 0.45, w * 0.8, depth - 1);
      x = nx; y = ny; a += (r() - 0.5) * 0.3;
    }
  };
  for (let k = 0; k < 15; k++) spray(S * (0.15 + 0.7 * r()), S * (0.15 + 0.7 * r()), r() * TAU, S * 0.36, 10, 2);
}));
registerTexture('nt_leaf_small', () => alphaTex(TS, (g, S) => {
  const r = rng(303);
  for (let k = 0; k < 24; k++) {
    const x = S * (0.18 + 0.64 * r()), y = S * (0.18 + 0.64 * r()), a = r() * TAU, L = S * (0.2 + 0.08 * r()), np = 5;
    g.strokeStyle = 'rgb(150,155,105)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    for (let i = 1; i <= np; i++) {
      const t = i / np, px = x + Math.cos(a) * L * t, py = y + Math.sin(a) * L * t;
      for (const sg of i === np ? [0] : [-1, 1]) {
        const aa = a + sg * 1.05, o = sg ? 9 : 8;
        g.fillStyle = leafRGB(r, 0.58, 1);
        g.beginPath(); g.ellipse(px + Math.cos(aa) * o, py + Math.sin(aa) * o, 11.5, 5.5, aa, 0, TAU); g.fill();
      }
    }
  }
}));
registerTexture('nt_leaf_willow', () => alphaTex(TS, (g, S) => {
  const r = rng(404);
  for (let k = 0; k < 7; k++) {
    const x0 = S * (0.09 + 0.135 * k + (r() - 0.5) * 0.04), sw = (r() - 0.5) * 22;
    let step = 0;
    for (let y = 3; y < S - 12; y += 6, step++) {
      const xx = x0 + sw * (y / S) ** 2, sd = step % 2 ? 1 : -1;
      g.strokeStyle = 'rgb(165,170,110)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(xx, y); g.lineTo(x0 + sw * ((y + 6) / S) ** 2, y + 6); g.stroke();
      g.fillStyle = leafRGB(r, 0.6, 1);
      g.beginPath(); g.ellipse(xx + sd * 5.5, y + 7, 12, 3.2, Math.PI / 2 - sd * 0.5, 0, TAU); g.fill();
    }
  }
}));
registerTexture('nt_leaf_fan', () => alphaTex(TS, (g, S) => {
  const r = rng(505);
  for (let k = 0; k < 64; k++) {
    const cx = S * (0.15 + 0.7 * r()), cy = S * (0.15 + 0.7 * r()), a = r() * TAU, R = 17 + r() * 10;
    g.strokeStyle = 'rgb(150,150,100)'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(cx - Math.cos(a) * R * 0.8, cy - Math.sin(a) * R * 0.8); g.lineTo(cx, cy); g.stroke();
    g.fillStyle = leafRGB(r, 0.62, 1);
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a - 0.9, a - 0.07); g.lineTo(cx, cy); g.arc(cx, cy, R, a + 0.07, a + 0.9); g.closePath(); g.fill();
  }
}));
registerTexture('nt_leaf_bamboo', () => alphaTex(TS, (g, S) => {
  const r = rng(606);
  // 斜垂小枝，狭长披针叶互生下垂
  for (let k = 0; k < 24; k++) {
    const x = S * (0.12 + 0.76 * r()), y = S * (0.05 + 0.35 * r()), a = Math.PI / 2 + (r() - 0.5) * 1.3, L = S * (0.28 + 0.2 * r());
    g.strokeStyle = 'rgb(140,150,90)'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    for (let i = 1; i <= 6; i++) {
      const t = (i / 6) * 0.92, ox = x + Math.cos(a) * L * t, oy = y + Math.sin(a) * L * t;
      const la = a + (i % 2 ? 1 : -1) * (0.35 + 0.35 * r()), LL = 32 + r() * 22, W = 3.8 + r() * 1.6;
      const ex = ox + Math.cos(la) * LL, ey = oy + Math.sin(la) * LL, nx = -Math.sin(la) * W, ny = Math.cos(la) * W;
      const mx = ox + Math.cos(la) * LL * 0.35, my = oy + Math.sin(la) * LL * 0.35;
      g.fillStyle = leafRGB(r, 0.58, 1);
      g.beginPath(); g.moveTo(ox, oy); g.quadraticCurveTo(mx + nx, my + ny, ex, ey); g.quadraticCurveTo(mx - nx, my - ny, ox, oy); g.fill();
    }
  }
}));
registerTexture('nt_leaf_shrub', () => alphaTex(TS, (g, S) => {
  const r = rng(707);
  for (let k = 0; k < 230; k++) {
    const x = S * (0.07 + 0.86 * r()), y = S * (0.07 + 0.86 * r()), a = r() * TAU;
    g.fillStyle = leafRGB(r, 0.55, 1);
    g.beginPath(); g.ellipse(x, y, 8 + r() * 5, 4.5 + r() * 2, a, 0, TAU); g.fill();
  }
}));
registerTexture('nt_flower', () => alphaTex(TS, (g, S) => {
  const r = rng(808);
  for (let k = 0; k < 18; k++) {
    const x = S * (0.16 + 0.68 * r()), y = S * (0.16 + 0.68 * r()), R = 16 + r() * 10, a0 = r() * TAU;
    for (let i = 0; i < 5; i++) {
      const a = a0 + (i / 5) * TAU, l = 0.86 + r() * 0.14;
      g.fillStyle = `rgb(${255 * l | 0},${255 * l | 0},${248 * l | 0})`;
      g.beginPath(); g.ellipse(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5, R * 0.55, R * 0.42, a, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgb(240,205,120)'; g.beginPath(); g.arc(x, y, R * 0.2, 0, TAU); g.fill();
  }
}));
// 树皮：纵向裂纹（u 绕周向，v 沿干）
const barkH = (u, v) => {
  const w = tfbm(u, v, 3, 2, 2, 77);
  const n = tfbm(u + 0.06 * w, v, 9, 2, 4, 91);
  const ridge = 1 - Math.abs(n * 2 - 1);
  return Math.pow(ridge, 1.6) * 0.8 + 0.2 * tfbm(u, v, 18, 24, 2, 5);
};
registerTexture('nt_bark_tex', () => pixTex(TS, (u, v) => { const h = barkH(u, v), l = 0.42 + 0.62 * h; return [l * 0.86, l * 0.8, l * 0.74]; }));
registerTexture('nt_bark_normal', () => normalFromHeight(TS, barkH, 5));
registerTexture('nt_bamboo_tex', () => pixTex(128, (u, v) => {
  const node = Math.exp(-((((v + 0.02) % 1) - 0.02) ** 2) / 0.0006) * 0.35, ring = Math.exp(-((v - 0.06) ** 2) / 0.0004) * 0.18;
  const st = 0.92 + 0.08 * tnoise(u * 40, v * 2, 40, 2, 3);
  const l = st * (1 - node) + ring;
  return [l * 0.95, l, l * 0.8];
}));
// 叶团表面：暗底上满铺小叶（可平铺），使露出的内核也呈叶状
registerTexture('nt_crown_tex', () => {
  const S = 256, c = pixTex(S, (u, v) => { const n = tfbm(u, v, 8, 8, 3, 41), l = 0.28 + 0.25 * n; return [l * 0.95, l, l * 0.85]; });
  const g = c.getContext('2d'), r = rng(43);
  for (let k = 0; k < 1400; k++) {
    const x = r() * S, y = r() * S, a = r() * TAU, rx = 5 + r() * 5, ry = 2.6 + r() * 1.6;
    g.fillStyle = leafRGB(r, 0.45, 1);
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
      if ((ox && Math.abs(x + ox - S / 2) > S / 2 + 12) || (oy && Math.abs(y + oy - S / 2) > S / 2 + 12)) continue;
      g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, a, 0, TAU); g.fill();
    }
  }
  return c;
});
// 山石：浅灰带斑点；太湖石凹坑法线；青石层理法线
const rockCol = (u, v) => {
  const n = tfbm(u, v, 6, 6, 4, 11), sp = hash((u * 256) | 0, (v * 256) | 0, 3, 9);
  const l = 0.6 + 0.45 * n - (sp > 0.93 ? 0.12 : 0) + (sp < 0.04 ? 0.08 : 0);
  return [l * 0.98, l * 0.97, l * 0.93];
};
registerTexture('nt_rock_tex', () => pixTex(TS, rockCol));
const taihuH = (u, v) => {
  const w = tworley(u, v, 7, 21), w2 = tworley(u, v, 15, 23);
  return 0.5 * Math.min(1, w * 1.6) + 0.25 * Math.min(1, w2 * 1.8) + 0.25 * tfbm(u, v, 8, 8, 3, 25);
};
registerTexture('nt_taihu_normal', () => normalFromHeight(TS, taihuH, 4));
const qingH = (u, v) => {
  const n = tfbm(u, v, 4, 4, 3, 31);
  const st = Math.abs(Math.sin((v * 9 + n * 1.2) * Math.PI));
  return 0.55 * Math.pow(st, 0.35) + 0.45 * tfbm(u, v, 10, 3, 3, 33);
};
registerTexture('nt_qing_normal', () => normalFromHeight(TS, qingH, 4));
// 草地：底色 + 草叶笔触（可平铺）
registerTexture('nt_grass_tex', () => {
  const S = 512, c = pixTex(S, (u, v) => {
    const n = tfbm(u, v, 8, 8, 4, 51), m = tfbm(u, v, 3, 3, 2, 53);
    return [0.25 + 0.12 * n + 0.1 * m, 0.33 + 0.14 * n + 0.04 * m, 0.13 + 0.06 * n];
  });
  const g = c.getContext('2d'), r = rng(55);
  g.lineCap = 'round';
  for (let k = 0; k < 14000; k++) {
    const x = r() * S, y = r() * S, a = -Math.PI / 2 + (r() - 0.5) * 1.6, L = 4 + r() * 9, l = 0.75 + r() * 0.5, yel = r();
    g.strokeStyle = `rgb(${(58 + 50 * yel) * l | 0},${(92 + 30 * yel) * l | 0},${(34 + 8 * yel) * l | 0})`;
    g.lineWidth = 1 + r() * 1.2;
    for (const ox of [0, -S, S]) for (const oy of [0, -S, S]) {
      if ((ox && Math.abs(x + ox - S / 2) > S / 2 + 14) || (oy && Math.abs(y + oy - S / 2) > S / 2 + 14)) continue;
      g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * L, y + oy + Math.sin(a) * L); g.stroke();
    }
  }
  return c;
});
registerTexture('nt_soil_tex', () => pixTex(TS, (u, v) => {
  const n = tfbm(u, v, 10, 10, 4, 61), p = tworley(u, v, 24, 63);
  const l = 0.85 + 0.3 * n + (p < 0.18 ? 0.25 : 0);
  return [0.36 * l, 0.27 * l, 0.19 * l];
}));
registerTexture('nt_macro', () => pixTex(TS, (u, v) => { const n = tfbm(u, v, 4, 4, 5, 71); return [n, n, n]; }));
// 水面法线：若干整数波数正弦 + 噪声（可平铺）
const WAVES = [[3, 1, 0.5, 0.3], [1, 4, 0.4, 1.7], [-2, 3, 0.35, 2.4], [5, -2, 0.22, 0.9], [7, 5, 0.14, 4.1], [-6, 7, 0.12, 5.3], [11, -3, 0.07, 2.2], [-4, -12, 0.06, 0.4]];
const waterH = (u, v) => {
  let h = 0;
  for (const [kx, ky, a, ph] of WAVES) h += a * Math.sin(TAU * (kx * u + ky * v) + ph);
  return h * 0.5 + 0.6 * tfbm(u, v, 16, 16, 3, 81);
};
registerTexture('nt_water_normal', () => normalFromHeight(TS, waterH, 2.2));

// ---------- 材质 ----------
/** 惰性材质：首次 getMaterial 时才生成纹理与材质 */
function lazyMat(key, make, extra = {}) {
  let m = null;
  const def = { ...extra };
  Object.defineProperty(def, 'material', { get: () => m || (m = make()), enumerable: true });
  defineMaterial(key, def);
}
function repeatTex(name, rx, ry = rx) {
  const t = makeTexture(name).clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
// 叶片卡片：双面、不翻转背面法线（法线取自冠体径向，体积感一致）
const noFlip = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
};
function leafMat(tex) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: makeTexture(tex), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
  m.alphaToCoverage = true;
  m.envMapIntensity = 0.75;
  m.onBeforeCompile = noFlip;
  return m;
}
for (const k of ['needle', 'scale', 'small', 'willow', 'fan', 'bamboo', 'shrub']) lazyMat(`nt_leaf_${k}`, () => leafMat(`nt_leaf_${k}`), { vertexColors: true });
lazyMat('nt_flower', () => leafMat('nt_flower'), { vertexColors: true });
// 叶团：物体空间三平面投影叶纹（无 UV 接缝/拉伸），尺度随原型缩放
lazyMat('nt_crown', () => {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: makeTexture('nt_crown_tex'), roughness: 0.9 });
  m.envMapIntensity = 0.7;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP;\nvarying vec3 vTriN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP = position * 9.0;\nvTriN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP;\nvarying vec3 vTriN;')
      .replace('#include <map_fragment>', `vec3 tw = pow(abs(normalize(vTriN)), vec3(4.0)); tw /= tw.x + tw.y + tw.z;
      diffuseColor *= texture2D(map, vTriP.zy) * tw.x + texture2D(map, vTriP.xz) * tw.y + texture2D(map, vTriP.xy) * tw.z;`);
  };
  m.customProgramCacheKey = () => 'ntcrown';
  return m;
}, { vertexColors: true });
lazyMat('nt_bark', () => new THREE.MeshStandardMaterial({ vertexColors: true, map: makeTexture('nt_bark_tex'), normalMap: makeTexture('nt_bark_normal'), normalScale: new THREE.Vector2(1.3, 1.3), roughness: 0.95 }), { vertexColors: true });
lazyMat('nt_bamboo', () => new THREE.MeshStandardMaterial({ vertexColors: true, map: makeTexture('nt_bamboo_tex'), roughness: 0.5 }), { vertexColors: true });
lazyMat('nt_taihu', () => new THREE.MeshStandardMaterial({ vertexColors: true, map: makeTexture('nt_rock_tex'), normalMap: makeTexture('nt_taihu_normal'), normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.92 }), { vertexColors: true });
lazyMat('nt_qing', () => new THREE.MeshStandardMaterial({ vertexColors: true, map: makeTexture('nt_rock_tex'), normalMap: makeTexture('nt_qing_normal'), normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.85 }), { vertexColors: true });
lazyMat('nt_cave', () => new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 1 }));
// 草地：贴图周期 4m，叠加大尺度噪声（约 50m）消除重复感
function groundMat(tex, period, tintA, tintB) {
  const m = new THREE.MeshStandardMaterial({ map: repeatTex(tex, 1 / period), roughness: 1 });
  const macro = makeTexture('nt_macro');
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMacro = { value: macro };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uMacro;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      float mc = texture2D(uMacro, vMapUv * ${(period / 52).toFixed(4)}).r;
      float mc2 = texture2D(uMacro, vMapUv * ${(period / 13).toFixed(4)} + 0.37).r;
      diffuseColor.rgb *= mix(vec3(${tintA}), vec3(${tintB}), smoothstep(0.3, 0.7, mc)) * (0.86 + 0.28 * mc2);`);
  };
  m.customProgramCacheKey = () => 'ntground' + tex;
  return m;
}
lazyMat('nt_grass', () => groundMat('nt_grass_tex', 4, '0.82, 0.86, 0.72', '1.12, 1.06, 0.9'));
lazyMat('nt_soil', () => groundMat('nt_soil_tex', 2, '0.85, 0.85, 0.85', '1.1, 1.05, 1.0'));

// ---------- 几何累加器（带 color 的索引几何）----------
const WHITE = new THREE.Color(1, 1, 1);
class Acc {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  get tris() { return this.i.length / 3; }
  vert(px, py, pz, nx, ny, nz, u, v, col) { this.p.push(px, py, pz); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(col.r, col.g, col.b); return this.count - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  add(geo) {
    const o = this.count, pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv, ca = geo.attributes.color;
    for (let k = 0; k < pa.count; k++) {
      this.p.push(pa.getX(k), pa.getY(k), pa.getZ(k));
      this.n.push(na.getX(k), na.getY(k), na.getZ(k));
      this.u.push(ua ? ua.getX(k) : 0, ua ? ua.getY(k) : 0);
      if (ca) this.c.push(ca.getX(k), ca.getY(k), ca.getZ(k)); else this.c.push(1, 1, 1);
    }
    if (geo.index) for (const k of geo.index.array) this.i.push(k + o);
    else for (let k = 0; k < pa.count; k++) this.i.push(k + o);
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    return g;
  }
}

/** 锥形弯管（枝干）：平行移动标架；twist 使纹理/棱纹螺旋（古柏扭纹），flute 棱纹深度 */
function tube(acc, pts, r0, r1, seg, o = {}) {
  const { uRep = 1, vLen = 0.1, twist = 0, flute = 0, flutes = 6, c0 = 0x6b5a48, c1 = c0, rPow = 1, root = 0 } = o;
  const P = pts.map((p) => new V3(p[0], p[1], p[2])), n = P.length;
  const T = P.map((_, i) => new V3().subVectors(P[Math.min(i + 1, n - 1)], P[Math.max(i - 1, 0)]).normalize());
  const N = Math.abs(T[0].z) < 0.9 ? new V3(0, 0, 1) : new V3(1, 0, 0);
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + P[i].distanceTo(P[i - 1]));
  const tot = L[n - 1] || 1;
  const C0 = new THREE.Color(c0), C1 = new THREE.Color(c1), C = new THREE.Color();
  const base = acc.count, B = new V3();
  for (let i = 0; i < n; i++) {
    N.sub(T[i].clone().multiplyScalar(N.dot(T[i]))).normalize();
    B.crossVectors(T[i], N).normalize();
    const t = L[i] / tot;
    const r = lerp(r0, r1, Math.pow(t, rPow)) * (1 + root * Math.max(0, 1 - L[i] / (r0 * 3)) ** 2);
    C.copy(C0).lerp(C1, t);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const rr = r * (1 + flute * Math.cos(a * flutes + twist * L[i] * 6));
      const dx = N.x * ca + B.x * sa, dy = N.y * ca + B.y * sa, dz = N.z * ca + B.z * sa;
      acc.vert(P[i].x + dx * rr, P[i].y + dy * rr, P[i].z + dz * rr, dx, dy, dz, (j / seg) * uRep + twist * L[i], L[i] / vLen, C);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * (seg + 1) + j, b = a + seg + 1;
    acc.tri(a, a + 1, b); acc.tri(a + 1, b + 1, b);
  }
}

/** 噪声位移的二十面体（焊接顶点、平滑法线）。返回索引几何（单位方向 → 椭球 rad） */
function blobGeo(rad, seed, { detail = 1, amp = 0.3, freq = 1.8 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pa = g.attributes.position, s = (seed % 97) * 3.17;
  const dirs = [];
  for (let k = 0; k < pa.count; k++) {
    const x = pa.getX(k), y = pa.getY(k), z = pa.getZ(k);
    const f = 1 + amp * (fbm3(x * freq + s, y * freq - s, z * freq + s * 0.5, 3, seed) - 0.5) * 2.4;
    dirs.push([x, y, z, f]);
    pa.setXYZ(k, x * rad[0] * f, y * rad[1] * f, z * rad[2] * f);
  }
  g.computeVertexNormals();
  g.userData.dirs = dirs;
  return g;
}

// ---------- 树木构造器 ----------
class TreeB {
  constructor(seed) {
    this.R = rng(seed);
    this.seed = seed;
    this.bark = new Acc(); this.crown = new Acc(); this.leaf = new Acc(); this.extra = new Acc();
    this.leafMat = 'nt_leaf_small'; this.extraMat = null;
  }
  r(a, b) { return a + (b - a) * this.R(); }
  /** 由起点、方向生长的弯曲路径；bend 每步附加方向偏移（向上/重力） */
  grow(p0, dir, len, n, wander = 0.3, bend = [0, 0, 0]) {
    const R = this.R, d = new V3(...dir).normalize(), p = new V3(...p0), pts = [p0.slice()], st = len / n;
    for (let i = 0; i < n; i++) {
      d.x += (R() - 0.5) * wander + bend[0]; d.y += (R() - 0.5) * wander * 0.5 + bend[1]; d.z += (R() - 0.5) * wander + bend[2];
      d.normalize(); p.addScaledVector(d, st); pts.push([p.x, p.y, p.z]);
    }
    return pts;
  }
  at(pts, t) {
    const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), k = f - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k), lerp(pts[i][2], pts[i + 1][2], k)];
  }
  limb(pts, r0, r1, seg, o) { tube(this.bark, pts, r0, r1, seg, o); }
  /** 叶团（实心体积）：法线与径向（nC）混合，底部/内侧暗 */
  clump(c, rad, o = {}) {
    const { col = 0x405f30, nC = c, nMix = 0.55, up = 0, ao = 0.45, amp = 0.3, detail = 1 } = o;
    const g = blobGeo(rad, (this.seed * 7 + this.crown.count) | 0, { amp, detail });
    const pa = g.attributes.position, na = g.attributes.normal, dirs = g.userData.dirs;
    const base = new THREE.Color(col), C = new THREE.Color(), n = new V3(), rr = new V3();
    for (let k = 0; k < pa.count; k++) {
      const px = pa.getX(k) + c[0], py = pa.getY(k) + c[1], pz = pa.getZ(k) + c[2];
      rr.set(px - nC[0], py - nC[1], pz - nC[2]).normalize();
      n.set(na.getX(k), na.getY(k), na.getZ(k)).multiplyScalar(1 - nMix).addScaledVector(rr, nMix).addScaledVector(UP, up).normalize();
      const [, dy, , f] = dirs[k];
      const a = ao + (1 - ao) * clamp01(0.45 + 0.45 * dy + (f - 1) * 1.2);
      C.copy(base).multiplyScalar(a * (0.9 + 0.2 * hash(k, this.seed, 5, 3)));
      this.crown.vert(px, py, pz, n.x, n.y, n.z, (px + pz * 0.7) * 9, (py - pz * 0.4) * 9, C);
    }
    const o0 = this.crown.count - pa.count;
    for (let k = 0; k < g.index.count; k += 3) this.crown.tri(g.index.array[k] + o0, g.index.array[k + 1] + o0, g.index.array[k + 2] + o0);
  }
  /** 叶片卡片：椭球壳内随机分布；flat 使面片趋于水平（松针盘），minY 限制分布下界 */
  cards(c, rad, n, size, o = {}) {
    const { shell = [0.72, 1.08], flat = 0, minY = -1, col = 0x4f6e33, nC = c, up = 0.25, ao = 0.5, stretch = 1, varAmt = 0.14, acc = this.leaf, droop = 0 } = o;
    const R = this.R, base = new THREE.Color(col), C = new THREE.Color();
    const d = new V3(), m = new V3(), a = new V3(), b = new V3(), q = new V3(), nr = new V3(), t0 = new V3();
    const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let k = 0; k < n; k++) {
      do { d.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); } while (d.lengthSq() > 1 || d.lengthSq() < 0.02);
      d.normalize();
      if (d.y < minY) d.y = minY + (minY - d.y) * 0.3, d.normalize();
      const f = shell[0] + (shell[1] - shell[0]) * Math.sqrt(R());
      const px = c[0] + d.x * rad[0] * f, py = c[1] + d.y * rad[1] * f, pz = c[2] + d.z * rad[2] * f;
      m.set(d.x + (R() - 0.5) * 1.6, d.y + (R() - 0.5) * 1.6, d.z + (R() - 0.5) * 1.6).normalize().lerp(UP, flat).normalize();
      t0.copy(Math.abs(m.y) < 0.95 ? UP : new V3(1, 0, 0));
      a.crossVectors(m, t0).normalize(); b.crossVectors(m, a);
      const th = R() * TAU, ct = Math.cos(th), st = Math.sin(th);
      q.copy(a).multiplyScalar(ct).addScaledVector(b, st); b.multiplyScalar(ct).addScaledVector(a, -st); a.copy(q);
      if (droop) b.y -= droop, b.normalize();
      const s = size * (0.7 + 0.6 * R()) * 0.5;
      const depth = (f - shell[0]) / (shell[1] - shell[0] + 1e-6);
      const aoF = ao + (1 - ao) * clamp01(0.35 + 0.4 * d.y + 0.35 * depth);
      C.copy(base).multiplyScalar(aoF * (1 + (R() - 0.5) * 2 * varAmt));
      C.r *= 1 + (R() - 0.5) * 0.12; C.b *= 1 + (R() - 0.5) * 0.12;
      const rot = (R() * 4) | 0, o0 = acc.count;
      for (let v = 0; v < 4; v++) {
        const sx = v === 1 || v === 2 ? 1 : -1, sy = v >= 2 ? 1 : -1;
        const x = px + a.x * sx * s + b.x * sy * s * stretch, y = py + a.y * sx * s + b.y * sy * s * stretch, z = pz + a.z * sx * s + b.z * sy * s * stretch;
        nr.set(x - nC[0], y - nC[1], z - nC[2]).normalize().addScaledVector(UP, up).normalize();
        const uv = UVS[(v + rot) % 4];
        acc.vert(x, y, z, nr.x, nr.y, nr.z, uv[0], uv[1], C);
      }
      acc.tri(o0, o0 + 1, o0 + 2); acc.tri(o0, o0 + 2, o0 + 3);
    }
  }
  /** 垂柳枝条：自 top 向下悬垂的分段飘带，out 为水平外向 */
  strand(top, out, len, w, col) {
    const R = this.R, side = new V3(-out.z, 0, out.x), C = new THREE.Color(col), segs = 3, o0 = this.leaf.count;
    const sway = (R() - 0.5) * 0.04, bow = 0.03 + R() * 0.04;
    const nr = new V3().copy(out).addScaledVector(UP, 0.35).normalize();
    for (let s = 0; s <= segs; s++) {
      const t = s / segs, ww = w * (1 - 0.35 * t) * 0.5;
      const x = top[0] + out.x * bow * Math.sin(t * 2.2) + side.x * sway * t * t, y = top[1] - len * t, z = top[2] + out.z * bow * Math.sin(t * 2.2) + side.z * sway * t * t;
      C.set(col).multiplyScalar(0.8 + 0.3 * t);
      this.leaf.vert(x - side.x * ww, y, z - side.z * ww, nr.x, nr.y, nr.z, 0, t, C);
      this.leaf.vert(x + side.x * ww, y, z + side.z * ww, nr.x, nr.y, nr.z, 1, t, C);
    }
    for (let s = 0; s < segs; s++) { const a = o0 + s * 2; this.leaf.tri(a, a + 1, a + 3); this.leaf.tri(a, a + 3, a + 2); }
  }
  /** 叶簇 = 暗色内核（缩小的叶团，透过叶隙显出冠内阴影）+ 外层叶片卡片 */
  foliage(c, rad, n, size, o = {}) {
    const { col, core = 0.46, coreCol = shade(col, 0.42), nC = c, up = 0.2 } = o;
    this.clump(c, [rad[0] * core, rad[1] * core, rad[2] * core], { col: coreCol, nC, nMix: 1, ao: 0.55, amp: 0.25, up });
    this.cards(c, rad, n, size * 1.18, { shell: [0.6, 1.08], ...o, nC, up });
  }
  parts() {
    const out = [];
    if (this.bark.tris) out.push({ mat: 'nt_bark', geo: this.bark.geo() });
    if (this.crown.tris) out.push({ mat: 'nt_crown', geo: this.crown.geo() });
    if (this.leaf.tris) out.push({ mat: this.leafMat, geo: this.leaf.geo() });
    if (this.extra.tris) out.push({ mat: this.extraMat, geo: this.extra.geo() });
    return out;
  }
}
const dirA = (a, out, up = 1) => [Math.sin(a) * out, up, Math.cos(a) * out];
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

const SPECIES = {
  // 油松：扭曲斜干，平展层叠伞盖状针叶盘
  pine(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_needle';
    const leaf = 0x4f7a50, crown = 0x355a3c;
    const la = R() * TAU, lean = (0.16 + 0.12 * R()) * (v === 3 ? 1.8 : 1);
    const H = 0.62 + 0.1 * R();
    const trunk = T.grow([0, 0, 0], dirA(la, lean), H, 9, 0.34);
    T.limb(trunk, 0.048, 0.014, 8, { c0: 0x5a4a3e, c1: 0xa86848, uRep: 2, vLen: 0.05, root: 0.35 });
    const pads = [];
    const nt = 5 + (v % 2);
    let az = R() * TAU;
    for (let i = 0; i < nt - 1; i++) {
      const t = 0.42 + 0.5 * (i / (nt - 2));
      const p0 = T.at(trunk, t);
      const nb = R() < 0.4 ? 2 : 1;
      for (let b = 0; b < nb; b++) {
        az += 2.4 + (R() - 0.5) * 0.9;
        const len = (0.5 - 0.32 * t) * (0.75 + 0.5 * R());
        const br = T.grow(p0, [Math.sin(az), 0.18 + 0.3 * R(), Math.cos(az)], len, 4, 0.4, [0, 0.04, 0]);
        T.limb(br, 0.016 * (1.25 - t * 0.6), 0.004, 5, { c0: 0x7a5442, c1: 0x8a5e46, vLen: 0.05 });
        pads.push({ c: br[br.length - 1], s: 0.7 + 0.9 * len });
      }
    }
    pads.push({ c: trunk[trunk.length - 1], s: 1.3 });
    const by = Math.min(...pads.map((p) => p.c[1])), ty = Math.max(...pads.map((p) => p.c[1]));
    for (const pd of pads.slice(0, 10)) {
      const rx = 0.14 * pd.s * (0.85 + 0.3 * R()), rz = rx * (0.75 + 0.4 * R()), ry = 0.05 * pd.s;
      const c = [pd.c[0], pd.c[1] + 0.02, pd.c[2]];
      const hk = 0.82 + 0.25 * (c[1] - by) / (ty - by + 1e-6);
      T.clump([c[0], c[1] - 0.004, c[2]], [rx * 0.62, ry * 0.7, rz * 0.62], { col: shade(crown, hk), amp: 0.42, nMix: 0.3, up: 0.7, ao: 0.5 });
      T.cards(c, [rx * 1.12, ry * 2.0, rz * 1.12], Math.round(34 * pd.s), 0.115, { flat: 0.55, minY: -0.7, col: shade(leaf, hk), up: 1.0, ao: 0.4, shell: [0.35, 1.0] });
    }
  },
  // 古柏：粗壮扭纹干，分叉主枝，不规则团块浓绿冠
  cypress(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_scale';
    const leaf = 0x56743f;
    const la = R() * TAU, lean = 0.05 + 0.1 * R();
    const H0 = 0.3 + 0.1 * R();
    const bark = { c0: 0x6e655c, c1: 0x857a6e, uRep: 2, vLen: 0.05, twist: 1.6, flute: 0.15, flutes: 5 };
    const trunk = T.grow([0, 0, 0], dirA(la, lean), H0, 6, 0.28);
    T.limb(trunk, 0.06, 0.044, 16, { ...bark, root: 0.3 });
    const top = T.at(trunk, 0.9);
    const nl = v === 2 ? 3 : 2;
    const blobs = [];
    for (let i = 0; i < nl; i++) {
      const a = la + (i / nl) * TAU + (R() - 0.5) * 0.8, out = 0.18 + 0.22 * R();
      const L = (0.98 - H0) * (0.85 + 0.15 * R()) - (i ? 0.1 + 0.08 * R() : 0);
      const ld = T.grow(top, dirA(a, out), L, 6, 0.3, [0, 0.02, 0]);
      T.limb(ld, 0.05, 0.012, 8, { ...bark, flute: 0.06, flutes: 3 });
      for (let k = 2; k < ld.length; k += 1) if (k === ld.length - 1 || R() < 0.5) blobs.push({ c: ld[k], s: 0.75 + 0.45 * (k / ld.length) });
      const nsb = 1 + (R() < 0.5 ? 1 : 0);
      for (let s = 0; s < nsb; s++) {
        const p0 = T.at(ld, 0.25 + 0.45 * R()), aa = a + (R() - 0.5) * 2.2;
        const sb = T.grow(p0, dirA(aa, 1, 0.3 + 0.3 * R()), 0.16 + 0.12 * R(), 3, 0.4);
        T.limb(sb, 0.016, 0.004, 5, { c0: 0x6e655c, vLen: 0.05 });
        if (!(v === 3 && s === 0 && i === 0)) blobs.push({ c: sb[sb.length - 1], s: 0.7 + 0.25 * R() });
      }
    }
    const ty = Math.max(...blobs.map((b) => b.c[1]));
    const cc = [0, ty * 0.68, 0];
    for (const b of blobs.slice(0, 9)) {
      const r = 0.165 * b.s * (0.85 + 0.3 * R());
      const c = [b.c[0] + (R() - 0.5) * 0.06, b.c[1] + 0.02, b.c[2] + (R() - 0.5) * 0.06];
      const hk = 0.78 + 0.32 * c[1] / ty;
      T.foliage(c, [r, r * (1.05 + 0.3 * R()), r * (0.85 + 0.3 * R())], 36, 0.11, { col: shade(leaf, hk), nC: cc, coreCol: shade(leaf, 0.36 * hk), ao: 0.42 });
    }
  },
  // 国槐：短干分 3~5 大枝，宽圆冠
  locust(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_small';
    const leaf = 0x68903f;
    const la = R() * TAU;
    const trunk = T.grow([0, 0, 0], dirA(la, 0.08), 0.3 + 0.06 * R(), 5, 0.2);
    T.limb(trunk, 0.04, 0.029, 9, { c0: 0x4d463f, c1: 0x5d554c, uRep: 2, vLen: 0.05, root: 0.3 });
    const top = T.at(trunk, 0.88);
    const cc = [0, 0.64 + 0.04 * R(), 0], cr = [0.45 + 0.08 * R(), 0.3, 0.45 + 0.08 * R()];
    const nl = 3 + (v % 3), ends = [];
    for (let i = 0; i < nl; i++) {
      const a = la + (i / nl) * TAU + (R() - 0.5) * 0.6;
      const lb = T.grow(top, dirA(a, 0.8 + 0.3 * R()), 0.32 + 0.1 * R(), 4, 0.25);
      T.limb(lb, 0.026, 0.008, 5, { c0: 0x564e46, vLen: 0.05 });
      ends.push(lb[lb.length - 1]);
      const sb = T.grow(T.at(lb, 0.5), dirA(a + (R() - 0.5) * 1.6, 0.6, 0.9), 0.18, 3, 0.3);
      T.limb(sb, 0.012, 0.004, 4, { c0: 0x564e46, vLen: 0.05 });
      ends.push(sb[sb.length - 1]);
    }
    const pts = ends.slice(0, 8);
    pts.push([0, cc[1] + cr[1] * 0.75, 0]);
    for (const e of pts) {
      const d = new V3(e[0] - cc[0], (e[1] - cc[1]) * 1.4, e[2] - cc[2]).normalize();
      const c = [cc[0] + d.x * cr[0] * 0.6, cc[1] + d.y * cr[1] * 0.6, cc[2] + d.z * cr[2] * 0.6];
      const r = 0.22 + 0.05 * R();
      const hk = 0.8 + 0.3 * clamp01((c[1] - cc[1]) / cr[1] * 0.5 + 0.5);
      T.foliage(c, [r, r * 0.8, r], 38, 0.12, { col: shade(leaf, hk), nC: cc, coreCol: shade(leaf, 0.3 * hk) });
    }
  },
  // 垂柳：斜干，弧形大枝，冠缘垂丝如帘
  willow(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_willow';
    const leaf = 0x6f9244;
    const la = R() * TAU, lean = 0.18 + 0.14 * R();
    const trunk = T.grow([0, 0, 0], dirA(la, lean), 0.42 + 0.06 * R(), 6, 0.25);
    T.limb(trunk, 0.042, 0.028, 9, { c0: 0x4a433b, c1: 0x5a5148, uRep: 2, vLen: 0.05, root: 0.3 });
    const top = T.at(trunk, 0.88);
    const nl = 4 + (v % 2), ends = [];
    for (let i = 0; i < nl; i++) {
      const a = la + (i / nl) * TAU + (R() - 0.5) * 0.7;
      const lb = T.grow(top, dirA(a, 0.7, 1), 0.34 + 0.08 * R(), 4, 0.25, [0, -0.05, 0]);
      T.limb(lb, 0.022, 0.006, 5, { c0: 0x50483f, vLen: 0.05 });
      ends.push(lb[lb.length - 1]);
    }
    const cx = ends.reduce((s, e) => s + e[0], 0) / nl, cz = ends.reduce((s, e) => s + e[2], 0) / nl;
    const ty = Math.max(...ends.map((e) => e[1]));
    const cc = [cx, ty - 0.06, cz];
    const spread = Math.max(...ends.map((e) => Math.hypot(e[0] - cx, e[2] - cz))) + 0.1;
    for (const e of ends) T.foliage([e[0], e[1] + 0.02, e[2]], [0.15, 0.11, 0.15], 18, 0.1, { col: shade(leaf, 0.95), nC: cc, stretch: 1.5, droop: 0.6, coreCol: shade(leaf, 0.4) });
    // 垂丝：锚点分布在冠缘（外圈、上半部），向下悬垂
    const ns = 150, oc = new V3();
    for (let k = 0; k < ns; k++) {
      const a = R() * TAU, dy = -0.25 + 0.75 * R(), hr = Math.sqrt(1 - dy * dy) * (0.8 + 0.25 * R());
      const ax = cx + Math.sin(a) * spread * hr, az = cz + Math.cos(a) * spread * hr, ay = cc[1] + dy * 0.14;
      oc.set(Math.sin(a), 0, Math.cos(a));
      const yEnd = 0.08 + 0.36 * R() * R();
      T.strand([ax, ay, az], oc, Math.max(0.15, ay - yEnd), 0.085 + 0.025 * R(), shade(leaf, 0.7 + 0.35 * R()));
    }
  },
  // 银杏：通直主干，斜上轮生枝，卵圆-圆锥冠
  ginkgo(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_fan';
    const leaf = 0x7fa246;
    const trunk = T.grow([0, 0, 0], [0, 1, 0], 0.93, 8, 0.08);
    T.limb(trunk, 0.036, 0.006, 8, { c0: 0x5e574f, c1: 0x6e665c, uRep: 2, vLen: 0.05, root: 0.3 });
    const wide = v === 3 ? 1.35 : 1;
    let az = R() * TAU;
    const blobs = [];
    const nb = 8;
    for (let i = 0; i < nb; i++) {
      const t = 0.3 + 0.62 * (i / (nb - 1));
      const p0 = T.at(trunk, t);
      az += 2.4 + (R() - 0.5) * 0.5;
      const len = (0.3 - 0.2 * (t - 0.3)) * wide * (0.85 + 0.3 * R());
      const br = T.grow(p0, dirA(az, 1, 0.9 + 0.3 * R()), len, 3, 0.25);
      T.limb(br, 0.012, 0.003, 5, { c0: 0x5e574f, vLen: 0.05 });
      blobs.push(br[br.length - 1]);
    }
    blobs.push(trunk[trunk.length - 1]);
    const cc = [0, 0.62, 0];
    for (const e of blobs) {
      const r = (0.15 + 0.04 * R()) * (e[1] > 0.85 ? 0.85 : 1) * (0.9 + 0.2 * wide);
      const c = [e[0] * 0.85, e[1] - 0.02, e[2] * 0.85];
      const hk = 0.8 + 0.25 * clamp01(c[1] - 0.3);
      T.foliage(c, [r, r * 1.1, r], 32, 0.11, { col: shade(leaf, hk), nC: cc, coreCol: shade(leaf, 0.3 * hk) });
    }
  },
  // 榆：低分叉瓶状枝，宽而不规则的冠
  elm(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_small';
    const leaf = 0x5a7d3a;
    const la = R() * TAU;
    const trunk = T.grow([0, 0, 0], dirA(la, 0.1), 0.26 + 0.06 * R(), 4, 0.2);
    T.limb(trunk, 0.04, 0.03, 9, { c0: 0x4f463e, c1: 0x5c5248, uRep: 2, vLen: 0.05, root: 0.3 });
    const top = T.at(trunk, 0.88);
    const nl = 3 + (v === 1 ? 1 : 0), ends = [];
    for (let i = 0; i < nl; i++) {
      const a = la + (i / nl) * TAU + (R() - 0.5) * 0.6;
      const lb = T.grow(top, dirA(a, 0.55, 1), 0.42 + 0.1 * R(), 4, 0.3);
      T.limb(lb, 0.024, 0.008, 5, { c0: 0x564c43, vLen: 0.05 });
      ends.push(lb[lb.length - 1]);
      for (let s = 0; s < 2; s++) {
        const sb = T.grow(T.at(lb, 0.45 + 0.3 * s), dirA(a + (s ? 0.9 : -0.9), 1, 0.5), 0.2 + 0.06 * R(), 3, 0.3, [0, -0.02, 0]);
        T.limb(sb, 0.011, 0.003, 4, { c0: 0x564c43, vLen: 0.05 });
        ends.push(sb[sb.length - 1]);
      }
    }
    const cc = [0, 0.7, 0];
    for (const e of ends.slice(0, 10)) {
      const r = 0.17 + 0.05 * R();
      const c = [e[0], e[1] + 0.02, e[2]];
      const hk = 0.8 + 0.3 * clamp01((c[1] - 0.45) / 0.5);
      T.foliage(c, [r * 1.1, r * 0.8, r * 1.1], 32, 0.11, { col: shade(leaf, hk), nC: cc, coreCol: shade(leaf, 0.3 * hk) });
    }
  },
  // 竹丛：多杆细竹，上部披针叶
  bamboo(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_bamboo';
    T.extraMat = 'nt_bamboo';
    const leaf = 0x6c9a44, culm = 0x506f36;
    const n = 14 + (v % 3) * 2;
    const cc = [0, 0.6, 0];
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, rr = 0.02 + 0.08 * Math.sqrt(R());
      const p0 = [Math.sin(a) * rr, 0, Math.cos(a) * rr];
      const h = 0.7 + 0.3 * R(), lean = 0.06 + 0.12 * R() + rr * 1.5;
      const pts = T.grow(p0, dirA(a, lean), h, 5, 0.03, [Math.sin(a) * 0.03, -0.012, Math.cos(a) * 0.03]);
      tube(T.extra, pts, 0.0095, 0.004, 4, { c0: shade(culm, 0.8 + 0.3 * R()), c1: shade(culm, 1.15), uRep: 1, vLen: 0.07 });
      // 节上小枝叶簇：沿杆上部 2/3 交错外伸
      for (let k = 0; k < 6; k++) {
        const t = 0.4 + 0.6 * ((k + 0.5) / 6), p = T.at(pts, t), aa = a + (k % 2 ? 1 : -1) * (0.5 + R()), o = 0.03 + 0.04 * t;
        T.cards([p[0] + Math.sin(aa) * o, p[1] - 0.02, p[2] + Math.cos(aa) * o], [0.055, 0.05, 0.055], 5, 0.1, { col: shade(leaf, 0.72 + 0.38 * t), nC: cc, shell: [0.2, 1], droop: 0.7, up: 0.3, ao: 0.6 });
      }
    }
  },
  // 灌木：低矮团状；v2 粉花（海棠/月季），v3 黄花（迎春/黄刺玫）
  shrub(T, v) {
    const R = T.R;
    T.leafMat = 'nt_leaf_shrub';
    const leaf = [0x55783c, 0x6a8a46, 0x5c7e40, 0x678744][v];
    const cc = [0, 0.4, 0];
    const nb = 5;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * TAU + R(), rr = i === 0 ? 0 : 0.24 + 0.08 * R();
      const c = [Math.sin(a) * rr, i === 0 ? 0.55 : 0.38 + 0.08 * R(), Math.cos(a) * rr];
      const r = i === 0 ? 0.4 : 0.32 + 0.06 * R();
      T.foliage(c, [r, r * 0.95, r], 44, 0.2, { col: leaf, nC: cc, minY: -0.5, coreCol: shade(leaf, 0.4) });
    }
    for (let i = 0; i < 3; i++) T.limb(T.grow([0, 0, 0], dirA(R() * TAU, 0.5), 0.35, 2, 0.3), 0.02, 0.008, 4, { c0: 0x5a4c3e, vLen: 0.05 });
    if (v >= 2) {
      T.extraMat = 'nt_flower';
      T.cards([0, 0.45, 0], [0.62, 0.52, 0.62], 80, 0.2, { acc: T.extra, col: v === 2 ? 0xff6f98 : 0xffc21a, nC: cc, minY: -0.1, shell: [0.85, 1.08], ao: 0.75, varAmt: 0.1, up: 0.4 });
    }
  },
};

const strHash = (s) => { let h = 7; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
registerProtoFamily('tree', (key, [kind, variant]) => {
  const k = SPECIES[kind] ? kind : 'locust';
  const v = Math.max(0, Math.min(3, +variant || 0));
  const T = new TreeB((strHash(k) % 100000) * 7 + v * 131 + 17);
  SPECIES[k](T, v);
  return T.parts();
});
/** 树种默认真实树高（米），供总装参考 */
export const TREE_HEIGHT = { pine: 10, cypress: 12, locust: 15, willow: 11, ginkgo: 16, elm: 13, bamboo: 6, shrub: 1.4 };

// ---------- 山石 ----------
const TAIHU_COL = 0xa29f96, QING_COL = 0x6e777c;
/** 单块山石几何（索引，局部坐标）：taihu 圆润多凹坑带局部削面，qing 带平切面的层状块；属性 disp = 相对位移（凹处 <1，用于缝隙暗化） */
function stoneGeo(rad, seed, qing, detail = 1) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pa = g.attributes.position, s = (seed % 89) * 2.31, disp = new Float32Array(pa.count);
  const R = rng(seed + 3);
  const planes = Array.from({ length: qing ? 5 : 3 }, () => { const n = new V3(R() - 0.5, (R() - 0.5) * (qing ? 2.4 : 1), R() - 0.5).normalize(); return [n, (qing ? 0.55 : 0.7) + 0.3 * R()]; });
  const v = new V3();
  for (let k = 0; k < pa.count; k++) {
    v.set(pa.getX(k), pa.getY(k), pa.getZ(k));
    let f;
    if (qing) {
      f = 1 + 0.32 * (fbm3(v.x * 1.3 + s, v.y * 1.3, v.z * 1.3 - s, 2, seed) - 0.5) * 2;
      v.multiplyScalar(f);
      for (const [n, d] of planes) { const e = v.dot(n) - d; if (e > 0) v.addScaledVector(n, -e); }
    } else {
      const n1 = fbm3(v.x * 1.5 + s, v.y * 1.5 - s, v.z * 1.5, 3, seed);
      const pit = noise3(v.x * 3.3 - s, v.y * 3.3, v.z * 3.3 + s, seed + 9);
      f = 1 + 0.55 * (n1 - 0.5) * 2.2 - 0.42 * Math.max(0, pit - 0.55) / 0.45;
      v.multiplyScalar(f);
      for (const [n, d] of planes) { const e = v.dot(n) - d; if (e > 0) v.addScaledVector(n, -e * 0.85); }
    }
    disp[k] = v.length();
    pa.setXYZ(k, v.x * rad[0], v.y * rad[1], v.z * rad[2]);
  }
  g.setAttribute('disp', new THREE.BufferAttribute(disp, 1));
  g.computeVertexNormals();
  return g;
}
/** 带孔太湖石：噪声位移圆环（轴 = 局部 Z），孔洞真实透空 */
function holeStoneGeo(rad, seed) {
  let g = new THREE.TorusGeometry(1, 0.5, 6, 11);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const pa = g.attributes.position, s = (seed % 83) * 1.91, v = new V3(), c = new V3(), disp = new Float32Array(pa.count);
  for (let k = 0; k < pa.count; k++) {
    v.set(pa.getX(k), pa.getY(k), pa.getZ(k));
    c.set(v.x, v.y, 0).normalize();
    const f = 1 + 0.55 * (fbm3(v.x * 1.4 + s, v.y * 1.4, v.z * 1.4 - s, 3, seed) - 0.5) * 2;
    const inner = v.x * c.x + v.y * c.y < 1 ? 0.75 : 1; // 孔内侧暗
    v.sub(c).multiplyScalar(f).add(c);
    disp[k] = f * inner;
    pa.setXYZ(k, v.x * rad[0], v.y * rad[1], v.z * rad[2]);
  }
  g.setAttribute('disp', new THREE.BufferAttribute(disp, 1));
  g.computeVertexNormals();
  return g;
}
/** 将石块几何变换后加入累加器：逐三角形盒投影 UV（米/周期），顶点色 = 底色 × 凹处暗 × 底面暗 × 竖向流痕 */
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function addStone(acc, geo, pos, rot, col, { period = 2.2, ao = () => 1, flat = false, streak = true } = {}) {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ'));
  _m4.compose(new V3(...pos), _q, new V3(1, 1, 1));
  const g = geo.clone().applyMatrix4(_m4);
  const ng = g.toNonIndexed();
  if (flat) ng.computeVertexNormals();
  const pa = ng.attributes.position, na = ng.attributes.normal, da = ng.attributes.disp;
  const base = new THREE.Color(col), C = new THREE.Color();
  const vb = 0.86 + 0.28 * hash(Math.round(pos[0] * 10), Math.round(pos[1] * 10), Math.round(pos[2] * 10), 13);
  const a = new V3(), b = new V3(), c = new V3(), fn = new V3();
  const o0 = acc.count;
  for (let t = 0; t < pa.count; t += 3) {
    a.fromBufferAttribute(pa, t); b.fromBufferAttribute(pa, t + 1); c.fromBufferAttribute(pa, t + 2);
    fn.subVectors(c, b).cross(new V3().subVectors(a, b));
    const ax = Math.abs(fn.x), ay = Math.abs(fn.y), az = Math.abs(fn.z);
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k];
      const u = ax >= ay && ax >= az ? [p.z, p.y] : ay >= az ? [p.x, p.z] : [p.x, p.y];
      const ny = na.getY(t + k);
      const conc = da ? clamp01((da.getX(t + k) - 0.62) / 0.5) : 1;
      const st = streak ? 0.8 + 0.4 * fbm3(p.x * 0.9, p.y * 0.12, p.z * 0.9, 2, 7) : 1;
      C.copy(base).multiplyScalar((0.3 + 0.7 * conc) * (0.62 + 0.38 * clamp01(ny * 0.6 + 0.6)) * st * ao(p.y) * vb);
      acc.vert(p.x, p.y, p.z, na.getX(t + k), ny, na.getZ(t + k), u[0] / period, u[1] / period, C);
    }
    acc.tri(o0 + t, o0 + t + 1, o0 + t + 2);
  }
}

// 峰石原型（单块立石，高 1）
registerProtoFamily('rock', (key, [style, variant]) => {
  const qing = style === 'qing', v = +variant || 0, seed = 977 + v * 61 + (qing ? 7 : 0), R = rng(seed);
  const acc = new Acc(), col = qing ? QING_COL : TAIHU_COL;
  const opt = { period: 0.6, flat: qing, ao: (y) => 0.8 + 0.2 * clamp01(y * 2) };
  if (qing) {
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const h = [0.32, 0.36, 0.3][i] * (0.9 + 0.2 * R()), w = (0.42 - i * 0.07) * (0.9 + 0.2 * R());
      addStone(acc, stoneGeo([w, h * 0.62, w * 0.75], seed + i * 13, true, 1), [(R() - 0.5) * 0.08, y + h * 0.5, (R() - 0.5) * 0.06], [0, R() * TAU, (R() - 0.5) * 0.2], col, opt);
      y += h * 0.82;
    }
  } else {
    // 瘦、漏、透、皱：细腰主体 + 错向叠置的穿孔石环 + 头大
    addStone(acc, stoneGeo([0.15, 0.32, 0.11], seed, false, 2), [0, 0.3, 0], [0, R() * TAU, (R() - 0.5) * 0.15], col, opt);
    for (let i = 0; i < 4; i++) {
      const y = 0.24 + i * 0.18 + R() * 0.04, s = 0.1 + 0.04 * R() + i * 0.012;
      addStone(acc, holeStoneGeo([s, s * (1.1 + 0.3 * R()), s * 0.8], seed + 5 + i * 7), [(R() - 0.5) * 0.12, y, (R() - 0.5) * 0.06], [(R() - 0.5) * 0.5, i * 1.7 + R(), (R() - 0.5) * 0.9], col, opt);
    }
    addStone(acc, stoneGeo([0.19, 0.12, 0.14], seed + 2, false, 1), [(R() - 0.5) * 0.06, 0.92, 0], [0, R() * TAU, 0.35], col, opt);
  }
  return [{ mat: qing ? 'nt_qing' : 'nt_taihu', geo: acc.geo() }];
});

// ---------- 多边形工具 ----------
const signedArea = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
function cleanRing(P) {
  const out = [];
  for (const p of P) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push([p[0], p[1]]); }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-4) out.pop();
  return out;
}
function segCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
/** 多边形（含洞）是否自交 / 环间相交 */
export function polyIntersects(rings) {
  const segs = [];
  for (const P of rings) for (let i = 0; i < P.length; i++) segs.push([P[i], P[(i + 1) % P.length]]);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [a, b] = segs[i], [c, d] = segs[j];
    if (a === c || a === d || b === c || b === d) continue;
    if (segCross(a, b, c, d)) return true;
  }
  return false;
}
function pipEvenOdd(x, z, rings) {
  let inside = false;
  for (const P of rings) for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
/** 归一化多边形输入：[[x,z]...] | {outer, holes} | [[[x,z]...], ...]（首环为外环） */
function toRings(poly) {
  if (!Array.isArray(poly)) return [poly.outer, ...(poly.holes || [])].map(cleanRing);
  if (Array.isArray(poly[0][0])) return poly.map(cleanRing);
  return [cleanRing(poly)];
}
/** 平面区域三角化：简单多边形用耳切；自交时退化为奇偶规则网格填充（cell 米） */
function regionGeo(rings, y, cell) {
  const pos = [], uv = [], nor = [];
  const push = (x, z) => { pos.push(x, y, z); uv.push(x, z); nor.push(0, 1, 0); };
  if (!polyIntersects(rings)) {
    const outer = rings[0].map(([x, z]) => new THREE.Vector2(x, z));
    if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
    const holes = rings.slice(1).map((h) => { const H = h.map(([x, z]) => new THREE.Vector2(x, z)); if (!THREE.ShapeUtils.isClockWise(H)) H.reverse(); return H; });
    const all = outer.concat(...holes);
    for (const t of THREE.ShapeUtils.triangulateShape(outer, holes)) for (const i of [t[0], t[2], t[1]]) push(all[i].x, all[i].y);
  } else {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const P of rings) for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const cs = cell || Math.max(0.5, Math.sqrt((x1 - x0) * (z1 - z0)) / 300);
    for (let x = x0; x < x1; x += cs) for (let z = z0; z < z1; z += cs) {
      if (!pipEvenOdd(x + cs / 2, z + cs / 2, rings)) continue;
      push(x, z); push(x, z + cs); push(x + cs, z + cs); push(x, z); push(x + cs, z + cs); push(x + cs, z);
    }
  }
  return fromArrays(pos, uv, nor);
}

/** 贴地区域几何（朝上，UV=米）：poly 同 createWater，可带洞（如挖出水池的地面），自交安全 */
export function areaGeo(poly, y = 0, cell) { return regionGeo(toRings(poly).filter((r) => r.length >= 3), y, cell); }

// ---------- 假山 ----------
/**
 * 假山（堆秀山式叠石）。opts: poly 或 (w,d) 底面轮廓, h 高, seed, style: 'taihu'（太湖石，多孔洞）| 'qing'（青石）
 *   steps: true|1|2（磴道，默认东西两侧对称两道）, stepW 磴道宽, topW/topD/topZ 山顶平台尺寸与位置, cave（山前洞口，太湖石默认有）
 * 局部坐标：底面 y=0，正面朝 +Z。返回 { top, platform, spots }：山顶平台高度、平台多边形（放置山顶亭，如御景亭）、山体上可栽植点 [[x,y,z]...]
 */
export function buildRockery(ctx, opts = {}) {
  const { w = 10, d = 8, h = 6, seed = 1, style = 'taihu' } = opts;
  const qing = style === 'qing';
  const R = rng(seed * 9973 + 7);
  const mat = qing ? 'nt_qing' : 'nt_taihu', col = qing ? QING_COL : TAIHU_COL;
  const N = 48, M = Math.max(4, Math.round(h / 1.15));
  const th = (k) => (k / N) * TAU; // θ=0 指向 +Z，θ=90° 指向 +X
  // 底面中心与射线采样半径
  let bc = [0, 0];
  let baseR;
  if (opts.poly) {
    const P = cleanRing(opts.poly);
    bc = P.reduce((s, p) => [s[0] + p[0] / P.length, s[1] + p[1] / P.length], [0, 0]);
    baseR = Array.from({ length: N }, (_, k) => {
      const dx = Math.sin(th(k)), dz = Math.cos(th(k));
      let best = 0.5;
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        const ex = b[0] - a[0], ez = b[1] - a[1], wx = a[0] - bc[0], wz = a[1] - bc[1];
        const den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = (wx * ez - wz * ex) / den, s = (wx * dz - wz * dx) / den;
        if (t > 0 && s >= 0 && s <= 1) best = Math.max(best, t);
      }
      return best;
    });
  } else {
    baseR = Array.from({ length: N }, (_, k) => {
      const a = th(k), sx = Math.abs(Math.sin(a)), cz = Math.abs(Math.cos(a)), e = 2.6;
      const r = 1 / Math.pow(Math.pow(sx / (w / 2), e) + Math.pow(cz / (d / 2), e), 1 / e);
      return r * (1 + 0.16 * (fbm3(Math.sin(a) * 1.3 + seed, Math.cos(a) * 1.3, 0.5, 2, seed) - 0.5) * 2);
    });
  }
  const bw = opts.poly ? Math.max(...baseR) * 2 : w, bd = opts.poly ? bw * 0.8 : d;
  const topW = opts.topW ?? Math.max(3.2, bw * 0.46), topD = opts.topD ?? Math.max(3.2, bd * 0.52);
  const tc = [bc[0] + (opts.topX ?? 0), bc[1] + (opts.topZ ?? -bd * 0.06)];
  const topR = Array.from({ length: N }, (_, k) => {
    const a = th(k), sx = Math.abs(Math.sin(a)), cz = Math.abs(Math.cos(a)), e = 5;
    return 1 / Math.pow(Math.pow(sx / (topW / 2), e) + Math.pow(cz / (topD / 2), e), 1 / e);
  });
  // 层：高度、中心、插值系数（陡峭的叠石崖壁）
  const lv = [];
  for (let j = 0; j <= M; j++) {
    const t = j / M;
    let s = Math.pow(t, 1.6);
    if (j > 0 && j < M) s = clamp01(s + (R() - 0.5) * 0.07);
    lv.push({ y: j === 0 ? -0.3 : j === M ? h - 0.12 : t * h, s, c: [lerp(bc[0], tc[0], s), lerp(bc[1], tc[1], s)] });
  }
  const amp = qing ? 0.55 : 0.8;
  const rad = lv.map((L, j) => Array.from({ length: N }, (_, k) => {
    const r0 = lerp(baseR[k], topR[k], L.s);
    if (j === M) return topR[k] * 0.96;
    const x = Math.sin(th(k)) * r0, z = Math.cos(th(k)) * r0;
    return Math.max(0.6, r0 + (fbm3(x * 0.2, L.y * 0.28, z * 0.2, 3, seed) - 0.5) * 2 * amp * (j === 0 ? 0.5 : 1));
  }));
  const surf = (theta, y) => { // 双线性插值核心面半径与层中心
    const kf = (((theta / TAU) * N) % N + N) % N, k0 = Math.floor(kf) % N, k1 = (k0 + 1) % N, fk = kf - Math.floor(kf);
    let j = 0;
    while (j < M - 1 && lv[j + 1].y < y) j++;
    const fj = clamp01((y - lv[j].y) / (lv[j + 1].y - lv[j].y));
    const r = lerp(lerp(rad[j][k0], rad[j][k1], fk), lerp(rad[j + 1][k0], rad[j + 1][k1], fk), fj);
    return { r, c: [lerp(lv[j].c[0], lv[j + 1].c[0], fj), lerp(lv[j].c[1], lv[j + 1].c[1], fj)] };
  };
  // 磴道：θ 从侧后方绕向前方，随高度上升
  const flights = [];
  const nF = opts.steps === false || opts.steps === 0 ? 0 : opts.steps === 1 ? 1 : 2;
  const stepW = opts.stepW ?? 1.25, rise = 0.21;
  const a0 = (opts.stepsFrom ?? 105) * Math.PI / 180, a1 = (opts.stepsTo ?? 22) * Math.PI / 180;
  for (let f = 0; f < nF; f++) {
    const sg = f === 0 ? 1 : -1, ns = Math.ceil((h - 0.12) / rise), steps = [];
    for (let i = 0; i < ns; i++) {
      const t = (i + 0.5) / ns, theta = sg * lerp(a0, a1, t), y = (i * (h - 0.12)) / ns;
      const S = surf(theta, y + rise);
      steps.push({ theta, y, top: ((i + 1) * (h - 0.12)) / ns, rIn: S.r - 0.45, c: S.c });
    }
    flights.push({ sg, steps, ns });
  }
  // 磴道上方净空：压低核心面
  const stairAt = (F, theta) => { // 返回该 θ 处磴道（高度、内缘半径），不在范围返回 null
    const t = (theta * F.sg - a0) / (a1 - a0);
    if (t < -0.02 || t > 1.02) return null;
    const i = Math.max(0, Math.min(F.ns - 1, Math.floor(t * F.ns)));
    return F.steps[i];
  };
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  for (const F of flights) for (let k = 0; k < N; k++) {
    const st = stairAt(F, wrapA(th(k)));
    if (!st) continue;
    for (let j = 1; j < M; j++) if (lv[j].y > st.y - 1.3 && lv[j].y < st.top + 2.6) rad[j][k] = Math.min(rad[j][k], st.rIn + 0.05 - 0.5 * fbm3(k * 0.7, j * 0.9, 3, 2, seed));
  }
  // 洞口：正面底部
  const cave = opts.cave ?? !qing;
  const caveW = Math.min(2.4, bw * 0.12), caveH = Math.min(2.6, h * 0.3);
  if (cave) for (let k = 0; k < N; k++) {
    const a = wrapA(th(k));
    if (Math.abs(a) * baseR[0] < caveW * 0.9) for (let j = 1; j < M; j++) if (lv[j].y < caveH + 0.4) rad[j][k] = Math.min(rad[j][k], baseR[k] - 1.6);
  }
  // 核心体
  const core = new Acc();
  const base = new THREE.Color(col), C = new THREE.Color();
  const grid = [];
  for (let k = 0; k <= N; k++) {
    const row = [];
    for (let j = 0; j <= M; j++) {
      const a = th(k % N), r = rad[j][k % N];
      row.push([lv[j].c[0] + Math.sin(a) * r, lv[j].y, lv[j].c[1] + Math.cos(a) * r]);
    }
    grid.push(row);
  }
  {
    const o0 = core.count;
    for (let k = 0; k <= N; k++) for (let j = 0; j <= M; j++) {
      const p = grid[k][j], a = th(k % N);
      C.copy(base).multiplyScalar((0.32 + 0.2 * (j / M)) * (0.85 + 0.3 * fbm3(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5, 2, 3)));
      core.vert(p[0], p[1], p[2], Math.sin(a), 0, Math.cos(a), (p[0] + p[2]) / 2.2, p[1] / 2.2, C);
    }
    for (let k = 0; k < N; k++) for (let j = 0; j < M; j++) {
      const a = o0 + k * (M + 1) + j, b = a + M + 1;
      core.tri(a, b, b + 1); core.tri(a, b + 1, a + 1);
    }
    const g = core.geo(); g.computeVertexNormals();
    const cAcc = new Acc(); // 逐三角形盒投影 UV，避免平面投影拉伸
    addStone(cAcc, g, [0, 0, 0], [0, 0, 0], shade(col, 0.55), { ao: (y) => 0.7 + 0.3 * clamp01(y / h) });
    ctx.add(mat, cAcc.geo());
  }
  // 叠石：沿核心面逐层布石，避让磴道与洞口
  const stones = new Acc(), spots = [];
  // 石块与磴道/洞口的避让：磴道上方的石块退到踏步内缘之后（成为磴道内侧石壁），洞口处跳过；返回调整后的半径或 null
  const fit = (theta, y, r, ry, rx, rz) => {
    if (cave && Math.abs(wrapA(theta)) * r < caveW + rx * 0.6 && y - ry < caveH + 0.2) return null;
    for (const F of flights) for (const dt of [-1, 0, 1]) {
      const st = stairAt(F, wrapA(theta + (dt * rx) / Math.max(1, r)));
      if (!st || y + ry * 1.3 < st.y - 0.1 || y - ry * 1.3 > st.top + 2.6) continue;
      if (y - ry * 0.3 < st.top + 0.1) return null;
      r = Math.min(r, st.rIn - rz * 0.7);
    }
    return r;
  };
  const aoY = (y) => 0.78 + 0.22 * clamp01(y / h + 0.2);
  let sid = 0;
  for (let j = 0; j < M * 2; j++) {
    const yb = (j / (M * 2)) * h;
    for (let k = 0; k < N; k++) {
      if (R() < 0.18) continue;
      const theta = th(k) + (R() - 0.5) * (TAU / N) + (j % 2) * (TAU / N / 2), y = Math.max(0.25, yb + R() * (h / M) * 0.4);
      const S = surf(theta, y);
      const big = lerp(1.5, 0.85, y / h) * (qing ? 1.15 : 1);
      const rs = big * (0.45 + 0.9 * R()), tall = !qing && R() < 0.2;
      const rx = rs * (qing ? 1.5 : tall ? 0.75 : 1.25), ry = rs * (qing ? 0.55 : tall ? 1.35 : 0.75), rz = rs * (qing ? 1.1 : tall ? 0.7 : 0.95);
      const rr = S.r + rs * 0.02;
      const r2 = fit(theta, y, rr, ry, rx, rz);
      if (r2 === null || r2 < S.r - rz * 1.6) continue;
      const pos = [S.c[0] + Math.sin(theta) * r2, y, S.c[1] + Math.cos(theta) * r2];
      const yaw = theta + (R() - 0.5) * 0.6;
      sid++;
      if (y > 2 && R() < 0.12) spots.push([pos[0] + Math.sin(theta) * rz * 0.3, y + ry * 0.7, pos[2] + Math.cos(theta) * rz * 0.3]);
      if (!qing && R() < 0.13 && y > 1.2) addStone(stones, holeStoneGeo([rs * 0.75, rs * 0.7, rs * 0.5], seed * 31 + sid), pos, [(R() - 0.5) * 0.3, theta, (R() - 0.5) * 0.8], col, { ao: aoY });
      else addStone(stones, stoneGeo([rx, ry, rz], seed * 31 + sid, qing, !qing && y < 4 && rs > 0.9 ? 2 : 1), pos, [(R() - 0.5) * 0.25, yaw, (R() - 0.5) * 0.3], col, { ao: aoY, flat: qing });
    }
  }
  // 山顶平台：条石台帮 + 方砖地面 + 沿边小石
  const plat = Array.from({ length: 32 }, (_, k) => { const a = (k / 32) * TAU, kk = (k / 32) * N, r = lerp(topR[Math.floor(kk) % N], topR[Math.ceil(kk) % N], kk % 1); return [tc[0] + Math.sin(a) * r, tc[1] + Math.cos(a) * r]; });
  ctx.add('stone_grey', prismGeo(plat, h - 0.5, h, { top: false }));
  ctx.add('paving', polyTopGeo(plat, h));
  ctx.add('stone_grey', sweep([[-0.16, 0], [0.16, 0], [0.16, 0.12], [-0.16, 0.12]], offsetPoly(plat, -0.16).map(([x, z]) => [x, h - 0.02, z]), { closed: true }));
  for (let k = 0; k < 32; k += 2) {
    const a = (k / 32) * TAU;
    let skip = false;
    for (const F of flights) if (Math.abs(wrapA(a - F.sg * a1)) < 0.45) skip = true;
    if (skip || R() < 0.35) continue;
    const p = plat[k], rs = 0.35 + 0.3 * R();
    addStone(stones, stoneGeo([rs * 1.2, rs * 0.7, rs], seed * 53 + k, qing, 1), [p[0] + Math.sin(a) * 0.2, h + rs * 0.3, p[1] + Math.cos(a) * 0.2], [0, a, 0], col, { ao: aoY, flat: qing });
  }
  ctx.add(mat, stones.geo());
  // 磴道踏步：粗凿条石，下部垫石延伸入山体
  if (flights.length) {
    const sAcc = new Acc(), SC = new THREE.Color(0x9a958a), q = new THREE.Color();
    const box = (w, hh, dd, x, y, z, ry, col) => {
      const g = new THREE.BoxGeometry(w, hh, dd);
      g.rotateY(ry); g.translate(x, y, z);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6);
      const n = g.attributes.position.count, ca = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      sAcc.add(g);
    };
    for (const F of flights) for (const st of F.steps) {
      const sw = stepW * (0.82 + 0.3 * R()), rc = st.rIn + sw / 2 + (R() - 0.5) * 0.12, th2 = st.top - st.y + 0.18;
      const run = Math.abs(a1 - a0) * (rc + 0.3) / F.ns * (1.45 + 0.3 * R());
      const ry = st.theta + Math.PI / 2 + (R() - 0.5) * 0.22, sx = Math.sin(st.theta), sz = Math.cos(st.theta);
      q.copy(SC).multiplyScalar(0.72 + 0.4 * R());
      // 踏步条石（宽窄、走向、高低略不齐，似毛石）+ 内侧垫石（深入山体）
      box(sw, th2, Math.max(0.32, run), st.c[0] + sx * rc, st.top - th2 / 2 + (R() - 0.5) * 0.05, st.c[1] + sz * rc, ry, q);
      q.multiplyScalar(0.7);
      box(stepW * 0.7, 1.4, Math.max(0.32, run), st.c[0] + sx * (rc - stepW * 0.15), st.top - th2 - 0.7, st.c[1] + sz * (rc - stepW * 0.15), ry, q);
    }
    ctx.add(qing ? 'nt_qing' : 'nt_taihu', sAcc.geo());
    // 磴道外侧护石
    const gAcc = new Acc();
    for (const F of flights) for (let i = 1; i < F.steps.length - 1; i += 2) {
      const st = F.steps[i], sx = Math.sin(st.theta), sz = Math.cos(st.theta);
      if (R() < 0.75) { // 外缘护石（压住踏步外端，打破规整齿形）
        const rs = 0.32 + 0.3 * R(), rr = st.rIn + stepW + rs * 0.2;
        addStone(gAcc, stoneGeo([rs * 1.4, rs * 0.8, rs], seed * 71 + i + F.sg * 500, qing, 1), [st.c[0] + sx * rr, st.top - rs * 0.15, st.c[1] + sz * rr], [(R() - 0.5) * 0.3, st.theta + (R() - 0.5) * 0.5, 0], col, { ao: aoY, flat: qing });
      }
      // 踏步下方托石
      const rs = 0.5 + 0.3 * R(), rr = st.rIn + stepW * 0.8;
      if (st.y > 1.2) addStone(gAcc, stoneGeo([rs * 1.3, rs * 0.7, rs * 0.9], seed * 73 + i + F.sg * 700, qing, 1), [st.c[0] + sx * rr, st.y - 0.25 - rs * 1.25, st.c[1] + sz * rr], [(R() - 0.5) * 0.3, st.theta, 0], col, { ao: aoY, flat: qing });
    }
    ctx.add(mat, gAcc.geo());
  }
  // 洞口：拱形叠石 + 暗洞
  if (cave) {
    const cz = bc[1] + baseR[0] - 1.25, cA = new Acc();
    const holeP = [];
    for (let i = 0; i <= 12; i++) { const a = Math.PI * (i / 12); holeP.push([Math.cos(a) * caveW * 0.5, Math.sin(a) * caveH * 0.95]); }
    const pos = [], uvs = [];
    for (let i = 0; i < 12; i++) { const p = holeP[i], q2 = holeP[i + 1]; pos.push(bc[0], 0, cz - 0.2, bc[0] + p[0], p[1], cz - 0.15, bc[0] + q2[0], q2[1], cz - 0.15); uvs.push(0, 0, 0, 0, 0, 0); }
    // 暗洞面（朝 +Z）
    const hg = fromArrays(pos, uvs);
    ctx.add('nt_cave', hg);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (i / 8), rs = 0.55 + 0.25 * R();
      const p = [bc[0] + Math.cos(a) * (caveW * 0.5 + rs * 0.6), Math.sin(a) * (caveH + rs * 0.4), cz + 0.15];
      addStone(cA, stoneGeo([rs * 1.1, rs * 0.85, rs * 0.9], seed * 91 + i, qing, 2), p, [0, R() * TAU, 0], col, { ao: aoY });
    }
    ctx.add(mat, cA.geo());
  }
  return { top: h, platform: plat, spots };
}

// ---------- 水面 ----------
const waterTime = { value: 0 };
const waterMats = new Map();
function waterMaterial(color = 0x1d4030) {
  if (waterMats.has(color)) return waterMats.get(color);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.07, metalness: 0 });
  m.normalMap = makeTexture('nt_water_normal');
  m.normalScale = new THREE.Vector2(0.13, 0.13);
  m.envMapIntensity = 0.3;
  const macro = makeTexture('nt_macro');
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterTime;
    sh.uniforms.uMacro = { value: macro };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform sampler2D uMacro;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      float wm = texture2D(uMacro, vNormalMapUv * 0.012 + uTime * vec2(0.0004, 0.0002)).r;
      diffuseColor.rgb *= 0.85 + 0.3 * wm;`)
      .replace('#include <normal_fragment_maps>', `
      vec2 wuv = vNormalMapUv;
      vec3 n1 = texture2D(normalMap, wuv * 0.06 + uTime * vec2(0.011, 0.007)).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D(normalMap, wuv * 0.15 + uTime * vec2(-0.009, 0.013)).xyz * 2.0 - 1.0;
      vec3 n3 = texture2D(normalMap, wuv * 0.021 + uTime * vec2(0.004, -0.003)).xyz * 2.0 - 1.0;
      vec3 mapN = normalize(vec3((n1.xy + n2.xy * 0.7 + n3.xy * 0.9) * normalScale, 1.0));
      normal = normalize(tbn * mapN);`)
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      iblIrradiance *= vec3(0.7, 0.92, 0.75);
      radiance *= vec3(0.6, 0.8, 0.62);`);
  };
  m.customProgramCacheKey = () => 'ntwater';
  waterMats.set(color, m);
  return m;
}
/**
 * 水面网格（独立 Mesh，不走批处理，以便使用动画材质）。poly=[[x,z]...]（或 {outer,holes} / [外环, 洞...]），y 水面高度。
 * 自交多边形自动退化为奇偶规则网格填充。opts: color 水色, cell 退化网格尺寸(米)。
 * 返回 THREE.Mesh；配合 updateWater(t) 每帧更新。
 */
export function createWater(poly, y = 0, opts = {}) {
  const rings = toRings(poly).filter((r) => r.length >= 3);
  const g = regionGeo(rings, y, opts.cell);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, waterMaterial(opts.color));
  m.name = 'water';
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}
/** t：秒 */
export function updateWater(t) { waterTime.value = t; }

// 朝水的竖直岸壁（P 为 x-z 正向环）
function bankWall(ctx, P, y0, y1, mat) {
  const pos = [], uv = [], nor = [];
  let acc = 0;
  for (let i = 0; i < P.length; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length], L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 1e-6) continue;
    const nx = -(z2 - z1) / L, nz = (x2 - x1) / L;
    const q = [[x1, y0, z1, acc, y0], [x2, y0, z2, acc + L, y0], [x2, y1, z2, acc + L, y1], [x1, y1, z1, acc, y1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { const v = q[k]; pos.push(v[0], v[1], v[2]); uv.push(v[3], v[4]); nor.push(nx, 0, nz); }
    acc += L;
  }
  ctx.add(mat, fromArrays(pos, uv, nor));
}
/**
 * 驳岸：沿水面多边形一圈。opts: poly, y 水面高, style: 'stone'（条石驳岸+压面石）| 'rock'（山石驳岸）,
 *   height 岸顶高出水面, depth 水下深, width 压面石宽, rock: 'taihu'|'qing', seed
 */
export function buildWaterBank(ctx, opts) {
  const { y = 0, style = 'stone', height = 0.5, depth = 0.8, width = 0.45, seed = 3 } = opts;
  for (let P of toRings(opts.poly)) {
    if (signedArea(P) < 0) P = P.slice().reverse(); // 统一为 x-z 正向
    if (style === 'rock') {
      const qing = opts.rock === 'qing', R = rng(seed * 131 + P.length), acc = new Acc(), col = qing ? QING_COL : TAIHU_COL;
      let id = 0;
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; // 正向时 (dz,-dx) 指向外（岸上）
        for (let s = 0; s < L; s += 1.0 + R() * 0.9) {
          const t = s / L, rs = 0.55 + 0.55 * R(), off = (R() - 0.3) * 0.6;
          const p = [lerp(a[0], b[0], t) + nx * off, y + rs * 0.15 + R() * 0.2, lerp(a[1], b[1], t) + nz * off];
          addStone(acc, stoneGeo([rs * 1.3, rs * 0.7, rs], seed * 17 + id++, qing, 1), p, [(R() - 0.5) * 0.2, Math.atan2(nx, nz), (R() - 0.5) * 0.3], col, { flat: qing, period: 1.6 });
          if (R() < 0.3) addStone(acc, stoneGeo([rs * 0.8, rs * 0.55, rs * 0.7], seed * 17 + id++, qing, 1), [p[0] + nx * rs * 0.8, p[1] + rs * 0.5, p[2] + nz * rs * 0.8], [0, R() * TAU, 0], col, { flat: qing, period: 1.6 });
        }
      }
      ctx.add(qing ? 'nt_qing' : 'nt_taihu', acc.geo());
      bankWall(ctx, P, y - depth, y + height * 0.6, 'ground_dirt');
    } else {
      bankWall(ctx, P, y - depth, y + height, opts.wallMat || 'stone_grey');
      const path = offsetPoly(P, width / 2 - 0.05).map(([x, z]) => [x, y + height, z]);
      ctx.add(opts.capMat || 'stone_grey', sweep([[-width / 2, 0], [width / 2, 0], [width / 2, 0.16], [-width / 2, 0.16]], path, { closed: true }));
    }
  }
}

// ---------- 草地 / 花坛 ----------
/**
 * 草地/花坛（贴地多边形）。opts: poly, y=0.03, kind: 'grass' | 'bed'（土面花坛）,
 *   curb 路缘石高（0 无）, curbW 路缘石宽, curbMat, shrubs 每平方米灌木/花丛数, flowers: true 时只用开花灌木, seed
 */
export function buildLawn(ctx, opts) {
  const { y = 0.03, kind = 'grass', curb = 0, curbW = 0.22, seed = 5 } = opts;
  const rings = toRings(opts.poly);
  ctx.add(kind === 'bed' ? 'nt_soil' : 'nt_grass', regionGeo(rings, y));
  let P = rings[0];
  if (signedArea(P) < 0) P = P.slice().reverse();
  if (curb > 0) {
    const path = offsetPoly(P, -curbW / 2).map(([x, z]) => [x, y - 0.05, z]);
    ctx.add(opts.curbMat || 'stone_grey', sweep([[-curbW / 2, 0], [curbW / 2, 0], [curbW / 2, curb + 0.05], [-curbW / 2, curb + 0.05]], path, { closed: true }));
  }
  if (opts.shrubs) {
    const R = rng(seed * 7 + 1);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const n = Math.round(Math.abs(signedArea(P)) * opts.shrubs);
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const x = lerp(x0, x1, R()), z = lerp(z0, z1, R());
      if (!pipEvenOdd(x, z, rings)) continue;
      const v = opts.flowers ? 2 + ((R() * 2) | 0) : (R() * 4) | 0;
      const s = 0.7 + 0.6 * R();
      ctx.place(`tree:shrub:${v}`, x, y, z, R() * TAU, [s * (0.9 + 0.3 * R()), s, s * (0.9 + 0.3 * R())]);
      i++;
    }
  }
}
