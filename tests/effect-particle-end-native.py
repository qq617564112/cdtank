"""Execute original type6 end callback that clears active particles/emission state."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x10000)
OBJECT, STACK, STOP = 0x2001000, 0x2008000, 0x200f000
rows = []
for count in [0, 1, 150]:
    for fraction in [0, .375, .999]:
        for burst in [0, 1]:
            machine.mem_write(OBJECT, bytes(0x100))
            machine.mem_write(OBJECT + 0x54, struct.pack('<If', count, 0))
            machine.mem_write(OBJECT + 0x5c, struct.pack('<f', fraction))
            machine.mem_write(OBJECT + 0x7c, bytes([burst]))
            machine.mem_write(STACK, struct.pack('<I', STOP))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.emu_start(0x47fbc9, STOP, count=100)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
            result = dict(count=struct.unpack('<I', machine.mem_read(OBJECT + 0x54, 4))[0],
                fraction=struct.unpack('<f', machine.mem_read(OBJECT + 0x5c, 4))[0],
                burst=bool(machine.mem_read(OBJECT + 0x7c, 1)[0]))
            assert result == dict(count=0, fraction=0, burst=True)
            rows.append(dict(count=count, fraction=fraction, burst=burst, result=result))
(ROOT / 'recovery/output/effect-particle-end-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print(f'PASS: {len(rows)} original type6 end callbacks')
