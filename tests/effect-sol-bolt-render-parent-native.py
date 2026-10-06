"""Original pure-bolt source trees through manager render, including real DLL matrix stack."""
import json
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/n for n in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x400000)
GFX,VTABLE,DEVICE,MATRIX_STACK,MATRIX,CAMERA,EYE=0x2040000,0x2041000,0x2042000,0x2042800,0x2043000,0x2044000,0x2045000
BUFFER,VERTICES,GET_CAMERA,ALLOCATE,SUBMIT=0x2046000,0x2050000,0x2048000,0x2048010,0x2048020
MANAGER,ROOT_OBJECT,SENTINEL,PARENT,VECTOR=0x2060000,0x2061000,0x2062000,0x2063000,0x2064000
STACK,STOP=0x2008000,0x204f000
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
allocated=0;current_object=0;random_index=0;draws=[];calls=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def write(a,v):machine.mem_write(a,struct.pack('<I',v))
def floats(a,n):return list(struct.unpack('<'+'f'*n,machine.mem_read(a,n*4)))
def current_matrix():return floats(MATRIX+uint(MATRIX_STACK+8)*64,16)
def hook(uc,a,size,data):
 global allocated,current_object,random_index
 stack=uc.reg_read(UC_X86_REG_ESP)
 if a==0x47d935:
  current_object=uc.reg_read(UC_X86_REG_ECX);calls.append(dict(kind='drawEntry',object=current_object,matrix=current_matrix()));return
 if a==0x47d56e:
  calls.append(dict(kind='build',object=uc.reg_read(UC_X86_REG_ECX),matrix=current_matrix()));return
 if a in [uint(0x5c0a78),uint(0x5c0aa0),uint(0x5c0a7c)]:
  calls.append(dict(kind={uint(0x5c0a78):'push',uint(0x5c0aa0):'identity',uint(0x5c0a7c):'pop'}[a],matrix=current_matrix()));return
 if a==GET_CAMERA:value,cleanup=CAMERA,0
 elif a==0x44ef01:value,cleanup=EYE,0
 elif a==ALLOCATE:
  allocated=uint(stack+4);value,cleanup=VERTICES,4
 elif a==SUBMIT:
  vertices=[dict(position=floats(VERTICES+i*24,3),color=uint(VERTICES+i*24+12),uv=floats(VERTICES+i*24+16,2)) for i in range(allocated)]
  draws.append(dict(object=current_object,matrix=current_matrix(),vertices=vertices));value,cleanup=0,12
 elif a==0x47b81b:value,cleanup=0x2049000,0
 elif a==0x4794c2:value,cleanup=0x7000+uint(stack+4),4
 elif a==uint(0x5c0b54):
  assert uint(stack+4)==0x15;value,cleanup=BUFFER,4
 elif a==0x57cbcb:
  value=[8191,24575,16383,1000][random_index%4];random_index+=1;cleanup=0
 else:return
 uc.reg_write(UC_X86_REG_EAX,value);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4+cleanup)
machine.hook_add(UC_HOOK_CODE,hook)
for a,v in [(0x635830,GFX),(GFX,VTABLE),(GFX+8,DEVICE),(DEVICE+0xd4,MATRIX_STACK),(VTABLE+0x28,GET_CAMERA),(BUFFER,VTABLE),(VTABLE+12,ALLOCATE),(VTABLE+20,SUBMIT),
 (MATRIX_STACK,MATRIX),(MATRIX_STACK+4,8),(MANAGER+4,VECTOR),(MANAGER+8,VECTOR+4),(MANAGER+0x50,SENTINEL),(SENTINEL,SENTINEL),(VECTOR,ROOT_OBJECT)]:write(a,v)
