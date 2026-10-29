// 分区：紫禁城外围——城墙（含四隅墩台）、四座角楼、东华门、西华门、筒子河两岸、城外街道与垂柳、景山远景
import { OW, WALL_H, KB, YU } from './walls/common.js';
import { buildOuterWall, corner } from './walls/cityWall.js';
import { buildCornerTower } from './walls/cornerTower.js';
import { buildSideGate, buildRamps, flatYu } from './walls/sideGate.js';
import { buildMoatSurroundings } from './walls/moat.js';
import { buildJingshan } from './walls/jingshan.js';
import { buildCityContext } from './walls/context.js';

const GATE_H = 10.06; // 城台略高于城墙马道面，顶面不与马道共面
const BT = KB * GATE_H; // 城台每侧收分

/** 东华门、西华门城台（OSM 轮廓：外皮对齐城墙外皮） */
const DHM = { x0: 352.55, x1: OW.east, z0: 320.55, z1: 373.25 };
const XHM = { x0: OW.west, x1: -346.38, z0: 328.75, z1: 378.29 };

const TOWER_DESC = '紫禁城四隅角楼，明永乐十八年（1420）建成。平面为中央方亭四面出抱厦的十字曲尺形，三重檐：下层腰檐、中层四面抱厦歇山、上层十字脊歇山顶，中心鎏金宝顶；俗称“九梁十八柱七十二条脊”，共 28 个翼角。黄琉璃瓦、和玺彩画，汉白玉须弥座与栏杆，通高约 27.5 米。';

/** 角楼覆盖：在城台（墩台）顶面建角楼，主体对角线指向城外 */
function towerAt(sx, sz, name) {
  return (ctx, b, api) => {
    const k = corner(sx, sz);
    const r = buildCornerTower(ctx.at(k.cx, WALL_H, k.cz, k.rot));
    api.label(name, k.cx, WALL_H + r.top + 2, k.cz, TOWER_DESC);
  };
}

/** 城门覆盖 */
function gateAt(g, facing, name, desc, studs, extra) {
  return (ctx, b, api) => {
    const cx = (g.x0 + g.x1) / 2, cz = (g.z0 + g.z1) / 2;
    const r = buildSideGate(ctx, { cx, cz, w: g.z1 - g.z0, d: g.x1 - g.x0, h: GATE_H, facing, name, studs, towerOff: extra.towerOff || 0 });
    extra.after?.(ctx);
    api.label(name, cx, r.top + 2, cz, desc);
  };
}

/** 东华门内马道（OSM：城台南北各一组折返坡道，下段自地面升至 5m 平台，上段折回升至城台顶） */
function dhmRamps(ctx) {
  const top = GATE_H - 0.01, ztN = DHM.z0 + BT, ztS = DHM.z1 - BT;
  buildRamps(ctx, [
    { x0: 354.4, x1: 362.0, z0: 296.0, z1: 311.4, h0: 5, h1: 0, open: { W: true } },
    { x0: 362.0, x1: 370.0, z0: 296.0, z1: ztN + 0.6, h0: 5, h1: top, open: { W: true } },
    { x0: 354.4, x1: 370.0, z0: 289.2, z1: 296.0, h0: 5, h1: 5, open: { W: true, N: 'yu' } },
    { x0: 354.4, x1: 362.4, z0: 379.2, z1: 396.5, h0: 0, h1: 5, open: { W: true } },
    { x0: 362.4, x1: 370.0, z0: ztS - 0.6, z1: 396.5, h0: top, h1: 5, open: { W: true } },
    { x0: 354.4, x1: 370.0, z0: 396.5, z1: 403.1, h0: 5, h1: 5, open: { W: true, S: 'yu' } },
  ]);
  // 城台南北两面露明段宇墙（城台内沿至马道上口）
  const xi = DHM.x0 + BT + YU.t;
  flatYu(ctx, [[xi, ztN + YU.t / 2], [362.0, ztN + YU.t / 2]], GATE_H);
  flatYu(ctx, [[xi, ztS - YU.t / 2], [362.4, ztS - YU.t / 2]], GATE_H);
}

