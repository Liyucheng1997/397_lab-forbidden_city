// axis_north · 乾清门 — 后三宫 — 坤宁门（含东西庑、长街门）
import { rhall, autoFix, pedestal, rail, wall, wgate, paveStrip, rectPoly, PI, ROT, buildHall, buildPlatform, buildStairs, buildRoof, boxGeo, cylGeo, prismGeo } from './lib.js';
import { buildScreenWall, buildPalaceWall } from '../../core/walls.js';

export const Y_YUE = 1.8; // 乾清门台基 / 高台甬路 / 乾清宫月台
export const Y_GONG = 3.0; // 后三宫“工”字形台基
const XC = -0.6; // 后三宫轴线（OSM 略偏西）

const lbl = (api, name, x, y, z, desc) => api.label(name, x, y, z, desc);

// ---------------- 乾清门 ----------------
function qianqingmen(ctx, b, api) {
  const x0 = -19.5, x1 = 17.4, z0 = -137.0, z1 = -116.6;
  buildPlatform(ctx, {
    poly: rectPoly(x0, x1, z0, z1), h: Y_YUE, style: 'xumizuo',
    railing: { style: 'marble', gaps: [{ at: [-1.05, z0 + 0.3], w: 9.6, end: 'post' }] },
    stairs: [
      { at: [-1.3, z1 + 5], w: 5.0, yulu: { w: 2.2 }, railings: true, run: 4.2 },
      { at: [-7.7, z1 + 5], w: 2.4, railings: true, run: 4.2 },
      { at: [5.0, z1 + 5], w: 2.4, railings: true, run: 4.2 },
      { at: [-9.6, z0 - 5], w: 2.6, railings: true, run: 4.0 },
      { at: [7.4, z0 - 5], w: 2.6, railings: true, run: 4.0 },
    ],
  });
  const info = rhall(ctx, [-16.7, 15.6, -135.9, -117.7], 'S', {
    kind: 'gate', grade: 2, nBays: 5, nDepth: 3, dougong: { kou: 0.08, cai: 5 }, caihua: 'hexi', colH: 6.2,
    platform: false, gateDoors: 3, plaque: '乾清门', plaqueCharH: 0.55, roof: { type: 'xieshan', beasts: 7 },
  }, Y_YUE);
  lbl(api, '乾清门', -0.55, info.top + 2, -126.8, '内廷正门，明永乐十八年（1420）建，清顺治十二年重建。面阔五间、进深三间，单檐歇山顶，坐落于高约1.5米的汉白玉须弥座上，三出陛；两侧八字琉璃影壁。清代“御门听政”在此举行。');
  // 八字琉璃影壁（西侧沿 OSM 斜墙，东侧对称）
  const u = [0.6, -0.8], c = [-23.25, -116.8];
  const rW = Math.atan2(0.8, 0.6);
  buildScreenWall(ctx.at(c[0], 0, c[1], rW), { w: 9.4, h: 7.4, thick: 1.5, style: 'liuli', roof: 'wudian' });
  buildScreenWall(ctx.at(-2.2 - c[0], 0, c[1], -rW), { w: 9.4, h: 7.4, thick: 1.5, style: 'liuli', roof: 'wudian' });
  void u;
  // 西侧宫墙（原 OSM 墙 638807616 的直段）
  wall(ctx, [[-62.3, -113.6], [-26.3, -113.6]], { h: 6.4, thick: 2.0 });
  // 鎏金铜狮一对（东雄西雌）、鎏金铜缸
  ctx.place('lion:m:gilt', 10.6, 0, -112.4, 0, 3.6);
  ctx.place('lion:f:gilt', -12.8, 0, -112.4, 0, 3.6);
  for (const x of [-32.6, -39.6, 30.4, 37.4]) ctx.place('vat:gilt', x, 0, -110.6, 0, 1.6);
}

// ---------------- 高台甬路 ----------------
function yongdao(ctx) {
  const x0 = -5.6, x1 = 3.5, zS = -137.0, zN = -192.0;
  buildPlatform(ctx, { poly: rectPoly(x0, x1, zN - 0.2, zS + 0.2), h: Y_YUE, style: 'xumizuo' });
  paveStrip(ctx, [[-1.05, zS + 0.2], [-1.05, zN - 0.2]], 3.0, { y: Y_YUE - 0.02, h: 0.05 });
  for (const x of [x0 + 0.3, x1 - 0.3]) rail(ctx, [[x, zS - 0.25], [x, zN + 0.25]], Y_YUE, { ends: 'post' });
}

