// 紫禁城三维全景 — 主程序
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createRenderer, createEnvironment } from './core/env.js';
import { buildWorld } from './site/world.js';
import { updateLOD } from './core/batcher.js';
import { updateWater } from './core/nature.js';
import { VIEWS } from './ui/views.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const q = new URLSearchParams(location.search);
const vec = (s) => (s ? s.split(',').map(Number) : null);
const isShot = q.has('shot');

const renderer = createRenderer(document.body, { preserveDrawingBuffer: isShot });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 12000);
const env = createEnvironment(renderer, scene, {});
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = !isShot;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 4;
controls.maxDistance = 3500;

// ---- 后期：GTAO 环境光遮蔽 + MSAA ----
let composer = null, gtao = null;
function setupComposer() {
  const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, w, h);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.5, thickness: 2.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 });
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
}
let aoOn = q.get('ao') !== '0';
if (aoOn) setupComposer();
window.__setAO = (on) => { aoOn = on; if (on && !composer) setupComposer(); };

function setView(cam, tgt) {
  camera.position.set(...cam);
  controls.target.set(...tgt);
  controls.update();
}
const v0 = VIEWS[q.get('view') || 'overview'] || VIEWS.overview;
setView(vec(q.get('cam')) || v0.cam, vec(q.get('tgt')) || v0.tgt);
window.__setView = setView;

const bar = document.getElementById('bar'), stage = document.getElementById('stage');
const only = q.get('only') ? q.get('only').split(',') : null;
let world = null;
let uiUpdate = null;
buildWorld(scene, { only, onProgress: (s, p) => { stage.textContent = s; bar.style.width = `${(p * 100).toFixed(0)}%`; } })
  .then((w) => {
    world = w;
    window.__stats = { ...w.stats, landmarks: w.landmarks.length };
    console.log('world', JSON.stringify(window.__stats));
    if (q.has('stats')) {
      const by = new Map();
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
        const key = o.name.split(':').slice(1).join(':').replace(/:[a-z_]+$/i, (m) => (o.isInstancedMesh ? '' : m)) || o.name;
        const k = (o.isInstancedMesh ? 'I ' : 'M ') + key.split(':').slice(0, o.isInstancedMesh ? 2 : 1).join(':');
        by.set(k, (by.get(k) || 0) + n);
      });
      const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
      console.error('TRIS ' + top.map(([k, v]) => `${k}=${(v / 1e6).toFixed(2)}M`).join(' | '));
    }
    document.getElementById('loading').style.opacity = 0;
    setTimeout(() => document.getElementById('loading').remove(), 700);
    if (!isShot || q.get('ui') === '1') import('./ui/app.js').then((m) => { uiUpdate = m.initUI({ scene, camera, controls, renderer, world, env, setView }); }).catch((e) => console.warn('ui', e));
  })
  .catch((e) => { console.error(e); window.__error = String(e.stack || e); window.__ready = true; });

const clock = new THREE.Clock();
let frames = 0;
const ft = [];
let lastT = performance.now();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (controls.enabled) controls.update();
  const dist = camera.position.distanceTo(controls.target);
  env.updateShadowFocus(controls.target, THREE.MathUtils.clamp(dist * 0.9, 60, 600));
  updateWater(t);
  if (uiUpdate) uiUpdate();
  updateLOD(camera, q.has('lod') ? +q.get('lod') : 1);
  if (aoOn && composer) composer.render(); else renderer.render(scene, camera);
  const now = performance.now();
  ft.push(now - lastT); lastT = now;
  if (ft.length > 60) ft.shift();
  window.__fps = 1000 / (ft.reduce((a, b) => a + b, 0) / ft.length);
  window.__drawCalls = renderer.info.render.calls;
  window.__frameTris = renderer.info.render.triangles;
  if (world && ++frames === 6) window.__ready = true;
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  if (composer) { composer.setSize(innerWidth, innerHeight); gtao.setSize(innerWidth, innerHeight); }
});
