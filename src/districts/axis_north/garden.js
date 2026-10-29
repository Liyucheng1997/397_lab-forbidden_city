// axis_north · 御花园（钦安殿、东西两路亭台楼阁、堆秀山、古柏、石子甬路）与顺贞门
import { rhall, pedestal, rail, wgate, paveStrip, rectPoly, PI, ROT, buildHall, buildPlatform, buildStairs, boxGeo, cylGeo, prismGeo, polyPavilion, squarePavilion } from './lib.js';
import { buildRockery, buildLawn } from '../../core/nature.js';

const lbl = (api, name, x, y, z, desc) => api.label(name, x, y, z, desc);

// ---------------- 钦安殿 ----------------
function qinandian(ctx, b, api) {
  const ph = 1.3, cx = 0.75;
  buildPlatform(ctx, {
    poly: rectPoly(-11.0, 12.5, -410.4, -389.8), h: ph, style: 'xumizuo', railing: { style: 'marble_dragon' },
    stairs: [{ at: [cx, -380], w: 2.4, railings: true, yulu: { w: 1.0 } }, { at: [20, -393.2], w: 2.4, railings: true }, { at: [-20, -393.2], w: 2.4, railings: true }],
  });
  // 面阔五间、进深三间，周围廊；重檐盝顶
  const info = rhall(ctx, [-11.1, 12.6, -410.6, -397.0], 'S', {
    grade: 2, bays: [2.2, 4.9, 5.8, 4.9, 2.2], depthBays: [2.2, 5.4, 2.2], corridorDepth: 2.2,
    dougong: { kou: 0.07, cai: 5 }, caihua: 'hexi', colH: 4.6, platform: false, lattice: 'sanjiao',
    double: { inset: 2.2, upperH: 1.9 }, roof: { type: 'luding', inner: { w: 12.6, d: 3.0 }, rise: 2.2, beasts: 7 },
    plaque: '钦安殿', plaqueCharH: 0.4,
  }, ph);
  ctx.place('baoding:gold', cx, ph + info.roof.ridgeY - 0.05, -403.8, 0, 1.9);
  ctx.place('censer:tower', cx - 6.5, ph, -392.2, 0, 2.6);
  ctx.place('censer:tower', cx + 6.5, ph, -392.2, 0, 2.6);
  lbl(api, '钦安殿', cx, info.top + 2.5, -403.8, '御花园中心建筑，明永乐年间建、嘉靖十四年重修，供奉玄天上帝（真武大帝）。面阔五间、进深三间，黄琉璃瓦重檐盝顶，顶中置鎏金宝瓶；坐落于汉白玉须弥座上，四周环以穿花龙纹石栏，院墙南开天一门。');
}
function smallShrine(rect, face) {
  return (ctx) => rhall(ctx, rect, face, {
    grade: 5, nBays: 1, nDepth: 1, colH: 3.0, dougong: false, front: 'door', back: 'wall', sides: 'wall',
    platform: { h: 0.4, style: 'stone', stairs: [{ side: 'S', w: 1.4 }] }, roof: { type: 'cuanjian', sides: 4, rise: 2.2, baoding: 'gold', beasts: 1 },
  });
}

// ---------------- 水亭（浮碧亭 / 澄瑞亭）：跨池方亭 + 南出卷棚抱厦 ----------------
function waterPavilion([x0, x1, z0, z1], name, desc) {
  return (ctx, b, api) => {
    const cx = (x0 + x1) / 2, w = x1 - x0, deck = 0.6;
    buildPlatform(ctx, { poly: rectPoly(x0 + 0.15, x1 - 0.15, z0 + 0.15, z1 - 0.15), y0: -2.3, h: 2.3 + deck, style: 'stone' });
    buildStairs(ctx.at(cx, 0, z1 - 0.15, 0), { w: 2.4, h: deck, run: 1.4, style: 'stone' });
    buildStairs(ctx.at(cx, 0, z0 + 0.15, PI), { w: 2.0, h: deck, run: 1.4, style: 'stone' });
    const zm = z0 + w; // 方亭南沿
    const info = rhall(ctx, [x0, x1, z0, zm], 'S', {
      kind: 'pavilion', grade: 4, nBays: 3, nDepth: 3, colH: 3.5, dougong: { kou: 0.045, cai: 3 }, caihua: 'xuanzi', platform: false,
      roof: { type: 'cuanjian', sides: 4, rise: w * 0.44, baoding: 'gold', beasts: 3 },
    }, deck);
    rhall(ctx, [x0 + 1.0, x1 - 1.0, zm - 0.7, z1], 'S', {
      kind: 'pavilion', grade: 4, nBays: 3, nDepth: 2, colH: 3.0, dougong: false, caihua: 'sushi', platform: false,
      roof: { type: 'xieshan', juan: true, beasts: 1 },
    }, deck);
    lbl(api, name, cx, info.top + 1.5, (z0 + z1) / 2, desc);
  };
}

