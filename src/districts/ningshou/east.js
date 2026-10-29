// 宁寿宫区·东路：畅音阁（三层大戏台）、扮戏楼、阅是楼、景福宫（三卷勾连搭卷棚歇山）、梵华楼、佛日楼
import { buildRoof } from '../../core/roof.js';
import { buildPlatform } from '../../core/platform.js';
import { rectOf, hallOn, towerOn, roof } from './lib.js';

/** 畅音阁：三层戏台（福台、禄台、寿台），坐南朝北，卷棚歇山，黄琉璃瓦绿剪边，通高约 20.7m */
export function changyinGe(ctx, b, api) {
  const t = towerOn(ctx, rectOf(40628847), 'N', {
    grade: 3, nBays: 3, nDepth: 3, dougong: { kou: 0.07, cai: 3 }, caihua: 'hexi', tile: 'yellow',
    platform: { h: 1.25, style: 'xumizuo', stairs: [] },
    roof: roof('xieshan', { juan: true, ridgeColor: 'green' }),
    stories: [
      { colH: 5.6, front: 'open', left: 'open', right: 'open', skirtRise: 1.2 },
      { colH: 3.9, inset: 0.7, front: 'open', balcony: true, skirtRise: 1.0 },
      { colH: 3.4, inset: 0.6, front: 'window' },
    ],
  });
  api.label('畅音阁', 336.7, t.topY + 1.5, -277.7, '清宫最大的戏台，乾隆三十七年建。三层，自上而下为福台、禄台、寿台，卷棚歇山顶，黄琉璃瓦绿剪边，通高 20.71 米；寿台台面设天井、地井，可演神仙升降之戏。');
}

/** 扮戏楼：畅音阁南侧的后台，两层卷棚 */
export function banxiLou(ctx, b, api) {
  towerOn(ctx, rectOf(40628833), 'N', {
    grade: 4, nBays: 7, nDepth: 2, caihua: 'xuanzi', tile: 'yellow', platform: { h: 0.6, style: 'plain', stairs: [] },
    roof: roof('yingshan', { juan: true, gableWallMat: 'wall_red' }),
    stories: [{ colH: 4.2, front: 'window' }, { colH: 3.2, inset: 0.3, front: 'window' }],
  });
}

/** 阅是楼：畅音阁对面的二层看戏楼，帝后看戏处 */
export function yueshiLou(ctx, b, api) {
  const t = towerOn(ctx, rectOf(40628834), 'S', {
    grade: 4, nBays: 5, nDepth: 2, caihua: 'hexi', tile: 'yellow', platform: { h: 1.0, style: 'xumizuo', stairs: [{ side: 'S' }] },
    roof: roof('xieshan', { juan: true, ridgeColor: 'green' }),
    stories: [{ colH: 3.9, front: 'door' }, { colH: 3.3, inset: 0.4, front: 'window', balcony: true }],
  });
  api.label('阅是楼', 334.6, t.topY + 1.2, -302.4, '畅音阁对面的二层看戏楼，建在三尺高台基上，帝后在此观戏；两侧转角廊为王公大臣看戏处。');
}

/** 景福宫：面阔五间，四周围廊，三卷勾连搭卷棚歇山顶（俗称“元宝顶”），前有宽大月台 */
export function jingfuGong(ctx, b, api) {
  const r = rectOf(40628843); // [328.7,348.7,-411.85,-397.75]
  const D = r[3] - r[2], W = r[1] - r[0];
  const dd = D / 3 + 0.7;
  const info = hallOn(ctx, r, 'S', {
    grade: 3, nBays: 5, nDepth: 4, corridor: 1.7, backCorridor: true, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi',
    platform: { h: 1.0, style: 'xumizuo', stairs: [{ side: 'N', w: 3 }] }, pl: '景福宫', plH: 0.38,
    roof: roof('xieshan', { juan: true, d: dd, rise: 2.4, beasts: 3 }),
  });
  const y = info.roof ? (info.eaveY + 0.06 * 1.5 + 0.03) : 6;
  const cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2;
  for (const s of [-1, 1]) buildRoof(ctx.at(cx, 0, cz + s * (D / 2 - dd / 2)), { type: 'xieshan', juan: true, w: W - 0.8, d: dd, y, rise: 1.75, tile: 'yellow', overhang: info.spec.overhang, beasts: 3 });
  // 殿前月台（汉白玉须弥座）
  buildPlatform(ctx, { poly: [[331.6, -398.6], [345.8, -398.6], [345.8, -391.4], [331.6, -391.4]], h: 0.95, style: 'xumizuo', railing: { style: 'marble' }, stairs: [{ at: [338.7, -391.4], w: 3.6, railings: true }] });
  api.label('景福宫', cx, info.topY + 1.2, cz, '宁寿宫区东路北端，仿建福宫静怡轩而建。面阔五间，四周围廊，屋顶为三卷勾连搭卷棚歇山（俗称“元宝顶”），为宁寿宫区特有；殿前月台宽大，下承汉白玉须弥座。');
}

/** 梵华楼（六品佛楼，二层七间）与佛日楼（二层三间） */
export function fanhuaLou(ctx, b, api) {
  const t = towerOn(ctx, rectOf(40628845), 'S', {
    grade: 4, nBays: 7, nDepth: 1, caihua: 'xuanzi', tile: 'yellow', platform: { h: 0.6, style: 'stone', stairs: [{ side: 'S' }] },
    roof: roof('yingshan', { gableWallMat: 'wall_red' }),
    stories: [{ colH: 3.8, front: 'door' }, { colH: 3.2, inset: 0.2, front: 'window' }],
  });
  api.label('梵华楼', 340.3, t.topY + 1, -425.9, '乾隆三十七年建的藏传佛教“六品佛楼”，上下两层各七间，楼内供奉佛像、佛塔与唐卡，保存完整。');
}
export function foriLou(ctx, b, api) {
  const t = towerOn(ctx, rectOf(40628846), 'S', {
    grade: 4, nBays: 3, nDepth: 1, caihua: 'xuanzi', tile: 'yellow', platform: { h: 0.6, style: 'stone', stairs: [{ side: 'S' }] },
    roof: roof('xieshan', { juan: true }),
    stories: [{ colH: 3.8, front: 'door' }, { colH: 3.2, inset: 0.2, front: 'window' }],
  });
  api.label('佛日楼', 320.1, t.topY + 1, -425.8, '景福宫西北的二层佛楼，面阔三间，与梵华楼同为宁寿宫区供佛之所。');
}
