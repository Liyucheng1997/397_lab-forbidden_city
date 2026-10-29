// 屋顶生成器：庑殿 wudian / 歇山 xieshan / 悬山 xuanshan / 硬山 yingshan / 攒尖 cuanjian / 盝顶 luding / 腰檐 skirt
// 卷棚：任意双坡类型加 juan:true（无正脊，脊部圆和）。
//
// 坐标：局部坐标，建筑中心为原点，正面朝 +Z；y 为绝对局部高度。
// 屋面由若干“坡面片”组成（双线性参数化：下边=该片底边，上边=内边/脊），
// 高度 = y + rise * G(s)，s∈[0,1] 为距檐口的归一化水平距离（举折曲线 G 下凹）。
// 角部起翘/出翘为仅依赖平面位置的位移场 → 相邻坡面在戗脊处严格闭合。
import * as THREE from 'three';
import { gridSurface, sweep, merge, fromArrays, clamp } from './geom.js';
import { tileMat, glazeMat } from './materials.js';

const TAU = Math.PI * 2;

/** 举折曲线：G(0)=0，G(1)=1；卷棚在脊部圆和（G'(1)=0） */
function makeProfile(spec) {
  const k = spec.curve ?? 0.55;
  const f = (s) => (1 - k) * s + k * s * s;
  const df = (s) => 1 - k + 2 * k * s;
  if (!spec.juan) return { G: f, dG: df };
  const a = spec.juanStart ?? 0.8;
  const fa = f(a), da = df(a);
  const g = (s) => (s <= a ? f(s) : fa + da * (s - a) - (da / (2 * (1 - a))) * (s - a) ** 2);
  const g1 = g(1);
  return { G: (s) => g(s) / g1, dG: (s) => (s <= a ? df(s) : da - (da / (1 - a)) * (s - a)) / g1 };
}

/** 角部位移场：corners=[{x,z,dx,dz}]（dx,dz 为单位出翘方向） */
function makeDisplace(corners, lift, flare, radius, power = 2.2) {
  if (!corners.length || (lift === 0 && flare === 0)) return () => [0, 0, 0];
  return (x, z) => {
    let best = 0, bc = null;
    for (const c of corners) {
      const w = 1 - Math.hypot(x - c.x, z - c.z) / radius;
      if (w > best) { best = w; bc = c; }
    }
    if (!bc) return [0, 0, 0];
    const w = best ** power;
    return [bc.dx * flare * w, lift * w, bc.dz * flare * w];
  };
}

// 余弦分布（两端加密，利于角部曲线）
const cosSpace = (n, dense = 0.7) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return (1 - dense) * t + dense * (0.5 - 0.5 * Math.cos(Math.PI * t)); });

