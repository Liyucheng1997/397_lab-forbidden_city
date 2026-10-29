// 全场景总装：地面、护城河与内金水河、宫墙、全部建筑（自动推断 + 分区精修覆盖）、桥、树木
import * as THREE from 'three';
import { Batcher, Ctx } from '../core/batcher.js';
import { buildHall } from '../core/building.js';
import { buildPalaceWall } from '../core/walls.js';
import { buildPlatform, buildRailing, buildStairs } from '../core/platform.js';
import { buildBridge } from '../core/props.js';
import { createWater } from '../core/nature.js';
import { getMaterial } from '../core/materials.js';
import { SITE, autoItems, decompose, stoneTiersOf, classify } from './auto.js';
import { DISTRICTS, districtOf } from '../districts/index.js';
import { clamp, offsetPoly } from '../core/geom.js';
import { OUTER_WALL } from '../config.js';

const WATER_Y = -1.7;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** 浅合并：roof/platform/double/dougong 子对象合并 */
export function mergeSpec(base, patch) {
  const out = { ...base, ...patch };
  for (const k of ['roof', 'platform', 'double', 'dougong']) {
    if (patch && patch[k] && typeof patch[k] === 'object' && base[k] && typeof base[k] === 'object') out[k] = { ...base[k], ...patch[k] };
  }
  return out;
}

/** 折线缓冲为多边形（河道） */
function bufferLine(pts, w) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    L.push([pts[i][0] - dz * w / 2, pts[i][1] + dx * w / 2]);
    R.push([pts[i][0] + dz * w / 2, pts[i][1] - dx * w / 2]);
  }
  return [...L, ...R.reverse()];
}
function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** 水体多边形：OSM 水面 + 无水面的河道折线缓冲 */
export function waterPolys() {
  const polys = SITE.water.map((w) => ({ poly: w.poly, name: w.tags.name || '', id: w.id }));
  const seen = new Set();
  for (const w of SITE.waterways) {
    const key = w.pts.map((p) => p.join(',')).join(';');
    if (seen.has(key)) continue;
    seen.add(key);
    if (w.tags.tunnel) continue;
    const mid = w.pts[Math.floor(w.pts.length / 2)];
    const m2 = [(w.pts[0][0] + w.pts[w.pts.length - 1][0]) / 2, (w.pts[0][1] + w.pts[w.pts.length - 1][1]) / 2];
    if (polys.some((p) => pip(mid[0], mid[1], p.poly) || pip(m2[0], m2[1], p.poly))) continue;
    if (Math.abs(mid[0]) > 376 || Math.abs(mid[1]) > 484) continue; // 墙外暗沟
    polys.push({ poly: bufferLine(w.pts, 3.2), name: 'channel', id: w.id });
  }
  return polys;
}

function groundMesh(holes) {
  const shape = new THREE.Shape([[-470, -585], [470, -585], [470, 600], [-470, 600]].map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) {
    let P = h.map(([x, z]) => new THREE.Vector2(x, z));
    shape.holes.push(new THREE.Path(P));
  }
  const g = new THREE.ShapeGeometry(shape);
  // ShapeGeometry 在 XY 平面，转到 XZ：(x, y) -> (x, 0, y)
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setXYZ(i, x, 0, y); }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  g.computeVertexNormals();
  // 保证法线向上
  if (g.attributes.normal.getY(0) < 0) { const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}

/** 驳岸：沿水体多边形边缘的竖直石壁（朝向水面） */
function embankment(ctx, poly, top = 0.05, bottom = WATER_Y - 0.6, mat = 'stone_grey') {
  const P = poly;
  const ccw = THREE.ShapeUtils.isClockWise(P.map(([x, z]) => new THREE.Vector2(x, z))) === false;
  const pos = [], uv = [];
  let acc = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.01) continue;
    const q = [[a[0], bottom, a[1], acc, bottom], [b[0], bottom, b[1], acc + L, bottom], [b[0], top, b[1], acc + L, top], [a[0], top, a[1], acc, top]];
    // 多边形逆时针（x,z 平面）时，外法线 = (dz,-dx)，水在内侧 → 面朝内
    const order = ccw ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const k of order) { pos.push(q[k][0], q[k][1], q[k][2]); uv.push(q[k][3], q[k][4]); }
    acc += L;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  ctx.add(mat, g);
}

/** 墙线正交化 */
function rectilinear(pts) {
  const P = pts.map((p) => [...p]);
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    if (Math.abs(dx) > Math.abs(dz) * 6) { const m = (a[1] + b[1]) / 2; a[1] = m; b[1] = m; }
    else if (Math.abs(dz) > Math.abs(dx) * 6) { const m = (a[0] + b[0]) / 2; a[0] = m; b[0] = m; }
  }
  return P;
}

const wallThick = (h) => (h <= 3 ? 0.7 : h <= 4.5 ? 1.0 : h <= 6.5 ? 1.3 : h <= 8.5 ? 1.7 : 2.2);

