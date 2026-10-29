import { boxGeo, cylGeo, sweep, prismGeo } from '../core/geom.js';
export default function build(ctx) {
  ctx.add('wall_red', boxGeo(10, 6, 1.2), null);
  const c = ctx.at(0, 3, 0);
  c.add('marble', boxGeo(14, 0.5, 6));
  for (let i = -3; i <= 3; i++) ctx.at(i * 2, 0, 3).add('wood_red', cylGeo(0.3, 0.3, 5, 16));
  ctx.add('tile_yellow', prismGeo([[-8, 5], [8, 5], [8, 9], [-8, 9]], 0, 1));
  ctx.add('glaze_yellow', sweep([[-0.3, 0], [0.3, 0], [0.25, 0.6], [0, 0.75], [-0.25, 0.6]], [[-8, 7, -6], [0, 9, -6], [8, 7, -6]]));
  return { cam: [20, 14, 26], tgt: [0, 3, 0] };
}
