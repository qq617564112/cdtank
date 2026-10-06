"""Execute original Window disabled and effective-alpha getters for card text."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EAX
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/CEGUIBase.dll'])
uc.mem_map(0x2000000, 0x10000)
window, parent, stack, end, result = 0x2001000, 0x2002000, 0x2008000, 0x2009000, 0x2009100
uc.mem_write(end, b'\xd9\x1d' + struct.pack('<I', result))
def write(address, value):
    uc.mem_write(address, struct.pack('<I', value))
def floating(address, value):
    uc.mem_write(address, struct.pack('<f', value))
rows = []
for enabled in [False, True]:
    for inherit in [False, True]:
        for parent_alpha in [1, .5]:
            uc.mem_write(window + 0x11c, bytes([int(enabled)]))
            uc.mem_write(parent + 0x11c, b'\x01')
            uc.mem_write(window + 0x122, bytes([int(inherit)]))
            write(window + 0x3c, parent)
            write(parent + 0x3c, 0)
            floating(window + 0xe0, 1)
            floating(parent + 0xe0, parent_alpha)
            write(stack, end)
            uc.reg_write(UC_X86_REG_ESP, stack)
            uc.reg_write(UC_X86_REG_ECX, window)
            uc.emu_start(0x10030d10, end, count=1000)
            disabled = bool(uc.reg_read(UC_X86_REG_EAX))
            assert disabled == (not enabled)
            write(stack, end)
            uc.reg_write(UC_X86_REG_ESP, stack)
            uc.reg_write(UC_X86_REG_ECX, window)
            uc.emu_start(0x10030e60, end + 6, count=1000)
            alpha = struct.unpack('<f', uc.mem_read(result, 4))[0]
            assert alpha == (parent_alpha if inherit else 1)
            rows.append({'enabled': enabled, 'disabled': disabled, 'inheritAlpha': inherit,
                         'parentAlpha': parent_alpha, 'windowAlpha': 1, 'effectiveAlpha': alpha})
output = {'status': 'PASS', 'vectors': rows, 'originalEntries': {'isDisabled': '0x10030d10', 'getEffectiveAlpha': '0x10030e60'},
          'providers': 'Window/parent object fields and return storage; both getters including parent recursion execute original code.',
          'scope': 'Disabled state does not multiply Window effective alpha; source card layouts have no explicit Alpha.'}
(ROOT / 'recovery/output/room-card-text-alpha-native.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS: eight original disabled/effective-alpha vectors')
