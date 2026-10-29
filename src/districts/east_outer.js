// 分区：东路南部（文华殿、文渊阁、传心殿、南三所、箭亭、东南库房区、东华门内）
// 东华门门楼本身由 walls 分区建造；本分区负责其内侧区域。
import { SITE } from '../site/auto.js';
import { buildWallGate, buildScreenWall } from '../core/walls.js';
import { buildBridge } from '../core/props.js';
import { buildRailing } from '../core/platform.js';
import { buildRockery, buildLawn } from '../core/nature.js';
import { prismGeo } from '../core/geom.js';
import { H, house, B, FACE, pip, clipX, paveStrip, clearAt, scatter, along, tree, riverRailings, rand, hallsFn, patchFn, safeCtx, gapsUnderBuildings } from './east_outer/util.js';
import { wenhuaDian, wenyuanGe, kuiTing, jianTing, jiulongBi, brickStore, wellPavilion, weiFang } from './east_outer/special.js';

const DESC = {
  wenhua: '明初始建，清康熙二十二年（1683）重建。明清两代每岁春秋仲月于此举行经筵，殿试阅卷亦在此。前殿面阔五间、进深三间，黄琉璃瓦单檐歇山顶，前出月台，后以穿廊连主敬殿成“工”字殿。',
  zhujing: '文华殿后殿，规制与前殿略似而进深稍浅，与文华殿以穿廊相连。',
  wenhuamen: '文华殿院正门，面阔五间，黄琉璃瓦单檐歇山顶，前出三陛。',
  benren: '文华殿东配殿，面阔五间，前出廊，黄琉璃瓦单檐歇山顶。',
  jiyi: '文华殿西配殿，面阔五间，前出廊，黄琉璃瓦单檐歇山顶。',
  wenyuan: '清乾隆四十一年（1776）仿宁波天一阁建成，专贮《四库全书》。外观两层、腰檐内设暗层实为三层，面阔六间（西尽间为楼梯间）；黑琉璃瓦绿剪边歇山顶（黑色主水以压火），前廊绿柱，苏式彩画；阁前方池石桥，阁后湖石假山。',
  beiting: '文渊阁东侧碑亭，盔顶黄琉璃瓦，亭内石碑正面刻乾隆《文渊阁记》，背面刻文渊阁赐宴御制诗。',
  chuanxin: '清康熙二十四年（1685）建，祭祀伏羲、神农、轩辕、尧、舜、禹、汤、文王、武王，周公、孔子配祀；举行经筵前于此遣官祭告。殿面阔五间，黄琉璃瓦硬山顶。',
  jinghang: '传心殿院门，治牲所与传心殿之间。',
  zhisheng: '传心殿院南端，祭祀前宰治牺牲之所。',
  dapao: '传心殿东侧大庖井，井上覆盝顶井亭（顶心露天）；相传其水甘洌，为宫中名井。',
  jianting: '清雍正年间建，皇帝及皇子习射、阅射之所。面阔五间、进深三间，四周出廊，黄琉璃瓦单檐歇山顶；亭前为开阔的骑射场地。',
  nansan: '南三所（撷芳殿）建于清乾隆十一年（1746），为皇子居所。东、中、西三所并列，各为三进院落，前设琉璃门；取东方属木主生长之意，屋顶覆绿琉璃瓦。',
  suo: '南三所之一所前殿（穿堂），面阔三间，绿琉璃瓦硬山顶。',
  yuchashan: '清代御茶膳房，掌皇帝日常饮食与宫中筵宴茶膳，位于箭亭以东。',
  shangsi: '上驷院，清内务府所属，掌御用马匹。',
  neige: '清代内阁大堂，大学士办事、票拟批本之所，位于紫禁城东南隅。',
  hongben: '内阁大库之西库，两层砖石结构库房，铁板窗，黄琉璃瓦硬山顶，收贮红本（经朱批的题本）等档案。',
  shilu: '内阁大库之东库，两层砖石结构库房，铁板窗，黄琉璃瓦硬山顶，收贮历朝实录、圣训等。',
  luanjia: '銮仪卫存放皇帝卤簿仪仗（銮驾）的库房，砖石结构，黄琉璃瓦硬山顶。',
  jiulong: '清乾隆三十八年（1773）改建宁寿宫时烧造，长29.4米、高3.5米，由琉璃构件拼塑九条蟠龙，正中为黄龙；背倚宫墙，正对皇极门。',
  qiao: '东华门内石桥，跨内金水河，为东华门入宫的通道。',
};

