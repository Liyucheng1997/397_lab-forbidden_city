// 陈设与小品：铜狮、铜缸、日晷、嘉量、铜龟、铜鹤、香炉（鼎）、石灯、旗杆、石碑、桥。【接口桩：签名与约定固定，实现可替换】
// 原型统一以“实物真实高度 = 1 单位”为单位尺寸建模（底面 y=0，正面朝 +Z），调用方按真实高度缩放：
//   'lion:m'/'lion:f' 铜狮（雄踩绣球/雌抚幼狮）含须弥座，真实总高约 4.4m（太和门前）；'lion:m:gilt' 鎏金铜狮（乾清门、养心门）
//   'vat:gilt'/'vat:bronze'/'vat:iron' 铜缸（含石座），约 1.6m
//   'sundial' 日晷（含石座），约 2.6m；'jialiang' 嘉量（含石亭座），约 2.6m
//   'tortoise' 铜龟（含座），约 2.2m；'crane' 铜鹤（含座），约 2.6m
//   'censer:ding' 鼎式香炉（三足，含座），约 2.0m；'censer:tower' 塔式香炉，约 3.0m
//   'lamp:stone' 石灯，约 2.2m；'flagpole' 旗杆，约 12m；'stele' 石碑（含龟趺），约 4m
// 桥栏构件原型（实际尺寸建模，scale=1）：'pr_post:24|dragon|stone' 望柱，'pr_baogu' 抱鼓石
import * as THREE from 'three';
import { registerProtoFamily } from './protos.js';
import { boxGeo, cylGeo, merge, fromArrays, sweep, clamp, smooth } from './geom.js';
import { defineMaterial } from './materials.js';
import { registerTexture, canvas, rng, normalFromHeight } from './textures.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const _m = new THREE.Matrix4();

/** 各原型的真实高度（米），调用方 place(key, x, y, z, rot, propHeight(key)) */
export const PROP_HEIGHTS = {
  lion: 4.4, vat: 1.6, sundial: 2.6, jialiang: 2.6, tortoise: 2.2, crane: 2.6,
  'censer:ding': 2.0, 'censer:tower': 3.0, lamp: 2.2, flagpole: 12, stele: 4.0,
};
export function propHeight(key) {
  const [p, a] = key.split(':');
  return PROP_HEIGHTS[`${p}:${a}`] ?? PROP_HEIGHTS[p] ?? 1;
}

