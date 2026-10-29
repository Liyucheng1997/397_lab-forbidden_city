// 台基、须弥座、踏跺（台阶）、御路、栏杆、螭首。
// 局部坐标约定同全局：y 向上；多边形 poly = [[x,z],...]（任意绕向）。
//
// 原型（实例化）key：
//   'pf_post:<head>:<m>'  望柱。head ∈ dragon|phoenix（龙凤柱头）| qi24（二十四气）| lotus（莲瓣）| plain（素方头）；m ∈ m 汉白玉 | s 青白石
//                         y=0 为地栿顶，按栏杆高 RH0=1.3m（望柱顶距地栿底）建模，调用方按 height/1.3 均匀缩放。
//   'pf_panel:<m>'        寻杖栏板：x∈[-0.5,0.5] 为一个净跨（调用方 x 按净跨米数缩放，y/z 按高度比缩放），y=0 为地栿顶。
//   'pf_baogu:<m>'        抱鼓石：x 自 0（望柱外皮）向外 0.9，y=0 为地栿顶。
//   'pf_chishou:<n|c>'    螭首：n 普通 / c 转角大螭首。原点在台帮外皮、台面高度，+Z 向外挑出约 0.9m（c 约 1.3m）。
// 自定义材质（本模块注册）：pf_lotus 枭莲瓣 | pf_shuyao 束腰椀花结带 | pf_yulu / pf_yulu_sea 御路 |
//   pf_head_dragon / pf_head_phoenix / pf_head_qi24 / pf_head_lotus 柱头 | pf_qingbai 青白石（阶条/角柱/土衬）| pf_doban 陡板石
import * as THREE from 'three';
import { boxGeo, cylGeo, offsetPoly, fromArrays, merge, polyTopGeo, gridSurface } from './geom.js';
import { registerProtoFamily, getProto } from './protos.js';
import { defineMaterial } from './materials.js';
import { registerTexture, canvas as mkCanvas, rng } from './textures.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const gray = (v) => { const c = Math.round(clamp(v, 0, 1) * 255); return `rgb(${c},${c},${c})`; };

// ===================== 程序化雕刻纹理 =====================
const lazy = (fn) => { let v; return () => v || (v = fn()); };

