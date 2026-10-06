"""Execute table stdio opening and failure modes for all supplied table paths."""
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
uc.mem_map(0x2000000, 0x30000)
OBJECT, PATH, STACK, STOP, FILE, DATA = [0x2001000 + 0x2000 * i for i in range(6)]
trace = []
mode_case = ''
source = b''


def uint(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def string(address):
    return bytes(uc.mem_read(address, 512)).split(b'\0')[0].decode()


def finish(value=0):
    sp = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(sp))
    uc.reg_write(UC_X86_REG_ESP, sp + 4)


def hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x57ae1c:
        path, mode = string(uint(sp + 4)), string(uint(sp + 8))
        trace.append(dict(kind='stdioOpen', path=path, mode=mode))
        found = mode_case == 'writable' or mode_case == 'readonly' and mode == 'rb' or mode_case == 'missing-created' and mode == 'wb+'
        finish(FILE if found else 0)
    elif address in [0x57ad74, 0x57ac3f]:
        destination, size, count = [uint(sp + i) for i in [4, 8, 12]]
        assert uint(sp + 16) == FILE
        machine.mem_write(destination, bytes(size * count) if mode_case == 'missing-created' else source[:size * count])
        finish(count)
    elif address == 0x57aa80:
        left, right, count = [uint(sp + i) for i in [4, 8, 12]]
        finish(0 if machine.mem_read(left, count) == machine.mem_read(right, count) else 1)
    elif address == 0x57a8d0:
        finish()
    else:
        raise AssertionError(hex(address))


for address in [0x57ae1c, 0x57ad74, 0x57ac3f, 0x57aa80, 0x57a8d0]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
rows = []
for path in sorted((ROOT / 'CDTank/Data/table').glob('*.dat')):
    source = path.read_bytes()[:0x38]
    assert source[:12] == b'CF_Flag_001\0'
    relative = path.relative_to(ROOT / 'CDTank').as_posix()
    uc.mem_write(PATH, relative.encode() + b'\0')
    for mode_case in ['writable', 'readonly', 'missing-create-failed', 'missing-created']:
        uc.mem_write(OBJECT, bytes(0x200))
        put(OBJECT + 0x3c, 128)
        put(OBJECT + 0xa8, DATA)
        put(STACK, STOP, PATH, 1)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, OBJECT)
        trace.clear()
        uc.emu_start(0x40483a, STOP, count=20000)
        assert uc.reg_read(UC_X86_REG_EIP) == STOP
        actual = uc.reg_read(UC_X86_REG_EAX) & 0xff
        expected = 0 if mode_case == 'missing-create-failed' else 1
        assert actual == expected, (relative, mode_case)
        expected_modes = ['rb+'] if mode_case == 'writable' else ['rb+', 'rb'] if mode_case == 'readonly' else ['rb+', 'rb', 'wb+']
        assert [x['mode'] for x in trace] == expected_modes
        assert all(x['path'] == relative for x in trace)
        rows.append(dict(path=relative, case=mode_case, returned=actual, opens=list(trace)))
result = dict(status='PASS', entry='CDTank.exe:0x40483a', caller='0x418eb1', managerLoader='0x41a2ff',
              boundary='CRT fopen/read/compare/seek supplied; original ordered modes and return paths execute. Missing-created models creation of the same loose filename, without writing original files.', rows=rows,
              sourceSelection='Same loose path retried rb+, rb, wb+; no archive or download fallback in the table open routine.')
(ROOT / 'recovery/output/asset-loose-sol-tables.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(rows)} table opening cases; missing file tries creation on same loose path')

# Execute the manager's dat/txt choice before the inner binary-table opener.
from unicorn.x86_const import UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ESI
original_hook = hook
stem = ''


