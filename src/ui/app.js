// 交互界面：视角预设、中轴漫游、建筑标签、点击飞行、第一人称漫步、小地图、日照调节
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { VIEWS, TOUR } from './views.js';
import { SITE, groundHeightAt } from '../site/auto.js';
import { OUTER_WALL } from '../config.js';
import { createGuide, displayName, entryFor } from './guide.js';

const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function initUI({ scene, camera, controls, renderer, world, env, setView }) {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';
  const css = document.createElement('style');
  css.textContent = STYLE;
  document.head.appendChild(css);

  // ---------- 标签 ----------
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(innerWidth, innerHeight);
  labelRenderer.domElement.className = 'labels';
  document.body.appendChild(labelRenderer.domElement);
  const labels = [];
  const important = (n) => /(殿|宫|门|阁|楼|亭|堂|斋|轩|馆|所|房|库|壁|桥|园|处)$/.test(n);
  const seenNames = new Map();
  for (const lm of world.landmarks) {
    if (!lm.name || /^(院墙|房子|平房|小房|城墙|city_gate|公共厕所|广播室|井)/.test(lm.name)) continue;
    const key = displayName(lm.name, lm.pos);
    if (seenNames.has(key) && !lm.desc) continue;
    seenNames.set(key, true);
    const el = $(`<div class="lbl${lm.desc ? ' major' : ''}">${key}</div>`);
    const obj = new CSS2DObject(el);
    obj.position.set(...lm.pos);
    obj.userData = { lm, rank: lm.desc ? 2 : important(lm.name) ? 1 : 0, w: key.length * (lm.desc ? 15 : 13) + 16 };
    el.addEventListener('click', (e) => { e.stopPropagation(); focusLandmark(lm); });
    scene.add(obj);
    labels.push(obj);
  }
  let showLabels = true;

  // ---------- 面板 ----------
  const panel = $(`<div class="panel">
    <div class="brand"><b>紫禁城</b><span>THE FORBIDDEN CITY · 1420</span></div>
    <button class="panel-toggle" aria-expanded="true" aria-controls="panel-body">收起面板</button>
    <div id="panel-body">
    <div class="sec">寻找建筑</div>
    <input class="building-search" type="search" placeholder="搜索宫殿、城门、园林…" aria-label="搜索建筑" autocomplete="off">
    <div class="search-status" role="status"></div>
    <div class="search-results" aria-label="建筑搜索结果"></div>
    <div class="sec">视角</div>
    <div class="views"></div>
    <div class="sec">漫游</div>
    <div class="row"><button data-act="tour">中轴漫游</button><button data-act="walk">漫步模式</button><button data-act="orbit">环绕</button></div>
    <div class="sec">显示</div>
    <label class="chk"><input type="checkbox" data-opt="labels" checked> 建筑名称</label>
    <label class="chk"><input type="checkbox" data-opt="fog" checked> 大气雾</label>
    <label class="chk"><input type="checkbox" data-opt="ao" checked> 环境光遮蔽</label>
    <div class="sec">日照 <span class="val" id="sunv"></span></div>
    <input type="range" min="0" max="100" value="50" data-opt="sun" class="slider">
    <div class="foot">${world.stats.buildings} 栋建筑 · ${(world.stats.tris / 1e6).toFixed(1)}M 三角面<br>轮廓数据 © OpenStreetMap contributors (ODbL)</div>
    </div>
  </div>`);
  hud.appendChild(panel);
  const vbox = panel.querySelector('.views');
  const tourBtn = panel.querySelector('[data-act=tour]');
  for (const [k, v] of Object.entries(VIEWS)) {
    const b = $(`<button>${v.name}</button>`);
    b.onclick = () => { stopTour(); guide.close(); controls.autoRotate = false; flyTo(v.cam, v.tgt); };
    vbox.appendChild(b);
  }
  const help = $(`<div class="help">左键旋转 · 右键平移 · 滚轮缩放 · 点击建筑听讲解</div>`);
  hud.appendChild(help);
  const guide = createGuide({ hud, landmarks: world.landmarks, onFocus: (lm) => focusLandmark(lm, false) });

  // 搜索覆盖场景中的具名建筑，沿用讲解数据中的规范名与别名。
  const search = panel.querySelector('.building-search');
  const results = panel.querySelector('.search-results');
  const searchStatus = panel.querySelector('.search-status');
  const searchable = new Map();
  for (const lm of world.landmarks) {
    if (!lm.name || /^(院墙|房子|平房|小房|城墙|city_gate|公共厕所|广播室|井)/.test(lm.name)) continue;
    const name = displayName(lm.name, lm.pos);
    const old = searchable.get(name);
    if (!old || (!old.desc && lm.desc)) searchable.set(name, lm);
  }
  function searchBuildings() {
    const query = search.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    if (!query) { searchStatus.textContent = ''; return; }
    const matches = [...searchable].filter(([name, lm]) =>
      [name, lm.name, ...(entryFor(lm.name, lm.pos)?.aliases || [])].some((s) => s.toLocaleLowerCase().includes(query))
    ).sort(([a], [b]) => Number(b === query) - Number(a === query) || a.localeCompare(b, 'zh-CN'));
    searchStatus.textContent = matches.length ? `找到 ${matches.length} 处建筑` : '没有找到，试试“太和”或“宫”';
    for (const [name, lm] of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.onclick = () => { focusLandmark(lm); if (innerWidth <= 640) setPanelCollapsed(true); };
      results.appendChild(button);
    }
  }
  search.addEventListener('input', searchBuildings);
  search.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); results.querySelector('button')?.click(); }
    if (e.key === 'Escape') { e.preventDefault(); search.value = ''; searchBuildings(); search.blur(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); results.querySelector('button')?.focus(); }
  });
  const panelToggle = panel.querySelector('.panel-toggle');
  function setPanelCollapsed(collapsed) {
    panel.classList.toggle('collapsed', collapsed);
    panelToggle.setAttribute('aria-expanded', String(!collapsed));
    panelToggle.textContent = collapsed ? '展开面板' : '收起面板';
    panel.querySelector('#panel-body').hidden = collapsed;
  }
  panelToggle.onclick = () => setPanelCollapsed(!panel.classList.contains('collapsed'));
  setPanelCollapsed(innerWidth <= 640);
  panel.querySelector('[data-opt=ao]').checked = new URLSearchParams(location.search).get('ao') !== '0';
  addEventListener('resize', () => labelRenderer.setSize(innerWidth, innerHeight));

  // ---------- 小地图 ----------
  const mm = document.createElement('canvas');
  mm.className = 'minimap';
  const MW = 190, MH = Math.round((MW * (OUTER_WALL.south - OUTER_WALL.north + 160)) / (OUTER_WALL.east - OUTER_WALL.west + 160));
  mm.width = MW * 2; mm.height = MH * 2;
  mm.style.width = MW + 'px'; mm.style.height = MH + 'px';
  hud.appendChild(mm);
  const mx0 = OUTER_WALL.west - 80, mz0 = OUTER_WALL.north - 80, msc = (MW * 2) / (OUTER_WALL.east - OUTER_WALL.west + 160);
  const base = document.createElement('canvas');
  base.width = mm.width; base.height = mm.height;
  {
    const g = base.getContext('2d');
    g.fillStyle = '#e9e1cf'; g.fillRect(0, 0, base.width, base.height);
    const P = (x, z) => [(x - mx0) * msc, (z - mz0) * msc];
    g.fillStyle = '#8fb8d0';
    for (const w of SITE.water) { g.beginPath(); w.poly.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fill(); }
    g.fillStyle = '#a7c48c';
    for (const w of SITE.green) { if (!/garden/.test(w.tags.leisure || '')) continue; g.beginPath(); w.poly.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.fill(); }
    g.strokeStyle = '#9b2c22'; g.lineWidth = 3;
    const [a, b] = P(OUTER_WALL.west, OUTER_WALL.north), [c, d] = P(OUTER_WALL.east, OUTER_WALL.south);
    g.strokeRect(a, b, c - a, d - b);
    g.fillStyle = '#c99a3c';
    for (const bd of SITE.buildings) { g.beginPath(); bd.poly.forEach(([x, z], i) => { const [p, q] = P(x, z); i ? g.lineTo(p, q) : g.moveTo(p, q); }); g.fill(); }
  }
  const mmg = mm.getContext('2d');
  mm.onclick = (e) => {
    stopTour(); guide.close(); controls.autoRotate = false;
    const r = mm.getBoundingClientRect();
    const x = ((e.clientX - r.left) * mm.width / r.width) / msc + mx0, z = ((e.clientY - r.top) * mm.height / r.height) / msc + mz0;
    const off = camera.position.clone().sub(controls.target);
    const tgt = [x, groundHeightAt(x, z) + 5, z];
    flyTo([x + off.x, tgt[1] + Math.max(off.y, 40), z + off.z], tgt);
  };

  // ---------- 相机飞行 ----------
  let fly = null;
  function flyTo(cam, tgt, dur = 2.2) {
    stopWalk();
    fly = { t: 0, dur, c0: camera.position.clone(), t0: controls.target.clone(), c1: new THREE.Vector3(...cam), t1: new THREE.Vector3(...tgt) };
  }
  function focusLandmark(lm, openCard = true) {
    stopTour();
    controls.autoRotate = false;
    const [x, y, z] = lm.pos;
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    const d = Math.max(45, y * 2.6);
    flyTo([x + dir.x * d, y + d * 0.45, z + dir.z * d], [x, y * 0.55, z]);
    if (openCard) guide.open(lm.name, { fallback: lm.desc, pos: lm.pos });
  }
  // 中轴漫游：逐站飞行，到站后播放该站讲解，讲完再走
  let tourId = 0, touring = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function startTour() {
    guide.close();
    controls.autoRotate = false;
    const id = ++tourId;
    touring = true;
    tourBtn.textContent = '停止漫游';
    for (const s of TOUR) {
      if (id !== tourId) return;
      flyTo(s.cam, s.tgt, s.dur || 5);
      await sleep((s.dur || 5) * 1000);
      if (id !== tourId) return;
      await guide.playName(s.guide || s.title, s.text);
      if (id !== tourId) return;
      await sleep(1200);
    }
    if (id === tourId) stopTour();
  }
  function stopTour() {
    tourId++;
    if (touring) { fly = null; guide.close(); }
    touring = false;
    tourBtn.textContent = '中轴漫游';
  }

  // ---------- 漫步模式（WASD + 拖动视角） ----------
  let walk = null;
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    if (e.code === 'Escape') { stopWalk(); stopTour(); guide.close(); return; }
    if (e.target instanceof Element && e.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    if (walk && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); if (walk) walk.drag = null; });
  search.addEventListener('focus', () => keys.clear());
  function startWalk() {
    fly = null; if (touring) stopTour();
    controls.autoRotate = false;
    guide.close();
    keys.clear();
    const t = controls.target;
    const gy = groundHeightAt(t.x, t.z);
    walk = { pos: new THREE.Vector3(t.x, gy + 1.7, t.z + 20), yaw: 0, pitch: 0.05, drag: null };
    controls.enabled = false;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.focus({ preventScroll: true });
    help.textContent = 'W/S 前后 · A/D 左右 · 按住左键拖动转向 · Shift 加速 · Esc 退出';
  }
  function stopWalk() {
    if (!walk) return;
    const dir = new THREE.Vector3(Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
    controls.target.copy(walk.pos).addScaledVector(dir, 20);
    controls.enabled = true;
    walk = null;
    help.textContent = '左键旋转 · 右键平移 · 滚轮缩放 · 点击名称飞往';
  }
  // 点击（非拖动）建筑 → 讲解
  controls.addEventListener('start', () => { stopTour(); fly = null; });
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, performance.now(), e.button]; if (walk) walk.drag = [e.clientX, e.clientY]; });
  addEventListener('pointerup', (e) => {
    if (walk) walk.drag = null;
    if (!down || e.target !== renderer.domElement) return;
    const [x, y, t, btn] = down;
    down = null;
    if (btn !== 0 || walk || Math.hypot(e.clientX - x, e.clientY - y) > 5 || performance.now() - t > 400) return;
    if (touring) stopTour();
    guide.pickAt(e.clientX, e.clientY, camera);
  });
  addEventListener('pointermove', (e) => {
    if (!walk || !walk.drag) return;
    walk.yaw += (e.clientX - walk.drag[0]) * 0.004;
    walk.pitch = THREE.MathUtils.clamp(walk.pitch - (e.clientY - walk.drag[1]) * 0.003, -1.2, 1.2);
    walk.drag = [e.clientX, e.clientY];
  });

  // ---------- 选项 ----------
  const fog = scene.fog;
  panel.addEventListener('click', (e) => {
    const act = e.target.dataset?.act;
    if (act === 'tour') (touring ? (stopTour(), guide.close()) : startTour());
    if (act === 'walk') (walk ? stopWalk() : startWalk());
    if (act === 'orbit') { stopTour(); stopWalk(); fly = null; guide.close(); controls.autoRotate = !controls.autoRotate; controls.autoRotateSpeed = 0.35; }
  });
  panel.addEventListener('input', (e) => {
    const o = e.target.dataset?.opt;
    if (o === 'labels') { showLabels = e.target.checked; labelRenderer.domElement.style.display = showLabels ? '' : 'none'; }
    if (o === 'fog') scene.fog = e.target.checked ? fog : null;
    if (o === 'ao') window.__setAO?.(e.target.checked);
    if (o === 'sun') setSun(+e.target.value / 100);
  });
  const sunv = panel.querySelector('#sunv');
  function setSun(t) {
    // t: 0 = 早晨（东），0.5 = 正午偏南，1 = 傍晚（西）
    const az = 100 + t * 160, el = 8 + Math.sin(Math.PI * t) * 50;
    env.setSun?.(az, el);
    const hh = 6 + t * 12;
    sunv.textContent = `${String(Math.floor(hh)).padStart(2, '0')}:${String(Math.round((hh % 1) * 60)).padStart(2, '0')}`;
  }
  setSun(0.62);
  panel.querySelector('[data-opt=sun]').value = 62;

  // ---------- 每帧 ----------
  const v = new THREE.Vector3();
  let last = performance.now();
  return function update() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (fly) {
      fly.t += dt / fly.dur;
      const k = ease(Math.min(1, fly.t));
      // 抛物线式抬升，避免穿过建筑
      const lift = Math.sin(Math.PI * k) * Math.min(120, fly.c0.distanceTo(fly.c1) * 0.25);
      camera.position.lerpVectors(fly.c0, fly.c1, k).y += lift;
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly = null;
    }
    if (walk) {
      const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 14 : 4.5) * dt;
      const f = new THREE.Vector3(Math.sin(walk.yaw), 0, -Math.cos(walk.yaw));
      const r = new THREE.Vector3(-f.z, 0, f.x);
      if (keys.has('KeyW') || keys.has('ArrowUp')) walk.pos.addScaledVector(f, sp);
      if (keys.has('KeyS') || keys.has('ArrowDown')) walk.pos.addScaledVector(f, -sp);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) walk.pos.addScaledVector(r, -sp);
      if (keys.has('KeyD') || keys.has('ArrowRight')) walk.pos.addScaledVector(r, sp);
      const gy = groundHeightAt(walk.pos.x, walk.pos.z) + 1.7;
      walk.pos.y += (gy - walk.pos.y) * Math.min(1, dt * 6);
      camera.position.copy(walk.pos);
      v.set(walk.pos.x + f.x * Math.cos(walk.pitch), walk.pos.y + Math.sin(walk.pitch), walk.pos.z + f.z * Math.cos(walk.pitch));
      camera.lookAt(v);
      controls.target.copy(v);
    }
    // 标签按距离/等级显隐，并在屏幕上避免互相重叠（等级高、离得近的优先）
    if (showLabels) {
      const camH = camera.position.y;
      const cand = [];
      for (const o of labels) {
        const d = o.position.distanceTo(camera.position);
        const r = o.userData.rank;
        const lim = r === 2 ? 1400 : r === 1 ? 380 : 160;
        if (d > lim || (r === 0 && camH > 120)) { o.visible = false; continue; }
        v.copy(o.position).project(camera);
        if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { o.visible = false; continue; }
        cand.push({ o, d, x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight });
      }
      cand.sort((a, b) => b.o.userData.rank - a.o.userData.rank || a.d - b.d);
      const placed = [];
      for (const c of cand) {
        const w = c.o.userData.w;
        const b = [c.x - w / 2 - 3, c.y - 26, c.x + w / 2 + 3, c.y + 2];
        if (placed.some((p) => !(b[2] < p[0] || b[0] > p[2] || b[3] < p[1] || b[1] > p[3]))) { c.o.visible = false; continue; }
        placed.push(b);
        c.o.visible = true;
      }
    }
    labelRenderer.render(scene, camera);
    // 小地图
    mmg.drawImage(base, 0, 0);
    const P = (x, z) => [(x - mx0) * msc, (z - mz0) * msc];
    const [cx, cz] = P(camera.position.x, camera.position.z), [tx, tz] = P(controls.target.x, controls.target.z);
    mmg.strokeStyle = '#1d4f91'; mmg.lineWidth = 3;
    mmg.beginPath(); mmg.moveTo(cx, cz); mmg.lineTo(tx, tz); mmg.stroke();
    mmg.fillStyle = '#1d4f91'; mmg.beginPath(); mmg.arc(cx, cz, 7, 0, Math.PI * 2); mmg.fill();
  };
}

