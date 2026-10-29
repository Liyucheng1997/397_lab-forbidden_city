// 紫禁城城墙：矩形环（buildCityWall）+ 四隅角楼城台（墙角向内加宽的方形墩台）及其垛口、宇墙
import { buildCityWall } from '../../core/walls.js';
import { Acc, OW, WALL_H, WALL_B, WALL_T, KB, D_OUT, D_IN, DUO, YU, WALL_MAT, duoRun, yuRun } from './common.js';

/** 角楼墩台边长（自城墙外皮量起）、角楼方亭中心距两外皮的距离 */
export const BASTION = 28.4, TOWER_OFF = 10.9;

/** 四隅：sx/sz = +1 东/南，-1 西/北；(X0,Z0) 外角点；ux/uz 指向城内 */
export function corner(sx, sz) {
  const X0 = sx > 0 ? OW.east : OW.west, Z0 = sz > 0 ? OW.south : OW.north;
  return { sx, sz, X0, Z0, ux: -sx, uz: -sz, rot: Math.atan2(sx, sz) - Math.PI / 4, cx: X0 - sx * TOWER_OFF, cz: Z0 - sz * TOWER_OFF };
}

/** 使开口折线的 +o 侧（N=(dz,-dx)）朝向 out 向量 */
function orient(path, out) {
  const a = path[0], b = path[1], dx = b[0] - a[0], dz = b[1] - a[1];
  return dz * out[0] - dx * out[1] >= 0 ? path : path.slice().reverse();
}

/** 墩台：两内侧收分立面（石基、红灰墙身、城砖顶带）、顶面城砖、外侧垛口、内侧宇墙 */
function bastion(ctx, acc, k) {
  const { X0, Z0, ux, uz } = k;
  const W = (a, b, y) => [X0 + ux * a, y, Z0 + uz * b];
  const S = BASTION, B = WALL_B, K = KB, H = WALL_H;
  for (const [y0, y1, mat, pr] of [[0, 1.2, 'stone_grey', 0.03], [1.2, H - 0.24, WALL_MAT, 0], [H - 0.24, H, 'brick_grey', 0.06]]) {
    const A0 = S - K * y0 + pr, A1 = S - K * y1 + pr;
    acc.quad(mat, [W(A0, B - K * y0, y0), W(A0, A0, y0), W(A1, A1, y1), W(A1, B - K * y1, y1)], [[B - K * y0, y0], [A0, y0], [A1, y1], [B - K * y1, y1]], [ux, 0, 0]);
    acc.quad(mat, [W(B - K * y0, A0, y0), W(A0, A0, y0), W(A1, A1, y1), W(B - K * y1, A1, y1)], [[B - K * y0, y0], [A0, y0], [A1, y1], [B - K * y1, y1]], [0, 0, uz]);
    if (pr > 0.04) { // 顶带下皮
      const a0 = S - K * y0;
      acc.quad(mat, [W(a0, B - K * y0, y0), W(a0, a0, y0), W(A0, A0, y0), W(A0, B - K * y0, y0)], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0]);
      acc.quad(mat, [W(B - K * y0, a0, y0), W(a0, a0, y0), W(A0, A0, y0), W(B - K * y0, A0, y0)], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0]);
    }
  }
  const St = S - K * H + 0.06, yt = H + 0.005;
  const top = [W(D_IN, D_IN, yt), W(St, D_IN, yt), W(St, St, yt), W(D_IN, St, yt)];
  acc.quad('wl_madao', top, top.map((p) => [p[0], p[2]]), [0, 1, 0]);
  // 外侧垛口（沿两外皮）与内侧宇墙（沿墩台内沿），与城墙在 cornerSkip 处衔接
  const toW = (P) => P.map(([a, b]) => [X0 + ux * a, Z0 + uz * b]);
  const dc = D_OUT + DUO.t / 2, cs = BASTION;
  duoRun(ctx, acc, orient(toW([[cs, dc], [dc, dc], [dc, cs]]), [0, -uz]));
  const yc = D_IN - YU.t / 2, ye = S - K * H - YU.t / 2;
  yuRun(acc, toW([[cs, yc], [ye, yc], [ye, ye], [yc, ye], [yc, cs]]), { y: H });
}

/**
 * 城墙全圈。gaps：[{side, from, to}]（城门缺口，见 buildCityWall）
 */
export function buildOuterWall(ctx, gaps) {
  buildCityWall(ctx, {
    x0: OW.west, x1: OW.east, z0: OW.north, z1: OW.south, h: WALL_H, baseThick: WALL_B, topThick: WALL_T,
    gaps, cornerSkip: BASTION, outerMat: WALL_MAT, innerMat: WALL_MAT, parapetMat: WALL_MAT, spouts: 36,
  });
  const acc = new Acc();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bastion(ctx, acc, corner(sx, sz));
  acc.flush(ctx);
}
