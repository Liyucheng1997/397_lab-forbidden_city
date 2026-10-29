// 灵沼轩单体测试（east_inner 分区）
import '../core/platform.js'; // 注册 pf_qingbai 等材质
import { buildLingzhao } from '../districts/east_inner/lingzhao.js';
import { createWater } from '../core/nature.js';
export default function build(ctx, { scene }) {
  const pool = [[-6.6, -11.4], [5.0, -11.6], [11.8, -6.0], [11.9, 6.2], [6.5, 11.2], [2.5, 8.5], [-4.1, 8.5], [-7.0, 10.9], [-12.4, 5.8], [-12.5, -6.2]];
  buildLingzhao(ctx, { cx: 0, cz: 0, pool, waterY: 0.14, addWater: (p, y) => scene.add(createWater(p, y)) });
  return { cam: [14, 16, 26], tgt: [0, 4, 0] };
}
