// west_inner 分区专用原型与材质：铜龙、铜鹿、铜凤（储秀宫/翊坤宫殿前陈设），长春宫回廊《红楼梦》壁画纹理。
// 原型按“实物总高 = 1 单位”建模（底面 y=0，正面朝 +Z），调用方按真实高度缩放。
import * as THREE from 'three';
import { registerProtoFamily } from '../../core/protos.js';
import { defineMaterial } from '../../core/materials.js';
import { registerTexture, canvas, rng } from '../../core/textures.js';
import { boxGeo, merge } from '../../core/geom.js';

/** 变换几何：缩放 s → 欧拉旋转 r(YXZ) → 平移 t */
function tr(g, { s = [1, 1, 1], r = [0, 0, 0], t = [0, 0, 0] } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...t), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ')), new THREE.Vector3(...s));
  g.applyMatrix4(m);
  return g;
}
const ell = (rx, ry, rz, t, r) => tr(new THREE.SphereGeometry(1, 12, 8), { s: [rx, ry, rz], t, r });
const tube = (pts, rad, seg = 20, rs = 8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, rad, rs, false);
/** 两点间圆柱（半径 r0→r1） */
function rod(a, b, r0, r1 = r0, seg = 8) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false);
  g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
  return g;
}
/** 石座（方形，上下枋 + 束腰） */
function pedestal(w, d, h) {
  const a = boxGeo(w, h * 0.22, d); a.translate(0, h * 0.11, 0);
  const b = boxGeo(w * 0.86, h * 0.56, d * 0.86); b.translate(0, h * 0.22 + h * 0.28, 0);
  const c = boxGeo(w * 0.96, h * 0.22, d * 0.96); c.translate(0, h * 0.78 + h * 0.11, 0);
  return merge([a, b, c]);
}
const norm = (parts, H) => parts.map((p) => ({ mat: p.mat, geo: tr(merge(p.geos), { s: [1 / H, 1 / H, 1 / H] }) }));

// 铜鹿（梅花鹿，昂首立姿），实物总高约 2.0m（含石座 0.55）
registerProtoFamily('wi_deer', () => {
  const y = 0.55, G = [];
  G.push(ell(0.17, 0.2, 0.42, [0, y + 0.62, 0]));
  for (const [x, z] of [[-0.09, 0.27], [0.09, 0.27], [-0.09, -0.28], [0.09, -0.28]]) G.push(rod([x, y, z], [x, y + 0.66, z * 0.9], 0.03, 0.045));
  G.push(rod([0, y + 0.72, 0.3], [0, y + 1.05, 0.45], 0.075, 0.055));
  G.push(ell(0.065, 0.07, 0.15, [0, y + 1.1, 0.53], [0.35, 0, 0]));
  for (const s of [-1, 1]) {
    G.push(ell(0.02, 0.07, 0.035, [s * 0.07, y + 1.18, 0.47], [0, 0, s * 0.6]));
    G.push(rod([s * 0.03, y + 1.15, 0.5], [s * 0.12, y + 1.38, 0.44], 0.014, 0.01));
    G.push(rod([s * 0.12, y + 1.38, 0.44], [s * 0.2, y + 1.46, 0.36], 0.01, 0.007));
    G.push(rod([s * 0.08, y + 1.29, 0.47], [s * 0.04, y + 1.42, 0.55], 0.01, 0.006));
    G.push(rod([s * 0.12, y + 1.38, 0.44], [s * 0.1, y + 1.5, 0.48], 0.009, 0.006));
  }
  G.push(ell(0.04, 0.06, 0.05, [0, y + 0.72, -0.42], [-0.5, 0, 0]));
  return norm([{ mat: 'stone_grey', geos: [pedestal(0.7, 1.05, y)] }, { mat: 'bronze', geos: G }], 2.0);
});

