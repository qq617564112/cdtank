"""Execute full original actor update with real MV3 message query callbacks."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from effect_action_events import source_actions

paths = [ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll']
machine, _ = map_original_binaries(paths)
machine.mem_map(0x2000000, 0x40000)
ACTOR, DEFINITION, VTABLE, SLOT, MODEL, EVENTS, MODEL_TABLE, DELTA, STACK, STOP = (
    0x2010000, 0x2011000, 0x2012000, 0x2013000, 0x2014000, 0x2015000,
    0x2016000, 0x2017000, 0x2008000, 0x203f000)
messages = []


def uint(address):
    return struct.unpack('<I', machine.mem_read(address, 4))[0]


def finish(pop):
    stack = machine.reg_read(UC_X86_REG_ESP)
    machine.reg_write(UC_X86_REG_EIP, uint(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)


def hook(uc, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == STOP - 0x10:
        finish(4)
    elif address == 0x1001e5f0:
        event = uint(stack + 4)
        messages.append(uint(event + 4))
        finish(4)


machine.hook_add(UC_HOOK_CODE, hook)
machine.mem_write(0x10028030, b'\xdd\x05' + struct.pack('<I', DELTA) + b'\xc3')
machine.mem_write(VTABLE + 0x38, struct.pack('<I', STOP - 0x10))
machine.mem_write(VTABLE + 0x50, struct.pack('<I', 0x1000d1d0))
machine.mem_write(DEFINITION, struct.pack('<I', VTABLE))
machine.mem_write(DEFINITION + 0x14, struct.pack('<I', MODEL_TABLE))
machine.mem_write(DEFINITION + 0x20, struct.pack('<I', MODEL))
machine.mem_write(MODEL_TABLE, struct.pack('<I', MODEL))
actions = [a for a in source_actions() if a['tankId'] == 1 and a['action'] in ['01', '03']]
rows = []
for action in actions:
    duration = action['duration']
    machine.mem_write(MODEL, bytes(0x200))
    machine.mem_write(MODEL + 0x184, struct.pack('<II', duration, len(action['events'])))
    machine.mem_write(MODEL + 0x1b4, struct.pack('<I', EVENTS))
    for index, event in enumerate(action['events']):
        raw = bytearray(24)
        struct.pack_into('<I', raw, 0, event['time'])
        struct.pack_into('<I', raw, 20, event['identifier'])
        machine.mem_write(EVENTS + index * 24, bytes(raw))
    for mode in (['idle'] if action['action'] == '01' else ['fire-suspended', 'fire-direct']):
        stopped = action['action'] == '03'
        machine.mem_write(ACTOR, bytes(0x100))
        machine.mem_write(ACTOR + 0x34, struct.pack('<f', 1))
        machine.mem_write(ACTOR + 0x7c, struct.pack('<III', DEFINITION, SLOT, 1))
        machine.mem_write(ACTOR + 0xb0, struct.pack('<I', stopped))
        machine.mem_write(SLOT, struct.pack('<IIfIIIIII', 1, 0, 1, 1, 1, 0, duration, 1, 0x6f766572))
        steps = []
        samples = ([0, .016, .499999999, .5, .75, 2]
                   if mode == 'idle' else [.5, .75, 2, .5, .75, 2, 2, 2]
                   if mode == 'fire-suspended' else [2])
        for input_seconds in samples:
            getter = input_seconds if input_seconds < .5 else .1
            delta = input_seconds if mode == 'fire-direct' else struct.unpack('<f', struct.pack('<f', getter))[0]
            messages.clear()
            machine.mem_write(DELTA, struct.pack('<d', delta))
            machine.mem_write(STACK, struct.pack('<I', STOP))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ECX, ACTOR)
            machine.reg_write(UC_X86_REG_FPCW, 0x27f)
            machine.emu_start(0x1000a7b0, STOP, count=50000)
            assert machine.reg_read(UC_X86_REG_ESP) == STACK + 4
            steps.append({'inputSeconds': input_seconds, 'getter': getter, 'delta': delta, 'time': uint(SLOT + 0xc),
                          'overMessage': uint(SLOT + 0x20), 'messages': list(messages)})
        rows.append({'action': action, 'mode': mode, 'stopped': stopped, 'steps': steps})
(ROOT / 'recovery/output/tank-actor-clock-native-sol.json').write_text(json.dumps({
    'source': 'gbengine.dll actor1000a7b0, original timed-event query/notify; source getter rule and scene float32 input',
    'rows': rows}) + '\n')
print(f'PASS: {len(rows)} original tank1 actor sequences / {sum(len(r["steps"]) for r in rows)} ticks')
