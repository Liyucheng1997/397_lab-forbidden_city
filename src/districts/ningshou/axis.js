// 宁寿宫区·中路：皇极门（三间七楼琉璃门）、宁寿门、高台甬道与皇极殿台基、宁寿宫、养性门、养性殿、乐寿堂、颐和轩、景祺阁、珍妃井
import { buildHall } from '../../core/building.js';
import { buildPlatform, buildStairs, buildXumizuo, buildRailing } from '../../core/platform.js';
import { buildWallGate, buildScreenWall, buildPalaceWall } from '../../core/walls.js';
import { propHeight } from '../../core/props.js';
import { boxGeo, cylGeo, prismGeo } from '../../core/geom.js';
import { PI, FACE, rectOf, hallOn, towerOn, paving, roof } from './lib.js';

// ---------------- 皇极门：三间七楼琉璃门（垂花门式牌楼门） ----------------
// 明楼（中门）最高，次楼（两侧门）次之，夹楼（悬山）居间，边楼最低；汉白玉须弥座，黄琉璃庑殿顶。
export const HJM = { x: 293.0, z: -65.0, wallZ: -64.6, wallH: 6.2 };
export function huangjiMen(ctx, b, api) {
  const c = ctx.at(HJM.x, 0, HJM.z, 0);
  const wt = 1.5;
  // 明楼（中门）
  const top = buildWallGate(c, { type: 'liuli', w: 6.4, h: 10.2, wallThick: wt, doorW: 2.9, doorH: 4.5, wallH: HJM.wallH, roof: 'wudian', beasts: 3 }).top;
  for (const s of [-1, 1]) {
    // 夹楼（悬山顶琉璃墙垛）
    buildScreenWall(c.at(s * 4.4, 0, 0), { style: 'liuli', w: 2.4, h: 7.9, thick: 1.9, roof: 'xuanshan' });
    // 次楼（两侧门）
    buildWallGate(c.at(s * 7.6, 0, 0), { type: 'liuli', w: 4.0, h: 9.0, wallThick: wt, doorW: 2.0, doorH: 3.6, wallH: HJM.wallH, roof: 'wudian', beasts: 1 });
    // 边楼
    buildScreenWall(c.at(s * 10.725, 0, 0), { style: 'liuli', w: 2.25, h: 7.4, thick: 1.8, roof: 'xieshan' });
  }
  // 门前御路
  paving(ctx, [HJM.x - 2.2, HJM.x + 2.2, HJM.z + 1.2, -36.8], 0.05);
  api.label('皇极门', HJM.x, top + 1.5, HJM.z, '宁寿宫区正门，乾隆三十六年（1771）建。三座随墙琉璃门坐于汉白玉须弥座上，明楼、次楼黄琉璃庑殿顶，夹楼悬山，称“三间七楼垂花门式牌楼门”。');
}

// ---------------- 宁寿门前院、高台甬道、皇极殿台基 ----------------
const YD = { x0: 290.2, x1: 296.8, h: 1.6 }; // 甬道
const TJ = { x0: 269.6, x1: 316.8, z0: -211.6, z1: -187.4, h: 1.6 }; // 皇极殿台基
const YT = { x0: 278.6, x1: 308.4, z1: -175.4 }; // 月台（台基南侧）

