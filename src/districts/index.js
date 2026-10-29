// 分区注册表与归属规则。每个分区模块默认导出：
// { key, title, overrides: { [osmId]: 'skip' | spec补丁 | [完整 spec 数组] | (ctx, b, api) => void },
//   wallOverrides: { [wallId]: 'skip' | {h, thick, cap, style, base, gaps} }, bridgeOverrides: { [id]: 'skip' },
//   build(ctx, api) {...额外内容：特殊建筑、陈设、树木、铺地、栏杆…} }
import walls from './walls.js';
import axisSouth from './axis_south.js';
import axisNorth from './axis_north.js';
import eastOuter from './east_outer.js';
import eastInner from './east_inner.js';
import ningshou from './ningshou.js';
import westOuter from './west_outer.js';
import westInner from './west_inner.js';
import cining from './cining.js';

export const DISTRICTS = [walls, axisSouth, axisNorth, eastOuter, eastInner, ningshou, westOuter, westInner, cining];

/** 外墙、角楼、四门由 walls 分区负责（按 OSM id 指定） */
export const WALLS_IDS = new Set([
  156145604, 156145763, 156146468, 156146621, // 四角楼（OSM 名为 西北城墙 等）
  40343947, 40343948, // 东华门、西华门
]);

/** 按质心归属分区 */
export function districtOf(x, z, b) {
  if (b && WALLS_IDS.has(b.id)) return 'walls';
  if (Math.abs(x) <= 128 && z >= -118) return 'axis_south';
  if (Math.abs(x) <= 75 && z < -118) return 'axis_north';
  if (x > 128 && z >= -40) return 'east_outer';
  if (x > 75 && x <= 232 && z < -40) return 'east_inner';
  if (x > 232 && z < -40) return 'ningshou';
  if (x < -128 && z >= 40) return 'west_outer';
  if (x >= -170 && x < -75 && z < -118) return 'west_inner';
  return 'cining';
}

/** 分区范围（用于出图与相机预设）：[x0, x1, z0, z1] */
export const DISTRICT_BOUNDS = {
  walls: [-470, 470, -590, 600],
  axis_south: [-128, 128, -118, 580],
  axis_north: [-75, 75, -500, -118],
  east_outer: [128, 400, -40, 500],
  east_inner: [75, 232, -500, -40],
  ningshou: [232, 400, -500, -40],
  west_outer: [-400, -128, 40, 500],
  west_inner: [-170, -75, -500, -118],
  cining: [-400, -128, -500, 40],
};
