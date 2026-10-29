// 程序化纹理（Canvas 生成，无外部图片）。makeTexture(name) 返回 THREE.Texture（已缓存）。
// 纹理名与 materials.js 中 DEFS[*].map / normalMap / roughnessMap 对应；名字含 normal / rough 的按线性数据上传。
// 约定：canvas 顶行 = v=1（flipY）。米制纹理上下左右无缝；粗糙度贴图带 Toksvig mip（远处法线起伏折入粗糙度，防高光闪烁）。
// 成套纹理 registerSet(name) 同时提供 name / name_normal / name_rough。
import * as THREE from 'three';

const cache = new Map();
const generators = {};
const texOpts = {};

/** 注册纹理：fn 返回 canvas | { mips:[canvas...] } | THREE.Texture；opt.aniso 各向异性等级 */
export function registerTexture(name, fn, opt = {}) {
  generators[name] = fn;
  texOpts[name] = opt;
  cache.delete(name);
}

export function makeTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const gen = generators[name];
  if (!gen) { console.warn('no texture generator', name); return null; }
  const out = gen();
  let tex;
  if (out.isTexture) tex = out;
  else if (out.mips) {
    tex = new THREE.Texture(out.mips[0]);
    tex.mipmaps = out.mips;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
  } else tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = texOpts[name]?.aniso ?? 8;
  if (!/normal|rough/.test(name)) tex.colorSpace = THREE.SRGBColorSpace;
  tex.name = name;
  tex.needsUpdate = true;
  cache.set(name, tex);
  return tex;
}

export function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 可复现的伪随机
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** 由高度函数 h(x,y)∈[0,1]（x,y∈[0,1)）生成法线贴图 canvas */
export function normalFromHeight(size, hfn, strength = 2) {
  const F = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) F[y * size + x] = hfn(x / size, y / size);
  return normalFromField(F, size, size, strength * 2);
}

// ===================== 工具 =====================
const TAU = Math.PI * 2;
const fract = (x) => x - Math.floor(x);
const mod = (a, n) => ((a % n) + n) % n;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const css = (c, a = 1) => (typeof c === 'string' ? c : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
const grey = (v) => { const k = Math.round(clamp01(v) * 255); return `rgb(${k},${k},${k})`; };

/** 整数哈希 → [0,1) */
export function hash(ix, iy = 0, seed = 0) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul((seed | 0) + 0x3c6ef372, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 可平铺分形 value noise：Float32Array(W*H)，归一化到 [0,1]。cx,cy = 最低频格数 */
export function noiseField(W, H, { cx = 4, cy = cx, oct = 4, seed = 1, gain = 0.5, norm = true } = {}) {
  const out = new Float32Array(W * H);
  let amp = 1, gx = cx, gy = cy;
  for (let o = 0; o < oct; o++) {
    const L = new Float32Array(gx * gy);
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) L[j * gx + i] = hash(i, j, seed * 131 + o * 17);
    for (let y = 0; y < H; y++) {
      const fy = (y / H) * gy, j0 = Math.floor(fy), ty = fy - j0, sy = ty * ty * (3 - 2 * ty);
      const r0 = (j0 % gy) * gx, r1 = ((j0 + 1) % gy) * gx;
      for (let x = 0; x < W; x++) {
        const fx = (x / W) * gx, i0 = Math.floor(fx), tx = fx - i0, sx = tx * tx * (3 - 2 * tx), i1 = (i0 + 1) % gx;
        const a = L[r0 + i0], b = L[r0 + i1], c = L[r1 + i0], d = L[r1 + i1];
        out[y * W + x] += amp * (a + (b - a) * sx + (c - a + (d - c - b + a) * sx) * sy);
      }
    }
    amp *= gain; gx *= 2; gy *= 2;
  }
  if (norm) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < out.length; i++) { if (out[i] < lo) lo = out[i]; if (out[i] > hi) hi = out[i]; }
    const k = 1 / (hi - lo || 1);
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) * k;
  }
  return out;
}

/** 逐像素生成 canvas：fn(x, y, out[rgb], i) */
function pixels(W, H, fn) {
  const c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, o = [0, 0, 0];
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    fn(x, y, o, i);
    const k = i * 4;
    d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** 读取 canvas R 通道为 [0,1] 浮点场 */
function readField(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, F = new Float32Array(W * H);
  for (let i = 0; i < F.length; i++) F[i] = d[i * 4] / 255;
  return F;
}

/** 可分离盒式模糊 */
export function blur(F, W, H, r = 1, wrap = true) {
  if (r <= 0) return F;
  const T = new Float32Array(W * H), O = new Float32Array(W * H), n = 2 * r + 1;
  const ix = (v, N) => (wrap ? mod(v, N) : v < 0 ? 0 : v >= N ? N - 1 : v);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let s = 0;
    for (let k = -r; k <= r; k++) s += F[row + ix(k, W)];
    for (let x = 0; x < W; x++) {
      T[row + x] = s / n;
      s += F[row + ix(x + r + 1, W)] - F[row + ix(x - r, W)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += T[ix(k, H) * W + x];
    for (let y = 0; y < H; y++) {
      O[y * W + x] = s / n;
      s += T[ix(y + r + 1, H) * W + x] - T[ix(y - r, H) * W + x];
    }
  }
  return O;
}

/** 高度场 → 单位法线数组（切线空间，OpenGL 约定）。k = 高度单位→像素的换算 */
function normalsOf(F, W, H, k, wrap = true) {
  const N = new Float32Array(W * H * 3);
  const ix = (v, n) => (wrap ? mod(v, n) : v < 0 ? 0 : v >= n ? n - 1 : v);
  for (let y = 0; y < H; y++) {
    const ym = ix(y - 1, H) * W, yp = ix(y + 1, H) * W, yr = y * W;
    for (let x = 0; x < W; x++) {
      const dx = (F[yr + ix(x + 1, W)] - F[yr + ix(x - 1, W)]) * 0.5 * k;
      const dy = (F[yp + x] - F[ym + x]) * 0.5 * k;
      const l = Math.hypot(dx, dy, 1), i = (yr + x) * 3;
      N[i] = -dx / l; N[i + 1] = dy / l; N[i + 2] = 1 / l;
    }
  }
  return N;
}
function normalCanvas(N, W, H) {
  const c = canvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let i = 0; i < W * H; i++) {
    d[i * 4] = (N[i * 3] * 0.5 + 0.5) * 255; d[i * 4 + 1] = (N[i * 3 + 1] * 0.5 + 0.5) * 255;
    d[i * 4 + 2] = (N[i * 3 + 2] * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
export function normalFromField(F, W, H, k = 1, wrap = true) { return normalCanvas(normalsOf(F, W, H, k, wrap), W, H); }

/** 粗糙度（灰度，three 取 G 通道）+ Toksvig mip 链 */
function roughMips(R, W, H, N = null, k = 0.6) {
  const mips = [];
  let w = W, h = H, n = N, r2 = new Float32Array(W * H);
  for (let i = 0; i < r2.length; i++) r2[i] = R[i] * R[i];
  for (;;) {
    const c = canvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let i = 0; i < w * h; i++) {
      let a = r2[i];
      if (n) { const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]); a += (k * (1 - l)) / Math.max(l, 0.05); }
      const v = Math.sqrt(Math.min(1, a)) * 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    mips.push(c);
    if (w === 1 && h === 1) break;
    const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1);
    const rb = new Float32Array(w2 * h2), nb = n ? new Float32Array(w2 * h2 * 3) : null;
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      const o = y * w2 + x;
      for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
        const j = Math.min(h - 1, y * 2 + oy) * w + Math.min(w - 1, x * 2 + ox);
        rb[o] += r2[j] * 0.25;
        if (n) { nb[o * 3] += n[j * 3] * 0.25; nb[o * 3 + 1] += n[j * 3 + 1] * 0.25; nb[o * 3 + 2] += n[j * 3 + 2] * 0.25; }
      }
    }
    r2 = rb; n = nb; w = w2; h = h2;
  }
  return { mips };
}

/** 凹处压暗（烘焙环境光遮蔽），作用于颜色 canvas */
function cavityShade(c, F, W, H, amt, R, wrap) {
  const B = blur(blur(F, W, H, R, wrap), W, H, R, wrap);
  const g = c.getContext('2d'), img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < W * H; i++) {
    const s = 1 - clamp01((B[i] - F[i]) * amt) + clamp01((F[i] - B[i]) * amt * 0.25);
    d[i * 4] *= s; d[i * 4 + 1] *= s; d[i * 4 + 2] *= s;
  }
  g.putImageData(img, 0, 0);
}

/** 颜色乘以噪声（污渍/色差） */
function grime(c, { amp = 0.1, cx = 4, oct = 4, seed = 1, wrap = true } = {}) {
  const W = c.width, H = c.height, n = noiseField(W, H, { cx, cy: Math.max(1, Math.round((cx * H) / W)), oct, seed });
  const g = c.getContext('2d'), img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < W * H; i++) { const s = 1 + amp * (n[i] - 0.5) * 2; d[i * 4] *= s; d[i * 4 + 1] *= s; d[i * 4 + 2] *= s; }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * 三层画布（颜色 c / 高度 h / 粗糙度 r，可选金属度 m）。draw(path, st)：st = { c, h, r, m, lw(描边宽), a(透明度), op }
 * c 可为 [r,g,b] / css 字符串 / (g)=>fillStyle。wrapX/Y：图元在周期边界外再画一遍。mx：水平镜像绘制。
 */
export class Painter {
  constructor(W, H, { wrapX = false, wrapY = false, c = '#000', h = 0, r = 0.8, m = null } = {}) {
    this.W = W; this.H = H; this.mx = false;
    this.L = { c: canvas(W, H), h: canvas(W, H), r: canvas(W, H) };
    if (m !== null) this.L.m = canvas(W, H);
    this.G = {};
    for (const k in this.L) this.G[k] = this.L[k].getContext('2d');
    this.offs = [];
    for (const ox of wrapX ? [-W, 0, W] : [0]) for (const oy of wrapY ? [-H, 0, H] : [0]) this.offs.push([ox, oy]);
    this.wrap = wrapX || wrapY;
    this.draw((g) => g.rect(0, 0, W, H), { c, h, r, m: m ?? undefined }, true);
  }
  draw(path, st, nowrap = false) {
    const offs = nowrap ? [[0, 0]] : this.offs;
    for (const k in this.L) {
      const s = st[k];
      if (s === undefined || s === null) continue;
      const g = this.G[k];
      for (const [ox, oy] of offs) {
        g.save();
        if (this.mx) { g.translate(this.W, 0); g.scale(-1, 1); }
        g.translate(ox, oy);
        if (st.a !== undefined) g.globalAlpha = st.a;
        if (st.op) g.globalCompositeOperation = st.op;
        const style = k === 'c' ? (typeof s === 'function' ? s(g) : css(s)) : grey(s);
        g.beginPath();
        path(g);
        if (st.lw) { g.lineWidth = st.lw; g.lineCap = st.cap || 'round'; g.lineJoin = 'round'; g.strokeStyle = style; g.stroke(); }
        else { g.fillStyle = style; g.fill(st.rule || 'nonzero'); }
        g.restore();
      }
    }
  }
  rect(x, y, w, h, st) { this.draw((g) => g.rect(x, y, w, h), st); }
  circle(x, y, r, st) { this.draw((g) => g.arc(x, y, Math.max(0.1, r), 0, TAU), st); }
  ellipse(x, y, rx, ry, st, rot = 0) { this.draw((g) => g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU), st); }
  poly(pts, st, close = true) {
    this.draw((g) => { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); if (close) g.closePath(); }, st);
  }
  line(pts, lw, st) { this.poly(pts, { ...st, lw }, false); }
  clip(path) { for (const k in this.G) { const g = this.G[k]; g.save(); g.beginPath(); path(g); g.clip(); } }
  unclip() { for (const k in this.G) this.G[k].restore(); }
}

