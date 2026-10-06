"""Compose keyboard sources with existing native dispatch evidence, without emulation."""
from pathlib import Path
import configparser
import json

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'recovery/output'
poll = json.loads((OUTPUT / 'role-key-poll-source-native.json').read_text())
dispatch = json.loads((OUTPUT / 'movement-input-clock-native.json').read_text())
assert poll['status'] == 'PASS_ORIGINAL_KEY_POLL_SOURCE'
assert dispatch['status'] == 'PASS'
config = configparser.ConfigParser()
config.read(ROOT / 'CDTank/Config/SystemSetting.ini', encoding='gb18030')
binding = {name: int(config['KeySetting'][name]) for name in (
    'MainUp', 'MainDown', 'MainLeft', 'MainRight',
    'AttachedUp', 'AttachedDown', 'AttachedLeft', 'AttachedRight')}
bits = {name: row['actualBits'] for row in poll['rows']
        if (name := row['name']) in binding}
assert len(bits) == 8
cases = [
    ('idle-before-movement', [], 0, None),
    ('release-after-movement', [], 1, 0),
    ('primary-forward-attached-left', ['MainUp', 'AttachedLeft'], 0, 6),
    ('attached-forward-primary-right', ['AttachedUp', 'MainRight'], 0, 5),
    ('primary-back-attached-left', ['MainDown', 'AttachedLeft'], 0, 8),
    ('attached-back-primary-right', ['AttachedDown', 'MainRight'], 0, 7),
    ('primary-forward-attached-back-conflict', ['MainUp', 'AttachedDown'], 0, 1),
    ('attached-forward-primary-back-conflict', ['AttachedUp', 'MainDown'], 0, 1),
    ('primary-right-attached-left-conflict', ['MainRight', 'AttachedLeft'], 0, 3),
    ('attached-right-primary-left-conflict', ['AttachedRight', 'MainLeft'], 0, 3),
    ('same-direction-primary-attached', ['MainLeft', 'AttachedLeft'], 0, 3),
    ('all-primary-attached-directions', list(binding), 1, 6),
]
rows = []
for name, fields, previous, expected in cases:
    merged = 0
    for field in fields:
        merged |= bits[field]
    reused = [row for row in dispatch['inputRows']
              if row['bits'] == merged and row['previous'] == previous]
    assert len(reused) == 2
    for row in reused:
        commands = [call['command'] for call in row['commands']]
        assert commands == ([] if expected is None else [expected])
        assert bool(row['idle']) == (merged == 0)
    rows.append({'name': name, 'fields': fields,
                 'keys': [binding[field] for field in fields],
                 'mergedBits': merged, 'previousMoving': previous,
                 'command': expected, 'reusedDispatchRows': reused,
                 'classification': 'composition of native poll and existing dispatch rows; not a joint physical-key run'})

result = {
    'status': 'PASS_EXISTING_SOURCE_COMPOSITION',
    'sources': ['role-key-poll-source-native.json', 'movement-input-clock-native.json'],
    'rows': rows,
    'scope': 'No native rerun, production changes or player acceptance. Installed bindings are inputs; OS event order and input initialization remain outside this contract.',
}
(OUTPUT / 'role-key-source-composition.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'], len(rows))
