// 东路南部分区（east_outer）通用工具：朝向/规格生成、平面几何、绿地与树木布置、河岸石栏、琉璃剪边
import { buildingById, SITE } from '../../site/auto.js';
import { Ctx } from '../../core/batcher.js';
import { buildHall } from '../../core/building.js';
import { roofDefaults } from '../../core/roof.js';
import { gridSurface, clamp, prismGeo } from '../../core/geom.js';
import { buildRailing } from '../../core/platform.js';

export const FACE = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
export const B = (id) => buildingById.get(id);

// ---------------- 小式檐檩修正 ----------------
// core/building.js 无斗拱分支的檐檩：cylGeo 沿 y∈[0,L]，rotateZ 后 x∈[-L,0]，再 translate(-L/2) → 整体偏移一个构件长。
// 本分区经代理批处理器把这类几何平移回位（核心修正后 x∈[-L/2,L/2]，不再匹配，自动失效）。
const PROXY = new WeakMap();
function fixPurlin(g) {
  const pa = g && g.attributes && g.attributes.position;
  if (!pa || pa.count !== 64) return g;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox, L = bb.max.x - bb.min.x;
  if (L > 1 && bb.max.x < 0 && Math.abs(bb.min.x - 3 * bb.max.x) < 0.02 * L && bb.max.y - bb.min.y < 1.2 && bb.max.z - bb.min.z < 1.2) {
    const h = g.clone(); h.translate(L, 0, 0); return h;
  }
  return g;
}
export function safeCtx(ctx) {
  const real = ctx.batcher;
  if (real.__eoProxy) return ctx;
  let pb = PROXY.get(real);
  if (!pb) {
    pb = { __eoProxy: true, addGeometry: (k, g, m) => real.addGeometry(k, k === 'beam_xuanzi' ? fixPurlin(g) : g, m), addInstance: (k, m) => real.addInstance(k, m) };
    PROXY.set(real, pb);
  }
  return new Ctx(pb, ctx.m.clone());
}

/** 一组完整 spec（世界坐标 x,z,rotY）→ 函数式覆盖（经 safeCtx 建造，带标签） */
export function hallsFn(items, extra = {}) {
  return (ctx, b, api) => {
    const c = safeCtx(ctx);
    let top = 0;
    for (const it of items) {
      const y0 = it.y0 ?? 0;
      const info = buildHall(c.at(it.x, y0, it.z, it.rotY ?? 0), it);
      top = Math.max(top, (info.topY || 8) + y0);
    }
    if (b.tags.name && !extra.noLabel) api.label(b.tags.name, b.obb.cx, top + 2, b.obb.cz, extra.desc || '');
  };
}
/** 在自动推断结果上打补丁（函数式，经 safeCtx） */
export function patchFn(patch) {
  return (ctx, b, api) => {
    const c = safeCtx(ctx);
    for (const it of api.autoItems(b)) {
      if (it.type !== 'hall') continue;
      const s = api.mergeSpec(it.spec, patch);
      buildHall(c.at(it.x, s.y0 ?? 0, it.z, it.rotY), s);
    }
  };
}

/**
 * 由 OSM 外接矩形生成单体覆盖：face 朝向 S/N/E/W，eaveW/eaveD 按朝向取轮廓尺寸。extra: {desc, noLabel}
 */
export function H(id, face, spec = {}, extra = {}) {
  const o = B(id).obb, ns = face === 'S' || face === 'N';
  const item = { x: o.cx, z: o.cz, rotY: FACE[face], eaveW: ns ? o.sx : o.sz, eaveD: ns ? o.sz : o.sx, ...spec };
  return hallsFn([item], extra);
}

/** 墙线穿过建筑（外扩 margin）处的缺口：用于“以房后檐墙代院墙”的情形 */
export function gapsUnderBuildings(wallId, margin = 0.45) {
  const w = SITE.walls.find((q) => q.id === wallId);
  if (!w) return [];
  const P = w.pts, bl = SITE.buildings.map((b) => bbox(b.poly)).filter((bb) => bb[1] > Math.min(...P.map((p) => p[0])) - 20 && bb[0] < Math.max(...P.map((p) => p[0])) + 20);
  const inside = (x, z) => bl.some((bb) => x > bb[0] - margin && x < bb[1] + margin && z > bb[2] - margin && z < bb[3] + margin);
  const gaps = [];
  let acc = 0, open = null;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b2 = P[i + 1], L = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
    for (let t = 0; t < L; t += 0.2) {
      const x = a[0] + ((b2[0] - a[0]) * t) / L, z = a[1] + ((b2[1] - a[1]) * t) / L, s = acc + t;
      if (inside(x, z)) { if (open === null) open = s; } else if (open !== null) { if (s - open > 1) gaps.push({ from: open, to: s }); open = null; }
    }
    acc += L;
  }
  if (open !== null && acc - open > 1) gaps.push({ from: open, to: acc });
  return gaps;
}

