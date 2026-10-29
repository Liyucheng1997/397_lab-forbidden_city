// 分区：养心殿与西六宫（west_inner）
// 范围 x∈[-170,-75] z∈[-500,-118]。内容：养心殿工字殿及前后院、御膳房；西六宫（东列 永寿宫/翊坤宫/储秀宫，西列 太极殿/长春宫/咸福宫）；
// 西二长街及街门；北部重华宫（乾西二所）、漱芳斋（乾西头所，含大戏台）、乾西三所；北端西长房。
// 全部 OSM 建筑以函数覆盖按真实形制重建（位置/外轮廓取自 OSM 测绘），陈设、树木、甬路见 build()。
import * as THREE from 'three';
import { buildHall, resolveHallSpec } from '../core/building.js';
import { buildWallGate } from '../core/walls.js';
import { buildPlatform } from '../core/platform.js';
import { makePlaque, plaqueSize } from '../core/plaque.js';
import { boxGeo, cylGeo, latheGeo, prismGeo, clamp } from '../core/geom.js';
import { buildingById } from '../site/auto.js';
import { Ctx } from '../core/batcher.js';
import './west_inner/protos.js';

const PI = Math.PI;
const ROT = { S: 0, N: PI, E: PI / 2, W: -PI / 2 };
const oddRound = (x) => Math.max(1, 2 * Math.round((x - 1) / 2) + 1);

// ---------------- 尺寸工具 ----------------
/** OSM 外接框（obb）→ 构件定位与屋檐外轮廓；face 为正面朝向 S/N/E/W */
function O(id, face) {
  const o = buildingById.get(id).obb;
  const ns = face === 'S' || face === 'N';
  return { x: o.cx, z: o.cz, rotY: ROT[face] - (o.ang || 0), eaveW: ns ? o.sx : o.sz, eaveD: ns ? o.sz : o.sx };
}
/** 世界坐标矩形 [x0,x1]×[z0,z1] → 构件定位（用于拆分/修正 OSM 轮廓） */
function R(x0, x1, z0, z1, face) {
  const ns = face === 'S' || face === 'N';
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, rotY: ROT[face], eaveW: ns ? w : d, eaveD: ns ? d : w };
}
/** 浅合并预设（roof/platform 子对象合并） */
function mk(base, o = {}) {
  const s = { ...base, ...o };
  for (const k of ['roof', 'platform']) if (base[k] && o[k]) s[k] = { ...base[k], ...o[k] };
  return s;
}
/** n 间立面：中间 nd 间为 door，其余 win */
const fr = (n, win = 'window', nd = 1, door = 'door') => Array.from({ length: n }, (_, i) => (Math.abs(i - (n - 1) / 2) < nd / 2 ? door : win));

// ---------------- 形制预设 ----------------
// 六宫前殿：面阔五间、单檐歇山、前出廊，檐下单昂三踩斗拱，晚清改苏式彩画（永寿宫、咸福宫保持和玺）
const QIAN = {
  grade: 3, nBays: 5, nDepth: 3, corridor: 1.7, backCorridor: false, colH: 4.4, dougong: { kou: 0.07, cai: 3 }, caihua: 'sushi',
  roof: { type: 'xieshan', beasts: 5 }, platform: { h: 1.0, style: 'plain' }, lattice: 'shuangjiao', plaqueVertical: false, plaqueCharH: 0.42,
  front: ['window', 'window', 'door', 'window', 'window'], back: ['wall', 'wall', 'door', 'wall', 'wall'],
};
// 后殿：面阔五间、硬山、前出廊
const HOU = {
  grade: 4, nBays: 5, nDepth: 3, corridor: 1.4, backCorridor: false, colH: 3.6, overhang: 0.9, dougong: false, caihua: 'sushi', plaqueVertical: false, plaqueCharH: 0.3,
  roof: { type: 'yingshan', beasts: 3 }, platform: { h: 0.6, style: 'plain' }, front: ['window', 'window', 'door', 'window', 'window'], back: 'wall',
};
// 配殿：面阔三间、硬山、前出廊
const PEI = {
  grade: 4, nBays: 3, nDepth: 3, corridor: 1.3, backCorridor: false, colH: 3.3, overhang: 0.85, dougong: false, caihua: 'sushi', plaqueVertical: false, plaqueCharH: 0.26,
  roof: { type: 'yingshan', beasts: 3 }, platform: { h: 0.5, style: 'plain' }, front: ['window', 'door', 'window'], back: 'wall',
};
// 耳房/值房：小式硬山、支摘窗
const ER = {
  grade: 5, nDepth: 1, colH: 2.9, overhang: 0.7, dougong: false, caihua: 'xuanzi', bayHint: 3.3,
  roof: { type: 'yingshan', beasts: 1 }, platform: { h: 0.35, style: 'plain' }, front: 'auto', back: 'wall',
};
/** 长排围房/库房：每三间一门 */
function WEI(eaveW, o = {}) {
  const n = oddRound((eaveW - 1.6) / (o.bay ?? 3.6));
  return mk({ ...ER, nBays: n, colH: 3.0, front: Array.from({ length: n }, (_, i) => (i % 3 === 1 ? 'door' : 'zhizhai')) }, o);
}
/** 游廊（单进深卷棚，前檐敞开，可设后墙） */
function GAL(x0, x1, z0, z1, face, o = {}) {
  return mk({
    ...R(x0, x1, z0, z1, face), kind: 'hall', grade: 5, nDepth: 1, nBays: o.n, bayHint: 3.0, colH: 2.7, colDia: 0.22, overhang: 0.5, dougong: false, caihua: 'sushi',
    roof: { type: 'xuanshan', juan: true, beasts: -1, tile: o.tile || 'yellow' }, platform: { h: 0.45, style: 'plain', stairs: [] },
    front: 'open', back: o.back || 'wall', left: 'open', right: 'open', wallMat: o.wallMat,
  }, o.spec);
}

