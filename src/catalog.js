// 构件测试台：catalog.html?t=<测试名>&cam=x,y,z&tgt=x,y,z
// 测试模块 src/tests/<名>.js 默认导出 build(ctx, api)，返回 { cam:[x,y,z], tgt:[x,y,z], shadowRadius? }
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Batcher, Ctx } from './core/batcher.js';
import { createRenderer, createEnvironment } from './core/env.js';
import { getMaterial } from './core/materials.js';

const q = new URLSearchParams(location.search);
const vec = (s) => (s ? s.split(',').map(Number) : null);
const info = document.getElementById('info');

const renderer = createRenderer(document.body, { preserveDrawingBuffer: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 20000);
const env = createEnvironment(renderer, scene, {});
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;

if (q.get('ground') !== '0') {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), getMaterial('paving'));
  const uv = g.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4000, uv.getY(i) * 4000);
  g.receiveShadow = true;
  g.position.y = -0.01;
  scene.add(g);
}

async function main() {
  const name = q.get('t') || 'smoke';
  const mod = await import(`./tests/${name}.js`);
  const batcher = new Batcher(name);
  const ctx = new Ctx(batcher);
  const t0 = performance.now();
  const res = (await mod.default(ctx, { THREE, scene, camera, renderer })) || {};
  const group = batcher.build();
  scene.add(group);
  const ms = performance.now() - t0;
  const cam = vec(q.get('cam')) || res.cam || [30, 20, 40];
  const tgt = vec(q.get('tgt')) || res.tgt || [0, 5, 0];
  setView(cam, tgt);
  env.updateShadowFocus(new THREE.Vector3(...tgt), res.shadowRadius || 120);
  let tris = 0, calls = 0;
  group.traverse((o) => { if (o.isMesh) { calls++; const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; tris += n * (o.isInstancedMesh ? o.count : 1); } });
  info.textContent = `${name}  build ${ms.toFixed(0)}ms  tris ${(tris / 1000).toFixed(1)}k  meshes ${calls}`;
  window.__stats = { tris, calls, ms };
  let frames = 0;
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    if (++frames === 4) window.__ready = true;
  });
}

function setView(cam, tgt) {
  camera.position.set(...cam);
  controls.target.set(...tgt);
  camera.lookAt(...tgt);
  controls.update();
}
window.__setView = (cam, tgt) => { setView(cam, tgt); env.updateShadowFocus(new THREE.Vector3(...tgt), 120); };

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
main().catch((e) => { info.textContent = 'ERROR: ' + e.message; console.error(e); window.__error = String(e.stack || e); window.__ready = true; });
