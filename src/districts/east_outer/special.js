// 东路南部分区（east_outer）特殊建筑：文华殿工字殿、文渊阁、盔顶碑亭、箭亭（周围廊）、九龙壁、内阁大库式砖楼、井亭、筒子河围房
import * as THREE from 'three';
import { buildHall, buildTower, resolveHallSpec } from '../../core/building.js';
import { buildPlatform, buildStairs, buildRailing, buildXumizuo } from '../../core/platform.js';
import { buildBay } from '../../core/openings.js';
import { buildRoof } from '../../core/roof.js';
import { boxGeo, cylGeo, clamp } from '../../core/geom.js';
import { defineMaterial } from '../../core/materials.js';
import { Painter, finish, drawDragon, drawCloud, drawPearl } from '../../core/textures.js';
import { makePlaque, plaqueSize } from '../../core/plaque.js';
import { jianbian, FACE } from './util.js';

const cumul = (bays) => { const out = [0]; for (const b of bays) out.push(out[out.length - 1] + b); const t = out[out.length - 1]; return out.map((x) => x - t / 2); };
const box = (c, mat, x0, y0, z0, x1, y1, z1) => { const g = boxGeo(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); c.add(mat, g); };

/** 横匾（贴于立面 z 处，朝 +Z） */
function hPlaque(c, text, x, y, z, ch = 0.5, style = 'blue', vertical = false) {
  const sz = plaqueSize(text, vertical), w = sz.w * ch, h = sz.h * ch;
  const k = c.at(x, y, z).rot(-0.1, 0, 0);
  const face = new THREE.PlaneGeometry(w, h); face.translate(0, 0, 0.06);
  k.add(makePlaque(text, { vertical, style }), face);
  k.add('board_red', boxGeo(w * 0.98, h * 0.98, 0.1));
}

