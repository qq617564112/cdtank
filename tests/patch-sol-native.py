"""Compare recovered transport decoding to original CPKUpdate instructions."""
import json
import math
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from patch_sol import decode_patch

machine, images = map_original_binaries([ROOT / 'CDTank/CPKUpdate.exe'])
BUFFER, STACK, STOP = 0x2000000, 0x2200000, 0x2210000
machine.mem_map(BUFFER, 0x220000)
# CRT floor boundary returns its result in x87 ST(0).
machine.mem_write(STOP + 16, b'\xdd\x05' + struct.pack('<I', STOP + 32) + b'\xc3')


def return_check(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x444730:
        value = struct.unpack('<d', uc.mem_read(stack + 4, 8))[0]
        uc.mem_write(STOP + 32, struct.pack('<d', math.floor(value)))
        uc.reg_write(UC_X86_REG_EIP, STOP + 16)
        return
    uc.reg_write(UC_X86_REG_EIP, struct.unpack('<I', uc.mem_read(stack, 4))[0])
    uc.reg_write(UC_X86_REG_ESP, stack + 4)


machine.hook_add(UC_HOOK_CODE, return_check, begin=0x43faa0, end=0x43faa0)
machine.hook_add(UC_HOOK_CODE, return_check, begin=0x444730, end=0x444730)
rows = []
path = ROOT / 'CDTank/download/Data/ui/layouts/createroom.xml'
cases = [('createroom.xml', path.read_bytes())]
for size in [0, 1, 4, 7, 8, 9, 10, 11, 12, 16, 32, 52, 104, 212]:
    cases.append((f'word-count-{size // 4}-tail-{size % 4}', bytes((i * 17 + 3) % 256 for i in range(size))))
for name, raw in cases:
    machine.mem_write(BUFFER, raw or b'\0')
    machine.mem_write(STACK, struct.pack('<3I', STOP, BUFFER, len(raw)))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.emu_start(0x438c50, STOP, count=10000000)
    assert machine.reg_read(UC_X86_REG_EIP) == STOP, name
    actual = bytes(machine.mem_read(BUFFER, len(raw)))
    expected = decode_patch(raw)
    assert actual == expected, name
    assert actual[len(raw) // 4 * 4:] == raw[len(raw) // 4 * 4:], name
    rows.append(dict(name=name, bytes=len(raw), wholeWords=len(raw) // 4, untouchedTail=len(raw) % 4))
result = dict(status='PASS', entry='CPKUpdate.exe:0x438c50', algorithm='CPKUpdate.exe:0x43b330',
              originalRoundComputation=True, originalKeyPointer='0x47304c -> 0x46b768', rows=rows,
              boundary='Debug stack checking 0x43faa0 and CRT floor 0x444730 are supplied; decryption, key, x87 round calculation and integer conversion execute original instructions.')
(ROOT / 'recovery/output/patch-sol-native.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(rows)} original decode cases, including complete createroom XML and 0–3 tail bytes')

# Compare each decoded transport file directly with its live installed CPK entry.
import lzokay
archive = (ROOT / 'CDTank/Data/data.cpk').read_bytes()
start, count = struct.unpack_from('<I', archive, 8)[0], struct.unpack_from('<I', archive, 32)[0]
entries = {}
for index in range(count):
    crc, flags, parent, offset, packed, original, extra = struct.unpack_from('<7I', archive, start + index * 28)
    if extra and flags & 1 and not flags & 0x10:
        name = archive[offset + packed:offset + packed + extra].split(b'\0')[0].decode('gbk')
        entries[crc] = dict(index=index, flags=flags, parent=parent, offset=offset, packed=packed, original=original, name=name)


def archive_path(crc):
    item = entries[crc]
    return (archive_path(item['parent']) + '/' if item['parent'] else '') + item['name']


by_path = {archive_path(crc).lower(): item for crc, item in entries.items() if not item['flags'] & 2}
comparisons = []
for path in sorted((ROOT / 'CDTank/download').rglob('*')):
    if not path.is_file():
        continue
    relative = path.relative_to(ROOT / 'CDTank/download').as_posix()
    item = by_path[relative.lower()]
    data = archive[item['offset']:item['offset'] + item['packed']]
    if item['flags'] & 0x20000:
        data = lzokay.decompress(data, item['original'])
    else:
        assert item['flags'] & 0x10000, relative
    assert data == decode_patch(path.read_bytes()), relative
    comparisons.append(dict(path=relative, cpkEntry=item['index'], storageFlags=hex(item['flags']),
                            decodedBytes=len(data), comparison='byte-for-byte-identical'))
result['installedArchive'] = 'CDTank/Data/data.cpk'
result['archiveComparisons'] = comparisons
(ROOT / 'recovery/output/patch-sol-native.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(comparisons)} decoded candidates equal live installed CPK entries byte for byte')

import capstone
pe = images['cpkupdate.exe']
disassembler = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [('insertReadDecode', 0x42d733, 0x42d772),
          ('decodeWholeWords', 0x438c50, 0x438c9b),
          ('xxteaDecode', 0x43b330, 0x43b4da)]
result['instructionSources'] = [dict(name=name, start=hex(start), end=hex(end),
    instructions=[dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
                  for i in disassembler.disasm(pe.get_data(start - 0x400000, end - start), start)])
    for name, start, end in ranges]
(ROOT / 'recovery/output/patch-sol-native.json').write_text(json.dumps(result, indent=2) + '\n')
