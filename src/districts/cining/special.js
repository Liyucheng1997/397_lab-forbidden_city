// 外西路特殊构筑：雨花阁（明三暗四藏传佛楼，鎏金铜瓦四角攒尖 + 四条鎏金铜龙 + 鎏金喇嘛塔宝顶）、
// 鎏金铜麒麟原型 'cn_qilin'、鎏金铜塔、脊上行龙。
import * as THREE from 'three';
import { buildHall } from '../../core/building.js';
import { buildBay } from '../../core/openings.js';
import { buildPlatform, buildRailing } from '../../core/platform.js';
import { boxGeo, cylGeo, latheGeo, merge } from '../../core/geom.js';
import { defineMaterial } from '../../core/materials.js';
import { registerProtoFamily } from '../../core/protos.js';

// ---- 鎏金铜瓦与鎏金脊件（雨花阁顶层）。glaze_gold 供脊、宝顶等以 ridgeColor:'gold' 引用 ----
defineMaterial('tile_gold', { color: 0xffffff, map: 'tile_yellow', normalMap: 'tile_normal', roughnessMap: 'tile_rough', roughness: 0.34, metalness: 0.4, period: [1.2, 1.2], envMapIntensity: 1.6 });
defineMaterial('glaze_gold', { color: 0xd8a03c, roughness: 0.3, metalness: 1.0, envMapIntensity: 1.5 });

const V3 = THREE.Vector3;

/** 变径管（沿中心线 pts，半径 rs），环向 seg 段；返回索引几何（含 normal/uv） */
function tube(pts, rs, seg = 8) {
  const pos = [], uv = [], idx = [];
  const up = new V3(0, 1, 0);
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new V3().subVectors(b, a).normalize();
    let s = new V3().crossVectors(t, up);
    if (s.lengthSq() < 1e-6) s.set(1, 0, 0);
    s.normalize();
    const u = new V3().crossVectors(s, t).normalize();
    if (i > 0) acc += pts[i].distanceTo(pts[i - 1]);
    for (let j = 0; j <= seg; j++) {
      const ang = (j / seg) * Math.PI * 2;
      const p = new V3().copy(pts[i]).addScaledVector(s, Math.cos(ang) * rs[i]).addScaledVector(u, Math.sin(ang) * rs[i]);
      pos.push(p.x, p.y, p.z); uv.push(acc, j / seg);
    }
  }
  const R = seg + 1;
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * R + j, b = (i + 1) * R + j, c = (i + 1) * R + j + 1, d = i * R + j + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const ell = (rx, ry, rz, x, y, z, ws = 12, hs = 8) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
const cone = (r, h, x, y, z, rx = 0, rz = 0, seg = 6) => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g; };

/**
 * 脊上行龙：沿戗脊路径（自上而下）爬行，龙首在下端昂起外望，尾在上端。path=[[x,y,z],...]，ridgeH 脊高
 */
