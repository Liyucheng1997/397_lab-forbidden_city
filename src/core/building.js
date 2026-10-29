// 单体建筑总装：台基 → 柱网（柱础、檐柱、金柱）→ 梁枋彩画 → 门窗/墙 → 斗拱 → 屋顶（单檐/重檐）→ 匾额
// 局部坐标：建筑中心原点，正面 +Z。所有尺寸单位为米。
import * as THREE from 'three';
import { boxGeo, cylGeo, latheGeo, fromArrays, clamp, prismGeo } from './geom.js';
import { registerProtoFamily } from './protos.js';
import { buildRoof } from './roof.js';
import { placeDougong, dougongHeight, dougongReach } from './dougong.js';
import { buildPlatform, buildStairs, buildRailing } from './platform.js';
import { buildBay, buildCorridorTrim } from './openings.js';
import './ornaments.js';
import { makePlaque, plaqueSize } from './plaque.js';

// ---- 柱、柱础原型（单位：直径 1、高 1，调用方非均匀缩放） ----
registerProtoFamily('col', (key, [mat]) => [{ mat: mat || 'wood_red', geo: cylGeo(0.5, 0.5, 1, 14) }]);
registerProtoFamily('zhuchu', () => {
  // 古镜式柱础：直径 1 对应柱径
  const g = latheGeo([[1.0, 0], [1.0, 0.12], [0.75, 0.26], [0.6, 0.32]], 10);
  return [{ mat: 'stone_grey', geo: g }];
});

/** 等级预设：斗口、踩数、彩画、平均间宽、台基高 */
const GRADES = {
  1: { kou: 0.096, cai: 9, caihua: 'hexi', bay: 6.4, ph: 2.0, beasts: 9 },
  2: { kou: 0.085, cai: 7, caihua: 'hexi', bay: 5.6, ph: 1.6, beasts: 7 },
  3: { kou: 0.075, cai: 5, caihua: 'hexi', bay: 4.6, ph: 1.1, beasts: 5 },
  4: { kou: 0, cai: 0, caihua: 'xuanzi', bay: 3.9, ph: 0.7, beasts: 3 },
  5: { kou: 0, cai: 0, caihua: 'xuanzi', bay: 3.4, ph: 0.4, beasts: 1 },
};

/** 面阔/进深各间宽：明间最宽，向两侧递减；corridor=两端廊间 */
export function bayWidths(total, n, { corridor = 0, taper = 0.92 } = {}) {
  if (n <= 1) return [total];
  const w = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const k = Math.round(Math.abs(i - mid) - (n % 2 === 0 ? 0.5 : 0));
    w.push(Math.max(0.72, taper ** k));
  }
  if (corridor > 0 && n >= 3) { w[0] = corridor; w[n - 1] = corridor; }
  if (corridor > 0 && n >= 3) {
    const fixed = 2 * corridor, rest = w.slice(1, -1), sum = rest.reduce((a, b) => a + b, 0);
    const scale = (total - fixed) / sum;
    return [corridor, ...rest.map((x) => x * scale), corridor];
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (x * total) / sum);
}

const cumul = (bays) => { const out = [0]; for (const b of bays) out.push(out[out.length - 1] + b); const t = out[out.length - 1]; return out.map((x) => x - t / 2); };
const oddRound = (x) => Math.max(1, 2 * Math.round((x - 1) / 2) + 1);

/** 梁枋盒体：正背面 UV u 0..1（沿长），v 0..1（自下而上），其余面取箍头色 */
function beamGeo(L, h, t) {
  const g = boxGeo(L, h, t);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    if (f === 4 || f === 5) { const u0 = uv.getX(i) / L, v0 = uv.getY(i) / h; uv.setXY(i, f === 5 ? 1 - u0 : u0, v0); }
    else uv.setXY(i, 0.015, 0.5);
  }
  return g;
}

/**
 * 推导结构参数（当只给出屋檐外轮廓 eaveW × eaveD 时）。返回完整 spec（不修改入参）。
 */
