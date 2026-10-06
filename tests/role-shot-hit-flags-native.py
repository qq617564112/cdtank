"""Execute remaining hit notification flag branches and monitor HP writes."""
import json
import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE, UC_HOOK_MEM_WRITE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
OWNER, SOURCE, TARGET, SOURCE_RECORD, TARGET_RECORD, PACKET, STREAM, BUFFER, ACTOR = [
    0x2001000 + index * 0x1000 for index in range(9)]
STACK, STOP, ALLOCATOR = 0x2010000, 0x2011000, 0x2012000
trace, record_writes = [], []


def write(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *[v & 0xffffffff for v in values]))


def read(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x4138e8:
        assert read(stack + 4) == 0x30
        finish(PACKET, 4)
    elif address == 0x48a226:
        assert machine.reg_read(UC_X86_REG_ECX) == OWNER
        identity = read(stack + 4)
        assert identity in (77, 88)
        finish(SOURCE if identity == 77 else TARGET, 4)
    elif address == 0x465057:
        assert machine.reg_read(UC_X86_REG_ECX) == ACTOR
        finish()
    elif address == 0x57c0d6:
        destination, capacity, pattern = [read(stack + offset) for offset in (4, 8, 12)]
        value = struct.unpack('<i', machine.mem_read(stack + 16, 4))[0]
        text_format = bytes(machine.mem_read(pattern, 8)).split(b'\0')[0].decode('ascii')
        assert capacity == 32 and text_format in ('%d', '+%d')
        text = text_format % value
        machine.mem_write(destination, text.encode() + b'\0')
        finish(len(text))
    elif address == 0x466d09:
        assert machine.reg_read(UC_X86_REG_ECX) == ACTOR
        text = bytes(machine.mem_read(read(stack + 4), 32)).split(b'\0')[0].decode()
        trace.append({'text': text, 'selector': read(stack + 8)})
        finish(pop=8)


def watch(machine, access, address, size, value, data):
    if any(address < record + 0x140 and address + size > record
           for record in (SOURCE_RECORD, TARGET_RECORD)):
        record_writes.append({'pc': hex(machine.reg_read(UC_X86_REG_EIP)),
                              'address': hex(address), 'size': size, 'value': value})


for address in (0x4138e8, 0x48a226, 0x465057, 0x57c0d6, 0x466d09):
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)
uc.hook_add(UC_HOOK_MEM_WRITE, watch)


def call(address, this, *args):
    write(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ECX, this)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=100000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4
    return uc.reg_read(UC_X86_REG_EAX)


VISUAL_EFFECT, ACTOR_VTABLE = 0x2013000, 0x2014000
visuals = []
dirty = []
def dirty_notice(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == TARGET_RECORD
    assert read(stack + 4) == 33
    dirty.append(33)
    finish(pop=4)
uc.hook_add(UC_HOOK_CODE, dirty_notice, begin=0x521e8a, end=0x521e8a)
def visual_effect(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == ACTOR
    args = [read(stack + n) for n in (4, 8, 12, 16)]
    assert args == [101, 3, 0, 1]
    visuals.append(args)
    finish(pop=16)
uc.hook_add(UC_HOOK_CODE, visual_effect, begin=VISUAL_EFFECT, end=VISUAL_EFFECT)
write(ACTOR, ACTOR_VTABLE)
write(ACTOR_VTABLE + 0xa8, VISUAL_EFFECT)
write(SOURCE, 0x5c2c28)
write(TARGET, 0x5c2c28)
write(SOURCE + 0x2a0, SOURCE_RECORD)
write(TARGET + 0x2a0, TARGET_RECORD)
write(TARGET + 0x310, ACTOR)
write(OWNER + 0x3c, TARGET)
rows = []
for other_visual, stun in ((True, False), (False, True), (True, True)):
    uc.mem_write(SOURCE_RECORD, bytes(0x400))
    uc.mem_write(TARGET_RECORD, bytes(0x400))
    write(SOURCE_RECORD, 0x5d87a8)
    write(TARGET_RECORD, 0x5d87a8)
    write(SOURCE_RECORD + 0x54, 700)
    write(TARGET_RECORD + 0x54, 655)
    uc.mem_write(PACKET, bytes(0x30))
    write(PACKET + 0xc, 77, 88)
    uc.mem_write(PACKET + 0x14, bytes([1, int(other_visual)]))
    uc.mem_write(PACKET + 0x1c, bytes([int(stun)]))
    write(PACKET + 0x20, 43)
    trace.clear()
    record_writes.clear()
    visuals.clear()
    dirty.clear()
    try:
        call(0x424614, OWNER, PACKET, 0, 0)
    except Exception:
        print("failedFlags", other_visual, stun, "pc", hex(uc.reg_read(UC_X86_REG_EIP)), "sp", hex(uc.reg_read(UC_X86_REG_ESP)), "writes", record_writes)
        raise
    assert trace == [{'text': '-43', 'selector': 2}]
    assert dirty == ([33] if stun else [])
    assert visuals == ([[101, 3, 0, 1]] if other_visual else [])
    assert uc.mem_read(TARGET_RECORD + 0x124, 1)[0] == int(stun)
    assert [read(SOURCE_RECORD + 0x54), read(TARGET_RECORD + 0x54)] == [700, 655]
    assert not any(w['address'] in (hex(SOURCE_RECORD + 0x54), hex(TARGET_RECORD + 0x54)) for w in record_writes)
    rows.append({'flag15': other_visual, 'flag1c': stun, 'visualCalls': list(visuals),
                 'flag8Counter': uc.mem_read(TARGET_RECORD + 0x124, 1)[0],
                 'hp': [700, 655], 'recordWrites': list(record_writes), 'numericText': list(trace), 'dirtyNotifications': list(dirty)})
result = {'status': 'PASS_ORIGINAL_HIT_FLAG_VISUAL_STUN_BRANCHES_NO_HP_WRITE',
          'rows': rows,
          'scope': 'Complete424614 with original42294e/431dbf flag write and dirty dispatch. '
                   'Role lookup, visual housekeeping, effect101 terminal, dirty notification sink, CRT formatting and enqueue supplied. '
                   'Ammo-trigger8 branch not exercised. No server damage formula or critical probability claim.'}
(ROOT / 'recovery/output/role-shot-hit-flags-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: original flag15 visual and flag1c stun branches preserve HP')
