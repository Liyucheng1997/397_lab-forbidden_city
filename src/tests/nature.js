// 自然要素测试：各树种一排（4 变体）、太湖石假山（磴道+山顶平台+洞口）、青石小山、水池（山石驳岸）、条石驳岸水渠、草地花坛、峰石
// 用法：catalog.html?t=nature&ground=0
import { buildRockery, createWater, updateWater, buildWaterBank, buildLawn, areaGeo, TREE_HEIGHT } from '../core/nature.js';
import { getProto } from '../core/protos.js';
import { cylGeo, latheGeo, prismGeo, boxGeo } from '../core/geom.js';

const KINDS = ['pine', 'cypress', 'locust', 'willow', 'ginkgo', 'elm', 'bamboo', 'shrub'];

// 不规则水池轮廓
function pond(cx, cz, rx, rz, n = 40, seed = 1) {
  const P = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.16 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 2);
    P.push([cx + Math.cos(a) * rx * k, cz + Math.sin(a) * rz * k]);
  }
  return P;
}

export default function build(ctx, { scene }) {
  // 原型三角形数
  const tris = {};
  for (const k of KINDS) for (let v = 0; v < 4; v++) {
    const p = getProto(`tree:${k}:${v}`);
    tris[`${k}:${v}`] = p.parts.reduce((s, q) => s + q.geo.index.count / 3, 0);
  }
  for (const s of ['taihu', 'qing']) for (let v = 0; v < 2; v++) tris[`rock:${s}:${v}`] = getProto(`rock:${s}:${v}`).parts[0].geo.index.count / 3;
  console.log('[nature] proto tris', JSON.stringify(tris));

  // 地面（挖出水池与水渠）
  const pondP = pond(40, 32, 17, 11);
  const canal = [[62, 6], [118, 6], [118, 13], [62, 13]];
  ctx.add('paving', areaGeo([[[-130, -130], [130, -130], [130, 90], [-130, 90]], pondP, canal], 0));

  // 树木：每种一列（4 变体沿 z）
  KINDS.forEach((k, i) => {
    const H = TREE_HEIGHT[k], x = -84 + i * 24;
    const sp = k === 'shrub' ? 4 : k === 'bamboo' ? 10 : 17;
    for (let v = 0; v < 4; v++) ctx.place(`tree:${k}:${v}`, x, 0, -36 - v * sp, v * 1.3, H * (0.92 + 0.06 * v));
  });
  buildLawn(ctx, { poly: [[-98, -28], [98, -28], [98, -100], [-98, -100]], y: 0.02, curb: 0.18 });

  // 太湖石假山（堆秀山式）+ 山顶亭占位
  const rk = ctx.at(-38, 0, 30);
  const { top, spots } = buildRockery(rk, { w: 28, d: 20, h: 11, seed: 3, style: 'taihu' });
  spots.forEach(([x, y, z], i) => rk.place(i % 3 ? `tree:shrub:${i % 2}` : 'tree:pine:1', x, y - 0.2, z, i, i % 3 ? 1.3 : 4));
  const pav = rk.at(0, top, -1.2);
  pav.add('marble', prismGeo([[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]], 0, 0.35));
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [1.9, 1.9], [-1.9, 1.9]]) pav.at(x, 0.35, z).add('wood_red', cylGeo(0.16, 0.16, 2.8, 10));
  pav.at(0, 3.1, 0, Math.PI / 4).add('glaze_yellow', latheGeo([[3.7, 0], [2.2, 0.9], [0.5, 2.2], [0.01, 2.6]], 4));
  // 假山旁古柏、油松
  rk.place('tree:cypress:1', -17, 0, 6, 0.5, 12);
  rk.place('tree:pine:2', 16, 0, 7, 1.1, 9);
  rk.place('tree:cypress:3', 17, 0, -9, 2.1, 11);

  // 青石小山（单磴道）
  buildRockery(ctx.at(-92, 0, 34), { w: 13, d: 10, h: 5, seed: 7, style: 'qing', steps: 1 });

  // 水池：山石驳岸 + 岸边垂柳
  const wl = -0.55;
  scene.add(createWater(pondP, wl));
  buildWaterBank(ctx, { poly: pondP, y: wl, style: 'rock', rock: 'taihu', height: 0.6, seed: 5 });
  for (const [x, z, v, r] of [[20, 26, 0, 0.3], [24, 44, 1, 2], [58, 22, 2, 4], [60, 40, 3, 1]]) ctx.place(`tree:willow:${v}`, x, 0, z, r, 11);
  // 水渠：条石驳岸 + 汉白玉压面
  scene.add(createWater(canal, -1.1));
  buildWaterBank(ctx, { poly: canal, y: -1.1, style: 'stone', height: 1.1, depth: 1.2, capMat: 'marble', width: 0.5 });

  // 花坛（土面 + 开花灌木）与草地
  buildLawn(ctx, { poly: [[66, 50], [90, 50], [90, 62], [66, 62]], kind: 'bed', curb: 0.35, curbW: 0.3, curbMat: 'marble', shrubs: 0.35, flowers: true, seed: 2 });
  buildLawn(ctx, { poly: pond(100, 34, 12, 8, 24, 3), y: 0.02, shrubs: 0.05, seed: 4 });
  // 峰石（须弥座占位）
  [['taihu', 0], ['taihu', 1], ['qing', 0], ['taihu', 2]].forEach(([s, v], i) => {
    const c = ctx.at(-8 + i * 7, 0, 58);
    c.add('marble', prismGeo([[-1.1, -0.8], [1.1, -0.8], [1.1, 0.8], [-1.1, 0.8]], 0, 0.6));
    c.place(`rock:${s}:${v}`, 0, 0.6, 0, i, s === 'qing' ? 2.2 : 3.2);
  });
  ctx.at(0, 0, 0).add('stone_grey', boxGeo(0.01, 0.01, 0.01));

  updateWater(20);
  return { cam: [60, 75, 150], tgt: [0, 0, 0], shadowRadius: 200 };
}
