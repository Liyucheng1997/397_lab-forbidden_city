// 斗拱（清式官式做法，以斗口为模数）。
//
// 原型 key：'dougong:<kind>:<cai>[:<配色>[:<描线>]]'
//   kind ∈ 'ping'（平身科）| 'zhu'（柱头科：翘昂逐层加宽，顶为桃尖梁头）| 'jiao'（角科：斜翘斜昂+两向搭交出跳，由昂上立宝瓶）
//   cai  ∈ 1（平身一斗二升交麻叶 / 柱头一斗三升）| 3 单昂 | 5 单翘单昂 | 7 单翘重昂 | 9 重翘重昂 | 11 重翘三昂
//   配色 'a'（默认：斗升青、拱翘昂绿，柱头科/角科用）| 'b'（青绿互换；平身科与柱头科逐攒相间）
//   描线 'g'（默认：金线）| 'm'（墨线）
// 单位：斗口=1，调用方按斗口米数缩放。
// 局部坐标：坐斗底 y=0（平板枋顶），x=0 为攒中线（沿檐），+Z 向外；角科 +X、+Z 为两檐面外侧。
// 竖向：坐斗高 2（斗口槽底 1.2）；第 k 层构件底 Y(k)=1.2+2(k-1)：翘昂足材 2，单材拱 1.4 坐于十八斗/三才升（升高 1：耳.4 腰.2 底.4）。
//   出跳 n=(cai-1)/2，每跳 3；第 n+1 层蚂蚱头·厢拱，第 n+2 层撑头木·挑檐枋；挑檐桁底 H=Y(n+3)=5.2+2n。
// 材质：'dougong'（顶点色；描线为分色倒角小面，无共面叠片，远看不闪）；垫拱板 'dg_dianban'（程序纹理）；盖斗板 'board_red'。
// 三角形（不含 placeDougong 的枋板）：平身科 9 踩≈1.4k，柱头科≈1.4k，角科 9 踩≈2.5k。
import * as THREE from 'three';
import { registerProtoFamily } from './protos.js';
import { registerTexture, canvas } from './textures.js';
import { defineMaterial } from './materials.js';

/** 一攒斗拱的总高（斗口），自平板枋顶至挑檐桁底（= 5.2 + 2·出跳数） */
export function dougongHeight(cai) {
  return 4.2 + Math.max(1, cai);
}
/** 外拽出跳总长（斗口），即自攒中线向外伸出距离 */
export function dougongReach(cai) {
  return cai <= 1 ? 1.5 : ((cai - 1) / 2) * 3;
}
/** 标准攒距（斗口） */
export const DOUGONG_SPACING = 11;

const Y = (k) => 1.2 + 2 * (k - 1);
const R2 = Math.SQRT2, S2 = Math.SQRT1_2;
const outN = (cai) => (cai <= 1 ? 0 : Math.round((cai - 1) / 2));
const qiaoN = (n) => (n <= 1 ? 0 : n >= 4 ? 2 : 1);

// ---------- 彩画色（线性空间） ----------
const C = (h) => new THREE.Color(h);
const PAL = {
  qing: C(0x1f4c8c), lv: C(0x1d6e55), gold: C(0xcf9f45), ink: C(0x16191b),
  fqing: C(0x1e4884), flv: C(0x1c6650),
};
function palette(v, e) {
  const a = v !== 'b';
  return { dou: a ? PAL.qing : PAL.lv, gong: a ? PAL.lv : PAL.qing, edge: e === 'm' ? PAL.ink : PAL.gold };
}

// ---------- 网格累积（平直着色，非索引，带顶点色） ----------
class MB {
  constructor() { this.p = []; this.nm = []; this.c = []; }
  /** h：期望法线方向（自动纠正绕序） */
  tri(a, b, c, col, h) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) return;
    nx /= l; ny /= l; nz /= l;
    if (h && nx * h[0] + ny * h[1] + nz * h[2] < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    for (const q of [a, b, c]) { this.p.push(q[0], q[1], q[2]); this.nm.push(nx, ny, nz); this.c.push(col.r, col.g, col.b); }
  }
  quad(a, b, c, d, col, h) { this.tri(a, b, c, col, h); this.tri(a, c, d, col, h); }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((this.p.length / 3) * 2), 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
}

// 构件坐标系 F：{x,z 原点, d 长向(水平单位向量), n 厚向}；点 (s 沿 d, y 绝对高, w 沿 n)
const P = (F, s, y, w) => [F.x + F.d[0] * s + F.n[0] * w, y, F.z + F.d[1] * s + F.n[1] * w];
const FX = (z, x = 0) => ({ x, z, d: [1, 0], n: [0, 1] });
const FZ = (x, z = 0) => ({ x, z, d: [0, 1], n: [1, 0] });

