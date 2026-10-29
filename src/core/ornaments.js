// 脊饰原型：正吻 wen、走兽 beast、垂兽 chuishou、套兽 taoshou、宝顶 baoding、瓦当 wadang
// 均按单位尺寸建模，由 roof.js decorate() 缩放放置（局部坐标约定见各族注释）。
// 三角形预算：吻 ≤2500、走兽 ≤600、垂兽 ≤900、套兽 ≤500、宝顶 ≤1200、瓦当 ≤120
import * as THREE from 'three';
import { registerProtoFamily } from './protos.js';
import { merge } from './geom.js';
import { glazeMat, getMaterial, defineMaterial } from './materials.js';
import { registerTexture, makeTexture, normalFromHeight, canvas } from './textures.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

// ---------------- 造型工具 ----------------
function xf(g, { s, r, t } = {}) {
  if (s !== undefined) (typeof s === 'number' ? g.scale(s, s, s) : g.scale(s[0], s[1], s[2]));
  if (r) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0], r[1], r[2], 'XYZ')));
  if (t) g.translate(t[0], t[1], t[2]);
  return g;
}

/** 椭球：c 中心，r 半径 [rx,ry,rz]，rot 欧拉角 */
function ell(c, r, ws = 8, hs = 6, rot) {
  return xf(new THREE.SphereGeometry(1, ws, hs), { s: r, r: rot, t: c });
}

/** 圆锥（开口底）：a 底心 → b 尖 */
function cone(a, b, r, seg = 5) {
  const A = new V3(...a), B = new V3(...b);
  const L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(0, r, L, seg, 1, true);
  g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), B.sub(A).normalize()));
  return g.translate(a[0], a[1], a[2]);
}

/** 圆柱段 a→b（封端） */
function rod(a, b, r0, r1 = r0, seg = 6) {
  const A = new V3(...a), B = new V3(...b);
  const L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, false);
  g.translate(0, L / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), B.sub(A).normalize()));
  return g.translate(a[0], a[1], a[2]);
}

/**
 * 管体：沿控制点（Catmull-Rom）扫掠圆截面。r0→r1 线性变径（或 r0 为函数 t=>r）。
 * up：截面参考轴（浮雕贴面时取面法线），flat：沿 up 方向压扁系数。
 */
