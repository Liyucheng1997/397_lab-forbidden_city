// 分区：外朝中轴（午门—太和门—三大殿—乾清门广场）
// 午门（自定义凹字形墩台+五凤楼）、内金水河与五座金水桥、太和门及两侧门庑、太和殿广场（体仁阁/弘义阁、左右翼门、四崇楼、廊庑）、
// 三台（汉白玉须弥座三层）与三大殿、乾清门广场（景运门/隆宗门、军机处、九卿值房）。
import { propHeight } from '../core/props.js';
import { buildPlatform } from '../core/platform.js';
import { buildBay } from '../core/openings.js';
import { boxGeo, clamp } from '../core/geom.js';
import { buildWallGate } from '../core/walls.js';
import { buildHall } from '../core/building.js';
import { T1, T3, FS, FN, FE, FW, hallOn, gateDoors, ramp, slab, rect, palaceWall, purlinFix } from './axis_south/lib.js';
import { buildWumen } from './axis_south/wumen.js';
import { buildSantai, placeSantaiProps } from './axis_south/santai.js';
import { buildJinshui } from './axis_south/jinshui.js';

const AXS = -1.2; // 太和门与中路金水桥的中轴（OSM 实测略偏西）
const LAT = 'sanjiao';
const odd = (x) => Math.max(1, 2 * Math.round((x - 1) / 2) + 1);

/** 自动推断 + 补丁（与对象覆盖等价，但经 purlinFix 包装以规避小式檐檩偏移） */
const A = (patch) => (ctx, b, api) => {
  let top = 0;
  for (const it of api.autoItems(b)) {
    const spec = api.mergeSpec(it.spec || {}, patch);
    const info = buildHall(purlinFix(ctx.at(patch.x ?? it.x, spec.y0 ?? 0, patch.z ?? it.z, patch.rotY ?? it.rotY)), spec);
    top = Math.max(top, info.topY || 0);
  }
  if (b.tags.name && !patch.noLabel) api.label(b.tags.name, b.obb.cx, top + 2, b.obb.cz, patch.desc || '');
};

/** 函数覆盖 + 标注 */
const L = (name, desc, fn) => (ctx, b, api) => {
  const r = fn(ctx, b, api) || {};
  if (name) api.label(name, r.lx ?? b.obb.cx, (r.top ?? 12) + 2, r.lz ?? b.obb.cz, desc);
};

// ---------------- 门 ----------------
/** 三间单檐歇山门殿（昭德/贞度、中左/中右、后左/后右）：中柱缝明间设板门，台基前后踏跺 */
function sideGate(ctx, { x, z, px = x, pw = 23.7, pd = 21.8, ph = 1.6, run = 4.2, plaque, rotY = FS, sw = 7.0 }) {
  const r = hallOn(ctx, {
    x, z, rotY, kind: 'gate', grade: 3,
    pf: { cx: px, cz: z, h: ph, style: 'xumizuo', w: pw, d: pd, stairs: [{ at: [x - px, pd / 2], w: sw, run }, { at: [x - px, -pd / 2], w: sw, run }] },
    bays: [6.9, 8.8, 6.9], depthBays: [6.85, 6.85], eaveW: 26.7, eaveD: 17.8, colH: 5.2,
    dougong: { kou: 0.075, cai: 5 }, caihua: 'hexi', front: ['wall', 'open', 'wall'],
    roof: { type: 'xieshan', beasts: 5 }, plaque,
  });
  gateDoors(r.c, r.info, [1], { openW: 4.6 });
  return { top: r.top, lx: x, lz: z };
}

/** 五间三启单檐歇山门（熙和/协和、景运/隆宗、左翼/右翼） */
function gate5(ctx, { x, z, rotY, eaveW, eaveD, colH = 5.6, pf, plaque, beasts = 7, kou = 0.075, cai = 5 }) {
  const ovh = ((cai - 1) / 2) * 3 * kou + Math.min(2.4, Math.max(0.9, 21 * kou));
  const colW = eaveW - 2 * ovh;
  const end = colW * 0.18, mid = colW * 0.24, sec = (colW - 2 * end - mid) / 2;
  const r = hallOn(ctx, {
    x, z, rotY, kind: 'gate', grade: 3, pf,
    bays: [end, sec, mid, sec, end], nDepth: 2, eaveW, eaveD, colH,
    dougong: { kou, cai }, caihua: 'hexi', front: ['wall', 'open', 'open', 'open', 'wall'],
    roof: { type: 'xieshan', beasts }, plaque,
  });
  gateDoors(r.c, r.info, [1, 2, 3], { openW: 4.0 });
  return { top: r.top, lx: x, lz: z };
}

// ---------------- 庑 ----------------
/**
 * 廊庑：沿局部 X 长 L、进深（屋檐）D，前出廊；台基 ph；doorsAt 为开门的开间（自西/北起，按比例 0..1）。
 * 黄琉璃瓦单檐硬山（两端与门、楼相接），一斗三升斗拱或小式。
 */
function wu(ctx, { x, z, rotY, L: len, D, ph = 1.2, colH = 4.2, grade = 3, doors = [0.5], pf, tile = 'yellow', roof = 'yingshan', bay = 4.0, corridor = 2.0, back = 'wall' }) {
  const dg = grade <= 3 ? { kou: 0.07, cai: 1 } : false;
  const ovh = dg ? 1.5 * 0.07 + 21 * 0.07 : 1.0;
  const n = odd((len - 2 * ovh) / bay);
  const front = Array.from({ length: n }, (_, i) => (doors.some((f) => Math.abs((i + 0.5) / n - f) < 0.5 / n + 1e-6) ? 'door' : 'window'));
  return hallOn(ctx, {
    x, z, rotY, grade, kind: 'hall',
    pf: pf || { h: ph, style: 'stone', w: len - 2 * ovh + 1.4, d: D - 2 * ovh + 1.6, stairs: [] },
    nBays: n, nDepth: 3, corridor, eaveW: len, eaveD: D, colH, overhang: ovh,
    dougong: dg, caihua: grade <= 3 ? 'xuanzi' : 'xuanzi', backCorridor: false,
    front, back, roof: { type: roof, beasts: grade <= 3 ? 3 : 1, gableWallMat: tile === 'grey' ? 'brick_grey' : 'wall_red' }, tile,
  });
}