function ccw(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a < 0 ? poly.slice().reverse() : poly;
}
/** 逆时针多边形向内偏移 e（斜接） */
function inset(poly, e) {
  const N = poly.length, out = [];
  for (let i = 0; i < N; i++) {
    const a = poly[(i - 1 + N) % N], b = poly[i], c = poly[(i + 1) % N];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const n1x = -(b[1] - a[1]) / l1, n1y = (b[0] - a[0]) / l1, n2x = -(c[1] - b[1]) / l2, n2y = (c[0] - b[0]) / l2;
    let bx = n1x + n2x, by = n1y + n2y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-6) { bx = n1x; by = n1y; } else { bx /= bl; by /= bl; }
    const k = e / Math.max(0.4, n1x * bx + n1y * by);
    out.push([b[0] + bx * k, b[1] + by * k]);
  }
  return out;
}
function fill(m, F, poly, w, col, h) {
  const tris = THREE.ShapeUtils.triangulateShape(poly.map(([s, y]) => new THREE.Vector2(s, y)), []);
  for (const [a, b, c] of tris) m.tri(P(F, poly[a][0], poly[a][1], w), P(F, poly[b][0], poly[b][1], w), P(F, poly[c][0], poly[c][1], w), col, h);
}
/** 截面多边形 poly=[[s,y]] 沿 n 拉伸 [w0,w1]。o.f1/o.f0：前(+n)/后(-n)面描线色（倒角边框） */
function prism(m, F, poly, w0, w1, col, o = {}) {
  poly = ccw(poly);
  const N = poly.length, bv = o.bv ?? 0.05, e = o.e ?? 0.1;
  const W1 = o.f1 ? w1 - bv : w1, W0 = o.f0 ? w0 + bv : w0;
  for (let i = 0; i < N; i++) {
    const [s1, y1] = poly[i], [s2, y2] = poly[(i + 1) % N];
    const hs = y2 - y1, hy = -(s2 - s1);
    m.quad(P(F, s1, y1, W0), P(F, s2, y2, W0), P(F, s2, y2, W1), P(F, s1, y1, W1), col, [F.d[0] * hs, hy, F.d[1] * hs]);
  }
  for (const [w, W, sg, fc] of [[w1, W1, 1, o.f1], [w0, W0, -1, o.f0]]) {
    const h = [F.n[0] * sg, 0, F.n[1] * sg];
    if (!fc) { fill(m, F, poly, w, col, h); continue; }
    const inn = inset(poly, e);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      m.quad(P(F, poly[i][0], poly[i][1], W), P(F, poly[j][0], poly[j][1], W), P(F, inn[j][0], inn[j][1], w), P(F, inn[i][0], inn[i][1], w), fc, h);
    }
    fill(m, F, inn, w, col, h);
  }
}
/** 竖直矩形面（共面分色描框）：A、B 为底边两端（3D），高 y0..y1 */
function rectFace(m, A, B, y0, y1, col, h, fc, e = 0.09) {
  const L = Math.hypot(B[0] - A[0], B[2] - A[2]);
  const at = (t, y) => [A[0] + ((B[0] - A[0]) * t) / L, y, A[2] + ((B[2] - A[2]) * t) / L];
  if (!fc || y1 - y0 < 3 * e) { m.quad(at(0, y0), at(L, y0), at(L, y1), at(0, y1), col, h); return; }
  const ts = [0, e, L - e, L], ys = [y0, y0 + e, y1 - e, y1];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    m.quad(at(ts[i], ys[j]), at(ts[i + 1], ys[j]), at(ts[i + 1], ys[j + 1]), at(ts[i], ys[j + 1]), i === 1 && j === 1 ? col : fc, h);
  }
}
/**
 * 斗/升：中心 (s,w)，底 y；ls 沿 d、lw 沿 n、高 h。
 * o.bi 斗底收分，o.tp 斗欹高；o.slot={n,d,y}：±n 面 / ±d 面上的斗口槽宽，槽底 y；o.top 顶面；o.fr 正面(+n)描线色
 */
function dou(m, F, s, y, w, ls, lw, h, col, o = {}) {
  const bi = o.bi ?? 0.2 * h, tp = o.tp ?? 0.4 * h, y1 = y + tp, y2 = y + h;
  const hs = ls / 2, hw = lw / 2;
  const Q = (a, b, yy) => P(F, s + a, yy, w + b);
  const cs = [[hs, -hw], [hs, hw], [-hs, hw], [-hs, -hw]];
  const dirs = [[F.d[0], 0, F.d[1]], [F.n[0], 0, F.n[1]], [-F.d[0], 0, -F.d[1]], [-F.n[0], 0, -F.n[1]]];
  if (o.plain) {
    for (let f = 0; f < 4; f++) { const [a1, b1] = cs[f], [a2, b2] = cs[(f + 1) % 4]; m.quad(Q(a1, b1, y + tp * 0.5), Q(a2, b2, y + tp * 0.5), Q(a2, b2, y2), Q(a1, b1, y2), col, dirs[f]); }
    return;
  }
  for (let f = 0; f < 4; f++) {
    const [a1, b1] = cs[f], [a2, b2] = cs[(f + 1) % 4], hn = dirs[f];
    const sh = (v, full) => (Math.sign(v) * (Math.abs(full) - bi));
    m.quad(Q(sh(a1, hs), sh(b1, hw), y), Q(sh(a2, hs), sh(b2, hw), y), Q(a2, b2, y1), Q(a1, b1, y1), col, [hn[0], -0.3, hn[2]]);
    const sw = o.slot ? (f % 2 === 1 ? o.slot.n : o.slot.d) : 0;
    if (sw > 0) {
      const ys = o.slot.y;
      m.quad(Q(a1, b1, y1), Q(a2, b2, y1), Q(a2, b2, ys), Q(a1, b1, ys), col, hn);
      // 两耳
      const mid = [(a1 + a2) / 2, (b1 + b2) / 2], L = Math.hypot(a2 - a1, b2 - b1), ux = (a2 - a1) / L, uy = (b2 - b1) / L;
      const m1 = [mid[0] - (ux * sw) / 2, mid[1] - (uy * sw) / 2], m2 = [mid[0] + (ux * sw) / 2, mid[1] + (uy * sw) / 2];
      m.quad(Q(a1, b1, ys), Q(m1[0], m1[1], ys), Q(m1[0], m1[1], y2), Q(a1, b1, y2), col, hn);
      m.quad(Q(m2[0], m2[1], ys), Q(a2, b2, ys), Q(a2, b2, y2), Q(m2[0], m2[1], y2), col, hn);
    } else rectFace(m, Q(a1, b1, 0), Q(a2, b2, 0), y1, y2, col, hn, f === 1 ? o.fr : null, o.fe ?? 0.08);
  }
  if (o.top) {
    const up = [0, 1, 0];
    if (o.slot) {
      const ed = o.slot.n / 2, en = o.slot.d / 2;
      for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        m.quad(Q(sa * ed, sb * en, y2), Q(sa * hs, sb * en, y2), Q(sa * hs, sb * hw, y2), Q(sa * ed, sb * hw, y2), col, up);
      }
    } else m.quad(Q(hs, hw, y2), Q(-hs, hw, y2), Q(-hs, -hw, y2), Q(hs, -hw, y2), col, up);
  }
}