// ---------------- 构件 ----------------
/** 建筑：buildHall；硬山另补落地山墙（墙外皮与屋面山面齐平，下碱青砖），台基加宽至山墙外皮 */
function hall(ctx, spec) {
  const ying = spec.roof?.type === 'yingshan';
  const r0 = resolveHallSpec(spec);
  // 无斗拱的小式建筑：匾额改由本文件挂在额枋前（中心低于额枋顶），避免匾顶穿出屋檐
  const pq = spec.plaque && !r0.dougong ? spec.plaque : null;
  let s = pq ? { ...spec, plaque: undefined } : spec;
  let t = 0;
  if (ying) {
    const r = r0;
    t = clamp(r.overhang + r.colDia * 0.6, 0.45, 1.25);
    s = {
      ...s, left: 'open', right: 'open', roof: { gableWallMat: spec.gableMat || 'wall_red', ...spec.roof, gableThick: t },
      platform: spec.platform === false ? false : { w: r.eaveW + 0.24, ...(spec.platform || {}) },
    };
  }
  const info = buildHall(ctx, s);
  if (ying) {
    const r = info.spec;
    const hw = r.eaveW / 2, d = r.eaveD - 0.5;
    const y0 = info.platformTop, y1 = info.eaveY + 0.05, bh = Math.min(1.0, (y1 - y0) * 0.3);
    const wallMat = spec.gableMat || 'wall_red';
    for (const sx of [-1, 1]) {
      const xc = sx * (hw - t / 2);
      const g1 = boxGeo(t + 0.06, bh, d + 0.06); g1.translate(xc, y0 + bh / 2, 0);
      ctx.add('brick_grey', g1);
      const g2 = boxGeo(t, y1 - y0 - bh, d); g2.translate(xc, y0 + bh + (y1 - y0 - bh) / 2, 0);
      ctx.add(wallMat, g2);
    }
  }
  if (pq && info.plaqueAt) {
    const r = info.spec, vertical = spec.plaqueVertical ?? false;
    const ch = spec.plaqueCharH ?? clamp(r.bays[Math.floor(r.bays.length / 2)] * 0.07, 0.22, 0.34);
    const h = plaqueSize(pq, vertical).h * ch;
    plaque(ctx, pq, 0, info.plaqueAt.y - h * 0.62, info.plaqueAt.z + r.colDia * 0.55 + 0.08, ch, vertical);
  }
  return info;
}
/** 竖匾（蓝底金字），挂于 (x,y,z) 处额枋前，略前倾 */
function plaque(ctx, text, x, y, z, ch = 0.4, vertical = false) {
  const sz = plaqueSize(text, vertical), w = sz.w * ch, h = sz.h * ch;
  const c = ctx.at(x, y + h * 0.12, z).rot(-0.12, 0, 0);
  const face = new THREE.PlaneGeometry(w, h); face.translate(0, 0, 0.06);
  c.add(makePlaque(text, { vertical, style: 'blue' }), face);
  c.add('board_red', boxGeo(w * 0.98, h * 0.98, 0.1));
}
/**
 * 小式（无斗拱）建筑檐檩修正：core/building.js 中檐檩圆柱 rotateZ 后 translate(-L/2) 方向反了，
 * 导致檐檩整体偏出建筑一个 L（悬空横杆）。这里用代理 batcher 把这类几何平移回原位（core 修复后条件不再成立，自动失效）。
 */
function purlinFix(ctx) {
  const real = ctx.batcher;
  const proxy = {
    addGeometry(mat, geo, m) {
      if (mat === 'beam_xuanzi' && geo && geo.type === 'CylinderGeometry') {
        if (!geo.boundingBox) geo.computeBoundingBox();
        const bb = geo.boundingBox, L = bb.max.x - bb.min.x;
        if (bb.max.x < -0.05 && Math.abs(bb.min.x - 3 * bb.max.x) < 0.02 * L + 0.01) { geo = geo.clone(); geo.translate(L, 0, 0); }
      }
      real.addGeometry(mat, geo, m);
    },
    addInstance: (k, m) => real.addInstance(k, m),
  };
  return new Ctx(proxy, ctx.m);
}
/** 函数覆盖工厂：items（世界坐标定位的 spec 列表，可带 build 自定义构建器），meta {name, desc, noLabel, extra(ctx, api)} */
function F(items, meta = {}) {
  return (ctx0, b, api) => {
    const ctx = purlinFix(ctx0);
    let top = 0;
    for (const it of items) {
      const { x, z, rotY = 0, y0 = 0, build = hall, ...spec } = it;
      const info = build(ctx.at(x, y0, z, rotY), spec, ctx) || {};
      top = Math.max(top, (info.topY ?? 6) + y0);
    }
    if (meta.extra) meta.extra(ctx, api, b);
    const name = meta.name ?? b.tags.name;
    if (name && !meta.noLabel) api.label(name, meta.lx ?? b.obb.cx, top + 2, meta.lz ?? b.obb.cz, meta.desc || '');
  };
}
/** 单体便捷：OSM 外框 + 预设 */
const one = (id, face, base, o = {}, meta = {}) => F([{ ...O(id, face), ...mk(base, o) }], meta);

