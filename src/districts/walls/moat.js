// 筒子河（护城河）两岸与城外环境：外岸矮墙、内岸矮墙、外岸人行道/街道与成排垂柳、城墙与河之间的草地树木、南岸公园、跨河桥
import { buildBridge } from '../../core/props.js';
import { buildLawn } from '../../core/nature.js';
import { OUTER_WALL } from '../../config.js';
import { Acc, extrude, cutPath, offsetPath, ribbon, rand, pip, pathFrames } from './common.js';

const MOAT_ID = 4845030;
const WATER_Y = -1.7;

/** 筒子河外岸、内岸折线（OSM 水面为单环：内岸 → 午门西断口 → 外岸 → 午门东断口 → 内岸） */
export function moatEdges(site) {
  const w = site.water.find((q) => q.id === MOAT_ID);
  if (!w) return null;
  const P = w.poly;
  const outer = P.slice(11, 47); // 含两端断口（午门两侧的河道尽端）
  const inner = [...P.slice(46), ...P.slice(0, 12)];
  // 背水一侧的符号：沿 N=(dz,-dx) 偏移为 +1 时离开水面
  const side = (path) => { const F = pathFrames(path); const i = Math.floor(F.sc / 2), a = path[i], d = F.N[i]; const m = [(a[0] + path[i + 1][0]) / 2 + d[0], (a[1] + path[i + 1][1]) / 2 + d[1]]; return pip(m[0], m[1], P) ? -1 : 1; };
  return { poly: P, outer, inner, so: side(outer), si: side(inner) };
}

/** 东西华门外桥由 east_outer / west_outer 重建：按其实际桥宽断开矮墙（OSM 桥面轮廓更宽） */
const BRIDGE_Z = { 1031650602: [345.9, 362.9] };

/** 城墙外的跨河桥矩形（含边距） */
export function moatBridgeRects(site, pad = 0.5) {
  const out = [];
  for (const br of site.bridges) {
    const xs = br.poly.map((p) => p[0]), zs = br.poly.map((p) => p[1]);
    const r = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    if (BRIDGE_Z[br.id]) [r[2], r[3]] = BRIDGE_Z[br.id];
    const cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2;
    if (Math.abs(cz) > OUTER_WALL.south + 5 || cx > OUTER_WALL.east + 5 || cx < OUTER_WALL.west - 5) out.push({ id: br.id, r: [r[0] - pad, r[1] + pad, r[2] - pad, r[3] + pad], raw: r, cx, cz });
  }
  return out;
}

/** 矮墙：青砖墙身 + 青白石压顶，path 为墙中线 */
function lowWall(acc, path, { h = 1.0, t = 0.5, mat = 'brick_grey', cap = 'stone_grey' } = {}) {
  const a = t / 2, e = 0.06, ct = 0.16;
  const capP = [[a + e, h], [a + e, h + ct], [-a - e, h + ct], [-a - e, h]];
  extrude(acc, path, [
    { p: [[a + 0.03, -0.3], [a + 0.03, 0.25], [a, 0.25]], mat: 'stone_grey' },
    { p: [[a, 0.25], [a, h]], mat },
    { p: [[a, h], [a + e, h]], mat: cap, v: 'o' }, { p: capP, mat: cap },
    { p: [[-a - e, h], [-a, h]], mat: cap, v: 'o' },
    { p: [[-a, h], [-a, 0.25]], mat }, { p: [[-a, 0.25], [-a - 0.03, 0.25], [-a - 0.03, -0.3]], mat: 'stone_grey' },
  ], { caps: [{ poly: [[-a, -0.3], [a, -0.3], [a, h], [-a, h]], mat }, { poly: capP, mat: cap }] });
}

/** 是否落在任一建筑轮廓（外扩 m 米）内 */
function hitsBuilding(site, x, z, m = 3) {
  for (const b of site.buildings) {
    const o = b.obb;
    if (Math.abs(x - o.cx) > o.sx / 2 + m || Math.abs(z - o.cz) > o.sz / 2 + m) continue;
    return true;
  }
  return false;
}

/** 沿折线按间距取点（返回 [x,z,切向角]） */
function along(path, sp, start = sp / 2) {
  const out = [];
  let acc = 0, next = start;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= acc + L) {
      const t = (next - acc) / L;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1])]);
      next += sp;
    }
    acc += L;
  }
  return out;
}

/**
 * 建造筒子河两岸与城外环境。返回 { trees }
 */
