"""Execute complete original reset with attached model, zero orbit and no path."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import pefile
from unicorn import Uc, UC_ARCH_X86, UC_MODE_32
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
exe = ROOT / 'CDTank/CDTank.exe'
pe = pefile.PE(str(exe))
machine = Uc(UC_ARCH_X86, UC_MODE_32)
machine.mem_map(0x400000, (pe.OPTIONAL_HEADER.SizeOfImage + 4095) & ~4095)
machine.mem_write(0x400000, pe.get_memory_mapped_image())
machine.mem_map(0x2000000, 0x20000)
OBJECT, DEFINITION, RESOURCE, CONTROL, CONTROLS, TABLE, STATE, STACK, STOP = (
    0x2010000, 0x2010200, 0x2010400, 0x2010800, 0x2010a00,
    0x2010b00, 0x2010c00, 0x2008000, 0x201f000)
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
rows = []
origin = [23.5, -42.125, 16.75]
state = {'position': [-25, 12, 88], 'orbitOffset': [8, 4, 2],
         'velocity': [37, -21, 15], 'angles': [12, -44, 91],
         'scale': [8, 13, 19], 'color': [.25, .375, .625, .75], 'frame': 7}
raw_state = struct.pack('<19fI', *state['position'], *state['orbitOffset'], *state['velocity'],
                        *state['angles'], *state['scale'], *state['color'], state['frame'])
for precision in [0x27f, 0x37f]:
    for control in library['spriteControls']:
        for flag in [0, 1]:
            machine.mem_write(OBJECT, bytes(0x200))
            machine.mem_write(DEFINITION, bytes(0x200))
            machine.mem_write(RESOURCE, bytes(0x2a8))
            machine.mem_write(CONTROL, bytes(0xb0))
            machine.mem_write(OBJECT + 0xc, struct.pack('<I', DEFINITION))
            machine.mem_write(OBJECT + 0x14, struct.pack('<3f', *origin))
            machine.mem_write(OBJECT + 0x20, struct.pack('<I', 1))
            machine.mem_write(DEFINITION + 0x150, struct.pack('<I', RESOURCE))
            machine.mem_write(DEFINITION + 0x160, struct.pack('<I', CONTROLS))
            machine.mem_write(CONTROLS, struct.pack('<I', CONTROL))
            machine.mem_write(OBJECT + 0x68, struct.pack('<4I', TABLE, 1, 0, 1))
            machine.mem_write(TABLE, struct.pack('<I', STATE))
            machine.mem_write(STATE, raw_state)
            machine.mem_write(CONTROL + 0xc, bytes([flag]))
            for offset, values in [(0x28, control['motion']['position']),
                                   (0x34, control['motion']['velocity']),
                                   (0x4c, control['appearance']['angles']),
                                   (0x10, control['appearance']['scale']),
                                   (0x78, control['appearance']['color'])]:
                machine.mem_write(CONTROL + offset, struct.pack('<' + 'f' * len(values), *values))
            machine.mem_write(STACK, struct.pack('<I', STOP))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, OBJECT)
            machine.reg_write(UC_X86_REG_FPCW, precision)
            machine.emu_start(0x481fc0, STOP, count=10000)
            result = bytes(machine.mem_read(STATE, 80))
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
            values = struct.unpack('<19fI', result)
            rows.append({'node': control['node'], 'modifier': control['modifier'],
                         'precision': hex(precision), 'flag': flag, 'origin': origin,
                         'state': state, 'position': control['motion']['position'],
                         'velocity': control['motion']['velocity'],
                         'appearance': control['appearance'],
                         'result': {'position': list(values[0:3]), 'orbitOffset': list(values[3:6]),
                                    'velocity': list(values[6:9]), 'angles': list(values[9:12]),
                                    'scale': list(values[12:15]), 'color': list(values[15:19]),
                                    'frame': values[19]}})
(ROOT / 'recovery/output/effect-reset-native.json').write_text(json.dumps({
    'exeSha256': sha256(exe.read_bytes()).hexdigest(), 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} complete native controller reset cases')