/** 墙门：琉璃门 / 随墙门（OSM 轮廓即门垛范围） */
function gate(type, face, o = {}, meta = {}) {
  return (ctx, b, api) => {
    const ob = b.obb, ns = face === 'S' || face === 'N';
    const w = o.w ?? (ns ? ob.sx : ob.sz);
    const r = buildWallGate(ctx.at(o.x ?? ob.cx, 0, o.z ?? ob.cz, ROT[face]), { type, w, tile: 'yellow', ...o });
    if (meta.extra) meta.extra(ctx, api, b);
    const name = meta.name ?? b.tags.name;
    if (name && !meta.noLabel) api.label(name, ob.cx, (r?.top ?? 7) + 1.5, ob.cz, meta.desc || '');
  };
}
const LIULI = (h = 8.0, o = {}) => ({ h, wallThick: 1.3, wallH: 6.0, roof: 'xieshan', doorW: 2.2, doorH: 3.4, ...o });
const SUIQ = (h = 6.6, o = {}) => ({ h, wallThick: 1.3, doorW: 1.6, doorH: 3.0, ...o });

/** 木影壁（养心门内）：石座、红漆木框、绿心板、上覆小卷棚顶，两侧戗柱 */
function muYingbi(ctx, w = 6.2, h = 3.6) {
  const base = boxGeo(w + 0.4, 0.45, 0.9); base.translate(0, 0.225, 0); ctx.add('stone_grey', base);
  for (const s of [-1, 1]) {
    const p = boxGeo(0.26, h, 0.26); p.translate(s * w / 2, 0.45 + h / 2, 0); ctx.add('wood_red', p);
    for (const sz of [-1, 1]) {
      const q = boxGeo(0.14, 1.9, 0.14); q.rotateX(sz * 0.5); q.translate(s * w / 2, 0.45 + 0.85, sz * 0.45); ctx.add('wood_red', q);
    }
  }
  const panel = boxGeo(w - 0.26, h - 0.9, 0.12); panel.translate(0, 0.45 + 0.3 + (h - 0.9) / 2, 0); ctx.add('board_green', panel);
  for (const yy of [0.45 + 0.3, 0.45 + h - 0.6]) { const r = boxGeo(w - 0.26, 0.18, 0.2); r.translate(0, yy, 0); ctx.add('wood_red', r); }
  const lintel = boxGeo(w + 0.5, 0.42, 0.3); lintel.translate(0, 0.45 + h - 0.2, 0); ctx.add('beam_sushi', lintel);
  const cap = boxGeo(w + 1.0, 0.16, 0.9); cap.translate(0, 0.45 + h + 0.08, 0); ctx.add('board_red', cap);
  const roof = new THREE.CylinderGeometry(0.45, 0.45, w + 1.0, 12, 1, false, 0, PI); roof.rotateZ(PI / 2);
  roof.scale(1, 0.55, 1); roof.translate(0, 0.45 + h + 0.16, 0);
  ctx.add('glaze_yellow', roof);
}

// ============================================================
//                         覆盖表
// ============================================================
const ov = {};
const set = (id, v) => { ov[id] = v; };

