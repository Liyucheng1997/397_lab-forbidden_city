// 门窗装修：隔扇门、槛窗、支摘窗、板门（门钉）、槛墙、横披、倒挂楣子、坐凳栏杆。
// 局部坐标：一间（两柱之间）居中于 x=0，宽 w（柱内皮间净宽），立面在 z=0 平面、朝 +Z（室外），
// 自 y=0（台明顶/室内地面）至 y=h（额枋底/上槛顶）。厚度向 -Z 方向（约 0.1~0.3m）。
// 槛框前皮在 z=0；扇面退进 3cm，隔心再凹进 3cm；背面封一张板（室内/门洞背面可见）。
// 棂格用纹理（性能），框架用面片（只建可见面）。原型：'op_stud'（门钉，单位半径）、'op_pushou'（铺首兽面，单位直径）、'op_ring'（门环，单位半径）。
import * as THREE from 'three';
import { fromArrays, gridSurface, latheGeo, merge, clamp } from './geom.js';
import { registerTexture, makeTexture } from './textures.js';
import { defineMaterial } from './materials.js';
import { registerProto } from './protos.js';

const TAU = Math.PI * 2;
const S3 = Math.sqrt(3);
const RED = 'wood_red';
const GILT = 'op_mianye';
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ============ 纹理（DataTexture，行 0 = v=0，便于 v 向上） ============
const C_RED = [150, 34, 22], C_REDD = [92, 18, 12], C_HOLE = [26, 22, 21], C_GOLD = [222, 178, 82];

function dataTex(W, H, data) {
  const t = new THREE.DataTexture(data, W, H);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** 烘焙图案：pat(x,y,px,o) 写入 o.c=[r,g,b], o.a, o.h（高度 0..1）；x,y 为图案单位（tw×th 一周期） */
function bake(W, H, tw, th, pat, k = 3) {
  const col = new Uint8Array(W * H * 4), hm = new Float32Array(W * H);
  const o = { c: [0, 0, 0], a: 1, h: 0 }, px = tw / W;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    o.a = 1; o.h = 0;
    pat(((x + 0.5) / W) * tw, ((y + 0.5) / H) * th, px, o);
    const i = y * W + x;
    col[i * 4] = o.c[0]; col[i * 4 + 1] = o.c[1]; col[i * 4 + 2] = o.c[2]; col[i * 4 + 3] = clamp(o.a, 0, 1) * 255;
    hm[i] = o.h;
  }
  const nor = new Uint8Array(W * H * 4);
  const at = (x, y) => hm[((y + H) % H) * W + ((x + W) % W)];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    const l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    nor[i] = (-dx / l * 0.5 + 0.5) * 255; nor[i + 1] = (-dy / l * 0.5 + 0.5) * 255; nor[i + 2] = (1 / l * 0.5 + 0.5) * 255; nor[i + 3] = 255;
  }
  return { color: dataTex(W, H, col), normal: dataTex(W, H, nor) };
}

function regPattern(name, W, H, tw, th, pat, k) {
  let r = null;
  const run = () => r || (r = bake(W, H, tw, th, pat, k));
  registerTexture(name, () => run().color);
  registerTexture(name + '_normal', () => run().normal);
}

/** 菱花（三交六椀 / 双交四椀）：fams 棂条法向（族间距 a），nodes(x,y) → 至最近交点的向量 */
function flowerPat({ a, fams, nodes, petals, R0, bw, nail }) {
  const seg = TAU / petals;
  return (x, y, px, o) => {
    let db = 1e9;
    for (const [nx, ny] of fams) { const s = (x * nx + y * ny) / a; const d = Math.abs(s - Math.round(s)) * a; if (d < db) db = d; }
    const [dx, dy] = nodes(x, y);
    const r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const lobe = R0 * (0.8 + 0.2 * Math.cos(petals * th));
    const fl = sstep(lobe + px, lobe - px, r);
    const bar = sstep(bw / 2 + px, bw / 2 - px, db);
    const solid = Math.max(fl, bar);
    const rn = Math.min(1, r / lobe);
    let h = Math.max(bar * (0.55 + 0.15 * (1 - db / (bw / 2 + 1e-6))), fl * (0.6 + 0.4 * Math.sin(rn * Math.PI * 0.92 + 0.12)));
    let ang = (((th - seg / 2) % seg) + seg) % seg; ang = Math.min(ang, seg - ang);
    const gw = R0 * 0.07;
    const groove = fl * sstep(gw + px, gw - px, r * Math.sin(ang)) * sstep(nail * 1.1, nail * 1.8, r);
    h -= groove * 0.35;
    const nl = sstep(nail + px, nail - px, r);
    h = Math.max(h, nl * (0.95 + 0.2 * Math.sqrt(Math.max(0, 1 - (r / nail) ** 2))));
    let c = mixc(C_HOLE, C_RED.map((v) => v * (0.72 + 0.28 * h)), solid);
    c = mixc(c, C_REDD, groove * 0.75);
    o.c = mixc(c, C_GOLD, nl);
    o.h = h * solid;
  };
}

// 三交六椀菱花：竖棂 + ±30° 斜棂，竖棂距 a，交点距 L
const SJ_A = 0.085, SJ_L = (2 * SJ_A) / S3;
regPattern('op_lat_sanjiao', 256, 148, 2 * SJ_A, SJ_L, flowerPat({
  a: SJ_A, fams: [[1, 0], [-0.5, S3 / 2], [0.5, S3 / 2]], petals: 6, R0: SJ_L * 0.5, bw: 0.02, nail: 0.0068,
  nodes: (x, y) => {
    let best = 1e9, bx = 0, by = 0;
    const i0 = Math.round(x / SJ_A);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      const oy = i & 1 ? SJ_L / 2 : 0, j = Math.round((y - oy) / SJ_L);
      const ex = x - i * SJ_A, ey = y - j * SJ_L - oy, d = ex * ex + ey * ey;
      if (d < best) { best = d; bx = ex; by = ey; }
    }
    return [bx, by];
  },
}), 3.2);

// 双交四椀菱花：±45° 斜棂，棂距 a
const SQ_A = 0.078, SQ_S = Math.SQRT2 * SQ_A;
regPattern('op_lat_shuangjiao', 192, 192, SQ_S, SQ_S, flowerPat({
  a: SQ_A, fams: [[Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2]], petals: 4, R0: SQ_A * 0.47, bw: 0.018, nail: 0.0068,
  nodes: (x, y) => {
    const ax = x - Math.round(x / SQ_S) * SQ_S, ay = y - Math.round(y / SQ_S) * SQ_S;
    const bx = x - (Math.round(x / SQ_S - 0.5) + 0.5) * SQ_S, by = y - (Math.round(y / SQ_S - 0.5) + 0.5) * SQ_S;
    return ax * ax + ay * ay < bx * bx + by * by ? [ax, ay] : [bx, by];
  },
}), 3.2);

// 方格
const FG_P = 0.11;
regPattern('op_lat_fangge', 128, 128, FG_P, FG_P, (x, y, px, o) => {
  const bw = 0.017;
  const dx = Math.min(x, FG_P - x), dy = Math.min(y, FG_P - y), d = Math.min(dx, dy);
  const bar = sstep(bw / 2 + px, bw / 2 - px, d);
  const h = bar * (0.55 + 0.2 * (1 - d / (bw / 2)));
  o.c = mixc(C_HOLE, C_RED.map((v) => v * (0.75 + 0.3 * h)), bar);
  o.h = h;
}, 3);

