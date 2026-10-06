"""Execute complete4284ae unload gates, original lookups/profile getters and3abc emission."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x40000)
GAME,OWNER,MANAGER,TANK,RECORD,PROFILE_WRAPPER,PROFILE,INVENTORY,VECTOR,OTHER = [0x2001000+i*0x1000 for i in range(10)]
STACK,RETURN,STREAM = 0x2020000,0x2021000,0x2022000
sent=[];writes=[];seed=0

def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def finish(value=0,pop=0):
 s=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(s));uc.reg_write(UC_X86_REG_ESP,s+4+pop)
def hook(machine,address,size,data):
 s=machine.reg_read(UC_X86_REG_ESP);this=machine.reg_read(UC_X86_REG_ECX)
 if address==0x427bf9:
  assert this==MANAGER;finish(TANK)
 elif address==0x425d0f:
  # Seed caller stack before the actual full constructor.
  write(this+0x10,seed)
 elif address==0x413f6a:
  packet=read(s+4);assert read(packet)==0x5c3308 and read(s+8)==1
  assert read(read(packet)+4)==0x424ac7
  sent.append(dict(instanceId=read(packet+0xc),field10=read(packet+0x10)));finish(pop=8)
 elif address==0x401c7a:
  writes.append(dict(bits=read(s+8),value=read(read(s+4))));finish(pop=8)
 else:raise AssertionError(hex(address))
for address in [0x427bf9,0x425d0f,0x413f6a,0x401c7a]:uc.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
write(0x633588,GAME);write(GAME+0x118,MANAGER);write(GAME+0x120,INVENTORY)
write(OWNER+0x40,PROFILE_WRAPPER);assert PROFILE_WRAPPER+0x20!=PROFILE
# Real preview wrapper is atowner+40; inner profile pointer is arithmetic+20.
PROFILE=PROFILE_WRAPPER+0x20
write(PROFILE,0x5c4118)
rows=[]
for table,state,fixed,scenario in itertools.product([10001,11001,12001,13001,14001,15001,16001,17031,2001,0,0xffffffff],[0,1,2,255],range(4),range(8)):
 write(RECORD+4,71);write(RECORD+0xc,table);write(RECORD+0x1c,state)
 write(OTHER+4,72);write(OTHER+0xc,table)
 parts=[13001 if index<fixed else 0 for index in range(3)];write(TANK+0x58,*parts)
 equipped=[0]*5
 if scenario<5:equipped[scenario]=71
 elif scenario==5:equipped[0]=72
 elif scenario==7:equipped[0]=77
 write(PROFILE+0x148,*equipped)
 # Real skin selector44 and mark selector1 array, with matching/missing/different owned records.
 write(PROFILE+0x13c,71 if scenario==0 else 72 if scenario==1 else 77)
 write(PROFILE+0x118,71 if scenario==0 else 72 if scenario==1 else 77)
 pointers=[RECORD,OTHER] if scenario!=6 else [OTHER]
 for offset,vector in [(0x30,VECTOR),(0x40,VECTOR+0x100),(0x60,VECTOR+0x200)]:
  write(INVENTORY+offset,vector,vector+len(pointers)*4);write(vector,*pointers)
 sent.clear();seed=0x8bad0000+scenario
 before=[bytes(uc.mem_read(a,n)) for a,n in [(RECORD,0x30),(PROFILE,0x170),(TANK,0x70)]]
 write(STACK,RETURN,RECORD);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
 uc.emu_start(0x4284ae,RETURN,count=10000)
 assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
 assert before==[bytes(uc.mem_read(a,n)) for a,n in [(RECORD,0x30),(PROFILE,0x170),(TANK,0x70)]]
 rows.append(dict(record=dict(instanceId=71,itemTableId=table,state=state),parts=parts,equipped=equipped,
  skinInstanceId=read(PROFILE+0x118),markInstanceId=read(PROFILE+0x13c),
  owned=[dict(instanceId=read(pointer+4),itemTableId=table) for pointer in pointers],sent=list(sent),seed=seed))
# Actual packet writer521a15 emits both32bit fields; field10 remains stack content.
write(RECORD+0xc,71,0x8bad0012);writes.clear();write(STACK,RETURN,STREAM)
uc.reg_write(UC_X86_REG_ECX,RECORD);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x521a15,RETURN,count=1000)
assert writes==[dict(bits=32,value=71),dict(bits=32,value=0x8bad0012)]
# Null candidate: still no transport.
sent.clear();write(STACK,RETURN,0);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x4284ae,RETURN,count=1000);assert not sent
(ROOT/'recovery/output/role-equipment-unload-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,wire=writes,
 scope='Complete4284ae, actual profile virtual getters42fdc5/42fe3f and42029e/4208b7, real inventory vector lookups43ccf2/43cd15/43cd38, classifier43bd13/439762, full425d0f/425d42 constructor/destructor and521a15 writer. Selected tank getter, transport and writer sink supplied. Sender only writesinstance+c;packet+10 stays seeded stack content. No successful mutation or server qualification.'),indent=2)+'\n')
print(f'PASS: {len(rows)} original unload decisions, no source writes and32/32 wire')