function tube(ctrl, r0, r1 = r0, { n = 8, rad = 5, up = null, flat = 1, cap = true } = {}) {
  const C = ctrl.map((p) => new V3(...p));
  const pts = C.length > 2 ? new THREE.CatmullRomCurve3(C, false, 'centripetal').getSpacedPoints(n)
    : Array.from({ length: n + 1 }, (_, i) => new V3().lerpVectors(C[0], C[1], i / n));
  const T = pts.map((p, i) => new V3().subVectors(pts[Math.min(i + 1, n)], pts[Math.max(i - 1, 0)]).normalize());
  const U = up ? new V3(...up).normalize() : null;
  let u = new V3();
  if (!U) { const t0 = T[0]; u.set(Math.abs(t0.x) < 0.9 ? 1 : 0, Math.abs(t0.x) < 0.9 ? 0 : 1, 0).cross(t0).normalize(); }
  const rf = typeof r0 === 'function' ? r0 : (t) => r0 + (r1 - r0) * t;
  const pos = [], idx = [];
  let s = new V3(1, 0, 0);
  for (let i = 0; i <= n; i++) {
    if (U) {
      const ss = new V3().crossVectors(U, T[i]);
      if (ss.lengthSq() > 1e-8) s = ss.normalize();
      u = new V3().crossVectors(T[i], s).normalize();
    } else {
      u.addScaledVector(T[i], -u.dot(T[i])).normalize();
      s = new V3().crossVectors(u, T[i]).normalize();
    }
    const r = Math.max(rf(i / n), 1e-4);
    for (let j = 0; j < rad; j++) {
      const a = (j / rad) * TAU;
      const c = Math.cos(a) * r, d = Math.sin(a) * r * (U ? flat : 1);
      pos.push(pts[i].x + s.x * c + u.x * d, pts[i].y + s.y * c + u.y * d, pts[i].z + s.z * c + u.z * d);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < rad; j++) {
    const a = i * rad + j, b = (i + 1) * rad + j, c = (i + 1) * rad + ((j + 1) % rad), d = i * rad + ((j + 1) % rad);
    idx.push(a, c, b, a, d, c);
  }
  if (cap) {
    for (const [i, sgn] of [[0, -1], [n, 1]]) {
      if (rf(i / n) < 2e-3) continue;
      const ci = pos.length / 3;
      pos.push(pts[i].x, pts[i].y, pts[i].z);
      for (let j = 0; j < rad; j++) {
        const a = i * rad + j, b = i * rad + ((j + 1) % rad);
        if (sgn > 0) idx.push(ci, b, a); else idx.push(ci, a, b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 闭合轮廓 Chaikin 平滑；点的第三分量为真时保持尖角 */
function chaikin(pts, it = 1) {
  let P = pts;
  for (let k = 0; k < it; k++) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (a[2]) out.push(a);
      else out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      if (!b[2]) out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    P = out;
  }
  return P;
}

/** 折角法线：夹角小于 ang 的相邻面平滑（按位置合并，面积加权） */
function creased(geo, ang = 0.85) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const P = g.attributes.position.array;
  const nf = P.length / 9;
  const fn = new Float32Array(nf * 3), fu = new Float32Array(nf * 3);
  const map = new Map();
  const key = (o) => `${Math.round(P[o] * 2e4)},${Math.round(P[o + 1] * 2e4)},${Math.round(P[o + 2] * 2e4)}`;
  const a = new V3(), b = new V3(), c = new V3();
  for (let f = 0; f < nf; f++) {
    a.fromArray(P, f * 9); b.fromArray(P, f * 9 + 3); c.fromArray(P, f * 9 + 6);
    c.sub(b); a.sub(b); c.cross(a);
    fn[f * 3] = c.x; fn[f * 3 + 1] = c.y; fn[f * 3 + 2] = c.z;
    const l = c.length() || 1;
    fu[f * 3] = c.x / l; fu[f * 3 + 1] = c.y / l; fu[f * 3 + 2] = c.z / l;
    for (let k = 0; k < 3; k++) {
      const h = key(f * 9 + k * 3);
      let L = map.get(h);
      if (!L) map.set(h, (L = []));
      L.push(f);
    }
  }
  const cosA = Math.cos(ang);
  const N = new Float32Array(P.length);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) {
    let x = 0, y = 0, z = 0;
    for (const o of map.get(key(f * 9 + k * 3))) {
      if (fu[o * 3] * fu[f * 3] + fu[o * 3 + 1] * fu[f * 3 + 1] + fu[o * 3 + 2] * fu[f * 3 + 2] < cosA) continue;
      x += fn[o * 3]; y += fn[o * 3 + 1]; z += fn[o * 3 + 2];
    }
    const l = Math.hypot(x, y, z) || 1;
    N[f * 9 + k * 3] = x / l; N[f * 9 + k * 3 + 1] = y / l; N[f * 9 + k * 3 + 2] = z / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}

/** 厚板：XY 平面轮廓 pts=[[x,y,sharp?]...]，沿 Z 挤出，z∈[z-hz, z+hz]，圆倒角 */
function plate(pts, hz, { bev = 0.012, segs = 1, it = 1, z = 0 } = {}) {
  const P = chaikin(pts, it);
  const shape = new THREE.Shape(P.map((p) => new THREE.Vector2(p[0], p[1])));
  const bt = Math.min(bev, hz * 0.8);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(2 * hz - 2 * bt, 1e-4), bevelEnabled: bev > 0, bevelThickness: bt, bevelSize: bev, bevelOffset: -bev,
    bevelSegments: segs, curveSegments: 1, steps: 1,
  });
  g.translate(0, 0, z - hz + bt);
  return creased(g);
}

/** 镜像（axis 0=x 2=z），翻转绕序 */
function mir(g, axis = 2) {
  const h = g.index ? g.toNonIndexed() : g.clone();
  h.scale(axis === 0 ? -1 : 1, 1, axis === 2 ? -1 : 1);
  for (const name of ['position', 'normal', 'uv']) {
    const at = h.attributes[name];
    if (!at) continue;
    const s = at.itemSize, arr = at.array;
    for (let i = 0; i < at.count; i += 3) for (let k = 0; k < s; k++) {
      const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t;
    }
  }
  return h;
}
const both = (g, axis = 2) => [g, mir(g, axis)];
const flatAll = (list) => list.flat(Infinity).filter(Boolean);

/** 合并并等比缩放到 maxY = h（y=0 不动） */
function fitH(geos, h = 1) {
  const g = merge(flatAll(geos));
  g.computeBoundingBox();
  const s = h / g.boundingBox.max.y;
  return g.scale(s, s, s);
}

// ---------------- 正吻 ----------------
// 单位高 1（底 y=0），龙首张口吞脊、口朝 -X；吻尾外卷于 +X 上角；背插剑把，背兽朝 +X；厚 z≈0.24（头部 0.31）
function buildWen() {
  const G = [];
  // 头部（±0.155）：上下颌、卷唇，口内吞脊
  const head = [
    [-0.30, 0, 1], [0.10, 0, 1], [0.17, 0.07], [0.195, 0.22], [0.185, 0.40], [0.14, 0.55], [0.06, 0.665], [-0.05, 0.74],
    [-0.15, 0.775], [-0.215, 0.755], [-0.26, 0.715], [-0.31, 0.69], [-0.345, 0.69], [-0.37, 0.72], [-0.395, 0.738],
    [-0.42, 0.722], [-0.428, 0.68], [-0.41, 0.635], [-0.392, 0.598], [-0.36, 0.572], [-0.30, 0.55], [-0.18, 0.535], [-0.07, 0.50, 1], [-0.03, 0.44],
    [-0.022, 0.26], [-0.06, 0.155, 1], [-0.22, 0.14], [-0.33, 0.14], [-0.37, 0.18], [-0.40, 0.155], [-0.39, 0.085], [-0.35, 0.03],
  ];
  G.push(plate(head, 0.155, { bev: 0.026 }));
  // 吻身（±0.12）：背鳍锯齿；上部外卷吻尾高出吻背
  const body = [[0.0, 0, 1], [0.33, 0, 1]];
  for (let y = 0.04; y < 0.55; y += 0.1) body.push([0.335, y, 1], [0.375, y + 0.065, 1]);
  body.push([0.33, 0.58, 1], [0.36, 0.62], [0.395, 0.69], [0.402, 0.77], [0.385, 0.855], [0.34, 0.925], [0.27, 0.968], [0.19, 0.975],
    [0.12, 0.95], [0.075, 0.905, 1], [0.0, 0.9], [-0.1, 0.885], [-0.17, 0.865], [-0.205, 0.835, 1], [-0.21, 0.79], [-0.17, 0.66, 1], [-0.04, 0.35, 1]);
  const scaled = plate(body, 0.12, { bev: 0.024 }); // 吻身（鳞纹材质）
  // 吻座
  G.push(plate([[-0.02, 0, 1], [0.345, 0, 1], [0.345, 0.045, 1], [-0.02, 0.045, 1]], 0.14, { bev: 0.01, it: 0 }));
  // 双面浮雕
  const rel = [];
  const Z = 0.155, ZB = 0.12, UP = { up: [0, 0, 1] };
  rel.push(ell([-0.17, 0.655, Z - 0.004], [0.048, 0.04, 0.032], 7, 5)); // 眼
  rel.push(ell([-0.172, 0.655, Z + 0.022], [0.02, 0.02, 0.012], 5, 3)); // 瞳
  rel.push(tube([[-0.245, 0.69, Z], [-0.2, 0.715, Z + 0.004], [-0.13, 0.715, Z + 0.004], [-0.07, 0.73, Z], [-0.0, 0.775, ZB + 0.01]],
    0.022, 0.008, { ...UP, n: 7, rad: 5, flat: 0.7, cap: false })); // 眉
  rel.push(tube([[-0.11, 0.745, ZB + 0.012], [-0.02, 0.8, ZB + 0.016], [0.04, 0.85, ZB + 0.012], [0.05, 0.89, ZB + 0.006]],
    0.028, 0.01, { ...UP, n: 6, rad: 5, flat: 0.75, cap: false })); // 角
  rel.push(ell([-0.392, 0.69, Z - 0.012], [0.03, 0.026, 0.024], 6, 4)); // 鼻
  rel.push(tube([[-0.395, 0.6, Z], [-0.3, 0.578, Z + 0.004], [-0.15, 0.566, Z + 0.002], [-0.04, 0.5, Z - 0.004]],
    0.014, 0.01, { ...UP, n: 6, rad: 4, flat: 0.7, cap: false })); // 上唇线
  // 腮须卷
  const sp = [];
  for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.9 - i * 0.68, r = 0.075 - i * 0.0068; sp.push([0.06 + Math.cos(a) * r, 0.33 + Math.sin(a) * r, Z + 0.002]); }
  rel.push(tube([[-0.06, 0.48, Z], ...sp], 0.018, 0.008, { ...UP, n: 10, rad: 4, flat: 0.7, cap: false }));
  // 鬣（火焰鬃，贴于头后吻身）
  rel.push(plate([[0.1, 0.2, 1], [0.25, 0.27, 1], [0.21, 0.32], [0.31, 0.39, 1], [0.245, 0.43], [0.315, 0.52, 1], [0.24, 0.535],
    [0.265, 0.63, 1], [0.15, 0.6], [0.12, 0.45]], 0.016, { bev: 0, it: 0, z: ZB + 0.004 }));
  // 龙身盘入吻尾（螺旋）
  const tail = [[0.06, 0.62, ZB], [0.1, 0.72, ZB + 0.004]];
  for (let i = 0; i <= 15; i++) {
    const a = Math.PI * 1.0 - i * 0.52, r = 0.105 - i * 0.0058;
    tail.push([0.272 + Math.cos(a) * r, 0.795 + Math.sin(a) * r, ZB + 0.004]);
  }
  rel.push(tube(tail, (t) => 0.034 - 0.022 * t, 0, { ...UP, n: 18, rad: 4, flat: 0.6, cap: false }));
  // 牙
  for (const [x, y0, y1] of [[-0.335, 0.555, 0.505], [-0.25, 0.54, 0.495], [-0.345, 0.15, 0.2], [-0.26, 0.142, 0.185]]) rel.push(cone([x, y0, 0.135], [x + 0.008, y1, 0.135], 0.016, 4));
  G.push(...rel.map((g) => both(g)));
  // 剑把（插于吻背上部内侧）：柄 + 剑格 + 扇形把头
  const HT = { r: [0, 0, 0.05], t: [-0.115, 0.8, 0] };
  const fan = [[-0.04, 0, 1], [0.04, 0, 1], [0.044, 0.12, 1]];
  for (let i = 0; i <= 10; i++) { const a = (12 + i * 15.6) * Math.PI / 180, r = i % 2 ? 0.066 : 0.084; fan.push([Math.cos(a) * r, 0.12 + Math.sin(a) * r * 0.95, i % 2]); }
  fan.push([-0.044, 0.12, 1]);
  G.push(xf(plate(fan, 0.036, { bev: 0.01 }), HT));
  G.push(xf(plate([[-0.05, 0, 1], [0.05, 0, 1], [0.05, 0.022, 1], [-0.05, 0.022, 1]], 0.044, { bev: 0.006, it: 0 }), { r: HT.r, t: [-0.115 - 0.006, 0.915, 0] })); // 把箍
  for (const a of [40, 70, 110, 140]) for (const dz of [0.035, -0.035]) {
    const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
    G.push(xf(rod([c * 0.02, 0.12 + sn * 0.02, dz], [c * 0.068, 0.12 + sn * 0.064, dz], 0.007, 0.005, 3), HT)); // 把头棱
  }
  // 背兽（朝 +X）
  G.push(ell([0.375, 0.45, 0], [0.07, 0.08, 0.09], 7, 5));
  G.push(ell([0.44, 0.43, 0], [0.042, 0.04, 0.062], 6, 4));
  G.push(...both(ell([0.425, 0.49, 0.045], [0.02, 0.02, 0.016], 5, 3)));
  G.push(...both(cone([0.385, 0.51, 0.045], [0.35, 0.585, 0.065], 0.024, 4)));
  G.push(ell([0.415, 0.39, 0], [0.036, 0.018, 0.048], 5, 3)); // 下颌
  // 统一缩放到单位高（吻身单独成部件以施鳞纹）
  const all = merge(flatAll(G));
  all.computeBoundingBox();
  const k = 1 / Math.max(all.boundingBox.max.y, 0.975);
  return { rest: all.scale(k, k, k), body: scaled.scale(k, k, k) };
}

// 鳞纹法线贴图（错位鱼鳞，可平铺）
registerTexture('orn_scale_normal', () => {
  const S = 128, c = canvas(S), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const n = 4, d = S / n, R = d * 0.7;
  for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
    const x = i * d + (j & 1 ? d / 2 : 0), y = j * d;
    const gr = g.createRadialGradient(x, y - R * 0.35, R * 0.1, x, y, R);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.8, '#999'); gr.addColorStop(1, '#555');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
  }
  const px = g.getImageData(0, 0, S, S).data;
  return normalFromHeight(S, (u, v) => px[(Math.floor(v * S) * S + Math.floor(u * S)) * 4] / 255, 2.5);
});
const scaleMats = new Set();
function scaleMat(col) {
  const key = `orn_scale_${col}`;
  if (!scaleMats.has(key)) {
    const m = getMaterial(glazeMat(col)).clone();
    const t = makeTexture('orn_scale_normal').clone();
    t.repeat.set(8, 8); t.needsUpdate = true;
    m.normalMap = t; m.normalScale = new THREE.Vector2(0.7, 0.7);
    defineMaterial(key, { material: m });
    scaleMats.add(key);
  }
  return key;
}

