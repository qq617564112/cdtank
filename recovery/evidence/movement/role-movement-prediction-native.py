"""Execute original role OBB prediction and controller dispatch with native math."""
from pathlib import Path
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x100000)
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


state = {}
math_targets = {}
for dll in ['gbengine.dll']:
    for entry in images[dll].DIRECTORY_ENTRY_IMPORT:
        for symbol in entry.imports:
            if symbol.name in [b'cos',b'sin',b'fabs',b'memcpy']:
                math_targets[symbol.name.decode()] = u32(symbol.address)
assert all(value >= images['msvcr71.dll'].OPTIONAL_HEADER.ImageBase for value in math_targets.values())
assert u32(0x5c2c28 + 0x70) == 0x433d1c
assert u32(0x5c0b98) == 0x10030220 and u32(0x5c0ba8) == 0x10032ce0


def observe(machine, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x433d1c:
        state['predictions'].append(dict(role=uc.reg_read(UC_X86_REG_ECX), output=u32(stack+4),
            command=u32(stack+8), map=u32(stack+12), dt=floats(stack+16,1)[0]))
    elif address == 0x435088:
        state['wrappers'].append(dict(position=u32(stack+4), look=u32(stack+8), forward=u32(stack+12),
            command=u32(stack+16), tank_type=u32(stack+20), velocity=floats(stack+24,1)[0],
            turn_velocity=floats(stack+28,1)[0], dt=floats(stack+32,1)[0],
            source_matrix=u32(stack+36), center=u32(stack+40), map=u32(stack+44)))
    elif address == 0x434cee:
        state['trials'].append(dict(command=u32(stack+12), tank_type=u32(stack+52),
            dt=floats(stack+0x8c,1)[0], map=u32(stack+8)))
    elif address == 0x435106:
        state['trials'][-1]['accepted'] = bool(uc.reg_read(UC_X86_REG_EAX)&255)
    elif address == 0x4344e7:
        state['integrators'].append(dict(command=u32(stack+20),tank_type=u32(stack+24),
            velocity=floats(stack+28,1)[0],turn_velocity=floats(stack+32,1)[0],
            dt=floats(stack+36,1)[0],center=u32(stack+40)))
    elif address == 0x433073:
        state['matrices'].append(dict(output=u32(stack+4), position=floats(u32(stack+8),3),
                                     forward=floats(u32(stack+12),3)))
    elif address == 0x10030220:
        state['rotations'].append(dict(matrix=uc.reg_read(UC_X86_REG_ECX),axis=u32(stack+4),
                                      degrees=floats(stack+8,1)[0]))
    elif address == 0x10032ce0:
        state['obb'].append(dict(left=floats(uc.reg_read(UC_X86_REG_ECX),19),
                                right=floats(u32(stack+4),19)))
    elif address == 0x45758f:
        state['cell_queries'] += 1
    elif address in math_targets.values():
        for name,target in math_targets.items():
            if address == target:
                state['crt'][name] = state['crt'].get(name,0)+1
    elif address == 0x4275ba:
        state['reject_tail'] += 1


for address in [0x433d1c,0x435088,0x434cee,0x435106,0x433073,0x4344e7,0x10030220,0x10032ce0,0x45758f,0x4275ba,*math_targets.values()]:
    uc.hook_add(UC_HOOK_CODE, observe, begin=address, end=address)


def reset_observation():
    global state
    state = dict(predictions=[],wrappers=[],trials=[],integrators=[],matrices=[],rotations=[],obb=[],
                 cell_queries=0,crt={},reject_tail=0)
    for reg,value in [(UC_X86_REG_FPCW,0x27f),(UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]:
        uc.reg_write(reg,value)


rows = []


def prediction(name, command, dt, *, tank_type=4, definition_present=True,
               velocity=30, turn_velocity=.5, blocked=False, record_present=True):
    setup_role(ROLE,RECORD,DEFINITION, command=command, velocity=velocity,
               turn_velocity=turn_velocity,tank_type=tank_type,definition_present=definition_present)
    if not record_present:
        put(ROLE+0x2a0,0)
    setup_nav(blocked)
    before = bytes(uc.mem_read(ROLE,0x400))
    source = floats(ROLE+0x2b8,19)
    uc.mem_write(OUT, bytes([0x55])*76)
    reset_observation()
    put(STACK, STOP, OUT, command, NAV)
    put_floats(STACK+16,dt)
    uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.reg_write(UC_X86_REG_ECX,ROLE)
    uc.emu_start(0x433d1c,STOP,count=1000000)
    assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+20,name
    assert bytes(uc.mem_read(ROLE,0x400))==before,name
    output = floats(OUT,19)
    assert output[16:]==source[16:],name
    active = f32(dt)>=f32(.001)
    if not active:
        assert output==source,name
        assert not state['wrappers'] and not state['rotations'],name
    else:
        assert len(state['wrappers'])==1 and len(state['matrices'])==1 and len(state['integrators'])==1,name
        assert state['integrators'][0]['dt']==min(f32(dt),f32(.2)),name
        wrapper = state['wrappers'][0]
        assert wrapper['command']==command and wrapper['map']==0,name
        assert wrapper['tank_type']==(tank_type if definition_present else 1),name
        assert wrapper['velocity']==f32(velocity) and wrapper['turn_velocity']==f32(turn_velocity),name
        assert wrapper['source_matrix']==ROLE+0x2b8 and wrapper['center']==ROLE+0x28c,name
        assert all(wrapper[key] < STACK and wrapper[key] > STACK-0x100 for key in ['position','look','forward']),name
        assert all(trial['dt']==min(f32(dt),f32(.2)) for trial in state['trials']),name
        assert state['cell_queries']==0 and all(trial['map']==0 for trial in state['trials']),name
        matrix = state['matrices'][0]
        close(output[12:15],matrix['position'],name)
        assert len(state['rotations'])==1 and state['rotations'][0]['matrix']==OUT,name
        assert state['crt'].get('cos',0)==1 and state['crt'].get('sin',0)==1,name
        clipped=min(f32(dt),f32(.2))
        if command in [1,2]:
            close(output[12:15],[200+(1 if command==1 else -1)*f32(velocity*clipped),0,200],name)
        elif command in [0,3,4]:
            close(output[12:15],[200,0,200],name)
        if command in [3,4] and tank_type==4 and definition_present:
            angle=f32(turn_velocity*clipped)*(-1 if command==3 else 1)
            close(matrix['forward'],[math.cos(angle),0,math.sin(angle)],name)
        yaw=math.atan2(matrix['forward'][0],matrix['forward'][2])
        c,s=math.cos(yaw),math.sin(yaw)
        close(output[:12],[c,0,-s,0,0,1,0,0,s,0,c,0],name)
    rows.append(dict(name=name,entry='0x433d1c',command=command,dt=dt,tank_type=tank_type,
                     definition_present=definition_present,record_present=record_present,
                     blocked=blocked,source_unchanged=True,source_obb=source,output_obb=output,**state))


prediction('negative-dt-copy-only',1,-.05)
prediction('zero-dt-copy-only',1,0)
prediction('below-threshold-copy-only',1,.0005)
prediction('exact-threshold-integrates',1,.001)
prediction('missing-record-below-threshold-copy-only',1,0,record_present=False)
for command in range(9):
    prediction(f'command-{command}-clear',command,.05)
prediction('dt-point2',1,.2)
prediction('dt-point3-clamped',1,.3)
prediction('dt-point8-clamped',1,.8)
prediction('record-speed60-turn075',1,.05,velocity=60,turn_velocity=.75)
prediction('record-turn075',3,.05,velocity=60,turn_velocity=.75)
prediction('definition-type1',3,.05,tank_type=1)
prediction('absent-definition-defaults-type1',3,.05,definition_present=False)
prediction('blocked-nav-ignored-by-forward-prediction',1,.2,blocked=True)
prediction('blocked-nav-ignored-by-combined-prediction',5,.2,blocked=True)


by_name={row['name']:row for row in rows}
assert by_name['dt-point2']['output_obb']==by_name['dt-point3-clamped']['output_obb']==by_name['dt-point8-clamped']['output_obb']
assert by_name['blocked-nav-ignored-by-forward-prediction']['output_obb']==by_name['dt-point2']['output_obb']
assert by_name['blocked-nav-ignored-by-combined-prediction']['output_obb'][12:15] != [200,0,200]

controller_rows = []


def controller(name, *, command=1, other_command=0, x=260, other_speed=0, blocked=False,
               expected=1):
    setup_role(ROLE,RECORD,DEFINITION,command=command)
    setup_role(OTHER,OTHER_RECORD,OTHER_DEFINITION,x=x,command=other_command,velocity=other_speed)
    setup_nav(blocked)
    put(CTRL,0x5c3a18)
    put(CTRL+0x10,HEAD)
    put(HEAD,NODE,NODE,NODE)
    uc.mem_write(HEAD+0x15,b'\x01')
    put(NODE,HEAD,HEAD,HEAD,2,OTHER)
    uc.mem_write(NODE+0x15,b'\x00')
    put(0x633588,MANAGER)
    put(MANAGER+0x124,MAP_MANAGER)
    put(MAP_MANAGER+0x60,NAV_MANAGER)
    put(NAV_MANAGER+4,NAV)
    put(0x635830,SCENE)
    put(SCENE+0x60,SCENE_DATA)
    uc.mem_write(SCENE_DATA+0x1e8,bytes(16))
    snapshots={role:bytes(uc.mem_read(role,0x400)) for role in [ROLE,OTHER]}
    reset_observation()
    put(STACK,STOP,ROLE,command,0)
    uc.reg_write(UC_X86_REG_ESP,STACK)
    uc.reg_write(UC_X86_REG_ECX,CTRL)
    uc.emu_start(0x4272d7,STOP,count=2000000)
    result=uc.reg_read(UC_X86_REG_EAX)
    assert result==expected,(name,result,expected)
    assert uc.reg_read(UC_X86_REG_EIP)==STOP and uc.reg_read(UC_X86_REG_ESP)==STACK+16,name
    assert all(bytes(uc.mem_read(role,0x400))==before for role,before in snapshots.items()),name
    assert [p['role'] for p in state['predictions']]==[ROLE,OTHER],name
    assert [p['command'] for p in state['predictions']]==[command,other_command],name
    assert all(p['dt']==f32(.3) and p['map']==NAV for p in state['predictions']),name
    assert len(state['wrappers'])==2 and len(state['matrices'])==2 and len(state['integrators'])==2,name
    assert all(w['map']==0 for w in state['wrappers']) and state['cell_queries']==0,name
    assert all(t['dt']==f32(.2) for t in state['trials']),name
    assert len(state['obb'])==1 and len(state['rotations'])==2,name
    assert state['reject_tail']==int(not expected),name
    controller_rows.append(dict(name=name,result=result,source_unchanged=True,**state))


controller('controller-forward-predicts-overlap',x=254,expected=0)
controller('controller-forward-still-separated',x=270,expected=1)
controller('controller-backward-predicts-clear',command=2,x=254,expected=1)
controller('controller-two-moving-roles-overlap',x=260,other_command=2,other_speed=30,expected=0)
controller('controller-blocked-map-still-predicts-overlap',x=254,blocked=True,expected=0)

result=dict(status='PASS',role_entry='0x433d1c',role_vtable='0x5c2c28',slot='0x70',
            rows=rows,controller_rows=controller_rows,crt_import_targets=math_targets,
            native_scope=['complete433d1c/435088/434cee/4344e7/433073',
                          'original role/network getters and definition/record field reads',
                          'original434cee no-map branch: predictor supplies NULL map',
                          'gbengine matrix constructor/copy/rotation10030220 and IsColOBB10032ce0',
                          'original bundled msvcr71.dll memcpy/cos/sin/fabs',
                          'complete4272d7 with actual role virtual+70 predictions'],
            supplied=['role objects, role records and definitions',
                      'synthetic100x100 NAV grid with original inline layer layout',
                      'controller RB-tree and empty scene container'],
            limitations=['NAV file loading and upstream map/role object production are outside this evidence',
                         'Source motion inputs and footprint49/24/52 are explicit fixtures',
                         'No browser production wiring is established by this native execution'])
output=ROOT/'recovery/output'
(output/'movement-prediction-native.json').write_text(json.dumps(result,indent=2)+'\n')
lines=[f"PASS {row['name']}: native predictions={len(row['predictions'])} trials={len(row['trials'])} source unchanged" for row in rows]
lines += [f"PASS {row['name']}: result={row['result']} actual predictions={len(row['predictions'])} real OBB={len(row['obb'])}" for row in controller_rows]
(output/'movement-prediction-native.log').write_text('\n'.join(lines)+'\n')
(output/'movement-prediction-native.md').write_text(f'''# Native role OBB prediction

{len(rows)} direct prediction cases and {len(controller_rows)} complete controller cases pass.
Original `0x433d1c` (role vtable `0x5c2c28`, slot `+0x70`) copies the source OBB,
position, look and forward into the output and stack temporaries. Inputs below
0.001 only copy the OBB; exactly 0.001 enters integration. Commands 0–8,
record velocities, definition TankType and absent-definition default 1 execute
through original `0x435088`, `0x434cee`, `0x4344e7` and `0x433073`.

The predictor ignores its map argument and passes NULL to `0x435088`; original
`0x434cee` takes its no-map branch, without querying any NAV cell. A blocked
grid therefore produces the same dynamic prediction as a clear grid.

The wrapper caps prediction delta at 0.2. Direct 0.3 and 0.8 inputs produce the
same straight-motion distance as 0.2. The controller passes fixed 0.3 to both
roles' actual virtual `+0x70`; each native wrapper limits its trials to 0.2.
Controller cases include forward overlap, separated movement, backward
clearance, two moving roles and unchanged prediction with blocked NAV cells. Decisions use actual
gbengine `IsColOBB` at `0x10032ce0`.

Output position and rotation agree with the integrator's temporary vectors;
footprint dimensions are copied. Every source role's position, look, forward,
source matrix, center and complete 0x400-byte role fixture remain unchanged,
including blocked-NAV inputs and combined commands. Original engine matrix rotation executes,
with original bundled `msvcr71.dll` memcpy/cos/sin/fabs. Hooks observe calls and
inputs; they do not supply predictions, math, map queries or OBB decisions.

## Limitations

Role objects, records, definitions, a synthetic 100×100 NAV grid, controller
RB-tree and empty static scene container are supplied. NAV uses the observed
inline 0xa4-byte layer layout. Source velocities and footprint49/24/52 are
fixtures. NAV loading and upstream production of these objects are outside
this evidence. Browser production wiring is not established by native execution.
''')
print('\n'.join(lines))
