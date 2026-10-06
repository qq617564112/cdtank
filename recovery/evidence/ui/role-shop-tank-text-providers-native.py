"""TankShop row source identities, type branches, day format and coin input."""
import json
from pathlib import Path
import struct
import sys
import pefile
from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from inspect_assets import read_table

tanks = json.loads((ROOT / 'recovery/output/role-tank-base-native.json').read_text())
assert tanks['status'] == 'PASS'
by_id = {int(row['values']['ID']): row['values'] for row in tanks['rows']}
shop = read_table(ROOT / 'CDTank/Data/table/tankshop.dat')
assert shop['columns'][5] == '坦克代币价' and shop['columns'][10] == '耐久度默认'
strings = {int(row['values']['ID']): row['values']['String'] for row in
           read_table(ROOT / 'CDTank/Data/table/gamestring.dat')['rows']}
u, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
u.mem_map(0x2000000, 0x20000)
TANK, SHOP, FRAME, STACK, VALUE, VECTOR = [0x2001000 + index * 0x2000 for index in range(6)]
stage = ''
captured = []


def read(address):
    return struct.unpack('<I', u.mem_read(address, 4))[0]


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x401626:
        machine.reg_write(UC_X86_REG_EAX, VALUE)
        machine.reg_write(UC_X86_REG_EIP, read(stack))
        machine.reg_write(UC_X86_REG_ESP, stack + 8)
    elif address == 0x417e17:
        captured.append(read(stack + 4))
        machine.emu_stop()
    elif address == 0x57b70f:
        captured.append(struct.unpack('<i', machine.mem_read(stack + 12, 4))[0])
        machine.emu_stop()
    elif address == 0x4b4ad2:
        captured.append(struct.unpack('<d', machine.mem_read(stack + 8, 8))[0])
        machine.emu_stop()
    else:
        captured.append(dict(getter=hex(address), record=hex(read(stack + 4))))
        machine.reg_write(UC_X86_REG_EIP, read(stack))
        machine.reg_write(UC_X86_REG_ESP, stack + 4)


for address in [0x401626, 0x417e17, 0x57b70f, 0x4b4ad2, 0x4d7e58, 0x4d87bb, 0x4d899c, 0x4d99d6]:
    u.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)

# Supply already resolved lookups, then execute the factory's actual push/calls.
u.mem_write(VECTOR, struct.pack('<I', SHOP))
u.mem_write(FRAME + 8, struct.pack('<I', TANK))
u.mem_write(FRAME - 0x10, struct.pack('<I', SHOP))
u.reg_write(UC_X86_REG_EBP, FRAME)
u.reg_write(UC_X86_REG_ESP, STACK)
u.reg_write(UC_X86_REG_EDI, VECTOR)
u.emu_start(0x4b5d9e, 0x4b5dd9, count=100)
caller = list(captured)
assert [entry['record'] for entry in caller] == [hex(TANK), hex(TANK), hex(SHOP), hex(SHOP)]

