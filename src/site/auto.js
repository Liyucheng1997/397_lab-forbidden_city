// 由 OSM 轮廓自动推断建筑形制：矩形分解、朝向判断、等级/屋顶/尺寸推断
import site from '../data/site.json';
import { clamp } from '../core/geom.js';

export const SITE = site;
export const partById = new Map(site.parts.map((p) => [p.id, p]));
export const buildingById = new Map(site.buildings.map((b) => [b.id, b]));

// ---------------- 占用栅格（用于朝向判断） ----------------
const G = { x0: -420, z0: -560, cell: 1, nx: 840, nz: 1180 };
let grid = null;
function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function buildGrid() {
  grid = new Int32Array(G.nx * G.nz); // 0 空，-1 墙，>0 建筑序号+1
  site.buildings.forEach((b, idx) => {
    const P = b.poly;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let gx = Math.floor(x0 - G.x0); gx <= Math.ceil(x1 - G.x0); gx++) for (let gz = Math.floor(z0 - G.z0); gz <= Math.ceil(z1 - G.z0); gz++) {
      if (gx < 0 || gz < 0 || gx >= G.nx || gz >= G.nz) continue;
      if (pip(gx + G.x0 + 0.5, gz + G.z0 + 0.5, P)) grid[gz * G.nx + gx] = idx + 1;
    }
  });
  for (const w of site.walls) {
    const P = w.poly ? [...w.pts, w.pts[0]] : w.pts;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.5);
      for (let k = 0; k <= n; k++) {
        const gx = Math.floor(ax + ((bx - ax) * k) / n - G.x0), gz = Math.floor(az + ((bz - az) * k) / n - G.z0);
        if (gx >= 0 && gz >= 0 && gx < G.nx && gz < G.nz && grid[gz * G.nx + gx] === 0) grid[gz * G.nx + gx] = -1;
      }
    }
  }
}
/** 自 (x,z) 沿方向 (dx,dz) 的空地距离（遇到非 self 的占用格停止），上限 maxD */
function freeDist(x, z, dx, dz, self, maxD = 40) {
  if (!grid) buildGrid();
  for (let d = 0.5; d < maxD; d += 0.5) {
    const gx = Math.floor(x + dx * d - G.x0), gz = Math.floor(z + dz * d - G.z0);
    if (gx < 0 || gz < 0 || gx >= G.nx || gz >= G.nz) return d;
    const v = grid[gz * G.nx + gx];
    if (v !== 0 && v !== self) return d;
  }
  return maxD;
}

// ---------------- 正交多边形的矩形分解 ----------------
/** poly: 世界坐标；ang: 建筑轴角（弧度）。返回世界坐标下的矩形 [{cx,cz,sx,sz,ang}] */
export function decompose(poly, ang = 0) {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const L = poly.map(([x, z]) => [x * c - z * s, x * s + z * c]);
  const clus = (vals) => {
    const v = [...vals].sort((a, b) => a - b), out = [];
    for (const x of v) { if (!out.length || x - out[out.length - 1][out[out.length - 1].length - 1] > 0.8) out.push([x]); else out[out.length - 1].push(x); }
    return out.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  };
  const xs = clus(L.map((p) => p[0])), zs = clus(L.map((p) => p[1]));
  const nx = xs.length - 1, nz = zs.length - 1;
  if (nx < 1 || nz < 1) return [];
  const inside = [];
  for (let i = 0; i < nx; i++) { inside.push([]); for (let j = 0; j < nz; j++) inside[i].push(pip((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2, L)); }
  const used = inside.map((r) => r.map(() => false));
  const rects = [];
  const ok = (i, j) => i < nx && j < nz && inside[i][j] && !used[i][j];
  for (;;) {
    // 选取面积最大的可扩展矩形（贪心）
    let best = null;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (!ok(i, j)) continue;
      for (const mode of [0, 1]) {
        let i1 = i, j1 = j;
        if (mode === 0) { while (ok(i1 + 1, j)) i1++; let grow = true; while (grow) { for (let k = i; k <= i1; k++) if (!ok(k, j1 + 1)) { grow = false; break; } if (grow) j1++; } }
        else { while (ok(i, j1 + 1)) j1++; let grow = true; while (grow) { for (let k = j; k <= j1; k++) if (!ok(i1 + 1, k)) { grow = false; break; } if (grow) i1++; } }
        const a = (xs[i1 + 1] - xs[i]) * (zs[j1 + 1] - zs[j]);
        if (!best || a > best.a) best = { a, i, j, i1, j1 };
      }
    }
    if (!best) break;
    for (let i = best.i; i <= best.i1; i++) for (let j = best.j; j <= best.j1; j++) used[i][j] = true;
    const lx = (xs[best.i] + xs[best.i1 + 1]) / 2, lz = (zs[best.j] + zs[best.j1 + 1]) / 2;
    const cb = Math.cos(ang), sb = Math.sin(ang);
    rects.push({ cx: lx * cb - lz * sb, cz: lx * sb + lz * cb, sx: xs[best.i1 + 1] - xs[best.i], sz: zs[best.j1 + 1] - zs[best.j], ang });
  }
  return rects;
}

