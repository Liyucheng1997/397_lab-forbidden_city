// 西路南部分区：共用小工具（规格模板、几何、铺地、植树、石狮原型）
import * as THREE from 'three';
import { buildingById } from '../../site/auto.js';
import { Ctx } from '../../core/batcher.js';
import { buildHall } from '../../core/building.js';
import { boxGeo, prismGeo, sweep, fromArrays, merge } from '../../core/geom.js';
import { registerProtoFamily } from '../../core/protos.js';
import { defineMaterial } from '../../core/materials.js';

export const S = 0, N = Math.PI, E = Math.PI / 2, W = -Math.PI / 2;
export const Y = 'yellow', G = 'grey';

// 本分区自用材质
defineMaterial('wo_slate', { color: 0x585d62, roughness: 0.78, envMapIntensity: 0.6 });
defineMaterial('wo_glass', { color: 0x262d33, roughness: 0.22, metalness: 0.35, envMapIntensity: 1.1 });
defineMaterial('wo_trim', { color: 0xe9e4d8, roughness: 0.75 });
defineMaterial('wo_door', { color: 0x4a2a1c, roughness: 0.6 });
defineMaterial('wo_road', { color: 0xc9c4b8, map: 'paving_imperial', normalMap: 'paving_imperial_normal', roughness: 0.82, period: [3, 3] });

export const obbOf = (id) => buildingById.get(id).obb;

/**
 * 临时修正：core/building.js 小式（无斗拱）檐檩圆柱 rotateZ(π/2) 后 translate(-L/2) 使檩条整体偏出一个自身长度
 * （应为 +L/2）。本包装仅在几何恰好偏出一个自身长度时把它平移回中；core 修正后自动失效，不会重复平移。
 */
export class FixCtx extends Ctx {
  at(x, y, z, r, s) { const c = super.at(x, y, z, r, s); return new FixCtx(c.batcher, c.m); }
  mul(m4) { const c = super.mul(m4); return new FixCtx(c.batcher, c.m); }
  rot(a, b, d) { const c = super.rot(a, b, d); return new FixCtx(c.batcher, c.m); }
  add(mat, geo, local) {
    if (mat === 'beam_xuanzi' && geo && geo.attributes?.position) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox, L = bb.max.x - bb.min.x, cx = (bb.max.x + bb.min.x) / 2;
      if (L > 0.3 && bb.max.y - bb.min.y < 1.2 && Math.abs(cx + L) < 1e-3 * Math.max(1, L)) geo = geo.clone().translate(L, 0, 0);
    }
    super.add(mat, geo, local);
  }
}
export const fixCtx = (ctx) => (ctx instanceof FixCtx ? ctx : new FixCtx(ctx.batcher, ctx.m));

/** 数组覆盖 → 函数覆盖（经 FixCtx 建造；有名建筑自动加标签） */
export function hallsFn(arr) {
  return (ctx0, b, api) => {
    const ctx = fixCtx(ctx0);
    let top = 0;
    for (const it of arr) {
      const y0 = it.y0 ?? 0;
      const info = buildHall(ctx.at(it.x, y0, it.z, it.rotY ?? 0), it);
      top = Math.max(top, (info.topY || 8) + y0);
    }
    if (b.tags.name && !arr.noLabel) api.label(arr.name || b.tags.name, b.obb.cx, top + 2, b.obb.cz, arr.desc || '');
  };
}
/** 覆盖表中除 keep 以外的数组覆盖统一转为 hallsFn */
export function fixOverrides(ov, keep) {
  const out = {};
  for (const [k, v] of Object.entries(ov)) out[k] = Array.isArray(v) && !keep.has(+k) ? hallsFn(v) : v;
  return out;
}

/**
 * 小式房屋（值房、库房、连房、配房）规格：无斗拱，旋子/无彩画。
 * o: { tile, grade, roof:{...}, corridor, juan, rise, colH, ph(台基高), wall(墙材质) ... 其余透传 }
 */
export function fang(o = {}) {
  const { tile = Y, grade = 5, juan = false, rise, ph, roofType = 'yingshan', roof = {}, ...rest } = o;
  const grey = tile === G;
  return {
    kind: 'hall', grade, tile, dougong: false,
    caihua: grey ? 'none' : 'xuanzi',
    wallMat: grey ? 'brick_grey' : 'wall_red',
    platform: { h: ph ?? (grade >= 5 ? 0.4 : 0.6), style: 'plain' },
    roof: { type: roofType, juan, rise, gableWallMat: grey ? 'brick_grey' : 'wall_red', beasts: grey ? -1 : grade >= 5 ? 1 : 3, ...roof },
    ...rest,
  };
}

/** 以 OSM 外接矩形为屋檐轮廓的完整 spec（rotY 决定面阔方向） */
export function onObb(id, rotY, spec = {}) {
  const o = obbOf(id);
  return onRect([o.cx - o.sx / 2, o.cx + o.sx / 2, o.cz - o.sz / 2, o.cz + o.sz / 2], rotY, spec);
}
/** 以矩形 [x0,x1,z0,z1]（世界坐标）为屋檐轮廓 */
export function onRect([x0, x1, z0, z1], rotY, spec = {}) {
  const ew = Math.abs(Math.sin(rotY)) > 0.5;
  const sx = x1 - x0, sz = z1 - z0;
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rotY, eaveW: ew ? sz : sx, eaveD: ew ? sx : sz, ...spec };
}
/** 数组覆盖附带简介 */
export function withDesc(arr, desc, extra = {}) { return Object.assign(arr, { desc }, extra); }