// ---------------- 走兽 ----------------
// 单位高 1，底 y=0（另有 y<0 的瓦座裙边，埋入脊身以填补斜脊落差），面朝 +Z，蹲坐
function seat() {
  const c = new THREE.CylinderGeometry(0.15, 0.15, 0.56, 5, 1, false, Math.PI / 2, Math.PI);
  c.rotateX(Math.PI / 2); c.translate(0, -0.04, 0);
  const g = new THREE.BoxGeometry(0.3, 0.16, 0.56); g.translate(0, -0.12, 0);
  return [c, g];
}
/** 通用蹲坐兽身：o.body 躯干宽倍率，o.lean 前倾，o.feet 后足 */
function quadBody(o = {}) {
  const k = o.body ?? 1;
  const L = [];
  L.push(ell([0, 0.2, -0.06], [0.15 * k, 0.135, 0.15], 7, 4)); // 后胯
  L.push(ell([0, 0.35, 0.02], [0.127 * k, 0.2, 0.13], 7, 5, [o.lean ?? 0.36, 0, 0])); // 胸躯
  for (const s of [1, -1]) {
    L.push(tube([[s * 0.075 * k, 0.36, 0.09], [s * 0.08 * k, 0.22, 0.13], [s * 0.08 * k, 0.1, 0.145]], 0.046, 0.036, { n: 3, rad: 5, cap: false }));
    L.push(ell([s * 0.08 * k, 0.095, 0.175], [0.045, 0.028, 0.058], 5, 3));
    if (o.feet !== false) L.push(ell([s * 0.13 * k, 0.11, 0.04], [0.042, 0.04, 0.08], 5, 3)); // 后足
  }
  return L;
}
/** 兽首：c 头心，r 头半径，sn 吻长 */
function beastHead(c, r = 0.1, sn = 0.08, { open = true, snR = 0.6 } = {}) {
  const [x, y, z] = c;
  const L = [ell(c, [r * 0.95, r, r], 7, 5)];
  L.push(ell([x, y - r * 0.25, z + r * 0.75 + sn * 0.4], [r * snR, r * 0.5, sn], 6, 4));
  if (open) L.push(ell([x, y - r * 0.68, z + r * 0.6 + sn * 0.3], [r * snR * 0.8, r * 0.18, sn * 0.85], 5, 3, [0.25, 0, 0]));
  for (const s of [1, -1]) L.push(ell([x + s * r * 0.5, y + r * 0.22, z + r * 0.78], [r * 0.24, r * 0.24, r * 0.18], 4, 3));
  return L;
}
const sym = (f) => [f(1), f(-1)];
const NC = { cap: false };

