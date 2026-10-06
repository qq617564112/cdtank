"""Execute full4264c4 and actual manager create/bind wrapper4231fc."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x40000)
GLOBAL, STATE, OWNER, MESSAGE, ROLE, OLD_RECORD, PET_MANAGER, TANK_MANAGER, UNUSED = [0x2001000+i*0x1000 for i in range(9)]
STACK, RETURN = 0x2020000, 0x2021000
PET, TANK, OLD_PET, OLD_TANK = 0x2023000, 0x2024000, 0x2025000, 0x2026000

def write(address, *values): uc.mem_write(address, struct.pack('<'+'I'*len(values), *values))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack+4+pop)

# Real constructor establishes primary and secondary manager vtables.
uc.reg_write(UC_X86_REG_ESI, OWNER)
uc.reg_write(UC_X86_REG_ESP, STACK)
uc.emu_start(0x42f9bb, 0x42f9cf, count=30)
assert read(OWNER) == 0x5c3a18 and read(OWNER+8) == 0x5c3a10
assert read(read(OWNER)+0x30) == 0x422ea4
assert read(read(OWNER)+0x44) == 0x4231fc
assert read(read(OWNER)+0x48) == 0x422fb1
write(0x633588, GLOBAL)
write(GLOBAL+0x114, STATE)
write(GLOBAL+0xc0, 0x12345678)
write(STATE+0x80, PET_MANAGER, TANK_MANAGER)
assert read(0x5d87a8+0x44) == 0x52273e
events = []
existing = False
pet_hit = tank_hit = False

def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x52273e:
        assert this == MESSAGE and read(stack+4) == 0x12345678
        events.append(dict(kind='prepare', record=read(stack+4)))
    elif address == 0x48a226:
        assert this == OWNER and read(stack+4) == 71
        events.append(dict(kind='find', id=71)); finish(ROLE if existing else 0, 4)
    elif address == 0x578620:
        assert read(stack+4) == 0x370
        events.append(dict(kind='allocate', bytes=0x370)); finish(ROLE)
    elif address == 0x431bcf:
        assert this == ROLE
        # Supply base construction; execute its actual owned-reference zeroing slice.
        machine.mem_write(ROLE, bytes(0x400))
        events.append(dict(kind='baseConstructor'))
        finish(ROLE)
    elif address == 0x431d80:
        events.append(dict(kind='bind', previous=read(this+0x2a0), record=read(stack+4)))
    elif address == 0x421673:
        assert this == OWNER and read(stack+4) == ROLE
        assert read(ROLE+0x2a0) == MESSAGE
        events.append(dict(kind='attach', record=read(ROLE+0x2a0))); finish(pop=4)
    elif address == 0x411068:
        key = read(stack+4)
        kind = 'pet' if this == PET_MANAGER+0xc else 'tank'
        assert this in [PET_MANAGER+0xc, TANK_MANAGER+0xc]
        assert key == (5 if kind == 'pet' else 2)
        events.append(dict(kind='lookup', table=kind, id=key))
        finish((PET if pet_hit else 0) if kind == 'pet' else (TANK if tank_hit else 0), 4)
    elif address == 0x422fb1:
        assert this == OWNER and read(stack+4) == ROLE
        assert read(ROLE+0x2a0) == MESSAGE
        events.append(dict(kind='initialize', local=read(OWNER+0x3c) == ROLE)); finish(pop=4)
    elif address == 0x42300f:
        assert this == OWNER and read(stack+4) == ROLE and read(OWNER+0x3c) == ROLE
        events.append(dict(kind='selectLocal')); finish(pop=4)
    elif address == 0x4259ae:
        assert this == OWNER and read(stack+4) == ROLE
        events.append(dict(kind='dispatchStatus', status=read(stack+8))); finish(pop=8)

for address in [0x52273e, 0x48a226, 0x578620, 0x431bcf, 0x431d80, 0x421673,
                0x411068, 0x422fb1, 0x42300f, 0x4259ae]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
rows=[]
for flags in range(16):
    existing, local, pet_hit, tank_hit = [bool(flags & (1<<bit)) for bit in range(4)]
    for status in range(4):
        uc.mem_write(ROLE, bytes(0x400))
        write(ROLE, 0x5c2c28)
        write(ROLE+0x2a0, OLD_RECORD, OLD_PET, OLD_TANK)
        write(ROLE+0xa0, 0x76543210, 0x65432100)
        write(OWNER+0x3c, 0x23456789)
        write(MESSAGE, 0x5d87a8)
        write(MESSAGE+0xc, 71)
        write(MESSAGE+0x68, 2)
        write(MESSAGE+0x78, 5)
        write(MESSAGE+0x90, status)
        write(STATE+0x6c, 71 if local else 72)
        events.clear()
        write(STACK, RETURN, MESSAGE)
        uc.reg_write(UC_X86_REG_ECX, OWNER)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.emu_start(0x4264c4, RETURN, count=10000)
        assert uc.reg_read(UC_X86_REG_EIP) == RETURN, (hex(uc.reg_read(UC_X86_REG_EIP)), events)
        assert uc.reg_read(UC_X86_REG_ESP) == STACK+8
        assert read(ROLE+0x2a0) == MESSAGE and read(ROLE+0x2ac) == 71
        assert read(MESSAGE+8) == 0x12345678
        assert read(ROLE+0xa0) == (0x76543210 if existing else 0)
        assert read(ROLE+0xa4) == (0x65432100 if existing else 0)
        assert read(ROLE+0x2a4) == (PET if pet_hit else OLD_PET if existing else 0)
        assert read(ROLE+0x2a8) == (TANK if tank_hit else OLD_TANK if existing else 0)
        assert events[-1] == dict(kind='dispatchStatus', status=status)
        assert read(OWNER+0x3c) == (ROLE if local else 0x23456789)
        rows.append(dict(existing=existing, local=local, petHit=pet_hit, tankHit=tank_hit,
            status=status, events=list(events), baseBound=read(ROLE+0xa0), equipmentBound=read(ROLE+0xa4)))
(ROOT/'recovery/output/battle-role-receive-native.json').write_text(json.dumps(dict(status='PASS',
    managerVtable='0x5c3a18', secondaryVtable='0x5c3a10', create='0x4231fc', factory='0x422ea4', rows=rows,
    scope='Full4264c4, actual4231fc create/bind/attach wrapper,422ea4/42275e factory and derived constructor,431d5c record setter, actual52273e record context assignment,413c83/413c95 table services,422ba6 gate and43293d status getter. Base construction, heap, registry lookup/insertion, table lookup, rendering initialize/local selection and lifecycle dispatch supplied. Owned references remain untouched on update and base-constructor supplied zero on creation; no account assembly proof.'),indent=2)+'\n')
print(f'PASS: {len(rows)} full battle role arrivals, actual primary vtable create wrapper and record binding')
