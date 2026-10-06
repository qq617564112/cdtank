"""Complete433466 call: real getters/source traversal/additions/bounds/mastery/conversion and tail."""
import json
from pathlib import Path
import runpy
import struct
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG
ROOT = Path(__file__).resolve().parents[3]
g = runpy.run_path(str(ROOT / 'recovery/evidence/attributes/role-recompute-base-native.py'))
uc = g['uc']
uc.hook_del(g['lookup_hook'])
ROLE, BASE, EQUIPMENT, TANK, PET, RECORD, STACK, RETURN, VTABLE = [g[name] for name in
    ['ROLE', 'BASE', 'EQUIPMENT', 'TANK', 'PET', 'RECORD', 'STACK', 'RETURN', 'VTABLE']]
write, read = g['write'], g['read']
SKILL_MANAGER, ITEM_MANAGER, GEAR = 0x200c000, 0x200d000, 0x200e000
SETTER, NOTIFY, NULL_ARRAY = 0x2011200, 0x2011300, 0x2011400
uc.mem_map(0x2080000, 0x20000)
items = {}
for index, row in enumerate(g['items']['rows']):
    values = row['values']
    address = 0x2080000 + index * 0x180
    write(address + 0x108, *[int(values[f'ItemSkill{i}']) for i in range(1, 4)])
    items[int(values['ItemTableID'])] = address
# Limit values are from the prior actual43928a loader evidence.
limits = json.loads((ROOT / 'recovery/output/role-data-scale-native.json').read_text())['rows'][-1]['after']
from importlib.util import spec_from_file_location, module_from_spec
# Use the exact global destination mapping from the loaded-scale fixture without executing it.
import ast
module = ast.parse((ROOT / 'recovery/evidence/attributes/role-data-scale-native.py').read_text())
assignment = next(node for node in module.body if isinstance(node, ast.Assign)
                  and any(isinstance(t, ast.Name) and t.id == 'destinations' for t in node.targets))
destinations = ast.literal_eval(assignment.value)
for identifier, (lower, upper, kind) in destinations.items():
    for address, key in [(lower, 'lower'), (upper, 'upper')]:
        uc.mem_write(address, struct.pack('<' + kind, limits[str(identifier)][key]))
scales = {key: struct.unpack('<f', uc.mem_read(address, 4))[0] for key, address in [('move', 0x61e494), ('turn', 0x61e498)]}
MANAGER, MANAGER_VTABLE, RECORD_VTABLE = 0x200f000, 0x200f100, 0x200f200
write(MANAGER, MANAGER_VTABLE)
write(MANAGER_VTABLE + 0x28, 0x529a10)
write(RECORD_VTABLE + 0x10, 0x522ba2)
write(RECORD_VTABLE + 0x24, 0x521e8a)
events = []


def values():
    return dict(recordFields={str(o): read(RECORD + o) for o in [0x58, 0x38]},
                roleIntegers={str(o): read(ROLE + o) for o in g['integer_offsets']},
                roleFloats={str(o): struct.unpack('<f', uc.mem_read(ROLE + o, 4))[0] for o in g['float_offsets']})


def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    target = machine.reg_read(UC_X86_REG_ECX)
    value, pop = 0, 4
    if address == 0x411068:
        key = read(stack + 4)
        mapping = items if target == ITEM_MANAGER + 0xc else g['skill_addresses']
        assert target in [SKILL_MANAGER + 0xc, ITEM_MANAGER + 0xc]
        value = mapping.get(key, 0)
    elif address == SETTER:
        assert target == ROLE
        events.append(dict(kind='movement', selector=read(stack + 4), value=struct.unpack('<f', uc.mem_read(stack + 8, 4))[0]))
        machine.reg_write(UC_X86_REG_EIP, 0x432658)
        return
    elif address == 0x529a10:
        assert target == MANAGER
        events.append(dict(kind='notify', index=read(stack + 4), values=values(), dirty=bool(uc.mem_read(ROLE + 0x2b4, 1)[0])))
        return
    elif address == NULL_ARRAY:
        assert target == ROLE and read(stack + 4) == 4
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack) & 0xffffffff)
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


