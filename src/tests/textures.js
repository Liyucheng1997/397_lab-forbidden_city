// 纹理/材质样板：立面样板墙、0..1 构件（彩画/门窗/匾）、带状纹理、地面、大屋面特写、实际屋顶（檐口/椽望/山花/博风）
import '../core/ornaments.js';
import { buildRoof } from '../core/roof.js';
import { boxGeo } from '../core/geom.js';
import { makePlaque, plaqueSize } from '../core/plaque.js';

export default function build(ctx, { THREE, scene }) {
  // 立面片：底边中点在原点、朝 +Z；mode 'm' 米制 UV，'u' 0..1，'band' u 米 v 0..1
  const quad = (w, h, mode = 'm', flipU = false) => {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      let u = uv.getX(i), v = uv.getY(i);
      if (flipU) u = 1 - u;
      if (mode === 'm') { u *= w; v *= h; } else if (mode === 'band') u *= w;
      uv.setXY(i, u, v);
    }
    return g;
  };
  const label = (text, x, y, z, s = 1) => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 80;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, 512, 80);
    g.fillStyle = '#fff'; g.font = '40px "Microsoft YaHei", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 42);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, toneMapped: false }));
    sp.scale.set(2.4 * s, 0.375 * s, 1); sp.position.set(x, y, z);
    scene.add(sp);
  };
  const back = (x, y, w, h, z = -0.06) => { const g = boxGeo(w, h, 0.1); g.translate(x, y + h / 2, z); ctx.add('wood_dark', g); };

  // A. 米制立面样板（x -46..-20）
  const walls = ['wall_red', 'brick_grey', 'brick_dark', 'marble', 'marble_block', 'stone_grey', 'rock', 'gable_red', 'gable_plain', 'wood_red'];
  walls.forEach((k, i) => {
    const x = -46 + (i % 5) * 3.4, y = i < 5 ? 0 : 3.6;
    ctx.at(x, y, 0).add(k, quad(3, 3));
    label(k, x, y + 3.25, 0.1, 0.8);
  });

  // B. 彩画梁枋（6m × 0.8m，u 0..1）与带状纹理
  ['beam_hexi', 'beam_xuanzi', 'beam_sushi'].forEach((k, i) => {
    const y = 4.6 - i * 1.5;
    back(-12, y - 0.05, 6.4, 0.9);
    ctx.at(-12, y, 0).add(k, quad(6, 0.8, 'u'));
    label(k, -12, y + 1.0, 0.1, 0.7);
  });
  const bands = [['eaveband', 0.32], ['eaveband_lg', 0.6], ['bofeng', 0.7], ['marble_band', 0.75], ['marble_waist', 0.4], ['marble_lotus', 0.35]];
  bands.forEach(([k, h], i) => {
    const y = 6.0 - i * 1.05;
    ctx.at(-3.5, y, 0).add(k, quad(4, h, 'band'));
    label(k, -3.5, y + h + 0.18, 0.1, 0.6);
  });
  // 檐下（斜向下的板）
  {
    const g = quad(4, 1.6);
    g.rotateX(Math.PI / 2 + 0.35);
    ctx.at(-3.5, 7.6, 0.8).add('soffit', g);
    label('soffit', -3.5, 8.4, 0.8, 0.6);
  }

  // C. 门窗（u,v 0..1）与匾额（x 2..16）
  const doors = [['lattice_door', 0.9, 2.1], ['lattice_shuangjiao', 0.9, 2.1], ['lattice_window', 0.9, 1.15], ['lattice_fangge', 0.9, 2.1], ['lattice_denglong', 0.9, 2.1], ['door_panel', 0.9, 0.7]];
  doors.forEach(([k, w, h], i) => {
    const x = 2 + i * 1.3;
    back(x, 0, w + 0.16, h + 0.16);
    ctx.at(x, 0.08, 0).add(k, quad(w, h, 'u'));
    label(k.replace('lattice_', ''), x, h + 0.45, 0.1, 0.45);
  });
  back(11.5, 0, 4.3, 4.6);
  ctx.at(10.45, 0.1, 0).add('gate_door', quad(2.05, 4.4, 'u'));
  ctx.at(12.55, 0.1, 0).add('gate_door', quad(2.05, 4.4, 'u', true));
  label('gate_door', 11.5, 4.95, 0.1, 0.6);
  {
    const k1 = makePlaque('太和殿'), s1 = plaqueSize('太和殿', true), cs = 0.5;
    ctx.at(15.6, 1.2, 0).add(k1, quad(s1.w * cs, s1.h * cs, 'u'));
    const k2 = makePlaque('乾清宫', { vertical: false, style: 'blue' }), s2 = plaqueSize('乾清宫', false);
    ctx.at(18.6, 3.0, 0).add(k2, quad(s2.w * 0.42, s2.h * 0.42, 'u'));
    const k3 = makePlaque('正大光明', { vertical: false, style: 'black' }), s3 = plaqueSize('正大光明', false);
    ctx.at(18.6, 1.0, 0).add(k3, quad(s3.w * 0.32, s3.h * 0.32, 'u'));
    label('plaque', 17, 4.4, 0.1, 0.6);
  }

  // D. 地面样板（z 4..12）
  [['paving_square', -30], ['paving_imperial', -20], ['grass', -10], ['marble_block', 0]].forEach(([k, x]) => {
    const g = new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8 + x, uv.getY(i) * 8);
    ctx.at(x, 0.02, 8).add(k, g);
    label(k, x, 0.6, 12.2, 0.8);
  });

  // E. 大屋面特写（30°，宽 30m × 坡长 14m）与各色瓦样
  {
    const L = 14, a = (30 * Math.PI) / 180;
    const g = new THREE.PlaneGeometry(30, L);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 30, uv.getY(i) * L);
    g.translate(0, L / 2, 0); g.rotateX(-(Math.PI / 2 - a));
    ctx.at(0, 0, -16).add('tile_yellow', g);
    ['green', 'blue', 'black', 'purple', 'grey'].forEach((c, i) => {
      const s = new THREE.PlaneGeometry(4, 4);
      const su = s.attributes.uv; for (let j = 0; j < su.count; j++) su.setXY(j, su.getX(j) * 4, su.getY(j) * 4);
      s.translate(0, 2, 0); s.rotateX(-(Math.PI / 2 - a));
      ctx.at(20 + i * 4.4, 0, -16).add('tile_' + c, s);
      label('tile_' + c, 20 + i * 4.4, 2.8, -13.5, 0.6);
    });
  }

  // F. 实际屋顶（歇山黄琉璃，含椽头带/檐下/山花/博风）
  {
    const c = ctx.at(48, 0, -2);
    const body = boxGeo(17, 6, 9); body.translate(0, 3, 0);
    c.add('wall_red', body);
    for (let i = -1; i <= 1; i++) c.at(i * 5.5, 5.0, 4.52).add(i ? 'beam_xuanzi' : 'beam_hexi', quad(5.5, 0.7, 'u'));
    buildRoof(c, { type: 'xieshan', w: 22, d: 14, y: 6.2, tile: 'yellow', bandMat: 'eaveband' });
    const k1 = makePlaque('太和殿');
    const s1 = plaqueSize('太和殿', true);
    c.at(0, 3.4, 4.68).add(k1, quad(s1.w * 0.45, s1.h * 0.45, 'u'));
  }
  return { cam: [-6, 16, 40], tgt: [-6, 3, 0], shadowRadius: 90 };
}