/** Canvas 绘制灰度高度图（水平/竖直均按平铺处理），返回 Float32Array */
function heightMap(W, H, draw, blur) {
  const c = mkCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g, W, H);
  const c2 = mkCanvas(W, H), g2 = c2.getContext('2d');
  g2.filter = `blur(${blur}px)`;
  for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) g2.drawImage(c, dx, dy);
  const d = g2.getImageData(0, 0, W, H).data;
  const hf = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) hf[i] = d[i * 4] / 255;
  return hf;
}
function boxBlur(src, W, H, r) {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[y * W + ((k + W) % W)];
    for (let x = 0; x < W; x++) { tmp[y * W + x] = s / n; s += src[y * W + ((x + r + 1) % W)] - src[y * W + ((x - r + W) % W)]; }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[((k + H) % H) * W + x];
    for (let y = 0; y < H; y++) { out[y * W + x] = s / n; s += tmp[((y + r + 1) % H) * W + x] - tmp[((y - r + H) % H) * W + x]; }
  }
  return out;
}
function normalCanvas(hf, W, H, k) {
  const c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
  const at = (x, y) => hf[((y + H) % H) * W + ((x + W) % W)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = -(at(x + 1, y) - at(x - 1, y)) * k, ny = (at(x, y + 1) - at(x, y - 1)) * k, l = Math.hypot(nx, ny, 1);
    const i = (y * W + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
/** 由高度图生成固有色：凹处略暗（模拟积尘与遮蔽），保持低频避免远看闪烁 */
function colorCanvas(hf, W, H, o) {
  const base = o.base || [228, 224, 213], dark = o.dark || [118, 114, 104];
  const bl = boxBlur(hf, W, H, o.aoR ?? 6);
  const c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
  const r = rng(o.seed || 7);
  for (let i = 0; i < W * H; i++) {
    const h = hf[i];
    const cav = clamp((bl[i] - h) * (o.ao ?? 2.2), 0, 1);
    const t = (1 - cav * 0.55 - (1 - h) * (o.lift ?? 0.16)) * (1 + (r() - 0.5) * (o.noise ?? 0.025));
    for (let k = 0; k < 3; k++) img.data[i * 4 + k] = clamp(dark[k] + (base[k] - dark[k]) * t, 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
/** 注册一组雕刻纹理（颜色 + 法线）与同名材质 */
function carved(name, W, H, draw, o = {}) {
  const pair = lazy(() => { const hf = heightMap(W, H, draw, o.blur ?? 1.2); return { c: colorCanvas(hf, W, H, o), n: normalCanvas(hf, W, H, o.strength ?? 4) }; });
  registerTexture(name, () => pair().c);
  registerTexture(name + '_normal', () => pair().n);
  defineMaterial(name, { color: 0xffffff, map: name, normalMap: name + '_normal', roughness: o.roughness ?? 0.6, normalScale: o.normalScale ?? 1 });
}

/** 莲瓣：底 by（canvas y），长 len，半宽 hw，亮度 lv */
function petal(g, cx, by, hw, len, lv, groove = 0) {
  g.beginPath();
  g.moveTo(cx - hw, by);
  g.bezierCurveTo(cx - hw * 1.12, by - len * 0.55, cx - hw * 0.6, by - len * 0.9, cx, by - len);
  g.bezierCurveTo(cx + hw * 0.6, by - len * 0.9, cx + hw * 1.12, by - len * 0.55, cx + hw, by);
  g.closePath();
  const gr = g.createRadialGradient(cx, by - len * 0.42, 0, cx, by - len * 0.42, hw * 1.25);
  gr.addColorStop(0, gray(lv)); gr.addColorStop(1, gray(lv * 0.7));
  g.fillStyle = gr; g.fill();
  if (groove) { g.lineWidth = groove; g.strokeStyle = gray(lv * 0.5); g.stroke(); }
}
/** 一排莲瓣（u 方向平铺），瓣尖朝 canvas 上方 */
function lotusRow(g, W, n, by, len, x0 = 0) {
  const pw = W / n;
  for (const dx of [-W, 0, W]) {
    for (let i = 0; i <= n; i++) petal(g, dx + x0 + i * pw, by, pw * 0.3, len * 0.66, 0.42);
    for (let i = 0; i < n; i++) {
      const cx = dx + x0 + (i + 0.5) * pw;
      petal(g, cx, by, pw * 0.47, len, 0.8);
      petal(g, cx, by, pw * 0.29, len * 0.62, 0.96, Math.max(1.5, pw * 0.03));
    }
  }
}
// 如意祥云
function cloud(g, x, y, s, lv = 0.55) {
  g.fillStyle = gray(lv);
  for (const [dx, dy, r] of [[0, 0, 22], [-25, 8, 15], [25, 8, 15], [-11, -15, 13], [14, -13, 12]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); }
  g.strokeStyle = gray(lv * 1.35); g.lineWidth = 8 * s;
  g.beginPath(); g.moveTo(x + 28 * s, y + 16 * s); g.quadraticCurveTo(x + 70 * s, y + 34 * s, x + 96 * s, y + 10 * s); g.stroke();
  g.strokeStyle = gray(lv * 0.5); g.lineWidth = 3 * s;
  for (const [dx, dy, r] of [[0, 0, 12], [-25, 8, 8], [25, 8, 8]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0.4, TAU * 0.82); g.stroke(); }
}
/** Catmull-Rom 采样 */
function spline(pts, per = 12) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function strokePts(g, pts, w, lv) {
  g.strokeStyle = gray(lv); g.lineWidth = w;
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) g.lineTo(p[0], p[1]);
  g.stroke();
}
/** 龙：身躯（带鳞）、四爪、龙首、鬃 */
function dragon(g, ctrl, w, headDir = 1) {
  const S = spline(ctrl, 14);
  // 身躯两侧沿与腿
  const legAt = [0.22, 0.38, 0.62, 0.8];
  for (const f of legAt) {
    const i = Math.floor(f * (S.length - 1)), p = S[i], q = S[Math.min(S.length - 1, i + 2)];
    const tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
    const sg = (legAt.indexOf(f) % 2 ? 1 : -1);
    const kx = p[0] + nx * sg * w * 1.3 + tx / l * w * 0.4, ky = p[1] + ny * sg * w * 1.3 + ty / l * w * 0.4;
    strokePts(g, [p, [p[0] + nx * sg * w * 0.8, p[1] + ny * sg * w * 0.8], [kx, ky]], w * 0.42, 0.66);
    for (let c = -1; c <= 1; c++) strokePts(g, [[kx, ky], [kx + (nx * sg + c * tx / l * 0.7) * w * 0.55, ky + (ny * sg + c * ty / l * 0.7) * w * 0.55]], w * 0.14, 0.8);
  }
  // 背鳍
  for (let i = 4; i < S.length - 4; i += 5) {
    const p = S[i], q = S[i + 1], tx = q[0] - p[0], ty = q[1] - p[1], l = Math.hypot(tx, ty) || 1;
    strokePts(g, [p, [p[0] - ty / l * w * 0.75 - tx / l * w * 0.2, p[1] + tx / l * w * 0.75 - ty / l * w * 0.2]], w * 0.18, 0.55);
  }
  strokePts(g, S, w * 1.05, 0.55);
  strokePts(g, S, w * 0.82, 0.78);
  // 鳞
  g.lineWidth = Math.max(1.5, w * 0.07); g.strokeStyle = gray(0.5);
  for (let i = 2; i < S.length - 2; i += 2) {
    const p = S[i], q = S[i + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    for (const o of [-0.22, 0.22]) { g.beginPath(); g.arc(p[0] - Math.sin(a) * o * w, p[1] + Math.cos(a) * o * w, w * 0.2, a + Math.PI * 0.5, a + Math.PI * 1.5); g.stroke(); }
  }
  // 龙首
  const h = S[0], h1 = S[3], a = Math.atan2(h[1] - h1[1], h[0] - h1[0]);
  const hx = h[0] + Math.cos(a) * w * 0.5, hy = h[1] + Math.sin(a) * w * 0.5;
  g.save(); g.translate(hx, hy); g.rotate(a);
  g.fillStyle = gray(0.72); g.beginPath(); g.ellipse(0, 0, w * 1.05, w * 0.7, 0, 0, TAU); g.fill();
  g.fillStyle = gray(0.85); g.beginPath(); g.ellipse(w * 0.9, -w * 0.15, w * 0.6, w * 0.35, 0, 0, TAU); g.fill();
  g.fillStyle = gray(0.62); g.beginPath(); g.ellipse(w * 0.75, w * 0.4, w * 0.55, w * 0.18, 0.2, 0, TAU); g.fill();
  g.fillStyle = gray(1); g.beginPath(); g.arc(w * 0.3, -w * 0.32, w * 0.16, 0, TAU); g.fill();
  strokePts(g, [[-w * 0.2, -w * 0.5], [-w * 0.9, -w * 1.1], [-w * 1.5, -w * 1.0]], w * 0.16, 0.85);
  strokePts(g, [[-w * 0.1, -w * 0.35], [-w * 0.7, -w * 1.25], [-w * 1.2, -w * 1.4]], w * 0.14, 0.8);
  for (let k = 0; k < 5; k++) strokePts(g, [[-w * 0.6, w * (k * 0.25 - 0.4)], [-w * 1.5, w * (k * 0.35 - 0.5)], [-w * 2, w * (k * 0.4 - 0.2)]], w * 0.12, 0.6);
  strokePts(g, [[w * 1.3, -w * 0.1], [w * 1.8, -w * 0.5], [w * 2.3, -w * 0.3]], w * 0.06, 0.7);
  g.restore();
  return [hx + Math.cos(a) * w * 2.6, hy + Math.sin(a) * w * 2.6];
}
function pearl(g, x, y, r) {
  for (let k = 0; k < 9; k++) { const a = (k / 9) * TAU; strokePts(g, [[x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(a + 0.5) * r * 1.9, y + Math.sin(a + 0.5) * r * 1.9]], r * 0.28, 0.6); }
  g.fillStyle = gray(0.92); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = gray(0.6); g.lineWidth = r * 0.12; g.beginPath(); g.arc(x, y, r * 0.6, 0.3, 4.5); g.stroke();
}

// 枭：莲瓣（4 瓣一周期；v=0 瓣根，v=1 瓣尖）
carved('pf_lotus', 512, 128, (g, W, H) => {
  g.fillStyle = gray(0.2); g.fillRect(0, 0, W, H);
  lotusRow(g, W, 4, H + 6, H * 0.94);
}, { strength: 3.2, blur: 1.4 });

// 束腰：两端玛瑙柱子，中间椀花结带（一周期宽 = 4 × 束腰高）
carved('pf_shuyao', 1024, 256, (g, W, H) => {
  g.fillStyle = gray(0.18); g.fillRect(0, 0, W, H);
  for (const cx of [0, W]) {
    g.fillStyle = gray(0.55); g.fillRect(cx - 38, 0, 76, H);
    g.fillStyle = gray(0.75);
    for (const [cy, ry] of [[H * 0.17, H * 0.12], [H * 0.5, H * 0.17], [H * 0.83, H * 0.12]]) { g.beginPath(); g.ellipse(cx, cy, 27, ry, 0, 0, TAU); g.fill(); }
    g.fillStyle = gray(0.92);
    for (const [cy, ry] of [[H * 0.17, H * 0.06], [H * 0.5, H * 0.09], [H * 0.83, H * 0.06]]) { g.beginPath(); g.ellipse(cx, cy, 14, ry, 0, 0, TAU); g.fill(); }
  }
  const cx = W / 2, cy = H / 2;
  const ribbon = (sg, dy, lw, lv) => {
    g.strokeStyle = gray(lv); g.lineWidth = lw;
    g.beginPath(); g.moveTo(cx + sg * 30, cy + dy);
    g.bezierCurveTo(cx + sg * 120, cy - 95 + dy, cx + sg * 200, cy + 92 + dy, cx + sg * 300, cy + 8 + dy);
    g.bezierCurveTo(cx + sg * 350, cy - 40 + dy, cx + sg * 405, cy - 26 + dy, cx + sg * 400, cy + 16 + dy);
    g.bezierCurveTo(cx + sg * 396, cy + 44 + dy, cx + sg * 360, cy + 40 + dy, cx + sg * 362, cy + 18 + dy);
    g.stroke();
  };
  for (const sg of [-1, 1]) { ribbon(sg, 0, 24, 0.55); ribbon(sg, 0, 10, 0.82); ribbon(sg, 28, 10, 0.5); }
  // 花结
  g.lineWidth = 12; g.strokeStyle = gray(0.7);
  for (const sg of [-1, 1]) { g.beginPath(); g.ellipse(cx + sg * 48, cy - 34, 30, 18, sg * 0.5, 0, TAU); g.stroke(); }
  // 椀花
  g.fillStyle = gray(0.68);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.beginPath(); g.ellipse(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34, 26, 15, a, 0, TAU); g.fill(); }
  g.fillStyle = gray(0.85); g.beginPath(); g.arc(cx, cy, 34, 0, TAU); g.fill();
  g.fillStyle = gray(1); g.beginPath(); g.arc(cx, cy, 17, 0, TAU); g.fill();
  g.strokeStyle = gray(0.6); g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 25, 0, TAU); g.stroke();
}, { strength: 3, blur: 1.5 });

// 御路：云龙（一周期 宽:高 = 1:2，竖向平铺），左右起边框
carved('pf_yulu', 512, 1024, (g, W, H) => {
  g.fillStyle = gray(0.2); g.fillRect(0, 0, W, H);
  const clouds = [[95, 70, 1], [410, 250, 1.1], [110, 500, 0.9], [420, 640, 1], [80, 830, 1.05], [380, 980, 0.85], [260, 360, 0.7], [250, 760, 0.6]];
  for (const [x, y, s] of clouds) for (const dy of [-H, 0, H]) cloud(g, x, y + dy, s);
  const tip = dragon(g, [[300, 300], [190, 380], [150, 520], [300, 610], [380, 720], [260, 840], [140, 900], [90, 980]], 34);
  pearl(g, clamp(tip[0], 80, W - 80), clamp(tip[1] - 30, 60, H - 60), 30);
  for (const x of [0, W - 30]) { g.fillStyle = gray(0.72); g.fillRect(x, 0, 30, H); }
  g.fillStyle = gray(0.4); g.fillRect(30, 0, 5, H); g.fillRect(W - 35, 0, 5, H);
}, { strength: 3.2, blur: 1.6, ao: 1.8 });

// 御路下端：海水江崖（v=0 下端）
carved('pf_yulu_sea', 512, 256, (g, W, H) => {
  g.fillStyle = gray(0.2); g.fillRect(0, 0, W, H);
  // 立水（斜纹）
  for (let x = -H; x < W + H; x += 20) { g.strokeStyle = gray(x % 40 ? 0.62 : 0.45); g.lineWidth = 8; g.beginPath(); g.moveTo(x, H); g.lineTo(x + 80, H * 0.68); g.stroke(); }
  // 平水（鳞浪）
  for (let row = 0; row < 4; row++) {
    const y = H * (0.66 - row * 0.065);
    for (let x = (row % 2) * 16 - 32; x < W + 32; x += 32) { g.fillStyle = gray(0.5 + row * 0.08); g.beginPath(); g.arc(x, y, 18, Math.PI, TAU); g.fill(); g.strokeStyle = gray(0.3); g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 11, Math.PI, TAU); g.stroke(); }
  }
  // 江崖
  for (const [x, w, hh, lv] of [[W * 0.5, 70, 0.62, 0.85], [W * 0.24, 50, 0.42, 0.7], [W * 0.76, 50, 0.42, 0.7]]) {
    g.fillStyle = gray(lv); g.beginPath(); g.moveTo(x - w, H * 0.62); g.lineTo(x - w * 0.5, H * (0.62 - hh * 0.6)); g.lineTo(x - w * 0.15, H * (0.62 - hh)); g.lineTo(x + w * 0.3, H * (0.62 - hh * 0.85)); g.lineTo(x + w, H * 0.62); g.fill();
    g.strokeStyle = gray(lv * 0.6); g.lineWidth = 3; g.beginPath(); g.moveTo(x - w * 0.15, H * (0.62 - hh)); g.lineTo(x, H * 0.62); g.moveTo(x + w * 0.3, H * (0.62 - hh * 0.85)); g.lineTo(x + w * 0.45, H * 0.62); g.stroke();
  }
  cloud(g, 90, 40, 0.75); cloud(g, 420, 50, 0.7);
  g.fillStyle = gray(0.72); g.fillRect(0, 0, 30, H); g.fillRect(W - 30, 0, 30, H);
  g.fillStyle = gray(0.4); g.fillRect(30, 0, 5, H); g.fillRect(W - 35, 0, 5, H);
}, { strength: 3.2, blur: 1.6, ao: 1.8 });

// 柱头纹样：v 分区 = 座 [0,0.1] · 莲瓣圈 [0.12,0.28] · 柱头筒 [0.28,0.82] · 冠 [0.82,1]
const HV = (v) => (1 - v) * 256;
function headBase(g, W) {
  g.fillStyle = gray(0.25); g.fillRect(0, 0, W, 256);
  g.fillStyle = gray(0.62); g.fillRect(0, HV(0.1), W, 256 - HV(0.1));
  g.fillStyle = gray(0.4); g.fillRect(0, HV(0.05) - 2, W, 4);
  lotusRow(g, W, 8, HV(0.115), HV(0.12) - HV(0.29));
}
carved('pf_head_dragon', 256, 256, (g, W) => {
  headBase(g, W);
  for (const dx of [-W, 0, W]) { cloud(g, dx + 40, HV(0.7), 0.35, 0.5); cloud(g, dx + 170, HV(0.38), 0.32, 0.5); }
  const body = []; for (let k = -2; k <= 18; k++) body.push([k * 16, HV(0.55) + Math.sin(k / 16 * TAU) * 26]);
  const S = spline(body, 4);
  for (const dx of [-W, 0, W]) { strokePts(g, S.map(([x, y]) => [x + dx, y]), 30, 0.58); strokePts(g, S.map(([x, y]) => [x + dx, y]), 20, 0.82); }
  g.lineWidth = 1.5; g.strokeStyle = gray(0.55);
  for (let i = 0; i < S.length; i += 2) for (const dx of [-W, 0, W]) { g.beginPath(); g.arc(S[i][0] + dx, S[i][1], 5, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  g.fillStyle = gray(0.85); g.beginPath(); g.ellipse(196, HV(0.6), 22, 14, 0.2, 0, TAU); g.fill();
  g.fillStyle = gray(1); g.beginPath(); g.arc(204, HV(0.63), 4, 0, TAU); g.fill();
  for (const dx of [-W, 0, W]) for (let k = 0; k < 4; k++) { const x = dx + k * 64 + 32, y = HV(0.92); g.strokeStyle = gray(0.75); g.lineWidth = 6; g.beginPath(); g.arc(x, y, 12, 0, 5); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(x, y, 5, 0, 5); g.stroke(); }
}, { strength: 3.5, blur: 1 });
carved('pf_head_phoenix', 256, 256, (g, W) => {
  headBase(g, W);
  for (const dx of [-W, 0, W]) { cloud(g, dx + 200, HV(0.72), 0.33, 0.5); cloud(g, dx + 60, HV(0.36), 0.3, 0.5); }
  for (const dx of [-W, 0, W]) {
    const cx = dx + 90, cy = HV(0.6);
    for (let k = 0; k < 3; k++) strokePts(g, spline([[cx, cy], [cx + 50, cy + 18 + k * 8], [cx + 110, cy - 10 + k * 14], [cx + 150, cy + 25 + k * 10]], 6), 7 - k, 0.78);
    for (let k = 0; k < 6; k++) strokePts(g, [[cx - 4, cy - 4], [cx - 30 + k * 6, cy - 40 + k * 3]], 6, 0.8);
    g.fillStyle = gray(0.85); g.beginPath(); g.ellipse(cx, cy, 16, 11, -0.3, 0, TAU); g.fill();
    strokePts(g, [[cx - 12, cy - 6], [cx - 22, cy - 22], [cx - 34, cy - 24]], 7, 0.82);
    g.fillStyle = gray(0.9); g.beginPath(); g.arc(cx - 36, cy - 26, 6, 0, TAU); g.fill();
  }
  for (const dx of [-W, 0, W]) for (let k = 0; k < 4; k++) { const x = dx + k * 64, y = HV(0.92); g.strokeStyle = gray(0.75); g.lineWidth = 6; g.beginPath(); g.arc(x, y, 12, 0, 5); g.stroke(); }
}, { strength: 3.5, blur: 1 });
carved('pf_head_qi24', 256, 256, (g, W) => {
  headBase(g, W);
  g.fillStyle = gray(0.8); g.fillRect(0, HV(0.81), W, HV(0.3) - HV(0.81));
  for (let k = 0; k < 24; k++) { const x = (k + 0.5) * W / 24; g.strokeStyle = gray(0.35); g.lineWidth = 4; g.beginPath(); g.moveTo(x, HV(0.79)); g.lineTo(x, HV(0.32)); g.stroke(); }
  g.fillStyle = gray(0.85); g.fillRect(0, 0, W, HV(0.83));
  g.fillStyle = gray(0.55); g.fillRect(0, HV(0.9), W, 3);
}, { strength: 3, blur: 1 });
carved('pf_head_lotus', 256, 256, (g, W) => {
  headBase(g, W);
  lotusRow(g, W, 8, HV(0.3), HV(0.3) - HV(0.62));
  lotusRow(g, W, 8, HV(0.52), HV(0.52) - HV(0.86), W / 16);
  g.fillStyle = gray(0.9); g.fillRect(0, 0, W, HV(0.88));
}, { strength: 3, blur: 1 });

// 青白石 / 陡板：低频斑驳 + 石缝
function stoneCanvas(W, H, rgb, joints, seed, slabTone = []) {
  const c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H);
  const r = rng(seed);
  const waves = Array.from({ length: 10 }, () => [1 + Math.floor(r() * 4), Math.floor(r() * 4) - 1, r() * TAU, 0.02 + r() * 0.03]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    let f = 1;
    for (const [fx, fy, ph, a] of waves) f += a * Math.sin(TAU * (fx * u + fy * v) + ph);
    f += (r() - 0.5) * 0.04;
    let j = 1;
    for (const ju of joints) { const d = Math.min(Math.abs(u - ju), Math.abs(u - ju - 1), Math.abs(u - ju + 1)) * W; if (d < 1.6) j = Math.min(j, 0.62 + 0.24 * d); }
    const slab = slabTone.length ? slabTone[Math.floor(u * slabTone.length)] : 1;
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) img.data[i + k] = clamp(rgb[k] * f * j * slab, 0, 255);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
registerTexture('pf_qingbai', () => stoneCanvas(256, 256, [186, 188, 184], [0], 21));
registerTexture('pf_doban', () => stoneCanvas(512, 256, [172, 174, 169], [0, 0.5], 23, [1, 0.94]));
defineMaterial('pf_qingbai', { color: 0xffffff, map: 'pf_qingbai', roughness: 0.78, period: [2, 2] });
defineMaterial('pf_doban', { color: 0xffffff, map: 'pf_doban', roughness: 0.82, period: [2.4, 1.2] });

// 踏跺：v∈[0,0.5] 踢面（下暗上亮），v∈[0.5,1] 踏面（里暗外亮），u 每 1.6m 一道石缝 —— 远看台阶层次分明
function stepCanvas(rgb, seed) {
  const W = 256, H = 256, c = mkCanvas(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), r = rng(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = 1 - (y + 0.5) / H, u = x / W;
    let f;
    if (v < 0.5) { const t = v / 0.5; f = 0.66 + 0.3 * Math.pow(t, 0.6) + (t > 0.93 ? 0.06 : 0); }
    else { const t = (v - 0.5) / 0.5; f = 0.8 + 0.2 * Math.pow(t, 0.5) + (t > 0.95 ? 0.05 : 0); }
    f *= 1 + 0.03 * Math.sin(TAU * (u * 2 + v)) + (r() - 0.5) * 0.03;
    const d = Math.min(u, 1 - u) * W;
    if (d < 1.4) f *= 0.7 + 0.2 * d;
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) img.data[i + k] = clamp(rgb[k] * f, 0, 255);
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
registerTexture('pf_step_m', () => stepCanvas([228, 224, 213], 31));
registerTexture('pf_step_s', () => stepCanvas([190, 192, 188], 33));
defineMaterial('pf_step_m', { color: 0xffffff, map: 'pf_step_m', roughness: 0.6, period: [1.6, 1] });
defineMaterial('pf_step_s', { color: 0xffffff, map: 'pf_step_s', roughness: 0.78, period: [1.6, 1] });

// 螭首头部：u 绕截面一周（0=顶中），v 自颈根(0)至鼻端(1)。眼、眉、鬃、鳞、唇齿、鼻孔
carved('pf_chishou', 256, 256, (g, W, H) => {
  g.fillStyle = gray(0.5); g.fillRect(0, 0, W, H);
  const V = (v) => (1 - v) * H;
  for (const sg of [1, -1]) {
    const U = (u) => (sg > 0 ? u : 1 - u) * W;
    for (let k = 0; k < 6; k++) strokePts(g, spline([[U(0.03 + k * 0.05), V(0.42)], [U(0.06 + k * 0.055), V(0.3)], [U(0.02 + k * 0.06), V(0.16)], [U(0.05 + k * 0.06), V(0.02)]], 5), 7, 0.72);
    strokePts(g, spline([[U(0.03), V(0.2)], [U(0.1), V(0.3)], [U(0.2), V(0.27)]], 5), 10, 0.88);
    strokePts(g, spline([[U(0.02), V(0.05)], [U(0.04), V(0.16)], [U(0.08), V(0.27)]], 5), 8, 0.8);
    g.fillStyle = gray(0.3); g.beginPath(); g.ellipse(U(0.15), V(0.25), 15, 11, 0, 0, TAU); g.fill();
    g.strokeStyle = gray(0.3); g.lineWidth = 2;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(U(0.3 + j * 0.05), V(0.12 + i * 0.07), 7, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    strokePts(g, [[U(0.3), V(0.5)], [U(0.31), V(0.98)]], 5, 0.25);
    g.fillStyle = gray(0.95);
    for (let i = 0; i < 5; i++) { const y = V(0.56 + i * 0.08); g.beginPath(); g.moveTo(U(0.315), y); g.lineTo(U(0.345), y - 6); g.lineTo(U(0.315), y - 12); g.fill(); }
    g.fillStyle = gray(0.2); g.beginPath(); g.ellipse(U(0.06), V(0.93), 7, 5, 0, 0, TAU); g.fill();
    g.strokeStyle = gray(0.8); g.lineWidth = 5; g.beginPath(); g.arc(U(0.08), V(0.82), 10, 0, 5); g.stroke();
  }
  g.strokeStyle = gray(0.35); g.lineWidth = 2;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(W * (0.42 + j * 0.05), V(0.05 + i * 0.07), 7, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
}, { strength: 3.5, blur: 1, base: [226, 222, 211] });

// ===================== 几何工具 =====================
/** 三角形累加器（非索引）。quad(a,b,c,d) 以法线 n 方向看为逆时针 */
class GB {
  constructor() { this.p = []; this.n = []; this.u = []; }
  tri(a, b, c, n, ua = [0, 0], ub = [0, 0], uc = [0, 0]) { this.p.push(...a, ...b, ...c); this.n.push(...n, ...n, ...n); this.u.push(...ua, ...ub, ...uc); }
  quad(a, b, c, d, n, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) { this.tri(a, b, c, n, uv[0], uv[1], uv[2]); this.tri(a, c, d, n, uv[0], uv[2], uv[3]); }
  /** 凸多边形（自动按法线定向） */
  poly(P, n, uvf) {
    const cr = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
    let Q = P;
    let k = 1; while (k < Q.length - 1) { const c = cr(Q[0], Q[k], Q[k + 1]); const l = Math.hypot(...c); if (l > 1e-9) { if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] < 0) Q = Q.slice().reverse(); break; } k++; }
    for (let i = 1; i < Q.length - 1; i++) this.tri(Q[0], Q[i], Q[i + 1], n, uvf(Q[0]), uvf(Q[i]), uvf(Q[i + 1]));
  }
  /** 四边形，法线按实际几何计算，hint 决定朝向 */
  quadAuto(a, b, c, d, hint, uv) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...n);
    if (l < 1e-12) return;
    n = n.map((x) => x / l);
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] >= 0) this.quad(a, b, c, d, n, uv);
    else this.quad(a, d, c, b, n.map((x) => -x), uv && [uv[0], uv[3], uv[2], uv[1]]);
  }
  geo() { return fromArrays(this.p, this.u, this.n); }
  get empty() { return this.p.length === 0; }
}

/** 带凹入“盒子”的矩形面：原点 o（左下），水平轴 U，外法线 N（V 恒为 +Y）；w×h，边距 mx/mb/mt，凹深 dep */
function insetFace(gb, o, U, N, w, h, mx, mb, mt, dep) {
  const P = (u, v, d = 0) => [o[0] + U[0] * u - N[0] * d, o[1] + v, o[2] + U[2] * u - N[2] * d];
  const rect = (u0, v0, u1, v1, d) => gb.quad(P(u0, v0, d), P(u1, v0, d), P(u1, v1, d), P(u0, v1, d), N, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  const a = mx, b = w - mx, c = mb, e = h - mt;
  rect(0, 0, w, c, 0); rect(0, e, w, h, 0); rect(0, c, a, e, 0); rect(b, c, w, e, 0);
  rect(a, c, b, e, dep);
  const UP = [0, 1, 0], DN = [0, -1, 0], UN = [-U[0], 0, -U[2]];
  gb.quad(P(a, c), P(b, c), P(b, c, dep), P(a, c, dep), UP);
  gb.quad(P(a, e), P(a, e, dep), P(b, e, dep), P(b, e), DN);
  gb.quad(P(a, c), P(a, c, dep), P(a, e, dep), P(a, e), U);
  gb.quad(P(b, c), P(b, e), P(b, e, dep), P(b, c, dep), UN);
}

/** 按主法线方向投影的 UV（米） */
function boxUV(g, sx = 1) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i) * sx, y = p.getY(i), z = p.getZ(i);
    if (az >= ax && az >= ay) { uv[i * 2] = x; uv[i * 2 + 1] = y; } else if (ax >= ay) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else { uv[i * 2] = x; uv[i * 2 + 1] = z; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/** 截面放样：secs=[{z, cx?, hw, yt, yb, ex?}]（超椭圆截面，ex 为上侧外鼓），自动定向；cap 封末端 */
function loftGeo(secs, nSeg = 10, cap = true) {
  const nsec = secs.length;
  const ring = (s) => {
    const out = [], yc = (s.yt + s.yb) / 2, hh = (s.yt - s.yb) / 2;
    for (let k = 0; k < nSeg; k++) {
      const a = Math.PI / 2 + (k / nSeg) * TAU, c = Math.cos(a), sn = Math.sin(a);
      const bulge = 1 + (s.ex || 0) * Math.max(0, sn) * Math.abs(c);
      out.push([(s.cx || 0) + s.hw * Math.sign(c) * Math.abs(c) ** 0.6 * bulge, yc + hh * Math.sign(sn) * Math.abs(sn) ** 0.6, s.z]);
    }
    return out;
  };
  const R = secs.map(ring);
  const build = (flip) => {
    const grid = [], uvg = [];
    for (let k = 0; k <= nSeg; k++) { grid.push(R.map((r) => r[k % nSeg])); uvg.push(R.map((r, i) => [k / nSeg, i / (nsec - 1)])); }
    return gridSurface(grid, uvg, flip);
  };
  let g = build(false);
  const nv = secs.length, mid = nv >> 1;
  if (g.attributes.normal.getY(mid) < 0) g = build(true);
  const parts = [g];
  if (cap) {
    const last = R[R.length - 1], s = secs[secs.length - 1];
    const c = [s.cx || 0, (s.yt + s.yb) / 2, s.z + (s.tip ?? 0)];
    const gb = new GB();
    const dz = Math.sign(s.z - secs[secs.length - 2].z) || 1;
    for (let k = 0; k < nSeg; k++) {
      const a = last[k], b = last[(k + 1) % nSeg];
      const u = [a[0] - c[0], a[1] - c[1], a[2] - c[2]], v = [b[0] - c[0], b[1] - c[1], b[2] - c[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = Math.hypot(...n) || 1;
      const uc = [0.5, 1], ua = [k / nSeg, 0.99], ub = [(k + 1) / nSeg, 0.99];
      if (n[2] * dz < 0) gb.tri(c, b, a, [-n[0] / l, -n[1] / l, -n[2] / l], uc, ub, ua); else gb.tri(c, a, b, [n[0] / l, n[1] / l, n[2] / l], uc, ua, ub);
    }
    parts.push(gb.geo());
  }
  return merge(parts);
}

// ---------- 多边形 ----------
const isCW = (P) => THREE.ShapeUtils.isClockWise(P.map(([x, z]) => new THREE.Vector2(x, z)));
function dedupe(poly, closed) {
  const P = [];
  for (const p of poly) { const q = P[P.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-3) P.push([p[0], p[1]]); }
  if (closed && P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-3) P.pop();
  return P;
}
/** 去重、去共线点并统一为逆时针（外法线 = (dz,-dx)） */
function cleanPoly(poly) {
  const P = dedupe(poly, true);
  for (let guard = 0; guard < 1000 && P.length > 3; guard++) {
    let hit = -1;
    for (let i = 0; i < P.length; i++) {
      const n = P.length, a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
      const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
      if (Math.abs(e1[0] * e2[1] - e1[1] * e2[0]) < Math.hypot(...e1) * Math.hypot(...e2) * 0.02 && e1[0] * e2[0] + e1[1] * e2[1] > 0) { hit = i; break; }
    }
    if (hit < 0) break;
    P.splice(hit, 1);
  }
  if (isCW(P)) P.reverse();
  return P;
}
function edgesOf(P) {
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-9;
    return { a, b, L, dir: [dx / L, dz / L], n: [dz / L, -dx / L] };
  });
}
function cumLen(Q) { const C = [0]; for (let i = 1; i < Q.length; i++) C.push(C[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1])); return C; }
function pointAtS(Q, C, s) {
  let i = 0;
  while (i < Q.length - 2 && C[i + 1] < s) i++;
  const t = clamp((s - C[i]) / (C[i + 1] - C[i] || 1), 0, 1);
  return [Q[i][0] + (Q[i + 1][0] - Q[i][0]) * t, Q[i][1] + (Q[i + 1][1] - Q[i][1]) * t];
}
function subPath(Q, C, a, b) {
  const out = [pointAtS(Q, C, a)];
  for (let i = 1; i < Q.length - 1; i++) if (C[i] > a + 1e-6 && C[i] < b - 1e-6) out.push(Q[i]);
  out.push(pointAtS(Q, C, b));
  return out;
}
function projectS(Q, C, q) {
  let best = Infinity, bs = 0;
  for (let i = 0; i < Q.length - 1; i++) {
    const a = Q[i], b = Q[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
    const t = clamp(((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L2, 0, 1);
    const d = Math.hypot(a[0] + dx * t - q[0], a[1] + dz * t - q[1]);
    if (d < best) { best = d; bs = C[i] + t * Math.sqrt(L2); }
  }
  return bs;
}

/**
 * 沿闭合多边形（逆时针）挤出截面。parts: [{ mat, pts:[[d,y],...], smooth, band:{period, ref?, flip?} }]
 * d 为相对多边形的外偏距（>0 向外），y 为绝对高度；截面点须自下而上 / 自外向内排列（法线朝外）。
 * band：每条边取整数个纹理周期（转角处对缝），v 为截面 0..1；否则 UV 以米计（竖面 v=y，平面 v=d）。
 */
function extrudeProfile(ctx, P, parts) {
  const E = edgesOf(P), n = P.length;
  const rings = new Map();
  const ring = (d) => { const k = Math.round(d * 1e5); let r = rings.get(k); if (!r) { r = Math.abs(d) < 1e-7 ? P : offsetPoly(P, d); rings.set(k, r); } return r; };
  const acc = []; let s0 = 0; for (const e of E) { acc.push(s0); s0 += e.L; }
  for (const part of parts) {
    const pts = part.pts, m = pts.length;
    if (m < 2) continue;
    const segN = [];
    for (let j = 0; j < m - 1; j++) { const dd = pts[j + 1][0] - pts[j][0], dy = pts[j + 1][1] - pts[j][1], l = Math.hypot(dd, dy) || 1; segN.push([dy / l, -dd / l]); }
    const ptN = pts.map((_, j) => { const a = segN[Math.max(0, j - 1)], b = segN[Math.min(m - 2, j)], x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; });
    const plen = [0]; for (let j = 1; j < m; j++) plen.push(plen[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    const tot = plen[m - 1] || 1;
    const R = pts.map(([d]) => ring(d));
    const pos = [], uv = [], nor = [];
    for (let i = 0; i < n; i++) {
      const e = E[i], i1 = (i + 1) % n, [ex, ez] = e.dir;
      let count = 1;
      if (part.band) { const r = ring(part.band.ref ?? pts[m >> 1][0]); count = Math.max(1, Math.round(((r[i1][0] - r[i][0]) * ex + (r[i1][1] - r[i][1]) * ez) / part.band.period)); }
      for (let j = 0; j < m - 1; j++) {
        const flat = Math.abs(pts[j + 1][1] - pts[j][1]) < Math.abs(pts[j + 1][0] - pts[j][0]);
        const vtx = (jj, ii) => {
          const r = R[jj], p = r[ii], y = pts[jj][1];
          let u, v;
          if (part.band) {
            const L = (r[i1][0] - r[i][0]) * ex + (r[i1][1] - r[i][1]) * ez || 1;
            u = (((p[0] - r[i][0]) * ex + (p[1] - r[i][1]) * ez) / L) * count;
            v = plen[jj] / tot; if (part.band.flip) v = 1 - v;
          } else {
            u = acc[i] + (p[0] - e.a[0]) * ex + (p[1] - e.a[1]) * ez;
            v = flat ? -pts[jj][0] : y;
          }
          const pn = part.smooth ? ptN[jj] : segN[j];
          return [p[0], y, p[1], u, v, e.n[0] * pn[0], pn[1], e.n[1] * pn[0]];
        };
        const q = [vtx(j, i), vtx(j, i1), vtx(j + 1, i1), vtx(j + 1, i)];
        for (const k of [0, 2, 1, 0, 3, 2]) { const t = q[k]; pos.push(t[0], t[1], t[2]); uv.push(t[3], t[4]); nor.push(t[5], t[6], t[7]); }
      }
    }
    ctx.add(part.mat, fromArrays(pos, uv, nor));
  }
}

// ===================== 须弥座 / 台基 =====================
/** 1/4 椭圆枭线：lower=true 自 A（竖切）至 B（横切），否则自 B（横切）至 A（竖切） */
function xiaoArc(dA, dB, yA, yB, lower, K = 6) {
  const out = [];
  for (let k = 0; k <= K; k++) {
    const t = (k / K) * Math.PI / 2;
    out.push(lower ? [dB + (dA - dB) * Math.cos(t), yA + (yB - yA) * Math.sin(t)] : [dB + (dA - dB) * Math.sin(t), yB + (yA - yB) * (1 - Math.cos(t))]);
  }
  return out;
}

/**
 * 须弥座（清官式，总高 51 份）：土衬、圭角 10、下枋 9、下枭 6（覆莲）、皮条线 1、束腰 8（玛瑙柱子+椀花结带）、皮条线 1、上枭 6（仰莲）、上枋 10。
 * 返回 { top }。opts: brick（砖须弥座，素面）、edgeW（顶面边石宽）、edgeMat、tuchen(false 不做土衬)
 */
export function buildXumizuo(ctx, poly, y0, h, opts = {}) {
  const P = cleanPoly(poly);
  const u = h / 51, Y = (k) => y0 + k * u;
  const brick = !!opts.brick;
  const M = brick ? { gj: 'brick_grey', fang: 'brick_grey', xiao: 'brick_grey', sy: 'brick_grey', top: 'pf_qingbai' } : { gj: 'marble', fang: 'marble', xiao: 'pf_lotus', sy: 'pf_shuyao', top: 'marble' };
  if (opts.edgeMat) M.top = opts.edgeMat;
  const g = 0.6 * u, tH = Math.min(0.12, 2 * u), tO = g + Math.min(0.1, 1.8 * u);
  const pw = 5.2 * u; // 莲瓣宽
  const parts = [];
  let yb = y0;
  if (opts.tuchen !== false) {
    parts.push({ mat: 'pf_qingbai', pts: [[tO, y0 - 0.03], [tO, y0 + tH], [g, y0 + tH]] });
    yb = y0 + tH;
  }
  parts.push({ mat: M.gj, pts: [[g, yb], [g, Y(2.4)], [g - 0.45 * u, Y(2.8)], [g - 0.45 * u, Y(3.3)], [g, Y(3.7)], [g, Y(9.3)], [0, Y(10)]] });
  parts.push({ mat: M.fang, pts: [[0, Y(10)], [0, Y(19)], [-0.35 * u, Y(19)]] });
  parts.push({ mat: M.xiao, pts: xiaoArc(-0.35 * u, -4 * u, Y(19), Y(25), true), smooth: true, band: brick ? null : { period: 4 * pw, flip: true } });
  parts.push({ mat: M.fang, pts: [[-4 * u, Y(25)], [-4 * u, Y(26)], [-5 * u, Y(26)]] });
  parts.push({ mat: M.sy, pts: [[-5 * u, Y(26)], [-5 * u, Y(34)]], band: brick ? null : { period: 32 * u } });
  parts.push({ mat: M.fang, pts: [[-5 * u, Y(34)], [-4 * u, Y(34)], [-4 * u, Y(35)]] });
  parts.push({ mat: M.xiao, pts: xiaoArc(-0.35 * u, -4 * u, Y(41), Y(35), false), smooth: true, band: brick ? null : { period: 4 * pw } });
  parts.push({ mat: M.fang, pts: [[-0.35 * u, Y(41)], [0, Y(41)], [0, Y(51)]] });
  const ew = opts.edgeW ?? 0.55;
  if (ew > 0) parts.push({ mat: M.top, pts: [[0, Y(51)], [-ew, Y(51)]] });
  extrudeProfile(ctx, P, parts);
  return { top: y0 + h, poly: P };
}

/** 角柱石：每个转角两面各一块竖石 */
function cornerStones(ctx, P, y0, y1, d, cw, mat) {
  const E = edgesOf(P), n = P.length, R = offsetPoly(P, d), th = 0.03, hh = y1 - y0;
  if (hh <= 0.02) return;
  for (let i = 0; i < n; i++) {
    const C = R[i];
    for (const [e, out] of [[E[i], true], [E[(i - 1 + n) % n], false]]) {
      const w = Math.min(cw, e.L * 0.3);
      const a = out ? -th / 2 : -w, b = out ? w : -th / 2, mid = (a + b) / 2;
      ctx.at(C[0] + e.dir[0] * mid, y0 + hh / 2, C[1] + e.dir[1] * mid, Math.atan2(-e.dir[1], e.dir[0])).add(mat, boxGeo(b - a, hh, th));
    }
  }
}

// ===================== 栏杆原型 =====================
const RH0 = 1.3; // 原型基准：望柱顶距地栿底
const DF_H = 0.14, DF_W = 0.3; // 地栿高、宽
const POST_A = 0.11; // 望柱半宽
const SHAFT_H = 0.8; // 柱身顶（距地栿顶）
const DRUM_L = 0.9;
const PANEL_LN = 1.25; // 栏板设计净跨（米）
const RAIL_MAT = { m: 'marble', s: 'pf_qingbai' };
const RAIL_INSET = 0.3; // 默认栏杆中线距台边（与 building.js 一致）

// 柱头截面 [r, dy, v]（dy 自柱身顶起）
const HEAD_BASE = [[0.124, 0, 0], [0.128, 0.015, 0.04], [0.128, 0.036, 0.1]];
const HEADS = {
  dragon: [...HEAD_BASE, [0.104, 0.046, 0.12], [0.117, 0.068, 0.2], [0.122, 0.092, 0.28], [0.119, 0.175, 0.55], [0.122, 0.255, 0.82], [0.104, 0.29, 0.88], [0.072, 0.328, 0.94], [0.03, 0.354, 0.98], [0, 0.362, 1]],
  qi24: [...HEAD_BASE, [0.1, 0.046, 0.12], [0.119, 0.075, 0.22], [0.112, 0.1, 0.28], [0.104, 0.108, 0.3], [0.104, 0.236, 0.8], [0.112, 0.246, 0.83], [0.092, 0.29, 0.9], [0.052, 0.33, 0.96], [0, 0.346, 1]],
  lotus: [...HEAD_BASE, [0.1, 0.046, 0.12], [0.116, 0.07, 0.2], [0.11, 0.1, 0.3], [0.124, 0.16, 0.5], [0.11, 0.236, 0.8], [0.085, 0.27, 0.86], [0.05, 0.31, 0.92], [0.028, 0.335, 0.97], [0, 0.35, 1]],
};
HEADS.phoenix = HEADS.dragon;

/** 望柱柱身：抹角方柱，内外两面起“盘子” */
function postShaft() {
  const a = POST_A, c = 0.028, y0 = -0.02, y1 = SHAFT_H;
  const gb = new GB();
  const oct = [[a, -a + c], [a, a - c], [a - c, a], [-a + c, a], [-a, a - c], [-a, -a + c], [-a + c, -a], [a - c, -a]];
  for (let i = 0; i < 8; i++) {
    const [x1, z1] = oct[i], [x2, z2] = oct[(i + 1) % 8];
    if (i === 2) insetFace(gb, [-a + c, y0, a], [1, 0, 0], [0, 0, 1], 2 * (a - c), y1 - y0, 0.035, 0.1, 0.07, 0.01);
    else if (i === 6) insetFace(gb, [a - c, y0, -a], [-1, 0, 0], [0, 0, -1], 2 * (a - c), y1 - y0, 0.035, 0.1, 0.07, 0.01);
    else {
      const L = Math.hypot(x2 - x1, z2 - z1), n = [(z2 - z1) / L, 0, -(x2 - x1) / L];
      gb.quad([x1, y0, z1], [x1, y1, z1], [x2, y1, z2], [x2, y0, z2], n, [[0, y0], [0, y1], [L, y1], [L, y0]]);
    }
  }
  // 顶盖
  for (let i = 1; i < 7; i++) gb.tri([oct[0][0], y1, oct[0][1]], [oct[i + 1][0], y1, oct[i + 1][1]], [oct[i][0], y1, oct[i][1]], [0, 1, 0]);
  return gb.geo();
}
function headGeo(kind) {
  const prof = HEADS[kind] || HEADS.qi24, SEG = 10;
  const grid = [], uvg = [];
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * TAU, ca = Math.cos(t), sa = Math.sin(t);
    grid.push(prof.map(([r, dy]) => [r * ca, SHAFT_H + dy, -r * sa]));
    uvg.push(prof.map(([, , v]) => [i / SEG, v]));
  }
  const g = gridSurface(grid, uvg, false);
  const nm = g.attributes.normal, nv = prof.length;
  for (let j = 0; j < nv; j++) {
    const a = j, b = SEG * nv + j;
    const x = nm.getX(a) + nm.getX(b), y = nm.getY(a) + nm.getY(b), z = nm.getZ(a) + nm.getZ(b), l = Math.hypot(x, y, z) || 1;
    nm.setXYZ(a, x / l, y / l, z / l); nm.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}
function plainHead() {
  const gb = new GB(), a = 0.125, y0 = SHAFT_H, y1 = SHAFT_H + 0.07, y2 = SHAFT_H + 0.15;
  const sq = [[a, -a], [a, a], [-a, a], [-a, -a]];
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = sq[i], [x2, z2] = sq[(i + 1) % 4], n = [(z2 - z1) / (2 * a), 0, -(x2 - x1) / (2 * a)];
    gb.quad([x1, y0, z1], [x1, y1, z1], [x2, y1, z2], [x2, y0, z2], n, [[0, y0], [0, y1], [2 * a, y1], [2 * a, y0]]);
    const sl = Math.hypot(a, y2 - y1), nn = [n[0] * (y2 - y1) / sl, a / sl, n[2] * (y2 - y1) / sl];
    gb.tri([x1, y1, z1], [0, y2, 0], [x2, y1, z2], nn, [0, 0], [a, sl], [2 * a, 0]);
  }
  return gb.geo();
}

function panelGeo() {
  const Ln = PANEL_LN, T1 = 0.12, T2 = 0.1, yH = 0.34, yV = 0.63, yX = 0.72;
  const gb = new GB();
  // 华板（两面起“盒子”）
  insetFace(gb, [-0.5, 0, T1 / 2], [1, 0, 0], [0, 0, 1], 1, yH, 0.07 / Ln, 0.05, 0.05, 0.012);
  insetFace(gb, [0.5, 0, -T1 / 2], [-1, 0, 0], [0, 0, -1], 1, yH, 0.07 / Ln, 0.05, 0.05, 0.012);
  gb.quad([-0.5, yH, T1 / 2], [0.5, yH, T1 / 2], [0.5, yH, -T1 / 2], [-0.5, yH, -T1 / 2], [0, 1, 0]);
  // 寻杖（八角截面，沿 x）
  const xp = [[0.065, 0.645], [0.07, 0.685], [0.04, yX], [-0.04, yX], [-0.07, 0.685], [-0.065, 0.645], [-0.035, yV], [0.035, yV]];
  for (let i = 0; i < xp.length; i++) {
    const [z1, y1] = xp[i], [z2, y2] = xp[(i + 1) % xp.length], L = Math.hypot(z2 - z1, y2 - y1);
    gb.quad([-0.5, y1, z1], [0.5, y1, z1], [0.5, y2, z2], [-0.5, y2, z2], [0, -(z2 - z1) / L, (y2 - y1) / L]);
  }
  // 净瓶层：中一整瓶、两端各半瓶，瓶间透空
  const VZ = [[0.1, 0.058], [0.18, 0.045], [0.32, 0.075], [0.46, 0.082], [0.58, 0.06], [0.68, 0.032], [0.76, 0.036], [0.84, 0.075], [0.92, 0.118], [0.975, 0.148]];
  const yz = (z) => yH + z * (yV - yH);
  const shape = new THREE.Shape([new THREE.Vector2(-0.5, yH), new THREE.Vector2(0.5, yH), new THREE.Vector2(0.5, yV), new THREE.Vector2(-0.5, yV)]);
  for (const sg of [1, -1]) {
    const pts = [...VZ.map(([z, r]) => [sg * r / Ln, yz(z)]), ...VZ.slice().reverse().map(([z, r]) => [sg * (0.5 - r / Ln), yz(z)])];
    shape.holes.push(new THREE.Path(pts.map(([x, y]) => new THREE.Vector2(x, y))));
  }
  const vg = new THREE.ExtrudeGeometry(shape, { depth: T2, bevelEnabled: false, steps: 1 });
  vg.translate(0, 0, -T2 / 2);
  return boxUV(merge([gb.geo(), vg]), Ln);
}

function drumGeo() {
  const T = 0.13, cx = 0.52, cy = 0.33, R = 0.25;
  const pts = [[0, 0], [0.92, 0], [0.92, 0.05], [0.86, 0.085]];
  for (let k = 0; k <= 12; k++) { const a = (-40 + (170 * k) / 12) * Math.PI / 180; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
  pts.push([0.2, 0.565], [0.07, 0.64], [0, 0.69]);
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, steps: 1 });
  g.translate(0, 0, -T / 2);
  const discs = [];
  for (const sg of [1, -1]) {
    for (const [r, h] of [[0.19, 0.018], [0.12, 0.03]]) {
      const d = cylGeo(r, r, h, 16);
      d.rotateX(sg * Math.PI / 2);
      d.translate(cx, cy, sg * (T / 2 - 0.004));
      discs.push(d);
    }
  }
  return boxUV(merge([g, ...discs]));
}

/** 螭首：方颈、隆眉凸目、鼻梁下凹、卷鼻上翘、下颚张口（口即出水孔）。返回 [头部(雕刻 UV), 颚与目(marble)] */
function chishouGeo(neck = 0) {
  const Z = (z) => (z > 0.05 ? z + neck : z);
  const head = loftGeo([
    { z: -0.1, hw: 0.14, yt: 0, yb: -0.34 },
    { z: Z(0.16), hw: 0.142, yt: 0, yb: -0.33 },
    { z: Z(0.29), hw: 0.165, yt: 0.07, yb: -0.25, ex: 0.55 },
    { z: Z(0.39), hw: 0.14, yt: 0.035, yb: -0.185 },
    { z: Z(0.5), hw: 0.112, yt: -0.002, yb: -0.166 },
    { z: Z(0.61), hw: 0.1, yt: 0.006, yb: -0.16 },
    { z: Z(0.69), hw: 0.108, yt: 0.058, yb: -0.135 },
    { z: Z(0.745), hw: 0.09, yt: 0.075, yb: -0.085 },
    { z: Z(0.77), hw: 0.06, yt: 0.07, yb: -0.03, tip: 0.008 },
  ], 10);
  const jaw = loftGeo([
    { z: Z(0.16), hw: 0.12, yt: -0.215, yb: -0.33 },
    { z: Z(0.4), hw: 0.11, yt: -0.205, yb: -0.298 },
    { z: Z(0.58), hw: 0.082, yt: -0.197, yb: -0.266 },
    { z: Z(0.64), hw: 0.056, yt: -0.203, yb: -0.246, tip: 0.01 },
  ], 8);
  const eyes = [1, -1].map((sg) => {
    const e = new THREE.LatheGeometry([[0.001, -0.034], [0.028, -0.024], [0.036, 0], [0.028, 0.024], [0.001, 0.034]].map(([r, y]) => new THREE.Vector2(r, y)), 6);
    e.rotateZ(-sg * Math.PI / 2);
    e.translate(sg * 0.148, 0.012, Z(0.3));
    return e;
  });
  return [head, boxUV(merge([jaw, ...eyes]))];
}

registerProtoFamily('pf_post', (key, [head = 'qi24', m = 'm']) => {
  const mat = RAIL_MAT[m] || 'marble';
  if (head === 'plain') return [{ mat, geo: merge([postShaft(), plainHead()]) }];
  return [{ mat, geo: postShaft() }, { mat: `pf_head_${head}`, geo: headGeo(head) }];
});
registerProtoFamily('pf_panel', (key, [m = 'm']) => [{ mat: RAIL_MAT[m] || 'marble', geo: panelGeo() }]);
registerProtoFamily('pf_baogu', (key, [m = 'm']) => [{ mat: RAIL_MAT[m] || 'marble', geo: drumGeo() }]);
registerProtoFamily('pf_chishou', (key, [k = 'n']) => { const [h, j] = chishouGeo(k === 'c' ? 0.1 : 0); return [{ mat: 'pf_chishou', geo: h }, { mat: 'marble', geo: j }]; });

// ===================== 栏杆 =====================
/** 栏杆样式：heads 依次轮换（三台龙凤柱头交替） */
export const RAILING_STYLES = {
  marble: { m: 'm', heads: ['qi24'], H: 1.25, spacing: 1.5 },
  marble_dragon: { m: 'm', heads: ['dragon', 'phoenix'], H: 1.4, spacing: 1.55 },
  marble_lotus: { m: 'm', heads: ['lotus'], H: 1.25, spacing: 1.5 },
  stone: { m: 's', heads: ['plain'], H: 1.1, spacing: 1.5 },
};

/** 把路径按缺口切成若干段：[{pts:[[x,z]...], endA, endB, cyclic}] */
function computeRuns(path, closed, gapsIn = [], ends = 'drum') {
  const P = dedupe(path, closed);
  if (P.length < 2) return [];
  const Q = closed ? [...P, P[0]] : P;
  const C = cumLen(Q), T = C[C.length - 1];
  let gaps = gapsIn.map((g) => {
    if (g.at) { const sc = projectS(Q, C, g.at); return { from: sc - g.w / 2, to: sc + g.w / 2, end: g.end || 'post' }; }
    return { from: g.from, to: g.to, end: g.end || 'post' };
  }).filter((g) => g.to > g.from + 1e-3);
  if (closed) gaps = gaps.map((g) => { const f = ((g.from % T) + T) % T; return { ...g, from: f, to: f + (g.to - g.from) }; });
  gaps.sort((a, b) => a.from - b.from);
  const M = [];
  for (const g of gaps) { const l = M[M.length - 1]; if (l && g.from <= l.to) l.to = Math.max(l.to, g.to); else M.push({ ...g }); }
  if (closed && M.length > 1 && M[M.length - 1].to - T >= M[0].from) { const l = M.pop(); M[0].from = l.from - T; M[0].to = Math.max(M[0].to, l.to - T); }
  const QQ = closed ? [...Q, ...Q.slice(1)] : Q, CC = closed ? cumLen(QQ) : C;
  const sub = (a, b) => { if (a < 0) { a += T; b += T; } if (a >= T) { a -= T; b -= T; } return subPath(QQ, CC, a, b); };
  const runs = [];
  if (!M.length) { runs.push(closed ? { pts: P, cyclic: true } : { pts: P, endA: ends, endB: ends }); return runs; }
  if (closed) {
    for (let k = 0; k < M.length; k++) {
      const a = M[k].to, nx = M[(k + 1) % M.length], b = nx.from + (k === M.length - 1 ? T : 0);
      if (b - a > 0.25) runs.push({ pts: sub(a, b), endA: M[k].end, endB: nx.end });
    }
  } else {
    let a = 0, ea = ends;
    for (const g of M) { const b = clamp(g.from, 0, T); if (b - a > 0.25) runs.push({ pts: sub(a, b), endA: ea, endB: g.end }); a = clamp(g.to, 0, T); ea = g.end; }
    if (T - a > 0.25) runs.push({ pts: sub(a, T), endA: ea, endB: ends });
  }
  return runs;
}

/** 地栿：竖直截面沿折线（可含高程折点）硬边斜接扫掠，截面 prof 逆时针（px 横向） */
function dfGeo(pts, closed, prof) {
  const n = pts.length, N = closed ? n : n - 1, gb = new GB();
  const segN = [];
  for (let i = 0; i < N; i++) { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; segN.push([dz / l, -dx / l]); }
  const miter = pts.map((_, i) => {
    const a = (closed ? segN[(i - 1 + N) % N] : segN[i - 1]) || segN[i], b = segN[i] || a;
    const d = 1 + a[0] * b[0] + a[1] * b[1];
    return d < 0.15 ? a : [(a[0] + b[0]) / d, (a[1] + b[1]) / d];
  });
  const P = (i, [px, py]) => [pts[i][0] + miter[i][0] * px, pts[i][1] + py, pts[i][2] + miter[i][1] * px];
  const m = prof.length;
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const i1 = (i + 1) % n, L = Math.hypot(pts[i1][0] - pts[i][0], pts[i1][1] - pts[i][1], pts[i1][2] - pts[i][2]);
    let pl = 0;
    for (let j = 0; j < m; j++) {
      const p0 = prof[j], p1 = prof[(j + 1) % m], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const nx = (p1[1] - p0[1]) / l, ny = -(p1[0] - p0[0]) / l;
      if (ny < -0.9) { pl += l; continue; }
      gb.quadAuto(P(i, p0), P(i1, p0), P(i1, p1), P(i, p1), [segN[i][0] * nx, ny, segN[i][1] * nx], [[acc, pl], [acc + L, pl], [acc + L, pl + l], [acc, pl + l]]);
      pl += l;
    }
    acc += L;
  }
  if (!closed) for (const [i, j] of [[0, 1], [n - 1, n - 2]]) {
    const d = [pts[i][0] - pts[j][0], 0, pts[i][2] - pts[j][2]], l = Math.hypot(d[0], d[2]) || 1;
    gb.poly(prof.map((q) => P(i, q)), [d[0] / l, 0, d[2] / l], (p) => [p[0] + p[2], p[1]]);
  }
  return gb.geo();
}

const _UP = new THREE.Vector3(0, 1, 0);
function shearMatrix(x, y, z, rot, k, sx, sy, sz) {
  const M = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(_UP, rot), new THREE.Vector3(1, 1, 1));
  M.multiply(new THREE.Matrix4().set(1, 0, 0, 0, k, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
  return M.multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
}
function addProtoSheared(ctx, key, M) { for (const part of getProto(key).parts) ctx.add(part.mat, part.geo, M); }

/**
 * 一段连续栏杆。pts=[[x,y,z],...]（y 为地栿底，可含竖向折点：平面直线上的高程变化，如踏跺顶部转折）。
 * o: { s, st, spacing, endA/endB: 'post'|'drum'|'none', cyclic, sgn（外侧符号）, ch:{edge, scale}|null, counter }
 */
function railRun(ctx, pts, o) {
  const s = o.s, pa = POST_A * s, dh = DF_H * s, m = o.st.m, mat = RAIL_MAT[m];
  const cyc = !!o.cyclic;
  const Q = cyc ? [...pts, pts[0]] : pts;
  const C = [0];
  for (let i = 1; i < Q.length; i++) C.push(C[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][2] - Q[i - 1][2]));
  const T = C[C.length - 1];
  if (T < 0.3) return;
  const at = (sv) => {
    let i = 0;
    while (i < Q.length - 2 && C[i + 1] < sv) i++;
    const t = clamp((sv - C[i]) / (C[i + 1] - C[i] || 1), 0, 1);
    return [0, 1, 2].map((k) => Q[i][k] + (Q[i + 1][k] - Q[i][k]) * t);
  };
  // 地栿
  const hw = (DF_W * s) / 2, c = 0.025 * s;
  ctx.add(mat, dfGeo(pts, cyc, [[-hw, 0], [hw, 0], [hw, dh - c], [hw - c, dh], [-hw + c, dh], [-hw, dh - c]]));
  // 平面转角 → 直段
  const dirs = [];
  for (let i = 0; i < Q.length - 1; i++) { const dx = Q[i + 1][0] - Q[i][0], dz = Q[i + 1][2] - Q[i][2], l = Math.hypot(dx, dz); dirs.push(l > 1e-6 ? [dx / l, dz / l] : null); }
  const corner = [0];
  let last = dirs[0];
  for (let i = 1; i < Q.length - 1; i++) {
    const d = dirs[i];
    if (!d) continue;
    if (last && last[0] * d[0] + last[1] * d[1] < 0.9998) corner.push(i);
    last = d;
  }
  corner.push(Q.length - 1);
  const pieces = [];
  for (let k = 0; k < corner.length - 1; k++) {
    const a = C[corner[k]], b = C[corner[k + 1]];
    if (b - a < 1e-4) continue;
    const pA = at(a), pB = at(b), l = Math.hypot(pB[0] - pA[0], pB[2] - pA[2]) || 1;
    const dir = [(pB[0] - pA[0]) / l, (pB[2] - pA[2]) / l];
    pieces.push({ a, b, dir, n: [o.sgn * dir[1], -o.sgn * dir[0]] });
  }
  if (!pieces.length) return;
  // 抱鼓：端部内缩
  let sA = 0, sB = T;
  const drums = [];
  const dl = DRUM_L * s + pa;
  if (!cyc) {
    if (o.endA === 'drum') { if (pieces[0].b - pieces[0].a > dl + 0.35 * s) { drums.push([dl, 0]); sA = dl; } else o.endA = 'post'; }
    const lp = pieces[pieces.length - 1];
    if (o.endB === 'drum') { if (lp.b - lp.a > dl + 0.35 * s) { drums.push([T - dl, T]); sB = T - dl; } else o.endB = 'post'; }
  }
  // 望柱位置
  const posts = [];
  pieces.forEach((pc, pi) => {
    const a = Math.max(pc.a, sA), b = Math.min(pc.b, sB);
    if (b - a < 1e-3) return;
    const k = (at(b)[1] - at(a)[1]) / (b - a);
    const cnt = Math.max(1, Math.round((b - a) / (o.spacing / Math.sqrt(1 + k * k))));
    for (let j = 0; j <= cnt; j++) {
      const sv = a + ((b - a) * j) / cnt;
      const prev = posts[posts.length - 1];
      if (prev && Math.abs(prev.s - sv) < 1e-4) { prev.next = pi; continue; }
      posts.push({ s: sv, pi, next: pi, corner: (j === 0 && Math.abs(sv - pc.a) < 1e-6) || (j === cnt && Math.abs(sv - pc.b) < 1e-6) });
    }
  });
  if (cyc && posts.length > 1 && Math.abs(posts[posts.length - 1].s - T) < 1e-4) { const l = posts.pop(); posts[0].prev = l.pi; }
  // 过近者合并（保留转角柱）
  const minGap = 2 * pa * 1.25;
  for (let i = posts.length - 1; i > 0; i--) {
    if (posts[i].s - posts[i - 1].s < minGap) {
      const drop = posts[i].corner && !posts[i - 1].corner ? i - 1 : i;
      if (drop === i) posts[i - 1].next = posts[i].next; else posts[i].prev = posts[i - 1].prev ?? posts[i - 1].pi;
      posts.splice(drop, 1);
    }
  }
  const cornerS = pieces.slice(1).map((p) => p.a);
  const crossesCorner = (s1, s2) => cornerS.some((cs) => cs > s1 + 1e-3 && cs < s2 - 1e-3);
  // 栏板
  const panelKey = `pf_panel:${m}`;
  const panelBetween = (p1, p2, s1, s2) => {
    if (crossesCorner(s1, s2)) return;
    const dx = p2[0] - p1[0], dz = p2[2] - p1[2], L = Math.hypot(dx, dz), clear = L - 2 * pa;
    if (clear < 0.12 * s) return;
    const rot = Math.atan2(-dz, dx), k = (p2[1] - p1[1]) / L;
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2 + dh, mz = (p1[2] + p2[2]) / 2, sx = clear + 0.04 * s;
    if (Math.abs(k) < 1e-4) ctx.place(panelKey, mx, my, mz, rot, [sx, s, s]);
    else addProtoSheared(ctx, panelKey, shearMatrix(mx, my, mz, rot, k, sx, s, s));
  };
  for (let i = 0; i < posts.length - 1; i++) panelBetween(at(posts[i].s), at(posts[i + 1].s), posts[i].s, posts[i + 1].s);
  if (cyc && posts.length > 1) { const pl = posts[posts.length - 1]; if (!crossesCorner(pl.s, T)) panelBetween(at(pl.s), at(T), pl.s, T); }
  // 望柱 + 螭首
  const heads = o.st.heads;
  posts.forEach((p, i) => {
    const first = i === 0 && !cyc, lastP = i === posts.length - 1 && !cyc;
    const end = first ? o.endA : lastP ? o.endB : null;
    const q = at(p.s), pc = pieces[p.next];
    if (end !== 'none') ctx.place(`pf_post:${heads[o.counter.n++ % heads.length]}:${m}`, q[0], q[1] + dh, q[2], Math.atan2(-pc.dir[1], pc.dir[0]), s);
    if (!o.ch || end === 'post' || end === 'none') return;
    const pPrev = pieces[p.prev ?? p.pi], pNext = pieces[p.next];
    if (Math.abs(at(Math.min(T, p.s + 0.05))[1] - q[1]) > 1e-3 || Math.abs(at(Math.max(0, p.s - 0.05))[1] - q[1]) > 1e-3) return;
    let ox, oz, dist, key = 'pf_chishou:n', sc = o.ch.scale;
    if (pPrev !== pNext && p.corner && pPrev.dir[0] * pNext.dir[0] + pPrev.dir[1] * pNext.dir[1] < 0.9998) {
      const convex = pPrev.dir[0] * pNext.n[0] + pPrev.dir[1] * pNext.n[1] > 1e-3;
      if (!convex) return;
      const bx = pPrev.n[0] + pNext.n[0], bz = pPrev.n[1] + pNext.n[1], bl = Math.hypot(bx, bz) || 1;
      ox = bx / bl; oz = bz / bl;
      dist = o.ch.edge / Math.max(0.3, ox * pPrev.n[0] + oz * pPrev.n[1]);
      key = 'pf_chishou:c'; sc *= 1.3;
    } else { ox = pNext.n[0]; oz = pNext.n[1]; dist = o.ch.edge; }
    ctx.place(key, q[0] + ox * dist, q[1] - 0.012 * sc, q[2] + oz * dist, Math.atan2(ox, oz), sc);
  });
  // 抱鼓石
  for (const [sp, stip] of drums) {
    const sgn = Math.sign(stip - sp), s0 = sp + sgn * pa;
    const p0 = at(s0), p1 = at(stip), dx = p1[0] - p0[0], dz = p1[2] - p0[2], L = Math.hypot(dx, dz) || 1;
    const k = (p1[1] - p0[1]) / L, rot = Math.atan2(-dz, dx);
    const sxd = L / DRUM_L;
    if (Math.abs(k) < 1e-4) ctx.place(`pf_baogu:${m}`, p0[0], p0[1] + dh, p0[2], rot, [sxd, s, s]);
    else addProtoSheared(ctx, `pf_baogu:${m}`, shearMatrix(p0[0], p0[1] + dh, p0[2], rot, k, sxd, s, s));
  }
}

/** 木栏杆（廊下寻杖栏杆 / 坐凳栏杆） */
function woodRun(ctx, pts2, y, o) {
  const { mat, H, bench, spacing } = o;
  const Q = o.cyclic ? [...pts2, pts2[0]] : pts2;
  for (let i = 0; i < Q.length - 1; i++) {
    const [x1, z1] = Q[i], [x2, z2] = Q[i + 1], L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 0.2) continue;
    const rot = Math.atan2(-(z2 - z1), x2 - x1), n = Math.max(1, Math.round(L / spacing)), seg = L / n;
    const c = ctx.at(x1, y, z1, rot);
    for (let k = 0; k <= n; k++) {
      if (k === 0 && i > 0 && !o.cyclic) continue;
      const g = boxGeo(0.1, H + 0.04, 0.1); g.translate(k * seg, (H + 0.04) / 2, 0); c.add(mat, g);
    }
    for (let k = 0; k < n; k++) {
      const x0 = k * seg + 0.05, w = seg - 0.1, cx = x0 + w / 2;
      const bar = (yy, hh, dd) => { const g = boxGeo(w, hh, dd); g.translate(cx, yy, 0); c.add(mat, g); };
      if (bench) {
        bar(H - 0.025, 0.05, 0.36); bar(0.08, 0.06, 0.06); bar(H - 0.1, 0.05, 0.06);
        const nb = Math.max(2, Math.round(w / 0.14));
        for (let j = 1; j < nb; j++) { const g = boxGeo(0.025, H - 0.25, 0.03); g.translate(x0 + (w * j) / nb, (H - 0.25) / 2 + 0.11, 0); c.add(mat, g); }
      } else {
        bar(H - 0.03, 0.06, 0.07); bar(H * 0.58, 0.05, 0.06); bar(0.08, 0.06, 0.06);
        const nb = Math.max(2, Math.round(w / 0.12));
        for (let j = 1; j < nb; j++) { const g = boxGeo(0.025, H * 0.58 - 0.11, 0.03); g.translate(x0 + (w * j) / nb, (H * 0.58 + 0.11) / 2, 0); c.add(mat, g); }
        for (const f of [0.3, 0.7]) { const g = boxGeo(0.05, H * 0.42 - 0.08, 0.045); g.translate(x0 + w * f, H * 0.79 - 0.01, 0); c.add(mat, g); }
      }
    }
  }
}

/**
 * 栏杆（沿折线）。
 * opts: path [[x,z],...]; y 栏杆底（地栿底）高度; closed 是否闭合;
 *   style: 'marble'（汉白玉寻杖栏板，二十四气柱头）| 'marble_dragon'（龙凤望柱头交替，三台用）| 'marble_lotus'（莲瓣柱头）| 'stone'（青白石素方头）
 *          | 'wood_red' | 'wood_green'（廊下寻杖栏杆；bench:true 为坐凳栏杆）
 *   height 栏杆高（望柱顶距地栿底，默认 marble 1.25 / marble_dragon 1.4 / stone 1.1 / wood 0.9）; postSpacing 望柱间距（默认 ~1.5）;
 *   chishou 是否在望柱下设螭首（true 或 {edge, scale}；edge = 路径到台帮外皮的距离，默认 0.28×高度比）；凸转角设大螭首
 *   gaps: [{from, to, end}] 沿路径长度（米）的缺口，或 [{at:[x,z], w, end}]（以路径上距 at 最近点为中心、宽 w）；
 *         end: 'post'（缺口两端立望柱，接踏跺斜栏杆，默认）| 'drum'（以抱鼓石收头）
 *   ends: 开口路径两端收头 'drum'（默认）| 'post' | 'none'; outward: 开口路径外侧符号（+1 时外侧 = (dz,-dx)，用于螭首朝向）
 */
export function buildRailing(ctx, opts) {
  const { path, y = 0, closed = false } = opts;
  const style = opts.style || 'marble';
  const runs = computeRuns(path, closed, opts.gaps || [], opts.ends ?? 'drum');
  if (style.startsWith('wood')) {
    const bench = !!opts.bench;
    const o = { mat: style, H: opts.height ?? (bench ? 0.5 : 0.9), bench, spacing: opts.postSpacing ?? 1.6 };
    for (const r of runs) woodRun(ctx, r.pts, y, { ...o, cyclic: r.cyclic });
    return;
  }
  const st = RAILING_STYLES[style] || RAILING_STYLES.marble;
  const H = opts.height ?? st.H, s = H / RH0;
  const sgn = closed ? (isCW(dedupe(path, true)) ? -1 : 1) : (opts.outward ?? 1);
  const ch = opts.chishou ? { edge: opts.chishou.edge ?? opts.edge ?? RAIL_INSET, scale: opts.chishou.scale ?? 0.85 * s } : null;
  const counter = { n: 0 };
  for (const r of runs) railRun(ctx, r.pts.map(([x, z]) => [x, y, z]), { s, st, spacing: opts.postSpacing ?? st.spacing, endA: r.endA, endB: r.endB, cyclic: r.cyclic, sgn, ch, counter });
}

// ===================== 踏跺 =====================
const STAIR_MATS = {
  marble: { step: 'pf_step_m', side: 'marble', cd: 'marble', xy: 'marble' },
  stone: { step: 'pf_step_s', side: 'pf_qingbai', cd: 'pf_qingbai', xy: 'pf_qingbai' },
  brick: { step: 'pf_step_s', side: 'pf_qingbai', cd: 'pf_qingbai', xy: 'brick_grey' },
};
export const chuidaiWidth = (h, style) => (style === 'brick' ? 0.4 : clamp(0.32 + 0.12 * h, 0.42, 0.75));

/**
 * 踏跺（台阶）。局部坐标：台阶中线在 x=0，台阶自 z=0（台基边缘）向 +Z 方向下行，长 run；顶 y=h，底 y=0。
 * 调用方用 ctx.at(...) 定位/旋转。
 * opts: w 宽（不含垂带）; h 高; run 水平进深（默认 h/0.5，即踏步前沿连线 1:2）; style 'marble'|'stone'|'brick';
 *   chuidai 是否两侧垂带（默认 true）; chuidaiW 垂带宽（默认随高 0.42~0.75）;
 *   yulu {w} 中间御路石（雕龙御路，皇帝专用；true 时宽 0.45w）;
 *   railings 两侧斜栏杆（true 或 {style, height, topPost, inset}）：沿垂带中线，顶端自 z=-inset（与台上栏杆对位）起，下端抱鼓石；
 *     topPost 顶端望柱（默认 true；与台上栏杆缺口端柱重合时传 false，buildPlatform 会自动处理）。
 * 返回 { w, cw, run, n, total }（total = 含垂带总宽）
 */
export function buildStairs(ctx, opts) {
  const { w, h } = opts;
  const run = opts.run ?? h / 0.5;
  const n = Math.max(2, Math.round(h / 0.15));
  const r = h / n, t = run / n, sl = h / run;
  const style = STAIR_MATS[opts.style] ? opts.style : 'marble';
  const M = STAIR_MATS[style];
  const cd = opts.chuidai !== false;
  const cw = cd ? opts.chuidaiW ?? chuidaiWidth(h, style) : 0;
  const yw = opts.yulu ? Math.min(w * 0.8, opts.yulu.w ?? w * 0.45) : 0;
  const steps = new GB(), sides = new GB();
  const flights = yw > 0 ? [[-w / 2, -yw / 2], [yw / 2, w / 2]] : [[-w / 2, w / 2]];
  for (const [x0, x1] of flights) {
    for (let k = 1; k <= n - 1; k++) {
      const yt = h - k * r, za = (k - 1) * t, zb = k * t, ylo = k === n - 1 ? 0 : yt - r;
      const o = (k * 0.61) % 1.6;
      steps.quad([x0, yt, zb], [x1, yt, zb], [x1, yt, za - 0.002], [x0, yt, za - 0.002], [0, 1, 0], [[x0 + o, 1], [x1 + o, 1], [x1 + o, 0.5], [x0 + o, 0.5]]);
      steps.quad([x0, ylo, zb], [x1, ylo, zb], [x1, yt, zb], [x0, yt, zb], [0, 0, 1], [[x0 + o, 0], [x1 + o, 0], [x1 + o, 0.5], [x0 + o, 0.5]]);
    }
    if (!cd) {
      const prof = [[0, 0], [(n - 1) * t, 0]];
      for (let k = n - 1; k >= 1; k--) { prof.push([k * t, h - k * r], [(k - 1) * t, h - k * r]); }
      const tris = THREE.ShapeUtils.triangulateShape(prof.map(([z, yy]) => new THREE.Vector2(z, yy)), []);
      for (const [x, sg] of [[x0, -1], [x1, 1]]) {
        if (yw > 0 && Math.abs(x) < yw / 2 + 1e-6) continue;
        for (const tr of tris) {
          const P3 = tr.map((i) => [x, prof[i][1], prof[i][0]]);
          sides.poly(P3, [sg, 0, 0], (p) => [p[2], p[1]]);
        }
      }
    }
  }
  ctx.add(M.step, steps.geo());
  if (!sides.empty) ctx.add(M.side, sides.geo());
  // 御路石
  if (yw > 0) {
    const e2 = 0.03, yAt = (z) => h - ((h - e2) * z) / run;
    const L = Math.hypot(run, h - e2), seaL = Math.min(L * 0.3, yw * 0.55), zs = run * (1 - seaL / L);
    const tiles = Math.max(1, Math.round((L - seaL) / (yw * 2)));
    const nl = Math.hypot(run, h - e2), N = [0, run / nl, (h - e2) / nl];
    const x0 = -yw / 2, x1 = yw / 2;
    const top = new GB();
    top.quad([x0, yAt(zs), zs], [x1, yAt(zs), zs], [x1, h, 0], [x0, h, 0], N, [[0, 0], [1, 0], [1, tiles], [0, tiles]]);
    ctx.add('pf_yulu', top.geo());
    const sea = new GB();
    sea.quad([x0, yAt(run), run], [x1, yAt(run), run], [x1, yAt(zs), zs], [x0, yAt(zs), zs], N, [[0, 0], [1, 0], [1, 1], [0, 1]]);
    ctx.add('pf_yulu_sea', sea.geo());
    const side = new GB();
    for (const [x, sg] of [[x0, -1], [x1, 1]]) side.poly([[x, 0, 0], [x, h, 0], [x, e2, run], [x, 0, run]], [sg, 0, 0], (p) => [p[2], p[1]]);
    side.quad([x0, 0, run], [x1, 0, run], [x1, e2, run], [x0, e2, run], [0, 0, 1]);
    ctx.add(M.side, side.geo());
  }
  // 垂带 + 象眼
  if (cd) {
    const tv = clamp(r * 1.8, 0.2, 0.36);
    const zb = (run * (h - tv)) / h;
    const band = new GB(), xy = new GB();
    for (const sg of [-1, 1]) {
      const xi = (sg * w) / 2, xo = sg * (w / 2 + cw);
      const A = (x) => [x, h, 0], B = (x) => [x, 0, run], D = (x) => [x, h - tv, 0], Cc = (x) => [x, 0, zb];
      band.poly([A(xi), A(xo), B(xo), B(xi)], [0, run / Math.hypot(run, h), h / Math.hypot(run, h)], (p) => [p[0], p[2] * Math.hypot(1, sl)]);
      band.poly([A(xo), D(xo), Cc(xo), B(xo)], [sg, 0, 0], (p) => [p[2], p[1]]);
      band.poly([A(xi), D(xi), Cc(xi), B(xi)], [-sg, 0, 0], (p) => [p[2], p[1]]);
      const xr = xo - sg * 0.035;
      xy.poly([[xr, -0.02, 0], [xr, h - tv, 0], [xr, -0.02, zb + 0.02 * run / h]], [sg, 0, 0], (p) => [p[2], p[1]]);
      // 象眼退进处的垂带底面
      band.poly([D(xr), D(xo), Cc(xo), Cc(xr)], [0, -1, 0], (p) => [p[0], p[2]]);
    }
    ctx.add(M.cd, band.geo());
    ctx.add(M.xy, xy.geo());
  }
  // 斜栏杆
  if (opts.railings) {
    const ro = opts.railings === true ? {} : opts.railings;
    const st = RAILING_STYLES[ro.style || opts.railStyle] || (style === 'marble' ? RAILING_STYLES.marble_dragon : RAILING_STYLES.stone);
    const H = ro.height ?? st.H, s = H / RH0;
    const inset = ro.inset ?? RAIL_INSET;
    const counter = { n: 1 };
    for (const sg of [-1, 1]) {
      const x = sg * (w / 2 + Math.max(cw, DF_W * s) / 2);
      const pts = inset > 0.01 ? [[x, h, -inset], [x, h, 0], [x, 0, run]] : [[x, h, 0], [x, 0, run]];
      railRun(ctx, pts, { s, st, spacing: ro.postSpacing ?? st.spacing, endA: ro.topPost === false ? 'none' : 'post', endB: 'drum', cyclic: false, sgn: 1, ch: null, counter });
    }
  }
  return { w, cw, run, n, total: w + 2 * cw };
}

// ===================== 台基总装 =====================
/**
 * 台基（台明）。
 * opts: poly 或 (w,d 以原点为中心的矩形); y0 底面高度(默认0); h 台基高;
 *   style: 'plain'（砖砌台帮+土衬石+角柱石+阶条石）| 'stone'（青白石陡板台帮）| 'xumizuo'（汉白玉须弥座）| 'xumizuo_brick'（砖须弥座）
 *   edgeW 阶条石/顶面边石宽（默认 plain/stone 0.45，须弥座 0.55）; floor 台面铺装材质（默认 'paving_square' 方砖；false 不铺，交由建筑自铺地面）;
 *   railing: 台上栏杆（true 或 buildRailing 的 opts 子集：{style, height, postSpacing, chishou, inset(默认0.3), gaps}），沿台边内收 inset 闭合布置；
 *   stairs: [{ at:[x,z], ...buildStairs opts }]：踏跺自距 at 最近的台边中点（垂足）向外下行，自动在栏杆上开口；可另给 h/run。
 * 顶面 y = y0 + h。返回 { top, poly（逆时针）, railPath, stairs:[{x,z,rotY,total}] }
 */
export function buildPlatform(ctx, opts) {
  const y0 = opts.y0 ?? 0, h = opts.h;
  const raw = opts.poly || [[-opts.w / 2, -opts.d / 2], [opts.w / 2, -opts.d / 2], [opts.w / 2, opts.d / 2], [-opts.w / 2, opts.d / 2]];
  const P = cleanPoly(raw);
  const top = y0 + h;
  const style = opts.style || 'plain';
  const xumi = style === 'xumizuo' || style === 'xumizuo_brick';
  const ew = opts.edgeW ?? (xumi ? 0.55 : 0.45);
  if (xumi) buildXumizuo(ctx, P, y0, h, { brick: style === 'xumizuo_brick', edgeW: ew, tuchen: opts.tuchen });
  else {
    const tH = Math.min(0.1, 0.12 * h), jH = Math.min(0.16, 0.22 * h), wd = -0.025, wall = style === 'stone' ? 'pf_doban' : 'brick_grey';
    const parts = [];
    if (opts.tuchen !== false) parts.push({ mat: 'pf_qingbai', pts: [[0.06, y0 - 0.03], [0.06, y0 + tH], [wd, y0 + tH]] });
    parts.push({ mat: wall, pts: [[wd, y0 + (opts.tuchen !== false ? tH : -0.03)], [wd, top - jH]] });
    parts.push({ mat: 'pf_qingbai', pts: [[wd, top - jH], [0, top - jH], [0, top], [-ew, top]] });
    extrudeProfile(ctx, P, parts);
    cornerStones(ctx, P, y0 + tH, top - jH, wd, Math.min(0.42, 0.3 + 0.1 * h), 'pf_qingbai');
  }
  if (opts.floor !== false) {
    const inner = offsetPoly(P, -ew);
    ctx.add(opts.floor || 'paving_square', polyTopGeo(inner, top));
  }
  const E = edgesOf(P);
  const res = { top, poly: P, railPath: null, stairs: [] };
  const rOpt = opts.railing ? (opts.railing === true ? {} : opts.railing) : null;
  const rStyle = rOpt ? rOpt.style || (style === 'xumizuo' ? 'marble' : 'stone') : null;
  const rs = rOpt ? (rOpt.height ?? (RAILING_STYLES[rStyle] || RAILING_STYLES.marble).H) / RH0 : 1;
  const inset = rOpt ? rOpt.inset ?? RAIL_INSET : 0;
  const gaps = rOpt ? [...(rOpt.gaps || [])] : [];
  for (const st of opts.stairs || []) {
    const q = st.at || [0, 1e6];
    let best = null;
    for (const e of E) {
      const tt = clamp(((q[0] - e.a[0]) * e.dir[0] + (q[1] - e.a[1]) * e.dir[1]) / e.L, 0, 1);
      const f = [e.a[0] + e.dir[0] * e.L * tt, e.a[1] + e.dir[1] * e.L * tt], d = Math.hypot(q[0] - f[0], q[1] - f[1]);
      if (!best || d < best.d) best = { d, e, f };
    }
    const rot = Math.atan2(best.e.n[0], best.e.n[1]);
    const sh = st.h ?? h;
    const sOpts = { ...st, h: sh, style: st.style || (style === 'xumizuo' ? 'marble' : style === 'xumizuo_brick' ? 'stone' : 'stone') };
    if (st.railings) sOpts.railings = { style: rStyle || undefined, height: rOpt?.height, inset: rOpt ? inset : 0, topPost: !rOpt, ...(st.railings === true ? {} : st.railings) };
    const sr = buildStairs(ctx.at(best.f[0], top - sh, best.f[1], rot), sOpts);
    res.stairs.push({ x: best.f[0], z: best.f[1], rotY: rot, total: sr.total });
    if (rOpt) {
      const sRail = !!st.railings;
      const halfW = sRail ? st.w / 2 + Math.max(sr.cw, DF_W * rs) / 2 : st.w / 2 + sr.cw + 0.05;
      gaps.push({ at: [best.f[0] - best.e.n[0] * inset, best.f[1] - best.e.n[1] * inset], w: 2 * halfW, end: sRail ? 'post' : 'drum' });
    }
  }
  if (rOpt) {
    const path = offsetPoly(P, -inset);
    res.railPath = path;
    buildRailing(ctx, {
      path, y: top, closed: true, style: rStyle, height: rOpt.height, postSpacing: rOpt.postSpacing, gaps,
      chishou: rOpt.chishou ? { edge: inset, ...(rOpt.chishou === true ? {} : rOpt.chishou) } : false,
    });
  }
  return res;
}
