"""Execute original role-manager listener registration and paired-source callback."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX,
    UC_X86_REG_EIP, UC_X86_REG_ESP,
)

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
MANAGER, HEAP = 0x2001000, 0x2005000
STACK, RETURN, RESULT, KEY = 0x2020000, 0x2021000, 0x2022000, 0x2022100
heap = HEAP
pending = 0
registrations = []
allocations = []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4)


def hook(machine, address, size, data):
    global heap, pending
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x578620:
        count = read(stack + 4)
        pointer = heap
        heap += (count + 15) & ~15
        assert heap < STACK
        allocations.append(count)
        finish(pointer)
    elif address == 0x57aa66:
        # Process-exit destructor scheduling has no effect on registration.
        finish()
    elif address == 0x48baff:
        pending = read(stack + 4)
    elif address == 0x4152b6:
        pair = read(stack + 8)
        assert read(pair + 4) == pending
        name_pointer = read(pending + 0x10)
        registrations.append(dict(
            messageType=read(pair), listener=pending, vtable=read(pending),
            handler=read(pending + 8),
            name=bytes(machine.mem_read(name_pointer, 80)).split(b'\0')[0].decode(),
        ))
    # Observations do not replace registration, type getters, insertion or lookup.


for address in [0x578620, 0x57aa66, 0x48baff, 0x4152b6]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def call(address, this, *args):
    write(0, 0x12345678)
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234
    assert read(0) == 0x12345678
    return uc.reg_read(UC_X86_REG_EAX)


assert call(0x42b7e7, MANAGER) == MANAGER
registered = list(registrations)
paired = [row for row in registered if row['messageType'] == 0x3aa5]
assert len(paired) == 1
listener = paired[0]
assert listener['handler'] == 0x422f66 and listener['vtable'] == 0x5c2db0
write(KEY, 0x3aa5)
assert call(0x4501fa, MANAGER, RESULT, KEY) == RESULT
node = read(RESULT)
assert node != read(MANAGER + 4) and read(node + 0x10) == listener['listener']
OWNER, MESSAGE = 0x2002000, 0x2003000
rows = []
# Callback stores references, including null, without consuming or clearing the message.
for base in [0, 0x2004000, 0x80000001, 0xffffffff]:
    for equipment in [0, 0x2004100, 0x80000002, 0xfffffffe]:
        write(OWNER + 0x1c, 111, 222, 333, 444)
        write(MESSAGE + 0xc, equipment, base)
        before_message = bytes(uc.mem_read(MESSAGE, 0x14))
        call(listener['handler'], OWNER, MESSAGE, 17, 19)
        assert read(OWNER + 0x20) == base and read(OWNER + 0x24) == equipment
        assert read(OWNER + 0x1c) == 111 and read(OWNER + 0x28) == 444
        assert bytes(uc.mem_read(MESSAGE, 0x14)) == before_message
        rows.append(dict(base=base, equipment=equipment, resultBase=read(OWNER + 0x20),
                         resultEquipment=read(OWNER + 0x24)))
(ROOT / 'recovery/output/role-owned-receive-native.json').write_text(json.dumps(dict(
    status='PASS', constructor='0x42b7e7', registrations=registered, pairedListener=listener,
    rows=rows, scope='Complete role-manager listener constructor, real registration tree lookup '
        'and complete422f66 callback. Allocation and exit destructor scheduling supplied; '
        'no socket transport, battle role binding or account assembly.'), indent=2) + '\n')
print(f"PASS: {len(registered)} original role listeners and {len(rows)} paired-source callback cases")
