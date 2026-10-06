"""Execute type-6 packed-array updates with original node 17 and particle states."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x20000)
OBJECT, DEFINITION, TABLE, CONTROL, RESOURCE, PARTICLES, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2014000, 0x2015000, 0x2008000, 0x201f000)
READER_CALL, READER_VTABLE, READER_OBJECT = 0x201f100, 0x201f200, 0x201f300
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
control = next(c for c in library['particleControls'] if c['node'] == 17)
source = library['nodes'][17]['modifiers'][0]
base, payload = bytes.fromhex(source['base']), bytes.fromhex(source['payload'])
stream = struct.pack('<I', len(base)) + base + struct.pack('<I', len(payload)) + payload
offset = 0

def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]

def hook(uc, address, size, data):
    global offset
    if address == READER_CALL:
        stack = uc.reg_read(UC_X86_REG_ESP)
        destination, length = uint(stack + 4), uint(stack + 8)
        uc.mem_write(destination, stream[offset:offset + length])
        offset += length
        uc.reg_write(UC_X86_REG_EAX, length)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 12)

machine.hook_add(UC_HOOK_CODE, hook)
machine.mem_write(READER_OBJECT, struct.pack('<I', READER_VTABLE))
machine.mem_write(READER_VTABLE + 12, struct.pack('<I', READER_CALL))
machine.mem_write(STACK, struct.pack('<II', STOP, READER_OBJECT))
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.reg_write(UC_X86_REG_ECX, CONTROL)
machine.emu_start(0x478626, STOP, count=10000)
assert offset == len(stream)
for address, value in [(OBJECT + 12, DEFINITION), (OBJECT + 0x40, PARTICLES),
                       (DEFINITION + 0x150, RESOURCE), (DEFINITION + 0x160, TABLE),
                       (TABLE, CONTROL), (RESOURCE + 0x150, 1), (OBJECT + 0x54, 3)]:
    machine.mem_write(address, struct.pack('<I', value))
spawns = json.loads((ROOT / 'recovery/output/effect-spawn-native.json').read_text())
initial = [r['result'] for r in spawns['rows'] if r['node'] == 17 and r['parent'] is None]
assert len(initial) == 3

def pack(s):
    return struct.pack('<I22fIf', s['visible'], s['age'], *s['acceleration'], *s['velocity'],
        *s['position'], *s['angles'], *s['angleRate'], s['lifetime'], s['scale'],
        *s['color'], s['frame'], s['frameRemainder'])

def unpack(raw):
    v = struct.unpack('<I22fIf', raw)
    return dict(visible=bool(v[0]), age=v[1], acceleration=list(v[2:5]), velocity=list(v[5:8]),
        position=list(v[8:11]), angles=list(v[11:14]), angleRate=list(v[14:17]), lifetime=v[17],
        scale=v[18], color=list(v[19:23]), frame=v[23], frameRemainder=v[24])

machine.mem_write(PARTICLES, b''.join(pack(s) for s in initial))
steps = []
for delta in [0, .1, .2, .5, .2, 1, 0]:
    machine.mem_write(STACK, struct.pack('<If', STOP, delta))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, OBJECT)
    machine.reg_write(UC_X86_REG_FPCW, 0x27f)
    machine.emu_start(0x480857, STOP, count=100000)
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
    states = [unpack(bytes(machine.mem_read(PARTICLES + i * 100, 100))) for i in range(uint(OBJECT + 0x54))]
    steps.append(dict(delta=delta, states=states))
assert [len(s['states']) for s in steps] == [2, 2, 2, 1, 1, 0, 0]
result = dict(node=17, initial=initial, steps=steps, config=dict(motion=control['particleMotion'],
    frame=control['particleFrame'], alphaMode=control['alphaMode']))
(ROOT / 'recovery/output/web-assets/effect-particle-browser-native.json').write_text(json.dumps(result) + '\n')
print('PASS: original type-6 node17 loader, complete update and packed-array lifetime over seven steps')
