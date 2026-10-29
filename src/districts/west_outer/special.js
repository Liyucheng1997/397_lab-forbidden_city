// 特殊构筑物：宝蕴楼（西洋式库房）、屏风楼（城墙内侧高台楼）、临溪亭池、断虹桥（石狮望柱）
import * as THREE from 'three';
import { buildTower } from '../../core/building.js';
import { buildRoof } from '../../core/roof.js';
import { buildRailing, buildStairs, buildPlatform } from '../../core/platform.js';
import { buildBridge } from '../../core/props.js';
import { buildWaterBank } from '../../core/nature.js';
import { boxGeo, cylGeo, prismGeo, offsetPoly, polyTopGeo } from '../../core/geom.js';
import { hipRoof, boxAt, prism, S, E, N, W } from './lib.js';

// ======================= 宝蕴楼 =======================
const BY = { base: 0.95, f1: 4.4, f2: 4.0 };
/** 一面墙上的窗：沿 u 方向（起点 a，方向 dir），法线 nrm；n 扇，两层 */
function windowsOnFace(ctx, a, dir, nrm, len, opts = {}) {
  const { base, f1, f2 } = BY;
  const sp = opts.spacing ?? 2.9;
  const n = Math.max(1, Math.floor((len - 1.2) / sp));
  const off = (len - (n - 1) * sp) / 2;
  const skip = opts.skip || (() => false);
  const rows = [[base + 0.95, 2.3], [base + f1 + 0.8, 2.15]];
  for (let i = 0; i < n; i++) {
    const u = off + i * sp;
    const x = a[0] + dir[0] * u, z = a[1] + dir[1] * u;
    const rot = Math.atan2(nrm[0], nrm[1]);
    const c = ctx.at(x, 0, z, rot);
    for (const [k, [y0, h]] of rows.entries()) {
      if (skip(u, k)) continue;
      c.add('wo_trim', boxGeo(1.42, h + 0.3, 0.1).translate(0, y0 + h / 2, 0.04));
      c.add('wo_glass', boxGeo(1.06, h, 0.1).translate(0, y0 + h / 2, 0.07));
      c.add('wo_trim', boxGeo(1.0, 0.06, 0.12).translate(0, y0 + h * 0.62, 0.08)); // 中横棂
      c.add('wo_trim', boxGeo(1.7, 0.2, 0.2).translate(0, y0 + h + 0.25, 0.08)); // 窗楣
    }
    // 地下室采光窗
    if (!skip(u, -1)) c.add('wo_glass', boxGeo(0.9, 0.45, 0.1).translate(0, base * 0.42, 0.1));
  }
}
function westernBlock(ctx, [x0, x1, z0, z1], { alongZ, faces = ['N', 'S', 'E', 'W'], skip = {}, rise }) {
  const { base, f1, f2 } = BY;
  const yT = base + f1 + f2;
  boxAt(ctx, 'stone_grey', x0 - 0.12, x1 + 0.12, 0, base, z0 - 0.12, z1 + 0.12);
  boxAt(ctx, 'wall_red', x0, x1, base, yT, z0, z1);
  boxAt(ctx, 'wo_trim', x0 - 0.1, x1 + 0.1, base + f1 - 0.12, base + f1 + 0.16, z0 - 0.1, z1 + 0.1); // 腰线
  boxAt(ctx, 'wo_trim', x0 - 0.06, x1 + 0.06, yT - 0.5, yT - 0.3, z0 - 0.06, z1 + 0.06);
  boxAt(ctx, 'wo_trim', x0 - 0.38, x1 + 0.38, yT - 0.3, yT, z0 - 0.38, z1 + 0.38); // 檐口线脚
  // 墙角隅石（白色）
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) boxAt(ctx, 'wo_trim', x - 0.1, x + 0.1, base, yT - 0.5, z - 0.1, z + 0.1);
  const W0 = x1 - x0, D0 = z1 - z0;
  const R = rise ?? 0.56 * ((alongZ ? W0 : D0) + 0.8);
  hipRoof(ctx, 'wo_slate', (x0 + x1) / 2, (z0 + z1) / 2, W0 + 0.8, D0 + 0.8, yT, R, alongZ);
  const fd = { S: [[x0, z1], [1, 0], [0, 1], W0], N: [[x1, z0], [-1, 0], [0, -1], W0], E: [[x1, z1], [0, -1], [1, 0], D0], W: [[x0, z0], [0, 1], [-1, 0], D0] };
  for (const f of faces) { const [a, dir, nrm, len] = fd[f]; windowsOnFace(ctx, a, dir, nrm, len, { skip: skip[f] }); }
  return yT;
}
/** 两层白色外廊（连接主楼与配楼） */
function whiteGallery(ctx, [x0, x1, z0, z1], openSides) {
  const { base, f1, f2 } = BY;
  const yT = base + f1 + f2;
  boxAt(ctx, 'stone_grey', x0, x1, 0, base, z0, z1);
  boxAt(ctx, 'wo_trim', x0, x1, base + f1 - 0.25, base + f1 + 0.1, z0, z1);
  boxAt(ctx, 'wo_trim', x0 - 0.15, x1 + 0.15, yT - 0.45, yT, z0 - 0.15, z1 + 0.15);
  boxAt(ctx, 'roof_flat_grey', x0, x1, yT, yT + 0.08, z0, z1);
  const cols = [[x0 + 0.25, z0 + 0.25], [x1 - 0.25, z0 + 0.25], [x1 - 0.25, z1 - 0.25], [x0 + 0.25, z1 - 0.25]];
  for (const [x, z] of cols) ctx.add('wo_trim', cylGeo(0.17, 0.19, yT - 0.45 - base, 10).translate(x, base, z));
  // 二层栏杆（白色宝瓶栏杆简化：扶手 + 栏杆柱）
  for (const s of openSides) {
    const [a, b] = { S: [[x0, z1], [x1, z1]], N: [[x0, z0], [x1, z0]], E: [[x1, z0], [x1, z1]], W: [[x0, z0], [x0, z1]] }[s];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
    const y = base + f1 + 0.1;
    const rot = Math.atan2(dx, dz) + Math.PI / 2;
    const c = ctx.at((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, rot);
    c.add('wo_trim', boxGeo(L - 0.5, 0.12, 0.2).translate(0, 0.95, 0));
    c.add('wo_trim', boxGeo(L - 0.5, 0.1, 0.16).translate(0, 0.08, 0));
    const n = Math.floor((L - 0.6) / 0.28);
    for (let i = 0; i <= n; i++) c.add('wo_trim', boxGeo(0.09, 0.8, 0.09).translate(-(L - 0.6) / 2 + (i * (L - 0.6)) / n, 0.5, 0));
  }
}
export const BAOYUN_DESC = '宝蕴楼：1914—1915 年北洋政府古物陈列所在清咸安宫旧址上所建文物库房，紫禁城内唯一的西洋式建筑群。北楼为主、东西两楼为辅，均为二层砖木结构，城砖砌墙、外抹水泥划格刷红浆，白色线脚，窗窄长，屋顶为高耸的四坡式，主楼与配楼间以白色栏杆廊柱的两层外廊相连；前存清代咸安门。2013—2015 年修缮后开放。';
/** 40586549 咸安宫旧址 → 宝蕴楼 */
export function buildBaoyun(ctx, b, api) {
  const main = [-323.6, -277.7, 294.5, 306.5];
  const west = [-323.9, -314.3, 309.6, 325.0];
  const east = [-288.2, -277.9, 311.4, 326.8];
  const midX = (main[0] + main[1]) / 2;
  const yT = westernBlock(ctx, main, { alongZ: false, skip: { S: (u, k) => (k === 0 || k === -1) && Math.abs(main[0] + u - midX) < 2.0, }, rise: 6.4 });
  westernBlock(ctx, west, { alongZ: true, faces: ['S', 'E', 'W'], rise: 5.2 });
  westernBlock(ctx, east, { alongZ: true, faces: ['S', 'E', 'W'], rise: 5.4 });
  whiteGallery(ctx, [-318.9, -314.4, 306.5, 309.6], ['E', 'W']);
  whiteGallery(ctx, [-287.9, -282.4, 306.5, 311.4], ['E', 'W']);
  // 主入口：拱心石门罩 + 台阶
  const zf = main[3];
  boxAt(ctx, 'wo_trim', midX - 1.7, midX + 1.7, BY.base, BY.base + 3.9, zf, zf + 0.18);
  boxAt(ctx, 'wo_door', midX - 1.15, midX + 1.15, BY.base, BY.base + 3.3, zf + 0.12, zf + 0.24);
  boxAt(ctx, 'wo_trim', midX - 2.1, midX + 2.1, BY.base + 3.9, BY.base + 4.25, zf, zf + 0.5);
  for (let i = 0; i < 4; i++) boxAt(ctx, 'stone_grey', midX - 2.2 - i * 0.2, midX + 2.2 + i * 0.2, 0, BY.base - i * 0.24, zf, zf + 0.35 + i * 0.32);
  // 烟囱
  for (const x of [-316, -300.6, -285.5]) boxAt(ctx, 'brick_grey', x - 0.4, x + 0.4, yT + 2.5, yT + 6.2, 299.6, 300.6);
  api.label('宝蕴楼', midX, yT + 8, 303, BAOYUN_DESC);
}

// ======================= 屏风楼 =======================
/**
 * 城墙内侧高台楼（1970 年代所建“屏风楼”，仿古重檐，下为约 10m 高台）。
 * r: 屋檐外轮廓 [x0,x1,z0,z1]；rotY: E（脊沿南北）| S（脊沿东西）
 */
export function screenTower(ctx, r, rotY, { baseH = 10, roof = 'wudian', windows = true } = {}) {
  const [x0, x1, z0, z1] = r;
  const alongZ = rotY === E;
  const eaveW = alongZ ? z1 - z0 : x1 - x0, eaveD = alongZ ? x1 - x0 : z1 - z0;
  const inD = 1.0, inW = 0.4;
  const bx0 = x0 + (alongZ ? inD : inW), bx1 = x1 - (alongZ ? inD : inW), bz0 = z0 + (alongZ ? inW : inD), bz1 = z1 - (alongZ ? inW : inD);
  // 高台：石基 + 红墙 + 砖檐，台顶方砖
  boxAt(ctx, 'stone_grey', bx0 - 0.08, bx1 + 0.08, 0, 0.9, bz0 - 0.08, bz1 + 0.08);
  boxAt(ctx, 'wall_red', bx0, bx1, 0.9, baseH - 0.45, bz0, bz1);
  boxAt(ctx, 'brick_grey', bx0 - 0.12, bx1 + 0.12, baseH - 0.45, baseH, bz0 - 0.12, bz1 + 0.12);
  ctx.add('paving_square', polyTopGeo([[bx0, bz0], [bx1, bz0], [bx1, bz1], [bx0, bz1]], baseH + 0.005));
  // 正面（东/南）两排窗
  if (windows) {
    const len = alongZ ? bz1 - bz0 : bx1 - bx0, n = Math.floor(len / 4.4);
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i + 0.5) * (len / n);
      for (const y of [2.4, 6.2]) {
        const c = alongZ ? ctx.at(bx1, y, (bz0 + bz1) / 2 + u, E) : ctx.at((bx0 + bx1) / 2 + u, y, bz1, S);
        c.add('stone_grey', boxGeo(1.6, 0.12, 0.2).translate(0, -0.06, 0.05));
        c.add('wo_glass', boxGeo(1.3, 1.9, 0.08).translate(0, 0.95, 0.02));
      }
    }
  }
  const info = buildTower(ctx.at((x0 + x1) / 2, baseH, (z0 + z1) / 2, rotY), {
    eaveW, eaveD, grade: 4, dougong: false, caihua: 'xuanzi', tile: 'yellow', platform: false,
    stories: [{ colH: 3.7 }, { colH: 3.3, inset: 0 }], roof: { type: roof, beasts: 3 },
  });
  return baseH + info.topY;
}
/** 屏风楼端部登台楼梯间 */
export function stairHouse(ctx, x, z, w, d, h = 9.6) {
  boxAt(ctx, 'stone_grey', x - w / 2 - 0.06, x + w / 2 + 0.06, 0, 0.6, z - d / 2 - 0.06, z + d / 2 + 0.06);
  boxAt(ctx, 'wall_red', x - w / 2, x + w / 2, 0.6, h - 1.6, z - d / 2, z + d / 2);
  buildRoof(ctx.at(x, h - 1.6, z), { type: 'yingshan', w: w + 0.5, d: d + 0.5, y: 0, rise: 1.2, tile: 'yellow', gableWallMat: 'wall_red', beasts: -1, overhang: 0.3 });
  boxAt(ctx, 'wo_door', x - 0.7, x + 0.7, 0.6, 2.9, z + d / 2, z + d / 2 + 0.05);
}

