// 墙垣与墙门：宫墙、紫禁城城墙（垛口/宇墙/马道）、城台（券门洞）、琉璃门、随墙门、垂花门、影壁。
//
// 截面挤出约定（本文件内部）：path=[[x,z],...]，截面坐标 (o, y)，o 为横向偏移，+o 指向行进方向右手侧 n=(dz,-dx)
//   （按 x→东、z→南 的“先北边自西向东”顺序绕行的闭合路径，+o 即外侧）；截面逆时针书写：+o 侧自下而上、顶部自 +o 到 -o、-o 侧自上而下。
// 原型：'wl_duo:<mat>' 城墙垛（x 沿墙、+Z 向城外、y=0 为垛口底）；'wl_spout' 吐水嘴（+Z 伸出）；'wl_dg:<色>' 琉璃斗拱（单位=斗口，+Z 向外）。
import * as THREE from 'three';
import { boxGeo, cylGeo, latheGeo, polyTopGeo, fromArrays, merge, mergeColored, paint, clamp } from './geom.js';
import { defineMaterial } from './materials.js';
import { registerTexture, canvas, rng } from './textures.js';
import { registerProtoFamily } from './protos.js';
import { buildRoof } from './roof.js';
import './ornaments.js';

const TAU = Math.PI * 2;
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ======================= 纹理与材质 =======================
const PAL = {
  yellow: { b: [228, 160, 38], d: [112, 60, 8], l: [255, 226, 140] },
  green: { b: [46, 128, 72], d: [10, 44, 22], l: [134, 208, 142] },
  blue: { b: [44, 84, 164], d: [10, 22, 62], l: [126, 166, 236] },
  black: { b: [46, 46, 52], d: [8, 8, 10], l: [124, 124, 134] },
  grey: { b: [122, 122, 120], d: [48, 48, 48], l: [172, 172, 166] },
  brick: { b: [134, 134, 130], d: [72, 72, 70], l: [186, 186, 180] },
};
const css = (c, f = 1) => `rgb(${c.map((v) => Math.round(clamp(v * f, 0, 255))).join(',')})`;
const grad = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [t, c] of stops) gr.addColorStop(t, c); return gr; };

/** 勾头滴水：u 周期 1.2m（4 垄，勾头位于垄中，与 tile_* 筒瓦对齐），v 0..1 */
function eaveTex(col) {
  return () => {
    const P = PAL[col], W = 256, H = 64, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = css(P.d, 0.55); g.fillRect(0, 0, W, H);
    for (let k = 0; k <= 4; k++) {
      const x = k * 64;
      g.fillStyle = grad(g, 0, 2, 0, 62, [[0, css(P.l)], [0.3, css(P.b)], [1, css(P.d, 1.1)]]);
      g.beginPath(); g.moveTo(x - 28, 2); g.lineTo(x + 28, 2); g.lineTo(x + 28, 26);
      g.bezierCurveTo(x + 25, 44, x + 9, 52, x, 62); g.bezierCurveTo(x - 9, 52, x - 25, 44, x - 28, 26); g.closePath(); g.fill();
      g.strokeStyle = css(P.d, 0.95); g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x - 20, 28); g.bezierCurveTo(x - 16, 42, x - 6, 49, x, 53); g.bezierCurveTo(x + 6, 49, x + 16, 42, x + 20, 28); g.stroke();
    }
    for (let k = 0; k < 4; k++) {
      const x = 32 + k * 64, y = 24, r = 21;
      g.fillStyle = css(P.d, 0.45); g.beginPath(); g.arc(x + 2, y + 3, r, 0, TAU); g.fill();
      const gr = g.createRadialGradient(x - 7, y - 8, 2, x, y, r);
      gr.addColorStop(0, css(P.l)); gr.addColorStop(0.55, css(P.b)); gr.addColorStop(1, css(P.d, 1.25));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = css(P.d); g.lineWidth = 2; g.beginPath(); g.arc(x, y, r - 5, 0, TAU); g.stroke();
      g.fillStyle = css(P.l, 0.95); g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill();
      for (let j = 0; j < 8; j++) { const a = (j * TAU) / 8; g.beginPath(); g.arc(x + Math.cos(a) * 11, y + Math.sin(a) * 11, 2.2, 0, TAU); g.fill(); }
    }
    return c;
  };
}

/** 椽头带（上方飞椽方头 + 下方檐椽圆头）：u 周期 1.2m（8 椽），v 0..1 */
function rafterTex(col) {
  return () => {
    const P = PAL[col], W = 256, H = 64, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = css(P.d, 0.42); g.fillRect(0, 0, W, H);
    for (let k = 0; k < 8; k++) {
      const x = 16 + k * 32;
      g.fillStyle = grad(g, 0, 3, 0, 29, [[0, css(P.l)], [1, css(P.b, 0.85)]]);
      g.fillRect(x - 10, 3, 20, 25);
      g.fillStyle = css(P.d, 0.8); g.fillRect(x - 10, 26, 20, 2);
      const gr = g.createRadialGradient(x - 3, 42, 1, x, 46, 12);
      gr.addColorStop(0, css(P.l)); gr.addColorStop(1, css(P.b, 0.78));
      g.fillStyle = gr; g.beginPath(); g.arc(x, 46, 11, 0, TAU); g.fill();
    }
    return c;
  };
}

/** 马道城砖（0.48×0.24 m 错缝），周期 1.92 m */
function madaoTex() {
  const S = 256, c = canvas(S), g = c.getContext('2d'), r = rng(41);
  g.fillStyle = '#8f8b82'; g.fillRect(0, 0, S, S);
  const tint = Array.from({ length: 8 }, () => Array.from({ length: 4 }, () => 0.84 + r() * 0.22));
  for (let row = 0; row < 8; row++) for (let k = -1; k < 4; k++) {
    const x = k * 64 + (row % 2) * 32, y = row * 32;
    g.fillStyle = css([122, 119, 112], tint[row][(k + 4) % 4]);
    g.fillRect(x + 1.5, y + 1.5, 61, 29);
  }
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) { const n = (r() - 0.5) * 10; for (let k = 0; k < 3; k++) img.data[i * 4 + k] = clamp(img.data[i * 4 + k] + n, 0, 255); }
  g.putImageData(img, 0, 0);
  return c;
}

/** 琉璃额枋（旋子纹，绿地黄线），u 周期 1.6 m，v 0..1 */
function glzBeamTex() {
  const W = 512, H = 64, c = canvas(W, H), g = c.getContext('2d');
  const G = PAL.green, Y = PAL.yellow, B = PAL.blue;
  g.fillStyle = css(G.b); g.fillRect(0, 0, W, H);
  g.fillStyle = grad(g, 0, 0, 0, H, [[0, css(G.l, 0.9)], [0.5, css(G.b)], [1, css(G.d, 1.4)]]); g.fillRect(0, 8, W, H - 16);
  g.fillStyle = css(Y.b); g.fillRect(0, 0, W, 7); g.fillRect(0, H - 7, W, 7);
  g.fillStyle = css(Y.d); g.fillRect(0, 7, W, 2); g.fillRect(0, H - 9, W, 2);
  for (let k = 0; k < 2; k++) {
    const cx = 128 + k * 256, cy = 32;
    g.fillStyle = css(Y.b); g.fillRect(cx + 122, 9, 8, H - 18); g.fillRect(cx - 130, 9, 8, H - 18);
    g.lineWidth = 3.5; g.strokeStyle = css(Y.b);
    g.beginPath(); g.ellipse(cx, cy, 78, 20, 0, 0, TAU); g.stroke();
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU + Math.PI / 6;
      const px = cx + Math.cos(a) * 50, py = cy + Math.sin(a) * 11;
      g.fillStyle = css(B.b); g.beginPath(); g.ellipse(px, py, 13, 7, 0, 0, TAU); g.fill();
      g.strokeStyle = css(Y.l); g.lineWidth = 2; g.stroke();
    }
    g.fillStyle = css(Y.b); g.beginPath(); g.ellipse(cx, cy, 14, 9, 0, 0, TAU); g.fill();
    g.fillStyle = css(Y.l); g.beginPath(); g.arc(cx - 3, cy - 2, 4, 0, TAU); g.fill();
  }
  return c;
}

function leaf(g, r0, r1, w, P) {
  g.fillStyle = grad(g, r0, 0, r1, 0, [[0, css(P.d, 1.3)], [0.4, css(P.b)], [1, css(P.l)]]);
  g.beginPath(); g.moveTo(r0, 0); g.bezierCurveTo(r0 + (r1 - r0) * 0.3, -w, r1 - (r1 - r0) * 0.25, -w * 0.7, r1, 0);
  g.bezierCurveTo(r1 - (r1 - r0) * 0.25, w * 0.7, r0 + (r1 - r0) * 0.3, w, r0, 0); g.fill();
  g.strokeStyle = css(P.d); g.lineWidth = 2; g.stroke();
  g.beginPath(); g.moveTo(r0 + 4, 0); g.lineTo(r1 - 6, 0); g.stroke();
}
function petal(g, r0, r1, w, P, shade = 1) {
  g.fillStyle = grad(g, r0, 0, r1, 0, [[0, css(P.b, 0.8 * shade)], [0.6, css(P.b, shade)], [1, css(P.l, shade)]]);
  g.beginPath(); g.moveTo(r0, 0); g.bezierCurveTo(r0 + 6, -w, r1 - 4, -w, r1, 0); g.bezierCurveTo(r1 - 4, w, r0 + 6, w, r0, 0); g.fill();
  g.strokeStyle = css(P.d, 1.1); g.lineWidth = 2.5; g.stroke();
}
/** 盒子（宝相花团花），uv 0..1 */
function heziTex(base, leafP, flowP, coreP) {
  return () => {
    const S = 256, c = canvas(S), g = c.getContext('2d'), cx = 128, cy = 128;
    g.fillStyle = css(base.b); g.fillRect(0, 0, S, S);
    g.strokeStyle = css(base.d, 1.1); g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, 120, 0, TAU); g.stroke();
    g.strokeStyle = css(base.l); g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 110, 0, TAU); g.stroke();
    for (let k = 0; k < 8; k++) { g.save(); g.translate(cx, cy); g.rotate(((k + 0.5) * TAU) / 8); leaf(g, 30, 104, 22, leafP); g.restore(); }
    for (let k = 0; k < 8; k++) { g.save(); g.translate(cx, cy); g.rotate((k * TAU) / 8); petal(g, 18, 88, 26, flowP); g.restore(); }
    for (let k = 0; k < 8; k++) { g.save(); g.translate(cx, cy); g.rotate(((k + 0.5) * TAU) / 8); petal(g, 10, 48, 13, flowP, 1.15); g.restore(); }
    g.fillStyle = css(coreP.b); g.beginPath(); g.arc(cx, cy, 22, 0, TAU); g.fill();
    g.strokeStyle = css(coreP.d); g.lineWidth = 3; g.stroke();
    g.fillStyle = css(base.l); g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill();
    return c;
  };
}
/** 岔角（自左上角放射的卷叶与半朵花），uv：角点在 (0,1) */
function chajiaoTex(base, leafP, flowP, coreP) {
  return () => {
    const S = 256, c = canvas(S), g = c.getContext('2d');
    g.fillStyle = css(base.b); g.fillRect(0, 0, S, S);
    g.strokeStyle = css(base.d, 1.1); g.lineWidth = 8; g.beginPath(); g.arc(0, 0, 236, 0, Math.PI / 2); g.stroke();
    for (const a of [0.12, 0.52, 1.05, 1.45]) { g.save(); g.rotate(a); leaf(g, 40, 205, 30, leafP); g.restore(); }
    for (let k = 0; k <= 4; k++) { g.save(); g.rotate((k / 4) * (Math.PI / 2)); petal(g, 22, 128, 30, flowP); g.restore(); }
    for (let k = 0; k < 4; k++) { g.save(); g.rotate(((k + 0.5) / 4) * (Math.PI / 2)); petal(g, 14, 70, 16, flowP, 1.15); g.restore(); }
    g.fillStyle = css(coreP.b); g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
    g.strokeStyle = css(coreP.d); g.lineWidth = 3; g.stroke();
    return c;
  };
}

