"""Full original4288fe free-aim branch, constructor and original128-bit codec."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
uc,_=map_original_binaries([ROOT/'CDTank/CDTank.exe'])
uc.mem_map(0,4096);uc.mem_map(0x2000000,0x30000)
OWNER,ROLE,RECORD,GLOBAL,STAGES,STAGE,STAGE_VTABLE,CONTROLS,CONTROLLER,SCENE,STACK,RETURN,GET_STAGE,CLOCK,STREAM,BUFFER,PACKET=[0x2001000+i*0x1000 for i in range(17)]
def write(a,*v):uc.mem_write(a,struct.pack('<'+'I'*len(v),*[x&0xffffffff for x in v]))
def read(a):return struct.unpack('<I',uc.mem_read(a,4))[0]
def f32(v):return struct.unpack('<f',struct.pack('<f',v))[0]
def finish(value=0,pop=0):
 stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,read(stack));uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
events=[];stage=4;present=True
def hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x48a226:finish(ROLE if present else 0,4)
 elif address==GET_STAGE:finish(stage)
 elif address==0x436078:finish(0,4)
 elif address==0x436fe0:
  write(read(stack+4),0);write(read(stack+8),0);finish(0,12)
 elif address==0x49cc05:finish()
 elif address==0x422f0d:machine.reg_write(UC_X86_REG_EIP,CLOCK)
 elif address==0x489ba8:
  events.append(dict(kind='aim',point=list(struct.unpack('<3f',machine.mem_read(stack+4,12)))));finish(0,12)
 elif address==0x413e8c:
  packet=read(stack+4)
  assert read(packet)==0x5c3290
  events.append(dict(kind='send',type=0x3a9b,values=list(struct.unpack('<4f',machine.mem_read(packet+12,16)))))
  finish(1,4)
 elif address==0x423092:
  assert read(stack+4)==ROLE and read(stack+8)==2001
  events.append(dict(kind='fire',itemId=2001));finish(0,8)
for a in [0x48a226,GET_STAGE,0x436078,0x436fe0,0x49cc05,0x422f0d,0x489ba8,0x413e8c,0x423092]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
write(0x633588,GLOBAL);write(GLOBAL+0xe0,STAGES);write(STAGES,STAGE);write(STAGE,STAGE_VTABLE);write(STAGE_VTABLE+4,GET_STAGE)
write(0x6357f8,CONTROLS);write(CONTROLS+0x20,CONTROLLER);write(GLOBAL+0x124,SCENE)
write(ROLE,0x5c2c28);write(ROLE+0x2a0,RECORD);write(RECORD+0x3c,1)
uc.mem_write(CLOCK,b'\xdd\x05'+struct.pack('<I',CLOCK+0x100)+b'\xc2\x04\x00')
rows=[]
poses=[([0,0,0],[0,0,1]),([12.25,9,-30],[.6,0,.8]),([-1191.35,44,465.51],[-.23456789,.1,.987654321])]
for present in [False,True]:
 for local in [False,True]:
  for status in [0,1,2,3]:
   for stage in [1,3,4]:
    for controller in [False,True]:
     for scene in [False,True]:
      # Exercise different bullet counts without changing the request gate.
      for count in [0,1,2,0xffffffff]:
       position,direction=poses[count%3]
       position=list(map(f32,position));direction=list(map(f32,direction))
       current=123.456789
       write(OWNER+0x3c,ROLE if local else 0);write(CONTROLS+0x20,CONTROLLER if controller else 0);write(SCENE+0x60,int(scene))
       write(RECORD+0x44,count);write(RECORD+0x90,status);uc.mem_write(ROLE+0x308,b'\x07')
       uc.mem_write(ROLE+0x25c,struct.pack('<3f',*position));uc.mem_write(ROLE+0x274,struct.pack('<3f',*direction))
       uc.mem_write(CLOCK+0x100,struct.pack('<d',current));events.clear();before=bytes(uc.mem_read(RECORD,0x140))
       write(0,0x12345678);write(STACK,RETURN,73);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBP,0x1234)
       uc.emu_start(0x4288fe,RETURN,count=10000)
       assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
       assert uc.reg_read(UC_X86_REG_EBP)==0x1234 and read(0)==0x12345678
       accepted=present and local and status==2 and stage==4 and controller and scene
       point=[f32(position[i]+f32(direction[i]*1000)) for i in range(3)]
       expected=[dict(kind='aim',point=point),dict(kind='send',type=0x3a9b,values=point+[f32(current)]),dict(kind='fire',itemId=2001)] if accepted else []
       assert events==expected
       assert bytes(uc.mem_read(RECORD,0x140))==before
       flag=uc.mem_read(ROLE+0x308,1)[0];assert flag==(0 if present and local else 7)
       rows.append(dict(present=present,local=local,status=status,stage=stage,controller=controller,scene=scene,count=count,
        position=position,direction=direction,current=current,events=list(events),specialFlag12=flag))
# Execute original writer492a89 and reader4258b8 at all8 bit alignments.
wire=[]
for values in [[0.,0.,1000.,.125],[-1425.9178,144.,1453.1643,123.456789],[12.25,-9.75,42.,0.]]:
 values=list(map(f32,values))
 for offset in range(8):
  uc.mem_write(PACKET+12,struct.pack('<4f',*values));uc.mem_write(BUFFER,bytes(32));write(STREAM,offset,0,BUFFER,32)
  write(STACK,RETURN,STREAM);uc.reg_write(UC_X86_REG_ECX,PACKET);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x492a89,RETURN,count=10000)
  payload=bytes(uc.mem_read(BUFFER,(offset+128+7)//8))
  expected=int.from_bytes(struct.pack('<4f',*values),'little')<<offset
  assert int.from_bytes(payload,'little')==expected
  uc.mem_write(PACKET+12,b'\xaa'*16);write(STREAM,offset,0,BUFFER,32);write(STACK,RETURN,STREAM);uc.reg_write(UC_X86_REG_ECX,PACKET);uc.reg_write(UC_X86_REG_ESP,STACK);uc.emu_start(0x4258b8,RETURN,count=10000)
  assert bytes(uc.mem_read(PACKET+12,16))==struct.pack('<4f',*values)
  wire.append(dict(values=values,offset=offset,payload=payload.hex()))
(ROOT/'recovery/output/role-free-fire-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,wire=wire,
 scope='Full4288fe free-aim branch, actual role flags/status/pose/selection getters, real425876 constructor/destructor, actual423956 forwarding, full492a89/4258b8 codec. Stage/role/target queries, clock, aim-effect sink, network send and final423092 supplied. Other target branches, server acceptance, damage and bullet consumption/refill excluded.'),indent=2)+'\n')
print(f'PASS: {len(rows)} full free-fire gates/requests, record unchanged, {len(wire)} native128-bit codec vectors')
