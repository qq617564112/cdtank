"""Compare the recovered MV3 decoder with execution of the original DLL."""
import json
from pathlib import Path
import struct
import sys

import capstone
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from mv3 import read_mv3
from mv3_normals import decode_packed_normal, decode_frame_normals

ASSETS = ROOT / 'recovery/output/verified/assets'
OUTPUT = ROOT / 'recovery/output/mv3-normals-sol-native.json'
machine, images = map_original_binaries([ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
machine.mem_map(0x2000000, 0x10000)
STACK, VECTOR, STOP = 0x2008000, 0x2001000, 0x200f000
values = {}
file_count = frame_count = vertex_count = 0
for path in sorted(ASSETS.rglob('*')):
    if path.suffix.lower() != '.mv3':
        continue
    model = read_mv3(path)
    file_count += 1
    for mesh in model['meshes']:
        decoded = decode_frame_normals(mesh)
        for frame_index, frame in enumerate(mesh['frames']):
            frame_count += 1
            vertex_count += len(frame['vertices'])
            for index, vertex in enumerate(frame['vertices']):
                packed = vertex[3]
                if packed not in values:
                    values[packed] = dict(asset=str(path.relative_to(ASSETS)), mesh=mesh['name'],
                                          frame=frame_index, vertex=index,
                                          decoded=decoded[frame_index][index])

rows = []
maximum_error = 0
for packed, source in sorted(values.items()):
    machine.mem_write(STACK, struct.pack('<III', STOP, VECTOR, packed))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_FPCW, 0x37f)
    machine.emu_start(0x1000bed0, STOP, count=20000)
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
    native = struct.unpack('<3f', machine.mem_read(VECTOR, 12))
    expected = decode_packed_normal(packed)
    error = max(abs(a - b) for a, b in zip(native, expected))
    maximum_error = max(maximum_error, error)
    assert error <= 3e-7, (packed, native, expected, source)
    rows.append(dict(packed=packed, native=native, source=source))

pe = images['gbengine.dll']
data = pe.get_memory_mapped_image()
disassembler = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
source = [f'{i.address:08x} {i.mnemonic} {i.op_str}'
          for i in disassembler.disasm(data[0xbed0:0xbf70], 0x1000bed0)]
OUTPUT.write_text(json.dumps(dict(decoder='gbengine.dll:0x1000bed0',
    precision=0x37f, files=file_count, frames=frame_count, vertices=vertex_count,
    uniquePackedNormals=len(values), maximumAbsoluteError=maximum_error,
    disassembly=source, rows=rows), ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {file_count} MV3 files, {frame_count} frames, {vertex_count} vertices, '
      f'{len(values)} original decoder comparisons; max error {maximum_error}')
