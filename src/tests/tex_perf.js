import { makeTexture } from '../core/textures.js';
import { allMaterialKeys, getMaterial } from '../core/materials.js';
export default function build() {
  const t0 = performance.now(), rows = [];
  for (const k of allMaterialKeys()) { const t = performance.now(); getMaterial(k); rows.push([k, performance.now() - t]); }
  rows.sort((a, b) => b[1] - a[1]);
  console.error('TOTAL ' + (performance.now() - t0).toFixed(0) + 'ms :: ' + rows.slice(0, 22).map(([k, t]) => k + ' ' + t.toFixed(0)).join(', '));
  return {};
}