export function resolveHallSpec(spec0) {
  const s = { ...spec0 };
  const g = GRADES[s.grade ?? 4];
  s.grade = s.grade ?? 4;
  s.detail = s.detail ?? (s.grade <= 2 ? 3 : 2);
  const dg = s.dougong === undefined ? (g.kou > 0 ? { kou: g.kou, cai: g.cai } : false) : s.dougong;
  s.dougong = dg ? { kou: dg.kou ?? g.kou ?? 0.07, cai: dg.cai ?? g.cai ?? 3 } : false;
  s.caihua = s.caihua ?? g.caihua;
  const kou = s.dougong ? s.dougong.kou : 0;
  const reach = s.dougong ? dougongReach(s.dougong.cai) * kou : 0;
  // 柱网
  if (!s.bays || !s.depthBays) {
    let colW = s.colW, colD = s.colD;
    if (colW === undefined) {
      const m = Math.min(s.eaveW, s.eaveD);
      const ovh = s.overhang ?? (s.dougong ? reach + clamp(21 * kou, 0.9, 2.4) : clamp(0.09 * m + 0.45, 0.55, 1.4));
      colW = s.eaveW - 2 * ovh; colD = s.eaveD - 2 * ovh;
      s.overhang = ovh;
    }
    colW = Math.max(colW, 1.2); colD = Math.max(colD, 1.2);
    const corr = s.corridor === true ? clamp(colD * 0.16, 1.2, 3.2) : s.corridor || 0;
    const nB = s.nBays ?? oddRound(colW / (s.bayHint ?? g.bay));
    const nD = s.nDepth ?? clamp(Math.round(colD / ((s.bayHint ?? g.bay) * 1.05)), 1, 6);
    s.bays = s.bays ?? bayWidths(colW, nB);
    s.depthBays = s.depthBays ?? bayWidths(colD, nD, { corridor: corr && nD >= 3 ? corr : 0, taper: 1 });
    s.corridorDepth = corr && nD >= 3 ? s.depthBays[0] : 0;
  }
  const colW = s.bays.reduce((a, b) => a + b, 0), colD = s.depthBays.reduce((a, b) => a + b, 0);
  s.colW = colW; s.colD = colD;
  if (s.overhang === undefined) s.overhang = s.eaveW ? (s.eaveW - colW) / 2 : (s.dougong ? reach + clamp(21 * kou, 0.9, 2.4) : clamp(0.09 * Math.min(colW, colD) + 0.45, 0.55, 1.4));
  s.eaveW = s.eaveW ?? colW + 2 * s.overhang;
  s.eaveD = s.eaveD ?? colD + 2 * s.overhang;
  s.colH = s.colH ?? clamp(0.36 * Math.min(colD, 26) + 1.6 + (s.dougong ? 0.6 : 0), 2.5, 12.5);
  s.colDia = s.colDia ?? clamp(s.dougong ? 6 * kou : s.colH / 11, 0.2, 1.1);
  const p = s.platform === false ? { h: 0 } : { ...(s.platform || {}) };
  p.h = p.h ?? g.ph;
  p.style = p.style ?? (s.grade <= 2 ? 'xumizuo' : 'plain');
  p.margin = p.margin ?? clamp(s.overhang * 0.55, 0.45, 2.6);
  s.platform = p;
  return s;
}

/**
 * 建造殿堂/门殿/亭/房屋。
 * spec（未列出的可省略，由 resolveHallSpec 推导）：
 *   kind: 'hall'（默认）| 'gate'（门殿：中柱缝设板门，前后敞开）| 'pavilion'（亭/敞轩：只有柱子与坐凳）| 'corridor'（廊庑：前檐敞廊或门窗）
 *   eaveW, eaveD：屋檐外轮廓（来自测绘）；或 bays/depthBays（各间宽数组）
 *   nBays, nDepth, corridor（true/米：前后廊深）, colH, colDia, grade(1..5)
 *   platform: {h, style, margin, stairs:[{side:'S'|'N'|'E'|'W', w, x, yulu, run}], railing: false|'marble'|'marble_dragon'} | false
 *   dougong: {kou, cai} | false;  caihua: 'hexi'|'xuanzi'|'sushi'|'none'
 *   roof: buildRoof 参数（type 必填，其余可省：w/d/y/rise 自动）
 *   double: { inset: 米(上檐柱网自檐柱网内收，默认首末间宽), upperH: 下檐顶到上檐额枋底的高差, lowerRise }
 *   front/back/left/right: 'auto' | 数组（每间 'door'|'window'|'wall'|'open'|'gate'|'zhizhai'）| 单值
 *   wallMat: 墙身材质；lattice；plaque: 匾额文字
 * 返回 info：{ colsX, colsZ, topY（屋脊顶）, eaveY, platformTop, spec }
 */
