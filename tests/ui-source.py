"""Verify every Web UI crop against the source atlas and original region rectangle."""
import json
from pathlib import Path
from PIL import Image

out = Path('recovery/output/web-assets')
data = json.loads((out / 'ui.json').read_text())
source = json.loads(Path('recovery/output/catalog/layouts.json').read_text())
assert data['layouts'] == source
assert len(data['layouts']) == 65
assert sum(len(layout['windows']) for layout in data['layouts']) == 2000
count = 0
for imageset in data['imagesets']:
    atlas = Image.open(imageset['sourceImage']).convert('RGBA')
    if Path(imageset['sourceImage']).suffix.lower() == '.dds':
        atlas = atlas.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    for region in imageset['images']:
        x, y, width, height = [int(region[k]) for k in ('XPos', 'YPos', 'Width', 'Height')]
        actual = Image.open(out / region['asset']).convert('RGBA')
        assert actual.size == (width, height)
        assert actual.tobytes() == atlas.crop((x, y, x + width, y + height)).tobytes()
        count += 1
assert count == 4347
assert len(data['fonts']) == 12
assert not data['missingImages']
ids = [int(row['values']['ID']) for row in json.loads(Path('recovery/output/verified/tables/pet.json').read_text())['rows']]
assert [portrait['petId'] for portrait in data['portraits']] == ids
matched = []
for portrait in data['portraits']:
    if not portrait['asset']:
        continue
    imageset = next(s for s in data['imagesets'] if s['path'] == portrait['imageset'])
    region = next(r for r in imageset['images'] if r['Name'] == portrait['region'])
    assert region['asset'] == portrait['asset']
    assert region['Name'] == f'data\\ui\\{portrait["petId"]}\\{portrait["petId"]}_normal.tga'
    matched.append(portrait['petId'])
assert matched == [1, 2, 3, 4, 5, 101, 102, 103, 104, 105]
remote_matched = []
for portrait in data['portraits']:
    if not portrait['remoteAsset']:
        assert portrait['remoteImageset'] is None and portrait['remoteRegion'] is None
        continue
    imageset = next(s for s in data['imagesets'] if s['path'] == portrait['remoteImageset'])
    assert imageset['attributes']['Name'] == 'zhandou00'
    region = next(r for r in imageset['images'] if r['Name'] == portrait['remoteRegion'])
    assert region['Name'] == f'data\\ui\\zhandou\\{portrait["petId"]}_normal1.tga'
    assert region['asset'] == portrait['remoteAsset'] and portrait['asset'] != portrait['remoteAsset']
    remote_matched.append(portrait['petId'])
assert remote_matched == matched
for portrait in data['portraits']:
    for expression, asset in portrait['expressions'].items():
        if portrait['petId'] not in matched:
            assert asset is None
            continue
        imageset = next(s for s in data['imagesets'] if s['path'] == portrait['imageset'])
        region = next(r for r in imageset['images'] if r['Name'] ==
                      f'data\\ui\\{portrait["petId"]}\\{portrait["petId"]}_{expression}.tga')
        assert asset == region['asset']
death_set = next(s for s in data['imagesets'] if s['attributes']['Name'] == 'zhandou00'
                 and 'imagesets_dds/' in s['path'])
for kind, name in [('local', 'die'), ('remote', 'die_2')]:
    region = next(r for r in death_set['images'] if r['Name'] == f'data\\ui\\zhandou\\{name}.tga')
    assert data['portraitDeath'][kind] == region['asset']
# Read original format constants rather than inferring the atlas from Web naming.
import pefile
exe = pefile.PE('CDTank/CDTank.exe')
for address, expected in [(0x5d1264, b'normal1'), (0x5d1248, b'data\\ui\\zhandou\\%d_%s.tga'),
                          (0x5c8264, b'zhandou00'), (0x5d12c8, b'%d0'),
                          (0x5d1240, b'die_2'), (0x5d1284, b'die')]:
    assert exe.get_data(address - exe.OPTIONAL_HEADER.ImageBase, len(expected) + 1) == expected + b'\0'
print(f'PASS: 65 source layouts/2000 controls, {count} exact RGBA crops and 12 bitmap/dynamic font definitions')
print('PASS: original executable formats, 10 expressive / 10 remote pet portraits')
