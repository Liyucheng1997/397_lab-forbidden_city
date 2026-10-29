// 九龙壁（乾隆三十七年 1772，宁寿宫皇极门外）：单面琉璃影壁，背倚宫墙。长 29.47m、高 3.59m、厚 0.459m。
// 汉白玉须弥座；壁心蓝绿云水为地，九龙高浮雕（中黄正龙，两侧依次白升龙/蓝降龙、黄龙/紫龙），四组山石分隔为五区；
// 上为琉璃仿木额枋、斗拱、椽飞，黄琉璃庑殿顶。
// 壁心纹理用 Painter 程序化绘制（颜色/高度/粗糙度），高度场同时驱动壁心网格的真实位移（浮雕）。
// 局部坐标：中心在原点，正面朝 +Z（实际朝北，调用方 rotY = π）。
import * as THREE from 'three';
import { Painter, finish, drawDragon, drawPearl, registerTexture, rng } from '../../core/textures.js';
import { defineMaterial } from '../../core/materials.js';
import { boxGeo, gridSurface, clamp } from '../../core/geom.js';
import { buildXumizuo } from '../../core/platform.js';
import { buildRoof } from '../../core/roof.js';
import '../../core/walls.js'; // 注册 wl_* 琉璃材质与琉璃斗拱原型

const TAU = Math.PI * 2;
export const JLB = { L: 29.47, H: 3.59, T: 0.459, baseH: 0.74, panelTop: 2.84, post: 0.2 };
const TW = 6144, TH = 448; // 壁心纹理像素（约 212 px/m）

// 龙的釉色
const DRAGON = {
  yellow: { gold: [232, 172, 36], dark: [140, 84, 10], light: [255, 222, 120] },
  white: { gold: [236, 234, 220], dark: [140, 146, 150], light: [255, 255, 246] },
  blue: { gold: [46, 98, 182], dark: [16, 40, 96], light: [120, 170, 232] },
  purple: { gold: [138, 76, 136], dark: [66, 30, 70], light: [196, 148, 194] },
};

/** Catmull-Rom 曲线：pts → t∈[0,1] 均匀分段取点 */
function catmull(pts) {
  const n = pts.length - 1;
  return (t) => {
    const f = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
    const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u * u + (-a + 3 * b - 3 * c2 + d) * u * u * u);
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  };
}

// 龙身脊线（画布方向：x 右、y 下；单位 = len；头在原点，身体自头向后延伸）
const SPINES = {
  // 升龙（头朝右上）：身躯自头后向下盘一圈，尾甩向后上方
  rise: [[0, 0], [-0.1, 0.12], [-0.06, 0.3], [-0.2, 0.43], [-0.42, 0.39], [-0.5, 0.21], [-0.42, 0.05], [-0.58, -0.06], [-0.82, 0.0]],
  // 降龙（头朝右下）：身躯自上方盘下
  fall: [[0, 0], [-0.12, -0.1], [-0.1, -0.29], [-0.26, -0.41], [-0.47, -0.35], [-0.52, -0.16], [-0.66, -0.05], [-0.88, -0.13]],
  // 正龙（中央坐龙）：身躯环绕一周，尾向左上
  coil: [[0, 0], [-0.13, 0.09], [-0.18, 0.27], [-0.02, 0.4], [0.22, 0.38], [0.33, 0.2], [0.25, 0.02], [0.06, -0.11], [-0.2, -0.13], [-0.4, -0.03], [-0.56, 0.12]],
};

function dragon(P, x, y, len, kind, col, mirror = false) {
  const base = SPINES[kind].map(([a, b]) => [mirror ? -a : a, b]);
  const sp = catmull(base);
  const c = DRAGON[col];
  drawDragon(P, x, y, len, 0, { spine: sp, w: 0.105, legs: true, gold: c.gold, dark: c.dark, light: c.light, h: 0.92 });
}

