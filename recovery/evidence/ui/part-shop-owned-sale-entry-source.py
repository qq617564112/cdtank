"""Named Part owned selection, double-click confirmation, and whole-instance sale callback."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
import sys
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from inspect_assets import read_table
pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)
def trace(start, end):
    return [{'va': hex(i.address), 'asm': i.mnemonic + ' ' + i.op_str}
            for i in cs.disasm(pe.get_data(start - base, end - start), start)]
imports = {entry.address: entry.name.decode() for dll in pe.DIRECTORY_ENTRY_IMPORT
           for entry in dll.imports if entry.name}
xmls = {}
for filename in ['shop_partpage.xml', 'shop_itemdesc.xml']:
    path = ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts' / filename
    windows = list(ET.parse(path).iter('Window'))
    xmls[filename] = {'windowNames': [w.attrib.get('Name') for w in windows],
                     'sellButtonPresent': any(w.attrib.get('Name') == 'btnSell' for w in windows)}
strings = {int(r['values']['ID']): r['values']['String']
           for r in read_table(ROOT / 'CDTank/Data/table/gamestring.dat')['rows']}
result = {
    'status': 'SOURCE_PART_OWNED_SELECTION_DOUBLECLICK_CONFIRM711_WHOLEINSTANCE_SALE_IDENTIFIED',
    'xml': xmls,
    'selectionRegistration': trace(0x516275, 0x5162cc),
    'selection': trace(0x513ef7, 0x513f23),
    'selectionIdentity': 'controller+48 lstMyEquip -> getFirstSelectedItem -> controller+38 selected row',
    'actionRegistration': trace(0x5162cc, 0x51631b),
    'eventSymbols': {hex(k): imports[k] for k in [0x5c0148, 0x5c014c, 0x5c0198, 0x5c0168]},
    'action': trace(0x515ec0, 0x515f55),
    'actionIdentity': 'lstMyEquip EventMouseDoubleClick -> 515ec0 getItemAtPoint -> row+9c instance -> 515c54',
    'confirmation': trace(0x515c54, 0x515d41),
    'confirmationId': 711, 'confirmationText': strings[711],
    'confirmRoute': '515c54 Inventory43d728(instance)->43bce7 predicate; false branch attaches5140f9 and confirms gamestring711 via4d9680; true branch uses separate warning57/provider pending',
    'saleCallback': trace(0x5140f9, 0x514113),
    'dispatcherKind4': trace(0x495e90, 0x495eff),
    'wholeInstance': '5140f9 reads controller+38 row+9c, owner+20 authority; push0/instance/kind4 ->495e90 ->494927(instance); no quantity argument in kind4 branch',
    'currentConsumer': 'PartShopView has real Inventory instance selection and confirmed Shop money but no sale API or sale action; PartShopSourcePage mounts source regions/tabs only',
    'preparedIntegration': 'Consume forthcoming root quotes by ownedSelected instance, disable unavailable/pending; qualified original row double-click requests confirm711; explicit visible Web sale action may share same consumer if root chooses; request identity and confirmed inventory/money projection follow root stable contract',
    'gaps': ['No btnSell exists in either named original XML; source action is owned-list double-click',
             '43bce7 predicate meaning/warning57 semantics not inferred here',
             'Protocol, authority gates, quote/cost/result/replay contract owned by root/Numeric and not invented'],
    'productionChanged': False, 'typeBuildExecuted': False, 'chromeStarted': False,
}
(ROOT / 'recovery/output/part-shop-owned-sale-entry-source.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
