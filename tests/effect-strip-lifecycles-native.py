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
from effect_strip_controls import strip_controls
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
    elif address == 0x4816c6:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.mem_write(uint(stack + 4), bytes(uc.mem_read(uint(stack + 8), 80)))
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
    elif address == 0x449072:
        # Clear history while retaining supplied storage; native heap is external.
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.mem_write(OBJECT + 0x70, bytes(8))
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
    elif address == 0x482dc3:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.mem_write(OBJECT + 0x74, struct.pack('<I', 1))
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 8)
    elif address == 0x47b81b:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.reg_write(UC_X86_REG_EAX, MANAGER)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)

machine.hook_add(UC_HOOK_CODE, hook)
def unpack(raw):
    v = struct.unpack('<19fI', raw)
    return dict(position=list(v[0:3]), orbitOffset=list(v[3:6]), velocity=list(v[6:9]),
        angles=list(v[9:12]), scale=list(v[12:15]), color=list(v[15:19]), frame=v[19])

def history():
    result = unpack(bytes(machine.mem_read(OBJECT + 0x40, 80)))
    result['frameRemainder'] = struct.unpack('<f',machine.mem_read(OBJECT+0x94,4))[0]
    return result

rows = []
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
for node in library['nodes']:
    if node['type'] != 7:
        continue
    controls = list(node['modifiers'])
    if not controls:
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
        machine.emu_start(0x477337, STOP, count=10000)
        assert offset == len(stream)
        machine.mem_write(TABLE + index * 4, struct.pack('<I', CONTROL + index * 0x300))
    for address, value in [(OBJECT + 12, DEFINITION), 
                           (DEFINITION + 0x150, RESOURCE), (DEFINITION + 0x160, TABLE),
                           (RESOURCE + 0x150, struct.unpack_from('<I', bytes.fromhex(node['resource']),332)[0]), (OBJECT + 0x54, 0)]:
        machine.mem_write(address, struct.pack('<I', value))
    machine.mem_write(MANAGER + 0x68, struct.pack('<16f', *identity))
    machine.mem_write(RESOURCE, bytes(0x300))
    machine.mem_write(RESOURCE + 0x150, struct.pack('<I', struct.unpack_from('<I', bytes.fromhex(node['resource']),332)[0]))
    machine.mem_write(RESOURCE + 0x148, bytes.fromhex(node['resource'])[324:389])
    grid = next(g for g in library['textureGrids'] if g['node'] == node['index'])
    machine.mem_write(OBJECT + 0x9c, struct.pack('<I', 0x2050000))
    machine.mem_write(0x2050000, b''.join(struct.pack('<4f',*v) for v in grid['uvFrames']))
    machine.mem_write(OBJECT + 0xac, struct.pack('<I', 0x2051000))
    segments = struct.unpack_from('<I', bytes.fromhex(node['resource']),344)[0]
    machine.mem_write(0x2051000, bytes(segments*68))
    timing = next(t for t in library['nodeTimings'] if t['node'] == node['index'])
    machine.mem_write(OBJECT, struct.pack('<I', 0x5c93d8))
    machine.mem_write(DEFINITION + 0x154, struct.pack('<ff', timing['delay'], timing['lifetime']))
    machine.mem_write(DEFINITION + 0x164, struct.pack('<I', TABLE + len(controls) * 4))
    machine.mem_write(0x201d000, struct.pack('<3f', 12.5, -3.75, 21))
    machine.mem_write(STACK, struct.pack('<II', STOP, 0x201d000))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, OBJECT)
    machine.reg_write(UC_X86_REG_FPCW, 0x27f)
    random_values.clear()
    saved_stack = bytes(machine.mem_read(STACK, 8))
    machine.mem_write(STACK, struct.pack('<I', STOP))
    machine.emu_start(0x474f60, STOP, count=1000000)
    machine.mem_write(STACK, saved_stack)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, OBJECT)
    machine.emu_start(0x474d69, STOP, count=100000)
    initialRandom = list(random_values)
    initial = history()
    full_steps = []
    for delta in [0, max(0, timing['delay']) / 2, max(0, timing['delay']) / 2, .016, .1, .5, max(0, timing['lifetime']) + 1, 0]:
        random_values.clear()
        machine.mem_write(STACK, struct.pack('<If', STOP, delta))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, OBJECT)
        machine.reg_write(UC_X86_REG_FPCW, 0x27f)
        machine.emu_start(0x47f61c, STOP, count=1000000)
        assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
        states = history()
        full_steps.append(dict(delta=delta, randomValues=list(random_values), states=states,
            
            phase=uint(OBJECT + 4), elapsed=struct.unpack('<f', machine.mem_read(OBJECT + 8, 4))[0],
            controller=struct.unpack('<i', machine.mem_read(OBJECT + 0x10, 4))[0],
            scroll=struct.unpack('<f',machine.mem_read(OBJECT+0x90,4))[0], uvs=[list(struct.unpack('<4f',machine.mem_read(0x2051000+i*68+48,16))) for i in range(segments)]))
    rows.append(dict(node=node['index'], controls=[c for c in strip_controls([node])], timing=timing, frames=grid['uvFrames'],
        initialRandom=initialRandom, initial=initial, origin=[12.5, -3.75, 21], steps=full_steps))
(ROOT / 'recovery/output/effect-strip-lifecycles-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print(f'PASS: {len(rows)} full source type7 source lifecycles / {len(rows)*8} ticks')