export function buildHall(ctx, spec0) {
  const s = resolveHallSpec(spec0);
  const kind = s.kind || 'hall';
  const p = s.platform;
  const y0 = p.h;
  const colsX = cumul(s.bays), colsZ = cumul(s.depthBays);
  const hw = s.colW / 2, hd = s.colD / 2;
  const D = s.colDia;
  const info = { colsX, colsZ, platformTop: y0, spec: s };

  // ---- 台基 ----
  if (p.h > 0) {
    const m = p.margin;
    const pw = p.w ?? s.colW + 2 * m, pd = p.d ?? s.colD + 2 * m;
    buildPlatform(ctx, { w: pw, d: pd, h: p.h, style: p.style, poly: p.poly });
    if (p.railing) buildRailing(ctx, { path: [[-pw / 2 + 0.3, -pd / 2 + 0.3], [pw / 2 - 0.3, -pd / 2 + 0.3], [pw / 2 - 0.3, pd / 2 - 0.3], [-pw / 2 + 0.3, pd / 2 - 0.3]], closed: true, y: p.h, style: p.railing === true ? 'marble' : p.railing, gaps: p.railingGaps });
    const stairs = p.stairs ?? defaultStairs(s, kind);
    for (const st of stairs) {
      const side = st.side || 'S';
      const w = st.w ?? s.bays[Math.floor(s.bays.length / 2)] * 0.9;
      const run = st.run ?? p.h / 0.48;
      const off = { S: [st.x ?? 0, pd / 2, 0], N: [-(st.x ?? 0), -pd / 2, Math.PI], E: [pw / 2, -(st.x ?? 0), Math.PI / 2], W: [-pw / 2, st.x ?? 0, -Math.PI / 2] }[side];
      const sc = side === 'E' || side === 'W' ? ctx.at(off[0], 0, off[1], off[2]) : ctx.at(off[0], 0, off[1], off[2]);
      buildStairs(sc, { w, h: p.h, run, style: st.style ?? (p.style === 'xumizuo' ? 'marble' : 'stone'), yulu: st.yulu, railings: st.railings, chuidai: true });
    }
    info.platformW = pw; info.platformD = pd;
  }

  // ---- 柱网 ----
  const corr = s.corridorDepth || 0;
  const isOpen = kind === 'pavilion';
  const colTop = y0 + s.colH;
  const dbl = s.double ? { ...s.double } : null;
  // 可见的柱：檐柱一圈；有廊时加金柱缝（门窗所在）；门殿加中柱缝。其余室内柱不可见，省略。重檐金柱另建。
  const rowsZ = new Set();
  if (corr && !dbl) { rowsZ.add(1); rowsZ.add(colsZ.length - 2); }
  if (kind === 'gate') rowsZ.add(Math.floor(colsZ.length / 2));
  for (let i = 0; i < colsX.length; i++) for (let j = 0; j < colsZ.length; j++) {
    const edge = i === 0 || j === 0 || i === colsX.length - 1 || j === colsZ.length - 1;
    if (!edge && !rowsZ.has(j)) continue;
    const x = colsX[i], z = colsZ[j];
    ctx.place('col:wood_red', x, y0, z, 0, [D, s.colH, D]);
    ctx.place('zhuchu', x, y0, z, 0, [D, D, D]);
  }

  // ---- 梁枋（檐柱一圈） ----
  const beamH = clamp(D * 0.95, 0.2, 1.0);
  const yBeamTop = colTop;
  const caihuaMat = s.caihua === 'none' ? 'wood_red' : `beam_${s.caihua}`;
  ringBeams(ctx, colsX, colsZ, yBeamTop, beamH, D, caihuaMat, s.dougong);

  // ---- 立面（门窗/墙） ----
  const yDoorTop = yBeamTop - beamH * (s.dougong ? 2.1 : 1.6);
  if (!isOpen) buildFacades(ctx, s, colsX, colsZ, y0, yDoorTop, D, corr, kind);
  else if (s.bench !== false) {
    // 亭：坐凳栏杆
    const ring = [[colsX[0], colsZ[0]], [colsX[colsX.length - 1], colsZ[0]], [colsX[colsX.length - 1], colsZ[colsZ.length - 1]], [colsX[0], colsZ[colsZ.length - 1]]];
    for (let k = 0; k < 4; k++) {
      const a = ring[k], b = ring[(k + 1) % 4];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const c = ctx.at((a[0] + b[0]) / 2, y0, (a[1] + b[1]) / 2, -Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI);
      if (k === 0 && kind === 'pavilion') continue;
      buildCorridorTrim(c, { w: L - D, h: yDoorTop - y0, style: 'green', bench: true });
    }
  }

  // ---- 斗拱 ----
  let eaveBase = yBeamTop + (s.dougong ? beamH * 0.35 : 0);
  if (s.dougong) {
    const r = placeDougong(ctx, { colsX, colsZ, y: eaveBase, kou: s.dougong.kou, cai: dbl ? (s.dougong.lowerCai ?? Math.max(3, s.dougong.cai - 2)) : s.dougong.cai });
    eaveBase = r.top;
  } else {
    // 檐檩
    for (const [a, b, fixed, alongX] of [[colsX[0], colsX[colsX.length - 1], colsZ[0], true], [colsX[0], colsX[colsX.length - 1], colsZ[colsZ.length - 1], true], [colsZ[0], colsZ[colsZ.length - 1], colsX[0], false], [colsZ[0], colsZ[colsZ.length - 1], colsX[colsX.length - 1], false]]) {
      const L = b - a + D;
      const g = cylGeo(D * 0.45, D * 0.45, L, 10, false);
      g.rotateZ(Math.PI / 2);
      g.translate(-L / 2, 0, 0);
      const c = alongX ? ctx.at((a + b) / 2, eaveBase + D * 0.2, fixed) : ctx.at(fixed, eaveBase + D * 0.2, (a + b) / 2, Math.PI / 2);
      c.add('beam_xuanzi', g);
    }
    eaveBase += D * 0.55;
  }
  const kou = s.dougong ? s.dougong.kou : 0.06;

  // ---- 屋顶 ----
  const roof0 = { ...(s.roof || { type: 'yingshan' }) };
  roof0.tile = roof0.tile || s.tile || 'yellow';
  roof0.detail = roof0.detail ?? s.detail;
  if (!dbl) {
    const r = buildRoof(ctx, { overhang: s.overhang, ...roof0, w: roof0.w ?? s.eaveW, d: roof0.d ?? s.eaveD, y: roof0.y ?? eaveBase + kou * 1.5, soffitFull: roof0.soffitFull ?? isOpen, beasts: roof0.beasts ?? GRADES[s.grade].beasts });
    info.eaveY = eaveBase;
    info.plaqueAt = { y: yBeamTop, z: colsZ[colsZ.length - 1] };
    info.topY = (r.ridgeY ?? eaveBase) + (roof0.ridgeH ?? 0.8);
    info.roof = r;
  } else {
    // 重檐：下檐腰檐 + 上层檐柱网（内收 inset）
    const inset = dbl.inset ?? s.bays[0];
    const uw = s.colW - 2 * inset, ud = s.colD - 2 * inset;
    const lowerY = eaveBase + kou * 1.5;
    const wallT = clamp(D * 1.1, 0.4, 1.2);
    const runL = (s.eaveD - ud) / 2 - wallT / 2;
    const lowerRise = dbl.lowerRise ?? runL * 0.5;
    const r1 = buildRoof(ctx, { type: 'skirt', overhang: s.overhang, w: s.eaveW, d: s.eaveD, y: lowerY, rise: lowerRise, inner: { w: uw + wallT, d: ud + wallT }, tile: roof0.tile, ridgeColor: roof0.ridgeColor, detail: s.detail, beasts: roof0.beasts ?? GRADES[s.grade].beasts, lift: roof0.lowerLift });
    const skirtTop = lowerY + lowerRise;
    const upperH = dbl.upperH ?? clamp(0.18 * s.colH + 0.8, 1.2, 3.2);
    const uTop = skirtTop + upperH; // 上檐额枋顶
    // 上层柱（金柱）与围脊板墙
    const ux = colsX.filter((x) => x > -hw + inset - 1e-6 && x < hw - inset + 1e-6);
    const uz = colsZ.filter((z) => z > -hd + inset - 1e-6 && z < hd - inset + 1e-6);
    const uxs = ux.length >= 2 ? ux : [-uw / 2, uw / 2], uzs = uz.length >= 2 ? uz : [-ud / 2, ud / 2];
    for (const x of uxs) for (const z of [uzs[0], uzs[uzs.length - 1]]) ctx.place('col:wood_red', x, y0, z, 0, [D, uTop - y0, D]);
    for (const z of uzs.slice(1, -1)) for (const x of [uxs[0], uxs[uxs.length - 1]]) ctx.place('col:wood_red', x, y0, z, 0, [D, uTop - y0, D]);
    // 上层围护（下檐顶至上檐额枋之间：承椽枋/围脊板，红色板墙）
    const bandH = uTop - beamH * 2 - skirtTop + 0.4;
    for (const [L, x, z, rot] of [[uw, 0, ud / 2, 0], [uw, 0, -ud / 2, Math.PI], [ud, uw / 2, 0, Math.PI / 2], [ud, -uw / 2, 0, -Math.PI / 2]]) {
      const g = boxGeo(L, bandH, wallT * 0.6);
      g.translate(0, skirtTop - 0.4 + bandH / 2, 0);
      ctx.at(x, 0, z, rot).add('board_red', g);
    }
    ringBeams(ctx, uxs, uzs, uTop, beamH, D, caihuaMat, s.dougong);
    let uBase = uTop + (s.dougong ? beamH * 0.35 : 0);
    let ovhU = s.overhang;
    if (s.dougong) {
      const r = placeDougong(ctx, { colsX: uxs, colsZ: uzs, y: uBase, kou: s.dougong.kou, cai: s.dougong.cai });
      ovhU = dougongReach(s.dougong.cai) * s.dougong.kou + clamp(21 * s.dougong.kou, 0.9, 2.4);
      uBase = r.top;
    }
    const uEW = roof0.w ?? uw + 2 * ovhU, uED = roof0.d ?? ud + 2 * ovhU;
    const r2 = buildRoof(ctx, { overhang: ovhU, ...roof0, w: uEW, d: uED, y: roof0.y ?? uBase + kou * 1.5, beasts: roof0.beasts ?? GRADES[s.grade].beasts });
    info.eaveY = lowerY;
    info.upperEaveY = uBase;
    info.plaqueAt = { y: uTop, z: uzs[uzs.length - 1] };
    info.topY = (r2.ridgeY ?? uBase) + (roof0.ridgeH ?? 1);
    info.roof = r2;
    info.skirt = r1;
  }

  // ---- 匾额 ----
  if (s.plaque && info.plaqueAt) {
    if (plaqueHook) plaqueHook(ctx, s, info);
    else {
      // 竖匾：悬于正面明间额枋之上，略前倾
      const text = s.plaque, vertical = s.plaqueVertical ?? true;
      const mid = s.bays[Math.floor(s.bays.length / 2)];
      const ch = s.plaqueCharH ?? clamp(mid * 0.11, 0.22, 0.9);
      const sz = plaqueSize(text, vertical);
      const w = sz.w * ch, h = sz.h * ch;
      const c = ctx.at(0, info.plaqueAt.y + h * 0.12, info.plaqueAt.z + D * 0.55 + 0.08).rot(-0.12, 0, 0);
      const face = new THREE.PlaneGeometry(w, h);
      face.translate(0, 0, 0.06);
      c.add(makePlaque(text, { vertical, style: s.plaqueStyle || 'blue' }), face);
      const back = boxGeo(w * 0.98, h * 0.98, 0.1);
      c.add('board_red', back);
    }
  }
  return info;
}

