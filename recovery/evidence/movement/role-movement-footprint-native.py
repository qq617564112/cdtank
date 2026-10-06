"""Execute complete original role constructor and source matrix constructor."""
from pathlib import Path
import json
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0, 4096); uc.mem_map(0x2000000, 0x20000)
ROLE, STACK, STOP = 0x2001000, 0x2010000, 0x2011000
engine = images['gbengine.dll']
imports = [symbol for entry in engine.DIRECTORY_ENTRY_IMPORT for symbol in entry.imports
    if symbol.address == 0x1003f2d0]
assert len(imports) == 1 and imports[0].name == b'memcpy'
uc.mem_write(0x1003f2d0, struct.pack('<I', 0x2012000))
copy_calls = []
def copy(machine, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    ret, dest, source, count = struct.unpack('<4I', uc.mem_read(stack, 16))
    assert dest == ROLE + 0x2b8 and count == 64
    uc.mem_write(dest, bytes(uc.mem_read(source, count)))
    copy_calls.append(dict(destination=dest, source=source, count=count))
    uc.reg_write(UC_X86_REG_EAX, dest)
    uc.reg_write(UC_X86_REG_ESP, stack + 4); uc.reg_write(UC_X86_REG_EIP, ret)
uc.hook_add(UC_HOOK_CODE, copy, begin=0x2012000, end=0x2012000)
rows = []
identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
for entry in [0x431bcf, 0x42275e]:
    for fill in [0, 0x55, 0xaa, 0xff]:
        uc.mem_write(ROLE, bytes([fill]) * 0x400)
        uc.mem_write(STACK, struct.pack('<I', STOP))
        uc.reg_write(UC_X86_REG_ESP, STACK); uc.reg_write(UC_X86_REG_ECX, ROLE)
        uc.emu_start(entry, STOP, count=10000)
        assert uc.reg_read(UC_X86_REG_EIP) == STOP
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4
        assert uc.reg_read(UC_X86_REG_EAX) == ROLE
        matrix = list(struct.unpack('<16f', uc.mem_read(ROLE + 0x2b8, 64)))
        dimensions = list(struct.unpack('<3f', uc.mem_read(ROLE + 0x2f8, 12)))
        assert matrix == identity and dimensions == [49, 24, 52]
        assert struct.unpack('<I', uc.mem_read(ROLE, 4))[0] == (0x5c41b8 if entry == 0x431bcf else 0x5c2c28)
        assert bytes(uc.mem_read(ROLE + 0x2a0, 12)) == bytes(12)
        assert bytes(uc.mem_read(ROLE + 0x28c, 12)) == bytes(12)
        rows.append(dict(entry=hex(entry), fill=fill, matrix=matrix, dimensions=dimensions))
assert len(copy_calls) == 8
(ROOT / 'recovery/output/movement-footprint-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows, memcpy=copy_calls,
    scope='Complete431bcf/42275e and gbengine matrix constructor10031f30. CRT memcpy supplied. '
        'Initial dimensions only; later tank-specific assignment, matrix aliases and size changes not proven.'), indent=2) + '\n')
print('PASS: 8 complete original base/network role constructors, matrix identity and footprint49/24/52 independent of prior memory')
