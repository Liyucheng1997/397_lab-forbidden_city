// 分区：东六宫区（东六宫、东一/东二长街、斋宫、毓庆宫、奉先殿、天穹宝殿、乾东五所）
// 坐标：x 东、z 南（北 = -z），米；rotY 朝南 0 / 朝北 π / 朝东 +π/2 / 朝西 -π/2。
import * as THREE from 'three';
import { buildHall, buildTower, buildGallery } from '../core/building.js';
import { buildRoof } from '../core/roof.js';
import { buildPlatform, buildXumizuo } from '../core/platform.js';
import { buildWallGate, buildPalaceWall } from '../core/walls.js';
import { boxGeo, cylGeo, prismGeo, latheGeo } from '../core/geom.js';
import { makePlaque, plaqueSize } from '../core/plaque.js';
import { propHeight } from '../core/props.js';
import { dougongReach } from '../core/dougong.js';
import { Ctx } from '../core/batcher.js';
import { decompose } from '../site/auto.js';
import { buildLingzhao } from './east_inner/lingzhao.js';

const R = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// ---------------- 构建上下文（规避核心小式檐檩错位） ----------------
// building.js 小式（无斗拱）檐檩：cylGeo 绕 Z 转 +90° 后向 -X 平移 L/2，实际中心落在 x=-L（整根檩条移出一个面阔/进深），
// 在院落上空形成游离的长杆。此处在本分区内识别该几何（beam_xuanzi 圆杆、包围盒中心 x≈-长度）并平移回中心。
// 核心修复后此判据不再命中，自动失效。
class FixCtx extends Ctx {
  at(...a) { const c = super.at(...a); return new FixCtx(c.batcher, c.m); }
  rot(...a) { const c = super.rot(...a); return new FixCtx(c.batcher, c.m); }
  mul(m) { const c = super.mul(m); return new FixCtx(c.batcher, c.m); }
  add(mat, geo, local) {
    if (mat === 'beam_xuanzi' && geo && !local) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox, L = bb.max.x - bb.min.x, cx = (bb.max.x + bb.min.x) / 2;
      if (L > 1 && L > 4 * (bb.max.y - bb.min.y) && Math.abs(cx + L) < 1e-3 * L) { geo = geo.clone(); geo.translate(L, 0, 0); }
    }
    super.add(mat, geo, local);
  }
}
const fix = (ctx) => (ctx instanceof FixCtx ? ctx : new FixCtx(ctx.batcher, ctx.m));

/** 匾额：悬于正面明间、斗拱之前，上沿抵挑檐桁 */
function hallPlaque(ctx, text, info) {
  const s = info.spec, at = info.plaqueAt;
  if (!at) return;
  const reach = s.dougong ? dougongReach(s.dougong.cai) * s.dougong.kou : 0;
  const eaveY = info.upperEaveY ?? info.eaveY ?? at.y + 0.5;
  const mid = s.bays[Math.floor(s.bays.length / 2)];
  const n = [...text].length, ph = n + (n - 1) * 0.08 + 1.2;
  const beamH = Math.min(1.0, Math.max(0.2, s.colDia * 0.95));
  const avail = eaveY - 0.08 - (at.y - (s.dougong ? 2.0 : 1.2) * beamH);
  const ch = Math.max(0.16, Math.min(mid * 0.1, 0.62, avail / ph));
  const h = ph * ch;
  hangPlaque(ctx, text, eaveY - 0.08 - h / 2, at.z + s.colDia * 0.5 + reach + 0.06, ch);
}
/** buildHall + 自挂匾额 */
function hall(ctx, spec) {
  const { plaque, ...rest } = spec;
  const info = buildHall(ctx, rest);
  if (plaque) hallPlaque(ctx, plaque, info);
  return info;
}

/** 覆盖项 → 函数（统一走 FixCtx，并自行挂匾、加标签） */
function wrapOverride(o) {
  if (o === 'skip') return o;
  if (typeof o === 'function') return (ctx, b, api) => o(fix(ctx), b, api);
  const patch = o || {};
  return (ctx0, b, api) => {
    const ctx = fix(ctx0);
    let items;
    if (Array.isArray(patch)) items = patch.map((it) => ({ type: it.type || 'hall', x: it.x, z: it.z, rotY: it.rotY ?? 0, spec: it }));
    else items = api.autoItems(b).map((it) => ({ ...it, x: patch.x ?? it.x, z: patch.z ?? it.z, rotY: patch.rotY ?? it.rotY, type: patch.type || it.type, spec: api.mergeSpec(it.spec || {}, patch) }));
    let top = 0;
    for (const it of items) {
      if (it.type === 'platform') { api.autoPlatform(ctx, b, it.spec || {}); continue; }
      const y0 = it.spec.y0 ?? 0;
      const info = hall(ctx.at(it.x, y0, it.z, it.rotY), it.spec);
      top = Math.max(top, (info.topY || 8) + y0);
    }
    if (b.tags.name && !patch.noLabel && !Array.isArray(patch)) api.label(b.tags.name, b.obb.cx, top + 2, b.obb.cz, patch.desc || '');
    else if (b.tags.name && Array.isArray(patch) && !patch.some((p) => p.noLabel)) api.label(b.tags.name, b.obb.cx, top + 2, b.obb.cz, patch.find((p) => p.desc)?.desc || '');
  };
}

// ---------------- 形制模板（合并到自动推断 spec 的补丁） ----------------
/** 东六宫前殿：面阔五间、单檐歇山、单翘单昂五踩斗拱、和玺彩画，台明 1m（前接月台） */
const FRONT = (o = {}) => ({ grade: 3, nBays: 5, nDepth: 3, colH: 4.2, roof: { type: 'xieshan' }, platform: { h: 1.0, style: 'stone', margin: 1.9, stairs: [{ side: 'N' }] }, ...o });
/** 后殿：面阔五间硬山、前出廊、旋子彩画 */
const REAR = (o = {}) => ({ grade: 4, nBays: 5, nDepth: 3, corridor: 1.4, backCorridor: false, colH: 4.0, roof: { type: 'yingshan' }, platform: { h: 0.6, style: 'plain' }, ...o });
/** 东西配殿：面阔三间硬山、前出廊 */
const PEI = (o = {}) => ({ grade: 4, nBays: 3, nDepth: 3, corridor: 1.2, backCorridor: false, colH: 3.4, roof: { type: 'yingshan' }, platform: { h: 0.5, style: 'plain' }, ...o });
/** 耳房/值房：三间硬山小式 */
const ER = (o = {}) => ({ grade: 5, nBays: 3, colH: 3.0, roof: { type: 'yingshan' }, platform: { h: 0.35 }, ...o });
/** 乾东五所诸房 */
const SUO = (o = {}) => ({ grade: 4, nBays: 5, colH: 3.4, roof: { type: 'yingshan' }, platform: { h: 0.5 }, noLabel: true, ...o });

