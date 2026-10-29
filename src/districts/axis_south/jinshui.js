// 内金水河（太和门广场段）：两岸汉白玉栏杆（望柱栏板），五座单孔石拱内金水桥（中为御路桥，龙纹望柱）
import { buildRailing } from '../../core/platform.js';
import { buildBridge } from '../../core/props.js';
import { boxGeo } from '../../core/geom.js';

/** 五座桥：中心 x、宽、拱高（桥面中点高于地面） */
export const BRIDGES = [
  { x: -1.2, w: 7.6, h: 2.3, dragon: true },
  { x: -15.2, w: 6.6, h: 2.1 }, { x: 12.8, w: 6.6, h: 2.1 },
  { x: -31.5, w: 5.8, h: 1.9 }, { x: 29.1, w: 5.8, h: 1.9 },
];
const Z0 = 390.7, Z1 = 413.4; // 桥两端（南北）

/** 河道多边形拆成南北两岸折线（自西向东），裁到 [-xm, xm] */
function banks(poly, xm) {
  // 以最西点、最东点为界
  let iW = 0, iE = 0;
  poly.forEach((p, i) => { if (p[0] < poly[iW][0]) iW = i; if (p[0] > poly[iE][0]) iE = i; });
  const n = poly.length, walk = (a, b) => { const out = []; for (let i = a; ; i = (i + 1) % n) { out.push(poly[i]); if (i === b) break; } return out; };
  const A = walk(iW, iE), B = walk(iE, iW).reverse();
  const meanZ = (L) => L.reduce((s, p) => s + p[1], 0) / L.length;
  const [north, south] = meanZ(A) < meanZ(B) ? [A, B] : [B, A];
  const clip = (L) => {
    const out = [];
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (Math.abs(p[0]) <= xm) { out.push(p); continue; }
      const q = L[i - 1], r = L[i + 1];
      for (const o of [q, r]) if (o && Math.abs(o[0]) <= xm) { const t = (Math.sign(p[0]) * xm - o[0]) / (p[0] - o[0]); out.push([o[0] + (p[0] - o[0]) * t, o[1] + (p[1] - o[1]) * t]); }
    }
    return out.sort((a, b) => a[0] - b[0]);
  };
  return { north: clip(north), south: clip(south) };
}

/** 折线外偏（远离河心）：sgn=+1 向 +z（南岸），-1 向 -z（北岸） */
function offsetLine(L, d, sgn) {
  return L.map((p, i) => {
    const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)];
    let nx = -(b[1] - a[1]), nz = b[0] - a[0];
    const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
    if (nz * sgn < 0) { nx = -nx; nz = -nz; }
    return [p[0] + nx * d, p[1] + nz * d];
  });
}

/** 沿 x 区间切掉桥位 */
function cutAtBridges(L) {
  // 加密到 0.25m，按是否落在桥位切段，再去掉近共线的中间点
  const D = [];
  for (let i = 0; i < L.length - 1; i++) {
    const a = L[i], b = L[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25));
    for (let k = 0; k < n; k++) D.push({ p: [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n], v: k === 0 });
  }
  D.push({ p: L[L.length - 1], v: true });
  const inB = (x) => BRIDGES.some((b) => Math.abs(x - b.x) < b.w / 2 + 0.35);
  const runs = [];
  let cur = [];
  for (const d of D) {
    if (inB(d.p[0])) { if (cur.length) runs.push(cur); cur = []; } else cur.push(d);
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length >= 2).map((r) => r.filter((d, i) => d.v || i === 0 || i === r.length - 1).map((d) => d.p));
}

export function buildJinshui(ctx, api) {
  const w = api.site.water.find((q) => q.id === 638204006);
  if (w) {
    const { north, south } = banks(w.poly, 97.5);
    for (const [L, sgn] of [[north, -1], [south, 1]]) {
      const path = offsetLine(L, 0.42, sgn);
      for (const run of cutAtBridges(path)) {
        buildRailing(ctx, { path: run, y: 0.02, style: 'marble', ends: 'drum', outward: sgn > 0 ? -1 : 1 });
      }
    }
  }
  // 五座内金水桥：单孔石拱，汉白玉栏杆随桥面起拱
  for (const b of BRIDGES) {
    const c = ctx.at(b.x, 0, (Z0 + Z1) / 2, 0);
    const info = buildBridge(c, { length: Z1 - Z0, width: b.w, archH: b.h, arches: 1, style: 'marble', waterY: api.waterY, dragonPosts: !!b.dragon, postSpacing: b.dragon ? 1.6 : 1.75 });
    // 金刚墙（券脚至河岸之间桥身下部实砌，补足河道宽于券洞的部分）
    const [zW, zE] = info.channel;
    const yb = api.waterY - 0.9, yt = -0.28;
    for (const [za, zb] of [[-(Z1 - Z0) / 2 + 0.2, zW], [zE, (Z1 - Z0) / 2 - 0.2]]) {
      if (zb - za < 0.1) continue;
      const g = boxGeo(b.w, yt - yb, zb - za);
      g.translate(0, (yt + yb) / 2, (za + zb) / 2);
      c.add('marble_block', g);
    }
  }
}