// ---------------- 南三所（绿琉璃瓦） ----------------
const G = 'green';
const NS_EAST = [42684281, 42684280, 42684278, 42684255, 42684270, 42684271, 42684266, 42684269, 42684244, 42684261, 42684250, 42684248, 42684251, 42684258, 42684259, 42684260, 42684246, 42684304, 42684303, 42684253, 42684285, 42684301, 42684287, 42684296];
const NS_WEST = [42684282, 42684283, 42684277, 42684249, 42684252, 42684275, 42684265, 42684272, 42684245, 42684306, 42684305, 42684254, 42684284, 42684289, 42684288, 42684291, 42684239, 42684238, 42684230, 42684231, 42684232, 42684236, 42684237, 42684235];
function nansan() {
  const o = {};
  for (const [ids, face] of [[NS_EAST, 'E'], [NS_WEST, 'W']]) for (const id of ids) {
    const deep = Math.min(B(id).obb.sx, B(id).obb.sz) > 4.6;
    o[id] = house(id, face, G, { colH: deep ? 3.0 : 2.6, platform: { h: deep ? 0.45 : 0.35 }, nBays: deep ? 3 : undefined });
  }
  const qian = { grade: 4, tile: G, nBays: 3, colH: 3.7, caihua: 'xuanzi', roof: { type: 'yingshan', gableWallMat: 'wall_red' }, platform: { h: 0.7 }, front: ['window', 'door', 'window'], back: ['window', 'door', 'window'] };
  o[42684274] = H(42684274, 'S', qian, { desc: DESC.suo });
  o[42684294] = H(42684294, 'S', qian, { desc: DESC.suo });
  o[40544916] = H(40544916, 'S', qian, { desc: DESC.suo });
  const zhong = { grade: 4, tile: G, nBays: 5, nDepth: 3, colH: 4.0, corridor: 1.4, plaqueCharH: 0.22, caihua: 'xuanzi', roof: { type: 'yingshan', gableWallMat: 'wall_red' }, platform: { h: 0.85 },
    front: ['window', 'window', 'door', 'window', 'window'], back: ['wall', 'window', 'door', 'window', 'wall'] };
  o[42684276] = H(42684276, 'S', zhong);
  o[42684247] = H(42684247, 'S', { ...zhong, plaque: '撷芳殿' }, { desc: DESC.nansan });
  o[42684302] = H(42684302, 'S', zhong);
  const hou = { grade: 4, tile: G, nBays: 5, colH: 3.5, caihua: 'xuanzi', roof: { type: 'yingshan', gableWallMat: 'wall_red' }, platform: { h: 0.6 } };
  for (const id of [40544904, 42684242, 42684243]) o[id] = H(id, 'S', hou);
  for (const id of [40545342, 42684309, 42684307, 42684311, 42684308, 42684312]) o[id] = house(id, 'S', G, { colH: 2.8, platform: { h: 0.4 } });
  o[40544895] = house(40544895, 'E', G, { colH: 3.0 });
  o[40544880] = house(40544880, 'W', G, { colH: 3.0 });
  o[40544894] = house(40544894, 'N', G, { colH: 3.2, grade: 4 });
  o[419838290] = house(419838290, 'N', G, { colH: 3.2, grade: 4 });
  o[40544875] = H(40544875, 'S', { kind: 'gate', grade: 4, tile: G, nBays: 3, nDepth: 2, colH: 4.2, gateDoors: 1, dougong: { kou: 0.05, cai: 1 }, caihua: 'xuanzi',
    roof: { type: 'xieshan' }, platform: { h: 0.75 } }, { desc: '南三所正门，三间宫门，绿琉璃瓦歇山顶。' });
  // 南三所琉璃门位置的 OSM 小块（门洞）：改由 build() 中的琉璃门建造
  for (const id of [42684273, 42684293, 42684297]) o[id] = 'skip';
  return o;
}

