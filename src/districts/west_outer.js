// 分区：西路南部（武英殿、西华门内、南薰殿、南大库、宝蕴楼、屏风楼、慈宁宫花园南部、造办处一带）
// 坐标以 OSM 屋檐轮廓为准；形制据《故宫志》、维基等资料（见各 desc）。
import { buildPalaceWall, buildWallGate } from '../core/walls.js';
import { buildRailing } from '../core/platform.js';
import { prismGeo } from '../core/geom.js';
import {
  S, N, E, W, Y, G, fang, onObb, onRect, withDesc, paveStrip, scatter, pip, distToPolyline, rng, fixCtx, fixOverrides,
} from './west_outer/lib.js';
import { wuyingHalls, buildWuyingBase, WUYING_DESC, wuyingGate, wuyingBridges, buildBath, buildBathPorch, wellCurb } from './west_outer/wuying.js';
import {
  buildBaoyun, screenTower, stairHouse, buildLinxiPond, linxiPavilion, LINXI_DESC, buildDuanhong, smallBridge,
} from './west_outer/special.js';

// ---------------- 规格简写 ----------------
/** 黄瓦小式房 */
const yf = (id, rotY, o = {}) => onObb(id, rotY, fang(o));
/** 灰瓦小式房（青砖墙） */
const gf = (id, rotY, o = {}) => onObb(id, rotY, fang({ tile: G, ...o }));
/** 武英殿东西配殿：五间黄琉璃瓦单檐悬山，正间前出廊 */
const peidian = (id, rotY) => onObb(id, rotY, {
  ...fang({ grade: 4, roofType: 'xuanshan', ph: 0.75 }), nBays: 5, nDepth: 3, corridor: 1.7, backCorridor: false, colH: 4.4,
  dougong: { kou: 0.06, cai: 1 }, caihua: 'xuanzi', roof: { type: 'xuanshan', beasts: 3 },
});
/** 屏风楼（函数覆盖） */
const screen = (rotY, extra) => (ctx, b, api) => {
  const o = b.obb;
  const top = screenTower(fixCtx(ctx), [o.cx - o.sx / 2, o.cx + o.sx / 2, o.cz - o.sz / 2, o.cz + o.sz / 2], rotY);
  if (extra) extra(ctx, api, top);
};
/** 去掉 OSM 占位名（“小房N”）的标注 */
const nl = (arr) => Object.assign(arr, { noLabel: true });
const SCREEN_DESC = '屏风楼：1973—1975 年沿紫禁城西墙内侧所建的仿古高楼（下为约 10m 高台，上为重檐楼），共五栋：北侧三栋为中国第一历史档案馆用房，西华门两侧两栋。修建时拆除了西华门两侧登城马道，被视为故宫内最大的“违建”，故宫博物院拟逐步迁出、拆除。';

/** 保留由总装直接建造（带 OSM id 标签、点选信息卡）的有名建筑；其余数组覆盖经 FixCtx 建造 */
const KEEP = new Set([43512262, 40542454, 40542455, 40542452, 40478532, 40543883]); // 均有斗拱，不受小式檐檩错位影响

