"""Execute original4344e7 command movement with original vector mathematics."""
from pathlib import Path
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
STACK, STOP, POS, LOOK, FORWARD, CENTER, OUT = [0x2001000+i*0x1000 for i in range(7)]
def vec(a, value=None):
    if value is not None: uc.mem_write(a, struct.pack('<3f', *value))
    return list(struct.unpack('<3f', uc.mem_read(a, 12)))
def f32(value): return struct.unpack('<f', struct.pack('<f', value))[0]
def direction(angle): return [math.cos(angle), 0, math.sin(angle)]
def assert_vector(actual, expected, label, tolerance=0.00002):
    for index, (found, wanted) in enumerate(zip(actual, expected)):
        assert abs(found - wanted) <= tolerance, (label, index, found, wanted)

# Observe actual mathematical entries; no instructions or services are substituted.
entries = {address: 0 for address in [0x434032, 0x4340fd, 0x434241, 0x57454b,
    0x424043, 0x431ba8, 0x57b784, 0x41d98e]}
def observe(machine, address, size, data): entries[address] += 1
for address in entries: uc.hook_add(UC_HOOK_CODE, observe, begin=address, end=address)
rows = []
for command in range(9):
    for tank_type in range(1, 5):
        for aligned in [True, False]:
            for delta in [.05, .2]:
                vec(POS, [10, 0, 20]); vec(LOOK, [1, 0, 0])
                vec(FORWARD, [1, 0, 0] if aligned else [0, 0, 1])
                uc.mem_write(STACK, struct.pack('<7I', STOP, OUT, POS, LOOK, FORWARD, command, tank_type)
                    + struct.pack('<3fI', 30, .5, delta, 0))
                for register, value in [(UC_X86_REG_ESP, STACK), (UC_X86_REG_FPCW, 0x27f),
                    (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]: uc.reg_write(register, value)
                try: uc.emu_start(0x4344e7, STOP, count=100000)
                except Exception:
                    print('BLOCKED', command, tank_type, aligned, delta, hex(uc.reg_read(UC_X86_REG_EIP)))
                    raise
                assert uc.reg_read(UC_X86_REG_EIP) == STOP
                assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4
                elapsed = f32(delta)
                distance = f32(30 * elapsed)
                turn_angle = f32(.5 * elapsed)
                radius = f32(max(30 / .5, 80))
                arc_angle = f32(distance / radius)
                expected_position = [10, 0, 20]
                expected_look = [1, 0, 0]
                expected_forward = [1, 0, 0] if aligned else [0, 0, 1]
                if command in [1, 2]:
                    expected_position[0] += distance if command == 1 else -distance
                    if not aligned: expected_forward = direction(math.pi / 2 - turn_angle)
                elif command in [3, 4]:
                    expected_look = direction(-turn_angle if command == 3 else turn_angle)
                    if not aligned and command == 3:
                        expected_forward = direction(math.pi / 2 - turn_angle)
                elif command in [5, 6, 7, 8]:
                    forward_sign = 1 if command in [5, 6] else -1
                    center_sign = 1 if command in [5, 7] else -1
                    look_sign = 1 if command in [5, 8] else -1
                    expected_position = [10 + forward_sign * radius * math.sin(arc_angle), 0,
                        20 + center_sign * radius * (1 - math.cos(arc_angle))]
                    expected_look = direction(look_sign * arc_angle)
                    if aligned: expected_forward = direction(look_sign * 2 * turn_angle)
                    elif command in [6, 7]:
                        expected_forward = direction(math.pi / 2 - 2 * turn_angle)
                if tank_type == 4 and command != 0: expected_forward = expected_look
                context = (command, tank_type, aligned, delta)
                assert_vector(vec(POS), expected_position, ('position', context))
                assert_vector(vec(LOOK), expected_look, ('look', context), 0.000001)
                assert_vector(vec(FORWARD), expected_forward, ('forward', context), 0.000001)
                rows.append(dict(command=command, tankType=tank_type, aligned=aligned, delta=delta,
                    velocity=30, turnVelocity=.5, radius=radius,
                    position=vec(POS), look=vec(LOOK), forward=vec(FORWARD),
                    expected=dict(position=expected_position, look=expected_look, forward=expected_forward)))
assert len(rows) == 144
assert all(count > 0 for count in entries.values())
result = dict(status='PASS', entry='0x4344e7', rows=rows,
    executedEntries={hex(address): count for address, count in entries.items()},
    scope='Complete commands0..8, TankType1..4, aligned/perpendicular look-forward, delta0.05/0.2. '
        'Original clamp, normalization, acos and axis rotation execute without service hooks. '
        'Collision wrapper435088/434cee, upstream clock and control gates are not executed.')
(ROOT / 'recovery/output/movement-commands-native.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: 144 complete original movement commands; analytic position/look/forward and stack assertions')
print('PASS: original rotation, normalization, acos and clamp executed without supplied services')
