"""Execute original movement permission and getters without supplied services."""
from pathlib import Path
import json
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
STACK, STOP, ROLE, RECORD = [0x2001000 + index * 0x1000 for index in range(4)]
rows = []
for present in [False, True]:
    for status in range(4):
        for flags in range(8):
            for command in range(9):
                uc.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD if present else 0))
                uc.mem_write(RECORD + 0x90, struct.pack('<I', status))
                uc.mem_write(RECORD + 0x124, bytes([2 if flags & 1 else 0,
                    255 if flags & 2 else 0, 128 if flags & 4 else 0]))
                uc.mem_write(STACK, struct.pack('<2I', STOP, command))
                uc.reg_write(UC_X86_REG_ESP, STACK); uc.reg_write(UC_X86_REG_ECX, ROLE)
                uc.emu_start(0x432f91, STOP, count=1000)
                actual = uc.reg_read(UC_X86_REG_EAX)
                expected = int(present and status == 2 and not (flags & 1) and (
                    bool(flags & 2) if command in [1, 2] else
                    bool(flags & 4) if command in [3, 4] else (flags & 6) == 6))
                assert actual == expected, (present, status, flags, command, actual, expected)
                assert uc.reg_read(UC_X86_REG_EIP) == STOP
                assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
                rows.append(dict(present=present, status=status, flag8=bool(flags & 1),
                    flag9=bool(flags & 2), flag10=bool(flags & 4), command=command, allowed=bool(actual)))
assert len(rows) == 576
(ROOT / 'recovery/output/movement-permission-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows, scope='Complete432f91/431d92/43293d, no supplied services. '
        'Does not execute controller virtual+40, rendering side effects422bc6 or collision.'), indent=2) + '\n')
print('PASS: 576 original movement permission/status/flag combinations and return-stack assertions')
