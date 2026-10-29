// 宁寿宫花园（乾隆花园）：四进院落。特殊建筑（禊赏亭、碧螺亭、符望阁、萃赏楼、延趣楼、云光楼、竹香馆、抑斋与矩亭、
// 撷芳亭、耸秀亭、旭辉庭）、假山叠石、游廊、流杯渠、古松古柏。
import * as THREE from 'three';
import { buildHall } from '../../core/building.js';
import { buildRoof } from '../../core/roof.js';
import { buildPlatform, buildXumizuo, buildRailing } from '../../core/platform.js';
import { buildRockery } from '../../core/nature.js';
import { buildWallGate } from '../../core/walls.js';
import { defineMaterial } from '../../core/materials.js';
import { registerTexture, makeTexture, canvas } from '../../core/textures.js';
import { boxGeo, cylGeo, prismGeo, sweep } from '../../core/geom.js';
import { PI, FACE, rectOf, item, hallOn, towerOn, garden, gallery, tree, paving } from './lib.js';

// ---------- 碧螺亭琉璃：孔雀蓝瓦（由蓝琉璃瓦纹理换色）、白琉璃宝顶 ----------
registerTexture('tile_peacock', () => {
  const src = makeTexture('tile_blue').image;
  const W = src.width, H = src.height, c = canvas(W, H), g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const k = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 62;
    d[i] = Math.min(255, 22 * k); d[i + 1] = Math.min(255, 126 * k); d[i + 2] = Math.min(255, 140 * k);
  }
  g.putImageData(img, 0, 0);
  return c;
}, { aniso: 16 });
defineMaterial('tile_peacock', { color: 0xffffff, map: 'tile_peacock', normalMap: 'tile_normal', roughnessMap: 'tile_rough', roughness: 1, period: [1.2, 1.2], envMapIntensity: 0.9 });
defineMaterial('glaze_peacock', { color: 0x1a8590, roughness: 0.3, envMapIntensity: 1.3 });
defineMaterial('glaze_white', { color: 0xe8e4d6, roughness: 0.3, envMapIntensity: 1.2 });

const shared = { cuishangY2: null }; // 萃赏楼二层楼面高（供石桥）

// ---------------- 第一进：衍祺门、禊赏亭、旭辉庭、抑斋/矩亭、撷芳亭、古华轩 ----------------
/** 禊赏亭：坐西面东，凸字形，中部四角攒尖、三面歇山，前出抱厦，抱厦内凿流杯渠（曲水流觞） */
export function xishangTing(ctx, b, api) {
  const H = 0.7;
  const poly = [[237.9, -289.1], [243.9, -289.1], [243.9, -285.9], [248.1, -285.9], [248.1, -280.7], [243.9, -280.7], [243.9, -277.3], [237.9, -277.3]];
  buildPlatform(ctx, { poly, h: H, style: 'xumizuo', stairs: [{ at: [248.1, -283.3], w: 2.2 }, { at: [240.9, -277.3], w: 1.8 }] });
  const G = (o) => garden(o.type, { kind: 'pavilion', platform: false, y0: H, bench: false, ...o });
  // 中部方亭（四角攒尖）
  const c = hallOn(ctx, [237.7, 244.1, -286.4, -280.0], 'E', { ...G({ type: 'cuanjian', juan: false, sides: 4, colH: 3.7 }), roof: { type: 'cuanjian', sides: 4, tile: 'yellow', ridgeColor: 'green', beasts: 1, rise: 2.3 } });
  // 南北两翼（歇山山面朝南、北）与东抱厦（歇山山面朝东）
  const wing = { type: 'xieshan', juan: false, colH: 2.5 };
  hallOn(ctx, [237.7, 244.1, -289.3, -285.2], 'W', { ...G(wing), roof: { type: 'xieshan', tile: 'yellow', ridgeColor: 'green', rise: 1.15, beasts: 1 } });
  hallOn(ctx, [237.7, 244.1, -281.2, -277.1], 'W', { ...G(wing), roof: { type: 'xieshan', tile: 'yellow', ridgeColor: 'green', rise: 1.15, beasts: 1 } });
  hallOn(ctx, [243.0, 248.3, -286.1, -280.5], 'S', { ...G(wing), roof: { type: 'xieshan', tile: 'yellow', ridgeColor: 'green', rise: 1.15, beasts: 1 } });
  // 流杯渠：抱厦地面凿出的曲折水槽（回环往复，约 20 余米）
  const pts = [];
  const rows = 5, x0 = 244.75, x1 = 247.65, zA = -285.35, dz = 0.92;
  for (let k = 0; k < rows; k++) {
    const z = zA + k * dz, l2r = k % 2 === 0;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, x = l2r ? x0 + (x1 - x0) * t : x1 - (x1 - x0) * t;
      pts.push([x, H + 0.012, z + 0.12 * Math.sin(t * PI * 3)]);
    }
    if (k < rows - 1) for (let i = 1; i < 8; i++) {
      const a = (i / 8) * PI, cx = l2r ? x1 : x0;
      pts.push([cx + (l2r ? 1 : -1) * Math.sin(a) * dz * 0.5, H + 0.012, z + dz * 0.5 - Math.cos(a) * dz * 0.5]);
    }
  }
  ctx.add('water', sweep([[-0.07, 0], [0.07, 0], [0.07, 0.006], [-0.07, 0.006]], pts, { flat: true }));
  api.label('禊赏亭', 240.9, c.topY + 1.2, -283.2, '宁寿宫花园第一进西侧，坐西面东，平面凸字形，中部四角攒尖、三面歇山，黄琉璃瓦绿剪边；前出抱厦，地面凿约 27 米长的流杯渠，仿王羲之兰亭“曲水流觞”。');
}