/** 方砖斜墁（45°方砖心），周期 0.9 m */
function fangzhuanTex() {
  const S = 256, c = canvas(S), g = c.getContext('2d'), img = g.createImageData(S, S), r = rng(7);
  const tint = [0.95, 1.04, 0.99, 1.07];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = (x + y) / 128, b = (x - y + 256) / 128;
    const fa = a % 1, fb = b % 1;
    const e = Math.min(fa, 1 - fa, fb, 1 - fb) * 90.5;
    const i = (y * S + x) * 4;
    let col;
    if (e < 1.4) col = [178, 175, 167];
    else { const t = tint[(Math.floor(a) & 1) + 2 * (Math.floor(b) & 1)] * (1 + (r() - 0.5) * 0.05); col = [128 * t, 128 * t, 124 * t]; if (e < 3) col = col.map((v) => v * 0.92); }
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** 垂花门骑马雀替（镂空，带透明通道） */
function huazhaoTex() {
  const W = 256, H = 128, c = canvas(W, H), g = c.getContext('2d');
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, 124);
  g.bezierCurveTo(W - 34, 120, W - 54, 58, W / 2 + 34, 44); g.lineTo(W / 2, 56); g.lineTo(W / 2 - 34, 44);
  g.bezierCurveTo(54, 58, 34, 120, 0, 124); g.closePath();
  g.fillStyle = css(PAL.green.b, 0.9); g.fill();
  g.save(); g.clip();
  g.fillStyle = '#d4a640'; g.fillRect(0, 0, W, 9);
  g.strokeStyle = '#d4a640'; g.lineWidth = 5;
  for (let k = 0; k < 8; k++) {
    const x = 16 + k * 32;
    g.beginPath(); g.arc(x, 28, 12, Math.PI * 0.2, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.arc(x + (k < 4 ? -3 : 3), 28, 5, 0, TAU); g.stroke();
  }
  g.strokeStyle = '#b8352a'; g.lineWidth = 6;
  for (const s of [1, -1]) {
    const x0 = s > 0 ? 20 : W - 20;
    g.beginPath(); g.moveTo(x0, 46); g.bezierCurveTo(x0 + s * 30, 60, x0 + s * 10, 96, x0 + s * 2, 112); g.stroke();
    g.beginPath(); g.arc(x0 + s * 18, 78, 14, 0, TAU); g.stroke();
  }
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(16 + k * 32, 28, 6.5, 0, TAU); g.fill(); }
  for (const s of [1, -1]) {
    const x0 = s > 0 ? 20 : W - 20;
    g.beginPath(); g.arc(x0 + s * 18, 78, 8, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x0 + s * 6, 60, 6, 9, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(x0 + s * 8, 100, 4, 8, 0, 0, TAU); g.fill();
  }
  g.restore();
  return c;
}

/** 折柱花板（蓝地彩花），uv 0..1 */
function flowerBoardTex() {
  const S = 128, c = canvas(S), g = c.getContext('2d');
  g.fillStyle = '#2b5594'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#d4a640'; g.lineWidth = 8; g.strokeRect(4, 4, S - 8, S - 8);
  g.translate(64, 64);
  for (let k = 0; k < 4; k++) { g.save(); g.rotate((k + 0.5) * TAU / 4); leaf(g, 16, 50, 12, PAL.green); g.restore(); }
  for (let k = 0; k < 5; k++) { g.save(); g.rotate((k * TAU) / 5); petal(g, 6, 30, 14, { b: [200, 54, 48], d: [110, 20, 20], l: [250, 170, 160] }); g.restore(); }
  g.fillStyle = '#f0c850'; g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.fill();
  return c;
}

/** 正脊侧面（下当沟、上脊筒接缝），u 周期 1.2m，v 0..1 */
function ridgeTex(col) {
  return () => {
    const P = PAL[col], W = 256, H = 64, c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = grad(g, 0, 0, 0, H, [[0, css(P.l)], [0.35, css(P.b)], [0.62, css(P.b, 0.92)], [1, css(P.d, 1.6)]]); g.fillRect(0, 0, W, H);
    g.fillStyle = css(P.d, 0.9); g.fillRect(0, 24, W, 2); g.fillRect(0, 40, W, 2);
    for (const x of [0, 128]) { g.fillRect(x - 1, 0, 2.5, 40); g.fillRect(x + 255, 0, 2.5, 40); }
    for (let k = 0; k <= 4; k++) { // 当沟：垄间小瓦
      const x = k * 64;
      g.fillStyle = css(P.b, 1.05); g.beginPath(); g.moveTo(x - 22, 64); g.lineTo(x - 22, 50); g.quadraticCurveTo(x, 40, x + 22, 50); g.lineTo(x + 22, 64); g.fill();
      g.strokeStyle = css(P.d, 0.9); g.lineWidth = 2; g.stroke();
    }
    return c;
  };
}

const glazeDef = (map, period) => ({ color: 0xffffff, map, roughness: 0.36, envMapIntensity: 1.1, period });
const GLZ = { yellow: 0xd99a1e, green: 0x2f7d4a, blue: 0x2a4f9a, black: 0x1c1c22, grey: 0x6d6f72 };
for (const col of ['yellow', 'green', 'blue', 'black', 'grey']) {
  registerTexture(`wl_ridge_${col}`, ridgeTex(col));
  defineMaterial(`wl_ridge_${col}`, { ...glazeDef(`wl_ridge_${col}`, [1.2, 1]), roughness: col === 'grey' ? 0.8 : 0.34 });
  defineMaterial(`wl_glzm_${col}`, { color: GLZ[col], roughness: 0.62, envMapIntensity: 0.7 });
  registerTexture(`wl_eave_${col}`, eaveTex(col));
  registerTexture(`wl_rafter_${col}`, rafterTex(col));
  defineMaterial(`wl_eave_${col}`, { ...glazeDef(`wl_eave_${col}`, [1.2, 1]), roughness: col === 'grey' ? 0.8 : 0.36 });
  defineMaterial(`wl_rafter_${col}`, { ...glazeDef(`wl_rafter_${col}`, [1.2, 1]), roughness: col === 'grey' ? 0.85 : 0.4 });
}
registerTexture('wl_madao', madaoTex);
registerTexture('wl_glzbeam', glzBeamTex);
registerTexture('wl_hezi', heziTex(PAL.yellow, PAL.green, PAL.yellow, PAL.blue));
registerTexture('wl_chajiao', chajiaoTex(PAL.yellow, PAL.green, PAL.yellow, PAL.blue));
registerTexture('wl_hezi_b', heziTex(PAL.brick, PAL.brick, PAL.brick, PAL.brick));
registerTexture('wl_chajiao_b', chajiaoTex(PAL.brick, PAL.brick, PAL.brick, PAL.brick));
registerTexture('wl_fangzhuan', fangzhuanTex);
registerTexture('wl_huazhao', huazhaoTex);
registerTexture('wl_flowerboard', flowerBoardTex);
defineMaterial('wl_madao', { color: 0xffffff, map: 'wl_madao', roughness: 0.95, period: [1.92, 1.92] });
defineMaterial('wl_glzbeam', glazeDef('wl_glzbeam', [1.6, 1]));
defineMaterial('wl_hezi', glazeDef('wl_hezi'));
defineMaterial('wl_chajiao', glazeDef('wl_chajiao'));
defineMaterial('wl_hezi_b', { color: 0xffffff, map: 'wl_hezi_b', roughness: 0.88 });
defineMaterial('wl_chajiao_b', { color: 0xffffff, map: 'wl_chajiao_b', roughness: 0.88 });
defineMaterial('wl_fangzhuan', { color: 0xffffff, map: 'wl_fangzhuan', roughness: 0.9, period: [0.9, 0.9] });
defineMaterial('wl_huazhao', { color: 0xffffff, map: 'wl_huazhao', roughness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide, noShadow: true });
defineMaterial('wl_flowerboard', { color: 0xffffff, map: 'wl_flowerboard', roughness: 0.6 });
defineMaterial('wl_hole', { color: 0x17120e, roughness: 1 });

// ======================= 几何工具 =======================
class GB {
  constructor() { this.pos = []; this.nor = []; this.uv = []; }
  push(p, n, t) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(t[0], t[1]); }
  /** 三角形；want 给定时按其校正绕向；nor 为单一法线或三顶点法线 */
  tri(a, b, c, nor, ta, tb, tc, want) {
    let ns = Array.isArray(nor[0]) ? nor : [nor, nor, nor];
    if (want && dot3(cross3(sub3(b, a), sub3(c, a)), want) < 0) { [b, c] = [c, b]; [tb, tc] = [tc, tb]; ns = [ns[0], ns[2], ns[1]]; }
    this.push(a, ns[0], ta); this.push(b, ns[1], tb); this.push(c, ns[2], tc);
  }
  /** 平面四边形 o, o+U, o+U+V, o+V（法线 U×V），UV 为在 U/V 方向的投影（米）；uv01 时为 0..1 */
  quad(o, U, V, uv01 = false) {
    const n = norm3(cross3(U, V)), uh = norm3(U), vh = norm3(V);
    const p = [o, add3(o, U), add3(add3(o, U), V), add3(o, V)];
    const t = uv01 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : p.map((q) => [dot3(q, uh), dot3(q, vh)]);
    for (const k of [0, 1, 2, 0, 2, 3]) this.push(p[k], n, t[k]);
    return this;
  }
  /** 四点任意四边形（p0..p3 顺序），按 want 校正绕向，nor 为四顶点法线 */
  quad4(p, nor, t, want) {
    this.tri(p[0], p[1], p[2], [nor[0], nor[1], nor[2]], t[0], t[1], t[2], want);
    this.tri(p[0], p[2], p[3], [nor[0], nor[2], nor[3]], t[0], t[2], t[3], want);
  }
  /** 轴对齐盒，skip 如 '-y+z' 省略对应面 */
  box(x0, y0, z0, x1, y1, z1, skip = '') {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    if (!skip.includes('+x')) this.quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0]);
    if (!skip.includes('-x')) this.quad([x0, y0, z0], [0, 0, dz], [0, dy, 0]);
    if (!skip.includes('+z')) this.quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0]);
    if (!skip.includes('-z')) this.quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0]);
    if (!skip.includes('+y')) this.quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz]);
    if (!skip.includes('-y')) this.quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz]);
    return this;
  }
  get empty() { return this.pos.length === 0; }
  geo() { return fromArrays(this.pos, this.uv, this.nor); }
}

/** 平面多边形面：poly 为二维点，map 映射到三维，want 期望法线 */
function polyFace(gb, poly, map, want, uvf = (p) => p) {
  const tris = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const n = norm3(want);
  for (const t of tris) {
    const [a, b, c] = t.map((i) => poly[i]);
    gb.tri(map(a), map(b), map(c), n, uvf(a), uvf(b), uvf(c), want);
  }
}