/** Painter → { color, normal, rough, metal }。k 法线强度；cav 凹处压暗；toks Toksvig 系数 */
export function finish(P, { k = 3, blurR = 1, cav = 0, cavR = 5, toks = 0.5 } = {}) {
  const { W, H } = P, wrap = P.wrap;
  let F = readField(P.L.h);
  if (blurR) F = blur(F, W, H, blurR, wrap);
  if (cav) cavityShade(P.L.c, F, W, H, cav, cavR, wrap);
  const N = normalsOf(F, W, H, k, wrap);
  return { color: P.L.c, normal: normalCanvas(N, W, H), rough: roughMips(readField(P.L.r), W, H, N, toks), metal: P.L.m };
}

/** 成套注册：gen() → { color, normal?, rough? } */
export function registerSet(name, gen, opt = {}) {
  let res = null;
  const get = () => { if (!res) { res = gen(); setTimeout(() => { res = null; }, 0); } return res; };
  registerTexture(name, () => get().color, opt);
  registerTexture(name + '_normal', () => get().normal, opt);
  registerTexture(name + '_rough', () => get().rough, opt);
}

// ===================== 色板（清官式彩画矿物色） =====================
export const PAL = {
  qing: [26, 66, 140], qing2: [70, 122, 186], qing3: [150, 186, 222], // 青（石青/群青）及晕色
  lv: [22, 108, 82], lv2: [68, 154, 118], lv3: [150, 204, 172], // 绿（石绿）
  zhu: [178, 42, 28], zhuD: [120, 26, 18], // 朱
  red: [150, 34, 24], // 朱红油饰（门窗、连檐）
  gold: [222, 172, 66], goldD: [150, 100, 28], goldL: [250, 218, 128], // 贴金
  fen: [236, 232, 218], mo: [28, 26, 26], // 白粉、墨
  xiang: [214, 176, 104], // 香色
};
const P_ = PAL;

// ===================== 屋面琉璃瓦（周期 1.2m：4 垄筒瓦 × 4 节，板瓦压七露三） =====================
const TS = 512, TP = 1.2, TCOLS = 4, TROWS = 4;
let tileF = null;
function tileField() {
  if (tileF) return tileF;
  const S = TS, sp = TP / TCOLS, half = sp / 2, course = TP / TROWS, R = 0.08, MW = 0.013, BL = course / 3;
  const H = new Float32Array(S * S), K = new Uint8Array(S * S), ID = new Uint16Array(S * S), AO = new Float32Array(S * S), Q = new Float32Array(S * S), Z = new Float32Array(S * S);
  const r = rng(77);
  const jit = Array.from({ length: TCOLS }, () => (r() - 0.5) * 0.05);
  const jitB = Array.from({ length: TCOLS }, () => r() * BL);
  for (let y = 0; y < S; y++) {
    const vm = (1 - (y + 0.5) / S) * TP;
    for (let x = 0; x < S; x++) {
      const um = ((x + 0.5) / S) * TP, i = y * S + x;
      const col = Math.min(TCOLS - 1, Math.floor(um / sp));
      const d = um - (col + 0.5) * sp, ad = Math.abs(d);
      if (ad < R) {
        // 筒瓦：半圆截面，每节下端（瓦口）压住下一节熊头
        const z = Math.sqrt(1 - (ad / R) ** 2), vv = vm - jit[col], q = fract(vv / course);
        H[i] = 0.026 + 0.066 * z - 0.012 * q + 0.004 * (1 - smooth(0, 0.08, q));
        K[i] = q > 0.972 ? 3 : 1;
        ID[i] = col * TROWS + mod(Math.floor(vv / course), TROWS);
        AO[i] = (0.68 + 0.32 * z) * (q > 0.93 ? 0.62 + 0.38 * (1 - q) / 0.07 : 1);
        Q[i] = q; Z[i] = z;
      } else {
        // 板瓦：凹弧，每 BL 一道搭接前沿；夹垄灰收边
        const en = (half - ad) / (half - R), ch = d > 0 ? (col + 1) % TCOLS : col;
        const vv = vm + 0.014 * en * en + jitB[ch], q = fract(vv / BL);
        const hb = 0.003 + 0.02 * en * en + 0.008 * (1 - q);
        ID[i] = 64 + ch * 16 + mod(Math.floor(vv / BL), 12);
        Q[i] = q;
        if (ad < R + MW) {
          const t = (ad - R) / MW;
          H[i] = mix(0.024, hb, t * t); K[i] = 2; AO[i] = 0.6 + 0.28 * t;
        } else {
          H[i] = hb; K[i] = 0;
          AO[i] = (1 - 0.34 * smooth(0.4, 1, en)) * (q > 0.9 ? 0.82 : 1) * (q < 0.05 ? 1.06 : 1);
        }
      }
    }
  }
  tileF = { H, K, ID, AO, Q, Z };
  return tileF;
}
let tileN = null;
const tileNormals = () => (tileN ||= normalsOf(tileField().H, TS, TS, TS / TP));

const TILE_PAL = {
  yellow: { base: [206, 130, 14], lo: [146, 74, 8], hi: [222, 152, 30], mortar: [120, 56, 40], dust: [112, 92, 66], fade: [190, 150, 96], seed: 3 },
  green: { base: [24, 100, 58], lo: [10, 58, 32], hi: [48, 128, 76], mortar: [104, 100, 92], dust: [96, 96, 82], fade: [150, 170, 140], seed: 5 },
  blue: { base: [30, 64, 142], lo: [14, 32, 86], hi: [70, 110, 184], mortar: [104, 102, 100], dust: [92, 94, 94], fade: [140, 156, 186], seed: 7 },
  black: { base: [40, 40, 44], lo: [16, 16, 20], hi: [74, 74, 82], mortar: [96, 94, 90], dust: [86, 84, 78], fade: [110, 108, 104], seed: 9 },
  purple: { base: [98, 44, 82], lo: [54, 22, 46], hi: [140, 80, 120], mortar: [104, 96, 96], dust: [96, 88, 84], fade: [160, 130, 150], seed: 11 },
  grey: { base: [104, 106, 106], lo: [70, 72, 74], hi: [128, 130, 130], mortar: [164, 160, 152], dust: [108, 104, 96], fade: [140, 140, 136], seed: 13 },
};
function tileColor(p) {
  return () => {
    const f = tileField(), S = TS;
    const n1 = noiseField(S, S, { cx: 3, oct: 3, seed: p.seed }), n2 = noiseField(S, S, { cx: 12, oct: 3, seed: p.seed + 9 });
    return pixels(S, S, (x, y, o, i) => {
      const k = f.K[i], id = f.ID[i];
      let c;
      if (k === 2) c = mul3(p.mortar, 0.9 + 0.2 * n2[i]);
      else {
        const hs = hash(id, 2, 11) - 0.5;
        c = mul3(mix3(p.base, hs > 0 ? p.hi : p.lo, Math.abs(hs) * 0.3), 0.95 + 0.1 * hash(id, 1, 11));
        const fd = hash(id, 3, 11);
        if (fd < 0.025) c = mix3(c, p.fade, 0.3);
        else if (fd > 0.975) c = mix3(c, p.lo, 0.3);
        if (k !== 0) { c = mix3(c, p.lo, 0.32 * (1 - smooth(0, 0.09, f.Q[i])) + 0.12 * (1 - f.Z[i])); c = mix3(c, p.hi, 0.18 * smooth(0.8, 1, f.Z[i]) * n2[i]); c = mix3(c, p.dust, 0.22 * smooth(0.55, 0.9, n1[i]) * (1 - f.Z[i])); }
        else c = mix3(c, p.dust, 0.14 + 0.3 * n2[i] * n1[i]);
      }
      const s = f.AO[i] * (0.93 + 0.14 * n1[i]);
      o[0] = c[0] * s; o[1] = c[1] * s; o[2] = c[2] * s;
    });
  };
}
for (const [k, p] of Object.entries(TILE_PAL)) registerTexture('tile_' + k, tileColor(p), { aniso: 16 });
registerTexture('tile_normal', () => normalCanvas(tileNormals(), TS, TS), { aniso: 16 });
registerTexture('tile_rough', () => {
  const f = tileField(), n = noiseField(TS, TS, { cx: 12, oct: 3, seed: 21 }), R = new Float32Array(TS * TS);
  for (let i = 0; i < R.length; i++) {
    const k = f.K[i];
    R[i] = k === 2 ? 0.92 : k === 3 ? 0.8 : k === 1 ? 0.3 + 0.1 * n[i] : 0.42 + 0.26 * n[i];
    if (k !== 2 && hash(f.ID[i], 3, 11) < 0.025) R[i] = 0.55;
  }
  return roughMips(R, TS, TS, tileNormals(), 1.2);
}, { aniso: 16 });

// ===================== 檐口椽头带 / 椽望 =====================
// eaveband：u 周期内 4 根椽；上排飞椽头（方，绿地金万字），下排檐椽头（圆，青地龙眼宝珠），连檐朱红
function wanzi(P, cx, cy, a, b, lw, st) {
  // 卍：上臂折左、左臂折下、下臂折右、右臂折上
  P.line([[cx - a, cy - b], [cx, cy - b], [cx, cy + b], [cx + a, cy + b]], lw, st);
  P.line([[cx + a, cy - b], [cx + a, cy], [cx - a, cy], [cx - a, cy + b]], lw, st);
}
registerSet('eaveband', () => {
  const W = 512, H = 256, P = new Painter(W, H, { wrapX: true, c: [58, 18, 14], h: 0.05, r: 0.9 });
  const gold = { c: P_.gold, h: 0.9, r: 0.3 };
  P.rect(0, 0, W, 24, { c: P_.red, h: 0.62, r: 0.62 }); // 大连檐
  P.rect(0, 24, W, 2, { c: [70, 16, 12], h: 0.55 });
  P.rect(0, 128, W, 14, { c: P_.red, h: 0.5, r: 0.62 }); // 小连檐 + 闸挡板
  P.rect(0, 141, W, 2, { c: [60, 14, 10], h: 0.45 });
  P.rect(0, 250, W, 6, { c: [36, 14, 12], h: 0 });
  for (let i = 0; i < 4; i++) {
    const cx = (i + 0.5) * 128;
    // 飞椽头
    const x0 = cx - 31, y0 = 26, w = 62, h = 100;
    P.rect(x0 + 4, y0 + 3, w, h, { c: [28, 8, 6], a: 0.8 });
    P.rect(x0, y0, w, h, { ...gold, c: P_.goldD });
    P.rect(x0 + 2, y0 + 2, w - 4, h - 4, gold);
    P.rect(x0 + 6, y0 + 6, w - 12, h - 12, { c: (g) => { const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, css([40, 128, 86])); gr.addColorStop(1, css([22, 92, 60])); return gr; }, h: 0.72, r: 0.62 });
    wanzi(P, cx, y0 + h / 2, 15, 30, 6.5, { c: P_.goldD, h: 0.85 });
    wanzi(P, cx, y0 + h / 2, 15, 30, 4.5, gold);
    // 檐椽头（圆，按 0.3m 带高校正为椭圆）
    const cy = 197, rx = 30, ry = 50;
    const el = (s) => (g) => g.ellipse(cx, cy, rx * s, ry * s, 0, 0, TAU);
    P.draw((g) => g.ellipse(cx + 4, cy + 4, rx, ry, 0, 0, TAU), { c: [26, 8, 6], a: 0.8 });
    P.draw(el(1), { c: P_.goldD, h: 0.86, r: 0.3 });
    P.draw(el(0.94), gold);
    P.draw(el(0.84), { c: (g) => { const gr = g.createRadialGradient(cx, cy, rx * 0.4, cx, cy, rx * 0.86); gr.addColorStop(0, css([20, 48, 112])); gr.addColorStop(0.55, css([40, 92, 168])); gr.addColorStop(1, css([108, 156, 212])); return gr; }, h: 0.72, r: 0.6 });
    P.draw(el(0.54), { c: [190, 206, 222], h: 0.78, r: 0.55 });
    P.draw(el(0.44), { c: [18, 36, 92], h: 0.8, r: 0.55 });
    P.draw((g) => g.ellipse(cx - 4, cy - 8, rx * 0.12, ry * 0.12, 0, 0, TAU), { c: [230, 236, 240], h: 0.85 });
  }
  return finish(P, { k: 3, cav: 1.2, cavR: 3 });
}, { aniso: 8 });

