"""Execute type2 original full attached start and lifecycle/geometry dispatch."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,0x1000);machine.mem_map(0x2000000,0x80000)
OBJECT,DEFINITION,RESOURCE,SEGMENTS,STACK,STOP=0x2010000,0x2011000,0x2015000,0x2020000,0x2008000,0x203f000
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
random_values=[];random_index=0;events=[]
random_seed=[8191,24575,16383,1000]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def hook(uc,a,size,data):
    global random_index
    if a==0x47f262:
        events.append(dict(kind='release'));uc.mem_write(OBJECT+4,bytes(8))
        stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4)
    elif a==0x57a6c7:
        stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4)
    elif a==0x57cbcb:
        v=random_seed[random_index%len(random_seed)];random_index+=1;random_values.append(v)
        stack=uc.reg_read(UC_X86_REG_ESP);uc.reg_write(UC_X86_REG_EAX,v);uc.reg_write(UC_X86_REG_EIP,uint(stack));uc.reg_write(UC_X86_REG_ESP,stack+4)
machine.hook_add(UC_HOOK_CODE,hook)
rows=[]
parents=[[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
         [0,1,0,0,-1,0,0,0,0,0,1,0,12.5,-3.75,21,1]]
for node in library['nodes']:
    if node['type']!=2:continue
    raw=bytes.fromhex(node['resource'])
    timing=next(t for t in library['nodeTimings'] if t['node']==node['index'])
    config=next(c for c in library['boltControls'] if c['node']==node['index'])
    for initial_parent in parents:
        for mode in ['natural','stopWaiting','stopActive']:
            machine.mem_write(OBJECT,bytes(0x100));machine.mem_write(DEFINITION,bytes(0x180));machine.mem_write(RESOURCE,bytes(0x200))
            machine.mem_write(OBJECT+12,struct.pack('<I',DEFINITION));machine.mem_write(DEFINITION+0x150,struct.pack('<I',RESOURCE))
            machine.mem_write(OBJECT+0x70,struct.pack('<I',SEGMENTS));machine.mem_write(OBJECT+0x80,struct.pack('<I',0x2030000));machine.mem_write(RESOURCE+0x148,raw[324:])
            machine.mem_write(OBJECT,struct.pack('<I',0x5c9ad0))
            machine.mem_write(DEFINITION+0x154,struct.pack('<ff',timing['delay'],timing['lifetime']))
            table,control=0x2012000,0x2040000
            machine.mem_write(DEFINITION+0x160,struct.pack('<II',table,table+len(timing['controllers'])*4))
            for i,c in enumerate(timing['controllers']):
                machine.mem_write(table+i*4,struct.pack('<I',control+i*96))
                machine.mem_write(control+i*96+4,struct.pack('<ffB',c['start'],c['end'],c['flag']))
            parent_address=0x201c000
            random_index=0;operations=[]
            def snapshot():
                count=uint(OBJECT+0x68)
                return dict(phase=uint(OBJECT+4),elapsed=struct.unpack('<f',machine.mem_read(OBJECT+8,4))[0],controller=struct.unpack('<i',machine.mem_read(OBJECT+0x10,4))[0],
                    state=dict(start=list(struct.unpack('<3f',machine.mem_read(OBJECT+0x40,12))),end=list(struct.unpack('<3f',machine.mem_read(OBJECT+0x4c,12))),
                    segments=[list(struct.unpack('<3f',machine.mem_read(SEGMENTS+i*12,12))) for i in range(count)],
                    worldSegments=[list(struct.unpack('<10f',machine.mem_read(0x2030000+i*40,40))) for i in range(count)],
                    remainder=struct.unpack('<f',machine.mem_read(OBJECT+0x64,4))[0]))
            def execute(kind,parent,delta=0):
                random_values.clear();events.clear()
                # Storage is supplied after the native zero-matrix vector free.
                machine.mem_write(OBJECT+0x70,struct.pack('<I',SEGMENTS))
                machine.mem_write(parent_address,struct.pack('<16f',*parent))
                args=struct.pack('<III',STOP,parent_address,0) if kind=='start' else struct.pack('<If',STOP,delta) if kind=='tick' else struct.pack('<I',STOP)
                machine.mem_write(STACK,args);machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,OBJECT);machine.reg_write(UC_X86_REG_FPCW,0x27f)
                machine.emu_start({'start':0x47f065,'tick':0x47f61c,'stop':0x47f3c4}[kind],STOP,count=1000000)
                assert machine.reg_read(UC_X86_REG_ESP)==STACK+len(args)
                if kind=='start':assert uint(OBJECT+0x20)==parent_address
                operations.append(dict(kind=kind,parent=parent,delta=delta,**snapshot(),randomValues=list(random_values),events=list(events)))
            for repeat in range(2):
                parent=list(initial_parent);parent[12]+=repeat*4;parent[14]-=repeat*2
                execute('start',parent)
                if mode=='stopWaiting':
                    execute('stop',parent)
                else:
                    for i,delta in enumerate([0,max(0,timing['delay'])/2,max(0,timing['delay'])/2,.016,.03,.03,.03,max(0,timing['lifetime'])+1,0,0]):
                        moving=list(parent);moving[12]+=i*.5;moving[14]-=i*.25
                        if i==4:moving=[0]*16
                        execute('tick',moving,delta)
                        if mode=='stopActive' and i==2:
                            execute('stop',moving);break
                    # Includes indefinite source lifetimes; explicit stop closes those nodes.
                    if uint(OBJECT+4)!=0:execute('stop',parent)
                execute('tick',parent,0)
            rows.append(dict(node=node['index'],config=config,timing=timing,initialParent=initial_parent,mode=mode,operations=operations))
(ROOT/'recovery/output/effect-sol-bolt-attached-lifecycles-native.json').write_text(json.dumps(dict(rows=rows))+'\n')
print(f'PASS: {len(rows)} source attached lifecycle sequences / {sum(len(r["operations"]) for r in rows)} start/tick/stop operations')
