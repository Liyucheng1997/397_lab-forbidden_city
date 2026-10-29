// walls 分区自检：单座角楼（含城台顶面示意）。catalog.html?t=walls_tower
import { prismGeo } from '../core/geom.js';
import { buildCornerTower } from '../districts/walls/cornerTower.js';

export default function build(ctx) {
  // 墩台顶面示意（城砖马道面），角楼原点即顶面
  ctx.add('wl_madao', prismGeo([[-18, -18], [14, -18], [14, 14], [-18, 14]], -0.6, 0));
  const r = buildCornerTower(ctx);
  return { cam: [27, 13, 27], tgt: [-1, r.top * 0.5, -1], shadowRadius: 40 };
}
