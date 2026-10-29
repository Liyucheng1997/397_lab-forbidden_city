"""边录边检查：CPU 识别已完成的 MP3，不占用 F5 的 GPU；全部检查后退出。"""
import json
import os
import time
from pathlib import Path
os.environ['GUIDE_ASR_DEVICE'] = 'cpu'
from guide_tts import load_entries, asr_check, speech_text, MANIFEST, OUT_DIR, ROOT

entries = load_entries()
report_path = Path(ROOT) / 'docs/audio-asr-check.json'
results = {}
if report_path.exists():
    results = {r['name']: r for r in json.loads(report_path.read_text(encoding='utf-8')).get('results', []) if r.get('key')}
last_progress = time.monotonic()
while True:
    manifest = json.loads(Path(MANIFEST).read_text(encoding='utf-8'))
    for entry in entries:
        name = entry['name']
        audio = manifest.get(name)
        if not audio or results.get(name, {}).get('key') == audio['key']:
            continue
        ratio, heard = asr_check(str(Path(OUT_DIR) / audio['file']), speech_text(entry))
        results[name] = {'name': name, 'key': audio['key'], 'ratio': round(ratio, 4), 'heard': heard}
        report = {'engine': 'f5', 'voice': '人工老龙凤', 'checked': len(results),
                  'flagged': sum(r['ratio'] < 0.93 for r in results.values()), 'results': list(results.values())}
        temp = report_path.with_suffix('.tmp')
        temp.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        temp.replace(report_path)
        print(f"[{len(results)}/{len(entries)}] {name} {ratio:.3f}", flush=True)
        last_progress = time.monotonic()
    if len(results) == len(entries):
        break
    if time.monotonic() - last_progress > 1200:
        raise RuntimeError('20 分钟没有新音频可核对，请检查合成日志')
    time.sleep(10)
