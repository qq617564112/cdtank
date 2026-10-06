"""Execute433466 prerequisite prefix and actual early return without attribute writes."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
ROLE, SOURCE, STACK, RETURN = 0x2001000, 0x2002000, 0x2010000, 0x2011000
names = ['base', 'equipment', 'skills', 'items', 'itemResolver', 'tank', 'pet']
messages = {0x5c4718: 'base', 0x5c4700: 'equipment', 0x5c46e4: 'skills', 0x5c46c8: 'items',
            0x5c4694: 'itemResolver', 0x5c467c: 'tank', 0x5c4660: 'pet'}
missing = None


def diagnostic(machine, address, size, data):
    global missing
    stack = machine.reg_read(UC_X86_REG_ESP)
    arguments = struct.unpack('<6I', uc.mem_read(stack, 24))
    missing = messages[arguments[5]]
    machine.reg_write(UC_X86_REG_EIP, arguments[0])
    machine.reg_write(UC_X86_REG_ESP, stack + 4)


uc.hook_add(UC_HOOK_CODE, diagnostic, begin=0x40bd28, end=0x40bd28)
rows = []
for flags in range(128):
    present = [bool(flags & (1 << bit)) for bit in range(7)]
    uc.mem_write(ROLE, b'\xaa' * 0x400)
    uc.mem_write(SOURCE, b'\xbb' * 0x400)
    uc.mem_write(ROLE + 0x2a0, struct.pack('<I', SOURCE))
    uc.mem_write(ROLE + 0x2a8, struct.pack('<I', SOURCE if present[5] else 0))
    uc.mem_write(ROLE + 0x2a4, struct.pack('<I', SOURCE if present[6] else 0))
    before = bytes(uc.mem_read(ROLE, 0x400))
    before_source = bytes(uc.mem_read(SOURCE, 0x400))
    uc.mem_write(STACK, struct.pack('<6I', RETURN, *[SOURCE if value else 0 for value in present[:5]]))
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, ROLE)
    missing = None
    uc.emu_start(0x433466, 0x4334e8 if all(present) else RETURN, count=500)
    assert bytes(uc.mem_read(ROLE, 0x400)) == before
    assert bytes(uc.mem_read(SOURCE, 0x400)) == before_source
    assert missing == next((name for name, value in zip(names, present) if not value), None)
    if not all(present):
        assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 24
    rows.append(dict(present=dict(zip(names, present)), missing=missing))
(ROOT / 'recovery/output/role-recompute-readiness-native.json').write_text(json.dumps(dict(status='PASS', rows=rows,
    scope='Actual433466 prerequisite prefix; missing sources execute early ret20 with diagnostic boundary supplied. '
          'All-present case stops before initialization; role and referenced record bytes remain unchanged.'), indent=2)+'\n')
print(f'PASS: {len(rows)} original ordered prerequisite gates and no-write early returns')
