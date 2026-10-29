// 城外远景：皇城内的胡同四合院（灰瓦平房，低模实例化）、太庙与中山公园古柏林、城市地面。
// 只作远景衬托：低矮灰色、不抢紫禁城主体。三角形预算：房屋原型 ≈ 22 面，树冠原型 ≈ 100 面。
import * as THREE from 'three';
import { registerProtoFamily } from '../../core/protos.js';
import { defineMaterial } from '../../core/materials.js';
import { fromArrays, paint, mergeColored, polyTopGeo } from '../../core/geom.js';
import { rand, groundMaterial } from './common.js';

defineMaterial('walls_hutong', { color: 0x7a7772, roughness: 0.92 });
defineMaterial('walls_roofgrey', { color: 0x4b4e53, roughness: 0.85 });
groundMaterial('walls_cityground', 0x76736d, 'paving', 8);
groundMaterial('walls_parkground', 0x8fa070, 'grass', 8, 'grass_normal');

/** 远景树冠：'walls_canopy:<round|cone>:<v>'，单位高 1（底 y=0） */
registerProtoFamily('walls_canopy', (key, [kind = 'round', v = '0']) => {
  const R = rand(31 + (+v || 0) * 17 + (kind === 'cone' ? 101 : 0));
  const cone = kind === 'cone';
  const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const n = 1 + 0.12 * Math.sin(x * 5.1 + (+v) * 1.7) * Math.cos(z * 4.3 + y * 3.1);
    if (cone) { const t = (y + 1) / 2; x *= 0.36 * (1.15 - 0.85 * t) * n; z *= 0.36 * (1.15 - 0.85 * t) * n; y = 0.28 + t * 0.72; }
    else { x *= 0.44 * n; z *= 0.44 * n; y = 0.6 + y * 0.36 * n; }
    pa.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const col = cone ? [0.17 + R() * 0.05, 0.27 + R() * 0.05, 0.15] : [0.24 + R() * 0.06, 0.34 + R() * 0.06, 0.17];
  paint(g, new THREE.Color(...col));
  const t = new THREE.CylinderGeometry(0.035, 0.055, cone ? 0.36 : 0.32, 5, 1, true).translate(0, cone ? 0.18 : 0.16, 0);
  paint(t, new THREE.Color(0.32, 0.26, 0.2));
  return [{ mat: 'nt_crown', geo: mergeColored([g]) }, { mat: 'nt_bark', geo: mergeColored([t]) }];
});

/** 胡同平房：'walls_house'，单位 1×1×1（墙身 0.6，硬山双坡顶，脊沿局部 X） */
registerProtoFamily('walls_house', () => {
  const pos = [], uv = [], rp = [], ru = [];
  const q = (P, a, b, c, d) => { for (const k of [a, b, c, a, c, d]) { P.push(...k); } };
  const wy = 0.6, e = 0.05;
  // 墙身四面
  q(pos, [-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, wy, 0.5], [-0.5, wy, 0.5]);
  q(pos, [0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, wy, -0.5], [0.5, wy, -0.5]);
  q(pos, [0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, wy, -0.5], [0.5, wy, 0.5]);
  q(pos, [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, wy, 0.5], [-0.5, wy, -0.5]);
  // 山尖
  pos.push(0.5, wy, 0.5, 0.5, wy, -0.5, 0.5, 1, 0, -0.5, wy, -0.5, -0.5, wy, 0.5, -0.5, 1, 0);
  // 屋面两坡（前后出檐 e）
  q(rp, [-0.5 - e, wy - e * 0.8, 0.5 + e], [0.5 + e, wy - e * 0.8, 0.5 + e], [0.5 + e, 1, 0], [-0.5 - e, 1, 0]);
  q(rp, [0.5 + e, wy - e * 0.8, -0.5 - e], [-0.5 - e, wy - e * 0.8, -0.5 - e], [-0.5 - e, 1, 0], [0.5 + e, 1, 0]);
  for (let i = 0; i < pos.length / 3; i++) uv.push(0, 0);
  for (let i = 0; i < rp.length / 3; i++) ru.push(0, 0);
  return [{ mat: 'walls_hutong', geo: fromArrays(pos, uv) }, { mat: 'walls_roofgrey', geo: fromArrays(rp, ru) }];
});