// ---------------- 乾清宫月台（丹陛）与陈设 ----------------
function yuetai(ctx, b, api) {
  const L = XC - 23.4, R = XC + 23.4, WL = XC - 28.2, WR = XC + 28.2;
  const zS = -192.0, zF = -213.4, zW = -211.9, zB = -220.4;
  const poly = [[L, zS], [R, zS], [R, zW], [WR, zW], [WR, zB], [R, zB], [R, zF], [L, zF], [L, zB], [WL, zB], [WL, zW], [L, zW]];
  buildPlatform(ctx, {
    poly, h: Y_YUE, style: 'xumizuo',
    stairs: [
      { at: [-9.8, zS + 5], w: 3.0, railings: true, run: 4.0 },
      { at: [7.8, zS + 5], w: 3.0, railings: true, run: 4.0 },
      { at: [L - 5, -202.3], w: 3.2, railings: true, run: 4.0 },
      { at: [R + 5, -202.3], w: 3.2, railings: true, run: 4.0 },
    ],
  });
  const ri = 0.3;
  rail(ctx, [[WL + ri, zB + ri], [WL + ri, zW - ri], [L + ri, zW - ri], [L + ri, zS - ri], [R - ri, zS - ri], [R - ri, zW - ri], [WR - ri, zW - ri], [WR - ri, zB + ri]], Y_YUE, {
    style: 'marble', ends: 'post',
    gaps: [{ at: [-1.05, zS - ri], w: 9.6, end: 'post' }, { at: [-9.8, zS - ri], w: 4.4, end: 'post' }, { at: [7.8, zS - ri], w: 4.4, end: 'post' }, { at: [L + ri, -202.3], w: 4.6, end: 'post' }, { at: [R - ri, -202.3], w: 4.6, end: 'post' }],
  });
  // 月台至乾清宫台基的三出踏跺
  for (const [x, w, yl] of [[XC, 5.4, true], [XC - 10.2, 2.8, false], [XC + 10.2, 2.8, false]]) {
    buildStairs(ctx.at(x, Y_YUE, zF, 0), { w, h: Y_GONG - Y_YUE, run: 2.8, style: 'marble', yulu: yl ? { w: 2.4 } : undefined, railings: true });
  }
  paveStrip(ctx, [[-1.05, zS], [XC, zF + 2.8]], 3.0, { y: Y_YUE - 0.02, h: 0.05 });
  // 陈设：东日晷西嘉量，铜龟铜鹤各一对，鎏金香炉，江山社稷金殿
  const y = Y_YUE;
  ctx.place('sundial', XC + 15.5, y, -197.5, 0, 2.6);
  ctx.place('jialiang', XC - 15.5, y, -197.5, 0, 2.6);
  for (const s of [-1, 1]) {
    ctx.place('tortoise', XC + s * 12.5, y, -206.0, 0, 2.2);
    ctx.place('crane', XC + s * 17.5, y, -206.0, 0, 2.6);
    ctx.place('censer:ding', XC + s * 6.2, y, -209.6, 0, 2.0);
    ctx.place('censer:tower', XC + s * 9.2, y, -209.9, 0, 3.0);
    jinDian(ctx, XC + s * 25.8, y, -216.2);
  }
  lbl(api, '江山殿', XC + 25.8, y + 6, -216.2, '乾清宫月台东侧石台上的鎏金铜亭，与西侧“社稷殿”合称“江山社稷金殿”，寓意江山社稷尽在皇帝掌中。');
  lbl(api, '社稷殿', XC - 25.8, y + 6, -216.2, '乾清宫月台西侧石台上的鎏金铜亭（社稷金殿）。');
}