// soffit：u 周期内 4 根椽（与 eaveband 对齐），椽子沿 v；红帮绿底，望板朱红
registerSet('soffit', () => {
  const W = 256, H = 128, n = noiseField(W, H, { cx: 8, cy: 2, oct: 3, seed: 31 }), F = new Float32Array(W * H);
  const color = pixels(W, H, (x, y, o, i) => {
    const u = fract((x + 0.5) / 64) - 0.5, a = Math.abs(u) / 0.25;
    let c;
    if (a < 1) {
      const z = Math.sqrt(1 - a * a);
      F[i] = 0.35 + 0.65 * z;
      c = a > 0.84 ? [136, 36, 26] : mix3([26, 96, 66], [56, 142, 100], z);
    } else { F[i] = 0; c = [148, 38, 28]; }
    const s = 0.9 + 0.2 * n[i];
    o[0] = c[0] * s; o[1] = c[1] * s; o[2] = c[2] * s;
  });
  const N = normalsOf(blur(F, W, H, 1), W, H, 12);
  const R = new Float32Array(W * H).fill(0.8);
  return { color, normal: normalCanvas(N, W, H), rough: roughMips(R, W, H, N, 0.5) };
});

// ===================== 山花 / 博风 =====================
function coin(P, x, y, R, red) {
  const g = { c: P_.gold, h: 0.85, r: 0.3 }, gd = { c: P_.goldD, h: 0.8 };
  P.circle(x, y, R + 2, gd); P.circle(x, y, R, g);
  P.circle(x, y, R * 0.84, { c: red, h: 0.5, r: 0.75 });
  P.circle(x, y, R * 0.8, { lw: 2, c: P_.goldD, h: 0.7 });
  P.rect(x - R * 0.24, y - R * 0.24, R * 0.48, R * 0.48, g);
  P.rect(x - R * 0.15, y - R * 0.15, R * 0.3, R * 0.3, { c: mul3(red, 0.7), h: 0.4 });
  for (let k = 0; k < 4; k++) { const a = (k * TAU) / 4; P.rect(x + Math.cos(a) * R * 0.55 - R * 0.07, y + Math.sin(a) * R * 0.55 - R * 0.09, R * 0.14, R * 0.18, g); }
}
function ribbon(P, pts, w) {
  P.line(pts, w + 4, { c: P_.goldD, h: 0.75 });
  P.line(pts, w, { c: P_.gold, h: 0.85, r: 0.3 });
  P.line(pts, w * 0.22, { c: P_.goldL, h: 0.9 });
}
const bez = (p0, p1, p2, p3, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
});
function gableSet(gold) {
  return () => {
    const S = 512, red = [138, 30, 22], P = new Painter(S, S, { wrapX: true, wrapY: true, c: red, h: 0.3, r: 0.78 });
    for (let i = 0; i < 10; i++) {
      const x = i * 51.2, t = 0.94 + 0.12 * hash(i, 0, 5);
      P.rect(x, 0, 51.2, S, { c: mul3(red, t) });
      P.rect(x - 1, 0, 2, S, { c: [92, 20, 14], h: 0.15, r: 0.9 });
    }
    if (gold) {
      // 金钱绶带：结在上，带尾向两侧飘出并与相邻周期相接
      ribbon(P, bez([256, 214], [180, 150], [120, 250], [0, 300]), 13);
      ribbon(P, bez([256, 214], [332, 150], [392, 250], [512, 300]), 13);
      ribbon(P, bez([250, 220], [200, 300], [170, 380], [196, 452]), 11);
      ribbon(P, bez([262, 220], [312, 300], [342, 380], [316, 452]), 11);
      for (const s of [-1, 1]) {
        P.draw((g) => g.ellipse(256 + s * 30, 196, 32, 16, s * -0.5, 0, TAU), { lw: 11, c: P_.goldD, h: 0.75 });
        P.draw((g) => g.ellipse(256 + s * 30, 196, 32, 16, s * -0.5, 0, TAU), { lw: 7, c: P_.gold, h: 0.85, r: 0.3 });
        P.poly([[256 + s * 52, 452], [256 + s * 68, 486], [256 + s * 54, 474], [256 + s * 44, 492]], { c: P_.gold, h: 0.85, r: 0.3 });
      }
      P.circle(256, 216, 13, { c: P_.gold, h: 0.9, r: 0.3 });
      coin(P, 256, 318, 64, red);
      coin(P, 0, 40, 30, red);
      coin(P, 256, 40, 18, red);
    }
    return finish(P, { k: 2.5, cav: 0.8, cavR: 3 });
  };
}
registerSet('gable_red', gableSet(true));
registerSet('gable_plain', gableSet(false));

registerSet('bofeng', () => {
  const W = 512, H = 128, red = [150, 34, 24], P = new Painter(W, H, { wrapX: true, c: red, h: 0.4, r: 0.6 });
  const n = noiseField(W, H, { cx: 3, cy: 12, oct: 3, seed: 51 });
  P.rect(0, 0, W, 7, { c: [96, 22, 14], h: 0.25 }); P.rect(0, H - 7, W, 7, { c: [96, 22, 14], h: 0.25 });
  P.rect(0, 0, W, 2, { c: [40, 10, 8], h: 0.1 }); P.rect(0, H - 2, W, 2, { c: [40, 10, 8], h: 0.1 });
  // 梅花钉：中心 1 + 周围 5
  const nail = (x, y) => {
    P.ellipse(x + 2, y + 2, 8, 6.5, { c: [50, 12, 8], a: 0.6 });
    P.ellipse(x, y, 8, 6.5, { c: (g) => { const gr = g.createRadialGradient(x - 3, y - 3, 1, x, y, 9); gr.addColorStop(0, css(P_.goldL)); gr.addColorStop(0.5, css(P_.gold)); gr.addColorStop(1, css(P_.goldD)); return gr; }, h: (0.95), r: 0.25 });
  };
  for (const gx of [128, 384]) {
    nail(gx, 64);
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * TAU) / 5; nail(gx + Math.cos(a) * 24, 64 + Math.sin(a) * 19); }
  }
  const out = finish(P, { k: 3, cav: 0.6, cavR: 2 });
  const g = out.color.getContext('2d'), img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < W * H; i++) { const s = 0.93 + 0.14 * n[i]; d[i * 4] *= s; d[i * 4 + 1] *= s; d[i * 4 + 2] *= s; }
  g.putImageData(img, 0, 0);
  return out;
});

// ===================== 彩画母题：龙、宝珠、祥云、旋花 =====================
/**
 * 龙：头在 (x,y)，朝向角 ang，身长 len（像素）。o.spine(t)→[lx,ly]（以 len 为单位，头 t=0，身体向 -x 延伸）
 * o.flip 上下翻转；o.w 身宽比；o.legs
 */