// ---------- 截面轮廓 ----------
/** 卷杀弧：右端自底向上 / 左端自上向下 */
function arcR(se, yb, a, b, sg) {
  const r = [];
  for (let i = 0; i <= sg; i++) { const f = -Math.PI / 2 + (i / sg) * (Math.PI / 2); r.push([se - a + a * Math.cos(f), yb + b + b * Math.sin(f)]); }
  return r;
}
function arcL(se, yb, a, b, sg) {
  const r = [];
  for (let i = 0; i <= sg; i++) { const f = Math.PI + (i / sg) * (Math.PI / 2); r.push([se + a + a * Math.cos(f), yb + b + b * Math.sin(f)]); }
  return r;
}
/** 拱（立面）：长 L 高 h，两端卷杀 */
const gongPoly = (L, yb, h, a, sg) => [...arcR(L / 2, yb, a, 0.8, sg), [L / 2, yb + h], [-L / 2, yb + h], ...arcL(-L / 2, yb, a, 0.8, sg)];
/** 翘（侧面）：外端 sR、内端 -sL，足材 */
const qiaoPoly = (sR, sL, yb, sgR, sgL) => [...arcR(sR, yb, 1.0, 0.8, sgR), [sR, yb + 2], [-sL, yb + 2], ...arcL(-sL, yb, 1.0, 0.8, sgL)];
/** 昂头（右端，自底向上）：跳中 S，下皮自 s0 起斜下至昂嘴；sc 长度比例，dr 下垂 */
function angHead(S, yb, s0, sc = 1, dr = 1) {
  const T = S + 2.0 * sc;
  return [[s0, yb], [T, yb - dr], [T + 0.07 * sc, yb - dr + 0.38],
    [S + 1.8 * sc, yb + 0.25], [S + 1.3 * sc, yb + 1.06], [S + 0.74, yb + 1.4], [S + 0.45, yb + 2]];
}
/** 蚂蚱头（右端，自底向上），尖端 E */
const mazhaHead = (E, yb) => [[E - 0.25, yb], [E - 0.25, yb + 0.7], [E, yb + 1.15], [E - 0.95, yb + 2]];
/** 麻叶云头（右端，自底向上），尖端 E */
const mayeHead = (E, yb) => [[E - 1.4, yb], [E - 0.85, yb + 0.15], [E - 0.6, yb + 0.5], [E - 0.82, yb + 0.82], [E - 0.3, yb + 0.95],
  [E, yb + 1.3], [E - 0.12, yb + 1.7], [E - 0.6, yb + 2]];

