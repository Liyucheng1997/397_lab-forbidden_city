// 全局约定
// 1 单位 = 1 米；X 向东，Y 向上，Z 向南（北 = -Z）。原点 = 紫禁城外墙矩形中心；中轴线 X = 0。
// 单体建筑局部坐标：建筑中心在原点，正面（前檐）朝 +Z，面阔沿 X，进深沿 Z。
// rotY：绕 Y 轴旋转。正面朝南 rotY=0；朝北 Math.PI；朝东 +Math.PI/2；朝西 -Math.PI/2。

export const FACING = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

// 外墙（由 OSM 测得，见 scripts/build-site.mjs 输出）
export const OUTER_WALL = {
  west: -374.2,
  east: 377.7,
  north: -484.8, // z
  south: 484.8, // z
  height: 10, // 城墙高
  baseThick: 8.62, // 底宽
  topThick: 6.66, // 顶宽
};

export const MOAT = { width: 52, offset: 20 }; // 筒子河宽度，与城墙间距（近似）

// 太阳（下午偏西南的暖光，突出琉璃瓦）
export const SUN = { azimuthDeg: 215, elevationDeg: 38 };

// 屋面琉璃瓦颜色 key
export const TILE_COLORS = ['yellow', 'green', 'blue', 'black', 'grey', 'purple'];