let plaqueHook = null;
/** 由匾额模块注册：fn(ctx, spec, info) */
export function setPlaqueHook(fn) { plaqueHook = fn; }

function defaultStairs(s, kind) {
  const p = s.platform;
  if (p.h < 0.2) return [];
  const mid = s.bays[Math.floor(s.bays.length / 2)];
  const out = [{ side: 'S', w: mid * 0.92 }];
  if (kind === 'gate' || s.grade <= 3) out.push({ side: 'N', w: mid * 0.92 });
  return out;
}

/** 一圈额枋（大额枋 + 由额垫板 + 小额枋 + 平板枋） */
function ringBeams(ctx, colsX, colsZ, yTop, bh, D, mat, dougong) {
  const t = D * 0.85;
  const runs = [
    [colsX, (a, b) => [(a + b) / 2, colsZ[colsZ.length - 1]], 0],
    [colsX, (a, b) => [(a + b) / 2, colsZ[0]], Math.PI],
    [colsZ, (a, b) => [colsX[colsX.length - 1], (a + b) / 2], Math.PI / 2],
    [colsZ, (a, b) => [colsX[0], (a + b) / 2], -Math.PI / 2],
  ];
  for (const [cols, at, rot] of runs) {
    for (let i = 0; i < cols.length - 1; i++) {
      const L = cols[i + 1] - cols[i];
      const [x, z] = at(cols[i], cols[i + 1]);
      const c = ctx.at(x, 0, z, rot);
      // 大额枋
      const g1 = beamGeo(L, bh, t); g1.translate(0, yTop - bh / 2, 0);
      c.add(mat, g1);
      if (dougong) {
        // 由额垫板 + 小额枋
        const g2 = boxGeo(L, bh * 0.5, t * 0.5); g2.translate(0, yTop - bh * 1.25, 0);
        c.add('board_red', g2);
        const g3 = beamGeo(L, bh * 0.6, t * 0.9); g3.translate(0, yTop - bh * 1.8, 0);
        c.add(mat, g3);
        // 平板枋
        const g4 = boxGeo(L + D * 0.2, bh * 0.35, t * 1.15); g4.translate(0, yTop + bh * 0.175, 0);
        c.add('board_green', g4);
      } else {
        // 小式：垫板
        const g2 = boxGeo(L, bh * 0.45, t * 0.5); g2.translate(0, yTop + bh * 0.22, 0);
        c.add('board_red', g2);
      }
    }
  }
}

