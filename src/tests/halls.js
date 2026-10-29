// 单体建筑总装测试：太和殿式重檐庑殿、保和殿式重檐歇山、门殿、配殿、亭、游廊
import { buildHall, buildGallery } from '../core/building.js';
export default function build(ctx) {
  // 太和殿式（11×5 间，重檐庑殿，三台另建，这里只给 2m 台基）
  buildHall(ctx.at(0, 0, 0), { grade: 1, eaveW: 67, eaveD: 40, nBays: 11, nDepth: 5, corridor: true, colH: 9.5,
    double: { inset: 6 }, roof: { type: 'wudian', beasts: 10 }, platform: { h: 2, style: 'xumizuo', railing: 'marble' } });
  // 保和殿式（重檐歇山）
  buildHall(ctx.at(0, 0, -70), { grade: 2, eaveW: 53, eaveD: 28, nBays: 9, nDepth: 5, colH: 8, double: { inset: 5 }, roof: { type: 'xieshan' } });
  // 门殿（乾清门式，单檐歇山）
  buildHall(ctx.at(-75, 0, 0), { kind: 'gate', grade: 3, eaveW: 34, eaveD: 18, nBays: 5, nDepth: 2, roof: { type: 'xieshan' } });
  // 配殿（单檐硬山 + 前廊）
  buildHall(ctx.at(-75, 0, -45, Math.PI / 2), { grade: 4, eaveW: 24, eaveD: 11, nBays: 5, corridor: true, roof: { type: 'yingshan', gableWallMat: 'wall_red' } });
  // 小值房（硬山灰瓦）
  buildHall(ctx.at(-45, 0, -45), { grade: 5, eaveW: 14, eaveD: 7, roof: { type: 'yingshan', tile: 'grey' }, tile: 'grey' });
  // 四角攒尖亭
  buildHall(ctx.at(65, 0, 0), { kind: 'pavilion', grade: 4, eaveW: 10, eaveD: 10, nBays: 1, nDepth: 1, colH: 3.6, roof: { type: 'cuanjian', sides: 4, rise: 4.5 } });
  // 游廊
  buildGallery(ctx.at(65, 0, -40), { L: 30, d: 2.8 });
  return { cam: [60, 60, 110], tgt: [0, 10, -20], shadowRadius: 140 };
}