// ---------------- 万春亭 / 千秋亭：十字形四出抱厦，上圆下方重檐 ----------------
function crossPavilion(cx, cz, name, desc) {
  return (ctx, b, api) => {
    const c = ctx.at(cx, 0, cz);
    const ph = 1.4;
    const q = [[6.3, -3.6], [6.3, 3.6], [5.0, 3.6], [5.0, 5.0], [3.6, 5.0], [3.6, 6.3]];
    const poly = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * PI) / 2, ca = Math.cos(a), sa = Math.sin(a);
      for (const [x, z] of q) poly.push([x * ca - z * sa, x * sa + z * ca]);
    }
    buildPlatform(c, {
      poly, h: ph, style: 'xumizuo', railing: { style: 'marble' },
      stairs: [[0, 9], [0, -9], [9, 0], [-9, 0]].map((at) => ({ at, w: 1.9, railings: true, run: 2.6 })),
    });
    const r = buildHall(c.at(0, ph, 0), {
      kind: 'pavilion', bays: [1.4, 5.2, 1.4], depthBays: [1.4, 5.2, 1.4], colH: 3.7, colDia: 0.34, grade: 3,
      dougong: { kou: 0.05, cai: 3 }, caihua: 'hexi', platform: false, bench: false,
      double: { inset: 1.4, upperH: 1.5 }, roof: { type: 'cuanjian', sides: 0, r: 4.2, rise: 3.6, baoding: 'tiered', beasts: 3 },
    });
    for (const [d, dx, dz] of [['S', 0, 1], ['N', 0, -1], ['E', 1, 0], ['W', -1, 0]]) {
      buildHall(c.at(dx * 5.05, ph, dz * 5.05, ROT[d]), {
        kind: 'pavilion', eaveW: 6.6, eaveD: 3.4, nBays: 1, nDepth: 1, colH: 3.0, colDia: 0.3, grade: 4, dougong: false, caihua: 'xuanzi',
        platform: false, bench: false, overhang: 0.62, roof: { type: 'xieshan', beasts: 3 },
      });
    }
    lbl(api, name, cx, ph + r.topY + 1.5, cz, desc);
  };
}

// ---------------- 井亭（盝顶，顶开井口） ----------------
function wellPavilion([x0, x1, z0, z1]) {
  return (ctx) => {
    const sx = x1 - x0, sz = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    rhall(ctx, [x0, x1, z0, z1], 'S', {
      kind: 'pavilion', grade: 5, nBays: 1, nDepth: 1, colH: 2.8, dougong: false, bench: false, caihua: 'xuanzi',
      platform: { h: 0.35, style: 'stone', stairs: [] }, roof: { type: 'luding', inner: { w: sx * 0.38, d: sz * 0.38 }, rise: 0.9, beasts: 1 },
    });
    const g = cylGeo(0.55, 0.6, 0.55, 12); g.translate(cx, 0.35 + 0.27, cz);
    ctx.add('marble', g);
  };
}

