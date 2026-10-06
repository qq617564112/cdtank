"""Verify source-backed ELK boundaries, byte preservation and missing coverage."""
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from export_effect_links import export, read_links

result = export()
assert len(result['files']) == 20
assert result['missingTankCodes'] == ['154']
assert result == json.loads((ROOT / 'recovery/output/web-assets/effect-links.json').read_text())
records = []
for file in result['files']:
    raw = (ROOT / 'recovery/output/verified/assets/data' / file['path']).read_bytes()
    rebuilt = struct.pack('<I', len(file['groups']))
    for group in file['groups']:
        rebuilt += struct.pack('<II', group['key'], len(group['actions']))
        for action in group['actions']:
            rebuilt += action['name'].encode().ljust(16, b'\0')
            rebuilt += struct.pack('<I', len(action['records']))
            for record in action['records']:
                data = bytes.fromhex(record['raw'])
                assert len(data) == 660
                assert raw[record['offset']:record['offset'] + 660] == data
                rebuilt += data
                records.append(record)
    assert rebuilt == raw, file['tankCode']
    for bad in [raw[:-1], raw + b'\0']:
        try:
            read_links(bad)
        except ValueError:
            pass
        else:
            raise AssertionError('malformed ELK accepted')
assert len(records) == 23
assert {r['field04String'] for r in records} == {'_root\\online\\004', '_root\\online\\006'}
assert {r['field148String'] for r in records} == {'tag_efattack', 'tag_efcenter', ''}
print('PASS: 20 ELK, 23 raw records, full byte reconstruction, malformed bounds, missing 154')
