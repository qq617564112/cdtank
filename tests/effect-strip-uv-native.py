"""Execute original type7 state update; UV strip writes tested separately."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / n for n in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0x2000000,0x40000)
OBJECT,DEFINITION,TABLE,CONTROL,RESOURCE,MANAGER,STACK,STOP,READER_CALL,READER_VTABLE,READER_OBJECT = 0x2010000,0x2011000,0x2012000,0x2013000,0x2015000,0x2018000,0x2008000,0x203f000,0x201f100,0x201f200,0x201f300
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
stream=b'';offset=0;randomValues=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def hook(uc,a,size,data):
 global offset
 stack=uc.reg_read(UC_X86_REG_ESP)
 if a==READER_CALL:
  destination,length=uint(stack+4),uint(stack+8);uc.mem_write(destination,stream[offset:offset+length]);offset+=length;uc.reg_write(UC_X86_REG_EAX,length);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+12)
 elif a==0x47b81b:
  uc.reg_write(UC_X86_REG_EAX,MANAGER);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4)
 elif a==0x57cbcb:
  randomValues.append(16383);uc.reg_write(UC_X86_REG_EAX,16383);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4)

machine.hook_add(UC_HOOK_CODE,hook)
rows=[]
rotation=[0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1]
def read_state():
 v=struct.unpack('<19fI',machine.mem_read(OBJECT+0x40,80))
 return dict(position=list(v[:3]),orbitOffset=list(v[3:6]),velocity=list(v[6:9]),angles=list(v[9:12]),scale=list(v[12:15]),color=list(v[15:19]),frame=v[19],frameRemainder=struct.unpack('<f',machine.mem_read(OBJECT+0x94,4))[0])
for node in library['nodes']:
 if node['type']!=7 or bytes.fromhex(node['resource'])[388]:continue
 for modifier,source in enumerate(node['modifiers']):
  base,payload=bytes.fromhex(source['base']),bytes.fromhex(source['payload']);stream=struct.pack('<I',len(base))+base+struct.pack('<I',len(payload))+payload;offset=0
  machine.mem_write(READER_OBJECT,struct.pack('<I',READER_VTABLE));machine.mem_write(READER_VTABLE+12,struct.pack('<I',READER_CALL));machine.mem_write(STACK,struct.pack('<II',STOP,READER_OBJECT));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,CONTROL);machine.emu_start(0x477337,STOP,count=10000);assert offset==len(stream)
  vectors=[list(struct.unpack_from('<3f',payload,o)) for o in range(0,96,12)]
  config=dict(baseStart=struct.unpack_from('<f',base)[0],motion=dict(acceleration=vectors[4]),orbit=dict(axis=vectors[7],radius=struct.unpack_from('<f',payload,96)[0],angularRate=struct.unpack_from('<f',payload,100)[0]),scale=vectors[0],scaleRate=vectors[1],angleRate=vectors[6],colorAddRate=list(struct.unpack_from('<4f',payload,120)),frameCount=struct.unpack_from('<I',bytes.fromhex(node['resource']),332)[0],frameInterval=struct.unpack_from('<f',payload,136)[0],frameFlags=struct.unpack_from('<I',payload,140)[0])
  for parent in [False,True]:
   machine.mem_write(OBJECT,bytes(0xd0));machine.mem_write(RESOURCE,bytes(0x300))
   for a,v in [(OBJECT+12,DEFINITION),(OBJECT+0x20,int(parent)),(DEFINITION+0x150,RESOURCE),(DEFINITION+0x160,TABLE),(TABLE,CONTROL),(RESOURCE+0x150,config['frameCount'])]:machine.mem_write(a,struct.pack('<I',v))
   machine.mem_write(MANAGER+0x68,struct.pack('<16f',*rotation))
   resource = bytes.fromhex(node['resource'])
   machine.mem_write(RESOURCE+0x148, resource[324:389])
   grid = next(g for g in library['textureGrids'] if g['node'] == node['index'])
   uv = grid['uvFrames']
   machine.mem_write(OBJECT+0x9c,struct.pack('<I',0x2020000))
   machine.mem_write(0x2020000,b''.join(struct.pack('<4f',*v) for v in uv))
   machine.mem_write(OBJECT+0xac,struct.pack('<I',0x2021000))
   segments = struct.unpack_from('<I',resource,344)[0]
   machine.mem_write(0x2021000,bytes(segments*68))
   machine.mem_write(OBJECT+0x40,struct.pack('<19fI',12.5,-3.75,21,1,2,3,37,-21,15,12,-44,91,8,13,19,.25,.375,.625,.75,0));machine.mem_write(OBJECT+0x94,struct.pack('<f',.01));initial=read_state();steps=[];elapsed=config['baseStart']
   for delta in [0,.016,.1,.5,1]:
    elapsed=struct.unpack('<f',struct.pack('<f',elapsed+delta))[0];machine.mem_write(OBJECT+8,struct.pack('<f',elapsed));machine.mem_write(STACK,struct.pack('<If',STOP,delta));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT);machine.reg_write(UC_X86_REG_FPCW,0x27f);randomValues.clear();machine.emu_start(0x474642,STOP,count=100000);assert machine.reg_read(UC_X86_REG_ESP)==STACK+8;steps.append(dict(delta=delta,elapsed=elapsed,state=read_state(),randomValues=list(randomValues), scroll=struct.unpack("<f",machine.mem_read(OBJECT+0x90,4))[0], uvs=[list(struct.unpack("<4f",machine.mem_read(0x2021000+i*68+48,16))) for i in range(segments)]))
   rows.append(dict(node=node['index'],modifier=modifier,parent=parent,globalRotation=rotation,config=config,initial=initial,frames=uv,segments=segments,textureLength=struct.unpack_from("<f",resource,380)[0],scrollRate=struct.unpack_from("<f",payload,149)[0],steps=steps))
(ROOT/'recovery/output/effect-strip-uv-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} original type7 state sequences / {len(rows)*5} ticks')