export function drawDragon(P, x, y, len, ang = 0, o = {}) {
  const { flip = false, w = 0.1, amp = 0.1, waves = 1.3, phase = 0.6, spine = null, legs = true, gold = P_.gold, dark = P_.goldD, light = P_.goldL, h = 0.88 } = o;
  const ca = Math.cos(ang), sa = Math.sin(ang), fy = flip ? -1 : 1;
  const T = (p) => [x + (p[0] * ca - p[1] * fy * sa) * len, y + (p[0] * sa + p[1] * fy * ca) * len];
  const N = 40, S = [], Wd = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    S.push(spine ? spine(t) : [-t, amp * Math.sin(t * TAU * waves + phase) * (0.35 + 0.65 * t)]);
    Wd.push(w * (t < 0.1 ? 0.72 + 2.8 * t : Math.max(0.1, 1 - 0.9 * ((t - 0.1) / 0.9) ** 1.4)));
  }
  const Nm = S.map((p, k) => { const a = S[Math.max(0, k - 1)], b = S[Math.min(N, k + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  const off = (k, s) => [S[k][0] + Nm[k][0] * Wd[k] * s, S[k][1] + Nm[k][1] * Wd[k] * s];
  const add = (p, d, s) => [p[0] + d[0] * s, p[1] + d[1] * s];
  const G = { c: gold, h, r: 0.28 }, D = { c: dark, h: h - 0.08 }, Lt = { c: light, h: h + 0.04, r: 0.25 };
  const px = (v) => v * len;
  // 背鳍
  for (let k = 4; k < N - 4; k += 2) P.poly([T(off(k, 0.42)), T(off(k + 3, 1.05)), T(off(k + 2, 0.42))], G);
  // 四足
  if (legs) for (const [t, s] of [[0.15, -1], [0.24, 1], [0.56, -1], [0.66, 1]]) {
    const k = Math.round(t * N), n = Nm[k], hd = [-n[1], n[0]], wd = Wd[k];
    const hip = add(S[k], n, s * wd * 0.2), knee = add(add(hip, n, s * wd * 1.25), hd, wd * 0.55), foot = add(add(knee, hd, wd * 0.85), n, s * wd * 0.15);
    P.poly([T(add(knee, hd, -wd * 0.3)), T(add(add(knee, hd, -wd * 0.9), n, s * wd * 0.35)), T(add(knee, n, s * wd * 0.2))], Lt); // 肘毛
    P.line([T(hip), T(knee)], px(wd * 0.62), D); P.line([T(hip), T(knee)], px(wd * 0.5), G);
    P.line([T(knee), T(foot)], px(wd * 0.4), D); P.line([T(knee), T(foot)], px(wd * 0.3), G);
    for (const a of [-0.7, 0, 0.7]) {
      const dir = [hd[0] * Math.cos(a) - n[0] * s * Math.sin(a), hd[1] * Math.cos(a) - n[1] * s * Math.sin(a)];
      P.line([T(foot), T(add(foot, dir, wd * 0.38))], px(wd * 0.12), G);
    }
  }
  // 身
  const left = [], right = [];
  for (let k = 0; k <= N; k++) { left.push(T(off(k, 0.5))); right.push(T(off(k, -0.5))); }
  P.poly([...left, ...right.slice().reverse()], G);
  P.line(left, Math.max(1.2, px(0.008)), D); P.line(right, Math.max(1.2, px(0.008)), D);
  // 腹甲与鳞
  const belly = []; for (let k = 2; k <= N - 2; k++) belly.push(T(off(k, -0.28)));
  P.line(belly, px(w * 0.2), { c: light, h: h + 0.02 });
  for (let k = 3; k < N - 2; k++) P.line([T(off(k, -0.4)), T(off(k, -0.14))], Math.max(0.8, px(0.004)), { c: dark, a: 0.7 });
  for (let k = 3; k < N - 3; k++) for (const s of [0.05, 0.3]) {
    const c = T(off(k, s + (k % 2) * 0.08));
    P.draw((g) => g.arc(c[0], c[1], Math.max(1, px(Wd[k] * 0.16)), 0, TAU), { lw: Math.max(0.7, px(0.004)), c: dark, a: 0.65 });
  }
  // 尾鳍
  const tl = S[N], tn = Nm[N], td = [tn[1], -tn[0]];
  for (const a of [-0.6, 0, 0.6]) P.poly([T(off(N - 3, 0.6)), T(add(tl, [td[0] * Math.cos(a) - tn[0] * Math.sin(a), td[1] * Math.cos(a) - tn[1] * Math.sin(a)], w * 0.9)), T(off(N - 3, -0.6))], G);
  // 头
  const h0 = S[0], hd = [-Nm[0][1], Nm[0][0]], up = Nm[0], hs = w * 1.2;
  const Hp = (a, b) => T([h0[0] + hd[0] * a * hs + up[0] * b * hs, h0[1] + hd[1] * a * hs + up[1] * b * hs]);
  for (let i = 0; i < 6; i++) P.poly([Hp(-0.1, 0.5 - i * 0.2), Hp(-1.5 - 0.15 * i, 1.1 - i * 0.42), Hp(-0.4, 0.3 - i * 0.2)], G); // 鬣
  P.line([Hp(0.1, 0.45), Hp(-0.55, 1.05), Hp(-1.15, 1.25)], px(hs * 0.16), D);
  P.line([Hp(0.1, 0.45), Hp(-0.55, 1.05), Hp(-1.15, 1.25)], px(hs * 0.11), G); // 角
  P.line([Hp(0.35, 0.5), Hp(-0.15, 1.15), Hp(-0.6, 1.45)], px(hs * 0.1), G);
  const skull = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; skull.push(Hp(0.2 + Math.cos(a) * 0.75, 0.08 + Math.sin(a) * 0.55)); }
  P.poly(skull, G); P.poly(skull, { lw: Math.max(1, px(0.006)), c: dark });
  P.poly([Hp(0.45, 0.48), Hp(1.5, 0.3), Hp(1.68, 0.06), Hp(1.45, -0.06), Hp(0.5, -0.06)], G); // 上颚
  P.poly([Hp(0.4, -0.16), Hp(1.35, -0.42), Hp(1.32, -0.62), Hp(0.25, -0.48)], G); // 下颚
  P.line([Hp(0.6, -0.2), Hp(1.2, -0.28), Hp(1.5, -0.12)], px(hs * 0.08), { c: [200, 58, 36] }); // 舌
  P.circle(...Hp(1.5, 0.24), px(hs * 0.18), Lt);
  P.circle(...Hp(0.55, 0.3), px(hs * 0.17), { c: light, h: h + 0.06 });
  P.circle(...Hp(0.58, 0.3), px(hs * 0.08), { c: [30, 20, 10] });
  P.line([Hp(1.5, 0.18), Hp(2.0, 0.7), Hp(2.6, 0.9), Hp(3.0, 0.65)], Math.max(1, px(hs * 0.06)), G); // 须
  P.line([Hp(1.3, -0.35), Hp(1.9, -0.95), Hp(2.5, -1.05)], Math.max(1, px(hs * 0.06)), G);
  for (let i = 0; i < 3; i++) P.poly([Hp(0.3 + i * 0.25, -0.5), Hp(0.1 + i * 0.25, -1.0 - i * 0.1), Hp(0.5 + i * 0.25, -0.55)], G); // 胡
}

/** 火焰宝珠 */
export function drawPearl(P, x, y, r) {
  const fl = (R0, R1, n, tw) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU + (i % 2 ? tw : 0); const rr = i % 2 ? R1 : R0; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return pts; };
  P.poly(fl(r * 1.1, r * 2.0, 12, 0.12), { c: [196, 60, 30], h: 0.75, r: 0.6 });
  P.poly(fl(r * 1.1, r * 2.0, 12, 0.12), { lw: 2, c: P_.gold, h: 0.85 });
  P.poly(fl(r * 1.0, r * 1.5, 12, 0.2), { c: [236, 140, 44], h: 0.8, r: 0.5 });
  P.circle(x, y, r, { c: (g) => { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r); gr.addColorStop(0, css(P_.goldL)); gr.addColorStop(1, css(P_.goldD)); return gr; }, h: 1, r: 0.25 });
  P.draw((g) => g.arc(x, y, r * 0.55, 0, Math.PI * 1.5), { lw: 2, c: P_.goldD });
}

/** 如意祥云（填色 + 卷纹） */
export function drawCloud(P, x, y, s, st = { c: P_.gold, h: 0.85, r: 0.3 }, dark = P_.goldD) {
  const lobes = [[0, -0.22, 0.3], [-0.38, 0.04, 0.24], [0.38, 0.04, 0.24], [0, 0.12, 0.22]];
  for (const [a, b, r] of lobes) P.circle(x + a * s, y + b * s, r * s, st);
  P.line(bez([x + 0.3 * s, y + 0.25 * s], [x + 0.7 * s, y + 0.4 * s], [x + 1.0 * s, y + 0.2 * s], [x + 1.15 * s, y + 0.3 * s], 10), s * 0.12, st);
  for (const [a, b, r] of lobes.slice(0, 3)) P.draw((g) => g.arc(x + a * s, y + b * s, r * s * 0.55, 0.3, 0.3 + Math.PI * 1.5), { lw: Math.max(1, s * 0.05), c: dark });
}