/** 江山社稷金殿：汉白玉须弥座 + 鎏金铜方亭（重檐攒尖） */
function jinDian(ctx, x, y, z) {
  const c = ctx.at(x, y, z);
  pedestal(c, 0, 0, 0, 3.4, 3.4, 1.3);
  const yb = 1.3;
  const g = boxGeo(1.9, 0.18, 1.9); g.translate(0, yb + 0.09, 0);
  c.add('bronze_gilt', g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const col = cylGeo(0.07, 0.07, 1.3, 8); col.translate(sx * 0.7, yb + 0.18 + 0.65, sz * 0.7);
    c.add('bronze_gilt', col);
  }
  const body = boxGeo(1.15, 1.2, 1.15); body.translate(0, yb + 0.18 + 0.6, 0);
  c.add('bronze_gilt', body);
  const r1 = buildRoof(c, { type: 'skirt', w: 2.3, d: 2.3, y: yb + 1.5, rise: 0.25, inner: { w: 1.2, d: 1.2 }, tile: 'gilt', ornaments: false, overhang: 0.4, detail: 1 });
  const ub = boxGeo(1.2, 0.5, 1.2); ub.translate(0, yb + 1.75 + 0.25, 0);
  c.add('bronze_gilt', ub);
  buildRoof(c, { type: 'cuanjian', sides: 4, w: 1.9, y: yb + 2.25, rise: 0.8, tile: 'gilt', ornaments: false, overhang: 0.35, detail: 1 });
  c.place('baoding:gold', 0, yb + 3.0, 0, 0, 0.45);
  void r1;
}

// ---------------- 后三宫“工”字台基、墙、栏杆、踏跺 ----------------
function gongPlatform(ctx, b, api) {
  const poly = [[-46.4, -220.4], [XC - 23.4, -220.4], [XC - 23.4, -213.4], [XC + 23.4, -213.4], [XC + 23.4, -220.4], [46.5, -220.4], [46.5, -249.0], [13.0, -249.0], [13.0, -283.0], [27.2, -283.0], [27.2, -289.8], [46.2, -289.8], [46.2, -311.0], [-46.3, -311.0], [-46.3, -289.8], [-28.1, -289.8], [-28.1, -283.0], [-14.4, -283.0], [-14.4, -249.0], [-46.4, -249.0]];
  buildPlatform(ctx, { poly, h: Y_GONG, style: 'xumizuo' });
  const y = Y_GONG, r = 0.3;
  // 栏杆：乾清宫前沿（月台之上）
  rail(ctx, [[XC - 23.4 + r, -220.1], [XC - 23.4 + r, -213.4 - r], [XC + 23.4 - r, -213.4 - r], [XC + 23.4 - r, -220.1]], y, {
    gaps: [{ at: [XC, -213.7], w: 7.2, end: 'post' }, { at: [XC - 10.2, -213.7], w: 4.4, end: 'post' }, { at: [XC + 10.2, -213.7], w: 4.4, end: 'post' }],
  });
  // 栏杆：工字颈部两侧及南北翼内沿
  rail(ctx, [[-22.3, -249.0 + r], [-14.4 + r, -249.0 + r], [-14.4 + r, -283.0 - r], [-28.1 + r, -283.0 - r], [-28.1 + r, -289.6]], y, { gaps: [{ at: [-14.1, -265.6], w: 5.6, end: 'post' }] });
  rail(ctx, [[23.5, -249.0 + r], [13.0 - r, -249.0 + r], [13.0 - r, -283.0 - r], [27.2 - r, -283.0 - r], [27.2 - r, -289.6]], y, { gaps: [{ at: [12.7, -265.6], w: 5.6, end: 'post' }] });
  // 栏杆：坤宁宫后（北）沿
  rail(ctx, [[-22.6, -311.0 + r], [21.8, -311.0 + r]], y, { gaps: [{ at: [-1.1, -310.7], w: 7.6, end: 'post' }] });
  // 交泰殿东西踏跺、坤宁宫后踏跺
  buildStairs(ctx.at(13.0, 0, -265.6, PI / 2), { w: 4.0, h: y, run: 6.6, style: 'marble', railings: true });
  buildStairs(ctx.at(-14.4, 0, -265.6, -PI / 2), { w: 4.0, h: y, run: 6.6, style: 'marble', railings: true });
  buildStairs(ctx.at(-1.1, 0, -311.0, PI), { w: 5.6, h: y, run: 7.0, style: 'marble', yulu: { w: 2.4 }, railings: true });
  paveStrip(ctx, [[XC, -241.5], [XC, -284.6]], 3.0, { y: y - 0.02, h: 0.05 });
  // 台上院墙：昭仁殿、弘德殿小院；东西暖殿院
  const W = { h: 5.0, thick: 0.9, y0: y };
  wall(ctx, [[-22.6, -221.0], [-45.8, -221.0], [-45.8, -244.7]], W);
  wall(ctx, [[-41.4, -248.3], [-30.1, -248.3]], W);
  wall(ctx, [[21.8, -221.0], [45.8, -221.0], [45.8, -245.6]], W);
  wall(ctx, [[31.4, -248.3], [43.0, -248.3]], W);
  wall(ctx, [[-21.8, -290.3], [-45.7, -290.3], [-45.7, -310.6], [-22.8, -310.6]], W);
  wall(ctx, [[22.0, -290.6], [45.8, -290.6], [45.8, -309.8], [22.2, -309.8]], W);
  // 小院北门下的踏跺（通交泰殿两侧院落）
  buildStairs(ctx.at(27.5, 0, -249.0, PI), { w: 2.6, h: y, run: 5.0, style: 'marble', railings: true });
  buildStairs(ctx.at(-26.2, 0, -249.0, PI), { w: 2.6, h: y, run: 5.0, style: 'marble', railings: true });
}

