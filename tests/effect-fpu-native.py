"""Execute EXE CRT startup precision selection and inspect D3D creation flags."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

exe = ROOT / 'CDTank/CDTank.exe'
engine = ROOT / 'CDTank/gbengine.dll'
machine, images = map_original_binaries([exe, engine])
machine.mem_map(0x2000000, 0x20000)
STACK, STOP = 0x2008000, 0x201f000
rows = []
for initial in [0x37f, 0x27f, 0x7f]:
    machine.mem_write(STACK, struct.pack('<I', STOP))
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.reg_write(UC_X86_REG_FPCW, initial)
    machine.emu_start(0x581b99, STOP, count=1000)
    actual = machine.reg_read(UC_X86_REG_FPCW)
    assert actual & 0x300 == 0x200
    assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
    rows.append({'initial': initial, 'actual': actual})
pe = images['cdtank.exe']
assert pe.get_data(0x620998 - 0x400000, 4) == struct.pack('<I', 0x57a968)
assert pe.get_data(0x57e01f - 0x400000, 7) == bytes.fromhex('6a01e8a70a0000')
engine_pe = images['gbengine.dll']
# All engine CreateDevice vertex-processing options omit FPU_PRESERVE (0x2).
flags = [0x20, 0x80, 0x40, 0x50, 0]
for address, value in [(0x10022c4b, 0x20), (0x10022c79, 0x80), (0x10022c9d, 0x40)]:
    assert engine_pe.get_data(address - 0x10000000, 5) == b'\xbb' + struct.pack('<I', value)
assert engine_pe.get_data(0x10022cc5 - 0x10000000, 3) == bytes.fromhex('83e350')
assert engine_pe.get_data(0x10022cbc - 0x10000000, 2) == bytes.fromhex('33db')
for value in flags:
    assert value & 2 == 0
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
evidence = {}
for name, image, start, end in [('startupPrecision', pe, 0x581b99, 0x581bab),
                               ('deviceBehaviorFlags', engine_pe, 0x10022c25, 0x10022d11)]:
    base = image.OPTIONAL_HEADER.ImageBase
    evidence[name] = [{'va': hex(i.address), 'instruction': f'{i.mnemonic} {i.op_str}'}
                      for i in decoder.disasm(image.get_data(start - base, end - start), start)]
(ROOT / 'recovery/output/effect-fpu-native.json').write_text(json.dumps({
    'sources': {p.name: sha256(p.read_bytes()).hexdigest() for p in [exe, engine]},
    'startupRows': rows, 'deviceBehaviorFlags': flags,
    'startupPrecision': 53, 'devicePreservesFpu': False,
    'runtimePrecisionConfirmed': False, 'evidence': evidence}) + '\n')
print('PASS: original CRT startup selects x87 53-bit; D3D CreateDevice flags omit FPU_PRESERVE')
