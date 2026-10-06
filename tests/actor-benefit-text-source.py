"""Execute the original HP-increase observer's numeric-text qualification."""
import json
import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_X86, CS_MODE_32
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_EBP, UC_X86_REG_EBX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESI, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

machine, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x20000)
ROLE, ACTOR, TABLE, STACK, SERVICE, GET, ID = (
    0x2001000, 0x2002000, 0x2003000, 0x200a000, 0x2004000, 0x200b000, 0x200b100)
current_hp, maximum_hp = 0, 200
events = []


def words(address, *values):
    machine.mem_write(address, struct.pack('<' + 'I' * len(values), *values))


def word(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def signed(address):
    return struct.unpack('<i', machine.mem_read(address, 4))[0]


def text(address):
    return bytes(machine.mem_read(address, 64)).split(b'\0')[0].decode('ascii')


def finish(pop=0, value=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EAX, value)
    machine.reg_write(UC_X86_REG_EIP, word(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def observe(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == GET:
        selector = word(stack + 4)
        assert selector in (15, 16)
        finish(4, current_hp if selector == 15 else maximum_hp)
    elif address == ID:
        finish(value=7)
    elif address in (0x4886aa, 0x486d6f):
        # Existing recovery/low-health effect service is outside this new text source slice.
        finish(12 if address == 0x4886aa else 8)
    elif address == 0x57c0d6:
        destination, capacity, pattern = word(stack + 4), word(stack + 8), text(word(stack + 12))
        assert capacity == 32 and pattern in ('%d', '+%d')
        value = pattern % signed(stack + 16)
        machine.mem_write(destination, value.encode('ascii') + b'\0')
        finish(value=len(value))
    elif address == 0x466d09:
        events.append({'actor': hex(machine.reg_read(UC_X86_REG_ECX)),
                       'text': text(word(stack + 4)), 'selector': word(stack + 8)})
        finish(8)


words(ROLE, TABLE)
words(TABLE + 4, ID)
words(TABLE + 0x14, GET)
words(ROLE + 0x310, ACTOR)
words(0x633588, SERVICE)
words(SERVICE + 0x128, SERVICE)
for address in (GET, ID, 0x4886aa, 0x486d6f, 0x57c0d6, 0x466d09):
    machine.hook_add(UC_HOOK_CODE, observe, begin=address, end=address)

rows = []
for cached_hp, current_hp in ((100, 120), (50, 80), (100, 100), (100, 57), (100, 0), (0, 200)):
    events.clear()
    words(ROLE + 0x31c, cached_hp)
    machine.reg_write(UC_X86_REG_ESI, ROLE)
    machine.reg_write(UC_X86_REG_EBX, 15)
    machine.reg_write(UC_X86_REG_ESP, STACK)
    machine.emu_start(0x42f43b, 0x42f568, count=1000)
    assert machine.reg_read(UC_X86_REG_EIP) == 0x42f568
    assert machine.reg_read(UC_X86_REG_ESP) == STACK
    expected = [{'actor': hex(ACTOR), 'text': f'+{current_hp - cached_hp}', 'selector': 0}]
    if current_hp <= cached_hp or cached_hp == 0:
        expected = []
    assert events == expected
    assert word(ROLE + 0x31c) == current_hp
    rows.append({'cachedHP': cached_hp, 'currentHP': current_hp, 'maxHP': maximum_hp,
                 'textEvents': list(events), 'cacheAfter': word(ROLE + 0x31c)})

RECORD, FRAME, FONT = 0x200d000, 0x2009000, 0x200e000
font_strings = {}
font_calls = []
supplied = {0x5c03b8: 0x200c000, 0x5c03e4: 0x200c100,
            0x5c03b4: 0x200c200, 0x5c0330: 0x200c300}


def font_service(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    context = machine.reg_read(UC_X86_REG_ECX)
    if address == supplied[0x5c03b8]:
        font_strings[context] = text(word(stack + 4))
        finish(4, context)
    elif address == supplied[0x5c03e4]:
        finish(value=SERVICE)
    elif address == supplied[0x5c03b4]:
        name = font_strings[word(stack + 4)]
        font_calls.append({'font': name, 'service': 'CEGUI FontManager.getFont'})
        finish(4, FONT)
    elif address == supplied[0x5c0330]:
        finish()


for address, callback in supplied.items():
    words(address, callback)
    machine.hook_add(UC_HOOK_CODE, font_service, begin=callback, end=callback)
words(FRAME + 8, 0)
machine.reg_write(UC_X86_REG_EBP, FRAME)
machine.reg_write(UC_X86_REG_ESI, RECORD)
machine.reg_write(UC_X86_REG_EBX, 0)
machine.reg_write(UC_X86_REG_ESP, STACK)
machine.emu_start(0x465e2b, 0x466065, count=300)
assert machine.reg_read(UC_X86_REG_EIP) == 0x466065
assert machine.reg_read(UC_X86_REG_ESP) == STACK
fields = {name: struct.unpack('<f', machine.mem_read(RECORD + offset, 4))[0]
          for name, offset in (('scale', 0x28), ('alpha', 0x2c), ('elapsed', 0x30),
                               ('fadeAfter', 0x3c), ('expiresAt', 0x40), ('screenYRate', 0x44))}
assert fields == {'scale': 1, 'alpha': 1, 'elapsed': 0, 'fadeAfter': .5,
                  'expiresAt': 1, 'screenYRate': -40}
assert font_calls == [{'font': 'Benefit', 'service': 'CEGUI FontManager.getFont'}]
assert word(RECORD + 0x34) == FONT and word(RECORD + 0x24) == 0
font_catalog = json.loads((ROOT / 'recovery/output/web-assets/ui-fonts.json').read_text())
font = next(font for font in font_catalog['fonts'] if font['name'] == 'Benefit')
assert font['attributes']['Type'] == 'Static'
assert sorted(glyph['codepoint'] for glyph in font['glyphs']) == list(range(48, 58))
assert all((ROOT / 'recovery/output/web-assets' / glyph['asset']).is_file() for glyph in font['glyphs'])

pe = images['cdtank.exe']
decoder = Cs(CS_ARCH_X86, CS_MODE_32)
source = [{'start': hex(a), 'instructions': [
    {'address': hex(i.address), 'bytes': i.bytes.hex(), 'instruction': f'{i.mnemonic} {i.op_str}'.strip()}
    for i in decoder.disasm(pe.get_data(a - 0x400000, z - a), a)]}
    for a, z in ((0x42f43b, 0x42f568), (0x42292f, 0x42294c), (0x465e2b, 0x465ead))]
result = {'status': 'PASS_ACTOR_BENEFIT_TEXT_HP_INCREASE_BRANCH_ONLY',
          'entry': '0x42f43b', 'rows': rows, 'source': source,
          'qualification': 'currentHP > cached role+31c and cachedHP !=0; cachedHP always refreshed',
          'font': 'Benefit (selector0)', 'screenYRate': -40,
          'constructor': {'fields': fields, 'fontCalls': font_calls},
          'fontProvider': {'source': font['source'], 'attributes': font['attributes'],
                           'glyphs': font['glyphs'], 'unmappedPlus': True},
          'scope': 'Six original HP observer branches and original selector0 constructor field/font selection execute. Getter selectors15/16, existing skill services, CRT formatting, final enqueue and CEGUI font services are supplied boundaries. Published Benefit digits exist; no plus glyph. Shared record update/draw/projection evidence reused. No new healing authority, font GPU, production module or browser claim.'}
(ROOT / 'recovery/output/actor-benefit-text-source.json').write_text(json.dumps(result, indent=2) + '\n')
print(result['status'])
