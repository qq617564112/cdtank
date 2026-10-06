"""Audit original movement consumers; straight paths supply component-clamp service."""
from pathlib import Path
import json
import math
import struct
import sys
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_ECX
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
STACK, STOP, POS, FORWARD, LOOK, CENTER, MATRIX, OUT, ROLE, RECORD = [0x2001000+i*0x1000 for i in range(10)]
def put(a,*v): uc.mem_write(a,struct.pack('<'+'I'*len(v),*v))
def get(a): return struct.unpack('<I',uc.mem_read(a,4))[0]
def vec(a,v=None):
 if v is not None:uc.mem_write(a,struct.pack('<3f',*v))
 return list(struct.unpack('<3f',uc.mem_read(a,12)))
def hook(m,a,n,u):
 if a==0x41d98e:
  s=uc.reg_read(UC_X86_REG_ESP)
  point,lower,upper=[get(s+i) for i in [4,8,12]]
  f=lambda p:struct.unpack('<f',uc.mem_read(p,4))[0]
  uc.mem_write(point,struct.pack('<f',min(max(f(point),f(lower)),f(upper))))
  uc.reg_write(UC_X86_REG_EIP,get(s));uc.reg_write(UC_X86_REG_ESP,s+16)
uc.hook_add(UC_HOOK_CODE,hook,begin=0x41d98e,end=0x41d98e)
rows=[]
for command in [1,2]:
 for dt in [.05,.2]:
  vec(POS,[10,0,20]);vec(FORWARD,[1,0,0]);vec(LOOK,[1,0,0]);vec(CENTER,[10,0,100])
  args=[OUT,POS,LOOK,FORWARD,command,4]
  uc.mem_write(STACK,struct.pack('<7I',STOP,*args)+struct.pack('<3fI',30,.5,dt,0))
  uc.reg_write(UC_X86_REG_ESP,STACK)
  uc.emu_start(0x4344e7,STOP,count=20000)
  assert uc.reg_read(UC_X86_REG_EIP) == STOP
  expected = [10 + (1 if command == 1 else -1) * 30 * dt, 0, 20]
  assert all(math.isclose(actual, target, abs_tol=1e-6) for actual, target in zip(vec(POS), expected))
  assert vec(FORWARD) == [1, 0, 0] and vec(LOOK) == [1, 0, 0]
  rows.append(dict(entry='0x4344e7',command=command,tankType=4,velocity=30,turnVelocity=.5,dt=dt,position=vec(POS),forward=vec(FORWARD),look=vec(LOOK)))
centers=[]
for command in [5,6,7,8]:
 put(ROLE+0x2a0,RECORD);uc.mem_write(RECORD+0x48,struct.pack('<2f',30,.5))
 vec(ROLE+0x25c,[10,0,20]);vec(ROLE+0x274,[1,0,0])
 put(STACK,STOP,command);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,ROLE)
 uc.emu_start(0x432013,STOP,count=3000)
 assert uc.reg_read(UC_X86_REG_EIP) == STOP
 assert vec(ROLE+0x28c) == [10, 0, 100 if command in [5,7] else -60]
 centers.append(dict(command=command,velocity=30,turnVelocity=.5,center=vec(ROLE+0x28c)))
result=dict(straight=rows,turnCenters=centers,serviceBoundary='41d98e component clamp supplied; collision wrapper and elapsed clock producer not executed')
(ROOT/'recovery/output/movement-consumer-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(f'PASS: {len(rows)} original straight movement paths and {len(centers)} original minimum-radius turn centers')
