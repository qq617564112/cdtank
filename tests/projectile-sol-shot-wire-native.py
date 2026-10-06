"""Execute original shot/before-shot factories, types and complete native codecs."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
PACKET, STREAM, BUFFER, STACK, STOP = [0x2001000 + i * 0x1000 for i in range(5)]
def put(a, *v): uc.mem_write(a, struct.pack('<' + 'I' * len(v), *[n & 0xffffffff for n in v]))
def get(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
allocations = []
def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    allocations.append(get(stack + 4))
    machine.reg_write(UC_X86_REG_EAX, PACKET)
    machine.reg_write(UC_X86_REG_EIP, get(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 8)
uc.hook_add(UC_HOOK_CODE, hook, begin=0x4138e8, end=0x4138e8)
put(0x630a28, 0x2009000)
def run(entry, *args):
    put(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ECX, PACKET)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(entry, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
factories = []
for factory, getter, kind, length, vtable in [(0x42c94a, 0x42c9b4, 'beforeShot', 16, 0x5c3cb8),
                                            (0x42ca44, 0x42cbaf, 'shot', 32, 0x5c3ce0)]:
    for seed in [0xaa, 0x55]:
        uc.mem_write(PACKET, bytes([seed]) * length)
        allocations.clear()
        run(factory)
        assert uc.reg_read(UC_X86_REG_EAX) == PACKET and allocations == [length]
        assert get(PACKET) == vtable
        assert bytes(uc.mem_read(PACKET + 12, 4 if length == 16 else 8)) == bytes([seed]) * (4 if length == 16 else 8)
        if length == 32: assert bytes(uc.mem_read(PACKET + 20, 12)) == bytes(12)
        run(getter)
        message_type = uc.reg_read(UC_X86_REG_EAX)
        assert message_type == (0x3ac7 if kind == 'beforeShot' else 0x3aa2)
        factories.append(dict(kind=kind, seed=seed, length=length, type=message_type, vtable=hex(vtable), body=bytes(uc.mem_read(PACKET + 12, length - 12)).hex()))
rows = []
for kind, writer, reader in [('beforeShot', 0x42571f, 0x425ba6), ('shot', 0x42cadf, 0x42cb4f)]:
    for role_id in [0, 73, 0x80000000, 0xffffffff]:
        for item_id in ([0] if kind == 'beforeShot' else [0, 2001, 0x12345678, 0xffffffff]):
            for xyz in ([[]] if kind == 'beforeShot' else [[0., 0., 0.], [-12.25, 9.75, 1000.125], [1.23456789, -1191.35, 44.]]):
                xyz = [struct.unpack('<f', struct.pack('<f', v))[0] for v in xyz]
                for offset in range(8):
                    uc.mem_write(PACKET + 12, struct.pack('<II3f', role_id, item_id, *xyz) if kind == 'shot' else struct.pack('<I', role_id))
                    uc.mem_write(BUFFER, bytes(32)); put(STREAM, offset, 0, BUFFER, 32)
                    run(writer, STREAM)
                    raw = struct.pack('<3fIH', *xyz, role_id, item_id & 0xffff) if kind == 'shot' else struct.pack('<I', role_id)
                    bits = len(raw) * 8
                    payload = bytes(uc.mem_read(BUFFER, (offset + bits + 7) // 8))
                    assert int.from_bytes(payload, 'little') == int.from_bytes(raw, 'little') << offset
                    uc.mem_write(PACKET + 12, bytes([0xaa]) * (20 if kind == 'shot' else 4)); put(STREAM, offset, 0, BUFFER, 32)
                    run(reader, STREAM)
                    decoded = struct.pack('<II3f', role_id, item_id & 0xffff, *xyz) if kind == 'shot' else struct.pack('<I', role_id)
                    assert bytes(uc.mem_read(PACKET + 12, len(decoded))) == decoded
                    rows.append(dict(kind=kind, roleId=role_id, itemId=item_id, xyz=xyz, offset=offset, payload=payload.hex(), decodedItemId=item_id & 0xffff))
(ROOT / 'recovery/output/projectile-sol-shot-wire-native.json').write_text(json.dumps(dict(status='PASS', factories=factories, rows=rows,
    scope='Full original factories/types/writers/readers. Allocator4138e8 supplied; original402289 constructors and raw bit operations execute. Payload excludes outer message header and socket routing.'), indent=2) + '\n')
print(f'PASS: {len(factories)} factories/types, {len(rows)} original shot/before-shot codec vectors')
