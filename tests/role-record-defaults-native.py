"""Execute original numeric OdlPlayer initialization and role counter constructor."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_ESI, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
RECORD, ROLE, STACK, RETURN = 0x2001000, 0x2002000, 0x2003000, 0x2004000
offsets = [0xc, 0x10, 0x14, 0x34, 0x38, 0x3c, 0x40, 0x44, 0x48, 0x4c,
           0x50, 0x54, 0x58, 0x5c, 0x60, 0x64, 0x68, 0x6c, 0x70, 0x74,
           0x78, 0x7c, 0x80, 0x84, 0x88, 0x8c, 0x90]
rows = []
for fill in [0, 0x55, 0xaa, 0xff]:
    uc.mem_write(RECORD, bytes([fill]) * 0x140)
    uc.reg_write(UC_X86_REG_ESI, RECORD)
    uc.reg_write(UC_X86_REG_EAX, 1)
    uc.reg_write(UC_X86_REG_EBX, 0)
    uc.emu_start(0x523333, 0x52339b, count=100)
    fields = {str(offset): (uc.mem_read(RECORD + offset, 1)[0] if offset in [0x34, 0x50]
              else struct.unpack('<I', uc.mem_read(RECORD + offset, 4))[0]) for offset in offsets}
    assert fields['16'] == 1 and fields['60'] == 1 and fields['64'] == 2001
    assert bytes(uc.mem_read(RECORD + 0x94, 0x40)) == bytes([fill]) * 0x40
    uc.mem_write(ROLE, bytes([fill]) * 0x370)
    uc.mem_write(STACK, struct.pack('<I', RETURN))
    uc.reg_write(UC_X86_REG_ECX, ROLE + 4)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x41d7a6, RETURN, count=100)
    assert struct.unpack('<I', uc.mem_read(ROLE + 0x24, 4))[0] == 0
    # Both actual base and network signed getters9 route to role+24 when a record exists.
    uc.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD))
    getters = []
    for entry in [0x432417, 0x422b64]:
        uc.mem_write(STACK, struct.pack('<2I', RETURN, 9))
        uc.reg_write(UC_X86_REG_ECX, ROLE)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.emu_start(entry, RETURN, count=100)
        getters.append(uc.reg_read(UC_X86_REG_EAX))
    assert getters == [0, 0]
    rows.append(dict(fill=fill, fields=fields, counter=0, getters=getters))
scales = {key: struct.unpack('<f', uc.mem_read(address, 4))[0]
          for key, address in [('move', 0x61e494), ('turn', 0x61e498)]}
(ROOT / 'recovery/output/role-record-defaults-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows, scales=scales,
    scope='Actual523333–52339b numeric initialization with constructor-inlet registers supplied; arrays/string/base metadata initialization excluded. Full41d7a6/41d76e counters and real base/network getter9 execute without stubs. Static EXE scale bytes read, later indirect global writes not ruled out.'), indent=2) + '\n')
print('PASS: four initial memory fills,27 original numeric defaults, counter construction/base+network getters and static scale bytes')