export default {
  key: 'west_outer',
  title: '西路南部（武英殿、西华门、南薰殿、南大库、宝蕴楼）',
  overrides: fixOverrides({
    // ===== 武英殿建筑群 =====
    43512262: withDesc(wuyingHalls(), WUYING_DESC),
    40542454: withDesc([wuyingGate()], wuyingGate().desc),
    40542455: withDesc([peidian(40542455, W)], '凝道殿：武英殿东配殿，面阔五间，黄琉璃瓦单檐悬山顶，前出廊。'),
    40542456: withDesc([peidian(40542456, E)], '', { noLabel: true }), // OSM 误作“梚章殿”，标注见 build()
    40542459: nl([yf(40542459, W, { nBays: 5, corridor: 1.4, nDepth: 3, backCorridor: false })]), // 东廊房
    40542460: nl([yf(40542460, E, { nBays: 5 })]), // 西廊房
    42569635: [yf(42569635, N, { nBays: 5 })], // 武英门西侧值房（后檐即院墙）
    42569637: [yf(42569637, N, { nBays: 5 })], // 武英门东侧值房
    40542458: withDesc([yf(40542458, S, { grade: 4, nBays: 3, roof: { beasts: 3 } })], '恒寿斋：位于武英殿建筑群东北隅，面阔三间，黄琉璃瓦硬山顶。'),
    40542457: withDesc([onObb(40542457, S, {
      ...fang({ grade: 4, roofType: 'xieshan', juan: true, ph: 0.6 }), nBays: 3, nDepth: 1, colH: 3.6, caihua: 'xuanzi', roof: { type: 'xieshan', juan: true, beasts: 3 },
    })], '浴德堂：武英殿西北，坐北朝南，面阔三间，黄琉璃瓦卷棚歇山顶；后檐西侧接抱厦两间，北通穹顶浴室。相传为乾隆香妃沐浴处，实为修书处蒸熏纸张或斋戒沐浴之所。'),
    650971293: buildBath,
    40542542: withDesc([onObb(40542542, S, {
      ...fang({ grade: 5, ph: 0.5 }), kind: 'pavilion', nBays: 1, nDepth: 1, colH: 3.0, bench: false,
      roof: { type: 'luding', rise: 0.9, inner: { w: 2.6, d: 1.6 }, beasts: -1 },
    })], '井亭：浴德堂西北、武英殿西墙外，黄琉璃瓦盝顶，中开井口天窗；为浴室汲水烧水之用。'),
    42569631: nl([yf(42569631, E, { nBays: 5, roof: { rise: 2.4 } })]), // 武英殿西墙外值房
    42569629: nl([yf(42569629, E, { nBays: 9, roof: { rise: 2.4 } })]),

    // ===== 武英殿北（方略馆一带） =====
    40542462: [yf(40542462, S, { grade: 4, nBays: 5, corridor: 1.6, nDepth: 3, backCorridor: false, roof: { rise: 4.2 } })],
    40542463: [
      onRect([-264.8, -247.2, 207.8, 215.6], S, fang({ nBays: 5 })),
      onRect([-264.8, -257.5, 215.6, 228.3], E, fang({ nBays: 3 })),
      onRect([-254.6, -247.2, 215.6, 228.2], W, fang({ nBays: 3 })),
    ],
    40542464: [onRect([-247.2, -226.6, 206.6, 215.0], S, fang({ nBays: 5 }))],
    40542465: [onRect([-226.6, -196.6, 205.8, 213.3], S, fang({ nBays: 7 }))],
    40586556: withDesc([yf(40586556, S, { grade: 4, nBays: 5, corridor: 1.5, nDepth: 3, backCorridor: false, plaque: '方略馆' })], '方略馆：清代纂修“方略”（记述战争始末的官书）的机构，隶属军机处。'),
    40586557: [yf(40586557, S, { grade: 4, nBays: 3, roof: { rise: 3.6 } })],
    40586558: nl([yf(40586558, E, { nBays: 3 })]),
    // 档案馆院内办公房（灰瓦）
    40542461: [gf(40542461, E, { grade: 4, nBays: 7 })],
    650787466: [gf(650787466, N, { nBays: 7 })],
    650787467: [gf(650787467, S, { grade: 4, nBays: 5, roof: { rise: 3.8 } })],
    650788160: [gf(650788160, S, { nBays: 3 })],

    // ===== 宝蕴楼（咸安宫旧址）及北侧小院 =====
    40586549: buildBaoyun,
    40542452: withDesc([onObb(40542452, S, {
      kind: 'gate', eaveW: 24.0, eaveD: 10.3, z: 332.6, grade: 4, nBays: 3, nDepth: 2, gateDoors: 1, colH: 4.6,
      dougong: { kou: 0.065, cai: 3 }, caihua: 'xuanzi', tile: Y, platform: { h: 0.75, style: 'stone' },
      roof: { type: 'xieshan', beasts: 3 }, plaque: '咸安门', plaqueCharH: 0.3,
    })], '咸安门：咸安宫官学宫门，面阔三间。乾隆十六年（1751）内廷旧咸安宫改建为寿安宫，咸安宫官学迁至西华门内此处；清末宫毁于火，仅存此门，1915 年于宫址建宝蕴楼。'),
    40586551: nl([yf(40586551, S, { nBays: 7 })]),
    40586552: nl([yf(40586552, N, { nBays: 9 })]),
    40586553: nl([yf(40586553, E, { nBays: 3 })]),
    40586554: nl([yf(40586554, W, { nBays: 3 })]),
    40586555: nl([yf(40586555, S, { nBays: 5 })]),

    // ===== 屏风楼（西墙内侧）与西华门内值房 =====
    40478531: (ctx, b, api) => { // 屏风楼（西华门南）：按 OSM 3D 形体（台高 10m，重檐，顶高约 26m）
      const top = screenTower(fixCtx(ctx), [-363.7, -351.8, 385.0, 459.1], E);
      stairHouse(ctx, -357.7, 381.6, 6.2, 4.4);
      api.label('屏风楼', -357.7, top + 2, 420, SCREEN_DESC);
    },
    40542467: screen(E, (ctx) => stairHouse(ctx, -355.0, 321.5, 6.0, 4.2)),
    40542469: screen(E, (ctx, api, top) => api.label('屏风楼（档案馆）', -353.8, top + 2, 133, SCREEN_DESC)),
    157718680: screen(E), // 城楼5
    157719513: screen(E), // 城楼7
    157718865: screen(S), // 城楼6
    157719511: screen(S), // 城楼2
    157719514: screen(S), // 城楼8
    40586547: [yf(40586547, S, { nBays: 5 })],
    40586548: [yf(40586548, N, { nBays: 5 })],
    // 城外筒子河内侧围房（灰瓦）
    42740551: [onRect([-396.6, -385.0, 168.6, 318.9], E, fang({ tile: G, nBays: 37, colH: 3.0, roof: { rise: 2.6 } }))],
    42740548: [gf(42740548, E, { nBays: 3 })],
    42740549: [gf(42740549, E, { nBays: 3 })],

    // ===== 南薰殿 =====
    40478532: withDesc([onObb(40478532, S, {
      grade: 3, nBays: 5, nDepth: 3, colH: 5.0, dougong: { kou: 0.07, cai: 5 }, caihua: 'xuanzi', tile: Y,
      platform: { h: 1.0, style: 'stone', stairs: [{ side: 'S', w: 3.4 }] }, roof: { type: 'xieshan', beasts: 5 }, plaque: '南薰殿', plaqueCharH: 0.27,
    })], '南薰殿：明代所建，自成独立院落，坐北朝南，面阔五间，黄琉璃瓦单檐歇山顶；殿内木构与彩画皆明代原物，明间、次间设朱漆木阁五层，清代用以尊藏历代帝王及后妃像。'),
    660730549: [yf(660730549, N, { nBays: 5, colH: 2.8 })],
    42569627: 'skip', // 院东墙北端门：build() 中以随墙门重建

    // ===== 南大库（今故宫家具馆）=====
    40478533: withDesc([yf(40478533, S, { grade: 4, nBays: 39, colH: 4.4, front: Array.from({ length: 39 }, (_, i) => (i % 6 === 3 ? 'door' : 'window')) })],
      '南大库'),
    40478537: [yf(40478537, N, { grade: 4, nBays: 29, colH: 4.2, front: Array.from({ length: 29 }, (_, i) => (i % 6 === 2 ? 'door' : 'window')) })],
    40478541: [yf(40478541, N, { nBays: 19 })],
    40478542: [yf(40478542, N, { nBays: 15 })],
    40478543: [yf(40478543, S, { grade: 4, nBays: 5, roof: { rise: 3.6 } })],
    40478544: [yf(40478544, E, { nBays: 5, roof: { rise: 3.4 } })],
    40478538: [yf(40478538, S, { grade: 4, nBays: 5, roof: { rise: 3.6 } })],
    660666776: [yf(660666776, W, { nBays: 7 })],
    40478535: [yf(40478535, S, { nBays: 11 })],
    40478536: [yf(40478536, S, { nBays: 7 })],
    40586545: [yf(40586545, W, { nBays: 3 })],
    40586546: [yf(40586546, E, { nBays: 3 })],
    40586541: [yf(40586541, E, { nBays: 5 })],
    660730546: [yf(660730546, S, { nBays: 1 })],
    660730548: [yf(660730548, S, { nBays: 3 })],

    // ===== 内务府旧址（E 形办公楼，灰瓦）=====
    40542466: withDesc([
      onRect([-181.6, -173.4, 116.1, 176.6], E, fang({ tile: G, grade: 4, nBays: 15 })),
      onRect([-173.4, -148.0, 116.1, 124.2], S, fang({ tile: G, grade: 4, nBays: 7 })),
      onRect([-173.4, -154.8, 132.7, 141.6], S, fang({ tile: G, grade: 4, nBays: 5 })),
      onRect([-173.4, -150.5, 161.7, 176.6], S, fang({ tile: G, grade: 4, nBays: 5, roof: { rise: 3.6 } })),
    ], '内务府旧址：清代掌管宫廷事务的总机构所在，位于西华门内迤北；原建筑多已不存，今为办公用房。'),

    // ===== 慈宁宫花园南部 =====
    40543883: withDesc([linxiPavilion()], LINXI_DESC),
    42509825: [yf(42509825, E, { nBays: 5, colH: 3.2 })], // 原绿云亭址，今五间庑房
    40543894: [yf(40543894, W, { nBays: 5, colH: 3.2 })], // 原翠芳亭址
    42509830: 'skip', // 花园南门：build() 中以随墙门重建
    42509828: 'skip', // 南天门：同上
    40543887: [yf(40543887, E, { nBays: 9 })],
    40543886: [yf(40543886, E, { nBays: 5 })],
    40543892: [yf(40543892, W, { nBays: 9 })],
    40543893: [
      onRect([-297.2, -263.6, 93.8, 103.1], N, fang({ nBays: 9 })),
      onRect([-297.1, -287.4, 85.8, 93.8], E, fang({ nBays: 3 })),
    ],
    // 慈宁宫南侧院落（灰瓦，膳房/库房一类）
    40543903: [onRect([-182.8, -160.1, 46.4, 61.6], S, fang({ tile: G, grade: 4, nBays: 5, corridor: 1.5, nDepth: 3, backCorridor: false, roof: { rise: 3.4 } }))],
    40543901: [onRect([-183.0, -160.1, 63.3, 79.3], S, fang({ tile: G, grade: 4, nBays: 5, corridor: 1.5, nDepth: 3, backCorridor: false, roof: { rise: 3.4 } }))],
    40543902: [gf(40543902, N, { nBays: 13 })],
    40543905: [gf(40543905, W, { nBays: 3 })],
    40543906: [gf(40543906, W, { nBays: 5 })],
    650784548: [gf(650784548, S, { nBays: 5 })],
    650784551: [gf(650784551, E, { nBays: 3 })],
    650784553: [gf(650784553, S, { nBays: 1 })],
  }, KEEP),

  wallOverrides: {
    // 武英殿院墙：廊房、配殿后檐处断开（以房屋后墙为院墙）
    42569638: { h: 5.2, gaps: [{ from: 0, to: 17.5 }, { from: 27.9, to: 70.9 }] },
    42569640: { h: 5.2, gaps: [{ from: 42.1, to: 93.0 }, { from: 104.1, to: 121.1 }] },
    42569633: { h: 4.8 },
    42569626: { h: 4.6 }, // 南薰殿院墙
    42569624: { h: 5.0 },
    42569628: { h: 5.0 },
    42569643: { h: 4.6 },
    42509827: { h: 4.6 }, // 慈宁宫花园南墙
    42509829: { h: 4.6 },
    650784550: { h: 3.6 },
    1531584483: { h: 3.6 },
    1531584484: { h: 3.6 },
    1531586942: { h: 3.6 },
  },
  bridgeOverrides: { 1031650602: 'skip' }, // 西华门外筒子河桥：build() 中重建

  build(ctx0, api) {
    const ctx = fixCtx(ctx0);
    // ---- 武英殿 ----
    buildWuyingBase(ctx, api);
    wuyingBridges(ctx, api);
    buildBathPorch(ctx);
    wellCurb(ctx, -259.1, 257.8, 0.5);
    api.label('焕章殿', -250.6, 11, 321.2, '焕章殿：武英殿西配殿，面阔五间，黄琉璃瓦单檐悬山顶，前出廊。');
    api.label('南大库', -210.8, 12, 439.8, '南大库：紫禁城西南隅，曾是故宫最大的建材与杂物库房；经修缮后辟为故宫家具馆（一期 2018 年开放），南薰殿区域为其三期。');

    // ---- 南薰殿院东门、慈宁宫花园南门、南天门（随墙门）----
    buildWallGate(ctx.at(-268.0, 0, 405.6, E), { type: 'suiqiang', w: 3.8, h: 5.6, wallThick: 1.0, tile: Y });
    buildWallGate(ctx.at(-258.9, 0, 89.9, S), { type: 'suiqiang', w: 6.8, h: 5.8, wallThick: 1.2, tile: Y });
    buildWallGate(ctx.at(-222.3, 0, 90.0, S), { type: 'suiqiang', w: 6.8, h: 5.8, wallThick: 1.2, tile: Y });
    api.label('南天门', -222.3, 7.5, 90.0, '随墙门，位于慈宁宫花园东南，南通西华门内甬路。');
    // 武英殿院内铁缸一对（防火“门海”）
    for (const s of [-1, 1]) ctx.place('vat:iron', -221 + s * 15.5, 0, 318.5, 0, 1.6);
    buildPalaceWall(ctx, { path: [[-285.6, 90.0], [-262.3, 90.0]], h: 4.6, thick: 1.2, cap: Y }); // 花园南墙西段（OSM 缺）

    // ---- 临溪亭水池与券桥 ----
    buildLinxiPond(ctx, api);

    // ---- 断虹桥与内金水河小桥 ----
    buildDuanhong(ctx, api);
    smallBridge(ctx, api, -300.0, 147.0, E, 8, 3.0);
    smallBridge(ctx, api, -275.9, 241.0, E, 8, 3.0);
    smallBridge(ctx, api, -324.0, 114.4, S, 8, 3.0);

    // 西华门外筒子河平桥（与东华门外桥同式：石砌桥身、条石桥面、青白石栏杆；宽度与 walls 分区矮墙断口一致）
    const deck = [[-448.8, 345.9], [-393.0, 345.9], [-393.0, 362.9], [-448.8, 362.9]];
    ctx.add('stone_grey', prismGeo(deck, api.waterY - 0.6, -0.02, { top: false }));
    ctx.add('paving', prismGeo([[-448.6, 346.1], [-393.2, 346.1], [-393.2, 362.7], [-448.6, 362.7]], -0.02, 0.06));
    for (const z of [346.5, 362.3]) buildRailing(ctx, { path: [[-448.2, z], [-393.6, z]], y: 0.06, style: 'stone', height: 1.1, ends: 'drum' });
    paveStrip(ctx, [[-393, 354.4], [-375, 354.4]], 9);

    // ---- 甬路 / 石板路 ----
    paveStrip(ctx, [[-346, 354], [-323, 354], [-300, 353], [-284, 364], [-263, 385], [-245, 395], [-231, 395.5], [-217, 396], [-168, 396], [-149, 394], [-139, 392.5]], 5.0);
    paveStrip(ctx, [[-168, 396], [-164, 366], [-160, 337], [-154, 333]], 4.0);
    paveStrip(ctx, [[-154, 313.6], [-142, 305], [-130, 296]], 4.0);

    // ---- 树木 ----
    plantTrees(ctx, api);
  },
};