/** 折线标架：每段方向 D、右手法线 N、长度 L、累计长 U，每顶点斜接向量 M（M·o 即偏移 o 处的点） */
function frames(path, closed) {
  const P = [];
  for (const p of path) { const q = P[P.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) P.push([p[0], p[1]]); }
  if (closed && P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-4) P.pop();
  const n = P.length, sc = closed ? n : n - 1;
  if (n < 2 || sc < 1) return null;
  const D = [], N = [], L = [], U = [0];
  for (let i = 0; i < sc; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1e-9;
    D.push([dx / l, dz / l]); N.push([dz / l, -dx / l]); L.push(l); U.push(U[i] + l);
  }
  const M = [];
  for (let i = 0; i < n; i++) {
    const na = closed ? N[(i - 1 + sc) % sc] : N[Math.max(0, i - 1)];
    const nb = closed ? N[i % sc] : N[Math.min(sc - 1, i)];
    let bx = na[0] + nb[0], bz = na[1] + nb[1];
    const bl = Math.hypot(bx, bz);
    if (bl < 1e-6) { M.push(nb); continue; }
    bx /= bl; bz /= bl;
    const c = Math.max(0.25, bx * na[0] + bz * na[1]);
    M.push([bx / c, bz / c]);
  }
  return { P, D, N, L, M, U, n, sc };
}

/** 截面一段的 v 坐标：'y' 竖直米 | 'o' 横向米 | 'slope' 自低端起的坡长 | 'band' 0..1 */
function segV(s) {
  const q = s.p, k = q.length, cum = [0];
  for (let j = 1; j < k; j++) cum.push(cum[j - 1] + Math.hypot(q[j][0] - q[j - 1][0], q[j][1] - q[j - 1][1]));
  const L = cum[k - 1];
  if (s.v === 'o') return q.map((p) => p[0]);
  if (s.v === 'slope') return q[0][1] <= q[k - 1][1] ? cum : cum.map((c) => L - c);
  if (s.v === 'band') {
    const ys = q.map((p) => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi - lo > 1e-4) return ys.map((y) => (y - lo) / (hi - lo));
    const os = q.map((p) => p[0]), a = Math.min(...os), b = Math.max(...os);
    return os.map((o) => (o - a) / (b - a || 1));
  }
  return q.map((p) => p[1]);
}

/**
 * 沿折线挤出截面。segs=[{p:[[o,y],...], mat, v}]（逆时针截面上的若干段，可不闭合）；
 * caps=[{poly, mat}] 开放路径两端封面。每段平面着色，转角斜接，u = 沿路径米（各段对齐檐口方向）。
 */
function extrude(ctx, path, segs, { closed = false, caps = null } = {}) {
  const F = frames(path, closed);
  if (!F) return;
  const out = new Map();
  const B = (m) => { let b = out.get(m); if (!b) out.set(m, (b = new GB())); return b; };
  for (const s of segs) {
    const q = s.p;
    if (q.length < 2) continue;
    const vs = segV(s), gb = B(s.mat);
    for (let j = 0; j < q.length - 1; j++) {
      const [o1, y1] = q[j], [o2, y2] = q[j + 1];
      const dO = o2 - o1, dY = y2 - y1, el = Math.hypot(dO, dY);
      if (el < 1e-6) continue;
      const pn0 = dY / el, pn1 = -dO / el;
      for (let i = 0; i < F.sc; i++) {
        const i2 = (i + 1) % F.n;
        const Pa = F.P[i], Pb = F.P[i2], Ma = F.M[i], Mb = F.M[i2], d = F.D[i], nn = F.N[i];
        const A = [Pa[0] + Ma[0] * o1, y1, Pa[1] + Ma[1] * o1];
        const Bq = [Pb[0] + Mb[0] * o1, y1, Pb[1] + Mb[1] * o1];
        const C = [Pb[0] + Mb[0] * o2, y2, Pb[1] + Mb[1] * o2];
        const Dq = [Pa[0] + Ma[0] * o2, y2, Pa[1] + Ma[1] * o2];
        const u = (X) => F.U[i] + (X[0] - Pa[0]) * d[0] + (X[2] - Pa[1]) * d[1];
        const nor = [nn[0] * pn0, pn1, nn[1] * pn0];
        const tA = [u(A), vs[j]], tB = [u(Bq), vs[j]], tC = [u(C), vs[j + 1]], tD = [u(Dq), vs[j + 1]];
        gb.push(A, nor, tA); gb.push(Dq, nor, tD); gb.push(C, nor, tC);
        gb.push(A, nor, tA); gb.push(C, nor, tC); gb.push(Bq, nor, tB);
      }
    }
  }
  if (caps && !closed) {
    for (const end of [0, 1]) {
      const P0 = F.P[end ? F.n - 1 : 0], si = end ? F.sc - 1 : 0;
      const nn = F.N[si], d = F.D[si];
      const want = end ? [d[0], 0, d[1]] : [-d[0], 0, -d[1]];
      const at = (o, y, e = 0) => [P0[0] + nn[0] * o + want[0] * e, y, P0[1] + nn[1] * o + want[2] * e];
      for (const cp of caps) {
        if (!cp.strip) { polyFace(B(cp.mat), cp.poly, ([o, y]) => at(o, y), want, ([o, y]) => [end ? -o : o, y]); continue; }
        // 条带：沿折线向下宽 cp.w，略凸出端面（排山勾滴等）
        let acc = 0;
        for (let j = 0; j < cp.strip.length - 1; j++) {
          const [oa, ya] = cp.strip[j], [ob, yb] = cp.strip[j + 1], l = Math.hypot(ob - oa, yb - ya);
          B(cp.mat).quad4([at(oa, ya, 0.008), at(ob, yb, 0.008), at(ob, yb - cp.w, 0.008), at(oa, ya - cp.w, 0.008)], [want, want, want, want], [[acc, 1], [acc + l, 1], [acc + l, 0], [acc, 0]], want);
          acc += l;
        }
      }
    }
  }
  for (const [m, gb] of out) if (!gb.empty) ctx.add(m, gb.geo());
}

/** 镜像截面段（o 取负，顺序反转），用于由 +o 侧生成 -o 侧 */
const mirrorSegs = (S) => S.slice().reverse().map((s) => ({ ...s, p: s.p.slice().reverse().map(([o, y]) => [-o, y]) }));
const mirrorPts = (pts) => pts.slice().reverse().map(([o, y]) => [-o, y]);

/** 按长度缺口把折线切成若干开放段；闭合且无缺口时原样返回 */
function splitRuns(path, closed, gaps) {
  const pts = [];
  for (const p of path) { const q = pts[pts.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) pts.push([p[0], p[1]]); }
  if (closed && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-4) pts.pop();
  if (!gaps || !gaps.length) return [{ pts, closed }];
  const ring = closed ? [...pts, pts[0]] : pts;
  const cum = [0];
  for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
  const T = cum[cum.length - 1];
  let G = [];
  for (const g of gaps) {
    let a = Math.min(g.from, g.to), b = Math.max(g.from, g.to);
    if (closed) { if (a < 0) { G.push([a + T, T]); a = 0; } if (b > T) { G.push([0, b - T]); b = T; } }
    a = clamp(a, 0, T); b = clamp(b, 0, T);
    if (b - a > 1e-3) G.push([a, b]);
  }
  G.sort((p, q) => p[0] - q[0]);
  const M = [];
  for (const g of G) { const l = M[M.length - 1]; if (l && g[0] <= l[1] + 1e-6) l[1] = Math.max(l[1], g[1]); else M.push(g.slice()); }
  G = M;
  if (!G.length) return [{ pts, closed }];
  const keep = [];
  if (closed) for (let i = 0; i < G.length; i++) keep.push([G[i][1], i + 1 < G.length ? G[i + 1][0] : G[0][0] + T]);
  else { let s = 0; for (const g of G) { keep.push([s, g[0]]); s = g[1]; } keep.push([s, T]); }
  const at = (s) => {
    if (closed) s = ((s % T) + T) % T;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [ring[i - 1][0] + (ring[i][0] - ring[i - 1][0]) * t, ring[i - 1][1] + (ring[i][1] - ring[i - 1][1]) * t];
  };
  const runs = [];
  for (const [a, b] of keep) {
    if (b - a < 0.05) continue;
    const out = [at(a)];
    const nv = closed ? ring.length - 1 : ring.length;
    for (let m = 0; m <= (closed ? 1 : 0); m++) for (let i = 0; i < nv; i++) { const s = cum[i] + m * T; if (s > a + 1e-6 && s < b - 1e-6) out.push(ring[i]); }
    out.push(at(b));
    runs.push({ pts: out, closed: false });
  }
  return runs;
}

/** 以原点为中心的矩形闭合路径（N→E→S→W，+o 朝外） */
const rectLoop = (W, D) => [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]];
/** 矩形路径上南北两面的 x 区间缺口（门洞） */
function gapsSN(W, D, xs) {
  const g = [];
  for (const [a, b] of xs) { g.push({ from: a + W / 2, to: b + W / 2 }); g.push({ from: W + D + (W / 2 - b), to: W + D + (W / 2 - a) }); }
  return g;
}

/** 浮雕片：pts 为 (x,y) 轮廓，厚 dep 向 +Z；返回 { front（uvf 映射）, side } */
function relief(pts, dep, uvf) {
  const gf = new GB(), gs = new GB();
  polyFace(gf, pts, ([x, y]) => [x, y, dep], [0, 0, 1], uvf);
  const ccw = !THREE.ShapeUtils.isClockWise(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  const P = ccw ? pts : pts.slice().reverse();
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey);
    if (l < 1e-6) continue;
    gs.quad([a[0], a[1], 0], [ex, ey, 0], [0, 0, dep]);
  }
  return { front: gf.geo(), side: gs.geo() };
}

/** 带矩形通孔的板：x∈[-w/2,w/2], y∈[0,h], z∈[-t/2,t/2]，孔中心 y=hy，宽 hw 高 hh */
function holedSlab(w, h, t, hy, hw, hh) {
  const gb = new GB(), z = t / 2;
  const x0 = -w / 2, x1 = w / 2, a0 = -hw / 2, a1 = hw / 2, b0 = hy - hh / 2, b1 = hy + hh / 2;
  for (const [xa, ya, xb, yb] of [[x0, 0, a0, h], [a1, 0, x1, h], [a0, 0, a1, b0], [a0, b1, a1, h]]) {
    gb.quad([xa, ya, z], [xb - xa, 0, 0], [0, yb - ya, 0]);
    gb.quad([xb, ya, -z], [xa - xb, 0, 0], [0, yb - ya, 0]);
  }
  gb.quad([a0, b0, z], [0, 0, -t], [0, hh, 0]);
  gb.quad([a1, b0, -z], [0, 0, t], [0, hh, 0]);
  gb.quad([a0, b0, z], [hw, 0, 0], [0, 0, -t]);
  gb.quad([a0, b1, -z], [hw, 0, 0], [0, 0, t]);
  gb.quad([x0, 0, -z], [0, 0, t], [0, h, 0]);
  gb.quad([x1, 0, z], [0, 0, -t], [0, h, 0]);
  gb.quad([x0, h, z], [w, 0, 0], [0, 0, -t]);
  return gb.geo();
}

// ======================= 原型 =======================
const DUO = { w: 1.5, cr: 0.5, h: 0.78, t: 0.62, cap: 0.1, low: 0.95 };

registerProtoFamily('wl_duo', (key, [mat = 'wall_red']) => {
  const body = holedSlab(DUO.w, DUO.h, DUO.t, 0.42, 0.2, 0.24);
  const cap = new GB().box(-DUO.w / 2 - 0.025, DUO.h, -DUO.t / 2 - 0.025, DUO.w / 2 + 0.025, DUO.h + DUO.cap, DUO.t / 2 + 0.025).geo();
  // 下段垛墙上的射眼：以内凹暗面示意
  const hole = new GB();
  for (const s of [1, -1]) hole.quad([-0.09 * s, -0.66, s * (DUO.t / 2 + 0.006)], [0.18 * s, 0, 0], [0, 0.26, 0]);
  return [{ mat, geo: body }, { mat: 'brick_grey', geo: cap }, { mat: 'wl_hole', geo: hole.geo() }];
});

