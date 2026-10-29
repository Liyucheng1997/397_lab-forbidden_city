// 东华门 / 西华门：红色城台（汉白玉须弥座，三券门“外方内圆”）+ 城楼（面阔五间、进深三间、周围廊，黄琉璃瓦重檐庑殿）
// 东华门内两侧另有马道（折返坡道）通城台顶。
import * as THREE from 'three';
import { buildGateTerrace } from '../../core/walls.js';
import { buildHall } from '../../core/building.js';
import { buildBay } from '../../core/openings.js';
import { Acc, yuRun, WALL_MAT, KB, YU } from './common.js';

/** 券门洞内板门（门钉材质可选：gate_door 九路 / gate_door_8 八路）。局部：门洞中线 x=0，门扇立面 z=0；leafTop 门扇上皮 */
function archDoor(ctx, tw, sp, mat, leafTop = sp - 0.02) {
  const half = [];
  for (let i = 0; i <= 16; i++) { const a = (Math.PI * i) / 16; half.push([(tw / 2) * Math.cos(a), sp + (tw / 2) * Math.sin(a)]); }
  const acc = new Acc();
  for (const z of [0.08, -0.08]) acc.poly('board_red', half.map(([x, y]) => [x, y, z]), half, [0, 0, Math.sign(z)]);
  acc.flush(ctx);
  // 券心板下缘至门扇上皮：走马板
  const yb = Math.min(leafTop + 0.24, sp);
  if (sp > yb + 0.01) { const fill = new THREE.BoxGeometry(tw, sp - yb, 0.16); fill.translate(0, (sp + yb) / 2, 0); ctx.add('board_red', fill); }
  const lint = new THREE.BoxGeometry(tw, 0.24, 0.28); lint.translate(0, leafTop + 0.12, 0);
  ctx.add('wood_red', lint);
  const lw = tw / 2 - 0.015, lh = leafTop - 0.01;
  const leaf = new THREE.BoxGeometry(lw, lh, 0.12);
  leaf.translate(lw / 2, lh / 2 + 0.01, 0);
  for (const s of [-1, 1]) ctx.at(s * tw / 2, 0, 0, 0, [s > 0 ? -1 : 1, 1, 1]).add(mat, leaf);
}

/**
 * “外方内圆”：在券洞两端的券脸内侧补一段平顶过梁墙（自 yr 至券顶），使立面门洞呈方形、洞内为圆券。
 * t: {x, w, h(券顶)}，d/h/bt 同城台（深、高、每侧收分）
 */
function squareFace(acc, t, d, h, bt, yr, depth = 1.6) {
  const zf = (y) => d / 2 - (bt * y) / h;
  const x0 = t.x - t.w / 2, x1 = t.x + t.w / 2, yc = t.h + 0.05;
  for (const sg of [1, -1]) {
    const za = sg * (zf(yr) - 0.012), zc = sg * (zf(yc) - 0.012), zb = sg * (zf(yr) - depth);
    acc.quad(WALL_MAT, [[x0, yr, za], [x1, yr, za], [x1, yc, zc], [x0, yc, zc]], [[x0, yr], [x1, yr], [x1, yc], [x0, yc]], [0, 0, sg]);
    acc.quad('stone_grey', [[x0, yr, za], [x1, yr, za], [x1, yr, zb], [x0, yr, zb]], [[x0, za], [x1, za], [x1, zb], [x0, zb]], [0, -1, 0]);
    acc.quad(WALL_MAT, [[x0, yr, zb], [x1, yr, zb], [x1, yc, zb], [x0, yc, zb]], [[x0, yr], [x1, yr], [x1, yc], [x0, yc]], [0, 0, -sg]);
    // 方门洞上皮石过梁（立面略凸的一条青白石）
    acc.quad('stone_grey', [[x0 - 0.25, yr, za + sg * 0.03], [x1 + 0.25, yr, za + sg * 0.03], [x1 + 0.25, yr + 0.35, za + sg * 0.03 - sg * bt * 0.35 / h], [x0 - 0.25, yr + 0.35, za + sg * 0.03 - sg * bt * 0.35 / h]], [[0, 0], [t.w + 0.5, 0], [t.w + 0.5, 0.35], [0, 0.35]], [0, 0, sg]);
  }
}

/**
 * 城门：opts
 *   cx, cz：城台中心（世界）；w：城台沿城墙方向长；d：城台进深（垂直城墙）；h：城台高
 *   facing：'E' | 'W'（门朝城外方向）；towerOff：城楼中心相对城台中心向外偏移
 *   studs：'gate_door_8'（东华门八路门钉）| 'gate_door'
 *   name, desc：匾额与说明
 * 返回 { top, rotY, local(x,z)->world }
 */
