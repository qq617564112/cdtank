"""Execute complete original role property registration and bound HP value access."""
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


call(0x523303, RECORD)
call(0x5221a0, RECORD)
manager = read(RECORD + 4)
begin, end = read(manager + 0x18), read(manager + 0x1c)
assert (end - begin) // 4 == 34
assert len(registrations) == len(bindings) == 34
properties = []
for index, entry in enumerate(range(begin, end, 4)):
    field = read(entry)
    assert uc.mem_read(field + 8, 1)[0] == index
    properties.append(dict(index=index, **registrations[index],
                           offset=bindings[field], vtable=read(field)))
assert properties[12] == dict(index=12, name='m_iHP', registrationKind='numeric',
                             type=5, offset=0x54, vtable=0x5dc1fc)
assert properties[13] == dict(index=13, name='m_iMaxHP', registrationKind='numeric',
                             type=5, offset=0x58, vtable=0x5dc1fc)
assert uc.mem_read(0x61f8a8 + 5, 1)[0] == 4
rows = []
for index in [12, 13]:
    field = read(begin + index * 4)
    for bits in [0, 1, 200, 0xffffffff, 0x80000000]:
        for high_bits in [0, 0x11223344]:
            write(RECORD + 0x54, 37, 200)
            before = bytes(uc.mem_read(RECORD, 0x12c))
            accepted = bool(call(read(read(field) + 0x1c), field, bits, high_bits) & 255)
            assert accepted
            after = bytes(uc.mem_read(RECORD, 0x12c))
            offset = properties[index]['offset']
            assert after == before[:offset] + struct.pack('<I', bits) + before[offset + 4:]
            write(RESULT, 0xaaaaaaaa, 0xbbbbbbbb)
            call(read(read(field) + 0x18), field, RESULT)
            assert [read(RESULT), read(RESULT + 4)] == [bits, 0]
            hp, max_hp = struct.unpack('<2i', uc.mem_read(RECORD + 0x54, 8))
            rows.append(dict(index=index, bits=bits, highBits=high_bits,
                             result=dict(hp=hp, maxHp=max_hp)))

# Execute the real record notification thunk and manager dirty-bit method.
dirty_rows = []
for seed in [[0] * 8, [0x12345678, 0x80000000, 0, 1, 0xffffffff, 0, 4, 8]]:
    for index in range(256):
        write(manager + 0x40, *seed)
        call(0x521e8a, RECORD, index)
        words = [read(manager + 0x40 + i * 4) for i in range(8)]
        expected = list(seed)
        if index == 0xfe:
            expected = [0xffffffff] * 8
        elif index != 0xff:
            expected[index >> 5] |= 1 << (index & 31)
        assert words == expected
        dirty_rows.append(dict(seed=seed, index=index, words=words))

# Complete original HP setter with a real constructed record/manager.
ROLE, OBSERVER, OBSERVER_VTABLE, CHANGE = 0x2004000, 0x2005000, 0x2005100, 0x2103000
health_events = []


def health_state():
    hp, max_hp = struct.unpack('<2i', uc.mem_read(RECORD + 0x54, 8))
    return dict(hp=hp, maxHp=max_hp)


def health_hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x529a10:
        assert machine.reg_read(UC_X86_REG_ECX) == manager
        assert read(stack + 4) == 12
        health_events.append(dict(kind='notify', index=12, state=health_state()))
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == OBSERVER + 0x20
        assert read(stack + 4) == ROLE
        previous = struct.unpack('<i', uc.mem_read(stack + 8, 4))[0]
        health_events.append(dict(kind='changed', previousHp=previous, state=health_state()))
        finish(0, 8)


for address in [0x529a10, CHANGE]:
    uc.hook_add(UC_HOOK_CODE, health_hook, begin=address, end=address)
write(OBSERVER + 4, OBSERVER + 0x20)
write(OBSERVER + 0x20, OBSERVER_VTABLE)
write(OBSERVER_VTABLE + 8, CHANGE)
health_rows = []
health_source = json.loads((ROOT / 'recovery/output/role-health-native.json').read_text())
for row in health_source['rows']:
    write(ROLE + 0x2a0, RECORD if row['present'] else 0)
    write(ROLE + 0xb8, OBSERVER if row['observer'] else 0)
    write(RECORD + 0x54, row['before'], row['maxHp'])
    write(manager + 0x40, *([0] * 8))
    health_events.clear()
    accepted = bool(call(0x433250, ROLE, 15, row['value']) & 255)
    words = [read(manager + 0x40 + i * 4) for i in range(8)]
    assert accepted == row['accepted']
    assert (health_state() if row['present'] else None) == row['result']
    assert health_events == row['events']
    assert words == ([1 << 12] + [0] * 7 if row['present'] else [0] * 8)
    health_rows.append(dict(**row, words=words))

# Real529a60 scans all34 registered properties with native numeric/array probes.
fields = [read(begin + i * 4) for i in range(34)]
field_indices = {field: i for i, field in enumerate(fields)}
descriptors = []
for field in fields:
    category = call(read(read(field) + 0xc), field)
    if category in [1, 4]:
        type_id = read(field + 0xc)
        size_table = 0x61f8a8 if category == 1 else 0x61f7ac
        length = uc.mem_read(size_table + type_id, 1)[0]
        if category == 4:
            length *= read(field + 0x34)
        current, snapshot = read(field + 0x2c), read(field + 0x30)
        data = bytes(uc.mem_read(current, length))
        uc.mem_write(snapshot, data)
        descriptors.append(dict(category=category, current=current, snapshot=snapshot,
                                length=length, baseline=list(data)))
    else:
        # The real nickname and its constructor snapshot are both empty here.
        assert category == 2 and read(read(field + 0x28) + 0x14) == 0
        assert read(field + 0x40) == 0
        descriptors.append(dict(category=category))
visits = []


def probe_hook(machine, address, size, data):
    visits.append(field_indices[machine.reg_read(UC_X86_REG_ECX)])


for address in [0x545eb0, 0x545990, 0x5448e0]:
    uc.hook_add(UC_HOOK_CODE, probe_hook, begin=address, end=address)
detect_rows = []
mutations = [[], [12], [13], [12, 13], [33]] + [
    [index] for index, descriptor in enumerate(descriptors)
    if descriptor['category'] in [1, 4] and index not in [12, 13, 33]]
for mode in [0, 1, 2]:
    for schema_mode in [1, 2]:
        for seed in [[0] * 8, [1 << 12] + [0] * 7, [0] * 7 + [0x80000000]]:
            for changed in mutations:
                inputs = []
                for index, descriptor in enumerate(descriptors):
                    category = descriptor['category']
                    entry = dict(category=category)
                    if category in [1, 4]:
                        data = bytearray(descriptor['baseline'])
                        if index in changed:
                            data[-1] ^= 0x80
                        uc.mem_write(descriptor['current'], bytes(data))
                        entry.update(current=list(data), snapshot=descriptor['baseline'])
                    inputs.append(entry)
                write(manager + 0xc, mode)
                write(manager + 0x3c, schema_mode)
                write(manager + 0x40, *seed)
                visits.clear()
                detected = bool(call(0x529a60, manager) & 255)
                words = [read(manager + 0x40 + i * 4) for i in range(8)]
                scanned = mode == 1 and (schema_mode != 2 or any(seed))
                expected = [0] * 8 if scanned else list(seed)
                if scanned:
                    for index in changed:
                        expected[index >> 5] |= 1 << (index & 31)
                assert words == expected
                assert detected == (scanned and bool(changed))
                assert visits == (list(range(34)) if scanned else [])
                for descriptor in descriptors:
                    if descriptor['category'] in [1, 4]:
                        assert list(uc.mem_read(descriptor['snapshot'], descriptor['length'])) == descriptor['baseline']
                detect_rows.append(dict(mode=mode, schemaMode=schema_mode, seed=seed,
                                        properties=inputs, detected=detected, words=words,
                                        visits=list(visits)))