addEventListener('resize', () => { const l = document.querySelector('.labels'); if (l) { l.style.width = innerWidth + 'px'; l.style.height = innerHeight + 'px'; } });

const STYLE = `
.labels { position: fixed; inset: 0; pointer-events: none; }
.lbl { padding: 1px 7px; font-size: 12px; color: #fbeccb; background: rgba(110, 24, 16, .78); border: 1px solid rgba(232, 184, 74, .55); border-radius: 3px; white-space: nowrap; pointer-events: auto; cursor: pointer; transform: translateY(-6px); }
.lbl.major { font-size: 14px; font-weight: 600; background: rgba(140, 28, 18, .9); }
.lbl:hover { background: #b8862b; color: #fff; }
.panel { position: fixed; left: 14px; top: 14px; width: 216px; max-height: calc(100dvh - 52px); overflow-y: auto; padding: 12px 12px 10px; background: rgba(250, 244, 230, .9); backdrop-filter: blur(6px); border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.18); font-size: 13px; z-index: 5; }
.panel-toggle { display: block; margin-top: 8px; }
.building-search { box-sizing: border-box; width: 100%; min-height: 36px; border: 1px solid #c9a96a; background: #fffaf0; color: #3a2a1a; border-radius: 4px; padding: 6px 8px; font: inherit; }
.building-search:focus-visible, .panel button:focus-visible { outline: 2px solid #8c1c12; outline-offset: 2px; }
.search-status { font-size: 11px; color: #8a7350; margin-top: 4px; }
.search-status:empty { display: none; }
.search-results { display: grid; gap: 4px; max-height: 168px; overflow-y: auto; margin-top: 4px; }
.search-results:empty { display: none; }
.search-results button { text-align: left; min-height: 32px; }
.brand b { display: block; font-size: 24px; letter-spacing: 8px; color: #8c1c12; }
.brand span { font-size: 10px; letter-spacing: 2px; color: #8a7350; }
.sec { margin: 10px 0 5px; font-size: 11px; color: #8a7350; letter-spacing: 2px; }
.sec .val { float: right; letter-spacing: 0; color: #5a4630; }
.views { display: flex; flex-wrap: wrap; gap: 4px; }
.panel button { border: 1px solid #c9a96a; background: #fffaf0; color: #5a2a14; border-radius: 4px; padding: 3px 7px; font-size: 12px; cursor: pointer; }
.panel button:hover { background: #8c1c12; color: #fbeccb; border-color: #8c1c12; }
.row { display: flex; gap: 4px; }
.chk { display: block; margin: 3px 0; cursor: pointer; }
.slider { width: 100%; accent-color: #8c1c12; }
.foot { margin-top: 10px; font-size: 10px; color: #8a7350; line-height: 1.5; }
.info { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: 560px; padding: 12px 18px; background: rgba(250, 244, 230, .94); border-left: 4px solid #8c1c12; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.2); z-index: 5; }
.info.hidden { display: none; }
.info .t { font-size: 18px; font-weight: 700; color: #8c1c12; letter-spacing: 3px; }
.info .d { margin-top: 4px; font-size: 13px; line-height: 1.6; color: #3a2a1a; }
.help { position: fixed; right: 14px; bottom: 12px; font-size: 11px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.6); z-index: 5; }
.minimap { position: fixed; right: 14px; top: 14px; border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.2); cursor: crosshair; z-index: 5; }
@media (max-width: 640px) {
  .panel { left: 8px; top: 8px; width: min(216px, calc(100vw - 48px)); max-height: calc(100dvh - 88px); }
  .panel.collapsed { width: 132px; }
  .brand b { font-size: 22px; }
  .brand span { font-size: 8px; letter-spacing: 0; }
  .panel button { min-height: 34px; }
  .minimap { right: 8px; top: 8px; width: 96px !important; height: auto !important; }
  .help { left: 12px; right: 12px; bottom: 10px; font-size: 10px; text-align: center; }
}
`;
