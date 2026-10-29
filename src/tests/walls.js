// 墙垣测试：L/U 形宫墙（门洞）、琉璃门、随墙门、垂花门、影壁、城墙转角（垛口/宇墙/马道）、三券城台
// catalog.html?t=walls&v=full：整圈紫禁城城墙 + 四门城台（规模与性能检查）
import { buildPalaceWall, buildCityWall, buildWallGate, buildScreenWall, buildGateTerrace } from '../core/walls.js';
import { OUTER_WALL as OW } from '../config.js';

function full(ctx) {
  const t = OW.baseThick / 2, tun = [{ x: -12, w: 4.6, h: 7 }, { x: 0, w: 5.4, h: 8.2 }, { x: 12, w: 4.6, h: 7 }];
  const pp = { S: 'duo', N: 'yu', E: 'yu', W: 'yu' };
  buildCityWall(ctx, {
    x0: OW.west, x1: OW.east, z0: OW.north, z1: OW.south, h: OW.height, baseThick: OW.baseThick, topThick: OW.topThick, cornerSkip: 10,
    gaps: [{ side: 'S', from: -55, to: 55 }, { side: 'N', from: -30, to: 30 }, { side: 'E', from: 290, to: 330 }, { side: 'W', from: 290, to: 330 }],
  });
  buildGateTerrace(ctx.at(0, 0, OW.south - t + 6), { w: 110, d: 34, h: 12, tunnels: tun, parapet: pp });
  buildGateTerrace(ctx.at(0, 0, OW.north + t, Math.PI), { w: 60, d: 24, h: 10.5, tunnels: tun, parapet: pp });
  buildGateTerrace(ctx.at(OW.east - t, 0, 310, Math.PI / 2), { w: 40, d: 22, h: 10.5, tunnels: tun, parapet: pp });
  buildGateTerrace(ctx.at(OW.west + t, 0, 310, -Math.PI / 2), { w: 40, d: 22, h: 10.5, tunnels: tun, parapet: pp });
  return { cam: [520, 420, 900], tgt: [0, 0, 0], shadowRadius: 600 };
}

export default function build(ctx) {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('v') === 'full') return full(ctx);
  const wt = 1.5;
  // A：L 形宫墙 + 琉璃门 + 琉璃影壁
  buildPalaceWall(ctx, { path: [[-95, -30], [-50, -30], [-50, 10]], h: 6.2, thick: wt, gaps: [{ from: 21.5, to: 28.5 }] });
  buildWallGate(ctx.at(-70, 0, -30), { type: 'liuli', w: 7, h: 8.6, wallThick: wt, wallH: 6.2 });
  buildScreenWall(ctx.at(-70, 0, -15, Math.PI), { style: 'liuli', w: 10, h: 5.4, thick: 1.1 });
  // B：U 形宫墙 + 随墙门 + 垂花门 + 砖影壁 + 红影壁
  buildPalaceWall(ctx, {
    path: [[-35, -30], [-35, 5], [5, 5], [5, -30]], h: 4.2, thick: 1.1,
    gaps: [{ from: 18 - 2.4, to: 18 + 2.4 }, { from: 55 - 1.8, to: 55 + 1.8 }],
  });
  buildWallGate(ctx.at(-35, 0, -12, Math.PI / 2), { type: 'suiqiang', w: 4.8, h: 6.4, wallThick: 1.2 });
  buildWallGate(ctx.at(-15, 0, 5), { type: 'chuihua', w: 3.6, h: 6.4 });
  buildScreenWall(ctx.at(-15, 0, 15, Math.PI), { style: 'brick', w: 6.5, h: 4.2, thick: 0.9 });
  buildScreenWall(ctx.at(-15, 0, -12), { style: 'red', w: 6, h: 4, thick: 0.9 });
  // 三座琉璃门（中高侧低，间以短墙）
  buildPalaceWall(ctx, { path: [[-100, 32], [-45, 32]], h: 5.6, thick: wt, gaps: [{ from: 27.5 - 9, to: 27.5 + 9 }] });
  buildWallGate(ctx.at(-72.5, 0, 32), { type: 'liuli', openings: 3, w: 18, h: 8.8, wallThick: wt, wallH: 5.6 });
  // 闭合绿瓦帽墙（缺口跨越起点）与无瓦帽斜墙
  buildPalaceWall(ctx, { path: [[15, -30], [28, -30], [28, -17], [15, -17]], closed: true, h: 3.6, thick: 0.9, cap: 'green', gaps: [{ from: 50, to: 54 }] });
  buildPalaceWall(ctx, { path: [[15, -8], [26, 2], [17, 8]], h: 3, thick: 0.7, cap: 'none', style: 'grey' });
  // 青砖墙（灰瓦帽）一段
  buildPalaceWall(ctx, { path: [[10, -30], [10, 10]], h: 4, thick: 0.8, style: 'grey' });
  // C：城墙（去掉西面，余下两个转角）+ 南面三券城台
  buildCityWall(ctx, { x0: 30, x1: 140, z0: -70, z1: 40, gaps: [{ side: 'S', from: 60, to: 100 }, { side: 'N', from: 71, to: 89 }, { side: 'W', from: -70, to: 40 }] });
  buildGateTerrace(ctx.at(80, 0, 40 - 4.31), {
    w: 40, d: 16, h: 12, style: 'red',
    tunnels: [{ x: -12, w: 4.2, h: 6.4 }, { x: 0, w: 5.2, h: 7.8 }, { x: 12, w: 4.2, h: 6.4 }],
    parapet: { S: 'duo', N: 'yu', E: 'yu', W: 'yu' },
  });
  buildGateTerrace(ctx.at(80, 0, -70 + 4.31), { w: 18, d: 13, h: 11, style: 'brick', tunnels: [{ x: 0, w: 4.5, h: 6.5 }], parapet: 'duo', doors: 'open' });
  return { cam: [10, 95, 150], tgt: [20, 0, -10], shadowRadius: 160 };
}