function isOuterWall(w) {
  const name = w.tags.name || '';
  if (/^城墙/.test(name) || w.kind === 'city_wall') return true;
  const xs = w.pts.map((p) => p[0]), zs = w.pts.map((p) => p[1]);
  const len = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const nearEdge = Math.min(...xs) < OUTER_WALL.west + 10 || Math.max(...xs) > OUTER_WALL.east - 10 || Math.min(...zs) < OUTER_WALL.north + 10 || Math.max(...zs) > OUTER_WALL.south - 10;
  return len > 120 && nearEdge && (Math.abs(Math.min(...xs) - Math.max(...xs)) < 14 || Math.abs(Math.min(...zs) - Math.max(...zs)) < 14);
}

/** 自动墙体 */
export function autoWall(ctx, w, patch = {}) {
  const h = patch.h ?? (parseFloat(w.tags.height) || 6);
  if (w.poly) {
    const rects = decompose(w.pts, 0);
    for (const r of rects) {
      const long = r.sx >= r.sz;
      const L = long ? r.sx : r.sz, t = clamp(long ? r.sz : r.sx, 0.6, 4);
      const path = long ? [[r.cx - L / 2, r.cz], [r.cx + L / 2, r.cz]] : [[r.cx, r.cz - L / 2], [r.cx, r.cz + L / 2]];
      buildPalaceWall(ctx, { path, h, thick: patch.thick ?? t, cap: patch.cap ?? 'yellow', style: patch.style, base: patch.base });
    }
  } else {
    buildPalaceWall(ctx, { path: rectilinear(w.pts), h, thick: patch.thick ?? wallThick(h), cap: patch.cap ?? 'yellow', style: patch.style, base: patch.base, gaps: patch.gaps });
  }
}

/** 自动台基（OSM 石质分块：平台分层 + 台阶） */
export function autoPlatform(ctx, b, opts = {}) {
  const { tiers, stairs } = stoneTiersOf(b);
  if (!tiers.length) {
    buildPlatform(ctx, { poly: b.poly, h: parseFloat(b.tags.height) || 1.2, style: opts.style || 'xumizuo' });
    return;
  }
  for (const t of tiers) {
    buildPlatform(ctx, { poly: t.poly, y0: t.minH, h: t.h - t.minH, style: opts.style || 'xumizuo' });
    if (opts.railing !== false && t.h >= 1.4) buildRailing(ctx, { path: offsetPoly(t.poly, -0.35), closed: true, y: t.h, style: opts.railingStyle || 'marble', chishou: opts.chishou });
  }
  for (const s of stairs) {
    const rot = { 0: Math.PI, 90: Math.PI / 2, 180: 0, 270: -Math.PI / 2 }[s.dir];
    const along = s.dir === 0 || s.dir === 180;
    const w = along ? s.obb.sx : s.obb.sz, run = along ? s.obb.sz : s.obb.sx;
    // 台阶上端（高处）在下坡方向的反侧
    const dx = { 0: 0, 90: -1, 180: 0, 270: 1 }[s.dir], dz = { 0: 1, 90: 0, 180: -1, 270: 0 }[s.dir];
    const x = s.obb.cx + dx * run / 2, z = s.obb.cz + dz * run / 2;
    buildStairs(ctx.at(x, s.minH, z, rot), { w, h: s.h - s.minH, run, style: 'marble' });
  }
}