// ---------- 正身（平身科 / 柱头科） ----------
function buildZheng(m, zhu, n, pal) {
  const q = qiaoN(n), g = pal.gong, d = pal.dou, ec = pal.edge;
  const F0 = FX(0), Fz = FZ(0);
  const wk = (k) => (zhu ? 2 + (2 * (k - 1)) / n : 1);
  dou(m, F0, 0, 0, 0, zhu ? 4 : 3, 3, 2, d, { bi: 0.4, slot: { n: wk(1), d: 1.24, y: 1.2 }, top: true });
  // 翘、昂（内尾均作翘头），跳头十八斗（柱头科为筒子十八斗）
  for (let k = 1; k <= n; k++) {
    const yb = Y(k), w = wk(k), S = 3 * k;
    const poly = k <= q
      ? qiaoPoly(S + 0.7, S + 0.7, yb, 3, 1)
      : [...angHead(S, yb, Math.max(S - 3 + 0.74, 1.5)), [-(S + 0.7), yb + 2], ...arcL(-(S + 0.7), yb, 1.0, 0.8, 1)];
    prism(m, Fz, poly, -w / 2, w / 2, g, { f1: ec, f0: ec });
    const dl = zhu ? w + 0.8 : 1.8;
    dou(m, Fz, S, yb + 1.4, 0, 1.48, dl, 1, d);
    dou(m, Fz, -S, yb + 1.4, 0, 1.48, dl, 1, d, { plain: true });
  }
  if (zhu) {
    // 桃尖梁头（宽 4，占蚂蚱头、撑头木两层）
    const S = 3 * n, yb = Y(n + 1), top = Y(n + 3), sL = S + 1.5;
    const poly = [[-sL, yb], [S + 1.9, yb], [S + 2.15, yb + 0.35], [S + 2.55, yb + 0.8], [S + 3.1, yb + 1.25],
      [S + 2.95, yb + 2.0], [S + 2.5, yb + 2.8], [S + 1.7, yb + 3.5], [S + 0.6, top], [-sL, top]];
    prism(m, Fz, poly, -2, 2, g, { f1: ec, f0: ec, e: 0.14 });
  } else {
    const S = 3 * n, ybm = Y(n + 1), ybc = Y(n + 2), sL = S + 1.2, sC = S + 2.2;
    prism(m, Fz, [[-sL + 0.35, ybm], ...mazhaHead(S + 2.6, ybm), [-sL, ybm + 2], [-sL, ybm + 0.55]], -0.5, 0.5, g, { f1: ec, f0: ec });
    prism(m, Fz, [[-sC + 0.6, ybc], [S + 0.3, ybc], [S + 0.3, ybc + 2], [-sC + 0.3, ybc + 2], [-sC - 0.1, ybc + 1.55], [-sC + 0.35, ybc + 1.1], [-sC, ybc + 0.6]], -0.5, 0.5, g);
  }
  // 正心瓜拱、正心万拱（足材，槽升子）
  zxGong(m, FX(0), Y(1), 6.2, 3, g, d, ec);
  zxGong(m, FX(0), Y(2), 9.2, 2, g, d, ec);
  // 外拽 / 里拽：单才瓜拱、单才万拱、厢拱（三才升）
  for (let j = 1; j <= n; j++) for (const sgn of [1, -1]) {
    const F = FX(3 * j * sgn), out = sgn > 0;
    const list = j < n ? [[Y(j + 1), 6.2, 1.1], [Y(j + 2), 9.2, 1.0]] : [[Y(n + 1), 7.2, 1.15]];
    for (const [yb, L, a] of list) {
      prism(m, F, gongPoly(L, yb, 1.4, a, out ? 2 : 1), -0.5, 0.5, g, out ? { f1: ec } : {});
      for (const s of [-(L / 2 - 0.6), L / 2 - 0.6]) dou(m, F, s, yb + 1.4, 0, 1.3, 1.48, 1, d, { plain: !out });
    }
  }
}
function zxGong(m, F, yb, L, sg, g, d, ec) {
  prism(m, F, gongPoly(L, yb, 2, 1.0, sg), -0.62, 0.62, g, { f1: ec });
  for (const s of [-(L / 2 - 0.6), L / 2 - 0.6]) dou(m, F, s, yb + 1.4, 0, 1.3, 1.72, 1, d);
}

// ---------- 一斗三升 / 一斗二升交麻叶 ----------
function buildYidou(m, kind, pal) {
  const g = pal.gong, d = pal.dou, ec = pal.edge, yb = Y(1);
  const jiao = kind === 'jiao';
  dou(m, FX(0), 0, 0, 0, 3, 3, 2, d, { bi: 0.4, slot: { n: jiao ? 1.24 : 1, d: 1.24, y: 1.2 }, top: true });
  if (!jiao) {
    zxGong(m, FX(0), yb, 6.2, 3, g, d, ec);
    if (kind === 'zhu') {
      dou(m, FX(0), 0, yb + 1.4, 0, 1.3, 1.72, 1, d);
      // 梁头（承檩）
      const y2 = Y(2), top = dougongHeight(1);
      prism(m, FZ(0), [[-3, y2], [2.2, y2], [2.75, y2 + 0.3], [3.1, y2 + 0.85], [3.0, y2 + 1.5], [2.5, top], [-3, top]], -1.25, 1.25, g, { f1: ec, f0: ec, e: 0.12 });
    } else {
      prism(m, FZ(0), [...mayeHead(3.6, yb), [-2.2, yb + 2], [-2.2, yb]], -0.5, 0.5, g, { f1: ec, f0: ec });
    }
    return;
  }
  // 角科：搭交正心瓜拱后带麻叶头 + 斜麻叶头
  for (const F of [FX(0), FZ(0)]) {
    const poly = [...mayeHead(3.6, yb), [-3.1, yb + 2], ...arcL(-3.1, yb, 1.0, 0.8, 3)];
    prism(m, F, poly, -0.62, 0.62, g, { f1: ec });
    dou(m, F, -2.5, yb + 1.4, 0, 1.3, 1.72, 1, d);
  }
  const FD = { x: 0, z: 0, d: [S2, S2], n: [S2, -S2] };
  prism(m, FD, [...mayeHead(4.8, yb), [-1.6, yb + 2], [-1.6, yb]], -0.65, 0.65, g, { f1: ec, f0: ec });
}

