"""Execute source type-6 emission clocks with injected native random counts."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP,
                               UC_X86_REG_EAX, UC_X86_REG_FPCW)

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x20000)
OBJECT, DEFINITION, CONTROLS, CONTROL, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2008000, 0x201f000)
emitted = []
random_draws = []
selected_count = 0
reader_stream = b''
reader_offset = 0
READER_CALL, READER_VTABLE, READER_OBJECT = 0x201f100, 0x201f200, 0x201f300


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def finish(pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    global reader_offset
    if address == READER_CALL:
        destination, length = uint(stack + 4), uint(stack + 8)
        uc.mem_write(destination, reader_stream[reader_offset:reader_offset + length])
        reader_offset += length
        uc.reg_write(UC_X86_REG_EAX, length)
        finish(8)
    elif address == 0x474181:
        random_draws.append([uint(stack + 4), uint(stack + 8)])
        uc.reg_write(UC_X86_REG_EAX, selected_count)
        finish(0)
    elif address == 0x48010c:
        emitted.append(struct.unpack('<i', uc.mem_read(stack + 4, 4))[0])
        uc.reg_write(UC_X86_REG_EAX, 0)
        finish(4)


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
    assert list(struct.unpack('<2i', machine.mem_read(CONTROL + 0x24c, 8))) == control['emitter']['countRange']
    assert bool(machine.mem_read(CONTROL + 0x25c, 1)[0]) == control['emitter']['burst']
    assert uint(CONTROL + 0x258) == control['renderFlags']
    assert list(struct.unpack('<3f', machine.mem_read(CONTROL + 0x10, 12))) == control['motion']['position']
    assert list(struct.unpack('<3f', machine.mem_read(CONTROL + 0x3c, 12))) == control['motion']['velocity']
    assert list(struct.unpack('<3f', machine.mem_read(CONTROL + 0x48, 12))) == control['orbit']['axis']
    assert struct.unpack('<f', machine.mem_read(CONTROL + 0x54, 4))[0] == control['orbit']['radius']
    assert struct.unpack('<f', machine.mem_read(CONTROL + 0x58, 4))[0] == control['orbit']['angularRate']
    assert bool(machine.mem_read(CONTROL + 0x5c, 1)[0]) == control['pathEnabled']
    for precision in [0x27f, 0x37f]:
        machine.mem_write(OBJECT, bytes(0x100))
        machine.mem_write(OBJECT + 0xc, struct.pack('<I', DEFINITION))
        machine.mem_write(DEFINITION + 0x160, struct.pack('<I', CONTROLS))
        machine.mem_write(CONTROLS, struct.pack('<I', CONTROL))
        config = control['emitter']
        steps = []
        for index, delta in enumerate([0, .016, .033, .2, 1.25, 0, .025]):
            selected_count = config['countRange'][index % 2]
            emitted.clear()
            random_draws.clear()
            machine.mem_write(STACK, struct.pack('<If', STOP, delta))
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_FPCW, precision)
            machine.emu_start(0x480138, STOP, count=10000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
            assert random_draws == [config['countRange']]
            steps.append({'delta': delta, 'randomCount': selected_count,
                          'emitted': emitted[0] if emitted else 0,
                          'fraction': struct.unpack('<f', machine.mem_read(OBJECT + 0x5c, 4))[0],
                          'burstEmitted': bool(machine.mem_read(OBJECT + 0x7c, 1)[0])})
        rows.append({'node': control['node'], 'modifier': control['modifier'],
                     'precision': hex(precision), 'config': config, 'steps': steps})
(ROOT / 'recovery/output/effect-emitter-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} native emission clocks, {len(rows) * 7} random/count/fraction updates')