/** 硬山小房（服务用房/厢房）：tile 瓦色，grade 默认 5 */
export function house(id, face, tile = 'yellow', spec = {}, extra = {}) {
  const gw = tile === 'grey' ? 'brick_grey' : 'wall_red';
  const roof = { type: 'yingshan', gableWallMat: gw, ...(spec.roof || {}) };
  return H(id, face, { grade: 5, tile, ...spec, roof }, extra);
}

// ---------------- 平面几何 ----------------
export function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function distSeg(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / L2, 0, 1);
  return Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz);
}
export function distPoly(px, pz, P, closed = true) {
  let d = Infinity;
  const n = closed ? P.length : P.length - 1;
  for (let i = 0; i < n; i++) d = Math.min(d, distSeg(px, pz, P[i], P[(i + 1) % P.length]));
  return d;
}
function segDist(a, b, c, d) {
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
  return Math.min(distSeg(a[0], a[1], c, d), distSeg(b[0], b[1], c, d), distSeg(c[0], c[1], a, b), distSeg(d[0], d[1], a, b));
}
export const bbox = (P) => {
  const xs = P.map((p) => p[0]), zs = P.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
};
export const areaOf = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

/** 多边形与半平面 x≥x0 求交（Sutherland–Hodgman，单条裁剪边对凹多边形亦可用） */
export function clipX(P, x0, keepGreater = true) {
  const inside = (p) => (keepGreater ? p[0] >= x0 : p[0] <= x0);
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (x0 - a[0]) / (b[0] - a[0]); out.push([x0, a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}

/** 石板甬路（略高于地面的条带）：pts 折线，w 宽，y 顶高 */
export function paveStrip(ctx, pts, w, y = 0.06, mat = 'paving_imperial') {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
    const nx = -(bz - az) / L * w / 2, nz = (bx - ax) / L * w / 2;
    // 端部各延伸半宽，折点处搭接
    const ex = (bx - ax) / L * (i < pts.length - 2 ? w / 2 : 0), ez = (bz - az) / L * (i < pts.length - 2 ? w / 2 : 0);
    ctx.add(mat, prismGeo([[ax + nx, az + nz], [bx + ex + nx, bz + ez + nz], [bx + ex - nx, bz + ez - nz], [ax - nx, az - nz]], 0, y));
  }
}

// ---------------- 障碍（树木避让） ----------------
let OBST = null;
function obstacles() {
  if (OBST) return OBST;
  const bl = SITE.buildings.filter((b) => b.c[0] > 100 && b.c[1] > -80).map((b) => ({ P: b.poly, bb: bbox(b.poly) }));
  const wa = SITE.water.filter((w) => w.id !== 4845030).map((w) => ({ P: w.poly, bb: bbox(w.poly) }));
  const wl = SITE.walls.filter((w) => !w.poly).map((w) => ({ P: w.pts, bb: bbox(w.pts) }));
  const br = SITE.bridges.map((b) => ({ P: b.poly, bb: bbox(b.poly) }));
  const pa = SITE.paths.filter((p) => /footway|service|steps|pedestrian/.test(p.tags.highway || '') && !p.tags.layer).map((p) => ({ P: p.pts, bb: bbox(p.pts) }));
  OBST = { bl, wa, wl, br, pa };
  return OBST;
}
const near = (o, x, z, m) => x > o.bb[0] - m && x < o.bb[1] + m && z > o.bb[2] - m && z < o.bb[3] + m;
/** (x,z) 是否远离建筑、水面、墙、桥、道路（各自留距） */
export function clearAt(x, z, { b = 3.2, w = 2.6, wall = 2.2, path = 1.8, extra = [] } = {}) {
  const O = obstacles();
  for (const o of O.bl) if (near(o, x, z, b) && (pip(x, z, o.P) || distPoly(x, z, o.P) < b)) return false;
  for (const o of O.wa) if (near(o, x, z, w) && (pip(x, z, o.P) || distPoly(x, z, o.P) < w)) return false;
  for (const o of O.br) if (near(o, x, z, w) && (pip(x, z, o.P) || distPoly(x, z, o.P) < w)) return false;
  for (const o of O.wl) if (near(o, x, z, wall) && distPoly(x, z, o.P, false) < wall) return false;
  for (const o of O.pa) if (near(o, x, z, path) && distPoly(x, z, o.P, false) < path) return false;
  for (const r of extra) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) return false;
  return true;
}