// ---------------- 东西路斋轩楼阁 ----------------
const GH = { grade: 4, dougong: false, caihua: 'sushi' };
function jiangxuexuan(ctx, b, api) {
  const info = rhall(ctx, [57.1, 67.1, -368.0, -344.3], 'W', {
    ...GH, nBays: 5, nDepth: 3, colH: 3.9, platform: { h: 0.6, style: 'plain', stairs: [] }, lattice: 'bubujin',
    roof: { type: 'yingshan', ridgeColor: 'green', gableWallMat: 'wall_red', beasts: 3 },
  });
  rhall(ctx, [53.7, 57.7, -363.4, -348.8], 'W', {
    ...GH, nBays: 3, nDepth: 1, colH: 3.4, front: 'door', back: 'open', sides: 'window', lattice: 'bubujin',
    platform: { h: 0.6, style: 'plain', stairs: [{ side: 'S', w: 2.4 }] }, roof: { type: 'xieshan', juan: true, ridgeColor: 'green', beasts: 3 },
    plaque: '绛雪轩', plaqueCharH: 0.3,
  });
  lbl(api, '绛雪轩', 61, info.top + 2, -356.2, '御花园东路南端，面阔五间，前出抱厦三间，平面呈“凸”字形，黄琉璃瓦绿剪边；轩前原植海棠，花落如绛雪，故名。');
}
function yangxingzhai(ctx, b, api) {
  const T = { ...GH, dougong: false, lattice: 'bubujin', platform: { h: 0.5, style: 'plain', stairs: [] } };
  const st = [{ colH: 3.5 }, { colH: 3.0, balcony: false }];
  const info = rhall(ctx, [-67.1, -61.5, -366.9, -341.9], 'E', { ...T, nBays: 7, nDepth: 1, stories: st, roof: { type: 'xieshan', juan: true, beasts: 3 }, platform: { h: 0.5, style: 'plain', stairs: [{ side: 'S', w: 2.4 }] } });
  rhall(ctx, [-61.9, -55.8, -366.9, -360.4], 'S', { ...T, nBays: 1, nDepth: 1, stories: st, roof: { type: 'xieshan', juan: true, beasts: 3 } });
  rhall(ctx, [-61.9, -55.6, -348.5, -341.9], 'N', { ...T, nBays: 1, nDepth: 1, stories: st, roof: { type: 'xieshan', juan: true, beasts: 3 } });
  lbl(api, '养性斋', -61, info.top + 2, -354.4, '御花园西南隅的两层楼，平面呈凹字形、开口向东，卷棚歇山顶；清末溥仪的英文教师庄士敦曾在此居住。');
}