// ---------------- 文字说明 ----------------
const D = {
  jingren: '明永乐十八年（1420）建，初名长宁宫，嘉靖十四年（1535）改今名。东六宫之一，二进院；前殿面阔五间，黄琉璃瓦单檐歇山顶，前出月台，门内立石影壁一座。康熙帝生于此宫。',
  chengqian: '明永乐十八年建，初名永宁宫，崇祯五年（1632）改今名。前殿面阔五间，黄琉璃瓦单檐歇山顶，前出月台；院内旧植梨树，“承乾宫梨花”为宫中一景。',
  zhongcui: '明永乐十八年建，初名咸阳宫，嘉靖十四年改今名。前殿面阔五间，黄琉璃瓦单檐歇山顶，前出廊，晚清改绘苏式彩画；光绪朝为隆裕皇后寝宫。',
  yanxi: '明永乐十八年建，初名长寿宫。道光二十五年（1845）焚毁，宣统元年（1909）在原址兴建西洋式水殿“灵沼轩”（俗称水晶宫），汉白玉底层四面临水、铸铁框架、玻璃为窗，因国库空虚未能完工；1931 年于院内北、东、西三面建二层防火文物库房。',
  yonghe: '明永乐十八年建，初名永安宫，嘉靖十四年改今名。前殿面阔五间，前接抱厦三间，黄琉璃瓦歇山顶；后殿同顺斋面阔五间。',
  jingyang: '明永乐十八年建，初名长阳宫，嘉靖十四年改今名。前殿面阔三间，黄琉璃瓦单檐庑殿顶，为东西六宫中唯一的庑殿顶；后殿御书房乾隆时贮藏宋高宗书、马和之画《毛诗》图卷。',
  zhai: '清雍正九年（1731）建，皇帝举行祭天、祭地等大祀前在此斋戒。正殿为工字殿：前殿面阔五间，黄琉璃瓦歇山顶，前出抱厦三间（卷棚歇山）；后殿诚肃殿，以穿堂相连，两侧游廊环绕。',
  chengsu: '斋宫后殿，面阔七间，黄琉璃瓦歇山顶，与前殿以穿堂相连成工字形，为皇帝斋戒期间的寝居之所。',
  dunben: '毓庆宫第二进正殿，面阔五间，黄琉璃瓦单檐歇山顶，东西配殿各三间。',
  yuqing: '清康熙十八年（1679）为皇太子胤礽所建，后为皇子居所，乾隆、嘉庆、光绪等帝曾在此读书。正殿为工字殿：前殿面阔五间，黄琉璃瓦歇山顶，穿廊（槛窗）连后殿继德堂；内檐装修隔断曲折，俗称“小迷宫”。',
  jide: '毓庆宫后殿，面阔五间，进深三间，黄琉璃瓦歇山顶，明间悬“继德堂”匾，与前殿以穿廊相连成工字形。',
  houzhao: '毓庆宫第四进后罩房，面阔五间，黄琉璃瓦悬山顶，前檐出廊（OSM 误标为继德堂）。',
  fengxian: '明初始建，清顺治十四年（1657）重建，是明清皇室祭祀祖先的家庙。工字殿：前殿面阔九间，黄琉璃瓦重檐庑殿顶；后殿九间，单檐庑殿顶，内设列祖列宗神龛；前后以穿堂相连，同坐汉白玉须弥座上，殿前宽广月台。现为故宫钟表馆。',
  fengxianHou: '奉先殿后殿，面阔九间，进深二间，黄琉璃瓦单檐庑殿顶，殿内分室供奉历代帝后神牌；今为钟表馆展厅。',
  tianqiong: '明代称玄穹宝殿，清初避康熙讳改称天穹宝殿，是宫中供奉昊天上帝等道教神像、举行斋醮的场所。正殿面阔五间，黄琉璃瓦单檐歇山顶，东西配殿各三间。',
  qiandong: '明代建，清初为皇子居所，乾隆以后陆续改作如意馆（宫廷画院）、寿药房、敬事房、四执库、古董房。五所自西向东并列，每所南开琉璃门，三进院落，殿宇均为黄琉璃瓦硬山顶。',
  lingzhao: '宣统元年（1909）由隆裕太后主持兴建的西洋式水殿，原设计三层：底层四面环水，以玻璃为墙可观游鱼；主楼四角各附一座圆形小楼。汉白玉砌筑，铜铁为棂、玻璃为窗，1911 年后停工，今存石构底层与铸铁框架。',
};

// ---------------- 小工具 ----------------
/** 竖匾（蓝底金字）：c 为门/殿局部坐标，y 为匾中心高，z 为墙面 */
function hangPlaque(c, text, y, z, ch = 0.3) {
  const sz = plaqueSize(text, true);
  const w = sz.w * ch, h = sz.h * ch;
  const p = c.at(0, y, z + 0.07).rot(0.1, 0, 0);
  const face = new THREE.PlaneGeometry(w, h);
  face.translate(0, 0, 0.06);
  p.add(makePlaque(text, { vertical: true }), face);
  p.add('board_red', boxGeo(w * 0.98, h * 0.98, 0.1));
}

/**
 * 墙门：type 'liuli'（琉璃门）| 'suiqiang'（随墙门）。g: { x, z, rot, w, h, wallH, wt, doorW, plaque, name, desc, tile }
 */
function wallGate(ctx, api, g) {
  const c = ctx.at(g.x, 0, g.z, g.rot ?? 0);
  const wt = g.wt ?? 1.2, h = g.h ?? 7.0, wallH = g.wallH ?? 5;
  let top;
  if ((g.type || 'liuli') === 'liuli') {
    const r = buildWallGate(c, { type: 'liuli', w: g.w ?? 6.6, h, wallThick: wt, wallH, tile: g.tile || 'yellow', doorW: g.doorW, roof: g.roof });
    top = r.top ?? h;
    if (g.plaque) {
      const T = Math.max(wt + 0.5, 1.6), yB = Math.max(h * 0.6, wallH + 0.12), dh = Math.min(h * 0.45, yB - 0.5);
      const n = [...g.plaque].length, ph = n + (n - 1) * 0.08 + 1.2;
      const ch = Math.min(0.3, (yB - dh - 0.45) / ph);
      hangPlaque(c, g.plaque, dh + 0.25 + (ph * ch) / 2, T / 2, ch);
    }
  } else {
    const r = buildWallGate(c, { type: 'suiqiang', w: g.w ?? 4.4, h: g.h ?? 6.0, wallThick: wt, doorW: g.doorW ?? 1.7, doorH: g.doorH, tile: g.tile || 'yellow' });
    top = r.top ?? h;
  }
  if (g.name) api.label(g.name, g.x, top + 1.2, g.z, g.desc || '');
}

/** OSM 门（building）→ 琉璃门（函数覆盖） */
const gateO = (g) => (ctx, b, api) => wallGate(ctx, api, { x: b.obb.cx, z: b.obb.cz, name: b.tags.name, ...g });