// =====================================================================
// 文华殿：前殿文华殿 + 穿廊 + 后殿主敬殿（工字殿），共用工字形台基，前出月台
// =====================================================================
export function wenhuaDian(ctx, b, api, desc) {
  const PH = 1.45, m = 1.15;
  const S = { cx: 185.8, cz: 290.0, w: 36.1, d: 21.8 }, N = { cx: 186.0, cz: 260.35, w: 36.1, d: 18.1 };
  const common = { grade: 3, dougong: { kou: 0.08, cai: 5 }, caihua: 'hexi', nBays: 5, nDepth: 3, platform: false, lattice: 'sanjiao' };
  const sSpec = { ...common, eaveW: S.w, eaveD: S.d, colH: 6.3, roof: { type: 'xieshan', beasts: 7 },
    front: ['window', 'window', 'door', 'window', 'window'], back: ['wall', 'window', 'door', 'window', 'wall'] };
  const nSpec = { ...common, eaveW: N.w, eaveD: N.d, colH: 5.8, roof: { type: 'xieshan', beasts: 7 },
    front: ['wall', 'window', 'door', 'window', 'wall'], back: ['window', 'window', 'door', 'window', 'window'] };
  const rs = resolveHallSpec(sSpec), rn = resolveHallSpec(nSpec);
  const sx0 = S.cx - rs.colW / 2 - m, sx1 = S.cx + rs.colW / 2 + m, sz0 = S.cz - rs.colD / 2 - m, sz1 = S.cz + rs.colD / 2 + m;
  const nx0 = N.cx - rn.colW / 2 - m, nx1 = N.cx + rn.colW / 2 + m, nz0 = N.cz - rn.colD / 2 - m, nz1 = N.cz + rn.colD / 2 + m;
  const cx0 = 185.8 - 6.0, cx1 = 185.8 + 6.0;
  const yx0 = S.cx - 11.6, yx1 = S.cx + 11.6, yz1 = sz1 + 5.2;
  const poly = [[nx0, nz0], [nx1, nz0], [nx1, nz1], [cx1, nz1], [cx1, sz0], [sx1, sz0], [sx1, sz1], [yx1, sz1], [yx1, yz1], [yx0, yz1], [yx0, sz1], [sx0, sz1], [sx0, sz0], [cx0, sz0], [cx0, nz1], [nx0, nz1]];
  buildPlatform(ctx, { poly, h: PH, style: 'stone' });
  const run = PH / 0.46;
  // 月台正面三出陛（中路御路）、两侧抄手踏跺；后殿北出一陛
  buildStairs(ctx.at(S.cx, 0, yz1), { w: 4.6, h: PH, run, style: 'stone', yulu: { w: 1.7 } });
  for (const s of [-1, 1]) buildStairs(ctx.at(S.cx + s * 7.6, 0, yz1), { w: 3.0, h: PH, run, style: 'stone' });
  for (const s of [-1, 1]) buildStairs(ctx.at(s > 0 ? yx1 : yx0, 0, (sz1 + yz1) / 2, s * Math.PI / 2), { w: 2.8, h: PH, run, style: 'stone' });
  buildStairs(ctx.at(N.cx, 0, nz0, Math.PI), { w: 4.0, h: PH, run, style: 'stone' });
  for (const s of [-1, 1]) buildStairs(ctx.at(s > 0 ? sx1 : sx0, 0, S.cz + 3, s * Math.PI / 2), { w: 3.0, h: PH, run, style: 'stone' });
  const iS = buildHall(ctx.at(S.cx, PH, S.cz), sSpec);
  const iN = buildHall(ctx.at(N.cx, PH, N.cz), nSpec);
  // 竖匾：悬于明间额枋前（低于檐口，院中可见全匾）
  hPlaque(ctx, '文华殿', S.cx, PH + sSpec.colH - 0.38, S.cz + rs.colD / 2 + rs.colDia * 0.55 + 0.1, 0.55, 'blue', true);
  // 穿廊：南北向，两侧槛窗，两端插入前后殿檐下
  const zA = N.cz + rn.colD / 2, zB = S.cz - rs.colD / 2, Lc = zB - zA;
  buildHall(ctx.at(185.8, PH, (zA + zB) / 2, Math.PI / 2), {
    grade: 4, bays: [Lc / 3, Lc / 3, Lc / 3], depthBays: [3.5, 3.6, 3.5], colH: 4.6, colDia: 0.42, dougong: false, caihua: 'hexi', platform: false,
    overhang: 1.05, front: 'window', back: 'window', left: 'open', right: 'open', lattice: 'sanjiao',
    roof: { type: 'xuanshan', rise: 2.3, beasts: -1, w: Lc + 2.4 },
  });
  // 月台陈设：铜缸一对
  for (const s of [-1, 1]) ctx.place('vat:bronze', S.cx + s * 9.2, PH, sz1 + 2.4, 0, 1.45);
  api.label('文华殿', S.cx, PH + iS.topY + 2, S.cz, desc.wenhua);
  api.label('主敬殿', N.cx, PH + iN.topY + 2, N.cz, desc.zhujing);
}