class RoofBuilder {
  constructor(ctx, spec) {
    this.ctx = ctx;
    this.spec = spec;
    this.tile = spec.tile || 'yellow';
    this.mat = tileMat(this.tile);
    this.glaze = glazeMat(spec.ridgeColor || this.tile);
    this.y0 = spec.y;
    this.rise = spec.rise;
    const P = makeProfile(spec);
    this.G = P.G; this.dG = P.dG;
    this.detail = spec.detail ?? 2;
    this.eaves = []; // 檐口折线（顶边，已位移）
    this.hips = []; // {path:[[x,y,z]...] 自上而下, beasts}
    this.geos = { tile: [], glaze: [], band: [], soffit: [], gable: [], bofeng: [], gableWall: [] };
  }
  /** 坡长表：s -> 从檐口沿坡面的实长 */
  arcTable(run) {
    const N = 64, tab = [0];
    for (let i = 1; i <= N; i++) {
      const s0 = (i - 1) / N, s1 = i / N;
      const dy = this.rise * (this.G(s1) - this.G(s0));
      tab.push(tab[i - 1] + Math.hypot(run / N, dy));
    }
    return (s) => { const f = clamp(s, 0, 1) * N, i = Math.min(N - 1, Math.floor(f)); return tab[i] + (tab[i + 1] - tab[i]) * (f - i); };
  }
  point(px, pz, s, disp, yOff = 0) {
    const [dx, dy, dz] = disp(px, pz);
    return [px + dx, this.y0 + this.rise * this.G(s) + dy + yOff, pz + dz];
  }
  /**
   * 坡面片：E0→E1 为底边（平面坐标 [x,z]），I0→I1 为上边；s0/s1 为底边/上边的归一化距离；
   * eaveO/eaveDir：用于 UV 的檐口原点与方向；run：该坡从檐口到脊的水平距离
   */
  patch({ E0, E1, I0, I1, s0 = 0, s1 = 1, eaveO, eaveDir, run, nu, nv, ts, disp, isEave = true, soffit = 0, band = 0 }) {
    const arc = this.arcTable(run);
    ts = ts || cosSpace(nu);
    nv = nv || clamp(Math.round((s1 - s0) * run / 0.9), 3, 16);
    const grid = [], uvg = [];
    for (const t of ts) {
      const row = [], urow = [];
      const bx = E0[0] + (E1[0] - E0[0]) * t, bz = E0[1] + (E1[1] - E0[1]) * t;
      const tx = I0[0] + (I1[0] - I0[0]) * t, tz = I0[1] + (I1[1] - I0[1]) * t;
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        const px = bx + (tx - bx) * v, pz = bz + (tz - bz) * v;
        const s = s0 + (s1 - s0) * v;
        row.push(this.point(px, pz, s, disp));
        urow.push([(px - eaveO[0]) * eaveDir[0] + (pz - eaveO[1]) * eaveDir[1], arc(s)]);
      }
      grid.push(row); uvg.push(urow);
    }
    const g = gridSurface(grid, uvg);
    // 保证法线朝上
    const ny = g.attributes.normal.getY(Math.floor(g.attributes.normal.count / 2));
    this.geos.tile.push(ny < 0 ? gridSurface(grid, uvg, true) : g);
    if (isEave) {
      const top = grid.map((r) => r[0]);
      this.eaves.push({ pts: top, dir: eaveDir });
      if (band > 0) this.eaveBand(top, band, eaveDir);
      if (soffit > 0) this.soffit({ E0, E1, I0, I1, s0, s1, eaveO, eaveDir, run, ts, disp, depth: soffit, band });
    }
    return grid;
  }
  eaveBand(top, h, eaveDir) {
    const grid = [], uvg = [];
    let acc = 0;
    for (let i = 0; i < top.length; i++) {
      if (i > 0) acc += Math.hypot(top[i][0] - top[i - 1][0], top[i][2] - top[i - 1][2]);
      const p = top[i];
      grid.push([[p[0], p[1] - h, p[2]], [p[0], p[1] + 0.02, p[2]]]);
      uvg.push([[acc, 0], [acc, 1]]);
    }
    // 外法线：eaveDir 旋转 90°（指向屋外）
    let g = gridSurface(grid, uvg);
    const n = g.attributes.normal;
    const mid = Math.floor(top.length / 2);
    const out = [this.outward(top[mid])];
    if (n.getX(mid * 2) * out[0][0] + n.getZ(mid * 2) * out[0][1] < 0) g = gridSurface(grid, uvg, true);
    this.geos.band.push(g);
  }
  outward(p) { const l = Math.hypot(p[0], p[2]) || 1; return [p[0] / l, p[2] / l]; }
  /** 檐下（椽望）：沿坡面片自檐口向内 depth 米，整体下移 band 米，法线朝下 */
  soffit({ E0, E1, I0, I1, s0, s1, eaveO, eaveDir, run, ts, disp, depth, band }) {
    const sMax = Math.min(s1, s0 + depth / run);
    const nv = clamp(Math.round(depth / 0.8), 2, 10);
    const grid = [], uvg = [];
    for (const t of ts) {
      const row = [], urow = [];
      const bx = E0[0] + (E1[0] - E0[0]) * t, bz = E0[1] + (E1[1] - E0[1]) * t;
      const tx = I0[0] + (I1[0] - I0[0]) * t, tz = I0[1] + (I1[1] - I0[1]) * t;
      for (let j = 0; j <= nv; j++) {
        const s = s0 + (sMax - s0) * (j / nv);
        const v = (s - s0) / (s1 - s0);
        const px = bx + (tx - bx) * v, pz = bz + (tz - bz) * v;
        row.push(this.point(px, pz, s, disp, -band));
        urow.push([(px - eaveO[0]) * eaveDir[0] + (pz - eaveO[1]) * eaveDir[1], (s - s0) * run]);
      }
      grid.push(row); uvg.push(urow);
    }
    let g = gridSurface(grid, uvg);
    const ny = g.attributes.normal.getY(Math.floor(g.attributes.normal.count / 2));
    if (ny > 0) g = gridSurface(grid, uvg, true);
    this.geos.soffit.push(g);
  }
  /** 屋脊扫掠 */
  ridge(path, h, w, mat = this.glaze, lift = 0) {
    if (path.length < 2) return;
    const prof = ridgeProfile(w, h);
    const p = path.map((q) => [q[0], q[1] + lift, q[2]]);
    const g = sweep(prof, p, { flat: true, caps: true });
    if (g) this.ctx.add(mat, g);
  }
  flush() {
    const c = this.ctx;
    const S = this.spec;
    if (this.geos.tile.length) c.add(this.mat, merge(this.geos.tile));
    if (this.geos.band.length) c.add(S.bandMat || 'eaveband', merge(this.geos.band));
    if (this.geos.soffit.length) c.add('soffit', merge(this.geos.soffit));
    if (this.geos.gable.length) c.add(S.gableMat || 'gable_red', merge(this.geos.gable));
    if (this.geos.bofeng.length) c.add(S.bofengMat || 'bofeng', merge(this.geos.bofeng));
    if (this.geos.gableWall.length) c.add(S.gableWallMat || 'brick_grey', merge(this.geos.gableWall));
  }
}

