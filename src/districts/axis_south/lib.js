// 外朝中轴分区（axis_south）通用工具：台基+殿身组合、门殿板门、坡道、铺地、宫墙等
import * as THREE from 'three';
import { buildHall, buildTower } from '../../core/building.js';
import { buildPlatform, buildStairs } from '../../core/platform.js';
import { buildBay } from '../../core/openings.js';
import { buildPalaceWall } from '../../core/walls.js';
import { prismGeo, fromArrays, clamp } from '../../core/geom.js';
import { Ctx } from '../../core/batcher.js';

/** 三台三层台面高（总高 8.13m） */
export const T1 = 2.71, T2 = 5.42, T3 = 8.13;
/** 朝向 */
export const FS = 0, FN = Math.PI, FE = Math.PI / 2, FW = -Math.PI / 2;

/** 世界坐标 → 以 (x0,z0,rotY) 为原点的局部坐标 */
export function toLocal(x, z, x0, z0, rotY) {
  const dx = x - x0, dz = z - z0, c = Math.cos(rotY), s = Math.sin(rotY);
  return [dx * c - dz * s, dx * s + dz * c];
}

/**
 * 台基 + 殿身（或楼阁）。殿身中心 (x,z)，基面 y，朝向 rotY。
 * pf：buildPlatform 参数；pf.cx/pf.cz 给出时台基按世界轴向布置（中心为世界坐标，w 沿 x、d 沿 z，stairs.at 为台基局部坐标），
 *     否则台基与殿身同心同向（w/d/stairs 均为殿身局部坐标；可用 dx/dz 偏移）。
 * 其余字段为 buildHall/buildTower 的 spec（platform 强制 false）。返回 { info, c(殿身坐标系 ctx), top(世界屋脊高) }
 */
export function hallOn(ctx, { x, y = 0, z, rotY = 0, pf, tower, ...spec }) {
  let ph = 0;
  if (pf) {
    const { cx, cz, dx = 0, dz = 0, ...po } = pf;
    if (cx !== undefined) buildPlatform(ctx.at(cx, y, cz), { style: 'xumizuo', ...po });
    else buildPlatform(ctx.at(x, y, z, rotY).at(dx, 0, dz), { style: 'xumizuo', ...po });
    ph = pf.h;
  }
  const c = purlinFix(ctx.at(x, y + ph, z, rotY));
  const info = (tower ? buildTower : buildHall)(c, { ...spec, platform: false });
  return { info, c, top: y + ph + (info.topY || 0), base: y + ph };
}

/**
 * 规避 core/building.js 小式檐檩的平移错误（cylGeo 绕 Z 转 90° 后 translate(-L/2) 应为 +L/2，檩条整体偏出一个檐长）。
 * 包装 ctx：凡 'beam_*' 材质的圆柱几何若整体落在 x<0 一侧，则沿局部 x 平移 +L 复位；核心修正后自动失效（不再平移）。
 */
class FixCtx extends Ctx {
  at(...a) { const c = super.at(...a); return new FixCtx(c.batcher, c.m); }
  mul(m) { const c = super.mul(m); return new FixCtx(c.batcher, c.m); }
  rot(...a) { const c = super.rot(...a); return new FixCtx(c.batcher, c.m); }
  add(mat, geo, local) {
    if (geo && geo.type === 'CylinderGeometry' && /^beam_/.test(mat) && geo.parameters) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const L = geo.parameters.height, bb = geo.boundingBox;
      if (bb.max.x < -0.25 * L) {
        const t = new THREE.Matrix4().makeTranslation(L, 0, 0);
        return super.add(mat, geo, local ? local.clone().multiply(t) : t);
      }
    }
    return super.add(mat, geo, local);
  }
}
export const purlinFix = (c) => new FixCtx(c.batcher, c.m);

