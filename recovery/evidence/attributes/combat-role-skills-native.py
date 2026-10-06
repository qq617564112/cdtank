"""Execute original passive predicate and source traversal with supplied storage."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

machine, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x60000)
ROLE, RECORD, VTABLE, GEAR = 0x2001000, 0x2002000, 0x2003000, 0x2004000
SLOTS = RECORD + 0xd0
STACK, FRAME, RETURN = 0x2010000, 0x2011000, 0x2012000
PROFILE, GET_ARRAY = 0x2007000, 0x2012200
SKILL_MANAGER, ITEM_MANAGER = 0x2013000, 0x2014000
catalog, addresses = [], {}
for index, row in enumerate(read_table(ROOT / 'CDTank/Data/table/skill.dat')['rows']):
    values = row['values']
    skill = dict(skillId=int(values['SkillTableID']), triggerType=int(values['TriggerType']),
                 functions=[dict(type=int(values[f'FuncType{i}']), t=int(values[f'FuncT{i}'])) for i in range(1, 4)])
    catalog.append(skill)
    address = 0x2020000 + index * 0x200
    addresses[skill['skillId']] = address
    machine.mem_write(address + 0xc, struct.pack('<I', skill['skillId']))
    machine.mem_write(address + 0x2c, struct.pack('<i', skill['triggerType']))
    for i, fn in enumerate(skill['functions']):
        machine.mem_write(address + 0x158 + i * 4, struct.pack('<i', fn['type']))
        machine.mem_write(address + 0x164 + i * 4, struct.pack('<i', fn['t']))
items, item_addresses = [], {}
item_table = read_table(ROOT / 'CDTank/Data/table/item.dat')
assert item_table['columns'][27:30] == ['ItemSkill1', 'ItemSkill2', 'ItemSkill3']
current_item_values, item_columns = None, []


def provide_item_column(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    destination, column, mode = struct.unpack('<3I', uc.mem_read(stack, 12))
    assert mode == 0 and 27 <= column <= 29
    item_columns.append(column)
    uc.mem_write(0x2008000, struct.pack('<i', int(current_item_values[item_table['columns'][column]])))
    uc.reg_write(UC_X86_REG_EAX, 0x2008000)
    uc.reg_write(UC_X86_REG_ESP, stack + 12)
    uc.reg_write(UC_X86_REG_EIP, destination)


item_hook = machine.hook_add(UC_HOOK_CODE, provide_item_column, begin=0x4391c4, end=0x4391c4)
for index, row in enumerate(item_table['rows']):
    values = row['values']
    current_item_values = values
    item_columns.clear()
    item = dict(itemId=int(values['ItemTableID']), skillIds=[int(values[f'ItemSkill{i}']) for i in range(1, 4)])
    items.append(item)
    address = 0x204c000 + index * 0x180
    item_addresses[item['itemId']] = address
    for register, value in [(UC_X86_REG_ESI, address), (UC_X86_REG_EDI, 26),
                            (UC_X86_REG_EBX, 0), (UC_X86_REG_EBP, FRAME), (UC_X86_REG_ESP, STACK)]:
        machine.reg_write(register, value)
    machine.emu_start(0x439cd9, 0x439d04, count=200)
    assert item_columns == [27, 28, 29]
    assert list(struct.unpack('<3i', machine.mem_read(address + 0x108, 12))) == item['skillIds']
machine.hook_del(item_hook)

predicates = []
for skill in [None, *catalog]:
    machine.mem_write(STACK, struct.pack('<II', RETURN, addresses[skill['skillId']] if skill else 0))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.emu_start(0x432b29, RETURN, count=100)
    predicates.append(dict(skill=skill, passive=bool(machine.reg_read(UC_X86_REG_EAX) & 255)))

selected, lookups = [], []
slots_present = False


def return_to_caller(uc, value, argument_bytes):
    stack = uc.reg_read(UC_X86_REG_ESP)
    destination = struct.unpack('<I', uc.mem_read(stack, 4))[0]
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + argument_bytes)
    uc.reg_write(UC_X86_REG_EIP, destination)


def lookup(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    key = struct.unpack('<i', uc.mem_read(stack + 4, 4))[0]
    lookups.append(key)
    manager = uc.reg_read(UC_X86_REG_ECX)
    records = item_addresses if manager == ITEM_MANAGER + 0xc else addresses
    assert manager in [SKILL_MANAGER + 0xc, ITEM_MANAGER + 0xc]
    return_to_caller(uc, records.get(key, 0), 4)


def apply_skill(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    source = struct.unpack('<I', uc.mem_read(stack + 4, 4))[0]
    if source:
        selected.append(struct.unpack('<I', uc.mem_read(source + 0xc, 4))[0])
    return_to_caller(uc, 0, 32)


def skip_absent_slots(uc, address, size, data):
    uc.reg_write(UC_X86_REG_EIP, 0x4337d7)


def get_array(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    assert struct.unpack('<I', uc.mem_read(stack + 4, 4))[0] == 4
    return_to_caller(uc, SLOTS if slots_present else 0, 4)


for address, callback in [(0x411068, lookup), (0x432951, apply_skill),
                          (GET_ARRAY, get_array), (0x433d15, skip_absent_slots)]:
    machine.hook_add(UC_HOOK_CODE, callback, begin=address, end=address)
machine.mem_write(ROLE, struct.pack('<I', VTABLE))
machine.mem_write(ROLE + 0x2a0, struct.pack('<I', RECORD))
machine.mem_write(VTABLE + 0x54, struct.pack('<I', 0x4227d8))
machine.mem_write(VTABLE + 0x20, struct.pack('<I', GET_ARRAY))


def traverse(sources):
    global slots_present
    selected.clear()
    lookups.clear()
    slots = sources.get('currentSkillIds')
    slots_present = slots is not None
    machine.mem_write(VTABLE + 0x20, struct.pack('<I', 0x4327ac if slots_present else GET_ARRAY))
    machine.mem_write(SLOTS, struct.pack('<16i', *(slots or [0] * 16)))
    equipment_present = 'equipmentSkills' in sources
    machine.mem_write(ROLE + 0xa0, struct.pack('<I', GEAR if equipment_present else 0))
    machine.mem_write(GEAR, bytes(0x100))
    for i, ranked in enumerate(sources.get('equipmentSkills', [])):
        offset = 0x44 + i * 4
        machine.mem_write(GEAR + offset, struct.pack('<i', ranked['baseId']))
        machine.mem_write(GEAR + offset + 0x18, struct.pack('<i', ranked['rank']))
    machine.mem_write(RECORD + 0x88, struct.pack('<2i', sources['extraSkill']['baseId'], sources['extraSkill']['rank']))
    item_ids = sources.get('itemIds', [0] * 10)
    for index, item_id in enumerate(item_ids[:3]):
        machine.mem_write(PROFILE + 0x58 + index * 4, struct.pack('<i', item_id))
    for index, item_id in enumerate(item_ids[3:8]):
        machine.mem_write(RECORD + 0xbc + index * 4, struct.pack('<i', item_id))
    machine.mem_write(RECORD + 0x70, struct.pack('<i', item_ids[8]))
    machine.mem_write(RECORD + 0x6c, struct.pack('<i', item_ids[9]))
    machine.mem_write(FRAME + 0xc, struct.pack('<I', PROFILE))
    machine.mem_write(FRAME + 0x10, struct.pack('<I', SKILL_MANAGER))
    machine.mem_write(FRAME + 0x14, struct.pack('<I', ITEM_MANAGER))
    for register, value in [(UC_X86_REG_ESP, STACK), (UC_X86_REG_EBP, FRAME),
                            (UC_X86_REG_ESI, ROLE), (UC_X86_REG_EDI, 0),
                            (UC_X86_REG_EAX, 0)]:
        machine.reg_write(register, value)
    # The original push4 at0x4334ff survives the base-field setup to this call.
    machine.mem_write(STACK, struct.pack('<I', 4))
    machine.emu_start(0x4335ab, 0x4337d7, count=10000)
    return dict(sources=sources, selected=selected[:], lookups=lookups[:])


traversals = []
empty = dict(baseId=0, rank=0)
for skill in catalog:
    ranked = dict(baseId=skill['skillId'], rank=1)
    for current in [[0] * 16, [skill['skillId'], skill['skillId']] + [0] * 14]:
        traversals.append(traverse(dict(currentSkillIds=current,
            equipmentSkills=[ranked, empty, empty, empty, empty, ranked], extraSkill=ranked)))
traversals.append(traverse(dict(equipmentSkills=[dict(baseId=10111, rank=1)] * 6,
                               extraSkill=dict(baseId=10111, rank=1))))
traversals.append(traverse(dict(currentSkillIds=[2001] + [0] * 15,
    equipmentSkills=[dict(baseId=10111, rank=2)] * 6, extraSkill=dict(baseId=10111, rank=3))))
traversals.append(traverse(dict(currentSkillIds=[2001] + [0] * 15,
    extraSkill=dict(baseId=10111, rank=1))))
for item in items:
    for current in [[0] * 16, item['skillIds'] + [0] * 13]:
        traversals.append(traverse(dict(currentSkillIds=current, extraSkill=empty,
            itemIds=[item['itemId']] + [0] * 8 + [item['itemId']])))
# The item expansion calls the same array getter4 for duplicate suppression.
passive_ids = {row['skill']['skillId'] for row in predicates if row['skill'] and row['passive']}
passive_item = next(item for item in items if any(skill in passive_ids for skill in item['skillIds']))
passive_id = next(skill for skill in passive_item['skillIds'] if skill in passive_ids)
traversals.append(traverse(dict(currentSkillIds=[passive_id] + [0] * 15, extraSkill=empty,
    itemIds=[passive_item['itemId']] + [0] * 9)))
(ROOT / 'recovery/output/combat-role-skills-native.json').write_text(json.dumps(dict(
    scope='204 original item skill-column loader blocks with supplied parsed values. Original complete passive predicate, source traversal, item expansion, actual array4 and equipment getters for populated roles. Catalog lookup/storage and application callback supplied; absent-array branch uses supplied null getter. Proves selected source order, not entire role recomputation or inventory ownership.',
    catalog=catalog, items=items, predicates=predicates, traversals=traversals)) + '\n')
print(f'PASS: {len(predicates)} original passive predicates and {len(traversals)} original source traversals')