// ======================= 临溪亭及水池 =======================
export const LINXI = { x: -258.8, z: 45.0 };
export const LINXI_POND = [[-272.6, 42.2], [-245.0, 42.2], [-245.0, 47.8], [-272.6, 47.8]];
export const LINXI_DESC = '临溪亭：明万历六年（1578）建，原名临溪馆，清改今名。平面方形，面阔、进深各三间，四角攒尖顶，黄琉璃瓦绿剪边；亭坐落于东西向窄长矩形水池中央的单孔砖石券桥上，池周绕以汉白玉栏杆。';
/** 水池（高于地面的石砌池壁，池周栏杆）+ 亭下单孔券桥 */
export function buildLinxiPond(ctx, api) {
  const { x, z } = LINXI;
  const wy = 0.08, top = 0.62;
  api.addWater(LINXI_POND, wy);
  buildWaterBank(ctx, { poly: LINXI_POND, y: wy, style: 'stone', height: top - wy, depth: 0.2, width: 0.5, capMat: 'marble' });
  ctx.add('stone_grey', prismGeo(offsetPoly(LINXI_POND, 0.5), 0, top, { top: false }));
  // 亭下券桥：南北向跨池，宽 7.4m，券洞东西贯通
  const hw = 3.7, span = 5.6, fl = 0.95;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -0.2); shape.lineTo(-span / 2, -0.2); shape.lineTo(-span / 2, wy + 0.1);
  const ar = 0.62, R = (span * span / 4 + ar * ar) / (2 * ar), th = Math.acos(span / 2 / R); // 弧券
  shape.absarc(0, wy + 0.1 + ar - R, R, Math.PI - th, th, true);
  shape.lineTo(span / 2, -0.2); shape.lineTo(hw, -0.2); shape.lineTo(hw, fl); shape.lineTo(-hw, fl); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 7.4, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -3.7); g.rotateY(Math.PI / 2);
  ctx.at(x, 0, z).add('marble_block', g);
  // 亭下踏跺（南北）
  for (const s of [1, -1]) buildStairs(ctx.at(x, 0, z + s * hw, s > 0 ? S : N), { w: 3.0, h: fl, run: 1.9, style: 'marble' });
  // 池周汉白玉栏杆（亭两侧断开）
  buildRailing(ctx, {
    path: offsetPoly(LINXI_POND, 0.22), closed: true, y: top + 0.16, style: 'marble', height: 1.0,
    gaps: [{ at: [x, 42.0], w: 7.6, end: 'drum' }, { at: [x, 48.0], w: 7.6, end: 'drum' }],
  });
  return fl;
}
export function linxiPavilion() {
  return {
    kind: 'pavilion', x: LINXI.x, z: LINXI.z, rotY: S, y0: 0.95, eaveW: 8.6, eaveD: 8.6, nBays: 3, nDepth: 3, grade: 4,
    dougong: { kou: 0.05, cai: 1 }, caihua: 'xuanzi', colH: 3.3, tile: 'yellow', platform: false,
    roof: { type: 'cuanjian', sides: 4, ridgeColor: 'green', baoding: 'tiered', beasts: 1 },
  };
}