export function buildAxis(ctx, api) {
  // 皇极门 → 宁寿门：御路
  paving(ctx, [291.2, 295.8, -128.2, -66.8], 0.05);
  // 宁寿门：八字琉璃影壁 + 鎏金铜狮
  const nsmZ = -129.0;
  for (const s of [-1, 1]) {
    buildScreenWall(ctx.at(293.9 + s * 18.6, 0, nsmZ + 0.75, -s * 0.42), { style: 'liuli', w: 6.6, h: 5.6, thick: 1.0, roof: 'wudian' });
    ctx.place(s > 0 ? 'lion:m:gilt' : 'lion:f:gilt', 293.9 + s * 5.4, 0, nsmZ + 3.4, 0, 3.3);
  }
  // 高台甬道（宁寿门 → 皇极殿月台）：汉白玉须弥座 + 栏杆
  const yz0 = -175.4, yz1 = -140.6;
  const ydPoly = [[YD.x0, yz0], [YD.x1, yz0], [YD.x1, yz1], [YD.x0, yz1]];
  buildXumizuo(ctx, ydPoly, 0, YD.h, { edgeW: 0.4 });
  ctx.add('paving_imperial', prismGeo([[YD.x0 + 0.4, yz0], [YD.x1 - 0.4, yz0], [YD.x1 - 0.4, yz1], [YD.x0 + 0.4, yz1]], YD.h - 0.02, YD.h + 0.01));
  for (const x of [YD.x0 + 0.28, YD.x1 - 0.28]) buildRailing(ctx, { path: [[x, yz0 + 0.3], [x, yz1 - 0.3]], y: YD.h, style: 'marble', ends: 'post', gaps: [{ at: [x, -150], w: 4.6, end: 'post' }] });
  // 甬道两侧踏跺（中段）
  for (const s of [-1, 1]) buildStairs(ctx.at(s > 0 ? YD.x1 : YD.x0, 0, -150, s * PI / 2), { w: 3.2, h: YD.h, style: 'marble', railings: { inset: 0.28 } });
  // 甬道两侧六角须弥座（原六角重檐亭址，亭已不存）
  for (const s of [-1, 1]) {
    const cx = 293.5 + s * 9.5, cz = -164;
    const hex = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * PI * 2 + PI / 6; return [cx + Math.cos(a) * 2.6, cz + Math.sin(a) * 2.6]; });
    buildXumizuo(ctx, hex, 0, 1.1, { edgeW: 0.3 });
  }
  // 皇极殿台基 + 月台（青白石须弥座、汉白玉栏杆）
  const tj = [[TJ.x0, TJ.z0], [TJ.x1, TJ.z0], [TJ.x1, TJ.z1], [YT.x1, TJ.z1], [YT.x1, YT.z1], [YD.x1, YT.z1], [YD.x0, YT.z1], [YT.x0, YT.z1], [YT.x0, TJ.z1], [TJ.x0, TJ.z1]];
  buildPlatform(ctx, {
    poly: tj, h: TJ.h, style: 'xumizuo', railing: { style: 'marble', gaps: [{ at: [293.5, YT.z1], w: YD.x1 - YD.x0 - 0.2, end: 'post' }] },
    stairs: [
      { at: [YT.x0 + 3.5, YT.z1], w: 3.2, railings: true }, { at: [YT.x1 - 3.5, YT.z1], w: 3.2, railings: true },
      { at: [YT.x0, -181.4], w: 3.0, railings: true }, { at: [YT.x1, -181.4], w: 3.0, railings: true },
      { at: [293.2, TJ.z0], w: 5.0, railings: true },
    ],
  });
  // 月台陈设：日晷（东）、嘉量（西）
  ctx.place('sundial', 293.2 + 8.5, TJ.h, -182.6, 0, propHeight('sundial'));
  ctx.place('jialiang', 293.2 - 8.5, TJ.h, -182.6, 0, propHeight('jialiang'));
  // 院内鎏金铜缸
  for (const [x, z] of [[272.5, -181], [314, -181], [272.5, -166], [314, -166]]) ctx.place('vat:gilt', x, 0, z, 0, 1.6);
  // 宁寿宫台基（单层石台）+ 皇极殿至宁寿宫甬路
  buildPlatform(ctx, { poly: [[272.2, -239.0], [316.9, -239.0], [316.9, -223.2], [272.2, -223.2]], h: 1.3, style: 'xumizuo', stairs: [{ at: [294.5, -223.2], w: 5.2 }, { at: [294.5, -239], w: 4.0 }] });
  paving(ctx, [291.4, 297.6, -221.6, -215.6], 0.05);
  // 宁寿宫后横街 → 养性门：甬路
  paving(ctx, [291.0, 296.0, -258.4, -241.4], 0.05);
  // 养性门前鎏金铜狮
  for (const s of [-1, 1]) ctx.place(s > 0 ? 'lion:m:gilt' : 'lion:f:gilt', 293.4 + s * 5.0, 0, -257.6, 0, 3.0);
  // 养性门内绿琉璃影壁
  buildScreenWall(ctx.at(293.4, 0, -279.4), { style: 'liuli', w: 10.5, h: 5.2, thick: 1.0, tile: 'green', roof: 'wudian' });
  // 乐寿堂—颐和轩月台与露陈台（东置日晷，西空）
  const yt = [[287.2, -372.0], [300.4, -372.0], [300.4, -360.4], [287.2, -360.4]];
  buildPlatform(ctx, { poly: yt, h: 1.0, style: 'xumizuo', railing: { style: 'marble', gaps: [{ at: [293.8, -360.4], w: 4.6 }, { at: [293.8, -372.0], w: 4.6 }] }, stairs: [{ at: [287.2, -366.2], w: 2.6 }, { at: [300.4, -366.2], w: 2.6 }] });
  for (const s of [-1, 1]) buildPlatform(ctx, { poly: [[293.8 + s * 10.5 - 1.4, -368.6], [293.8 + s * 10.5 + 1.4, -368.6], [293.8 + s * 10.5 + 1.4, -365.8], [293.8 + s * 10.5 - 1.4, -365.8]], h: 0.8, style: 'xumizuo' });
  ctx.place('sundial', 304.3, 0.8, -367.2, 0, 2.2);
  // 珍妃井：景祺阁北小院，贞顺门内
  const wx = 283.6, wz = -425.2;
  const slab = boxGeo(1.6, 0.22, 1.6); slab.translate(wx, 0.11, wz);
  ctx.add('stone_grey', slab);
  const ring = cylGeo(0.36, 0.38, 0.12, 20); ring.translate(wx, 0.2, wz);
  ctx.add('stone_grey', ring);
  const hole = cylGeo(0.24, 0.24, 0.01, 20); hole.translate(wx, 0.32, wz);
  ctx.add('wood_dark', hole);
  api.label('珍妃井', wx, 2.2, wz, '景祺阁北、贞顺门内的小井。光绪二十六年（1900）八国联军入京前，珍妃被推入此井溺亡，后人称“珍妃井”。');
  // 皇极殿、宁寿门月台陈设标签
  api.label('高台甬道', 293.5, YD.h + 2, -158, '宁寿门至皇极殿的高台甬道，汉白玉须弥座、石栏环护，两侧各有六角须弥座一座（原为六角重檐亭，今仅存台基）。');
}