export function ridgeDragon(ctx, path, { ridgeH = 0.35, scale = 1, mat = 'gold' } = {}) {
  const P = path.map((p) => new V3(p[0], p[1] + ridgeH, p[2]));
  let total = 0;
  const cum = [0];
  for (let i = 1; i < P.length; i++) { total += P[i].distanceTo(P[i - 1]); cum.push(total); }
  const at = (d) => {
    for (let i = 1; i < P.length; i++) if (d <= cum[i] || i === P.length - 1) { const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); return new V3().lerpVectors(P[i - 1], P[i], Math.min(1, Math.max(0, t))); }
    return P[P.length - 1].clone();
  };
  const d0 = total * 0.12, d1 = total * 0.86, n = 34;
  const pts = [], rs = [];
  const r0 = 0.17 * scale;
  for (let k = 0; k <= n; k++) {
    const t = k / n, d = d0 + (d1 - d0) * t;
    const p = at(d);
    p.y += r0 * 0.9 + Math.sin(t * Math.PI * 5) * 0.32 * scale * (0.4 + 0.6 * t);
    pts.push(p);
    rs.push(r0 * (0.3 + 0.7 * Math.sin(Math.min(1, t * 1.15) * Math.PI / 2)));
  }
  const geos = [tube(pts, rs, 8)];
  // 龙首：下端前伸、昂起
  const end = pts[pts.length - 1], prev = pts[pts.length - 4];
  const dir = new V3().subVectors(end, prev).setY(0).normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const head = merge([
    ell(0.2, 0.17, 0.3, 0, 0.12, 0.12, 10, 7), // 头
    ell(0.13, 0.09, 0.22, 0, 0.08, 0.38, 8, 6), // 吻
    ell(0.11, 0.05, 0.2, 0, -0.03, 0.34, 8, 5), // 下颚（张口）
    cone(0.035, 0.32, 0.08, 0.24, 0.02, -0.9, -0.25), cone(0.035, 0.32, -0.08, 0.24, 0.02, -0.9, 0.25), // 双角
    cone(0.05, 0.28, 0, 0.18, -0.12, -1.6), // 鬣
    ell(0.06, 0.06, 0.06, 0.1, 0.2, 0.25, 6, 4), ell(0.06, 0.06, 0.06, -0.1, 0.2, 0.25, 6, 4), // 目
  ]);
  head.scale(scale * 1.25, scale * 1.25, scale * 1.25);
  head.rotateX(-0.35);
  head.rotateY(yaw);
  head.translate(end.x + dir.x * 0.05, end.y + 0.12 * scale, end.z + dir.z * 0.05);
  geos.push(head);
  // 四爪：身下两处
  for (const t of [0.3, 0.72]) {
    const i = Math.round(t * n), p = pts[i];
    const a = pts[i + 1] || p;
    const tdir = new V3().subVectors(a, p).normalize();
    const side = new V3().crossVectors(tdir, new V3(0, 1, 0)).normalize();
    for (const sg of [-1, 1]) {
      const foot = p.clone().addScaledVector(side, sg * 0.22 * scale);
      foot.y = at(d0 + (d1 - d0) * t).y + 0.02;
      geos.push(tube([p.clone(), new V3().lerpVectors(p, foot, 0.5).addScaledVector(side, sg * 0.06), foot], [0.06 * scale, 0.05 * scale, 0.045 * scale], 5));
    }
  }
  // 尾鳍
  const tail = pts[0];
  geos.push(cone(0.07 * scale, 0.45 * scale, tail.x, tail.y, tail.z, 0, 0, 5));
  ctx.add(mat, merge(geos));
}

/** 鎏金喇嘛塔（宝顶）：方须弥座、覆钵、塔脖、十三天、伞盖、日月宝珠。底 y=0，高 h */
export function gildedStupa(ctx, h = 3.6, mat = 'gold') {
  const k = h / 3.6;
  const sq = (pts) => { const g = latheGeo(pts.map(([r, y]) => [r * k * Math.SQRT2, y * k]), 4); g.rotateY(Math.PI / 4); return g; };
  const rd = (pts, seg = 16) => latheGeo(pts.map(([r, y]) => [r * k, y * k]), seg);
  const geos = [
    sq([[0.62, 0], [0.62, 0.12], [0.55, 0.16], [0.5, 0.3], [0.55, 0.42], [0.62, 0.46], [0.62, 0.56], [0.001, 0.56]]), // 须弥座
    sq([[0.48, 0.56], [0.48, 0.62], [0.42, 0.62], [0.42, 0.7], [0.001, 0.7]]), // 金刚圈台
    rd([[0.36, 0.7], [0.46, 0.78], [0.52, 0.95], [0.5, 1.15], [0.4, 1.32], [0.22, 1.42], [0.001, 1.44]], 18), // 覆钵（塔肚）
    sq([[0.24, 1.42], [0.24, 1.58], [0.28, 1.6], [0.28, 1.64], [0.001, 1.64]]), // 塔脖子（亚字座简化）
  ];
  // 十三天（相轮）
  const rings = [];
  for (let i = 0; i < 13; i++) {
    const y = 1.64 + i * 0.095, r = 0.2 - i * 0.008;
    rings.push([r, y], [r + 0.025, y + 0.035], [r, y + 0.07], [r - 0.02, y + 0.095]);
  }
  geos.push(rd([[0.001, 1.64], ...rings, [0.001, 2.88]], 14));
  geos.push(rd([[0.001, 2.86], [0.34, 2.9], [0.36, 2.94], [0.2, 3.0], [0.06, 3.04], [0.001, 3.05]], 16)); // 伞盖（华盖）
  geos.push(rd([[0.001, 3.04], [0.07, 3.1], [0.09, 3.16], [0.06, 3.22], [0.001, 3.24]], 10)); // 宝瓶
  const moon = new THREE.TorusGeometry(0.13 * k, 0.025 * k, 5, 12, Math.PI * 1.2);
  moon.rotateZ(Math.PI * 0.9); moon.translate(0, 3.33 * k, 0);
  geos.push(moon, ell(0.075 * k, 0.075 * k, 0.075 * k, 0, 3.36 * k, 0, 10, 7), ell(0.05 * k, 0.07 * k, 0.05 * k, 0, 3.52 * k, 0, 8, 6));
  ctx.add(mat, merge(geos));
}

