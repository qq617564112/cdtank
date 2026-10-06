"""Execute original moving turret pivot correction and its gbengine matrix helpers."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_EDI, UC_X86_REG_EBX, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x40000)
OBJECT, FRAME, STACK = 0x2010000, 0x2020000, 0x2008000
rows = []
for pivot in [[0, 0], [3.25, -7.5], [-11.5, 4.25]]:
    for yaw in [0, 90, -37.5]:
        for turret_yaw in [0, 90, -30, 123]:
            for up in [[0, 1, 0], [.6, .8, 0], [0, .8, .6], [.36, .8, .48]]:
                machine.mem_write(OBJECT, bytes(0x400))
                machine.mem_write(OBJECT + 0x10, struct.pack('<3f', *up))
                machine.mem_write(OBJECT + 0xbc, struct.pack('<f', yaw))
                machine.mem_write(OBJECT + 0x34c, struct.pack('<f', turret_yaw))
                machine.mem_write(OBJECT + 0x2fc, struct.pack('<3f', pivot[0], 0, pivot[1]))
                for register, value in [(UC_X86_REG_EBP, FRAME), (UC_X86_REG_ESI, OBJECT),
                                        (UC_X86_REG_EDI, OBJECT + 0xbc), (UC_X86_REG_EBX, OBJECT + 0x34c),
                                        (UC_X86_REG_ECX, FRAME - 0x70), (UC_X86_REG_ESP, STACK),
                                        (UC_X86_REG_FPCW, 0x27f)]:
                    machine.reg_write(register, value)
                machine.emu_start(0x46cb49, 0x46cc19, count=30000)
                correction = list(struct.unpack('<3f', machine.mem_read(OBJECT + 0x368, 12)))
                matrix = list(struct.unpack('<16f', machine.mem_read(FRAME - 0x70, 64)))
                rows.append(dict(pivot=pivot, up=up, yaw=yaw, turretYaw=turret_yaw, correction=correction, matrix=matrix))
(ROOT / 'recovery/output/effect-turret-pivot-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print(f'PASS: {len(rows)} original turret pivot quaternion/matrix/axis rotation compositions')