/** 由矩形棂条列表组成的图案（单位方块 0..1），rects=[[x0,x1,y0,y1]]，balls=[[x,y,r]] 卡子花 */
function rectPat(rects, balls = [], { bar = C_RED, hole = C_HOLE, alpha = false, ball = null } = {}) {
  return (x, y, px, o) => {
    let best = 1e9, inr = 0;
    for (const [x0, x1, y0, y1] of rects) {
      const d = Math.max(x0 - x, x - x1, y0 - y, y - y1);
      if (d < best) { best = d; inr = Math.min(x - x0, x1 - x, y - y0, y1 - y); }
    }
    let cov = sstep(px, -px, best), bl = 0;
    let h = cov * (0.5 + 0.35 * sstep(0, 0.012, inr));
    for (const [bx, by, br] of balls) {
      const r = Math.hypot(x - bx, y - by), c2 = sstep(br + px, br - px, r);
      if (c2 > 0) { cov = Math.max(cov, c2); h = Math.max(h, c2 * (0.6 + 0.4 * Math.sqrt(Math.max(0, 1 - (r / br) ** 2)))); bl = Math.max(bl, c2); }
    }
    if (alpha) { o.c = bar.map((v) => v * (0.82 + 0.25 * h)); o.a = cov; }
    else o.c = mixc(hole, bar.map((v) => v * (0.75 + 0.3 * h)), cov);
    if (ball && bl > 0) o.c = mixc(o.c, ball, bl);
    o.h = h;
  };
}
const HB = (y, xa, xb, b) => [xa - b / 2, xb + b / 2, y - b / 2, y + b / 2];
const VB = (x, ya, yb, b) => [x - b / 2, x + b / 2, ya - b / 2, yb + b / 2];

// 步步锦（一扇一图，竖向可重复）：外长内短，层层递进，工字连接
{
  const b = 0.028, EX = [0, 0.13, 0.25, 0.37], EY = [0, 0.12, 0.23, 0.34];
  const R = [HB(0, 0, 1, b), HB(1, 0, 1, b), VB(0, 0, 1, b), VB(1, 0, 1, b)];
  for (let k = 1; k < 4; k++) {
    const ex = EX[k], ey = EY[k], px = EX[k - 1], py = EY[k - 1];
    R.push(HB(ey, px, 1 - px, b), HB(1 - ey, px, 1 - px, b), VB(ex, ey, 1 - ey, b), VB(1 - ex, ey, 1 - ey, b));
    R.push(HB(0.5, px, ex, b), HB(0.5, 1 - ex, 1 - px, b), VB(0.5, py, ey, b), VB(0.5, 1 - ey, 1 - py, b));
  }
  regPattern('op_lat_bubujin', 256, 256, 1, 1, rectPat(R), 2.5);
}
// 灯笼框：中心大空当，四周窄框，卡子花
{
  const b = 0.03, e = 0.15;
  const R = [
    HB(0, 0, 1, b), HB(1, 0, 1, b), VB(0, 0, 1, b), VB(1, 0, 1, b),
    HB(e, e, 1 - e, b), HB(1 - e, e, 1 - e, b), VB(e, e, 1 - e, b), VB(1 - e, e, 1 - e, b),
    HB(0.22, 0, e, b), HB(0.78, 0, e, b), HB(0.22, 1 - e, 1, b), HB(0.78, 1 - e, 1, b),
    VB(0.22, 0, e, b), VB(0.78, 0, e, b), VB(0.22, 1 - e, 1, b), VB(0.78, 1 - e, 1, b),
  ];
  const balls = [[0.5, e / 2, 0.045], [0.5, 1 - e / 2, 0.045], [e / 2, 0.5, 0.045], [1 - e / 2, 0.5, 0.045]];
  regPattern('op_lat_denglong', 256, 256, 1, 1, rectPat(R, balls, { ball: C_GOLD }), 2.5);
}
// 倒挂楣子/坐凳楣子棂格（透空，alpha）：u 周期 MZ_P 米，v 0..1 = 楣子净高
const MZ_P = 0.64;
{
  const bu = 0.03 / MZ_P, bv = 0.085;
  const R = [HB(0.3, -0.1, 1.1, bv), HB(0.7, -0.1, 1.1, bv)].map(([x0, x1, y0, y1]) => [x0, x1, y0, y1]);
  const vb = (x, ya, yb) => [x - bu / 2, x + bu / 2, ya, yb];
  for (const x of [0.125, 0.375, 0.625, 0.875]) { R.push(vb(x, 0.7, 1.02), vb(x, -0.02, 0.3)); }
  for (const x of [0, 0.25, 0.5, 0.75, 1]) R.push(vb(x, 0.3, 0.7));
  R.push(HB(0.5, 0, 0.25, bv * 0.8), HB(0.5, 0.5, 0.75, bv * 0.8));
  const balls = [[0.125, 0.5, 0.05], [0.625, 0.5, 0.05]];
  // 卡子花为椭圆（u/v 比例不同），用两层小圆近似
  const pat = rectPat(R, [], { bar: [236, 236, 236], alpha: true });
  regPattern('op_mz', 256, 128, 1, 1, (x, y, px, o) => {
    pat(x, y, px, o);
    for (const [bx, by, br] of balls) {
      const r = Math.hypot((x - bx) * MZ_P / 0.3, y - by), c = sstep(br * 1.6 + px, br * 1.6 - px, r);
      const ring = c * sstep(br * 0.5, br * 0.9, r);
      if (ring > o.a) { o.a = ring; o.c = [236, 236, 236].map((v) => v * 0.95); o.h = 0.7 * ring; }
    }
  }, 2);
}
// 花牙子（透空雕花托角）：u=0 贴柱，v=1 贴楣子底
function huayazi(base) {
  return (x, y, px, o) => {
    const s = x, t = 1 - y;
    const th0 = Math.atan2(t, s);
    const f = Math.pow(s, 0.85) + Math.pow(t, 0.85) + 0.035 * Math.cos(th0 * 10);
    const edge = 1 - f;
    let cov = sstep(-px * 3, px * 3, edge);
    // 卷草：螺旋镂空 + 两个圆孔
    const cx = 0.25, cy = 0.25, dx = s - cx, dy = t - cy, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    const spiral = r - (0.03 + 0.07 * ((th + Math.PI) / TAU));
    const cut = sstep(0.018 + px, 0.018 - px, Math.abs(spiral - 0.03)) * sstep(0.15, 0.12, r);
    const cut2 = sstep(0.035 + px, 0.035 - px, Math.hypot(s - 0.6, t - 0.09)) + sstep(0.035 + px, 0.035 - px, Math.hypot(s - 0.09, t - 0.6));
    cov *= 1 - clamp(cut + cut2, 0, 1);
    const rim = sstep(0.08, 0.045, edge) + sstep(0.025, 0.0, Math.abs(spiral - 0.03) - 0.018) * sstep(0.15, 0.12, r);
    o.c = mixc(base, C_GOLD, clamp(rim, 0, 1));
    o.a = cov;
    o.h = cov * (0.6 + 0.3 * clamp(rim, 0, 1));
  };
}
regPattern('op_hyz_green', 128, 128, 1, 1, huayazi([40, 104, 72]), 2);
regPattern('op_hyz_red', 128, 128, 1, 1, huayazi([142, 30, 20]), 2);