// ---------- 角科 ----------
function buildJiao(m, n, pal) {
  const q = qiaoN(n), g = pal.gong, d = pal.dou, ec = pal.edge;
  dou(m, FX(0), 0, 0, 0, 3, 3, 2, d, { bi: 0.4, slot: { n: 1.24, d: 1.24, y: 1.2 }, top: true });
  // 两向搭交构件：线 j（距正心 3j）在第 L 层，内段为本面拱/枋，外段为邻面翘/昂/蚂蚱头/撑头木
  for (let ax = 0; ax < 2; ax++) for (let j = 0; j <= n; j++) {
    const F = ax ? FZ(3 * j) : FX(3 * j);
    for (let L = j + 1; L <= n + 2; L++) {
      if (j === n && L === n + 2) continue; // 挑檐枋由 placeDougong 生成
      const yb = Y(L);
      if (L === n + 2) { // 撑头木层：藏于挑檐枋后，素方木
        prism(m, F, [[3 * j - 0.4, yb], [3 * n + 0.3, yb], [3 * n + 0.3, yb + 2], [3 * j - 0.4, yb + 2]], -0.46, 0.46, g);
        continue;
      }
      let inn = null;
      if (L === j + 1) inn = { len: j === n ? 7.2 : 6.2 };
      else if (L === j + 2 && j < n) inn = { len: 9.2 };
      let right;
      if (L <= q) { const T = 3 * L + 0.7; right = [...arcR(T, yb, 1.0, 0.8, 2), [T, yb + 2]]; }
      else if (L <= n) right = angHead(3 * L, yb, Math.max(3 * (L - 1) + 0.74, L === 1 ? 1.5 : 0));
      else if (L === n + 1) right = mazhaHead(3 * n + 2.6, yb);
      else right = [[3 * n + 0.3, yb], [3 * n + 0.3, yb + 2]];
      let left;
      if (inn) {
        const sL = -inn.len / 2; // 后带半拱（角科内作足材）
        left = [[sL, yb + 2], ...arcL(sL, yb, 1.0, 0.8, j === 0 || j === n ? 2 : 1)];
      } else left = [[3 * j - 0.4, yb + 2], [3 * j - 0.4, yb]];
      const t = inn ? (j === 0 ? 1.24 : 1) : 0.92;
      prism(m, F, [...right, ...left], -t / 2, t / 2, g, { f1: ec });
      if (inn) dou(m, F, -(inn.len / 2 - 0.6), yb + 1.4, 0, 1.3, j === 0 ? 1.72 : 1.48, 1, d);
      if (L <= n) dou(m, F, 3 * L, yb + 1.4, 0, 1.48, 1.8, 1, d);
    }
  }
  // 斜翘、斜昂、由昂（宽逐层加），斜跳头平盘斗
  const FD = { x: 0, z: 0, d: [S2, S2], n: [S2, -S2] };
  for (let k = 1; k <= n + 1; k++) {
    const yb = Y(k), w = 1.5 + 0.3 * (k - 1), S = 3 * k * R2, sL = 3 * k + 0.7;
    const tail = [[-sL, yb + 2], [-sL, yb + 0.7], [-sL + 0.6, yb]];
    let head;
    if (k <= q) head = [...arcR(S + 1.0, yb, 1.1, 0.8, 2), [S + 1.0, yb + 2]];
    else if (k <= n) head = angHead(S, yb, Math.max(3 * (k - 1) * R2 + 1.1, k === 1 ? 2.0 : 0), 1.3, 1.15);
    else {
      // 由昂：昂身平出过挑檐桁交点，昂背立宝瓶承老角梁
      const S0 = 3 * n * R2, sb = S0 + 3.0, T = sb + 2.3;
      head = [[S0 + 1.0, yb], [T, yb - 0.9], [T + 0.08, yb - 0.5], [T - 0.2, yb + 0.15], [T - 0.62, yb + 0.95], [T - 1.25, yb + 1.65], [sb + 0.75, yb + 2]];
      baoping(m, sb * S2, yb + 2, sb * S2, Y(n + 3) + 2.0, g, ec);
    }
    prism(m, FD, [...head, ...tail], -w / 2, w / 2, g, { f1: ec, f0: ec });
    if (k <= n) dou(m, FX(3 * k), 3 * k, yb + 1.4, 0, 1.8, 1.8, 0.6, d, { tp: 0.4, bi: 0.2 });
  }
}
/** 宝瓶（八棱瓶身），底 y0 至顶 y1 */
function baoping(m, x, y0, z, y1, g, ec) {
  const H = y1 - y0, seg = 6;
  const prof = [[0.6, 0], [0.88, 0.22], [0.8, 0.5], [0.44, 0.68], [0.44, 0.78], [0.8, 0.86], [0.8, 1]];
  const cols = [g, g, g, ec, g, ec];
  for (let i = 0; i < prof.length - 1; i++) {
    const [r1, t1] = prof[i], [r2, t2] = prof[i + 1];
    for (let k = 0; k < seg; k++) {
      const a1 = (k / seg) * Math.PI * 2, a2 = ((k + 1) / seg) * Math.PI * 2, am = (a1 + a2) / 2;
      const p = (r, a, t) => [x + r * Math.cos(a), y0 + t * H, z + r * Math.sin(a)];
      m.quad(p(r1, a1, t1), p(r1, a2, t1), p(r2, a2, t2), p(r2, a1, t2), cols[i], [Math.cos(am), (r1 - r2) / H, Math.sin(am)]);
    }
  }
  const r = prof.at(-1)[0];
  for (let k = 0; k < seg; k++) {
    const a1 = (k / seg) * Math.PI * 2, a2 = ((k + 1) / seg) * Math.PI * 2;
    m.tri([x, y1, z], [x + r * Math.cos(a1), y1, z + r * Math.sin(a1)], [x + r * Math.cos(a2), y1, z + r * Math.sin(a2)], g, [0, 1, 0]);
  }
}

