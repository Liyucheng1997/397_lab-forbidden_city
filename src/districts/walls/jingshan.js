// 景山（远景）：明永乐年间以挖筒子河之土堆成，中峰高约 45m；山上五亭——中峰万春亭（三重檐四角攒尖，黄琉璃瓦绿剪边），
// 两侧观妙亭、辑芳亭（重檐八角攒尖，绿琉璃瓦黄剪边），外侧周赏亭、富览亭（重檐圆攒尖，孔雀蓝琉璃瓦紫剪边）。
// 南墙正中为景山门。简化建模，作北面天际线。
import { gridSurface, cylGeo } from '../../core/geom.js';
import { buildRoof } from '../../core/roof.js';
import { buildHall } from '../../core/building.js';
import { buildPalaceWall } from '../../core/walls.js';
import { rand } from './common.js';
import './context.js';

export const JS = { cz: -885, x0: -235, x1: 235, z0: -1080, z1: -592 };
/** 五峰（x, 相对高, 横向半宽 sx, 纵向半宽 sz） */
const PEAKS = [[0, 43, 52, 62], [-78, 33, 44, 55], [78, 33, 44, 55], [-150, 24, 42, 50], [150, 24, 42, 50]];

/** 山体高度（米） */
export function hillH(x, z) {
  let e = 0;
  for (const [px, h, sx, sz] of PEAKS) {
    const dx = (x - px) / sx, dz = (z - JS.cz) / sz;
    e += Math.exp(0.16 * h * Math.exp(-(dx * dx + dz * dz))) - 1;
  }
  const base = Math.max(0, 1 - ((x / 215) ** 2 + ((z - JS.cz) / 100) ** 2));
  return Math.log(1 + e) / 0.16 * Math.min(1, base * 2.2);
}

/** 简化亭子：圆/八角/方攒尖，重檐或三重檐 */
function pavilion(ctx, { sides, r, tiers, tile, ridge, colH = 4.2 }) {
  const n = sides === 0 ? 16 : sides;
  // 台基与柱
  ctx.add('marble', cylGeo(r + 1.2, r + 1.4, 1.0, n));
  for (let i = 0; i < n; i += sides === 0 ? 2 : 1) {
    const a = ((i + 0.5) * Math.PI * 2) / n;
    ctx.place('col:wood_red', Math.sin(a) * r, 1.0, Math.cos(a) * r, 0, [0.4, colH, 0.4]);
  }
  ctx.add('wall_red', cylGeo(r * 0.62, r * 0.62, colH + 1.6, n).translate(0, 1.0, 0));
  ctx.add('beam_xuanzi', cylGeo(r + 0.15, r + 0.15, 0.5, n, true).translate(0, 1.0 + colH - 0.5, 0));
  let y = 1.0 + colH + 0.2, R = r + 1.8, top = y;
  for (let k = 0; k < tiers; k++) {
    const last = k === tiers - 1;
    const rr = R * (1 - 0.18 * k);
    if (last) {
      const info = buildRoof(ctx, { type: 'cuanjian', sides, r: rr, y, rise: rr * 0.95, tile, ridgeColor: ridge, beasts: 3, detail: 2, baodingH: rr * 0.32 });
      top = info.ridgeY + rr * 0.32;
    } else {
      const inner = rr * 0.62;
      buildRoof(ctx, { type: 'cuanjian', sides, r: rr, y, rise: rr * 0.42, tile, ridgeColor: ridge, beasts: 1, detail: 2, ornaments: false });
      ctx.add('board_red', cylGeo(inner, inner, 2.0, n, true).translate(0, y + rr * 0.3, 0));
      y += rr * 0.42 + 1.2;
    }
  }
  return top;
}

