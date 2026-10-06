"""Execute all original type5 non-path full lifecycles and model backend calls."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x80000)
OBJECT, DEFINITION, TABLE, CONTROL, RESOURCE, STACK, STOP, ORIGIN, MANAGER, BACKEND, VTABLE = 0x2010000, 0x2011000, 0x2012000, 0x2040000, 0x2015000, 0x2008000, 0x203f000, 0x201d000, 0x201e000, 0x2021000, 0x2022000
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
events=[]
def uint(address): return struct.unpack('<I',machine.mem_read(address,4))[0]
def finish(pop=0):
    stack=machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP,uint(stack))
    machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
set_rate=uint(0x5c0af8)
def hook(uc,address,size,data):
    stack=uc.reg_read(UC_X86_REG_ESP)
    if address==0x47b81b:
        uc.reg_write(UC_X86_REG_EAX,MANAGER);finish()
    elif address==STOP+16:
        events.append(dict(kind='update'));finish()
    elif address==STOP+32:
        events.append(dict(kind='setTime',time=struct.unpack('<f',uc.mem_read(stack+4,4))[0]));finish(4)
    elif address==set_rate:
        events.append(dict(kind='setRate',rate=struct.unpack('<f',uc.mem_read(stack+4,4))[0]));finish(4)
    elif address==0x47f262:
        events.append(dict(kind='release'));uc.mem_write(OBJECT+4,bytes(8));finish()
machine.hook_add(UC_HOOK_CODE,hook)
machine.mem_write(BACKEND,struct.pack('<I',VTABLE))
machine.mem_write(VTABLE+0x14,struct.pack('<I',STOP+16))
machine.mem_write(VTABLE+0x1c,struct.pack('<I',STOP+32))
matrices=[[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],[.8,0,-.6,0,0,1,0,0,.6,0,.8,0,5,-7,11,1]]
rows=[]
def state():
    fields=list(struct.unpack('<16f',machine.mem_read(OBJECT+0x40,64)))
    return dict(position=fields[:3],orbitOffset=fields[3:6],velocity=fields[6:9],angles=fields[9:12],scale=fields[12:15],alpha=fields[15])
for node in library['nodes']:
    if node['type']!=5:continue
    timing=next(t for t in library['nodeTimings'] if t['node']==node['index'])
    resource=bytes.fromhex(node['resource'])
    assert not resource[328]
    for matrix in matrices:
        for has_parent in [False,True]:
            machine.mem_write(OBJECT,bytes(0x100));machine.mem_write(DEFINITION,bytes(0x180));machine.mem_write(RESOURCE,bytes(0x300))
            machine.mem_write(OBJECT,struct.pack('<I',0x5c9628))
            for address,value in [(OBJECT+12,DEFINITION),(OBJECT+0x20,int(has_parent)),(OBJECT+0x80,BACKEND),(DEFINITION+0x150,RESOURCE),(DEFINITION+0x160,TABLE),(DEFINITION+0x164,TABLE+len(timing['controllers'])*4)]:machine.mem_write(address,struct.pack('<I',value))
            machine.mem_write(DEFINITION+0x154,struct.pack('<ff',timing['delay'],timing['lifetime']))
            machine.mem_write(RESOURCE+0x148,resource[324:328])
            machine.mem_write(MANAGER+0x68,struct.pack('<16f',*matrix))
            for i,control in enumerate(timing['controllers']):
                address=CONTROL+i*0x300
                machine.mem_write(TABLE+i*4,struct.pack('<I',address))
                machine.mem_write(address,bytes(0x100))
                machine.mem_write(address+4,struct.pack('<ffB',control['start'],control['end'],control['flag']))
                machine.mem_write(address+0x10,bytes.fromhex(node['modifiers'][i]['payload']))
            origin=[0,0,0] if has_parent else [12.5,-3.75,21]
            machine.mem_write(ORIGIN,struct.pack('<3f',*origin));machine.mem_write(STACK,struct.pack('<II',STOP,ORIGIN))
            machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT);machine.reg_write(UC_X86_REG_FPCW,0x27f)
            events.clear();machine.emu_start(0x47eabe,STOP,count=100000)
            started=dict(state=state(),events=list(events))
            steps=[]
            for delta in [0,max(0,timing['delay']),.016,.1,.125,.25,1,1,max(0,timing['lifetime'])+1,0,0]:
                events.clear();machine.mem_write(STACK,struct.pack('<If',STOP,delta))
                machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT)
                machine.emu_start(0x47f61c,STOP,count=100000)
                assert machine.reg_read(UC_X86_REG_ESP)==STACK+8
                steps.append(dict(delta=delta,events=list(events),phase=uint(OBJECT+4),elapsed=struct.unpack('<f',machine.mem_read(OBJECT+8,4))[0],controller=struct.unpack('<i',machine.mem_read(OBJECT+0x10,4))[0],state=state()))
            controls=[r for r in library['modelControls'] if r['node']==node['index']]
            rows.append(dict(node=node['index'],timing=timing,controls=controls,matrix=matrix,hasParent=has_parent,origin=origin,started=started,steps=steps))
(ROOT/'recovery/output/effect-model-lifecycles-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} source type5 model lifecycles / {sum(len(r["steps"]) for r in rows)} ticks')
