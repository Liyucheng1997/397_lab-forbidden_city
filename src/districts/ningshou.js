// 分区：宁寿宫区（外东路北部，乾隆为归政后做太上皇而建，乾隆三十六年至四十一年 1771–1776 改建）
// 前朝：九龙壁 → 皇极门 → 宁寿门 → 高台甬道 → 皇极殿 → 宁寿宫；后寝分三路：
//   中路 养性门、养性殿、乐寿堂、颐和轩、景祺阁（北端贞顺门、珍妃井）；
//   东路 畅音阁/扮戏楼/阅是楼、寻沿书屋、庆寿堂、景福宫、梵华楼、佛日楼；
//   西路 宁寿宫花园（乾隆花园）四进院落。
// 区外：东墙与紫禁城东城墙之间、北墙与北城墙之间的值房（灰瓦）。
// 本分区负责的九龙壁 OSM 墙线（41661995）位于 z>-40，归属 east_outer；须由 east_outer 在 wallOverrides 中 skip。
import { buildPalaceWall, buildWallGate } from '../core/walls.js';
import { roof, R, M, auto, house, garden, gallery, tree, rectOf, towerOn } from './ningshou/lib.js';
import { buildJiulongbi } from './ningshou/jiulongbi.js';
import { huangjiMen, HJM, buildAxis, yangxingDian, yiheXuan } from './ningshou/axis.js';
import { changyinGe, banxiLou, yueshiLou, jingfuGong, fanhuaLou, foriLou } from './ningshou/east.js';
import { xishangTing, yizhai, cuishangLou, yanquLou, yunguangLou, fuwangGe, zhuxiangGuan, galleryOverride, buildGarden, GALLERIES } from './ningshou/garden.js';

// ---------------- 形制预设 ----------------
const GREY = { tile: 'grey', caihua: 'none', wallMat: 'brick_grey', roof: { gableWallMat: 'brick_grey' }, noLabel: true };
const Y45 = { h: 4.5 };
const AUTO = auto();
/** 庑房（黄琉璃硬山、前廊，门窗相间） */
const wu = (n) => ({
  grade: 4, tile: 'yellow', caihua: 'xuanzi', nBays: n, nDepth: 3, corridor: 1.4, roof: roof('yingshan', { gableWallMat: 'wall_red' }),
  platform: { h: 0.6, style: 'plain' }, front: Array.from({ length: n }, (_, i) => (i % 3 === 1 ? 'door' : 'window')), back: 'wall',
});
/** 库房勾连搭（前后两卷硬山） */
const ku = { ...house({ nBays: 5 }), front: ['window', 'window', 'door', 'window', 'window'] };
/** 函数覆盖：直接建一组游廊 */
const G = (id) => galleryOverride(id);