/** 旋花：旋眼（点金）+ 头路瓣 + 二路旋瓣 */
function whorl(P, cx, cy, R, base = P_.qing, inner = P_.lv) {
  const W = { c: P_.fen, h: 0.62 }, M = { c: P_.mo, h: 0.5 };
  P.circle(cx, cy, R, { c: base, h: 0.42 });
  P.draw((g) => g.arc(cx, cy, R - 3, 0, TAU), { lw: 5, ...W });
  P.draw((g) => g.arc(cx, cy, R - 7.5, 0, TAU), { lw: 1.5, ...M });
  // 二路旋瓣
  const n2 = 14;
  for (let k = 0; k < n2; k++) {
    const pts = [];
    for (let i = 0; i <= 10; i++) { const r = mix(0.5, 0.92, i / 10) * R, a = (k / n2) * TAU + 0.55 * (i / 10) ** 1.3; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    P.line(pts, 3, W);
    const mid = []; for (let i = 0; i <= 8; i++) { const r = mix(0.56, 0.86, i / 8) * R, a = ((k + 0.5) / n2) * TAU + 0.5 * (i / 8) ** 1.3; mid.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    P.line(mid, R * 0.07, { c: P_.qing2, h: 0.45 });
  }
  P.circle(cx, cy, R * 0.5, { c: P_.fen, h: 0.6 });
  P.circle(cx, cy, R * 0.47, { c: inner, h: 0.48 });
  // 头路瓣
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, x = cx + Math.cos(a) * R * 0.34, y = cy + Math.sin(a) * R * 0.34;
    P.ellipse(x, y, R * 0.13, R * 0.085, { c: P_.lv2, h: 0.55 }, a);
    P.draw((g) => g.ellipse(x, y, R * 0.13, R * 0.085, a, 0, TAU), { lw: 2, ...W });
  }
  P.circle(cx, cy, R * 0.2, { c: P_.fen, h: 0.6 });
  P.circle(cx, cy, R * 0.17, { c: base, h: 0.5 });
  P.circle(cx, cy, R * 0.11, { c: P_.gold, h: 0.92, r: 0.28 }); // 旋眼点金
}

// ===================== 梁枋彩画（u 0..1 一间，v 0..1 枋底→顶；两端为箍头） =====================
const BW = 2048, BH = 256;
function goldLine(P, pts, lw = 6) {
  P.line(pts, lw + 3, { c: P_.goldD, h: 0.78, r: 0.32 });
  P.line(pts, lw, { c: P_.gold, h: 0.96, r: 0.26 });
}
function gutou(P, x0, x1, col, col2) {
  P.rect(x0, 0, x1 - x0, BH, { c: col, h: 0.35 });
  P.rect(x0 + 10, 0, 9, BH, { c: col2 }); P.rect(x1 - 19, 0, 9, BH, { c: col2 });
  goldLine(P, [[x0 + 4, -4], [x0 + 4, BH + 4]]); goldLine(P, [[x1 - 4, -4], [x1 - 4, BH + 4]]);
}
function beamEdges(P) {
  P.rect(0, 0, BW, 3, { c: [20, 16, 14], h: 0.2 });
  P.rect(0, BH - 3, BW, 3, { c: [20, 16, 14], h: 0.2 });
}

// 金龙和玺：箍头（青）| 盒子（坐龙）| 箍头 | Σ 皮条线 | 藻头（绿地升龙）|《》枋心（青地行龙，二龙戏珠）
registerSet('beam_hexi', () => {
  const P = new Painter(BW, BH, { c: P_.lv, h: 0.32, r: 0.72 });
  for (const m of [false, true]) {
    P.mx = m;
    gutou(P, 0, 60, P_.qing, P_.qing2);
    // 盒子
    P.rect(60, 0, 240, BH, { c: P_.qing, h: 0.32 });
    P.circle(180, 128, 108, { c: P_.lv2, h: 0.32 });
    P.circle(180, 128, 100, { c: P_.lv, h: 0.32 });
    goldLine(P, [[60, 0], [60, BH]], 5); goldLine(P, [[300, 0], [300, BH]], 5);
    P.draw((g) => g.arc(180, 128, 104, 0, TAU), { lw: 6, c: P_.gold, h: 0.96, r: 0.26 });
    for (const [cx, cy, s] of [[84, 26, 28], [276, 26, -28], [84, 230, 28], [276, 230, -28]]) drawCloud(P, cx + s * 0.3, cy, Math.abs(s));
    drawDragon(P, 210, 66, 150, 0.1, { w: 0.13, legs: true, spine: (t) => { const a = -Math.PI * 0.55 - t * Math.PI * 1.55, r = 0.36 - 0.12 * t; return [Math.cos(a) * r - 0.2, Math.sin(a) * r + 0.42]; } });
    gutou(P, 300, 360, P_.qing, P_.qing2);
    // Σ 皮条线
    const zig = [[372, -4], [436, 64], [392, 128], [436, 192], [372, BH + 4]];
    P.poly([[360, -4], ...zig, [360, BH + 4]], { c: P_.qing, h: 0.35 });
    P.poly([[372, -4], [436, 64], [392, 128], [436, 192], [372, BH + 4], [386, BH + 4], [450, 192], [406, 128], [450, 64], [386, -4]], { c: P_.lv2, h: 0.35 });
    goldLine(P, zig); goldLine(P, zig.map(([x, y]) => [x + 14, y]));
    // 藻头：升龙
    drawCloud(P, 640, 210, 30); drawCloud(P, 480, 44, 24); drawCloud(P, 650, 60, 20);
    drawDragon(P, 600, 62, 210, -0.85, { w: 0.12, amp: 0.1, waves: 1.1 });
    // 《 枋心头
    P.poly([[700, 128], [760, 28], [1030, 28], [1030, 228], [760, 228]], { c: P_.qing2, h: 0.32 });
    P.poly([[722, 128], [774, 42], [1030, 42], [1030, 214], [774, 214]], { c: P_.qing, h: 0.32 });
    goldLine(P, [[760, 28], [700, 128], [760, 228]]); goldLine(P, [[774, 42], [722, 128], [774, 214]]);
    goldLine(P, [[760, 28], [1040, 28]], 5); goldLine(P, [[760, 228], [1040, 228]], 5);
    goldLine(P, [[774, 42], [1040, 42]], 3); goldLine(P, [[774, 214], [1040, 214]], 3);
    // 枋心：行龙
    drawCloud(P, 820, 84, 22); drawCloud(P, 900, 186, 20); drawCloud(P, 990, 70, 16);
    drawDragon(P, 960, 112, 220, 0.05, { w: 0.13, amp: 0.13, waves: 1.25 });
  }
  P.mx = false;
  drawPearl(P, 1024, 128, 20);
  beamEdges(P);
  return finish(P, { k: 2.2, cav: 0.9, cavR: 3, toks: 0.6 });
});

// 旋子（金线大点金）：箍头 | 皮条线 | 藻头一整二破旋花 | 岔口 | 枋心（龙）
registerSet('beam_xuanzi', () => {
  const P = new Painter(BW, BH, { c: P_.lv, h: 0.32, r: 0.75 });
  for (const m of [false, true]) {
    P.mx = m;
    gutou(P, 0, 64, P_.qing, P_.qing2);
    P.poly([[64, -4], [118, 128], [64, BH + 4]], { c: P_.qing, h: 0.35 });
    goldLine(P, [[64, -4], [118, 128], [64, BH + 4]]); goldLine(P, [[80, -4], [134, 128], [80, BH + 4]]);
    // 一整二破
    whorl(P, 262, 128, 118, P_.qing, P_.lv);
    whorl(P, 486, 0, 118, P_.qing, P_.lv);
    whorl(P, 486, BH, 118, P_.qing, P_.lv);
    // 菱角地点金
    for (const y of [40, 216]) { P.poly([[360, y], [384, y - 16], [384, y + 16]], { c: P_.gold, h: 0.9, r: 0.28 }); }
    P.poly([[136, 6], [170, 6], [150, 30]], { c: P_.gold, h: 0.9, r: 0.28 }); P.poly([[136, 250], [170, 250], [150, 226]], { c: P_.gold, h: 0.9, r: 0.28 });
    // 岔口 + 枋心头
    P.poly([[596, 128], [676, 30], [1030, 30], [1030, 226], [676, 226]], { c: P_.lv2, h: 0.32 });
    P.poly([[618, 128], [688, 44], [1030, 44], [1030, 212], [688, 212]], { c: P_.qing, h: 0.32 });
    goldLine(P, [[676, 30], [596, 128], [676, 226]], 5); goldLine(P, [[688, 44], [618, 128], [688, 212]], 4);
    goldLine(P, [[676, 30], [1040, 30]], 4); goldLine(P, [[676, 226], [1040, 226]], 4);
    drawCloud(P, 760, 80, 18); drawCloud(P, 840, 184, 18);
    drawDragon(P, 950, 118, 230, 0.04, { w: 0.12, amp: 0.13, waves: 1.2 });
  }
  P.mx = false;
  drawPearl(P, 1024, 128, 18);
  beamEdges(P);
  return finish(P, { k: 2.2, cav: 0.9, cavR: 3 });
});

// 苏式：箍头（回纹 + 联珠）| 找头（卡子）| 包袱（烟云 + 托子，内绘山水）
function meander(P, x, w, st) {
  const u = w / 3;
  for (let y = 0; y < BH + u * 3; y += u * 3) {
    P.line([[x, y], [x + w, y], [x + w, y + u * 2], [x + u, y + u * 2], [x + u, y + u], [x + u * 2, y + u], [x + u * 2, y + u * 1.6]], 3, st);
  }
}
function kazi(P, cx, cy, s, col, line) {
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const pts = bez([cx, cy], [cx + sx * s * 0.6, cy + sy * s * 0.1], [cx + sx * s * 0.9, cy + sy * s * 0.7], [cx + sx * s * 0.45, cy + sy * s * 0.75], 16);
    P.line(pts, 12, { c: line, h: 0.5 }); P.line(pts, 7, { c: col, h: 0.55 });
    const e = pts[pts.length - 1];
    P.circle(e[0], e[1] - sy * 6, 8, { c: col, h: 0.55 });
  }
  P.ellipse(cx, cy, s * 0.16, s * 0.3, { c: col, h: 0.55 });
  P.ellipse(cx, cy, s * 0.07, s * 0.16, { c: P_.zhu, h: 0.6 });
}
registerSet('beam_sushi', () => {
  const P = new Painter(BW, BH, { c: P_.lv, h: 0.32, r: 0.78 });
  for (const m of [false, true]) {
    P.mx = m;
    P.rect(0, 0, 96, BH, { c: P_.qing, h: 0.35 });
    for (let y = 6; y < BH; y += 13) { P.circle(14, y, 4.5, { c: P_.fen, h: 0.6 }); P.circle(82, y, 4.5, { c: P_.fen, h: 0.6 }); }
    meander(P, 30, 36, { c: P_.gold, h: 0.85, r: 0.3 });
    goldLine(P, [[3, 0], [3, BH]], 4); goldLine(P, [[93, 0], [93, BH]], 4);
    P.rect(96, 0, 18, BH, { c: P_.zhu, h: 0.35 });
    P.rect(114, 0, 6, BH, { c: P_.fen, h: 0.4 });
    // 找头
    P.rect(120, 0, 420, BH, { c: P_.lv, h: 0.32 });
    kazi(P, 220, 128, 110, P_.qing2, P_.fen);
    kazi(P, 430, 128, 80, [210, 120, 70], P_.fen);
  }
  P.mx = false;
  // 包袱：下垂半椭圆；托子（暖色）→ 烟云（墨→青→白）
  const cx = 1024, rx = 470, ry = 236;
  const path = (g) => { g.moveTo(cx + rx, -4); g.ellipse(cx, -4, rx, ry, 0, 0, Math.PI); g.closePath(); };
  const bands = [[126, [110, 34, 24]], [114, [176, 70, 44]], [102, [214, 128, 80]], [90, [240, 196, 150]], [78, [30, 30, 40]], [66, [24, 56, 120]], [54, [64, 112, 176]], [42, [140, 180, 218]], [30, [228, 236, 240]]];
  for (const [lw, c] of bands) P.draw(path, { lw, c, h: 0.4 });
  P.draw(path, { c: [236, 226, 200], h: 0.3, r: 0.8 });
  P.clip(path);
  P.rect(cx - rx, 0, rx * 2, 150, { c: (g) => { const gr = g.createLinearGradient(0, 0, 0, 150); gr.addColorStop(0, css([214, 222, 214])); gr.addColorStop(1, css([240, 232, 206])); return gr; } });
  const ridge = (y0, a, f, ph, col) => { const pts = [[cx - rx, 260]]; for (let x = cx - rx; x <= cx + rx; x += 8) pts.push([x, y0 - a * (0.6 * Math.sin(x * f + ph) + 0.4 * Math.sin(x * f * 2.7 + ph * 2))]); pts.push([cx + rx, 260]); P.poly(pts, { c: col }); };
  ridge(96, 34, 0.012, 1, [160, 186, 184]);
  ridge(128, 30, 0.017, 3, [104, 146, 128]);
  P.rect(cx - rx, 160, rx * 2, 100, { c: [206, 216, 206] });
  for (let i = 0; i < 6; i++) P.line([[cx - 300 + i * 90, 176 + (i % 3) * 12], [cx - 250 + i * 90, 176 + (i % 3) * 12]], 1.5, { c: [120, 150, 150] });
  ridge(196, 16, 0.02, 5, [84, 118, 80]);
  for (const [tx, ty, s] of [[cx - 220, 168, 1], [cx - 180, 176, 0.8], [cx + 160, 160, 1.1], [cx + 210, 172, 0.8]]) {
    P.line([[tx, ty + 30 * s], [tx + 2, ty]], 3, { c: [70, 50, 34] });
    for (let k = 0; k < 6; k++) P.circle(tx + (hash(k, tx, 1) - 0.5) * 30 * s, ty - 6 - hash(k, tx, 2) * 24 * s, 9 * s, { c: [40 + k * 6, 84 + k * 4, 52] });
  }
  P.rect(cx + 30, 140, 4, 22, { c: P_.zhu }); P.rect(cx + 64, 140, 4, 22, { c: P_.zhu });
  P.poly([[cx + 16, 142], [cx + 49, 118], [cx + 82, 142]], { c: [50, 60, 70] });
  P.unclip();
  P.draw(path, { lw: 2.5, c: [40, 36, 40], h: 0.45 });
  beamEdges(P);
  return finish(P, { k: 1.6, cav: 0.5, cavR: 3 });
});