/** 甬路：略高于地面的条石带 */
function pave(ctx, x0, x1, z0, z1, y = 0.05) {
  ctx.add('paving_imperial', prismGeo(rect(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)), 0, y));
}

/** 月台：台明前的平台（青白石），前出踏跺 */
function yuetai(ctx, x0, x1, z0, z1, h = 1.0, stair = {}) {
  const r = buildPlatform(ctx, { poly: rect(x0, x1, z0, z1), h, style: 'stone', stairs: [{ at: [stair.x ?? (x0 + x1) / 2, z1 + 10], w: stair.w ?? 3.6 }] });
  return r;
}

/** 游廊段：自 a 到 b（世界坐标，水平或竖直），进深 d */
function gallery(ctx, a, b, d = 2.6, o = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rot = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : R.E;
  buildGallery(ctx.at((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, rot), { L, d, colH: o.colH ?? 2.9, tile: o.tile || 'yellow', juan: true, y0: o.y0 ?? 0.35 });
}

/** 小石亭（斋宫月台上的时辰牌亭/斋戒铜人亭）：汉白玉，方形，单檐四角攒尖石顶 */
function stoneKiosk(ctx, x, y, z) {
  const c = ctx.at(x, y, z);
  buildXumizuo(c, rect(-0.6, 0.6, -0.6, 0.6), 0, 0.5, {});
  const body = boxGeo(0.8, 0.85, 0.8); body.translate(0, 0.5 + 0.425, 0); c.add('marble', body);
  const niche = boxGeo(0.5, 0.55, 0.02); niche.translate(0, 0.95, 0.41); c.add('wood_dark', niche);
  const eave = boxGeo(1.25, 0.12, 1.25); eave.translate(0, 1.41, 0); c.add('marble', eave);
  const roof = latheGeo([[0.9, 0], [0.62, 0.22], [0.12, 0.5], [0.0001, 0.55]], 4); roof.rotateY(Math.PI / 4); roof.translate(0, 1.47, 0);
  c.add('marble', roof);
  const fin = latheGeo([[0.09, 0], [0.11, 0.08], [0.06, 0.2], [0.0001, 0.28]], 8); fin.translate(0, 1.98, 0); c.add('marble', fin);
}

/** 景仁宫石影壁：汉白玉须弥座、壁心雕饰、石檐顶 */
function stoneScreen(ctx, x, z, w = 5.8, hb = 3.0) {
  const c = ctx.at(x, 0, z);
  const t = 0.75;
  buildXumizuo(c, rect(-w / 2 - 0.25, w / 2 + 0.25, -t / 2 - 0.25, t / 2 + 0.25), 0, 0.85, {});
  const body = boxGeo(w, hb, t); body.translate(0, 0.85 + hb / 2, 0); c.add('marble', body);
  // 壁心：起线边框 + 中心圆形雕饰（盒子）+ 四角岔角（两面）
  const yc = 0.85 + hb / 2, fw = w - 0.6, fh = hb - 0.6, bw = 0.12;
  for (const s of [1, -1]) {
    const cs = c.at(0, yc, (s * t) / 2, s > 0 ? 0 : Math.PI);
    for (const [x, y, gw, gh] of [[0, fh / 2, fw, bw], [0, -fh / 2, fw, bw], [fw / 2, 0, bw, fh], [-fw / 2, 0, bw, fh]]) { const g = boxGeo(gw, gh, 0.06); g.translate(x, y, 0.03); cs.add('marble', g); }
    const med = latheGeo([[0.0001, 0], [0.78, 0], [0.82, 0.05], [0.7, 0.09], [0.3, 0.12], [0.0001, 0.13]], 28); med.rotateX(Math.PI / 2); cs.add('marble', med);
    const rim = latheGeo([[0.86, 0], [0.92, 0], [0.92, 0.07], [0.86, 0.07]], 28); rim.rotateX(Math.PI / 2); cs.add('marble', rim);
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const tri = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-sx * 0.75, 0), new THREE.Vector2(0, -sy * 0.55)]);
      const g = new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false });
      g.translate(sx * (fw / 2 - bw / 2), sy * (fh / 2 - bw / 2), 0);
      cs.add('marble', g);
    }
  }
  // 石檐（冰盘檐 + 两坡顶 + 脊）
  const yT = 0.85 + hb;
  const e1 = boxGeo(w + 0.3, 0.16, t + 0.3); e1.translate(0, yT + 0.08, 0); c.add('marble', e1);
  // 两坡石顶：沿 x 拉伸的三角棱柱
  const tri = new THREE.Shape([new THREE.Vector2(-(t + 0.5) / 2, 0), new THREE.Vector2((t + 0.5) / 2, 0), new THREE.Vector2(0, 0.55)]);
  const g = new THREE.ExtrudeGeometry(tri, { depth: w + 0.5, bevelEnabled: false });
  g.rotateY(Math.PI / 2); g.translate(-(w + 0.5) / 2, yT + 0.16, 0);
  c.add('marble', g);
  const ridge = boxGeo(w + 0.6, 0.16, 0.2); ridge.translate(0, yT + 0.16 + 0.58, 0); c.add('marble', ridge);
}

