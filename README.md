# 紫禁城 · 三维全景（Three.js）

用 Three.js 程序化重建的北京故宫（紫禁城）完整三维模型。所有建筑、构件、纹理均由代码生成，不依赖任何外部模型或图片。

- **每一栋建筑**：位置与屋檐轮廓来自 OpenStreetMap 测绘（约 1100 个建筑轮廓、350 段宫墙、内金水河、筒子河），形制按清代官式做法逐区精修。
- **语音导游**：280 个建筑各有一段导游讲解（约 4.2 万字），全部配有 F5-TTS 语音（音色“人工老龙凤”，总长约 138 分钟）；点击建筑即播放，中轴漫游逐站讲解。
- **构件级细节**：屋顶（庑殿/歇山/悬山/硬山/攒尖/盝顶/卷棚/重檐，举折曲线与翼角起翘）、正吻与仙人走兽、斗拱（按斗口与踩数）、和玺/旋子/苏式彩画、隔扇菱花、门钉铺首、须弥座与汉白玉栏杆螭首、踏跺御路、琉璃门、影壁、铜狮铜缸日晷嘉量、古树假山水面。

## 运行

```bash
npm install
npm run dev
```

浏览器打开终端里显示的地址（默认 http://localhost:5173）。建议使用独立显卡。

| 地址参数 | 作用 |
|---|---|
| `?view=taihedian` | 打开时的视角（见 `src/ui/views.js`） |
| `?only=axis_south,walls` | 只构建指定分区（开发调试用） |
| `?ao=0` | 关闭环境光遮蔽 |

## 操作

- 左键旋转、右键平移、滚轮缩放
- **点击任意建筑或名称**：镜头飞往该建筑，弹出讲解卡并自动播放语音讲解（逐句高亮，可暂停、拖动进度，可关闭“自动讲解”）
- 左侧面板：视角预设、**中轴漫游**（自午门至神武门逐站飞行，每站讲完再走）、**漫步模式**（WASD 第一人称，可走上三台）、日照时间、显示选项
- 右上角小地图：点击跳转
- **寻找建筑**：按规范名、部分名称或别名搜索（例如“太和”“宫后苑”），点击结果或按 Enter 飞往建筑并打开讲解；Esc 清空搜索
- 面板可收起，手机窄屏默认收起；选择搜索结果后自动收起，给场景与讲解卡留出空间
- 导览过程中可通过搜索、视角预设、地图或拖动镜头中断；Esc 停止导览或退出漫步

## 验证与当前状态

```bash
npm run build
npm run verify:ui
```

浏览器检查需本机安装 Chrome 或 Edge，也可通过 `CHROME_PATH` 指定浏览器可执行文件。检查会加载完整场景，验证搜索、别名、导览中断、讲解取消及窄屏布局，截图保存到 `shots/overview-desktop.png` 和 `shots/search-mobile.png`。

v1.0：场景生成 1005 栋建筑、298 段宫墙，构建无错误。280 条讲解全部配音并通过质检（回听拼音吻合度 ≥ 0.94，响度一致，无截断）。全场景约 3000 万三角面，细部按距离自动隐藏；低性能设备可用 `?ao=0` 关闭环境光遮蔽。

## 讲解词与配音

讲解词在 `src/data/guide/*.json`（`name`、`aliases`、`sub`、`text`，可选 `speech` 为仅用于朗读的文本），配音清单在 `src/data/guide/audio.json`，音频在 `public/audio/guide/`。

配音使用本机 F5-TTS（`123_AI视频自动化` 项目的环境与 `src/tts_f5.py`），逐句合成、同一参考音频克隆音色；古建术语的多音字在朗读稿中自动替换为同音字（如“重檐”读作“崇檐”）。修改讲解词后：

```bash
"F:\我的编程项目\123_AI视频自动化\tools\f5-tts-env\python.exe" scripts/guide_tts.py   # 只重录改动过的条目
"F:\我的编程项目\123_AI视频自动化\tools\f5-tts-env\python.exe" scripts/audio_qc.py    # 质检：回听、响度、停顿、截断、语速
```

## 目录结构

```
data/osm_raw.json          OpenStreetMap 原始数据（Overpass 导出）
scripts/build-site.mjs     OSM → 场景坐标（米制，x 东 z 南，中轴 x=0）→ src/data/site.json
scripts/shot.mjs           无头 Chrome 截图（开发自检）
scripts/plot_site.py       平面图出图（带 OSM id 标注）
scripts/district-report.mjs 分区建筑清单 → docs/districts/*.md
scripts/guide_tts.py       讲解配音（F5-TTS）
scripts/audio_qc.py        配音质检
src/data/guide/            讲解词与配音清单
public/audio/guide/        讲解配音（mp3）
src/core/                  构件库：屋顶、斗拱、台基栏杆、门窗、墙门、脊饰、陈设、植物、纹理材质、单体总装
src/site/                  自动推断（轮廓分解、朝向、形制）与全场景总装
src/districts/             九个分区的逐栋精修与特殊建筑
src/ui/                    交互界面
catalog.html               构件测试台（catalog.html?t=<src/tests 下的测试名>）
```

架构与约定详见 `docs/ARCHITECTURE.md`。

## 数据来源与许可

建筑轮廓、宫墙、水系数据 © OpenStreetMap contributors，依 ODbL 授权使用。
