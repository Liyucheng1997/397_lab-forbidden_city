// 生成分区数据清单（供精修参考）：docs/districts/<key>.md
// 每栋 OSM 建筑：id、名称、中心、尺寸、矩形度、OSM 标签、自动分类、自动朝向/形制
// 用法：node scripts/district-report.mjs [key...]
import { createServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const auto = await server.ssrLoadModule('/src/site/auto.js');
const dist = await server.ssrLoadModule('/src/districts/index.js');
const { SITE, autoItems, classify } = auto;
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(dist.DISTRICT_BOUNDS);
const rotName = (r) => { const d = ((Math.round((r * 180) / Math.PI) % 360) + 360) % 360; return { 0: '南', 180: '北', 90: '东', 270: '西' }[d] ?? `${d}°`; };
fs.mkdirSync(path.join(ROOT, 'docs/districts'), { recursive: true });
for (const key of keys) {
  const rows = [];
  for (const b of SITE.buildings) {
    if (dist.districtOf(b.c[0], b.c[1], b) !== key) continue;
    const t = b.tags;
    let items = [];
    try { items = autoItems(b); } catch (e) { items = []; }
    const autoDesc = items.map((it) => it.type === 'platform' ? '石台' : `${it.spec.kind || 'hall'}/${it.spec.roof?.type}/g${it.spec.grade}/朝${rotName(it.rotY)}/${it.spec.eaveW.toFixed(1)}×${it.spec.eaveD.toFixed(1)}@(${it.x.toFixed(1)},${it.z.toFixed(1)})${it.spec.y0 ? '/y0=' + it.spec.y0 : ''}`).join('; ');
    const osm = ['height', 'min_height', 'roof:shape', 'roof:colour', 'building', 'historic', 'building:levels'].filter((k) => t[k]).map((k) => `${k}=${t[k]}`).join(' ');
    rows.push(`| ${b.id} | ${t.name || ''} | ${b.obb.cx.toFixed(1)}, ${b.obb.cz.toFixed(1)} | ${b.obb.sx.toFixed(1)}×${b.obb.sz.toFixed(1)} | ${b.rect} | ${classify(b)} | ${osm} | ${autoDesc} |`);
  }
  const walls = SITE.walls.filter((w) => { const m = w.pts[Math.floor(w.pts.length / 2)]; return dist.districtOf(m[0], m[1]) === key; })
    .map((w) => `| ${w.id} | ${w.tags.name || ''} | ${w.kind}${w.poly ? '(多边形)' : ''} | ${w.tags.height || ''} | ${w.pts.length} | ${w.pts.slice(0, 4).map((p) => `(${p[0].toFixed(0)},${p[1].toFixed(0)})`).join(' ')}${w.pts.length > 4 ? ' …' : ''} |`);
  const b = dist.DISTRICT_BOUNDS[key];
  const md = `# 分区 ${key} 数据清单\n\n范围 x∈[${b[0]},${b[1]}] z∈[${b[2]},${b[3]}]（x 东，z 南，北 = -z）。坐标为世界米制坐标。\n` +
    `尺寸 sx×sz 为 OSM 屋檐外轮廓（轴对齐外接矩形，sx 沿东西、sz 沿南北）。rect=面积/外接矩形面积（<0.86 自动分解为多个矩形翼）。\n` +
    `自动推断列：类型/屋顶/等级/朝向/面阔×进深@(中心)。\n\n## 建筑（${rows.length}）\n\n| OSM id | 名称 | 中心 x,z | sx×sz | rect | 分类 | OSM 标签 | 自动推断 |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n` +
    `## 墙（${walls.length}）\n\n| id | 名称 | 类型 | 高 | 点数 | 前几点 |\n|---|---|---|---|---|---|\n${walls.join('\n')}\n`;
  fs.writeFileSync(path.join(ROOT, `docs/districts/${key}.md`), md);
  console.log(key, rows.length, 'buildings', walls.length, 'walls');
}
await server.close();