// ---------------- 分类与推断 ----------------
const isStonePart = (p) => p.tags['building:material'] === 'stone' || p.tags['roof:material'] === 'stone';
export function partsOf(b) { return (b.partIds || []).map((i) => partById.get(i)).filter(Boolean); }

export function classify(b) {
  const t = b.tags;
  const name = t.name || '';
  const ps = partsOf(b);
  if (ps.length && ps.every(isStonePart)) return 'platform';
  if (/城墙$/.test(name)) return 'cornertower';
  if (t.historic === 'city_gate' || /门$/.test(name)) return 'gate';
  if (/亭$/.test(name)) return 'pavilion';
  if (/(阁|楼)$/.test(name)) return 'tower';
  if (/^井$/.test(name)) return 'well';
  return 'hall';
}

function roofShapeHint(b) {
  const t = b.tags;
  if (t['roof:shape']) return t['roof:shape'];
  const shapes = new Set(partsOf(b).filter((p) => !isStonePart(p)).map((p) => p.tags['roof:shape']).filter(Boolean));
  if (shapes.has('pyramidal')) return 'pyramidal';
  if (shapes.has('hipped')) return 'hipped';
  if (shapes.has('skillion') && shapes.size >= 1 && partsOf(b).filter((p) => p.tags['roof:shape'] === 'skillion' && !isStonePart(p)).length >= 3) return 'hipped';
  if (shapes.has('gabled')) return 'gabled';
  return null;
}

