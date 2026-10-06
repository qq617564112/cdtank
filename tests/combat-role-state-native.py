"""Execute original role setters/lifecycle with supplied record observers."""
import json
from pathlib import Path
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x20000)
ROLE, RECORD, VTABLE = 0x2001000, 0x2002000, 0x2003000
STACK, RETURN, NOTIFY, SOURCE = 0x2010000, 0x2011000, 0x2011100, 0x2012000
ARRAYS = {0: (0x94, 7), 1: (0xb0, 3), 2: (0xbc, 5), 4: (0xd0, 16)}
notifications = []
present = True


def u32(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def snapshot():
    return dict(present=present, dirty=bool(machine.mem_read(ROLE + 0x2b4, 1)[0]),
        flag8Seconds=struct.unpack('<f', machine.mem_read(ROLE + 0x304, 4))[0],
        specialFlag12=machine.mem_read(ROLE + 0x308, 1)[0],
        nextAvailableSeconds=struct.unpack('<f', machine.mem_read(ROLE + 0x9c, 4))[0],
        activeActionId=u32(ROLE + 0x258),
        record=dict(status=u32(RECORD + 0x90), flags=list(machine.mem_read(RECORD + 0x11c, 16)),
            arrays={str(index): list(struct.unpack(f'<{count}i', machine.mem_read(RECORD + offset, count * 4)))
                    for index, (offset, count) in ARRAYS.items()}) if present else None)


def observer(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    assert uc.reg_read(UC_X86_REG_ECX) == RECORD
    notifications.append(dict(index=u32(stack + 4), state=snapshot()))
    uc.reg_write(UC_X86_REG_EAX, 0)
    uc.reg_write(UC_X86_REG_ESP, stack + 8)
    uc.reg_write(UC_X86_REG_EIP, u32(stack))


def log_backend(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, 0)
    uc.reg_write(UC_X86_REG_ESP, stack + 4)
    uc.reg_write(UC_X86_REG_EIP, u32(stack))


machine.hook_add(UC_HOOK_CODE, observer, begin=NOTIFY, end=NOTIFY)
machine.hook_add(UC_HOOK_CODE, log_backend, begin=0x40bd28, end=0x40bd28)


def reset(has_record=True, dirty=False):
    global present
    present = has_record
    machine.mem_write(ROLE, bytes(0x400))
    machine.mem_write(RECORD, bytes(0x200))
    machine.mem_write(RECORD, struct.pack('<I', VTABLE))
    machine.mem_write(ROLE, struct.pack('<I', VTABLE))
    machine.mem_write(VTABLE + 0x28, struct.pack('<I', 0x432738))
    machine.mem_write(VTABLE + 0x64, struct.pack('<I', 0x431f38))
    machine.mem_write(VTABLE + 0x24, struct.pack('<I', NOTIFY))
    machine.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD if present else 0))
    machine.mem_write(ROLE + 0x2b4, bytes([int(dirty)]))
    machine.mem_write(ROLE + 0x304, struct.pack('<f', .125))
    machine.mem_write(ROLE + 0x308, bytes([7]))
    machine.mem_write(ROLE + 0x9c, struct.pack('<f', 4.375))
    machine.mem_write(ROLE + 0x258, struct.pack('<I', 77))
    machine.mem_write(RECORD + 0x11c, bytes(range(16)))
    for index, (offset, count) in ARRAYS.items():
        machine.mem_write(RECORD + offset, struct.pack(f'<{count}i', *[100 * index + i for i in range(count)]))
    notifications.clear()


def call(address, args=(), result_mask=255):
    machine.mem_write(STACK, struct.pack(f'<{len(args) + 1}I', RETURN, *[value & 0xffffffff for value in args]))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ECX, ROLE)
    machine.emu_start(address, RETURN, count=5000)
    assert machine.reg_read(UC_X86_REG_EIP) == RETURN
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4 * (len(args) + 1)
    return machine.reg_read(UC_X86_REG_EAX) & result_mask