/** 屋脊截面（宽 w 高 h，底部埋入坡面 0.3h） */
export function ridgeProfile(w, h) {
  const a = w / 2;
  return [
    [-a * 1.05, -0.35 * h], [a * 1.05, -0.35 * h], [a * 1.05, 0.12 * h], [a * 0.86, 0.18 * h], [a * 0.86, 0.7 * h],
    [a, 0.76 * h], [a, 0.86 * h], [a * 0.62, h], [-a * 0.62, h], [-a, 0.86 * h], [-a, 0.76 * h], [-a * 0.86, 0.7 * h],
    [-a * 0.86, 0.18 * h], [-a * 1.05, 0.12 * h],
  ];
}

/** 默认参数（依据檐口尺寸） */
export function roofDefaults(spec) {
  const o = { ...spec };
  if (o.w === undefined && o.r !== undefined) { const n = o.sides || 32; o.w = 2 * o.r * Math.cos(Math.PI / n); }
  const w = o.w, d = o.d ?? o.w;
  const m = Math.min(w, d);
  o.rise = spec.rise ?? 0.62 * (d / 2);
  o.lift = spec.lift ?? clamp(0.03 * m + 0.2, 0.25, 1.6);
  o.flare = spec.flare ?? o.lift * 0.75;
  o.liftLen = spec.liftLen ?? clamp(0.32 * m, 0.8, 11);
  o.band = spec.band ?? clamp(0.012 * m + 0.14, 0.16, 0.7);
  o.ridgeH = spec.ridgeH ?? clamp(0.035 * d + 0.18, 0.25, 1.7);
  o.wenH = spec.wenH ?? Math.max(clamp(0.085 * d, 0.45, 3.4), o.ridgeH * 1.8);
  o.ridgeW = spec.ridgeW ?? Math.min(o.ridgeH * 0.55, o.wenH * 0.28);
  o.beastH = spec.beastH ?? clamp(0.011 * d + 0.12, 0.16, 0.55);
  o.overhang = spec.overhang ?? clamp(0.06 * m + 0.6, 0.7, 3.8);
  return o;
}

/**
 * 主入口。spec：
 *  type, w, d（檐口外轮廓，未计出翘），y（檐口高度），rise（脊高于檐口）
 *  tile 瓦色, ridgeColor, juan, curve, lift, flare, liftLen, band（檐口椽头带高）, overhang（出檐，决定檐下深度）
 *  wudian: ridgeHalf（正脊半长，默认含推山）
 *  xieshan: gableInset（山花自檐口内收距离）
 *  cuanjian: sides(4/6/8/0=圆), r（檐口外接圆半径，sides=4 时可用 w）
 *  skirt/luding: inner {w,d}（腰檐上口 / 盝顶平台）
 *  beasts 走兽数（不含仙人；0 表示只有仙人，-1 表示无），wen（是否正吻）, baoding（宝顶样式）
 *  soffitFull（亭子等开敞建筑：檐下覆盖全部）, gableWallMat, gableMat, bofengMat, noRidge
 * 返回 info：{ ridgeY, eaves, hips, topY }
 */
export function buildRoof(ctx, spec0) {
  const spec = roofDefaults(spec0);
  const t = spec.type;
  const rb = new RoofBuilder(ctx, spec);
  let info;
  if (t === 'wudian') info = buildWudian(rb, spec);
  else if (t === 'xieshan') info = buildXieshan(rb, spec);
  else if (t === 'xuanshan' || t === 'yingshan') info = buildGabled(rb, spec);
  else if (t === 'cuanjian') info = buildCuanjian(rb, spec);
  else if (t === 'skirt' || t === 'luding') info = buildSkirt(rb, spec);
  else if (t === 'flat') info = buildFlat(rb, spec);
  else throw new Error('unknown roof type ' + t);
  rb.flush();
  decorate(rb, spec, info);
  info.eaves = rb.eaves;
  info.hips = rb.hips;
  return info;
}

function rectCorners(hw, hd) {
  const s = Math.SQRT1_2;
  return [
    { x: hw, z: hd, dx: s, dz: s }, { x: -hw, z: hd, dx: -s, dz: s },
    { x: -hw, z: -hd, dx: -s, dz: -s }, { x: hw, z: -hd, dx: s, dz: -s },
  ];
}