// 铜龙（蟠龙昂首，立于石座），实物总高约 2.3m
registerProtoFamily('wi_dragon', () => {
  const y = 0.6, G = [];
  G.push(tube([[0.25, y + 0.05, -0.3], [-0.2, y + 0.2, -0.15], [-0.15, y + 0.45, 0.2], [0.2, y + 0.7, 0.15], [0.15, y + 1.0, -0.15], [-0.1, y + 1.25, -0.05], [0, y + 1.45, 0.15]], 0.085, 40, 8));
  G.push(tube([[0.25, y + 0.05, -0.3], [0.35, y + 0.08, -0.05], [0.3, y + 0.1, 0.2]], 0.05, 10, 6));
  // 头、吻、角、须
  G.push(ell(0.11, 0.1, 0.17, [0, y + 1.52, 0.27], [-0.2, 0, 0]));
  G.push(ell(0.08, 0.05, 0.12, [0, y + 1.45, 0.4], [-0.1, 0, 0]));
  for (const s of [-1, 1]) {
    G.push(rod([s * 0.05, y + 1.6, 0.22], [s * 0.12, y + 1.78, 0.05], 0.022, 0.01));
    G.push(tube([[s * 0.06, y + 1.45, 0.48], [s * 0.18, y + 1.4, 0.5], [s * 0.28, y + 1.5, 0.42]], 0.012, 8, 5));
  }
  // 四爪
  for (const [a, b] of [[[0.15, y + 0.7, 0.2], [0.3, y + 0.55, 0.35]], [[-0.15, y + 0.5, 0.2], [-0.3, y + 0.3, 0.3]], [[0.1, y + 1.0, -0.15], [0.28, y + 0.95, -0.3]], [[-0.15, y + 0.25, -0.1], [-0.3, y + 0.05, -0.2]]]) G.push(rod(a, b, 0.04, 0.03));
  // 背鳍（小锥）
  for (let i = 0; i < 6; i++) { const t = i / 5; G.push(rod([0.1 * Math.sin(i * 1.7), y + 0.3 + t * 1.1, -0.05], [0.1 * Math.sin(i * 1.7), y + 0.42 + t * 1.1, -0.12], 0.03, 0.002, 5)); }
  return norm([{ mat: 'stone_grey', geos: [pedestal(0.85, 0.85, y)] }, { mat: 'bronze', geos: G }], 2.3);
});

// 铜凤（立姿，长尾下垂），实物总高约 2.2m
registerProtoFamily('wi_phoenix', () => {
  const y = 0.55, G = [];
  for (const s of [-1, 1]) G.push(rod([s * 0.07, y, 0.02], [s * 0.06, y + 0.55, 0], 0.025, 0.035));
  G.push(ell(0.17, 0.22, 0.3, [0, y + 0.72, 0], [0.3, 0, 0]));
  G.push(tube([[0, y + 0.8, 0.18], [0, y + 1.05, 0.28], [0, y + 1.3, 0.24], [0, y + 1.42, 0.3]], 0.05, 14, 7));
  G.push(ell(0.06, 0.065, 0.1, [0, y + 1.45, 0.34]));
  G.push(rod([0, y + 1.44, 0.42], [0, y + 1.42, 0.52], 0.022, 0.005, 6));
  for (let i = 0; i < 3; i++) G.push(tube([[0, y + 1.5, 0.3 - i * 0.04], [0, y + 1.62 + i * 0.03, 0.22 - i * 0.06], [0, y + 1.6 + i * 0.04, 0.1 - i * 0.08]], 0.012, 8, 5));
  for (const s of [-1, 1]) G.push(ell(0.05, 0.18, 0.32, [s * 0.17, y + 0.8, -0.05], [0.45, 0, s * 0.35]));
  // 长尾：五根尾羽自背后下垂，末端落于石座顶面
  for (const [dx, k] of [[0, 1], [-0.09, 0.95], [0.09, 0.95], [-0.17, 0.85], [0.17, 0.85]]) {
    G.push(tube([[dx * 0.3, y + 0.62, -0.22], [dx * 0.8, y + 0.5, -0.4 * k], [dx * 1.2, y + 0.28, -0.47 * k], [dx * 1.4, y + 0.04, -0.44 * k]], 0.04, 12, 6));
    G.push(ell(0.06, 0.012, 0.09, [dx * 1.45, y + 0.02, -0.4 * k]));
  }
  return norm([{ mat: 'stone_grey', geos: [pedestal(0.7, 1.0, y)] }, { mat: 'bronze', geos: G }], 2.2);
});