// ---------------- 文华殿院、传心殿院、文渊阁 ----------------
function wenhua() {
  return {
    43519304: (ctx, b, api) => wenhuaDian(safeCtx(ctx), b, api, DESC),
    40478705: H(40478705, 'S', {
      kind: 'gate', grade: 3, nBays: 5, nDepth: 2, colH: 5.4, dougong: { kou: 0.075, cai: 3 }, caihua: 'hexi', gateDoors: 3, plaque: '文华门', plaqueCharH: 0.36,
      roof: { type: 'xieshan', beasts: 5 },
      platform: { h: 1.25, style: 'stone', stairs: [{ side: 'S', w: 4.6, yulu: { w: 1.6 } }, { side: 'S', x: -7.4, w: 2.8 }, { side: 'S', x: 6.4, w: 2.8 }, { side: 'N', w: 4.6 }] },
    }, { desc: DESC.wenhuamen }),
    41657453: H(41657453, 'W', { grade: 4, nBays: 5, nDepth: 3, colH: 4.6, corridor: 1.5, plaqueCharH: 0.3, dougong: { kou: 0.06, cai: 3 }, caihua: 'xuanzi', roof: { type: 'xieshan', beasts: 5 }, platform: { h: 0.9, style: 'stone' }, plaque: '本仁殿' }, { desc: DESC.benren }),
    40478701: H(40478701, 'E', { grade: 4, nBays: 5, nDepth: 3, colH: 4.6, corridor: 1.5, plaqueCharH: 0.3, dougong: { kou: 0.06, cai: 3 }, caihua: 'xuanzi', roof: { type: 'xieshan', beasts: 5 }, platform: { h: 0.9, style: 'stone' }, plaque: '集义殿' }, { desc: DESC.jiyi }),
    40478704: (ctx, b, api) => wenyuanGe(safeCtx(ctx), b, api, DESC.wenyuan),
    40585915: (ctx, b, api) => kuiTing(safeCtx(ctx), b, api, DESC.beiting),
    // 传心殿院（自南而北：治牲所 → 景行门 → 传心殿 → 祝版房、神厨、值房）
    40478706: house(40478706, 'N', 'yellow', { grade: 4, nBays: 5, colH: 3.6, platform: { h: 0.5 } }, { desc: DESC.zhisheng, noLabel: true }),
    40478707: H(40478707, 'S', { kind: 'gate', grade: 4, nBays: 3, nDepth: 2, colH: 4.2, gateDoors: 1, dougong: { kou: 0.05, cai: 1 }, caihua: 'xuanzi', roof: { type: 'xieshan', beasts: 3 }, platform: { h: 0.7 }, plaque: '景行门', plaqueCharH: 0.28 }),
    40478703: H(40478703, 'S', { grade: 4, nBays: 5, nDepth: 3, colH: 4.4, corridor: 1.5, plaqueCharH: 0.28, dougong: { kou: 0.055, cai: 1 }, caihua: 'xuanzi', roof: { type: 'yingshan', gableWallMat: 'wall_red', beasts: 3 }, platform: { h: 0.9, style: 'stone' }, plaque: '传心殿' }, { desc: DESC.chuanxin }),
    40478710: house(40478710, 'N', 'yellow', { colH: 3.2 }),
    40478709: hallsFn([
      { x: 236.1, z: 265.8, rotY: FACE.N, eaveW: 13.1, eaveD: 7.4, grade: 5, tile: 'yellow', colH: 3.2, roof: { type: 'yingshan', gableWallMat: 'wall_red' } },
      { x: 239.4, z: 259.9, rotY: FACE.W, eaveW: 4.6, eaveD: 6.6, grade: 5, tile: 'yellow', colH: 2.8, roof: { type: 'yingshan', gableWallMat: 'wall_red' } },
    ]),
    40585916: house(40585916, 'E', 'yellow', { colH: 3.0 }),
    40585920: house(40585920, 'S', 'yellow', { colH: 2.8 }),
    653252118: (ctx, b, api) => wellPavilion(safeCtx(ctx), b, api, '大庖井', DESC.dapao),
    // 文渊阁院东墙内长廊值房
    642566537: house(642566537, 'E', 'yellow', { x: 219.4, eaveD: 4.4, colH: 2.9 }),
  };
}

