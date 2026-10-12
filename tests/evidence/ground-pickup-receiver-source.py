"""Capture named ground-pickup receivers independently of inventory acquisition."""
import json
import struct
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[2]
image = pefile.PE(str(ROOT / 'CDTank/CDTank.exe')).get_memory_mapped_image()
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

def capture(address, size):
    return [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'.rstrip()}
            for i in decoder.disasm(image[address - 0x400000:address - 0x400000 + size], address)]

packets = {}
for name, address, message in [('item', 0x5c53c8, 0x3c98), ('treasure', 0x5c53f0, 0x3caa)]:
    slots = struct.unpack_from('<4I', image, address - 0x400000)
    assert image[slots[1] - 0x400000:slots[1] - 0x400000 + 6] == b'\xb8' + struct.pack('<I', message) + b'\xc3'
    packets[name] = {'vtable': hex(address), 'type': hex(message),
                     'getter': hex(slots[1]), 'reader': hex(slots[2]), 'writer': hex(slots[3])}
ranges = {0x442595: 142, 0x43fc34: 117, 0x43fca9: 109,
          0x43fe14: 70, 0x43fe8b: 127, 0x41da1d: 179,
          0x441382: 682, 0x44162c: 2021}
instructions = {hex(address): capture(address, size) for address, size in ranges.items()}
asm = lambda address: [i['asm'] for i in instructions[hex(address)]]
assert 'mov eax, 0x441382' in asm(0x442595)
assert 'mov eax, 0x44162c' in asm(0x442595)
assert 'mov dword ptr [0x635668], 0x5c5734' in asm(0x442595)
assert 'mov dword ptr [0x635650], 0x5c5720' in asm(0x442595)
assert 'cmp byte ptr [edi + 0x1c], 0' in asm(0x441382)
assert 'cmp byte ptr [eax + 0x14], bl' in asm(0x44162c)
assert 'call 0x43cdd8' in asm(0x441382)
assert 'call 0x43ce02' in asm(0x44162c)
assert 'call 0x41da1d' in asm(0x43fe14)
assert 'call 0x41dad0' in asm(0x43fe8b)
for address in [0x441382, 0x44162c]:
    assert 'call 0x43c9e5' in asm(address)
    assert 'call 0x457ca0' in asm(address)
    assert not any(text in asm(address) for text in ['call 0x43d583', 'call 0x43d122', 'call 0x440fd7'])
result = {
    'status': 'SOURCE_QUALIFIED_GROUND_PICKUP_RECEIVER_SCENE_REMOVAL_NO_INVENTORY_ACQUISITION',
    'packets': packets, 'instructions': instructions,
    'registration': {'item': '442595 binds441382 with43c228, name5c5734 UMsgPickupItem',
                     'treasure': '4425d7 binds44162c with43c266, name5c5720 UMsgPickupTreasure'},
    'item': {'wire': ['fieldC16', 'field1032', 'field1432', 'field1832', 'success1@1c'],
             'successGate': '441382 requires byte1c nonzero, ItemTable lookup(fieldC) and scene provider',
             'localIdentity': 'field10 compared with413f60; only local feedback is gated',
             'sceneRemoval': 'matches existing manager+9c tree by referenced Itemrecord+c and coordinate window around field14/18;4595f9 removes model name,457ca0 refreshes,optional+c0 callback,43cdd8/free43c9e5 erases scene node',
             'inventoryRecord': False},
    'treasure': {'wire': ['success1@14', 'field1032', 'conditional nested record via41da1d/41dad0'],
                 'nestedStorage': 'reader43fe8b allocates0x58 record via41e16e; separate from MyItem0x30',
                 'successGate': '44162c requires byte14 nonzero, scene provider and matching existing manager+a8 tree node coordinates+48/+50',
                 'localIdentity': 'field10 compared with413f60; local feedback/sound only',
                 'sceneRemoval': 'both local and remote accepted notifications remove two model names via4595f9,refresh457ca0,callback+c0,43ce02/free43c9e5 erases scene node',
                 'inventoryRecord': False},
    'boundary': 'Neither named receiver directly calls inventory sale/decrement/import or writes MyItem quantities. UI and renderer virtual terminals have not been executed; no transitive no-write claim for arbitrary callbacks.',
    'remainingProducer': 'Contact request/eligibility, original server pickup result generation, persistent category6 quantity updates and healing remain unqualified. These success notifications do not establish successful use3c9e or free Shop acquisition.',
    'noProductionOrRuntime': True}
(ROOT / 'recovery/output/ground-pickup-receiver-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
