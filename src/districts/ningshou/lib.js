// 宁寿宫区分区：通用小工具（OSM 轮廓 → 构件参数、游廊、铺地、树木布置）
import * as THREE from 'three';
import { buildingById } from '../../site/auto.js';
import { makePlaque, plaqueSize } from '../../core/plaque.js';
import { dougongReach } from '../../core/dougong.js';
import { buildHall, buildTower } from '../../core/building.js';
import { Ctx } from '../../core/batcher.js';
import { prismGeo, boxGeo, clamp } from '../../core/geom.js';
import { TREE_HEIGHT } from '../../core/nature.js';

export const PI = Math.PI;

/**
 * 临时修正上下文：core/building.js 小式（无斗拱）檐檩 cylGeo 旋转后 translate(-L/2) 方向反了，
 * 檩条整体偏出一个 L（建筑外伸出 4 根“蓝杆”）。此处拦截该几何（包围盒 x∈[-1.5L,-0.5L]）并平移 +L 归位；
 * core 修正后判据不再命中，自动失效。
 */
export class FixCtx extends Ctx {
  at(...a) { const c = Ctx.prototype.at.apply(this, a); return new FixCtx(c.batcher, c.m); }
  mul(m4) { const c = Ctx.prototype.mul.call(this, m4); return new FixCtx(c.batcher, c.m); }
  rot(...a) { const c = Ctx.prototype.rot.apply(this, a); return new FixCtx(c.batcher, c.m); }
  add(mat, geo, local) {
    if (mat === 'beam_xuanzi' && geo && geo.attributes && geo.attributes.position) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const b = geo.boundingBox, L = b.max.x - b.min.x;
      if (L > 0.3 && Math.abs(b.max.x + L / 2) < 1e-3 && b.max.y - b.min.y < 1.5 && Math.abs(b.max.z + b.min.z) < 1e-3) { geo = geo.clone(); geo.translate(L, 0, 0); }
    }
    super.add(mat, geo, local);
  }
}
export const fix = (ctx) => (ctx instanceof FixCtx ? ctx : new FixCtx(ctx.batcher, ctx.m));
/** 朝向 → rotY（正面朝南 0 / 北 π / 东 +π/2 / 西 -π/2） */
export const FACE = { S: 0, N: PI, E: PI / 2, W: -PI / 2 };

/** OSM 建筑外接矩形 [x0,x1,z0,z1]（世界坐标；本区建筑均已正交） */
export function rectOf(id) {
  const o = buildingById.get(id).obb;
  return [o.cx - o.sx / 2, o.cx + o.sx / 2, o.cz - o.sz / 2, o.cz + o.sz / 2];
}

/** 矩形 + 朝向 → 构件条目（world.js 数组覆盖用：x,z,rotY 世界坐标，eaveW 面阔方向、eaveD 进深方向） */
export function item(r, face, spec = {}) {
  const [x0, x1, z0, z1] = r;
  const along = face === 'S' || face === 'N';
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rotY: FACE[face], eaveW: along ? x1 - x0 : z1 - z0, eaveD: along ? z1 - z0 : x1 - x0, ...spec };
}

/**
 * 竖匾：悬于正面明间、斗拱之前（core 的匾额贴在额枋前，会被斗拱/檐口遮住上部）。
 * c 为建筑局部坐标系（正面 +Z），info 为 buildHall 返回值，charH 字高（米）
 */
export function hangPlaque(c, info, text, charH = 0.45) {
  if (!info || !info.plaqueAt) return;
  const s = info.spec, D = s.colDia;
  const sz = plaqueSize(text, true), w = sz.w * charH, h = sz.h * charH;
  const dg = s.dougong;
  const reach = dg ? dougongReach(dg.cai) * dg.kou + 0.2 : D * 0.6 + 0.12;
  const y0 = info.plaqueAt.y, top = info.upperEaveY ?? info.eaveY ?? y0 + 1;
  const yc = Math.min(y0 + h * 0.45, top + 0.1 - h / 2);
  const cc = c.at(0, yc, info.plaqueAt.z + reach).rot(-0.1, 0, 0);
  const face = new THREE.PlaneGeometry(w, h); face.translate(0, 0, 0.06);
  cc.add(makePlaque(text, { vertical: true, style: 'blue' }), face);
  cc.add('board_red', boxGeo(w * 0.98, h * 0.98, 0.1));
}