/** 抑斋（东南隅，硬山前后廊）与矩亭（方亭四角攒尖） */
export function yizhai(ctx, b, api) {
  const r = hallOn(ctx, [263.6, 271.35, -283.65, -275.55], 'S', garden('yingshan', { juan: false, corridor: 1.3, backCorridor: true, nBays: 2, ph: 0.8 }));
  const j = hallOn(ctx, [259.3, 263.6, -281.8, -277.4], 'E', garden('cuanjian', { kind: 'pavilion', juan: false, sides: 4, colH: 2.7, ph: 0.8, bench: true }));
  api.label('抑斋', 267.5, r.topY + 0.8, -279.6, '花园第一进东南隅，坐北向南，面阔一间半，前后出廊，硬山顶，黄琉璃瓦绿剪边。');
  api.label('矩亭', 261.4, j.topY + 0.8, -279.6, '抑斋西侧的方亭，四角攒尖，黄琉璃瓦绿剪边宝顶，顶部编织纹天花为宫中仅见。');
}

// ---------------- 第三进：萃赏楼、延趣楼、云光楼 ----------------
export function cuishangLou(ctx, b, api) {
  const t = towerOn(ctx, rectOf(1341826245), 'S', {
    grade: 4, nBays: 5, nDepth: 3, corridor: 1.4, caihua: 'sushi', tile: 'yellow', lattice: 'bubujin',
    platform: { h: 0.7, style: 'stone', stairs: [{ side: 'S' }] },
    roof: { type: 'xieshan', juan: true, ridgeColor: 'green' },
    stories: [{ colH: 4.0, front: 'door' }, { colH: 3.3, inset: 0.2, front: 'window', balcony: true }],
  });
  shared.cuishangY2 = t.storyY[1];
  api.label('萃赏楼', 261, t.topY + 1, -368.4, '花园第三进主楼，坐北朝南，上下两层各五间，卷棚歇山，黄琉璃瓦绿剪边；上层后门外凌空架白石小桥，通往碧螺亭。');
}
export function yanquLou(ctx, b, api) {
  const t = towerOn(ctx, rectOf(40629272), 'E', {
    grade: 4, nBays: 5, nDepth: 3, caihua: 'sushi', tile: 'green', lattice: 'bubujin',
    platform: { h: 0.6, style: 'stone', stairs: [{ side: 'S' }] },
    roof: { type: 'xieshan', juan: true, tile: 'green', ridgeColor: 'yellow', beasts: 5 },
    stories: [{ colH: 3.8, front: 'door' }, { colH: 3.2, inset: 0.2, front: 'window', balcony: true }],
  });
  api.label('延趣楼', 243.2, t.topY + 1, -351, '花园第三进西侧，上下两层，面阔五间，歇山卷棚顶，绿琉璃瓦黄剪边，东、南、北三面出廊。');
}
export function yunguangLou(ctx, b, api) {
  const s = { grade: 4, caihua: 'sushi', lattice: 'bubujin', tile: 'yellow', platform: { h: 0.5, style: 'stone', stairs: [] }, roof: { type: 'xieshan', juan: true, ridgeColor: 'green' } };
  const t = towerOn(ctx, [236.7, 242.3, -382.2, -366.6], 'E', { ...s, nBays: 5, nDepth: 1, stories: [{ colH: 3.6, front: 'door' }, { colH: 3.0, inset: 0.15, front: 'window' }] });
  towerOn(ctx, [242.0, 246.8, -373.4, -366.6], 'S', { ...s, nBays: 1, nDepth: 1, roof: { type: 'xuanshan', juan: true, ridgeColor: 'green' }, stories: [{ colH: 3.6, front: 'door' }, { colH: 3.0, front: 'window' }] });
  api.label('云光楼', 241.8, t.topY + 1, -374.4, '又称养和精舍，花园西北隅的曲尺形二层楼，以游廊与萃赏楼相接，屋顶形态特殊。');
}

