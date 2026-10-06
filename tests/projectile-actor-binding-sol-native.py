"""Execute the original Shot observer binding and its concrete member callback."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 4096)
uc.mem_map(0x2000000, 0x20000)
OWNER, ROLE, VIEW, ACTOR, VTABLE, CALLBACK, COPY, SENTINEL, NODE, STACK, STOP = [0x2001000 + 0x1000 * i for i in range(11)]
POSITION = ACTOR + 0x180


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def run(address, owner, *args):
    put(STACK, STOP, *args)
    uc.reg_write(UC_X86_REG_ECX, owner)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    uc.emu_start(address, STOP, count=20000)
    assert uc.reg_read(UC_X86_REG_EIP) == STOP
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + len(args) * 4


events = []


def hook(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x578620:
        assert get(stack + 4) == 16
        finish(COPY)
    elif address == 0x431dbf:
        assert machine.reg_read(UC_X86_REG_ECX) == ROLE
        assert [get(stack + 4), get(stack + 8)] == [12, 0]
        events.append(dict(kind='roleSetter', index=12, value=0))
        finish(0, 8)
    elif address == 0x485b1b:
        name = bytes(machine.mem_read(get(stack + 8), 16)).split(b'\0')[0].decode('ascii')
        vector = list(struct.unpack('<3f', machine.mem_read(get(stack + 20), 12)))
        assert get(stack + 12) == POSITION
        assert get(stack + 16) == 1
        assert vector == [0.0, 0.0, -1.0]
        events.append(dict(kind='attachedEffect', name=name, position=POSITION, flag=1, vector=vector))
        finish()
    else:
        raise AssertionError(hex(address))


for address in [0x578620, 0x431dbf, 0x485b1b]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(OWNER + 0x3c, 0)
put(ROLE + 0x310, ACTOR)
put(ACTOR, VTABLE)
put(VTABLE + 0x1c, 0x464836)
put(VIEW + 0x24, SENTINEL)
run(0x4cd86e, CALLBACK, VIEW, 0x4cefc9)
assert [get(CALLBACK), get(CALLBACK + 8), get(CALLBACK + 12)] == [0x5d10d4, 0x4cefc9, VIEW]
run(0x4ce4aa, CALLBACK)
assert uc.reg_read(UC_X86_REG_EAX) == COPY
assert bytes(uc.mem_read(COPY, 16)) == bytes(uc.mem_read(CALLBACK, 16))
run(0x4233e1, OWNER, COPY)
assert get(OWNER + 0x8c) == COPY
names = ['GA07', 'GA10', 'GA10', 'GA07', 'GA10', 'GA10', 'GA09', 'GA09', 'GA09', 'GA09'] + ['GA08'] * 11
rows = []
for matching in [False, True]:
    for item in [2000, *range(2001, 2022), 2022]:
        for flags in ([0, 4, 0xff000007] if matching else [0]):
            events.clear()
            put(SENTINEL, NODE if matching else SENTINEL)
            put(NODE, SENTINEL, 0, 0, 2, 0, ROLE)
            record = VIEW + 0x208 + 2 * 0x44
            put(record + 4, 0x3f800000)
            put(record + 12, flags)
            run(0x423092, OWNER, ROLE, item)
            effects = [e for e in events if e['kind'] == 'attachedEffect']
            assert len(effects) == int(2001 <= item <= 2021)
            if effects:
                assert effects[0]['name'] == names[item - 2001]
            assert events[-1]['kind'] == 'roleSetter'
            expected = flags if flags & 4 else (flags & 0xff000002) | 2
            assert get(record + 4) == (0 if matching else 0x3f800000)
            assert get(record + 12) == (expected if matching else flags)
            rows.append(dict(matchingRole=matching, item=item, flagsBefore=flags,
                             recordTimeBits=get(record + 4), flagsAfter=get(record + 12), events=list(events)))
result = dict(status='PASS', rows=rows,
              source=dict(constructor='0x4cd86e', clone='0x4ce4aa', setter='0x4233e1', shot='0x423092', dispatch='0x49f571', callback='0x4cefc9', registration='0x4d4338–0x4d435f'),
              scope='Complete original callback constructor, allocator-backed clone, absent-old-observer setter, remote-role Shot handler, member dispatch and callback execute. Actual actor position getter464836 executes. Allocation, effect sink and role setter supplied. Matching first list entry or empty list; local-role timer path and list traversal not covered. This callback updates visual record state and attaches GA07/08/09/10 effects; no projectile entity or ballistic assignment identified.')
(ROOT / 'recovery/output/projectile-actor-binding-sol-native.json').write_text(json.dumps(result, indent=2) + '\n')
print(f'PASS: {len(rows)} original Shot callback chains; concrete observer selects GA07/08/09/10')
