"""Publish map0004's original obj05466 c9 through its accepted same-model library."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'recovery/output/web-assets'
REFERENCE = 'Data/scnobj/obj05466/c9.CVD'


def export():
    library = json.loads((WEB / 'scene-breach-0007.json').read_text())
    resource = next(r for r in library['resources'] if r['reference'] == REFERENCE)
    result = dict(library, resources=[resource])
    (WEB / 'scene-breach-0004.json').write_text(json.dumps(result, ensure_ascii=False) + '\n')
    return result


if __name__ == '__main__':
    result = export()
    print('Published0004 original05466 c9:', len(result['resources'][0]['nodes']), 'nodes')