// 门簪正面：青地、金边、金四瓣花（u,v 0..1 对应外接圆直径）
regPattern('op_zan', 128, 128, 1, 1, (x, y, px, o) => {
  const qx = Math.abs(x - 0.5) * 2, qy = Math.abs(y - 0.5) * 2, rin = S3 / 2;
  const hex = Math.max(qy - rin, qx * S3 / 2 + qy * 0.5 - rin);
  const r = Math.hypot(x - 0.5, y - 0.5) * 2, th = Math.atan2(y - 0.5, x - 0.5);
  const rim = sstep(-0.16, -0.12, hex);
  const pet = 0.5 * (0.55 + 0.45 * Math.abs(Math.cos(2 * th)));
  const fl = sstep(pet + 0.02, pet - 0.02, r);
  const dot = sstep(0.1, 0.07, r);
  let c = mixc([30, 70, 104], C_GOLD, Math.max(rim, fl));
  o.c = mixc(c, [170, 40, 26], dot);
  o.h = 0.3 + 0.5 * Math.max(rim, fl) + 0.2 * dot;
}, 2);

// ============ 材质 ============
const latDef = (name, period) => ({ color: 0xffffff, map: name, normalMap: name + '_normal', normalScale: 0.9, roughness: 0.55, period });
defineMaterial('op_lat_sanjiao', latDef('op_lat_sanjiao', [2 * SJ_A, SJ_L]));
defineMaterial('op_lat_shuangjiao', latDef('op_lat_shuangjiao', [SQ_S, SQ_S]));
defineMaterial('op_lat_fangge', latDef('op_lat_fangge', [FG_P, FG_P]));
defineMaterial('op_lat_bubujin', latDef('op_lat_bubujin'));
defineMaterial('op_lat_denglong', latDef('op_lat_denglong'));
defineMaterial('op_mianye', { color: 0xb38a3e, roughness: 0.42, metalness: 0.85, envMapIntensity: 0.9 });
defineMaterial('op_zan', { color: 0xffffff, map: 'op_zan', normalMap: 'op_zan_normal', roughness: 0.45 });

