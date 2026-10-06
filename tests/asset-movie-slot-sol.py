"""Execute movie and both original CPK constructors before logo source choice."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0, 0x1000)
uc.mem_map(0x2000000, 0x500000)
OBJECT, STACK, STOP, PATH, CONFIG, HEAP, SINK = 0x2000000, 0x2490000, 0x2491000, 0x2492000, 0x2493000, 0x2400000, 0x2494000
heap = HEAP
trace = []
logo_present = True


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
    global heap
    sp = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x1003c080:
        destination, byte, length = [uint(sp + x) for x in [4, 8, 12]]
        machine.mem_write(destination, bytes([byte & 255]) * length)
        finish(destination)
    elif address == 0x1003bcec:
        size = uint(sp + 4)
        result = heap
        heap += (size + 15) & ~15
        finish(result)
    elif address == SINK:
        # GetSystemInfo is a stdcall import; no returned field controls loaded state.
        machine.mem_write(uint(sp + 4), bytes(36))
        finish(pop=4)
    elif address == SINK + 16:
        trace.append(dict(kind='milesDirectory', path=string(uint(sp + 4))))
        finish(pop=4)
    elif address == SINK + 32:
        finish(1)
    elif address == SINK + 48:
        finish(0x2496000, 16)
    elif address == SINK + 64:
        trace.append(dict(kind='BinkSetSoundSystem'))
        finish(1, 8)
    elif address == 0x57c0d6:
        destination = uint(sp + 4)
        assert string(uint(sp + 12)) == '%s\\%s\\miles'
        text = string(uint(sp + 16)) + '\\' + string(uint(sp + 20)) + '\\miles'
        machine.mem_write(destination, text.encode() + b'\0')
        finish(len(text))
    elif address == 0x58c0d0:
        finish()
    elif address == SINK + 80:
        name, flags = uint(sp + 4), uint(sp + 8)
        trace.append(dict(kind='BinkOpen', path=string(name), flags=hex(flags), present=logo_present))
        finish(0x2497000 if logo_present else 0, 8)
    elif address == 0x100379b0:
        raise AssertionError('Movie constructor attempted to load an archive')
    elif address == 0x10037ef0:
        raise AssertionError('Fresh movie attempted an archive lookup')
    elif address in [0x5746d0, 0x40a8a9, 0x40bc1f]:
        finish(PATH)
    else:
        raise AssertionError(hex(address))


for iat, target in [(0x1003f064, SINK), (0x5c0bcc, SINK + 16), (0x5c0bd0, SINK + 32),
                    (0x5c0bd4, SINK + 48), (0x5c08b4, SINK + 64), (0x5c08d4, SINK + 80)]:
    put(iat, target)
for address in [0x1003c080, 0x1003bcec, 0x57c0d6, 0x58c0d0, 0x100379b0, 0x10037ef0,
                0x5746d0, 0x40a8a9, 0x40bc1f, *[SINK + i * 16 for i in range(6)]]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x635830, CONFIG)
uc.mem_write(CONFIG + 0x44, b'C:\\CDTank\0')
put(CONFIG + 0x58, 15)
logo = ROOT / 'CDTank/Data/movie/Logo.bik'
assert logo.is_file() and logo.read_bytes()[:3] == b'BIK'
uc.mem_write(PATH, b'data\\movie\\logo.bik\0')
rows = []
for logo_present in [True, False]:
    heap = HEAP
    trace.clear()
    # Nonzero prefill demonstrates that both CPK constructors actually clear loaded flags.
    uc.mem_write(OBJECT, b'\xaa' * 0x380360)
    put(STACK, STOP)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OBJECT)
    uc.emu_start(0x4481fa, STOP, count=2000000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    flags = [uc.mem_read(OBJECT + 0x20 + i * 0x1c01a0 + 0x1c008c, 1)[0] for i in range(2)]
    assert flags == [0, 0]
    assert uint(OBJECT + 8) == 0
    constructor_trace = list(trace)
    trace.clear()
    put(STACK, STOP, PATH, 0)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, OBJECT)
    uc.emu_start(0x448407, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_EAX) & 255 == int(logo_present)
    assert trace == [dict(kind='BinkOpen', path='data\\movie\\logo.bik', flags='0x80000', present=logo_present)]
    rows.append(dict(logoPresent=logo_present, constructorArchiveFlags=flags,
                     constructorCalls=constructor_trace, opens=list(trace), returned=int(logo_present)))
result = dict(status='PASS', movieConstructor='0x4481fa', arrayConstructor='0x57d1ff',
              cpkConstructor='gbengine.dll:0x100378e0', open='0x448407', rows=rows,
              conclusion='Both movie archive slots are uninitialized after their original constructors; no archive filename is loaded. Normal logo open uses the existing loose Data/movie/logo.bik through BinkOpen; absent file returns false.',
              boundaries='CRT memset/malloc/sprintf, GetSystemInfo, Miles startup/driver/redist/sound-system and BinkOpen/logs supplied. Original SEH, array constructor, both entire CPK constructors, movie constructor and source-choice function execute.')
(ROOT / 'recovery/output/asset-movie-slot-sol.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: complete movie/array/two CPK constructors keep both slots unloaded; existing/missing logo uses loose BinkOpen only')

import capstone
c = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [('cdtank.exe', 'movieConstructor', 0x4481fa, 0x4482e0),
          ('cdtank.exe', 'arrayConstructor', 0x57d1ff, 0x57d247),
          ('gbengine.dll', 'cpkConstructor', 0x100378e0, 0x10037977),
          ('cdtank.exe', 'normalLogoCaller', 0x447284, 0x4472aa),
          ('cdtank.exe', 'normalLogoWrapper', 0x4484b9, 0x4484f2)]
result['installedLooseMovie'] = 'CDTank/Data/movie/Logo.bik'
result['instructionSources'] = [dict(file=file, name=name, start=hex(a), end=hex(b), instructions=[
    dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
    for i in c.disasm(images[file].get_data(a - images[file].OPTIONAL_HEADER.ImageBase, b - a), a)])
    for file, name, a, b in ranges]
(ROOT / 'recovery/output/asset-movie-slot-sol.json').write_text(json.dumps(result, indent=2) + '\n')
