"""Execute native channel conversion helper and trail alpha arithmetic."""
from hashlib import sha256
import json
from pathlib import Path
import struct

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x20000)
FRAME, STATE, STACK = 0x2009000, 0x2010000, 0x2008000


def run(start, end, precision):
    machine.reg_write(UC_X86_REG_EBP, FRAME)
    machine.reg_write(UC_X86_REG_ESI, STATE)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_FPCW, precision)
    machine.emu_start(start, end, count=2000)


def pack(color, precision):
    machine.mem_write(STATE + 0x3c, struct.pack('<4f', *color))
    channels = []
    # Each original block loads through EAX, multiplies and calls original ftol.
    for start, end in [(0x481f12, 0x481f20), (0x481f2b, 0x481f39),
                       (0x481f44, 0x481f52), (0x481ef7, 0x481f05)]:
        machine.reg_write(UC_X86_REG_EAX, STATE)
        run(start, end, precision)
        channels.append(machine.reg_read(UC_X86_REG_EAX) & 255)
    return channels[3] << 24 | channels[0] << 16 | channels[1] << 8 | channels[2]


def trail(packed, index, count, precision):
    machine.mem_write(STATE + 0x74, struct.pack('<I', count))
    machine.mem_write(FRAME + 8, struct.pack('<i', index))
    machine.mem_write(FRAME - 0x45, bytes([packed >> 24]))
    run(0x481f60, 0x481f87, precision)
    return int.from_bytes(machine.mem_read(FRAME - 0x45, 1), 'little') << 24 | packed & 0xffffff


library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
colors = [c['appearance']['color'] for c in library['spriteControls']]
colors += [[.5, .25, .75, 1], [1 / 255, 2 / 255, 254 / 255, .3],
           [-.5, 1.5, 2, -1], [0, 0, 0, 0], [1, 1, 1, 1]]
rows, trails = [], []
for precision in [0x27f, 0x37f]:
    for color in colors:
        rows.append({'color': color, 'precision': hex(precision), 'packed': pack(color, precision)})
    for count in [1, 2, 3, 4, 7, 16, 100, 0x80000000, 0xffffffff]:
        for index in sorted({0, 1, min(count - 1, 0x7fffffff), min(count, 0x7fffffff)}):
            for packed in [0xffffffff, 0x80abcdef, 0x00ff00ff]:
                trails.append({'packed': packed, 'index': index, 'count': count,
                               'precision': hex(precision), 'result': trail(packed, index, count, precision)})
out = ROOT / 'recovery/output/effect-color-native.json'
out.write_text(json.dumps({'exeSha256': sha256(exe.read_bytes()).hexdigest(),
                           'rows': rows, 'trails': trails}) + '\n')
print(f'PASS: native diffuse truncation {len(rows)} cases and trail alpha {len(trails)} cases')
