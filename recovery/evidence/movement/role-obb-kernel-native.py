"""Execute supplied gbengine IsColOBB instructions and export service fixtures."""
from pathlib import Path
import json
import math
import random
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0x2000000, 0x10000)
LEFT, RIGHT, STACK, STOP = 0x2000000, 0x2001000, 0x2008000, 0x2009000
ENTRY = struct.unpack('<I', uc.mem_read(0x5c0ba8, 4))[0]
assert ENTRY == 0x10032ce0
engine = images['gbengine.dll']
imports = [symbol for entry in engine.DIRECTORY_ENTRY_IMPORT for symbol in entry.imports
           if symbol.address == 0x1003f298]
assert len(imports) == 1 and imports[0].name == b'fabs'
uc.mem_write(0x1003f298, struct.pack('<I', 0x57d261))
# MSVC CRT default: masked exceptions, nearest rounding, 53-bit x87 precision.
uc.reg_write(UC_X86_REG_FPCW, 0x027f)
context = uc.context_save()
trace = {}

def hook(machine, address, size, data):
    if address == 0x10032f70:
        trace['face_reject'] += 1
    elif address == 0x10032f62:
        trace['success_return'] += 1
    elif address == 0x10032f44:
        # The conditional target is the success return, not the face reject.
        trace['cross_comparisons'] += 1
    elif address == 0x10032f46:
        trace['cross_continues'] += 1

uc.hook_add(UC_HOOK_CODE, hook)

def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]

def box(position=(0, 0, 0), angles=(0, 0, 0), dimensions=(49, 24, 52), scales=(1, 1, 1)):
    # Rz * Ry * Rx; row-vector matrix axes stored at offsets 0, 16, 32.
    ax, ay, az = angles
    sx, cx, sy, cy, sz, cz = math.sin(ax), math.cos(ax), math.sin(ay), math.cos(ay), math.sin(az), math.cos(az)
    axes = [(cz*cy, sz*cy, -sy), (cz*sy*sx-sz*cx, sz*sy*sx+cz*cx, cy*sx),
            (cz*sy*cx+sz*sx, sz*sy*cx-cz*sx, cy*cx)]
    matrix = [f32(value * scales[index]) for index, values in enumerate(axes) for value in (*values, 0)]
    matrix += [f32(value) for value in (*position, 1)]
    return dict(matrix=matrix, dimensions=[f32(value) for value in dimensions])