// ---------------- 三宫正殿 ----------------
function qianqinggong(ctx, b, api) {
  const info = rhall(ctx, [-26.2, 25.4, -241.3, -213.3], 'S', {
    grade: 1, nBays: 9, nDepth: 5, corridor: true, dougong: { kou: 0.09, cai: 7 }, caihua: 'hexi', colH: 6.6,
    platform: false, double: { upperH: 2.3 }, lattice: 'sanjiao',
    roof: { type: 'wudian', beasts: 9 }, plaque: '乾清宫', plaqueCharH: 0.52,
  }, Y_GONG);
  lbl(api, '乾清宫', -0.4, info.top + 2, -227.3, '后三宫之首，明代与清初皇帝寝宫，雍正以后为召见臣工、处理日常政务之所。面阔九间、进深五间，黄琉璃瓦重檐庑殿顶，殿内悬顺治御书“正大光明”匾；现存建筑为嘉庆三年（1798）重建。');
}
function jiaotaidian(ctx, b, api) {
  const info = rhall(ctx, [-11.6, 10.2, -275.5, -253.5], 'S', {
    grade: 2, nBays: 3, nDepth: 3, dougong: { kou: 0.075, cai: 7 }, caihua: 'hexi', colH: 6.0, platform: false,
    roof: { type: 'cuanjian', sides: 4, rise: 7.0, baoding: 'gold', beasts: 7 }, lattice: 'sanjiao',
    front: ['window', 'door', 'window'], back: ['wall', 'door', 'wall'], left: ['wall', 'door', 'wall'], right: ['wall', 'door', 'wall'],
    plaque: '交泰殿', plaqueCharH: 0.5,
  }, Y_GONG);
  lbl(api, '交泰殿', -0.7, info.top + 2, -264.5, '位于乾清宫与坤宁宫之间，明嘉靖年间建，清嘉庆三年重建。平面方形、面阔进深各三间，单檐四角攒尖顶、鎏金宝顶；清代贮存二十五方宝玺，皇后千秋节在此受贺。');
}
function kunninggong(ctx, b, api) {
  const front = ['window', 'window', 'window', 'window', 'window', 'door', 'window', 'window', 'window'];
  const info = rhall(ctx, [-24.9, 25.2, -308.7, -284.7], 'S', {
    grade: 1, nBays: 9, nDepth: 5, corridor: true, dougong: { kou: 0.085, cai: 7 }, caihua: 'hexi', colH: 6.2,
    platform: false, double: { upperH: 2.2 }, front, lattice: 'fangge',
    roof: { type: 'wudian', beasts: 9 }, plaque: '坤宁宫', plaqueCharH: 0.48,
  }, Y_GONG);
  lbl(api, '坤宁宫', 0.2, info.top + 2, -296.7, '明代皇后寝宫；清顺治十二年仿盛京清宁宫改建，西部为萨满祭神场所，东暖阁为皇帝大婚洞房。面阔连廊九间，黄琉璃瓦重檐庑殿顶，门开在东次间，窗为满族式直棂吊搭窗。');
}

