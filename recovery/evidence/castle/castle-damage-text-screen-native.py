"""Execute original normalized screen coordinates to integer viewport pixels."""
import json
import struct
import sys
from pathlib import Path
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
u, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/msvcr71.dll'])
u.mem_map(0x2000000, 0x10000)
STACK, STOP = 0x2001000, 0x2002000
rows = []
for width, height in [(800, 600), (1920, 1080), (3840, 2160)]:
    u.mem_write(0x635824, struct.pack('<2I', width, height))
    for x, y in [(-1, 1), (0, 0), (1, -1), (0.123, -0.217), (-1.5, 1.5)]:
        result = []
        for entry, value in [(0x44ef2c, x), (0x44ef47, y)]:
            u.mem_write(STACK, struct.pack('<If', STOP, value))
            u.reg_write(UC_X86_REG_ESP, STACK)
            u.reg_write(UC_X86_REG_FPCW, 0x27f)
            u.emu_start(entry, STOP, count=10000)
            assert u.reg_read(UC_X86_REG_EIP) == STOP
            raw = u.reg_read(UC_X86_REG_EAX)
            result.append(raw if raw < 0x80000000 else raw - 0x100000000)
        xf, yf = [struct.unpack('<f', struct.pack('<f', v))[0] for v in [x, y]]
        expected = [int((xf + 1) * width * .5), int((1 - yf) * height * .5)]
        assert result == expected, (result, expected)
        rows.append(dict(viewport=[width, height], normalized=[x, y], screen=result))
output = dict(status='PASS_ORIGINAL_SCREEN_CONVERSION_ONLY', entries=['44ef2c', '44ef47'],
    rows=rows, conversion='truncate((x+1)*width*0.5), truncate((1-y)*height*0.5)',
    scope='Original screen conversion plus actual CRT integer conversion; normalized projection and Web camera matrix are external providers.')
(ROOT / 'recovery/output/castle-damage-text-screen-native.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS original Castle screen conversion: 15 viewport vectors')
