"""Execute original type6 world start and complete lifecycle/particle dispatch."""
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
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x80000)
OBJECT, DEFINITION, TABLE, CONTROL, RESOURCE, PARTICLES, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2040000, 0x2014000, 0x2020000, 0x2008000, 0x203f000)
READER_CALL, READER_VTABLE, READER_OBJECT = 0x201f100, 0x201f200, 0x201f300
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
stream = b''
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
    elif address == 0x47f262:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.mem_write(OBJECT + 4, bytes(8))
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
    elif address == 0x47b81b:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.reg_write(UC_X86_REG_EAX, MANAGER)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)

machine.hook_add(UC_HOOK_CODE, hook)
def unpack(raw):
    v = struct.unpack('<I22fIf', raw)
    return dict(visible=bool(v[0]), age=v[1], acceleration=list(v[2:5]), velocity=list(v[5:8]),
        position=list(v[8:11]), angles=list(v[11:14]), angleRate=list(v[14:17]), lifetime=v[17],
        scale=v[18], color=list(v[19:23]), frame=v[23], frameRemainder=v[24])

parent = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 12.5, -3.25, 21, 1]
rows = []
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
for node in library['nodes']:
    if node['type'] != 6:
        continue
    controls = [c for c in library['particleControls'] if c['node'] == node['index']]
    if not controls or any(c['pathEnabled'] for c in controls) or not any(c['particleMotion']['mode'] in [1, 2] for c in controls):
        continue
    control = controls[0]
    random_index = 0
    machine.mem_write(OBJECT, bytes(0x100))
    machine.mem_write(DEFINITION, bytes(0x180))
    for index, current in enumerate(controls):
        source = node['modifiers'][index]
        base, payload = bytes.fromhex(source['base']), bytes.fromhex(source['payload'])
        stream = struct.pack('<I', len(base)) + base + struct.pack('<I', len(payload)) + payload
        offset = 0
        machine.mem_write(READER_OBJECT, struct.pack('<I', READER_VTABLE))
        machine.mem_write(READER_VTABLE + 12, struct.pack('<I', READER_CALL))
        machine.mem_write(STACK, struct.pack('<II', STOP, READER_OBJECT))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, CONTROL + index * 0x300)
        machine.emu_start(0x478626, STOP, count=10000)
        assert offset == len(stream)
        machine.mem_write(TABLE + index * 4, struct.pack('<I', CONTROL + index * 0x300))
    for address, value in [(OBJECT + 12, DEFINITION), (OBJECT + 0x40, PARTICLES),
                           (DEFINITION + 0x150, RESOURCE), (DEFINITION + 0x160, TABLE),
                           (RESOURCE + 0x150, control['particleFrame']['frameCount']), (OBJECT + 0x54, 0)]:
        machine.mem_write(address, struct.pack('<I', value))
    machine.mem_write(MANAGER + 0x68, struct.pack('<16f', *identity))
    machine.mem_write(0x2050000, struct.pack('<16f', *parent))
    machine.mem_write(OBJECT + 0x20, struct.pack('<I', 0x2050000))
    machine.mem_write(OBJECT + 0x48, struct.pack('<I', EMITTER))
    machine.mem_write(EMITTER, bytes(len(controls) * 28))
    machine.mem_write(OBJECT + 0x54, struct.pack('<I', 0))
    machine.mem_write(OBJECT + 0x58, struct.pack('<I', control['capacity']))
    machine.mem_write(OBJECT + 0x5c, bytes(4))
    timing = next(t for t in library['nodeTimings'] if t['node'] == node['index'])
    machine.mem_write(OBJECT, struct.pack('<I', 0x5c9b98))
    machine.mem_write(DEFINITION + 0x154, struct.pack('<ff', timing['delay'], timing['lifetime']))
    machine.mem_write(DEFINITION + 0x164, struct.pack('<I', TABLE + len(controls) * 4))
    machine.mem_write(0x201d000, struct.pack('<3f', 0, 0, 0))
    machine.mem_write(STACK, struct.pack('<II', STOP, 0x201d000))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, OBJECT)
    machine.emu_start(0x4808ac, STOP, count=100000)
    full_steps = []
    for delta in [0, max(0, timing['delay']) / 2, max(0, timing['delay']) / 2, .016, .1, .5, max(0, timing['lifetime']) + 1, 0]:
        random_values.clear()
        machine.mem_write(STACK, struct.pack('<If', STOP, delta))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, OBJECT)
        machine.reg_write(UC_X86_REG_FPCW, 0x27f)
        machine.emu_start(0x47f61c, STOP, count=1000000)
        assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
        states = [unpack(bytes(machine.mem_read(PARTICLES + i * 100, 100))) for i in range(uint(OBJECT + 0x54))]
        full_steps.append(dict(delta=delta, randomValues=list(random_values), states=states,
            spaces=[list(struct.unpack('<6f', machine.mem_read(EMITTER + i * 28, 24))) for i in range(len(controls))],
            phase=uint(OBJECT + 4), elapsed=struct.unpack('<f', machine.mem_read(OBJECT + 8, 4))[0],
            controller=struct.unpack('<i', machine.mem_read(OBJECT + 0x10, 4))[0],
            burst=bool(machine.mem_read(OBJECT + 0x7c, 1)[0]), fraction=struct.unpack('<f', machine.mem_read(OBJECT + 0x5c, 4))[0]))
    rows.append(dict(node=node['index'], controls=controls, timing=timing, parent=parent,
        capacity=control['capacity'], steps=full_steps))
(ROOT / 'recovery/output/effect-particle-target-parent-lifecycles-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print(f'PASS: {len(rows)} full source type6 source target non-path lifecycles / {len(rows)*8} ticks')