/** 多块覆盖（函数覆盖）：parts=[[rect, face, spec], ...]；命名建筑自动加标签（desc 写入信息卡） */
export function M(parts, desc) {
  return (ctx, b, api) => {
    let top = 0;
    for (const [r, f, sp] of parts) {
      const it = item(r, f, sp);
      const c = fix(ctx).at(it.x, sp.y0 ?? 0, it.z, it.rotY);
      const info = buildHall(c, it);
      if (sp.pl) hangPlaque(c, info, sp.pl, sp.plH);
      top = Math.max(top, (info.topY || 6) + (sp.y0 ?? 0));
    }
    const name = b.tags.name;
    if (name && !parts[0][2].noLabel) api.label(name, b.obb.cx, top + 2, b.obb.cz, desc || '');
  };
}
/** 单体覆盖（OSM 轮廓 + 朝向 + 形制） */
export const R = (id, face, spec = {}, desc) => M([[rectOf(id), face, spec]], desc);

/** 自动推断 + 补丁（函数形式，走修正上下文） */
export function auto(patch, desc) {
  return (ctx, b, api) => {
    let top = 0;
    for (const it of api.autoItems(b)) {
      if (it.type === 'platform') { api.autoPlatform(fix(ctx), b, it.spec || {}); continue; }
      const sp = patch ? api.mergeSpec(it.spec, patch) : it.spec;
      const info = buildHall(fix(ctx).at(it.x, sp.y0 ?? 0, it.z, it.rotY), sp);
      top = Math.max(top, (info.topY || 6) + (sp.y0 ?? 0));
    }
    if (b.tags.name && !(patch && patch.noLabel)) api.label(b.tags.name, b.obb.cx, top + 2, b.obb.cz, desc || '');
  };
}

/** 在矩形 r 上建殿（函数覆盖内用），返回 info（含世界坐标下顶高 topY） */
export function hallOn(ctx, r, face, spec) {
  const it = item(r, face, spec);
  const c = fix(ctx).at(it.x, spec.y0 ?? 0, it.z, it.rotY);
  const info = buildHall(c, it);
  if (spec.pl) hangPlaque(c, info, spec.pl, spec.plH);
  return { ...info, x: it.x, z: it.z, topY: (info.topY || 6) + (spec.y0 ?? 0) };
}

/** 在矩形 r 上建楼阁（buildTower） */
export function towerOn(ctx, r, face, spec) {
  const it = item(r, face, spec);
  const info = buildTower(fix(ctx).at(it.x, spec.y0 ?? 0, it.z, it.rotY), it);
  return { ...info, x: it.x, z: it.z, topY: (info.topY || 8) + (spec.y0 ?? 0) };
}

// ---------------- 常用形制预设 ----------------
/** 屋顶：type + 瓦色/剪边（ridgeColor）+ 卷棚 */
export const roof = (type, o = {}) => ({ type, ...o });

/** 小式硬山房（配房、值房、库房） */
export function house(o = {}) {
  const tile = o.tile ?? 'yellow';
  const grey = tile === 'grey';
  return {
    grade: o.grade ?? 5, tile, caihua: o.caihua ?? (grey ? 'none' : 'xuanzi'),
    roof: { type: o.type ?? 'yingshan', juan: o.juan, ridgeColor: o.edge, gableWallMat: grey ? 'brick_grey' : 'wall_red', beasts: o.beasts },
    wallMat: o.wallMat ?? (grey ? 'brick_grey' : undefined),
    corridor: o.corridor, nBays: o.nBays, nDepth: o.nDepth, front: o.front, back: o.back, kind: o.kind, backCorridor: o.backCorridor, plaque: o.plaque,
    platform: o.platform ?? { h: o.ph ?? 0.45, style: 'plain' },
    colH: o.colH, y0: o.y0,
  };
}

