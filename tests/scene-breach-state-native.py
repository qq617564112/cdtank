"""Original Breach destroy/fade execution; rendering and teardown are callbacks.

Calls execute original 45e7b0 and 45e6c4. Renderer methods, common update and
462846/462934 navigation teardown are substitutes, explicitly logged below.
"""
from hashlib import sha256
import json
from pathlib import Path
import struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
uc = Uc(UC_ARCH_X86, UC_MODE_32)
uc.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
uc.mem_write(0x400000, pe.get_memory_mapped_image())
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x20000)
OBJ, VISUAL, VTABLE, STUB, STACK, STOP = 0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2008000, 0x201f000
events = []


def uint(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(pop):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EIP, uint(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, user):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x461de5:
        finish(4)
    elif address == STUB:
        events.append({'type': 'visualUpdate'})
        finish(0)
    elif address == STUB + 4:
        events.append({'type': 'blend', 'mode': uint(stack + 4),
                       'alpha': struct.unpack('<f', machine.mem_read(stack + 8, 4))[0]})
        finish(8)
    elif address == STUB + 8:
        events.append({'type': 'priority', 'value': struct.unpack('<i', machine.mem_read(stack + 4, 4))[0]})
        finish(4)
    elif address in [0x462846, 0x462934]:
        events.append({'type': 'navigationCallback', 'address': hex(address)})
        finish(0 if address == 0x462846 else 4)


uc.hook_add(UC_HOOK_CODE, hook)
uc.mem_write(0x5c0afc, struct.pack('<I', STUB + 4))
uc.mem_write(0x5c0af0, struct.pack('<I', STUB + 8))
rows = []
sequences = [[0, 1, 1, 0, .001], [.1] * 22, [.5, .5, .5, .5, .00001], [3], [1 / 60] * 123]
for deltas in sequences:
    uc.mem_write(OBJ, bytes(0x200))
    uc.mem_write(OBJ, struct.pack('<I', 0x5c7450))
    uc.mem_write(OBJ + 0xe0, struct.pack('<I', VISUAL))
    uc.mem_write(VISUAL, struct.pack('<I', VTABLE))
    uc.mem_write(VTABLE + 0x14, struct.pack('<I', STUB))
    events.clear()

    def call(address, value):
        uc.mem_write(STACK, struct.pack('<II', STOP, value))
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, OBJ)
        uc.emu_start(address, STOP, count=10000)
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8

    call(0x45e7b0, 0)
    assert uc.reg_read(UC_X86_REG_EAX) & 0xff == 1
    call(0x45e7b0, 0)
    assert uc.reg_read(UC_X86_REG_EAX) & 0xff == 0
    steps = []
    for delta in deltas:
        # The parent skips hidden nodes; preserve that external lifecycle contract.
        if not bytes(uc.mem_read(OBJ + 0x74, 1))[0]:
            call(0x45e6c4, struct.unpack('<I', struct.pack('<f', delta))[0])
        steps.append({'delta': delta, 'fading': bool(bytes(uc.mem_read(OBJ + 0xe8, 1))[0]),
                      'hidden': bool(bytes(uc.mem_read(OBJ + 0x74, 1))[0]),
                      'alpha': struct.unpack('<f', uc.mem_read(OBJ + 0xec, 4))[0]})
    rows.append({'steps': steps, 'events': list(events)})
# Boundary: at precisely two seconds alpha is zero and the node remains visible.
assert rows[0]['steps'][2]['alpha'] == 0 and not rows[0]['steps'][2]['hidden']
assert rows[0]['steps'][4]['hidden']
(ROOT / 'recovery/output/scene-breach-state-native.json').write_text(json.dumps({
    'source': str(exe), 'sha256': sha256(exe.read_bytes()).hexdigest(),
    'substitutes': ['render methods', 'common update', 'navigation callbacks'], 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} original Breach destroy/fade sequences, repeat rejection and strict zero boundary')
