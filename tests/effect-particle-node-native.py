"""Execute complete native type-6 node17 per-frame motion, emission and particles."""
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
random_index = 0
random_values = []
MANAGER, EMITTER = 0x201b000, 0x201c000

def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]

def hook(uc, address, size, data):
    global offset, random_index
    if address == READER_CALL:
        stack = uc.reg_read(UC_X86_REG_ESP)
        destination, length = uint(stack + 4), uint(stack + 8)
        uc.mem_write(destination, stream[offset:offset + length])
        offset += length
        uc.reg_write(UC_X86_REG_EAX, length)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 12)
    elif address == 0x57cbcb:
        stack = uc.reg_read(UC_X86_REG_ESP)
        value = [8191, 24575, 16383, 1000][random_index % 4]
        random_index += 1
        random_values.append(value)
        uc.reg_write(UC_X86_REG_EAX, value)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
    elif address == 0x47b81b:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.reg_write(UC_X86_REG_EAX, MANAGER)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)

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
                       (TABLE, CONTROL), (RESOURCE + 0x150, 1), (OBJECT + 0x54, 0)]:
    machine.mem_write(address, struct.pack('<I', value))
def unpack(raw):
    v = struct.unpack('<I22fIf', raw)
    return dict(visible=bool(v[0]), age=v[1], acceleration=list(v[2:5]), velocity=list(v[5:8]),
        position=list(v[8:11]), angles=list(v[11:14]), angleRate=list(v[14:17]), lifetime=v[17],
        scale=v[18], color=list(v[19:23]), frame=v[23], frameRemainder=v[24])

# Complete native type-6 per-frame entry: emitter motion/spawn, then particle ages.
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
machine.mem_write(MANAGER + 0x68, struct.pack('<16f', *identity))
machine.mem_write(OBJECT + 0x48, struct.pack('<I', EMITTER))
machine.mem_write(EMITTER, struct.pack('<7f', 0, 0, 0, 0, 0, 0, 0))
machine.mem_write(OBJECT + 0x54, struct.pack('<I', 0))
machine.mem_write(OBJECT + 0x58, struct.pack('<I', control['capacity']))
machine.mem_write(OBJECT + 0x5c, bytes(4))
full_steps = []
for delta in [0, .016, .016, .1, .2, .5, .2, 1, 0]:
    random_values.clear()
    machine.mem_write(STACK, struct.pack('<If', STOP, delta))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, OBJECT)
    machine.reg_write(UC_X86_REG_FPCW, 0x27f)
    machine.emu_start(0x480889, STOP, count=1000000)
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
    states = [unpack(bytes(machine.mem_read(PARTICLES + i * 100, 100))) for i in range(uint(OBJECT + 0x54))]
    full_steps.append(dict(delta=delta, randomValues=list(random_values), states=states,
        emitter=list(struct.unpack('<6f', machine.mem_read(EMITTER, 24))),
        fraction=struct.unpack('<f', machine.mem_read(OBJECT + 0x5c, 4))[0]))
(ROOT / 'recovery/output/effect-particle-node-native.json').write_text(json.dumps(dict(node=17,
    control=control, capacity=control['capacity'], steps=full_steps)) + '\n')
print('PASS: original type-6 complete motion/emission/allocation/spawn/packed-update nine steps')
