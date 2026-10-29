// axis_north 分区公用小工具：按世界坐标矩形建殿、栏杆、墙、墙门、铺地、斜坡体、自定义亭
import * as THREE from 'three';
import { buildHall, buildTower } from '../../core/building.js';
import { buildPlatform, buildRailing, buildStairs, buildXumizuo } from '../../core/platform.js';
import { buildPalaceWall, buildWallGate } from '../../core/walls.js';
import { buildRoof } from '../../core/roof.js';
import { boxGeo, cylGeo, prismGeo, polyTopGeo, fromArrays, clamp } from '../../core/geom.js';
import { defineMaterial } from '../../core/materials.js';
import { Ctx } from '../../core/batcher.js';
import { makePlaque, plaqueSize } from '../../core/plaque.js';

export const PI = Math.PI;
export const ROT = { S: 0, N: PI, E: PI / 2, W: -PI / 2 };
export const rectPoly = (x0, x1, z0, z1) => [[Math.min(x0, x1), Math.min(z0, z1)], [Math.max(x0, x1), Math.min(z0, z1)], [Math.max(x0, x1), Math.max(z0, z1)], [Math.min(x0, x1), Math.max(z0, z1)]];

// 鎏金铜（江山社稷金殿等小铜亭的“瓦面”与脊件）
defineMaterial('tile_gilt', { color: 0xc99a45, roughness: 0.32, metalness: 1.0, envMapIntensity: 1.3 });
defineMaterial('glaze_gilt', { color: 0xd8aa52, roughness: 0.28, metalness: 1.0, envMapIntensity: 1.4 });

/**
 * 临时修正（core/building.js 无斗拱建筑的“檐檩”圆柱平移了 -L，导致彩画檩条整根伸出山面）：
 * 包一层 Ctx，遇到 'beam_xuanzi' 的 CylinderGeometry 时补偿平移 +L。核心修复后可删除。
 */
class FixCtx extends Ctx {
  at(...a) { const c = super.at(...a); return new FixCtx(c.batcher, c.m); }
  mul(m) { const c = super.mul(m); return new FixCtx(c.batcher, c.m); }
  rot(...a) { const c = super.rot(...a); return new FixCtx(c.batcher, c.m); }
  add(mat, geo, local) {
    if (mat === 'beam_xuanzi' && geo && geo.type === 'CylinderGeometry' && !geo.userData.anFixed) {
      geo.translate(geo.parameters.height, 0, 0);
      geo.userData.anFixed = true;
    }
    super.add(mat, geo, local);
  }
}
export const fixCtx = (ctx) => (ctx instanceof FixCtx ? ctx : new FixCtx(ctx.batcher, ctx.m));
const buildHallFixed = (ctx, spec) => buildHall(fixCtx(ctx), spec);

/**
 * 按世界坐标外接矩形（屋檐外轮廓）[x0,x1,z0,z1] 与朝向 face('S'|'N'|'E'|'W') 建单体。
 * spec 同 buildHall（含 stories 时走 buildTower）。返回 info + { cx, cz, top(世界高) }
 */
export function rhall(ctx, [x0, x1, z0, z1], face, spec = {}, y0 = 0) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = Math.abs(x1 - x0), sz = Math.abs(z1 - z0);
  const ax = face === 'S' || face === 'N';
  const { plaque, plaqueCharH, ...rest } = spec;
  const s = { eaveW: ax ? sx : sz, eaveD: ax ? sz : sx, ...rest };
  const hc = ctx.at(cx, y0, cz, ROT[face]);
  const info = (spec.stories ? buildTower : buildHallFixed)(hc, s);
  if (plaque) hangPlaque(hc, info, plaque, plaqueCharH);
  if (!spec.stories && spec.kind !== 'pavilion') eaveCeiling(hc, info);
  return { ...info, cx, cz, top: y0 + (info.topY || 0) };
}

/**
 * 檐内顶棚：斗拱顶与檐下望板之间的空隙在低视角下会透见天空（屋面单面渲染），
 * 在（上层）檐柱网之上铺一块朝下的椽望面遮挡。
 */
