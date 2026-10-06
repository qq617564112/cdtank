"""Execute complete422dfd and actual inventory vector lookup order."""
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
uc.mem_map(0x2000000, 0x30000)
GAME, INVENTORY, RESOURCES, TABLE, VECTOR, RECORD = [0x2001000 + n * 0x1000 for n in range(6)]
STACK, RETURN = 0x2010000, 0x2011000
calls = []
def write(address, *values):
    uc.mem_write(address, struct.pack('<'+'I'*len(values), *[value & 0xffffffff for value in values]))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
def lookup(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == TABLE + 0xc
    key = read(stack + 4)
    calls.append(key)
    machine.reg_write(UC_X86_REG_EAX, 0x2009000 if found else 0)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 8)
uc.hook_add(UC_HOOK_CODE, lookup, begin=0x411068, end=0x411068)
write(0x633588, GAME)
write(GAME + 0x120, INVENTORY)
write(GAME + 0x114, RESOURCES)
write(RESOURCES + 0x7c, TABLE)
rows=[]
ids=[int(row['values']['ItemTableID']) for row in read_table(ROOT / 'CDTank/Data/table/item.dat')['rows']]
for index, table_id in enumerate(ids):
    for group in range(8):
        for found in [False, True]:
            uc.mem_write(INVENTORY, bytes(0x100))
            instance = [73, 0x80000001, 0xffffffff][index % 3]
            write(INVENTORY+0x10+group*16, VECTOR, VECTOR+4)
            write(VECTOR, RECORD)
            write(RECORD+4, instance)
            write(RECORD+0xc, table_id)
            calls.clear()
            write(STACK, RETURN, 0x11223344, instance)
            uc.reg_write(UC_X86_REG_ESP, STACK)
            uc.emu_start(0x422dfd, RETURN, count=1000)
            accepted=group in [0,1,2,3,5,6]
            assert calls == ([table_id] if accepted else [])
            result=uc.reg_read(UC_X86_REG_EAX)
            assert result == (0x2009000 if accepted and found else 0)
            # This cdecl callback leaves its two input arguments for the caller.
            assert uc.reg_read(UC_X86_REG_ESP)==STACK+4
            rows.append(dict(tableId=table_id, instanceId=instance, group=group, tableFound=found,
                             result=bool(result), lookups=list(calls)))
# Duplicate instance records in every vector: the first supported vector wins.
for group in range(8):
    pointer=VECTOR+group*4;record=RECORD+group*0x40
    write(INVENTORY+0x10+group*16,pointer,pointer+4)
    write(pointer,record);write(record+4,73);write(record+0xc,100+group)
found=True;calls.clear();write(STACK,RETURN,0,73);uc.reg_write(UC_X86_REG_ESP,STACK)
uc.emu_start(0x422dfd,RETURN,count=1000)
assert calls==[100]
(ROOT/'recovery/output/role-item-resolver-native.json').write_text(json.dumps(dict(status='PASS',rows=rows,
    duplicateFirstTableId=100,scope='Complete422dfd,43d728 and six real vector searches; parsed inventory/table sources prepared, table lookup411068 supplied. No World casting/account assembly.'),indent=2)+'\n')
print(f'PASS: {len(rows)} native instance/table callback cases and duplicate first-vector precedence')
