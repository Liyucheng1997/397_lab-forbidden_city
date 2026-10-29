// 陈设一览（真实尺寸 + 标尺）与金水桥特写。建议 catalog.html?t=props&ground=0（自带地面与河道）
import { buildBridge, propHeight } from '../core/props.js';
import { boxGeo, cylGeo } from '../core/geom.js';
import { getProto } from '../core/protos.js';

// [原型, 真实高, 占宽, 名称]
const ROW = [
  ['lion:m', 4.4, 2.0, '铜狮（雄）'], ['lion:f', 4.4, 2.0, '铜狮（雌）'], ['lion:m:gilt', 3.6, 1.7, '鎏金铜狮'],
  ['vat:gilt', 1.6, 1.65, '鎏金铜缸'], ['vat:bronze', 1.6, 1.65, '铜缸'], ['vat:iron', 1.6, 1.75, '铁缸'],
  ['sundial', 2.6, 1.5, '日晷'], ['jialiang', 2.6, 1.45, '嘉量'], ['tortoise', 2.2, 1.2, '铜龟'], ['crane', 2.6, 0.85, '铜鹤'],
  ['censer:ding', 2.0, 1.15, '鼎式香炉'], ['censer:tower', 3.0, 1.3, '塔式香炉'], ['lamp:stone', 2.2, 1.0, '石灯'],
  ['flagpole', 12, 1.8, '旗杆'], ['stele', 4.0, 1.9, '石碑'],
];
export const ROW_Z = -12;

function label(THREE, scene, text, x, y, z, s = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(25,22,20,0.72)'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#fff'; g.font = 'bold 54px "Microsoft YaHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false }));
  sp.scale.set(2.4 * s, 0.6 * s, 1);
  sp.position.set(x, y, z);
  scene.add(sp);
}

function ruler(ctx, x, z, h) {
  for (let i = 0; i < Math.ceil(h); i++) {
    const sh = Math.min(1, h - i);
    ctx.add(i % 2 ? 'plaster_white' : 'wood_red', boxGeo(0.07, sh, 0.07).translate(x, i + sh / 2, z));
    ctx.add('wood_dark', boxGeo(0.16, 0.012, 0.012).translate(x + 0.04, i, z + 0.04));
  }
}

export default function build(ctx, { THREE, scene }) {
  const tri = {};
  // 陈设一行
  let x = -25;
  for (const [key, h, w, name] of ROW) {
    x += w / 2;
    ctx.place(key, x, 0, ROW_Z, 0, h);
    ruler(ctx, x + w / 2 + 0.22, ROW_Z + 0.6, h);
    label(THREE, scene, `${name} ${h}m`, x, h + 0.7, ROW_Z, h > 6 ? 1.2 : 0.9);
    tri[key] = getProto(key).parts.reduce((s, p) => s + (p.geo.index ? p.geo.index.count : p.geo.attributes.position.count) / 3, 0);
    x += w / 2 + 1.5;
  }
  // 1.7m 人形参照
  ctx.add('wood_dark', cylGeo(0.17, 0.2, 1.48, 10).translate(-26.5, 0, ROW_Z));
  ctx.add('wood_dark', new THREE.SphereGeometry(0.12, 10, 8).translate(-26.5, 1.58, ROW_Z));
  console.log('[props] tris', JSON.stringify(tri), 'heights', propHeight('lion:m'), propHeight('censer:tower'));

  // 河道 + 桥
  const rivers = [];
  const addBridge = (bx, zc, o) => {
    const t0 = ctx.batcher.triCount;
    const info = buildBridge(ctx.at(bx, 0, zc), o);
    console.log('[props] bridge', JSON.stringify(o), 'merged tris', ctx.batcher.triCount - t0);
    return { zc, half: Math.max(-info.channel[0], info.channel[1]), waterY: o.waterY ?? -1.8, bedY: info.bedY };
  };
  // 内金水桥：中路御路桥（宽、龙纹望柱）+ 两侧王公桥（窄）
  const r1 = addBridge(-7, 30, { length: 22, width: 6.4, archH: 1.6, waterY: -1.8, dragonPosts: true });
  addBridge(6, 30, { length: 22, width: 4.4, archH: 1.6, waterY: -1.8 });
  rivers.push(r1);
  rivers.push(addBridge(-6, 64, { length: 34, width: 8, archH: 2.4, arches: 3, waterY: -1.8 }));
  rivers.push(addBridge(10, 94, { length: 16, width: 4.5, archH: 0.9, arches: 3, style: 'stone', span: 9, waterY: -1.0 }));

  // 地面与河道
  const X0 = -60, X1 = 60;
  let z = -40;
  const slab = (za, zb) => { if (zb > za) ctx.add('paving', boxGeo(X1 - X0, 1, zb - za).translate((X0 + X1) / 2, -0.5, (za + zb) / 2)); };
  for (const r of rivers) {
    slab(z, r.zc - r.half - 0.3);
    for (const s of [-1, 1]) ctx.add('stone_grey', boxGeo(X1 - X0, -r.bedY + 0.05, 0.3).translate((X0 + X1) / 2, r.bedY / 2 + 0.025, r.zc + s * (r.half + 0.15)));
    ctx.add('ground_dirt', boxGeo(X1 - X0, 0.2, r.half * 2).translate((X0 + X1) / 2, r.bedY - 0.1, r.zc));
    ctx.add('water', boxGeo(X1 - X0, 0.02, r.half * 2).translate((X0 + X1) / 2, r.waterY - 0.01, r.zc));
    z = r.zc + r.half + 0.3;
  }
  slab(z, 120);
  return { cam: [-2, 6.5, 14], tgt: [-2, 2.5, -12], shadowRadius: 80 };
}
