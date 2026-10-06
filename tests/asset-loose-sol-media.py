"""Execute independent WAV stdio and movie source choice branches."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x400000)
OBJECT, PATH, STACK, STOP, FILE, EXIST, BINK, CPK = [0x2001000 + 0x1000 * i for i in range(8)]
trace = []
present = True
cpk_present = [False, False]
bink_success = True


def uint(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def string(address):
    return bytes(uc.mem_read(address, 512)).split(b'\0')[0].decode()


def finish(value=0, pop=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4 + pop)


def hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    if address == EXIST:
        trace.append(dict(kind='PathFileExistsA', path=string(uint(sp + 4))))
        finish(int(present), 4)
    elif address == 0x57ae1c:
        trace.append(dict(kind='fopen', path=string(uint(sp + 4)), mode=string(uint(sp + 8))))
        finish(FILE if present else 0)
    elif address == CPK:
        obj = machine.reg_read(UC_X86_REG_ECX)
        index = (obj - OBJECT - 0x20) // 0x1c01a0
        trace.append(dict(kind='CPK.Open', index=index, path=string(uint(sp + 4))))
        finish(FILE if cpk_present[index] else 0, 4)
    elif address == BINK:
        name, flags = uint(sp + 4), uint(sp + 8)
        trace.append(dict(kind='BinkOpen', source=string(name) if flags == 0x80000 else 'archive-memory', flags=hex(flags)))
        finish(FILE if bink_success else 0, 8)
    elif address in [0x5746d0, 0x40a8a9, 0x40bc1f]:
        finish(PATH)
    else:
        raise AssertionError(hex(address))


put(0x5c0788, EXIST)
put(0x5c08d4, BINK)
put(0x5c0b34, CPK)
for address in [EXIST, BINK, CPK, 0x57ae1c, 0x5746d0, 0x40a8a9, 0x40bc1f]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
rows = []
for path in sorted((ROOT / 'CDTank/Data/sound').glob('*.wav')):
    relative = path.relative_to(ROOT / 'CDTank').as_posix()
    uc.mem_write(PATH, relative.encode() + b'\0')
    for present in [False, True]:
        put(STACK, STOP, PATH)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        trace.clear()
        uc.emu_start(0x56f296, STOP, count=100)
        assert uc.reg_read(UC_X86_REG_EAX) & 0xff == int(present)
        check = list(trace)
        uc.mem_write(OBJECT, bytes(0x100))
        put(STACK, STOP, PATH, 0x2001)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, OBJECT)
        trace.clear()
        uc.emu_start(0x575beb, STOP, count=1000)
        assert uc.reg_read(UC_X86_REG_EAX) & 0xff == int(present)
        assert trace == [dict(kind='fopen', path=relative, mode='rb')]
        assert uint(OBJECT + 4) == (FILE if present else 0)
        rows.append(dict(path=relative, present=present, existence=check, opens=list(trace), result=int(present)))
result = dict(status='PASS', soundRows=rows,
    soundScope='Original PathFileExistsA precheck and disk backend virtual-open 575beb execute. Backend logs and fopen supplied. PCM 575a03 requests disk key 5c27b0 (registered by 572d2f–572d47 to allocator572c11 → 575b43 → vtable5e1f30 virtual+4=575beb). Entire registry lookup and audio decoding/playback are not executed here.')

uc.mem_write(PATH, b'data\\movie\\logo.bik\0')
movie_rows = []
for cpk_present, bink_success, initialized in [([False, False], True, False), ([False, False], False, False), ([False, False], True, True), ([True, False], True, True), ([False, True], True, True), ([True, True], False, True)]:
    uc.mem_write(OBJECT, bytes(0x380400))
    uc.mem_write(PATH, b'data\\movie\\logo.bik\0')
    for index in [0, 1]:
        obj = OBJECT + 0x20 + index * 0x1c01a0
        uc.mem_write(obj + 0x1c008c, bytes([int(initialized)]))
        put(obj + 0x1c0090, PATH)
    put(STACK, STOP, PATH, 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OBJECT)
    trace.clear()
    uc.emu_start(0x448407, STOP, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_EAX) & 0xff == int(bink_success)
    if not bink_success or not any(cpk_present):
        assert trace[-1] == dict(kind='BinkOpen', source='data\\movie\\logo.bik', flags='0x80000')
    else:
        assert trace[-1]['source'] == 'archive-memory'
    movie_rows.append(dict(archiveInitialized=initialized, archiveEntryExists=cpk_present, binkSuccess=bink_success, calls=list(trace), result=int(bink_success)))
result['movieRows'] = movie_rows
result['movieScope'] = 'Complete448407 source-choice function including447d82 cleanup executes for fresh object; CPK.Open and BinkOpen external boundaries supplied. Two archive slots marked initialized for route coverage; which archives initialize those slots is not established.'
(ROOT / 'recovery/output/asset-loose-sol-media.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(rows)} WAV existence/disk-open cases and {len(movie_rows)} BIK archive/loose/failure routes')

import capstone
pe = images['cdtank.exe']
c = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [('soundNamePath', 0x485920, 0x4859b2), ('soundExists', 0x572fff, 0x573051),
          ('pcmRequestsDisk', 0x575a03, 0x575a66), ('diskRegistration', 0x572d2f, 0x572d4c),
          ('diskAllocator', 0x572c11, 0x572c47), ('diskOpen', 0x575beb, 0x575c9b),
          ('movieConstructor', 0x4481fa, 0x44824e), ('movieOpen', 0x448407, 0x4484b7),
          ('logoCaller', 0x447284, 0x4472aa)]
result['instructionSources'] = [dict(name=name, start=hex(a), end=hex(b), instructions=[
    dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
    for i in c.disasm(pe.get_data(a - 0x400000, b - a), a)]) for name, a, b in ranges]
assert pe.get_data(0x5c27b0 - 0x400000, 5) == b'disk\0'
assert struct.unpack('<I', pe.get_data(0x5e1f34 - 0x400000, 4))[0] == 0x575beb
text_names = ['ChangeLog-2005.txt', 'ChangeLog-2006.txt', 'ChangeLog-2007.txt', 'ChangeLog.txt', 'FAQ.txt', 'FutureWork.txt', 'Readme.txt', 'Readme_en.txt']
references = []
for name in text_names:
    hits = []
    for binary in sorted((ROOT / 'CDTank').glob('*')):
        if binary.suffix.lower() not in ['.exe', '.dll']:
            continue
        raw = binary.read_bytes().lower()
        if name.lower().encode() in raw or name.lower().encode('utf-16le') in raw:
            hits.append(binary.name)
    references.append(dict(path='Data/' + name, filenameReferences=hits, classification='bundled-documentation'))
result['documentationFiles'] = references
(ROOT / 'recovery/output/asset-loose-sol-media.json').write_text(json.dumps(result, indent=2) + '\n')
