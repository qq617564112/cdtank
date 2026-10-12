"""Execute the original price getter branch after its local prefix conversion."""
import json,struct
from pathlib import Path
import pefile
from unicorn import Uc,UC_ARCH_X86,UC_MODE_32,UC_HOOK_CODE,UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EBP,UC_X86_REG_EBX
ROOT=Path(__file__).resolve().parents[3];p=pefile.PE(str(ROOT/'CDTank/CDTank.exe'));base=p.OPTIONAL_HEADER.ImageBase
u=Uc(UC_ARCH_X86,UC_MODE_32)
u.mem_map(0x4d9000,0x1000);u.mem_write(0x4d9000,p.get_data(0x4d9000-base,0x1000));u.mem_map(0x2000000,0x10000);u.mem_map(0x5c0000,0x1000);u.mem_write(0x5c0000,p.get_data(0x5c0000-base,0x1000))
frame,record,target=0x2001000,0x2002000,0x2003000
u.mem_write(frame+8,struct.pack('<II',record,target));events=[];writes=[]
def oncode(uc,a,size,user):
 events.append(hex(a))
 if a in [0x4d9748,0x4d9879,0x4d99bb]:uc.emu_stop()
def onwrite(uc,access,address,size,value,user):
 if target<=address<target+64:writes.append({'address':hex(address),'size':size,'value':value})
u.hook_add(UC_HOOK_CODE,oncode);u.hook_add(UC_HOOK_MEM_WRITE,onwrite)
vectors=[]
for method,expected in [(0,0x4d99bb),(1,0x4d9748),(2,0x4d9879),(3,0x4d99bb),(0xffffffff,0x4d99bb)]:
 u.mem_write(record+0xf4,struct.pack('<I',method));u.mem_write(target,b'SENTINEL_OUTPUT'+bytes(49));u.reg_write(UC_X86_REG_EBP,frame);u.reg_write(UC_X86_REG_EBX,1);events.clear();writes.clear();u.emu_start(0x4d972e,0x4d99c7,count=30)
 assert events[-1]==hex(expected);assert not writes;assert bytes(u.mem_read(target,len(b'SENTINEL_OUTPUT')))==b'SENTINEL_OUTPUT'
 vectors.append({'getMethod':method,'branch':hex(expected),'instructions':events[:],'targetUnchangedBeforeBranchBody':True})
r={'status':'PASS_ORIGINAL_PRICE_BRANCH_NATIVE','source':'CDTank/CDTank.exe4d972e..4d99bb','vectors':vectors,'zeroOutput':'Method0 bypasses both price bodies and proceeds directly tolocal-string cleanup; caller output is unchanged. In original factory getMethod0 is skipped before this helper.','prefix':'Earlier4d96f5 resolves gamestring78 and4d9729 converts only the localebp-17c; it does not write caller[ebp+c].','limits':['This executes actual branch instructions, not fullC++ number/string formatting bodies.','Missing metadata differs from a confirmedmethod0; do not fabricate sourceprices.']}
(ROOT/'recovery/output/shop-price-branch-native.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r['status'])
