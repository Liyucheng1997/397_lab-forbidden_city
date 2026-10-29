// 午门：凹字形墩台（红墙身、汉白玉须弥座、明三暗五券门、拔檐、宇墙、马道）+ 正楼（重檐庑殿九间）
// + 钟鼓亭 + 东西雁翅楼（各十三间）+ 四座重檐四角攒尖阙亭 + 内侧马道坡道
import * as THREE from 'three';
import { offsetPoly, polyTopGeo, fromArrays, clamp } from '../../core/geom.js';
import '../../core/walls.js';
import { hallOn, palaceWall, FS, FE, FW, gateDoors } from './lib.js';

export const WU = { AX: -0.55, ZN: 457.3, ZC: 484.5, ZS: 564.8, XO: 62.75, XI: 40.1, H: 12, BT: 0.22 };
const { AX, ZN, ZC, ZS, XO, XI, H, BT } = WU;

// ---------------- 小工具 ----------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (a) => Math.hypot(a[0], a[1]);

/** 三角形收集器：按期望法线自动定向 */
class Tris {
  constructor() { this.p = []; this.u = []; this.n = []; }
  tri(a, b, c, ua, ub, uc, want) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(...n);
    if (l < 1e-9) return;
    n = n.map((v) => v / l);
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = n.map((v) => -v); }
    this.p.push(...a, ...b, ...c); this.u.push(...ua, ...ub, ...uc); this.n.push(...n, ...n, ...n);
  }
  quad(a, b, c, d, ua, ub, uc, ud, want) { this.tri(a, b, c, ua, ub, uc, want); this.tri(a, c, d, ua, uc, ud, want); }
  geo() { return fromArrays(this.p, this.u, this.n); }
  get empty() { return this.p.length === 0; }
}

/** 券洞轮廓（dx 相对券中，y 自地面）：左脚→左拱脚→券顶→右拱脚→右脚。stoneY 处加点（石砌下碱分界） */
function archOutline(w, hc, stoneY = 1.0, n = 14) {
  const r = w / 2, sp = hc - r, pts = [[-r, 0]];
  if (stoneY > 0 && stoneY < sp) pts.push([-r, stoneY]);
  pts.push([-r, sp]);
  for (let i = 1; i < n; i++) { const a = Math.PI * (1 - i / n); pts.push([r * Math.cos(a), sp + r * Math.sin(a)]); }
  pts.push([r, sp]);
  if (stoneY > 0 && stoneY < sp) pts.push([r, stoneY]);
  pts.push([r, 0]);
  return pts;
}

/**
 * 墙面（含落地券洞缺口）。底边 A→B（y=0），顶边 A2→B2（y=H，收分后），outN 外法线。
 * arches: [{u（沿 A→B 的券中距离）, w, hc}]
 */
function wallFace(T, A, B, A2, B2, outN, arches) {
  const L = len(sub(B, A));
  const M = (u, y) => {
    const t = y / H, f = u / L;
    const bx = A[0] + (B[0] - A[0]) * f, bz = A[1] + (B[1] - A[1]) * f;
    const tx = A2[0] + (B2[0] - A2[0]) * f, tz = A2[1] + (B2[1] - A2[1]) * f;
    return [bx + (tx - bx) * t, y, bz + (tz - bz) * t];
  };
  const cont = [[0, 0]];
  for (const a of [...arches].sort((p, q) => p.u - q.u)) for (const [dx, y] of archOutline(a.w, a.hc, 0)) cont.push([a.u + dx, y]);
  cont.push([L, 0], [L, H], [0, H]);
  const c2 = cont.map(([u, y]) => new THREE.Vector2(u, y));
  const tris = THREE.ShapeUtils.triangulateShape(c2, []);
  const want = [outN[0], 0.02, outN[1]];
  for (const [i, j, k] of tris) T.tri(M(...cont[i]), M(...cont[j]), M(...cont[k]), cont[i], cont[j], cont[k], want);
  return M;
}

