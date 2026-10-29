// 材质注册表。所有构件通过“材质 key”引用材质；纹理由 textures.js 程序化生成（Canvas）。
//
// ===== UV 约定（务必遵守，纹理按此设计）=====
// 以米计的 UV（period = 纹理一个重复周期对应的米数，由 DEFS[*].period 指定）：
//   tile_*          屋面瓦：u = 沿檐口方向米数，v = 沿坡面向上米数（从檐口起）
//   soffit          檐下（椽望）：u = 沿檐口米数，v = 自檐口向内米数
//   wall_red, wall_yellow, plaster_white, brick_grey, brick_dark, stone_grey, marble, rock, wood_*, gable_red,
//   paving, paving_imperial, grass, ground_dirt, water, roof_flat_grey：u/v = 米（立面：u 水平 v 竖直；地面：u=x v=z）
// 以 0..1 计的 UV（整块贴图映射到一个构件）：
//   beam_hexi / beam_xuanzi / beam_sushi  彩画梁枋：u 0..1 = 一个开间内从左柱到右柱，v 0..1 = 枋底到枋顶
//   eaveband        檐口椽头带：u = 沿檐口米数（周期 period），v 0..1 = 带底到带顶
//   lattice_door    隔扇门隔心：u,v 0..1 覆盖一扇隔心
//   lattice_window  槛窗/支摘窗：u,v 0..1 覆盖一扇窗心
//   door_panel      裙板/绦环板：u,v 0..1
//   gate_door       板门（门钉）：u,v 0..1 覆盖一扇门
//   marble_band     须弥座束腰雕饰带：u = 沿长度米数（周期 period），v 0..1
//   bofeng          博风板：u = 沿板米数，v 0..1
//   （新增）eaveband_sm/_lg、soffit_sm/_lg 同 eaveband/soffit，仅周期不同；marble_waist（束腰）/ marble_lotus（仰莲，v 翻转即覆莲）同 marble_band；
//   marble_block（条石错缝）、paving_square（方砖十字缝）、gable_plain（素山花）为米制；lattice_shuangjiao / lattice_fangge / lattice_denglong 同 lattice_door；
//   gate_door_8（八路门钉）同 gate_door。gate_door 铺首在 u≈0.8 一侧（门缝侧），右扇请镜像 u。匾额材质由 plaque.js makePlaque() 生成（u,v 0..1 整块匾面）。
// 顶点色材质（geometry 需带 color 属性）：dougong, vcolor, vcolor_glaze
import * as THREE from 'three';
import { makeTexture } from './textures.js';

