"""Execute original live gfx update slice: camera before effect-manager."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_EDI, UC_X86_REG_ESP
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x40000)
GFX, CAMERA, VTABLE, MANAGER, STACK, STOP, UPDATE = 0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2008000, 0x203f000, 0x203f010
events = []
def uint(address):return struct.unpack('<I', machine.mem_read(address, 4))[0]
def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == UPDATE:
        events.append(dict(kind='camera', delta=struct.unpack('<f', uc.mem_read(stack + 4, 4))[0]))
        pop, value = 4, 0
    elif address == 0x47b81b:
        pop, value = 0, MANAGER
    elif address == 0x4790dc:
        assert uc.reg_read(UC_X86_REG_ECX) == MANAGER
        events.append(dict(kind='effects', delta=struct.unpack('<f', uc.mem_read(stack + 4, 4))[0]))
        pop, value = 4, 0
    else:return
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, uint(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)
machine.hook_add(UC_HOOK_CODE, hook)
machine.mem_write(CAMERA, struct.pack('<I', VTABLE))
machine.mem_write(VTABLE + 12, struct.pack('<I', UPDATE))
rows = []
for delta in [0, .016, .1, .5]:
    events.clear()
    machine.mem_write(GFX + 0x14, struct.pack('<f', delta))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_ESI, GFX)
    machine.reg_write(UC_X86_REG_EDI, CAMERA)
    machine.emu_start(0x4500ff, 0x450133, count=1000)
    assert machine.reg_read(UC_X86_REG_ESP) == STACK
    assert [event['kind'] for event in events] == ['camera', 'effects']
    rows.append(dict(delta=delta, events=list(events)))
(ROOT / 'recovery/output/effect-camera-order-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print('PASS: 4 original gfx camera-before-effect-manager update sequences')
