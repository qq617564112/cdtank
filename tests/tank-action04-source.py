"""Record original04 actor dispatch and the ordinary hurt entry boundary."""
import json
from pathlib import Path

import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32

pe = pefile.PE('CDTank/CDTank.exe')
image = pe.get_memory_mapped_image()
base = pe.OPTIONAL_HEADER.ImageBase
disassembler = Cs(CS_ARCH_X86, CS_MODE_32)


def read(address, size):
    return image[address - base:address - base + size]


def instructions(start, end):
    return [{'address': hex(row.address), 'bytes': row.bytes.hex(),
             'mnemonic': row.mnemonic, 'operands': row.op_str}
            for row in disassembler.disasm(read(start, end - start), start)]


assert read(0x5c8768, 4) == b'04\0\0'
assert read(0x46c522, 14).hex() == 'c7042468875c00ffd6a340276d00'
assert read(0x468bdd, 14).hex() == 'c7042468875c00ffd6a3c4266d00'
assert read(0x4689b3, 4) == bytes.fromhex('6a046a03')
assert read(0x46c3cf, 4) == bytes.fromhex('6a046a03')
assert read(0x4228c5, 2) == bytes.fromhex('6a01')
assert read(0x4228b9, 2) == bytes.fromhex('6a04')
tanks = json.loads(Path('recovery/output/web-assets/tanks.json').read_text())
actions = [{'tankId': tank['id'], 'part': part['part'],
            'duration': action['duration'], 'asset': action['asset'], 'events': action['events']}
           for tank in tanks for part in tank['components'] for action in part['actions']
           if action['fields']['name'] == '04']
result = {
    'status': 'STATIC_ACTION04_SELECTOR0_ORDINARY_CALLER_GAP',
    'sourceAction': '04', 'sourceIndex': 3,
    'mapping': {'string': '5c8768', 'threePartStore': '468be6→6d26c4',
                'fourPartStore': '46c52b→6d2740'},
    'actorSelectors': [
        {'entry': '46897a', 'actor': 'threePart', 'selector': 0, 'actionIndex': 3, 'flags': 4},
        {'entry': '46c396', 'actor': 'fourPart', 'selector': 0, 'actionIndex': 3, 'flags': 4}],
    'ordinaryHurt': {'entry': '422877', 'inputQuadrants': [0, 1, 2, 3],
                     'actorSelectors': [1, 2, 3, 4], 'actions': ['05', '06', '07', '08'],
                     'selector0Produced': False},
    'ranges': [instructions(0x46c514, 0x46c530), instructions(0x468bdd, 0x468beb),
               instructions(0x468986, 0x4689be),
               instructions(0x46c3a2, 0x46c3da), instructions(0x422892, 0x4228d7)],
    'sourceActions': actions,
    'scope': 'Original direct bytes and source resource index only. No execution, official event, renderer change or player actual. Actor selector0 names04; the verified ordinary quadrant entry always forwards1..4. No reload/braking meaning inferred. A legal producer for actor selector0 remains missing.',
}
Path('recovery/output/tank-action04-source.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'], 'source04 components:', len(actions))
