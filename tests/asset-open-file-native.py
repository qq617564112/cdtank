"""Execute original VFS file modes and their external I/O boundaries."""
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
uc.mem_map(0x2000000, 0x30000)
VFS, POOL, PATH, PREFIX, RESULT, HEAP, STACK, STOP, FOPEN, MALLOC = [0x2001000 + i * 0x2000 for i in range(10)]
CONFIG, GLOBAL_VFS = 0x2028000, 0x2029000
trace = []
present = True


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def uint(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def string(address):
    return bytes(uc.mem_read(address, 512)).split(b'\0')[0].decode()


def finish(pop=0, value=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x414115:
        finish(value=CONFIG)
    elif address == 0x10036380:
        assert machine.reg_read(UC_X86_REG_ECX) == VFS
        path = uint(stack + 4)
        trace.append(dict(kind='init', path=string(path) if path else None))
        finish(4, 1)
    elif address in [0x1003c170, 0x1003c16a]:
        destination, source = uint(stack + 4), uint(stack + 8)
        text = (string(destination) if address == 0x1003c16a else '') + string(source)
        machine.mem_write(destination, text.encode() + b'\0')
        finish(value=destination)
    elif address == 0x10037ef0:
        trace.append(dict(kind='cpkOpen', path=string(uint(stack + 4))))
        finish(4, RESULT + 0x110 if present else 0)
    elif address == FOPEN:
        trace.append(dict(kind='fopen', path=string(uint(stack + 4)), mode=string(uint(stack + 8))))
        finish(value=HEAP if present else 0)
    elif address == MALLOC:
        trace.append(dict(kind='malloc', size=uint(stack + 4)))
        finish(value=HEAP)
    elif address == 0x10035700:
        finish(value=POOL)
    else:
        raise AssertionError(hex(address))


for address in [0x1003c170, 0x1003c16a, 0x10037ef0, FOPEN, MALLOC, 0x10035700, 0x414115, 0x10036380]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x1003f234, FOPEN)
put(0x1003f2f8, MALLOC)
uc.mem_write(PATH, b'ui/layouts/room_main.xml\0')
uc.mem_write(PREFIX, b'Data/\0')
rows = []
for mode in [0, 1, 2]:
    for prefix in [False, True]:
        for present in [False, True]:
            for flags in [1, 2, 0x401]:
                uc.mem_write(VFS, bytes(0x100))
                uc.mem_write(POOL, bytes(0x1400))
                uc.mem_write(RESULT, bytes(0x200))
                put(VFS + 4, PREFIX if prefix else 0, POOL, mode)
                put(STACK, STOP, PATH, flags)
                uc.reg_write(UC_X86_REG_ESP, STACK)
                uc.reg_write(UC_X86_REG_ECX, VFS)
                trace.clear()
                uc.emu_start(0x10035810, STOP, count=10000)
                result = uc.reg_read(UC_X86_REG_EAX)
                assert uc.reg_read(UC_X86_REG_EIP) == STOP
                assert uc.reg_read(UC_X86_REG_ESP) == STACK + 12
                if mode == 0:
                    assert trace == [dict(kind='fopen', path=('Data/' if prefix else '') + 'ui/layouts/room_main.xml',
                                         mode={1: 'rb', 2: 'wb', 0x401: 'rt'}[flags])]
                    assert result == (POOL if present else 0)
                elif mode == 1:
                    assert trace == [dict(kind='cpkOpen', path='ui/layouts/room_main.xml')]
                    assert result == (RESULT if present else 0)
                else:
                    assert trace == [dict(kind='malloc', size=256)]
                    assert result == POOL
                rows.append(dict(mode=mode, prefix=prefix, present=present, flags=flags,
                                 result=result, calls=list(trace)))
(ROOT / 'recovery/output/asset-open-file-native.json').write_text(json.dumps(dict(status='PASS',
    entry='gbengine.dll:0x10035810', rows=rows,
    scope='Original gbVFileSystem::OpenFile executes modes0/1/2. Stdlib copy/allocation and external fopen/CPK-open boundaries supplied. Mode0 uses loose fopen; mode1 uses only its archive; failure does not fall back in this function. Application selection between VFS instances remains unproven.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original file-mode cases, prefixes, rb/wb/rt modes and no cross-mode fallback')

# Execute the actual client VFS selection block, with initialization as the observation boundary.
put(0x5c0bc0, GLOBAL_VFS)
put(GLOBAL_VFS, VFS)
selections = []
for archive_present in [0, 1, 2]:
    put(CONFIG + 0x200, archive_present)
    put(STACK, STOP)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    trace.clear()
    uc.emu_start(0x4170fa, 0x41711e, count=100)
    assert uc.reg_read(UC_X86_REG_ESP) == STACK
    assert trace == [dict(kind='init', path='data\\data.cpk' if archive_present else None)]
    selections.append(dict(archivePresent=archive_present, calls=list(trace)))
source = images['cdtank.exe']
assert source.get_data(0x5c2848 - 0x400000, 15) == b'\\data\\data.cpk\0'
assert next(symbol for entry in source.DIRECTORY_ENTRY_IMPORT for symbol in entry.imports
            if symbol.address == 0x5c0788).name == b'PathFileExistsA'
(ROOT / 'recovery/output/asset-source-selection-native.json').write_text(json.dumps(dict(status='PASS',
    selections=selections, sourceExistenceCheck='CDTank.exe:0x41d73e PathFileExistsA',
    scope='Actual4170fa–417118 selection: config+200 is the PathFileExistsA result for installation path plus data/data.cpk; nonzero selects that archive, zero supplies null for loose mode. Global config getter and VFS initialization boundary supplied. This is the global engine VFS, not table/audio independent loaders or decoded download content.'), indent=2) + '\n')
print('PASS: 3 original client archive-existence selections; CPK present selects archive, absent selects loose')
