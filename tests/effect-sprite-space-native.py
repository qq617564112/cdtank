"""Execute original type1 acceleration/global rotation and orbit composition."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ESI, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EAX, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x20000)
FRAME, OBJECT, CONTROL, RESOURCE, MANAGER, STACK = 0x2009000, 0x2010000, 0x2012000, 0x2014000, 0x2018000, 0x2008000
rotation = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]
def write(address, values): machine.mem_write(address, struct.pack('<' + 'f' * len(values), *values))
def read(address, count): return list(struct.unpack('<' + 'f' * count, machine.mem_read(address, count * 4)))
def hook(uc, address, size, data):
    if address == 0x47b81b:
        stack = uc.reg_read(UC_X86_REG_ESP)
        uc.reg_write(UC_X86_REG_EAX, MANAGER)
        uc.reg_write(UC_X86_REG_EIP, struct.unpack('<I', uc.mem_read(stack, 4))[0])
        uc.reg_write(UC_X86_REG_ESP, stack + 4)
machine.hook_add(UC_HOOK_CODE, hook)
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
rows = []
for control in library['spriteControls']:
    for parent in [False, True]:
        for modelAligned in [False, True]:
            machine.mem_write(CONTROL, bytes(0x100))
            write(CONTROL + 4, [control['baseStart']])
            write(CONTROL + 0x40, control['motion']['acceleration'])
            write(CONTROL + 0x64, control['orbit']['axis'])
            write(CONTROL + 0x70, [control['orbit']['radius'], control['orbit']['angularRate']])
            machine.mem_write(OBJECT, bytes(0x100))
            machine.mem_write(OBJECT + 0x20, struct.pack('<I', int(parent)))
            machine.mem_write(RESOURCE + 0x2a4, bytes([modelAligned]))
            write(MANAGER + 0x68, rotation)
            initial = dict(position=[12.5, -3.75, 21], velocity=control['motion']['velocity'], orbitOffset=[1, 2, 3])
            write(FRAME + 0xc, initial['position'] + initial['orbitOffset'] + initial['velocity'])
            steps = []
            elapsed = control['baseStart']
            for delta in [0, .016, .1, .5, 1]:
                elapsed = struct.unpack('<f', struct.pack('<f', elapsed + delta))[0]
                write(OBJECT + 8, [elapsed])
                write(FRAME + 0x7c, [delta])
                machine.mem_write(FRAME + 0x70, struct.pack('<I', OBJECT))
                machine.mem_write(FRAME + 0x6c, struct.pack('<I', RESOURCE))
                for reg, value in [(UC_X86_REG_EBP, FRAME), (UC_X86_REG_EBX, CONTROL), (UC_X86_REG_ESI, OBJECT), (UC_X86_REG_ESP, STACK), (UC_X86_REG_FPCW, 0x27f)]: machine.reg_write(reg, value)
                machine.emu_start(0x482eba, 0x482fbb, count=100000)
                steps.append(dict(delta=delta, elapsed=elapsed, position=read(FRAME + 0xc, 3), orbitOffset=read(FRAME + 0x18, 3), velocity=read(FRAME + 0x24, 3)))
            rows.append(dict(control=control, parent=parent, modelAligned=modelAligned, globalRotation=rotation, initial=initial, steps=steps))
(ROOT / 'recovery/output/effect-sprite-space-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print(f'PASS: {len(rows)} source type1 spatial sequences / {len(rows)*5} ticks')