// ---------------- 第四进：碧螺亭、符望阁、玉粹轩、竹香馆、倦勤斋 ----------------
const BL = { x: 259.4, z: -377.3 }; // 碧螺亭
/** 碧螺亭：梅花形五柱五脊重檐攒尖，五瓣须弥座；上檐翡翠绿、下檐孔雀蓝琉璃瓦，紫晶色剪边，白琉璃冰梅宝顶 */
export function biluoTing(ctx, y0) {
  const c = ctx.at(BL.x, y0, BL.z, 0);
  const plum = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * PI * 2;
    const r = 2.25 + 0.32 * Math.cos(5 * (a - PI / 5));
    plum.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  buildXumizuo(c, plum, 0, 0.6, { edgeW: 0.25 });
  const rc = 1.55, colH = 2.55, D = 0.2, y1 = 0.6;
  const cols = [];
  for (let i = 0; i < 5; i++) { const a = ((i + 0.5) / 5) * PI * 2; cols.push([Math.sin(a) * rc, Math.cos(a) * rc]); }
  for (const [x, z] of cols) { c.place('col:wood_red', x, y1, z, 0, [D, colH, D]); c.place('zhuchu', x, y1, z, 0, [D, D, D]); }
  // 额枋（苏式彩画）与坐凳
  for (let i = 0; i < 5; i++) {
    const [ax, az] = cols[i], [bx, bz] = cols[(i + 1) % 5];
    const L = Math.hypot(bx - ax, bz - az), rot = -Math.atan2(bz - az, bx - ax);
    const cc = c.at((ax + bx) / 2, 0, (az + bz) / 2, rot);
    const g = boxGeo(L, 0.24, 0.16); g.translate(0, y1 + colH - 0.12, 0);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / L, uv.getY(k) / 0.24);
    cc.add('beam_sushi', g);
    if (i !== 2) { const s = boxGeo(L - D, 0.08, 0.32); s.translate(0, y1 + 0.45, 0); cc.add('wood_red', s); const p = boxGeo(L - D, 0.36, 0.06); p.translate(0, y1 + 0.22, 0); cc.add('board_green', p); }
  }
  const yL = y1 + colH + 0.12;
  buildRoof(c, { type: 'cuanjian', sides: 5, r: 2.75, y: yL, rise: 1.25, tile: 'peacock', ridgeColor: 'purple', overhang: 0.9, beasts: 0, ornaments: false, ornamentLOD: true });
  // 上檐：五角形围脊板 + 上层攒尖
  const yU = yL + 1.25 * 0.62 + 0.75;
  const pent = Array.from({ length: 5 }, (_, i) => { const a = ((i + 0.5) / 5) * PI * 2; return [Math.sin(a) * 1.05, Math.cos(a) * 1.05]; });
  c.add('board_red', prismGeo(pent, yL + 0.5, yU, { top: false }));
  buildRoof(c, { type: 'cuanjian', sides: 5, r: 1.95, y: yU, rise: 1.75, tile: 'green', ridgeColor: 'purple', overhang: 0.7, beasts: 0, baoding: 'white', baodingH: 0.75, ornamentLOD: true });
  return yU + 1.75 + 0.75;
}

