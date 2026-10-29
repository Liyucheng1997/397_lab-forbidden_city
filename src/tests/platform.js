// 台基测试：缩小版“三台”（三层汉白玉须弥座，龙凤望柱栏杆、螭首、正面三出陛、中间御路）+ 普通砖台基 + 青白石台基
import { buildPlatform, buildRailing } from '../core/platform.js';
import { getProto } from '../core/protos.js';

// “土”字形台面：o 为外扩量，bump 为踏跺前的出陛平台
function tuPoly(o, bump) {
  const xs = 16 + o, zf = 10 + o, zj = -4 - o, xw = 10 + o, zk = -16 + o, xn = 14 + o, zb = -26 - o;
  const P = [[-xs, zf]];
  if (bump) P.push([-bump.xb, zf], [-bump.xb, bump.zb], [bump.xb, bump.zb], [bump.xb, zf]);
  P.push([xs, zf], [xs, zj], [xw, zj], [xw, zk], [xn, zk], [xn, zb], [-xn, zb], [-xn, zk], [-xw, zk], [-xw, zj], [-xs, zj]);
  return P;
}

export default function build(ctx) {
  const H = 2.2;
  const tiers = [{ o: 5, bump: { xb: 15, zb: 22 } }, { o: 2.5, bump: { xb: 12.5, zb: 16 } }, { o: 0 }];
  let y = 0;
  for (const t of tiers) {
    buildPlatform(ctx, {
      poly: tuPoly(t.o, t.bump), y0: y, h: H, style: 'xumizuo',
      railing: { style: 'marble_dragon', chishou: true },
      stairs: [
        { at: [0, 100], w: 4.6, yulu: { w: 2.2 }, railings: true },
        { at: [-8, 100], w: 2.6, railings: true },
        { at: [8, 100], w: 2.6, railings: true },
        { at: [0, -100], w: 3.4, yulu: { w: 1.6 }, railings: true },
      ],
    });
    y += H;
  }
  // 普通砖台基 + 青白石踏跺
  buildPlatform(ctx.at(48, 0, 12), { w: 14, d: 9, h: 0.9, style: 'plain', stairs: [{ at: [0, 10], w: 3.2 }, { at: [-10, 0], w: 2 }] });
  // 青白石台基 + 石栏杆 + 带栏杆踏跺
  buildPlatform(ctx.at(48, 0, -10), { w: 12, d: 8, h: 1.3, style: 'stone', railing: { style: 'stone' }, stairs: [{ at: [0, 10], w: 3, railings: true }] });
  // 砖须弥座 + 二十四气柱头栏杆（开口路径，两端抱鼓）
  buildPlatform(ctx.at(48, 0, -30), { w: 12, d: 7, h: 1.2, style: 'xumizuo_brick' });
  buildRailing(ctx.at(48, 0, -30), { path: [[-5.6, 3.2], [5.6, 3.2]], y: 1.2, style: 'marble' });
  buildRailing(ctx.at(48, 0, -30), { path: [[-5.6, -3.2], [5.6, -3.2]], y: 1.2, style: 'wood_red' });

  // 原型三角形数
  const tri = (k) => getProto(k).parts.reduce((s, p) => s + (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3, 0);
  window.__pfTris = Object.fromEntries(['pf_post:dragon:m', 'pf_post:qi24:m', 'pf_post:plain:s', 'pf_panel:m', 'pf_baogu:m', 'pf_chishou:n', 'pf_chishou:c'].map((k) => [k, tri(k)]));
  console.info('pf tris', JSON.stringify(window.__pfTris));
  return { cam: [62, 40, 78], tgt: [4, 3, -2], shadowRadius: 90 };
}