/** 中路殿宇 */
const OV_AXIS = {
  41661998: huangjiMen,
  40592357: R(40592357, 'S', {
    kind: 'gate', grade: 2, nBays: 5, nDepth: 2, dougong: { kou: 0.08, cai: 5 }, caihua: 'hexi', tile: 'yellow',
    roof: roof('xieshan', { beasts: 7 }), front: ['window', 'gate', 'gate', 'gate', 'window'], pl: '宁寿门', plH: 0.5,
    platform: {
      h: 1.6, style: 'xumizuo', railing: 'marble',
      railingGaps: [{ at: [0, 60], w: 6.0 }, { at: [-8.8, 60], w: 4.4 }, { at: [8.8, 60], w: 4.4 }, { at: [0, -60], w: 6.4 }],
      stairs: [{ side: 'S', w: 4.4, yulu: true }, { side: 'S', x: -8.8, w: 2.8 }, { side: 'S', x: 8.8, w: 2.8 }],
    },
  }, '宁寿宫区第二道门（相当于太和门），面阔五间、进深三间，黄琉璃瓦单檐歇山顶，坐汉白玉须弥座；中三间为门，次间槛窗，两侧接八字琉璃影壁，门前一对鎏金铜狮，后有高台甬道直达皇极殿。'),
  40592355: R(40592355, 'S', {
    grade: 1, nBays: 9, nDepth: 5, corridor: 2.6, dougong: { kou: 0.085, cai: 7, lowerCai: 5 }, caihua: 'hexi', tile: 'yellow',
    y0: 1.6, platform: false, double: { inset: 2.8, upperH: 2.6 }, roof: roof('wudian', { beasts: 9 }), pl: '皇极殿', plH: 0.62,
  }, '宁寿宫区正殿，乾隆四十一年（1776）仿乾清宫改建，为太上皇临朝受贺之所。面阔九间、进深五间，黄琉璃瓦重檐庑殿顶，坐青白石须弥座台基，前出月台，日晷、嘉量分列御路两侧。'),
  40592356: R(40592356, 'S', {
    grade: 2, nBays: 9, nDepth: 4, corridor: 2.0, backCorridor: true, dougong: { kou: 0.08, cai: 5 }, caihua: 'hexi', tile: 'yellow',
    y0: 1.3, platform: false, roof: roof('xieshan', { beasts: 7 }), pl: '宁寿宫', plH: 0.52,
    front: ['zhizhai', 'zhizhai', 'zhizhai', 'zhizhai', 'zhizhai', 'door', 'zhizhai', 'zhizhai', 'zhizhai'],
    back: ['wall', 'wall', 'wall', 'door', 'door', 'door', 'wall', 'wall', 'wall'],
  }, '皇极殿后的寝宫，仿坤宁宫之制：面阔七间（连廊九间），黄琉璃瓦单檐歇山顶，坐单层石台；门开东次间，窗为直棂吊搭窗，西部为萨满祭神之所。'),
  40592358: R(40592358, 'W', { kind: 'gate', grade: 3, nBays: 3, nDepth: 2, caihua: 'hexi', roof: roof('xieshan', { beasts: 5 }), platform: { h: 0.8, style: 'plain' }, pl: '凝祺门', plH: 0.38 }),
  40592359: R(40592359, 'E', { kind: 'gate', grade: 3, nBays: 3, nDepth: 2, caihua: 'hexi', roof: roof('xieshan', { beasts: 5 }), platform: { h: 0.8, style: 'plain' }, pl: '昌泽门', plH: 0.38 }),
  40592360: M([[[251.9, 258.6, -237.5, -174.7], 'E', wu(15)], [[258.6, 270.5, -237.5, -228.6], 'S', wu(3)]]),
  40592361: M([[[327.6, 335.9, -238, -175], 'W', wu(15)], [[318.7, 327.6, -238, -228.6], 'S', wu(3)]], '皇极殿院东庑，今辟为珍宝馆金银器展厅。'),
  40592362: M([[[309.4, 336.1, -140.4, -131.2], 'N', wu(7)], [[327.5, 336.1, -158.6, -140.4], 'W', wu(5)]], '皇极殿院东南庑（宁寿门东侧），今为珍宝馆展厅。'),
  40592363: M([[[252.0, 278.4, -139.5, -130.6], 'N', wu(7)], [[252.0, 259.0, -158.2, -139.5], 'E', wu(5)]]),
  41662971: chuihuaWall(258.8, 269.6, -194.8),
  41662972: chuihuaWall(316.8, 327.6, -194.8),
  40629260: R(40629260, 'S', {
    kind: 'gate', grade: 3, nBays: 3, nDepth: 2, dougong: { kou: 0.07, cai: 5 }, caihua: 'hexi', roof: roof('xieshan', { beasts: 5 }), pl: '养性门', plH: 0.45,
    platform: { h: 1.2, style: 'xumizuo', stairs: [{ side: 'S', w: 4.6, yulu: true }, { side: 'N', w: 4.6 }] },
  }, '后寝区正门（相当于乾清门），面阔三间，黄琉璃瓦单檐歇山顶，坐汉白玉须弥座；门前扶手踏跺下列鎏金铜狮一对，门内立绿琉璃影壁。'),
  40629278: yangxingDian,
  40629280: R(40629280, 'W', { grade: 4, nBays: 5, nDepth: 3, corridor: 1.4, caihua: 'xuanzi', roof: roof('yingshan', { gableWallMat: 'wall_red' }), platform: { h: 0.6, style: 'plain' } }),
  40629282: R(40629282, 'E', { grade: 4, nBays: 5, nDepth: 3, corridor: 1.4, caihua: 'xuanzi', roof: roof('yingshan', { gableWallMat: 'wall_red' }), platform: { h: 0.6, style: 'plain' } }),
  40629281: (ctx) => gallery(ctx, [310.6, 314.2, -274.9, -261.9], { face: 'W', back: true }),
  40629284: (ctx) => gallery(ctx, [271.15, 275.25, -273.7, -263.7], { face: 'E', back: true }),
  40629276: R(40629276, 'S', {
    grade: 3, nBays: 7, nDepth: 5, corridor: 2.0, backCorridor: true, dougong: { kou: 0.07, cai: 3 }, caihua: 'hexi', roof: roof('xieshan', { beasts: 5 }), pl: '乐寿堂', plH: 0.5,
    platform: { h: 1.0, style: 'xumizuo', stairs: [{ side: 'S', w: 5.0 }] },
  }, '宁寿宫后寝中路主殿，乾隆归政后的寝宫（仿长春园淳化轩）。面阔七间、进深三间，四周檐廊，黄琉璃瓦单檐歇山顶；内部楠木装修、仙楼，陈设大禹治水图玉山。'),
  43525095: yiheXuan,
  43525096: R(43525096, 'E', { grade: 5, nBays: 3, nDepth: 1, caihua: 'sushi', roof: roof('xuanshan', { juan: true, beasts: -1 }), front: 'window', back: 'window', platform: { h: 1.0, style: 'plain', stairs: [] } }),
  40629275: (ctx, b, api) => {
    const t = towerOn(ctx, rectOf(40629275), 'S', {
      grade: 3, nBays: 7, nDepth: 2, dougong: { kou: 0.065, cai: 3 }, caihua: 'hexi', platform: { h: 0.8, style: 'stone', stairs: [{ side: 'S' }] },
      roof: roof('xieshan', { beasts: 5 }), stories: [{ colH: 4.2, front: 'door' }, { colH: 3.4, inset: 0.4, front: 'window', balcony: true }],
    });
    api.label('景祺阁', 293.6, t.topY + 1, -409.1, '中路最北端的二层楼阁，面阔七间，与颐和轩以穿廊相连；阁北小院即珍妃井所在。');
  },
  1341826222: R(1341826222, 'W', house({ juan: true })),
  650027702: R(650027702, 'S', house({ juan: true })),
  1341826221: R(1341826221, 'S', { ...house({ juan: true, nBays: 3, kind: 'gate' }), gateDoors: 1 }),
  42681416: R(42681416, 'E', { kind: 'gate', grade: 5, nBays: 1, nDepth: 2, caihua: 'sushi', roof: roof('yingshan', { juan: true, gableWallMat: 'wall_red' }), platform: { h: 0.4, style: 'plain' } }),
  42681417: R(42681417, 'W', house({ juan: true })),
  42681401: R(42681401, 'W', { kind: 'gate', grade: 5, nBays: 1, nDepth: 2, caihua: 'xuanzi', roof: roof('yingshan', { gableWallMat: 'wall_red' }), platform: { h: 0.3, style: 'plain' } }),
  // 宁寿门前东西库房（勾连搭）、九龙壁院值房
  ...Object.fromEntries([40591195, 40591197, 40591198, 40591199, 40591200, 40591201].map((id) => [id, R(id, 'W', ku)])),
  ...Object.fromEntries([40591189, 40591190, 40591191, 40591192, 40591193, 40591194].map((id) => [id, R(id, 'E', ku)])),
  40591202: R(40591202, 'S', house({ nBays: 5 })),
  40591203: R(40591203, 'S', house({ nBays: 5 })),
};