// ===================== 门窗：菱花隔心、裙板、板门 =====================
const RED = [140, 32, 22], RED_L = [164, 48, 32], DARK = [24, 16, 13];
function frame(P, bw, st) {
  const { W, H } = P;
  P.rect(0, 0, W, bw, st); P.rect(0, H - bw, W, bw, st); P.rect(0, 0, bw, H, st); P.rect(W - bw, 0, bw, H, st);
  P.draw((g) => g.rect(bw, bw, W - bw * 2, H - bw * 2), { lw: 2, c: [60, 14, 10], h: 0.4 });
}
function flower(P, x, y, r, n, a0, petal = RED_L) {
  P.circle(x, y, r, { c: RED, h: 0.68, r: 0.55 });
  for (let k = 0; k < n; k++) {
    const a = a0 + (k * TAU) / n, px = x + Math.cos(a) * r * 0.52, py = y + Math.sin(a) * r * 0.52;
    P.ellipse(px, py, r * 0.46, r * 0.26, { c: petal, h: 0.86, r: 0.5 }, a);
    P.draw((g) => g.ellipse(px, py, r * 0.46, r * 0.26, a, 0, TAU), { lw: 1.4, c: [70, 16, 10], h: 0.6 });
  }
  P.circle(x, y, r * 0.2, { c: P_.goldD, h: 0.9 });
  P.circle(x, y, r * 0.16, { c: (g) => { const gr = g.createRadialGradient(x - r * 0.05, y - r * 0.05, 0.5, x, y, r * 0.17); gr.addColorStop(0, css(P_.goldL)); gr.addColorStop(1, css(P_.gold)); return gr; }, h: 1, r: 0.25 });
}
// 三交六椀：竖棂 + ±30° 斜棂，交点为六瓣菱花，中心金菱花钉
function sanjiao(W, H, s) {
  const P = new Painter(W, H, { c: DARK, h: 0, r: 0.9 });
  const dx = (s * Math.sqrt(3)) / 2, nodes = [];
  const J = Math.ceil(W / 2 / dx) + 1, I = Math.ceil(H / s) + 1;
  for (let j = -J; j <= J; j++) for (let i = -I; i <= I; i++) nodes.push([W / 2 + j * dx, H / 2 + i * s + (j & 1 ? s / 2 : 0)]);
  const bar = { c: RED, h: 0.55, r: 0.55 }, bw = s * 0.15;
  for (const [x, y] of nodes) {
    P.line([[x, y], [x, y + s]], bw, bar); P.line([[x, y], [x + dx, y + s / 2]], bw, bar); P.line([[x, y], [x + dx, y - s / 2]], bw, bar);
  }
  for (const [x, y] of nodes) flower(P, x, y, s * 0.36, 6, Math.PI / 6);
  frame(P, 12, { c: RED, h: 0.8, r: 0.5 });
  return finish(P, { k: 3, cav: 1.4, cavR: 4, toks: 0.6 });
}
// 双交四椀：±45° 斜棂，四瓣菱花
function shuangjiao(W, H, s) {
  const P = new Painter(W, H, { c: DARK, h: 0, r: 0.9 }), d = s / Math.SQRT2, nodes = [];
  for (let j = -Math.ceil(W / d); j <= Math.ceil(W / d); j++) for (let i = -Math.ceil(H / d); i <= Math.ceil(H / d); i++) if (((i + j) & 1) === 0) nodes.push([W / 2 + j * d, H / 2 + i * d]);
  const bar = { c: RED, h: 0.55, r: 0.55 };
  for (const [x, y] of nodes) { P.line([[x, y], [x + d, y + d]], s * 0.15, bar); P.line([[x, y], [x + d, y - d]], s * 0.15, bar); }
  for (const [x, y] of nodes) flower(P, x, y, s * 0.36, 4, Math.PI / 4);
  frame(P, 12, { c: RED, h: 0.8, r: 0.5 });
  return finish(P, { k: 3, cav: 1.4, cavR: 4 });
}
// 方格：直棂方格（次要房屋）
function fangge(W, H, s) {
  const P = new Painter(W, H, { c: DARK, h: 0, r: 0.9 }), bar = { c: [128, 40, 28], h: 0.6, r: 0.6 };
  for (let x = W / 2 - Math.ceil(W / 2 / s) * s; x <= W; x += s) P.rect(x - s * 0.07, 0, s * 0.14, H, bar);
  for (let y = H / 2 - Math.ceil(H / 2 / s) * s; y <= H; y += s) P.rect(0, y - s * 0.07, W, s * 0.14, bar);
  frame(P, 12, { c: [128, 40, 28], h: 0.8, r: 0.5 });
  return finish(P, { k: 3, cav: 1.2, cavR: 3 });
}
// 灯笼框：外框格 + 内框 + 卡子（园林、住所）
function denglong(W, H, cols) {
  const P = new Painter(W, H, { c: [214, 206, 186], h: 0, r: 0.9 }), bar = { c: [120, 36, 26], h: 0.6, r: 0.6 };
  const cw = W / cols, rows = Math.max(1, Math.round(H / cw)), ch = H / rows, lw = Math.max(5, cw * 0.06);
  for (let i = 0; i <= cols; i++) P.rect(i * cw - lw / 2, 0, lw, H, bar);
  for (let j = 0; j <= rows; j++) P.rect(0, j * ch - lw / 2, W, lw, bar);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * cw, y = j * ch, ix = cw * 0.24, iy = ch * 0.24;
    P.draw((g) => g.rect(x + ix, y + iy, cw - ix * 2, ch - iy * 2), { lw, ...bar });
    for (const [a, b, c, d] of [[x + cw / 2, y, x + cw / 2, y + iy], [x + cw / 2, y + ch - iy, x + cw / 2, y + ch], [x, y + ch / 2, x + ix, y + ch / 2], [x + cw - ix, y + ch / 2, x + cw, y + ch / 2]]) P.line([[a, b], [c, d]], lw, { ...bar, cap: 'butt' });
  }
  frame(P, 12, { c: [120, 36, 26], h: 0.8, r: 0.5 });
  return finish(P, { k: 3, cav: 1.2, cavR: 3 });
}
registerSet('lattice_door', () => sanjiao(512, 1024, 70));
registerSet('lattice_window', () => sanjiao(512, 640, 70));
registerSet('lattice_shuangjiao', () => shuangjiao(512, 1024, 76));
registerSet('lattice_fangge', () => fangge(512, 1024, 64));
registerSet('lattice_denglong', () => denglong(512, 1024, 3));

// 裙板：起线边框 + 金线 + 中心如意云头与卷草 + 四角岔角
function ruyi(P, x, y, s, rot, st, dark) {
  const c = Math.cos(rot), sn = Math.sin(rot), T = (a, b) => [x + (a * c - b * sn) * s, y + (a * sn + b * c) * s];
  const lob = [[0, -0.2, 0.3], [-0.36, 0.06, 0.25], [0.36, 0.06, 0.25]];
  P.poly([T(-0.5, 0.12), T(0, 0.62), T(0.5, 0.12)], st);
  for (const [a, b, r] of lob) P.circle(...T(a, b), r * s, st);
  for (const [a, b, r] of lob) { const p = T(a, b); P.draw((g) => g.arc(p[0], p[1], r * s * 0.55, rot + 0.4, rot + 0.4 + Math.PI * 1.5), { lw: Math.max(1.5, s * 0.06), c: dark, h: 0.7 }); }
  P.circle(...T(0, 0.3), s * 0.08, { c: dark, h: 0.75 });
}
registerSet('door_panel', () => {
  const S = 512, P = new Painter(S, S, { c: [146, 34, 24], h: 0.55, r: 0.55 });
  const gold = { c: P_.gold, h: 0.92, r: 0.28 }, gd = P_.goldD;
  P.rect(30, 30, S - 60, S - 60, { c: [124, 26, 18], h: 0.42 });
  P.rect(36, 36, S - 72, S - 72, { c: [140, 30, 22], h: 0.32 });
  P.draw((g) => g.rect(56, 56, S - 112, S - 112), { lw: 8, c: gd, h: 0.8 });
  P.draw((g) => g.rect(56, 56, S - 112, S - 112), { lw: 5, ...gold });
  for (const [x, y, r] of [[92, 92, -Math.PI * 0.75], [S - 92, 92, -Math.PI * 0.25], [92, S - 92, Math.PI * 0.75], [S - 92, S - 92, Math.PI * 0.25]]) ruyi(P, x, y, 46, r + Math.PI / 2, gold, gd);
  for (const sx of [-1, 1]) {
    const tail = bez([256 + sx * 60, 262], [256 + sx * 150, 200], [256 + sx * 170, 330], [256 + sx * 120, 330], 20);
    P.line(tail, 15, { c: gd, h: 0.8 }); P.line(tail, 10, gold);
    P.draw((g) => g.arc(256 + sx * 128, 314, 16, 0, Math.PI * 1.6), { lw: 8, ...gold });
    const tail2 = bez([256 + sx * 40, 300], [256 + sx * 90, 380], [256 + sx * 160, 360], [256 + sx * 180, 300], 20);
    P.line(tail2, 12, { c: gd, h: 0.8 }); P.line(tail2, 8, gold);
  }
  ruyi(P, 256, 236, 120, 0, gold, gd);
  return finish(P, { k: 3, cav: 1.2, cavR: 4 });
});

// 板门：朱红门扇 + 九路门钉 + 铺首（u=1 侧为门缝内侧，右扇请镜像 u）
function gateDoor(cols) {
  return () => {
    const W = 512, H = 1024, P = new Painter(W, H, { c: [132, 26, 18], h: 0.4, r: 0.5 });
    for (let i = 1; i < 6; i++) P.rect(i * 85.3 - 1, 0, 2, H, { c: [96, 18, 12], a: 0.5, h: 0.32 });
    P.rect(0, 0, W, 8, { c: [100, 20, 14], h: 0.3 }); P.rect(0, H - 8, W, 8, { c: [100, 20, 14], h: 0.3 });
    P.rect(0, 0, 6, H, { c: [100, 20, 14], h: 0.3 }); P.rect(W - 6, 0, 6, H, { c: [100, 20, 14], h: 0.3 });
    const px = 410, py = 560, ry = 645;
    const nailR = cols > 8 ? 19 : 21;
    for (let j = 0; j < 9; j++) for (let i = 0; i < cols; i++) {
      const x = 52 + (i * 408) / (cols - 1), y = 70 + (j * 884) / 8;
      if (Math.hypot(x - px, y - py) < 64 || Math.hypot(x - px, y - ry) < 58) continue;
      P.circle(x + 4, y + 6, nailR, { c: [50, 10, 6], a: 0.55 });
      P.circle(x, y, nailR, { c: (g) => { const gr = g.createRadialGradient(x - nailR * 0.35, y - nailR * 0.4, 1, x, y, nailR); gr.addColorStop(0, css([255, 236, 170])); gr.addColorStop(0.35, css(P_.gold)); gr.addColorStop(1, css([120, 78, 22])); return gr; }, r: 0.25 });
    }
    // 门钉高度（球冠）
    for (let j = 0; j < 9; j++) for (let i = 0; i < cols; i++) {
      const x = 52 + (i * 408) / (cols - 1), y = 70 + (j * 884) / 8;
      if (Math.hypot(x - px, y - py) < 64 || Math.hypot(x - px, y - ry) < 58) continue;
      const g = P.G.h, gr = g.createRadialGradient(x, y, 0, x, y, nailR);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.6, '#d8d8d8'); gr.addColorStop(1, '#707070');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, nailR, 0, TAU); g.fill();
    }
    // 铺首：兽面衔环
    const gold = { c: P_.gold, h: 0.9, r: 0.28 }, gd = { c: P_.goldD, h: 0.82, r: 0.3 };
    P.circle(px + 4, py + 6, 52, { c: [50, 10, 6], a: 0.5 });
    const ros = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; ros.push([px + Math.cos(a) * (48 + 4 * Math.cos(a * 16)), py + Math.sin(a) * (48 + 4 * Math.cos(a * 16))]); }
    P.poly(ros, gd); P.circle(px, py, 44, gold);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; P.line([[px + Math.cos(a) * 30, py + Math.sin(a) * 30], [px + Math.cos(a) * 42, py + Math.sin(a) * 42]], 2, { c: P_.goldD, h: 0.8 }); }
    P.circle(px, py, 28, { c: P_.goldL, h: 0.96, r: 0.25 });
    for (const s of [-1, 1]) {
      P.ellipse(px + s * 11, py - 8, 7, 5, { c: P_.goldD, h: 0.85 });
      P.circle(px + s * 11, py - 8, 3, { c: [40, 24, 8], h: 0.8 });
      P.draw((g) => g.arc(px + s * 11, py - 12, 10, Math.PI * 1.1, Math.PI * 1.9), { lw: 3, c: P_.goldD, h: 0.9 });
    }
    P.ellipse(px, py + 6, 6, 8, { c: P_.gold, h: 1, r: 0.25 });
    P.draw((g) => g.arc(px, py + 14, 12, 0.2, Math.PI - 0.2), { lw: 3, c: P_.goldD, h: 0.85 });
    P.circle(px, py + 30, 7, gd);
    P.circle(px + 3, ry + 5, 38, { lw: 10, c: [50, 10, 6], a: 0.5 });
    P.draw((g) => g.arc(px, ry, 35, 0, TAU), { lw: 11, c: P_.goldD, h: 0.75 });
    P.draw((g) => g.arc(px, ry, 35, 0, TAU), { lw: 7, c: P_.gold, h: 0.95, r: 0.25 });
    P.draw((g) => g.arc(px, ry, 35, Math.PI * 1.1, Math.PI * 1.5), { lw: 2.5, c: P_.goldL, h: 1 });
    const out = finish(P, { k: 3.5, cav: 0.8, cavR: 4, toks: 0.8 });
    grime(out.color, { amp: 0.06, cx: 2, oct: 4, seed: 61 });
    return out;
  };
}
registerSet('gate_door', gateDoor(9));
registerSet('gate_door_8', gateDoor(8)); // 东华门：横九纵八