def manager_hook(machine, address, size, data):
    sp = machine.reg_read(UC_X86_REG_ESP)
    if address in [0x401609, 0x40726b]:
        obj = machine.reg_read(UC_X86_REG_ECX)
        text = string(uint(sp + 4))
        if address == 0x40726b:
            text = string(uint(obj + 4)) + text
        machine.mem_write(DATA, text.encode() + b'\0')
        put(obj + 4, DATA)
        put(obj + 0x18, 100)
        finish(obj)
        machine.reg_write(UC_X86_REG_ESP, machine.reg_read(UC_X86_REG_ESP) + 4)
    elif address == 0x57ae1c:
        path, mode = string(uint(sp + 4)), string(uint(sp + 8))
        trace.append(dict(kind='stdioOpen', path=path, mode=mode))
        present = mode_case == 'manager-dat' and path.rstrip().endswith('.dat') or mode_case == 'manager-txt' and path.endswith('.txt')
        finish(FILE if present else 0)
    else:
        original_hook(machine, address, size, data)


# Use a separate machine for the manager string boundaries.
manager, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
manager.mem_map(0x2000000, 0x30000)
uc = manager
for address in [0x57ae1c, 0x401609, 0x40726b]:
    manager.hook_add(UC_HOOK_CODE, manager_hook, begin=address, end=address)
manager_rows = []
for path in sorted((ROOT / 'CDTank/Data/table').glob('*.dat')):
    stem = path.relative_to(ROOT / 'CDTank').as_posix()[:-4]
    uc.mem_write(PATH, stem.encode() + b'\0')
    for mode_case, stop in [('manager-dat', 0x41a350), ('manager-txt', 0x41a41c), ('manager-missing', 0x41a537)]:
        frame = STACK
        uc.mem_write(frame - 0x100, bytes(0x200))
        uc.mem_write(DATA, stem.encode() + b'\0')
        put(frame - 0x44, DATA)
        put(frame - 0x30, 100)
        put(frame + 8, PATH)
        uc.reg_write(UC_X86_REG_EBP, frame)
        uc.reg_write(UC_X86_REG_ESP, frame - 0x80)
        uc.reg_write(UC_X86_REG_ESI, OBJECT)
        trace.clear()
        uc.emu_start(0x41a31c, stop, count=1000)
        assert uc.reg_read(UC_X86_REG_EIP) == stop
        expected = [stem + '.dat '] if mode_case == 'manager-dat' else [stem + '.dat ', stem + '.txt']
        assert [x['path'] for x in trace] == expected
        assert all(x['mode'] == 'r' for x in trace)
        if mode_case == 'manager-missing':
            assert uc.mem_read(frame + 0xb, 1) == b'\0'
        manager_rows.append(dict(path=stem, case=mode_case, stop=hex(stop), opens=list(trace),
                                 result='binary-table' if mode_case == 'manager-dat' else 'text-table' if mode_case == 'manager-txt' else 'false'))
result['managerRows'] = manager_rows
result['managerScope'] = 'Original 41a31c dat choice and 41a3e7 text fallback branches; string assign/append and fopen boundaries supplied. Stops before binary/text parser creation for present files; missing branch writes false.'
(ROOT / 'recovery/output/asset-loose-sol-tables.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(manager_rows)} original manager dat/txt choice cases; both missing returns false')

import capstone
pe = images['cdtank.exe']
c = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [('binaryAndTextChoice', 0x41a2ff, 0x41a45a), ('choiceFailure', 0x41a517, 0x41a558),
          ('tableBinaryConstructor', 0x418e4a, 0x418edc), ('tableOpen', 0x40483a, 0x40490e),
          ('runtimeTableBindings', 0x41b8c0, 0x41c33c)]
result['instructionSources'] = [dict(name=name, start=hex(a), end=hex(b), instructions=[
    dict(address=hex(i.address), bytes=i.bytes.hex(), instruction=f'{i.mnemonic} {i.op_str}')
    for i in c.disasm(pe.get_data(a - 0x400000, b - a), a)]) for name, a, b in ranges]
(ROOT / 'recovery/output/asset-loose-sol-tables.json').write_text(json.dumps(result, indent=2) + '\n')
