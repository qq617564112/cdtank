"""Home Weapon entry and its distinct native event boundary."""
import json
from pathlib import Path
import capstone, pefile
ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
def trace(start, end):
    return [{'va': hex(i.address), 'asm': i.mnemonic + ' ' + i.op_str}
            for i in cs.disasm(pe.get_data(start - base, end - start), start)]
assert pe.get_data(0x5d2428 - base, 19).split(b'\0')[0] == b'MyPlayer/rdoWeapon'
result = {
    'status': 'SOURCE_WEAPON_FACTORY_ROW_CONTENT_CONFIRMED',
    'tasks': ['UI36', 'M5-09'],
    'entry': {'control': 'MyPlayer/rdoWeapon', 'ownerMember': '1fc',
              'initialization': trace(0x4df30d, 0x4df347),
              'tooltipBinding': trace(0x4e0554, 0x4e0564), 'tooltipGetter': trace(0x4d925c, 0x4d92fc), 'tooltip': '查看你的武器列表',
              'subscription': trace(0x4e5693, 0x4e5720),
              'selectedCallback': trace(0x4e5041, 0x4e5121)},
    'existingProduction': 'HomeInventory uses classifyInventoryCategory(itemTableId)==2 for Weapon; its current row renders name plus quantity.',
    'itemSourceBoundary': '4e2ea7 invokes43bd13->439762 and accepts kind1, not Weapon2001..4000. Its Item geometry cannot alone prove the Weapon row.',
    'valuableSourceBoundary': {'control': 'MyPlayer/lstPlayerValuable', 'ownerMember': '254',
        'initialization': trace(0x4df81a, 0x4df854),
        'factory': trace(0x4e30f9, 0x4e333b),
        'registry': '[[633588]+120]+6c',
        'rowConstructor': '4b886d',
        'quantity': 'positive unsignedMyItem+10;4d5f95 decimal',
        'equippedOverlay': 'MyItem+1c==2 calls4bbcfd(1)'},
    'weaponFactory': trace(0x4e4bef, 0x4e4eba),
    'weaponRegistry': '[[633588]+120]+1c',
    'acceptedKinds': [3, 4],
    'rowConstructor': '4b886d',
    'inputs': {'name': '4d8366', 'type': '4d83b3/gamestring685+kind', 'quantity': '4d5f95/rawMyItem+10decimal'},
    'sharedRowEvidence': 'recovery/output/home-inventory-row-source.json',
    'geometry': {'width': 161, 'height': 56, 'selectionHeight': 51, 'icon': [5, 8, 32, 32], 'name': [44, 12], 'type': [44, 28], 'quantityRightBottom': [42, 45]},
    'remaining': ['Equipped state2 overlay source is visible in factory but its later draw resource remains outside this row content scope.'],
    'productionChanged': False, 'chromeStarted': False,
    'fixtureReuse': 'Existing legitimate category2 trap checkpoint; no new BUY required.'
}
(ROOT / 'recovery/output/home-weapon-row-source-preparation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
