"""Execute original426b92 role overlap separation with native OBB and NAV."""
from pathlib import Path
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG, UC_X86_REG_EBP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x800000)
ROLE, RECORD, DEFINITION, OUT = 0x2001000, 0x2002000, 0x2003000, 0x2004000
OTHER, OTHER_RECORD, OTHER_DEFINITION = 0x2005000, 0x2006000, 0x2007000
NAV, CELLS = 0x2010000, 0x2020000
CTRL, HEAD, NODE, MANAGER, MAP_MANAGER, NAV_MANAGER = 0x2050000, 0x2051000, 0x2052000, 0x2053000, 0x2054000, 0x2055000
SCENE, SCENE_DATA, STACK, STOP = 0x2056000, 0x2057000, 0x20f0000, 0x20f1000
WIDTH = 100


def u32(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def floats(address, count):
    return list(struct.unpack('<' + 'f' * count, uc.mem_read(address, count * 4)))


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def put_floats(address, *values):
    uc.mem_write(address, struct.pack('<' + 'f' * len(values), *values))


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def close(actual, expected, label):
    assert len(actual) == len(expected)
    assert all(abs(a-b) < 0.00015 for a,b in zip(actual,expected)), (label,actual,expected)


def setup_role(role, record, definition, *, x=200, z=200, command=1,
               velocity=30, turn_velocity=.5, tank_type=4, definition_present=True,
               forward=(1,0,0), look=None):
    uc.mem_write(role, bytes(0x400))
    uc.mem_write(record, bytes(0x200))
    uc.mem_write(definition, bytes(0x100))
    put(role, 0x5c2c28)
    put(role + 0x2a0, record)
    put(role + 0x2a8, definition if definition_present else 0)
    put(record + 0xc, 1 if role == ROLE else 2)
    put(record + 0x90, 2)
    put_floats(record + 0x48, velocity, turn_velocity)
    put(definition + 0x50, tank_type)
    put(role + 0x258, command)
    put_floats(role + 0x25c, x, 0, z)
    put_floats(role + 0x268, x-1, 0, z-1)
    put_floats(role + 0x274, *(look or forward))
    put_floats(role + 0x280, *forward)
    put_floats(role + 0x28c, x, 0, z+80)
    # Source matrix is the Y rotation matching the supplied body direction.
    yaw = math.atan2(forward[0], forward[2])
    c, s = math.cos(yaw), math.sin(yaw)
    put_floats(role + 0x2b8, c,0,-s,0, 0,1,0,0, s,0,c,0, x,0,z,1, 49,24,52)


def setup_nav(blocked=False):
    uc.mem_write(NAV, bytes(0xa8))
    put(NAV, 1)
    put_floats(NAV + 4 + 0x80, 0,0,0)
    put_floats(NAV + 4 + 0x8c, 1200,0,1200)
    put(NAV + 4 + 0x98, WIDTH,WIDTH,CELLS)
    cell = bytes(8) if blocked else struct.pack('<fI',0,2)
    uc.mem_write(CELLS, cell * WIDTH * WIDTH)


from nav import read_nav
THREAD, POSE_DATA = 0x2060000, 0x2061000
CELLS = 0x2070000
clock = 0x2062000
put(0x5c05c4,clock)
state = {}
def returned(value, pop=0):
    stack=uc.reg_read(UC_X86_REG_ESP)
    target=u32(stack)
    uc.reg_write(UC_X86_REG_EAX,value)
    uc.reg_write(UC_X86_REG_ESP,stack+4+pop)
    uc.reg_write(UC_X86_REG_EIP,target)

def observe(machine,address,size,data):
    s=uc.reg_read(UC_X86_REG_ESP)
    if address == clock:
        state['clock_calls']+=1
        returned(state['clock'])
    elif address == 0x58139a:
        state['thread_calls']+=1
        returned(THREAD)
    elif address == 0x426b92:
        state['entries'].append(dict(role=u32(s+4),arg2=u32(s+8),depth=u32(s+12),caller=hex(u32(s))))
    elif address == 0x433112:
        state['set_positions'].append(floats(u32(s+4),3))
    elif address == 0x434cee:
        state['trials'].append(dict(command=u32(s+12),map=u32(s+8),position=floats(s+16,3)))
    elif address == 0x426db0:
        state['trials'][-1]['accepted']=bool(uc.reg_read(UC_X86_REG_EAX)&255)
    elif address == 0x4229cd:
        state['visual_updates']+=1
    elif address == 0x10032ce0:
        state['obb_calls']+=1
    elif address == 0x45758f:
        state['nav_queries']+=1
    elif address == 0x426cc5:
        state['random_vectors'].append(floats(uc.reg_read(UC_X86_REG_EBP)+0x60,3))
    elif address == 0x426ccd:
        state['directions'].append(floats(uc.reg_read(UC_X86_REG_EBP)+0x60,3))
    elif address == 0x410069:
        state['random_calls']+=1
for a in [clock,0x58139a,0x426b92,0x433112,0x434cee,0x426db0,0x4229cd,0x10032ce0,0x45758f,0x410069,0x426cc5,0x426ccd]:
    uc.hook_add(UC_HOOK_CODE,observe,begin=a,end=a)

paths=sorted((ROOT/'recovery/output/verified/assets/data/Data/scn').rglob('*.nav'))
path=next(p for p in paths if p.stem=='20') if any(p.stem=='20' for p in paths) else paths[0]
parsed=read_nav(path)
layer=parsed['layers'][0]
raw=path.read_bytes()
cell_bytes=raw[parsed['gridOffset']+160:parsed['geometryOffset']]
width,height=layer['width'],layer['height']
valid=[(flags&255)>1 for _,flags in layer['cells']]
def neighborhood(wanted):
    for z in range(8,height-8):
        for x in range(8,width-8):
            if all(valid[zz*width+xx]==wanted for zz in range(z-7,z+8) for xx in range(x-7,x+8)):
                return [layer['minimum'][0]+x*12+6,0,layer['minimum'][2]+z*12+6]
    return None
clear=neighborhood(True)
blocked=neighborhood(False)
assert clear is not None

def setup_scene():
    put(CTRL,0x5c3a18)
    put(CTRL+0x10,HEAD)
    put(HEAD,NODE,NODE,NODE)
    uc.mem_write(HEAD+0x15,b'\x01')
    put(NODE,HEAD,HEAD,HEAD,2,OTHER)
    uc.mem_write(NODE+0x15,b'\x00')
    put(0x635830,SCENE)
    put(SCENE+0x60,SCENE_DATA)
    put(SCENE_DATA+4,NAV)
    uc.mem_write(NAV,struct.pack('<I',1))
    uc.mem_write(NAV+4,bytes.fromhex(layer['description'])+struct.pack('<6f3I',*layer['minimum'],*layer['maximum'],width,height,CELLS))
    uc.mem_write(CELLS,cell_bytes)

rows=[]
def run(name,position,offset=0,depth=0,status=2,same_id=False,clock_value=12345,network=False):
    global state
    setup_role(ROLE,RECORD,DEFINITION,x=position[0]+offset,z=position[2],command=0)
    setup_role(OTHER,OTHER_RECORD,OTHER_DEFINITION,x=position[0],z=position[2],command=0)
    put(OTHER_RECORD+0x90,status)
    if same_id:put(OTHER_RECORD+0xc,1)
    setup_scene()
    before=bytes(uc.mem_read(ROLE,0x400))
    other_before=bytes(uc.mem_read(OTHER,0x400))
    state=dict(entries=[],set_positions=[],trials=[],visual_updates=0,obb_calls=0,nav_queries=0,
               random_calls=0,clock_calls=0,thread_calls=0,clock=clock_value,random_vectors=[],directions=[])
    for reg,value in [(UC_X86_REG_FPCW,0x27f),(UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]:uc.reg_write(reg,value)
    if network:
        uc.mem_write(POSE_DATA,struct.pack('<IIffII',0,0,position[0]+offset,position[2],0,0))
        put(STACK,STOP,ROLE,POSE_DATA)
        entry=0x42823e
    else:
        put(STACK,STOP,ROLE,0,depth)
        entry=0x426b92
    uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.reg_write(UC_X86_REG_ECX,CTRL)
    uc.emu_start(entry,STOP,count=10000000)
    assert uc.reg_read(UC_X86_REG_EIP)==STOP,name
    assert bytes(uc.mem_read(OTHER,0x400))==other_before,name
    after=bytes(uc.mem_read(ROLE,0x400))
    changed=[hex(i) for i in range(0x400) if before[i]!=after[i]]
    row=dict(name=name,entry=hex(entry),input_position=list(struct.unpack_from('<3f',before,0x25c)),input_previous=list(struct.unpack_from('<3f',before,0x268)),input_obb=list(struct.unpack_from('<19f',before,0x2b8)),status=status,same_id=same_id,depth=depth,start=floats(ROLE+0x268,3) if not state['set_positions'] else [position[0]+offset,0,position[2]],
             other_position=position,output_position=floats(ROLE+0x25c,3),output_previous=floats(ROLE+0x268,3),
             output_obb=floats(ROLE+0x2b8,19),changed_bytes=changed,other_unchanged=True,**state)
    assert row['output_obb'][16:]==[49,24,52],name
    assert all(0x25c<=int(i,16)<0x274 or 0x2b8<=int(i,16)<0x2f8 for i in changed),name
    rows.append(row)
    print(name,row['output_position'],len(state['entries']),state['trials'][:1])

run('nonoverlap-real-nav',clear,offset=100)
run('overlap-real-nav',clear,offset=10)
run('negative-overlap-real-nav',clear,offset=-10)
run('coincident-real-nav',clear)
run('coincident-small-random-remains-overlap',clear,clock_value=1)
run('same-id-skipped',clear,same_id=True)
run('status3-skipped',clear,status=3)
run('depth51-stops',clear,depth=51)
run('depth50-enters',clear,depth=50)
run('network-pose-overlap',clear,offset=10,network=True)
if blocked is not None:
    run('blocked-overlap-recurses',blocked,offset=10)
    run('blocked-coincident-recurses',blocked)
else:
    run('outside-nav-overlap-recurses',[layer['minimum'][0]-200,0,layer['minimum'][2]-200],offset=10)
    run('outside-nav-coincident-recurses',[layer['minimum'][0]-200,0,layer['minimum'][2]-200])
by_name={r['name']:r for r in rows}
for name in ['overlap-real-nav','coincident-real-nav','network-pose-overlap']:
    r=by_name[name]
    assert r['obb_calls']==1 and r['nav_queries']>0 and r['trials'][0]['accepted'],name
    assert r['output_position'][0]==f32(clear[0]+60),name
assert by_name['negative-overlap-real-nav']['output_position'][0]==f32(clear[0]-60)
assert by_name['negative-overlap-real-nav']['obb_calls']==1 and by_name['negative-overlap-real-nav']['trials'][0]['accepted']
assert by_name['coincident-small-random-remains-overlap']['output_position']==[f32(v) for v in clear]
assert by_name['coincident-small-random-remains-overlap']['random_calls']==1
assert by_name['nonoverlap-real-nav']['obb_calls']==1 and not by_name['nonoverlap-real-nav']['set_positions']
assert by_name['same-id-skipped']['obb_calls']==0
assert by_name['status3-skipped']['obb_calls']==0
assert by_name['depth51-stops']['obb_calls']==0
assert by_name['depth50-enters']['obb_calls']==1
assert by_name['network-pose-overlap']['entries'][0]['caller']=='0x428342'
for r in rows:
    if 'recurses' in r['name']:
        assert [e['depth'] for e in r['entries']]==list(range(52)),r['name']
        assert len(r['trials'])==51 and all(not t['accepted'] for t in r['trials']),r['name']
        assert r['output_position']==[f32(v) for v in r['other_position']],r['name']
result=dict(status='PASS',entry='0x426b92',nav=str(path.relative_to(ROOT)),nav_cells='unaltered original source bytes',rows=rows,
 supplied=['role/record/definition fixtures and controller single-node tree','scene NAV pointer','KERNEL32 GetTickCount endpoint returns supplied integer','58139a CRT thread-state pointer'],
 native_scope=['complete426b92','original role getters,433112 setter,433073 matrix,4229cd wrapper',
 'original engine OBB/rotation and bundled msvcr71 imports','original434cee command0 and NAV cell queries',
 'original410069 with EXE srand/rand arithmetic','complete42823e network pose state0 branch'],
 limitations=['clock value and CRT thread storage supplied; no original OS timing/TLS','actor pointer absent, so visual actor callback not executed',
 'synthetic single other-role controller tree and role inputs; NAV loader not executed','initial428167 branchcaller not executed'])
output=ROOT/'recovery/output'
(output/'movement-separation-native.json').write_text(json.dumps(result,indent=2)+'\n')
(output/'movement-separation-native.log').write_text('\n'.join(f"PASS {r['name']}: position={r['output_position']} entries={len(r['entries'])} NAV queries={r['nav_queries']}" for r in rows)+'\n')
