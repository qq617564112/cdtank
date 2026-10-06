"""Execute the shot-player Trigger8 call into the original skill effect system."""
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


RESOURCES, SKILLS, AMMO, AMMO_RECORD, SKILL, EFFECT_SYSTEM = [0x2013000 + i * 0x100 for i in range(6)]
ACTOR_VTABLE, EFFECT_TERMINAL = 0x2014000, 0x2015000
effects, sounds, lookups = [], [], []
def effect_boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    this = machine.reg_read(UC_X86_REG_ECX)
    if address == 0x411068:
        key = read(stack + 4)
        if this == AMMO + 0xc:
            assert key == 2013
            result = AMMO_RECORD
            kind = 'ammo'
        else:
            assert this == SKILLS + 0xc and key in (0, 2013, 4011)
            result = SKILL if key == 4011 else NON_TRIGGER if key == 2013 else 0
            kind = 'skill'
        lookups.append({'kind': kind, 'key': key})
        finish(result, 4)
    elif address == EFFECT_TERMINAL:
        assert this == ACTOR
        effects.append([read(stack + n) for n in (4, 8, 12, 16)])
        finish(0x12345, 16)
    else:
        assert address == 0x485b1b
        sound = bytes(machine.mem_read(read(stack + 8), 16)).split(b'\0')[0].decode()
        sounds.append(sound)
        result = read(stack + 4)
        machine.mem_write(result, bytes(24))
        finish(result)
for address in (0x411068, EFFECT_TERMINAL, 0x485b1b):
    uc.hook_add(UC_HOOK_CODE, effect_boundary, begin=address, end=address)
write(0x633588, RESOURCES + 0x300)
write(RESOURCES + 0x300 + 0x114, RESOURCES)
write(RESOURCES + 0x300 + 0x118, OWNER)
write(RESOURCES + 0x300 + 0x128, EFFECT_SYSTEM)
write(RESOURCES + 0x78, SKILLS, AMMO)
write(ACTOR, ACTOR_VTABLE)
write(ACTOR_VTABLE + 0xa8, EFFECT_TERMINAL)
write(SOURCE, 0x5c2c28)
write(TARGET, 0x5c2c28)
write(SOURCE + 0x2a0, SOURCE_RECORD)
write(TARGET + 0x2a0, TARGET_RECORD)
write(TARGET + 0x310, ACTOR)
write(OWNER + 0x3c, TARGET)
write(SOURCE_RECORD + 0xc, 77)
write(TARGET_RECORD + 0xc, 88)
write(SOURCE_RECORD + 0x40, 2013)
write(SOURCE_RECORD + 0x54, 700)
write(TARGET_RECORD + 0x54, 655)
# Reuse source2013/4011 identities and qualified presentation fields.
write(AMMO_RECORD + 0x108, 2013, 4011, 0)
write(SKILL + 0x2c, 8)
write(SKILL + 0x70, 22)
write(SKILL + 0xd0, 0)
uc.mem_write(SKILL + 0x80, b'SE27\0')
write(SKILL + 0x94, 15)
uc.mem_write(PACKET, bytes(0x30))
write(PACKET + 0xc, 77, 88)
uc.mem_write(PACKET + 0x14, bytes([1]))
write(PACKET + 0x20, 43)
trace.clear()
record_writes.clear()
# 2013 itself is a non-Trigger8 entry; provide a distinct definition for that lookup.
NON_TRIGGER = EFFECT_SYSTEM + 0x100
write(NON_TRIGGER + 0x2c, 0)
call(0x424614, OWNER, PACKET, 0, 0)
assert effects == [[22, 3, 0, 1]]
assert sounds == ['SE27']
assert trace == [{'text': '-43', 'selector': 2}]
assert not record_writes
assert [read(SOURCE_RECORD + 0x54), read(TARGET_RECORD + 0x54)] == [700, 655]
result = {'status': 'PASS_ORIGINAL_SHOT_TRIGGER8_TO_PRESENTATION_NO_HP_WRITE',
          'ammoTableId': 2013, 'hitSkillId': 4011, 'lookups': lookups,
          'effects': effects, 'sounds': sounds, 'numericText': trace,
          'hp': [700, 655], 'recordWrites': record_writes,
          'scope': 'Complete424614 including three ammo skills, Trigger8 filter and complete4886aa '
                   'one-shot presentation path, original486122 and431fe0 execute. '
                   'Lookups supply qualified ammo/skill identities and presentation fields. '
                   'Role lookup, visual action/audio terminals, housekeeping and text storage supplied. '
                   'No HP10 numeric consumer, Func2 formula or server damage/critical producer inferred.'}
(ROOT / 'recovery/output/role-shot-trigger8-presentation-native.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('PASS: shot-player Trigger8 invokes original skill presentation without HP writes')
