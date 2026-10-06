"""Execute original manager update/render traversal with supplied node callbacks."""
import json,struct,sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX,UC_X86_REG_ESP,UC_X86_REG_EIP
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,4096);machine.mem_map(0x2000000,0x20000)
MANAGER,VECTOR,SENTINEL,STACK,STOP=0x2010000,0x2012000,0x2013000,0x2008000,0x201f000
nodes=[0x2014000+i*0x100 for i in range(4)];events=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def hook(uc,address,size,data):
 if address==0x47899b:pop=0
 else:
  obj=uc.reg_read(UC_X86_REG_ECX)
  events.append(nodes.index(obj));pop=4 if address==0x47f61c else 0
 stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
for address in [0x47899b,0x47f61c,0x47f011,0x47efd6]:machine.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
machine.mem_write(MANAGER+0x50,struct.pack('<I',SENTINEL));machine.mem_write(SENTINEL,struct.pack('<I',SENTINEL));machine.mem_write(MANAGER+0x64,bytes([1,1]))
rows=[]
for count in range(5):
 machine.mem_write(MANAGER+4,struct.pack('<II',VECTOR,VECTOR+count*4))
 if count:machine.mem_write(VECTOR,struct.pack('<'+'I'*count,*nodes[:count]))
 row=dict(count=count)
 for name,address in [('update',0x4790dc),('render',0x479192),('renderExtra',0x479146)]:
  events.clear();machine.mem_write(STACK,struct.pack('<If',STOP,.016));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,MANAGER)
  machine.emu_start(address,STOP,count=100000);row[name]=list(events)
 assert row['update']==list(reversed(range(count)));assert row['render']==list(range(count));assert row['renderExtra']==list(range(count));rows.append(row)
(ROOT/'recovery/output/effect-manager-order-native.json').write_text(json.dumps(rows)+'\n')
print('PASS: original manager reverse active update / forward rendering, 0–4 roots')