// ---------------- 箭亭、御茶膳房一带 ----------------
function jianting() {
  const y = 'yellow', g = 'grey';
  return {
    40544223: (ctx, b, api) => jianTing(safeCtx(ctx), b, api, DESC.jianting),
    40544887: house(40544887, 'E', y, { grade: 4, colH: 4.0, corridor: 1.5, platform: { h: 0.6 } }, { desc: DESC.yuchashan }),
    40544888: house(40544888, 'E', y, { grade: 4, colH: 3.8, platform: { h: 0.5 } }),
    40544889: house(40544889, 'W', y, { grade: 4, colH: 3.6 }),
    40544890: house(40544890, 'W', y, { grade: 4, colH: 3.6 }),
    40544892: house(40544892, 'W', y, { colH: 3.2 }),
    40548197: house(40548197, 'W', y, { colH: 3.0 }),
    654664220: house(654664220, 'S', g, { colH: 2.8 }),
    654664221: house(654664221, 'S', g, { colH: 2.8 }),
    654664222: house(654664222, 'E', g, { colH: 2.8 }),
    654664223: house(654664223, 'S', g, { colH: 2.6 }),
    654664224: house(654664224, 'W', g, { colH: 2.8 }),
    654664225: patchFn({ tile: g, grade: 5, roof: { type: 'yingshan', gableWallMat: 'brick_grey' } }),
    654664226: patchFn({ tile: g, grade: 5, roof: { type: 'yingshan', gableWallMat: 'brick_grey' } }),
    654664352: house(654664352, 'N', y, { colH: 3.2 }),
    654664353: house(654664353, 'W', y, { colH: 3.0 }),
    // 南三所北侧库房两排
    40544915: house(40544915, 'S', y, { colH: 3.0 }),
    42684310: house(42684310, 'S', y, { colH: 3.0 }),
    40544905: house(40544905, 'S', y, { colH: 3.0 }),
    40591186: house(40591186, 'S', y, { grade: 4, colH: 3.6, platform: { h: 0.5 } }),
    40591188: house(40591188, 'S', y, { grade: 4, colH: 3.9, platform: { h: 0.5 } }),
    40591187: house(40591187, 'S', y, { grade: 4, colH: 3.6, platform: { h: 0.5 } }),
  };
}