// =====================================================================
// 文渊阁：外观两层（内三层），面阔六间，黑琉璃瓦绿剪边歇山顶，前廊绿柱，苏式彩画
// =====================================================================
export function wenyuanGe(ctx, b, api, desc) {
  const o = b.obb, c = ctx.at(o.cx, 0, o.cz);
  const ovh = 1.55, inset = 0.8, skirtRise = 1.45, rise = 4.5;
  const st0 = { colH: 6.6, front: 'open', skirtRise };
  const st1 = { colH: 4.4, inset, front: ['window', 'window', 'door', 'door', 'door', 'window'], back: 'window' };
  const base = {
    grade: 3, eaveW: 39.6, eaveD: 16.4, overhang: ovh, nBays: 6, depthBays: [3.5, 3.6, 3.6, 2.6], dougong: false, caihua: 'sushi',
    tile: 'black', colDia: 0.52, lattice: 'bubujin',
    platform: { h: 0.75, style: 'stone', margin: 0.9, stairs: [{ side: 'S', x: 3.1, w: 4.6 }] },
  };
  const rs = resolveHallSpec({ ...base, colH: st0.colH });
  const ovhU = clamp(ovh * 0.95, 0.8, 3);
  const wTop = rs.colW - 2 * inset + 2 * ovhU, dTop = rs.colD - 2 * inset + 2 * ovhU;
  const R = { type: 'xieshan', tile: 'black', ridgeColor: 'green', rise, lift: 0.75, flare: 0.55, liftLen: 4.6, gableInset: 2.3, beasts: 5, w: wTop, d: dTop };
  const res = buildTower(c, { ...base, roof: R, stories: [st0, st1] });
  const y0 = rs.platform.h, D = rs.colDia, beamH = clamp(D * 0.95, 0.2, 1.0);
  const colsX = cumul(rs.bays), colsZ = cumul(rs.depthBays);
  const zF = colsZ[colsZ.length - 1], zIn = colsZ[colsZ.length - 2];
  // 首层：前廊，门窗退至金柱缝
  const hgt = st0.colH - beamH * 1.6 - 1.6; // 上部为暗层（腰檐后）：额枋下另设一道横披板
  const front = ['window', 'window', 'door', 'door', 'door', 'window'];
  for (let i = 0; i < colsX.length - 1; i++) {
    const w = colsX[i + 1] - colsX[i] - D * 0.9;
    buildBay(c.at((colsX[i] + colsX[i + 1]) / 2, y0, zIn), { w, h: hgt, type: front[i], lattice: 'bubujin', transom: true });
    box(c, 'board_red', colsX[i] + D * 0.45, y0 + hgt, zIn - 0.12, colsX[i + 1] - D * 0.45, y0 + st0.colH - beamH, zIn); // 暗层板壁
  }
  for (const x of colsX) c.place('col:wood_red', x, y0, zIn, 0, [D, st0.colH, D]);
  // 廊内天花与金柱缝额枋
  box(c, 'soffit', colsX[0], y0 + st0.colH - 0.02, zIn, colsX[colsX.length - 1], y0 + st0.colH + 0.06, zF + D * 0.5);
  box(c, 'beam_sushi', colsX[0], y0 + st0.colH - beamH, zIn - D * 0.4, colsX[colsX.length - 1], y0 + st0.colH, zIn + D * 0.4);
  // 绿色檐柱（覆于红柱外）：首层前檐 + 上层前檐
  for (const x of colsX) c.place('col:wood_green', x, y0 + 0.02, zF, 0, [D * 1.07, st0.colH - 0.04, D * 1.07]);
  const yU = res.storyY[1], uX = res.colsX, uZ = res.colsZ, zUF = uZ[uZ.length - 1];
  for (const x of uX) c.place('col:wood_green', x, yU + 0.02, zUF, 0, [D * 1.07, st1.colH - 0.04, D * 1.07]);
  // 上层前平座（仅前檐）：挑台楼板 + 回纹木栏杆
  const bd = 1.05, xa = uX[0] - 0.2, xb = uX[uX.length - 1] + 0.2;
  box(c, 'wood_red', xa, yU - 0.28, zUF - 0.2, xb, yU, zUF + bd);
  box(c, 'board_green', xa, yU - 0.5, zUF + bd - 0.08, xb, yU - 0.28, zUF + bd);
  buildRailing(c, { path: [[xa + 0.08, zUF + 0.1], [xa + 0.08, zUF + bd - 0.08], [xb - 0.08, zUF + bd - 0.08], [xb - 0.08, zUF + 0.1]], y: yU, style: 'wood_green', height: 0.95, ends: 'none' });
  // 匾：上层明间（东起第三间）
  hPlaque(c, '文渊阁', (uX[3] + uX[4]) / 2, yU + st1.colH - beamH * 2.6, zUF + D * 0.6 + 0.05, 0.42);
  // 黑琉璃瓦绿剪边：上檐 + 腰檐
  jianbian(c, { ...R, y: res.roof.ridgeY - rise, overhang: ovhU }, 0.95, 'green');
  const sOvh = clamp(ovh * 0.75, 0.6, 2.4);
  jianbian(c, { type: 'skirt', w: rs.colW + 2 * sOvh, d: rs.colD + 2 * sOvh, y: yU - 0.15 - skirtRise, rise: skirtRise, inner: { w: rs.colW - 2 * inset + D * 1.2, d: rs.colD - 2 * inset + D * 1.2 }, overhang: sOvh }, 0.75, 'green');
  api.label('文渊阁', o.cx, res.topY + 2, o.cz, desc);
  return res;
}