/** 碧螺亭所在假山 + 萃赏楼二层白石小桥 */
function biluoHill(ctx, api) {
  const hgt = shared.cuishangY2 ?? 4.6;
  const r = buildRockery(ctx.at(259.4, 0, -378.8, 0), { w: 15.5, d: 8.4, h: hgt, seed: 17, style: 'taihu', steps: 1, stepsFrom: -120, stepsTo: -40, topW: 6.6, topD: 6.2, topX: 0, topZ: 1.5, cave: false });
  const top = biluoTing(ctx, hgt);
  // 白石小桥：萃赏楼二层后檐 → 亭台
  const z0 = -373.4, z1 = BL.z + 2.0;
  const deck = boxGeo(1.5, 0.25, z0 - z1); deck.translate(BL.x, hgt - 0.12, (z0 + z1) / 2);
  ctx.add('marble', deck);
  for (const s of [-1, 1]) buildRailing(ctx, { path: [[BL.x + s * 0.68, z0], [BL.x + s * 0.68, z1]], y: hgt, style: 'stone', height: 0.9, ends: 'post' });
  api.label('碧螺亭', BL.x, top + 1, BL.z, '梅花形五柱五脊重檐攒尖亭，建于五瓣须弥座上；上檐翡翠绿、下檐孔雀蓝琉璃瓦，紫晶色剪边，白琉璃冰梅宝顶，遍饰梅花纹；南侧石桥通萃赏楼二层。');
}

export function fuwangGe(ctx, b, api) {
  const t = towerOn(ctx, rectOf(40629261), 'S', {
    grade: 3, nBays: 5, nDepth: 5, dougong: { kou: 0.07, cai: 5 }, caihua: 'hexi', tile: 'yellow',
    platform: { h: 1.0, style: 'xumizuo', stairs: [{ side: 'E' }, { side: 'N' }] },
    roof: { type: 'cuanjian', sides: 4, ridgeColor: 'blue', beasts: 5, baoding: 'gold' },
    stories: [{ colH: 5.6, front: 'door', back: 'door', left: 'window', right: 'window' }, { colH: 4.6, inset: 1.0, front: 'window', back: 'window', left: 'window', right: 'window', balcony: true }],
  });
  api.label('符望阁', 259.4, t.topY + 1, -396.7, '宁寿宫花园中最高大的建筑，仿建福宫延春阁。平面方形，外观两层、内实三层，四角攒尖顶，黄琉璃瓦蓝剪边；内部装修迂回曲折，俗称“迷楼”。');
}
export function zhuxiangGuan(ctx, b, api) {
  const t = towerOn(ctx, rectOf(43525094), 'E', {
    grade: 4, nBays: 3, nDepth: 1, caihua: 'sushi', tile: 'green', lattice: 'bubujin', platform: { h: 0.5, style: 'stone', stairs: [{ side: 'S' }] },
    roof: { type: 'xieshan', juan: true, tile: 'green', ridgeColor: 'yellow' },
    stories: [{ colH: 3.4, front: 'door' }, { colH: 2.9, inset: 0.15, front: 'window' }],
  });
  api.label('竹香馆', 239.8, t.topY + 0.8, -403.2, '花园第四进西北，面东，上下两层，主楼三间、两侧耳楼各一间，卷棚歇山，绿琉璃瓦黄剪边；外侧堆石山，前设弓形墙垣与八方洞门。');
}

