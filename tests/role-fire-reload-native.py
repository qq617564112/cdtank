"""Execute complete423092 with actual numeric/float getters and local/forward callbacks."""
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
uc.mem_map(0x2000000,0x20000)
OWNER,ROLE,RECORD,OTHER,CALLBACK,VTABLE,STACK,RETURN,CLOCK = [0x2001000+i*0x1000 for i in range(9)]
DURATION,COMPLETE,FORWARD = 0x2011000,0x2011100,0x2011200
def write(a,*values):uc.mem_write(a,struct.pack('<'+'I'*len(values),*[v&0xffffffff for v in values]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
# Native f64 clock return at the external time boundary;423092 stores its own f32 deadline.
uc.mem_write(CLOCK,b'\xdd\x05'+struct.pack('<I',CLOCK+0x100)+b'\xc2\x04\x00')
events=[]
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x422f0d:
  assert read(stack+4)==OWNER
  events.append(dict(kind='clock'))
  machine.reg_write(UC_X86_REG_EIP,CLOCK);return
 if address==DURATION:
  events.append(dict(kind='duration',value=struct.unpack('<f',machine.mem_read(stack+4,4))[0]));pop=4
 elif address==COMPLETE:
  assert read(stack+4)==0;events.append(dict(kind='localComplete'));pop=4
 else:
  events.append(dict(kind='forwarded',role=read(stack+4)==ROLE,argument=read(stack+8)));pop=8
 machine.reg_write(UC_X86_REG_EIP,read(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
for a in [0x422f0d,DURATION,COMPLETE,FORWARD]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
write(ROLE,0x5c2c28);write(ROLE+0x2a0,RECORD)
rows=[]
for local in [False,True]:
 for count in [0,1,2,5,0x80000001,0xffffffff]:
  for duration_observer in [False,True]:
   for completion_observer in [False,True]:
    for current in [.125,123.456789]:
     write(OWNER+0x3c,ROLE);write(OWNER+0x7c,CALLBACK if duration_observer else 0)
     write(OWNER+0xcc,CALLBACK+0x10 if completion_observer else 0)
     write(OWNER+0x8c,CALLBACK+0x20)
     write(CALLBACK,VTABLE);write(VTABLE+8,DURATION)
     write(CALLBACK+0x10,VTABLE+0x10);write(VTABLE+0x18,COMPLETE)
     write(CALLBACK+0x20,VTABLE+0x20);write(VTABLE+0x28,FORWARD)
     write(RECORD+0x44,count)
     normal,special=struct.unpack('<2f',struct.pack('<2f',.7,2.34567))
     uc.mem_write(ROLE+0x50,struct.pack('<2f',normal,special))
     uc.mem_write(ROLE+0x9c,struct.pack('<f',9.25))
     uc.mem_write(CLOCK+0x100,struct.pack('<d',current))
     write(STACK,RETURN,ROLE if local else OTHER,77)
     uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK)
     events.clear();uc.emu_start(0x423092,RETURN,count=1000)
     assert uc.reg_read(UC_X86_REG_ESP)==STACK+12
     deadline=struct.unpack('<f',uc.mem_read(ROLE+0x9c,4))[0]
     expected=struct.unpack('<f',struct.pack('<f',current+(special if count==1 else normal)))[0] if local else 9.25
     assert deadline==expected
     rows.append(dict(local=local,bulletCount=count,normalSeconds=normal,lastBulletSeconds=special,
       currentSeconds=current,durationObserver=duration_observer,completionObserver=completion_observer,
       deadline=deadline,events=list(events)))
(ROOT/'recovery/output/role-fire-reload-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
 scope='Full423092 actual network getter422b44/base432349 selector4 reads record44 m_iBullet; actual float getter4321e3 selectors23/24 read role54/50. Clock return and observer calls supplied. Includes remote forwarding and callback order. Does not recover bullet decrement/refill, original server fire acceptance or full clock construction.'),indent=2)+'\n')
print(f'PASS: {len(rows)} complete native local/remote fire reload notifications, actual count/getters, deadline and callbacks')