// 东西小殿（昭仁、弘德）：歇山正殿 + 前出卷棚廊
function sideHall(name, x, desc) {
  return (ctx, b, api) => {
    const s = x > 0 ? 1 : -1;
    const m = (a) => (s > 0 ? a : -a);
    const xa = m(26.1), xb = m(44.6);
    const info = rhall(ctx, [Math.min(xa, xb), Math.max(xa, xb), -243.7, -232.6], 'S', {
      grade: 3, nBays: 3, nDepth: 2, dougong: { kou: 0.06, cai: 3 }, caihua: 'xuanzi', colH: 4.6,
      platform: { h: 0.35, style: 'stone', stairs: [] }, roof: { type: 'xieshan', beasts: 5 }, lattice: 'shuangjiao',
    }, Y_GONG);
    const pa = m(27.4), pb = m(43.0);
    rhall(ctx, [Math.min(pa, pb), Math.max(pa, pb), -233.9, -228.9], 'S', {
      kind: 'pavilion', grade: 4, nBays: 3, nDepth: 1, dougong: false, colH: 3.5, bench: false, caihua: 'xuanzi',
      platform: { h: 0.35, style: 'stone', stairs: [{ side: 'S', w: 2.6 }] }, roof: { type: 'xuanshan', juan: true, beasts: 3 },
      plaque: name, plaqueCharH: 0.32,
    }, Y_GONG);
    lbl(api, name, x, info.top + 2, -238.2, desc);
  };
}
function nuanDian(rect, name) {
  return (ctx, b, api) => {
    const info = rhall(ctx, rect, 'S', {
      grade: 3, nBays: 5, nDepth: 2, dougong: { kou: 0.06, cai: 3 }, caihua: 'xuanzi', colH: 4.4,
      platform: { h: 0.35, style: 'stone', stairs: [{ side: 'S', w: 2.4 }] }, roof: { type: 'xieshan', beasts: 5 },
    }, Y_GONG);
    lbl(api, name, (rect[0] + rect[1]) / 2, info.top + 2, (rect[2] + rect[3]) / 2, `坤宁宫${name[0]}侧配殿，坐落在后三宫台基之上，自成小院。`);
  };
}
// 台上小门、角屋
function smallGate(rect, face) {
  return (ctx) => rhall(ctx, rect, face, { kind: 'gate', grade: 5, nBays: 1, nDepth: 2, dougong: false, colH: 3.6, platform: false, gateDoors: 1, roof: { type: 'xuanshan', beasts: 1 } }, Y_GONG);
}
function cornerHut(rect) {
  return (ctx) => rhall(ctx, rect, 'N', { grade: 5, nBays: 1, nDepth: 1, dougong: false, colH: 3.2, platform: false, front: 'door', back: 'wall', sides: 'wall', roof: { type: 'cuanjian', sides: 4, rise: 1.9 } }, Y_GONG);
}

// ---------------- 东西庑与庑门 ----------------
const WU = { grade: 4, nDepth: 3, corridor: 1.5, backCorridor: false, dougong: false, caihua: 'xuanzi', colH: 3.9, platform: { h: 0.6, style: 'plain', stairs: [] }, roof: { type: 'yingshan', gableWallMat: 'wall_red', beasts: 3 } };
function wu(parts, name, desc) {
  return (ctx, b, api) => {
    let top = 0, at = null;
    for (const [rect, face, extra] of parts) {
      const info = rhall(ctx, rect, face, { ...WU, ...(extra || {}) });
      if (!at) at = [info.cx, info.cz];
      top = Math.max(top, info.top);
    }
    if (name) lbl(api, name, at[0], top + 2, at[1], desc || '');
  };
}
function wuGate(rect, face, name, desc, big = false) {
  return (ctx, b, api) => {
    const info = rhall(ctx, rect, face, big
      ? { kind: 'gate', grade: 3, nBays: 5, nDepth: 2, dougong: { kou: 0.06, cai: 3 }, caihua: 'xuanzi', colH: 4.8, gateDoors: 1, platform: { h: 0.9, style: 'stone', stairs: [{ side: 'S', w: 3.6 }, { side: 'N', w: 3.6 }] }, roof: { type: 'xieshan', beasts: 5 }, plaque: name, plaqueCharH: 0.4 }
      : { kind: 'gate', grade: 4, nBays: 3, nDepth: 2, dougong: false, caihua: 'xuanzi', colH: 4.3, gateDoors: 1, platform: { h: 0.7, style: 'plain', stairs: [{ side: 'S', w: 2.8 }, { side: 'N', w: 2.8 }] }, roof: { type: 'xieshan', beasts: 3 }, plaque: name, plaqueCharH: 0.3 });
    lbl(api, name, info.cx, info.top + 1.5, info.cz, desc);
  };
}
// 长街琉璃门（墙门）
function streetGate(x, z, face, w, name, desc, h = 9.6, wallH = 8) {
  return (ctx, b, api) => {
    wgate(ctx, x, z, face, { w, h, wallThick: 1.8, doorW: Math.min(2.6, w * 0.45), doorH: 4.2, wallH });
    if (name) lbl(api, name, x, h + 1.5, z, desc || '');
  };
}

