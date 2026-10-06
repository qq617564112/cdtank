"""Execute 424be9 with explicit scene-coordinate and observer providers."""
from pathlib import Path
import json
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
OWNER, ROLE, SCENE, QUERY, OBSERVER, ROLE_TABLE, QUERY_TABLE, OBSERVER_TABLE, STACK, STOP = [
    0x2000000 + n * 0x1000 for n in range(10)]
GET_ANGLE, MAP_POSITION, OBSERVE = STOP + 0x10, STOP + 0x20, STOP + 0x30

def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def word(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def finish(pop=0, value=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, word(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

calls = []
angle = 0
coordinate = [0, 0]
def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == MAP_POSITION:
        assert machine.reg_read(UC_X86_REG_ECX) == QUERY
        position = list(struct.unpack('<3f', machine.mem_read(word(stack + 4), 12)))
        calls.append(dict(kind='scene-query', position=position))
        put(word(stack + 8), *coordinate)
        finish(8)
    elif address == GET_ANGLE:
        assert machine.reg_read(UC_X86_REG_ECX) == ROLE and word(stack + 4) == 18
        calls.append(dict(kind='role-angle', selector=18))
        finish(4, angle)
    elif address == OBSERVE:
        assert machine.reg_read(UC_X86_REG_ECX) == OBSERVER and word(stack + 4) == ROLE
        result = list(struct.unpack('<2i', machine.mem_read(word(stack + 8), 8)))
        radians = struct.unpack('<f', machine.mem_read(stack + 12, 4))[0]
        calls.append(dict(kind='position-observer', coordinates=result, radians=radians))
        finish(12)
for endpoint in (MAP_POSITION, GET_ANGLE, OBSERVE):
    uc.hook_add(UC_HOOK_CODE, hook, begin=endpoint, end=endpoint)
put(ROLE, ROLE_TABLE)
put(ROLE_TABLE + 0x14, GET_ANGLE)
uc.mem_write(ROLE + 0x25c, struct.pack('<3f', 12.25, 7, -9.75))
put(QUERY, QUERY_TABLE)
put(QUERY_TABLE + 0x18, MAP_POSITION)
put(OBSERVER, OBSERVER_TABLE)
put(OBSERVER_TABLE + 8, OBSERVE)
put(0x635830, SCENE)
rows = []
for name, observer_present, role_present, query_present, angle, coordinate in [
    ('missing-observer', False, True, True, 180, [7, -3]),
    ('missing-role', True, False, True, 180, [7, -3]),
    ('missing-scene-query', True, True, False, 180, [7, -3]),
    ('half-degree180', True, True, True, 180, [7, -3]),
    ('signed-half-degree-minus90', True, True, True, -90, [-20, 14]),
]:
    calls.clear()
    put(OWNER + 0xc4, OBSERVER if observer_present else 0)
    put(SCENE + 0x60, QUERY if query_present else 0)
    put(STACK, STOP, ROLE if role_present else 0)
    uc.reg_write(UC_X86_REG_ECX, OWNER)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x424be9, STOP, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    if name.startswith('missing'):
        assert not calls
    else:
        assert [c['kind'] for c in calls] == ['scene-query', 'role-angle', 'position-observer']
        assert calls[0]['position'] == [12.25, 7, -9.75]
        assert calls[-1]['coordinates'] == coordinate
        scale = struct.unpack('<f', uc.mem_read(0x5c2864, 4))[0]
        expected = struct.unpack('<f', struct.pack('<f', angle * scale))[0]
        assert calls[-1]['radians'] == expected
    rows.append(dict(name=name, angle=angle, coordinates=coordinate, calls=list(calls)))
output = dict(status='PASS_SCENE_POSITION_OBSERVER_ARGUMENT_CONTRACT', entry='0x424be9', rows=rows,
    nativeScope=['424be9 gates/order/signed32 x87 multiply and float32 observer argument',
                 '431fff original full position copy'],
    supplied=['scene virtual18 coordinate-query output', 'role virtual14 selector18 angle',
              'owner+c4 virtual8 observer sink'],
    callers=['428348 state0 at428463', '4259ae status2', '4277f8 registration replay'],
    observerRegistration='4d4455 ->4277f8 installs closure4ce4c7/4cdfbe ->4cd990 ->4cc791 ->471684',
    limitations=['scene coordinate-query algorithm not executed',
                 '471684 display-rectangle consumer not executed',
                 'no World/Web/socket or ordinary player acceptance'])
path = ROOT / 'recovery/output/role-scene-position-observer-native.json'
path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(output['status'], len(rows))
