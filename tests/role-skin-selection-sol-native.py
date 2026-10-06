"""Execute original texture storage initialization and received three-slot getter."""
import json
from pathlib import Path
import struct
import sys
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x200000)
RECORD, RESULT = 0x2001000, 0x2002000
STACK, RETURN, HEAP_ALLOC, HEAP = 0x2100000, 0x2101000, 0x2102000, 0x2110000
heap = HEAP
registrations = []
bindings = {}
pe = images['cdtank.exe']
disassembler = Cs(CS_ARCH_X86, CS_MODE_32)
bind_sites = {instruction.address for instruction in disassembler.disasm(
    pe.get_data(0x5221a0 - 0x400000, 0x52273e - 0x5221a0), 0x5221a0)
    if instruction.mnemonic == 'call' and instruction.op_str == 'dword ptr [edx + 8]'}


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(machine, address, size, data):
    global heap
    if address == 0x57a6c7 and globals().get('native_retirement', False):
        return
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address in bind_sites:
        bindings[machine.reg_read(UC_X86_REG_ECX)] = read(stack) - RECORD
        return
    if address in [0x52b100, 0x52b260, 0x52b4c0]:
        name = bytes(machine.mem_read(read(stack + 4), 128)).split(b'\0')[0].decode()
        entry = dict(name=name, registrationKind={
            0x52b100: 'numeric', 0x52b260: 'string', 0x52b4c0: 'array',
        }[address])
        if address == 0x52b100:
            entry['type'] = read(stack + 8)
        registrations.append(entry)
        return
    if address in [0x578620, HEAP_ALLOC]:
        count = read(stack + (12 if address == HEAP_ALLOC else 4))
        pointer = heap
        heap += (count + 15) & ~15
        assert heap < 0x2200000
        finish(pointer, 12 if address == HEAP_ALLOC else 0)
    else:
        finish()


write(0x5c058c, HEAP_ALLOC)
for address in [0x578620, 0x57aa66, 0x57a6c7, HEAP_ALLOC]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
for address in [*bind_sites, 0x52b100, 0x52b260, 0x52b4c0]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)