/** 门殿中柱缝上的板门（限定门口净宽 openW）。c 为殿身坐标系，info 为 buildHall 返回值，idx 为开间序号 */
export function gateDoors(c, info, idx, { openW = 3.6, studs = 9 } = {}) {
  const s = info.spec, D = s.colDia, beamH = clamp(D * 0.95, 0.2, 1.0);
  const h = s.colH - beamH * (s.dougong ? 2.1 : 1.6);
  const z = info.colsZ[Math.floor(info.colsZ.length / 2)];
  for (const i of idx) {
    const w = info.colsX[i + 1] - info.colsX[i] - D * 0.9;
    buildBay(c.at((info.colsX[i] + info.colsX[i + 1]) / 2, 0, z), { type: 'gate', w, h, openW: Math.min(openW, w - 0.6), studs, colD: D });
  }
}

/** 轴向矩形多边形 */
export const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
/** 以中心与尺寸给出的矩形 */
export const rectC = (cx, cz, w, d) => rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);

/** 铺地石板（略高于地面的薄棱柱） */
export function slab(ctx, poly, y0 = 0, y1 = 0.06, mat = 'paving_imperial') {
  ctx.add(mat, prismGeo(poly, y0, y1));
}

/** 宫墙（红墙黄琉璃瓦帽） */
export function palaceWall(ctx, path, { y0 = 0, h = 6, thick = 1.2, cap = 'yellow', base = 'brick', ...rest } = {}) {
  return buildPalaceWall(ctx, { path, y0, h, thick, cap, base, ...rest });
}

/**
 * 礓碴坡道（斜面石坡，带横向防滑棱）。局部：坡道中线 x=0，自 z=0（台边，高 h）向 +Z 下行至 z=run（地面 0）。
 */
export function ramp(ctx, { w, h, run, mat = 'stone_grey', side = 'stone_grey' }) {
  const hw = w / 2, pos = [], uv = [], nor = [];
  const L = Math.hypot(run, h), ny = run / L, nz = h / L;
  const quad = (a, b, c, d, n, uvq) => {
    for (const [p, t] of [[a, uvq[0]], [b, uvq[1]], [c, uvq[2]], [a, uvq[0]], [c, uvq[2]], [d, uvq[3]]]) { pos.push(...p); uv.push(...t); nor.push(...n); }
  };
  quad([-hw, h, 0], [-hw, 0, run], [hw, 0, run], [hw, h, 0], [0, ny, nz], [[-hw, 0], [-hw, L], [hw, L], [hw, 0]]);
  ctx.add(mat, fromArrays(pos, uv, nor));
  // 两侧三角墙
  const sp = [], su = [], sn = [];
  for (const sx of [-1, 1]) {
    const x = sx * hw;
    const tri = sx > 0 ? [[x, 0, 0], [x, h, 0], [x, 0, run]] : [[x, 0, 0], [x, 0, run], [x, h, 0]];
    for (const p of tri) { sp.push(...p); su.push(p[2], p[1]); sn.push(sx, 0, 0); }
  }
  ctx.add(side, fromArrays(sp, su, sn));
  // 防滑横棱（礓碴）
  const n = Math.max(2, Math.floor(L / 0.35));
  const g = [];
  for (let i = 1; i < n; i++) {
    const t = i / n, zz = run * t, yy = h * (1 - t);
    const b = new THREE.BoxGeometry(w - 0.1, 0.035, 0.06);
    b.translate(0, yy + 0.012, zz);
    g.push(b);
  }
  if (g.length) for (const b of g) ctx.add(mat, b);
}

/** 简易台阶（不带栏杆），供小建筑使用；局部同 buildStairs */
export function steps(ctx, opts) { return buildStairs(ctx, { style: 'stone', ...opts }); }

/** 沿 X 轴镜像一组 [x,z] 点（中轴 ax） */
export const mirrorX = (pts, ax = 0) => pts.map(([x, z]) => [2 * ax - x, z]).reverse();
