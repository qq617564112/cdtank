"""Execute original43b425 maintenance quotes with qualified source fields."""
import json
import struct
import sys
from pathlib import Path

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
TANK, GAME, STATE, MANAGER, ROW, STACK, STOP = [0x2001000 + i * 0x1000 for i in range(7)]


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


tank = next(row['values'] for row in json.loads(
    (ROOT / 'recovery/output/role-tank-base-native.json').read_text())['rows']
    if int(row['values']['ID']) == 3)
scale = next(row['values'] for row in json.loads(
    (ROOT / 'recovery/output/verified/tables/datascale.json').read_text())['rows']
    if int(row['values']['ID']) == 48)
write(0x633588, GAME)
write(GAME + 0x114, STATE)
write(STATE + 0xac, MANAGER)
write(TANK + 0x48, int(tank['TankMoney']), int(tank['TankCoin']))
write(ROW + 0xc, 48)
write(ROW + 0x2c, int(scale['Min']), int(scale['Max']))
lookups = []


def lookup(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == MANAGER + 0xc
    assert read(stack + 4) == 48
    lookups.append(48)
    machine.reg_write(UC_X86_REG_EAX, ROW)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 8)


uc.hook_add(UC_HOOK_CODE, lookup, begin=0x411068, end=0x411068)
rows = []
for currency in (0, 1):
    for days in (1, 7, 30):
        lookups.clear()
        write(STACK, STOP, currency, days)
        uc.reg_write(UC_X86_REG_ECX, TANK)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.emu_start(0x43b425, STOP, count=1000)
        assert uc.reg_read(UC_X86_REG_EIP) == STOP
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 12
        cost = struct.unpack('<i', struct.pack('<I', uc.reg_read(UC_X86_REG_EAX)))[0]
        weekly = int(tank['TankCoin']) if currency == 0 else int(tank['TankMoney']) * int(scale['Max'])
        expected = weekly // 5 if days == 1 else weekly if days == 7 else weekly * 2
        assert cost == expected and lookups == ([] if currency == 0 else [48])
        rows.append({'currency': currency, 'days': days, 'rawCost': cost,
                     'dataScaleLookups': list(lookups)})
result = {
    'status': 'PASS_ORIGINAL_TANK_MAINTENANCE_SIX_COST_BRANCHES',
    'function': '0x43b425', 'tankId': 3, 'tankMoney': int(tank['TankMoney']),
    'tankCoin': int(tank['TankCoin']), 'dataScale': scale, 'rows': rows,
    'scope': 'Complete43b425 with actual413d4e resource getter. Qualified Tankloader '
             'field48/4c and DataScale loader+30 Max reused; table lookup supplied. '
             'Raw coin values, not displayed coin×0.1. No server debit, duration '
             'update, repair acceptance or normal-client session.',
}
(ROOT / 'recovery/output/tank-maintenance-cost-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'], rows)
