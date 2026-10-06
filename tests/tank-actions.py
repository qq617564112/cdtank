"""Verify every exported tank component and action against original source data."""
import configparser
import json
import struct
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'recovery'))
from mv3 import read_mv3
from effect_action_keys import action_identifier

root = Path('recovery/output/verified/assets/data')
out = Path('recovery/output/web-assets')
tanks = json.loads((out / 'tanks.json').read_text())
table = json.loads(Path('recovery/output/verified/tables/tank.json').read_text())
assert len(tanks) == len(table['rows']) == 21
actions = absent = 0
for tank, row in zip(tanks, table['rows']):
    assert tank['id'] == int(row['values']['ID'])
    assert tank['name'] == row['values']['TankName']
    assert tank['tankType'] == int(row['values']['TankType'])
    assert [c['part'] for c in tank['components']] == ['M', 'U', 'X', 'Y']
    for component in tank['components']:
        path = root / component['ini']
        config = configparser.ConfigParser()
        config.read(path, encoding='gbk')
        assert len(component['actions']) == len(config.sections())
        if not config.sections():
            assert component['part'] == 'U' and tank['tankType'] == 4
            absent += 1
        for action in component['actions']:
            assert action['fields'] == dict(config[action['section']])
            original = next(p for p in path.parent.iterdir()
                            if p.name.lower() == action['fields']['file'].lower())
            model = read_mv3(original)
            assert action['duration'] == model['duration']
            assert action['primaryTags'] == json.loads(json.dumps([t for t in model['tracks'] if t['name'] in
                {'tag_efcenter', 'tag_effront', 'tag_efback', 'tag_efleft',
                 'tag_efright', 'tag_efsoot', 'tag_efattack'}]))
            assert action['events'] == [dict(time=e['id'], name=e['name'],
                identifier=action_identifier(e['name'])) for e in model['tags']]
            tag = next((t for t in model['tracks'] if t['name'] == 'tag_c'), None)
            pivot = list(tag['frames'][0]['matrix'][:3]) if tag and tag['frames'] else None
            assert action['turretPivot'] == pivot
            assert action['turretPivotFrames'] == (json.loads(json.dumps(tag['frames'])) if tag else None)
            glb = (out / action['asset']).read_bytes()
            size = struct.unpack_from('<I', glb, 12)[0]
            document = json.loads(glb[20:20 + size])
            assert document['extras']['mv3Duration'] == action['duration']
            assert action['asset'].lower() == original.relative_to(root).with_suffix('.glb').as_posix().lower()
            actions += 1
assert actions == 704 and absent == 8
print('PASS: 21 source tanks, 84 INIs, 704 source actions, durations, GLBs and tag_c pivots; 8 source-empty U parts')
