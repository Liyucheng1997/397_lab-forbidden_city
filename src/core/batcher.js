// 几何批处理：按材质合并几何体以减少 draw call；重复构件（斗拱、走兽、望柱……）走 InstancedMesh
import * as THREE from 'three';
import { getMaterial, materialUsesVertexColor } from './materials.js';
import { getProto } from './protos.js';

const _nm = new THREE.Matrix3();
const _v = new THREE.Vector3();

export class Batcher {
  constructor(name = 'batch') {
    this.name = name;
    this.lists = new Map(); // matKey -> [{pos, nor, uv, col, idx}]
    this.instances = new Map(); // protoKey -> [Matrix4]
    this.triCount = 0;
  }

  /** 加入几何体（geometry 不会被修改），matrix 为局部->世界矩阵 */
  addGeometry(matKey, geo, matrix) {
    if (!geo) return;
    const pa = geo.attributes.position;
    if (!pa || pa.count === 0) return;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const na = geo.attributes.normal, ua = geo.attributes.uv, ca = geo.attributes.color;
    const n = pa.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    _nm.getNormalMatrix(matrix);
    const e = matrix.elements;
    for (let i = 0; i < n; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      pos[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      pos[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      pos[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      _v.set(na.getX(i), na.getY(i), na.getZ(i)).applyMatrix3(_nm).normalize();
      nor[i * 3] = _v.x; nor[i * 3 + 1] = _v.y; nor[i * 3 + 2] = _v.z;
      if (ua) { uv[i * 2] = ua.getX(i); uv[i * 2 + 1] = ua.getY(i); }
    }
    let col = null;
    if (materialUsesVertexColor(matKey)) {
      col = new Float32Array(n * 3);
      if (ca) for (let i = 0; i < n; i++) { col[i * 3] = ca.getX(i); col[i * 3 + 1] = ca.getY(i); col[i * 3 + 2] = ca.getZ(i); }
      else col.fill(1);
    }
    let idx;
    if (geo.index) idx = Uint32Array.from(geo.index.array);
    else { idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; }
    if (matrix.determinant() < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    if (!this.lists.has(matKey)) this.lists.set(matKey, []);
    this.lists.get(matKey).push({ pos, nor, uv, col, idx });
    this.triCount += idx.length / 3;
  }

  addInstance(protoKey, matrix) {
    if (!this.instances.has(protoKey)) this.instances.set(protoKey, []);
    this.instances.get(protoKey).push(matrix.clone());
  }

  /** 生成 THREE.Group（每个材质一个合并网格，每个原型部件一个 InstancedMesh） */
  build({ castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    group.name = this.name;
    for (const [matKey, list] of this.lists) {
      let nv = 0, ni = 0;
      for (const g of list) { nv += g.pos.length / 3; ni += g.idx.length; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
      const useCol = list[0].col !== null;
      const col = useCol ? new Float32Array(nv * 3) : null;
      const idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      for (const g of list) {
        pos.set(g.pos, vo * 3); nor.set(g.nor, vo * 3); uv.set(g.uv, vo * 2);
        if (useCol) col.set(g.col, vo * 3);
        for (let i = 0; i < g.idx.length; i++) idx[io + i] = g.idx[i] + vo;
        vo += g.pos.length / 3; io += g.idx.length;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (useCol) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      const mat = getMaterial(matKey);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `${this.name}:${matKey}`;
      mesh.castShadow = castShadow && !mat.userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    for (const [protoKey, mats0] of this.instances) {
      const proto = getProto(protoKey);
      if (!proto) { console.warn('missing proto', protoKey); continue; }
      const lodDist = detailDistance(protoKey);
      // 细部原型按空间网格分块：利于视锥裁剪与距离 LOD
      const chunks = new Map();
      if (lodDist < Infinity) {
        for (const m of mats0) {
          const k = `${Math.floor(m.elements[12] / CHUNK)},${Math.floor(m.elements[14] / CHUNK)}`;
          if (!chunks.has(k)) chunks.set(k, []);
          chunks.get(k).push(m);
        }
      } else chunks.set('all', mats0);
      for (const mats of chunks.values()) {
        for (const part of proto.parts) {
          const mat = getMaterial(part.mat);
          const im = new THREE.InstancedMesh(part.geo, mat, mats.length);
          for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          im.castShadow = castShadow && !mat.userData.noShadow && lodDist === Infinity;
          im.receiveShadow = receiveShadow;
          im.name = `${this.name}:${protoKey}:${part.mat}`;
          im.matrixAutoUpdate = false;
          if (lodDist < Infinity) { im.userData.lodDist = lodDist; LOD_MESHES.push(im); }
          group.add(im);
          this.triCount += ((part.geo.index ? part.geo.index.count : part.geo.attributes.position.count) / 3) * mats.length;
        }
      }
    }
    this.lists.clear();
    this.instances.clear();
    return group;
  }
}

// ---------- 细部距离 LOD ----------
const CHUNK = 100;
const LOD_MESHES = [];
const DETAIL = [
  [/^dougong/, 300], [/^beast/, 240], [/^taoshou/, 260], [/^chuishou/, 420], [/^wadang/, 160],
  [/^op_(stud|pushou|ring)/, 140], [/^zhuchu/, 220], [/^pf_(post|panel|chishou|baogu)/, 650],
  [/^(lion|vat|sundial|jialiang|tortoise|crane|censer|lamp)/, 500],
];
function detailDistance(key) {
  for (const [re, d] of DETAIL) if (re.test(key)) return d;
  return Infinity;
}
const _sp = new THREE.Sphere();
/** 每帧调用：按相机距离显隐细部实例（距离以分块包围球表面计） */
export function updateLOD(camera, scale = 1) {
  const cp = camera.position;
  for (const m of LOD_MESHES) {
    if (!m.boundingSphere) continue;
    const d = cp.distanceTo(m.boundingSphere.center) - m.boundingSphere.radius;
    m.visible = d < m.userData.lodDist * scale;
  }
}

const _tmp = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

/** 建造上下文：持有当前局部->世界矩阵，所有构件函数都接收 ctx 并在其局部坐标中造型 */
export class Ctx {
  constructor(batcher, matrix = new THREE.Matrix4()) {
    this.batcher = batcher;
    this.m = matrix;
  }
  /** 子坐标系：平移 (x,y,z)，绕 Y 旋转 rotY，可选均匀/非均匀缩放 */
  at(x = 0, y = 0, z = 0, rotY = 0, scale = 1) {
    _p.set(x, y, z);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    if (typeof scale === 'number') _s.set(scale, scale, scale); else _s.set(scale[0], scale[1], scale[2]);
    _tmp.compose(_p, _q, _s);
    return new Ctx(this.batcher, this.m.clone().multiply(_tmp));
  }
  /** 子坐标系：任意矩阵 */
  mul(m4) { return new Ctx(this.batcher, this.m.clone().multiply(m4)); }
  /** 子坐标系：欧拉旋转 (rx, ry, rz)，顺序 YXZ */
  rot(rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    _tmp.makeRotationFromEuler(_e);
    return new Ctx(this.batcher, this.m.clone().multiply(_tmp));
  }
  add(matKey, geo, local) {
    this.batcher.addGeometry(matKey, geo, local ? this.m.clone().multiply(local) : this.m);
  }
  inst(protoKey, local) {
    this.batcher.addInstance(protoKey, local ? this.m.clone().multiply(local) : this.m);
  }
  /** 便捷：在 (x,y,z) 放置原型，绕 Y 转 rotY，缩放 s（数或 [sx,sy,sz]） */
  place(protoKey, x, y, z, rotY = 0, s = 1) {
    _p.set(x, y, z);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    if (typeof s === 'number') _s.set(s, s, s); else _s.set(s[0], s[1], s[2]);
    _tmp.compose(_p, _q, _s);
    this.inst(protoKey, _tmp);
  }
  /** 便捷：将几何体平移到 (x,y,z)，绕 Y 转 rotY 后加入 */
  addAt(matKey, geo, x, y, z, rotY = 0) {
    _p.set(x, y, z);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    _s.set(1, 1, 1);
    _tmp.compose(_p, _q, _s);
    this.add(matKey, geo, _tmp.clone());
  }
}