function buildBeast(k) {
  const L = [seat()];
  const tailDragon = (h = 0.6) => tube([[0, 0.16, -0.22], [0, 0.26, -0.33], [0, h - 0.1, -0.33], [0, h, -0.24], [0, h + 0.05, -0.17]], 0.04, 0.008, { n: 7, rad: 4, ...NC });
  const crest = (pts, hz = 0.012) => xf(plate(pts, hz, { bev: 0, it: 0 }), { r: [0, -Math.PI / 2, 0] }); // YZ 平面薄板（pts 为 [z,y]）
  const wing = (s, pts, ry = 0.25) => xf(plate(pts, 0.013, { bev: 0, it: 0 }), { r: [0, -Math.PI / 2 - s * ry, 0], t: [s * 0.13, 0, 0] });
  switch (+k) {
    case 0: { // 仙人骑凤
      L.push(ell([0, 0.2, 0.0], [0.12, 0.1, 0.19], 7, 4));
      L.push(tube([[0, 0.24, 0.14], [0, 0.32, 0.2], [0, 0.36, 0.24]], 0.045, 0.035, { n: 3, rad: 5, ...NC }));
      L.push(ell([0, 0.37, 0.25], [0.04, 0.042, 0.05], 5, 4));
      L.push(cone([0, 0.365, 0.28], [0, 0.35, 0.34], 0.018, 4));
      L.push(cone([0, 0.39, 0.25], [0, 0.44, 0.22], 0.02, 4)); // 凤冠
      for (const dx of [-0.05, 0, 0.05]) L.push(tube([[dx * 0.5, 0.22, -0.16], [dx, 0.3, -0.27], [dx * 1.4, 0.4, -0.3]], 0.03, 0.008, { n: 3, rad: 4, ...NC }));
      L.push(...sym((s) => wing(s, [[-0.12, 0.17], [0.1, 0.2], [0.02, 0.27], [-0.1, 0.3], [-0.16, 0.24]], 0.15)));
      // 仙人：袍、身、首、冠、拱手
      L.push(ell([0, 0.33, -0.01], [0.13, 0.07, 0.13], 7, 4));
      L.push(ell([0, 0.47, -0.01], [0.085, 0.14, 0.075], 7, 5));
      L.push(ell([0, 0.66, 0.0], [0.058, 0.066, 0.06], 6, 5));
      L.push(rod([0, 0.7, -0.005], [0, 0.8, -0.015], 0.04, 0.05, 6));
      L.push(xf(new THREE.BoxGeometry(0.14, 0.018, 0.035), { t: [0, 0.78, -0.03] }));
      L.push(...sym((s) => tube([[s * 0.075, 0.56, -0.01], [s * 0.08, 0.47, 0.05], [s * 0.02, 0.46, 0.1]], 0.035, 0.03, { n: 3, rad: 5, ...NC })));
      L.push(ell([0, 0.465, 0.11], [0.03, 0.028, 0.025], 4, 3));
      L.push(...sym((s) => ell([s * 0.09, 0.27, 0.05], [0.03, 0.05, 0.035], 4, 3)));
      break;
    }
    case 1: { // 龙：双角、鬣、张口、卷尾
      L.push(...quadBody());
      L.push(...beastHead([0, 0.66, 0.07], 0.095, 0.1, { snR: 0.55 }));
      L.push(...sym((s) => tube([[s * 0.04, 0.74, 0.05], [s * 0.07, 0.84, -0.03], [s * 0.065, 0.93, -0.09]], 0.02, 0.006, { n: 4, rad: 4, ...NC })));
      L.push(crest([[0.0, 0.7], [-0.12, 0.8], [-0.06, 0.66], [-0.17, 0.66], [-0.09, 0.56], [-0.2, 0.47], [-0.08, 0.45]]));
      L.push(tailDragon(0.62));
      break;
    }
    case 2: { // 凤：冠、喙、翼、长尾羽
      L.push(ell([0, 0.3, 0.0], [0.12, 0.16, 0.17], 7, 5, [0.6, 0, 0]));
      L.push(ell([0, 0.14, 0.02], [0.13, 0.08, 0.16], 6, 4));
      L.push(tube([[0, 0.4, 0.1], [0, 0.52, 0.13], [0, 0.6, 0.13]], 0.06, 0.04, { n: 3, rad: 5, ...NC }));
      L.push(ell([0, 0.63, 0.14], [0.05, 0.055, 0.065], 6, 4));
      L.push(cone([0, 0.625, 0.19], [0, 0.6, 0.26], 0.022, 4));
      L.push(...sym((s) => ell([s * 0.035, 0.645, 0.18], [0.014, 0.014, 0.01], 4, 3)));
      L.push(tube([[0, 0.66, 0.14], [0, 0.76, 0.12], [0, 0.82, 0.05], [0, 0.8, 0.0]], 0.026, 0.008, { n: 4, rad: 4, ...NC }));
      L.push(...sym((s) => wing(s, [[0.14, 0.42], [0.05, 0.5], [-0.12, 0.62], [-0.1, 0.52], [-0.2, 0.52], [-0.12, 0.42], [-0.22, 0.38], [-0.05, 0.22]], 0.2)));
      L.push(tube([[0, 0.18, -0.15], [0, 0.3, -0.3], [0, 0.62, -0.34], [0, 0.9, -0.26], [0, 0.95, -0.17]], 0.035, 0.01, { n: 6, rad: 4, ...NC }));
      L.push(...sym((s) => xf(plate([[-0.1, 0.18], [-0.28, 0.3], [-0.35, 0.55], [-0.31, 0.8], [-0.21, 0.96, 1], [-0.25, 0.8], [-0.17, 0.84, 1],
        [-0.22, 0.64], [-0.13, 0.66, 1], [-0.18, 0.46], [-0.08, 0.3]], 0.011, { bev: 0 }), { r: [0, -Math.PI / 2 - s * 0.3, 0], t: [s * 0.02, 0, 0] })));
      break;
    }
    case 3: { // 狮子：大头、卷鬃、短吻、尾簇
      L.push(...quadBody({ body: 1.08, feet: false }));
      L.push(ell([0, 0.63, 0.0], [0.155, 0.16, 0.11], 7, 5));
      for (let i = 0; i < 5; i++) { const a = -0.1 + (i / 4) * (Math.PI + 0.2); L.push(ell([Math.cos(a) * 0.145, 0.63 + Math.sin(a) * 0.145, 0.03], [0.05, 0.05, 0.045], 4, 3)); }
      L.push(...beastHead([0, 0.64, 0.08], 0.1, 0.06, { snR: 0.7 }));
      L.push(...sym((s) => ell([s * 0.085, 0.73, 0.06], [0.03, 0.035, 0.02], 4, 3)));
      L.push(tube([[0, 0.16, -0.22], [0, 0.32, -0.3], [0, 0.48, -0.26]], 0.03, 0.02, { n: 4, rad: 4, ...NC }));
      L.push(ell([0, 0.52, -0.25], [0.05, 0.06, 0.05], 5, 3));
      break;
    }
    case 4: // 天马：马首、立耳、鬃、双翼
    case 5: { // 海马：马首、鬃、腿侧火焰
      L.push(...quadBody({ body: 0.95 }));
      L.push(tube([[0, 0.48, 0.03], [0, 0.6, 0.05], [0, 0.68, 0.06]], 0.075, 0.06, { n: 3, rad: 5, ...NC }));
      L.push(ell([0, 0.71, 0.1], [0.06, 0.07, 0.085], 6, 4));
      L.push(ell([0, 0.66, 0.19], [0.048, 0.048, 0.09], 6, 4, [0.5, 0, 0]));
      L.push(...sym((s) => ell([s * 0.045, 0.73, 0.14], [0.014, 0.016, 0.012], 4, 3)));
      L.push(...sym((s) => cone([s * 0.03, 0.76, 0.07], [s * 0.04, 0.85, 0.05], 0.018, 4)));
      L.push(crest([[0.06, 0.8], [-0.04, 0.8], [0.0, 0.73], [-0.09, 0.71], [-0.03, 0.63], [-0.12, 0.58], [-0.04, 0.5], [-0.12, 0.44], [0.0, 0.45]]));
      L.push(tube([[0, 0.17, -0.22], [0, 0.18, -0.32], [0, 0.1, -0.36]], 0.035, 0.012, { n: 4, rad: 4, ...NC }));
      if (+k === 4) L.push(...sym((s) => wing(s, [[0.1, 0.38], [0.02, 0.5], [-0.12, 0.72], [-0.1, 0.6], [-0.2, 0.62], [-0.13, 0.5], [-0.24, 0.48], [-0.05, 0.32]], 0.3)));
      else L.push(...sym((s) => wing(s, [[0.12, 0.2], [0.06, 0.3], [-0.04, 0.38], [-0.02, 0.3], [-0.1, 0.32], [-0.04, 0.22], [-0.12, 0.2], [0.0, 0.16]], 0.05)));
      break;
    }
    case 6: { // 狻猊：火焰尖鬃放射
      L.push(...quadBody({ body: 0.95 }));
      L.push(...beastHead([0, 0.66, 0.07], 0.09, 0.07, { snR: 0.65 }));
      for (let i = 0; i < 7; i++) { const a = -0.1 + (i / 6) * (Math.PI + 0.2); L.push(cone([Math.cos(a) * 0.07, 0.66 + Math.sin(a) * 0.07, 0.0], [Math.cos(a) * 0.19, 0.66 + Math.sin(a) * 0.2, -0.07], 0.035, 4)); }
      L.push(tube([[0, 0.16, -0.22], [0, 0.3, -0.32], [0, 0.46, -0.28], [0, 0.5, -0.2], [0, 0.45, -0.17]], 0.035, 0.008, { n: 6, rad: 4, ...NC }));
      break;
    }
    case 7: { // 押鱼：鱼尾高翘、背鳍、独角
      L.push(...quadBody({ body: 0.95 }));
      L.push(...beastHead([0, 0.62, 0.08], 0.09, 0.09, { snR: 0.6 }));
      L.push(cone([0, 0.69, 0.06], [0, 0.82, 0.0], 0.022, 4));
      L.push(crest([[0.0, 0.6], [-0.1, 0.62], [-0.07, 0.52], [-0.17, 0.5], [-0.12, 0.4], [-0.22, 0.36], [-0.1, 0.3]]));
      L.push(tube([[0, 0.18, -0.2], [0, 0.32, -0.32], [0, 0.55, -0.36], [0, 0.72, -0.32]], 0.05, 0.022, { n: 5, rad: 5, ...NC }));
      L.push(xf(plate([[0, -0.03], [0.13, 0.17], [0.05, 0.13], [0, 0.2], [-0.05, 0.13], [-0.13, 0.17]], 0.013, { bev: 0, it: 0 }), { r: [0, -0.15, 0], t: [0, 0.73, -0.31] }));
      L.push(...sym((s) => wing(s, [[0.06, 0.4], [-0.02, 0.48], [-0.05, 0.4], [-0.1, 0.44], [-0.08, 0.34]], 0.15)));
      break;
    }
    case 8: { // 獬豸：独角、须
      L.push(...quadBody({ body: 0.95 }));
      L.push(...beastHead([0, 0.66, 0.07], 0.09, 0.08, { snR: 0.55, open: false }));
      L.push(tube([[0, 0.73, 0.08], [0, 0.85, 0.11], [0, 0.97, 0.17]], 0.03, 0.006, { n: 4, rad: 5, ...NC }));
      L.push(cone([0, 0.58, 0.14], [0, 0.48, 0.16], 0.028, 4));
      L.push(...sym((s) => cone([s * 0.07, 0.7, 0.03], [s * 0.14, 0.74, -0.03], 0.022, 4)));
      L.push(tube([[0, 0.16, -0.22], [0, 0.26, -0.3], [0, 0.4, -0.28]], 0.03, 0.01, { n: 4, rad: 4, ...NC }));
      L.push(ell([0, 0.43, -0.27], [0.04, 0.05, 0.04], 5, 3));
      break;
    }
    case 9: { // 斗牛：双弯角、背鳍、卷尾
      L.push(...quadBody({ body: 1.0 }));
      L.push(...beastHead([0, 0.64, 0.07], 0.095, 0.07, { snR: 0.7 }));
      L.push(...sym((s) => tube([[s * 0.05, 0.71, 0.05], [s * 0.15, 0.74, 0.03], [s * 0.19, 0.83, 0.0], [s * 0.15, 0.92, -0.03]], 0.026, 0.006, { n: 5, rad: 4, ...NC })));
      L.push(crest([[-0.05, 0.62], [-0.14, 0.62], [-0.1, 0.52], [-0.19, 0.48], [-0.12, 0.4], [-0.21, 0.33], [-0.1, 0.3]]));
      L.push(tailDragon(0.5));
      break;
    }
    case 10: { // 行什：猴面雷公嘴、背生双翼、持金刚杵
      L.push(ell([0, 0.17, -0.04], [0.14, 0.1, 0.14], 7, 4));
      L.push(...sym((s) => ell([s * 0.09, 0.18, 0.08], [0.05, 0.06, 0.1], 5, 4)));
      L.push(ell([0, 0.39, -0.02], [0.105, 0.17, 0.085], 7, 5, [0.1, 0, 0]));
      L.push(ell([0, 0.62, 0.0], [0.075, 0.08, 0.075], 7, 5));
      L.push(cone([0, 0.6, 0.06], [0, 0.55, 0.17], 0.04, 5)); // 雷公嘴
      L.push(...sym((s) => ell([s * 0.035, 0.645, 0.065], [0.018, 0.018, 0.012], 4, 3)));
      L.push(...sym((s) => cone([s * 0.05, 0.66, -0.01], [s * 0.1, 0.72, -0.04], 0.02, 4)));
      L.push(...sym((s) => tube([[s * 0.09, 0.5, -0.01], [s * 0.1, 0.4, 0.06], [s * 0.03, 0.38, 0.11]], 0.03, 0.026, { n: 3, rad: 5, ...NC })));
      L.push(rod([0, 0.28, 0.12], [0, 0.5, 0.12], 0.014, 0.014, 5));
      L.push(ell([0, 0.39, 0.12], [0.03, 0.04, 0.03], 5, 3));
      L.push(cone([0, 0.47, 0.12], [0, 0.55, 0.12], 0.025, 4)); L.push(cone([0, 0.31, 0.12], [0, 0.23, 0.12], 0.025, 4));
      L.push(...sym((s) => xf(plate([[0, 0], [0.06, 0.08], [0.18, 0.36], [0.1, 0.3], [0.13, 0.42], [0.04, 0.3], [0.05, 0.4], [-0.03, 0.18]], 0.012, { bev: 0, it: 0 }),
        { r: [-0.25, s * 0.5, s * -0.35], t: [s * 0.04, 0.42, -0.08] })));
      break;
    }
    default: L.push(...quadBody(), ...beastHead([0, 0.66, 0.07], 0.095, 0.08));
  }
  return fitH(L);
}