/** 四坡（庑殿式直坡）屋顶：矩形 w×d 中心 (cx,cz)，檐口高 y0，坡顶高 rise，alongZ 时脊沿 Z */
export function hipRoof(ctx, mat, cx, cz, w, d, y0, rise, alongZ = false) {
  const L = alongZ ? d : w, D = alongZ ? w : d;
  const r = Math.max(0, L / 2 - D / 2);
  const P = (u, v, y) => (alongZ ? [cx + v, y, cz + u] : [cx + u, y, cz + v]);
  const e = [P(-L / 2, -D / 2, y0), P(L / 2, -D / 2, y0), P(L / 2, D / 2, y0), P(-L / 2, D / 2, y0)];
  const t = [P(-r, 0, y0 + rise), P(r, 0, y0 + rise)];
  const faces = [[e[3], e[2], t[1], t[0]], [e[1], e[0], t[0], t[1]], [e[2], e[1], t[1]], [e[0], e[3], t[0]]];
  const pos = [], uv = [], nor = [];
  for (const f of faces) {
    const a = new THREE.Vector3(...f[0]), b = new THREE.Vector3(...f[1]), c = new THREE.Vector3(...f[2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.y < 0) n.negate();
    const ax = new THREE.Vector3().subVectors(b, a).normalize();
    const ay = new THREE.Vector3().crossVectors(n, ax);
    const tri = f.length === 4 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 2]];
    for (const tr of tri) {
      const pts = tr.map((i) => new THREE.Vector3(...f[i]));
      const nn = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0]));
      const order = nn.y >= 0 ? [0, 1, 2] : [0, 2, 1];
      for (const k of order) {
        const p = pts[k];
        pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z);
        const q = new THREE.Vector3().subVectors(p, a);
        uv.push(q.dot(ax), q.dot(ay));
      }
    }
  }
  ctx.add(mat, fromArrays(pos, uv, nor));
}

/** 地面铺装带（甬路/石板路）：沿折线 [[x,z],...]，宽 w，顶高 h */
export function paveStrip(ctx, pts, w, h = 0.05, mat = 'wo_road', y0 = 0) {
  const path = pts.map(([x, z]) => [x, y0, z]);
  ctx.add(mat, sweep([[-w / 2, -0.02], [w / 2, -0.02], [w / 2, h], [-w / 2, h]], path, { flat: true }));
}

/** 矩形实体（世界坐标框） */
export function boxAt(ctx, mat, x0, x1, y0, y1, z0, z1) {
  ctx.add(mat, boxGeo(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
}

/** 带竖直侧面的棱柱（世界坐标多边形） */
export function prism(ctx, mat, poly, y0, y1, top = true) { ctx.add(mat, prismGeo(poly, y0, y1, { top })); }

// ---------------- 随机与布点 ----------------
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; s = Math.imul(s, 3266489909) >>> 0; return ((s ^ (s >>> 16)) >>> 0) / 4294967296; };
}
export function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/**
 * 区域内泊松式散点：poly 区域，spacing 最小间距，blocked(x,z) 排除函数，max 上限。返回 [[x,z],...]
 */
export function scatter(poly, spacing, seed, blocked, max = 999, existing = []) {
  const R = rng(seed);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const out = [];
  const all = [...existing];
  const tries = Math.ceil(((x1 - x0) * (z1 - z0)) / (spacing * spacing)) * 30;
  for (let i = 0; i < tries && out.length < max; i++) {
    const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
    if (!pip(x, z, poly) || blocked(x, z)) continue;
    if (all.some(([px, pz]) => Math.hypot(px - x, pz - z) < spacing)) continue;
    out.push([x, z]); all.push([x, z]);
  }
  return out;
}

// ---------------- 石狮（断虹桥望柱头）原型：高 1，底 y=0，面朝 +Z ----------------
function ell(x, y, z, rx, ry, rz, ws = 8, hs = 6) {
  return new THREE.SphereGeometry(1, ws, hs).scale(rx, ry, rz).translate(x, y, z);
}
registerProtoFamily('wo_slion', (key, [pose = '0']) => {
  const p = +pose;
  const g = [
    boxGeo(0.46, 0.1, 0.6).translate(0, 0.05, 0),
    ell(0, 0.33, -0.12, 0.19, 0.2, 0.23), // 后身蹲坐
    ell(0, 0.5, 0.05, 0.16, 0.24, 0.15), // 前胸
    ell(0, 0.74, 0.07, 0.21, 0.19, 0.17), // 鬃
    ell(0, 0.79, 0.19, 0.13, 0.12, 0.12), // 头
    ell(0, 0.74, 0.3, 0.07, 0.055, 0.05, 6, 4), // 吻
    new THREE.CylinderGeometry(0.048, 0.055, 0.38, 6).translate(0.09, 0.27, 0.15),
    new THREE.CylinderGeometry(0.048, 0.055, 0.38, 6).translate(-0.09, 0.27, 0.15),
  ];
  // 姿态变化：绣球 / 幼狮 / 回首
  if (p === 0) g.push(ell(0.13, 0.17, 0.24, 0.075, 0.075, 0.075, 7, 5));
  else if (p === 1) g.push(ell(-0.12, 0.2, 0.2, 0.07, 0.09, 0.1, 6, 5), ell(-0.12, 0.33, 0.25, 0.05, 0.05, 0.05, 6, 4));
  else g.push(ell(0.06, 0.95, 0.12, 0.06, 0.05, 0.06, 6, 4));
  return [{ mat: 'marble', geo: merge(g) }];
});