flags = []
for index in range(16):
    for old in [0, 1, 254, 255]:
        for value in [0, 1, 2, 256, 257]:
            reset()
            machine.mem_write(RECORD + 0x11c + index, bytes([old]))
            if index == 12:
                machine.mem_write(ROLE + 0x308, bytes([old]))
            initial = snapshot()
            call(0x431dbf, [index, value])
            result = snapshot()
            read = call(0x431d92, [index])
            flags.append(dict(index=index, value=value, initial=initial,
                              result=result, read=read, notifications=notifications[:]))
for value in [0, 7, 255]:
    reset(False)
    initial = snapshot()
    call(0x431dbf, [12, value])
    flags.append(dict(index=12, value=value, initial=initial, result=snapshot(),
                      read=call(0x431d92, [12]), notifications=notifications[:]))
reset(False)
absent_reads = {str(index): call(0x431d92, [index]) for index in range(16)}

arrays = []
values = [0, -1, 2147483647, -2147483648, 2001, 4020, 10111, 105, *range(8, 16)]
machine.mem_write(SOURCE, struct.pack('<16i', *values))
for has_record in [True, False]:
    for dirty in [True, False]:
        for index in [-1, 0, 1, 2, 3, 4, 5]:
            reset(has_record, dirty)
            initial = snapshot()
            accepted = bool(call(0x432826, [index, SOURCE]))
            arrays.append(dict(index=index, values=values, initial=initial,
                result=snapshot(), accepted=accepted, notifications=notifications[:],
                needsRecompute=bool(call(0x432196, [3]))))

lifecycle = []
for has_record in [True, False]:
    for status in range(4):
        reset(has_record, True)
        initial = snapshot()
        call([0x432e2a, 0x432e76, 0x432ecc, 0x432f50][status])
        lifecycle.append(dict(status=status, initial=initial, result=snapshot(),
                              notifications=notifications[:]))

reset(True, True)
completion_initial = snapshot()
machine.reg_write(UC_X86_REG_ESI, ROLE)
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.emu_start(0x433cf4, 0x433d15, count=100)
completion = dict(initial=completion_initial, result=snapshot(), notifications=notifications[:])