/** 文渊阁碑亭：方亭，盔顶（凸曲面攒尖），黄琉璃瓦，亭内立乾隆《文渊阁记》碑 */
export function kuiTing(ctx, b, api, desc) {
  const o = b.obb, c = ctx.at(o.cx, 0, o.cz);
  const info = buildHall(c, {
    kind: 'pavilion', grade: 4, eaveW: 9.2, eaveD: 9.2, nBays: 3, nDepth: 3, colH: 3.7, colDia: 0.34, overhang: 1.3,
    dougong: { kou: 0.05, cai: 3 }, caihua: 'xuanzi', bench: false,
    platform: { h: 0.6, style: 'stone', stairs: [{ side: 'S', w: 2.4 }, { side: 'W', w: 2.4 }] },
    roof: { type: 'cuanjian', sides: 4, curve: -0.55, rise: 4.3, lift: 0.55, flare: 0.45, baoding: 'gold', beasts: 3, wenH: 0.5 },
  });
  c.place('stele', 0, 0.6, 0, 0, 3.4);
  api.label('文渊阁碑亭', o.cx, info.topY + 1.5, o.cz, desc);
}

// =====================================================================
// 箭亭：面阔五间、进深三间，四周出廊，黄琉璃瓦单檐歇山
// =====================================================================
export function jianTing(ctx, b, api, desc) {
  const o = b.obb, c = ctx.at(o.cx, 0, o.cz);
  const ovh = 1.5, corr = 2.0, colH = 5.6;
  const colW = o.sx - 2 * ovh, colD = o.sz - 2 * ovh;
  const iw = (colW - 2 * corr) / 5, id = (colD - 2 * corr) / 3;
  const spec = {
    grade: 3, eaveW: o.sx, eaveD: o.sz, overhang: ovh, colH, colDia: 0.5, dougong: { kou: 0.065, cai: 3 }, caihua: 'xuanzi',
    bays: [corr, iw, iw, iw, iw, iw, corr], depthBays: [corr, id, id, id, corr], corridorDepth: corr,
    front: ['open', 'window', 'door', 'door', 'door', 'window', 'open'], back: ['open', 'wall', 'window', 'door', 'window', 'wall', 'open'], left: 'open', right: 'open',
    platform: { h: 1.0, style: 'stone', margin: 1.0, stairs: [{ side: 'S', w: 6.0 }, { side: 'N', w: 4.2 }, { side: 'E', w: 3.2 }, { side: 'W', w: 3.2 }] },
    roof: { type: 'xieshan', beasts: 5 }, plaque: '箭亭', plaqueCharH: 0.46,
  };
  const info = buildHall(c, spec);
  const rs = info.spec, cx = info.colsX, cz = info.colsZ, y0 = rs.platform.h, D = rs.colDia;
  const beamH = clamp(D * 0.95, 0.2, 1.0), hgt = colH - beamH * 2.1;
  // 内圈两山：金柱 + 山墙（开一窗）
  for (const [x, rot] of [[cx[1], -Math.PI / 2], [cx[cx.length - 2], Math.PI / 2]]) {
    for (let j = 2; j <= cz.length - 3; j++) c.place('col:wood_red', x, y0, cz[j], 0, [D, colH, D]);
    for (let j = 1; j < cz.length - 2; j++) {
      const w = cz[j + 1] - cz[j] - D * 0.9;
      buildBay(c.at(x, y0, (cz[j] + cz[j + 1]) / 2, rot), { w, h: hgt, type: j === 2 ? 'window' : 'wall' });
    }
  }
  api.label('箭亭', o.cx, info.topY + 2, o.cz, desc);
}