// ---- 鎏金铜麒麟（慈宁门前一对）：蹲坐、独角、鬃鬣火焰、分蹄；石须弥座。单位高 1（含座），面朝 +Z ----
function qilinParts() {
  const V = (x, y, z) => new V3(x, y, z);
  const body = merge([
    ell(0.14, 0.13, 0.18, 0, 0.53, -0.05), // 后躯
    ell(0.11, 0.1, 0.15, 0, 0.56, 0.02), // 腹
    ell(0.125, 0.16, 0.12, 0, 0.67, 0.06), // 胸
    ell(0.06, 0.1, 0.13, 0.11, 0.47, -0.06), ell(0.06, 0.1, 0.13, -0.11, 0.47, -0.06), // 后腿（蹲）
    ell(0.045, 0.025, 0.06, 0.11, 0.395, 0.06, 6, 4), ell(0.045, 0.025, 0.06, -0.11, 0.395, 0.06, 6, 4), // 后蹄
    tube([V(0.075, 0.39, 0.14), V(0.08, 0.5, 0.13), V(0.075, 0.63, 0.1)], [0.04, 0.045, 0.055], 7), // 前腿
    tube([V(-0.075, 0.39, 0.14), V(-0.08, 0.5, 0.13), V(-0.075, 0.63, 0.1)], [0.04, 0.045, 0.055], 7),
    ell(0.045, 0.028, 0.055, 0.075, 0.395, 0.16, 6, 4), ell(0.045, 0.028, 0.055, -0.075, 0.395, 0.16, 6, 4), // 分蹄
    tube([V(0, 0.72, 0.07), V(0, 0.8, 0.1), V(0, 0.86, 0.12)], [0.09, 0.08, 0.075], 8), // 颈
    ell(0.085, 0.075, 0.1, 0, 0.9, 0.14), // 头
    ell(0.06, 0.045, 0.085, 0, 0.875, 0.235, 8, 6), // 吻
    cone(0.03, 0.08, 0, 0.84, 0.24, Math.PI, 0, 5), // 须
    ell(0.022, 0.022, 0.02, 0.045, 0.915, 0.215, 6, 4), ell(0.022, 0.022, 0.02, -0.045, 0.915, 0.215, 6, 4), // 目
    cone(0.02, 0.14, 0, 0.95, 0.11, -0.55, 0, 5), // 独角
    cone(0.018, 0.07, 0.065, 0.93, 0.1, -0.4, -0.7, 4), cone(0.018, 0.07, -0.065, 0.93, 0.1, -0.4, 0.7, 4), // 耳
    ...[0, 1, 2, 3, 4].map((i) => cone(0.04 - i * 0.003, 0.14, (i % 2 ? 0.035 : -0.035), 0.9 - i * 0.045, 0.05 - i * 0.035, -2.0 + i * 0.1, 0, 5)), // 鬃鬣火焰
    ...[0, 1, 2].map((i) => cone(0.03, 0.1, 0, 0.66 - i * 0.05, -0.02 - i * 0.07, -2.3, 0, 5)), // 背脊火焰
    tube([V(0, 0.5, -0.2), V(0, 0.58, -0.27), V(0, 0.7, -0.24), V(0, 0.76, -0.17)], [0.04, 0.036, 0.03, 0.02], 6), // 尾
    cone(0.05, 0.16, 0, 0.74, -0.17, -0.6, 0, 6), // 尾端火焰
    cone(0.025, 0.1, 0.1, 0.56, 0.08, -2.2, -0.3, 4), cone(0.025, 0.1, -0.1, 0.56, 0.08, -2.2, 0.3, 4), // 肘部火焰
  ]);
  const base = merge([
    (() => { const g = latheGeo([[0.25, 0], [0.25, 0.05], [0.23, 0.07], [0.215, 0.12], [0.2, 0.14], [0.2, 0.26], [0.215, 0.28], [0.23, 0.33], [0.25, 0.35], [0.25, 0.38], [0.001, 0.38]].map(([r, y]) => [r * Math.SQRT2, y]), 4); g.scale(1, 1, 1.25); g.rotateY(Math.PI / 4); return g; })(),
  ]);
  return [{ mat: 'bronze_gilt', geo: body }, { mat: 'marble', geo: base }];
}
registerProtoFamily('cn_qilin', () => qilinParts());

