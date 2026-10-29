// 外西路分区辅助：OSM 轮廓 → spec、楼阁叠层、勾连搭、墙门、铺地、树木等小工具
import { buildingById } from '../../site/auto.js';
import { Ctx } from '../../core/batcher.js';
import { buildHall, resolveHallSpec } from '../../core/building.js';
import { buildRoof } from '../../core/roof.js';
import { buildRailing } from '../../core/platform.js';
import { buildWallGate } from '../../core/walls.js';
import { boxGeo, prismGeo, clamp } from '../../core/geom.js';

export const S = 0, N = Math.PI, E = Math.PI / 2, W = -Math.PI / 2;

/**
 * 规避 core/building.js 小式檐檩（无斗拱时的 cylGeo 檐檩）平移错位：rotateZ(π/2) 后圆柱位于 x∈[-L,0]，
 * 再 translate(-L/2) 落到 [-1.5L,-0.5L]，整根檩条伸出建筑一个檩长（远看为地面/屋面上的“蓝色斜杆”）。
 * 这里包一层 batcher：仅当 'beam_xuanzi' 圆柱几何恰好呈现上述错位（x 区间 [-1.5L,-0.5L]）时平移 +L 归位；core 修正后自动失效。
 */
const fixedBatchers = new WeakMap();
function fixBatcher(b) {
  if (fixedBatchers.has(b)) return fixedBatchers.get(b);
  const fb = {
    addGeometry(mat, geo, m) {
      if (mat === 'beam_xuanzi' && geo && geo.type === 'CylinderGeometry') {
        if (!geo.boundingBox) geo.computeBoundingBox();
        const { min, max } = geo.boundingBox, L = max.x - min.x;
        if (L > 0.5 && max.x < 0 && Math.abs(max.x + 0.5 * L) < 0.02 * L) geo = geo.clone().translate(L, 0, 0);
      }
      b.addGeometry(mat, geo, m);
    },
    addInstance: (k, m) => b.addInstance(k, m),
  };
  fixedBatchers.set(b, fb);
  return fb;
}
/** 包装 ctx（见 fixBatcher）；子坐标系 ctx.at() 继承包装后的 batcher */
export const fx = (ctx) => new Ctx(fixBatcher(ctx.batcher), ctx.m.clone());
const isNS = (d) => Math.abs(Math.sin(d)) < 0.5;

/** OSM 外接矩形 + 朝向 → 完整 spec（世界坐标 x,z,rotY + eaveW/eaveD） */
export function F(id, dir, o = {}) {
  const b = buildingById.get(id);
  if (!b) throw new Error('no building ' + id);
  const { cx, cz, sx, sz } = b.obb;
  return { x: cx, z: cz, rotY: dir, eaveW: isNS(dir) ? sx : sz, eaveD: isNS(dir) ? sz : sx, ...o };
}
/** 世界矩形 [x0,x1]×[z0,z1] + 朝向 → spec */
export function Rc(x0, x1, z0, z1, dir, o = {}) {
  const sx = Math.abs(x1 - x0), sz = Math.abs(z1 - z0);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rotY: dir, eaveW: isNS(dir) ? sx : sz, eaveD: isNS(dir) ? sz : sx, ...o };
}
/** 数组覆盖 + 属性（desc/noLabel） */
export const arr = (items, props = {}) => Object.assign(items, props);

// ---------------- 常用形制预设 ----------------
const gable = (mat) => ({ type: 'yingshan', gableWallMat: mat });
/** 黄琉璃瓦小式硬山（配房、耳房、值房） */
export const yRoom = (o = {}) => ({ grade: 5, tile: 'yellow', ...o, roof: { ...gable('wall_red'), ...(o.roof || {}) } });
/** 黄琉璃瓦硬山前出廊（配殿、庑房） */
export const yWing = (o = {}) => ({ grade: 4, tile: 'yellow', nDepth: 3, corridor: 1.4, backCorridor: false, ...o, roof: { ...gable('wall_red'), ...(o.roof || {}) } });
/** 灰筒瓦硬山（服务用房、库房） */
export const gRoom = (o = {}) => ({ grade: 5, tile: 'grey', caihua: 'none', wallMat: 'brick_grey', ...o, roof: { ...gable('brick_grey'), wen: false, beasts: -1, ...(o.roof || {}) } });
/** 灰瓦卷棚硬山（园林素雅小房） */
export const gJuan = (o = {}) => gRoom({ caihua: 'sushi', ...o, roof: { juan: true, ...(o.roof || {}) } });

