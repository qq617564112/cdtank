"""Check two original water resources and each published caustic texture."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'recovery/output/verified/assets/data'
WEB = ROOT / 'recovery/output/web-assets'
resource = json.loads((WEB / 'scene-water-0002.json').read_text())
assert resource['mapId'] == 2
assert [g['name'] for g in resource['geometry']] == ['water', 'waves']
assert [t['index'] for t in resource['textures']] == list(range(32))
rows = []
for texture in resource['textures']:
    with Image.open(SOURCE / texture['reference']) as original, Image.open(WEB / texture['asset']) as published:
        a, b = original.convert('RGBA'), published.convert('RGBA')
        assert a.size == b.size and a.tobytes() == b.tobytes()
        rows.append(dict(index=texture['index'], size=a.size, decodedRGBAEqual=True))
for geometry in resource['geometry']:
    assert (SOURCE / geometry['reference']).is_file()
    assert (WEB / geometry['asset']).is_file()
result = dict(status='PASS_RESOURCE_SOURCE', textures=rows, geometry=resource['geometry'],
              scope='Original DDS decodedRGBA and published library. Existing two POL conversions reused; no loader, player, draw or pixel acceptance.')
(ROOT / 'recovery/output/scene-water02-source.json').write_text(json.dumps(result, indent=2)+'\n')
print('PASS_RESOURCE_SOURCE: two original geometry references;32 decodedRGBA-equal caustic textures')