// ---------------- 堆秀山、甬路、池栏、花坛与古树 ----------------
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pip(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
const polyDist = (x, z, P, closed = true) => {
  let d = Infinity;
  for (let i = 0; i < P.length - (closed ? 0 : 1); i++) d = Math.min(d, segDist(x, z, P[i], P[(i + 1) % P.length]));
  return d;
};
const inRect = (x, z, [x0, x1, z0, z1], m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;

export function buildGarden(ctx, api) {
  const site = api.site;
  const G = site.green.find((g) => g.id === 30802178)?.poly;
  const BB = [-67.5, 69.5, -428, -336];
  // ---- 堆秀山 + 御景亭 ----
  const dx = site.green.find((g) => g.id === 42424158).poly;
  const bc = dx.reduce((s, p) => [s[0] + p[0] / dx.length, s[1] + p[1] / dx.length], [0, 0]);
  const rk = buildRockery(ctx.at(bc[0], 0, bc[1]), {
    poly: dx.map(([x, z]) => [x - bc[0], z - bc[1]]), h: 10.5, seed: 11, style: 'taihu', steps: 2, stepW: 1.2,
    topW: 9.2, topD: 8.8, topX: 30.0 - bc[0], topZ: -422.0 - bc[1], cave: true,
  });
  const yjTop = rk.top;
  const yj = squarePavilion(ctx.at(30.0, yjTop, -422.0, 0), { w: 7.0, colH: 3.0, ph: 0.35, tile: 'yellow', ridgeColor: 'green', rise: 3.0, beasts: 3, stairs: [] });
  lbl(api, '堆秀山', bc[0], yjTop * 0.6, bc[1] + 6, '明万历十一年（1583）以太湖石依北宫墙叠成，高约 14 米，内有石洞、东西磴道盘旋而上；山前有石雕蟠龙喷泉，重阳节帝后在此登高。');
  lbl(api, '御景亭', 30.0, yjTop + yj.topY + 1.5, -422.0, '堆秀山顶方亭，四柱攒尖顶，为重阳登高远眺之所。');
  (rk.spots || []).slice(0, 6).forEach(([x, y, z], i) => ctx.place(`tree:pine:${i % 4}`, bc[0] + x, y, bc[1] + z, i * 1.7, 3.5 + (i % 3)));
  // ---- 石子甬路 ----
  for (const p of site.paths) {
    if (p.tags.surface !== 'cobblestone' && !(p.tags.highway === 'footway' && p.pts.every(([x, z]) => z < -345 && z > -427))) continue;
    if (!p.pts.every(([x, z]) => x > BB[0] && x < BB[1] && z > BB[2] && z < BB[3])) continue;
    paveStrip(ctx, p.pts, 1.6, { mat: 'paving_imperial', y: 0, h: 0.05 });
  }
  paveStrip(ctx, [[0.0, -340.6], [0.0, -373.9]], 3.2, { y: 0, h: 0.05 });
  // ---- 池岸石栏 ----
  for (const [id, gx] of [[42353096, 54.0], [42353097, -52.7]]) {
    const W = site.water.find((w) => w.id === id).poly;
    const xs = W.map((p) => p[0]), zs = W.map((p) => p[1]);
    const x0 = Math.min(...xs) - 0.35, x1 = Math.max(...xs) + 0.35, z0 = Math.min(...zs) - 0.35, z1 = Math.max(...zs) + 0.35;
    rail(ctx, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], 0, { closed: true, style: 'marble', height: 1.0, gaps: [{ at: [gx, z0], w: 9.6, end: 'post' }, { at: [gx, z1], w: 9.6, end: 'post' }] });
  }
  // ---- 花坛（OSM wood）与西路土石坡 ----
  const beds = site.green.filter((g) => g.tags.natural === 'wood' && g.poly.every(([x, z]) => x > BB[0] && x < BB[1] && z > BB[2] && z < BB[3]));
  for (const g of beds) buildLawn(ctx, { poly: g.poly, kind: 'grass', curb: 0.18, y: 0.04, shrubs: 0.03, seed: g.id % 97 });
  const fell = site.green.find((g) => g.id === 42424143).poly;
  buildLawn(ctx, { poly: fell, kind: 'grass', curb: 0.12, y: 0.05, shrubs: 0.05, seed: 7 });
  // ---- 古树：古柏为主、间以油松，另少量槐、银杏 ----
  const R = rngOf(20240531);
  const trees = [];
  const blds = site.buildings.filter((b) => b.c[0] > BB[0] && b.c[0] < BB[1] && b.c[1] > BB[2] && b.c[1] < BB[3]);
  const garPaths = site.paths.filter((p) => p.pts.every(([x, z]) => x > BB[0] && x < BB[1] && z > BB[2] && z < BB[3]));
  const ponds = [42353096, 42353097].map((id) => site.water.find((w) => w.id === id).poly);
  const free = (x, z, inBed) => {
    if (!G || !pip(x, z, G) || polyDist(x, z, G) < 2.6) return false;
    if (inRect(x, z, [-21.5, 21.5, -410.5, -375.2], 0.8)) return false; // 钦安殿院
    if (inRect(x, z, [-16, 16, -428, -417], 0)) return false; // 承光门 — 顺贞门间
    if (pip(x, z, dx) || polyDist(x, z, dx) < 1.5) return false;
    for (const P of ponds) if (pip(x, z, P) || polyDist(x, z, P) < 1.8) return false;
    for (const b of blds) if (pip(x, z, b.poly) || polyDist(x, z, b.poly) < 2.4) return false;
    if (!inBed) for (const p of garPaths) if (polyDist(x, z, p.pts, false) < 1.9) return false;
    if (Math.abs(x) < 3.2 && z > -376) return false; // 中轴甬路
    for (const t of trees) if (Math.hypot(t[0] - x, t[1] - z) < (inBed ? 3.1 : 3.9)) return false;
    return true;
  };
  for (const g of [...beds, { poly: fell }]) {
    const xs = g.poly.map((p) => p[0]), zs = g.poly.map((p) => p[1]);
    for (let x = Math.min(...xs) + 1.5; x < Math.max(...xs) - 1.0; x += 3.2) for (let z = Math.min(...zs) + 1.5; z < Math.max(...zs) - 1.0; z += 3.2) {
      const px = x + (R() - 0.5) * 1.2, pz = z + (R() - 0.5) * 1.2;
      if (pip(px, pz, g.poly) && polyDist(px, pz, g.poly) > 1.0 && free(px, pz, true)) trees.push([px, pz]);
    }
  }
  const nBed = trees.length;
  for (let x = BB[0] + 3; x < BB[1] - 2; x += 4.0) for (let z = BB[2] + 3; z < BB[3] - 2; z += 4.0) {
    const px = x + (R() - 0.5) * 2.6, pz = z + (R() - 0.5) * 2.6;
    if (R() < 0.9 && free(px, pz, false)) trees.push([px, pz]);
  }
  trees.forEach(([x, z], i) => {
    const r = R();
    const kind = r < 0.52 ? 'cypress' : r < 0.92 ? 'pine' : r < 0.97 ? 'locust' : 'ginkgo';
    const h = kind === 'cypress' ? 9 + R() * 5 : kind === 'pine' ? 8 + R() * 4 : 12 + R() * 4;
    ctx.place(`tree:${kind}:${(R() * 4) | 0}`, x, 0.04, z, R() * PI * 2, h);
  });
  if (typeof window !== 'undefined' && window.__anDebug) console.log('[axis_north] garden trees', trees.length, 'bed', nBed);
  // 连理柏（天一门前）
  ctx.place('tree:cypress:1', -2.4, 0, -371.0, 0.4, 11.5);
  ctx.place('tree:cypress:3', 2.5, 0, -370.8, 2.6, 10.8);
  lbl(api, '连理柏', 0.0, 13, -372.3, '天一门前两株古柏，树干相依、枝杈相连，为御花园名树。');
  lbl(api, '御花园', 0, 22, -362, `明永乐十八年（1420）建，原名宫后苑，南北约 90 米、东西约 130 米。以钦安殿为中心，东西两路亭台楼阁对称布置，园内古柏古松参天（本模型约 ${trees.length + 8} 株）。`);
  // ---- 峰石（须弥座上的太湖石 / 木化石） ----
  for (const [x, z, k, h] of [[50.6, -356.2, 'qing:2', 2.4], [47.5, -350.0, 'taihu:1', 2.8], [-50.5, -354.0, 'taihu:3', 3.0], [-47.6, -348.0, 'taihu:0', 2.2], [-39.5, -391.0, 'taihu:2', 2.6], [40.2, -392.0, 'taihu:1', 2.6]]) {
    pedestal(ctx, x, 0, z, 1.6, 1.2, 0.55, x * 0.37);
    ctx.place(`rock:${k}`, x, 0.55, z, x * 0.37, h);
  }
  void nBed;
  // ---- 顺贞门（内廷北门，琉璃门三座） ----
  wgate(ctx, 0.25, -429.15, 'N', { openings: 3, w: 20.1, h: 11.0, wallThick: 3.0, wallH: 8, roof: 'xieshan' });
  lbl(api, '顺贞门', 0.25, 13, -429.2, '内廷北门，明称坤宁门、清改顺贞门；随墙琉璃门三座，北对神武门。');
}

export const overrides = {
  40795244: qinandian,
  685600272: 'skip', // 钦安殿月台（并入钦安殿台基）
  685600291: (ctx, b, api) => { wgate(ctx, 0.1, -375.8, 'S', { w: 6.4, h: 7.0, wallThick: 0.9, doorW: 2.4, doorH: 3.5, wallH: 5, roof: 'xieshan' }); lbl(api, '天一门', 0.1, 8.5, -375.8, '钦安殿院南门，取“天一生水”之义以镇火；门前有古柏连理。'); },
  42424140: smallShrine([-19.8, -15.2, -386.5, -381.8], 'E'),
  42424151: smallShrine([14.6, 19.2, -386.7, -382.0], 'W'),
  42393615: (ctx, b, api) => { wgate(ctx, 0.5, -418.5, 'S', { w: 9.9, h: 7.0, wallThick: 0.9, doorW: 3.0, doorH: 3.6, wallH: 4.2, roof: 'xieshan' }); lbl(api, '承光门', 0.5, 8.5, -418.5, '御花园北门，北对顺贞门，两侧为集福门、延和门。'); },
  42393617: (ctx) => wgate(ctx, -14.6, -423.9, 'W', { w: 5.9, h: 6.0, wallThick: 0.9, doorW: 2.2, doorH: 3.0, wallH: 4.2 }),
  42393622: (ctx) => wgate(ctx, 15.0, -424.2, 'E', { w: 6.0, h: 6.0, wallThick: 0.9, doorW: 2.2, doorH: 3.0, wallH: 4.2 }),
  40795237: (ctx, b, api) => { const i = rhall(ctx, [-61.3, -43.8, -427.1, -418.2], 'S', { ...GH, nBays: 5, nDepth: 3, corridor: 1.4, colH: 3.6, lattice: 'bubujin', platform: { h: 0.5, style: 'plain', stairs: [{ side: 'S', w: 2.4 }] }, roof: { type: 'yingshan', juan: true, gableWallMat: 'wall_red', beasts: -1 } }); lbl(api, '位育斋', -52.5, i.top + 2, -422.6, '御花园西北，面阔五间，卷棚硬山顶，前出廊。'); },
  40795238: (ctx, b, api) => { const i = rhall(ctx, [-37.0, -19.6, -427.2, -419.0], 'S', { ...GH, nBays: 3, nDepth: 2, lattice: 'bubujin', platform: { h: 0.5, style: 'plain', stairs: [{ side: 'S', w: 2.4 }] }, stories: [{ colH: 3.8 }, { colH: 3.2, balcony: true }], roof: { type: 'xieshan', juan: true, beasts: 3 } }); lbl(api, '延晖阁', -28.3, i.top + 2, -423.1, '御花园西北的两层楼阁，面阔三间，卷棚歇山顶；清代选秀女多在此进行。'); },
  40795239: (ctx, b, api) => { const i = rhall(ctx, [44.1, 62.2, -425.9, -419.6], 'S', { ...GH, nBays: 5, nDepth: 2, colH: 3.7, lattice: 'bubujin', platform: { h: 0.5, style: 'plain', stairs: [{ side: 'S', w: 2.4 }] }, roof: { type: 'yingshan', gableWallMat: 'wall_red', beasts: 3 }, plaque: '摛藻堂', plaqueCharH: 0.28 }); lbl(api, '摛藻堂', 53.2, i.top + 2, -422.8, '依北宫墙而建，面阔五间，硬山顶；乾隆时贮藏《四库全书荟要》。'); },
  42424162: (ctx) => squarePavilion(ctx.at(-64.1, 0, -421.1, 0), { w: 4.2, colH: 2.7, ph: 0.45, tile: 'green', ridgeColor: 'yellow', rise: 2.0, beasts: 1 }),
  42424137: (ctx) => squarePavilion(ctx.at(64.5, 0, -422.85, 0), { w: 4.0, colH: 2.7, ph: 0.45, tile: 'green', ridgeColor: 'yellow', rise: 2.0, beasts: 1 }),
  42424174: 'skip', // 御景亭（建于堆秀山顶，见 buildGarden）
  40795241: waterPavilion([49.4, 58.7, -418.3, -401.7], '浮碧亭', '明万历十一年建，方亭跨于长方形水池之上，亭下为单孔石桥，南出卷棚抱厦；与西路澄瑞亭相对。'),
  40795243: waterPavilion([-57.1, -48.4, -416.8, -401.3], '澄瑞亭', '明万历十一年建，方亭跨于水池之上，南出卷棚抱厦；与东路浮碧亭相对。'),
  685673149: crossPavilion(53.15, -383.2, '万春亭', '明嘉靖十五年（1536）建，平面十字形，四面出抱厦，上圆下方重檐，寓“天圆地方”；与西路千秋亭对称。'),
  685673150: crossPavilion(-53.85, -381.9, '千秋亭', '明嘉靖十五年建，平面十字形，四面出抱厦，上圆下方重檐攒尖，顶立彩色琉璃宝顶；与东路万春亭对称。'),
  42424173: (ctx, b, api) => { const r = polyPavilion(ctx.at(-28.9, 0, -373.2, 0), { n: 8, R: 1.95, colH: 3.0, ph: 0.6, eaveR: 3.0, rise: 2.6 }); lbl(api, '四神祠', -28.9, r.top + 1.5, -373.2, '八角形小殿，八角攒尖顶，供奉青龙、白虎、朱雀、玄武四方之神。'); },
  42424136: wellPavilion([-37.7, -34.7, -374.0, -370.7]),
  42424182: wellPavilion([46.2, 51.4, -371.4, -365.9]),
  40795246: jiangxuexuan,
  40795247: yangxingzhai,
  42424144: (ctx, b, api) => { wgate(ctx, -56.9, -338.9, 'W', { w: 6.0, h: 7.2, wallThick: 1.2, doorW: 2.4, doorH: 3.4 }); lbl(api, '琼苑西门', -56.9, 8.5, -338.9, '御花园西南门（OSM 误作“掠苑右门”）。'); },
  42424150: (ctx, b, api) => { wgate(ctx, 58.4, -341.0, 'E', { w: 6.6, h: 7.2, wallThick: 1.2, doorW: 2.4, doorH: 3.4 }); lbl(api, '琼苑东门', 58.4, 8.5, -341.0, '御花园东南门（OSM 误作“掠苑左门”）。'); },
  42424195: (ctx) => wgate(ctx, -68.15, -339.85, 'W', { w: 4.6, h: 9.6, wallThick: 1.8, doorW: 2.0, doorH: 4.0, wallH: 8 }),
};
