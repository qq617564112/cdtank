"""Full bullet-count setter/getter and real property pending notification."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0x2000000,0x10000)
ROLE,RECORD,MANAGER,RVT,MVT,STACK,RETURN=[0x2001000+i*0x1000 for i in range(7)]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
write(RECORD,RVT,MANAGER);write(RVT+0x24,0x521e8a);write(RVT+0x10,0x522ba2)
write(MANAGER,MVT);write(MVT+0x28,0x529a10)
events=[]
def observe(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 assert machine.reg_read(UC_X86_REG_ECX)==MANAGER and read(stack+4)==8
 events.append(dict(index=8,count=read(RECORD+0x44),dirty=uc.mem_read(ROLE+0x2b4,1)[0]))
uc.hook_add(UC_HOOK_CODE,observe,begin=0x529a10,end=0x529a10)
rows=[]
for present in [False,True]:
 for dirty in [0,1]:
  for previous in [0,1,5,0xffffffff]:
   for value in [0,1,2,5,99,0x7fffffff,0x80000000,0xffffffff]:
    write(ROLE+0x2a0,RECORD if present else 0);write(RECORD+0x44,previous)
    write(RECORD+0x38,3);write(MANAGER+0x40,*([0]*8));uc.mem_write(ROLE+0x2b4,bytes([dirty]))
    before=bytes(uc.mem_read(RECORD,0x140));events.clear()
    write(STACK,RETURN,4,value);uc.reg_write(UC_X86_REG_ECX,ROLE);uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.emu_start(0x432528,RETURN,count=1000)
    result=bool(uc.reg_read(UC_X86_REG_EAX)&255);assert result==present
    assert uc.reg_read(UC_X86_REG_ESP)==STACK+12
    after=bytearray(before)
    if present:struct.pack_into('<I',after,0x44,value)
    assert bytes(uc.mem_read(RECORD,0x140))==bytes(after)
    pending=[read(MANAGER+0x40+i*4) for i in range(8)]
    assert pending==([1<<8]+[0]*7 if present else [0]*8)
    assert uc.mem_read(ROLE+0x2b4,1)[0]==dirty
    getters=[]
    for entry in [0x432349,0x422b44]:
     write(STACK,RETURN,4);uc.reg_write(UC_X86_REG_ECX,ROLE);uc.reg_write(UC_X86_REG_ESP,STACK)
     uc.emu_start(entry,RETURN,count=100)
     getters.append(uc.reg_read(UC_X86_REG_EAX))
    assert getters==([value]*2 if present else [0,0])
    rows.append(dict(present=present,dirty=dirty,previous=previous,value=value,result=result,
      stored=read(RECORD+0x44),getters=getters,pending=pending,events=list(events)))
(ROOT/'recovery/output/role-bullet-count-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
 scope='Complete432528 selector4,432349/422b44 getters and actual521e8a→529a10 pending bitmap, no stubs. Caller source, original decrement/refill and property-wire route excluded.'),indent=2)+'\n')
print(f'PASS: {len(rows)} full native bullet-count writes/getters, no clamp, pending8 and dirty preservation')