/** 东路 */
const OV_EAST = {
  40628847: changyinGe,
  40628833: banxiLou,
  40628834: yueshiLou,
  627819177: M([[[317.4, 323.4, -307.2, -270.6], 'E', house({ grade: 4, juan: true, nDepth: 3, corridor: 1.4, nBays: 11 })]]),
  627819179: M([[[346.0, 352.8, -307.3, -270.7], 'W', house({ grade: 4, juan: true, nDepth: 3, corridor: 1.4, nBays: 11 })]]),
  42681411: R(42681411, 'N', house({ juan: true, nBays: 3 })),
  40628836: R(40628836, 'S', house({ grade: 4, juan: true, nBays: 5, nDepth: 3, corridor: 1.4, ph: 0.6 }), '庆寿堂院第一进正房，卷棚硬山，前出廊。'),
  42681412: R(42681412, 'E', house({ juan: true, nBays: 3 })),
  42681422: R(42681422, 'W', house({ juan: true, nBays: 3 })),
  40628835: R(40628835, 'E', house({ juan: true, nBays: 3 })),
  40628839: R(40628839, 'W', house({ juan: true, nBays: 3 })),
  40628841: R(40628841, 'S', house({ grade: 4, juan: true, nBays: 5, nDepth: 4, corridor: 1.5, backCorridor: true, ph: 0.7 }), '东路中部的四进院落主殿，乾隆时为皇子、皇孙居所。面阔五间，前后廊，卷棚硬山顶。'),
  650020278: R(650020278, 'E', house({ juan: true, nBays: 3 })),
  650020279: R(650020279, 'W', house({ juan: true, nBays: 3 })),
  40628840: R(40628840, 'S', house({ grade: 4, juan: true, nBays: 5, nDepth: 3, corridor: 1.4, ph: 0.6 })),
  40628838: R(40628838, 'E', house({ juan: true, nBays: 3 })),
  40628837: R(40628837, 'W', house({ juan: true, nBays: 1 })),
  40628842: R(40628842, 'N', house({ juan: true, nBays: 7 })),
  40628843: jingfuGong,
  40628845: fanhuaLou,
  40628846: foriLou,
};

