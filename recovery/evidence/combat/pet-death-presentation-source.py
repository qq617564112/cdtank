"""Compose the accepted death branch with its named actor/tree/resource contract."""
import json
import struct
from pathlib import Path
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

ROOT = Path(__file__).resolve().parents[3]
original = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = original.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)
followup = json.loads((ROOT / 'recovery/output/respawn-followup-sol-native.json').read_text())
assert followup['status'] == 'PASS'
branches = []
for kind, effect in ((1, 119), (2, 120), (3, None)):
    rows = [row for row in followup['rows'] if row['hasRole'] and row['petType'] == kind]
    assert rows
    for row in rows:
        events = [event for event in row['events'] if event['kind'] == 'renderAction']
        assert [event['arguments'] for event in events] == ([] if effect is None else [[effect, 3, 0, 1]])
    branches.append({'petType': kind, 'effectId': effect, 'acceptedNativeCases': len(rows)})
vtables = []
for address in (0x5c8688, 0x5c88c8):
    callee = struct.unpack('<I', original.get_data(address + 0xa8 - base, 4))[0]
    assert callee == 0x467a08
    vtables.append({'vtable': hex(address), 'slot': '0xa8', 'callee': hex(callee)})
lib = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
nodes = {node['id']: node for node in lib['nodes']}
trees = []
for effect in (119, 120):
    root = next(node for node in nodes.values() if node['name'] == f'_root\\online\\{effect:03}')
    selected, todo = {}, [root['id']]
    while todo:
        key = todo.pop()
        if key in selected:
            continue
        selected[key] = nodes[key]
        todo.extend(nodes[key]['children'])
    sprite = next(node for node in selected.values() if node['type'] == 1)
    assert not any(node['type'] == 4 for node in selected.values())
    assert len([node for node in selected.values() if node['type'] != 0]) == 1
    texture = bytes.fromhex(sprite['resource']).split(b'\0')[0].decode('ascii')
    stem = 'catd' if effect == 119 else 'dogd'
    assert texture.lower() == f'data\\effect\\xy\\{stem}.tga'
    asset = f'Data/effect/xy/{stem}.png'
    assert (ROOT / 'recovery/output/web-assets' / asset).is_file()
    controller = next(value for value in lib['spriteControls'] if value['node'] == sprite['index'])
    timing = next(value for value in lib['nodeTimings'] if value['node'] == sprite['index'])
    assert controller['baseStart'] == 2 and controller['baseEnd'] == 5
    assert controller['appearance']['scale'] == [22, 24, 22]
    assert controller['motion']['position'] == [0, 10, 0]
    assert controller['motion']['velocity'] == [0, 45, 0]
    trees.append({'effectId': effect, 'root': root['index'], 'drawable': sprite['index'],
                  'nodes': [{key: value[key] for key in ('index', 'type', 'name')}
                            for value in selected.values()],
                  'textureReference': texture, 'asset': asset,
                  'timing': timing, 'controller': controller, 'soundNodes': []})
source = []
for start, end in ((0x423157, 0x423249), (0x467a08, 0x467a90), (0x43a91c, 0x43a9c4)):
    source.append({'start': hex(start), 'end': hex(end), 'instructions': [
        {'address': hex(i.address), 'bytes': i.bytes.hex(),
         'instruction': (i.mnemonic + ' ' + i.op_str).strip()}
        for i in cs.disasm(original.get_data(start-base, end-start), start)]})
result = {'status': 'PASS_SOURCE_PET_DEATH_BRANCH_TREE_RESOURCE_COMPOSITION',
          'reusedNative': 'recovery/output/respawn-followup-sol-native.json',
          'branches': branches, 'actorDispatch': vtables, 'trees': trees, 'source': source,
          'scope': 'Existing complete death-followup execution is reused without rerunning it. '
                   'Named actor slot and published original tree/resource contracts are composed. '
                   'No formal pet adapter, event integration, ordinary browser draw or original GPU claim.'}
(ROOT / 'recovery/output/pet-death-presentation-source.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