export function eaveCeiling(hc, info) {
  const s = info.spec;
  if (!s || !s.dougong) return;
  let w = s.colW, d = s.colD, y = info.eaveY;
  if (s.double && info.upperEaveY !== undefined) {
    const inset = s.double.inset ?? s.bays[0];
    w -= 2 * inset; d -= 2 * inset; y = info.upperEaveY;
  }
  if (y === undefined) return;
  hc.add('soffit', polyTopGeo(rectPoly(-w / 2 - 0.6, w / 2 + 0.6, -d / 2 - 0.6, d / 2 + 0.6), y + 0.22, true));
}

/**
 * 正面明间竖匾：匾顶略高出（上层）大额枋顶，主体压在额枋之上（核心默认挂得偏高，低视点时被檐口遮住）。
 * hc 为建筑局部坐标系，info 为 buildHall 返回值。
 */
export function hangPlaque(hc, info, text, ch = 0.4) {
  if (!info.plaqueAt) return;
  const D = info.spec?.colDia ?? 0.5;
  const h = plaqueSize(text, true).h * ch;
  // 重檐：匾挂在上檐斗拱前（压斗拱、额枋），否则会被下檐围脊遮住
  const dbl = info.upperEaveY !== undefined;
  const top = dbl ? info.upperEaveY - 0.05 : info.plaqueAt.y + clamp(0.18 * h, 0.15, 0.5);
  plaqueAt(hc, text, top - h / 2, info.plaqueAt.z + D * 0.55 + (dbl ? 0.5 : 0.12), ch);
}

/** 自动推断 + 补丁（与 world.js 对象覆盖等效，但经 FixCtx 构建） */
export function autoFix(patch = {}) {
  return (ctx, b, api) => {
    for (const it of api.autoItems(b)) {
      if (it.type !== 'hall') continue;
      const spec = api.mergeSpec(it.spec || {}, patch);
      buildHallFixed(ctx.at(patch.x ?? it.x, spec.y0 ?? 0, patch.z ?? it.z, patch.rotY ?? it.rotY), spec);
    }
  };
}

/** 开口栏杆（世界坐标折线），y 地栿底高 */
export function rail(ctx, pts, y, opts = {}) {
  buildRailing(ctx, { path: pts, y, style: 'marble', closed: false, ends: 'post', ...opts });
}

/** 宫墙（世界坐标折线），y0 底高 */
export function wall(ctx, pts, { h = 6, thick = 1.2, cap = 'yellow', y0 = 0, style, gaps, base } = {}) {
  buildPalaceWall(y0 ? ctx.at(0, y0, 0) : ctx, { path: pts, h, thick, cap, style, gaps, base });
}

/** 墙门（琉璃门/随墙门）：(x,z) 门中心，face 门正面朝向 */
export function wgate(ctx, x, z, face, opts, y0 = 0) {
  return buildWallGate(ctx.at(x, y0, z, ROT[face]), { type: 'liuli', ...opts });
}

/** 铺地带：沿折线（世界坐标）宽 w、厚 h 的石板带（每段一个矩形棱柱，UV 世界米） */
export function paveStrip(ctx, pts, w, { mat = 'paving_imperial', y = 0, h = 0.06 } = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.05) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * w / 2, nz = ux * w / 2;
    const e = i < pts.length - 2 ? w / 2 : 0, s0 = i > 0 ? w / 2 : 0; // 拐角处延长半宽，避免缺角
    const A = [ax - ux * s0, az - uz * s0], B = [bx + ux * e, bz + uz * e];
    const poly = [[A[0] + nx, A[1] + nz], [B[0] + nx, B[1] + nz], [B[0] - nx, B[1] - nz], [A[0] - nx, A[1] - nz]];
    ctx.add(mat, prismGeo(poly, y, y + h));
  }
}

/** 矩形铺地块（世界坐标） */
export function paveRect(ctx, x0, x1, z0, z1, { mat = 'paving_imperial', y = 0, h = 0.06 } = {}) {
  ctx.add(mat, prismGeo(rectPoly(x0, x1, z0, z1), y, y + h));
}