/** 礓碴坡道（世界坐标）：自台边 (x,z) 向 dir（'E'|'W'|'N'|'S'）下行 */
function rampAt(ctx, x, z, dir, { w = 3.6, h = 1.2, run = 6 } = {}) {
  const rot = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[dir];
  ramp(ctx.at(x, 0, z, rot), { w, h, run });
}

// ---------------- 楼 ----------------
/** 崇楼：方三间周围廊，重檐歇山，黄琉璃瓦 */
function chonglou(ctx, x, z, rotY) {
  const r = hallOn(ctx, {
    x, z, rotY, grade: 2,
    pf: { h: 1.6, style: 'xumizuo', w: 17.4, d: 17.4, stairs: [{ at: [0, 9], w: 3.4, run: 3.6 }] },
    bays: [2.05, 3.45, 4.1, 3.45, 2.05], depthBays: [2.05, 3.45, 4.1, 3.45, 2.05], eaveW: 19.2, eaveD: 19.0, colH: 5.4,
    dougong: { kou: 0.075, cai: 5, lowerCai: 3 }, caihua: 'hexi',
    double: { inset: 2.05, upperH: 3.6 },
    roof: { type: 'xieshan', beasts: 7 },
    front: ['wall', 'window', 'door', 'window', 'wall'], back: ['wall', 'window', 'window', 'window', 'wall'], sides: 'wall',
  });
  upperWindows(r, 3.6);
  return { top: r.top, lx: x, lz: z };
}

/** 重檐楼阁上层（下檐围脊至上檐额枋之间）四面槛窗 */
function upperWindows(r, upperH) {
  const { info, c } = r, s = info.spec, Dm = s.colDia, beamH = clamp(Dm * 0.95, 0.2, 1.0);
  const wallT = clamp(Dm * 1.1, 0.4, 1.2), off = wallT * 0.3 + 0.1;
  const y0 = info.skirt.topY + 0.12, h = upperH - beamH * 2.1 - 0.12;
  const inset = s.double.inset ?? s.bays[0], hw = s.colW / 2, hd = s.colD / 2;
  const ux = info.colsX.filter((x) => x > -hw + inset - 1e-6 && x < hw - inset + 1e-6);
  const uz = info.colsZ.filter((z) => z > -hd + inset - 1e-6 && z < hd - inset + 1e-6);
  const runs = [[ux, (m) => [m, uz[uz.length - 1] + off], 0], [ux, (m) => [m, uz[0] - off], Math.PI], [uz, (m) => [ux[ux.length - 1] + off, m], Math.PI / 2], [uz, (m) => [ux[0] - off, m], -Math.PI / 2]];
  for (const [pts, at, rot] of runs) for (let i = 0; i < pts.length - 1; i++) {
    const [px, pz] = at((pts[i] + pts[i + 1]) / 2);
    buildBay(c.at(px, y0, pz, rot), { type: 'window', w: pts[i + 1] - pts[i] - Dm * 0.9, h, colD: Dm, sill: 0.7 });
  }
}

/** 体仁阁 / 弘义阁：面阔九间、进深三间，上下两层，单檐庑殿，坐落崇基之上 */
function ge(ctx, { x, z, rotY, pf, plaque }) {
  const r = hallOn(ctx, {
    x, z, rotY, tower: true, grade: 2, pf,
    eaveW: 46.4, eaveD: 20.2, nBays: 9, nDepth: 3,
    dougong: { kou: 0.075, cai: 5 }, caihua: 'hexi', tile: 'yellow',
    stories: [
      { colH: 6.0, front: ['wall', 'window', 'window', 'door', 'door', 'door', 'window', 'window', 'wall'], back: 'wall', sides: 'wall' },
      { colH: 5.0, inset: 1.35, front: 'window', back: 'window', sides: 'wall' },
    ],
    roof: { type: 'wudian', beasts: 7 }, plaque,
  });
  return r;
}

// ---------------- 小式值房 ----------------
function office(ctx, { x, z, rotY, w, d, colH = 3.2, tile = 'yellow', juan = true, roof = 'yingshan', grade = 5, front }) {
  const n = odd((w - 1.6) / 3.6);
  return hallOn(ctx, {
    x, z, rotY, grade, kind: 'hall',
    pf: { h: 0.45, style: 'plain', w: w - 0.6, d: d - 0.6, stairs: [{ at: [0, d], w: 2.4, run: 0.9 }] },
    nBays: n, nDepth: 1, eaveW: w, eaveD: d, colH, dougong: false, caihua: 'xuanzi',
    front: front || Array.from({ length: n }, (_, i) => (i === (n - 1) / 2 ? 'door' : 'zhizhai')), back: 'wall',
    roof: { type: roof, juan, beasts: roof === 'yingshan' ? -1 : 1, gableWallMat: tile === 'grey' ? 'brick_grey' : 'wall_red' }, tile,
  });
}

