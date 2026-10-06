"""Recover original17033 passive13503 effect033 and exact published resources."""
import json
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table
from effect_sav import read_library
from effect_controls import node_timings, particle_controls, sprite_controls

web = ROOT / 'recovery/output/web-assets'
assets = ROOT / 'recovery/output/verified/assets/data'
catalog = json.loads((web / 'combat-catalog.json').read_text())
item = next(row for row in catalog['items'] if row['itemTableId'] == 17033)
skill = next(row for row in catalog['skills'] if row['skillId'] == 13503)
raw_item = next(row['values'] for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']
                if int(row['values']['ItemTableID']) == 17033)
raw_skill = next(row['values'] for row in read_table(ROOT / 'CDTank/Data/table/skill.dat')['rows']
                 if int(row['values']['SkillTableID']) == 13503)
assert int(raw_item['ItemType']) == item['itemType'] == 12
assert int(raw_item['ItemSkill1']) == item['skillIds'][0] == 13503
assert (int(raw_item['ItemMoney']), int(raw_item['ItemCoin'])) == (item['moneyPrice'], item['tokenPrice']) == (1500, 150)
assert (int(raw_skill['TriggerType']), int(raw_skill['Target']), int(raw_skill['FuncType1']), int(raw_skill['FuncT1'])) == (0, 1, 1, 65535)
assert (int(raw_skill['Effect1']), raw_skill['Sound1'], int(raw_skill['EffectTag1']), int(raw_skill['EffectMethod1'])) == (33, '0', 0, 3)
assert skill['effects'][0] == {'effectId': 33, 'sound': '0', 'tag': 0, 'method': 3}
original = read_library((assets / 'Data/effect/effect.sav').read_bytes())
published = json.loads((web / 'effect-library.json').read_text())
by_id = {node['id']: node for node in original['nodes']}
nodes = []
def collect(node):
    nodes.append(node)
    for child in node['children']:
        collect(by_id[child])
collect(next(node for node in original['nodes'] if node['name'] == '_root\\online\\033'))
textures = []
for node in nodes:
    assert node == published['nodes'][node['index']]
    if node['type'] not in [1, 6]:
        continue
    grid = next(row for row in published['textureGrids'] if row['node'] == node['index'])
    with Image.open(assets / grid['source']) as source, Image.open(web / grid['asset']) as output:
        assert source.size == output.size
        assert source.convert('RGBA').tobytes() == output.convert('RGBA').tobytes()
        textures.append({'node': node['index'], 'source': grid['source'], 'asset': grid['asset'],
                         'size': source.size, 'identicalDecodedRGBA': True})
result = {'status': 'PASS_17033_13503_ORIGINAL033_SOURCE_ONLY', 'item': item, 'skill': skill,
          'nodes': nodes, 'timings': node_timings(nodes), 'particle': particle_controls(nodes),
          'sprite': sprite_controls(nodes), 'textures': textures, 'sound': '0',
          'queueSourceReuse': ['skill-effect-queue-native.json', 'effects-role-queue-reentry.json'],
          'authorityGap': 'passive-part-effects.ts currently filters only13501/13502; no formal13503 snapshot qualification.',
          'scope': 'Original item/skill and complete effect033 bytes/decoded texture verification. Existing original13501..13506 queue lifecycle reused; no authority, ordinary trigger, pixels or audio output claim.'}
(ROOT / 'recovery/output/queued-part13503-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
print('nodes:', [node['index'] for node in nodes])
