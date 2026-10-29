// 渲染环境：渲染器、天空、日光、阴影、环境光照（主程序与测试台共用）
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { setEnvMap } from './materials.js';
import { SUN } from '../config.js';

export function createRenderer(canvasParent = document.body, { preserveDrawingBuffer = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer, logarithmicDepthBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasParent.appendChild(renderer.domElement);
  return renderer;
}

/** 天空 + 太阳 + 半球光 + 环境贴图。返回 { sun, sky, updateShadowFocus(target, radius) } */
export function createEnvironment(renderer, scene, { shadowRadius = 220, sun = SUN } = {}) {
  const sky = new Sky();
  sky.scale.setScalar(20000);
  const u = sky.material.uniforms;
  // 天空亮度增益（原始 Sky 着色器偏亮，经 ACES 后发白）
  u.skyGain = { value: 0.5 };
  sky.material.fragmentShader = 'uniform float skyGain;\n' + sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
  u.turbidity.value = 2.6;
  u.rayleigh.value = 1.15;
  u.mieCoefficient.value = 0.003;
  u.mieDirectionalG.value = 0.86;
  const phi = THREE.MathUtils.degToRad(90 - sun.elevationDeg);
  const theta = THREE.MathUtils.degToRad(sun.azimuthDeg);
  // 方位角：0=北(-Z)，90=东(+X)，180=南(+Z)
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, 0);
  sunDir.set(Math.sin(theta) * Math.sin(phi), Math.cos(phi), -Math.cos(theta) * Math.sin(phi));
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // 环境贴图：从天空生成
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky2 = new Sky();
  sky2.scale.setScalar(1000);
  for (const k of Object.keys(u)) if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = u[k].value;
  envScene.add(sky2);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7a7468 }));
  ground.position.y = -1;
  envScene.add(ground);
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  setEnvMap(envRT.texture);

  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x8a7a62, 0.55);
  scene.add(hemi);

  const light = new THREE.DirectionalLight(0xfff1dc, 3.2);
  light.castShadow = true;
  light.shadow.mapSize.set(4096, 4096);
  light.shadow.bias = -0.0004;
  light.shadow.normalBias = 0.04;
  const cam = light.shadow.camera;
  cam.near = 1; cam.far = 3000;
  scene.add(light);
  scene.add(light.target);

  scene.fog = new THREE.FogExp2(0xbfcfdc, 0.00024);

  function updateShadowFocus(target, radius = shadowRadius) {
    light.target.position.copy(target);
    light.position.copy(target).addScaledVector(sunDir, 1200);
    cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
    cam.updateProjectionMatrix();
    // 抖动消除：按阴影贴图像素对齐
    light.target.updateMatrixWorld();
    light.updateMatrixWorld();
  }
  updateShadowFocus(new THREE.Vector3());
  let lastTarget = new THREE.Vector3(), lastRadius = shadowRadius;
  const focus = (t, r = shadowRadius) => { lastTarget.copy(t); lastRadius = r; updateShadowFocus(t, r); };
  /** 调整太阳方位（度）：方位 0=北 90=东 180=南；高度角 */
  function setSun(azimuthDeg, elevationDeg) {
    const ph = THREE.MathUtils.degToRad(90 - elevationDeg), th = THREE.MathUtils.degToRad(azimuthDeg);
    sunDir.set(Math.sin(th) * Math.sin(ph), Math.cos(ph), -Math.cos(th) * Math.sin(ph));
    u.sunPosition.value.copy(sunDir);
    const low = THREE.MathUtils.clamp(1 - elevationDeg / 35, 0, 1);
    light.color.setRGB(1, 0.95 - 0.2 * low, 0.86 - 0.35 * low);
    light.intensity = 1.2 + 2.0 * Math.min(1, elevationDeg / 25);
    hemi.intensity = 0.35 + 0.25 * Math.min(1, elevationDeg / 30);
    updateShadowFocus(lastTarget, lastRadius);
  }
  return { sky, sun: light, hemi, sunDir, updateShadowFocus: focus, setSun };
}