export function buildSideGate(ctx, o) {
  const rotY = o.facing === 'E' ? Math.PI / 2 : -Math.PI / 2;
  const tc = ctx.at(o.cx, 0, o.cz, rotY);
  const h = o.h, bt = KB * h;
  const tunnels = [{ x: -11.4, w: 4.3, h: 6.4 }, { x: 0, w: 5.3, h: 7.6 }, { x: 11.4, w: 4.3, h: 6.4 }];
  buildGateTerrace(tc, { w: o.w, d: o.d, h, style: 'red', batter: bt, baseH: 1.2, tunnels, parapet: { S: 'duo', N: 'yu', E: 'none', W: 'none' }, doors: false });
  const acc = new Acc();
  for (const t of tunnels) {
    const sp = t.h - t.w / 2;
    const yr = sp + (t.w > 4.5 ? 1.55 : 1.2);
    squareFace(acc, t, o.d, h, bt, yr);
    // 门扇设于方门洞之后的券洞内，扇高与方门洞齐
    archDoor(tc.at(t.x, 0, o.d / 2 - 2.4), t.w, sp, o.studs || 'gate_door', yr - 0.3);
  }
  acc.flush(tc);

  // ---- 城楼：面阔七间（五间 + 周围廊）、进深五间（三间 + 周围廊），重檐庑殿 ----
  const corr = 2.4;
  const bays = [corr, 6.9, 7.3, 8.0, 7.3, 6.9, corr], depthBays = [corr, 4.0, 4.4, 4.0, corr];
  const colW = bays.reduce((a, b) => a + b, 0), colD = depthBays.reduce((a, b) => a + b, 0);
  const pm = 1.2, ph = 0.6, pw = colW + 2 * pm, pd = colD + 2 * pm;
  const hc = tc.at(0, h, o.towerOff || 0);
  const info = buildHall(hc, {
    kind: 'hall', grade: 1, eaveW: 45.7, eaveD: 21.4, bays, depthBays, corridorDepth: corr,
    colH: 4.3, colDia: 0.62, dougong: { kou: 0.08, cai: 7, lowerCai: 5 }, caihua: 'hexi',
    platform: {
      h: ph, style: 'xumizuo', margin: pm, railing: 'marble',
      railingGaps: [{ at: [0, pd / 2 - 0.3], w: 8.6 }, { at: [0, -pd / 2 + 0.3], w: 8.6 }],
      stairs: [{ side: 'S', w: 7.0 }, { side: 'N', w: 7.0 }],
    },
    roof: { type: 'wudian', tile: 'yellow', w: 42.8, d: 18.8, rise: 5.6, beasts: 7 },
    double: { inset: corr, upperH: 2.5 },
    front: ['open', 'window', 'door', 'door', 'door', 'window', 'open'],
    back: ['open', 'window', 'door', 'door', 'door', 'window', 'open'],
    left: 'open', right: 'open',
    lattice: 'sanjiao',
    plaque: o.name, plaqueCharH: 0.55,
  });
  // 周围廊：两山墙退至金柱缝
  const xs = info.colsX, zs = info.colsZ, yDoor = info.platformTop + 4.3 - 0.59 * 2.1;
  for (const [x, rot] of [[xs[1], -Math.PI / 2], [xs[xs.length - 2], Math.PI / 2]]) {
    for (let j = 1; j < zs.length - 2; j++) {
      buildBay(hc.at(x, info.platformTop, (zs[j] + zs[j + 1]) / 2, rot), { w: zs[j + 1] - zs[j] - 0.56, h: yDoor - info.platformTop, type: 'wall' });
    }
  }
  return { top: h + (info.topY || 27), tc };
}

/**
 * 马道（折返坡道）：flights=[{x0,x1,z0,z1, h0（z0 端高）, h1（z1 端高）, open:{W,E,N,S}（需加宇墙/立面的边）}]
 * 坡面城砖（wl_madao），侧立面红灰墙身、下碱青石。世界坐标。
 */
export function buildRamps(ctx, flights) {
  const acc = new Acc();
  for (const f of flights) {
    const { x0, x1, z0, z1, h0, h1 } = f;
    const hz = (z) => h0 + ((h1 - h0) * (z - z0)) / (z1 - z0);
    const slope = Math.hypot(z1 - z0, h1 - h0);
    // 坡面
    acc.quad('wl_madao', [[x0, h0, z0], [x1, h0, z0], [x1, h1, z1], [x0, h1, z1]], [[x0, 0], [x1, 0], [x1, slope], [x0, slope]], [0, 1, 0]);
    const op = f.open || {};
    // 东西侧立面（梯形）
    for (const [x, sg, key] of [[x0, -1, 'W'], [x1, 1, 'E']]) {
      if (!op[key]) continue;
      const P = [[x, 0, z0], [x, 0, z1], [x, h1, z1], [x, h0, z0]].filter((p, i) => !(i === 3 && h0 <= 0.01) && !(i === 2 && h1 <= 0.01));
      acc.poly(WALL_MAT, P, P.map((p) => [p[2], p[1]]), [sg, 0, 0]);
      const sb = 0.6;
      acc.quad('stone_grey', [[x + sg * 0.03, 0, z0], [x + sg * 0.03, 0, z1], [x + sg * 0.03, Math.min(sb, hz(z1)), z1], [x + sg * 0.03, Math.min(sb, hz(z0)), z0]], [[z0, 0], [z1, 0], [z1, sb], [z0, sb]], [sg, 0, 0]);
      yuRun(acc, [[x - sg * YU.t / 2, z0, h0], [x - sg * YU.t / 2, z1, h1]]);
    }
    // 南北端立面
    for (const [z, hh, sg, key] of [[z0, h0, -1, 'N'], [z1, h1, 1, 'S']]) {
      if (!op[key] || hh <= 0.01) continue;
      acc.quad(WALL_MAT, [[x0, 0, z], [x1, 0, z], [x1, hh, z], [x0, hh, z]], [[x0, 0], [x1, 0], [x1, hh], [x0, hh]], [0, 0, sg]);
      if (op[key] === 'yu') yuRun(acc, [[x0, z - sg * YU.t / 2, hh], [x1, z - sg * YU.t / 2, hh]]);
    }
  }
  acc.flush(ctx);
}

/** 平直宇墙（世界坐标折线，底高 y） */
export function flatYu(ctx, path, y) {
  const acc = new Acc();
  yuRun(acc, path, { y });
  acc.flush(ctx);
}