// ---------------- 养心殿 ----------------
set(40606461, F([{
  ...O(40606461, 'S'), grade: 3, nBays: 9, nDepth: 3, colH: 5.0, dougong: { kou: 0.075, cai: 5 }, caihua: 'hexi', lattice: 'shuangjiao',
  roof: { type: 'xieshan', beasts: 7 }, platform: { h: 0.9, style: 'plain', stairs: [] },
  front: ['window', 'window', 'window', 'window', 'door', 'window', 'window', 'window', 'window'],
  back: ['wall', 'wall', 'wall', 'wall', 'door', 'wall', 'wall', 'wall', 'wall'],
}], { desc: '雍正以后清帝寝宫与日常理政之所。工字殿：前殿面阔三间（檐柱间加方柱，外观九间，含东西暖阁），黄琉璃瓦单檐歇山，明间与西次间前接卷棚抱厦；后殿为寝宫，东西耳房为体顺堂、燕禧堂。' }));
// 前殿抱厦：OSM 轮廓只到前殿檐口，向后延至前殿檐柱；明间（x≈-108.1）设门与匾
set(688124109, F([{
  ...R(-124.7, -100.5, -173.4, -182.4, 'S'), grade: 4, bays: [4.55, 4.55, 4.55, 4.1, 4.65], depthBays: [3.6, 3.6], colH: 3.5, dougong: false, caihua: 'hexi', lattice: 'shuangjiao',
  roof: { type: 'xieshan', juan: true, beasts: 3 }, platform: { h: 0.9, style: 'plain', stairs: [{ side: 'S', x: 4.5, w: 3.6 }] },
  front: ['window', 'window', 'window', 'door', 'window'], back: 'open', left: 'wall', right: 'window',
}], {
  noLabel: true,
  extra: (ctx) => plaque(ctx, '养心殿', -108.1, 0.9 + 3.5 - 0.62, -173.4 - 0.9 + 0.3, 0.45),
}));
// 穿堂：连接前殿与后殿（南北向卷棚）
set(43512263, F([{
  ...R(-111.6, -104.6, -192.4, -198.4, 'E'), grade: 5, nBays: 1, nDepth: 1, colH: 3.0, overhang: 0.5, dougong: false, caihua: 'xuanzi',
  roof: { type: 'xuanshan', juan: true, beasts: -1 }, platform: { h: 0.9, style: 'plain', stairs: [] }, front: 'window', back: 'window', left: 'open', right: 'open',
}], { noLabel: true }));
set(40606459, one(40606459, 'S', HOU, { colH: 3.8 }, { name: '养心殿后殿', desc: '养心殿后殿，皇帝寝宫，面阔五间，东西梢间为寝室。' }));
set(40606458, one(40606458, 'S', HOU, { colH: 3.3, plaque: '燕禧堂' }, { desc: '养心殿后殿西耳房，面阔五间，妃嫔随侍居所。' }));
set(40606460, one(40606460, 'S', HOU, { colH: 3.3, plaque: '体顺堂' }, { desc: '养心殿后殿东耳房，面阔五间，皇后随侍居所。' }));
set(40606456, one(40606456, 'E', PEI, { nBays: 5, colH: 3.5, front: fr(5, 'window', 1) }, { name: '养心殿西配殿' }));
set(40606457, one(40606457, 'W', PEI, { nBays: 5, colH: 3.5, front: fr(5, 'window', 1) }, { name: '养心殿东配殿' }));
set(40606452, one(40606452, 'E', WEI(41.5), {}, { name: '养心殿西围房' }));
set(40606455, one(40606455, 'W', WEI(42.1), {}, { name: '养心殿东围房' }));
// 养心门：黄琉璃门，门前鎏金铜狮一对，门内木影壁
set(42509102, gate('liuli', 'S', LIULI(9.0, { w: 11.0, doorW: 3.0, doorH: 4.0, wallThick: 1.3, wallH: 7 }), {
  desc: '养心殿正门，黄琉璃瓦歇山顶琉璃门，门前一对鎏金铜狮，门内立木影壁。',
  extra: (ctx) => {
    ctx.place('lion:m:gilt', -104.6, 0, -157.4, 0, 2.6);
    ctx.place('lion:f:gilt', -112.5, 0, -157.4, 0, 2.6);
    muYingbi(ctx.at(-108.5, 0, -167.0, PI), 6.4, 3.6);
  },
}));
// 养心门外院值房、御膳房、南库
set(40606453, F([
  { ...R(-146.4, -125.6, -155.4, -160.2, 'S'), ...WEI(20.8) },
  { ...R(-146.4, -125.8, -146.2, -149.6, 'N'), ...WEI(20.6, { colH: 2.7 }) },
  { ...R(-146.4, -142.7, -149.6, -155.4, 'E'), ...mk(ER, { nBays: 1 }) },
], { noLabel: true }));
set(40606454, F([
  { ...R(-94.1, -71.1, -146.0, -149.4, 'N'), ...WEI(23.0, { colH: 2.7 }) },
  { ...R(-74.9, -71.0, -149.4, -156.4, 'W'), ...mk(ER, { nBays: 1 }) },
], { noLabel: true }));
set(688124111, one(688124111, 'S', ER, { colH: 2.5, roof: { juan: true, beasts: -1 } }, { noLabel: true }));
set(40606451, one(40606451, 'N', WEI(75.5), {}, { desc: '养心殿御膳房，位于养心殿南，长排硬山。' }));
set(40606450, one(40606450, 'S', WEI(33.4, { colH: 3.4, nDepth: 3, corridor: 1.2, backCorridor: false, grade: 4 }), {}, { desc: '养心殿南库。' }));
set(40606449, one(40606449, 'S', WEI(32.6, { colH: 3.4, nDepth: 3, corridor: 1.2, backCorridor: false, grade: 4 }), {}, { noLabel: true }));
set(42509080, gate('suiqiang', 'E', SUIQ(6.4), { noLabel: true }));

// ---------------- 西二长街及街门 ----------------
set(42450626, gate('liuli', 'S', LIULI(7.6, { wallThick: 1.4, wallH: 7 }), { desc: '西二长街南端街门，黄琉璃门。“螽斯”取《诗经》子孙众多之意，与北端百子门相应。' }));
set(42450637, gate('liuli', 'N', LIULI(7.0, { doorW: 1.8, doorH: 3.0 }), { desc: '西二长街北端街门，黄琉璃门。' }));
set(42450627, gate('suiqiang', 'W', SUIQ(7.4, { wallThick: 1.4 }), {}));
set(42450628, gate('suiqiang', 'E', SUIQ(7.4, { wallThick: 1.4 }), {}));
for (const [id, face] of [[42509114, 'W'], [42509115, 'E'], [42509116, 'E'], [42509111, 'W']]) set(id, gate('suiqiang', face, SUIQ(6.6), {}));
set(688124104, 'skip'); // 螽斯门内侧零碎小屋（与门垛重叠）

