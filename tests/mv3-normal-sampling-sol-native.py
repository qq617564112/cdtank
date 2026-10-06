"""Execute the original MV3 renderer through its CPU vertex sampling boundary."""
import json
import math
from pathlib import Path
import struct
import sys

import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from mv3 import read_mv3

machine, images = map_original_binaries([ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll'])
machine.mem_map(0, 0x1000)
machine.mem_map(0x2000000, 0x400000)
machine.mem_map(0x2400000, 0x800000)
STACK, MESH, PART, UV, TRACK, MATERIAL = 0x2008000, 0x2010000, 0x2011000, 0x2012000, 0x2014000, 0x2015000
FACES, OUTPUT, TABLE, STOP = 0x2060000, 0x2080000, 0x2200000, 0x201f000

def write_u32(address, *values):
    machine.mem_write(address, struct.pack('<' + 'I' * len(values), *values))

def skip_external(machine, address, size, data):
    if address in (0x10037140, 0x1001b6f0):
        esp = machine.reg_read(UC_X86_REG_ESP)
        target = struct.unpack('<I', machine.mem_read(esp, 4))[0]
        machine.reg_write(UC_X86_REG_ESP, esp + 4)
        machine.reg_write(UC_X86_REG_EIP, target)

machine.hook_add(UC_HOOK_CODE, skip_external)
write_u32(0x10053390, TABLE)
write_u32(0x1005339c, OUTPUT, OUTPUT + 0x20000)
write_u32(0x100533a8, 1)
fixtures = ['role/001/01M.MV3', 'role/001/04X.MV3', 'Pet/001/n1.MV3']
rows = []
for relative in fixtures:
    model = read_mv3(ROOT / 'recovery/output/verified/assets/data/Data' / relative)
    selected = None
    for mesh_index, mesh in enumerate(model['meshes']):
        for part_index, part in enumerate(mesh['parts']):
            for frame_index in range(len(mesh['frames']) - 2):
                a, b = mesh['frames'][frame_index:frame_index + 2]
                if b['time'] - a['time'] < 2:
                    continue
                if any(a['vertices'][i][3] != b['vertices'][i][3] for face in part['faces'] for i in face[:3]):
                    selected = mesh_index, part_index, frame_index
                    break
            if selected:
                break
        if selected:
            break
    assert selected, relative
    mesh_index, part_index, frame_index = selected
    mesh = model['meshes'][mesh_index]
    part = mesh['parts'][part_index]
    a, b = mesh['frames'][frame_index:frame_index + 2]
    normals = {}
    for packed in {v[3] for f in mesh['frames'] for v in f['vertices']}:
        machine.mem_write(STACK, struct.pack('<III', STOP, OUTPUT, packed))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_FPCW, 0x37f)
        machine.emu_start(0x1000bed0, STOP, count=20000)
        raw = bytes(machine.mem_read(OUTPUT, 12))
        machine.mem_write(TABLE + packed * 12, raw)
        normals[packed] = struct.unpack('<3f', raw)
    machine.mem_write(MESH, bytes(0x80))
    machine.mem_write(PART, bytes(0x14))
    assert len(mesh['frames']) * 8 < MATERIAL - TRACK
    write_u32(MESH + 0x48, len(mesh['frames']))
    write_u32(MESH + 0x68, PART)
    write_u32(MESH + 0x6c, TRACK)
    write_u32(MESH + 0x70, UV)
    address = 0x2400000
    for index, frame in enumerate(mesh['frames']):
        write_u32(TRACK + index * 8, frame['time'], address)
        raw = b''.join(struct.pack('<3hH', *v) for v in frame['vertices'])
        machine.mem_write(address, raw)
        address += len(raw)
    write_u32(PART, part['material'], len(part['faces']), 0, FACES, 0)
    machine.mem_write(FACES, b''.join(struct.pack('<6H', *f) for f in part['faces']))
    machine.mem_write(UV, struct.pack('<' + 'f' * len(mesh['uv']), *mesh['uv']))
    samples = []
    for time in (a['time'], a['time'] + (b['time'] - a['time']) // 2, b['time']):
        machine.mem_write(OUTPUT, bytes(len(part['faces']) * 96))
        write_u32(STACK, STOP, 0, MATERIAL, time, MATERIAL)
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, MESH)
        machine.reg_write(UC_X86_REG_FPCW, 0x37f)
        machine.emu_start(0x1000e160, 0x1000e741, count=2000000)
        alpha = (time - a['time']) / (b['time'] - a['time'])
        maximum_error = 0
        minimum_length = 1
        vertices = []
        for corner, index in enumerate(i for face in part['faces'] for i in face[:3]):
            actual = struct.unpack('<3f', machine.mem_read(OUTPUT + corner * 32 + 12, 12))
            n0, n1 = normals[a['vertices'][index][3]], normals[b['vertices'][index][3]]
            expected = [(1 - alpha) * x + alpha * y for x, y in zip(n0, n1)]
            error = max(abs(x - y) for x, y in zip(actual, expected))
            assert error < 2e-7, (relative, time, index, actual, expected)
            maximum_error = max(maximum_error, error)
            length = math.sqrt(sum(x*x for x in actual))
            minimum_length = min(minimum_length, length)
            vertices.append(dict(sourceVertex=index, normal=actual, length=length,
                                 firstPacked=a['vertices'][index][3], secondPacked=b['vertices'][index][3]))
        samples.append(dict(time=time, alpha=alpha, maximumAbsoluteError=maximum_error,
                            minimumLength=minimum_length, vertices=vertices))
    rows.append(dict(asset=relative, mesh=mesh_index, part=part_index, firstFrame=frame_index,
                     firstTime=a['time'], secondTime=b['time'], samples=samples))

disassembler = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
image = images['gbengine.dll'].get_memory_mapped_image()
source = [f'{i.address:08x} {i.mnemonic} {i.op_str}'
          for i in disassembler.disasm(image[0xe160:0xe7c0], 0x1000e160)]
caller = [f'{i.address:08x} {i.mnemonic} {i.op_str}'
          for i in disassembler.disasm(image[0xe7d0:0xe8d0], 0x1000e7d0)]
output = dict(entry='gbengine.dll:0x1000e160', stop='0x1000e741 CPU buffer submission boundary',
              interceptedCalls=['0x10037140 profiling', '0x1001b6f0 material state'],
              disassembly=source, callerDisassembly=caller, rows=rows)
(ROOT / 'recovery/output/mv3-normal-sampling-sol-native.json').write_text(json.dumps(output, indent=2) + '\n')
print('PASS: original renderer CPU normal samples:', [(r['asset'],
       [s['minimumLength'] for s in r['samples']]) for r in rows])