/** 西华门城台南北两面露明段宇墙 */
function xhmYu(ctx) {
  const ztN = XHM.z0 + BT, ztS = XHM.z1 - BT, xi = XHM.x1 - BT - YU.t, xw = OW.west + 7.64;
  flatYu(ctx, [[xi, ztN + YU.t / 2], [xw, ztN + YU.t / 2]], GATE_H);
  flatYu(ctx, [[xi, ztS - YU.t / 2], [xw, ztS - YU.t / 2]], GATE_H);
}

export default {
  key: 'walls',
  title: '外墙、角楼与四门',
  overrides: {
    156145604: towerAt(-1, -1, '西北角楼'),
    156145763: towerAt(-1, 1, '西南角楼'),
    156146468: towerAt(1, 1, '东南角楼'),
    156146621: towerAt(1, -1, '东北角楼'),
    40343947: gateAt(DHM, 'E', '东华门',
      '紫禁城东门，明永乐十八年（1420）建成。红色城台、汉白玉须弥座，辟三座券门（外方内圆）；城楼面阔五间、进深三间，四周出廊，黄琉璃瓦重檐庑殿顶。门钉横九竖八共七十二颗，与其余三门的九九八十一颗不同。城台内两侧有折返马道。',
      'gate_door_8', { after: dhmRamps }),
    40343948: gateAt(XHM, 'W', '西华门',
      '紫禁城西门，与东华门形制相同：红色城台辟三券门，城楼面阔五间、进深三间、周围廊，汉白玉栏杆，黄琉璃瓦重檐庑殿顶。清代帝后游幸西苑多出入此门。',
      'gate_door', { towerOff: 1.5, after: xhmYu }),
  },
  wallOverrides: {},
  bridgeOverrides: {},
  build(ctx, api) {
    // ---- 城墙：午门、神武门城台由中轴分区建造；东华门、西华门城台由本分区建造 ----
    buildOuterWall(ctx, [
      { side: 'S', from: -62.6, to: 61.6 }, // 午门墩台（axis_south）x∈[-63.3, 62.2]
      { side: 'N', from: -24.1, to: 27.1 }, // 神武门城台（axis_north）x∈[-24.4, 27.4]，收分 0.3
      { side: 'E', from: DHM.z0 + BT, to: DHM.z1 - BT },
      { side: 'W', from: XHM.z0 + BT, to: XHM.z1 - BT },
    ]);
    api.label('紫禁城城墙', OW.east - 4, WALL_H + 4, 120, '明永乐十八年（1420）建成，周长约 3.4 公里，高约 10 米，底宽 8.62 米、顶宽 6.66 米，城砖砌筑、外抹红灰。外侧垛口、内侧宇墙，顶面马道可行车马；四隅建角楼，四面辟午门、神武门、东华门、西华门。');
    // ---- 筒子河两岸与城外 ----
    buildMoatSurroundings(ctx, api.site);
    api.label('筒子河', -421, 3, -120, '紫禁城护城河，又称筒子河，明初开挖，宽 52 米、深约 6 米，长约 3.8 公里。两岸条石驳岸，外岸筑矮墙，岸上遍植垂柳，与角楼倒影构成故宫最著名的景致。');
    // ---- 城外远景：胡同、太庙与中山公园古柏 ----
    buildCityContext(ctx);
    // ---- 景山（远景） ----
    const js = buildJingshan(ctx);
    api.label('景山', 0, js.peak + 22, -885, '紫禁城北面的镇山，明永乐年间以开挖筒子河与南海之土堆成，旧称万岁山，清顺治年间改称景山。中峰高约 45 米，山上五亭以万春亭为中心，是北京老城中轴线的制高点。');
    for (const l of js.labels) api.label(l.name, ...l.pos, l.desc);
  },
};

