// 分区：外西路（慈宁宫、慈宁宫花园、寿康宫、寿安宫、英华殿、雨花阁/中正殿、建福宫及花园、城隍庙、西河沿）
// 形制依据：故宫博物院与《紫禁城宫殿》等资料（单体说明见各 desc）；坐标与尺寸以 OSM 测绘轮廓为准。
import { SITE } from '../site/auto.js';
import { buildHall } from '../core/building.js';
import { buildPlatform, buildRailing } from '../core/platform.js';
import { buildPalaceWall, buildWallGate, buildScreenWall } from '../core/walls.js';
import { buildRockery, buildLawn } from '../core/nature.js';
import { S, N, E, W, F, Rc, fx, yRoom, yWing, gRoom, gJuan, buildLou, buildGoulian, wallGate, segRange, pave, paveLine, plant } from './cining/lib.js';
import { buildYuhuage } from './cining/special.js';

// ---------------- 覆盖表小工具 ----------------
// 所有覆盖均以函数形式经 fx(ctx) 构建（规避 core 小式檐檩错位，见 lib.fx），并按 OSM 名或指定名加标签。
/** 函数覆盖 + 标签（name=false 不加标签；未给 name 用 OSM 名） */
const fn = (build, name, desc = '') => (ctx, b, api) => {
  const top = build(fx(ctx), b, api);
  const nm = name === false ? '' : name || b.tags.name;
  if (nm) api.label(nm, b.obb.cx, (top || 10) + 2, b.obb.cz, desc);
};
/** 若干完整 spec（世界坐标 x,z,rotY）；props: {desc, noLabel, name} */
const arr = (specs, p = {}) => fn((ctx) => { let t = 0; for (const s of specs) t = Math.max(t, (buildHall(ctx.at(s.x, s.y0 ?? 0, s.z, s.rotY ?? 0), s).topY || 8) + (s.y0 ?? 0)); return t; },
  p.noLabel ? false : p.name, p.desc || '');
/** 单栋完整 spec，desc/noLabel/name 取自 spec */
const H = (spec) => arr([spec], { desc: spec.desc, noLabel: spec.noLabel, name: spec.name });
const lou = (spec, name, desc) => fn((ctx) => buildLou(ctx.at(spec.x, 0, spec.z, spec.rotY), spec).topY, name, desc);
const glld = (spec, n, roofs, name, desc) => fn((ctx) => buildGoulian(ctx.at(spec.x, 0, spec.z, spec.rotY), spec, n, roofs).topY, name, desc);
const hallFn = (specs) => (ctx) => { let t = 0; for (const s of specs) t = Math.max(t, (buildHall(ctx.at(s.x, s.y0 ?? 0, s.z, s.rotY), s).topY || 8) + (s.y0 ?? 0)); return t; };

// 常用台基
const pf = (h, style = 'plain', stairs) => ({ h, style, ...(stairs ? { stairs } : {}) });
const SN = (w) => [{ side: 'S', w }, { side: 'N', w }];

const DESC = {
  cnm: '慈宁宫正门。明嘉靖十五年（1536）建，殿宇式大门，面阔五间、进深三间，黄琉璃瓦单檐歇山顶，汉白玉须弥座，前出三阶（中为龙凤御路），阶前陈鎏金铜麒麟一对，两侧接八字琉璃影壁。',
  cng: '明清太皇太后、皇太后正宫。始建于明嘉靖十五年，清乾隆三十四年改单檐为重檐。面阔七间，前后出廊，黄琉璃瓦重檐歇山顶；殿前月台正面三阶、左右各一阶，陈鎏金铜香炉四座；两山设卡墙垂花门通后院。现为故宫雕塑馆。',
  dft: '慈宁宫后寝殿，清代为太后礼佛之所（大佛堂）。面阔七间、进深三间，黄琉璃瓦单檐歇山顶，两侧接东西耳房，前有月台陈香炉、香筒。',
  hym: '慈宁宫前院西庑正中之门，与东侧徽音左门相对，通寿康宫。黄琉璃瓦单檐歇山顶门殿。',
  hzm: '慈宁宫前院东庑正中之门，与西侧徽音右门相对。黄琉璃瓦单檐歇山顶门殿。',
  xrg: '慈宁宫花园主体建筑，明代始建，乾隆三十年改建。正殿面阔五间、四周围廊，黄琉璃瓦歇山顶，前出抱厦三间为卷棚顶；清代为太后、太妃礼佛之所。',
  bxl: '咸若馆东侧佛楼，坐东朝西，两层，面阔七间，绿琉璃瓦黄剪边卷棚歇山顶；楼内曾供藏传佛像与佛塔。',
  jyl: '咸若馆西侧佛楼，坐西朝东，与宝相楼对峙，两层，面阔七间，绿琉璃瓦黄剪边卷棚歇山顶。',
  cyl: '咸若馆后正北，坐北朝南，两层，面阔五间，绿琉璃瓦黄剪边卷棚歇山顶，为花园北端屏障。',
  hqz: '宝相楼正南，前后两卷各三间，以天井相隔；灰瓦卷棚硬山，青砖素面、不施斗拱彩画，乾隆为守孝而建，风格朴素。',
  ysd: '吉云楼正南，紧邻花园西墙，与含清斋东西相对；前后两卷各三间，灰瓦卷棚硬山，素雅无彩画。',
  skg: '乾隆元年（1736）为崇庆皇太后添建。正殿面阔五间、进深三间，黄琉璃瓦单檐歇山顶，前出廊，殿前月台；东梢间为太后佛堂。',
  skhd: '寿康宫寝殿（额“长乐敷华”），面阔五间、进深三间，黄琉璃瓦歇山顶，前檐出廊，后接叠落穿堂通后罩房。',
  sag: '寿安宫正殿，面阔五间、进深三间，黄琉璃瓦单檐歇山顶，明间退进一间；两山出转角延楼，南接春禧殿后卷殿。清代为太妃、太嫔居所。',
  cxd: '寿安宫第一进正殿，面阔五间，黄琉璃瓦单檐歇山顶，后接卷殿（勾连搭）。院中原有乾隆二十五年所建三层大戏台，嘉庆四年拆除改建后卷殿；现建筑为 1989 年重建。',
  yhd: '明代为太后、太妃礼佛之所，清沿用。正殿面阔五间，黄琉璃瓦单檐庑殿顶，前出月台陈香炉；左右耳殿各三间（硬山）。殿前甬路两侧有明孝定李太后手植菩提树二株（实为椴树）。',
  bt: '英华门与英华殿之间甬路正中的方形碑亭，黄琉璃瓦四角攒尖，四面辟门，内立乾隆御制碑。',
  yhg: '乾隆十五年（1750）仿西藏阿里托林寺金殿建，紫禁城中最大的藏传佛教殿堂、唯一保存完整的密宗四部神殿。外观三层、内四层（明三暗四），底层周围廊、南出抱厦，绿琉璃瓦黄剪边；二层黄琉璃瓦蓝剪边；顶层四角攒尖覆鎏金铜瓦，四脊各有鎏金铜行龙，宝顶为鎏金喇嘛塔。',
  bhd: '中正殿区佛殿，坐北朝南，面阔三间、进深一间，黄琉璃瓦歇山顶，后出抱厦一间，与中正殿前抱厦南北对称。每年腊月在此举行跳布扎（打鬼）。',
  xyt: '宝华殿与中正殿之间的方亭，内供铜塔。1923 年建福宫火灾中焚毁，2012 年复建。',
  zzd: '清宫藏传佛教事务中心（中正殿念经处）所在。1923 年焚毁，2012 年按原形制复建：面阔五间，黄琉璃瓦歇山顶，前出抱厦三间。',
  ycg: '建福宫花园中心建筑，乾隆七年（1742）建，1923 年焚毁，2005 年复建。两层楼阁，面阔、进深各五间，重檐四角攒尖顶，黄琉璃瓦蓝剪边，琉璃宝顶。',
  jsz: '建福宫花园北端，面阔九间、进深一间，前出廊，绿琉璃瓦黄剪边硬山顶。乾隆曾在此读书。',
  jyx: '建福宫花园东路主体，勾连搭三卷殿，面阔五间、进深三间，周围廊，绿琉璃瓦黄剪边卷棚顶。',
  hyl: '静怡轩正北，两层七间硬山楼，黄琉璃瓦绿剪边，东带耳殿、西有过桥游廊。',
  jfg: '乾隆五年（1740）由乾西四所改建，乾隆为皇子时旧居之一。1923 年火灾后遗址，复建后为故宫对外交流用房。',
  chm: '雍正四年（1726）建，紫禁城内供奉城隍之庙，坐北朝南，山门、正殿、后殿与东西配殿组成两进院落。',
  bj: '清宫冰窖，半地下式，石砌拱券、灰瓦硬山，冬季藏冰、夏季颁冰；2015 年改为冰窖餐厅。',
  wwyy: '2016 年建成的故宫文物医院（西河沿），沿西城墙内侧长约 361 米，传统式灰瓦建筑，地上一层地下一层，为文物科技保护与修复中心。',
};

