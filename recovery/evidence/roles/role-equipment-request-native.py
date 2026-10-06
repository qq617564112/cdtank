"""Execute42762e equipment request decisions and real3abb constructor/writer."""
import itertools
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x30000)
GAME, OWNER, ROLE, TANK, RECORD, ARRAY, ROLE_VTABLE, CALLBACK_OBJECT, CALLBACK_VTABLE = [0x2001000+i*0x1000 for i in range(9)]
STACK, RETURN, GET_TANK, GET_GEAR, GET_ARRAY, CALLBACK = [0x2020000+i*0x1000 for i in range(6)]
sent, notifications, diagnostics, wire = [], [], [], []
records = {}
limit = 0
seed = 0

def write(address, *values):
    uc.mem_write(address, struct.pack('<'+'I'*len(values), *[v & 0xffffffff for v in values]))
def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]
def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    ecx = machine.reg_read(UC_X86_REG_ECX)
    pop, value = 0, 0
    if address == 0x425c34:
        write(ecx+0x14, seed)  # caller stack contents before the real constructor
        return
    if address == 0x4269c4: value = ROLE
    elif address == GET_TANK: value = TANK
    elif address == GET_GEAR: value = 0
    elif address == GET_ARRAY:
        assert read(stack+4) == 2
        pop, value = 4, ARRAY
    elif address == 0x421cbe: pop, value = 4, limit
    elif address == 0x43cd38: pop, value = 4, records.get(read(stack+4), 0)
    elif address == 0x413ec4:
        packet = read(stack+4)
        assert read(packet) == 0x5c32f4
        sent.append(dict(instanceId=read(packet+0xc), slot=read(packet+0x10), field14=read(packet+0x14)))
        pop = 4
    elif address == CALLBACK:
        notifications.append(read(stack+4)); pop = 4
    elif address == 0x40bd28: diagnostics.append('slot-limit')
    elif address == 0x4d967b:
        assert read(stack+4) == 0x2df
        diagnostics.append('message735')
    elif address == 0x401c7a:
        wire.append(dict(value=read(read(stack+4)), bits=read(stack+8))); pop = 8
    else: raise AssertionError(hex(address))
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack+4+pop)
for address in [0x425c34,0x4269c4,GET_TANK,GET_GEAR,GET_ARRAY,0x421cbe,0x43cd38,0x413ec4,CALLBACK,0x40bd28,0x4d967b,0x401c7a]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
write(0x633588, GAME); write(GAME+0x118, ROLE); write(GAME+0x120, OWNER)
write(ROLE, ROLE_VTABLE); write(ROLE_VTABLE+0x40, GET_TANK); write(ROLE_VTABLE+0x3c, GET_GEAR); write(ROLE_VTABLE+0x20, GET_ARRAY)
write(CALLBACK_OBJECT, CALLBACK_VTABLE); write(CALLBACK_VTABLE+8, CALLBACK)
rows = []
# Tank/pet/items, all five part classes, zero and unsigned unknown class.
for table_id, slot, limit, callback, scenario in itertools.product([1,10001,13001,14001,15001,16001,17001,0,0xffffffff],range(4),[0,1,3],[False,True],range(5)):
    for values in [sent, notifications, diagnostics]: values.clear()
    uc.mem_write(OWNER, bytes(0x200)); uc.mem_write(TANK, bytes(0x100)); uc.mem_write(ARRAY, bytes(0x100))
    write(OWNER+0xe8, CALLBACK_OBJECT if callback else 0)
    write(RECORD+4, 0xf1234567); write(RECORD+0xc, table_id)
    records.clear()
    part_ids = [0,0,0]
    equipped = [0]*3
    owned = []
    if scenario == 1: part_ids[1] = table_id
    if scenario in [2,3,4]:
        equipped[0] = 0xf1234567 if scenario == 2 else 77
        if scenario != 4:
            existing = RECORD+0x100
            write(existing+4, equipped[0]); write(existing+0xc, table_id)
            records[equipped[0]] = existing
            owned.append(dict(instanceId=equipped[0],itemTableId=table_id))
    write(TANK+0x58,*part_ids); write(ARRAY,*equipped)
    seed = (0x8bad0000+scenario) & 0xffffffff
    write(STACK, RETURN, RECORD, slot); uc.reg_write(UC_X86_REG_ESP,STACK); uc.reg_write(UC_X86_REG_ECX,OWNER)
    uc.emu_start(0x42762e,RETURN,count=3000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN and uc.reg_read(UC_X86_REG_ESP) == STACK+12
    assert read(RECORD+4)==0xf1234567 and read(RECORD+0xc)==table_id
    for packet in sent: assert packet == dict(instanceId=0xf1234567,slot=slot,field14=seed)
    rows.append(dict(record=dict(instanceId=0xf1234567,itemTableId=table_id),slot=slot,limit=limit,callback=callback,parts=part_ids,equipped=equipped,owned=owned,field14=seed,sent=list(sent),notifications=list(notifications),diagnostics=list(diagnostics)))
# Execute complete writer with real bit-width calls (bitstream sink supplied).
packet=RECORD+0x400
write(packet+0xc,0xf1234567,3,0x8bad0012); wire.clear()
write(STACK,RETURN,ARRAY);uc.reg_write(UC_X86_REG_ESP,STACK);uc.reg_write(UC_X86_REG_ECX,packet)
uc.emu_start(0x425ca4,RETURN,count=300)
assert wire == [dict(value=0xf1234567,bits=32),dict(value=3,bits=32),dict(value=0x8bad0012,bits=8)]
(ROOT/'recovery/output/role-equipment-request-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,wire=wire,scope='Complete42762e, real425c34 constructor/destructor,439762 classification and425ca4 writer. Role getters, computed421cbe slot count, inventory lookup, transport/UI and bitstream sinks supplied. field14 retains supplied stack bytes; no server equipment mutation.'),indent=2)+'\n')
print(f'PASS: {len(rows)} native equipment request decisions, unchanged source and 32/32/8 writer')