// 长春宫回廊壁画（《红楼梦》题材，工笔重彩风格的抽象化：亭台、山石、树、人物、云），u 周期 3.6m，v 周期 2.4m
registerTexture('wi_mural', () => {
  const W = 768, H = 512, c = canvas(W, H), g = c.getContext('2d'), R = rng(23);
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(140,110,70,${0.02 + R() * 0.03})`; g.beginPath(); g.arc(R() * W, R() * H, 6 + R() * 30, 0, 7); g.fill(); }
  // 远山、水
  g.fillStyle = 'rgba(88,128,118,0.55)';
  g.beginPath(); g.moveTo(0, 210); for (let x = 0; x <= W; x += 32) g.lineTo(x, 150 + 50 * Math.sin(x * 0.013) + 25 * Math.sin(x * 0.041)); g.lineTo(W, 260); g.lineTo(0, 260); g.fill();
  g.fillStyle = 'rgba(120,160,180,0.55)'; g.fillRect(0, 300, W, 70);
  // 亭台楼阁
  for (const [x, y, w, h] of [[90, 240, 150, 90], [470, 210, 190, 110]]) {
    g.fillStyle = '#9b2a1f'; for (let k = 0; k <= 4; k++) g.fillRect(x + (k * w) / 4 - 4, y, 8, h);
    g.fillStyle = '#2c5a4a'; g.beginPath(); g.moveTo(x - 25, y + 6); g.quadraticCurveTo(x + w / 2, y - 60, x + w + 25, y + 6); g.lineTo(x + w + 10, y + 16); g.lineTo(x - 10, y + 16); g.fill();
    g.fillStyle = '#c9a24a'; g.fillRect(x - 6, y + h - 8, w + 12, 10);
  }
  // 山石、树
  for (const [x, y] of [[330, 330], [700, 350], [20, 360]]) {
    g.fillStyle = 'rgba(110,110,100,0.8)'; g.beginPath(); g.ellipse(x, y, 40, 60, 0.2, 0, 7); g.fill();
    g.fillStyle = 'rgba(60,100,60,0.85)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * 70, y - 90 - R() * 50, 22 + R() * 14, 0, 7); g.fill(); }
    g.strokeStyle = '#4a3a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y - 40); g.lineTo(x + 5, y - 100); g.stroke();
  }
  // 人物
  const cols = ['#b8322a', '#2e5a9a', '#d8b04a', '#5a8a5a', '#c86a8a', '#f0ece0'];
  for (let i = 0; i < 9; i++) {
    const x = 60 + R() * (W - 120), y = 380 + R() * 70;
    g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(x - 12, y + 40); g.lineTo(x + 12, y + 40); g.lineTo(x + 6, y); g.lineTo(x - 6, y); g.fill();
    g.fillStyle = '#f2d8bc'; g.beginPath(); g.arc(x, y - 7, 7, 0, 7); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(x, y - 11, 6, Math.PI, 0); g.fill();
  }
  // 云纹边框
  g.strokeStyle = '#6a4a2a'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
  g.strokeStyle = '#2c5a7a'; g.lineWidth = 4; g.strokeRect(18, 18, W - 36, H - 36);
  return c;
});
defineMaterial('wi_mural', { color: 0xffffff, map: 'wi_mural', roughness: 0.9, period: [3.6, 2.4] });