rows = []
for row in shop['rows']:
    values = row['values']
    tank_id = int(values['坦克ID'])
    tank_type = int(by_id[tank_id]['TankType'])
    u.mem_write(TANK + 0x50, struct.pack('<I', tank_type))
    u.mem_write(FRAME + 8, struct.pack('<I', TANK))
    for reg, value in [(UC_X86_REG_EBP, FRAME), (UC_X86_REG_ESP, STACK)]:
        u.reg_write(reg, value)
    captured.clear()
    u.emu_start(0x4d87c8, 0x4d88e4, count=100)
    assert captured == [679 + tank_type]
    type_id = captured[0]
    # The getter itself only pushes the source signed int into sprintf.
    days = int(values['耐久度默认'])
    u.mem_write(SHOP + 0x34, struct.pack('<i', days))
    u.mem_write(FRAME + 8, struct.pack('<I', SHOP))
    u.reg_write(UC_X86_REG_EBP, FRAME)
    u.reg_write(UC_X86_REG_ESP, STACK)
    u.reg_write(UC_X86_REG_ESI, VALUE)
    captured.clear()
    u.emu_start(0x4d89fd, 0x4d8a0d, count=100)
    assert captured == [days]
    coin = int(values['坦克代币价'])
    u.mem_write(SHOP + 0x20, struct.pack('<I', coin))
    u.mem_write(FRAME + 8, struct.pack('<I', SHOP))
    u.reg_write(UC_X86_REG_EBP, FRAME)
    u.reg_write(UC_X86_REG_ESP, STACK)
    captured.clear()
    u.emu_start(0x4d99e6, 0x4d9a13, count=100)
    assert captured == [coin * .1]
    assert captured[0] == int(captured[0])
    rows.append(dict(tankId=tank_id, tankType=tank_type, typeGamestringId=type_id,
                     typeText=strings[type_id], defaultDurability=days,
                     dayText=strings[624] % days, shopCoin=coin,
                     coinFormatterDouble=captured[0],
                     priceText=strings[78] + '  ' + strings[722] + str(int(captured[0]))))

pe = pefile.PE(str(ROOT / 'CDTank/CDTank.exe'))
base = pe.OPTIONAL_HEADER.ImageBase
cs = Cs(CS_ARCH_X86, CS_MODE_32)


def trace(start, end):
    return [dict(va=hex(i.address), asm=i.mnemonic + ' ' + i.op_str)
            for i in cs.disasm(pe.get_data(start - base, end - start), start)]


result = dict(status='PASS_SOURCE_TANKSHOP_THREE_ROW_GETTER_INPUTS', tasks=['UI57', 'M5-10'],
    caller=caller, rows=rows,
    mappings={'4d87bb': 'Tank record+50 = TankType;1/2/3/4 -> gamestring680/681/682/683; unmatched leaves output untouched',
              '4d899c': 'looked-up Tankshop record+34 = 耐久度默认, column10; gamestring624 signed %d, no divide or expiry calculation',
              '4d99d6': 'original list Tankshop record+20 = 坦克代币价,column5; unsigned32 ->double*.1 ->4b4ad2'},
    formatterReuse='role-shop-pet-secondary-tertiary-native.json: precision16/default double ostream and purchase prefix/two spaces/currency concatenation; this getter additionally corrects negative signed FILD by2^32',
    traces={'factory': trace(0x4b5d70, 0x4b5dd9),
            'tankTypeLoader': trace(0x43b686, 0x43b69d),
            'shopLoader': trace(0x43b375, 0x43b423),
            'shopManagerConstructor': trace(0x41b287, 0x41b2ba),
            'shopManagerInstallation': trace(0x41c4e9, 0x41c501),
            'shopNamedTableLoad': trace(0x41bc20, 0x41bc6e),
            'shopManagerGetter': trace(0x413d01, 0x413d13),
            'shopRecordFactory': trace(0x43b33f, 0x43b375),
            'shopRecordConstructor': trace(0x43b2c6, 0x43b2f9),
            'recordDispatch': trace(0x411794, 0x4117b9),
            'typeGetter': trace(0x4d87c8, 0x4d88f1),
            'dayGetter': trace(0x4d899c, 0x4d8a38),
            'coinGetter': trace(0x4d99e6, 0x4d9bc1)},
    limits=['Existing Tank loader reused, no full loader rerun. Tankshop mapping identified directly from43b375 column loop and stores.',
            'Lookup/string/sprintf/number formatter are capture boundaries; branch/input arithmetic and factory argument pushes execute original instructions.',
            'Display days do not establish expiry lifecycle. Display coin scale does not change raw BUY payment.',
            'No extra icon, production, wire, browser, types, build or old numeric regression.'])
(ROOT / 'recovery/output/role-shop-tank-text-providers-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: original factory pointer identities and {len(rows)} TankShop three text inputs')