export function buildMoatSurroundings(ctx, site) {
  const E = moatEdges(site);
  if (!E) return { trees: 0 };
  const bridges = moatBridgeRects(site);
  const brR = bridges.map((b) => b.r);
  const acc = new Acc();
  // ---- 外岸矮墙（泊岸墙）与内岸矮墙，桥头处断开 ----
  for (const run of cutPath(offsetPath(E.outer, 0.32 * E.so), brR, 1.5)) lowWall(acc, run, { h: 1.05, t: 0.52 });
  for (const run of cutPath(offsetPath(E.inner, 0.3 * E.si), brR, 1.5)) lowWall(acc, run, { h: 0.72, t: 0.46 });

  // ---- 外岸：人行道（方砖、路缘）+ 车行道；南岸为公园（中山公园、太庙）甬路 ----
  const WNE = E.outer.slice(2, 18); // 西岸—北岸—东岸（索引 13..28）
  ribbon(acc, WNE, 0.6 * E.so, 5.6 * E.so, 0.18, 'paving_square', { curb: 0.18 });
  ribbon(acc, WNE, 5.6 * E.so, 15.5 * E.so, 0.08, 'walls_asphalt');
  ribbon(acc, WNE, 15.5 * E.so, 19.5 * E.so, 0.18, 'paving_square', { curb: 0.18 });
  // 景山前街（北岸）较宽
  const N = E.outer.slice(11, 15);
  ribbon(acc, N, 19.5 * E.so, 27 * E.so, 0.08, 'walls_asphalt');
  ribbon(acc, N, 27 * E.so, 33 * E.so, 0.18, 'paving_square', { curb: 0.18 });
  const SW = E.outer.slice(0, 3), SE = E.outer.slice(17);
  for (const p of [SW, SE]) ribbon(acc, p, 0.6 * E.so, 4.6 * E.so, 0.16, 'paving', { curb: 0.16 });
  acc.flush(ctx);
  // 南岸公园草地（至地面边缘 z=600）
  const swEdge = offsetPath(E.outer.slice(1, 3), 4.6 * E.so), seEdge = offsetPath(E.outer.slice(17, 35), 4.6 * E.so);
  buildLawn(ctx, { poly: [...swEdge, [swEdge[swEdge.length - 1][0], 599], [swEdge[0][0], 599]], y: 0.07 });
  buildLawn(ctx, { poly: [...seEdge, [seEdge[seEdge.length - 1][0], 599], [seEdge[0][0], 599]], y: 0.07 });

  // ---- 城墙与河之间的草地（OSM 林地，四面各一条） ----
  for (const id of [42740555, 42740556, 42740559, 42740567]) {
    const g = site.green.find((q) => q.id === id);
    if (g) buildLawn(ctx, { poly: g.poly, y: 0.07, curb: 0.12, curbW: 0.2 });
  }

  // ---- 树木 ----
  let trees = 0;
  const R = rand(97);
  const nearBridge = (x, z, m) => bridges.some((b) => x > b.raw[0] - m && x < b.raw[1] + m && z > b.raw[2] - m && z < b.raw[3] + m);
  const plant = (kind, x, z, hgt, y = 0.05) => { ctx.place(`tree:${kind}:${(R() * 4) | 0}`, x, y, z, R() * Math.PI * 2, hgt); trees++; };
  // 外岸垂柳（西、北、东岸人行道）
  for (const [x, z] of along(offsetPath(WNE, 3.1 * E.so), 12)) {
    if (nearBridge(x, z, 6)) continue;
    plant('willow', x, z, 9.5 + R() * 2.5, 0.18);
  }
  // 外侧便道国槐（东西岸）
  for (const [x, z] of along(offsetPath(WNE, 17.5 * E.so), 19)) {
    if (nearBridge(x, z, 8) || Math.abs(z) > 545) continue;
    plant('locust', x, z, 11 + R() * 4, 0.18);
  }
  // 东华门、西华门外（城墙与河之间）已由 east_outer / west_outer 植行道树，此处让开
  const othersPlanted = (x, z) => (x > 380 && z > -46 && z < 166) || (x < -380 && z > 40 && z < 174);
  // 内岸：临水一行垂柳（避开建筑、桥头、角楼一带）
  for (const [x, z] of along(offsetPath(E.inner, 4.2 * E.si), 13.5)) {
    if (nearBridge(x, z, 7) || hitsBuilding(site, x, z, 3.5) || othersPlanted(x, z)) continue;
    if (Math.abs(x) > 340 && Math.abs(z) > 450) continue; // 角楼前留出视廊
    if (Math.abs(x) < 110 && z > 0) continue; // 午门前
    plant('willow', x, z, 9 + R() * 2.5);
  }
  // 东西两侧林地中部一行国槐
  for (const [x0, z0, z1] of [[-391.5, -455, 34], [388.5, -465, -52]]) {
    for (let z = z0; z < z1; z += 18) {
      if (hitsBuilding(site, x0, z, 3)) continue;
      plant(R() < 0.75 ? 'locust' : 'elm', x0 + (R() - 0.5) * 2, z + (R() - 0.5) * 3, 12 + R() * 4);
    }
  }
  // 南侧城墙下（OSM 行道树）
  for (const [xa, xb] of [[-365, -108], [100, 365]]) {
    for (let x = xa; x <= xb; x += 13) {
      const z = 491.5 + (R() - 0.5) * 1.2;
      if (hitsBuilding(site, x, z, 2)) continue;
      plant('locust', x, z, 11 + R() * 3);
    }
  }
  // 南岸公园古柏（中山公园、太庙北部）
  for (const [x0, x1, z0, z1, n] of [[-430, -110, 572, 596, 18], [105, 435, 566, 596, 18]]) {
    for (let k = 0; k < n; k++) {
      const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
      if (pip(x, z, E.poly)) continue;
      plant('cypress', x, z, 10 + R() * 5);
    }
  }
  return { trees, bridges };
}

/**
 * 跨河桥（神武门、东华门、西华门外）：石砌平桥三孔，青白石栏板。仅在归属分区声明 'skip' 时由本分区建造。
 */
export function buildMoatBridge(ctx, b) {
  const [x0, x1, z0, z1] = b.raw;
  const sx = x1 - x0, sz = z1 - z0;
  // 桥身沿跨越方向：北桥沿 z，东西桥沿 x
  const alongZ = Math.abs(b.cz) > OUTER_WALL.south + 5;
  const L = alongZ ? sz : sx, W = alongZ ? sx : sz;
  buildBridge(ctx.at(b.cx, 0, b.cz, alongZ ? 0 : Math.PI / 2), { length: L + 1.5, width: W, archH: 0.55, style: 'stone', arches: 3, span: L * 0.62, waterY: WATER_Y, crown: 0.5, postSpacing: 1.9 });
}
