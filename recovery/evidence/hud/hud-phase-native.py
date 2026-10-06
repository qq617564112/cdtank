"""Execute original UI-root attachment toggles at the HUD/room shared entry."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
CONTROLLER, ROOT_WINDOW, PARENT, VTABLE, STACK, RETURN = [0x2001000 + index * 0x1000 for index in range(6)]
BOUNDARY = 0x2008000
imports = {0x5c024c: 'isChild', 0x5c0220: 'addChildWindow', 0x5c0228: 'removeChildWindow', 0x5c0394: 'system', 0x5c0070: 'setGUISheet'}
events, handlers = [], {}
present = False

def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

for index, (address, name) in enumerate(imports.items()):
    target = BOUNDARY + index * 0x10
    write(address, target)
    handlers[target] = name
handlers[BOUNDARY + 0x100] = 'onShow'
handlers[BOUNDARY + 0x110] = 'onHide'
write(VTABLE + 0x2c, BOUNDARY + 0x100, BOUNDARY + 0x110)
write(CONTROLLER, VTABLE)

def hook(machine, address, size, user):
    if address not in handlers:
        return
    name = handlers[address]
    stack = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    pop = 4 if name in ['isChild', 'addChildWindow', 'removeChildWindow', 'setGUISheet'] else 0
    argument = read(stack + 4) if pop else None
    events.append({'kind': name, 'this': hex(this), **({'window': hex(argument)} if argument is not None else {})})
    value = int(present) if name == 'isChild' else 0x2009000 if name == 'system' else 0
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, read(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

uc.hook_add(UC_HOOK_CODE, hook)
rows = []
for has_root, has_parent, present, showing in [(True, True, p, s) for p in [False, True] for s in [False, True]] + [(True, False, False, s) for s in [False, True]] + [(False, True, False, s) for s in [False, True]]:
    write(CONTROLLER + 8, ROOT_WINDOW if has_root else 0)
    write(0x893128, PARENT if has_parent else 0)
    uc.mem_write(CONTROLLER + 0xc, b'\x7f')
    write(STACK, RETURN, int(showing))
    uc.reg_write(UC_X86_REG_ECX, CONTROLLER)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    events.clear()
    uc.emu_start(0x4d6216, RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 8
    assert bytes(uc.mem_read(CONTROLLER + 0xc, 1)) == bytes([int(showing)])
    kinds = [event['kind'] for event in events]
    expected = []
    if has_root:
        if has_parent:
            expected = ['isChild'] + (['addChildWindow'] if showing and not present else ['removeChildWindow'] if not showing and present else [])
        elif showing:
            expected = ['system', 'setGUISheet']
        expected += ['onShow' if showing else 'onHide']
    assert kinds == expected, (kinds, expected)
    rows.append({'hasRoot': has_root, 'hasParent': has_parent, 'alreadyChild': present, 'show': showing, 'events': list(events), 'storedVisible': int(showing)})
result = {'status': 'PASS', 'entry': '0x4d6216', 'rows': rows, 'execution': 'Complete original entry; original controller/root fields and flag write execute. CEGUI isChild/add/remove/System/setGUISheet and virtual lifecycle callbacks are supplied boundaries.', 'phaseRule': {'status': 'BLOCKED', 'missing': 'Scene/phase dispatcher that supplies the GameMain and RoomPanel show booleans. The shared attachment entry has no WAITING/PLAYING/FINISHED discrimination.'}, 'bindings': {'gameMainRoot': 'controller+0x8 at 0x4c77a9', 'roomPanelRoot': 'controller+0x8 at 0x50a19f', 'informationPanel': 'controller+0x628 at 0x4c7b0b', 'informationText': 'controller+0x62c at 0x4c7b45'}, 'directCallSites': {'hud': '0x4d23f7', 'roomPanel': '0x50f5c5'}}
(ROOT / 'recovery/output/hud-phase-native.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: 8 original UI-root attachment toggles; phase dispatcher remains unproven')
