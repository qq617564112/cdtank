"""Read the original112 resource records for ordinary restraint presentation."""
import json
from pathlib import Path
import struct
import sys
sys.path.insert(0, str(Path('recovery').resolve()))
from effect_sav import Reader
from effect_controls import node_timings, particle_controls, sprite_controls

library = json.loads(Path('recovery/output/web-assets/effect-library.json').read_text())
catalog = json.loads(Path('recovery/output/web-assets/combat-catalog.json').read_text())
raw = Path('recovery/output/verified/assets/data/Data/effect/effect.sav').read_bytes()
by_id = {node['id']: node for node in library['nodes']}
root = next(node for node in library['nodes'] if node['name'] == '_root\\online\\112')
selected = []
def collect(node):
    reader = Reader(raw[node['offset']:node['offset'] + node['size']])
    kind, identifier = reader.uint(), reader.uint()
    name = reader.take(0x144)
    fields = reader.take(12)
    resource = reader.block()
    modifiers = []
    for _ in range(reader.uint()):
        base = reader.block()
        payload = reader.block() if kind in (1, 5, 6, 7, 8, 9) else b''
        modifiers.append({'base': base.hex(), 'payload': payload.hex()})
    children = [reader.uint() for _ in range(reader.uint())]
    assert reader.offset == node['size']
    assert kind == node['type'] and identifier == node['id']
    assert name.hex() == node['nameField'] and fields.hex() == node['fields']
    assert resource.hex() == node['resource'] and modifiers == node['modifiers']
    assert children == node['children']
    selected.append(node)
    for child in children:
        collect(by_id[child])
collect(root)
skill = next(row for row in catalog['skills'] if row['skillId'] == 4001)
assert skill['effects'][0] == {'effectId': 112, 'sound': 'SE44', 'tag': 0, 'method': 3}
assert [node['index'] for node in selected] == [3019, 3020, 3021, 3110]
textures = [row for row in library['textureGrids'] if row['node'] in [3021, 3110]]
assert all(row['resolution'] == 'published' for row in textures)
result = {
    'status': 'PASS_ORIGINAL112_RESOURCE_CONSUMER_CONTRACT',
    'skill': skill,
    'nodes': [{'index': row['index'], 'type': row['type'], 'name': row['name'], 'offset': row['offset'], 'size': row['size']} for row in selected],
    'timings': node_timings(selected),
    'particle': particle_controls(selected),
    'sprite': sprite_controls(selected),
    'textures': textures,
    'originalCaller': 'Existing trap-function-entry-source:42f624 flag9 count decreases→4886aa skill4001/duration0. Existing notification4886aa actor virtual+a8→112/binding3/tag0/oneShot1; sound485b1b SE44/selector1 at victim role position.',
    'formalInput': 'Existing trapTriggered.playSkillEffect{skillId:4001,effectIndex:0,duration:0,roleId:victim numeric ID}; consume via BattleSkillEffects and SkillEffectNotifications.',
    'scope': 'Exact original112 byte records, two drawable nodes and published textures. Reuses established original caller/notification execution; no new native or server policy claim. Slot1 effect017 is not inferred as expiry output. Resource lifetime differs from reconstructed5s restraint.',
}
Path('recovery/output/trap4001-presentation-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
