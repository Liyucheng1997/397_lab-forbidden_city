// walls 分区公用：城墙尺寸常量、面片累加器、折线截面挤出、垛口墙/宇墙
import * as THREE from 'three';
import { fromArrays } from '../../core/geom.js';
import { defineMaterial } from '../../core/materials.js';
import { makeTexture } from '../../core/textures.js';
import { OUTER_WALL } from '../../config.js';

export const OW = { west: OUTER_WALL.west, east: OUTER_WALL.east, north: OUTER_WALL.north, south: OUTER_WALL.south };
export const WALL_H = 10, WALL_B = 8.62, WALL_T = 6.66;
/** 城墙每侧收分率（米/米） */
export const KB = (WALL_B - WALL_T) / 2 / WALL_H;
/** 顶面外沿、内沿距外皮的水平距离 */
export const D_OUT = KB * WALL_H, D_IN = WALL_B - KB * WALL_H;
export const DUO = { w: 1.5, cr: 0.5, h: 0.78, t: 0.62, cap: 0.1, low: 0.95 };
export const YU = { t: 0.55, h: 0.95 };
/** 城墙墙身材质：红灰抹面；垛口、宇墙同为红灰，砖帽为灰色城砖 */
export const WALL_MAT = 'wall_red';

/**
 * 贴地大面材质：带 polygonOffset，远距离下不与 world.js 的外围大地（y=-0.05）及地面网格深度冲突。
 * key, color, map（纹理名）, period（米）, normal（法线纹理名）
 */
export function groundMaterial(key, color, map, period = 8, normal = null) {
  let m = null;
  const rep = (name) => { const t = makeTexture(name); if (!t) return null; const c = t.clone(); c.repeat.set(1 / period, 1 / period); c.needsUpdate = true; return c; };
  defineMaterial(key, {
    get material() {
      if (m) return m;
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6 });
      if (map) m.map = rep(map);
      if (normal) m.normalMap = rep(normal);
      return m;
    },
  });
}
groundMaterial('walls_asphalt', 0x55575a, null);
groundMaterial('walls_hill', 0x6a8052, 'grass', 9, 'grass_normal');
defineMaterial('walls_curb', { color: 0xa9a59c, roughness: 0.8 });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** 平面着色面片累加器：按材质收集三角形，flush 时一次性加入 ctx */
export class Acc {
  constructor() { this.m = new Map(); }
  g(mat) { let o = this.m.get(mat); if (!o) this.m.set(mat, (o = { p: [], u: [], n: [] })); return o; }
  /** 四边形 P0..P3（逆时针为正面），U 为四角 UV；want 期望朝向（与法线反向时自动翻转） */
  quad(mat, P, U, want) {
    let n = unit(cross(sub(P[2], P[0]), sub(P[3], P[1])));
    let ord = [0, 1, 2, 0, 2, 3];
    if (want && dot(n, want) < 0) { ord = [0, 2, 1, 0, 3, 2]; n = [-n[0], -n[1], -n[2]]; }
    const o = this.g(mat);
    for (const k of ord) { o.p.push(P[k][0], P[k][1], P[k][2]); o.u.push(U[k][0], U[k][1]); o.n.push(n[0], n[1], n[2]); }
  }
  /** 平面多边形（三维点，按 want 定向；uv 二维） */
  poly(mat, P, U, want) {
    const ax = Math.abs(want[0]) >= Math.abs(want[1]) && Math.abs(want[0]) >= Math.abs(want[2]) ? 0 : Math.abs(want[1]) >= Math.abs(want[2]) ? 1 : 2;
    const [i, j] = ax === 0 ? [1, 2] : ax === 1 ? [0, 2] : [0, 1];
    const contour = P.map((p) => new THREE.Vector2(p[i], p[j]));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    const n = unit(want), o = this.g(mat);
    for (const t of tris) {
      let [a, b, c] = t;
      const nn = cross(sub(P[b], P[a]), sub(P[c], P[a]));
      if (dot(nn, n) < 0) [b, c] = [c, b];
      for (const k of [a, b, c]) { o.p.push(P[k][0], P[k][1], P[k][2]); o.u.push(U[k][0], U[k][1]); o.n.push(n[0], n[1], n[2]); }
    }
  }
  flush(ctx) {
    for (const [mat, o] of this.m) if (o.p.length) ctx.add(mat, fromArrays(o.p, o.u, o.n));
    this.m.clear();
  }
}