/** 一座四合院：北房（正房）、南房（倒座）、东西厢房；院中偶植槐树 */
function courtyard(ctx, cx, cz, w, d, R, st) {
  if (R() < 0.07) { // 空地/大树
    ctx.place(`walls_canopy:round:${(R() * 4) | 0}`, cx, 0, cz, R() * 6.28, 12 + R() * 5); st.trees++;
    return;
  }
  const hN = 5.0 + R() * 1.6, hS = 4.2 + R() * 0.9, hW = 4.2 + R() * 0.9;
  ctx.place('walls_house', cx, 0, cz - d / 2 + 4.2, 0, [w - 1.2, hN, 7.6]);
  ctx.place('walls_house', cx, 0, cz + d / 2 - 3.0, 0, [w - 1.2, hS, 5.2]);
  if (w > 14 && d > 22) for (const s of [-1, 1]) ctx.place('walls_house', cx + s * (w / 2 - 3.0), 0, cz + 0.4, Math.PI / 2, [d - 15.5, hW, 4.6]);
  if (R() < 0.55) { ctx.place(`walls_canopy:round:${(R() * 4) | 0}`, cx + (R() - 0.5) * 3, 0, cz + 0.5, R() * 6.28, 9 + R() * 6); st.trees++; }
  st.houses += w > 14 ? 4 : 2;
}

/** 胡同街区：东西向胡同（院落坐北朝南，进深 24~34m），偶有南北向小巷、空地与大院 */
function hutongs(ctx, x0, x1, z0, z1, seed, st, skip = () => false) {
  const R = rand(seed);
  let z = z0;
  while (z + 24 <= z1) {
    const d = 24 + R() * 10;
    let x = x0 + R() * 4;
    while (x < x1 - 12) {
      const big = R() < 0.04;
      const w = big ? 32 + R() * 20 : 12 + R() * 11;
      if (x + w > x1) break;
      if (!skip(x + w / 2, z + d / 2)) {
        if (big) { // 大院（府邸、寺庙）：前后两进，正房高大
          ctx.place('walls_house', x + w / 2, 0, z + 5, 0, [w * 0.6, 8.5, 10]);
          ctx.place('walls_house', x + w / 2, 0, z + d - 4, 0, [w * 0.7, 6, 7]);
          for (const sx of [-1, 1]) ctx.place('walls_house', x + w / 2 + sx * (w / 2 - 3), 0, z + d / 2, Math.PI / 2, [d - 12, 5, 5]);
          for (let k = 0; k < 3; k++) ctx.place(`walls_canopy:round:${(R() * 4) | 0}`, x + w * (0.25 + 0.25 * k), 0, z + d / 2 + (R() - 0.5) * 4, R() * 6.28, 12 + R() * 6);
          st.houses += 4; st.trees += 3;
        } else courtyard(ctx, x + w / 2, z + d / 2, w, d, R, st);
      }
      x += w + (R() < 0.1 ? 6 + R() * 3 : 0.5);
    }
    // 胡同口、胡同内行道树
    for (let k = 0, n = 1 + ((R() * 3) | 0); k < n; k++) { ctx.place(`walls_canopy:round:${(R() * 4) | 0}`, x0 + R() * (x1 - x0), 0, z + d + 3, R() * 6.28, 11 + R() * 5); st.trees++; }
    z += d + 6 + (R() < 0.12 ? 9 : 0);
  }
}

/** 古柏林（公园）：polygon 范围内随机 */
function grove(ctx, x0, x1, z0, z1, n, seed, st) {
  const R = rand(seed);
  for (let k = 0; k < n; k++) {
    const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
    ctx.place(`walls_canopy:${R() < 0.7 ? 'cone' : 'round'}:${(R() * 4) | 0}`, x, 0.2, z, R() * 6.28, 12 + R() * 7);
    st.trees++;
  }
}

/** 城外远景总装 */
export function buildCityContext(ctx) {
  const st = { houses: 0, trees: 0 };
  // 城市地面（紫禁城地面网格之外）
  const G = [[-800, -470, -1150, 960], [470, 800, -1150, 960], [-470, -235, -1150, -585], [235, 470, -1150, -585],
    [-235, 235, -1150, -1080], [-235, 235, -592, -585], [-100, 100, 600, 960]];
  for (const [x0, x1, z0, z1] of G) ctx.add('walls_cityground', polyTopGeo([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0.15));
  // 东：南北池子一带胡同（至王府井以西）
  hutongs(ctx, 478, 780, -1120, 610, 11, st);
  // 西：南北长街一带（再西为中南海、北海，不建）
  hutongs(ctx, -650, -478, -560, 610, 23, st);
  // 东北：景山东街一带
  hutongs(ctx, 250, 470, -1120, -600, 37, st);
  // 南：太庙（东）与中山公园（西）——古柏林与草地
  for (const [x0, x1] of [[100, 465], [-465, -100]]) {
    ctx.add('walls_parkground', polyTopGeo([[x0, 600], [x1, 600], [x1, 960], [x0, 960]], 0.15));
    grove(ctx, x0 + 8, x1 - 8, 612, 930, 150, x0 > 0 ? 71 : 73, st);
  }
  return st;
}
