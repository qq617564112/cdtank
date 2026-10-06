"""Execute local-source/local-target shot notifications with active hurt actions."""
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


ACTION = 0x2013000
ACTOR_VTABLE = 0x2014000
actions = []
def hurt_action(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    assert machine.reg_read(UC_X86_REG_ECX) == ACTOR
    actions.append(read(stack + 4))
    finish(pop=4)
uc.hook_add(UC_HOOK_CODE, hurt_action, begin=ACTION, end=ACTION)
write(ACTOR, ACTOR_VTABLE)
write(ACTOR_VTABLE + 0x88, ACTION)
write(SOURCE, 0x5c2c28)
write(TARGET, 0x5c2c28)
write(SOURCE + 0x2a0, SOURCE_RECORD)
write(TARGET + 0x2a0, TARGET_RECORD)
write(TARGET + 0x310, ACTOR)
write(TARGET_RECORD + 0x90, 2)
write(TARGET_RECORD + 0x54, 655)
write(SOURCE_RECORD + 0x54, 700)
rows = []
for local, critical, selector in [('source', 0, 0), ('source', 1, 3)] + [
        ('target', 0, n) for n in range(4)] + [('target', 1, 3)]:
    uc.mem_write(PACKET, bytes(0x30))
    write(PACKET + 0xc, 77, 88)
    uc.mem_write(PACKET + 0x14, bytes([critical]))
    write(PACKET + 0x20, 43, selector, 1500)
    write(OWNER + 0x3c, SOURCE if local == 'source' else TARGET)
    trace.clear()
    record_writes.clear()
    actions.clear()
    before = [bytes(uc.mem_read(r, 0x140)) for r in (SOURCE_RECORD, TARGET_RECORD)]
    call(0x424614, OWNER, PACKET, 0, 0)
    assert trace == [{'text': '-43', 'selector': 2 if critical else 1}]
    assert actions == ([selector + 1] if local == 'target' and not critical else [])
    assert not record_writes
    assert before == [bytes(uc.mem_read(r, 0x140)) for r in (SOURCE_RECORD, TARGET_RECORD)]
    rows.append({'localRole': local, 'critical': critical, 'hurtSelector': selector,
                 'numericText': list(trace), 'actions': list(actions),
                 'hp': [read(SOURCE_RECORD + 0x54), read(TARGET_RECORD + 0x54)],
                 'recordWrites': list(record_writes)})
result = {'status': 'PASS_ORIGINAL_LOCAL_SHOT_HURT_CRITICAL_NO_HP_WRITE', 'rows': rows,
          'scope': 'Complete424614 with original422877/4228f1, integer/status getters, '
                   '423092 nonlocal early-return and467209 numeric formatting path. '
                   'Role lookup, visual housekeeping, CRT formatting, enqueue and action dispatch '
                   'are supplied. No flag15/1c, skill-trigger consumer or server damage formula coverage.'}
(ROOT / 'recovery/output/role-local-shot-hurt-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: seven local-role shot notifications, hurt actions, critical text and no HP writes')
