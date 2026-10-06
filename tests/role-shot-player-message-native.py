"""Execute original shot-player wire decoding and numeric-display receiver."""
import json
import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
OWNER, SOURCE, TARGET, SOURCE_RECORD, TARGET_RECORD, PACKET, STREAM, BUFFER, ACTOR = [
    0x2001000 + index * 0x1000 for index in range(9)]
STACK, STOP, ALLOCATOR = 0x2010000, 0x2011000, 0x2012000
trace, record_writes = [], []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x4138e8:
        assert read(stack + 4) == 0x30
        finish(PACKET, 4)
    elif address == 0x48a226:
        assert machine.reg_read(UC_X86_REG_ECX) == OWNER
        identity = read(stack + 4)
        assert identity in (77, 88)
        finish(SOURCE if identity == 77 else TARGET, 4)
    elif address == 0x465057:
        assert machine.reg_read(UC_X86_REG_ECX) == ACTOR
        finish()
    elif address == 0x57c0d6:
        destination, capacity, pattern = [read(stack + offset) for offset in (4, 8, 12)]
        value = struct.unpack('<i', machine.mem_read(stack + 16, 4))[0]
        text_format = bytes(machine.mem_read(pattern, 8)).split(b'\0')[0].decode('ascii')
        assert capacity == 32 and text_format in ('%d', '+%d')
        text = text_format % value
        machine.mem_write(destination, text.encode() + b'\0')
        finish(len(text))
    elif address == 0x466d09:
        assert machine.reg_read(UC_X86_REG_ECX) == ACTOR
        text = bytes(machine.mem_read(read(stack + 4), 32)).split(b'\0')[0].decode()
        trace.append({'text': text, 'selector': read(stack + 8)})
        finish(pop=8)


def watch(machine, access, address, size, value, data):
    if any(address < record + 0x140 and address + size > record
           for record in (SOURCE_RECORD, TARGET_RECORD)):
        record_writes.append({'pc': hex(machine.reg_read(UC_X86_REG_EIP)),
                              'address': hex(address), 'size': size, 'value': value})


for address in (0x4138e8, 0x48a226, 0x465057, 0x57c0d6, 0x466d09):
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)


def call(address, this, *args):
    write(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)


write(0x630a28, ALLOCATOR)
uc.mem_write(PACKET, b'\xaa' * 0x30)
assert call(0x42cdec, 0) == PACKET
assert read(PACKET) == 0x5c3d30
assert bytes(uc.mem_read(PACKET + 0xc, 0x24)) == b'\xaa' * 0x24
assert call(0x42d00f, PACKET) == 0x3aa3

write(SOURCE, 0x5c2c28)
write(TARGET, 0x5c2c28)
write(SOURCE + 0x2a0, SOURCE_RECORD)
write(TARGET + 0x2a0, TARGET_RECORD)
write(TARGET + 0x310, ACTOR)
write(OWNER + 0x3c, 0)
write(OWNER + 0x80, 0)
write(OWNER + 0xe0, 0)
uc.mem_write(SOURCE_RECORD, bytes(0x140))
uc.mem_write(TARGET_RECORD, bytes(0x140))
write(SOURCE_RECORD + 0x54, 700, 700)
write(TARGET_RECORD + 0x54, 655, 700)

numeric_fields = [(0xc, 32), (0x10, 32), (0x18, 16), (0x20, 16), (0x28, 16), (0x24, 6)]
flag_fields = [0x14, 0x15, 0x1c, 0x2c]
rows = []
for alignment in range(8):
    for critical in (0, 1, 2, 255):
        values = [77, 88, 0xfedcba98, 43, 0x12345678, 0xffffffff]
        flags = [critical, 0, 0, 0]
        uc.mem_write(PACKET + 0xc, b'\xaa' * 0x24)
        for (offset, width), value in zip(numeric_fields, values):
            write(PACKET + offset, value)
        for offset, value in zip(flag_fields, flags):
            uc.mem_write(PACKET + offset, bytes([value]))
        uc.mem_write(BUFFER, bytes(32))
        write(STREAM, alignment, 0, BUFFER, 32)
        call(0x42ce56, PACKET, STREAM)
        payload = bytes(uc.mem_read(BUFFER, (alignment + 122 + 7) // 8))
        expected, cursor = 0, alignment
        for (offset, width), value in zip(numeric_fields, values):
            expected |= (value & ((1 << width) - 1)) << cursor
            cursor += width
        for flag in flags:
            expected |= int(flag != 0) << cursor
            cursor += 1
        assert cursor == alignment + 122
        assert int.from_bytes(payload, 'little') == expected
        uc.mem_write(PACKET + 0xc, b'\xaa' * 0x24)
        write(STREAM, alignment, 0, BUFFER, 32)
        call(0x42cf39, PACKET, STREAM)
        assert read(STREAM) + read(STREAM + 4) * 8 == cursor
        for (offset, width), value in zip(numeric_fields, values):
            assert read(PACKET + offset) == value & ((1 << width) - 1)
        assert bytes(uc.mem_read(PACKET + 0x14, 2)) == bytes([int(critical != 0), 0])
        trace.clear()
        record_writes.clear()
        before = [bytes(uc.mem_read(record, 0x140)) for record in (SOURCE_RECORD, TARGET_RECORD)]
        call(0x424614, OWNER, PACKET, 0, 0)
        assert trace == [{'text': '-43', 'selector': 2 if critical else 1}]
        assert not record_writes
        assert before == [bytes(uc.mem_read(record, 0x140)) for record in (SOURCE_RECORD, TARGET_RECORD)]
        rows.append({'alignment': alignment, 'inputCriticalByte': critical,
                     'decodedCriticalByte': int(critical != 0), 'payload': payload.hex(),
                     'bits': 122, 'numericFields': {hex(offset): read(PACKET + offset)
                                                    for offset, _ in numeric_fields},
                     'display': list(trace), 'roleRecordWrites': list(record_writes)})

pe = images['cdtank.exe']
cs = Cs(CS_ARCH_X86, CS_MODE_32)
source = [{'entry': hex(a), 'instructions': [{'address': hex(i.address),
    'bytes': i.bytes.hex(), 'instruction': f'{i.mnemonic} {i.op_str}'.strip()}
    for i in cs.disasm(pe.get_data(a - 0x400000, z - a), a)]}
    for a, z in ((0x42cdec, 0x42ce56), (0x42ce56, 0x42d015),
                 (0x424614, 0x4247a8), (0x422877, 0x42292f))]
result = {'status': 'PASS_ORIGINAL_SHOT_PLAYER_WIRE_CRITICAL_DISPLAY_NO_HP_WRITE',
          'messageType': '0x3aa3', 'listener': 'UMsgPrNotifyShotPlayer',
          'factory': '0x42cdec', 'reader': '0x42cf39', 'writer': '0x42ce56',
          'bodyBits': 122, 'rows': rows, 'source': source,
          'scope': 'Original factory, LSB-first codecs and full424614 observer-side receiver execute. '
                   'Role-ID lookup, actor bookkeeping, CRT formatting and final visual enqueue supplied. '
                   'Real role integer getter executes; both role records monitored for all writes. '
                   'Flags15/1c/2c are false, current local firing role absent. '
                   'No live client/server execution or authoritative damage/probability/multiplier claim.'}
(ROOT / 'recovery/output/role-shot-player-message-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {len(rows)} original shot-player codec and critical display receiver conditions')