def call(address, this, *args):
    write(0, 0x12345678)
    write(STACK, RETURN, *args)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_EBP, 0x1234)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.emu_start(address, RETURN, count=200000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + 4 * len(args)
    assert uc.reg_read(UC_X86_REG_EBP) == 0x1234 and read(0) == 0x12345678
    return uc.reg_read(UC_X86_REG_EAX)


constructor_rows = []
for fill in [0, 0x55, 0xaa, 0xff]:
    uc.mem_write(RECORD, bytes([fill]) * 0x140)
    call(0x523303, RECORD)
    texture = list(struct.unpack('<3I', uc.mem_read(RECORD + 0x110, 12)))
    assert texture == [fill * 0x01010101] * 3
    constructor_rows.append(dict(fill=fill, texture=texture))

call(0x5221a0, RECORD)
manager = read(RECORD + 4)
begin, end = read(manager + 0x18), read(manager + 0x1c)
fields = [read(address) for address in range(begin, end, 4)]
field = fields[32]
assert registrations[32] == dict(name='m_arrayTexture', registrationKind='array')
assert bindings[field] == 0x110
assert read(field + 0x34) == 3 and read(field + 0x2c) == RECORD + 0x110
# Real getter3 must expose the same three received unsigned DWORDs.
ROLE = 0x2004000
write(ROLE + 0x2a0, RECORD)
assert call(0x4327ac, ROLE, 3) == RECORD + 0x110

MESSAGE, RAW, METADATA, METADATA_VTABLE = 0x2007000, 0x2008000, 0x2009000, 0x2009100
RECEIVER, RECEIVER_VTABLE = 0x2009200, 0x2009300
SERVICE, SERVICE_VTABLE, LOGGER, LOGGER_VTABLE = 0x2009400, 0x2009500, 0x2009600, 0x2009700
TYPE, GET_LOGGER, LOG_LEVEL, RECEIVED = 0x2104000, 0x2104100, 0x2104200, 0x2104300
events = []


def receive_hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address in [0x58c0a8, 0x58c0ae, 0x58c09c]:
        value = read(stack + 4)
        if address in [0x58c0ae, 0x58c09c]:
            value &= 0xffff
            finish(((value & 255) << 8) | (value >> 8), 4)
        else:
            finish(int.from_bytes(struct.pack('<I', value), 'big'), 4)
    elif address == 0x523ff0:
        assert read(stack + 4) == 0x1020000
        finish(SERVICE, 4)
    elif address == TYPE:
        finish(0x1234)
    elif address == GET_LOGGER:
        finish(LOGGER)
    elif address == LOG_LEVEL:
        finish(0)
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == RECEIVER
        assert read(stack + 4) == RECORD and read(stack + 8) == field
        events.append(dict(index=32, context=read(stack + 12),
                           texture=list(struct.unpack('<3I', uc.mem_read(RECORD + 0x110, 12)))))
        finish(0, 12)


for address in [0x58c0a8, 0x58c0ae, 0x58c09c, 0x523ff0, TYPE, GET_LOGGER, LOG_LEVEL, RECEIVED]:
    uc.hook_add(UC_HOOK_CODE, receive_hook, begin=address, end=address)
write(METADATA, METADATA_VTABLE); write(METADATA_VTABLE, TYPE)
write(RECEIVER, RECEIVER_VTABLE); write(RECEIVER_VTABLE + 4, RECEIVED)
write(SERVICE, SERVICE_VTABLE); write(SERVICE_VTABLE + 0x18, GET_LOGGER)
write(LOGGER, LOGGER_VTABLE); write(LOGGER_VTABLE + 0x14, LOG_LEVEL)
call(0x528430, manager, RECORD)
call(0x5284c0, manager, METADATA)
write(RECORD + 8, RECEIVER)

rows = []
values_sets = [[0, 0, 0], [10011, 10012, 10013], [0xffffffff, 0x80000000, 0xf1234567]]
for values in values_sets:
    for operation in [1, 2, 3]:
        write(RECORD + 0x110, 71, 72, 73)
        count = 3
        payload = bytes([operation]) + struct.pack('>3H', 3, 4, count)
        for slot, value in enumerate(values):
            if operation == 2:
                payload += struct.pack('>H', slot)
            payload += struct.pack('>I', value)
        segment = bytes([4, 32]) + struct.pack('>H', len(payload)) + payload
        header = bytearray(32)
        header[4:8] = struct.pack('>I', 0x1234)
        header[0x14:0x18] = struct.pack('>I', 0x11223344)
        header[0x1f] = 1
        raw = bytes(header) + segment
        uc.mem_write(RAW, raw)
        call(0x53d9c0, MESSAGE, RAW, len(raw))
        events.clear()
        dirty = bytes(uc.mem_read(manager + 0x40, 32))
        assert call(0x52a280, manager, MESSAGE) & 255 == 1
        pointer = call(0x4327ac, ROLE, 3)
        result = list(struct.unpack('<3I', uc.mem_read(pointer, 12)))
        assert result == values
        assert events == [dict(index=32, context=0x11223344, texture=values)]
        assert dirty == bytes(uc.mem_read(manager + 0x40, 32))
        rows.append(dict(operation=operation, wire=list(raw), values=values, getter=result, events=list(events)))

# The ordinary role array setter does not support selector3; it has no texture producer.
logs = []


def logger(machine, address, size, data):
    logs.append('unsupported-array-selector3')
    finish()


uc.hook_add(UC_HOOK_CODE, logger, begin=0x40bd28, end=0x40bd28)
write(RESULT, 10011, 10012, 10013)
before = bytes(uc.mem_read(RECORD + 0x110, 12))
assert call(0x432826, ROLE, 3, RESULT) & 255 == 0
assert before == bytes(uc.mem_read(RECORD + 0x110, 12)) and logs

PROFILE, INVENTORY, VECTOR, OWNED = 0x200b000, 0x200c000, 0x200d000, 0x200e000
profile_rows = []
for instance in [71, 0x80000000, 0xf1234567, 0xffffffff]:
    write(PROFILE, 0x5c4118)
    write(PROFILE + 0x118, instance)
    selected_instance = call(read(0x5c4118 + 0x18), PROFILE, 44)
    assert selected_instance == instance
    write(INVENTORY + 0x30, VECTOR, VECTOR + 4)
    write(VECTOR, OWNED)
    write(OWNED + 4, instance)
    assert call(0x43ccf2, INVENTORY, selected_instance) == OWNED
    assert call(0x43ccf2, INVENTORY, instance ^ 1) == 0
    assert before == bytes(uc.mem_read(RECORD + 0x110, 12))
    profile_rows.append(dict(instanceId=instance, profileSelector=44,
                             profileOffset=0x118, ownedLookupMatched=True,
                             roleTextureUnchanged=True))

output = dict(status='PASS', constructorRows=constructor_rows,
    binding=dict(index=32, name='m_arrayTexture', offset=0x110, count=3, width=4),
    receivedRows=rows, unsupportedRoleArraySetter3=True,
    profileInstanceRows=profile_rows,
    scope='Complete523303 constructor, complete5221a0 registration, actual schema manager/array receive52a280 through544950/52a8f0 and actual4327ac getter3. Allocation/import conversion/logger and observer boundary supplied; constructor backend initialized by real original code. No account ownership or selected-skin producer established.')
(ROOT / 'recovery/output/role-skin-selection-sol-native.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS four full constructor memory fills, real texture binding, nine receive/getter3 contracts and unsupported setter3')
