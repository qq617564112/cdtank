"""Execute the original Shop buy-mode parameter arithmetic with parsed TankTable fields."""
import json
import struct
import sys
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_ESP, UC_X86_REG_EDI, UC_X86_REG_ESI, UC_X86_REG_EIP
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
TABLE, STACK, FRAME = 0x2001000, 0x2008000, 0x2010000
captured = []

def formatter(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    target, length, fmt = struct.unpack('<III', machine.mem_read(stack + 4, 12))
    pattern = bytes(machine.mem_read(fmt, 12)).split(b'\0')[0].decode('ascii')
    value = struct.unpack('<d' if pattern == '%1.1f' else '<i', machine.mem_read(stack + 16, 8 if pattern == '%1.1f' else 4))[0]
    text = ('%.1f' % value) if pattern == '%1.1f' else str(value)
    machine.mem_write(target, text.encode() + b'\0')
    captured.append({'value': value, 'text': text, 'format': pattern})
    machine.reg_write(UC_X86_REG_EAX, len(text))
    machine.reg_write(UC_X86_REG_EIP, struct.unpack('<I', machine.mem_read(stack, 4))[0])
    machine.reg_write(UC_X86_REG_ESP, stack + 4)

uc.hook_add(UC_HOOK_CODE, formatter, begin=0x57c0d6, end=0x57c0d6)
rows = []
table = json.loads((ROOT / 'recovery/output/verified/tables/tank.json').read_text())
for row in table['rows']:
    v = row['values']
    uc.mem_write(TABLE, bytes(0xc0))
    for field, offset in [('TankMove', 0x84), ('TankTurn', 0x88), ('TankBullet', 0x90)]:
        uc.mem_write(TABLE + offset, struct.pack('<i', int(v[field])))
    uc.mem_write(TABLE + 0x8c, struct.pack('<f', float(v['TankDelay'])))
    result = {}
    for field, start, end in [('moveSpeed', 0x4b7214, 0x4b7235), ('rotateSpeed', 0x4b726b, 0x4b728b), ('shootInterval', 0x4b72c1, 0x4b72e8), ('capacity', 0x4b731e, 0x4b7337)]:
        uc.mem_write(FRAME + 8, struct.pack('<I', TABLE))
        uc.reg_write(UC_X86_REG_EBP, FRAME)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.reg_write(UC_X86_REG_EDI, 0x5c83d4)
        uc.reg_write(UC_X86_REG_ESI, TABLE)
        captured.clear()
        uc.emu_start(start, end, count=100)
        if field == 'capacity':
            result[field] = {'count': int(v['TankBullet']), 'progress': struct.unpack('<f', uc.mem_read(STACK - 4, 4))[0]}
        else:
            assert len(captured) == 1
            result[field] = captured[0]
    zero = bytes(uc.mem_read(0x5c7244, 2)).split(b'\0')[0].decode()
    assert zero == '0'
    result['attackLevel'] = result['armorLevel'] = zero
    rows.append({'tankId': int(v['ID']), 'source': {key: v[key] for key in ['TankMove', 'TankTurn', 'TankDelay', 'TankBullet']}, 'display': result})
out = {'status': 'PASS', 'entry': '0x4b6ce1 buy-mode this+0x1a8=0 resolves TankTable', 'rows': rows, 'scope': 'Original Shop arithmetic/formatters executed for all TankTable rows. snprintf is a recording boundary. Levels are the explicit original0 literal assignments4b7388/4b73ba. Capacity count text is a Web adaptation; original draws progress TankBullet/6.'}
(ROOT / 'recovery/output/shop-tank-buy-parameters-native.json').write_text(json.dumps(out, indent=2) + '\n')
print(f'PASS {len(rows)} Shop TankTable parameter vectors')
