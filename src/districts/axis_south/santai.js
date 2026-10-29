// 三台：汉白玉须弥座三层（总高 8.13m，土字形），每层龙凤望柱栏杆与螭首（转角大螭首），
// 前后三出陛（中为云龙御路石，保和殿后最大云龙石雕），两侧踏跺，太和殿/保和殿两山卡墙，
// 月台陈设（日晷、嘉量、铜龟铜鹤、十八鼎、鎏金铜缸）。
import { buildPlatform } from '../../core/platform.js';
import { propHeight } from '../../core/props.js';
import { T1, T2, T3, palaceWall } from './lib.js';

/** 东半边外轮廓（自北而南），镜像得全多边形 */
const HALF = {
  1: [[65.6, -63.8], [65.6, 18.2], [36.2, 18.2], [36.2, 47.3], [66.2, 47.3], [66.2, 131.0], [44.0, 131.0], [44.0, 166.6]],
  2: [[58.8, -56.6], [58.8, 12.6], [28.0, 12.6], [28.0, 53.3], [58.9, 53.3], [58.9, 124.9], [38.4, 124.9], [38.4, 157.3]],
  3: [[53.8, -51.3], [53.8, 7.6], [22.4, 7.6], [22.4, 58.5], [53.6, 58.5], [53.6, 119.0], [32.7, 119.0], [32.7, 150.0]],
};
const full = (h) => [...h, ...h.map(([x, z]) => [-x, z]).reverse()];
export const TIER_POLY = { 1: full(HALF[1]), 2: full(HALF[2]), 3: full(HALF[3]) };
const TOP = { 1: T1, 2: T2, 3: T3 };
const H = T1; // 每层高
/** 台阶长：南面（月台前三出陛）、北面（保和殿后） */
const RUN_S = { 3: 7.3, 2: 9.3, 1: 15.0 }, RUN_N = { 3: 5.3, 2: 7.2, 1: 17.5 };
const EDGE_S = { 3: 150.0, 2: 157.3, 1: 166.6 }, EDGE_N = { 3: -51.3, 2: -56.6, 1: -63.8 };
export const KAQ = { taihe: { z: 102.3, x0: 30.4 }, baohe: { z: -31.9, x0: 23.95 } };

/** 点是否在多边形内 */
function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/** 三台台面高度（不在台上返回 0） */
export function santaiHeight(x, z) {
  for (const k of [3, 2, 1]) if (pip(x, z, TIER_POLY[k])) return TOP[k];
  return 0;
}

export function buildSantai(ctx) {
  for (const k of [1, 2, 3]) {
    const y0 = TOP[k] - H;
    const stairs = [];
    // 前后三出陛：中为御路（云龙石雕），两侧踏跺
    stairs.push({ at: [0, EDGE_S[k]], w: 8.0, run: RUN_S[k], yulu: { w: 3.07 }, railings: true });
    for (const s of [-1, 1]) stairs.push({ at: [s * 10.7, EDGE_S[k]], w: 4.0, run: RUN_S[k], railings: true });
    stairs.push({ at: [0, EDGE_N[k]], w: 6.9, run: RUN_N[k], yulu: { w: 3.07 }, railings: true });
    for (const s of [-1, 1]) stairs.push({ at: [s * 10.5, EDGE_N[k]], w: 3.7, run: RUN_N[k], railings: true });
    // 东西两侧的踏跺（月台 → 中左门/中右门方向）
    for (const s of [-1, 1]) {
      if (k === 3) stairs.push({ at: [s * 32.7, 123.0], w: 2.1, run: 4.1, railings: true });
      if (k === 2) {
        stairs.push({ at: [s * 40.9, 124.9], w: 1.9, run: 4.4, railings: true });
        stairs.push({ at: [s * 58.9, 110.9], w: 2.4, run: 3.8, railings: true });
      }
      if (k === 1) stairs.push({ at: [s * 44.0, 133.0], w: 3.2, run: 9.5, railings: true });
    }
    // 栏杆缺口：卡墙穿越处、中左/中右门与后左/后右门衔接处
    const gaps = [];
    for (const s of [-1, 1]) {
      const xe = { 1: [65.6, 66.2], 2: [58.8, 58.9], 3: [53.8, 53.6] }[k];
      if (k === 1) {
        gaps.push({ at: [s * xe[1], 102.6], w: 17.4, end: 'drum' });
        gaps.push({ at: [s * xe[0], -33.5], w: 17.4, end: 'drum' });
      } else {
        gaps.push({ at: [s * xe[1], KAQ.taihe.z], w: 2.6, end: 'post' });
        gaps.push({ at: [s * xe[0], KAQ.baohe.z], w: 2.6, end: 'post' });
      }
    }
    buildPlatform(ctx, {
      poly: TIER_POLY[k], y0, h: H, style: 'xumizuo', edgeW: 0.6,
      railing: { style: 'marble_dragon', chishou: true, gaps },
      stairs,
    });
  }
  // 卡墙：太和殿、保和殿两山至中左/中右门、后左/后右门，随台层跌落
  for (const s of [-1, 1]) {
    // 低段向高台一侧埋入 0.9m，避免台阶处露缝；末段伸入门殿山墙
    for (const [key, xs] of [['taihe', [[KAQ.taihe.x0, 53.6, T3], [52.7, 58.9, T2], [58.0, 67.4, T1]]], ['baohe', [[KAQ.baohe.x0, 53.8, T3], [52.9, 58.8, T2], [57.9, 66.8, T1]]]]) {
      const z = KAQ[key].z;
      for (const [a, b, y0] of xs) {
        const xa = s * a, xb = s * b;
        palaceWall(ctx, [[Math.min(xa, xb), z], [Math.max(xa, xb), z]], { y0, h: 6.2, thick: 2.1, cap: 'yellow' });
      }
    }
  }
}

/** 三台陈设 */
export function placeSantaiProps(ctx) {
  const P = (key, x, y, z, rot = 0) => ctx.place(key, x, y, z, rot, propHeight(key));
  // 太和殿月台：东日晷、西嘉量；铜龟、铜鹤各一对
  P('sundial', 27.6, T3, 127.0, 0);
  P('jialiang', -27.6, T3, 127.0, 0);
  for (const s of [-1, 1]) {
    P('tortoise', s * 17.5, T3, 116.5, 0);
    P('crane', s * 23.5, T3, 120.5, 0);
  }
  // 十八座鼎式香炉：三层台面月台两侧各三座
  for (const s of [-1, 1]) {
    for (const z of [129, 137.5, 146]) P('censer:ding', s * 29.6, T3, z, 0);
    for (const z of [134, 143, 152.5]) P('censer:ding', s * 35.6, T2, z, 0);
    for (const z of [141, 150.5, 161]) P('censer:ding', s * 41.3, T1, z, 0);
  }
  // 鎏金铜缸：太和殿两山、保和殿两山
  for (const s of [-1, 1]) {
    for (const z of [76, 96]) P('vat:gilt', s * 40.5, T3, z);
    for (const z of [-25.5, -40]) P('vat:gilt', s * 36.5, T3, z);
  }
}
