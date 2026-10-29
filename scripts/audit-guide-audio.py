"""检查全部讲解录音的覆盖率、解码、时长与电平；用 F5 Python 环境运行。"""
import json
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
entries = []
for path in sorted((ROOT / 'src/data/guide').glob('*.json')):
    if path.name != 'audio.json':
        entries.extend(json.loads(path.read_text(encoding='utf-8')))
manifest = json.loads((ROOT / 'src/data/guide/audio.json').read_text(encoding='utf-8'))
results, failures = [], []
for entry in entries:
    name = entry['name']
    try:
        item = manifest[name]
        path = ROOT / 'public/audio/guide' / item['file']
        samples, rate = sf.read(path, dtype='float32')
        duration = len(samples) / rate
        peak = float(np.max(np.abs(samples)))
        assert duration > 1 and abs(duration - item['dur']) < 0.2, '时长与清单不一致'
        assert np.isfinite(samples).all() and peak > 0.01, '无效或静音录音'
        assert peak <= 1.0, '音频削波'
        results.append({'name': name, 'file': item['file'], 'duration': round(duration, 2), 'peak': round(peak, 4)})
    except Exception as error:
        failures.append({'name': name, 'error': str(error)})
report = {'entries': len(entries), 'passed': len(results), 'failed': failures,
          'totalSeconds': round(sum(r['duration'] for r in results), 2), 'results': results}
(ROOT / 'docs/audio-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'results'}, ensure_ascii=False, indent=2))
raise SystemExit(1 if failures else 0)