// ---------------- 文渊阁北（上驷院一带）与东华门内北侧服务区 ----------------
function service() {
  const y = 'yellow', g = 'grey';
  return {
    40544226: house(40544226, 'W', y, { grade: 4, colH: 3.8, platform: { h: 0.5 } }, { desc: DESC.shangsi }),
    40544224: house(40544224, 'W', y, { grade: 4, colH: 3.6 }),
    40544225: house(40544225, 'S', y, { colH: 3.2 }),
    40544227: house(40544227, 'W', y, { grade: 4, colH: 3.6 }),
    40544228: house(40544228, 'S', y, { colH: 3.0 }),
    40544229: house(40544229, 'S', y, { colH: 2.8 }),
    40544230: house(40544230, 'E', y, { colH: 3.0 }),
    40544231: house(40544231, 'N', y, { colH: 2.8 }),
    40544232: house(40544232, 'N', y, { colH: 3.0 }),
    40544233: house(40544233, 'N', y, { colH: 3.0 }),
    649255318: house(649255318, 'N', y, { grade: 4, colH: 3.4 }),
    649255320: house(649255320, 'S', y, { grade: 4, colH: 3.4 }),
    653251438: house(653251438, 'W', y, { grade: 4, colH: 3.4 }),
    40544234: house(40544234, 'W', g, { colH: 2.9 }),
    40544235: house(40544235, 'S', g, { colH: 3.0 }),
    40544236: house(40544236, 'N', g, { colH: 3.0 }),
    40544237: house(40544237, 'S', g, { colH: 2.8 }),
    40544239: house(40544239, 'S', g, { colH: 2.8 }),
    40544240: house(40544240, 'S', g, { colH: 2.9 }),
    40544874: house(40544874, 'W', g, { colH: 3.2 }),
    419838308: house(419838308, 'W', g, { colH: 3.0 }),
    419838326: hallsFn([
      { x: 344.8, z: 182.7, rotY: FACE.N, eaveW: 23.6, eaveD: 4.8, grade: 5, tile: g, colH: 2.8, roof: { type: 'yingshan', gableWallMat: 'brick_grey' } },
      { x: 353.4, z: 177.9, rotY: FACE.W, eaveW: 4.6, eaveD: 6.6, grade: 5, tile: g, colH: 2.6, roof: { type: 'yingshan', gableWallMat: 'brick_grey' } },
    ]),
    649255114: house(649255114, 'W', y, { grade: 4, colH: 3.4 }),
    // 三座门：由 build() 以琉璃门建造；墙端小块不单独成房
    42681366: 'skip', 42681367: 'skip', 42681368: 'skip', 42681373: 'skip', 42681375: 'skip',
    // 东华门内
    40478700: house(40478700, 'W', y, { grade: 4, colH: 4.0, corridor: 1.6, platform: { h: 0.6 } }, { noLabel: true }),
    40585918: house(40585918, 'S', y, { grade: 4, colH: 3.4 }),
    40585919: house(40585919, 'S', y, { colH: 3.0 }),
    40585917: house(40585917, 'N', y, { grade: 4, colH: 3.4 }),
    // 南三所以东
    40544906: house(40544906, 'S', y, { grade: 4, colH: 3.6, platform: { h: 0.5 } }),
    40544907: house(40544907, 'S', y, { grade: 4, colH: 3.6, platform: { h: 0.5 } }),
    40544908: house(40544908, 'S', y, { grade: 4, colH: 3.6, platform: { h: 0.5 } }),
    40544878: house(40544878, 'S', y, { colH: 3.0 }),
    40544879: house(40544879, 'N', y, { colH: 3.0 }),
    // 筒子河内岸围房（城墙外）
    42740564: (ctx, b) => weiFang(safeCtx(ctx), b, 'W', 6),
    42740565: house(42740565, 'W', g, { colH: 2.8, roof: { type: 'yingshan', juan: true, gableWallMat: 'brick_grey' } }),
  };
}

// ---------------- 东南隅：内阁、内阁大库、銮驾库 ----------------
function neige() {
  const y = 'yellow';
  const store = (face, desc, o = {}) => (ctx, b, api) => {
    const r = brickStore(safeCtx(ctx), b, face, o);
    if (b.tags.name) api.label(b.tags.name, b.obb.cx, r.topY + 1.5, b.obb.cz, desc || '');
  };
  return {
    40478520: store('S', DESC.hongben),
    40478521: store('S', DESC.shilu),
    40478517: store('N', DESC.luanjia),
    40478524: store('N', ''),
    40478518: store('W', '', { bay: 4.0 }),
    40478527: H(40478527, 'S', { grade: 4, nBays: 3, colH: 4.0, corridor: 1.5, caihua: 'xuanzi', tile: y, roof: { type: 'yingshan', gableWallMat: 'wall_red' }, platform: { h: 0.7 } }, { desc: DESC.neige }),
    40478528: house(40478528, 'S', y, { colH: 3.0 }),
    40478530: house(40478530, 'S', y, { colH: 3.0 }),
    40478529: house(40478529, 'S', y, { colH: 3.0 }),
    40478526: house(40478526, 'E', y, { grade: 4, colH: 3.2 }),
    40478525: house(40478525, 'W', y, { grade: 4, colH: 3.2 }),
    40478523: house(40478523, 'N', y, { grade: 4, colH: 3.6 }),
    40478519: house(40478519, 'N', y, { grade: 4, colH: 3.8, platform: { h: 0.5 } }),
    40478522: house(40478522, 'S', y, { colH: 3.0 }),
  };
}