for address in [0x411068, SETTER, 0x529a10, NULL_ARRAY]:
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
write(VTABLE + 0x54, 0x4227d8)
write(VTABLE + 0x2c, SETTER)
write(VTABLE + 0x24, NOTIFY)
skill_ids = list(g['skill_addresses'])
item_ids = list(items)
tank_rows = json.loads((ROOT / 'recovery/output/role-tank-base-native.json').read_text())['rows']
pet_rows = json.loads((ROOT / 'recovery/output/role-pet-base-native.json').read_text())['rows']
pair_rows = json.loads((ROOT / 'recovery/output/role-owned-pair-native.json').read_text())['rows']
rows = []
uc.mem_map(0x20a0000, 0x10000)
OWNER, GLOBAL, RESOURCES, STAGES, STAGE, STAGE_VTABLE, PAIR_MESSAGE, GET_STAGE = [
    0x20a0000 + index * 0x1000 for index in range(8)]
write(0x633588, GLOBAL)
write(GLOBAL + 0xac, 0)
write(GLOBAL + 0xe0, STAGES)
write(STAGES, STAGE)
write(STAGE, STAGE_VTABLE)
write(STAGE_VTABLE + 4, GET_STAGE)
write(GLOBAL + 0x114, RESOURCES)
write(RESOURCES + 0x78, SKILL_MANAGER, ITEM_MANAGER)
stage_state = 3


def stage_getter(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EAX, stage_state)
    machine.reg_write(UC_X86_REG_EIP, read(stack) & 0xffffffff)
    machine.reg_write(UC_X86_REG_ESP, stack + 4)


uc.hook_add(UC_HOOK_CODE, stage_getter, begin=GET_STAGE, end=GET_STAGE)


def unexpected_item_resolver(machine, address, size, data):
    raise AssertionError('Original433466 checks but does not call the fifth argument422dfd')