// ===================== 砖石墙面 =====================
// 宫墙红灰：铁红抹灰，色差斑驳、雨痕、返碱
registerSet('wall_red', () => {
  const S = 512;
  const n1 = noiseField(S, S, { cx: 3, oct: 4, seed: 41 }), n2 = noiseField(S, S, { cx: 5, oct: 4, seed: 42 });
  const st = noiseField(S, S, { cx: 20, cy: 2, oct: 3, seed: 43 }), n3 = noiseField(S, S, { cx: 24, oct: 3, seed: 44 });
  const fresh = [156, 48, 37], dull = [142, 43, 33], streak = [118, 50, 42], salt = [170, 118, 100];
  const color = pixels(S, S, (x, y, o, i) => {
    let c = mix3(dull, fresh, n1[i]);
    c = mix3(c, streak, 0.28 * smooth(0.55, 0.9, st[i]) * (0.5 + 0.5 * n2[i]));
    c = mix3(c, salt, 0.16 * smooth(0.74, 0.92, n2[i] * 0.7 + n3[i] * 0.3));
    const f = 0.95 + 0.1 * n3[i];
    o[0] = c[0] * f; o[1] = c[1] * f; o[2] = c[2] * f;
  });
  const F = new Float32Array(S * S);
  for (let i = 0; i < F.length; i++) F[i] = n3[i] * 0.6 + n2[i] * 0.4;
  const N = normalsOf(F, S, S, 3);
  return { color, normal: normalCanvas(N, S, S), rough: roughMips(new Float32Array(S * S).fill(0.9), S, S, N, 0.4) };
}, { aniso: 16 });

/**
 * 砌砖：P 周期米 [pu,pv]；course 皮高；L 顺砖长；Hd 丁砖长；mode 'dingshun'(一顺一丁) | 'sanshun'(三顺一丁) | 'running'(走砖错缝) | 'grid'(方砖十字缝)
 */
function masonry({ S = 512, P = [2.4, 2.4], course = 0.1, L = 0.4, Hd = 0.2, joint = 0.01, mode = 'dingshun', brick, mortar, vary = 0.08, seed = 1, weather = 0, edge = 0.012, tones = 0, wear = 0.08, Sy = S }) {
  const H = Sy, n1 = noiseField(S, H, { cx: 4, oct: 4, seed }), n2 = noiseField(S, H, { cx: 32, oct: 2, seed: seed + 3 });
  // 竖向雨痕：横向高频、竖向极低频
  const nw = weather ? noiseField(S, H, { cx: 48, cy: 1, oct: 2, seed: seed + 5 }) : null, nv = weather ? noiseField(S, H, { cx: 3, cy: 2, oct: 3, seed: seed + 6 }) : null;
  const TONE = [[1.0, 1.0, 1.0], [1.04, 1.01, 0.96], [0.97, 0.99, 1.02], [0.91, 0.91, 0.9], [1.05, 1.04, 1.02]];
  const n3 = noiseField(S, H, { cx: Math.round(P[0] * 16), cy: Math.round(P[1] * 16), oct: 2, seed: seed + 7 });
  const F = new Float32Array(S * H), nC = Math.round(P[1] / course);
  const color = pixels(S, H, (x, y, o, i) => {
    const um = ((x + 0.5) / S) * P[0], vm = (1 - (y + 0.5) / H) * P[1];
    const j = Math.floor(vm / course), ly = vm - j * course;
    let unit, off, k, lx, len;
    if (mode === 'grid') { unit = L; off = 0; }
    else if (mode === 'running') { unit = L; off = (mod(j, 2) * L) / 2; }
    else if (mode === 'sanshun') { if (mod(j, 4) === 3) { unit = Hd; off = (mod(Math.floor(j / 4), 2) * Hd) / 2; } else { unit = L; off = (mod(j, 2) * L) / 2; } }
    else { unit = L + Hd; off = (mod(j, 2) * unit) / 2; }
    const p = um + off, kk = Math.floor(p / unit), pp = p - kk * unit, nk = Math.round(P[0] / unit);
    if (mode === 'dingshun' && pp >= L) { k = mod(kk, nk) * 2 + 1; lx = pp - L; len = Hd; } else { k = mod(kk, nk) * 2; lx = pp; len = mode === 'dingshun' ? L : unit; }
    const jid = mod(j, nC);
    const dEdge = Math.min(lx, len - lx, ly, course - ly) - joint / 2;
    const r1 = hash(k, jid, seed), r2 = hash(k, jid, seed + 1);
    let c, h;
    if (dEdge < 0) { c = mul3(mortar, 0.92 + 0.16 * n2[i]); h = 0.1; }
    else {
      c = mul3(mix3(brick, r2 > 0.5 ? [brick[0] * 1.06, brick[1] * 1.02, brick[2] * 0.94] : [brick[0] * 0.95, brick[1] * 0.98, brick[2] * 1.05], Math.abs(r2 - 0.5)), 1 - vary + 2 * vary * r1);
      if (tones) { const t = TONE[Math.floor(hash(k, jid, seed + 2) * 5)]; c = [c[0] * t[0], c[1] * t[1], c[2] * t[2]]; }
      const e = smooth(0, edge, dEdge);
      c = mul3(c, 0.86 + 0.14 * e);
      h = 0.55 + 0.4 * e + 0.05 * n2[i];
    }
    let f = (0.92 + 0.16 * n1[i] * (0.6 + 0.4 * n2[i])) * (1 - wear / 2 + wear * n3[i]);
    if (nw) { c = mix3(c, mul3(brick, 0.66), 0.4 * smooth(0.6, 0.95, nw[i]) * nv[i]); c = mix3(c, [176, 172, 162], 0.25 * smooth(0.82, 0.96, n1[i] * 0.7 + n2[i] * 0.3)); }
    F[i] = h;
    o[0] = c[0] * f; o[1] = c[1] * f; o[2] = c[2] * f;
  });
  const N = normalsOf(blur(F, S, H, 1), S, H, 2.2);
  return { color, normal: normalCanvas(N, S, H), rough: roughMips(new Float32Array(S * H).fill(0.9), S, H, N, 0.4) };
}
registerSet('brick_grey', () => masonry({ P: [2.4, 2.4], course: 0.1, L: 0.4, Hd: 0.2, joint: 0.008, mode: 'dingshun', brick: [106, 107, 104], mortar: [146, 144, 136], vary: 0.07, seed: 71 }), { aniso: 16 });
registerSet('brick_dark', () => masonry({ P: [2.0, 2.08], course: 0.13, L: 0.5, Hd: 0.25, joint: 0.012, mode: 'sanshun', brick: [88, 88, 86], mortar: [128, 126, 118], vary: 0.1, seed: 73, weather: 1 }), { aniso: 16 });

// 汉白玉：暖白，极淡云纹与灰脉
function marbleColor(S, seed, joints = null) {
  const n1 = noiseField(S, S, { cx: 3, oct: 5, seed }), n2 = noiseField(S, S, { cx: 2, oct: 5, seed: seed + 1 }), n3 = noiseField(S, S, { cx: 16, oct: 3, seed: seed + 2 });
  const F = new Float32Array(S * S);
  const color = pixels(S, S, (x, y, o, i) => {
    const u = x / S, v = y / S;
    const vein = Math.abs(Math.sin(TAU * (2 * u + v + 2.2 * n2[i])));
    let c = mix3([186, 182, 170], [204, 200, 190], n1[i]);
    c = mix3(c, [140, 140, 136], 0.5 * (1 - smooth(0, 0.08, vein)) * (0.4 + 0.6 * n1[i]));
    c = mix3(c, [180, 172, 156], 0.3 * smooth(0.6, 0.95, n3[i] * 0.5 + n2[i] * 0.5));
    let h = 0.6 + 0.08 * n3[i];
    if (joints) { const j = joints(u, v); if (j < 1) { c = mix3(c, [150, 146, 136], 0.6 * (1 - j)); h -= 0.3 * (1 - j); } }
    F[i] = h;
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
  });
  return { color, F };
}
registerSet('marble', () => {
  const S = 512, { color, F } = marbleColor(S, 81), N = normalsOf(F, S, S, 2);
  return { color, normal: normalCanvas(N, S, S), rough: roughMips(new Float32Array(S * S).fill(0.55), S, S, N, 0.5) };
}, { aniso: 16 });
registerSet('marble_block', () => {
  // 条石（1.0×0.5m 错缝，周期 2m）
  const S = 512, jw = 0.004;
  const joints = (u, v) => {
    const vm = v * 2, row = Math.floor(vm / 0.5), um = u * 2 + (row % 2) * 0.5;
    const d = Math.min(Math.abs(vm - Math.round(vm / 0.5) * 0.5), Math.abs(um - Math.round(um / 1.0) * 1.0));
    return smooth(jw * 0.5, jw * 2, d);
  };
  const { color, F } = marbleColor(S, 83, joints), N = normalsOf(blur(F, S, S, 1), S, S, 3);
  return { color, normal: normalCanvas(N, S, S), rough: roughMips(new Float32Array(S * S).fill(0.6), S, S, N, 0.5) };
}, { aniso: 16 });

