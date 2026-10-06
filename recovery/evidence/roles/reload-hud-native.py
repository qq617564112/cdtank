"""Execute the original crossbar duration/frame/completion and bullet-count UI."""
import json
from pathlib import Path
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ECX, UC_X86_REG_ESI, UC_X86_REG_EIP, UC_X86_REG_ESP

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries

uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0x2000000, 0x20000)
OWNER, ROLE, RECORD, CROSSBAR, BULLET, STACK, RETURN = [0x2001000 + i * 0x1000 for i in range(7)]
PROGRESS, WIDTH = 0x2011000, 0x2011100

def word(address, value):
    uc.mem_write(address, struct.pack('<I', value))

def floating(address, value):
    uc.mem_write(address, struct.pack('<f', value))

def read_word(address):
    return struct.unpack('<I', uc.mem_read(address, 4))[0]

def read_float(address):
    return struct.unpack('<f', uc.mem_read(address, 4))[0]

def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]

word(0x5c0128, PROGRESS)
word(0x5c00a4, WIDTH)
word(OWNER + 0xc8, CROSSBAR)
word(OWNER + 0xd0, BULLET)
word(OWNER + 0x34, ROLE)
word(ROLE + 0x2a0, RECORD)
events = []

def boundary(machine, address, size, data):
    stack = machine.reg_read(UC_X86_REG_ESP)
    if address in [PROGRESS, WIDTH]:
        events.append(dict(kind='progress' if address == PROGRESS else 'width',
            window=machine.reg_read(UC_X86_REG_ECX), value=read_float(stack + 4)))
        pop = 4
    else:
        # Original UI feedback dispatch; the progress producer executes unchanged.
        assert address == 0x4d6524
        pop = 0
    machine.reg_write(UC_X86_REG_EIP, read_word(stack))
    machine.reg_write(UC_X86_REG_ESP, stack + 4 + pop)

for address in [PROGRESS, WIDTH, 0x4d6524]:
    uc.hook_add(UC_HOOK_CODE, boundary, begin=address, end=address)

def call(address, arguments=()):
    uc.mem_write(STACK, struct.pack('<I', RETURN) + b''.join(arguments))
    uc.reg_write(UC_X86_REG_ECX, OWNER)
    uc.reg_write(UC_X86_REG_ESP, STACK)
    events.clear()
    uc.emu_start(address, RETURN, count=1000)
    assert uc.reg_read(UC_X86_REG_EIP) == RETURN
    assert uc.reg_read(UC_X86_REG_ESP) == STACK + 4 + 4 * len(arguments)
    return list(events)

rows = []
for duration in [0.6, 0.7, 0.8, 2.34567, 3.0]:
    duration = f32(duration)
    start = call(0x4cb670, [struct.pack('<f', duration)])
    total = f32(duration + 0.5)
    assert read_float(OWNER + 0x78) == read_float(OWNER + 0x7c) == total
    assert start == [dict(kind='progress', window=CROSSBAR, value=0.0)]
    for delta in [0.0, total / 4, total / 4, total, 0.05]:
        previous = read_float(OWNER + 0x78)
        delta = f32(delta)
        floating(OWNER + 0x10, delta)
        uc.reg_write(UC_X86_REG_ESI, OWNER)
        uc.reg_write(UC_X86_REG_ESP, STACK)
        events.clear()
        uc.emu_start(0x4ca9d7, 0x4caa1f, count=100)
        remaining = f32(max(0, previous - delta)) if previous > 0 else previous
        assert read_float(OWNER + 0x78) == remaining
        if previous > 0:
            expected = f32((total - remaining) / total)
            assert events == [dict(kind='progress', window=CROSSBAR, value=expected)]
        else:
            assert events == []
        rows.append(dict(durationSeconds=duration, totalSeconds=total, deltaSeconds=delta,
            remainingSeconds=remaining, events=list(events)))
    complete = call(0x4cb6ab)
    assert read_float(OWNER + 0x78) == 0
    assert complete == [dict(kind='progress', window=CROSSBAR, value=1.0)]

bullet_rows = []
for state in [0, 2, 3, 4]:
    word(RECORD + 0x90, state)
    for current, maximum in [(0, 12), (1, 12), (6, 12), (12, 12)]:
        result = call(0x4cb52f, [struct.pack('<I', current), struct.pack('<I', maximum)])
        enabled = state in [2, 3]
        assert result == [dict(kind='width', window=BULLET, value=float(maximum * 15) if enabled else 0.0),
            dict(kind='progress', window=BULLET, value=f32(current / maximum) if enabled else 0.0)]
        bullet_rows.append(dict(state=state, current=current, maximum=maximum, events=result))

output = dict(status='PASS', crossbarRows=rows, bulletRows=bullet_rows,
    scope='Actual4cb670 duration callback,4ca9d7..4caa1f frame slice,4cb6ab completion and full4cb52f bullet-count entry. '
    'CEGUI setProgress/setWidth and UI feedback dispatcher are supplied boundaries. Frame fixture supplies dt. '
    'Crossbar total and initial remaining are f32(duration+0.5); progress increases0→1. '
    'prgBullet is signed integer current/max fraction with width max*15, gated by actual43293d state2/3. '
    'Completion event producer, full frame loop and visual clipping renderer are not executed.')
(ROOT / 'recovery/output/reload-hud-native.json').write_text(json.dumps(output, indent=2) + '\n')
print(f'PASS: {len(rows)} crossbar frame rows, 5 duration/completion callbacks, {len(bullet_rows)} bullet-count rows')
