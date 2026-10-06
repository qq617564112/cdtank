"""Execute full original43291e role initialization gate."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EDI, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
uc.mem_map(0, 4096)
ROLE, STACK, RETURN = 0x2001000, 0x2010000, 0x2011000
rows = []
battle_rows = []
for flags in range(8):
    present = [bool(flags & (1 << bit)) for bit in range(3)]
    for offset, value in zip([0x2a0, 0xa0, 0xa4], present):
        uc.mem_write(ROLE + offset, struct.pack('<I', 0x2002000 if value else 0))
    uc.mem_write(STACK, struct.pack('<I', RETURN))
    uc.reg_write(UC_X86_REG_ECX, ROLE)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x43291e, RETURN, count=100)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK + 4
    result = bool(uc.reg_read(UC_X86_REG_EAX))
    assert result == (not all(present))
    rows.append(dict(present=present, needsInitialization=result))
    uc.mem_write(STACK, struct.pack('<I', RETURN))
    uc.reg_write(UC_X86_REG_ECX, ROLE)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x422ba6, RETURN, count=100)
    battle_result = bool(uc.reg_read(UC_X86_REG_EAX))
    assert battle_result == (not present[0])
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4
    battle_rows.append(dict(present=present, needsInitialization=battle_result))


def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x578620:
        assert struct.unpack('<I', machine.mem_read(stack + 4, 4))[0] == 0x370
        value = ROLE
    else:
        # Base constructor is independently mapped; this fixture proves derived vtable setup.
        assert machine.reg_read(UC_X86_REG_ECX) == ROLE
        value = ROLE
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, struct.unpack('<I', machine.mem_read(stack, 4))[0])
    machine.reg_write(UC_X86_REG_ESP, stack + 4)


for address in [0x578620, 0x431bcf]:
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
uc.mem_write(ROLE, bytes(0x400))
uc.mem_write(STACK, struct.pack('<I', RETURN))
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.reg_write(UC_X86_REG_ECX, 0x2003000)
uc.emu_start(0x422ea4, RETURN, count=1000)
vtable = struct.unpack('<I', uc.mem_read(ROLE, 4))[0]
assert vtable == 0x5c2c28
gate = struct.unpack('<I', uc.mem_read(vtable + 0x3c, 4))[0]
assert gate == 0x422ba6
assert struct.unpack('<I', uc.mem_read(0x5c3a18 + 0x30, 4))[0] == 0x422ea4
assert struct.unpack('<I', uc.mem_read(0x5c3a18 + 0x44, 4))[0] == 0x4231fc
OWNER, OWNER_VTABLE, CALLBACK = 0x2004000, 0x2005000, 0x2012000
uc.mem_write(OWNER, struct.pack('<I', OWNER_VTABLE))
uc.mem_write(OWNER_VTABLE + 0x48, struct.pack('<I', CALLBACK))
initializations = []


def initialize(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == OWNER
    assert struct.unpack('<I', machine.mem_read(stack + 4, 4))[0] == ROLE
    initializations.append(ROLE)
    machine.reg_write(UC_X86_REG_EIP, struct.unpack('<I', machine.mem_read(stack, 4))[0])
    machine.reg_write(UC_X86_REG_ESP, stack + 8)


uc.hook_add(UC_HOOK_CODE, initialize, begin=CALLBACK, end=CALLBACK)
for row in battle_rows:
    for offset, present in zip([0x2a0, 0xa0, 0xa4], row['present']):
        uc.mem_write(ROLE + offset, struct.pack('<I', 0x2002000 if present else 0))
    initializations.clear()
    uc.reg_write(UC_X86_REG_EBX, OWNER)
    uc.reg_write(UC_X86_REG_EDI, ROLE)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x426558, 0x42656b, count=100)
    assert bool(initializations) == row['present'][0]
    assert uc.reg_read(UC_X86_REG_ESP) == STACK
    row['ownerInitializationCalled'] = bool(initializations)
(ROOT / 'recovery/output/role-initialization-native.json').write_text(json.dumps(dict(status='PASS', rows=rows,
    battleRows=battle_rows, battleFactory='0x422ea4', battleConstructor='0x42275e',
    battleVtable=hex(vtable), battleGate=hex(gate),
    scope='Complete43291e base gate and422ba6 network role override. Actual422ea4 factory/42275e constructor establish derived vtable; allocation/base constructor supplied. Actual426558 creation gate dispatch executes; owner initialization callback supplied. No owned-source assignment.'), indent=2)+'\n')
print(f'PASS: {len(rows)} base and {len(battle_rows)} network role gates; actual derived factory/vtable')
