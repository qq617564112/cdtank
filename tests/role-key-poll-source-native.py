"""Execute the original keyboard poller with supplied physical key states."""
from pathlib import Path
import configparser
import json
import struct
import sys

from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x10000)
uc.mem_map(0x2000000, 0x10000)
STACK, STOP, CONTROLLER = 0x2001000, 0x2002000, 0x2003000
SETTINGS, INPUT = 0x2004000, 0x2005000
names = ['MainUp', 'MainDown', 'MainLeft', 'MainRight', 'AttachedUp',
         'AttachedDown', 'AttachedLeft', 'AttachedRight', 'Shoot', 'UseItem',
         'PrevBullet', 'NextBullet', 'PrevItem', 'NextItem', 'AttachedShoot',
         'AttachedUseItem', 'AttachedPrevBullet', 'AttachedNextBullet',
         'AttachedPrevItem', 'AttachedNextItem']
config = configparser.ConfigParser()
config.read(ROOT / 'CDTank/Config/SystemSetting.ini', encoding='gb18030')
keys = [int(config['KeySetting'][name]) for name in names]
uc.mem_write(SETTINGS + 4, struct.pack('<20I', *keys))
held = set()
queries = []

def word(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def finish(value, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, word(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

def hook(machine, address, size, data):
    if address == 0x414115:
        # Supply initialized settings singleton; its indexed getter executes.
        finish(SETTINGS)
    elif address == 0x41415d:
        # Original caller leaves the key argument for the subsequent key query.
        finish(INPUT)
    elif address in (0x408713, 0x408398):
        key = word(uc.reg_read(UC_X86_REG_ESP) + 4)
        queries.append({'entry': hex(address), 'key': key})
        finish(int(key in held), 4)

for address in (0x414115, 0x41415d, 0x408713, 0x408398):
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)

rows = []
cases = [('no-key', [], 0), *[(name, [keys[i]], 1 << (i % 4))
         for i, name in enumerate(names[:8])],
         ('Shoot', [keys[8]], 256), ('paired-forward', [keys[0], keys[4]], 1),
         ('all-directions', keys[:8], 15), ('disabled-poll', keys[:9], 0)]
for name, pressed, expected in cases:
    held = set(pressed)
    queries.clear()
    uc.mem_write(CONTROLLER + 0x38, bytes([name != 'disabled-poll']))
    uc.mem_write(0x6350f4, struct.pack('<I', 0))
    uc.mem_write(STACK, struct.pack('<I', STOP))
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.reg_write(UC_X86_REG_ECX, CONTROLLER)
    uc.emu_start(0x424242, STOP, count=10000)
    actual = word(0x6350f4)
    assert actual == expected, (name, actual, expected)
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4
    rows.append({'name': name, 'keys': pressed, 'expectedBits': expected,
                 'actualBits': actual, 'queries': list(queries)})

result = {'status': 'PASS_ORIGINAL_KEY_POLL_SOURCE', 'entry': '0x424242',
          'settingsReader': '0x41c756', 'bitWriter': '0x4047b1 -> 0x41784e',
          'fixture': 'Installed SystemSetting.ini key values; initialized singleton and physical key state supplied.',
          'scope': 'Original poller/getter/bit-write execute. No movement, turret, OS polling, settings initialization or network acceptance claim.',
          'rows': rows}
output = ROOT / 'recovery/output/role-key-poll-source-native.json'
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'], len(rows))