/**
 * 雨花阁（乾隆十五年仿托林寺金殿建，藏传佛教密宗四部神殿）。world 主体中心 (X,Z)，正面朝南。
 * 外观三层（内四层，一、二层间北侧设暗层）：底层面阔进深各三间、周围廊、南出抱厦三间（绿琉璃瓦黄剪边，抱厦卷棚歇山）；
 * 二层三间，南东西三面平座，黄琉璃瓦蓝剪边腰檐；顶层一间，四面平座，琉璃挂檐板，四角攒尖鎏金铜瓦，四脊各一条鎏金铜行龙，宝顶鎏金喇嘛塔。
 */
export function buildYuhuage(ctx, { X = -211.5, Z = -243.9 } = {}) {
  const c = ctx.at(X, 0, Z, 0);
  const PH = 1.0;
  // 台基（主体 + 抱厦）与踏跺
  const poly = [[-9.0, -10.3], [9.0, -10.3], [9.0, 10.3], [6.7, 10.3], [6.7, 14.6], [-6.7, 14.6], [-6.7, 10.3], [-9.0, 10.3]];
  buildPlatform(c, { poly, h: PH, style: 'xumizuo', stairs: [{ at: [0, 14.6], w: 3.4 }, { at: [0, -10.3], w: 2.6 }] });
  // ---- 一层：周围廊（外圈檐柱开敞）+ 金柱围合 ----
  const bays1 = [1.6, 4.0, 4.6, 4.0, 1.6], dep1 = [1.6, 5.0, 5.2, 5.0, 1.6];
  const i1 = buildHall(c.at(0, PH, 0), {
    kind: 'pavilion', bench: false, bays: bays1, depthBays: dep1, colH: 5.6, colDia: 0.46, grade: 3, dougong: { kou: 0.07, cai: 3 }, caihua: 'hexi',
    overhang: 1.9, platform: false, detail: 3,
    roof: { type: 'skirt', inner: { w: 13.3, d: 15.9 }, rise: 2.0, tile: 'green', ridgeColor: 'yellow', beasts: 3 },
  });
  const sk1 = PH + i1.eaveY + 0.07 * 1.5 + 2.0;
  const xs = [-6.3, -2.3, 2.3, 6.3], zs = [-7.6, -2.6, 2.6, 7.6];
  const D = 0.44, hB = 4.3;
  for (const x of xs) for (const z of zs) {
    if (!(x === xs[0] || x === xs[3] || z === zs[0] || z === zs[3])) continue;
    c.place('col:wood_red', x, PH, z, 0, [D, sk1 - PH, D]);
  }
  const face = (types, along, fixed, rot) => {
    const pts = along === 'x' ? xs : zs;
    for (let i = 0; i < 3; i++) {
      const m = (pts[i] + pts[i + 1]) / 2, w = pts[i + 1] - pts[i] - D * 0.9;
      const cc = along === 'x' ? c.at(m, PH, fixed, rot) : c.at(fixed, PH, m, rot);
      buildBay(cc, { w, h: hB, type: types[i] });
      const band = boxGeo(w + D, sk1 - PH - hB, 0.3); band.translate(0, hB + (sk1 - PH - hB) / 2, -0.15);
      cc.add('board_red', band);
      const beam = boxGeo(w + D, 0.42, 0.34); beam.translate(0, hB + 0.21, -0.1);
      cc.add('beam_hexi', beam);
    }
  };
  face(['window', 'door', 'window'], 'x', 7.6, 0);
  face(['wall', 'door', 'wall'], 'x', -7.6, Math.PI);
  face(['wall', 'window', 'wall'], 'z', 6.3, Math.PI / 2);
  face(['wall', 'window', 'wall'], 'z', -6.3, -Math.PI / 2);
  // ---- 抱厦（三间，卷棚歇山，绿琉璃瓦黄剪边） ----
  buildHall(c.at(0, PH, 11.5), {
    bays: [3.4, 4.4, 3.4], depthBays: [4.6], colH: 4.3, colDia: 0.4, grade: 4, dougong: false, caihua: 'hexi', overhang: 1.25, platform: false,
    front: ['window', 'door', 'window'], back: 'open', sides: 'window', backCorridor: false,
    roof: { type: 'xieshan', juan: true, tile: 'green', ridgeColor: 'yellow', beasts: 3 },
  });
  // ---- 二层（三间，南东西三面平座；黄琉璃瓦蓝剪边腰檐） ----
  const y2 = sk1 + 0.05;
  const c2 = c.at(0, y2, 0);
  const i2 = buildHall(c2, {
    bays: [4.0, 4.6, 4.0], depthBays: [5.0, 5.2, 5.0], colH: 3.9, colDia: 0.4, grade: 3, dougong: { kou: 0.065, cai: 3 }, caihua: 'hexi',
    overhang: 1.8, platform: false, front: ['window', 'door', 'window'], back: 'window', sides: 'window', detail: 3,
    roof: { type: 'skirt', inner: { w: 7.9, d: 7.9 }, rise: 2.4, tile: 'yellow', ridgeColor: 'blue', beasts: 3 },
  });
  pingzuo(c2, 12.6, 15.2, 0.95, 'SEW', 'board_green');
  const sk2 = i2.eaveY + 0.065 * 1.5 + 2.4;
  // ---- 顶层（一间，四面平座、琉璃挂檐板；四角攒尖鎏金铜瓦） ----
  const c3 = c2.at(0, sk2 + 0.05, 0);
  const i3 = buildHall(c3, {
    bays: [7.2], depthBays: [7.2], colH: 3.4, colDia: 0.38, grade: 3, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi',
    overhang: 1.65, platform: false, front: 'door', back: 'window', sides: 'window', detail: 3,
    roof: { type: 'cuanjian', sides: 4, rise: 3.7, tile: 'gold', ridgeColor: 'gold', beasts: -1, ornaments: false, lift: 0.55 },
  });
  pingzuo(c3, 7.2, 7.2, 0.9, 'NESW', 'glaze_green');
  for (const hip of i3.roof.hips) ridgeDragon(c3, hip.path, { ridgeH: 0.3, scale: 0.95 });
  gildedStupa(c3.at(0, i3.roof.ridgeY - 0.15, 0), 3.8);
  const top = y2 + sk2 + 0.05 + i3.roof.ridgeY + 3.8;
  return { top };
}

/** 平座：楼板挑出 bd，四周（sides 子集）木栏杆 + 挂檐板 */
function pingzuo(c, w, d, bd, sides, band) {
  const bw = w + 2 * bd, bdd = d + 2 * bd;
  const slab = boxGeo(bw, 0.22, bdd); slab.translate(0, -0.11, 0);
  c.add('wood_red', slab);
  for (const [L, x, z, r] of [[bw, 0, bdd / 2, 0], [bw, 0, -bdd / 2, Math.PI], [bdd, bw / 2, 0, Math.PI / 2], [bdd, -bw / 2, 0, -Math.PI / 2]]) {
    const g = boxGeo(L, 0.5, 0.06); g.translate(0, -0.3, 0.03);
    c.at(x, 0, z, r).add(band, g);
  }
  const hw = bw / 2 - 0.1, hd = bdd / 2 - 0.1;
  const P = { S: [[-hw, hd], [hw, hd]], E: [[hw, hd], [hw, -hd]], N: [[hw, -hd], [-hw, -hd]], W: [[-hw, -hd], [-hw, hd]] };
  for (const s of sides) buildRailing(c, { path: P[s], y: 0, style: 'wood_red', height: 0.95, ends: 'post' });
}
