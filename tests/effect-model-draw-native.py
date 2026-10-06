"""Run the complete original type5 draw and DLL matrix/blend/priority routines."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x80000)
OBJECT, BACKEND, CHILD, VTABLE, GFX, ENGINE, MATRIX_STACK, MATRICES, PARENT, MANAGER, STACK, STOP = [0x2010000+i*0x1000 for i in range(12)]
IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
parents = [None,[0,0,-1,0,0,1,0,0,1,0,0,0,100,20,300,1],[0]*16]
globals_ = [IDENTITY,[.8,0,-.6,0,0,1,0,0,.6,0,.8,0,5,-7,11,1]]
def uint(address): return struct.unpack('<I',machine.mem_read(address,4))[0]
def put(address,*values): machine.mem_write(address,struct.pack('<'+'I'*len(values),*values))
def finish(pop=0):
    stack=machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP,uint(stack))
    machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
events=[]
def hook(uc,address,size,data):
    if address==0x47b81b:
        uc.reg_write(UC_X86_REG_EAX,MANAGER);finish()
    elif address==STOP+16:
        assert uint(uc.reg_read(UC_X86_REG_ESP)+4)==0
        events.append(dict(kind='attach',matrix=list(struct.unpack('<16f',uc.mem_read(MATRICES+64,64)))))
        finish(4)
    elif address in (0x10031350,0x10031380):
        events.append(dict(kind='push' if address==0x10031350 else 'pop'))
machine.hook_add(UC_HOOK_CODE,hook)
put(0x635830,GFX);put(GFX+8,ENGINE);put(ENGINE+0xd4,MATRIX_STACK)
put(VTABLE+0x10,STOP+16)
source=json.loads((ROOT/'recovery/output/effect-model-lifecycles-native.json').read_text())
rows=[]
for sequence in source['rows']:
    if sequence['hasParent'] or sequence['matrix'] != IDENTITY: continue
    states=[sequence['started']['state']]+[step['state'] for step in sequence['steps'][:8]]
    for sample,state in enumerate(states):
        for parent in parents:
            for global_ in globals_:
                machine.mem_write(OBJECT,bytes(0x100));machine.mem_write(BACKEND,bytes(0x150));machine.mem_write(CHILD,bytes(0x150))
                put(OBJECT,0x5c9628);put(OBJECT+0x20,PARENT if parent is not None else 0);put(OBJECT+0x80,BACKEND)
                put(BACKEND,VTABLE);put(BACKEND+0xc,CHILD)
                fields=state['position']+state['orbitOffset']+state['velocity']+state['angles']+state['scale']+[state['alpha']]
                machine.mem_write(OBJECT+0x40,struct.pack('<16f',*fields))
                if parent is not None: machine.mem_write(PARENT,struct.pack('<16f',*parent))
                machine.mem_write(MANAGER+0x68,struct.pack('<16f',*global_))
                put(MATRIX_STACK,MATRICES,4,0,0);machine.mem_write(MATRICES,struct.pack('<16f',*IDENTITY))
                put(STACK,STOP);machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT);machine.reg_write(UC_X86_REG_FPCW,0x27f)
                events.clear();machine.emu_start(0x47e56a,STOP,count=100000)
                assert uint(MATRIX_STACK+8)==0
                assert machine.reg_read(UC_X86_REG_ESP)==STACK+4
                blend=uint(BACKEND+0x50);alpha=struct.unpack('<f',machine.mem_read(BACKEND+0x4c,4))[0];priority=struct.unpack('<i',machine.mem_read(BACKEND+0x30,4))[0]
                assert machine.mem_read(BACKEND+0x4c,8)==machine.mem_read(CHILD+0x4c,8)
                assert uint(BACKEND+0x30)==uint(CHILD+0x30)
                rows.append(dict(node=sequence['node'],sample=sample,state=state,parent=parent,globalMatrix=global_,blend=blend,alpha=alpha,priority=priority,events=list(events)))
output=dict(drawAddress='0x47e56a',threshold=struct.unpack('<f',machine.mem_read(0x5ccffc,4))[0],rows=rows)
(ROOT/'recovery/output/effect-model-draw-native.json').write_text(json.dumps(output)+'\n')
print(f'PASS: {len(rows)} complete original model draws, recursive blend/priority, matrix push/pop')
