# 平面图绘制工具（matplotlib）：读取 src/data/site.json（世界坐标：x 东，z 南），按区域出图，标注建筑名称与 OSM id 末 5 位
# 用法：python scripts/plot_site.py --region x0,x1,z0,z1 --out shots/plan_xxx.png [--ids] [--dpi 110]
import json, sys, argparse, os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ap = argparse.ArgumentParser()
ap.add_argument('--region', default='-480,480,-500,580')
ap.add_argument('--out', default='shots/plan.png')
ap.add_argument('--ids', action='store_true', help='标注 OSM id 末 5 位')
ap.add_argument('--dpi', type=int, default=100)
ap.add_argument('--grid', type=int, default=0)
a = ap.parse_args()
x0, x1, z0, z1 = [float(v) for v in a.region.split(',')]

for f in ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simhei.ttf']:
    if os.path.exists(f):
        font_manager.fontManager.addfont(f)
        plt.rcParams['font.family'] = font_manager.FontProperties(fname=f).get_name()
        break

S = json.load(open(os.path.join(ROOT, 'src/data/site.json'), encoding='utf-8'))
W, H = x1 - x0, z1 - z0
scale = 22 / max(W, H)
fig, ax = plt.subplots(figsize=(max(6, W * scale), max(6, H * scale)), dpi=a.dpi)
inside = lambda P: any(x0 <= p[0] <= x1 and z0 <= p[1] <= z1 for p in P)
for g in S['green']:
    if inside(g['poly']): ax.fill(*zip(*g['poly']), color='#b9dca0', alpha=0.5, zorder=0)
for w in S['water']:
    if inside(w['poly']): ax.fill(*zip(*w['poly']), color='#9cc9ee', zorder=1)
for w in S['waterways']:
    if inside(w['pts']): ax.plot(*zip(*w['pts']), color='#3b8fd6', lw=1.5, zorder=2)
for b in S['bridges']:
    if inside(b['poly']): ax.fill(*zip(*b['poly']), color='#cccccc', zorder=6)
for p in S['parts']:
    if inside(p['poly']):
        stone = p['tags'].get('building:material') == 'stone'
        ax.plot(*zip(*(p['poly'] + [p['poly'][0]])), color='#888' if stone else '#bbb', lw=0.4, zorder=3)
for b in S['buildings']:
    P = b['poly']
    if not inside(P): continue
    col = '#e8b84a' if b['tags'].get('roof:colour', '#FB994D') == '#FB994D' else '#b0b0b0'
    ax.fill(*zip(*P), color=col, alpha=0.75, zorder=4)
    ax.plot(*zip(*(P + [P[0]])), color='#6a4a10', lw=0.6, zorder=4)
for w in S['walls']:
    P = w['pts']
    if not inside(P): continue
    if w['poly']: ax.fill(*zip(*P), color='#b0302a', zorder=5)
    else: ax.plot(*zip(*P), color='#b0302a', lw=1.4, zorder=5)
fs = max(4, min(9, 900 / max(W, H)))
for b in S['buildings']:
    cx, cz = b['c']
    if not (x0 <= cx <= x1 and z0 <= cz <= z1): continue
    label = b['tags'].get('name', '')
    if a.ids: label = (label + '\n' if label else '') + str(b['id'])[-5:]
    if label: ax.text(cx, cz, label, fontsize=fs, ha='center', va='center', zorder=9)
if a.ids:
    for w in S['walls']:
        P = w['pts']
        m = P[len(P) // 2]
        if x0 <= m[0] <= x1 and z0 <= m[1] <= z1: ax.text(m[0], m[1], 'w' + str(w['id'])[-5:], fontsize=fs * 0.75, color='#7a1010', zorder=9)
ax.set_xlim(x0, x1); ax.set_ylim(z1, z0)  # z 向南 → 图上北在上
ax.set_aspect('equal')
step = a.grid or (10 if max(W, H) < 250 else 50)
import numpy as np
ax.set_xticks(np.arange(np.ceil(x0 / step) * step, x1 + 1, step))
ax.set_yticks(np.arange(np.ceil(z0 / step) * step, z1 + 1, step))
ax.tick_params(labelsize=7)
ax.grid(True, lw=0.3, alpha=0.6)
ax.set_title(f'x(东)∈[{x0},{x1}]  z(南)∈[{z0},{z1}]  北在上', fontsize=9)
plt.tight_layout()
os.makedirs(os.path.dirname(os.path.join(ROOT, a.out)), exist_ok=True)
plt.savefig(os.path.join(ROOT, a.out))
print('saved', a.out)
