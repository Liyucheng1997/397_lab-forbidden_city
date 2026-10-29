// 脊饰测试：全部脊饰一字排开特写 + 庑殿（太和殿比例，9 走兽）/ 歇山 / 攒尖近景
import { ornamentTriCount } from '../core/ornaments.js';
import { buildRoof } from '../core/roof.js';
import { boxGeo } from '../core/geom.js';

const COLS = ['yellow', 'green', 'blue', 'black'];
const STYLES = ['gold', 'yellow', 'green', 'blue', 'black', 'tiered'];

export default function build(ctx) {
  const box = (x, y, z, w, h, d, mat = 'marble') => { const g = boxGeo(w, h, d); g.translate(x, y + h / 2, z); ctx.add(mat, g); };
  box(0, 0, -0.3, 21, 0.3, 7.6);
  const y0 = 0.3;
  // 后排：正吻（各色，侧面朝 +Z）、正吻正视、垂兽、套兽、宝顶
  COLS.forEach((c, i) => ctx.place(`wen:${c}`, -9.4 + i * 1.5, y0, -2.6, 0, 1.3));
  ctx.place('wen:yellow', -3.6, y0, -2.6, Math.PI / 2, 1.3);
  ctx.place('chuishou:yellow', -2.2, y0, -2.6, Math.PI / 2, 0.9);
  ctx.place('chuishou:green', -1.0, y0, -2.6, 0, 0.9);
  box(0.4, y0, -2.9, 0.5, 0.45, 0.4, 'wood_red'); box(1.6, y0, -2.9, 0.5, 0.45, 0.4, 'wood_red');
  ctx.place('taoshou:yellow', 0.4, y0 + 0.45, -2.8, Math.PI / 2, 0.6);
  ctx.place('taoshou:green', 1.6, y0 + 0.45, -2.7, 0, 0.6);
  STYLES.forEach((s, i) => ctx.place(`baoding:${s}`, 3.0 + i * 1.15, y0, -2.6, 0, 1.0));
  // 中排：走兽侧面（面朝 +X）；前排：走兽正面（面朝 +Z）
  for (let k = 0; k <= 10; k++) ctx.place(`beast:${k}:yellow`, -9.4 + k * 0.92, y0, -0.3, Math.PI / 2, 0.7);
  for (let k = 0; k <= 10; k++) ctx.place(`beast:${k}:${k % 2 ? 'green' : 'yellow'}`, -9.4 + k * 0.92, y0, 1.9, 0, 0.7);
  // 瓦当
  box(5.6, y0, 1.1, 5.2, 0.5, 0.6, 'wall_red');
  for (let i = 0; i < 8; i++) ctx.place(`wadang:${COLS[i % 4]}`, 3.4 + i * 0.6, y0 + 0.75, 1.42, 0, 0.32);

  // 屋顶：庑殿（太和殿比例：吻 3.4、脊 1.7、走兽 0.48）、歇山、攒尖
  const roofs = [
    { x: -40, z: -45, s: { type: 'wudian', w: 60, d: 34, y: 18, tile: 'yellow', beasts: 9, wenH: 3.4, ridgeH: 1.7, beastH: 0.48 } },
    { x: 30, z: -45, s: { type: 'xieshan', w: 26, d: 16, y: 9, tile: 'yellow', beasts: 7 } },
    { x: 30, z: -10, s: { type: 'xieshan', w: 14, d: 9, y: 6, tile: 'green', beasts: 5 } },
    { x: 60, z: -45, s: { type: 'cuanjian', sides: 4, w: 16, y: 8, rise: 7, tile: 'yellow', baoding: 'gold' } },
    { x: 60, z: -15, s: { type: 'cuanjian', sides: 8, w: 8, y: 4, rise: 4.5, tile: 'blue', baoding: 'blue', soffitFull: true } },
  ];
  for (const it of roofs) {
    const c = ctx.at(it.x, 0, it.z);
    const s = it.s;
    const g = boxGeo(s.w - 4, s.y, (s.d ?? s.w) - 4); g.translate(0, s.y / 2, 0);
    c.add('wall_red', g);
    buildRoof(c, s);
  }

  const keys = ['wen:yellow', 'chuishou:yellow', 'taoshou:yellow', 'wadang:yellow', ...STYLES.map((s) => `baoding:${s}`), ...Array.from({ length: 11 }, (_, k) => `beast:${k}:yellow`)];
  console.log('[orn tris] ' + keys.map((k) => `${k}=${ornamentTriCount(k)}`).join(' '));
  return { cam: [0, 4.2, 14], tgt: [0, 0.8, -0.6], shadowRadius: 60 };
}