/** 券洞内壁：两端口映射 M1(u1+dx,y)、M2(u2+s2·dx,y)，轴心线方向 axisPt(p) 返回指向券轴的向量 */
function tunnel(Tw, Ts, Tf, M1, u1, M2, u2, s2, w, hc, axisWant) {
  const o = archOutline(w, hc, 1.0);
  let acc = 0;
  for (let i = 0; i < o.length - 1; i++) {
    const [dxa, ya] = o[i], [dxb, yb] = o[i + 1];
    const a1 = M1(u1 + dxa, ya), b1 = M1(u1 + dxb, yb), a2 = M2(u2 + s2 * dxa, ya), b2 = M2(u2 + s2 * dxb, yb);
    const l = Math.hypot(dxb - dxa, yb - ya), dep = len(sub([a2[0], a2[2]], [a1[0], a1[2]]));
    const mid = [(a1[0] + b2[0]) / 2, (a1[1] + b2[1]) / 2, (a1[2] + b2[2]) / 2];
    const T = Math.max(ya, yb) <= 1.0001 ? Ts : Tw;
    T.quad(a1, b1, b2, a2, [0, acc], [0, acc + l], [dep, acc + l], [dep, acc], axisWant(mid));
    acc += l;
  }
  // 地面
  const p1 = M1(u1 - w / 2, 0.01), q1 = M1(u1 + w / 2, 0.01), p2 = M2(u2 - s2 * w / 2, 0.01), q2 = M2(u2 + s2 * w / 2, 0.01);
  Tf.quad(p1, q1, q2, p2, [p1[0], p1[2]], [q1[0], q1[2]], [q2[0], q2[2]], [p2[0], p2[2]], [0, 1, 0]);
}

/** 券门门扇（局部：门洞中心 x=0，门面 z=0，自 y=0 起；券宽 w，拱脚 sp） */
function archDoor(ctx, w, sp) {
  const T = new Tris();
  const half = [];
  for (let i = 0; i <= 16; i++) { const a = (Math.PI * i) / 16; half.push([(w / 2) * Math.cos(a), sp + (w / 2) * Math.sin(a)]); }
  for (let i = 0; i < 16; i++) {
    for (const zz of [0.08, -0.08]) T.tri([0, sp, zz], [half[i][0], half[i][1], zz], [half[i + 1][0], half[i + 1][1], zz], [0, sp], half[i], half[i + 1], [0, 0, Math.sign(zz)]);
  }
  ctx.add('board_red', T.geo());
  const lt = new THREE.BoxGeometry(w, 0.26, 0.3); lt.translate(0, sp - 0.13, 0);
  ctx.add('wood_red', lt);
  const lw = w / 2 - 0.02, lh = sp - 0.28;
  const leaf = new THREE.BoxGeometry(lw, lh, 0.14);
  leaf.translate(lw / 2, lh / 2 + 0.02, 0);
  for (const s of [-1, 1]) ctx.at(s * w / 2, 0, 0, 0, [s > 0 ? -1 : 1, 1, 1]).add('gate_door', leaf);
}