// =====================================================================
const D = {
  wumen: '紫禁城正门。',
  taihemen: '外朝正门，明永乐十八年（1420）建，现存为光绪二十年（1894）重建。面阔九间、进深四间，重檐歇山，高23.8米，坐落汉白玉须弥座台基上，前后三出陛，门前一对铜狮为紫禁城最大。',
  taihedian: '俗称金銮殿，紫禁城等级最高的殿宇，现存为康熙三十四年（1695）重建。面阔十一间、进深五间，重檐庑殿，殿高26.92米（连三台通高35.05米），上檐十一踩、下檐九踩斗拱，金龙和玺彩画，三交六椀菱花隔扇，脊上走兽十个（唯一有行什）。',
  zhonghedian: '皇帝赴太和殿大典前休憩、演习礼仪之所，明永乐十八年建，现存为明天启七年（1627）重建。平面方形，面阔、进深各五间，四面出廊，单檐四角攒尖，鎏金宝顶，金龙和玺彩画。',
  baohedian: '清代除夕、正月十五宴请外藩王公，乾隆以后为殿试之所，现存为明万历四十三年（1615）重建。面阔九间、进深五间，重檐歇山，通高29.5米，前檐减柱造。殿后三台北陛为紫禁城最大的云龙石雕（长16.57米、宽3.07米）。',
};

