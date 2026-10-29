// 紫禁城角楼：“九梁十八柱七十二条脊”。
// 平面：中央 8.8m 见方的方亭，四面各出 5.6m 宽的抱厦（朝城外两面进深 1.6m，朝城内两面进深 4.0m），
//   外轮廓为 20 柱的十字曲尺形（12 阳角 + 8 阴角）。
// 立面：三重檐 —— 下层腰檐沿十字轮廓一周（20 坡面）；中层四面抱厦各为歇山顶（山花朝外）并与方亭腰檐相交成窝角；
//   上层为两个歇山顶十字相交（十字脊），中心鎏金宝顶。合计 28 个翼角。黄琉璃瓦、和玺彩画，汉白玉须弥座台基与栏杆。
// 局部坐标：原点 = 方亭中心、城台顶面（城墙马道面），+X 与 +Z 两面朝城外（浅抱厦），-X/-Z 朝城内（深抱厦、设踏跺）。
import * as THREE from 'three';
import { buildRoof, roofDefaults } from '../../core/roof.js';
import { placeDougong } from '../../core/dougong.js';
import { buildBay } from '../../core/openings.js';
import { buildPlatform } from '../../core/platform.js';
import { pip } from './common.js';

export const CT = {
  C: 4.4, // 方亭半宽
  A: 2.8, // 抱厦半宽
  FO: 1.6, // 朝外抱厦进深
  FI: 4.0, // 朝内抱厦进深
  KOU: 0.065,
  D: 0.4, // 柱径
  PH: 1.2, // 台基高
  H1: 3.6, H2: 6.6, H3: 9.9, // 三层额枋顶（相对台基顶）
  O1: 1.45, R1: 0.78, // 下檐出檐、举高
  O2: 1.4, R2: 0.78, ARM_RISE: 2.25, // 中檐
  O3: 1.85, R3: 3.5, // 上檐十字脊
  PLAT: [-9.3, 6.9], // 台基范围（两向相同）
};

/** 梁枋盒体：前后面 UV 0..1（沿长、自下而上），其余面取箍头色 */
function beamGeo(L, h, t) {
  const g = new THREE.BoxGeometry(L, h, t);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    if (f === 4 || f === 5) { const u0 = uv.getX(i), v0 = uv.getY(i); uv.setXY(i, f === 5 ? 1 - u0 : u0, v0); }
    else uv.setXY(i, 0.015, 0.5);
  }
  return g;
}

/** 两柱间一组额枋（大额枋 + 由额垫板 + 小额枋 + 平板枋），yTop 为大额枋顶 */
function beamSet(ctx, a, b, yTop) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const c = ctx.at((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, -Math.atan2(b[1] - a[1], b[0] - a[0]));
  const g1 = beamGeo(L, 0.34, 0.3); g1.translate(0, yTop - 0.17, 0); c.add('beam_hexi', g1);
  const g2 = new THREE.BoxGeometry(L, 0.16, 0.12); g2.translate(0, yTop - 0.42, 0); c.add('board_red', g2);
  const g3 = beamGeo(L, 0.22, 0.27); g3.translate(0, yTop - 0.61, 0); c.add('beam_hexi', g3);
  const g4 = new THREE.BoxGeometry(L + 0.1, 0.1, 0.36); g4.translate(0, yTop + 0.05, 0); c.add('board_green', g4);
}
const BEAM_DROP = 0.72; // 额枋组总高（门窗上皮 = 额枋顶 - BEAM_DROP）

/** 十字曲尺外轮廓（20 柱） */
function outline() {
  const { C, A, FO, FI } = CT;
  const P = C + FO, N = -(C + FI);
  return [
    [P, -A], [P, A], [C, A], [C, C], [A, C], [A, P], [-A, P], [-A, C], [-C, C], [-C, A],
    [N, A], [N, -A], [-C, -A], [-C, -C], [-A, -C], [-A, N], [A, N], [A, -C], [C, -C], [C, -A],
  ];
}