/** 伪随机 */
export function rand(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }

/** 多边形内抖动网格取点 */
export function scatter(P, spacing, seed, accept = () => true) {
  const [x0, x1, z0, z1] = bbox(P), R = rand(seed), out = [];
  for (let x = x0 + spacing * 0.5; x < x1; x += spacing) for (let z = z0 + spacing * 0.5; z < z1; z += spacing) {
    const px = x + (R() - 0.5) * spacing * 0.7, pz = z + (R() - 0.5) * spacing * 0.7;
    if (pip(px, pz, P) && accept(px, pz)) out.push([px, pz, R()]);
  }
  return out;
}

/** 沿折线等距取点 */
export function along(pts, spacing, offset = 0) {
  const out = [];
  let next = offset, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= acc + L + 1e-6) { const t = (next - acc) / (L || 1); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); next += spacing; }
    acc += L;
  }
  return out;
}

/** 种树：kind 树种，h 高度（随机 ±18%） */
export function tree(ctx, kind, x, z, h, r, y = 0) {
  const v = Math.floor(r * 4) % 4;
  const s = h * (0.86 + 0.32 * ((r * 7.13) % 1));
  const wv = 0.9 + 0.25 * ((r * 3.7) % 1);
  ctx.place(`tree:${kind}:${v}`, x, y, z, r * 6.283, [s * wv, s, s * wv]);
}

// ---------------- 河岸石栏 ----------------
/**
 * 沿水面多边形两岸布置石栏：在水道中线穿越处（河道端口）与桥位处断开。
 * opts: off 栏杆距岸线外偏（米）, minX 只保留 x≥minX 的岸段, style, height
 */
export function riverRailings(ctx, poly, opts = {}) {
  const { off = 0.45, minX = -Infinity, style = 'marble', height = 1.05, skipNear = [] } = opts;
  const lines = SITE.waterways.filter((w) => !w.tags.tunnel).map((w) => w.pts);
  const bridges = SITE.bridges.map((b) => b.poly);
  const n = poly.length;
  const ccw = areaOf(poly) > 0; // x-z 平面（z 向南）中按数学正向
  const keep = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let ok = L > 0.05 && Math.min(a[0], b[0]) >= minX;
    // 河道端口：中线与该边相交/相切
    if (ok) for (const P of lines) { for (let k = 0; k < P.length - 1 && ok; k++) if (segDist(a, b, P[k], P[k + 1]) < 0.35) ok = false; if (!ok) break; }
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (ok) for (const P of bridges) if (pip(mx, mz, P) || distPoly(mx, mz, P) < 1.6 || distPoly(a[0], a[1], P) < 1.0 || distPoly(b[0], b[1], P) < 1.0) { ok = false; break; }
    if (ok) for (const [x, z, r] of skipNear) if (Math.hypot(mx - x, mz - z) < r) { ok = false; break; }
    keep.push(ok);
  }
  // 连续保留段 → 折线（自岸线外偏 off）
  const runs = [];
  let start = keep.indexOf(false);
  if (start < 0) start = 0;
  let cur = null;
  for (let s = 1; s <= n; s++) {
    const i = (start + s) % n;
    if (keep[i]) { if (!cur) cur = [i]; cur.push((i + 1) % n); }
    else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  const sgn = ccw ? 1 : -1;
  let total = 0;
  for (const idx of runs) {
    const pts = idx.map((k) => poly[k]);
    if (pts.length < 2) continue;
    // 外偏（远离水面）：数学正向多边形外法线为 (dz, -dx)；此处 z 向南，正向 = 顺时针视觉，但公式一致
    const P2 = pts.map((p, j) => {
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      return [p[0] + sgn * dz * off, p[1] - sgn * dx * off];
    });
    // 去掉过短的段
    let len = 0; for (let j = 1; j < P2.length; j++) len += Math.hypot(P2[j][0] - P2[j - 1][0], P2[j][1] - P2[j - 1][1]);
    if (len < 2.5) continue;
    total += len;
    buildRailing(ctx, { path: P2, y: 0, style, height, ends: 'drum', postSpacing: 1.7 });
  }
  return total;
}

