// 几何工具：所有生成的 BufferGeometry 都带 position / normal / uv（UV 以米为单位，除非特别说明）
import * as THREE from 'three';

const V3 = THREE.Vector3;

/** 由三角形数组构造几何体（非索引）。positions/uvs 为扁平数组 */
export function fromArrays(positions, uvs, normals) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs || new Array((positions.length / 3) * 2).fill(0), 2));
  if (normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else g.computeVertexNormals();
  return g;
}

/** 网格曲面：grid[i][j] = [x,y,z]（i 沿 u，j 沿 v），uv[i][j] = [u,v]。flip 反转朝向 */
export function gridSurface(grid, uvGrid, flip = false) {
  const nu = grid.length, nv = grid[0].length;
  const pos = new Float32Array(nu * nv * 3), uv = new Float32Array(nu * nv * 2);
  let k = 0, q = 0;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const p = grid[i][j]; pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2];
    const t = uvGrid ? uvGrid[i][j] : [i, j]; uv[q++] = t[0]; uv[q++] = t[1];
  }
  const idx = [];
  for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
    const a = i * nv + j, b = (i + 1) * nv + j, c = (i + 1) * nv + j + 1, d = i * nv + j + 1;
    if (!flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 轴对齐长方体，中心在原点；UV 以米计（每个面 u=水平, v=竖直） */
export function boxGeo(sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  // BoxGeometry 面顺序：+x, -x, +y, -y, +z, -z，每面 4 顶点
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return g;
}

/** 竖直圆柱/圆台，底面 y=0，顶面 y=h；UV u=周长(米) v=高度(米) */
export function cylGeo(rTop, rBot, h, seg = 12, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv, pos = g.attributes.position;
  const circ = Math.PI * 2 * Math.max(rTop, rBot);
  for (let i = 0; i < uv.count; i++) {
    const isCap = Math.abs(g.attributes.normal.getY(i)) > 0.99;
    if (isCap) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  }
  return g;
}

/** 旋转体：pts = [[r,y],...] 自下而上 */
export function latheGeo(pts, seg = 16) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg);
  return g;
}

/** 平面多边形（XZ 平面，y 高度），朝上。poly=[[x,z],...]，UV=(x,z) 米 */
export function polyTopGeo(poly, y = 0, down = false) {
  const contour = poly.map(([x, z]) => new THREE.Vector2(x, z));
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const pos = [], uv = [], nor = [];
  for (const t of tris) {
    const order = down ? [t[0], t[1], t[2]] : [t[0], t[2], t[1]];
    for (const i of order) { pos.push(contour[i].x, y, contour[i].y); uv.push(contour[i].x, contour[i].y); nor.push(0, down ? -1 : 1, 0); }
  }
  return fromArrays(pos, uv, nor);
}

/** 多边形棱柱：poly=[[x,z]...] 从 y0 到 y1，含顶面（可选底面）。侧面 UV u=沿周长米 v=高度米 */
export function prismGeo(poly, y0, y1, { top = true, bottom = false } = {}) {
  const P = poly.slice();
  const contour = P.map(([x, z]) => new THREE.Vector2(x, z));
  // 统一为逆时针（在 x-z 平面上，从 +Y 往下看）
  if (THREE.ShapeUtils.isClockWise(contour)) P.reverse();
  const pos = [], uv = [], nor = [];
  let acc = 0;
  for (let i = 0; i < P.length; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length];
    const L = Math.hypot(x2 - x1, z2 - z1);
    if (L < 1e-6) continue;
    // 外法线：多边形在 (x,z) 中逆时针 => 外法线 = (dz, -dx)
    const nx = (z2 - z1) / L, nz = -(x2 - x1) / L;
    const quad = [[x1, y0, z1, acc, y0], [x2, y0, z2, acc + L, y0], [x2, y1, z2, acc + L, y1], [x1, y1, z1, acc, y1]];
    for (const k of [0, 2, 1, 0, 3, 2]) { const q = quad[k]; pos.push(q[0], q[1], q[2]); uv.push(q[3], q[4]); nor.push(nx, 0, nz); }
    acc += L;
  }
  const geos = [fromArrays(pos, uv, nor)];
  if (top) geos.push(polyTopGeo(P, y1));
  if (bottom) geos.push(polyTopGeo(P, y0, true));
  return merge(geos);
}

/** 合并若干几何体（统一为非索引，保留 position/normal/uv） */
export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => {
    let h = g.index ? g.toNonIndexed() : g;
    if (!h.attributes.normal) h.computeVertexNormals();
    if (!h.attributes.uv) h.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    return h;
  });
  const total = list.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/**
 * 截面扫掠：profile=[[px,py],...]（截面坐标：px 横向，py 竖直向上），path=[[x,y,z],...]
 * 截面平面垂直于路径切线；横向轴 = up × tangent。UV：u=沿路径米，v=沿截面米
 * opts.closed 路径闭合；opts.caps 封端；opts.flat 截面保持竖直（用于屋脊/墙帽，横向轴取水平）
 */