// ---------------- 植树 ----------------
function plantTrees(ctx, api) {
  const site = api.site;
  const rects = site.buildings.map((b) => {
    const xs = b.poly.map((p) => p[0]), zs = b.poly.map((p) => p[1]);
    return [Math.min(...xs) - 2.5, Math.max(...xs) + 2.5, Math.min(...zs) - 2.5, Math.max(...zs) + 2.5];
  });
  const waters = site.water.filter((w) => w.id !== 4845030).map((w) => w.poly);
  const channels = site.waterways.filter((w) => (w.tags.name || '').includes('金水') || w.tags.waterway === 'drain').map((w) => w.pts);
  const roads = [
    [[-366, 354], [-323, 354], [-300, 353], [-284, 364], [-263, 385], [-245, 395], [-168, 396], [-149, 394]],
    [[-168, 396], [-164, 366], [-160, 337], [-154, 331], [-154, 314], [-130, 296], [-129, 269], [-128, 171], [-128, 152]],
    [[-317, 108], [-141, 108], [-135, 125], [-136, 155], [-150, 201], [-156, 221], [-154, 314]],
    [[-156, 221], [-210, 222], [-230, 235], [-270, 235], [-272, 241]],
    [[-223, 396], [-223, 377]], [[-230, 395], [-229, 377]], [[-216, 396], [-215, 376]],
  ];
  const blocked = (x, z, clear = 3.2) =>
    rects.some(([a, b, c, d]) => x > a && x < b && z > c && z < d) ||
    waters.some((P) => pip(x, z, P)) ||
    channels.some((P) => distToPolyline(x, z, P) < 4.5) ||
    roads.some((P) => distToPolyline(x, z, P) < clear) ||
    (x > -244 && x < -198 && z > 352 && z < 380) || // 武英门前桥区
    (x > -166 && x < -142 && z > 304 && z < 343); // 断虹桥两端
  const placed = [];
  const put = (kind, x, z, h, seed) => {
    const v = seed % 4;
    ctx.place(`tree:${kind}:${v}`, x, 0, z, (seed * 2.399) % (Math.PI * 2), h);
    placed.push([x, z]);
  };
  // 断虹桥北“十八槐”
  const huai = [[-178, 252], [-170, 251], [-161, 253], [-176, 262], [-166, 263], [-158, 266], [-179, 273], [-171, 276], [-161, 279],
    [-176, 287], [-167, 291], [-158, 293], [-179, 300], [-171, 304], [-163, 300], [-145, 296], [-138, 304], [-150, 288]];
  huai.forEach(([x, z], i) => put('locust', x + Math.sin(i * 2.1) * 1.2, z + Math.cos(i * 1.7) * 1.2, 13 + (i % 5) * 1.1, i * 7 + 3));
  api.label('十八槐', -168, 20, 280, '断虹桥北古槐成林，俗称“十八槐”，相传植于元代；今存槐树已不足十八株。');
  // OSM 林地：金水河两岸、南薰殿北、太和门西庑外
  const groves = [
    { id: 41658076, sp: 11, kinds: ['locust', 'elm', 'willow'], max: 18 },
    { id: 41659558, sp: 12, kinds: ['locust', 'elm', 'locust', 'willow'], max: 30 },
    { id: 41658073, sp: 13, kinds: ['locust', 'elm', 'locust'], max: 16 },
    { id: 41658074, sp: 12, kinds: ['locust', 'elm', 'locust'], max: 26 },
    { id: 42740552, sp: 9, kinds: ['locust'], max: 4 },
  ];
  let seed = 11;
  for (const g of groves) {
    const poly = site.green.find((q) => q.id === g.id)?.poly;
    if (!poly) continue;
    const pts = scatter(poly, g.sp, g.id % 9973, (x, z) => blocked(x, z), g.max, placed);
    for (const [x, z] of pts) {
      const R = rng(seed);
      const nearWater = waters.some((P) => P.some(([px, pz]) => Math.hypot(px - x, pz - z) < 9));
      const kind = nearWater && R() < 0.16 ? 'willow' : g.kinds[seed % g.kinds.length].replace('willow', 'locust');
      const h = kind === 'willow' ? 10 + R() * 2.5 : kind === 'elm' ? 11 + R() * 3 : 12 + R() * 4;
      put(kind, x, z, h, seed++);
    }
  }
  // 慈宁宫花园南部：池畔古柏、松
  const garden = [[-276, 54, 'cypress', 10], [-241, 54, 'cypress', 10], [-278.5, 45, 'pine', 9], [-239, 45, 'pine', 9],
    [-270, 64, 'cypress', 11], [-247, 64, 'cypress', 11], [-271, 80, 'pine', 9.5], [-246, 80, 'pine', 9.5]];
  garden.forEach(([x, z, k, h], i) => put(k, x, z, h, 100 + i));
  // 南薰殿院内古柏一对；宝蕴楼院内槐树
  for (const [x, z, i] of [[-307.5, 318, 0], [-294, 318, 1]]) put('locust', x, z, 10 + i, 210 + i);
  // 筒子河内侧（城墙外）行道树
  for (let z = 48; z < 166; z += 11) put(z % 22 < 11 ? 'willow' : 'locust', -391.5, z, 10.5 + (z % 3), 300 + z);
}