def run(left, right, control=0x027f):
    global trace
    uc.context_restore(context)
    uc.reg_write(UC_X86_REG_FPCW, control)
    for address, item in [(LEFT, left), (RIGHT, right)]:
        uc.mem_write(address, struct.pack('<19f', *item['matrix'], *item['dimensions']))
    uc.mem_write(STACK, struct.pack('<2I', STOP, RIGHT))
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, LEFT)
    trace = dict(face_reject=0, success_return=0, cross_comparisons=0, cross_continues=0)
    uc.emu_start(ENTRY, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    result = uc.reg_read(UC_X86_REG_EAX)
    assert result in (0, 1)
    return bool(result), trace.copy()

rows = []
def add(name, left, right, expected=None):
    result, calls = run(left, right)
    if expected is not None:
        assert result == expected, (name, result, expected)
    rows.append(dict(name=name, left=left, right=right, result=result, trace=calls))

identity = box()
add('coincident-full-dimensions49-24-52', identity, identity, True)
for index, dimension in enumerate((49, 24, 52)):
    for sign in (-1, 1):
        for label, distance, expected in [('inside',dimension-0.0001,True), ('touching',dimension,True),
                                           ('outside',dimension+0.0001,False)]:
            position = [0, 0, 0]
            position[index] = sign*distance
            add(f'axis{index}-{sign}-{label}', identity, box(position), expected)
        bits = struct.unpack('<I', struct.pack('<f', dimension))[0]
        next_float = struct.unpack('<f', struct.pack('<I', bits+1))[0]
        position[index] = sign*next_float
        add(f'axis{index}-{sign}-next-float-outside', identity, box(position), False)
add('translation-height-overlap', box((9000, 15, -4200)), box((9000, 38, -4200)), True)
add('translation-height-separated', box((9000, 15, -4200)), box((9000, 40, -4200)), False)
add('unequal-dimensions-touching', box(dimensions=(10, 20, 30)), box((40, 0, 0), dimensions=(70, 8, 3)), True)
add('unequal-dimensions-separated', box(dimensions=(10, 20, 30)), box((40.001, 0, 0), dimensions=(70, 8, 3)), False)
add('quarter-yaw-cross-dimensions-touching', identity, box((50.5, 0, 0), angles=(0, math.pi/2, 0)), True)
add('quarter-yaw-cross-dimensions-separated', identity, box((50.501, 0, 0), angles=(0, math.pi/2, 0)), False)
for scale in (0.5, 2, 3):
    for displacement in (0, 10, 25, 49, 75, 130):
        add(f'scaled-axis{scale}-offset{displacement}', box(scales=(scale, scale, scale)), box((displacement, 0, 0)))
for angles in [(0,0.7,0), (0.6,0,0), (0,0,0.8), (0.4,0.7,-0.3)]:
    first = box(angles=angles)
    for index, dimension in enumerate((49,24,52)):
        direction = first['matrix'][index*4:index*4+3]
        for sign in (-1,1):
            for offset in (-0.00001,0,0.00001):
                position = tuple(sign*(dimension+offset)*value for value in direction)
                add(f'rotated-face-{angles}-axis{index}-{sign}-offset{offset}', first, box(position,angles))
for origin in [(123.25,-12.5,456.75), (1000000,1000000,-1000000)]:
    for index, dimension in enumerate((49,24,52)):
        for offset in (-0.00001,0,0.00001):
            position = list(origin)
            position[index] += dimension+offset
            add(f'world-origin{origin}-axis{index}-offset{offset}',box(origin),box(position))
rng = random.Random(0x32ce0)
for index in range(800):
    dims1 = tuple(rng.uniform(1, 100) for _ in range(3))
    dims2 = tuple(rng.uniform(1, 100) for _ in range(3))
    angles1 = tuple(rng.uniform(-math.pi, math.pi) for _ in range(3))
    angles2 = tuple(rng.uniform(-math.pi, math.pi) for _ in range(3))
    position = tuple(rng.uniform(-90, 90) for _ in range(3))
    first = box(angles=angles1, dimensions=dims1)
    second = box(position, angles2, dims2)
    add(f'oblique-{index}', first, second)
    if index < 80:
        add(f'oblique-reversed-{index}', second, first)
for index in range(120):
    add(f'scaled-oblique-{index}', box(angles=tuple(rng.uniform(-3,3) for _ in range(3)),
                                     scales=tuple(rng.uniform(0.2,3) for _ in range(3))),
        box(tuple(rng.uniform(-100,100) for _ in range(3)), tuple(rng.uniform(-3,3) for _ in range(3)),
            scales=tuple(rng.uniform(0.2,3) for _ in range(3))))
cross_only = [row for row in rows if row['result'] and
              row['trace']['cross_comparisons'] > row['trace']['cross_continues']]
assert cross_only, 'need original cross-axis separation that returns success'
precision_cases = {hex(control): [row['name'] for row in rows
                     if run(row['left'], row['right'], control)[0] != row['result']]
                   for control in (0, 0x037f)}
precision_differences = {key:len(value) for key,value in precision_cases.items()}
assert struct.unpack('<H', uc.mem_read(0x5e3478,2))[0] == 0x027f
output = ROOT / 'recovery/output'
result = dict(status='PASS', entry=hex(ENTRY), import_pointer='0x5c0ba8',
              fpu_control='0x027f', crt_fabs='native executable0x57d261', rows=rows,
              cross_only_separations=[row['name'] for row in cross_only],
              fpu_comparison_differences=precision_differences, fpu_comparison_cases=precision_cases,
              executable_crt_control_word='0x5e3478=0x027f',
              limitations=['OBB matrices and dimensions supplied; original controller and prediction not executed',
                           'FPU control explicitly supplied as MSVC default0x027f; application startup control not traced'])
(output / 'role-obb-kernel-native.json').write_text(json.dumps(result, indent=2)+'\n')
cs = Cs(CS_ARCH_X86, CS_MODE_32)
lines = []
for address, length in [(0x10032ce0,0x2a0),(0x10032b50,0xf2),(0x10030800,0x21),(0x1002f420,0x39)]:
    lines += [f'{item.address:08x}: {item.mnemonic} {item.op_str}'
              for item in cs.disasm(bytes(uc.mem_read(address,length)),address)]
(output / 'role-obb-kernel-disassembly.log').write_text('\n'.join(lines)+'\n')
summary = f'PASS {len(rows)} original IsColOBB fixtures; cross-only separations returning1={len(cross_only)}; precision differences={precision_differences}'
(output / 'role-obb-kernel-native.log').write_text(summary+'\n')
print(summary)
