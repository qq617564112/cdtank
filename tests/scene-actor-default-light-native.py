"""Execute original zero-candidate actor light selection and component setters."""
import json
import math
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

machine, images = map_original_binaries([
    ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']
])
machine.mem_map(0, 4096)
machine.mem_map(0x2000000, 0x100000)
MANAGER, SCENE, VIEW = 0x2000000, 0x2001000, 0x2002000
COMPONENTS = [0x2003000 + index * 0x1000 for index in range(4)]
GRAPHICS, MATRIX_STACK, MATRIX = 0x2009000, 0x200a000, 0x200b000
TEXTURE, LIGHT = 0x200c000, 0x200d000
STACK, RETURN = 0x20ff000, 0x20fe000
TEXTURE_DEVICE_HANDLE = 0x12345000
calls = []


def write32(address, value):
    machine.mem_write(address, struct.pack('<I', value))


def read32(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def read_vector(address):
    return list(struct.unpack('<3f', machine.mem_read(address, 12)))


def observe_setter(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    calls.append({
        'component': hex(uc.reg_read(UC_X86_REG_ECX)),
        'mode': read32(stack + 4),
        'direction': read_vector(read32(stack + 8)),
        'textureHandle': read32(stack + 12),
    })


machine.hook_add(UC_HOOK_CODE, observe_setter, begin=0x100099b0, end=0x100099b0)
write32(0x635830, MANAGER)
write32(0x63582c, GRAPHICS)
write32(GRAPHICS + 0xd4, MATRIX_STACK)
write32(MATRIX_STACK, MATRIX)
write32(MATRIX_STACK + 8, 0)
write32(SCENE + 0x70, LIGHT)
write32(LIGHT + 0xd8, TEXTURE)
write32(TEXTURE + 0x6c, TEXTURE_DEVICE_HANDLE)
machine.mem_write(LIGHT + 0x58, struct.pack('<3f', 0, 200, 0))
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
translated = identity[:]
translated[12:15] = [30, -40, 70]
rotated = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 30, -40, 70, 1]
cases = [
    ('origin', [0, 0, 0], identity),
    ('offset', [100, 0, 0], identity),
    ('translated-camera', [100, 0, 0], translated),
    ('rotated-camera', [100, 0, 50], rotated),
    ('below-light', [-1370, 35, -1579], rotated),
]
rows = []
for component_count, entry in [(3, 0x46a26b), (4, 0x46d756)]:
    for label, position, matrix in cases + [('scene-cleared', [100, 0, 0], identity)]:
        scene_present = label != 'scene-cleared'
        write32(MANAGER + 0x60, SCENE if scene_present else 0)
        machine.mem_write(MATRIX, struct.pack('<16f', *matrix))
        machine.mem_write(VIEW + 0x28, struct.pack('<3f', *position))
        for index, component in enumerate(COMPONENTS):
            write32(VIEW + 0x2a8 + index * 4, component if index < component_count else 0)
            machine.mem_write(component + 0x94, b'\xff' * 20)
        calls.clear()
        write32(STACK, RETURN)
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, VIEW)
        machine.reg_write(UC_X86_REG_FPCW, 0x27f)
        machine.emu_start(entry, RETURN, count=200000)
        assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
        assert len(calls) == component_count
        direction = [0, 0, 0]
        if scene_present:
            difference = [-position[0], 200 - position[1], -position[2]]
            transformed = [sum(difference[j] * matrix[j * 4 + i] for j in range(3))
                           for i in range(3)]
            length = math.sqrt(sum(value * value for value in transformed))
            direction = [value / length for value in transformed]
        stored = []
        for index, call in enumerate(calls):
            component = COMPONENTS[index]
            assert call['component'] == hex(component)
            assert call['mode'] == (1 if scene_present else 0)
            assert call['textureHandle'] == (TEXTURE_DEVICE_HANDLE if scene_present else 0)
            assert max(abs(a - b) for a, b in zip(call['direction'], direction)) < 0.000001
            assert read32(component + 0x94) == call['mode']
            assert read_vector(component + 0x98) == call['direction']
            assert read32(component + 0xa4) == call['textureHandle']
            stored.append(dict(call))
        rows.append({'components': component_count, 'entry': hex(entry), 'case': label,
                     'actorPosition': position, 'viewMatrix': matrix, 'setters': stored})

evidence = {
    'status': 'PASS_ORIGINAL_MAP02_ZERO_CANDIDATE_ACTOR_LIGHT_DIRECTION_SETTERS',
    'rows': rows,
    'scope': 'Original complete three/four-part light updates, vector count, matrix stack GetTop, '
             'Transform, Normalize with original CRT sqrt and SetLight setters execute; observer '
             'only reads setter calls.',
    'supplied': 'Scene/default object, zero candidate vector, actor components and positions, '
                'gfx matrix stack and texture device handle are explicit input memory fixtures.',
    'limits': 'No scene loader/texture upload execution, selected shader draw, gameplay or browser '
              'acceptance; no nonzero .ctl selection qualification.',
}
(ROOT / 'recovery/output/scene-actor-default-light-native.json').write_text(
    json.dumps(evidence, indent=2) + '\n')
print(f'PASS: {len(rows)} original three/four-part zero-candidate/scene-cleared updates; '
      f'{sum(len(row["setters"]) for row in rows)} original component setters')