/** 透空材质（alphaTest + alphaToCoverage，双面）；延迟创建 */
function alphaDef(tex, color, period) {
  let m = null;
  return {
    get material() {
      if (m) return m;
      const t = makeTexture(tex).clone();
      if (period) t.repeat.set(1 / period[0], 1 / period[1]);
      t.needsUpdate = true;
      m = new THREE.MeshStandardMaterial({ color, map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
      m.alphaToCoverage = true;
      return m;
    },
  };
}
defineMaterial('op_mz_green', alphaDef('op_mz', 0x2f6e4c, [MZ_P, 1]));
defineMaterial('op_mz_red', alphaDef('op_mz', 0x8e1e14, [MZ_P, 1]));
defineMaterial('op_hyz_green', alphaDef('op_hyz_green', 0xffffff));
defineMaterial('op_hyz_red', alphaDef('op_hyz_red', 0xffffff));

/** 隔心样式 → { mat, mode }：'m' 以米平铺；'rep' 每扇一图竖向重复；'one' 每扇一图 */
const LATTICE = {
  sanjiao: { mat: 'op_lat_sanjiao', mode: 'm' },
  shuangjiao: { mat: 'op_lat_shuangjiao', mode: 'm' },
  fangge: { mat: 'op_lat_fangge', mode: 'm' },
  bubujin: { mat: 'op_lat_bubujin', mode: 'rep' },
  denglong: { mat: 'op_lat_denglong', mode: 'one' },
};
function latSpec(style, shared, override, scale) {
  if (override) return { mat: override, mode: 'one' };
  return LATTICE[style] ? { ...LATTICE[style], scale } : { mat: shared, mode: 'one' };
}
function latUV(L, x0, x1, y0, y1) {
  if (L.mode === 'm') { const xc = (x0 + x1) / 2, yc = (y0 + y1) / 2, k = 1 / (L.scale || 1); return [(x0 - xc) * k, (x1 - xc) * k, (y0 - yc) * k, (y1 - yc) * k]; }
  if (L.mode === 'rep') return [0, 1, 0, Math.max(1, Math.round((y1 - y0) / ((x1 - x0) * 1.05)))];
  return [0, 1, 0, 1];
}

// ============ 原型：门钉、铺首 ============
registerProto('op_stud', () => {
  const g = latheGeo([[1, 0], [0.75, 0.65], [0, 1]], 8);
  g.rotateX(Math.PI / 2);
  return [{ mat: 'gold', geo: g }];
});

/** 极坐标曲面（朝 +Z）：rad(θ) 外缘半径，zf(t) 高度（t=0 中心 .. 1 外缘） */
function polarDome(nTh, nR, rad, zf, cx = 0, cy = 0) {
  const grid = [], uvg = [];
  for (let i = 0; i <= nTh; i++) {
    const th = (i / nTh) * TAU, R = rad(th), row = [], ur = [];
    for (let j = 0; j <= nR; j++) { const t = j / nR; row.push([cx + R * t * Math.cos(th), cy + R * t * Math.sin(th), zf(t, th)]); ur.push([0, 0]); }
    grid.push(row); uvg.push(ur);
  }
  return gridSurface(grid, uvg, true);
}
registerProto('op_pushou', () => {
  // 兽面：火焰边圆盘 + 兽面隆起 + 双目 + 鼻 + 衔环口钮（门环另见 op_ring）
  const plate = polarDome(24, 3, (th) => 0.5 * (0.88 + 0.12 * Math.cos(10 * th)), (t) => 0.07 * (1 - t ** 3));
  const face = polarDome(16, 3, () => 0.27, (t) => 0.06 + 0.12 * Math.sqrt(Math.max(0, 1 - t * t)), 0, 0.03);
  const eyes = [-1, 1].map((s) => polarDome(8, 2, () => 0.055, (t) => 0.15 + 0.05 * Math.sqrt(Math.max(0, 1 - t * t)), s * 0.1, 0.11));
  const nose = polarDome(8, 2, () => 0.06, (t) => 0.17 + 0.06 * Math.sqrt(Math.max(0, 1 - t * t)), 0, -0.02);
  const peg = polarDome(8, 2, () => 0.07, (t) => 0.1 + 0.06 * Math.sqrt(Math.max(0, 1 - t * t)), 0, -0.3);
  return [{ mat: 'gold', geo: merge([plate, face, ...eyes, nose, peg]) }];
});
// 门环：单位半径，贴门面略外倾
registerProto('op_ring', () => {
  const g = new THREE.TorusGeometry(1, 0.13, 5, 16);
  g.rotateX(0.12); g.translate(0, 0, 0.13 + Math.sin(0.12));
  return [{ mat: 'gold', geo: g }];
});
// 共享板门纹理的门钉布局（与 textures.js gateDoor 一致：u 0.10~0.90、v 0.068~0.932，铺首 u=0.8 v=0.453，门环 v=0.37）
const GATE_TEX = { gate_door: { cols: 9, rows: 9 }, gate_door_8: { cols: 8, rows: 9 } };

// ============ 几何累加器（按材质收集面片，最后一次性加入 ctx） ============
class Acc {
  constructor() { this.m = new Map(); }
  L(mat) { let l = this.m.get(mat); if (!l) this.m.set(mat, (l = { p: [], n: [], u: [] })); return l; }
  q4(mat, P, U, n) {
    const l = this.L(mat);
    for (const k of [0, 1, 2, 0, 2, 3]) { const p = P[k], u = U[k]; l.p.push(p[0], p[1], p[2]); l.n.push(n[0], n[1], n[2]); l.u.push(u[0], u[1]); }
  }
  /** 任意平面四边形（逆时针），法线自动 */
  quad(mat, P, U) {
    const [a, b, , d] = P;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    this.q4(mat, P, U, [n[0] / l, n[1] / l, n[2] / l]);
  }
  /** 立面矩形，dir=1 朝 +Z，-1 朝 -Z；uv=[u0,u1,v0,v1]（缺省按米） */
  fz(mat, x0, x1, y0, y1, z, uv, dir = 1) {
    const [u0, u1, v0, v1] = uv || [x0, x1, y0, y1];
    if (dir > 0) this.q4(mat, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [0, 0, 1]);
    else this.q4(mat, [[x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z]], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], [0, 0, -1]);
  }
  /** 侧面（法线 ±X） */
  fx(mat, x, y0, y1, z0, z1, dir) {
    if (dir > 0) this.q4(mat, [[x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1]], [[z1, y0], [z0, y0], [z0, y1], [z1, y1]], [1, 0, 0]);
    else this.q4(mat, [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], [[z0, y0], [z1, y0], [z1, y1], [z0, y1]], [-1, 0, 0]);
  }
  /** 水平面（法线 ±Y） */
  fy(mat, y, x0, x1, z0, z1, dir) {
    if (dir > 0) this.q4(mat, [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], [0, 1, 0]);
    else this.q4(mat, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], [0, -1, 0]);
  }
  /** 长方体，faces 取 f(+Z) b(-Z) l(-X) r(+X) t(+Y) d(-Y) */
  box(mat, x0, x1, y0, y1, z0, z1, faces = 'fblrtd') {
    if (faces.includes('f')) this.fz(mat, x0, x1, y0, y1, z1);
    if (faces.includes('b')) this.fz(mat, x0, x1, y0, y1, z0, null, -1);
    if (faces.includes('l')) this.fx(mat, x0, y0, y1, z0, z1, -1);
    if (faces.includes('r')) this.fx(mat, x1, y0, y1, z0, z1, 1);
    if (faces.includes('t')) this.fy(mat, y1, x0, x1, z0, z1, 1);
    if (faces.includes('d')) this.fy(mat, y0, x0, x1, z0, z1, -1);
  }
  /** 顶部抹斜的长方体（门枕石等） */
  capBox(mat, x0, x1, y0, y1, z0, z1, ch) {
    const yb = y1 - ch;
    this.box(mat, x0, x1, y0, yb, z0, z1, 'fblr');
    const a = [x0, yb, z1], b = [x1, yb, z1], c = [x1, yb, z0], d = [x0, yb, z0];
    const A = [x0 + ch, y1, z1 - ch], B = [x1 - ch, y1, z1 - ch], C = [x1 - ch, y1, z0 + ch], D = [x0 + ch, y1, z0 + ch];
    const uv = (p) => [p[0] + p[2] * 0.3, p[1] + p[2]];
    for (const P of [[a, b, B, A], [b, c, C, B], [c, d, D, C], [d, a, A, D], [A, B, C, D]]) this.quad(mat, P, P.map(uv));
  }
  /** 凹槽：开口四壁（sides 取 l r d t）+ 可选槽底面板 */
  pocket(wall, x0, x1, y0, y1, z, d, panel, uv, sides = 'lrdt') {
    if (sides.includes('l')) this.fx(wall, x0, y0, y1, z - d, z, 1);
    if (sides.includes('r')) this.fx(wall, x1, y0, y1, z - d, z, -1);
    if (sides.includes('d')) this.fy(wall, y0, x0, x1, z - d, z, 1);
    if (sides.includes('t')) this.fy(wall, y1, x0, x1, z - d, z, -1);
    if (panel) this.fz(panel, x0, x1, y0, y1, z - d, uv);
  }
  /** 起鼓的心板（裙板/绦环板）：外缘在 z，内框 inset e 处升高 rz；UV 0..1 */
  raised(mat, x0, x1, y0, y1, z, e, rz) {
    const W = x1 - x0, H = y1 - y0, uv = (p) => [(p[0] - x0) / W, (p[1] - y0) / H];
    const a = [x0, y0, z], b = [x1, y0, z], c = [x1, y1, z], d = [x0, y1, z];
    const A = [x0 + e, y0 + e, z + rz], B = [x1 - e, y0 + e, z + rz], C = [x1 - e, y1 - e, z + rz], D = [x0 + e, y1 - e, z + rz];
    for (const P of [[a, b, B, A], [b, c, C, B], [c, d, D, C], [d, a, A, D], [A, B, C, D]]) this.quad(mat, P, P.map(uv));
  }
  /** 六角柱（轴沿 Z，自 z0 伸至 z1，平顶平底），前端面贴 faceMat */
  hexPrism(side, face, cx, cy, z0, z1, R) {
    const v = Array.from({ length: 6 }, (_, i) => [cx + R * Math.cos((i * TAU) / 6), cy + R * Math.sin((i * TAU) / 6)]);
    for (let i = 0; i < 6; i++) {
      const p = v[i], q = v[(i + 1) % 6];
      this.quad(side, [[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], z1], [p[0], p[1], z1]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    const uv = (p) => [0.5 + (p[0] - cx) / (2 * R), 0.5 + (p[1] - cy) / (2 * R)];
    for (const [i, j, k, l] of [[0, 1, 2, 3], [0, 3, 4, 5]]) this.quad(face, [v[i], v[j], v[k], v[l]].map((p) => [p[0], p[1], z1]), [v[i], v[j], v[k], v[l]].map(uv));
  }
  flush(ctx) {
    for (const [mat, l] of this.m) if (l.p.length) ctx.add(mat, fromArrays(l.p, l.u, l.n));
    this.m.clear();
  }
}

// ============ 尺寸 ============
/** 槛框尺寸（按柱径 D 推算；D 缺省 ≈ h/9.5）。同一 h 的各间尺寸一致，门窗自然对齐 */
function frameDims(o) {
  const { h } = o;
  const D = o.colD ?? clamp(h * 0.105, 0.22, 0.85);
  const F = {
    D,
    xk: clamp(D * 0.6, 0.12, 0.48), // 下槛高
    zk: clamp(D * 0.5, 0.1, 0.38), // 中槛高
    sk: clamp(D * 0.42, 0.09, 0.32), // 上槛高
    bk: clamp(D * 0.46, 0.09, 0.34), // 抱框宽
    dep: clamp(D * 0.32, 0.09, 0.26), // 槛框厚
  };
  F.transom = o.transom ?? (o.type !== 'gate' && h > 4);
  F.hp = F.transom ? clamp(h * 0.16, 0.45, 1.6) : 0; // 横披净高
  F.yz0 = F.transom ? h - F.sk - F.hp - F.zk : h - F.sk; // 扇顶 = 中槛底
  return F;
}

/**
 * 一扇隔扇自下而上的分段（以扇底为 0）。按“上六下四”：中绦环以下（含）占 0.4H。
 * k: 'rail' 抹头 | 'tao' 绦环板 | 'qun' 裙板 | 'lat' 隔心
 */
function leafLayout(H, W, t, mo) {
  mo = mo ?? (H > 3.3 ? 6 : H > 2.3 ? 5 : H > 1.5 ? 4 : 3);
  const g = clamp((W - 2 * t) * 0.24, 0.07, 0.3);
  const low = 0.4 * H;
  let seq;
  if (mo >= 6) seq = ['rail', ['tao', g], 'rail', ['qun', low - 4 * t - 2 * g], 'rail', ['tao', g], 'rail', ['lat', 0.6 * H - 2 * t - g], 'rail', ['tao', g], 'rail'];
  else if (mo === 5) seq = ['rail', ['tao', g], 'rail', ['qun', low - 4 * t - 2 * g], 'rail', ['tao', g], 'rail', ['lat', 0.6 * H - t], 'rail'];
  else if (mo === 4) seq = ['rail', ['qun', low - 3 * t - g], 'rail', ['tao', g], 'rail', ['lat', 0.6 * H - t], 'rail'];
  else seq = ['rail', ['qun', low - 2 * t], 'rail', ['lat', 0.6 * H - t], 'rail'];
  const out = [];
  let y = 0;
  for (const s of seq) {
    const [k, hh] = s === 'rail' ? ['rail', t] : s;
    out.push({ k, y0: y, y1: y + Math.max(0.02, hh) });
    y += Math.max(0.02, hh);
  }
  const f = H / y; // 数值收口
  for (const s of out) { s.y0 *= f; s.y1 *= f; }
  return out;
}

const shift = (segs, dy) => segs.map((s) => ({ k: s.k, y0: s.y0 + dy, y1: s.y1 + dy }));

/** 槛窗扇分段：沿用同高隔扇的上部（隔心及以上），下部按可用高度补抹头/绦环板 */
function windowSegs(door, y0, t) {
  const iq = door.findIndex((s) => s.k === 'qun');
  const il = door.findIndex((s) => s.k === 'lat');
  // 刚好对齐裙板上抹头：直接截取
  if (iq >= 0 && Math.abs(door[iq + 1].y0 - y0) < 1e-4) return door.slice(iq + 1);
  const up = door.slice(il).map((s) => ({ ...s }));
  const yl = up[0].y0, room = yl - y0;
  let low;
  if (room >= 2 * t + 0.08) low = [{ k: 'rail', y0, y1: y0 + t }, { k: 'tao', y0: y0 + t, y1: yl - t }, { k: 'rail', y0: yl - t, y1: yl }];
  else if (room >= t * 0.8) low = [{ k: 'rail', y0, y1: yl }];
  else { low = [{ k: 'rail', y0, y1: y0 + t }]; up[0].y0 = y0 + t; }
  return [...low, ...up];
}

const leafCount = (o, W) => o.leaves || (W / 4 > 1.6 ? 6 : W / 4 < 0.5 ? 2 : 4);

// ============ 构件 ============
/** 一扇（隔扇/槛窗扇）：x0..x1，segs 已为绝对 y；z 扇面 */
function leaf(A, x0, x1, segs, z, o) {
  const { t, fr, lat, panel, detail } = o;
  const yb = segs[0].y0, yt = segs[segs.length - 1].y1;
  A.fz(fr, x0, x0 + t, yb, yt, z);
  A.fz(fr, x1 - t, x1, yb, yt, z);
  const a = x0 + t, b = x1 - t;
  const dLat = detail >= 1 ? 0.03 : 0.015, dPan = detail >= 1 ? 0.016 : 0.01;
  const sides = detail >= 1 ? 'lrdt' : '';
  for (const s of segs) {
    if (s.k === 'rail') A.fz(fr, a, b, s.y0, s.y1, z);
    else if (s.k === 'lat') A.pocket(fr, a, b, s.y0, s.y1, z, dLat, lat.mat, latUV(lat, a, b, s.y0, s.y1), sides);
    else {
      A.pocket(fr, a, b, s.y0, s.y1, z, dPan, null, null, sides);
      if (detail >= 2) A.raised(panel, a, b, s.y0, s.y1, z - dPan, Math.min(b - a, s.y1 - s.y0) * 0.13, 0.009);
      else A.fz(panel, a, b, s.y0, s.y1, z - dPan, [0, 1, 0, 1]);
    }
  }
  if (detail >= 2) {
    // 面叶：抹头与边梃交接处的鎏金铜饰（拐角叶/看叶）
    const pz = z + 0.005, m = t * 0.16, ext = t * 0.42;
    for (const s of segs) {
      if (s.k !== 'rail') continue;
      for (const r of [0, 1]) {
        const sx0 = r ? x1 - t : x0, sx1 = r ? x1 : x0 + t;
        A.fz(GILT, sx0 + m, sx1 - m, Math.max(yb + m, s.y0 - ext), Math.min(yt - m, s.y1 + ext), pz);
        const rx0 = r ? b - ext * 0.9 : a, rx1 = r ? b : a + ext * 0.9;
        A.fz(GILT, rx0, rx1, s.y0 + m, s.y1 - m, pz);
      }
    }
  }
}

/** 横披窗：xa..xb, y0..y1（中槛上皮至上槛下皮），n 扇，间柱分隔 */
function transom(A, xa, xb, y0, y1, n, o, F) {
  const { fr, latT } = o;
  const jz = F.bk * 0.7, pw = (xb - xa - (n - 1) * jz) / n, zs = -0.025;
  const tt = clamp(Math.min(pw, y1 - y0) * 0.085, 0.035, 0.085);
  for (let i = 0; i < n; i++) {
    const p0 = xa + i * (pw + jz), p1 = p0 + pw;
    if (i > 0) A.fz(fr, p0 - jz, p0, y0, y1, 0);
    A.pocket(fr, p0, p1, y0, y1, 0, -zs);
    A.fz(fr, p0, p1, y0, y0 + tt, zs); A.fz(fr, p0, p1, y1 - tt, y1, zs);
    A.fz(fr, p0, p0 + tt, y0 + tt, y1 - tt, zs); A.fz(fr, p1 - tt, p1, y0 + tt, y1 - tt, zs);
    A.pocket(fr, p0 + tt, p1 - tt, y0 + tt, y1 - tt, zs, 0.025, latT.mat, latUV(latT, p0 + tt, p1 - tt, y0 + tt, y1 - tt));
  }
}

/** 槛墙 + 榻板。返回榻板顶高 */
function sillWall(A, o, F, sill) {
  const { w } = o;
  const sm = o.sillMat || 'wall_red';
  const zf = 0.06, zb = -F.dep - 0.04, tb = 0.085;
  if (sm === 'liuli') {
    // 琉璃槛墙：黄琉璃边框、绿琉璃心、中心盒子与四岔角
    const bw = clamp(sill * 0.16, 0.08, 0.16), x0 = -w / 2, x1 = w / 2;
    A.fz('glaze_yellow', x0, x1, 0, bw, zf); A.fz('glaze_yellow', x0, x1, sill - bw, sill, zf);
    A.fz('glaze_yellow', x0, x0 + bw, bw, sill - bw, zf); A.fz('glaze_yellow', x1 - bw, x1, bw, sill - bw, zf);
    const a = x0 + bw, b = x1 - bw, c = bw, d = sill - bw, zc = zf - 0.025;
    A.pocket('glaze_yellow', a, b, c, d, zf, 0.025, 'glaze_green');
    const cx = 0, cy = (c + d) / 2, ry = (d - c) * 0.36, rx = Math.min((b - a) * 0.3, ry * 1.8), zz = zc + 0.012;
    A.quad('glaze_yellow', [[cx, cy - ry, zz], [cx + rx, cy, zz], [cx, cy + ry, zz], [cx - rx, cy, zz]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const k = Math.min(rx, ry) * 0.75;
    for (const [px, py, sx, sy] of [[a, c, 1, 1], [b, c, -1, 1], [b, d, -1, -1], [a, d, 1, -1]]) {
      const P = [[px, py, zz], [px + sx * k, py, zz], [px, py + sy * k, zz]];
      if (sx * sy < 0) P.reverse();
      A.quad('glaze_yellow', [P[0], P[1], P[2], P[2]], [[0, 0], [1, 0], [0, 1], [0, 1]]);
    }
    A.fz('glaze_yellow', x0, x1, 0, sill, zb, null, -1);
  } else A.box(sm, -w / 2, w / 2, 0, sill, zb, zf, 'fb');
  A.box(o.fr, -w / 2, w / 2, sill, sill + tb, zb - 0.03, zf + 0.035, 'fbtd');
  return sill + tb;
}

/** 隔扇门 / 槛窗 / 支摘窗 */
function doorWindow(A, ctx, o, F) {
  const { w, h, type, fr, detail } = o;
  const zb = -F.dep, zl = -0.03;
  const xa = -w / 2 + F.bk, xb = w / 2 - F.bk, W = xb - xa;
  const n = leafCount(o, W), lw = W / n;
  const t = clamp(lw * 0.1, 0.045, 0.13);
  const doorSegs = shift(leafLayout(F.yz0 - F.xk, lw, t, o.mo), F.xk);
  let y0, yBack = 0; // 扇底（开口下皮）、背板下皮
  if (type === 'door') {
    A.box(fr, -w / 2, w / 2, 0, F.xk, zb, 0.015, 'ft'); // 下槛
    y0 = F.xk;
  } else {
    // 槛墙高：缺省使槛窗下皮对齐隔扇裙板上抹头
    const tb = 0.085, fk = clamp(F.xk * 0.55, 0.07, 0.22);
    const iq = doorSegs.findIndex((s) => s.k === 'qun');
    const auto = iq >= 0 ? doorSegs[iq + 1].y0 - tb - fk : 0.9;
    const sill = typeof o.sill === 'number' ? o.sill : clamp(auto, 0.55, 1.6);
    const ys = sillWall(A, o, F, sill);
    A.fz(fr, -w / 2, w / 2, ys, ys + fk, 0); // 风槛
    y0 = ys + fk; yBack = ys;
  }
  // 抱框（下段）
  A.fz(fr, -w / 2, xa, y0, F.yz0, 0); A.fz(fr, xb, w / 2, y0, F.yz0, 0);
  A.pocket(fr, xa, xb, y0, F.yz0, 0, -zl, null, null, type === 'door' ? 'lrt' : 'lrdt');
  // 中槛 / 上槛 / 横披
  if (F.transom) {
    A.fz(fr, -w / 2, w / 2, F.yz0, F.yz0 + F.zk, 0);
    const ty0 = F.yz0 + F.zk, ty1 = h - F.sk;
    A.fz(fr, -w / 2, xa, ty0, ty1, 0); A.fz(fr, xb, w / 2, ty0, ty1, 0);
    transom(A, xa, xb, ty0, ty1, o.transomN ?? Math.max(1, Math.min(n - 1, Math.round(W / 1.2))), o, F);
  }
  A.fz(fr, -w / 2, w / 2, h - F.sk, h, 0);
  A.fz('wood_dark', xa, xb, y0, F.yz0, zl - 0.04); // 扇缝后衬
  A.fz(fr, -w / 2, w / 2, yBack, h, zb, null, -1); // 背面
  if (o.zan) zan(A, o.zan, xa, xb, F.transom ? F.yz0 + F.zk / 2 : h - F.sk / 2, F.transom ? F.zk : F.sk);

  if (type === 'zhizhai') return zhizhai(A, ctx, o, F, xa, xb, y0, zl);
  const segs = type === 'door' ? doorSegs : windowSegs(doorSegs, y0, t);
  const gap = 0.005;
  for (let i = 0; i < n; i++) {
    const x0 = xa + i * lw + (i > 0 ? gap / 2 : 0), x1 = xa + (i + 1) * lw - (i < n - 1 ? gap / 2 : 0);
    leaf(A, x0, x1, segs, zl, { t, fr, lat: o.lat, panel: o.panel, detail });
  }
  return { y0, yz0: F.yz0 };
}

/** 支摘窗：每组上支（可支起）下摘，步步锦/灯笼框 */
function zhizhai(A, ctx, o, F, xa, xb, y0, zl) {
  const { fr } = o;
  const y1 = F.yz0, W = xb - xa;
  const groups = o.groups ?? (W > 2.4 ? 2 : 1);
  const jz = F.bk * 0.8, gw = (W - (groups - 1) * jz) / groups;
  const mr = clamp(F.bk * 0.6, 0.06, 0.14), ym = y0 + (y1 - y0) * 0.5;
  const ts = clamp(gw * 0.05, 0.035, 0.07), zs = zl;
  const sash = (B, x0, x1, ya, yb, z, back) => {
    B.fz(fr, x0, x1, ya, ya + ts, z); B.fz(fr, x0, x1, yb - ts, yb, z);
    B.fz(fr, x0, x0 + ts, ya + ts, yb - ts, z); B.fz(fr, x1 - ts, x1, ya + ts, yb - ts, z);
    B.pocket(fr, x0 + ts, x1 - ts, ya + ts, yb - ts, z, 0.02, o.lat.mat, latUV(o.lat, x0 + ts, x1 - ts, ya + ts, yb - ts));
    if (back) { B.fz(fr, x0, x1, ya, yb, z - 0.04, null, -1); B.box(fr, x0, x1, ya, yb, z - 0.04, z, 'lrd'); }
  };
  for (let g = 0; g < groups; g++) {
    const x0 = xa + g * (gw + jz), x1 = x0 + gw;
    if (g > 0) A.fz(fr, x0 - jz, x0, y0, y1, 0);
    A.fz(fr, x0, x1, ym - mr / 2, ym + mr / 2, 0); // 腰枋
    A.pocket(fr, x0, x1, ym + mr / 2, y1, 0, -zl, null, null, 'd');
    A.pocket(fr, x0, x1, y0, ym - mr / 2, 0, -zl, null, null, 't');
    if (g > 0) { A.fx(fr, x0, y0, y1, zl, 0, 1); }
    if (g < groups - 1) { A.fx(fr, x1, y0, y1, zl, 0, -1); }
    sash(A, x0, x1, y0, ym - mr / 2, zs);
    const prop = Array.isArray(o.prop) ? o.prop[g] : o.prop;
    if (prop) {
      // 支窗支起：绕上边转出，下设支杆
      const B = new Acc(), Ls = y1 - (ym + mr / 2);
      sash(B, x0, x1, -Ls, 0, 0, true);
      B.flush(ctx.at(0, y1, zs).rot(-prop, 0, 0));
      const bx = (x0 + x1) / 2, by = y1 - Ls * Math.cos(prop), bz = zs + Ls * Math.sin(prop) - 0.03;
      const sy = ym + mr / 2, sz = zs + 0.02, len = Math.hypot(by - sy, bz - sz);
      const R = new Acc();
      R.box(fr, -0.014, 0.014, 0, len, -0.014, 0.014, 'fblr');
      R.flush(ctx.at(bx, sy, sz).rot(Math.atan2(bz - sz, by - sy), 0, 0));
    } else sash(A, x0, x1, ym + mr / 2, y1, zs);
  }
  return { y0, yz0: y1 };
}

/** 门簪：中槛正面 count 个六角门簪 */
function zan(A, count, xa, xb, yc, zk, z0 = 0) {
  const R = zk * 0.56, len = zk * 1.0, ow = xb - xa;
  for (let i = 0; i < count; i++) A.hexPrism(RED, 'op_zan', xa + ((i + 0.5) / count) * ow, yc, z0, z0 + len, R);
}

/** 板门（实榻大门）：门槛、门枕石、抱框、门框、余塞板、中槛（门簪）、走马板、两扇门（门钉、铺首、包叶） */
function gate(A, ctx, o, F) {
  const { w, h, fr, detail } = o;
  const D = F.D;
  const dep = clamp(D * 0.42, 0.14, 0.34), zb = -dep;
  const thr = o.threshold ?? clamp(D * 0.75, 0.2, 0.6);
  const bk = F.bk, mk = bk * 0.8, sk = F.sk;
  const zk = clamp(D * 0.6, 0.14, 0.48);
  const ys = clamp(w * 0.035, 0.08, 0.4);
  const xo = Math.min(o.openW ? o.openW / 2 : Infinity, w / 2 - bk - ys - mk); // 门口半宽
  const top = F.transom ? clamp(h * 0.16, 0.45, 1.6) : clamp(h * 0.15, 0.4, 2.2);
  const yz0 = h - sk - top - zk;
  // 门槛（前后皆见）
  A.box(fr, -w / 2, w / 2, 0, thr, zb - 0.02, 0.02, 'fbt');
  // 抱框、门框、余塞板
  for (const s of [-1, 1]) {
    const xi = s * (w / 2 - bk), xm = s * xo;
    const [a0, a1] = s < 0 ? [-w / 2, xi] : [xi, w / 2];
    A.box(fr, a0, a1, thr, yz0, zb, 0, 'fb');
    const [m0, m1] = s < 0 ? [xm - mk, xm] : [xm, xm + mk];
    A.box(fr, m0, m1, thr, yz0, zb, 0, s < 0 ? 'fbr' : 'fbl');
    const [y0b, y1b] = s < 0 ? [a1, m0] : [m1, a0];
    A.pocket(fr, y0b, y1b, thr, yz0, 0, 0.04, 'board_red', null, 'lr');
    A.fx(fr, y0b, thr, yz0, zb, zb + 0.04, 1); A.fx(fr, y1b, thr, yz0, zb, zb + 0.04, -1);
    A.fz('board_red', y0b, y1b, thr, yz0, zb + 0.04, null, -1);
  }
  // 中槛（门簪）、走马板/横披、上槛
  A.box(fr, -w / 2, w / 2, yz0, yz0 + zk, zb, 0, 'fbd');
  const n = o.zan ?? 4;
  if (n) zan(A, n, -xo, xo, yz0 + zk / 2, zk);
  const ty0 = yz0 + zk, ty1 = h - sk, xa = -w / 2 + bk, xb = w / 2 - bk;
  A.fz(fr, -w / 2, xa, ty0, ty1, 0); A.fz(fr, xb, w / 2, ty0, ty1, 0);
  if (F.transom) transom(A, xa, xb, ty0, ty1, 3, o, F);
  else A.pocket(fr, xa, xb, ty0, ty1, 0, 0.04, 'board_red');
  A.fz(fr, -w / 2, w / 2, ty0, ty1, zb, null, -1);
  A.box(fr, -w / 2, w / 2, h - sk, h, zb, 0, 'fb');
  // 门枕石
  const sh = thr * 0.82, sw = mk + 0.12, sf = clamp(D * 0.75, 0.3, 0.6);
  for (const s of [-1, 1]) {
    const cx = s * (xo + mk / 2);
    A.capBox('stone_grey', cx - sw / 2, cx + sw / 2, 0, sh, zb - sf * 0.8, sf, Math.min(0.05, sh * 0.15));
  }
  // 门扇
  const zL = -Math.min(0.08, dep * 0.3), tk = Math.min(0.14, dep * 0.45);
  const y0 = thr, y1 = yz0, lh = y1 - y0, lw = xo;
  const N = o.studs ?? 9;
  const gm = o.gateMat || (N === 9 ? 'gate_door' : RED);
  const lay = GATE_TEX[gm] || { cols: N, rows: N };
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -xo : 0.004, x1 = s < 0 ? -0.004 : xo;
    A.fz(gm, x0, x1, y0, y1, zL, s < 0 ? [0, 1, 0, 1] : [1, 0, 0, 1]);
    A.fz(RED, x0, x1, y0, y1, zL - tk, null, -1);
    A.fx(fr, s < 0 ? x1 : x0, y0, y1, zL - tk, zL, s < 0 ? 1 : -1);
    // 背面穿带
    for (let k = 0; k < 5; k++) { const yy = y0 + lh * (0.1 + 0.2 * k); A.box(fr, x0 + 0.04, x1 - 0.04, yy - 0.05, yy + 0.05, zL - tk - 0.035, zL - tk, 'btd'); }
    // 包叶
    const bh = lh * 0.032;
    if (detail >= 2) { A.fz(GILT, x0 + 0.01, x1 - 0.01, y0 + 0.02, y0 + 0.02 + bh, zL + 0.006); A.fz(GILT, x0 + 0.01, x1 - 0.01, y1 - 0.02 - bh, y1 - 0.02, zL + 0.006); }
    // 铺首、门环、门钉（u 自门边量至门缝，v 自下）
    const X = (u) => s * (xo - u * xo), Y = (v) => y0 + v * lh;
    if (o.pushou !== false) {
      ctx.place('op_pushou', X(0.8), Y(0.453), zL, 0, lw * 0.205);
      ctx.place('op_ring', X(0.8), Y(0.37), zL, 0, lw * 0.07);
    }
    if (lay.cols > 0 && lay.rows > 0 && o.studs3d !== false) {
      const r = Math.min(lw * 0.04, (lh * 0.864) / Math.max(1, lay.rows - 1) * 0.3);
      for (let i = 0; i < lay.cols; i++) for (let j = 0; j < lay.rows; j++) {
        const u = 0.1016 + (i * 0.7969) / Math.max(1, lay.cols - 1), v = 0.932 - (j * 0.8633) / Math.max(1, lay.rows - 1);
        const pu = u * 512, pv = (1 - v) * 1024;
        if (Math.hypot(pu - 410, pv - 560) < 64 || Math.hypot(pu - 410, pv - 645) < 58) continue;
        ctx.place('op_stud', X(u), Y(v), zL, 0, [r, r, r * 0.75]);
      }
    }
  }
  return { y0, yz0 };
}

/** 实墙（红墙/砖墙，可带下碱） */
function wallBay(A, o, F) {
  const { w, h } = o;
  const mat = o.wallMat || 'wall_red';
  const th = o.thick ?? Math.max(F.dep, 0.3);
  const base = o.base ?? (mat === 'brick_grey' ? false : 'brick');
  if (base) {
    const bh = o.baseH ?? clamp(h * 0.28, 0.5, 1.3);
    const bm = base === 'stone' ? 'stone_grey' : base === 'marble' ? 'marble' : 'brick_grey';
    A.box(bm, -w / 2, w / 2, 0, bh, -th - 0.035, 0.035, 'fbt');
    A.box(mat, -w / 2, w / 2, bh, h, -th, 0, 'fb');
  } else A.box(mat, -w / 2, w / 2, 0, h, -th, 0, 'fb');
}

/**
 * 一间的立面装修。
 * opts:
 *   w, h
 *   type:
 *     'door'    隔扇门（leaves 扇数 4/6，缺省按宽自动 2/4/6）
 *     'window'  槛窗（下为槛墙 sill 高，上为窗扇 leaves 扇）
 *     'zhizhai' 支摘窗（民居/宫院配房常用，上支下摘，槛墙）
 *     'wall'    实墙（红墙，wallMat 可改）
 *     'gate'    板门（大门：门钉 studs 路数，铺首）
 *     'open'    空（廊、门洞），什么也不建
 *   leaves: 扇数（默认 door 4，window 4；净宽很宽/很窄时自动 6/2）
 *   sill: 槛墙高（缺省自动：槛窗下皮对齐同高隔扇的裙板上抹头，约 0.8~1.2；传数值则按数值）
 *   sillMat: 槛墙材质（默认 'wall_red'，可 'brick_grey' | 'liuli'（黄琉璃框绿心）| 其它材质 key）
 *   transom: 是否设横披窗（默认 h>4 时 true）
 *   lattice: 隔心样式 'sanjiao'（三交六椀菱花，最高级）| 'shuangjiao'（双交四椀）| 'fangge'（方格）| 'bubujin'（步步锦，园林/住所）
 *            | 'denglong'（灯笼框）；缺省用共享纹理 'lattice_door'（隔扇）/'lattice_window'（窗、横披）
 *   studs: 板门门钉路数（9 = 九路，皇宫正门；0 = 无门钉）
 * 可选（新增）：
 *   colD 柱径（推算槛框尺寸，缺省 ≈ h/9.5）; mo 抹头数 3~6（缺省按扇高）; transomN 横披扇数
 *   zan 门簪数（gate 缺省 4，door 缺省 0）; detail 0/1/2（2 = 面叶、起鼓心板；1 = 无面叶；0 = 槽口不建侧壁）
 *   frameMat 槛框/扇框材质（'wood_red'）; panelMat 裙板/绦环板（'door_panel'）; latticeMat 强制隔心材质
 *   gateMat 板门门扇材质（'gate_door'）; studs3d 实体门钉（默认 true）; pushou 铺首（默认 true）; openW 板门门口净宽; threshold 门槛高
 *   prop 支摘窗支起角（弧度，数或按组数组）; groups 支摘窗分组数
 *   wallMat, base（'brick'|'stone'|'marble'|false 下碱）, baseH, thick（实墙）
 * 返回 { y0 扇底, yz0 中槛底 }（type 'wall'/'open' 返回 undefined）
 */
export function buildBay(ctx, opts) {
  const { type = 'wall' } = opts;
  if (type === 'open') return;
  const F = frameDims(opts);
  const A = new Acc();
  const o = {
    ...opts,
    type,
    fr: opts.frameMat || RED,
    panel: opts.panelMat || 'door_panel',
    detail: opts.detail ?? 2,
  };
  const ls = opts.latScale ?? clamp(opts.h / 4.5, 0.7, 1.35); // 菱花/方格随建筑尺度缩放
  o.lat = latSpec(opts.lattice, type === 'door' ? 'lattice_door' : 'lattice_window', opts.latticeMat, ls);
  o.latT = latSpec(opts.lattice, 'lattice_window', opts.latticeMat, ls);
  if (o.latT.mode === 'rep') o.latT = { ...o.latT, mode: 'one' };
  let res;
  if (type === 'door' || type === 'window' || type === 'zhizhai') res = doorWindow(A, ctx, o, F);
  else if (type === 'gate') res = gate(A, ctx, o, F);
  else wallBay(A, o, F);
  A.flush(ctx);
  return res;
}

/**
 * 倒挂楣子（廊柱间额枋下的透空花格）与坐凳栏杆。局部坐标同上（一间，立面 z=0）。
 * opts: w, h（倒挂楣子底到额枋底的高度位置 = 楣子顶 y），style: 'green'|'red', bench: 是否加坐凳栏杆
 * 可选：drop 楣子高（缺省 ≈0.14h，0.3~0.55）; bracket 花牙子（默认 true）; benchH 坐凳面高（0.5）; benchD 坐凳面宽（0.34）
 */
export function buildCorridorTrim(ctx, opts) {
  const { w, h } = opts;
  const red = opts.style === 'red';
  const A = new Acc();
  const fr = RED, lm = red ? 'op_mz_red' : 'op_mz_green', hm = red ? 'op_hyz_red' : 'op_hyz_green';
  const f = 0.045, d = 0.03;
  const x0 = -w / 2, x1 = w / 2;
  const lattice = (ya, yb) => {
    A.box(fr, x0, x1, ya, ya + f, -d, d, 'fbtd');
    A.box(fr, x0, x0 + f, ya + f, yb, -d, d, 'fbr');
    A.box(fr, x1 - f, x1, ya + f, yb, -d, d, 'fbl');
    A.fz(lm, x0 + f, x1 - f, ya + f, yb, 0, [x0 + f, x1 - f, 0, 1]);
  };
  // 倒挂楣子
  const mz = opts.drop ?? clamp(h * 0.14, 0.3, 0.55), y0 = h - mz;
  A.box(fr, x0, x1, h - f, h, -d, d, 'fbd');
  lattice(y0, h - f);
  if (opts.bracket !== false) {
    const hy = Math.min(0.32, mz * 0.8), hx = hy * 1.25;
    A.fz(hm, x0, x0 + hx, y0 - hy, y0, 0, [0, 1, 0, 1]);
    A.fz(hm, x1 - hx, x1, y0 - hy, y0, 0, [1, 0, 0, 1]);
  }
  // 坐凳栏杆：坐凳面 + 坐凳楣子 + 腿子
  if (opts.bench) {
    const sh = opts.benchH ?? 0.5, st = 0.055, sd = opts.benchD ?? 0.34, by = 0.1;
    A.box(fr, x0, x1, sh - st, sh, -sd / 2, sd / 2, 'fbtd');
    lattice(by, sh - st);
    const nl = Math.max(1, Math.round(w / 1.2));
    for (let i = 0; i <= nl; i++) {
      const x = clamp(x0 + (i / nl) * w, x0 + 0.03, x1 - 0.03);
      A.box(fr, x - 0.03, x + 0.03, 0, by, -d, d, 'fblr');
    }
  }
  A.flush(ctx);
}