/**
 * 斜面实体（马道、坡道）：世界矩形 [x0,x1]×[z0,z1]，顶面沿 axis（'x'|'z'）自 a 端高 ha 线性变到 b 端高 hb。
 * 侧面 sideMat，顶面 topMat。
 */
export function slopeBlock(ctx, x0, x1, z0, z1, axis, ha, hb, { sideMat = 'wall_red', topMat = 'brick_grey', y0 = 0 } = {}) {
  const hAt = (x, z) => (axis === 'x' ? ha + ((x - x0) / (x1 - x0)) * (hb - ha) : ha + ((z - z0) / (z1 - z0)) * (hb - ha));
  const C = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const pos = [], uv = [], tpos = [], tuv = [];
  // 侧面（外法线）
  const quad = (a, b) => {
    const ya = hAt(a[0], a[1]), yb = hAt(b[0], b[1]);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const P = [[a[0], y0, a[1], 0, y0], [b[0], y0, b[1], L, y0], [b[0], yb, b[1], L, yb], [a[0], ya, a[1], 0, ya]];
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(P[k][0], P[k][1], P[k][2]); uv.push(P[k][3], P[k][4]); }
  };
  for (let i = 0; i < 4; i++) quad(C[i], C[(i + 1) % 4]);
  const g = fromArrays(pos, uv);
  g.computeVertexNormals();
  // 顶面
  const T = C.map(([x, z]) => [x, hAt(x, z), z]);
  for (const k of [0, 2, 1, 0, 3, 2]) { tpos.push(...T[k]); tuv.push(T[k][0], T[k][2]); }
  const t = fromArrays(tpos, tuv);
  t.computeVertexNormals();
  if (t.attributes.normal.getY(0) < 0) { // 保证朝上
    const p = t.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { const a = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = a; }
    const u = t.attributes.uv.array;
    for (let i = 0; i < u.length; i += 6) for (let j = 0; j < 2; j++) { const a = u[i + 2 + j]; u[i + 2 + j] = u[i + 4 + j]; u[i + 4 + j] = a; }
    t.computeVertexNormals();
  }
  fixOutward(g, (x0 + x1) / 2, (z0 + z1) / 2);
  ctx.add(sideMat, g);
  ctx.add(topMat, t);
}

/** 让侧面三角形法线朝外（相对中心 cx,cz） */
function fixOutward(g, cx, cz) {
  const p = g.attributes.position.array, u = g.attributes.uv.array;
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 9) {
    a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6);
    v.subVectors(b, a).cross(c.clone().sub(a));
    const mx = (a.x + b.x + c.x) / 3 - cx, mz = (a.z + b.z + c.z) / 3 - cz;
    if (v.x * mx + v.z * mz < 0) {
      for (let j = 0; j < 3; j++) { const t = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = t; }
      const k = (i / 3) * 2;
      for (let j = 0; j < 2; j++) { const t = u[k + 2 + j]; u[k + 2 + j] = u[k + 4 + j]; u[k + 4 + j] = t; }
    }
  }
  g.computeVertexNormals();
}

/** 汉白玉须弥座台墩（带顶面）：中心 (x,z)，底 y，w×d×h，rotY */
export function pedestal(ctx, x, y, z, w, d, h, rotY = 0, mat = 'marble') {
  const c = ctx.at(x, y, z, rotY);
  buildXumizuo(c, rectPoly(-w / 2, w / 2, -d / 2, d / 2), 0, h, { edgeW: 0.12 });
  c.add(mat, polyTopGeo(rectPoly(-w / 2 + 0.05, w / 2 - 0.05, -d / 2 + 0.05, d / 2 - 0.05), h - 0.005));
  return y + h;
}

/** 竖匾（挂在局部 (0,y,z) 朝 +Z 的立面上） */
export function plaqueAt(ctx, text, y, z, ch = 0.5, style = 'blue') {
  const sz = plaqueSize(text, true);
  const w = sz.w * ch, h = sz.h * ch;
  const c = ctx.at(0, y, z).rot(-0.1, 0, 0);
  const face = new THREE.PlaneGeometry(w, h);
  face.translate(0, 0, 0.06);
  c.add(makePlaque(text, { vertical: true, style }), face);
  c.add('board_red', boxGeo(w * 0.98, h * 0.98, 0.1));
}

