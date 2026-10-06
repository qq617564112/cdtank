"""Prepare original map14 c9 resources independently of published assets."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'recovery'))
from export_effect_models import export_models

OUTPUT = ROOT / 'recovery/prepared/scene-breach14-assets'
REFERENCES = [f'Data/scnobj/{name}/c9.CVD' for name in ('obj05425', 'obj05426', 'obj05428')]

if __name__ == '__main__':
    library = export_models([{'reference': value} for value in REFERENCES],
        ROOT / 'recovery/output/verified/assets/data', OUTPUT)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'scene-breach-0014.json').write_text(json.dumps(library, ensure_ascii=False) + '\n')
    print('Prepared original map14 c9:', [(r['reference'], len(r['nodes'])) for r in library['resources']])
