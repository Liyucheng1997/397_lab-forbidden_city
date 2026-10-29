// 武英殿建筑群：工字形台基（武英殿 + 穿廊 + 敬思殿）、月台、带栏杆的甬路、浴德堂浴室穹顶、武英门前金水桥
import * as THREE from 'three';
import { buildHall } from '../../core/building.js';
import { buildPlatform, buildRailing, buildStairs } from '../../core/platform.js';
import { buildBridge } from '../../core/props.js';
import { boxGeo, cylGeo, latheGeo } from '../../core/geom.js';
import { paveStrip, boxAt, S, E, W } from './lib.js';

export const AX = -221; // 武英门—武英殿—敬思殿中轴（OSM 两者中心 -220.9 / -219.5 取中）
const PH = 1.5; // 台基高（武英门、武英殿、敬思殿同坐 1.5m 台基）
// 武英殿：屋檐轮廓 36.6×25.8（中心 z 291.0）；敬思殿 36.6×18.7（中心 z 261.25）
const FRONT = { z: 291.0, w: 36.6, d: 25.8, kou: 0.085, cai: 7 };
const REAR = { z: 261.25, w: 36.6, d: 18.7, kou: 0.075, cai: 5 };
const ovh = (kou, cai) => ((cai - 1) / 2) * 3 * kou + Math.min(2.4, Math.max(0.9, 21 * kou));
export const GATE = { z: 342.0, w: 34.4, d: 16.9 }; // 武英门
const MT = { hw: 12.5, z1: 314.5 }; // 月台：宽 25m，南沿 z 314.5

export const WUYING_DESC = '明初建，明代为皇帝斋居、召见大臣之便殿，崇祯末李自成曾在此登基；清康熙十九年设修书处，“殿本”书籍即刻印于此。面阔五间、进深三间，黄琉璃瓦单檐歇山顶，单翘重昂七踩斗拱，前出月台，与后殿敬思殿以穿廊相连，同坐 1.5m 高工字形台基。';
export const JINGSI_DESC = '武英殿后殿。面阔五间、进深三间，黄琉璃瓦单檐歇山顶，单翘单昂五踩斗拱，进深较前殿略浅；两殿间的三间封闭穿廊为民国时期加建。';

/** 43512262 武英殿、敬思殿（数组覆盖：同坐 1.5m 工字台基，台基等由 buildWuyingBase 建） */
export function wuyingHalls() {
  return [
    {
      x: AX, z: FRONT.z, y0: PH, rotY: S, eaveW: FRONT.w, eaveD: FRONT.d, grade: 2, nBays: 5, nDepth: 3,
      dougong: { kou: FRONT.kou, cai: FRONT.cai }, colH: 7.0, caihua: 'hexi', platform: false, tile: 'yellow',
      roof: { type: 'xieshan', beasts: 7 }, plaque: '武英殿', plaqueCharH: 0.36,
    },
    {
      x: AX, z: REAR.z, y0: PH, rotY: S, eaveW: REAR.w, eaveD: REAR.d, grade: 3, nBays: 5, nDepth: 3,
      dougong: { kou: REAR.kou, cai: REAR.cai }, colH: 6.0, caihua: 'hexi', platform: false, tile: 'yellow',
      roof: { type: 'xieshan', beasts: 5 }, plaque: '敬思殿', plaqueCharH: 0.3,
    },
  ];
}

