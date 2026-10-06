"""Run original CVD node update with source tracks, clock and matrix operations."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from cvd import read_cvd
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x80000)
OBJECT,TRACKS,KEYS,DELTA,STACK,STOP=0x2010000,0x2011000,0x2020000,0x2007000,0x2008000,0x203f000
# The engine clock interface returns the supplied frame delta in st(0).
machine.mem_write(0x10028030,b'\xdd\x05'+struct.pack('<I',DELTA)+b'\xc3')
vtables=[0x1003f994,0x1003f998,0x1003f99c]
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
events=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def hook(uc,address,size,data):
 if address==0x1001e5f0:
  events.append('over')
  stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+8)
machine.hook_add(UC_HOOK_CODE,hook)
source=ROOT/'recovery/output/verified/assets/data/Data/effect/effect/online/00012.CVD'
model=read_cvd(source);rows=[]
for node in model['nodes']:
 for rate in [0,1,.5,2]:
  machine.mem_write(OBJECT,bytes(0x150));machine.mem_write(OBJECT+0x34,struct.pack('<f',rate))
  machine.mem_write(OBJECT+0x38,struct.pack('<I',1));machine.mem_write(OBJECT+0x108,struct.pack('<II',node['value'],1))
  machine.mem_write(OBJECT+0x7c,struct.pack('<16f',*identity));machine.mem_write(OBJECT+0xbc,struct.pack('<16f',*identity))
  duration=max([*node['times'],*[k[0]-t['keys'][0][0] for name in ['position','rotation','scale'] for t in [node[name]] for k in t['keys']]])
  machine.mem_write(OBJECT+0x118,struct.pack('<f',duration))
  for i,(name,offset) in enumerate([('position',0xfc),('rotation',0x104),('scale',0x100)]):
   t=node[name];address=TRACKS+i*0x100;data=KEYS+i*0x4000;size=60 if name=='scale' else 44
   machine.mem_write(address,struct.pack('<5I',vtables[i],data,size,t['mode'],len(t['keys'])))
   machine.mem_write(data,b''.join(bytes.fromhex(k) for k in t['rawKeys']))
   machine.mem_write(OBJECT+offset,struct.pack('<I',address))
   machine.mem_write(STACK,struct.pack('<I',STOP));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,address)
   machine.emu_start(0x1000f510,STOP,count=10000)
  steps=[]
  for delta in [0,.016,.05,.1,.1666666716337204,.25,.4,1,2,0,.016]:
   events.clear();machine.mem_write(DELTA,struct.pack('<d',delta));machine.mem_write(STACK,struct.pack('<I',STOP))
   machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT);machine.reg_write(UC_X86_REG_FPCW,0x27f)
   machine.emu_start(0x100104a0,STOP,count=100000)
   assert machine.reg_read(UC_X86_REG_ESP)==STACK+4
   steps.append(dict(delta=delta,time=struct.unpack('<d',machine.mem_read(OBJECT+0x110,8))[0],loops=uint(OBJECT+0x120),events=list(events),matrix=list(struct.unpack('<16f',machine.mem_read(OBJECT+0x7c,64)))))
  rows.append(dict(rate=rate,duration=duration,node={k:v for k,v in node.items() if k not in ('frames','parts')},steps=steps))
(ROOT/'recovery/output/effect-model-animation-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} original CVD clock/track/matrix sequences, {sum(len(r["steps"]) for r in rows)} updates')