// ---------------- 墙 ----------------
const WALLS = (() => {
  const o = {};
  for (const id of [42684227, 42684228, 42684313]) o[id] = { h: 5.4 };
  for (const id of [42684229, 42684233, 42684234, 42684256, 42684257, 42684262, 42684263, 42684264, 42684267, 42684268, 42684279, 42684292]) o[id] = { h: 4.3, cap: 'green' };
  for (const id of [1341826248, 42681358, 42681371, 42681374, 653251437, 42681350]) o[id] = { h: 4.8 };
  for (const id of [653252461, 654664219, 654664351, 42681361, 42681362]) o[id] = { h: 3.8 };
  // 南三所所间夹墙、御茶膳房东墙：以两侧房屋后檐墙代墙，只在房间空当砌墙
  for (const id of [42684240, 42684241]) o[id] = { h: 4.3, cap: 'green', gaps: gapsUnderBuildings(id, 0.5) };
  o[42681372] = { h: 4.8, gaps: gapsUnderBuildings(42681372, 0.5) };
  o[41657447] = { h: 5.6 };
  o[41657454] = { h: 5.0, gaps: [{ from: 48.4, to: 52.0 }] };
  o[42681365] = { h: 4.6, gaps: [{ from: 48.4, to: 52.0 }] };
  o[42681363] = { h: 4.4, gaps: [{ from: 4.9, to: 8.3 }] };
  o[42681364] = { h: 4.4, gaps: [{ from: 5.0, to: 8.4 }] };
  o[41657455] = { h: 5.6 };
  o[41661988] = { h: 5.6 };
  o[42681369] = 'skip'; o[42681370] = 'skip';
  o[41661995] = 'skip'; // 九龙壁：build() 中专门建造
  o[43519305] = 'skip'; // 影壁：build() 中建造
  return o;
})();

/** 墙上门：在 world 坐标沿墙中线的位置 */
function wallGates(ctx) {
  // 南三所三座琉璃门（绿琉璃）
  for (const x of [250.25, 284.55, 318.3]) buildWallGate(ctx.at(x, 0, 73.75), { type: 'liuli', w: 4.3, h: 6.2, wallThick: 0.9, tile: 'green', wallH: 4.3 });
  // 东华门内北侧三座门（三洞琉璃门，金水河三桥之北）
  buildWallGate(ctx.at(284.15, 0, 235.3), { type: 'liuli', openings: 3, w: 19.3, h: 7.4, wallThick: 1.1, tile: 'yellow', wallH: 5.6 });
  // 随墙门：文华殿院 ↔ 文渊阁院（两侧），文华殿院 ↔ 夹道 ↔ 传心殿院
  buildWallGate(ctx.at(161.4, 0, 265.35), { type: 'suiqiang', w: 3.4, h: 5.6, wallThick: 0.9, tile: 'yellow' });
  buildWallGate(ctx.at(210.6, 0, 262.85), { type: 'suiqiang', w: 3.4, h: 5.6, wallThick: 0.9, tile: 'yellow' });
  buildWallGate(ctx.at(216.55, 0, 286, Math.PI / 2), { type: 'suiqiang', w: 3.6, h: 6.0, wallThick: 0.9, tile: 'yellow' });
  buildWallGate(ctx.at(219.72, 0, 286, Math.PI / 2), { type: 'suiqiang', w: 3.6, h: 5.6, wallThick: 0.9, tile: 'yellow' });
}

// ---------------- 绿地与树木 ----------------
const TREE_BUDGET = { n: 0 };
function plant(ctx, kind, x, z, h, r) { tree(ctx, kind, x, z, h, r); TREE_BUDGET.n++; }

