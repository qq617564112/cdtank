"""Original owned-row sale display using the established ItemMoney source field."""
import json,struct
from pathlib import Path
import pefile,capstone
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32
from unicorn.x86_const import UC_X86_REG_EBP,UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3];p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase
c=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def trace(a,z):return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in c.disasm(p.get_data(a-base,z-a),a)]
u=Uc(UC_ARCH_X86,UC_MODE_32);u.mem_map(0x4d8000,0x1000);u.mem_write(0x4d8000,p.get_data(0x4d8000-base,0x1000));u.mem_map(0x2000000,0x10000)
frame,record,stack=0x2001000,0x2002000,0x2008000;u.mem_write(frame+8,struct.pack('<I',record));vectors=[]
for raw in [0,1,10,11,0x80000000,0xffffffff]:
 u.mem_write(record+0xec,struct.pack('<I',raw));u.reg_write(UC_X86_REG_EBP,frame);u.reg_write(UC_X86_REG_ESP,stack);u.emu_start(0x4d8613,0x4d861f,count=6)
 actual=struct.unpack('<I',u.mem_read(stack-4,4))[0];assert actual==raw//2;vectors.append({'rawItemMoney':raw,'originalConversionArgument':actual})
loader=json.loads((ROOT/'recovery/output/shop-item-price-count-loader-native.json').read_text());assert loader['mapping']['0xec']=='ItemMoney/column20'
r={'status':'SOURCE_READY_ORIGINAL_OWNED_SALE_DISPLAY_GETTER_IDENTITY','tasks':['UI53','M5-10'],'wrapper':trace(0x4d95eb,0x4d960f),'getter':trace(0x4d85e8,0x4d87bb),'nativeShiftVectors':vectors,'sourceFieldIdentity':{'nativeRecord':'Item+0xec','schema':'ItemMoney/column20','proof':'recovery/output/shop-item-price-count-loader-native.json','export':'recovery/export_combat_catalog.py ItemMoney->moneyPrice','provider':'CombatItemDefinition.moneyPrice optional; missing remains blank'},'copyReturnIdentity':'4d95eb looks up413c74 table usingMyItem+0xc id and411068; direct4d85e8 output to same caller, no other transform.','originalOutputOrder':'出售价 + two spaces + 金钱 + unsigned(ItemMoney>>1) decimal','scope':'Read-only original fourth row text; no sell action/policy/transaction authority.','sharedConstructor':'Both owned Item4a0e83 and Weapon4a1003 pass4d95eb output as fourth text to4b9251; existing row price drawing geometry can be reused.','limits':['Native vectors execute the original shift/push argument, not the full C++ string body.','This source-ready proposal is not imported and does not claim original selling authority.'],'productionChanged':False,'chromeStarted':False}
(ROOT/'recovery/output/shop-owned-sale-display-source.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r['status'])
