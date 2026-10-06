"""Execute the original shot-display item/skill chain and capture its effect sink."""
import json
import itertools
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
OWNER, GLOBAL, ROLE, VTABLE, ITEM, SKILL, MANAGER, STACK, STOP, TEXT, CONVERTED = [0x2001000 + 0x1000 * i for i in range(11)]
GET_SLOT = 0x2010000


def put(address, *values):
    uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def get(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]


def finish(value=0, pop=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EAX, value)
    uc.reg_write(UC_X86_REG_EIP, get(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


events = []
item_present = skill_present = True
fallback_item_present = fallback_skill_present = True
gate_open = False
lookup_count = 0


def hook(machine, address, size, data):
    global lookup_count
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x4269c4:
        finish(ROLE)
    elif address == GET_SLOT:
        assert get(stack + 4) == 11
        finish(1, 4)
    elif address in [0x413c74, 0x413c65]:
        finish(OWNER)
    elif address == 0x411068:
        identifier = get(stack + 4)
        events.append(dict(kind='tableLookup', identifier=identifier))
        lookup_count += 1
        finish((ITEM if item_present else 0) if lookup_count == 1 else
               ((SKILL + 0x200 if identifier == 4020 else SKILL) if (fallback_skill_present if identifier == 4020 else skill_present) else 0), 4)
    elif address == 0x48603a:
        events.append(dict(kind='skillGate', identifier=get(stack + 4)))
        finish(int(gate_open), 4)
    elif address == 0x43bdbd:
        events.append(dict(kind='fallbackItem'))
        finish(ITEM + 0x200 if fallback_item_present else 0)
    elif address == 0x40fa48:
        pattern = bytes(machine.mem_read(get(stack + 4), 32)).split(b'\x00')[0].decode('ascii')
        assert pattern == '_root\\online\\%03d'
        events.append(dict(kind='formatPattern', value=pattern))
        finish(machine.reg_read(UC_X86_REG_ECX), 4)
    elif address == 0x4880f0:
        field = get(stack + 8)
        assert field == SKILL + (0x200 if lookup_count == 3 else 0) + 0x70
        events.append(dict(kind='effectField', offset='0x70', value=get(field)))
        finish()
    elif address == 0x40e10e:
        result = get(stack + 4)
        put(result + 4, TEXT)
        put(result + 0x18, 0x20)
        finish(result, 4)
    elif address == 0x45afc2:
        result = get(stack + 4)
        xyz = list(struct.unpack('<3I', machine.mem_read(stack + 12, 12)))
        events.append(dict(kind='worldEffect', manager=machine.reg_read(UC_X86_REG_ECX), name=get(stack + 8), xyzBits=xyz, terrainFlag=get(stack + 24)))
        put(result, 0)
        finish(result, 24)
    elif address == 0x4858f2:
        events.append(dict(kind='sound', name=get(stack + 8), enabled=get(stack + 12)))
        finish()
    elif address == 0x401171:
        finish(0, 8)
    elif address == 0x40f4c9:
        finish()
    else:
        raise AssertionError(hex(address))


for address in [0x4269c4, GET_SLOT, 0x413c74, 0x413c65, 0x411068, 0x48603a, 0x43bdbd,
                0x40fa48, 0x4880f0, 0x40e10e, 0x45afc2, 0x4858f2, 0x401171, 0x40f4c9]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(0x633588, GLOBAL)
put(GLOBAL + 0x128, OWNER)
put(0x635830, MANAGER)
put(MANAGER + 0x60, MANAGER)
put(ROLE, VTABLE)
put(VTABLE + 0x18, GET_SLOT)
put(ITEM + 0x10c, 2001)
put(ITEM + 0x200 + 0x10c, 4020)
put(SKILL + 0xc, 2001)
put(SKILL + 0x70, 0)
uc.mem_write(SKILL + 0x80, b'0\x00')
put(SKILL + 0x94, 1)
put(SKILL + 0x200 + 0xc, 4020)
put(SKILL + 0x200 + 0x70, 73)
uc.mem_write(SKILL + 0x200 + 0x80, b'fallback\x00')
put(SKILL + 0x200 + 0x94, 1)
rows = []
for item_present, manager_present, skill_present, gate_open, fallback_item_present, fallback_skill_present in itertools.product([False, True], repeat=6):
    put(MANAGER + 0x60, MANAGER if manager_present else 0)
    for xyz in [(0.0, 0.0, 0.0), (123.25, 20.0, -48.5), (-250.0, -3.0, 99.0)]:
        events.clear()
        lookup_count = 0
        bits = list(struct.unpack('<3I', struct.pack('<3f', *xyz)))
        put(STACK, STOP, *bits)
        uc.reg_write(UC_X86_REG_ECX, OWNER)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        uc.emu_start(0x423956, STOP, count=20000)
        assert uc.reg_read(UC_X86_REG_EIP) == STOP
        assert uc.reg_read(UC_X86_REG_ESP) == STACK + 16
        selected_success = skill_present and not gate_open
        fallback = item_present and manager_present and not selected_success
        expected = item_present and manager_present and (selected_success or (fallback_item_present and fallback_skill_present))
        effects = [event for event in events if event['kind'] == 'worldEffect']
        assert len(effects) == int(expected)
        assert sum(event['kind'] == 'fallbackItem' for event in events) == int(fallback)
        lookups = [event['identifier'] for event in events if event['kind'] == 'tableLookup']
        expected_lookups = [2001]
        if item_present and manager_present:
            expected_lookups.append(2001)
            if fallback and fallback_item_present:
                expected_lookups.append(4020)
        assert lookups == expected_lookups
        assert sum(event['kind'] == 'skillGate' for event in events) == int(item_present and manager_present and skill_present)
        if effects:
            assert effects[0]['xyzBits'] == bits
            assert effects[0]['manager'] == MANAGER
            assert effects[0]['terrainFlag'] == 1
            assert [e['offset'] for e in events if e['kind'] == 'effectField'] == ['0x70']
            assert [e['name'] for e in events if e['kind'] == 'sound'] == [SKILL + (0x200 if fallback else 0) + 0x80]
        else:
            assert not any(e['kind'] in ('effectField', 'sound') for e in events)
        rows.append(dict(itemPresent=item_present, managerPresent=manager_present, skillPresent=skill_present,
                         gateOpen=gate_open, fallbackItemPresent=fallback_item_present,
                         fallbackSkillPresent=fallback_skill_present, usedFallback=fallback,
                         xyzBits=bits, events=list(events)))
output = dict(status='PASS', rows=rows, source=dict(forward='0x423956', showShotEffect='0x489ba8', itemSkillOffset='0x10c', skillEffectOffset='0x70', skillSoundStringOffset='0x7c', worldEffectSink='0x45afc2'),
              scope='Complete423956 and489ba8 normal-slot selected skill, gate and default-item/skill fallback paths, including all missing sources. Role lookup/current slot, table lookup, skill gate, formatting/string lifetime, world-effect sink and sound sink supplied. Actual x87 XYZ forwarding, item-to-skill offset read, branch flow and sink arguments execute. No ballistic entity creation/update, speed, lifetime or muzzle assignment is identified.')
(ROOT / 'recovery/output/projectile-parameters-sol-native.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(f'PASS: {len(rows)} original shot-display chains; XYZ forwards unchanged to world-effect sink')