registerProtoFamily('wl_spout', () => {
  const gb = new GB();
  gb.box(-0.17, 0, 0, 0.17, 0.07, 0.75, '-z');
  gb.box(-0.17, 0.07, 0, -0.11, 0.17, 0.75, '-z-y');
  gb.box(0.11, 0.07, 0, 0.17, 0.17, 0.75, '-z-y');
  return [{ mat: 'stone_grey', geo: gb.geo() }];
});

// 琉璃斗拱（一斗三升带耍头），单位=斗口，总高 3.7，外跳约 3.3；arm 为拱/耍头釉色
registerProtoFamily('wl_dg', (key, [arm = 'green']) => {
  const Y = 0xd99a1e, A = arm === 'yellow' ? 0xd99a1e : arm === 'blue' ? 0x2a4f9a : 0x2f7d4a;
  const parts = [];
  const bx = (x0, y0, z0, x1, y1, z1, color, skip = '-y') => parts.push(paint(new GB().box(x0, y0, z0, x1, y1, z1, skip).geo(), color));
  bx(-1.1, 0, -1.1, 1.1, 0.8, 1.1, Y);
  bx(-1.5, 0.8, -1.5, 1.5, 1.6, 1.5, Y);
  bx(-3.1, 1.6, -0.62, 3.1, 2.9, 0.62, A);
  bx(-0.55, 1.6, -1.3, 0.55, 3.2, 3.3, A);
  for (const x of [-2.4, 0, 2.4]) bx(x - 0.75, 2.9, -0.75, x + 0.75, 3.7, 0.75, Y);
  return [{ mat: 'vcolor_glaze', geo: mergeColored(parts) }];
});

// ======================= 宫墙 =======================
/**
 * 宫墙截面（中线 o=0）。返回 { segs, caps, yTop 墙身顶, yc 冰盘檐顶, yRidge 脊顶, hb 下碱高, tt 顶厚之半 }
 * capOnly：只生成冰盘檐与墙帽（门垛等自建墙身时用）
 */
function wallSection(o) {
  const { h, thick } = o;
  const style = o.style || 'red';
  const capC = o.cap ?? (style === 'grey' ? 'grey' : 'yellow');
  const none = capC === 'none';
  const sc = o.sc ?? clamp(0.5 * (h / 6 + thick / 1.4), 0.5, 1.4);
  const tb = thick / 2, fb = 0.035;
  const hb = o.baseH ?? clamp(h * 0.16, 0.5, 1.3);
  const glazed = !none && capC !== 'grey' && o.cornice !== 'brick';
  const bodyMat = style === 'grey' ? 'brick_grey' : style === 'yellow' ? 'wall_yellow' : 'wall_red';
  const baseMat = o.base === 'marble' ? 'marble' : o.base === 'stone' ? 'stone_grey' : style === 'grey' ? 'brick_dark' : 'brick_grey';
  const cMat = glazed ? `glaze_${capC}` : 'brick_grey';
  const raft = glazed ? `wl_rafter_${capC === 'black' || capC === 'blue' ? 'green' : capC}` : cMat;
  const glz = none ? 'brick_grey' : `glaze_${capC}`;
  const batter = o.batter ?? 0.01;
  const ovh = 0.14 * sc, eb = 0.12 * sc, rwh = 0.14 * sc, rH = 0.36 * sc, slope = 0.62, corH = 0.44 * sc;
  const capAbove = (tt) => corH + (none ? 0 : eb + (tt + 0.33 * sc + ovh - rwh) * slope + rH);
  let yTop = h - capAbove(tb);
  let tt = tb - (yTop - hb) * batter;
  yTop = h - capAbove(tt);
  tt = tb - (yTop - hb) * batter;
  const S = [];
  if (!o.capOnly) {
    S.push({ p: [[tb + fb, 0], [tb + fb, hb - 0.03], [tb, hb]], mat: baseMat });
    S.push({ p: [[tb, hb], [tt, yTop]], mat: bodyMat });
  }
  const C = (x, y) => [tt + x * sc, yTop + y * sc];
  // 冰盘檐：头层檐、半混、炉口、椽头、枭、盖板
  const cor1 = [C(0, 0), C(0.05, 0), C(0.05, 0.08), C(0.085, 0.091), C(0.111, 0.12), C(0.12, 0.16), C(0.13, 0.16), C(0.13, 0.19), C(0.2, 0.19)];
  const cor2 = [C(0.2, 0.19), C(0.2, 0.3)];
  const cor3 = [C(0.2, 0.3), C(0.213, 0.34), C(0.25, 0.369), C(0.3, 0.38), C(0.33, 0.38), C(0.33, 0.44)];
  S.push({ p: cor1, mat: cMat }, { p: cor2, mat: raft, v: glazed ? 'band' : 'y' }, { p: cor3, mat: cMat });
  const oc = tt + 0.33 * sc, yc = yTop + corH;
  const corPts = [...cor1, ...cor2.slice(1), ...cor3.slice(1)];
  const caps = [];
  let top, capPts = null, yRidge = yc, yr = yc;
  if (none) {
    top = { p: [[oc, yc], [-oc, yc]], mat: 'brick_grey', v: 'o' };
  } else {
    const oe = oc + ovh, ye = yc + eb;
    yr = ye + (oe - rwh) * slope;
    yRidge = yr + rH;
    const ridge = [[rwh, yr], [rwh, yr + 0.2 * sc], [rwh + 0.022 * sc, yr + 0.215 * sc], [rwh + 0.022 * sc, yr + 0.265 * sc], [rwh * 0.92, yr + 0.3 * sc], [rwh * 0.72, yr + 0.335 * sc], [rwh * 0.4, yRidge]];
    S.push({ p: [[oc, yc], [oe, yc]], mat: glz, v: 'o' });
    S.push({ p: [[oe, yc], [oe, ye]], mat: `wl_eave_${capC}`, v: 'band' });
    S.push({ p: [[oe, ye], [rwh, yr]], mat: `tile_${capC}`, v: 'slope' });
    S.push({ p: ridge, mat: `wl_ridge_${capC}`, v: 'band' });
    top = { p: [[rwh * 0.4, yRidge], [-rwh * 0.4, yRidge]], mat: glz, v: 'o' };
    capPts = [[oc, yc], [oe, yc], [oe, ye], ...ridge];
  }
  const segs = [...S, top, ...mirrorSegs(S)];
  if (!o.capOnly) {
    caps.push({ poly: [[-tb - fb, 0], [tb + fb, 0], [tb + fb, hb - 0.03], [tb, hb], [-tb, hb], [-tb - fb, hb - 0.03]], mat: baseMat });
    caps.push({ poly: [[-tb, hb], [tb, hb], [tt, yTop], [-tt, yTop]], mat: bodyMat });
  }
  caps.push({ poly: [...corPts, ...mirrorPts(corPts)], mat: glazed ? `wl_glzm_${capC}` : cMat });
  if (capPts) {
    caps.push({ poly: [...capPts, ...mirrorPts(capPts)], mat: `wl_glzm_${capC}` });
    const [, , pe, pr] = capPts;
    caps.push({ strip: [pe, [pr[0] + 0.02, pr[1]]], w: eb, mat: `wl_eave_${capC}` }, { strip: [[-pe[0], pe[1]], [-pr[0] - 0.02, pr[1]]], w: eb, mat: `wl_eave_${capC}` });
  }
  return { segs, caps, yTop, yc, yr, yRidge, hb, tt, sc };
}

/**
 * 宫墙（沿折线）。墙身红灰（'wall_red'），下碱（base），墙帽（双坡琉璃瓦帽 + 冰盘檐）。
 * opts: path [[x,z],...], closed, y0(默认0), h 墙高（至墙帽顶）, thick 墙厚（默认 1.2~2.0）
 *   cap: 'yellow'|'green'|'blue'|'grey'|'none' 墙帽瓦色; base: 'brick'|'marble'|'stone' 下碱材质;
 *   style: 'red'（默认宫墙）| 'grey'（青砖墙，用于外围/服务区）| 'yellow'
 *   gaps: [{from, to}] 沿路径长度（米）的门洞缺口
 *   （新增可选）baseH 下碱高, cornice: 'brick' 强制砖冰盘檐, batter 每侧收分率（默认 0.01）
 * 返回 { top, bodyTop, capY }
 */
export function buildPalaceWall(ctx, opts) {
  const { path, h = 6, thick = 1.4, closed = false } = opts;
  const y0 = opts.y0 ?? 0;
  const c = y0 ? ctx.at(0, y0, 0) : ctx;
  const sec = wallSection({ h, thick, style: opts.style, cap: opts.cap, base: opts.base, baseH: opts.baseH, cornice: opts.cornice, batter: opts.batter });
  for (const run of splitRuns(path, closed, opts.gaps)) extrude(c, run.pts, sec.segs, { closed: run.closed, caps: sec.caps });
  return { top: y0 + h, bodyTop: y0 + sec.yTop, capY: y0 + sec.yc };
}

// ======================= 城墙 =======================
/** 实心垛墙（转角、端部）：沿 pts 挤出，中线 o=0，底 y */
function solidMerlon(ctx, pts, y, mat) {
  const t = DUO.t / 2, hb = DUO.h, e = 0.025, yt = y + hb, yc = yt + DUO.cap;
  const cop = [[t, yt], [t + e, yt], [t + e, yc], [-t - e, yc], [-t - e, yt], [-t, yt]];
  extrude(ctx, pts, [{ p: [[t, y], [t, yt]], mat }, { p: cop, mat: 'brick_grey' }, { p: [[-t, yt], [-t, y]], mat }], {
    caps: [{ poly: [[-t, y], [t, y], [t, yt], [-t, yt]], mat }, { poly: [[-t - e, yt], [t + e, yt], [t + e, yc], [-t - e, yc]], mat: 'brick_grey' }],
  });
}

/** 沿一段路径布置垛口：oc 为垛墙中线偏移，y 为垛口底；转角与端部用实心垛 */
function crenellate(ctx, run, oc, y, mat) {
  const F = frames(run.pts, run.closed);
  if (!F) return;
  const corner = (i) => run.closed || (i > 0 && i < F.n - 1);
  const cc = 0.9, ce = 0.7;
  const Q = (i) => [F.P[i][0] + F.M[i][0] * oc, F.P[i][1] + F.M[i][1] * oc];
  for (let i = 0; i < F.sc; i++) {
    const i2 = (i + 1) % F.n;
    const A = Q(i), Bp = Q(i2), d = F.D[i], n = F.N[i];
    const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]);
    const ca = corner(i) ? cc : ce, cb = corner(i2) ? cc : ce;
    const avail = L - ca - cb;
    if (avail < DUO.w + 2 * DUO.cr) {
      if (L > 0.05) solidMerlon(ctx, [A, Bp], y, mat);
      continue;
    }
    const nM = Math.max(1, Math.round((avail - DUO.cr) / (DUO.w + DUO.cr)));
    const sx = avail / (nM * DUO.w + (nM + 1) * DUO.cr);
    const rot = Math.atan2(n[0], n[1]);
    for (let k = 0; k < nM; k++) {
      const s = ca + sx * (DUO.cr + k * (DUO.w + DUO.cr) + DUO.w / 2);
      ctx.place(`wl_duo:${mat}`, A[0] + d[0] * s, y, A[1] + d[1] * s, rot, [sx, 1, 1]);
    }
  }
  for (let i = 0; i < F.n; i++) {
    if (!corner(i)) continue;
    const q = Q(i), dp = F.D[(i - 1 + F.sc) % F.sc], dn = F.D[i % F.sc];
    solidMerlon(ctx, [[q[0] - dp[0] * cc, q[1] - dp[1] * cc], q, [q[0] + dn[0] * cc, q[1] + dn[1] * cc]], y, mat);
  }
  if (!run.closed) {
    const q0 = Q(0), d0 = F.D[0], q1 = Q(F.n - 1), d1 = F.D[F.sc - 1];
    solidMerlon(ctx, [q0, [q0[0] + d0[0] * ce, q0[1] + d0[1] * ce]], y, mat);
    solidMerlon(ctx, [[q1[0] - d1[0] * ce, q1[1] - d1[1] * ce], q1], y, mat);
  }
}

