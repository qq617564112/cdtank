"""Execute the original queued text record update without font/projection services."""
import json
import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

u, images = map_original_binaries([ROOT / 'CDTank' / 'CDTank.exe'])
u.mem_map(0x2000000, 0x10000)
RECORD, STACK, STOP = 0x2001000, 0x2005000, 0x2009000


def write_float(offset, value):
    u.mem_write(RECORD + offset, struct.pack('<f', value))


def read_float(offset):
    return struct.unpack('<f', u.mem_read(RECORD + offset, 4))[0]


def execute(elapsed, y, alpha, delta):
    u.mem_write(RECORD, bytes(0x48))
    for offset, value in [(4, y), (0x2c, alpha), (0x30, elapsed),
                          (0x3c, 0.5), (0x40, 1), (0x44, 40)]:
        write_float(offset, value)
    u.mem_write(STACK, struct.pack('<If', STOP, delta))
    u.reg_write(UC_X86_REG_ECX, RECORD)
    u.reg_write(UC_X86_REG_ESP, STACK)
    u.emu_start(0x46449f, STOP, count=100)
    assert u.reg_read(UC_X86_REG_EIP) == STOP
    assert u.reg_read(UC_X86_REG_ESP) == STACK + 8
    return dict(input=dict(elapsed=elapsed, y=y, alpha=alpha, delta=delta),
                elapsed=read_float(0x30), y=read_float(4), alpha=read_float(0x2c),
                remove=bool(u.reg_read(UC_X86_REG_EAX) & 0xff))


rows = [execute(*values) for values in [
    (0, 100, 1, 0), (0, 100, 1, 0.25), (0.25, 110, 1, 0.25),
    (0.5, 120, 1, 0), (0.5, 120, 1, 0.25), (0.75, 130, 0.5, 0.25),
    (0.75, 130, 0.5, 0.5), (0, 100, 1, 1), (0, 100, 1, 1.25),
]]
assert [(r['elapsed'], r['y'], r['alpha'], r['remove']) for r in rows] == [
    (0, 100, 1, False), (0.25, 110, 1, False), (0.5, 120, 1, False),
    (0.5, 120, 1, False), (0.75, 130, 0.5, False), (1, 140, 0, True),
    (1.25, 150, -0.5, True), (1, 140, 0, True), (1.25, 150, -0.5, True),
]
pe = images['cdtank.exe']
data, base = pe.get_memory_mapped_image(), pe.OPTIONAL_HEADER.ImageBase
disassembler = Cs(CS_ARCH_X86, CS_MODE_32)
ranges = [(0x46449f, 0x4644e4), (0x45c08b, 0x45c0ee),
          (0x45dbff, 0x45dcd9), (0x465196, 0x4654f2)]
instructions = {
    hex(start): [dict(address=hex(i.address), op=f'{i.mnemonic} {i.op_str}'.strip())
                 for i in disassembler.disasm(data[start-base:end-base], start)]
    for start, end in ranges
}
out = dict(status='PASS_RECORD_UPDATE_ONLY', entry='0x46449f', rows=rows,
           fields={'0x04': 'screen Y', '0x28': 'draw scale', '0x2c': 'draw alpha',
                   '0x30': 'elapsed', '0x3c': 'fade begins after 0.5',
                   '0x40': 'remove at elapsed >= 1', '0x44': 'screen Y rate 40'},
           queueUpdate='0x45dbff iterates Castle+0x1c8, sets scale, calls 0x46449f and erases on true',
           queueDraw='0x45c08b iterates Castle+0x1c8 and calls 0x465196',
           scope='Original record update executes with supplied selector1 fields and no hooks. Queue iteration, scale/projection, font draw and owner destruction are static evidence only. No ordinary battle or framebuffer output.',
           instructions=instructions)
(ROOT / 'recovery/output/castle-damage-text-update-native.json').write_text(
    json.dumps(out, indent=2) + '\n')
print('PASS: original text record fade after .5, Y rate40, removal at1; record update only')
