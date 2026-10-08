"""Publish the original Breach fallback destruction resources."""
import json
from pathlib import Path

from export_scene_breach_catalog import export


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'
MODELS = ('obj05438', 'obj05440', 'obj05441', 'obj05446', 'obj05463')


def main():
    placements = json.loads((WEB / 'scene-placements.json').read_text())
    library = export(placements, SOURCE, WEB, MODELS)
    (WEB / 'scene-placements.json').write_text(
        json.dumps(placements, ensure_ascii=False, indent=2), encoding='utf-8')
    bindings = sum(len(resource['nodes']) for resource in library['resources'])
    print('Published', len(library['resources']), 'Breach destruction models,',
          bindings, 'CVD nodes,',
          sum(len(resource['placements']) for resource in library['missingResources']),
          'missing placements')


if __name__ == '__main__':
    main()