/** 海水江崖：立水斜纹 + 卧浪（卷曲浪花） */
function waves(P, y0, r) {
  const W = P.W, H = P.H;
  const cols = [[20, 62, 124], [30, 108, 104], [26, 82, 148], [38, 126, 114], [24, 70, 136]];
  const N = 9;
  for (let k = 0; k < N; k++) {
    const yy = H - 4 - (k * (H - y0)) / N;
    const pts = [];
    for (let x = -20; x <= W + 20; x += 20) pts.push([x, yy - 9 * Math.sin(x * 0.011 + k * 1.3) - 5 * Math.sin(x * 0.029 + k)]);
    P.poly([...pts, [W + 20, H + 10], [-20, H + 10]], { c: cols[k % cols.length], h: 0.18 + 0.025 * k, r: 0.32 });
    P.line(pts, 3.5, { c: [220, 236, 236], h: 0.24 + 0.025 * k });
  }
  for (let x = 20; x < W; x += 110 + r() * 70) {
    const yy = y0 + 6 + r() * 16, s = 30 + r() * 24;
    P.circle(x, yy, s, { c: [40, 126, 120], h: 0.42, r: 0.3 });
    P.draw((g) => g.arc(x, yy, s * 0.95, Math.PI * 0.85, Math.PI * 2.1), { lw: 6, c: [232, 242, 240], h: 0.5 });
    P.draw((g) => g.arc(x + s * 0.18, yy + s * 0.12, s * 0.52, Math.PI, Math.PI * 2.3), { lw: 4.5, c: [190, 226, 224], h: 0.47 });
    P.draw((g) => g.arc(x + s * 0.3, yy + s * 0.2, s * 0.2, 0, TAU), { lw: 3, c: [232, 242, 240], h: 0.5 });
  }
}

/** 云纹：如意云头 + 云尾（白色勾边） */
function cloud(P, x, y, s, c, h = 0.42, flip = 1) {
  const st = { c, h, r: 0.3 };
  for (const [a, b, rr] of [[0, -0.2, 0.3], [-0.36, 0.05, 0.24], [0.36, 0.05, 0.24], [0, 0.14, 0.22]]) P.circle(x + a * s, y + b * s, rr * s, st);
  P.line([[x + 0.3 * s * flip, y + 0.2 * s], [x + 0.75 * s * flip, y + 0.38 * s], [x + 1.2 * s * flip, y + 0.22 * s], [x + 1.7 * s * flip, y + 0.34 * s]], s * 0.15, st);
  for (const [a, b, rr] of [[0, -0.2, 0.3], [-0.36, 0.05, 0.24], [0.36, 0.05, 0.24]]) P.draw((g) => g.arc(x + a * s, y + b * s, rr * s * 0.55, 0.3, 0.3 + Math.PI * 1.5), { lw: Math.max(2, s * 0.06), c: [246, 250, 248], h: h + 0.04 });
}

/** 山石（分隔各区）：自海水中升起的层叠石峰，黄/紫/绿/白琉璃 */
function rockPillar(P, x, w, top, r) {
  const H = P.H;
  const tones = [[[214, 156, 50], [118, 72, 16]], [[136, 84, 146], [62, 32, 70]], [[56, 136, 88], [18, 60, 34]], [[226, 216, 188], [128, 118, 98]]];
  let y = H - 6;
  let k = 0;
  while (y > top) {
    const f = (y - top) / (H - top);
    const hh = 46 + r() * 40, ww = w * (0.7 + 0.3 * r()) * (0.45 + 0.55 * f);
    const cx = x + (r() - 0.5) * w * 0.3;
    const [c, d] = tones[k++ % tones.length];
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      pts.push([cx + Math.cos(a) * ww * (0.42 + 0.14 * r()), y - hh * 0.5 + Math.sin(a) * hh * (0.48 + 0.14 * r())]);
    }
    P.poly(pts, { c, h: 0.56 + 0.12 * r(), r: 0.28 });
    P.poly(pts, { lw: 3.5, c: d, h: 0.5 });
    for (let j = 0; j < 2; j++) P.line([[cx - ww * (0.25 - 0.2 * j), y - hh * 0.25], [cx + ww * 0.02, y - hh * (0.5 + 0.1 * j)], [cx + ww * 0.28, y - hh * 0.35]], 3, { c: d, h: 0.52 });
    y -= hh * 0.7;
  }
}

