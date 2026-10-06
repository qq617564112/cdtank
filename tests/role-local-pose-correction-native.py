"""Execute the original local pose correction caller and its native callees."""
from pathlib import Path
import json
import math
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP,
    UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from nav import read_nav

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe',
    ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
uc.mem_map(0, 0x10000)
uc.mem_map(0x2000000, 0x1000000)
ROLE, RECORD, DEFINITION, ACTOR, OWNER, MESSAGE, MANAGER, SCENE, SCENE_DATA = [
    0x2001000 + i * 0x1000 for i in range(9)]
OTHER, OTHER_RECORD, OTHER_DEFINITION, HEAD, NODE, NAV, CELLS = [
    0x2010000 + i * 0x1000 for i in range(7)]
STACK, STOP, TICK = 0x2f00000, 0x2f10000, 0x2f20000

def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def floats(address, values=None, count=3):
    if values is not None:
        uc.mem_write(address, struct.pack('<' + 'f' * len(values), *values))
    return list(struct.unpack('<' + 'f' * count, uc.mem_read(address, 4 * count)))

def word(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def finish(value=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, word(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4)

events = []
def observe(machine, address, size, data):
    if address in (0x40bd28, 0x40bc38):
        finish()
    elif address == TICK:
        finish(12500)
    elif address in (0x422adf, 0x43314a, 0x433250, 0x4229cd, 0x464513,
                     0x426b92, 0x433112, 0x422f0d, 0x42821d, 0x428229):
        row = {'entry': hex(address), 'rolePosition': floats(ROLE + 0x25c)}
        stack = uc.reg_read(UC_X86_REG_ESP)
        if address == 0x433250:
            row.update(selector=word(stack + 4), value=word(stack + 8))
        if address == 0x426b92:
            row.update(caller=hex(word(stack)), depth=word(stack + 12))
        if address in (0x42821d, 0x428229):
            row['cachedBytes'] = bytes(uc.mem_read(ROLE + 0x234, 36)).hex()
        events.append(row)

for address in (0x40bd28, 0x40bc38, TICK, 0x422adf, 0x43314a, 0x433250, 0x4229cd,
                0x464513, 0x426b92, 0x433112, 0x422f0d, 0x42821d, 0x428229):
    uc.hook_add(UC_HOOK_CODE, observe, begin=address, end=address)
put(0x5c0828, TICK)
put(0x633588, MANAGER)
put(0x635830, SCENE)

# Reuse the previously accepted original NAV location; no old native suite runs.
separation = json.loads((ROOT / 'recovery/output/movement-separation-native.json').read_text())
original = next(row for row in separation['rows'] if row['name'] == 'overlap-real-nav')
source_nav = ROOT / separation['nav']
nav = read_nav(source_nav)
layer = nav['layers'][0]
raw = source_nav.read_bytes()
cells = raw[nav['gridOffset'] + 160:nav['geometryOffset']]
origin = original['other_position']
uc.mem_write(NAV, struct.pack('<I', 1))
uc.mem_write(NAV + 4, bytes.fromhex(layer['description']) + struct.pack('<6f3I',
    *layer['minimum'], *layer['maximum'], layer['width'], layer['height'], CELLS))
uc.mem_write(CELLS, cells)

def setup_role(role, record, definition, identity, position, actor=0):
    uc.mem_write(role, bytes(0x400))
    uc.mem_write(record, bytes(0x200))
    uc.mem_write(definition, bytes(0x100))
    put(role, 0x5c2c28)
    put(role + 0x2a0, record)
    put(role + 0x2a8, definition)
    put(role + 0x310, actor)
    put(record + 0xc, identity)
    put(record + 0x90, 2)
    floats(record + 0x48, [30, .5])
    put(definition + 0x50, 4)
    floats(role + 0x25c, position)
    floats(role + 0x274, [1, 0, 0])
    floats(role + 0x280, [1, 0, 0])
    # Original433073 will rebuild the local matrix; peer matrix is supplied.
    floats(role + 0x2b8, [0,0,-1,0, 0,1,0,0, 1,0,0,0,
        *position,1, 49,24,52])

rows = []
cases = [
    ('missing-local-role', False, 0, 0, 2, False),
    ('unsupported-state2', True, 2, 3, 2, False),
    ('unsupported-state3', True, 3, 3, 2, False),
    ('state0-stop', True, 0, 0, 2, False),
    ('state1-moving', True, 1, 3, 2, False),
    ('state1-record3-immediate', True, 1, 3, 3, False),
    ('state0-overlap-cache-keeps-received-position', True, 0, 0, 2, True),
]
for name, present, state, command, record_state, overlap in cases:
    events.clear()
    uc.mem_write(OWNER, bytes(0x400))
    uc.mem_write(ACTOR, bytes(0x400))
    put(ACTOR, 0x5c88c8)
    put(OWNER, 0x5c3a18)
    put(OWNER + 0x3c, ROLE if present else 0)
    uc.mem_write(OWNER + 0x30, struct.pack('<d', 10))
    put(HEAD, HEAD, HEAD, HEAD)
    uc.mem_write(HEAD + 0x15, b'\1')
    put(OWNER + 0x10, HEAD)
    put(SCENE + 0x60, SCENE_DATA if overlap else 0)
    put(SCENE_DATA + 4, NAV)
    received = [origin[0] + 10, 0, origin[2]] if overlap else [12.25, 0, -9.75]
    before_position = [3, 7, 4]
    setup_role(ROLE, RECORD, DEFINITION, 73, before_position, ACTOR)
    put(RECORD + 0x90, record_state)
    uc.mem_write(ROLE + 0x234, bytes([0xa5]) * 36)
    if overlap:
        setup_role(OTHER, OTHER_RECORD, OTHER_DEFINITION, 74, origin)
        put(HEAD, NODE, NODE, NODE)
        put(NODE, HEAD, HEAD, HEAD, 74, OTHER)
        uc.mem_write(NODE + 0x15, b'\0')
    body = struct.pack('<II2fII3f', command, state, received[0], received[2],
                       180, 0, 1234.5, 77.25, .875)
    uc.mem_write(MESSAGE, body)
    before = bytes(uc.mem_read(ROLE, 0x400))
    actor_before = bytes(uc.mem_read(ACTOR, 0x400))
    put(STACK, STOP, MESSAGE)
    for register, value in ((UC_X86_REG_ESP, STACK), (UC_X86_REG_ECX, OWNER),
            (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)):
        uc.reg_write(register, value)
    try:
        uc.emu_start(0x428167, STOP, count=1000000)
    except Exception:
        print('NATIVE_FIXTURE_FAILURE', name, hex(uc.reg_read(UC_X86_REG_EIP)), events[-4:])
        raise
    assert uc.reg_read(UC_X86_REG_EIP) == STOP, name
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8, name
    accepted = present and state in (0, 1)
    assert uc.reg_read(UC_X86_REG_EAX) == int(accepted), name
    assert bytes(uc.mem_read(MESSAGE, 36)) == body, name
    if not accepted:
        assert bytes(uc.mem_read(ROLE, 0x400)) == before, name
        assert bytes(uc.mem_read(ACTOR, 0x400)) == actor_before, name
        assert not events, name
    else:
        expected = [origin[0] + 60, 0, origin[2]] if overlap else received
        actual = floats(ROLE + 0x25c)
        assert all(abs(a - b) < .00015 for a, b in zip(actual, expected)), (name, actual, expected)
        assert floats(ACTOR + 0x28) == actual, name
        assert floats(ACTOR + 0x1bc) == actual, name
        assert word(ROLE + 0x258) == command, name
        assert uc.mem_read(ACTOR + 0x23c, 1) == bytes([command != 0]), name
        assert floats(ROLE + 0x268) == (received if overlap else before_position), name
        cache = body[:24] + struct.pack('<f', 2.5) + body[28:]
        assert bytes(uc.mem_read(ROLE + 0x234, 36)) == cache, name
        separation_calls = [event for event in events if event['entry'] == '0x426b92']
        assert separation_calls[0]['caller'] == '0x42821d', name
        assert separation_calls[0]['depth'] == 0, name
        # Cache assignment happens after the native separation, not before it.
        assert next(event for event in events if event['entry'] == '0x42821d')['cachedBytes'] == (bytes([0xa5]) * 36).hex(), name
        assert next(event for event in events if event['entry'] == '0x428229')['cachedBytes'] == body.hex(), name
    rows.append({'name': name, 'accepted': accepted, 'input': {'messageState': state,
        'command': command, 'recordState': record_state, 'receivedPosition': received,
        'receivedTimeSeconds': 1234.5, 'receivedMove': 77.25, 'receivedTurn': .875},
        'rolePosition': floats(ROLE + 0x25c), 'previousPosition': floats(ROLE + 0x268),
        'look': floats(ROLE + 0x274), 'forward': floats(ROLE + 0x280),
        'cache': bytes(uc.mem_read(ROLE + 0x234, 36)).hex(),
        'actorPosition': floats(ACTOR + 0x28), 'events': list(events)})

result = {'status': 'PASS_LOCAL_POSE_CORRECTION_NATIVE', 'entry': '0x428167',
    'rows': rows, 'nav': str(source_nav.relative_to(ROOT)),
    'nativeScope': ['complete428167 caller', 'native role command/position/direction setters and matrix',
        'native4229cd/464513 immediate actor pose', 'native426b92 with real NAV and one peer OBB',
        'native422f0d/40607b relative seconds'],
    'supplied': ['role/record/definition/actor memory and vtables',
        'controller single-node tree and scene NAV pointer', 'log sink',
        'timeGetTime12500 and controller epoch10seconds'],
    'limitations': ['No socket/dispatcher/OS timing initialization or live player run',
        'No arbitrary multi-peer tree production/order or other pose states',
        'No original ground/slope producer or full entry lifecycle acceptance']}
(ROOT / 'recovery/output/role-local-pose-correction-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'], len(rows))
