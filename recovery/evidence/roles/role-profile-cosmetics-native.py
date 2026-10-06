"""Execute profile scalar44 and array1 virtual getters/setters without stubs."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
PROFILE, ARRAY, STACK, RETURN = 0x2001000, 0x2002000, 0x2003000, 0x2004000

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))
def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]
def run(virtual_offset, *args):
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ECX, PROFILE)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(read(0x5c4118 + virtual_offset), RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)
rows = []
for seed in range(16):
    for kind in ['skin', 'mark']:
        uc.mem_write(PROFILE, bytes((i * 7 + seed) & 255 for i in range(0x170)))
        write(PROFILE, 0x5c4118)
        before = bytes(uc.mem_read(PROFILE, 0x170))
        skin = run(0x18, 44)
        mark_pointer = run(0x20, 1)
        assert skin == read(PROFILE + 0x118) and mark_pointer == PROFILE + 0x13c
        marks = list(struct.unpack('<3I', uc.mem_read(mark_pointer, 12)))
        value = (seed * 0x1000000 + 0xf1234567) & 0xffffffff
        expected = bytearray(before)
        struct.pack_into('<I', expected, 0x118 if kind == 'skin' else 0x13c, value)
        if kind == 'skin':
            assert run(0x30, 44, value) & 255 == 1
        else:
            # The real selector1 setter copies three words. Supply preserved trailing words.
            write(ARRAY, value, *marks[1:])
            assert run(0x38, 1, ARRAY) & 255 == 1
        after = bytes(uc.mem_read(PROFILE, 0x170))
        assert after == expected
        assert run(0x18, 44) == (value if kind == 'skin' else skin)
        assert read(run(0x20, 1)) == (value if kind == 'mark' else marks[0])
        rows.append(dict(kind=kind, value=value, before=list(before), after=list(after),
                         skinInstanceId=skin, markInstanceId=marks[0]))
(ROOT / 'recovery/output/role-profile-cosmetics-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows,
    scope='Full native virtual scalar getter42fdc5/setter42fdea selector44 through42029e/420551; array getter42fe3f/setter42fe47 selector1 through4208b7/420916. Scalar payload118, array payload13c three DWORDs; first-word update supplies preserved trailing words. No qualification or successful network operation inferred.'), indent=2) + '\n')
print('PASS: 32 native cosmetic profile getters/setters and exact byte preservation')
