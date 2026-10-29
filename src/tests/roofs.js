// 屋顶类型一览
import '../core/ornaments.js';
import { buildRoof } from '../core/roof.js';
import { boxGeo } from '../core/geom.js';
export default function build(ctx) {
  const items = [
    { x: -60, z: 0, s: { type: 'wudian', w: 30, d: 18, y: 8, tile: 'yellow', beasts: 9 } },
    { x: -20, z: 0, s: { type: 'xieshan', w: 26, d: 16, y: 7, tile: 'yellow' } },
    { x: 15, z: 0, s: { type: 'xuanshan', w: 18, d: 10, y: 5, tile: 'grey' } },
    { x: 40, z: 0, s: { type: 'yingshan', w: 18, d: 10, y: 5, tile: 'green', gableWallMat: 'wall_red' } },
    { x: -60, z: 35, s: { type: 'cuanjian', sides: 4, w: 14, y: 6, rise: 6, tile: 'yellow' } },
    { x: -35, z: 35, s: { type: 'cuanjian', sides: 6, w: 9, y: 4, rise: 5, tile: 'blue', soffitFull: true } },
    { x: -15, z: 35, s: { type: 'cuanjian', sides: 8, w: 9, y: 4, rise: 5, tile: 'green', soffitFull: true } },
    { x: 5, z: 35, s: { type: 'cuanjian', sides: 0, r: 4.5, y: 4, rise: 4, tile: 'yellow', soffitFull: true } },
    { x: 30, z: 35, s: { type: 'xieshan', juan: true, w: 16, d: 10, y: 5, tile: 'green' } },
    { x: 55, z: 35, s: { type: 'xuanshan', juan: true, w: 14, d: 8, y: 4, tile: 'grey' } },
    { x: -20, z: -40, s: { type: 'skirt', w: 28, d: 18, y: 6, rise: 2.6, inner: { w: 22, d: 12 }, tile: 'yellow' }, upper: { type: 'xieshan', w: 26, d: 16, y: 11, tile: 'yellow' } },
    { x: 25, z: -40, s: { type: 'luding', w: 20, d: 16, y: 7, rise: 2.5, inner: { w: 12, d: 8 }, tile: 'yellow' } },
  ];
  for (const it of items) {
    const c = ctx.at(it.x, 0, it.z);
    const s = it.s;
    const bw = (s.w ?? s.r * 2) - 3, bd = (s.d ?? s.w ?? s.r * 2) - 3;
    const top = it.upper ? it.upper.y : s.y;
    const g = boxGeo(Math.max(1, bw), top, Math.max(1, bd)); g.translate(0, top / 2, 0);
    c.add('wall_red', g);
    buildRoof(c, s);
    if (it.upper) buildRoof(c, it.upper);
  }
  return { cam: [10, 70, 120], tgt: [0, 5, 0], shadowRadius: 140 };
}
