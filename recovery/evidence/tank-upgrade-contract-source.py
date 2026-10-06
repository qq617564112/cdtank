"""Capture the named TankUp fee loader and original upgrade messages."""
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

vtables = {}
for name, address, message_id in [('request', 0x5cb1d8, 0x3f94), ('reply', 0x5cba80, 0x3f95)]:
    slots = struct.unpack_from('<4I', image, address - 0x400000)
    assert image[slots[1] - 0x400000:slots[1] - 0x400000 + 6] == b'\xb8' + struct.pack('<I', message_id) + b'\xc3'
    vtables[name] = {'address': hex(address), 'messageId': hex(message_id),
                     'getter': hex(slots[1]), 'reader': hex(slots[2]), 'writer': hex(slots[3])}

ranges = {0x49393e: 542, 0x413cef: 15, 0x41c49f: 20,
          0x43b8db: 54, 0x43b911: 128, 0x4898e2: 50,
          0x49900b: 122, 0x498f75: 150, 0x495970: 249}
result = {
    'status': 'SOURCE_QUALIFIED_TANK_UPGRADE_FEE_REQUEST_RECEIPT',
    'vtables': vtables,
    'costLoader': {'managerGetter': '413cef game114+90', 'managerConstruction': '41c49f→41b197',
                   'recordFactory': '43b8db→43b862/vtable5c4cec', 'loader': '43b911',
                   'columns': {'0xc': '等級', '0x10': '花費金錢', '0x14': '花費創意點數',
                               '0x18': '失敗率', '0x1c': '成功率'},
                   'native': 'tank-upgrade-cost-loader-native.json'},
    'fee': {'rowKey': 'owned current rank+1',
            'money': 'unsigned32 low product(TankTable+48 * TankUp+10) /100 integer division',
            'originality': 'TankUp+14 rawuint32', 'walletSelectors': {'money': 26, 'originality': 31}},
    'request': {'sender': '49393e', 'fields': ['action8 at+c', 'ownedInstance32 at+10'],
                'actions': {'1': 'attack: requires owned+38 nonzero; rank+44 <255',
                            '2': 'armor: requires owned+48 nonzero; rank+54 <255'},
                'localCodes': {'3': 'rank cap or missing next table row', '4': 'insufficient money',
                               '5': 'insufficient originality', '6': 'upgrade field disabled'},
                'note': 'Missing attack/armor listener at disabled/rank rejection can fall through to send; documented as client code, not server authority.'},
    'reply': {'receiver': '495970', 'fields': ['action8', 'instance32', 'fullMoney32', 'fullOriginality16',
                                             'returnedAttribute16', 'returnedBonus16', 'result8'],
              'wallet': 'Selectors26/31 replaced before result branch when profile and owned instance exist',
              'result0': 'increment attack rank+44 or armor rank+54; write reply1c/20 to attack3c/40 or armor4c/50',
              'result2': 'decrement corresponding rank and write same returned attribute/bonus fields',
              'other': 'rank and attributes unchanged; action-specific callback+70/+74 forwards result'},
    'limits': ['Original server outcome sampler and returned attribute/bonus formula are not recovered.',
               'Rank3 source rates10/89 do not determine an exclusive100-point sampling rule; no normalization is inferred.',
               'Owned attack/armor activation producers at38/48 remain unqualified; new normal purchases currently carry zero.',
               'No production, service, protocol or browser changes; native loader result is reused without rerun.'],
    'instructions': {hex(a): capture(a, n) for a, n in ranges.items()}}
(ROOT / 'recovery/output/tank-upgrade-contract-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