// ---------------- 太极殿（启祥宫） ----------------
set(40631788, one(40631788, 'S', QIAN, { backCorridor: true, lattice: 'bubujin', plaque: '太极殿' }, { desc: '原名未央宫、启祥宫，西六宫之一，晚清改称太极殿。面阔五间单檐歇山，前后出廊，外檐苏式彩画；光绪年间后殿改为体元殿与长春宫连通。' }));
set(40631789, one(40631789, 'S', HOU, { colH: 3.8, back: ['wall', 'door', 'door', 'door', 'wall'], front: fr(5, 'window', 1), plaque: '体元殿', roof: { beasts: 3 } }, { desc: '原长春宫宫门（长春门），晚清改建为殿，前后开门，连通太极殿与长春宫；后檐接抱厦三间为戏台。' }));
set(1205187964, F([{
  ...R(-159.3, -142.2, -264.7, -272.6, 'N'), kind: 'pavilion', bench: false, grade: 4, nBays: 3, nDepth: 2, colH: 3.3, overhang: 0.9, dougong: false, caihua: 'sushi',
  roof: { type: 'xieshan', juan: true, beasts: 3 }, platform: { h: 1.1, style: 'stone', stairs: [] },
}], { desc: '体元殿后檐抱厦三间，坐南面北正对长春宫，黄琉璃瓦卷棚歇山顶，慈禧居长春宫时于此观戏。' }));
set(40631793, one(40631793, 'E', PEI, {}, { name: '太极殿西配殿' }));
set(40631797, F([{ ...R(-135.1, -126.2, -217.6, -232.6, 'W'), ...PEI }], {
  name: '太极殿东配殿',
  extra: (ctx) => buildWallGate(ctx.at(-130.9, 0, -213.85, 0), { type: 'suiqiang', w: 5.2, h: 7.4, wallThick: 1.4, doorW: 1.8, doorH: 3.2, tile: 'yellow' }),
}));
set(40631792, one(40631792, 'E', ER, { nBays: 3 }, { noLabel: true }));
set(40631796, one(40631796, 'W', ER, { nBays: 3 }, { noLabel: true }));
set(40631794, one(40631794, 'E', PEI, {}, { noLabel: true }));
set(40631790, one(40631790, 'W', PEI, {}, { noLabel: true }));
set(40631795, one(40631795, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(40631791, one(40631791, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(42450622, gate('liuli', 'S', LIULI(8.4, { w: 6.1, wallThick: 1.6, wallH: 7 }), { desc: '太极殿（启祥宫）宫门，黄琉璃门。' }));

// ---------------- 长春宫 ----------------
set(40631798, one(40631798, 'S', QIAN, { lattice: 'bubujin', plaque: '长春宫' }, { desc: '西六宫之一，慈禧曾居此十余年。面阔五间单檐歇山，前出廊；殿前设铜龟、铜鹤各一对；院内四角转角廊壁绘《红楼梦》题材巨幅壁画十八幅。' }));
set(40631802, one(40631802, 'E', PEI, { plaque: '承禧殿' }, { desc: '长春宫西配殿，面阔三间，前出廊，与转角廊相连。' }));
set(40631805, one(40631805, 'W', PEI, { plaque: '绥寿殿' }, { desc: '长春宫东配殿，面阔三间，前出廊，与转角廊相连。' }));
set(40631803, one(40631803, 'E', PEI, {}, { desc: '长春宫后院西配殿。' }));
set(40631800, one(40631800, 'W', PEI, {}, { desc: '长春宫后院东配殿。' }));
set(40631799, one(40631799, 'S', HOU, { plaque: '怡情书史' }, { desc: '长春宫后殿，面阔五间，硬山顶。' }));
set(40631804, one(40631804, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(40631801, one(40631801, 'S', ER, { nBays: 3 }, { noLabel: true }));
// 井亭：四柱盝顶，顶心开口
set(1205187965, F([{
  ...O(1205187965, 'S'), kind: 'pavilion', bench: false, grade: 5, nBays: 1, nDepth: 1, colH: 2.6, overhang: 0.55, dougong: false, caihua: 'xuanzi',
  roof: { type: 'skirt', inner: { w: 1.3, d: 1.0 }, rise: 0.6, beasts: -1 }, platform: { h: 0.3, style: 'stone', stairs: [] },
}], {
  desc: '长春宫后院井亭，四柱盝顶，顶心开口。',
  extra: (ctx) => { const o = buildingById.get(1205187965).obb; ctx.addAt('stone_grey', latheGeo([[0.55, 0], [0.55, 0.65], [0.38, 0.68], [0.36, 0.3]], 16), o.cx, 0.3, o.cz); },
}));
// 四角转角廊（廊内壁绘《红楼梦》壁画）
const MURAL = { wallMat: 'wi_mural' };
set(42509095, F([GAL(-168.7, -162.2, -261.8, -264.6, 'N', MURAL), GAL(-168.6, -164.8, -264.1, -266.6, 'E', MURAL)], { noLabel: true }));
set(42509094, F([GAL(-136.5, -131.3, -261.9, -264.4, 'N', MURAL), GAL(-134.7, -131.2, -263.9, -267.1, 'W', MURAL)], { noLabel: true }));
set(42509096, F([GAL(-168.6, -164.9, -280.4, -286.7, 'E', MURAL), GAL(-165.2, -162.6, -283.4, -286.6, 'S', MURAL)], { noLabel: true }));
set(42509097, F([GAL(-134.3, -131.0, -281.4, -287.1, 'W', MURAL), GAL(-136.3, -134.0, -283.4, -287.2, 'S', MURAL)], { noLabel: true }));

// ---------------- 咸福宫 ----------------
set(40631832, one(40631832, 'S', QIAN, {
  nBays: 3, corridor: 1.8, backCorridor: true, caihua: 'hexi', dougong: { kou: 0.075, cai: 5 }, colH: 4.6, roof: { type: 'wudian' },
  front: ['window', 'door', 'window'], back: ['wall', 'door', 'wall'], plaque: '咸福宫',
}, { desc: '西六宫之一，前殿面阔三间，黄琉璃瓦单檐庑殿顶（西六宫中唯一庑殿顶），前后出廊，檐下五踩斗拱。' }));
set(40631833, one(40631833, 'S', HOU, { plaque: '同道堂' }, { desc: '咸福宫后殿，面阔五间硬山。咸丰帝曾居此，“同道堂”印即源于此。' }));
set(40631836, one(40631836, 'E', PEI, {}, { noLabel: true }));
set(40631837, one(40631837, 'W', PEI, {}, { noLabel: true }));
set(40631834, one(40631834, 'E', PEI, {}, { noLabel: true }));
set(40631835, one(40631835, 'W', PEI, {}, { noLabel: true }));
set(40631838, one(40631838, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(40631839, one(40631839, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(42450624, gate('liuli', 'S', LIULI(8.0), { desc: '咸福宫宫门，黄琉璃门。' }));

// ---------------- 永寿宫 ----------------
set(40631817, one(40631817, 'S', QIAN, { caihua: 'hexi', dougong: { kou: 0.075, cai: 5 }, colH: 4.6, plaque: '永寿宫' }, { desc: '明永乐十八年建，西六宫之一。面阔五间，黄琉璃瓦单檐歇山顶，前出廊，檐下单翘单昂五踩斗拱，龙凤和玺彩画。' }));
set(40631818, one(40631818, 'E', PEI, {}, { noLabel: true }));
set(40631819, one(40631819, 'W', PEI, {}, { noLabel: true }));
set(40631816, one(40631816, 'E', PEI, {}, { noLabel: true }));
set(40631821, one(40631821, 'W', PEI, {}, { noLabel: true }));
set(40631822, one(40631822, 'S', HOU, { colH: 3.9, corridor: 1.6 }, { name: '永寿宫后殿', desc: '永寿宫后殿，面阔五间硬山，前出廊。' }));
set(40631823, one(40631823, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(40631820, one(40631820, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(42450632, gate('liuli', 'S', LIULI(8.4, { wallThick: 1.4, wallH: 7 }), { desc: '永寿宫宫门，黄琉璃门。' }));

// ---------------- 翊坤宫 ----------------
set(40631806, one(40631806, 'S', QIAN, {
  backCorridor: true, lattice: 'bubujin', front: ['zhizhai', 'zhizhai', 'door', 'zhizhai', 'zhizhai'], plaque: '翊坤宫',
}, { desc: '西六宫之一，慈禧曾居。面阔五间单檐歇山，前后出廊，苏式彩画，万字锦底隔扇门、步步锦支摘窗；台基下陈铜凤、铜鹤、铜炉各一对。' }));
set(40631808, one(40631808, 'E', PEI, {}, { name: '元和殿', desc: '翊坤宫西配殿。' }));
set(40631810, one(40631810, 'W', PEI, {}, { name: '延洪殿', desc: '翊坤宫东配殿。' }));
set(40631814, one(40631814, 'E', ER, { nBays: 3 }, { noLabel: true }));
set(40631809, one(40631809, 'E', PEI, {}, { noLabel: true }));
set(40631812, one(40631812, 'S', HOU, {
  colH: 3.9, front: fr(5, 'window', 1), back: ['wall', 'wall', 'door', 'wall', 'wall'], plaque: '体和殿',
  platform: { stairs: [{ side: 'S', w: 3.6 }, { side: 'N', w: 3.6 }] },
}, { desc: '原翊坤宫后殿，光绪十年改为穿堂殿，前后开门，连通翊坤宫与储秀宫；慈禧在此用膳。' }));
set(40631811, one(40631811, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(40631813, one(40631813, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(42450634, gate('liuli', 'S', LIULI(8.0), { desc: '翊坤宫宫门，黄琉璃门。' }));

// ---------------- 储秀宫 ----------------
set(40631826, one(40631826, 'S', QIAN, {
  lattice: 'bubujin', front: ['zhizhai', 'zhizhai', 'door', 'zhizhai', 'zhizhai'], platform: { h: 1.3 }, plaque: '储秀宫',
}, { desc: '西六宫之一，光绪十年为慈禧五十寿辰重修并居此。面阔五间单檐歇山，前出廊，苏式彩画，楠木雕万字锦底、五蝠捧寿隔扇；台基下设铜龙、铜梅花鹿各一对。' }));
set(40631824, one(40631824, 'E', PEI, {}, { name: '养和殿', desc: '储秀宫西配殿。' }));
set(40631829, one(40631829, 'W', PEI, {}, { name: '缓福殿', desc: '储秀宫东配殿。' }));
set(40631827, one(40631827, 'E', PEI, {}, { noLabel: true }));
set(40631830, one(40631830, 'W', PEI, {}, { noLabel: true }));
set(40631828, one(40631828, 'S', HOU, { plaque: '丽景轩' }, { desc: '储秀宫后殿，面阔五间硬山，同治帝生于此。' }));
set(40631831, one(40631831, 'S', ER, { nBays: 3 }, { noLabel: true }));
set(40631825, one(40631825, 'S', ER, { nBays: 3 }, { noLabel: true }));

// ---------------- 重华宫（乾西二所） ----------------
set(42348538, gate('liuli', 'S', LIULI(7.6), { desc: '重华宫宫门，黄琉璃门。' }));
set(40632237, F([
  { ...R(-129.0, -107.75, -382.15, -391.9, 'S'), ...mk(HOU, { colH: 3.8, nDepth: 2, corridor: 0, front: ['window', 'door', 'door', 'door', 'window'], platform: { h: 0.7, stairs: [] } }) },
  {
    ...R(-123.9, -112.9, -379.6, -383.4, 'S'), kind: 'pavilion', bench: false, grade: 4, nBays: 3, nDepth: 1, colH: 2.6, overhang: 0.6, dougong: false, caihua: 'sushi',
    roof: { type: 'xieshan', juan: true, beasts: 1, rise: 1.0 }, platform: { h: 0.7, style: 'plain', stairs: [{ side: 'S', w: 3.2 }] }, plaque: '崇敬殿', plaqueVertical: false, plaqueCharH: 0.28,
  },
], { desc: '重华宫前殿，面阔五间硬山，前接卷棚抱厦三间。' }));
set(40632238, one(40632238, 'S', HOU, { grade: 3, dougong: false, colH: 3.9, plaque: '重华宫', roof: { beasts: 5 } }, { desc: '原乾西二所，乾隆为皇子时居所，即位后升为宫。正殿面阔五间黄琉璃瓦硬山，前出廊；乾隆起每年正月在此举行茶宴联句。' }));
set(40632239, one(40632239, 'S', HOU, { plaque: '翠云馆' }, { desc: '重华宫后殿，面阔五间硬山。' }));
set(40632233, one(40632233, 'E', PEI, { plaque: '浴德殿' }, { desc: '重华宫西配殿。' }));
set(40632232, one(40632232, 'W', PEI, { plaque: '葆中殿' }, { desc: '重华宫东配殿。' }));
set(40632230, one(40632230, 'E', ER, { nBays: 3 }, { noLabel: true }));
set(40632231, one(40632231, 'W', ER, { nBays: 3 }, { noLabel: true }));
set(40632234, one(40632234, 'E', ER, { nBays: 3 }, { noLabel: true }));
set(40632235, one(40632235, 'W', ER, { nBays: 3 }, { noLabel: true }));
set(40632236, one(40632236, 'E', ER, { nBays: 3 }, { noLabel: true }));
set(42353086, one(42353086, 'E', ER, { nBays: 1 }, { noLabel: true }));
set(42353093, one(42353093, 'W', ER, { nBays: 1 }, { noLabel: true }));
set(42353087, one(42353087, 'S', ER, { nBays: 1 }, { noLabel: true }));
set(42353088, one(42353088, 'S', ER, { nBays: 1 }, { noLabel: true }));
set(42353092, one(42353092, 'W', ER, { nBays: 1 }, { noLabel: true }));
set(42353095, one(42353095, 'W', ER, { nBays: 1 }, { noLabel: true }));
for (const id of [42353081, 42353084]) set(id, one(id, 'S', ER, { nBays: 1, colH: 2.6 }, { noLabel: true }));
for (const id of [42353082, 42353083]) set(id, one(id, 'N', ER, { nBays: 1, colH: 2.6 }, { noLabel: true }));

// ---------------- 乾西三所（重华宫西） ----------------
set(42348537, gate('liuli', 'S', LIULI(7.0, { doorW: 2.0 }), { noLabel: true }));
set(40632224, one(40632224, 'S', HOU, {}, { noLabel: true }));
set(40632223, one(40632223, 'S', HOU, { nDepth: 1, corridor: 0, colH: 3.3 }, { noLabel: true }));
set(40632222, one(40632222, 'S', HOU, { nDepth: 1, corridor: 0, colH: 3.3 }, { noLabel: true }));
set(40632225, one(40632225, 'E', PEI, {}, { noLabel: true }));
set(40632226, one(40632226, 'W', PEI, {}, { noLabel: true }));
set(40632227, one(40632227, 'W', ER, { nBays: 3 }, { noLabel: true }));
set(40632228, one(40632228, 'E', ER, { nBays: 3 }, { noLabel: true }));
set(40632229, one(40632229, 'E', ER, { nBays: 5 }, { noLabel: true }));
set(42353080, one(42353080, 'E', ER, { nBays: 5 }, { noLabel: true }));
set(42353085, one(42353085, 'E', ER, { nBays: 1 }, { noLabel: true }));

// ---------------- 漱芳斋（乾西头所） ----------------
set(40632242, F([
  { ...R(-96.6, -75.0, -403.3, -412.6, 'S'), ...mk(HOU, { colH: 3.9, corridor: 1.6, plaque: '漱芳斋', back: ['wall', 'wall', 'door', 'wall', 'wall'], platform: { h: 0.7 } }) },
  { ...R(-89.1, -82.6, -411.6, -417.2, 'E'), grade: 5, nBays: 1, nDepth: 1, colH: 3.0, overhang: 0.5, dougong: false, caihua: 'sushi', roof: { type: 'xuanshan', juan: true, beasts: -1 }, platform: { h: 0.7, style: 'plain', stairs: [] }, front: 'window', back: 'window', left: 'open', right: 'open' },
  { ...R(-96.4, -74.6, -416.2, -424.5, 'S'), ...mk(HOU, { colH: 3.7, plaque: '金昭玉粹', front: ['window', 'window', 'wall', 'window', 'window'], platform: { h: 0.7, stairs: [] } }) },
], { desc: '原乾西头所，乾隆时改建。前殿漱芳斋与后殿金昭玉粹以穿堂相连成工字形，四周游廊环绕；院南有宫中最大的单层戏台。' }));
set(40632241, F([
  { ...R(-96.8, -75.1, -380.9, -390.6, 'N'), ...mk(HOU, { nDepth: 1, corridor: 0, colH: 3.6, front: ['window', 'door', 'wall', 'door', 'window'], back: 'wall', platform: { h: 0.5, stairs: [] } }) },
  {
    ...R(-91.7, -79.8, -388.8, -398.8, 'N'), kind: 'pavilion', bench: false, grade: 4, nBays: 3, nDepth: 3, colH: 3.8, overhang: 1.0, dougong: false, caihua: 'sushi',
    roof: { type: 'xieshan', beasts: 3 }, platform: { h: 1.2, style: 'stone', stairs: [] },
  },
], { name: '漱芳斋戏台', desc: '漱芳斋院内戏台，坐南面北正对漱芳斋，方亭式黄琉璃瓦单檐歇山，后接扮戏房，为宫中最大的单层戏台。' }));
set(42353090, F([
  GAL(-101.8, -98.3, -386.4, -403.4, 'E', { back: 'wall' }),
  GAL(-73.4, -69.5, -385.4, -404.9, 'W', { back: 'wall' }),
  GAL(-101.6, -96.4, -403.0, -407.3, 'S', { back: 'wall' }),
  GAL(-75.2, -69.5, -403.0, -407.0, 'S', { back: 'wall' }),
], { noLabel: true }));
set(40632240, one(40632240, 'N', WEI(23.4, { nBays: 7, front: fr(7, 'zhizhai', 1) }), {}, { noLabel: true }));

// ---------------- 北端：西长房等 ----------------
set(40606306, one(40606306, 'S', WEI(115.8, { colH: 3.4, nDepth: 3, corridor: 1.3, backCorridor: false, grade: 4, roof: { beasts: 3 } }), {}, { desc: '紫禁城西北隅长排值房、库房，黄琉璃瓦硬山。' }));
set(40606304, one(40606304, 'N', WEI(41.7), {}, { noLabel: true }));
set(40606305, one(40606305, 'N', WEI(42.6), {}, { noLabel: true }));
for (const id of [42311943, 42311944, 42311945]) set(id, one(id, 'S', ER, {}, { noLabel: true }));

// ============================================================
//                         附加内容
// ============================================================
/** 甬路（略高于地面的石板带）：[x0,x1,z0,z1] */
const PAVING = [
  [-109.4, -106.8, -163.4, -172.0], // 养心门 → 抱厦
  [-123.3, -120.3, -215.2, -364.2], // 西二长街
  [-95.9, -93.3, -214.9, -232.5], // 永寿门 → 永寿宫
  [-95.1, -92.5, -270.9, -284.4], // 翊坤门 → 翊坤宫
  [-95.4, -92.8, -322.4, -335.6], // 体和殿 → 储秀宫
  [-140.2, -137.6, -215.7, -221.4], [-150.9, -137.6, -218.8, -221.4], [-150.9, -148.3, -218.8, -231.2], // 启祥门 → 太极殿
  [-150.9, -148.3, -248.4, -251.0], // 太极殿 → 体元殿
  [-150.8, -148.2, -272.6, -282.2], // 戏台 → 长春宫
  [-151.0, -148.4, -319.6, -330.9], // 咸福门 → 咸福宫
  [-120.4, -117.8, -371.6, -378.0], // 重华门 → 崇敬殿
  [-119.6, -117.0, -392.0, -403.0], // 崇敬殿 → 重华宫
  [-153.0, -150.4, -371.6, -380.6], // 三所门 → 前殿
];
/** 树木：[种, 变体, x, z, 高] */
const TREES = [
  ['cypress', 0, -105.0, -325.0, 9.5], ['cypress', 2, -83.2, -325.0, 9], // 储秀宫院
  ['pine', 1, -156.8, -300.4, 9], ['pine', 3, -131.0, -293.0, 8], // 长春宫后院
  ['locust', 0, -102.5, -304.3, 13], ['locust', 2, -85.0, -304.3, 12], // 翊坤宫后院
  ['cypress', 1, -157.0, -322.6, 9.5], ['cypress', 3, -141.0, -322.6, 9.5], // 咸福宫院
  ['locust', 1, -104.0, -221.5, 13], ['locust', 3, -84.5, -221.5, 12.5], // 永寿宫院
  ['pine', 0, -124.6, -398.0, 8.5], ['pine', 2, -112.0, -398.0, 8], // 重华宫院
  ['locust', 2, -157.0, -376.0, 12], // 乾西三所
];

export default {
  key: 'west_inner',
  title: '养心殿与西六宫',
  overrides: ov,
  wallOverrides: {},
  bridgeOverrides: {},
  build(ctx, api) {
    // 甬路
    for (const [x0, x1, z0, z1] of PAVING) ctx.add('paving_imperial', prismGeo([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, 0.07));
    // 陈设：长春宫铜龟、铜鹤
    for (const s of [-1, 1]) {
      ctx.place('tortoise', -149.4 + s * 4.4, 0, -279.4, 0, 1.9);
      ctx.place('crane', -149.4 + s * 7.8, 0, -279.6, 0, 2.4);
    }
    // 翊坤宫：铜凤、铜鹤、铜炉各一对
    for (const s of [-1, 1]) {
      ctx.place('wi_phoenix', -93.4 + s * 3.8, 0, -282.6, 0, 2.2);
      ctx.place('crane', -93.4 + s * 6.6, 0, -282.8, 0, 2.4);
      ctx.place('censer:ding', -93.4 + s * 9.6, 0, -282.8, 0, 1.8);
    }
    // 储秀宫：铜龙、铜梅花鹿各一对
    for (const s of [-1, 1]) {
      ctx.place('wi_dragon', -94.1 + s * 4.6, 0, -334.0, 0, 2.3);
      ctx.place('wi_deer', -94.1 + s * 8.4, 0, -334.0, -s * 0.25, 2.0);
    }
    // 树木
    for (const [k, v, x, z, h] of TREES) ctx.place(`tree:${k}:${v}`, x, 0, z, (x * 7 + z) % 6.28, h);
    api.label('西二长街', -121.8, 9, -290, '西六宫东西两列之间的南北向长街，南端螽斯门、北端百子门，两侧随墙门通各宫。');
  },
};