/** 园林游廊表（OSM 窄条轮廓 → 敞廊） */
export const GALLERIES = {
  1341826228: [[[235.9, 237.8, -295.6, -291.4], { y0: 1.0 }], [[237.8, 239.4, -293.2, -289.3], { y0: 0.6 }]],
  1341826230: [[[257.7, 259.6, -271.4, -263.7], { y0: 0.3 }], [[259.6, 261.3, -275.6, -269.6], { y0: 0.6 }]],
  1341826235: [[[242.8, 250.2, -309.4, -306.9], { face: 'N' }]],
  1341826236: [[[271.4, 274.3, -338.8, -306.8], { face: 'W', back: true }], [[257.8, 271.4, -309.4, -306.8], { face: 'N' }]],
  1341826238: [[[261.7, 268.5, -332.6, -328.2], { face: 'S' }]],
  1341826239: [[[241.9, 244.7, -336.1, -328.0], { face: 'E' }], [[236.3, 241.9, -336.1, -333.4], { face: 'S' }]],
  1341826241: [[[238.5, 241.6, -344.1, -336.1], { face: 'E' }], [[241.6, 244.9, -338.9, -336.1], { face: 'N' }]],
  1341826240: [[[246.1, 247.9, -365.2, -357.9], { face: 'E' }], [[247.9, 250.9, -365.2, -363.2], { face: 'N' }]],
  1341826244: [[[246.85, 250.95, -373.4, -370.4], { face: 'S' }]],
  1341826242: [[[271.1, 273.6, -378.4, -358.2], { face: 'W', back: true }], [[273.6, 277.2, -378.4, -375.9], { face: 'N' }]],
  1341826247: [[[243.05, 248.35, -407.45, -404.75], { face: 'N' }]],
  40629285: [[[236.0, 270.3, -422.0, -419.4], { face: 'S' }], [[248.3, 251.3, -419.4, -407.5], { face: 'E' }], [[267.7, 270.3, -419.4, -407.5], { face: 'W' }]],
  1341826223: [[[277.9, 281.2, -404.1, -390.4], { face: 'W', back: true }], [[274.4, 277.9, -407.6, -401.4], { face: 'W' }], [[274.4, 277.9, -393.4, -387.3], { face: 'W' }], [[270.6, 274.4, -407.6, -405.3], { face: 'N' }]],
};
export function galleryOverride(id) {
  return (ctx) => { for (const [r, o] of GALLERIES[id]) gallery(ctx, r, { edge: 'green', ...o }); };
}