// ---------------- 建筑覆盖表 ----------------
const overrides = {
  // ===== 慈宁宫 =====
  40593737: H({ ...F(40593737, S), kind: 'gate', grade: 3, nBays: 5, nDepth: 2, colH: 5.2, gateDoors: 3, roof: { type: 'xieshan', beasts: 7 }, plaque: '慈宁门', plaqueCharH: 0.4,
    platform: { h: 1.35, style: 'xumizuo', stairs: [{ side: 'S', w: 4.0, yulu: true }, { side: 'S', x: -6.2, w: 3.2 }, { side: 'S', x: 6.2, w: 3.2 }, { side: 'N', w: 4.0 }] }, desc: DESC.cnm }),
  40593735: H({ ...F(40593735, S), grade: 2, bays: [2.2, 4.0, 4.4, 4.8, 5.6, 4.8, 4.4, 4.0, 2.2], depthBays: [2.2, 5.5, 5.3, 5.5, 2.2], corridorDepth: 2.2, colH: 5.6,
    double: { inset: 2.2, upperH: 2.4 }, roof: { type: 'xieshan', beasts: 9 }, plaque: '慈宁宫', plaqueCharH: 0.42, detail: 3,
    front: ['wall', 'window', 'door', 'door', 'door', 'door', 'door', 'window', 'wall'], back: ['wall', 'wall', 'window', 'window', 'door', 'window', 'window', 'wall', 'wall'],
    platform: { h: 1.6, style: 'stone', stairs: [{ side: 'N', w: 4.2 }] }, desc: DESC.cng }),
  40593736: arr([
    Rc(-238.6, -204.0, -157.7, -142.9, S, { grade: 3, nBays: 7, nDepth: 3, corridor: 1.8, backCorridor: false, colH: 5.0, roof: { type: 'xieshan', beasts: 7 }, plaque: '大佛堂', plaqueCharH: 0.34, platform: pf(1.2, 'stone', SN(3.6)) }),
    Rc(-244.0, -238.2, -156.4, -144.4, S, yRoom({ grade: 4, colH: 3.6, platform: pf(0.6) })),
    Rc(-204.4, -198.7, -156.4, -144.4, S, yRoom({ grade: 4, colH: 3.6, platform: pf(0.6) })),
  ], { desc: DESC.dft }),
  // 前院廊庑：南庑（慈宁门两侧）折向北接徽音门，东西庑北抵后殿耳房
  40593744: arr([Rc(-260.1, -234.2, -68.7, -61.0, N, yWing({ colH: 3.4 })), Rc(-259.8, -252.6, -79.7, -68.7, E, yWing({ colH: 3.4 }))]),
  40593743: arr([Rc(-209.2, -183.0, -68.2, -61.0, N, yWing({ colH: 3.4 })), Rc(-191.0, -182.9, -79.6, -68.2, W, yWing({ colH: 3.4 }))]),
  40593741: arr([Rc(-260.6, -252.3, -155.0, -96.5, E, yWing({ colH: 3.4 })), Rc(-252.3, -244.0, -155.0, -147.2, S, yRoom({ colH: 3.2 }))]),
  40593742: arr([Rc(-191.2, -183.5, -151.9, -96.6, W, yWing({ colH: 3.4 })), Rc(-198.8, -191.2, -151.9, -147.3, S, yRoom({ colH: 3.2 }))]),
  40593738: H({ ...Rc(-261.1, -250.3, -96.5, -79.7, W), kind: 'gate', grade: 4, nBays: 3, nDepth: 2, colH: 4.0, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi', gateDoors: 1,
    roof: { type: 'xieshan' }, plaque: '徽音右门', plaqueCharH: 0.26, platform: { h: 0.6, stairs: SN(2.8) }, name: '徽音右门', desc: DESC.hym }),
  40593739: H({ ...Rc(-192.9, -181.5, -96.7, -79.5, E), kind: 'gate', grade: 4, nBays: 3, nDepth: 2, colH: 4.0, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi', gateDoors: 1,
    roof: { type: 'xieshan' }, plaque: '徽音左门', plaqueCharH: 0.26, platform: { h: 0.6, stairs: SN(2.8) }, name: '徽音左门', desc: DESC.hzm }),
  650780269: 'skip', 650780270: 'skip', // 卡墙垂花门（build 中重建）
  // 慈宁门前广场：永康左/右门、长信门（三座随墙琉璃门，build 中建）
  42569646: 'skip', 42569647: 'skip', 42569648: 'skip', 42569653: 'skip', 42569654: 'skip', 42569655: 'skip',
  42509835: 'skip', 42509836: 'skip', 42509837: 'skip', 42509061: 'skip',
  42509062: H(F(42509062, S, yRoom({ colH: 2.8 }))),

  // ===== 慈宁宫东侧（头所、二所） =====
  40605420: H(F(40605420, S, yWing({ nBays: 3, colH: 3.6, platform: pf(0.6) }))),
  40605421: H(F(40605421, S, yRoom({ colH: 2.8 }))), 40605422: H(F(40605422, S, yRoom({ colH: 2.8 }))),
  40605416: H(F(40605416, W, yRoom())), 40605418: H(F(40605418, E, yRoom())), 40605417: H(F(40605417, N, yRoom())),
  40605425: H(F(40605425, S, yWing({ nBays: 3, colH: 3.6, platform: pf(0.6) }))),
  40605423: H(F(40605423, S, yRoom({ colH: 2.8 }))), 40605419: H(F(40605419, N, yRoom())),
  40605415: H(F(40605415, W, yRoom())), 40605413: H(F(40605413, N, yRoom())), 40605414: H(F(40605414, N, yRoom({ eaveW: 19.0 }))),

  // ===== 慈宁宫后（西三所一带） =====
  1008750883: H(F(1008750883, S, yRoom({ colH: 3.2, noLabel: true }))),
  1008750884: H(F(1008750884, E, yRoom())), 1008750885: H(F(1008750885, W, yRoom())),
  40605553: H(F(40605553, S, yWing({ nBays: 3, colH: 3.8, platform: pf(0.6) }))),
  40605554: H(F(40605554, S, yWing({ nBays: 3, colH: 3.8, platform: pf(0.6) }))),
  40605555: H(F(40605555, S, yWing({ nBays: 3, colH: 3.8, platform: pf(0.6) }))),
  40605556: H(F(40605556, S, yWing({ nBays: 3, colH: 3.8, platform: pf(0.6) }))),
  40605544: H(F(40605544, E, yRoom())), 40605547: H(F(40605547, E, yRoom())), 40605549: H(F(40605549, E, yRoom())), 40605551: H(F(40605551, E, yRoom())),
  40605545: H(F(40605545, N, yRoom({ colH: 2.8 }))), 40605548: H(F(40605548, N, yRoom({ colH: 2.8 }))),
  40605550: H(F(40605550, N, yRoom({ colH: 2.8 }))), 40605552: H(F(40605552, N, yRoom({ colH: 2.8 }))),
  42509064: 'skip', 42509074: 'skip', 42509075: 'skip', 42509078: 'skip', 42509079: 'skip',

  // ===== 慈宁宫花园（北半部，南半部属 west_outer） =====
  40543884: fn(hallFn([
    { ...Rc(-271.4, -244.7, -26.6, -10.7, S), grade: 3, bays: [1.7, 3.6, 3.8, 4.1, 3.8, 3.6, 1.7], depthBays: [1.7, 4.05, 4.05, 1.7], corridorDepth: 1.7,
      colH: 4.6, roof: { type: 'xieshan', beasts: 5 }, plaque: '咸若馆', plaqueCharH: 0.3, platform: pf(1.0, 'stone', [{ side: 'N', w: 3 }]),
      front: ['open', 'window', 'door', 'door', 'door', 'window', 'open'], back: ['open', 'wall', 'window', 'door', 'window', 'wall', 'open'] },
    { ...Rc(-267.5, -249.8, -13.4, -6.1, S), grade: 4, bays: [4.6, 6.5, 4.6], depthBays: [5.0], colH: 4.0, caihua: 'hexi', dougong: false, overhang: 1.1, backCorridor: false,
      front: ['window', 'door', 'window'], back: 'open', sides: 'window', roof: { type: 'xieshan', juan: true, beasts: 3 }, platform: pf(1.0, 'stone', [{ side: 'S', w: 4.4 }]) },
  ]), '咸若馆', DESC.xrg),
  40543911: lou({ ...F(40543911, W), grade: 4, nBays: 7, nDepth: 3, corridor: 1.3, backCorridor: false, tile: 'green', ridgeColor: 'yellow', caihua: 'hexi', platform: pf(0.6),
    stories: [{ colH: 3.8 }, { colH: 3.2, insetZ: 1.3, front: 'window', back: 'wall' }], roof: { type: 'xieshan', juan: true, beasts: 3 } }, '宝相楼', DESC.bxl),
  40543910: lou({ ...F(40543910, E), grade: 4, nBays: 7, nDepth: 3, corridor: 1.3, backCorridor: false, tile: 'green', ridgeColor: 'yellow', caihua: 'hexi', platform: pf(0.6),
    stories: [{ colH: 3.8 }, { colH: 3.2, insetZ: 1.3, front: 'window', back: 'wall' }], roof: { type: 'xieshan', juan: true, beasts: 3 } }, '吉云楼', DESC.jyl),
  40543909: lou({ ...F(40543909, S), grade: 4, nBays: 5, nDepth: 3, corridor: 1.3, backCorridor: false, tile: 'green', ridgeColor: 'yellow', caihua: 'hexi', platform: pf(0.6),
    stories: [{ colH: 3.8 }, { colH: 3.2, insetZ: 1.3, front: 'window', back: 'wall' }], roof: { type: 'xieshan', juan: true, beasts: 3 } }, '慈荫楼', DESC.cyl),
  40587069: H(F(40587069, S, gJuan({ nBays: 3, colH: 3.2, platform: pf(0.45), plaque: '含清斋', plaqueCharH: 0.24, desc: DESC.hqz }))),
  40587067: H(Rc(-243.9, -232.9, 14.4, 20.6, S, gJuan({ nBays: 3, colH: 3.2, platform: pf(0.45) }))),
  40587070: H(F(40587070, S, gJuan({ nBays: 3, colH: 3.2, platform: pf(0.45), plaque: '延寿堂', plaqueCharH: 0.24, desc: DESC.ysd }))),
  40587068: H(Rc(-285.3, -276.7, 13.4, 19.8, S, gJuan({ nBays: 3, colH: 3.2, platform: pf(0.45) }))),

  // ===== 花园东侧：冰窖与内务用房 =====
  650784555: H(F(650784555, E, gRoom({ nDepth: 3, colH: 2.3, front: 'wall', back: 'wall', sides: ['wall', 'gate', 'wall'], platform: pf(0.3), desc: DESC.bj }))),
  40543908: H(F(40543908, E, gRoom({ nDepth: 3, colH: 2.3, front: 'wall', back: 'wall', sides: ['wall', 'gate', 'wall'], platform: pf(0.3), desc: DESC.bj }))),
  40543907: H(F(40543907, E, gRoom({ nDepth: 3, colH: 2.3, front: 'wall', back: 'wall', sides: ['wall', 'gate', 'wall'], platform: pf(0.3), desc: DESC.bj }))),
  40543896: H(F(40543896, S, yRoom({ colH: 3.2 }))),
  40543897: glld(F(40543897, S, yRoom({ colH: 3.4, nDepth: 4, roof: { type: 'yingshan', gableWallMat: 'wall_red' } })), 2, null, false),
  40543898: H(F(40543898, S, yRoom({ colH: 3.2 }))),
  40543904: glld(F(40543904, S, yRoom({ colH: 3.4, nDepth: 4, roof: { type: 'yingshan', gableWallMat: 'wall_red' } })), 2, null, false),
  40543899: H(F(40543899, E, yRoom({ colH: 3.2 }))),
  40543900: H(F(40543900, S, yRoom({ colH: 3.2 }))),
  40543895: H(F(40543895, W, gRoom({ colH: 3.0 }))),
  650781513: H(F(650781513, E, gRoom())), 650781517: H(F(650781517, S, gRoom())),
  40587064: H(F(40587064, S, gRoom())), 40587065: H(F(40587065, S, gRoom())), 40587066: H(F(40587066, S, gRoom())),

  // ===== 花园西侧排房（寿康宫南） =====
  40543888: H(F(40543888, E, yWing({ colH: 3.3 }))), 40543889: H(F(40543889, E, yWing({ colH: 3.3 }))),
  40543890: H(F(40543890, W, yWing({ colH: 3.3 }))), 40543891: H(F(40543891, W, yWing({ colH: 3.3 }))),

  // ===== 寿康宫 =====
  42509065: 'skip', // 寿康门（琉璃门，build 中建）
  40593159: H(F(40593159, N, yRoom({ colH: 3.0 }))), 40593160: H(F(40593160, E, yRoom({ colH: 3.0 }))),
  40593166: H({ ...F(40593166, S), grade: 3, nBays: 5, nDepth: 4, corridor: 1.9, backCorridor: false, colH: 4.8, roof: { type: 'xieshan', beasts: 7 }, plaque: '寿康宫', plaqueCharH: 0.34,
    platform: pf(1.1, 'stone', [{ side: 'N', w: 3.2 }]), desc: DESC.skg }),
  40593167: H({ ...F(40593167, S), grade: 3, nBays: 5, nDepth: 3, corridor: 1.7, backCorridor: false, colH: 4.4, roof: { type: 'xieshan', beasts: 5 }, plaque: '长乐敷华', plaqueCharH: 0.26, name: '寿康宫后殿',
    platform: pf(0.9, 'stone', SN(3.2)), desc: DESC.skhd }),
  40593168: H(Rc(-291.8, -283.6, -182.9, -174.7, E, yRoom({ colH: 3.0, front: 'window', back: 'window', sides: 'door' }))),
  40593164: H(F(40593164, E, yWing({ nBays: 3, colH: 3.6, platform: pf(0.6) }))), 40593165: H(F(40593165, W, yWing({ nBays: 3, colH: 3.6, platform: pf(0.6) }))),
  40593161: H(F(40593161, E, yRoom())), 40593162: H(F(40593162, W, yRoom())),
  40593163: arr([ // 东西连檐通脊庑房 + 后罩房
    Rc(-313.6, -305.9, -183.0, -126.4, E, yWing({ colH: 3.3 })),
    Rc(-271.0, -262.9, -183.0, -127.2, W, yWing({ colH: 3.3 })),
    Rc(-312.6, -262.7, -191.3, -183.0, S, yWing({ colH: 3.5 })),
  ]),

  // ===== 寿安宫 =====
  42311514: 'skip', 42311515: 'skip', 42311516: 'skip', // 寿安门（三座随墙琉璃门，build 中建）
  42311517: H(F(42311517, S, yRoom())), 42311518: H(F(42311518, S, yRoom())),
  42311935: H(F(42311935, S, yRoom({ colH: 2.6 }))), 40624984: H(F(40624984, E, yRoom())),
  42311936: H(F(42311936, S, yRoom({ colH: 2.6 }))), 42311937: H(F(42311937, W, yRoom())),
  40624982: H(F(40624982, E, yWing({ nBays: 5, colH: 3.6, platform: pf(0.6) }))), 40624983: H(F(40624983, W, yWing({ nBays: 5, colH: 3.6, platform: pf(0.6) }))),
  40624980: glld({ ...F(40624980, S), grade: 3, nBays: 5, nDepth: 4, colH: 4.6, plaque: '春禧殿', plaqueCharH: 0.32, platform: pf(1.0, 'stone', [{ side: 'S', w: 3.4 }]),
    front: ['window', 'window', 'door', 'window', 'window'] }, 2, [{ type: 'xieshan', beasts: 5 }, { type: 'xuanshan', juan: true }], '春禧殿', DESC.cxd),
  40624979: H({ ...F(40624979, S), grade: 3, nBays: 5, nDepth: 4, corridor: 2.0, backCorridor: false, colH: 4.8, roof: { type: 'xieshan', beasts: 7 }, plaque: '寿安宫', plaqueCharH: 0.34,
    front: ['window', 'window', 'door', 'window', 'window'], platform: pf(1.1, 'stone', SN(3.4)), desc: DESC.sag }),
  // 转角延楼（两层，西/东各一，南北两端折向春禧殿后卷殿与寿安宫两山）
  40624995: fn((ctx) => {
    const lo = { grade: 5, tile: 'yellow', caihua: 'xuanzi', stories: [{ colH: 3.3 }, { colH: 2.9, balcony: 'S', front: 'window' }], roof: { type: 'yingshan', gableWallMat: 'wall_red' } };
    let t = 0;
    for (const s of [Rc(-302.4, -294.3, -297.8, -250.6, E, { ...lo, nDepth: 2 }), Rc(-294.6, -289.3, -297.6, -290.9, S, { ...lo, nBays: 1 }), Rc(-294.6, -286.9, -257.7, -250.6, S, { ...lo, nBays: 1 })])
      t = Math.max(t, buildLou(ctx.at(s.x, 0, s.z, s.rotY), s).topY);
    return t;
  }, false),
  40624997: fn((ctx) => {
    const lo = { grade: 5, tile: 'yellow', caihua: 'xuanzi', stories: [{ colH: 3.3 }, { colH: 2.9, balcony: 'S', front: 'window' }], roof: { type: 'yingshan', gableWallMat: 'wall_red' } };
    let t = 0;
    for (const s of [Rc(-256.2, -248.7, -297.7, -250.7, W, { ...lo, nDepth: 2 }), Rc(-262.7, -256.0, -298.0, -292.0, S, { ...lo, nBays: 1 }), Rc(-263.5, -256.0, -258.0, -250.7, S, { ...lo, nBays: 1 })])
      t = Math.max(t, buildLou(ctx.at(s.x, 0, s.z, s.rotY), s).topY);
    return t;
  }, false),
  40624987: H(F(40624987, W, yRoom())), 40624988: H(F(40624988, E, yRoom())),
  40624991: H(F(40624991, S, yWing({ nBays: 3, colH: 3.4, plaque: '萱寿堂', plaqueCharH: 0.24, platform: pf(0.5) }))),
  40624993: H(F(40624993, S, yWing({ nBays: 3, colH: 3.4, plaque: '福宜斋', plaqueCharH: 0.24, platform: pf(0.5) }))),
  40624990: H(F(40624990, S, yRoom())), 42509089: H(F(42509089, S, yRoom())), 42509090: H(F(42509090, E, yRoom())),
  650012672: H(F(650012672, E, yRoom())),
  42509070: 'skip', 42509085: 'skip', 42509091: 'skip', 42509092: 'skip', 42509093: 'skip',

  // ===== 英华殿 =====
  156196336: 'skip', // “四合院墙1”：院墙环，与 OSM 墙线重复
  40627055: H({ ...F(40627055, S), kind: 'gate', grade: 4, nBays: 3, nDepth: 2, colH: 4.0, gateDoors: 1, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi',
    roof: { type: 'xieshan', beasts: 3 }, platform: { h: 0.6, stairs: SN(2.6) }, desc: '英华殿外院山门，黄琉璃瓦歇山顶门殿。' }),
  40627056: 'skip', // 英华门（琉璃门，build 中建）
  40627057: H({ ...Rc(-279.9, -271.3, -381.5, -373.1, S), grade: 4, bays: [1.7, 3.0, 1.7], depthBays: [1.7, 3.0, 1.7], colH: 4.2, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi',
    front: ['wall', 'open', 'wall'], back: ['wall', 'open', 'wall'], sides: ['wall', 'open', 'wall'], roof: { type: 'cuanjian', sides: 4, baoding: 'gold' },
    platform: { h: 0.7, style: 'stone', stairs: SN(2.4) }, desc: DESC.bt }),
  40627060: H({ ...F(40627060, S), grade: 2, nBays: 5, nDepth: 3, colH: 5.6, roof: { type: 'wudian', beasts: 7 }, plaque: '英华殿', plaqueCharH: 0.38, detail: 3,
    front: ['window', 'door', 'door', 'door', 'window'], platform: { h: 1.3, style: 'xumizuo', stairs: [{ side: 'N', w: 3 }] }, desc: DESC.yhd }),
  40627061: H(F(40627061, S, yRoom({ grade: 4, nBays: 3, colH: 3.8, platform: pf(0.7) }))),
  40627062: H(F(40627062, S, yRoom({ grade: 4, nBays: 3, colH: 3.8, platform: pf(0.7) }))),
  40627058: H(F(40627058, E, yRoom())), 40627059: H(F(40627059, E, yRoom())),

  // ===== 雨花阁、中正殿区 =====
  40627494: fn((ctx) => buildYuhuage(ctx).top, '雨花阁', DESC.yhg),
  40627492: lou({ ...F(40627492, E), grade: 4, nBays: 3, nDepth: 2, caihua: 'hexi', platform: pf(0.5), stories: [{ colH: 3.6 }, { colH: 3.0, front: 'window' }], roof: { type: 'xieshan', juan: true, beasts: 3 } }, '雨花阁西配楼'),
  40627493: lou({ ...F(40627493, W), grade: 4, nBays: 3, nDepth: 2, caihua: 'hexi', platform: pf(0.5), stories: [{ colH: 3.6 }, { colH: 3.0, front: 'window' }], roof: { type: 'xieshan', juan: true, beasts: 3 } }, '雨花阁东配楼'),
  42348532: lou({ ...F(42348532, E), grade: 4, nBays: 3, nDepth: 2, caihua: 'hexi', platform: pf(0.5), stories: [{ colH: 3.6 }, { colH: 3.0, front: 'window' }], roof: { type: 'xieshan', juan: true, beasts: 3 } },
    '梵宗楼', '雨花阁西北依墙而建的两层小楼，面阔三间，卷棚歇山顶，楼内供文殊菩萨与大威德金刚。'),
  42348515: 'skip', // 昭福门
  40627498: arr([
    Rc(-221.0, -203.2, -303.3, -293.4, S, { grade: 3, nBays: 3, nDepth: 1, colH: 4.6, roof: { type: 'xieshan', beasts: 5 }, plaque: '宝华殿', plaqueCharH: 0.3, platform: pf(1.0, 'stone', [{ side: 'S', w: 3.4 }]) }),
    Rc(-216.1, -207.3, -307.5, -301.6, N, { grade: 4, nBays: 1, colH: 3.8, caihua: 'hexi', roof: { type: 'xieshan', juan: true, beasts: 3 }, front: 'door', sides: 'window', back: 'open', platform: pf(1.0, 'stone', [{ side: 'S', w: 2.6 }]) }),
  ], { desc: DESC.bhd }),
  40627497: H({ x: -212.5, z: -317.4, rotY: S, grade: 3, bays: [1.6, 4.4, 1.6], depthBays: [1.6, 4.4, 1.6], colH: 4.0, overhang: 1.6, dougong: { kou: 0.06, cai: 3 },
    double: { inset: 1.6, upperH: 1.6 }, roof: { type: 'cuanjian', sides: 4, baoding: 'gold' }, front: ['window', 'door', 'window'], back: ['window', 'door', 'window'], sides: 'window',
    platform: { h: 0.8, style: 'stone', stairs: SN(2.6) }, desc: DESC.xyt }),
  40627495: H(F(40627495, E, yWing({ nBays: 5, colH: 3.8, platform: pf(0.6) }))), 40627496: H(F(40627496, W, yWing({ nBays: 5, colH: 3.8, platform: pf(0.6) }))),
  40627499: arr([
    { ...F(40627499, S), grade: 3, nBays: 5, nDepth: 1, colH: 4.8, roof: { type: 'xieshan', beasts: 5 }, plaque: '中正殿', plaqueCharH: 0.3, platform: pf(1.0, 'stone', [{ side: 'N', w: 3 }]) },
    Rc(-217.2, -206.4, -333.0, -327.4, S, { grade: 4, nBays: 3, nDepth: 1, colH: 4.0, caihua: 'hexi', roof: { type: 'xieshan', juan: true, beasts: 3 }, front: ['window', 'door', 'window'], back: 'open', sides: 'window', platform: pf(1.0, 'stone', [{ side: 'S', w: 3.2 }]) }),
  ], { desc: DESC.zzd }),
  40627625: lou({ ...F(40627625, S), grade: 4, nBays: 9, nDepth: 2, caihua: 'hexi', platform: pf(0.6), stories: [{ colH: 3.8 }, { colH: 3.2, front: 'window' }], roof: { type: 'yingshan', gableWallMat: 'wall_red' } },
    '淡远楼', '中正殿后的两层楼，面阔九间，黄琉璃瓦，楼内原供佛像。'),

  // ===== 建福宫中路 =====
  40627627: H(F(40627627, S, yWing({ nBays: 5, colH: 3.8, plaque: '延庆殿', plaqueCharH: 0.26, platform: pf(0.7) }))),
  40627628: H(F(40627628, W, yRoom())), 40627629: H(F(40627629, E, yRoom())),
  42348516: 'skip', 42348517: 'skip', 42348518: 'skip', 43485436: 'skip', 43485437: 'skip', 42509098: 'skip',
  40627624: H({ ...F(40627624, S), grade: 3, nBays: 5, nDepth: 3, corridor: 1.5, backCorridor: false, colH: 4.2, roof: { type: 'xieshan', beasts: 5 }, plaque: '抚辰殿', plaqueCharH: 0.28, platform: pf(0.9, 'stone', SN(3)) }),
  40627623: H({ ...F(40627623, S), grade: 3, nBays: 5, nDepth: 3, corridor: 1.5, backCorridor: false, colH: 4.4, roof: { type: 'xieshan', beasts: 5 }, plaque: '建福宫', plaqueCharH: 0.28, platform: pf(0.9, 'stone', SN(3)), desc: DESC.jfg }),
  40627622: H(F(40627622, S, { kind: 'pavilion', grade: 4, nBays: 3, nDepth: 2, colH: 3.4, tile: 'green', caihua: 'sushi', roof: { type: 'xieshan', juan: true, ridgeColor: 'yellow', beasts: 3 }, platform: pf(0.6, 'stone', SN(2.4)) })),

  // ===== 建福宫花园 =====
  40627626: lou({ ...Rc(-226.7, -203.2, -407.0, -383.4, S), grade: 3, bays: [2.2, 4.6, 5.3, 4.6, 2.2], depthBays: [2.2, 4.6, 5.3, 4.6, 2.2], corridorDepth: 2.2, overhang: 2.3,
    tile: 'yellow', ridgeColor: 'blue', caihua: 'hexi', platform: { h: 1.0, style: 'xumizuo', stairs: [{ side: 'S', w: 3.6 }, { side: 'N', w: 3.2 }] },
    front: ['wall', 'window', 'door', 'window', 'wall'], back: ['wall', 'window', 'door', 'window', 'wall'],
    stories: [{ colH: 5.0 }, { colH: 4.2, inset: 2.2, balcony: true, front: ['window', 'door', 'window'], back: 'window', sides: 'window' }],
    roof: { type: 'cuanjian', sides: 4, baoding: 'yellow', beasts: 5 } }, '延春阁', DESC.ycg),
  40627620: H(F(40627620, S, yWing({ nBays: 9, colH: 3.6, tile: 'green', roof: { ridgeColor: 'yellow' }, plaque: '敬胜斋', plaqueCharH: 0.24, platform: pf(0.6), desc: DESC.jsz }))),
  40627621: lou({ ...F(40627621, S), grade: 4, nBays: 3, nDepth: 2, tile: 'yellow', ridgeColor: 'green', caihua: 'sushi', platform: pf(0.5), stories: [{ colH: 3.5 }, { colH: 3.0, front: 'window', balcony: 'S' }], roof: { type: 'xieshan', juan: true, beasts: 3 } },
    '吉云楼', '建福宫花园北端三开间两层卷棚歇山楼，黄琉璃瓦绿剪边。'),
  42348511: lou({ ...F(42348511, S), grade: 4, nBays: 7, nDepth: 1, tile: 'yellow', ridgeColor: 'green', caihua: 'sushi', platform: pf(0.5), stories: [{ colH: 3.4 }, { colH: 3.0, front: 'window' }], roof: { type: 'yingshan', gableWallMat: 'wall_red', beasts: 3 } }, '慧曜楼', DESC.hyl),
  42348512: glld({ ...F(42348512, S), grade: 4, bays: [2.0, 4.6, 5.5, 4.6, 2.0], nDepth: 3, colH: 3.8, tile: 'green', caihua: 'sushi', overhang: 1.2, corridor: true,
    front: ['open', 'window', 'door', 'window', 'open'], back: ['open', 'window', 'window', 'window', 'open'], sides: 'wall', platform: pf(0.8, 'stone', [{ side: 'S', w: 3 }]), plaque: '静怡轩', plaqueCharH: 0.26,
    roof: { type: 'xuanshan', juan: true, ridgeColor: 'yellow' } }, 3, null, '静怡轩', DESC.jyx),
  43485439: lou({ ...F(43485439, E), grade: 4, nBays: 5, nDepth: 1, tile: 'green', ridgeColor: 'yellow', caihua: 'sushi', platform: pf(0.5), stories: [{ colH: 3.4 }, { colH: 3.0, front: 'window' }], roof: { type: 'xieshan', juan: true, beasts: 3 } },
    '碧琳馆', '建福宫花园西侧，坐西朝东，三开间歇山卷棚楼，左右各带耳楼一间，绿琉璃瓦黄剪边。'),
  42348531: H(F(42348531, E, { grade: 4, nBays: 3, nDepth: 3, corridor: 1.2, backCorridor: false, colH: 3.5, tile: 'yellow', caihua: 'sushi', plaque: '凝晖堂', plaqueCharH: 0.24, platform: pf(0.6),
    roof: { type: 'xieshan', juan: true, ridgeColor: 'green', beasts: 3 }, desc: '延春阁西侧，坐西朝东，三开间卷棚歇山，前出廊，黄琉璃瓦绿剪边。' })),
  42348514: fn((ctx) => {
    // 延春阁前叠石假山，山上积翠亭（四角攒尖方亭，绿琉璃瓦黄剪边）
    const r = buildRockery(ctx.at(-214.0, 0, -371.0, 0), { w: 18, d: 17, h: 4.2, seed: 11, style: 'taihu', topW: 7.6, topD: 7.0, topZ: 4.4, steps: true });
    const top = r.top ?? 4.2;
    const t = buildHall(ctx.at(-214.0, top, -366.6, 0), { kind: 'pavilion', grade: 4, bays: [4.6], depthBays: [4.6], colH: 3.0, overhang: 1.0, caihua: 'sushi', tile: 'green',
      roof: { type: 'cuanjian', sides: 4, ridgeColor: 'yellow', baoding: 'green', beasts: 1 }, platform: pf(0.3) });
    return top + t.topY;
  }, '积翠亭', '延春阁正南假山之上的方亭，四角攒尖，绿琉璃瓦黄剪边，四方琉璃宝顶。'),
  649245656: fn((ctx) => {
    // 玉壶冰：两座三间歇山楼 + 转角游廊楼（共十三间），黄琉璃瓦绿剪边
    const lo = { grade: 4, nBays: 3, nDepth: 1, tile: 'yellow', ridgeColor: 'green', caihua: 'sushi', platform: pf(0.4), stories: [{ colH: 3.2 }, { colH: 2.8, front: 'window' }], roof: { type: 'xieshan', juan: true, beasts: 1 } };
    let t = 0;
    for (const s of [Rc(-240.8, -235.8, -376.5, -364.3, E, lo), Rc(-230.0, -220.5, -365.8, -361.2, N, lo), Rc(-235.8, -230.0, -369.4, -364.2, N, { ...lo, nBays: 2, roof: { type: 'xuanshan', juan: true } })])
      t = Math.max(t, buildLou(ctx.at(s.x, 0, s.z, s.rotY), s).topY);
    return t;
  }, '玉壶冰', '延春阁南假山西南，由两座三间歇山楼和一座转角游廊楼组成，共十三间，黄琉璃瓦绿剪边。'),
  42348513: 'skip', // 存性门（垂花门，build 中建）

  // ===== 城隍庙（西北角） =====
  40606193: H(F(40606193, S, yWing({ nBays: 7, colH: 3.4, front: ['wall', 'wall', 'window', 'gate', 'window', 'wall', 'wall'], back: ['wall', 'wall', 'window', 'door', 'window', 'wall', 'wall'], noLabel: true }))),
  40606188: H({ ...F(40606188, S), grade: 3, nBays: 3, nDepth: 2, colH: 4.2, dougong: { kou: 0.06, cai: 3 }, roof: { type: 'xieshan', beasts: 5 }, platform: pf(0.9, 'stone', [{ side: 'S', w: 3 }]), desc: DESC.chm }),
  40606199: H(F(40606199, E, yRoom({ noLabel: true }))), 40606198: H(F(40606198, W, yRoom({ noLabel: true }))),
  40606200: H(F(40606200, E, yRoom({ noLabel: true }))), 40606197: H(F(40606197, W, yRoom({ noLabel: true }))),
  40606196: H(F(40606196, E, yRoom({ noLabel: true }))), 40606195: H(F(40606195, W, yRoom({ noLabel: true }))),
  40606194: H(F(40606194, E, yRoom({ noLabel: true }))), 40606201: H(F(40606201, W, yRoom({ noLabel: true }))),
  40606187: H(F(40606187, S, yWing({ nBays: 5, colH: 3.6, platform: pf(0.6), noLabel: true }))),
  40606191: H(F(40606191, S, gRoom({ noLabel: true }))), 40606192: H(F(40606192, S, gRoom({ noLabel: true }))),

  // ===== 北墙内侧排房 =====
  40606189: H(F(40606189, S, gRoom({ noLabel: true }))), 40606190: H(F(40606190, S, gRoom())),
  42311499: H(F(42311499, S, yRoom())), 42311501: H(F(42311501, S, yRoom())), 42311939: H(F(42311939, S, gRoom())),
  40606297: H(F(40606297, S, yRoom())), 40606299: H(F(40606299, S, yRoom())),
  40606295: H(F(40606295, S, yRoom({ noLabel: true }))), 40606302: H(F(40606302, S, yRoom({ noLabel: true }))), 40606303: H(F(40606303, S, yRoom({ noLabel: true }))),
  40606301: arr([Rc(-291.2, -278.9, -468.8, -449.5, E, gRoom()), Rc(-278.9, -267.8, -468.8, -461.7, S, gRoom())], { noLabel: true }),
  40606296: arr([Rc(-246.6, -229.0, -469.7, -448.4, W, gRoom({ nDepth: 2 })), Rc(-258.6, -246.6, -469.5, -462.0, S, gRoom())], { noLabel: true }),
  42740554: arr([Rc(-395.0, -384.5, -491.6, -473.4, E, gRoom()), Rc(-384.5, -375.5, -491.6, -482.6, S, gRoom())]),

  // ===== 西河沿：故宫文物医院（六区） =====
  ...Object.fromEntries([625787541, 625787542, 625787543, 40606184, 40606185, 40606186].map((id) => [id,
    glld(F(id, E, gRoom({ nDepth: 4, colH: 4.0, caihua: 'sushi', platform: pf(0.45), roof: { type: 'yingshan', gableWallMat: 'brick_grey', wen: false, beasts: -1 } })), 2, null, false)])),
  40543882: glld(F(40543882, S, gRoom({ nDepth: 3, colH: 4.0, caihua: 'sushi', platform: pf(0.45) })), 2, null, false),
};

