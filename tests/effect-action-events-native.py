"""Execute original gbengine MV3 interval event query and event-time lookup."""
from hashlib import sha256
import json
from pathlib import Path
import struct
import sys
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESP, UC_X86_REG_EAX, UC_X86_REG_ESI, UC_X86_REG_FPCW

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
from effect_action_events import source_actions

paths = [ROOT / 'CDTank/gbengine.dll', ROOT / 'CDTank/msvcr71.dll']
machine, _ = map_original_binaries(paths)
machine.mem_map(0x2000000, 0x40000)
MODEL, EVENTS, OUTPUT, STACK, STOP = (
    0x2010000, 0x2011000, 0x2020000, 0x2008000, 0x203f000)
actions = source_actions()
rows = []
for action in actions:
    machine.mem_write(MODEL, bytes(0x200))
    machine.mem_write(MODEL + 0x184, struct.pack('<II', action['duration'], len(action['events'])))
    machine.mem_write(MODEL + 0x1b4, struct.pack('<I', EVENTS))
    for index, event in enumerate(action['events']):
        raw = bytearray(24)
        struct.pack_into('<I', raw, 0, event['time'])
        raw[4:4 + len(event['name'])] = event['name'].encode('ascii')
        struct.pack_into('<I', raw, 20, event['identifier'])
        machine.mem_write(EVENTS + index * 24, bytes(raw))
        machine.mem_write(STACK, struct.pack('<II', STOP, event['identifier']))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, MODEL)
        machine.emu_start(0x1000be90, STOP, count=10000)
        assert machine.reg_read(UC_X86_REG_EAX) == event['time']
    duration = action['duration']
    intervals = {(0, 0), (0, 1), (0, duration - 1), (0, duration),
                 (duration - 1, duration + 1), (duration, duration * 2 + 1),
                 (duration - 20, duration - 100)}
    for event in action['events']:
        time = event['time']
        intervals.update([(max(0, time - 1), time), (time, time), (time, time + 1),
                          (duration + max(0, time - 1), duration + time)])
    steps = []
    for previous, current in sorted(intervals):
        machine.mem_write(OUTPUT, bytes(0x1000))
        machine.mem_write(STACK, struct.pack('<IIII', STOP, OUTPUT, previous, current))
        machine.reg_write(UC_X86_REG_ESP, STACK)
        machine.reg_write(UC_X86_REG_ECX, MODEL)
        machine.emu_start(0x1000bdc0, STOP, count=20000)
        count = machine.reg_read(UC_X86_REG_EAX)
        assert count < 1024
        assert machine.reg_read(UC_X86_REG_ESP) == STACK + 16
        identifiers = list(struct.unpack('<' + 'I' * count, machine.mem_read(OUTPUT, count * 4)))
        steps.append({'previous': previous, 'current': current, 'identifiers': identifiers})
    rows.append({'action': action, 'steps': steps})
output = ROOT / 'recovery/output/effect-action-events-native.json'
clock = []
DELTA = 0x2030000
# Supply the original gfx-manager delta return through a native FLD/RET fixture.
machine.mem_write(0x10028030, b'\xdd\x05' + struct.pack('<I', DELTA) + b'\xc3')
for precision in [0x27f, 0x37f]:
    for scale in [0, .5, 1, 1.25, 2]:
        for delta in [0, 1 / 60, 1 / 30, .001, .01, .2, .4, .6, 1.0, 2.0]:
            machine.mem_write(DELTA, struct.pack('<d', delta))
            machine.mem_write(MODEL + 0x34, struct.pack('<f', scale))
            machine.reg_write(UC_X86_REG_ESP, STACK)
            machine.reg_write(UC_X86_REG_ESI, MODEL)
            machine.reg_write(UC_X86_REG_FPCW, precision)
            machine.emu_start(0x1000a7d5, 0x1000a7ec, count=10000)
            clock.append({'precision': precision, 'delta': delta, 'scale': scale,
                          'step': machine.reg_read(UC_X86_REG_EAX),
                          'scaledDelta': struct.unpack('<f', machine.mem_read(STACK + 0x18, 4))[0]})
output.write_text(json.dumps({'sources': {p.name: sha256(p.read_bytes()).hexdigest() for p in paths},
                              'rows': rows, 'clock': clock}) + '\n')
print(f'PASS: {len(rows)} source action message lists / {sum(len(r["steps"]) for r in rows)} native intervals / {len(clock)} clock steps')