/** 沿开放折线挤出截面（截面 [o,y]，o>0 向外；outward 为每段外法线）；两端封口 */
function extrudeRun(ctx, pts, segN, segs, capMat) {
  const n = pts.length;
  const miter = pts.map((_, i) => {
    const a = segN[Math.max(0, i - 1)], b = segN[Math.min(segN.length - 1, i)];
    const d = 1 + a[0] * b[0] + a[1] * b[1];
    return d < 0.2 ? a : [(a[0] + b[0]) / d, (a[1] + b[1]) / d];
  });
  const P = (i, o, y) => [pts[i][0] + miter[i][0] * o, y, pts[i][1] + miter[i][1] * o];
  for (const sg of segs) {
    const T = new Tris();
    let acc = 0;
    const vTot = sg.p.reduce((s, q, k) => (k ? s + Math.hypot(q[0] - sg.p[k - 1][0], q[1] - sg.p[k - 1][1]) : 0), 0);
    for (let i = 0; i < n - 1; i++) {
      const L = len(sub(pts[i + 1], pts[i])), sn = segN[i];
      let vacc = 0;
      for (let k = 0; k < sg.p.length - 1; k++) {
        const [o0, y0] = sg.p[k], [o1, y1] = sg.p[k + 1];
        const dl = Math.hypot(o1 - o0, y1 - y0);
        const v0 = sg.band ? vacc / vTot : y0, v1 = sg.band ? (vacc + dl) / vTot : y1;
        const nn = [y1 - y0, -(o1 - o0)];
        const want = [sn[0] * nn[0], nn[1], sn[1] * nn[0]];
        T.quad(P(i, o0, y0), P(i + 1, o0, y0), P(i + 1, o1, y1), P(i, o1, y1), [acc, v0], [acc + L, v0], [acc + L, v1], [acc, v1], want);
        vacc += dl;
      }
      acc += L;
    }
    ctx.add(sg.mat, T.geo());
  }
  // 端面
  const prof = [];
  for (const q of [[0, segs[0].p[0][1]], ...segs.flatMap((s) => s.p)]) { const l = prof[prof.length - 1]; if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 1e-5) prof.push(q); }
  const c2 = prof.map(([o, y]) => new THREE.Vector2(o, y));
  const tris = THREE.ShapeUtils.triangulateShape(c2, []);
  const T = new Tris();
  for (const [end, i, dir] of [[0, 0, -1], [1, n - 1, 1]]) {
    const sd = sub(pts[Math.min(n - 1, i + (end ? 0 : 1))], pts[Math.max(0, i - (end ? 1 : 0))]);
    const l = len(sd) || 1, want = [dir * sd[0] / l, 0, dir * sd[1] / l];
    for (const [a, b, c] of tris) T.tri(P(i, ...prof[a]), P(i, ...prof[b]), P(i, ...prof[c]), prof[a], prof[b], prof[c], want);
  }
  ctx.add(capMat, T.geo());
}

/** 闭合折线按弧长缺口切段：返回 [{pts, segN}] */
function splitLoop(P, gaps) {
  const n = P.length, E = [];
  let s = 0;
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n], L = len(sub(b, a)); E.push({ a, b, L, s0: s, n: [(b[1] - a[1]) / L, -(b[0] - a[0]) / L] }); s += L; }
  const total = s;
  const G = [...gaps].sort((p, q) => p[0] - q[0]);
  const at = (t) => { t = ((t % total) + total) % total; for (const e of E) if (t <= e.s0 + e.L + 1e-9) { const f = (t - e.s0) / e.L; return { p: [e.a[0] + (e.b[0] - e.a[0]) * f, e.a[1] + (e.b[1] - e.a[1]) * f], e }; } return { p: E[0].a, e: E[0] }; };
  const runs = [];
  for (let k = 0; k < G.length; k++) {
    const t0 = G[k][1], t1 = G[(k + 1) % G.length][0] + (k === G.length - 1 ? total : 0);
    const pts = [at(t0).p], segN = [at(t0 + 1e-6).e.n];
    for (const e of [...E, ...E.map((q) => ({ ...q, s0: q.s0 + total }))]) {
      if (e.s0 > t0 + 1e-6 && e.s0 < t1 - 1e-6) { pts.push(e.a); segN.push(e.n); }
    }
    pts.push(at(t1).p);
    runs.push({ pts, segN });
  }
  return runs;
}

