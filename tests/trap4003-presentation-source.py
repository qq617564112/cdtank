"""Verify original cork4003 victim118 resources and GA20 sound."""
import json
from pathlib import Path
import struct
import sys
import wave

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table
from effect_sav import read_library
from effect_controls import node_timings, particle_controls, sprite_controls

assets = ROOT / 'recovery/output/verified/assets/data'
web = ROOT / 'recovery/output/web-assets'
catalog = json.loads((web / 'combat-catalog.json').read_text())
raw_item = next(row['values'] for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']
                if int(row['values']['ItemTableID']) == 3005)
raw_skill = next(row['values'] for row in read_table(ROOT / 'CDTank/Data/table/skill.dat')['rows']
                 if int(row['values']['SkillTableID']) == 4003)
item = next(row for row in catalog['items'] if row['itemTableId'] == 3005)
skill = next(row for row in catalog['skills'] if row['skillId'] == 4003)
assert int(raw_item['ItemSkill1']) == item['skillIds'][0] == 3005
assert (int(raw_skill['TriggerType']), int(raw_skill['Target']), int(raw_skill['FuncType1']),
        int(raw_skill['FuncT1'])) == (1, 1, 5, 5)
assert (int(raw_skill['Effect1']), raw_skill['Sound1'], int(raw_skill['EffectTag1']),
        int(raw_skill['EffectMethod1'])) == (118, 'GA20', 0, 3)
assert skill['effects'][0] == {'effectId': 118, 'sound': 'GA20', 'tag': 0, 'method': 3}
original = read_library((assets / 'Data/effect/effect.sav').read_bytes())
published = json.loads((web / 'effect-library.json').read_text())
by_id = {node['id']: node for node in original['nodes']}
nodes = []


def collect(node):
    nodes.append(node)
    for child in node['children']:
        collect(by_id[child])


collect(next(node for node in original['nodes'] if node['name'] == '_root\\online\\118'))
assert nodes and nodes[0]['name'] == '_root\\online\\118'
textures = []
for node in nodes:
    assert node == published['nodes'][node['index']]
    timing = next(row for row in published['nodeTimings'] if row['node'] == node['index'])
    assert (timing['field14c'], timing['delay'], timing['lifetime']) == struct.unpack(
        '<Iff', bytes.fromhex(node['fields']))
    if node['type'] not in [1, 6]:
        continue
    grid = next(row for row in published['textureGrids'] if row['node'] == node['index'])
    with Image.open(assets / grid['source']) as source, Image.open(web / grid['asset']) as output:
        assert source.size == output.size
        assert source.convert('RGBA').tobytes() == output.convert('RGBA').tobytes()
        textures.append({'node': node['index'], 'source': grid['source'], 'asset': grid['asset'],
                         'size': source.size, 'identicalDecodedRGBA': True})
sound = next(row for row in json.loads((web / 'audio.json').read_text())['sounds']
             if row['name'] == 'GA20')
assert (ROOT / 'CDTank/Data/sound/GA20.wav').read_bytes() == (web / sound['asset']).read_bytes()
with wave.open(str(web / sound['asset'])) as wav:
    duration = wav.getnframes() / wav.getframerate()
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
image = pe.get_memory_mapped_image()
base = pe.OPTIONAL_HEADER.ImageBase
start, end = 0x42f68d, 0x42f6ed
assert image[0x42f6d5-base:0x42f6dc-base] == bytes.fromhex('6a0068a30f0000')
branch = [{'address': hex(row.address), 'bytes': row.bytes.hex(), 'mnemonic': row.mnemonic, 'operands': row.op_str}
          for row in Cs(CS_ARCH_X86, CS_MODE_32).disasm(image[start-base:end-base], start)]
result = {'status': 'PASS_3005_4003_ORIGINAL118_GA20_SOURCE_ONLY', 'item': item, 'skill': skill,
          'nodes': nodes, 'timings': node_timings(nodes), 'particle': particle_controls(nodes),
          'sprite': sprite_controls(nodes), 'textures': textures,
          'sound': {'name': 'GA20', 'asset': sound['asset'], 'duration': duration, 'identicalWAV': True},
          'observer': {'entry': '42f68d', 'end': '42f6ed', 'current': 'record+127', 'previous': 'role+36b', 'flagIndex': 11, 'skillId': 4003, 'duration': 0, 'condition': 'old!=new && HP>0 && (new==0 || old==new+1)', 'flag6Gate': False, 'instructions': branch},
          'scope': 'Original item/skill118 first slot and complete tree/decoded textures/GA20 WAV. Func5 authority/writer/restoration not proven. Second16/SE15 is not inferred as expiry output; no ordinary trigger or pixels claimed.'}
(ROOT / 'recovery/output/trap4003-presentation-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
print('nodes:', [node['index'] for node in nodes])
