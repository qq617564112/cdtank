"""Execute original three/four-part primary tag world composition instructions."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import (UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_ESI,
                               UC_X86_REG_EBP, UC_X86_REG_FPCW)

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

paths = [ROOT / 'CDTank/CDTank.exe', ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll']
machine, _ = map_original_binaries(paths)
machine.mem_map(0x2000000, 0x40000)
OBJECT, FRAME, STACK, STOP = 0x2010000, 0x2020000, 0x2008000, 0x203f000
poses = [{'position': [0, 0, 0], 'yaw': 0, 'turretYaw': 0, 'pivot': [0, 0]},
         {'position': [103.5, -20.25, 901], 'yaw': 90, 'turretYaw': -30, 'pivot': [3.25, -7.5]},
         {'position': [-713, 1, 205.125], 'yaw': -37.5, 'turretYaw': 123, 'pivot': [-11.5, 4.25]}]
source = json.loads((ROOT / 'recovery/output/effect-tag-tracks-native.json').read_text())
rows = []
correction_quaternion = None
for track in source['rows']:
    available = [s for s in track['steps'] if s['precision'] == 0x27f]
    samples = [available[0], available[len(available) // 2], available[-1]]
    for sample in samples:
        for pose in poses:
            for variant in ['threePart', 'fourPartBody', 'fourPartAttack']:
                machine.mem_write(OBJECT, bytes(0x400))
                machine.mem_write(OBJECT + 0x28, struct.pack('<3f', *pose['position']))
                machine.mem_write(OBJECT + 0xbc, struct.pack('<f', pose['yaw']))
                machine.mem_write(OBJECT + 0x34c, struct.pack('<f', pose['turretYaw']))
                machine.mem_write(OBJECT + 0x368, struct.pack('<3f', pose['pivot'][0], 0, pose['pivot'][1]))
                machine.reg_write(UC_X86_REG_EBP, FRAME)
                machine.reg_write(UC_X86_REG_ESI, OBJECT)
                machine.reg_write(UC_X86_REG_FPCW, 0x27f)
                machine.reg_write(UC_X86_REG_ESP, STACK)
                # Original quaternion setup: +Z axis / 180 degrees at frame-0x38.
                machine.emu_start(0x46a724, 0x46a75e, count=10000)
                quaternion = bytes(machine.mem_read(FRAME - 0x38, 16))
                correction_quaternion = list(struct.unpack('<4f', quaternion))
                four = variant != 'threePart'
                matrix = FRAME - (0x74 if four else 0x78)
                machine.mem_write(matrix, struct.pack('<16f', *sample['matrix']))
                machine.mem_write(FRAME - 0x10, struct.pack('<I', 6 if variant == 'fourPartAttack' else 0))
                machine.reg_write(UC_X86_REG_ESP, STACK)
                machine.emu_start(0x46dd1d if four else 0x46a7a4,
                                  0x46ddcf if four else 0x46a811, count=20000)
                # Actual helper used immediately after lookup; matrix list storage is external.
                machine.mem_write(0x2018000, quaternion)
                machine.mem_write(STACK, struct.pack('<II', STOP, 0x2018000))
                machine.reg_write(UC_X86_REG_ESP, STACK)
                machine.reg_write(UC_X86_REG_ECX, matrix)
                machine.emu_start(0x100321e0, STOP, count=10000)
                output = list(struct.unpack('<16f', machine.mem_read(matrix, 64)))
                rows.append({'path': track['track']['path'], 'tag': track['track']['name'],
                             'time': sample['time'], 'local': sample['matrix'],
                             'variant': variant, 'pose': pose, 'matrix': output})
(ROOT / 'recovery/output/effect-tag-world-native.json').write_text(json.dumps({
    'sources': {p.name: sha256(p.read_bytes()).hexdigest() for p in paths},
    'correctionQuaternion': correction_quaternion, 'rows': rows}) + '\n')
print(f'PASS: {len(rows)} original primary tag world/attack compositions')
