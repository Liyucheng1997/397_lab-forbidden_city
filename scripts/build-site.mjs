// 将 OpenStreetMap 原始数据 (data/osm_raw.json) 转换为场景用的米制坐标数据 (src/data/site.json)
// 坐标系：1 单位 = 1 米；X 向东，Z 向南（北 = -Z），原点 = 紫禁城外墙矩形中心，中轴线 X = 0
// 数据来源 © OpenStreetMap contributors, ODbL
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/osm_raw.json'), 'utf8'));
const els = raw.elements;

const lat0 = 39.916603, lon0 = 116.390787, R = 6378137;
const kx = Math.cos((lat0 * Math.PI) / 180) * (Math.PI / 180) * R;
const ky = (Math.PI / 180) * R;
// 测绘数据中建筑/宫墙整体相对正北偏转约 1.85°（北京中轴线本身也偏 ~2°）
const PHI = (-1.85 * Math.PI) / 180;
const rot = (lat, lon) => {
  const x = (lon - lon0) * kx, y = (lat - lat0) * ky;
  return [x * Math.cos(PHI) - y * Math.sin(PHI), x * Math.sin(PHI) + y * Math.cos(PHI)];
};

const byId = new Map(els.map((e) => [e.type[0] + e.id, e]));
const geomOf = (e) => {
  if (e.type === 'way') return [e.geometry || []];
  return (e.members || []).filter((m) => m.geometry && (m.role === 'outer' || m.role === '')).map((m) => m.geometry);
};
const bboxOf = (pts) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
};

// ---- 1. 中轴线拟合：x = a + b*y，再做剪切让中轴严格为 x=0 ----
const AXIS = ['w638449347', 'w638473398', 'w638981317', 'w639012193', 'w638981229', 'w638741722', 'w638807674', 'w639060881', 'r8854349'];
const axisPts = AXIS.map((k) => {
  const e = byId.get(k);
  const pts = geomOf(e).flat().map((p) => rot(p.lat, p.lon));
  const b = bboxOf(pts);
  return [b.cx, b.cy];
});
const n = axisPts.length;
const my = axisPts.reduce((s, p) => s + p[1], 0) / n, mx = axisPts.reduce((s, p) => s + p[0], 0) / n;
const slope = axisPts.reduce((s, p) => s + (p[1] - my) * (p[0] - mx), 0) / axisPts.reduce((s, p) => s + (p[1] - my) ** 2, 0);
const icpt = mx - slope * my;

// ---- 2. 外墙南北面确定原点 ----
const t1 = (lat, lon) => { const [x, y] = rot(lat, lon); return [x - (icpt + slope * y), y]; };
const extOf = (id) => bboxOf(byId.get('w' + id).geometry.map((p) => t1(p.lat, p.lon)));
const north = (extOf(156148328).y1 + extOf(156148390).y1) / 2;
const south = (extOf(638206927).y0 + extOf(156149069).y0) / 2;
const west = extOf(156150832).x0, east = extOf(156151306).x1;
const Y0 = (north + south) / 2;
const T = (p) => { const [x, y] = t1(p.lat, p.lon); return [+(x).toFixed(2), +(-(y - Y0)).toFixed(2)]; }; // -> [X, Z]

// ---- 几何工具 ----
const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
const centroid = (P) => {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; const f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; }
  if (Math.abs(a) < 1e-9) { const b = bboxOf(P); return [b.cx, b.cy]; }
  return [cx / (3 * a), cy / (3 * a)];
};
const pip = (pt, P) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const ring = (g) => { const P = g.map(T); if (P.length > 1 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) P.pop(); return P; };
// 最小外接矩形，角度吸附到正交方向
function obb(P) {
  let best = null;
  const test = (ang) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of P) { const u = x * c + y * s, v = -x * s + y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const a = (u1 - u0) * (v1 - v0);
    if (!best || a < best.a - 1e-6) best = { a, ang, u0, u1, v0, v1 };
  };
  for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; if (Math.hypot(x2 - x1, y2 - y1) > 0.3) test(Math.atan2(y2 - y1, x2 - x1)); }
  test(0);
  let ang = best.ang;
  // 归一化到 (-45°, 45°]
  while (ang > Math.PI / 4) ang -= Math.PI / 2;
  while (ang <= -Math.PI / 4) ang += Math.PI / 2;
  const snapped = Math.abs(ang) < (5 * Math.PI) / 180;
  if (snapped) ang = 0;
  const c = Math.cos(ang), s = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y] of P) { const u = x * c + y * s, v = -x * s + y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  // sx: 沿 X(旋转后) 的尺寸, sz: 沿 Z 的尺寸
  return { cx: +(cu * c - cv * s).toFixed(2), cz: +(cu * s + cv * c).toFixed(2), sx: +(u1 - u0).toFixed(2), sz: +(v1 - v0).toFixed(2), ang: +ang.toFixed(4), snapped };
}