const DEFS = {
  // 琉璃瓦屋面（tile_rough 带 Toksvig mip，远看不闪）
  tile_yellow: { color: 0xffffff, map: 'tile_yellow', normalMap: 'tile_normal', roughnessMap: 'tile_rough', roughness: 1, metalness: 0.0, period: [1.2, 1.2], envMapIntensity: 0.9 },
  tile_green: { color: 0xffffff, map: 'tile_green', normalMap: 'tile_normal', roughnessMap: 'tile_rough', roughness: 1, period: [1.2, 1.2], envMapIntensity: 0.9 },
  tile_blue: { color: 0xffffff, map: 'tile_blue', normalMap: 'tile_normal', roughnessMap: 'tile_rough', roughness: 1, period: [1.2, 1.2], envMapIntensity: 0.9 },
  tile_black: { color: 0xffffff, map: 'tile_black', normalMap: 'tile_normal', roughnessMap: 'tile_rough', roughness: 1, period: [1.2, 1.2], envMapIntensity: 0.9 },
  tile_purple: { color: 0xffffff, map: 'tile_purple', normalMap: 'tile_normal', roughnessMap: 'tile_rough', roughness: 1, period: [1.2, 1.2], envMapIntensity: 0.9 },
  tile_grey: { color: 0xffffff, map: 'tile_grey', normalMap: 'tile_normal', roughness: 0.9, period: [1.2, 1.2], envMapIntensity: 0.5 },
  // 琉璃脊件/吻兽（光滑）
  glaze_yellow: { color: 0xc27c10, roughness: 0.3, envMapIntensity: 1.3 },
  glaze_green: { color: 0x1f6a40, roughness: 0.3, envMapIntensity: 1.3 },
  glaze_blue: { color: 0x22468e, roughness: 0.3, envMapIntensity: 1.3 },
  glaze_black: { color: 0x1c1c22, roughness: 0.28, envMapIntensity: 1.3 },
  glaze_purple: { color: 0x5a2d55, roughness: 0.3 },
  glaze_grey: { color: 0x6d6f72, roughness: 0.85 },
  // 檐部（eaveband/soffit 每周期 4 根椽；_sm 用于带高 ≤0.2m 的小式，_lg 用于带高 ≥0.5m 的大殿，檐下与椽头宜同档）
  eaveband: { color: 0xffffff, map: 'eaveband', normalMap: 'eaveband_normal', roughnessMap: 'eaveband_rough', roughness: 1, period: [1.0, 1] },
  eaveband_sm: { color: 0xffffff, map: 'eaveband', normalMap: 'eaveband_normal', roughnessMap: 'eaveband_rough', roughness: 1, period: [0.6, 1] },
  eaveband_lg: { color: 0xffffff, map: 'eaveband', normalMap: 'eaveband_normal', roughnessMap: 'eaveband_rough', roughness: 1, period: [2.0, 1] },
  soffit: { color: 0xffffff, map: 'soffit', normalMap: 'soffit_normal', roughness: 0.82, period: [1.0, 1.0], side: THREE.DoubleSide },
  soffit_sm: { color: 0xffffff, map: 'soffit', normalMap: 'soffit_normal', roughness: 0.82, period: [0.6, 0.6], side: THREE.DoubleSide },
  soffit_lg: { color: 0xffffff, map: 'soffit', normalMap: 'soffit_normal', roughness: 0.82, period: [2.0, 2.0], side: THREE.DoubleSide },
  gable_red: { color: 0xffffff, map: 'gable_red', normalMap: 'gable_red_normal', roughnessMap: 'gable_red_rough', roughness: 1, period: [3, 3] },
  gable_plain: { color: 0xffffff, map: 'gable_plain', normalMap: 'gable_plain_normal', roughness: 0.75, period: [3, 3] },
  bofeng: { color: 0xffffff, map: 'bofeng', normalMap: 'bofeng_normal', roughnessMap: 'bofeng_rough', roughness: 1, period: [2.0, 1] },
  // 木作
  wood_red: { color: 0x8c1d13, map: 'lacquer_red', roughness: 0.42, period: [1.5, 3], envMapIntensity: 0.8 },
  wood_green: { color: 0x2c5a3c, roughness: 0.5 },
  wood_brown: { color: 0x5a3a22, roughness: 0.7 },
  wood_dark: { color: 0x2b1d14, roughness: 0.8 },
  board_red: { color: 0x9a281c, roughness: 0.6 },
  board_green: { color: 0x2f6650, roughness: 0.6 },
  beam_hexi: { color: 0xffffff, map: 'beam_hexi', normalMap: 'beam_hexi_normal', roughnessMap: 'beam_hexi_rough', roughness: 1 },
  beam_xuanzi: { color: 0xffffff, map: 'beam_xuanzi', normalMap: 'beam_xuanzi_normal', roughnessMap: 'beam_xuanzi_rough', roughness: 1 },
  beam_sushi: { color: 0xffffff, map: 'beam_sushi', normalMap: 'beam_sushi_normal', roughnessMap: 'beam_sushi_rough', roughness: 1 },
  dougong: { color: 0xffffff, vertexColors: true, roughness: 0.6 },
  lattice_door: { color: 0xffffff, map: 'lattice_door', normalMap: 'lattice_door_normal', roughnessMap: 'lattice_door_rough', roughness: 1 },
  lattice_window: { color: 0xffffff, map: 'lattice_window', normalMap: 'lattice_window_normal', roughnessMap: 'lattice_window_rough', roughness: 1 },
  lattice_shuangjiao: { color: 0xffffff, map: 'lattice_shuangjiao', normalMap: 'lattice_shuangjiao_normal', roughnessMap: 'lattice_shuangjiao_rough', roughness: 1 },
  lattice_fangge: { color: 0xffffff, map: 'lattice_fangge', normalMap: 'lattice_fangge_normal', roughnessMap: 'lattice_fangge_rough', roughness: 1 },
  lattice_denglong: { color: 0xffffff, map: 'lattice_denglong', normalMap: 'lattice_denglong_normal', roughnessMap: 'lattice_denglong_rough', roughness: 1 },
  door_panel: { color: 0xffffff, map: 'door_panel', normalMap: 'door_panel_normal', roughnessMap: 'door_panel_rough', roughness: 1 },
  gate_door: { color: 0xffffff, map: 'gate_door', normalMap: 'gate_door_normal', roughnessMap: 'gate_door_rough', roughness: 1, metalnessMap: null },
  gate_door_8: { color: 0xffffff, map: 'gate_door_8', normalMap: 'gate_door_8_normal', roughnessMap: 'gate_door_8_rough', roughness: 1 },
  // 砖石
  wall_red: { color: 0xffffff, map: 'wall_red', normalMap: 'wall_red_normal', normalScale: 0.6, roughness: 0.92, period: [4, 4] },
  wall_yellow: { color: 0xd9b56a, roughness: 0.9 },
  plaster_white: { color: 0xe8e2d4, roughness: 0.9 },
  brick_grey: { color: 0xffffff, map: 'brick_grey', normalMap: 'brick_grey_normal', roughness: 0.9, period: [2.4, 2.4] },
  brick_dark: { color: 0xffffff, map: 'brick_dark', normalMap: 'brick_dark_normal', roughness: 0.92, period: [2.0, 2.08] },
  stone_grey: { color: 0xffffff, map: 'stone', normalMap: 'stone_normal', roughness: 0.8, period: [2, 2] },
  marble: { color: 0xffffff, map: 'marble', normalMap: 'marble_normal', normalScale: 0.5, roughness: 0.55, period: [2, 2] },
  marble_block: { color: 0xffffff, map: 'marble_block', normalMap: 'marble_block_normal', roughness: 0.6, period: [2, 2] },
  marble_band: { color: 0xffffff, map: 'marble_band', normalMap: 'marble_band_normal', roughness: 0.62, period: [1.5, 1] },
  marble_waist: { color: 0xffffff, map: 'marble_waist', normalMap: 'marble_waist_normal', roughness: 0.62, period: [1.5, 1] },
  marble_lotus: { color: 0xffffff, map: 'marble_lotus', normalMap: 'marble_lotus_normal', roughness: 0.62, period: [1.5, 1] },
  paving: { color: 0xffffff, map: 'paving', normalMap: 'paving_normal', normalScale: 0.7, roughness: 0.92, period: [8, 8] },
  paving_square: { color: 0xffffff, map: 'paving_square', normalMap: 'paving_square_normal', normalScale: 0.7, roughness: 0.9, period: [4, 4] },
  paving_imperial: { color: 0xffffff, map: 'paving_imperial', normalMap: 'paving_imperial_normal', roughness: 0.75, period: [3, 3] },
  roof_flat_grey: { color: 0x77756f, roughness: 0.95 },
  // 自然
  grass: { color: 0xffffff, map: 'grass', normalMap: 'grass_normal', roughness: 1.0, period: [6, 6] },
  ground_dirt: { color: 0x9a8a6e, roughness: 1.0 },
  rock: { color: 0xffffff, map: 'rock', normalMap: 'rock_normal', roughness: 0.95, period: [2, 2] },
  water: { color: 0x2d4a52, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.0 },
  leaf_pine: { color: 0x2f4a2a, roughness: 0.9 },
  leaf_cypress: { color: 0x3b5230, roughness: 0.9 },
  leaf_broad: { color: 0x4f6e33, roughness: 0.9 },
  leaf_willow: { color: 0x7d9a45, roughness: 0.9 },
  bark: { color: 0x4a3b2e, roughness: 1.0 },
  // 金属
  gold: { color: 0xe0b347, roughness: 0.25, metalness: 1.0, envMapIntensity: 1.4 },
  bronze: { color: 0x4a3a28, roughness: 0.45, metalness: 0.9 },
  bronze_gilt: { color: 0xb88a3a, roughness: 0.35, metalness: 1.0 },
  iron: { color: 0x2a2a2c, roughness: 0.6, metalness: 0.7 },
  // 通用顶点色
  vcolor: { color: 0xffffff, vertexColors: true, roughness: 0.7 },
  vcolor_glaze: { color: 0xffffff, vertexColors: true, roughness: 0.32, envMapIntensity: 1.2 },
};

