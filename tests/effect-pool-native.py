"""Execute original forward packed-array lifetime loop and tail replacement."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32, UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP
ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x20000)
OBJECT, PARTICLES, STACK, STOP = 0x2010000, 0x2011000, 0x2008000, 0x201f000
updated = []


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def finish(pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x579b60:
        destination, source, length = uint(stack + 4), uint(stack + 8), uint(stack + 12)
        uc.mem_write(destination, bytes(uc.mem_read(source, length)))
        finish(0)
    elif address == 0x48032c:
        state = uint(stack + 4)
        updated.append(uint(state + 8))
        uc.mem_write(state + 0x60, struct.pack('<I', uint(state + 0x60) + 1))
        finish(8)


machine.hook_add(UC_HOOK_CODE, hook)
rows = []
for lifetimes in [[0], [.1], [0, 0, 0], [0, 1, 2], [.1, .1, 1, 2], [1, .1, 2, .1],
                  [.02, .04, .06, .08, .1], [0, 0, 1, 1]]:
    for initial_age in [0, .025]:
        machine.mem_write(OBJECT, bytes(0x100))
        machine.mem_write(OBJECT + 0x40, struct.pack('<I', PARTICLES))
        machine.mem_write(OBJECT + 0x54, struct.pack('<I', len(lifetimes)))
        initial = []
        for index, lifetime in enumerate(lifetimes):
            raw = bytearray(100)
            struct.pack_into('<IfI', raw, 0, index % 2, initial_age, index)
            struct.pack_into('<f', raw, 0x44, lifetime)
            machine.mem_write(PARTICLES + index * 100, bytes(raw))
            initial.append({'id': index, 'visible': bool(index % 2),
                            'age': struct.unpack('<f', struct.pack('<f', initial_age))[0],
                            'lifetime': struct.unpack('<f', struct.pack('<f', lifetime))[0], 'updates': 0})
        steps = []
        for delta in [0, .025, .025, .1, 0, 1, 1, 0]:
            updated.clear()
            machine.mem_write(STACK, struct.pack('<If', STOP, delta))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.emu_start(0x480857, STOP, count=10000)
            states = []
            for index in range(uint(OBJECT + 0x54)):
                address = PARTICLES + index * 100
                states.append({'id': uint(address + 8), 'visible': bool(uint(address)),
                               'age': struct.unpack('<f', machine.mem_read(address + 4, 4))[0],
                               'lifetime': struct.unpack('<f', machine.mem_read(address + 0x44, 4))[0],
                               'updates': uint(address + 0x60)})
            steps.append({'delta': delta, 'updated': list(updated), 'states': states})
        rows.append({'initial': initial, 'steps': steps})
(ROOT / 'recovery/output/effect-pool-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} packed particle pools / {len(rows) * 8} native lifetime loops')
