"""Capture the original owned Pet/Tank sale request and receipt contract."""
import json
import struct
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[2]
image = pefile.PE(str(ROOT / 'CDTank/CDTank.exe')).get_memory_mapped_image()
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

def capture(address, size):
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(),
             'asm': f'{i.mnemonic} {i.op_str}'.rstrip()}
            for i in decoder.disasm(image[address - 0x400000:address - 0x400000 + size], address)]

tables = {'petRequest': (0x5cb214, 0x3f7e), 'petReply': (0x5cb8c8, 0x3f7f),
          'tankRequest': (0x5cb23c, 0x3f82), 'tankReply': (0x5cb918, 0x3f83)}
vtables = {}
for name, (address, message_id) in tables.items():
    slots = struct.unpack_from('<4I', image, address - 0x400000)
    assert image[slots[1] - 0x400000:slots[1] - 0x400000 + 6] == b'\xb8' + struct.pack('<I', message_id) + b'\xc3'
    vtables[name] = {'address': hex(address), 'messageId': hex(message_id),
                     'getter': hex(slots[1]), 'reader': hex(slots[2]), 'writer': hex(slots[3])}

ranges = {0x4b1e1d: 47, 0x4af7f9: 125, 0x4aee9c: 24,
          0x4b4278: 102, 0x4b46f9: 44, 0x4b269e: 27,
          0x495e90: 111, 0x493e7e: 313, 0x494150: 310,
          0x41e9f1: 73, 0x421f88: 72, 0x43a792: 9, 0x43b4bd: 9,
          0x42571f: 28, 0x425ba6: 21, 0x498748: 72, 0x498790: 59,
          0x491a1c: 62, 0x491a98: 62, 0x496d45: 50, 0x496ddb: 50,
          0x49514f: 123, 0x495242: 120, 0x41f05a: 79, 0x422565: 79,
          0x4b1c95: 140, 0x4b2577: 142, 0x4b803f: 43,
          0x42fdc5: 15}
instructions = {hex(a): capture(a, n) for a, n in ranges.items()}
for receiver, remove in [(0x49514f, 'call 0x41f05a'), (0x495242, 'call 0x422565')]:
    asm = [i['asm'] for i in instructions[hex(receiver)]]
    assert 'cmp dword ptr [edi + 0x10], 2' in asm and remove in asm
    assert 'push 0x1a' in asm and 'push dword ptr [edi + 0x14]' in asm

result = {
    'status': 'SOURCE_QUALIFIED_OWNED_PET_TANK_SALE_REQUEST_RECEIPT',
    'binary': 'CDTank/CDTank.exe', 'vtables': vtables,
    'request': {'fields': [{'name': 'instanceId', 'offset': '0xc', 'bits': 32}],
                'pet': '4af7f9 reads selected row+9c into page+24; confirmation4aee9c passes kind1 to495e90→493e7e',
                'tank': 'owned mode1 confirmation4b42aa/4b46fe→4b269e passes page+1a0/kind2 to495e90→494150',
                'quantityOrClientQuote': False},
    'quote': {'pet': 'owned instance→41e9f1→PetTable type+8→43a792: signed PetMoney+50 /2 truncates toward zero',
              'tank': 'owned instance→421f88→TankTable type+24→43b4bd: signed TankMoney+48 /2 truncates toward zero',
              'reuse': ['pet-shop-owned-price-native.json', 'tank-shop-owned-price-native.json']},
    'senderGates': {'mode': 2, 'ownedInstanceRequired': True,
                    'petSelectedSelector': 28, 'tankSelectedSelector': 29,
                    'selectedInstanceRejectionCallback': 0,
                    'moneySelector': 26, 'moneyPlusQuoteMaximum': 999999999,
                    'overMaximumCallback': 1},
    'reply': {'fields': [{'name': 'instanceId', 'offset': '0xc', 'bits': 32},
                         {'name': 'result', 'offset': '0x10', 'bits': 8},
                         {'name': 'money', 'offset': '0x14', 'bits': 32}],
              'successResult': 2,
              'petReceiver': '49514f: result2 writes full profile money selector26 then41f05a(instance) removes/frees owned pet; callback owner+44(result)',
              'tankReceiver': '495242: result2 writes full profile money selector26 then422565(instance) removes/frees owned tank; callback owner+4c(result)',
              'otherResults': 'No balance/owned mutation here; result forwarded to UI callback',
              'profileOffsets': {'rawRecord': {'money': '0x70', 'selectedPet': '0x84', 'selectedTank': '0x88'},
                                 'profileInterface': {'money': '0x90', 'selectedPet': '0xa4', 'selectedTank': '0xa8'},
                                 'container': {'money': '0xb0', 'selectedPet': '0xc4', 'selectedTank': '0xc8'},
                                 'identity': '5c4118+18→42fdc5 adds0x20→42029e; setter+30→42fdea adds0x20→420551; profile interface itself is container+20',
                                 'reuse': ['role-recompute-sources-native.json', 'tank-maintenance-profile-wrapper-native.json']},
              'petUi': '4b1c95 result2 refreshes profile/list, selects owned radio, displays label736',
              'tankUi': '4b803f registers4b2577 via49159e at owner+4c; result2 refreshes and selects owned radio, displays label84',
              'feedback': {'confirmationPet709': '你确定出售这只猫狗吗？', 'confirmationTank713': '你确定出售这辆坦克吗？',
                           'result0Pet626': '无法出售出击中猫狗。', 'result0Tank627': '无法出售出击中坦克。',
                           'result1Both143': '哇，大富翁！你的金钱太多，放不下了。', 'result3Both706': '系统发生未知错误！'},
              'feedbackSource': 'verified/tables/gamestring.csv; result0/1 are also exact sender preconditions, result3 server cause remains unqualified'},
    'limits': ['Original server sale authorization, atomic settlement, persistence and reply generation are unavailable.',
               'Fee qualification is client-side; server payout equality requires a declared reconstruction or original server evidence.',
               'Selected-instance prohibition is qualified; no original auto-selection fallback is inferred.',
               'No protocol, production, service, browser or new native matrix executed.'],
    'instructions': instructions}
(ROOT / 'recovery/output/owned-role-sale-contract-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