// ---------------- 垂兽 / 戗兽 ----------------
// 单位高 1，底 y=0（兽座向下有裙边），面朝 +Z；兽头张口、双角后扬、火焰鬃
function buildChuishou() {
  const L = [];
  L.push(plate([[-0.38, -0.2, 1], [0.3, -0.2, 1], [0.3, 0.12, 1], [-0.38, 0.12, 1]], 0.19, { bev: 0.02, it: 0 }).rotateY(-Math.PI / 2)); // 兽座（沿 Z）
  L.push(ell([0, 0.3, -0.06], [0.2, 0.22, 0.24], 7, 5)); // 颈
  L.push(ell([0, 0.52, 0.06], [0.2, 0.19, 0.19], 8, 6)); // 头
  L.push(ell([0, 0.5, 0.24], [0.13, 0.09, 0.12], 7, 4)); // 上吻
  L.push(tube([[-0.1, 0.52, 0.32], [0, 0.56, 0.36], [0.1, 0.52, 0.32]], 0.03, 0.03, { n: 4, rad: 4, ...NC })); // 卷鼻
  L.push(ell([0, 0.36, 0.2], [0.1, 0.035, 0.11], 6, 4, [0.3, 0, 0])); // 下颌
  L.push(ell([0, 0.41, 0.17], [0.09, 0.05, 0.06], 5, 3)); // 口内
  L.push(...both(ell([0.1, 0.6, 0.18], [0.055, 0.055, 0.04], 6, 5), 0)); // 眼
  L.push(...both(tube([[0.03, 0.66, 0.22], [0.1, 0.68, 0.2], [0.17, 0.64, 0.12], [0.2, 0.66, 0.03]], 0.025, 0.01, { n: 5, rad: 4, ...NC }), 0)); // 眉
  L.push(...both(ell([0.055, 0.53, 0.34], [0.025, 0.022, 0.02], 4, 3), 0)); // 鼻孔
  L.push(...both(cone([0.08, 0.44, 0.27], [0.085, 0.38, 0.28], 0.018, 4), 0)); // 獠牙
  L.push(...both(cone([0.06, 0.37, 0.27], [0.064, 0.42, 0.28], 0.014, 4), 0));
  L.push(...both(tube([[0.07, 0.68, 0.05], [0.12, 0.8, -0.05], [0.13, 0.92, -0.18], [0.1, 0.99, -0.3]], 0.04, 0.008, { n: 6, rad: 5, ...NC }), 0)); // 角
  L.push(...both(cone([0.17, 0.56, 0.02], [0.27, 0.6, -0.08], 0.04, 5), 0)); // 耳
  // 火焰鬃（脑后两侧 + 中脊）
  L.push(...both(xf(plate([[0.05, 0.3], [-0.1, 0.27], [-0.05, 0.36], [-0.22, 0.38], [-0.1, 0.46], [-0.27, 0.53], [-0.12, 0.57], [-0.2, 0.69], [-0.04, 0.63], [0.04, 0.5]], 0.02, { bev: 0, it: 0 }),
    { r: [0, -Math.PI / 2 - 0.45, 0], t: [0.15, 0, 0.0] }), 0));
  L.push(xf(plate([[0.05, 0.62], [-0.12, 0.78], [-0.1, 0.64], [-0.26, 0.66], [-0.16, 0.52], [-0.32, 0.46], [-0.12, 0.38]], 0.025, { bev: 0, it: 0 }), { r: [0, -Math.PI / 2, 0] }));
  // 腮须卷
  L.push(...both(tube([[0.16, 0.42, 0.1], [0.2, 0.36, 0.05], [0.23, 0.4, 0.0], [0.2, 0.44, -0.02]], 0.022, 0.008, { n: 5, rad: 4, ...NC }), 0));
  return fitH(L);
}

