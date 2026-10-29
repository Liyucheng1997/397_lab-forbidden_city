// 延禧宫 灵沼轩（水晶宫）：宣统元年（1909）始建的西洋式水殿，未完工。
// 现存：汉白玉砌筑的底层（四面临水、拱形玻璃窗）+ 铸铁框架的上层；主楼四角各附一座圆形小楼（亭），水池环绕。
// 世界坐标直接建造（ctx 为世界坐标系）。
import * as THREE from 'three';
import { boxGeo, cylGeo, merge, sweep, offsetPoly } from '../../core/geom.js';
import { defineMaterial } from '../../core/materials.js';

defineMaterial('ei_glass', { color: 0x86a9b4, roughness: 0.06, metalness: 0.55, envMapIntensity: 1.4 });
defineMaterial('ei_iron', { color: 0x4a524f, roughness: 0.5, metalness: 0.65, envMapIntensity: 0.9 });
defineMaterial('ei_iron_gilt', { color: 0x9c7a3c, roughness: 0.35, metalness: 0.9 });

const TAU = Math.PI * 2;

/** 两点之间的细杆（铸铁柱/梁/肋），6 边形截面 */
export function rod(a, b, r, seg = 6) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = d.length();
  const g = cylGeo(r, r, L, seg, true);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyQuaternion(q);
  g.translate(a[0], a[1], a[2]);
  return g;
}

/** 拱形窗形状（宽 w，直段高 hs，顶部半圆），中心底边在原点，XY 平面 */
function archShape(w, hs, seg = 8) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, hs);
  for (let i = 1; i <= seg; i++) { const a = (Math.PI * i) / seg; s.lineTo((w / 2) * Math.cos(a), hs + (w / 2) * Math.sin(a)); }
  s.lineTo(-w / 2, 0);
  return s;
}
function archGeo(w, hs, z) {
  const g = new THREE.ShapeGeometry(archShape(w, hs));
  g.translate(0, 0, z);
  return g;
}

/** 墙面上一排拱窗：c 为墙面局部坐标（立面 z=0 朝 +Z），沿 x 等距 n 个 */
function archRow(acc, c, L, n, y, w, hs) {
  const step = L / n;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + step * (i + 0.5);
    const m = new THREE.Matrix4().makeTranslation(x, y, 0);
    acc.frame.push(c.clone().multiply(m).multiply(new THREE.Matrix4()), archGeo(w + 0.36, hs + 0.05, 0.035));
    acc.glass.push(c.clone().multiply(m), archGeo(w, hs, 0.06));
    // 窗下石台（窗台）
    const sill = boxGeo(w + 0.6, 0.12, 0.22); sill.translate(0, -0.06, 0.08);
    acc.frame.push(c.clone().multiply(m), sill);
  }
}

/**
 * 建造灵沼轩。o: { cx, cz, pool: [[x,z]...] 水池轮廓, waterY, addWater }
 * 返回 { top }
 */