/** 垛口墙（下段）+ 垛：外皮 o=oOut，厚 DUO.t，底 y */
function duoWall(ctx, runs, oOut, y, mat) {
  const oi = oOut - DUO.t, yt = y + DUO.low;
  const segs = [{ p: [[oOut, y], [oOut, yt]], mat }, { p: [[oOut, yt], [oi, yt]], mat: 'brick_grey', v: 'o' }, { p: [[oi, yt], [oi, y]], mat }];
  const caps = [{ poly: [[oi, y], [oOut, y], [oOut, yt], [oi, yt]], mat }];
  for (const run of runs) {
    extrude(ctx, run.pts, segs, { closed: run.closed, caps });
    crenellate(ctx, run, oOut - DUO.t / 2, yt, mat);
  }
}

/** 宇墙（矮女墙，砖帽）：外皮 o=oOut，内皮 o=oIn（oIn<oOut），底 y，高 hy */
function yuWall(ctx, runs, oOut, oIn, y, hy, mat) {
  const yt = y + hy, m = (oOut + oIn) / 2;
  const cop = [[oOut, yt], [oOut + 0.04, yt], [oOut + 0.04, yt + 0.08], [m, yt + 0.2], [oIn - 0.04, yt + 0.08], [oIn - 0.04, yt], [oIn, yt]];
  const segs = [{ p: [[oOut, y], [oOut, yt]], mat }, { p: cop, mat: 'brick_grey' }, { p: [[oIn, yt], [oIn, y]], mat }];
  const caps = [{ poly: [[oIn, y], [oOut, y], [oOut, yt], [oIn, yt]], mat }, { poly: cop, mat: 'brick_grey' }];
  for (const run of runs) extrude(ctx, run.pts, segs, { closed: run.closed, caps });
}

/**
 * 紫禁城城墙（矩形环）。外侧垛口（雉堞），内侧宇墙（矮女墙），顶面马道（砖铺），墙体有收分。
 * opts: x0,x1,z0,z1 外皮矩形; h 墙高(10，至马道面); baseThick 底宽(8.62); topThick 顶宽(6.66);
 *   gaps: [{side:'S'|'N'|'E'|'W', from, to}]：沿该边坐标（S/N 用 x，E/W 用 z）的城门缺口（门楼城台由城门建造）
 *   （新增可选）stoneH 石基高(1.2), cornerSkip 四角留空半径（角楼处不设垛口宇墙，默认 0）,
 *   outerMat/innerMat/parapetMat 外皮/内皮/垛墙材质（默认 'wall_red'）, spouts 吐水嘴间距（默认 36，0 关闭）
 * 返回 { top: 马道高, walkOuter, walkInner（马道两侧相对外皮的 o 偏移，负值向内） }
 */
export function buildCityWall(ctx, opts) {
  const { x0, x1, z0, z1, h = 10, baseThick = 8.62, topThick = 6.66 } = opts;
  const B = baseThick, b = (B - topThick) / 2, k = b / h;
  const sb = opts.stoneH ?? 1.2, bh = 0.24, ty = 0.55, hy = 0.95;
  const oO = (y) => -k * y, oI = (y) => -B + k * y;
  const om = opts.outerMat || 'wall_red', im = opts.innerMat || 'wall_red', pm = opts.parapetMat || 'wall_red';
  const oT = oO(h), iT = oI(h), yb = h - bh;
  const loop = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const W = x1 - x0, D = z1 - z0;
  const toS = (side, v) => (side === 'N' ? v - x0 : side === 'E' ? W + (v - z0) : side === 'S' ? W + D + (x1 - v) : 2 * W + D + (z1 - v));
  const gaps = (opts.gaps || []).map((g) => { const a = toS(g.side, g.from), c = toS(g.side, g.to); return { from: Math.min(a, c), to: Math.max(a, c) }; });
  // 墙体 + 马道
  const S = [
    { p: [[0.03, 0], [oO(sb) + 0.03, sb], [oO(sb), sb]], mat: 'stone_grey' },
    { p: [[oO(sb), sb], [oO(yb), yb]], mat: om },
    { p: [[oO(yb), yb], [oO(yb) + 0.06, yb], [oO(yb) + 0.06, yb + 0.12], [oT + 0.1, yb + 0.12], [oT + 0.1, h], [oT, h]], mat: 'brick_grey' },
    { p: [[oT, h], [iT, h]], mat: 'wl_madao', v: 'o' },
    { p: [[iT, h], [iT - 0.1, h], [iT - 0.1, yb + 0.12], [oI(yb) - 0.06, yb + 0.12], [oI(yb) - 0.06, yb], [oI(yb), yb]], mat: 'brick_grey' },
    { p: [[oI(yb), yb], [oI(sb), sb]], mat: im },
    { p: [[oI(sb), sb], [oI(sb) - 0.03, sb], [-B - 0.03, 0]], mat: 'stone_grey' },
  ];
  const sec = [];
  for (const s of S) for (const p of s.p) { const q = sec[sec.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5) sec.push(p); }
  const bodyRuns = splitRuns(loop, true, gaps);
  for (const run of bodyRuns) extrude(ctx, run.pts, S, { closed: run.closed, caps: [{ poly: sec, mat: 'brick_grey' }] });
  // 垛口墙与宇墙（四角可留空给角楼）
  const cs = opts.cornerSkip ?? 0;
  const pg = cs > 0 ? [...gaps, ...[0, W, W + D, 2 * W + D].map((s) => ({ from: s - cs, to: s + cs }))] : gaps;
  const pRuns = splitRuns(loop, true, pg);
  duoWall(ctx, pRuns, oT, h, pm);
  yuWall(ctx, pRuns, iT + ty, iT, h, hy, pm);
  // 吐水嘴（内侧）
  const sp = opts.spouts ?? 36;
  if (sp > 0) {
    const ys = yb - 0.2, os = oI(ys);
    for (const run of bodyRuns) {
      const F = frames(run.pts, run.closed);
      if (!F) continue;
      for (let i = 0; i < F.sc; i++) {
        const L = F.L[i], m = Math.floor((L - 8) / sp);
        if (m < 0) continue;
        const d = F.D[i], n = F.N[i], s0 = (L - m * sp) / 2;
        for (let j = 0; j <= m; j++) {
          const s = s0 + j * sp;
          ctx.place('wl_spout', F.P[i][0] + d[0] * s + n[0] * os, ys, F.P[i][1] + d[1] * s + n[1] * os, Math.atan2(-n[0], -n[1]));
        }
      }
    }
  }
  return { top: h, walkOuter: oT - DUO.t, walkInner: iT + ty };
}

// ======================= 须弥座 =======================
/** 须弥座：沿路径（墙身外皮 o=0）外凸，高 H、出跳 P；oBack 为顶面收回处（墙身收分时为负） */
function xumi(ctx, path, closed, H, P, gaps, kind = 'marble', oBack = 0) {
  const m = kind === 'marble' ? 'marble' : kind === 'brick' ? 'brick_grey' : 'stone_grey';
  const band = kind === 'marble' ? 'marble_band' : m;
  const p1 = [[P, 0], [P, 0.12 * H], [0.86 * P, 0.12 * H], [0.86 * P, 0.3 * H], [0.68 * P, 0.345 * H], [0.45 * P, 0.385 * H], [0.36 * P, 0.41 * H]];
  const p2 = [[0.36 * P, 0.63 * H], [0.45 * P, 0.655 * H], [0.68 * P, 0.695 * H], [0.88 * P, 0.74 * H], [0.88 * P, H], [oBack, H]];
  const segs = [{ p: p1, mat: m }, { p: [p1[p1.length - 1], p2[0]], mat: band, v: 'band' }, { p: p2, mat: m }];
  const poly = [[0, 0], ...p1, ...p2];
  for (const run of splitRuns(path, closed, gaps)) extrude(ctx, run.pts, segs, { closed: run.closed, caps: [{ poly, mat: m }] });
}

// ======================= 城台 =======================
/** 券洞轮廓（自左下沿券至右下），stone 处在 y=sy 加点 */
function archOutline(t, sy = 0, n = 16) {
  const xl = t.x - t.w / 2, xr = t.x + t.w / 2, r = t.w / 2;
  const pts = [[xl, 0]];
  if (sy > 0 && sy < t.sp - 0.1) pts.push([xl, sy]);
  pts.push([xl, t.sp]);
  for (let i = 1; i < n; i++) { const a = Math.PI * (1 - i / n); pts.push([t.x + r * Math.cos(a), t.sp + r * Math.sin(a)]); }
  pts.push([xr, t.sp]);
  if (sy > 0 && sy < t.sp - 0.1) pts.push([xr, sy]);
  pts.push([xr, 0]);
  return pts;
}

/** 券门洞内的板门：门扇（gate_door 门钉）、上槛、券心板；open 时门扇内开 */
function archDoor(ctx, tw, sp, open) {
  const half = [];
  for (let i = 0; i <= 16; i++) { const a = (Math.PI * i) / 16; half.push([(tw / 2) * Math.cos(a), sp + (tw / 2) * Math.sin(a)]); }
  const gb = new GB();
  polyFace(gb, half, ([x, y]) => [x, y, 0.08], [0, 0, 1]);
  polyFace(gb, half, ([x, y]) => [x, y, -0.08], [0, 0, -1]);
  ctx.add('board_red', gb.geo());
  ctx.add('wood_red', new GB().box(-tw / 2, sp - 0.24, -0.14, tw / 2, sp, 0.14).geo());
  const lw = tw / 2 - 0.015, lh = sp - 0.26;
  const leafG = new THREE.BoxGeometry(lw, lh, 0.12);
  leafG.translate(lw / 2, lh / 2 + 0.01, 0);
  for (const s of [-1, 1]) ctx.at(s * tw / 2, 0, 0, open ? -s * 0.46 * Math.PI : 0, [s > 0 ? -1 : 1, 1, 1]).add('gate_door', leafG);
}

/**
 * 城台（午门/神武门/东华门/西华门等门楼下的砖砌城台）。局部坐标：中心在原点，正面朝 +Z，券洞沿 Z 贯通。
 * opts: w（沿 X）, d（沿 Z）, h; tunnels: [{x, w, h}] 券洞（h 为券顶高）; style: 'red'（红灰抹面 + 汉白玉须弥座）| 'brick'（青砖 + 石基）
 *   （新增可选）batter 每侧收分（默认 0.035h）, baseH 须弥座高, parapet: 'yu'|'duo'|'none' 或 {N,E,S,W} 分面指定（默认 'yu'）,
 *   doors: 'closed'|'open'|false（默认 'closed'），doorZ 门扇所在 z（默认 0）
 * 返回 { top, topW, topD }
 */