const overrides = {
  // ---- 午门（凹字形墩台整体重建）与凹口内的现代检票设施（不予表现） ----
  638156366: (ctx, b, api) => { buildWumen(ctx, api); },
  638156236: 'skip', 638156248: 'skip', 685292441: 'skip', 685292442: 'skip',

  // ---- 太和门 ----
  638308745: L('太和门', D.taihemen, (ctx) => {
    const x = AXS, z = 305.9;
    const st = (sz, run) => [
      { at: [0, sz], w: 5.8, run, yulu: { w: 2.6 }, railings: true },
      { at: [-7.6, sz], w: 3.0, run, railings: true }, { at: [7.6, sz], w: 3.0, run, railings: true },
    ];
    const r = hallOn(ctx, {
      x, z, rotY: FS, kind: 'gate', grade: 1,
      pf: { h: 3.44, style: 'xumizuo', w: 56.3, d: 29.8, railing: { style: 'marble' },
        stairs: [...st(14.9, 10.9), ...st(-14.9, 11.5), { at: [28.2, 10.6], w: 2.4, run: 6.6, railings: true }, { at: [-28.2, 10.6], w: 2.4, run: 7.8, railings: true }] },
      bays: [4.8, 5.2, 5.4, 5.6, 7.3, 5.6, 5.4, 5.2, 4.8], depthBays: [4.8, 5.55, 5.55, 4.8], eaveW: 54.9, eaveD: 26.3, colH: 6.0,
      dougong: { kou: 0.085, cai: 9, lowerCai: 7 }, caihua: 'hexi',
      double: { inset: 4.8 },
      roof: { type: 'xieshan', beasts: 7 },
      front: ['wall', 'wall', 'wall', 'open', 'open', 'open', 'wall', 'wall', 'wall'],
      plaque: '太和门',
    });
    gateDoors(r.c, r.info, [3, 4, 5], { openW: 4.4 });
    // 门前铜狮（东雄西雌），紫禁城最大
    ctx.place('lion:m', x + 15.5, 0, z + 21.6, 0, propHeight('lion'));
    ctx.place('lion:f', x - 15.5, 0, z + 21.6, 0, propHeight('lion'));
    return { top: r.top, lx: x, lz: z };
  }),
  638320792: L('昭德门', '太和门东侧门，明称东角门，嘉靖时改弘政门，清顺治二年改今名。单檐歇山，黄琉璃瓦，前后踏跺，连通太和门广场与太和殿广场。',
    (ctx) => sideGate(ctx, { x: 62.0, z: 305.5, plaque: '昭德门' })),
  638320793: L('贞度门', '太和门西侧门，明称西角门，嘉靖时改宣治门，清顺治二年改今名。单檐歇山，黄琉璃瓦，前后踏跺。',
    (ctx) => sideGate(ctx, { x: -64.6, z: 305.0, plaque: '贞度门' })),
  638320784: 'skip', // 昭德门台基南沿的 OSM 碎条
  // 太和门两侧门庑（连接太和门—昭德/贞度门—崇楼）
  638329249: (ctx) => { wu(ctx, { x: 37.6, z: 306.6, rotY: FS, L: 22.1, D: 11.2, ph: 1.6, colH: 4.6, doors: [] }); },
  638329250: (ctx) => { wu(ctx, { x: -40.4, z: 306.4, rotY: FS, L: 22.0, D: 11.2, ph: 1.6, colH: 4.6, doors: [] }); },
  638344003: (ctx) => { wu(ctx, { x: 86.7, z: 305.6, rotY: FS, L: 23.1, D: 11.0, ph: 1.6, colH: 4.6, doors: [] }); },
  638344012: (ctx) => { wu(ctx, { x: -87.8, z: 306.0, rotY: FS, L: 20.1, D: 11.0, ph: 1.6, colH: 4.6, doors: [] }); },
  638344315: L('崇楼', '太和殿广场东南隅崇楼。方三间周围廊，重檐歇山，黄琉璃瓦，与四周廊庑相连。', (ctx) => chonglou(ctx, 107.7, 304.7, FN)),
  638344324: L('崇楼', '太和殿广场西南隅崇楼。方三间周围廊，重檐歇山，黄琉璃瓦。', (ctx) => chonglou(ctx, -107.3, 306.3, FN)),
  638507610: L('崇楼', '太和殿广场东北隅崇楼。方三间周围廊，重檐歇山，黄琉璃瓦。', (ctx) => chonglou(ctx, 107.9, -32.7, FS)),
  638507657: L('崇楼', '太和殿广场西北隅崇楼。方三间周围廊，重檐歇山，黄琉璃瓦。', (ctx) => chonglou(ctx, -109.0, -31.7, FS)),

  // ---- 太和门广场：协和门、熙和门与东西庑 ----
  638238294: L('协和门', '太和门广场东门，明称左顺门，嘉靖时改会极门，清改今名。面阔五间、进深二间，五间三启，单檐歇山，黄琉璃瓦，梢间实墙。',
    (ctx) => {
      const r = gate5(ctx, { x: 107.25, z: 391.2, rotY: FW, eaveW: 32.1, eaveD: 17.3, colH: 5.6, plaque: '协和门',
        pf: { cx: 106.75, cz: 391.0, h: 1.1, style: 'xumizuo', w: 22.1, d: 36.4, stairs: [] } });
      rampAt(ctx, 95.7, 391.0, 'W', { w: 20, h: 1.1, run: 17 });
      rampAt(ctx, 117.8, 390.7, 'E', { w: 20, h: 1.1, run: 15.5 });
      return r;
    }),
  638218765: L('熙和门', '太和门广场西门，明称右顺门，嘉靖时改归极门，清改今名，现存为乾隆二十三年（1758）重建。面阔五间、进深二间，五间三启，单檐歇山，黄琉璃瓦。',
    (ctx) => {
      const r = gate5(ctx, { x: -109.45, z: 393.2, rotY: FE, eaveW: 32.2, eaveD: 17.3, colH: 5.6, plaque: '熙和门',
        pf: { cx: -109.45, cz: 392.85, h: 1.1, style: 'xumizuo', w: 21.1, d: 36.5, stairs: [] } });
      rampAt(ctx, -98.9, 393.0, 'E', { w: 20, h: 1.1, run: 16.5 });
      rampAt(ctx, -120.0, 392.4, 'W', { w: 20, h: 1.1, run: 18.5 });
      return r;
    }),
  638218767: (ctx) => { wu(ctx, { x: -109.15, z: 345.85, rotY: FE, L: 57.9, D: 10.0, ph: 0.9, grade: 4, colH: 3.6, doors: [0.43], pf: { cx: -109.6, cz: 345.85, h: 0.9, style: 'stone', w: 14.4, d: 57.9, stairs: [] } }); rampAt(ctx, -102.4, 341.5, 'E', { w: 5.4, h: 0.9, run: 8.4 }); },
  638218799: (ctx) => { wu(ctx, { x: -110.35, z: 441.35, rotY: FE, L: 60.9, D: 10.3, ph: 0.9, grade: 4, colH: 3.6, doors: [0.5], pf: { cx: -110.0, cz: 441.35, h: 0.9, style: 'stone', w: 15.4, d: 60.9, stairs: [] } }); rampAt(ctx, -102.3, 442.2, 'E', { w: 5.0, h: 0.9, run: 7.6 }); },
  638238311: (ctx) => { wu(ctx, { x: 107.6, z: 344.35, rotY: FW, L: 57.1, D: 10.0, ph: 0.9, grade: 4, colH: 3.6, doors: [0.43], pf: { cx: 105.65, cz: 344.35, h: 0.9, style: 'stone', w: 13.9, d: 57.1, stairs: [] } }); rampAt(ctx, 98.7, 340.3, 'W', { w: 5.4, h: 0.9, run: 9.3 }); },
  638238303: (ctx) => { wu(ctx, { x: 106.4, z: 439.55, rotY: FW, L: 60.9, D: 10.2, ph: 0.9, grade: 4, colH: 3.6, doors: [0.5], pf: { cx: 105.05, cz: 439.55, h: 0.9, style: 'stone', w: 12.9, d: 60.9, stairs: [] } }); rampAt(ctx, 98.6, 440.1, 'W', { w: 7.6, h: 0.9, run: 9.0 }); },

  // ---- 太和殿广场：体仁阁、弘义阁、左翼门、右翼门、东西庑 ----
  638590122: L('体仁阁', '太和殿广场东侧，明称文楼，清顺治元年改今名，现存为乾隆四十八年（1783）重建。面阔九间、进深三间，上下两层，单檐庑殿，黄琉璃瓦，坐落于崇基之上，高25米。',
    (ctx) => {
      const r = ge(ctx, { x: 109.0, z: 200.8, rotY: FW, plaque: '体仁阁',
        pf: { cx: 106.75, cz: 199.75, h: 3.0, style: 'xumizuo', w: 28.7, d: 62.9, stairs: [{ at: [-14.35, -0.3], w: 5.2, run: 10.5, railings: false }] } });
      return { top: r.top, lx: 109.0, lz: 200.8 };
    }),
  638590123: L('弘义阁', '太和殿广场西侧，明称武楼，清改今名，与体仁阁东西对峙。面阔九间、进深三间，上下两层，单檐庑殿，黄琉璃瓦，坐落于崇基之上。',
    (ctx) => {
      const r = ge(ctx, { x: -109.4, z: 202.6, rotY: FE, plaque: '弘义阁',
        pf: { cx: -109.1, cz: 201.45, h: 3.0, style: 'xumizuo', w: 27.2, d: 62.9, stairs: [{ at: [13.6, -0.55], w: 5.2, run: 10.5, railings: false }] } });
      return { top: r.top, lx: -109.4, lz: 202.6 };
    }),
  638590140: L('左翼门', '太和殿广场东庑正中之门，面阔五间，单檐歇山，黄琉璃瓦，前后踏跺，东出通文华殿一带。',
    (ctx) => gate5(ctx, { x: 109.2, z: 143.45, rotY: FW, eaveW: 28.3, eaveD: 13.6, colH: 5.0, plaque: '左翼门',
      pf: { cx: 108.7, cz: 143.25, h: 1.5, style: 'xumizuo', w: 21.0, d: 31.5, stairs: [{ at: [-10.5, 0], w: 9.0, run: 4.5 }, { at: [10.5, 0], w: 9.0, run: 4.5 }] } })),
  638590169: L('右翼门', '太和殿广场西庑正中之门，与左翼门东西对称，面阔五间，单檐歇山，黄琉璃瓦，西出通武英殿一带。',
    (ctx) => gate5(ctx, { x: -110.9, z: 143.8, rotY: FE, eaveW: 28.2, eaveD: 13.6, colH: 5.0, plaque: '右翼门',
      pf: { cx: -111.6, cz: 143.85, h: 1.5, style: 'xumizuo', w: 20.2, d: 32.9, stairs: [{ at: [10.1, 0], w: 9.0, run: 4.5 }, { at: [-10.1, 0], w: 9.0, run: 4.5 }] } })),
  // 翼门与阁之间的台基段（卡墙在 build 中统一砌筑）
  638590133: (ctx) => { slabBase(ctx, rect(98.3, 158.9, 115.1, 168.3), 1.5); },
  638590146: (ctx) => { slabBase(ctx, rect(-117.9, 160.2, -101.8, 170.1), 1.5); },
  // 东庑（太和殿广场）：南段院墙8、北段院墙6
  638590074: (ctx) => { wu(ctx, { x: 108.7, z: 261.4, rotY: FW, L: 57.0, D: 14.8, colH: 4.6, doors: [0.3, 0.7], roof: 'xieshan', pf: { cx: 106.55, cz: 263.25, h: 1.5, style: 'stone', w: 16.5, d: 64.1, stairs: [] } }); rampAt(ctx, 98.3, 249.0, 'W', { w: 3.6, h: 1.5, run: 8.4 }); rampAt(ctx, 98.3, 272.6, 'W', { w: 3.6, h: 1.5, run: 8.3 }); },
  638590075: (ctx) => { wu(ctx, { x: -110.15, z: 263.25, rotY: FE, L: 56.9, D: 14.7, colH: 4.6, doors: [0.3, 0.7], roof: 'xieshan', pf: { cx: -108.55, cz: 264.9, h: 1.5, style: 'stone', w: 16.1, d: 64.0, stairs: [] } }); rampAt(ctx, -100.5, 274.3, 'E', { w: 3.6, h: 1.5, run: 5.9 }); rampAt(ctx, -100.5, 250.8, 'E', { w: 3.6, h: 1.5, run: 5.6 }); },
  638513244: (ctx) => {
    wu(ctx, { x: 108.3, z: 53.3, rotY: FW, L: 148.4, D: 13.6, colH: 4.6, doors: [0.15, 0.3, 0.42, 0.56, 0.71], pf: { cx: 106.6, cz: 53.3, h: 1.5, style: 'stone', w: 17.0, d: 148.4, stairs: [] } });
    for (const zz of [2.0, 20.0, 38.2, 57.25, 79.45]) rampAt(ctx, 98.1, zz, 'W', { w: 3.6, h: 1.5, run: 8.6 });
  },
  638513245: (ctx) => {
    wu(ctx, { x: -113.2, z: 53.5, rotY: FE, L: 147.9, D: 15.6, colH: 4.6, doors: [0.15, 0.28, 0.41, 0.54, 0.69], pf: { cx: -110.3, cz: 53.55, h: 1.5, style: 'stone', w: 21.4, d: 147.9, stairs: [] } });
    for (const zz of [2.35, 20.6, 39.55, 59.0, 80.15]) rampAt(ctx, -99.6, zz, 'E', { w: 3.6, h: 1.5, run: 5.6 });
  },

  // ---- 三台与三大殿 ----
  638449433: (ctx, b, api) => { buildSantai(ctx); placeSantaiProps(ctx); api.label('三台', 0, T3 + 2, 160, '太和、中和、保和三殿共用的汉白玉须弥座台基，三层，高8.13米，南北长232米、东西宽130米，平面呈“土”字形。共有望柱1458根、螭首1142个，前后三出陛中嵌云龙御路石。'); },
  8854306: 'skip', 638467894: 'skip',
  638449259: 'skip', 638449270: 'skip', 638460864: 'skip', 638460865: 'skip', // 卡墙（三台模块统一砌筑）
  638449347: L('太和殿', D.taihedian, (ctx) => {
    const r = hallOn(ctx, {
      x: 0, y: T3, z: 90.45, rotY: FS, grade: 1,
      pf: { h: 0.4, style: 'stone', w: 62.0, d: 35.4, stairs: [{ at: [0, 18], w: 8.4, run: 1.0 }, { at: [-11.5, 18], w: 4.0, run: 1.0 }, { at: [11.5, 18], w: 4.0, run: 1.0 }] },
      bays: [5.2, 4.95, 5.05, 5.2, 5.4, 8.44, 5.4, 5.2, 5.05, 4.95, 5.2], nDepth: 5, corridor: 5.2,
      eaveW: 67.3, eaveD: 40.1, colH: 7.0,
      dougong: { kou: 0.096, cai: 11, lowerCai: 9 }, caihua: 'hexi', lattice: LAT, detail: 3,
      double: { inset: 5.2, upperH: 2.4 },
      roof: { type: 'wudian', w: 58.5, d: 31.5, beasts: 10, rise: 8.6, wenH: 3.4 },
      front: ['wall', 'window', 'door', 'door', 'door', 'door', 'door', 'door', 'door', 'window', 'wall'],
      back: ['wall', 'wall', 'wall', 'window', 'window', 'door', 'window', 'window', 'wall', 'wall', 'wall'],
      plaque: '太和殿',
    });
    return { top: r.top, lx: 0, lz: 90.45 };
  }),
  8854349: L('中和殿', D.zhonghedian, (ctx) => {
    const r = hallOn(ctx, {
      x: 0, y: T3, z: 25.9, rotY: FS, grade: 1, kind: 'pavilion', bench: false,
      pf: { h: 0.4, style: 'stone', w: 24.0, d: 24.0, stairs: [{ at: [0, 12], w: 5.0, run: 1.0 }, { at: [0, -12], w: 5.0, run: 1.0 }] },
      nBays: 5, nDepth: 5, eaveW: 26.6, eaveD: 26.6, colH: 7.0,
      dougong: { kou: 0.085, cai: 7 }, caihua: 'hexi',
      roof: { type: 'cuanjian', sides: 4, baoding: 'gold', rise: 9.4, beasts: 7, baodingH: 3.2 }, plaque: '中和殿',
    });
    // 四面出廊：门窗装修设于金柱缝
    innerFacade(r, { lattice: LAT });
    return { top: r.top + 2.6, lx: 0, lz: 25.9 };
  }),
  638473398: L('保和殿', D.baohedian, (ctx) => {
    const r = hallOn(ctx, {
      x: 0, y: T3, z: -33.05, rotY: FS, grade: 1,
      pf: { h: 0.4, style: 'stone', w: 49.6, d: 24.4, stairs: [{ at: [0, 13], w: 7.0, run: 1.0 }, { at: [0, -13], w: 7.0, run: 1.0 }] },
      bays: [4.4, 4.9, 5.2, 5.6, 7.3, 5.6, 5.2, 4.9, 4.4], depthBays: [4.4, 4.45, 4.4, 4.45, 4.4], eaveW: 52.9, eaveD: 27.7, colH: 6.0,
      dougong: { kou: 0.085, cai: 9, lowerCai: 7 }, caihua: 'hexi', lattice: LAT,
      double: { inset: 4.4 },
      roof: { type: 'xieshan', beasts: 9 },
      front: ['wall', 'window', 'door', 'door', 'door', 'door', 'door', 'window', 'wall'],
      back: ['wall', 'window', 'window', 'window', 'door', 'window', 'window', 'window', 'wall'],
      plaque: '保和殿',
    });
    return { top: r.top, lx: 0, lz: -33.05 };
  }),

  // ---- 三台两侧门：中左门、中右门、后左门、后右门（台基与三台下层齐平）及连房 ----
  638507783: L('中左门', '太和殿东侧门，位于三台东侧卡墙一线，单檐歇山，黄琉璃瓦，前后踏跺；北通中和殿、保和殿两侧。',
    (ctx) => sideGate(ctx, { x: 77.0, z: 102.7, px: 77.4, pw: 22.4, ph: T1, run: 11.5, plaque: '中左门' })),
  638507841: L('中右门', '太和殿西侧门，与中左门对称，单檐歇山，黄琉璃瓦。',
    (ctx) => sideGate(ctx, { x: -79.9, z: 102.65, px: -78.95, pw: 25.5, ph: T1, run: 11.5, plaque: '中右门' })),
  638507747: L('后左门', '保和殿东侧门，单檐歇山，黄琉璃瓦，北通乾清门广场。',
    (ctx) => sideGate(ctx, { x: 76.4, z: -33.5, px: 76.9, pw: 22.6, ph: T1, run: 11.5, plaque: '后左门' })),
  638507769: L('后右门', '保和殿西侧门，单檐歇山，黄琉璃瓦，北通乾清门广场。',
    (ctx) => sideGate(ctx, { x: -79.15, z: -32.3, px: -78.3, pw: 25.4, ph: T1, run: 11.5, plaque: '后右门' })),
  638517041: (ctx) => { link(ctx, 94.15, 102.9); },
  638517042: (ctx) => { link(ctx, -97.15, 103.5); },
  638507491: (ctx) => { link(ctx, 94.05, -32.3); },
  638507502: (ctx) => { link(ctx, -96.0, -32.0); },

  // ---- 乾清门广场 ----
  638807748: L('景运门', '乾清门广场东门，明代始建，清代重修。面阔五间，单檐歇山，黄琉璃瓦，东通奉先殿、宁寿宫。清制非奉旨宣召，王公大臣不得擅入，随从止于门外。',
    (ctx) => gate5(ctx, { x: 106.6, z: -84.65, rotY: FW, eaveW: 30.3, eaveD: 17.0, colH: 5.0, plaque: '景运门',
      pf: { cx: 106.7, cz: -84.6, h: 1.0, style: 'xumizuo', w: 19.4, d: 32.2, stairs: [{ at: [-9.7, 0.6], w: 15.0, run: 2.6 }, { at: [9.7, 0.6], w: 15.0, run: 2.6 }] } })),
  638807749: L('隆宗门', '乾清门广场西门，面阔五间，单檐歇山，黄琉璃瓦，西通慈宁宫。嘉庆十八年（1813）天理教攻入紫禁城，门额上至今留有箭镞。',
    (ctx) => gate5(ctx, { x: -109.4, z: -83.15, rotY: FE, eaveW: 30.3, eaveD: 17.0, colH: 5.0, plaque: '隆宗门',
      pf: { cx: -109.2, cz: -83.1, h: 1.0, style: 'xumizuo', w: 19.4, d: 32.2, stairs: [{ at: [9.7, 0.7], w: 15.0, run: 2.6 }, { at: [-9.7, 0.7], w: 15.0, run: 2.6 }] } })),
  40605848: L('军机处', '雍正七年（1729）因用兵西北设军机房，后改军机处，为清代中枢机构。值房为一排低矮板房，黄琉璃瓦卷棚硬山，坐北朝南。',
    (ctx) => { const r = office(ctx, { x: -88.2, z: -108.4, rotY: FS, w: 36.7, d: 8.6, colH: 3.3 }); return { top: r.top, lx: -88.2, lz: -108.4 }; }),
  40605846: L('九卿值房', '景运门内北侧，与军机处东西相对，为九卿等官员候值之所，黄琉璃瓦卷棚硬山小式。',
    (ctx) => { const r = office(ctx, { x: 87.4, z: -108.9, rotY: FS, w: 39.1, d: 8.3, colH: 3.3 }); return { top: r.top, lx: 87.4, lz: -108.9 }; }),
  638807768: A({ kind: 'pavilion', grade: 5, roof: { type: 'luding', rise: 0.55, inner: { w: 2.4, d: 2.2 } }, colH: 2.6, desc: '井亭：盝顶，顶心开敞以通天光。', noLabel: true }),
  638807769: A({ kind: 'pavilion', grade: 5, roof: { type: 'luding', rise: 0.55, inner: { w: 2.4, d: 2.2 } }, colH: 2.6, noLabel: true }),
  40605845: (ctx) => { office(ctx, { x: 98.1, z: -62.15, rotY: FN, w: 16.2, d: 6.8, colH: 3.0 }); },
  40605849: (ctx) => { office(ctx, { x: -99.3, z: -60.7, rotY: FN, w: 14.6, d: 6.8, colH: 3.0 }); },
  42509106: 'skip', 42623315: 'skip', // 内右门、内左门（随墙门，build 中与宫墙一并砌筑）
  228767332: A({ grade: 5, tile: 'yellow', roof: { type: 'xieshan', beasts: 1 }, noLabel: true }),
  638959718: A({ rotY: FN, grade: 5, roof: { type: 'xieshan', beasts: 1 }, colH: 2.8 }),
  638959719: A({ rotY: FN, grade: 5, roof: { type: 'xieshan', beasts: 1 }, colH: 2.8 }),
  // 东庑外侧的库房与服务用房：灰瓦小式
  478109300: A({ grade: 5, tile: 'grey', roof: { type: 'yingshan', gableWallMat: 'brick_grey' } }),
  642560665: A({ grade: 5, tile: 'grey', roof: { type: 'yingshan', gableWallMat: 'brick_grey' }, rotY: FW }),
  523763697: A({ grade: 5, tile: 'grey', roof: { type: 'yingshan', gableWallMat: 'brick_grey' }, rotY: FW }),
  687866541: A({ grade: 5, tile: 'grey', roof: { type: 'yingshan', gableWallMat: 'brick_grey' } }),
};