machine.mem_write(MANAGER+0x64,bytes([1,1]))
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
by_id={n['id']:n for n in library['nodes']}
roots=[n for n in library['nodes'] if n['type']==0 and n['children'] and all(by_id.get(c,{}).get('type')==2 for c in n['children'])]
parents=[identity,[0,1,0,0,-1,0,0,0,0,0,1,0,12.5,-3.75,21,1],[1.25,0,0,0,0,.5,0,0,0,0,2,0,-8,4,13,1]]
incoming=[identity,[0,0,-1,0,0,1.25,0,0,.75,0,0,0,5,-2,7,1]]
rows=[]
for root in roots:
 children=[by_id[c] for c in root['children']]
 objects=[0x2100000+i*0x10000 for i in range(len(children))]
 machine.mem_write(ROOT_OBJECT,bytes(0x100))
 for a,v in [(ROOT_OBJECT,0x5c9b38),(ROOT_OBJECT+4,2),(ROOT_OBJECT+0x20,PARENT),(ROOT_OBJECT+0x30,VECTOR+0x100),(ROOT_OBJECT+0x34,VECTOR+0x100+4*len(objects))]:write(a,v)
 machine.mem_write(ROOT_OBJECT+0x3d,bytes([1]));machine.mem_write(VECTOR+0x100,struct.pack('<'+'I'*len(objects),*objects))
 for parent in parents:
  machine.mem_write(PARENT,struct.pack('<16f',*parent));random_index=0
  generated=[]
  for source,obj in zip(children,objects):
   machine.mem_write(obj,bytes(0x10000));resource=obj+0x1000;definition=obj+0x2000
   for a,v in [(obj,0x5c9ad0),(obj+4,2),(obj+12,definition),(obj+0x20,PARENT),(obj+0x28,ROOT_OBJECT),(obj+0x70,obj+0x3000),(obj+0x80,obj+0x4000),(obj+0x90,obj+0x7000),(definition+0x150,resource)]:write(a,v)
   machine.mem_write(obj+0x3d,bytes([1]));machine.mem_write(resource+0x148,bytes.fromhex(source['resource'])[324:])
   machine.mem_write(STACK,struct.pack('<I',STOP));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,obj);machine.reg_write(UC_X86_REG_FPCW,0x27f)
   machine.emu_start(0x47e161,STOP,count=1000000)
   generated.append(dict(node=source['index'],segments=[floats(obj+0x4000+i*40,10) for i in range(uint(obj+0x68))]))
  for matrix in incoming:
   for eye in [[20,10,-15],[-40,-12,5]]:
    machine.mem_write(MATRIX,struct.pack('<16f',*matrix));write(MATRIX_STACK+8,0);machine.mem_write(EYE,struct.pack('<3f',*eye))
    calls.clear();draws.clear();machine.mem_write(STACK,struct.pack('<I',STOP));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,MANAGER)
    machine.emu_start(0x479192,STOP,count=1000000)
    assert len(draws)==len(children) and uint(MATRIX_STACK+8)==0 and current_matrix()==matrix
    assert [d['object'] for d in draws]==objects
    assert all(c['matrix']==matrix for c in calls if c['kind'] in ['build','drawEntry'])
    assert all(d['matrix']==identity for d in draws)
    for source,state,draw in zip(children,generated,draws):
     control=next(c for c in library['boltControls'] if c['node']==source['index'])
     rows.append(dict(root=root['index'],node=source['index'],parent=parent,matrix=matrix,eye=eye,segments=state['segments'],vertices=draw['vertices'],width=control['width'],color=control['color']))
    assert [c['kind'] for c in calls]==['drawEntry','build','push','identity','pop']*len(children)
instructions=[]
for start,length in [(0x479192,0x4c),(0x47f011,0x54),(0x47d935,0xa7)]:
 instructions.extend(dict(address=hex(i.address),mnemonic=i.mnemonic,operands=i.op_str) for i in Cs(CS_ARCH_X86,CS_MODE_32).disasm(bytes(machine.mem_read(start,length)),start))
(ROOT/'recovery/output/effect-sol-bolt-render-parent-native.json').write_text(json.dumps(dict(rows=rows,roots=[r['index'] for r in roots],instructions=instructions))+'\n')
print(f'PASS: {len(roots)} original source trees / {len(rows)} complete attached bolt draws; incoming matrix preserved, submit identity')