export function buildGateTerrace(ctx, opts) {
  const { w, d, h } = opts;
  const red = (opts.style || 'red') === 'red';
  const bt = opts.batter ?? h * 0.035, k = bt / h;
  const wm = red ? 'wall_red' : 'brick_grey';
  const tunnels = (opts.tunnels || []).map((t) => ({ x: t.x ?? 0, w: t.w, h: t.h, sp: Math.max(0.6, t.h - t.w / 2) })).sort((a, b) => a.x - b.x);
  const zf = (y) => d / 2 - bt * (y / h), xf = (y) => w / 2 - bt * (y / h);
  const xt = xf(h), zt = zf(h);
  const baseH = opts.baseH ?? (red ? clamp(h * 0.12, 0.9, 1.8) : 0.6);
  const P = red ? clamp(h * 0.032, 0.22, 0.45) : 0.06;
  // 前后立面（券洞开口）
  const gb = new GB();
  const face = [[-w / 2, 0]];
  for (const t of tunnels) face.push(...archOutline(t));
  face.push([w / 2, 0], [xt, h], [-xt, h]);
  polyFace(gb, face, ([x, y]) => [x, y, zf(y)], [0, k, 1]);
  polyFace(gb, face, ([x, y]) => [x, y, -zf(y)], [0, k, -1]);
  const side = [[-d / 2, 0], [d / 2, 0], [zt, h], [-zt, h]];
  polyFace(gb, side, ([z, y]) => [xf(y), y, z], [1, k, 0]);
  polyFace(gb, side, ([z, y]) => [-xf(y), y, z], [-1, k, 0]);
  ctx.add(wm, gb.geo());
  ctx.add('wl_madao', polyTopGeo([[-xt, -zt], [xt, -zt], [xt, zt], [-xt, zt]], h));
  // 券洞内壁（下 1m 石）、地面、门
  const gw = new GB(), gs = new GB(), gf = new GB();
  for (const t of tunnels) {
    const o = archOutline(t, red ? 1.0 : 0.6);
    let acc = 0;
    const nAt = ([x, y]) => (y <= t.sp + 1e-6 ? [Math.sign(t.x - x), 0, 0] : norm3([t.x - x, t.sp - y, 0]));
    for (let i = 0; i < o.length - 1; i++) {
      const p = o[i], q = o[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const pts = [[p[0], p[1], zf(p[1])], [q[0], q[1], zf(q[1])], [q[0], q[1], -zf(q[1])], [p[0], p[1], -zf(p[1])]];
      const np = nAt(p), nq = nAt(q);
      const mid = [t.x - (p[0] + q[0]) / 2, t.sp - (p[1] + q[1]) / 2, 0];
      const want = Math.abs(p[0] - q[0]) < 1e-6 ? [Math.sign(t.x - p[0]), 0, 0] : mid;
      const stone = Math.max(p[1], q[1]) <= (red ? 1.0 : 0.6) + 1e-6;
      (stone ? gs : gw).quad4(pts, [np, nq, nq, np], [[zf(p[1]), acc], [zf(q[1]), acc + l], [-zf(q[1]), acc + l], [-zf(p[1]), acc]], want);
      acc += l;
    }
    gf.quad([t.x - t.w / 2, 0.012, d / 2 + P], [t.w, 0, 0], [0, 0, -(d + 2 * P)]);
  }
  if (!gw.empty) ctx.add(wm, gw.geo());
  if (!gs.empty) ctx.add('stone_grey', gs.geo());
  if (!gf.empty) ctx.add('paving', gf.geo());
  const doors = opts.doors ?? 'closed';
  if (doors) for (const t of tunnels) archDoor(ctx.at(t.x, 0, opts.doorZ ?? 0), t.w, t.sp, doors === 'open');
  // 须弥座 / 石基（券洞处断开）
  const bottom = rectLoop(w, d);
  const tg = gapsSN(w, d, tunnels.map((t) => [t.x - t.w / 2, t.x + t.w / 2]));
  if (red) xumi(ctx, bottom, true, baseH, P, tg, 'marble', -k * baseH);
  else for (const run of splitRuns(bottom, true, tg)) extrude(ctx, run.pts, [{ p: [[P, 0], [P, baseH], [-k * baseH, baseH]], mat: 'stone_grey' }], { caps: [{ poly: [[0, 0], [P, 0], [P, baseH], [-k * baseH, baseH]], mat: 'stone_grey' }] });
  // 顶部拔檐
  const top = rectLoop(2 * xt, 2 * zt);
  extrude(ctx, top, [{ p: [[k * 0.3, h - 0.3], [k * 0.3 + 0.07, h - 0.3], [k * 0.3 + 0.07, h - 0.16], [0.1, h - 0.16], [0.1, h], [0, h]], mat: 'brick_grey' }], { closed: true });
  // 女墙：分面 'yu' 宇墙 / 'duo' 垛口
  const pp = opts.parapet ?? 'yu';
  const kinds = ['N', 'E', 'S', 'W'].map((s) => (typeof pp === 'object' ? pp[s] ?? 'none' : pp));
  const sideLen = [2 * xt, 2 * zt, 2 * xt, 2 * zt], sideStart = [0, 2 * xt, 2 * xt + 2 * zt, 4 * xt + 2 * zt];
  const tq = DUO.t;
  for (const kind of ['yu', 'duo']) {
    const g = [];
    for (let i = 0; i < 4; i++) if (kinds[i] !== kind) g.push({ from: sideStart[i], to: sideStart[i] + sideLen[i] });
    if (g.length === 4) continue;
    const runs = splitRuns(top, true, g);
    for (const run of runs) {
      if (run.closed) continue;
      // 东西面在与另一类女墙相接处让出厚度，避免重叠
      const trim = (iA, iB, atEnd) => {
        const a = run.pts[iA], b = run.pts[iB];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
        if (l < tq * 2 || Math.abs(dz / l) < 0.5) return;
        const sideIdx = dz > 0 ? 1 : 3;
        const nb = atEnd ? (sideIdx + 1) % 4 : (sideIdx + 3) % 4;
        if (kinds[nb] !== 'none' && kinds[nb] !== kind) run.pts[iA] = [a[0] + (dx / l) * tq, a[1] + (dz / l) * tq];
      };
      trim(0, 1, false);
      trim(run.pts.length - 1, run.pts.length - 2, true);
    }
    if (kind === 'yu') yuWall(ctx, runs, 0, -tq, h, 1.0, wm);
    else duoWall(ctx, runs, 0, h, wm);
  }
  return { top: h, topW: 2 * xt, topD: 2 * zt };
}

// ======================= 墙门构件 =======================
/** 门框 + 板门（局部：门洞中心 x=0，立面 z=0，自 y=0 起）。leaf 门扇材质，zan 门簪数 */
function doorSet(ctx, dw, dh, depth, o = {}) {
  const fw = clamp(dw * 0.05, 0.1, 0.16), sill = clamp(dh * 0.055, 0.12, 0.25), zt = Math.min(0.32, depth * 0.5) / 2;
  const yMid = dh - clamp(dh * 0.13, 0.3, 0.7);
  const gb = new GB();
  gb.box(-dw / 2, 0, -zt, -dw / 2 + fw, dh, zt);
  gb.box(dw / 2 - fw, 0, -zt, dw / 2, dh, zt);
  gb.box(-dw / 2 + fw, 0, -zt, dw / 2 - fw, sill, zt);
  gb.box(-dw / 2 + fw, yMid, -zt, dw / 2 - fw, yMid + 0.18, zt);
  gb.box(-dw / 2 + fw, dh - 0.12, -zt, dw / 2 - fw, dh, zt);
  ctx.add('wood_red', gb.geo());
  ctx.add('board_red', new GB().box(-dw / 2 + fw, yMid + 0.18, -0.03, dw / 2 - fw, dh - 0.12, 0.03).geo());
  const lw = (dw - 2 * fw) / 2 - 0.01, lh = yMid - sill - 0.02;
  const leafG = new THREE.BoxGeometry(lw, lh, 0.1);
  leafG.translate(lw / 2, sill + 0.01 + lh / 2, 0);
  for (const s of [-1, 1]) ctx.at(s * (dw / 2 - fw), 0, 0, o.open ? -s * 0.42 * Math.PI : 0, [s > 0 ? -1 : 1, 1, 1]).add(o.leaf || 'gate_door', leafG);
  // 门簪
  const nz = o.zan ?? 2;
  if (nz) {
    const zg = cylGeo(0.075, 0.075, 0.16, 6); zg.rotateX(Math.PI / 2);
    const fg = cylGeo(0.08, 0.08, 0.02, 12); fg.rotateX(Math.PI / 2); fg.translate(0, 0, 0.16);
    for (let i = 0; i < nz; i++) {
      const x = (i - (nz - 1) / 2) * Math.min(0.7, (dw - 2 * fw) / nz);
      ctx.addAt('wood_red', zg, x, yMid + 0.09, zt);
      ctx.addAt('gold', fg, x, yMid + 0.09, zt);
    }
  }
  return { sill, yMid };
}

/** 岔角盒子装饰面板（局部：面板中心在原点，贴于 z=0 立面，朝 +Z） */
function ornPanel(ctx, pw, ph, o = {}) {
  const brick = o.kind === 'brick';
  const sideMat = brick ? 'brick_grey' : 'glaze_yellow';
  const fw = o.frame === false ? 0 : clamp(Math.min(pw, ph) * 0.045, 0.05, 0.14);
  const dep = clamp(Math.min(pw, ph) * 0.012, 0.02, 0.05);
  if (fw) {
    const gb = new GB();
    gb.box(-pw / 2, ph / 2 - fw, 0, pw / 2, ph / 2, dep, '-z');
    gb.box(-pw / 2, -ph / 2, 0, pw / 2, -ph / 2 + fw, dep, '-z');
    gb.box(-pw / 2, -ph / 2 + fw, 0, -pw / 2 + fw, ph / 2 - fw, dep, '-z-y+y');
    gb.box(pw / 2 - fw, -ph / 2 + fw, 0, pw / 2, ph / 2 - fw, dep, '-z-y+y');
    ctx.add(o.frameMat || (brick ? 'brick_dark' : 'glaze_yellow'), gb.geo());
  }
  const iw = pw - 2 * fw - 0.02, ih = ph - 2 * fw - 0.02;
  if (o.fill) ctx.add(o.fill, new GB().quad([-iw / 2, -ih / 2, 0.004], [iw, 0, 0], [0, ih, 0]).geo());
  const a = Math.min(iw, ih) * 0.36;
  const cp = [[0, 0]];
  for (let i = 0; i <= 18; i++) { const th = (-i / 18) * (Math.PI / 2), r = a * (0.9 + 0.1 * Math.cos(th * 8)); cp.push([r * Math.cos(th), r * Math.sin(th)]); }
  const cr = relief(cp, dep, ([x, y]) => [x / a, 1 + y / a]);
  const front = brick ? 'wl_chajiao_b' : 'wl_chajiao';
  for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
    const c = ctx.at((sx * iw) / 2, (sy * ih) / 2, 0, 0, [-sx, sy, 1]);
    c.add(front, cr.front); c.add(sideMat, cr.side);
  }
  const ry = Math.min(iw, ih) * 0.3, rx = ry * clamp(iw / ih, 1, 1.4);
  const mp = [];
  for (let i = 0; i < 32; i++) { const th = (i / 32) * TAU; mp.push([rx * Math.cos(th), ry * Math.sin(th)]); }
  const md = relief(mp, dep * 1.5, ([x, y]) => [(x / rx + 1) / 2, (y / ry + 1) / 2]);
  ctx.add(brick ? 'wl_hezi_b' : 'wl_hezi', md.front); ctx.add(sideMat, md.side);
}