/** 折线标架：D 段方向，N 段法线 (dz,-dx)，M 顶点斜接向量（M·o 即偏移 o 处），U 顶点累计长 */
export function pathFrames(path, closed = false) {
  const n = path.length, sc = closed ? n : n - 1;
  const D = [], N = [], L = [];
  for (let i = 0; i < sc; i++) {
    const a = path[i], b = path[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1e-9;
    D.push([dx / l, dz / l]); N.push([dz / l, -dx / l]); L.push(l);
  }
  const M = [], U = [0];
  for (let i = 0; i < n; i++) {
    const n1 = closed ? N[(i - 1 + sc) % sc] : N[Math.max(0, i - 1)];
    const n2 = closed ? N[i % sc] : N[Math.min(sc - 1, i)];
    const s = Math.max(0.15, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    M.push([(n1[0] + n2[0]) / s, (n1[1] + n2[1]) / s]);
  }
  for (let i = 0; i < sc; i++) U.push(U[i] + L[i]);
  return { n, sc, D, N, M, L, U, P: path };
}

/**
 * 沿折线挤出截面。path=[[x,z,(y基)]...]；segs=[{p:[[o,y]...], mat, v:'y'|'o'}]，o 为沿 N=(dz,-dx) 的横向偏移。
 * 截面逆时针书写（+o 侧自下而上、顶自 +o 到 -o、-o 侧自上而下）。caps=[{poly:[[o,y]...], mat}] 开口两端封面。
 */
export function extrude(acc, path, segs, { closed = false, caps = null, y = 0 } = {}) {
  if (path.length < 2) return;
  const F = pathFrames(path, closed);
  const at = (i, o, yy) => { const p = F.P[i % F.n], m = F.M[i % F.n]; return [p[0] + m[0] * o, y + (p[2] || 0) + yy, p[1] + m[1] * o]; };
  for (let i = 0; i < F.sc; i++) {
    const N = F.N[i], u0 = F.U[i], u1 = u0 + F.L[i];
    for (const s of segs) for (let k = 0; k < s.p.length - 1; k++) {
      const [o0, y0] = s.p[k], [o1, y1] = s.p[k + 1];
      const want = [N[0] * (y1 - y0), -(o1 - o0), N[1] * (y1 - y0)];
      const v0 = s.v === 'o' ? o0 : y0, v1 = s.v === 'o' ? o1 : y1;
      acc.quad(s.mat, [at(i, o0, y0), at(i + 1, o0, y0), at(i + 1, o1, y1), at(i, o1, y1)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], want);
    }
  }
  if (!closed && caps) {
    for (const [i, sg] of [[0, -1], [F.n - 1, 1]]) {
      const d = F.D[i === 0 ? 0 : F.sc - 1];
      for (const c of caps) acc.poly(c.mat, c.poly.map(([o, yy]) => at(i, o, yy)), c.poly.map(([o, yy]) => [o, yy]), [d[0] * sg, 0, d[1] * sg]);
    }
  }
}

/** 宇墙（矮女墙 + 砖帽）：path 为墙中线，底 y（path 第三分量可给逐点底高） */
export function yuRun(acc, path, { y = 0, h = YU.h, t = YU.t, mat = WALL_MAT } = {}) {
  const a = t / 2, cop = [[a, h], [a + 0.04, h], [a + 0.04, h + 0.08], [0, h + 0.2], [-a - 0.04, h + 0.08], [-a - 0.04, h], [-a, h]];
  extrude(acc, path, [{ p: [[a, 0], [a, h]], mat }, { p: cop, mat: 'brick_grey' }, { p: [[-a, h], [-a, 0]], mat }], {
    y, caps: [{ poly: [[-a, 0], [a, 0], [a, h], [-a, h]], mat }, { poly: cop, mat: 'brick_grey' }],
  });
}

/** 实心垛（转角/端部）：沿 pts 挤出，底 y */
function solidMerlon(acc, pts, y, mat) {
  const t = DUO.t / 2, e = 0.025, yt = DUO.h, yc = yt + DUO.cap;
  const cop = [[t, yt], [t + e, yt], [t + e, yc], [-t - e, yc], [-t - e, yt], [-t, yt]];
  extrude(acc, pts, [{ p: [[t, 0], [t, yt]], mat }, { p: cop, mat: 'brick_grey' }, { p: [[-t, yt], [-t, 0]], mat }], {
    y, caps: [{ poly: [[-t, 0], [t, 0], [t, yt], [-t, yt]], mat }, { poly: [[-t - e, yt], [t + e, yt], [t + e, yc], [-t - e, yc]], mat: 'brick_grey' }],
  });
}

/**
 * 垛口墙：path 为垛口墙中线（开口折线），+o 侧（N=(dz,-dx)）为城外；底 y。
 * 下段垛口墙 + 垛（原型 wl_duo，带射眼）+ 转角/端部实心垛。
 */
export function duoRun(ctx, acc, path, { y = WALL_H, mat = WALL_MAT } = {}) {
  const t = DUO.t / 2, yt = y + DUO.low;
  extrude(acc, path, [{ p: [[t, 0], [t, DUO.low]], mat }, { p: [[t, DUO.low], [-t, DUO.low]], mat: 'brick_grey', v: 'o' }, { p: [[-t, DUO.low], [-t, 0]], mat }], {
    y, caps: [{ poly: [[-t, 0], [t, 0], [t, DUO.low], [-t, DUO.low]], mat }],
  });
  const F = pathFrames(path, false);
  const cc = 0.9, ce = 0.7;
  for (let i = 0; i < F.sc; i++) {
    const A = F.P[i], d = F.D[i], N = F.N[i], L = F.L[i];
    const ca = i > 0 ? cc : ce, cb = i < F.sc - 1 ? cc : ce;
    const avail = L - ca - cb;
    if (avail < DUO.w + 2 * DUO.cr) { if (L > 0.05) solidMerlon(acc, [A, F.P[i + 1]], yt, mat); continue; }
    const nM = Math.max(1, Math.round((avail - DUO.cr) / (DUO.w + DUO.cr)));
    const sx = avail / (nM * DUO.w + (nM + 1) * DUO.cr);
    const rot = Math.atan2(N[0], N[1]);
    for (let k = 0; k < nM; k++) {
      const s = ca + sx * (DUO.cr + k * (DUO.w + DUO.cr) + DUO.w / 2);
      ctx.place(`wl_duo:${mat}`, A[0] + d[0] * s, yt, A[1] + d[1] * s, rot, [sx, 1, 1]);
    }
  }
  for (let i = 1; i < F.n - 1; i++) {
    const q = F.P[i], dp = F.D[i - 1], dn = F.D[i];
    solidMerlon(acc, [[q[0] - dp[0] * cc, q[1] - dp[1] * cc], q, [q[0] + dn[0] * cc, q[1] + dn[1] * cc]], yt, mat);
  }
  const q0 = F.P[0], d0 = F.D[0], q1 = F.P[F.n - 1], d1 = F.D[F.sc - 1];
  solidMerlon(acc, [q0, [q0[0] + d0[0] * ce, q0[1] + d0[1] * ce]], yt, mat);
  solidMerlon(acc, [[q1[0] - d1[0] * ce, q1[1] - d1[1] * ce], q1], yt, mat);
}

/** 线段与轴对齐矩形的相交参数区间（Liang–Barsky），无交返回 null */
function clipSeg(a, b, r) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - r[0]], [dx, r[1] - a[0]], [-dz, a[1] - r[2]], [dz, r[3] - a[1]]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [t0, t1];
}

