"""Capture the original kind4 maintenance branch and Item fee fields."""
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
    return [{'va': hex(i.address), 'bytes': i.bytes.hex(),
             'asm': f'{i.mnemonic} {i.op_str}'.rstrip()}
            for i in decoder.disasm(image[address - 0x400000:address - 0x400000 + size], address)]

with (ROOT / 'recovery/output/verified/tables/item.csv').open(encoding='utf-8-sig', newline='') as stream:
    row = next(row for row in csv.DictReader(stream) if row['ItemTableID'] == '14003')
assert [int(row[key]) for key in ['ItemMoney', 'ItemCoin', 'Durable', 'Break']] == [2000, 200, 3, 1]
ranges = {0x5183b3: 112, 0x439c5c: 94, 0x439898: 173, 0x439aa5: 176,
          0x4936fd: 229, 0x495612: 242, 0x519d0b: 676, 0x51995d: 179, 0x4d849e: 171}
instructions = {hex(a): capture(a, n) for a, n in ranges.items()}
assert 'div ecx' in [i['asm'] for i in instructions['0x439898']]
assert 'add dword ptr [eax + 0x10], ecx' in [i['asm'] for i in instructions['0x495612']]
assert 'mov dword ptr [esi + 0xfc], eax' in [i['asm'] for i in instructions['0x439c5c']]
result = {
    'status': 'SOURCE_QUALIFIED_KIND4_ITEM_MAINTENANCE_REQUEST_RECEIPT_COST',
    'clientBranch': '5183b3 buttons6..11: page+30 selected row+9c→4935dc(kind4,instance,days,currency)',
    'request': {'reuse': 'tank-maintenance-contract-source.json', 'messageId': '0x3f90',
                'fields': ['instance32', 'kind8=4', 'days8=1|7|30', 'currency8=0rawCoin|1money']},
    'eligibility': {'lookup': 'Inventory43d1a5(instance)→owned+c ItemTableID→413c74/411068',
                    'cannotMend': 'Itemrecord+fc ==3 → feedback kind4/result3; no request',
                    'loader': '439b55 same column sequence:20/ec ItemMoney,21/f0 ItemCoin,22/f4 GGet,23/f8 Durable,24/fc Break',
                    'maximumMinutes': 367200, 'ownedDurationField': '0x10',
                    'newDurationCheck': 'uint32(owned10+days1440) <=367200',
                    'insufficientRawCoinResult': 0, 'insufficientMoneyResult': 1, 'durationCapResult': 2},
    'cost': {'function': '439898', 'weekCoin': 'uint32 ItemCoin+f0',
             'weekMoney': 'low32(ItemMoney+ec × DataScale48.Max)',
             'day1': 'unsigned32 weekly /5 floor (unlike Tank signed division)',
             'day7': 'weekly', 'day30': 'low32 weekly <<1',
             'dataScaleSource': 'verified/tables/datascale.csv ID48 Min50 Max50; original loader qualification reused'},
    'display': {'selectionSetter': '519d0b', 'provider': 'selected row+9c→Inventory43bddc virtual+3c→same Itemrecord',
                'coin': '439aa5 loads unsigned ItemCoin+f0; days1/7/30 multiply double .02/.1/.2; sprintf %.1f→43079b→4b4ad2→controls+84/88/8c',
                'money': '439898 currency1 integer→487c36→controls+90/94/98',
                'successRefresh': '51995d category-specific instance lookup43cd38/43ccf2/43cd15→4d849e remaining days→517716 row setter'},
    'reply': {'reuse': 'tank-maintenance-contract-source.json and tank-maintenance-profile-wrapper-native.json',
              'messageId': '0x3f91', 'success': 4,
              'fields': ['instance32', 'fullRawCoin32', 'fullMoney32', 'days8', 'kind8=4', 'result8'],
              'receiver': '495612 writes full profile selectors7/26 before lookup; kind4→43d1a5(instance) then owned10 +=days1440',
              'otherResults': 'feedback only, no balance or duration write'},
    'example14003': {'rawSource': {key: int(row[key]) for key in ['ItemMoney', 'ItemCoin', 'Durable', 'Break']},
                     'moneyCost1day': 20000, 'rawCoinCost1day': 40, 'coinDisplay1day': 4},
    'wireUnits': {'field': 'InventoryWireRecord.ownedQuantity = original MyItem+10 unsigned24bit',
                  'item14003InventoryCategory': '5 (original4396e0;13001..18000)',
                  'item14003ShortcutCategory': '9 (armor via439762)',
                  'maintenanceKind': 4,
                  'durationConsumer': '4d849e reads same MyItem+10, unsigned division1440 and increments quotient on nonzero remainder; label624（%d天）',
                  'reuse': ['mend-owned-row-source.json', 'mend-owned-part-row-preparation.json', 'mend-owned-part-row-root-review.json'],
                  'stackVsDurable': 'OriginalTradekind2/3 partialquantity versus durable whole record; current accounts/trade allows category1/2 stackamount butcategory>2 onlywholeinstance',
                  'purchaseInitialBoundary': 'CurrentnormalBUY14003 storesraw1 as rebuiltinitial; maintenance extends1→1441minutes onthe sameinstance, not1440pieces or a newinstance'},
    'limits': ['Original server maintenance authorization, atomic debit and persistent duration update remain reconstructed.',
               'Original elapsed-duration producer remains unknown; extending duration does not establish timed decrement.',
               'This captures new kind4 and Item methods; existing Tank quote/codec/native matrices are not rerun.',
               'No production/protocol/service/browser or new native matrix.'],
    'instructions': instructions}
(ROOT / 'recovery/output/part-maintenance-contract-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