/** 西路·宁寿宫花园 */
const OV_GARDEN = {
  42681394: R(42681394, 'S', { ...garden('yingshan', { kind: 'gate', nBays: 3, nDepth: 2, ph: 0.5 }) }, '宁寿宫花园正门，面阔三间，卷棚硬山顶，黄琉璃瓦绿剪边；门内以假山作影壁。'),
  1341826231: 'skip', 42681395: 'skip', // 花园南墙（OSM 以建筑描绘），改由 build 建宫墙
  // 宫墙门（OSM 门洞轮廓）：由 build 按琉璃门/随墙门重建
  43519298: 'skip', 43519299: 'skip', 43525074: 'skip', 43525075: 'skip', 43525073: 'skip', 43525069: 'skip',
  1341826233: R(1341826233, 'E', garden('xieshan', { nBays: 1, ph: 0.4 })),
  43525091: 'skip', 43525070: 'skip', 43525093: 'skip', 1341826234: 'skip', 1341826243: 'skip',
  1341826229: yizhai,
  43525092: xishangTing,
  1341826227: R(1341826227, 'E', garden('xieshan', { nBays: 3, nDepth: 3, corridor: 1.2, y0: 1.6, platform: { h: 0.3, style: 'stone', stairs: [] } })),
  40629271: R(40629271, 'S', { ...garden('xieshan', { kind: 'pavilion', nBays: 5, nDepth: 3, colH: 3.6, ph: 0.7, bench: false }) }, '花园第一进主体建筑，乾隆三十七年建，坐北面南的敞轩，面阔三间带回廊，卷棚歇山顶，黄琉璃瓦绿剪边；四面无门窗，楠木贴雕天花；轩前古楸得名“古华”。'),
  1341826232: R(1341826232, 'W', house({ juan: true, edge: 'green' })),
  42681397: R(42681397, 'S', house({})),
  42681408: (ctx) => buildWallGate(ctx.at(254.0, 0, -307.3, 0), { type: 'chuihua', w: 3.8, h: 6.2, tile: 'yellow' }),
  40629269: R(40629269, 'S', {
    ...garden('xieshan', { tile: 'green', edge: 'yellow', nBays: 5, nDepth: 3, corridor: 1.5, backCorridor: true, ph: 0.8 }),
    front: ['window', 'door', 'door', 'door', 'window'], back: ['wall', 'door', 'door', 'door', 'wall'],
  }, '花园第二进正厅，坐北面南，面阔五间，前后出廊，中为过厅；卷棚歇山顶，绿琉璃瓦黄剪边。院落开阔，东西配殿以抄手游廊相连。'),
  40629267: R(40629267, 'E', garden('yingshan', { nBays: 5, nDepth: 3, corridor: 1.4 })),
  40629268: R(40629268, 'W', garden('yingshan', { nBays: 5, nDepth: 3, corridor: 1.4 })),
  1341826237: R(1341826237, 'S', garden('yingshan', { nBays: 3 })),
  40629273: R(40629273, 'S', garden('xieshan', { edge: 'yellow', nBays: 3, nDepth: 3, corridor: 1.3 }), '花园第三进东南小院，三开间，三面出廊；屋顶借地形做成东硬山、西歇山的卷棚顶，为宫中仅有。院中松、竹、梅取“岁寒三友”之意。'),
  1341826245: cuishangLou,
  40629272: yanquLou,
  40629264: yunguangLou,
  40629261: fuwangGe,
  40629263: R(40629263, 'E', garden('xieshan', { edge: 'green', nBays: 3, nDepth: 3, corridor: 1.3, platform: { h: 0.9, style: 'xumizuo', stairs: [] } }), '花园第四进西侧，广三间，前出廊，卷棚歇山，黄琉璃瓦绿剪边；坐三尺高白石须弥座，前有青石月台与汉白玉栏杆。'),
  43525094: zhuxiangGuan,
  1341826246: R(1341826246, 'S', { ...garden('yingshan', { tile: 'green', edge: 'yellow', nBays: 9, nDepth: 2, ph: 0.5 }) }, '花园最北端，坐北朝南，面阔九间（东五间、西四间），卷棚硬山顶，绿琉璃瓦黄剪边；西四间内有通景画与竹丝编织小戏台。'),
  ...Object.fromEntries(Object.keys(GALLERIES).map((id) => [id, G(id)])),
};

