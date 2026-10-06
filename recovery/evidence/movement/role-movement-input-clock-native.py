"""Execute original input mapping and elapsed-clock producer, with explicit boundaries."""
from pathlib import Path
import json
import struct
import sys
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_ESP, UC_X86_REG_EIP, UC_X86_REG_ECX, UC_X86_REG_EAX, UC_X86_REG_FPCW, UC_X86_REG_FPSW, UC_X86_REG_FPTAG
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'recovery'))
from effect_native import map_original_binaries
uc, _ = map_original_binaries([ROOT / 'CDTank/CDTank.exe'])
uc.mem_map(0, 0x10000)
uc.mem_map(0x2000000, 0x20000)
STACK, STOP, ROLE, MANAGER, CLOCK_TICK, CLOCK_COUNTER = [0x2004000 + i * 0x1000 for i in range(6)]
def put(address, *values): uc.mem_write(address, struct.pack('<' + 'I' * len(values), *values))
def read(address): return struct.unpack('<I', uc.mem_read(address, 4))[0]
def reset(entry, arguments):
    uc.mem_write(STACK, struct.pack('<I', STOP) + arguments)
    for register, value in [(UC_X86_REG_ESP, STACK), (UC_X86_REG_ECX, ROLE),
            (UC_X86_REG_FPCW, 0x27f), (UC_X86_REG_FPSW, 0), (UC_X86_REG_FPTAG, 0xffff)]:
        uc.reg_write(register, value)
    uc.emu_start(entry, STOP, count=20000)
def return_from_call(argument_bytes=0):
    stack = uc.reg_read(UC_X86_REG_ESP)
    uc.reg_write(UC_X86_REG_EIP, read(stack))
    uc.reg_write(UC_X86_REG_ESP, stack + 4 + argument_bytes)
commands, idle, clock_calls = [], [], []
mode, ticks, counter = 'input', 0, 0
put(0x5c0828, CLOCK_TICK); put(0x5c05dc, CLOCK_COUNTER)
def hook(machine, address, size, data):
    stack = uc.reg_read(UC_X86_REG_ESP)
    if address == 0x426fe3:
        command, delta, timestamp = struct.unpack('<I2f', uc.mem_read(stack + 4, 12))
        commands.append(dict(command=command, delta=delta, timestamp=timestamp))
        return_from_call(12)
    elif address == 0x4269f4:
        idle.append(struct.unpack('<f', uc.mem_read(stack + 4, 4))[0]); return_from_call(4)
    elif address == CLOCK_TICK:
        uc.reg_write(UC_X86_REG_EAX, ticks); return_from_call()
    elif address == CLOCK_COUNTER:
        uc.mem_write(read(stack + 4), struct.pack('<q', counter))
        uc.reg_write(UC_X86_REG_EAX, 1); return_from_call(4)
    elif mode == 'clock' and address in [0x4254d1, 0x424242]:
        # Role update side effects are supplied; elapsed arithmetic and clock remain native.
        return_from_call(4 if address == 0x4254d1 else 0)
    elif mode == 'clock' and address == 0x42b1ab:
        delta, timestamp = struct.unpack('<2f', uc.mem_read(stack + 4, 8))
        clock_calls.append(dict(delta=delta, timestamp=timestamp)); uc.emu_stop()
for address in [0x426fe3, 0x4269f4, CLOCK_TICK, CLOCK_COUNTER, 0x4254d1, 0x424242, 0x42b1ab]:
    uc.hook_add(UC_HOOK_CODE, hook, begin=address, end=address)
put(ROLE + 0x3c, ROLE + 0x400)
uc.mem_write(ROLE + 0x39, b'\0')
rows = []
for bits in range(16):
    for previous in [0, 1]:
        for delta in [.05, .2]:
            commands.clear(); idle.clear()
            put(0x6350f4, bits); uc.mem_write(0x61e590, bytes([previous]))
            reset(0x42b1ab, struct.pack('<2f', delta, 12.5))
            assert uc.reg_read(UC_X86_REG_EIP) == STOP
            assert uc.reg_read(UC_X86_REG_ESP) == STACK + 12
            # Independent bit-priority table: bit0 before bit1; bit2 before bit3.
            expected = (6 if bits & 4 else 5 if bits & 8 else 1) if bits & 1 else (
                (8 if bits & 4 else 7 if bits & 8 else 2) if bits & 2 else (
                3 if bits & 4 else 4 if bits & 8 else 0 if previous else None))
            assert [row['command'] for row in commands] == ([] if expected is None else [expected])
            assert all(row['delta'] == struct.unpack('<f', struct.pack('<f', delta))[0]
                and row['timestamp'] == 12.5 for row in commands)
            assert idle == ([12.5] if bits == 0 else [])
            assert read(0x6350f4) == 0
            assert bytes(uc.mem_read(0x61e590, 1)) == bytes([int(bits != 0)])
            rows.append(dict(bits=bits, previous=previous, suppliedDelta=delta,
                commands=list(commands), idle=list(idle)))
mode = 'clock'
put(0x633588, MANAGER)
uc.mem_write(ROLE + 0x30, struct.pack('<d', 10.0))
clock_rows = []
for performance, raw, prior, initialized, expected in [
        (False, 12500, 0, False, 0),
        (False, 12550, 2.5, True, .05),
        (False, 12300, 2.5, True, 0),
        (False, 14000, 2.5, True, 1.5),
        (True, 12550000, 2.5, True, .05),
        (False, 0x80000000, 0, False, 0)]:
    ticks, counter = raw, raw
    uc.mem_write(MANAGER + 0x20, bytes([int(performance)]))
    uc.mem_write(MANAGER + 0x18, struct.pack('<q', 1000000))
    put(0x635200, int(initialized))
    uc.mem_write(0x6351fc, struct.pack('<f', prior))
    clock_calls.clear()
    reset(0x42b563, struct.pack('<I', 16))
    assert uc.reg_read(UC_X86_REG_EIP) == 0x42b1ab
    assert len(clock_calls) == 1
    # timeGetTime milliseconds -> seconds; QPC counter / frequency -> seconds.
    now = raw / (1000000 if performance else 1000) - 10
    assert abs(clock_calls[0]['timestamp'] - now) <= max(1e-6, abs(now) * 1e-7)
    assert abs(clock_calls[0]['delta'] - expected) < 1e-6
    clock_rows.append(dict(performanceCounter=performance, raw=raw, previous=prior,
        initialized=initialized, observed=clock_calls[0], expectedDelta=expected))
result = dict(status='PASS', inputRows=rows, clockRows=clock_rows,
    boundaries='Input426fe3/idle4269f4 supplied as capture endpoints; no controller or collision. '
        'Clock Windows APIs supplied, role4254d1/424242 side effects bypassed; '
        'original40607b/422f0d/42b563 elapsed producer executes to42b1ab entry. '
        'Clock frequency and role origin supplied; initialization producer not executed.')
(ROOT / 'recovery/output/movement-input-clock-native.json').write_text(json.dumps(result, indent=2) + '\n')
print('PASS: 64 original input dispatch combinations, priority/stop/timing/clear assertions')
print('PASS: 6 original elapsed-clock paths, milliseconds/QPC seconds, first/negative/long delta assertions')
