// 原型注册表：重复出现的复杂小构件（斗拱、吻兽、走兽、望柱、铜缸……）
// 工厂函数返回 [{ mat: 材质key, geo: BufferGeometry }]，按单位尺寸建模，调用方用矩阵缩放/定位。
// 同一原型的所有实例合并为一个 InstancedMesh（每个材质部件一个）。

import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';

const factories = new Map();
const simplifier = new SimplifyModifier();
/** 低模版本：key 以 '@lo' 结尾时，对原型各部件做网格简化（保留约 35% 顶点） */
function simplifyParts(parts, keep = 0.35) {
  return parts.map((p) => {
    try {
      const n = p.geo.attributes.position.count;
      if (n < 60) return p;
      const g = simplifier.modify(p.geo, Math.floor(n * (1 - keep)));
      if (!g.attributes.normal) g.computeVertexNormals();
      return { ...p, geo: g };
    } catch (e) { return p; }
  });
}
const cache = new Map();

export function registerProto(key, factory) {
  factories.set(key, factory);
  cache.delete(key);
}

/** 按前缀注册参数化原型：registerProtoFamily('beast', (key, args) => parts)，key 形如 'beast:3:yellow' */
const families = new Map();
export function registerProtoFamily(prefix, factory) {
  families.set(prefix, factory);
}

export function getProto(key) {
  if (cache.has(key)) return cache.get(key);
  let parts = null;
  if (key.endsWith('@lo')) {
    const base = getProto(key.slice(0, -3));
    if (!base) return null;
    parts = simplifyParts(base.parts.map((p) => ({ mat: p.mat, geo: p.geo })));
    const proto = { key, parts };
    cache.set(key, proto);
    return proto;
  }
  if (factories.has(key)) parts = factories.get(key)();
  else {
    const [prefix, ...args] = key.split(':');
    if (families.has(prefix)) parts = families.get(prefix)(key, args);
  }
  if (!parts) return null;
  for (const p of parts) {
    if (!p.geo.attributes.normal) p.geo.computeVertexNormals();
    p.geo.computeBoundingSphere();
  }
  const proto = { key, parts };
  cache.set(key, proto);
  return proto;
}

export function hasProto(key) {
  if (factories.has(key)) return true;
  return families.has(key.split(':')[0]);
}