/** 四面立面装修与墙体 */
function buildFacades(ctx, s, colsX, colsZ, y0, yTop, D, corr, kind) {
  const nX = colsX.length - 1, nZ = colsZ.length - 1;
  const hgt = yTop - y0;
  const front = expandSide(s.front ?? 'auto', nX, 'front', s, kind);
  const back = expandSide(s.back ?? 'auto', nX, 'back', s, kind);
  const left = expandSide(s.left ?? s.sides ?? 'auto', nZ, 'side', s, kind);
  const right = expandSide(s.right ?? s.sides ?? 'auto', nZ, 'side', s, kind);
  const wallMat = s.wallMat || 'wall_red';
  // 门殿：门在中柱缝（z=0 处，若有偶数进深则取中间柱缝）
  const zF = kind === 'gate' ? colsZ[Math.floor(colsZ.length / 2)] : corr ? colsZ[colsZ.length - 2] : colsZ[colsZ.length - 1];
  const zB = kind === 'gate' ? null : (corr && s.backCorridor !== false && colsZ.length > 3) ? colsZ[1] : colsZ[0];
  const xL = colsX[0], xR = colsX[colsX.length - 1];
  const zLo = kind === 'gate' ? colsZ[0] : zB, zHi = kind === 'gate' ? colsZ[colsZ.length - 1] : zF;
  const opts = { lattice: s.lattice, sill: s.sill, sillMat: s.sillMat, wallMat, studs: s.studs };
  // 前檐
  for (let i = 0; i < nX; i++) {
    const w = colsX[i + 1] - colsX[i] - D * 0.9;
    const c = ctx.at((colsX[i] + colsX[i + 1]) / 2, y0, zF);
    buildBay(c, { ...opts, w, h: hgt, type: front[i] });
  }
  // 后檐
  if (zB !== null) for (let i = 0; i < nX; i++) {
    const w = colsX[i + 1] - colsX[i] - D * 0.9;
    const c = ctx.at((colsX[i] + colsX[i + 1]) / 2, y0, zB, Math.PI);
    buildBay(c, { ...opts, w, h: hgt, type: back[i] });
  }
  // 山面（墙/窗）：只在围护范围内
  for (const [types, x, rot] of [[right, xR, Math.PI / 2], [left, xL, -Math.PI / 2]]) {
    for (let j = 0; j < nZ; j++) {
      const za = colsZ[j], zb = colsZ[j + 1];
      if (kind !== 'gate' && (zb <= zLo + 1e-6 || za >= zHi - 1e-6)) continue;
      const a = Math.max(za, zLo), b = Math.min(zb, zHi);
      const w = b - a - D * 0.9;
      if (w <= 0.1) continue;
      const c = ctx.at(x, y0, (a + b) / 2, rot);
      buildBay(c, { ...opts, w, h: hgt, type: types[j] });
    }
  }
  // 门殿：中柱缝两侧山墙之外的前后廊敞开（不建）
}

