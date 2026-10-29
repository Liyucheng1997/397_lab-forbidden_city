# 紫禁城三维模型 — 架构与约定

## 技术栈
- Three.js 0.170（npm），Vite 6，纯 ES Module，无外部图片资源：所有纹理 Canvas 程序化生成，所有构件程序化建模。
- 场景数据来自 OpenStreetMap（`data/osm_raw.json` → `scripts/build-site.mjs` → `src/data/site.json`），ODbL，需署名 “© OpenStreetMap contributors”。

## 坐标与单位
- 1 单位 = 1 米。X 向东，Y 向上，Z 向南（北 = -Z）。原点 = 紫禁城外墙矩形中心，中轴线 X = 0。
- 外墙外皮：x ∈ [-374.2, 377.7]，z ∈ [-484.8, 484.8]（见 `src/config.js` OUTER_WALL）。
- 单体局部坐标：建筑中心在原点，**正面朝 +Z**，面阔沿 X，进深沿 Z。朝向 rotY：朝南 0，朝北 π，朝东 +π/2，朝西 -π/2。

## 核心模块（src/core）
| 文件 | 内容 |
|---|---|
| `batcher.js` | `Batcher`（按材质合并几何 + 原型实例化）与 `Ctx`（局部坐标上下文） |
| `geom.js` | 几何工具：`boxGeo` `cylGeo` `latheGeo` `prismGeo` `polyTopGeo` `gridSurface` `sweep` `merge` `mergeColored` `paint` `offsetPoly` `samplePolyline` |
| `materials.js` | 材质注册表 + **UV 约定**（务必阅读文件头注释）；`defineMaterial(key, def)` 可在自己的模块里追加材质 |
| `textures.js` | Canvas 程序化纹理；`registerTexture(name, fn)` 可在自己的模块里追加纹理 |
| `protos.js` | 原型注册：`registerProtoFamily(prefix, (key, args) => [{mat, geo}])`；key 形如 `beast:3:yellow` |
| `env.js` | 渲染器、天空、日光阴影、环境贴图 |
| `roof.js` | 屋顶生成器（庑殿/歇山/悬山/硬山/攒尖/盝顶/腰檐/卷棚） |
| `ornaments.js` | 脊饰原型：正吻 `wen`、走兽 `beast`、垂兽 `chuishou`、套兽 `taoshou`、宝顶 `baoding`、瓦当 `wadang` |
| `dougong.js` | 斗拱原型 `dougong:<ping|zhu|jiao>:<cai>` 与 `placeDougong()` |
| `platform.js` | `buildPlatform` `buildRailing` `buildStairs` |
| `openings.js` | `buildBay`（隔扇/槛窗/支摘窗/板门/实墙）`buildCorridorTrim` |
| `walls.js` | `buildPalaceWall` `buildCityWall` `buildWallGate` `buildScreenWall` |
| `props.js` | 陈设原型（铜狮、铜缸、日晷……）与 `buildBridge` |
| `nature.js` | 树木原型 `tree:<kind>:<v>`、`buildRockery`、`createWater`、`buildLawn` |
| `building.js` | 单体建筑总装：`buildHall(ctx, spec)`（台基→柱网→梁枋彩画→门窗→斗拱→屋顶） |

### Ctx 用法
```js
const c = ctx.at(x, y, z, rotY);       // 子坐标系
c.add('wall_red', geometry);            // 合并几何（几何体不会被修改，可复用）
c.place('beast:3:yellow', x, y, z, rotY, scale);   // 原型实例
```
几何体须带 `position/normal/uv`（`geom.js` 工具均满足）。顶点色材质（`dougong`, `vcolor`, `vcolor_glaze`）需带 `color` 属性（`paint()` / `mergeColored()`）。

### 原型（实例化）约定
- 工厂返回 `[{ mat: 材质key, geo: BufferGeometry }]`，可多材质部件；按“单位尺寸”建模，调用方矩阵缩放。
- 每个原型部件都会成为一个 InstancedMesh，**三角形预算要克制**（见各文件头部说明）。

## 测试与自检（每个模块都必须做）
1. 写 `src/tests/<name>.js`：`export default function build(ctx, {THREE, scene}) { ...; return { cam:[x,y,z], tgt:[x,y,z] } }`
2. 截图：`node scripts/shot.mjs --page "catalog.html?t=<name>" --out shots/<name>.png [--cam x,y,z --tgt x,y,z] [--w 1400 --h 900]`
   多视角：写一个 JSON 数组 `[{page,out,cam,tgt}]`，`node scripts/shot.mjs --shots shots/<name>_plan.json`（只加载一次页面）
3. 用 Read 工具查看 PNG，对照真实故宫建筑形制反复修改，直到满意。stdout 会打印控制台错误与三角形数。
4. 截图文件放 `shots/` 下以自己模块名为前缀，避免与他人冲突。

## 品质要求
- 形制正确（清官式做法），比例协调，色彩接近实物（琉璃黄偏橙金、朱红柱、青绿彩画、汉白玉）。
- 近看有细节，远看不闪烁（纹理需可平铺、mipmap 友好，避免高频噪点）。
- 性能：全场景约 1000 栋建筑；重复件走原型实例化；单个原型三角形数遵守预算。