function nuFor(len, detail) { return clamp(Math.ceil(len / (detail >= 3 ? 1.2 : 2.0)), 4, detail >= 3 ? 60 : 36); }

// ---------------- 庑殿 ----------------
function buildWudian(rb, S) {
  const hw = S.w / 2, hd = S.d / 2;
  const rh = clamp(S.ridgeHalf ?? (hw - hd + 0.08 * S.w), 0.3, hw - 0.3);
  const disp = makeDisplace(rectCorners(hw, hd), S.lift, S.flare, Math.min(S.liftLen, hd * 0.95, hw * 0.95));
  const nuL = nuFor(S.w, rb.detail), nuS = nuFor(S.d, rb.detail);
  const runE = hw - rh;
  const sofD = S.soffitFull ? 99 : S.overhang;
  // 前后坡（梯形）
  for (const sg of [1, -1]) {
    const E0 = [-hw * sg, hd * sg], E1 = [hw * sg, hd * sg];
    rb.patch({ E0, E1, I0: [-rh * sg, 0], I1: [rh * sg, 0], eaveO: E0, eaveDir: [sg, 0], run: hd, nu: nuL, disp, soffit: sofD, band: S.band });
  }
  // 两山（三角）
  for (const sg of [1, -1]) {
    const E0 = [hw * sg, -hd * sg], E1 = [hw * sg, hd * sg];
    rb.patch({ E0, E1, I0: [rh * sg, 0], I1: [rh * sg, 0], eaveO: E0, eaveDir: [0, sg], run: runE, nu: nuS, disp, soffit: sofD, band: S.band });
  }
  const ridgeY = S.y + S.rise;
  // 垂脊（自脊端至角）
  for (const [cx, cz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const path = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const v = i / N; // 0 脊端 → 1 角
      const px = rh * cx + (hw - rh) * cx * v, pz = hd * cz * v;
      path.push(rb.point(px, pz, 1 - v, disp));
    }
    rb.hips.push({ path, kind: 'chui' });
  }
  return { ridgeY, mainRidge: [[-rh, ridgeY, 0], [rh, ridgeY, 0]], hw, hd };
}