/** 区外值房（灰瓦） */
const OV_OUT = Object.fromEntries([
  40591204, 40591205, 40591207, 40591208, 40591209, 40591211, 40591212, 40591213, 40591214, 40591215, 40591217, 40591218, 40591219, 40591220, 40591221, 40591223,
  40606324, 40606325, 40606326, 40606327, 40606328, 40606329, 40606330, 40606331, 40606332, 40606333, 40606335, 43525067, 43525068,
  40606313, 40606316, 40606317, 40606318, 40606319, 40606320, 40606321, 40606322, 40606323, 42311947, 42311948, 42740573,
].map((id) => [id, auto(GREY)]));

/** 皇极殿院东西：垂花门 + 卡墙（分前后两院） */
function chuihuaWall(x0, x1, z) {
  return (ctx) => {
    const cx = (x0 + x1) / 2;
    buildWallGate(ctx.at(cx, 0, z, 0), { type: 'chuihua', w: 3.8, h: 6.4, tile: 'yellow' });
    buildPalaceWall(ctx, { path: [[x0, z], [cx - 2.1, z]], h: 4.6, thick: 0.9 });
    buildPalaceWall(ctx, { path: [[cx + 2.1, z], [x1, z]], h: 4.6, thick: 0.9 });
  };
}

// ---------------- 宫墙与墙门 ----------------
const OW = { h: 8.0, thick: 2.0, xw: 233.8, xe: 353.9, zn: -431.4, zs: -19.7 };
const GATES = [
  // [名称, x, z, rotY, 类型, 宽, desc]
  ['敛禧门', OW.xe, -48.6, Math.PI / 2, 'liuli', 6.0, '九龙壁院东门，随墙琉璃门。'],
  ['保泰门', OW.xe, -248.7, Math.PI / 2, 'liuli', 5.4, '宁寿宫区东墙门，通东侧夹道。'],
  ['贞顺门', 272.7, OW.zn, Math.PI, 'suiqiang', 4.6, '宁寿宫区北门，门内即珍妃井。'],
  ['蹈和门', OW.xw, -215.8, -Math.PI / 2, 'liuli', 5.4, '宁寿宫区西墙门，通东筒子长街。'],
  ['履顺门', OW.xw, -166.4, -Math.PI / 2, 'liuli', 5.4, '宁寿宫区西墙门，通东筒子长街。'],
  ['锡庆门', OW.xw, -46.6, -Math.PI / 2, 'liuli', 6.0, '九龙壁院西门，宁寿宫区西南入口，随墙琉璃门。'],
];
function buildWalls(ctx, api) {
  // 外围宫墙（东→北→西，U 形）：沿路径长度计算门洞
  const path = [[OW.xe, OW.zs], [OW.xe, OW.zn], [OW.xw, OW.zn], [OW.xw, OW.zs]];
  const L1 = OW.zs - OW.zn, L2 = OW.xe - OW.xw;
  const at = (x, z) => (x === OW.xe ? OW.zs - z : x === OW.xw && z !== OW.zn ? L1 + L2 + (z - OW.zn) : L1 + (OW.xe - x));
  const gaps = GATES.map(([, x, z, , , w]) => { const s = at(x, z); return { from: s - w / 2, to: s + w / 2 }; });
  buildPalaceWall(ctx, { path, h: OW.h, thick: OW.thick, gaps });
  for (const [name, x, z, rot, type, w, desc] of GATES) {
    const r = buildWallGate(ctx.at(x, 0, z, rot), type === 'liuli' ? { type, w, h: 10.5, wallThick: OW.thick, wallH: OW.h, roof: 'xieshan' } : { type, w, h: 8.8, wallThick: OW.thick });
    api.label(name, x, (r?.top ?? 9) + 1, z, desc);
  }
  // 南端围墙（九龙壁院以南）
  buildPalaceWall(ctx, { path: [[OW.xw, OW.zs], [OW.xe, OW.zs]], h: 6.0, thick: 1.3 });
  // 皇极门两翼宫墙
  buildPalaceWall(ctx, { path: [[OW.xw + 1, HJM.wallZ], [HJM.x - 11.85, HJM.wallZ]], h: HJM.wallH, thick: 1.5 });
  buildPalaceWall(ctx, { path: [[HJM.x + 11.85, HJM.wallZ], [OW.xe - 1, HJM.wallZ]], h: HJM.wallH, thick: 1.5 });
  // 宁寿门前院东西院墙（库房夹道）
  buildPalaceWall(ctx, { path: [[252.0, HJM.wallZ - 0.8], [252.0, -130.6]], h: 5.5, thick: 1.2 });
  buildPalaceWall(ctx, { path: [[336.0, HJM.wallZ - 0.8], [336.0, -131.2]], h: 5.5, thick: 1.2 });
  // 西侧小院北墙（截去与庑房重叠段）
  buildPalaceWall(ctx, { path: [[243.0, -237.6], [251.4, -237.6]], h: 4.5, thick: 0.9 });
  // 花园南墙（衍祺门两侧）
  buildPalaceWall(ctx, { path: [[OW.xw + 1, -262.3], [250.5, -262.3]], h: 5.6, thick: 1.4 });
  buildPalaceWall(ctx, { path: [[257.7, -262.3], [282.0, -262.3]], h: 5.6, thick: 1.4 });
}