registerProtoFamily('dougong', (key, [kind, caiS, v = 'a', e = 'g']) => {
  const cai = +caiS, n = outN(cai), pal = palette(v, e);
  const m = new MB();
  if (n === 0) buildYidou(m, kind, pal);
  else if (kind === 'jiao') buildJiao(m, n, pal);
  else buildZheng(m, kind === 'zhu', n, pal);
  return [{ mat: 'dougong', geo: m.geo() }];
});

// ---------- 垫拱板纹理：红地、沿拱眼轮廓沥粉金线、火焰宝珠 ----------
// u 0..1 = 攒中至邻攒中（按 11 斗口绘制），v 0..1 = 平板枋顶至正心枋底
function dianbanOutline(top) {
  const L = [[1.1, 0], [1.5, 0.8], [1.5, 1.2], [2.1, 1.2], [2.6, 1.3], [2.95, 1.6], [3.1, 2.0], [3.1, 2.6], [3.15, 3.0], [3.15, 3.2]];
  if (top > 3.3) L.push([3.6, 3.2], [4.1, 3.3], [4.45, 3.6], [4.6, 4.0], [4.6, 4.6], [4.65, 5.0], [4.65, top]);
  return [...L, ...L.slice().reverse().map(([u, v]) => [DOUGONG_SPACING - u, v])];
}
function drawDianban(top) {
  const W = 512, Hp = Math.round((W * top) / DOUGONG_SPACING / 4) * 4;
  const c = canvas(W, Hp), g = c.getContext('2d');
  const k = W / DOUGONG_SPACING, X = (u) => u * k, Yv = (v) => (1 - v / top) * Hp;
  g.fillStyle = '#922c1f';
  g.fillRect(0, 0, W, Hp);
  const path = () => { g.beginPath(); dianbanOutline(top).forEach(([u, v], i) => (i ? g.lineTo(X(u), Yv(v)) : g.moveTo(X(u), Yv(v)))); g.closePath(); };
  g.lineJoin = 'round';
  path(); g.strokeStyle = '#d9ab52'; g.lineWidth = 0.62 * k; g.stroke();
  path(); g.strokeStyle = '#922c1f'; g.lineWidth = 0.3 * k; g.stroke();
  // 火焰宝珠
  const cx = X(DOUGONG_SPACING / 2), cy = Yv(top > 3.3 ? 2.15 : 1.55), r = (top > 3.3 ? 0.72 : 0.55) * k;
  g.fillStyle = '#e0a83c';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42, L = r * (i === 3 ? 2.1 : 1.75 - Math.abs(i - 3) * 0.12);
    g.beginPath();
    g.moveTo(cx + Math.cos(a - 0.32) * r * 0.9, cy + Math.sin(a - 0.32) * r * 0.9);
    g.quadraticCurveTo(cx + Math.cos(a - 0.1) * L * 0.85, cy + Math.sin(a - 0.1) * L * 0.85, cx + Math.cos(a + 0.12) * L, cy + Math.sin(a + 0.12) * L);
    g.quadraticCurveTo(cx + Math.cos(a + 0.2) * r * 1.2, cy + Math.sin(a + 0.2) * r * 1.2, cx + Math.cos(a + 0.32) * r * 0.9, cy + Math.sin(a + 0.32) * r * 0.9);
    g.fill();
  }
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  gr.addColorStop(0, '#fff1c2'); gr.addColorStop(0.55, '#e8b44a'); gr.addColorStop(1, '#b07a22');
  g.fillStyle = gr;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a4a14'; g.lineWidth = Math.max(2, 0.06 * k); g.stroke();
  // 两侧卷云
  g.strokeStyle = '#d9ab52'; g.lineWidth = Math.max(2, 0.12 * k); g.lineCap = 'round';
  for (const sx of [-1, 1]) {
    const ox = cx + sx * r * 2.1, oy = cy + r * 0.9;
    g.beginPath(); g.arc(ox, oy, r * 0.45, sx > 0 ? Math.PI : 0, sx > 0 ? Math.PI * 2.6 : -Math.PI * 1.6, sx < 0); g.stroke();
    g.beginPath(); g.moveTo(ox - sx * r * 0.45, oy); g.quadraticCurveTo(ox - sx * r * 1.0, oy + r * 0.6, ox - sx * r * 1.5, oy + r * 0.2); g.stroke();
  }
  return c;
}
registerTexture('dg_dianban', () => drawDianban(Y(3)));
registerTexture('dg_dianban1', () => drawDianban(Y(2)));
defineMaterial('dg_dianban', { color: 0xffffff, map: 'dg_dianban', roughness: 0.62 });
defineMaterial('dg_dianban1', { color: 0xffffff, map: 'dg_dianban1', roughness: 0.62 });

