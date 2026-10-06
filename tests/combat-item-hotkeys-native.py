"""Original hotkey dispatcher with real inventory lookup and ID classifier."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
GAME, UI, ROLE, VTABLE, MANAGER = 0x2001000, 0x2002000, 0x2003000, 0x2004000, 0x2005000
ARRAY, VECTOR, RECORD, STACK, RETURN, GETTER = 0x2006000, 0x2007000, 0x2008000, 0x2010000, 0x2011000, 0x2012000
commands = []
array_present = True
TABLE = 0x2009000

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == GETTER:
        machine.reg_write(UC_X86_REG_EAX, ARRAY if array_present else 0)
    elif address == 0x4269c4:
        machine.reg_write(UC_X86_REG_EAX, ROLE)
    elif address == 0x43bda2:
        machine.reg_write(UC_X86_REG_EAX, TABLE)
    elif address == 0x4d650b:
        assert read(stack + 8) == 28 and read(stack + 12) == 1
        commands.append(dict(kind='empty', messageId=28))
    else:
        kind = {0x426419: 'selectAmmo', 0x43d5f3: 'placeTrap', 0x43d4dc: 'useItem'}[address]
        commands.append(dict(kind=kind, **{('slot' if kind == 'selectAmmo' else 'instanceId'): read(stack + 4)}))
        machine.reg_write(UC_X86_REG_EAX, 0)  # outer dispatcher ignores request result
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + (4 if address in [0x4d650b, 0x4269c4] else 8))

for address in [GETTER, 0x426419, 0x43d5f3, 0x43d4dc, 0x4d650b, 0x4269c4, 0x43bda2]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)

def call(slot, item_id, quantity, category=0, has_controller=True, has_role=True, assigned=True, found=True, has_array=True):
    global array_present
    array_present = has_array
    uc.mem_write(GAME, bytes(0x9000))
    write(0x633588, GAME)
    write(GAME + 0x118, ROLE if has_controller else 0)
    write(GAME + 0x120, MANAGER)
    write(UI + 0x34, ROLE if has_role else 0)
    write(ROLE, VTABLE)
    write(VTABLE + 0x20, GETTER)
    write(ARRAY, *([77 if assigned else 0] * 7))
    offset = 0x10 if category == 0 else 0x20
    write(MANAGER + offset, VECTOR, VECTOR + (4 if found else 0))
    write(MANAGER + (0x20 if category == 0 else 0x10), VECTOR, VECTOR)
    write(VECTOR, RECORD)
    write(RECORD + 4, 77)
    write(RECORD + 0xc, item_id)
    write(RECORD + 0x20, quantity)
    write(STACK, RETURN, slot)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, UI)
    commands.clear()
    uc.emu_start(0x4cb2f5, RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert len(commands) <= 1
    return dict(accepted=bool(uc.reg_read(UC_X86_REG_EAX) & 255), command=commands[0] if commands else dict(kind='none'))

table = read_table(ROOT / 'CDTank/Data/table/item.dat')
ids = [int(row['values']['ItemTableID']) for row in table['rows']]
rows = []
for item_id in ids:
    for slot in range(1, 9):
        for quantity in [0, 1, 0xffffffff]:
            rows.append(dict(slot=slot, itemTableId=item_id, quantity=quantity,
                result=call(slot, item_id, quantity, category=slot % 2)))
for slot in [-1, 0, 1, 2, 4, 5, 8, 9]:
    for key in ['has_controller', 'has_role', 'assigned', 'found', 'has_array']:
        rows.append(dict(slot=slot, itemTableId=2001, quantity=1, **{key: False},
            result=call(slot, 2001, 1, **{key: False})))
quantities = []
for owned in [0, 1, 254, 255, 256, 0x7fffffff, 0xffffffff]:
    for limit in [0, 1, 255, 0xffffffff]:
        for assigned in [False, True]:
            call(2, 2001, 99, assigned=assigned)
            write(RECORD + 0x10, owned)
            write(TABLE + 0x104, limit)
            write(STACK, RETURN)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.reg_write(UC_X86_REG_ECX, MANAGER)
            uc.emu_start(0x43d2e3, RETURN, count=2000)
            assert uc.reg_read(UC_X86_REG_EIP) == RETURN
            assert read(RECORD + 0x10) == owned
            quantities.append(dict(owned=owned, limit=limit, assigned=assigned, usable=read(RECORD + 0x20)))
out = ROOT / 'recovery/output/combat-item-hotkeys-native.json'
out.write_text(json.dumps(dict(scope='Original4cb2f5/43d186/43ccac/43cccf/43bd13/439762 and43d2e3 quantity initialization. Supplied role array, ItemTable storage and request/UI callbacks; no consumption or server use execution.', rows=rows, quantities=quantities), indent=2))
print(f'PASS: {len(rows)} original hotkey dispatches and {len(quantities)} battle quantity initializations')