/** 园林建筑（苏式彩画，卷棚，黄琉璃瓦绿剪边为默认） */
export function garden(type, o = {}) {
  return {
    grade: o.grade ?? 4, caihua: o.caihua ?? 'sushi', tile: o.tile ?? 'yellow', lattice: o.lattice ?? 'bubujin',
    roof: { type, juan: o.juan ?? true, tile: o.tile ?? 'yellow', ridgeColor: o.edge ?? 'green', beasts: o.beasts, sides: o.sides },
    corridor: o.corridor, backCorridor: o.backCorridor, nBays: o.nBays, nDepth: o.nDepth, kind: o.kind, colH: o.colH, front: o.front, back: o.back, left: o.left, right: o.right,
    platform: o.platform ?? { h: o.ph ?? 0.6, style: o.pstyle ?? 'stone' }, dougong: o.dougong ?? false, y0: o.y0, plaque: o.plaque, bench: o.bench,
  };
}

/**
 * 游廊（单进深敞廊，卷棚悬山）：矩形 r 内沿长边布置。
 * o: tile, edge（剪边色）, colH, y0（台面起点）, ph 台高, bay 间宽, bench, face（'N'/'S' 或 'E'/'W'：坐凳朝向的一侧）, back: 'wall' 背面砌墙
 */
export function gallery(ctx, r, o = {}) {
  const [x0, x1, z0, z1] = r;
  const sx = x1 - x0, sz = z1 - z0, alongX = sx >= sz;
  const L = alongX ? sx : sz, d = alongX ? sz : sx;
  if (L < 1 || d < 0.8) return null;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const face = o.face ?? (alongX ? 'S' : 'E');
  const ov = clamp(d * 0.22, 0.35, 0.65);
  const cl = L - 2 * ov, cd = Math.max(0.8, d - 2 * ov);
  const n = Math.max(1, Math.round(cl / (o.bay ?? 3.0)));
  const spec = {
    kind: o.back ? 'hall' : 'pavilion', bays: Array(n).fill(cl / n), depthBays: [cd], colH: o.colH ?? 2.6, colDia: 0.2, dougong: false, caihua: o.caihua ?? 'sushi', grade: 5,
    platform: { h: o.ph ?? 0.3, style: 'plain', margin: 0.25, stairs: [] }, bench: o.bench ?? true,
    roof: { type: 'xuanshan', juan: true, tile: o.tile ?? 'yellow', ridgeColor: o.edge, beasts: -1, ornaments: false }, overhang: ov, eaveW: L, eaveD: d,
  };
  if (o.back) { spec.front = 'open'; spec.back = 'wall'; spec.sides = 'open'; }
  return buildHall(fix(ctx).at(cx, o.y0 ?? 0, cz, FACE[face]), spec);
}

/** 石板甬路/御道：矩形 [x0,x1,z0,z1] 略高于地面（h），材质默认御路石 */
export function paving(ctx, r, h = 0.06, mat = 'paving_imperial', y0 = 0) {
  const [x0, x1, z0, z1] = r;
  ctx.add(mat, prismGeo([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y0, y0 + h));
}

/** 树：kind ∈ pine/cypress/locust/elm/ginkgo/bamboo/shrub；h 缺省取典型高度（按位置哈希抖动） */
export function tree(ctx, kind, x, z, h, y = 0) {
  const s = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
  const v = Math.floor(s * 4);
  const H = h ?? TREE_HEIGHT[kind] * (0.85 + 0.3 * s);
  ctx.place(`tree:${kind}:${v}`, x, y, z, s * PI * 2, H);
}

/** 沿线等距植树 */
export function treeRow(ctx, kind, a, b, n, h) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    tree(ctx, kind, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, h);
  }
}