// =====================================================================
// 九龙壁（宁寿宫皇极门外）：单面琉璃影壁，背倚宫墙，正面朝北
// =====================================================================
const JL_COLORS = {
  yellow: [[236, 178, 46], [150, 92, 16], [255, 226, 128]],
  blue: [[54, 104, 188], [18, 42, 98], [140, 180, 236]],
  white: [[232, 228, 214], [140, 136, 124], [255, 252, 240]],
  purple: [[128, 70, 132], [62, 28, 66], [196, 146, 196]],
  orange: [[228, 132, 44], [138, 66, 14], [252, 196, 120]],
};
function buildJiulongMaterial() {
  const W = 3072, Hh = 224;
  const P = new Painter(W, Hh, { c: [36, 98, 132], h: 0.3, r: 0.45, m: 0 });
  // 天空（青绿渐变）与流云
  P.rect(0, 0, W, Hh, { c: (g) => { const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, 'rgb(28,82,128)'); gr.addColorStop(0.62, 'rgb(46,124,140)'); gr.addColorStop(1, 'rgb(30,96,90)'); return gr; }, h: 0.3 });
  const cloud = { c: [214, 226, 228], h: 0.55, r: 0.3 };
  for (let i = 0; i < 26; i++) drawCloud(P, (i + 0.5) * (W / 26) + ((i * 37) % 23) - 11, 26 + ((i * 53) % 60), 30 + (i % 3) * 6, cloud, [110, 150, 168]);
  // 海水江崖：底部波浪层层
  for (let row = 0; row < 4; row++) {
    const y = Hh - 12 - row * 13, col = row % 2 ? [40, 132, 116] : [62, 150, 176];
    for (let x = -20; x < W + 40; x += 34) P.draw((g) => g.arc(x + (row % 2) * 17, y, 17, Math.PI, Math.PI * 2), { lw: 5, c: col, h: 0.5 });
  }
  for (let i = 0; i < 10; i++) { const x = (i + 0.5) * (W / 10); P.poly([[x - 40, Hh], [x - 18, Hh - 70], [x + 4, Hh - 84], [x + 26, Hh - 62], [x + 44, Hh]], { c: [196, 168, 92], h: 0.6, r: 0.4 }); }
  // 九龙：正中黄龙，两侧依次蓝、白、紫、橙黄
  const order = ['orange', 'purple', 'white', 'blue', 'yellow', 'blue', 'white', 'purple', 'orange'];
  const slot = W / 9;
  order.forEach((k, i) => {
    const [cc, dd, ll] = JL_COLORS[k];
    const x = (i + 0.5) * slot, left = i < 4, mid = i === 4;
    const head = mid ? [x, 78] : [x + (left ? 0.24 : -0.24) * slot, 84 + (i % 2) * 18];
    const ang = mid ? -Math.PI / 2 + 0.25 : left ? Math.PI + 0.55 : -0.55;
    drawDragon(P, head[0], head[1], slot * 1.05, ang, { flip: !left, w: 0.11, amp: 0.2, waves: 1.6, phase: 0.4 + i * 0.3, gold: cc, dark: dd, light: ll, h: 0.92 });
    if (i < 8) drawPearl(P, (i + 1) * slot, 60 + (i % 3) * 20, 9);
  });
  const out = finish(P, { k: 4, blurR: 2, cav: 1.0, cavR: 4, toks: 0.6 });
  const tex = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const rough = new THREE.Texture(out.rough.mips[0]);
  rough.mipmaps = out.rough.mips; rough.generateMipmaps = false; rough.minFilter = THREE.LinearMipmapLinearFilter; rough.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: tex(out.color, true), normalMap: tex(out.normal), roughnessMap: rough, roughness: 1, metalness: 0, envMapIntensity: 1.0 });
}
let jlMat = null;
defineMaterial('eo_jiulong', { get material() { return (jlMat ||= buildJiulongMaterial()); } });