/** 折线按若干矩形 [x0,x1,z0,z1] 挖去，返回剩余的开口折线段（长度 < minLen 的丢弃） */
export function cutPath(path, rects, minLen = 1) {
  const out = [];
  let cur = [path[0]];
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const cuts = rects.map((r) => clipSeg(a, b, r)).filter(Boolean).sort((p, q) => p[0] - q[0]);
    let t = 0;
    for (const [c0, c1] of cuts) {
      if (c1 <= t) continue;
      if (c0 > t) cur.push(lerp2(a, b, c0));
      if (cur.length > 1) out.push(cur);
      cur = [lerp2(a, b, Math.max(t, c1))];
      t = Math.max(t, c1);
    }
    if (t < 1) cur.push(b);
  }
  if (cur.length > 1) out.push(cur);
  const len = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0), 0);
  return out.filter((p) => len(p) >= minLen);
}

/** 折线偏移（斜接）：+d 沿 N=(dz,-dx) */
export function offsetPath(path, d, closed = false) {
  const F = pathFrames(path, closed);
  return path.map((p, i) => [p[0] + F.M[i][0] * d, p[1] + F.M[i][1] * d]);
}

/** 两条平行偏移线之间的带状地面（UV = 世界 x,z 米），y 高；sides=true 时补外沿立面（路缘） */
export function ribbon(acc, path, o0, o1, y, mat, { curb = 0, curbMat = 'walls_curb' } = {}) {
  const A = offsetPath(path, o0), B = offsetPath(path, o1);
  for (let i = 0; i < path.length - 1; i++) {
    const P = [[A[i][0], y, A[i][1]], [A[i + 1][0], y, A[i + 1][1]], [B[i + 1][0], y, B[i + 1][1]], [B[i][0], y, B[i][1]]];
    acc.quad(mat, P, P.map((p) => [p[0], p[2]]), [0, 1, 0]);
    if (curb > 0) {
      for (const [E, sg] of [[A, o0 < o1 ? -1 : 1], [B, o0 < o1 ? 1 : -1]]) {
        const a = E[i], b = E[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        const n = [(dz / l) * sg, 0, (-dx / l) * sg];
        acc.quad(curbMat, [[a[0], y - curb, a[1]], [b[0], y - curb, b[1]], [b[0], y, b[1]], [a[0], y, a[1]]], [[0, y - curb], [l, y - curb], [l, y], [0, y]], n);
      }
    }
  }
}

/** 确定性伪随机 */
export function rand(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** 点是否在多边形内 */
export function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