// ---------------- 歇山 ----------------
function buildXieshan(rb, S) {
  const hw = S.w / 2, hd = S.d / 2;
  const inset = clamp(S.gableInset ?? (0.3 * hd + 0.35 * S.overhang), 0.4, Math.min(hd * 0.8, hw * 0.45));
  const gx = hw - inset; // 山花平面 x
  const sJ = inset / hd; // 两山坡顶（博脊处）归一化高度
  const disp = makeDisplace(rectCorners(hw, hd), S.lift, S.flare, Math.min(S.liftLen, inset * 1.6, hd * 0.95));
  const nuL = nuFor(S.w, rb.detail), nuS = nuFor(S.d, rb.detail);
  const ts = cosSpace(nuL);
  const sofD = S.soffitFull ? 99 : S.overhang;
  const upperTop = [];
  for (const sg of [1, -1]) {
    const E0 = [-hw * sg, hd * sg], E1 = [hw * sg, hd * sg];
    const zJ = (hd - inset) * sg;
    rb.patch({ E0, E1, I0: [-gx * sg, zJ], I1: [gx * sg, zJ], s0: 0, s1: sJ, eaveO: E0, eaveDir: [sg, 0], run: hd, nu: nuL, ts, disp, soffit: sofD, band: S.band, nv: clamp(Math.round(inset / 0.8), 3, 10) });
    const g = rb.patch({ E0: [-gx * sg, zJ], E1: [gx * sg, zJ], I0: [-gx * sg, 0], I1: [gx * sg, 0], s0: sJ, s1: 1, eaveO: E0, eaveDir: [sg, 0], run: hd, ts, disp, isEave: false });
    upperTop.push({ sg, grid: g });
  }
  for (const sg of [1, -1]) {
    const E0 = [hw * sg, -hd * sg], E1 = [hw * sg, hd * sg];
    rb.patch({ E0, E1, I0: [gx * sg, -(hd - inset) * sg], I1: [gx * sg, (hd - inset) * sg], s0: 0, s1: sJ, eaveO: E0, eaveDir: [0, sg], run: hd, nu: nuS, disp, soffit: sofD, band: S.band, nv: clamp(Math.round(inset / 0.8), 3, 10) });
  }
  const ridgeY = S.y + S.rise;
  // 山花（竖直三角/五边形），外贴博风
  const yJ = S.y + S.rise * rb.G(sJ);
  for (const sx of [1, -1]) {
    const N = 16;
    const prof = []; // 沿 z 从 -(hd-inset) 到 +(hd-inset) 的上缘
    for (let i = 0; i <= N; i++) {
      const z = -(hd - inset) + (2 * (hd - inset) * i) / N;
      const s = (hd - Math.abs(z)) / hd;
      prof.push(rb.point(gx * sx, z, s, disp));
    }
    const pos = [], uv = [];
    const bx = gx * sx;
    for (let i = 0; i < N; i++) {
      const a = prof[i], b = prof[i + 1];
      const a0 = [bx, yJ, a[2]], b0 = [bx, yJ, b[2]];
      const quad = sx > 0 ? [a0, b, b0, a0, a, b] : [a0, b0, b, a0, b, a];
      for (const q of quad) { pos.push(q[0] + sx * 0.01, q[1], q[2]); uv.push(q[2], q[1]); }
    }
    rb.geos.gable.push(fromArrays(pos, uv));
    // 博风板：沿山花上缘，竖向带
    const bh = clamp(S.band * 1.3, 0.2, 0.9);
    const grid = prof.map((p) => [[p[0] + sx * 0.06, p[1] - bh, p[2]], [p[0] + sx * 0.06, p[1] + 0.05, p[2]]]);
    let acc = 0;
    const uvg = prof.map((p, i) => { if (i) acc += Math.hypot(p[1] - prof[i - 1][1], p[2] - prof[i - 1][2]); return [[acc, 0], [acc, 1]]; });
    rb.geos.bofeng.push(gridSurface(grid, uvg, sx < 0));
  }
  // 垂脊（山花上缘，脊端→博脊交点）+ 戗脊（交点→角）
  for (const [cx, cz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const chui = [];
    const N = 10;
    for (let i = 0; i <= N; i++) { const z = (hd - inset) * cz * (i / N); chui.push(rb.point(gx * cx, z, 1 - (Math.abs(z) / hd), disp)); }
    rb.hips.push({ path: chui, kind: 'chui-xs' });
    const qiang = [];
    for (let i = 0; i <= N; i++) {
      const v = i / N; // 交点 → 角
      const px = gx * cx + inset * cx * v, pz = (hd - inset) * cz + inset * cz * v;
      qiang.push(rb.point(px, pz, sJ * (1 - v), disp));
    }
    rb.hips.push({ path: qiang, kind: 'qiang' });
  }
  return { ridgeY, mainRidge: [[-gx - 0.15, ridgeY, 0], [gx + 0.15, ridgeY, 0]], hw, hd, gx, yJ, inset };
}

// ---------------- 悬山 / 硬山 ----------------
function buildGabled(rb, S) {
  const hw = S.w / 2, hd = S.d / 2;
  const disp = () => [0, 0, 0]; // 双坡无翼角
  const nuL = nuFor(S.w, rb.detail);
  const sofD = S.soffitFull ? 99 : S.overhang;
  const ts = Array.from({ length: nuL + 1 }, (_, i) => i / nuL);
  for (const sg of [1, -1]) {
    const E0 = [-hw * sg, hd * sg], E1 = [hw * sg, hd * sg];
    rb.patch({ E0, E1, I0: [-hw * sg, 0], I1: [hw * sg, 0], eaveO: E0, eaveDir: [sg, 0], run: hd, nu: nuL, ts, disp, soffit: sofD, band: S.band });
  }
  const ridgeY = S.y + S.rise;
  const N = S.juan ? 20 : 10;
  const edge = (sx) => {
    const p = [];
    for (let i = 0; i <= N; i++) { const z = -hd + (2 * hd * i) / N; p.push(rb.point(hw * sx, z, 1 - Math.abs(z) / hd, disp)); }
    return p;
  };
  for (const sx of [1, -1]) {
    const prof = edge(sx);
    if (S.type === 'yingshan') {
      // 硬山：山墙三角（墙厚 t，外皮与屋面端齐平）
      const t = clamp(S.gableThick ?? 0.12 * hd + 0.3, 0.35, 1.0);
      const yb = S.y - S.band - 0.05;
      const poly = prof.map((p) => [p[2], p[1] + 0.08]);
      const g = gableSolid(poly, yb, hw * sx, t, sx);
      rb.geos.gableWall.push(g);
      // 山墙上沿博缝（砖），用于遮挡瓦端
      const grid = prof.map((p) => [[hw * sx + sx * 0.02, p[1] - 0.25, p[2]], [hw * sx + sx * 0.02, p[1] + 0.12, p[2]]]);
      let acc = 0;
      const uvg = prof.map((p, i) => { if (i) acc += Math.hypot(p[1] - prof[i - 1][1], p[2] - prof[i - 1][2]); return [[acc, 0], [acc, 1]]; });
      rb.geos.bofeng.push(gridSurface(grid, uvg, sx < 0));
    } else {
      // 悬山：博风板沿山面屋檐下
      const bh = clamp(S.band * 1.4, 0.2, 0.8);
      const grid = prof.map((p) => [[p[0] + sx * 0.03, p[1] - bh, p[2]], [p[0] + sx * 0.03, p[1] + 0.03, p[2]]]);
      let acc = 0;
      const uvg = prof.map((p, i) => { if (i) acc += Math.hypot(p[1] - prof[i - 1][1], p[2] - prof[i - 1][2]); return [[acc, 0], [acc, 1]]; });
      rb.geos.bofeng.push(gridSurface(grid, uvg, sx < 0));
      // 山花（悬山的山面墙由墙体负责，这里补出际内的三角封板）
      const inX = (hw - (S.gableOverhang ?? clamp(0.1 * hd + 0.3, 0.4, 1.2))) * sx;
      const pos = [], uv = [];
      const yb = S.y - S.band;
      for (let i = 0; i < N; i++) {
        const a = prof[i], b = prof[i + 1];
        const a0 = [inX, yb, a[2]], b0 = [inX, yb, b[2]];
        const A = [inX, a[1] - 0.05, a[2]], B = [inX, b[1] - 0.05, b[2]];
        const quad = sx > 0 ? [a0, b0, B, a0, B, A] : [a0, B, b0, a0, A, B];
        for (const q of quad) { pos.push(...q); uv.push(q[2], q[1]); }
      }
      rb.geos.gable.push(fromArrays(pos, uv));
    }
    // 垂脊沿山面（排山脊）
    rb.hips.push({ path: prof.slice(0, Math.floor(N / 2) + 1).reverse(), kind: 'pai', sx });
    rb.hips.push({ path: prof.slice(Math.floor(N / 2)), kind: 'pai', sx });
  }
  return { ridgeY, mainRidge: [[-hw, ridgeY, 0], [hw, ridgeY, 0]], hw, hd };
}

/** 硬山山尖实体：poly=[[z,y]...]（上缘），底 yb，墙面在 x=x0 外皮，向内厚 t */
function gableSolid(poly, yb, x0, t, sx) {
  const pos = [], uv = [];
  const xi = x0 - sx * t;
  const n = poly.length;
  const face = (x, flip) => {
    for (let i = 0; i < n - 1; i++) {
      const [za, ya] = poly[i], [zb, yb2] = poly[i + 1];
      const q = [[x, yb, za], [x, yb, zb], [x, yb2, zb], [x, ya, za]];
      const order = (sx > 0) !== flip ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const k of order) { pos.push(...q[k]); uv.push(q[k][2], q[k][1]); }
    }
  };
  face(x0, false);
  face(xi, true);
  // 顶面
  for (let i = 0; i < n - 1; i++) {
    const [za, ya] = poly[i], [zb, yb2] = poly[i + 1];
    const q = [[x0, ya, za], [x0, yb2, zb], [xi, yb2, zb], [xi, ya, za]];
    const order = sx > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (const k of order) { pos.push(...q[k]); uv.push(q[k][0], q[k][2]); }
  }
  return fromArrays(pos, uv);
}