// ======================= 断虹桥 =======================
export const DUANHONG = { x: -154.0, z: 323.3, L: 18.7, W: 9.2, H: 2.0 };
export const DUANHONG_DESC = '断虹桥：横跨内金水河的南北向单孔汉白玉石拱桥，全长 18.7m、最宽 9.2m，相传建于元代（一说明初）。桥面铺汉白玉巨石，栏板雕穿花龙纹，望柱头雕神态各异的石狮，是紫禁城内年代最早、雕刻最精美的石桥之一。';
export function buildDuanhong(ctx, api) {
  const { x, z, L, W, H } = DUANHONG;
  buildBridge(ctx.at(x, 0, z, S), { length: L, width: W, archH: H, waterY: api.waterY, style: 'marble', postSpacing: 1.6 });
  // 复算望柱位置（与 buildBridge 一致），柱头上置石狮
  const hl = L / 2, n = Math.max(24, Math.ceil(L / 0.5));
  const yd = (q) => H * (0.5 + 0.5 * Math.cos(Math.PI * Math.max(-1, Math.min(1, q / hl))));
  const zs = [], s = [0];
  for (let i = 0; i <= n; i++) zs.push(-hl + (L * i) / n);
  for (let i = 1; i < zs.length; i++) s.push(s[i - 1] + Math.hypot(zs[i] - zs[i - 1], yd(zs[i]) - yd(zs[i - 1])));
  const sAt = (q) => { const f = ((q + hl) / L) * n, i = Math.max(0, Math.min(n - 1, Math.floor(f))); return s[i] + (s[i + 1] - s[i]) * (f - i); };
  const zAt = (v) => { let i = 0; while (i < n - 1 && s[i + 1] < v) i++; return zs[i] + ((v - s[i]) / (s[i + 1] - s[i] || 1)) * (zs[i + 1] - zs[i]); };
  const sa = sAt(-hl + 1.0), sb = sAt(hl - 1.0), np = Math.max(1, Math.round((sb - sa) / 1.6));
  const xr = W / 2 - 0.15 - 0.02;
  let k = 0;
  for (const sx of [-1, 1]) for (let i = 0; i <= np; i++) {
    const q = zAt(sa + ((sb - sa) * i) / np);
    const rot = (sx > 0 ? W : E) + (((k * 0.618) % 1) - 0.5) * 1.3;
    ctx.place(`wo_slion:${k % 3}`, x + sx * xr, yd(q) + 0.14 + 1.33, z + q, rot, 0.46);
    k++;
  }
  api.label('断虹桥', x, H + 4, z, DUANHONG_DESC);
}

/** 小型石平桥（内金水河窄渠上的便桥） */
export function smallBridge(ctx, api, x, z, rotY, length = 7, width = 3) {
  buildBridge(ctx.at(x, 0, z, rotY), { length, width, archH: 0.45, waterY: api.waterY, style: 'stone', span: 3.6 });
}

export { buildPlatform };