// ---------------- 树木 ----------------
function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/** 在多边形内按网格（带抖动）植树，avoid=[[x0,x1,z0,z1]] 避让区 */
function plant(ctx, poly, step, kinds, avoid = [], margin = 2.0) {
  const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
  let n = 0;
  for (let x = Math.min(...xs) + margin; x <= Math.max(...xs) - margin; x += step) {
    for (let z = Math.min(...zs) + margin; z <= Math.max(...zs) - margin; z += step) {
      const h = Math.abs(Math.sin(x * 7.13 + z * 3.71) * 1000) % 1;
      const px = x + (h - 0.5) * step * 0.4, pz = z + (((h * 7.3) % 1) - 0.5) * step * 0.4;
      if (!pip(px, pz, poly)) continue;
      const near = (q) => Math.min(...poly.map((a, i) => { const b = poly[(i + 1) % poly.length]; const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / L2)); return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dz); }));
      if (near([px, pz]) < margin) continue;
      if (avoid.some(([a, b, c, d]) => px > a && px < b && pz > c && pz < d)) continue;
      tree(ctx, kinds[n++ % kinds.length], px, pz);
    }
  }
}
function buildTrees(ctx, api) {
  const green = (id) => api.site.green.find((g) => g.id === id)?.poly;
  // 九龙壁院、宁寿门前院：古柏为主，间以油松
  for (const [id, step] of [[41662006, 7], [41662009, 7], [41662007, 7], [41662008, 7], [41662010, 7], [41662976, 7.5], [41662977, 7.5]]) {
    const P = green(id);
    if (P) plant(ctx, P, step, ['cypress', 'cypress', 'pine'], [[279, 311, -40, -30], [289, 298, -130, -60]], 2.2);
  }
  // 东路庆寿堂、寻沿书屋院落：国槐
  for (const [x, z] of [[328.5, -322.0], [341.0, -322.5], [327.0, -362.5], [342.5, -362.5], [329.0, -390.5]]) tree(ctx, 'locust', x, z, 13);
  // 乐寿堂前院：古松
  for (const [x, z] of [[281.0, -320.0], [306.5, -320.0]]) tree(ctx, 'pine', x, z, 10);
}

