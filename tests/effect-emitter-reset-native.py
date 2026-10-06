"""Execute original type6 world start and controller reset space state."""
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
stream = b''
offset = 0
MANAGER, EMITTER = 0x201b000, 0x201c000
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
    elif address == 0x480138:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 8)
    elif address == 0x47b81b:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.reg_write(UC_X86_REG_EAX, MANAGER)
        uc.reg_write(UC_X86_REG_EIP, uint(stack))
        uc.reg_write(UC_X86_REG_ESP, stack + 4)

machine.hook_add(UC_HOOK_CODE, hook)
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
rotation = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]
rows = []
for control in library['particleControls']:
    if control['pathEnabled']:
        continue
    source = library['nodes'][control['node']]['modifiers'][control['modifier']]
    base, payload = bytes.fromhex(source['base']), bytes.fromhex(source['payload'])
    stream = struct.pack('<I', len(base)) + base + struct.pack('<I', len(payload)) + payload
    offset = 0
    machine.mem_write(READER_OBJECT, struct.pack('<I', READER_VTABLE))
    machine.mem_write(READER_VTABLE + 12, struct.pack('<I', READER_CALL))
    machine.mem_write(CONTROL, bytes(0x300))
    machine.mem_write(STACK, struct.pack('<II', STOP, READER_OBJECT))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, CONTROL)
    machine.emu_start(0x478626, STOP, count=10000)
    assert offset == len(stream)
    for parent in [False, True]:
        for operation in ['start', 'reset']:
            machine.mem_write(OBJECT, bytes(0x100))
            index = 0 if operation == 'start' else 1
            for address, value in [(OBJECT + 12, DEFINITION), (OBJECT + 0x48, EMITTER),
                                   (OBJECT + 0x20, 0x201a000 if parent else 0),
                                   (OBJECT + 0x10, index), (OBJECT + 0x54, 7),
                                   (DEFINITION + 0x160, TABLE), (TABLE + index * 4, CONTROL)]:
                machine.mem_write(address, struct.pack('<I', value))
            machine.mem_write(MANAGER + 0x68, struct.pack('<16f', *rotation))
            machine.mem_write(OBJECT + 0x14, struct.pack('<3f', 100, 200, 300))
            machine.mem_write(OBJECT + 0x5c, struct.pack('<f', .375))
            machine.mem_write(OBJECT + 0x7c, b'\x01')
            initial = [12.5, -3.75, 21, 1, 2, 3]
            machine.mem_write(EMITTER, struct.pack('<7f', *initial, 0))
            machine.mem_write(EMITTER + 28, struct.pack('<7f', -4, -5, -6, 7, 8, 9, 0))
            machine.mem_write(0x201d000, struct.pack('<3f', 10, 20, 30))
            machine.mem_write(STACK, struct.pack('<II', STOP, 0x201d000))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.reg_write(UC_X86_REG_FPCW, 0x27f)
            machine.emu_start(0x4808ac if operation == 'start' else 0x4809f3, STOP, count=100000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + (8 if operation == 'start' else 4)
            state = list(struct.unpack('<6f', machine.mem_read(EMITTER + index * 28, 24)))
            rows.append(dict(control=control, parent=parent, globalRotation=rotation, initial=initial,
                operation=operation, state=state, index=uint(OBJECT + 0x10), count=uint(OBJECT + 0x54),
                origin=list(struct.unpack('<3f', machine.mem_read(OBJECT + 0x14, 12))),
                fraction=struct.unpack('<f', machine.mem_read(OBJECT + 0x5c, 4))[0],
                burst=bool(machine.mem_read(OBJECT + 0x7c, 1)[0])))
(ROOT / 'recovery/output/effect-emitter-reset-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print(f'PASS: {len(rows)} original type6 world start/controller reset space states')
