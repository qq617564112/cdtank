"""Actual426509–42653f table getters and hit/miss assignment gates."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x30000)
GLOBAL, STATE, PET_MANAGER, TANK_MANAGER, MESSAGE, ROLE, STACK = [0x2001000 + i * 0x1000 for i in range(7)]

def write(address, *values): uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
write(0x633588, GLOBAL)
write(GLOBAL + 0x114, STATE)
write(STATE + 0x80, PET_MANAGER, TANK_MANAGER)
pet_rows = json.loads((ROOT / 'recovery/output/role-pet-base-native.json').read_text())['rows']
tank_rows = json.loads((ROOT / 'recovery/output/role-tank-base-native.json').read_text())['rows']
pets = {row['result']['id']: 0x2010000 + i * 0x100 for i, row in enumerate(pet_rows)}
tanks = {row['result']['id']: 0x2020000 + i * 0x100 for i, row in enumerate(tank_rows)}
lookups = []


def lookup(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    manager = machine.reg_read(UC_X86_REG_ECX)
    key = read(stack + 4)
    assert manager in [PET_MANAGER + 0xc, TANK_MANAGER + 0xc]
    mapping = pets if manager == PET_MANAGER + 0xc else tanks
    lookups.append(dict(kind='pet' if mapping is pets else 'tank', id=key))
    machine.reg_write(UC_X86_REG_EAX, mapping.get(key, 0))
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 8)


uc.hook_add(UC_HOOK_CODE, lookup, begin=0x411068, end=0x411068)
reverse = {pointer: key for key, pointer in pets.items()} | {pointer: key for key, pointer in tanks.items()}
rows = []
for pet_id, tank_id in [(p, t) for p in pets for t in tanks] + [(0xffffffff, t) for t in tanks] + [(p, 0xffffffff) for p in pets] + [(0xffffffff, 0xffffffff)]:
    before = dict(pet=next(iter(pets)), tank=next(iter(tanks)))
    write(ROLE + 0x2a4, pets[before['pet']], tanks[before['tank']])
    write(MESSAGE + 0x78, pet_id)
    write(MESSAGE + 0x68, tank_id)
    lookups.clear()
    uc.reg_write(UC_X86_REG_ESI, MESSAGE)
    uc.reg_write(UC_X86_REG_EDI, ROLE)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x426509, 0x42653f, count=1000)
    assert uc.reg_read(UC_X86_REG_ESP) == STACK
    rows.append(dict(field68=tank_id, field78=pet_id, before=before, lookups=list(lookups),
                     result=dict(pet=reverse[read(ROLE + 0x2a4)], tank=reverse[read(ROLE + 0x2a8)])))
(ROOT / 'recovery/output/role-table-binding-native.json').write_text(json.dumps(dict(status='PASS', rows=rows,
    scope='Original426509–42653f with actual413c83/413c95 global service getters; table lookup supplied. '
          'Hit/miss pointer preservation and order; outer create-message reader/account ownership not covered.'), indent=2)+'\n')
print(f'PASS: {len(rows)} original pet/tank table bindings and missing-record preservation')
