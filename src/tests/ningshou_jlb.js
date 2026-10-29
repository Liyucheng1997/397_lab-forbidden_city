// 宁寿宫区：九龙壁单体测试
import { buildJiulongbi } from '../districts/ningshou/jiulongbi.js';
import { buildPalaceWall } from '../core/walls.js';
export default function build(ctx) {
  buildPalaceWall(ctx, { path: [[-25, -1.1], [25, -1.1]], h: 6, thick: 1.3 });
  buildJiulongbi(ctx.at(0, 0, 0));
  return { cam: [0, 3, 24], tgt: [0, 2, 0], shadowRadius: 40 };
}
