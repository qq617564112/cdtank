"""Execute original successful replacement using isolated archive bytes."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CPKUpdate.exe'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x600000)
OBJECT, FRAME, STACK, STOP, TARGET, DOWNLOAD, PARENT, TEMP, LOG, FILE = [0x2000000,0x2500000,0x2510000,0x2520000,0x2530000,0x2531000,0x2532000,0x2533000,0x2534000,0x2535000]
archive = (ROOT / 'CDTank/Data/data.cpk').read_bytes()
count = struct.unpack_from('<I', archive, 32)[0]
capacity = struct.unpack_from('<I', archive, 16)[0]
header_index = archive[:128 + 28 * capacity]
entries = {}
for index in range(count):
    row = struct.unpack_from('<7I', archive, 128 + index * 28)
    crc, flags, parent, offset, packed, original, extra = row
    if extra and flags & 1 and not flags & 0x10:
        name = archive[offset + packed:offset + packed + extra].split(b'\0')[0].decode('gbk')
        entries[crc] = dict(index=index, row=row, name=name, parent=parent)


def full_path(crc):
    e = entries[crc]
    return (full_path(e['parent']) + '/' if e['parent'] else '') + e['name']


paths = {full_path(crc).lower(): e for crc, e in entries.items()}
trace = []
position = 0
persisted = bytearray(header_index)
case = ''
entry = None


def uint(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def string(address):
    return bytes(uc.mem_read(address, 1024)).split(b'\0')[0].decode()


def finish(value=0, pop=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value & 0xffffffff)
    uc.reg_write(UC_X86_REG_EIP, uint(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)


def base_hook(machine, address, size, data):
    global position
    sp = machine.reg_read(UC_X86_REG_ESP)
    obj = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x422d52 or address == 0x42259b:
        finish(machine.reg_read(UC_X86_REG_EAX))
    elif address == 0x422a14:
        pointer = uint(obj)
        finish(pointer)
    elif address == 0x422613:
        name = string(uint(sp + 4)).replace('\\', '/').lower()
        found = paths.get(name)
        finish(found['index'] if found else -1, 4)
    elif address == 0x4225d2:
        position = uint(sp + 8)
        trace.append(dict(kind='archiveSeek', offset=position))
        finish()
    elif address == 0x422f3c:
        source, size = uint(sp + 8), uint(sp + 12)
        payload = bytes(machine.mem_read(source, size))
        persisted[position:position + size] = payload
        trace.append(dict(kind='archiveWrite', offset=position, bytes=size))
        position += size
        finish(1)
    elif address == 0x422f1e:
        trace.append(dict(kind='debugAssertion', expression=string(uint(sp + 4)), file=string(uint(sp + 8)), line=uint(sp + 12)))
        finish()
    elif address in [0x4230b3, LOG, 0x422be5]:
        finish()
    elif address == 0x422046:
        source, char = uint(sp + 4), uint(sp + 8)
        offset = string(source).rfind(chr(char))
        finish(source + offset if offset >= 0 else 0)
    elif address == 0x422596:
        source, size = uint(sp + 4), uint(sp + 8)
        machine.mem_write(TEMP, bytes(machine.mem_read(source, size)) + b'\0')
        put(obj, TEMP)
        finish(obj, 8)
    elif address == 0x42260e:
        put(obj, uint(uint(sp + 4)))
        finish(obj, 4)
    elif address == 0x422cc6:
        finish()
    elif address == LOG + 16:
        finish(len(string(uint(sp + 4))))
    elif address == LOG + 32:
        destination, source = uint(sp + 4), uint(sp + 8)
        machine.mem_write(destination, string(source).encode() + b'\0')
        finish(destination)
    elif address == 0x4226ea:
        finish(len(string(uint(sp + 4))))
    elif address == 0x426860:
        trace.append(dict(kind='downloadExists', path=string(uint(sp + 4)), exists=case != 'download-missing'))
        finish(int(case != 'download-missing'))
    elif address == 0x422a05:
        finish(0)
    elif address == 0x422d8e:
        # Filename normalization and CRC are separate from replacement failure semantics.
        destination = uint(sp + 4)
        machine.mem_write(destination, string(TARGET).encode() + b'\0')
        finish(destination, 8)
    elif address == 0x422f05:
        finish(entry['row'][0])
    elif address == 0x4227c1:
        machine.mem_write(uint(sp + 4), string(TARGET).encode() + b'\0')
        finish(1, 8)
    elif address == 0x422dc5:
        trace.append(dict(kind='downloadOpen', path=string(uint(sp + 4)), returned=-1))
        finish(-1)
    elif address == 0x423063:
        finish(obj, 4)
    elif address == 0x426920:
        trace.append(dict(kind='updateFailureReported'))
        finish()
    else:
        raise AssertionError(hex(address))


import math
import lzokay
from patch_sol import decode_patch
uc.mem_map(0x3000000, 0x1800000)
heap = 0x3000000
transport = b''
DOWNLOAD_HANDLE = 0x2536000
SINK = 0x2540000
POOL = 0x2541000
uc.mem_write(SINK + 0x100, b'\xdd\x05' + struct.pack('<I', SINK + 0x120) + b'\xc3')


def hook(machine, address, size, data):
    global heap, position
    sp = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x422dc5:
        trace.append(dict(kind='downloadOpen', path=string(uint(sp + 4))))
        finish(DOWNLOAD_HANDLE)
    elif address == 0x4225eb:
        finish(len(transport) if uint(sp + 4) == DOWNLOAD_HANDLE else len(persisted))
    elif address == 0x42307c:
        finish(POOL)
    elif address == 0x4221e5:
        length = uint(sp + 4)
        value = heap
        heap += (length + 15) & ~15
        finish(value, 4)
    elif address in [0x422807, 0x423130]:
        finish(1, 8)
    elif address == 0x422893:
        finish(1)
    elif address == 0x422965:
        destination, handle, length = [uint(sp + i) for i in [4, 8, 12]]
        assert handle == DOWNLOAD_HANDLE and length == len(transport)
        machine.mem_write(destination, transport)
        trace.append(dict(kind='transportRead', bytes=length))
        finish(1)
    elif address == 0x444730:
        value = struct.unpack('<d', machine.mem_read(sp + 4, 8))[0]
        machine.mem_write(SINK + 0x120, struct.pack('<d', math.floor(value)))
        machine.reg_write(UC_X86_REG_EIP, SINK + 0x100)
    elif address == 0x42296f:
        # Original4310f0 excludes only .mp3/.bik/.ogg; no candidate has these extensions.
        finish(0, 4)
    elif address == 0x422555:
        source, length, destination, out_length = [uint(sp + i) for i in [4, 8, 12, 16]]
        packed = lzokay.compress(bytes(machine.mem_read(source, length)))
        machine.mem_write(destination, packed)
        put(out_length, len(packed))
        trace.append(dict(kind='lzoCompressBoundary', original=length, packed=len(packed)))
        finish(0)
    elif address in [0x422505, 0x422aa0, 0x422749]:
        destination, source = uint(sp + 4), uint(sp + 8)
        if address == 0x422505:
            length = uint(sp + 12)
            machine.mem_write(destination, bytes([source & 255]) * length)
        else:
            length = uint(sp + 12) if address == 0x422aa0 else len(string(source)) + 1
            machine.mem_write(destination, bytes(machine.mem_read(source, length)))
        finish(destination)
    elif address == 0x42291f:
        source, char = uint(sp + 4), uint(sp + 8)
        offset = string(source).rfind(chr(char))
        finish(source + offset if offset >= 0 else 0)
    elif address == 0x423239:
        destination, path = uint(sp + 4), uint(sp + 8)
        text = string(path).replace('\\', '/').split('/')[-1]
        machine.mem_write(destination, text.encode() + b'\0')
        finish(destination, 8)
    elif address == 0x422f3c:
        source, length = uint(sp + 8), uint(sp + 12)
        payload = bytes(machine.mem_read(source, length))
        if len(persisted) < position + length:
            persisted.extend(bytes(position + length - len(persisted)))
        persisted[position:position + length] = payload
        trace.append(dict(kind='archiveWrite', offset=position, bytes=length))
        position += length
        finish(1)
    elif address == SINK:
        # GetDiskFreeSpaceExA supplies a large available capacity.
        put(uint(sp + 8), 0xffffffff, 1)
        finish(1, 16)
    elif address == SINK + 16:
        machine.mem_write(uint(sp + 4), bytes(0x38))
        machine.mem_write(uint(sp + 8), bytes(8))
        machine.mem_write(uint(sp + 12), bytes(8))
        finish(1, 16)
    elif address == SINK + 32:
        machine.mem_write(uint(sp + 4), bytes(8))
        finish(pop=4)
    elif address == 0x422b6d:
        finish(1)
    elif address == 0x422f1e:
        raise AssertionError(('original assertion', string(uint(sp + 4)), uint(sp + 12)))
    else:
        base_hook(machine, address, size, data)


for address in [0x422d52, 0x42259b, 0x422a14, 0x422613, 0x4225d2, 0x422f3c,
                0x4230b3, LOG, LOG + 16, LOG + 32, 0x422be5, 0x422f1e, 0x422046, 0x422596, 0x42260e, 0x422cc6,
                0x4226ea, 0x426860, 0x422a05, 0x422d8e, 0x422f05, 0x4227c1,
                0x422dc5, 0x423063, 0x426920]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x48f34c, LOG)
put(0x48f360, LOG + 16)
put(0x48f35c, LOG + 32)

for address in [0x4225eb, 0x42307c, 0x4221e5, 0x422807, 0x423130, 0x422893,
                0x422965, 0x444730, 0x42296f, 0x422555, 0x422505, 0x422aa0,
                0x422749, 0x42291f, 0x423239, 0x422b6d, SINK, SINK + 16, SINK + 32]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x48f368, SINK)
put(0x48f370, SINK + 16)
put(0x48f36c, SINK + 32)
excluded = [images['cpkupdate.exe'].get_data(a - 0x400000, 8).split(b'\0')[0].decode() for a in [0x46aeac, 0x46aea4, 0x46ae9c]]
assert excluded == ['.mp3', '.bik', '.ogg']
assert all(p.suffix.lower() not in excluded for p in (ROOT / 'CDTank/download').rglob('*') if p.is_file())
rows = []
priority = ['Data/ui/layouts/game_main_chat_shrinked.xml', 'Data/ui/imagesets_dds/gy0.dds']
selected = priority + [p.relative_to(ROOT / 'CDTank/download').as_posix() for p in sorted((ROOT / 'CDTank/download').rglob('*')) if p.is_file() and p.relative_to(ROOT / 'CDTank/download').as_posix() not in priority]
for relative in selected:
    candidate = ROOT / 'CDTank/download' / relative
    entry = paths[relative.lower()]
    transport = candidate.read_bytes()
    logical = full_path(entry['row'][0]).replace('/', '\\')
    uc.mem_write(TARGET, logical.encode() + b'\0')
    uc.mem_write(DOWNLOAD, ('download\\' + logical).encode() + b'\0')
    uc.mem_write(OBJECT, bytes(0x280400))
    uc.mem_write(OBJECT, header_index)
    put(OBJECT + 0x1c0068, FILE)
    uc.mem_write(OBJECT + 0x1c006c, b'C:\\CDTank\\Data\\data.cpk\0')
    # The loader reconstructs deleted-index lists from the persisted index.
    deleted = [i for i in range(count) if struct.unpack_from('<I', header_index, 128 + i * 28 + 4)[0] & 0x10]
    for free_index, index in enumerate(deleted):
        put(OBJECT + 0x1c02f8 + free_index * 4, index)
        put(OBJECT + 0x2002f4 + index * 4, free_index)
    for index in range(count):
        if index not in deleted:
            put(OBJECT + 0x2002f4 + index * 4, 0xffffffff)
    persisted = bytearray(archive)
    trace.clear()
    heap = 0x3000000
    put(STACK, STOP, TARGET)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OBJECT)
    uc.emu_start(0x42bf40, STOP, count=3000000)
    put(STACK, STOP, DOWNLOAD, entry['row'][2], 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OBJECT)
    uc.emu_start(0x42bc00, STOP, count=1000000000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_EAX) == 1
    # Serialize the original written bytes and reopen through an independent CPK reader.
    import tempfile
    with tempfile.TemporaryDirectory(prefix='cdtank-patch-success-') as temporary:
        isolated = Path(temporary) / 'data.cpk'
        isolated.write_bytes(persisted)
        reopened = isolated.read_bytes()
    live = []
    reopened_count = struct.unpack_from('<I', reopened, 32)[0]
    for index in range(reopened_count):
        record = struct.unpack_from('<7I', reopened, 128 + index * 28)
        if record[0] == entry['row'][0] and record[1] & 1 and not record[1] & 0x10:
            live.append((index, record))
    assert len(live) == 1, relative
    live_index, record = live[0]
    crc, flags, parent, offset, packed_size, original_size, extra = record
    packed = reopened[offset:offset + packed_size]
    actual = lzokay.decompress(packed, original_size) if flags & 0x20000 else packed
    assert actual == decode_patch(transport), relative
    name = reopened[offset + packed_size:offset + packed_size + extra].split(b'\0')[0].decode('gbk')
    assert name.lower() == candidate.name.lower()
    assert parent == entry['row'][2]
    # Reinitialize the persisted index and execute the original CRC binary lookup.
    uc.mem_write(OBJECT, reopened[:128 + 28 * capacity])
    put(STACK, STOP, crc)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OBJECT)
    uc.emu_start(0x430d70, STOP, count=100000)
    assert uc.reg_read(UC_X86_REG_EAX) == live_index
    rows.append(dict(path=relative, status='PASS', liveIndex=live_index, packedBytes=packed_size,
                     originalBytes=original_size, storageFlags=hex(flags),
                     reopenedComparison='byte-for-byte-identical', originalCrcLookup=True, calls=list(trace)))
    print(f'PASS: {relative} -> {packed_size} packed bytes; isolated reopen identical', flush=True)
import capstone
pe = images['cpkupdate.exe']
c = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [('transportAndInsertion', 0x42d4b0, 0x42dc2d), ('filterDispatch', 0x435630, 0x4357d3),
          ('payloadNameInfoWrite', 0x430a30, 0x430c1a), ('sortedIndexSlot', 0x42d090, 0x42d214),
          ('freeBlockSelection', 0x42d290, 0x42d3e1), ('compressionExcludedExtensions', 0x4310f0, 0x4311c0)]
result = dict(status='PASS', rows=rows,
    scope='Original42bf40 deletion,42bc00/42e000/42d4b0 insert/decode,435630 compression dispatch,42d090 sorted index allocation/move,42d290 free block choice,430a30 payload/name/info writing,430fa0/431040 metadata writes execute. CRT allocation/string/memory and Windows file I/O supplied; filename normalization/CRC supplied from actual installed entry. Read loads actual encrypted download bytes; original43b330 decrypt executes. LZO compressor external call is supplied by lzokay. Extension predicate supplied false after checking original excludes only mp3/bik/ogg and all32 lack these extensions. Free-list initial arrays reconstructed from installed deleted entries; original mutations/moves execute.',
    reopen='Each serialized bytearray is written to an isolated temporary data.cpk, reread, live-entry/name/parent and decoded payload compared byte for byte; original430d70 CRC binary lookup executes against reloaded persisted index. Final native CPK load/open is not executed.',
    assertions='No original assertion encountered on successful samples; failed insertion assertion UI/abort behavior remains external and separately recorded in failure evidence.',
    instructionSources=[dict(name=name, start=hex(a), end=hex(b), instructions=[
        dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
        for i in c.disasm(pe.get_data(a - 0x400000, b - a), a)]) for name, a, b in ranges])
(ROOT / 'recovery/output/asset-patch-success-sol.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(rows)} original successful replacements')
