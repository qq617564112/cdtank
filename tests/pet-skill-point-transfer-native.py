"""Execute the newly identified original trade scalar settlement with empty item lists."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x10000)
GAME, MANAGER, CONTAINER, GIVEN, RECEIVED, SENTINEL, STACK, STOP = [0x2001000+i*0x1000 for i in range(8)]
MODES,MODE,VT,MODE_GETTER=0x2009000,0x200a000,0x200b000,0x200c000
def put(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def get(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
put(0x633588,GAME);put(GAME+0x118,MANAGER);put(MANAGER+0x40,CONTAINER)
put(GAME+0xac,0);put(GAME+0xe0,MODES);put(MODES,MODE);put(MODE,VT);put(VT+4,MODE_GETTER)
put(CONTAINER+0x20,0x5c4118);put(CONTAINER+0xb0,1000);put(CONTAINER+0xbc,50);put(CONTAINER+0xc0,200)
put(SENTINEL,SENTINEL);put(GIVEN+0x10,SENTINEL);put(RECEIVED+0x10,SENTINEL)
put(GIVEN+0x18,300,10,70);put(RECEIVED+0x18,500,25,100)
calls,writes=[],[]
def watchcall(machine,address,size,data):
 s=uc.reg_read(UC_X86_REG_ESP)
 calls.append({'selector':get(s+4),'value':get(s+8),'thisOffset':hex(uc.reg_read(UC_X86_REG_ECX)-CONTAINER)})
def watchwrite(machine,access,address,size,value,data):
 if CONTAINER<=address<CONTAINER+0x200:writes.append({'pc':hex(uc.reg_read(UC_X86_REG_EIP)),'containerOffset':hex(address-CONTAINER),'value':value})
def modeGetter(machine,address,size,data):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,2);uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+4)
uc.hook_add(UC_HOOK_CODE,modeGetter,begin=MODE_GETTER,end=MODE_GETTER)
uc.hook_add(UC_HOOK_CODE,watchcall,begin=0x42fdea,end=0x42fdea)
uc.hook_add(UC_HOOK_MEM_WRITE,watchwrite)
put(STACK,STOP,GIVEN,RECEIVED);uc.reg_write(UC_X86_REG_ECX,MANAGER);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x49340b,STOP,count=10000)
assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+12
assert [get(CONTAINER+x) for x in (0xb0,0xbc,0xc0)]==[1200,65,230]
assert [(r['selector'],r['value']) for r in calls]==[(26,1200),(31,65),(38,230)]
output={'status':'PASS_ORIGINAL_TRADE_SKILL_POINT_BALANCE_TRANSFER','function':'0x49340b',
 'inputs':{'money':{'current':1000,'given':300,'received':500},'originality':{'current':50,'given':10,'received':25},'skillPoints':{'current':200,'given':70,'received':100}},
 'calls':calls,'writes':writes,'skillPoints':230,
 'scope':'Original profile getter/setter wrappers and complete49340b with empty item lists. Inputs are explicit trade settlement fixtures, not earned rewards or a real peer transaction. No transport/authorization/atomic persistence proof.'}
(ROOT/'recovery/output/pet-skill-point-transfer-native.json').write_text(json.dumps(output,indent=2)+'\n');print(output['status'])
