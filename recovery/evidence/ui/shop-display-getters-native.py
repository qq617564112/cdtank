"""Original offered-count and unsigned star-coin conversion instructions."""
import json, struct
from pathlib import Path
import pefile, capstone
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EAX
ROOT=Path(__file__).resolve().parents[3]
p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase
u=Uc(UC_ARCH_X86,UC_MODE_32)
image=p.get_memory_mapped_image();u.mem_map(base,(len(image)+4095)&~4095);u.mem_write(base,image)
u.mem_map(0x2000000,0x10000)
record,stack,result=0x2002000,0x2008000,0x2004000
coin=[]
# call4d5f76; fstp qword[result]; then stop before nop.
u.mem_write(0x2000000,b'\xe8'+struct.pack('<i',0x4d5f76-0x2000005)+b'\xdd\x1d'+struct.pack('<I',result)+b'\x90')
for raw in [0,1,3,10,20,50,0x80000000,0xffffffff]:
 u.mem_write(record+0xf0,struct.pack('<I',raw));u.reg_write(UC_X86_REG_ECX,record);u.reg_write(UC_X86_REG_ESP,stack)
 u.emu_start(0x2000000,0x200000b,count=30)
 value=struct.unpack('<d',u.mem_read(result,8))[0]
 assert value==float(raw)*0.1
 coin.append({'rawItemCoin':raw,'originalGetterDouble':value})
count=[]
for item_id,durable,expected in [(1,0,1),(1,10,10),(3003,10,10),(4000,7,7),(4001,7,1),(20001,7,7),(21000,7,7),(21001,7,1),(1,0xffffffff,0xffffffff)]:
 u.mem_write(record+0xc,struct.pack('<I',item_id));u.mem_write(record+0xf8,struct.pack('<I',durable));u.mem_write(stack,struct.pack('<I',0x200000b))
 u.reg_write(UC_X86_REG_ECX,record);u.reg_write(UC_X86_REG_ESP,stack);u.emu_start(0x439950,0x200000b,count=30)
 actual=u.reg_read(UC_X86_REG_EAX);assert actual==expected
 count.append({'itemTableId':item_id,'durable':durable,'offeredQuantity':actual})
c=capstone.Cs(capstone.CS_ARCH_X86,capstone.CS_MODE_32)
def trace(a,z):return [{'va':hex(i.address),'asm':i.mnemonic+' '+i.op_str} for i in c.disasm(p.get_data(a-base,z-a),a)]
r={'status':'PASS_ORIGINAL_COUNT_AND_COIN_GETTERS_NATIVE','coinScale':struct.unpack('<d',p.get_data(0x5c4198-base,8))[0],'unsignedCorrection':4294967296,'coinVectors':coin,'countVectors':count,'traces':{'coinGetter':trace(0x4d5f76,0x4d5f95),'countEligibility':trace(0x4396c2,0x4396e0),'countGetter':trace(0x439950,0x439967),'coinFormatterConstructor':trace(0x4b4774,0x4b47be),'moneyFormatterConstructor':trace(0x486f00,0x486f4a),'coinInsertion':trace(0x4b47be,0x4b47e4),'moneyInsertion':trace(0x486f4a,0x486f6b)},'formatter':{'coin':'double ostream insertion; original constructor sets precision16 at ios+14; default float formatting','money':'unsigned ostream insertion through num_put slot+18; decimal base and precision10 constructor'},'limits':['Native vectors execute original count and unsigned coin getters; full C++ locale/string formatting is documented by instruction chain, not executed.','Metadata absence remains blank; display count does not multiply BUY quantity.']}
(ROOT/'recovery/output/shop-display-getters-native.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r['status'])