// ---------------- 琉璃剪边 ----------------
const SQ = Math.SQRT1_2;
/**
 * 屋面剪边：在屋面外缘 bw 宽的带上覆一层异色琉璃瓦（如文渊阁黑琉璃瓦绿剪边）。
 * R 须与传给 buildRoof 的参数一致（type 'xieshan'|'wudian'|'skirt'，w,d,y,rise 必填，lift/flare/liftLen/curve/gableInset/inner 可选）。
 */
export function jianbian(ctx, R0, bw = 0.9, tile = 'green') {
  const S = roofDefaults(R0);
  const hw = S.w / 2, hd = S.d / 2, k = S.curve ?? 0.55;
  const G = (s) => (1 - k) * s + k * s * s;
  let runF = hd, runE = hd, radius;
  if (S.type === 'xieshan') {
    const inset = clamp(S.gableInset ?? (0.3 * hd + 0.35 * S.overhang), 0.4, Math.min(hd * 0.8, hw * 0.45));
    radius = Math.min(S.liftLen, inset * 1.6, hd * 0.95);
  } else if (S.type === 'wudian') {
    const rh = clamp(S.ridgeHalf ?? (hw - hd + 0.08 * S.w), 0.3, hw - 0.3);
    runE = hw - rh; radius = Math.min(S.liftLen, hd * 0.95, hw * 0.95);
  } else {
    const iw = S.inner.w / 2, id = S.inner.d / 2;
    runF = hd - id; runE = hw - iw; radius = Math.min(S.liftLen, (hd - id) * 1.2, hd * 0.9);
  }
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => ({ x: sx * hw, z: sz * hd, dx: sx * SQ, dz: sz * SQ }));
  const disp = (x, z) => {
    let best = 0, bc = null;
    for (const c of corners) { const w = 1 - Math.hypot(x - c.x, z - c.z) / radius; if (w > best) { best = w; bc = c; } }
    if (!bc) return [0, 0, 0];
    const w = best ** 2.2;
    return [bc.dx * S.flare * w, S.lift * w, bc.dz * S.flare * w];
  };
  const lift = 0.045;
  const surf = (px, pz) => {
    const s = Math.max(0, Math.min((hd - Math.abs(pz)) / runF, (hw - Math.abs(px)) / runE));
    const [dx, dy, dz] = disp(px, pz);
    return [px + dx, S.y + S.rise * G(s) + dy + lift, pz + dz];
  };
  const s0 = bw / runF;
  const iw = hw - s0 * runE, id = hd - s0 * runF;
  const sides = [
    [[-hw, hd], [hw, hd], [-iw, id], [iw, id]],
    [[hw, -hd], [-hw, -hd], [iw, -id], [-iw, -id]],
    [[hw, hd], [hw, -hd], [iw, id], [iw, -id]],
    [[-hw, -hd], [-hw, hd], [-iw, -id], [-iw, id]],
  ];
  const geos = [];
  for (const [E0, E1, I0, I1] of sides) {
    const L = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
    const nu = clamp(Math.ceil(L / 0.8), 8, 80), nv = 3;
    const grid = [], uvg = [];
    for (let i = 0; i <= nu; i++) {
      let t = i / nu; t = 0.35 * t + 0.65 * (0.5 - 0.5 * Math.cos(Math.PI * t));
      const row = [], urow = [];
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        const bx = E0[0] + (E1[0] - E0[0]) * t, bz = E0[1] + (E1[1] - E0[1]) * t;
        const tx = I0[0] + (I1[0] - I0[0]) * t, tz = I0[1] + (I1[1] - I0[1]) * t;
        const px = bx + (tx - bx) * v, pz = bz + (tz - bz) * v;
        row.push(surf(px, pz));
        urow.push([t * L, v * Math.hypot(bw, S.rise * G(s0))]);
      }
      grid.push(row); uvg.push(urow);
    }
    let g = gridSurface(grid, uvg);
    if (g.attributes.normal.getY(Math.floor(g.attributes.normal.count / 2)) < 0) g = gridSurface(grid, uvg, true);
    geos.push(g);
  }
  for (const g of geos) ctx.add(`tile_${tile}`, g);
}