// ---------------- 攒尖 ----------------
function buildCuanjian(rb, S) {
  const N = S.sides ?? 4;
  const round = N === 0 || N > 12;
  const n = round ? 32 : N;
  const R = S.r ?? (n === 4 ? (S.w / 2) * Math.SQRT2 : S.w / 2 / Math.cos(Math.PI / n));
  const ap = R * Math.cos(Math.PI / n);
  const corners = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) * TAU) / n;
    corners.push({ x: R * Math.sin(a), z: R * Math.cos(a), dx: Math.sin(a), dz: Math.cos(a) });
  }
  const edgeLen = 2 * R * Math.sin(Math.PI / n);
  const disp = round ? () => [0, 0, 0] : makeDisplace(corners, S.lift, S.flare, Math.min(S.liftLen, edgeLen * 0.48, ap * 0.9));
  const nu = round ? 3 : nuFor(edgeLen, rb.detail);
  const sofD = S.soffitFull ? 99 : S.overhang;
  for (let i = 0; i < n; i++) {
    const c0 = corners[(i - 1 + n) % n], c1 = corners[i];
    const E0 = [c1.x, c1.z], E1 = [c0.x, c0.z];
    const dir = [E1[0] - E0[0], E1[1] - E0[1]];
    const L = Math.hypot(...dir);
    rb.patch({ E0, E1, I0: [0, 0], I1: [0, 0], eaveO: E0, eaveDir: [dir[0] / L, dir[1] / L], run: ap, nu, disp, soffit: sofD, band: S.band, ts: round ? [0, 0.5, 1] : undefined });
  }
  const ridgeY = S.y + S.rise;
  if (!round) for (const c of corners) {
    const path = [];
    const M = 12;
    for (let j = 0; j <= M; j++) { const v = j / M; path.push(rb.point(c.x * v, c.z * v, 1 - v, disp)); }
    rb.hips.push({ path, kind: 'jiao' });
  }
  return { ridgeY, apex: [0, ridgeY, 0], R, ap, n };
}

