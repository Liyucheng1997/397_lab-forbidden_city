// 匾额：蓝底金字（沥粉贴金凸字）、金色雕龙边框。竖匾文字自上而下，横匾自右向左（清制）。
// makePlaque(text, opts) → 材质 key（同名缓存，defineMaterial 注册，首次渲染时才生成纹理）。UV：u,v 0..1 覆盖整块匾面。
// plaqueSize(text, vertical) → { w, h, aspect }，w/h 以“字高”为单位：实际尺寸 = w × 字高(米)，如太和殿约 0.9m。
import * as THREE from 'three';
import { defineMaterial } from './materials.js';
import { Painter, finish, drawDragon, drawCloud, drawPearl, PAL } from './textures.js';

const CS = 192; // 每字像素
const B = 0.44, M = 0.16, GAP = 0.08; // 边框宽、字与框留白、字距（字高 = 1）
const STYLES = {
  blue: { field: [14, 32, 86], field2: [26, 52, 118] },
  black: { field: [20, 19, 19], field2: [42, 38, 36] },
  green: { field: [18, 72, 54], field2: [32, 102, 74] },
  red: { field: [120, 24, 18], field2: [150, 36, 26] },
};
const FONT = '"KaiTi","STKaiti","Kaiti SC","BiauKai","楷体","SimSun",serif';

export function plaqueSize(text, vertical = true) {
  const n = Math.max(1, [...text].length);
  const a = n + (n - 1) * GAP + 2 * (B + M), b = 1 + 2 * (B + M);
  return vertical ? { w: b, h: a, aspect: b / a } : { w: a, h: b, aspect: a / b };
}

function glyph(P, ch, x, y, size) {
  const layers = { c: null, h: '#fff', r: 'rgb(72,72,72)', m: '#fff' };
  for (const k in P.G) {
    const g = P.G[k];
    g.save();
    g.font = `bold ${size}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (k === 'c') {
      g.lineJoin = 'round'; g.lineWidth = size * 0.05; g.strokeStyle = 'rgb(120,78,20)';
      g.strokeText(ch, x, y);
      const gr = g.createLinearGradient(x, y - size / 2, x, y + size / 2);
      gr.addColorStop(0, 'rgb(250,220,130)'); gr.addColorStop(0.5, 'rgb(224,176,70)'); gr.addColorStop(1, 'rgb(186,132,40)');
      g.fillStyle = gr;
    } else {
      if (k === 'h') { g.lineJoin = 'round'; g.lineWidth = size * 0.03; g.strokeStyle = '#bbb'; g.strokeText(ch, x, y); }
      g.fillStyle = layers[k];
    }
    g.fillText(ch, x, y);
    g.restore();
  }
}

function buildPlaque(text, vertical, style) {
  const sz = plaqueSize(text, vertical), W = Math.round(sz.w * CS), H = Math.round(sz.h * CS);
  const st = STYLES[style] || STYLES.blue;
  const P = new Painter(W, H, { c: st.field, h: 0.3, r: 0.55, m: 0 });
  const b = B * CS, gold = { c: PAL.gold, h: 0.9, r: 0.3, m: 1 }, gd = { c: PAL.goldD, h: 0.8, r: 0.35, m: 1 };
  // 匾心：微弱径向晕
  P.rect(b, b, W - 2 * b, H - 2 * b, { c: (g) => { const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.6); gr.addColorStop(0, `rgb(${st.field2})`); gr.addColorStop(1, `rgb(${st.field})`); return gr; } });
  // 边框：外线脚 | 雕龙带 | 内线脚
  const ring = (o, i) => (g) => { g.rect(o, o, W - 2 * o, H - 2 * o); g.rect(i, i, W - 2 * i, H - 2 * i); };
  P.draw(ring(0, b), { ...gold, rule: 'evenodd' });
  P.draw(ring(0.075 * CS, b - 0.075 * CS), { c: [118, 76, 22], h: 0.42, r: 0.4, m: 1, rule: 'evenodd' });
  P.draw((g) => g.rect(3, 3, W - 6, H - 6), { lw: 4, c: PAL.goldD, h: 0.7 });
  P.draw((g) => g.rect(b - 4, b - 4, W - 2 * b + 8, H - 2 * b + 8), { lw: 6, c: PAL.goldL, h: 1, r: 0.25, m: 1 });
  P.draw((g) => g.rect(b, b, W - 2 * b, H - 2 * b), { lw: 3, c: [90, 60, 16], h: 0.5 });
  for (const k in P.G) { const g = P.G[k]; g.save(); g.beginPath(); ring(0.075 * CS, b - 0.075 * CS)(g); g.clip('evenodd'); }
  const t0 = 0.075 * CS, t1 = b - 0.075 * CS, mid = (t0 + t1) / 2, bw = t1 - t0, L = bw * 3.2, dw = { w: 0.11, amp: 0.06, gold: PAL.gold, dark: PAL.goldD, light: PAL.goldL, h: 0.86 };
  // 上下边：二龙戏珠
  for (const [y, fl] of [[mid, false], [H - mid, true]]) {
    drawPearl(P, W / 2, y, bw * 0.16);
    drawDragon(P, W / 2 - bw * 0.55, y, Math.min(L, W / 2 - b * 0.8), 0, { ...dw, flip: fl });
    P.mx = true; drawDragon(P, W / 2 - bw * 0.55, y, Math.min(L, W / 2 - b * 0.8), 0, { ...dw, flip: fl }); P.mx = false;
  }
  // 左右边：升降龙相间，余处填云
  const side = H - 2 * b, n = Math.max(1, Math.floor(side / (L * 1.15)));
  for (const [x, s] of [[mid, 1], [W - mid, -1]]) {
    for (let i = 0; i < n; i++) {
      const y = b + (side * (i + 0.5)) / n, up = i % 2 === 0;
      drawDragon(P, x, y + (up ? -L / 2 : L / 2), L, up ? -Math.PI / 2 : Math.PI / 2, { ...dw, flip: (s > 0) === up });
    }
    for (const y of [b * 0.5, H - b * 0.5]) drawCloud(P, x, y, bw * 0.5, gold, PAL.goldD);
  }
  for (const k in P.G) P.G[k].restore();
  // 字
  const chars = [...text], fs = CS * 0.86;
  chars.forEach((ch, i) => {
    const c = (B + M + 0.5 + i * (1 + GAP)) * CS;
    if (vertical) glyph(P, ch, W / 2, c, fs);
    else glyph(P, ch, W - c, H / 2, fs);
  });
  const out = finish(P, { k: 3, blurR: 2, cav: 1.1, cavR: 4, toks: 0.6 });
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const rough = new THREE.Texture(out.rough.mips[0]);
  rough.mipmaps = out.rough.mips; rough.generateMipmaps = false; rough.minFilter = THREE.LinearMipmapLinearFilter; rough.anisotropy = 8; rough.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: tex(out.color, true), normalMap: tex(out.normal), roughnessMap: rough, metalnessMap: tex(out.metal), roughness: 1, metalness: 1, envMapIntensity: 1.1 });
}

const made = new Map();
/** 返回匾额材质 key。opts: vertical（默认竖匾）, style 'blue'|'black'|'green'|'red' */
export function makePlaque(text, { vertical = true, style = 'blue' } = {}) {
  const key = `plaque:${style}:${vertical ? 'v' : 'h'}:${text}`;
  if (made.has(key)) return key;
  let mat = null;
  defineMaterial(key, { get material() { return (mat ||= buildPlaque(text, vertical, style)); } });
  made.set(key, true);
  return key;
}