// ---------- 带 UV 的简单面片累积（垫拱板 / 盖斗板） ----------
class QB {
  constructor() { this.p = []; this.n = []; this.u = []; }
  quad(pts, uvs, nrm) {
    for (const i of [0, 1, 2, 0, 2, 3]) { this.p.push(...pts[i]); this.n.push(...nrm); this.u.push(...uvs[i]); }
  }
  geo(s) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p.map((v) => v * s), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    return g;
  }
}
/** 水平/竖直四边形：按给定法线自动排序为逆时针 */
function orient(pts, nrm) {
  const [a, b, c] = pts;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const d = (uy * vz - uz * vy) * nrm[0] + (uz * vx - ux * vz) * nrm[1] + (ux * vy - uy * vx) * nrm[2];
  return d < 0 ? [0, 3, 2, 1] : [0, 1, 2, 3];
}
function addQuad(qb, pts, uvs, nrm) {
  const o = orient(pts, nrm);
  qb.quad(o.map((i) => pts[i]), o.map((i) => uvs[i]), nrm);
}

/** 枋：沿 x 的长方木，x∈[xa,xb]，中线 z，底 y0 高 h 厚 t；外面(+z 或 -z)上下各一道描线 */
function fang(m, xa, xb, z, y0, h, t, col, ec, face = 1) {
  const y1 = y0 + h, z0 = z - t / 2, z1 = z + t / 2;
  const fz = face > 0 ? z1 : z0, bz = face > 0 ? z0 : z1, e = 0.13;
  const bands = ec ? [[y0, y0 + e, ec], [y0 + e, y1 - e, col], [y1 - e, y1, ec]] : [[y0, y1, col]];
  for (const [a, b, c] of bands) m.quad([xa, a, fz], [xb, a, fz], [xb, b, fz], [xa, b, fz], c, [0, 0, face]);
  m.quad([xa, y0, bz], [xb, y0, bz], [xb, y1, bz], [xa, y1, bz], col, [0, 0, -face]);
  m.quad([xa, y0, z0], [xb, y0, z0], [xb, y0, z1], [xa, y0, z1], col, [0, -1, 0]);
  m.quad([xa, y1, z0], [xb, y1, z0], [xb, y1, z1], [xa, y1, z1], col, [0, 1, 0]);
  m.quad([xa, y0, z0], [xa, y1, z0], [xa, y1, z1], [xa, y0, z1], col, [-1, 0, 0]);
  m.quad([xb, y0, z0], [xb, y1, z0], [xb, y1, z1], [xb, y0, z1], col, [1, 0, 0]);
}

/** 枋出头霸王拳：F 原点在出头起点，s 向外，长 1.6 */
function bawang(m, F, y0, t, col, ec) {
  const p = [[0, y0], [1.0, y0], [1.25, y0 + 0.25], [1.2, y0 + 0.55], [1.45, y0 + 0.75], [1.6, y0 + 1.15], [1.45, y0 + 1.55], [1.55, y0 + 1.85], [1.4, y0 + 2], [0, y0 + 2]];
  prism(m, F, p, -t / 2, t / 2, col, { f1: ec, f0: ec });
}

/**
 * 沿矩形檐柱网布置一圈斗拱（含正心枋、拽枋、挑檐枋、里拽枋、井口枋、垫拱板、盖斗板）。
 * opts:
 *  colsX: 檐柱 x 坐标数组（升序，含两端角柱），colsZ: 檐柱 z 坐标数组（升序，含两端角柱）
 *  y: 平板枋顶面高度（斗拱坐斗底）
 *  kou: 斗口（米）
 *  cai: 踩数
 *  perBay: 每间平身科攒数（默认按 DOUGONG_SPACING 计算，可传数组按间指定，数组按坐标升序）
 *  sides: 布置的檐面 ['S','N','E','W']（默认四面；相邻两面都布置时转角用角科，否则用柱头科）
 *  edge: 'gold'（默认，金线）| 'ink'（墨线，用于次要建筑）
 *  boards: false 时不生成垫拱板/盖斗板（默认 true）
 * 返回 { top: 斗拱顶（挑檐桁底）高度 y, reach: 外跳米数, count: 攒数 }
 */
