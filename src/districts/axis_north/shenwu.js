// axis_north · 神武门（城台、门楼、马道）及顺贞门外北院
import { PI, buildHall, hangPlaque, eaveCeiling, slopeBlock, polyTopGeo, paveStrip, prismGeo, rectPoly } from './lib.js';
import { buildGateTerrace } from '../../core/walls.js';

export const WALL_H = 10; // 紫禁城城墙高（至马道面）

function shenwumen(ctx, b, api) {
  // 城台：南（内）面 z=-456.6，北面与城墙外皮齐；东西两侧接城墙与马道
  const cx = 1.5, z0 = -485.2, z1 = -456.6, cz = (z0 + z1) / 2, w = 51.8, d = z1 - z0, h = WALL_H;
  buildGateTerrace(ctx.at(cx, 0, cz, PI), {
    w, d, h, style: 'red', batter: 0.3,
    tunnels: [{ x: 0, w: 5.2, h: 8.0 }, { x: -12.6, w: 4.2, h: 6.6 }, { x: 12.6, w: 4.2, h: 6.6 }],
    parapet: { S: 'duo', N: 'yu', E: 'none', W: 'none' }, doors: 'open',
  });
  // 门楼：面阔五间、进深一间，四周围廊（合计七间三间），重檐庑殿，正面（匾）朝北
  const hc = ctx.at(1.75, h, -469.6, PI);
  const info = buildHall(hc, {
    grade: 2, bays: [3.2, 6.2, 6.2, 7.6, 6.2, 6.2, 3.2], depthBays: [3.2, 11.0, 3.2], corridorDepth: 3.2,
    dougong: { kou: 0.085, cai: 7 }, caihua: 'hexi', colH: 6.9, colDia: 0.72, lattice: 'sanjiao',
    platform: { h: 0.6, style: 'stone', stairs: [], margin: 1.6 },
    front: ['wall', 'window', 'door', 'door', 'door', 'window', 'wall'], back: ['wall', 'window', 'door', 'door', 'door', 'window', 'wall'],
    double: { inset: 3.2, upperH: 2.6 }, roof: { type: 'wudian', beasts: 7 },
  });
  hangPlaque(hc, info, '神武门', 0.66);
  eaveCeiling(hc, info);
  api.label('神武门', 1.5, h + info.topY + 2, -470, '紫禁城北门，明永乐十八年（1420）建，原名玄武门，清康熙时避讳改今名。城台开三券门，门楼面阔五间、进深一间，四周围廊，黄琉璃瓦重檐庑殿顶，通高约 31 米；明清时楼上设钟鼓报时，今为故宫博物院北门。');
  // 马道（城台东西两侧登城坡道，折返两跑，外侧宇墙）
  const ramp = (x0, x1, z0r, z1r, ha, hb) => slopeBlock(ctx, x0, x1, z0r, z1r, 'x', ha, hb, { sideMat: 'wall_red', topMat: 'brick_grey' });
  const para = (x0, x1, z0r, z1r, ha, hb) => slopeBlock(ctx, x0 - 0.03, x1 + 0.03, z0r - 0.03, z1r + 0.03, 'x', ha + 0.95, hb + 0.95, { sideMat: 'wall_red', topMat: 'brick_dark' });
  // 东侧
  ramp(33.0, 51.1, -468.0, -462.0, 0, 5);
  para(33.0, 51.1, -462.5, -462.0, 0, 5);
  ctx.add('wall_red', prismGeo(rectPoly(51.1, 58.4, -477.0, -462.0), 0, 5, { top: false })); // 平台
  ctx.add('brick_grey', polyTopGeo(rectPoly(51.1, 58.4, -477.0, -462.0), 5.0));
  para(51.1, 58.4, -462.5, -462.0, 5, 5); para(57.9, 58.4, -477.0, -462.0, 5, 5);
  ramp(27.0, 51.1, -477.0, -468.0, 10, 5);
  para(27.4, 51.1, -468.5, -468.0, 10, 5);
  // 西侧
  ramp(-50.2, -31.8, -467.4, -460.6, 5, 0);
  para(-50.2, -31.8, -461.1, -460.6, 5, 0);
  ctx.add('wall_red', prismGeo(rectPoly(-56.3, -50.2, -475.0, -460.5), 0, 5, { top: false }));
  ctx.add('brick_grey', polyTopGeo(rectPoly(-56.3, -50.2, -475.0, -460.5), 5.0));
  para(-56.3, -50.2, -461.0, -460.5, 5, 5); para(-56.3, -55.8, -475.0, -460.5, 5, 5);
  ramp(-50.2, -24.0, -475.2, -467.4, 5, 10);
  para(-50.2, -24.4, -467.9, -467.4, 5, 10);
  // 城台南侧御路
  paveStrip(ctx, [[0.25, -431.2], [1.5, -456.4]], 5.0, { y: 0, h: 0.05 });
}

function weiFang(x, z, rotY, eaveW, eaveD) {
  return (ctx) => buildHall(ctx.at(x, 0, z, rotY), { eaveW, eaveD, grade: 5, nDepth: 1, colH: 3.0, dougong: false, roof: { type: 'yingshan', gableWallMat: 'wall_red' }, platform: { h: 0.4, style: 'plain', stairs: [] } });
}

export const overrides = {
  638741722: shenwumen,
  // 城外围房（OSM 轮廓略斜，按单栋长房重建）
  42740569: weiFang(-71.1, -495.2, 0.0196, 71.4, 4.0),
  42740572: weiFang(71.6, -497.6, 0.019, 73.6, 5.4),
};

export function buildShenwu() {}
void PI;