export function jiulongBi(ctx, api, desc) {
  const L = 29.4, t = 0.66, cx = 294.75, cz = -33.95 - t / 2;
  const c = ctx.at(cx, 0, cz, Math.PI); // 正面朝北（皇极门）
  const yb = 0.45, yt = 2.74;
  buildXumizuo(c, [[-L / 2 - 0.2, -t / 2 - 0.25], [L / 2 + 0.2, -t / 2 - 0.25], [L / 2 + 0.2, t / 2 + 0.25], [-L / 2 - 0.2, t / 2 + 0.25]], 0, yb, { edgeW: 0.25 });
  box(c, 'wall_red', -L / 2, yb, -t / 2, L / 2, yt, t / 2);
  // 壁心：九龙琉璃（贴于正面），四周黄绿琉璃边框
  const fw = 0.22;
  const face = new THREE.PlaneGeometry(L - 2 * fw, yt - yb - 2 * fw * 0.8);
  face.translate(0, (yb + yt) / 2, t / 2 + 0.02);
  c.add('eo_jiulong', face);
  box(c, 'glaze_green', -L / 2 - 0.02, yb, t / 2 - 0.02, L / 2 + 0.02, yb + fw * 0.8, t / 2 + 0.05);
  box(c, 'glaze_green', -L / 2 - 0.02, yt - fw * 0.8, t / 2 - 0.02, L / 2 + 0.02, yt, t / 2 + 0.05);
  for (const s of [-1, 1]) box(c, 'glaze_green', s > 0 ? L / 2 - fw : -L / 2 - 0.02, yb, -t / 2 - 0.02, s > 0 ? L / 2 + 0.02 : -L / 2 + fw, yt, t / 2 + 0.05);
  // 琉璃额枋、平板枋、斗拱
  const be = 0.16, ye = yt + be;
  box(c, 'glaze_green', -L / 2 - 0.05, yt, -t / 2 - 0.05, L / 2 + 0.05, ye, t / 2 + 0.06);
  box(c, 'glaze_yellow', -L / 2 - 0.08, ye, -t / 2 - 0.08, L / 2 + 0.08, ye + 0.06, t / 2 + 0.09);
  const k = 0.045, n = Math.round(L / (8.5 * k));
  for (let i = 0; i <= n; i++) c.place('wl_dg:yellow', -L / 2 + (L * i) / n, ye + 0.06, t / 2 + 0.05, 0, k);
  const yr = ye + 0.06 + 3.7 * k + 0.04;
  box(c, 'glaze_green', -L / 2 - 0.2, yr - 0.06, -t / 2 - 0.2, L / 2 + 0.2, yr, t / 2 + 0.2);
  buildRoof(c, { type: 'wudian', w: L + 0.9, d: t + 0.9, y: yr, rise: 0.36, tile: 'yellow', overhang: 0.4, band: 0.11, beasts: 1, wenH: 0.55, ridgeH: 0.22, lift: 0.12, flare: 0.08, liftLen: 0.5, ridgeHalf: L / 2 - 0.1 });
  api.label('九龙壁', cx, 4.6, cz - 1, desc);
}

// =====================================================================
// 内阁大库式砖楼（红本库、实录库、銮驾库等）：两层砖石库房，红灰墙身，青砖下碱，石腰线，铁板窗，硬山黄琉璃瓦
// =====================================================================
export function brickStore(ctx, b, face, o = {}) {
  const ob = b.obb, ns = face === 'S' || face === 'N';
  const W = ns ? ob.sx : ob.sz, Dd = ns ? ob.sz : ob.sx;
  const c = ctx.at(ob.cx, 0, ob.cz, FACE[face]);
  const ov = 0.6, w = W - 0.2, d = Dd - 2 * ov;
  const base = 0.5, h1 = o.h1 ?? 4.6, h2 = o.h2 ?? 3.9, floors = o.floors ?? 2;
  const H = h1 + (floors > 1 ? h2 : 0);
  buildPlatform(c, { w: w + 0.7, d: d + 0.7, h: base, style: 'plain', floor: false });
  box(c, 'brick_dark', -w / 2, base, -d / 2, w / 2, base + 1.1, d / 2);
  box(c, 'wall_red', -w / 2 + 0.03, base + 1.1, -d / 2 + 0.03, w / 2 - 0.03, base + H, d / 2 - 0.03);
  if (floors > 1) box(c, 'stone_grey', -w / 2 - 0.03, base + h1 - 0.1, -d / 2 - 0.03, w / 2 + 0.03, base + h1 + 0.1, d / 2 + 0.03);
  // 冰盘檐（砖檐三层出跳）
  let yc = base + H;
  for (const [e, hh] of [[0.06, 0.12], [0.14, 0.1], [0.24, 0.14]]) { box(c, 'brick_grey', -w / 2 - e * 0.3, yc, -d / 2 - e, w / 2 + e * 0.3, yc + hh, d / 2 + e); yc += hh; }
  // 门窗：每间一窗，首层明间为门
  const nb = Math.max(3, 2 * Math.round((w / (o.bay ?? 3.7) - 1) / 2) + 1), bw = w / nb, mid = (nb - 1) / 2;
  for (const sz of [1, -1]) {
    const k = c.at(0, 0, 0, sz > 0 ? 0 : Math.PI);
    for (let i = 0; i < nb; i++) {
      const x = -w / 2 + bw * (i + 0.5);
      for (let f = 0; f < floors; f++) {
        const isDoor = sz > 0 && f === 0 && i === mid && o.door !== false;
        if (isDoor) {
          const dw = Math.min(2.6, bw * 0.7), dh = 3.2, y = base;
          box(k, 'stone_grey', x - dw / 2 - 0.22, y, d / 2 - 0.02, x + dw / 2 + 0.22, y + dh + 0.25, d / 2 + 0.05);
          box(k, 'wood_dark', x - dw / 2, y, d / 2 + 0.04, x + dw / 2, y + dh, d / 2 + 0.06);
          for (const s of [0, 1]) {
            const leaf = new THREE.PlaneGeometry(dw / 2 - 0.02, dh - 0.05);
            const uv = leaf.attributes.uv; if (s) for (let q = 0; q < uv.count; q++) uv.setX(q, 1 - uv.getX(q));
            leaf.translate(x + (s ? 1 : -1) * dw / 4, y + dh / 2, d / 2 + 0.07);
            k.add('gate_door', leaf);
          }
          // 门罩小檐
          box(k, 'glaze_yellow', x - dw / 2 - 0.5, y + dh + 0.25, d / 2 - 0.02, x + dw / 2 + 0.5, y + dh + 0.42, d / 2 + 0.45);
          continue;
        }
        const ww = Math.min(1.25, bw * 0.38), wh = f === 0 ? 1.7 : 1.5, y = base + (f === 0 ? 1.7 : h1 + 0.9);
        box(k, 'stone_grey', x - ww / 2 - 0.16, y - 0.16, d / 2 - 0.02, x + ww / 2 + 0.16, y + wh + 0.16, d / 2 + 0.04);
        box(k, 'iron', x - ww / 2, y, d / 2 + 0.03, x + ww / 2, y + wh, d / 2 + 0.07);
      }
    }
  }
  const info = buildRoof(c, { type: 'yingshan', w: w + 0.02, d: Dd, y: yc + 0.02, rise: o.rise ?? 0.31 * Dd, tile: o.tile || 'yellow', overhang: ov, gableWallMat: 'wall_red', beasts: o.beasts ?? 3 });
  if (o.stairs !== false) buildStairs(c.at(0, 0, d / 2 + 0.35), { w: 3.2, h: base, run: 1.1, style: 'stone' });
  return { topY: info.ridgeY + 0.6 };
}

