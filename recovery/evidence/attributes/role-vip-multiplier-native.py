"""Execute original role construction, VIP property write/read, and max-HP tail."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
ROLE, RECORD, RECORD_VTABLE, STACK, STOP, COPY, NOTIFY = [0x2001000 + index * 0x1000 for index in range(7)]
events, writes = [], []


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *(value & 0xffffffff for value in values)))


def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == COPY:
        destination, source, count = [get(stack + offset) for offset in (4, 8, 12)]
        assert destination == ROLE + 0x2b8 and count == 64
        machine.mem_write(destination, bytes(machine.mem_read(source, count)))
        machine.reg_write(UC_X86_REG_EAX, destination)
        pop = 0
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == RECORD
        events.append(dict(selector=get(stack + 4), vip=machine.mem_read(RECORD + 0x50, 1)[0]))
        pop = 4
    machine.reg_write(UC_X86_REG_EIP, get(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def observe_write(machine, access, address, size, value, data):
    if address <= ROLE + 0x98 < address + size:
        writes.append(dict(instruction=hex(machine.reg_read(UC_X86_REG_EIP)), address=address, size=size, value=value))


def call(entry, *arguments):
    put(STACK, STOP, *arguments)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, ROLE)
    uc.emu_start(entry, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + 4 * len(arguments)
    return uc.reg_read(UC_X86_REG_EAX)


put(0x1003f2d0, COPY)
for address in (COPY, NOTIFY):
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, observe_write)
constructors = []
for entry in (0x431bcf, 0x42275e):
    for fill in (0, 0x55, 0xaa, 0xff):
        uc.mem_write(ROLE, bytes([fill]) * 0x400)
        writes.clear()
        assert call(entry) == ROLE
        assert get(ROLE + 0x98) == 0
        assert writes == [dict(instruction='0x431c1e', address=ROLE + 0x98, size=4, value=0)]
        constructors.append(dict(entry=hex(entry), fill=fill, multiplier=get(ROLE + 0x98), writes=list(writes)))

put(ROLE + 0x2a0, RECORD)
put(RECORD, RECORD_VTABLE)
put(RECORD_VTABLE + 0x24, NOTIFY)
rows = []
for value in (0, 1, 2, 255, 256, 257):
    events.clear()
    uc.mem_write(ROLE + 0x2b4, b'\0')
    assert call(0x4227f0, 2, value) & 255 == 1
    actual = call(0x4227e6, 2) & 255
    assert actual == value & 255
    assert events == [dict(selector=11, vip=actual)]
    assert uc.mem_read(ROLE + 0x2b4, 1)[0] == 1
    assert get(ROLE + 0x98) == 0
    for base_hp in (1, 500, 16777217):
        put(RECORD + 0x58, base_hp)
        uc.reg_write(UC_X86_REG_EAX, RECORD)
        uc.reg_write(UC_X86_REG_ESI, ROLE)
        uc.emu_start(0x433ce1, 0x433cf4, count=100)
        hp = get(RECORD + 0x58)
        assert hp == (0 if actual else base_hp)
        rows.append(dict(inputFlag=value, storedFlag=actual, multiplier=0, boundedMaxHp=base_hp, maxHp=hp))

output = dict(status='PASS', constructors=constructors, rows=rows,
              scope='Complete431bcf/42275e constructors, real4227f0->432738 setter and4227e6->432196 getter, and433ce1-433cf4 VIP tail. Matrix CRT memcpy and record notification endpoint supplied.',
              sourceStatus='Constructor initializes role+0x98 to zero. Later nonzero multiplier producer and its relationship to VIPHPMax are unresolved; this evidence does not authorize a VIP production default.')
(ROOT / 'recovery/output/role-vip-multiplier-native.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS: 8 complete constructors and 18 VIP setter/getter/tail rows; nonzero multiplier source unresolved')