// ---------------- 墩台 ----------------
function buildTerrace(ctx) {
  // 局部坐标（以 AX 为 x 原点），外法线 = (dz,-dx)
  const P = [[-XO, ZN], [XO, ZN], [XO, ZS], [XI, ZS], [XI, ZC], [-XI, ZC], [-XI, ZS], [-XO, ZS]];
  const Pt = offsetPoly(P, -BT);
  const Tw = new Tris(), Ts = new Tris(), Tf = new Tris();
  // 券洞：中门、东西门（北立面与中段南立面贯通）；左右掖门（两翼内侧入口 / 北立面出口，曲尺形，内部以门封闭）
  const C = { w: 5.6, hc: 8.4 }, Sd = { w: 4.6, hc: 7.4, x: 13.6 }, Y = { w: 4.0, hc: 6.4 };
  const XY = (XO + XI) / 2, ZY = ZC + 8.5;
  const faces = [];
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length, A = P[i], B = P[j];
    const L = len(sub(B, A)), n = [(B[1] - A[1]) / L, -(B[0] - A[0]) / L];
    faces.push({ A, B, A2: Pt[i], B2: Pt[j], n, L, arches: [] });
  }
  // 北立面 0：u = x + XO；中段南立面 4：u = XI - x；西翼内侧 5：u = z - ZC；东翼内侧 3：u = ZS - z
  const fN = faces[0], fS = faces[4], fW = faces[5], fE = faces[3];
  for (const [x, a] of [[0, C], [-Sd.x, Sd], [Sd.x, Sd]]) { fN.arches.push({ u: x + XO, ...a }); fS.arches.push({ u: XI - x, ...a }); }
  for (const s of [-1, 1]) fN.arches.push({ u: s * XY + XO, ...Y });
  fW.arches.push({ u: ZY - ZC, ...Y });
  fE.arches.push({ u: ZS - ZY, ...Y });
  for (const f of faces) f.M = wallFace(Tw, f.A, f.B, f.A2, f.B2, f.n, f.arches);
  // 贯通券洞（沿 z）
  for (const [x, a] of [[0, C], [-Sd.x, Sd], [Sd.x, Sd]]) {
    const sp = a.hc - a.w / 2;
    tunnel(Tw, Ts, Tf, fN.M, x + XO, fS.M, XI - x, -1, a.w, a.hc, (m) => [x - m[0], sp - m[1], 0]);
    archDoor(ctx.at(AX + x, 0, (ZN + ZC) / 2), a.w, sp);
  }
  // 掖门：入口（两翼内侧，向翼内 7m）与出口（北立面，向南 7m），端部设门
  const ysp = Y.hc - Y.w / 2;
  for (const s of [-1, 1]) {
    const f = s < 0 ? fW : fE, u = s < 0 ? ZY - ZC : ZS - ZY;
    const dep = 7;
    const M2 = (uu, y) => { const p = f.M(uu, y); return [p[0] + s * dep, y, p[2]]; };
    tunnel(Tw, Ts, Tf, f.M, u, M2, u, 1, Y.w, Y.hc, (m) => [0, ysp - m[1], ZY - m[2]]);
    archDoor(ctx.at(AX + s * (XI + dep - 0.2), 0, ZY, Math.PI / 2), Y.w, ysp);
    const x = s * XY;
    const M3 = (uu, y) => { const p = fN.M(uu, y); return [p[0], y, p[2] + dep]; };
    tunnel(Tw, Ts, Tf, fN.M, x + XO, M3, x + XO, 1, Y.w, Y.hc, (m) => [x - m[0], ysp - m[1], 0]);
    archDoor(ctx.at(AX + x, 0, ZN + dep - 0.2), Y.w, ysp);
  }
  const cx = ctx.at(AX, 0, 0);
  cx.add('wall_red', Tw.geo());
  cx.add('stone_grey', Ts.geo());
  cx.add('paving', Tf.geo());
  // 须弥座（汉白玉），券洞处断开
  const Hb = 1.35, Pb = 0.38;
  const p1 = [[Pb, 0], [Pb, 0.12 * Hb], [0.86 * Pb, 0.12 * Hb], [0.86 * Pb, 0.3 * Hb], [0.68 * Pb, 0.345 * Hb], [0.45 * Pb, 0.385 * Hb], [0.36 * Pb, 0.41 * Hb]];
  const p2 = [[0.36 * Pb, 0.63 * Hb], [0.45 * Pb, 0.655 * Hb], [0.68 * Pb, 0.695 * Hb], [0.88 * Pb, 0.74 * Hb], [0.88 * Pb, Hb], [-BT * Hb / H - 0.02, Hb]];
  const segs = [{ p: p1, mat: 'marble' }, { p: [p1[p1.length - 1], p2[0]], mat: 'marble_waist', band: true }, { p: p2, mat: 'marble' }];
  const gaps = [];
  let s0 = 0;
  for (const f of faces) { for (const a of f.arches) gaps.push([s0 + a.u - a.w / 2 - 0.01, s0 + a.u + a.w / 2 + 0.01]); s0 += f.L; }
  for (const r of splitLoop(P, gaps)) extrudeRun(cx, r.pts, r.segN, segs, 'marble');
  // 顶面马道、拔檐、宇墙
  cx.add('wl_madao', polyTopGeo(Pt, H));
  const m01 = [(Pt[0][0] + Pt[1][0]) / 2, (Pt[0][1] + Pt[1][1]) / 2];
  const loop = [m01, ...Pt.slice(1), Pt[0], m01];
  const segN = loop.slice(0, -1).map((a, i) => { const b = loop[i + 1], L = len(sub(b, a)); return [(b[1] - a[1]) / L, -(b[0] - a[0]) / L]; });
  extrudeRun(cx, loop, segN, [{ p: [[-0.02, H - 0.42], [0.08, H - 0.42], [0.08, H - 0.24], [0.15, H - 0.24], [0.15, H - 0.06], [0.06, H], [-0.3, H]], mat: 'brick_grey' }], 'brick_grey');
  palaceWall(cx, offsetPoly(Pt, -0.32), { y0: H, h: 1.25, thick: 0.52, cap: 'yellow', closed: true, baseH: 0.18 });
  return { P, Pt };
}

