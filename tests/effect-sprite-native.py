"""Execute original sprite arithmetic in x86; omit external transform branches."""
from hashlib import sha256
import json
from pathlib import Path
import struct

import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
assert pe.OPTIONAL_HEADER.ImageBase == 0x400000
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x20000)
FRAME, CONTROL, STACK = 0x2009000, 0x2010000, 0x2008000


def write(address, values):
    machine.mem_write(address, struct.pack('<' + 'f' * len(values), *values))


def read(address, count):
    return list(struct.unpack('<' + 'f' * count, machine.mem_read(address, count * 4)))


def run(start, end):
    machine.reg_write(UC_X86_REG_EBP, FRAME)
    machine.reg_write(UC_X86_REG_EBX, CONTROL)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.emu_start(start, end, count=2000)


def original_step(control, delta, precision):
    appearance, motion = control['appearance'], control['motion']
    machine.reg_write(UC_X86_REG_FPCW, precision)
    write(FRAME + 0x7c, [delta])
    # Scale and angles use the original vector helper 0x422d4d.
    write(FRAME + 0x3c, appearance['scale'])
    write(CONTROL + 0x1c, appearance['scaleRate'])
    # The full update loads delta into ST(0) before resolving the controller.
    run(0x482e08, 0x482e0b)
    run(0x482e22, 0x482e53)
    write(FRAME + 0x30, appearance['angles'])
    write(CONTROL + 0x58, appearance['angleRate'])
    run(0x482fbb, 0x482fec)
    write(FRAME + 0x48, appearance['color'])
    write(CONTROL + 0x88, appearance['colorSubtractRate'])
    run(0x483039, 0x4830e1)
    result = {'scale': read(FRAME + 0x3c, 3), 'angles': read(FRAME + 0x30, 3),
              'color': read(FRAME + 0x48, 4)}
    # Acceleration is already transformed before this arithmetic block starts.
    write(FRAME - 0xc, motion['acceleration'])
    write(FRAME + 0x24, motion['velocity'])
    write(FRAME + 0xc, motion['position'])
    run(0x482ede, 0x482f41)
    return result, {'position': read(FRAME + 0xc, 3), 'velocity': read(FRAME + 0x24, 3)}


library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
rows = []
# The client's process-wide x87 control word is not yet recovered: verify both
# 53-bit and 64-bit significands rather than assuming either initialization.
for control in library['spriteControls']:
    for precision in [0x27f, 0x37f]:
        for delta in ([.016, .25] if control['node'] == 2431 else [.016]):
            appearance, motion = original_step(control, delta, precision)
            rows.append({'node': control['node'], 'modifier': control['modifier'],
                         'delta': delta, 'precision': hex(precision),
                         'appearance': appearance, 'motion': motion})
out = ROOT / 'recovery/output/effect-sprite-native.json'
out.write_text(json.dumps({'exeSha256': sha256(exe.read_bytes()).hexdigest(),
                           'rows': rows}, separators=(',', ':')) + '\n')
print(f'PASS: executed original x86 sprite arithmetic for {len(rows)} source/precision cases')