// ---------------- 楼阁叠层 ----------------
function shrink(bays, d) {
  if (!d) return bays.slice();
  const out = bays.slice();
  let l = d, r = d;
  while (l > 1e-3 && out.length > 1) { if (out[0] <= l + 0.3) { l -= out.shift(); } else { out[0] -= l; l = 0; } }
  while (r > 1e-3 && out.length > 1) { if (out[out.length - 1] <= r + 0.3) { r -= out.pop(); } else { out[out.length - 1] -= r; r = 0; } }
  return out;
}

/**
 * 楼（多层）：每层用 buildHall，层间出腰檐（skirt，可指定瓦色/剪边），可设平座栏杆。
 * spec: buildHall 平面参数（eaveW/eaveD 或 bays/depthBays, nBays, nDepth, grade, dougong, caihua, platform, corridor, tile, ridgeColor）
 *   stories: [{ colH, front, back, sides, left, right, inset|insetX|insetZ（相对下层柱网每侧内收）, balcony, skirtRise, tile, ridgeColor, kind }]
 *   roof: 顶层屋顶（type 必填）
 * 返回 { topY, storyY[], roof（顶层屋顶 info）, top（顶层 ctx） }
 */
export function buildLou(ctx, spec) {
  const st = spec.stories;
  const base = resolveHallSpec({ ...spec, colH: st[0].colH });
  let bays = base.bays, depthBays = base.depthBays;
  const D0 = base.colDia;
  const tile = spec.tile || 'yellow', rc = spec.ridgeColor;
  let y = 0, info = null, c = ctx, ovh = base.overhang;
  const storyY = [];
  for (let k = 0; k < st.length; k++) {
    const s = st[k], last = k === st.length - 1;
    const nxt = st[k + 1];
    const D = k === 0 ? D0 : D0 * 0.9;
    const corrK = k === 0 ? (base.corridorDepth || 0) : 0;
    let roof;
    let ub = bays, ud = depthBays;
    if (!last) {
      ub = shrink(bays, nxt.insetX ?? nxt.inset ?? 0);
      ud = shrink(depthBays, nxt.insetZ ?? nxt.inset ?? 0);
      const uw = ub.reduce((a, b) => a + b, 0), udd = ud.reduce((a, b) => a + b, 0);
      const wallT = clamp(D * 1.1, 0.35, 0.9);
      const cw = bays.reduce((a, b) => a + b, 0), cd = depthBays.reduce((a, b) => a + b, 0);
      const run = (cd + 2 * ovh - udd - wallT) / 2;
      roof = { type: 'skirt', inner: { w: uw + wallT, d: udd + wallT }, rise: s.skirtRise ?? clamp(run * 0.5, 0.8, 3), tile: s.tile || tile, ridgeColor: s.ridgeColor || rc, beasts: s.beasts ?? 3 };
      void cw;
    } else roof = { tile, ridgeColor: rc, ...spec.roof };
    const hs = {
      ...spec, kind: s.kind || (k === 0 ? spec.kind : 'hall'), bays, depthBays, nBays: undefined, nDepth: undefined, colW: undefined, colD: undefined,
      eaveW: undefined, eaveD: undefined, colH: s.colH, colDia: D, overhang: ovh,
      corridor: corrK ? corrK : 0, corridorDepth: corrK,
      platform: k === 0 ? spec.platform : false,
      front: s.front ?? (k === 0 ? spec.front : undefined), back: s.back ?? (k === 0 ? spec.back : undefined),
      sides: s.sides ?? (k === 0 ? spec.sides : undefined), left: s.left, right: s.right,
      dougong: spec.dougong === false || base.dougong === false ? false : { kou: base.dougong.kou * (k ? 0.92 : 1), cai: last ? base.dougong.cai : Math.max(1, base.dougong.cai - 2) },
      roof, double: undefined, plaque: s.plaque ?? (k === st.length - 1 ? undefined : k === 0 ? spec.plaque : undefined),
    };
    storyY.push(y);
    info = buildHall(c, hs);
    if (last) break;
    const kou = hs.dougong ? hs.dougong.kou : 0.06;
    const yTop = info.eaveY + kou * 1.5 + roof.rise + 0.06;
    // 平座（楼板挑出 + 栏杆 + 挂檐板）
    const uw = ub.reduce((a, b) => a + b, 0), udd = ud.reduce((a, b) => a + b, 0);
    if (nxt.balcony) {
      const bd = nxt.balconyDepth ?? 0.9;
      const bw = uw + 2 * bd, bdd = udd + 2 * bd;
      const sides = nxt.balcony === true ? 'NESW' : nxt.balcony;
      const slab = boxGeo(bw, 0.24, bdd); slab.translate(0, yTop - 0.12, 0);
      c.add('wood_red', slab);
      for (const [L, x, z, r] of [[bw, 0, bdd / 2, 0], [bw, 0, -bdd / 2, Math.PI], [bdd, bw / 2, 0, Math.PI / 2], [bdd, -bw / 2, 0, -Math.PI / 2]]) {
        const g = boxGeo(L, 0.42, 0.06); g.translate(0, yTop - 0.3, 0.03);
        c.at(x, 0, z, r).add(nxt.balconyBand || 'board_green', g);
      }
      const hw = bw / 2 - 0.08, hd = bdd / 2 - 0.08;
      const P = { S: [[-hw, hd], [hw, hd]], E: [[hw, hd], [hw, -hd]], N: [[hw, -hd], [-hw, -hd]], W: [[-hw, -hd], [-hw, hd]] };
      for (const sd of sides) buildRailing(c, { path: P[sd], y: yTop, style: nxt.balconyStyle || 'wood_red', height: 0.95, ends: 'post' });
    }
    // 下一层柱网：内收
    bays = ub; depthBays = ud;
    ovh = clamp(ovh * 0.92, 0.8, 2.6);
    y += yTop;
    c = c.at(0, yTop, 0);
  }
  return { topY: y + (info.topY ?? 0), storyY, roof: info.roof, top: c, info };
}

