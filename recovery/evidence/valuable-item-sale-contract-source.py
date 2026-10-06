"""Capture the original kind5/category6 sale boundary and available records."""
import csv
import json
import struct
from pathlib import Path

import capstone
import pefile

ROOT = Path(__file__).resolve().parents[2]
image = pefile.PE(str(ROOT / 'CDTank/CDTank.exe')).get_memory_mapped_image()
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)

def capture(address, size):
    return [{'va': hex(i.address), 'asm': f'{i.mnemonic} {i.op_str}'.rstrip(),
             'bytes': i.bytes.hex()}
            for i in decoder.disasm(image[address - 0x400000:address - 0x400000 + size], address)]

ranges = {0x494bad: 323, 0x4396c2: 30, 0x43bce7: 34,
          0x492f36: 51, 0x495591: 127, 0x496f8c: 78,
          0x43cd5b: 35, 0x43d122: 100}
instructions = {hex(address): capture(address, size) for address, size in ranges.items()}
asm = lambda address: [i['asm'] for i in instructions[hex(address)]]
assert 'cmp eax, 6' in asm(0x494bad)
assert 'mov dword ptr [ebp + 0xc], 1' in asm(0x494bad)
assert 'call 0x4396c2' in asm(0x494bad)
assert 'imul eax, esi' in asm(0x494bad)
assert 'call 0x43cd5b' in asm(0x494bad)
assert 'cmp dword ptr [esi + 0x14], 2' in asm(0x495591)
assert 'push 6' in asm(0x495591)
assert 'call 0x43d583' in asm(0x495591)
assert 'sub eax, dword ptr [ebp + 0xc]' in asm(0x43d122)
vtables = {}
for name, address, message in [('request', 0x5cb2b4, 0x3f8e), ('reply', 0x5cba08, 0x3f8f)]:
    slots = struct.unpack_from('<4I', image, address - 0x400000)
    assert image[slots[1] - 0x400000:slots[1] - 0x400000 + 6] == b'\xb8' + struct.pack('<I', message) + b'\xc3'
    vtables[name] = {'address': hex(address), 'messageId': hex(message),
                     'getter': hex(slots[1]), 'reader': hex(slots[2]), 'writer': hex(slots[3])}
assert vtables['request']['reader'] == '0x492d9f'
assert vtables['reply']['reader'] == '0x498aa2'
with (ROOT / 'recovery/output/verified/tables/item.csv').open(encoding='utf-8-sig', newline='') as stream:
    records = [{key: row[key] for key in ['ItemTableID', 'ItemName', 'ItemMoney', 'ItemCoin', 'GGet', 'Durable', 'Break', 'BattleUseMax', 'ItemSkill1', 'ItemSkill2']}
               for row in csv.DictReader(stream) if 20001 <= int(row['ItemTableID']) <= 22000
               or 30001 <= int(row['ItemTableID']) <= 33000]
catalog = json.loads((ROOT / 'recovery/output/web-assets/combat-catalog.json').read_text())
acquisition_skills = [{key: row[key] for key in ['skillId', 'triggerType', 'target', 'attributes', 'functions']}
                      for row in catalog['skills'] if row['skillId'] in [20001, 20002, 30005]]
result = {
    'status': 'SOURCE_QUALIFIED_KIND5_CATEGORY6_QUANTITY_SALE_ACQUISITION_GAP',
    'binary': 'CDTank/CDTank.exe', 'instructions': instructions, 'vtables': vtables,
    'dispatcherReuse': 'durable-item-sale-contract-source.json:495e90 kind5→494bad(instance,quantity)',
    'sender': {'category': 6, 'definitionRange': [20001, 22000], 'category7Accepted': False,
               'mode': 2, 'requiresProfileAndItemProvider': True,
               'quantity': '4396c2 true for20001..21000: requested uint32 checked against existing MyItem+10; missing ownedrecord falls through. 21001..22000: force quantity1.',
               'ownedLookup': '43cd5b vector+70..+74 compares MyItem+4 instance',
               'quote': '439947 unsigned ItemMoney>>1 multiplied by quantity with low32 imul; uint32 money addition<=999999999',
               'excessFeedback': 1, 'moneyCapFeedback': 0,
               'equippedOrBreakProhibition': False},
    'request': {'messageId': '0x3f8e', 'fields': ['instanceId32@c', 'quantity24@10'],
                'codecReuse': 'stack-item-sale-contract-source.json492d6b/492d9f'},
    'reply': {'messageId': '0x3f8f', 'fields': ['instanceId32@c', 'quantity24@10', 'result8@14', 'completeMoney32@18'],
              'codecReuse': 'stack-item-sale-contract-source.json498439/498aa2', 'successResult': 2,
              'registration': '496f8c→491c0c/48baff binds495591',
              'success': 'money selector26 replacement before43d583(instance,replyquantity,6)',
              'callback': 'owner+64 virtual+8(result)',
              'otherResults': 'No money/inventory mutation in495591'},
    'inventory': {'consumer': '43d122', 'vector': '+6c storage,+70begin,+74end',
                  'quantityPredicate': '43bce7 same20001..21000 range',
                  'partial': 'when stackable and owned+10>replyquantity, subtract from+10 only; no battle+20 update',
                  'full': 'otherwise deleting destructor and vectorerase; no profile/hotkey writes in43d122'},
    'sourceRows': records,
    'acquisitionConfiguration': {'skills': acquisition_skills,
                                 'qualificationReuse': 'Existing verified Skill loader and formal combat catalog; no dispatcher or authoritative activation inferred.',
                                 'discrepancy': 'Item20001/20002 description says healing15; skill30005 HP field is30. Neither alone establishes final healing.'},
    'formalAcquisition': {'catalog': 'apps/server/src/accounts/shop-catalog.ts',
                          'consumableShopHasCategory6': False, 'partShopHasCategory6': False},
    'exactGap': 'No qualified normal acquisition producer for20001/20002. Both original prices0; category7 has no source item row and is rejected by this sender. Do not add free BUY availability or category7 whole sale from this contract.',
    'authorityBoundary': 'Original server authorization, payout generation, atomic persistence and acquisition are not supplied by the client sender/receiver.'}
(ROOT / 'recovery/output/valuable-item-sale-contract-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