/** 景山：山体、林木、五亭、南墙与景山门。返回 { peak, labels } */
export function buildJingshan(ctx) {
  const { x0, x1, z0, z1 } = JS;
  // 园内地面
  const st = 10, gx = [], gz = [];
  for (let x = x0; x <= x1 + 1e-6; x += st) gx.push(x);
  for (let z = z0; z <= z1 + 1e-6; z += st) gz.push(z);
  const grid = gx.map((x) => gz.map((z) => [x, 0.25 + hillH(x, z), z]));
  const uv = gx.map((x) => gz.map((z) => [x, z + hillH(x, z) * 0.5]));
  ctx.add('walls_hill', gridSurface(grid, uv, true));
  // 园墙（红墙黄瓦），南面正中景山门
  buildPalaceWall(ctx, { path: [[x0, z1], [x1, z1]], h: 5.2, thick: 1.4, gaps: [{ from: 235 - 12, to: 235 + 12 }] });
  for (const xs of [x0, x1]) buildPalaceWall(ctx, { path: [[xs, z1], [xs, z1 - 160]], h: 5.2, thick: 1.4 });
  buildHall(ctx.at(0, 0, z1 + 0.5), {
    kind: 'gate', grade: 3, bays: [4.2, 5.0, 4.2], depthBays: [3.2, 3.2], colH: 4.8, dougong: { kou: 0.07, cai: 3 },
    platform: { h: 0.9, style: 'plain' }, roof: { type: 'xieshan', tile: 'yellow' }, plaque: '景山门',
  });
  // 林木（油松、侧柏为主）：近峰处用细模树，其余用远景树冠原型，满山苍翠
  const R = rand(31);
  let n = 0;
  for (let k = 0; k < 4000 && n < 640; k++) {
    const x = x0 + 8 + R() * (x1 - x0 - 16), z = z0 + 10 + R() * (z1 - z0 - 40);
    const h = hillH(x, z);
    if (h < 1.5 && R() < 0.55) continue;
    let near = false;
    for (const [px] of PEAKS) if (Math.abs(x - px) < 8 && Math.abs(z - JS.cz) < 8) near = true;
    if (near) continue;
    const fine = Math.abs(z - JS.cz) < 40 && PEAKS.some(([px]) => Math.abs(x - px) < 26) && R() < 0.5;
    if (fine) ctx.place(`tree:${R() < 0.55 ? 'pine' : 'cypress'}:${(R() * 4) | 0}`, x, 0.15 + h, z, R() * 6.28, 9 + R() * 4);
    else ctx.place(`walls_canopy:${R() < 0.72 ? 'cone' : 'round'}:${(R() * 4) | 0}`, x, 0.15 + h, z, R() * 6.28, 9 + R() * 4.5);
    n++;
  }
  // 五亭
  const labels = [];
  const defs = [
    { x: 0, name: '万春亭', sides: 4, r: 6.6, tiers: 3, tile: 'yellow', ridge: 'green', desc: '景山中峰之亭，清乾隆十六年（1751）建，三重檐四角攒尖，黄琉璃瓦绿剪边，为老北京城中轴线的制高点。' },
    { x: -78, name: '辑芳亭', sides: 8, r: 4.4, tiers: 2, tile: 'green', ridge: 'yellow', desc: '景山西侧次峰之亭，重檐八角攒尖，绿琉璃瓦黄剪边。' },
    { x: 78, name: '观妙亭', sides: 8, r: 4.4, tiers: 2, tile: 'green', ridge: 'yellow', desc: '景山东侧次峰之亭，重檐八角攒尖，绿琉璃瓦黄剪边。' },
    { x: -150, name: '富览亭', sides: 0, r: 3.6, tiers: 2, tile: 'blue', ridge: 'purple', desc: '景山最西峰之亭，重檐圆攒尖，孔雀蓝琉璃瓦紫剪边。' },
    { x: 150, name: '周赏亭', sides: 0, r: 3.6, tiers: 2, tile: 'blue', ridge: 'purple', desc: '景山最东峰之亭，重檐圆攒尖，孔雀蓝琉璃瓦紫剪边。' },
  ];
  for (const d of defs) {
    const y = 0.25 + hillH(d.x, JS.cz);
    const top = pavilion(ctx.at(d.x, y - 0.3, JS.cz), d);
    labels.push({ name: d.name, pos: [d.x, y + top + 2, JS.cz], desc: d.desc });
  }
  return { peak: 0.25 + hillH(0, JS.cz), labels, trees: n };
}