/** 矩形墙身四周布置（每边均布 + 四角 45°）：fn(x, z, rotY) */
function aroundRect(W, T, sp, fn) {
  for (const [len, fixed, ax, n] of [[W, -T / 2, 0, [0, -1]], [W, T / 2, 0, [0, 1]], [T, W / 2, 1, [1, 0]], [T, -W / 2, 1, [-1, 0]]]) {
    const m = Math.max(1, Math.round(len / sp) - 1);
    for (let j = 1; j <= m; j++) { const s = -len / 2 + (len * j) / (m + 1); fn(ax ? fixed : s, ax ? s : fixed, Math.atan2(n[0], n[1])); }
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) fn((sx * W) / 2, (sz * T) / 2, Math.atan2(sx, sz));
}

/** 琉璃仿木檐：额枋、平板枋、垫拱板、琉璃斗拱、挑檐枋、屋顶（buildRoof）。墙身矩形 W×T，自 y 起 */
function glazeEave(ctx, W, T, y, o) {
  const H = o.H, tile = o.tile || 'yellow';
  const be = o.be ?? clamp(H * 0.055, 0.22, 0.6), pb = be * 0.32;
  const dgH = o.dgH ?? clamp(H * 0.05, 0.2, 0.5), k = dgH / 3.7;
  const yD = y + be + pb, yT = yD + dgH;
  const arm = o.arm || (tile === 'green' ? 'yellow' : 'green');
  const loop = rectLoop(W, T);
  extrude(ctx, loop, [
    { p: [[0, y], [0.05, y]], mat: 'glaze_green', v: 'o' },
    { p: [[0.05, y], [0.05, y + be]], mat: 'wl_glzbeam', v: 'band' },
    { p: [[0.05, y + be], [0.08, y + be], [0.08, yD], [0, yD]], mat: 'glaze_yellow' },
    { p: [[0, yD], [0, yT + 0.3 * k]], mat: 'glaze_green' },
  ], { closed: true });
  aroundRect(W, T, 8.5 * k, (x, z, r) => ctx.place(`wl_dg:${arm}`, x, yD, z, r, k));
  const reach = 3.3 * k;
  const y0 = yD + 2.3 * k, y1 = yT + 0.3 * k, ri = reach - 0.8 * k;
  extrude(ctx, loop, [{ p: [[ri, y0], [reach, y0], [reach, y1], [ri, y1], [ri, y0]], mat: 'glaze_green' }], { closed: true });
  const cg = boxGeo(W + 2 * reach, 0.04, T + 2 * reach); cg.translate(0, y1 + 0.02, 0);
  ctx.add('glaze_green', cg);
  const ov = reach + clamp(H * 0.05, 0.25, 0.6), band = clamp(H * 0.022, 0.12, 0.24);
  const yE = y1 + band + 0.03;
  const rise = o.rise ?? Math.max(H - yE - 0.32, (T + 2 * ov) * 0.3);
  const info = buildRoof(ctx, { type: o.roof || 'xieshan', w: W + 2 * ov, d: T + 2 * ov, y: yE, rise, tile, band, bandMat: `wl_rafter_${arm}`, overhang: ov + 0.2, beasts: o.beasts });
  return { top: info?.ridgeY ?? yE + rise, eaveY: yE };
}

/** 琉璃门单体（局部：门中心，墙中线 z=0） */
function liuliUnit(ctx, W, H, T, dw, dh, tile, o = {}) {
  const baseH = clamp(H * 0.09, 0.35, 0.8), yB = Math.max(H * 0.6, (o.wallH ?? 0) + 0.12);
  dh = Math.min(dh, yB - 0.5);
  xumi(ctx, rectLoop(W, T), true, baseH, clamp(H * 0.022, 0.08, 0.18), gapsSN(W, T, [[-dw / 2, dw / 2]]), 'marble');
  const gb = new GB();
  gb.box(-W / 2, 0, -T / 2, -dw / 2, yB, T / 2, '-y');
  gb.box(dw / 2, 0, -T / 2, W / 2, yB, T / 2, '-y');
  gb.box(-dw / 2, dh, -T / 2, dw / 2, yB, T / 2);
  ctx.add('wall_red', gb.geo());
  // 琉璃柱子（角柱、门侧柱）与柱础
  const pc = new GB(), pb = new GB(), pw = clamp(W * 0.035, 0.16, 0.3), e = 0.04;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const xa = sx > 0 ? W / 2 - pw : -W / 2 - e, xb = sx > 0 ? W / 2 + e : -W / 2 + pw;
    const za = sz > 0 ? T / 2 - pw : -T / 2 - e, zb = sz > 0 ? T / 2 + e : -T / 2 + pw;
    pc.box(xa, baseH + 0.14, za, xb, yB, zb, '-y+y');
    pb.box(xa - 0.02, baseH, za - 0.02, xb + 0.02, baseH + 0.14, zb + 0.02, '-y');
    const da = sx > 0 ? dw / 2 : -dw / 2 - pw, db = sx > 0 ? dw / 2 + pw : -dw / 2;
    const fz = sz * T / 2, fz2 = fz + sz * e;
    pc.box(da, baseH + 0.14, Math.min(fz, fz2), db, dh, Math.max(fz, fz2), '-y');
    pb.box(da - 0.02, baseH, Math.min(fz, fz2 + sz * 0.02), db + 0.02, baseH + 0.14, Math.max(fz, fz2 + sz * 0.02), '-y');
  }
  ctx.add('glaze_green', pc.geo()); ctx.add('glaze_yellow', pb.geo());
  doorSet(ctx, dw, dh, T, { leaf: 'gate_door', zan: 4, open: o.open });
  // 两侧门垛面：岔角 + 盒子
  const ow = (W - dw) / 2 - 2 * pw - 0.35, oh = yB - baseH - 0.75;
  if (ow > 0.5 && oh > 0.5) for (const sx of [-1, 1]) for (const sz of [1, -1]) {
    const c = ctx.at(sx * (dw / 2 + (W - dw) / 4), baseH + 0.14 + (yB - baseH - 0.14) / 2, (sz * T) / 2, sz > 0 ? 0 : Math.PI);
    ornPanel(c, ow, oh, { frame: o.frame ?? true });
  }
  return glazeEave(ctx, W, T, yB, { H, tile, roof: o.roof, beasts: o.beasts });
}

/** 门罩（随墙门门洞上方的小檐）：局部立面 z=0 朝 +Z，跨度 span，自 y 起 */
function menzhao(ctx, span, y, tile) {
  const be = 0.26, dg = 0.2, k = dg / 3.7, p = 0.62, eb = 0.11, ys = y + be + dg + 0.02, yt = ys + eb + p * 0.62;
  const path = [[span / 2, 0], [-span / 2, 0]];
  extrude(ctx, path, [
    { p: [[0, y], [0.07, y]], mat: 'glaze_green', v: 'o' },
    { p: [[0.07, y], [0.07, y + be]], mat: 'wl_glzbeam', v: 'band' },
    { p: [[0.07, y + be], [0, y + be]], mat: 'glaze_yellow', v: 'o' },
  ], { caps: [{ poly: [[0, y], [0.07, y], [0.07, y + be], [0, y + be]], mat: 'glaze_green' }] });
  const n = Math.max(2, Math.round(span / (9 * k)));
  for (let i = 0; i < n; i++) ctx.place(`wl_dg:${tile === 'green' ? 'yellow' : 'green'}`, -span / 2 + 0.15 + ((span - 0.3) * (i + 0.5)) / n, y + be, 0, 0, k);
  const cap = [[0, ys], [p, ys], [p, ys + eb], [0, yt]];
  const wide = [[span / 2 + 0.3, 0], [-span / 2 - 0.3, 0]];
  extrude(ctx, wide, [
    { p: [[0, ys], [p, ys]], mat: 'glaze_green', v: 'o' },
    { p: [[p, ys], [p, ys + eb]], mat: `wl_eave_${tile}`, v: 'band' },
    { p: [[p, ys + eb], [0, yt]], mat: `tile_${tile}`, v: 'slope' },
  ], { caps: [{ poly: cap, mat: `glaze_${tile}` }] });
  const bj = new GB().box(-span / 2 - 0.3, yt - 0.06, 0, span / 2 + 0.3, yt + 0.1, 0.12, '-z');
  ctx.add(`glaze_${tile}`, bj.geo());
  return yt + 0.1;
}

/** 随墙门：墙垛高出两侧宫墙，开门洞，上覆琉璃墙帽；门洞上方两面设门罩 */
function suiqiangGate(ctx, W, H, T, dw, dh, tile) {
  const sec = wallSection({ h: H, thick: T, cap: tile, capOnly: true, batter: 0 });
  const yTop = sec.yTop, hb = sec.hb, fb = 0.035;
  dh = Math.min(dh, yTop - 1.3);
  const gb = new GB(), gk = new GB();
  for (const s of [-1, 1]) {
    const xa = s > 0 ? dw / 2 : -W / 2, xb = s > 0 ? W / 2 : -dw / 2;
    gk.box(xa, 0, -T / 2 - fb, xb, hb, T / 2 + fb, '-y');
    gb.box(xa, hb, -T / 2, xb, yTop, T / 2, '-y+y');
  }
  gb.box(-dw / 2, dh, -T / 2, dw / 2, yTop, T / 2, '+y');
  ctx.add('wall_red', gb.geo()); ctx.add('brick_grey', gk.geo());
  extrude(ctx, [[W / 2, 0], [-W / 2, 0]], sec.segs, { caps: sec.caps });
  for (const s of [-1, 1]) ctx.place(`wen:${tile}`, s * (W / 2 - 0.12 * sec.sc), sec.yRidge - 0.05, 0, s > 0 ? 0 : Math.PI, 0.62 * sec.sc);
  doorSet(ctx, dw, dh, T, { leaf: 'gate_door', zan: 2 });
  for (const sz of [1, -1]) menzhao(ctx.at(0, 0, (sz * T) / 2, sz > 0 ? 0 : Math.PI), dw + 0.9, dh + 0.08, tile);
  return { top: sec.yRidge };
}

