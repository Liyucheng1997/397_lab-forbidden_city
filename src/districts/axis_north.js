// 分区：内廷中轴（乾清门—后三宫—御花园—神武门）
// 子模块：axis_north/qianqing.js（乾清门至坤宁门）、axis_north/garden.js（御花园、顺贞门）、axis_north/shenwu.js（神武门）
import { overrides as qqOv, buildStreetWallGates } from './axis_north/qianqing.js';
import { overrides as gdOv, buildGarden } from './axis_north/garden.js';
import { overrides as swOv } from './axis_north/shenwu.js';
import { autoFix } from './axis_north/lib.js';

// 其余无名小房（神武门内外值房、东西长街外侧房屋等）：沿用自动推断形制，仅经 FixCtx 构建（见 lib.js）
const AUTO = [40606307, 40606308, 40631337, 40631341, 40631349, 40631807, 40631815, 42311941, 42311942, 42353091, 42353094, 42424165,
  638741716, 638741717, 638741720, 638741721, 683954211, 684753128, 684753131, 684753134, 684753136, 684753139, 685428160, 685441235];
const autoOv = Object.fromEntries(AUTO.map((id) => [id, autoFix(id === 42424165 ? { rotY: 0 } : {})]));

export default {
  key: 'axis_north',
  title: '内廷中轴（乾清门—神武门）',
  overrides: { ...autoOv, ...qqOv, ...gdOv, ...swOv },
  wallOverrides: {
    638807616: 'skip', // 乾清门西侧宫墙与八字影壁（在乾清门覆盖中重建）
    42623321: 'skip', 42623325: 'skip', 42623373: 'skip', 42623374: 'skip', // 仁祥门、咸和左门、广生左门、大成左门（OSM 以墙表示，build 中建琉璃门）
    639122654: 'skip', // 顺贞门（build 中建三座琉璃门）
    42393620: { h: 4.2, thick: 0.9 }, 42393624: { h: 4.2, thick: 0.9 }, // 承光门两侧矮墙
    685600255: { h: 4.6, thick: 0.9 }, 685600256: { h: 4.6, thick: 0.9 }, 685600257: { h: 4.6, thick: 0.9 }, // 钦安殿院墙
    685600258: { h: 4.6, thick: 0.9 }, 685600259: { h: 4.6, thick: 0.9 }, 685600260: { h: 4.6, thick: 0.9 },
  },
  bridgeOverrides: {},
  build(ctx, api) {
    buildStreetWallGates(ctx, api);
    buildGarden(ctx, api);
  },
};
