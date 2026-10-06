"""Execute complete mastery tail including actual equipment bonus functions; capture float setter calls."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EDI, UC_X86_REG_EBX, UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESI, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG, UC_X86_REG_EIP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
ROLE, EQUIPMENT, TANK, VTABLE, SETTER = 0x2001000, 0x2002000, 0x2003000, 0x2004000, 0x2011000
STACK, FRAME = 0x2010000, 0x2010100
source = json.loads((ROOT / 'recovery/output/role-recompute-limits-native.json').read_text())
equipment_rows = json.loads((ROOT / 'recovery/output/role-owned-equipment-native.json').read_text())['rows']
scales = {key: struct.unpack('<f', uc.mem_read(address, 4))[0] for key, address in [('move', 0x61e494), ('turn', 0x61e498)]}
events, mastery = [], []


def setter(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == ROLE
    return_address, selector, value = struct.unpack('<II f', uc.mem_read(stack, 12))
    events.append(dict(selector=selector, value=value))
    machine.reg_write(UC_X86_REG_EIP, return_address)
    machine.reg_write(UC_X86_REG_ESP, stack + 12)


def capture_mastery(machine, address, size, data):
    global mastery
    signed = lambda value: value if value < 0x80000000 else value - 0x100000000
    mastery = [signed(machine.reg_read(UC_X86_REG_EAX)), struct.unpack('<i', uc.mem_read(FRAME + 8, 4))[0],
               signed(machine.reg_read(UC_X86_REG_EDI)), signed(machine.reg_read(UC_X86_REG_EBX)),
               struct.unpack('<i', uc.mem_read(FRAME - 4, 4))[0], struct.unpack('<i', uc.mem_read(FRAME + 0x18, 4))[0]]


uc.hook_add(UC_HOOK_CODE, capture_mastery, begin=0x433b0c, end=0x433b0c)
uc.hook_add(UC_HOOK_CODE, setter, begin=SETTER, end=SETTER)
uc.mem_write(ROLE, struct.pack('<I', VTABLE))
uc.mem_write(VTABLE + 0x2c, struct.pack('<I', SETTER))
uc.mem_write(ROLE + 0x2a8, struct.pack('<I', TANK))
rows = []
for index, original in enumerate(source['rows']):
    state = original['bounded']
    equipment_index = index % len(equipment_rows)
    equipment = dict(equipment_rows[equipment_index]['result'])
    equipment['52'] = index % 2
    for offset, value in equipment.items():
        uc.mem_write(EQUIPMENT + int(offset), struct.pack('<I', value))
    uc.mem_write(ROLE + 0x74, struct.pack('<f', state['roleFloats']['116']))
    uc.mem_write(ROLE + 0x7c, struct.pack('<f', state['roleFloats']['124']))
    for offset, value in zip([-0x10, 8, -8, -0xc, -4, 0x18], state['accumulators']):
        uc.mem_write(FRAME + offset, struct.pack('<i', value))
    uc.mem_write(FRAME + 0xc, struct.pack('<I', EQUIPMENT))
    tank_type = index % 6
    uc.mem_write(TANK + 0x50, struct.pack('<I', tank_type))
    events.clear()
    for register, value in [(UC_X86_REG_ESI, ROLE), (UC_X86_REG_EBP, FRAME), (UC_X86_REG_ESP, STACK),
                            (UC_X86_REG_EAX, state['accumulators'][0] & 0xffffffff),
                            (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
        uc.reg_write(register, value)
    uc.emu_start(0x433ad6, 0x433c55, count=3000)
    if tank_type in [1, 2, 3, 4]:
        assert len(events) == 2 and [e['selector'] for e in events] == [10, 11]
    else:
        assert not events
    rows.append(dict(input=state, equipmentFields=equipment, tankType=tank_type,
                     events=list(events), accumulators=mastery,
                     atk=struct.unpack('<f', uc.mem_read(ROLE + 0x74, 4))[0],
                     defense=struct.unpack('<f', uc.mem_read(ROLE + 0x7c, 4))[0]))
(ROOT / 'recovery/output/role-recompute-mastery-native.json').write_text(json.dumps(dict(status='PASS', scales=scales, rows=rows,
    scope='Complete433ad6–433c55 including actual421c4b/421c7a bonus calculation; float setter calls captured at vtable boundary. '
          'Tank type and scale resource initialization not covered.'), indent=2) + '\n')
print(f'PASS: {len(rows)} original mastery/type/movement/equipment-bonus tails')
