"""Original per-type pool allocation/release; factory/storage/unbind supplied."""
import json,struct,sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX,UC_X86_REG_ESP,UC_X86_REG_EAX,UC_X86_REG_EIP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x20000)
POOL,VECTOR,VTABLE,NODE_VTABLE,FACTORY,UNBIND,STACK,STOP=0x2010000,0x2012000,0x2013000,0x2013100,0x201f100,0x201f200,0x2008000,0x201f000
created=[];events=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def hook(uc,address,size,data):
 obj=uc.reg_read(UC_X86_REG_ECX);stack=uc.reg_read(UC_X86_REG_ESP);pop=0
 if address==FACTORY:
  node=0x2014000+len(created)*0x100;created.append(node);uc.mem_write(node,struct.pack('<I',NODE_VTABLE));uc.reg_write(UC_X86_REG_EAX,node)
  events.append(dict(kind='create',node=len(created)-1))
 elif address==UNBIND:events.append(dict(kind='unbind',node=created.index(obj)))
 else:
  end=uint(obj+8);value=uint(uint(stack+4));uc.mem_write(end,struct.pack('<I',value));uc.mem_write(obj+8,struct.pack('<I',end+4));pop=4
 uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [FACTORY,UNBIND,0x469ebd]:machine.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
machine.mem_write(POOL,struct.pack('<6I',VTABLE,0,VECTOR,VECTOR,VECTOR+0x100,0));machine.mem_write(VTABLE+8,struct.pack('<I',FACTORY));machine.mem_write(NODE_VTABLE+12,struct.pack('<I',UNBIND))
operations=[('take',None),('take',None),('take',None),('release',1),('take',None),('release',0),('release',2),('take',None),('take',None),('take',None),('release',1),('release',3),('release',2),('release',0),('release',0),('take',None),('take',None)]
rows=[]
for operation,node in operations:
 events.clear();machine.mem_write(STACK,struct.pack('<I',STOP)+(struct.pack('<I',created[node]) if operation=='release' else b''));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,POOL)
 machine.emu_start(0x47f90a if operation=='take' else 0x47f1bc,STOP,count=100000)
 count=(uint(POOL+12)-uint(POOL+8))//4
 slots=[created.index(uint(VECTOR+i*4)) for i in range(count)]
 row=dict(operation=operation,node=node,slots=slots,activeCount=uint(POOL+0x14),events=list(events))
 if operation=='take':row['result']=created.index(machine.reg_read(UC_X86_REG_EAX))
 rows.append(row)
(ROOT/'recovery/output/effect-object-pool-native.json').write_text(json.dumps(rows)+'\n')
print(f'PASS: original per-type pool / {len(rows)} create, reuse, swap release and inactive release operations')
