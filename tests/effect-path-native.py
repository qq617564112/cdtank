"""Execute original 3DS vertex-axis conversion and complete source path sampler."""
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_FPCW
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
machine, _ = map_original_binaries([ROOT / 'CDTank' / name for name in ['CDTank.exe', 'gbengine.dll', 'msvcr71.dll']])
machine.mem_map(0x2000000, 0x40000)
PATH, RESOURCE, MODEL, VERTICES, OUTPUT, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2018000, 0x2008000, 0x203f000)
tracks = json.loads((ROOT / 'recovery/output/web-assets/effect-path-tracks.json').read_text())
rows = []
for row in tracks['rows'] + tracks.get('spriteRows', []):
    assert len(row['tracks']) == 1
    vertices = row['tracks'][0]['vertices']
    machine.mem_write(MODEL, bytes(0x200))
    machine.mem_write(MODEL, struct.pack('<I', len(vertices)))
    machine.mem_write(MODEL + 0x110, struct.pack('<I', VERTICES))
    # Test original source vertex conversion 0x483bc4–0x483bef independently.
    raw = [[x, -z, y] for x, y, z in vertices]
    machine.mem_write(VERTICES, b''.join(struct.pack('<3f', *v) for v in raw))
    from unicorn.x86_const import UC_X86_REG_ESI, UC_X86_REG_EDX
    machine.reg_write(UC_X86_REG_ESI, MODEL)
    machine.reg_write(UC_X86_REG_EDX, 0)
    machine.emu_start(0x483bc4, 0x483bef, count=100000)
    converted = [list(struct.unpack('<3f', machine.mem_read(VERTICES + i * 12, 12))) for i in range(len(vertices))]
    assert converted == vertices
    machine.mem_write(RESOURCE + 0x30, struct.pack('<I', MODEL))
    machine.mem_write(VERTICES + len(vertices) * 12, struct.pack("<3f", 0, 0, 0))
    for rate in [0, row["rate"], 73.5]:
        machine.mem_write(PATH, struct.pack('<IIIf', 0, RESOURCE, row['mode'], rate) + bytes(4))
        steps = []
        for delta in [0, .016, .016, .1, .5, 1, 5, .01, 0]:
            machine.mem_write(STACK, struct.pack('<IIf', STOP, OUTPUT, delta))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, PATH)
            machine.reg_write(UC_X86_REG_FPCW, 0x27f)
            machine.emu_start(0x475f56, STOP, count=100000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 12
            frame = struct.unpack('<I', machine.mem_read(PATH, 4))[0]
            remainder = struct.unpack('<f', machine.mem_read(PATH + 0x10, 4))[0]
            position = list(struct.unpack('<3f', machine.mem_read(OUTPUT, 12)))
            steps.append(dict(delta=delta, frame=frame, remainder=remainder, position=position))
        rows.append(dict(node=row['node'], vertices=vertices, mode=row['mode'], sentinel=[0, 0, 0], rate=rate, steps=steps))
(ROOT / 'recovery/output/effect-path-native.json').write_text(json.dumps(dict(rows=rows)) + '\n')
print(f'PASS: {len(rows)} original source path sequences and 3DS vertex conversion')
