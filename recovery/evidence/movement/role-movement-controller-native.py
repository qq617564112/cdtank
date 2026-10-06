"""Execute the original controller movement gate with real gbengine OBB tests."""
from pathlib import Path
import json
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
CTRL, ROLE, OTHER, RECORD, OTHER_RECORD = 0x2001000, 0x2002000, 0x2003000, 0x2004000, 0x2005000
HEAD, NODE, MANAGER, MAP, NAV = 0x2006000, 0x2006100, 0x2007000, 0x2008000, 0x2009000
SCENE, SCENE_DATA, ITEMS, OBJECTS = 0x200a000, 0x200b000, 0x200c000, 0x200d000
STACK, STOP, COPY = 0x2020000, 0x2021000, 0x2022000
VIRTUAL = 0x2023000

def word(address, value):
    uc.mem_write(address, struct.pack('<I', value))

def words(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def obb(address, x=0, z=0, yaw=0):
    import math
    c, s = math.cos(yaw), math.sin(yaw)
    matrix = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x, 0, z, 1]
    uc.mem_write(address, struct.pack('<19f', *matrix, 49, 24, 52))

def returned(value=None, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    ret = struct.unpack('<I', uc.mem_read(stack, 4))[0]
    if value is not None:
        uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
    uc.reg_write(UC_X86_REG_EIP, ret)

engine = images['gbengine.dll']
memcpy = [s for entry in engine.DIRECTORY_ENTRY_IMPORT for s in entry.imports
          if s.address == 0x1003f2d0]
assert len(memcpy) == 1 and memcpy[0].name == b'memcpy'
word(0x1003f2d0, COPY)
# Bind the engine CRT fabs import to the original executable's native CRT fabs.
fabs = [s for entry in engine.DIRECTORY_ENTRY_IMPORT for s in entry.imports
        if s.address == 0x1003f298]
assert len(fabs) == 1 and fabs[0].name == b'fabs'
word(0x1003f298, 0x57d261)
obb_entry = struct.unpack('<I', uc.mem_read(0x5c0ba8, 4))[0]
assert obb_entry == 0x10032ce0
assert struct.unpack('<I', uc.mem_read(0x5c3a18 + 0x40, 4))[0] == 0x4272d7
assert bytes(uc.mem_read(0x4275ba, 4)) == b'\x33\xc0\xeb\xf2'
state = {}

def hook(machine, address, size, data):
    if address == COPY:
        stack = uc.reg_read(UC_X86_REG_ESP)
        _, dest, source, count = struct.unpack('<4I', uc.mem_read(stack, 16))
        uc.mem_write(dest, bytes(uc.mem_read(source, count)))
        state['memcpy'].append(count)
        returned(dest)
    elif address == VIRTUAL:
        # Supplied prediction service is a rigid translation of the source OBB.
        # This checks the controller's +70 dispatch, not the original predictor.
        stack = uc.reg_read(UC_X86_REG_ESP)
        _, dest, command, nav, dt = struct.unpack('<4If', uc.mem_read(stack, 20))
        role = uc.reg_read(UC_X86_REG_ECX)
        uc.mem_write(dest, bytes(uc.mem_read(role + 0x2b8, 76)))
        matrix_x = struct.unpack('<f', uc.mem_read(dest + 0x30, 4))[0]
        uc.mem_write(dest + 0x30, struct.pack('<f', matrix_x + state['shift'].get(role, 0)))
        state['predictions'].append(dict(role=role, command=command, navigation=nav, dt=dt))
        returned(dest, 16)
    elif address == 0x44e081:
        stack = uc.reg_read(UC_X86_REG_ESP)
        notification = struct.unpack('<I', uc.mem_read(stack + 4, 4))[0]
        state['notifications'].append(dict(object=uc.reg_read(UC_X86_REG_ECX), type=notification))
        returned(pop=4)
    elif address == 0x40bd28:
        state['diagnostics'] += 1
        returned(0)
    elif address == obb_entry:
        stack = uc.reg_read(UC_X86_REG_ESP)
        other = struct.unpack('<I', uc.mem_read(stack + 4, 4))[0]
        state['obb_calls'].append(dict(this=uc.reg_read(UC_X86_REG_ECX), other=other,
                                      return_address=struct.unpack('<I', uc.mem_read(stack, 4))[0]))
    elif address == 0x4275ba:
        state['reject_tail'] += 1
    elif address == 0x42de86:
        state['tree_advances'] += 1

uc.hook_add(UC_HOOK_CODE, hook)
rows = []

def run(name, *, candidate=True, same_id=False, status=2, x=0, z=0,
        map_present=False, shift=0, static_count=0, static_x=0, expected=1,
        obb_count=None, notifications=0, diagnostics=0, yaw=0):
    global state
    uc.mem_write(0x2000000, bytes(0x18000))
    word(CTRL, 0x5c3a18)
    word(CTRL + 0x10, HEAD)
    words(HEAD, NODE if candidate else HEAD, NODE if candidate else HEAD, NODE if candidate else HEAD)
    uc.mem_write(HEAD + 0x15, b'\x01')
    words(NODE, HEAD, HEAD, HEAD, 2, OTHER)
    for role, record, ident in [(ROLE, RECORD, 1), (OTHER, OTHER_RECORD, 1 if same_id else 2)]:
        word(role, VIRTUAL if map_present else 0x5c41b8)
        word(role + 0x2a0, record)
        word(record + 0xc, ident)
        word(record + 0x90, 2 if role == ROLE else status)
        word(role + 0x258, 4)
        px, pz = (x, z) if role == OTHER else (0, 0)
        uc.mem_write(role + 0x25c, struct.pack('<3f', px, 0, pz))
        obb(role + 0x2b8, px, pz, yaw if role == OTHER else 0)
    if map_present:
        uc.mem_write(VIRTUAL, bytes(uc.mem_read(0x5c41b8, 0x80)))
        word(VIRTUAL + 0x70, VIRTUAL)
    word(0x633588, MANAGER)
    word(MANAGER + 0x124, MAP)
    word(MAP + 0x60, NAV if map_present else 0)
    word(NAV + 4, 0x1234)
    word(0x635830, SCENE)
    word(SCENE + 0x60, SCENE_DATA)
    words(SCENE_DATA + 0x1e8, 0, ITEMS if static_count else 0, ITEMS + 8 * static_count)
    for index in range(static_count):
        obj = OBJECTS + index * 0x100
        words(ITEMS + index * 8, obj, 0)
        obb(obj + 0x80, static_x)
    state = dict(memcpy=[], predictions=[], notifications=[], diagnostics=0,
                 obb_calls=[], reject_tail=0, tree_advances=0, shift={ROLE: shift})
    words(STACK, STOP, ROLE, 3, 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, CTRL)
    uc.reg_write(UC_X86_REG_FPCW, 0x027f)
    uc.emu_start(0x4272d7, STOP, count=200000)
    result = uc.reg_read(UC_X86_REG_EAX)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP, name
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 16, name
    assert result == expected, (name, result, expected)
    if obb_count is not None:
        assert len(state['obb_calls']) == obb_count, (name, state)
    assert len(state['notifications']) == notifications, name
    assert all(n['type'] == 100 for n in state['notifications']), name
    assert state['diagnostics'] == diagnostics, name
    if map_present:
        assert [item['role'] for item in state['predictions']] == [ROLE, OTHER], name
        assert [item['command'] for item in state['predictions']] == [3, 4], name
        assert all(item['navigation'] == 0x1234 and abs(item['dt'] - 0.3) < 1e-7
                   for item in state['predictions']), name
    else:
        assert state['predictions'] == [], name
    assert state['reject_tail'] == int(not expected), name
    rows.append(dict(name=name, result=result, map_present=map_present, status=status,
                     same_id=same_id, position=[x,z], static_count=static_count,
                     candidate=candidate, shift=shift, static_x=static_x, yaw=yaw,
                     **{k:v for k,v in state.items() if k != 'shift'}))

run('empty-role-tree', candidate=False, obb_count=0)
run('same-id-overlap-skipped', same_id=True, obb_count=0)
run('status3-overlap-skipped', status=3, obb_count=0)
run('x201-filtered', x=201, obb_count=0)
run('x-minus201-filtered', x=-201, obb_count=0)
run('z201-filtered', z=201, obb_count=0)
run('z-minus201-filtered', z=-201, obb_count=0)
run('x200-tested-separated', x=200, obb_count=1)
run('z200-tested-separated', z=200, obb_count=1)
run('coincident-role-rejected', expected=0, obb_count=1)
run('near-role-rejected', x=10, z=10, expected=0, obb_count=1)
run('rotated-role-rejected', x=10, z=10, yaw=0.7, expected=0, obb_count=1)
run('nearby-separated-role-accepted', x=120, obb_count=1)
run('map-prediction-dispatch-overlap', x=120, map_present=True, shift=120,
    expected=0, obb_count=1)
run('map-prediction-dispatch-separated', map_present=True, shift=120, obb_count=1)
run('one-static-overlap-notification-accepted', candidate=False, static_count=1,
    obb_count=1, notifications=1)
run('one-static-separated-accepted', candidate=False, static_count=1, static_x=120,
    obb_count=1)
run('eight-static-overlaps-no-diagnostic', candidate=False, static_count=8,
    obb_count=8, notifications=8)
run('nine-static-overlaps-diagnostic-still-accepted', candidate=False, static_count=9,
    obb_count=9, notifications=9, diagnostics=1)

result = dict(status='PASS', entry='0x4272d7', controller_vtable='0x5c3a18', slot='0x40',
              actual_engine_obb='0x10032ce0', rows=rows,
              supplied=['RB-tree nodes, role records, source OBB matrices and scene container',
                        'CRT memcpy with byte-copy semantics',
                        'map-present virtual+70 predictor: supplied rigid OBB translation',
                        'static notification44e081 and diagnostic40bd28 sinks'],
              native_scope=['complete controller4272d7 including reject tail4275ba',
                            'role getters431d4d/4321e3/43293d/432107',
                            'RB-tree successor42de86 and static size417b49/getOBB44dbc4',
                            'original gbengine matrix constructors/copies and IsColOBB',
                            'engine CRT fabs import bound to native EXE CRT57d261'],
              limitations=['Original433d1c prediction and435088 map integration are not executed',
                           'Notification effects after44e081 and diagnostic logger40bd28 are not executed',
                           'Runtime creation/population of controllers, RB-tree, scene and matrices is supplied',
                           'No production browser collision controller wiring is established by this evidence'])
output = ROOT / 'recovery/output'
(output / 'movement-controller-native.json').write_text(json.dumps(result, indent=2) + '\n')
lines = [f"PASS {row['name']}: result={row['result']} OBB={len(row['obb_calls'])} "
         f"notifications={len(row['notifications'])} diagnostics={row['diagnostics']}"
         for row in rows]
(output / 'movement-controller-native.log').write_text('\n'.join(lines) + '\n')
(output / 'movement-controller-native.md').write_text('''# Native controller movement gate

19 bounded cases pass through complete original `0x4272d7` (controller vtable
`0x5c3a18`, slot `+0x40`) and real gbengine `IsColOBB` at `0x10032ce0`.
Dynamic role overlap returns 0 through `0x4275ba`; empty trees, status 3,
same ID, and absolute X or Z separation above 200 allow movement. Separation
exactly 200 reaches the real OBB test. Both coincident and rotated overlap
reject, while nearby disjoint OBBs allow movement.

The original role getters, matrix OBB copies, RB-tree successor and static
container readers execute. Static overlaps dispatch type 100 to `0x44e081`
and do not reject movement. Eight overlaps cause no diagnostic; nine dispatch
one diagnostic and still return 1. Every case reaches the original return
with correct stack cleanup.

## Limitations

RB-tree nodes, role records, source OBB matrices and scene container are supplied.
CRT memcpy copies the original bytes; engine fabs uses native executable CRT
`0x57d261`. Map-present cases supply virtual `+0x70`
with rigid OBB translation to establish dispatch and its use by the real OBB
test; original `0x433d1c` prediction and `0x435088` map integration are not
executed. Notification `0x44e081` and diagnostic `0x40bd28` are recording sinks;
their downstream effects are outside this evidence. Runtime production of these
objects and browser collision-controller wiring remain unproven.
''')
print('\n'.join(lines))
