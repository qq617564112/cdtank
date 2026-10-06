"""Original item-use writer/reader and real bitstream, without codec stubs."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
PACKET, STREAM, BUFFER = 0x2001000, 0x2002000, 0x2003000
STACK, STOP = 0x2010000, 0x2011000

def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def call(address):
    put(STACK, STOP, STREAM)
    uc.reg_write(UC_X86_REG_ECX, PACKET)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8

rows = []
for instance in [0, 77, 0xffffffff]:
    for field10 in [0, 1, 0x80000000, 0xffffffff]:
        for flag in [0, 1, 2, 255]:
            for alignment in range(8):
                uc.mem_write(PACKET, bytes(32))
                put(PACKET + 12, instance, field10)
                uc.mem_write(PACKET + 20, bytes([flag]))
                uc.mem_write(BUFFER, bytes(32))
                put(STREAM, alignment, 0, BUFFER, 32)
                call(0x43c7f0)
                payload = bytes(uc.mem_read(BUFFER, (alignment + 65 + 7) // 8))
                expected = (instance | (field10 << 32) | (int(flag != 0) << 64)) << alignment
                assert int.from_bytes(payload, 'little') == expected
                uc.mem_write(PACKET + 12, b'\xaa' * 12)
                put(STREAM, alignment, 0, BUFFER, 32)
                call(0x43c83d)
                actual = struct.unpack('<2I', uc.mem_read(PACKET + 12, 8))
                boolean = uc.mem_read(PACKET + 20, 1)[0]
                assert actual == (instance, field10) and boolean == int(flag != 0)
                rows.append(dict(packet=dict(instanceId=instance, field10=field10, field14=bool(flag)),
                                 inputFlag=flag, bitOffset=alignment, payload=payload.hex()))
(ROOT / 'recovery/output/item-use-wire-native.json').write_text(json.dumps(dict(
    scope='Original43c7f0/43c83d and401c7a/401d58. Explicitly supplied fields; no constructor defaults or server semantics inferred.',
    rows=rows), indent=2))
print(f'PASS: {len(rows)} original item-use65-bit packets,8 alignments and boolean normalization')
