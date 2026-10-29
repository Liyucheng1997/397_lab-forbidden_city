// 门窗装修测试：七间殿立面（明次间隔扇门、梢尽间槛窗、横披）、三间宫门（板门门钉）、游廊（倒挂楣子+坐凳）、
// 配房（支摘窗）、隔心样式对比（双交四椀/方格/共享纹理/琉璃槛墙/实墙）
import { buildBay, buildCorridorTrim } from '../core/openings.js';
import { boxGeo, cylGeo } from '../core/geom.js';

/** 简易柱网 + 额枋 + 垫板 + 檐（仅为衬托门窗），返回各间 { cx, w } */
function frame(ctx, spans, { h, D, ph = 0.9, depth = 10, eave = 2.6, tile = 'tile_yellow', walls = true, front = 2.2 }) {
  const L = spans.reduce((a, b) => a + b, 0);
  const xs = [-L / 2];
  for (const s of spans) xs.push(xs[xs.length - 1] + s);
  const pg = boxGeo(L + 3, ph, depth + front + 1.5);
  pg.translate(0, ph / 2, (front + 0.75 - depth - 0.75) / 2);
  ctx.add('marble', pg);
  const c = ctx.at(0, ph, 0);
  const bh = D * 0.8, colH = h + bh + 0.5;
  for (const x of xs) {
    c.at(x, 0, 0).add('wood_red', cylGeo(D * 0.47, D * 0.5, colH, 20));
    c.at(x, 0, 0).add('marble', cylGeo(D * 0.68, D * 0.74, 0.08, 20));
    if (walls) c.at(x, 0, -depth).add('wood_red', cylGeo(D * 0.47, D * 0.5, colH, 16));
  }
  for (let i = 0; i < spans.length; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, s = spans[i];
    const g = boxGeo(s, bh, D * 0.7);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / s, uv.getY(k) / bh);
    g.translate(cx, h + bh / 2, 0);
    c.add('beam_hexi', g);
    const pb = boxGeo(s, 0.5, 0.2); pb.translate(cx, h + bh + 0.25, -0.05);
    c.add('board_red', pb);
  }
  if (walls) {
    const wb = boxGeo(L, colH, 0.6); wb.translate(0, colH / 2, -depth + 0.1); c.add('wall_red', wb);
    for (const s of [-1, 1]) { const sw = boxGeo(0.8, colH, depth); sw.translate(s * (L / 2 + 0.2), colH / 2, -depth / 2); c.add('wall_red', sw); }
  }
  // 檐（板 + 椽望底）
  const ey = ph + colH;
  const roof = boxGeo(L + 2 * eave, 0.5, depth + 2 * eave); roof.translate(0, ey + 0.25, -depth / 2);
  ctx.add(tile, roof);
  const so = boxGeo(L + 2 * eave - 0.1, 0.02, depth + 2 * eave - 0.1); so.translate(0, ey - 0.01, -depth / 2);
  ctx.add('soffit', so);
  return spans.map((s, i) => ({ cx: (xs[i] + xs[i + 1]) / 2, w: s - D, y: ph }));
}

export default function build(ctx) {
  // A. 七间殿：明次间隔扇门（三交六椀），梢尽间槛窗，横披
  {
    const h = 5.6, D = 0.66;
    const bays = frame(ctx, [4.4, 5.0, 5.6, 6.4, 5.6, 5.0, 4.4], { h, D, ph: 1.5, depth: 14, eave: 3.4 });
    const types = ['window', 'window', 'door', 'door', 'door', 'window', 'window'];
    bays.forEach((b, i) => buildBay(ctx.at(b.cx, b.y, 0), { w: b.w, h, type: types[i], lattice: 'sanjiao', colD: D }));
  }
  // B. 三间宫门：板门九路门钉、铺首、门簪、门枕石
  {
    const h = 6.0, D = 0.72;
    const c = ctx.at(40, 0, 0);
    const bays = frame(c, [5.2, 5.8, 5.2], { h, D, ph: 1.2, depth: 8, eave: 3.0, walls: false });
    for (const b of bays) buildBay(c.at(b.cx, b.y, 0), { w: b.w, h, type: 'gate', studs: 9, colD: D });
    // 门背面对照（北侧再放一樘，转 180°）
    for (const b of bays) buildBay(c.at(-b.cx, b.y, -8, Math.PI), { w: b.w, h, type: 'gate', studs: 9, colD: D });
  }
  // C. 游廊：倒挂楣子 + 坐凳栏杆
  {
    const h = 3.0, D = 0.3;
    const c = ctx.at(-40, 0, 0);
    const bays = frame(c, [3.2, 3.2, 3.2, 3.2, 3.2], { h, D, ph: 0.45, depth: 2.6, eave: 1.2, tile: 'tile_green', walls: false, front: 0.8 });
    bays.forEach((b, i) => buildCorridorTrim(c.at(b.cx, b.y, 0), { w: b.w, h, style: 'green', bench: i !== 2 }));
    bays.forEach((b) => buildCorridorTrim(c.at(b.cx, b.y, -2.6), { w: b.w, h, style: 'red', bench: true }));
  }
  // D. 配房：明间步步锦隔扇门，次间支摘窗（左支起，右灯笼框）
  {
    const h = 3.2, D = 0.34;
    const c = ctx.at(-68, 0, 0);
    const bays = frame(c, [3.4, 3.8, 3.4], { h, D, ph: 0.6, depth: 6, eave: 1.4, tile: 'tile_grey' });
    buildBay(c.at(bays[0].cx, bays[0].y, 0), { w: bays[0].w, h, type: 'zhizhai', lattice: 'bubujin', colD: D, prop: [0.55, 0] });
    buildBay(c.at(bays[1].cx, bays[1].y, 0), { w: bays[1].w, h, type: 'door', lattice: 'bubujin', colD: D });
    buildBay(c.at(bays[2].cx, bays[2].y, 0), { w: bays[2].w, h, type: 'zhizhai', lattice: 'denglong', colD: D, sillMat: 'brick_grey' });
  }
  // E. 样式对比：双交四椀 / 方格 / 共享纹理 / 琉璃槛墙槛窗 / 实墙（下碱）
  {
    const h = 4.6, D = 0.5;
    const c = ctx.at(72, 0, 0);
    const bays = frame(c, [4.2, 4.2, 4.2, 4.2, 4.2], { h, D, ph: 0.9, depth: 9, eave: 2.6 });
    const specs = [
      { type: 'door', lattice: 'shuangjiao', zan: 2 },
      { type: 'door', lattice: 'fangge' },
      { type: 'door' },
      { type: 'window', lattice: 'shuangjiao', sillMat: 'liuli', sill: 0.9 },
      { type: 'wall' },
    ];
    bays.forEach((b, i) => buildBay(c.at(b.cx, b.y, 0), { w: b.w, h, colD: D, ...specs[i] }));
  }
  return { cam: [5, 35, 140], tgt: [5, 3, 0], shadowRadius: 160 };
}