/** 台基段（无建筑） */
function slabBase(ctx, poly, h) {
  const cx = (poly[0][0] + poly[2][0]) / 2, cz = (poly[0][1] + poly[2][1]) / 2;
  hallOnlyPlatform(ctx, cx, cz, poly[2][0] - poly[0][0], poly[2][1] - poly[0][1], h);
}
function hallOnlyPlatform(ctx, cx, cz, w, d, h) {
  buildPlatform(ctx.at(cx, 0, cz), { w, d, h, style: 'stone' });
}

/** 门殿与东西庑之间的连房（穿堂门）：一间，硬山，坐落于台基上 */
function link(ctx, x, z) {
  const r = hallOn(ctx, {
    x, z, rotY: FS, kind: 'gate', grade: 4,
    pf: { h: 2.0, style: 'stone', w: 8.3, d: 12.0, stairs: [] },
    bays: [6.0], depthBays: [3.3, 3.3], eaveW: 8.4, eaveD: 9.4, colH: 4.0, dougong: false, caihua: 'xuanzi',
    front: ['open'], roof: { type: 'yingshan', beasts: -1 },
  });
  gateDoors(r.c, r.info, [0], { openW: 2.8 });
}

/** 中和殿：金柱缝门窗（四面出廊） */
function innerFacade(r, { lattice }) {
  const { info, c } = r;
  const s = info.spec, Dm = s.colDia, beamH = clamp(Dm * 0.95, 0.2, 1.0);
  const h = s.colH - beamH * 2.1;
  const X = info.colsX.slice(1, -1), Z = info.colsZ.slice(1, -1);
  // 金柱
  for (const x of X) for (const z of [Z[0], Z[Z.length - 1]]) c.place('col:wood_red', x, 0, z, 0, [Dm, s.colH + 1.2, Dm]);
  for (const z of Z.slice(1, -1)) for (const x of [X[0], X[X.length - 1]]) c.place('col:wood_red', x, 0, z, 0, [Dm, s.colH + 1.2, Dm]);
  const sides = [
    { pts: X, fixed: Z[Z.length - 1], rot: 0, types: ['door', 'door', 'door'] },
    { pts: X.slice().reverse(), fixed: Z[0], rot: Math.PI, types: ['window', 'door', 'window'] },
    { pts: Z.slice().reverse(), fixed: X[X.length - 1], rot: Math.PI / 2, types: ['window', 'door', 'window'] },
    { pts: Z, fixed: X[0], rot: -Math.PI / 2, types: ['window', 'door', 'window'] },
  ];
  for (const sd of sides) {
    for (let i = 0; i < sd.pts.length - 1; i++) {
      const a = sd.pts[i], b = sd.pts[i + 1], m = (a + b) / 2, w = Math.abs(b - a) - Dm * 0.9;
      const at = sd.rot === 0 || sd.rot === Math.PI ? [m, sd.fixed] : [sd.fixed, m];
      buildBay(c.at(at[0], 0, at[1], sd.rot), { type: sd.types[i] || 'window', w, h, lattice, colD: Dm });
      // 金柱缝额枋
      c.at(at[0], 0, at[1], sd.rot).add('beam_hexi', beamBox(Math.abs(b - a), beamH, Dm * 0.8, s.colH + 0.2));
    }
  }
}
function beamBox(L, h, t, y) {
  const g = boxGeo(L, h, t);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; if (f === 4 || f === 5) uv.setXY(i, uv.getX(i) / L, uv.getY(i) / h); else uv.setXY(i, 0.015, 0.5); }
  g.translate(0, y - h / 2, 0);
  return g;
}