function tileColor(b) {
  const c = b.tags['roof:colour'];
  if (!c) return null;
  if (/grey|gray/i.test(c)) return 'grey';
  if (/^#FB994D$/i.test(c)) return 'yellow';
  return null;
}

/**
 * 朝向：返回 rotY（建筑正面方向）。长轴沿 X → 南/北；沿 Z → 东/西。
 * rect: {cx,cz,sx,sz}；selfIdx: 栅格中的自身编号
 */
export function facingFor(rect, selfIdx) {
  const { cx, cz, sx, sz } = rect;
  const along = sx >= sz * 0.92 ? 'x' : 'z';
  const probe = (dx, dz) => {
    const off = dx !== 0 ? sx / 2 + 0.6 : sz / 2 + 0.6;
    const span = dx !== 0 ? sz : sx;
    let sum = 0;
    for (const f of [-0.3, 0, 0.3]) {
      const px = cx + dx * off + (dx === 0 ? f * span : 0), pz = cz + dz * off + (dz === 0 ? f * span : 0);
      sum += freeDist(px, pz, dx, dz, selfIdx);
    }
    return sum / 3;
  };
  if (along === 'x') {
    const S = probe(0, 1), N = probe(0, -1);
    if (S >= 6 || S >= N - 1) return { rotY: 0, along, free: S };
    return { rotY: Math.PI, along, free: N };
  }
  const E = probe(1, 0), W = probe(-1, 0);
  if (Math.abs(E - W) < 1.5) return cx > 0 ? { rotY: -Math.PI / 2, along, free: W } : { rotY: Math.PI / 2, along, free: E };
  return E > W ? { rotY: Math.PI / 2, along, free: E } : { rotY: -Math.PI / 2, along, free: W };
}

/**
 * 为一栋 OSM 建筑生成“自动”构件列表：[{ type:'hall'|'platform'|..., x, z, rotY, spec }]
 * 非矩形轮廓分解为多个翼。
 */
export function autoItems(b) {
  const idx = site.buildings.indexOf(b) + 1;
  const cls = classify(b);
  const name = b.tags.name || '';
  if (cls === 'platform') return [{ type: 'platform', b }];
  const rects = b.rect >= 0.86 ? [{ cx: b.obb.cx, cz: b.obb.cz, sx: b.obb.sx, sz: b.obb.sz, ang: b.obb.ang }] : decompose(b.poly, b.obb.ang);
  const items = [];
  const shape = roofShapeHint(b);
  const tile = tileColor(b) || 'yellow';
  const osmH = parseFloat(b.tags.height) || null;
  for (const r of rects) {
    if (Math.min(r.sx, r.sz) < 1.6 || r.sx * r.sz < 5) continue;
    const f = facingFor(r, idx);
    const eaveW = f.along === 'x' ? r.sx : r.sz, eaveD = f.along === 'x' ? r.sz : r.sx;
    const area = eaveW * eaveD;
    const spec = autoSpec({ cls, name, eaveW, eaveD, area, shape, tile, osmH, multi: rects.length > 1 });
    // 坐落在石台（如三台、后三宫台基）上的建筑：基面抬高到台面
    const gh = groundHeightAt(r.cx, r.cz);
    if (gh > 0.3) { spec.y0 = gh; spec.platform = { h: Math.min(spec.grade <= 2 ? 0.9 : 0.5, 1.2), style: 'xumizuo', stairs: [] }; }
    items.push({ type: 'hall', b, x: r.cx, z: r.cz, rotY: f.rotY - (r.ang || 0), spec });
  }
  return items;
}

export function autoSpec({ cls, name, eaveW, eaveD, area, shape, tile, osmH, multi }) {
  let grade = area > 1100 ? 2 : area > 380 ? 3 : area > 130 ? 4 : 5;
  if (/(殿|宫)$/.test(name)) grade = Math.min(grade, 3);
  if (!name) grade = area > 1100 ? 3 : Math.max(grade, 4);
  const aspect = eaveW / eaveD;
  const spec = { grade, eaveW, eaveD, tile };
  let type;
  if (cls === 'pavilion' || cls === 'well') {
    const sq = aspect < 1.25;
    spec.kind = 'pavilion';
    type = sq ? 'cuanjian' : 'xieshan';
    spec.roof = { type, sides: 4, rise: sq ? eaveW * 0.45 : undefined };
    if (cls === 'well') { spec.roof = { type: 'luding', rise: 0.6, inner: { w: eaveW * 0.5, d: eaveD * 0.5 } }; }
    spec.grade = Math.max(grade, 4);
    return spec;
  }
  if (shape === 'pyramidal' && aspect < 1.3) type = 'cuanjian';
  else if (shape === 'hipped') type = grade <= 2 && !multi ? 'wudian' : 'xieshan';
  else if (shape === 'gabled') type = 'yingshan';
  else if (cls === 'gate') type = area > 120 ? 'xieshan' : 'xuanshan';
  else if (eaveD < 9.5 || aspect > 3.2 || area < 70) type = 'yingshan';
  else type = grade <= 3 ? 'xieshan' : 'yingshan';
  spec.roof = { type };
  if (type === 'cuanjian') spec.roof.sides = 4;
  if (type === 'yingshan') spec.roof.gableWallMat = tile === 'grey' ? 'brick_grey' : 'wall_red';
  if (cls === 'gate') { spec.kind = 'gate'; spec.grade = Math.max(3, grade); }
  if (cls === 'tower') {
    // 楼阁：以“下檐腰檐 + 高上层”近似两层
    spec.double = { inset: Math.min(eaveD * 0.12, 2.2), upperH: clamp(eaveD * 0.35, 2.8, 6) };
  }
  // 长廊/庑房：前檐为廊
  if (aspect > 3.2 && eaveD < 10 && cls === 'hall') spec.corridor = clamp(eaveD * 0.22, 1.2, 2.2);
  if (osmH && osmH > 3 && osmH < 30) {
    const rise = 0.62 * (eaveD / 2) * (type === 'cuanjian' ? 1.2 : 1);
    const ph = { 2: 1.6, 3: 1.1, 4: 0.7, 5: 0.4 }[spec.grade] || 0.6;
    const ch = osmH - rise - ph - (spec.grade <= 4 ? 1.4 : 0.7);
    if (ch > 2.4 && ch < 12) spec.colH = ch;
  }
  return spec;
}

/** 台基高度场：所有“石质台基”类建筑的平台分层（不含台阶）。返回 (x,z) 处台面高度（无则 0） */
let tierCache = null;
export function platformTiers() {
  if (tierCache) return tierCache;
  tierCache = [];
  for (const b of site.buildings) {
    if (classify(b) !== 'platform') continue;
    for (const t of stoneTiersOf(b).tiers) {
      const xs = t.poly.map((p) => p[0]), zs = t.poly.map((p) => p[1]);
      tierCache.push({ ...t, owner: b.id, bb: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] });
    }
  }
  return tierCache;
}
export function groundHeightAt(x, z) {
  let h = 0;
  for (const t of platformTiers()) {
    if (x < t.bb[0] || x > t.bb[1] || z < t.bb[2] || z > t.bb[3]) continue;
    if (t.h > h && pip(x, z, t.poly)) h = t.h;
  }
  return h;
}

/** 楼阁/台基等的 OSM 台阶（skillion 石质 part）→ {poly, h, minH, dir} */
export function stoneTiersOf(b) {
  const ps = partsOf(b).filter(isStonePart);
  const tiers = [], stairs = [];
  for (const p of ps) {
    const h = parseFloat(p.tags.height) || 1, minH = parseFloat(p.tags.min_height) || 0;
    if (p.tags['roof:shape'] === 'skillion') {
      let dir = parseFloat(p.tags['roof:direction']);
      if (!isFinite(dir)) dir = 180;
      dir = (Math.round((dir - 1.85) / 90) * 90 + 360) % 360; // 0=北 90=东 180=南 270=西（下坡方向）
      stairs.push({ poly: p.poly, h, minH, dir, obb: p.obb, id: p.id });
    } else tiers.push({ poly: p.poly, h, minH, obb: p.obb, id: p.id });
  }
  tiers.sort((a, b) => a.h - b.h);
  return { tiers, stairs };
}

export const clampN = clamp;