function greenery(ctx) {
  const inDistrict = (P) => { const c = P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length], [0, 0]); return c[0] > 128 && c[1] > -40 && c[1] < 482 && c[0] < 381; };
  const waters = SITE.water.filter((w) => w.id !== 4845030).map((w) => w.poly);
  for (const g of SITE.green) {
    const t = g.tags;
    if (t.leisure === 'sports_centre' || !inDistrict(g.poly)) continue;
    let P = clipX(g.poly, 128.5);
    if (P.length < 3) continue;
    const wood = t.natural === 'wood' || t.landuse === 'forest';
    const garden = t.leisure === 'garden';
    // 草地（与水面重叠的园地改用网格填充，去除水面部分）
    const holes = waters.filter((w) => w.some(([x, z]) => pip(x, z, P)) || P.some(([x, z]) => pip(x, z, w)));
    buildLawn(ctx, { poly: holes.length ? { outer: P, holes } : P, y: 0.03 });
    if (g.id === 655912175 || g.id === 655912176) continue; // 文华殿前花坛：只铺草
    const spacing = wood ? 10.5 : garden ? 12 : 17;
    const pts = scatter(P, spacing, g.id % 9973, (x, z) => clearAt(x, z, { b: 3.6 }));
    for (const [x, z, r] of pts) {
      const kind = r < 0.62 ? 'locust' : r < 0.86 ? 'cypress' : r < 0.95 ? 'elm' : 'pine';
      const h = { locust: 14, cypress: 11, elm: 13, pine: 10 }[kind];
      plant(ctx, kind, x, z, h, r);
    }
  }
  // OSM 行道树（院内柏树、甬路旁槐树）
  for (const row of SITE.treeRows) {
    const P = row.pts;
    if (!P.some(([x, z]) => x > 128.5 && z > -40 && z < 470 && x < 376)) continue;
    const court = P.every(([x, z]) => x > 150 && x < 220 && z > 195 && z < 300); // 文华殿、文渊阁院内
    const pts = along(P, court ? 7.5 : 9, court ? 3 : 4.5);
    const R = rand(row.id % 7919);
    for (const [x, z] of pts) {
      if (x < 128.5 || z > 470 || x > 376) continue;
      if (!clearAt(x, z, { b: 2.4, path: 0.9, wall: 1.4 })) continue;
      if (court && z < 212 && x > 162 && x < 211) continue; // 假山带另植
      const r = R();
      if (court) plant(ctx, r < 0.7 ? 'cypress' : 'pine', x, z, 9.5, r);
      else plant(ctx, r < 0.75 ? 'locust' : 'cypress', x, z, 13, r);
    }
  }
  // 文渊阁：阁后假山植松柏，阁东西两侧古柏
  const R = rand(4242);
  for (const [x, z] of [[164, 203.5], [174, 202.6], [199, 202.8], [208, 203.4], [214.5, 211], [158.5, 214], [158.5, 228], [158.5, 241]]) plant(ctx, R() < 0.5 ? 'pine' : 'cypress', x, z, 9 + R() * 2, R());
  // 南三所各院：中院槐树一对
  for (const cx of [250.6, 284.7, 318.4]) for (const s of [-1, 1]) plant(ctx, 'locust', cx + s * 7.2, 36, 12, R());
  // 东华门外：城墙与筒子河之间
  for (const [x, z] of along([[388.5, -38], [388.5, 158]], 11, 2)) plant(ctx, R() < 0.6 ? 'willow' : 'locust', x + (R() - 0.5) * 2, z, 11, R());
}