let painted = null;
/** 壁心绘制（一次）：返回 { P, F（模糊后的高度场，0..1） } */
export function jlbPaint() {
  if (painted) return painted;
  const W = TW, H = TH, r = rng(1772);
  const P = new Painter(W, H, { c: [30, 76, 142], h: 0.12, r: 0.34 });
  // 地：上蓝下绿的渐变
  P.rect(0, 0, W, H, { c: (g) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgb(40,96,164)'); gr.addColorStop(0.5, 'rgb(36,100,156)'); gr.addColorStop(1, 'rgb(30,110,128)'); return gr; }, h: 0.12 });
  // 云（密布）
  for (let i = 0; i < 240; i++) {
    const x = r() * W, y = 18 + r() * H * 0.62, s = 22 + r() * 30, t = r();
    cloud(P, x, y, s, t < 0.4 ? [96, 166, 214] : t < 0.75 ? [74, 158, 156] : [150, 196, 222], 0.3 + r() * 0.08, r() < 0.5 ? 1 : -1);
  }
  // 海水
  waves(P, H * 0.72, r);
  // 山石：四组分隔五区
  const cut = [0.185, 0.392, 0.608, 0.815];
  for (const u of cut) rockPillar(P, u * W, 230, H * 0.22, r);
  // 九龙：中区黄正龙；内区白升龙 + 蓝降龙；外区黄龙 + 紫龙（龙首皆朝向中央）
  const L = 700;
  const D = [
    // [u, v, kind, color, mirror(头朝左)]
    [0.505, 0.33, 'coil', 'yellow', false],
    [0.372, 0.25, 'rise', 'white', false], [0.3, 0.8, 'fall', 'blue', false],
    [0.628, 0.25, 'rise', 'white', true], [0.7, 0.8, 'fall', 'blue', true],
    [0.165, 0.25, 'rise', 'yellow', false], [0.098, 0.8, 'fall', 'purple', false],
    [0.835, 0.25, 'rise', 'yellow', true], [0.902, 0.8, 'fall', 'purple', true],
  ];
  for (const [u, v, kind, col, mir] of D) {
    const x = u * W, y = v * H;
    // 火焰宝珠在龙首前方
    const px = x + (mir ? -1 : 1) * L * 0.17, py = y + (kind === 'fall' ? -L * 0.05 : L * 0.04);
    if (kind !== 'coil') drawPearl(P, px, py, 17);
    dragon(P, x, y, kind === 'coil' ? L * 1.0 : L, kind, col, mir);
  }
  drawPearl(P, 0.5 * W + L * 0.2, 0.2 * H, 18);
  // 上下边框（琉璃线）
  P.rect(0, 0, W, 9, { c: [42, 118, 70], h: 0.6, r: 0.3 });
  P.rect(0, H - 9, W, 9, { c: [42, 118, 70], h: 0.6, r: 0.3 });
  // 高度场（模糊，用于网格位移）
  const d = P.L.h.getContext('2d').getImageData(0, 0, W, H).data;
  const F = new Float32Array(W * H);
  for (let i = 0; i < F.length; i++) F[i] = d[i * 4] / 255;
  painted = { P, F, W, H };
  return painted;
}

let texReady = false;
function ensureMaterial() {
  if (texReady) return;
  texReady = true;
  let res = null;
  const get = () => (res ||= finish(jlbPaint().P, { k: 6, blurR: 2, cav: 2.2, cavR: 4, toks: 0.6 }));
  registerTexture('nsh_jlb', () => get().color, { aniso: 16 });
  registerTexture('nsh_jlb_normal', () => get().normal, { aniso: 16 });
  registerTexture('nsh_jlb_rough', () => get().rough, { aniso: 16 });
  defineMaterial('nsh_jlb', { color: 0xffffff, map: 'nsh_jlb', normalMap: 'nsh_jlb_normal', roughnessMap: 'nsh_jlb_rough', roughness: 1, envMapIntensity: 1.15 });
}

/** 采样高度场（双线性，带简单盒式平滑） */
function sampler(F, W, H) {
  return (u, v) => {
    const x = clamp(u * (W - 1), 0, W - 1), y = clamp((1 - v) * (H - 1), 0, H - 1);
    let s = 0, n = 0;
    for (let dy = -3; dy <= 3; dy += 3) for (let dx = -4; dx <= 4; dx += 4) {
      const xi = clamp(Math.round(x + dx), 0, W - 1), yi = clamp(Math.round(y + dy), 0, H - 1);
      s += F[yi * W + xi]; n++;
    }
    return s / n;
  };
}

/**
 * 建造九龙壁。opts: { relief 浮雕最大凸出（米，默认 0.2）, nx, ny 壁心网格分辨率 }
 * 返回 { top }
 */
export function buildJiulongbi(ctx, opts = {}) {
  ensureMaterial();
  const { L, H, T, baseH, panelTop, post } = JLB;
  const relief = opts.relief ?? 0.2;
  // 须弥座（汉白玉）
  const bw = L + 0.24, bd = T + 0.34;
  buildXumizuo(ctx, [[-bw / 2, -bd / 2], [bw / 2, -bd / 2], [bw / 2, bd / 2], [-bw / 2, bd / 2]], 0, baseH, { edgeW: 0.12 });
  // 壁身（背面红灰，正面为壁心浮雕）
  const body = boxGeo(L, panelTop - baseH, T); body.translate(0, (baseH + panelTop) / 2, 0);
  ctx.add('wall_red', body);
  // 两端琉璃角柱（绿）
  for (const sx of [-1, 1]) {
    const g = boxGeo(post, panelTop - baseH, T + 0.06); g.translate(sx * (L / 2 - post / 2 + 0.02), (baseH + panelTop) / 2, 0);
    ctx.add('glaze_green', g);
  }
  // 壁心：位移网格
  const { F, W, H: TH2 } = jlbPaint();
  const samp = sampler(F, W, TH2);
  const pw = L - 2 * post, ph = panelTop - baseH;
  const nx = opts.nx ?? 640, ny = opts.ny ?? 48;
  const grid = [], uvg = [];
  for (let i = 0; i <= nx; i++) {
    const u = i / nx, row = [], urow = [];
    for (let j = 0; j <= ny; j++) {
      const v = j / ny;
      const hgt = clamp((samp(u, v) - 0.14) / 0.8, 0, 1);
      const edge = Math.min(1, Math.min(u, 1 - u) * nx / 2, Math.min(v, 1 - v) * ny / 2);
      row.push([-pw / 2 + u * pw, baseH + v * ph, T / 2 + 0.005 + relief * hgt * hgt * edge]);
      urow.push([u, v]);
    }
    grid.push(row); uvg.push(urow);
  }
  ctx.add('nsh_jlb', gridSurface(grid, uvg));
  // 琉璃仿木檐：额枋（绿地黄线）、平板枋、斗拱、挑檐枋
  const be = 0.17, yB = panelTop;
  const beam = boxGeo(L, be, T + 0.08);
  // 额枋正面 UV：u 沿长（米，周期 1.6）v 0..1
  const uv = beam.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) / be);
  beam.translate(0, yB + be / 2, 0);
  ctx.add('wl_glzbeam', beam);
  const pb = boxGeo(L + 0.06, 0.05, T + 0.14); pb.translate(0, yB + be + 0.025, 0);
  ctx.add('glaze_yellow', pb);
  const yD = yB + be + 0.05, dgH = 0.17, k = dgH / 3.7;
  const nD = Math.round(L / (8.5 * k));
  for (let i = 0; i <= nD; i++) {
    const x = -L / 2 + 0.1 + ((L - 0.2) * i) / nD;
    ctx.place('wl_dg:green', x, yD, T / 2, 0, k);
    ctx.place('wl_dg:green', x, yD, -T / 2, Math.PI, k);
  }
  for (const sx of [-1, 1]) ctx.place('wl_dg:green', sx * L / 2, yD, 0, sx * Math.PI / 2, k);
  const reach = 3.3 * k, yT = yD + dgH;
  const tj = boxGeo(L + 2 * reach, 0.06, T + 2 * reach); tj.translate(0, yT + 0.03, 0);
  ctx.add('glaze_green', tj);
  // 黄琉璃庑殿顶
  const ov = reach + 0.3, band = 0.13, yE = yT + 0.06 + band + 0.02;
  const rise = H - yE - 0.14;
  const info = buildRoof(ctx, { type: 'wudian', w: L + 2 * ov, d: T + 2 * ov, y: yE, rise, tile: 'yellow', band, bandMat: 'wl_rafter_green', overhang: ov + 0.15, beasts: 3, ridgeH: 0.22, wenH: 0.55, lift: 0.18, liftLen: 0.8, ornamentLOD: true });
  return { top: (info.ridgeY ?? yE + rise) + 0.22 };
}