export default {
  key: 'ningshou',
  title: '宁寿宫区',
  // 未列出的建筑：自动推断（经修正上下文建造）
  overrides: new Proxy({ ...OV_OUT, ...OV_AXIS, ...OV_EAST, ...OV_GARDEN }, { get: (t, k) => (k in t ? t[k] : /^\d+$/.test(String(k)) ? AUTO : undefined) }),
  wallOverrides: {
    // 外围宫墙、皇极门两翼、库房夹道墙、与庑房/阅是楼后檐重叠的墙：由 build 重建或省略
    43525078: 'skip', 41657461: 'skip', 1341876198: 'skip', 1341826224: 'skip', 41662000: 'skip', 41662011: 'skip', 41662012: 'skip',
    42681351: 'skip', 42681353: 'skip', 42681421: 'skip', 42681392: 'skip', 1341826220: 'skip',
    42681355: Y45, 42681360: Y45, 42681376: Y45, 42681378: Y45, 42681379: Y45, 42681380: Y45, 42681383: Y45, 42681384: Y45,
    42681387: Y45, 42681403: Y45, 42681402: Y45, 42681404: Y45, 42681405: Y45, 650022325: Y45, 42681419: Y45,
    42681415: { h: 5.5 }, 42681390: { h: 4 }, 42681414: { h: 4 }, 650020280: { h: 4 }, 650020281: { h: 4 }, 650020282: { h: 4 },
  },
  bridgeOverrides: {},
  build(ctx, api) {
    // 九龙壁（皇极门外正南，背倚宫墙，面北）
    const jx = 294.75, jz = -34.9;
    const j = buildJiulongbi(ctx.at(jx, 0, jz, Math.PI));
    api.label('九龙壁', jx, j.top + 1.5, jz, '乾隆三十七年（1772）烧造的单面琉璃影壁，背倚宫墙，长 29.4 米、高 3.5 米。黄琉璃庑殿顶，汉白玉须弥座；壁面以 270 块琉璃构件拼成，九条蟠龙高浮雕于蓝绿云水之间，中为黄色正龙。');
    buildWalls(ctx, api);
    buildAxis(ctx, api);
    buildGarden(ctx, api);
    buildTrees(ctx, api);
    // 未命名 OSM 建筑的标签
    for (const [n, x, y, z, d] of [
      ['旭辉庭', 238.7, 10, -300.7, '花园第一进西侧，建于堆山之上，坐西面东以迎朝阳，面阔三间，卷棚歇山顶，黄琉璃瓦绿剪边；南侧接爬山游廊。'],
      ['凝祺门', 332.0, 12, -166.8, '皇极殿院东庑正中的门殿，通东侧夹道。'],
      ['昌泽门', 255.2, 12, -166.4, '皇极殿院西庑正中的门殿，与履顺门相对，通东筒子长街。'],
    ]) api.label(n, x, y, z, d);
  },
};