/** 马道（城台内侧北面的折返坡道，世界坐标）：坡道实体 + 顶面城砖 */
function slopeBlock(ctx, x0, x1, z0, z1, hA, hB, along) {
  // along='x'：x0 处高 hA，x1 处高 hB；'z' 同理
  const hgt = (x, z) => (along === 'x' ? hA + ((x - x0) / (x1 - x0)) * (hB - hA) : hA + ((z - z0) / (z1 - z0)) * (hB - hA));
  const T = new Tris(), Tt = new Tris();
  const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const top = c.map(([x, z]) => [x, hgt(x, z), z]);
  Tt.quad(top[0], top[1], top[2], top[3], [x0, z0], [x1, z0], [x1, z1], [x0, z1], [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4], ta = top[i], tb = top[(i + 1) % 4];
    const n = [(b[1] - a[1]), 0, -(b[0] - a[0])];
    const ua = i % 2 ? a[1] : a[0], ub = i % 2 ? b[1] : b[0];
    T.quad([a[0], 0, a[1]], [b[0], 0, b[1]], tb, ta, [ua, 0], [ub, 0], [ub, tb[1]], [ua, ta[1]], n);
  }
  ctx.add('wall_red', T.geo());
  ctx.add('wl_madao', Tt.geo());
}

function buildRamps(ctx) {
  const H1 = 6.0, H2 = 10.0;
  for (const s of [-1, 1]) {
    const X = (v) => AX + s * v; // v 为距中轴（正）
    const xs = (a, b) => (s < 0 ? [X(b), X(a)] : [X(a), X(b)]);
    // 第一跑：沿城台侧面自北向南升至 H1
    { const [a, b] = xs(XO - 0.6, XO + 8.0); slopeBlock(ctx, a, b, 456.9, 470.2, 0, H1, 'z'); }
    // 平台
    { const [a, b] = xs(XO - 0.6, XO + 8.0); slopeBlock(ctx, a, b, 470.2, 476.6, H1, H1, 'z'); }
    // 第二跑：向外（离中轴）升至 H2
    { const [a, b] = xs(XO + 8.0, XO + 24.5); slopeBlock(ctx, a, b, 470.2, 476.6, s < 0 ? H2 : H1, s < 0 ? H1 : H2, 'x'); }
    // 平台（与城墙顶相接）
    { const [a, b] = xs(XO + 24.5, XO + 31.3); slopeBlock(ctx, a, b, 470.2, 476.6, H2, H2, 'z'); }
  }
}

// ---------------- 门楼 ----------------
const LATTICE = 'sanjiao';