const cache = new Map();
const extraDefs = new Map();
let envMap = null;

/** 运行时追加材质定义（如匾额等每栋不同的材质） */
export function defineMaterial(key, def) {
  extraDefs.set(key, def);
  cache.delete(key);
}

export function materialUsesVertexColor(key) {
  const d = DEFS[key] || extraDefs.get(key);
  return !!(d && d.vertexColors);
}

export function setEnvMap(tex) {
  envMap = tex;
  for (const m of cache.values()) { m.envMap = tex; m.needsUpdate = true; }
}

function applyPeriod(tex, period) {
  if (!tex || !period) return tex;
  const t = tex.clone();
  t.repeat.set(1 / period[0], 1 / period[1]);
  t.needsUpdate = true;
  return t;
}

export function getMaterial(key) {
  if (cache.has(key)) return cache.get(key);
  const d = DEFS[key] || extraDefs.get(key);
  let mat;
  if (!d) {
    console.warn('unknown material', key);
    mat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
  } else if (d.material) {
    mat = d.material;
  } else {
    const p = { color: d.color ?? 0xffffff, roughness: d.roughness ?? 0.8, metalness: d.metalness ?? 0 };
    if (d.vertexColors) p.vertexColors = true;
    if (d.side) p.side = d.side;
    if (d.transparent) { p.transparent = true; p.opacity = d.opacity ?? 1; }
    if (d.alphaTest) p.alphaTest = d.alphaTest;
    mat = new THREE.MeshStandardMaterial(p);
    if (d.map) { const t = makeTexture(d.map); if (t) mat.map = applyPeriod(t, d.period); }
    if (d.normalMap) { const t = makeTexture(d.normalMap); if (t) { mat.normalMap = applyPeriod(t, d.period); mat.normalScale = new THREE.Vector2(1, 1).multiplyScalar(d.normalScale ?? 1); } }
    if (d.roughnessMap) { const t = makeTexture(d.roughnessMap); if (t) mat.roughnessMap = applyPeriod(t, d.period); }
    if (d.envMapIntensity !== undefined) mat.envMapIntensity = d.envMapIntensity;
  }
  if (envMap && !mat.envMap) mat.envMap = envMap;
  mat.name = key;
  mat.userData.noShadow = !!(d && d.noShadow);
  cache.set(key, mat);
  return mat;
}

export function allMaterialKeys() {
  return [...Object.keys(DEFS), ...extraDefs.keys()];
}

/** 瓦色 -> 屋面材质 / 脊件材质 */
export const tileMat = (c = 'yellow') => `tile_${c}`;
export const glazeMat = (c = 'yellow') => `glaze_${c}`;