/** 工字形台基、月台及栏杆、穿廊、带栏杆的甬路 */
export function buildWuyingBase(ctx, api) {
  const fo = ovh(FRONT.kou, FRONT.cai), ro = ovh(REAR.kou, REAR.cai);
  const fColW = FRONT.w - 2 * fo, fColD = FRONT.d - 2 * fo;
  const rColW = REAR.w - 2 * ro, rColD = REAR.d - 2 * ro;
  const fz0 = FRONT.z - fColD / 2, fz1 = FRONT.z + fColD / 2; // 前殿后/前檐柱缝
  const rz0 = REAR.z - rColD / 2, rz1 = REAR.z + rColD / 2;
  const m = 1.5; // 台明出檐柱
  const hw = Math.max(fColW, rColW) / 2 + m;
  const cw = 5.5; // 穿廊台基半宽
  const A = (x, z) => [AX + x, z];
  const poly = [
    A(-hw, rz0 - m), A(hw, rz0 - m), A(hw, rz1 + 1.2), A(cw, rz1 + 1.2), A(cw, fz0 - m), A(hw, fz0 - m), A(hw, fz1 + m),
    A(MT.hw, fz1 + m), A(MT.hw, MT.z1), A(-MT.hw, MT.z1), A(-MT.hw, fz1 + m), A(-hw, fz1 + m), A(-hw, fz0 - m), A(-cw, fz0 - m),
    A(-cw, rz1 + 1.2), A(-hw, rz1 + 1.2),
  ];
  const mtZ = (fz1 + m + MT.z1) / 2;
  buildPlatform(ctx, {
    poly, h: PH, style: 'xumizuo',
    stairs: [
      { at: A(-MT.hw, mtZ), w: 3.4 }, { at: A(MT.hw, mtZ), w: 3.4 }, // 月台东西踏跺
      { at: A(0, rz0 - m), w: 4.6 }, // 敬思殿后踏跺
      { at: A(-hw, FRONT.z - 3), w: 3.2 }, { at: A(hw, FRONT.z - 3), w: 3.2 }, // 前殿山面踏跺
    ],
  });
  // 月台三面汉白玉栏杆（南面正中接甬路，东西有踏跺）
  const ri = 0.3;
  buildRailing(ctx, {
    path: [A(-MT.hw + ri, fz1 + m), A(-MT.hw + ri, MT.z1 - ri), A(MT.hw - ri, MT.z1 - ri), A(MT.hw - ri, fz1 + m)],
    y: PH, style: 'marble', closed: false, ends: 'post',
    gaps: [{ at: A(0, MT.z1 - ri), w: 5.4, end: 'post' }, ...[-1, 1].map((s) => ({ at: A(s * (MT.hw - ri), mtZ), w: 3.4 + 2 * 0.52, end: 'drum' }))],
  });
  // 穿廊（三间封闭廊，卷棚悬山，脊沿南北，两端插入前后殿檐下）
  const L = fz0 - rz1;
  buildHall(ctx.at(AX, PH, (fz0 + rz1) / 2, E), {
    bays: [L / 3, L / 3, L / 3], depthBays: [4.6, 4.6], overhang: 0.9, colH: 4.4, colDia: 0.42, grade: 4, dougong: false,
    caihua: 'hexi', platform: false, front: 'window', back: 'window', sides: 'open',
    roof: { type: 'xuanshan', juan: true, rise: 2.3, tile: 'yellow', beasts: -1 },
  });
  // 甬路：月台南沿至武英门台基北沿，高与台基平，两侧汉白玉栏杆
  const gz0 = GATE.z - gatePlatformD() / 2;
  const ww = 6.0;
  buildPlatform(ctx, { poly: [A(-ww / 2, MT.z1 - 0.6), A(ww / 2, MT.z1 - 0.6), A(ww / 2, gz0 + 0.6), A(-ww / 2, gz0 + 0.6)], h: PH, style: 'xumizuo' });
  for (const s of [-1, 1]) {
    buildRailing(ctx, { path: [A(s * (ww / 2 - ri), MT.z1 - ri), A(s * (ww / 2 - ri), gz0)], y: PH, style: 'marble', closed: false, ends: 'post' });
  }
  paveStrip(ctx, [A(0, MT.z1 - 0.4), A(0, gz0 + 0.4)], 2.2, 0.02, 'paving_imperial', PH);
  api.label('敬思殿', AX, PH + 17, REAR.z, JINGSI_DESC);
}

/** 武英门台基进深（与 buildHall 推导一致：柱网 + 2×台明） */
export function gatePlatformD() {
  const o = ovh(0.075, 3);
  const colD = GATE.d - 2 * o;
  return colD + 2 * Math.min(2.6, Math.max(0.45, o * 0.55));
}

/** 武英门 spec（40542454） */
export function wuyingGate() {
  return {
    kind: 'gate', x: AX, z: GATE.z, rotY: S, eaveW: GATE.w, eaveD: GATE.d, grade: 3, nBays: 5, nDepth: 2, gateDoors: 3,
    dougong: { kou: 0.075, cai: 3 }, caihua: 'hexi', colH: 5.6, tile: 'yellow', double: undefined, corridor: 0,
    platform: {
      h: PH, style: 'xumizuo',
      stairs: [{ side: 'S', w: 5.6 }, { side: 'S', x: -6.6, w: 3.8 }, { side: 'S', x: 6.6, w: 3.8 }, { side: 'N', x: -10, w: 3.0 }, { side: 'N', x: 10, w: 3.0 }],
    },
    roof: { type: 'xieshan', beasts: 5 }, plaque: '武英门', plaqueCharH: 0.3,
    desc: '武英殿正门。面阔五间（30.4m）、进深二间，黄琉璃瓦单檐歇山顶，坐 1.5m 台基；门前内金水河上三座南北向汉白玉石桥并列，门北以带栏杆的甬路直通武英殿月台。',
  };
}

