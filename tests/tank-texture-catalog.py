"""Check every exported skin row against the original table and selected DDS."""
import json
from pathlib import Path
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from export_tank_textures import PARTS

WEB = ROOT / 'recovery/output/web-assets'
catalog = json.loads((WEB / 'tank-textures.json').read_text())
originals = json.loads((ROOT / 'recovery/output/verified/tables/tanktexture.json').read_text())['rows']
inventory = {item['key']: item for item in json.loads(
    (ROOT / 'recovery/output/catalog/inventory.json').read_text())}
assert len(catalog['rows']) == len(originals) == 711
assert len({row['recordId'] for row in catalog['rows']}) == len(originals)
assert catalog['initialXYVariant'] == 'A'
resolved, missing = 0, 0
for row, original in zip(catalog['rows'], originals):
    values = original['values']
    record_id = original['recordId']
    assert row['recordId'] == record_id
    assert row['tankId'] == record_id // 10000
    assert row['part'] == PARTS[record_id % 10]
    assert row['filename'] == values['文件名称']
    assert row['name'] == values['贴图名称']
    assert row['rarity'] == int(values['稀有度'])
    assert row['moneyPrice'] == int(values['购买金钱价'])
    assert row['tokenPrice'] == int(values['购买代币价'])
    assert row['selectable'] == (int(values['稀有度']) != 0)
    request = f"role/{record_id // 10000:03}/{values['文件名称']}"
    expected = {'A': request}
    if record_id % 10 == 3:
        expected['B'] = request[:-5] + 'B' + request[-4:]
    else:
        assert row['textures']['B'] is None
    for variant, expected_request in expected.items():
        texture = row['textures'][variant]
        key = str(Path(expected_request).with_suffix('.dds')).lower()
        assert texture['request'] == expected_request
        assert texture['source'] == key
        item = inventory.get(key)
        selected = item.get('selected') if item else None
        if not selected:
            missing += 1
            assert texture['asset'] is None
            assert texture['status'] == ('unresolved-source' if item else 'missing-source')
            continue
        resolved += 1
        assert texture['status'] == 'resolved'
        assert selected['path'].replace('\\', '/').lower() == key
        asset = Path('tank-textures') / Path(selected['path']).with_suffix('.png')
        assert texture['asset'] == asset.as_posix()
        assert (ROOT / selected['source']).is_file()
        assert (WEB / asset).is_file()
        # Exact pixels detect wrong sources, substitute art and conversion collisions.
        with Image.open(ROOT / selected['source']) as dds, Image.open(WEB / asset) as png:
            assert png.format == 'PNG'
            assert png.size == dds.size
            assert png.convert('RGBA').tobytes() == dds.convert('RGBA').tobytes(), key
assert (resolved, missing) == (680, 112)
assert catalog['summary'] == dict(rows=711, requests=792, resolved=680, **{'missing-source': 112})
print(f'PASS {len(originals)} original tanktexture rows and price pairs, {resolved} exact DDS/PNG mappings, {missing} explicit missing sources')
