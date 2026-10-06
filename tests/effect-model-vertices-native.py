"""Execute the original animated mesh draw's frame selection and vertex writes."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
from cvd import read_cvd
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x200000)
MESH,SECTION,GFX,VTABLE,FRAMES,TIMES,POOL,OUTPUT,INFO,STACK,STOP= [0x2010000+i*0x1000 for i in range(11)]
DATA=0x2050000
OUTPUT=0x2150000
node=read_cvd(ROOT/'recovery/output/verified/assets/data/Data/effect/effect/online/00012.CVD')['nodes'][0]
count=len(node['frames'][0]);events=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def put(a,*values):machine.mem_write(a,struct.pack('<'+'I'*len(values),*values))
def finish(pop=0):
 stack=machine.reg_read(UC_X86_REG_ESP);machine.reg_write(UC_X86_REG_EIP,uint(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
def hook(uc,address,size,data):
 stack=uc.reg_read(UC_X86_REG_ESP)
 if address==0x1001b6f0:finish()
 elif address==STOP+16:finish(4)
 elif address==0x1002c0b0:uc.reg_write(UC_X86_REG_EAX,POOL);finish(4)
 elif address==STOP+32:uc.reg_write(UC_X86_REG_EAX,OUTPUT);finish(4)
 elif address==STOP+48:
  events.append('draw');finish(12)
 elif address==0x1002b6c0:
  vb=uc.reg_read(UC_X86_REG_ECX);uc.reg_write(UC_X86_REG_EAX,uint(vb+0x18));finish()
 elif address==0x1002b760:finish()
machine.hook_add(UC_HOOK_CODE,hook)
put(GFX,VTABLE);put(VTABLE+0x30,STOP+16)
put(POOL,VTABLE);put(VTABLE+0xc,STOP+32);put(VTABLE+0x10,STOP+48);put(POOL+0x10,32)
put(POOL+0x1c,OUTPUT);put(POOL+0x20,OUTPUT+12);put(POOL+0x2c,OUTPUT+24)
put(MESH+0x38,0x13,SECTION,1);put(MESH+0x70,GFX);put(MESH+0x78,FRAMES,TIMES,len(node['frames']),TIMES+0x800)
put(SECTION+0x90,DATA+0x40000,0,count-1)
machine.mem_write(TIMES,struct.pack('<'+str(len(node['times']))+'f',*node['times']))
for i,frame in enumerate(node['frames']):
 vb=FRAMES+0x100+i*0x100;buffer=DATA+i*0x8000;layout=FRAMES+0x900
 put(FRAMES+i*4,vb);put(vb+8,layout);put(layout+0x18,32)
 put(vb+0x18,buffer,buffer+12);put(vb+0x28,buffer+24)
 machine.mem_write(buffer,b''.join(struct.pack('<8f',*v[5:8],*v[2:5],*v[:2]) for v in frame))
rows=[]
animation=json.loads((ROOT/'recovery/output/effect-model-animation-native.json').read_text())
times=sorted({0,.016,.05,.1,.1666666716337204,.25,.3333333432674408,.4,.5,.6,.6666666865348816,.8,1,*[step['time'] for row in animation['rows'] for step in row['steps']]})
for time in times:
 events.clear();machine.mem_write(MESH+0x6c,struct.pack('<f',time));put(STACK,STOP,0,INFO)
 machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,MESH);machine.reg_write(UC_X86_REG_FPCW,0x27f)
 machine.emu_start(0x10016030,STOP,count=100000)
 assert machine.reg_read(UC_X86_REG_ESP)==STACK+12;assert events==['draw']
 vertices=[list(struct.unpack('<8f',machine.mem_read(OUTPUT+i*32,32))) for i in range(count)]
 rows.append(dict(time=time,vertices=vertices))
(ROOT/'recovery/output/effect-model-vertices-native.json').write_text(json.dumps(dict(times=node['times'],frames=node['frames'],indices=[i for face in node['parts'][0]['faces'] for i in face],rows=rows))+'\n')
print(f'PASS: {len(rows)} complete animated mesh frame draws / {count*len(rows)} original vertices')

browser=dict(animation=animation,geometry=dict(times=node['times'],frames=node['frames'],indices=[i for face in node['parts'][0]['faces'] for i in face],rows=rows))
(ROOT/'recovery/output/web-assets/effect-model-browser-native.json').write_text(json.dumps(browser)+'\n')