function expandSide(v, n, which, s, kind) {
  if (Array.isArray(v)) return Array.from({ length: n }, (_, i) => v[i] ?? v[v.length - 1]);
  if (v !== 'auto') return Array(n).fill(v);
  const mid = (n - 1) / 2;
  if (kind === 'gate') {
    if (which === 'side') return Array(n).fill('wall');
    // 门殿：中间 1/3/5 间开门，其余为墙
    const nd = n >= 7 ? 3 : n >= 3 ? (s.gateDoors ?? 3) : 1;
    return Array.from({ length: n }, (_, i) => (Math.abs(i - mid) < nd / 2 ? 'gate' : 'wall'));
  }
  if (which === 'side') return Array(n).fill('wall');
  if (which === 'back') {
    if (s.grade <= 3 && n >= 3) return Array.from({ length: n }, (_, i) => (i === Math.floor(n / 2) ? 'door' : 'wall'));
    return Array(n).fill('wall');
  }
  // 前檐：中间若干间隔扇门，其余槛窗
  const nd = n >= 9 ? 5 : n >= 5 ? 3 : 1;
  const winType = s.grade >= 5 ? 'zhizhai' : 'window';
  return Array.from({ length: n }, (_, i) => (Math.abs(i - mid) < nd / 2 ? 'door' : winType));
}

