"""Execute original online001 retained movement tree repeated world starts."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX,UC_X86_REG_ESP,UC_X86_REG_EIP,UC_X86_REG_EAX,UC_X86_REG_FPCW
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'recovery'))
from effect_native import map_original_binaries
machine,_=map_original_binaries([ROOT/'CDTank'/name for name in ['CDTank.exe','gbengine.dll','msvcr71.dll']])
machine.mem_map(0,0x1000);machine.mem_map(0x2000000,0x1000000)
STACK,STOP,MANAGER,READER_CALL,READER_VTABLE,READER_OBJECT=0x2008000,0x2fff000,0x2010000,0x201f100,0x201f200,0x201f300
library=json.loads((ROOT/'recovery/output/web-assets/effect-library.json').read_text())
source_indices=[2424,2425,2455,2814,2815,2816]
addresses={index:0x2100000+i*0x100000 for i,index in enumerate(source_indices)}
by_address={value:key for key,value in addresses.items()}
stream=b'';offset=0;random_index=0;random_values=[];events=[]
def uint(a):return struct.unpack('<I',machine.mem_read(a,4))[0]
def finish(pop=0):
    stack=machine.reg_read(UC_X86_REG_ESP);machine.reg_write(UC_X86_REG_EIP,uint(stack));machine.reg_write(UC_X86_REG_ESP,stack+4+pop)
def hook(uc,a,size,data):
    global offset,random_index
    stack=uc.reg_read(UC_X86_REG_ESP);obj=uc.reg_read(UC_X86_REG_ECX)
    if a==READER_CALL:
        destination,length=uint(stack+4),uint(stack+8);uc.mem_write(destination,stream[offset:offset+length]);offset+=length;uc.reg_write(UC_X86_REG_EAX,length);finish(8)
    elif a==0x57cbcb:
        value=[8191,24575,16383,1000][random_index%4];random_index+=1;random_values.append(value);uc.reg_write(UC_X86_REG_EAX,value);finish()
    elif a==0x47b81b:uc.reg_write(UC_X86_REG_EAX,MANAGER);finish()
    elif a==0x4816c6:uc.mem_write(uint(stack+4),bytes(uc.mem_read(uint(stack+8),80)));finish()
    elif a==0x449072:uc.mem_write(obj+0xc,bytes(8));finish()
    elif a==0x482dc3:uc.mem_write(obj+0x10,struct.pack('<I',1));finish(4)
    elif a==0x47f262:
        events.append(dict(kind='release',node=by_address[obj]));parent=uint(obj+0x28)
        if parent:
            start,end=uint(parent+0x30),uint(parent+0x34);children=list(struct.unpack('<'+'I'*((end-start)//4),uc.mem_read(start,end-start)))
            children.remove(obj)
            if children:uc.mem_write(start,struct.pack('<'+'I'*len(children),*children))
            uc.mem_write(parent+0x34,struct.pack('<I',start+len(children)*4))
        uc.mem_write(obj+4,bytes(8));finish()
for a in [READER_CALL,0x57cbcb,0x47b81b,0x4816c6,0x449072,0x482dc3,0x47f262]:machine.hook_add(UC_HOOK_CODE,hook,begin=a,end=a)
identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
machine.mem_write(MANAGER+0x68,struct.pack('<16f',*identity))
configs=[]
for index in source_indices:
    node=library['nodes'][index];obj=addresses[index];definition=obj+0x1000;table=obj+0x2000;control=obj+0x4000;resource=obj+0x8000;particles=obj+0x10000;emitter=obj+0x3000
    timing=next(t for t in library['nodeTimings'] if t['node']==index)
    controls=[c for c in library['spriteControls' if node['type']==1 else 'particleControls'] if c['node']==index] if node['type'] else []
    for i,source in enumerate(node['modifiers']):
        base,payload=bytes.fromhex(source['base']),bytes.fromhex(source['payload']);stream=struct.pack('<I',len(base))+base+struct.pack('<I',len(payload))+payload;offset=0
        machine.mem_write(READER_OBJECT,struct.pack('<I',READER_VTABLE));machine.mem_write(READER_VTABLE+12,struct.pack('<I',READER_CALL))
        machine.mem_write(STACK,struct.pack('<II',STOP,READER_OBJECT));machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,control+i*0x300)
        machine.emu_start(0x476319 if node['type']==1 else 0x478626 if node['type']==6 else 0x47607a,STOP,count=100000)
        assert offset==(len(stream) if node['type'] else 4+len(base))
        machine.mem_write(table+i*4,struct.pack('<I',control+i*0x300))
    machine.mem_write(obj,struct.pack('<I',{0:0x5c9b38,1:0x5c9bf0,6:0x5c9b98}[node['type']]))
    for a,v in [(obj+12,definition),(definition+0x150,resource),(definition+0x160,table),(definition+0x164,table+len(node['modifiers'])*4)]:machine.mem_write(a,struct.pack('<I',v))
    machine.mem_write(definition+0x154,struct.pack('<ff',timing['delay'],timing['lifetime']))
    if node['type']==1:
        machine.mem_write(resource+0x150,struct.pack('<I',controls[0]['frameCount']))
        machine.mem_write(obj+0x68,struct.pack('<4I',obj+0xc000,128,0,0));machine.mem_write(obj+0xc000,struct.pack('<128I',*[particles+i*80 for i in range(128)]))
    elif node['type']==6:
        machine.mem_write(resource+0x150,struct.pack('<I',controls[0]['particleFrame']['frameCount']))
        for a,v in [(obj+0x40,particles),(obj+0x48,emitter),(obj+0x58,controls[0]['capacity'])]:machine.mem_write(a,struct.pack('<I',v))
    configs.append(dict(node=index,type=node['type'],controls=controls,timing=timing))
root=addresses[2424];source_by_id={n['id']:n['index'] for n in library['nodes']}
for index,obj in addresses.items():
    machine.mem_write(obj+0x3c,b'\1')
    children=[addresses[source_by_id[c]] for c in library['nodes'][index]['children']]
    machine.mem_write(obj+0x30,struct.pack('<II',obj+0xb000,obj+0xb000+len(children)*4))
    if children:machine.mem_write(obj+0xb000,struct.pack('<'+'I'*len(children),*children))
    for child in children:machine.mem_write(child+0x28,struct.pack('<I',obj))
def unpack_particle(raw):
    v=struct.unpack('<I22fIf',raw)
    return dict(visible=bool(v[0]),age=v[1],acceleration=list(v[2:5]),velocity=list(v[5:8]),position=list(v[8:11]),angles=list(v[11:14]),angleRate=list(v[14:17]),lifetime=v[17],scale=v[18],color=list(v[19:23]),frame=v[23],frameRemainder=v[24])
def unpack_sprite(raw):
    v=struct.unpack('<19fI',raw)
    return dict(position=list(v[:3]),orbitOffset=list(v[3:6]),velocity=list(v[6:9]),angles=list(v[9:12]),scale=list(v[12:15]),color=list(v[15:19]),frame=v[19])
def snapshot():
    rows=[]
    for config in configs:
        obj=addresses[config['node']];row=dict(node=config['node'],phase=uint(obj+4),elapsed=struct.unpack('<f',machine.mem_read(obj+8,4))[0],controller=struct.unpack('<i',machine.mem_read(obj+0x10,4))[0])
        if config['type']==1:
            first,count=uint(obj+0x70),uint(obj+0x74)
            row.update(states=[unpack_sprite(bytes(machine.mem_read(obj+0x10000+((first+i)%128)*80,80))) for i in range(count)],frameRemainder=struct.unpack('<f',machine.mem_read(obj+0x40,4))[0],trailElapsed=struct.unpack('<f',machine.mem_read(obj+0x78,4))[0])
        elif config['type']==6:
            row.update(states=[unpack_particle(bytes(machine.mem_read(obj+0x10000+i*100,100))) for i in range(uint(obj+0x54))],spaces=[list(struct.unpack('<6f',machine.mem_read(obj+0x3000+i*28,24))) for i in range(len(config['controls']))],burst=bool(machine.mem_read(obj+0x7c,1)[0]),fraction=struct.unpack('<f',machine.mem_read(obj+0x5c,4))[0])
        rows.append(row)
    return rows

def run(entry,obj,arg=None):
    machine.mem_write(STACK,struct.pack('<I',STOP)+(arg or b''))
    machine.reg_write(UC_X86_REG_ESP,STACK);machine.reg_write(UC_X86_REG_ECX,obj)
    machine.reg_write(UC_X86_REG_FPCW,0x27f)
    machine.emu_start(entry,STOP,count=10000000)
    assert machine.reg_read(UC_X86_REG_ESP)==STACK+4+len(arg or b'')
origin_address=0x201d000
steps=[]
for label,origin,deltas in [('first',[12.5,0,21],[.016,.016,.016,.016,.016,.016]),
                             ('repeat',[14.5,0,23],[.016,.016,.016,.016,.016,.016]),
                             ('natural-tail',None,[.1,.5,1,1,1])]:
    if origin:
        machine.mem_write(origin_address,struct.pack('<3f',*origin))
        run(0x47eed3,root,struct.pack('<I',origin_address))
        steps.append(dict(label=label+'-start',states=snapshot()))
    for delta in deltas:
        events.clear();random_values.clear()
        run(0x47f61c,root,struct.pack('<f',delta))
        assert not events, 'retained child released'
        steps.append(dict(label=label,delta=delta,states=snapshot(),events=list(events)))
run(0x47f3c4,root)
steps.append(dict(label='explicit-stop',states=snapshot()))
assert all(not r.get('states',[]) for r in snapshot())
assert all((uint(addresses[i]+0x34)-uint(addresses[i]+0x30))//4==len(library['nodes'][i]['children']) for i in addresses)
(ROOT/'recovery/output/role-movement-dust-tree-native.json').write_text(json.dumps(dict(status='PASS_RETAINED001_REPEAT_WORLD_START',configs=configs,steps=steps,scope='Full original particle modifiers, world start, recursive lifecycle and particle state execute for six-node retained001 tree. Allocation/child tables are supplied; CRT random is deterministic; manager transform identity and graphics absent. No source loader or player pixels claimed.'),indent=2)+'\n')
print('PASS: retained001 repeated world starts, natural tail, explicit stop; no child release')