// ---------------- 养性殿（仿养心殿，前出卷棚抱厦） ----------------
export function yangxingDian(ctx, b, api) {
  const H = 1.0;
  // 台基（含抱厦），白石须弥座
  const poly = [[276.6, -308.2], [311.5, -308.2], [311.5, -293.6], [301.2, -293.6], [301.2, -288.2], [281.8, -288.2], [281.8, -293.6], [276.6, -293.6]];
  buildPlatform(ctx, { poly, h: H, style: 'xumizuo', stairs: [{ at: [291.5, -288.2], w: 5.6, yulu: true }, { at: [279.2, -293.6], w: 2.8 }] });
  ctx.place('sundial', 306.8, H, -291.6, 0, 2.2);
  const main = hallOn(ctx, [275.4, 312.7, -309.5, -292.2], 'S', {
    y0: H, platform: false, grade: 2, nBays: 7, nDepth: 4, corridor: 1.9, dougong: { kou: 0.075, cai: 5 },
    roof: roof('xieshan', { beasts: 5 }), front: ['window', 'window', 'door', 'door', 'door', 'window', 'window'],
  });
  hallOn(ctx, [281.0, 302.0, -295.6, -287.1], 'S', {
    y0: H, platform: false, grade: 4, nBays: 4, nDepth: 1, colH: 3.6, caihua: 'hexi', back: 'open', sides: 'window',
    front: ['door', 'door', 'door', 'door'], roof: roof('xuanshan', { juan: true, beasts: -1 }),
  });
  api.label('养性殿', 294, main.topY + 1.5, -300.8, '宁寿宫区中路后寝正殿，乾隆三十七年仿养心殿建。黄琉璃瓦单檐歇山顶，四周檐廊，正面接出四间卷棚抱厦，开间配置东西不对称；殿前东侧置日晷。');
}

// ---------------- 颐和轩（前后抱厦，前抱厦月台通乐寿堂） ----------------
export function yiheXuan(ctx, b, api) {
  const H = 1.0;
  const main = hallOn(ctx, [277.2, 310.7, -390.5, -375.5], 'S', {
    grade: 3, nBays: 7, nDepth: 3, corridor: 1.8, backCorridor: true, dougong: { kou: 0.065, cai: 3 },
    platform: { h: H, style: 'xumizuo', stairs: [] }, roof: roof('xieshan', { beasts: 5 }),
  });
  hallOn(ctx, [281.5, 305.3, -377.4, -372.1], 'S', {
    y0: H, platform: false, grade: 4, nBays: 5, nDepth: 1, colH: 3.6, caihua: 'hexi', back: 'open', sides: 'window', front: 'door',
    roof: roof('xuanshan', { juan: true, beasts: -1 }),
  });
  buildPlatform(ctx, { poly: [[282.2, -377.4], [304.6, -377.4], [304.6, -372.4], [282.2, -372.4]], h: H, style: 'xumizuo', floor: false });
  hallOn(ctx, [283.9, 303.4, -394.2, -388.6], 'N', {
    y0: H, platform: false, grade: 4, nBays: 5, nDepth: 1, colH: 3.6, caihua: 'hexi', back: 'open', sides: 'window', front: 'door',
    roof: roof('xuanshan', { juan: true, beasts: -1 }),
  });
  buildPlatform(ctx, { poly: [[284.6, -394.0], [302.7, -394.0], [302.7, -389.4], [284.6, -389.4]], h: H, style: 'xumizuo', floor: false });
  api.label('颐和轩', 294, main.topY + 1.5, -383, '乐寿堂后的寝殿，面阔七间，黄琉璃瓦单檐歇山顶，前后出抱厦（前抱厦檐柱为石柱），前有月台直通乐寿堂后门，后有穿廊连景祺阁。');
}