/** 六角亭（六角攒尖、黄琉璃瓦、宝顶），中心 (x,z)，檐口外接圆半径 R */
function hexPavilion(ctx, x, z, Rr, colH = 3.2) {
  const c = ctx.at(x, 0, z);
  const ph = 0.45, rc = Rr - 1.0;
  const hex = (r) => Array.from({ length: 6 }, (_, i) => { const a = ((i + 0.5) * Math.PI * 2) / 6; return [r * Math.sin(a), r * Math.cos(a)]; });
  buildPlatform(c, { poly: hex(rc + 0.7), h: ph, style: 'stone' });
  const D = 0.28;
  const P = hex(rc);
  for (const [px, pz] of P) { c.place('col:wood_red', px, ph, pz, 0, [D, colH, D]); c.place('zhuchu', px, ph, pz, 0, [D, D, D]); }
  for (let i = 0; i < 6; i++) {
    const a = P[i], b = P[(i + 1) % 6];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const g = boxGeo(L, 0.3, 0.22); g.translate(0, ph + colH - 0.15, 0);
    c.at((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, -Math.atan2(b[1] - a[1], b[0] - a[0])).add('beam_xuanzi', g);
  }
  // 井口石（亭内水井）
  const well = latheGeo([[0.55, 0], [0.55, 0.5], [0.35, 0.5], [0.35, 0.1]], 12); well.translate(0, ph, 0); c.add('stone_grey', well);
  buildRoof(c, { type: 'cuanjian', sides: 6, r: Rr, y: ph + colH + 0.15, rise: Rr * 0.95, tile: 'yellow', soffitFull: true, beasts: 1, overhang: 1.0 });
}

// ---------------- 墙门（OSM 墙多边形 → 门） ----------------
const WALL_GATES = [
  { id: 42623338, name: '前星门', type: 'liuli', x: 133.2, z: -114.05, rot: R.S, w: 7.0, h: 9.4, wallH: 8, wt: 2.4, plaque: '前星门', desc: '毓庆宫正门，琉璃门，南向，门内为值房院与祥旭门。' },
  { id: 42623352, name: '景耀门', type: 'suiqiang', x: 116.65, z: -211.05, rot: R.W, w: 5.5, h: 6.8, doorW: 2.0 },
  { id: 42623353, name: '凝祥门', type: 'suiqiang', x: 123.75, z: -211.05, rot: R.E, w: 5.5, h: 6.8, doorW: 2.0 },
  { id: 42623354, name: '麟趾门', type: 'liuli', x: 120.15, z: -214.35, rot: R.S, w: 5.6, h: 7.6, wallH: 6.2, wt: 1.1, desc: '东二长街南端门。' },
  { id: 42623362, name: '昭华门', type: 'suiqiang', x: 171.1, z: -211.0, rot: R.E, w: 5.4, h: 6.8, doorW: 2.0 },
  { id: 42623367, name: '苍震门', type: 'liuli', x: 226.7, z: -211.1, rot: R.E, w: 5.6, h: 9.4, wallH: 8, wt: 3.0, plaque: '苍震门', desc: '东六宫东侧通往东筒子长街的门，琉璃门。' },
  { id: 42623391, name: '履顺门', type: 'suiqiang', x: 117.2, z: -268.45, rot: R.E, w: 3.9, h: 6.9, doorW: 1.6 },
  { id: 42623393, name: '德阳门', type: 'suiqiang', x: 124.2, z: -268.15, rot: R.W, w: 4.7, h: 6.9, doorW: 1.6 },
  { id: 42623394, name: '仁泽门', type: 'suiqiang', x: 172.45, z: -267.95, rot: R.E, w: 4.7, h: 6.9, doorW: 1.6 },
  { id: 42623405, name: '昌祺门', type: 'suiqiang', x: 124.7, z: -320.05, rot: R.W, w: 3.9, h: 6.9, doorW: 1.6 },
  { id: 42623408, name: '千婴门', type: 'liuli', x: 121.65, z: -368.3, rot: R.N, w: 5.6, h: 7.6, wallH: 6.2, wt: 1.1, desc: '东二长街北端门。' },
  { id: 42623410, name: '衍祺门', type: 'suiqiang', x: 172.95, z: -320.0, rot: R.E, w: 4.2, h: 6.9, doorW: 1.6 },
  { id: 43525076, name: '诚肃门', type: 'liuli', x: 152.55, z: -97.0, rot: R.W, w: 5.8, h: 9.0, wallH: 8, wt: 2.0, plaque: '诚肃门' },
  { id: 683954225, name: '迎瑞门', type: 'suiqiang', x: 117.85, z: -320.15, rot: R.E, w: 5.1, h: 6.9, doorW: 1.6 },
];

// ---------------- 建筑覆盖表 ----------------
const overrides = {
  // ===== 斋宫 =====
  40605850: (ctx, b, api) => {
    // 台明（含前部月台）：青白石，前出踏跺
    buildPlatform(ctx, { poly: rect(79.6, 107.0, -177.45, -156.2), h: 1.0, style: 'stone', stairs: [{ at: [92.7, -140], w: 4.4 }] });
    hall(ctx.at(93.35, 1.0, -169.1), { grade: 3, eaveW: 28.4, eaveD: 16.6, nBays: 5, nDepth: 3, colH: 4.6, roof: { type: 'xieshan' }, platform: false });
    // 前出抱厦三间（卷棚歇山）
    hall(ctx.at(92.9, 1.0, -160.15), {
      grade: 4, eaveW: 16.0, eaveD: 7.9, nBays: 3, nDepth: 1, colH: 3.9, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi',
      roof: { type: 'xieshan', juan: true }, platform: false, back: 'open', front: ['window', 'door', 'window'], sides: 'window', plaque: '斋宫',
    });
    // 月台上：时辰牌亭（东）、斋戒铜人亭（西）
    stoneKiosk(ctx, 81.9, 1.0, -158.3);
    stoneKiosk(ctx, 104.7, 1.0, -158.3);
    // 穿堂（连后殿诚肃殿，坐于 OSM 石台 687018970 上）
    hall(ctx.at(92.95, 1.0, -182.45, R.E), { grade: 4, eaveW: 14.6, eaveD: 7.2, nBays: 3, nDepth: 1, colH: 3.4, roof: { type: 'xuanshan', juan: true }, platform: false, front: 'window', back: 'window', caihua: 'xuanzi' });
    api.label('斋宫', 93.3, 13.5, -166.8, D.zhai);
  },
  40605851: FRONT({ nBays: 7, colH: 4.4, platform: { h: 1.0, style: 'stone', margin: 1.4, stairs: [] }, plaque: '诚肃殿', desc: D.chengsu }),
  687015107: 'skip', 687015108: 'skip', 687015109: 'skip', // 抱厦前踏跺碎块（并入台明）
  685441251: (ctx) => gallery(ctx, [109.35, -156.3], [109.35, -164.6], 3.1),
  685441255: (ctx) => gallery(ctx, [77.1, -156.1], [77.1, -164.6], 2.4),
  685441244: (ctx) => { gallery(ctx, [72.7, -174.35], [79.6, -174.35], 2.5); gallery(ctx, [74.35, -173.1], [74.35, -190.9], 3.2); gallery(ctx, [76.45, -189.2], [76.45, -197.9], 3.4); },
  685441240: (ctx) => { gallery(ctx, [107.0, -174.05], [114.2, -174.05], 2.5); gallery(ctx, [112.55, -172.8], [112.55, -190.6], 3.4); gallery(ctx, [110.95, -189.0], [110.95, -197.5], 2.5); },
  40605858: PEI({ colH: 3.5 }), // 斋宫西配殿
  40605857: PEI({ colH: 3.5 }), // 斋宫东配殿
  40605855: ER({ nBays: 11, grade: 4, colH: 3.3, corridor: 1.2, nDepth: 3, backCorridor: false }), // 斋宫前院南群房（北向）
  42623320: gateO({ rot: R.S, w: 6.8, h: 7.0, wallH: 5, wt: 1.5, plaque: '斋宫门', desc: '斋宫正门，琉璃门，南向。' }),

  // ===== 毓庆宫 =====
  42623340: gateO({ rot: R.S, w: 6.8, h: 7.0, wallH: 5, wt: 1.2, plaque: '祥旭门', desc: '毓庆宫第二道门，门内为惇本殿。' }),
  685505667: gateO({ rot: R.S, w: 4.4, h: 5.6, wallH: 5, wt: 0.9 }),
  685505668: gateO({ rot: R.W, w: 7.0, h: 6.4, wallH: 5, wt: 1.2, name: '阳曜门', desc: '毓庆宫第一进院西门，通往斋宫前院。' }),
  40605852: FRONT({ colH: 4.3, platform: { h: 1.0, style: 'stone', margin: 1.6, stairs: [{ side: 'S' }, { side: 'N' }] }, plaque: '惇本殿', desc: D.dunben }),
  40605859: PEI({ nDepth: 3 }), 40605860: PEI({ nDepth: 3 }),
  43525087: FRONT({ colH: 4.2, platform: { h: 1.0, style: 'stone', margin: 1.5, stairs: [{ side: 'S' }] }, plaque: '毓庆宫', desc: D.yuqing }),
  43525088: FRONT({ rotY: R.S, colH: 4.2, platform: { h: 1.0, style: 'stone', margin: 1.5, stairs: [{ side: 'N' }] }, plaque: '继德堂' }),
  40605841: [{ x: 134.6, z: -175.3, rotY: R.E, grade: 4, eaveW: 9.8, eaveD: 7.4, nBays: 3, nDepth: 1, colH: 3.3, roof: { type: 'xuanshan', juan: true }, platform: { h: 1.0, style: 'stone', margin: 0.4, stairs: [] }, front: 'window', back: 'window', caihua: 'xuanzi' }],
  40605853: REAR({ roof: { type: 'xuanshan' }, colH: 3.6, noLabel: true }),
  // 东西围房（各二十间）
  40605854: [{ x: 119.45, z: -173.95, rotY: R.E, grade: 5, eaveW: 60.0, eaveD: 6.7, nBays: 19, nDepth: 3, corridor: 1.1, backCorridor: false, colH: 3.0, roof: { type: 'yingshan' }, platform: { h: 0.4 } }],
  40605856: [{ x: 147.85, z: -174.1, rotY: R.W, grade: 5, eaveW: 59.3, eaveD: 6.4, nBays: 19, nDepth: 3, corridor: 1.1, backCorridor: false, colH: 3.0, roof: { type: 'yingshan' }, platform: { h: 0.4 } }],

  // ===== 奉先殿 =====
  43525082: (ctx, b, api) => {
    buildPlatform(ctx, { poly: rect(157.2, 207.6, -179.1, -149.9), h: 2.0, style: 'xumizuo' });
    const info = hall(ctx.at(182.4, 2.0, -164.45), {
      grade: 2, eaveW: 52.0, eaveD: 29.4, bays: [4.0, 5.4, 5.5, 5.6, 6.0, 5.6, 5.5, 5.4, 4.0], depthBays: [4.0, 8.15, 8.15, 4.0],
      colH: 5.9, dougong: { kou: 0.085, cai: 7 }, double: {}, roof: { type: 'wudian', rise: 5.8 }, platform: false, plaque: '奉先殿',
    });
    api.label('奉先殿', 182.4, 2 + info.topY + 2, -164.45, D.fengxian);
  },
  43525086: (ctx, b, api) => {
    buildPlatform(ctx, { poly: rect(157.6, 207.6, -203.4, -185.3), h: 2.0, style: 'xumizuo', stairs: [{ at: [182.6, -230], w: 5.0 }] });
    const info = hall(ctx.at(182.65, 2.0, -194.55), {
      grade: 2, eaveW: 51.3, eaveD: 18.9, bays: [4.0, 5.3, 5.4, 5.6, 6.1, 5.6, 5.4, 5.3, 4.0], nDepth: 2, depthBays: [7.15, 7.15],
      colH: 6.0, dougong: { kou: 0.085, cai: 5 }, roof: { type: 'wudian' }, platform: false,
    });
    api.label('奉先殿后殿（钟表馆）', 182.6, 2 + info.topY + 2, -194.6, D.fengxianHou);
  },
  40605609: (ctx) => {
    // 穿堂：坐于须弥座上，两侧槛窗
    buildPlatform(ctx, { poly: rect(175.8, 188.1, -185.4, -179.0), h: 2.0, style: 'xumizuo' });
    hall(ctx.at(181.95, 2.0, -182.0, R.E), { grade: 3, eaveW: 11.6, eaveD: 12.3, nBays: 3, nDepth: 2, colH: 5.2, dougong: { kou: 0.075, cai: 3 }, roof: { type: 'xuanshan', rise: 2.6 }, platform: false, front: 'window', back: 'window' });
  },
  685500200: (ctx, b, api) => {
    // 奉先门：三座琉璃门并列
    for (const [x, w, h] of [[174.35, 6.0, 7.7], [181.05, 6.0, 8.5], [187.65, 6.0, 7.7]]) {
      wallGate(ctx, api, { x, z: -114.3, rot: R.S, w, h, wallH: 6.6, wt: 2.2, plaque: x === 181.05 ? '奉先门' : null });
    }
    api.label('奉先门', 181.0, 10, -114.3, '奉先殿正门，三座琉璃门并列，南向。');
  },
  40605606: ER({ rotY: R.N, grade: 4, nBays: 15, nDepth: 3, corridor: 1.3, backCorridor: false, colH: 3.6, platform: { h: 0.5 }, desc: '奉先殿南侧的一排群房，北向，旧为奉先殿值房与库房。' }),
  685500189: (ctx) => hexPavilion(ctx, 216.55, -76.05, 3.95, 3.0),
  369969394: ER({ grade: 5, nBays: 9 }),
  369969395: [
    { x: 218.6, z: -193.6, rotY: R.W, grade: 5, eaveW: 19.0, eaveD: 10.4, nBays: 5, colH: 3.4, roof: { type: 'yingshan' }, platform: { h: 0.4 } },
    { x: 218.8, z: -164.95, rotY: R.W, grade: 5, eaveW: 21.7, eaveD: 9.7, nBays: 7, colH: 3.4, roof: { type: 'yingshan' }, platform: { h: 0.4 } },
    { x: 222.4, z: -180.0, rotY: R.W, grade: 5, eaveW: 8.3, eaveD: 2.9, nBays: 3, colH: 2.8, roof: { type: 'yingshan' }, platform: { h: 0.3 } },
  ],
  40605608: ER(),

  // ===== 景仁宫 =====
  42623324: gateO({ rot: R.S, w: 5.8, h: 7.0, wallH: 5, wt: 1.0, plaque: '景仁门', desc: '景仁宫宫门，琉璃门，门内有石影壁。' }),
  40631331: FRONT({ plaque: '景仁宫', desc: D.jingren }),
  687020423: (ctx) => yuetai(ctx, 84.5, 102.0, -235.4, -229.1, 1.0, { x: 93.3, w: 4.0 }),
  684753135: REAR({ colH: 3.8 }),
  684753137: PEI(), 684753138: PEI(), 684753132: ER(),
  684753133: ER({ rotY: R.N }), 684753129: ER({ rotY: R.S }), 684753130: ER({ rotY: R.S }),

  // ===== 承乾宫 =====
  42623372: gateO({ rot: R.S, w: 6.6, h: 7.0, wallH: 5, wt: 1.0, plaque: '承乾门' }),
  40631340: FRONT({ plaque: '承乾宫', desc: D.chengqian }),
  40631342: REAR({ colH: 4.2, nDepth: 3, corridor: 1.6 }),
  40631332: PEI(), 40631339: PEI(), 683954210: ER({ nBays: 1 }),
  40631333: ER({ rotY: R.S }), 40631338: ER({ rotY: R.S }),

  // ===== 钟粹宫 =====
  42623360: gateO({ rot: R.S, w: 6.6, h: 7.0, wallH: 5, wt: 1.2, plaque: '钟粹门' }),
  40631343: FRONT({ corridor: 1.6, caihua: 'sushi', plaque: '钟粹宫', desc: D.zhongcui }),
  40631351: REAR({ colH: 3.8 }),
  40631348: PEI(), 40631346: PEI(), 40631350: PEI(),
  40631345: ER({ rotY: R.S }), 40631347: ER({ rotY: R.S }),

  // ===== 延禧宫 =====
  42623351: gateO({ rot: R.S, w: 6.6, h: 7.0, wallH: 5, wt: 1.0, plaque: '延禧门', desc: '延禧宫宫门，琉璃门，南向。' }),
  685316170: (ctx, b, api) => {
    const pool = api.walls.find((w) => w.id === 642568395)?.pts.slice(0, -1);
    const r = buildLingzhao(ctx, { cx: 148.4, cz: -236.1, pool, waterY: 0.14, addWater: api.addWater });
    api.label('灵沼轩（水晶宫）', 148.4, r.top + 1, -236.1, D.lingzhao);
    api.label('延禧宫', 148.4, r.top + 6, -246.5, D.yanxi);
  },
  // 1931 年防火文物库房：凹字形二层，外观仿宫殿，黄琉璃瓦
  40631110: (ctx) => {
    const st = (a, b) => [{ colH: a, back: 'wall' }, { colH: b, inset: 0 }];
    buildTower(ctx.at(148.55, 0, -258.35), { grade: 4, eaveW: 19.2, eaveD: 15.0, nBays: 5, nDepth: 3, platform: { h: 0.5, stairs: [{ side: 'S' }] }, stories: st(3.7, 3.1), roof: { type: 'xieshan' }, caihua: 'xuanzi' });
    // 两翼伸入中部屋檐之下，避免中部歇山翼角与两翼硬山山墙之间露空
    for (const [x, w] of [[132.2, 17.9], [164.6, 17.3]]) buildTower(ctx.at(x, 0, -258.35), { grade: 4, eaveW: w, eaveD: 14.0, nBays: 5, nDepth: 3, platform: { h: 0.5, stairs: [] }, stories: st(3.2, 2.7), roof: { type: 'yingshan' }, caihua: 'xuanzi' });
  },
  40631108: (ctx) => buildTower(ctx.at(128.2, 0, -233.0, R.E), { grade: 4, eaveW: 36.2, eaveD: 10.4, nBays: 9, nDepth: 2, platform: { h: 0.5, stairs: [] }, stories: [{ colH: 3.0, back: 'wall' }, { colH: 2.6, inset: 0 }], roof: { type: 'yingshan' }, caihua: 'xuanzi' }),
  40631109: (ctx) => buildTower(ctx.at(168.0, 0, -232.8, R.W), { grade: 4, eaveW: 36.1, eaveD: 10.1, nBays: 9, nDepth: 2, platform: { h: 0.5, stairs: [] }, stories: [{ colH: 3.0, back: 'wall' }, { colH: 2.6, inset: 0 }], roof: { type: 'yingshan' }, caihua: 'xuanzi' }),

  // ===== 永和宫 =====
  42623387: gateO({ rot: R.S, w: 6.6, h: 7.0, wallH: 5, wt: 1.0, plaque: '永和门' }),
  40631116: (ctx, b, api) => {
    const poly = [[136.4, -299.5], [162.4, -299.5], [162.4, -286.3], [159.6, -286.3], [159.6, -280.6], [139.0, -280.6], [139.0, -286.3], [136.4, -286.3]];
    buildPlatform(ctx, { poly, h: 1.0, style: 'stone', stairs: [{ at: [149.3, -270], w: 4.0 }, { at: [149.4, -310], w: 3.4 }] });
    hall(ctx.at(149.4, 1.0, -293.05), { grade: 3, eaveW: 27.6, eaveD: 14.5, nBays: 5, nDepth: 3, colH: 4.2, roof: { type: 'xieshan' }, platform: false });
    const r = hall(ctx.at(149.3, 1.0, -283.9), {
      grade: 4, eaveW: 18.0, eaveD: 7.0, nBays: 3, nDepth: 1, colH: 3.7, dougong: { kou: 0.06, cai: 3 }, caihua: 'hexi',
      roof: { type: 'xieshan', juan: true }, platform: false, back: 'open', front: ['window', 'door', 'window'], sides: 'window', plaque: '永和宫',
    });
    api.label('永和宫', 149.4, 1 + r.topY + 4, -290.3, D.yonghe);
  },
  40631118: REAR({ plaque: '同顺斋', desc: '永和宫后殿，面阔五间，黄琉璃瓦硬山顶，前檐出廊。' }),
  40631112: PEI(), 40631115: PEI(), 40631111: PEI(), 40631113: PEI(),
  40631117: ER(), 40631114: ER(),
  685312510: ER({ rotY: R.S }), 40631119: ER({ rotY: R.S }),

  // ===== 景阳宫 =====
  42623404: gateO({ rot: R.S, w: 6.6, h: 7.0, wallH: 5, wt: 1.0, plaque: '景阳门' }),
  40631121: FRONT({ nBays: 3, colH: 4.0, roof: { type: 'wudian' }, plaque: '景阳宫', desc: D.jingyang }),
  40631126: REAR({ roof: { type: 'xieshan' }, grade: 4, colH: 3.8, plaque: '御书房', desc: '景阳宫后殿，面阔五间，黄琉璃瓦歇山顶，前檐出廊。' }),
  40631123: PEI(), 40631125: PEI(), 40631122: PEI(), 40631124: PEI(),
  40631127: ER({ rotY: R.S }), 40631128: ER({ rotY: R.S }),

  // ===== 东六宫以东：内务府库房 =====
  42623365: gateO({ rot: R.S, w: 5.8, h: 6.4, wallH: 5, wt: 1.0 }),
  42623395: gateO({ rot: R.S, w: 5.8, h: 6.4, wallH: 5, wt: 1.0 }),
  40629557: REAR({ grade: 5, colH: 3.6, desc: '内务府广储司库房之一，贮藏绸缎。' }),
  40629564: REAR({ grade: 5, colH: 3.6, desc: '内务府广储司库房之一，贮藏茶叶。' }),
  40629558: REAR({ grade: 5, colH: 3.6, desc: '内务府库房之一，贮藏南方进贡的干鲜果品。' }),
  40629551: ER({ nBays: 5, colH: 3.4 }), 40629556: ER({ nBays: 5, colH: 3.4 }), 40629560: ER({ nBays: 5, colH: 3.4 }),
  40629565: ER({ rotY: R.N, nBays: 9, colH: 3.2 }),
  40629549: ER({ nBays: 7, colH: 3.4, desc: '清代存放宫中祭神用器物的库房，硬山小式。' }), 40629550: ER({ colH: 3.2 }),

  // ===== 天穹宝殿 =====
  42623413: gateO({ rot: R.S, w: 6.0, h: 6.6, wallH: 5, wt: 1.0 }),
  42623415: gateO({ rot: R.S, w: 6.0, h: 7.2, wallH: 5, wt: 1.0, plaque: '钦昊门', name: '钦昊门', desc: '天穹宝殿院门，三座琉璃门并列。' }),
  42623416: gateO({ rot: R.S, w: 6.0, h: 6.6, wallH: 5, wt: 1.0 }),
  42623412: gateO({ rot: R.W, w: 5.4, h: 6.4, wallH: 5, wt: 1.2 }),
  40629566: FRONT({ colH: 4.0, platform: { h: 1.0, style: 'stone', margin: 1.5, stairs: [{ side: 'S' }] }, plaque: '天穹宝殿', desc: D.tianqiong }),
  40629567: PEI({ rotY: R.E, roof: { type: 'xieshan' }, colH: 3.6, platform: { h: 0.6 } }),
  40629568: PEI({ rotY: R.W, roof: { type: 'xieshan' }, colH: 3.6, platform: { h: 0.6 } }),

  // ===== 乾东五所 =====
  // 前殿（一进正房）
  40632379: SUO({ nDepth: 3, corridor: 1.4, backCorridor: false, colH: 3.6 }),
  40632380: SUO({ nDepth: 3, corridor: 1.4, backCorridor: false, colH: 3.6 }),
  40632381: SUO({ nDepth: 3, corridor: 1.4, backCorridor: false, colH: 3.6 }),
  40632382: SUO({ nDepth: 3, corridor: 1.4, backCorridor: false, colH: 3.6 }),
  40632383: SUO({ nDepth: 3, corridor: 1.4, backCorridor: false, colH: 3.6 }),
  // 后殿（二进正房）
  40632389: SUO({ noLabel: false, desc: '乾东头所后殿，乾隆以后为如意馆，宫廷画师在此作画。' }),
  40632390: SUO({ noLabel: false, desc: '乾东二所后殿，清代为寿药房，存储御用药材。' }),
  40632391: SUO({ noLabel: false, desc: '乾东三所后殿，清代为敬事房，管理宫内太监事务。' }),
  40632392: SUO({ noLabel: false, desc: '乾东四所后殿，清代为四执库，存放帝后冠袍带履。' }),
  40632393: SUO({ noLabel: false, desc: '乾东五所后殿，清代为古董房，收贮古玩器物。' }),
  // 后罩房
  40632384: SUO({ grade: 5, colH: 3.2 }), 40632385: SUO({ grade: 5, colH: 3.2 }), 40632386: SUO({ grade: 5, colH: 3.2 }),
  40632387: SUO({ grade: 5, colH: 3.2 }), 40632388: SUO({ grade: 5, colH: 3.2 }),
  // 琉璃门（南向）
  42576864: gateO({ rot: R.S, w: 5.4, h: 6.4, wallH: 5, wt: 1.0 }),
  42576860: gateO({ rot: R.S, w: 5.4, h: 6.4, wallH: 5, wt: 1.0 }),
  42576872: gateO({ rot: R.S, w: 5.4, h: 6.4, wallH: 5, wt: 1.0 }),
  42576866: gateO({ rot: R.S, w: 5.4, h: 6.4, wallH: 5, wt: 1.0 }),
  42576873: gateO({ rot: R.S, w: 5.4, h: 6.4, wallH: 5, wt: 1.0 }),

  // ===== 北侧长房 =====
  40606309: [
    { x: 142.3, z: -452.05, rotY: R.S, grade: 5, eaveW: 144.6, eaveD: 7.2, nBays: 41, colH: 3.2, roof: { type: 'yingshan' }, platform: { h: 0.4 } },
    { x: 142.3, z: -459.15, rotY: R.N, grade: 5, eaveW: 144.6, eaveD: 7.2, nBays: 41, colH: 3.2, roof: { type: 'yingshan' }, platform: { h: 0.4, stairs: [] } },
  ],
  40606311: ER({ nBays: 11, noLabel: true }), 40606314: ER({ nBays: 19, noLabel: true }), 40606315: ER({ nBays: 5, noLabel: true }),
  40606310: ER(), 40606312: ER({ nBays: 5 }),
  409771411: { noLabel: true, grade: 5, roof: { type: 'yingshan' } },
};
// 乾东五所厢房（东西配房，三间）
for (const id of [40632400, 40632399, 40632398, 40632401, 40632402, 40632403, 40632404, 40632405, 40632406, 40632412,
  40632413, 40632394, 40632395, 40632396, 40632397, 40632410, 40632409, 40632408, 40632407, 40632411]) overrides[id] = SUO({ grade: 5, nBays: 3, colH: 3.0 });

// 墙：门洞多边形改由 build 建门；延禧宫水池驳岸由灵沼轩建造
const wallOverrides = Object.fromEntries(WALL_GATES.map((g) => [g.id, 'skip']));
wallOverrides[642568395] = 'skip';
// 乾东五所北墙：OSM 多边形两线间距约 4m 且略斜，矩形分解后墙帽过宽，改为按中线重建
wallOverrides[639122655] = 'skip';
// 东二长街两侧宫墙：OSM 高 5m 偏低，长街墙高约 6m，配殿屋面露于墙头之上
const STREET_WALLS = new Set([684753151, 683954217, 683954212, 685312512, 42623402]);
for (const id of STREET_WALLS) wallOverrides[id] = { h: 6.2 };
// 奉先门两侧宫墙略低于门（门楼高出墙帽）
wallOverrides[685500203] = { h: 6.6 };
wallOverrides[685500202] = { h: 6.6 };

// ---------------- 补充内容 ----------------
function build(ctx0, api) {
  const ctx = fix(ctx0);
  // 墙门
  for (const g of WALL_GATES) wallGate(ctx, api, g);

  buildPalaceWall(ctx, { path: [[10.3, -429.25], [226.4, -430.15]], h: 8, thick: 2.0, cap: 'yellow' });
  // 细长墙多边形（两侧坐标相距 <0.8m 时矩形分解为空，自动墙不生成）→ 按中线重建
  for (const w of api.walls) {
    if (!w.poly || wallOverrides[w.id] === 'skip' || decompose(w.pts, 0).length) continue;
    const X = w.pts.map((p) => p[0]), Z = w.pts.map((p) => p[1]);
    const sx = Math.max(...X) - Math.min(...X), sz = Math.max(...Z) - Math.min(...Z);
    if (Math.max(sx, sz) < 1.6) continue;
    const ns = sz >= sx;
    const lo = ns ? Math.min(...Z) : Math.min(...X), hi = ns ? Math.max(...Z) : Math.max(...X);
    const endC = (v0) => { const near = w.pts.filter((p) => Math.abs((ns ? p[1] : p[0]) - v0) < 1.6); return near.reduce((a, p) => a + (ns ? p[0] : p[1]), 0) / near.length; };
    const a = endC(lo), b = endC(hi);
    const path = ns ? [[a, lo], [b, hi]] : [[lo, a], [hi, b]];
    const h = STREET_WALLS.has(w.id) ? 6.2 : parseFloat(w.tags.height) || 5;
    buildPalaceWall(ctx, { path, h, thick: Math.min(1.4, Math.max(0.8, (ns ? sx : sz) * 0.85)), cap: 'yellow' });
  }

  // 景仁宫石影壁（门内）
  stoneScreen(ctx, 92.7, -219.8);
  api.label('石影壁', 92.7, 6, -219.8, '景仁门内石影壁，汉白玉须弥座，壁心雕饰，相传为元代遗物。');

  // 月台（承乾宫、钟粹宫、景阳宫；景仁宫月台由 OSM 台基覆盖建造）
  yuetai(ctx, 85.5, 102.5, -286.1, -280.6, 1.0, { x: 94.0 });
  yuetai(ctx, 85.0, 102.6, -337.2, -331.8, 1.0, { x: 94.0 });
  yuetai(ctx, 143.0, 156.8, -336.8, -331.6, 1.0, { x: 149.9 });

  // 甬路
  pave(ctx, 119.4, 122.6, -215.0, -367.3); // 东二长街
  for (const [x, z0, z1] of [
    [92.7, -215.0, -229.1], [93.7, -248.4, -257.8], // 景仁宫
    [93.9, -272.0, -280.6], [94.0, -299.8, -304.8], // 承乾宫
    [94.0, -326.6, -331.8], [94.0, -351.6, -360.6], // 钟粹宫
    [147.7, -215.0, -224.8], // 延禧宫
    [149.3, -272.0, -280.6], [149.3, -299.6, -310.0], // 永和宫
    [149.0, -324.3, -331.6], [149.9, -350.8, -359.6], // 景阳宫
    [92.6, -139.6, -153.4], // 斋宫
    [133.3, -115.4, -145.9], // 毓庆宫
    [181.0, -116.8, -133.5], // 奉先殿
    [200.5, -335.0, -351.4], // 天穹宝殿
    [84.0, -375.4, -386.4], [113.0, -375.4, -386.4], [142.0, -375.4, -386.4], [170.6, -375.4, -386.4], [198.8, -375.4, -386.4], // 乾东五所
  ]) pave(ctx, x - 1.4, x + 1.4, z0, z1);
  pave(ctx, 178.2, 183.8, -116.8, -133.5); // 奉先殿御路加宽
  // 奉先殿月台前御路石
  pave(ctx, 179.4, 182.6, -116.8, -133.5, 0.08);

  // 陈设
  const vat = (x, z, y = 0, k = 'bronze') => ctx.place(`vat:${k}`, x, y, z, 0, propHeight('vat'));
  for (const [x0, x1, z] of [[86.0, 100.6, -229.6], [85.5, 101.8, -279.0], [86.0, 101.8, -330.4], [140.0, 158.6, -278.6], [141.6, 156.4, -330.2], [84.5, 100.7, -150.8], [127.6, 139.6, -142.0]]) { vat(x0, z); vat(x1, z); }
  vat(166.0, -129.0); vat(196.0, -129.0);
  ctx.place('censer:tower', 200.5, 0, -347.6, 0, propHeight('censer:tower'));
  ctx.place('lamp:stone', 196.4, 0, -344.0, 0, propHeight('lamp:stone'));
  ctx.place('lamp:stone', 204.6, 0, -344.0, 0, propHeight('lamp:stone'));

  // 树木（少量点缀：槐树、梨/丁香、柏）
  const tree = (k, v, x, z, h, r = 0) => ctx.place(`tree:${k}:${v}`, x, 0, z, r, h);
  // 东六宫后院槐树
  for (const [x, z] of [[83.5, -252.5], [104.0, -253.5], [84.0, -305.0], [103.5, -304.5], [84.5, -356.5], [103.0, -356.0], [139.0, -306.0], [159.5, -306.5], [139.5, -356.0], [159.0, -357.0]]) tree('locust', (x * 7 + z) & 3, x, z, 11 + ((x * 13) % 3));
  // 承乾宫前院梨树（以小型阔叶树表示）
  tree('locust', 1, 87.0, -276.5, 7.0); tree('locust', 2, 100.6, -276.0, 6.5);
  // 毓庆宫、斋宫院内丁香
  for (const [x, z] of [[127.5, -158.5], [140.5, -158.0], [84.0, -144.5], [101.5, -144.0]]) tree('shrub', 2, x, z, 3.2, x);
  // 天穹宝殿：古柏
  for (const [x, z, v] of [[192.0, -339.6, 0], [209.0, -339.4, 2]]) tree('cypress', v, x, z, 9.5 + v * 0.5);
  // 乾东五所前院槐树
  for (const x of [77.5, 106.5, 135.5, 164.0, 192.5]) tree('locust', Math.round(x) & 3, x, -381.5, 12);
  // 南群房院、奉先殿东院
  tree('locust', 2, 160.0, -78.5, 12); tree('elm', 1, 218.0, -126.0, 12);

  // 标签：乾东五所
  for (const [i, x] of [[0, 84.6], [1, 114.1], [2, 142.5], [3, 170.8], [4, 199.1]]) {
    api.label(`乾东${['头', '二', '三', '四', '五'][i]}所`, x, 11, -391.3, i === 0 ? D.qiandong : '乾东五所之一，三进院落，黄琉璃瓦硬山顶。');
  }
  api.label('毓庆宫后罩房', 134.4, 11, -200.3, D.houzhao);
  api.label('继德堂', 134.1, 13, -183.3, D.jide);
}

// 所有建筑（含未列出的自动推断建筑）统一经 wrapOverride 建造
const overridesProxy = new Proxy(overrides, {
  get(t, k) { return typeof k === 'string' && /^\d+$/.test(k) ? wrapOverride(t[k]) : t[k]; },
});

export default {
  key: 'east_inner',
  title: '东六宫区',
  overrides: overridesProxy,
  wallOverrides,
  bridgeOverrides: {},
  build,
};
