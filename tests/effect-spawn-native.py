"""Execute full original particle spawn, supplying CRT random values only."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
paths = [ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll']
machine, images = map_original_binaries(paths)
machine.mem_map(0x2000000, 0x20000)
OBJECT, DEFINITION, CONTROL_TABLE, CONTROL, RESOURCE, STATE, EMITTER, PARENT, MANAGER, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2014000, 0x2015000, 0x2016000,
    0x2017000, 0x2018000, 0x2008000, 0x201f000)
READER_CALL, READER_VTABLE, READER_OBJECT = 0x201f100, 0x201f200, 0x201f300
reader_stream, reader_offset, random_draws, random_index = b'', 0, [], 0
random_pattern = [0]


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def finish(pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(uc, address, size, data):
    global reader_offset, random_index
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == READER_CALL:
        destination, length = uint(stack + 4), uint(stack + 8)
        uc.mem_write(destination, reader_stream[reader_offset:reader_offset + length])
        reader_offset += length
        uc.reg_write(UC_X86_REG_EAX, length)
        finish(8)
    elif address == 0x57cbcb:
        value = random_pattern[random_index % len(random_pattern)]
        random_index += 1
        random_draws.append(value)
        uc.reg_write(UC_X86_REG_EAX, value)
        finish(0)
    elif address == 0x47b81b:
        uc.reg_write(UC_X86_REG_EAX, MANAGER)
        finish(0)


machine.hook_add(UC_HOOK_CODE, hook)
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
global_rotation = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]
parent_options = [None, [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 8, 4, 2, 1], [0] * 16]
emitter_position, orbit_offset = [12, -17, 34], [1.25, 2.5, -3.75]
machine.mem_write(MANAGER + 0x68, struct.pack('<16f', *global_rotation))
rows = []
for control in library['particleControls']:
    source = library['nodes'][control['node']]['modifiers'][control['modifier']]
    base, payload = bytes.fromhex(source['base']), bytes.fromhex(source['payload'])
    reader_stream = struct.pack('<I', len(base)) + base + struct.pack('<I', len(payload)) + payload
    reader_offset = 0
    machine.mem_write(READER_OBJECT, struct.pack('<I', READER_VTABLE))
    machine.mem_write(READER_VTABLE + 0xc, struct.pack('<I', READER_CALL))
    machine.mem_write(CONTROL, bytes(0x300))
    machine.mem_write(STACK, struct.pack('<II', STOP, READER_OBJECT))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, CONTROL)
    machine.emu_start(0x478626, STOP, count=10000)
    assert reader_offset == len(reader_stream)
    machine.mem_write(OBJECT, bytes(0x100))
    machine.mem_write(OBJECT + 0xc, struct.pack('<I', DEFINITION))
    machine.mem_write(OBJECT + 0x48, struct.pack('<I', EMITTER))
    machine.mem_write(EMITTER, struct.pack('<6f', *emitter_position, *orbit_offset))
    machine.mem_write(DEFINITION + 0x150, struct.pack('<I', RESOURCE))
    machine.mem_write(DEFINITION + 0x160, struct.pack('<I', CONTROL_TABLE))
    machine.mem_write(CONTROL_TABLE, struct.pack('<I', CONTROL))
    frames = control['particleFrame']['frameCount']
    machine.mem_write(RESOURCE + 0x150, struct.pack('<I', frames))
    for parent in parent_options:
        machine.mem_write(OBJECT + 0x20, struct.pack('<I', PARENT if parent is not None else 0))
        if parent is not None:
            machine.mem_write(PARENT, struct.pack('<16f', *parent))
        for random_pattern in [[0], [32767], [8191, 24575, 16383, 1000]]:
            random_index = 0
            random_draws.clear()
            machine.mem_write(STATE, struct.pack('<I', 1) + bytes(96))
            machine.mem_write(STACK, struct.pack('<II', STOP, STATE))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.reg_write(UC_X86_REG_FPCW, 0x27f)
            machine.emu_start(0x47fdbb, STOP, count=100000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
            values = struct.unpack('<I22fIf', machine.mem_read(STATE, 100))
            result = {'visible': bool(values[0]), 'age': values[1], 'acceleration': list(values[2:5]),
                      'velocity': list(values[5:8]), 'position': list(values[8:11]),
                      'angles': list(values[11:14]), 'angleRate': list(values[14:17]),
                      'lifetime': values[17], 'scale': values[18], 'color': list(values[19:23]),
                      'frame': values[23], 'frameRemainder': values[24]}
            rows.append({'node': control['node'], 'modifier': control['modifier'],
                         'config': control['spawn'], 'frameCount': frames,
                         'emitterPosition': emitter_position, 'orbitOffset': orbit_offset,
                         'globalRotation': global_rotation, 'parent': parent,
                         'randomValues': list(random_draws), 'result': result})
(ROOT / 'recovery/output/effect-spawn-native.json').write_text(json.dumps({
    'sources': {path.name: sha256(path.read_bytes()).hexdigest() for path in paths}, 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} complete source particle spawns, point/box/disc, original DLL matrix/CRT math and random consumption')