/** 垂花门（一殿一卷式简化：前檐垂莲柱，卷棚悬山顶，苏式彩画）。前檐柱位于墙中线 z=0 */
function chuihuaGate(ctx, o) {
  const w = o.w ?? 3.6, h = o.h ?? 6, tile = o.tile || 'yellow';
  const cw = w - 0.3, hp = clamp(h * 0.07, 0.3, 0.5), cr = 0.13;
  const colH = h * 0.5, dz = o.depth ?? clamp(w * 0.72, 2.2, 3.4), cant = clamp(w * 0.25, 0.75, 1.0);
  const yT = hp + colH;
  // 台基与踏跺
  const st = new GB();
  st.box(-cw / 2 - 0.45, 0, -dz - 0.55, cw / 2 + 0.45, hp, cant + 0.5, '-y');
  for (const [z0, sg] of [[cant + 0.5, 1], [-dz - 0.55, -1]]) for (let i = 1; i <= 2; i++) {
    const yy = hp * (1 - i / 3), za = z0 + sg * 0.32 * (i - 1), zb = z0 + sg * 0.32 * i;
    st.box(-cw / 2 + 0.2, 0, Math.min(za, zb), cw / 2 - 0.2, yy, Math.max(za, zb), '-y');
  }
  ctx.add('stone_grey', st.geo());
  // 柱、柱础、垂柱
  const wr = new GB(), sb = new GB();
  for (const sx of [-1, 1]) for (const z of [0, -dz]) {
    ctx.addAt('wood_red', cylGeo(cr, cr, colH, 16), (sx * cw) / 2, hp, z);
    ctx.addAt('stone_grey', cylGeo(cr * 1.35, cr * 1.5, 0.1, 16), (sx * cw) / 2, hp, z);
  }
  for (const sx of [-1, 1]) wr.box((sx * cw) / 2 - 0.1, yT - 0.92, cant - 0.1, (sx * cw) / 2 + 0.1, yT + 0.02, cant + 0.1, '+y');
  ctx.add('wood_red', wr.geo());
  const lotus = mergeColored([
    paint(latheGeo([[0.001, 0], [0.05, 0.025], [0.1, 0.075], [0.135, 0.14], [0.13, 0.2], [0.09, 0.245]], 16), 0xb83a2c),
    paint(latheGeo([[0.09, 0.245], [0.125, 0.26], [0.125, 0.3], [0.09, 0.315]], 16), 0xd4a640),
    paint(latheGeo([[0.09, 0.315], [0.1, 0.36], [0.1, 0.4]], 16), 0x2f6a4a),
  ]);
  for (const sx of [-1, 1]) ctx.addAt('vcolor', lotus, (sx * cw) / 2, yT - 0.92 - 0.4, cant);
  // 梁枋（苏式彩画，BoxGeometry 0..1 UV）
  const beam = (x0, y0, z0, x1, y1, z1, mat = 'beam_sushi') => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); ctx.add(mat, g); };
  for (const sx of [-1, 1]) beam((sx * cw) / 2 - 0.12, yT, -dz - 0.35, (sx * cw) / 2 + 0.12, yT + 0.34, cant + 0.32);
  for (const z of [cant, 0, -dz]) beam(-cw / 2 + 0.1, yT, z - 0.1, cw / 2 - 0.1, yT + 0.3, z + 0.1);
  beam(-cw / 2 + 0.1, yT - 0.62, cant - 0.07, cw / 2 - 0.1, yT - 0.48, cant + 0.07);
  // 折柱花板
  const np = 4, pwid = (cw - 0.2) / np, fb = new GB(), zz = new GB();
  for (let i = 0; i < np; i++) {
    const xa = -cw / 2 + 0.1 + i * pwid;
    for (const s of [1, -1]) fb.quad(s > 0 ? [xa + 0.04, yT - 0.48, cant + 0.02] : [xa + pwid - 0.04, yT - 0.48, cant - 0.02], [s * (pwid - 0.08), 0, 0], [0, 0.48, 0], true);
    if (i > 0) zz.box(xa - 0.04, yT - 0.48, cant - 0.05, xa + 0.04, yT, cant + 0.05);
  }
  ctx.add('wl_flowerboard', fb.geo()); ctx.add('wood_green', zz.geo());
  // 骑马雀替（正面）与花牙子（两侧）
  ctx.add('wl_huazhao', new GB().quad([-cw / 2 + 0.1, yT - 1.05, cant], [cw - 0.2, 0, 0], [0, 0.43, 0], true).geo());
  for (const sx of [-1, 1]) ctx.add('wl_huazhao', new GB().quad([(sx * cw) / 2, yT - 0.32, 0.14], [0, 0, cant - 0.26], [0, 0.32, 0], true).geo());
  // 棋盘门（前檐柱间）与屏门（后檐柱间）
  doorSet(ctx.at(0, hp, 0), cw - 2 * cr, colH, 0.3, { leaf: 'board_red', zan: 2 });
  const pm = new GB(), n4 = 4, lw = (cw - 2 * cr) / n4;
  for (let i = 0; i < n4; i++) pm.box(-cw / 2 + cr + i * lw + 0.01, hp + 0.05, -dz - 0.04, -cw / 2 + cr + (i + 1) * lw - 0.01, yT - 0.35, -dz + 0.04);
  ctx.add('board_green', pm.geo());
  ctx.add('wood_red', new GB().box(-cw / 2 + cr, yT - 0.35, -dz - 0.06, cw / 2 - cr, yT, -dz + 0.06).geo());
  // 抱鼓石
  const dr = cylGeo(0.3, 0.3, 0.17, 20); dr.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const x = sx * (cw / 2 - cr - 0.16);
    ctx.add('stone_grey', new GB().box(x - 0.12, hp, -0.45, x + 0.12, hp + 0.42, 0.62, '-y').geo());
    ctx.addAt('stone_grey', dr, x + 0.085, hp + 0.42 + 0.3, 0.28);
  }
  // 天花、山面垫板与卷棚悬山顶
  ctx.add('board_green', new GB().box(-cw / 2 - 0.12, yT + 0.34, -dz - 0.35, cw / 2 + 0.12, yT + 0.4, cant + 0.32, '+y').geo());
  const sb2 = new GB();
  for (const sx of [-1, 1]) sb2.box(sx * (cw / 2 + 0.05) - 0.03, yT + 0.34, -dz - 0.3, sx * (cw / 2 + 0.05) + 0.03, yT + 0.56, cant + 0.28);
  ctx.add('board_red', sb2.geo());
  const rd = dz + cant + 1.2, rw = cw + 1.2;
  const info = buildRoof(ctx.at(0, 0, (cant - dz) / 2), { type: 'xuanshan', juan: true, w: rw, d: rd, y: yT + 0.62, rise: rd * 0.26, tile, band: 0.14, overhang: 0.6, gableOverhang: 0.55 });
  return { top: info?.ridgeY, eaveY: yT + 0.62 };
}

/**
 * 墙门（嵌于宫墙中的门）。局部坐标：门中心 x=0，墙中线 z=0，正面朝 +Z。
 * opts: type: 'liuli'（琉璃门：红身、琉璃斗拱檐、琉璃瓦顶、黄绿琉璃岔角/盒子）
 *            | 'suiqiang'（随墙门：墙上开门洞，上覆小门罩）
 *            | 'chuihua'（垂花门：前檐垂莲柱，卷棚/悬山顶，彩画）
 *            | 'menlou'（门楼/小式门殿可由 building.js 建，此处不需要）
 *   w 总宽, h 总高（含顶）, wallThick 墙厚, openings 门洞数(1/3), doorW 门洞宽, doorH 门洞高, tile 瓦色
 *   （新增可选）roof: 'xieshan'|'wudian'（琉璃门顶）, open 门扇开启, depth 垂花门进深,
 *     wallH 相邻宫墙高（琉璃门墙身至少高出它，墙帽收于额枋之下）
 * 两侧宫墙在门处留缺口：缺口宽 = w（琉璃门门垛厚 wallThick+0.5，随墙门 wallThick+0.3）。
 * 垂花门：前檐柱在 z=0，垂柱伸出 +Z 约 0.9m，相邻宫墙宜低于 eaveY。
 * 返回 { top, eaveY? }
 */
export function buildWallGate(ctx, opts) {
  const type = opts.type || 'liuli';
  const wt = opts.wallThick ?? 1.5, tile = opts.tile || 'yellow';
  if (type === 'chuihua') return chuihuaGate(ctx, opts);
  if (type === 'suiqiang') {
    const dw = opts.doorW ?? clamp((opts.w ?? 4.6) * 0.42, 1.2, 2.6);
    const w = opts.w ?? dw + 2.4, h = opts.h ?? 6.8;
    return suiqiangGate(ctx, w, h, wt + 0.3, dw, opts.doorH ?? h * 0.48, tile);
  }
  const w = opts.w ?? 6.4, h = opts.h ?? 7.2, T = Math.max(wt + 0.5, 1.6);
  if ((opts.openings ?? 1) >= 3) {
    const wc = w * 0.38, ws = w * 0.21, gap = (w - wc - 2 * ws) / 2;
    const dw = opts.doorW ?? wc * 0.4, dh = opts.doorH ?? h * 0.44;
    const r = liuliUnit(ctx, wc, h, T, dw, dh, tile, opts);
    for (const sx of [-1, 1]) {
      liuliUnit(ctx.at(sx * (wc / 2 + gap + ws / 2), 0, 0), ws, h * 0.84, T * 0.92, dw * 0.78, dh * 0.82, tile, opts);
      if (gap > 0.1) buildPalaceWall(ctx, { path: [[(sx * wc) / 2, 0], [sx * (wc / 2 + gap), 0]], h: h * 0.62, thick: wt, cap: tile });
    }
    return r;
  }
  return liuliUnit(ctx, w, h, T, opts.doorW ?? clamp(w * 0.38, 1.4, 4), opts.doorH ?? h * 0.45, tile, opts);
}

/**
 * 影壁（照壁）。局部坐标：中心 x=0，朝 +Z。
 * opts: w, h, thick, style: 'liuli'（琉璃影壁，中心盒子+岔角）| 'brick'（砖影壁）| 'red', tile
 *   （新增可选）roof: 'wudian'|'xieshan'（琉璃影壁顶，默认庑殿）
 * 返回 { top }
 */
export function buildScreenWall(ctx, opts) {
  const { w = 8, h = 4, thick = 1 } = opts;
  const style = opts.style || 'liuli';
  const tile = opts.tile || (style === 'brick' ? 'grey' : 'yellow');
  const baseH = clamp(h * 0.15, 0.35, 1.1);
  if (style === 'liuli') {
    const yB = h * 0.62;
    xumi(ctx, rectLoop(w, thick), true, baseH, clamp(h * 0.025, 0.08, 0.2), null, 'marble');
    ctx.add('wall_red', new GB().box(-w / 2, 0, -thick / 2, w / 2, yB, thick / 2, '-y').geo());
    const pc = new GB(), pw = clamp(w * 0.03, 0.16, 0.3), e = 0.04;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const xa = sx > 0 ? w / 2 - pw : -w / 2 - e, xb = sx > 0 ? w / 2 + e : -w / 2 + pw;
      const za = sz > 0 ? thick / 2 - pw : -thick / 2 - e, zb = sz > 0 ? thick / 2 + e : -thick / 2 + pw;
      pc.box(xa, baseH, za, xb, yB, zb, '-y+y');
    }
    ctx.add('glaze_green', pc.geo());
    for (const sz of [1, -1]) ornPanel(ctx.at(0, (baseH + yB) / 2, (sz * thick) / 2, sz > 0 ? 0 : Math.PI), w - 2 * pw - 0.5, yB - baseH - 0.45, {});
    return glazeEave(ctx, w, thick, yB, { H: h, tile, roof: opts.roof || 'wudian' });
  }
  // 砖影壁 / 红影壁：砖须弥座 + 墙身 + 冰盘檐瓦帽
  const brick = style === 'brick';
  const sec = wallSection({ h, thick, cap: tile, capOnly: true, batter: 0, sc: clamp(thick / 1.1, 0.55, 1.3) });
  xumi(ctx, rectLoop(w, thick), true, baseH, clamp(h * 0.03, 0.08, 0.2), null, brick ? 'brick' : 'marble');
  ctx.add(brick ? 'brick_grey' : 'wall_red', new GB().box(-w / 2, 0, -thick / 2, w / 2, sec.yTop, thick / 2, '-y+y').geo());
  extrude(ctx, [[w / 2, 0], [-w / 2, 0]], sec.segs, { caps: sec.caps });
  for (const s of [-1, 1]) ctx.place(`wen:${tile}`, s * (w / 2 - 0.1 * sec.sc), sec.yRidge - 0.04, 0, s > 0 ? 0 : Math.PI, 0.5 * sec.sc);
  const m = clamp(w * 0.05, 0.2, 0.45);
  for (const sz of [1, -1]) {
    ornPanel(ctx.at(0, (baseH + sec.yTop) / 2, (sz * thick) / 2, sz > 0 ? 0 : Math.PI), w - 2 * m, sec.yTop - baseH - 2 * m * 0.8, brick ? { kind: 'brick', fill: 'wl_fangzhuan' } : { frame: false });
  }
  return { top: sec.yRidge };
}