// =====================================================================
const wallOverrides = {
  638807612: 'skip', // 乾清门东侧宫墙（不规则多边形，build 中按直线重砌）
  638807626: 'skip', 638807713: 'skip',
  638807738: { h: 7, thick: 2.6, cap: 'yellow' },
  638807739: { h: 7, thick: 2.8, cap: 'yellow' },
  638807744: { h: 7, thick: 2.6, cap: 'yellow' },
  638807747: { h: 7, thick: 2.8, cap: 'yellow' },
  638807563: { h: 1.8, cap: 'yellow' }, 638807567: { h: 1.8, cap: 'yellow' },
};

const bridgeOverrides = { 638204001: 'skip', 638204002: 'skip', 638204003: 'skip', 638204004: 'skip', 638204005: 'skip' };

function build(ctx, api) {
  // 内金水河栏杆与五座金水桥
  buildJinshui(ctx, api);
  api.label('内金水桥', AXS, 5, 402, '太和门前跨内金水河的五座单孔汉白玉石拱桥，明永乐年间建。中为御路桥（最宽，龙纹望柱），供皇帝通行；两侧依次为王公桥、品级桥。内金水河自西向东呈弓形流经太和门广场，两岸汉白玉栏杆环绕。');
  // ---- 御道（中路石板甬路） ----
  const road = (xa, za, xb, zb, w) => slab(ctx, [[xa - w / 2, za], [xa + w / 2, za], [xb + w / 2, zb], [xb - w / 2, zb]], 0, 0.06, 'paving_imperial');
  road(-0.55, 580, -0.55, 484.5, 6.4); // 端门方向 → 午门中门
  road(-0.55, 457.3, AXS, 413.4, 6.4); // 午门 → 中路金水桥
  road(AXS, 390.7, AXS, 331.7, 6.4); // 金水桥 → 太和门
  road(AXS, 279.4, 0, 181.6, 6.4); // 太和门 → 三台丹陛
  road(0, -81.3, -1.0, -109.3, 6.4); // 保和殿后陛 → 乾清门
  // 太和门广场东西向甬路（熙和门—协和门，与御道相接处止于河岸）
  // ---- 宫墙：乾清门广场北墙（内左门、内右门为随墙门） ----
  palaceWall(ctx, [[-149.8, -113.5], [-67.6, -113.5]], { h: 8, thick: 2.4 });
  palaceWall(ctx, [[-62.4, -113.9], [-24.5, -114.0]], { h: 8, thick: 2.2 });
  palaceWall(ctx, [[24.5, -114.6], [59.8, -114.3]], { h: 8, thick: 2.2 });
  palaceWall(ctx, [[65.3, -114.2], [115.8, -114.2]], { h: 8, thick: 2.4 });
  for (const [x, z, name] of [[-65.0, -113.7, '内右门'], [62.55, -114.2, '内左门']]) {
    buildWallGate(ctx.at(x, 0, z, 0), { type: 'suiqiang', w: 5.3, h: 8.6, wallThick: 2.3, doorW: 2.6, doorH: 4.2, tile: 'yellow', wallH: 8 });
    api.label(name, x, 10, z, `乾清门广场北墙上的随墙门，${name === '内左门' ? '东' : '西'}通${name === '内左门' ? '东一长街' : '西一长街'}，为内廷与外朝之间的门禁。`);
  }
  // ---- 太和殿广场东西庑后檐卡墙（翼门、阁、崇楼之间） ----
  for (const [x, segs] of [
    [113.2, [[127.5, 131.0, 1.5], [156.1, 168.3, 1.5], [168.3, 179.0, 3.0], [222.6, 231.2, 3.0], [231.2, 235.6, 1.5], [287.4, 297.4, 1.5]]],
    [-115.2, [[127.4, 132.7, 1.5], [156.3, 170.1, 1.5], [170.1, 180.6, 3.0], [224.6, 232.9, 3.0], [232.9, 237.4, 1.5], [289.1, 299.0, 1.5]]],
  ]) {
    for (const [z0, z1, y0] of segs) palaceWall(ctx, [[x, z0], [x, z1]], { y0, h: 6.0, thick: 2.0 });
  }
  // ---- 午门外两侧古柏（午门与阙左门、阙右门之间的林地） ----
  let k = 0;
  for (const [x0, x1, z0, z1] of [[67, 84, 488, 548], [-82.5, -68.5, 490, 558]]) {
    for (let z = z0; z <= z1; z += 7.5) for (let x = x0; x <= x1; x += 6.5) {
      const j = (k++ * 7919) % 97;
      ctx.place(`tree:cypress:${j % 4}`, x + ((j % 7) - 3) * 0.35, 0, z + ((j % 5) - 2) * 0.4, j * 0.37, 10 + (j % 5) * 0.9);
    }
  }
  // 铜缸：太和门两侧、协和门/熙和门内侧
  for (const [x, z] of [[AXS + 24, 324.5], [AXS - 24, 324.5]]) ctx.place('vat:bronze', x, 0, z, 0, propHeight('vat'));
}

export default {
  key: 'axis_south',
  title: '外朝中轴（午门—乾清门广场）',
  overrides,
  wallOverrides,
  bridgeOverrides,
  build,
};
