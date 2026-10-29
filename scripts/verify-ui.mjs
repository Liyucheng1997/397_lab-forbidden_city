// 真实浏览器集成检查：完整模型、搜索、导览中断、音频异常、窄屏操作。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const executablePath = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => fs.existsSync(p));
assert(executablePath, '请安装 Chrome / Edge，或设置 CHROME_PATH');
const server = await createServer({ server: { port: 0, hmr: false }, logLevel: 'error' });
let browser;
const errors = [];
const checks = [];
fs.mkdirSync('shots', { recursive: true });
try {
  await server.listen();
  browser = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 240000,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage();
  page.on('response', (response) => { if (response.status() >= 400) console.log('HTTP', response.status(), response.url()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(`${server.resolvedUrls.local[0]}?shot=1&ui=1&ao=0`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready && document.querySelector('.building-search'), { timeout: 240000 });
  await page.waitForSelector('#loading', { hidden: true });
  assert.equal(await page.evaluate(() => window.__error), undefined);
  const stats = await page.evaluate(() => window.__stats);
  assert.equal(stats.errors, 0);
  assert(stats.buildings > 900);
  checks.push('完整故宫场景构建');

  async function searchFor(text) {
    await page.$eval('.building-search', (el, value) => { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  }
  await searchFor('太和殿');
  assert.equal(await page.$eval('.search-results button', (el) => el.textContent), '太和殿');
  await page.focus('.building-search');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('.guide .t', (el) => el.textContent), '太和殿');
  const hasAudio = await page.evaluate(async () => Boolean((await import('/src/ui/guide.js')).audioUrl('太和殿')));
  assert.equal(await page.$eval('.guide .play', (el) => el.disabled), !hasAudio);
  checks.push('搜索与 Enter 定位、配音状态');

  await searchFor('宫后苑');
  assert.equal(await page.$eval('.search-results button', (el) => el.textContent), '御花园');
  await searchFor('不存在的建筑xyz');
  assert.equal(await page.$$eval('.search-results button', (els) => els.length), 0);
  assert.match(await page.$eval('.search-status', (el) => el.textContent), /没有找到/);
  await page.focus('.building-search');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('.building-search', (el) => el.value), '');
  checks.push('别名搜索、空结果与 Esc 清除');

  await page.click('[data-act=tour]');
  assert.equal(await page.$eval('[data-act=tour]', (el) => el.textContent), '停止漫游');
  await searchFor('太和殿');
  await page.click('.search-results button');
  await new Promise((r) => setTimeout(r, 4600));
  assert.equal(await page.$eval('[data-act=tour]', (el) => el.textContent), '中轴漫游');
  assert.equal(await page.$eval('.guide .t', (el) => el.textContent), '太和殿');
  checks.push('搜索中断导览，过站后不会抢回讲解');

  await page.click('[data-act=walk]');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('body > canvas')), true);
  await page.keyboard.down('KeyW');
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  assert.match(await page.$eval('.help', (el) => el.textContent), /左键旋转/);
  checks.push('漫步进入后接收键盘输入、Esc 退出');

  // 独立讲解实例检查：缺音频、关闭取消、旧播放拒绝不影响新讲解。
  const guideChecks = await page.evaluate(async () => {
    const { createGuide } = await import('/src/ui/guide.js');
    const hud = document.createElement('div');
    document.body.appendChild(hud);
    const guide = createGuide({ hud });
    let finished = false;
    const wait = guide.playName('太和殿').then(() => { finished = true; });
    guide.close();
    await wait;
    const cancelled = finished;
    const audioWait = guide.playName('紫禁城');
    guide.open('测试讲解', { fallback: '测试内容', play: false });
    await audioWait;
    await new Promise((r) => setTimeout(r, 50));
    const status = hud.querySelector('.tm').textContent;
    const stable = status === '' && hud.querySelector('.t').textContent === '测试讲解' && hud.querySelector('.play').disabled;
    guide.close(); hud.remove();
    return { cancelled, stable, status };
  });
  assert.deepEqual(guideChecks, { cancelled: true, stable: true, status: '' });
  checks.push('讲解等待可取消、切换音频无异步串扰');
  const rearHalls = await page.evaluate(async () => {
    const { entryFor, audioUrl } = await import('/src/ui/guide.js');
    return [[-94, 10, -259], [-288, 10, -169]].map((pos) => {
      const entry = entryFor('后殿', pos);
      return { name: entry.name, audio: audioUrl(entry.name) };
    });
  });
  assert.equal(rearHalls[0].name, '永寿宫后殿');
  assert.equal(rearHalls[1].name, '寿康宫后殿');
  if (rearHalls.every((hall) => hall.audio)) assert.notEqual(rearHalls[0].audio, rearHalls[1].audio);
  checks.push('同名后殿按位置匹配独立讲解与录音');

  await searchFor('');
  await page.screenshot({ path: 'shots/overview-desktop.png' });
  await page.setViewport({ width: 390, height: 844 });
  await page.click('.panel-toggle');
  assert.equal(await page.$eval('.panel-toggle', (el) => el.getAttribute('aria-expanded')), 'false');
  await page.click('.panel-toggle');
  await searchFor('太和殿');
  await page.click('.search-results button');
  assert.equal(await page.$eval('#panel-body', (el) => el.hidden), true);
  const layout = await page.evaluate(() => {
    const card = document.querySelector('.guide').getBoundingClientRect();
    const minimap = document.querySelector('.minimap').getBoundingClientRect();
    return { cardFits: card.left >= 0 && card.right <= innerWidth && card.bottom <= innerHeight,
      mapFits: minimap.right <= innerWidth, labelsWidth: document.querySelector('.labels').clientWidth };
  });
  assert.equal(layout.cardFits, true);
  assert.equal(layout.mapFits, true);
  assert.equal(layout.labelsWidth, 390);
  await new Promise((r) => setTimeout(r, 2600));
  await page.screenshot({ path: 'shots/search-mobile.png' });
  checks.push('390px 窄屏搜索、自动收起、讲解卡与标签尺寸');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, stats, errors }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
