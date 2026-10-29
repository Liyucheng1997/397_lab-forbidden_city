// 导游讲解：点击建筑（或名称标签）弹出讲解卡，播放 F5-TTS 配音（人工老龙凤）
// 讲解词：src/data/guide/*.json（[{name, aliases, tier, sub, text}]），配音清单：src/data/guide/audio.json
import * as THREE from 'three';
import { SITE, groundHeightAt } from '../site/auto.js';

const files = import.meta.glob('../data/guide/*.json', { eager: true, import: 'default' });
const AUDIO = files['../data/guide/audio.json'] || {};
const ENTRIES = Object.entries(files).filter(([k]) => !k.endsWith('/audio.json')).flatMap(([, v]) => (Array.isArray(v) ? v : []));
const INDEX = new Map();
const AMBIGUOUS = new Map();
for (const e of ENTRIES) {
  INDEX.set(e.name, e);
  for (const a of e.aliases || []) {
    if (!INDEX.has(a)) INDEX.set(a, e);
    else if (INDEX.get(a) !== e) AMBIGUOUS.set(a, [...(AMBIGUOUS.get(a) || [INDEX.get(a)]), e]);
  }
}

/** OSM 名称 → 讲解条目（含错别字别名） */
export function entryFor(name, pos) {
  if (!name) return null;
  if (AMBIGUOUS.has(name)) {
    if (!pos) return null;
    const z = pos.length === 3 ? pos[2] : pos[1];
    return AMBIGUOUS.get(name).filter((e) => e.pos).sort((a, b) =>
      Math.hypot(a.pos[0] - pos[0], a.pos[1] - z) - Math.hypot(b.pos[0] - pos[0], b.pos[1] - z)
    )[0] || null;
  }
  return INDEX.get(name) || INDEX.get(name.replace(/\d+$/, '')) || null;
}
/** 显示用名称（纠正 OSM 错别字） */
export function displayName(name, pos) {
  const e = entryFor(name, pos);
  return e && (e.aliases || []).includes(name) ? e.name : name;
}
export function audioUrl(name) {
  const e = entryFor(name);
  const a = e && AUDIO[e.name];
  return a ? `${import.meta.env.BASE_URL}audio/guide/${a.file}` : null;
}

const STYLE = `
.guide { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); width: min(620px, calc(100vw - 32px)); max-height: 46vh; display: flex; flex-direction: column;
  background: rgba(250, 244, 230, .96); border-left: 5px solid #8c1c12; border-radius: 10px; box-shadow: 0 10px 34px rgba(0,0,0,.28); z-index: 6; font-size: 14px; color: #3a2a1a; }
.guide.hidden { display: none; }
.guide .hd { display: flex; align-items: baseline; gap: 10px; padding: 12px 16px 4px; }
.guide .t { font-size: 22px; font-weight: 700; color: #8c1c12; letter-spacing: 4px; }
.guide .s { font-size: 12px; color: #8a7350; flex: 1; }
.guide .x { border: 0; background: none; font-size: 20px; color: #8a7350; cursor: pointer; padding: 0 2px; }
.guide .d { padding: 2px 16px 10px; line-height: 1.85; overflow-y: auto; text-align: justify; }
.guide .d .cur { background: rgba(232, 184, 74, .35); border-radius: 3px; }
.guide .bar { display: flex; align-items: center; gap: 10px; padding: 8px 16px 12px; border-top: 1px solid rgba(140, 28, 18, .12); }
.guide .play { width: 34px; height: 34px; border-radius: 50%; border: 0; background: #8c1c12; color: #fbeccb; font-size: 14px; cursor: pointer; flex: none; }
.guide .play:disabled { background: #c9b79a; cursor: default; }
.guide .prog { flex: 1; height: 4px; background: rgba(140, 28, 18, .15); border-radius: 2px; cursor: pointer; position: relative; }
.guide .prog i { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: #b8862b; border-radius: 2px; }
.guide .tm { font-size: 11px; color: #8a7350; min-width: 74px; text-align: right; }
.guide label { font-size: 12px; color: #8a7350; cursor: pointer; white-space: nowrap; }
@media (max-width: 640px) {
  .guide { bottom: 40px; max-height: 42dvh; }
  .guide .hd { flex-wrap: wrap; gap: 4px; }
  .guide .t { font-size: 18px; letter-spacing: 2px; }
  .guide .s { font-size: 11px; }
  .guide .bar { gap: 6px; padding: 8px 10px; }
  .guide .tm { min-width: 65px; }
  .guide label { font-size: 11px; }
}
`;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * hud：界面容器；landmarks：世界里的标签点（用于点击拾取的高度）；onFocus(lm)：飞往建筑
 * 返回 { open(name, {pos}), close(), pickAt(x, y, camera), playName(name) → Promise }
 */
