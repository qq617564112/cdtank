"""Capture original collision footprint sampling with original prediction/math."""
from pathlib import Path
import json
import math
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_EBP, UC_X86_REG_EAX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x80000)
STACK, STOP, MAP, CODE = 0x2004000, 0x2005000, 0x2006000, 0x2007000
CELLS, WIDTH = 0x2020000, 100
queries, trial = [], {}
def word(a): return struct.unpack('<I', uc.mem_read(a, 4))[0]
def vec(a): return list(struct.unpack('<3f', uc.mem_read(a, 12)))
def observe(machine, address, size, data):
    if address == 0x434f3b:
        base = uc.reg_read(UC_X86_REG_EBP)
        trial.update(position=vec(base + 0x14), forward=vec(base + 0x2c))
    elif address == 0x4340c5:
        stack = uc.reg_read(UC_X86_REG_ESP)
        assert word(stack + 4) == MAP and word(stack + 8) == 0
        point = vec(word(stack + 12))
        x, z = [math.trunc(point[i] * struct.unpack('<f', struct.pack('<f', 1 / 12))[0]) for i in [0, 2]]
        inside = 0 <= x < WIDTH and 0 <= z < WIDTH
        valid = inside and uc.mem_read(CELLS + (z * WIDTH + x) * 8 + 4, 1)[0] > 1
        queries.append(dict(point=point, index=[x, z], valid=valid))
for a in [0x434f3b, 0x4340c5]: uc.hook_add(UC_HOOK_CODE, observe, begin=a, end=a)
uc.mem_write(MAP, struct.pack('<I', 1) + bytes(0xa4))
uc.mem_write(MAP + 4 + 0x98, struct.pack('<3I', WIDTH, WIDTH, CELLS))
rows = []
for heading in [0, .7, -1.1, math.pi]:
    for footprint in [(48, 48), (49, 52), (72, 84)]:
        for command in range(9):
            for pattern in ['clear', 'blocked', 'stripe-x', 'stripe-z']:
                cells = bytearray(WIDTH * WIDTH * 8)
                for z in range(WIDTH):
                    for x in range(WIDTH):
                        valid = pattern == 'clear' or (pattern == 'stripe-x' and x % 3 != 0) or (pattern == 'stripe-z' and z % 3 != 0)
                        cells[(z * WIDTH + x) * 8 + 4] = 2 if valid else 0
                uc.mem_write(CELLS, bytes(cells))
                position = [200, 0, 200]
                direction = [math.sin(heading), 0, math.cos(heading)]
                matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 200, 0, 200, 1, footprint[0], 24, footprint[1]]
                uc.mem_write(CODE, struct.pack('<I', 0xdeadbeef))
                arguments = struct.pack('<3I', CODE, MAP, command) + struct.pack('<9fI', *position, *direction, *direction, 1) + struct.pack('<22f', *matrix, 30, .5, .05)
                assert len(arguments) == 140
                uc.mem_write(STACK, struct.pack('<I', STOP) + arguments)
                queries.clear(); trial.clear()
                for r,v in [(UC_X86_REG_ESP,STACK),(UC_X86_REG_FPCW,0x27f),(UC_X86_REG_FPSW,0),(UC_X86_REG_FPTAG,0xffff)]: uc.reg_write(r,v)
                uc.emu_start(0x434cee, STOP, count=100000)
                assert uc.reg_read(UC_X86_REG_EIP) == STOP and uc.reg_read(UC_X86_REG_ESP) == STACK + 4
                result = bool(uc.reg_read(UC_X86_REG_EAX) & 255)
                assert result == all(q['valid'] for q in queries)
                rows.append(dict(heading=heading, dimensions=list(footprint), command=command, pattern=pattern,
                    predicted=trial.copy(), queries=list(queries), accepted=result, code=None if result else word(CODE)))
assert len(rows) == 432
(ROOT / 'recovery/output/movement-sampling-native.json').write_text(json.dumps(dict(status='PASS', rows=rows,
    scope='Complete434cee prediction/sampling/rotation/coordinate/predicate. Synthetic100x100 NAV supplied; '
        'record/type/dimensions supplied. Four headings, three footprints, commands0..8, four static patterns. '
        'Trial pose captured after native prediction and normalization; no mathematical/service replacement.'), indent=2) + '\n')
print('PASS: 432 complete original collision sampling paths; trial poses, points, cells, acceptance and failure codes')
