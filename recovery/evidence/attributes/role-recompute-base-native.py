"""Execute original4334e8–4335b2 with fully parsed owned records and explicit tank/pet fields."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EBX, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
ROLE, BASE, EQUIPMENT, TANK, PET, RECORD = [0x2001000 + n * 0x1000 for n in range(6)]
STACK = 0x2010000
base_rows = json.loads((ROOT / 'recovery/output/role-owned-base-native.json').read_text())['rows']
equipment_rows = json.loads((ROOT / 'recovery/output/role-owned-equipment-native.json').read_text())['rows']
float_offsets = [0x8c, 0x94, 0x68, 0x6c, 0x74, 0x7c, 0x84, 0x80, 0x54, 0x50, 0x90]
integer_offsets = [0x70, 0x78, 0x88, 0x58]


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *(value & 0xffffffff for value in values)))


def read(address):
    return struct.unpack('<i', uc.mem_read(address, 4))[0]


rows, snapshots = [], []
for index, (base, equipment) in enumerate(zip(base_rows, equipment_rows)):
    tank = dict(field84=index * 37, field88=-index, reloadDuration=[-4, 0, 6, .125, 99][index % 5],
                field90=index + 17, fieldA4=[0, 16777217, -2147483648][index % 3], fieldA8=index * 53)
    pet = dict(field7c=index, field80=index + 1, field84=index + 2, field88=index + 3)
    uc.mem_write(ROLE, b'\xaa' * 0x400)
    for record, source in [(BASE, base), (EQUIPMENT, equipment)]:
        for offset, value in source['result'].items():
            write(record + int(offset), value)
    for name, offset in [('field84', 0x84), ('field88', 0x88), ('field90', 0x90), ('fieldA4', 0xa4), ('fieldA8', 0xa8)]:
        write(TANK + offset, tank[name])
    uc.mem_write(TANK + 0x8c, struct.pack('<f', tank['reloadDuration']))
    for name, offset in [('field7c', 0x7c), ('field80', 0x80), ('field84', 0x84), ('field88', 0x88)]:
        write(PET + offset, pet[name])
    write(ROLE + 0x2a0, RECORD, PET, TANK)
    write(RECORD + 0x54, 777, 0xaaaaaaaa)
    snapshots.append([(address, bytes(uc.mem_read(address, length))) for address, length in
                      [(ROLE, 0x400), (BASE, 0x98), (EQUIPMENT, 0x70), (TANK, 0xb0), (PET, 0x90), (RECORD, 0x100)]])
    for register, value in [(UC_X86_REG_EAX, BASE), (UC_X86_REG_ECX, EQUIPMENT), (UC_X86_REG_ESI, ROLE),
                            (UC_X86_REG_EDI, 0), (UC_X86_REG_EBP, STACK + 0x100), (UC_X86_REG_ESP, STACK),
                            (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
        uc.reg_write(register, value)
    uc.emu_start(0x4334e8, 0x4335b2, count=1000)
    assert read(RECORD + 0x54) == 777
    locals_base = STACK + 0x100
    rows.append(dict(baseIndex=index, equipmentIndex=index, tank=tank, pet=pet,
                     recordFields={str(o): read(RECORD + o) for o in [0x58, 0x38]},
                     roleIntegers={str(o): read(ROLE + o) for o in integer_offsets},
                     roleFloats={str(o): struct.unpack('<f', uc.mem_read(ROLE + o, 4))[0] for o in float_offsets},
                     accumulators=[read(locals_base + o) for o in [-0x10, 8, -8, -0xc, -4, 0x18]], hp=777))

# Source skill loader and full432951 accumulate over the actual initialized base fields.
SOURCE, VTABLE, VALUE, CONTEXT, RETURN = 0x2008000, 0x2009000, 0x200a000, 0x200b000, 0x2011000
skills = read_table(ROOT / 'CDTank/Data/table/skill.dat')
current_values, columns = None, []


def provide_column(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    column = read(stack + 4)
    assert read(stack + 8) == 0 and 19 <= column <= 61
    columns.append(column)
    write(VALUE, int(current_values[skills['columns'][column]]))
    machine.reg_write(UC_X86_REG_EAX, VALUE)
    machine.reg_write(UC_X86_REG_EIP, read(stack) & 0xffffffff)
    machine.reg_write(UC_X86_REG_ESP, stack + 12)


uc.hook_add(UC_HOOK_CODE, provide_column, begin=0x4391c4, end=0x4391c4)
write(VTABLE + 0x14, 0x432417)
combinations, skill_addresses = [], {}
uc.mem_map(0x2040000, 0x40000)


def state_values():
    return dict(recordFields={str(o): read(RECORD + o) for o in [0x58, 0x38]},
                roleIntegers={str(o): read(ROLE + o) for o in integer_offsets},
                roleFloats={str(o): struct.unpack('<f', uc.mem_read(ROLE + o, 4))[0] for o in float_offsets},
                accumulators=[read(STACK + 0x100 + o) for o in [-0x10, 8, -8, -0xc, -4, 0x18]])

for index, skill in enumerate(skills['rows']):
    source_index = index % len(rows)
    for address, raw in snapshots[source_index]:
        uc.mem_write(address, raw)
    for register, value in [(UC_X86_REG_EAX, BASE), (UC_X86_REG_ECX, EQUIPMENT), (UC_X86_REG_ESI, ROLE),
                            (UC_X86_REG_EDI, 0), (UC_X86_REG_EBP, STACK + 0x100), (UC_X86_REG_ESP, STACK),
                            (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
        uc.reg_write(register, value)
    uc.emu_start(0x4334e8, 0x4335b2, count=1000)
    current_values = skill['values']
    columns.clear()
    uc.mem_write(SOURCE, bytes(0x300))
    for register, value in [(UC_X86_REG_ESI, SOURCE), (UC_X86_REG_ESP, STACK), (UC_X86_REG_EBX, 0),
                            (UC_X86_REG_EDI, 19), (UC_X86_REG_EBP, STACK + 0x100)]:
        uc.reg_write(register, value)
    uc.emu_start(0x43acf2, 0x43af5c, count=1000)
    assert columns == list(range(19, 62))
    write(SOURCE + 0x2c, int(current_values['TriggerType']))
    skill_id = int(current_values['SkillTableID'])
    write(SOURCE + 0xc, skill_id)
    address = 0x2040000 + index * 0x200
    uc.mem_write(address, bytes(uc.mem_read(SOURCE, 0x200)))
    skill_addresses[skill_id] = address
    role_value = [1, 10, 50][index % 3]
    write(ROLE, VTABLE)
    write(ROLE + 0x24, role_value)
    write(CONTEXT, EQUIPMENT)
    locals_base = STACK + 0x100
    for offset, value in zip([-0x10, 8, -8, -0xc, -4, 0x18], rows[source_index]['accumulators']):
        write(locals_base + offset, value)
    write(STACK, RETURN, SOURCE, ROLE, *[locals_base + o for o in [-0x10, 8, -8, -0xc, -4, 0x18]])
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, CONTEXT)
    uc.reg_write(UC_X86_REG_FPCW, 0x27f)
    uc.reg_write(UC_X86_REG_FPSW, 0)
    uc.reg_write(UC_X86_REG_FPTAG, 0xffff)
    uc.emu_start(0x432951, RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 36
    assert read(RECORD + 0x54) == 777
    combinations.append(dict(sourceIndex=source_index, skillId=int(current_values['SkillTableID']),
                              roleValue9=role_value, values=state_values(), maxHp=read(RECORD + 0x58), hp=777,
                              reload=dict(baseDuration=struct.unpack('<f', uc.mem_read(ROLE + 0x50, 4))[0],
                                          type1Factor=struct.unpack('<f', uc.mem_read(ROLE + 0x54, 4))[0])))

# Complete item expansion432fe8 with actual array getter and full432951 additions.
MANAGER, ITEM, SLOTS = 0x200c000, 0x200d000, RECORD + 0xd0
write(VTABLE + 0x20, 0x4327ac)
item_lookups, applied = [], []


def lookup_skill(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    key = read(stack + 4)
    assert machine.reg_read(UC_X86_REG_ECX) == MANAGER + 0xc
    item_lookups.append(key)
    machine.reg_write(UC_X86_REG_EAX, skill_addresses.get(key, 0))
    machine.reg_write(UC_X86_REG_EIP, read(stack) & 0xffffffff)
    machine.reg_write(UC_X86_REG_ESP, stack + 8)


def observe_addition(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    source = read(stack + 4) & 0xffffffff
    if source:
        applied.append(read(source + 0xc))


lookup_hook = uc.hook_add(UC_HOOK_CODE, lookup_skill, begin=0x411068, end=0x411068)
uc.hook_add(UC_HOOK_CODE, observe_addition, begin=0x432951, end=0x432951)
item_rows = []
items = read_table(ROOT / 'CDTank/Data/table/item.dat')
for index, item in enumerate([None, *items['rows']]):
    ids = [int(item['values'][f'ItemSkill{i}']) for i in range(1, 4)] if item else [0, 0, 0]
    for populated in [False, True]:
        source_index = index % len(rows)
        for address, raw in snapshots[source_index]:
            uc.mem_write(address, raw)
        for register, value in [(UC_X86_REG_EAX, BASE), (UC_X86_REG_ECX, EQUIPMENT), (UC_X86_REG_ESI, ROLE),
                                (UC_X86_REG_EDI, 0), (UC_X86_REG_EBP, STACK + 0x100), (UC_X86_REG_ESP, STACK),
                                (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
            uc.reg_write(register, value)
        uc.emu_start(0x4334e8, 0x4335b2, count=1000)
        write(ROLE, VTABLE)
        role_value = [1, 10, 50][index % 3]
        write(ROLE + 0x24, role_value)
        current = ids + [0] * 13 if populated else [0] * 16
        write(SLOTS, *current)
        write(ITEM + 0x108, *ids)
        write(CONTEXT, EQUIPMENT)
        item_lookups.clear()
        applied.clear()
        locals_base = STACK + 0x100
        write(STACK, RETURN, MANAGER, ITEM if item else 0, ROLE,
              *[locals_base + o for o in [-0x10, 8, -8, -0xc, -4, 0x18]])
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_ECX, CONTEXT)
        uc.reg_write(UC_X86_REG_FPCW, 0x27f)
        uc.reg_write(UC_X86_REG_FPSW, 0)
        uc.reg_write(UC_X86_REG_FPTAG, 0xffff)
        uc.emu_start(0x432fe8, RETURN, count=5000)
        assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 40
        assert read(RECORD + 0x54) == 777
        item_rows.append(dict(sourceIndex=source_index, itemId=int(item['values']['ItemTableID']) if item else None,
                              currentSkillIds=current, roleValue9=role_value, selected=list(applied),
                              lookups=list(item_lookups), values=state_values(), hp=777))

(ROOT / 'recovery/output/role-recompute-base-native.json').write_text(json.dumps(dict(
    status='PASS', rows=rows, combinations=combinations, itemRows=item_rows,
    scope='Original4334e8–4335b2 initialization with parsed owned-source records and explicit tank/pet values. '
          'All field writes and six stack accumulators observed; current HP unchanged. All342 source skills '
          'execute actual43acf2 loader and full432951 over initialized bases; source getters supplied. '
          'Complete432fe8 item expansion executes real getter4,432b29 and432951 for204 source items and null item; '
          'skill lookup and item skill fields supplied. All accumulation fields observed. '
          'Tank/pet table initialization, full433466 traversal and World integration not covered.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original complete base initialization contracts and preserved current HP')

print(f'PASS: {len(combinations)} original source base initialization → all342 full skill additions')

print(f'PASS: {len(item_rows)} complete original item expansion and all-field accumulation cases')
