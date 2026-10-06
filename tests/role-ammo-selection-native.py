"""Original432528 selectors11/12, raw getters and real metadata notifications."""
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
 events.append(dict(index=read(stack+4),selection=read(RECORD+0x3c),tableId=read(RECORD+0x40),
  specialFlag12=uc.mem_read(ROLE+0x308,1)[0],dirty=uc.mem_read(ROLE+0x2b4,1)[0]))
uc.hook_add(UC_HOOK_CODE,observe,begin=0x529a10,end=0x529a10)
rows=[]
for selector,offset,index in [(11,0x3c,6),(12,0x40,7)]:
 for present in [False,True]:
  for dirty in [0,1]:
   for flag in [0,7]:
    for previous in [0,1,5,0xffffffff]:
     for value in [0,1,2,8,2001,0x7fffffff,0x80000000,0xffffffff]:
      write(ROLE+0x2a0,RECORD if present else 0);write(RECORD+0x3c,1,2001);write(RECORD+offset,previous)
      write(MANAGER+0x40,*([0]*8));uc.mem_write(ROLE+0x2b4,bytes([dirty]));uc.mem_write(ROLE+0x308,bytes([flag]))
      before=bytes(uc.mem_read(RECORD,0x140));events.clear()
      write(STACK,RETURN,selector,value);uc.reg_write(UC_X86_REG_ECX,ROLE);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x432528,RETURN,count=1000)
      accepted=bool(uc.reg_read(UC_X86_REG_EAX)&255);assert accepted==present
      assert uc.reg_read(UC_X86_REG_ESP)==STACK+12
      after=bytearray(before)
      if present:struct.pack_into('<I',after,offset,value)
      assert bytes(uc.mem_read(RECORD,0x140))==bytes(after)
      pending=[read(MANAGER+0x40+i*4) for i in range(8)]
      assert pending==([1<<index]+[0]*7 if present else [0]*8)
      resultflag=uc.mem_read(ROLE+0x308,1)[0]
      assert resultflag==(0 if present and selector==11 else flag)
      assert uc.mem_read(ROLE+0x2b4,1)[0]==dirty
      assert len(events)==int(present)
      if present:assert events[0]['specialFlag12']==flag and events[0]['index']==index
      getters=[]
      for entry in [0x432349,0x422b44]:
       write(STACK,RETURN,selector);uc.reg_write(UC_X86_REG_ECX,ROLE);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(entry,RETURN,count=100)
       getters.append(uc.reg_read(UC_X86_REG_EAX))
      assert getters==([value]*2 if present else [0,0])
      rows.append(dict(selector=selector,present=present,dirty=dirty,flag=flag,previous=previous,value=value,
       accepted=accepted,selection=read(RECORD+0x3c),tableId=read(RECORD+0x40),specialFlag12=resultflag,
       pending=pending,getters=getters,events=list(events)))
(ROOT/'recovery/output/role-ammo-selection-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
 scope='Full432528 selectors11/12,432349 and422b44; real521e8a/522ba2/529a10 notifications, no stubs. Selection writesnotify6 then clearsrole+308; now table writesnotify7 and leavesflag. Same writes notify; no clamp or dirty changes. Caller/UI/network acceptance and special-ammo rules excluded.'),indent=2)+'\n')
print(f'PASS: {len(rows)} original ammo selector/table writes, both getters, notify6/7, flag12 timing and dirty preservation')