/** 勾连搭：同一柱网上并列 n 道屋顶（沿进深等分）；roofs 可逐道指定（如前歇山后卷棚） */
export function buildGoulian(ctx, spec, n = 2, roofs = null) {
  const r0 = spec.roof || { type: 'xuanshan', juan: true };
  const info = buildHall(ctx, { ...spec, roof: { type: 'flat', w: 0.05, d: 0.05 } });
  const s = info.spec;
  const kou = s.dougong ? s.dougong.kou : 0.06;
  const y = info.eaveY + kou * 1.5;
  const secD = s.eaveD / n;
  let top = 0;
  for (let i = 0; i < n; i++) {
    const z = s.eaveD / 2 - secD * (i + 0.5);
    const rr = { tile: s.tile || 'yellow', ...r0, ...((roofs && roofs[i]) || {}) };
    const r = buildRoof(ctx.at(0, 0, z), { overhang: s.overhang, ...rr, w: s.eaveW, d: secD + 0.25, y, detail: s.detail });
    top = Math.max(top, r.ridgeY ?? y);
  }
  return { ...info, topY: top + 0.6 };
}

// ---------------- 墙门 ----------------
/** 墙门：在世界坐标 (x,z) 处按 rotY 放置 buildWallGate，返回顶高 */
export function wallGate(ctx, x, z, rotY, opts) {
  const r = buildWallGate(ctx.at(x, 0, z, rotY), { wallThick: 1.1, ...opts });
  return (r && r.top) || opts.h || 6;
}

/** 墙线上第 i 段的长度区间（用于 wallOverrides.gaps） */
export function segRange(pts, i) {
  let acc = 0;
  for (let k = 0; k < i; k++) acc += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
  const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return { from: acc, to: acc + L };
}

// ---------------- 铺地 ----------------
/** 甬路/御道：矩形石板带，略高于地面 */
export function pave(ctx, x0, x1, z0, z1, h = 0.06, mat = 'paving_imperial') {
  ctx.add(mat, prismGeo([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, h));
}
/** 沿折线的甬路（宽 w） */
export function paveLine(ctx, pts, w = 3, h = 0.06, mat = 'paving_imperial') {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    // 两端各延伸半宽搭接转角；相邻段高差 4mm 防止共面闪烁
    const x0 = Math.min(ax, bx) - w / 2, x1 = Math.max(ax, bx) + w / 2;
    const z0 = Math.min(az, bz) - w / 2, z1 = Math.max(az, bz) + w / 2;
    pave(ctx, x0, x1, z0, z1, h + (i % 2) * 0.004, mat);
  }
}

// ---------------- 树木 ----------------
const TH = { pine: 11, cypress: 12, locust: 14, ginkgo: 17, elm: 13, willow: 10, bamboo: 5, shrub: 1.3 };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
/** 栽树：list = [[x, z, kind, 高度?], ...] */
export function plant(ctx, list, y = 0) {
  for (const [x, z, kind, h] of list) {
    const v = Math.floor(rnd() * 4);
    const hh = h ?? TH[kind] * (0.85 + 0.3 * rnd());
    ctx.place(`tree:${kind}:${v}`, x, y, z, rnd() * Math.PI * 2, hh);
  }
}