/** 主入口 */
export async function buildWorld(scene, { onProgress = () => {}, only = null } = {}) {
  const t0 = performance.now();
  const groups = [];
  const landmarks = [];
  const waters = [];
  const stats = { buildings: 0, items: 0, walls: 0, errors: 0, tris: 0 };

  // ---- 地面与水 ----
  onProgress('地面与水系', 0.02);
  const wp = waterPolys();
  const base = new Batcher('ground');
  const gctx = new Ctx(base);
  gctx.add('paving', groundMesh(wp.map((w) => w.poly)));
  for (const w of wp) {
    embankment(gctx, w.poly);
    const m = createWater(w.poly, WATER_Y);
    m.name = 'water:' + (w.name || w.id);
    scene.add(m);
    waters.push(m);
  }
  // 外围大地
  // 外围大地：中间挖去铺装区矩形，避免盖住护城河水面
  const os = new THREE.Shape([[-3000, -3000], [3000, -3000], [3000, 3000], [-3000, 3000]].map(([x, z]) => new THREE.Vector2(x, z)));
  os.holes.push(new THREE.Path([[-470, -585], [-470, 600], [470, 600], [470, -585]].map(([x, z]) => new THREE.Vector2(x, z))));
  const og = new THREE.ShapeGeometry(os);
  { const p = og.attributes.position, uv = og.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setXYZ(i, x, 0, y); uv.setXY(i, x, y); } }
  og.computeVertexNormals();
  if (og.attributes.normal.getY(0) < 0) { const idx = og.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } og.computeVertexNormals(); }
  const outer = new THREE.Mesh(og, getMaterial('ground_dirt'));
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);
  const gGroup = base.build();
  scene.add(gGroup);
  groups.push(gGroup);
  await nextFrame();

  // ---- 分区 ----
  const byDistrict = new Map(DISTRICTS.map((d) => [d.key, { d, buildings: [], walls: [] }]));
  for (const b of SITE.buildings) {
    const k = districtOf(b.c[0], b.c[1], b);
    if (byDistrict.has(k)) byDistrict.get(k).buildings.push(b);
  }
  for (const w of SITE.walls) {
    const m = w.pts[Math.floor(w.pts.length / 2)];
    const k = isOuterWall(w) ? 'walls' : districtOf(m[0], m[1]);
    if (byDistrict.has(k)) byDistrict.get(k).walls.push(w);
  }
  // 桥：归属分区
  const bridgesBy = new Map();
  for (const br of SITE.bridges) {
    const c = br.poly.reduce((a, p) => [a[0] + p[0] / br.poly.length, a[1] + p[1] / br.poly.length], [0, 0]);
    const k = districtOf(c[0], c[1]);
    if (!bridgesBy.has(k)) bridgesBy.set(k, []);
    bridgesBy.get(k).push(br);
  }

  let di = 0;
  for (const { d, buildings, walls } of byDistrict.values()) {
    di++;
    if (only && !only.includes(d.key)) continue;
    onProgress(d.title, 0.05 + (0.9 * di) / byDistrict.size);
    await nextFrame();
    const batcher = new Batcher(d.key);
    const ctx = new Ctx(batcher);
    const api = {
      site: SITE, scene, district: d, buildings, walls, waterY: WATER_Y,
      addWater: (poly, y = WATER_Y) => { const m = createWater(poly, y); scene.add(m); waters.push(m); return m; },
      label: (name, x, y, z, desc = '') => landmarks.push({ name, pos: [x, y, z], desc, district: d.key }),
      autoItems, mergeSpec, autoWall, autoPlatform,
    };
    const ov = d.overrides || {};
    for (const b of buildings) {
      const o = ov[b.id];
      if (o === 'skip') continue;
      try {
        let top = 0;
        if (typeof o === 'function') { o(ctx, b, api); stats.buildings++; continue; }
        let items = autoItems(b);
        if (Array.isArray(o)) items = o.map((it) => ({ type: it.type || 'hall', b, x: it.x, z: it.z, rotY: it.rotY ?? 0, spec: it }));
        else if (o && typeof o === 'object') items = items.map((it) => ({ ...it, x: o.x ?? it.x, z: o.z ?? it.z, rotY: o.rotY ?? it.rotY, type: o.type || it.type, spec: mergeSpec(it.spec || {}, o) }));
        for (const it of items) {
          if (it.type === 'platform') { autoPlatform(ctx, b, it.spec || {}); continue; }
          const info = buildHall(ctx.at(it.x, it.spec.y0 ?? 0, it.z, it.rotY), it.spec);
          top = Math.max(top, (info.topY || 8) + (it.spec.y0 ?? 0));
          stats.items++;
        }
        stats.buildings++;
        if (b.tags.name && !(o && o.noLabel)) landmarks.push({ name: b.tags.name, pos: [b.obb.cx, top + 2, b.obb.cz], desc: (o && o.desc) || '', district: d.key, id: b.id });
      } catch (e) {
        stats.errors++;
        console.error('building failed', b.id, b.tags.name, e);
      }
    }
    const wov = d.wallOverrides || {};
    for (const w of walls) {
      const o = wov[w.id];
      if (o === 'skip') continue;
      if (d.key === 'walls' && isOuterWall(w)) continue;
      try { autoWall(ctx, w, o || {}); stats.walls++; } catch (e) { stats.errors++; console.error('wall failed', w.id, e); }
    }
    const brs = bridgesBy.get(d.key) || [];
    for (const br of brs) {
      if ((d.bridgeOverrides || {})[br.id] === 'skip') continue;
      try {
        const xs = br.poly.map((p) => p[0]), zs = br.poly.map((p) => p[1]);
        const sx = Math.max(...xs) - Math.min(...xs), sz = Math.max(...zs) - Math.min(...zs);
        const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
        const alongZ = sz >= sx;
        buildBridge(ctx.at(cx, 0, cz, alongZ ? 0 : Math.PI / 2), { length: alongZ ? sz : sx, width: alongZ ? sx : sz, archH: 1.2, waterY: WATER_Y });
      } catch (e) { stats.errors++; console.error('bridge failed', br.id, e); }
    }
    if (d.build) {
      try { await d.build(ctx, api); } catch (e) { stats.errors++; console.error('district build failed', d.key, e); }
    }
    const group = batcher.build();
    group.userData.district = d.key;
    scene.add(group);
    groups.push(group);
    stats.tris += batcher.triCount;
  }
  stats.ms = performance.now() - t0;
  onProgress('完成', 1);
  return { groups, landmarks, waters, stats };
}