// ---------------- 墙体覆盖 ----------------
const wallPts = (id) => SITE.walls.find((w) => w.id === id).pts;
const wallOverrides = {
  41657479: { gaps: [segRange(wallPts(41657479), 0)] }, // 慈宁门西八字影壁处
  42569644: { gaps: [segRange(wallPts(42569644), 5)] }, // 慈宁门东八字影壁处
  42348535: 'skip', // 春华门（琉璃门，build 中建）
  688124105: { h: 6.4, thick: 1.5 },
  42569649: { h: 4.6, thick: 1.0 }, 42569650: { h: 4.6, thick: 1.0 }, 42569651: { h: 4.6, thick: 1.0 },
  42569656: { h: 4.6, thick: 1.0 }, 42569657: { h: 4.6, thick: 1.0 }, 42569659: { h: 4.6, thick: 1.0 },
  42509838: { h: 4.6, thick: 1.0 }, 42509839: { h: 4.6, thick: 1.0 },
};

// ---------------- 补充构筑 ----------------
function build(ctx0, api) {
  const ctx = fx(ctx0);
  const L = api.label;
  // ===== 墙门 =====
  const liuli = (x, z, rot, w, h, o = {}) => wallGate(ctx, x, z, rot, { type: 'liuli', w, h, wallH: 5.8, ...o });
  const sq = (x, z, rot, w = 3.7, h = 6.4) => wallGate(ctx, x, z, rot, { type: 'suiqiang', w, h, wallThick: 1.1 });
  let t;
  for (const z of [-44.7, -50.3, -55.9]) t = liuli(-284.8, z, E, 3.6, 6.2, { wallH: 4.6 });
  L('永康右门', -284.8, t + 2, -50.3, '慈宁门前广场西端门，三座随墙琉璃门，通寿康宫一带。');
  for (const z of [-44.7, -50.3, -55.9]) t = liuli(-158.7, z, W, 3.6, 6.2, { wallH: 4.6 });
  L('永康左门', -158.7, t + 2, -50.3, '慈宁门前广场东端门，三座随墙琉璃门，东出即隆宗门外。');
  for (const x of [-227.3, -221.7, -216.2]) t = liuli(x, -41.4, N, 3.6, 6.2, { wallH: 4.6 });
  L('长信门', -221.7, t + 2, -41.4, '慈宁门前广场南侧正中之门，与慈宁门相对。');
  sq(-264.4, -59.4, S);
  t = liuli(-287.9, -102.6, S, 6.8, 7.4);
  L('寿康门', -287.9, t + 2, -102.6, '寿康宫正门，琉璃门；门前小广场东通徽音右门。');
  // 寿安门：三座随墙琉璃门，中门内设木屏门照壁
  liuli(-289.5, -210.3, S, 6.4, 6.8); t = liuli(-276.5, -210.3, S, 7.4, 7.6); liuli(-262.6, -210.4, S, 6.4, 6.8);
  L('寿安门', -276.5, t + 2, -210.3, '寿安宫正门，三座随墙琉璃门，中门内设四扇木屏门照壁。');
  buildScreenWall(ctx.at(-276.5, 0, -215.2, 0), { style: 'red', w: 6.6, h: 4.2, thick: 0.6 });
  // 慈宁宫后（西三所）各所随墙门
  for (const x of [-246.8, -222.6, -199.1, -173.9]) sq(x, -162.0, S, 4.4, 6.0);
  // 其余随墙门（南北向墙上，东西开门）
  for (const [x, z] of [[-317.2, -206.4], [-236.35, -206.65], [-247.0, -329.25], [-306.25, -328.6], [-336.55, -378.8], [-185.3, -157.5], [-173.5, -367.6]]) sq(x, z, E, 3.7, 6.2);
  t = sq(-173.7, -264.25, E, 3.7, 6.2); L('绥福门', -173.7, t + 2, -264.25);
  t = sq(-173.6, -315.85, E, 3.7, 6.2); L('永庆门', -173.6, t + 2, -315.85);
  t = liuli(-276.15, -364.05, S, 8.2, 7.4); L('英华门', -276.15, t + 2, -364.05, '英华殿内院正门，琉璃门。');
  t = liuli(-211.55, -213.6, S, 9.9, 8.0, { wallThick: 2.6, wallH: 6.4 }); L('春华门', -211.55, t + 2, -213.6, '雨花阁院正门，位于雨花阁正南。');
  t = liuli(-212.6, -272.65, S, 6.0, 6.8); L('昭福门', -212.6, t + 2, -272.65, '雨花阁正北之门，进门即宝华殿。');
  t = liuli(-183.65, -239.05, S, 6.0, 6.8); L('延庆门', -183.65, t + 2, -239.05);
  t = liuli(-182.85, -264.3, S, 6.0, 6.8); L('广德门', -182.85, t + 2, -264.3);
  t = liuli(-182.85, -319.1, S, 6.0, 6.8); L('建福门', -182.85, t + 2, -319.1, '建福宫正门。');
  t = wallGate(ctx, -183.05, -384.35, S, { type: 'chuihua', w: 3.8, h: 6.2, tile: 'green', depth: 3.0 });
  L('存性门', -183.05, (t || 6) + 2, -384.35, '惠风亭正北、静怡轩之前的一殿一卷垂花门，绿琉璃瓦黄剪边。');

  // ===== 慈宁门：八字琉璃影壁、鎏金铜麒麟 =====
  buildScreenWall(ctx.at(-235.9, 0, -60.1, 0.487), { style: 'liuli', w: 4.4, h: 5.0, thick: 1.0 });
  buildScreenWall(ctx.at(-206.85, 0, -59.7, -0.55), { style: 'liuli', w: 4.4, h: 5.0, thick: 1.0 });
  for (const sx of [-1, 1]) ctx.place('cn_qilin', -221.7 + sx * 9.4, 0, -55.6, 0, 3.0);
  L('鎏金铜麒麟', -221.7 - 9.4, 5, -55.6, '慈宁门前阶下左右各一，铜胎鎏金，蹲坐于石须弥座上，独角、鹿身、牛尾、龙鳞，象征仁德祥瑞。');
  // 慈宁门 → 慈宁宫：高台甬道、月台（正面三阶、左右各一阶）、鎏金铜香炉四座
  pave(ctx, -224.5, -218.5, -92.4, -73.4, 0.35, 'paving_imperial');
  buildPlatform(ctx, { poly: [[-236, -102.2], [-207, -102.2], [-207, -92.4], [-236, -92.4]], h: 1.45, style: 'stone',
    stairs: [{ at: [-221.5, -92.4], w: 4.4, yulu: { w: 1.6 } }, { at: [-230.5, -92.4], w: 3.0 }, { at: [-212.5, -92.4], w: 3.0 }, { at: [-236, -97.3], w: 2.8 }, { at: [-207, -97.3], w: 2.8 }] });
  for (const x of [-232.5, -227.5, -215.5, -210.5]) ctx.place('censer:ding', x, 1.45, -98.6, 0, 2.0);
  // 东西卡墙与垂花门（通后院）
  for (const [x0, x1, gx] of [[-252.3, -241.0, -246.6], [-201.9, -191.2, -196.5]]) {
    const L0 = gx - x0;
    buildPalaceWall(ctx, { path: [[x0, -110.8], [x1, -110.8]], h: 4.6, thick: 0.9, cap: 'yellow', gaps: [{ from: L0 - 1.85, to: L0 + 1.85 }] });
    wallGate(ctx, gx, -110.8, S, { type: 'chuihua', w: 3.6, h: 5.6, depth: 2.6 });
  }
  // 大佛堂前香炉、香筒
  for (const x of [-226, -217]) ctx.place('censer:tower', x, 0, -138.6, 0, 2.4);
  pave(ctx, -223.3, -219.3, -141.2, -125.6, 0.08);

  // ===== 寿康宫：甬路、月台 =====
  pave(ctx, -290.2, -286.8, -129.6, -103.6, 0.08);
  buildPlatform(ctx, { poly: [[-296.5, -131.8], [-280.5, -131.8], [-280.5, -127.0], [-296.5, -127.0]], h: 0.95, style: 'stone', stairs: [{ at: [-288.5, -127.0], w: 3.4 }] });
  pave(ctx, -290.0, -287.0, -163.0, -147.6, 0.25, 'paving_imperial');
  for (const x of [-293.5, -283.5]) ctx.place('censer:ding', x, 0.95, -129.4, 0, 1.6);

  // ===== 寿安宫：甬路、假山 =====
  pave(ctx, -278.0, -275.0, -241.2, -211.8, 0.08);
  pave(ctx, -277.5, -274.5, -284.6, -261.6, 0.08);
  buildRockery(ctx.at(-276.2, 0, -314.0, 0), { w: 12, d: 7.5, h: 4.0, seed: 23, style: 'taihu', steps: 1 });

  // ===== 英华殿：甬路、月台、香炉、菩提树 =====
  paveLine(ctx, [[-276.1, -346.2], [-276.1, -362.4]], 3.0, 0.08);
  paveLine(ctx, [[-276.0, -366.0], [-276.0, -373.0]], 3.0, 0.08);
  paveLine(ctx, [[-275.6, -381.6], [-275.6, -387.4]], 3.0, 0.08);
  buildPlatform(ctx, { poly: [[-285.0, -391.8], [-266.2, -391.8], [-266.2, -387.2], [-285.0, -387.2]], h: 1.15, style: 'stone',
    stairs: [{ at: [-275.6, -387.2], w: 3.6 }, { at: [-285.0, -389.5], w: 2.2 }, { at: [-266.2, -389.5], w: 2.2 }] });
  ctx.place('censer:tower', -275.6, 1.15, -389.6, 0, 2.6);
  ctx.place('stele', -275.6, 0.7, -377.3, 0, 3.4);

  // ===== 雨花阁一区：甬路、香炉 =====
  paveLine(ctx, [[-211.6, -216.0], [-211.6, -228.2]], 3.4, 0.08);
  paveLine(ctx, [[-212.4, -275.0], [-212.4, -292.6]], 3.0, 0.08);
  paveLine(ctx, [[-212.4, -308.5], [-212.4, -312.4]], 2.6, 0.08);
  paveLine(ctx, [[-212.0, -322.6], [-212.0, -326.6]], 2.6, 0.08);
  ctx.place('censer:tower', -211.5, 0, -224.0, 0, 2.6);

  // ===== 建福宫：甬路 =====
  paveLine(ctx, [[-183.2, -241.4], [-183.2, -246.0]], 2.8, 0.08);
  paveLine(ctx, [[-183.0, -321.4], [-183.0, -328.4]], 2.8, 0.08);
  paveLine(ctx, [[-182.9, -337.8], [-182.9, -345.6]], 2.8, 0.08);
  paveLine(ctx, [[-182.8, -372.0], [-182.8, -382.0]], 2.4, 0.08);
  paveLine(ctx, [[-183.0, -386.8], [-183.0, -399.4]], 2.4, 0.08);

  // ===== 慈宁宫花园（北半）：甬路、花坛 =====
  for (const [z0, z1] of [[-3.4, 9.0], [14.6, 25.8], [33.0, 40.0]]) paveLine(ctx, [[-258.6, z0], [-258.6, z1]], 3.2, 0.06, 'paving_square');
  paveLine(ctx, [[-282.5, 2.5], [-235.0, 2.5]], 2.0, 0.05, 'paving_square');
  buildPlatform(ctx, { poly: [[-261.8, 26.2], [-255.4, 26.2], [-255.4, 32.6], [-261.8, 32.6]], h: 1.0, style: 'xumizuo_brick', floor: false });
  buildLawn(ctx, { poly: [[-261.4, 26.6], [-255.8, 26.6], [-255.8, 32.2], [-261.4, 32.2]], y: 0.95, kind: 'bed', shrubs: 0.5, flowers: true, seed: 3 });
  buildPlatform(ctx, { poly: [[-261.0, 9.4], [-256.2, 9.4], [-256.2, 14.2], [-261.0, 14.2]], h: 0.7, style: 'xumizuo_brick', floor: false });
  buildLawn(ctx, { poly: [[-260.6, 9.8], [-256.6, 9.8], [-256.6, 13.8], [-260.6, 13.8]], y: 0.65, kind: 'bed', shrubs: 0.5, flowers: true, seed: 4 });

  // ===== 树木 =====
  plant(ctx, [
    // 慈宁宫花园：古柏、古松、银杏
    [-268.5, -1.5, 'cypress', 13], [-248.7, -1.5, 'cypress', 12], [-270.5, 9.0, 'pine', 10], [-246.8, 9.0, 'pine', 11],
    [-266.8, 18.5, 'cypress', 12], [-250.5, 18.5, 'cypress', 13], [-272.0, 28.0, 'ginkgo', 18], [-245.0, 28.0, 'ginkgo', 17],
    [-266.0, 36.0, 'pine', 10], [-251.2, 36.0, 'pine', 9], [-276.0, -2.0, 'cypress', 11], [-241.5, -2.0, 'cypress', 11],
    [-266.5, -30.6, 'cypress', 10], [-249.5, -30.6, 'cypress', 10],
    // 寿康宫后院、寿安宫
    [-296.0, -155.5, 'locust', 13], [-281.0, -155.5, 'locust', 13],
    [-286.5, -270.0, 'pine', 10], [-266.0, -270.0, 'pine', 10], [-287.0, -280.0, 'cypress', 11], [-265.5, -280.0, 'cypress', 11],
    [-284.5, -310.5, 'pine', 9], [-268.0, -318.0, 'cypress', 10],
    // 英华殿：菩提树二株（椴树），院中古柏
    [-282.6, -379.0, 'locust', 14], [-268.6, -379.0, 'locust', 14], [-298.0, -372.0, 'cypress', 12], [-254.0, -372.0, 'cypress', 12],
    // 西三所、头所
    [-235.0, -176.0, 'locust', 12], [-187.0, -184.0, 'locust', 12], [-170.0, -106.0, 'locust', 11],
    // 建福宫花园
    [-229.5, -386.0, 'pine', 10], [-200.0, -386.5, 'cypress', 11], [-229.5, -411.0, 'cypress', 11], [-200.5, -411.0, 'pine', 10],
    [-221.0, -377.5, 'pine', 8], [-205.5, -377.0, 'pine', 9], [-192.0, -394.0, 'cypress', 10],
    // 城隍庙
    [-357.0, -393.0, 'cypress', 11], [-344.5, -393.0, 'cypress', 11],
    // 西河沿（内金水河东岸）
    ...[-330, -290, -250, -210, -170, -130, -90, -50, -10, 25].map((z, i) => [-323.5, z, i % 3 === 1 ? 'willow' : 'locust', 12]),
  ]);

  // ===== 群组标签 =====
  L('冰窖', -151.6, 8, -18.0, DESC.bj);
  L('故宫文物医院', -351.0, 12, -133.8, DESC.wwyy);
  L('西三所', -222.0, 10, -178.0, '慈宁宫后（北）三组院落（东、中、西所），清代为太妃、太嫔居所，各所前设随墙门。');
}

export default {
  key: 'cining',
  title: '外西路（慈宁宫、寿康宫、寿安宫、英华殿、雨花阁、建福宫）',
  overrides,
  wallOverrides,
  bridgeOverrides: {},
  build,
};