/** 轮廓各段：{a, b, L, mid, rot（朝外）, kind: 'front'|'side'|'core', outward（朝城外）} */
function segments(V) {
  const { C } = CT;
  const segs = [];
  const eq = (u, v) => Math.abs(u - v) < 1e-6;
  for (let i = 0; i < V.length; i++) {
    const a = V[i], b = V[(i + 1) % V.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    let out = [d[1], -d[0]];
    if (pip(mid[0] + out[0] * 0.2, mid[1] + out[1] * 0.2, V)) out = [-out[0], -out[1]];
    let kind = 'side';
    if ((eq(a[0], b[0]) && Math.abs(a[0]) > C + 0.1) || (eq(a[1], b[1]) && Math.abs(a[1]) > C + 0.1)) kind = 'front';
    else if ((eq(Math.abs(a[0]), C) && eq(Math.abs(b[0]), C)) || (eq(Math.abs(a[1]), C) && eq(Math.abs(b[1]), C))) kind = 'core';
    const outward = mid[0] > C || mid[1] > C;
    segs.push({ a, b, L, mid, rot: Math.atan2(out[0], out[1]), kind, outward });
  }
  return segs;
}

/** 斗拱（placeDougong 包装）；返回顶高 */
function dg(ctx, colsX, colsZ, y, cai, sides, perBay) {
  return placeDougong(ctx, { colsX, colsZ, y, kou: CT.KOU, cai, sides, perBay }).top;
}

/** 四面抱厦 / 方亭一层斗拱；返回斗拱顶 */
function tierDougong(ctx, y) {
  const { C, A, FO, FI } = CT;
  const P = C + FO, N = -(C + FI);
  dg(ctx, [C, P], [-A, A], y, 3, ['E', 'S', 'N']);
  dg(ctx, [N, -C], [-A, A], y, 3, ['W', 'S', 'N']);
  dg(ctx, [-A, A], [C, P], y, 3, ['S', 'E', 'W']);
  dg(ctx, [-A, A], [N, -C], y, 3, ['N', 'E', 'W']);
  return dg(ctx, [-C, -A, A, C], [-C, -A, A, C], y, 3, ['S', 'N', 'E', 'W'], [1, 0, 1]);
}

/** 四面抱厦：dir 方向，F 进深（自方亭面起），rot 使局部 +X 沿抱厦长向朝外 */
const ARMS = [[[1, 0], CT.FO], [[-1, 0], CT.FI], [[0, 1], CT.FO], [[0, -1], CT.FI]].map(([dir, F]) => ({
  dir, F, rot: dir[0] !== 0 ? (dir[0] > 0 ? 0 : Math.PI) : (dir[1] > 0 ? -Math.PI / 2 : Math.PI / 2),
}));
/** 抱厦上沿抱厦长向 [from, to]（距方亭中心）区间的局部坐标系（原点在区间中点） */
const armCtx = (c, a, from, to) => { const m = (from + to) / 2; return c.at(a.dir[0] * m, 0, a.dir[1] * m, a.rot); };

/**
 * 建造一座角楼。ctx：局部坐标（见文件头），y=0 为城台顶面。返回 { top }。
 */
export function buildCornerTower(ctx) {
  const { C, A, D, PH, H1, H2, H3, KOU } = CT;
  // ---- 台基：汉白玉须弥座 + 栏杆，朝城内两面设踏跺 ----
  const [p0, p1] = CT.PLAT;
  buildPlatform(ctx, {
    poly: [[p0, p0], [p1, p0], [p1, p1], [p0, p1]], h: PH, style: 'xumizuo',
    railing: { style: 'marble' },
    stairs: [{ at: [p0 - 1, 0], w: 2.6 }, { at: [0, p0 - 1], w: 2.6 }],
  });
  const c = ctx.at(0, PH, 0);
  const V = outline();
  const S = segments(V);

  // ---- 柱：外轮廓 20 柱（方亭四角与阴角柱通至上层） ----
  for (const p of V) {
    const core = Math.abs(p[0]) <= C + 1e-6 && Math.abs(p[1]) <= C + 1e-6;
    const top = core ? H3 : H2;
    c.place('col:wood_red', p[0], 0, p[1], 0, [D, top, D]);
    c.place('zhuchu', p[0], 0, p[1], 0, [D, D, D]);
  }

  // ---- 一层：外檐装修（朝内抱厦正面隔扇门，其余槛窗/实墙） ----
  for (const s of S) {
    const w = s.L - D * 0.9;
    let type = 'wall';
    if (s.kind === 'front') type = s.outward ? 'window' : 'door';
    else if (s.kind === 'side' && s.L > 3) type = 'window';
    buildBay(c.at(s.mid[0], 0, s.mid[1], s.rot), { w, h: H1 - BEAM_DROP, type, lattice: 'sanjiao', sill: 0.9, colD: D });
  }
  for (const s of S) beamSet(c, s.a, s.b, H1);
  // ---- 下檐：斗拱 + 方亭腰檐 + 四面抱厦腰檐（相交成窝角） ----
  const y1 = tierDougong(c, H1 + 0.1) + KOU * 1.5;
  const wt = 0.3;
  const skirt1 = { type: 'skirt', y: y1, rise: CT.R1, tile: 'yellow', overhang: 0.9, beasts: 3, detail: 2, lift: 0.55, flare: 0.45 };
  buildRoof(c, { ...skirt1, w: 2 * (C + CT.O1), d: 2 * (C + CT.O1), inner: { w: 2 * C + wt, d: 2 * C + wt } });
  for (const a of ARMS) {
    const e = C + a.F, b = C - 1.6; // 抱厦墙体沿长向范围（后端伸入方亭内，隐于墙内）
    buildRoof(armCtx(c, a, b, e), { ...skirt1, w: e - b + 2 * CT.O1, d: 2 * (A + CT.O1), inner: { w: e - b + wt, d: 2 * A + wt } });
  }
  const s1Top = y1 + CT.R1;

  // ---- 二层：抱厦正面窗、其余实墙 ----
  for (const s of S) {
    const w = s.L - D * 0.9, y0 = s1Top - 0.15;
    buildBay(c.at(s.mid[0], y0, s.mid[1], s.rot), { w, h: H2 - BEAM_DROP - y0, type: s.kind === 'front' ? 'window' : 'wall', lattice: 'sanjiao', sill: 0.25, colD: D, base: false });
  }
  for (const s of S) beamSet(c, s.a, s.b, H2);
  // ---- 中檐：方亭腰檐 + 四面抱厦歇山（山花朝外） ----
  const y2 = tierDougong(c, H2 + 0.1) + KOU * 1.5;
  buildRoof(c, { type: 'skirt', y: y2, rise: CT.R2, tile: 'yellow', overhang: 0.9, beasts: 3, detail: 2, lift: 0.55, flare: 0.45, w: 2 * (C + CT.O2), d: 2 * (C + CT.O2), inner: { w: 2 * C + wt, d: 2 * C + wt } });
  for (const a of ARMS) {
    const e = C + a.F + CT.O2, b = C - 3.0; // 前檐口、后端（伸入方亭内）
    buildRoof(armCtx(c, a, b, e), { type: 'xieshan', y: y2, rise: CT.ARM_RISE, tile: 'yellow', overhang: 1.0, gableInset: 1.45, beasts: 3, detail: 2, lift: 0.7, flare: 0.55, w: e - b, d: 2 * (A + CT.O2) });
  }

  // ---- 三层：方亭四面（中间一间为实墙，两侧为窗）+ 额枋 ----
  const sq = [[-C, -C], [-A, -C], [A, -C], [C, -C], [C, -A], [C, A], [C, C], [A, C], [-A, C], [-C, C], [-C, A], [-C, -A]];
  for (let i = 0; i < sq.length; i++) {
    const a = sq[i], b = sq[(i + 1) % sq.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const out = Math.abs(mid[0]) > Math.abs(mid[1]) ? [Math.sign(mid[0]), 0] : [0, Math.sign(mid[1])];
    const y0 = H2 - 0.2;
    buildBay(c.at(mid[0], y0, mid[1], Math.atan2(out[0], out[1])), { w: L - D * 0.9, h: H3 - BEAM_DROP - y0, type: L < 2 ? 'window' : 'wall', lattice: 'sanjiao', sill: 1.6, colD: D, base: false });
    beamSet(c, a, b, H3);
  }
  // ---- 上檐：五踩斗拱 + 十字脊（两歇山十字相交）+ 鎏金宝顶 ----
  const y3 = dg(c, [-C, -A, A, C], [-C, -A, A, C], H3 + 0.1, 5) + KOU * 1.5;
  const W3 = 2 * (C + CT.O3);
  const top = { type: 'xieshan', y: y3, rise: CT.R3, w: W3, d: W3, tile: 'yellow', overhang: CT.O3, gableInset: 2.0, beasts: 5, detail: 3, lift: 1.0, flare: 0.8, liftLen: 3.4 };
  const rA = buildRoof(c, top);
  // 第二个歇山转 90°：整体低 12cm（檐、戗脊、檐下均隐于前者之下），正脊加高 12cm 使两正脊脊顶齐平；无饰件，吻另置
  const dfl = roofDefaults(top), DY = 0.12;
  const topB = { ...top, y: y3 - DY, band: 0, overhang: 0.01, ridgeW: dfl.ridgeW * 0.86, ridgeH: dfl.ridgeH + DY, ornaments: false };
  const cb = c.at(0, 0, 0, Math.PI / 2);
  const rB = buildRoof(cb, topB);
  if (rB.mainRidge && rA.ridgeY) {
    const [a, b] = rB.mainRidge, yw = rA.ridgeY - dfl.ridgeH * 0.1;
    cb.place('wen:yellow@lo', b[0], yw, b[2], 0, dfl.wenH);
    cb.place('wen:yellow@lo', a[0], yw, a[2], Math.PI, dfl.wenH);
  }
  const ridgeY = rA.ridgeY ?? y3 + CT.R3;
  c.place('baoding:gold', 0, ridgeY + dfl.ridgeH * 0.8, 0, 0, 1.25);
  return { top: PH + ridgeY + dfl.ridgeH + 1.25 };
}