const KEEP_TAGS = ['name', 'building', 'building:part', 'historic', 'height', 'min_height', 'building:levels', 'roof:shape', 'roof:colour', 'roof:direction', 'roof:orientation', 'roof:height', 'roof:material', 'building:colour', 'building:material', 'amenity', 'tourism', 'barrier', 'man_made', 'bridge', 'highway', 'natural', 'landuse', 'leisure', 'waterway', 'water', 'layer', 'surface', 'area', 'name:en'];
const pickTags = (t) => { const o = {}; for (const k of KEEP_TAGS) if (t[k] !== undefined) o[k] = t[k]; if (t['name:zh'] && !o.name) o.name = t['name:zh']; if (t['name:zh']) o.name = t['name:zh']; return o; };

// 裁剪范围：护城河以内 + 午门前
const inRegion = ([x, z]) => x > -470 && x < 470 && z > -545 && z < 600;
const inPalace = ([x, z]) => x > -402 && x < 402 && z > -512 && z < 600;

const out = { meta: {}, buildings: [], parts: [], walls: [], water: [], waterways: [], bridges: [], paths: [], areas: [], green: [], treeRows: [] };

for (const e of els) {
  const t = e.tags || {};
  const gs = geomOf(e).filter((g) => g.length >= 2);
  if (!gs.length) continue;
  const id = e.id;
  const tags = pickTags(t);
  const closed = (g) => g.length > 3 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;

  if (t.building === 'wall' || t['building:part'] === 'wall' || t.barrier === 'wall' || t.barrier === 'city_wall' || t.barrier === 'retaining_wall') {
    for (const g of gs) {
      const pts = g.map(T);
      if (!pts.some(inPalace)) continue;
      const isPoly = !!(t.building || t['building:part']) && closed(g);
      out.walls.push({ id, kind: t.barrier || (t.building ? 'building_wall' : 'part_wall'), poly: isPoly, pts: isPoly ? ring(g) : pts, tags });
    }
    continue;
  }
  if (t.building || t['building:part']) {
    for (const g of gs) {
      if (!closed(g)) continue;
      const P = ring(g);
      if (P.length < 3) continue;
      const c = centroid(P);
      if (!inPalace(c)) continue;
      const rec = { id, type: e.type, poly: P, area: +Math.abs(area(P)).toFixed(1), c: [+c[0].toFixed(2), +c[1].toFixed(2)], obb: obb(P), tags };
      rec.rect = +(rec.area / (rec.obb.sx * rec.obb.sz)).toFixed(3);
      (t.building ? out.buildings : out.parts).push(rec);
      if (e.type === 'relation') break;
    }
    continue;
  }
  if (t.natural === 'water' || t.water) {
    for (const g of gs) { const P = ring(g); if (P.some(inRegion)) out.water.push({ id, poly: P, tags }); }
    continue;
  }
  if (t.waterway) {
    for (const g of gs) { const P = g.map(T); if (P.some(inPalace)) out.waterways.push({ id, pts: P, tags }); }
    continue;
  }
  if (t.man_made === 'bridge') {
    for (const g of gs) { const P = ring(g); if (P.some(inPalace)) out.bridges.push({ id, poly: P, tags }); }
    continue;
  }
  if (t.highway) {
    for (const g of gs) {
      const P = g.map(T);
      if (!P.some(inPalace)) continue;
      if (t.area === 'yes' && closed(g)) out.areas.push({ id, poly: ring(g), tags });
      else out.paths.push({ id, pts: P, tags });
    }
    continue;
  }
  if (t.natural === 'tree_row') {
    for (const g of gs) { const P = g.map(T); if (P.some(inPalace)) out.treeRows.push({ id, pts: P, tags }); }
    continue;
  }
  if (t.landuse || t.leisure || t.natural) {
    for (const g of gs) {
      if (!closed(g)) continue;
      const P = ring(g);
      const b = bboxOf(P);
      if (b.x1 - b.x0 > 900) continue; // 跳过城市级大面
      if (P.some(inPalace)) out.green.push({ id, poly: P, tags });
    }
  }
}

// 每个建筑包含的 parts（按质心落在轮廓内）
const partIndex = out.parts.map((p) => ({ p, b: bboxOf(p.poly) }));
for (const b of out.buildings) {
  const bb = bboxOf(b.poly);
  b.partIds = partIndex.filter(({ p, b: pb }) => pb.cx >= bb.x0 && pb.cx <= bb.x1 && pb.cy >= bb.y0 && pb.cy <= bb.y1 && pip(p.c, b.poly)).map(({ p }) => p.id);
}

out.meta = {
  attribution: '© OpenStreetMap contributors (ODbL)',
  osmTimestamp: raw.osm3s?.timestamp_osm_base,
  projection: { lat0, lon0, rotationDeg: (PHI * 180) / Math.PI, axisShear: +slope.toFixed(6), axisOffset: +icpt.toFixed(3), originNorthing: +Y0.toFixed(3) },
  outerWall: { west: +west.toFixed(2), east: +east.toFixed(2), northZ: +(-(north - Y0)).toFixed(2), southZ: +(-(south - Y0)).toFixed(2) },
  counts: Object.fromEntries(Object.entries(out).filter(([k, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])),
};

fs.mkdirSync(path.join(ROOT, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/data/site.json'), JSON.stringify(out));
console.log(JSON.stringify(out.meta, null, 2));
console.log('axis fit residuals:', axisPts.map(([x, y]) => (x - (icpt + slope * y)).toFixed(2)).join(' '));
