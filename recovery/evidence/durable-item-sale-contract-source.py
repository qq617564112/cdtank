"""Capture kind4 whole-instance Item sale sender, codec and receiver."""
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
for name, address, message in [('request', 0x5cb28c, 0x3f8a), ('reply', 0x5cb9b8, 0x3f8b)]:
    slots = struct.unpack_from('<4I', image, address - 0x400000)
    assert image[slots[1] - 0x400000:slots[1] - 0x400000 + 6] == b'\xb8' + struct.pack('<I', message) + b'\xc3'
    vtables[name] = {'address': hex(address), 'messageId': hex(message),
                     'getter': hex(slots[1]), 'reader': hex(slots[2]), 'writer': hex(slots[3])}
assert vtables['request']['reader'] == '0x425ba6'
assert vtables['request']['writer'] == '0x42571f'
assert vtables['reply']['reader'] == '0x498790'
assert vtables['reply']['writer'] == '0x498748'
ranges = {0x495e90: 111, 0x494927: 272, 0x492e5f: 51, 0x439947: 9,
          0x43bddc: 5, 0x43bcb5: 50, 0x43bd1d: 27, 0x4396e0: 130, 0x496ef3: 70, 0x495463: 160,
          0x43d583: 112, 0x43cff8: 73, 0x43d041: 73, 0x43d08a: 73}
instructions = {hex(address): capture(address, size) for address, size in ranges.items()}
asm = lambda address: [row['asm'] for row in instructions[hex(address)]]
assert 'call 0x494927' in asm(0x495e90)
assert 'mov dword ptr [esi], 0x5cb28c' in asm(0x492e5f)
assert asm(0x439947) == ['mov eax, dword ptr [ecx + 0xec]', 'shr eax, 1', 'ret']
assert 'cmp dword ptr [esi + 0x10], 1' in asm(0x495463)
assert 'call 0x43d583' in asm(0x495463)
assert 'mov eax, 0x495463' in asm(0x496ef3)
for address in [0x43cff8, 0x43d041, 0x43d08a]:
    assert 'push 1' in asm(address) and 'call 0x4f14f5' in asm(address)
    assert not any('0x10]' in text for text in asm(address))
assert struct.unpack_from('<I', image, 0x5c4d10 - 0x400000)[0] == 0x43bd1d
assert [text for text in asm(0x43bd1d) if text.startswith('call ')] == ['call 0x57a6c7']
result = {
    'status': 'SOURCE_QUALIFIED_KIND4_DURABLE_ITEM_WHOLE_INSTANCE_SALE',
    'binary': 'CDTank/CDTank.exe', 'vtables': vtables,
    'dispatcher': '495e90(kind4,nonzeroinstance)→494927; kind3 partial quantity excluded',
    'request': {'messageId': '0x3f8a', 'constructor': '492e5f',
                'fields': [{'name': 'instanceId', 'offset': '0xc', 'bits': 32}],
                'quantityOrQuote': False, 'codecReuse': 'owned-role-sale-contract-source.json42571f/425ba6'},
    'provider': {'wrapper': '43bddc calls Inventory virtual+3c with requestedinstance',
                 'returnedIdentity': '494927 reads returned Itemrecord+c for4396e0 category, then439947 samepointer+ec for ItemMoney',
                 'qualificationReuse': 'part-maintenance-contract-source.json selection cost provider43bddc and Item loader439b55 column20→ec',
                 'noOwnedRecordFieldReinterpretation': 'Itemrecord+ec is catalog money; MyItem+10 remains durableminutes.'},
    'quote': {'function': '439947', 'formula': 'uint32(ItemMoney) >>>1',
              'signed': False, 'minutesMultiplier': False, 'instanceCount': 1,
              'example14003': {'itemMoney': 2000, 'saleMoney': 1000}},
    'senderGates': {'mode': 2, 'inventoryProviderRequired': True, 'localProfileRequired': True,
                    'inventoryCategories': [3, 4, 5],
                    'definitionRanges': [[10001,12000],[12001,13000],[13001,18000]],
                    'moneySelector': 26, 'balanceCheck': 'uint32(money+quote) <=999999999',
                    'moneyMaximumFeedback': 0,
                    'breakOrEquippedStateRead': False,
                    'otherLocalRejections': 'returnfalse without result callback',
                    'serverEligibility': 'not supplied by this client gate'},
    'reply': {'messageId': '0x3f8b',
              'fields': [{'name':'instanceId','offset':'0xc','bits':32},
                         {'name':'result','offset':'0x10','bits':8},
                         {'name':'money','offset':'0x14','bits':32}],
              'successResult': 1,
              'registration': '496ef3→491b90 binds495463→48baff',
              'receiver': '495463 success1 replaces complete profilemoney selector26 before lookup/removal',
              'removal': '43bddc(instance)→Itemrecord+c→4396e0→43d583(instance,1,category)',
              'wholeInstanceRoutes': {'3':'43cff8 vector+2c','4':'43d041 vector+3c','5':'43d08a vector+5c'},
              'recordDestructor': 'MyItem constructor43bcb5 setsvtable5c4d10, firstslot43bd1d restoresvtable andconditionally callsoperator delete57a6c7 only; no profilecleanup.',
              'eraseSemantics': 'Each route matches ownedrecord+4 instance, calls deleting destructor then vectorerase4f14f5; no minute/count decrement.',
              'otherResults': 'No money/inventorymutation; result forwarded toowner+5c callback.',
              'callback': 'owner+5c virtual+8(result)',
              'profileOffsetReuse': 'owned-role-sale-contract-source.json selector26 rawmoney70/interface90/containerb0'},
    'limits': ['Original server authorization, payout generation, atomic sale and persistence remain unavailable.',
               'No Break or equipped-state prohibition is established by494927; server restrictions require explicit reconstruction.',
               'Fullprofile/slotcleanup is not written by495463; do not infer auto unequip or cleared selection from inventoryerase.',
               'UI feedback labels beyond sender moneycapresult0 are not qualified here.',
               'No Pet/Tank sender rerun, native matrix, service, protocol or production modifications.'],
    'instructions': instructions}
(ROOT / 'recovery/output/durable-item-sale-contract-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
