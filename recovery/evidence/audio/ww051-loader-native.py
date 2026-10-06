"""Execute the original Type4 sound path and missing-file gate."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

machine, images = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x100000)
STACK, STOP, REFERENCE, OUTPUT, MANAGER, FILE_MANAGER = 0x2008000, 0x20ff000, 0x2010000, 0x2011000, 0x2012000, 0x2013000
heap = 0x2020000
calls = []
visited = set()

def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]

def write_uint(address, value):
    machine.mem_write(address, struct.pack('<I', value))

def cstring(address):
    return bytes(machine.mem_read(address, 512)).split(b'\0')[0].decode('ascii')

def finish(pop=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))

# Bind only the Windows filesystem import. Its result comes from the supplied
# original game directory; the original existence wrapper and player execute.
exe = images['cdtank.exe']
filesystem_import = next(i for d in exe.DIRECTORY_ENTRY_IMPORT for i in d.imports if i.address == 0x5c0788)
assert filesystem_import.name == b'PathFileExistsA'
FILESYSTEM = 0x20fe000
write_uint(filesystem_import.address, FILESYSTEM)

def hook(uc, address, size, data):
    global heap
    visited.add(address)
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address in (0x578620, 0x5786c4):
        count = uint(stack + 4)
        result = heap
        heap += (count + 31) & ~15
        assert heap < 0x20fd000
        uc.reg_write(UC_X86_REG_EAX, result)
        finish()
    elif address == 0x57a6c7:
        finish()
    elif address == FILESYSTEM:
        path = cstring(uint(stack + 4))
        exists = (ROOT / 'CDTank' / path.replace('\\', '/')).exists()
        calls.append(dict(api='PathFileExistsA', path=path, exists=exists))
        uc.reg_write(UC_X86_REG_EAX, int(exists))
        finish(4)

machine.hook_add(UC_HOOK_CODE, hook)
# Already-created enabled managers, with the file-manager's empty path prefix.
# Singleton getters, original string construction/concatenation and destructors
# remain executable original code.
write_uint(0x8d3f10, 1)
write_uint(0x8d3f0c, MANAGER)
write_uint(0x8d3f4c, 1)
write_uint(0x8d3f48, FILE_MANAGER)
write_uint(FILE_MANAGER + 0x18, 15)
machine.mem_write(MANAGER + 8, b'\1')
machine.mem_write(0x61eb3c, b'\1')
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
node = next(n for n in library['nodes'] if n['index'] == 2915)
assert node['type'] == 4
resource = bytes.fromhex(node['resource'])
reference = resource[:324].split(b'\0')[0]
parameter = struct.unpack_from('<I', resource, 324)[0]
assert reference == b'ww051'
machine.mem_write(REFERENCE, reference + b'\0')
machine.mem_write(OUTPUT, b'\xa5' * 24)
machine.mem_write(STACK, struct.pack('<4I', STOP, OUTPUT, REFERENCE, parameter))
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.emu_start(0x4858f2, STOP, count=1000000)
assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
assert machine.reg_read(UC_X86_REG_EAX) == OUTPUT
assert calls == [dict(api='PathFileExistsA', path='data\\sound/ww051.wav', exists=False)]
assert all(address in visited for address in [0x571bd4, 0x571c50, 0x572f52, 0x572fff, 0x56f296, 0x571d00])
assert 0x5718e3 not in visited
result = bytes(machine.mem_read(OUTPUT, 24))
# The descriptor initializes its validity byte and identity fields. Three padding
# bytes and its final four bytes are not initialized by this original function.
assert result[0] == 0 and result[4:17] == bytes(13)
# Execute the manager's actual completion/stop consumers with that descriptor.
machine.mem_write(STACK, struct.pack('<2I', STOP, OUTPUT))
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.reg_write(UC_X86_REG_ECX, MANAGER)
machine.reg_write(UC_X86_REG_EAX, 0)
machine.emu_start(0x5702b0, STOP, count=10000)
assert machine.reg_read(UC_X86_REG_EAX) & 255 == 1
assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
machine.mem_write(STACK, struct.pack('<2I', STOP, OUTPUT))
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.reg_write(UC_X86_REG_ECX, MANAGER)
machine.emu_start(0x5705bb, STOP, count=10000)
assert machine.reg_read(UC_X86_REG_ESP) == STACK + 8
assert bytes(machine.mem_read(OUTPUT, 24)) == result
assert 0x570083 not in visited and 0x57520a not in visited
evidence = dict(node=2915, reference=reference.decode(), parameter=parameter,
                entry='0x4858f2', calls=calls, loaderReached=False,
                descriptorValid=False, finished=True, stopReachedDevice=False, identityFields=[uint(OUTPUT + offset) for offset in [4, 8, 12]],
                descriptorTailInitialized=False,
                executedEntries=[hex(address) for address in [0x4858f2, 0x571bd4, 0x571c50, 0x572f52, 0x572fff, 0x56f296, 0x571d00, 0x5702b0, 0x5705bb]],
                suppliedBoundaries=['heap allocation/free', 'initialized singleton state with empty file prefix', 'PathFileExistsA backed by original game directory'])
(ROOT / 'recovery/output/ww051-loader-native.json').write_text(json.dumps(evidence, indent=2) + '\n')
print('PASS: original ww051 path construction, missing-file gate, invalid descriptor, finished and no-op stop')