export function buildWumen(ctx, api) {
  buildTerrace(ctx);
  buildRamps(ctx);
  const y = H;
  const zc = (ZN + ZC) / 2;
  // 正楼：面阔九间、进深五间，重檐庑殿，周围廊，上檐九踩、下檐七踩，和玺彩画
  const kou = 0.085;
  const zl = hallOn(ctx, {
    x: AX, y, z: zc, rotY: FS, grade: 1, kind: 'hall',
    pf: { h: 1.5, margin: 1.4, style: 'xumizuo', railing: { style: 'marble' },
      stairs: [{ at: [0, 20], w: 5.2, run: 3.4 }, { at: [-12, 20], w: 3.2, run: 3.4 }, { at: [12, 20], w: 3.2, run: 3.4 }, { at: [0, -20], w: 5.2, run: 3.4 }],
      w: 57.2 + 2.8, d: 20.4 + 2.8 },
    bays: [3.6, 6.6, 7.0, 7.4, 8.0, 7.4, 7.0, 6.6, 3.6], nDepth: 5, corridor: 3.6,
    eaveW: 62.8, eaveD: 26.0, colH: 6.9,
    dougong: { kou, cai: 9, lowerCai: 7 }, caihua: 'hexi', lattice: LATTICE,
    double: { inset: 3.6, upperH: 2.3 },
    roof: { type: 'wudian', w: 58.6, d: 21.0, beasts: 9, rise: 8.2 },
    front: ['wall', 'window', 'door', 'door', 'door', 'door', 'door', 'window', 'wall'],
    back: ['wall', 'window', 'window', 'door', 'door', 'door', 'window', 'window', 'wall'],
    plaque: '午门',
  });
  // 钟亭（东）、鼓亭（西）：各三间，单檐歇山，敞亭
  for (const s of [-1, 1]) {
    hallOn(ctx, {
      x: AX + s * 36.0, y, z: zc, rotY: s > 0 ? FW : FE, grade: 3, kind: 'pavilion', bench: false,
      pf: { h: 0.6, style: 'xumizuo', w: 11.6, d: 5.6, stairs: [{ at: [0, 4], w: 2.4, run: 1.3 }] },
      bays: [3.4, 4.0, 3.4], depthBays: [3.4], colH: 4.0, overhang: 1.8,
      dougong: { kou: 0.07, cai: 3 }, caihua: 'hexi',
      roof: { type: 'xieshan', beasts: 5 },
    });
  }
  // 阙亭：两翼南北两端各一，重檐四角攒尖，鎏金宝顶
  const que = (x, z) => hallOn(ctx, {
    x, y, z, rotY: FS, grade: 2,
    pf: { h: 0.6, style: 'xumizuo', w: 19.6, d: 19.6, stairs: [] },
    bays: [3.0, 3.8, 3.9, 3.8, 3.0], depthBays: [3.0, 3.8, 3.9, 3.8, 3.0], eaveW: 22.0, eaveD: 22.0, colH: 5.6,
    dougong: { kou: 0.075, cai: 7, lowerCai: 5 }, caihua: 'hexi', lattice: LATTICE,
    double: { inset: 3.0, upperH: 2.4 },
    roof: { type: 'cuanjian', sides: 4, baoding: 'gold', beasts: 7 },
    front: ['wall', 'window', 'door', 'window', 'wall'], back: ['wall', 'window', 'door', 'window', 'wall'],
    left: ['wall', 'window', 'door', 'window', 'wall'], right: ['wall', 'window', 'door', 'window', 'wall'],
  });
  const XY = (XO + XI) / 2;
  const zQN = ZN + 11.4, zQS = ZS - 11.4;
  for (const s of [-1, 1]) { que(AX + s * XY, zQN); que(AX + s * XY, zQS); }
  // 雁翅楼：两翼各十三间，单檐歇山，前出廊，面向中轴
  const zY = (zQN + 11 + zQS - 11) / 2, LY = (zQS - 11) - (zQN + 11);
  for (const s of [-1, 1]) {
    hallOn(ctx, {
      x: AX + s * XY, y, z: zY, rotY: s < 0 ? FE : FW, grade: 2,
      pf: { h: 0.5, style: 'xumizuo', w: LY - 4.4, d: 12.8, stairs: [{ at: [0, 7], w: 3.2, run: 1.1 }] },
      nBays: 13, nDepth: 3, corridor: 2.2, eaveW: LY, eaveD: 14.4, colH: 5.0,
      dougong: { kou: 0.075, cai: 5 }, caihua: 'hexi', lattice: LATTICE, backCorridor: false,
      roof: { type: 'xieshan', beasts: 7 },
      front: [...Array(5).fill('window'), 'door', 'door', 'door', ...Array(5).fill('window')], back: 'wall',
    });
  }
  api.label('午门', AX, zl.top + 3, zc, '紫禁城正门，明永乐十八年（1420）建、清顺治四年（1647）重修。凹字形墩台高12米，正中开三券门、两侧掖门“明三暗五”；正楼面阔九间重檐庑殿，两翼雁翅楼与四座重檐攒尖阙亭合称“五凤楼”。');
  return zl;
}