export function sweep(profile, path, opts = {}) {
  const { closed = false, caps = true, flat = true, closeProfile = true } = opts;
  const pts = path.map((p) => new V3(p[0], p[1], p[2]));
  const n = pts.length;
  if (n < 2) return null;
  const frames = [];
  const up = new V3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    let t;
    if (closed) t = new V3().subVectors(pts[(i + 1) % n], pts[(i - 1 + n) % n]);
    else if (i === 0) t = new V3().subVectors(pts[1], pts[0]);
    else if (i === n - 1) t = new V3().subVectors(pts[n - 1], pts[n - 2]);
    else {
      const a = new V3().subVectors(pts[i], pts[i - 1]).normalize();
      const b = new V3().subVectors(pts[i + 1], pts[i]).normalize();
      t = a.add(b);
    }
    t.normalize();
    let side, vert;
    if (flat) {
      const th = new V3(t.x, 0, t.z);
      if (th.lengthSq() < 1e-8) th.set(1, 0, 0);
      th.normalize();
      side = new V3(th.z, 0, -th.x); // 水平横向
      vert = up.clone();
      // 拐角处横向需拉长以保持截面宽度（斜接）
      if (!(i === 0 || i === n - 1) || closed) {
        const prev = closed ? pts[(i - 1 + n) % n] : pts[i - 1];
        const next = closed ? pts[(i + 1) % n] : pts[i + 1];
        const a = new V3(pts[i].x - prev.x, 0, pts[i].z - prev.z).normalize();
        const b = new V3(next.x - pts[i].x, 0, next.z - pts[i].z).normalize();
        const cosHalf = Math.sqrt(Math.max(0.05, (1 + a.dot(b)) / 2));
        side.multiplyScalar(1 / cosHalf);
      }
    } else {
      side = new V3().crossVectors(up, t);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize();
      vert = new V3().crossVectors(t, side).normalize();
    }
    frames.push({ side, vert });
  }
  const m = profile.length;
  const ring = closeProfile ? m + 1 : m;
  // 截面累计长度
  const plen = [0];
  for (let j = 1; j < ring; j++) { const a = profile[(j - 1) % m], b = profile[j % m]; plen.push(plen[j - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const grid = [], uvg = [];
  let acc = 0;
  const N = closed ? n + 1 : n;
  for (let i = 0; i < N; i++) {
    const ii = i % n;
    if (i > 0) acc += pts[ii].distanceTo(pts[(i - 1) % n]);
    const { side, vert } = frames[ii];
    const row = [], urow = [];
    for (let j = 0; j < ring; j++) {
      const [px, py] = profile[j % m];
      const p = pts[ii];
      row.push([p.x + side.x * px + vert.x * py, p.y + side.y * px + vert.y * py, p.z + side.z * px + vert.z * py]);
      urow.push([acc, plen[j]]);
    }
    grid.push(row); uvg.push(urow);
  }
  const geos = [gridSurface(grid, uvg, true)];
  if (caps && !closed) {
    for (const [i, flip] of [[0, true], [n - 1, false]]) {
      const { side, vert } = frames[i];
      const p = pts[i];
      const contour = profile.map(([px, py]) => new THREE.Vector2(px, py));
      const cw = THREE.ShapeUtils.isClockWise(contour);
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const pos = [], uv = [];
      for (const tr of tris) {
        let o = [tr[0], tr[1], tr[2]];
        if (cw !== flip) o = [tr[0], tr[2], tr[1]];
        for (const k of o) {
          const [px, py] = profile[k];
          pos.push(p.x + side.x * px + vert.x * py, p.y + side.y * px + vert.y * py, p.z + side.z * px + vert.z * py);
          uv.push(px, py);
        }
      }
      geos.push(fromArrays(pos, uv));
    }
  }
  return merge(geos);
}

/** 沿折线按间距取点（返回 {p:[x,y,z], t:切线[x,y,z]}），用于布置栏杆望柱、瓦当、走兽等 */
export function samplePolyline(path, spacing, { includeEnds = true, offset = 0 } = {}) {
  const pts = path.map((p) => new V3(p[0], p[1] || 0, p[2] ?? p[1]));
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const L = pts[i].distanceTo(pts[i + 1]); segs.push(L); total += L; }
  const out = [];
  const count = Math.max(1, Math.round((total - 2 * offset) / spacing));
  const step = (total - 2 * offset) / count;
  for (let k = includeEnds ? 0 : 1; k <= (includeEnds ? count : count - 1); k++) {
    let d = offset + k * step, i = 0;
    while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
    const t = segs[i] > 0 ? Math.min(1, d / segs[i]) : 0;
    const p = new V3().lerpVectors(pts[i], pts[i + 1], t);
    const tan = new V3().subVectors(pts[i + 1], pts[i]).normalize();
    out.push({ p: [p.x, p.y, p.z], t: [tan.x, tan.y, tan.z] });
  }
  return out;
}

/** 平面多边形向内/外偏移（简单斜接，适合凸多边形与正交多边形）。d>0 向外 */
export function offsetPoly(poly, d) {
  const P = poly.slice();
  const ccw = !THREE.ShapeUtils.isClockWise(P.map(([x, z]) => new THREE.Vector2(x, z)));
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    // 逆时针时外法线 = (dz, -dx)
    const s = ccw ? 1 : -1;
    const n1 = [s * e1[1] / l1, -s * e1[0] / l1], n2 = [s * e2[1] / l2, -s * e2[0] / l2];
    const bis = [n1[0] + n2[0], n1[1] + n2[1]];
    const bl = Math.hypot(...bis) || 1;
    const cosH = (n1[0] * bis[0] + n1[1] * bis[1]) / bl;
    const k = d / Math.max(0.2, cosH);
    out.push([b[0] + (bis[0] / bl) * k, b[1] + (bis[1] / bl) * k]);
  }
  return out;
}

/** 给几何体按顶点设置统一颜色属性（用于顶点色材质） */
export function paint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** 合并带颜色的几何体（保留 color 属性；缺失则补白色） */
export function mergeColored(geos) {
  const list = geos.filter(Boolean).map((g) => {
    let h = g.index ? g.toNonIndexed() : g;
    if (!h.attributes.normal) h.computeVertexNormals();
    if (!h.attributes.uv) h.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    if (!h.attributes.color) paint(h, 0xffffff);
    return h;
  });
  const out = merge(list);
  const total = out.attributes.position.count;
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of list) { col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (t) => t * t * (3 - 2 * t);