// ---------------- 腰檐 / 盝顶 ----------------
function buildSkirt(rb, S) {
  const hw = S.w / 2, hd = S.d / 2;
  const iw = S.inner.w / 2, id = S.inner.d / 2;
  const disp = makeDisplace(rectCorners(hw, hd), S.lift, S.flare, Math.min(S.liftLen, (hd - id) * 1.2, hd * 0.9));
  const nuL = nuFor(S.w, rb.detail), nuS = nuFor(S.d, rb.detail);
  const runF = hd - id, runE = hw - iw;
  // 两向坡度一致：rise 对应 runF；端坡按 runE 比例
  const sofD = S.soffitFull ? 99 : S.overhang;
  for (const sg of [1, -1]) {
    const E0 = [-hw * sg, hd * sg], E1 = [hw * sg, hd * sg];
    rb.patch({ E0, E1, I0: [-iw * sg, id * sg], I1: [iw * sg, id * sg], eaveO: E0, eaveDir: [sg, 0], run: runF, nu: nuL, disp, soffit: sofD, band: S.band });
  }
  for (const sg of [1, -1]) {
    const E0 = [hw * sg, -hd * sg], E1 = [hw * sg, hd * sg];
    rb.patch({ E0, E1, I0: [iw * sg, -id * sg], I1: [iw * sg, id * sg], eaveO: E0, eaveDir: [0, sg], run: runE, nu: nuS, disp, soffit: sofD, band: S.band });
  }
  const topY = S.y + S.rise;
  for (const [cx, cz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const path = [];
    const M = 10;
    for (let j = 0; j <= M; j++) { const v = j / M; path.push(rb.point(iw * cx + (hw - iw) * cx * v, id * cz + (hd - id) * cz * v, 1 - v, disp)); }
    rb.hips.push({ path, kind: 'jiao' });
  }
  if (S.type === 'luding') rb.ctx.add(rb.mat, flatTop(iw, id, topY));
  return { topY, ridgeY: topY, inner: { iw, id }, hw, hd };
}

function flatTop(iw, id, y) {
  const pos = [-iw, y, -id, -iw, y, id, iw, y, id, -iw, y, -id, iw, y, id, iw, y, -id];
  const uv = [-iw, -id, -iw, id, iw, id, -iw, -id, iw, id, iw, -id];
  return fromArrays(pos, uv);
}

function buildFlat(rb, S) {
  const hw = S.w / 2, hd = S.d / 2;
  rb.ctx.add('roof_flat_grey', flatTop(hw, hd, S.y));
  return { ridgeY: S.y, hw, hd };
}

// ---------------- 脊饰：正脊、吻、垂脊、走兽、套兽、宝顶 ----------------
function decorate(rb, S, info) {
  const c0 = rb.ctx;
  // 小屋顶的脊饰使用自动简化的低模原型
  const lo = S.ornamentLOD ?? Math.min(S.w, S.d ?? S.w) < 16;
  const c = lo ? { place: (k, ...a) => c0.place(k.startsWith('baoding') ? k : k + '@lo', ...a), add: (...a) => c0.add(...a) } : c0;
  const col = S.ridgeColor || S.tile || 'yellow';
  const hr = S.ridgeH, wr = S.ridgeW;
  const noOrn = S.ornaments === false;
  // 正脊 + 正吻
  if (info.mainRidge && !S.juan && !S.noRidge) {
    const [a, b] = info.mainRidge;
    rb.ridge([a, b], hr, wr);
    if (S.wen !== false && !noOrn) {
      const wenKey = `wen:${col}`;
      c.place(wenKey, b[0], b[1] - hr * 0.1, b[2], 0, S.wenH);
      c.place(wenKey, a[0], a[1] - hr * 0.1, a[2], Math.PI, S.wenH);
    }
  }
  if (S.juan && info.mainRidge) {
    // 卷棚：脊部罗锅瓦（略加厚的圆脊）
    const [a, b] = info.mainRidge;
    rb.ridge([[a[0], a[1] - hr * 0.35, 0], [b[0], b[1] - hr * 0.35, 0]], hr * 0.5, wr * 1.6, rb.mat);
  }
  // 盝顶 / 腰檐：围脊
  if ((S.type === 'luding' || S.type === 'skirt') && info.inner) {
    const { iw, id } = info.inner;
    const y = info.topY;
    const path = [[-iw, y, -id], [iw, y, -id], [iw, y, id], [-iw, y, id], [-iw, y, -id]];
    const g = sweep(ridgeProfile(wr * 0.9, hr * (S.type === 'luding' ? 0.9 : 0.75)), path, { flat: true, caps: false });
    c.add(rb.glaze, g);
  }
  // 宝顶
  if (S.type === 'cuanjian' && !noOrn) {
    const h = S.baodingH ?? clamp(0.16 * (info.R || 4), 0.6, 4.2);
    c.place(`baoding:${S.baoding || 'gold'}`, 0, info.ridgeY - 0.1 * h, 0, 0, h);
  }
  // 垂脊 / 戗脊 / 角脊 + 走兽
  const beasts = S.beasts ?? defaultBeasts(S);
  for (const hip of rb.hips) {
    const p = hip.path;
    if (hip.kind === 'pai') {
      if (S.juan) rb.ridge(p, hr * 0.6, wr * 0.8);
      else rb.ridge(p, hr * 0.75, wr * 0.85);
      continue;
    }
    if (hip.kind === 'chui-xs') { rb.ridge(p, hr * 0.62, wr * 0.85); if (!noOrn) placeChuishou(c, p[p.length - 1], p, col, Math.max(S.beastH * 2.3, hr * 0.62 * 1.35)); continue; }
    // 戗脊/垂脊/角脊：上段高，下段（兽前）低
    const total = pathLen(p);
    const sp = S.beastH * 1.25;
    const nb = beasts >= 0 ? beasts + 1 : 0;
    const front = clamp(nb * sp + sp * 0.8, 0, total * 0.6);
    const [upper, lower, cut] = splitPath(p, total - front);
    if (hip.kind === 'qiang') {
      rb.ridge(upper, hr * 0.6, wr * 0.8);
    } else rb.ridge(upper, hr * 0.62, wr * 0.85);
    rb.ridge(lower, hr * 0.5, wr * 0.7);
    if (noOrn) continue;
    placeChuishou(c, cut, p, col, Math.max(S.beastH * 2.2, hr * 0.62 * 1.35));
    // 走兽：自角端向上，仙人在最前
    for (let k = 0; k < nb; k++) {
      const d = total - (sp * 0.45 + k * sp);
      const q = pointAt(p, d);
      const dir = dirAt(p, d);
      const rotY = Math.atan2(dir[0], dir[2]);
      c.place(`beast:${k}:${col}`, q[0], q[1] + hr * 0.45, q[2], rotY, S.beastH);
    }
    // 套兽：角端下方
    const tip = p[p.length - 1];
    const dir = dirAt(p, total);
    c.place(`taoshou:${col}`, tip[0] + dir[0] * 0.05, tip[1] - S.band * 0.9, tip[2] + dir[2] * 0.05, Math.atan2(dir[0], dir[2]), S.band * 1.6);
  }
}

function defaultBeasts(S) {
  const m = Math.min(S.w, S.d ?? S.w);
  if (m > 30) return 9;
  if (m > 18) return 7;
  if (m > 10) return 5;
  if (m > 6) return 3;
  return 1;
}

function placeChuishou(c, q, path, col, h) {
  const n = path.length;
  const a = path[Math.max(0, n - 2)], b = path[n - 1];
  const rotY = Math.atan2(b[0] - a[0], b[2] - a[2]);
  c.place(`chuishou:${col}`, q[0], q[1] + h * 0.15, q[2], rotY, h);
}

function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += dist(p[i], p[i - 1]); return L; }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function pointAt(p, d) {
  for (let i = 1; i < p.length; i++) {
    const L = dist(p[i], p[i - 1]);
    if (d <= L || i === p.length - 1) { const t = clamp(d / L, 0, 1); return [0, 1, 2].map((k) => p[i - 1][k] + (p[i][k] - p[i - 1][k]) * t); }
    d -= L;
  }
  return p[p.length - 1];
}
function dirAt(p, d) {
  for (let i = 1; i < p.length; i++) {
    const L = dist(p[i], p[i - 1]);
    if (d <= L || i === p.length - 1) { const v = [0, 1, 2].map((k) => p[i][k] - p[i - 1][k]); const h = Math.hypot(v[0], v[2]) || 1; return [v[0] / h, 0, v[2] / h]; }
    d -= L;
  }
  return [0, 0, 1];
}
function splitPath(p, d) {
  const up = [p[0]];
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const L = dist(p[i], p[i - 1]);
    if (acc + L >= d) {
      const t = (d - acc) / L;
      const q = [0, 1, 2].map((k) => p[i - 1][k] + (p[i][k] - p[i - 1][k]) * t);
      up.push(q);
      return [up, [q, ...p.slice(i)], q];
    }
    acc += L;
    up.push(p[i]);
  }
  return [p, [p[p.length - 1], p[p.length - 1]], p[p.length - 1]];
}
