"""Execute full type-6 update in source motion modes 0/3 without a target."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP,
                               UC_X86_REG_EAX, UC_X86_REG_FPCW)

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, images = map_original_binaries([exe, ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
machine.mem_map(0x2000000, 0x20000)
OBJECT, DEFINITION, CONTROL_TABLE, CONTROL, RESOURCE, STATE, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2014000, 0x2015000, 0x2008000, 0x201f000)
READER_CALL, READER_VTABLE, READER_OBJECT = 0x201f100, 0x201f200, 0x201f300
reader_stream = b''
reader_offset = 0
random_draws = 0


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def finish(pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(uc, address, size, data):
    global reader_offset, random_draws
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == READER_CALL:
        destination, length = uint(stack + 4), uint(stack + 8)
        uc.mem_write(destination, reader_stream[reader_offset:reader_offset + length])
        reader_offset += length
        uc.reg_write(UC_X86_REG_EAX, length)
        finish(8)
    elif address == 0x45e400:
        random_draws += 1
        uc.reg_write(UC_X86_REG_EAX, uint(stack + 4) - 1)
        finish(0)


def unpack_state(raw):
    values = struct.unpack('<I22fIf', raw)
    return {'visible': bool(values[0]), 'age': values[1], 'acceleration': list(values[2:5]),
            'velocity': list(values[5:8]), 'position': list(values[8:11]),
            'angles': list(values[11:14]), 'angleRate': list(values[14:17]),
            'lifetime': values[17], 'scale': values[18], 'color': list(values[19:23]),
            'frame': values[23], 'frameRemainder': values[24]}


machine.hook_add(UC_HOOK_CODE, hook)
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
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
    machine.mem_write(OBJECT + 0x48, struct.pack('<I', 0x2016000))
    machine.mem_write(0x2016000, struct.pack('<6f', 12, -17, 34, 0, 0, 0))
    machine.mem_write(DEFINITION + 0x150, struct.pack('<I', RESOURCE))
    machine.mem_write(DEFINITION + 0x160, struct.pack('<I', CONTROL_TABLE))
    machine.mem_write(CONTROL_TABLE, struct.pack('<I', CONTROL))
    machine.mem_write(RESOURCE, bytes(0x160))
    frames = control['particleFrame']['frameCount']
    machine.mem_write(RESOURCE + 0x150, struct.pack('<I', frames))
    initial = struct.pack('<I22fIf', 1, .1, 1, 2, 3, 5, 6, 7, 11, 12, 13,
                          15, 16, 17, 21, 22, 23, .75, 4, .25, .375, .625, .5, frames - 1, .01)
    for precision in [0x27f, 0x37f]:
        for delta in [0, .016, .1, .5]:
            random_draws = 0
            machine.mem_write(STATE, initial)
            machine.mem_write(STACK, struct.pack('<IIf', STOP, STATE, delta))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.reg_write(UC_X86_REG_FPCW, precision)
            machine.emu_start(0x48032c, STOP, count=10000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 12
            rows.append({'node': control['node'], 'modifier': control['modifier'], 'delta': delta,
                         'precision': hex(precision), 'config': {'motion': control['particleMotion'],
                                                               'frame': control['particleFrame'],
                                                               'alphaMode': control['alphaMode']}, 'target': [12, -17, 34],
                         'state': unpack_state(initial),
                         'result': unpack_state(bytes(machine.mem_read(STATE, 100))),
                         'randomDraws': random_draws})
(ROOT / 'recovery/output/effect-particle-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} complete type-6 particle motion/angles/frames/alpha updates executed')
