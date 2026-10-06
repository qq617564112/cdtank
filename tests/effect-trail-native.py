"""Execute original history sample/copy/crop against all sprite controls."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import (UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ESI,
                               UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_FPCW)

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x40000)
FRAME, OBJECT, CONTROL, TABLE, ITEMS, STACK = (0x2009000, 0x2010000, 0x2012000,
                                             0x2014000, 0x2020000, 0x2008000)
CAPACITY = 128
CONTAINER = OBJECT + 0x64


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def return_call(pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(uc, address, size, data):
    if address == 0x4816c6:
        # Copy constructor's allocation/SEH wrapper; the ring insertion and
        # subsequent original assignment function execute unchanged.
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.mem_write(uint(stack + 4), bytes(uc.mem_read(uint(stack + 8), 80)))
        return_call(0)
    elif address == 0x482dc3:
        # resize(1) erases the tail; storage allocation is outside this check.
        uc.mem_write(CONTAINER + 0x10, struct.pack('<I', 1))
        return_call(4)


machine.hook_add(UC_HOOK_CODE, hook)
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
rows = []
initializations = []
for precision in [0x27f, 0x37f]:
    for control in library['spriteControls']:
        enabled, limit, interval = control['trailEnabled'], control['trailLimit'], control['trailInterval']
        count = limit if enabled else 1
        config = {'enabled': enabled, 'limit': limit, 'interval': interval}
        initial = bytes(range(80))
        machine.mem_write(OBJECT, bytes(0x100))
        machine.mem_write(CONTAINER + 4, struct.pack('<4I', TABLE, CAPACITY, 0, count))
        machine.mem_write(TABLE, struct.pack('<128I', *[ITEMS + index * 80 for index in range(CAPACITY)]))
        for index in range(CAPACITY):
            machine.mem_write(ITEMS + index * 80, initial)
        machine.mem_write(CONTROL + 0xa1, bytes([enabled]))
        machine.mem_write(CONTROL + 0xa4, struct.pack('<If', limit, interval))
        # Execute source initialization with an attached model and no orbit;
        # these inputs bypass external coordinate transforms.
        machine.mem_write(CONTAINER + 0x10, struct.pack('<I', 0))
        machine.mem_write(OBJECT + 0x20, struct.pack('<I', 1))
        machine.mem_write(FRAME, bytes(80))
        machine.mem_write(FRAME + 0x50, struct.pack('<I', CONTAINER))
        machine.mem_write(FRAME + 0x60, struct.pack('<I', OBJECT))
        machine.mem_write(FRAME + 0x64, struct.pack('<3f', *control['motion']['position']))
        machine.mem_write(FRAME + 0x54, bytes(12))
        machine.mem_write(FRAME + 0x7c, struct.pack('<I', 3))
        for offset, values in [(0x34, control['motion']['velocity']),
                               (0x4c, control['appearance']['angles']),
                               (0x10, control['appearance']['scale']),
                               (0x78, control['appearance']['color'])]:
            machine.mem_write(CONTROL + offset, struct.pack('<' + 'f' * len(values), *values))
        for register, value in [(UC_X86_REG_EBP, FRAME), (UC_X86_REG_EBX, CONTROL),
                                (UC_X86_REG_ESI, OBJECT), (UC_X86_REG_ESP, STACK),
                                (UC_X86_REG_FPCW, precision)]:
            machine.reg_write(register, value)
        machine.emu_start(0x482b24, 0x482c7d, count=20000)
        length = uint(CONTAINER + 0x10)
        assert length == count
        expected = struct.pack('<19fI', *control['motion']['position'], 0, 0, 0,
                               *control['motion']['velocity'], *control['appearance']['angles'],
                               *control['appearance']['scale'], *control['appearance']['color'], 3)
        for index in range(length):
            assert bytes(machine.mem_read(ITEMS + index * 80, 80)) == expected
        initializations.append({'node': control['node'], 'modifier': control['modifier'],
                                'precision': hex(precision), 'count': length, 'state': expected.hex()})
        machine.mem_write(CONTAINER + 0xc, struct.pack('<II', 0, count))
        for index in range(CAPACITY):
            machine.mem_write(ITEMS + index * 80, initial)
        steps = []
        deltas = [0, interval / 2, interval / 2, interval * 3, 0, interval / 4]
        # Disabled source controls still exercise collapse of an existing trail.
        if not enabled:
            machine.mem_write(CONTAINER + 0x10, struct.pack('<I', 4))
        for step, delta in enumerate(deltas):
            current = bytes((value + step + 1) % 256 for value in range(80))
            machine.mem_write(FRAME + 0xc, current)
            machine.mem_write(FRAME + 0x68, struct.pack('<I', CONTAINER))
            machine.mem_write(FRAME + 0x7c, struct.pack('<f', delta))
            machine.reg_write(UC_X86_REG_EBP, FRAME)
            machine.reg_write(UC_X86_REG_EBX, CONTROL)
            machine.reg_write(UC_X86_REG_ESI, OBJECT)
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_FPCW, precision)
            machine.emu_start(0x483161, 0x483212, count=10000)
            first, length = uint(CONTAINER + 0xc), uint(CONTAINER + 0x10)
            entries = [bytes(machine.mem_read(ITEMS + ((first + index) % CAPACITY) * 80, 80)).hex()
                       for index in range(length)]
            steps.append({'delta': delta, 'current': current.hex(), 'entries': entries,
                          'elapsed': struct.unpack('<f', machine.mem_read(OBJECT + 0x78, 4))[0]})
        rows.append({'node': control['node'], 'modifier': control['modifier'],
                     'precision': hex(precision), 'config': config, 'initial': initial.hex(),
                     'initialCount': count if enabled else 4, 'steps': steps})
(ROOT / 'recovery/output/effect-trail-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows,
    'initializations': initializations}) + '\n')
print(f'PASS: {len(rows)} native trail histories, {len(rows) * 6} sample/copy/crop updates')