/**
 * 多层楼阁（文渊阁、畅音阁、雨花阁、体仁阁、角楼主体等）。
 * spec：与 buildHall 相同的平面参数（eaveW/eaveD 或 bays/depthBays、grade、dougong、caihua、platform、tile），另加
 *   stories: [{ colH, inset(相对下一层每侧内收米数，首层忽略), front/back/left/right, balcony(平座栏杆), skirt(本层顶部是否出腰檐，末层忽略), skirtRise, open }]
 *   roof: 顶层屋顶参数（type 必填）
 * 返回 { topY, storyY:[各层地面高度], colsX, colsZ }
 */
export function buildTower(ctx, spec0) {
  const s = resolveHallSpec({ ...spec0, colH: spec0.stories?.[0]?.colH ?? spec0.colH });
  const p = s.platform;
  let y = p.h;
  if (p.h > 0) {
    const m = p.margin;
    const pw = p.w ?? s.colW + 2 * m, pd = p.d ?? s.colD + 2 * m;
    buildPlatform(ctx, { w: pw, d: pd, h: p.h, style: p.style, poly: p.poly });
    for (const st of p.stairs ?? [{ side: 'S' }]) {
      const off = { S: [st.x ?? 0, pd / 2, 0], N: [-(st.x ?? 0), -pd / 2, Math.PI], E: [pw / 2, -(st.x ?? 0), Math.PI / 2], W: [-pw / 2, st.x ?? 0, -Math.PI / 2] }[st.side || 'S'];
      buildStairs(ctx.at(off[0], 0, off[1], off[2]), { w: st.w ?? s.bays[Math.floor(s.bays.length / 2)] * 0.9, h: p.h, run: st.run ?? p.h / 0.48, style: p.style === 'xumizuo' ? 'marble' : 'stone' });
    }
  }
  const stories = spec0.stories || [{ colH: s.colH }];
  let colsX = cumul(s.bays), colsZ = cumul(s.depthBays);
  const D = s.colDia;
  const beamH = clamp(D * 0.95, 0.2, 1.0);
  const caihuaMat = s.caihua === 'none' ? 'wood_red' : `beam_${s.caihua}`;
  const storyY = [];
  const tile = s.roof?.tile || s.tile || 'yellow';
  let ovh = s.overhang;
  let info = {};
  for (let k = 0; k < stories.length; k++) {
    const st = stories[k];
    if (k > 0 && st.inset) {
      const shrink = (cols, d) => { const a = cols[0], b = cols[cols.length - 1]; return cols.map((c) => a + d + ((c - a) * (b - a - 2 * d)) / (b - a)); };
      colsX = shrink(colsX, st.inset); colsZ = shrink(colsZ, st.inset);
    }
    storyY.push(y);
    const colH = st.colH ?? s.colH * (k ? 0.8 : 1);
    for (let i = 0; i < colsX.length; i++) for (let j = 0; j < colsZ.length; j++) {
      if (!(i === 0 || j === 0 || i === colsX.length - 1 || j === colsZ.length - 1)) continue;
      ctx.place('col:wood_red', colsX[i], y, colsZ[j], 0, [D, colH, D]);
      if (k === 0) ctx.place('zhuchu', colsX[i], y, colsZ[j], 0, [D, D, D]);
    }
    const top = y + colH;
    ringBeams(ctx, colsX, colsZ, top, beamH, D, caihuaMat, s.dougong);
    const hgt = top - beamH * (s.dougong ? 2.1 : 1.6) - y;
    if (!st.open) {
      const ss = { ...s, front: st.front ?? (k ? 'window' : s.front), back: st.back ?? (k ? 'window' : s.back), left: st.left ?? s.left, right: st.right ?? s.right, sides: st.sides ?? s.sides };
      buildFacades(ctx, ss, colsX, colsZ, y, y + hgt, D, 0, 'hall');
    }
    let base = top + (s.dougong ? beamH * 0.35 : 0);
    const last = k === stories.length - 1;
    if (s.dougong) {
      const cai = last ? s.dougong.cai : Math.max(1, s.dougong.cai - 2);
      base = placeDougong(ctx, { colsX, colsZ, y: base, kou: s.dougong.kou, cai }).top;
    } else base += D * 0.5;
    const cw = colsX[colsX.length - 1] - colsX[0], cd = colsZ[colsZ.length - 1] - colsZ[0];
    if (last) {
      const roof = { ...(s.roof || { type: 'xieshan' }) };
      const r = buildRoof(ctx, { overhang: ovh, ...roof, tile, w: roof.w ?? cw + 2 * ovh, d: roof.d ?? cd + 2 * ovh, y: roof.y ?? base + 0.12, detail: s.detail });
      info = { topY: r.ridgeY + (roof.ridgeH ?? 0.8), roof: r };
      break;
    }
    // 腰檐 + 平座
    const nxt = stories[k + 1];
    const ins = nxt.inset ?? 0;
    const sOvh = clamp(ovh * 0.75, 0.6, 2.4);
    const innerW = cw - 2 * ins + D * 1.2, innerD = cd - 2 * ins + D * 1.2;
    const run = (cd + 2 * sOvh - innerD) / 2;
    const rise = st.skirtRise ?? Math.max(0.6, run * 0.45);
    if (st.skirt !== false) {
      buildRoof(ctx, { type: 'skirt', w: cw + 2 * sOvh, d: cd + 2 * sOvh, y: base + 0.1, rise, inner: { w: innerW, d: innerD }, tile, overhang: sOvh, detail: s.detail, beasts: st.beasts ?? 3 });
      y = base + 0.1 + rise + 0.15;
    } else y = base + 0.2;
    if (nxt.balcony) {
      // 平座：楼板挑出 + 栏杆
      const bw = cw - 2 * ins + 2 * (nxt.balconyDepth ?? 1.1), bd = cd - 2 * ins + 2 * (nxt.balconyDepth ?? 1.1);
      const slab = boxGeo(bw, 0.3, bd); slab.translate(0, y - 0.15, 0);
      ctx.add('wood_red', slab);
      const path = [[-bw / 2 + 0.1, -bd / 2 + 0.1], [bw / 2 - 0.1, -bd / 2 + 0.1], [bw / 2 - 0.1, bd / 2 - 0.1], [-bw / 2 + 0.1, bd / 2 - 0.1]];
      buildRailing(ctx, { path, closed: true, y, style: nxt.balconyStyle || 'wood_red', height: 1.0 });
    }
    ovh = clamp(ovh * 0.95, 0.8, 3);
  }
  return { ...info, storyY, colsX, colsZ };
}

/** 便捷：游廊（单进深敞廊），沿 X 方向长 L，进深 d */
export function buildGallery(ctx, { L, d = 2.6, colH = 2.8, tile = 'grey', juan = true, bays, trim = 'green', y0 = 0.3 }) {
  const n = bays ?? Math.max(1, Math.round(L / 3.2));
  return buildHall(ctx, {
    kind: 'pavilion', bays: Array(n).fill(L / n), depthBays: [d], colH, colDia: 0.24, dougong: false, caihua: 'sushi', grade: 5,
    platform: { h: y0, style: 'plain', margin: 0.4, stairs: [] }, bench: true,
    roof: { type: 'xuanshan', juan, tile, beasts: -1 }, overhang: 0.8,
  });
}

export { GRADES };