// ---------- 纹理与材质 ----------
const FONT = '"KaiTi","STKaiti","SimSun","Songti SC",serif';
registerTexture('pr_dial', () => {
  const S = 512, c = canvas(S), g = c.getContext('2d'), r = rng(17), C = S / 2;
  g.fillStyle = '#e6e2d8'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(120,108,90,${0.02 + r() * 0.04})`; g.beginPath(); g.arc(r() * S, r() * S, 6 + r() * 24, 0, TAU); g.fill(); }
  g.strokeStyle = '#6c665a'; g.lineCap = 'round';
  for (const [k, w] of [[0.47, 5], [0.41, 3], [0.235, 3], [0.05, 3]]) { g.lineWidth = w; g.beginPath(); g.arc(C, C, k * S, 0, TAU); g.stroke(); }
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * TAU, l0 = i % 8 === 0 ? 0.235 : i % 4 === 0 ? 0.38 : 0.41;
    g.lineWidth = i % 8 === 0 ? 3 : 2;
    g.beginPath(); g.moveTo(C + Math.cos(a) * l0 * S, C + Math.sin(a) * l0 * S); g.lineTo(C + Math.cos(a) * 0.47 * S, C + Math.sin(a) * 0.47 * S); g.stroke();
  }
  g.fillStyle = '#5b5549'; g.font = `bold ${S * 0.07}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const zh = '子丑寅卯辰巳午未申酉戌亥';
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * TAU + Math.PI / 2;
    g.save(); g.translate(C + Math.cos(a) * 0.32 * S, C + Math.sin(a) * 0.32 * S); g.rotate(a - Math.PI / 2); g.fillText(zh[i], 0, 0); g.restore();
  }
  return c;
});
// 碑文：竖排楷书（千字文），四周卷草边框
registerTexture('pr_stele', () => {
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d'), r = rng(41);
  g.fillStyle = '#e3dfd4'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(110,100,85,${0.02 + r() * 0.035})`; g.beginPath(); g.arc(r() * W, r() * H, 4 + r() * 16, 0, TAU); g.fill(); }
  g.strokeStyle = '#9d968a'; g.lineWidth = 5; g.strokeRect(9, 9, W - 18, H - 18);
  g.lineWidth = 2; g.strokeRect(24, 24, W - 48, H - 48);
  g.strokeStyle = '#b3ada0'; g.lineWidth = 3;
  for (let y = 30; y < H - 30; y += 22) { g.beginPath(); g.arc(16.5, y, 5, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(W - 16.5, y + 11, 5, Math.PI, TAU); g.stroke(); }
  const txt = '天地玄黄宇宙洪荒日月盈昃辰宿列张寒来暑往秋收冬藏闰余成岁律吕调阳云腾致雨露结为霜金生丽水玉出昆冈剑号巨阙珠称夜光果珍李柰菜重芥姜海咸河淡鳞潜羽翔龙师火帝鸟官人皇始制文字乃服衣裳推位让国有虞陶唐吊民伐罪周发殷汤坐朝问道垂拱平章爱育黎首臣伏戎羌遐迩一体率宾归王';
  g.fillStyle = '#5e584d'; g.font = `15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let k = 0;
  for (let col = 0; col < 11; col++) {
    const x = W - 42 - col * 17.2;
    const n = col === 0 ? 10 : 25;
    for (let row = 0; row < n; row++) g.fillText(txt[k++ % txt.length], x, 44 + row * 17.6);
  }
  return c;
});
// 龟甲：环面 Voronoi 甲片（可平铺）
registerTexture('pr_cells_normal', () => {
  const r = rng(29), N = 4, P = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) P.push([(i + 0.3 + r() * 0.4) / N, (j + 0.3 + r() * 0.4) / N]);
  return normalFromHeight(128, (u, v) => {
    let d1 = 9, d2 = 9;
    for (const [px, py] of P) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const d = Math.hypot(u - px - ox, v - py - oy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return Math.min(1, (d2 - d1) / 0.07) * 0.75 + (1 - Math.min(1, d1 * 3)) * 0.25;
  }, 3);
});
// 桥面石板：2m 周期，u 横向 v 沿桥向；每 0.5m 一行，1m 长条错缝
registerTexture('pr_deck', () => {
  const S = 256, c = canvas(S), g = c.getContext('2d'), r = rng(53);
  g.fillStyle = '#85827a'; g.fillRect(0, 0, S, S);
  const rh = S / 4;
  for (let j = 0; j < 4; j++) {
    const off = (j % 2) * S / 4;
    for (let i = -1; i < 2; i++) {
      const t = 0.92 + r() * 0.1;
      g.fillStyle = `rgb(${190 * t | 0},${186 * t | 0},${176 * t | 0})`;
      g.fillRect(off + i * S / 2 + 1.5, j * rh + 1.5, S / 2 - 3, rh - 3);
    }
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(90,85,75,${r() * 0.08})`; g.fillRect(r() * S, r() * S, 2, 2); }
  return c;
});
defineMaterial('pr_dark', { color: 0x15100b, roughness: 0.95 });
defineMaterial('pr_dial', { color: 0xffffff, map: 'pr_dial', roughness: 0.6 });
defineMaterial('pr_stele', { color: 0xffffff, map: 'pr_stele', roughness: 0.62 });
defineMaterial('pr_deck', { color: 0xffffff, map: 'pr_deck', roughness: 0.85, period: [2, 2] });
defineMaterial('pr_shell', { color: 0x4a3a28, roughness: 0.42, metalness: 0.9, normalMap: 'pr_cells_normal', normalScale: 1.6, period: [0.5, 1.4] });
defineMaterial('pr_shell_stone', { color: 0xe2ded3, roughness: 0.62, normalMap: 'pr_cells_normal', normalScale: 1.3, period: [0.34, 1.4] });

// ---------- 几何小工具 ----------
function ell(x, y, z, rx, ry, rz, ws = 8, hs = 6, rot = null) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  if (rot) g.applyMatrix4(_m.makeRotationFromEuler(new THREE.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0, 'YXZ')));
  return g.translate(x, y, z);
}
/** 几何 +Y 对齐 yDir，+Z 尽量对齐 zDir，再平移到 p */
function basis(g, p, yDir, zDir = [0, 0, 1]) {
  const y = new V3(...yDir).normalize();
  const x = new V3().crossVectors(y, new V3(...zDir)).normalize();
  const z = new V3().crossVectors(x, y);
  return g.applyMatrix4(_m.makeBasis(x, y, z).setPosition(p[0], p[1], p[2]));
}
const ellB = (p, r, yDir, zDir, ws = 7, hs = 5) => basis(new THREE.SphereGeometry(1, ws, hs).scale(r[0], r[1], r[2]), p, yDir, zDir);
const boxAt = (sx, sy, sz, x, y, z) => boxGeo(sx, sy, sz).translate(x, y, z);

// 卷毛（螺髻）：底半径 1、高 0.66 的偏心扭转圆突，15 个三角形
let KNOB = null;
function knobUnit() {
  if (KNOB) return KNOB;
  const S = 5, pos = [], idx = [];
  for (let j = 0; j < S; j++) { const a = (j / S) * TAU; pos.push(Math.cos(a), 0, Math.sin(a)); }
  for (let j = 0; j < S; j++) { const a = (j / S) * TAU + 0.35; pos.push(0.06 + 0.8 * Math.cos(a), 0.46, 0.8 * Math.sin(a)); }
  pos.push(0.14, 0.66, 0.04);
  for (let j = 0; j < S; j++) { const j1 = (j + 1) % S; idx.push(j, S + j, S + j1, j, S + j1, j1, S + j, 2 * S, S + j1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return (KNOB = g);
}
function knob(r, p, n, spin = 0) {
  const d = new V3(...n).normalize();
  const g = knobUnit().clone().scale(r, r, r);
  if (spin) g.rotateY(spin);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d));
  return g.translate(p[0] - d.x * r * 0.3, p[1] - d.y * r * 0.3, p[2] - d.z * r * 0.3);
}
/** 两点间圆台（底 a 半径 r0，顶 b 半径 r1） */
function rod(a, b, r0, r1 = r0, seg = 6, open = false) {
  const A = new V3(...a), d = new V3(...b).sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, open).translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(A.x, A.y, A.z);
}
/** 椭圆截面放样（端部圆头封口）。rads: r 或 [横向, 法向]；ref 用于确定横向 = ref × 切线 */
function tube(pts, rads, seg = 8, { ref = [0, 1, 0], cap = 0.6 } = {}) {
  const P = pts.map((p) => new V3(...p)), n = P.length, rv = new V3(...ref);
  const R = rads.map((r) => (Array.isArray(r) ? r : [r, r]));
  const pos = [], idx = [], T = [];
  let prev = new V3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    const t = new V3().subVectors(P[Math.min(i + 1, n - 1)], P[Math.max(i - 1, 0)]).normalize();
    let side = new V3().crossVectors(rv, t);
    side = side.lengthSq() < 1e-6 ? prev.clone() : side.normalize();
    prev = side;
    const nr = new V3().crossVectors(t, side).normalize();
    T.push(t);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU, c = Math.cos(a) * R[i][0], s = Math.sin(a) * R[i][1];
      pos.push(P[i].x + side.x * c + nr.x * s, P[i].y + side.y * c + nr.y * s, P[i].z + side.z * c + nr.z * s);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const j1 = (j + 1) % seg, a = i * seg + j, b = i * seg + j1, c = (i + 1) * seg + j1, d = (i + 1) * seg + j;
    idx.push(a, b, c, a, c, d);
  }
  const s0 = n * seg, s1 = s0 + 1;
  const e0 = P[0].clone().addScaledVector(T[0], -cap * (R[0][0] + R[0][1]) / 2);
  const e1 = P[n - 1].clone().addScaledVector(T[n - 1], cap * (R[n - 1][0] + R[n - 1][1]) / 2);
  pos.push(e0.x, e0.y, e0.z, e1.x, e1.y, e1.z);
  for (let j = 0; j < seg; j++) {
    const j1 = (j + 1) % seg;
    idx.push(s0, j1, j, s1, (n - 1) * seg + j, (n - 1) * seg + j1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
/** 旋转体，UV 改为米；flat=true 时为棱面（六角/八角） */
function lathe(pts, seg = 16, { phase = 0, flat = false } = {}) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg, phase);
  const rmax = Math.max(...pts.map((p) => p[0])), circ = TAU * rmax, np = pts.length;
  const cum = [0];
  for (let j = 1; j < np; j++) cum.push(cum[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
  const uv = g.attributes.uv;
  for (let i = 0; i <= seg; i++) for (let j = 0; j < np; j++) uv.setXY(i * np + j, (i / seg) * circ, cum[j]);
  if (!flat) return g;
  const h = g.toNonIndexed(); h.computeVertexNormals();
  return h;
}
/** 矩形逐层收分体：prof=[[外扩量, y],...]，UV 米（vBand 时 v 为 0..1，用于束腰带） */
function rectStack(w, d, prof, { top = true, vBand = false } = {}) {
  const pos = [], uv = [];
  const ring = (o) => { const a = w / 2 + o, b = d / 2 + o; return [[-a, b], [a, b], [a, -b], [-a, -b]]; };
  let v = 0;
  const vt = prof[prof.length - 1][1] - prof[0][1] || 1;
  for (let k = 0; k < prof.length - 1; k++) {
    const [o1, y1] = prof[k], [o2, y2] = prof[k + 1];
    const r1 = ring(o1), r2 = ring(o2);
    const dv = vBand ? (y2 - y1) / vt : Math.hypot(o2 - o1, y2 - y1);
    let u1 = 0, u2 = 0;
    for (let s = 0; s < 4; s++) {
      const a1 = r1[s], b1 = r1[(s + 1) % 4], a2 = r2[s], b2 = r2[(s + 1) % 4];
      const L1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]), L2 = Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
      pos.push(a1[0], y1, a1[1], b1[0], y1, b1[1], b2[0], y2, b2[1], a1[0], y1, a1[1], b2[0], y2, b2[1], a2[0], y2, a2[1]);
      uv.push(u1, v, u1 + L1, v, u2 + L2, v + dv, u1, v, u2 + L2, v + dv, u2, v + dv);
      u1 += L1; u2 += L2;
    }
    v += dv;
  }
  if (top) {
    const [o, y] = prof[prof.length - 1], r = ring(o);
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(r[i][0], y, r[i][1]); uv.push(r[i][0], r[i][1]); }
  }
  return fromArrays(pos, uv);
}
// 清式须弥座剖面：[外扩(单位 k), 高度比例]；束腰单独出（marble_band）
const XU_LO = [[0.15, 0], [0.15, 0.16], [-0.2, 0.16], [-0.2, 0.19], [0, 0.19], [0, 0.33], [-0.3, 0.355], [-0.75, 0.39], [-1.1, 0.42], [-1.2, 0.43]];
const XU_HI = [[-1.2, 0.62], [-1.1, 0.635], [-0.75, 0.665], [-0.3, 0.7], [0, 0.72], [0, 0.97], [-0.12, 1]];
function xumi(w, d, h, { k = Math.min(0.12, h * 0.09) } = {}) {
  const P = (arr) => arr.map(([o, y]) => [o * k, y * h]);
  const main = merge([rectStack(w, d, P(XU_LO), { top: false }), rectStack(w, d, P(XU_HI))]);
  const band = rectStack(w, d, P([[-1.2, 0.43], [-1.2, 0.62]]), { top: false, vBand: true });
  return { main, band };
}
/** 平面轮廓 / Shape 沿 Z 拉伸（居中） */
function extrude(shape, depth, seg = 6) {
  const sh = shape instanceof THREE.Shape ? shape : new THREE.Shape(shape.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: seg }).translate(0, 0, -depth / 2);
}
/** 合并各材质并按总高归一（真实高度 = 1） */
function finish(parts) {
  const list = [];
  let top = 0;
  for (const [mat, gs] of Object.entries(parts)) {
    if (!gs.length) continue;
    const g = merge(gs);
    g.computeBoundingBox();
    top = Math.max(top, g.boundingBox.max.y);
    list.push({ mat, geo: g });
  }
  for (const p of list) p.geo.scale(1 / top, 1 / top, 1 / top);
  return list;
}
/** 椭球面上按黄金螺旋均布点，filter(φ,θ) 筛选，取恰好 count 个：返回 [点, 法线] */
function spread(C, R, count, filter) {
  for (let N = count; N < count * 12; N++) {
    const out = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
      const x = r * Math.cos(a), z = r * Math.sin(a);
      if (!filter(Math.asin(y), Math.atan2(x, z))) continue;
      out.push([[C[0] + R[0] * x, C[1] + R[1] * y, C[2] + R[2] * z], [x / R[0], y / R[1], z / R[2]]]);
    }
    if (out.length >= count) return out.slice(0, count);
  }
  return [];
}
const pivotY = (gs, pv, a) => { for (const g of gs) g.translate(-pv[0], -pv[1], -pv[2]).rotateY(a).translate(pv[0], pv[1], pv[2]); };

// ---------- 铜狮 ----------
// 螺髻行：[纬度°, 个数, 起始经度°, 终止经度°]（经度 0 = 正前），合计 45（九五之数）
const CURL_ROWS = [[22, 11, 0, 116], [38, 10, 0, 132], [54, 9, 0, 152], [70, 6, 0, 180], [87, 1, 0, 0], [4, 8, 78, 172]];
function lionFigure(sex) {
  const B = [], K = [];
  const s = sex === 'f' ? 1 : -1; // 动作爪所在侧：雄右爪(-X)踩绣球，雌左爪(+X)抚幼狮
  // 后躯、后腿
  B.push(ell(0, 0.46, -0.50, 0.52, 0.46, 0.50, 9, 6));
  for (const x of [-1, 1]) {
    B.push(ell(x * 0.38, 0.40, -0.28, 0.19, 0.33, 0.44, 7, 5, [0.5, 0, 0]));
    B.push(ell(x * 0.43, 0.08, 0.08, 0.14, 0.08, 0.20, 7, 4));
    for (const t of [-1, 0, 1]) B.push(knob(0.045, [x * 0.43 + t * 0.07, 0.05, 0.25], [0, 0.3, 1]));
    B.push(knob(0.08, [x * 0.52, 0.50, -0.42], [x, 0.2, -0.5]));
  }
  // 躯干、胸
  B.push(tube([[0, 0.50, -0.55], [0, 0.90, -0.33], [0, 1.25, -0.07], [0, 1.58, 0.12]], [[0.44, 0.42], [0.46, 0.44], [0.44, 0.40], [0.36, 0.32]], 10));
  B.push(ell(0, 1.12, 0.22, 0.40, 0.42, 0.31, 8, 6));
  // 前腿：肩部粗壮、腕部收细
  for (const x of [-1, 1]) {
    const act = x === s;
    const pawY = act ? (sex === 'm' ? 0.58 : 0.36) : 0.08, pawZ = 0.68, px = x * (act ? 0.42 : 0.39);
    const path = act
      ? [[x * 0.27, 1.34, 0.10], [x * 0.35, 1.04, 0.34], [x * 0.40, 0.80, 0.50], [px, pawY + 0.12, 0.59], [px, pawY + 0.04, 0.63]]
      : [[x * 0.27, 1.34, 0.10], [x * 0.34, 1.00, 0.31], [x * 0.37, 0.62, 0.45], [x * 0.38, 0.30, 0.53], [px, 0.12, 0.58]];
    B.push(tube(path, [[0.19, 0.24], [0.18, 0.21], [0.145, 0.16], [0.125, 0.13], [0.12, 0.12]], 10, { ref: [0, 0, 1] }));
    B.push(ell(px, pawY, pawZ, 0.15, 0.085, 0.19, 7, 4));
    for (const t of [-1, 0, 1]) B.push(knob(0.048, [px + t * 0.075, pawY - 0.015, pawZ + 0.16], [0, 0.25, 1]));
    for (const k of [0, 1]) B.push(knob(0.065, [x * 0.43, 0.86 - k * 0.15, 0.27 + k * 0.05], [x * 0.6, 0, -0.8], k));
  }
  if (sex === 'm') {
    // 绣球：球体 + 交叉锦带 + 绶带
    const c = [-0.42, 0.26, 0.72], R = 0.26;
    B.push(ell(c[0], c[1], c[2], R, R, R, 10, 6));
    for (const a of [0.6, -0.6]) B.push(new THREE.TorusGeometry(R * 1.01, 0.022, 3, 10).rotateY(a).translate(...c));
    B.push(tube([[c[0] + 0.14, 0.04, c[2] + 0.18], [c[0] + 0.32, 0.03, c[2] + 0.2], [c[0] + 0.44, 0.03, c[2] + 0.08]], [[0.05, 0.015], [0.05, 0.015], [0.04, 0.012]], 4));
  } else {
    // 幼狮：仰卧于母狮左爪下，头朝前外侧上仰
    const cx = 0.44, cz = 0.62;
    B.push(ell(cx, 0.16, cz - 0.06, 0.18, 0.14, 0.28, 7, 5, [0, 0.3, 0]));
    const hc = [cx + 0.12, 0.25, cz + 0.30];
    B.push(ell(...hc, 0.16, 0.15, 0.15, 8, 5));
    B.push(ell(hc[0] + 0.03, hc[1] + 0.01, hc[2] + 0.14, 0.08, 0.06, 0.06, 6, 3));
    for (const x of [-1, 1]) K.push(ell(hc[0] + 0.03 + x * 0.06, hc[1] + 0.06, hc[2] + 0.13, 0.022, 0.022, 0.012, 5, 3));
    for (const [p, n] of spread(hc, [0.16, 0.15, 0.15], 6, (f, t) => f > 0.15 && Math.abs(t) > 0.6)) B.push(knob(0.05, p, n));
    B.push(rod([cx - 0.02, 0.22, cz + 0.12], [cx - 0.06, 0.40, cz + 0.06], 0.04, 0.032, 5, true));
    B.push(rod([cx + 0.14, 0.22, cz + 0.10], [cx + 0.16, 0.38, cz + 0.16], 0.04, 0.032, 5, true));
    B.push(rod([cx - 0.04, 0.19, cz - 0.18], [cx - 0.14, 0.32, cz - 0.24], 0.045, 0.035, 5, true));
    B.push(rod([cx + 0.12, 0.19, cz - 0.18], [cx + 0.20, 0.32, cz - 0.24], 0.045, 0.035, 5, true));
  }
  // 项圈、铃铛、缨穗
  const cp = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; cp.push([0.39 * Math.sin(a), 1.50 - 0.10 * Math.cos(a), 0.17 + 0.33 * Math.cos(a)]); }
  B.push(sweep([[-0.035, 0.035], [0.04, 0], [-0.035, -0.035]], cp, { closed: true, flat: false }));
  B.push(lathe([[0.001, 0], [0.10, 0], [0.10, 0.025], [0.085, 0.07], [0.07, 0.13], [0.04, 0.18], [0.001, 0.2]], 7).translate(0, 1.19, 0.55));
  for (const a of [-1.0, 1.0, -1.7, 1.7]) {
    const p = [0.39 * Math.sin(a), 1.47 - 0.10 * Math.cos(a), 0.17 + 0.33 * Math.cos(a)];
    B.push(rod(p, [p[0] * 1.05, p[1] - 0.17, p[2] + 0.02], 0.04, 0.008, 5, true));
  }
  // 尾：扇形卷毛贴于臀背
  const ty = new V3(0, 0.89, 0.46), tn = new V3(0, 0.45, -0.89), tb = new V3(0, 0.66, -0.97);
  B.push(ellB(tb.clone().addScaledVector(ty, 0.2).toArray(), [0.25, 0.30, 0.07], ty.toArray(), tn.toArray(), 7, 5));
  for (const [a, r, l] of [[-1.0, 0.075, 0.24], [-0.5, 0.085, 0.33], [0, 0.09, 0.38], [0.5, 0.085, 0.33], [1.0, 0.075, 0.24], [-0.5, 0.07, 0.15], [0.5, 0.07, 0.15]]) {
    const p = tb.clone().addScaledVector(ty, Math.cos(a) * l).add(new V3(Math.sin(a) * l, 0, 0)).addScaledVector(tn, 0.05);
    B.push(knob(r, p.toArray(), [Math.sin(a) * 0.5, 0, 0].map((v, i) => v + tn.getComponent(i)), a * 3));
  }
  // 颈
  B.push(tube([[0, 1.40, 0.06], [0, 1.70, 0.20], [0, 1.95, 0.30]], [0.30, 0.30, 0.28], 8));
  // ---- 头（整体略转向动作爪一侧）----
  const HB = [], HK = [];
  const C = [0, 2.08, 0.38], RA = [0.44, 0.40, 0.38];
  HB.push(ell(...C, ...RA, 10, 8));
  HB.push(ell(0, 1.90, 0.10, 0.50, 0.50, 0.40, 10, 7)); // 鬃团
  HB.push(ell(0, 2.00, 0.60, 0.33, 0.28, 0.20, 6, 5)); // 面
  for (const x of [-1, 1]) {
    HB.push(ell(x * 0.15, 2.17, 0.78, 0.12, 0.05, 0.075, 6, 4, [0.3, 0, -x * 0.35])); // 眉
    HB.push(ell(x * 0.15, 2.07, 0.80, 0.088, 0.075, 0.075, 6, 4)); // 眼
    HK.push(ell(x * 0.155, 2.07, 0.872, 0.038, 0.038, 0.012, 5, 3));
    HK.push(ell(x * 0.065, 1.925, 0.975, 0.03, 0.02, 0.02, 5, 3)); // 鼻孔
    HB.push(ell(x * 0.11, 1.83, 0.85, 0.14, 0.085, 0.11, 7, 4)); // 上唇
    HB.push(ell(x * 0.25, 1.86, 0.70, 0.10, 0.10, 0.10, 6, 4)); // 颊
    HB.push(rod([x * 0.13, 1.78, 0.86], [x * 0.13, 1.69, 0.88], 0.026, 0.004, 5, true)); // 獠牙
    HB.push(rod([x * 0.12, 1.635, 0.83], [x * 0.12, 1.70, 0.845], 0.022, 0.004, 5, true));
    HB.push(ell(x * 0.40, 2.06, 0.56, 0.06, 0.13, 0.09, 5, 3, [0, 0, x * 0.8])); // 耳
  }
  HB.push(ell(0, 1.96, 0.89, 0.14, 0.10, 0.10, 8, 5)); // 鼻
  HK.push(ell(0, 1.72, 0.72, 0.20, 0.09, 0.15, 7, 4)); // 口腔
  HB.push(ell(0, 1.62, 0.73, 0.19, 0.06, 0.14, 7, 4, [0.12, 0, 0])); // 下颌
  HB.push(ell(0, 1.67, 0.78, 0.10, 0.03, 0.09, 6, 3)); // 舌
  // 45 个螺髻，按行排布
  for (const [f, n, t0, t1] of CURL_ROWS) {
    for (let i = 0; i < n; i++) {
      let t;
      if (t0 > 0) { const h = n / 2, k = i % h; t = (i < h ? -1 : 1) * (t0 + ((k + 0.5) * (t1 - t0)) / h); }
      else t = n === 1 ? 0 : t1 === 180 ? -180 + ((i + 0.5) * 360) / n : -t1 + (i * 2 * t1) / (n - 1);
      const fr = f * D2R, tr = t * D2R, u = [Math.cos(fr) * Math.sin(tr), Math.sin(fr), Math.cos(fr) * Math.cos(tr)];
      HB.push(knob(0.072, [C[0] + RA[0] * u[0], C[1] + RA[1] * u[1], C[2] + RA[2] * u[2]], [u[0] / RA[0], u[1] / RA[1], u[2] / RA[2]], i * 1.3));
    }
  }
  for (const [p, n] of spread([0, 1.90, 0.10], [0.50, 0.50, 0.40], 13, (f, t) => Math.abs(t) > 1.75 && f > -0.85 && f < 0.3)) HB.push(knob(0.09, p, n, p[1] * 9));
  for (const [x, y, z] of [[-0.12, 1.55, 0.69], [0, 1.53, 0.72], [0.12, 1.55, 0.69]]) HB.push(knob(0.065, [x, y, z], [x, -0.5, 1]));
  pivotY([...HB, ...HK], [0, 1.9, 0.25], s * 0.16);
  return { B: [...B, ...HB], K: HK };
}
function lionParts(sex, metal) {
  const Mb = [], Mk = [], B = [];
  const s1 = xumi(1.95, 2.75, 1.30);
  Mb.push(s1.main); Mk.push(s1.band);
  const s2 = xumi(1.62, 2.38, 0.48, { k: 0.05 });
  B.push(s2.main.translate(0, 1.30, 0), s2.band.translate(0, 1.30, 0));
  // 锦袱：覆于铜座顶面，四面中央垂角缀穗
  B.push(boxAt(1.64, 0.025, 2.40, 0, 1.79, 0));
  const flap = extrude([[-0.42, 0], [0.42, 0], [0.05, -0.30], [0, -0.33], [-0.05, -0.30]], 0.015);
  for (const [x, z, r] of [[0, 1.205, 0], [0, -1.205, Math.PI], [0.825, 0, Math.PI / 2], [-0.825, 0, -Math.PI / 2]]) {
    B.push(flap.clone().rotateY(r).translate(x, 1.80, z));
    const tz = z ? z + Math.sign(z) * 0.02 : 0, tx = x ? x + Math.sign(x) * 0.02 : 0;
    B.push(rod([tx, 1.47, tz], [tx, 1.33, tz], 0.012, 0.03, 5));
  }
  const F = lionFigure(sex);
  for (const g of F.B) B.push(g.translate(0, 1.80, -0.04));
  for (const g of F.K) g.translate(0, 1.80, -0.04);
  return finish({ marble: Mb, marble_band: Mk, [metal]: B, pr_dark: F.K });
}
registerProtoFamily('lion', (key, [sex = 'm', v]) => lionParts(sex === 'f' ? 'f' : 'm', v === 'gilt' ? 'bronze_gilt' : 'bronze'));

// ---------- 铜缸 ----------
// 剖面 [r, y]（y 自石座顶算起），water 水面高，ear 铺首高
const VATS = {
  gilt: { mat: 'bronze_gilt', water: 1.12, ear: 0.95, prof: [[0.45, 0], [0.48, 0.06], [0.47, 0.09], [0.62, 0.28], [0.75, 0.55], [0.81, 0.83], [0.79, 1.02], [0.735, 1.13], [0.74, 1.18], [0.785, 1.235], [0.77, 1.26], [0.715, 1.255], [0.705, 1.08]] },
  bronze: { mat: 'bronze', water: 1.14, ear: 0.98, prof: [[0.48, 0], [0.52, 0.06], [0.54, 0.11], [0.67, 0.36], [0.76, 0.64], [0.785, 0.84], [0.80, 0.86], [0.78, 0.89], [0.775, 1.08], [0.81, 1.21], [0.80, 1.25], [0.745, 1.25], [0.735, 1.10]] },
  iron: { mat: 'iron', water: 1.12, ear: 1.0, prof: [[0.55, 0], [0.58, 0.05], [0.66, 0.24], [0.69, 0.26], [0.68, 0.29], [0.745, 0.62], [0.775, 0.64], [0.76, 0.67], [0.80, 1.10], [0.86, 1.18], [0.86, 1.23], [0.79, 1.22], [0.78, 1.08]] },
};
registerProtoFamily('vat', (key, [k = 'bronze']) => {
  const V = VATS[k] || VATS.bronze, b = 0.34, B = [], W = [];
  const M = [lathe([[0.63, 0], [0.64, 0.05], [0.60, 0.075], [0.56, 0.11], [0.555, 0.21], [0.59, 0.25], [0.615, 0.29], [0.60, 0.33], [0.46, 0.345]], 12)];
  B.push(lathe(V.prof.map(([r, y]) => [r, y + b]), 20));
  W.push(new THREE.CircleGeometry(V.prof[V.prof.length - 1][0] + 0.005, 20).rotateX(-Math.PI / 2).translate(0, b + V.water, 0));
  // 两侧兽面衔环（铁缸为环耳）
  const rAt = (y) => { const p = V.prof; for (let i = 0; i < p.length - 1; i++) if (y >= p[i][1] && y <= p[i + 1][1]) { const t = (y - p[i][1]) / (p[i + 1][1] - p[i][1]); return p[i][0] + (p[i + 1][0] - p[i][0]) * t; } return p[0][0]; };
  const ye = b + V.ear, rw = rAt(V.ear);
  for (const x of [-1, 1]) {
    if (k !== 'iron') {
      // 兽面铺首：面、双目、鼻
      B.push(ell(x * (rw - 0.01), ye, 0, 0.055, 0.13, 0.15, 6, 4));
      for (const z of [-1, 1]) B.push(knob(0.03, [x * (rw + 0.035), ye + 0.03, z * 0.055], [x, 0.2, z * 0.3]));
      B.push(ell(x * (rw + 0.04), ye - 0.035, 0, 0.035, 0.04, 0.035, 5, 3));
    } else B.push(boxAt(0.05, 0.08, 0.10, x * (rw + 0.01), ye, 0));
    B.push(new THREE.TorusGeometry(0.085, 0.016, 3, 12).rotateY(Math.PI / 2).translate(x * (rw + 0.05), ye - 0.125, 0));
  }
  return finish({ marble: M, [V.mat]: B, water: W });
});

// ---------- 日晷 ----------
registerProtoFamily('sundial', () => {
  const M = [], Bd = [], D = [], Fe = [];
  M.push(rectStack(1.5, 1.5, [[0, 0], [0, 0.2], [-0.03, 0.22]]));
  const x = xumi(1.05, 1.05, 1.15);
  M.push(x.main.translate(0, 0.22, 0)); Bd.push(x.band.translate(0, 0.22, 0));
  const y1 = 1.37, zc = -0.12;
  M.push(rectStack(0.66, 0.54, [[0, 0], [0, 0.05], [-0.05, 0.08], [-0.09, 0.18], [-0.05, 0.22], [0, 0.25]]).translate(0, y1, zc));
  // 晷盘：盘面平行赤道面，上面朝北天极（北纬 39.9°），晷针指向天极
  const lat = 39.9 * D2R, n = new V3(0, Math.sin(lat), -Math.cos(lat)), d = new V3(0, Math.cos(lat), Math.sin(lat));
  const R = 0.56, T = 0.1;
  const Cc = new V3(0, y1 + 0.2, zc).addScaledVector(d, R);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
  M.push(new THREE.CylinderGeometry(R, R, T, 32, 1, true).applyQuaternion(q).translate(Cc.x, Cc.y, Cc.z));
  for (const sg of [1, -1]) D.push(new THREE.CircleGeometry(R, 32).rotateX(-sg * Math.PI / 2).translate(0, (sg * T) / 2, 0).applyQuaternion(q).translate(Cc.x, Cc.y, Cc.z));
  // 托槽两颊
  for (const s of [-1, 1]) M.push(basis(boxGeo(0.10, 0.26, 0.16), [s * 0.17, y1 + 0.3, zc + 0.04], d.toArray(), n.toArray()));
  const a = Cc.clone().addScaledVector(n, -0.46), b = Cc.clone().addScaledVector(n, 0.46);
  Fe.push(rod(a.toArray(), b.toArray(), 0.013, 0.007, 6));
  return finish({ marble: M, marble_band: Bd, pr_dial: D, bronze: Fe });
});

// ---------- 嘉量（方斛置于石亭中）----------
registerProtoFamily('jialiang', () => {
  const M = [], Bd = [], Br = [], K = [];
  M.push(rectStack(1.45, 1.45, [[0, 0], [0, 0.2], [-0.03, 0.22]]));
  const x = xumi(1.05, 1.05, 1.0);
  M.push(x.main.translate(0, 0.22, 0)); Bd.push(x.band.translate(0, 0.22, 0));
  const y1 = 1.22, y2 = y1 + 0.07, ph = 0.66, hw = 0.39;
  M.push(rectStack(0.98, 0.98, [[0, 0], [0, 0.07]]).translate(0, y1, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    M.push(boxAt(0.11, ph, 0.11, sx * hw, y2 + ph / 2, sz * hw));
    M.push(boxAt(0.14, 0.05, 0.14, sx * hw, y2 + 0.025, sz * hw));
  }
  // 三面矮栏板
  M.push(boxAt(hw * 2, 0.22, 0.05, 0, y2 + 0.11, -hw), boxAt(0.05, 0.22, hw * 2, -hw, y2 + 0.11, 0), boxAt(0.05, 0.22, hw * 2, hw, y2 + 0.11, 0));
  // 额枋、盖板、四角攒尖石顶、宝顶
  const y3 = y2 + ph;
  for (const s of [-1, 1]) M.push(boxAt(hw * 2 + 0.11, 0.08, 0.09, 0, y3 - 0.04, s * hw), boxAt(0.09, 0.08, hw * 2 + 0.11, s * hw, y3 - 0.04, 0));
  M.push(rectStack(0.96, 0.96, [[0, 0], [0, 0.07]]).translate(0, y3, 0));
  M.push(lathe([[0.80, 0], [0.82, 0.05], [0.76, 0.08], [0.54, 0.17], [0.32, 0.27], [0.12, 0.36], [0.06, 0.40]], 4, { phase: Math.PI / 4, flat: true }).translate(0, y3 + 0.07, 0));
  M.push(lathe([[0.07, 0], [0.10, 0.05], [0.07, 0.10], [0.10, 0.16], [0.05, 0.23], [0.001, 0.26]], 8).translate(0, y3 + 0.45, 0));
  // 方嘉量：斛身 + 两侧斗、升耳
  Br.push(rectStack(0.30, 0.30, [[0, 0], [0, 0.05], [-0.03, 0.06], [-0.03, 0.10]]).translate(0, y2, 0));
  Br.push(rectStack(0.34, 0.34, [[0, 0], [0, 0.24], [0.015, 0.25], [0.015, 0.28]], { top: false }).translate(0, y2 + 0.10, 0));
  K.push(boxAt(0.33, 0.01, 0.33, 0, y2 + 0.35, 0));
  for (const s of [-1, 1]) Br.push(boxAt(0.12, 0.11, 0.12, s * 0.24, y2 + 0.28, 0), boxAt(0.05, 0.03, 0.03, s * 0.19, y2 + 0.27, 0));
  return finish({ marble: M, marble_band: Bd, bronze_gilt: Br, pr_dark: K });
});

// ---------- 铜龟（龙首龟身）----------
function dragonHead(B, K, c, s = 1) {
  const [x, y, z] = c;
  B.push(ell(x, y, z, 0.13 * s, 0.12 * s, 0.15 * s, 9, 6));
  B.push(ell(x, y - 0.02 * s, z + 0.14 * s, 0.085 * s, 0.07 * s, 0.12 * s, 8, 5, [0.1, 0, 0]));
  B.push(ell(x, y + 0.01 * s, z + 0.25 * s, 0.07 * s, 0.045 * s, 0.04 * s, 6, 4));
  B.push(ell(x, y - 0.11 * s, z + 0.13 * s, 0.07 * s, 0.03 * s, 0.11 * s, 6, 4, [0.35, 0, 0]));
  K.push(ell(x, y - 0.07 * s, z + 0.13 * s, 0.07 * s, 0.04 * s, 0.1 * s, 6, 4));
  for (const sx of [-1, 1]) {
    B.push(ell(x + sx * 0.085 * s, y + 0.06 * s, z + 0.09 * s, 0.04 * s, 0.04 * s, 0.04 * s, 6, 4));
    K.push(ell(x + sx * 0.10 * s, y + 0.065 * s, z + 0.115 * s, 0.018 * s, 0.018 * s, 0.01 * s, 5, 3));
    B.push(tube([[x + sx * 0.06 * s, y + 0.09 * s, z - 0.02 * s], [x + sx * 0.08 * s, y + 0.15 * s, z - 0.12 * s], [x + sx * 0.09 * s, y + 0.16 * s, z - 0.22 * s], [x + sx * 0.08 * s, y + 0.20 * s, z - 0.28 * s]], [0.03 * s, 0.025 * s, 0.018 * s, 0.008 * s], 5));
    B.push(tube([[x + sx * 0.05 * s, y - 0.01 * s, z + 0.26 * s], [x + sx * 0.12 * s, y - 0.02 * s, z + 0.24 * s], [x + sx * 0.17 * s, y + 0.02 * s, z + 0.16 * s]], [0.012 * s, 0.01 * s, 0.006 * s], 4));
  }
  for (const k of [-1, 0, 1]) B.push(ellB([x + k * 0.07 * s, y + 0.02 * s, z - 0.14 * s], [0.05 * s, 0.14 * s, 0.025 * s], [k * 0.4, 0.3, -1], [k, 1, 0]));
  B.push(rod([x, y - 0.13 * s, z + 0.06 * s], [x, y - 0.26 * s, z + 0.02 * s], 0.035 * s, 0.006 * s, 5));
}
registerProtoFamily('tortoise', () => {
  const M = [], Bd = [], B = [], Sh = [], K = [];
  const x = xumi(1.15, 1.75, 0.95);
  M.push(x.main); Bd.push(x.band);
  const y0 = 0.95;
  B.push(ell(0, y0 + 0.24, 0, 0.42, 0.14, 0.58, 10, 6));
  B.push(ell(0, y0 + 0.30, -0.02, 0.53, 0.05, 0.72, 16, 4));
  Sh.push(new THREE.SphereGeometry(1, 16, 6, 0, TAU, 0, Math.PI / 2).scale(0.49, 0.42, 0.67).translate(0, y0 + 0.30, -0.02));
  B.push(lathe([[0.10, 0], [0.11, 0.03], [0.07, 0.06], [0.05, 0.08], [0.001, 0.09]], 8).translate(0, y0 + 0.70, -0.02));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hip = [sx * 0.36, y0 + 0.26, sz > 0 ? 0.34 : -0.40], foot = [sx * 0.52, y0 + 0.06, sz > 0 ? 0.50 : -0.56];
    B.push(tube([hip, [(hip[0] + foot[0]) / 2, y0 + 0.20, (hip[2] + foot[2]) / 2], foot], [0.12, 0.10, 0.085], 7, { ref: [0, 0, 1] }));
    B.push(ell(foot[0], y0 + 0.045, foot[2] + 0.03 * sz, 0.11, 0.045, 0.13, 7, 4));
    for (const t of [-1, 0, 1]) B.push(knob(0.035, [foot[0] + t * 0.06 + sx * 0.03, y0 + 0.03, foot[2] + 0.13 * sz], [sx * 0.3, 0.3, sz]));
  }
  B.push(tube([[0, y0 + 0.30, 0.50], [0, y0 + 0.56, 0.72], [0, y0 + 0.82, 0.80]], [0.13, 0.11, 0.10], 8));
  dragonHead(B, K, [0, y0 + 0.92, 0.86]);
  B.push(tube([[0, y0 + 0.28, -0.66], [0, y0 + 0.2, -0.84], [0.06, y0 + 0.12, -0.92]], [0.07, 0.05, 0.03], 6));
  B.push(knob(0.06, [0.08, y0 + 0.14, -0.94], [0.3, 0.2, -1]));
  return finish({ marble: M, marble_band: Bd, bronze: B, pr_shell: Sh, pr_dark: K });
});

// ---------- 铜鹤 ----------
registerProtoFamily('crane', () => {
  const M = [], Bd = [], B = [];
  const x = xumi(0.80, 0.80, 0.82);
  M.push(x.main); Bd.push(x.band);
  const y0 = 0.82;
  B.push(lathe([[0.30, 0], [0.30, 0.03], [0.26, 0.05], [0.001, 0.05]], 16).translate(0, y0, 0));
  const yf = y0 + 0.05;
  for (const s of [-1, 1]) {
    const foot = [s * 0.08, yf + 0.02, 0.04], knee = [s * 0.08, yf + 0.40, -0.02], hip = [s * 0.06, yf + 0.70, 0.02];
    B.push(rod(foot, knee, 0.02, 0.019, 6), rod(knee, hip, 0.02, 0.03, 6), ell(...knee, 0.028, 0.034, 0.028, 6, 4));
    for (const a of [-0.45, 0, 0.45]) B.push(rod(foot, [foot[0] + Math.sin(a) * 0.15, yf + 0.008, foot[2] + Math.cos(a) * 0.15], 0.013, 0.007, 4));
    B.push(rod(foot, [foot[0], yf + 0.008, -0.06], 0.011, 0.006, 4));
  }
  B.push(ell(0, yf + 0.86, -0.04, 0.14, 0.15, 0.34, 10, 7, [-0.22, 0, 0]));
  for (const s of [-1, 1]) B.push(ell(s * 0.115, yf + 0.89, -0.12, 0.05, 0.15, 0.40, 8, 5, [-0.12, 0, s * 0.15]));
  // 三级飞羽下垂成“尾”
  for (const s of [-1, -0.35, 0.35, 1]) B.push(ellB([s * 0.07, yf + 0.78, -0.46], [0.05, 0.17, 0.02], [s * 0.25, -0.75, -1], [0, 0.8, -0.6], 6, 4));
  B.push(tube([[0, yf + 0.92, 0.20], [0, yf + 1.12, 0.31], [0, yf + 1.36, 0.27], [0, yf + 1.55, 0.31], [0, yf + 1.62, 0.36]], [0.06, 0.04, 0.034, 0.031, 0.029], 7));
  B.push(ell(0, yf + 1.63, 0.36, 0.042, 0.046, 0.065, 7, 5));
  B.push(knob(0.03, [0, yf + 1.672, 0.35], [0, 1, 0]));
  B.push(rod([0, yf + 1.632, 0.40], [0, yf + 1.72, 0.62], 0.018, 0.003, 6));
  return finish({ marble: M, marble_band: Bd, bronze: B });
});

// ---------- 香炉 ----------
function dingParts() {
  const M = [], B = [];
  M.push(lathe([[0.56, 0], [0.56, 0.08], [0.52, 0.10], [0.47, 0.15], [0.46, 0.30], [0.50, 0.36], [0.54, 0.42], [0.54, 0.50], [0.50, 0.52], [0.001, 0.53]], 20));
  const y0 = 0.52;
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 3 + (i * TAU) / 3, dx = Math.sin(a), dz = Math.cos(a);
    B.push(tube([[dx * 0.24, y0 + 0.42, dz * 0.24], [dx * 0.30, y0 + 0.25, dz * 0.30], [dx * 0.31, y0 + 0.10, dz * 0.31], [dx * 0.34, y0 + 0.03, dz * 0.34]], [0.075, 0.055, 0.05, 0.065], 7, { ref: [dz, 0, -dx] }));
    B.push(ellB([dx * 0.31, y0 + 0.36, dz * 0.31], [0.09, 0.08, 0.04], [0, 1, 0], [dx, 0, dz], 7, 4));
    B.push(ell(dx * 0.345, y0 + 0.025, dz * 0.345, 0.075, 0.03, 0.075, 7, 3));
  }
  B.push(lathe([[0.001, y0 + 0.30], [0.22, y0 + 0.31], [0.34, y0 + 0.37], [0.41, y0 + 0.48], [0.43, y0 + 0.60], [0.41, y0 + 0.72], [0.38, y0 + 0.78], [0.38, y0 + 0.81], [0.42, y0 + 0.83], [0.42, y0 + 0.87], [0.38, y0 + 0.87]], 18));
  B.push(new THREE.TorusGeometry(0.425, 0.012, 3, 24).rotateX(Math.PI / 2).translate(0, y0 + 0.62, 0));
  // 立耳
  const ear = new THREE.Shape();
  ear.moveTo(-0.085, 0); ear.lineTo(0.085, 0); ear.lineTo(0.10, 0.24); ear.lineTo(-0.10, 0.24); ear.lineTo(-0.085, 0);
  const hole = new THREE.Path();
  hole.moveTo(-0.045, 0.05); hole.lineTo(-0.055, 0.18); hole.lineTo(0.055, 0.18); hole.lineTo(0.045, 0.05); hole.lineTo(-0.045, 0.05);
  ear.holes.push(hole);
  const eg = extrude(ear, 0.045, 2);
  for (const s of [-1, 1]) B.push(eg.clone().rotateY(Math.PI / 2).rotateZ(-s * 0.12).translate(s * 0.39, y0 + 0.83, 0));
  B.push(lathe([[0.40, y0 + 0.87], [0.39, y0 + 0.91], [0.33, y0 + 1.00], [0.24, y0 + 1.07], [0.14, y0 + 1.12], [0.11, y0 + 1.15]], 18));
  B.push(lathe([[0.11, y0 + 1.14], [0.13, y0 + 1.18], [0.08, y0 + 1.22], [0.06, y0 + 1.26], [0.10, y0 + 1.33], [0.10, y0 + 1.38], [0.06, y0 + 1.44], [0.001, y0 + 1.50]], 10));
  return finish({ marble: M, bronze: B });
}
function towerParts() {
  const M = [], B = [], K = [];
  const hex = (pts) => lathe(pts, 6, { phase: Math.PI / 6, flat: true });
  M.push(hex([[0.64, 0], [0.64, 0.1], [0.58, 0.13], [0.52, 0.2], [0.52, 0.36], [0.58, 0.42], [0.62, 0.48], [0.62, 0.55], [0.001, 0.56]]));
  B.push(hex([[0.46, 0.55], [0.46, 0.62], [0.38, 0.66], [0.36, 0.70], [0.42, 0.90], [0.44, 1.02], [0.40, 1.16], [0.33, 1.24], [0.36, 1.28]]));
  const roof = (y, r0, r1, h) => hex([[r0, y], [r1, y + 0.05], [r1 * 1.03, y + 0.09], [r1 * 0.75, y + h * 0.45], [r0 * 0.75, y + h * 0.8], [r0 * 0.6, y + h]]);
  const tier = (y0, y1, r) => {
    K.push(hex([[r * 0.8, y0], [r * 0.8, y1]]));
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * TAU) / 6; B.push(rod([Math.sin(a) * r, y0, Math.cos(a) * r], [Math.sin(a) * r, y1, Math.cos(a) * r], 0.025, 0.025, 4, true)); }
    B.push(hex([[r * 1.08, y0 - 0.03], [r * 1.08, y0]]), hex([[r * 1.06, y1 - 0.04], [r * 1.06, y1]]));
  };
  B.push(roof(1.28, 0.36, 0.56, 0.26));
  tier(1.54, 1.90, 0.26);
  B.push(roof(1.90, 0.28, 0.45, 0.25));
  tier(2.15, 2.42, 0.18);
  B.push(roof(2.42, 0.20, 0.34, 0.28));
  B.push(lathe([[0.07, 2.69], [0.10, 2.73], [0.06, 2.79], [0.11, 2.86], [0.07, 2.93], [0.001, 3.0]], 8));
  return finish({ marble: M, bronze: B, pr_dark: K });
}
registerProtoFamily('censer', (key, [k = 'ding']) => (k === 'tower' ? towerParts() : dingParts()));

// ---------- 石灯（八角）----------
registerProtoFamily('lamp', () => {
  const M = [], K = [];
  const oct = (pts) => lathe(pts, 8, { phase: Math.PI / 8, flat: true });
  M.push(oct([[0.48, 0], [0.48, 0.10], [0.43, 0.12], [0.37, 0.18], [0.37, 0.27], [0.43, 0.31], [0.45, 0.36], [0.001, 0.37]]));
  M.push(oct([[0.14, 0.36], [0.125, 1.20]]));
  M.push(oct([[0.15, 1.18], [0.22, 1.23], [0.30, 1.31], [0.31, 1.38], [0.001, 1.39]]));
  K.push(oct([[0.18, 1.38], [0.18, 1.74]]));
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * TAU;
    M.push(boxGeo(0.06, 0.36, 0.06).rotateY(a).translate(Math.sin(a) * 0.235, 1.56, Math.cos(a) * 0.235));
  }
  M.push(oct([[0.26, 1.73], [0.27, 1.76], [0.001, 1.765]]));
  M.push(oct([[0.25, 1.75], [0.39, 1.79], [0.41, 1.83], [0.31, 1.89], [0.18, 1.97], [0.08, 2.04], [0.05, 2.06]]));
  M.push(lathe([[0.05, 2.05], [0.08, 2.09], [0.06, 2.12], [0.08, 2.16], [0.001, 2.22]], 8));
  return finish({ marble: M, pr_dark: K });
});

// ---------- 旗杆 ----------
registerProtoFamily('flagpole', () => {
  const M = [], W = [], Fe = [], Au = [];
  M.push(rectStack(1.8, 1.8, [[0, 0], [0, 0.24], [-0.04, 0.28]]));
  for (const s of [-1, 1]) M.push(rectStack(0.32, 0.80, [[0, 0], [0, 1.42], [-0.03, 1.45], [-0.10, 1.58]]).translate(s * 0.31, 0.28, 0));
  W.push(cylGeo(0.085, 0.15, 11.2, 12, true).translate(0, 0.28, 0));
  for (const y of [0.55, 1.0, 1.45]) Fe.push(cylGeo(0.165, 0.165, 0.06, 12).translate(0, 0.28 + y, 0));
  // 斗：倒置方台形木斗，口沿镶边
  W.push(lathe([[0.12, 0], [0.30, 0.30], [0.30, 0.36], [0.27, 0.36], [0.27, 0.31], [0.001, 0.31]], 4, { phase: Math.PI / 4, flat: true }).translate(0, 9.3, 0));
  Au.push(lathe([[0.31, 0.29], [0.31, 0.335]], 4, { phase: Math.PI / 4, flat: true }).translate(0, 9.3, 0));
  Au.push(lathe([[0.09, 0], [0.12, 0.08], [0.07, 0.2], [0.10, 0.3], [0.04, 0.42], [0.001, 0.56]], 8).translate(0, 11.44, 0));
  return finish({ marble: M, wood_red: W, iron: Fe, gold: Au });
});

// ---------- 石碑（龟趺 + 碑身 + 螭首）----------
registerProtoFamily('stele', () => {
  const M = [], Sh = [], T = [];
  M.push(rectStack(1.9, 3.3, [[0, 0], [0, 0.16], [-0.04, 0.2]]));
  const y0 = 0.2;
  // 赑屃
  M.push(ell(0, y0 + 0.17, 0, 0.70, 0.17, 1.10, 12, 5));
  M.push(ell(0, y0 + 0.26, -0.02, 0.82, 0.06, 1.20, 16, 4));
  Sh.push(new THREE.SphereGeometry(1, 16, 6, 0, TAU, 0, Math.PI / 2).scale(0.78, 0.52, 1.14).translate(0, y0 + 0.26, -0.02));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const hip = [sx * 0.56, y0 + 0.26, sz * 0.62], foot = [sx * 0.78, y0 + 0.06, sz * 0.74];
    M.push(tube([hip, [sx * 0.68, y0 + 0.18, sz * 0.68], foot], [0.17, 0.15, 0.13], 7, { ref: [0, 0, 1] }));
    M.push(ell(foot[0], y0 + 0.05, foot[2] + 0.04 * sz, 0.16, 0.06, 0.18, 7, 4));
    for (const t of [-1.5, -0.5, 0.5, 1.5]) M.push(knob(0.04, [foot[0] + t * 0.06, y0 + 0.03, foot[2] + 0.2 * sz], [0, 0.3, sz]));
  }
  M.push(tube([[0, y0 + 0.30, 0.98], [0, y0 + 0.46, 1.22], [0, y0 + 0.56, 1.34]], [0.24, 0.21, 0.19], 8));
  const hz = 1.44, hy = y0 + 0.60;
  M.push(ell(0, hy, hz, 0.23, 0.20, 0.26, 10, 7));
  M.push(ell(0, hy - 0.05, hz + 0.20, 0.17, 0.13, 0.15, 8, 5));
  for (const sx of [-1, 1]) {
    M.push(ell(sx * 0.12, hy + 0.08, hz + 0.17, 0.065, 0.06, 0.06, 6, 4));
    M.push(ell(sx * 0.13, hy + 0.15, hz + 0.12, 0.08, 0.035, 0.05, 6, 4, [0, 0, -sx * 0.4]));
    M.push(ell(sx * 0.22, hy + 0.06, hz - 0.05, 0.05, 0.10, 0.08, 6, 4, [0, 0, sx * 0.6]));
  }
  M.push(tube([[0, y0 + 0.24, -1.10], [0, y0 + 0.16, -1.30], [0.08, y0 + 0.08, -1.38]], [0.11, 0.07, 0.04], 6));
  // 碑座
  M.push(rectStack(1.28, 0.58, [[0, 0], [0, 0.42], [-0.04, 0.46]]).translate(0, y0 + 0.40, -0.05));
  // 碑身
  const yb = y0 + 0.86, bw = 1.10, bt = 0.34, bh = 2.12, zb = -0.05;
  M.push(boxAt(bw, bh, bt, 0, yb + bh / 2, zb));
  for (const s of [1, -1]) {
    const p = new THREE.PlaneGeometry(bw - 0.06, bh - 0.06);
    if (s < 0) p.rotateY(Math.PI);
    T.push(p.translate(0, yb + bh / 2, zb + s * (bt / 2 + 0.003)));
  }
  // 碑首：半椭圆顶，两面盘龙浮雕 + 碑额
  const yc = yb + bh;
  const cr = new THREE.Shape();
  cr.moveTo(-0.6, 0); cr.lineTo(0.6, 0); cr.lineTo(0.6, 0.28);
  cr.absellipse(0, 0.28, 0.6, 0.54, 0, Math.PI, false);
  cr.lineTo(-0.6, 0);
  M.push(extrude(cr, 0.40, 12).translate(0, yc, zb));
  M.push(boxAt(1.24, 0.06, 0.44, 0, yc + 0.03, zb));
  for (const s of [1, -1]) {
    const fz = zb + s * 0.2;
    M.push(boxAt(0.30, 0.36, 0.04, 0, yc + 0.32, fz));
    for (let i = 0; i < 6; i++) {
      const a = 0.18 + (i / 5) * (Math.PI - 0.36), px = Math.cos(a) * 0.48, py = 0.28 + Math.sin(a) * 0.42;
      M.push(ellB([px, yc + py, fz], [0.09, 0.15, 0.045], [-Math.sin(a), Math.cos(a), 0], [0, 0, s], 7, 4));
    }
    for (const sx of [-1, 1]) M.push(ellB([sx * 0.42, yc + 0.12, fz], [0.1, 0.14, 0.045], [sx * 0.3, 1, 0], [0, 0, s], 7, 4));
  }
  return finish({ marble: M, pr_shell_stone: Sh, pr_stele: T });
});

// ---------- 桥栏构件原型（实际尺寸，望柱 0.22 见方）----------
registerProtoFamily('pr_post', (key, [kind = '24']) => {
  const g = [];
  if (kind === 'stone') {
    g.push(rectStack(0.20, 0.20, [[0, -0.08], [0, 0.74]], { top: false }));
    g.push(lathe([[0.15, 0.74], [0.15, 0.79], [0.11, 0.82], [0.001, 0.95]], 4, { phase: Math.PI / 4, flat: true }));
    return [{ mat: 'stone_grey', geo: merge(g) }];
  }
  const sh = 0.98;
  g.push(rectStack(0.22, 0.22, [[0, -0.08], [0, sh]], { top: false }));
  // 柱身盒子心（浅浮雕框线）
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) g.push(boxGeo(0.15, 0.022, 0.014).translate(0, 0.30, 0.11).rotateY(r), boxGeo(0.15, 0.022, 0.014).translate(0, 0.86, 0.11).rotateY(r));
  if (kind === 'dragon') {
    g.push(lathe([[0.13, sh], [0.135, sh + 0.02], [0.12, sh + 0.05], [0.10, sh + 0.07], [0.10, sh + 0.32]], 10));
    const hp = [], hr = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, a = t * 3 * Math.PI; hp.push([Math.sin(a) * 0.105, sh + 0.08 + t * 0.24, Math.cos(a) * 0.105]); hr.push(0.042 - t * 0.015); }
    g.push(tube(hp, hr, 6));
    g.push(ell(0.0, sh + 0.33, 0.12, 0.045, 0.04, 0.07, 6, 4), ell(0, sh + 0.16, -0.12, 0.05, 0.03, 0.02, 5, 3));
    g.push(lathe([[0.10, sh + 0.31], [0.135, sh + 0.34], [0.13, sh + 0.37], [0.08, sh + 0.42], [0.04, sh + 0.45], [0.001, sh + 0.46]], 10));
  } else {
    // 二十四气柱头：叠涩圆盘 + 圆顶
    g.push(lathe([[0.12, sh], [0.13, sh + 0.02], [0.13, sh + 0.05], [0.105, sh + 0.06], [0.115, sh + 0.09], [0.115, sh + 0.13], [0.10, sh + 0.14], [0.112, sh + 0.17], [0.112, sh + 0.24], [0.10, sh + 0.25], [0.11, sh + 0.28], [0.10, sh + 0.34], [0.07, sh + 0.39], [0.001, sh + 0.41]], 10));
  }
  return [{ mat: 'marble', geo: merge(g) }];
});
registerProtoFamily('pr_baogu', () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.06); s.lineTo(1.0, -0.06); s.lineTo(1.0, 0.08);
  s.quadraticCurveTo(1.0, 0.2, 0.88, 0.2);
  s.lineTo(0.65, 0.33);
  s.absarc(0.36, 0.52, 0.34, -0.58, (2 * Math.PI) / 3, false);
  s.lineTo(0, 0.86); s.lineTo(0, -0.06);
  const g = [extrude(s, 0.16, 8).rotateY(-Math.PI / 2)];
  g.push(new THREE.CylinderGeometry(0.25, 0.25, 0.20, 14).rotateZ(Math.PI / 2).translate(0, 0.52, 0.36));
  g.push(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 10).rotateZ(Math.PI / 2).translate(0, 0.52, 0.36));
  g.push(ell(0, 0.13, 0.86, 0.09, 0.07, 0.07, 6, 4));
  return [{ mat: 'marble', geo: merge(g) }];
});

// ---------- 桥 ----------
/** 三角形收集器：tri() 按期望法线 want 自动定向 */
class TriSet {
  constructor() { this.p = []; this.u = []; this.n = []; }
  tri(a, b, c, want, ua, ub, uc, na, nb, nc) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (cr[0] * want[0] + cr[1] * want[1] + cr[2] * want[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; [nb, nc] = [nc, nb]; for (let i = 0; i < 3; i++) cr[i] = -cr[i]; }
    const l = Math.hypot(...cr) || 1, fn = [cr[0] / l, cr[1] / l, cr[2] / l];
    this.p.push(...a, ...b, ...c);
    this.u.push(...(ua || [0, 0]), ...(ub || [0, 0]), ...(uc || [0, 0]));
    this.n.push(...(na || fn), ...(nb || fn), ...(nc || fn));
  }
  quad(a, b, c, d, want, uv, nr) {
    this.tri(a, b, c, want, uv?.[0], uv?.[1], uv?.[2], nr?.[0], nr?.[1], nr?.[2]);
    this.tri(a, c, d, want, uv?.[0], uv?.[2], uv?.[3], nr?.[0], nr?.[2], nr?.[3]);
  }
  geo() { return this.p.length ? fromArrays(this.p, this.u, this.n) : null; }
}
// 寻杖栏板（局部：沿 +Z 从 0 到 len，底 y=0，竖直）
const panelCache = new Map();
function panelGeo(len, kind) {
  const key = `${kind}:${len.toFixed(2)}`;
  if (panelCache.has(key)) return panelCache.get(key);
  const g = [];
  if (kind === 'stone') {
    g.push(boxAt(0.12, 0.62, len, 0, 0.27, len / 2), boxAt(0.16, 0.07, len + 0.02, 0, 0.615, len / 2));
  } else {
    g.push(boxAt(0.11, 0.46, len, 0, 0.19, len / 2));
    for (const sx of [-1, 1]) for (const y of [0.08, 0.36]) g.push(boxAt(0.016, 0.03, len - 0.14, sx * 0.058, y, len / 2));
    const half = [[0.045, 0.42], [0.085, 0.52], [0.04, 0.625], [0.035, 0.67], [0.15, 0.745], [0.15, 0.79]];
    const vase = [...half, ...half.slice().reverse().map(([z, y]) => [-z, y])];
    const vg = extrude(vase, 0.08, 2).rotateY(-Math.PI / 2);
    g.push(vg.clone().translate(0, 0, len / 2));
    g.push(vg.clone().scale(1, 1, 0.55).translate(0, 0, 0.1), vg.clone().scale(1, 1, 0.55).translate(0, 0, len - 0.1));
    g.push(new THREE.CylinderGeometry(0.055, 0.055, len + 0.04, 8).rotateX(Math.PI / 2).translate(0, 0.84, len / 2));
  }
  const m = merge(g);
  panelCache.set(key, m);
  return m;
}

/**
 * 石拱桥 / 平桥（汉白玉，带栏杆）。局部坐标：桥中心在原点，桥身沿 Z 方向（跨越沿 X 流向的河道），桥面中点高 archH。
 * opts: length 桥长（沿 Z）, width 桥宽, archH 拱顶桥面高（相对两端地面）, arches 拱券数(1/3),
 *   style: 'marble'（金水桥，汉白玉，栏杆望柱）| 'stone' ; railings(true); waterY 水面高度（用于券洞）
 *   可选：dragonPosts 龙纹望柱（中路御路桥）; bedY 河底; crown 拱顶以上桥身厚; span 平桥河道宽; postSpacing 望柱间距; deckMat 桥面材质
 * 返回 { channel: [zMin, zMax] 河道（券洞外沿）, springY 起拱高, bedY, deckY(z) 桥面高函数 }
 */
export function buildBridge(ctx, opts) {
  opts = opts || {};
  const L = opts.length ?? 20, W = opts.width ?? 6, H = opts.archH ?? 1.5;
  const stone = opts.style === 'stone', rails = opts.railings !== false;
  const n = Math.max(1, opts.arches ?? 1);
  const waterY = opts.waterY ?? (stone ? -1.2 : -1.8), bedY = opts.bedY ?? waterY - 0.8;
  const M = stone ? 'stone_grey' : 'marble', deckMat = opts.deckMat ?? 'pr_deck';
  const hl = L / 2, hw = W / 2, gy = -0.3;
  // 纵断面与券洞
  let yd;
  const open = [];
  const sy = waterY + 0.25;
  if (!stone) {
    yd = (z) => H * (0.5 + 0.5 * Math.cos(Math.PI * clamp(z / hl, -1, 1)));
    const tc = opts.crown ?? clamp(H * 0.38, 0.45, 0.8);
    const R0 = Math.max(0.8, H - tc - sy);
    open.push({ c: 0, r: R0, top: sy, arch: true });
    if (n >= 3) {
      const p = Math.max(0.6, R0 * 0.3);
      let R1 = R0 * 0.62;
      for (let k = 0; k < 40 && sy + R1 + tc * 0.9 > yd(R0 + p + R1); k++) R1 *= 0.94;
      const c1 = R0 + p + R1;
      open.push({ c: c1, r: R1, top: sy, arch: true }, { c: -c1, r: R1, top: sy, arch: true });
    }
  } else {
    const span = opts.span ?? L * 0.5, flat = Math.min(hl * 0.9, span / 2 + 0.6);
    yd = (z) => { const t = (Math.abs(z) - flat) / (hl - flat); return t <= 0 ? H : H * (1 - smooth(clamp(t, 0, 1))); };
    const pier = 0.7, sw = (span - (n - 1) * pier) / n, top = H - (opts.crown ?? 0.45);
    for (let i = 0; i < n; i++) open.push({ c: -span / 2 + sw / 2 + i * (sw + pier), r: sw / 2, top, arch: false });
  }
  open.sort((a, b) => b.c - a.c);
  const arcK = (o) => Math.max(10, Math.round(o.r * 6));
  // 侧立面轮廓 (z, y)
  const N = Math.max(24, Math.ceil(L / 0.5));
  const zs = [];
  for (let i = 0; i <= N; i++) zs.push(-hl + (L * i) / N);
  const ol = zs.map((z) => [z, yd(z)]);
  const zE = open[0].c + open[0].r, zW = open[open.length - 1].c - open[open.length - 1].r;
  ol.push([hl, gy], [zE, gy]);
  open.forEach((o, i) => {
    if (o.arch) { const K = arcK(o); for (let k = 0; k <= K; k++) { const a = (Math.PI * k) / K; ol.push([o.c + o.r * Math.cos(a), o.top + o.r * Math.sin(a)]); } }
    else ol.push([o.c + o.r, o.top], [o.c - o.r, o.top]);
    const nx = open[i + 1];
    if (nx) ol.push([o.c - o.r, bedY], [nx.c + nx.r, bedY]);
  });
  ol.push([zW, gy], [-hl, gy]);
  const ct = [];
  for (const [z, y] of ol) { const l = ct[ct.length - 1]; if (!l || Math.abs(l.x - z) > 1e-5 || Math.abs(l.y - y) > 1e-5) ct.push(new THREE.Vector2(z, y)); }
  const tris = THREE.ShapeUtils.triangulateShape(ct, []);
  const body = new TriSet();
  for (const sx of [-1, 1]) for (const t of tris) {
    const [a, b, c] = t.map((i) => ct[i]);
    body.tri([sx * hw, a.y, a.x], [sx * hw, b.y, b.x], [sx * hw, c.y, c.x], [sx, 0, 0], [a.x, a.y], [b.x, b.y], [c.x, c.y]);
  }
  // 券洞内壁 / 平桥底面，及金刚墙（券脚至河底）
  for (const o of open) {
    if (o.arch) {
      const K = arcK(o);
      for (let k = 0; k < K; k++) {
        const a0 = (Math.PI * k) / K, a1 = (Math.PI * (k + 1)) / K;
        const P = (x, a) => [x, o.top + o.r * Math.sin(a), o.c + o.r * Math.cos(a)], Nn = (a) => [0, -Math.sin(a), -Math.cos(a)];
        body.quad(P(-hw, a0), P(hw, a0), P(hw, a1), P(-hw, a1), Nn((a0 + a1) / 2), [[-hw, o.r * a0], [hw, o.r * a0], [hw, o.r * a1], [-hw, o.r * a1]], [Nn(a0), Nn(a0), Nn(a1), Nn(a1)]);
      }
    } else body.quad([-hw, o.top, o.c - o.r], [hw, o.top, o.c - o.r], [hw, o.top, o.c + o.r], [-hw, o.top, o.c + o.r], [0, -1, 0], [[-hw, o.c - o.r], [hw, o.c - o.r], [hw, o.c + o.r], [-hw, o.c + o.r]]);
    for (const s of [-1, 1]) {
      const z = o.c + s * o.r;
      body.quad([-hw, bedY, z], [hw, bedY, z], [hw, o.top, z], [-hw, o.top, z], [0, 0, -s], [[-hw, bedY], [hw, bedY], [hw, o.top], [-hw, o.top]]);
    }
  }
  // 分水尖（多孔桥墩两端）
  for (let i = 0; i < open.length - 1; i++) {
    const za = open[i].c - open[i].r, zb = open[i + 1].c + open[i + 1].r, zm = (za + zb) / 2, d = (za - zb) * 0.45, yt = sy + Math.min(open[i].r, open[i + 1].r) * 0.35;
    for (const sx of [-1, 1]) {
      const tip = [sx * (hw + d), zm], A = [sx * hw, za], Bp = [sx * hw, zb];
      body.quad([A[0], bedY, A[1]], [tip[0], bedY, tip[1]], [tip[0], yt, tip[1]], [A[0], yt, A[1]], [sx, 0, 1], [[0, bedY], [d, bedY], [d, yt], [0, yt]]);
      body.quad([Bp[0], bedY, Bp[1]], [tip[0], bedY, tip[1]], [tip[0], yt + 0.0, tip[1]], [Bp[0], yt, Bp[1]], [sx, 0, -1], [[0, bedY], [d, bedY], [d, yt], [0, yt]]);
      body.tri([A[0], yt, A[1]], [tip[0], yt, tip[1]], [Bp[0], yt, Bp[1]], [0, 1, 0]);
    }
  }
  // 券脸石（拱圈外凸带）与龙门石
  if (!stone) {
    for (const o of open) {
      const rw = clamp(yd(o.c) - (o.top + o.r) - 0.28, 0.16, 0.36);
      const sh = new THREE.Shape();
      sh.absarc(0, 0, o.r + rw, 0, Math.PI, false);
      sh.absarc(0, 0, o.r, Math.PI, 0, true);
      const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: arcK(o) }).rotateY(Math.PI / 2);
      const key = boxGeo(0.26, rw + 0.06, 0.08);
      for (const sx of [-1, 1]) {
        const r2 = rg.clone();
        if (sx < 0) r2.rotateY(Math.PI);
        ctx.add(M, r2.translate(sx * hw, o.top, o.c));
        ctx.add(M, key.clone().rotateY(Math.PI / 2).translate(sx * (hw + 0.04), o.top + o.r + rw / 2 + 0.02, o.c));
      }
    }
  }
  ctx.add(M, body.geo());
  // 桥面 + 仰天石（侧檐）
  const sArr = [0];
  for (let i = 1; i < zs.length; i++) sArr.push(sArr[i - 1] + Math.hypot(zs[i] - zs[i - 1], yd(zs[i]) - yd(zs[i - 1])));
  const nAt = (z) => { const e = 0.05, k = (yd(z + e) - yd(z - e)) / (2 * e), l = Math.hypot(1, k); return [0, 1 / l, -k / l]; };
  const deck = new TriSet(), edge = new TriSet();
  const co = stone ? 0.05 : 0.07, ch = stone ? 0.2 : 0.26;
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], y0 = yd(z0), y1 = yd(z1), s0 = sArr[i], s1 = sArr[i + 1];
    deck.quad([-hw, y0, z0], [hw, y0, z0], [hw, y1, z1], [-hw, y1, z1], [0, 1, 0], [[-hw, s0], [hw, s0], [hw, s1], [-hw, s1]], [nAt(z0), nAt(z0), nAt(z1), nAt(z1)]);
    for (const sx of [-1, 1]) {
      const xo = sx * (hw + co);
      edge.quad([xo, y0 - ch, z0], [xo, y1 - ch, z1], [xo, y1, z1], [xo, y0, z0], [sx, 0, 0], [[z0, y0 - ch], [z1, y1 - ch], [z1, y1], [z0, y0]]);
      edge.quad([sx * hw, y0, z0], [xo, y0, z0], [xo, y1, z1], [sx * hw, y1, z1], [0, 1, 0], [[sx * hw, z0], [xo, z0], [xo, z1], [sx * hw, z1]]);
      edge.quad([sx * hw, y0 - ch, z0], [xo, y0 - ch, z0], [xo, y1 - ch, z1], [sx * hw, y1 - ch, z1], [0, -1, 0], [[sx * hw, z0], [xo, z0], [xo, z1], [sx * hw, z1]]);
    }
  }
  ctx.add(deckMat, deck.geo());
  ctx.add(M, edge.geo());
  const info = { channel: [zW, zE], springY: sy, bedY, deckY: yd };
  if (!rails) return info;
  // 栏杆：地栿 + 望柱（原型）+ 栏板（剪切矩阵贴合坡度）+ 抱鼓石
  const sh = stone ? 0.10 : 0.14, sw = stone ? 0.26 : 0.30, xr = hw - sw / 2 - 0.02;
  const sill = new TriSet();
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i], z1 = zs[i + 1], y0 = yd(z0), y1 = yd(z1);
    for (const sx of [-1, 1]) {
      const xi = sx * (xr - sw / 2), xo = sx * (xr + sw / 2);
      sill.quad([xi, y0 + sh, z0], [xo, y0 + sh, z0], [xo, y1 + sh, z1], [xi, y1 + sh, z1], [0, 1, 0], [[xi, z0], [xo, z0], [xo, z1], [xi, z1]]);
      for (const x of [xi, xo]) sill.quad([x, y0 - 0.02, z0], [x, y1 - 0.02, z1], [x, y1 + sh, z1], [x, y0 + sh, z0], [Math.sign(x) * (x === xo ? 1 : -1), 0, 0], [[z0, y0], [z1, y1], [z1, y1 + sh], [z0, y0 + sh]]);
    }
  }
  ctx.add(M, sill.geo());
  const eb = stone ? 0.25 : 1.0, pw = stone ? 0.20 : 0.22;
  const zA = -hl + eb, zB = hl - eb;
  const sAt = (z) => { const f = ((z + hl) / L) * N, i = clamp(Math.floor(f), 0, N - 1); return sArr[i] + (sArr[i + 1] - sArr[i]) * (f - i); };
  const zAt = (s) => { let i = 0; while (i < N - 1 && sArr[i + 1] < s) i++; return zs[i] + ((s - sArr[i]) / (sArr[i + 1] - sArr[i] || 1)) * (zs[i + 1] - zs[i]); };
  const sa = sAt(zA), sb = sAt(zB), ps = opts.postSpacing ?? (stone ? 1.6 : 1.75);
  const np = Math.max(1, Math.round((sb - sa) / ps));
  const posts = [];
  for (let i = 0; i <= np; i++) posts.push(zAt(sa + ((sb - sa) * i) / np));
  const kind = stone ? 'stone' : opts.dragonPosts ? 'dragon' : '24';
  for (const sx of [-1, 1]) {
    for (const z of posts) ctx.place(`pr_post:${kind}`, sx * xr, yd(z) + sh, z, 0, 1);
    for (let i = 0; i < posts.length - 1; i++) {
      const za = posts[i] + pw / 2, zb = posts[i + 1] - pw / 2, ya = yd(za) + sh - 0.03, yb2 = yd(zb) + sh - 0.03;
      const k = (yb2 - ya) / (zb - za);
      const m = new THREE.Matrix4().set(1, 0, 0, sx * xr, 0, 1, k, ya, 0, 0, 1, za, 0, 0, 0, 1);
      ctx.add(M, panelGeo(zb - za, stone ? 'stone' : 'marble'), m);
    }
    if (!stone) {
      ctx.place('pr_baogu', sx * xr, yd(zB + pw / 2) + sh, zB + pw / 2, 0, 1);
      ctx.place('pr_baogu', sx * xr, yd(zA - pw / 2) + sh, zA - pw / 2, Math.PI, 1);
    }
  }
  return info;
}