// ---------------- 园林总装：假山、亭、树木、铺地 ----------------
export function buildGarden(ctx, api) {
  // 衍祺门内：以假山作影壁
  buildRockery(ctx.at(254.2, 0, -270.2, 0), { w: 8.4, d: 3.6, h: 3.4, seed: 3, style: 'taihu', steps: false, cave: false, topW: 2.2, topD: 1.6 });
  // 撷芳亭：东南隅山石之上，高出墙垣
  const xf = buildRockery(ctx.at(267.7, 0, -268.1, 0), { w: 7.6, d: 7.6, h: 3.6, seed: 5, style: 'taihu', steps: 1, stepsFrom: -150, stepsTo: -60, topW: 5.0, topD: 4.6, topX: 1.4, topZ: 2.0, cave: false });
  const xt = hallOn(ctx, [267.45, 270.75, -267.6, -264.2], 'N', { ...garden('cuanjian', { kind: 'pavilion', juan: false, sides: 4, tile: 'green', edge: 'yellow', colH: 2.6, bench: true, platform: { h: 0.2, style: 'stone', stairs: [] } }), y0: xf.top });
  api.label('撷芳亭', 269.1, xt.topY + 0.8, -265.9, '花园第一进东南山石上的方亭，四角攒尖，绿琉璃瓦黄琉璃脊檐，高出墙垣，可俯瞰园景。');
  // 旭辉庭下的堆山
  buildRockery(ctx.at(240.2, 0, -300.7, 0), { w: 9.6, d: 13.4, h: 1.6, seed: 9, style: 'taihu', steps: 1, stepsFrom: 150, stepsTo: 70, topW: 6.8, topD: 11.2, topX: -1.4, topZ: 0, cave: false });
  // 古华轩前后叠石、轩前古楸（以榆代）
  buildRockery(ctx.at(246.5, 0, -293.0, 0), { w: 3.6, d: 2.6, h: 1.7, seed: 11, style: 'taihu', steps: false, cave: false, topW: 1.2, topD: 1.2 });
  // 第二进：遂初堂院落（开阔，置峰石）
  for (const [x, z, h, s] of [[248.6, -319.5, 2.6, 1], [258.8, -319.5, 2.4, 2]]) ctx.place(`rock:taihu:${s}`, x, 0.45, z, s, h);
  for (const [x, z] of [[248.6, -319.5], [258.8, -319.5]]) ctx.add('marble', prismGeo([[x - 0.7, z - 0.7], [x + 0.7, z - 0.7], [x + 0.7, z + 0.7], [x - 0.7, z + 0.7]], 0, 0.45));
  paving(ctx, [252.4, 255.6, -328.4, -309.6], 0.05, 'paving_square');
  // 第三进：大假山（耸秀亭在山巅，下临悬崖）
  const ss = buildRockery(ctx.at(256.0, 0, -352.9, 0), { w: 12.4, d: 15.0, h: 6.6, seed: 23, style: 'taihu', steps: 2, topW: 6.2, topD: 6.0, topX: 0, topZ: -4.4 });
  const st = hallOn(ctx, [254.1, 257.9, -359.45, -355.55], 'S', { ...garden('cuanjian', { kind: 'pavilion', juan: false, sides: 4, tile: 'green', edge: 'yellow', colH: 2.6, bench: true, platform: { h: 0.2, style: 'stone', stairs: [] } }), y0: ss.top });
  api.label('耸秀亭', 256, st.topY + 0.8, -357.5, '花园第三进石山之巅的方亭，四角攒尖，绿琉璃瓦黄剪边，下临悬崖。');
  // 第四进：碧螺亭假山 + 石桥；符望阁周边叠石
  biluoHill(ctx, api);
  buildRockery(ctx.at(244.0, 0, -387.6, 0), { w: 6.4, d: 4.6, h: 2.6, seed: 31, style: 'taihu', steps: false, cave: false, topW: 1.6, topD: 1.4 });
  buildRockery(ctx.at(273.6, 0, -397.4, 0), { w: 3.0, d: 5.0, h: 2.2, seed: 37, style: 'qing', steps: false, cave: false, topW: 1.2, topD: 1.2 });
  // 玉粹轩前青石月台
  buildPlatform(ctx, { poly: [[243.6, -397.6], [247.0, -397.6], [247.0, -391.6], [243.6, -391.6]], h: 0.9, style: 'stone', railing: { style: 'marble' }, stairs: [{ at: [247.0, -394.6], w: 1.8, railings: true }] });
  // 甬路
  paving(ctx, [252.6, 255.6, -295.2, -272.6], 0.04, 'paving_square');
  // 古松古柏（园林）
  const T = [
    // 第一进
    ['cypress', 244.5, -273.5, 11], ['pine', 249.8, -276.0, 10], ['cypress', 256.8, -278.5, 12], ['cypress', 262.0, -290.5, 12], ['pine', 266.5, -293.0, 9],
    ['cypress', 265.5, -298.0, 13], ['cypress', 267.0, -304.0, 12], ['elm', 251.5, -289.5, 14], ['pine', 239.5, -272.5, 9], ['cypress', 268.5, -287.5, 11],
    // 第二进
    ['cypress', 248.0, -313.5, 11], ['cypress', 259.6, -313.5, 11], ['pine', 248.0, -325.0, 9], ['pine', 259.6, -325.0, 9],
    // 第三进
    ['pine', 249.0, -346.5, 9], ['cypress', 263.0, -357.0, 12], ['pine', 266.5, -360.5, 9], ['pine', 268.8, -355.0, 10],
    // 第四进
    ['cypress', 270.0, -381.2, 11], ['cypress', 245.8, -402.0, 11],
    ['pine', 245.2, -412.5, 9], ['cypress', 258.8, -412.5, 10], ['pine', 262.8, -415.6, 9], ['bamboo', 241.0, -414.5, 5], ['bamboo', 239.0, -410.0, 5],
  ];
  for (const [k, x, z, h] of T) tree(ctx, k, x, z, h);
  // 假山上的松
  for (const p of ss.spots.slice(0, 3)) tree(ctx.at(256.0, 0, -352.9), 'pine', p[0], p[2], 5 + (p[1] % 2), p[1] - 0.2);
}
