"""Original Home Valuable tab, list, count and shortcut subtree."""
import json
from pathlib import Path
import capstone, pefile
ROOT = Path(__file__).resolve().parents[3]
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
cs = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
def trace(start, end):
    return [{'va': hex(i.address), 'asm': i.mnemonic + ' ' + i.op_str}
            for i in cs.disasm(pe.get_data(start - 0x400000, end - start), start)]
assert pe.get_data(0x5d2410 - 0x400000, 21).split(b'\0')[0] == b'MyPlayer/rdoValuable'
u = json.loads((ROOT / 'recovery/output/web-assets/ui.json').read_text())
layout = next(x for x in u['layouts'] if x['path'].endswith('myhome_playerpage.xml'))
controls = {x['name']: x for x in layout['windows']}
descendants = []
for control in controls.values():
    parent = control['parent']
    while parent:
        if parent == 'picShortcutPanel':
            descendants.append(control['name'])
            break
        parent = controls[parent]['parent']
x = json.loads((ROOT / 'recovery/output/inventory-query-native.json').read_text())
row = next(r for r in x['rows'] if r['rolePresent'] and not r['zeroOwned'])
ids = [x['records'][i - 1]['itemTableId'] for i in row['result']['groups'][6]]
assert ids and all(20001 <= i <= 22000 for i in ids)
path = ROOT / 'recovery/output/home-valuable-region-source-preparation.json'
result = json.loads(path.read_text()) if path.exists() else {}
result.update({
    'status': 'SOURCE_HOME_VALUABLE_REGION_NAVIGATION_INVENTORY_MAPPING_CONFIRMED',
    'tasks': ['UI36', 'M5-09'],
    'controls': [controls[k] for k in ['rdoValuable', 'lstPlayerValuable', 'txtValuableQuantity', 'picShortcutPanel']],
    'selectedCallback': trace(0x4e50e8, 0x4e5121),
    'factory': trace(0x4e30f9, 0x4e333b),
    'countGetter': trace(0x43c0a1, 0x43c0b4),
    'originalContainer': '[[633588]+120]+6c',
    'shortcutDescendants': descendants,
    'queryWireMapping': {'evidence': 'recovery/output/inventory-query-native.json',
        'groupIndex': 6, 'beginPointerOffset': '70', 'category': 6,
        'itemTableIdRange': [20001, 22000], 'observedNativeIds': ids,
        'formalResponse': 'Inventory.records; no new API field'},
    'productionChanged': False, 'chromeStarted': False,
})
path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
