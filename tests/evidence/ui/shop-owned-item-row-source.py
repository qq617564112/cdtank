"""Original shop owned Item row controller, constructor and draw source."""
import json, struct
from pathlib import Path
import pefile, capstone
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3]
p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase
cs=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def trace(a,z):return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in cs.disasm(p.get_data(a-base,z-a),a)]
def string(a):return p.get_data(a-base,100).split(b'\0')[0].decode('ascii')
assert string(0x5cc330)=='data\\ui\\layouts\\shop_itempage.xml'
assert string(0x5cc314)=='ConvenientPage/lstMyItem'
assert struct.unpack('<II',p.get_data(0x5ceec0-base,8))[1]==0x4b923b
uc=Uc(UC_ARCH_X86,UC_MODE_32)
for a in [0x4b9000,0x5ce000,0x2000000]:uc.mem_map(a,0x1000)
uc.mem_write(0x4b923b,p.get_data(0x4b923b-base,0x17));uc.mem_write(0x5cee00,p.get_data(0x5cee00-base,4))
stack,out,done=0x2000100,0x2000200,0x2000300
uc.mem_write(stack,struct.pack('<II',done,out));uc.reg_write(UC_X86_REG_ESP,stack)
uc.emu_start(0x4b923b,done,count=20)
size=list(struct.unpack('<2f',uc.mem_read(out,8)));assert size==[161,56]
result={'nativePixelSize':size,'status':'ORIGINAL_SHOP_OWNED_ITEM_ROW_CONTROLLER_CONSTRUCTOR_CONFIRMED','tasks':['UI53','M5-10'],'layout':string(0x5cc330),'list':string(0x5cc314),'ownerMember':'0x40','initialization':trace(0x49e988,0x49ea70),'itemFactory':trace(0x4a0e83,0x4a0f90),'constructor':trace(0x4b9251,0x4b96e3),'vtable':'0x5ceec0','pixelSizeGetter':trace(0x4b923b,0x4b924f),'draw':trace(0x4b96e3,0x4b9e77),'confirmed':['Controller49e988 loads shop_itempage.xml with ConvenientPage prefix and stores lstMyItem atowner+40.','Item branch4a0e83 requires43bd13 category1 and unsignedMyItem+10 positive.','4d8366 name,4d83b3 type,4d5f95 rawquantity,4d95eb additional text are passed to4b9251; constructed row inserted intoowner+40.','Row4b9251 has independent vtable5ceec0 with shared pixel getter4b923b; Home constructor4b886d is not this constructor.'],'pending':['Fourth text4d95eb->4d85e8 reads Itemrecord+ec unsigned>>1 plus gamestring81; exact currentwire identity remains absent, so leave this text blank.','Preserve selection/query/transactions/right product list; no new BUY prerequisite.'],'drawConstants':{hex(a):struct.unpack('<f',p.get_data(a-base,4))[0] for a in [0x5ccffc,0x5e68c8,0x5cedfc,0x5cee00,0x5cd000,0x5e68b0,0x5ceedc,0x5cee3c,0x5ceed8,0x5ceed4]},'quantityAnchor':{'draw':'4b9ac0 textwidth then4b9acc32-width+iconX;4b9ade32-fontHeight+iconY','right':37,'bottom':40,'webFont':'Inherited current sourcefont; originalCheap metrics remain unverified'},'fourthTextGetter':trace(0x4d85e8,0x4d86a1),'productionChanged':False,'chromeStarted':False}
(ROOT/'recovery/output/shop-owned-item-row-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['status'])