export function placeDougong(ctx, opts) {
  const { colsX, colsZ, y, kou, cai = 5, sides = ['S', 'N', 'E', 'W'] } = opts;
  const n = outN(cai), nz = n === 0 ? 1 : 2;
  const H = dougongHeight(cai), R = dougongReach(cai);
  const ink = opts.edge === 'ink', boards = opts.boards !== false;
  const key = (kind, b) => `dougong:${kind}:${cai}` + (b || ink ? `:${b ? 'b' : 'a'}${ink ? ':m' : ''}` : '');
  const x0 = colsX[0], x1 = colsX[colsX.length - 1], z0 = colsZ[0], z1 = colsZ[colsZ.length - 1];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const SD = {
    S: { o: [cx, z1], r: 0, cols: colsX.map((x) => x - cx), rev: false, adj: ['W', 'E'] },
    N: { o: [cx, z0], r: Math.PI, cols: colsX.map((x) => cx - x).reverse(), rev: true, adj: ['E', 'W'] },
    E: { o: [x1, cz], r: Math.PI / 2, cols: colsZ.map((z) => cz - z).reverse(), rev: true, adj: ['S', 'N'] },
    W: { o: [x0, cz], r: -Math.PI / 2, cols: colsZ.map((z) => z - cz), rev: false, adj: ['N', 'S'] },
  };
  const ec = ink ? PAL.ink : PAL.gold;
  let count = 0;
  for (const sd of ['S', 'E', 'N', 'W']) {
    if (!sides.includes(sd)) continue;
    const S = SD[sd], cols = S.cols, nb = cols.length - 1;
    const cs = ctx.at(S.o[0], y, S.o[1], S.r);
    const cA = sides.includes(S.adj[0]), cB = sides.includes(S.adj[1]);
    const pos = [];
    for (let i = 0; i <= nb; i++) {
      const x = cols[i];
      if (i > 0 && i < nb) { cs.place(key('zhu', false), x, 0, 0, 0, kou); count++; }
      else if (i === nb) { cs.place(key(cB ? 'jiao' : 'zhu', false), x, 0, 0, 0, kou); count++; }
      else if (!cA) { cs.place(key('zhu', false), x, 0, 0, 0, kou); count++; }
      pos.push(x / kou);
      if (i === nb) break;
      const bay = cols[i + 1] - x, bi = S.rev ? nb - 1 - i : i, bk = bay / kou;
      // 默认攒数：攒距近 11 斗口，且不小于 9.6（相邻万拱不相交）
      const cnt = Array.isArray(opts.perBay) ? opts.perBay[bi] ?? 0 : opts.perBay ?? Math.max(0, Math.min(Math.round(bk / DOUGONG_SPACING), Math.floor(bk / 9.6)) - 1);
      for (let k = 1; k <= cnt; k++) {
        const px = x + (bay * k) / (cnt + 1);
        cs.place(key('ping', Math.min(k, cnt + 1 - k) % 2 === 1), px, 0, 0, 0, kou); // 自两柱头科向间中青绿相间
        pos.push(px / kou);
        count++;
      }
    }
    // ---- 枋（斗口单位，局部：x 沿檐，+z 外） ----
    const half = (cols[nb] - cols[0]) / 2 / kou;
    const m = new MB();
    const span = (d, t, chu = 0) => [cA ? -(half + d + t / 2 + chu) : -(half + 3), cB ? half + d + t / 2 + chu : half + 3];
    // 转角出头（挑檐枋；一斗三升为正心枋）：方木至 c，外接霸王拳
    const chu = (z, t, yo, col) => {
      const c = half + z + t / 2 + 0.6;
      if (cA) bawang(m, { x: -c, z, d: [-1, 0], n: [0, 1] }, yo, t, col, ec);
      if (cB) bawang(m, { x: c, z, d: [1, 0], n: [0, 1] }, yo, t, col, ec);
    };
    for (let L = nz + 1; L <= n + 2; L++) {
      const col = L % 2 ? PAL.flv : PAL.fqing;
      const [a, b] = span(0, 1.24, n === 0 ? 0.6 : 0);
      fang(m, a, b, 0, Y(L), 2, 1.24, col, null);
      if (n === 0) chu(0, 1.24, Y(L), col);
    }
    for (let j = 1; j <= n; j++) {
      const top = j === n;
      const yo = top ? Y(n + 2) : Y(j + 3);
      const [a, b] = span(3 * j, 1, top ? 0.6 : 0);
      fang(m, a, b, 3 * j, yo, 2, 1, top ? PAL.fqing : PAL.flv, ec, 1);
      if (top) chu(3 * j, 1, yo, PAL.fqing);
      const [c, d] = span(-3 * j, 1);
      fang(m, c, d, -3 * j, yo, top ? 3 : 2, 1, top ? PAL.fqing : PAL.flv, null, -1);
    }
    cs.add('dougong', m.geo().scale(kou, kou, kou));
    if (!boards) continue;
    // ---- 垫拱板：攒间，u 两端按斗口对位、中段拉伸 ----
    const qb = new QB(), yt = Y(nz + 1), sp = DOUGONG_SPACING;
    for (let i = 0; i < pos.length - 1; i++) {
      const xa = pos[i], xb = pos[i + 1], D = xb - xa, e = Math.min(4.8, D / 2 - 0.3);
      const xs = [xa, xa + e, xb - e, xb], us = [0, e / sp, 1 - e / sp, 1];
      for (let k = 0; k < 3; k++) for (const zz of [0.12, -0.12]) {
        addQuad(qb, [[xs[k], 0, zz], [xs[k + 1], 0, zz], [xs[k + 1], yt, zz], [xs[k], yt, zz]], [[us[k], 0], [us[k + 1], 0], [us[k + 1], 1], [us[k], 1]], [0, 0, Math.sign(zz)]);
      }
    }
    cs.add(nz === 2 ? 'dg_dianban' : 'dg_dianban1', qb.geo(kou));
    // ---- 盖斗板：相邻两缝枋之间，转角处 45° 斜接 ----
    if (n > 0) {
      const gb = new QB();
      for (let j = 1; j <= n; j++) for (const sgn of [1, -1]) {
        const yy = (j < n ? Y(j + 3) : Y(n + 2)) + 0.02;
        const za = 3 * (j - 1) * sgn, zb = 3 * j * sgn;
        const ex = (zz, c) => (c ? half + zz : half + 3);
        const quad = [[-ex(za, cA), yy, za], [ex(za, cB), yy, za], [ex(zb, cB), yy, zb], [-ex(zb, cA), yy, zb]];
        const uv = quad.map((p) => [p[0], p[2]]);
        addQuad(gb, quad, uv, [0, -1, 0]);
        addQuad(gb, quad, uv, [0, 1, 0]);
      }
      cs.add('board_red', gb.geo(kou));
    }
  }
  return { top: y + H * kou, reach: R * kou, count };
}
