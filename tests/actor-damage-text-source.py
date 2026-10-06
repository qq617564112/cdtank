"""Execute the actor numeric-text branch with explicit formatting services."""
import json
import struct
import sys
from pathlib import Path

import capstone
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_EAX, UC_X86_REG_ECX, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

machine, images = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
machine.mem_map(0x2000000, 0x20000)
ACTOR, STACK, STOP = 0x2001000, 0x200a000, 0x200f000
events = []


def word(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def signed(address):
    return struct.unpack('<i', machine.mem_read(address, 4))[0]


def string(address):
    return bytes(machine.mem_read(address, 64)).split(b'\0')[0].decode('ascii')


def finish(pop=0, result=0):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EAX, result)
    machine.reg_write(UC_X86_REG_EIP, word(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def observe(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address == 0x57c0d6:
        destination, capacity, format_address = [word(stack + offset) for offset in (4, 8, 12)]
        value = signed(stack + 16)
        pattern = string(format_address)
        assert pattern in {'%d', '+%d'} and capacity == 32
        text = pattern % value
        machine.mem_write(destination, text.encode('ascii') + b'\0')
        events.append({'service': 'CRT formatting', 'pattern': pattern, 'value': value})
        finish(result=len(text))
    elif address == 0x466d09:
        events.append({'service': 'actor enqueue', 'actor': hex(machine.reg_read(UC_X86_REG_ECX)),
                       'text': string(word(stack + 4)), 'selector': word(stack + 8)})
        finish(8)


for address in (0x57c0d6, 0x466d09):
    machine.hook_add(UC_HOOK_CODE, observe, begin=address, end=address)

rows = []
for value in (-43, 0, 43):
    for selector in (0, 1, 2, 3):
        events.clear()
        machine.mem_write(STACK, struct.pack('<IiI', STOP, value, selector))
        machine.reg_write(UC_X86_REG_ECX, ACTOR)
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.emu_start(0x467209, STOP, count=200)
        assert machine.reg_read(UC_X86_REG_EIP) == STOP
        assert machine.reg_read(UC_X86_REG_ESP) == STACK + 12
        expected = ('+' if value > 0 else '') + str(value)
        assert events[-1] == {'service': 'actor enqueue', 'actor': hex(ACTOR),
                              'text': expected, 'selector': selector}
        rows.append({'value': value, 'selector': selector, 'events': list(events)})

pe = images['cdtank.exe']
base = pe.OPTIONAL_HEADER.ImageBase
decoder = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)


def source(start, end):
    return {'start': hex(start), 'instructions': [
        {'address': hex(instruction.address), 'bytes': instruction.bytes.hex(),
         'instruction': f'{instruction.mnemonic} {instruction.op_str}'.strip()}
        for instruction in decoder.disasm(pe.get_data(start - base, end - start), start)]}


font_names = {str(selector): pe.get_data(address - base, 32).split(b'\0')[0].decode('ascii')
              for selector, address in ((0, 0x5c82fc), (1, 0x5c82f4),
                                        (2, 0x5c82e8), (3, 0x5c82b8))}
assert font_names['1'] == 'Damage'
assert struct.unpack('<f', pe.get_data(0x5c1540 - base, 4))[0] == 100
result = {
    'status': 'PASS_ACTOR_NUMERIC_TEXT_FORMAT_BRANCH_STATIC_ENQUEUE_CONTRACT',
    'rows': rows, 'fonts': font_names,
    'enqueue': {'entry': '0x466d09', 'queue': 'actor+0x240',
                'position': 'actor virtual+0x1c projected once',
                'localIdentity': 'actor+0x258 equals current role from 0x4269c4',
                'localScreenYOffset': -100,
                'screenConversion': '0x44ef2c/0x44ef47 integer viewport conversion'},
    'ordinaryHit': {'entry': '0x422877', 'actor': 'role+0x310',
                    'numericValue': 'negated signed damage argument', 'selector': 1,
                    'order': 'text enqueue precedes role state2 hurt-action gate'},
    'criticalHit': {'entry': '0x4228f1', 'numericValue': 'negated damage',
                    'selector': 2, 'gate': 'actor exists and damage nonzero'},
    'update': {'entry': '0x4673b7', 'position': 'actor+0x28',
               'delta': 'actor+0xb4', 'recordUpdate': '0x46449f',
               'draw': '0x465c40 calls 0x465196'},
    'source': [source(a, b) for a, b in (
        (0x422877, 0x4228d9), (0x4228f1, 0x42294c),
        (0x424749, 0x4247a8), (0x467209, 0x46725b),
        (0x466d09, 0x466ddc), (0x465dfe, 0x465ee6),
        (0x465fa2, 0x466065), (0x465c03, 0x465c6e), (0x4673b7, 0x46748f),
        (0x46753f, 0x46759f), (0x468aed, 0x468b21), (0x4683f2, 0x468419))],
    'scope': 'Twelve actual original sign/selector branches. CRT formatting and final enqueue are supplied recording services. Enqueue projection, local offset, actor queue and hit routing are static instructions. Shared Castle record update/draw evidence reused; no font GPU, actor lifetime, heal producer, server policy or ordinary-browser acceptance.'}
(ROOT / 'recovery/output/actor-damage-text-source.json').write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(result['status'])
