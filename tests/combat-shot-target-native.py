"""Original4288fe target selection and scene endpoint; bounded query/transport providers."""
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
  packet=read(stack+4);vt=read(packet)
  events.append(dict(kind='send',type={0x5c3290:0x3a9b,0x5c3188:0x3a9d,0x5c3374:0x3aa0}[vt]))
  finish(1,4)
 elif address==0x423092:
  assert read(stack+4)==ROLE and read(stack+8)==2001
  events.append(dict(kind='fire',itemId=2001));finish(0,8)
for a in [0x48a226,GET_STAGE,0x49cc05,0x422f0d,0x489ba8,0x413e8c,0x423092]:uc.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
write(0x633588,GLOBAL);write(GLOBAL+0xe0,STAGES);write(STAGES,STAGE);write(STAGE,STAGE_VTABLE);write(STAGE_VTABLE+4,GET_STAGE)
write(0x6357f8,CONTROLS);write(CONTROLS+0x20,CONTROLLER);write(GLOBAL+0x124,SCENE)
write(ROLE,0x5c2c28);write(ROLE+0x2a0,RECORD);write(RECORD+0x3c,1)
uc.mem_write(CLOCK,b'\xdd\x05'+struct.pack('<I',CLOCK+0x100)+b'\xc2\x04\x00')

# Query outputs and message allocation are providers; original selection/math execute.
from math import sqrt
TARGET,SCENE_OBJECT,MATH_RETURN,MATH_VALUE=0x2020000,0x2021000,0x2022000,0x2022100
uc.mem_write(MATH_RETURN,b'\xdd\x05'+struct.pack('<I',MATH_VALUE)+b'\xc3')
def target_hook(machine,address,size,data):
 stack=machine.reg_read(UC_X86_REG_ESP)
 if address==0x436078:finish(TARGET if target_present else 0,4)
 elif address==0x436fe0:
  uc.mem_write(read(stack+4),struct.pack('<f',f32(scene_distance)))
  write(read(stack+8),77);finish(SCENE_OBJECT if scene_present else 0,12)
 elif address in (0x57b854,0x57d261):
  value=struct.unpack('<d',uc.mem_read(stack+4,8))[0]
  uc.mem_write(MATH_VALUE,struct.pack('<d',sqrt(value) if address==0x57b854 else abs(value)))
  machine.reg_write(UC_X86_REG_EIP,MATH_RETURN)
 elif address in (0x4252ea,0x426854):
  write(machine.reg_read(UC_X86_REG_ECX),0x5c3188 if address==0x4252ea else 0x5c3374);finish(machine.reg_read(UC_X86_REG_ECX))
 elif address in (0x425382,0x4268a2,0x40bd28):finish()
 elif address==0x422d90:finish(0,12)
 elif address==0x44dbbc:finish(SCENE_OBJECT+0x100)
 elif address==0x4014c9:finish(0,12)
for a in [0x436078,0x436fe0,0x57b854,0x57d261,0x4252ea,0x426854,0x425382,0x4268a2,0x40bd28,0x422d90,0x44dbbc,0x4014c9]:
 uc.hook_add(UC_HOOK_CODE,target_hook,begin=a,end=a)
write(TARGET,0x5c2c28);write(TARGET+0x310,0)
write(OWNER+0x3c,ROLE);write(SCENE+0x60,1);stage=4;present=True
write(RECORD+0x90,2);write(RECORD+0x44,2)
rows=[]
for position,direction,target_offset in [([0,0,0],[0,0,1],[0,0,100]),([12.25,9,-30],[.6,0,.8],[30,40,0]),([-1191.35,44,465.51],[-.23456789,.1,.987654321],[1,2,3]),([0,0,0],[0,0,1],[0,0,.005]),([0,0,0],[0,0,1],[0,0,.99999])]:
 for target_present in [False,True]:
  for scene_present in [False,True]:
   for scene_distance in [0,1,3.7416575,49.999,50,50.001,99.999,100,100.001,1000]:
    position=list(map(f32,position));direction=list(map(f32,direction))
    target_position=[f32(position[i]+target_offset[i]) for i in range(3)]
    uc.mem_write(ROLE+0x25c,struct.pack('<3f',*position));uc.mem_write(ROLE+0x274,struct.pack('<3f',*direction));uc.mem_write(TARGET+0x25c,struct.pack('<3f',*target_position))
    uc.mem_write(CLOCK+0x100,struct.pack('<d',123.456789));events.clear()
    write(STACK,RETURN,73);uc.reg_write(UC_X86_REG_ECX,OWNER);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_EBP,0x1234)
    uc.emu_start(0x4288fe,RETURN,count=20000)
    assert uc.reg_read(UC_X86_REG_EIP)==RETURN and uc.reg_read(UC_X86_REG_ESP)==STACK+8
    rows.append(dict(position=position,direction=direction,targetPosition=target_position,targetPresent=target_present,scenePresent=scene_present,sceneDistance=f32(scene_distance),events=list(events)))
assert len(rows)==200
output=ROOT/'recovery/output/combat-shot-target-native.json'
output.write_text(json.dumps(dict(status='PASS',rows=rows,scope='Complete4288fe selection and source x87 position subtraction/distance plus scene f32 vector/endpoint. Role/scene query outputs, message allocation/snapshots/transport, CRT sqrt/fabs supplied; actual original target selection geometries and server damage not proven.'),indent=2)+'\n')
print('PASS200 original local target/scene/free dispatch vectors')
