"""Execute the original water update with recorded texture/geometry endpoints."""
import json
from pathlib import Path
import struct
import sys
import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x10000)
OBJ, WATER, WAVES, VT, UPDATE, REPLACE, CLOCK, STACK, STOP = [0x2000000 + 0x1000*i for i in range(9)]
events = []
now = 0


def put(a, *v):
    uc.mem_write(a, struct.pack('<' + 'I'*len(v), *v))


def get(a):
    return struct.unpack('<I', uc.mem_read(a, 4))[0]


def finish(pop=0):
    s = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EIP, get(s))
    uc.reg_write(UC_X86_REG_ESP, s + 4 + pop)


def hook(machine, address, size, data):
    s = machine.reg_read(UC_X86_REG_ESP)
    c = machine.reg_read(UC_X86_REG_ECX)
    if address == UPDATE:
        events.append(dict(kind='update', node=c))
        finish()
    elif address == REPLACE:
        events.append(dict(kind='replace', node=c, texture=get(s+4)))
        finish(4)
    elif address == CLOCK:
        uc.mem_write(get(s+4), struct.pack('<Q', now))
        machine.reg_write(UC_X86_REG_EAX, 1)
        finish(4)


for address in [UPDATE, REPLACE, CLOCK]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x5c09b8, REPLACE)
put(0x5c05dc, CLOCK)
put(WATER, VT)
put(WAVES, VT)
put(VT+0x14, UPDATE)
put(OBJ+0x80, WATER, WAVES)
uc.mem_write(OBJ+0x88, b'\1')
for i in range(32):
    put(OBJ+4*i, 0x200a000+4*i)
put(OBJ+0x90, 0)
uc.mem_write(OBJ+0x98, struct.pack('<Q', 0))
uc.mem_write(OBJ+0xa4, struct.pack('<f', 1))
uc.mem_write(0x8d3fe8, struct.pack('<f', .001))
rows = []
for now, delta in [(49, .049), (50, .001), (51, .001), (102, .051), (1702, 1.6)]:
    before = len(events)
    put(STACK, STOP, struct.unpack('<I', struct.pack('<f', delta))[0])
    uc.reg_write(UC_X86_REG_ECX, OBJ)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(0x462d14, STOP, count=10000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK+8
    rows.append(dict(nowMs=now, delta=delta, index=get(OBJ+0x90),
                     waterOffset=struct.unpack('<f', uc.mem_read(OBJ+0x8c, 4))[0],
                     events=events[before:]))
assert [row['index'] for row in rows] == [0, 1, 1, 2, 3]
assert all(len([e for e in r['events'] if e['kind'] == 'update']) == 2 for r in rows)
pe = images['cdtank.exe']
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
ranges = [(0x462f24, 0x4631bb), (0x462d14, 0x462dc6), (0x462dc6, 0x462e3f),
          (0x4596c0, 0x4596d8), (0x459750, 0x45975c), (0x45a8c2, 0x45a8db)]
sources = [dict(start=hex(a), end=hex(b), instructions=[
    dict(address=hex(i.address), instruction=f'{i.mnemonic} {i.op_str}')
    for i in decoder.disasm(pe.get_data(a-0x400000, b-a), a)]) for a, b in ranges]
result = dict(status='PASS_UPDATE_NATIVE', rows=rows, sources=sources,
              scope='Original462d14 and original timer574e1e/574dfe execute; performance counter, geometry update and ReplaceTexture are recording boundaries. Loader/render sources are static instructions, not full loader or GPU execution.')
(ROOT / 'recovery/output/scene-water02-native.json').write_text(json.dumps(result, indent=2)+'\n')
print('PASS_UPDATE_NATIVE: strict timer threshold; one texture step per update; source water phase')