/** 武英门前三座金水桥（OSM 桥路 x≈-229.5/-222.5/-215.5，z 361~377） */
export function wuyingBridges(ctx, api) {
  const zc = 369.3, L = 15.5;
  for (const [x, w, h] of [[-222.5, 5.6, 1.45], [-229.5, 4.2, 1.25], [-215.5, 4.2, 1.25]]) {
    buildBridge(ctx.at(x, 0, zc, S), { length: L, width: w, archH: h, waterY: api.waterY, style: 'marble' });
  }
  // 门前甬路：武英门南踏跺—桥北端；桥南端—西华门大道
  const gz1 = GATE.z + gatePlatformD() / 2 + PH / 0.48;
  paveStrip(ctx, [[AX, gz1 - 0.2], [AX, 357.5], [-222.5, 359], [-222.5, zc - L / 2 + 0.3]], 4.2);
  paveStrip(ctx, [[-229.5, 358], [-215.5, 358]], 2.4);
  for (const x of [-229.5, -215.5]) paveStrip(ctx, [[x, 358], [x, zc - L / 2 + 0.3]], 2.6);
  paveStrip(ctx, [[-222.5, zc + L / 2 - 0.3], [-222.5, 396]], 4.2);
  for (const x of [-229.5, -215.5]) paveStrip(ctx, [[x, zc + L / 2 - 0.3], [x + Math.sign(-222.5 - x) * 1.0, 395.5]], 2.6);
}

/** 浴德堂后室（浴室）：方形砖室，上覆白灰穹隆顶，顶开圆窗（650971293） */
export function buildBath(ctx, b, api) {
  const cx = b.obb.cx + 0.2, cz = b.obb.cz + 0.3; // -250.7, 256.4
  const w = 6.0, d = 6.4, h = 3.9;
  const c = ctx.at(cx, 0, cz);
  c.add('brick_grey', boxGeo(w + 0.3, 0.45, d + 0.3).translate(0, 0.225, 0));
  c.add('wall_red', boxGeo(w, h - 0.45, d).translate(0, 0.45 + (h - 0.45) / 2, 0));
  c.add('brick_grey', boxGeo(w + 0.36, 0.22, d + 0.36).translate(0, h + 0.11, 0));
  c.add('plaster_white', boxGeo(w + 0.1, 0.35, d + 0.1).translate(0, h + 0.395, 0));
  // 穹隆顶（低矮弧顶，白灰抹面），顶部圆窗
  const R = 2.85, y0 = h + 0.57, rise = 2.1, rw = 0.42, ytop = y0 + rise;
  const prof = [];
  for (let i = 0; i <= 10; i++) { const a = ((i / 10) * Math.PI) / 2; prof.push([rw + (R - rw) * Math.cos(a), y0 + rise * Math.sin(a)]); }
  c.add('plaster_white', latheGeo(prof, 20));
  c.add('brick_grey', cylGeo(rw + 0.1, rw + 0.12, 0.25, 12, true).translate(0, ytop - 0.06, 0));
  c.add('pr_dark', new THREE.CircleGeometry(rw + 0.05, 12).rotateX(-Math.PI / 2).translate(0, ytop + 0.1, 0));
  // 南侧接抱厦的门洞
  c.add('wo_door', boxGeo(1.2, 2.2, 0.06).translate(0, 0.45 + 1.1, d / 2 + 0.02));
  api.label('浴德堂浴室', cx, ytop + 1.5, cz, '浴德堂后室，平面方形，砖砌穹隆顶，顶开圆窗采光，室内满贴白色琉璃面砖，具阿拉伯式浴室特征；西北井亭汲水，经墙上铜管引入烧热。');
}

/** 浴德堂后檐西侧抱厦两间，北接浴室 */
export function buildBathPorch(ctx) {
  buildHall(ctx.at(-249.9, 0, 262.5, W), {
    bays: [2.45, 2.45], depthBays: [3.6], overhang: 0.6, colH: 3.0, grade: 5, dougong: false, caihua: 'xuanzi',
    platform: { h: 0.6, style: 'plain', stairs: [] }, front: ['window', 'window'], back: 'wall', sides: 'wall',
    roof: { type: 'xuanshan', juan: true, tile: 'yellow', beasts: -1, rise: 1.2 },
  });
}

/** 井亭内井口 */
export function wellCurb(ctx, x, z, y = 0.5) {
  ctx.add('stone_grey', cylGeo(0.62, 0.68, 0.55, 12).translate(x, y, z));
  ctx.add('pr_dark', new THREE.CircleGeometry(0.4, 10).rotateX(-Math.PI / 2).translate(x, y + 0.56, z));
  boxAt(ctx, 'stone_grey', x - 1.3, x + 1.3, y - 0.02, y + 0.04, z - 1.3, z + 1.3);
}

export { buildStairs };