skill_ids = [int(row['values']['SkillTableID']) for row in read_table(ROOT / 'CDTank/Data/table/skill.dat')['rows']]
patterns = [[0] * 16, skill_ids[:16], [2001, 2001, 2001] + [0] * 13,
            [2001, skill_ids[0], 2001, skill_ids[1], 2001] + [0] * 11,
            [skill_ids[index // 2] if index % 2 == 0 else 0 for index in range(16)]]
skill_changes = []


def change_skill(operation, value):
    address = {'ADD': 0x431e22, 'REMOVE': 0x431ee5, 'REMOVE_AT': 0x431f38}[operation]
    initial = snapshot()
    notifications.clear()
    returned = call(address, [value], 0xffffffff)
    if returned >= 0x80000000:
        returned -= 0x100000000
    skill_changes.append(dict(operation=operation, value=value, initial=initial,
        result=snapshot(), returned=returned if operation == 'ADD' else None,
        notifications=notifications[:]))


for operation in ['ADD', 'REMOVE']:
    for skill_id in skill_ids:
        reset()
        machine.mem_write(RECORD + 0xd0, struct.pack('<16i', *patterns[1]))
        change_skill(operation, skill_id)
for pattern in patterns:
    for operation, values in [('ADD', [0, 2001, skill_ids[0], skill_ids[-1]]),
                             ('REMOVE', [0, 2001, skill_ids[0], skill_ids[-1]]),
                             ('REMOVE_AT', [-1, *range(16), 16])]:
        for value in values:
            reset()
            machine.mem_write(RECORD + 0xd0, struct.pack('<16i', *pattern))
            change_skill(operation, value)
for has_record in [True, False]:
    reset(has_record)
    machine.mem_write(RECORD + 0xd0, bytes(64))
    for value in [*skill_ids[:20], 2001, 2001, 0]:
        change_skill('ADD', value)
    for value in [2001, skill_ids[5], 0]:
        change_skill('REMOVE', value)
    change_skill('REMOVE_AT', 0)

# Execute actual OdlPlayer array field registration. The registry/storage backend
# is supplied, but native field names, counts, types and destination pointers are
# observed at the original call sites.
REGISTRY, REGISTRY_VTABLE, FIELD, FIELD_VTABLE = 0x2006000, 0x2006100, 0x2006200, 0x2006300
REGISTER, GET_FIELD, BIND_FIELD = 0x2011400, 0x2011410, 0x2011420
schema = []
machine.mem_write(ROLE + 4, struct.pack('<I', REGISTRY))
machine.mem_write(REGISTRY, struct.pack('<I', REGISTRY_VTABLE))
machine.mem_write(REGISTRY_VTABLE + 0x40, struct.pack('<I', REGISTER))
machine.mem_write(REGISTRY_VTABLE + 0x58, struct.pack('<I', GET_FIELD))
machine.mem_write(FIELD, struct.pack('<I', FIELD_VTABLE))
machine.mem_write(FIELD_VTABLE + 8, struct.pack('<I', BIND_FIELD))


def schema_backend(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == REGISTER:
        name, field_type, count, option = struct.unpack('<4I', uc.mem_read(stack + 4, 16))
        raw = bytes(uc.mem_read(name, 64)).split(b'\0', 1)[0].decode('ascii')
        schema.append(dict(name=raw, type=field_type, count=count, option=option))
        value, arguments = 1, 16
    elif address == GET_FIELD:
        assert uc.mem_read(stack + 4, 1)[0] == 1
        value, arguments = FIELD, 4
    else:
        schema[-1]['offset'] = hex(u32(stack + 4) - ROLE)
        value, arguments = 0, 4
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + arguments)
    uc.reg_write(UC_X86_REG_EIP, u32(stack))


for address in [REGISTER, GET_FIELD, BIND_FIELD]:
    machine.hook_add(UC_HOOK_CODE, schema_backend, begin=address, end=address)
for register, value in [(UC_X86_REG_ESI, ROLE), (UC_X86_REG_EDI, 1), (UC_X86_REG_EBX, 14),
                        (UC_X86_REG_EBP, STACK + 0x100), (UC_X86_REG_ESP, STACK)]:
    machine.reg_write(register, value)
machine.emu_start(0x52262a, 0x522739, count=1000)
assert [(row['name'], row['count'], row['offset']) for row in schema] == [
    ('m_arrayItemHotkey', 7, '0x94'), ('m_arrayTankMark', 3, '0xb0'),
    ('m_arrayTankPart', 5, '0xbc'), ('m_arraySkillTableId', 16, '0xd0'),
    ('m_arrayTexture', 3, '0x110'), ('m_arrayActState', 16, '0x11c')]

destination = ROOT / 'recovery/output/combat-role-state-native.json'
destination.write_text(json.dumps(dict(scope='Original complete flag getter/setter, array setter, skill add/remove/remove-at (actual dirty setter and nested deletion), four role lifecycle methods (including original CRT memset and action selection setter), dirty getter and recompute completion block. Record notification and diagnostic logging backends supplied; proves state updates/observer order, not inventory ownership or full attribute recompute.',
    flags=flags, absentReads=absent_reads, arrays=arrays, lifecycle=lifecycle,
    completion=completion, skillChanges=skill_changes, recordArraySchema=schema)) + '\n')
print(f'PASS: {len(flags)} native flag updates, {len(arrays)} array updates, {len(lifecycle)} lifecycle transitions, {len(skill_changes)} skill changes, {len(schema)} original record array bindings and recompute completion')
