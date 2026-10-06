"""Execute original replacement failure paths against copies of installed CPK indices."""
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


def hook(machine, address, size, data):
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


for address in [0x422d52, 0x42259b, 0x422a14, 0x422613, 0x4225d2, 0x422f3c,
                0x4230b3, LOG, LOG + 16, LOG + 32, 0x422be5, 0x422f1e, 0x422046, 0x422596, 0x42260e, 0x422cc6,
                0x4226ea, 0x426860, 0x422a05, 0x422d8e, 0x422f05, 0x4227c1,
                0x422dc5, 0x423063, 0x426920]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x48f34c, LOG)
put(0x48f360, LOG + 16)
put(0x48f35c, LOG + 32)
rows = []
for candidate in sorted((ROOT / 'CDTank/download').rglob('*')):
    if not candidate.is_file():
        continue
    relative = candidate.relative_to(ROOT / 'CDTank/download').as_posix()
    entry = paths[relative.lower()]
    logical = full_path(entry['row'][0]).replace('/', '\\')
    parent = logical.rsplit('\\', 1)[0]
    uc.mem_write(TARGET, logical.encode() + b'\0')
    uc.mem_write(DOWNLOAD, ('download\\' + logical).encode() + b'\0')
    uc.mem_write(PARENT, parent.encode() + b'\0')
    for case in ['download-missing', 'download-open-failed', 'direct-live-duplicate']:
        uc.mem_write(OBJECT, bytes(0x280400))
        uc.mem_write(OBJECT, header_index)
        put(OBJECT + 0x1c0068, FILE)
        persisted = bytearray(header_index)
        trace.clear()
        if case == 'direct-live-duplicate':
            put(STACK, STOP, DOWNLOAD, entry['row'][2], 0)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.reg_write(UC_X86_REG_ECX, OBJECT)
            uc.emu_start(0x42bc00, STOP, count=1000000)
            assert uc.reg_read(UC_X86_REG_EIP) == STOP
            assert uc.reg_read(UC_X86_REG_EAX) == 0
            assert persisted == header_index
            assert not any(t['kind'] == 'downloadOpen' for t in trace)
            status = 'duplicate-rejected-before-read'
            bits = 0
        else:
            uc.mem_write(FRAME - 0x400, bytes(0x800))
            put(FRAME - 0x98, TARGET)
            put(FRAME - 0x74, DOWNLOAD)
            put(FRAME - 0xd4, OBJECT)
            put(FRAME - 0xec, TARGET)
            uc.reg_write(UC_X86_REG_EBP, FRAME)
            uc.reg_write(UC_X86_REG_ESP, FRAME - 0x500)
            uc.emu_start(0x425da7, 0x425ca4, count=3000000)
            assert uc.reg_read(UC_X86_REG_EIP) == 0x425ca4
            bits = uint(FRAME - 0x44)
            assert bits == (0xff000040 if case == 'download-missing' else 0xff000008)
            flags = struct.unpack_from('<I', persisted, 128 + entry['index'] * 28 + 4)[0]
            assert flags & 0x10
            assert next(i for i, t in enumerate(trace) if t['kind'] == 'archiveWrite') < next(i for i, t in enumerate(trace) if t['kind'] == 'downloadExists')
            status = 'old-entry-deleted-and-persisted-no-rollback'
        rows.append(dict(path=relative, case=case, cpkEntry=entry['index'], result=status, errorBits=hex(bits), calls=list(trace)))
result = dict(status='PASS', rows=rows, scope='Original425da7 per-entry replacement branch, complete42bf40 deletion and42f050 deleted-index mutation,430fa0/431040 metadata persistence,42bc00/42e000/42d4b0 insertion wrappers and duplicate/open-failure paths execute. Original archive header/index copied into emulated memory. String/normalization/CRC and filename-to-index lookup boundaries supplied; CRC live lookup430d70 executes. Seek/write boundaries persist to an isolated bytearray; download existence/open boundaries provide failure. Successful payload compression/write not covered.',
              conclusion='Existing entry is deleted and header/index persisted before download presence/open; missing or failed-open update has no rollback. Direct insertion of an existing live entry rejects duplicate before reading. No atomic replacement guarantee is present in these paths.')
(ROOT / 'recovery/output/asset-patch-transaction-sol.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(rows)} original patch duplicate/missing/open-failure paths against 32 installed CPK indices')

import capstone
pe = images['cpkupdate.exe']
c = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [('replaceBeforeDownloadCheck', 0x425da7, 0x4261fa),
          ('removeWrapper', 0x42bf40, 0x42bfe3), ('deletedIndexMutation', 0x42f050, 0x42f272),
          ('headerPersistence', 0x430fa0, 0x43101a), ('indexPersistence', 0x431040, 0x4310c5),
          ('insertWrapper', 0x42bc00, 0x42bcbe), ('singleInsertBranch', 0x42e22d, 0x42e292),
          ('insertDuplicateAndOpenFailure', 0x42d4b0, 0x42d616)]
result['instructionSources'] = [dict(name=name, start=hex(a), end=hex(b), instructions=[
    dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
    for i in c.disasm(pe.get_data(a - 0x400000, b - a), a)]) for name, a, b in ranges]
result['debugAssertionBoundary'] = 'Failed42e000 invokes originalbResult assertion (cpkcore.cpp line1248). Assertion UI/abort policy is supplied as return-continue; traces preserve each invocation. Outer error reporting describes continuation only.'
(ROOT / 'recovery/output/asset-patch-transaction-sol.json').write_text(json.dumps(result, indent=2) + '\n')