/**
 * 正多边形亭（八角/六角）：局部原点为中心，正面朝 +Z（一条边朝 +Z）。
 * opts: n 边数, R 柱网外接圆半径, colH, colDia, ph 台基高, roof {tile, rise, r, baoding, ridgeColor}, walls: 'open'|'lattice'
 */
export function polyPavilion(ctx, { n = 8, R = 2.4, colH = 3.2, colDia = 0.3, ph = 0.6, tile = 'yellow', ridgeColor, rise, eaveR, closed = true, baoding = 'gold', beasts = 1, platStyle = 'xumizuo' }) {
  const ang = (i) => ((i + 0.5) * 2 * PI) / n; // 顶点角（边朝 +Z）
  const P = Array.from({ length: n }, (_, i) => [R * Math.sin(ang(i)), R * Math.cos(ang(i))]);
  const Rp = R + 0.9;
  const PP = Array.from({ length: n }, (_, i) => [Rp * Math.sin(ang(i)), Rp * Math.cos(ang(i))]);
  buildPlatform(ctx, { poly: PP, h: ph, style: platStyle, edgeW: 0.4 });
  buildStairs(ctx.at(0, 0, Rp * Math.cos(PI / n), 0), { w: 1.6, h: ph, run: ph / 0.45, style: 'marble' });
  for (const [x, z] of P) {
    ctx.place('col:wood_red', x, ph, z, 0, [colDia, colH, colDia]);
    ctx.place('zhuchu', x, ph, z, 0, [colDia, colDia, colDia]);
  }
  // 额枋 + 墙/隔扇
  const bh = clamp(colDia * 1.1, 0.24, 0.5);
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const rot = Math.atan2(mx, mz);
    const c = ctx.at(mx, 0, mz, rot);
    const g = boxGeo(L, bh, colDia * 0.8); g.translate(0, ph + colH - bh / 2, 0);
    c.add('beam_xuanzi', g);
    const gb = boxGeo(L, bh * 0.5, colDia * 0.5); gb.translate(0, ph + colH + bh * 0.2, 0);
    c.add('board_red', gb);
    if (closed) {
      // 正面一间为隔扇门，其余为槛窗
      const front = Math.abs(rot) < 0.2;
      const panel = boxGeo(L - colDia, colH - bh * 1.6, 0.12);
      panel.translate(0, ph + (colH - bh * 1.6) / 2, 0);
      c.add(front ? 'lattice_door' : 'lattice_window', panel);
      const sill = boxGeo(L - colDia, front ? 0.12 : 0.85, 0.3);
      sill.translate(0, ph + (front ? 0.06 : 0.425), 0);
      c.add(front ? 'wood_red' : 'wall_red', sill);
    }
  }
  const er = eaveR ?? R + 1.1;
  const y = ph + colH + 0.35;
  const r = buildRoof(ctx, { type: 'cuanjian', sides: n, r: er, y, rise: rise ?? er * 0.95, tile, ridgeColor, baoding, beasts, overhang: er - R, detail: 2 });
  return { top: (r.ridgeY ?? y) + 1 };
}

/** 简易方亭（4 柱，可开敞），基于 buildHall 的 pavilion */
export function squarePavilion(ctx, { w, colH = 3.2, ph = 0.5, tile = 'yellow', ridgeColor, rise, baoding = 'gold', double, dougong = false, grade = 4, platStyle = 'xumizuo', stairs, caihua = 'xuanzi', beasts }) {
  const roof = { type: 'cuanjian', sides: 4, tile, ridgeColor, baoding, rise: rise ?? w * 0.42, beasts };
  return buildHallFixed(ctx, {
    kind: 'pavilion', eaveW: w, eaveD: w, nBays: 1, nDepth: 1, colH, grade, dougong, caihua,
    platform: { h: ph, style: platStyle, stairs: stairs ?? [{ side: 'S', w: Math.min(2.2, w * 0.4) }] }, roof, double,
  });
}

export { buildHallFixed as buildHall, buildTower, buildPlatform, buildRailing, buildStairs, buildRoof, boxGeo, cylGeo, prismGeo, polyTopGeo, clamp };
