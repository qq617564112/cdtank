"""Execute native billboard math including original CRT sin/cos routines."""
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
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x20000)
FRAME, STATE, STACK = 0x2009000, 0x2010000, 0x2008000
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
cases = [(c['motion']['position'], c['appearance']['scale'], c['appearance']['angles'][2])
         for c in library['spriteControls']]
cases += [([4, 5, 6], [2, 3, 1], angle) for angle in [0, 30, 45, 90, 180, 270, 360, -30]]
rows = []
for precision in [0x27f, 0x37f]:
    for center, scale, angle in cases:
        machine.reg_write(UC_X86_REG_EBP, FRAME)
        machine.reg_write(UC_X86_REG_EBX, STATE)
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_FPCW, precision)
        machine.mem_write(STATE + 0x2c, struct.pack('<f', angle))
        machine.mem_write(FRAME - 0x34, struct.pack('<f', scale[0]))
        machine.mem_write(FRAME - 0x2c, struct.pack('<f', scale[1]))
        machine.mem_write(FRAME - 0x18, struct.pack('<3f', *center))
        machine.emu_start(0x481b62, 0x481c38, count=20000)
        values = struct.unpack('<12f', machine.mem_read(FRAME - 0x88, 48))
        rows.append({'center': center, 'scale': scale, 'angle': angle, 'precision': hex(precision),
                     'corners': [list(values[i:i + 3]) for i in range(0, 12, 3)]})
(ROOT / 'recovery/output/effect-billboard-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} native billboard/CRT sin-cos cases executed')