// 须弥座雕饰带：仰莲（上）| 束腰椀花结带 + 玛瑙柱 | 覆莲（下）；u 周期 1.5m
function lotusRow(P, y0, y1, n, up) {
  const W = P.W, pw = W / n;
  for (let i = 0; i < n; i++) {
    const cx = (i + 0.5) * pw, base = up ? y1 : y0, tip = up ? y0 + 4 : y1 - 4, dir = up ? -1 : 1, hgt = Math.abs(y1 - y0) - 4;
    const petal = (s) => (g) => { g.moveTo(cx - pw * 0.47 * s, base); g.bezierCurveTo(cx - pw * 0.5 * s, base + dir * hgt * 0.7 * s, cx - pw * 0.12 * s, tip - dir * hgt * (1 - s) * 0.4, cx, tip - dir * hgt * (1 - s) * 0.35); g.bezierCurveTo(cx + pw * 0.12 * s, tip - dir * hgt * (1 - s) * 0.4, cx + pw * 0.5 * s, base + dir * hgt * 0.7 * s, cx + pw * 0.47 * s, base); g.closePath(); };
    P.draw(petal(1), { h: 0.75, c: [230, 226, 214] });
    P.draw(petal(1), { lw: 2, h: 0.45, c: [168, 164, 154] });
    P.draw(petal(0.7), { h: 0.9, c: [236, 233, 224] });
    P.draw(petal(0.7), { lw: 1.5, h: 0.6, c: [180, 176, 166] });
    P.line([[cx, base + dir * 4], [cx, tip - dir * hgt * 0.3]], 2, { h: 1, c: [242, 240, 232] });
  }
}
function waist(P, y0, y1) {
  const W = P.W, mid = (y0 + y1) / 2, hh = y1 - y0;
  P.rect(0, y0, W, hh, { c: [214, 210, 198], h: 0.35 });
  for (const x of [0, W / 2]) {
    // 玛瑙柱
    P.draw((g) => { g.moveTo(x - 10, y0); g.quadraticCurveTo(x - 16, mid, x - 10, y1); g.lineTo(x + 10, y1); g.quadraticCurveTo(x + 16, mid, x + 10, y0); g.closePath(); }, { c: [232, 228, 218], h: 0.75 });
    P.line([[x, y0 + 4], [x, y1 - 4]], 2, { c: [190, 186, 176], h: 0.55 });
  }
  for (const cx of [W / 4, (3 * W) / 4]) {
    // 椀花结带
    for (const sx of [-1, 1]) {
      const rb = bez([cx, mid], [cx + sx * 30, mid - hh * 0.55], [cx + sx * 70, mid + hh * 0.45], [cx + sx * 100, mid - hh * 0.05], 20);
      P.line(rb, 9, { c: [180, 176, 166], h: 0.6 }); P.line(rb, 6, { c: [236, 232, 222], h: 0.82 });
      P.draw((g) => g.ellipse(cx + sx * 20, mid - hh * 0.12, 16, 9, sx * 0.5, 0, TAU), { lw: 6, c: [236, 232, 222], h: 0.82 });
    }
    P.circle(cx, mid, hh * 0.24, { c: [236, 233, 224], h: 0.85 });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; P.circle(cx + Math.cos(a) * hh * 0.16, mid + Math.sin(a) * hh * 0.16, hh * 0.08, { c: [240, 238, 230], h: 0.95 }); }
    P.circle(cx, mid, hh * 0.08, { c: [226, 222, 210], h: 1 });
  }
}
function marbleFinish(P, seed) {
  const out = finish(P, { k: 4, cav: 2.2, cavR: 4, toks: 0.5 });
  const S = P.W, H = P.H, n = noiseField(S, H, { cx: 4, cy: 2, oct: 4, seed });
  const tint = [0.9, 0.89, 0.87];
  const g = out.color.getContext('2d'), img = g.getImageData(0, 0, S, H), d = img.data;
  for (let i = 0; i < S * H; i++) { const s = 0.94 + 0.08 * n[i]; d[i * 4] *= s * tint[0]; d[i * 4 + 1] *= s * tint[1]; d[i * 4 + 2] *= s * tint[2]; }
  g.putImageData(img, 0, 0);
  return out;
}
registerSet('marble_band', () => {
  const P = new Painter(512, 256, { wrapX: true, c: [222, 218, 206], h: 0.5, r: 0.6 });
  lotusRow(P, 0, 74, 10, true);
  P.rect(0, 74, 512, 12, { c: [232, 228, 218], h: 0.6 });
  waist(P, 86, 170);
  P.rect(0, 170, 512, 12, { c: [232, 228, 218], h: 0.6 });
  lotusRow(P, 182, 256, 10, false);
  return marbleFinish(P, 91);
}, { aniso: 8 });
registerSet('marble_waist', () => { const P = new Painter(512, 128, { wrapX: true, c: [222, 218, 206], h: 0.5, r: 0.6 }); waist(P, 6, 122); P.rect(0, 0, 512, 6, { c: [232, 228, 218], h: 0.6 }); P.rect(0, 122, 512, 6, { c: [232, 228, 218], h: 0.6 }); return marbleFinish(P, 93); });
registerSet('marble_lotus', () => { const P = new Painter(512, 128, { wrapX: true, c: [214, 210, 198], h: 0.4, r: 0.6 }); lotusRow(P, 0, 128, 10, true); return marbleFinish(P, 95); });

// ===================== 地面 =====================
// 院落海墁：条砖错缝（0.5×0.25m），周期 4m
// 周期 8m（降低远处重复感），砖面磨损、低频污渍
registerSet('paving', () => masonry({ S: 1024, P: [8, 8], course: 0.25, L: 0.5, joint: 0.01, mode: 'running', brick: [134, 128, 118], mortar: [104, 99, 90], vary: 0.05, seed: 101, edge: 0.02, tones: 1, wear: 0.12 }), { aniso: 16 });
registerSet('paving_square', () => masonry({ S: 512, P: [4, 4], course: 0.5, L: 0.5, joint: 0.008, mode: 'grid', brick: [124, 122, 116], mortar: [96, 94, 88], vary: 0.05, seed: 103, edge: 0.025, tones: 1 }), { aniso: 16 });
// 御路 / 甬路：大块石板（1.5×1.0m），花岗石细颗粒
registerSet('paving_imperial', () => {
  const S = 512, PU = 3, n1 = noiseField(S, S, { cx: 3, oct: 5, seed: 111 }), n2 = noiseField(S, S, { cx: 48, oct: 2, seed: 112 });
  const F = new Float32Array(S * S);
  const color = pixels(S, S, (x, y, o, i) => {
    const um = ((x + 0.5) / S) * PU, vm = (1 - (y + 0.5) / S) * PU, row = Math.floor(vm), off = (row % 2) * 0.75;
    const p = um + off, k = Math.floor(p / 1.5), lx = p - k * 1.5, ly = vm - row;
    const dE = Math.min(lx, 1.5 - lx, ly, 1 - ly), r = hash(mod(k, 2), mod(row, 3), 113);
    let c = mul3(mix3([164, 158, 146], [178, 172, 158], r), 0.92 + 0.14 * n1[i]);
    c = mul3(c, 0.93 + 0.1 * n2[i]);
    let h = 0.7 + 0.05 * n2[i];
    if (dE < 0.008) { c = [84, 80, 74]; h = 0.1; }
    else if (dE < 0.03) { c = mul3(c, 0.9 + 0.1 * (dE / 0.03)); h = 0.5 + 0.2 * (dE / 0.03); }
    F[i] = h;
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
  });
  const N = normalsOf(blur(F, S, S, 1), S, S, 2);
  return { color, normal: normalCanvas(N, S, S), rough: roughMips(new Float32Array(S * S).fill(0.75), S, S, N, 0.4) };
}, { aniso: 16 });
// 草地：低频斑块 + 中频草簇，周期 6m
registerSet('grass', () => {
  const S = 512, n1 = noiseField(S, S, { cx: 3, oct: 4, seed: 121 }), n2 = noiseField(S, S, { cx: 24, oct: 3, seed: 122 }), n3 = noiseField(S, S, { cx: 96, oct: 2, seed: 123 });
  const F = new Float32Array(S * S);
  const color = pixels(S, S, (x, y, o, i) => {
    let c = mix3([58, 82, 36], [92, 112, 50], n1[i]);
    c = mix3(c, [132, 126, 72], 0.4 * smooth(0.6, 0.9, n2[i] * 0.6 + n1[i] * 0.4));
    c = mul3(c, 0.82 + 0.3 * n3[i]);
    F[i] = n3[i] * 0.7 + n2[i] * 0.3;
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
  });
  const N = normalsOf(F, S, S, 3);
  return { color, normal: normalCanvas(N, S, S), rough: roughMips(new Float32Array(S * S).fill(1), S, S, null) };
}, { aniso: 16 });
// 太湖石：灰白石灰岩，孔洞、皴纹、苔斑
registerSet('rock', () => {
  const S = 512, C = 5, n1 = noiseField(S, S, { cx: 4, oct: 5, seed: 132 }), n2 = noiseField(S, S, { cx: 16, oct: 3, seed: 133 });
  const wx = noiseField(S, S, { cx: 3, oct: 4, seed: 135 }), wy = noiseField(S, S, { cx: 3, oct: 4, seed: 136 });
  const pts = [];
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) pts.push([i + hash(i, j, 131), j + hash(i, j, 138)]);
  const F = new Float32Array(S * S);
  const color = pixels(S, S, (x, y, o, i) => {
    // 扭曲 Worley：孔洞形状不规则，F2-F1 小处为溶蚀沟
    const fx = (x / S) * C + (wx[i] - 0.5) * 1.6, fy = (y / S) * C + (wy[i] - 0.5) * 1.6, ci = Math.floor(fx), cj = Math.floor(fy);
    let d1 = 9, d2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj, k = mod(jj, C) * C + mod(ii, C);
      const d = Math.hypot(fx - (pts[k][0] + ii - mod(ii, C)), fy - (pts[k][1] + jj - mod(jj, C)));
      if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
    }
    const rad = 0.14 + 0.26 * hash(id, 0, 134), deep = hash(id, 1, 134) < 0.6 ? 1 - smooth(rad * 0.45, rad, d1) : 0;
    const groove = 1 - smooth(0.02, 0.12, d2 - d1), band = 0.5 + 0.5 * Math.sin(TAU * (3 * y / S + 2 * n1[i]));
    let c = mix3([92, 95, 94], [146, 147, 142], 0.55 * n1[i] + 0.25 * n2[i] + 0.2 * band);
    c = mix3(c, [104, 110, 92], 0.2 * smooth(0.72, 0.95, n2[i]));
    c = mix3(c, [96, 96, 92], 0.22 * groove);
    c = mix3(c, [34, 34, 32], deep * 0.9);
    F[i] = 0.55 + 0.22 * n1[i] + 0.1 * n2[i] + 0.06 * band - 0.65 * deep - 0.08 * groove;
    o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
  });
  const N = normalsOf(blur(F, S, S, 2), S, S, 9);
  return { color, normal: normalCanvas(N, S, S), rough: roughMips(new Float32Array(S * S).fill(0.92), S, S, N, 0.4) };
});
// 青白石（阶条、地栿等）：细颗粒，极淡色差
registerSet('stone', () => {
  const S = 256, n1 = noiseField(S, S, { cx: 3, oct: 4, seed: 141 }), n2 = noiseField(S, S, { cx: 32, oct: 2, seed: 142 });
  const F = new Float32Array(S * S);
  const color = pixels(S, S, (x, y, o, i) => { const s = 0.92 + 0.1 * n1[i] + 0.05 * n2[i]; F[i] = n2[i]; o[0] = 172 * s; o[1] = 172 * s; o[2] = 164 * s; });
  const N = normalsOf(F, S, S, 1.2);
  return { color, normal: normalCanvas(N, S, S), rough: roughMips(new Float32Array(S * S).fill(0.8), S, S, N, 0.3) };
});
// 朱红油饰（柱、槛框）：极淡的地仗断纹与色差
registerTexture('lacquer_red', () => {
  const S = 256, n1 = noiseField(S, S, { cx: 2, cy: 6, oct: 4, seed: 151 }), n2 = noiseField(S, S, { cx: 24, oct: 2, seed: 152 });
  return pixels(S, S, (x, y, o, i) => { const s = 0.94 + 0.09 * n1[i] + 0.04 * n2[i]; o[0] = 255 * s * 0.98; o[1] = 255 * s * 0.96; o[2] = 255 * s * 0.96; });
});