uc.hook_add(UC_HOOK_CODE, unexpected_item_resolver, begin=0x422dfd, end=0x422dfd)
baseline_count = len(skill_ids) + len(item_ids) + 2
for index in range(baseline_count + len(pair_rows)):
    source_index = index % len(g['rows'])
    for address, raw in g['snapshots'][source_index]:
        uc.mem_write(address, raw)
    pair_index = index - baseline_count if index >= baseline_count else None
    if pair_index is not None:
        for pointer, fields in [(BASE, pair_rows[pair_index]['base']), (EQUIPMENT, pair_rows[pair_index]['equipment'])]:
            for offset, value in fields.items():
                write(pointer + int(offset), value)
    absent = index == len(skill_ids) + len(item_ids)
    gear_present = index % 3 != 0
    skill = skill_ids[index % len(skill_ids)]
    slots = [skill, skill] + [0] * 14
    ranked = [dict(baseId=skill, rank=1)] * 6
    equipped_items = [item_ids[index % len(item_ids)]] * 10
    write(ROLE, VTABLE)
    write(RECORD, RECORD_VTABLE, MANAGER)
    write(MANAGER + 0x40, *([0] * 8))
    write(ROLE + 0x24, [1, 10, 50][index % 3])
    write(ROLE + 0xa0, GEAR if gear_present else 0)
    write(VTABLE + 0x20, NULL_ARRAY if absent else 0x4327ac)
    write(RECORD + 0xd0, *slots)
    for slot, entry in enumerate(ranked):
        write(GEAR + 0x44 + slot * 4, entry['baseId'])
        write(GEAR + 0x5c + slot * 4, entry['rank'])
    write(RECORD + 0x88, skill, 1)
    write(EQUIPMENT + 0x58, *equipped_items[:3])
    write(RECORD + 0xbc, *equipped_items[3:8])
    write(RECORD + 0x70, equipped_items[8])
    write(RECORD + 0x6c, equipped_items[9])
    write(EQUIPMENT + 0x34, index % 2)
    tank_base = tank_rows[index % len(tank_rows)]['result']
    tank_type = tank_base['tankType']
    for key, offset in [('field84', 0x84), ('field88', 0x88), ('field90', 0x90), ('fieldA4', 0xa4), ('fieldA8', 0xa8)]:
        write(TANK + offset, tank_base[key])
    uc.mem_write(TANK + 0x8c, struct.pack('<f', tank_base['reloadDuration']))
    write(TANK + 0x50, tank_type)
    pet_base = pet_rows[index % len(pet_rows)]['result']
    for key, offset in [('field7c', 0x7c), ('field80', 0x80), ('field84', 0x84), ('field88', 0x88)]:
        write(PET + offset, pet_base[key])
    vip, multiplier = index % 3, index % 4
    uc.mem_write(RECORD + 0x50, bytes([vip]))
    write(ROLE + 0x98, multiplier)
    uc.mem_write(ROLE + 0x2b4, b'\1')
    source_fields = dict(
        gear={str(o): read(GEAR + o) for o in [0x44 + i * 4 for i in range(6)] + [0x5c + i * 4 for i in range(6)]} if gear_present else None,
        equipment={str(o): read(EQUIPMENT + o) for o in [0x58, 0x5c, 0x60]},
        role={str(o): read(RECORD + o) for o in [0x88, 0x8c, 0xbc, 0xc0, 0xc4, 0xc8, 0xcc, 0x70, 0x6c]})
    events.clear()
    g['applied'].clear()
    initial_role = bytes(uc.mem_read(ROLE, 0x400))
    initial_record = bytes(uc.mem_read(RECORD, 0x200))
    write(STACK, RETURN, BASE, EQUIPMENT, SKILL_MANAGER, ITEM_MANAGER, NULL_ARRAY)
    for register, value in [(UC_X86_REG_ECX, ROLE), (UC_X86_REG_ESP, STACK), (UC_X86_REG_FPCW, 0x27f),
                            (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
        uc.reg_write(register, value)
    uc.emu_start(0x433466, RETURN, count=30000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 24
    assert read(RECORD + 0x54) == 777
    dirty = bool(uc.mem_read(ROLE + 0x2b4, 1)[0])
    assert dirty == absent
    expected_values, expected_events, expected_skills = values(), list(events), list(g['applied'])
    expected_dirty_words = [read(MANAGER + 0x40 + i * 4) for i in range(8)]
    # Execute actual pair receipt, stage3/4 source getters and observer's local recompute tail.
    uc.mem_write(ROLE, initial_role)
    uc.mem_write(RECORD, initial_record)
    write(MANAGER + 0x40, *([0] * 8))
    write(VTABLE + 0x28, 0x432738)
    write(VTABLE + 0x74, 0x433466)
    write(OWNER + 0x3c, ROLE)
    write(PAIR_MESSAGE + 0xc, EQUIPMENT, BASE)
    write(STACK, RETURN, PAIR_MESSAGE, 17, 19)
    uc.reg_write(UC_X86_REG_ECX, OWNER)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x422f66, RETURN, count=100)
    assert read(OWNER + 0x20) == BASE and read(OWNER + 0x24) == EQUIPMENT
    events.clear()
    g['applied'].clear()
    stage_state = 3 + index % 2
    uc.mem_write(ROLE + 0x2b4, b'\0')
    for register, value in [(UC_X86_REG_EDI, OWNER), (UC_X86_REG_ESI, ROLE),
                            (UC_X86_REG_ESP, STACK), (UC_X86_REG_FPCW, 0x27f),
                            (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
        uc.reg_write(register, value)
    uc.emu_start(0x42f808, 0x42f849, count=30000)
    assert uc.reg_read(UC_X86_REG_EIP) == 0x42f849 and uc.reg_read(UC_X86_REG_ESP) == STACK
    assert values() == expected_values and events == expected_events and g['applied'] == expected_skills
    assert bool(uc.mem_read(ROLE + 0x2b4, 1)[0]) == dirty
    assert [read(MANAGER + 0x40 + i * 4) for i in range(8)] == expected_dirty_words
    rows.append(dict(sourceIndex=source_index, ownedPairIndex=pair_index, observerStage=stage_state, tank=tank_base, pet=pet_base, tankType=tank_type, equipmentField34=index % 2,
                     sourceFields=source_fields, sources=dict(currentSkillIds=None if absent else slots, equipmentSkills=ranked if gear_present else None,
                                  extraSkill=dict(baseId=skill, rank=1), itemIds=equipped_items),
                     roleValue9=[1, 10, 50][index % 3], vip=vip, vipMultiplier=multiplier,
                     selected=list(g['applied']), events=list(events), values=values(), dirty=dirty, hp=777, dirtyWords=[read(MANAGER + 0x40 + i * 4) for i in range(8)]))
(ROOT / 'recovery/output/role-recompute-native.json').write_text(json.dumps(dict(status='PASS', rows=rows, scales=scales,
    scope='Complete433466 with real getters, skill/item traversal,432951, bounds, mastery/equipment bonuses, conversions and dirty tail. '
          'Table lookup, actual521e8a record notification/getter and529a10 manager dirty method execute; movement setter432658 executes; resolved base/pet records prepared; all21 tanks and10 pets use actual complete43b62a/43a91c loader outputs. '
          'Each case also executes actual422f66 pair receipt and42f808–42f846 local observer recompute entry with real427ba2/427bf9 source getters in stage3/4. '
          'Complete table initialization/account ownership/World integration not covered.'), indent=2) + '\n')
print(f'PASS: {len(rows)} complete433466 calls, source traversal, all fields, notifications and dirty completion')