export function buildLingzhao(ctx, o) {
  const { cx, cz } = o;
  const wy = o.waterY ?? 0.12;
  const c = ctx.at(cx, 0, cz);
  // ---- 水池：水面 + 条石池岸（压面石高出水面） ----
  if (o.pool) {
    const P = o.pool; // 不含重复闭合点
    o.addWater(P, wy);
    const ring = offsetPoly(P, 0.28).map(([x, z]) => [x, 0, z]);
    ctx.add('marble', sweep([[-0.3, -0.02], [0.3, -0.02], [0.3, 0.5], [0.24, 0.56], [-0.24, 0.56], [-0.3, 0.5]], ring, { closed: true }));
  }
  const groups = { frame: [], glass: [], band: [] };
  const acc = {
    frame: { push: (m, g) => groups.frame.push([m, g]) },
    glass: { push: (m, g) => groups.glass.push([m, g]) },
  };
  // ---- 主楼底层：汉白玉墙体（10 × 11），自水中升起 ----
  const hx = 5.0, hz = 5.5, H0 = 4.1;
  const plinth = boxGeo(2 * hx + 0.5, 0.7, 2 * hz + 0.5); plinth.translate(0, 0.35, 0);
  c.add('marble_block', plinth);
  const body = boxGeo(2 * hx, H0 - 0.7, 2 * hz); body.translate(0, 0.7 + (H0 - 0.7) / 2, 0);
  c.add('marble', body);
  // 檐口线脚（两层）与楼板
  for (const [y, t, e] of [[H0 - 0.05, 0.22, 0.18], [H0 + 0.2, 0.28, 0.32]]) {
    const g = boxGeo(2 * hx + 2 * e, t, 2 * hz + 2 * e); g.translate(0, y, 0);
    c.add('marble', g);
  }
  // 拱窗：四面；窗间壁柱（带柱头）与檐下雕饰带
  const faces = [[2 * hx, [0, hz], 0], [2 * hx, [0, -hz], Math.PI], [2 * hz, [hx, 0], Math.PI / 2], [2 * hz, [-hx, 0], -Math.PI / 2]];
  for (const [L, [fx, fz], r] of faces) {
    const m = new THREE.Matrix4().makeRotationY(r).premultiply(new THREE.Matrix4().makeTranslation(fx, 0, fz));
    archRow(acc, m, L - 4.4, 3, 1.15, 1.15, 1.45);
    const step = (L - 4.4) / 3;
    for (const k of [-2, -1, 1, 2]) {
      const x = (k + (k > 0 ? -0.5 : 0.5)) * step;
      const pil = boxGeo(0.34, H0 - 1.0, 0.12); pil.translate(x, 0.7 + (H0 - 1.0) / 2, 0.06);
      groups.frame.push([m.clone(), pil]);
      const cap = boxGeo(0.5, 0.16, 0.2); cap.translate(x, H0 - 0.38, 0.08);
      groups.frame.push([m.clone(), cap]);
    }
    const band = new THREE.PlaneGeometry(L - 0.2, 0.32);
    const uv = band.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (L - 0.2));
    band.translate(0, H0 - 0.48 + 0.16 - 0.1, 0.035);
    groups.band.push([m.clone(), band]);
  }
  // ---- 四角圆楼底层 ----
  const towers = [[-5.95, 3.6], [5.95, 3.6], [5.95, -3.55], [-5.95, -3.55]];
  const rT = 2.1;
  for (const [tx, tz] of towers) {
    const pl = cylGeo(rT + 0.25, rT + 0.25, 0.7, 20); pl.translate(tx, 0, tz);
    c.add('marble_block', pl);
    const cy = cylGeo(rT, rT, H0 - 0.7, 20); cy.translate(tx, 0.7, tz);
    c.add('marble', cy);
    for (const [y, t, e] of [[H0 - 0.16, 0.22, 0.16], [H0 + 0.06, 0.28, 0.3]]) {
      const g = cylGeo(rT + e, rT + e, t, 20); g.translate(tx, y, tz);
      c.add('marble', g);
    }
    // 外侧三扇拱窗
    const outA = Math.atan2(tx, tz);
    for (const da of [-0.75, 0, 0.75]) {
      const a = outA + da;
      const m = new THREE.Matrix4().makeRotationY(a).premultiply(new THREE.Matrix4().makeTranslation(tx + Math.sin(a) * (rT - 0.02), 0, tz + Math.cos(a) * (rT - 0.02)));
      archRow(acc, m, 1.2, 1, 1.15, 0.9, 1.3);
    }
  }
  for (const [m, g] of groups.frame) c.add('pf_qingbai', g, m);
  for (const [m, g] of groups.band) c.add('marble_band', g, m);
  for (const [m, g] of groups.glass) c.add('ei_glass', g, m);

  // ---- 上层：铸铁框架（未完工，无屋面） ----
  const iron = [], gilt = [];
  const y1 = H0 + 0.34;
  // 主楼外圈柱网与两道圈梁
  const yA = y1 + 3.2, yB = y1 + 3.4;
  const ringPts = (ax, az, n) => {
    const P = [];
    for (let i = 0; i <= n; i++) { const t = i / n; P.push([-ax + 2 * ax * t, -az], [ax, -az + 2 * az * t], [ax - 2 * ax * t, az], [-ax, az - 2 * az * t]); }
    return P;
  };
  const ax = hx - 0.35, az = hz - 0.35;
  const colsM = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; colsM.push([-ax + 2 * ax * t, -az], [-ax + 2 * ax * t, az]); }
  for (let i = 1; i < 5; i++) { const t = i / 5; colsM.push([-ax, -az + 2 * az * t], [ax, -az + 2 * az * t]); }
  for (const [x, z] of colsM) {
    iron.push(rod([x, y1, z], [x, yB, z], 0.09));
    // 柱头花饰（鎏金）
    const cap = cylGeo(0.17, 0.1, 0.22, 8); cap.translate(x, yA - 0.22, z); gilt.push(cap);
    const base = cylGeo(0.16, 0.18, 0.3, 8); base.translate(x, y1, z); iron.push(base);
  }
  const rect = (a, b, y) => [[-a, y, -b], [a, y, -b], [a, y, b], [-a, y, b]];
  for (const y of [yA, yB, y1 + 1.05]) {
    const R = rect(ax, az, y);
    for (let k = 0; k < 4; k++) iron.push(rod(R[k], R[(k + 1) % 4], y === y1 + 1.05 ? 0.035 : 0.075, 4));
  }
  // 栏杆（铸铁花栏）：立杆
  for (const [L, axis, s] of [[2 * ax, 'x', -1], [2 * ax, 'x', 1], [2 * az, 'z', -1], [2 * az, 'z', 1]]) {
    const n = Math.round(L / 0.35);
    for (let i = 1; i < n; i++) {
      const t = -L / 2 + (L * i) / n;
      const p = axis === 'x' ? [t, s * az] : [s * ax, t];
      iron.push(rod([p[0], y1, p[1]], [p[0], y1 + 1.05, p[1]], 0.018, 4));
    }
  }
  // 主楼顶部纵横梁（框格）与斜撑
  for (let i = 1; i < 5; i++) { const x = -ax + (2 * ax * i) / 5; iron.push(rod([x, yB, -az], [x, yB, az], 0.06, 4)); }
  for (let i = 1; i < 3; i++) { const z = -az + (2 * az * i) / 3; iron.push(rod([-ax, yB, z], [ax, yB, z], 0.06, 4)); }
  for (const s of [-1, 1]) for (const sz of [-1, 1]) iron.push(rod([s * ax, y1 + 0.1, sz * az], [s * (ax - 2 * ax / 5), yA - 0.3, sz * az], 0.04, 4));
  // 中央高起部分（两层框架：4.2 见方至 y≈8.8，3.2 见方至 y≈10.6，顶部肋穹）
  const c1 = 2.1, c2 = 1.6, yC1 = 8.8, yC2 = 10.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    iron.push(rod([sx * c1, yB, sz * c1], [sx * c1, yC1, sz * c1], 0.1));
    iron.push(rod([sx * c2, yC1, sz * c2], [sx * c2, yC2, sz * c2], 0.08));
    iron.push(rod([sx * c1, yC1, sz * c1], [sx * c2, yC1 + 0.02, sz * c2], 0.06, 4));
  }
  for (const [a, y] of [[c1, yC1], [c1, (yB + yC1) / 2], [c2, yC2], [c2, (yC1 + yC2) / 2]]) {
    const R = rect(a, a, y);
    for (let k = 0; k < 4; k++) iron.push(rod(R[k], R[(k + 1) % 4], 0.07, 4));
  }
  const domeRibs = (ox, oz, r0, y0, h, n, rr) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const P = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6, ang = t * Math.PI / 2; P.push([ox + Math.cos(a) * r0 * Math.cos(ang), y0 + h * Math.sin(ang), oz + Math.sin(a) * r0 * Math.cos(ang)]); }
      for (let k = 0; k < 6; k++) iron.push(rod(P[k], P[k + 1], rr, 4));
    }
    const fin = cylGeo(0.02, 0.12, 0.7, 8); fin.translate(ox, y0 + h, oz); gilt.push(fin);
    const ball = new THREE.SphereGeometry(0.16, 8, 6); ball.translate(ox, y0 + h + 0.72, oz); gilt.push(ball);
  };
  domeRibs(0, 0, c2 * 1.12, yC2, 1.7, 8, 0.05);
  // ---- 四角圆楼上层：8 根铸铁柱 + 圈梁 + 肋穹 ----
  for (const [tx, tz] of towers) {
    const r = rT - 0.3, yT = y1 + 3.0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r;
      iron.push(rod([x, y1, z], [x, yT, z], 0.07));
      const cap = cylGeo(0.13, 0.08, 0.18, 8); cap.translate(x, yT - 0.18, z); gilt.push(cap);
    }
    for (const [y, rr] of [[yT, 0.07], [y1 + 1.4, 0.05], [y1 + 1.0, 0.03]]) {
      const P = [];
      for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU; P.push([tx + Math.cos(a) * (y === y1 + 1.0 ? rT + 0.12 : r), y, tz + Math.sin(a) * (y === y1 + 1.0 ? rT + 0.12 : r)]); }
      for (let i = 0; i < 16; i++) iron.push(rod(P[i], P[i + 1], rr, 4));
    }
    // 圆楼外圈栏杆立杆
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU, x = tx + Math.cos(a) * (rT + 0.12), z = tz + Math.sin(a) * (rT + 0.12);
      iron.push(rod([x, y1, z], [x, y1 + 1.0, z], 0.016, 4));
    }
    domeRibs(tx, tz, r, yT, 1.5, 8, 0.045);
  }
  c.add('ei_iron', merge(iron));
  c.add('ei_iron_gilt', merge(gilt.map((g) => (g.index ? g.toNonIndexed() : g))));
  return { top: yC2 + 2.6 };
}