// =====================================================================
// 井亭（大庖井）：方亭，盝顶中空（井口上方露天），井口石
// =====================================================================
export function wellPavilion(ctx, b, api, name, desc) {
  const o = b.obb, c = ctx.at(o.cx, 0, o.cz);
  const info = buildHall(c, {
    kind: 'pavilion', grade: 5, eaveW: 7.2, eaveD: 6.8, nBays: 1, nDepth: 1, colH: 3.1, colDia: 0.3, overhang: 1.0,
    dougong: false, caihua: 'xuanzi', bench: false, platform: { h: 0.45, style: 'stone', stairs: [{ side: 'W', w: 2.0 }] },
    roof: { type: 'skirt', inner: { w: 1.9, d: 1.9 }, rise: 1.25, tile: 'yellow', beasts: 1 },
  });
  const g = cylGeo(0.62, 0.68, 0.62, 8); g.translate(0, 0.45 + 0.31, 0); c.add('stone_grey', g);
  const w2 = cylGeo(0.42, 0.42, 0.02, 12); w2.translate(0, 0.45 + 0.63, 0); c.add('wood_dark', w2);
  api.label(name, o.cx, info.topY + 1.2, o.cz, desc);
}

// =====================================================================
// 筒子河内岸围房（守卫值房）：连檐通脊长房，分段硬山封火墙，灰筒瓦卷棚
// =====================================================================
export function weiFang(ctx, b, face, nSeg) {
  const o = b.obb, ns = face === 'S' || face === 'N';
  const L = ns ? o.sx : o.sz, D = ns ? o.sz : o.sx;
  const c = ctx.at(o.cx, 0, o.cz, FACE[face]);
  const seg = L / nSeg;
  for (let i = 0; i < nSeg; i++) {
    buildHall(c.at(-L / 2 + seg * (i + 0.5), 0, 0), {
      grade: 5, eaveW: seg - 0.05, eaveD: D, colH: 3.0, nBays: Math.max(3, 2 * Math.round((seg / 3.4 - 1) / 2) + 1), nDepth: 2,
      tile: 'grey', dougong: false, caihua: 'none', platform: { h: 0.35, style: 'plain', stairs: [] }, front: 'zhizhai', back: 'wall',
      roof: { type: 'yingshan', juan: true, rise: 2.3, gableWallMat: 'brick_grey', beasts: -1 },
    });
  }
}