// ---------------- 覆盖表 ----------------
export const overrides = {
  638807674: qianqingmen,
  638807694: yongdao,
  638981261: yuetai,
  638981252: gongPlatform,
  638981317: qianqinggong,
  638981229: jiaotaidian,
  639012193: kunninggong,
  638981272: sideHall('昭仁殿', 35.4, '乾清宫东侧小殿，面阔三间，自成小院；乾隆时为宫中善本藏书处“天禄琳琅”。'),
  638981273: sideHall('弘德殿', -35.6, '乾清宫西侧小殿，面阔三间，清代皇帝读书、召见臣工之所。'),
  639012180: nuanDian([26.4, 44.8, -308.4, -297.2], '东暖殿'),
  639012191: nuanDian([-44.2, -25.8, -309.6, -298.5], '西暖殿'),
  8861194: 'skip', // 西暖殿重复轮廓
  639012133: 'skip', // 坤宁宫后月台与踏跺（并入工字台基）
  639012159: 'skip', 639012166: 'skip', // 东西暖殿院墙（build 中按台基高重建）
  638981313: 'skip', 638981314: 'skip', // 昭仁/弘德院南墙
  638981206: 'skip', 638981215: 'skip', 638981227: 'skip', 638981228: 'skip', // 工字台基颈部 OSM 碎条
  638981270: smallGate([23.6, 31.4, -249.1, -245.6], 'N'),
  638981271: smallGate([-30.1, -22.3, -248.7, -244.6], 'N'),
  638981264: cornerHut([43.0, 46.5, -248.9, -245.6]),
  638981265: cornerHut([-46.1, -41.4, -249.0, -244.8]),
  // 南庑：上书房 / 南书房（L 形，转角接东西庑）
  639048723: wu([[[17.6, 59.2, -132.9, -121.0], 'N'], [[47.8, 59.7, -149.6, -132.9], 'W']], '上书房', '清代皇子读书处，位于乾清门内东侧南庑，道光后定名。'),
  639048827: wu([[[-58.2, -19.6, -132.5, -121.9], 'N'], [[-58.2, -48.6, -148.7, -132.5], 'E']], '南书房', '康熙十六年（1677）设，翰林入值，为皇帝讲学、代拟谕旨之所；位于乾清门内西侧南庑。'),
  639048965: wuGate([45.9, 61.6, -170.6, -149.6], 'W', '日精门', '乾清宫庭院东庑正门，与西庑月华门相对，通东一长街。', true),
  639048970: wuGate([-61.6, -45.4, -169.6, -148.7], 'E', '月华门', '乾清宫庭院西庑正门，与东庑日精门相对，通西一长街。', true),
  639080214: wu([[[47.7, 59.3, -221.4, -170.5], 'W', { nBays: 13 }]], '端凝殿', '乾清宫东庑，清代存放皇帝冠袍带履之所，与西庑懋勤殿相对。'),
  639070133: wu([[[-59.3, -48.3, -219.4, -169.5], 'E', { nBays: 13 }]], '懋勤殿', '乾清宫西庑，皇帝读书、批阅奏章之所，秋审“勾到”亦在此举行。'),
  639080211: wuGate([48.3, 59.3, -230.1, -221.3], 'W', '龙光门', '乾清宫东庑北门，与西庑凤彩门相对。'),
  639070135: wuGate([-58.7, -48.2, -228.0, -219.4], 'E', '凤彩门', '乾清宫西庑北门，与东庑龙光门相对。'),
  639080213: wu([[[48.4, 59.4, -255.0, -230.0], 'W']]),
  639070134: wu([[[-58.7, -47.9, -254.1, -228.0], 'E']]),
  639048947: wuGate([45.6, 61.9, -275.7, -254.9], 'W', '景和门', '交泰殿东侧庑门，通东一长街与东六宫。', true),
  639048962: wuGate([-62.3, -45.1, -274.9, -254.0], 'E', '隆福门', '交泰殿西侧庑门，通西一长街与西六宫。', true),
  639108967: wu([[[47.8, 59.6, -290.9, -275.7], 'W']]),
  639108986: wu([[[-59.8, -48.2, -290.8, -274.8], 'E']]),
  639108973: wuGate([48.0, 59.7, -298.4, -290.9], 'W', '永祥门', '坤宁宫庭院东庑门。'),
  639108984: wuGate([-59.6, -48.2, -298.2, -290.8], 'E', '增瑞门', '坤宁宫庭院西庑门（OSM 作“璔瑞门”）。'),
  639108974: wu([[[48.1, 60.1, -319.8, -298.4], 'W']]),
  639108977: wu([[[-59.5, -47.9, -316.6, -298.2], 'E']]),
  639108975: wu([[[9.9, 48.6, -340.2, -330.0], 'S'], [[48.6, 60.3, -340.0, -319.8], 'W']]),
  639108976: wu([[[-47.8, -10.8, -340.0, -329.8], 'S'], [[-59.2, -47.8, -336.0, -316.6], 'E']]),
  639060881: (ctx, b, api) => {
    const info = rhall(ctx, [-10.8, 9.8, -338.4, -328.7], 'N', {
      kind: 'gate', grade: 3, nBays: 5, nDepth: 2, dougong: { kou: 0.065, cai: 3 }, caihua: 'xuanzi', colH: 4.8, gateDoors: 3,
      platform: { h: 1.0, style: 'xumizuo', stairs: [{ side: 'S', w: 3.4 }, { side: 'N', w: 3.4 }] }, roof: { type: 'xieshan', beasts: 5 },
      plaque: '坤宁门', plaqueCharH: 0.42,
    });
    lbl(api, '坤宁门', -0.5, info.top + 2, -333.5, '后三宫北门，明称广运门、清改坤宁门。面阔五间，单檐歇山顶，北对御花园。');
  },
  // 长街上的门与墙门
  42623328: streetGate(63.7, -191.85, 'S', 9.2, '近光左门', '东一长街上的琉璃门。', 8.4, 0),
  42509107: streetGate(-63.45, -191.4, 'S', 8.7, '近光右门', '西一长街上的琉璃门。', 8.4, 0),
  42424164: streetGate(64.5, -332.55, 'S', 8.4, '长康左门', '东一长街北端琉璃门。', 8.4, 0),
  42424146: streetGate(-63.1, -332.7, 'S', 8.1, '长康右门', '西一长街北端琉璃门。', 8.4, 0),
  42509104: streetGate(-69.0, -158.75, 'W', 4.6, '遵义门', '西一长街西侧琉璃门，通养心殿。'),
  42509110: streetGate(-68.8, -209.75, 'W', 5.5, '咸和右门', '西一长街西侧琉璃门，通西六宫。'),
  43485438: streetGate(-68.2, -320.1, 'W', 4.6, '大成右门', '西一长街西侧琉璃门，通西六宫。'),
  // 乾清门外东侧值房（卷棚歇山小房）
  638959716: autoFix({ rotY: 0, grade: 5, roof: { type: 'xieshan', juan: true } }),
  638959717: autoFix({ rotY: 0, grade: 5, roof: { type: 'xieshan', juan: true } }),
  639048710: autoFix({ rotY: 0, grade: 5, roof: { type: 'xieshan', juan: true } }),
};

/** 东一长街墙上的琉璃门（OSM 以墙体表示） */
export function buildStreetWallGates(ctx, api) {
  for (const [x, z, w, name] of [[68.8, -127.5, 4.4, '仁祥门'], [69.3, -210.95, 5.1, '咸和左门'], [69.45, -268.6, 4.4, '广生左门'], [69.55, -320.45, 4.4, '大成左门']]) {
    wgate(ctx, x, z, 'E', { w, h: 9.6, wallThick: 1.8, doorW: 2.2, doorH: 4.2, wallH: 8 });
    lbl(api, name, x, 11, z, '东一长街东侧琉璃门，通东六宫。');
  }
}

export { buildPalaceWall };