// ---------------- 套兽 ----------------
// 套于仔角梁端：后部 z=0、向 +Z 伸出约 1，竖向以 y=0 为中心，兽头张口
function buildTaoshou() {
  const L = [];
  L.push(xf(plate([[-0.3, -0.3, 1], [0.3, -0.3, 1], [0.3, 0.3, 1], [-0.3, 0.3, 1]], 0.25, { bev: 0.05, segs: 2, it: 0 }), { t: [0, 0, 0.25] })); // 套筒
  L.push(ell([0, 0.03, 0.52], [0.31, 0.29, 0.25], 8, 5)); // 头
  L.push(ell([0, 0.04, 0.78], [0.2, 0.12, 0.16], 7, 4)); // 上吻
  L.push(tube([[-0.14, 0.06, 0.88], [0, 0.11, 0.94], [0.14, 0.06, 0.88]], 0.04, 0.04, { n: 4, rad: 4, ...NC })); // 卷鼻
  L.push(ell([0, -0.19, 0.72], [0.15, 0.05, 0.17], 6, 4, [0.35, 0, 0])); // 下颌
  L.push(ell([0, -0.1, 0.72], [0.13, 0.06, 0.08], 5, 3)); // 口内
  L.push(...both(ell([0.13, 0.17, 0.72], [0.07, 0.065, 0.05], 5, 4), 0)); // 眼
  L.push(...both(tube([[0.04, 0.24, 0.78], [0.14, 0.27, 0.74], [0.25, 0.22, 0.62]], 0.03, 0.012, { n: 4, rad: 3, ...NC }), 0)); // 眉
  L.push(...both(cone([0.1, -0.03, 0.82], [0.105, -0.13, 0.83], 0.022, 4), 0)); // 獠牙
  L.push(...both(cone([0.26, 0.16, 0.48], [0.4, 0.24, 0.36], 0.05, 5), 0)); // 耳
  L.push(...both(tube([[0.1, 0.27, 0.55], [0.13, 0.34, 0.42], [0.11, 0.38, 0.3]], 0.035, 0.008, { n: 4, rad: 3, ...NC }), 0)); // 角
  L.push(...both(tube([[0.22, -0.06, 0.66], [0.3, -0.12, 0.56], [0.32, -0.04, 0.48], [0.27, 0.0, 0.48]], 0.03, 0.01, { n: 4, rad: 3, ...NC }), 0)); // 腮须
  return merge(flatAll(L));
}

