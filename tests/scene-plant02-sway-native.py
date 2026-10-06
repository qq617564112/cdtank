"""Execute original Plant height provider, cosine update and parameter submission."""
import json
import math
from pathlib import Path
import struct
import sys

import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from pol import read_pol
from scene import read_scene

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0x2000000, 0x30000)
OBJ, NODE, SHARED, MESH, BOX, MATRIX, VT, ATTACH, STACK, STOP = [
    0x2000000 + 0x1000 * index for index in range(10)]


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def floats(address, *values):
    uc.mem_write(address, struct.pack('<' + 'f' * len(values), *values))


def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def getfloat(address):
    return struct.unpack('<f', uc.mem_read(address, 4))[0]


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


attaches = []


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x1003c106:
        target, source, length = [get(stack + offset) for offset in [4, 8, 12]]
        machine.mem_write(target, bytes(machine.mem_read(source, length)))
        machine.reg_write(UC_X86_REG_EAX, target)
        machine.reg_write(UC_X86_REG_EIP, get(stack))
        machine.reg_write(UC_X86_REG_ESP, stack + 4)
    elif address == ATTACH:
        attaches.append(dict(parameter=getfloat(NODE + 0x150), effect=get(stack + 4)))
        machine.reg_write(UC_X86_REG_EIP, get(stack))
        machine.reg_write(UC_X86_REG_ESP, stack + 8)


for endpoint in [0x1003c106, ATTACH]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=endpoint, end=endpoint)


def run(address, owner, arguments=()):
    put(STACK, STOP, *arguments)
    uc.reg_write(UC_X86_REG_ECX, owner)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(arguments) * 4


source = ROOT / 'recovery/output/verified/assets/data'
placements = [record for record in read_scene(source / 'Data/scn/0002/0002.obj')
              if record['className'] == 'SYcScnObjPlant' and record['model'] == 'obj05413']
model = read_pol(source / 'Data/scnobj/obj05413/obj05413.POL')
assert len(model['meshes']) == 1
mesh = model['meshes'][0]
identity = [1.0 if index % 5 == 0 else 0.0 for index in range(16)]
put(NODE, VT)
put(NODE + 0xfc, SHARED)
put(SHARED, MESH)
floats(MESH + 0x54, *mesh['bounds'])
floats(NODE + 0x7c, *identity)
put(VT + 0x10, ATTACH)
put(OBJ + 0xdc, NODE)
put(OBJ + 0x78, MATRIX)
floats(MATRIX, *identity)
run(0x10017cb0, NODE, [BOX])
run(0x44ddc0, OBJ, [BOX])
height = getfloat(OBJ + 0xc4)
assert height == f32(mesh['bounds'][4] - mesh['bounds'][1])
assert all(record['bounds'][1] == height for record in placements)
# The original Plant loader copies object+c4 into object+108.
uc.mem_write(OBJ + 0x108, bytes(uc.mem_read(OBJ + 0xc4, 4)))
period = getfloat(0x61e870)
amplitude = getfloat(0x5c74d0)
rows = []
uc.reg_write(UC_X86_REG_FPCW, 0x27f)
for initial, delta in [(0, 0), (0, .1), (1, .25), (6.2, .1), (40, .5), (0, 3.4)]:
    floats(OBJ + 0x100, initial, 0)
    run(0x45e8a5, OBJ, [struct.unpack('<I', struct.pack('<f', delta))[0]])
    phase = getfloat(OBJ + 0x100)
    parameter = getfloat(OBJ + 0x104)
    before = len(attaches)
    run(0x45e90a, OBJ)
    assert len(attaches) == before + 1
    assert attaches[-1]['parameter'] == parameter
    phase_sum = f32(initial) + 2 * f32(delta)
    expected_phase = f32(phase_sum - period if phase_sum > period else phase_sum)
    expected_parameter = f32(math.cos(expected_phase) / height * amplitude)
    assert phase == expected_phase, (initial, delta, phase, expected_phase)
    assert abs(parameter - expected_parameter) <= 1e-9
    rows.append(dict(initial=initial, delta=delta, phase=phase, parameter=parameter,
                     topDisplacementX=parameter * mesh['bounds'][4] ** 2))
put(OBJ + 0xdc, 0)
floats(OBJ + 0x100, 1, .01)
run(0x45e8a5, OBJ, [struct.unpack('<I', struct.pack('<f', .1))[0]])
before = len(attaches)
run(0x45e90a, OBJ)
assert getfloat(OBJ + 0x100) == 1 and getfloat(OBJ + 0x104) == f32(.01)
assert len(attaches) == before

pe = images['cdtank.exe']
binary = pe.get_memory_mapped_image()
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
sources = []
for start, end in [(0x45f407, 0x45f46f), (0x45f8ad, 0x45f8df),
                   (0x45e8a5, 0x45e934), (0x4617e9, 0x461827), (0x57ca74, 0x57ca94)]:
    sources.append(dict(start=hex(start), instructions=[
        dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
        for i in decoder.disasm(binary[start - 0x400000:end - 0x400000], start)]))
result = dict(status='PASS_PLANT_UPDATE_HEIGHT_NATIVE_ONLY', model='obj05413',
              placements=[dict(id=p['id'], position=p['position'], enabled=p['enabled'],
                               rotation=p['rotation']) for p in placements],
              sourceBounds=mesh['bounds'], height=height, period=period, amplitude=amplitude,
              rows=rows, nullNodeGated=True, sources=sources,
              fpu=dict(controlWord='0x27f', precision=53,
                       source='effect-fpu-native.json startupRows', runtimeDevicePrecisionConfirmed=False),
              shader='Data/gfxscript/plant80.gbf',
              scope='OriginalGetTotalOBBox/basebox copy/45e8a5/CRT FCOS/45e90a/SetParameter execute. '
                    'Mesh bounds supplied from originalPOL; memcpy and finalAttach recorded endpoints. '
                    'No full model loader, GPU shader execution, ordinary player output or billboard claim.')
path = ROOT / 'recovery/output/scene-plant02-sway-native.json'
path.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
