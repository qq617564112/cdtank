"""Execute original recursive tree creation using source definition lookup and supplied pool."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0x2000000,0x800000)
MANAGER,POOLS,DEFINITIONS,RECORDS,CHILDREN,OBJECTS,STACK,STOP=0x2010000,0x2011000,0x2020000,0x2180000,0x21c0000,0x2280000,0x2008000,0x27ff000
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
created=[];attached=[]
child_address=CHILDREN
for node in library['nodes']:
    definition=DEFINITIONS+node['index']*0x180;record=RECORDS+node['index']*20
    machine.mem_write(definition,struct.pack('<I',node['id']))
    machine.mem_write(definition+0x148,struct.pack('<I',node['type']))
    machine.mem_write(record,struct.pack('<5I',definition,0,child_address,child_address+len(node['children'])*4,child_address+len(node['children'])*4))
    if node['children']:machine.mem_write(child_address,struct.pack('<'+'I'*len(node['children']),*node['children']))
    child_address+=len(node['children'])*4
machine.mem_write(MANAGER+0x14,struct.pack('<III',RECORDS,RECORDS+len(library['nodes'])*20,RECORDS+len(library['nodes'])*20))
machine.mem_write(MANAGER+0x24,struct.pack('<I',POOLS))
machine.mem_write(POOLS,struct.pack('<12I',*(POOLS+0x100+i*16 for i in range(12))))
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def finish(pop=0):
    stack=machine.reg_read(UC_X86_REG_ESP);machine.reg_write(UC_X86_REG_EIP,uint(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
def hook(uc,a,size,data):
    stack=uc.reg_read(UC_X86_REG_ESP)
    if a==0x47facf:
        output,definition=uint(stack+4),uint(stack+8)
        index=(definition-DEFINITIONS)//0x180;obj=OBJECTS+len(created)*0x100
        assert uc.reg_read(UC_X86_REG_ECX)==POOLS+0x100+library['nodes'][index]['type']*16
        uc.mem_write(obj,bytes(0x100));uc.mem_write(obj+12,struct.pack('<I',definition));uc.mem_write(output,struct.pack('<I',obj))
        created.append(dict(node=index,object=obj));finish(8)
    elif a==0x47f867:
        parent,child=uc.reg_read(UC_X86_REG_ECX),uint(stack+4)
        attached.append(dict(parent=(uint(parent+12)-DEFINITIONS)//0x180,child=(uint(child+12)-DEFINITIONS)//0x180))
        uc.mem_write(child+0x28,struct.pack('<I',parent));finish(4)
for address in [0x47facf,0x47f867]:
    machine.hook_add(UC_HOOK_CODE,hook,begin=address,end=address)
rows=[]
for node in library['nodes']:
    for retain in [False,True]:
        created.clear();attached.clear()
        machine.mem_write(STACK,struct.pack('<III',STOP,node['id'],int(retain)))
        machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,MANAGER)
        machine.emu_start(0x4795fa,STOP,count=100000000)
        assert machine.reg_read(UC_X86_REG_ESP)==STACK+12
        rows.append(dict(node=node['index'],retain=retain,created=[dict(node=r['node'],retain=bool(machine.mem_read(r['object']+0x3c,1)[0])) for r in created],attached=list(attached)))
(ROOT/'recovery/output/effect-tree-create-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} original source tree creations / {sum(len(r["created"]) for r in rows)} created nodes')