export function createGuide({ hud, landmarks = [], onFocus = () => {} }) {
  const css = document.createElement('style');
  css.textContent = STYLE;
  document.head.appendChild(css);
  const el = document.createElement('div');
  el.className = 'guide hidden';
  el.innerHTML = `<div class="hd"><div class="t"></div><div class="s"></div><button class="x" title="关闭">×</button></div>
    <div class="d"></div>
    <div class="bar"><button class="play" title="播放讲解">▶</button><div class="prog"><i></i></div><div class="tm"></div>
    <label><input type="checkbox" class="auto" checked> 自动讲解</label></div>`;
  hud.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const audio = new Audio();
  audio.preload = 'auto';
  let playbackId = 0;
  let autoPlay = true;
  try { autoPlay = localStorage.getItem('fc_guide_auto') !== '0'; } catch (e) { /* 忽略 */ }
  $('.auto').checked = autoPlay;
  $('.auto').onchange = (e) => { autoPlay = e.target.checked; try { localStorage.setItem('fc_guide_auto', autoPlay ? '1' : '0'); } catch (err) { /* 忽略 */ } };
  $('.x').onclick = () => close();
  function playAudio() {
    const id = playbackId;
    audio.play().catch(() => {
      if (id !== playbackId) return;
      $('.tm').textContent = '点击播放讲解';
      finishPlayback();
    });
  }
  $('.play').onclick = () => {
    if (!audio.getAttribute('src')) return;
    if (audio.paused) playAudio(); else audio.pause();
  };
  $('.prog').onclick = (e) => {
    if (!audio.getAttribute('src') || !Number.isFinite(audio.duration) || !audio.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    audio.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * audio.duration;
  };
  let sentences = [];
  audio.addEventListener('play', () => { $('.play').textContent = '❚❚'; });
  audio.addEventListener('pause', () => { $('.play').textContent = '▶'; });
  audio.addEventListener('timeupdate', () => {
    if (!audio.getAttribute('src')) return;
    const d = audio.duration || 0, t = audio.currentTime;
    $('.prog i').style.width = d ? `${(t / d) * 100}%` : '0';
    $('.tm').textContent = d ? `${fmt(t)} / ${fmt(d)}` : '';
    // 按字数比例高亮当前句（近似跟读）
    if (d && sentences.length) {
      const total = sentences.reduce((a, s) => a + s.len, 0);
      let acc = 0, cur = 0;
      const k = (t / d) * total;
      for (let i = 0; i < sentences.length; i++) { acc += sentences[i].len; if (k <= acc) { cur = i; break; } }
      sentences.forEach((s, i) => s.el.classList.toggle('cur', i === cur && !audio.paused));
    }
  });
  let endResolve = null;
  let endTimer = null;
  function finishPlayback() {
    clearTimeout(endTimer); endTimer = null;
    sentences.forEach((s) => s.el.classList.remove('cur'));
    if (endResolve) { const resolve = endResolve; endResolve = null; resolve(); }
  }
  audio.addEventListener('ended', finishPlayback);
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src') || !audio.error) return;
    $('.tm').textContent = '音频暂不可用'; finishPlayback();
  });

  function render(title, sub, text) {
    $('.t').textContent = title;
    $('.s').textContent = sub || '';
    const d = $('.d');
    d.innerHTML = '';
    sentences = [];
    for (const s of (text || '').match(/[^。！？]+[。！？]?/g) || []) {
      const span = document.createElement('span');
      span.textContent = s;
      d.appendChild(span);
      sentences.push({ el: span, len: s.length });
    }
    d.scrollTop = 0;
    el.classList.remove('hidden');
  }

  /** 打开讲解卡：name 为 OSM 名称或规范名；fallback 为无讲解词时的简介 */
  function open(name, { fallback = '', play = autoPlay, pos } = {}) {
    playbackId++;
    const e = entryFor(name, pos);
    audio.pause();
    finishPlayback();
    $('.prog i').style.width = '0';
    if (!e) {
      render(displayName(name), '', fallback || '（暂无讲解）');
      audio.removeAttribute('src');
      $('.play').disabled = true;
      $('.tm').textContent = '';
      return null;
    }
    render(e.name, e.sub, e.text);
    const url = audioUrl(e.name);
    $('.play').disabled = !url;
    $('.prog i').style.width = '0';
    $('.tm').textContent = url ? '' : '暂无配音';
    if (url) {
      audio.src = url;
      if (play) playAudio();
    } else audio.removeAttribute('src');
    return e;
  }
  function close() {
    playbackId++;
    audio.pause();
    el.classList.add('hidden');
    finishPlayback();
  }
  /** 播放并在结束时 resolve（无配音则按字数估计停留时间） */
  function playName(name, fallback) {
    const e = open(name, { fallback, play: true });
    const url = e && audioUrl(e.name);
    return new Promise((r) => {
      endResolve = r;
      const readingMs = Math.max(3000, ((e?.text || fallback || '').length / 5) * 1000);
      const duration = e && AUDIO[e.name]?.dur;
      endTimer = setTimeout(finishPlayback, url ? Math.max(readingMs, (duration || 120) * 1000) + 15000 : readingMs);
    });
  }

  // ---------- 点击拾取：建筑外包盒 ----------
  const lmById = new Map(landmarks.filter((l) => l.id).map((l) => [l.id, l]));
  const boxes = [];
  for (const b of SITE.buildings) {
    const n = b.tags.name;
    if (!n || /^(房子|平房|小房|院墙|侧墙|公共厕所|广播室|city_gate)/.test(n)) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of b.poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const gy = groundHeightAt(b.obb.cx, b.obb.cz);
    const lm = lmById.get(b.id);
    const top = lm ? lm.pos[1] - 1 : gy + Math.min(28, 4 + 0.45 * Math.min(x1 - x0, z1 - z0));
    boxes.push({ box: new THREE.Box3(new THREE.Vector3(x0, gy, z0), new THREE.Vector3(x1, top, z1)), name: n, lm: lm || { name: n, pos: [b.obb.cx, top + 2, b.obb.cz], desc: '' } });
  }
  for (const l of landmarks) if (!l.id) boxes.push({ box: new THREE.Box3(new THREE.Vector3(l.pos[0] - 6, 0, l.pos[2] - 6), new THREE.Vector3(l.pos[0] + 6, l.pos[1], l.pos[2] + 6)), name: l.name, lm: l });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  function pickAt(clientX, clientY, camera) {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = null, bd = Infinity;
    for (const b of boxes) {
      if (!ray.ray.intersectBox(b.box, hit)) continue;
      const d = hit.distanceTo(ray.ray.origin);
      // 小建筑优先（嵌在大院落外包盒里的单体）
      const vol = (b.box.max.x - b.box.min.x) * (b.box.max.z - b.box.min.z);
      const score = d + Math.sqrt(vol) * 0.05;
      if (score < bd) { bd = score; best = b; }
    }
    if (!best) return null;
    onFocus(best.lm);
    open(best.name, { fallback: best.lm.desc, pos: best.lm.pos });
    return best;
  }

  return { open, close, pickAt, playName, entryFor, displayName };
}