// ---------------- 宝顶 ----------------
// 单位高 1，底 y=0。gold：琉璃须弥座 + 鎏金仰莲宝珠；yellow/green/blue/black：琉璃须弥座 + 宝珠；tiered[:色]：多层（座-莲-珠-伞-莲-金珠）
function lathe(pts, seg) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  return creased(g, 0.6);
}
/** 莲瓣环：r0→r1 由 y0 到 y1，n 瓣（径向扇贝起伏） */
function lotus(r0, r1, y0, y1, n, seg, rIn = r1 * 0.72) {
  const rows = 3, pos = [], idx = [];
  for (let i = 0; i <= rows + 1; i++) {
    const t = Math.min(i / rows, 1), y = y0 + (y1 - y0) * t;
    const base = r0 + (r1 - r0) * Math.sin(t * Math.PI / 2);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      const ph = Math.abs(Math.cos((a * n) / 2));
      if (i > rows) { pos.push(Math.sin(a) * rIn, y1 - (y1 - y0) * 0.3, Math.cos(a) * rIn); continue; } // 内收封口
      const r = base * (1 + 0.14 * ph * Math.sin(t * Math.PI * 0.8)) * (t === 1 ? 0.97 + 0.03 * ph : 1);
      pos.push(Math.sin(a) * r, y - (t === 1 ? (1 - ph) ** 0.7 * (y1 - y0) * 0.55 : 0), Math.cos(a) * r);
    }
  }
  for (let i = 0; i <= rows; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = (i + 1) * seg + j, c = (i + 1) * seg + ((j + 1) % seg), d = i * seg + ((j + 1) % seg);
    idx.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function ball(cy, r, seg, yTop, rows = 9) {
  const pts = [];
  for (let i = 0; i <= rows; i++) { const a = -Math.PI / 2 + (i / rows) * Math.PI; pts.push([Math.cos(a) * r, cy + Math.sin(a) * r]); }
  if (yTop) pts.push([0.02, yTop - 0.03], [0.001, yTop]);
  return lathe(pts, seg);
}
/** 须弥座：自 y0 起高 h，最大半径 R（圭角-下枋-下枭-束腰-上枭-上枋） */
function xumi(R, y0, h, seg = 16) {
  return lathe([[R, y0], [R, y0 + 0.12 * h], [R * 0.93, y0 + 0.16 * h], [R * 0.86, y0 + 0.3 * h], [R * 0.76, y0 + 0.36 * h],
    [R * 0.76, y0 + 0.62 * h], [R * 0.86, y0 + 0.68 * h], [R * 0.95, y0 + 0.84 * h], [R, y0 + 0.88 * h], [R, y0 + h], [0.001, y0 + h]], seg);
}
function buildBaoding(style, col) {
  if (style === 'gold') {
    const base = merge([xumi(0.34, 0, 0.26), lathe([[0.26, 0.26], [0.22, 0.29], [0.2, 0.31], [0.001, 0.31]], 16)]);
    const gold = merge([
      lotus(0.17, 0.27, 0.3, 0.42, 12, 24),
      lathe([[0.001, 0.4], [0.25, 0.4], [0.235, 0.42], [0.17, 0.44], [0.001, 0.45]], 20),
      ball(0.69, 0.27, 20, 1.0, 8),
    ]);
    return [{ mat: glazeMat('yellow'), geo: base }, { mat: 'gold', geo: gold }];
  }
  if (style === 'tiered') {
    const glaze = merge([
      xumi(0.36, 0, 0.22, 14),
      lotus(0.2, 0.3, 0.22, 0.32, 12, 18),
      lathe([[0.22, 0.31], [0.29, 0.31], [0.29, 0.335], [0.18, 0.35], [0.14, 0.37], [0.001, 0.37]], 14),
      ball(0.47, 0.13, 12, 0, 6),
      lathe([[0.06, 0.58], [0.2, 0.6], [0.2, 0.625], [0.12, 0.64], [0.001, 0.64]], 12), // 伞盖
      lotus(0.08, 0.15, 0.63, 0.7, 6, 12),
    ]);
    const gold = merge([ball(0.8, 0.12, 12, 1.0, 7), lathe([[0.1, 0.68], [0.06, 0.7], [0.001, 0.7]], 12)]);
    return [{ mat: glazeMat(col || 'yellow'), geo: glaze }, { mat: 'gold', geo: gold }];
  }
  const geo = merge([
    xumi(0.34, 0, 0.36),
    lotus(0.16, 0.25, 0.36, 0.46, 10, 20),
    lathe([[0.001, 0.44], [0.24, 0.44], [0.21, 0.47], [0.15, 0.49], [0.11, 0.5], [0.001, 0.5]], 16),
    ball(0.72, 0.24, 18, 1.0),
  ]);
  return [{ mat: glazeMat(style), geo }];
}

// ---------------- 瓦当 + 滴水 ----------------
// 瓦当圆盘直径 1、中心在原点、正面朝 +Z（z≈0），筒瓦身向 -Z；下附三角形滴水（略外倾）
function buildWadang() {
  const disc = new THREE.LatheGeometry([
    [0.5, -0.3], [0.5, 0.045], [0.41, 0.045], [0.39, 0.0], [0.2, 0.0], [0.001, 0.05],
  ].map(([r, y]) => new THREE.Vector2(r, y)), 10);
  disc.rotateX(Math.PI / 2);
  const d = creased(disc, 0.7);
  const drip = plate([[-0.62, -0.5], [0.62, -0.5], [0.3, -0.72], [0, -0.98], [-0.3, -0.72]], 0.03, { bev: 0, it: 0, z: -0.02 });
  return merge([d, xf(drip, { r: [-0.25, 0, 0], t: [0, 0.12, -0.12] })]);
}

// ---------------- 注册 ----------------
registerProtoFamily('wen', (key, [col = 'yellow']) => {
  const { rest, body } = buildWen();
  return [{ mat: glazeMat(col), geo: rest }, { mat: scaleMat(col), geo: body }];
});
const BUILD = {
  beast: ([k = '1']) => buildBeast(k),
  chuishou: () => buildChuishou(),
  taoshou: () => buildTaoshou(),
  wadang: () => buildWadang(),
};
for (const [name, fn] of Object.entries(BUILD)) {
  registerProtoFamily(name, (key, args) => {
    const col = (name === 'beast' ? args[1] : args[0]) || 'yellow';
    return [{ mat: glazeMat(col), geo: fn(args) }];
  });
}
registerProtoFamily('baoding', (key, [style = 'gold', col]) => buildBaoding(style, col));

/** 原型三角形数（自检用），key 同原型 key */
export function ornamentTriCount(key) {
  const [p, ...a] = key.split(':');
  const geos = p === 'baoding' ? buildBaoding(a[0] || 'gold', a[1]).map((q) => q.geo) : p === 'wen' ? Object.values(buildWen()) : BUILD[p] ? [BUILD[p](a)] : [];
  return geos.reduce((s, g) => s + (g.index ? g.index.count : g.attributes.position.count) / 3, 0);
}