# The real segment buffer uses Winsock htons only for its payload-size header.
def htons_hook(machine, address, size, data):
    value = read(machine.reg_read(UC_X86_REG_ESP) + 4) & 0xffff
    finish(((value & 255) << 8) | (value >> 8), 4)


uc.hook_add(UC_HOOK_CODE, htons_hook, begin=0x58c09c, end=0x58c09c)
wire_rows = []
for index in [12, 13]:
    field = fields[index]
    for bits in [0, 1, 37, 200, 0xffffffff, 0x80000000, 0x12345678]:
        write(RECORD + properties[index]['offset'], bits)
        result = call(0x545f10, field, RESULT)
        assert result == RESULT
        pointer = read(result + 0x218)
        wire = bytes(uc.mem_read(pointer, 8))
        assert wire == bytes([1, index, 0, 4]) + struct.pack('>I', bits)
        call(0x563ee0, RESULT)
        # Original send path529d67 subsequently refreshes this snapshot.
        call(0x545ee0, field)
        assert read(read(field + 0x30)) == bits
        assert not (call(0x545eb0, field) & 255)
        wire_rows.append(dict(index=index, bits=bits, bytes=list(wire), snapshot=bits))

# Actual array segment544c70 full/delta serialization.
array_wire_rows = []
for index in range(28, 34):
    field = fields[index]
    width = uc.mem_read(0x61f7ac + read(field + 0xc), 1)[0]
    count = read(field + 0x34)
    assert width in [1, 2, 4]
    mask = (1 << (8 * width)) - 1
    baseline = [(slot + 1) & mask for slot in range(count)]
    for mode, changed in [(1, []), (0, []), (0, [0]), (0, [count - 1]),
                          (0, list(range(count))), (0, list(range(count // 2)))]:
        values = list(baseline)
        for slot in changed:
            values[slot] = (values[slot] + 0x31) & mask
        uc.mem_write(read(field + 0x2c), b''.join(value.to_bytes(width, 'little') for value in values))
        uc.mem_write(read(field + 0x30), b''.join(value.to_bytes(width, 'little') for value in baseline))
        assert call(0x544c70, field, RESULT, mode) == RESULT
        pointer = read(RESULT + 0x218)
        length = call(0x53fad0, RESULT)
        wire = bytes(uc.mem_read(pointer, length))
        operation = 1 if mode == 1 else 3 if len(changed) * (width + 2) > count * width else 2
        slots = list(range(count)) if operation in [1, 3] else changed
        payload = bytes([operation]) + struct.pack('>3H', count, width, len(slots))
        for slot in slots:
            if operation == 2:
                payload += struct.pack('>H', slot)
            payload += values[slot].to_bytes(width, 'big')
        assert wire == bytes([4, index]) + struct.pack('>H', len(payload)) + payload
        array_wire_rows.append(dict(index=index, width=width, count=count, mode=mode,
                                    baseline=baseline, values=values, bytes=list(wire)))
        call(0x563ee0, RESULT)

# All342 source skill IDs through the actual16-slot field encoder.
source_skill_catalog = []
for row in read_table(ROOT / 'CDTank/Data/table/skill.dat')['rows']:
    values = row['values']
    source_skill_catalog.append(dict(
        skillId=int(values['SkillTableID']), triggerType=int(values['TriggerType']),
        functions=[dict(type=int(values[f'FuncType{i}']), t=int(values[f'FuncT{i}'])) for i in range(1, 4)]))
source_skill_ids = [skill['skillId'] for skill in source_skill_catalog]
assert len(source_skill_ids) == 342
for start in range(0, len(source_skill_ids), 16):
    values = source_skill_ids[start:start + 16]
    values += [0] * (16 - len(values))
    field = fields[31]
    uc.mem_write(read(field + 0x2c), struct.pack('<16I', *values))
    uc.mem_write(read(field + 0x30), bytes(64))
    call(0x544c70, field, RESULT, 1)
    pointer = read(RESULT + 0x218)
    wire = bytes(uc.mem_read(pointer, call(0x53fad0, RESULT)))
    assert wire == bytes([4, 31, 0, 71, 1, 0, 16, 0, 4, 0, 16]) + struct.pack('>16I', *values)
    array_wire_rows.append(dict(index=31, width=4, count=16, mode=1,
                                baseline=[0] * 16, values=values, bytes=list(wire), sourceSkillIds=True))
    call(0x563ee0, RESULT)

# Execute manager52a280 -> segment53dbd0 -> numeric545ff0 -> observer52a8f0.
MESSAGE, RAW, METADATA, METADATA_VTABLE = 0x2007000, 0x2008000, 0x2009000, 0x2009100
RECEIVER, RECEIVER_VTABLE = 0x2009200, 0x2009300
SERVICE, SERVICE_VTABLE, LOGGER, LOGGER_VTABLE = 0x2009400, 0x2009500, 0x2009600, 0x2009700
TYPE, GET_LOGGER, LOG_LEVEL, RECEIVED = 0x2104000, 0x2104100, 0x2104200, 0x2104300
received_events = []


def receive_hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address in [0x58c0a8, 0x58c0ae]:
        value = read(stack + 4)
        if address == 0x58c0ae:
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
        assert read(stack + 4) == RECORD
        field = read(stack + 8)
        received_events.append(dict(index=field_indices[field], context=read(stack + 12),
                                    state=health_state()))
        if globals().get('bullet_capture', False):
            bullet_events.append(dict(index=field_indices[field], context=read(stack + 12),
                                      bullet=read(RECORD + 0x44), maximum=read(RECORD + 0x38), **health_state()))
        finish(0, 12)


for address in [0x58c0a8, 0x58c0ae, 0x523ff0, TYPE, GET_LOGGER, LOG_LEVEL, RECEIVED]:
    uc.hook_add(UC_HOOK_CODE, receive_hook, begin=address, end=address)
write(METADATA, METADATA_VTABLE)
write(METADATA_VTABLE, TYPE)
write(RECEIVER, RECEIVER_VTABLE)
write(RECEIVER_VTABLE + 4, RECEIVED)
write(SERVICE, SERVICE_VTABLE)
write(SERVICE_VTABLE + 0x18, GET_LOGGER)
write(LOGGER, LOGGER_VTABLE)
write(LOGGER_VTABLE + 0x14, LOG_LEVEL)
call(0x528430, manager, RECORD)
call(0x5284c0, manager, METADATA)
write(RECORD + 8, RECEIVER)
receive_rows = []
segments = [row['bytes'] for row in wire_rows]
cases = [[segment] for segment in segments] + [
    [segments[2], segments[9]], [segments[9], segments[2]],
    [segments[2], segments[2]],
    [[1, 12, 0, 3, 1, 2, 3]],
    [[2, 12, 0, 4, 0, 0, 0, 37]],
    [[1, 35, 0, 4, 0, 0, 0, 37]],
    [segments[2], [1, 13, 0, 3, 1, 2, 3]],
]
for observer in [False, True]:
    write(RECORD + 8, RECEIVER if observer else 0)
    for packet_segments in cases:
        write(RECORD + 0x54, 37, 200)
        write(manager + 0x40, *([0x12345678] + [0] * 7))
        saved = [bytes(uc.mem_read(read(fields[index] + 0x30), 4)) for index in [12, 13]]
        payload = b''.join(bytes(segment) for segment in packet_segments)
        header = bytearray(32)
        header[4:8] = struct.pack('>I', 0x1234)
        header[0x14:0x18] = struct.pack('>I', 0x11223344)
        header[0x1f] = len(packet_segments)
        uc.mem_write(RAW, bytes(header) + payload)
        call(0x53fd20, MESSAGE)
        call(0x53fee0, MESSAGE, RAW, 32 + len(payload))
        write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
        call(0x53fbb0, MESSAGE, 32)
        received_events.clear()
        accepted = bool(call(0x52a280, manager, MESSAGE) & 255)
        expected = dict(hp=37, maxHp=200)
        expected_events = []
        expected_accepted = True
        for segment in packet_segments:
            if segment[0] != 1 or segment[1] not in [12, 13] or segment[2:4] != [0, 4]:
                expected_accepted = False
                break
            value = struct.unpack('>i', bytes(segment[4:8]))[0]
            expected['hp' if segment[1] == 12 else 'maxHp'] = value
            if observer:
                expected_events.append(dict(index=segment[1], context=0x11223344,
                                            state=dict(expected)))
        assert accepted == expected_accepted
        assert health_state() == expected
        assert received_events == expected_events
        assert [read(manager + 0x40 + i * 4) for i in range(8)] == [0x12345678] + [0] * 7
        assert saved == [bytes(uc.mem_read(read(fields[index] + 0x30), 4)) for index in [12, 13]]
        call(0x563ee0, MESSAGE)
        receive_rows.append(dict(observer=observer, segments=packet_segments,
                                 accepted=accepted, result=expected, events=list(received_events)))

# Real array reader544950 through manager52a280 and observer52a8f0.
ARRAY_RECEIVED = 0x2104b00
array_events = []


def array_state():
    return {str(index): [int.from_bytes(uc.mem_read(read(fields[index] + 0x2c) + slot * width, width), 'little')
                        for slot in range(read(fields[index] + 0x34))]
            for index in range(28, 34)
            for width in [uc.mem_read(0x61f7ac + read(fields[index] + 0xc), 1)[0]]}


def array_received_hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == RECEIVER and read(stack + 4) == RECORD
    array_events.append(dict(index=field_indices[read(stack + 8)], context=read(stack + 12),
                             arrays=array_state()))
    finish(0, 12)


uc.hook_add(UC_HOOK_CODE, array_received_hook, begin=ARRAY_RECEIVED, end=ARRAY_RECEIVED)
write(RECEIVER_VTABLE + 4, ARRAY_RECEIVED)
array_receive_rows = []
array_cases = [[row['bytes']] for row in array_wire_rows]
# The reader logs dimension differences, but does not reject them.
for operation, declared_count, width, values in [(1, 15, 4, [2001] * 15), (3, 16, 4, [2001] * 16),
                                                (1, 16, 2, [37] * 16), (7, 16, 4, [])]:
    payload = bytes([operation]) + struct.pack('>3H', declared_count, width, len(values))
    payload += b''.join(value.to_bytes(width, 'big') for value in values)
    array_cases.append([list(bytes([4, 31]) + struct.pack('>H', len(payload)) + payload)])
array_cases += [[array_wire_rows[18]['bytes'], array_wire_rows[18]['bytes']],
                [array_wire_rows[18]['bytes'], array_cases[-1][0]],
                [array_wire_rows[18]['bytes'], array_wire_rows[0]['bytes']]]
for observer in [False, True]:
    write(RECORD + 8, RECEIVER if observer else 0)
    for packet_segments in array_cases:
        for index in range(28, 34):
            width = uc.mem_read(0x61f7ac + read(fields[index] + 0xc), 1)[0]
            count = read(fields[index] + 0x34)
            uc.mem_write(read(fields[index] + 0x2c), b''.join((slot + 1).to_bytes(width, 'little') for slot in range(count)))
        before = array_state()
        saved = [bytes(uc.mem_read(read(fields[index] + 0x30), descriptors[index]['length'])) for index in range(28, 34)]
        dirty = bytes(uc.mem_read(manager + 0x40, 32))
        payload = b''.join(bytes(segment) for segment in packet_segments)
        header = bytearray(32)
        header[4:8] = struct.pack('>I', 0x1234)
        header[0x14:0x18] = struct.pack('>I', 0x11223344)
        header[0x1f] = len(packet_segments)
        raw = bytes(header) + payload
        uc.mem_write(RAW, raw)
        call(0x53d9c0, MESSAGE, RAW, len(raw))
        array_events.clear()
        accepted = bool(call(0x52a280, manager, MESSAGE) & 255)
        expected = {key: list(values) for key, values in before.items()}
        expected_events = []
        expected_accepted = True
        for segment in packet_segments:
            index = segment[1]
            operation = segment[4]
            if operation not in [1, 2, 3]:
                expected_accepted = False
                break
            count, width, entries = struct.unpack('>3H', bytes(segment[5:11]))
            target = bytearray(b''.join(value.to_bytes(uc.mem_read(0x61f7ac + read(fields[index] + 0xc), 1)[0], 'little')
                                        for value in expected[str(index)]))
            cursor = 11
            for entry in range(entries if operation == 2 else count):
                slot = struct.unpack('>H', bytes(segment[cursor:cursor + 2]))[0] if operation == 2 else entry
                if operation == 2:
                    cursor += 2
                target[slot * width:(slot + 1) * width] = bytes(segment[cursor:cursor + width])[::-1]
                cursor += width
            native_width = uc.mem_read(0x61f7ac + read(fields[index] + 0xc), 1)[0]
            expected[str(index)] = [int.from_bytes(target[slot:slot + native_width], 'little')
                                    for slot in range(0, len(target), native_width)]
            if observer:
                expected_events.append(dict(index=index, context=0x11223344,
                                            arrays={key: list(values) for key, values in expected.items()}))
        assert accepted == expected_accepted and array_state() == expected
        assert array_events == expected_events
        assert bytes(uc.mem_read(manager + 0x40, 32)) == dirty
        for index, snapshot in zip(range(28, 34), saved):
            assert bytes(uc.mem_read(read(fields[index] + 0x30), len(snapshot))) == snapshot
        array_receive_rows.append(dict(observer=observer, segments=packet_segments, before=before,
                                       accepted=accepted, result=expected, events=list(array_events)))
        call(0x563ee0, MESSAGE)
write(RECEIVER_VTABLE + 4, RECEIVED)

# Execute original manager route52af80, including real command5 receive chain.
route_calls = []
native_creation = False


def route_hook(machine, address, size, data):
    if native_creation and address == 0x5285a0:
        return
    assert machine.reg_read(UC_X86_REG_ECX) == manager
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert read(stack + 4) == MESSAGE
    route_calls.append('command3' if address == 0x5285a0 else 'commands6To9')
    finish(0, 4)


for address in [0x5285a0, 0x528a50]:
    uc.hook_add(UC_HOOK_CODE, route_hook, begin=address, end=address)
call(0x528490, manager, 73)
route_rows = []
route_cases = [(5, item) for item in cases] + [(command, [segments[2]]) for command in [0, 3, 4, 6, 7, 8, 9, 10]]
for message_object_id in [73, 74]:
    for command, packet_segments in route_cases:
        write(RECORD + 8, RECEIVER)
        write(RECORD + 0x54, 37, 200)
        payload = b''.join(bytes(segment) for segment in packet_segments)
        header = bytearray(32)
        header[4:8] = struct.pack('>I', 0x1234)
        header[0x10:0x14] = struct.pack('>I', message_object_id)
        header[0x14:0x18] = struct.pack('>I', 0x11223344)
        header[0x1e] = command
        header[0x1f] = len(packet_segments)
        uc.mem_write(RAW, bytes(header) + payload)
        call(0x53fd20, MESSAGE)
        call(0x53fee0, MESSAGE, RAW, 32 + len(payload))
        write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
        call(0x53fbb0, MESSAGE, 32)
        received_events.clear()
        route_calls.clear()
        handled = bool(call(0x52af80, manager, MESSAGE) & 255)
        expected_handled = message_object_id == 73 and command in [3, 5, 6, 7, 8, 9]
        assert handled == expected_handled
        if expected_handled and command == 5:
            original = next(row for row in receive_rows if row['observer'] and row['segments'] == packet_segments)
            assert health_state() == original['result']
            assert received_events == original['events']
            assert not route_calls
        else:
            assert health_state() == dict(hp=37, maxHp=200)
            assert not received_events
            assert route_calls == (['command3' if command == 3 else 'commands6To9'] if expected_handled else [])
        call(0x563ee0, MESSAGE)
        route_rows.append(dict(objectId=73, messageObjectId=message_object_id,
                               command=command, segments=packet_segments, handled=handled,
                               result=health_state(), events=list(received_events), calls=list(route_calls)))

# Original unsigned bullet property8 through full numeric serialization and command5 route.
assert properties[8] == dict(index=8, name='m_iBullet', registrationKind='numeric',
                            type=14, offset=0x44, vtable=0x5dc1fc)
assert properties[5] == dict(index=5, name='m_iMaxBullet', registrationKind='numeric',
                            type=5, offset=0x38, vtable=0x5dc1fc)
bullet_wire_rows = []
for index in [8, 5]:
    for bits in [0, 1, 2, 5, 99, 0x7fffffff, 0x80000000, 0xffffffff]:
        write(RECORD + properties[index]['offset'], bits)
        call(0x545f10, fields[index], RESULT)
        wire = bytes(uc.mem_read(read(RESULT + 0x218), 8))
        assert wire == bytes([1, index, 0, 4]) + struct.pack('>I', bits)
        bullet_wire_rows.append(dict(index=index, bits=bits, bytes=list(wire)))
        call(0x563ee0, RESULT)

bullet_events = []
bullet_capture = False
bullet_accepted = None


def bullet_result_hook(machine, address, size, data):
    global bullet_accepted
    if bullet_capture:
        bullet_accepted = bool(machine.reg_read(UC_X86_REG_EAX) & 255)


uc.hook_add(UC_HOOK_CODE, bullet_result_hook, begin=0x52b01a, end=0x52b01a)


bullet_receive_rows = []
bullet_cases = [[row['bytes']] for row in bullet_wire_rows] + [
    [bullet_wire_rows[1]['bytes'], segments[2], bullet_wire_rows[2]['bytes']],
    [bullet_wire_rows[1]['bytes'], bullet_wire_rows[1]['bytes']],
    [bullet_wire_rows[9]['bytes'], bullet_wire_rows[1]['bytes']],
    [bullet_wire_rows[1]['bytes'], bullet_wire_rows[9]['bytes']],
    [[1, 8, 0, 3, 1, 2, 3]],
    [[2, 8, 0, 4, 0, 0, 0, 1]],
    [bullet_wire_rows[1]['bytes'], [1, 8, 0, 3, 1, 2, 3]],
]
for observer in [False, True]:
    for message_object_id in [73, 74]:
        for packet_segments in bullet_cases:
            write(RECORD + 8, RECEIVER if observer else 0)
            write(RECORD + 0x44, 5)
            write(RECORD + 0x38, 3)
            write(RECORD + 0x54, 37, 200)
            pending = [0x12345678] + [0] * 7
            write(manager + 0x40, *pending)
            saved = [bytes(uc.mem_read(read(fields[index] + 0x30), 4)) for index in [5, 8, 12, 13]]
            payload = b''.join(bytes(segment) for segment in packet_segments)
            header = bytearray(32)
            header[4:8] = struct.pack('>I', 0x1234)
            header[0x10:0x14] = struct.pack('>I', message_object_id)
            header[0x14:0x18] = struct.pack('>I', 0x11223344)
            header[0x1e] = 5
            header[0x1f] = len(packet_segments)
            raw = bytes(header) + payload
            uc.mem_write(RAW, raw)
            call(0x53fd20, MESSAGE)
            call(0x53fee0, MESSAGE, RAW, len(raw))
            write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
            call(0x53fbb0, MESSAGE, 32)
            bullet_events.clear()
            bullet_accepted = None
            bullet_capture = True
            handled = bool(call(0x52af80, manager, MESSAGE) & 255)
            bullet_capture = False
            expected = dict(bullet=5, maximum=3, hp=37, maxHp=200)
            expected_events = []
            accepted = None
            if message_object_id == 73:
                accepted = True
                for segment in packet_segments:
                    if segment[0] != 1 or segment[1] not in [5, 8, 12, 13] or segment[2:4] != [0, 4]:
                        accepted = False
                        break
                    index = segment[1]
                    value = struct.unpack('>I' if index in [5, 8] else '>i', bytes(segment[4:8]))[0]
                    expected[{5: 'maximum', 8: 'bullet', 12: 'hp', 13: 'maxHp'}[index]] = value
                    if observer:
                        expected_events.append(dict(index=index, context=0x11223344, **expected))
            assert handled == (message_object_id == 73)
            assert bullet_accepted == accepted
            assert dict(bullet=read(RECORD + 0x44), maximum=read(RECORD + 0x38), **health_state()) == expected
            assert bullet_events == expected_events
            assert [read(manager + 0x40 + i * 4) for i in range(8)] == pending
            assert saved == [bytes(uc.mem_read(read(fields[index] + 0x30), 4)) for index in [5, 8, 12, 13]]
            bullet_receive_rows.append(dict(observer=observer, raw=list(raw), segments=packet_segments,
                                            handled=handled, accepted=accepted, result=expected,
                                            events=list(bullet_events), pending=pending))
            call(0x563ee0, MESSAGE)
write(RECORD + 0x44, 0)
write(RECORD + 0x38, 0)

# Prepared one-node registry trees; lookup550b30 and all3 dispatchers execute.
REGISTRY = 0x200a000
registry_rows = []
uc.mem_write(0x61ecc4, struct.pack('<H', 0x4321))
for tree_offset, dispatcher in [(8, 0x525630), (0x20, 0x525730), (0x14, 0x525830)]:
    sentinel, node = 0x200a100, 0x200a200
    write(REGISTRY + tree_offset + 4, sentinel)
    write(sentinel, node, node, node)
    uc.mem_write(sentinel + 0x15, b'\x01')
    write(node, sentinel, sentinel, sentinel, 73, RECORD)
    uc.mem_write(node + 0x15, b'\x00')
    for message_object_id in [73, 74]:
        for message_type in [0x4321, 0x4322]:
            for command in [5, 4]:
                for packet_segments in [[segments[2]], cases[-1]]:
                    write(RECORD + 0x54, 37, 200)
                    received_events.clear()
                    payload = b''.join(bytes(segment) for segment in packet_segments)
                    header = bytearray(32)
                    header[4:8] = struct.pack('>I', 0x1234)
                    header[0xc:0xe] = struct.pack('>H', message_type)
                    header[0x10:0x14] = struct.pack('>I', message_object_id)
                    header[0x14:0x18] = struct.pack('>I', 0x11223344)
                    header[0x1e] = command
                    header[0x1f] = len(packet_segments)
                    uc.mem_write(RAW, bytes(header) + payload)
                    call(0x53fd20, MESSAGE)
                    call(0x53fee0, MESSAGE, RAW, 32 + len(payload))
                    write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
                    call(0x53fbb0, MESSAGE, 32)
                    handled = bool(call(dispatcher, REGISTRY, MESSAGE) & 255)
                    routed = message_object_id == 73 and message_type == 0x4321
                    assert handled == (routed and command == 5)
                    expected_events = [dict(index=12, context=0x11223344,
                                            state=dict(hp=37, maxHp=200))] if routed and command == 5 else []
                    assert received_events == expected_events
                    assert health_state() == dict(hp=37, maxHp=200)
                    call(0x563ee0, MESSAGE)
                    registry_rows.append(dict(dispatcher=dispatcher, messageObjectId=message_object_id,
                                              messageType=message_type, recordType=0x4321,
                                              command=command, segments=packet_segments,
                                              handled=handled, events=list(received_events)))

# Full registry constructor, registration and erase; network/retirement are boundaries.
LIVE_REGISTRY, NETWORK, NETWORK_VTABLE, NETWORK_EVENTS = 0x200b000, 0x200b100, 0x200b200, 0x200b300
NETWORK_ARG = 0x2104400
lifecycle_events = []
native_lifecycle_dispatch = False
native_retirement = False


def registry_state():
    tables = {}
    for name, offset in [('all', 8), ('mode1', 0x20), ('mode2', 0x14)]:
        sentinel = read(LIVE_REGISTRY + offset + 4)
        keys = []

        def visit(node):
            if uc.mem_read(node + 0x15, 1)[0]:
                return
            visit(read(node))
            keys.append(read(node + 0xc))
            visit(read(node + 8))

        visit(read(sentinel + 4))
        assert len(keys) == read(LIVE_REGISTRY + offset + 8)
        tables[name] = keys
    return tables


def lifecycle_hook(machine, address, size, data):
    if native_retirement and address == 0x525030:
        return
    if native_lifecycle_dispatch and address in [0x536b70, 0x536dc0]:
        return
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == NETWORK_ARG:
        finish(0xabcdef)
        return
    if address == 0x525030:
        record = read(stack + 4)
        kind, pop = 'retired', 4
    else:
        assert machine.reg_read(UC_X86_REG_ECX) == NETWORK_EVENTS
        assert read(stack + 4) == NETWORK and read(stack + 12) == 0xabcdef
        record = read(stack + 8)
        kind, pop = ('attached' if address == 0x536b70 else 'detached'), 12
    record_manager = read(record + 4)
    lifecycle_events.append(dict(kind=kind, objectId=read(record_manager + 8), state=registry_state()))
    finish(0, pop)


for address in [NETWORK_ARG, 0x536b70, 0x536dc0, 0x525030]:
    uc.hook_add(UC_HOOK_CODE, lifecycle_hook, begin=address, end=address)
write(NETWORK, NETWORK_VTABLE)
write(NETWORK + 0xc, NETWORK_EVENTS)
write(NETWORK_VTABLE + 0x14, NETWORK_ARG)
call(0x5275f0, LIVE_REGISTRY, NETWORK)
assert registry_state() == dict(all=[], mode1=[], mode2=[])

lifecycle_rows = []
records = []
for index, (key, mode) in enumerate([(73, 1), (12, 2), (200, 1), (55, 2), (101, 1)]):
    record = 0x200c000 + index * 0x200
    call(0x523303, record)
    call(0x5221a0, record)
    record_manager = read(record + 4)
    call(0x528490, record_manager, key)
    call(0x5284a0, record_manager, mode)
    call(0x5284c0, record_manager, METADATA)
    records.append((record, key, mode))
    for duplicate in [False, True]:
        before = registry_state()
        lifecycle_events.clear()
        accepted = bool(call(0x528030 if mode == 1 else 0x5280d0, LIVE_REGISTRY, record) & 255)
        assert accepted != duplicate
        after = registry_state()
        if duplicate:
            assert after == before and not lifecycle_events
        else:
            intermediate = {name: list(keys) for name, keys in before.items()}
            intermediate['all'] = sorted(intermediate['all'] + [key])
            assert lifecycle_events == [dict(kind='attached', objectId=key, state=intermediate)]
            expected = {name: list(keys) for name, keys in intermediate.items()}
            table = 'mode1' if mode == 1 else 'mode2'
            expected[table] = sorted(expected[table] + [key])
            assert after == expected
        lifecycle_rows.append(dict(operation='register', objectId=key, mode=mode,
                                   accepted=accepted, state=after, events=list(lifecycle_events)))
live_route_rows = []
for table, dispatcher in [('all', 0x525630), ('mode1', 0x525730), ('mode2', 0x525830)]:
    for key in [73, 12, 200, 55, 101, 999]:
        target = next((record for record, record_key, mode in records if record_key == key), None)
        if target:
            write(target + 0x54, 37, 200)
        header = bytearray(32)
        header[4:8] = struct.pack('>I', 0x1234)
        header[0xc:0xe] = struct.pack('>H', 0x4321)
        header[0x10:0x14] = struct.pack('>I', key)
        header[0x14:0x18] = struct.pack('>I', 0x11223344)
        header[0x1e:0x20] = bytes([5, 1])
        payload = bytes(segments[3])
        uc.mem_write(RAW, bytes(header) + payload)
        call(0x53fd20, MESSAGE)
        call(0x53fee0, MESSAGE, RAW, 40)
        write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
        call(0x53fbb0, MESSAGE, 32)
        handled = bool(call(dispatcher, LIVE_REGISTRY, MESSAGE) & 255)
        assert handled == (key in registry_state()[table])
        state = dict(hp=read(target + 0x54), maxHp=read(target + 0x58)) if target else None
        assert state == (dict(hp=200 if handled else 37, maxHp=200) if target else None)
        call(0x563ee0, MESSAGE)
        live_route_rows.append(dict(table=table, objectId=key, handled=handled, result=state,
                                    segments=[segments[3]]))
for index in [2, 0, 4, 1, 3]:
    record, key, mode = records[index]
    before = registry_state()
    lifecycle_events.clear()
    accepted = bool(call(0x526a70, LIVE_REGISTRY, key) & 255)
    assert accepted
    after = registry_state()
    expected = {name: [value for value in keys if value != key] for name, keys in before.items()}
    assert after == expected
    assert lifecycle_events == [dict(kind='detached', objectId=key, state=before),
                                dict(kind='retired', objectId=key, state=after)]
    lifecycle_rows.append(dict(operation='unregister', objectId=key, mode=mode,
                               accepted=accepted, state=after, events=list(lifecycle_events)))
assert registry_state() == dict(all=[], mode1=[], mode2=[])

# Real network-event forwarding replaces the536b70/536dc0 supplied boundaries.
EVENT_OBSERVER, EVENT_OBSERVER_VTABLE = 0x200d000, 0x200d100
ATTACHED, DETACHED = 0x2104500, 0x2104600
event_calls = []


def event_observer_hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == EVENT_OBSERVER
    network, record, context = [read(stack + i) for i in [4, 8, 12]]
    assert network == NETWORK
    key = read(read(record + 4) + 8)
    event_calls.append(dict(kind='attached' if address == ATTACHED else 'detached',
                           objectId=key, context=context, state=registry_state()))
    finish(0, 12)


for address in [ATTACHED, DETACHED]:
    uc.hook_add(UC_HOOK_CODE, event_observer_hook, begin=address, end=address)
write(EVENT_OBSERVER, EVENT_OBSERVER_VTABLE)
write(EVENT_OBSERVER_VTABLE + 0x24, ATTACHED)
write(EVENT_OBSERVER_VTABLE + 0x28, DETACHED)
native_lifecycle_dispatch = True
event_rows = []
for observer_present in [False, True]:
    call(0x5275f0, LIVE_REGISTRY, NETWORK)
    write(NETWORK_EVENTS + 4, EVENT_OBSERVER if observer_present else 0)
    for row in lifecycle_rows:
        record = next(record for record, key, mode in records if key == row['objectId'])
        event_calls.clear()
        lifecycle_events.clear()
        if row['operation'] == 'register':
            accepted = bool(call(0x528030 if row['mode'] == 1 else 0x5280d0, LIVE_REGISTRY, record) & 255)
        else:
            accepted = bool(call(0x526a70, LIVE_REGISTRY, row['objectId']) & 255)
        assert accepted == row['accepted'] and registry_state() == row['state']
        forwarded = [dict(**event, context=0xabcdef) for event in row['events'] if event['kind'] != 'retired']
        assert event_calls == (forwarded if observer_present else [])
        assert lifecycle_events == [event for event in row['events'] if event['kind'] == 'retired']
        event_rows.append(dict(**row, observer=observer_present, forwarded=list(event_calls)))

# Real mode1 retirement525030 and complete manager cleanup529480/destructors.
freed = []
released_fields = []


def free_hook(machine, address, size, data):
    freed.append(read(machine.reg_read(UC_X86_REG_ESP) + 4))
    finish()


def release_hook(machine, address, size, data):
    released_fields.append(machine.reg_read(UC_X86_REG_ECX))


for address in [0x57a6c7, 0x57bd5d]:
    uc.hook_add(UC_HOOK_CODE, free_hook, begin=address, end=address)
observed_releases = set()
native_retirement = True
cleanup_rows = []
for record, key, mode in records:
    if mode != 1:
        continue
    record_manager = read(record + 4)
    field_begin, field_end = read(record_manager + 0x18), read(record_manager + 0x1c)
    field_pointers = [read(pointer) for pointer in range(field_begin, field_end, 4)]
    for field in field_pointers:
        release = read(read(field) + 0x10)
        if release not in observed_releases:
            uc.hook_add(UC_HOOK_CODE, release_hook, begin=release, end=release)
            observed_releases.add(release)
    uc.mem_write(record_manager + 5, b'\x03')
    write(record_manager + 0x34, NETWORK, METADATA)
    write(record_manager + 0x40, 1 << 12, *([0] * 7))
    before = dict(objectId=read(record_manager + 8), mode=read(record_manager + 0xc),
                  nextFieldIndex=uc.mem_read(record_manager + 4, 1)[0], nextSecondaryIndex=3,
                  fieldCount=len(field_pointers), secondaryCount=0,
                  network=NETWORK, metadata=METADATA)
    profile_before = bytes(uc.mem_read(record, 0x12c))
    manager_before = bytes(uc.mem_read(record_manager, 0x68))
    released_fields.clear()
    freed.clear()
    accepted = bool(call(0x525030, LIVE_REGISTRY, record) & 255)
    assert accepted and released_fields == field_pointers
    assert all(field in freed for field in field_pointers) and field_begin in freed
    assert bytes(uc.mem_read(record, 0x12c)) == profile_before
    after = dict(objectId=read(record_manager + 8), mode=read(record_manager + 0xc),
                 nextFieldIndex=uc.mem_read(record_manager + 4, 1)[0],
                 nextSecondaryIndex=uc.mem_read(record_manager + 5, 1)[0],
                 fieldCount=0, secondaryCount=0,
                 network=read(record_manager + 0x34), metadata=read(record_manager + 0x38))
    assert after == dict(objectId=0xffffffff, mode=0, nextFieldIndex=0, nextSecondaryIndex=0,
                         fieldCount=0, secondaryCount=0, network=0, metadata=0)
    assert bytes(uc.mem_read(record_manager + 0x18, 0x0c)) == bytes(12)
    assert bytes(uc.mem_read(record_manager + 0x28, 0x0c)) == bytes(12)
    for offset, length in [(0x10, 4), (0x3c, 4), (0x40, 32), (0x60, 8)]:
        assert bytes(uc.mem_read(record_manager + offset, length)) == manager_before[offset:offset + length]
    cleanup_rows.append(dict(before=before, after=after, released=list(range(len(field_pointers))),
                             preserved=['owner', 'schemaMode', 'dirtyWords', 'observer', 'recordValues']))

# Mode2 resolves the original type factory entry and executes its real return callback.
FACTORY, FACTORY_ENTRY, FACTORY_RECORD = 0x200e000, 0x200e100, 0x200e200
write(0x8934ac, 0x200e900)
write(0x8934c4, FACTORY)
write(FACTORY + 0x10, FACTORY_ENTRY, FACTORY_ENTRY + 24)
write(FACTORY_ENTRY + 0x10, 0x447e29)
uc.mem_write(0x61ecc4, struct.pack('<H', 0))
call(0x523303, FACTORY_RECORD)
call(0x5221a0, FACTORY_RECORD)
factory_manager = read(FACTORY_RECORD + 4)
call(0x5284a0, factory_manager, 2)
factory_fields = [read(pointer) for pointer in range(read(factory_manager + 0x18), read(factory_manager + 0x1c), 4)]
retirement_rows = []
for mode, type_id in [(0, 0), (2, 2), (2, 0)]:
    call(0x5284a0, factory_manager, mode)
    uc.mem_write(0x61ecc4, struct.pack('<H', type_id))
    freed.clear()
    accepted = bool(call(0x525030, LIVE_REGISTRY, FACTORY_RECORD) & 255)
    assert accepted == (mode != 2 or type_id == 0)
    released = FACTORY_RECORD in freed
    assert released == (mode == 2 and type_id == 0)
    if not released:
        assert not freed and read(factory_manager + 0xc) == mode
    retirement_rows.append(dict(mode=mode, type=type_id, accepted=accepted,
                                released=released, cleared=False))
assert accepted
assert FACTORY_RECORD in freed and factory_manager in freed
assert all(field in freed for field in factory_fields)
factory_return = dict(accepted=accepted, fieldCount=len(factory_fields),
                      recordFreed=True, managerFreed=True, callback=0x447e29)

# Original role static registration through real service523ab0 and factory52c3b0.
REGISTERED_FACTORY = 0x200f000
call(0x52c550, REGISTERED_FACTORY)
write(0x8934c4, REGISTERED_FACTORY)
write(SERVICE + 4, 0xffffffff)
write(SERVICE_VTABLE + 8, 0x523ab0)
call(0x52278d, 0)
registered_begin = read(REGISTERED_FACTORY + 0x10)
registered_end = read(REGISTERED_FACTORY + 0x14)
assert registered_end - registered_begin == 24
assert read(registered_begin + 0xc) == 0x522748
assert read(registered_begin + 0x10) == 0x447e29
assert read(registered_begin + 0x14) == 0x522781
assert struct.unpack('<H', uc.mem_read(0x61ecc4, 2))[0] == 0
name_pointer = read(registered_begin + 4)
role_type_name = bytes(uc.mem_read(name_pointer, 128)).split(b'\0')[0].decode()
created_record = call(read(registered_begin + 0xc), 0)
created_manager = read(created_record + 4)
call(0x5221a0, created_record)
assert (read(created_manager + 0x1c) - read(created_manager + 0x18)) // 4 == 34
call(0x5284a0, created_manager, 2)
call(0x528490, created_manager, 73)
call(0x5284c0, created_manager, METADATA)
call(0x5275f0, LIVE_REGISTRY, NETWORK)
assert call(0x5280d0, LIVE_REGISTRY, created_record) & 255
assert registry_state() == dict(all=[73], mode1=[], mode2=[73])
write(created_record + 0x54, 37, 200)
header = bytearray(32)
header[4:8] = struct.pack('>I', 0x1234)
header[0x10:0x14] = struct.pack('>I', 73)
header[0x14:0x18] = struct.pack('>I', 0x11223344)
header[0x1e:0x20] = bytes([5, 1])
uc.mem_write(RAW, bytes(header) + bytes(segments[3]))
call(0x53fd20, MESSAGE)
call(0x53fee0, MESSAGE, RAW, 40)
write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
call(0x53fbb0, MESSAGE, 32)
assert call(0x525830, LIVE_REGISTRY, MESSAGE) & 255
assert read(created_record + 0x54) == 200
call(0x563ee0, MESSAGE)
freed.clear()
assert call(0x526a70, LIVE_REGISTRY, 73) & 255
assert registry_state() == dict(all=[], mode1=[], mode2=[])
assert created_record in freed and created_manager in freed
registered_factory = dict(name=role_type_name, type=0, count=1,
                           create=0x522748, release=0x447e29, assignType=0x522781,
                           createdFieldCount=34, recordFreed=True, managerFreed=True,
                           beforeHealth=dict(hp=37, maxHp=200), afterHealth=dict(hp=200, maxHp=200),
                           receivedSegment=segments[3], registryEmpty=True)

# Full creation message528170 invokes the registered constructor and schema itself.
GET_METADATA = 0x2104700
metadata_available = True


def metadata_hook(machine, address, size, data):
    assert machine.reg_read(UC_X86_REG_ECX) == NETWORK
    assert read(machine.reg_read(UC_X86_REG_ESP) + 4) == 0x1234
    finish(METADATA if metadata_available else 0, 4)


uc.hook_add(UC_HOOK_CODE, metadata_hook, begin=GET_METADATA, end=GET_METADATA)
write(NETWORK_VTABLE + 0x34, GET_METADATA)
write(NETWORK_VTABLE + 0x44, NETWORK_ARG)
write(NETWORK_VTABLE + 0x48, NETWORK_ARG)
write(NETWORK_EVENTS + 4, 0)
native_creation = True
creation_rows = []
creation_cases = [
    dict(command=3, type=0, metadata=True, segments=[segments[3], segments[10]]),
    dict(command=3, type=0, metadata=True, segments=[[1, 12, 0, 3, 1, 2, 3]]),
    dict(command=3, type=0, metadata=True, segments=[segments[3], [1, 13, 0, 3, 1, 2, 3]]),
    dict(command=4, type=0, metadata=True, segments=[segments[3]]),
    dict(command=3, type=2, metadata=True, segments=[segments[3]]),
    dict(command=3, type=0, metadata=False, segments=[segments[3]]),
]
for case in creation_cases:
    call(0x5275f0, LIVE_REGISTRY, NETWORK)
    metadata_available = case['metadata']
    payload = b''.join(bytes(segment) for segment in case['segments'])
    header = bytearray(32)
    header[4:8] = struct.pack('>I', 0x1234)
    header[0xc:0xe] = struct.pack('>H', case['type'])
    header[0x10:0x14] = struct.pack('>I', 73)
    header[0x1e:0x20] = bytes([case['command'], len(case['segments'])])
    uc.mem_write(RAW, bytes(header) + payload)
    call(0x53fd20, MESSAGE)
    call(0x53fee0, MESSAGE, RAW, 32 + len(payload))
    write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
    call(0x53fbb0, MESSAGE, 32)
    accepted = bool(call(0x528170, LIVE_REGISTRY, MESSAGE) & 255)
    expected_accepted = case['metadata'] and case['type'] == 0 and case['command'] == 3
    assert accepted == expected_accepted
    state = None
    if accepted:
        assert registry_state() == dict(all=[73], mode1=[], mode2=[73])
        sentinel = read(LIVE_REGISTRY + 0xc)
        record = read(read(sentinel + 4) + 0x10)
        record_manager = read(record + 4)
        state = dict(zip(['hp', 'maxHp'], struct.unpack('<2i', uc.mem_read(record + 0x54, 8))))
        expected = dict(hp=0, maxHp=0)
        for segment in case['segments']:
            if segment[0] != 1 or segment[2:4] != [0, 4]:
                break
            expected['hp' if segment[1] == 12 else 'maxHp'] = struct.unpack('>i', bytes(segment[4:8]))[0]
        assert state == expected
        assert read(record_manager + 0x34) == NETWORK
        assert read(record_manager + 0x38) == METADATA
        assert call(0x526a70, LIVE_REGISTRY, 73) & 255
    else:
        assert registry_state() == dict(all=[], mode1=[], mode2=[])
    call(0x563ee0, MESSAGE)
    creation_rows.append(dict(**case, accepted=accepted, result=state, registryEmptyAfterRemoval=True))

# Original category/recipient gate525520 and upper command dispatcher5282e0.
dispatch_rows = []
for category, recipient, command in [(2, 0, 3), (3, 0, 0), (3, 0, 2),
                                      (3, 0, 10), (3, 0xfffffffe, 5),
                                      (3, 0, 6), (3, 0, 7), (3, 0, 8), (3, 0, 9),
                                      (3, 0, 3), (3, 0xfffffffe, 5), (3, 0, 4)]:
    metadata_available = True
    payload = bytes(segments[3])
    header = bytearray(32)
    header[4:8] = struct.pack('>I', 0x1234)
    header[8:12] = struct.pack('>I', recipient)
    header[0x10:0x14] = struct.pack('>I', 73)
    header[0x1d:0x20] = bytes([category, command, 1])
    uc.mem_write(RAW, bytes(header) + payload)
    call(0x53fd20, MESSAGE)
    call(0x53fee0, MESSAGE, RAW, 40)
    write(MESSAGE + 0x218, call(0x53fb90, MESSAGE))
    call(0x53fbb0, MESSAGE, 32)
    before = registry_state()
    accepted = bool(call(0x5282e0, LIVE_REGISTRY, MESSAGE) & 255)
    expected = category == 3 and (command in [2, 3, 4] or
                                command == 5 and 73 in before['mode2'])
    assert accepted == expected
    after = registry_state()
    if command == 3 and accepted:
        assert after == dict(all=[73], mode1=[], mode2=[73])
    elif command == 4 and accepted:
        assert after == dict(all=[], mode1=[], mode2=[])
    else:
        assert after == before
    call(0x563ee0, MESSAGE)
    dispatch_rows.append(dict(category=category, recipient=recipient, command=command,
                              objectId=73, accepted=accepted, before=before, after=after))

# Complete raw-packet constructor and network inlet53ee60.
packet_rows = []
for payload_size in [0, 8, 16, 255, 256, 520]:
    header = bytearray(range(32))
    header[2:4] = b'\xff\xff'
    payload = bytes(index & 255 for index in range(payload_size))
    raw = bytes(header) + payload
    uc.mem_write(RAW, raw)
    assert call(0x53d9c0, MESSAGE, RAW, len(raw)) == MESSAGE
    pointer = read(MESSAGE + 0x218)
    copied = bytes(uc.mem_read(pointer, len(raw)))
    expected = bytearray(raw)
    expected[2:4] = struct.pack('>H', payload_size)
    assert copied == expected
    assert bytes(uc.mem_read(RAW, len(raw))) == raw
    assert call(0x53fad0, MESSAGE) == len(raw)
    packet_rows.append(dict(raw=list(raw), bytes=list(copied), payload=list(payload)))
    call(0x563ee0, MESSAGE)

INLET = 0x200f000
GET_REGISTRY, GET_NETWORK_STATE = 0x2104800, 0x2104900
GET_CATEGORY2 = 0x2104a00
write(INLET, NETWORK)
write(NETWORK_VTABLE + 0xc, GET_REGISTRY)
write(NETWORK_VTABLE + 0x10, GET_CATEGORY2)
write(NETWORK_VTABLE + 0x4c, GET_NETWORK_STATE)
network_state = 3
inlet_events = []


def inlet_hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address in [GET_REGISTRY, GET_NETWORK_STATE, GET_CATEGORY2]:
        assert machine.reg_read(UC_X86_REG_ECX) == NETWORK
        if address == GET_NETWORK_STATE:
            inlet_events.append('state')
            finish(network_state)
        elif address == GET_REGISTRY:
            inlet_events.append('category3')
            finish(LIVE_REGISTRY)
        else:
            finish(0x200f100)
    else:
        assert read(stack + 4) == MESSAGE
        assert machine.reg_read(UC_X86_REG_ECX) == (NETWORK if address == 0x539470 else 0x200f100)
        inlet_events.append('category1' if address == 0x539470 else 'category2')
        finish(0, 4)


for address in [GET_REGISTRY, GET_NETWORK_STATE, GET_CATEGORY2, 0x539470, 0x550d50]:
    uc.hook_add(UC_HOOK_CODE, inlet_hook, begin=address, end=address)

inlet_rows = []
inlet_cases = [(category, recipient, state, 2)
               for category in [0, 1, 2, 3, 4]
               for recipient in [0, 0xfffffffe]
               for state in [0, 2, 3, 4]] + [
                   (3, 0, 0, 3), (3, 0xfffffffe, 2, 5),
                   (3, 0xfffffffe, 3, 5), (3, 0, 0, 4)]
for category, recipient, network_state, command in inlet_cases:
    metadata_available = True
    header = bytearray(32)
    header[2:4] = b'\xff\xff'
    header[4:8] = struct.pack('>I', 0x1234)
    header[8:12] = struct.pack('>I', recipient)
    header[0x10:0x14] = struct.pack('>I', 73)
    header[0x1d:0x20] = bytes([category, command, 1])
    raw = bytes(header) + bytes(segments[3] if command != 5 else segments[2])
    uc.mem_write(RAW, raw)
    call(0x53d9c0, MESSAGE, RAW, len(raw))
    before = registry_state()
    inlet_events.clear()
    call(0x53ee60, INLET, MESSAGE)
    expected_events = ['state'] if recipient == 0xfffffffe else []
    dispatched = recipient != 0xfffffffe or network_state == 3
    if dispatched and category in [1, 2, 3]:
        expected_events.append(f'category{category}')
    assert inlet_events == expected_events
    after = registry_state()
    result = None
    if 73 in after['all']:
        sentinel = read(LIVE_REGISTRY + 0xc)
        record = read(read(sentinel + 4) + 0x10)
        result = dict(zip(['hp', 'maxHp'], struct.unpack('<2i', uc.mem_read(record + 0x54, 8))))
    if command == 3:
        assert after == dict(all=[73], mode1=[], mode2=[73]) and result == dict(hp=200, maxHp=0)
    elif command == 5:
        assert result == dict(hp=37 if dispatched else 200, maxHp=0)
    elif command == 4:
        assert after == dict(all=[], mode1=[], mode2=[]) and result is None
    else:
        assert before == after
    inlet_rows.append(dict(raw=list(raw), networkState=network_state, events=list(inlet_events),
                           before=before, after=after, result=result))
    call(0x563ee0, MESSAGE)

(ROOT / 'recovery/output/role-properties-native.json').write_text(json.dumps(dict(
    status='PASS', properties=properties, rows=rows, dirtyRows=dirty_rows,
    healthRows=health_rows, detectRows=detect_rows, wireRows=wire_rows,
    receiveRows=receive_rows, routeRows=route_rows, registryRows=registry_rows,
    bulletWireRows=bullet_wire_rows, bulletReceiveRows=bullet_receive_rows,
    lifecycleRows=lifecycle_rows, liveRouteRows=live_route_rows, eventRows=event_rows,
    cleanupRows=cleanup_rows, factoryReturn=factory_return, retirementRows=retirement_rows,
    registeredFactory=registered_factory, creationRows=creation_rows, dispatchRows=dispatch_rows,
    packetRows=packet_rows, inletRows=inlet_rows, arrayWireRows=array_wire_rows,
    arrayReceiveRows=array_receive_rows, arraySkillCatalog=source_skill_catalog,
    scope='Complete role constructor523303, schema5221a0, real metadata engine52b0a0 '
          'and all34 property registrations/bindings. Original HP/MaxHP bound value '
          'write545d40/read545c30 execute; only allocation/free and exit scheduling supplied. '
          'Real record notify521e8a and manager dirty529a10 execute for256 byte indices '
          'and full HP setter433250; health observer boundary supplied. '
          'Full detector529a60 and real numeric/string/array probes execute; '
          'initial numeric/array snapshots copied from the constructed bound fields. '
          'Numeric segment545f10 with real53d680/53d7a0/53d720/53fe50 and snapshot545ee0 '
          'execute; Winsock htons supplied. '
          'Separate array544c70 full/delta encoding and544950 array reader execute for all6 '
          'bound arrays through real52a280/52a8f0, including all342 skill IDs in16-slot batches. '
          'Dimension mismatch diagnostic level0 supplied; field observer supplied. '
          'String mutation and later network serialization not covered. '
          'Manager52a280, index lookup528d10, parser53dbd0, numeric545ff0, real observer '
          'forward52a8f0 execute. Metadata type getter, service/logger lookup and final '
          'subscriber supplied; message cursor starts after prepared32-byte header. '
          'Object-ID/command route52af80 executes with real command5 receive chain; '
          'command3 handler5285a0 and command6..9 handler528a50 supplied. '
          'Registry dispatch525630/525730/525830 and native lookup550b30 execute '
          'over prepared one-node trees; registry construction/insertion not covered. '
          'Separate lifecycle executes real constructor5275f0, mode registration528030/5280d0, '
          'common insertion527e00/527930 and removal526a70 with actual tree erase. '
          'Network callbacks536b70/536dc0 and final retirement525030 supplied. '
          'Separate event rows replace536b70/536dc0 with real native forwarding to '
          'optional observer virtual+24/+28; only terminal observer and retirement supplied. '
          'Separate mode1 cleanup executes actual525030/529480 and all34 field destructors; '
          'CRT frees supplied. Mode2 retirement resolves prepared one-entry factory via '
          'actual523cf0/523810/52be40 and executes447e29 plus original record/manager '
          'destructors; factory initialization/registration not covered. '
          'Separate factory executes constructor52c550, role registration52278d, service '
          'registration523ab0, type factory52c3b0, create522748 and '
          'real mode2 retirement. Global service lookup supplied. '
          'Full creation528170 executes registered constructor/schema and real5285a0 '
          'initial properties; only network metadata lookup boundary supplied. '
          'Upper dispatcher5282e0/category-recipient gate525520 and actual creation/update/'
          'removal5272d0 execute. Socket transport still outside the harness. '
          'Separate raw-packet constructor53d9c0 and inlet53ee60 execute with real '
          'category3 creation/update/removal; network state/registry getters and category1/2 '
          'business handlers supplied. TCP frame assembly, socket routing, FuncType2 '
          'execution and HP composition not proved.',
), indent=2) + '\n')
print('PASS: 34 real role property registrations; 20 bound HP/MaxHP writes/reads, '
      '512 real dirty notifications and 120 HP setter/real-manager chains')
print(f'PASS: {len(detect_rows)} native34-property scans, mode/dirty gates, '
      'numeric/array changes and retained snapshots')
print('PASS: 14 original HP/MaxHP numeric segments and post-send snapshot refreshes')
print(f'PASS: {len(receive_rows)} real property-manager receives, raw health and subscriber order')
print(f'PASS: {len(route_rows)} original object-ID/command routes and command5 receive chains')
print(f'PASS: {len(registry_rows)} native registry lookups/type gates through real health reception')
print('PASS: 15 real registry lifecycle operations, duplicate rejection and callback/tree ordering')
print('PASS: 18 receives through constructed and populated object registry trees')
print('PASS: 30 registry operations with real536b70/536dc0 optional-observer forwarding')
print('PASS: 3 real mode1 retirements, 102 field destructors and preserved record/dirty state')
print('PASS: real mode2 factory lookup/return releases record, manager and34 fields')
print(f'PASS: registered original {role_type_name} factory, create and return')
print('PASS: 6 full original creation-message gates, schema/init/registration and retirement')
print('PASS: 12 category/recipient/command dispatches through real creation/update/removal')
print('PASS: 6 raw packet copies/length rewrites and 84 upstream network inlet dispatches')
print(f'PASS: {len(array_wire_rows)} full/delta array encodings and {len(array_receive_rows)} actual array receives')

print(f'PASS: {len(bullet_wire_rows)} current/max bullet encodings and {len(bullet_receive_rows)} command5 routes, ordered reception and unchanged pending/snapshots')
