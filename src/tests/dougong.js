// 斗拱测试台
//   ?mode=sets（默认：1/3/5/7/9/11 踩 × 平身/柱头/角科 单攒一览）
//   ?mode=one&k=ping&c=9（单攒特写）
//   ?mode=run&c=9（两间一转角的檐面：枋、垫拱板、盖斗板）
//   ?mode=bldg&c=9[&roof=1]（7 间 × 3 间柱网四周布置）
import '../core/ornaments.js';
import { placeDougong, dougongHeight, dougongReach } from '../core/dougong.js';
import { getProto } from '../core/protos.js';
import { boxGeo, cylGeo } from '../core/geom.js';
import { buildRoof } from '../core/roof.js';

const KOU = 0.096;
const tri = (k) => { const p = getProto(k); return p ? p.parts.reduce((s, q) => s + q.geo.attributes.position.count / 3, 0) : 0; };

function pingban(ctx, x, z, len, rot = 0, y = 0) {
  const g = boxGeo(len, 0.2, 0.36); g.translate(0, y - 0.1, 0);
  ctx.at(x, 0, z, rot).add('wood_green', g);
}

export default function build(ctx) {
  const q = new URLSearchParams(location.search);
  const mode = q.get('mode') || 'sets';
  const cai = +(q.get('c') || 9);
  const counts = {};
  for (const c of [1, 3, 5, 7, 9, 11]) for (const k of ['ping', 'zhu', 'jiao']) counts[`${k}:${c}`] = tri(`dougong:${k}:${c}`);
  console.log('dougong tris ' + JSON.stringify(counts));

  if (mode === 'sets') {
    // 每种一排：自左至右 1/3/5/7/9/11 踩，立于短柱上
    const cais = [1, 3, 5, 7, 9, 11], kinds = q.get('k') ? [q.get('k')] : ['ping', 'zhu', 'jiao'];
    kinds.forEach((k, r) => cais.forEach((c, i) => {
      const x = (i - 2.5) * 2.5, z = -r * 5, h = 1.6 + r * 1.2;
      ctx.at(x, 0, z).add('wood_red', cylGeo(0.16, 0.17, h - 0.2, 12));
      const s = ctx.at(x, h, z, k === 'jiao' ? -Math.PI / 4 : 0);
      if (k === 'jiao') { pingban(s, -0.6, 0, 1.6); pingban(s, 0, -0.6, 1.6, Math.PI / 2); }
      else pingban(s, 0, 0, 2.4);
      s.place(`dougong:${k}:${c}`, 0, 0, 0, 0, KOU);
    }));
    return kinds.length === 1 ? { cam: [0, 1.4, 12.5], tgt: [0, 2.0, 0], shadowRadius: 14 } : { cam: [0, 1.0, 11], tgt: [0, 2.8, -4], shadowRadius: 20 };
  }
  if (mode === 'one') {
    const k = q.get('k') || 'ping';
    const s = ctx.at(0, 0.2, 0);
    if (k === 'jiao') { pingban(s, -0.6, 0, 1.6); pingban(s, 0, -0.6, 1.6, Math.PI / 2); }
    else pingban(s, 0, 0, 2.4);
    s.place(`dougong:${k}:${cai}${q.get('v') ? ':' + q.get('v') : ''}`, 0, 0, 0, 0, KOU);
    const H = dougongHeight(cai) * KOU;
    return { cam: [1.4, 0.2 + H * 0.3, 2.6], tgt: [0, 0.2 + H * 0.55, 0.3], shadowRadius: 6 };
  }
  // 柱网 + 额枋 + 平板枋
  const run = mode === 'run';
  const wx = run ? [2.4, 2.4] : [4.2, 5.0, 5.6, 6.6, 5.6, 5.0, 4.2];
  const wz = run ? [3.0] : [4.6, 7.2, 4.6];
  const acc = (w) => { const t = w.reduce((a, b) => a + b, 0); const o = [-t / 2]; for (const v of w) o.push(o[o.length - 1] + v); return o; };
  const colsX = acc(wx), colsZ = acc(wz);
  const colH = run ? 3.0 : 6.0, base = run ? 0 : 1.2;
  if (!run) { const p = boxGeo(colsX.at(-1) * 2 + 7, base, colsZ.at(-1) * 2 + 7); p.translate(0, base / 2, 0); ctx.add('marble', p); }
  const ring = [];
  for (const x of colsX) { ring.push([x, colsZ[0]], [x, colsZ.at(-1)]); }
  for (const z of colsZ.slice(1, -1)) { ring.push([colsX[0], z], [colsX.at(-1), z]); }
  for (const [x, z] of ring) ctx.at(x, base, z).add('wood_red', cylGeo(0.3, 0.33, colH, 16));
  const yb = base + colH;
  const beam = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), r = Math.atan2(-(z1 - z0), x1 - x0);
    const e = boxGeo(L, 0.62, 0.48); e.translate(0, -0.31, 0);
    ctx.at((x0 + x1) / 2, yb, (z0 + z1) / 2, r).add('beam_hexi', e);
    const p = boxGeo(L + 0.4, 0.2, 0.38); p.translate(0, 0.1, 0);
    ctx.at((x0 + x1) / 2, yb, (z0 + z1) / 2, r).add('wood_green', p);
  };
  const sides = run ? ['S', 'E'] : ['S', 'N', 'E', 'W'];
  if (sides.includes('S')) beam(colsX[0], colsZ.at(-1), colsX.at(-1), colsZ.at(-1));
  if (sides.includes('N')) beam(colsX[0], colsZ[0], colsX.at(-1), colsZ[0]);
  if (sides.includes('E')) beam(colsX.at(-1), colsZ[0], colsX.at(-1), colsZ.at(-1));
  if (sides.includes('W')) beam(colsX[0], colsZ[0], colsX[0], colsZ.at(-1));
  const res = placeDougong(ctx, { colsX, colsZ, y: yb + 0.2, kou: KOU, cai, sides, edge: q.get('edge') || 'gold' });
  console.log('placeDougong ' + JSON.stringify(res) + ' H=' + dougongHeight(cai) + ' R=' + dougongReach(cai));
  if (q.get('roof') === '1') {
    const out = res.reach + 21 * KOU;
    buildRoof(ctx, { type: 'wudian', w: colsX.at(-1) * 2 + out * 2, d: colsZ.at(-1) * 2 + out * 2, y: res.top + 0.1, tile: 'yellow', overhang: out + 0.5, beasts: 9 });
  }
  if (run) return { cam: [4.8, 2.0, 5.2], tgt: [1.6, 3.7, 1.8], shadowRadius: 10 };
  return { cam: [-34, 9, 36], tgt: [0, 6, 0], shadowRadius: 40 };
}
