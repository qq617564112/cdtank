"""Original owned Item/Weapon activation and quantity input callback."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
ROOT = Path(__file__).resolve().parents[3]
p = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = p.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)
def trace(start, end):
    return [{'va': hex(i.address), 'asm': i.mnemonic + ' ' + i.op_str}
            for i in cs.disasm(p.get_data(start-base, end-start), start)]
path = ROOT / 'recovery/output/verified/assets/data/Data/ui/layouts/userinput_dialog.xml'
result = {
    'status': 'SOURCE_OWNED_STACK_DOUBLECLICK_QUANTITY_CONFIRM_CALLBACK_IDENTIFIED',
    'registration': trace(0x4a1d93, 0x4a1dd5),
    'entry': trace(0x4a1b9d, 0x4a1c32),
    'entryIdentity': 'controller+40 lstMyItem EventMouseDoubleClick(import5c014c) ->4a1b9d getItemAtPoint -> row+9c instance ->4a172d',
    'quantityRoute': trace(0x4a172d, 0x4a1838),
    'routeIdentity': 'Inventory43d728(instance)/43bce7 true branch attaches4a0ac3, gamestring55,4d9685; alternate whole branch excluded from kind3 consumer',
    'quantityCallback': trace(0x4a0ac3, 0x4a0b76),
    'quantityIdentity': 'parse unsigned input via57dc5d; positive quantity; selected controller+30 row+9c; same instance category1/2 ->495e90(kind3,instance,quantity)',
    'message': {'id': 55, 'text': '请输入你想要售出的道具的数量。'},
    'layout': str(path.relative_to(ROOT)),
    'controls': [{'name': w.attrib['Name'], 'properties': {v.attrib['Name']:v.attrib['Value'] for v in w.findall('Property')}} for w in ET.parse(path).iter('Window')],
    'businessContract': 'stack-item-sale-contract-source.json',
    'webProjection': 'QUERY quotes/inventory authority; positive 24-bit amount <= ownedQuantity; total wallet limit999999999; SELL result2 confirmed projection only',
    'limits': ['Web keyboard Enter shares activation; original source evidence is mouse double-click.', 'Server authority and atomic persistence are rebuilt; native full server not recovered.'],
}
(ROOT / 'recovery/output/stack-item-sale-entry-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
