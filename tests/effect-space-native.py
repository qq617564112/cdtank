"""Execute original gbengine space functions and supplied msvcr71 math."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
paths = [ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll']
machine, images = map_original_binaries(paths)
machine.mem_map(0, 4096)
machine.mem_map(0x2000000, 0x20000)
INPUT, MATRIX, OUTPUT, STACK, STOP = 0x2010000, 0x2011000, 0x2012000, 0x2008000, 0x201f000
library = json.loads((ROOT / 'recovery/output/web-assets/effect-library.json').read_text())
vectors = [control['orbit']['axis'] for control in library['spriteControls']]
vectors += [control['orbit']['axis'] for control in library['particleControls']]
vectors += [[0, 0, 0], [.005, 0, 0], [.005000001, 0, 0], [.003, .004, 0], [3, 4, 12]]
normalize_rows = []
for precision in [0x27f, 0x37f]:
    for vector in vectors:
        machine.mem_write(INPUT, struct.pack('<3f', *vector))
        machine.mem_write(STACK, struct.pack('<I', STOP))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, INPUT)
        machine.reg_write(UC_X86_REG_FPCW, precision)
        machine.emu_start(0x1002f460, STOP, count=10000)
        normalize_rows.append({'input': vector, 'precision': hex(precision),
                               'output': list(struct.unpack('<3f', machine.mem_read(INPUT, 12)))})
matrices = [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 23.5, -42.125, 16.75, 1],
            [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, -100, 20, 300, 1],
            [.75, .25, .5, 0, -.125, 2, .375, 0, 1.5, -.75, .625, 0, 8, 4, 2, 1]]
space_rows = []
positions = [control['motion']['position'] for control in library['spriteControls']]
positions += [control['motion']['velocity'] for control in library['particleControls']]
for precision in [0x27f, 0x37f]:
    for matrix in matrices:
        machine.mem_write(MATRIX, struct.pack('<16f', *matrix))
        for vector in positions:
            result = {'input': vector, 'matrix': matrix, 'precision': hex(precision)}
            for name, address in [('rotate', 0x1002fe00), ('transform', 0x1002f6b0)]:
                machine.mem_write(INPUT, struct.pack('<3f', *vector))
                machine.mem_write(STACK, struct.pack('<III', STOP, INPUT, OUTPUT))
                machine.reg_write(UC_X86_REG_ESP, STACK)
                machine.reg_write(UC_X86_REG_ECX, MATRIX)
                machine.reg_write(UC_X86_REG_FPCW, precision)
                machine.emu_start(address, STOP, count=10000)
                result[name] = list(struct.unpack('<3f', machine.mem_read(OUTPUT, 12)))
            machine.mem_write(INPUT, struct.pack('<3f', *vector))
            machine.mem_write(STACK, struct.pack('<II', STOP, INPUT))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, MATRIX)
            machine.emu_start(0x1002fe60, STOP, count=10000)
            assert list(struct.unpack('<3f', machine.mem_read(INPUT, 12))) == result['rotate']
            space_rows.append(result)
(ROOT / 'recovery/output/effect-space-native.json').write_text(json.dumps({
    'sources': {path.name: sha256(path.read_bytes()).hexdigest() for path in paths},
    'normalize': normalize_rows, 'space': space_rows}) + '\n')
print(f'PASS: {len(normalize_rows)} original DLL/CRT normalize and {len(space_rows)} Rotate/RotateIn/Transform cases')