// ---------------- 河岸石栏、桥、甬路 ----------------
function waterworks(ctx, api) {
  // 内金水河东段与文渊阁前方池
  for (const w of SITE.water) {
    if (![685378539, 685378546, 685378547, 685378549].includes(w.id)) continue;
    riverRailings(ctx, w.poly, { minX: 128.5, height: 1.0, off: 0.42 });
  }
  // 文渊阁前方池：池周石栏（石桥处断开），池上石桥
  const pond = [[173.7, 240.6], [204.4, 240.7], [204.4, 249.0], [173.6, 248.9]].map(([x, z], i) => [x + (i === 0 || i === 3 ? -0.45 : 0.45), z + (i < 2 ? -0.45 : 0.45)]);
  buildRailing(ctx, { path: pond, closed: true, y: 0, style: 'marble_lotus', height: 1.0, gaps: [{ at: [189.2, 240.15], w: 6.6, end: 'drum' }, { at: [189.2, 249.45], w: 6.6, end: 'drum' }] });
  buildBridge(ctx.at(189.2, 0, 244.8), { length: 11.6, width: 5.2, archH: 0.75, waterY: api.waterY, style: 'marble' });
  // 东华门外筒子河上的平桥：石砌桥身、条石桥面、两侧青白石栏杆
  const deck = [[397.2, 323.4], [450.2, 323.4], [450.2, 367.1], [397.2, 367.1]];
  ctx.add('stone_grey', prismGeo(deck, api.waterY - 0.6, -0.02, { top: false }));
  ctx.add('paving', prismGeo(deck.map(([x, z], i) => [x + (i === 0 || i === 3 ? 0.2 : -0.2), z + (i < 2 ? 0.2 : -0.2)]), -0.02, 0.06));
  for (const z of [324.0, 366.5]) buildRailing(ctx, { path: [[397.8, z], [449.6, z]], y: 0.06, style: 'stone', height: 1.1, ends: 'drum' });
  api.label('东华门内石桥', 309.3, 3.5, 346, DESC.qiao);
}

function paving(ctx) {
  // 文华门—文华殿月台甬路（中路御道）
  paveStrip(ctx, [[185.8, 305.2], [185.8, 327.4]], 4.6);
  paveStrip(ctx, [[185.8, 350.4], [185.8, 357]], 4.6);
  // 文华门南、东华门—协和门一线
  paveStrip(ctx, [[185.8, 357], [256, 357], [263, 348.5], [282, 344.6], [300.6, 344.6]], 4.2, 0.05);
  paveStrip(ctx, [[318, 344.6], [356, 344.6]], 8.0, 0.05);
  // 金水河三桥 — 三座门 — 南三所（经影壁）
  paveStrip(ctx, [[282.6, 344.6], [283.4, 268.4]], 4.2, 0.05);
  paveStrip(ctx, [[284.15, 233], [284.15, 149.5]], 5.0, 0.05);
  paveStrip(ctx, [[284.6, 141.5], [285.2, 96.8]], 5.0, 0.05);
  // 南三所各所中轴
  for (const x of [250.3, 284.6, 318.3]) { paveStrip(ctx, [[x, 72.5], [x, 55.4]], 2.6, 0.05); paveStrip(ctx, [[x, 44.8], [x, 25.2]], 2.6, 0.05); paveStrip(ctx, [[x, 14.8], [x, 2.6]], 2.6, 0.05); }
  // 箭亭南甬路
  paveStrip(ctx, [[154.8, 19.6], [155, 145]], 4.0, 0.05);
  // 文渊阁：桥北至阁前、主敬殿北至池南
  paveStrip(ctx, [[189.2, 231.2], [189.2, 238.5]], 3.6, 0.05);
  paveStrip(ctx, [[189.2, 251.0], [189.2, 251.7]], 3.6, 0.05);
}

export default {
  key: 'east_outer',
  title: '东路南部（文华殿、文渊阁、南三所、箭亭、东华门内）',
  overrides: { ...nansan(), ...wenhua(), ...jianting(), ...service(), ...neige() },
  wallOverrides: WALLS,
  bridgeOverrides: { 685378542: 'skip', 1031650605: 'skip' },
  build(ctx0, api) {
    const ctx = safeCtx(ctx0);
    jiulongBi(ctx, api, DESC.jiulong);
    // 南三所北门外影壁（三座门与南三所正门之间，朝南）
    buildScreenWall(ctx.at(285.15, 0, 146.05), { w: 18.6, h: 4.6, thick: 1.0, style: 'liuli', tile: 'green' });
    wallGates(ctx);
    // 文渊阁后湖石假山（形如屏障）
    buildRockery(ctx.at(186, 0, 206.6), { w: 40, d: 7.2, h: 4.2, seed: 11, style: 'taihu', steps: false });
    waterworks(ctx, api);
    paving(ctx);
    greenery(ctx);
    console.info('east_outer trees', TREE_BUDGET.n);
  },
};
